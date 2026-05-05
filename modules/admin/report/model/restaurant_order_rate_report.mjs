import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, newDate, exportToExcel, configDatatable, getDifferenceBetweenTwoDatesInMinute, round } from '../../../../utils/index.mjs';

// Model for restaurant order rate report
export default class RestaurantOrderRateReport {
	constructor(db) {
		this.db = db;
	}
	/**
	 * Function to get list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getBranchOrdersReportList(req,res,next){
		try{
			if(isPost(req)){
				let limit			= (req.body.length) 	? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 	= (req.body.start)  	? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     	= (req.body.from_date) 	? req.body.from_date 		:"";
				let toDate 	  	 	= (req.body.to_date)   	? req.body.to_date   		:"";
				let areaIds			= (req.body.area_ids)   ? req.body.area_ids   		:[];
				let branchIds		= (req.body.branch_ids) ? req.body.branch_ids   	:[];
				let restaurantIds	= (req.body.restaurant_ids)? req.body.restaurant_ids:[];
				const collection 	= this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);

				if(restaurantIds.constructor != Array) restaurantIds = [restaurantIds];
				if(areaIds.constructor != Array) 	areaIds 	= [areaIds];
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
				if(restaurantIds.length > 0) dataTableConfig.conditions.restaurant_id	= {$in: arrayToObject(restaurantIds)};
				if(branchIds.length > 0) dataTableConfig.conditions.branch_id			= {$in: arrayToObject(branchIds)};
				if(areaIds.length > 0) dataTableConfig.conditions.area_id				= {$in: arrayToObject(areaIds)};


				let difference	= getDifferenceBetweenTwoDatesInMinute(fromDate,toDate);
				difference		= (difference) ? (difference/(Constants.MINUTES_IN_A_HOUR*Constants.HOURS_IN_A_DAY)) : 0;
				let totalDays	= Math.ceil(difference);
				let totalHours	= totalDays*Constants.HOURS_IN_A_DAY;
				let totalWeek	= (Constants.DAYS_IN_A_WEEK/difference);
				let totalMonth	= (Constants.DAY_IN_A_MONTH/difference);

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
								_id					: "$restaurant_id",
								total_orders		: {$sum  : "$total_orders" },
								branch_id			: {$first: "$branch_id"},
								area_id				: {$first: "$area_id"},
								restaurant_id		: {$first: "$restaurant_id"},
								area_name			: {$last : "$area_name"},
								restaurant_name		: {$last : "$restaurant_name"},
								branch_name			: {$first : "$branch_name"},
							}},
							{$addFields: {
								per_hour_orders : { $divide: [ "$total_orders", totalHours ] },
								per_day_orders 	: { $divide: [ "$total_orders", totalDays ] },
								per_week_orders : { $multiply: [ "$total_orders", totalWeek ] },
								per_month_orders: { $multiply: [ "$total_orders", totalMonth ] },
							}},
							{$sort 	: dataTableConfig.sort_conditions},
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
								_id	: "$restaurant_id",
							}}
						]).toArray().then(countResult=>{
							callback(null, countResult.length);
						}).catch(next);
					},
					filter_records:(callback)=>{
						/** Get filtered records counting **/
						collection.aggregate([
							{$match : dataTableConfig.conditions},
							{$group : {
								_id	: "$restaurant_id",
							}}
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
				let response = await getDropdownList(req,res, next,{ collections :[ {
					collection : Tables.RESTAURANTS,
					columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
					conditions : {
						is_deleted	: Constants.NOT_DELETED
					},
				}] });

				/** render listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/report/restaurant_order_rate_report']);
				res.render('restaurant_order_rate_report',{
					restaurant_list : response?.final_html_data?.["0"] || "",
				});
			}
		}catch(error){
			return next(error);
		}
	};//End getBranchOrdersReportList()

	/**
	 * Function for get branch list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async branchDropdown(req,res,next){
		try{
			let restaurantIds	= req.body.restaurant_ids;
			if(restaurantIds.constructor != Array) restaurantIds = [restaurantIds];

			/** Send success response */
			if(restaurantIds.length == 0) return res.send({status: Constants.STATUS_SUCCESS, branch_list: "" });

			/**Get branch list **/
			let response = await getDropdownList(req,res, next,{ collections :[ {
				collection : Tables.RESTAURANT_BRANCHES,
				columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
				conditions : {
					restaurant_id : {$in : arrayToObject(restaurantIds)}
				},
			}] });

			/** Send success response */
			res.send({
				status       : Constants.STATUS_SUCCESS,
				branch_list  : response?.final_html_data?.["0"] || ""
			});
		}catch(error){
			return next(error);
		}
	};//End branchDropdown()


	/**
	 * Function for get branch list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async areaDropdown(req,res,next){
		try{
			let branchIds	= req.body.branch_ids;

			if(branchIds.constructor != Array) branchIds = [branchIds];

			/** Send success response */
			if(branchIds.length == 0) return res.send({status: Constants.STATUS_SUCCESS, area_list: "" });

			const restaurant_branch_areas = this.db.collection(Tables.RESTAURANT_BRANCH_AREAS);
			let areaIds = await restaurant_branch_areas.distinct("area_id",{branch_id : {$in : arrayToObject(branchIds)}});

			/** Send success response */
			if(areaIds.length == 0) return res.send({status: Constants.STATUS_SUCCESS, area_list: "" });

			/**Get area list **/
			let response = await getDropdownList(req,res, next,{collections :[ {
				collection : Tables.AREAS,
				columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
				conditions : {
					_id : {$in : arrayToObject(areaIds)}
				}
			}]});

			/** Send success response */
			res.send({
				status    : Constants.STATUS_SUCCESS,
				area_list :	response?.final_html_data?.["0"] || ""
			});
		}catch(error){
			return next(error);
		}
	};//End areaDropdown()

	/**
	 *  Function for petrol consumption detials
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async restaurantOrderRateExport(req,res,next){
		try{
			let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
			let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";
			let sortingField  	= (req.query.sort_field) ? req.query.sort_field   	: "_id";
			let sortingDir 	 	= (req.query.sort_dir) ? req.query.sort_dir   		: "asc";
			let sortOrder		= (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;
			let restaurantIds	= (req.query.restaurant_ids)? (req.query.restaurant_ids).split(","): [];
			let branchIds		= (req.query.branch_ids) ? (req.query.branch_ids).split(",")   	: [];
			let areaIds			= (req.query.area_ids) ? (req.query.area_ids).split(",")   	: [];

			if(restaurantIds.constructor != Array) restaurantIds = [restaurantIds];
			if(branchIds.constructor != Array) 	branchIds	= [branchIds];
			if(areaIds.constructor != Array) 	areaIds	= [areaIds];
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

			if(restaurantIds.length > 0)exportConditions.restaurant_id	= {$in: arrayToObject(restaurantIds)};
			if(branchIds.length > 0)	exportConditions.branch_id		= {$in: arrayToObject(branchIds)};
			if(areaIds.length > 0)		exportConditions.area_id		= {$in: arrayToObject(areaIds)};

			let diffDays 		= 1;
			let totalDays		= 0;
			let totalHours		= 0;
			let totalWeek		= 0;
			let totalMonth		= 0;

			if(fromDate && toDate){
				let difference	= getDifferenceBetweenTwoDatesInMinute(fromDate,toDate);
				diffDays		= (difference) ? (difference/(Constants.MINUTES_IN_A_HOUR*Constants.HOURS_IN_A_DAY)) : 0;
				totalDays		= Math.ceil(diffDays);
				totalHours		= totalDays*Constants.HOURS_IN_A_DAY;
				totalWeek		= (Constants.DAYS_IN_A_WEEK/diffDays);
				totalMonth		= (Constants.DAY_IN_A_MONTH/diffDays);
			}
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
					_id					: "$restaurant_id",
					total_orders		: {$sum  : "$total_orders" },
					branch_id			: {$first: "$branch_id"},
					area_id				: {$first: "$area_id"},
					restaurant_id		: {$first: "$restaurant_id"},
					area_name			: {$last : "$area_name"},
					restaurant_name		: {$last : "$restaurant_name"},
					branch_name			: {$first : "$branch_name"},
				}},
				{$addFields: {
					per_hour_orders : { $divide: [ "$total_orders", totalHours ] },
					per_day_orders 	: { $divide: [ "$total_orders", totalDays ] },
					per_week_orders : { $multiply: [ "$total_orders", totalWeek ] },
					per_month_orders: { $multiply: [ "$total_orders", totalMonth ] },
				}},
				{$sort 	: sortConditions},
			]).toArray().then(findResult=>{

				let temp			= [];
				let commonColls		= [];

				/** Define excel heading label **/
				commonColls	= [
					res.__("admin.report.restaurant_name"),
					res.__("admin.report.branch_name"),
					res.__("admin.report.area_name"),
					res.__("admin.report.per_hour_orders"),
					res.__("admin.report.per_day_orders"),
					res.__("admin.report.per_week_orders"),
					res.__("admin.report.per_month_orders"),
					res.__("admin.report.total_orders"),
				];

				if(findResult && findResult.length > 0){
					findResult.map(records=>{
						let buffer =	[
							(records.restaurant_name)	? 	records.restaurant_name[Constants.DEFAULT_LANGUAGE_CODE] 		:"",
							(records.branch_name)		? 	records.branch_name[Constants.DEFAULT_LANGUAGE_CODE] 		:"",
							(records.area_name)			? 	records.area_name[Constants.DEFAULT_LANGUAGE_CODE] 		:"",
							(records.per_hour_orders)	? 	round(records.per_hour_orders) : 0,
							(records.per_day_orders)	? 	round(records.per_day_orders) : 0,
							(records.per_week_orders)	? 	round(records.per_week_orders) : 0,
							(records.per_month_orders)	? 	round(records.per_month_orders) : 0,
							(records.total_orders)		? 	round(records.total_orders) : 0,
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "OrdersRatePerRestaurantExport",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
	};// end restaurantOrderRateExport()
}
