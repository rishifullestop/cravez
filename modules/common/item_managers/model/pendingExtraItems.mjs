import { ObjectId } from 'mongodb';
import { parallel as asyncParallel } from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import {isPost, sanitizeData, getUtcDate, configDatatable, getDropdownList, getRestaurantId, getRestaurantDetails, isAdmin, round} from '../../../../utils/index.mjs';
import {saveSystemLogs} from '../../../../services/index.mjs';
import itemModule from './item.mjs';

export default class PendingExtraItems{
	constructor(db){
		this.db = db;
		this.itemModel = new itemModule(db);
	}

	/**
     * Function to get pending extra items list
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
    */
    async getPendingExtraItemsList (req,res,next){
		try{
			let itemId  = new ObjectId(req.params.item_id);
			let slug	= req.params.slug;

			if(isPost(req)){
				let limit		 =	(req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
				let skip		 = 	(req.body.start)  ? parseInt(req.body.start)  : Constants.DEFAULT_SKIP;
				const collection = 	this.db.collection(Tables.TMP_ITEM_EXTRA_MASTERS);

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
					tmp_item_result:(callback)=>{
						/** Get item detail */
						/**Get details from items */
						const tmp_items = this.db.collection(Tables.TMP_ITEMS);
						tmp_items.findOne({_id : itemId},{projection:{_id:1,name:1,status:1,reject_reason:1,item_id:1}}).then(itemResult=>{
							callback(null,itemResult);
						}).catch(next);
					},
					restaurant_detail:(callback)=>{
						/** Get restaurant detail */
						getRestaurantDetails(req,res,next,{slug:slug}).then((restaurantResponse)=>{
							if(restaurantResponse.status != Constants.STATUS_SUCCESS) return callback(restaurantResponse);
							callback(null,restaurantResponse);
						}).catch(next);
					},
					pending_item_units_detail:(callback)=>{
						/**Get item units detail */
						const item_units = this.db.collection(Tables.ITEM_UNITS);
						item_units.distinct( "item_unit_id",{item_id : itemId}).then(itemUnitResult=>{
							callback(null,itemUnitResult);
						}).catch(next);
					}
				},(asyncErr,asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					/**Check for item result */
					if(!asyncResponse?.tmp_item_result || !asyncResponse?.restaurant_detail?.result){
						return res.status(400).send({
							status  : Constants.STATUS_ERROR,
							message : res.__("system.something_going_wrong_please_try_again")
						});
					}

					/**For get item units masters list */
					getDropdownList(req,res,next,{
						collections :[{
							collection : Tables.ITEM_UNITS_MASTERS,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions : { _id : {$in : asyncResponse?.pending_item_units_detail || []}}
						}]
					}).then(dropDownResponse=> {
						if(dropDownResponse.status != Constants.STATUS_SUCCESS) {
							return res.status(400).send({
								status  : Constants.STATUS_ERROR,
								message : res.__("system.something_going_wrong_please_try_again")
							});
						}

						/** Render pending extra items list  page */
						res.render("extra_items/pending_extra_item_list",{
							item_detail 	  : asyncResponse?.tmp_item_result || {},
							restaurant_detail : asyncResponse?.restaurant_detail?.result || {},
							item_unit_list    : dropDownResponse?.final_html_data?.[0] || "",
							layout 			  : false,
							item_id			  : itemId,
							slug              : slug
						});
					});
				});
			}
		}catch(error){
			return next(error);
		}
	};//End getPendingExtraItemsList()

	/**
	 * Function to get pending extra item details
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return json
	*/
	async getPendingExtraItemsDetails (req, res, next){
		try{
			/** Get pending extra item details **/
			const tmp_item_extra_masters = this.db.collection(Tables.TMP_ITEM_EXTRA_MASTERS);
			let pendingExtraItemsResult = await tmp_item_extra_masters.findOne({
				_id  	: new ObjectId(req.params.id),
				item_id : new ObjectId(req.params.item_id)
			},{projection: {_id:1,name:1,extra_fees:1,item_unit_id:1,extra_item_unit_id:1}})
			
			/** Send error response when details not found */
			if(!pendingExtraItemsResult) return { status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") };

			/** Send success response */
			return {status: Constants.STATUS_SUCCESS, result: pendingExtraItemsResult};
		}catch(error){
			return next(error);
		}
	};// End getPendingExtraItemsDetails()

	/**
	 * Function for add/edit pending extra item
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async addEditPendingExtraItems (req, res,next){
		try{
			let isEditable	 		= (req.params.id) 	? true :false;
			let pendingExtraItemsId = (req.params.id) 	? new ObjectId(req.params.id) :new ObjectId();
			let extraItemUnitId		= (req.body.extra_item_unit_id)	? req.body.extra_item_unit_id :"";
			let itemId 		 		= new ObjectId(req.params.item_id);
			let slug 				= req.params.slug;

			if(isPost(req)){
				/** Sanitize Data **/
				req.body  		  =	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
				let nameInEnglish = (req.body.name_in_english) ? req.body.name_in_english : "";
				let nameInArabic  = (req.body.name_in_arabic)  ? req.body.name_in_arabic  : "";
				let extraFees	  = (req.body.extra_fees)	   ? parseFloat(req.body.extra_fees) :"";
				let restaurantId  = "";

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

				/** Set data in a object */
				let updateData = {
					name : {
						en : nameInEnglish,
						ar : nameInArabic
					},
					extra_fees	  		: round(extraFees,Constants.CURRENCY_ROUND_PRECISION),
					item_unit_id  		: (req.body.item_unit_id) ? new ObjectId(req.body.item_unit_id) : "",
					extra_item_unit_id  : (extraItemUnitId) ? new ObjectId(extraItemUnitId) : "",
					modified   	  		: getUtcDate()
				};
				
				/** save pending extra item details */
				let tmp_item_extra_masters	= this.db.collection(Tables.TMP_ITEM_EXTRA_MASTERS);
				await tmp_item_extra_masters.updateOne({
					_id : pendingExtraItemsId,item_id : itemId
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

				/** success response  message **/
				let isAdminUser	 = isAdmin(req,res);
				let addMessage	 = (isAdminUser) ? res.__("extra_items.extra_item_has_been_added_successfully")   : res.__("extra_items.pending_extra_item_has_been_added_and_send_for_approval");
				let message		 = (isEditable)  ? res.__("extra_items.extra_item_has_been_updated_successfully") : addMessage;

				/** Send  success response */
				if(!isEditable) req.flash(Constants.STATUS_SUCCESS,message);
				res.send({status: Constants.STATUS_SUCCESS, message: message});

				/** Save System logs */
				saveSystemLogs(req, res, {
					user_id				: req.session.user._id,
					parent_type 		: Tables.ITEM_EXTRA_MASTERS,
					parent_id 			: pendingExtraItemsId,
					activity_type		: Constants.ACTIVITY_ADD_EDIT_DETAILS,
					additional_details	: {}
				});
			}else{
				let extraDetails = {};
				if(isEditable){
					/** Get extra item details */
					let extraDetailsResponse = await this.getPendingExtraItemsDetails(req,res,next);

					/** Send error response when details not found */
					if(extraDetailsResponse.status != Constants.STATUS_SUCCESS){
						return res.status(400).send(extraDetailsResponse);
					}

					/** Set extra item details */
					extraDetails = extraDetailsResponse?.result || {};
				}

				/** Get item units detail */
				const item_units = this.db.collection(Tables.TMP_ITEM_UNITS);
				let itemUnitIds = await item_units.distinct("item_unit_id",{item_id : itemId});
			
				/** Get item units masters list */
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
						conditions : {"restaurant_slug" : slug}
					}]
				});
				
				if(dropDownResponse?.status != Constants.STATUS_SUCCESS) {
					return res.status(400).send({
						status  : Constants.STATUS_ERROR,
						message : res.__("system.something_going_wrong_please_try_again")
					});
				}

				/** Render add/edit pending extra items page **/
				res.render('extra_items/add_edit_pending_extra_item',{
					layout		   		: false,
					item_unit_list 		: dropDownResponse?.final_html_data?.[0] || "",
					extra_item_unit_list: dropDownResponse?.final_html_data?.[1] || "",
					result		  		: extraDetails,
					is_editable    		: isEditable
				});				
			}
		}catch(error){
			return next(error);
		}
	};//End addEditPendingExtraItems()

	/**
	 * Function for delete pending extra item
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	*/
	async deletePendingExtraItems (req, res, next){
		try{
			let extraItemsId = new ObjectId(req.params.id);
			let itemId 	     = new ObjectId(req.params.item_id);

			/** Count records if item extra id exists in item group extras **/
			const tmp_item_group_extras = this.db.collection(Tables.TMP_ITEM_GROUP_EXTRAS);
			let countResult = await tmp_item_group_extras.countDocuments({item_extra_id: extraItemsId});

			/** Check item mapped  with a group */
			if(countResult > 0){
				req.flash(Constants.STATUS_ERROR, res.__("extra_items.you_cannot_delete_this_extra_item"));
				return res.redirect(res.locals.base_url+"pending_extra_items/"+itemId);
			}

			/**For delete extra item */
			const tmp_item_extra_masters = this.db.collection(Tables.TMP_ITEM_EXTRA_MASTERS);
			await tmp_item_extra_masters.deleteOne({_id : extraItemsId, item_id  : itemId });

			/** Send success response **/
			req.flash(Constants.STATUS_SUCCESS,res.__("extra_items.extra_item_has_been_deleted_successfully"));
			res.redirect(res.locals.base_url+"pending_extra_items/"+itemId);

			/** save System logs */
			saveSystemLogs(req, res, {
				user_id				: req.session.user._id,
				parent_id			: extraItemsId,
				parent_type 		: Tables.ITEM_EXTRA_MASTERS,
				activity_type		: Constants.ACTIVITY_TYPE_DELETE,
				additional_details	: { }
			});
		}catch(error){
			return next(error);
		}
	};//End deletePendingExtraItems()
}
