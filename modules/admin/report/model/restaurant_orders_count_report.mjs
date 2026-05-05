import { ObjectId } from 'mongodb';
import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,newDate, exportToExcel, configDatatable} from '../../../../utils/index.mjs';

// Model for restaurant orders count report
export default class RestaurantOrdersCountReport {
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
	async getRestaurantOrdersCountList(req,res,next){
		try{
			/**Get dropdown list **/
			let response = await getDropdownList(req,res, next, {
				collections :[
					{
						collection : Tables.RESTAURANTS,
						columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
						conditions : {
							is_deleted	: Constants.NOT_DELETED
						},
					}
				],
			});

			/** render restaurant orders count report listing page **/
			req.breadcrumbs(BREADCRUMBS['admin/report/restaurant_orders_count_report']);
			res.render('restaurant_orders_count_report',{
				restaurant_list	: response?.final_html_data?.["0"] || ""
			});
		}catch(error){
			return next(error);
		}
	};//End getRestaurantOrdersCountList()

	/**
	 * Function to get restaurant orders count report list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async appendRestaurantOrdersCountList(req,res,next){
		try{
		let fromDate      = (req.params.from_date) 	? req.params.from_date 		:"";
		let toDate 	  	  = (req.params.to_date)   	? req.params.to_date   		:"";
		let restaurantId  = (req.params.restaurant_id)  ? new ObjectId(req.params.restaurant_id)  :"";
		let branchId	  = (req.params.branch_id)		? new ObjectId(req.params.branch_id)  	  :"";

		if(isPost(req)){
			let limit 		 = 	(req.body.length) ? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
			let skip  		 = 	(req.body.start)  ? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
			const collection = 	this.db.collection(Tables.ORDERS);

			/** Configure Datatable conditions*/
			let dataTableConfig = await configDatatable(req,res,null);

				/** Set condition */
				let commonConditions = {};

				/** Condition for order date */
				if (fromDate != "" && toDate != "") {
					commonConditions["order_date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					};
				}

				commonConditions.admin_status = Constants.ORDER_DELIVERED;
				/** Add restaurant conditions  */
				if(restaurantId) commonConditions.restaurant_id = restaurantId;

				/** Add branch conditions  */
				if(branchId) commonConditions.branch_id = branchId;

				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				asyncParallel({
					restaurant_order_list :(callback)=>{
						/** Get list of restaurant orders count **/
						collection.aggregate([
							{$match : dataTableConfig.conditions},
							{$group: {
								_id: {
									restaurant_id : "$restaurant_id",
								},
								restaurant_name : {$first : "$restaurant_name"},
								total_orders 	: {$sum   : 1}
							}},
							{$sort 	: dataTableConfig.sort_conditions},
							{$skip 	: skip},
							{$limit : limit},
						]).toArray().then(result=>{
							callback(null, result);
						}).catch(next);
					},
					records_total: (callback)=>{
						/** Get total number of records in order  collection **/
						collection.distinct("restaurant_id",commonConditions).then(restaurantIds=>{
							let count = restaurantIds.length;
							callback(null, count);
						}).catch(next);
					},
					records_filtered: (callback)=>{
						/** Get filtered records counting in orders collection   **/
						collection.distinct("restaurant_id",dataTableConfig.conditions).then(restaurantIds=>{
							let filterCount = restaurantIds.length;
							callback(null, filterCount);
						}).catch(next);
					}
				},(err, response)=>{
					/** Send response **/
					res.send({
						status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
						draw			: dataTableConfig.result_draw,
						data			: response.restaurant_order_list,
						recordsFiltered	: response.records_filtered,
						recordsTotal	: response.records_total,
					});
				});
		}else{
			res.render('restaurant_orders',{
				layout 		  : false,
				from_date 	  : fromDate,
				to_date 	  : toDate,
				restaurant_id : restaurantId,
				branch_id     : branchId
			});
		}
		}catch(error){
			return next(error);
		}
	};//End appendRestaurantOrdersCountList()

	/**
	 *  Function for export restaurant orders count report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async restaurantOrderExportData(req,res,next){
		try{
			let tmpFromDate  = (req.params.from_date) 	  ? (req.params.from_date) 			   : "";
			let tmpToDate 	 = (req.params.to_date)   	  ? (req.params.to_date)   			   : "";
			let restaurantId = (req.params.restaurant_id) ? new ObjectId(req.params.restaurant_id) : "";
			let branchId 	 = (req.params.branch_id)     ? new ObjectId(req.params.branch_id)     : "";
			let fromDate  	 = newDate(tmpFromDate+" "+Constants.START_DATE_TIME_FORMAT);
			let toDate 	  	 = newDate(tmpToDate+" "+Constants.END_DATE_TIME_FORMAT);

			/** Set conditions  */
			let commonConditions = {
				order_date   : {
					$gte : newDate(fromDate),
					$lte : newDate(toDate)
				},
				admin_status : Constants.ORDER_DELIVERED
			};

			/** Add restaurant conditions  */
			if(restaurantId) commonConditions.restaurant_id = restaurantId;

			/** Add branch conditions  */
			if(branchId) commonConditions.branch_id = branchId;

			/** Get restaurant orders count report list **/
			const orders = this.db.collection(Tables.ORDERS);
			orders.aggregate([
				{$match: commonConditions},
				{$group: {
					_id: {
						restaurant_id : "$restaurant_id",
					},
					restaurant_name : {$first : "$restaurant_name"},
					total_orders 	: {$sum   : 1}
				}}
			]).toArray().then(result=>{

				let temp		= [];
				let commonColls	= [];

				/** Define excel heading label **/
				commonColls		= 	[
					res.__("admin.report.restaurant_name"),
					res.__("admin.report.total_orders")
				];

				if(result && result.length > 0){
					result.map(records=>{
						let buffer =	[
							(records.restaurant_name) ? records.restaurant_name[Constants.DEFAULT_LANGUAGE_CODE] :"",
							(records.total_orders)	  ? records.total_orders 	   :""
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "RestaurantOrderReport",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
	};// end restaurantOrderExportData()
}
