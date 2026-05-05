import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from '../../../../utils/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

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
	async getTopSellingItemsList (req,res,next){
		try{
			if(Helpers.isPost(req)){
				let limit		 	= (req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 	= (req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     	= (req.body.from_date) 		? req.body.from_date 		:"";
				let toDate 	  	 	= (req.body.to_date)   		? req.body.to_date   		:"";
				let customerType 	= (req.body.customer_type)	? req.body.customer_type   	:"";
				let branchIds		= (req.body.branch_ids) 	? req.body.branch_ids   	:[];
				let restaurantIds	= (req.body.restaurant_ids)	? req.body.restaurant_ids	:[];

				if(restaurantIds.constructor != Array) restaurantIds = [restaurantIds];
				if(branchIds.constructor != Array) 	branchIds	= [branchIds];

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
						$gte 	: Helpers.newDate(fromDate),
						$lte 	: Helpers.newDate(toDate),
					};
				}

				if(restaurantIds.length > 0){
					orderConditions.restaurant_id = {$in: Helpers.arrayToObject(restaurantIds)};
				}

				if(branchIds.length > 0){
					orderConditions.branch_id = {$in: Helpers.arrayToObject(branchIds)};
				}

				const orders = 	this.db.collection(Tables.ORDERS);
				let orderIds = await orders.distinct("_id",orderConditions);

				// Configure Data-table conditions
				const dataTableConfig = await Helpers.configDatatable(req, res, null);

				/** Set common condition */
				let commonConditions = {order_id : { $in : orderIds}};

				dataTableConfig.conditions	= Object.assign(commonConditions, dataTableConfig.conditions);

				/** Get list or count of top selling items **/
				const collection = 	this.db.collection(Tables.ORDER_ITEMS);
				let dbRes = await collection.aggregate([
					{ $match: dataTableConfig.conditions },
					{$group: {
						_id: {
							item_id : "$item_id"
						},
						item_id 	: {$first : "$item_id"},
						total_qty  	: {$sum   : "$qty"},
						amount		: {$sum	  : {$multiply: ["$qty","$price"]}}
					}},
					{$facet : {
						list: [
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
							{$limit : limit}
						],
						count: [
							{$count: "count"},
						],
					}}
				]).toArray();

				// Send response
				res.send({
					status: Constants.STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data			:   dbRes?.[0]?.list ||[],
					recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
					recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
				});
			}else{
				/**Get dropdown list **/
				let response = await Helpers.getDropdownList(req, res, next, {
					collections: [{
						collection  : Tables.RESTAURANTS,
						columns     : ["_id", ["name", Constants.DEFAULT_LANGUAGE_CODE]],
						conditions  : {
							is_deleted  : Constants.NOT_DELETED
						},
					}]
				});

				/** Send error response **/
				if (response.status != Constants.STATUS_SUCCESS) {
					req.flash(Constants.STATUS_ERROR, response.message);
					return res.redirect(Constants.WEBSITE_URL + "dashboard");
				}

				/** render listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/report/top_selling_items_report']);
				res.render('top_selling_items_report', {
					restaurant_list : response?.final_html_data?.["0"] || "",
				});
			}
		}catch(err){ return next(err); }
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
	async topSellingItemsExportData (req,res,next){
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
					$gte: Helpers.newDate(fromDate),
					$lte: Helpers.newDate(toDate),
				};
			}

			if (restaurantIds.length > 0) {
				orderConditions.restaurant_id = { $in: Helpers.arrayToObject(restaurantIds) };
			}

			if (branchIds.length > 0) {
				orderConditions.branch_id = { $in: Helpers.arrayToObject(branchIds) };
			}

			const orders = 	this.db.collection(Tables.ORDERS);
			let orderIds = await orders.distinct("_id",orderConditions);

			/** Get top selling items details **/
			const order_items = this.db.collection(Tables.ORDER_ITEMS);
			let findResult = await order_items.aggregate([
				{$match: {order_id : { $in : orderIds}}},
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
				{$sort 	: {[sortingField]: sortOrder}},
			]).toArray();

			/** Define excel heading label **/
			let commonColls	= [
				res.__("admin.report.item_name"),
				res.__("admin.report.quantity"),
				res.__("admin.report.item_price"),
				res.__("admin.report.total_amount"),
			];

			let temp = [];
			if(findResult && findResult.length > 0){
				findResult.map(records=>{
					temp.push([
						(records.item_name) 	?  records.item_name  :"",
						(records.qty)  			?  records.qty        :0,
						(records.price)  		?  Helpers.round(records.price,Constants.CURRENCY_ROUND_PRECISION)   : 0,
						(records.total_amount)  ?  Helpers.round(records.total_amount,Constants.CURRENCY_ROUND_PRECISION)   : 0
					]);
				});
			}

			/**  Function to export data in excel format **/
			Helpers.exportToExcel(req,res,{
				file_prefix 		: "TopSellingItemsReport",
				heading_columns		: commonColls,
				column_formats : {
					C : {type : "number",format : Constants.EXCEL_CURRENCY_FORMAT},
					D : {type : "number",format : Constants.EXCEL_CURRENCY_FORMAT}
				},
				export_data	: temp
			});
		}catch(err){ return next(err); }
	};// end topSellingItemsExportData()
}