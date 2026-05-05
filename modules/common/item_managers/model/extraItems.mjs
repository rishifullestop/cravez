import { ObjectId } from 'mongodb';
import { parallel as asyncParallel, each as asyncEach } from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import {isPost, sanitizeData, getUtcDate, configDatatable, getDropdownList, getRestaurantId, getRestaurantDetails, arrayToObject, isAdmin, round} from '../../../../utils/index.mjs';
import {saveSystemLogs} from '../../../../services/index.mjs';
import itemModule from './item.mjs';

export default class ExtraItems{
	constructor(db){
		this.db = db;
		this.itemModel = new itemModule(db);
	}

	/**
     * Function to get extra items list
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
    */
    async getExtraItemsList (req,res,next){
		try{
			let itemId  = new ObjectId(req.params.item_id);
			let slug	= req.params.slug;

			if(isPost(req)){
				let limit		  =	(req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
				let skip		  = (req.body.start)  ? parseInt(req.body.start)  : Constants.DEFAULT_SKIP;
				const collection  = this.db.collection(Tables.ITEM_EXTRA_MASTERS);

				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);
				let commonConditions = { item_id : itemId };

				/** assign in a single object */
				dataTableConfig.conditions = Object.assign(commonConditions,dataTableConfig.conditions);

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
								_id:1,name:1,extra_fees:1, item_id:1,is_active:1,status:1,item_unit_id:1,
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

					try{
						/**For get item units masters list */
						let dropDownResponse = await getDropdownList(req,res,next,{
							collections :[{
								collection : Tables.ITEM_UNITS_MASTERS,
								columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
								conditions : { _id : {$in : asyncResponse.item_units_detail}}
							}]
						});

						/**Check for dropdown response */
						if(dropDownResponse?.status != Constants.STATUS_SUCCESS) {
							return res.status(400).send({
								status  : Constants.STATUS_ERROR,
								message : res.__("system.something_going_wrong_please_try_again")
							});
						}

						/** Render extra item list  page */
						res.render("extra_items/extra_item_list",{
							item_result 	  : asyncResponse?.item_result || {},
							restaurant_detail : asyncResponse?.restaurant_detail?.result || {},
							item_unit_list    : dropDownResponse?.final_html_data?.[0] || "",
							item_id			  :	itemId,
							layout 			  : false,
							slug              : slug
						});
					}catch(error){
						return next(error);
					}
				});
			}
		}catch(error){
			return next(error);
		}
	};//End getExtraItemsList()

	/**
	 * Function to get extra item details
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return json
	*/
	async getExtraItemsDetails (req, res, next){
		try{
			/** Get extra items details **/
			const item_extra_masters = this.db.collection(Tables.ITEM_EXTRA_MASTERS);
			let extraItemsResult = await item_extra_masters.findOne({
				_id  	 : new ObjectId(req.params.cloneId || req.params.id),
				item_id  : new ObjectId(req.params.item_id)
			},{projection: {_id:1,name:1,extra_fees:1,item_unit_id:1,extra_item_unit_id:1}})

			/** Send error response when details not found */
			if(!extraItemsResult) return { status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") };

			/** Send success response */
			return {status: Constants.STATUS_SUCCESS, result: extraItemsResult};
		}catch(error){
			return next(error);
		}
	};// End getExtraItemsDetails()

    /**
	 * Function for add or update extra item
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async addEditExtraItems (req, res,next){
		try{
			let isEditable	 = (req.params.id) 	? true :false;
			let extraItemsId = (req.params.id) 	? new ObjectId(req.params.id) :new ObjectId();
			let itemId 		 = new ObjectId(req.params.item_id);
			let slug		 = req.params.slug;

			if(isPost(req)){
				/** Sanitize Data **/
				req.body 		   = sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
				let nameInEnglish  = (req.body.name_in_english) ? req.body.name_in_english 		  :"";
				let nameInArabic   = (req.body.name_in_arabic)  ? req.body.name_in_arabic  		  :"";
				let itemUnitId	   = (req.body.item_unit_id)	? req.body.item_unit_id 		  :"";
				let extraItemUnitId= (req.body.extra_item_unit_id)	? req.body.extra_item_unit_id :"";
				let extraFees	   = (req.body.extra_fees)		? parseFloat(req.body.extra_fees) :"";
				let restaurantId   = "";

				if(!isEditable){
					restaurantId = await getRestaurantId(req,res,next,{slug:slug});

					/** Send error response when restaurant id not found */
					if(!restaurantId){
						return res.send({
							status  : Constants.STATUS_ERROR,
							message : res.__("system.something_going_wrong_please_try_again")
						});
					}
				}

				let unitId = "";
				if(itemUnitId){
					const item_units = this.db.collection(Tables.ITEM_UNITS);
					let itemUnitResult = await item_units.findOne({item_unit_id : new ObjectId(itemUnitId)},{_id: 1});

					unitId = itemUnitResult?._id || "";

					/** Send error response when item unit id not found */
					if(!unitId){
						return res.send({
							status  : Constants.STATUS_ERROR,
							message : res.__("system.something_going_wrong_please_try_again")
						});
					}
				}

				/**Set data in a object */
				let updateData = {
					name : {
						en : nameInEnglish,
						ar : nameInArabic
					},
					extra_fees	  		: round(extraFees,Constants.CURRENCY_ROUND_PRECISION),
					item_unit_id  		: (itemUnitId) ? new ObjectId(itemUnitId) : "",
					extra_item_unit_id  : (extraItemUnitId) ? new ObjectId(extraItemUnitId) : "",
					modified   	 		: getUtcDate()
				};

				if(itemUnitId) updateData.item_unit = new ObjectId(unitId);

				let collection	= this.db.collection(Tables.ITEM_EXTRA_MASTERS);
				if(!isAdmin(req,res)){
					updateData.status	= Constants.PENDING;
					updateData.user_id	= new ObjectId(req.session.user._id);
					collection 			= this.db.collection(Tables.TMP_ITEM_EXTRA_MASTERS);
				}

				/** save extra item details */
				await collection.updateOne({
					_id : extraItemsId
				},
				{
					$set : updateData ,
					$setOnInsert: {
						restaurant_id   : restaurantId,
						item_id 		: itemId,
						is_active		: Constants.ACTIVE,
						created  		: getUtcDate()
					}
				},{upsert: true});

				/** Copy data  tmp_item_extra_masters to item_extra_masters collections */
				if(!isAdmin(req,res)) await this.itemModel.copyItemToPending(req,res,next);

				/** success response  message **/
				let isAdminUser		= isAdmin(req,res);
				let updateMessage	= (isAdminUser) ? res.__("extra_items.extra_item_has_been_updated_successfully") : res.__("extra_items.extra_item_has_been_updated_and_send_for_approval");
				let addMessage		= (isAdminUser) ? res.__("extra_items.extra_item_has_been_added_successfully")   : res.__("extra_items.extra_item_has_been_added_and_send_for_approval");
				let message			= (isEditable)  ? updateMessage :addMessage;

				/** Send  success response */
				if(!isEditable) req.flash(Constants.STATUS_SUCCESS,message);
				res.send({
					status	: Constants.STATUS_SUCCESS,
					message	: message
				});

				/** Save system logs **/
				saveSystemLogs(req,res,{
					user_id 		:	new ObjectId(req.session.user._id),
					parent_type 	:	Tables.ITEM_EXTRA_MASTERS,
					parent_id 		: 	extraItemsId,
					activity_type	:	Constants.ACTIVITY_ADD_EDIT_DETAILS,
					additional_details:	{restaurant_slug: slug,channel_id : req.session.user.channel_id},
				});
			}else{
				let extraDetails = {};
				if(isEditable){
					/** Get extra item details */
					let extraDetailsResponse = await this.getExtraItemsDetails(req,res,next);

					/** Send error response when details not found */
					if(extraDetailsResponse.status != Constants.STATUS_SUCCESS){
						return res.status(400).send(extraDetailsResponse);
					}

					/** Set extra item details */
					extraDetails = extraDetailsResponse?.result || {};
				}

				/** Get item units detail */
				const item_units = this.db.collection(Tables.ITEM_UNITS);
				let itemUnitIds = await item_units.distinct("item_unit_id",{item_id : itemId});

				/**For get item units masters list */
				let dropDownResponse = await getDropdownList(req,res,next,{
					collections :[{
						collection : Tables.ITEM_UNITS_MASTERS,
						columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
						selected   : [extraDetails?.item_unit_id || ""],
						conditions : { _id : {$in : itemUnitIds}}
					},
					{
						collection : Tables.ITEM_UNITS_MASTERS,
						columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
						selected   : [extraDetails?.extra_item_unit_id || ""],
						conditions : {restaurant_slug : slug}
					}]
				});

				/**Check for dropdown response */
				if(dropDownResponse?.status != Constants.STATUS_SUCCESS) {
					return res.status(400).send({
						status  : Constants.STATUS_ERROR,
						message : res.__("system.something_going_wrong_please_try_again")
					});
				}

				/** Render add/edit extra items page **/
				res.render('extra_items/add_edit_extra_item',{
					layout		   		: false,
					item_unit_list		: dropDownResponse?.final_html_data?.[0] || "",
					extra_item_unit_list: dropDownResponse?.final_html_data?.[1] || "",
					result		   		: extraDetails,
					is_editable	   		: isEditable,
				});
			}
		}catch(error){
			return next(error);
		}
	};//End addEditExtraItems()

	/**
	 * Function for delete extra item
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	*/
	async deleteExtraItems (req, res, next){
		try{
			let extraItemsId = new ObjectId(req.params.id);
			let itemId 	     = new ObjectId(req.params.item_id);

			/** Count records if item extra id exists in item group extras **/
			let collection = this.db.collection(Tables.ITEM_GROUP_EXTRAS);
			if(!isAdmin(req,res)){
				collection 	= this.db.collection(Tables.TMP_ITEM_GROUP_EXTRAS);
			}

			/** Check item mapped  with a group */
			let countResult = await collection.countDocuments({item_extra_id: extraItemsId});

			/** Send error response when item mapped  with a group **/
			if(countResult > 0){
				req.flash(Constants.STATUS_ERROR, res.__("extra_items.you_cannot_delete_this_extra_item"));
				return res.redirect(res.locals.base_url+"extra_items/"+itemId);
			}

			/**For delete extra item */
			const item_extra_masters = this.db.collection(Tables.ITEM_EXTRA_MASTERS);
			await item_extra_masters.deleteOne({
				_id 	 : extraItemsId,
				item_id  : itemId
			});

			/**For delete extra item */
			const item_group_extras  = this.db.collection(Tables.ITEM_GROUP_EXTRAS);
			await item_group_extras.deleteMany({item_extra_id: extraItemsId});

			/** Send success response **/
			req.flash(Constants.STATUS_SUCCESS,res.__("extra_items.extra_item_has_been_deleted_successfully"));
			res.redirect(res.locals.base_url+"extra_items/"+itemId);

			/** save System logs */
			saveSystemLogs(req, res, {
				user_id				: req.session.user._id,
				parent_id			: extraItemsId,
				activity_module		: Constants.SYSTEM_LOG_MODULE_EXTRA_ITEMS,
				activity_type		: Constants.ACTIVITY_TYPE_DELETE,
				additional_details	: { }
			});
		}catch(error){
			return next(error);
		}
	};//End deleteExtraItems()

	/**
	 * Function for update extra item status
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return void
	 */
	async updateExtraItemStatus (req,res,next){
		let status	 	 = 	(req.body.status)		  ?	req.body.status					  :0;
		let extraItemIds =	(req.body.extra_item_ids) ?	req.body.extra_item_ids.split(","):[];

		/** Send error response **/
		if(extraItemIds.length < 1 || !status) return res.send({ status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });

		/** Convert into object ids */
		let extraItemIdObject = arrayToObject(extraItemIds);

		/** Update extra item status */
		let item_extra_masters = this.db.collection(Tables.ITEM_EXTRA_MASTERS);
		await item_extra_masters.updateMany({
			_id: {$in: extraItemIdObject}
		},
		{ $set:{
			is_active :	(status == Constants.ACTIVE) ? Constants.ACTIVE :Constants.DEACTIVE,
			modified  : getUtcDate()
		}});

		/** success response*/
		res.send({
			status : Constants.STATUS_SUCCESS,
			message: res.__("extra_items.extra_item_status_has_been_updated_successfully"),
		});

		/** Save System logs */
		saveSystemLogs(req, res, {
			user_id				: req.session.user._id,
			parent_type 		: Tables.ITEM_EXTRA_MASTERS,
			parent_id 			: "",
			activity_type		: Constants.ACTIVITY_UPDATE_STATUS,
			additional_details  : {
				status: (status == Constants.ACTIVE) ?	Constants.ACTIVE : Constants.DEACTIVE,
				extra_item_ids :extraItemIdObject
			}
		});
	};//End updateExtraItemStatus()

	/**
	 * Function for clone extra item
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async cloneExtraItem (req, res,next){
		let extraItemId		= 	new ObjectId(req.params.cloneId);
		let mainItemId 		=	new ObjectId(req.params.item_id);
		let restaurantSlug	=	req.params.slug;

		if(isPost(req)){
			/** Sanitize Data **/
			req.body 		= 	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let extraFees	=	(req.body.extra_fees) 	? 	parseFloat(req.body.extra_fees) :"";
			let itemIds		=	(req.body.item_id) 		?	req.body.item_id 				:"";

			/** Get restaurant id */
			let restaurantId = await getRestaurantId(req,res,next,{slug:restaurantSlug});

			/** Send error response when restaurant id not found */
			if(!restaurantId){
				return res.send({
					status  : Constants.STATUS_ERROR,
					message : res.__("system.something_going_wrong_please_try_again")
				});
			}

			/** For Get extra item details */
			let collection	= this.db.collection(Tables.ITEM_EXTRA_MASTERS);
			let extraItemDetails = await collection.findOne({ _id : new ObjectId(extraItemId)},{projection : {_id:1, item_unit_id:1}});

			/** Send error response */
			if(!extraItemDetails){
				return res.send({status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });
			}

			/**Set data in a object */
			let itemUnitId =	(req.body.item_unit_id) ? new ObjectId(req.body.item_unit_id) :"";
			let updateData = {
				name : {
					en : req.body.name_in_english,
					ar : req.body.name_in_arabic
				},
				extra_fees	  : round(extraFees,Constants.CURRENCY_ROUND_PRECISION),
				item_unit_id  : itemUnitId,
				extra_item_unit_id : new ObjectId(req.body.extra_unit_id),
				modified   	  :	getUtcDate()
			};

			let isAdminUser	= isAdmin(req,res);
			if(!isAdminUser){
				updateData.status	= Constants.PENDING;
				updateData.user_id	= new ObjectId(req.session.user._id);
				collection 			= this.db.collection(Tables.TMP_ITEM_EXTRA_MASTERS);
			}

			if(itemIds.constructor != Array) itemIds = [itemIds];
			itemIds = arrayToObject(itemIds);

			asyncEach(itemIds,(tmpItemId, eachCallback)=>{
				let tmpExtraItemId = new ObjectId();

				/** Save extra item details */
				collection.updateOne({
					_id : tmpExtraItemId
				},
				{
					$set : updateData,
					$setOnInsert: {
						restaurant_id   : new ObjectId(restaurantId),
						item_id 		: tmpItemId,
						is_active		: Constants.ACTIVE,
						created  		: getUtcDate()
					}
				},{upsert: true}).then(()=> {

					eachCallback(null);

					if(!isAdminUser){
						/** Copy data  tmp_item_extra_masters to item_extra_masters collections */
						this.itemModel.copyItemToPending(req,res,next,{item_id: tmpItemId}).then(()=>{});
					}

					saveSystemLogs(req, res, {
						user_id				: req.session.user._id,
						parent_type 		: Tables.ITEM_EXTRA_MASTERS,
						parent_id 			: tmpExtraItemId,
						activity_type		: Constants.ACTIVITY_CLONE_DETAILS,
						additional_details	: {
							parent_extra_item 	: 	extraItemId,
							channel_id			:	req.session.user.channel_id
						}
					}).then(()=>{});
				}).catch(next);
			},(eachErr)=>{
				if(eachErr) return next(eachErr);

				/** success response  message **/
				let message		= (isAdminUser) ? res.__("extra_items.extra_item_has_been_cloned_successfully") : res.__("extra_items.extra_item_has_been_cloned_and_send_for_approval");

				/** Send  success response */
				req.flash(Constants.STATUS_SUCCESS,message);
				res.send({
					status	: Constants.STATUS_SUCCESS,
					message	: message
				});
			});
		}else{
			/** Get extra item details */
			let extraDetailsResponse = await this.getExtraItemsDetails(req,res,next);

			/** Send error response when details not found */
			if(extraDetailsResponse.status != Constants.STATUS_SUCCESS){
				return res.status(400).send(extraDetailsResponse);
			}

			/** Get item units detail */
			const item_units = this.db.collection(Tables.ITEM_UNITS);
			let itemUnitIds = await item_units.distinct("item_unit_id",{item_id : mainItemId});

			let extraDetails = 	extraDetailsResponse?.result || {};
			let itemUnitId	=	extraDetails?.item_unit_id || "";
			let extraUnitId	=	extraDetails?.extra_item_unit_id || "";
			asyncParallel({
				item_list : (callback)=>{
					this.getItemListWithHtml(req,res,next,{
						item_id			: mainItemId,
						item_unit_id	: itemUnitId,
						restaurant_slug	: restaurantSlug,
					}).then(response=> {
						if(response.status != Constants.STATUS_SUCCESS)  return callback(response);

						callback(null,response.item_list);
					}).catch(next);
				},
				dropdown_list: (callback)=>{
					/** Get item units masters list */
					getDropdownList(req,res,next,{
						collections :[{
							collection : Tables.ITEM_UNITS_MASTERS,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							selected   : [extraUnitId],
							conditions : {
								restaurant_slug : restaurantSlug,
							}
						},
						{
							collection : Tables.ITEM_UNITS_MASTERS,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							selected   : [itemUnitId],
							conditions : { _id : {$in : itemUnitIds}}
						}
						]
					}).then(response=> {

						callback(null,response?.final_html_data || []);
					}).catch(next);
				},
			},(err, response)=>{
				if(err) return next(err);

				/** Render copy extra item page **/
				res.render('extra_items/copy_extra_item',{
					layout		   	: false,
					extra_unit_list : response?.dropdown_list?.[0] || "",
					unit_list 		: response?.dropdown_list?.[1] || "",
					item_list 		: response?.item_list || "",
					result 			: extraDetails,
					restaurant_slug : restaurantSlug
				});
			});
		}
	};//End cloneExtraItem()

	/**
	 * Function for clone extra item
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async getMainItemList (req, res,next){
		try{
			/** Sanitize Data **/
			req.body = 	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);

			/** Get item list */
			let itemList = await this.getItemListWithHtml(req,res,next,{
				item_id			: new ObjectId(req.params.item_id),
				item_unit_id	: req?.body?.item_unit_id || "",
				restaurant_slug	: req.params.slug || "",
			});

			/** Send success response */
			res.send(itemList);
		}catch(error){
			return next(error);
		}
	};//End getMainItemList()

	/**
	 * Function for get item list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async getItemListWithHtml (req, res,next,options){
		try{
			let itemId			= 	(options.item_id)			? 	new ObjectId(options.item_id) 		:"";
			let itemUnitId		= 	(options.item_unit_id)		?	new ObjectId(options.item_unit_id) 	:"";
			let restaurantSlug	= 	(options.restaurant_slug)	?	options.restaurant_slug 			:"";

			/** Set unit conditions */
			let unitConditions = {item_id: {$ne: itemId }};
			if(itemUnitId){
				unitConditions.item_unit_id = itemUnitId;
			}

			/** Get item ids  */
			const item_units = this.db.collection(Tables.ITEM_UNITS);
			let itemIds = await item_units.distinct("item_id",unitConditions);

			/** Set item conditions */
			let itemConditions = {
				restaurant_slug : restaurantSlug,
				$or : [
					{_id: itemId}
				]
			};

			if(itemUnitId){
				itemConditions["$or"].push({_id: {$in: itemIds }});
			}else{
				itemConditions["$or"].push({_id: {$nin: itemIds }});
			}

			/** Set drop down options */
			let dropdownOptions = {
				collections :[{
					collection : Tables.ITEMS,
					columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
					selected   : [itemId],
					conditions : itemConditions
				}]
			};

			/** Get item units masters list */
			let itemList = await getDropdownList(req,res,next,dropdownOptions);

			/** Send success response */
			return {status: Constants.STATUS_SUCCESS, item_list: itemList?.final_html_data?.[0] || "" };
		}catch(error){
			return next(error);
		}
	};//End getItemListWithHtml()

	/**
	 * Function to manage extra item order in group
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async extraItemOrder (req,res,next){
		try{
			let mainItemId 	=	new ObjectId(req.params.item_id);
			let exItemId 	=	new ObjectId(req.params.id);

			const item_group_extras	= 	this.db.collection(Tables.ITEM_GROUP_EXTRAS);
			if(isPost(req)){
				/** Sanitize Data **/
				req.body 		= sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
				let itemOrders	= (req.body.item_orders) ? req.body.item_orders : [];
				let authUserId	= (req.session.user._id) ? new ObjectId(req.session.user._id) :"";
				let validIntRegx= /^[0-9]+$/;
				let errors		= [];

				/** Manage validation */
				itemOrders.map((rec,index)=>{
					if(rec.order && !validIntRegx.test(rec.order)){
						errors.push({ 'param': "item_orders_"+index, 'msg': res.__("extra_items.please_enter_valid_order") });
					}
				});

				/** Send error response */
				if(errors.length > 0) return res.send({status: Constants.STATUS_ERROR, message: errors});

				asyncEach(itemOrders,(records, eachCallback)=>{
					if(!records?.group_id || records.order == "") return eachCallback(null);

					/** Update extra item order in group */
					item_group_extras.updateOne({
						item_extra_id	: 	exItemId,
						item_id			: 	mainItemId,
						group_id		: 	new ObjectId(records.group_id),
					},
					{
						$set: {
							order				: 	parseInt(records.order),
							order_updated_by	: 	authUserId,
							modified			: 	getUtcDate()
						},
					}).then(()=>{
						eachCallback(null);
					}).catch(next);
				},(asyncErr)=>{
					if(asyncErr) return next(asyncErr);

					/** Send success response */
					res.send({
						status	: Constants.STATUS_SUCCESS,
						message	: res.__("extra_items.item_order_has_been_updated_successfully")
					});
				});
			}else{
				/** Get extra item details */
				const item_extra_masters = this.db.collection(Tables.ITEM_EXTRA_MASTERS);
				let extraItemsDetails = await item_extra_masters.findOne({_id: exItemId},{projection: {_id: 1, name: 1 }});

				/** Send error response */
				if(!extraItemsDetails) return res.status(400).send({status: Constants.STATUS_ERROR,message:res.__("system.invalid_access")});

				/** Get extra group item list */
				let groupExtraList = await item_group_extras.find({item_extra_id: exItemId },{projection : {group_id:1,order:1 }}).toArray();

				let allGroupIds 	= 	[];
				let extraItemsOrder	=	{};
				if(groupExtraList.length >0){
					groupExtraList.map(records=>{
						allGroupIds.push(records.group_id);

						extraItemsOrder[records.group_id] = records?.order || "";
					});
				}

				let groupList = [];
				if(allGroupIds?.length){
					const item_choices_groups = this.db.collection(Tables.ITEM_CHOICES_GROUPS);
					groupList = await item_choices_groups.find({_id: {$in: allGroupIds} },{projection : {name: 1,_id:1}}).toArray();
				}

				/** Render extra item order page */
				res.render("extra_items/extra_item_order",{
					layout			: 	false,
					extra_details 	: 	extraItemsDetails,
					extra_orders	: 	extraItemsOrder,
					group_list		:	groupList,
				});
			}
		}catch(error){
			return next(error);
		}
	};//End extraItemOrder()
}
