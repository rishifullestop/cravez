import { parallel as asyncParallel } from 'async';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, arrayToObject, newDate, configDatatable } from '../../../../utils/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

// Model for Total Order Per Restaurant
export default class TotalOrderPerRestaurant {

	constructor(db){
		this.db = db;
	}

	/**
	 * Function to get total order per restaurant sales report 
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async totalOrderPerRestaurant(req,res,next){
		try{
			const collection 	= this.db.collection(Tables.ORDERS);
			let fromDate 	 	= req?.query?.date_from || "";
			let toDate   	 	= req?.query?.date_to || "";
			let restaurantId 	= req?.query?.restaurant_id || "";
			let branchId 		= req?.query?.branch_id || "";

			/** Common conditions  */
			let commonConditions = { order_status : Constants.ORDER_DELIVERED};
	
			if(isPost(req)){
				let limit  = (req.body.length) ? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip   = (req.body.start)  ? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				
				/** Configure Datatable conditions*/
				const dataTableConfig = await configDatatable(req, res, null);

				/** Conditions for date */
				if (fromDate != "" && toDate != "") {
					commonConditions["order_date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					}
				}
				
				/** Conditions for restaurant */
				if (restaurantId && restaurantId != "null") {
					restaurantId = restaurantId.split("-");
					if(restaurantId.constructor !== Array)	restaurantId = [restaurantId];
					restaurantId = arrayToObject(restaurantId);
					commonConditions["restaurant_id"] = {$in : restaurantId};
				}

				/** Conditions for branch */
				if (branchId && branchId != "null") {
					branchId = branchId.split("-");
					if(branchId.constructor !== Array)	branchId = [branchId];
					branchId = arrayToObject(branchId);
					commonConditions["branch_id"] = {$in : branchId};
				}

				dataTableConfig.conditions = Object.assign(commonConditions, dataTableConfig.conditions);

				/** Get data from database */
				let dbRes = await collection.aggregate([
					{$match: dataTableConfig.conditions},
					{$group	: {
						_id  :{
							restaurant_id   : "$restaurant_id"
						},
						restaurant_name : { $first : "$restaurant_name"},
						total_orders 	: {$sum : 1},
						total_amount 	: {$sum : "$order_price"},
					}},
					{$facet : {
						list : [
							{$sort: dataTableConfig.sort_conditions },
							{$skip: skip},
							{$limit: limit}
						],
						count: [
							{$count: "count"},
						],
					}}
				]).toArray();

				/** Send response **/
				res.send({
					status: Constants.STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data			:   dbRes?.[0]?.list ||[],
					recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
					recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
				}); 
			}else{
				let tempRestaurantId = restaurantId?.replace(/,/g,"-");
				let tempBranchId 	 = branchId?.replace(/,/g,"-");
				/** Conditions for date */
				if (fromDate != "" && toDate != "") {
					commonConditions["order_date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					}
				}

				/** Conditions for restaurant */
				if (tempRestaurantId && tempRestaurantId != "null") {
					restaurantId = tempRestaurantId.split("-");
					if(restaurantId.constructor !== Array)	restaurantId = [restaurantId];
					restaurantId = arrayToObject(restaurantId);
					commonConditions["restaurant_id"] = {$in : restaurantId};
				}

				/** Conditions for branch */
				if (tempBranchId && tempBranchId != "null") {
					branchId = tempBranchId.split("-");
					if(branchId.constructor !== Array)	branchId = [branchId];
					branchId = arrayToObject(branchId);
					commonConditions["branch_id"] = {$in : branchId};
				}
				
				asyncParallel({
					delivered_orders_chart : (callback)=>{
						/** Get delivered orders date wise **/
						collection.aggregate([
							{$match	: commonConditions},
							{$group	: {
								_id  :{$dateToString: {format: Constants.GRAPH_DATE_FORMAT,date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE}},
								total_cravez_delivery : {$sum : {
									$cond: [
										{$and: [
											{ $eq : ["$delivery_type",Constants.DELIVERY_BY_CRAVEZ] },
										]},
										1,
										0
									]}
								},
								total_restaurant_delivery : {$sum : {
									$cond: [
										{$and: [
											{ $eq : ["$delivery_type",Constants.DELIVERY_BY_RESTAURANT] },
										]},
										1,
										0
									]}
								},
								total_pickup_delivery : {$sum : {
									$cond: [
										{$and: [
											{ $eq : ["$delivery_type",Constants.DELIVERY_BY_PICK_UP] },
										]},
										1,
										0
									]}
								},
							}},
							{$sort: {_id : Constants.SORT_ASC}}
						]).toArray().then(chartResult=>{
							callback(null, chartResult);
						}).catch(chartErr=>{
							callback(chartErr, []);
						});
					},
					total_net_amount_chart : (callback)=>{
						/** Get total net amopunt of delivered orders date wise **/
						collection.aggregate([
							{$match	: commonConditions},
							{$group	: {
								_id  :{$dateToString: {format: Constants.GRAPH_DATE_FORMAT, date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE}},
								total_net_amount : {$sum : "$order_price"},
							}},
							{$sort: {_id : Constants.SORT_ASC}}
						]).toArray().then(netAmountChartResult=>{
							callback(null, netAmountChartResult);
						}).catch(netAmountChartErr=>{
							callback(netAmountChartErr, []);
						});
					}
				},(err,response)=>{
					if(err) return next(err);
					
					req.breadcrumbs(BREADCRUMBS['admin/sales_reports/sales_report_list']);
					res.render('total_order_per_restaurant',{
						layout : false,
						delivered_orders_chart : response.delivered_orders_chart,
						total_net_amount_chart : response.total_net_amount_chart,
						from_date 		: fromDate,
						to_date   		: toDate,
						restaurant_id   : tempRestaurantId,
						branch_id       : tempBranchId
					});
				});
			}
		}catch(err){
			return next(err);
		}
	}

	/**
	 * Function to get total order per restaurant with selected payment method sales report 
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async totalOrderPerRestaurantWithPaymentMethod(req,res,next){
		try{
			let fromDate 	 	= req?.query?.date_from || "";
			let toDate   	 	= req?.query?.date_to || "";
			let paymentMethod   = req?.query?.payment_method || "";
			let restaurantId 	= req?.query?.restaurant_id || "";
			let branchId 		= req?.query?.branch_id || "";

			/** Common conditions  */
			let commonConditions = { order_status : Constants.ORDER_DELIVERED};
			
			const collection 	= this.db.collection(Tables.ORDERS);
			if(isPost(req)){
				let limit  = (req.body.length) ? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip   = (req.body.start)  ? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;

				/** Configure Datatable conditions*/
				const dataTableConfig = await configDatatable(req, res, null);

				/** Conditions for date */
				if (fromDate != "" && toDate != "") {
					commonConditions["order_date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					}
				}

				/** Set Conditions for payment method */
				if(paymentMethod) commonConditions.payment_method = paymentMethod;

				/** Conditions for restaurant */
				if (restaurantId && restaurantId != "null") {
					restaurantId = restaurantId.split("-");
					if(restaurantId.constructor !== Array)	restaurantId = [restaurantId];
					restaurantId = arrayToObject(restaurantId);
					commonConditions["restaurant_id"] = {$in : restaurantId};
				}

				/** Conditions for branch */
				if (branchId && branchId != "null") {
					branchId = branchId.split("-");
					if(branchId.constructor !== Array)	branchId = [branchId];
					branchId = arrayToObject(branchId);
					commonConditions["branch_id"] = {$in : branchId};
				}

				dataTableConfig.conditions = Object.assign(commonConditions, dataTableConfig.conditions);

				asyncParallel({
					data: (callback)=>{
						/** Get records in orders collection **/
						collection.aggregate([
							{$match	: dataTableConfig.conditions},
							{$group	: {
								_id  :{
									restaurant_id   : "$restaurant_id"
								},
								restaurant_name : { $first : "$restaurant_name"},
								total_orders 	: {$sum : 1},
								total_amount 	: {$sum : "$order_price"}
							}},
							{$sort 	: dataTableConfig.sort_conditions},
							{$skip 	: skip},
							{$limit : limit}
						]).toArray().then(findResult=>{
							callback(null,findResult);
						}).catch(findErr=>{
							callback(findErr,[]);
						});
					},
					records_total: (callback)=>{
						/** Get total number of records in orders  collection **/
						collection.aggregate([
							{$match	: commonConditions},
							{$group	: {
								_id  :{
									restaurant_id   : "$restaurant_id"
								},
								total_orders : {$sum : 1},
								total_amount : {$sum : "$order_price"}
							}},
							{ $count	: "count" }
						]).toArray().then(countResult=>{
							callback(null, countResult?.[0]?.count || 0);
						}).catch(countErr=>{
							callback(countErr, 0);
						});
					},
					records_filtered: (callback)=>{
						/** Get filtered records counting in orders **/
						collection.aggregate([
							{$match	: dataTableConfig.conditions},
							{$group	: {
								_id  :{
									restaurant_id   : "$restaurant_id"
								},
								total_orders : {$sum : 1},
								total_amount : {$sum : "$order_price"}
							}},
							{ $count	: "count" }
						]).toArray().then(filterCount=>{
							callback(null, filterCount?.[0]?.count || 0);
						}).catch(filterErr=>{
							callback(filterErr, 0);
						});
					}
				},(err, response)=>{
					/** Send response **/
					res.send({
						status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
						draw			: dataTableConfig.result_draw,
						data			: response.data,
						recordsFiltered	: response.records_filtered,
						recordsTotal	: response.records_total,
					});
				});
			}else{

				let tempRestaurantId = restaurantId?.replace(/,/g,"-");
				let tempBranchId 	 = branchId?.replace(/,/g,"-");
				/** Conditions for date */
				if (fromDate != "" && toDate != "") {
					commonConditions["order_date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					}
				}

				/** Conditions for restaurant */
				if (tempRestaurantId && tempRestaurantId != "null") {
					restaurantId = tempRestaurantId.split("-");
					if(restaurantId.constructor !== Array)	restaurantId = [restaurantId];
					restaurantId = arrayToObject(restaurantId);
					commonConditions["restaurant_id"] = {$in : restaurantId};
				}

				/** Conditions for branch */
				if (tempBranchId && tempBranchId != "null") {
					branchId = tempBranchId.split("-");
					if(branchId.constructor !== Array)	branchId = [branchId];
					branchId = arrayToObject(branchId);
					commonConditions["branch_id"] = {$in : branchId};
				}

				/** Set Conditions for payment method */
				if(paymentMethod) commonConditions.payment_method = paymentMethod;

				asyncParallel({
					delivered_orders_chart : (callback)=>{
						/** Get delivered orders date wise **/
						collection.aggregate([
							{$match	: commonConditions},
							{$group	: {
								_id  :{$dateToString: {format: Constants.GRAPH_DATE_FORMAT,date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE}},
								total_net_amount : {$sum : "$order_price"},
								total_cravez_delivery : {$sum : {
									$cond: [
										{$and: [
											{ $eq : ["$delivery_type",Constants.DELIVERY_BY_CRAVEZ] },
										]},
										1,
										0
									]}
								},
								total_restaurant_delivery : {$sum : {
									$cond: [
										{$and: [
											{ $eq : ["$delivery_type",Constants.DELIVERY_BY_RESTAURANT] },
										]},
										1,
										0
									]}
								},
								total_pickup_delivery : {$sum : {
									$cond: [
										{$and: [
											{ $eq : ["$delivery_type",Constants.DELIVERY_BY_PICK_UP] },
										]},
										1,
										0
									]}
								},
							}},
							{$sort: {_id : Constants.SORT_ASC}}
						]).toArray().then(chartResult=>{
							callback(null, chartResult);
						}).catch(chartErr=>{
							callback(chartErr, []);
						});
					},
				},(err,response)=>{
					if(err) return next(err);
					
					req.breadcrumbs(BREADCRUMBS['admin/sales_reports/sales_report_list']);
					res.render('total_order_per_restaurant_with_payment_method',{
						layout : false,
						delivered_orders_chart : response?.delivered_orders_chart || [],
						total_net_amount_chart : response?.delivered_orders_chart || [],
						from_date 		: fromDate,
						to_date   		: toDate,
						payment_method  : paymentMethod,
						restaurant_id   : tempRestaurantId,
						branch_id       : tempBranchId
					});
				});
			}
		}catch(err){
			return next(err);
		}
	}
}
