
import { ObjectId } from 'mongodb';
import { parallel as asyncParallel } from 'async';
import BREADCRUMBS from "../../../../breadcrumbs.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { getUtcDate, arrayToObject,isPost, sanitizeData, configDatatable} from "../../../../utils/index.mjs";

export default class Cuisines {
	constructor(db) {
		this.db = db;
	}   

	/**
	* Function to get cuisines list
	*
	* @param req 	As Request Data
	* @param res 	As Response Data
	*
	* @return render/json
	*/
	async getCuisinesList (req,res,next){
		if(isPost(req)){
			let limit	=	(req.body.length) ? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
			let skip	= 	(req.body.start)  ? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
			let restaurantId = req?.session?.user?.restaurant_id || "";
			const collection = this.db.collection(Tables.RESTAURANT_CUISINES);

			/** Configure Datatable conditions*/
			const dataTableConfig = await configDatatable(req, res, null);

			let commonConditions = {restaurant_id : new ObjectId(restaurantId)};
			dataTableConfig.conditions = Object.assign(commonConditions, dataTableConfig.conditions);

			let dbRes = await collection.aggregate([
				{$lookup	: {
					from			: Tables.CUISINES,
					localField		: "cuisine_id",
					foreignField	: "_id",
					as				: "cuisines",
				}},
				{$project	: {  _id: 1, cuisine_id: 1, cuisine_name: { $arrayElemAt: ["$cuisines.name", 0] }, restaurant_id: 1} },
                {$match: dataTableConfig.conditions },
                {$facet : {
					list : [
						{$sort: dataTableConfig.sort_conditions },
						{$skip: skip },
						{$limit: limit }                            
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
			req.breadcrumbs(BREADCRUMBS['cuisines/list']);
			res.render('list');
		}
	};//End getCuisinesList()

	/**
	* Function for add cuisines
	*
	* @param req 	As Request Data
	* @param res 	As Response Data
	* @param next 	As Callback argument to the middleware function
	*
	* @return render/json
	*/
	async selectCuisines (req, res, next){
		try{
			let restaurantId = req?.session?.user?.restaurant_id || "";

			if(isPost(req)){
				/** Sanitize Data **/
				req.body 		= sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
				let cuisineIds 	= (req.body.cuisine_id) ? req.body.cuisine_id : [];

				/** Check validation **/
				if (cuisineIds.length == 0) {
					return res.send({
						status: Constants.STATUS_ERROR, 
						message: [{ 'param': "cuisine_id", 'msg': res.__("cuisines.please_select_atleast_one_cuisines")}]
					});
				}

				let cuisinesObject = arrayToObject(cuisineIds);

				const restaurant_cuisines = this.db.collection(Tables.RESTAURANT_CUISINES);
				await restaurant_cuisines.deleteMany({ restaurant_id : new ObjectId(restaurantId), cuisine_id: { $nin: cuisinesObject} });

				/** Set updated data */
				let updatedData = 	cuisinesObject.map(cuisineId=>{
										return { updateOne : {
											"filter": {restaurant_id: new ObjectId(restaurantId), cuisine_id: cuisineId },
											"update": {
													$set: { modified : getUtcDate()},
													$setOnInsert: {
														created : getUtcDate(),
													}
												},
											"upsert": true
										}}
									});

				/** for Save new selected cuisine details **/
				await restaurant_cuisines.bulkWrite(updatedData);
					
				/** Send success response */
				req.flash(Constants.STATUS_SUCCESS,res.__("cuisines.cuisines_has_been_selected_successfully"));
				res.send({
					status: Constants.STATUS_SUCCESS,
					message: res.__("cuisines.cuisines_has_been_selected_successfully")
				});
			}else{
				asyncParallel({
					cuisines: (callback)=>{
						/** for get cuisines list for show in modal **/
						const cuisines = this.db.collection(Tables.CUISINES);
						cuisines.find({is_active: Constants.ACTIVE},{projection: { _id: 1, name: 1 }}).sort({name: Constants.SORT_ASC}).toArray().then(result=>{
							callback(null, result);
						}).catch(err=>{
							callback(err, []);
						});
					},
					selected_cuisines: (callback)=>{
						/** for get selected cuisnes **/
						const restaurant_cuisines = this.db.collection(Tables.RESTAURANT_CUISINES);
						restaurant_cuisines.find({restaurant_id: new ObjectId(restaurantId)}, { projection: { _id: 1, cuisine_id: 1 } }).toArray().then(selectedResult=>{
							callback(null, selectedResult);
						}).catch(err=>{
							callback(err, []);
						});
					}
				},(err, response)=>{
					if(err) return next(err);
					
					/** Render add page  **/
					res.render('select_cuisines', {
						layout				: false,
						result				: response?.cuisines || [],
						selected_cuisines	: response?.selected_cuisines || []
					});
				});
			}
		}catch(err){
			return next(err);
		}
	};//End selectCuisines()

	/**
	* Function for get linked tags
	*
	* @param req 	As 	Request Data
    * @param res 	As 	Response Data
    * @param next 	As 	Callback argument to the middleware function
	*
	* @return render
	*/
	async getLinkedTags (req,res,next){
		try{
			let cuisineId 	= (req.params.cuisine_id) ? new ObjectId(req.params.cuisine_id) : "";
			let restaurantId = req?.session?.user?.restaurant_id || "";

			/** for get linked tags **/
			const restaurant_categories = this.db.collection(Tables.RESTAURANT_CATEGORIES);
			let result = await restaurant_categories.find({
				restaurant_id: new ObjectId(restaurantId), 
				cuisine_id   : cuisineId 
			}, { projection: { _id: 1, tags: 1 } }).toArray();

			/** Render view linked tags  **/
			res.render('linked_tags',{
				layout  :	false,
				result  :   result
			});
		}catch(err){
			return next(err);
		}
	};//End getLinkedTags()
}

