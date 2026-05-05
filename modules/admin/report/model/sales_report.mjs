import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, newDate, exportToExcel, configDatatable, currencyFormat, round } from '../../../../utils/index.mjs';

// Model for sales report
export default class SalesReport {
	constructor(db) {
		this.db = db;
	}

	/**
	 * Function to get sales report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getSalesReportList(req,res,next){
		try{
			if(isPost(req)){
				let limit			= (req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 	= (req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     	= (req.body.from_date) 	? req.body.from_date 		: "";
				let toDate 	  	 	= (req.body.to_date)   	? req.body.to_date   		: "";
				let restaurantIds	= (req.body.restaurant_ids) ? req.body.restaurant_ids   : [];
				let areaIds			= (req.body.area_ids)   	? req.body.area_ids   		: [];
				let filterType		= (req.body.filter_type)   	? req.body.filter_type   	: '';

				restaurantIds= (restaurantIds && restaurantIds.constructor === Array) ?restaurantIds :[restaurantIds];
				areaIds		= (areaIds && areaIds.constructor === Array) ?areaIds :[areaIds];

				const collection = 	this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);

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
				if(restaurantIds.length > 0 && filterType == Constants.SALE_SHARE_BY_RESTAURANT) dataTableConfig.conditions.restaurant_id = {$in : arrayToObject(restaurantIds)};
				if(areaIds.length > 0 && filterType == Constants.SALE_SHARE_BY_AREA) dataTableConfig.conditions.area_id 		= {$in : arrayToObject(areaIds)};

				asyncParallel({
					records :(callback)=>{
						let groupCondition = {};
						let matchCondition = {};
						if(filterType == Constants.SALE_SHARE_BY_AREA){
							groupCondition['area_id'] = "$area_id";
							if(restaurantIds.length > 0 ) matchCondition['restaurant_id'] = {$in : arrayToObject(restaurantIds)};
						}else{
							groupCondition['restaurant_id'] = "$restaurant_id";
							if(areaIds.length > 0) matchCondition['area_id'] = {$in : arrayToObject(areaIds)};
						}

						/** Get list **/
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
								_id					: {
									"restaurant_id" : "$restaurant_id",
									"branch_id" 	: "$branch_id",
									"area_id" 		: "$area_id",
								},
								total_amount	: {$sum : "$total_amount" },
								branch_id		: {$first: "$branch_id"},
								area_id			: {$first: "$area_id"},
								restaurant_id	: {$first: "$restaurant_id"},
								branch_name		: {$first: "$branch_name"},
								restaurant_name	: {$last : "$restaurant_name"},
								area_name		: {$last : "$area_name"},
								cravez_payout	: {$sum : "$cravez_payout" },
								delivery_fee	: {$sum: "$delivery_fee" },
								delivery_type	: {$last: "$delivery_type" },
								total_orders	: {$sum: "$total_orders" },
							}},
							{$group	: {
								_id  : groupCondition,
								data : { $push : "$$ROOT"},
								restaurant_amount : { $sum: "$total_amount"}
							}},

							{$unwind : "$data"},
							{$project: {
								_id:0, delivery_type: "$data.delivery_type", total_orders: "$data.total_orders",  cravez_payout: "$data.cravez_payout", delivery_fee: "$data.delivery_fee", total_amount: "$data.total_amount",restaurant_name: "$data.restaurant_name",restaurant_id: "$data.restaurant_id", branch_id: "$data.branch_id", area_id:"$data.area_id",restaurant_amount:1, branch_name: "$data.branch_name",area_name: "$data.area_name", percentage: {$multiply:[{$divide:[100,"$restaurant_amount"]},"$data.total_amount"]}
							}},
							{$match : matchCondition},
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
								_id					: {
									"restaurant_id" : "$restaurant_id",
									"branch_id" 	: "$branch_id",
									"area_id" 		: "$area_id",
								},
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
								_id					: {
									"restaurant_id" : "$restaurant_id",
									"branch_id" 	: "$branch_id",
									"area_id" 		: "$area_id",
								},
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
							collection : Tables.AREAS,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions : {
								is_active	: Constants.ACTIVE
							},
						}
					]
				};

				/**Get dropdown list **/
				getDropdownList(req,res, next,options).then(response=> {
					/** render listing page **/
					req.breadcrumbs(BREADCRUMBS['admin/report/sales_report']);
					res.render('sales_report',{
						restaurant_list : response?.final_html_data?.[0] || "",
						area_list : response?.final_html_data?.[1] || "",
					});
				}).catch(next);
			}
		}catch(error){
			return next(error);
		}
	};//End getSalesReportList()

	/**
	 *  Function for sales export
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async getSalesReportExport(req,res,next){
		try{
			let filterType     	= (req.query.filter_type) 	? req.query.filter_type 	: "";
			let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
			let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";
			let sortingField  	= (req.query.sort_field) 	? req.query.sort_field   	: "_id";
			let sortingDir 	 	= (req.query.sort_dir) 		? req.query.sort_dir   		: "asc";
			let sortOrder		= (sortingDir == 'asc') 	? Constants.SORT_ASC : Constants.SORT_DESC;
			let restaurantIds	= (req.query.restaurant_ids)? (req.query.restaurant_ids).split(","): [];
			let areaIds			= (req.query.area_ids) ? (req.query.area_ids).split(",")   	: [];

			if(restaurantIds.constructor != Array) restaurantIds = [restaurantIds];
			if(areaIds.constructor != Array) 	areaIds	= [areaIds];

			let exportConditions	= {};
			/** Condition for date */
			if (fromDate != "" && toDate != "") {
				exportConditions["date"] = {
					$gte 	: newDate(fromDate),
					$lte 	: newDate(toDate),
				};
			}
			let sortConditions		= {};
			sortConditions[sortingField] = sortOrder;

			if(restaurantIds.length > 0 && filterType == Constants.SALE_SHARE_BY_RESTAURANT) exportConditions.restaurant_id	= {$in: arrayToObject(restaurantIds)};
			if(areaIds.length > 0 && filterType == Constants.SALE_SHARE_BY_AREA) exportConditions.area_id		= {$in: arrayToObject(areaIds)};

			let groupCondition = {};
			let matchCondition = {};
			if(filterType == Constants.SALE_SHARE_BY_AREA){
				groupCondition['area_id'] = "$area_id";
				if(restaurantIds.length > 0 ) matchCondition['restaurant_id'] = {$in : arrayToObject(restaurantIds)};
			}else{
				groupCondition['restaurant_id'] = "$restaurant_id";
				if(areaIds.length > 0) matchCondition['area_id'] = {$in : arrayToObject(areaIds)};
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
					_id					: {
						"restaurant_id" : "$restaurant_id",
						"branch_id" 	: "$branch_id",
						"area_id" 		: "$area_id",
					},
					total_amount	: {$sum : "$total_amount" },
					branch_id		: {$first: "$branch_id"},
					area_id			: {$first: "$area_id"},
					restaurant_id	: {$first: "$restaurant_id"},
					branch_name		: {$first: "$branch_name"},
					restaurant_name	: {$last : "$restaurant_name"},
					area_name		: {$last : "$area_name"},
				}},
				{$group	: {
					_id  : groupCondition,
					data : { $push : "$$ROOT"},
					restaurant_amount : { $sum: "$total_amount"}
				}},
				{$unwind : "$data"},
				{$project: {
					_id:0, delivery_type: "$data.delivery_type", total_orders: "$data.total_orders", cravez_payout: "$data.cravez_payout", delivery_fee: "$data.delivery_fee",  total_amount: "$data.total_amount",restaurant_name: "$data.restaurant_name",restaurant_id: "$data.restaurant_id", branch_id: "$data.branch_id", area_id:"$data.area_id",restaurant_amount:1, branch_name: "$data.branch_name",area_name: "$data.area_name", percentage: {$multiply:[{$divide:[100,"$restaurant_amount"]},"$data.total_amount"]}
				}},
				{$match : matchCondition},
				{$sort 	: sortConditions},
			]).toArray().then(findResult=>{

				let temp		= [];
				let commonColls	= [];

				/** Define excel heading label **/
				commonColls	= [
					res.__("admin.report.restaurant_name"),
					res.__("admin.report.branch_name"),
					res.__("admin.report.area_name"),
					res.__("admin.report.sales_share"),
					res.__("admin.report.no_of_orders"),
					res.__("admin.report.gross_order_amount"),
					res.__("admin.report.delivery_fees"),
					res.__("admin.report.delivery_by"),
					res.__("admin.report.cravez_commission"),
				];

				if(findResult && findResult.length > 0){
					findResult.map(records=>{
						let buffer =	[
							(records.restaurant_name)	? records.restaurant_name[Constants.DEFAULT_LANGUAGE_CODE] 		:"",
							(records.branch_name)		? records.branch_name[Constants.DEFAULT_LANGUAGE_CODE] 		:"",
							(records.area_name)			? records.area_name[Constants.DEFAULT_LANGUAGE_CODE] 		:"",
							(records.percentage)		? round(records.percentage)+""+res.__("admin.report.percent") : currencyFormat(0),
							(records.total_orders)		? records.total_orders: 0,
							(records.total_amount)		? round(records.total_amount,Constants.CURRENCY_ROUND_PRECISION): 0,
							(records.delivery_fee)		? round(records.delivery_fee,Constants.CURRENCY_ROUND_PRECISION): 0,
							(records.delivery_type)		? Constants.DELIVERY_BY[records.delivery_type]: "",
							(records.cravez_payout)		? round(records.cravez_payout,Constants.CURRENCY_ROUND_PRECISION): 0,
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "SalesReport ",
					heading_columns		: commonColls,
					export_data			: temp,
					column_formats: {
						F: { type: "number", format: Constants.EXCEL_CURRENCY_FORMAT },
						G: { type: "number", format: Constants.EXCEL_CURRENCY_FORMAT },
						I: { type: "number", format: Constants.EXCEL_CURRENCY_FORMAT }
					},
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
	};// end getSalesReportExport()
}