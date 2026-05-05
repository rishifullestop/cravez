import clone from 'clone';
import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, arrayToObject, newDate, exportToExcel, configDatatable, subtractDate } from '../../../../utils/index.mjs';

// Model for customer churn report
export default class CustomerChurnReport {
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
	async getCustomerChurnReport(req,res,next){
		try{
			if(isPost(req)){			
				let limit		 = (req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 = (req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;			
				let orderCount 	 = (req.body.order_count)   ? req.body.order_count   	:"";
				let reportType 	 = (req.body.report_type)   ? req.body.report_type   	:Constants.COUNT_BASIS;
				let deliveryBy 	 = (req.body.delivery_by)   ? req.body.delivery_by   	:"";
				let fromDate     = (req.body.from_date) 	? req.body.from_date 		: "";
				let toDate 	  	 = (req.body.to_date)   	? req.body.to_date   		: "";	
				
				const collection = this.db.collection(Tables.ORDERS);
				
				/** Set order condition */
				let orderConditions = {admin_status : Constants.ORDER_DELIVERED};			
				/** Condition for order date */			
				if (fromDate != "" && toDate != "") {
					orderConditions["order_date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					};
				}							
				asyncParallel({
					all_customer:(callback)=>{
						/** Get customer ids  */
						collection.distinct("customer_id",orderConditions).then(orderIds=>{
							callback(null,orderIds);
						}).catch(next);
					},
					last_customers:(callback)=>{
						/** Get customer ids  */
						let cutOffDate = subtractDate(Constants.DAY_IN_A_MONTH*Constants.HOURS_IN_A_DAY);
						let customerCondition		= clone(orderConditions);
						customerCondition["order_date"]	= {$gte : newDate(cutOffDate)}; 
						collection.distinct("customer_id",customerCondition).then(orderIds=>{
							callback(null,orderIds);
						}).catch(next);
					},
				},async (asyncErr, asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					let allCustomers	= asyncResponse.all_customer;
					let lastCustomers	= asyncResponse.last_customers;
					
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
					
					commonConditions["$and"] = [
						{customer_id : { $in : arrayToObject(allCustomers)}},
						{customer_id : { $nin: arrayToObject(lastCustomers)}}
					];
					
					let orderCountCondition = {};
					if(orderCount){
						switch(orderCount){
							case Constants.ZERO_TO_ONE_ORDER:
								orderCountCondition.order_count = {$lte : 1};
							break;
							case Constants.TWO_TO_FOUR_ORDER:
								orderCountCondition.order_count = {$gte : 2, $lte : 4};
							break;
							case Constants.FIVE_TO_NINE_ORDER:
								orderCountCondition.order_count = {$gte : 5, $lte : 9};
							break;
							case Constants.MORE_THAN_TEN_ORDER:
								orderCountCondition.order_count = {$gte : 10};
							break;
						}
					}
					
					if(reportType == Constants.HIGH_VALUE_ORDER) orderCountCondition.net_amount = {$gte : Constants.HIGH_VALUE_ORDER_AMOUNT};
					if(reportType == Constants.SINGLE_ORDER_CUSTOMER && deliveryBy) orderCountCondition.delivery_type = deliveryBy;
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
									net_amount		: {$first : "$net_amount"},
									delivery_type	: {$first : "$delivery_type"},
									last_order_date	: {$first : "$order_date"}
								}},						
								{$match : orderCountCondition},
								{$sort 	: dataTableConfig.sort_conditions},
								{$skip 	: skip},
								{$limit : limit},
							]).toArray().then(findResult=>{
								callback(null, findResult);
							}).catch(next);
						},
						records_total: (callback)=>{
							let countCondition = {};
							if(reportType == Constants.HIGH_VALUE_ORDER || reportType == Constants.SINGLE_ORDER_CUSTOMER) countCondition = {order_count : 1};
							if(reportType == Constants.HIGH_VALUE_ORDER) countCondition.net_amount = {$gte : Constants.HIGH_VALUE_ORDER_AMOUNT};
							/** Get total number of records **/
							collection.aggregate([
								{$match: commonConditions},
								{$group:{
									_id	: "$customer_id",
									net_amount	: {$first : "$net_amount"},
									order_count	: {$sum : 1},
								}},
								{$match: countCondition},
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
									_id				: "$customer_id",
									net_amount		: {$first : "$net_amount"},
									delivery_type	: {$first : "$delivery_type"},
									order_count		: {$sum : 1},
								}},
								{$match : orderCountCondition},
								{$count : "count"},
							]).toArray().then(filterContResult=>{
								filterContResult = (filterContResult && filterContResult[0] && filterContResult[0].count)	?	filterContResult[0].count :0;
								callback(null, filterContResult);
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
				});
			}else{				
				/** render report listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/report/customer_churn_report']);
				res.render('customer_churn_report');
			}	
		}catch(error){
			return next(error);
		}
	};//End getCustomerChurnReport()

	/**
	 *  Function for export 
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async churnReportExport(req,res,next){
		try{
			let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
			let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";			
			let sortingField  	= (req.query.sort_field) ? req.query.sort_field   	: "_id";			
			let sortingDir 	 	= (req.query.sort_dir) ? req.query.sort_dir   		: "asc";
			let sortOrder		= (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;
			let orderCount 	 	= (req.query.order_count)   ? req.query.order_count   	:"";
			let reportType 	 	= (req.query.report_type)   ? req.query.report_type   	:Constants.COUNT_BASIS;
			let deliveryBy 	 	= (req.query.delivery_by)   ? req.query.delivery_by   	:"";
			
			/** Set order condition */
			let orderConditions = {admin_status : Constants.ORDER_DELIVERED};			
			/** Condition for order date */			
			if (fromDate != "" && toDate != "") {
				orderConditions["order_date"] = {
					$gte 	: newDate(fromDate),
					$lte 	: newDate(toDate),
				};
			}
			
			const orders	= this.db.collection(Tables.ORDERS);
			asyncParallel({
				all_customer:(callback)=>{
					/** Get customer ids  */
					orders.distinct("customer_id",orderConditions).then(orderIds=>{
						callback(null,orderIds);
					}).catch(next);
				},
				last_customers:(callback)=>{
					/** Get customer ids  */
					let cutOffDate = subtractDate(Constants.DAY_IN_A_MONTH*Constants.HOURS_IN_A_DAY);
					let customerCondition		= clone(orderConditions);
					customerCondition["order_date"]	= {$gte : newDate(cutOffDate)}; 
					orders.distinct("customer_id",customerCondition).then(orderIds=>{
						callback(null,orderIds);
					}).catch(next);
				},
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				let allCustomers	= asyncResponse.all_customer;
				let lastCustomers	= asyncResponse.last_customers;
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
				
				exportConditions["$and"] = [
					{customer_id : { $in : arrayToObject(allCustomers)}},
					{customer_id : { $nin: arrayToObject(lastCustomers)}}
				];
				
				let orderCountCondition = {};
				if(orderCount){
					switch(orderCount){
						case Constants.ZERO_TO_ONE_ORDER:
							orderCountCondition.order_count = {$lte : 1};
						break;
						case Constants.TWO_TO_FOUR_ORDER:
							orderCountCondition.order_count = {$gte : 2, $lte : 4};
						break;
						case Constants.FIVE_TO_NINE_ORDER:
							orderCountCondition.order_count = {$gte : 5, $lte : 9};
						break;
						case Constants.MORE_THAN_TEN_ORDER:
							orderCountCondition.order_count = {$gte : 10};
						break;
					}
				}
				
				if(reportType == Constants.HIGH_VALUE_ORDER) orderCountCondition.net_amount = {$gte : Constants.HIGH_VALUE_ORDER_AMOUNT};
				if(reportType == Constants.SINGLE_ORDER_CUSTOMER && deliveryBy) orderCountCondition.delivery_type = deliveryBy;
				orders.aggregate([
					{$match : exportConditions},
					{$sort 	: {order_date : Constants.SORT_DESC}},
					{$group : {
						_id				: "$customer_id",
						full_name 		: {$first : "$full_name"},
						mobile_number  	: {$first : "$mobile_number"},
						order_count		: {$sum : 1},
						net_amount		: {$first : "$net_amount"},
						delivery_type	: {$first : "$delivery_type"},
						last_order_date	: {$first : "$order_date"}
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
						res.__("admin.report.order_date"),			
					];

					if(findResult && findResult.length > 0){
						findResult.map(records=>{
							let buffer =	[
								(records.full_name) 		? records.full_name  :"",
								(records.mobile_number) 	? records.mobile_number  :"",
								(records.last_order_date)	? newDate(records.last_order_date,Constants.AM_PM_FORMAT_WITH_DATE) :"",
							];
							temp.push(buffer);
						});
					} 

					/**  Function to export data in excel format **/
					exportToExcel(req,res,{
						file_prefix 		: "churnReportExport",
						heading_columns		: commonColls,
						export_data			: temp
					});
				}).catch(next);
			});
		}catch(error){
			return next(error);
		}
	};// end churnReportExport()
}
