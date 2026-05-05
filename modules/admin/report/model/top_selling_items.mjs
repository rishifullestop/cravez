import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, newDate, exportToExcel, configDatatable, currencyFormat } from '../../../../utils/index.mjs';

// Model for top selling items report
export default class TopSellingItemsReport {
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
	async getTopSellingItemsList(req,res,next){
		try{
			if(isPost(req)){
				let limit		 	= (req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 	= (req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     	= (req.body.from_date) 		? req.body.from_date 		:"";
				let toDate 	  	 	= (req.body.to_date)   		? req.body.to_date   		:"";
				let customerType 	= (req.body.customer_type)	? req.body.customer_type   	:"";
				let branchIds		= (req.body.branch_ids) 	? req.body.branch_ids   	:[];
				let restaurantIds	= (req.body.restaurant_ids)	? req.body.restaurant_ids:[];

				if(restaurantIds.constructor != Array) restaurantIds = [restaurantIds];
				if(branchIds.constructor != Array) 	branchIds	= [branchIds];

				const collection = 	this.db.collection(Tables.ORDER_ITEMS);
				const orders 	 = 	this.db.collection(Tables.ORDERS);

				/** Set order condition */
				let orderConditions = {admin_status : Constants.ORDER_DELIVERED};
				if(customerType == Constants.REPORT_NEW_CUSTOMER){
					orderConditions["$or"] = [
						{is_guest : true},
						{is_first_order : true}
					];
				}

				/** Condition for order date */
				if (fromDate != "" && toDate != "") {
					orderConditions.order_date = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					};
				}

				if(restaurantIds.length > 0){
					orderConditions.restaurant_id = {$in: arrayToObject(restaurantIds)};
				}

				if(branchIds.length > 0){
					orderConditions.branch_id = {$in: arrayToObject(branchIds)};
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

				asyncParallel({
					top_selling_items_list :(callback)=>{
						/** Get list of top selling items **/
						collection.aggregate([
							{$match : dataTableConfig.conditions},								
							{$group: {
								_id: {
									item_id : "$item_id"
								},
								item_id 	: {$first : "$item_id"},
								total_qty  	: {$sum   : "$qty"}, 
								amount		: {$sum	  : {$multiply: ["$qty","$price"]}}
							}},
							{$lookup:	{ /** Get item details **/
								"from" 			: 	Tables.ITEMS,
								"localField" 	:	"item_id",
								"foreignField" 	: 	"_id",
								"as" 			: 	"item_detail"
							}},
							{$addFields : {
								item_name	: {$arrayElemAt: ["$item_detail.name."+Constants.DEFAULT_LANGUAGE_CODE,0]},
								price		: {$arrayElemAt: ["$item_detail.item_price",0]},
								total_amount: {$sum : "$amount"},
							}},
							{$sort 	: dataTableConfig.sort_conditions},
							{$skip 	: skip},
							{$limit : limit},
						]).toArray().then(result => {
							callback(null, result);
						}).catch(next);
					},
					records_total: (callback)=>{
						/** Get total number of records in order items  collection **/
						collection.distinct("item_id",commonConditions).then(itemIds=>{
							let count = itemIds.length;
							callback(null, count);
						}).catch(next);
					},
					records_filtered: (callback)=>{
						/** Get filtered records counting in order items   **/
						collection.distinct("item_id",dataTableConfig.conditions).then(itemIds=>{
							let filterCount = itemIds.length;
							callback(null, filterCount);
						}).catch(next);
					}
				},(err, response)=>{
					/** Send response **/
					res.send({
						status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
						draw			: dataTableConfig.result_draw,
						data			: response.top_selling_items_list,
						recordsFiltered	: response.records_filtered,
						recordsTotal	: response.records_total,
					});
				});
			}else{
				/**Get dropdown list **/
				getDropdownList(req, res, next, {
					collections: [{
						collection  : Tables.RESTAURANTS,
						columns     : ["_id", ["name", Constants.DEFAULT_LANGUAGE_CODE]],
						conditions  : {
							is_deleted  : Constants.NOT_DELETED
						},
					}]
				}).then(response => {
					
					/** render listing page **/
					req.breadcrumbs(BREADCRUMBS['admin/report/top_selling_items_report']);
					res.render('top_selling_items_report', {
						restaurant_list : response?.final_html_data?.[0] || "",
					});
				}).catch(next);
			}
		}catch(error){
			return next(error);
		}
	};//End getTopSellingItemsList()

	/**
	 *  Function for export top selling items report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async topSellingItemsExportData(req,res,next){
		try{
			let fromDate 	= (req.query.from_date) ? req.query.from_date : "";
			let toDate 		= (req.query.to_date) ? req.query.to_date : "";
			let sortingField= (req.query.sort_field) ? req.query.sort_field : "_id";
			let sortingDir 	= (req.query.sort_dir) ? req.query.sort_dir : "asc";
			let sortOrder 	= (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;
			let customerType= (req.query.customer_type) ? (req.query.customer_type) : "";
			let branchIds = (req.query.branch_ids) ? (req.query.branch_ids).split(",") : [];
			let restaurantIds = (req.query.restaurant_ids) ? (req.query.restaurant_ids).split(",") : [];

			if (restaurantIds.constructor != Array) restaurantIds = [restaurantIds];
			if (branchIds.constructor != Array) branchIds = [branchIds];

			/** Set order condition */
			let orderConditions = { admin_status: Constants.ORDER_DELIVERED };
			if (customerType == Constants.REPORT_NEW_CUSTOMER) {
				orderConditions["$or"] = [
					{ is_guest: true },
					{ is_first_order: true }
				];
			}

			/** Condition for order date */
			if (fromDate != "" && toDate != "") {
				orderConditions["order_date"] = {
					$gte: newDate(fromDate),
					$lte: newDate(toDate),
				};
			}

			if (restaurantIds.length > 0) {
				orderConditions.restaurant_id = { $in: arrayToObject(restaurantIds) };
			}

			if (branchIds.length > 0) {
				orderConditions.branch_id = { $in: arrayToObject(branchIds) };
			}

			/** Get order ids  */
			const orders = this.db.collection(Tables.ORDERS);
			let orderIds = await orders.distinct("_id",orderConditions);

			/** Set common condition */
			let exportConditions = {
				order_id : { $in : orderIds}
			};
			let sortConditions = {};
			sortConditions[sortingField] = sortOrder;

			/** Get top selling items details **/
			const order_items = this.db.collection(Tables.ORDER_ITEMS);
			order_items.aggregate([
				{$match: exportConditions},				
				{$group: {
					_id: {
						item_id : "$item_id"
					},
					item_id 	: {$first : "$item_id"},					
					total_qty  	: {$sum   : "$qty"},
					amount		: {$sum	  : {$multiply: ["$qty","$price"]}}
				}},
				{$lookup:	{ /** Get item details **/
					"from" 			: 	Tables.ITEMS,
					"localField" 	:	"item_id",
					"foreignField" 	: 	"_id",
					"as" 			: 	"item_detail"
				}},
				{$addFields : {
					item_name	: {$arrayElemAt: ["$item_detail.name."+Constants.DEFAULT_LANGUAGE_CODE,0]},
					price		: {$arrayElemAt: ["$item_detail.item_price",0]},
					total_amount: {$sum : "$amount"},
				}},				
				{$sort 	: sortConditions},
			]).toArray().then(findResult=>{

				let temp			= [];
				let commonColls		= [];

				/** Define excel heading label **/
				commonColls	= [
					res.__("admin.report.item_name"),
					res.__("admin.report.quantity"),
					res.__("admin.report.item_price"),
					res.__("admin.report.total_amount"),
				];

				if(findResult && findResult.length > 0){
					findResult.map(records=>{
						let buffer =	[
							(records.item_name) 	?  records.item_name  :"",
							(records.total_qty)  	?  records.total_qty        :0,
							(records.price)  		?  currencyFormat(records.price)   : currencyFormat(0),
							(records.total_amount)  ?  currencyFormat(records.total_amount)   : currencyFormat(0)
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "TopSellingItemsReport",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
	};// end topSellingItemsExportData()
}
