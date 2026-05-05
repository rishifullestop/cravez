import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, newDate, exportToExcel, configDatatable, round } from '../../../../utils/index.mjs';

// Model for most selling items report
export default class MostSellingItemsReport {
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
	async getMostSellingItemsList(req,res,next){
		try{
			if(isPost(req)){
				let limit		 = (req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 = (req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     = (req.body.from_date) 	? req.body.from_date 		:"";
				let toDate 	  	 = (req.body.to_date)   	? req.body.to_date   		:"";
				let areaIds		 = (req.body.area_ids)		? req.body.area_ids   		:[];

				areaIds		= (areaIds && areaIds.constructor === Array) ?areaIds :[areaIds];

				const collection = 	this.db.collection(Tables.ORDER_ITEMS);
				const orders 	 = 	this.db.collection(Tables.ORDERS);

				/** Set order condition */
				let orderConditions = {admin_status : Constants.ORDER_DELIVERED};

				/** Condition for order date */
				if (fromDate != "" && toDate != "") {
					orderConditions["order_date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					};
				}

				/** Get order ids  */
				let orderIds = await orders.distinct("_id",orderConditions);
				
				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);

				/** Set common condition */
				let commonConditions = {
					order_id : { $in : orderIds}
				};

				dataTableConfig.conditions	= Object.assign(dataTableConfig.conditions, commonConditions);
				if(areaIds.length > 0) dataTableConfig.conditions.area_id = {$in : arrayToObject(areaIds)};

				asyncParallel({
					most_selling_items_list :(callback)=>{
						let groupCondition = {};
						groupCondition['area_id'] = "$area_id";

						/** Get list of most selling items **/
						collection.aggregate([
							{$lookup:	{ /** Get customer details **/
								"from" 			: 	Tables.ITEMS,
								"localField" 	:	"item_id",
								"foreignField" 	: 	"_id",
								"as" 			: 	"item_detail"
							}},
							{$lookup:	{ /** Get order details **/
								"from" 			: 	Tables.ORDERS,
								"localField" 	:	"order_id",
								"foreignField" 	: 	"_id",
								"as" 			: 	"order_detail"
							}},
							{$addFields : { item_name: {$arrayElemAt: ["$item_detail.name."+Constants.DEFAULT_LANGUAGE_CODE,0]},area_id: {$arrayElemAt: ["$order_detail.area_id",0]} }},
							{$match : dataTableConfig.conditions},
							{$lookup:	{ /** Get order details **/
								"from" 			: 	Tables.AREAS,
								"localField" 	:	"area_id",
								"foreignField" 	: 	"_id",
								"as" 			: 	"area_detail"
							}},
							{$addFields : { area_name: {$arrayElemAt: ["$area_detail.name."+Constants.DEFAULT_LANGUAGE_CODE,0]}}},
							{$group: {
								_id: {
									item_id : "$item_id",
									area_id	: "$area_id"
								},
								item_id 	: {$first : "$item_id"},
								area_id 	: {$first : "$area_id"},
								item_name  	: {$first : "$item_name"},
								qty  		: {$sum : "$qty"},
								area_name	: {$first: "$area_name"}
							}},
							{$group	: {
								_id  : groupCondition,
								data : { $push : "$$ROOT"},
								total_quantity : { $sum: "$qty"}
							}},
							{$unwind : "$data"},
							{$project: {
								_id:0, qty: "$data.qty",item_name: "$data.item_name",area_id:"$data.area_id",total_quantity:1, percentage: {$multiply:[{$divide:[100,"$total_quantity"]},"$data.qty"]},area_name : "$data.area_name",
							}},
							{$sort 	: dataTableConfig.sort_conditions},
							{$skip 	: skip},
							{$limit : limit},
						]).toArray().then(result=>{
							callback(null, result);
						}).catch(next);
					},
					records_total: (callback)=>{
						/** Get total number of records in order items  collection **/
						collection.aggregate([
							{$match : commonConditions},
							{$lookup:	{ /** Get customer details **/
								"from" 			: 	Tables.ITEMS,
								"localField" 	:	"item_id",
								"foreignField" 	: 	"_id",
								"as" 			: 	"item_detail"
							}},
							{$lookup:	{ /** Get order details **/
								"from" 			: 	Tables.ORDERS,
								"localField" 	:	"order_id",
								"foreignField" 	: 	"_id",
								"as" 			: 	"order_detail"
							}},
							{$addFields : { item_name: {$arrayElemAt: ["$item_detail.name."+Constants.DEFAULT_LANGUAGE_CODE,0]},area_id: {$arrayElemAt: ["$order_detail.area_id",0]} }},
							{$group: {
								_id: {
									item_id : "$item_id",
									area_id	: "$area_id"
								},
							}},
							{$count : 'count'}
						]).toArray().then(count=>{
							count = (count && count[0] && count[0]["count"]) ? count[0]["count"] :"0";
							callback(null, count);
						}).catch(next);
					},
					records_filtered: (callback)=>{
						/** Get filtered records counting in order items   **/
						collection.aggregate([
							{$lookup:	{ /** Get customer details **/
								"from" 			: 	Tables.ITEMS,
								"localField" 	:	"item_id",
								"foreignField" 	: 	"_id",
								"as" 			: 	"item_detail"
							}},
							{$lookup:	{ /** Get order details **/
								"from" 			: 	Tables.ORDERS,
								"localField" 	:	"order_id",
								"foreignField" 	: 	"_id",
								"as" 			: 	"order_detail"
							}},
							{$addFields : { item_name: {$arrayElemAt: ["$item_detail.name."+Constants.DEFAULT_LANGUAGE_CODE,0]},area_id: {$arrayElemAt: ["$order_detail.area_id",0]} }},
							{$match : dataTableConfig.conditions},
							{$group: {
								_id: {
									item_id : "$item_id",
									area_id	: "$area_id"
								},
							}},
							{$count : 'count'}
						]).toArray().then(filterCount=>{
							filterCount = (filterCount && filterCount[0] && filterCount[0]["count"]) ? filterCount[0]["count"] :"0";
							callback(null, filterCount);
						}).catch(next);
					}
				},(err, response)=>{
					/** Send response **/
					res.send({
						status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
						draw			: dataTableConfig.result_draw,
						data			: response.most_selling_items_list,
						recordsFiltered	: response.records_filtered,
						recordsTotal	: response.records_total,
					});
				});				
			}else{
				/**Get dropdown list **/
				let dropDownResponse = await getDropdownList(req,res, next,{
					collections :[
						{
							collection : Tables.AREAS,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions : {
								is_active	: Constants.ACTIVE
							},
						}
					]
				});

				/** render listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/report/most_selling_items_report']);
				res.render('most_selling_items_report',{
					area_list : dropDownResponse?.final_html_data?.[0] || "",
				});
			}
		}catch(error){
			return next(error);
		}
	};//End getMostSellingItemsList()

	/**
	 *  Function for export most selling items report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async mostSellingItemsExportData(req,res,next){
		try{
			let fromDate 	= (req.query.from_date) ? req.query.from_date : "";
			let toDate 		= (req.query.to_date) ? req.query.to_date : "";
			let sortingField= (req.query.sort_field) ? req.query.sort_field : "_id";
			let sortingDir 	= (req.query.sort_dir) ? req.query.sort_dir : "asc";
			let sortOrder 	= (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;
			let areaIds		= (req.query.area_ids) ? (req.query.area_ids).split(",")   	: [];

			if(areaIds.constructor != Array) 	areaIds	= [areaIds];
			
			/** Set order condition */
			let orderConditions = { admin_status: Constants.ORDER_DELIVERED };

			/** Condition for order date */
			if (fromDate != "" && toDate != "") {
				orderConditions["order_date"] = {
					$gte: newDate(fromDate),
					$lte: newDate(toDate),
				};
			}

			/** Get order ids  */
			const orders = this.db.collection(Tables.ORDERS);
			let orderIds = await orders.distinct("_id",orderConditions);

			/** Set common condition */
			let exportConditions = {
				order_id : { $in : orderIds}
			};
			if(areaIds.length > 0) exportConditions.area_id	= {$in: arrayToObject(areaIds)};

			let sortConditions = {};
			sortConditions[sortingField] = sortOrder;

			let groupCondition = {};
			groupCondition['area_id'] = "$area_id";

			/** Get most selling items details **/
			const order_items = this.db.collection(Tables.ORDER_ITEMS);
			order_items.aggregate([
				{$lookup:	{ /** Get item details **/
					"from" 			: 	Tables.ITEMS,
					"localField" 	:	"item_id",
					"foreignField" 	: 	"_id",
					"as" 			: 	"item_detail"
				}},
				{$lookup:	{ /** Get order details **/
					"from" 			: 	Tables.ORDERS,
					"localField" 	:	"order_id",
					"foreignField" 	: 	"_id",
					"as" 			: 	"order_detail"
				}},
				{$addFields:{ item_name: {$arrayElemAt: ["$item_detail.name."+Constants.DEFAULT_LANGUAGE_CODE,0]},area_id: {$arrayElemAt: ["$order_detail.area_id",0]}}},
				{$match : exportConditions},
				{$lookup:	{ /** Get order details **/
					"from" 			: 	Tables.AREAS,
					"localField" 	:	"area_id",
					"foreignField" 	: 	"_id",
					"as" 			: 	"area_detail"
				}},
				{$addFields : { area_name: {$arrayElemAt: ["$area_detail.name."+Constants.DEFAULT_LANGUAGE_CODE,0]}}},
				{$group: {
					_id: {
						item_id : "$item_id",
						area_id	: "$area_id"
					},
					item_id 	: {$first : "$item_id"},
					area_id 	: {$first : "$area_id"},
					item_name  	: {$first : "$item_name"},
					qty  		: {$sum : "$qty"},
					area_name	: {$first: "$area_name"}
				}},
				{$group	: {
					_id  : groupCondition,
					data : { $push : "$$ROOT"},
					total_quantity : { $sum: "$qty"}
				}},
				{$unwind : "$data"},
				{$project: {
					_id:0, qty: "$data.qty",item_name: "$data.item_name",area_id:"$data.area_id",total_quantity:1, percentage: {$multiply:[{$divide:[100,"$total_quantity"]},"$data.qty"]},area_name : "$data.area_name",
				}},
				{$sort 	: sortConditions},
			]).toArray().then(findResult=>{

				let temp			= [];
				let commonColls		= [];

				/** Define excel heading label **/
				commonColls	= [
					res.__("admin.report.item_name"),
					res.__("admin.report.area_name"),
					res.__("admin.report.quantity"),
					res.__("admin.report.percentage"),
				];

				if(findResult && findResult.length > 0){
					findResult.map(records=>{
						let buffer =	[
							(records.item_name) ?   records.item_name  :"",
							(records.area_name) ?   records.area_name  :"",
							(records.qty)  		?   records.qty        :"",
							(records.percentage)?	round(records.percentage)+""+res.__("admin.report.percent") : 0,
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "MostSellingItemsReportWithAreas",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
	};// end mostSellingItemsExportData()
}
