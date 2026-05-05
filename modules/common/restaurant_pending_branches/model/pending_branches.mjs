import { ObjectId } from 'mongodb';
import { parallel as asyncParallel } from 'async';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { getRestaurantId, getUtcDate, isAdmin, isPost, sanitizeData, getCityList, saveRestaurantBranchLogs, configDatatable, getRestaurantDetails, copyFromParentTable} from "../../../../utils/index.mjs";
import { saveUserActivity, insertNotifications, restaurantAssignmentLogs, sendMailToUsers} from "../../../../services/index.mjs";
import cronModule from '../../../frontend/crons/model/cron.mjs';

export default class CommonPendingBranches{
	constructor(db) {
		this.db = db;
		this.cronModel = new cronModule(db);
	}

	/**
	 * Function to get pending branch list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getPendingBranchList (req,res,next){
		try{
			let slug 	=   req?.params?.slug || "";
			let userId 	=   req?.session?.user?._id || "";

			if(isPost(req)){
				let limit			= (req?.body?.length)	? parseInt(req?.body?.length) : Constants.ADMIN_LISTING_LIMIT;
				let skip			= (req?.body?.start)	? parseInt(req?.body?.start)  : Constants.DEFAULT_SKIP;
				const collection	= this.db.collection(Tables.TMP_RESTAURANT_BRANCHES);

				let commonConditions= {restaurant_slug :slug};
				if(isAdmin(req,res)){
					commonConditions['$or'] = [
						{submit_for_approval : true},
						{admin_id : new ObjectId(userId)}
					];
				}

				/** Configure Datatable conditions*/
				const dataTableConfig = await configDatatable(req, res, null);

				/* assign in a single object */
				dataTableConfig.conditions = Object.assign(commonConditions, dataTableConfig.conditions);

				/** Get list or count of restaurant branches */
				let dbRes = await collection.aggregate([
					{ $match: dataTableConfig.conditions },
					{$facet : {
						list : [
							{$sort: dataTableConfig.sort_conditions },
							{$skip: skip},
							{$limit: limit},
							{$project: {
								branch_id:1,name:1,address:1,branch_number:1,status:1,rejection_reason:1,delivery_vehicle_type:1,auto_assignment_start_after:1
							}}
						],
						count: [
							{$count: "count"},
						],
					}}
				]).toArray();

				/** Send response **/
				res.send({
					status: Constants.STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data			:   dbRes?.[0]?.list ||[],
					recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
					recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
				});
			}else{
				res.render('list',{
					layout: false,
					slug: slug,
				});
			}
		}catch(err){
			next(err);
		}
	}//End getPendingBranchList()

	/**
	 * Function to get Branch detail
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	async getPendingBranchDetails (req,res,next){
		try{
			let branchId 	= req?.params?.id || "";
			let slug		= req?.params?.slug || "";

			/** Get Branch details **/
			const tmp_restaurant_branches = this.db.collection(Tables.TMP_RESTAURANT_BRANCHES);
			let result = await tmp_restaurant_branches.findOne({
				branch_id : new ObjectId(branchId),
				restaurant_slug	: slug
			},{projection: {
				branch_id:1,name:1,address:1,branch_number:1,admin_id:1,submit_for_approval:1,city_id:1,area_id:1,street:1,block:1,build_no:1,description:1,longitude:1,latitude:1,status:1,rejection_reason:1,kfg_offer_id:1,kfg_offer_name:1,delivery_vehicle_type:1,auto_assignment_start_after:1
			}});

			/** Send error response */
			if(!result) return { status : Constants.STATUS_ERROR , message : res.__("system.invalid_access")};

			/** Send success response **/
			return {
				status	: Constants.STATUS_SUCCESS,
				result	: result
			};
		}catch(err){
			next(err);
		}
	}// End getPendingBranchDetails()

	/**
	 * Function for update branch details
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async updateBranch (req,res,next){
		try{
			let slug  = req?.params?.slug || "";

			/** Sanitize Data **/
			req.body 		= 	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let branchId	= 	req?.params?.id || "";
			let authUserId 	= 	req?.session?.user?._id || "";
			let deliveryVehicleType		=	req?.body?.delivery_vehicle_type || "";
			let autoAssignmentStartAfter=	req?.body?.auto_assignment_start_after || "";
			let latitude	=	req?.body?.latitude || "";
			let longitude	=	req?.body?.longitude || "";
			let kfgOfferId	=	req?.body?.kfg_offer_id ||  "";
			let kfgOfferName=	req?.body?.kfg_offer_name ||  "";

			/** Get restaurant id **/
            let restaurantId = await getRestaurantId(req,res,next,{slug:slug});

			/** Set update data */
			let updateData = {
				name : {
					en 	: req?.body?.name_in_english || "",
					ar 	: req?.body?.name_in_arabic || "",
				},
				city_id		: 	new ObjectId(req?.body?.city_id),
				area_id		: 	new ObjectId(req?.body?.area_id),
				block		: 	req?.body?.block ? new ObjectId(req?.body?.block) : "",
				street		: 	req?.body?.street || "",
				build_no	: 	req?.body?.build_no || "",
				description	: 	req?.body?.description || "",
				address		: 	req?.body?.address || "",
				user_id		: 	new ObjectId(authUserId),
				modified 	:	getUtcDate(),
				longitude	:   parseFloat(longitude),
				latitude	:   parseFloat(latitude),
				long_lat	:   [parseFloat(longitude),parseFloat(latitude)],
				kfg_offer_id: kfgOfferId,
				kfg_offer_name: kfgOfferName,
				delivery_vehicle_type : (deliveryVehicleType) ? deliveryVehicleType : [],
				auto_assignment_start_after:  (autoAssignmentStartAfter) ? parseFloat(autoAssignmentStartAfter) :"",
			};

			/** save details */
			const tmp_restaurant_branches = this.db.collection(Tables.TMP_RESTAURANT_BRANCHES);
			await tmp_restaurant_branches.updateOne({branch_id : new ObjectId(branchId) },{$set : updateData,},{upsert: true});

			/* success response*/
			let message = res.__("pending_branches.branch_has_been_updated_successfully");
			res.send({
				status		:	Constants.STATUS_SUCCESS,
				message		:	message,
			});

			/** Save admin user activities **/
			saveUserActivity(req,res,{
				user_id 			: authUserId,
				parent_type 		: Tables.RESTAURANT_BRANCHES,
				parent_id 			: branchId,
				activity_type		: Constants.ACTIVITY_ADD_EDIT_DETAILS,
				additional_details	: {restaurant_id : restaurantId,channel_id	: req?.session?.user?.channel_id || ""},
			});
		}catch(err){
			return next(err);
		}
	}//End updateBranch()

	/**
	 * Function for view pending branch detail
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async viewPendingBranchDetail (req,res,next){
		try{
			let slug 		= req?.params?.slug || "";
			let branchId 	= req?.params?.id || "";

			asyncParallel({
				restaurant_details : (callback)=>{
					getRestaurantDetails(req, res, next, {slug: slug}).then(response=>{
						if(response.status != Constants.STATUS_SUCCESS) return callback(Constants.STATUS_ERROR,response);
						callback(null,response.result);
					}).catch(next);
				},
				branch_details :(callback)=>{
					/** Get Branch details **/
					const tmp_restaurant_branches = this.db.collection(Tables.TMP_RESTAURANT_BRANCHES);
					tmp_restaurant_branches.findOne({
						branch_id 		:	new ObjectId(branchId),
						restaurant_slug	: 	slug
					},{projection: {
						branch_id:1,branch_number:1,name:1,for_reapproval:1,status:1,rejection_reason:1,admin_id: 1,submit_for_approval: 1,delivery_vehicle_type:1,auto_assignment_start_after:1
					}}).then(result=>{
						callback(null,result);
					}).catch(next);
				},
				all_form_countings :(callback)=>{
					this.checkAllFormFilled(req,res,next).then(formCoutings=>{
						callback(null,formCoutings.coutings);
					}).catch(next);
				},
			},(err,asyncResponse)=>{
				if(err) return next(err);

				if(!asyncResponse?.branch_details) {
					return res.status(400).send({
						status: Constants.STATUS_ERROR,
						message: res.__("system.something_going_wrong_please_try_again")
					});
				}

				/** Render view page  **/
				res.render('view',{
					layout				: false,
					slug				: slug,
					branch_details		: asyncResponse?.branch_details || {},
					restaurant_details	: asyncResponse?.restaurant_details || {},
					coutings			: asyncResponse?.all_form_countings || {}
				});
			});
		}catch(err){
			next(err);
		}
	}//End viewPendingBranchDetail()

	/**
	 * Function for view branch detail form
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async pendingBranchDetailForm (req,res,next){
		try{
			let slug = req?.params?.slug || "";

			/** Get Branch details **/
			let response  =	await this.getPendingBranchDetails(req, res, next);

			/** Send error response **/
			if(response.status != Constants.STATUS_SUCCESS) return res.status(400).send(response);

			/** Get city list **/
			let cityId 	 = response?.result?.city_id || "";
			let cityList = await getCityList(req,res,next,{city_id: cityId});

			/** Render add-edit page  **/
			res.render('branch_detail',{
				layout		: false,
				result		: response?.result || {},
				city_list	: cityList,
				restaurant_slug	: slug,
			});
		}catch(err){
			next(err);
		}
	}//End pendingBranchDetailForm()

	/**
	 * Function is used to send branch for approval to cravez
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async sendForApproval (req,res,next){
		try{
			let branchId = new ObjectId(req?.params?.id || "");
			let slug 	 = req?.params?.slug || "";

			/** Check all form filled */
			this.checkAllFormFilled(req,res,next).then(validationResponse=>{

				/** Send error response **/
				if(validationResponse.status != Constants.STATUS_SUCCESS) return res.send({
					status: Constants.STATUS_ERROR,
					message: validationResponse.message
				});

				const tmp_restaurant_branches = this.db.collection(Tables.TMP_RESTAURANT_BRANCHES);
				asyncParallel({
					restaurant_details : (callback)=>{
						/** Get restaurant details */
						const restaurants = this.db.collection(Tables.RESTAURANTS);
						restaurants.findOne({
							slug : slug
						},{projection:{_id:1,default_name:1}}).then(result=>{
							callback(null, result);
						}).catch(next);
					},
					brnach_details : (callback)=>{
						/** Get restaurant branch details */
						tmp_restaurant_branches.findOne({
							branch_id 		: branchId,
							restaurant_slug	: slug
						},{projection:{name:1,branch_number:1}}).then(result=>{
							callback(null, result);
						}).catch(next);
					}
				},(asyncErr,asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					if(!asyncResponse || !asyncResponse.restaurant_details || !asyncResponse.brnach_details){
						return res.send({
							status: Constants.STATUS_ERROR,
							message: res.__("system.something_going_wrong_please_try_again")
						});
					}

					/** save details in temp table */
					tmp_restaurant_branches.updateOne({
						branch_id 		: branchId,
						restaurant_slug	: slug
					},
					{
						$set : {
							status				: Constants.PENDING,
							submit_for_approval	: true
						},
						$unset :{
							rejection_reason : 1
						}
					},{upsert: true}).then(()=> {

						/** Send success response  **/
						req.flash(Constants.STATUS_SUCCESS,res.__("pending_branches.branch_has_been_submitted_for_approval_successfully"));
						res.send({
							status: Constants.STATUS_SUCCESS,
							message: res.__("pending_branches.branch_has_been_submitted_for_approval_successfully")
						});

						/*************** Send notification  ***************/
							let restaurantId 	=	asyncResponse?.restaurant_details?._id || "";
							let restaurantName 	=	asyncResponse?.restaurant_details?.default_name || "";
							let brnachNumber 	=	asyncResponse?.brnach_details?.branch_number || "";
							let brnachName 		= 	asyncResponse?.brnach_details?.name?.[Constants.DEFAULT_LANGUAGE_CODE] || "";

							let notificationMessageParams = [brnachName,brnachNumber,restaurantName];
							insertNotifications(req,res,{
								notification_data : {
									notification_type 	: 	Constants.NOTIFICATION_BRANCH_APPROVAL_REQUEST,
									message_params 		: 	notificationMessageParams,
									parent_table_id 	: 	branchId,
									role_id 			:	[Constants.CRAVEZ,Constants.CONTENT_TEAM],
									only_for_user_role	:	true,
									extra_parameters 	:	{
										branch_id 		: branchId,
										restaurant_slug	: slug,
										channel_id		: req?.session?.user?.channel_id || ""
									}
								}
							}).then(()=>{});
						/*************** Send notification  ***************/

						/** Save admin user activities **/
						let authId = req?.session?.user?._id || "";
						saveUserActivity(req,res,{
							user_id 			: authId,
							parent_type 		: Tables.RESTAURANT_BRANCHES,
							parent_id 			: branchId,
							activity_type		: Constants.ACTIVITY_SEND_RESTAURANT_BRANCH_FOR_APPROVAL,
							additional_details	: {restaurant_id : restaurantId,channel_id	: req?.session?.user?.channel_id || ""},
						}).then(()=>{});

						/**Save logs */
						let authRoleId	= req?.session?.user?.user_role_id || "";
						saveRestaurantBranchLogs(req,res,next,{
							user_id 		: authId,
							user_role 		: authRoleId,
							branch_id 		: branchId,
							restaurant_id 	: restaurantId,
							action			: Constants.PENDING,
							channel_id		: req?.session?.user?.channel_id
						}).then(()=>{});
					}).catch(next);
				});
			}).catch(next);
		}catch(err){
			next(err);
		}
	}//End sendForApproval()

	/**
	 * Function is used to check all form  filled or not
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async checkAllFormFilled (req,res,next,options){
		return new Promise(async resolve=>{
			try{
				let slug 		= req?.params?.slug || "";
				let branchId 	= req?.params?.id || "";

				/** Get Branch details **/
				const tmp_restaurant_branches = this.db.collection(Tables.TMP_RESTAURANT_BRANCHES);
				let restaurantBranchDetails = await tmp_restaurant_branches.findOne({
					branch_id 		: new ObjectId(branchId),
					restaurant_slug	: slug
				},{projection: {
					for_reapproval: 1
				}})

				/** Send error response **/
				if(!restaurantBranchDetails) return resolve({
					status	 : Constants.STATUS_ERROR,
					coutings : {},
					message	 : res.__("pending_branches.please_fill_all_the_forms_before_submiting_it")
				});

				asyncParallel({
					payment_method_count : (callback)=>{
						/** Check payment method count */
						const tmp_restaurant_branch_payment_methods = this.db.collection(Tables.TMP_RESTAURANT_BRANCH_PAYMENT_METHODS);
						tmp_restaurant_branch_payment_methods.countDocuments({branch_id: new ObjectId(branchId) }).then(countResult=>{
							callback(null,countResult);
						}).catch(next);
					},
					phone_number_count : (callback)=>{
						/** Check phone number count */
						const tmp_restaurant_branch_phone_numbers = this.db.collection(Tables.TMP_RESTAURANT_BRANCH_PHONE_NUMBERS);
						tmp_restaurant_branch_phone_numbers.countDocuments({branch_id: new ObjectId(branchId) }).then(countResult=>{
							callback(null,countResult);
						}).catch(next);
					},
					attributes_count : (callback)=>{
						/** Check branch attributes count */
						const tmp_restaurant_branch_attributes = this.db.collection(Tables.TMP_RESTAURANT_BRANCH_ATTRIBUTES);
						tmp_restaurant_branch_attributes.countDocuments({branch_id: new ObjectId(branchId) }).then(countResult=>{
							callback(null,countResult);
						}).catch(next);
					},
					calendars_count : (callback)=>{
						/** Check branch attributes count */
						const tmp_restaurant_branch_calendars = this.db.collection(Tables.TMP_RESTAURANT_BRANCH_CALENDARS);
						tmp_restaurant_branch_calendars.countDocuments({branch_id: new ObjectId(branchId) }).then(countResult=>{
							callback(null,countResult);
						}).catch(next);
					},
					areas_count : (callback)=>{
						/** Check branch areas count */
						const tmp_restaurant_branch_areas = this.db.collection(Tables.TMP_RESTAURANT_BRANCH_AREAS);
						tmp_restaurant_branch_areas.countDocuments({branch_id: new ObjectId(branchId) }).then(countResult=>{
							callback(null,countResult);
						}).catch(next);
					},
				},(asyncParallelErr,asyncRes)=>{
					if(asyncParallelErr) return next(asyncParallelErr);

					let response = {
						status	 : Constants.STATUS_SUCCESS,
						coutings : asyncRes
					};

					/** Send success response **/
					if(restaurantBranchDetails?.for_reapproval) return resolve(response);

					/** Check all form filled */
					let formName = [];
					if(asyncRes.areas_count == 0) formName.push("covered areas");
					if(asyncRes.attributes_count == 0) formName.push("branch attributes");
					if(asyncRes.phone_number_count == 0) formName.push("phones");
					if(asyncRes.payment_method_count == 0) formName.push("payment methods");
					if(asyncRes.calendars_count == 0) formName.push("calendar");
					let joinNames = formName.join(", ");
					if(formName.length > 0) return resolve({status : Constants.STATUS_ERROR, coutings : asyncRes,message : res.__("pending_branches.please_fill_the_forms_before_submitting_it",joinNames)});

					/** Send success response **/
					return resolve(response);
				});
			}catch(err){
				next(err);
			}
		}).catch(next);
	}// end checkAllFormFilled()

	/**
	 * Function to approve pending approval request of restaurant branches
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async approveBranchPendingRequest (req,res,next,options){
		return new Promise(async resolve=>{
			try{
				let branchId = new ObjectId(req.params.id);

				/** Get branch details */
				const tmp_restaurant_branches	= this.db.collection(Tables.TMP_RESTAURANT_BRANCHES);
				let brancheResult = await tmp_restaurant_branches.aggregate([
					{$match :  {branch_id : new ObjectId(branchId) }},
					{$lookup:	{
						"from" 			: 	Tables.RESTAURANTS,
						"localField" 	:	"restaurant_id",
						"foreignField" 	: 	"_id",
						"as" 			: 	"restaurant_detail"
					}},
					{$project :	{
						_id:1,user_id:1,restaurant_id:1, restaurant_slug:1, branch_number:1,rejection_reason:1,name:1,restaurant_name: {$arrayElemAt: ["$restaurant_detail.default_name",0]}, area_id:1
					}}
				]).toArray();

				/** Send error response **/
				if(!brancheResult || brancheResult.length <=0) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again")});

				let branchDetails 	= brancheResult[0] || {};
				let brAreaId 	 	= branchDetails?.area_id || "";
				let slug     	 	= branchDetails?.restaurant_slug || "";
				let restaurantId 	= branchDetails?.restaurant_id || "";
				asyncParallel({
					branch_updates : (parentCallback)=>{
						/** Copy data  tmp_restaurant_branches to  restaurant_branches collections*/
						copyFromParentTable(req,res,next,{
							parent_table : {
								name 			:	Tables.TMP_RESTAURANT_BRANCHES,
								fields 			: 	{branch_id: 0,_id: 0,admin_id: 0, submit_for_approval:0, for_reapproval:0,user_id: 0,status:0},
								conditions 		: 	{branch_id: branchId, restaurant_slug: slug},
								remove_original : 	true
							},
							child_table : {
								name 		: 	Tables.RESTAURANT_BRANCHES,
								conditions	:	{_id : branchId},
							}
						}).then(response=>{
							if(response.status != Constants.STATUS_SUCCESS) return  parentCallback(response);
							parentCallback(null);
						}).catch(next);
					},
					branch_payment_method_updates : (parentCallback)=>{
						/** Copy data  tmp_restaurant_branch_payment_methods to  restaurant_branch_payment_methods collections*/
						copyFromParentTable(req,res,next,{
							type : "approve_branch_payment_methods",
							parent_table : {
								name 			:	Tables.TMP_RESTAURANT_BRANCH_PAYMENT_METHODS,
								fields 			: 	{_id: 0},
								conditions 		: 	{branch_id: branchId},
								remove_original : 	true
							},
							child_table : {
								name 		: 	Tables.RESTAURANT_BRANCH_PAYMENT_METHODS,
								conditions	:	{_id : branchId},
							}
						}).then(response=>{
							if(response.status != Constants.STATUS_SUCCESS) return  parentCallback(response);
							parentCallback(null);
						}).catch(next);
					},
					phone_number_updates : (parentCallback)=>{
						/** Copy data  tmp_restaurant_branch_phone_numbers to  restaurant_branch_phone_numbers collections*/
						copyFromParentTable(req,res,next,{
							type : "update_branch_phone_numbers",
							parent_table : {
								name 			:	Tables.TMP_RESTAURANT_BRANCH_PHONE_NUMBERS,
								fields 			: 	{},
								conditions 		: 	{branch_id: branchId},
								remove_original : 	true
							},
							child_table : {
								name 		: 	Tables.RESTAURANT_BRANCH_PHONE_NUMBERS,
								conditions	:	{branch_id: branchId},
							}
						}).then(response=>{
							if(response.status != Constants.STATUS_SUCCESS) return  parentCallback(response);
							parentCallback(null);
						}).catch(next);
					},
					branch_attributes_update : (parentCallback)=>{
						/** Copy data tmp_restaurant_branch_attributes to restaurant_branch_attributes collections*/
						copyFromParentTable(req,res,next,{
							type : "update_branch_attributes",
							parent_table : {
								name 			:	Tables.TMP_RESTAURANT_BRANCH_ATTRIBUTES,
								fields 			: 	{_id: 0},
								conditions 		: 	{branch_id: branchId},
								remove_original : 	true
							},
							child_table : {
								name 		: 	Tables.RESTAURANT_BRANCH_ATTRIBUTES,
								conditions	:	{branch_id: branchId},
							}
						}).then(response=>{
							if(response.status != Constants.STATUS_SUCCESS) return  parentCallback(response);
							parentCallback(null);
						}).catch(next);
					},
					branch_calendars_update : (parentCallback)=>{
						/** Copy data tmp_restaurant_branch_calendars to restaurant_branch_calendars collections*/
						copyFromParentTable(req,res,next,{
							type : "update_branch_calendar",
							parent_table : {
								name 			:	Tables.TMP_RESTAURANT_BRANCH_CALENDARS,
								fields 			: 	{},
								conditions 		: 	{branch_id: branchId},
								remove_original : 	true
							},
							child_table : {
								name 		: 	Tables.RESTAURANT_BRANCH_CALENDARS,
								conditions	:	{branch_id: branchId},
							}
						}).then(response=>{
							if(response.status != Constants.STATUS_SUCCESS) return  parentCallback(response);

							/** Save branch open details **/
							this.cronModel.saveOpenBranchList(req,res,next,{branch_id: branchId});
							parentCallback(null);
						}).catch(next);
					},
					branch_areas_update : (parentCallback)=>{
						/** Copy data tmp_restaurant_branch_areas to restaurant_branch_areas collections*/
						copyFromParentTable(req,res,next,{
							type : "update_branch_areas",
							parent_table : {
								name 			:	Tables.TMP_RESTAURANT_BRANCH_AREAS,
								fields 			: 	{_id: 0},
								conditions 		: 	{branch_id: branchId},
								remove_original : 	true
							},
							child_table : {
								name 		: 	Tables.RESTAURANT_BRANCH_AREAS,
								conditions	:	{branch_id: branchId},
							}
						}).then(response=>{
							if(response.status != Constants.STATUS_SUCCESS) return  parentCallback(response);
							parentCallback(null);
						}).catch(next);
					},
					branch_area_settings_update : (parentCallback)=>{
						/** Copy data tmp_restaurant_branch_area_settings to restaurant_branch_area_settings collections*/
						copyFromParentTable(req,res,next,{
							type : "update_restaurant_branch_area_settings",
							parent_table : {
								name 			:	Tables.TMP_RESTAURANT_BRANCH_AREA_SETTINGS,
								fields 			: 	{_id: 0},
								conditions 		: 	{branch_id: branchId},
								remove_original : 	true
							},
							child_table : {
								name 		: 	Tables.RESTAURANT_BRANCH_AREA_SETTINGS,
								conditions	:	{branch_id: branchId},
							}
						}).then(response=>{
							if(response.status != Constants.STATUS_SUCCESS) return  parentCallback(response);
							parentCallback(null);
						}).catch(next);
					}
				},async(asyncErr)=>{
					if(asyncErr) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again")});

					/** Send success response **/
					resolve({
						status	:Constants.STATUS_SUCCESS,
						message	:options?.publish ? res.__("pending_branches.branch_published_successfully") :res.__("pending_branches.branch_approved_successfully")
					});

					if(!options?.publish){
						/*************** Send Mail  ***************/
						sendMailToUsers(req,res,{
							event_type 		:	Constants.BRANCH_ENQUIRY_APPROVE_EMAIL_EVENTS,
							branch_id		:	branchId,
							restaurant_id	: 	restaurantId,
							user_id			: 	branchDetails?.user_id || "",
							branch_number	: 	branchDetails?.branch_number || "",
							restaurant_name	: 	branchDetails?.restaurant_name || "",
							branch_name		: 	branchDetails?.name?.[Constants.DEFAULT_LANGUAGE_CODE] || "",
						});
						/*************** Send Mail  ***************/
					}

					/** Save  user activities **/
					let authId			= req?.session?.user?._id || "";
					let authRoleId		= req?.session?.user?.user_role_id || "";
					saveUserActivity(req,res,{
						user_id 			: authId,
						parent_type 		: Tables.RESTAURANT_BRANCHES,
						parent_id 			: branchId,
						activity_type		: Constants.ACTIVITY_UPDATE_STATUS,
						additional_details	: {
							status			: Constants.APPROVED,
							restaurant_id 	: restaurantId,
							channel_id		: req?.session?.user?.channel_id || ""
						}
					}).then(()=>{});

					/**Save Logs */
					saveRestaurantBranchLogs(req,res,next,{
						user_id 		: authId,
						user_role 		: authRoleId,
						branch_id 		: branchId,
						restaurant_id 	: restaurantId,
						action			: Constants.APPROVED,
						channel_id		: req?.session?.user?.channel_id || ""
					});

					/** Update main restaurant branch details */
					const restaurant_branches	= this.db.collection(Tables.RESTAURANT_BRANCHES);
					restaurant_branches.updateOne({_id : new ObjectId(branchId) },{$unset :{status: 1}}).then(()=>{});

					/** Update area id in orders */
					const orders =	this.db.collection(Tables.ORDERS);
					orders.updateMany({branch_id: new ObjectId(branchId)},{$set : {branch_area_id: brAreaId }}).then(()=>{});
				});
			}catch(err){
				next(err);
			}
		}).catch(next);
	};//End approveBranchPendingRequest()

	/**
	 * Function is used to publish branch, when branch is created by admin
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async publishBranch (req,res,next){
		try{
			let branchId= req?.params?.id || "";
			let slug  	= req?.params?.slug || "";

			this.checkAllFormFilled(req,res,next).then(validationResponse=>{

				if(validationResponse.status != Constants.STATUS_SUCCESS){
					/** Send error response */
					req.flash(Constants.STATUS_ERROR,validationResponse.message);
					return res.redirect(Constants.WEBSITE_ADMIN_URL+"restaurants/"+slug+"/pending_branches");
				}

				/** Approve branch  */
				this.approveBranchPendingRequest(req,res,next,{publish:true}).then(response=>{
					/** Send response */
					req.flash(response.status,response.message);
					res.redirect(Constants.WEBSITE_ADMIN_URL+"restaurants/"+slug+"/branches/"+branchId);
				}).catch(next);
			}).catch(next);
		}catch(err){
			return next(err);
		}
	};//End publishBranch()

	/**
	 * Function to reject restaurant pending branch enquiry request
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	*/
	async rejectBranchRequest (req,res,next){
		return new Promise(async resolve=>{
			try{
				/** Sanitize Data **/
				req.body	  		= sanitizeData(req.body,NOT_ALLOWED_TAGS_XSS);
				let branchId 		= req?.body?.branch_id || "";
				let authId 	  		= req?.session?.user?._id || "";
				let rejectionReason = req?.body?.rejection_reason || "";

				/** send error response */
				if(!branchId) return resolve({ status: Constants.STATUS_ERROR,message: res.__("system.invalid_access")});

				if(!rejectionReason){
					return res.send({
						status: Constants.STATUS_ERROR,
						message: [{param: "rejection_reason", msg: res.__("pending_branches.please_enter_rejection_condition")}]
					});
				}else if(rejectionReason.length > Constants.REJECTION_MESSAGE_TEXT_LENGTH){
					return res.send({
						status: Constants.STATUS_ERROR,
						message: [{param: "rejection_reason", msg: res.__("pending_branches.message_max_length",Constants.REJECTION_MESSAGE_TEXT_LENGTH)}]
					});
				}

				/** Get Branch details **/
				const tmp_restaurant_branches = this.db.collection(Tables.TMP_RESTAURANT_BRANCHES);
				let branchDetails = await tmp_restaurant_branches.findOne({
					branch_id : new ObjectId(branchId)},
					{projection: {_id:1,status: 1,branch_id:1,restaurant_id:1}
				});

				if(!branchDetails){
					return res.send({status: Constants.STATUS_ERROR,message: res.__("system.something_going_wrong_please_try_again")});
				}

				/* set rejected status in restaurant branches branch */
				await tmp_restaurant_branches.updateOne({
					branch_id : new ObjectId(branchId)
				},
				{$set : {
					status 				: Constants.REJECTED,
					rejection_reason   	: rejectionReason,
					submit_for_approval	: false
				}});

				/**For send response */
				resolve({
					status 		 : Constants.STATUS_SUCCESS,
					redirect_url : Constants.WEBSITE_ADMIN_URL+"restaurant_pending_branches",
					message 	 : res.__("pending_branches.restaurant_enquiry_has_been_rejected"),
				});

				/*************** Send Mail  ***************/
				sendMailToUsers(req,res,{
					event_type 	: Constants.BRANCH_ENQUIRY_REJECT_EMAIL_EVENTS,
					branch_id	: branchId
				});
				/*************** Send Mail  ***************/

				/** Save admin user activities **/
				let restaurantId = branchDetails?.restaurant_id || "";
				let authRoleId	 = req?.session?.user?.user_role_id || "";
				saveUserActivity(req,res,{
					user_id 		:	authId,
					parent_type 	:	Tables.RESTAURANT_BRANCHES,
					parent_id 		: 	branchId,
					activity_type	:	Constants.ACTIVITY_UPDATE_STATUS,
					additional_details:	{
						status: Constants.REJECTED,
						restaurant_id : new ObjectId(restaurantId),
						channel_id	: req?.session?.user?.channel_id || ""
					}
				});

				/**Save logs */
				saveRestaurantBranchLogs(req,res,next,{
					user_id 		: authId,
					user_role 		: authRoleId,
					branch_id 		: branchId,
					restaurant_id 	: restaurantId,
					action			: Constants.REJECTED,
					channel_id		: req?.session?.user?.channel_id || ""
				}).then(()=>{});

				/** Update main restaurant branch details */
				const restaurant_branches	= this.db.collection(Tables.RESTAURANT_BRANCHES);
				restaurant_branches.updateOne({_id : new ObjectId(branchId) },{$unset :{status: 1}}).then(()=>{});
			}catch(err){
				next(err);
			}
		}).catch(next);
	};//End rejectBranchRequest()

	/**
	 * Function to mark restaurant pending branch as in-review
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async markBranchInReview (req,res,next){
		return new Promise(async resolve=>{
			try{
				let branchId	= req?.params?.id || "";
				let authId		= req?.session?.user?._id || "";

				/** Get branch details */
				const tmp_restaurant_branches	= this.db.collection(Tables.TMP_RESTAURANT_BRANCHES);
				let result = await tmp_restaurant_branches.findOne({
					branch_id 	: new ObjectId(branchId),
					status 		: Constants.PENDING
				},{projection: {_id:1, status: 1,branch_id:1,restaurant_id:1}})

				/** Send error response when branch not found **/
				if(!result) return resolve({status:Constants.STATUS_ERROR,message:res.__("system.invalid_access") });

					/** Update restaurant branch details */
				await tmp_restaurant_branches.updateOne({
					branch_id : new ObjectId(branchId)
				},{$set :{
					status 		: Constants.IN_REVIEW,
					review_date	: getUtcDate(),
					review_by	: new ObjectId(authId),
					modified  	: getUtcDate()
				}});

				/** Send success response **/
				resolve({status: Constants.STATUS_SUCCESS, message: res.__("admin.restaurant_pending_branches.status_has_been_updated_successfully") });

				/** Save admin user activities **/
				let restaurantId = result?.restaurant_id || "";
				saveUserActivity(req,res,{
					user_id 		:	authId,
					parent_type 	:	Tables.RESTAURANT_BRANCHES,
					parent_id 		: 	branchId,
					activity_type	:	Constants.ACTIVITY_UPDATE_STATUS,
					additional_details:	{
						status: Constants.IN_REVIEW,
						restaurant_id : new ObjectId(restaurantId),
						channel_id: req?.session?.user?.channel_id || ""
					}
				}).then(()=>{});

				/**Save logs */
				let authRoleId	= req?.session?.user?.user_role_id || "";
				saveRestaurantBranchLogs(req,res,next,{
					user_id 		: authId,
					user_role 		: authRoleId,
					branch_id 		: branchId,
					restaurant_id 	: restaurantId,
					action			: Constants.IN_REVIEW,
					channel_id		: req?.session?.user?.channel_id || ""
				}).then(()=>{});

				/** Update main restaurant branch details */
				const restaurant_branches	= this.db.collection(Tables.RESTAURANT_BRANCHES);
				restaurant_branches.updateOne({_id: new ObjectId(branchId) },{$set: {status: Constants.IN_REVIEW}}).then(()=>{});
			}catch(err){
				next(err);
			}
		}).catch(next);
	};//End markBranchInReview()
}
