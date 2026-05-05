import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, newDate, exportToExcel, configDatatable, currencyFormat } from '../../../../utils/index.mjs';

// Model for restaurants ranking management
export default class RestaurantsRankingManagement {
	constructor(db) {
		this.db = db;
	}

	/**
	* Function to get listing page
	*
	* @param req 	As Request Data
	* @param res 	As Response Data
	*
	* @return render/json
	*/
	async getRestaurantsRankingList(req,res,next){
		try{
			if(isPost(req)){
				let limit			= (req.body.length) 	? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 	= (req.body.start)  	? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     	= (req.body.from_date) 	? req.body.from_date 		:"";
				let toDate 	  	 	= (req.body.to_date)   	? req.body.to_date   		:"";
				let branchIds		= (req.body.branch_ids) ? req.body.branch_ids   	:[];
				let restaurantIds	= (req.body.restaurant_ids)	? req.body.restaurant_ids:[];
				let areaIds 		= (req.body.area_ids) 		? req.body.area_ids : [];
				let ranking 		= (req.body.ranking) 		? parseInt(req.body.ranking) : 0;
				const collection 	= this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);

				if(restaurantIds.constructor != Array) restaurantIds = [restaurantIds];
				if(branchIds.constructor != Array) 	branchIds	= [branchIds];
				if (areaIds.constructor != Array) areaIds = [areaIds];

				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);
				let queryLimit = { $sort: { total_amount : -1}};
				if (ranking != 0) queryLimit = { $limit: ranking };
				let commonConditions = {};
				/** Condition for date */
				if (fromDate != "" && toDate != "") {
					commonConditions["date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					};
				}

				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions,commonConditions);
				if(restaurantIds.length > 0) dataTableConfig.conditions.restaurant_id = {$in: arrayToObject(restaurantIds)};
				if(branchIds.length > 0) dataTableConfig.conditions.branch_id = {$in: arrayToObject(branchIds)};
				if (areaIds.length > 0) dataTableConfig.conditions.area_id = { $in: arrayToObject(areaIds) };

				asyncParallel({
					records :(callback)=>{
						collection.aggregate([
							{$match : dataTableConfig.conditions},
							{$lookup:	{
								"from" 			: 	Tables.RESTAURANT_BRANCHES,
								"localField" 	:	"branch_id",
								"foreignField" 	: 	"_id",
								"as" 			: 	"branch_details"
							}},
							{$addFields : {
								branch_name: {$arrayElemAt: ["$branch_details.name",0]},
							}},
							{$group : {
								_id					: {restaurant_id : "$restaurant_id",branch_id : "$branch_id", area_id:"$area_id"},
								total_amount		: {$sum  : "$total_amount" },
								branch_id			: {$first: "$branch_id"},
								restaurant_id		: {$first: "$restaurant_id"},
								restaurant_name		: {$last : "$restaurant_name"},
								branch_name			: {$first : "$branch_name"},
								area_id				: { $first: "$area_id" },
								area_name			: { $first: "$area_name" },

							}},
							{$sort 	: dataTableConfig.sort_conditions},
							queryLimit,
							{$skip 	: skip},
							{$limit : limit},
						]).toArray().then(result=>{
							callback(null,result);
						}).catch(next);
					},
					total_records:(callback)=>{
						/** Get total number of records **/
						collection.aggregate([
							{$match : commonConditions},
							{$group : {
								_id: { restaurant_id: "$restaurant_id", branch_id: "$branch_id", area_id: "$area_id"},
							}},
						]).toArray().then(countResult=>{
							callback(null, countResult.length);
						}).catch(next);
					},
					filter_records:(callback)=>{
						/** Get filtered records counting **/
						collection.aggregate([
							{$match : dataTableConfig.conditions},
							{$group : {
								_id: { restaurant_id: "$restaurant_id", branch_id: "$branch_id", area_id: "$area_id"},
							}},
							queryLimit
						]).toArray().then(countResult=>{
							callback(null, countResult.length);
						}).catch(next);
					}
				},(err, response)=>{
					/** Send response **/
					res.send({
						status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
						draw			: dataTableConfig.result_draw,
						data			: response.records,
						recordsFiltered	: response.filter_records,
						recordsTotal	: response.total_records,
					});
				});
			}else{

				/**Get dropdown list **/
				getDropdownList(req,res, next,{ collections :[ {
					collection : Tables.RESTAURANTS,
					columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
					conditions : {
						is_deleted	: Constants.NOT_DELETED
					},
				}] }).then(response=> {
					

					/** render listing page **/
					req.breadcrumbs(BREADCRUMBS['admin/report/restaurants_ranking_management']);
					res.render('restaurants_ranking_management',{
						restaurant_list : response?.final_html_data?.[0] || ""
					});
				}).catch(next);
			}
		}catch(error){
			return next(error);
		}
	};//End getRestaurantsRankingList()


	/**
	 *  Function for export restaurants ranking report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async exportRestaurantsRanking(req,res,next){
		try{
			let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
			let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";
			let sortingField  	= (req.query.sort_field) ? req.query.sort_field   	: "_id";
			let sortingDir 	 	= (req.query.sort_dir) ? req.query.sort_dir   		: "asc";
			let sortOrder		= (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;
			let branchIds		= (req.query.branch_ids) ? (req.query.branch_ids).split(",")   	: [];
			let restaurantIds	= (req.query.restaurant_ids)? (req.query.restaurant_ids).split(","): [];
			let areaIds 		= (req.query.area_ids) ? (req.query.area_ids).split(",") : [];
			let ranking 		= (req.query.ranking) ? parseInt(req.query.ranking) : 0;

			if(restaurantIds.constructor != Array) restaurantIds = [restaurantIds];
			if(branchIds.constructor != Array) 	branchIds	= [branchIds];
			if (areaIds.constructor != Array) areaIds = [areaIds];

			let queryLimit = { $sort: { total_amount: -1 } };
			if (ranking != 0) queryLimit = { $limit: ranking };

			let exportConditions	= {};
			let sortConditions		= {};
			sortConditions[sortingField] = sortOrder;

			/** Condition for date */
			if (fromDate != "" && toDate != "") {
				exportConditions["date"] = {
					$gte 	: newDate(fromDate),
					$lte 	: newDate(toDate),
				};
			}

			if(restaurantIds.length > 0) exportConditions.restaurant_id = {$in: arrayToObject(restaurantIds)};
			if(branchIds.length > 0) exportConditions.branch_id = {$in: arrayToObject(branchIds)};
			if (areaIds.length > 0) exportConditions.area_id = { $in: arrayToObject(areaIds) };
			/** Get details **/
			const branch_wise_processed_orders	= this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);
			branch_wise_processed_orders.aggregate([
				{$match : exportConditions},
				{$lookup:	{
					"from" 			: 	Tables.RESTAURANT_BRANCHES,
					"localField" 	:	"branch_id",
					"foreignField" 	: 	"_id",
					"as" 			: 	"branch_details"
				}},
				{$addFields : {
					branch_name: {$arrayElemAt: ["$branch_details.name",0]},
				}},
				{$group : {
					_id: { restaurant_id: "$restaurant_id", branch_id: "$branch_id", area_id: "$area_id"},
					total_amount		: {$sum  : "$total_amount" },
					branch_id			: {$first: "$branch_id"},
					restaurant_id		: {$first: "$restaurant_id"},
					restaurant_name		: {$last : "$restaurant_name"},
					branch_name			: {$first : "$branch_name"},
					area_id				: { $first: "$area_id" },
					area_name			: { $first: "$area_name" },

				}},
				{$sort 	: sortConditions},
				queryLimit,
			]).toArray().then(findResult=>{

				let temp			= [];
				let commonColls		= [];

				/** Define excel heading label **/

				commonColls	= [
					res.__("admin.report.restaurant_name"),
					res.__("admin.report.branch_name"),
					res.__("admin.report.area_name"),
					res.__("admin.report.total_amount"),
				];

				if(findResult && findResult.length > 0){
					findResult.map(records=>{
						let buffer =	[
							(records.restaurant_name)	? records.restaurant_name[Constants.DEFAULT_LANGUAGE_CODE] :"",
							(records.branch_name)		? records.branch_name[Constants.DEFAULT_LANGUAGE_CODE] 	:"",
							(records.area_name) 		? records.area_name[Constants.DEFAULT_LANGUAGE_CODE] : "",
							(records.total_amount)		? currencyFormat(records.total_amount) : currencyFormat(0),
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "RestaurantsRanking",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
	};// end exportRestaurantsRanking()
}
