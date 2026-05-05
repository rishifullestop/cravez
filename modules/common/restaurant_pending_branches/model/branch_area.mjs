import { ObjectId } from 'mongodb';
import {each as asyncEach, parallel as asyncParallel} from 'async';
import Tables from '../../../../config/database_tables.mjs';
import * as Constants from '../../../../config/global_constant.mjs';
import * as Helpers from '../../../../utils/index.mjs';
import { saveUserActivity } from '../../../../services/index.mjs';

export default class PendingBranchArea{
	constructor(db) {
		this.db = db;
	}

	/**
	 * Function to get pending branch area
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getBranchPendingArea(req, res, next) {
		let slug 		= 	req?.params?.slug || "";
		let branchId 	= 	req?.params?.id || "";

		/** Get restaurant id **/
		let restaurantId = await Helpers.getRestaurantId(req,res,next,{slug:slug});
		let commonCondition= {
			restaurant_id	:	new ObjectId(restaurantId),
			branch_id 		: 	new ObjectId(branchId),
		};

		asyncParallel({
			branch_area_list : (callback)=>{
				/** Get restaurant branch area settings list **/
				const tmp_restaurant_branch_areas = this.db.collection(Tables.TMP_RESTAURANT_BRANCH_AREAS);
				tmp_restaurant_branch_areas.aggregate([
					{$match : commonCondition},
					{$lookup:	{
						"from" 			: 	Tables.AREAS,
						"localField" 	:	"area_id",
						"foreignField" 	: 	"_id",
						"as" 			: 	"area_details"
					}},
					{$project :	{
						area_id: 1, open:1, area_name: {$arrayElemAt : ["$area_details.name."+Constants.DEFAULT_LANGUAGE_CODE,0]},
					}},
					{$sort:{ area_name: Constants.SORT_ASC }}
				]).toArray().then(areaResult=>{
					callback(null, areaResult);
				}).catch(next);
			},
			attribute_list : (callback)=>{
				/** Get area attributes list **/
				Helpers.getAttributes(req,res,next,{type: "branch_area"}).then(branchAttributes=>{
					callback(null,branchAttributes);
				}).catch(next);
			},
			restaurant_details : (callback)=>{
				/** Get restaurants details **/
				const restaurant_details = this.db.collection(Tables.RESTAURANT_DETAILS);
				restaurant_details.findOne({restaurant_id: 	new ObjectId(restaurantId)},{projection: {pickup_enable:1}}).then(restResult=>{
					callback(null,restResult);
				}).catch(next);
			},
			delivery_methods : (callback)=>{
				/** Get restaurants details **/
				const restaurant_details = this.db.collection(Tables.RESTAURANT_DETAILS);
				restaurant_details.findOne({restaurant_id: 	new ObjectId(restaurantId)},{projection: {delivery_by:1}}).then(result=>{
					if(!result || !result.delivery_by) return callback(null,[]);

					/** Get delivery methods list **/
					const delivery_methods = this.db.collection(Tables.DELIVERY_METHODS);
					delivery_methods.find({
						slug : {$in : result.delivery_by}
					},{projection: {_id: 0, slug: 1, title: 1}}).toArray().then(methodResult=>{
						callback(null, methodResult);
					}).catch(next);
				}).catch(next);
			},
		},(asyncErr, asyncResponse)=>{
			if(asyncErr) return next(asyncErr);

			let attributeList 		= asyncResponse?.attribute_list || [];
			let deliveryMethodList	= asyncResponse?.delivery_methods || [];
			let restaurantDetails	= asyncResponse?.restaurant_details || {};

			/** Add delivery attribute options */
			attributeList.map(records=>{
				if(records.attribute_id == Constants.DELIVERY_ATTRIBUTE_ID){
					deliveryMethodList.map(data=>{
						if(data.slug != Constants.DELIVERY_BY_PICK_UP){
							records.data.push({
								title : (data.title) ? data.title :"",
								value : (data.slug) ? data.slug :"",
							});
						}
					});
				}
			});

			/** Render branch area list page  */
			res.render('pending_branch_area',{
				layout	 	 : false,
				slug	 	 : slug,
				area_list 	 : asyncResponse?.branch_area_list || [],
				restaurant_id: restaurantId,
				branch_id	 : branchId,
				attribute_list		: attributeList,
				restaurant_details	: restaurantDetails
			});
		});
	};//End getBranchPendingArea()

	/**
	 * Function to save branch pending area settings
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async saveBranchPendingAreaSettings  (req,res,next){
		/** Sanitize Data **/
		req.body = 	Helpers.sanitizeData(req.body,NOT_ALLOWED_TAGS_XSS);
		let branchId 	=	req?.params?.id || "";
		let restaurantId= 	req?.body?.restaurant_id || "";
		let authUserId	=	req?.session?.user?._id || "";

		/** Send error response */
		if(!restaurantId || !req?.body?.area_settings || Object.keys(req?.body?.area_settings).length == 0){
			return res.send({
				status: Constants.STATUS_ERROR,
				message: res.__("system.something_going_wrong_please_try_again")
			});
		}

		/** Check validations */
		let errors = [];
		Object.keys(req?.body?.area_settings).map((index)=>{
			let records		=	req?.body?.area_settings?.[index] || {};
			let value 		=	records?.value || "";
			let required 	= 	records?.required || "";
			let inputType 	= 	records?.input_type || "";
			let validateType= 	records?.validate_type || "";
			let title 		= 	records?.title || "";

			if(value =="" && required == Constants.REQUIRED && inputType !="checkbox"){
				errors.push({"param":"value_"+index,"msg":res.__("pending_branches_area.please_enter")+" "+title});
			}else if(value && validateType == Constants.NUMERIC_ATTRIBUTE_VALIDATION){
				if(!Constants.VALID_NUMBER_REGEX.test(value)){
					errors.push({"param":"value_"+index,"msg":res.__("pending_branches_area.please_enter_valid")+" "+title});
				}
			}else if(value && validateType == Constants.FLOAT_ATTRIBUTE_VALIDATION){
				if(!Constants.VALID_FLOAT_REGEX.test(value)){
					errors.push({"param":"value_"+index,"msg":res.__("pending_branches_area.please_enter_valid")+" "+title});
				}
			}else if(value && validateType == Constants.PERCENTAGE_ATTRIBUTE_VALIDATION){
				if(!Constants.VALID_FLOAT_REGEX.test(value)){
					errors.push({"param":"value_"+index,"msg":res.__("pending_branches_area.please_enter_valid")+" "+title});
				}else if(value < 0 || value >100){
					errors.push({"param":"value_"+index,"msg":res.__("pending_branches_area.please_enter_valid")+" "+title});
				}
			}

			if(required == Constants.REQUIRED &&
				(
					validateType == Constants.NUMERIC_ATTRIBUTE_VALIDATION ||
					validateType == Constants.FLOAT_ATTRIBUTE_VALIDATION
				)
			 	&&
				records.attribute_id != Constants.PREPARATION_TIME_ATTRIBUTE_ID
			){
				if(value <= 0){
					errors.push({"param":"value_"+index,"msg":title+" "+res.__("pending_branches_area.should_be_number")});
				}
			}
		});

		/** Send error response **/
		if(errors.length > 0) return res.send({status: Constants.STATUS_ERROR, message: errors});

		let parentIdObject	=	{};
		const tmp_restaurant_branch_area_settings = this.db.collection(Tables.TMP_RESTAURANT_BRANCH_AREA_SETTINGS);
		const tmp_restaurant_branch_areas = this.db.collection(Tables.TMP_RESTAURANT_BRANCH_AREAS);
		asyncEach(Object.keys(req?.body?.area_settings),(index, parentCallback)=>{
			let records		=	req?.body?.area_settings?.[index] || {};
			let areaId		=	records?.area_id || "";
			let attributeId	= 	records?.attribute_id || "";

			if(areaId) parentIdObject[areaId] = new ObjectId(areaId);

			/**Save area setting in branch area */
			let attributeValue 		= (records.value) ? records.value :"";
			let branchAreaFields	= Helpers.setBranchAreaFields(attributeId, attributeValue);

			/** Save branch area settings */
			tmp_restaurant_branch_area_settings.updateOne({
				restaurant_id 	:	new ObjectId(restaurantId),
				branch_id	  	: 	new ObjectId(branchId),
				area_id  		: 	new ObjectId(areaId),
				attribute_id  	: 	attributeId,
			},
			{
				$set : {
					attribute_value :	attributeValue,
					modified		: 	Helpers.getUtcDate()
				},
				$setOnInsert : {
					added_by	: new ObjectId(authUserId),
					channel_id	: req?.session?.user?.channel_id || "",
					created		: Helpers.getUtcDate()
				}
			},{upsert: true}).then(() => {
				if(branchAreaFields){
					branchAreaFields.modified	= Helpers.getUtcDate();

					tmp_restaurant_branch_areas.updateOne({
						restaurant_id 	: new ObjectId(restaurantId),
						branch_id	  	: new ObjectId(branchId),
						area_id  		: new ObjectId(areaId),
					},
					{
						$set :branchAreaFields,
					}).then(() => {
						parentCallback(null);
					}).catch(next);
				}else{
					parentCallback(null);
				}
			}).catch(next);
		},(parentErr)=>{
			if(parentErr) return res.send({
				status	: Constants.STATUS_ERROR,
				message	: res.__("system.something_going_wrong_please_try_again"),
			});

			/** Send success response **/
			res.send({
				status	: Constants.STATUS_SUCCESS,
				message	: res.__("pending_branches_area.area_attributes_has_been_updated_successfully"),
			});

			/** Save user activities **/
			saveUserActivity(req,res,{
				user_id 		:	authUserId,
				parent_type 	:	Tables.RESTAURANT_BRANCH_AREA_SETTINGS,
				parent_id 		: 	Object.values(parentIdObject),
				activity_type	:	Constants.ACTIVITY_ADD_EDIT_DETAILS,
				additional_details:	{
					restaurant_id: restaurantId,
					branch_id   : branchId,
					channel_id	: req?.session?.user?.channel_id || ""
				},
			});
		});
	};//End saveBranchPendingAreaSettings()

	/**
	 * Function to save branch pending area attributes
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async addBranchPendingArea  (req,res,next){
		let branchId 	=	req?.params?.id || "";
		let slug		= 	req?.params?.slug || "";
		let authUserId	=	req?.session?.user?._id || "";

		if(Helpers.isPost(req)){
			/** Sanitize Data **/
			req.body 	= 	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let areaIds	= 	(req.body.area_id)  ? req.body.area_id 	:[];
			if(areaIds.constructor !== Array) areaIds = [areaIds];
			areaIds = Helpers.arrayToObject(areaIds);

			asyncParallel({
				restaurant_id : (callback)=>{
					/** Get restaurant id **/
					Helpers.getRestaurantId(req,res,next,{slug:slug}).then(restaurantId=>{
						callback(null,restaurantId);
					}).catch(next);
				},
				area_attributes : (callback)=>{
					/** Get area attributes list **/
					Helpers.getAttributes(req,res,next,{type: "branch_area"}).then(branchAttributes=>{
						callback(null,branchAttributes);
					}).catch(next);
				}
			},(_,asyncParentResponse)=>{
				let restaurantId 	=	asyncParentResponse?.restaurant_id || "";
                    let areaAttributes	= 	asyncParentResponse?.area_attributes || [];

				const tmp_restaurant_branch_areas			=	this.db.collection(Tables.TMP_RESTAURANT_BRANCH_AREAS);
				const tmp_restaurant_branch_area_settings	=	this.db.collection(Tables.TMP_RESTAURANT_BRANCH_AREA_SETTINGS);

				asyncParallel({
					branch_areas : (callback)=>{
						asyncEach(areaIds,(records, parentCallback)=>{

							asyncParallel({
								save_branch_areas : (eachChildCallback)=>{
									let dataToBeSaved = {
										modified:	Helpers.getUtcDate(),
									};

									/**Save area setting in area  */
									areaAttributes.map(attribute=>{
										let attributeValue 	= (attribute.default_value) ? attribute.default_value :"";
										let attributeId 	= (attribute.attribute_id) ? parseInt(attribute.attribute_id) :"";

										let branchAreaFields= Helpers.setBranchAreaFields(attributeId, attributeValue);
										if(branchAreaFields) dataToBeSaved	= Object.assign(dataToBeSaved,branchAreaFields);
									});

									/** Update restaurant branch area  */
									tmp_restaurant_branch_areas.updateOne({
										restaurant_id	: 	new ObjectId(restaurantId),
										branch_id	  	: 	new ObjectId(branchId),
										area_id 		: 	new ObjectId(records),
									},
									{
										$set : dataToBeSaved,
										$setOnInsert :{
											open 	 	: Constants.OPEN,
											added_by 	: new ObjectId(authUserId),
											channel_id	: req?.session?.user?.channel_id || "",
											created	 	: Helpers.getUtcDate(),
										}
									},{upsert: true}).then(() => {
										eachChildCallback(null);
									}).catch(next);
								},
								save_branch_area_settings : (eachChildCallback)=>{

									/** Save area attributes  */
									asyncEach(areaAttributes,(attributeData, subEachCallback)=>{

										tmp_restaurant_branch_area_settings.updateOne({
											restaurant_id 	:	new ObjectId(restaurantId),
											branch_id	  	: 	new ObjectId(branchId),
											area_id  		: 	new ObjectId(records),
											attribute_id  	: 	(attributeData.attribute_id) ? attributeData.attribute_id :"",
										},
										{
											$set : {
												modified	: 	Helpers.getUtcDate()
											},
											$setOnInsert : {
												attribute_value : attributeData?.default_value || "",
												added_by	: new ObjectId(authUserId),
												channel_id	: req?.session?.user?.channel_id || "",
												created		: Helpers.getUtcDate()
											}
										},{upsert: true}).then(() => {
											subEachCallback(null);
										}).catch(next);
									},(parentErr)=>{
										eachChildCallback(parentErr);
									});
								}
							},(asyncEachErr)=>{
								parentCallback(asyncEachErr);
							});
						},(parentErr)=>{
							callback(parentErr);
						});
					},
					delete_branch_areas : (callback)=>{
						/** Delete area not selefcted area */
						tmp_restaurant_branch_areas.deleteMany({
							restaurant_id	: 	new ObjectId(restaurantId),
							branch_id	  	: 	new ObjectId(branchId),
							area_id 		: 	{$nin : areaIds},
						}).then(() => {
							callback(null);
						}).catch(next);
					},
					branch_area_settings : (callback)=>{
						/** Delete not selected area */
						const tmp_restaurant_branch_area_settings = this.db.collection(Tables.TMP_RESTAURANT_BRANCH_AREA_SETTINGS);
						tmp_restaurant_branch_area_settings.deleteMany({
							branch_id	: 	new ObjectId(branchId),
							area_id 	: 	{$nin : areaIds},
						}).then(() => {
							callback(null);
						}).catch(next);
					},
				},(asyncErr)=>{
					if(asyncErr) return res.send({
						status		: Constants.STATUS_ERROR,
						message		: res.__("system.something_going_wrong_please_try_again"),
					});

					/** Send success response **/
					res.send({
						status		: Constants.STATUS_SUCCESS,
						message		: res.__("pending_branches_area.area_has_been_added_successfully"),
					});

					/** Save user activities **/
					saveUserActivity(req,res,{
						user_id 		:	authUserId,
						parent_type 	:	Tables.RESTAURANT_BRANCH_AREAS,
						parent_id 		: 	areaIds,
						activity_type	:	Constants.ACTIVITY_ADD_EDIT_DETAILS,
						additional_details:	{
							restaurant_id: restaurantId,
							branch_id   : branchId,
							channel_id	: req?.session?.user?.channel_id || ""
						},
					});
				});
			});
		}else{
			asyncParallel({
				branch_details : (callback)=>{
					/** Get branch details **/
					const tmp_restaurant_branches = this.db.collection(Tables.TMP_RESTAURANT_BRANCHES);
					tmp_restaurant_branches.findOne({
						branch_id     	: new ObjectId(branchId),
						restaurant_slug	: slug
					},{projection: {_id:0, city_id:1, branch_number:1, name:1}}).then(result=>{
						callback(null,result);
					}).catch(next);
				},
				branch_areas : (callback)=>{
					/** Get branch area list **/
					const tmp_restaurant_branch_areas = this.db.collection(Tables.TMP_RESTAURANT_BRANCH_AREAS);
					tmp_restaurant_branch_areas.find({
						branch_id    : new ObjectId(branchId),
					},{projection: {_id: 0, area_id: 1}}).toArray().then(areaResult=>{
						callback(null, areaResult);
					}).catch(next);
				}
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				if(!asyncResponse.branch_details){
					return res.status(400).send({
						status  : Constants.STATUS_ERROR,
						message : res.__("system.something_going_wrong_please_try_again")
					});
				}

				/** Get areas list **/
				const areas = this.db.collection(Tables.AREAS);
				areas.aggregate([
					{$match :  {
						is_active :	Constants.ACTIVE
					}},
					{$lookup:	{
						"from" 			: 	Tables.CITIES,
						"localField" 	:	"city_id",
						"foreignField" 	: 	"_id",
						"as" 			: 	"city_detail"
					}},
					{$project :	{
						_id			: 1,
						area_id		: 1,
						name		: 1,
						city_id		: {$arrayElemAt : ["$city_detail.city_id",0]},
						city_name	: {$arrayElemAt : ["$city_detail.name",0]}
					}},
				]).toArray().then(areaResult=>{
					/** Add selected flag */
					if(asyncResponse?.branch_areas && asyncResponse?.branch_areas?.length > 0 && areaResult?.length >0){
                            asyncResponse?.branch_areas?.map(records=>{
							areaResult.map(data=>{
								if(records.area_id && data._id && String(data._id) == String(records.area_id)){
									data.is_selected = true;
								}
							});
						});
					}

					/** Render area add page */
					res.render('pending_branch_area_add',{
						layout	 		:	false,
						branch_id		:	branchId,
						branch_details	:	asyncResponse?.branch_details,
						area_list		:	areaResult
					});
				}).catch(next);
			});
		}
	};//End addBranchPendingArea()

	/**
	 * Function to save branch pending area settings
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async getBranchPendingAreaSettings(req, res, next) {
		let branchId 	=	req?.params?.id || "";
		let slug		= 	req?.params?.slug || "";
		let areaIds		= 	req?.body?.area_id || "";

		/** Send error response */
		if(!areaIds) return res.send({status: Constants.STATUS_ERROR, message: res.__("pending_branches_area.please_select_atleast_one_area")});

		if(areaIds.constructor !== Array) areaIds = [areaIds];

		/** Convert Object Id */
		areaIds = Helpers.arrayToObject(areaIds);
		/** Get restaurant id **/
		let restaurantId = await Helpers.getRestaurantId(req,res,next,{slug:slug});

		asyncParallel({
			attribute_list : (callback)=>{
				/** Get Area settings */
				const tmp_restaurant_branch_area_settings = this.db.collection(Tables.TMP_RESTAURANT_BRANCH_AREA_SETTINGS);
				tmp_restaurant_branch_area_settings.aggregate([
					{$match :  {
						branch_id 		: 	new ObjectId(branchId),
						restaurant_id 	: 	new ObjectId(restaurantId),
						area_id			: 	{$in: areaIds}
					}},
					{$lookup:	{
						"from" 			: 	Tables.ATTRIBUTES,
						"localField" 	:	"attribute_id",
						"foreignField" 	: 	"attribute_id",
						"as" 			: 	"attribute_detail"
					}},
					{$match:{
						"attribute_detail._id" : {$exists : true}
					}},
					{$lookup: {
						"from" 			: 	Tables.AREAS,
						"localField" 	:	"area_id",
						"foreignField" 	: 	"_id",
						"as" 			: 	"area_details"
					}},
					{$project :	{
						attribute_id: 1, area_id:1,value: "$attribute_value", title: {$arrayElemAt : ["$attribute_detail.title",0]},input_type: {$arrayElemAt : ["$attribute_detail.input_type",0]},default_value: {$arrayElemAt : ["$attribute_detail.default_value",0]},validation_type: {$arrayElemAt : ["$attribute_detail.validation_type",0]},required: {$arrayElemAt : ["$attribute_detail.required",0]},order: {$arrayElemAt : ["$attribute_detail.order",0]}, data: {$arrayElemAt : ["$attribute_detail.data",0]}, area_name: {$arrayElemAt : ["$area_details.name."+Constants.DEFAULT_LANGUAGE_CODE,0]}
					}},
					{$sort:{ area_id: Constants.SORT_ASC, order: Constants.SORT_ASC }}
				]).toArray().then(attributeResult=>{
					callback(null, attributeResult);
				}).catch(next);
			},
			delivery_methods : (callback)=>{
				/** Get restaurants details **/
				const restaurant_details = this.db.collection(Tables.RESTAURANT_DETAILS);
				restaurant_details.findOne({restaurant_id: 	new ObjectId(restaurantId)},{projection: {delivery_by:1}}).then(result=>{
					if(!result || !result?.delivery_by) return callback(null,[]);

					/** Get delivery methods list **/
					const delivery_methods = this.db.collection(Tables.DELIVERY_METHODS);
					delivery_methods.find({
						slug : {$in : result.delivery_by}
					},{projection: {_id: 0, slug: 1, title: 1}}).toArray().then(methodResult=>{
						callback(null, methodResult);
					}).catch(next);
				}).catch(next);
			},
			restaurant_details : (callback)=>{
				/** Get restaurants details **/
				const restaurant_details = this.db.collection(Tables.RESTAURANT_DETAILS);
				restaurant_details.findOne({restaurant_id: 	new ObjectId(restaurantId)},{projection: {pickup_enable:1}}).then(restResult=>{
					callback(null, restResult || {});
				}).catch(next);
			}
		},(asyncErr, asyncResponse)=>{
			if(asyncErr) return next(asyncErr);

			let attributeList 		= 	asyncResponse?.attribute_list || [];
			let deliveryMethodList	=	asyncResponse?.delivery_methods || [];
			let restaurantDetails	=	asyncResponse?.restaurant_details || {};

			/** Add delivery attribute options */
			attributeList.map(records=>{
				if(records?.attribute_id == Constants.DELIVERY_ATTRIBUTE_ID){
					deliveryMethodList.map(data=>{
						if(data?.slug != Constants.DELIVERY_BY_PICK_UP){
							records.data.push({
								title : (data.title) ? data.title :"",
								value : (data.slug) ? data.slug :"",
							});
						}
					});
				}
			});

			/** Redirect area settings page */
			res.render('pending_branch_area_settings',{
				layout	 		:	false,
				attribute_list	:	attributeList,
				restaurant_details : restaurantDetails,
			});
		});
	};//End getBranchPendingAreaSettings()

	/**
	 * Function to save branch pending area open/ close status
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async updateBranchPendingAreaStatus(req, res, next) {
        try {
			let branchId	=	req?.params?.id || "";
			let slug		= 	req?.params?.slug || "";
			let areaIds		= 	req?.body?.area_id || "";
			let status		= 	req?.body?.status || "";
			let authUserId	=	req?.session?.user?._id || "";

			/** Send error response */
			if(!areaIds) return res.send({status: Constants.STATUS_ERROR, message: res.__("pending_branches_area.please_select_atleast_one_area")});

			if(areaIds.constructor !== Array) areaIds = [areaIds];

			/** Convert Object Id */
			areaIds = Helpers.arrayToObject(areaIds);

			let updatedStatus = (status == Constants.OPEN) ? Constants.OPEN :Constants.CLOSE;

			/** Get restaurant id **/
			let restaurantId = await Helpers.getRestaurantId(req,res,next,{slug:slug});

			/** Update open staus */
			const tmp_restaurant_branch_areas = this.db.collection(Tables.TMP_RESTAURANT_BRANCH_AREAS);
			await tmp_restaurant_branch_areas.updateMany({
				area_id  		: 	{$in: areaIds},
				restaurant_id 	:	new ObjectId(restaurantId),
				branch_id	  	: 	new ObjectId(branchId)
			},
			{$set : {
				open 	:	updatedStatus,
				modified: 	Helpers.getUtcDate()
			}});

			/** Send success response */
			res.send({
				status	: 	Constants.STATUS_SUCCESS,
				message :	res.__("pending_branches_area.area_status_has_been_updated_successfully"),
			});

			/** Save user activities **/
			saveUserActivity(req,res,{
				user_id 		:	authUserId,
				parent_type 	:	Tables.RESTAURANT_BRANCH_AREAS,
				parent_id 		: 	areaIds,
				activity_type	:	Constants.ACTIVITY_UPDATE_STATUS,
				additional_details:	{
					restaurant_id: restaurantId,
					branch_id   : branchId,
					open :updatedStatus,
					channel_id	: req?.session?.user?.channel_id || ""
				},
			});
        } catch (error) {
            return next(error);
        }
	};//End updateBranchPendingAreaStatus()
}