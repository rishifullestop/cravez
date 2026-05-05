import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, newDate, exportToExcel, configDatatable, currencyFormat, round } from '../../../../utils/index.mjs';

// Model for order value report
export default class OrderValueReport {
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
	async getOrderValueList(req,res,next){
		try{
			if(isPost(req)){			
				let limit			= (req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 	= (req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     	= (req.body.from_date) 	? req.body.from_date 		: "";
				let toDate 	  	 	= (req.body.to_date)   	? req.body.to_date   		: "";
				let restaurantIds	= (req.body.restaurant_ids) ? req.body.restaurant_ids   : [];
				let branchIds		= (req.body.branch_ids)   	? req.body.branch_ids   	: [];
				let cuisineIds		= (req.body.cuisine_ids)   	? req.body.cuisine_ids   	: [];
				let deliveryBy		= (req.body.delivery_by)   	? req.body.delivery_by   	: [];
				
				restaurantIds= (restaurantIds && restaurantIds.constructor === Array) ?restaurantIds :[restaurantIds];
				branchIds	= (branchIds && branchIds.constructor === Array) ?branchIds :[branchIds];
				cuisineIds	= (cuisineIds && cuisineIds.constructor === Array) ?cuisineIds :[cuisineIds];
				deliveryBy	= (deliveryBy && deliveryBy.constructor === Array) ?deliveryBy :[deliveryBy];

				const collection = 	this.db.collection(Tables.ORDER_CUISINE_REPORTS);
			
				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);
				let cuisineConditions = {};
				let commonConditions = {};
				/** Condition for order date */
				if (fromDate != "" && toDate != "") {
					commonConditions["date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					};
				}

				if(restaurantIds.length > 0) dataTableConfig.conditions.restaurant_id = {$in : arrayToObject(restaurantIds)};
				if(branchIds.length > 0) dataTableConfig.conditions.branch_id	= {$in : arrayToObject(branchIds)};
				if(cuisineIds.length > 0) cuisineConditions.cuisine_id	= {$in : arrayToObject(cuisineIds)};
				if(deliveryBy.length > 0) dataTableConfig.conditions.delivery_type	= {$in : deliveryBy};
				dataTableConfig.conditions	= Object.assign(dataTableConfig.conditions, commonConditions);
				
				asyncParallel({
					records :(callback)=>{
						let groupCondition = "$restaurant_id";
						
						/** Get list of order count **/
						collection.aggregate([
							{$match : dataTableConfig.conditions},
							{$lookup:	{
								"from" 			: 	Tables.RESTAURANT_BRANCHES,
								"localField" 	:	"branch_id",
								"foreignField" 	: 	"_id",
								"as" 			: 	"branch_details"
							}},	
							{$lookup: {	/** Get cuisine details **/
								from 		:	Tables.CUISINES,
								localField  :	"cuisine_id",
								foreignField:	"_id",
								as 		  	:	"cuisine_details"
							}},							
							{$addFields : {
								branch_name	: {$arrayElemAt: ["$branch_details.name."+Constants.DEFAULT_LANGUAGE_CODE,0]},
								cuisine_name: {$arrayElemAt: ["$cuisine_details.name."+Constants.DEFAULT_LANGUAGE_CODE,0]},
							}},							
							{$group : {
								_id				: {restaurant_id : "$restaurant_id",branch_id : "$branch_id",cuisine_id : "$cuisine_id"},
								total_amount	: {$sum : "$total_amount" },
								branch_id		: {$first: "$branch_id"},
								restaurant_id	: {$first: "$restaurant_id"},
								cuisine_id		: {$first: "$cuisine_id"},
								branch_name		: {$first: "$branch_name"},								
								cuisine_name	: {$first: "$cuisine_name"},						
								restaurant_name	: {$last : "$restaurant_name"},								
							}},
							{$group	: {
								_id  : groupCondition,
								data : { $push : "$$ROOT"},
								restaurant_amount : { $sum: "$total_amount"}
							}},
							{$unwind : "$data"},
							
							{$project: {
								_id:0, total_amount: "$data.total_amount",restaurant_name: "$data.restaurant_name."+Constants.DEFAULT_LANGUAGE_CODE, cuisine_id: "$data.cuisine_id",restaurant_id: "$data.restaurant_id", branch_id: "$data.branch_id", restaurant_amount:1, branch_name: "$data.branch_name", cuisine_name: "$data.cuisine_name", percentage: {$multiply:[{$divide:[100,"$restaurant_amount"]},"$data.total_amount"]}
							}},
							{$match : cuisineConditions},
							{$sort 	: dataTableConfig.sort_conditions},							
							{$skip 	: skip},
							{$limit : limit},
						]).toArray().then(result=>{
							callback(null, result);
						}).catch(next);
					},
					records_total: (callback)=>{
						/** Get total number of records in order cuisine reports  collection **/
						collection.aggregate([
							{$match	: commonConditions},
							{$group	: {
								_id :  {restaurant_id : "$restaurant_id",branch_id : "$branch_id",cuisine_id : "$cuisine_id"},
							}},
							{ $count	: "count" }
						]).toArray().then(countResult=>{
							let count = (countResult && countResult[0] && countResult[0].count) ? countResult[0].count : 0;
							callback(null, count);
						}).catch(next);
					},
					records_filtered: (callback)=>{
						/** Get filtered records counting in order cuisine reports   **/
						collection.aggregate([
							{$match	: dataTableConfig.conditions},
							{$match : cuisineConditions},
							{$group	: {
								_id  : {restaurant_id : "$restaurant_id",branch_id : "$branch_id",cuisine_id : "$cuisine_id"},
							}},
							{ $count	: "count" }
						]).toArray().then(filterCount=>{
							filterCount = (filterCount && filterCount[0]) ? filterCount[0].count :0;
							callback(null, filterCount);
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
						{
							collection : Tables.CUISINES,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions : {},
						}
					]
				};

				/**Get dropdown list **/
				let response = await getDropdownList(req,res, next,options);
					
				/** render listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/report/order_value_report']);
				res.render('order_value_report',{
					restaurant_list : response?.final_html_data?.["0"] || "",
					cuisine_list 	: response?.final_html_data?.["1"] || ""					
				});
			}
		}catch(error){
			return next(error);
		}
	};//End getOrderValueList()


	/**
	 *  Function for export order value report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As callback argument to the middleware function
	 *
	 * @return null
    */
	async orderValueExportData(req,res,next){
		try{
			let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
			let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";			
			let sortingField  	= (req.query.sort_field) 	? req.query.sort_field   	: "_id";			
			let sortingDir 	 	= (req.query.sort_dir) 		? req.query.sort_dir   		: "asc";
			let sortOrder		= (sortingDir == 'asc') 	? Constants.SORT_ASC 		: Constants.SORT_DESC;
			
			let restaurantIds	= (req.query.restaurant_ids) ? (req.query.restaurant_ids).split(",") : [];
			let branchIds		= (req.query.branch_ids)   	? (req.query.branch_ids).split(",")   	: [];
			let cuisineIds		= (req.query.cuisine_ids)   ? (req.query.cuisine_ids).split(",")   	: [];
			let deliveryBy		= (req.query.delivery_by)   ? (req.query.delivery_by).split(",")   	: [];
			
			restaurantIds	= (restaurantIds && restaurantIds.constructor === Array) ?restaurantIds :[restaurantIds];
			branchIds		= (branchIds && branchIds.constructor === Array) ?branchIds :[branchIds];
			cuisineIds		= (cuisineIds && cuisineIds.constructor === Array) ?cuisineIds :[cuisineIds];
			deliveryBy		= (deliveryBy && deliveryBy.constructor === Array) ?deliveryBy :[deliveryBy];
			
			let exportConditions	= {};
			let cuisineConditions	= {};
			let sortConditions		= {};
			sortConditions[sortingField] = sortOrder;
			
			/** Condition for order date */
			if (fromDate != "" && toDate != "") {
				exportConditions["date"] = {
					$gte 	: newDate(fromDate),
					$lte 	: newDate(toDate),
				};
			}

			if(restaurantIds.length >0) exportConditions.restaurant_id	= {$in : arrayToObject(restaurantIds)};
			if(branchIds.length > 0) 	exportConditions.branch_id		= {$in : arrayToObject(branchIds)};
			if(cuisineIds.length > 0)	cuisineConditions.cuisine_id	= {$in : arrayToObject(cuisineIds)};
			if(deliveryBy.length > 0)	exportConditions.delivery_type	= {$in : deliveryBy};
			
			let groupCondition = "$restaurant_id";
			if(exportConditions.branch_id) groupCondition = {restaurant_id : "$restaurant_id",branch_id:"$branch_id"};

			/** Get order details **/
			const order_cuisine_reports	= this.db.collection(Tables.ORDER_CUISINE_REPORTS);
			order_cuisine_reports.aggregate([
				{$match : exportConditions},						
				{$lookup:	{
					"from" 			: 	Tables.RESTAURANT_BRANCHES,
					"localField" 	:	"branch_id",
					"foreignField" 	: 	"_id",
					"as" 			: 	"branch_details"
				}},	
				{$lookup: {	/** Get cuisine details **/
					from 		:	Tables.CUISINES,
					localField  :	"cuisine_id",
					foreignField:	"_id",
					as 		  	:	"cuisine_details"
				}},							
				{$addFields : {
					branch_name	: {$arrayElemAt: ["$branch_details.name."+Constants.DEFAULT_LANGUAGE_CODE,0]},
					cuisine_name: {$arrayElemAt: ["$cuisine_details.name."+Constants.DEFAULT_LANGUAGE_CODE,0]},
				}},							
				{$group : {
					_id				: {restaurant_id : "$restaurant_id",branch_id : "$branch_id",cuisine_id : "$cuisine_id"},
					total_amount	: {$sum : "$total_amount" },
					branch_id		: {$first: "$branch_id"},
					restaurant_id	: {$first: "$restaurant_id"},
					cuisine_id		: {$first: "$cuisine_id"},
					branch_name		: {$first: "$branch_name"},								
					cuisine_name	: {$first: "$cuisine_name"},						
					restaurant_name	: {$last : "$restaurant_name"},								
				}},
				{$group	: {
					_id  : groupCondition,
					data : { $push : "$$ROOT"},
					restaurant_amount : { $sum: "$total_amount"}
				}},
				{$unwind : "$data"},
				
				{$project: {
					_id:0, total_amount: "$data.total_amount",restaurant_name: "$data.restaurant_name."+Constants.DEFAULT_LANGUAGE_CODE, cuisine_id: "$data.cuisine_id",restaurant_id: "$data.restaurant_id", branch_id: "$data.branch_id", restaurant_amount:1, branch_name: "$data.branch_name", cuisine_name: "$data.cuisine_name", percentage: {$multiply:[{$divide:[100,"$restaurant_amount"]},"$data.total_amount"]}
				}},
				{$match : cuisineConditions},
				{$sort 	: sortConditions},	
			]).toArray().then(findResult=>{


				let temp			= [];
				let commonColls		= [];

				/** Define excel heading label **/
				commonColls		= 	[
					res.__("admin.report.restaurant_name"),
					res.__("admin.report.branch"),
					res.__("admin.report.cuisine"),
					res.__("admin.report.order_amount"),
					res.__("admin.report.percentage")
				];


				if(findResult && findResult.length > 0){
					findResult.map(records=>{
						let buffer =	[
							(records.restaurant_name)   ?  records.restaurant_name       :"",
							(records.branch_name)   ?  records.branch_name       :"",
							(records.cuisine_name)  ?  records.cuisine_name      :"",
							(records.total_amount) 	?  currencyFormat(records.total_amount) :"",
							(records.percentage)    ?  round(records.percentage)+""+res.__("admin.report.percent") :""
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "OrderValueReport",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
	};// end orderValueExportData()
}
