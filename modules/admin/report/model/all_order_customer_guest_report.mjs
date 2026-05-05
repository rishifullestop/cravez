import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, newDate, exportToExcel, configDatatable, getDifferenceBetweenTwoDatesInMinute, round } from '../../../../utils/index.mjs';

// Model for all order by customer or guest report
export default class AllOrderCustomerAndGuestReport {

    constructor(db) {
        this.db = db;
    }

	/**
	 * Function to get all order by customer or guest
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getAllOrdersReportList(req,res,next){ 
		try {
			if(isPost(req)){			
				let limit			= (req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 	= (req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     	= (req.body.from_date) 	? req.body.from_date 		: "";
				let toDate 	  	 	= (req.body.to_date)   	? req.body.to_date   		: "";
				let restaurantIds	= (req.body.restaurant_ids) ? req.body.restaurant_ids   : [];
				let branchIds		= (req.body.branch_ids)   	? req.body.branch_ids   	: [];
				let areaIds			= (req.body.area_ids)   	? req.body.area_ids   		: [];
				
		
				restaurantIds= (restaurantIds && restaurantIds.constructor === Array) ?restaurantIds :[restaurantIds];
				branchIds	= (branchIds && branchIds.constructor === Array) ?branchIds :[branchIds];
				areaIds		= (areaIds && areaIds.constructor === Array) ?areaIds :[areaIds];
				
				const collection = 	this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);
			
				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);
				
				/** Condition for date */
				let commonConditions = {};
				if (fromDate != "" && toDate != "") {
					commonConditions["date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					};
				}
				
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions,commonConditions);
				if(restaurantIds.length > 0) dataTableConfig.conditions.restaurant_id = {$in : arrayToObject(restaurantIds)};
				if(branchIds.length > 0) dataTableConfig.conditions.branch_id	= {$in : arrayToObject(branchIds)};
				if(areaIds.length > 0) dataTableConfig.conditions.area_id 		= {$in : arrayToObject(areaIds)};
				
				asyncParallel({
					records :(callback)=>{	 				
						/** Get list of all orders of guest and customer **/
						collection.aggregate([
							{$match : dataTableConfig.conditions},
							{$sort 	: dataTableConfig.sort_conditions},							
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
								total_orders		: {$sum : "$total_orders" },
								guest_orders		: {$sum : "$guest_orders"},
								branch_id			: {$first: "$branch_id"},
								area_id				: {$first: "$area_id"},
								restaurant_id		: {$first: "$restaurant_id"},
								branch_name			: {$first : "$branch_name"},								
								area_name			: {$last : "$area_name"},								
								restaurant_name		: {$last : "$restaurant_name"},								
							}},
							{$skip 	: skip},
							{$limit : limit},
						]).toArray().then(result=>{ 
							callback(null,result);
						}).catch(err=>{
							callback(err,[]);
						});
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
						}).catch(err=>{
							callback(err, 0);
						});
					},
					filter_records:(callback)=>{
						/** Get filtered records counting **/
						collection.aggregate([
							{$match : dataTableConfig.conditions},							
							{$group : {
								_id		: "$restaurant_id",
							}}
						]).toArray().then(countResult=>{	
							callback(null, countResult.length);
						}).catch(err=>{
							callback(err, 0);
						});
					}
				},(err, response)=>{

					let difference	= getDifferenceBetweenTwoDatesInMinute(fromDate,toDate);
					difference		= (difference) ? difference : 0;
					let days		= Math.ceil((difference/Constants.MINUTES_IN_A_HOUR)/Constants.HOURS_IN_A_DAY);
					/** Send response **/					
					res.send({
						status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
						draw			: dataTableConfig.result_draw,
						data			: response.records,
						recordsFiltered	: response.filter_records,
						recordsTotal	: response.total_records,
						difference		: days
					});
				});
			}else{
				/**Get dropdown list **/
				getDropdownList(req,res, next,{
					collections :[
						{
							collection : Tables.RESTAURANTS,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions : {
								is_deleted	: Constants.NOT_DELETED
							},
						}
					]
				}).then(response=> {
					
					/** render listing page **/
					req.breadcrumbs(BREADCRUMBS['admin/report/all_order_customer_guest_report']);
					res.render('all_order_customer_guest_report',{
						restaurant_list : response?.final_html_data?.[0] || "",
					});
				}).catch(next);
			}			
		} catch (error) {
			return next(error);
		}
	};//End getAllOrdersReportList()
	
	/**
	 *  Function for all orders export
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async getAllOrdersReportExport(req,res,next){
		try{
			let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
			let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";		
			let restaurantIds	= (req.query.restaurant_ids)? (req.query.restaurant_ids).split(","): [];
			let branchIds		= (req.query.branch_ids) ? (req.query.branch_ids).split(",")   	: [];
			let areaIds			= (req.query.area_ids) ? (req.query.area_ids).split(",")   	: [];

			if(restaurantIds.constructor != Array) restaurantIds = [restaurantIds];			
			if(branchIds.constructor != Array) 	branchIds	= [branchIds];
			if(areaIds.constructor != Array) 	areaIds	= [areaIds];
			
			let exportConditions	= {};		
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
			
			let diffDays = 1;
			if(fromDate && toDate){
				let difference	= getDifferenceBetweenTwoDatesInMinute(fromDate,toDate);
				diffDays		= (difference/Constants.MINUTES_IN_A_HOUR)/Constants.HOURS_IN_A_DAY;
			}
			/** Get order details **/
			const branch_wise_processed_orders	= this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);
			branch_wise_processed_orders.aggregate([
				{$match : exportConditions},
				{$sort 	: {_id : Constants.SORT_DESC}},
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
					_id				: "$restaurant_id",
					total_orders	: {$sum : "$total_orders" },
					guest_orders	: {$sum : "$guest_orders"},
					branch_id		: {$first: "$branch_id"},
					area_id			: {$first: "$area_id"},
					restaurant_id	: {$first: "$restaurant_id"},
					branch_name		: {$first : "$branch_name"},								
					area_name		: {$last : "$area_name"},								
					restaurant_name	: {$last : "$restaurant_name"},								
				}},
			]).toArray().then(findResult=>{

				let temp		= [];
				let commonColls	= [];

				/** Define excel heading label **/
				commonColls	= [
					res.__("admin.report.restaurant_name"),
					res.__("admin.report.branch_name"),
					res.__("admin.report.area_name"),
					res.__("admin.report.total_orders"),				
					res.__("admin.report.customers_orders"),				
					res.__("admin.report.guest_orders"),						
				];

				if(findResult && findResult.length > 0){
					findResult.map(records=>{
						let buffer =	[
							(records.restaurant_name)	? records.restaurant_name[Constants.DEFAULT_LANGUAGE_CODE] 		:"",
							(records.branch_name)		? records.branch_name[Constants.DEFAULT_LANGUAGE_CODE] 		:"",
							(records.area_name)			? records.area_name[Constants.DEFAULT_LANGUAGE_CODE] 		:"",
							(records.total_orders)		? round(records.total_orders) : 0,						
							(records.total_orders)		? round(records.total_orders-records.guest_orders) : 0,
							(records.guest_orders)		? round(records.guest_orders) : 0
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "AllOrderByCustomerAndGuestReport ",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		} catch (error) {
			return next(error);
		}
	};// end getAllOrdersReportExport()
}
