import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, newDate, exportToExcel, configDatatable, round } from '../../../../utils/index.mjs';

// Model for driver productivity report
export default class DriverProductivityReport {
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
    async getDriverProductivityReportList(req,res,next){
		try{
			if(isPost(req)){
				let limit			= (req.body.length) 	? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 	= (req.body.start)  	? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     	= (req.body.from_date) 	? req.body.from_date 		:"";
				let toDate 	  	 	= (req.body.to_date)   	? req.body.to_date   		:"";
				const captain_wise_processed_orders = this.db.collection(Tables.CAPTAIN_WISE_PROCESSED_ORDERS);

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

				dataTableConfig.conditions	=	Object.assign(commonConditions,dataTableConfig.conditions);				
				asyncParallel({
					records :(callback)=>{
						/** Get list **/
						captain_wise_processed_orders.aggregate([
							{$match : dataTableConfig.conditions},						
							{
								$lookup: {
									"from"			: Tables.USERS,
									"localField"	: "captain_id",
									"foreignField"	: "_id",
									"as"			: "user_details"
								}
							},							
							{$addFields : {
								captain_name			: { $arrayElemAt: ["$user_details.full_name", 0] },
							}},
							{$group : {
								_id             :  "$captain_id",
								orders          : { $sum: "$orders" },
								captain_name    : { $first: "$captain_name"},
								working_hours   : { $sum: "$working_hours" },
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
						captain_wise_processed_orders.aggregate([
							{ $match: commonConditions },
							{
								$group: {
									_id: "$captain_id",
								}
							}
						]).toArray().then(countResult=>{
							callback(null, countResult.length);
						}).catch(next);
					},
					filter_records:(callback)=>{
						/** Get filtered records counting **/
						captain_wise_processed_orders.aggregate([
							{ $match: dataTableConfig.conditions },
							{
								$group: {
									_id: "$captain_id",
								}
							}
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
				/** render listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/report/driver_productivity_report']);
				res.render('driver_productivity_report');
			}
		}catch(error){
			return next(error);
		}
    };//End getDriverProductivityReportList()
	
	/**
	 *  Function for Delivery Time Analysis export
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async getDriverProductivityReportExport(req,res,next){
		try{
			let fromDate 		= (req.query.from_date) ? req.query.from_date : "";
			let toDate 			= (req.query.to_date) ? req.query.to_date : "";
			let sortingField 	= (req.query.sort_field) ? req.query.sort_field : "_id";
			let sortingDir 		= (req.query.sort_dir) ? req.query.sort_dir : "asc";
			let sortOrder 		= (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;
		
			let exportConditions = {};
			let sortConditions = {};
			sortConditions[sortingField] = sortOrder;

			if (fromDate != "" && toDate != "") {
				exportConditions["date"] = {
					$gte: newDate(fromDate),
					$lte: newDate(toDate),
				};
			}
			/** Get order details **/
			const captain_wise_processed_orders = this.db.collection(Tables.CAPTAIN_WISE_PROCESSED_ORDERS);
			captain_wise_processed_orders.aggregate([
				{ $match: exportConditions},
				{
					$lookup: {
						"from"          : Tables.USERS,
						"localField"    : "captain_id",
						"foreignField"  : "_id",
						"as"            : "user_details"
					}
				},
				{
					$addFields: {
						captain_name: { $arrayElemAt: ["$user_details.full_name", 0] },
					}
				},
				{
					$group: {
						_id         : "$captain_id",
						orders      : { $sum: "$orders" },
						captain_name: { $first: "$captain_name" },
						working_hours: { $sum: "$working_hours" },
					}
				},
				{ $sort: sortConditions },
			]).toArray().then(result=>{

				let temp			= [];
				let commonColls		= [];

				/** Define excel heading label **/
				commonColls	= [
					res.__("admin.report.captain_name"),
					res.__("admin.report.no_of_orders"),
					res.__("admin.report.working_hours"),
					res.__("admin.report.productivity"),
				];

				if (result && result.length > 0){
					result.map(records=>{
						let buffer =	[
							(records.captain_name)  ? records.captain_name : "",
							(records.orders)        ? records.orders : 0,
							(records.working_hours) ? round(records.working_hours) : 0,
							(records.working_hours && records.orders) ? round(records.orders/records.working_hours) : 0,
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "DriverProductivityReportExport",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
    };// end getDriverProductivityReportExport()
}
