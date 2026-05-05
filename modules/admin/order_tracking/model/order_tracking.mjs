import { ObjectId } from 'mongodb';
import {parallel as asyncParallel} from 'async';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import * as Helper  from "../../../../utils/index.mjs";
import assignmentModule from '../../../../modules/frontend/api/model/assignment.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { insertNotifications, saveSystemLogs } from "../../../../services/index.mjs";

class OrderTracking {
	constructor(db) {
		this.db = db;
		this.collectionDb = this.db.collection(Tables.ORDERS);

		this.assignmentModel = new assignmentModule(db);
	}

	/**
	 * Function to get order tracking list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getOrderTrackingList (req,res,next){
		let authUserRoleId	= 	req.session.user.user_role_id;
		let isTeamHead		= 	req.session.user.team_head || false;
		let status			= 	(req.body.status) ? req.body.status : '';
		let orderType		=	(req.query.order_type) ? req.query.order_type : '';

		/** Get fleet area ids */
		let fleetAreaIds = [];
		if(authUserRoleId == Constants.FLEET && !isTeamHead){
			fleetAreaIds = await Helper.getAreaIdsBasedOnFleetRole(req, res, next);
		}

		let businessRule 		= 	null;
		let businessConditions 	=	null;
		if(authUserRoleId == Constants.CALL_CENTER_TEAM && !isTeamHead){
			let taskAssignments = await Helper.getConditionsBasedOnCallCenterRole(req,res,next);
			businessRule 		= taskAssignments?.rules || {};
			businessConditions 	= taskAssignments?.conditions || [];
		}

		/** Set conditions */
		let commonConditions = {};
		if(Helper.isPost(req)){
			let limit 	  = (req.body.length)   ? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
			let skip 	  = (req.body.start)    ? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
			let fromDate  = (req.body.fromDate) ? req.body.fromDate 		: "";
			let toDate 	  = (req.body.toDate)   ? req.body.toDate 		    : "";
			let deliveryType = (req.body.delivery_type)   ? req.body.delivery_type   : "";
			let restaurantId = (req.body.restaurant_id)   ? req.body.restaurant_id 	 : '';
			let isOrderAssigned = (req.body.is_order_assigned)? req.body.is_order_assigned: "";
			let captainId 		= (req.body.captain_id)		  ? req.body.captain_id		  : "";
			let excludedStatus	= [Constants.ORDER_REJECTED,Constants.ORDER_REJECTED_BY_ADMIN,Constants.ORDER_DELIVERED,Constants.ORDER_CANCELLED];

			/** Configure Datatable conditions*/
			const dataTableConfig = await Helper.configDatatable(req, res, null);

			if(authUserRoleId == Constants.CALL_CENTER_TEAM && !isTeamHead){
				if(businessConditions && businessConditions.length > 0){
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

			if(authUserRoleId == Constants.FLEET && !isTeamHead) commonConditions.branch_area_id = {$in : Helper.arrayToObject(fleetAreaIds)};

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
				});
			}

			if(orderType){
				switch(orderType){
					case "first_orders":
						if(!commonConditions["$and"]) commonConditions["$and"] = [];
						commonConditions["$and"].push({
							is_first_order 	: 	true,
							admin_status 	:	Constants.ORDER_PENDING
						});
					break;
					case "duplicate_orders":
						if(!commonConditions["$and"]) commonConditions["$and"] = [];
						commonConditions["$and"].push({
							is_duplicate_order 	: 	true,
							admin_status 	:	Constants.ORDER_PENDING
						});
					break;
					case "big_orders":
						if(!commonConditions["$and"]) commonConditions["$and"] = [];
						commonConditions["$and"].push({
							is_big_order 	: 	true,
							admin_status 	:	Constants.ORDER_PENDING
						});
					break;
					case "order_rejected":
						commonConditions['admin_status']	=	{$in : [Constants.ORDER_REJECTED,Constants.ORDER_REJECTED_BY_ADMIN]};
					break;
					case "delayed_acceptance":
						commonConditions['is_delayed_acceptance']	= true;
						commonConditions.admin_status	 = {$nin : excludedStatus};
						commonConditions["confirm_status.is_delayed_acceptance"] = {$exists :false};
					break;
					case "delayed_preparation":
						commonConditions['is_delayed_preperation'] = true;
						commonConditions.admin_status	= {$nin : excludedStatus};
						commonConditions["confirm_status.is_delayed_preperation"] = {$exists :false};
					break;
					case "delayed_pickup_by_captain":
						commonConditions['is_delayed_pickup_by_captain'] = true;
						commonConditions.admin_status	= {$nin : excludedStatus};
						commonConditions["confirm_status.is_delayed_pickup_by_captain"] = {$exists :false};
					break;
					case "delayed_pickup_by_customer":
						commonConditions['is_delayed_picked_up_by_customer'] = true;
						commonConditions.admin_status	= {$nin : excludedStatus};
						commonConditions["confirm_status.is_delayed_picked_up_by_customer"] = {$exists :false};
					break;
					case "delayed_pickup_by_restaurant":
						commonConditions['is_delayed_pickup'] = true;
						commonConditions['delivery_type'] 	  = Constants.DELIVERY_BY_RESTAURANT;
						commonConditions.admin_status		  = {$nin : excludedStatus};
						commonConditions["confirm_status.delayed_pickup_by_restaurant"] = {$exists :false};
					break;
					case "vip_orders":
						commonConditions['is_vip'] = true;
						commonConditions.admin_status	= {$nin : excludedStatus};
					break;
					case "delayed_delivery":
						commonConditions['is_delayed_delivery'] = true;
						commonConditions.admin_status	= {$nin : excludedStatus};
						commonConditions["confirm_status.is_delayed_delivery"] = {$exists :false};
					break;
					case "delivery_cravez":
						commonConditions['delivery_type'] = Constants.DELIVERY_BY_CRAVEZ;
						commonConditions.admin_status	= {$nin : excludedStatus};
					break;
					case "delivery_restaurant":
						commonConditions['delivery_type'] = Constants.DELIVERY_BY_RESTAURANT;
						commonConditions.admin_status	= {$nin : excludedStatus};
					break;
					case "way_to_customer":
						if(!commonConditions["$and"]) commonConditions["$and"] = [];
						commonConditions["$and"].push(
							{delivery_status : Constants.ORDER_DRIVER_WAY_TO_CUSTOMER},
							{is_completed : {$ne: true}},
						);
					break;
					case "way_to_restaurant":
						commonConditions['delivery_status'] = Constants.ORDER_DRIVER_ACCEPTED;
					break;
					case "delivered":
						commonConditions['admin_status'] = Constants.ORDER_DELIVERED;
					break;
					case "not_assigned":
						commonConditions['is_completed']	= {$exists: false};
						commonConditions.admin_status	    = {$nin : excludedStatus};
						if(!commonConditions["$and"]) commonConditions["$and"] = [];
						commonConditions["$and"].push({$or:[
							{
								delivery_type 	: 	Constants.DELIVERY_BY_CRAVEZ,
								captain_id		:	""
							},
							{
								delivery_type 	: 	Constants.DELIVERY_BY_RESTAURANT,
								captain_name	:	{$exists: false}
							},
						]});
					break;
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
				if(!dataTableConfig.conditions['$and']) dataTableConfig.conditions['$and'] =[];
				dataTableConfig.conditions['$and'].push({$or: deliveryByConditions});
			}

			/** Conditions for restaurants */
			if(restaurantId){
				if(restaurantId.constructor !== Array)  restaurantId = [restaurantId];
				restaurantId = Helper.arrayToObject(restaurantId);

				if(!dataTableConfig.conditions['$and']) dataTableConfig.conditions['$and'] =[];
				dataTableConfig.conditions['$and'].push({
					restaurant_id : {$in : restaurantId}
				});
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
					dataTableConfig.conditions['is_completed']	= {$exists: false};
					dataTableConfig.conditions.admin_status	    = {$nin : excludedStatus};
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

			/** Conditions for captain id */
			if(captainId){
				if(!dataTableConfig.conditions['$and']) dataTableConfig.conditions['$and'] =[];
				dataTableConfig.conditions['$and'].push({
					captain_id : 	new ObjectId(captainId)
				});
			}

			dataTableConfig.conditions = Object.assign(dateConditions, dataTableConfig.conditions,commonConditions);

			// Get list or count of orders
			let dbRes = await this.collectionDb.aggregate([
				{$match: dataTableConfig.conditions },
				{$facet : {
					list : [
						{$sort  : dataTableConfig.sort_conditions},
						{$skip 	: skip},
						{$limit : limit},
						{$project : {
							_id:1, customer_id:1,is_confirm:1,number_of_queue:1,queue_time:1,invoice_number:1,unique_order_id:1,order_date:1,last_status_updated_on:1,restaurant_name:1,area_name:1,order_price:1,infinity_service:1,admin_status:1,modified:1,net_amount:1, is_first_order: 1, is_duplicate_order:1,is_completed:1,is_modified:1,captain_id:1,delivery_type:1,order_status:1,area_id:1,delivery_status:1,package_id:1, full_name: 1,mobile_number: 1,branch_id:1,restaurant_id:1,queue_sort: { $cond: [{$eq : ["$queue_time",""]},1,0]},is_big_order:1,is_delayed_acceptance:1,is_delayed_preperation:1,is_delayed_pickup_by_captain:1,is_delayed_picked_up_by_customer:1,is_delayed_pickup:1,is_vip:1,is_delayed_delivery:1,delivery_status:1,captain_name:1,assigned_captain:1,assignment_type:1,amount_debited_by_wallet:1, previous_assigned_captains: 1
						}},
					],
					count: [
						{$count: "count"},
					],
				}}
			],{allowDiskUse: true}).toArray();

			let result = dbRes?.[0]?.list ||[];
			let deliveryByIds	= [];
			let captainIds		= [];
			let orderIds		= [];
			let allBranchIds  	= [];
			let uniqueOrderIds  = [];
			result.map(record=>{
				if(record._id) orderIds.push(record._id);
				if(record.captain_id) captainIds.push(record.captain_id);
				if(record.delivery_type) deliveryByIds.push(record.delivery_type);
				if(record.unique_order_id) uniqueOrderIds.push(record.unique_order_id);
				if(record.branch_id) allBranchIds.push(record.branch_id);
			});

			const users = this.db.collection(Tables.USERS);
			const areas = this.db.collection(Tables.AREAS);
			const order_details = this.db.collection(Tables.ORDER_DETAILS);
			const restaurant_branches = this.db.collection(Tables.RESTAURANT_BRANCHES);
			const order_modify_logs = this.db.collection(Tables.ORDER_MODIFY_LOGS);
			const delivery_methods = this.db.collection(Tables.DELIVERY_METHODS);

			/**  All queries in parallel using object keys */
			const childResponse = await Helper.runTaskParallel({
				order_detail: order_details.find({
					order_id : {$in : Helper.arrayToObject(orderIds)}
				},{projection : {
					order_id: 1,discount_price: 1,elapsed_time:1,customer_latitude:1,customer_longitude:1,delivery_area_id:1
				}}).toArray().then(orderResult=>{

					let orderList = {};
					orderResult.forEach(order=>{
						orderList[order.order_id] = {
							discount_price 		: order.discount_price,
							elapsed_time   		: order.elapsed_time,
							customer_latitude   : order.customer_latitude,
							customer_longitude  : order.customer_longitude,
							delivery_area_id  	: order.delivery_area_id
						};
					});
					return orderList;
				}),
				user_detail: captainIds.length ?
					users.find({_id: {$in : Helper.arrayToObject(captainIds)}},{projection : {_id: 1,full_name: 1}}).toArray().then(userResult=>{
						let userList = {};
						userResult.forEach(user=>{
							userList[user._id] = user.full_name ;
						});
						return userList;
					})
				:{},
				delivery_detail: deliveryByIds.length ?
					delivery_methods.find({slug : {$in : deliveryByIds}},{projection : {slug: 1,title: 1}}).toArray().then(deliveryResult=>{
						let deliveryList = {};
						deliveryResult.forEach(delivery=>{
							deliveryList[delivery.slug] = delivery.title;
						});
						return deliveryList;
					})
				:{},
				delivery_areas: areas.find({},{projection : {_id:1,name:1}}).toArray().then(areaResult=>{

					let deliveryAreaList = {};
					areaResult.map(area=>{
						deliveryAreaList[area._id] = area.name;
					});
					return deliveryAreaList;
				}),
				modify_order_details:
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
					]).toArray().then(findResult=> findResult),

				branch_list: allBranchIds.length ?
					restaurant_branches.find({_id : {$in: allBranchIds} },{projection: {_id:1, area_id:1}}).toArray().then(branchResult=>{
						let tmpBranchObj = {};
						branchResult.map(records=>{
							tmpBranchObj[records._id] = records;
						});
						return tmpBranchObj;
					})
				:{},
			});

			let tmpBranchList		= childResponse?.branch_list || {};
			let modifyOrderResult 	= childResponse?.modify_order_details || [];
			result.map(record=>{
				let tmpOrderDetails= childResponse?.order_detail?.[record._id] || {};
				let deliveryAreaId = tmpOrderDetails?.delivery_area_id || "";

				let branchAreaId =	tmpBranchList?.[record.branch_id]?.area_id || "";
				record.area_name =	branchAreaId && childResponse?.delivery_areas?.[branchAreaId] || {};

				record.captain_name    		=	childResponse?.user_detail?.[record.captain_id] || "";
				record.delivery_by     		=	childResponse?.delivery_detail?.[record.delivery_type] || "";
				record.delivery_area_name 	=	childResponse?.delivery_areas?.[deliveryAreaId] || "";
				record.discount_price  		=	tmpOrderDetails?.discount_price || "";
				record.elapsed_time    		=	tmpOrderDetails?.elapsed_time || "";
				record.customer_longitude 	=	tmpOrderDetails?.customer_longitude || "";
				record.customer_latitude  	=	tmpOrderDetails?.customer_latitude || "";

				/** Insert modify order price in records **/
				modifyOrderResult.map(orderRecords=>{
					if(record.unique_order_id == orderRecords.unique_order_id){
						record.modify_order_price = orderRecords.modify_order_price
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
			asyncParallel({
				dropdown_list : (callback)=>{
					/**Get dropdown list **/
					Helper.getDropdownList(req,res, next,{
						collections :[
							{
								collection : Tables.RESTAURANTS,
								columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
								conditions : {
									status		: Constants.ACTIVE,
									is_deleted	: Constants.NOT_DELETED
								},
							},
							{
								collection 	: Tables.AREAS,
								columns    	: ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
								conditions 	: {is_active: Constants.ACTIVE}
							},
							{
								collection 	: Tables.USERS,
								columns    	: ["_id","full_name"],
								conditions 	: {...Constants.DRIVER_COMMON_CONDITIONS},
								sort_conditions : {is_available : Constants.SORT_DESC,full_name: Constants.SORT_ASC}
							}
						],
					}).then(dropDownResponse=> {
						callback(null,dropDownResponse?.final_html_data || {});
					}).catch(next);
				},
				orders_detail : (callback)=>{
					callback(null,{});
				},
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				let queryFromDate	= (req.query.from_date) ? req.query.from_date : "";
				let queryToDate		= (req.query.to_date) ? req.query.to_date : "";

				/** render order tracking page **/
				req.breadcrumbs(BREADCRUMBS['admin/order_tracking/order_tracking']);
				res.render('order_tracking',{
					order_type       :	orderType,
					restaurant_list  :  asyncResponse?.dropdown_list?.[0] || "",
					area_list 		 :  asyncResponse?.dropdown_list?.[1] || "",
					driver_list  	 :  asyncResponse?.dropdown_list?.[2] || "",
					first_orders 	 : 	asyncResponse?.orders_detail?.first_orders || 0,
					duplicate_orders : 	asyncResponse?.orders_detail?.duplicate_orders || 0,
					big_orders 		 : 	asyncResponse?.orders_detail?.big_orders || 0,
					order_rejected 	 : 	asyncResponse?.orders_detail?.order_rejected || 0,
					delayed_acceptance 		: asyncResponse?.orders_detail?.delayed_acceptance || 0,
					delayed_preparation 	: asyncResponse?.orders_detail?.delayed_preparation || 0,
					delayed_pickup_by_captain 	: asyncResponse?.orders_detail?.delayed_pickup_by_captain  || 0,
					delayed_pickup_by_customer 	: asyncResponse?.orders_detail?.delayed_pickup_by_customer || 0,
					delayed_pickup_by_restaurant: asyncResponse?.orders_detail?.delayed_pickup_by_restaurant || 0,
					vip_orders 			: asyncResponse?.orders_detail?.vip_orders || 0,
					delayed_delivery 	: asyncResponse?.orders_detail?.delayed_delivery || 0,
					delivery_cravez 	: asyncResponse?.orders_detail?.delivery_cravez || 0,
					delivery_restaurant : asyncResponse?.orders_detail?.delivery_restaurant || 0,
					way_to_customer 	: asyncResponse?.orders_detail?.way_to_customer || 0,
					way_to_restaurant 	: asyncResponse?.orders_detail?.way_to_restaurant || 0,
					order_delivered 	: asyncResponse?.orders_detail?.order_delivered || 0,
					order_not_assigned  : asyncResponse?.orders_detail?.order_not_assigned || 0,
					businessRule  		: businessRule,
					filter_from_date	: queryFromDate,
					filter_to_date		: queryToDate,
				});
			});
		}
	};//End getOrderTrackingList()

	/**
	 * Function to get order count
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getOrderCounts (req,res,next){
		return new Promise(async resolve=>{
			let isTeamHead		= 	(req.session.user.team_head) ? req.session.user.team_head :false;
			let authUserRoleId	= 	req.session.user.user_role_id;
			let fromDate  		= 	(req.body.from_date) ? req.body.from_date	:"";
			let toDate 	  		=	(req.body.to_date)   ? req.body.to_date   	:"";

			/** Set conditions */
			let commonConditions = {};

			/** Conditions for order date */
			if (fromDate != "" && toDate != "")  commonConditions.order_date = {$gte: Helper.newDate(fromDate), $lte: Helper.newDate(toDate)};

			if(authUserRoleId == Constants.CALL_CENTER_TEAM && !isTeamHead){
				let taskAssignments = await Helper.getConditionsBasedOnCallCenterRole(req,res,next);
				businessRule 		= taskAssignments?.rules || {};
				let businessConditions 	= taskAssignments?.conditions || [];

				commonConditions["$or"] = businessConditions;
			}

			/** Get fleet area ids */
			if(authUserRoleId == Constants.FLEET && !isTeamHead){
				let fleetAreaIds = await Helper.getAreaIdsBasedOnFleetRole(req, res, next);
				commonConditions.branch_area_id = {$in : Helper.arrayToObject(fleetAreaIds)};
			}

			let excludedStatus	= [Constants.ORDER_REJECTED,Constants.ORDER_REJECTED_BY_ADMIN,Constants.ORDER_DELIVERED,Constants.ORDER_CANCELLED];
			let result = await this.collectionDb.aggregate([
				{$match : commonConditions},
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
								{ $eq : ["$is_first_order",true] },
								{ $eq : ["$admin_status",Constants.ORDER_PENDING] },
							]},
							1, 0
						]}
					},
					duplicate_orders : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$is_duplicate_order",true] },
								{ $eq : ["$admin_status",Constants.ORDER_PENDING] },
							]},
							1, 0
						]}
					},
					big_orders : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$is_big_order",true] },
								{ $eq : ["$admin_status",Constants.ORDER_PENDING] },
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
								{ "$not": { "$in": ["$admin_status", excludedStatus ] }}
							]},
							1, 0
						]}
					},
					delayed_preparation : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$is_delayed_preperation", true ] },
								{ $eq : [{"$size":"$confirm_is_delayed_preperation"}, 0 ] },
								{ "$not": { "$in": ["$admin_status", excludedStatus ] }}
							]},
							1, 0
						]}
					},
					delayed_pickup_by_captain : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$is_delayed_pickup_by_captain", true ] },
								{ $eq : [{"$size":"$confirm_is_delayed_pickup_by_captain"}, 0 ] },
								{ "$not": { "$in": ["$admin_status", excludedStatus ] }}
							]},
							1, 0
						]}
					},
					delayed_pickup_by_customer : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$is_delayed_picked_up_by_customer", true ] },
								{ $eq : [{"$size":"$confirm_is_delayed_picked_up_by_customer"}, 0 ] },
								{ "$not": { "$in": ["$admin_status", excludedStatus ] }}
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
								{ "$not": { "$in": ["$admin_status", excludedStatus ] }}
							]},
							1, 0
						]}
					},
					vip_orders : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$is_vip", true ] },
								{ "$not": { "$in": ["$admin_status", excludedStatus ] }}
							]},
							1, 0
						]}
					},
					delayed_delivery : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$is_delayed_delivery", true ] },
								{ $eq : [{"$size":"$confirm_is_delayed_delivery"}, 0 ] },
								{ "$not": { "$in": ["$admin_status", excludedStatus ] }}
							]},
							1, 0
						]}
					},
					delivery_cravez : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$delivery_type", Constants.DELIVERY_BY_CRAVEZ ] },
								{ "$not": { "$in": ["$admin_status", excludedStatus ] }}
							]},
							1, 0
						]}
					},
					delivery_restaurant : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$delivery_type", Constants.DELIVERY_BY_RESTAURANT ] },
								{ "$not": { "$in": ["$admin_status", excludedStatus ] }}
							]},
							1, 0
						]}
					},
					way_to_customer : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$delivery_status", Constants.ORDER_DRIVER_WAY_TO_CUSTOMER ] },
							]},
							1, 0
						]}
					},
					way_to_restaurant : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$delivery_status", Constants.ORDER_DRIVER_ACCEPTED ] },
							]},
							1, 0
						]}
					},
					order_delivered : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$admin_status", Constants.ORDER_DELIVERED ] },
							]},
							1, 0
						]}
					},
					order_not_assigned : {$sum : {
						$cond: [
							{$and: [
								{ $not : ["$is_completed" ] },
								{ $not: { $in: ["$admin_status", excludedStatus ] }},
								{ $or :  [
									{$and: [
										{ $eq : ["$delivery_type", Constants.DELIVERY_BY_CRAVEZ ] },
										{ $eq : ["$captain_id", "" ] },
									]},
									{$and: [
										{ $eq : ["$delivery_type", Constants.DELIVERY_BY_RESTAURANT ] },
										{ $not : ["$captain_name" ] },
									]}
								]},
							]},
							1, 0
						]}
					},
				}}
			],{allowDiskUse: true, hint: { admin_status: 1 } }).toArray();

			/** Send response */
			result = (result && result[0]) ? result[0] :{};
			resolve({
				status				: 	Constants.STATUS_SUCCESS,
				first_orders 		: 	result?.[0]?.first_orders || 0,
				duplicate_orders	: 	result?.[0]?.duplicate_orders || 0,
				big_orders 			: 	result?.[0]?.big_orders || 0,
				order_rejected 		: 	result?.[0]?.order_rejected || 0,
				delayed_acceptance 	: 	result?.[0]?.delayed_acceptance || 0,
				delayed_preparation : 	result?.[0]?.delayed_preparation || 0,
				vip_orders 			: 	result?.[0]?.vip_orders || 0,
				delayed_delivery 	: 	result?.[0]?.delayed_delivery || 0,
				delivery_cravez 	: 	result?.[0]?.delivery_cravez || 0,
				delivery_restaurant : 	result?.[0]?.delivery_restaurant || 0,
				way_to_customer 	: 	result?.[0]?.way_to_customer || 0,
				way_to_restaurant 	: 	result?.[0]?.way_to_restaurant || 0,
				order_delivered 	: 	result?.[0]?.order_delivered || 0,
				order_not_assigned	:	result?.[0]?.order_not_assigned || 0,
				delayed_pickup_by_captain 	: result?.[0]?.delayed_pickup_by_captain || 0,
				delayed_pickup_by_customer 	: result?.[0]?.delayed_pickup_by_customer || 0,
				delayed_pickup_by_restaurant: result?.[0]?.delayed_pickup_by_restaurant || 0,
			});
		}).catch(next);
	};// end getOrderCounts

	/**
	 * Function to get order count on refresh
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getOrderData (req,res,next){
		this.getOrderCounts(req,res,next).then(response=> {
			/** Send response */
			res.send(response);
		}).catch(next);
	};// End getOrderData

	/**
	 * Function to get order location
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getOrderLocation (req,res,next){
		let refresh			= (req.query.refresh) ? req.query.refresh : '';
		let orderIds		= (req.body.order_ids) ? req.body.order_ids : [];

		asyncParallel({
			order_detail :(locationCallback)=>{
				/** Get order details **/
				const order_details  = this.db.collection(Tables.ORDER_DETAILS);
				order_details.find({order_id : {$in : Helper.arrayToObject(orderIds)}},{projection: {_id:1,order_id:1,restaurant_address:1,customer_address:1,customer_latitude:1,customer_longitude:1,restaurant_latitude:1,restaurant_longitude:1}}).toArray().then(orderDetailResult=>{
					locationCallback(null,orderDetailResult);
				}).catch(next);
			},
			order_data :(locationCallback)=>{
				/** Get order details **/
				this.collectionDb.find({_id : {$in : Helper.arrayToObject(orderIds)}},{projection: {_id:1,order_status:1,captain_id:1,unique_order_id:1}}).toArray().then(orderResult=>{
					locationCallback(null,orderResult);
				}).catch(next);
			},
		},(asyncErr, asyncResponse)=>{
			if(asyncErr) return next(asyncErr);

			let orderDetail	=	(asyncResponse.order_detail) ? asyncResponse.order_detail : [];
			let orderData	=	(asyncResponse.order_data) ? asyncResponse.order_data : [];

			let captainIds = [];
			orderData.map(records=>{
				if(records.captain_id) captainIds.push(records.captain_id);
			});
			captainIds = Helper.arrayToObject(captainIds);

			/** Get captain details **/
			const users  = this.db.collection(Tables.USERS);
			users.find({_id : {$in : captainIds}},{projection: {_id:1,longitude:1,latitude:1,full_name:1,mobile_number:1,order_status:1}}).toArray().then(userResult=>{

				orderData.map(orderRecords=>{
					orderDetail.map(detail=>{
						if(String(orderRecords._id) == String(detail.order_id)){
							orderRecords.customer_address = detail.customer_address;
							orderRecords.customer_latitude = detail.customer_latitude;
							orderRecords.customer_longitude = detail.customer_longitude;
							orderRecords.restaurant_address = detail.restaurant_address;
							orderRecords.restaurant_latitude = detail.restaurant_latitude;
							orderRecords.restaurant_longitude = detail.restaurant_longitude;
						}
					});
					userResult.map(userRecords=>{
						if(String(orderRecords.captain_id) == String(userRecords._id)){
							orderRecords.captain_status = userRecords.order_status;
							orderRecords.latitude = userRecords.latitude;
							orderRecords.longitude = userRecords.longitude;
							orderRecords.full_name = userRecords.full_name;
							orderRecords.mobile_number = userRecords.mobile_number;
						}
					});
				});

				if(refresh){
					res.send({status: Constants.STATUS_SUCCESS, result: orderData });
				}else{
					/** Send response **/
					res.render('view_map',{
						status	: Constants.STATUS_SUCCESS,
						result	: orderData,
						order_ids: orderIds,
						layout  : false
					});
				}
			}).catch(next);
		});
	};//End getOrderLocation()

	/**
	 * Function to get order tracking list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async assignCaptainList (req,res,next){
		let orderId		=	new ObjectId(req.params.order_id);
		let startDate 	=	Helper.newDate(Helper.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));
		let endDate 	= 	Helper.newDate(Helper.newDate("",Constants.CURRENTDATE_END_DATE_FORMAT));

		/** Get order details  */
		this.collectionDb.aggregate([
			{$match: {
				_id 			: 	orderId,
				is_confirm 		: 	true,
				delivery_type 	: 	Constants.DELIVERY_BY_CRAVEZ,
				$and 			:	[
					{is_completed: {$exists  :false }},
					{is_completed: {$ne 	 :true }},
				]
			}},
			{$lookup: {	/** Get branch details **/
				from 		:	Tables.RESTAURANT_BRANCHES,
				localField  :	"branch_id",
				foreignField:	"_id",
				as 		  	:	"branch_details"
			}},
			{$project: {
				_id:1, branch_id:1, branch_area_id: {$arrayElemAt: ["$branch_details.area_id",0]}
			}},
		]).toArray().then(orderResult=>{

			/** Send error response */
			if(!orderResult.length) return res.status(400).send({ status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") });

			let orderDetils 	=	orderResult[0];
			let deliveryAreaId	= 	orderDetils.branch_area_id;
			let branchId		= 	orderDetils.branch_id;
			let areaConditions 	= 	{is_active: Constants.ACTIVE};

			asyncParallel({
				total_captains:(childCallback)=>{
					/** Set driver availability conditions */
					let driverAvailabilityConditions ={
						date : { $gte: startDate, $lte: endDate},
					};

					/** Get driver ids */
					const driver_availabilities	= this.db.collection(Tables.DRIVER_AVAILABILITIES);
					driver_availabilities.distinct("user_id",driverAvailabilityConditions).then(driverIds=>{
						childCallback(null,driverIds?.length || 0);
					}).catch(next);
				},
				area_list:(childCallback)=>{
					/**Get dropdown list **/
					Helper.getDropdownList(req,res, next,{
						collections :[{
							collection 	: Tables.AREAS,
							columns    	: ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions 	: areaConditions,
						}],
					}).then(dropDownResponse=> {
						childCallback(null, dropDownResponse?.final_html_data?.["0"] || "");
					}).catch(next);
				},
			},(err, response)=>{
				if(err) return next(err);

				/** render assign captain page **/
				res.render('assign_captain',{
					layout			:	false,
					order_id		: 	orderId,
					area_list		: 	response?.area_list || "",
					total_captains	: 	response?.total_captains || Constants.ADMIN_LISTING_LIMIT,
					branch_id		: 	branchId,
					branch_area_id	: 	deliveryAreaId
				});
			});
		}).catch(next);
	};//End assignCaptainList()

	/**
	 * Function to get captain list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getCaptainList (req,res,next){
		let currentDate 	= Helper.newDate("",Constants.DATABASE_DATE_FORMAT);
		let startDate   	= Helper.getUtcDate(currentDate+" "+Constants.START_DATE_TIME_FORMAT);
		let endDate  		= Helper.getUtcDate(currentDate+" "+Constants.END_DATE_TIME_FORMAT);
		let limit 			= (req.body.length) 	? 	parseInt(req.body.length) 	:Constants.ADMIN_LISTING_LIMIT;
		let skip 			= (req.body.start)   	? 	parseInt(req.body.start)  	:Constants.DEFAULT_SKIP;
		let areaId 			= (req.body.area_id)   	?	req.body.area_id		 	:"";
		let orderId 		= (req.body.order_id)   ?	new ObjectId(req.body.order_id) :"";
		let fullName 		= (req.body.full_name)  ?	req.body.full_name 			:"";
		let driverOrderStatus=	(req.body.driver_order_status)  ?	req.body.driver_order_status :"";
		let totalRecord		=	(req.body.total_record)  ?	req.body.total_record 	:Constants.ADMIN_LISTING_LIMIT;
		if(areaId && areaId.constructor != Array) areaId = [areaId];
		if(driverOrderStatus && driverOrderStatus.constructor != Array) driverOrderStatus = [driverOrderStatus];

		asyncParallel({
			order_details:(callback)=>{
				/** Get order details  */
				const order_details = this.db.collection(Tables.ORDER_DETAILS);
				order_details.findOne({order_id: orderId },{projection: {restaurant_longitude:1,restaurant_latitude:1,delivery_area_id:1}}).then(orderResult=>{
					callback(null, orderResult);
				}).catch(next);
			},
			orders:(callback)=>{
				/** Get order details  */
				this.collectionDb.aggregate([
					{$match: {_id: orderId}},
					{$lookup: {	/** Get resturant details **/
						from 		:	Tables.RESTAURANTS,
						localField  :	"restaurant_id",
						foreignField:	"_id",
						as 		  	:	"restaurant_details"
					}},
					{$lookup: {	/** Get branch details **/
						from 		:	Tables.RESTAURANT_BRANCHES,
						localField  :	"branch_id",
						foreignField:	"_id",
						as 		  	:	"branch_details"
					}},
					{$project: {
						assigned_captain:1, branch_id:1,
						delivery_vehicle_type: {$arrayElemAt: ["$branch_details.delivery_vehicle_type",0]},
						restaurant_vehicle_type: {$arrayElemAt: ["$restaurant_details.delivery_vehicle_type",0]}
					}},
				]).toArray().then(orderResult=>{
					orderResult = (orderResult && orderResult[0]) ? orderResult[0] :{};
					callback(null, orderResult);
				}).catch(next);
			},
		},async (asyncErr, asyncResponse)=>{
			if(asyncErr) return next(asyncErr);

			let orderData 			= 	(asyncResponse.orders) 			? 	asyncResponse.orders		:{};
			let orderDetails 		=	(asyncResponse.order_details) 	? 	asyncResponse.order_details	:{};
			let assignedCaptain 	=	(orderData.assigned_captain) 	?	orderData.assigned_captain	:"";
			let restaurantVehicleType=	(orderData.restaurant_vehicle_type)?orderData.restaurant_vehicle_type :[];
			let branchVehicleType	=	(orderData.delivery_vehicle_type)? 	orderData.delivery_vehicle_type   :[];
			if(branchVehicleType && branchVehicleType.constructor != Array) branchVehicleType = [branchVehicleType];
			if(restaurantVehicleType && restaurantVehicleType.constructor != Array) restaurantVehicleType = [restaurantVehicleType];

			/**Manage condition for branch/restaurant vechile type**/
			let vehicleType = (branchVehicleType.length > 0) ? branchVehicleType : restaurantVehicleType;

			/** Configure Datatable conditions*/
			const dataTableConfig = await Helper.configDatatable(req, res, null);

			/** Set driver availability conditions */
			let driverAvailabilityConditions ={
				date : { $gte: startDate, $lte: endDate},
			};

			/** Add area conditions */
			if(areaId && areaId.length >0){
				driverAvailabilityConditions.area_id = {$in: Helper.arrayToObject(areaId)};
			}

			/** Get driver ids */
			const driver_availabilities	= this.db.collection(Tables.DRIVER_AVAILABILITIES);
			driver_availabilities.distinct("user_id",driverAvailabilityConditions).then(driverIds=>{

				/** Send success response */
				if(driverIds.length <= 0){
					return res.send({
						status: Constants.STATUS_SUCCESS, data: [], recordsFiltered: 0, recordsTotal: 0, draw: dataTableConfig.result_draw,
					});
				}

				/** Set common conditions */
				let commonConditions 			= 	{...{_id: {$in: driverIds} }, ...Constants.DRIVER_ASSIGNMENT_CONDITIONS };
				commonConditions.is_available 	=  	Constants.AVAILABLE;
				commonConditions.vehicle_type 	=  	{$in: vehicleType};

				if(driverOrderStatus.length > 0){
					if(!dataTableConfig.conditions["$or"]) dataTableConfig.conditions["$or"] = [];
					dataTableConfig.conditions["$or"].push({order_status: {$in: driverOrderStatus}});
					dataTableConfig.conditions["$or"].push({"orders.status": {$in: driverOrderStatus}} );
					if(driverOrderStatus.indexOf(Constants.ORDER_DRIVER_FREE) !== -1){
						dataTableConfig.conditions["$or"].push({order_status : {$exists: false}});
					}
				}

				if(fullName && fullName!=''){
					try{
						fullName = Helper.cleanRegex(fullName);
						dataTableConfig.conditions.full_name 	= new RegExp(fullName, "i");
					}catch(e){
						dataTableConfig.conditions.full_name 	= fullName;
					}
				}

				/** Revert sorting when sort by google distance */
				let sortStatus = "";
				if(dataTableConfig.sort_conditions.distance_in_minutes){
					sortStatus = dataTableConfig.sort_conditions.distance_in_minutes;
					dataTableConfig.sort_conditions = {_id: Constants.SORT_DESC};
					limit	=	(totalRecord) ?	parseInt(totalRecord) 	:Constants.ADMIN_LISTING_LIMIT;
					skip	=	Constants.DEFAULT_SKIP;
				}

				dataTableConfig.conditions = Object.assign(commonConditions,dataTableConfig.conditions);
				const collection  = this.db.collection(Tables.USERS);
				asyncParallel({
					records:(callback)=>{
						/** Get list of driver  **/
						collection.find(dataTableConfig.conditions,{projection: {
							_id:1,full_name:1,is_available :1,active_orders :1,latitude:1,longitude:1,orders:{ $elemMatch: { order_id: orderId } },active:1,order_status:1
						}}).sort(dataTableConfig.sort_conditions).limit(limit).skip(skip).toArray().then(result=>{
							if(result.length <=0 || (!orderDetails.restaurant_latitude || !orderDetails.restaurant_longitude)) return  callback(null, result);

							this.assignmentModel.getDistanceBetweenLocations(req,res,next,{
								locations		: result,
								pickup_latitude : orderDetails?.restaurant_latitude || 0,
								pickup_longitude: orderDetails?.restaurant_longitude || 0,
							}).then((locationResponse)=>{
								if(locationResponse.status!= Constants.STATUS_SUCCESS) return  callback(locationResponse.message, result);

								if(sortStatus){
									let sortKeys 		= 	["invalid"];
									let distanceField 	=	"distance_in_minutes";
									if(sortStatus == Constants.SORT_DESC) distanceField = "-"+distanceField;
									sortKeys.push(distanceField);
									locationResponse.locations = locationResponse.locations.sort(Helper.sortByKey(sortKeys));
								}
								callback(null, locationResponse.locations);
							}).catch(next);
						}).catch(next);
					},
					filter_records:(callback)=>{
						/** Get filtered records in users collection **/
						collection.countDocuments(dataTableConfig.conditions).then(filterContResult=>{
							callback(null, filterContResult);
						}).catch(next);
					}
				},(err, response)=>{
					/** Send response **/
					res.send({
						status			: Constants.STATUS_SUCCESS,
						assigned_captain: assignedCaptain,
						draw			: dataTableConfig.result_draw,
						data			: response?.records || [],
						recordsFiltered	: response?.filter_records || 0,
						recordsTotal	: response?.filter_records || 0,
					});
				});
			}).catch(next);
		});
	};//End getCaptainList()

	/**
	 * Function to get floor status list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getFloorStatusList (req,res,next){
		let currentDate 	= Helper.newDate("",Constants.DATABASE_DATE_FORMAT);
		let startDate   	= Helper.getUtcDate(currentDate+" "+Constants.START_DATE_TIME_FORMAT);
		let endDate  		= Helper.getUtcDate(currentDate+" "+Constants.END_DATE_TIME_FORMAT);
		let areaId 			= (req.body.area_id)   	?	new ObjectId(req.body.area_id) 	:"";

		/** Set driver availability conditions */
		let driverAvailabilityConditions ={
			date: { $gte: startDate, $lte: endDate},
		};

		/** Add area conditions */
		if(areaId) driverAvailabilityConditions["$and"]= [{area_id: areaId}];

		/** Get driver ids */
		const driver_availabilities	= this.db.collection(Tables.DRIVER_AVAILABILITIES);
		driver_availabilities.distinct("user_id",driverAvailabilityConditions).then(driverIds=>{

			asyncParallel({
				captain_list:(childCallback)=>{
					if(!driverIds || driverIds.length <=0) return childCallback(null,{});

					/** Set common conditions */
					let commonConditions 			=	{...{_id: {$in: driverIds} }, ...Constants.DRIVER_COMMON_CONDITIONS };;
					commonConditions.is_available 	=  	Constants.AVAILABLE;
					commonConditions.vehicle_type 	=  	{$exists: true};

					/** Get captain list */
					const users	= this.db.collection(Tables.USERS);
					users.aggregate([
						{$match: commonConditions},
						{$addFields: {
							order_status :  {$ifNull: ['$order_status', Constants.ORDER_DRIVER_FREE] } ,
						}},
						{$unwind: {path: "$orders", preserveNullAndEmptyArrays: true }},
						{$group : {
							_id 		 	: "$_id",
							vehicle_type 	: {$first: "$vehicle_type"},
							order_status 	: {$first: "$order_status"},
							orders		 	: {$push: "$orders"},
							assigned_captain: {$sum: {
								$cond: [
									{$or: [
										{ $eq : ["$orders.status",Constants.ORDER_DRIVER_ASSIGNED] },
									]},
									1,0
								]}
							},
							way_to_restaurant_captain: {$sum: {
								$cond: [
									{$or: [
										{ $eq : ["$orders.status",Constants.ORDER_DRIVER_ACCEPTED] },
									]},
									1,0
								]}
							},
							arrived_at_restaurant_captain: {$sum: {
								$cond: [
									{$or: [
										{ $eq : ["$orders.status",ORDER_DRIVER_ARRIVED_AT_RESTAURANT] },
									]},
									1,0
								]}
							},
							way_to_customer_captain: {$sum: {
								$cond: [
									{$or: [
										{ $eq : ["$orders.status",Constants.ORDER_DRIVER_WAY_TO_CUSTOMER] },
									]},
									1,0
								]}
							},
							arrived_at_customer_captain: {$sum: {
								$cond: [
									{$or: [
										{ $eq : ["$orders.status",Constants.ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION] },
									]},
									1,0
								]}
							},
						}},
						{$group : {
							_id : null,
							total_captain : {$sum : 1},
							total_captain_with_bike : {$sum : {
								$cond: [
									{$and: [
										{ $eq : ["$vehicle_type",Constants.VEHICLE_TYPE_BIKE] },
									]},
									1,0
								]}
							},
							total_captain_with_car : {$sum : {
								$cond: [
									{$and: [
										{ $eq : ["$vehicle_type",Constants.VEHICLE_TYPE_CAR] },
									]},
									1,0
								]}
							},
							free_captain : {$sum : {
								$cond: [
									{$or: [
										/* For not exists */
										{ $not: { $gt: ['$order_status', null]} },
										{ $eq : ["$order_status",Constants.ORDER_DRIVER_FREE] },
									]},
									1,0
								]}
							},
							free_captain_with_bike : {$sum : {
								$cond: [
									{$and: [
										{ $eq : ["$vehicle_type",Constants.VEHICLE_TYPE_BIKE] },
										{
											$or: [
												{ $not: { $gt: ['$order_status', null]} },
												{ $eq : ["$order_status",Constants.ORDER_DRIVER_FREE] },
											]
										}
									]},
									1,0
								]}
							},
							free_captain_with_car : {$sum : {
								$cond: [
									{$and: [
										{ $eq : ["$vehicle_type",Constants.VEHICLE_TYPE_CAR] },
										{
											$or: [
												{ $not: { $gt: ['$order_status', null]} },
												{ $eq : ["$order_status",Constants.ORDER_DRIVER_FREE] },
											]
										}
									]},
									1,0
								]}
							},
							assigned_captain : {$sum : "$assigned_captain"},
							assigned_captain_with_bike : {$sum : {
								$cond: [
									{$and: [
										{$eq: ["$vehicle_type",Constants.VEHICLE_TYPE_BIKE] },
									]},
									"$assigned_captain",0
								]}
							},
							assigned_captain_with_car : {$sum : {
								$cond: [
									{$and: [
										{$eq: ["$vehicle_type",Constants.VEHICLE_TYPE_CAR] },
									]},
									"$assigned_captain",0
								]}
							},
							way_to_restaurant : {$sum : "$way_to_restaurant_captain"},
							way_to_restaurant_with_bike : {$sum : {
								$cond: [
									{$and: [
										{$eq: ["$vehicle_type",Constants.VEHICLE_TYPE_BIKE] },
									]},
									"$way_to_restaurant_captain",0
								]}
							},
							way_to_restaurant_with_car : {$sum : {
								$cond: [
									{$and: [
										{$eq: ["$vehicle_type",Constants.VEHICLE_TYPE_CAR] },
									]},
									"$way_to_restaurant_captain",0
								]}
							},
							arrived_at_restaurant : {$sum : "$arrived_at_restaurant_captain"},
							arrived_at_restaurant_with_bike : {$sum : {
								$cond: [
									{$and: [
										{$eq: ["$vehicle_type",Constants.VEHICLE_TYPE_BIKE] },
									]},
									"$arrived_at_restaurant_captain",0
								]}
							},
							arrived_at_restaurant_with_car : {$sum : {
								$cond: [
									{$and: [
										{$eq: ["$vehicle_type",Constants.VEHICLE_TYPE_CAR] },
									]},
									"$arrived_at_restaurant_captain",0
								]}
							},
							way_to_customer : {$sum : "$way_to_customer_captain"},
							way_to_customer_with_bike : {$sum : {
								$cond: [
									{$and: [
										{$eq: ["$vehicle_type",Constants.VEHICLE_TYPE_BIKE] },
									]},
									"$way_to_customer_captain",0
								]}
							},
							way_to_customer_with_car : {$sum : {
								$cond: [
									{$and: [
										{$eq: ["$vehicle_type",Constants.VEHICLE_TYPE_CAR] },
									]},
									"$way_to_customer_captain",0
								]}
							},
							arrived_at_customer : {$sum : "$arrived_at_customer_captain"},
							arrived_at_customer_with_bike : {$sum : {
								$cond: [
									{$and: [
										{$eq: ["$vehicle_type",Constants.VEHICLE_TYPE_BIKE] },
									]},
									"$arrived_at_customer_captain",0
								]}
							},
							arrived_at_customer_with_car : {$sum : {
								$cond: [
									{$and: [
										{$eq: ["$vehicle_type",Constants.VEHICLE_TYPE_CAR] },
									]},
									"$arrived_at_customer_captain",0
								]}
							},
						}},
					]).toArray().then(result=>{
						let captainList = (result && result[0]) ? result[0] :{};
						childCallback(null,captainList);
					}).catch(next);
				},
			},(asyncChildErr, asyncChildResponse)=>{
				if(asyncChildErr) return next(asyncChildErr);
				let captainDetails = (asyncChildResponse && asyncChildResponse.captain_list) ? asyncChildResponse.captain_list :{};

				let finalArray	   = [
					{
						status_label : res.__("admin.order_tracking.total_captains"),
						total_captain : (captainDetails.total_captain) ? captainDetails.total_captain : 0,
						captain_with_car : (captainDetails.total_captain_with_car) ? captainDetails.total_captain_with_car :0,
						captain_with_bike: (captainDetails.total_captain_with_bike) ? captainDetails.total_captain_with_bike :0,
					},
					{
						status_label : res.__("admin.order_tracking.total_free_captains"),
						total_captain : (captainDetails.free_captain) ? captainDetails.free_captain : 0,
						captain_with_car : (captainDetails.free_captain_with_car) ? captainDetails.free_captain_with_car :0,
						captain_with_bike: (captainDetails.free_captain_with_bike) ? captainDetails.free_captain_with_bike :0,
					},
					{
						status_label : res.__("admin.order_tracking.assigned_captains"),
						total_captain : (captainDetails.assigned_captain) ? captainDetails.assigned_captain : 0,
						captain_with_car : (captainDetails.assigned_captain_with_car) ? captainDetails.assigned_captain_with_car :0,
						captain_with_bike: (captainDetails.assigned_captain_with_bike) ? captainDetails.assigned_captain_with_bike :0,
					},
					{
						status_label : res.__("admin.order_tracking.way_to_restaurant"),
						total_captain : (captainDetails.way_to_restaurant) ? captainDetails.way_to_restaurant : 0,
						captain_with_car : (captainDetails.way_to_restaurant_with_car) ? captainDetails.way_to_restaurant_with_car :0,
						captain_with_bike: (captainDetails.way_to_restaurant_with_bike) ? captainDetails.way_to_restaurant_with_bike :0,
					},
					{
						status_label : res.__("admin.order_tracking.arrived_at_restaurant"),
						total_captain : (captainDetails.arrived_at_restaurant) ? captainDetails.arrived_at_restaurant : 0,
						captain_with_car : (captainDetails.arrived_at_restaurant_with_car) ? captainDetails.arrived_at_restaurant_with_car :0,
						captain_with_bike: (captainDetails.arrived_at_restaurant_with_bike) ? captainDetails.arrived_at_restaurant_with_bike :0,
					},
					{
						status_label : res.__("admin.order_tracking.way_to_customer"),
						total_captain : (captainDetails.way_to_customer) ? captainDetails.way_to_customer : 0,
						captain_with_car : (captainDetails.way_to_customer_with_car) ? captainDetails.way_to_customer_with_car :0,
						captain_with_bike: (captainDetails.way_to_customer_with_bike) ? captainDetails.way_to_customer_with_bike :0,
					},
					{
						status_label : res.__("admin.order_tracking.captain_arrived_at_customer_location"),
						total_captain : (captainDetails.arrived_at_customer) ? captainDetails.arrived_at_customer : 0,
						captain_with_car : (captainDetails.arrived_at_customer_with_car) ? captainDetails.arrived_at_customer_with_car :0,
						captain_with_bike: (captainDetails.arrived_at_customer_with_bike) ? captainDetails.arrived_at_customer_with_bike :0,
					}
				];

				res.send({
					status			: Constants.STATUS_SUCCESS,
					draw			: 0,
					data			: finalArray,
					recordsFiltered	: finalArray.length,
					recordsTotal	: finalArray.length,
				});
			});
		}).catch(next);
	};//End getFloorStatusList()

	/**
	 * Function to assign order to captain
	 * Common for order tracking and captan tracking module
	 *
	 * @param req 		As Request Data
	 * @param res 		As Response Data
	 * @param next		As Callback argument to the middleware function
	 * @param options	As options
	 *
	 * @return response
	 */
	async assignOrderToCaptain (req,res,next,options){
		return new Promise(resolve=>{
			let orderId 			= (options.order_id) ? new ObjectId(options.order_id) : '';
			let captainId 			= (options.captain_id) ? new ObjectId(options.captain_id) : '';
			let distanceInMinutes 	= (options.distance_in_minutes) ? parseInt(options.distance_in_minutes) : 0;
			let authId 				= (options.user_id) ? new ObjectId(options.user_id) : '';
			let authRoleId 			= (options.user_role_id) ? options.user_role_id : '';

			if(!orderId || !authId || !authRoleId || !captainId) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters")});

			asyncParallel({
				order_details:(callback)=>{
					/** Set order conditions */
					let orderConditions = {
						_id 			: 	orderId,
						is_confirm 		: 	true,
						delivery_type 	: 	Constants.DELIVERY_BY_CRAVEZ,
						$and 			:	[
							{is_completed: {$exists  :false }},
							{is_completed: {$ne 	 :true }},
						]
					};

					/** Get order details  */
					this.collectionDb.findOne(orderConditions,{projection: {restaurant_id:1,branch_id:1,area_id:1,customer_id:1}}).then(orderResult=>{
						callback(null, orderResult);
					}).catch(next);
				},
				order_sub_details:(callback)=>{
					/** Get order details  */
					const order_details = this.db.collection(Tables.ORDER_DETAILS);
					order_details.findOne({order_id: orderId },{projection: {restaurant_longitude:1,restaurant_latitude:1,delivery_area_id:1}}).then(orderResult=>{
						callback(null, orderResult);
					}).catch(next);
				},
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				/** Send error response */
				if(!asyncResponse.order_details || !asyncResponse.order_sub_details){
					return resolve({status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") });
				}

				let orderDetails 	= asyncResponse.order_details;
				let orderSubDetails = asyncResponse.order_sub_details;

				/** Set options */
				let assOptions = {
					order_id 				:	orderId,
					assigned_by 			: 	authId,
					assigned_role_by		: 	authRoleId,
					captain_id 				: 	captainId,
					assignment_type 		: 	Constants.MANUAL_ASSIGNMENT,
					customer_id				:	orderDetails.customer_id,
					restaurant_id 			: 	orderDetails.restaurant_id,
					branch_id 				: 	orderDetails.branch_id,
					area_id 				: 	orderDetails.area_id,
					delivery_area_id 		: 	orderSubDetails.delivery_area_id,
					restaurant_latitude 	: 	orderSubDetails.restaurant_latitude,
					restaurant_longitude 	: 	orderSubDetails.restaurant_longitude,
					time_of_arrival         :   distanceInMinutes
				};

				this.assignmentModel.assignCaptainForOrder(req,res,next,assOptions).then(response=>{
					if(response.status != Constants.STATUS_SUCCESS){
						let msg = response.message;
						if(response.captain_max_order_limit_or_unavailable){
							msg =res.__("admin.order_tracking.captain_max_limit_reached");
						}
						return resolve({status: Constants.STATUS_ERROR, message: msg });
					}
					return resolve({status: Constants.STATUS_SUCCESS, message: res.__("admin.order_tracking.captain_assigned_successfully")});
				}).catch(next);
			});
	    }).catch(next);
	}//End assignOrderToCaptain()

	/**
	 * Function to order assign to captain
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	async orderAssignToCaptain (req,res,next){
		/** Order assignment process **/
		this.assignOrderToCaptain(req, res, next, {
			order_id 			: new ObjectId(req.params.order_id),
			captain_id 			: new ObjectId(req.params.captain_id),
			distance_in_minutes : parseInt(req.params.distance_in_minutes),
			user_id 			: req.session.user._id,
			user_role_id 		: req.session.user.user_role_id,
		}).then(assRespnose=>{
			if(assRespnose.status==Constants.STATUS_ERROR) return res.send(assRespnose);

			/** Send response */
			req.flash(assRespnose.status,assRespnose.message);
			res.send({status: assRespnose.status });
		}).catch(next);
	}// end orderAssignToCaptain()

	/**
	 * Function to get driver location
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getDriverLocation (req,res,next){
		let orderId		= 	(req.body.order_id)	  ? new ObjectId(req.body.order_id)	  :"";
		let captainId	=	(req.body.captain_id) ? new ObjectId(req.body.captain_id) :"";

		/** Send error response */
		if(!captainId || !orderId){
			return res.send({ status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") });
		}

		asyncParallel({
			captain_detail :(locationCallback)=>{
				/** Set condition for captains **/
				let conditions	=	{
					_id	: captainId
				};

				/** Get captain details **/
				const users  = this.db.collection(Tables.USERS);
				users.findOne(conditions,{projection: {_id:1,longitude:1,latitude:1,full_name:1,mobile_number:1}}).then(captainResult=>{
					locationCallback(null,captainResult);
				}).catch(next);
			},
			order_detail :(locationCallback)=>{
				/** Get order details **/
				const order_details  = this.db.collection(Tables.ORDER_DETAILS);
				order_details.findOne({order_id : orderId},{projection: {_id:1,unique_order_id:1, restaurant_address:1,customer_address:1,customer_latitude:1,customer_longitude:1,restaurant_latitude:1,restaurant_longitude:1}}).then(orderDetailResult=>{
					locationCallback(null,orderDetailResult);
				}).catch(next);
			},
		},(asyncErr, asyncResponse)=>{
			if(asyncErr) return next(asyncErr);

			/** Send error response */
			if(!asyncResponse.captain_detail || !asyncResponse.order_detail){
				return res.send({ status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") });
			}

			/** Send success response **/
			res.send({
				status	: Constants.STATUS_SUCCESS,
				result	: {
					captain_detail	:	asyncResponse.captain_detail,
					order_detail	:	asyncResponse.order_detail,
				}
			});
		});
	}// end getDriverLocation()

	/**
	 * Function to undo order assignment process
	 * Common for order tracking & captain tracking module
	 *
	 * @param req		As Request Data
	 * @param res		As Response Data
	 * @param next		As Callback argument to the middleware function
	 * @param options	As options
	 *
	 * @return response
	 */
	async undoOrderAssignment (req,res,next,options){
		return new Promise(resolve=>{
			let orderId		= (options.order_id) ? new ObjectId(options.order_id) : '';
			let authId		= (options.user_id) ? new ObjectId(options.user_id) : '';
			let authRoleId	= (options.user_role_id) ? options.user_role_id : '';

			if(!orderId || !authId || !authRoleId) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters")});

			/** Set order conditions */
			let conditions = {
				_id 			: 	orderId,
				is_confirm 		: 	true,
				delivery_type 	: 	Constants.DELIVERY_BY_CRAVEZ,
				$and 			:	[
					{is_completed: {$exists  :false }},
					{is_completed: {$ne 	 :true }},
					{$or: [
						{assigned_captain_status: {$ne :"" }},
						{captain_id: {$ne :"" }},
					]}
				]
			};

			/** Get order details  */
			this.collectionDb.findOne(conditions,{projection:{_id: 1,assigned_captain: 1,captain_id: 1, assigned_captain_status: 1, delivery_status: 1, unique_order_id: 1}}).then(result=>{

				/** Send error response */
				if(!result) return resolve({status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access")});

				let captainId 		= 	result.captain_id;
				let deliveryStatus 	=	result.delivery_status;
				let assignedCaptain =	result.assigned_captain;
				let assignedStatus 	=	result.assigned_captain_status;
				let orderUniqueId   = 	result.unique_order_id;

				if(!captainId) 		captainId 		= 	assignedCaptain;
				if(!deliveryStatus) deliveryStatus 	=	assignedStatus;

				asyncParallel({
					update_order_assignment : (callback)=>{
						const order_assignment_logs = this.db.collection(Tables.ORDER_ASSIGNMENT_LOGS);
						order_assignment_logs.updateMany({
							order_id	: orderId,
							captain_id	: captainId,
						},
						{
							$set: {
								current_status 	: 	Constants.ORDER_DRIVER_UNDO_ASSIGNED,
								is_undo_assign 	: 	true,
								modified 		:	Helper.getUtcDate(),
							},
						}).then(()=>{
							callback(null);

							/** Save order status logs */
							Helper.saveOrderStatusLogs(req,res,next,{
								updated_by		:	authId,
								user_id			:	captainId,
								status 			:	Constants.ORDER_DRIVER_UNDO_ASSIGNED,
								order_status	:	deliveryStatus,
								order_id 		:	orderId,
							});
						}).catch(next);
					},
					update_order : (callback)=>{
						/** Update order details */
						this.collectionDb.updateOne({
							_id	: orderId,
						},
						{$addToSet: {
							previous_assigned_captains : {
								driver_id : captainId,
								assign_by : authId,
								assign_on :	Helper.getUtcDate(),
							}
						}}).then(()=>{
							callback(null);
						}).catch(next);
					},
				},(asyncErr)=>{
					if(asyncErr) return next(asyncErr);

					/** Send success response **/
					resolve({status: Constants.STATUS_SUCCESS, message: res.__("admin.order_tracking.undo_assigned_successfully")});

					/** Send notification to driver */
					insertNotifications(req,res,{
						notification_data : {
							notification_type : Constants.NOTIFICATION_TO_DRIVER_ORDER_UNDO_ASSIGNED,
							message_params 	  : [orderUniqueId],
							parent_table_id   : orderId,
							user_id 		  : authId,
							user_role_id 	  : authRoleId,
							user_ids 		  : [captainId],
							role_id 		  : Constants.DRIVER,
							extra_parameters  :	{
								driver_id 	:	captainId,
								order_id	: 	orderId,
							}
						}
					}).then(()=>{});
				});
			}).catch(next);
		}).catch(next);
	};//End undoOrderAssignment()

	/**
	 * Function to undo order assign
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return response
	 */
	async orderUndoAssign (req,res,next){
		/** Undo order assignment **/
		this.undoOrderAssignment(req, res, next, {
			order_id 	: new ObjectId(req.params.order_id),
			user_id 	: new ObjectId(req.session.user._id),
			user_role_id: req.session.user.user_role_id,
		}).then(assRespnose=>{
			/** Send response */
			req.flash(assRespnose.status,assRespnose.message);
			res.redirect(Constants.WEBSITE_ADMIN_URL+"order_tracking");
		}).catch(next);
	}// end orderUndoAssign()

	/**
	 * Function for update order status
	 *
	 * @param req 	As 	Request Data
     * @param res 	As 	Response Data
     * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return render
	 */
	async confirmStatus (req,res,next){
		let orderId = req.params.order_id;
		if(Helper.isPost(req)){
			/** Sanitize Data **/
			req.body	= Helper.sanitizeData(req.body,NOT_ALLOWED_TAGS_XSS);
			let authId	= req.session.user._id;

			/** send error response */
			if(!orderId) return res.send({ status: Constants.STATUS_ERROR,message: res.__("system.invalid_access")});

			if(!req?.body?.confirm_status){
				return res.send({status: Constants.STATUS_ERROR, message: [
					{ 'param': 'confirm_status', 'msg': res.__("admin.orders.please_select_confirm_status")}
				]});
			}

			let confirmStatus = (req.body.confirm_status.constructor === Array) ? req.body.confirm_status : [req.body.confirm_status];
			let dataToBeUpdated = [];
			confirmStatus.map(key=>{
				let tmpRecord = {update_by : new ObjectId(authId), updated_on : Helper.getUtcDate()};
				tmpRecord[key]= true;
				dataToBeUpdated.push(tmpRecord);
			});

			this.collectionDb.updateOne({
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
					redirect_url : Constants.WEBSITE_ADMIN_URL+"orders_tracking",
				});

				/** save System logs */
				saveSystemLogs(req, res, {
					user_id				: req.session.user._id,
					parent_id			: orderId,
					activity_module		: Constants.SYSTEM_LOG_MODULE_ORDERS,
					activity_type		: Constants.ACTIVITY_TYPE_STATUS_UPDATE,
					additional_details	: {}
				}).then(()=>{ });
			});
		}else{
			/** Get detail of Order **/
			this.collectionDb.findOne({
				_id : new ObjectId(orderId)
			},{projection: {
				_id:1,is_delayed_acceptance:1,is_delayed_picked_up_by_customer:1,is_delayed_pickup:1,delivery_type : 1,is_delayed_pickup_by_captain:1,is_delayed_preperation:1,is_delayed_delivery:1,confirm_status:1
			}}).then(orderResult=>{

				if(!orderResult) return res.status(400).send({ status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") });

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
}
export default OrderTracking;