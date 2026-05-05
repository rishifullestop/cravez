import { ObjectId } from 'mongodb';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import {isPost, sanitizeData, getUtcDate, configDatatable, getDropdownList, getUniqueId} from '../../../../utils/index.mjs';
import {saveSystemLogs} from '../../../../services/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

export default class SizeCategory{
	constructor(db){
		this.db = db;
	}

	/**
	 * Function to get size category list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async getSizeCategoryList (req,res,next){
		try{
			let slug = req?.params?.slug || "";
	
			if(isPost(req)){
				let limit		 = (req.body.length) ? parseInt(req.body.length) :Constants.FRONT_LISTING_LIMIT;
				let skip		 = (req.body.start)  ? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				const collection = this.db.collection(Tables.ITEM_UNITS_MASTERS);
	
				/**Set variable for conditions */
				let commonConditions = {restaurant_slug : slug};

				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);

				/** assign in a single object */
				dataTableConfig.conditions = Object.assign(commonConditions, dataTableConfig.conditions);

				// Get list or count of size categories 
                let dbRes = await collection.aggregate([
                    {$match: dataTableConfig.conditions },
                    {$facet : {
                        list : [
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit },
							{$project: {
								_id:1,name:1,item_unit_id:1
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
				/** Render lisitng page  **/
				req.breadcrumbs(BREADCRUMBS['size_category/list']);
				res.render('list',{
					layout	: false,
					slug	: slug
				});
			}			
		}catch(error){
			return next(error);
		}
	};//End getSizeCategoryList

	/**
	 * Function to get size category detail
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return json
	*/
	async getSizeCategoryDetails (req, res, next){
		try{
			let slug = req?.params?.slug || "";

			/** Get size category details **/
			const item_units_masters = this.db.collection(Tables.ITEM_UNITS_MASTERS);
			let sizeCategoryResult = await item_units_masters.findOne({
				_id  : new ObjectId(req.params.id),
				restaurant_slug : slug
			},{projection: {_id:1,name:1}});

			/** Send error response */
			if(!sizeCategoryResult) return {status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") };

			/**Send success response */
			return {
				status	: Constants.STATUS_SUCCESS,
				result	: sizeCategoryResult
			};
		}catch(error){
			return next(error);
		}
	};// End getSizeCategoryDetails

	/**
	 * Function for add or update size category
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async addEditSizeCategory (req, res,next){
		try{
			let slug 			= req?.params?.slug || "";
			let isEditable		= req?.params?.id 	?	true :false;
			let sizeCategoryId	= req?.params?.id 	?	new ObjectId(req?.params?.id) :new ObjectId();

			if(isPost(req)){
				/** Sanitize Data **/
				req.body  =	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
				let nameEnglish	= req.body.name_english || "";
				let nameArabic	= req.body.name_arabic || "";
				let itemUnitUniqueId  = "";

				if(!isEditable){
					let uniqueIdResponse = await getUniqueId(req,res,next,{type:"item_unit"});

					itemUnitUniqueId = uniqueIdResponse?.result || "";
				}
				
				/** Add / update size categories details */
				const collection	=	this.db.collection(Tables.ITEM_UNITS_MASTERS);
				await collection.updateOne({
					_id : sizeCategoryId
				},
				{
					$set : {
						name : {
							en : nameEnglish,
							ar : nameArabic
						},
						modified  : getUtcDate()
					},
					$setOnInsert: {
						restaurant_slug : slug,
						item_unit_id	: itemUnitUniqueId,
						created  		: getUtcDate()
					}
				},{upsert: true});

				let message	= (isEditable)	? res.__("size_category.size_category_has_been_updated_successfully") :res.__("size_category.size_category_has_been_added_successfully");

				/**Send success response */
				if(!isEditable) req.flash(Constants.STATUS_SUCCESS,message);
				res.send({status: Constants.STATUS_SUCCESS, message});

				/** Save System logs */
				saveSystemLogs(req, res, {
					user_id				: req.session.user._id,
					parent_type 		: Tables.ITEM_UNITS_MASTERS,
					parent_id 			: sizeCategoryId,
					activity_type		: Constants.ACTIVITY_ADD_EDIT_DETAILS,
					additional_details	: {}
				});
			}else{
				let response = {};
				if(isEditable){
					/** Get size category details **/
					response  =	await this.getSizeCategoryDetails(req, res, next);

					/** Send error response */
					if(response.status != Constants.STATUS_SUCCESS){
						return res.status(400).send({
							status  : Constants.STATUS_ERROR,
							message : res.__("system.something_going_wrong_please_try_again")
						});
					}
				}

				/** Render add/edit page  **/
				res.render('add_edit',{
					layout		: false,
					result		: response.result,
					is_editable	: isEditable,
				});
			}
		}catch(error){
			return next(error);
		}
	};//End addEditSizeCategory

	/**
	 * Function for delete size category
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return null
	 */
	async deleteSizeCategory (req, res, next){
		try{
			let sizeCategoryId	= new ObjectId(req.params.id);
	
			/** Count records if size category id exists in item units **/
			const item_units =	this.db.collection(Tables.ITEM_UNITS);
			let countResult = await item_units.countDocuments({item_unit_id: sizeCategoryId});
	
			/** Send error response **/
			if(countResult > 0){
				req.flash(Constants.STATUS_ERROR, res.__("size_category.you_cannot_delete_this_size_category"));
				return res.redirect(res.locals.base_url+"size_category");
			}
	
			/** Delete size category details **/
			const item_units_masters = this.db.collection(Tables.ITEM_UNITS_MASTERS);
			await item_units_masters.deleteOne({_id: sizeCategoryId});

			/** Send success response **/
			req.flash(Constants.STATUS_SUCCESS, res.__("size_category.size_category_has_been_deleted_successfully"));
			res.redirect(res.locals.base_url+"size_category");

			/** Save System logs */
			saveSystemLogs(req, res, {
				user_id				: req.session.user._id,
				parent_type 		: Tables.ITEM_UNITS_MASTERS,
				parent_id 			: sizeCategoryId,
				activity_type		: Constants.ACTIVITY_TYPE_DELETE,
				additional_details	: {}
			});			
		}catch(error){
			return next(error);
		}
    };//End deleteSizeCategory

    /**
	 * Function for get restaurant Link Items Units
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return null
	*/
    async restaurantLinkIteamUnits (req, res, next){
		try{
			let restaurantSlug = req?.params?.slug || "";
			let itemUnit = req?.params?.id || "";

			if(isPost(req)){
				let limit	= 	(req.body.length) ? parseInt(req.body.length) :Constants.FRONT_LISTING_LIMIT;
				let skip	=	(req.body.start)  ? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				const collection = this.db.collection(Tables.ITEMS);

				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);

				/** Get items id list   **/
				const item_units = this.db.collection(Tables.ITEM_UNITS);
				let itemIds = await item_units.distinct( "item_id",{item_unit_id : new ObjectId(itemUnit)});
				
				dataTableConfig.conditions = Object.assign({ $and:[{_id: { $in: itemIds }}] },dataTableConfig.conditions);

				// Get list or count of items 
                let dbRes = await collection.aggregate([
                    {$match: dataTableConfig.conditions },
                    {$facet : {
                        list : [
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit },
							{$lookup	: {
								from		 : Tables.RESTAURANT_BRANCHES,
								localField	 : "branch_id",
								foreignField : "_id",
								as			 : "restaurant_branches_data",
							}},
                            {$project: {
								_id:1,name:1,created:1, branch_name: {$arrayElemAt : ["$restaurant_branches_data.name",0]}
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
				/** get dropdown list for branches and items **/
				let dropDrownResponse = await getDropdownList(req,res,next, {
					collections : [{
						collection	: Tables.RESTAURANT_BRANCHES,
						columns		: ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
						conditions	: {restaurant_slug: restaurantSlug}
					}]
				});

				if(dropDrownResponse.status != Constants.STATUS_SUCCESS){
					req.flash(Constants.STATUS_ERROR, res.__("system.invalid_access"));
					return res.redirect(res.locals.list_url);
				}

				/** For render assign restaurant item branch page **/
				res.render('link_iteam_units',{
					layout	 		: false,
					branches_list 	: dropDrownResponse?.final_html_data?.[0] || "",
					item_unit_id	: itemUnit,
				});
			}			
		}catch(error){
			return next(error);
		}
    }//End restaurantLinkIteamUnits
}
