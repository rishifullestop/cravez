import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, newDate, exportToExcel, configDatatable, currencyFormat, round } from '../../../../utils/index.mjs';

// Model for transmission time report
export default class TransmissionTimeReport {
	constructor(db) {
		this.db = db;
	}
	/**
	 * Function to get transmission time report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getTransmissionTimeReportList(req,res,next){ 
		try{
			if(isPost(req)){			
				let limit			= (req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 	= (req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     	= (req.body.from_date) 	? req.body.from_date 		: "";
				let toDate 	  	 	= (req.body.to_date)   	? req.body.to_date   		: "";
				let restaurantIds	= (req.body.restaurant_ids) ? req.body.restaurant_ids   : [];
				let branchIds		= (req.body.branch_ids)   	? req.body.branch_ids   	: [];				
		
				restaurantIds= (restaurantIds && restaurantIds.constructor === Array) ?restaurantIds :[restaurantIds];
				branchIds	= (branchIds && branchIds.constructor === Array) ?branchIds :[branchIds];
				
				const collection = 	this.db.collection(Tables.OPERATION_REPORTS);
			
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
				if(restaurantIds.length > 0) dataTableConfig.conditions.restaurant_id = {$in : arrayToObject(restaurantIds)};
				if(branchIds.length > 0) dataTableConfig.conditions.branch_id	= {$in : arrayToObject(branchIds)};
				
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
								_id					: {
									"restaurant_id" : "$restaurant_id",
									"branch_id" 	: "$branch_id",
								},
								branch_id			: {$first: "$branch_id"},
								total_orders		: {$sum : "$total_orders" },
								successful_orders	: {$sum : "$delivered_orders"},
								cancelled_orders	: {$sum: "$cancelled_orders"},
								sales				: {$sum : "$sales"},								
								transmission_time	: {$sum : "$transmission_time"},								
								manual_transmission	: {$sum : "$manual_transmission"},								
								total_branch_transmission_time	: {$sum : "$branch_transmission_time"},		
								branch_name			: {$first : "$branch_name"},	
								restaurant_name		: {$first : "$restaurant_name"},							
							}},
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
								_id	: {
									"restaurant_id" : "$restaurant_id",
									"branch_id" 	: "$branch_id",
								},
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
								_id		: {
									"restaurant_id" : "$restaurant_id",
									"branch_id" 	: "$branch_id",
								},
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
					req.breadcrumbs(BREADCRUMBS['admin/report/transmission_time_report']);
					res.render('transmission_time_report',{
						restaurant_list : response?.final_html_data?.[0] || "",
					});
				}).catch(next);
			}
		}catch(error){
			return next(error);
		}
	};//End getTransmissionTimeReportList()
	
	/**
	 *  Function for transmission time report export
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async getTransmissionTimeReportExport(req,res,next){
		try{
			let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
			let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";		
			let restaurantIds	= (req.query.restaurant_ids)? (req.query.restaurant_ids).split(","): [];
			let branchIds		= (req.query.branch_ids) ? (req.query.branch_ids).split(",")   	: [];
			
			if(restaurantIds.constructor != Array) restaurantIds = [restaurantIds];			
			if(branchIds.constructor != Array) 	branchIds	= [branchIds];
			
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
			
			/** Get order details **/
			const operation_reports	= this.db.collection(Tables.OPERATION_REPORTS);
			operation_reports.aggregate([
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
					_id					:  {
						"restaurant_id" : "$restaurant_id",
						"branch_id" 	: "$branch_id",
					},
					branch_id			: {$first: "$branch_id"},
					total_orders		: {$sum : "$total_orders" },
					successful_orders	: {$sum : "$delivered_orders"},
					cancelled_orders	: {$sum: "$cancelled_orders"},
					sales				: {$sum : "$sales"},								
					transmission_time	: {$sum : "$transmission_time"},								
					manual_transmission	: {$sum : "$manual_transmission"},								
					total_branch_transmission_time	: {$sum : "$branch_transmission_time"},		
					branch_name			: {$first : "$branch_name"},	
					restaurant_name		: {$first : "$restaurant_name"},						
				}},
			]).toArray().then(findResult=>{

				let temp		= [];
				let commonColls	= [];

				/** Define excel heading label **/
				commonColls	= [
					res.__("admin.report.restaurant_name"),
					res.__("admin.report.branch_name"),
					res.__("admin.report.total_orders"),
					res.__("admin.report.successful_orders"),				
					res.__("admin.report.cancelled_orders"),				
					res.__("admin.report.fail_rate"),						
					res.__("admin.report.average_order_value"),						
					res.__("admin.report.sales"),						
					res.__("admin.report.transmission_time_sec"),						
					res.__("admin.report.contact_per_order"),						
					res.__("admin.report.manual_transmission_percentage"),						
					res.__("admin.report.total_branch_transmission_time"),						
				];

				if(findResult && findResult.length > 0){
					findResult.map(records=>{
						let buffer =	[
							(records.restaurant_name)	? 	records.restaurant_name[Constants.DEFAULT_LANGUAGE_CODE] 		:"",
							(records.branch_name)		? records.branch_name[Constants.DEFAULT_LANGUAGE_CODE] 		:"",
							(records.total_orders)		? round(records.total_orders) : 0,						
							(records.successful_orders)	? round(records.successful_orders) : 0,						
							(records.cancelled_orders)	? round(records.cancelled_orders) : 0,						
							(records.cancelled_orders)	? round((records.cancelled_orders/records.total_orders)*100)+""+res.__("admin.report.percent") : 0,
							(records.sales)				? currencyFormat(records.sales/records.successful_orders) : currencyFormat(0),
							(records.sales)				? currencyFormat(records.sales) : currencyFormat(0),
							(records.transmission_time) ? round(records.transmission_time*Constants.SECONDS_IN_A_MINUTE) : 0,
							(records.contacted_orders)	? round(records.contacted_orders/records.total_orders) : 0,
							(records.manual_transmission)	? round((records.manual_transmission/records.total_orders)*100)+""+res.__("admin.report.percent") : 0,
							(records.total_branch_transmission_time)	? records.total_branch_transmission_time : 0,
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "TransmissionTimeReport",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
	};// end getTransmissionTimeReportExport()
}
