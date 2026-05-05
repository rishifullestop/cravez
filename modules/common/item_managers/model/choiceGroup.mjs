import { ObjectId } from 'mongodb';
import { parallel as asyncParallel, each as asyncEach } from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import {isPost, sanitizeData, getUtcDate, configDatatable, getDropdownList, getRestaurantId, getRestaurantDetails, arrayToObject, isAdmin} from '../../../../utils/index.mjs';
import {saveSystemLogs} from '../../../../services/index.mjs';
import itemModule from './item.mjs';
import extraItemModule from './extraItems.mjs';

export default class ChoiceGroup{
    constructor(db){
        this.db = db;
		this.itemModel = new itemModule(db);
		this.extraItemitemModel = new extraItemModule(db);		
    }

	/**
     * Function to get choice group list
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
    */
    async getChoiceGroupList (req,res,next){
		try{
			let slug 	= req.params.slug ;
			let itemId  = new ObjectId(req.params.item_id);
	
			if(isPost(req)){
				let limit		 =	(req.body.length) ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
				let skip		 = 	(req.body.start)  ? parseInt(req.body.start)  : DEFAULT_SKIP;
				const collection = 	this.db.collection(Tables.ITEM_CHOICES_GROUPS);
	
				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);
				let commonConditions = { item_id : itemId };

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
					data			: dbRes?.[0]?.list || [],
					recordsFiltered	: dbRes?.[0]?.count?.[0]?.count || 0,
					recordsTotal	: dbRes?.[0]?.count?.[0]?.count || 0
				});
			}else{
				asyncParallel({
					item_result:(callback)=>{
						/**Get details from items */
						const items = this.db.collection(Tables.ITEMS);
						items.findOne({_id : itemId},{projection:{_id:1,name:1,status:1,item_id:1}}).then(itemResult=>{
							callback(null,itemResult);
						}).catch(next);
					},
					restaurant_detail:(callback)=>{
						/**For get restaurant detail */
						getRestaurantDetails(req,res,next,{slug:slug}).then((restaurantResponse)=>{
							if(restaurantResponse.status != Constants.STATUS_SUCCESS) return callback(restaurantResponse);
							callback(null,restaurantResponse);
						}).catch(next);
					},
					item_units_detail:(callback)=>{
						/**Get item units detail */
						const item_units = this.db.collection(Tables.ITEM_UNITS);
						item_units.distinct( "item_unit_id",{item_id : itemId}).then(itemUnitResult=>{
							callback(null,itemUnitResult);
						}).catch(next);
					}
				},async (asyncErr,asyncResponse)=>{
					if(asyncErr) return next(asyncErr);
	
					/**Check for item result */
					if(!asyncResponse.item_result){
						return res.status(400).send({
							status  : Constants.STATUS_ERROR,
							message : res.__("system.something_going_wrong_please_try_again")
						});
					}
	
					/**For get item units masters list */
					let dropdownResponse = await getDropdownList(req,res,next,{
						collections :[{
							collection : Tables.ITEM_UNITS_MASTERS,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions : { _id : {$in : asyncResponse.item_units_detail}}
						}]
					});

					if(dropdownResponse.status != Constants.STATUS_SUCCESS) {
						return res.status(400).send({
							status  : Constants.STATUS_ERROR,
							message : res.__("system.something_going_wrong_please_try_again")
						});
					}
					
					/** Render choice group list  page */
					res.render("choice_group/choice_group_list",{
						item_result 	  : asyncResponse.item_result,
						restaurant_detail : asyncResponse.restaurant_detail.result,
						item_unit_list    : dropdownResponse?.final_html_data?.[0] || "",
						item_id			  : itemId,
						layout 			  : false,
						slug              : slug
					});					
				});
			}
		}catch(e){
			return next(e);
		}
	};//End getChoiceGroupList()	

    /**
	 * Function to get choice group detail
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return json
	*/
	async getChoiceGroupDetails (req, res, next){
		try{
			/** Get choice group details **/
			const item_choices_groups = this.db.collection(Tables.ITEM_CHOICES_GROUPS);
			let choiceGroupResult = await item_choices_groups.findOne({
				_id  	 : new 	ObjectId( req?.params?.cloneId || req.params.id),
				item_id  : new ObjectId(req.params.item_id)
			},{projection: {_id:1,name:1,description:1,min_quantity:1,max_quantity:1,item_unit_id:1,order:1 }});
				
			/** Send error response */
			if(!choiceGroupResult) return {status: Constants.STATUS_ERROR, message : res.__("system.invalid_access")};

			/**Send success response */
			return {status: Constants.STATUS_SUCCESS, result: choiceGroupResult};
		}catch(e){
			return next(e);
		}
	};// End getChoiceGroupDetails()

    /**
	 * Function for add or update choice group
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async addEditChoiceGroup (req, res,next){
		try{
			let slug 			= req.params.slug;
			let isEditable		= (req.params.id) ?	true :false;
			let choiceGroupId	= (req.params.id) ?	new ObjectId(req.params.id) :new ObjectId();
			let itemId 			= new ObjectId(req.params.item_id);

			if(isPost(req)){
				/** Sanitize Data **/
				req.body =	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);				
				let groupNameEnglish = (req.body.group_name_english) ? req.body.group_name_english   	     : "";
				let groupNameArabic  = (req.body.group_name_arabic)	 ? req.body.group_name_arabic	         : "";
				let groupMinQuantity = (req.body.group_min_quantity) ? parseInt(req.body.group_min_quantity) : "";
				let groupMaxQuantity = (req.body.group_max_quantity) ? parseInt(req.body.group_max_quantity) : "";
								
				/** Get restaurant id */
				let restaurantId = await getRestaurantId(req,res,next,{slug:slug});

				/**Set variable for save and update data */
				let updateData = {
					name : {
						ar : groupNameArabic,
						en : groupNameEnglish
					},
					description : {
						ar : req?.body?.group_description_in_arabic  ||"",
						en : req?.body?.group_description_in_english ||""
					},
					item_unit_id 	: (req.body.item_unit_id) ? new ObjectId(req.body.item_unit_id)	:"",
					order 			: (req.body.order) 		  ? parseInt(req.body.order)		:0,
					min_quantity  	: groupMinQuantity,
					max_quantity  	: groupMaxQuantity,
					modified   		: getUtcDate()
				};

				let collection	= this.db.collection(Tables.ITEM_CHOICES_GROUPS);
				if(!isAdmin(req,res)){
					updateData.status	= Constants.PENDING;
					updateData.user_id	= new ObjectId(req.session.user._id);
					collection 			= this.db.collection(Tables.TMP_ITEM_CHOICES_GROUPS);
				}

				/** save details */
				await collection.updateOne({
					_id : choiceGroupId
				},
				{
					$set : updateData ,
					$setOnInsert: {
						restaurant_id : new ObjectId(restaurantId),
						item_id 	  : itemId,
						created  	  : getUtcDate()
					}
				},{upsert: true});

				/**success response  message**/
				let isAdminUser		= isAdmin(req,res);
				let updateMessage	= (isAdminUser) ? res.__("choice_group.choice_group_has_been_updated_successfully") : res.__("choice_group.choice_group_has_been_updated_and_send_for_approval");
				let addMessage		= (isAdminUser) ? res.__("choice_group.choice_group_has_been_added_successfully") : res.__("choice_group.choice_group_has_been_added_and_send_for_approval");
				let message			= (isEditable)  ? updateMessage :addMessage;

				/** success response*/
				if(!isEditable) req.flash(Constants.STATUS_SUCCESS,message);
				res.send({status: Constants.STATUS_SUCCESS, message: message});

				if(!isAdmin(req,res)){
					/** Copy data  tmp_item_choice_groups to item_choice_groups collections */
					await this.itemModel.copyItemToPending(req,res,next);
				}

				/** Save system logs **/
				saveSystemLogs(req,res,{
					user_id 		:	new ObjectId(req.session.user._id),
					parent_type 	:	Tables.ITEM_CHOICES_GROUPS,
					parent_id 		: 	choiceGroupId,
					activity_type	:	Constants.ACTIVITY_ADD_EDIT_DETAILS,
					additional_details:	{restaurant_slug: slug,channel_id : req.session.user.channel_id}
				}).then(()=>{});
			}else{
				let choiceDetails = {};
				if(isEditable){
					let choiceResponse = await this.getChoiceGroupDetails(req,res,next);
					/** Send error response */
					if(choiceResponse.status != Constants.STATUS_SUCCESS) return res.status(400).send(choiceResponse);

					choiceDetails = choiceResponse?.result || {};
				}

				/**Get item units detail */
				const item_units = this.db.collection(Tables.ITEM_UNITS);
				let itemUnitResult = await item_units.distinct( "item_unit_id",{item_id : itemId });		

				/**For get item units masters list */
				let dropDownResponse = await getDropdownList(req,res,next,{
					collections :[{
						collection : Tables.ITEM_UNITS_MASTERS,
						columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
						selected   : (isEditable) ? [choiceDetails?.item_unit_id || ""] : [],
						conditions : { _id : {$in : itemUnitResult}}
					}]
				});
				
				if(dropDownResponse.status != Constants.STATUS_SUCCESS) {
					return res.status(400).send({
						status  : Constants.STATUS_ERROR,
						message : res.__("system.something_going_wrong_please_try_again")
					});
				}

				/** Render add choice group page **/
				res.render('choice_group/add_choice_group',{
					layout		   : false,
					item_unit_list : dropDownResponse?.final_html_data?.[0] || "",
					result		   : choiceDetails,
					is_editable	   : isEditable,
				});
			}
		}catch(e){
			return next(e);
		}
	};//End addEditChoiceGroup()

	/**
	 * Function for delete choice group
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	*/
	async deleteChoiceGroup (req, res, next){
		try{
			let groupId = new ObjectId(req.params.id);
			let itemId = new ObjectId(req.params.item_id);

			/** Count records if group id exists in item group extras **/
			let collection = this.db.collection(Tables.ITEM_GROUP_EXTRAS);
			if(!isAdmin(req,res)){
				collection 	= this.db.collection(Tables.TMP_ITEM_GROUP_EXTRAS);
			}
			
			let countResult = await collection.countDocuments({group_id: groupId, item_id: itemId});

			/** Send error response **/
			if(countResult > 0){
				req.flash(Constants.STATUS_ERROR, res.__("choice_group.you_cannot_delete_this_choice_group"));
				return res.redirect(res.locals.base_url+"choice_group/"+itemId);
			}

			/**For delete item choices groups */
			const item_choices_groups = this.db.collection(Tables.ITEM_CHOICES_GROUPS);
			await item_choices_groups.deleteOne({_id : groupId, item_id : itemId});

			/** Send success response **/
			req.flash(Constants.STATUS_SUCCESS,res.__("choice_group.choice_group_deleted_successfully"));
			res.redirect(res.locals.base_url+"choice_group/"+itemId);

			/** save System logs */
			saveSystemLogs(req, res, {
				user_id				: new ObjectId(req.session.user._id),
				parent_id			: groupId,
				activity_module		: Constants.SYSTEM_LOG_MODULE_CHOICE_GROUP,
				activity_type		: Constants.ACTIVITY_TYPE_DELETE,
				additional_details	: {item_id : itemId}
			}).then(()=>{ });
		}catch(e){
			return next(e);
		}		
	};//End deleteChoiceGroup()
	
	/**
	* Function for add extra item in choice group
	*
	* @param req 	As Request Data
	* @param res 	As Response Data
	* @param next 	As Callback argument to the middleware function
	*
	* @return render/json
	*/
	async addExtraItemChoiceGroup (req, res, next){
		try{
			let choiceGroupId = new ObjectId(req.params.id);
			let itemId 		  = new ObjectId(req.params.item_id);
			let flag 		  = req?.query?.flag || false;
			let restaurantSlug= req?.params?.slug || "";
	
			if(isPost(req)){
				/** Sanitize Data **/
				req.body 		 = sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
				let extraItemIds = (req.body.extra_item_id) ? req.body.extra_item_id : [];
	
				/** Check validation **/
				if(extraItemIds.length == 0 || !Array.isArray(extraItemIds)) {
					return res.send({
						status: Constants.STATUS_ERROR, 
						message: [{param: "extra_item_id", 'msg': res.__("choice_group.please_select_atleast_one_extra_item")}]
					});
				}
	
				/** Get item group extras details **/
				const item_group_extras = this.db.collection(Tables.ITEM_GROUP_EXTRAS);
				let findResult = await item_group_extras.distinct("item_extra_id",{item_id: itemId, group_id: choiceGroupId});
	
				let newExtraItemIds		=	[];
				let matchAnyExtraItem	=	false;
				let selectedExtraItemIds=	[];

				findResult.forEach(findResultRecords=>{
					selectedExtraItemIds.push(String(findResultRecords));
				});
	
				if(selectedExtraItemIds.length > 0){
					extraItemIds.map(key=>{
						if(selectedExtraItemIds.indexOf(key) == -1){
							newExtraItemIds.push(new ObjectId(key));
						}

						if(selectedExtraItemIds.indexOf(key) != -1){
							matchAnyExtraItem = true;
						}
					});
				}else{
					newExtraItemIds = extraItemIds;
				}
	
				/** Send error response */
				if(!matchAnyExtraItem && !isAdmin(req,res) && selectedExtraItemIds.length > 0) return res.send({ 
					status: Constants.STATUS_ERROR, 
					message: res.__("choice_group.you_cannot_remove_all_approved_extra_items") 
				});

				/** Send error response */
				if(newExtraItemIds.length==0 && selectedExtraItemIds.length == newExtraItemIds.length) return res.send({ 
					status: Constants.STATUS_ERROR, 
					message: res.__("choice_group.you_have_not_update_any_item") 
				});

				/** Get restaurant id */
				let restaurantId = await getRestaurantId(req,res,next,{slug:restaurantSlug});
	
				let extraItemObject = arrayToObject(newExtraItemIds);
				asyncParallel({
					choice_group_details: (callback)=>{
						/** Get choice group details */
						const item_choices_groups = this.db.collection(Tables.ITEM_CHOICES_GROUPS);						
						item_choices_groups.findOne({_id : choiceGroupId},{$projection:{item_unit_id:1}}).then(choiceResult=>{
							callback(null,choiceResult);
						}).catch(next);
					},
					extra_items_details: (callback)=>{
						/** Get extra items details */
						const item_extra_masters = this.db.collection(Tables.ITEM_EXTRA_MASTERS);
						item_extra_masters.find({_id : {$in :extraItemObject}},{$projection:{_id:1,extra_fees:1,min_quantity:1,max_quantity:1}}).toArray().then(extraItemResult=>{
							callback(null,extraItemResult);
						}).catch(next);
					},
				},async (err, response)=>{
					if(err) return next(err);

					let extraItemsDetails  = response.extra_items_details;
					let choiceGroupDetails = response.choice_group_details;
					let itemUnitId         = choiceGroupDetails?.item_unit_id || "";
					
					let collection = this.db.collection(Tables.ITEM_GROUP_EXTRAS);
					if(!isAdmin(req,res)){
						collection 	= this.db.collection(Tables.TMP_ITEM_GROUP_EXTRAS);
					}

					/** delete unchecked data */
					await item_group_extras.deleteMany({ 
						item_id: itemId, 
						unit_id : itemUnitId, 
						group_id : choiceGroupId, 
						item_extra_id: { $nin: arrayToObject(extraItemIds)}
					});

					/** Set updated data */
					let updatedData = 	extraItemsDetails.map(records=>{
						return { updateOne : {
							"filter": {
								item_id			:	itemId,
								item_extra_id 	: 	new ObjectId(records._id),
								group_id		: 	choiceGroupId,
								unit_id 		: 	itemUnitId
							},
							"update": {
								$set: {
									extra_fees	: records.extra_fees,
									modified 	: getUtcDate()},
								$setOnInsert: {
									created 	    : getUtcDate(),
									restaurant_id   : restaurantId,
									restaurant_slug : restaurantSlug
								}
							},
							"upsert": true
						}};
					});

					if(!isAdmin(req,res)){
						updatedData.status	= Constants.PENDING;
						updatedData.user_id	= new ObjectId(req.session.user._id);
						collection 			= this.db.collection(Tables.TMP_ITEM_GROUP_EXTRAS);
					}

					if(newExtraItemIds.length > 0){
						/** for Save new select extra items **/
						await collection.bulkWrite(updatedData);
					}

					/** Success response  message**/
					let isAdminUser	  = isAdmin(req,res);
					let updateMessage = (isAdminUser) ? res.__("choice_group.extras_has_been_added_successfully") : res.__("choice_group.extras_has_been_added_and_send_for_approval");

					if(!isAdminUser && newExtraItemIds.length>0){

						/** Copy data tmp_item_choice_groups to item_choice_groups collections */
						await this.itemModel.copyItemToPending(req,res,next);

						/** Copy data from item_extra_masters to tmp_item_extra_masters collections */
						await copyFromParentTable(req,res,next,{
							parent_table	: {
								name 			: Tables.ITEM_EXTRA_MASTERS,
								fields 			: {modified: 0},
								conditions 		: {item_id: itemId,_id: { $in: extraItemObject }}
							},
							child_table 			: {
								name 				: Tables.TMP_ITEM_EXTRA_MASTERS,
								conditions			: {item_id: itemId,_id: { $in: extraItemObject } },
								additional_fields 	: {modified: getUtcDate()},
								multiple			: true,
							}
						});

						/** Copy data from item_choices_groups to tmp_item_choices_groups collections */
						await copyFromParentTable(req,res,next,{
							parent_table	: {
								name 			: Tables.ITEM_CHOICES_GROUPS,
								fields 			: {modified: 0},
								conditions 		: {item_id: itemId,_id: choiceGroupId}
							},
							child_table 	: {
								name 				: Tables.TMP_ITEM_CHOICES_GROUPS,
								conditions			: {item_id: itemId,_id: choiceGroupId },
								additional_fields 	: {modified: getUtcDate()},
							}
						});
					}

					if(!isAdminUser && newExtraItemIds.length == 0) updateMessage = res.__("choice_group.extras_has_been_added_successfully");

					/** Send success response */
					req.flash(Constants.STATUS_SUCCESS,updateMessage);
					res.send({status : Constants.STATUS_SUCCESS, message: updateMessage});
				});
			}else{
				asyncParallel({
					item_unit_id: (callback)=>{
						/**Get item units detail */
						const item_units = this.db.collection(Tables.ITEM_UNITS);
						item_units.distinct( "item_unit_id",{item_id : itemId}).then(itemUnitResult=>{
							/** Include those extras which unit item is blank */
							itemUnitResult.push("");
							callback(null,itemUnitResult);
						}).catch(next);
					},
					selected_extra_items: (callback)=>{
						let groupConditions = {item_id : itemId,group_id:choiceGroupId};

						/** for get selected extra items **/
						const item_group_extras = this.db.collection(Tables.ITEM_GROUP_EXTRAS);
						item_group_extras.find(groupConditions, { projection: { _id: 1,item_extra_id: 1 }}).toArray().then(selectedResult=>{
							callback(null, selectedResult);
						}).catch(next);
					},
					item_detail: (callback)=>{
						/** Get item details **/
						const items = this.db.collection(Tables.ITEMS);
						items.findOne({_id: itemId},{projection: {status:1}}).then(itemResult=>{
							callback(null,itemResult);
						}).catch(next);
					},
					extra_list: (callback)=>{
						/** Get item extra list **/
						const item_extra_masters = this.db.collection(Tables.ITEM_EXTRA_MASTERS);
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
					}
				},(err, response)=>{
					if(err){
						/** Send error response **/
						return res.status(400).send({
							status  : Constants.STATUS_ERROR,
							message : res.__("system.something_going_wrong_please_try_again")
						});
					}				
						
					/** Render add extra items in choice group page  **/
					res.render('choice_group/select_extra_item', {
						layout			 	 : false,
						flag			     : flag,
						choice_group_id  	 : choiceGroupId,
						item_detail			 : response.item_detail,
						extra_items_list 	 : response.extra_list,
						selected_extra_items : response.selected_extra_items,
					});					
				});
			}			
		}catch(e){
			return next(e);
		}		
	};//End addExtraItemChoiceGroup()

	/**
	 * Function to clone choice group
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async cloneChoiceGroup (req,res,next){
		try{
			let choiceGroupId	=	new ObjectId(req.params.cloneId);
			let mainItemId 		=	new ObjectId(req.params.item_id);
			let restaurantSlug 	=	req?.params?.slug || "";

			if(isPost(req)){
				/** Sanitize Data **/
				req.body 	=	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
				let itemIds	=	(req.body.item_id)	?	req.body.item_id	:"";
				let minQuantity = (req.body.group_min_quantity) ? parseInt(req.body.group_min_quantity) :0;
				let maxQuantity = (req.body.group_max_quantity) ? parseInt(req.body.group_max_quantity) :0;				

				let collection					= 	this.db.collection(Tables.ITEM_CHOICES_GROUPS);
				let itemExtraMastersCollection	= 	this.db.collection(Tables.ITEM_EXTRA_MASTERS);
				let itemGroupExtrasCollection  	=	this.db.collection(Tables.ITEM_GROUP_EXTRAS);

				/** Get restaurant id */
				let restaurantId = await getRestaurantId(req,res,next,{slug:restaurantSlug});

				asyncParallel({
					choice_group_details : (callback)=>{
						/** get choice group details **/
						collection.findOne({_id:choiceGroupId },{projection:{_id:0}}).then(groupDetails=>{
							callback(null,groupDetails);
						}).catch(next);
					},
					extra_item_list : (callback)=>{
						/** Get item group extras details **/
						itemGroupExtrasCollection.aggregate([
							{$match: {
								group_id : choiceGroupId
							}},
							{$lookup	: {
								from		 : Tables.ITEM_EXTRA_MASTERS,
								localField	 : "item_extra_id",
								foreignField : "_id",
								as			 : "extra_list",
							}},
							{$group: {
								_id : null,
								extra_item_list : {$push: {
									_id 		: 	{$arrayElemAt: ["$extra_list._id",0]},
									name 		: 	{$arrayElemAt: ["$extra_list.name",0]},
									extra_fees 	:	{$arrayElemAt: ["$extra_list.extra_fees",0]},
									is_active 	:	{$arrayElemAt: ["$extra_list.is_active",0]},
								}},
							}},
						]).toArray().then(extrasResult=>{
							callback(null,extrasResult?.[0]?.extra_item_list || []);
						}).catch(next);
					},
				},(asyncErr,asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					/** Send error response */
					if(!restaurantId || !asyncResponse.choice_group_details){
						return res.send({status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again")});
					}

					let choiceGroupDetails  = 	asyncResponse.choice_group_details;
					let itemExtraList  		=	asyncResponse.extra_item_list;
					let mainItemId   		=	choiceGroupDetails?.item_id || "";

					/**Set data in a object */
					let itemUnitId = (req.body.item_unit_id) ? new ObjectId(req.body.item_unit_id) :"";
					let updateData = {
						name : {
							en : req?.body?.group_name_english || "",
							ar : req?.body?.group_name_arabic || ""
						},
						description : {
							ar : req?.body?.description_in_arabic || "",
							en : req?.body?.description_in_english || ""
						},
						order 			:   parseInt(req?.body?.order || 0),
						min_quantity	: 	minQuantity,
						max_quantity	:	maxQuantity,
						item_unit_id  	:	itemUnitId,
						modified   	  	:	getUtcDate()
					};

					/** Change collection for restaurant */
					let isAdminUser	= isAdmin(req,res);
					if(!isAdminUser){
						updateData.status	= 	Constants.PENDING;
						updateData.user_id	= 	new ObjectId(req.session.user._id);
						collection 			=	this.db.collection(Tables.TMP_ITEM_CHOICES_GROUPS);
						itemExtraMastersCollection = this.db.collection(Tables.TMP_ITEM_EXTRA_MASTERS);
						itemGroupExtrasCollection  = this.db.collection(Tables.TMP_ITEM_GROUP_EXTRAS);
					}

					if(itemIds.constructor != Array) itemIds = [itemIds];
					itemIds = arrayToObject(itemIds);

					asyncEach(itemIds,(tmpItemId, eachCallback)=>{
						let tmpGroupId = new ObjectId();

						/** Save group details */
						collection.updateOne({
							_id : 	tmpGroupId
						},
						{
							$set : updateData,
							$setOnInsert: {
								restaurant_id	: 	new ObjectId(restaurantId),
								item_id 		: 	tmpItemId,
								created  		:	getUtcDate()
							}
						},{upsert: true}).then(()=> {

							/** Save system logs */
							saveSystemLogs(req, res, {
								user_id				: req.session.user._id,
								parent_type 		: Tables.ITEM_CHOICES_GROUPS,
								parent_id 			: tmpGroupId,
								activity_type		: Constants.ACTIVITY_CLONE_DETAILS,
								additional_details	: {
									parent_extra_item 	: 	choiceGroupId,
									channel_id			:	req.session.user.channel_id
								}
							}).then(()=>{});

							/** Copy data  tmp_item_extra_masters to item_extra_masters collections */
							if(!isAdminUser){
								this.itemModel.copyItemToPending(req,res,next,{item_id: tmpItemId});
							}

							if(itemExtraList.length <=0) return eachCallback(err);

							asyncEach(itemExtraList,(records, childEachCallback)=>{
								asyncParallel({
									extra_item_id : (parallelCallback)=>{
										if(String(mainItemId) == String(tmpItemId)){
											return parallelCallback(null,records._id);
										}

										/**Set data in a object */
										let exUpdateData = {
											name 			: 	records.name,
											extra_fees	  	:	records.extra_fees,
											item_unit_id  	: 	itemUnitId,
											extra_unit_id 	: 	records.extra_unit_id,
											modified   	  	:	getUtcDate(),
											restaurant_id   : 	new ObjectId(restaurantId),
											item_id 		: 	tmpItemId,
											is_active		: 	Constants.ACTIVE,
											created  		: 	getUtcDate()
										};

										if(!isAdminUser){
											exUpdateData.status		= 	Constants.PENDING;
											exUpdateData.user_id	= 	new ObjectId(req.session.user._id);
										}

										itemExtraMastersCollection.insertOne(exUpdateData).then(exResult=>{
											let tmpExId = exResult?.insertedId || "";
											
											parallelCallback(null,tmpExId);

											saveSystemLogs(req, res, {
												user_id				: req.session.user._id,
												parent_type 		: Tables.ITEM_EXTRA_MASTERS,
												parent_id 			: tmpExId,
												activity_type		: Constants.ACTIVITY_CLONE_DETAILS,
												additional_details	: {
													choice_group_id	: 	choiceGroupId,
													item_id			: 	tmpItemId,
													channel_id		:	req.session.user.channel_id
												}
											}).then(()=>{});
										}).catch(next);
									}
								},(parallelErr,parallelResponse)=> {
									if(parallelErr) return childEachCallback(parallelErr);

									/**Set data in a object */
									let tmpExtraItemId = parallelResponse.extra_item_id;
									let groupExData = {
										extra_fees		: 	records.extra_fees,
										modified 		:	getUtcDate(),
									}

									if(!isAdminUser){
										groupExData.status	= Constants.PENDING;
										groupExData.user_id	= new ObjectId(req.session.user._id);
									}

									/** Update mapping of extra item and choice group  */
									itemGroupExtrasCollection.updateOne({
										group_id 		: 	tmpGroupId,
										item_id			:	tmpItemId,
										item_extra_id 	: 	tmpExtraItemId,
										unit_id 		: 	itemUnitId,
									},
									{
										$set : groupExData,
										$setOnInsert: {
											restaurant_id   : 	new ObjectId(restaurantId),
											restaurant_slug : 	restaurantSlug,
											created  		:	getUtcDate()
										}
									},{upsert: true}).then(()=> {
										childEachCallback(null);
									}).catch(next);
								});
							},(childEachErr)=>{
								eachCallback(childEachErr);
							});
						}).catch(next);
					},(eachErr)=>{
						if(eachErr) return next(eachErr);

						/** Set flash message**/
						let message	= (isAdminUser) ? res.__("choice_group.choice_group_has_been_cloned_successfully") :res.__("choice_group.choice_group_has_been_cloned_and_send_for_approval");
						/* send success response*/
						req.flash(Constants.STATUS_SUCCESS,message);
						res.send({status: Constants.STATUS_SUCCESS, message: message});
					});
				});
			}else{
				/** Get choice group details */
				let groupResponse = await this.getChoiceGroupDetails(req,res,next);

				if(groupResponse.status != Constants.STATUS_SUCCESS) return res.status(400).send(groupResponse);

				let groupDetails = groupResponse.result;
				let itemUnitId   = groupDetails?.item_unit_id || "";

				/**Get item units detail */
				const item_units = this.db.collection(Tables.ITEM_UNITS);
				let allSelectedUnitId = await item_units.distinct("item_unit_id",{item_id:mainItemId});			

				asyncParallel({
					item_list : (callback)=>{
						this.extraItemitemModel.getItemListWithHtml(req,res,next,{
							item_id			: mainItemId,
							item_unit_id	: itemUnitId,
							restaurant_slug	: restaurantSlug,
						}).then(response=> {
							callback(null,response?.item_list || '');
						}).catch(next);
					},
					dropdown_list: (callback)=>{
						/** Get item units masters list */
						getDropdownList(req,res,next,{
							collections :[{
								collection : Tables.ITEM_UNITS_MASTERS,
								columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
								selected   : [itemUnitId],
								conditions : { _id : {$in : allSelectedUnitId}}
							}]
						}).then(response=> {
							callback(null,response?.final_html_data?.[0] || '');
						}).catch(next);
					},
				},(err, response)=>{
					if(err) return next(err);

					res.render("choice_group/clone_choice_group",{
						layout			: false,
						result			: groupDetails,
						item_list		: response.item_list,
						item_unit_list	: response.dropdown_list
					});
				});
			}			
		}catch(e){
			return next(e);
		}		
	};//End cloneChoiceGroup()

	/**
	 * Function for get choice item list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async getChoiceItemList (req, res,next){
		try{
			/** Sanitize Data **/
			req.body 			= 	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let itemUnitId		=	req.body.item_unit_id || "";
			let mainItemId 		=	new ObjectId(req.params.item_id);
			let restaurantSlug	=	req?.params?.slug || "";

			/** Get item list */
			this.extraItemitemModel.getItemListWithHtml(req,res,next,{
				item_id			: mainItemId,
				item_unit_id	: itemUnitId,
				restaurant_slug	: restaurantSlug,
			}).then(response=> {
				res.send(response);
			}).catch(next);
		}catch(err){
			return next(err);
		}		
	};//End getChoiceItemList()
}
