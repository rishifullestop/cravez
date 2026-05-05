import { ObjectId } from 'mongodb';
import { parallel as asyncParallel } from 'async';
import BREADCRUMBS from "../../../../breadcrumbs.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { round, arrayToObject,isPost, getDropdownList, configDatatable, exportToExcel, currencyFormat, newDate} from "../../../../utils/index.mjs";

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
	async getTransmissionTimeReportList (req,res,next){
		try{
			let restaurantId = (req.session.user.restaurant_id) ? new ObjectId(req.session.user.restaurant_id) : '';
			if(isPost(req)){			
				let limit           = (req.body.length)         ? parseInt(req.body.length) : Constants.FRONT_LISTING_LIMIT;
				let skip		 	= (req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     	= (req.body.from_date) 	    ? req.body.from_date 		: "";
				let toDate 	  	 	= (req.body.to_date)   	    ? req.body.to_date   		: "";
				let branchIds		= (req.body.branch_ids)   	? req.body.branch_ids   	: [];
				
				branchIds	= (branchIds && branchIds.constructor === Array) ?branchIds :[branchIds];
				
				const collection = 	this.db.collection(Tables.OPERATION_REPORTS);
			
				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);
				
				let commonConditions = { restaurant_id: restaurantId };
				
				/** Condition for date */
				if (fromDate != "" && toDate != "") {
					commonConditions["date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					};
				}
				
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions,commonConditions);
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
							{$group : {
								_id					: {
									"restaurant_id" : "$restaurant_id",
									"branch_id" 	: "$branch_id",
								},
								branch_id			: {$first: "$branch_id"},
								total_orders		: {$sum : "$total_orders" },
								rejected_orders		: {$sum : "$rejected_orders" },
								successful_orders	: {$sum : "$delivered_orders"},
								cancelled_orders	: {$sum: "$cancelled_orders"},
								contacted_orders	: { $sum: "$contacted_orders"},
								sales				: {$sum : "$sales"},								
								transmission_time	: {$sum : "$transmission_time"},								
								manual_transmission	: {$sum : "$manual_transmission"},								
								total_branch_transmission_time	: {$sum : "$branch_transmission_time"},		
								branch_name			: {$first : {$arrayElemAt: ["$branch_details.name",0]}},	
								restaurant_name		: {$first : "$restaurant_name"},							
							}},
							{$skip 	: skip},
							{$limit : limit},
						]).toArray().then(result => { 
							callback(null,result);
						}).catch(err => {
							callback(err,null);
						});
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
						]).toArray().then(result => {
							callback(null, result?.length || 0);
						}).catch(err => {
							callback(err, 0);
						});
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
						]).toArray().then(result => {
							callback(null, result?.length || 0);
						}).catch(err => {
							callback(err, 0);
						});
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
				let dropdownList = await getDropdownList(req,res, next,{
					collections: [
						{
							collection	: Tables.RESTAURANT_BRANCHES,
							columns		: ["_id", ["name", Constants.DEFAULT_LANGUAGE_CODE]],
							conditions	: {
								restaurant_id	: restaurantId,
								is_active		: Constants.ACTIVE,
							},
						}
					]
				});				
					
				/** render listing page **/
				req.breadcrumbs(BREADCRUMBS['reports/transmission_time_report']);
				res.render('transmission_time_report',{
					branch_list: dropdownList?.final_html_data?.["0"] || "",
				});
			}
		} catch (error) {
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
    async getTransmissionTimeReportExport (req,res,next){
		try{
			let restaurantId    = (req.session.user.restaurant_id) ? new ObjectId(req.session.user.restaurant_id) : '';
			let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
			let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";		
			let branchIds		= (req.query.branch_ids) ? (req.query.branch_ids).split(",")   	: [];
			
			if(branchIds.constructor != Array) 	branchIds	= [branchIds];
			
			let exportConditions = { restaurant_id: restaurantId };			
			/** Condition for date */
			if (fromDate != "" && toDate != "") {
				exportConditions["date"] = {
					$gte 	: newDate(fromDate),
					$lte 	: newDate(toDate),
				};
			}
			
			if(branchIds.length > 0)	exportConditions.branch_id = {$in: arrayToObject(branchIds)};
			
			/** Get order details **/
			const operation_reports	= this.db.collection(Tables.OPERATION_REPORTS);
			let result = await operation_reports.aggregate([
				{$match : exportConditions},
				{$sort 	: {_id : Constants.SORT_DESC}},
				{$lookup:	{
					"from" 			: 	Tables.RESTAURANT_BRANCHES,
					"localField" 	:	"branch_id",
					"foreignField" 	: 	"_id",
					"as" 			: 	"branch_details"
				}},	
				{$group : {
					_id					:  {
						"restaurant_id" : "$restaurant_id",
						"branch_id" 	: "$branch_id",
					},
					branch_id			: {$first: "$branch_id"},
					total_orders		: {$sum : "$total_orders" },
					rejected_orders		: {$sum : "$rejected_orders" },
					successful_orders	: {$sum : "$delivered_orders"},
					cancelled_orders	: {$sum: "$cancelled_orders"},
					contacted_orders	: { $sum: "$contacted_orders"},
					sales				: {$sum : "$sales"},								
					transmission_time	: {$sum : "$transmission_time"},								
					manual_transmission	: {$sum : "$manual_transmission"},								
					total_branch_transmission_time	: {$sum : "$branch_transmission_time"},		
					branch_name			: {$first : {$arrayElemAt: ["$branch_details.name",0]}},							
				}},
			]).toArray();

			
			/** Define excel heading label **/
			let commonColls	= [
				res.__("reports.branch_name"),
				res.__("reports.total_orders"),
				res.__("reports.successful_orders"),
				res.__("reports.rejected_orders"),
				res.__("reports.cancelled_orders"),				
				res.__("reports.fail_rate"),						
				res.__("reports.average_order_value"),						
				res.__("reports.sales"),						
				res.__("reports.transmission_time_sec"),						
				res.__("reports.contact_per_order"),						
				res.__("reports.manual_transmission_percentage"),						
				res.__("reports.total_branch_transmission_time"),						
			];
			
			let temp = [];
			if(result && result.length > 0){
				result.map(records=>{
					temp.push([
						records?.branch_name?.[Constants.DEFAULT_LANGUAGE_CODE] || "",
						(records.total_orders)		? round(records.total_orders) : 0,						
						(records.successful_orders)	? round(records.successful_orders) : 0,	
						(records.rejected_orders)	? round(records.rejected_orders) : 0,					
						(records.cancelled_orders)	? round(records.cancelled_orders) : 0,						
						(records.cancelled_orders)	? round((records.cancelled_orders/records.total_orders)*100)+""+res.__("reports.percent") : 0,
						(records.sales)				? currencyFormat(records.sales/records.successful_orders) : currencyFormat(0),
						(records.sales)				? currencyFormat(records.sales) : currencyFormat(0),
						(records.transmission_time) ? round(records.transmission_time*Constants.SECONDS_IN_A_MINUTE) : 0,
						(records.contacted_orders) ? round((records.contacted_orders / records.total_orders) * 100) + "" + res.__("reports.percent") : 0,
						(records.manual_transmission)	? round((records.manual_transmission/records.total_orders)*100)+""+res.__("reports.percent") : 0,
						(records.total_branch_transmission_time) ? round(records.total_branch_transmission_time) : 0,
					]);
				});
			}

			/**  Function to export data in excel format **/
			exportToExcel(req,res,{
				file_prefix 		: "TransmissionTimeReport",
				heading_columns		: commonColls,
				export_data			: temp
			});
		} catch (error) {
			return next(error);
		}
	};// end getTransmissionTimeReportExport()	
}