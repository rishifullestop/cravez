import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, newDate, exportToExcel, configDatatable, currencyFormat } from '../../../../utils/index.mjs';

// Model for average customer order value report
export default class AverageCustomerOrderValueReport {
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
    async getAvgCustomerOrderValueList(req,res,next){
		try {
			if(isPost(req)){
				let limit			= (req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 	= (req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     	= (req.body.from_date) 	    ? req.body.from_date 		: "";
				let toDate 	  	 	= (req.body.to_date)   	    ? req.body.to_date   		: "";
				let restaurantIds	= (req.body.restaurant_ids) ? req.body.restaurant_ids   : [];
				let branchIds		= (req.body.branch_ids)   	? req.body.branch_ids   	: [];
				let areaIds			= (req.body.area_ids)   	? req.body.area_ids   		: [];
				
		
				restaurantIds= (restaurantIds && restaurantIds.constructor === Array) ?restaurantIds :[restaurantIds];
				branchIds	= (branchIds && branchIds.constructor === Array) ?branchIds :[branchIds];
				areaIds		= (areaIds && areaIds.constructor === Array) ?areaIds :[areaIds];
				
				const orders = 	this.db.collection(Tables.ORDERS);
			
				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);
				let commonConditions = {
					admin_status: Constants.ORDER_DELIVERED
				};
				/** Condition for date */
				if (fromDate != "" && toDate != "") {
					commonConditions["order_date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					};
				}
				dataTableConfig.conditions	= Object.assign(dataTableConfig.conditions, commonConditions);
				if(restaurantIds.length > 0) dataTableConfig.conditions.restaurant_id = {$in : arrayToObject(restaurantIds)};
				if(branchIds.length > 0) dataTableConfig.conditions.branch_id	= {$in : arrayToObject(branchIds)};
				if(areaIds.length > 0) dataTableConfig.conditions.area_id 		= {$in : arrayToObject(areaIds)};
				
				asyncParallel({
					records :(callback)=>{						
						/** Get list of**/
						orders.aggregate([
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
								_id				: {restaurant_id : "$restaurant_id",branch_id : "$branch_id",area_id : "$area_id"},
								total_amount    : { $sum: "$order_price" },
								branch_id		: {$first: "$branch_id"},
								area_id			: {$first: "$area_id"},
								restaurant_id	: {$first: "$restaurant_id"},
								branch_name		: {$first : "$branch_name"},								
								area_name		: {$last : "$area_name"},								
								restaurant_name	: {$last : "$restaurant_name"},	
								customer_count  :  {$sum : 1}															
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
						orders.aggregate([
							{$match : commonConditions},							
							{$group : {
								_id	: {restaurant_id : "$restaurant_id",branch_id : "$branch_id",area_id : "$area_id"},
							}}
						]).toArray().then(countResult => {
							callback(null, countResult.length);
						}).catch(next);
					},
					filter_records:(callback)=>{
						/** Get filtered records counting **/
						orders.aggregate([
							{$match : dataTableConfig.conditions},							
							{$group : {
								_id	: {restaurant_id : "$restaurant_id",branch_id : "$branch_id",area_id : "$area_id"},
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
				/** Set dropdown options **/
				let options = {
					collections :[
						{
							collection : Tables.RESTAURANTS,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions : {
								is_deleted	: Constants.NOT_DELETED
							},
						},
					]
				};

				/**Get dropdown list **/
				getDropdownList(req,res, next,options).then(response=> {
					
					/** render listing page **/
					req.breadcrumbs(BREADCRUMBS['admin/report/average_customer_order_value_report']);
					res.render('average_customer_order_value_report',{
						restaurant_list : response?.final_html_data?.[0] || "",
					});
				}).catch(next);
			}
		} catch (error) {
			next(error);
		}
    };//End getAvgCustomerOrderValueList()

	/**
	 *  Function for export average daily number of orders report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async avgCustomerOrderValueReportExport(req,res,next){
		try {
			let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
			let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";			
			let sortingField  	= (req.query.sort_field)	? req.query.sort_field   	: "_id";			
			let sortingDir 	 	= (req.query.sort_dir)		? req.query.sort_dir   		: "asc";
			let sortOrder		= (sortingDir == 'asc')		? Constants.SORT_ASC : Constants.SORT_DESC;
			let restaurantIds	= (req.query.restaurant_ids)? (req.query.restaurant_ids).split(",") : [];
			let branchIds		= (req.query.branch_ids)	? (req.query.branch_ids).split(",")   	: [];
			let areaIds			= (req.query.area_ids)   	? (req.query.area_ids).split(",")   	: [];
			
			restaurantIds= (restaurantIds && restaurantIds.constructor === Array) ?restaurantIds :[restaurantIds];
			branchIds	= (branchIds && branchIds.constructor === Array) ?branchIds :[branchIds];
			areaIds		= (areaIds && areaIds.constructor === Array) ?areaIds :[areaIds];
		
			
			let exportConditions 	= { admin_status: Constants.ORDER_DELIVERED};
			let sortConditions		= {};
			sortConditions[sortingField] = sortOrder;
			
			if (fromDate != "" && toDate != "") {
				exportConditions["order_date"] = {
					$gte 	: newDate(fromDate),
					$lte 	: newDate(toDate),
				};
			}
			
			if(restaurantIds.length > 0) exportConditions.restaurant_id = {$in : arrayToObject(restaurantIds)};
			if(branchIds.length > 0) exportConditions.branch_id	= {$in : arrayToObject(branchIds)};
			if(areaIds.length > 0) exportConditions.area_id 	= {$in : arrayToObject(areaIds)};
				
			/** Get order details **/
			const orders = this.db.collection(Tables.ORDERS);
			orders.aggregate([
				{$match : exportConditions},						
				{
					$lookup: {
						"from"			: Tables.RESTAURANT_BRANCHES,
						"localField"	: "branch_id",
						"foreignField"	: "_id",
						"as"			: "branch_details"
					}
				},
				{
					$addFields: {
						branch_name: { $arrayElemAt: ["$branch_details.name", 0] },
					}
				},
				{
					$group: {
						_id				: { restaurant_id: "$restaurant_id", branch_id: "$branch_id", area_id: "$area_id" },
						total_amount	: { $sum: "$order_price" },
						branch_id		: { $first: "$branch_id" },
						area_id			: { $first: "$area_id" },
						restaurant_id	: { $first: "$restaurant_id" },
						branch_name		: { $first: "$branch_name" },
						area_name		: { $last: "$area_name" },
						restaurant_name	: { $last: "$restaurant_name" },
						customer_count	: { $sum: 1 }
					}
				},
				{$sort 	: sortConditions},	
			]).toArray().then(findResult => {

				let temp			= [];
				let commonColls		= [];

				/** Define excel heading label **/
				commonColls		= 	[
					res.__("admin.report.restaurant_name"),
					res.__("admin.report.branch"),
					res.__("admin.report.area_name"),
					res.__("admin.report.total_customers"),
					res.__("admin.report.total_amount"),
					res.__("admin.report.average_value"),
				];
		

				if(findResult && findResult.length > 0){
					findResult.map(records=>{
						let buffer =	[
							(records.restaurant_name) ?  records.restaurant_name[Constants.DEFAULT_LANGUAGE_CODE] :"",
							(records.branch_name)   ?  records.branch_name[Constants.DEFAULT_LANGUAGE_CODE]       :"",
							(records.area_name)  	?  records.area_name[Constants.DEFAULT_LANGUAGE_CODE]      :"",
							(records.customer_count)? records.customer_count : 0,
							(records.total_amount)	?  currencyFormat(records.total_amount) :0,
							(records.total_amount && records.customer_count) ? currencyFormat(records.total_amount / records.customer_count) :0,
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "averageCustomerOrderValueReport",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		} catch (error) {
			next(error);
		}
    }// end avgCustomerOrderValueReportExport()
}