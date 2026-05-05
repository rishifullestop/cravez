import { ObjectId } from 'mongodb';
import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList, newDate, exportToExcel, configDatatable, getDifferenceBetweenTwoDatesInMinute, round } from '../../../../utils/index.mjs';

// Model for captain wise processed orders report
export default class CaptainWiseProcessedOrdersReport {
	constructor(db) {
		this.db = db;
	}
	
	/**
	 * Function to get captain wise orders
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getCaptainOrdersReportList(req,res,next){
		try {
			if(isPost(req)){
				let limit		 = 	(req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 = 	(req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     = 	(req.body.from_date) 	? req.body.from_date 		:"";
				let toDate 	  	 = 	(req.body.to_date)   	? req.body.to_date   		:"";
				const collection = 	this.db.collection(Tables.CAPTAIN_WISE_PROCESSED_ORDERS);
				
				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);

				/** Condition for date */
				if (fromDate != "" && toDate != "") {
					dataTableConfig.conditions["date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					};
				}
				
				asyncParallel({
					records :(callback)=>{
						/** Get list of captain wise processed orders**/
						collection.aggregate([
							{$match : dataTableConfig.conditions},												
							{$lookup:	{
								"from" 			: 	Tables.USERS,
								"localField" 	:	"captain_id",
								"foreignField" 	: 	"_id",
								"as" 			: 	"driver_details"
							}},
							{$addFields : {
								captain_name: {$arrayElemAt: ["$driver_details.full_name",0]},
							}},
							{$group : {
								_id					: "$captain_id",
								orders				: {$sum : "$orders" },
								delayed_orders		: {$sum : "$delayed_orders"},
								captain_id			: {$first : "$captain_id"},
								captain_name		: {$first : "$captain_name"},								
							}},
							{$sort 	: dataTableConfig.sort_conditions},		
							{$skip 	: skip},
							{$limit : limit},
						]).toArray().then(result => {							
							callback(null,result);
						}).catch(next);
					},
					filter_records:(callback)=>{
						/** Get filtered records counting **/
						collection.aggregate([
							{$match : dataTableConfig.conditions},							
							{$group : {
								_id	: "$captain_id",
							}}
						]).toArray().then(countResult => {	
							callback(null, countResult.length);
						}).catch(next);
					}
				},(err, response)=>{
					let difference	= getDifferenceBetweenTwoDatesInMinute(newDate(fromDate),newDate(toDate));
					let days		= (difference/Constants.MINUTES_IN_A_HOUR)/Constants.HOURS_IN_A_DAY;
					/** Send response **/
					res.send({
						status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
						draw			: dataTableConfig.result_draw,
						data			: response.records,
						recordsFiltered	: response.filter_records,
						recordsTotal	: response.filter_records,
						difference		: days
					});
				});
			}else{
				/** Set dropdown options **/
				let options = {
					collections :[
						{
							collection : Tables.USERS,
							columns    : ["_id","full_name"],
							conditions : Constants.DRIVER_COMMON_CONDITIONS,
						},
					]
				};

				/**Get dropdown list **/
				getDropdownList(req,res, next,options).then(response=> {
					/** render listing page **/
					req.breadcrumbs(BREADCRUMBS['admin/report/captain_wise_order_report']);
					res.render('captain_wise_processed_orders',{
						driver_list  : response?.final_html_data?.[0] || "",
					});
				}).catch(next);
			}
		} catch (error) {
			next(error);
		}
	};//End getCaptainOrdersReportList()	
	
	
	/**
	 *  Function for captain wise processed orders detials
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async captianOrderExport(req,res,next){
		try {
			let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
			let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";	
			let driverId 		= (req.query.driver_id) ? req.query.driver_id : "";	
			
			/** conditions **/
			let exportConditions = {};
			/** Condition for date */
			if (fromDate != "" && toDate != "") {
				exportConditions["date"] = {
					$gte: newDate(fromDate),
					$lte: newDate(toDate),
				};
			}
			if (driverId) exportConditions.captain_id = new ObjectId(driverId);
			let sortConditions = {};
			sortConditions['_id'] = Constants.SORT_DESC;

			let diffDays = 1;
			if (fromDate && toDate){
				let difference = getDifferenceBetweenTwoDatesInMinute(fromDate, toDate);
				diffDays		= (difference/Constants.MINUTES_IN_A_HOUR)/Constants.HOURS_IN_A_DAY;
			}
			/** Get order details **/
			const captain_wise_processed_orders	= this.db.collection(Tables.CAPTAIN_WISE_PROCESSED_ORDERS);
			captain_wise_processed_orders.aggregate([
				{ $match: exportConditions},			
				{$lookup:	{
					"from" 			: 	Tables.USERS,
					"localField" 	:	"captain_id",
					"foreignField" 	: 	"_id",
					"as" 			: 	"driver_details"
				}},
				{$addFields : {
					captain_name: {$arrayElemAt: ["$driver_details.full_name",0]},
				}},
				{$group : {
					_id					: "$captain_id",
					orders				: {$sum : "$orders" },
					delayed_orders		: {$sum : "$delayed_orders"},
					captain_id			: {$first : "$captain_id"},
					captain_name		: {$first : "$captain_name"},								
				}},
				{$sort 	: sortConditions},
			]).toArray().then(findResult => {

				let temp			= [];
				let commonColls		= [];

				/** Define excel heading label **/
				commonColls	= [
					res.__("admin.report.captain_name"),
					res.__("admin.report.total_orders"),
					res.__("admin.report.delayed_orders"),
					res.__("admin.report.average_orders"),				
				];

				if(findResult && findResult.length > 0){
					findResult.map(records=>{
						let buffer =	[
							(records.captain_name)	? records.captain_name 		:"",
							(records.orders)		? round(records.orders) : 0,						
							(records.delayed_orders)? round(records.delayed_orders) : 0,
							(records.orders)		? round(records.orders/diffDays) : 0,
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "captianOrderExport",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		} catch (error) {
			next(error);
		}
	};// end captianOrderExport()
}

