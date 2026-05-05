import { ObjectId } from 'mongodb';
import {each as asyncEach, parallel as asyncParallel} from 'async';
import Tables from '../../../../config/database_tables.mjs';
import * as Constants from "../../../../config/global_constant.mjs";
import { getRestaurantId, getAttributes, isAdmin, sanitizeData, getUtcDate, arrayToObject, copyFromParentTable, isPost, setBranchAreaFields} from '../../../../utils/index.mjs';
import { saveUserActivity } from "../../../../services/index.mjs";

class BranchArea {
    constructor(db) {
        this.db = db;
    }

	/**
	 * Function to get  branch area
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return render/json
	 */
    async getBranchArea(req, res, next) {
        try {
			let slug 		= 	(req.params.slug)	?	req.params.slug :"";
			let branchId 	=	(req.params.id) 	? 	req.params.id	:"";

			/** Get restaurant id **/
			let restaurantId = await getRestaurantId(req,res,next,{slug:slug});

			asyncParallel({
				branch_area_list : (callback)=>{
					/** Get restaurant branch area settings list **/
					const restaurant_branch_areas = this.db.collection(Tables.RESTAURANT_BRANCH_AREAS);
					restaurant_branch_areas.aggregate([
						{$match :  {
							restaurant_id	:	new ObjectId(restaurantId),
							branch_id 		: 	new ObjectId(branchId),
						}},
						{$lookup:	{
							"from" 			: 	Tables.AREAS,
							"localField" 	:	"area_id",
							"foreignField" 	: 	"_id",
							"as" 			: 	"area_details"
						}},
						{$project :	{
							area_id:1,  open:1, area_name: {$arrayElemAt : ["$area_details.name."+Constants.DEFAULT_LANGUAGE_CODE,0]},
						}},
						{$sort:{ area_name: Constants.SORT_ASC }}
					]).toArray().then(areaResult=>{
						callback(null, areaResult);
					}).catch(next);
				},
				attribute_list : (callback)=>{
					/** Get area attributes list **/
					getAttributes(req,res,next,{type: "branch_area"}).then(branchAttributes=>{
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
						delivery_methods.find({slug: {$in: result.delivery_by} },{projection: {_id: 0, slug: 1, title: 1}}).toArray().then(methodResult=>{
							callback(null, methodResult);
						}).catch(next);
					}).catch(next);
				},
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next();

				let attributeList 		= (asyncResponse.attribute_list)	? asyncResponse.attribute_list 	:[];
				let deliveryMethodList	= (asyncResponse.delivery_methods)	? asyncResponse.delivery_methods:[];
				let restaurantDetails	= (asyncResponse.restaurant_details)? asyncResponse.restaurant_details:{};

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
				res.render('branch_area',{
					layout	 	 		: false,
					slug	 	 		: slug,
					area_list 	 		: (asyncResponse.branch_area_list)	? asyncResponse.branch_area_list :[],
					restaurant_id		: restaurantId,
					branch_id	 		: branchId,
					attribute_list		: attributeList,
					restaurant_details	: restaurantDetails
				});
			});
        } catch (err) {
            next(err);
        }
	}

	/**
	 * Function to save branch  area settings
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async saveBranchAreaSettings (req,res,next){

		/** Sanitize Data **/
		req.body		= 	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);

		let branchId 	=	(req.params.id) 			? 	req.params.id			:"";
		let restaurantId= 	(req.body.restaurant_id)	?	req.body.restaurant_id 	:"";
		let authUserId	=	(req.session.user && req.session.user._id) ? req.session.user._id :"";

		/** Send error response */
		if(!restaurantId || !req.body.area_settings || Object.keys(req.body.area_settings).length == 0){
			return res.send({
				status: Constants.STATUS_ERROR,
				message: res.__("system.something_going_wrong_please_try_again")
			});
		}

		/** Check validations */
		let errors = [];
		Object.keys(req.body.area_settings).map((index)=>{
			let records		=	(req.body.area_settings[index])	?	req.body.area_settings[index]	:{};
			let value 		=	(records.value)		 	? 	records.value		  	:"";
			let required 	= 	(records.required)		? 	records.required	  	:"";
			let inputType 	= 	(records.input_type)	? 	records.input_type	  	:"";
			let validateType= 	(records.validate_type)	? 	records.validate_type	:"";
			let title 		= 	(records.title) 		?	records.title 		  	:"";

			if(value =="" && required == Constants.REQUIRED && inputType !="checkbox"){
				errors.push({"param":"value_"+index,"msg":res.__("branch_area.please_enter")+" "+title});
			}else if(value && validateType == Constants.NUMERIC_ATTRIBUTE_VALIDATION){
				let validRegx 	= 	/^[0-9]+$/;
				if(!validRegx.test(value)){
					errors.push({"param":"value_"+index,"msg":res.__("branch_area.please_enter_valid")+" "+title});
				}
			}else if(value && validateType == Constants.FLOAT_ATTRIBUTE_VALIDATION){
				let validRegx 	= 	/^([0-9]*[.])?[0-9]+/;
				if(!validRegx.test(value)){
					errors.push({"param":"value_"+index,"msg":res.__("branch_area.please_enter_valid")+" "+title});
				}
			}else if(value && validateType == Constants.PERCENTAGE_ATTRIBUTE_VALIDATION){
				let validRegx 	= 	/^[0-9]+([.][0-9]+)?$/;
				if(!validRegx.test(value)){
					errors.push({"param":"value_"+index,"msg":res.__("branch_area.please_enter_valid")+" "+title});
				}else if(value < 0 || value >100){
					errors.push({"param":"value_"+index,"msg":res.__("branch_area.please_enter_valid")+" "+title});
				}
			}

			if(required == Constants.REQUIRED && (validateType == Constants.NUMERIC_ATTRIBUTE_VALIDATION || validateType == Constants.FLOAT_ATTRIBUTE_VALIDATION) && records.attribute_id != Constants.DELIVERY_FEES_ATTRIBUTE_ID && records.attribute_id != Constants.PREPARATION_TIME_ATTRIBUTE_ID && records.attribute_id != Constants.MINIMUM_ORDER_LIMIT_ATTRIBUTE_ID){
				if(value && value <= 0){
					errors.push({"param":"value_"+index,"msg":title+" "+res.__("branch_area.should_be_number")});
				}
			}
		});

		/** Send error response **/
		if(errors.length > 0) return res.send({status: Constants.STATUS_ERROR, message: errors});

		let collection 				= this.db.collection(Tables.TMP_RESTAURANT_BRANCH_AREA_SETTINGS);
		let restaurant_branch_areas	= this.db.collection(Tables.RESTAURANT_BRANCH_AREAS);

		/** For admin only */
		if(isAdmin(req,res)) collection = this.db.collection(Tables.RESTAURANT_BRANCH_AREA_SETTINGS);

		let changeInForm	=	false;
		let parentIdObject	=	{};
		asyncEach(Object.keys(req.body.area_settings),(index, parentCallback)=>{
			let records		=	(req.body.area_settings[index])	?	req.body.area_settings[index]	:{};
			if((typeof records.value == typeof undefined && records.old_value) || (records.value && records.value != records.old_value)){

				/** If user change value in any 1 input */
				changeInForm 		= true;

				let areaId		=	(records.area_id)		?	records.area_id					:"";
				let attributeId	= 	(records.attribute_id)	?	parseInt(records.attribute_id)	:"";
				parentIdObject[areaId] = new ObjectId(areaId);

				/** Save branch area settings */
				collection.updateOne({
					area_id  		: 	new ObjectId(areaId),
					restaurant_id 	:	new ObjectId(restaurantId),
					branch_id	  	: 	new ObjectId(branchId),
					attribute_id  	: 	attributeId,
				},
				{
					$set : {
						attribute_value :	(records.value) ? records.value :"",
						modified		: 	getUtcDate()
					},
					$setOnInsert : {
						added_by   : new ObjectId(authUserId),
						channel_id : req.session.user.channel_id,
						created    : getUtcDate()
					}
				},{upsert: true}).then(() => {

					/**Save area setting in branch area */
					let attributeValue 		= (records.value) ? records.value :"";
					let branchAreaFields	= setBranchAreaFields(attributeId, attributeValue);

					if(isAdmin(req,res)){
						if(branchAreaFields){
							branchAreaFields.modified	= getUtcDate();
							restaurant_branch_areas.updateOne({
								area_id  		: new ObjectId(areaId),
								restaurant_id 	: new ObjectId(restaurantId),
								branch_id	  	: new ObjectId(branchId),
							},
							{
								$set :branchAreaFields,
							}).then(() => {
								parentCallback(null);
							}).catch(next);
						}else{
							parentCallback(null);
						}
					}else{
						let options = {
							type : "insert_in_tmp_restaurant_branch_areas",
							parent_table : {
								name 			:	Tables.RESTAURANT_BRANCH_AREAS,
								fields 			: 	{ modified: 0,_id: 0},
								conditions 		: 	{branch_id: new ObjectId(branchId), restaurant_id: new ObjectId(restaurantId), area_id : new ObjectId(areaId)},
								remove_original : 	false
							},
							child_table : {
								name 		: 	Tables.TMP_RESTAURANT_BRANCH_AREAS,
								conditions	:	{restaurant_id: new ObjectId(restaurantId), branch_id: new ObjectId(branchId), area_id : new ObjectId(areaId)},
							}
						};
						if(branchAreaFields){
							options.child_table.extra_fields = branchAreaFields;

							Object.keys(branchAreaFields).map(tmpKey=>{
								options.parent_table.fields[tmpKey] = 0;
							});
						}

						/** Copy data  restaurant_branch_areas to  tmp_restaurant_branch_areas collections*/
						copyFromParentTable(req,res,next,options).then(response=>{
							if(response.status != Constants.STATUS_SUCCESS) return parentCallback(response);
							parentCallback(null);
						}).catch(next);
					}
				}).catch(next);
			}else{
				parentCallback(null);
			}
		},(parentErr)=>{
			if(parentErr) return res.send({
				status		: Constants.STATUS_ERROR,
				message		: res.__("system.something_going_wrong_please_try_again"),
			});

			if(isAdmin(req,res) || changeInForm){
				/** Save user activities **/
				saveUserActivity(req,res,{
					user_id 		:	authUserId,
					parent_type 	:	Tables.RESTAURANT_BRANCH_AREA_SETTINGS,
					parent_id 		: 	Object.values(parentIdObject),
					activity_type	:	Constants.ACTIVITY_ADD_EDIT_DETAILS,
					additional_details:	{restaurant_id: new ObjectId(restaurantId), branch_id: new ObjectId(branchId),channel_id : req.session.user.channel_id},
				});
			}

			let message = res.__("branch_area.area_attributes_has_been_updated_successfully");

			if(isAdmin(req,res)){
				return res.send({
					status		: Constants.STATUS_SUCCESS,
					message		: message,
				});
			}else{
				message = res.__("branch_area.area_attributes_update_message_for_restaurant");
			}

			if(!changeInForm) return res.send({
				status		: Constants.STATUS_ERROR,
				message		: res.__("branch_area.you_have_not_update_any_value_in_area_attribute"),
			});

			let options = {
				type : "insert_in_tmp_restaurant_branches",
				parent_table : {
					name 			:	Tables.RESTAURANT_BRANCHES,
					fields 			: 	{ modified: 0,_id: 0},
					conditions 		: 	{_id: new ObjectId(branchId), restaurant_id:  new ObjectId(restaurantId)},
					remove_original : 	false
				},
				child_table : {
					name 		: 	Tables.TMP_RESTAURANT_BRANCHES,
					conditions	:	{restaurant_id: new ObjectId(restaurantId), branch_id: new ObjectId(branchId)},
					additional_fields : {submit_for_approval : false, for_reapproval : true, user_id : authUserId, status: Constants.PENDING},
				}
			};

			/** Copy data  tmp_restaurant_branches to  restaurant_branches collections*/
			copyFromParentTable(req,res,next,options).then(response=>{
				if(response.status != Constants.STATUS_SUCCESS) return  res.send({
					status		: Constants.STATUS_ERROR,
					message		: res.__("system.something_going_wrong_please_try_again"),
				});

				/** Send success response **/
				res.send({
					status :	Constants.STATUS_SUCCESS,
					message: 	message,
				});
			}).catch(next);
		});
	};//End saveBranchAreaSettings()

	/**
	 * Function to save branch  area attributes
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async addBranchArea (req,res,next){
		let branchId 	=	(req.params.id) 	? req.params.id		:"";
		let slug		= 	(req.params.slug)	? req.params.slug	: "";
		let authUserId	=	(req.session.user && req.session.user._id) ? req.session.user._id :"";

		if(isPost(req)){
			/** Sanitize Data **/
			req.body 	= 	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let areaIds	= 	(req.body.area_id)  ? req.body.area_id 	:[];
			if(areaIds.constructor !== Array) areaIds = [areaIds];

			const restaurant_branch_areas =	this.db.collection(Tables.RESTAURANT_BRANCH_AREAS);
			asyncParallel({
				restaurant_id : (callback)=>{
					/** Get restaurant id **/
					getRestaurantId(req,res,next,{slug:slug}).then(restaurantId=>{
						callback(null,restaurantId);
					}).catch(next);
				},
				area_attributes : (callback)=>{
					/** Get area attributes list **/
					getAttributes(req,res,next,{type: "branch_area"}).then(branchAttributes=>{
						callback(null,branchAttributes);
					}).catch(next);
				},
				restaurant_branch_areas : (callback)=>{
					/** Get restaurant_ ranch areas list **/
					restaurant_branch_areas.find({branch_id: new ObjectId(branchId) },{projection: {area_id: 1}}).toArray().then(areaResult=>{
						callback(null, areaResult);
					}).catch(next);
				}
			},(asyncParentErr,asyncParentResponse)=>{
				let restaurantId 			=	(asyncParentResponse.restaurant_id)				?	asyncParentResponse.restaurant_id			:"";
				let areaAttributes			= 	(asyncParentResponse.area_attributes)			?	asyncParentResponse.area_attributes			:[];
				let restaurantBranchAreas	= 	(asyncParentResponse.restaurant_branch_areas)	?	asyncParentResponse.restaurant_branch_areas	:[];

				let newAreas 		=	[];
				let matchAnyArea	=	false;
				if(restaurantBranchAreas.length >0){
					areaIds.map(key=>{
						let isMatched = false;
						restaurantBranchAreas.map(records=>{
							if(records.area_id && String(records.area_id) == key) isMatched = true;
						});

						if(!isMatched){
							newAreas.push(new ObjectId(key));
						}else{
							matchAnyArea = true;
						}
					});
				}else{
					newAreas = areaIds;
				}

				/** Convert into object id */
				let finalAreaIds = arrayToObject(areaIds);

				/** Send error response */
				if(!matchAnyArea && !isAdmin(req,res)) return res.send({ status: Constants.STATUS_ERROR, message: res.__("branch_area.you_cannot_remove_all_approved_areas") });

				let collection 			= 	this.db.collection(Tables.TMP_RESTAURANT_BRANCH_AREAS);
				let settingCollection 	=	this.db.collection(Tables.TMP_RESTAURANT_BRANCH_AREA_SETTINGS);

				/** For admin only */
				if(isAdmin(req,res)){
					collection 			= 	this.db.collection(Tables.RESTAURANT_BRANCH_AREAS);
					settingCollection 	=	this.db.collection(Tables.RESTAURANT_BRANCH_AREA_SETTINGS);
				}

				asyncParallel({
					branch_areas : (callback)=>{
						if(newAreas.length <= 0) return callback(null);

						asyncEach(newAreas,(records, parentCallback)=>{

							asyncParallel({
								save_branch_areas : (eachChildCallback)=>{
									/** Update restaurant branch area  */
									collection.updateOne({
										area_id 		: 	new ObjectId(records),
										restaurant_id	: 	new ObjectId(restaurantId),
										branch_id	  	: 	new ObjectId(branchId),
									},
									{
										$set :{
											modified:	getUtcDate(),
										},
										$setOnInsert :{
											open 	 	: Constants.OPEN,
											added_by 	: new ObjectId(authUserId),
											channel_id	: req.session.user.channel_id,
											created	 	: getUtcDate(),
										}
									},{upsert: true}).then(()=>{

										/** Save area attributes  */
										asyncEach(areaAttributes,(attributeData, subEachCallback)=>{
											let tmpAttributeId = (attributeData.attribute_id) ? attributeData.attribute_id :"";
											let tmpAttributeValue = (attributeData.default_value) ? attributeData.default_value :"";

											asyncParallel({
												save_branch_areas : (eachSubCallback)=>{
													let branchAreaFields	= setBranchAreaFields(tmpAttributeId, tmpAttributeValue);

													if(!branchAreaFields) return eachSubCallback(null);

													let tmpConditions = {
														area_id  		: 	new ObjectId(records),
														restaurant_id 	:	new ObjectId(restaurantId),
														branch_id	  	: 	new ObjectId(branchId)
													};

													/** Update area details */
													collection.updateOne(tmpConditions, {$set :branchAreaFields},{upsert: true}).then(()=>{
														eachSubCallback(null);
													}).catch(next);
												},
												save_settings : (eachSubCallback)=>{

													settingCollection.updateOne({
														area_id  		: 	new ObjectId(records),
														restaurant_id 	:	new ObjectId(restaurantId),
														branch_id	  	: 	new ObjectId(branchId),
														attribute_id  	: 	tmpAttributeId,
													},
													{
														$set : {
															modified : 	getUtcDate()
														},
														$setOnInsert : {
															attribute_value :	tmpAttributeValue,
															added_by   : new ObjectId(authUserId),
															channel_id : req.session.user.channel_id,
															created    : getUtcDate()
														}
													},{upsert: true}).then(()=>{
														eachSubCallback(null);
													}).catch(next);
												}
											},(asyncChildEachErr)=>{
												subEachCallback(asyncChildEachErr);
											});
										},(parentErr)=>{
											eachChildCallback(parentErr);
										});
									}).catch(next);
								},
							},(asyncEachErr)=>{
								parentCallback(asyncEachErr);
							});
						},(parentErr)=>{
							callback(parentErr);
						});
					},
					delete_branch_areas : (callback)=>{
						/** Delete area not selefcted area */
						restaurant_branch_areas.deleteMany({
							restaurant_id	: 	new ObjectId(restaurantId),
							branch_id	  	: 	new ObjectId(branchId),
							area_id 		: 	{$nin : finalAreaIds},
						}).then(()=>{
							callback(null);
						}).catch(next);
					},
					branch_area_settings : (callback)=>{
						/** Delete area not selefcted area */
						const restaurant_branch_area_settings = this.db.collection(Tables.RESTAURANT_BRANCH_AREA_SETTINGS);
						restaurant_branch_area_settings.deleteMany({
							branch_id	: 	new ObjectId(branchId),
							area_id 	: 	{$nin : finalAreaIds},
						}).then(()=>{
							callback(null);
						}).catch(next);
					},
					tmp_branch_update_details : (callback)=>{
						if(newAreas.length <= 0 || isAdmin(req,res)) return callback(null);

						let options = {
							type : "insert_in_tmp_restaurant_branches",
							parent_table : {
								name 			:	Tables.RESTAURANT_BRANCHES,
								fields 			: 	{ modified: 0,_id: 0},
								conditions 		: 	{_id: new ObjectId(branchId), restaurant_id:  new ObjectId(restaurantId)},
								remove_original : 	false
							},
							child_table : {
								name 		: 	Tables.TMP_RESTAURANT_BRANCHES,
								conditions	:	{restaurant_id: new ObjectId(restaurantId), branch_id: new ObjectId(branchId)},
								additional_fields : {submit_for_approval : false, for_reapproval : true, user_id : authUserId, status: Constants.PENDING},
							}
						};

						/** Copy data  tmp_restaurant_branches to  restaurant_branches collections*/
						copyFromParentTable(req,res,next,options).then(response=>{
							if(response.status != Constants.STATUS_SUCCESS) return  callback(response.status);
							callback(null);
						}).catch(next);
					},
				},(asyncErr)=>{
					if(asyncErr) return res.send({
						status		: Constants.STATUS_ERROR,
						message		: res.__("system.something_going_wrong_please_try_again"),
					});

					if(isAdmin(req,res) || (matchAnyArea && newAreas.length <= 0) || newAreas.length >0){
						/** Save user activities **/
						saveUserActivity(req,res,{
							user_id 		:	authUserId,
							parent_type 	:	Tables.RESTAURANT_BRANCH_AREAS,
							parent_id 		: 	(newAreas.length >1) ? newAreas :finalAreaIds,
							activity_type	:	Constants.ACTIVITY_ADD_EDIT_DETAILS,
							additional_details:	{restaurant_id: new ObjectId(restaurantId), branch_id: new ObjectId(branchId),channel_id: req.session.user.channel_id},
						}).then(()=>{});
					}

					if(isAdmin(req,res)) return res.send({
						status		: Constants.STATUS_SUCCESS,
						message		: res.__("branch_area.area_has_been_added_successfully"),
					});

					if(matchAnyArea && newAreas.length <= 0) return res.send({
						status			: Constants.STATUS_SUCCESS,
						is_not_redirect	: true,
						message			: res.__("branch_area.area_has_been_added_successfully"),
					});

					if(newAreas.length <= 0) return res.send({
						status		: Constants.STATUS_ERROR,
						message		: res.__("branch_area.you_have_not_update_any_area"),
					});

					let options = {
						type : "insert_in_tmp_restaurant_branches",
						parent_table : {
							name 			:	Tables.RESTAURANT_BRANCHES,
							fields 			: 	{ modified: 0,_id: 0},
							conditions 		: 	{_id: new ObjectId(branchId), restaurant_id:  new ObjectId(restaurantId)},
							remove_original : 	false
						},
						child_table : {
							name 		: 	Tables.TMP_RESTAURANT_BRANCHES,
							conditions	:	{restaurant_id: new ObjectId(restaurantId), branch_id: new ObjectId(branchId)},
							additional_fields : {submit_for_approval : false, for_reapproval : true, user_id : authUserId, status: Constants.PENDING},
						}
					};

					/** Copy data  tmp_restaurant_branches to  restaurant_branches collections*/
					copyFromParentTable(req,res,next,options).then(response=>{
						if(response.status != Constants.STATUS_SUCCESS) return  res.send({
							status		: Constants.STATUS_ERROR,
							message		: res.__("system.something_going_wrong_please_try_again"),
						});

						/** Send success response **/
						let message = (isAdmin(req,res)) ? res.__("branch_area.area_has_been_added_successfully") :res.__("branch_area.area_has_been_added_successfully_you_can_see_updated_details_in_pending_branches_section")
						res.send({
							status		: Constants.STATUS_SUCCESS,
							message		: message,
						});
					}).catch(next);
				});
			});
		}else{
			asyncParallel({
				branch_details : (callback)=>{
					/** Get branch details **/
					const restaurant_branches = this.db.collection(Tables.RESTAURANT_BRANCHES);
					restaurant_branches.findOne({
						_id : new ObjectId(branchId),
						restaurant_slug	: slug
					},{projection: {_id:0, city_id:1, branch_number:1, name:1}}).then(result=>{
						callback(null,result);
					}).catch(next);
				},
				branch_areas : (callback)=>{
					/** Get branch area list **/
					const restaurant_branch_areas = this.db.collection(Tables.RESTAURANT_BRANCH_AREAS);
					restaurant_branch_areas.find({
						branch_id    : new ObjectId(branchId),
					},{projection: {_id: 0, area_id: 1}}).toArray().then(areaResult=>{
						callback(null,areaResult);
					}).catch(next);
				}
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				if(!asyncResponse || !asyncResponse.branch_details){
					/** Send error response **/
					return res.status(400).send({
						status  : Constants.STATUS_ERROR,
						message : res.__("system.something_going_wrong_please_try_again")
					});
				}

				/** Get areas list **/
				const areas = this.db.collection(Tables.AREAS);
				areas.aggregate([
					{$match :  {
						is_active 	:  	Constants.ACTIVE,
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
					if(asyncResponse.branch_areas && asyncResponse.branch_areas.length > 0 && areaResult.length >0){
						asyncResponse.branch_areas.map(records=>{
							areaResult.map(data=>{
								if(records.area_id && data._id && String(data._id) == String(records.area_id)){
									data.is_selected = true;
								}
							});
						});
					}

					/** Render area add page */
					res.render('branch_area_add',{
						layout	 		:	false,
						branch_id		:	branchId,
						branch_details	:	asyncResponse.branch_details,
						area_list		:	areaResult
					});
				}).catch(next);
			});
		}
	};//End addBranchArea()

	/**
	 * Function to save branch  area settings
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async getBranchAreaSettings (req,res,next){
		let branchId 	=	(req.params.id) 	? 	req.params.id		:"";
		let slug		= 	(req.params.slug)	? 	req.params.slug		:"";
		let areaIds		= 	(req.body.area_id)	?	req.body.area_id 	:"";

		/** Send error response */
		if(!areaIds) return res.send({status: Constants.STATUS_ERROR, message: res.__("branch_area.please_select_atleast_one_area")});

		if(areaIds.constructor !== Array) areaIds = [areaIds];

		/** Convert Object Id */
		areaIds = arrayToObject(areaIds);

		/** Get restaurant id **/
		let restaurantId = await getRestaurantId(req,res,next,{slug:slug});

		asyncParallel({
			attribute_list : (callback)=>{
				/** Get Area settings */
				const restaurant_branch_area_settings = this.db.collection(Tables.RESTAURANT_BRANCH_AREA_SETTINGS);
				restaurant_branch_area_settings.aggregate([
					{$match :  {
						branch_id 		: 	new ObjectId(branchId),
						restaurant_id	: 	new ObjectId(restaurantId),
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
						attribute_id: 1, area_id:1,value: "$attribute_value", title: {$arrayElemAt : ["$attribute_detail.title",0]},input_type: {$arrayElemAt : ["$attribute_detail.input_type",0]},default_value: {$arrayElemAt : ["$attribute_detail.default_value",0]},validation_type: {$arrayElemAt : ["$attribute_detail.validation_type",0]},required: {$arrayElemAt : ["$attribute_detail.required",0]},order: {$arrayElemAt : ["$attribute_detail.order",0]}, data: {$arrayElemAt : ["$attribute_detail.data",0]},area_name: {$arrayElemAt : ["$area_details.name."+Constants.DEFAULT_LANGUAGE_CODE,0]}
					}},
					{$sort:{ area_id: Constants.SORT_ASC,  order: Constants.SORT_ASC }}
				]).toArray().then(attributeResult=>{
					callback(null, attributeResult);
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
			restaurant_details : (callback)=>{
				/** Get restaurants details **/
				const restaurant_details = this.db.collection(Tables.RESTAURANT_DETAILS);
				restaurant_details.findOne({restaurant_id: 	new ObjectId(restaurantId)},{projection: {pickup_enable:1}}).then(restResult=>{
					callback(null,restResult);
				}).catch(next);
			}
		},(asyncErr, asyncResponse)=>{
			if(asyncErr) return next(asyncErr);

			let attributeList 		= 	(asyncResponse.attribute_list)		?	asyncResponse.attribute_list 	:[];
			let deliveryMethodList	=	(asyncResponse.delivery_methods)	?	asyncResponse.delivery_methods	:[];
			let restaurantDetails	=	(asyncResponse.restaurant_details)	?	asyncResponse.restaurant_details:{};

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

			/** Redirect area settings page */
			res.render('branch_area_settings',{
				layout	 		:	false,
				attribute_list	:	attributeList,
				restaurant_details : restaurantDetails
			});
		});
	};//End getBranchAreaSettings()

	/**
	 * Function to save branch  area open/ close status
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async updateBranchAreaStatus (req,res,next){
		let branchId 	=	(req.params.id) 	? 	req.params.id		:"";
		let slug		= 	(req.params.slug)	? 	req.params.slug		:"";
		let areaIds		= 	(req.body.area_id)	?	req.body.area_id 	:"";
		let status		= 	(req.body.status)	?	req.body.status 	:"";
		let authUserId	=	(req.session.user && req.session.user._id) ? req.session.user._id :"";

		/** Send error response */
		if(!areaIds) return res.send({status: Constants.STATUS_ERROR, message: res.__("branch_area.please_select_atleast_one_area")});

		/** Get restaurant id **/
		let restaurantId = await getRestaurantId(req,res,next,{slug:slug});

		/** If areaIds is not array */
		if(areaIds.constructor !== Array) areaIds = [areaIds];

		/** Convert into object id */
		areaIds = arrayToObject(areaIds);

		let updatedStatus = (status == Constants.OPEN) ? Constants.OPEN :Constants.CLOSE;

		/** Update restaurant branch area  */
		const restaurant_branch_areas = this.db.collection(Tables.RESTAURANT_BRANCH_AREAS);
		restaurant_branch_areas.updateMany({
			area_id 		: 	{$in : areaIds},
			restaurant_id	: 	new ObjectId(restaurantId),
			branch_id	  	: 	new ObjectId(branchId),
		},
		{$set :{
			open 	:	updatedStatus,
			modified: 	getUtcDate()
		}}).then(()=>{

			/** Send success response **/
			res.send({
				status : Constants.STATUS_SUCCESS,
				message: res.__("branch_area.area_status_has_been_updated_successfully")
			});

			/** Save user activities **/
			saveUserActivity(req,res,{
				user_id 		:	authUserId,
				parent_type 	:	Tables.RESTAURANT_BRANCH_AREAS,
				parent_id 		: 	areaIds,
				activity_type	:	Constants.ACTIVITY_UPDATE_STATUS,
				additional_details:	{restaurant_id: new ObjectId(restaurantId), branch_id: new ObjectId(branchId), open :updatedStatus,channel_id	: req.session.user.channel_id },
			});
		}).catch(next);
	};//End updateBranchAreaStatus()
}
export default BranchArea;
