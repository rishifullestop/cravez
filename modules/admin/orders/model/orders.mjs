import axios from 'axios';
import clone from 'clone';
import { ObjectId } from 'mongodb';
import {parallel as asyncParallel} from 'async';

import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import * as Helper from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { saveSystemLogs, sendMailToUsers} from "../../../../services/index.mjs";

import orderModal from '../../../frontend/api/model/order.mjs';
import cartModal from '../../../frontend/api/model/user_carts.mjs';
import customerAddressModal from '../../../frontend/api/model/customer_address.mjs';

export default class Orders {
    constructor(db) {
        this.db = db;
		this.orderCollection 		= 	db.collection(Tables.ORDERS);
		this.orderDetailsCollection = 	db.collection(Tables.ORDER_DETAILS);
		this.orderItemCollection 	= 	db.collection(Tables.ORDER_ITEMS);

		this.cartAPI   			=   new cartModal(db);
		this.orderAPI   		=   new orderModal(db);
        this.customerAddressAPI =   new customerAddressModal(db);

		 // Use in export data
        this.exportNumber = 0;
        this.exportFilterConditions = {};
        this.exportSortConditions = {};
        this.exportCommonConditions = {};
        this.exportSortConditions[this.exportNumber] = { _id: Constants.SORT_DESC };
    }

	/**
	 * Function to get orders list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	async getOrdersList (req, res,next){
		let status		= (req.query.status)	 ? req.query.status     : '';
		let cuisineId	= (req.query.cuisine_id) ? req.query.cuisine_id : '';
		let orderType	= (req.query.order_type) ? req.query.order_type : '';
		let offerId		= (req.query.offer_id)	 ? req.query.offer_id   : '';
		let deliveryType= (req.query.delivery_type)  ? req.query.delivery_type : "";

		let isTeamHead	=   (req.session.user.team_head) ? req.session.user.team_head :false;
		let authRoleId	=	(req.session.user.user_role_id)? req.session.user.user_role_id :"";

		let businessRule 		= 	null;
		let businessConditions 	=	null;
		if(authRoleId == Constants.CALL_CENTER_TEAM && !isTeamHead){
			let taskAssignments = await Helper.getConditionsBasedOnCallCenterRole(req,res,next);
			businessRule 		= taskAssignments?.rules || {};
			businessConditions 	= taskAssignments?.conditions || [];
		}

		if(Helper.isPost(req)){
			let limit			= (req.body.length) ? parseInt(req.body.length)	: Constants.ADMIN_LISTING_LIMIT;
			let skip			= (req.body.start)	? parseInt(req.body.start)	: Constants.DEFAULT_SKIP;
			let status			= (req.body.status)   ? req.body.status 	: '';
			let fromDate  		= (req.body.fromDate) ? req.body.fromDate 	: "";
			let toDate 	  		= (req.body.toDate)   ? req.body.toDate     : "";
			let restaurantIds 	= (req.body.restaurant_ids)  ? req.body.restaurant_ids    : "";
			deliveryType 		= (req.body.delivery_type)   ? req.body.delivery_type     : "";
			let isOrderAssigned = (req.body.is_order_assigned)? req.body.is_order_assigned: "";
			let exportCount	  	= (req.body.export_count) 	  ? req.body.export_count     : 0;
			let captainId 		= (req.body.captain_id)		  ? req.body.captain_id		  : "";

			/** Configure Datatable conditions*/
			const dataTableConfig = await Helper.configDatatable(req, res, null);

			/**  All queries in parallel using object keys */
			const asyncResponse = await Helper.runTaskParallel({
				offer_orders: (offerId) ?
					this.orderDetailsCollection.distinct("order_id",{offer_id : new ObjectId(offerId)}).then(orderIds=> orderIds || [])
				:null,
				cuisine_orders: (cuisineId) ?
					this.orderItemCollection.distinct("order_id",{cuisine_ids : {$in : [new ObjectId(cuisineId)]}}).then(orderIds=> orderIds || [])
				:null,
			});

			let commonConditions = {};
			if(authRoleId == Constants.CALL_CENTER_TEAM && !isTeamHead){
				if(businessConditions?.length){
					businessConditions.push({delivery_type : Constants.DELIVERY_BY_PICK_UP});
					commonConditions["$or"] = businessConditions;
				}else{
					/** Send response **/
					return res.send({
						status			: Constants.STATUS_SUCCESS,
						draw			: dataTableConfig.result_draw,
						data			: [],
						recordsFiltered	: 0,
						recordsTotal	: 0,
					});
				}
			}

			if(status){
				if(status.constructor !== Array)  status = [status];
				let statusConditions = [];
				status.map(statusKey=>{
					if(statusKey == Constants.ORDER_REJECTED){
						statusConditions.push({
							admin_status : {$in : [Constants.ORDER_REJECTED, Constants.ORDER_REJECTED_BY_ADMIN]}
						});
					}else{
						statusConditions.push({admin_status : statusKey });
					}

					dataTableConfig.conditions['$and'] = [{$or: statusConditions}];

					if(statusKey == Constants.ORDER_PENDING && req.query && req.query.is_confirm && typeof req.query.is_confirm !== typeof undefined){
						dataTableConfig.conditions['is_confirm']= JSON.parse(req.query.is_confirm);
					}
				});
			}

			if(orderType){
				let tmpConditions = Helper.getTaskAssignmentConditions({[orderType]:orderType});
				if(tmpConditions?.length){
					if(!commonConditions["$and"]) commonConditions["$and"] = [];
					commonConditions["$and"].push(...tmpConditions);
				}
			}

			/** Conditions for order date */
			let dateConditions = {};
			if (fromDate != "" && toDate != "") {
				dateConditions["order_date"] = {$gte : Helper.newDate(fromDate), $lte : Helper.newDate(toDate) };
			}

			/** Conditions for delivery by */
			if(deliveryType){
				if(deliveryType.constructor !== Array)  deliveryType = [deliveryType];

				let deliveryByConditions = [];
				deliveryType.map(key=>{
					deliveryByConditions.push({delivery_type : key });
				});
				if( !dataTableConfig.conditions['$and']) dataTableConfig.conditions['$and'] = [];

				dataTableConfig.conditions['$and'].push({$or: deliveryByConditions});
			}

			/** Conditions for restaurant */
			if(restaurantIds){
				if(restaurantIds.constructor !== Array)	restaurantIds = [restaurantIds];
				restaurantIds = Helper.arrayToObject(restaurantIds);

				if(!dataTableConfig.conditions['$and']) dataTableConfig.conditions['$and'] =[];
				dataTableConfig.conditions['$and'].push({restaurant_id: {$in: restaurantIds}});
			}

			/** Conditions for order assigned or not */
			if(isOrderAssigned){
				if(!dataTableConfig.conditions['$and']) dataTableConfig.conditions['$and'] =[];

				if(isOrderAssigned == Constants.ORDER_ASSIGNED){
					dataTableConfig.conditions['$and'].push({$or: [
						{captain_name	: {$exists: true, $ne: ""}}, // when restaurant delivered
						{captain_id		: {$nin: ["",null]}},// when cravez delivered
					]});
				}else{
					dataTableConfig.conditions['$and'].push({$or:[
						{
							delivery_type 	: 	Constants.DELIVERY_BY_CRAVEZ,
							captain_id		:	""
						},
						{
							delivery_type 	: 	Constants.DELIVERY_BY_RESTAURANT,
							captain_name	:	{$exists: false}
						},
					]});
				}
			}

			/** Conditions for redeem offer */
			if(offerId) commonConditions['_id']  = {$in : Helper.arrayToObject(asyncResponse.offer_orders)};
			if(cuisineId) commonConditions['_id']  = {$in : Helper.arrayToObject(asyncResponse.cuisine_orders)};

			/** Conditions for captain id */
			if(captainId){
				if(!dataTableConfig.conditions['$and']) dataTableConfig.conditions['$and'] =[];
				dataTableConfig.conditions['$and'].push({
					captain_id : 	new ObjectId(captainId)
				});
			}

			dataTableConfig.conditions= Object.assign(dateConditions,dataTableConfig.conditions,commonConditions);

			/** Set conditions for export order detail report **/
			this.exportCommonConditions				= commonConditions;
			this.exportFilterConditions[exportCount]= dataTableConfig.conditions;
			this.exportSortConditions[exportCount]	= dataTableConfig.sort_conditions;

			/** Default sorting **/
			if(dataTableConfig.sort_conditions && typeof dataTableConfig.sort_conditions["_id"] !== typeof undefined){
				dataTableConfig.sort_conditions = {order_date:Constants.SORT_DESC};
			}

			// Get list or count of orders
			let dbRes = await this.orderCollection.aggregate([
				{$match: dataTableConfig.conditions },
				{$facet : {
					list : [
						{$sort  : dataTableConfig.sort_conditions},
						{$skip 	: skip},
						{$limit : limit},
						{$lookup: {	/** Get order details **/
							from 		:	Tables.ORDER_DETAILS,
							localField  :	"_id",
							foreignField:	"order_id",
							as 		  	:	"order_details"
						}},
						{$project : {
							_id:1,customer_id:1,is_confirm:1,number_of_queue:1,queue_time:1,invoice_number:1,unique_order_id:1,order_date:1,last_status_updated_on:1,restaurant_name:1,order_price:1,infinity_service:1,admin_status:1,modified:1,net_amount:1, is_first_order: 1, is_duplicate_order:1,is_completed:1,is_modified:1,order_status:1,package_id:1,first_name: 1,last_name: 1, customer_latitude: {$arrayElemAt: ["$order_details.customer_latitude",0]}, customer_longitude: {$arrayElemAt: ["$order_details.customer_longitude",0]}, restaurant_address: {$arrayElemAt: ["$order_details.restaurant_address",0]},delivery_area_id: {$arrayElemAt: ["$order_details.delivery_area_id",0]}, customer_address_id: {$arrayElemAt: ["$order_details.customer_address_id",0]}, offer_id: {$arrayElemAt: ["$order_details.offer_id",0]}, customer_address_detail: {$arrayElemAt: ["$order_details.customer_address_detail",0]}, mobile_number: 1,discount_price: {$arrayElemAt: ["$order_details.discount_price",0]},delivery_duration: {$arrayElemAt: ["$order_details.delivery_duration",0]},remaining_delivery_duration: {$arrayElemAt: ["$order_details.remaining_delivery_duration",0]}, branch_id:1,restaurant_id:1,queue_sort: { $cond: [{$eq : ["$queue_time",""]},1,0]},refund_amount_status:1,is_big_order:1,is_delayed_acceptance:1,is_delayed_preperation:1,is_delayed_pickup_by_captain:1,is_delayed_picked_up_by_customer:1,is_delayed_pickup:1,delivery_type:1,is_vip:1,is_delayed_delivery:1,notes:1,payment_method:1,rejection_reason:1,cancelled_user_role_id:1,request_note:1,partners:1,is_delayed:1,delivery_status:1,cancel_reason_id:1, captain_name: 1,captain_id:1,assignment_type:1,amount_debited_by_wallet:1,order_revert_by: 1,is_schedule:1,scheduled_to_submit_time:1,
							kfg_push_retry:1,kfg_modified_push_retry:1,kfg_order:1
						}},
					],
					count: [
						{$count: "count"},
					],
				}}
			],{allowDiskUse: true}).toArray();

			let result = dbRes?.[0]?.list ||[];
			let uniqueOrderIds = [];
			let deliveryAreaIds = [];
			result.map(record=>{
				if(record.unique_order_id) uniqueOrderIds.push(record.unique_order_id);
				if(record.delivery_area_id) deliveryAreaIds.push(record.delivery_area_id);
			});

			const areas = this.db.collection(Tables.AREAS);
			const order_modify_logs = this.db.collection(Tables.ORDER_MODIFY_LOGS);

			/**  All queries in parallel using object keys */
			const childResponse = await Helper.runTaskParallel({
				modify_order_details: uniqueOrderIds?.length ?
					order_modify_logs.aggregate([
						{$match	: {unique_order_id : {$in : uniqueOrderIds}}},
						{$sort : {created: Constants.SORT_ASC}},
						{$group	: {
							_id  :{
								unique_order_id   : "$unique_order_id"
							},
							unique_order_id    : {$first : "$unique_order_id"},
							modify_order_price : {$first : "$order_price"},
						}},
					]).toArray().then(findResult=> findResult || [])
				:null,
				delivery_area_details: (cuisineId) ?
					areas.find({_id : {$in : deliveryAreaIds}},{projection : {_id: 1,name:1}}).toArray().then(deliveryAreaResult=>{
						let deliveryAreaList = {};
						deliveryAreaResult.map(records=>{
							deliveryAreaList[records._id] = records.name[Constants.DEFAULT_LANGUAGE_CODE];
						});
						return deliveryAreaList;
					})
				:null,
			});

			let modifyOrderResult = (childResponse.modify_order_details) ? childResponse.modify_order_details : [];
			let deliveryAreaResult = (childResponse.delivery_area_details) ? childResponse.delivery_area_details : {};
			result.map(record=>{
				/** Insert delivery area in records **/
				record.delivery_area = deliveryAreaResult[record.delivery_area_id] ? deliveryAreaResult[record.delivery_area_id] : "";

				/** Insert modify order price in records **/
				modifyOrderResult.map(orderRecords=>{
					if(record.unique_order_id == orderRecords.unique_order_id){
						record.modify_order_price = orderRecords.modify_order_price;
					}
				});

				/** Insert time passed in records **/
				let currentDate = Helper.newDate();
				let timePassed  = Helper.getDifferenceBetweenTwoDatesInMinute(record.order_date,currentDate);
				record.time_passed = (timePassed >0) ? parseInt(timePassed) :0;
			});

			/** Send response **/
			res.send({
				status			: 	Constants.STATUS_SUCCESS,
				draw			: 	dataTableConfig.result_draw,
				data			:   result,
				recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
				recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
			});
		}else{
			this.exportNumber++;

			/**Set driver conditions */
			let driverConditions	= clone(Constants.DRIVER_COMMON_CONDITIONS);
			let selectRestaurant	= (req.query.restaurant_id) ? req.query.restaurant_id : "";
			let selectBranch		= (req.query.branch_id) ? req.query.branch_id : "";
			let fromDate			= (req.query.from_date) ? req.query.from_date : "";
			let toDate				= (req.query.to_date) ? req.query.to_date : "";
			let uniqueOrderId		= (req.query.unique_order_id) ? req.query.unique_order_id : "";
			asyncParallel({
				dropList : (callback)=>{
					let options = {
						collections :[
							{
								collection : Tables.RESTAURANTS,
								columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
								selected   : selectRestaurant ? [selectRestaurant] : [],
								conditions : {
									status		: Constants.ACTIVE,
									is_deleted	: Constants.NOT_DELETED
								},
							},
							{
								collection : Tables.CANCEL_REASONS,
								columns    : ["_id",["title",Constants.DEFAULT_LANGUAGE_CODE]],
								conditions : { status : Constants.ACTIVE},
							},
							{
								collection 	: Tables.USERS,
								columns    	: ["_id","full_name"],
								conditions 	: driverConditions,
								sort_conditions : {is_available : Constants.SORT_DESC,full_name: Constants.SORT_ASC}
							}
						],
					};
					/**Get dropdown list **/
					Helper.getDropdownList(req,res, next,options).then(dropDownResponse=> {
						if(dropDownResponse.status != Constants.STATUS_SUCCESS) return callback(dropDownResponse);
						callback(null,dropDownResponse?.final_html_data || []);
					}).catch(next);
				},
				orders_detail : (callback)=>{
					/** Get total orders **/
						callback(null,{});
				},
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				/** render listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/orders/list']);
				res.render('list',{
					status			: status,
					order_type		: orderType,
					is_confirm		: req?.query?.is_confirm || '',
					restaurant_list : asyncResponse?.dropList?.["0"] || '',
					first_orders 	: asyncResponse?.orders_detail?.first_orders || 0,
					duplicate_orders: asyncResponse?.orders_detail?.duplicate_orders || 0,
					big_orders 		: asyncResponse?.orders_detail?.big_orders || 0,
					order_rejected 	: asyncResponse?.orders_detail?.order_rejected || 0,
					delayed_acceptance : asyncResponse?.orders_detail?.delayed_acceptance || 0,
					delayed_preparation : asyncResponse?.orders_detail?.delayed_preparation || 0,
					delayed_pickup_by_captain 	: asyncResponse?.orders_detail?.delayed_pickup_by_captain || 0,
					delayed_pickup_by_customer 	: asyncResponse?.orders_detail?.delayed_pickup_by_customer || 0,
					delayed_pickup_by_restaurant 	: asyncResponse?.orders_detail?.delayed_pickup_by_restaurant || 0,
					vip_orders 	: asyncResponse?.orders_detail?.vip_orders || 0,
					delayed_delivery 	: asyncResponse?.orders_detail?.delayed_delivery || 0,
					delivery_cravez 	: asyncResponse?.orders_detail?.delivery_cravez || 0,
					delivery_restaurant : asyncResponse?.orders_detail?.delivery_restaurant || 0,
					cancel_reason_list  : asyncResponse?.dropList?.["1"] || '',
					export_count 		: this.exportNumber,
					offer_id            : offerId,
					delivery_type       : deliveryType,
					driver_list 		: asyncResponse?.dropList?.["2"] || '',
					businessRule  		: businessRule,
					filter_restaurant	: selectRestaurant,
					filter_branch		: selectBranch,
					filter_start_date	: fromDate,
					filter_to_date		: toDate,
					filter_cuisine		: cuisineId,
					unique_order_id		: uniqueOrderId,
				});
			});
		}
	};//End getOrdersList()

	/**
	 * Function to get order count
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getOrderCounts (req, res, next){
		return new Promise(async resolve=>{
			let isTeamHead		= (req.session.user.team_head) ? req.session.user.team_head :false;
			let authUserRoleId	= req.session.user.user_role_id;
			let fromDate  		= (req.body.from_date) ? req.body.from_date	: "";
			let toDate 	  		= (req.body.to_date)   ? req.body.to_date   : "";

			/** Set conditions */
			let countConditions = {};

			/** Conditions for order date */
			if (fromDate != "" && toDate != "") {
				countConditions.order_date = { $gte: Helper.newDate(fromDate), $lte: Helper.newDate(toDate) };
			}

			if(authUserRoleId == Constants.CALL_CENTER_TEAM && !isTeamHead){
				let taskAssignments = await Helper.getConditionsBasedOnCallCenterRole(req,res,next);
				if(taskAssignments?.conditions.length){
					countConditions["$or"] = taskAssignments?.conditions;
				}
			}

			this.orderCollection.aggregate([
				{$match : countConditions},
				{$addFields: {
					confirm_status : {$ifNull: [ "$confirm_status", [] ] }
				}},
				{$addFields: {
					confirm_is_delayed_pickup_by_captain : {
						$filter: {
							input: "$confirm_status",
							as: "records",
							cond: { $eq: [ "$$records.is_delayed_pickup_by_captain", true ] }
							}
					},
					confirm_is_delayed_delivery : {
						$filter: {
							input: "$confirm_status",
							as: "records",
							cond: { $eq: [ "$$records.is_delayed_delivery", true ] }
							}
					},
					confirm_delayed_pickup_by_restaurant : {
						$filter: {
							input: "$confirm_status",
							as: "records",
							cond: { $eq: [ "$$records.delayed_pickup_by_restaurant", true ] }
							}
					},
					confirm_is_delayed_picked_up_by_customer : {
						$filter: {
							input: "$confirm_status",
							as: "records",
							cond: { $eq: [ "$$records.is_delayed_picked_up_by_customer", true ] }
							}
					},
					confirm_is_delayed_preperation : {
						$filter: {
							input: "$confirm_status",
							as: "records",
							cond: { $eq: [ "$$records.is_delayed_preperation", true ] }
							}
					},
					confirm_is_delayed_acceptance : {
						$filter: {
							input: "$confirm_status",
							as: "records",
							cond: { $eq: [ "$$records.is_delayed_acceptance", true ] }
							}
					},
				}},
				{$group: {
					_id : null,
					first_orders : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$admin_status",Constants.ORDER_PENDING] },
								{ $eq : ["$is_first_order",true] },
							]},
							1, 0
						]}
					},
					duplicate_orders : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$admin_status",Constants.ORDER_PENDING] },
								{ $eq : ["$is_duplicate_order",true] },
							]},
							1, 0
						]}
					},
					big_orders : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$admin_status",Constants.ORDER_PENDING] },
								{ $eq : ["$is_big_order",true] },
							]},
							1, 0
						]}
					},
					order_rejected : {$sum : {
						$cond: [
							{$or: [
								{ $eq : ["$admin_status",Constants.ORDER_REJECTED ] },
								{ $eq : ["$admin_status",Constants.ORDER_REJECTED_BY_ADMIN] },
							]},
							1, 0
						]}
					},
					delayed_acceptance : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$is_delayed_acceptance", true ] },
								{ $eq : [{"$size":"$confirm_is_delayed_acceptance"}, 0 ] },
							]},
							1, 0
						]}
					},
					delayed_preparation : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$is_delayed_preperation", true ] },
								{ $eq : [{"$size":"$confirm_is_delayed_preperation"}, 0 ] },
							]},
							1, 0
						]}
					},
					delayed_pickup_by_customer : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$is_delayed_picked_up_by_customer", true ] },
								{ $eq : [{"$size":"$confirm_is_delayed_picked_up_by_customer"}, 0 ] },
							]},
							1, 0
						]}
					},
					delayed_pickup_by_captain : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$is_delayed_pickup_by_captain", true ] },
								{ $eq : [{"$size":"$confirm_is_delayed_pickup_by_captain"}, 0 ] },
							]},
							1, 0
						]}
					},
					delayed_pickup_by_restaurant : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$is_delayed_pickup", true ] },
								{ $eq : ["$delivery_type", Constants.DELIVERY_BY_RESTAURANT ] },
								{ $eq : [{"$size":"$confirm_delayed_pickup_by_restaurant"}, 0 ] },
							]},
							1, 0
						]}
					},
					vip_orders : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$is_vip", true ] },
							]},
							1, 0
						]}
					},
					delayed_delivery : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$is_delayed_delivery", true ] },
								{ $eq : [{"$size":"$confirm_is_delayed_delivery"}, 0 ] },
							]},
							1, 0
						]}
					},
					delivery_cravez : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$delivery_type", Constants.DELIVERY_BY_CRAVEZ ] },
							]},
							1, 0
						]}
					},
					delivery_restaurant : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$delivery_type", Constants.DELIVERY_BY_RESTAURANT ] },
							]},
							1, 0
						]}
					},
				}}
			],{allowDiskUse: true}).toArray().then(result=>{
				/** Send response */
				result = result?.[0] || {};
				resolve({
					status						: Constants.STATUS_SUCCESS,
					first_orders 				: result?.first_orders || 0,
					duplicate_orders			: result?.duplicate_orders || 0,
					big_orders 					: result?.big_orders || 0,
					order_rejected 				: result?.order_rejected || 0,
					delayed_acceptance 			: result?.delayed_acceptance || 0,
					delayed_preparation 		: result?.delayed_preparation || 0,
					delayed_pickup_by_captain 	: result?.delayed_pickup_by_captain || 0,
					delayed_pickup_by_customer 	: result?.delayed_pickup_by_customer || 0,
					delayed_pickup_by_restaurant: result?.delayed_pickup_by_restaurant || 0,
					vip_orders 					: result?.vip_orders || 0,
					delayed_delivery 			: result?.delayed_delivery || 0,
					delivery_cravez 			: result?.delivery_cravez || 0,
					delivery_restaurant 		: result?.delivery_restaurant || 0,
				});
			}).catch(next);
		}).catch(next);
	};// end getOrderCounts

	/**
	 * Function for view order detail
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render
	 */
	async viewOrderDetails (req, res, next){
		let type =	(req.params.type) ? req.params.type : '';

		/** Get order details **/
		req.breadcrumbs(BREADCRUMBS['admin/orders/view']);
		let orderRes = await this.getOrderDetails(req, res, next);

		/** Send error response **/
		if(orderRes.status != Constants.STATUS_SUCCESS){
			req.flash(Constants.STATUS_ERROR,orderRes.message);
			return res.redirect(Constants.WEBSITE_ADMIN_URL+"orders");
		}

		/** Render view page*/
		res.render('view',{
			type		 	:  type,
			result 		 	: 	orderRes.result,
			orderDetails 	: 	orderRes.orderDetails,
			modify_details 	: 	orderRes.modify_details,
		});
	};//End viewOrderDetails()

	/**
	 * Function to get order detail
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	async getOrderDetails (req, res, next){
		return new Promise(resolve=>{
			let orderId = new ObjectId(req.params.id);

			asyncParallel({
				result :(callback)=>{
					/** Get detail of Order **/
					this.orderCollection.findOne({_id : new ObjectId(orderId) }).then(orderResult=>{
						if(!orderResult) return callback(null,null);

						let deliveryType=	(orderResult.delivery_type) ? orderResult.delivery_type : '';
						let restaurantId=	(orderResult.restaurant_id) ? orderResult.restaurant_id : '';
						let branchId	=	(orderResult.branch_id) 	? orderResult.branch_id 	: '';
						let userIds 	= 	[];
						if(orderResult.customer_id) userIds.push(orderResult.customer_id);
						if(orderResult.captain_id) userIds.push(orderResult.captain_id);
						orderResult.delivery_detail = (Constants.DELIVERY_BY[deliveryType])? {title: Constants.DELIVERY_BY[deliveryType]} :{};

						asyncParallel({
							user_detail : (orderCallback)=>{
								const users = this.db.collection(Tables.USERS);
								users.find({_id : {$in : Helper.arrayToObject(userIds)}},{projection : {_id: 1,full_name: 1,mobile_number:1}}).toArray().then(userResult=>{
									if(userResult.length <= 0) return orderCallback(null,null);

									let userList = {};
									userResult.forEach(user=>{
										userList[user._id] = { 'name' : user.full_name, 'mobile' :  user.mobile_number};
									});

									orderCallback(null,userList);
								}).catch(next);
							},
							restaurant_detail :(orderCallback)=>{
								if(!restaurantId) return orderCallback(null,null);

								const restaurants = this.db.collection(Tables.RESTAURANTS);
								restaurants.findOne({_id : new ObjectId(restaurantId) },{projection: {_id:1,name:1}}).then(restResult=>{
									orderCallback(null, restResult);
								}).catch(next);
							},
							modify_order_details : (orderCallback)=>{
								/** Get modify order price **/
								const order_modify_logs = this.db.collection(Tables.ORDER_MODIFY_LOGS);
								order_modify_logs.aggregate([
									{$match	: {unique_order_id : orderResult.unique_order_id}},
									{$sort : {created: Constants.SORT_ASC}},
									{$group	: {
										_id  :{
											unique_order_id   : "$unique_order_id"
										},
										unique_order_id    : {$first : "$unique_order_id"},
										modify_order_price : {$first : "$order_price"},
									}},
								]).toArray().then(modifyOrderResult=>{
									orderCallback(null, modifyOrderResult);
								}).catch(next);
							},
							restaurant_branch_detail :(orderCallback)=>{
								if(!restaurantId || !branchId) return orderCallback(null,null);

								/** Get restaurant branch details**/
								const restaurant_branches = this.db.collection(Tables.RESTAURANT_BRANCHES);
								restaurant_branches.findOne({_id : new ObjectId(branchId), restaurant_id : new ObjectId(restaurantId) },{projection: { _id:1,name:1 }}).then(restaurantBranchResult=>{
									orderCallback(null, restaurantBranchResult);
								}).catch(next);
							},
							restaurant_branch_contact_number_details :(orderCallback)=>{
								if(!restaurantId || !branchId) return orderCallback(null,null);

								/** Get restaurant branch phone number details**/
								const restaurant_branch_phone_numbers = this.db.collection(Tables.RESTAURANT_BRANCH_PHONE_NUMBERS);
								restaurant_branch_phone_numbers.find({
									branch_id : new ObjectId(branchId), restaurant_id : new ObjectId(restaurantId)
								},{projection: {
									_id:1,country_code:1,value:1,attribute_id:1,contact_name:1
								}}).toArray().then(restaurantBranchContactNumberResult=>{
									if(restaurantBranchContactNumberResult.length <= 0) return orderCallback(null,null);

									/** Push attribute id in a array**/
									let attributeIds = [];
									restaurantBranchContactNumberResult.map(records=>{
										if(records.attribute_id) attributeIds.push(records.attribute_id);
									});

									/** Get attribute details**/
									const attributes = this.db.collection(Tables.ATTRIBUTES);
									attributes.find({ attribute_id : {$in : attributeIds}},{projection: {_id:1,attribute_id:1,title:1}}).toArray().then(attributesResult=>{
										if(attributesResult.length <= 0) return orderCallback(null,null);

										/** Insert attribute title in contact number details**/
										restaurantBranchContactNumberResult.map(branchRecords=>{
											attributesResult.map(attributeRecords=>{
												if(attributeRecords.attribute_id == branchRecords.attribute_id){
													branchRecords.attribute_title = attributeRecords.title;
												}
											});
										});
										orderCallback(null, restaurantBranchContactNumberResult);
									}).catch(next);
								}).catch(next);
							}
						},(childOrderErr, childOrderResponse)=>{
							if(childOrderErr) return callback(childOrderErr,{});

							let tmpUserDetails	=	childOrderResponse?.user_detail || {};
							let customerName	=	tmpUserDetails?.[orderResult.customer_id]?.name || '';
							let customerMobile	=	tmpUserDetails?.[orderResult.customer_id]?.mobile || '';
							let captainName		=	tmpUserDetails?.[orderResult.captain_id]?.name || '';
							let modifyOrderDetails = childOrderResponse?.modify_order_details?.[0] || {};

							if(orderResult.customer_id) orderResult.customer_name	=	customerName;
							if(orderResult.customer_id) orderResult.customer_mobile	=	customerMobile;
							if(orderResult.captain_id) orderResult.captain_name		=	(captainName) ? captainName : orderResult.captain_name;

							orderResult.customer_detail 	= childOrderResponse?.customer_detail || {};
							orderResult.restaurant_detail 	= childOrderResponse?.restaurant_detail || {};
							orderResult.modify_order_price  = (modifyOrderDetails && modifyOrderDetails.modify_order_price) ? modifyOrderDetails.modify_order_price : "";
							orderResult.restaurant_branch_detail = childOrderResponse?.restaurant_branch_detail || {};
							orderResult.restaurant_branch_contact_number_detail = childOrderResponse?.restaurant_branch_contact_number_details || [];

							/** Insert time passed in records **/
							let currentDate = Helper.newDate();
							let timePassed  = Helper.getDifferenceBetweenTwoDatesInMinute(orderResult.order_date,currentDate);
							orderResult.time_passed = (timePassed >0) ? parseInt(timePassed) :0;
							callback(null,orderResult);
						});
					}).catch(next);
				},
				order_detail :(callback)=>{
					/** Get detail of Orders **/
					this.orderDetailsCollection.findOne({ order_id : new ObjectId(orderId) }).then(detailResult=>{
						if(!detailResult) return callback(null,null);

						asyncParallel({
							payment_type :(childCallback)=>{
								if(!detailResult.payment_method) return childCallback(null,{});

								const payment_methods = this.db.collection(Tables.PAYMENT_METHODS);
								payment_methods.findOne({slug : detailResult.payment_method },{projection: {_id:1,title:1 }}).then(slugResult=>{
									childCallback(null, slugResult);
								}).catch(next);
							},
							corporate_details :(childCallback)=>{
								if(!detailResult.corporate_id) return childCallback(null,{});

								/** Get corporate details **/
								const corporate_tie_ups = this.db.collection(Tables.CORPORATE_TIE_UPS);
								corporate_tie_ups.findOne({_id : detailResult.corporate_id},{projection: {_id:1,corporate_name:1 }}).then(corporateResult=>{
									childCallback(null, corporateResult);
								}).catch(next);
							},
							offer_details :(childCallback)=>{
								if(!detailResult.offer_id) return childCallback(null,{});

								/** Get offer details **/
								const offers = this.db.collection(Tables.OFFERS);
								offers.findOne({ _id : detailResult.offer_id},{projection: { _id:1,description:1}}).then(offerResult=>{
									childCallback(null, offerResult);
								}).catch(next);
							},
						},(childErr, childResponse)=>{
							if(childErr) return callback(childErr,{});

							detailResult.payment_title 	  	=	childResponse?.payment_type?.title || {};
							detailResult.corporate_name   	= 	childResponse?.corporate_details?.corporate_name || {};
							detailResult.offer_description 	= 	childResponse?.offer_details?.description || {};
							callback(null,detailResult);
						});
					}).catch(next);
				},
				order_modified_detail :(callback)=>{

					const order_modify_logs	=	this.db.collection(Tables.ORDER_MODIFY_LOGS);
					order_modify_logs.aggregate([
						{$match : {order_id : orderId}},
						{$lookup: {	/** Get order modify item details **/
							from 		:	Tables.ORDER_MODIFY_ITEM_LOGS,
							localField  :	"_id",
							foreignField:	"modify_log_id",
							as 		  	:	"modify_details"
						}},
						{$lookup: {	/** Get order modify by user details **/
							from 		:	Tables.USERS,
							localField  :	"modified_by_user_id",
							foreignField:	"_id",
							as 		  	:	"user_details"
						}},
						{$project : {
							_id:1, version: 1,user_name : {$arrayElemAt: ["$user_details.full_name",0]},modified:1,modify_details:1
						}},
					]).toArray().then(modifyResult=>{
						callback(null,modifyResult);
					}).catch(next);
				},
			},(err, response)=>{
				if(err) return next(err);

				/** Send error response */
				if(!response.result || !response.order_detail) return resolve({ status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") });

				/** Send success response */
				resolve({
					status			: Constants.STATUS_SUCCESS,
					result			: response.result,
					orderDetails	: response.order_detail,
					modify_details	: (response.order_modified_detail) ? response.order_modified_detail :[],
				});
			});
		}).catch(next);
	};// End getOrderDetails()

	/**
	 * Function to get list of items
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	async listItems (req, res, next){
		let orderId	=	(req.params.order_id) ? new ObjectId(req.params.order_id) : '';
		let limit	= 	(req.body.length)	? parseInt(req.body.length)	: Constants.ADMIN_LISTING_LIMIT;
		let skip	= 	(req.body.start) 	? parseInt(req.body.start)	: Constants.DEFAULT_SKIP;

		if(!orderId) {
			req.flash(Constants.STATUS_ERROR,res.__("admin.system.invalid_access"));
			return res.redirect(Constants.WEBSITE_ADMIN_URL+"orders");
		}

		/** Configure Datatable conditions*/
		let dataTableConfig = await Helper.configDatatable(req,res,null);

		let commonConditions	=	{
			order_id	:	orderId
		};
		dataTableConfig.conditions = Object.assign(dataTableConfig.conditions,commonConditions);

		// Get list or count of order items
		let dbRes = await this.orderItemCollection.aggregate([
			{ $match: dataTableConfig.conditions },
			{$facet : {
				list : [
					{$sort: dataTableConfig.sort_conditions },
					{$skip: skip },
					{$limit: limit },
					{$project: {
						_id : 1, item_name : 1,qty : 1, price : 1, discounted_price : 1,net_amount:1,sub_total:1,item_type:1,unit_lists:1,dough_id:1,unit_id:1,selector_id:1,extra_items:1,note: 1
					}}
				],
				count: [
					{$count: "count"},
				],
			}}
		]).toArray();

		let result = dbRes?.[0]?.list ||[];
		let unitIds	 =	[];
		let doughIds =	[];
		let selectorIds =	[];
		result.map(data=>{
			if(data.unit_id) unitIds.push(data.unit_id);
			if(data.dough_id) doughIds.push(data.dough_id);

			if(data.item_type == Constants.HALF_AND_HALF_ITEM || data.item_type == Constants.DEAL_ITEM ){
				if(data.unit_id) unitIds.push(data.unit_id);
				if(data.dough_id) doughIds.push(data.dough_id);
				if(data.unit_lists && data.unit_lists.length > 0){
					data.unit_lists.map(list=>{
						if(list.unit_id) unitIds.push(list.unit_id);
						if(list.dough_id) doughIds.push(list.dough_id);
						if(list.selector_id) selectorIds.push(list.selector_id);
					});
				}
			}
		});

		const item_dough_units 	 = this.db.collection(Tables.ITEM_DOUGH_UNITS);
		const item_selector_units= this.db.collection(Tables.ITEM_SELECTOR_UNITS);
		const item_units_masters = this.db.collection(Tables.ITEM_UNITS_MASTERS);

		/**  All queries in parallel using object keys */
		const asyncResponse = await Helper.runTaskParallel({
			unit_records: unitIds.length ?
				item_units_masters.find({_id : {$in : Helper.arrayToObject(unitIds)}},{projection : {_id: 1,name: 1}}).toArray().then(itemResult=> {
					let itemList = {};
					itemResult.map(items=>{
						itemList[items._id] = items.name;
					});
					return itemList;
				})
			:{},
			dough_records: doughIds.length ?
				item_dough_units.aggregate([
					{$match: 	{
						_id		: {$in : Helper.arrayToObject(doughIds)}
					}},
					{$lookup: 	{
						from			: Tables.ITEM_UNITS_MASTERS,
						localField		: "item_unit_id",
						foreignField	: "_id",
						as				: "unit_details",
					}},
					{$project	: 	{
						unit_name: {$arrayElemAt:["$unit_details.name", 0] },
					}},
				]).toArray().then(doughResult=> {
					let doughList = {};
					doughResult.map(doughs=>{
						doughList[doughs._id] = doughs.unit_name;
					});
					return doughList;
				})
			:{},
			selector_records: selectorIds.length ?
				item_selector_units.aggregate([
					{$match: {
						_id	: {$in : Helper.arrayToObject(selectorIds)}
					}},
					{$lookup: {
						from			: Tables.ITEM_UNITS_MASTERS,
						localField		: "item_unit_id",
						foreignField	: "_id",
						as				: "unit_details",
					}},
					{$project: {
						unit_name: {$arrayElemAt:["$unit_details.name", 0] },
					}},
				]).toArray().then(selectorResult=> {
					let selectorList = {};
					selectorResult.map(selectors=>{
						selectorList[selectors._id] = selectors.unit_name;
					});
					return selectorList;
				})
			:{},
		});

		let doughData =	asyncResponse?.dough_records || {};
		let unitData =	asyncResponse?.unit_records || {};
		let selectorData =	asyncResponse?.selector_records || {};
		result.map(record=>{
			let tmpUnitId 	= 	record.unit_id;
			let tmpDoughId	=	record.dough_id;

			if(tmpUnitId) record.unit_name = (unitData[tmpUnitId]) ? unitData[tmpUnitId] :{};
			if(tmpDoughId) record.dough_name= (doughData[tmpDoughId]) ? doughData[tmpDoughId] :{};

			if(record.item_type == Constants.HALF_AND_HALF_ITEM || record.item_type == Constants.DEAL_ITEM){
				if(record.unit_lists && record.unit_lists.length > 0){
					record.unit_lists.map(data=>{
						if(data.unit_id) 	tmpUnitId	=	data.unit_id;
						if(data.dough_id) 	tmpDoughId 	=	data.dough_id;

						let tmpSelectorId =	data.selector_id;

						data.unit_name = (unitData[tmpUnitId]) ? unitData[tmpUnitId] :{};
						data.dough_name = (doughData[tmpDoughId]) ? doughData[tmpDoughId] :{};
						data.selector_name = (selectorData[tmpSelectorId]) ? selectorData[tmpSelectorId] :{};
					});
				}
			}
		});

		/** Send response **/
		res.send({
			status: Constants.STATUS_SUCCESS,
			draw: dataTableConfig.result_draw,
			data:   result,
			recordsTotal:	dbRes?.[0]?.count?.[0]?.count || 0,
			recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0,
		});
	};//End listItems()

	/**
	 * Function to get list of order status logs
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	async listStatusLogs (req, res, next){
		let orderId			=	(req.params.order_id) ? new ObjectId(req.params.order_id) : '';
		let limit			= 	(req.body.length)	? parseInt(req.body.length)	: Constants.ADMIN_LISTING_LIMIT;
		let skip			= 	(req.body.start) 	? parseInt(req.body.start)	: Constants.DEFAULT_SKIP;
		const collection	= 	this.db.collection(Tables.ORDER_STATUS_LOGS);
		let driverLogs      =   (req.query.driver_logs) ? req.query.driver_logs : '';

		if(!orderId) {
			req.flash(Constants.STATUS_ERROR,res.__("admin.system.invalid_access"));
			return res.redirect(Constants.WEBSITE_ADMIN_URL+"orders");
		}

		/** Configure Datatable conditions*/
		let dataTableConfig = await Helper.configDatatable(req,res,null);

		let commonConditions = {
			order_id: orderId,
			status : {[driverLogs ? '$in' : '$nin'] : Constants.DRIVER_ORDER_VIEW_STATUS_ARRAY}
		};

		dataTableConfig.conditions = Object.assign(dataTableConfig.conditions,commonConditions);

		// Get list or count of order status logs
		let dbRes = await collection.aggregate([
			{ $match: dataTableConfig.conditions },
			{$facet : {
				list : [
					{$sort: dataTableConfig.sort_conditions },
					{$skip: skip },
					{$limit: limit },
					{$project: {
						_id : 1, status : 1,created : 1,is_modified:1, action_taken_by : 1,status_changed_from:1, assigned_by:1
					}}
				],
				count: [
					{$count: "count"},
				],
			}}
		]).toArray();

		let result = dbRes?.[0]?.list || [];
		let allUserIds = [];
		result.map(records=>{
			if(records.assigned_by) 	allUserIds.push(records.assigned_by);
			if(records.action_taken_by) allUserIds.push(records.action_taken_by);
		});

		if(allUserIds?.length){
			const users	= 	this.db.collection(Tables.USERS);
			let userResult = await users.find({_id: {$in: allUserIds}},{projection:{_id:1, full_name:1, user_role_id:1,is_customer:1,is_driver : 1}}).toArray();

			let userObj = {};
			userResult.map(records=>{
				userObj[records._id] = records;
			});

			result.map(records=>{
				let assignedBy 		= 	records.assigned_by;
				let actionTakenBy 	=	records.action_taken_by;
				let tmpStatus		=	records.status;

				let userName = userObj?.[actionTakenBy]?.full_name || "";
				if(assignedBy && userObj?.[assignedBy] && String(actionTakenBy) != String(assignedBy) && tmpStatus == Constants.ORDER_DRIVER_ASSIGNED){
					let tmpName 	= 	userObj?.[actionTakenBy]?.full_name || "";
					let isDriver 	=	userObj?.[actionTakenBy]?.is_driver || "";

					if(isDriver && userName){
						tmpName += " ("+res.__("admin.orders.assign_to")+"- "+userName +" )"
					}
					userName = tmpName;
				}

				records.user_name = userName;
			});
		}

		/** Send response **/
		res.send({
			status: Constants.STATUS_SUCCESS,
			draw: dataTableConfig.result_draw,
			data			:   result,
			recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
			recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
		});
	};//End listStatusLogs()

	/**
	 * Function for accept order
	 *
	 * @param req 	As 	Request Data
     * @param res 	As 	Response Data
     * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return render
	 */
	async acceptOrder (req, res, next){
		let redirectUrl		= 	(req.query.redirect) 			?	req.query.redirect 				:"";
		let orderId 		= 	(req.params._id) 				?	new ObjectId(req.params._id)	:"";
		let authId			= 	(req.session.user._id) 			? 	req.session.user._id 			:"";
		let userType		= 	(req.session.user.user_type) 	?	req.session.user.user_type 		:"";
		let authRoleId		= 	(req.session.user.user_role_id) ? 	req.session.user.user_role_id 	:"";
		let redirectPathUrl	=	(redirectUrl)					?	"order_tracking"				:"orders";

		/** Get order details  **/
		let orderDetails = await this.orderCollection.findOne({
			_id 			:	new ObjectId(orderId),
			is_confirm 		: 	false,
		},{projection: {_id:1,admin_status: 1,branch_id:1,customer_id:1,restaurant_id:1,kfg_order:1,is_schedule:1,success_push_to_kfg:1}});

		/** Send error response **/
		if(!orderDetails){
			req.flash(Constants.STATUS_ERROR,res.__("admin.system.invalid_access"));
			return res.redirect(Constants.WEBSITE_ADMIN_URL+redirectPathUrl);
		}

		let kfgOrder		=	(orderDetails.kfg_order) 		? 	orderDetails.kfg_order 				 :'';
		let branchId		=	(orderDetails.branch_id) 		? 	orderDetails.branch_id 				 :'';
		let customerId		=	(orderDetails.customer_id) 		?	new ObjectId(orderDetails.customer_id) 	 :'';
		let restauarntId	=	(orderDetails.restaurant_id) 	? 	new ObjectId(orderDetails.restaurant_id) :'';
		let tmpAdminStatus 	=	orderDetails.admin_status;
		let isSchedule 		=	orderDetails.is_schedule;
		let successPushToKfg=	orderDetails.success_push_to_kfg;

		/** accept order  **/
		await this.orderCollection.updateOne({
			_id : new ObjectId(orderId)
		},
		{$set : {
			is_confirm	: 	true,
			modified 	: 	Helper.getUtcDate()
		}});

		/** Save order logs */
		await Helper.saveOrderStatusLogs(req,res,next,{
			updated_by 		: 	authId,
			user_role_id 	: 	authRoleId,
			status 			:	Constants.ORDER_CONFIRMED,
			order_status	:	Constants.ORDER_NOT_CONFIRMED,
			restaurant_id	:	restauarntId,
			order_id 		:	new ObjectId(orderId),
			branch_id		:	branchId,
			user_id			:	customerId,
			user_type		:	userType,
		});

		asyncParallel({
			update_order_status : (callback)=>{
				if(tmpAdminStatus != Constants.ORDER_PENDING) return callback(null);

				/** Get order delivered time */
				const order_status_logs	= this.db.collection(Tables.ORDER_STATUS_LOGS);
				order_status_logs.countDocuments({
					order_id 	: 	new ObjectId(orderId),
					status 		: 	{$nin: [Constants.ORDER_SCHEDULED]},
				}).then(countResult=>{

					let tmpStatus = Constants.ORDER_SUBMITTED;
					if(isSchedule) tmpStatus = Constants.ORDER_SCHEDULED;
					if(countResult > 0) tmpStatus = Constants.ORDER_SUBMITTED;

					/** Save order logs */
					Helper.saveOrderStatusLogs(req,res,next,{
						updated_by 		: 	authId,
						user_role_id 	: 	authRoleId,
						status 			:	tmpStatus,
						order_status	:	Constants.ORDER_CONFIRMED,
						restaurant_id	:	restauarntId,
						order_id 		:	new ObjectId(orderId),
						branch_id		:	branchId,
						user_id			:	customerId,
						user_type		:	userType,
					}).then(()=>{
						callback(null);
					}).catch(next);
				}).catch(next);
			},
		}, (asyncErr) => {
			if(asyncErr) return next(asyncErr);

			/** Send success response **/
			req.flash(Constants.STATUS_SUCCESS,res.__("admin.orders.status_has_been_updated_successfully"));
			res.redirect(Constants.WEBSITE_ADMIN_URL+redirectPathUrl);

			/**Call kfg function*/
			if(kfgOrder) this.orderAPI.callAfterPlaceOrder(req,res,next,{order_id: orderId, is_modify : (successPushToKfg) ? true :false });

			/** save System logs */
			saveSystemLogs(req, res, {
				user_id				: authId,
				parent_id			: orderId,
				activity_module		: Constants.SYSTEM_LOG_MODULE_ORDERS,
				activity_type		: Constants.ACTIVITY_TYPE_APPROVE,
				additional_details	: {}
			});
		});
	};//End acceptOrder()

	/**
	 * Function for update order status
	 *
	 * @param req 	As 	Request Data
     * @param res 	As 	Response Data
     * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return render
	 */
	async changeStatus (req, res, next){
		let orderId = new ObjectId(req.params._id);
		if(Helper.isPost(req)){
			/** Sanitize Data **/
			req.body	  		= 	Helper.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let authId			= 	req.session.user._id;
			let userType		= 	req.session.user.user_type;
			let authRoleId		= 	req.session.user.user_role_id;
			let orderStatus		=	(req.body.order_status)		?	req.body.order_status 	:'';
			let cancelReasonId	=	(req.body.cancel_reason)	? 	new ObjectId(req.body.cancel_reason) :'';

			/** send error response */
			if(!orderId) return res.send({ status: Constants.STATUS_ERROR,message: res.__("system.invalid_access")});


			asyncParallel({
				cancel_reason_title :(orderCallback)=>{
					if(orderStatus != Constants.ORDER_CANCELLED || !cancelReasonId) return orderCallback(null,null);

					/** Get cancel reason title */
					const cancel_reasons = this.db.collection(Tables.CANCEL_REASONS);
					cancel_reasons.findOne({_id: cancelReasonId},{projection: {title:1}}).then(result=>{
						let reasonTitle = (result && result.title)?result.title[Constants.DEFAULT_LANGUAGE_CODE] :"";
						orderCallback(null, reasonTitle);
					}).catch(next);
				},
				order_details :(orderCallback)=>{
					/** Get order details */
					this.orderCollection.findOne({_id : new ObjectId(orderId) }).then(orderResult=>{
						orderCallback(null, orderResult);
					}).catch(next);
				},
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr)

				let cancelReasonTitle 	= 	asyncResponse.cancel_reason_title;
				let orderDetails 		= 	asyncResponse.order_details;

				/** send error response */
				if(!orderDetails) return res.send({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

				let lastOrderStatus = 	orderDetails.order_status;
				let branchId		=	orderDetails.branch_id;
				let customerId		=	orderDetails.customer_id;
				let restauarntId	=	orderDetails.restaurant_id;
				let statusLevel  	=	(Constants.UPDATE_ORDER_STATUS[orderStatus]) 		? 	Constants.UPDATE_ORDER_STATUS[orderStatus].level 		:"";
				let oldStatusLevel	=	(Constants.UPDATE_ORDER_STATUS[lastOrderStatus]) 	?	Constants.UPDATE_ORDER_STATUS[lastOrderStatus].level 	:"";

				/** send error response */
				if(oldStatusLevel >= statusLevel) return res.send({status: Constants.STATUS_ERROR, message :res.__("admin.system.something_going_wrong_please_try_again") });

				asyncParallel({
					mark_cancelled :(subCallback)=>{
						if(orderStatus != Constants.ORDER_CANCELLED && orderStatus != Constants.ORDER_REJECTED_BY_ADMIN) return subCallback(null,null);

						/** Send cancel request to KFG api. if kfg api is cancel this order then order cancel in our system other wise not */
						this.sendCancelledRequestToKFG(req,res,next,{
							order_id		: 	orderId,
							cancelled_by	: 	authId,
							cancel_reason	:	(req.body.rejection_reason) ? req.body.rejection_reason :cancelReasonTitle,
						}).then(cancelledResponse=>{
							subCallback(null, cancelledResponse);
						}).catch(next);
					},
				},(asyncSubErr, asyncSubResponse)=>{
					if(asyncSubErr)	 return next(asyncSubErr);

					/** Send error response */
					if(asyncSubResponse.mark_cancelled && asyncSubResponse.mark_cancelled.status != Constants.STATUS_SUCCESS){
						return res.send(asyncSubResponse.mark_cancelled);
					}

					/** Set update data  **/
					let dataToBeUpdated	=	{
						order_status	: 	orderStatus,
						modified 		: 	Helper.getUtcDate()
					};

					if(req.body.rejection_reason) dataToBeUpdated['rejection_reason'] = req.body.rejection_reason;
					if(cancelReasonId) dataToBeUpdated['cancel_reason_id'] =	new ObjectId(cancelReasonId);

					if(orderStatus == Constants.ORDER_CANCELLED){
						let updatedRole = (authRoleId == Constants.FLEET) ? Constants.FLEET :Constants.CRAVEZ;
						dataToBeUpdated.cancelled_user_role_id = updatedRole;

						if(cancelReasonTitle) dataToBeUpdated.rejection_reason = cancelReasonTitle;
					}

					/** update order status */
					this.orderCollection.updateOne({_id: orderId },{$set: dataToBeUpdated}).then(()=>{

						/** Save order logs */
						Helper.saveOrderStatusLogs(req,res,next,{
							updated_by 		: 	authId	,
							user_role_id 	: 	authRoleId,
							status 			:	orderStatus,
							order_status	:	lastOrderStatus,
							restaurant_id	:	restauarntId,
							order_id 		:	new ObjectId(orderId),
							branch_id		:	branchId,
							user_id			:	customerId,
							user_type		:	userType,
							is_admin        :   true
						}).then(()=>{

							/** Send success response */
							req.flash(Constants.STATUS_SUCCESS,res.__("admin.orders.status_has_been_updated_successfully"));
							res.send({
								status	: Constants.STATUS_SUCCESS,
								redirect_url : Constants.WEBSITE_ADMIN_URL+"orders",
							});

							/** save System logs */
							saveSystemLogs(req, res, {
								user_id				: req.session.user._id,
								parent_id			: orderId,
								activity_module		: Constants.SYSTEM_LOG_MODULE_ORDERS,
								activity_type		: Constants.ACTIVITY_TYPE_STATUS_UPDATE,
								additional_details	: {}
							});
						}).catch(next);
					}).catch(next);
				});
			});
		}else{
			/** Get order details  **/
			let orderResult = await this.orderCollection.findOne({
				_id: new ObjectId(orderId),
				is_completed: {$ne: true}
			},{projection: {_id:1,admin_status:1}});

			/** Send error response **/
			if(!orderResult) return res.status(400).send({status: Constants.STATUS_ERROR, message : res.__("system.invalid_access") });

			/**Get cancel reason dropdown list **/
			Helper.getDropdownList(req,res, next,{
				collections :[
					{
						collection : Tables.CANCEL_REASONS,
						columns    : ["_id",["title",Constants.DEFAULT_LANGUAGE_CODE]],
						conditions : { status : Constants.ACTIVE},
					},
				],
			}).then(dropDownResponse=> {
				if(dropDownResponse.status != Constants.STATUS_SUCCESS) return res.status(400).send({status: Constants.STATUS_ERROR, message : dropDownResponse.message });

				/** Render change status page */
				res.render('change_status',{
					layout			   : false,
					order_result	   : orderResult,
					cancel_reason_list : dropDownResponse.final_html_data["0"]
				});
			}).catch(next);
		}
	};//End changeStatus()

	/**
	 * Function for requeue order
	 *
	 * @param req 	As 	Request Data
     * @param res 	As 	Response Data
     * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return render
	 */
	async requeueOrder (req, res, next){
		let orderId 		= 	(req.params._id) ? req.params._id :"";
		let redirectUrl		= 	(req.query.redirect) ? req.query.redirect :"";
		let redirectPathUrl	=	(redirectUrl) ?	"order_tracking":"orders";

		/** Get order details  **/
		let findResult = await this.orderCollection.findOne({
			_id 			:	new ObjectId(orderId),
			is_confirm 		: 	false,
		},{projection: {_id:1,number_of_queue:1,queue_time:1}});

		if(!findResult) {
			req.flash(Constants.STATUS_ERROR,res.__("admin.system.invalid_access"));
			return res.redirect(Constants.WEBSITE_ADMIN_URL+redirectPathUrl);
		}

		/** Update order queue time **/
		let noOfQueue=	(findResult.number_of_queue) ? findResult.number_of_queue : 0;
		await this.orderCollection.updateOne({
			_id : new ObjectId(orderId)
		},
		{
			$set : {
				queue_time: Helper.addDaysToDate(Constants.QUEUE_TIME_ORDER[noOfQueue]/Constants.MINUTES_IN_A_HOUR),
			},
			$inc :{
				number_of_queue : 1
			}
		});

		/** Send success response **/
		req.flash(Constants.STATUS_SUCCESS,res.__("admin.orders.order_has_been_requeued_successfully"));
		res.redirect(Constants.WEBSITE_ADMIN_URL+redirectPathUrl);
	};//End requeueOrder()

	/**
	 * Function to reject order request
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	*/
	async rejectOrderRequest (req, res, next){
		if(Helper.isPost(req)){
			/** Sanitize Data **/
			req.body	  		= Helper.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let orderId 		= req?.body?.order_id || "";
			let authId 	  		= req?.session?.user?._id || "";
			let authRoleId		= req?.session?.user?.user_role_id || "";
			let userType		= req?.session?.user?.user_type || "";
			let rejectionReason = req?.body?.rejection_reason || "";

			/** send error response */
			if(!orderId) return res.send({ status: Constants.STATUS_ERROR,message: res.__("system.invalid_access")});

			/* set rejected status in orders */
			let orderDetails = await this.orderCollection.findOneAndUpdate({
				_id : new ObjectId(orderId)
			},
			{$set : {
				is_confirm 			: true,
				order_status		: Constants.ORDER_REJECTED_BY_ADMIN,
				rejection_reason   	: rejectionReason,
			}},{projection :{_id:1,order_status:1,customer_id:1}});

			let orderStatus		=	(orderDetails.order_status) ? orderDetails.order_status : '';
			let customerId		=	(orderDetails.customer_id) ? new ObjectId(orderDetails.customer_id) : '';

			saveSystemLogs(req, res, {
				user_id				: req.session.user._id,
				parent_id			: orderId,
				activity_module		: Constants.SYSTEM_LOG_MODULE_ORDERS,
				activity_type		: Constants.ACTIVITY_TYPE_REJECT,
				additional_details	: {
					status :	Constants.ORDER_REJECTED_BY_ADMIN,
				}
			});

			/** Save order logs */
			Helper.saveOrderStatusLogs(req,res,next,{
				updated_by 		: 	authId,
				user_id			:	customerId,
				user_role_id 	: 	authRoleId,
				status 			:	Constants.ORDER_REJECTED_BY_ADMIN,
				order_status	:	orderStatus,
				order_id 		:	orderId,
				user_type		:	userType,
			}).then(()=>{

				/** Send success response */
				req.flash(Constants.STATUS_SUCCESS,res.__("admin.orders.status_has_been_updated_successfully"));
				res.send({
					status	: Constants.STATUS_SUCCESS,
					redirect_url : Constants.WEBSITE_ADMIN_URL+"orders",
				});
			}).catch(next);
		}
	};//End rejectOrderRequest()

	/**
	 * Function for get branch list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async branchList (req, res, next){
		let restaurantIds = req?.body?.restaurant_id || "";

		/** Send error response */
		if(!restaurantIds) return res.send({status: Constants.STATUS_ERROR, message :res.__("admin.system.something_going_wrong_please_try_again") });

		if(restaurantIds.constructor !== Array)	restaurantIds = [restaurantIds];
		restaurantIds = Helper.arrayToObject(restaurantIds);

      	/**Get branch list **/
		Helper.getDropdownList(req,res, next,{
            collections :[{
				collection : Tables.RESTAURANT_BRANCHES,
				columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
				conditions : {
					restaurant_id : {$in : restaurantIds}
				},
			}]
        }).then(dropDownResponse=> {
			if(dropDownResponse.status != Constants.STATUS_SUCCESS) return res.send({status: Constants.STATUS_ERROR, message :res.__("admin.system.something_going_wrong_please_try_again") });

			res.send({
				status       : Constants.STATUS_SUCCESS,
				branch_list  : dropDownResponse.final_html_data["0"]
			});
		}).catch(next);
	};//End branchList()

	/**
	 * Function to get location
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getLocation (req, res, next){
		let captainId	=	(req.body.user_id) 	? 	new ObjectId(req.body.user_id) 	:'';
		let orderId		=	(req.body.order_id) ?	new ObjectId(req.body.order_id) :'';

		if(!orderId) return res.send({status: Constants.STATUS_SUCCESS, result: {captain_detail: {}, order_detail: {}, order_status:""} });

		asyncParallel({
			captain_detail :(locationCallback)=>{
				if(!captainId) return locationCallback(null,null);

				/** Set condition for captains **/
				let conditions	=	{
					_id			 : new ObjectId(captainId),
					is_available : Constants.AVAILABLE
				}

				/** Get captain details **/
				const users  = this.db.collection(Tables.USERS);
				users.findOne(conditions,{projection: {_id:1,longitude:1,latitude:1,full_name:1,mobile_number:1}}).then(captainResult=>{
					locationCallback(null,captainResult);
				}).catch(next);
			},
			order_detail :(locationCallback)=>{
				/** Get order details **/
				this.orderDetailsCollection.findOne({order_id : new ObjectId(orderId)},{projection: {_id:1,restaurant_address:1,customer_address:1,customer_latitude:1,customer_longitude:1,restaurant_latitude:1,restaurant_longitude:1}}).then(orderDetailResult=>{
					locationCallback(null,orderDetailResult);
				}).catch(next);
			},
			order_data :(locationCallback)=>{
				/** Get order details **/
				this.orderCollection.findOne({_id : new ObjectId(orderId)},{projection: {order_status:1}}).then(orderDetailResult=>{
					locationCallback(null,orderDetailResult);
				}).catch(next);
			},
		},(asyncErr, asyncResponse)=>{
			if(asyncErr) return next(asyncErr);

			let captainDetail	=	(asyncResponse.captain_detail) ? asyncResponse.captain_detail : {};
			let orderDetail		=	(asyncResponse.order_detail) ? asyncResponse.order_detail : {};
			let orderStatus		=	(asyncResponse.order_data && asyncResponse.order_data.order_status) ? asyncResponse.order_data.order_status : '';
			let result			=	{
				captain_detail	:	captainDetail,
				order_detail	:	orderDetail,
				order_status	:	orderStatus
			};

			/** Send response **/
			res.send({status: Constants.STATUS_SUCCESS, result: result });
		});
	};//End getLocation()

	/**
	 * Function to reschedule order
	 *
	 * @param req 	As 	Request Data
     * @param res 	As 	Response Data
     * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return render
	 */
	async rescheduleOrder (req, res, next){
		let redirectUrl		= 	(req.query.redirect) ? req.query.redirect :"";
		let orderId 		= 	(req.params._id) ? req.params._id :"";
		let userType		= 	(req.session.user && req.session.user.user_type) ? req.session.user.user_type :"";
		let authId			= 	(req.session.user && req.session.user._id) ? req.session.user._id :"";
		let authRoleId		= 	(req.session.user && req.session.user.user_role_id) ? req.session.user.user_role_id :"";

		/* set rejected status in orders */
		let orderDetails = await this.orderCollection.findOneAndUpdate({
			_id : new ObjectId(orderId)
		},
		{$set : {
			order_status 	: 	Constants.ORDER_PENDING,
			modified 		: 	Helper.getUtcDate()
		}},
		{projection :{_id:1,order_status: 1,branch_id:1,customer_id:1,restaurant_id:1}});

		let currentStatus	=	(orderDetails.order_status) ? orderDetails.order_status : '';
		let branchId		=	(orderDetails.branch_id) ? orderDetails.branch_id : '';
		let customerId		=	(orderDetails.customer_id) ? new ObjectId(orderDetails.customer_id) : '';
		let restauarntId	=	(orderDetails.restaurant_id) ? new ObjectId(orderDetails.restaurant_id) : '';

		/** save System logs */
		saveSystemLogs(req, res, {
			user_id				: req.session.user._id,
			parent_id			: orderId,
			activity_module		: Constants.SYSTEM_LOG_MODULE_ORDERS,
			activity_type		: Constants.ACTIVITY_TYPE_RESCHEDULE,
			additional_details	: {}
		});

		/** Save order logs */
		Helper.saveOrderStatusLogs(req,res,next,{
			updated_by 		: 	authId	,
			user_role_id 	: 	authRoleId,
			status 			:	Constants.ORDER_PENDING,
			order_status	:	currentStatus,
			restaurant_id	:	restauarntId,
			order_id 		:	new ObjectId(orderId),
			branch_id		:	branchId,
			user_id			:	customerId,
			user_type		:	userType,
		}).then(()=>{
			/** Send success response **/
			req.flash(Constants.STATUS_SUCCESS,res.__("admin.orders.order_has_been_rescheduled_successfully"));
			res.redirect(Constants.WEBSITE_ADMIN_URL+redirectUrl ?"order_tracking":"orders");
		}).catch(next);
	};//End rescheduleOrder()

	/**
	 * Function to refund order amount
	 *
	 * @param req 	As 	Request Data
     * @param res 	As 	Response Data
     * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return render
	 */
	async orderRefundAmount (req, res, next){
		let orderId 	=	(req.params.id) ? new ObjectId(req.params.id) :"";
		let authRoleId	= 	(req.session.user.user_role_id)	? req.session.user.user_role_id :"";
		let teamHead	= 	req.session.user.team_head		? req.session.user.team_head 	:false;

		/** send error response */
		if(!orderId) return res.send({ status: Constants.STATUS_ERROR,message: res.__("system.invalid_access")});

		/** Get order details  **/
		let orderResult = await this.orderCollection.findOne({
			_id : 	orderId,
			$or	:	[
				{refund_amount_status : {$exists: false}},
				{refund_amount_status : false},
			]
		},{projection: {_id:1,order_price:1,paid_amount:1,customer_id:1,device_id:1,is_guest:1,unique_order_id:1,admin_status:1}});

		if(!orderResult) {
			if(Helper.isPost(req)) return res.send({status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access")});
			req.flash(Constants.STATUS_ERROR,res.__("admin.system.invalid_access"));
			return res.redirect(Constants.WEBSITE_ADMIN_URL+redirectPathUrl);
		}

		if(Helper.isPost(req)){
			req.body	  			= 	Helper.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let totalRefundAmount	= 	(req.body.refund_amount) 	? 	req.body.refund_amount 	:'';
			let orderAmount			= 	(req.body.order_amount) 	?	req.body.order_amount 	:'';
			let refundType			=	(req.body.refund_type) 		?	req.body.refund_type 	:'';

			let refundPercentage	=	'';
			if([Constants.CRAVEZ].indexOf(authRoleId) !== -1){
				refundPercentage = res.locals.settings["Refund_Permission.admin_refund_limit"];
				if(refundType == Constants.COMPENSATION) refundPercentage = res.locals.settings["Compensation_Permission.admin_compensate_limit"];
			}else if(teamHead == true){
				refundPercentage = res.locals.settings['Refund_Permission.tl_refund_limit'];
				if(refundType == Constants.COMPENSATION) refundPercentage = res.locals.settings["Compensation_Permission.tl_compensate_limit"];
			}else{
				refundPercentage = res.locals.settings['Refund_Permission.agent_refund_limit'];
				if(refundType == Constants.COMPENSATION) refundPercentage = res.locals.settings["Compensation_Permission.agent_compensate_limit"];
			}

			let amountToRefund	=	(refundPercentage/100)* parseFloat(orderAmount);
			if(totalRefundAmount > amountToRefund){
				return res.send({status: Constants.STATUS_ERROR, message: [
					{ 'param': 'refund_amount', 'msg': res.__("admin.orders.please_enter_valid_refund_amount")}
				]});
			}

			let orderUserId 		= (orderResult.customer_id) 	? orderResult.customer_id 	: "";
			let orderDeviceId 		= (orderResult.device_id) 		? orderResult.device_id : "";
			let orderByGuest 		= (orderResult.is_guest) 		? orderResult.is_guest 	: false;
			let uniqueOrderId		= (orderResult.unique_order_id) ? orderResult.unique_order_id :'';
			let totalPaidAmount 	= (orderResult.paid_amount) 	? orderResult.paid_amount : orderResult.order_price;
			let walletType 			= (refundType == Constants.COMPENSATION) 	? Constants.COMPENSATION_AMOUNT :Constants.REFUND_AMOUNT;

			Helper.callRefundAmount(req,res,next,{
				order_id				: 	orderId,
				user_id 				: 	orderUserId,
				device_id 				: 	orderDeviceId,
				is_guest				:	orderByGuest,
				total_refund			:	parseFloat(totalRefundAmount),
				total_amount			:	parseFloat(totalPaidAmount),
				unique_order_id			:	uniqueOrderId,
				refund_activity_type	:	Constants.DIRECT_REFUND,
				wallet_type				:	walletType,
			}).then(()=>{

				/** Update order details */
				this.orderCollection.updateOne({
					_id: orderId
				},
				{$set: {
					refund_amount_status	:	true,
					refund_amount			:	parseFloat(totalRefundAmount),
					refund_type             :   refundType,
					refund_reason			:   (req.body.refund_reason) ? req.body.refund_reason : "",
					order_caused_by_whom    :   req.body.caused_by
				}}).then(()=>{

					if(req.body.caused_by == Constants.CAUSED_BY_RESTAURANT){
						Helper.calculateOrderPayout(req,res,next,{order_id: orderId }).then(()=>{ });
					}

					/** Generate ticket */
					Helper.generateTicket(req,res,next,{
						order_id: orderId,
						type	: Constants.AUTOMATED_TICKET_FOR_ORDER_REFUND,
						message_params	: [uniqueOrderId]
					});

					req.flash(Constants.STATUS_SUCCESS,res.__('orders.amount_refund_request_submitted'));
					res.send({status: Constants.STATUS_SUCCESS});
				}).catch(next);
			}).catch(next);
		}else{
			res.render('refund_amount',{
				layout		 : false,
				order_id	 : orderId,
				order_amount : orderResult.paid_amount || orderResult.order_price,
				order_status : orderResult.admin_status
			});
		}
	};//End orderRefundAmount()

	/**
	 * Function to get order count on refresh
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getOrderRules (req, res, next){
		this.getOrderCounts(req,res,next).then(response=> {
			res.send({ result : response || {} });
		}).catch(next);
	};// End getOrderData

	/**
	 * Function to get list of refund and compensation
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	async refundCompensationList (req, res, next){
		let orderId	=	(req.params.order_id) ? new ObjectId(req.params.order_id) : '';
		let limit	= 	(req.body.length)	  ? parseInt(req.body.length)	  : Constants.ADMIN_LISTING_LIMIT;
		let skip	= 	(req.body.start) 	  ? parseInt(req.body.start)	  : Constants.DEFAULT_SKIP;

		if(!orderId) {
			req.flash(Constants.STATUS_ERROR,res.__("admin.system.invalid_access"));
			return res.redirect(Constants.WEBSITE_ADMIN_URL+"orders");
		}

		/** Configure Datatable conditions*/
		let dataTableConfig = await Helper.configDatatable(req,res,null);

		let commonConditions =	{
			_id	: orderId,
			refund_amount : {$exists : true}
		};

		dataTableConfig.conditions = Object.assign(dataTableConfig.conditions,commonConditions);

		// Get list or count of refund and compensation
		let dbRes = await this.orderCollection.aggregate([
			{ $match: dataTableConfig.conditions },
			{$facet : {
				list : [
					{$sort: dataTableConfig.sort_conditions },
					{$skip: skip },
					{$limit: limit },
					{$project: {
						_id:1,refund_amount:1,refund_amount_status:1,refund_type:1,paid_amount:1,order_price:1,refund_reason:1,order_caused_by_whom:1
					}}
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
	};//End refundCompensationList()

	/**
	 *  Function for export order records
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async exportData (req, res, next){
		let exportType	= (req.params.export_type) 	? 	req.params.export_type	:"";
		let exportCount = (req.params.export_count) ? 	req.params.export_count	:0;

		/** conditions **/
		let filterCondition = (this.exportFilterConditions[exportCount]) ? this.exportFilterConditions[exportCount] : {};
		let sortConditions	= (this.exportSortConditions[exportCount]) 	? this.exportSortConditions[exportCount] 	: this.exportSortConditions[0];
		let conditions		= (exportType == Constants.EXPORT_FILTERED) ? filterCondition	: this.exportCommonConditions;

		/** Get order details **/
		this.orderCollection.aggregate([
			{$match : conditions},
			{$lookup: {	/** Get order details **/
				from 		:	Tables.ORDER_DETAILS,
				localField  :	"_id",
				foreignField:	"order_id",
				as 		  	:	"order_details"
			}},
			{$project : {
				_id:1,customer_id:1,is_confirm:1,number_of_queue:1,queue_time:1,invoice_number:1,unique_order_id:1,order_date:1,last_status_updated_on:1,restaurant_name:1,order_price:1,infinity_service:1,admin_status:1,modified:1,net_amount:1, is_first_order: 1, is_duplicate_order:1,is_completed:1,is_modified:1,order_status:1,package_id:1,first_name: 1,last_name: 1,
				restaurant_address: {$arrayElemAt: ["$order_details.restaurant_address",0]},
				customer_latitude: {$arrayElemAt: ["$order_details.customer_latitude",0]}, customer_longitude: {$arrayElemAt: ["$order_details.customer_longitude",0]},
				customer_address_id: {$arrayElemAt: ["$order_details.customer_address_id",0]},
				mobile_number: 1,discount_price: {$arrayElemAt: ["$order_details.discount_price",0]},delivery_duration: {$arrayElemAt: ["$order_details.delivery_duration",0]},remaining_delivery_duration: {$arrayElemAt: ["$order_details.remaining_delivery_duration",0]},
				branch_id:1,restaurant_id:1,queue_sort: { $cond: [{$eq : ["$queue_time",""]},1,0]},refund_amount_status:1,is_big_order:1,is_delayed_acceptance:1,is_delayed_preperation:1,is_delayed_pickup_by_captain:1,is_delayed_picked_up_by_customer:1,is_delayed_pickup:1,delivery_type:1,is_vip:1,is_delayed_delivery:1,notes:1,payment_method:1,rejection_reason:1,cancelled_user_role_id:1,request_note:1,partners:1,is_delayed:1,delivery_status:1,cancel_reason_id:1, captain_name: 1,captain_id:1,is_confirm:1,is_modified:1,customer_address_detail: {$arrayElemAt: ["$order_details.customer_address_detail",0]}
			}},
			{$sort  : sortConditions},
		],{ allowDiskUse: true }).toArray().then(findResult=>{

			/** Define excel heading label **/
			let temp			= [];
			let commonColls		= [
				res.__("admin.orders.client_mobile_number"),
				res.__("admin.orders.invoice_number"),
				res.__("admin.orders.order_id"),
				res.__("admin.orders.restaurant_name"),
				res.__("admin.orders.order_date"),
				res.__("admin.orders.order_status"),
				res.__("admin.orders.client_first_name"),
				res.__("admin.orders.client_last_name"),
				res.__("admin.orders.last_status_updated_on"),
				res.__("admin.orders.total_order_amount"),
				res.__("admin.orders.net_order_amount"),
				res.__("admin.orders.discount_value"),
				res.__("admin.orders.delivery_duration"),
				res.__("admin.orders.notes"),
				res.__("admin.orders.time_passed"),
				res.__("admin.orders.delivery_by"),
				res.__("admin.orders.partner_name"),
				res.__("admin.orders.rejection_reason"),
				res.__("admin.orders.cancelled_by"),
				res.__("admin.orders.delivery_address"),
				res.__("admin.orders.payment_method"),
				res.__("admin.orders.delivery_latitude"),
				res.__("admin.orders.delivery_longitude")
			];

			if(findResult && findResult.length > 0){
				findResult.map(records=>{

					let deliveryDuration 		  = (records.delivery_duration)		      ? records.delivery_duration 		    :0;
					let remainingDeliveryDuration = (records.remaining_delivery_duration) ? records.remaining_delivery_duration :0;
					let timePassed 				  = deliveryDuration-remainingDeliveryDuration;
					let customerAddress = (records.customer_address_detail) ? records.customer_address_detail :{};
					let fullName 		= customerAddress.first_name && customerAddress.last_name ? customerAddress.first_name+" "+customerAddress.last_name : "";
					let mobileNumber 	= (customerAddress.mobile_number )  ? customerAddress.mobile_number 					: "";
					let addressType 	= (customerAddress.address_type ) 	? customerAddress.address_type 						: "";
					let blockName 		= (customerAddress.block_name ) 	? customerAddress.block_name[Constants.DEFAULT_LANGUAGE_CODE] : "";
					let street 			= (customerAddress.street ) 		? customerAddress.street 							: "";
					let areaName 		= (customerAddress.area_name ) 		? customerAddress.area_name[Constants.DEFAULT_LANGUAGE_CODE]  : "";
					let cityName 		= (customerAddress.city_name ) 		? customerAddress.city_name[Constants.DEFAULT_LANGUAGE_CODE]  : "";
					let orderStatus 	= (records.admin_status && Constants.ORDER_STATUS_TYPES[records.admin_status]) ? Constants.ORDER_STATUS_TYPES[records.admin_status].status_name : "";
					let confirmStatus 	= (records.is_confirm == false) ? res.__('admin.orders.not_confirmed') : "";
					let modifiedStatus 	= (records.is_modified && records.admin_status == Constants.ORDER_PENDING) ? res.__('admin.orders.modified_order') : "";

					let buffer =	[
						(records.mobile_number)		? records.mobile_number 			:"",
						(records.invoice_number)	? records.invoice_number 			:"",
						(records.unique_order_id)	? records.unique_order_id			:"",
						(records.restaurant_name)	? records.restaurant_name[Constants.DEFAULT_LANGUAGE_CODE] 	 :"",
						(records.order_date)		? Helper.newDate(records.order_date,Constants.AM_PM_FORMAT_WITH_DATE) :"",
						(orderStatus && confirmStatus && modifiedStatus) ? orderStatus+", "+confirmStatus+", "+modifiedStatus : orderStatus,
						(records.first_name) ? records.first_name : "",
						(records.last_name)  ? records.last_name  : "",
						(records.last_status_updated_on) ? 	Helper.newDate(records.last_status_updated_on,Constants.AM_PM_FORMAT_WITH_DATE) :"",
						(records.order_price)    ? Helper.currencyFormat(records.order_price)    : Helper.currencyFormat(0),
						(records.net_amount)  	 ? Helper.currencyFormat(records.net_amount)     : Helper.currencyFormat(0),
						(records.discount_price) ? Helper.currencyFormat(records.discount_price) : Helper.currencyFormat(0),
						deliveryDuration+" "+res.__('admin.orders.min'),
						(records.request_note) ? records.request_note : "",
						(!isNaN(timePassed))   ? timePassed+" "+res.__('admin.orders.min') : 0+" "+res.__('admin.orders.min'),
						(records.delivery_type)    ? Constants.DELIVERY_BY[records.delivery_type] : "",
						(records.partners)         ? Constants.PARTNERS[records.partners]         : "",
						(records.rejection_reason) ? records.rejection_reason           : "",
						(records.cancelled_user_role_id ) ? Constants.ORDER_CANCEL_ROLE[records.cancelled_user_role_id] : "",
						(fullName) ? fullName+", "+mobileNumber+", "+addressType+", "+blockName+", "+street+", "+areaName+", "+cityName : "",
						(records.payment_method ) 		? 	Constants.PAYMENT_METHODS[records.payment_method] : '',
						(records.customer_latitude )	? 	records.customer_latitude 	:"",
						(records.customer_longitude )	? 	records.customer_longitude 	:""
					];
					temp.push(buffer);
				});
			}

			/**  Function to export data in excel format **/
			Helper.exportToExcel(req,res,{
				file_prefix 		: "OrderReport",
				heading_columns		: commonColls,
				export_data			: temp
			});
		}).catch(next);
	};// end exportData()

	/**
	 * Function for get area list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async getAreaList (req, res, next){
		let cityId	= (req.body.city_id) ? req.body.city_id :"";

		/** Send error response */
		if(!cityId) return res.send({ status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });

		/** Get area list */
		let response = await Helper.getAreaList(req,res,next,req.body);

		/** Send response  */
		res.send({
			status : response?.status || Constants.STATUS_SUCCESS,
			result : response,
		});
	};//End getAreaList()

	/**
	 * Function for get block list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async getBlockList (req, res, next){
		let areaId	= (req.body.area_id) ? req.body.area_id :"";

		/** Send error response */
		if(!areaId) return res.send({ status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });

		/** Get area list */
		let response = await Helper.getBlockList(req,res,next,req.body);

		/** Send response  */
		res.send({
			status : response?.status || Constants.STATUS_SUCCESS,
			result : response,
		});
	};//End getBlockList()

	/**
	 * Function for change address
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async changeAddress (req, res, next){
		let orderId	= (req.params.order_id) ? new ObjectId(req.params.order_id) :"";

		if(Helper.isPost(req)){
			/** Sanitize Data **/
			req.body 			= 	Helper.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let latitude 		=	(req.body.latitude) ?	req.body.latitude			:0;
			let longitude 		=	(req.body.longitude)?	req.body.longitude			:0;
			let cityId	 		=	(req.body.city_id)	?	new ObjectId(req.body.city_id)	:'';
			let areaId	 		=	(req.body.area_id)	?	new ObjectId(req.body.area_id)	:'';
			let blockId	 		=	(req.body.block_id)	?	new ObjectId(req.body.block_id)	:'';
			let venue	 		=	(req.body.venue)	?	req.body.venue				:'';
			let updateAddress 	=	(req.body.update_in_customer_address)	?	true	:"";

			/** Validate address */
			req.body.only_validate 		= true;
			req.body.not_checked_mobile = true;
			this.customerAddressAPI.addEditAddress(req,res,next).then(addRes=>{
				if(addRes.status != Constants.STATUS_SUCCESS) return res.send(addRes);

				const cities 		= 	this.db.collection(Tables.CITIES);
				const areas 		= 	this.db.collection(Tables.AREAS);
				const area_blocks 	= 	this.db.collection(Tables.AREA_BLOCKS);
				asyncParallel({
					order_data : (callback)=>{
						 /** Get order details */
						this.orderCollection.findOne({_id : orderId}).then(orderResult=>{
							callback(null,orderResult);
						}).catch(next);
					},
					order_subdetails : (callback) => {
						/** Get order sub details */
						this.orderDetailsCollection.findOne({order_id: orderId}).then(result=>{
							callback(null,result);
						}).catch(next);
					},
				},(err, response)=>{
					if(err) return next(err);

					/** Send error response */
					if(!response.order_data || !response.order_subdetails){
						console.log(213213213213)
						return res.send({status: Constants.STATUS_ERROR, message :res.__("admin.system.something_going_wrong_please_try_again"), response: response });
					}

					let orderData			=	response.order_data;
					let orderSubdetails		= 	response.order_subdetails;
					let addressId 			=	orderSubdetails.customer_address_id;
					let oldAreaId			= 	orderSubdetails.delivery_area_id;
					let oldDeliveryFees		= 	orderData.delivery_fee;
					let userId				=	(orderData.customer_id) 	? 	orderData.customer_id 	:'';
					let firstName			=	(orderData.first_name) 		? 	orderData.first_name 	:'';
					let lastName			=	(orderData.last_name) 		? 	orderData.last_name 	:'';
					let mobileNumber		=	(orderData.mobile_number) 	? 	orderData.mobile_number :'';
					let branchId			=	(orderData.branch_id) 		? 	orderData.branch_id 	:'';
					let restId				=	(orderData.restaurant_id) 	? 	orderData.restaurant_id	:'';
					let captainId			=	orderData.captain_id	?	orderData.captain_id	:(orderData.assigned_captain ? orderData.assigned_captain :"");
					let uniqueOrderId		=	orderData.unique_order_id;
					let corporateDelFees	= 	orderData.corporate_delivery_fees;
					let compositeDelFees	= 	orderData.composite_delivery_fees;
					let offerDeliveryFees	= 	orderData.offer_delivery_fees;
					latitude				=	(latitude) 	? parseFloat(latitude) 	:0;
					longitude				=	(longitude) ? parseFloat(longitude) :0;

					/** Check branch delivered selected area or not */
					req.body.restaurant_id 	=	restId;
					req.body.branch_id 		=	branchId;
					req.body.block_id 		=	blockId;
					req.body.check_only_availability= true;
					this.cartAPI.checkDeliveryAddress(req, res, next).then(addressRes=>{
						let validAddress 	=	(addressRes.is_delivery) 		? 	addressRes.is_delivery 		:true;
						let braAreaDetails	=	(addressRes.area_details) 		? 	addressRes.area_details 	:{};
						let newDeliveryFees	=	(braAreaDetails.delivery_fees)	? 	braAreaDetails.delivery_fees:0;

						/** Send error response */
						if(!validAddress){
							return res.send({status: Constants.STATUS_ERROR, message: res.__("admin.orders.please_select_valid_address")});
						}

						/** Send error response */
						if(String(oldAreaId) != String(areaId) && !corporateDelFees && !compositeDelFees && !offerDeliveryFees){
							if(newDeliveryFees != oldDeliveryFees){
								return res.send({status: Constants.STATUS_ERROR, message :res.__("admin.orders.not_allow_for_different_delivery_fees") });
							}
						}

						asyncParallel({
							update_address : (childCallback)=>{
								if(!updateAddress) return childCallback(null);

								req.body.id				=	addressId;
								req.body.user_id		=	userId;
								req.body.only_validate 	= 	false;
								this.customerAddressAPI.addEditAddress(req, res, next).then(addressResponse=>{
									if(addressResponse.status != Constants.STATUS_SUCCESS) return childCallback(addressResponse);
									childCallback(null);
								}).catch(next);
							},
							city_details: (childCallback)=>{
								/** Get city names */
								cities.findOne({_id : cityId },{projection: {_id: 1,name: 1}},).then(cityResult=>{
									childCallback(null,cityResult);
								}).catch(next);
							},
							area_details: (childCallback)=>{
								/** Get area names */
								areas.findOne({_id : areaId},{projection: {_id: 1,name: 1}}).then(areaResult=>{
									childCallback(null,areaResult);
								}).catch(next);
							},
							block_details: (childCallback)=>{
								/** Get block names */
								area_blocks.findOne({_id : blockId},{projection: {_id: 1,name: 1}}).then(blockResult=>{
									childCallback(null,blockResult);
								}).catch(next);
							},
						},(childErr, childRes)=>{
							if(childErr) return next(childErr);

							if(!childRes.city_details || !childRes.area_details || !childRes.block_details){
								return res.send({status: Constants.STATUS_ERROR, message :res.__("admin.system.something_going_wrong_please_try_again"), childRes: childRes });
							}

							let cityDetail	=	childRes.city_details;
							let areaDetail	=	childRes.area_details;
							let blockDetail	=	childRes.block_details;

							/** Set update data */
							let updateData	=	{
								delivery_area_id		:	areaId,
								customer_address		:	venue,
								customer_latitude		:	latitude,
								customer_longitude		:	longitude,
								customer_long_lat		:	[longitude,latitude],
								customer_address_detail :	{
									first_name		:	firstName,
									last_name		:	lastName,
									landline_number	:	(req.body.landline_number) ? req.body.landline_number :'',
									mobile_number	:	mobileNumber,
									latitude		:	latitude,
									longitude		:	longitude,
									long_lat		:	[longitude,latitude],
									area_id			:	areaId,
									block_id		:	blockId,
									city_id			:	cityId,
									city_name		:	cityDetail.name,
									area_name		:	areaDetail.name,
									block_name		:	blockDetail.name,
									address_type	:	(req.body.address_type)	?	req.body.address_type	:'',
									street			:	(req.body.street)		?	req.body.street			:'',
									venue			:	(req.body.venue)		?	req.body.venue			:'',
									jadda        	:	(req.body.jadda)		?	req.body.jadda			:'',
									address_title 	: 	(req.body.address_title)?	req.body.address_title	:'',
									building_number : 	(req.body.building_number)?	req.body.building_number:'',
									floor_number	:	(req.body.floor_number)	?	req.body.floor_number	:'',
									flat_number		:	(req.body.flat_number)	?	req.body.flat_number	:'',
									country 		: 	Constants.COUNTRY_NAME,
									additional_directions:	(req.body.additional_directions)?	req.body.additional_directions	:'',
								},
							};

							if(newDeliveryFees){
								if(corporateDelFees) updateData.corporate_delivery_fees = newDeliveryFees;
								if(compositeDelFees) updateData.composite_delivery_fees = newDeliveryFees;
								if(offerDeliveryFees)updateData.offer_delivery_fees 	= newDeliveryFees;
							}

							/** Update address details in orders */
							this.orderDetailsCollection.updateOne({order_id: orderId},{$set: updateData}).then(()=>{

								/** Send success response */
								req.flash(Constants.STATUS_SUCCESS,res.__("admin.orders.customer_address_has_been_updated_successfully"));
								res.send({status: Constants.STATUS_SUCCESS, message: res.__("admin.orders.customer_address_has_been_updated_successfully") });

								/** Notification to driver for address changed */
								if(captainId){
									let deliveryStatus 	=	orderData.delivery_status;
									let tmpStatus 		= 	(!orderData.captain_id) ? Constants.ORDER_DRIVER_ASSIGNED :"";
									if(orderData.captain_id && deliveryStatus){
										if([Constants.ORDER_DRIVER_ACCEPTED, Constants.ORDER_DRIVER_ARRIVED_AT_RESTAURANT].indexOf(deliveryStatus) >=0) tmpStatus = Constants.ORDER_DRIVER_ACCEPTED;
										if([Constants.ORDER_DRIVER_WAY_TO_CUSTOMER, Constants.ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION].indexOf(deliveryStatus) >=0) tmpStatus = Constants.ORDER_DRIVER_WAY_TO_CUSTOMER;
									}

									sendMailToUsers(req,res,{
										event_type 		:	Constants.NOTIFICATION_TO_DRIVER_ORDER_ADDRESSED_CHANGED,
										order_id		: 	orderId,
										unique_order_id	: 	uniqueOrderId,
										driver_id		: 	captainId,
										extra_parameters: 	{status: tmpStatus},
									});
								}

								/** save System logs */
								saveSystemLogs(req, res, {
									user_id				: req.session.user._id,
									parent_id			: orderId,
									activity_module		: Constants.SYSTEM_LOG_MODULE_ORDERS,
									activity_type		: Constants.ACTIVITY_TYPE_UPDATE_ORDER_ADDRESS,
									additional_details	: {
										new_area_id: areaId,
										old_area_id: oldAreaId,
										new_delivery_fees		:	newDeliveryFees,
										old_delivery_fees		: 	oldDeliveryFees,
										corporate_delivery_fees	: 	corporateDelFees,
										composite_delivery_fees	: 	compositeDelFees,
										offer_delivery_fees		: 	offerDeliveryFees,
									}
								});
							}).catch(next);
						});
					}).catch(next);
				});
			}).catch(next);
		}else{
			asyncParallel({
				order_data : (callback)=>{
					this.orderCollection.findOne({_id : orderId},{projection:{customer_id:1}}).then(result=>{
						callback(null,result);
					}).catch(next);
				},
				order_details : (callback)=>{
					this.orderDetailsCollection.findOne({order_id : orderId},{projection:{customer_address_id:1,customer_address_detail:1}}).then(result=>{
						callback(null,result);
					}).catch(next);
				},
			},(parallelErr,parallelRes)=>{
				if(parallelErr) return next(parallelErr);

				/** Send error response **/
				if(!parallelRes.order_data || !parallelRes.order_details){
					return res.status(400).send({status  : Constants.STATUS_ERROR, message : res.__("system.invalid_access") });
				}

				let orderData	= 	parallelRes.order_data;
				let orderDetails= 	parallelRes.order_details;
				let customerId	= 	orderData.customer_id;
				let addrDetails	=	orderDetails.customer_address_detail;
				let addrId	 	=	orderDetails.customer_address_id;
				let cityId	 	=	addrDetails.city_id;
				let areaId	 	= 	addrDetails.area_id;
				let blockId	 	= 	addrDetails.block_id;

				asyncParallel({
					city_details : (childCallback)=>{
						if(!cityId) return childCallback(null,"");

						Helper.getCityList(req,res,next,{city_id: cityId }).then(cityResponse=>{
							childCallback(null,cityResponse);
						}).catch(next);
					},
					area_details : (childCallback)=>{
						if(!cityId) return childCallback(null,"");

						Helper.getAreaList(req,res,next,{city_id: cityId, area_id: areaId }).then(areaResponse=>{
							childCallback(null,areaResponse);
						}).catch(next);
					},
					block_details : (childCallback)=>{
						if(!areaId) return childCallback(null,"");

						Helper.getBlockList(req,res,next,{area_id: areaId, block_id: blockId }).then(blockResponse=>{
							childCallback(null,blockResponse);
						}).catch(next);
					},
				}, (parallelChildErr,parallelChildRes)=>{
					if(parallelChildErr) return next(parallelChildErr);

					/** render change address page **/
					res.render('change_address',{
						layout		:	false,
						city_list 	:	parallelChildRes.city_details,
						area_list 	:	parallelChildRes.area_details,
						block_list 	:	parallelChildRes.block_details,
						order_id	:	orderId,
						address_id	:	addrId,
						result		:   addrDetails,
						customer_id	:   customerId,
					});
				});
			});
		}
	};//End changeAddress

	/**
	 * Function for update order status
	 *
	 * @param req 	As 	Request Data
     * @param res 	As 	Response Data
     * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return render
	 */
	async confirmStatus (req, res, next){
		let orderId = req.params.order_id;
		if(Helper.isPost(req)){
			/** Sanitize Data **/
			req.body	= Helper.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let authId	= req.session.user._id;

			/** send error response */
			if(!orderId) return res.send({ status: Constants.STATUS_ERROR,message: res.__("system.invalid_access")});

			let confirmStatus = (req.body.confirm_status.constructor === Array) ? req.body.confirm_status : [req.body.confirm_status];
			let dataToBeUpdated = [];
			confirmStatus.map(key=>{
				let tmpRecord = {update_by : new ObjectId(authId), updated_on : Helper.getUtcDate()};
				tmpRecord[key]= true;
				dataToBeUpdated.push(tmpRecord);
			});

			this.orderCollection.updateOne({
				_id : new ObjectId(orderId)
			},
			{
				$set : {modified	: Helper.getUtcDate()},
				$addToSet :{confirm_status	: {$each : dataToBeUpdated}},
			}).then(()=>{

				/** Send success response */
				req.flash(Constants.STATUS_SUCCESS,res.__("admin.orders.status_has_been_confirmed_successfully"));
				res.send({
					status	: Constants.STATUS_SUCCESS,
					redirect_url : Constants.WEBSITE_ADMIN_URL+"orders_tracking/",
				});

				/** save System logs */
				saveSystemLogs(req, res, {
					user_id				: req.session.user._id,
					parent_id			: orderId,
					activity_module		: Constants.SYSTEM_LOG_MODULE_ORDERS,
					activity_type		: Constants.ACTIVITY_TYPE_STATUS_UPDATE,
					additional_details	: {}
				});
			}).catch(next);
		}else{
			/** Get detail of Order **/
			this.orderCollection.findOne({
				_id : new ObjectId(orderId)
			},{projection: {
				_id:1,is_delayed_acceptance:1,is_delayed_picked_up_by_customer:1,is_delayed_pickup:1,delivery_type : 1,is_delayed_pickup_by_captain:1,is_delayed_preperation:1,is_delayed_delivery:1,confirm_status:1
			}}).then(orderResult=>{

				/** send error response */
				if(!orderResult) return res.status(400).send({ status: Constants.STATUS_ERROR,message: res.__("system.invalid_access")});

				let confirmedStatusObj = {};
				if(orderResult.confirm_status && orderResult.confirm_status.length > 0){
					orderResult.confirm_status.map(record=>{
						Object.keys(record).map(recordKeys=>{
							if(recordKeys == "is_delayed_pickup" && orderResult.delivery_type == Constants.DELIVERY_BY_RESTAURANT){
								recordKeys = "delayed_pickup_by_restaurant";
							}
							if(Constants.ORDERS_RULES_STATUS[recordKeys]) confirmedStatusObj[recordKeys] = true;
						});
					});
				}

				let isValid = false;
				Object.keys(Constants.ORDERS_RULES_STATUS).map(delayStatus=>{
					let tmpStatusKey = delayStatus;
					if(tmpStatusKey == "delayed_pickup_by_restaurant" && orderResult.delivery_type == Constants.DELIVERY_BY_RESTAURANT){
						tmpStatusKey = "is_delayed_pickup";
					}
					if(orderResult[tmpStatusKey] && !confirmedStatusObj[delayStatus]) isValid = true;
				});

				if(!isValid) return res.status(400).send({ status: Constants.STATUS_ERROR,message: res.__("admin.orders.no_status_to_confirm") });

				res.render('confirm_status',{
					layout				: false,
					result				: orderResult,
					confirmed_statuses	: confirmedStatusObj
				});
			}).catch(next);
		}
	};//End confirmStatus()

	/**
	 * Function for revert order delivered to cancel or cancel to delivered
	 *
	 * @param req 	As 	Request Data
     * @param res 	As 	Response Data
     * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return render
	 */
	async orderRevert (req, res, next){
		let orderId = new ObjectId(req.params.order_id);
		let postData= Helper.isPost(req);

		/** Get detail of Order **/
		this.orderCollection.aggregate([
			{$match : {
				_id 		:	orderId,
				admin_status: 	{$in: [ Constants.ORDER_CANCELLED, Constants.ORDER_DELIVERED ]}
			}},
			{$lookup: {	/** Get users details **/
				from 		:	Tables.USERS,
				localField  :	"customer_id",
				foreignField:	"_id",
				as 		  	:	"user_details"
			}},
			{$addFields : {
				customer_wallet_amount: {$arrayElemAt: ["$user_details.total_amount",0]},
			}},
		]).toArray().then(orderResult=>{

			/** Send error response */
			if(!orderResult || orderResult.length <=0) {
				if(postData){
					return res.send({status:Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access")});
				}

				req.flash(Constants.STATUS_ERROR,res.__("admin.system.invalid_access"));
				return res.redirect(Constants.WEBSITE_ADMIN_URL+"orders");
			}

			orderResult				=	orderResult[0];
			let orderStatus 		= 	orderResult.admin_status;
			let isMarkedCancelled	=	(orderStatus == Constants.ORDER_DELIVERED) ? true :false;
			let isMarkedDelivered	=	(orderStatus == Constants.ORDER_CANCELLED) ? true :false;

			if(Helper.isPost(req) || isMarkedDelivered){
				let isGuest 		= 	orderResult.is_guest;
				let customerId 		= 	orderResult.customer_id;
				let orderPrice 		= 	orderResult.order_price;
				let branchId		= 	orderResult.branch_id;
				let uniqueOrderId	= 	orderResult.unique_order_id;
				let restaurantId	= 	orderResult.restaurant_id;
				let walletAmount	= 	(!isGuest && orderResult.customer_wallet_amount) ? orderResult.customer_wallet_amount :0;
				let paymentMethod 	= 	orderResult.payment_method;
				let authId			= 	new ObjectId(req.session.user._id);
				let authUserType	= 	req.session.user.user_type;
				let authRoleId		= 	req.session.user.user_role_id;
				let updatedRole 	=	(authRoleId == Constants.FLEET) ? Constants.FLEET :Constants.CRAVEZ;
				let updatedStatus 	= 	(orderStatus == Constants.ORDER_CANCELLED)? Constants.ORDER_DELIVERED :Constants.ORDER_CANCELLED;
				let cancelReasonId	=	(req.body.cancel_reason) ? new ObjectId(req.body.cancel_reason) :'';
				let debitedAmount	=	0;
				let remainingAmount	=	0;

				// if(isMarkedDelivered && paymentMethod != Constants.CASH_PAYMENT){
				if(isMarkedDelivered){
					remainingAmount = orderPrice;
					if(orderPrice >0 && walletAmount >0){
						debitedAmount  =	(walletAmount >= remainingAmount) ? remainingAmount :walletAmount;
						remainingAmount =	remainingAmount-debitedAmount;
					}
				}

				if(isMarkedCancelled){
					if(!cancelReasonId){
						return res.send({status: Constants.STATUS_ERROR, message: [
							{ 'cancel_reason': 'refund_amount', 'msg': res.__("admin.orders.please_select_cancel_reason")}
						]});
					}
				}

				asyncParallel({
					reason_title :(reasonCallback)=>{
						if(!cancelReasonId) return reasonCallback(null,null);

						/** Get cancel reason title */
						const cancel_reasons = this.db.collection(Tables.CANCEL_REASONS);
						cancel_reasons.findOne({_id: cancelReasonId},{projection:{title:1}}).then(result=>{
							let resTitle=(result && result.title)?result.title[Constants.DEFAULT_LANGUAGE_CODE]:"";
							reasonCallback(null, resTitle);
						}).catch(next);
					},
				},(asyncErr, asyncResponse)=>{
					if(asyncErr) return next(asyncErr)

					/** Set update data */
					let updateableData	=	{
						$set : {
							order_status		: 	updatedStatus,
							order_revert_by		: 	authId,
							order_revert_date	: 	Helper.getUtcDate(),
							modified 			: 	Helper.getUtcDate(),
						}
					};

					if(isMarkedCancelled){
						updateableData["$set"].rejection_reason 		= 	asyncResponse.reason_title;
						updateableData["$set"].cancel_reason_id 		= 	cancelReasonId;
						updateableData["$set"].cancelled_user_role_id	=	updatedRole;
						updateableData["$unset"] =	{ revert_outstanding_amount: 1, revert_outstanding_paid: 1 };
					}else{
						if(debitedAmount >0){
							updateableData["$set"].amount_debited_by_wallet = debitedAmount;
						}
						if(remainingAmount >0){
							updateableData["$set"].revert_outstanding_paid 	 = false;
							updateableData["$set"].revert_outstanding_amount = remainingAmount;
						}
						updateableData["$unset"] = {
							cancel_reason_id 		: 1,
							rejection_reason 		: 1,
							cancelled_user_role_id 	: 1,
						};
					}

					/** Update order details */
					this.orderCollection.updateOne({_id: orderId},updateableData).then(()=>{

						asyncParallel({
							update_wallet :(childCallback)=>{
								if(isGuest || !isMarkedDelivered || debitedAmount <=0){
									return childCallback(null);
								}

								/** Update wallet details */
								Helper.updateWalletBalance(req,res,next,{
									user_id      	: customerId,
									amount       	: debitedAmount,
									transaction_type: Constants.DEBIT,
									not_add_points	: true,
									is_used_points	: true,
									extra_parameters:{
										order_id 		: orderId,
										branch_id 		: branchId,
										restaurant_id 	: restaurantId,
										order_place 	: true,
									}
								}).then(response=>{
									if(response.status != Constants.STATUS_SUCCESS) return childCallback(response);
									childCallback(null);
								}).catch(next);
							},
							update_user_details :(childCallback)=>{
								if(isGuest || !isMarkedDelivered || remainingAmount <=0 || !customerId){
									return childCallback(null);
								}

								/** Update user details */
								const users = this.db.collection(Tables.USERS);
								users.updateOne({
									_id: customerId
								},
								{
									$set :{
										modified : 	Helper.getUtcDate(),
									},
									$addToSet: {
										revert_orders : {
											order_id 			: 	orderId,
											unique_order_id 	: 	uniqueOrderId,
											outstanding_amount 	:	remainingAmount,
											revert_time 		:	Helper.getUtcDate(),
										}
									}
								}).then(()=>{
									childCallback(null);
								}).catch(next);
							},
							save_order_logs :(childCallback)=>{
								/** Save order logs */
								Helper.saveOrderStatusLogs(req,res,next,{
									updated_by 		: 	authId,
									user_role_id 	: 	authRoleId,
									status 			:	updatedStatus,
									order_status	:	orderStatus,
									restaurant_id	:	restaurantId,
									order_id 		:	orderId,
									branch_id		:	branchId,
									user_id			:	customerId,
									user_type		:	authUserType,
								}).then(()=>{
									childCallback(null);
								}).catch(next);
							},
							generate_tickets :(childCallback)=>{
								/** Generate ticket  */
								Helper.generateTicket(req,res,next,{
									order_id 		: 	orderId,
									message_params 	: 	[uniqueOrderId],
									type 			:	(isMarkedCancelled) ? Constants.AUTOMATED_TICKET_FOR_ORDER_MARKED_TO_CANCELLED :Constants.AUTOMATED_TICKET_FOR_ORDER_MARKED_TO_DELIVERED,
								}).then(()=>{
									childCallback(null);
								}).catch(next);
							},
						},(asyncErr)=>{
							if(asyncErr) return next(asyncErr)

							/** Send success response */
							let msg = (isMarkedDelivered) ? res.__("admin.orders.order_has_been_marked_delivered") :res.__("admin.orders.order_has_been_marked_cancelled")
							req.flash(Constants.STATUS_SUCCESS,msg);
							if(postData) return res.send({status:Constants.STATUS_SUCCESS, message: msg });
							res.redirect(Constants.WEBSITE_ADMIN_URL+"orders");
						});
					}).catch(next);
				});
			}else{
				/**Get cancel reason dropdown list **/
				Helper.getDropdownList(req,res, next, {
					collections :[{
						collection : "cancel_reasons",
						columns    : ["_id",["title",Constants.DEFAULT_LANGUAGE_CODE]],
						conditions : { status : ACTIVE},
					}],
				}).then(dropDownResponse=> {
					/** Send error response */
					if(dropDownResponse.status != Constants.STATUS_SUCCESS){
						return res.status(400).send(dropDownResponse);
					}

					/** Render order revert page  */
					res.render('order_revert',{
						layout			   : false,
						order_result	   : orderResult,
						cancel_reason_list : dropDownResponse.final_html_data["0"]
					});
				}).catch(next);
			}
		}).catch(next);
	};//End orderRevert()

	/**
	 * Function for send cancel request to kfg api
	 *
	 * @param req 	As 	Request Data
     * @param res 	As 	Response Data
     * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return json
	 */
	async sendCancelledRequestToKFG (req, res, next, options){
		return new Promise(resolve=>{
			let orderId			=	(options.order_id)		?	new ObjectId(options.order_id)		:"";
			let cancelledBy		=	(options.cancelled_by)	?	new ObjectId(options.cancelled_by)	:"";
			let cancelReason	=	(options.cancel_reason)	?	options.cancel_reason				:"";
			let cancelReasonId	=	(options.reason_id)		?	new ObjectId(options.reason_id)		:"";

			/** Send error response */
			if(!orderId || !cancelBy || (!cancelReason && !cancelReasonId)) return resolve({status:Constants.STATUS_ERROR, message:res.__("system.missing_parameters")});

			asyncParallel({
				order_details :(callback)=>{
					/** Get order details  */
					this.orderCollection.findOne({_id: orderId },{projection: {_id:1, kfg_order: 1, success_push_to_kfg: 1, modified_success_push_to_kfg: 1}}).then(result=>{
						callback(null, result);
					}).catch(next);
				},
				cancel_reason_title :(callback)=>{
					if(!cancelReasonId) return callback(null,null);

					/** Get cancel reason title */
					const cancel_reasons = this.db.collection(Tables.CANCEL_REASONS);
					cancel_reasons.findOne({_id: cancelReasonId},{projection: {title:1}}).then(result=>{
						cancelReason = (result && result.title)?result.title[Constants.DEFAULT_LANGUAGE_CODE] :cancelReason;
						callback(null, cancelReason);
					}).catch(next);
				},
			},(asyncErr, asyncRes)=>{
				if(asyncErr) return next(asyncErr);

				/** Send error response */
				if(!asyncRes.order_details){
					return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });
				}

				/** Send success response */
				if(!asyncRes.order_details.kfg_order || (!asyncRes.order_details.success_push_to_kfg && !asyncRes.order_details.modified_success_push_to_kfg)){
					return resolve({status: Constants.STATUS_SUCCESS });
				}

				/** To cancel order  */
				axios({
					method: 'GET',
					url: Constants.WEBSITE_URL + 'cancel_order/' + orderId,
					params: {
						cancelled_by: cancelledBy,
						cancelled_reason: cancelReason
					}
				}).then(response => {
					resolve(response.data);
				}).catch(error => {
					next(error);
				});
			});
		}).catch(next);
	};//End sendCancelledRequestToKFG()
}
