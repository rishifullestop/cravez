import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, newDate, exportToExcel, configDatatable, round } from '../../../../utils/index.mjs';

// Model for order frequency report
export default class OrderFrequencyReport {
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
	async getOrderFrequencyReport(req,res,next){
		try{
			if(isPost(req)){			
				let limit		 = (req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 = (req.body.start)  ? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;			
				let orderCount 	 = (req.body.order_count)   ? req.body.order_count   	:"";			
				let fromDate     = (req.body.from_date) 	? req.body.from_date 		: "";
				let toDate 	  	 = (req.body.to_date)   	? req.body.to_date   		: "";	
				
				const collection = this.db.collection(Tables.ORDERS);
				
				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);
				
				/** Set common condition */
				let commonConditions = {						
					admin_status: Constants.ORDER_DELIVERED
				};
				if(fromDate != "" && toDate != "") {
					commonConditions["order_date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					};
				}	
				
				let orderCountCondition		= {};
				let validIntRegx			= /^[0-9]+$/;
				if(orderCount && validIntRegx.test(orderCount)) orderCountCondition.order_count = parseInt(orderCount);
				dataTableConfig.conditions	= Object.assign(dataTableConfig.conditions, commonConditions);					
				asyncParallel({
					records :(callback)=>{
						/** Get list **/
						collection.aggregate([
							{$match : dataTableConfig.conditions},								
							{$sort 	: {order_date : Constants.SORT_DESC}},
							{$group : {
								_id				: "$customer_id",
								customer_id		: {$first : "$customer_id"},
								full_name 		: {$first : "$full_name"},
								mobile_number  	: {$first : "$mobile_number"},
								order_count		: {$sum : 1},
							}},						
							{$match : orderCountCondition},
							{$sort 	: dataTableConfig.sort_conditions},
							{$skip 	: skip},
							{$limit : limit},
						]).toArray().then(result=>{								
							callback(null, result);
						}).catch(next);
					},
					records_total: (callback)=>{						
						/** Get total number of records **/
						collection.aggregate([
							{$match: commonConditions},
							{$group:{
								_id	: "$customer_id",								
							}},							
							{$count : "count"},
						]).toArray().then(countResult=>{
							countResult = (countResult && countResult[0] && countResult[0].count)	?	countResult[0].count :0;
							callback(null, countResult);
						}).catch(next);
					},
					records_filtered: (callback)=>{
						/** Get filtered records counting   **/
						collection.aggregate([
							{$match : dataTableConfig.conditions},
							{$group:{
								_id			: "$customer_id",								
								order_count	: {$sum : 1},
							}},
							{$match : orderCountCondition},
							{$count : "count"},
						]).toArray().then(filterContResult=>{
							filterContResult = (filterContResult && filterContResult[0] && filterContResult[0].count)	?	filterContResult[0].count :0;
							callback(null,filterContResult);
						}).catch(next);
					}
				},(err, response)=>{
					/** Send response **/
					res.send({
						status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
						draw			: dataTableConfig.result_draw,
						data			: response.records,
						recordsFiltered	: response.records_filtered,
						recordsTotal	: response.records_total,
					});
				});
			}else{			
				/** render report listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/report/order_frequency_report']);
				res.render('order_frequency_report');
			}
		}catch(error){
			return next(error);
		}
	};//End getOrderFrequencyReport()

	/**
	 *  Function for export order frequency report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async orderFrequencyExport(req,res,next){
		try{
			let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
			let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";			
			let sortingField  	= (req.query.sort_field) ? req.query.sort_field   	: "_id";			
			let sortingDir 	 	= (req.query.sort_dir) ? req.query.sort_dir   		: "asc";
			let sortOrder		= (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;
			let orderCount 	 	= (req.query.order_count)   ? req.query.order_count   	:"";		
			
			
			/** Set common condition */
			let exportConditions = {						
				admin_status: Constants.ORDER_DELIVERED
			};
			let sortConditions			 = {};
			sortConditions[sortingField] = sortOrder;
			if(fromDate != "" && toDate != "") {
				exportConditions["order_date"] = {
					$gte 	: newDate(fromDate),
					$lte 	: newDate(toDate),
				};
			}		
			
			let orderCountCondition = {};
			let validIntRegx		= /^[0-9]+$/;
			if(orderCount && validIntRegx.test(orderCount)) orderCountCondition.order_count = parseInt(orderCount);

			/** Get order list for export **/
			const orders = this.db.collection(Tables.ORDERS);		
			orders.aggregate([
				{$match : exportConditions},
				{$sort 	: {order_date : Constants.SORT_DESC}},
				{$group : {
					_id				: "$customer_id",
					full_name 		: {$first : "$full_name"},
					mobile_number  	: {$first : "$mobile_number"},
					order_count		: {$sum : 1},				
				}},						
				{$match : orderCountCondition},
				{$sort 	: sortConditions},
			]).toArray().then(findResult=>{

				let temp			= [];
				let commonColls		= [];

				/** Define excel heading label **/
				commonColls	= [
					res.__("admin.report.customer_name"),
					res.__("admin.report.mobile_number"),			
					res.__("admin.report.orders"),			
				];

				if(findResult && findResult.length > 0){
					findResult.map(records=>{
						let buffer =	[
							(records.full_name) 		? records.full_name  :"",
							(records.mobile_number) 	? records.mobile_number  :"",
							(records.order_count)		? round(records.order_count) : 0,
						];
						temp.push(buffer);
					});
				} 

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "orderFrequencyExport",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
	};// end orderFrequencyExport()
}
