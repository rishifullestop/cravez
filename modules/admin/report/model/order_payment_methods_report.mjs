import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, newDate, exportToExcel, configDatatable, currencyFormat, round } from '../../../../utils/index.mjs';

// Model for order payment methods report
export default class OrderPaymentMethodsReport {
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
	async getOrderPaymentMethodsReportList(req,res,next){
		try{
			if(isPost(req)){			
				let limit			= (req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 	= (req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     	= (req.body.from_date) 		? req.body.from_date 		: "";
				let toDate 	  	 	= (req.body.to_date)   		? req.body.to_date   		: "";
				let restaurantIds	= (req.body.restaurant_ids) ? (req.body.restaurant_ids)  : [];
				let deliveryBy 		= (req.body.delivery_by) 	? req.body.delivery_by : [];

				restaurantIds = (restaurantIds && restaurantIds.constructor === Array) ? restaurantIds : [restaurantIds];
				deliveryBy = (deliveryBy && deliveryBy.constructor === Array) ? deliveryBy : [deliveryBy];

				const orders = 	this.db.collection(Tables.ORDERS);
			
				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);
				let commonConditions= {
					admin_status: Constants.ORDER_DELIVERED,
				};
				commonConditions["$and"] = [{ payment_method: { $exists: true } }, { payment_method: { $ne: "" } }, { payment_method: { $ne: null } }];
				/** Condition for order date */
				if (fromDate != "" && toDate != "") {
					commonConditions["order_date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					};
				}

				if(restaurantIds.length > 0) dataTableConfig.conditions.restaurant_id = {$in : arrayToObject(restaurantIds)};
				if (deliveryBy.length > 0) dataTableConfig.conditions.delivery_type = { $in: deliveryBy };
				dataTableConfig.conditions	= Object.assign(dataTableConfig.conditions, commonConditions);
				
				asyncParallel({
					records :(callback)=>{
						orders.aggregate([
							{ $match: dataTableConfig.conditions },
							{
								$group: {
									_id: {
										payment_method: "$payment_method"
									},
									order_count		: { $sum: 1 },
									payment_method	: { $first: "$payment_method" },
									order_value		: { $sum: "$order_price" },
									
								},
							},
							{ $sort: dataTableConfig.sort_conditions },
							{ $skip: skip },
							{ $limit: limit },
						]).toArray().then(result=>{
							let totalOrderValue = 0;
							result.map(record => {
								totalOrderValue+=record.order_value
							});
							result.map(record => {
								record.percentage = (record.order_value) ? round((record.order_value / totalOrderValue) * 100):0;
							});
							callback(null, result);
						}).catch(next);
					},
					records_total: (callback)=>{
						/** Get total number of records in orders collection **/
						orders.aggregate([
							{$match	: commonConditions},
							{$group	: {
								_id: {
									payment_method: "$payment_method"
								},
							}},
							{ $count	: "count" }
						]).toArray().then(countResult=>{
							let count = (countResult && countResult[0] && countResult[0].count) ? countResult[0].count : 0;
							callback(null, count);
						}).catch(next);
					},
					records_filtered: (callback)=>{
						/** Get filtered records counting in order cuisine reports   **/
						orders.aggregate([
							{$match	: dataTableConfig.conditions},
							{$group	: {
								_id: {
									payment_method: "$payment_method"
								},
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
				/**Get dropdown list **/
				let response = await getDropdownList(req,res, next,{
					collections :[
						{
							collection : Tables.RESTAURANTS,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions : {
								is_deleted	: Constants.NOT_DELETED
							},
						},
					]
				});
					
				/** render listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/report/order_payment_methods_report']);
				res.render('order_payment_methods_report',{
					restaurant_list : response?.final_html_data?.["0"] || "",
				});				
			}
		}catch(error){
			return next(error);
		}
	};//End getOrderPaymentMethodsReportList()


	/**
	 *  Function for export order count report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async orderPaymentMethodsReportExport(req,res,next){
		try{
			let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
			let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";			
			let sortingField  	= (req.query.sort_field) 	? req.query.sort_field   	: "_id";			
			let sortingDir 	 	= (req.query.sort_dir) 		? req.query.sort_dir   		: "asc";
			let sortOrder		= (sortingDir == 'asc') 	? Constants.SORT_ASC 		: Constants.SORT_DESC;
			
			let restaurantIds = (req.query.restaurant_ids) ? (req.query.restaurant_ids).split(",") : [];
			let deliveryBy = (req.query.delivery_by) ? (req.query.delivery_by).split(",") : [];

			restaurantIds = (restaurantIds && restaurantIds.constructor === Array) ? restaurantIds : [restaurantIds];
			deliveryBy = (deliveryBy && deliveryBy.constructor === Array) ? deliveryBy : [deliveryBy];

			let exportConditions	= {
				admin_status: Constants.ORDER_DELIVERED,
			};
			exportConditions["$and"] = [{ payment_method: { $exists: true } }, { payment_method: { $ne: "" } }, { payment_method: { $ne: null } }];
			let sortConditions		= {};
			sortConditions[sortingField] = sortOrder;
			
			/** Condition for order date */
			if (fromDate != "" && toDate != "") {
				exportConditions["order_date"] = {
					$gte 	: newDate(fromDate),
					$lte 	: newDate(toDate),
				};
			}

			if (restaurantIds.length > 0) exportConditions.restaurant_id = { $in: arrayToObject(restaurantIds) };
			if (deliveryBy.length > 0) exportConditions.delivery_type = { $in: deliveryBy };

			/** Get order details **/
			const orders = this.db.collection(Tables.ORDERS);
			orders.aggregate([
				{$match : exportConditions},						
				{
					$group: {
						_id: {
							payment_method: "$payment_method"
						},
						order_count: { $sum: 1 },
						payment_method: { $first: "$payment_method" },
						order_value: { $sum: "$order_price" },
					},
				},
				{$sort 	: sortConditions},	
			]).toArray().then(findResult=>{
				let totalOrderValue = 0;
				let totalOrders 	= 0;
				let totalPercent = 0;
				findResult.map(record => {
					totalOrderValue += record.order_value
					totalOrders += record.order_count
				});
				findResult.map(record => {
					record.percentage = (record.order_value) ? round((record.order_value / totalOrderValue) * 100) : 0;
				});
				findResult.map(record => {
					totalPercent += record.percentage
				});

				let temp			= [];
				let commonColls		= [];

				/** Define excel heading label **/
				commonColls		= 	[
					res.__("admin.report.payment_method"),
					res.__("admin.report.no_of_orders"),
					res.__("admin.report.total_order_value"),
					res.__("admin.report.percentage"),
				];


				if(findResult && findResult.length > 0){
					findResult.map(records=>{
						let buffer =	[
							(records.payment_method) ? Constants.PAYMENT_METHODS[records.payment_method]       :"",
							(records.order_count) ? records.order_count       :0,
							(records.order_value) ? currencyFormat(records.order_value) : currencyFormat(0),
							(records.percentage)    ?  (records.percentage)+""+res.__("admin.report.percent") :""
						];
						temp.push(buffer);
					});
					let totalRow = [
						res.__("admin.report.grand_total"),
						totalOrders,
						currencyFormat(totalOrderValue),
						(round(totalPercent) > 100) ? + "100" + res.__("admin.report.percent") : round(totalPercent) + "" + res.__("admin.report.percent"),
					];
					temp.push(totalRow);
				}
				
				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "OrderPaymentMethodsReport",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
	};// end orderPaymentMethodsReportExport()
}
