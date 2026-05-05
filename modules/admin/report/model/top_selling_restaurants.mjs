import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, newDate, exportToExcel, configDatatable, currencyFormat, round } from '../../../../utils/index.mjs';

// Model for top selling restaurants report
export default class TopSellingRestaurantsReport {
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
	async getTopsellingRestaurantList(req,res,next){
		try{
			if(isPost(req)){		
				let limit			= (req.body.length) 	? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 	= (req.body.start)  	? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     	= (req.body.from_date) 	? req.body.from_date 		:"";
				let toDate 	  	 	= (req.body.to_date)   	? req.body.to_date   		:"";			
				let branchIds		= (req.body.branch_ids) ? req.body.branch_ids   	:[];
				let restaurantIds	= (req.body.restaurant_ids)? req.body.restaurant_ids:[];
				const collection 	= this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);

				if(restaurantIds.constructor != Array) restaurantIds = [restaurantIds];			
				if(branchIds.constructor != Array) 	branchIds	= [branchIds];

				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);

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

				asyncParallel({
					records :(callback)=>{
						/** Get list of driver petrol consumption**/
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
								_id					: {restaurant_id : "$restaurant_id",branch_id : "$branch_id"},
								total_orders		: {$sum  : "$total_orders" },
								total_amount		: {$sum  : "$total_amount" },
								cravez_payout		: {$sum  : "$cravez_payout" },							
								branch_id			: {$first: "$branch_id"},								
								restaurant_id		: {$first: "$restaurant_id"},							
								restaurant_name		: {$last : "$restaurant_name"},
								branch_name			: {$first : "$branch_name"},	
							}},
							{$addFields : {
								avg_crv_commission 	: { $divide: [ "$cravez_payout", "$total_orders" ] },
								avg_check_value 	: { $divide: [ "$total_amount", "$total_orders" ] },
							}},
							{$sort 	: dataTableConfig.sort_conditions},
							{$skip 	: skip},
							{$limit : limit},
						]).toArray().then(result => {
							callback(null,result);
						}).catch(next);
					},
					total_records:(callback)=>{
						/** Get total number of records **/
						collection.aggregate([
							{$match : commonConditions},
							{$group : {
								_id	: {restaurant_id : "$restaurant_id",branch_id : "$branch_id"},
							}}
						]).toArray().then(countResult => {
							callback(null, countResult.length);
						}).catch(next);
					},
					filter_records:(callback)=>{
						/** Get filtered records counting **/
						collection.aggregate([
							{$match : dataTableConfig.conditions},
							{$group : {
								_id	: {restaurant_id : "$restaurant_id",branch_id : "$branch_id"},
							}}
						]).toArray().then(countResult => {
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
					req.breadcrumbs(BREADCRUMBS['admin/report/top_selling_restaurants']);
					res.render('top_selling_restaurants',{
						restaurant_list : response?.final_html_data?.[0] || ""
					});
				}).catch(next);
			}
		}catch(error){
			return next(error);
		}
	};//End getTopsellingRestaurantList()
	
	/**
	 *  Function for export report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async exportTopsellingRestaurants(req,res,next){
		try{
			let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
			let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";			
			let sortingField  	= (req.query.sort_field) ? req.query.sort_field   	: "_id";			
			let sortingDir 	 	= (req.query.sort_dir) ? req.query.sort_dir   		: "asc";
			let sortOrder		= (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;
			let branchIds		= (req.query.branch_ids) ? (req.query.branch_ids).split(",")   	: [];
			let restaurantIds	= (req.query.restaurant_ids)? (req.query.restaurant_ids).split(","): [];
			const collection 	= this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);

			if(restaurantIds.constructor != Array) restaurantIds = [restaurantIds];			
			if(branchIds.constructor != Array) 	branchIds	= [branchIds];
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
			
			/** Get order details **/
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
					_id					: {restaurant_id : "$restaurant_id",branch_id : "$branch_id"},
					total_orders		: {$sum  : "$total_orders" },
					total_amount		: {$sum  : "$total_amount" },
					cravez_payout		: {$sum  : "$cravez_payout" },							
					branch_id			: {$first: "$branch_id"},								
					restaurant_id		: {$first: "$restaurant_id"},							
					restaurant_name		: {$last : "$restaurant_name"},
					branch_name			: {$first : "$branch_name"},	
				}},
				{$addFields : {
					avg_crv_commission 	: { $divide: [ "$cravez_payout", "$total_orders" ] },
					avg_check_value 	: { $divide: [ "$total_amount", "$total_orders" ] },
				}},
				{$sort 	: sortConditions},
			]).toArray().then(findResult=>{

				let temp			= [];
				let commonColls		= [];

				/** Define excel heading label **/
				
				commonColls	= [
					res.__("admin.report.restaurant_name"),
					res.__("admin.report.branch_name"),
					res.__("admin.report.total_orders"),
					res.__("admin.report.total_amount"),
					res.__("admin.report.total_commission"),
					res.__("admin.report.avg_crv_commission"),
					res.__("admin.report.avg_check_value"),
				];

				if(findResult && findResult.length > 0){
					findResult.map(records=>{
						let buffer =	[
							(records.restaurant_name)	? records.restaurant_name[Constants.DEFAULT_LANGUAGE_CODE] :"",
							(records.branch_name)		? records.branch_name[Constants.DEFAULT_LANGUAGE_CODE] 	:"",				
							(records.total_orders)		? round(records.total_orders) : 0,
							(records.total_amount)		? currencyFormat(records.total_amount) : currencyFormat(0),
							(records.cravez_payout)		? currencyFormat(records.cravez_payout) : currencyFormat(0),
							(records.avg_crv_commission)? currencyFormat(records.avg_crv_commission) : currencyFormat(0),
							(records.avg_check_value)	? currencyFormat(records.avg_check_value) : currencyFormat(0),
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "TopsellingRestaurants",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
	};// end exportTopsellingRestaurants()
}
