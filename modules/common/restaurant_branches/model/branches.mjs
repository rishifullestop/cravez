import { ObjectId } from 'mongodb';
import { parallel as asyncParallel } from 'async';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from "../../../../utils/index.mjs";
import { saveUserActivity} from "../../../../services/index.mjs";

export default class CommonBranches{
    constructor(db) {
        this.db = db;
    }

	/**
	 * Function to get branch list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getBranchList (req,res,next,options){
		let slug = (req.params && req.params.slug) ? req.params.slug : "";
		let cuisine  = (req.query && req.query.cuisine)	? req.query.cuisine	:"";

		if(Helpers.isPost(req)){
			let limit			= (req.body.length)	? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
			let skip			= (req.body.start)	? parseInt(req.body.start)  : Constants.DEFAULT_SKIP;
			const collection	= this.db.collection(Tables.RESTAURANT_BRANCHES);

			asyncParallel({
				branch_ids : (callback)=>{
					if(!cuisine) return callback(null,null);

					/** Get branch ids */
					const restaurant_branch_cuisines = this.db.collection(Tables.RESTAURANT_BRANCH_CUISINES);
					restaurant_branch_cuisines.distinct( "branch_id",{cuisine_id : new ObjectId(cuisine)}).then(branchIds=>{
						callback(null,branchIds || []);
					}).catch(next);
				}
			},async (asyncErr,asyncResponse)=>{
				let commonConditions= {
					restaurant_slug :slug
				};

				if(cuisine) commonConditions._id = {$in : asyncResponse.branch_ids};

				/** Configure Datatable conditions*/
				const dataTableConfig = await Helpers.configDatatable(req, res, null);

				/* assign in a single object */
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions,commonConditions);

				let dbRes = await collection.aggregate([
                    {$match: dataTableConfig.conditions },
                    {$facet : {
                        list : [
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit },
                            {$project: {
                                _id:1,name:1,address:1, branch_number:1, branch_status:1, is_active: 1,is_featured:1, restaurant_id:1,delivery_vehicle_type:1,auto_assignment_start_after:1
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
					data			:   dbRes?.[0]?.list || [],
					recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
					recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
				});
			});
		}else{
			res.render('list',{
				layout: false,
				slug: slug,
				cuisine : cuisine
			});
		}
	};//End getBranchList()

	/**
	 * Function to get Branch detail
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	async getBranchDetails(req,res,next){
		try{
			let branchId 	= (req.params.id)   ? req.params.id		: "";
			let slug		= (req.params.slug)	? req.params.slug	: "";

			/** Get Branch details **/
			const restaurant_branches = this.db.collection(Tables.RESTAURANT_BRANCHES);
			let result = await restaurant_branches.findOne({
				_id     		: new ObjectId(branchId),
				restaurant_slug	: slug
			},
			{projection: {
				_id:1,name:1,address:1,branch_number:1,city_id:1,area_id:1,street:1,block:1,build_no:1,description:1,longitude:1,latitude:1,status:1,kfg_offer_id:1,kfg_offer_name:1,delivery_vehicle_type:1,auto_assignment_start_after:1
			}});

			/** Send error response */
			if(!result) return { status : Constants.STATUS_ERROR , message : res.__("system.invalid_access")};

			/** Send success response **/
			return {
				status	: Constants.STATUS_SUCCESS,
				result
			};
		}catch(err){ return next(err); }
	};// End getBranchDetails()

	/**
	 * Function for add or update branch details
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async addEditBranch (req,res,next){
		let slug  	= (req.params.slug) ? req.params.slug	: "";
		let userId 	= (req.session && req.session.user._id) ? req.session.user._id : "";
		if(Helpers.isPost(req)){
			/** Sanitize Data **/
			let isEditable	= 	(req.params.id)	? true 	: false;
			req.body 		= 	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let branchId	= 	(req.params.id)			? 	new ObjectId(req.params.id) : new ObjectId();
			let branchNumber=	(req.body.branch_number)?	req.body.branch_number	:"";
			let latitude	=	(req.body.latitude) ? req.body.latitude : '';
			let longitude	=	(req.body.longitude) ? req.body.longitude : '';
			let kfgOfferId		=	(req.body.kfg_offer_id) ? 	req.body.kfg_offer_id : "";
			let kfgOfferName	=	(req.body.kfg_offer_name) ? 	req.body.kfg_offer_name : "";
			let deliveryVehicleType		=	(req.body.delivery_vehicle_type) 	  	?	req.body.delivery_vehicle_type			:"";
			let autoAssignmentStartAfter=	(req.body.auto_assignment_start_after) 	?	req.body.auto_assignment_start_after	:"";
			let nameEng	= (req.body.name_in_english) ? req.body.name_in_english : "";
			let nameArb	= (req.body.name_in_arabic)	 ? req.body.name_in_arabic	: "";

			asyncParallel({
				unique_branch_id : (callback)=>{
					if(branchNumber) return callback(null,branchNumber);
					if(isEditable) 	 return callback(null,null);

					/** Get branch unique id **/
					Helpers.getUniqueId(req,res,next,{type:Tables.RESTAURANT_BRANCHES}).then(response=>{
						if(response.status !== Constants.STATUS_SUCCESS) return callback(response.message,null);
						callback(null,response.result);
					}).catch(next);
				},
				restaurant_id : (callback)=>{
					/** Get restaurant id **/
					Helpers.getRestaurantId(req,res,next,{slug:slug}).then(restaurantId=>{
						callback(null,restaurantId);
					}).catch(next);
				}
			},(asyncErr,asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				let restaurantId = asyncResponse?.restaurant_id || "";
				let updateData = {
					name : {
						en 	: nameEng,
						ar 	: nameArb,
					},
					city_id		: 	new ObjectId(req.body.city_id),
					area_id		: 	new ObjectId(req.body.area_id),
					block		: 	(req.body.block) 		? 	new ObjectId(req.body.block):"",
					street		: 	(req.body.street) 		?	req.body.street 		:"",
					build_no	: 	(req.body.build_no) 	? 	req.body.build_no 		:"",
					description	: 	(req.body.description) 	? 	req.body.description	:"",
					address		: 	req.body.address,
					status		: 	Constants.PENDING,
					is_active	: 	Constants.ACTIVE,
					modified 	:	Helpers.getUtcDate(),
					longitude	:   parseFloat(longitude),
					latitude	:   parseFloat(latitude),
					long_lat	:   [parseFloat(longitude),parseFloat(latitude)],
					kfg_offer_id: kfgOfferId,
					kfg_offer_name: kfgOfferName,
					delivery_vehicle_type : deliveryVehicleType || [],
					auto_assignment_start_after	:   (autoAssignmentStartAfter) ? parseFloat(autoAssignmentStartAfter) : "",
				};

				let collection = this.db.collection(Tables.TMP_RESTAURANT_BRANCHES);
				let updateConditions = {
					branch_id : branchId
				};

				/** For admin only */
				if(Helpers.isAdmin(req,res)){

					/** In case of adding new branch */
					if(!isEditable){
						updateData.admin_id 			= new ObjectId(userId);
						updateData.submit_for_approval 	= false;
						updateData.status 				= Constants.PENDING;
					}else{
						collection = this.db.collection(Tables.RESTAURANT_BRANCHES);
						updateConditions = {
							_id : branchId
						};
					}
				}else{
					/** For Restaurant only */
					updateData["submit_for_approval"] 	= 	false;
					updateData["status"] 				= 	Constants.PENDING;
					updateData["user_id"] 				=	new ObjectId(userId);
					if(isEditable) updateData["for_reapproval"] = true;
				}

				/** save/update details */
				collection.updateOne(updateConditions,{
					$set : updateData,
					$setOnInsert: {
						created 		:	Helpers.getUtcDate(),
						branch_status	: 	Constants.OPEN,
						restaurant_id	: 	restaurantId,
						restaurant_slug	: 	slug,
						added_by		: 	new ObjectId(userId),
						channel_id		:	req.session.user.channel_id,
						branch_number	: 	(asyncResponse.unique_branch_id) ? asyncResponse.unique_branch_id : "",
					}
				},{upsert: true}).then(()=> {

					/**success response  message**/
					let message = (isEditable) ? res.__("branch.branch_has_been_updated_successfully") :res.__("branch.branch_has_been_added_successfully");

					if(!Helpers.isAdmin(req,res) && isEditable){
						message = res.__("branch.branch_update_message_for_restaurant");
					}

					if(!isEditable){
						/* Set flash message */
						req.flash(Constants.STATUS_SUCCESS,message);
					}

					/** Send success response */
					res.send({
						status		:	Constants.STATUS_SUCCESS,
						branch_id	: 	branchId,
						message		:	message,
					});

					/** Save user activities **/
					saveUserActivity(req,res,{
						user_id 		:	userId,
						parent_type 	:	Tables.RESTAURANT_BRANCHES,
						parent_id 		: 	branchId,
						activity_type	:	Constants.ACTIVITY_ADD_EDIT_DETAILS,
						additional_details:	{restaurant_id: new ObjectId(restaurantId), is_editable : isEditable,channel_id	: req.session.user.channel_id},
					});

					if(!isEditable){
						/** Save logs */
						let authRoleId	= (req.session.user && req.session.user.user_role_id) ? req.session.user.user_role_id :"";
						Helpers.saveRestaurantBranchLogs(req,res,next,{
							user_id 		: userId,
							user_role 		: authRoleId,
							branch_id 		: branchId,
							restaurant_id 	: restaurantId,
							action			: Constants.PENDING,
							channel_id		: req.session.user.channel_id
						});
					}
				}).catch(next);
			});
		}else{
			/** Get city list **/
			let cityList = await Helpers.getCityList(req,res,next,null);

			/** Render add-edit page  **/
			res.render('add',{
				layout 		: 	false,
				city_list 	:	cityList,
				restaurant_slug: slug,
			});
		}
	};//End addEditBranch()

	/**
	 * Function for get area list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async getAreaList (req,res,next){
		let cityId	= (req.body.city_id) ? req.body.city_id :"";

		/** Send error response */
		if(!cityId) return res.send({ status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });

		/** Get area list */
		let response = await Helpers.getAreaList(req,res,next,req.body);

		/** Send response  */
		res.send({
			status : (response.status != Constants.STATUS_ERROR) ? Constants.STATUS_SUCCESS :Constants.STATUS_ERROR,
			result : response,
		});
	};//End getAreaList()

	/**
	 * Function for get block list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async getBlockList (req,res,next){
		let areaId	= (req.body.area_id) ? req.body.area_id :"";

		/** Send error response */
		if(!areaId) return res.send({ status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });

		/** Get area list */
		let response = await Helpers.getBlockList(req,res,next,req.body);

		/** Send response  */
		res.send({
			status : (response.status != Constants.STATUS_ERROR) ? Constants.STATUS_SUCCESS :Constants.STATUS_ERROR,
			result : response,
		});
	};//End getBlockList()

	/**
	 * Function for view branch detail
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async viewBranchDetail(req,res,next){
		let slug 		= (req.params.slug) ? req.params.slug	:"";
		let branchId 	= (req.params.id)   ? req.params.id		: "";

		/** Get Branch details **/
		let branchResponse  = await this.getBranchDetails(req, res, next);

		/** Send error response **/
		if(branchResponse.status != Constants.STATUS_SUCCESS){
			return res.status(400).send({ status : Constants.STATUS_ERROR, message : res.__("system.invalid_access") });
		}

		asyncParallel({
			restaurant_details : (callback)=>{
				/** Get restaurant details **/
				Helpers.getRestaurantDetails(req, res, next, {slug: slug}).then(response=>{
					if(response.status != Constants.STATUS_SUCCESS) return callback(response);
					callback(null,response.result);
				}).catch(next);
			},
			tmp_branch_details :(callback)=>{
				/** Get temp Branch details **/
				const tmp_restaurant_branches = this.db.collection(Tables.TMP_RESTAURANT_BRANCHES);
				tmp_restaurant_branches.findOne({
					branch_id 		: new ObjectId(branchId),
					restaurant_slug	: slug
				},
				{projection: {
					_id:1,submit_for_approval:1
				}}).then(tmpBranchDetails=> {
					callback(null,tmpBranchDetails);
				}).catch(next);
			},
		},(err,asyncResponse)=>{
			if(err) return next(err);

			/** Render view page **/
			res.render('view',{
				layout				: false,
				slug				: slug,
				branch_details		: branchResponse.result || {},
				restaurant_details	: asyncResponse.restaurant_details,
				tmp_branch_details	: asyncResponse.tmp_branch_details,
			});
		});
	};//End viewBranchDetail()

	/**
	 * Function for view branch detail form
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async branchDetailForm (req,res,next){
		let slug  		= (req.params.slug) ? req.params.slug	: "";

		/** Get Branch details **/
		let response  =	await this.getBranchDetails(req, res, next);
		if(response.status != Constants.STATUS_SUCCESS){
			/** Send error response **/
			req.flash(Constants.STATUS_ERROR,response.message);
			return res.redirect(res.locals.list_url);
		}

		/** Get city list **/
		let cityId = (response.result && response.result.city_id) ?	response.result.city_id	:"";
		let cityList = await Helpers.getCityList(req,res,next,{city_id: cityId});

		/** Render add-edit page **/
		res.render('branch_detail',{
			layout		: false,
			result		: (response.result) ? response.result	:{},
			city_list	: cityList,
			slug		: slug,
		});
	};//End branchDetailForm()

	/**
	 * Function for update branch status
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return void
	 */
	async updateBranchStatus(req,res,next){
		let status	 	= 	(req.body.status)		?	req.body.status					:0;
		let branchIds	=	(req.body.branch_ids)	?	req.body.branch_ids.split(",")	:[];

		/** Send error response **/
		if(branchIds.length < 1 || !status) return res.send({ status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });

		/** Convert into object ids */
		branchIds = Helpers.arrayToObject(branchIds);

		/** Set update data */
		let updateData = {modified: Helpers.getUtcDate()};

		if(status == Constants.BRANCH_ACTIVE || status == Constants.BRANCH_DEACTIVE) updateData.is_active = (status == Constants.BRANCH_ACTIVE) 	?	Constants.ACTIVE 	:Constants.DEACTIVE;
		if(status == Constants.BRANCH_BUSY || status == Constants.BRANCH_OPEN)	 	 updateData.branch_status = (status == Constants.BRANCH_OPEN)	? 	Constants.OPEN 	:Constants.BUSY;
		if(status == Constants.BRANCH_FEATURED || status == Constants.BRANCH_UNFEATURED) updateData.is_featured = (status == Constants.BRANCH_FEATURED)	? 	Constants.FEATURED 	:Constants.UNFEATURED;

		/** Update branch status */
		let restaurant_branches = this.db.collection(Tables.RESTAURANT_BRANCHES);
		restaurant_branches.updateMany({ _id: {$in: branchIds} }, {$set: updateData}).then(()=> {

			/* success response*/
			res.send({
				status : Constants.STATUS_SUCCESS,
				message: res.__("branch.branch_status_has_been_updated_successfully"),
			});

			if(status == Constants.BRANCH_BUSY || status == Constants.BRANCH_OPEN){
				branchIds.map(bid=>{
					this.saveBranchBusyStatusLogs(req,res,next,{
						status 		: status,
						branch_id 	: bid
					}).then(resp=>{});
				});
			}

			/** Save user activities **/
			let additionalDetails = {channel_id	: req.session.user.channel_id};
			if(status == Constants.BRANCH_ACTIVE || status == Constants.BRANCH_DEACTIVE) additionalDetails.is_active = (status == Constants.BRANCH_ACTIVE)?	Constants.ACTIVE 	:Constants.DEACTIVE;
			if(status == Constants.BRANCH_BUSY || status == Constants.BRANCH_OPEN)	 	 additionalDetails.branch_status = (status == Constants.BRANCH_OPEN) ? 	Constants.OPEN 	:Constants.BUSY;
			if(status == Constants.BRANCH_FEATURED || status == Constants.BRANCH_UNFEATURED) additionalDetails.is_featured = (status == Constants.BRANCH_FEATURED) ? 	Constants.FEATURED 	:Constants.UNFEATURED;
			saveUserActivity(req,res,{
				user_id 		:	req.session.user._id,
				parent_type 	:	Tables.RESTAURANT_BRANCHES,
				parent_id 		: 	branchIds,
				activity_type	:	Constants.ACTIVITY_UPDATE_STATUS,
				additional_details: additionalDetails,
			}).then(()=>{ });
		}).catch(next);
	};//End updateBranchStatus()

	async saveBranchBusyStatusLogs (req,res,next,options){
		return new Promise(resolve=>{
			let branchId		= (options.branch_id)   ? new ObjectId(options.branch_id) : "";
			let branchStatus	= (options.status == Constants.BRANCH_BUSY)	? Constants.BRANCH_BUSY	: Constants.BRANCH_OPEN;

			let dataToBeUpdate =  {
				status		: 	parseInt(branchStatus),
				modified	:	Helpers.getUtcDate(),
			};

			if(branchStatus == Constants.BRANCH_BUSY){
				dataToBeUpdate.busy_status_time = Helpers.getUtcDate();
			}
			if(branchStatus == Constants.BRANCH_OPEN){
				dataToBeUpdate.available_time = Helpers.getUtcDate();
			}

			/** Get Branch details **/
			const restaurant_branches = this.db.collection(Tables.RESTAURANT_BRANCHES);
			restaurant_branches.findOne({_id : new ObjectId(branchId)},{projection:{restaurant_id : 1}}).then(result=> {

				let restaurantId = (result && result.restaurant_id) ? new ObjectId(result.restaurant_id) : "";

				const branch_busy_status_logs = this.db.collection(Tables.BRANCH_BUSY_STATUS_LOGS);
				branch_busy_status_logs.updateOne({
					branch_id 	: branchId,
					status		: Constants.BRANCH_BUSY
				},
				{
					$set :	dataToBeUpdate,
					$setOnInsert: {
						restaurant_id : restaurantId,
						created	: Helpers.getUtcDate(),
					}
				},{upsert : true}).then(()=> {

					/** Send success response **/
					resolve({
						status	: Constants.STATUS_SUCCESS
					});
				}).catch(next);
			}).catch(next);
		}).catch(next);
	};// End saveBranchBusyStatusLogs()
}