import { ObjectId } from 'mongodb';
import { parallel as asyncParallel, each as asyncEach } from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import {isPost, sanitizeData, getUtcDate, configDatatable, getDropdownList, getRestaurantId, getRestaurantDetails, arrayToObject, isAdmin} from '../../../../utils/index.mjs';
import {saveSystemLogs} from '../../../../services/index.mjs';

export default class PendingChoiceGroup{
    constructor(db){
        this.db = db;
    }

	/**
	 * Function to get pending choice group list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	*/
	async pendingChoiceGroupList (req,res,next){
		try{
			let slug 	= req.params.slug ;
			let itemId  = new ObjectId(req.params.item_id);

			if(isPost(req)){
				let limit		 =	(req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
				let skip		 = 	(req.body.start)  ? parseInt(req.body.start)  : Constants.DEFAULT_SKIP;
				const collection = 	this.db.collection(Tables.TMP_ITEM_CHOICE_GROUPS);

				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);

				/**Set variable for commonconditions */
				let commonConditions = { item_id: itemId};

				/** assign in a single object */
				dataTableConfig.conditions = Object.assign(commonConditions, dataTableConfig.conditions);

				// Get list or count of items 
				let dbRes = await collection.aggregate([
					{$match: dataTableConfig.conditions },
					{$facet : {
						list : [
							{$sort: dataTableConfig.sort_conditions },
							{$skip: skip },
							{$limit: limit },
							{$lookup	: {
								from		 : Tables.ITEM_UNITS_MASTERS,
								localField	 : "item_unit_id",
								foreignField : "_id",
								as			 : "item_units_masters_details",
							}},
							{$project: {
								_id:1,name:1,min_quantity:1,max_quantity:1,item_unit_id:1,item_id:1,order:1,
								item_unit: { $arrayElemAt: ["$item_units_masters_details.name."+Constants.DEFAULT_LANGUAGE_CODE,0]}
							}}
						],
						count: [
							{$count: "count"},
						],
					}}
				]).toArray();

				/** Send response **/
				res.send({
					status			: Constants.STATUS_SUCCESS,
					draw			: dataTableConfig.result_draw,
					data			: dbRes?.list || [],
					recordsFiltered	: dbRes?.count?.[0]?.count || 0,
					recordsTotal	: dbRes?.count?.[0]?.count || 0
				});
			}else{
				asyncParallel({
					pending_item_result:(callback)=>{
						/**Get details from tmp items */
						const tmp_items = this.db.collection(Tables.TMP_ITEMS);
						tmp_items.findOne({_id : itemId},{projection:{_id:1,name:1,status:1,reject_reason:1,item_id:1}}).then(itemResult=>{
							callback(null,itemResult);
						}).catch(next);
					},
					restaurant_detail:(callback)=>{
						/**For get restaurant detail */
						getRestaurantDetails(req,res,next,{slug:slug}).then(restaurantResponse=>{
							if(restaurantResponse.status != Constants.STATUS_SUCCESS) return callback(restaurantResponse);
							callback(null,restaurantResponse);
						}).catch(next);
					},
					pending_item_units_detail:(callback)=>{
						/**Get tmp item units detail */
						const tmp_item_units = this.db.collection(Tables.TMP_ITEM_UNITS);
						tmp_item_units.distinct( "item_unit_id",{item_id : itemId}).then(itemUnitResult=>{
							callback(null,itemUnitResult);
						}).catch(next);
					}
				},async (asyncErr,asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					/**Check for item result */
					if(!asyncResponse.pending_item_result){
						return res.status(400).send({
							status  : STATUS_ERROR,
							message : res.__("system.something_going_wrong_please_try_again")
						});
					}

					/**For get item units masters list */
					let dropDownResponse = await getDropdownList(req,res,next,{
						collections :[{
							collection : Tables.ITEM_UNITS_MASTERS,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions : { _id : {$in : asyncResponse.pending_item_units_detail}}
						}]
					});

					if(dropDownResponse.status != Constants.STATUS_SUCCESS) {
						return res.status(400).send({
							status  : Constants.STATUS_ERROR,
							message : res.__("system.something_going_wrong_please_try_again")
						});
					}

					/** Render pending choice group list  page */
					res.render("choice_group/pending_choice_group_list",{
						item_detail 	  : asyncResponse.pending_item_result,
						restaurant_detail : asyncResponse.restaurant_detail.result,
						item_unit_list    : dropDownResponse?.final_html_data?.[0] || "",
						item_id			  : itemId,
						layout 			  : false,
						slug              : slug
					});
				});
			}			
		}catch(e){
			return next(e);
		}		
	};//End pendingChoiceGroupList()

	/**
	 * Function to get pending choice group detail
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return json
	*/
	async getPendingChoiceGroupDetails (req, res, next){
		try{
			/** Get choice group details **/
			const tmp_item_choices_groups = this.db.collection(Tables.TMP_ITEM_CHOICE_GROUPS);
			let choiceGroupResult = await tmp_item_choices_groups.findOne({
				_id  	 : new ObjectId(req.params.id),
				item_id  : new ObjectId(req.params.item_id)
			},{projection: {_id:1,name:1,description:1,min_quantity:1,max_quantity:1,item_unit_id:1,order:1 }});
				
			/** Send error response */
			if(!choiceGroupResult) return {status: Constants.STATUS_ERROR, message : res.__("system.invalid_access")};

			/**Send success response */
			return {status: Constants.STATUS_SUCCESS, result: choiceGroupResult};
		}catch(e){
			return next(e);
		}
	};// End getPendingChoiceGroupDetails()

	/**
	 * Function for add/edit pending choice group
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async addEditpendingChoiceGroup (req, res,next){
		try{
			let slug 				 = req.params.slug;
			let isEditable			 = (req.params.id) 	?	true :false;
			let pendingChoiceGroupId = (req.params.id) 	?	new ObjectId(req.params.id) :new ObjectId();
			let itemId 				 = ObjectId(req.params.item_id);

			if(isPost(req)){
				/** Sanitize Data **/
				req.body  =	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
				let groupNameEnglish	 = (req.body.group_name_english)	? req.body.group_name_english   : "";
				let groupNameArabic 	 = (req.body.group_name_arabic)	    ? req.body.group_name_arabic	: "";
				let groupMinQuantity     = (req.body.group_min_quantity)	? parseInt(req.body.group_min_quantity)	: "";
				let groupMaxQuantity     = (req.body.group_max_quantity)	? parseInt(req.body.group_max_quantity)	: "";
								
				/** Get restaurant id */
				let restaurantId = await getRestaurantId(req,res,next,{slug:slug});

				/**Set variable for update data */
				let updateData = {
					name : {
						ar : groupNameArabic,
						en : groupNameEnglish
					},
					description : {
						ar : req.body.group_description_in_arabic  ? req.body.group_description_in_arabic :"",
						en : req.body.group_description_in_english ? req.body.group_description_in_english:""
					},
					item_unit_id 	: (req.body.item_unit_id) 	? new ObjectId(req.body.item_unit_id) : "",
					order 			: (req.body.order) 			? parseInt(req.body.order)		  :0,
					min_quantity  	: groupMinQuantity,
					max_quantity  	: groupMaxQuantity,
					modified   		: getUtcDate()
				};

				/** For update pending choice group **/
				const tmp_item_choices_groups	= this.db.collection(Tables.TMP_ITEM_CHOICE_GROUPS);	
				await tmp_item_choices_groups.updateOne({
					_id 	: pendingChoiceGroupId,
					item_id : itemId
				},{
					$set: updateData,
					$setOnInsert: {
						restaurant_id : new ObjectId(restaurantId),
						item_id 	  : itemId,
						created  	  : getUtcDate()
					}
				},{upsert: true});

				/**success response  message**/
				let isAdminUser	= isAdmin(req,res);
				let addMessage	= (isAdminUser) ? res.__("choice_group.choice_group_has_been_added_successfully")   : res.__("choice_group.pending_choice_group_has_been_added_and_send_for_approval");
				let message		= (isEditable)  ? res.__("choice_group.choice_group_has_been_updated_successfully") : addMessage;

				/**Send success response */
				if(!isEditable) req.flash(Constants.STATUS_SUCCESS,message);
				res.send({status: Constants.STATUS_SUCCESS, message: message});

				/** Save System logs */
				saveSystemLogs(req, res, {
					user_id				: new ObjectId(req.session.user._id),
					parent_type 		: Tables.ITEM_CHOICE_GROUPS,
					parent_id 			: pendingChoiceGroupId,
					activity_type		: Constants.ACTIVITY_ADD_EDIT_DETAILS,
					additional_details	: {}
				}).then(()=>{ });
			}else{
				let choiceDetails = {};
				if(isEditable){
					let choiceResponse = await this.getPendingChoiceGroupDetails(req,res,next);
					
					/** Send error response */
					if(choiceResponse.status != Constants.STATUS_SUCCESS) return res.status(400).send(choiceResponse);

					choiceDetails = choiceResponse?.result || {};
				}

				/**Get item units detail */
				const itemUnits = this.db.collection(Tables.TMP_ITEM_UNITS);
				let itemUnitResult = await itemUnits.distinct( "item_unit_id",{item_id : itemId });

				/**For get item units masters list */
				let dropDownResponse = await getDropdownList(req,res,next,{
					collections :[{
						collection : Tables.ITEM_UNITS_MASTERS,
						columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
						selected   : (isEditable) ? [choiceDetails?.item_unit_id || ""] : [],
						conditions : { _id : {$in : itemUnitResult}}
					}]
				});

				/** Send error response */
				if(dropDownResponse.status != Constants.STATUS_SUCCESS)  return res.status(400).send(dropDownResponse);
				
				/** Render add choice group page **/
				res.render('choice_group/add_edit_pending_choice_group',{
					layout		   			: false,
					item_unit_list 			: dropDownResponse?.final_html_data?.[0] || "",
					result		   			: choiceDetails,
					pending_choice_group_id : pendingChoiceGroupId,
					is_editable				: isEditable
				});
			}			
		}catch(e){
			return next(e);
		}
		
	};//End addEditpendingChoiceGroup()

	/**
	 * Function for add pending extra item in pending choice group
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async addPendingExtraItemChoiceGroup (req, res, next){
		let flag 		  = req?.query?.flag || false;
		let itemId 		  = new ObjectId(req.params.item_id);
		let choiceGroupId = new ObjectId(req.params.id);
		let restaurantSlug= req.params.slug;

		if(isPost(req)){
			/** Sanitize Data **/
			req.body 		 = sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let extraItemIds = (req.body.extra_item_id) ? req.body.extra_item_id : [];

			/** Check validation **/
			if (extraItemIds.length == 0 || !Array.isArray(extraItemIds)) {
				return res.send({
					status: Constants.STATUS_ERROR, 
					message: [{ 'param': "extra_item_id", 'msg': res.__("choice_group.please_select_atleast_one_extra_item")}]
				});
			}

			/** Get item group extras details **/
			const tmp_item_group_extras = this.db.collection(Tables.TMP_ITEM_GROUP_EXTRAS);
			let findResult = await tmp_item_group_extras.findOne({group_id: choiceGroupId},{projection: {item_extra_id:1}});

			let selectedExtraItemId = 	(findResult && findResult.item_extra_id) ? findResult.item_extra_id :[];
			let newExtraItemId 		=	[];
			let matchAnyExtraItem	=	false;
			if(selectedExtraItemId.length > 0){
				extraItemIds.map(key=>{
					if(selectedExtraItemId.indexOf(key) == -1){
						newExtraItemId.push(key);
					}
					if(selectedExtraItemId.indexOf(key) != -1){
						matchAnyExtraItem = true;
					}
				});
			}else{
				newExtraItemId = extraItemIds;
			}

			/** Send error response */
			if(!matchAnyExtraItem && !isAdmin(req,res) && selectedExtraItemId.length > 0){
				return res.send({ status: Constants.STATUS_ERROR, message: res.__("choice_group.you_cannot_remove_all_approved_extra_items") });
			}

			/** Get restaurant id */
			let restaurantId = await getRestaurantId(req,res,next,{slug:restaurantSlug});

			let extraItemObject = arrayToObject(extraItemIds);

			asyncParallel({
				choice_group_details: (callback)=>{
					/** Get choice group details */
					const tmp_item_choices_groups = this.db.collection(Tables.TMP_ITEM_CHOICE_GROUPS);
					tmp_item_choices_groups.findOne({_id : choiceGroupId},{$projection:{item_unit_id:1}}).then(choiceResult=>{
						callback(null,choiceResult);
					}).catch(next);
				},
				extra_items_details: (callback)=>{
					/** Get extra items details */
					const tmp_item_extra_masters = this.db.collection(Tables.TMP_ITEM_EXTRA_MASTERS);
					tmp_item_extra_masters.find({_id : {$in :extraItemObject}},{$projection:{_id:1,extra_fees:1,min_quantity:1,max_quantity:1}}).toArray().then(extraItemResult=>{
						callback(null,extraItemResult);
					}).catch(next);
				}
			},async (err, response)=>{
				if(err) return next(err);

				let extraItemsDetails  = response.extra_items_details;
				let choiceGroupDetails = response.choice_group_details;
				let itemUnitId         = choiceGroupDetails?.item_unit_id || "";
				
				const collection = this.db.collection(Tables.TMP_ITEM_GROUP_EXTRAS);
				/** Delete unchecked data */
				await collection.deleteMany({ item_id: itemId, unit_id : itemUnitId, group_id : choiceGroupId, item_extra_id: { $nin: extraItemObject}});

				/** Set updated data */
				let updatedData = 	extraItemsDetails.map(records=>{
					return { updateOne : {
						"filter": {
							item_id		: itemId,
							group_id	: choiceGroupId,
							unit_id 	: itemUnitId,
							item_extra_id : new ObjectId(records._id),
						},
						"update": {
								$set: {
									status	: Constants.PENDING,
									user_id	: new ObjectId(req.session.user._id),
									extra_fees: records.extra_fees,
									modified  : getUtcDate()
								},
								$setOnInsert: {
									created 	    : getUtcDate(),
									restaurant_id   : restaurantId,
									restaurant_slug : restaurantSlug
								}
							},
						"upsert": true
					}};
				});

				/** for Save new select extra items **/
				await collection.bulkWrite(updatedData);

				/** Send success response */
				req.flash(Constants.STATUS_SUCCESS,res.__("choice_group.extras_has_been_added_successfully"));
				res.send({
					status : Constants.STATUS_SUCCESS,
					message: res.__("choice_group.extras_has_been_added_successfully")
				});
			});
		}else{
			asyncParallel({
				item_unit_id: (callback)=>{
					/**Get item units detail */
					const tmp_item_units = this.db.collection(Tables.TMP_ITEM_UNITS);
					tmp_item_units.distinct( "item_unit_id",{item_id : itemId}).then(itemUnitResult=>{
						/** Include those extras which unit item is blank */
						itemUnitResult.push("");
						callback(null,itemUnitResult);
					}).catch(next);
				},
				selected_extra_items: (callback)=>{
					/** for get selected extra items **/
					const tmp_item_group_extras = this.db.collection(Tables.TMP_ITEM_GROUP_EXTRAS);
					tmp_item_group_extras.find({item_id:itemId,group_id:choiceGroupId}, { projection: { _id: 1,item_extra_id: 1 }}).toArray().then(selectedResult=>{
						callback(null, selectedResult);
					}).catch(next);
				},
				item_detail: (callback)=>{
					/** Get item group extras details **/
					const tmp_items = this.db.collection(Tables.TMP_ITEMS);
					tmp_items.findOne({_id: itemId},{projection: {status:1}}).then(itemResult=>{
						callback(null,itemResult);
					}).catch(next);
				},
				extra_list: (callback)=>{
					/** Get item extra list **/
					const item_extra_masters = this.db.collection(Tables.TMP_ITEM_EXTRA_MASTERS);
					item_extra_masters.aggregate([
						{$match :{item_id: itemId}},
						{$sort	: {"item_unit_id":Constants.SORT_ASC, "name":Constants.SORT_ASC}},
						{$lookup: {
							from		 : Tables.ITEM_UNITS_MASTERS,
							localField	 : "item_unit_id",
							foreignField : "_id",
							as			 : "item_units_masters_details",
						}},
						{ $project	: { _id: 1, name: 1, item_unit: { $arrayElemAt: ["$item_units_masters_details.name."+Constants.DEFAULT_LANGUAGE_CODE, 0] }}},
					]).toArray().then(findResult=>{
						callback(null,findResult);
					}).catch(next);
				},
			},(err, response)=>{
				if(err){
					/** Send error response **/
					return res.status(400).send({
						status  : Constants.STATUS_ERROR,
						message : res.__("system.something_going_wrong_please_try_again")
					});
				}

				/** Render add pending extra items in choice group page  **/
				res.render('choice_group/select_pending_extra_item', {
					layout			 	 : false,
					extra_items_list 	 : response.extra_list,
					choice_group_id  	 : choiceGroupId,
					selected_extra_items : response.selected_extra_items,
					flag				 : flag,
					item_detail			 : response.item_detail
				});
			});
		}
	};//End addPendingExtraItemChoiceGroup()

	/**
	 * Function for delete pending choice group
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	*/
	async deletePendingChoiceGroup (req, res, next){
		try{
			let groupId = new ObjectId(req.params.id);
			let itemId = new ObjectId(req.params.item_id);

			/** Count records if group id exists in item group extras **/
			const tmp_item_group_extras = this.db.collection(Tables.TMP_ITEM_GROUP_EXTRAS);
			let countResult = await tmp_item_group_extras.countDocuments({group_id: groupId, item_id: itemId});

			/** Send error response **/
			if(countResult > 0){
				req.flash(Constants.STATUS_ERROR, res.__("choice_group.you_cannot_delete_this_choice_group"));
				return res.redirect(res.locals.base_url+"pending_choice_group/"+itemId);
			}

			/**For delete item choices groups */
			const tmp_item_choices_groups = this.db.collection(Tables.TMP_ITEM_CHOICE_GROUPS);
			await tmp_item_choices_groups.deleteOne({_id: groupId,item_id : itemId});

			/** Send success response **/
			req.flash(Constants.STATUS_SUCCESS,res.__("choice_group.choice_group_deleted_successfully"));
			res.redirect(res.locals.base_url+"pending_choice_group/"+itemId);

			/** save System logs */
			saveSystemLogs(req, res, {
				user_id				: new ObjectId(req.session.user._id),
				parent_id			: groupId,
				parent_type 		: Tables.ITEM_CHOICE_GROUPS,
				activity_type		: Constants.ACTIVITY_TYPE_DELETE,
				additional_details	: {item_id : itemId}
			}).then(()=>{ });			
		}catch(e){
			return next(e);
		}

		
	};//End deletePendingChoiceGroup()
}
