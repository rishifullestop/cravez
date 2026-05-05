import clone from 'clone';
import axios from 'axios';
import wkhtmltopdf from 'wkhtmltopdf';
import { ObjectId } from 'mongodb';
import { parallel as asyncParallel, each as asyncEach, eachOfSeries } from 'async';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from '../../../../utils/index.mjs';
import {pushNotification, sendMailToUsers, insertNotifications}from '../../../../services/index.mjs';

import userCartModal from './user_carts.mjs';
import assignmentModal from './assignment.mjs';

import { addReviewValidation } from '../validations/order.mjs';

export default class Order {
    constructor(db) {
        this.db = db;

		this.userCartAPI  	=	new userCartModal(db);
		this.assignmentAPI  =	new assignmentModal(db);
    }

	/**
	 * Function for get order list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	getOrdersList (req,res,next){
		return new Promise(resolve=>{
			req.body			=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS_WITHOUT_IFRAME);
			let defaultLimit	= (res.locals.settings['Site.front_record_limit']) ? parseInt(res.locals.settings['Site.front_record_limit']) :Constants.FRONT_LISTING_LIMIT;
			let	skip 			= (req.body.skip)		? parseInt(req.body.skip)		:Constants.DEFAULT_SKIP;
			let	limit 			= (req.body.limit)		? parseInt(req.body.limit)		:defaultLimit;
			let userId			= (req.body.user_id)	? new ObjectId(req.body.user_id):"";
			let deviceId		= (req.body.device_id)	? req.body.device_id			:"";
			let userType		= (req.body.user_type)	? req.body.user_type			:"";
			let status			= (req.body.status)		? req.body.status				:"";
			let branchId    	= (req.body.branch_id)	? new ObjectId(req.body.branch_id)	:"";
			let restaurantId    = (req.body.restaurant_id)? new ObjectId(req.body.restaurant_id)  :"";
			var startDate 		= (req.body.from_date)? Helpers.newDate(req.body.from_date,Constants.DATABASE_DATE_FORMAT) :"";
			var endDate			= (req.body.to_date)? Helpers.newDate(req.body.to_date,Constants.DATABASE_DATE_FORMAT) :startDate;
			let fromDate  		= startDate ?	Helpers.newDate(startDate+" "+Constants.START_DATE_TIME_FORMAT)	:"";
			let toDate 	  		= endDate 	? 	Helpers.newDate(endDate+" "+Constants.END_DATE_TIME_FORMAT)		:"";
			let orderNumber		= (req.body.order_number)? req.body.order_number :"";

			/** Send error response **/
			if(!userType) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access"),missing_fields:["user_type"]});

			if(userType != Constants.USER_TYPE_CUSTOMER && userType != Constants.USER_TYPE_DRIVER && userType != Constants.USER_TYPE_RESTAURANT) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});

			if(userType == Constants.USER_TYPE_DRIVER && (!userId || !status)) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access"),missing_fields:["user_id","status"]});

			if(userType == Constants.USER_TYPE_CUSTOMER && (!userId && !deviceId)) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access"),missing_fields:["user_id","device_id"]});

			if(userType == Constants.USER_TYPE_RESTAURANT && (!restaurantId || !status)) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access"),missing_fields:["restaurant_id","status"]});

			let condition	=	{};
			if(userType == Constants.USER_TYPE_CUSTOMER){
				if(userId){
					condition.customer_id = new ObjectId(userId);
				}else{
					condition.device_id = deviceId;
				}
			}else if(userType == Constants.USER_TYPE_RESTAURANT){
				condition.restaurant_id     = restaurantId;
				condition.restaurant_status = status;
				condition.is_confirm	    = true;

				if(branchId) condition.branch_id = branchId;
				if(orderNumber) condition.unique_order_id = {$regex: new RegExp(orderNumber, "i")} ;
			}else{
				if(status){
					if(status == "pick_order"){
						condition['delivery_status'] = {$in : Constants.DRIVER_PICKUP_ORDER_STATUS};
					}else if(status == "delivered_order"){
						condition['delivery_status'] = {$in : Constants.DRIVER_DELIVERED_ORDER_STATUS};
					}else{
						condition['delivery_status'] = status;
					}
					if(status == Constants.Constants.ORDER_DELIVERED && fromDate && toDate) condition["order_date"] = {$gte: fromDate,$lte:toDate};
				}
				condition['captain_id']  = new ObjectId(userId);
			}

			const orders = this.db.collection(Tables.ORDERS);
			asyncParallel({
				orders_list: (callback)=>{
					/** Get orders list  **/
					orders.find(condition,{projection:{id : 1, unique_order_id : 1,order_date : 1, restaurant_status : 1, customer_id : 1, net_amount:1, captain_id:1, branch_id : 1, delivery_type: 1, restaurant_name : 1,payment_method : 1, restaurant_id :1, delivery_status:1,driver_status:1,customer_status:1,order_price:1,delivery_fee:1, is_modified: 1,picked_from:1,pickup_captain_id:1,pickup_lat:1,pickup_long:1,problem_type:1,problem_subtype:1, is_confirm:1, rejection_reason:1, delay_voc_status: 1, outstanding_amount:1,outstanding_payment:1,amount_debited_by_wallet:1,thermal_pdf:1,is_completed:1,success_push_to_kfg:1,kfg_order:1}}).sort({_id: Constants.SORT_DESC}).skip(skip).limit(defaultLimit).toArray().then(result=>{
						if(result.length <= 0) return callback(null, result);

						/** Push branch id, delivery by id, restaurant id, customer id and order id in array */
						let orderIds 		= [];
						let branchIds 		= [];
						let userIds 		= [];
						let paymentMethods	= [];
						let deliveryByIds	= [];
						let restaurantIds	= [];
						let pickupCaptainIds = [];

						result.map(record=>{
							if(record._id) orderIds.push(record._id);
							if(record.branch_id) branchIds.push(record.branch_id);
							if(record.delivery_type) deliveryByIds.push(record.delivery_type);
							if(record.customer_id) userIds.push(record.customer_id);
							if(record.payment_method) paymentMethods.push(record.payment_method);
							if(record.restaurant_id) restaurantIds.push(record.restaurant_id);
							if(record.pickup_captain_id) pickupCaptainIds.push(record.pickup_captain_id);
						});

						asyncParallel({
							restaurant_detail : (childCallback)=>{
								const restaurants = this.db.collection(Tables.RESTAURANTS);
								restaurants.find({_id : {$in : Helpers.arrayToObject(restaurantIds)}},{projection : {_id: 1,image: 1}}).toArray().then(restaurantResult=>{

									let restaurantList = {};
									restaurantResult.map(data=>{
										restaurantList[data._id] = data.image;
									});
									childCallback(null,restaurantList);
								}).catch(next);
							},
							order_detail : (childCallback)=>{
								const order_details = this.db.collection(Tables.ORDER_DETAILS);
								order_details.find({order_id : {$in : Helpers.arrayToObject(orderIds)}},{projection : {_id: 1,restaurant_address: 1, customer_address_id : 1,order_id:1, remaining_preparation_time : 1, preparation_time : 1,restaurant_latitude:1,restaurant_longitude:1,customer_latitude:1,customer_longitude:1,discount_price:1,delivery_duration:1,delivery_in:1,customer_address_detail:1}}).toArray().then(orderResult=>{
									if(orderResult.length < 0) return childCallback(null);

                                    let orderList = {};
									orderResult.map(order=>{
										order.customer_address  = (order.customer_address_detail) ? Helpers.arrangeUserAddress(req,res,next,order.customer_address_detail)  :"";

										orderList[order.order_id] = order;
									});

									childCallback(null,orderList);
								}).catch(next);
							},
							branch_detail : (childCallback)=>{
								const restaurant_branches = this.db.collection(Tables.RESTAURANT_BRANCHES);
								restaurant_branches.find({_id : {$in : Helpers.arrayToObject(branchIds)}},{projection : {_id: 1,name: 1}}).toArray().then(branchResult=>{

									let branchList = {};
									branchResult.map(branch=>{
										branchList[branch._id] = branch.name;
									});
									childCallback(null,branchList);
								}).catch(next);
							},
							user_detail : (childCallback)=>{
								const users = this.db.collection(Tables.USERS);
								users.find({_id : {$in : Helpers.arrayToObject(userIds)}},{projection : {_id: 1,full_name: 1,mobile_number:1,revert_orders:1}}).toArray().then(userResult=>{

									let userList = {};
									userResult.map(user=>{
										userList[user._id] = {'name': user.full_name, 'mobile': user.mobile_number,revert_orders: user.revert_orders};
									});
									childCallback(null,userList);
								}).catch(next);
							},
							delivery_detail : (childCallback)=>{
								const delivery_methods = this.db.collection(Tables.DELIVERY_METHODS);
								delivery_methods.find({slug : {$in : deliveryByIds}},{projection : {slug: 1,title: 1}}).toArray().then(deliveryResult=>{

									let deliveryList = {};
									deliveryResult.map(delivery=>{
										deliveryList[delivery.slug] = { 'name' : delivery.title};
									});
									childCallback(null,deliveryList);
								}).catch(next);
							},
							payment_detail : (childCallback)=>{
								const payment_methods = this.db.collection(Tables.PAYMENT_METHODS);
								payment_methods.find({slug : {$in : paymentMethods}},{projection : {slug: 1,title: 1}}).toArray().then(paymentResult=>{

									let paymentList = {};
									paymentResult.map(payment=>{
										if(userType == Constants.USER_TYPE_RESTAURANT || userType == Constants.USER_TYPE_DRIVER){
											paymentList[payment.slug] = payment?.title || {};
										}else{
											paymentList[payment.slug]= payment?.title?.[Constants.DEFAULT_LANGUAGE_CODE] || "";
										}
									});
									childCallback(null,paymentList);
								}).catch(next);
							},
							pickup_captain_detail : (childCallback)=>{
								const users = this.db.collection(Tables.USERS);
								users.find({_id : {$in : Helpers.arrayToObject(pickupCaptainIds)}},{projection : {_id: 1,full_name: 1,mobile_number:1}}).toArray().then(pickupCaptainResult=>{

									let pickupCaptainList = {};
									pickupCaptainResult.map(pickupCaptain=>{
										pickupCaptainList[pickupCaptain._id] = {'name': pickupCaptain.full_name, 'mobile': pickupCaptain.mobile_number};
									});
									childCallback(null,pickupCaptainList);
								}).catch(next);
							},
							delivered_date_time_details : (childCallback)=>{
								/** Get order delivered time */
								const order_status_logs	= this.db.collection(Tables.ORDER_STATUS_LOGS);
								order_status_logs.find({
									order_id 	: 	{$in : orderIds},
									status 		:	Constants.Constants.ORDER_DELIVERED
								},{projection:{order_id:1,created:1}}).toArray().then(deliveredTimeResult=>{

									let deliveredTimeList = {};
									deliveredTimeResult.map(deliveredTime=>{
										deliveredTimeList[deliveredTime.order_id] = (deliveredTime) ? deliveredTime.created : "";
									});
									childCallback(null,deliveredTimeList);
								}).catch(next);
							},
							branch_phones : (childCallback)=>{
								const restaurant_branch_phone_numbers = this.db.collection(Tables.RESTAURANT_BRANCH_PHONE_NUMBERS);
								restaurant_branch_phone_numbers.find({
									branch_id 	 : {$in : Helpers.arrayToObject(branchIds)},
									attribute_id : Constants.BRANCH_CUSTOMER_SERVICE_NUMBER_ATTRIBUTE_ID
								},{projection : {_id:0,branch_id:1,country_code:1,contact_name:1,value:1}}).toArray().then(phoneResult=>{

									let branchPhoneList = {};
									phoneResult.map(data=>{
										branchPhoneList[data.branch_id] = data;
									});
									childCallback(null,branchPhoneList);
								}).catch(next);
							},
						},(childErr, childResponse)=>{
							if(childErr) return callback(childErr);

							let branchPhoneList = childResponse.branch_phones;
							result.map(record=>{
								let orderSubDetails = (childResponse.order_detail[record._id]) 			? 	childResponse.order_detail[record._id] 			:{};
								let customerDetails = (childResponse.user_detail[record.customer_id]) 	?	childResponse.user_detail[record.customer_id] 	:{};
								let pickCapDetails	= (childResponse.pickup_captain_detail[record.pickup_captain_id]) ?	childResponse.pickup_captain_detail[record.pickup_captain_id] :{};

								record.branch_phone_details = (branchPhoneList[record.branch_id]) ? branchPhoneList[record.branch_id] :{};
								record.restaurant_image   	= (childResponse.restaurant_detail[record.restaurant_id]) ? childResponse.restaurant_detail[record.restaurant_id] :"";

								record.restaurant_latitude  =	(orderSubDetails.restaurant_latitude) 	?	orderSubDetails.restaurant_latitude :"";
								record.restaurant_longitude = 	(orderSubDetails.restaurant_longitude) 	? 	orderSubDetails.restaurant_longitude:"";
								record.customer_latitude   	= 	(orderSubDetails.customer_latitude) 	? 	orderSubDetails.customer_latitude 	:"";
								record.customer_longitude   = 	(orderSubDetails.customer_longitude) 	? 	orderSubDetails.customer_longitude 	:"";
								record.discount_price   	= 	(orderSubDetails.discount_price) 		? 	orderSubDetails.discount_price 		:0;
								record.preparation_time   	= 	(orderSubDetails.preparation_time) 		? 	orderSubDetails.preparation_time 	:"";
								record.restaurant_address   = 	(orderSubDetails.restaurant_address) 	? 	orderSubDetails.restaurant_address 	:"";
								record.customer_address   	= 	(orderSubDetails.customer_address) 		? 	orderSubDetails.customer_address 	:"";
								record.delivery_duration   	= 	(orderSubDetails.delivery_duration) 	?	orderSubDetails.delivery_duration 	:"";
								record.delivery_in  	   	= 	(orderSubDetails.delivery_in) 			?	orderSubDetails.delivery_in 		:"";
								record.remaining_preparation_time= (orderSubDetails.remaining_preparation_time) ? orderSubDetails.remaining_preparation_time :0;
								record.prepared_in  		=	(orderSubDetails.preparation_time && record.order_date) ? Helpers.addDaysToDate((orderSubDetails.preparation_time / Constants.MINUTES_IN_A_HOUR),record.order_date) :"";

								record.branch_name   = (childResponse.branch_detail[record.branch_id]) ? childResponse.branch_detail[record.branch_id] :"";

								record.delivery_by   = (childResponse.delivery_detail[record.delivery_type] && childResponse.delivery_detail[record.delivery_type].name) ? childResponse.delivery_detail[record.delivery_type].name : "";

								record.problem_type 	= 	(record.problem_type)    	?	Constants.ORDER_CANCELED_REASON_TYPE[record.problem_type] :"";
								record.customer_name 	= 	(customerDetails.name) 		? 	customerDetails.name	:"";
								record.customer_mobile 	= 	(customerDetails.mobile)	? 	customerDetails.mobile 	:"";
								record.payment_type  	=	(childResponse.payment_detail[record.payment_method]) ? childResponse.payment_detail[record.payment_method] :"";
								record.pickup_captain_name 	= 	(pickCapDetails.name) 	?	pickCapDetails.name 	:"";
								record.pickup_captain_mobile=	(pickCapDetails.mobile) ? 	pickCapDetails.mobile	:"";

								/** Add order delivered date time in records*/
								if(childResponse.delivered_date_time_details[record._id]) record.delivered_date_time = childResponse.delivered_date_time_details[record._id];

								if(record.customer_id && childResponse.user_detail[record.customer_id]){
									let tmpUserDetails	=	childResponse.user_detail[record.customer_id];
									let orderStatus		=	record.order_status;
									let paymentMethod	=	record.payment_method;
									let totalOutStanding=	0;

									if(tmpUserDetails.revert_orders && tmpUserDetails.revert_orders.length >0 && paymentMethod == Constants.CASH_PAYMENT && !Constants.ORDER_FINISH_ACTIONS[orderStatus]){
										tmpUserDetails.revert_orders.map(data=>{
											if(data.outstanding_amount){
												totalOutStanding +=	data.outstanding_amount;
											}
										});
									}

									if(totalOutStanding >0) {
										record.outstanding_order_amount = Helpers.round(totalOutStanding);
									}
								}
							});

							callback(null,result);
						});
					}).catch(next);
				},
				records_total: (callback)=>{
					if(skip != Constants.DEFAULT_SKIP) return callback(null,0);

					/** Get total number of records in orders collection **/
					orders.countDocuments(condition).then(countResult=>{
						callback(null, countResult);
					}).catch(next);
				},
				amount_details: (callback)=>{
					if(status != Constants.Constants.ORDER_DELIVERED || userType != Constants.USER_TYPE_DRIVER) return callback(null);

					orders.aggregate([
						{$match : condition },
						{$group : {
							_id  : null,
							total_cash_orders : {$sum : {
								$cond: [
									{$and: [
										{ $eq : ["$payment_method",Constants.CASH_PAYMENT] },
									]},
									"$order_price",
									0
								]}
							},
							total_amount : { $sum: "$order_price" }
						}}
					]).toArray().then(result=>{
						callback(null,result);
					}).catch(next);
				},
				get_orders_count : (callback)=>{
					if(userType != Constants.USER_TYPE_DRIVER || (status != "pick_order" && status != "delivered_order")){
						return callback(null,null);
					}

					/** Get orders count **/
					this.getOrdersCount(req,res,next).then((countResponse)=>{
						if(countResponse.status != Constants.STATUS_SUCCESS) return callback(null,countResponse.message);
						callback(null,countResponse);
					}).catch(next);
				},
				get_restaurant_orders_count : (callback)=>{
					if(userType != Constants.USER_TYPE_RESTAURANT) return callback(null,null);

					/** Get restaurant orders count **/
					this.getRestaurantOrdersCount(req,res,next).then((countResponse)=>{
						if(countResponse.status != Constants.STATUS_SUCCESS) return callback(null,countResponse.message);
						callback(null,countResponse);
					}).catch(next);
				},
				voc_order_details : (callback)=>{
					if(!userId || userType != Constants.USER_TYPE_CUSTOMER) return callback(null,null);

					/** Get voc order details */
					orders.findOne({
						customer_id 	: userId,
						delay_voc_status: Constants.PENDING,
					},{projection:{_id:1,unique_order_id:1},sort:{voc_sent_time:Constants.SORT_DESC}}).then(result=>{
						callback(null,result);
					}).catch(next);
				}
			},(err, response)=>{
				if(err) return next(err);

				let vocOrdersDetails= response.voc_order_details ? response.voc_order_details :{};
				let ordersCountList = response.get_orders_count ? response.get_orders_count :"";
				let restaurantOrdersCountList = response.get_restaurant_orders_count ? response.get_restaurant_orders_count :"";

				/** Set temp object */
				let responseObj = {
					status			: Constants.STATUS_SUCCESS,
					limit			: limit,
					result			: (response && response.orders_list) ? response.orders_list :[],
					records_total	: (response.records_total) ? response.records_total :0,
					voc_order_id	: (vocOrdersDetails._id) ? vocOrdersDetails._id :"",
					voc_unique_order_id:(vocOrdersDetails.unique_order_id)?vocOrdersDetails.unique_order_id :"",
					total_amount: (response.amount_details && response.amount_details[0] && response.amount_details[0].total_amount) ? Helpers.round(response.amount_details[0].total_amount,Constants.ROUND_PRECISION) :0,
					total_cash_collected: (response.amount_details && response.amount_details[0] && response.amount_details[0].total_cash_orders) ? Helpers.round(response.amount_details[0].total_cash_orders,Constants.ROUND_PRECISION) :0,
					restaurant_image_path  : Constants.RESTAURANT_FILE_URL
				};

				if(ordersCountList){
					responseObj.accept_order_count   =  ordersCountList.accept_order_count;
					responseObj.pick_order_count     =	ordersCountList.pick_order_count;
					responseObj.delivery_order_count =	ordersCountList.delivery_order_count
				}

				if(restaurantOrdersCountList){
					responseObj.pending_count   		=  	restaurantOrdersCountList.pending_count;
					responseObj.preparing_count     	=	restaurantOrdersCountList.preparing_count;
					responseObj.on_the_way_count 		=	restaurantOrdersCountList.on_the_way_count
					responseObj.delivered_count		 	=	restaurantOrdersCountList.delivered_count
					responseObj.ready_to_pick_up_count 	= 	restaurantOrdersCountList.ready_to_pick_up_count
				}

				/** Send response **/
				resolve(responseObj);
			});
		}).catch(next);
	};//End getOrdersList()

	/**
	 * Function to get driver orders delivered graph
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	getDeliveredGraph (req,res,next,options={}){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 		= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			options			= !options ? clone(req.body) : options;
			let userId		= (options.user_id) 	? 	options.user_id 	:"";

			var endDate		= (req.body.to_date) 	? Helpers.newDate(req.body.to_date,Constants.DATABASE_DATE_FORMAT) 		: Helpers.newDate("",Constants.DATABASE_DATE_FORMAT);
			var startDate	= (req.body.from_date) 	? Helpers.newDate(req.body.from_date,Constants.DATABASE_DATE_FORMAT)		: Helpers.newDate(subtractDate(HOURS_IN_A_DAY*(DAYS_IN_A_WEEK)),Constants.DATABASE_DATE_FORMAT);
			let fromDate  	= Helpers.newDate(startDate+" "+Constants.START_DATE_TIME_FORMAT);
			let toDate 	  	= Helpers.newDate(endDate+" "+Constants.END_DATE_TIME_FORMAT);

			/** Send error response **/
			if(!userId) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access"),missing_fields : ["user_id"]});

			let commonCondition	=	{
				delivery_status	: Constants.Constants.ORDER_DELIVERED,
				order_date		: { $gte: fromDate, $lte: toDate},
				captain_id		: new ObjectId(userId)
			};

			const orders	=	this.db.collection(Tables.ORDERS);
			orders.aggregate([
				{ $match : commonCondition },
				{ $group : {
					_id  : {$dateToString: {format: Constants.GRAPH_DATE_FORMAT, date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE} },
					count: {$sum: 1 },
					order_date: {$first: "$order_date" },
				}},
				{$sort: {order_date : Constants.SORT_DESC} },
			]).toArray().then(result=>{

				/** Get date range between two dates */
				let datesArray	=	{};
				let graphData 	=	[];
				let dates  		= 	Helpers.getDateRange(new Date(fromDate),new Date(toDate));

				if(result.length > 0){
					result.map((data)=>{
						orderCount	+=	data.total_cash_orders;
						orderAmount	+=	data.total_cash_collected;
						datesArray[data._id] = data.count;
					});
				}

				/** Add count according to date */
				dates.map((record)=>{
					let dateToCheck = 	Helpers.newDate(record,Constants.DATABASE_DATE_FORMAT);
					let count  		=	(datesArray[dateToCheck]) ? datesArray[dateToCheck] :0;
					graphData.push({'date' : dateToCheck,'count' : count});
				});

				/** Send success response */
				resolve({
					status : Constants.STATUS_SUCCESS,
					result : graphData
				});
			}).catch(next);
		}).catch(next);
	};// end getDeliveredGraph()

	/**
	 * Function to place order
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	placeOrder (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 					=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
            let userId					= 	(req.body.user_id)			?	new ObjectId(req.body.user_id)	:"";
            let deviceId				= 	(req.body.device_id)		?	req.body.device_id				:"";
            let orderPrice				=	(req.body.order_price)		?	parseFloat(req.body.order_price):0;
            let orderRestaurantList 	= 	(req.body.order_restaurant_list) ? req.body.order_restaurant_list:[];
			let isWallet 				=	(req.body.is_wallet)		?	JSON.parse(req.body.is_wallet)	:false;
			let isUsedPoints 			=	(req.body.is_used_points)	?	JSON.parse(req.body.is_used_points):false;
            let paymentMethod 			=	(req.body.payment_method) 	?	req.body.payment_method			:"";
            let paymentResponse			= 	(req.body.payment_response)	?	req.body.payment_response		:"";
			let paymentCurrency			= 	(req.body.currency)			?	req.body.currency				:"";
			let deviceType 				= 	(req.body.device_type)		? 	req.body.device_type 			:"";
			let deviceToken 			= 	(req.body.device_token)		?	req.body.device_token			:"";
			let walletDebitAmount		=	(req.body.wallet_amount)	?	parseFloat(req.body.wallet_amount):0;
			let outstandingOrderAmount  = 	(req.body.outstanding_order_amount)? parseFloat(req.body.outstanding_order_amount) :0;
            let missingParameters		=  false;
			let missingObject	 		=  {};
			let pickupBranchList 		=  {};
			let scheduledBranchList 	=  {};
			let tmpOrderRestaurantList 	=  {};

			if(orderRestaurantList.length >0){
				orderRestaurantList.map(records=>{
					let restaurantId    = records.restaurant_id;
					let branchId    	= records.branch_id;
					let areaId    		= records.area_id;
					let addressId    	= records.address_id;
					let latitude    	= records.latitude;
					let longitude    	= records.longitude;
					let deliveryBy     	= records.delivery_by;
					let isSchedule     	= (records.is_schedule)?JSON.parse(records.is_schedule)	 :false;

					if(isSchedule && restaurantId && branchId){
						if(!scheduledBranchList[restaurantId]) scheduledBranchList[restaurantId] ={};
						if(!scheduledBranchList[restaurantId][branchId]) scheduledBranchList[restaurantId][branchId] ={};

						scheduledBranchList[restaurantId][branchId] = branchId;
					}

					if(deliveryBy != Constants.DELIVERY_BY_PICK_UP){
						if(!branchId || !latitude || !longitude  || (userId && !addressId)){
							missingParameters = true;

							if(!branchId) missingObject.branch_id = true;
							if(!latitude)  missingObject.latitude = true;
							if(!longitude) missingObject.longitude = true;
							if(userId && !addressId) missingObject.address_id = true;
						}
					}else{
						if(!pickupBranchList[restaurantId]) pickupBranchList[restaurantId] ={};

						pickupBranchList[restaurantId] = branchId;
					}

					if(!restaurantId || !areaId){
						missingParameters = true;

						if(!restaurantId) missingObject.restaurant_id = true;
						if(!areaId) missingObject.area_id = true;
					}else{
						if(!tmpOrderRestaurantList[restaurantId]) tmpOrderRestaurantList[restaurantId] ={};
						if(!tmpOrderRestaurantList[restaurantId][branchId]) tmpOrderRestaurantList[restaurantId][branchId] ={};

						tmpOrderRestaurantList[restaurantId][branchId] = records;
					}
				});
			}

			/** Payment missing parameter */
			if(paymentMethod != Constants.CASH_PAYMENT && paymentMethod != Constants.WALLET_PAYMENT){
				if(!paymentResponse || !paymentCurrency || !orderPrice){
					missingParameters = true;

					if(!paymentResponse) missingObject.payment_response = true;
					if(!paymentCurrency) missingObject.currency = true;
					if(!orderPrice) missingObject.order_price = true;
				}
			}

			/** Send error response **/
			if((!userId && !deviceId) || missingParameters || !paymentMethod || orderRestaurantList.length <=0){
				if(!userId && !deviceId) 				missingObject.user_device = true;
				if(orderRestaurantList.length <=0) 		missingObject.restaurant_list = true;
				if(!paymentMethod) 						missingObject.payment_method = true;
				return resolve({status: Constants.STATUS_ERROR, message:res.__("system.invalid_access"), missing_object : missingObject});
			}

			let errors 			 	= 	[];
			let guestAddressList 	= 	{};
			let tmpGuestMobileNum	=	"";
			let validNumberRegx 	= 	/^[0-9]+$/;
			let validFloatRegx 		= 	/^[0-9]+([.][0-9]+)?$/;
			Object.keys(tmpOrderRestaurantList).map(tmpRestaurantId=>{
				Object.keys(tmpOrderRestaurantList[tmpRestaurantId]).map(tmpBranchId=>{
					let records		  = tmpOrderRestaurantList[tmpRestaurantId][tmpBranchId];
					let isSchedule	  = (records.is_schedule)	 ? JSON.parse(records.is_schedule)	:false;
					let scheduledTime = (records.scheduled_time) ? records.scheduled_time			:"";
					let mobileNumber  = (records.mobile_number)  ? records.mobile_number			:"";
					let latitude	  = (records.latitude)  	? 	records.latitude				:"";
					let longitude	  = (records.longitude)  	? 	records.longitude				:"";
					let deliveryBy	  = (records.delivery_by)  	? 	records.delivery_by				:"";

					if(isSchedule && !scheduledTime){
						errors.push({'param':'scheduled_time','msg':res.__("orders.select_scheduled_time")});
					}

					if(!userId){
						if(mobileNumber) tmpGuestMobileNum = mobileNumber;

						if(!records.first_name){
							errors.push({'param':'first_name','msg':res.__("customer_address.please_enter_first_name")});
						}

						if(!records.last_name){
							errors.push({'param':'last_name','msg':res.__("customer_address.please_enter_last_name")});
						}

						if(!mobileNumber){
							errors.push({'param':'mobile_number','msg':res.__("customer_address.please_enter_mobile_number")});
						}else if(!validNumberRegx.test(mobileNumber)){
							errors.push({'param':'mobile_number','msg':res.__("customer_address.invalid_phone_number")});
						}
					}

					if(deliveryBy != Constants.DELIVERY_BY_PICK_UP){
						if(!latitude){
							errors.push({'param':'latitude','msg':res.__("customer_address.please_enter_latitude")});
						}else if(!validFloatRegx.test(latitude)){
							errors.push({'param':'latitude','msg':res.__("customer_address.please_enter_valid_latitude")});
						}

						if(!longitude){
							errors.push({'param':'longitude','msg':res.__("customer_address.please_enter_longitude")});
						}else if(!validFloatRegx.test(longitude)){
							errors.push({'param':'longitude','msg':res.__("customer_address.please_enter_valid_longitude")});
						}

						if(!records.city_id){
							errors.push({'param':'city_id','msg':res.__("customer_address.please_select_city")});
						}

						if(!records.area_id){
							errors.push({'param':'area_id','msg':res.__("customer_address.please_select_area")});
						}

						if(!records.address_type){
							errors.push({'param':'address_type','msg':res.__("customer_address.please_enter_address_type")});
						}

						if(!records.block_id){
							errors.push({'param':'block_id','msg':res.__("customer_address.please_select_block")});
						}

						if(!records.street){
							errors.push({'param':'street','msg':res.__("customer_address.please_enter_street")});
						}
					}

					if(errors.length <=0){
						if(!guestAddressList[mobileNumber]) guestAddressList[mobileNumber] ={};
						guestAddressList[mobileNumber] = records;
					}
				});
			});

			/** Send error response */
			if(errors && errors.length >0) return resolve({status: Constants.STATUS_ERROR, message: errors});

			let firstGuestId = "";
			const users = this.db.collection(Tables.USERS);
			asyncParallel({
				unique_order_id: (parentCallback)=>{
					/** get order unique id **/
					Helpers.getUniqueId(req,res,next,{type:"main_order_id"}).then(uniqueIdResponse=>{
						parentCallback(null,uniqueIdResponse.result);
					}).catch(next);
				},
				order_list: (parentCallback)=>{
					/** Get cart list */
					let cartOptions 					=	clone(req.body);
					cartOptions.is_place_order 			= 	true;
					cartOptions.pickup_branch_list 		= 	pickupBranchList;
					cartOptions.scheduled_branch_list 	=	scheduledBranchList;
					this.userCartAPI.getUserCartList(req,res,next,cartOptions).then(response=>{
						parentCallback(null,response);
					}).catch(next);
				},
				guest_details: (parentCallback)=>{
					if(userId || Object.keys(guestAddressList).length <= 0) return parentCallback(null);

					let guestAddressIds 		=	{};
					const customer_addresses	=	this.db.collection(Tables.CUSTOMER_ADDRESSES);
					asyncEach(guestAddressList, (records, asyncEachCallback)=> {
						let firstName 	=	(records.first_name) 	?	records.first_name		:"";
						let lastName 	=	(records.last_name) 	?	records.last_name		:"";
						let mobileNumber=	(records.mobile_number) ?	records.mobile_number	:"";
						let latitude	=	(records.latitude)  	?	parseFloat(records.latitude):0;
						let longitude	=	(records.longitude) 	?	parseFloat(records.longitude):0;
						let deliveryBy	= 	(records.delivery_by)  	? 	records.delivery_by		:"";

						/** Check user details */
						users.findOne({
							mobile_number:  mobileNumber,
							is_deleted 	 : 	Constants.NOT_DELETED,
						},{projection: {_id:1}}).then(guestResult=>{

							let guestId	 = (guestResult) 	? 	guestResult._id	:"";
							firstGuestId = (!firstGuestId)	?	guestId			:firstGuestId;

							asyncParallel({
								guest_details: (childCallback)=>{
									if(guestId) return childCallback(null);

									/** Set user update data */
									let userUpdatedData = {
										first_name 			: firstName,
										last_name 			: lastName,
										full_name			: firstName+' '+ lastName,
										user_role_id		: CUSTOMER,
										phone_country_code 	: Constants.DEFAULT_COUNTRY_CODE,
										mobile_number 		: mobileNumber,
										user_type			: Constants.USER_TYPE_OTHER,
										is_guest			: true,
										active 				: Constants.ACTIVE,
										is_deleted 			: Constants.NOT_DELETED,
										created 			: Helpers.getUtcDate(),
										modified   			: Helpers.getUtcDate()
									};

									if(deviceType && deviceToken){
										userUpdatedData.device_details = [{
											device_type 	: deviceType.toLowerCase(),
											device_token	: deviceToken,
										}];
									}

									/** Save guest data */
									users.insertOne(userUpdatedData).then(userResult=>{
										guestId = (userResult && userResult.insertedId) ?userResult.insertedId :"";

										if(deviceType && deviceToken) firstGuestId = guestId;
										childCallback(null,guestId);
									}).catch(next);
								},
							},(childErr)=>{
								if(childErr) return asyncEachCallback(childErr);

								asyncParallel({
									address_id: (addressCallback)=>{
										if(deliveryBy == Constants.DELIVERY_BY_PICK_UP) return addressCallback(null,null);

										/** Save address data **/
										customer_addresses.insertOne({
											first_name		:	firstName,
											last_name		:	lastName,
											mobile_number	:	mobileNumber,
											landline_number	:	records.landline_number,
											latitude		:	latitude,
											longitude		:	longitude,
											long_lat		:	[latitude,longitude],
											area_id			:	new ObjectId(records.area_id),
											block_id		:	new ObjectId(records.block_id),
											city_id			:	new ObjectId(records.city_id),
											address_type	:	records.address_type,
											street			:	records.street,
											venue			:	records.venue,
											jadda         	: 	records.jadda,
											address_title 	: 	records.address_title,
											building_number : 	records.building_number,
											floor_number	:	records.floor_number,
											flat_number		:	records.flat_number,
											country 		:	Constants.COUNTRY_NAME,
											device_id		: 	deviceId,
											user_id			: 	guestId,
											created 		: 	Helpers.getUtcDate(),
											modified   		: 	Helpers.getUtcDate(),
											additional_directions:	records.additional_directions,
										}).then(addressResult=>{
											let guestAddressId = (addressResult && addressResult.insertedId) ?	addressResult.insertedId :"";
											addressCallback(null, guestAddressId);
										}).catch(next);
									}
								},(addressErr, addressRes)=>{
									if(addressErr) return asyncEachCallback(addressErr);

									let guestAddressId = addressRes.address_id;
									if(!guestAddressIds[mobileNumber]) guestAddressIds[mobileNumber] ={};
									guestAddressIds[mobileNumber] = {
										guest_id 	: 	guestId,
										address_id 	:	guestAddressId,
									};

									asyncEachCallback(null);
								});
							});
						}).catch(next);
					},(asyncEachErr)=> {
						parentCallback(asyncEachErr,guestAddressIds);
					});
				},
				guest_total_orders : (callback)=>{
					if(userId) return callback(null,0);

					/** Get order count  */
					const orders = 	this.db.collection(Tables.ORDERS);
					orders.countDocuments({device_id: deviceId}).then(orderCount=>{
						callback(null,orderCount);
					}).catch(next);
				},
				user_details: (callback)=>{
					if(!userId) return callback(null,null);

					/** Get user details  */
					users.findOne({_id: userId },{projection:{mobile_number:1,revert_orders:1}}).then(userDetails=>{
						callback(null,userDetails);
					}).catch(next);
				},
				today_order_count: (callback)=>{
					/** Get order count  */
					let currentDate = Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));
					const unique_order_ids = this.db.collection(Tables.UNIQUE_ORDER_IDS);
					unique_order_ids.findOneAndUpdate({
						order_date: {$gte: currentDate},
					},
					{
						$inc : {
							order_count: 1
						},
						$setOnInsert: {
							order_date : currentDate,
						}
					},{upsert:true, projection :{order_count: 1}}).then(orderCount=>{
						orderCount = (orderCount?.order_count || 0)+1;
						callback(null,orderCount);
					}).catch(next);
				},
				admin_details : (callback)=>{
					/** Get user details */
					users.findOne({user_role_id : Constants.SYSTEM_ADMIN_ROLE_ID },{projection:{_id:1}}).then(result=>{
						callback(null, result);
					}).catch(next);
				},
			},(parentErr,parentResponse)=>{
				if(parentErr) return next(parentErr);

				/** Send error response */
				if(parentResponse.order_list.status != Constants.STATUS_SUCCESS) return resolve(parentResponse.order_list);

				let adminDetails 		= 	parentResponse.admin_details;
				let adminUserId 		= 	(adminDetails && adminDetails._id) ? adminDetails._id :"";
				let allOrderUniqueId 	= 	parentResponse.unique_order_id;
				let orderList  			=	parentResponse.order_list.result;
				let grandTotal 			=	parentResponse.order_list.grand_total;
				let guestList 			=	parentResponse.guest_details;
				let userDetails 		=	parentResponse.user_details;
				let guestTotalOrders 	=	parentResponse.guest_total_orders;
				let todayOrderCount 	=	(parentResponse.today_order_count) ? parentResponse.today_order_count :1;
				let userMobileNumber 	=	(userDetails && userDetails.mobile_number) ? userDetails.mobile_number :"";
				let userRevertOrders 	=	(userDetails && userDetails.revert_orders) ? userDetails.revert_orders :[];

				/** Send error response **/
				if(orderList.length <=0) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again"), parentResponse: parentResponse });

				/** Check all branch or item available or not */
				let missingDetails		=   false;
				let branchAvailable 	= 	true;
				let itemAvailable		=	true;
				orderList.map(records=>{
					let restaurantId 	= 	records.restaurant_id;
					let branchId 	 	=	records.branch_id;
					if(!records.branch_available)  	branchAvailable = false;
					if(records.branch_open != Constants.OPEN) branchAvailable = false;

					if(!tmpOrderRestaurantList[restaurantId] || !tmpOrderRestaurantList[restaurantId][branchId]){
						missingDetails = true;
					}

					records.item_list.map(itemData=>{
						if(!itemData.item_available)  itemAvailable = false;
					});
				});

				/** Send error response **/
				if(missingDetails){
					return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access"), missing_details: true});
				}

				/** Send error response **/
				if(!branchAvailable || !itemAvailable){
					let message = (!branchAvailable) ? res.__("order.branch_not_available") : res.__("order.item_not_available");
					return resolve({status: Constants.STATUS_ERROR, message: message});
				}

				asyncParallel({
					invoice_number : (invoiceCallback)=>{
						/** get invoice unique number **/
						Helpers.getUniqueId(req,res,next,{
							type 			:	"order_invoice_number",
							platform 		: 	deviceType,
							client_number	: 	(userMobileNumber) ? userMobileNumber :tmpGuestMobileNum,
						}).then(uniqueIdResponse=>{
							invoiceCallback(null,uniqueIdResponse.result);
						}).catch(next);
					},
				},(invoiceErr,invoiceResponse)=>{
					if(invoiceErr) return next(invoiceErr);

					let invoiceNumber 	= 	invoiceResponse.invoice_number;
					let pointsPerAmount =	(res.locals.settings["Points_system.points_per_amount"]) ?	parseFloat(res.locals.settings["Points_system.points_per_amount"])	:0;
					let amountPerPoints =	(res.locals.settings["Points_system.amount_per_points"]) ?	parseFloat(res.locals.settings["Points_system.amount_per_points"])	:0;

					const orders 		= 	this.db.collection(Tables.ORDERS);
					const users 		= 	this.db.collection(Tables.USERS);
					const order_details = 	this.db.collection(Tables.ORDER_DETAILS);
					const order_items	= 	this.db.collection(Tables.ORDER_ITEMS);
					const tmp_offer_logs= 	this.db.collection(Tables.TMP_OFFER_LOGS);
					const offer_logs	= 	this.db.collection(Tables.OFFER_LOGS);
					const user_carts 	= 	this.db.collection(Tables.USER_CARTS);

					let remainingAmount 	= 	0;
					let paymentOrderIds 	=	[];
					let paymentCartIds 		=	[];
					let orderIdsArray		=	[];
					eachOfSeries(orderList, (records,index, eachCallback)=> {
						let restaurantId 	= 	records.restaurant_id;
						let branchId 	 	=	records.branch_id;
						let areaId 	 	 	=	records.area_id;
						let itemList 	 	=	records.item_list;
						let totalAmount 	=	records.total_amount;
						let restConceptId 	= 	records.concept_id;
						let packageId 	 	=	(records.package_id)		 ? new ObjectId(records.package_id):"";
						let restaurantName	=	(records.restaurant_name) 	 ? records.restaurant_name 	  :"";
						let isDoubleCashback=	(records.is_double_cashback) ? records.is_double_cashback :"";
						let tmpOrderDetails = 	clone(tmpOrderRestaurantList[restaurantId][branchId]);
						let orderId			=	new ObjectId();
						let orderNetAmount	=	0;

						/** Only KFG -  Change branch id if current branch does not covered address blocks  */
						if(records.block_branch_id) branchId = records.block_branch_id;

						itemList.map(itemData=>{
							orderNetAmount += itemData.sub_price;
						});

						let note			= 	(tmpOrderDetails.note) ? tmpOrderDetails.note :"";
						let addressId 		=	(tmpOrderDetails.address_id)?new ObjectId(tmpOrderDetails.address_id) :"";
						let deliveryAreaId 	= 	(tmpOrderDetails.area_id)?new ObjectId(tmpOrderDetails.area_id) :"";
						let address 		=	(tmpOrderDetails.address) ? tmpOrderDetails.address	:"";
						let latitude 		=	(tmpOrderDetails.latitude) ? parseFloat(tmpOrderDetails.latitude)	:0;
						let longitude 		=	(tmpOrderDetails.longitude) ? parseFloat(tmpOrderDetails.longitude)	:0;
						let isSchedule	  	= 	(tmpOrderDetails.is_schedule) ? JSON.parse(tmpOrderDetails.is_schedule)	:false;
						let scheduledTime 	=	(tmpOrderDetails.scheduled_time) ? tmpOrderDetails.scheduled_time	:"";
						let mobileNumber  	=	(tmpOrderDetails.mobile_number)  ? tmpOrderDetails.mobile_number 	:"";
						let guestId			=	"";
						let guestAddressId	=	"";

						if(guestList && guestList[mobileNumber]){
							guestId		   = guestList[mobileNumber].guest_id;
							guestAddressId = guestList[mobileNumber].address_id;

							if(guestList[mobileNumber].address_id){
								addressId	   = guestList[mobileNumber].address_id;
							}
						}

						let finalWalletDebitAmount = 0;
						asyncParallel({
							unique_order_id: (parentCallback)=>{
								/** Set unqiue id options */
								let orderUnqiueOptions = {
									type 		: Tables.ORDERS,
									order_count : todayOrderCount+index,
								};

								/** get order unqiue id **/
								Helpers.getUniqueId(req,res,next,orderUnqiueOptions).then(uniqueIdResponse=>{
									parentCallback(null,uniqueIdResponse.result);
								}).catch(next);
							},
							transaction_id : (parentCallback)=>{
								/** get transaction unqiue id **/
								Helpers.getUniqueId(req,res,next,{type:Tables.ORDER_DETAILS}).then(uniqueIdResponse=>{
									parentCallback(null,uniqueIdResponse.result);
								}).catch(next);
							},
							update_wallet: (parentCallback)=>{
								if(!walletDebitAmount || walletDebitAmount<= 0 || !userId || totalAmount<= 0){
									remainingAmount += totalAmount;
									return parentCallback(null);
								}

								let tmpDebitAmount =  0;
								if(walletDebitAmount >= totalAmount){
									walletDebitAmount = walletDebitAmount-totalAmount;
									tmpDebitAmount 	  = totalAmount;
								}else{
									tmpDebitAmount 	  = walletDebitAmount;
									walletDebitAmount = 0;
								}

								/** Set wallet options */
								finalWalletDebitAmount = tmpDebitAmount;
								let walletOptions = {
									user_id      	: userId,
									amount       	: tmpDebitAmount,
									transaction_type: Constants.DEBIT,
									order_id		: allOrderUniqueId,
									is_used_points	: isUsedPoints,
									is_double_cashback: isDoubleCashback,
									extra_parameters:{
										order_id 		: orderId,
										branch_id 		: branchId,
										restaurant_id 	: restaurantId,
										order_place 	: true,
									}
								};

								/** Update wallet  */
								Helpers.updateWalletBalance(req,res,next,walletOptions).then(walletResponse=>{
									if(walletResponse.status != Constants.STATUS_SUCCESS) return parentCallback(walletResponse);

									remainingAmount += (walletResponse.remaining_amount) ? walletResponse.remaining_amount :0;

									parentCallback(null,walletResponse.transaction_id);
								}).catch(next);
							},
							allow_cashback: (parentCallback)=>{
								if(isWallet || paymentMethod == Constants.WALLET_PAYMENT || totalAmount <= 0) return parentCallback(null,null);

								/** Check branch accept cashback payment */
								const restaurant_branch_attributes = this.db.collection(Tables.RESTAURANT_BRANCH_ATTRIBUTES);
								restaurant_branch_attributes.findOne({
									branch_id	 :	branchId,
									restaurant_id:	restaurantId,
									attribute_id : 	Constants.BRANCH_OFFERS_CASHBACK_ATTRIBUTE_ID,
								},{projection:{value:1}}).then(attributeResult=>{
									let pointsAllow = (attributeResult && attributeResult.value && parseInt(attributeResult.value) == Constants.ACCEPT) ? true :false;

									parentCallback(null, pointsAllow);
								}).catch(next);
							},
						},(parentParallelErr,parentParallelResponse)=>{
							if(parentParallelErr) return eachCallback(parentParallelErr);

							let allowCashback 	= 	parentParallelResponse.allow_cashback;
							let uniqueOrderId 	= 	parentParallelResponse.unique_order_id;
							let transactionId 	= 	parentParallelResponse.transaction_id;
							let isBigOrder 	  	= 	(orderNetAmount >= Constants.BIG_ORDER_AMOUNT) ? true :false;
							let orderStatus    	= 	(isSchedule) ?  Constants.ORDER_SCHEDULED :Constants.ORDER_SUBMITTED;
							let deliveryTime	=	(records.delivery_time) 	? 	records.delivery_time		:Constants.DEFAULT_DELIVERY_TIME;
							let preparationTime	=	(records.preparation_time) 	?	records.preparation_time	:Constants.DEFAULT_PREPARATION_TIME;
							let deliveryType	=	records.delivery_by;
							let tmpScheduledDate= 	"";

							if(isBigOrder) orderStatus = Constants.ORDER_PENDING;

							/** Manage schedule date */
							if(isSchedule){
								tmpScheduledDate 	=	Helpers.getUtcDate(scheduledTime);
								let tmpExpectTime 	=	preparationTime+(deliveryType != Constants.DELIVERY_BY_PICK_UP ? deliveryTime :0);
								let diffMins 		=	Helpers.getDifferenceBetweenTwoDatesInMinute(Helpers.getUtcDate(),tmpScheduledDate)-tmpExpectTime;
								if(diffMins > 0){
									tmpScheduledDate = Helpers.getUtcDate(Helpers.addMinute(diffMins));
								}
							}

							/** Set order save details  */
							let orderSaveData = {
								unique_order_id	: 	uniqueOrderId,
								invoice_number  :   invoiceNumber,
								captain_id		:	"",
								delivery_type	:	deliveryType,
								scheduled_date 	:   tmpScheduledDate,
								order_date		: 	(isSchedule) ? Helpers.getUtcDate(scheduledTime)	:Helpers.getUtcDate(),
								request_note	:	note,
								last_status_updated_on: Helpers.getUtcDate(),
								branch_id	 	: 	branchId,
								area_id		 	: 	areaId,
								area_name		 : 	(records.area_name) ? records.area_name :{},
								payment_method	: 	paymentMethod,
								restaurant_id 	: 	restaurantId,
								restaurant_name : 	restaurantName,
								order_price		:	totalAmount,
								net_amount		:	Helpers.round(orderNetAmount,Constants.CURRENCY_ROUND_PRECISION),
								order_status	: 	orderStatus,
								is_confirm		:	false,
								kfg_order		:	(restConceptId) ? true :false,
								queue_time		:	Helpers.getUtcDate(),
								number_of_queue : 	Constants.FIRST_REQUEUE_ORDER,
								delivery_fee	: 	records.delivery_fees,
								main_order_id	:	allOrderUniqueId,
								is_big_order	:	isBigOrder,
								amount_debited_by_wallet: finalWalletDebitAmount,
								kfg_offer_id	:	(records.kfg_offer_id) 	 ?	records.kfg_offer_id 	:"",
								kfg_offer_name	:	(records.kfg_offer_name) ? 	records.kfg_offer_name 	:"",
								created			:	Helpers.getUtcDate(),
								modified		:	Helpers.getUtcDate(),
							};

							if(isSchedule) 			orderSaveData.is_schedule	=	true;
							if(records.partners) 	orderSaveData.partners 		= 	records.partners;

							if(paymentMethod == Constants.KNET){
								let knetValue	=	(res.locals.settings['Site.knet_charges']) ? res.locals.settings['Site.knet_charges'] :0;
								let knetCharges	=  (knetValue) ?(totalAmount * knetValue)/Constants.MAX_PERCENTAGE :0;

								orderSaveData.knet_charges		=	Helpers.round(knetCharges,Constants.CURRENCY_ROUND_PRECISION);
								orderSaveData.total_knet_amount	=	totalAmount;
							}

							if(userId){
								orderSaveData.customer_id 	=	userId;
							}else{
								orderSaveData.device_id 	= 	deviceId;
								if(guestId){
									orderSaveData.customer_id 	= 	guestId;
									orderSaveData.is_guest 		= 	true;
								}
							}

							/** Save package details  */
							if(packageId){
								orderSaveData.package_id 			= 	packageId;
								orderSaveData.package_delivery_fees =	records.package_delivery_fees;
								orderSaveData.is_infinity_user 		=	true;
							}

							/** Save order details */
							orders.updateOne({_id: orderId },{$set: orderSaveData},{upsert: true}).then(()=>{

								/** update customer details*/
								this.updateCustomerDetailsInOrder(req,res,next,{
									order_id 	: orderId,
									customer_id	: userId ? userId : guestId
								}).then(()=>{});

								/** generate pdf*/
								this.generateOrderPdfs(req,res,next,{
									order_id		: orderId,
									unique_order_id	: uniqueOrderId
								}).then(()=>{});

								/** Push order id and restaurant id in array */
								orderIdsArray.push({
									order_id 		: orderId,
									restaurant_id	: restaurantId,
									unique_order_id	: uniqueOrderId,
									is_schedule 	: isSchedule,
									order_status 	: orderStatus,
									is_big_order	: isBigOrder,
									rest_concept_id	: restConceptId,
								});

								paymentOrderIds.push(orderId);

								asyncParallel({
									order_details : (callback)=>{
										let restaurantLatitude	=	records.branch_latitude;
										let restaurantLongitude	=	records.branch_longitude;

										/** Set order details  */
										let orderDetailsData = {
											order_id			:	orderId,
											unique_order_id		:	uniqueOrderId,
											transaction_id		:	transactionId,
											customer_address_id	:	addressId,
											delivery_area_id	: 	deliveryAreaId,
											customer_address	:	address,
											customer_latitude	:	latitude,
											customer_longitude	:	longitude,
											customer_long_lat	:	[longitude,latitude],
											restaurant_address	:	records.branch_address,
											restaurant_latitude : 	restaurantLatitude,
											restaurant_longitude: 	restaurantLongitude,
											restaurant_long_lat	:	[restaurantLongitude,restaurantLatitude],
											total_amount		: 	totalAmount,
											net_amount			: 	Helpers.round(orderNetAmount,Constants.CURRENCY_ROUND_PRECISION),
											discount_price		: 	(records.discount) ? records.discount :0,
											offer_id			: 	records.offer_id,
											offer_code			: 	(records.offer_code)?records.offer_code :"",
											offer_type			: 	(records.offer_type)?records.offer_type :"",
											delivery_fee		: 	records.delivery_fees,
											additional_tax		: 	records.additional_tax,
											payment_method		: 	paymentMethod,
											delivery_duration	: 	deliveryTime,
											elapsed_time		: 	deliveryTime,
											preparation_time	: 	preparationTime,
											remaining_preparation_time	: 	preparationTime,
											remaining_delivery_duration	: 	deliveryTime,
										};

										if(records.additional_tax_percentage){
											orderDetailsData.additional_tax_percentage =	records.additional_tax_percentage;
										}

										if(records.offer_discount){
											orderDetailsData.offer_discount =	records.offer_discount;
										}
										if(records.offer_delivery_fees){
											orderDetailsData.offer_delivery_fees =	records.offer_delivery_fees;
										}

										if(userId){
											orderDetailsData.customer_id =	userId;
										}else{
											orderDetailsData.device_id 	 = 	deviceId;
											if(guestId) orderDetailsData.customer_id = 	guestId;
											if(guestAddressId){
												orderDetailsData.customer_address_id = 	guestAddressId;
											}
										}

										if(records.composite_id){
											orderDetailsData.composite_id =	new ObjectId(records.composite_id);

											if(records.composite_discount){
												orderDetailsData.composite_discount =	records.composite_discount;
											}
											if(records.composite_delivery_fees){
												orderDetailsData.composite_delivery_fees =	records.composite_delivery_fees;
											}
										}

										if(records.corporate_id){
											orderDetailsData.corporate_id =	new ObjectId(records.corporate_id);

											if(records.corporate_discount){
												orderDetailsData.corporate_discount =	records.corporate_discount;
											}
											if(records.corporate_delivery_fees){
												orderDetailsData.corporate_delivery_fees =	records.corporate_delivery_fees;
											}
										}

										if(records.branch_extra_charge_type){
											orderDetailsData.branch_extra_charge =	records.branch_extra_charge;
											orderDetailsData.branch_extra_charge_type =	records.branch_extra_charge_type;
										}

										if(records.branch_discount_type){
											orderDetailsData.branch_discount =	records.branch_discount;
											orderDetailsData.branch_discount_type =	records.branch_discount_type;
										}

										/** Save order details */
										order_details.insertOne(orderDetailsData).then(()=>{
											callback(null);

											/** Update customer address*/
											this.updateCustomerAddressInOrder(req,res,next,{
												order_id 	: orderId,
												address_id	: addressId
											}).then(()=>{});
										}).catch(next);
									},
									order_items : (callback)=>{

										/** Manage item save data */
										let itemSaveData = [];
										itemList.map(itemData=>{
											let itemDiscount = (itemData.discount) 	? itemData.discount  :0;
											let subPrice 	 = (itemData.sub_price)	? itemData.sub_price :0;

											let tempObj = {
												order_id 		: 	orderId,
												parent_item_id 	: 	itemData.parent_item_id,
												qty 			: 	itemData.qty,
												item_name 		: 	itemData.item_name,
												item_image 		:	itemData.item_image,
												item_id 		: 	itemData.item_id,
												unit_id 		: 	itemData.unit_id,
												dough_id 		: 	itemData.dough_id,
												selector_id 	: 	itemData.selector_id,
												item_type 		:	itemData.item_type,
												note 			:	itemData.note,
												item_main_price :	itemData.item_main_price,
												cuisine_ids: (itemData.cuisine_ids) ? itemData.cuisine_ids :[],
												extra_items 	:	[],
												price			:	itemData.item_price,
												sub_total		:	Helpers.round((subPrice-itemDiscount),Constants.CURRENCY_ROUND_PRECISION),
												discounted_price:	itemDiscount,
												net_amount		:	subPrice,
												created 		:	Helpers.getUtcDate(),
												cart_created	:	itemData.created
											};

											if(itemData.item_unit_id){
												tempObj.item_unit_id =itemData.item_unit_id;
											}

											if(itemData.unit_lists && itemData.unit_lists.length >0){
												tempObj.unit_lists = itemData.unit_lists;
											}

											/** Manage extra items  */
											if(itemData.extra_items && itemData.extra_items.length >0){
												itemData.extra_items.map(extraItemData=>{
													let groupId = extraItemData.group_id;

													extraItemData.extra_item_ids.map(exItemData=>{

														tempObj.extra_items.push({
															group_id			:	groupId,
															extra_item_id		:	exItemData.extra_item_id,
															is_first_component	:	exItemData.is_first_component,
															extra_item_group_id	:	exItemData.extra_group_item_id,
															extra_item_name		:	exItemData.extra_item_name,
															price				:	exItemData.extra_fees
														});
													});
												});
											}

											itemSaveData.push(tempObj);
										});

										/** Save order item details */
										order_items.insertMany(itemSaveData).then(()=>{
											callback(null);
										}).catch(next);
									},
									remove_offer_logs : (callback)=>{
										let cartIds = [];
										itemList.map(itemData=>{
											cartIds.push(itemData._id);

											paymentCartIds.push(itemData._id);
										});

										asyncParallel({
											remove_offer_logs : (subCallback)=>{
												/** Delete logs  */
												tmp_offer_logs.deleteMany({
													cart_ids : {$in: cartIds}
												}).then(()=>{
													subCallback(null);
												}).catch(next);
											},
											update_order_id : (subCallback)=>{
												/** update logs  */
												offer_logs.updateMany({
													cart_ids : {$in: cartIds}
												},
												{
													$set: {
														order_id : orderId,
														modified : Helpers.getUtcDate(),
													},
													$unset: {
														cart_ids : 1
													},
												}).then(()=>{
													subCallback(null);
												}).catch(next);
											},
											remove_cart : (subCallback)=>{
												/** Remove carts  */
												user_carts.deleteMany({_id: {$in: cartIds} }).then(()=>{
													subCallback(null);

													/**to Update order posting status */
													const abandoned_carts_reports = this.db.collection(Tables.ABANDONED_CARTS_REPORTS);
													abandoned_carts_reports.updateMany({
														cart_ids: { $in: cartIds }
													},
													{$set: {
														modified : Helpers.getUtcDate(),
														order_posting_status: Constants.ORDERED
													}}).then(()=>{ });
												}).catch(next);
											},
											update_order_id : (subCallback)=>{
												/** To update order  */
												const supplier_invoice_logs = this.db.collection(Tables.SUPPLIER_INVOICE_LOGS);
												supplier_invoice_logs.updateMany({
													cart_ids: { $in: cartIds }
												},
												{
													$set: {
														modified : Helpers.getUtcDate(),
													},
													$addToSet: {
														order_ids 		: orderId,
														unique_order_id : uniqueOrderId,
													}
												}).then(()=>{
													subCallback(null);
												}).catch(next);
											},
										},(subParallelErr)=>{
											callback(subParallelErr);
										});
									},
									update_package_details : (callback)=>{
										if(!userId || !packageId) return callback(null);

										users.updateOne({
											_id			: userId,
											package_id	: packageId,
											remaining_package_orders: {$gt: 0}
										},
										{$inc: {
											remaining_package_orders : -1
										}}).then(()=>{
											callback(null);
										}).catch(next);
									},
									add_cashback : (callback)=>{
										let cashBackAmount	  = totalAmount-finalWalletDebitAmount;
										if(!allowCashback || !pointsPerAmount || !userId || cashBackAmount<=0){
											return callback(null);
										}

										let totalCreditPoints = Helpers.round(cashBackAmount*pointsPerAmount);
										if(isDoubleCashback){
											totalCreditPoints += totalCreditPoints;
										}

										/** Set points options */
										let creditOptions = {
											user_id 		:	userId,
											amount 			: 	totalCreditPoints*amountPerPoints,//
											wallet_type  	: 	Constants.CASHBACK_AMOUNT,  //cashback
											transaction_type: 	Constants.CREDIT,
											order_id		: 	allOrderUniqueId,
											extra_parameters:{
												order_id 			: orderId,
												branch_id 			: branchId,
												restaurant_id 		: restaurantId,
												order_place 		: true,
												is_double_cashback 	: isDoubleCashback,
											},
										};

										/** Add points in wallet */
										Helpers.updateWalletBalance(req,res,next,creditOptions).then(()=>{
											callback(null);
										}).catch(next);
									},
								},(asyncParallelErr)=>{
									eachCallback(asyncParallelErr);
								});
							}).catch(next);
						});
					},(eachErr)=> {
						if(eachErr) return next(eachErr);

						let allOrderIds = [];
						let allUniqueOrderIds = [];
						orderIdsArray.map(records=>{
							allUniqueOrderIds.push(records.unique_order_id);
							allOrderIds.push(records.order_id);
						});

						asyncParallel({
							update_outstanding_details: (parentCallback)=>{
								if(!userId || !outstandingOrderAmount || outstandingOrderAmount <=0 || userRevertOrders.length <= 0 || paymentMethod == Constants.CASH_PAYMENT){
									return parentCallback(null);
								}

								/** Get pay outstanding amount **/
								this.payUserOrderOutstanding(req,res,next,{user_id: userId}).then(()=>{
									parentCallback(null);
								}).catch(next);
							},
							running_orders: (parentCallback)=>{
								/** Get customer running order list **/
								req.body.order_ids = allOrderIds;
								this.getCustomerRunningOrderList(req,res,next).then(runningResponse=>{
									let runningOrder = (runningResponse.result) ? runningResponse.result :[];
									parentCallback(null, runningOrder);
								}).catch(next);
							},
							update_gateway_charges: (parentCallback)=>{
								asyncEach(allOrderIds, (order_id, itemEachCallback)=> {
									req.body.order_id = order_id;

									this.updatePaymentMethodCharges(req,res,next,{order_id : order_id}).then(updateResponse=>{
										if(updateResponse.status != Constants.STATUS_SUCCESS) return itemEachCallback(updateResponse.message);
										itemEachCallback(null);
									}).catch(next);
								},(itemEachErr)=> {
									parentCallback(itemEachErr);
								});
							},
						},(asyncParallelErr,asyncParallelRes)=>{

							let runningOrder = (asyncParallelRes.running_orders)? asyncParallelRes.running_orders :[];

							/** Send success response  */
							resolve({status: Constants.STATUS_SUCCESS, message: res.__("order.order_has_been_placed_successfully"), remaining_amount : remainingAmount,order_number: allUniqueOrderIds, running_orders : runningOrder });

							/** Save order type */
							this.updateOrderType(req,res,next,{
								user_id 		: 	userId,
								device_id 		: 	deviceId,
								main_order_id 	:	allOrderUniqueId,
							}).then((response)=>{

								let sendNotification	=	response.send_notification;
								let isNotConfirm		=	response.is_not_confirm;

								/** Save order logs */
								orderIdsArray.map(records=>{
									let isSchedule 		=	records.is_schedule;
									let isBigOrder 		= 	records.is_big_order;
									let tmpOrderStatus 	=	records.order_status;
									let restConceptIds 	=	records.rest_concept_id;

									if(isNotConfirm && tmpOrderStatus!=Constants.ORDER_SCHEDULED){
										tmpOrderStatus = Constants.ORDER_PENDING;
									}

									if(!isNotConfirm && !isBigOrder && restConceptIds){
										this.callAfterPlaceOrder(req,res,next,{order_id: records['order_id'] });
									}

									Helpers.saveOrderStatusLogs(req,res,next,{
										send_notification_call_center : (isBigOrder) ? isBigOrder :sendNotification,
										order_id 		: 	records['order_id'],
										restaurant_id	:	records['restaurant_id'],
										user_id			:	userId,
										updated_by		:	(userId) ? userId				:adminUserId,
										user_role_id	:	(userId) ? Constants.CUSTOMER	:"",
										user_type		:	(userId) ? Constants.USER_TYPE_CUSTOMER	:"",
										is_customer		:	(userId) ? true	: false,
										device_id 		: 	deviceId,
										status 			:	tmpOrderStatus,
										order_status 	:	tmpOrderStatus,
									}).then(()=>{});
								});
							});

							/** Calculate order payout */
							orderIdsArray.map(records=>{
								Helpers.calculateOrderPayout(req,res,next,{order_id: records.order_id }).then(()=>{ });
							});

							/** Update logs details */
							const user_wallet_logs = this.db.collection(Tables.USER_WALLET_LOGS);
							user_wallet_logs.updateMany({order_id:allOrderUniqueId },{$unset:{order_id:1}}).then(()=>{});

							/** Save payment details */
							if(paymentMethod != Constants.CASH_PAYMENT && paymentMethod != Constants.WALLET_PAYMENT){
								this.saveUserPaymentDetails(req,res,next,{
									user_id 			: 	userId,
									device_id 			: 	deviceId,
									order_ids 			:	paymentOrderIds,
									cart_ids 			:	paymentCartIds,
									payment_method 		:	paymentMethod,
									payment_status 		:	Constants.PAYMENT_SUCCESS,
									payment_response 	:	paymentResponse,
									currency 			:	paymentCurrency,
									amount 				:	orderPrice
								}).then(()=>{ });
							}

							/** Send pn to guest when order limit exceed  */
							if(firstGuestId && guestTotalOrders >= Constants.GUEST_USER_ORDER_LIMIT-1){
								pushNotification(req,res,{
									user_id		:	firstGuestId,
									pn_body		:	Constants.NOTIFICATION_MESSAGES[Constants.NOTIFICATION_TO_GUEST_FOR_EXCEEDED_ORDER_LIMIT].message,
									pn_type	 	: 	Constants.NOTIFICATION_TO_GUEST_FOR_EXCEEDED_ORDER_LIMIT
								}).then(()=>{});
							}
						});
					});
				});
			});
        }).catch(next);
	};// end placeOrder()

	/**
	 * Function to pay user order outstanding amount
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 * @param options As data object
	 *
	 * @return json
	**/
	payUserOrderOutstanding (req,res,next,options={}){
		return new Promise(resolve=>{
			let userId	=	(options.user_id)	?	new ObjectId(options.user_id)	:"";

			/** Send error response */
			if(!userId) return resolve({status:Constants.STATUS_ERROR, message:res.__("system.invalid_access")});

			/** Get user details  */
			const users = this.db.collection(Tables.USERS);
			users.findOne({_id: userId },{projection:{revert_orders:1}}).then(userDetails=>{

				/** Send error response */
				if(!userDetails) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

				/** Send success response */
				if(!userDetails.revert_orders || userDetails.revert_orders.length ==0){
					return resolve({status: Constants.STATUS_SUCCESS });
				}

				let revertOrdersIds = [];
				userDetails.revert_orders.map(data=>{
					revertOrdersIds.push(data.order_id);
				});

				revertOrdersIds = Helpers.arrayToObject(revertOrdersIds);

				asyncParallel({
					update_order_details:(subChildCallback)=>{
						/** Update order details */
						const orders = this.db.collection(Tables.ORDERS);
						orders.updateMany({
							_id : {$in: revertOrdersIds}
						},
						{
							$set :{
								modified				: Helpers.getUtcDate(),
								order_revert_paid_on	: Helpers.getUtcDate(),
								revert_outstanding_paid	: true,
							},
						}).then(()=>{
							subChildCallback(null);
						}).catch(next);
					},
					update_user_details:(subChildCallback)=>{
						/** Update user details */
						users.updateMany({
							_id	: userId,
						},
						{
							$set: {
								modified: Helpers.getUtcDate(),
							},
							$unset:	{
								revert_orders : 1,
							}
						}).then(()=>{
							subChildCallback(null);
						}).catch(next);
					},
				},(asyncSubChildErr)=>{
					if(asyncSubChildErr) return next(asyncSubChildErr);

					/** Send success response */
					resolve({status: Constants.STATUS_SUCCESS });
				});
			}).catch(next);
		}).catch(next);
	}// end payUserOrderOutstanding()

	/**
	 * Function to update order estimate time
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 * @param options As data object
	 *
	 * @return json
	**/
	updateOrderEstimateTime (req,res,next,options={}){
		return new Promise(resolve=>{
			let orderId	=	(options.order_id)	?	new ObjectId(options.order_id)	:"";

			/** Send error response **/
			if(!orderId) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			const orders 		=	this.db.collection(Tables.ORDERS);
			const order_details	= 	this.db.collection(Tables.ORDER_DETAILS);
			asyncParallel({
				order_data: (callback)=>{
					/** Get order details */
					orders.findOne({
						_id: orderId
					},{projection: {_id:1, is_big_order:1, order_date:1, delivery_type:1, is_schedule:1, scheduled_date:1, is_confirm:1}}).then(result=>{
						callback(null, result);
					}).catch(next);
				},
				order_details: (callback)=>{
					/** Get order sub details */
					order_details.findOne({order_id: orderId },{projection: {preparation_time:1, delivery_duration:1}}).then(result=>{
						callback(null, result);
					}).catch(next);
				},
			},(asyncErr,asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				/** Send error response **/
				if(!asyncResponse.order_data || !asyncResponse.order_details){
					return resolve({status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again"), asyncResponse: asyncResponse });
				}

				let orderData 			= 	asyncResponse.order_data;
				let orderSubDetails		=	asyncResponse.order_details;
				let isConfirm			=	orderData.is_confirm;
				let tmpOrderDate 		= 	orderData.order_date;
				let isSchedule 			= 	orderData.is_schedule;
				let scheduledDate 		= 	orderData.scheduled_date;
				let deliveryDuration 	= 	orderSubDetails.delivery_duration;
				let tmpDate				=	(isSchedule) ? scheduledDate :tmpOrderDate;
				let tmpOrderFinishedTime= 	deliveryDuration/Constants.MINUTES_IN_A_HOUR;
				let estimateTime 		= 	Helpers.getUtcDate(Helpers.addDaysToDate(tmpOrderFinishedTime, tmpDate));

				/** Send success response **/
				if(!isConfirm) return resolve({status: Constants.STATUS_SUCCESS, is_confirm : isConfirm });

				/** Update order  */
				orders.updateOne({
					_id: orderId
				},
				{$set: {
					order_estimate_time : estimateTime
				}}).then(()=>{

					/** Send success response **/
					resolve({status: Constants.STATUS_SUCCESS });
				}).catch(next);
			});
		}).catch(next);
	};// end updateOrderEstimateTime()

	/**
	 * Function to update order type
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 * @param options As data object
	 *
	 * @return json
	**/
	updateOrderType (req,res,next,options={}){
		return new Promise(resolve=>{
			let userId		= 	(options.user_id)		?	new ObjectId(options.user_id)	:"";
			let deviceId	= 	(options.device_id)		?	options.device_id			:"";
			let mainOrderId	= 	(options.main_order_id)	?	options.main_order_id		:"";

			/** Send error response **/
			if(!mainOrderId || (!userId && !deviceId)){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});
			}

			const orders = this.db.collection(Tables.ORDERS);
			asyncParallel({
				user_order: (callback)=>{
					let orderConditions = {main_order_id: {$ne: mainOrderId} };
					if(userId){
						orderConditions = {...{customer_id: userId}, ...orderConditions};
					}else{
						orderConditions = {...{device_id: deviceId}, ...orderConditions};
					}

					/** get order details **/
					orders.countDocuments(orderConditions).then(countResult => {
						callback(null,countResult);
					}).catch(next);
				},
				duplicate_order : (callback)=>{
					let odConditions = {main_order_id: mainOrderId };
					if(userId){
						odConditions = {...{customer_id: userId}, ...odConditions};
					}else{
						odConditions = {...{device_id: deviceId}, ...odConditions};
					}

					/** Get order id list **/
					orders.distinct( "_id", odConditions).then(orderResult => {

						/** Get order item id list **/
						const order_items	= this.db.collection(Tables.ORDER_ITEMS);
						order_items.distinct("item_id", {order_id: {$in : orderResult}}).then(itemResult => {

							/** Set conditions */
							let lastConditions = {
								order_date	:	{$gte:	Helpers.newDate(Helpers.subtractMinute(Constants.DUPLICATE_ORDER_MINUTE))},
								_id 		: 	{$nin: 	orderResult},
							};
							if(userId){
								lastConditions.customer_id = userId;
							}else{
								lastConditions.device_id = deviceId;
							}

							/** Last  order ids **/
							orders.distinct("_id", lastConditions).then(lastOrdersIds => {
								if(lastOrdersIds.length ==0) return callback(null,0);

								/** Check duplicate order */
								order_items.countDocuments({
									$and	 : [
										{order_id : {$in: 	lastOrdersIds} },
										{order_id : {$nin: 	orderResult} },
									],
									item_id	 : 	{$all	: 	itemResult},
									created	 :	{$gte	:	Helpers.newDate(Helpers.subtractMinute(Constants.DUPLICATE_ORDER_MINUTE))},
								}).then(countResult =>{
									callback(null,countResult);
								}).catch(next);
							}).catch(next);
						}).catch(next);
					}).catch(next);
				},
				is_user_vip : (callback)=>{
					if(!userId) return callback(null,false);

					/** Check user is vip or not **/
					const users = this.db.collection(Tables.USERS);
					users.findOne({_id: userId },{projection: {client_type:1}}).then(userResult => {
						let isVip = (userResult && userResult.client_type == Constants.USER_CLIENT_TYPE_VIP) ? true : false;

						callback(null,isVip);
					}).catch(next);
				},
			},(asyncErr,asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				let firstOrder 		= (asyncResponse.user_order ==0) 		? true :false;
				let duplicateOrder 	= (asyncResponse.duplicate_order >0) 	? true :false;
				let isUserVip 		= (asyncResponse.is_user_vip) 			? true :false;
				let isConfirm 		= !(firstOrder || duplicateOrder);
				let callCenterNotification	=	(firstOrder || duplicateOrder) ? true : false;

				asyncParallel({
					update_order_details: (childCallback)=>{
						/** Update order details */
						orders.updateMany({
							main_order_id: mainOrderId
						},
						{$set: {
							is_first_order 		: firstOrder,
							is_duplicate_order 	: duplicateOrder,
							is_vip				: isUserVip,
							modified 			: Helpers.getUtcDate(),
						}}).then(()=>{
							childCallback(null);
						}).catch(next);
					},
					update_order_rule: (childCallback)=>{
						/** Update order details */
						orders.updateMany({
							main_order_id	: mainOrderId,
							is_big_order	: false
						},
						{$set: {
							is_confirm	: isConfirm,
							modified 	: Helpers.getUtcDate(),
						}}).then(()=>{
							childCallback(null);
						}).catch(next);
					},
					update_order_status: (childCallback)=>{
						if(isConfirm) return childCallback(null);

						/** Update order details */
						orders.updateMany({
							main_order_id	: mainOrderId,
							order_status	: {$ne: Constants.ORDER_SCHEDULED}
						},
						{$set: {
							order_status 	: Constants.ORDER_PENDING,
							modified 		: Helpers.getUtcDate(),
						}}).then(()=>{
							childCallback(null);
						}).catch(next);
					},
				},(asyncChildErr)=>{
					if(asyncChildErr) return next(asyncChildErr);

					/** Send success response */
					resolve({
						status				: 	Constants.STATUS_SUCCESS,
						is_not_confirm		: 	(!isConfirm) ? true :false,
						send_notification 	:	callCenterNotification
					});
				});
			});
		}).catch(next);
	};// end updateOrderType()

	/**
	 * Function to place modifier order
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	placeModifierOrder (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 		=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
            let orderId		= 	(req.body.order_id)			?	new ObjectId(req.body.order_id)		:"";
            let userId		= 	(req.body.customer_id)		?	new ObjectId(req.body.customer_id)	:"";
            let modifiedBy	= 	(req.body.modified_by)		?	new ObjectId(req.body.modified_by)	:"";
            let deviceId	= 	(req.body.device_id)		?	req.body.device_id				:"";
            let mainDeviceId= 	(req.body.main_device_id)	?	req.body.main_device_id			:"";
            let isAdmin 	= 	(req.body.is_admin)			?	req.body.is_admin				:false;

			/** Send error response **/
			if((!userId && !mainDeviceId) || !deviceId || !orderId || !modifiedBy){
				return resolve({status: Constants.STATUS_ERROR, message:res.__("system.invalid_access")});
			}

			const orders  		= 	this.db.collection(Tables.ORDERS);
			const order_details = 	this.db.collection(Tables.ORDER_DETAILS);
			const order_items  	=	this.db.collection(Tables.ORDER_ITEMS);
			const offer_logs  	= 	this.db.collection(Tables.OFFER_LOGS);
			asyncParallel({
				order_details: (parentCallback)=>{
					/** Get order details */
					orders.findOne({_id: orderId },{projection: {main_order_id:1,order_price:1, paid_amount:1,customer_id:1,order_status:1,is_confirm:1,success_push_to_kfg:1,unique_order_id:1}}).then(orderResult=>{
						parentCallback(null, orderResult);
					}).catch(next);
				},
				cart_list: (parentCallback)=>{
					/** Get cart list */
					let cartOptions 					= 	clone(req.body);
					cartOptions.is_place_order 			= 	true;
					cartOptions.is_place_modified_order =	true;
					this.userCartAPI.getUserCartList(req,res,next,cartOptions).then(response=>{
						parentCallback(null,response);
					}).catch(next);
				},
				offer_log_details: (parentCallback)=>{
					/** Get offer logs details */
					offer_logs.findOne({order_id: orderId },{projection: {order_discount:1,offer_id:1}}).then(logResult=>{
						parentCallback(null, logResult);
					}).catch(next);
				},
				get_modify_log_details: (parentCallback)=>{
					/** Get order modify logs details */
					const order_modify_logs = 	this.db.collection(Tables.ORDER_MODIFY_LOGS);
					order_modify_logs.findOne({order_id: orderId },{projection: {_id:1}}).then(logResult=>{
						parentCallback(null, logResult);
					}).catch(next);
				},
				item_list: (parentCallback)=>{
					/** Get order modify logs details */
					const order_items  	=	this.db.collection(Tables.ORDER_ITEMS);
					order_items.find({order_id: orderId},{projection:{_id:0,add_by_admin:0,last_qty:0}}).toArray().then(orderResult=>{
						parentCallback(null, orderResult);
					}).catch(next);
				},
			},(parentErr,parentResponse)=>{
				if(parentErr) return next(parentErr);

				/** Send error response */
				if(parentResponse.cart_list.status != Constants.STATUS_SUCCESS) return resolve(parentResponse.cart_list);

				let oldItemList  	=	parentResponse.item_list;
				let cartList  		=	parentResponse.cart_list.result;
				let grandTotal 		=	parentResponse.cart_list.grand_total;
				let orderDetails	=	parentResponse.order_details;
				let offerlogDetails	=	parentResponse.offer_log_details;
				let orderModifyLog	=	parentResponse.get_modify_log_details;
				let isLogExists		=	(orderModifyLog) ? true :false;

				/** Send error response **/
				if(cartList.length <=0 || !orderDetails){
					return resolve({status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });
				}

				/** Check all branch or item available or not */
				let cartDetails	 		=	cartList[0];
				let branchAvailable 	= 	true;
				let itemAvailable		=	true;
				let orderNetAmount		=	0;
				if(!cartDetails.branch_available)  	branchAvailable = false;
				if(cartDetails.branch_open != Constants.OPEN) branchAvailable = false;
				cartDetails.item_list.map(itemData=>{
					if(!itemData.item_available)  itemAvailable = false;

					orderNetAmount += itemData.sub_price;
				});

				/** Send error response **/
				if(!branchAvailable || !itemAvailable){
					let message = (!branchAvailable) ? res.__("order.branch_not_available") : res.__("order.item_not_available");
					return resolve({status: Constants.STATUS_ERROR, message: message });
				}

				const offer_used    = 	this.db.collection(Tables.OFFER_USED);
				const tmp_offer_logs= 	this.db.collection(Tables.TMP_OFFER_LOGS);
				const user_carts 	= 	this.db.collection(Tables.USER_CARTS);
				const restaurants 	= 	this.db.collection(Tables.RESTAURANTS);

				let uniqueOrderId 	=	orderDetails.unique_order_id;
				let isOrderConfirm 	=	orderDetails.is_confirm;
				let successPushToKfg=	orderDetails.success_push_to_kfg;
				let paidAmount	 	=	orderDetails.paid_amount;
				let oldOrderPrice	=	orderDetails.order_price;
				let restaurantId 	= 	cartDetails.restaurant_id;
				let itemList 	 	=	cartDetails.item_list;
				let tmpOfferId  	= 	cartDetails.offer_id;
				let orderCustomerId = 	orderDetails.customer_id;
				let currentDiscount = 	(cartDetails.discount) ? cartDetails.discount :0;
				let lastOfferId 	=   "";
				let lastOfferAmount =   0;
				let lastOfferlogId 	=   "";
				let bothOfferSame   =	false;

				if(offerlogDetails){
					lastOfferlogId 	= (offerlogDetails._id) 		? offerlogDetails._id 	:"";
					lastOfferId 	= (offerlogDetails.offer_id) 	? offerlogDetails.offer_id :"";
					lastOfferAmount = (offerlogDetails.order_discount) ? offerlogDetails.order_discount :0;
					bothOfferSame	= (String(lastOfferId) == tmpOfferId) ? true :false;
				}

				asyncParallel({
					save_modify_details: (childCallback)=>{
						if(isLogExists) return childCallback(null);

						/** Save order details */
						this.saveOrderDetails(req,res,next,{order_id: orderId, modified_by: modifiedBy}).then(response=>{
							if(response.status != Constants.STATUS_SUCCESS) return childCallback(response.message);
							childCallback(null);
						}).catch(next);
					},
					restaurant_concept_id: (childCallback)=>{
						/** Set conditions */
						let restConditions = {
							_id			:	new ObjectId(restaurantId),
							concept_id	:	{$exists : true, $ne: ""}
						};

						/** Get restaurant details */
						restaurants.findOne(restConditions,{projection: {concept_id:1}}).then(restResult=>{
							let conceptId = (restResult && restResult.concept_id) ? restResult.concept_id :null;
							childCallback(null, conceptId);
						}).catch(next);
					},
				},(childParallelErr,childParallelResponse)=>{
					if(childParallelErr) return next(childParallelErr);

					let restConceptId	= childParallelResponse.restaurant_concept_id;
					asyncParallel({
						delete_old_item: (parentCallback)=>{
							/** Delete order old items */
							order_items.deleteMany({order_id: orderId }).then(deleteResult=>{
								parentCallback(null, deleteResult);
							}).catch(next);
						},
						save_offer_logs: (parentCallback)=>{
							/** This use only when offer is different */
							if(!offerlogDetails|| !tmpOfferId || bothOfferSame){
								return parentCallback(null);
							}

							/** Set offer used conditions */
							let offerUsedConditions = {
								offer_id : 	new ObjectId(lastOfferId),
							};

							if(userId){
								offerUsedConditions.user_id 	= 	userId;
							}else{
								offerUsedConditions.device_id	=	mainDeviceId;
							}

							/** Update offer used */
							offer_used.updateOne(offerUsedConditions,{
								$set :{
									modified: 	Helpers.getUtcDate()
								},
								$inc :{
									offer_used 			: -1,
									total_amount_used 	: lastOfferAmount*-1,
								},
								$pull :{
									offer_log_ids : lastOfferlogId,
								},
							}).then(() => {

								/** Delete logs */
								offer_logs.deleteOne({_id: lastOfferlogId }).then(() => {
									parentCallback(null);
								}).catch(next);
							}).catch(next);
						},
						update_offer_value: (parentCallback)=>{
							if(!offerlogDetails|| !tmpOfferId || !bothOfferSame || lastOfferAmount == currentDiscount){
								return parentCallback(null);
							}

							/** This use only when offer same but discount different */
							let adjustDiscount =  currentDiscount-lastOfferAmount;

							offer_logs.updateOne({
								_id : new ObjectId(lastOfferlogId)
							},
							{$set :{
								order_price	   : Helpers.round(orderNetAmount,Constants.CURRENCY_ROUND_PRECISION),
								order_discount : currentDiscount,
								modified	   : Helpers.getUtcDate()
							}}).then(() => {

								/** Update offer used */
								offer_used.updateOne({
									offer_log_ids : {$in: [new ObjectId(lastOfferlogId)]}
								},
								{$inc :{
									total_amount_used : adjustDiscount,
								}}).then(() => {
									parentCallback(null);
								}).catch(next);
							}).catch(next);
						},
					},(parentParallelErr)=>{
						if(parentParallelErr) return next(parentParallelErr);

						/** Set order save details  */
						let orderSaveData = {
							order_price		:	grandTotal,
							net_amount		:	Helpers.round(orderNetAmount,Constants.CURRENCY_ROUND_PRECISION),
							is_modified		:	true,
							modified_by		:	modifiedBy,
							queue_time		:	Helpers.getUtcDate(),
							number_of_queue : 	Constants.FIRST_REQUEUE_ORDER,
							is_big_order	:	(orderNetAmount >= Constants.BIG_ORDER_AMOUNT) ? true :false,
							kfg_offer_id	:	(cartDetails.kfg_offer_id) 	 ?	cartDetails.kfg_offer_id 	:"",
							kfg_offer_name	:	(cartDetails.kfg_offer_name) ? 	cartDetails.kfg_offer_name 	:"",
							modified		:	Helpers.getUtcDate(),
						};

						if(!paidAmount) orderSaveData.paid_amount = oldOrderPrice;

						/** Save order details */
						orders.updateOne({_id: orderId },{$set: orderSaveData}).then(()=>{

							asyncParallel({
								order_details : (callback)=>{
									let deliveryTime 	= 	(cartDetails.delivery_time) 	? cartDetails.delivery_time :Constants.DEFAULT_DELIVERY_TIME;
									let preparationTime = 	(cartDetails.preparation_time) 	? cartDetails.preparation_time :Constants.DEFAULT_PREPARATION_TIME;

									/** Set order details  */
									let orderDetailsData = {
										total_amount: 	grandTotal,
										net_amount	: 	Helpers.round(orderNetAmount,Constants.CURRENCY_ROUND_PRECISION),
										discount_price:	(cartDetails.discount) ? cartDetails.discount :0,
										offer_id	: 	cartDetails.offer_id,
										offer_code	: (cartDetails.offer_code)?cartDetails.offer_code :"",
										offer_type	: (cartDetails.offer_type)?cartDetails.offer_type :"",
										delivery_fee:(cartDetails.delivery_fees)?cartDetails.delivery_fees :0,
										additional_tax	 : 	cartDetails.additional_tax,
										delivery_duration: 	deliveryTime,
										elapsed_time	 : 	deliveryTime,
										preparation_time : 	preparationTime,
										remaining_preparation_time	: 	preparationTime,
										remaining_delivery_duration	: 	deliveryTime,
									};

									if(cartDetails.additional_tax_percentage){
										orderDetailsData.additional_tax_percentage = cartDetails.additional_tax_percentage;
									}

									if(cartDetails.offer_discount){
										orderDetailsData.offer_discount =	cartDetails.offer_discount;
									}
									if(cartDetails.offer_delivery_fees){
										orderDetailsData.offer_delivery_fees =	cartDetails.offer_delivery_fees;
									}

									if(cartDetails.composite_id){
										orderDetailsData.composite_id =	new ObjectId(cartDetails.composite_id);

										if(cartDetails.composite_discount){
											orderDetailsData.composite_discount =	cartDetails.composite_discount;
										}
										if(cartDetails.composite_delivery_fees){
											orderDetailsData.composite_delivery_fees =	cartDetails.composite_delivery_fees;
										}
									}

									if(cartDetails.corporate_id){
										orderDetailsData.corporate_id =	new ObjectId(cartDetails.corporate_id);

										if(cartDetails.corporate_discount){
											orderDetailsData.corporate_discount =	cartDetails.corporate_discount;
										}
										if(cartDetails.corporate_delivery_fees){
											orderDetailsData.corporate_delivery_fees =	cartDetails.corporate_delivery_fees;
										}
									}

									/** Save order details */
									order_details.updateOne({order_id: orderId },{$set: orderDetailsData}).then(()=>{
										callback(null);
									}).catch(next);
								},
								order_items : (callback)=>{
									/** Manage item save data */
									let itemSaveData 	= [];
									let modifierItemData= [];
									itemList.map(itemData=>{
										let itemDiscount = (itemData.discount) ? itemData.discount:0;
										let subPrice 	 = (itemData.sub_price) ? itemData.sub_price:0;

										let tempObj = {
											order_id 		: 	orderId,
											parent_item_id 	: 	itemData.parent_item_id,
											qty 			: 	itemData.qty,
											item_name 		: 	itemData.item_name,
											item_image 		:	itemData.item_image,
											item_id 		: 	itemData.item_id,
											unit_id 		: 	itemData.unit_id,
											dough_id 		: 	itemData.dough_id,
											selector_id 	: 	itemData.selector_id,
											item_type 		:	itemData.item_type,
											item_main_price :	itemData.item_main_price,
											cuisine_ids: (itemData.cuisine_ids) ? itemData.cuisine_ids :[],
											extra_items 	:	[],
											price			:	itemData.item_price,
											sub_total		:	Helpers.round((subPrice-itemDiscount),Constants.CURRENCY_ROUND_PRECISION),
											discounted_price:	itemDiscount,
											net_amount		:	subPrice,
											cart_created	:	itemData.created,
											add_by_admin	:	itemData.add_by_admin,
											last_qty		:	itemData.last_qty,
											created 		:	Helpers.getUtcDate(),
										};

										if(itemData.item_unit_id){
											tempObj.item_unit_id =itemData.item_unit_id;
										}

										if(itemData.unit_lists && itemData.unit_lists.length >0){
											tempObj.unit_lists = itemData.unit_lists;
										}

										/** Manage extra items  */
										if(itemData.extra_items && itemData.extra_items.length >0){
											itemData.extra_items.map(extraItemData=>{
												let groupId = extraItemData.group_id;

												extraItemData.extra_item_ids.map(exItemData=>{

													tempObj.extra_items.push({
														group_id			:	groupId,
														extra_item_id		:	exItemData.extra_item_id,
														is_first_component	:	exItemData.is_first_component,
														extra_item_group_id	:	exItemData.extra_group_item_id,
														extra_item_name		:	exItemData.extra_item_name,
														price				:	exItemData.extra_fees
													});
												});
											});
										}

										itemSaveData.push(tempObj);

										let modifierTmpObj 		=	clone(tempObj);
										modifierTmpObj.is_new	=	true;
										modifierItemData.push(modifierTmpObj);
									});

									/** Save order item details */
									order_items.insertMany(itemSaveData).then(()=>{
										callback(null);
									}).catch(next);
								},
								remove_offer_logs : (callback)=>{
									let cartIds = [];
									itemList.map(itemData=>{
										cartIds.push(itemData._id);
									});

									asyncParallel({
										remove_offer_logs : (subCallback)=>{
											/** Delete logs  */
											tmp_offer_logs.deleteMany({
												cart_ids : {$in: cartIds}
											}).then(()=>{
												subCallback(null);
											}).catch(next);
										},
										update_order_id : (subCallback)=>{
											/** update logs  */
											offer_logs.updateMany({
												cart_ids : {$in: cartIds}
											},
											{
												$set: {
													order_id : orderId,
													modified : Helpers.getUtcDate(),
												},
												$unset: {
													cart_ids : 1
												},
											}).then(()=>{
												subCallback(null);
											}).catch(next);
										},
										remove_cart : (subCallback)=>{
											/** Remove carts  */
											user_carts.deleteMany({_id: {$in: cartIds} }).then(()=>{
												subCallback(null);
											}).catch(next);
										},
									},(subParallelErr)=>{
										callback(subParallelErr);
									});
								}
							},(asyncParallelErr)=>{
								if(asyncParallelErr) return next(asyncParallelErr);

								/** Save order type */
								this.saveOrderDetails(req,res,next,{order_id: orderId, old_item_list: oldItemList, modified_by: modifiedBy}).then(response=>{
									if(response.status != Constants.STATUS_SUCCESS) return next(response.message);

									asyncParallel({
										place_order: (childAsyncCallback)=>{
											if(!restConceptId) return childAsyncCallback(null);
											if(!isOrderConfirm) return childAsyncCallback(null);

											childAsyncCallback(null);

											/** Place KFG Order */
											this.callAfterPlaceOrder(req,res,next,{ order_id: orderId, is_modify: (successPushToKfg) ? true :false });
										},
									},(childAsyncParallelErr)=>{
										if(childAsyncParallelErr) return next(childAsyncParallelErr);

										/** Send success response  */
										resolve({status: Constants.STATUS_SUCCESS, message: res.__("order.order_has_been_placed_successfully"),grand_total: grandTotal });

										/** Calculate order payout */
										Helpers.calculateOrderPayout(req,res,next,{order_id:orderId}).then(()=>{});

										/** Send notification */
										sendMailToUsers(req,res,{
											event_type 			: Constants.ORDER_STATUS_MODIFIED_EVENT,
											notification_type	: Constants.NOTIFICATION_ORDER_MODIFIED,
											user_type			: (orderCustomerId) ? Constants.USER_TYPE_CUSTOMER	:"",
											user_role_id		: (orderCustomerId) ? Constants.CUSTOMER	:"",
											order_id			: orderId,
											device_id 			: mainDeviceId,
											unique_order_id		: uniqueOrderId,
											user_id				: modifiedBy,
											receiver_id			: orderCustomerId,
											is_admin			: isAdmin,
											restaurant_id 		: restaurantId,
										});
									});
								}).catch(next);
							});
						}).catch(next);
					});
				});
			});
        }).catch(next);
	};// end placeModifierOrder()

	/**
	 * Function to place modifier order
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 * @param options As data object
	 *
	 * @return json
	**/
	saveOrderDetails (req,res,next,options={}){
		return new Promise(resolve=>{
			let orderId 	=	(options.order_id) 		?	options.order_id 				:"";
			let oldItemList	= 	(options.old_item_list) ?	options.old_item_list 			:[];
			let modifiedBy	= 	(options.modified_by) 	?	new ObjectId(options.modified_by) 	:"";

			/** Send error response */
			if(!orderId){
				return resolve({status: Constants.STATUS_ERROR, message:res.__("system.invalid_access")});
			}

			const order_modify_logs  = 	this.db.collection(Tables.ORDER_MODIFY_LOGS);
			asyncParallel({
				order_details: (callback)=>{
					/** Get order details */
					const orders = 	this.db.collection(Tables.ORDERS);
					orders.findOne({_id: orderId },{projection: {_id:0}}).then(orderResult=>{
						callback(null, orderResult);
					}).catch(next);
				},
				order_sub_details: (callback)=>{
					/** Get order details */
					const order_details = 	this.db.collection(Tables.ORDER_DETAILS);
					order_details.findOne({order_id: orderId },{projection: {_id:0}}).then(orderResult=>{
						callback(null, orderResult);
					}).catch(next);
				},
				order_item_list: (callback)=>{
					/** Get order item list */
					const order_items  	=	this.db.collection(Tables.ORDER_ITEMS);
					order_items.find({order_id: orderId},{projection:{_id:0}}).toArray().then(orderResult=>{
						callback(null, orderResult);
					}).catch(next);
				},
				order_modify_log: (callback)=>{
					/** Get order item list */
					order_modify_logs.find({order_id: orderId},{projection:{version:1}}).sort({created : Constants.SORT_DESC}).limit(1).toArray().then(orderModifyResult=>{
						callback(null, orderModifyResult?.[0] || null);
					}).catch(next);
				},
			},(parentErr,parentResponse)=>{
				if(parentErr) return next(parentErr);

				let orderItemList	=	parentResponse.order_item_list;
				let orderDetails	=	parentResponse.order_details;
				let orderSubDetails	=	parentResponse.order_sub_details;
				let orderModifyLog	=	parentResponse.order_modify_log;
				let version			=	(orderModifyLog && orderModifyLog.version) ? orderModifyLog.version : 0;

				/** Send error response **/
				if(!orderDetails || !orderSubDetails || !orderItemList || orderItemList.length <=0){
					return resolve({status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });
				}

				/** Set logs details */
				let orderAllDetails 				=	Object.assign(orderDetails,orderSubDetails);
				orderAllDetails.version 			=   version + 1;
				orderAllDetails.created 			=   Helpers.getUtcDate();
				orderAllDetails.modified 			=   Helpers.getUtcDate();
				orderAllDetails.modified_by_user_id =   modifiedBy;

				/** Save order modify logs */
				order_modify_logs.insertOne(orderAllDetails).then(result=>{

					let logId 	 = 	(result && result.insertedId) ? result.insertedId :"";
					let logItems =	[];
					orderItemList.map(records=>{

						if(oldItemList && oldItemList.length >0){
							let isOld = false;
							oldItemList.map(oldData=>{
								if(String(oldData.item_id) == String(records.item_id)) isOld = true;
							});

							records. is_new = (!isOld) ? true :false;
						}

						if(records.add_by_admin) records.is_new = true;
						if(records.last_qty && records.qty != records.last_qty) records.is_new = true;

						let tmpObj = clone(records);
						tmpObj.modify_log_id = logId;
						logItems.push(tmpObj);
					});

					const orders	=	this.db.collection(Tables.ORDERS);
					orders.updateOne({_id: orderId },{$set : { last_modified_order_id : new ObjectId(logId)}}).then(()=>{

						/** Save order modify item logs */
						const order_modify_item_logs  = this.db.collection(Tables.ORDER_MODIFY_ITEM_LOGS);
						order_modify_item_logs.insertMany(logItems).then(()=>{

							/** Send success response */
							return resolve({status: Constants.STATUS_SUCCESS });
						}).catch(next);
					}).catch(next);
				}).catch(next);
			});
		}).catch(next);
	}// end saveOrderDetails()

	/**
	 * Function to save payment transaction details
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	savePaymentTransactionDetails (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body =	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);

			/** Save payment details */
			this.saveUserPaymentDetails(req,res,next,req.body).then(response=>{
				if(response.status != Constants.STATUS_SUCCESS) return resolve(response);

				resolve({status: Constants.STATUS_SUCCESS});
			}).catch(next);
        }).catch(next);
	};// end savePaymentTransactionDetails()

	/**
	 * Function to save user payment details
	 *
	 * @param req		As Request Data
	 * @param res		As Response Data
	 * @param next		As Callback argument to the middleware function
	 * @param options	As object data
	 *
	 * @return json
	**/
	saveUserPaymentDetails (req,res,next,options={}){
		return new Promise(resolve=>{
			let userId			= 	(options.user_id)			?	new ObjectId(options.user_id)	:"";
			let deviceId		= 	(req.body.device_id)		?	req.body.device_id			:"";
			let orderIds		= 	(options.order_ids)			?	options.order_ids			:"";
            let paymentMethod	= 	(options.payment_method)	?	options.payment_method		:"";
            let paymentStatus	= 	(options.payment_status)	?	options.payment_status		:"";
            let paymentResponse	= 	(options.payment_response)	?	options.payment_response	:"";
            let paymentCurrency	= 	(options.currency)			?	options.currency			:"";
            let paymentAmount	= 	(options.amount)			?	parseFloat(options.amount)	:"";
            let paymentEvent	= 	(options.payment_event)		? 	options.payment_event		:Constants.ORDER_PAYMENT;

			/** Send error response **/
			if((!userId && !deviceId) || !paymentMethod || !paymentStatus || !paymentResponse || !paymentCurrency || !paymentAmount){
				let missingObj = {};
				if(!userId && !deviceId)	missingObj.user_device_id 	= true;
				if(!paymentMethod) 			missingObj.payment_method 	= true;
				if(!paymentStatus) 			missingObj.payment_status 	= true;
				if(!paymentResponse) 		missingObj.payment_response = true;
				if(!paymentCurrency) 		missingObj.currency 		= true;
				if(!paymentAmount) 			missingObj.amount 			= true;

				return resolve({status: Constants.STATUS_ERROR, message:res.__("system.invalid_access"), missing_object : missingObj});
			}

			asyncParallel({
				unqiue_id : (callback)=>{
					/** Get unique invoice number **/
					Helpers.getUniqueId(req,res,next,{type:Tables.PAYMENT_TRANSACTIONS}).then(uniqueIdResponse=>{
						let uniqueId = (uniqueIdResponse.result) ? uniqueIdResponse.result :"";
						callback(null,uniqueId);
					}).catch(next);
				},
				cart_ids : (callback)=>{
					if(paymentEvent != Constants.ORDER_PAYMENT || orderIds) return  callback(null,[]);

					/** Set cart conditions */
					let cartConditions = {};
					if(userId){
						cartConditions.customer_id  = userId;
					}else{
						cartConditions.device_id 	= deviceId;
					}

					const user_carts = 	this.db.collection(Tables.USER_CARTS);
					user_carts.distinct( "_id", cartConditions).then(cartResult=>{
						callback(null,cartResult);
					}).catch(next);
				}
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				let invoiceNumber 	= 	asyncResponse.unqiue_id;
				let cartIds 		=	asyncResponse.cart_ids;
				if(orderIds) orderIds	= Helpers.arrayToObject(orderIds);

				const payment_transactions = this.db.collection(Tables.PAYMENT_TRANSACTIONS);
				asyncParallel({
					save_payment_details: (callback)=>{
						let transactionId = (paymentResponse.InvoiceTransactions && paymentResponse.InvoiceTransactions[0]) ? paymentResponse.InvoiceTransactions[0].TransactionId :"";

						/** Set save data */
						let paymentSaveData = {
							amount  		: paymentAmount,
							currency  		: paymentCurrency,
							payment_method  : paymentMethod,
							payment_status  : paymentStatus,
							payment_event  	: paymentEvent,
							invoice_number  : invoiceNumber,
							transaction_id  : transactionId,
							payment_response: JSON.stringify(paymentResponse),
							created  		: Helpers.getUtcDate(),
							modified  		: Helpers.getUtcDate(),
						};

						if(orderIds && orderIds.length >0){
							paymentSaveData.order_ids  	=  orderIds;
						}else if(cartIds && cartIds.length >0){
							paymentSaveData.cart_ids	=  cartIds;
						}

						if(userId){
							paymentSaveData.user_id   =  userId;
						}else{
							paymentSaveData.device_id = deviceId;
						}

						/** Save payment details */
						payment_transactions.insertOne(paymentSaveData).then(result=>{

							let paymentId = (result && result.insertedId) ? result.insertedId :"";

							asyncParallel({
								update_order_details: (childCallback)=>{
									if(orderIds.length <=0) return  childCallback(null,null);

									/** Update order details */
									const order_details = this.db.collection(Tables.ORDER_DETAILS);
									order_details.updateMany({
										order_id: {$in: orderIds}
									},
									{$set:{
										payment_id	: 	paymentId,
										modified	:	Helpers.getUtcDate(),
									}}).then(()=>{
										childCallback(null);
									}).catch(next);
								}
							},(asyncErr)=>{
								callback(asyncErr,paymentId);
							});
						}).catch(next);
					},
					update_payment_details: (callback)=>{
						if(orderIds.length <=0 || cartIds.length <=0) return  callback(null,null);

						/** Update payment details */
						payment_transactions.updateMany({
							cart_ids: {$in: cartIds}
						},
						{
							$set:{
								order_ids	: 	orderIds,
								modified	:	Helpers.getUtcDate(),
							},
							$unset:{
								cart_ids : 1
							}
						}).then(()=>{
							callback(null);
						}).catch(next);
					}
				},(asyncErr,asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					/** Send success response */
					resolve({
						status			:	Constants.STATUS_SUCCESS,
						invoice_number	:	invoiceNumber,
						payment_id		:	asyncResponse.save_payment_details
					});
				});
			});
        }).catch(next);
	};// end saveUserPaymentDetails()

	/**
	 * Function to get order details
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	getOrderDetails (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 		 = Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
            let orderId		 = (req.body.order_id)  	 ? new ObjectId(req.body.order_id) 		:"";
			let userId		 = (req.body.user_id)   	 ? new ObjectId(req.body.user_id)  		:"";
            let userType	 = (req.body.user_type) 	 ? req.body.user_type   		 	:"";
			let deviceId	 = (req.body.device_id) 	 ? req.body.device_id   		 	:"";
			let restaurantId = (req.body.restaurant_id)  ? new ObjectId(req.body.restaurant_id) :"";
			let branchId	 = (req.body.branch_id)   	 ? new ObjectId(req.body.branch_id)  	:"";

			/** Send error response **/
			if(!orderId || !userType || (userType == Constants.USER_TYPE_CUSTOMER && (!userId && !deviceId)) || (userType != Constants.USER_TYPE_CUSTOMER && userType != Constants.USER_TYPE_DRIVER && userType != Constants.USER_TYPE_RESTAURANT) ||(userType == Constants.USER_TYPE_DRIVER && !userId) || (userType == Constants.USER_TYPE_RESTAURANT && !restaurantId)){
				return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});
			}

			/** Set common conditions for orders **/
			let commonConditions = { _id : orderId};

			if(userType == Constants.USER_TYPE_DRIVER){
				commonConditions.captain_id = userId;
			}else if(userType == Constants.USER_TYPE_RESTAURANT){
				commonConditions.restaurant_id = restaurantId;
				commonConditions.is_confirm	   = true;

				if(branchId) commonConditions.branch_id = branchId;
			}else{
				if(userId){
					commonConditions.customer_id = userId;
				}else{
					commonConditions.device_id = deviceId;
				}
			}

			asyncParallel({
                orders_details : (callback)=>{
                    /** Get orders  */
                    const orders = this.db.collection(Tables.ORDERS);
					orders.findOne(commonConditions,{projection:{area_id:1,area_name:1,branch_id:1,captain_id:1,created:1,delivery_fee:1,delivery_type:1,net_amount:1,order_price:1,order_status:1,payment_method:1,request_note:1,restaurant_id:1,restaurant_name:1,scheduled_time:1,unique_order_id:1,delivery_status:1,customer_status:1,customer_id:1,captain_name:1, captain_number:1,picked_from:1,pickup_captain_id:1,pickup_lat:1,pickup_long:1,problem_type:1,problem_subtype:1, rejection_reason:1, outstanding_amount: 1,outstanding_payment: 1, refund_amount: 1,refund_amount_status: 1, refund_type:1,amount_debited_by_wallet:1,is_infinity_user:1,package_id:1,package_delivery_fees:1, order_date:1, delay_voc_status: 1,thermal_pdf:1,is_completed:1,success_push_to_kfg:1,kfg_order:1}}).then(result=>{
                        callback(null,result);
                    }).catch(next);
                },
				order_sub_details : (callback)=>{
                    /** Get order sub details */
                    const order_details	= this.db.collection(Tables.ORDER_DETAILS);
					order_details.findOne({ order_id : orderId},{projection:{_id:0,delivery_area_id:1,customer_latitude:1,customer_longitude:1,restaurant_address:1,restaurant_latitude:1,restaurant_longitude:1,offer_code:1,delivery_fee:1,delivery_duration:1,preparation_time:1,remaining_preparation_time:1,remaining_delivery_duration:1,discount_price:1,customer_address_id:1,additional_tax:1,branch_extra_charge:1,customer_address_detail:1}}).then(orderDetailsResult=>{
						if(orderDetailsResult){
							orderDetailsResult.customer_address  = (orderDetailsResult.customer_address_detail) ? Helpers.arrangeUserAddress(req,res,next,orderDetailsResult.customer_address_detail)  :"";
						}
                        callback(null,orderDetailsResult);
                    }).catch(next);
                },
                order_item_list : (callback)=>{
                    /** Get order item list */
                   	const order_items	= this.db.collection(Tables.ORDER_ITEMS);
					order_items.aggregate([
						{$match: 	{order_id : orderId}},
						{$lookup: 	{
							from			: Tables.ITEMS,
							localField		: "item_id",
							foreignField	: "_id",
							as				: "item_details",
						}},
						{$project	: 	{
							id:1,qty:1,item_name:1,item_id:1,unit_id:1,dough_id:1,item_type:1,extra_items:1, price:1,sub_total:1,discounted_price:1,net_amount:1,item_unit_id:1,unit_lists:1,note:1,
							item_image: {$arrayElemAt:["$item_details.image", 0] },
						}},
					]).toArray().then(result=>{
                    	if(result.length <=0) return callback(null,result);

						let unitIds			=	[];
						let doughIds		=	[];
						let selectorIds		=	[];
						result.map(data=>{
							if(data.unit_id) unitIds.push(data.unit_id);
							if(data.dough_id) doughIds.push(data.dough_id);
								if(data.item_type == Constants.HALF_AND_HALF_ITEM || data.item_type == Constants.DEAL_ITEM ){
									if(data.unit_lists && data.unit_lists.length > 0){
										data.unit_lists.map(list=>{
											if(list.unit_id) unitIds.push(list.unit_id);
											if(list.dough_id) doughIds.push(list.dough_id);
											if(list.selector_id) selectorIds.push(list.selector_id);
										});
									}
								}
						});

						if(unitIds.length <=0) return callback(null,result);
						asyncParallel({
							unit_records : (childCallback)=>{
								if(unitIds.length <=0) return childCallback(null,{});

								const item_units_masters = this.db.collection(Tables.ITEM_UNITS_MASTERS);
								item_units_masters.find({_id : {$in : Helpers.arrayToObject(unitIds)}},{projection : {_id: 1,name: 1}}).toArray().then(itemResult=>{

									let itemList = {};
									itemResult.map(items=>{
										itemList[items._id] = items.name;
									});
									childCallback(null,itemList);
								}).catch(next);
							},
							dough_records : (childCallback)=>{
								if(doughIds.length <=0) return childCallback(null,{});

								const item_dough_units = this.db.collection(Tables.ITEM_DOUGH_UNITS);
								item_dough_units.aggregate([
									{$match: 	{
										_id		: {$in : Helpers.arrayToObject(doughIds)}
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
								]).toArray().then(doughResult=>{

									let doughList = {};
									doughResult.map(doughs=>{
										doughList[doughs._id] = doughs.unit_name;
									});
									childCallback(null,doughList);
								}).catch(next);
							},
							selector_records : (childCallback)=>{
								if(selectorIds.length <=0) return childCallback(null,{});

								const item_selector_units = this.db.collection(Tables.ITEM_SELECTOR_UNITS);
								item_selector_units.aggregate([
									{$match: 	{
										_id		: {$in : Helpers.arrayToObject(selectorIds)}
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
								]).toArray().then(selectorResult=>{

									let selectorList = {};
									selectorResult.map(selectors=>{
										selectorList[selectors._id] = selectors.unit_name;
									});
									childCallback(null,selectorList);
								}).catch(next);
							},
						},(childErr, childResponse)=>{
							if(childErr) return callback(childErr);

							let doughData		=	(childResponse.dough_records) ? childResponse.dough_records : {};
							let unitData		=	(childResponse.unit_records) ? childResponse.unit_records : {};
							let selectorData	=	(childResponse.selector_records) ? childResponse.selector_records : {};

							result.map(record=>{
								let tmpUnitId 	= 	record.unit_id;
								let tmpDoughId	=	record.dough_id;

								if(tmpUnitId){
									record.unit_name  = (unitData[tmpUnitId])   ? unitData[tmpUnitId]  :{};
									record.dough_name = (doughData[tmpDoughId]) ? doughData[tmpDoughId]:{};

									if(record.item_type==Constants.HALF_AND_HALF_ITEM || record.item_type==Constants.DEAL_ITEM ){
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
								}
							});
							callback(null,result);
						});
					}).catch(next);
				},
                delivered_date_time : (callback)=>{
                    /** Get order delivered time */
                    const order_status_logs	= this.db.collection(Tables.ORDER_STATUS_LOGS);
                    order_status_logs.findOne({
						order_id 	: 	orderId,
						status 		:	Constants.Constants.ORDER_DELIVERED
					},{projection:{created:1}}).then(result=>{
						let deliveredTime = (result) ? result.created : "";
						callback(null,deliveredTime);
					}).catch(next);
				}
            },(err,response)=>{
				if(err) return next(err);

				/** Send error response */
				if(!response.orders_details || !response.order_sub_details || response.order_item_list.length<=0){
					return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});
				}

                let restaurantId  		= 	response.orders_details.restaurant_id;
                let deliveredDateTime  	= 	response.delivered_date_time;
                let branchId  			= 	response.orders_details.branch_id;
                let paymentMethod 		= 	response.orders_details.payment_method;
                let customerId 			= 	response.orders_details.customer_id;
				let captainId 			=	response.orders_details.captain_id;
				let customerAddressDetail=	response.order_sub_details.customer_address_detail;
				let pickupCaptainId   	=	response.orders_details.pickup_captain_id;

				if(response.orders_details.refund_type) response.orders_details.refund_type = Constants.REFUND_TYPE[response.orders_details.refund_type];
				if(deliveredDateTime) response.orders_details.delivered_date_time = deliveredDateTime;

                asyncParallel({
                    restaurant_details : (childCallback)=>{
                        /** Get restaurant details */
                        const restaurants	= this.db.collection(Tables.RESTAURANTS);
                        restaurants.findOne({ _id : new ObjectId(restaurantId)},{projection:{_id:0,image:1}}).then(restaurantResult=>{
                            childCallback(null,restaurantResult);
                        }).catch(next);
                    },
                    branch_details : (childCallback)=>{
                        /** Get branch details */
                        const restaurant_branches	= this.db.collection(Tables.RESTAURANT_BRANCHES);
                        restaurant_branches.findOne({
							 _id 			: new ObjectId(branchId),
							 restaurant_id 	: new ObjectId(restaurantId)
						},{projection:{_id:0,name:1}}).then(branchResult=>{
                            childCallback(null,branchResult);
                        }).catch(next);
                    },
                    payment_method_details : (childCallback)=>{
                        /** Get payment method  details */
                        const payment_methods	= this.db.collection(Tables.PAYMENT_METHODS);
                        payment_methods.findOne({ slug : paymentMethod},{projection:{_id:0,title:1}}).then(paymentMethodsResult=>{
                            childCallback(null,paymentMethodsResult);
                        }).catch(next);
					},
					user_list : (childCallback)=>{
						/** Get driver/customer/pickup captain details */
						const users	= this.db.collection(Tables.USERS);
						users.find({
							_id : {$in : [customerId,captainId,pickupCaptainId]}
						},{projection:{id:1,full_name:1,mobile_number:1,revert_orders:1}}).toArray().then(userResult=>{
							if(userResult.length<=0) return childCallback(null,{});

							let userList = {};
							userResult.map(records=>{
								userList[records._id] = records;
							});
							childCallback(null,userList);
						}).catch(next);
					},
					restaurant_sub_details : (childCallback)=>{
                        /** Get restaurant details */
                        const restaurant_details	= this.db.collection(Tables.RESTAURANT_DETAILS);
                        restaurant_details.findOne({ restaurant_id : new ObjectId(restaurantId)},{projection:{_id:0,mobile_number:1,phone_country_code:1}}).then(restaurantDetailsResult=>{
                            childCallback(null,restaurantDetailsResult);
                        }).catch(next);
					},
					branch_phones : (childCallback)=>{
                        /** Get restaurant details */
                        const restaurant_branch_phone_numbers	= this.db.collection(Tables.RESTAURANT_BRANCH_PHONE_NUMBERS);
                        restaurant_branch_phone_numbers.findOne({
							branch_id 	 : new ObjectId(branchId),
							attribute_id : Constants.BRANCH_CUSTOMER_SERVICE_NUMBER_ATTRIBUTE_ID
						},{projection:{_id:0,country_code:1,contact_name:1,value:1}}).then(phoneResult=>{
                            childCallback(null,phoneResult);
                        }).catch(next);
                    },
                },(asyncErr,asyncResponse)=>{
                    if(asyncErr) return next(asyncErr);

					/** Add customer details in a object*/
					let userList  			= 	asyncResponse.user_list;
					let branchPhones  		= 	asyncResponse.branch_phones;
					let branchDetails  		= 	asyncResponse.branch_details;
					let restaurantDetails  	= 	asyncResponse.restaurant_details;
					let paymentMethodDetails= 	asyncResponse.payment_method_details;
					let captainDetails  	=   (captainId && userList[captainId]) ?userList[captainId]:"";
					let customerDetails  	= 	(customerId && userList[customerId])?userList[customerId]:{};
					let pickupCaptainDetails=	(pickupCaptainId && userList[pickupCaptainId])?userList[pickupCaptainId]:{};
					let restaurantSubDetails= 	asyncResponse.restaurant_sub_details;
					let additionalDetails   =   {};

					additionalDetails.branch_phone_details  = (branchPhones) 	        ?   branchPhones                :{};
					additionalDetails.restaurant_image      = (restaurantDetails)       ?   restaurantDetails.image     :"";
					additionalDetails.branch_name   	    = (branchDetails)           ?   branchDetails.name          :"";
					additionalDetails.payment_type       	= (paymentMethodDetails)    ?   paymentMethodDetails.title  :"";
					additionalDetails.customer_name         = (customerDetails.full_name)?  customerDetails.full_name   :"";
					additionalDetails.customer_mobile_number= (customerDetails.mobile_number)? customerDetails.mobile_number :"";
                    additionalDetails.customer_address      = (customerAddressDetail) 	?	Helpers.arrangeUserAddress(req,res,next,customerAddressDetail)  :"";

					additionalDetails.pickup_captain_name          = (pickupCaptainDetails.full_name)     ? pickupCaptainDetails.full_name     :"";
					additionalDetails.pickup_captain_mobile_number = (pickupCaptainDetails.mobile_number) ? pickupCaptainDetails.mobile_number :"";
					additionalDetails.problem_type 	   = (response.orders_details.problem_type)    ? Constants.ORDER_CANCELED_REASON_TYPE[response.orders_details.problem_type]    : "";
					additionalDetails.restaurant_mobile_number       = (restaurantSubDetails) ? restaurantSubDetails.mobile_number :"";
					additionalDetails.restaurant_mobile_country_code = (restaurantSubDetails) ? restaurantSubDetails.phone_country_code :"";

					if(captainDetails){
						additionalDetails.captain_name          = (captainDetails.full_name)	 ? captainDetails.full_name :"";
						additionalDetails.captain_mobile_number = (captainDetails.mobile_number) ? captainDetails.mobile_number :"";
					}else if(response.orders_details.captain_number){
						additionalDetails.captain_mobile_number = response.orders_details.captain_number;
					}

					let totalOutStanding 	= 	0;
					let outStandingOrderList=	[];
					if(customerDetails && customerDetails.revert_orders && customerDetails.revert_orders.length >0 && paymentMethod == Constants.CASH_PAYMENT && !Constants.ORDER_FINISH_ACTIONS[orderStatus]){
						outStandingOrderList = customerDetails.revert_orders;
						customerDetails.revert_orders.map(records=>{
							if(records.outstanding_amount){
								totalOutStanding +=	records.outstanding_amount;
							}
						});
					}

                    /** Send success response */
                    let orderDetails = Object.assign(response.orders_details,response.order_sub_details,additionalDetails);
                    resolve({
                        status 		  		 : Constants.STATUS_SUCCESS,
                        order_details 		 : orderDetails,
                        order_item_list 	 : response.order_item_list,
                        restaurant_image_url : Constants.RESTAURANT_FILE_URL,
                        item_image_url    	 : Constants.ITEMS_FILE_URL,
						order_pdf_path   	 : Constants.ORDER_INVOICE_FILE_URL,
						outstanding_order_amount: Helpers.round(totalOutStanding),
						outstanding_order_list	: outStandingOrderList,
                    });
                });
            });
		}).catch(next);
	};// end getOrderDetails()

	/**
	 * Function to get accepted order list
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	getAcceptedOrderList (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 	= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId	= (req.body.user_id) ? new ObjectId(req.body.user_id) :"";

			/** Send error response **/
			if(!userId) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});

			/** Set driver conditions **/
			let userConditions = clone(Constants.DRIVER_COMMON_CONDITIONS);
			userConditions._id = userId;

			/** Find if user is not driver */
			const users	= 	this.db.collection(Tables.USERS);
			users.findOne(userConditions,{projection: { _id:1}}).then(userResult=>{

				/** Send error response **/
				if(!userResult) return resolve({status : Constants.STATUS_ERROR, message : res.__("admin.system.invalid_access")});

				asyncParallel({
					assignmnet_list : (callback)=>{
						 /** Get assigned order details */
						const order_assignment_logs	= this.db.collection(Tables.ORDER_ASSIGNMENT_LOGS);
						order_assignment_logs.find({
							captain_id 		: userId,
							current_status 	: Constants.ORDER_DRIVER_ASSIGNED
						},{projection: { _id:1,order_id:1}}).toArray().then(orderAssignmentResult=>{
							callback(null,orderAssignmentResult);
						}).catch(next);
					},
					orders_count : (callback)=>{
						/** Get orders count **/
						this.getOrdersCount(req,res,next).then((countResponse)=>{
							if(countResponse.status != Constants.STATUS_SUCCESS) return callback(null,countResponse.message);
							callback(null,countResponse);
						}).catch(next);
					}
				},(parentErr, parentResponse)=>{
					if(parentErr) return next(parentErr);

					let ordersCount 			=	parentResponse.orders_count;
					let orderAssignmentResult 	= 	parentResponse.assignmnet_list;

					if(orderAssignmentResult.length <= 0){
						return resolve({
							status 					: 	Constants.STATUS_SUCCESS,
							accepted_order_list 	: 	[],
							accept_order_count		: 	ordersCount.accept_order_count,
							pick_order_count		: 	ordersCount.pick_order_count,
							delivery_order_count	: 	ordersCount.delivery_order_count,
							restaurant_image_url 	:	Constants.RESTAURANT_FILE_URL
						});
					}

					/** Insert order ids in a array */
                    let orderIds = [];
                    orderAssignmentResult.map(records=>{
                        orderIds.push(records.order_id);
                    });
                    orderIds = Helpers.arrayToObject(orderIds);

                    asyncParallel({
                        orders : (callback)=>{
							/** Get orders  */
                            const orders = this.db.collection(Tables.ORDERS);
                            orders.aggregate([
                                {$match : { _id : {$in : orderIds}}},
                                {$lookup : {
                                    from 		 : Tables.RESTAURANTS,
                                    localField 	 : "restaurant_id",
                                    foreignField : "_id",
                                    as 			 : "restaurant_details"
                                }},
                                {$project : { _id:1,unique_order_id:1,created:1,restaurant_name:1,area_name:1,restaurant_logo: {$arrayElemAt : ["$restaurant_details.image",0]}}}
                            ]).toArray().then(orderResult=>{
                                if(orderResult.length ==0) return callback(null,orderResult);

								let allCustomerIds =[];
								orderResult.map(records=>{
									if(records.customer_id) allCustomerIds.push(records.customer_id);
								});

								allCustomerIds = Helpers.arrayToObject(allCustomerIds);
								asyncParallel({
									user_list : (childCallback)=>{
										if(allCustomerIds.length ==0) return childCallback(null,{});

										/** Get user list */
										users.find({_id: {$in: allCustomerIds }},{projection: {_id: 1,revert_orders: 1}}).toArray().then(userResult=>{

											let userObj = {};
											userResult.map(records=>{
												userObj[records._id] = records;
											});
											childCallback(null,userObj);
										}).catch(next);
									}
								},(childErr, childResponse)=>{
									if(childErr) return callback(childErr,orderResult);

									let userList = childResponse.user_list;
									orderResult.map(records=>{
										let tmpCusId = records.customer_id;
										if(tmpCusId && userList[tmpCusId]){
											let orderStatus		=	records.order_status;
											let paymentMethod	=	records.payment_method;
											let tmpUserDetails	=	userList[tmpCusId];
											let totalOutStanding= 0

											if(tmpUserDetails.revert_orders && tmpUserDetails.revert_orders.length >0 && paymentMethod == Constants.CASH_PAYMENT && !Constants.ORDER_FINISH_ACTIONS[orderStatus]){
												tmpUserDetails.revert_orders.map(data=>{
													if(data.outstanding_amount){
														totalOutStanding +=	data.outstanding_amount;
													}
												});
											}

											if(totalOutStanding >0) {
												records.outstanding_order_amount = Helpers.round(totalOutStanding);
											}
										}
									});

									callback(null,orderResult);
								});
                            }).catch(next);
                        },
                        order_details : (callback)=>{
							/** Get order details */
                            const order_details	= this.db.collection(Tables.ORDER_DETAILS);
                            order_details.find({ order_id : {$in : orderIds}},{projection: {order_id:1,remaining_preparation_time:1}}).toArray().then(orderDetailsResult=>{
                                callback(null,orderDetailsResult);
                            }).catch(next);
						},
					},(err,response)=>{
                        if(err) return next(err);

						let orderResult        = response.orders       ? response.orders        :[];
                        let orderDetailsResult = response.order_details? response.order_details	:[];

						/** Insert accepted order list in a array */
                        let orderAcceptedList = [];
                        orderResult.map(orderRecords=>{
                            orderDetailsResult.map(orderDetailsRecords=>{
                                if(orderRecords._id.toString() == orderDetailsRecords.order_id.toString()){
                                    let tmpObj = {
										order_id     : orderRecords._id,
                                        order_number : orderRecords.unique_order_id,
                                        order_submitted_time : orderRecords.created,
                                        restaurant_name : orderRecords.restaurant_name,
                                        restaurant_logo : orderRecords.restaurant_logo,
                                        restaurant_area : orderRecords.area_name,
										remaining_time  : orderDetailsRecords.remaining_preparation_time,
									};

									if(orderRecords.outstanding_order_amount){
										tmpObj.outstanding_order_amount = orderRecords.outstanding_order_amount;
									}

									orderAcceptedList.push(tmpObj);
                                }
                            });
                        });

						/** Send success response  */
                        resolve({
							status 					: 	Constants.STATUS_SUCCESS,
							accepted_order_list 	: 	orderAcceptedList,
							accept_order_count		: 	ordersCount.accept_order_count,
							pick_order_count		: 	ordersCount.pick_order_count,
							delivery_order_count	: 	ordersCount.delivery_order_count,
							restaurant_image_url 	:	Constants.RESTAURANT_FILE_URL
						});
                    });
				});
			}).catch(next);
		}).catch(next);
	};// end getAcceptedOrderList()

	/**
	 * Function to mark order problematic
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	markOrderProblematic (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 		   = Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId		   = (req.body.user_id) 		? new ObjectId(req.body.user_id) 	:"";
			let orderId		   = (req.body.order_id) 	    ? new ObjectId(req.body.order_id)	:"";
			let reason		   = (req.body.reason) 			? req.body.reason 				:"";
			let problemType    = (req.body.problem_type)    ? req.body.problem_type 		:"";
			let problemSubtype = (req.body.problem_subtype) ? req.body.problem_subtype  	:"";

			/** Send error response **/
			if(!userId || !orderId || !problemType || (problemType == Constants.ACCIDENT && !problemSubtype)) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access"), missing_fields : ["user_id","order_id","problem_type","problem_subtype"]});

			const orders =	this.db.collection(Tables.ORDERS);
			const users =	this.db.collection(Tables.USERS);
			asyncParallel({
				order_details : (callback)=>{
					/** Get order details */
					orders.findOne({
						_id 		: 	orderId,
						captain_id	:	userId,
						is_completed:	{$exists: false}
					},{projection:{order_status:1,customer_id:1,branch_id:1,restaurant_id:1,unique_order_id:1}}).then(result => {
						callback(null,result);
					}).catch(next);
				},
				captain_details : (callback)=>{
					/** Set conditions  */
					let userConditions 	= clone(Constants.DRIVER_ASSIGNMENT_CONDITIONS);
					userConditions._id  = userId;
					if(userConditions.is_suspend) delete userConditions.is_suspend;

					/** Get captain details */
					users.findOne(userConditions,{projection: {latitude:1, longitude: 1}}).then(result => {
						callback(null, result);
					}).catch(next);
				},
				voc_list : (callback)=>{
					let deliveryVocOptions ={
						type 		: Constants.VOC_TYPE_FOR_CAPTAIN_ORDER_MARKED_PROBLEMATIC,
						user_type 	: Constants.VOC_FOR_CAPTAIN,
					};

					/** Get voc question list **/
					getUserVocQuestionList(req,res, next,deliveryVocOptions).then(vocResponse=> {
						if(vocResponse.status != Constants.STATUS_SUCCESS) return callback(vocResponse);
						callback(null,vocResponse.questions);
					}).catch(next);
				},
			},(asyncErr,asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				/** Send error response */
				if(!asyncResponse.order_details || !asyncResponse.captain_details){
					return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});
				}

				let vocList 		= 	asyncResponse.voc_list;
				let orderDetails 	= 	asyncResponse.order_details;
				let uniqueOrderId 	= 	orderDetails.unique_order_id;
				let captainDetails 	=	asyncResponse.captain_details;
				let currentStatus	=	(orderDetails.order_status) ? orderDetails.order_status 	:'';
				let branchId	 	=	(orderDetails.branch_id) 	? orderDetails.branch_id 		:'';
				let customerId	 	=	(orderDetails.customer_id) 	? orderDetails.customer_id 		:'';
				let restauarntId 	=	(orderDetails.restaurant_id)? orderDetails.restaurant_id	:'';

				asyncParallel({
					update_order : (childCallback)=>{
						/** Set update data */
						let updateData ={
							$set: {
								problem_type	:	problemType,
								picked_from 	: 	Constants.USER_TYPE_DRIVER,
								pickup_captain_id:	userId,
								pickup_lat		:	captainDetails.latitude,
								pickup_long 	:	captainDetails.longitude,
								modified 		: 	Helpers.getUtcDate(),
							},
						};

						if(problemType ==Constants.OTHERS) 	updateData["$set"].rejection_reason = 	reason;
						if(problemSubtype) 			updateData["$set"].problem_subtype 	=	problemSubtype;

						if(problemType == Constants.ACCIDENT && problemSubtype == Constants.PACKAGE_GETS_DAMAGED){
							updateData["$set"].picked_from = Constants.USER_TYPE_RESTAURANT;
						}

						/** Update order details */
						orders.updateOne({_id: orderId },updateData).then(()=>{
							childCallback(null);
						}).catch(next);
					},
					save_voc : (childCallback)=>{
						if(!vocList || vocList.length ==0) return childCallback(null);

						vocList.map(records=>{
							records.question_id = records._id;

							let tmpAnswer = Constants.ORDER_CANCELED_REASON_TYPE[problemType].title;
							if(reason) tmpAnswer += "("+reason+")";
							if(problemType == Constants.ACCIDENT) tmpAnswer += "("+problemSubtype+")";

							records.answer = tmpAnswer;
						});

						/** Set options for save voc response **/
						let vocOptions = {
							user_type     : Constants.VOC_FOR_CAPTAIN,
							type 		  : Constants.VOC_TYPE_FOR_CAPTAIN_ORDER_MARKED_PROBLEMATIC,
							user_id 	  : userId,
							order_id 	  : orderId,
							question_list : vocList,
							is_not_seen	  : true
						};

						/** Save voc response details**/
						saveVocResponses(req,res, next,vocOptions).then(vocResponse=> {
							if(vocResponse.status != Constants.STATUS_SUCCESS) return childCallback(vocResponse);
							childCallback(null);
						}).catch(next);
					},
					update_driver_details : (childCallback)=>{
						if(problemType != Constants.ACCIDENT && problemType != Constants.CAR_BREAKDOWN) return childCallback(null);

						/** Mark driver account is suspend */
						users.updateOne({_id:userId},{$set: {is_suspend: Constants.SUSPEND,is_highlight: true }}).then(()=>{
							childCallback(null);
						}).catch(next);
					},
				},(childErr)=>{
					if(childErr) return next(childErr);

					/** Save order logs */
					Helpers.saveOrderStatusLogs(req,res,next,{
						updated_by 		: 	userId,
						user_role_id 	: 	DRIVER,
						status 			:	ORDER_PROBLEMATIC,
						order_status	:	currentStatus,
						restaurant_id	:	restauarntId,
						order_id 		:	orderId,
						branch_id		:	branchId,
						user_id			:	customerId,
						user_type		:	Constants.USER_TYPE_DRIVER,
					}).then(()=>{

						/** Send success response */
						resolve({
							status  : Constants.STATUS_SUCCESS,
							message : res.__("order.order_marked_problamatic")
						});

						/** Send notification to fleet or admin */
						insertNotifications(req,res,{
							notification_data : {
								notification_type:	Constants.NOTIFICATION_TO_FLEET_ORDER_MARKED_PROBLEMATIC,
								message_params 	:	[uniqueOrderId],
								parent_table_id : 	orderId,
								user_id 		: 	userId,
								user_role_id 	: 	Constants.DRIVER,
								role_id 		: 	[Constants.CRAVEZ,Constants.FLEET],
								only_for_user_role:	true,
								extra_parameters: 	{
									order_id 	: orderId
								}
							}
						});
					}).catch(next);
				});
			});
		}).catch(next);
	};// end markOrderProblematic()

	/**
	 * Function to get order problemetic reason list
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	orderProblematicReasonList (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body	= 	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let type	=	(req.body.type)	?	req.body.type	:"";

			let reasonList = [];
			Object.keys(Constants.ORDER_CANCELED_REASON_TYPE).map(key=>{
				if(type !="delivered" || key != Constants.ORDER_NOT_READY){
					reasonList.push({
						type 	: key,
						title 	: Constants.ORDER_CANCELED_REASON_TYPE[key].title,
						title_ar: Constants.ORDER_CANCELED_REASON_TYPE[key].title_ar,
					});
				}
			});

			/** Send success response */
			resolve({
				status  : Constants.STATUS_SUCCESS,
				reasons : reasonList
			});
		}).catch(next);
	};// end orderProblematicReasonList()

	/**
	 * Function to get accepted order list
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	updateOrderStatus (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 		= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId		= (req.body.user_id) 	? 	new ObjectId(req.body.user_id)	:"";
			let orderId		= (req.body.order_id) 	? 	new ObjectId(req.body.order_id)	:"";
			let orderStatus	= (req.body.status) 	?	req.body.status 			:"";
			let outstandingOrderAmount=(req.body.outstanding_order_amount)? parseFloat(req.body.outstanding_order_amount) :0;

			/** Send error response **/
			if(!userId || !orderId || !orderStatus) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access"), body: req.body});

			/** Get orders details  */
			const orders = this.db.collection(Tables.ORDERS);
			orders.findOne({_id: orderId }).then(result=>{

				/** Send error response */
				if(!result) return resolve({status:Constants.STATUS_ERROR,message: res.__("system.invalid_access")});

				let customerId 		= 	result.customer_id;
				let paymentMethod 	=	result.payment_method;

				/** Update order status **/
				this.assignmentAPI.updateOrderStatus(req,res,next,req.body).then(response=>{
					if(response.status != Constants.STATUS_SUCCESS) return resolve(response);

					asyncParallel({
						update_outstanding_details: (parentCallback)=>{
							if(!customerId || !outstandingOrderAmount || outstandingOrderAmount <=0  || paymentMethod != Constants.CASH_PAYMENT || orderStatus != Constants.Constants.ORDER_DELIVERED){
								return parentCallback(null);
							}

							/** Pay outstanding amount **/
							this.payUserOrderOutstanding(req,res,next,{user_id: customerId}).then(()=>{
								parentCallback(null);
							}).catch(next);
						},
					},()=>{

						/** Send success response */
						resolve(response);
					});
				}).catch(next);
			}).catch(next);
		}).catch(next);
	};// end updateOrderStatus()

	/**
	 * Function to reorder
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	reOrder (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 		= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId		= (req.body.user_id) 		? 	new ObjectId(req.body.user_id) 	:"";
			let orderId		= (req.body.order_id) 		? 	new ObjectId(req.body.order_id)	:"";
			let deviceId	= (req.body.device_id)		?	req.body.device_id			:"";
			let isModified	= (req.body.is_modified)	? 	JSON.parse(req.body.is_modified) :false;
			let apiType		= 	(req.body.api_type)		?	req.body.api_type			:"";
			let maxModifiedTime	= (req.body.max_modified_time)	?	req.body.max_modified_time :"";

			/** Send error response **/
			if((!userId && !deviceId) || !orderId){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access"), missing_fields: ["user_id","device_id","order_id"] });
			}

			const user_carts = this.db.collection(Tables.USER_CARTS);
			asyncParallel({
				order_details : (callback)=>{
					/** Set order conditions */
					let orderConditions ={
						_id : orderId
					};

					if(userId){
						orderConditions.customer_id =	userId;
					}else{
						orderConditions.device_id 	=	deviceId;
					}

					/** Get order details */
					const orders = 	this.db.collection(Tables.ORDERS);
					orders.findOne(orderConditions,{projection: { _id:1,restaurant_id:1,branch_id:1,area_id:1}}).then(result=>{
						callback(null,result);
					}).catch(next);
				},
				order_item_list : (callback)=>{
					/** Get order item list */
					const order_items = this.db.collection(Tables.ORDER_ITEMS);
					order_items.find({
						order_id : orderId
					},{projection:{parent_item_id: 1, qty: 1,item_id: 1, unit_id: 1, dough_id: 1, selector_id: 1, item_type: 1, extra_items: 1, item_unit_id: 1, unit_lists: 1}}).toArray().then(result=>{
						callback(null,result);
					}).catch(next);
				},
				modified_details : (callback)=>{
					if(!isModified) return callback(null,null);

					/** Set cart conditions */
					let cartConditions = {};
					if(userId){
						cartConditions.customer_id 	=	userId;
					}else{
						cartConditions.device_id 	=	deviceId;
					}

					/** Delete cart item */
					user_carts.deleteMany(cartConditions).then(()=>{
						callback(null);
					}).catch(next);
				}
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				/** Send error response */
				if(!asyncResponse.order_details || asyncResponse.order_item_list.length <=0){
					return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});
				}

				let areaId 			= 	asyncResponse.order_details.area_id;
				let branchId 		= 	asyncResponse.order_details.branch_id;
				let restaurantId	=	asyncResponse.order_details.restaurant_id;

				asyncEach(asyncResponse.order_item_list,(records, eachCallback)=>{
					let unitLists	= (records.unit_lists)	? records.unit_lists	:[];
					let extraItems	= (records.extra_items)	? records.extra_items	:[];

					let tmpBodyObj = {
						user_id		: 	userId,
						device_id	: 	deviceId,
						api_type	: 	apiType,
						area_id		: 	areaId,
						branch_id	: 	branchId,
						restaurant_id: 	restaurantId,
						order_id	: 	(isModified) 			? orderId 				:"",
						item_id 	: 	(records.item_id) 		? records.item_id 		:"",
						qty 		: 	(records.qty) 			? records.qty 			:"",
						unit_id 	: 	(records.unit_id) 		? records.unit_id 		:"",
						dough_id 	: 	(records.dough_id) 		? records.dough_id 		:"",
						selector_id : 	(records.selector_id) 	? records.selector_id 	:"",
						item_type 	: 	(records.item_type) 	? records.item_type 	:"",
						item_unit_id:	(records.item_unit_id)	? records.item_unit_id 	:"",
						max_modified_time: 	maxModifiedTime,
					};

					if(extraItems.length >0){
						let tmpGroupData = {};
						extraItems.map(exData=>{
							let groupId = (exData.group_id) ? exData.group_id :"";
							if(!tmpGroupData[groupId]) tmpGroupData[groupId] = {extra_item_ids:[]};

							tmpGroupData[groupId]["group_id"] = groupId;
							tmpGroupData[groupId].extra_item_ids.push({
								extra_item_id 		: exData.extra_item_id,
								extra_group_item_id : exData.extra_item_group_id,
							});
						});

						tmpBodyObj.extra_items = Object.values(tmpGroupData);
					}

					if(unitLists.length >0){
						let tmpUnitData = [];
						unitLists.map(listData=>{
							let tmpExtraItems= (listData.extra_items)	? listData.extra_items	:[];

							let tmpUnitList = {
								unit_id 	: 	(listData.unit_id) 		? listData.unit_id 		:"",
								dough_id 	: 	(listData.dough_id) 	? listData.dough_id 	:"",
								selector_id : 	(listData.selector_id) 	? listData.selector_id 	:"",
								item_unit_id:	(listData.item_unit_id)	? listData.item_unit_id :"",
							};

							let tmpGroupData = {};
							if(tmpExtraItems.length >0){
								tmpExtraItems.map(exData=>{
									let groupId = (exData.group_id) ? exData.group_id :"";
									if(!tmpGroupData[groupId]) tmpGroupData[groupId] = {extra_item_ids:[]};

									tmpGroupData[groupId]["group_id"] = groupId;
									exData.extra_item_ids.map(tmpExdata=>{
										tmpGroupData[groupId].extra_item_ids.push({
											extra_item_id 		: tmpExdata.extra_item_id,
											extra_group_item_id : tmpExdata.extra_group_item_id,
										});
									});
								});
							}
							tmpUnitList.extra_items = Object.values(tmpGroupData);

							tmpUnitData.push(tmpUnitList);
						});
						tmpBodyObj.unit_lists = tmpUnitData;
					}

					/** Add cart data */
					req.body =	tmpBodyObj;
					this.userCartAPI.updateCart(req,res,next).then(cartResponse=>{
						if(cartResponse.status != Constants.STATUS_SUCCESS) return eachCallback(cartResponse);
						eachCallback(null);
					}).catch(next);
				},(asyncEachErr)=>{

					asyncParallel({
						cart_details : (childCallback)=>{
							if(!asyncEachErr && isModified) return childCallback(null);

							if(asyncEachErr){
								/** Delete cart when error found */
								user_carts.deleteMany({order_id: orderId}).then(()=>{
									childCallback(null);
								}).catch(next);
							}else{
								/** Update cart details */
								user_carts.updateMany({order_id: orderId},{$unset: {order_id: 1}}).then(()=>{
									childCallback(null);
								}).catch(next);
							}
						},
					},(asyncChildErr)=>{
						if(asyncChildErr) return next(asyncChildErr);

						/** Send success response */
						resolve({
							status 	: 	(asyncEachErr) ? Constants.STATUS_ERROR :Constants.STATUS_SUCCESS,
							message :	(asyncEachErr) ? asyncEachErr.message :res.__("orders.item_added_into_cart_successfully")
						});
					});
				});
			});
		}).catch(next);
	};// end reOrder()

	/**
	 * Function to place modifier order
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	placeModifierOrderByCustomer (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 			=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
            let orderId			= 	(req.body.order_id)			?	new ObjectId(req.body.order_id)		:"";
            let userId			= 	(req.body.user_id)			?	new ObjectId(req.body.user_id)		:"";
			let deviceId		= 	(req.body.device_id)		?	req.body.device_id				:"";
			let isWallet 		=	(req.body.is_wallet)		?	JSON.parse(req.body.is_wallet)	:false;
            let paymentCurrency	= 	(req.body.currency)			?	req.body.currency				:"";
            let orderPrice 		=	(req.body.order_price) 		?	req.body.order_price			:0;
            let paymentMethod 	=	(req.body.payment_method) 	?	req.body.payment_method			:"";
			let paymentResponse	= 	(req.body.payment_response)	?	req.body.payment_response		:"";
			let isUsedPoints 	=	(req.body.is_used_points)	?JSON.parse(req.body.is_used_points):false;
			let walletDebitAmount=	(req.body.wallet_amount)	?	parseFloat(req.body.wallet_amount):0;

			/** Send error response **/
			if((!userId && !deviceId) || !orderId || (paymentResponse && (!paymentMethod ||!paymentCurrency || !orderPrice || isNaN(orderPrice)))){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access"), missing_fields: ["user_id","device_id","order_id","payment_response","payment_method","currency","order_price"] });
			}

			const orders  		= 	this.db.collection(Tables.ORDERS);
			const order_details = 	this.db.collection(Tables.ORDER_DETAILS);
			const order_items  	=	this.db.collection(Tables.ORDER_ITEMS);
			const offer_logs  	= 	this.db.collection(Tables.OFFER_LOGS);
			asyncParallel({
				order_details: (parentCallback)=>{
					/** Set order conditions */
					let orderConditions = {_id: orderId};

					if(userId){
						orderConditions.customer_id =	userId;
					}else{
						orderConditions.device_id 	=	deviceId;
					}

					/** Get order details */
					orders.findOne(orderConditions,{projection: {main_order_id:1,order_price:1, is_guest:1,paid_amount:1, unique_order_id: 1,customer_id:1}}).then(orderResult=>{
						parentCallback(null, orderResult);
					}).catch(next);
				},
				cart_list: (parentCallback)=>{
					/** Get cart list */
					let cartOptions = clone(req.body);
					cartOptions.is_place_order = true;
					cartOptions.is_place_modified_order = true;
					this.userCartAPI.getUserCartList(req,res,next,cartOptions).then(response=>{
						parentCallback(null,response);
					}).catch(next);
				},
				offer_log_details: (parentCallback)=>{
					/** Get offer logs details */
					offer_logs.findOne({order_id: orderId },{projection: {order_discount:1,offer_id:1}}).then(logResult=>{
						parentCallback(null, logResult);
					}).catch(next);
				},
				offer_log_details: (parentCallback)=>{
					/** Get offer logs details */
					offer_logs.findOne({order_id: orderId },{projection: {order_discount:1,offer_id:1}}).then(logResult=>{
						parentCallback(null, logResult);
					}).catch(next);
				},
				get_modify_log_details: (parentCallback)=>{
					/** Get order modify logs details */
					const order_modify_logs = 	this.db.collection(Tables.ORDER_MODIFY_LOGS);
					order_modify_logs.findOne({order_id: orderId },{projection: {_id:1}}).then(logResult=>{
						parentCallback(null, logResult);
					}).catch(next);
				},
				item_list: (parentCallback)=>{
					/** Get order modify logs details */
					const order_items  	=	this.db.collection(Tables.ORDER_ITEMS);
					order_items.find({order_id: orderId},{projection:{_id:0,add_by_admin:0,last_qty:0}}).toArray().then(orderResult=>{
						parentCallback(null, orderResult);
					}).catch(next);
				},
			},(parentErr,parentResponse)=>{
				if(parentErr) return next(parentErr);

				/** Send error response */
				if(parentResponse.cart_list.status != Constants.STATUS_SUCCESS) return resolve(parentResponse.cart_list);

				let oldItemList  	=	parentResponse.item_list;
				let cartList  		=	parentResponse.cart_list.result;
				let grandTotal 		=	parentResponse.cart_list.grand_total;
				let orderDetails	=	parentResponse.order_details;
				let offerlogDetails	=	parentResponse.offer_log_details;
				let orderModifyLog	=	parentResponse.get_modify_log_details;
				let isLogExists		=	(orderModifyLog) ? true :false;

				/** Send error response **/
				if(cartList.length <=0 || !orderDetails){
					return resolve({status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });
				}

				/** Check all branch or item available or not */
				let cartDetails	 	=	cartList[0];
				let branchAvailable	= 	true;
				let itemAvailable	=	true;
				let orderNetAmount	=	0;
				let orderCustomerId = 	orderDetails.customer_id;
				let paidAmount	 	=	orderDetails.paid_amount;
				let mainOrderId	 	=	orderDetails.main_order_id;
				let uniqueOrderId	=	orderDetails.unique_order_id;
				let isGuest			=	orderDetails.is_guest;
				let oldOrderPrice	=	orderDetails.order_price;
				let orderTotalAmount=	(paidAmount) ? paidAmount :oldOrderPrice;
				let totalRemaining	=	0;
				let isOutStanding	=	false;

				if(orderTotalAmount < grandTotal){
					isOutStanding 	= true;
					totalRemaining 	= grandTotal-orderTotalAmount;
				}else{
					totalRemaining 	= orderTotalAmount-grandTotal;
				}

				if(isOutStanding){
					/** Payment missing parameter */
					let missingObject     = {};
					let missingParameters = false;
					if(paymentMethod != Constants.CASH_PAYMENT && paymentMethod != Constants.WALLET_PAYMENT){
						if(!paymentMethod || !paymentResponse || !paymentCurrency || !orderPrice){
							missingParameters = true;

							if(!paymentMethod) 	 missingObject.payment_method 	= true;
							if(!paymentResponse) missingObject.payment_response = true;
							if(!paymentCurrency) missingObject.currency 		= true;
							if(!orderPrice) 	 missingObject.order_price 		= true;
						}
					}

					/** Send error response */
					if(missingParameters){
						return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access"), missing_fields: Object.keys(missingObject) });
					}
				}

				if(!cartDetails.branch_available)  	branchAvailable = false;
				if(cartDetails.branch_open != Constants.OPEN) branchAvailable = false;
				cartDetails.item_list.map(itemData=>{
					if(!itemData.item_available)  itemAvailable = false;

					orderNetAmount += itemData.sub_price;
				});

				/** Send error response **/
				if(!branchAvailable || !itemAvailable){
					let message = (!branchAvailable) ? res.__("order.branch_not_available") : res.__("order.item_not_available");
					return resolve({status: Constants.STATUS_ERROR, message: message });
				}

				let restaurantId 	= 	cartDetails.restaurant_id;
				let branchId 		= 	cartDetails.branch_id;
				let itemList 	 	=	cartDetails.item_list;
				let tmpOfferId  	= 	cartDetails.offer_id;
				let currentDiscount = 	(cartDetails.discount) ? cartDetails.discount :0;
				let isDoubleCashback=(cartDetails.is_double_cashback) ? cartDetails.is_double_cashback :"";
				let lastOfferId 	=   "";
				let lastOfferAmount =   0;
				let lastOfferlogId 	=   "";
				let bothOfferSame   =	false;

				if(offerlogDetails){
					lastOfferlogId 	= (offerlogDetails._id) 		? offerlogDetails._id 	:"";
					lastOfferId 	= (offerlogDetails.offer_id) 	? offerlogDetails.offer_id :"";
					lastOfferAmount = (offerlogDetails.order_discount) ? offerlogDetails.order_discount :0;
					bothOfferSame	= (String(lastOfferId) == tmpOfferId) ? true :false;
				}

				const offer_used    = 	this.db.collection(Tables.OFFER_USED);
				const tmp_offer_logs= 	this.db.collection(Tables.TMP_OFFER_LOGS);
				const user_carts 	= 	this.db.collection(Tables.USER_CARTS);
				const restaurants 	= 	this.db.collection(Tables.RESTAURANTS);

				asyncParallel({
					save_modify_details: (childCallback)=>{
						if(isLogExists) return childCallback(null);

						/** Save order details */
						this.saveOrderDetails(req,res,next,{order_id: orderId, modified_by: orderCustomerId}).then(response=>{
							if(response.status != Constants.STATUS_SUCCESS) return childCallback(response.message);
							childCallback(null);
						}).catch(next);
					},
					restaurant_concept_id: (childCallback)=>{
						/** Set conditions */
						let restaurantConditions = {
							_id			:	new ObjectId(restaurantId),
							concept_id	:	{$exists : true, $ne: ""}
						};

						/** Get restaurant details */
						restaurants.findOne(restaurantConditions,{projection: {concept_id:1}}).then(restResult=>{
							let conceptId = (restResult && restResult.concept_id) ? restResult.concept_id :null;
							childCallback(null, conceptId);
						}).catch(next);
					},
				},(childParallelErr,childParallelResponse)=>{
					if(childParallelErr) return next(childParallelErr);

					let restaurantConceptId		=	childParallelResponse.restaurant_concept_id;
					let remainingAmount 		=	0;
					let finalWalletDebitAmount 	=	0;
					asyncParallel({
						delete_old_item: (parentCallback)=>{
							/** Delete order old items */
							order_items.deleteMany({order_id: orderId }).then(deleteResult=>{
								parentCallback(null, deleteResult);
							}).catch(next);
						},
						save_offer_logs: (parentCallback)=>{
							/** This use only when offer is different */
							if(!offerlogDetails|| !tmpOfferId || bothOfferSame){
								return parentCallback(null);
							}

							/** Set offer used conditions */
							let offerUsedConditions = {
								offer_id : 	new ObjectId(lastOfferId),
							};

							if(userId){
								offerUsedConditions.user_id 	= 	userId;
							}else{
								offerUsedConditions.device_id	=	mainDeviceId;
							}

							/** Update offer used */
							offer_used.updateOne(offerUsedConditions,{
								$set :{
									modified: 	Helpers.getUtcDate()
								},
								$inc :{
									offer_used 			: -1,
									total_amount_used 	: lastOfferAmount*-1,
								},
								$pull :{
									offer_log_ids : lastOfferlogId,
								},
							}).then(()=>{

								/** Delete logs */
								offer_logs.deleteOne({_id: lastOfferlogId }).then(()=>{
									parentCallback(null);
								}).catch(next);
							}).catch(next);
						},
						update_offer_value: (parentCallback)=>{
							if(!offerlogDetails|| !tmpOfferId || !bothOfferSame || lastOfferAmount == currentDiscount){
								return parentCallback(null);
							}

							/** This use only when offer same but discount different */
							let adjustDiscount =  currentDiscount-lastOfferAmount;

							offer_logs.updateOne({
								_id : new ObjectId(lastOfferlogId)
							},
							{$set :{
								order_price	   : Helpers.round(orderNetAmount),
								order_discount : currentDiscount,
								modified	   : Helpers.getUtcDate()
							}}).then(() => {

								/** Update offer used */
								offer_used.updateOne({
									offer_log_ids : {$in: [new ObjectId(lastOfferlogId)]}
								},
								{$inc :{
									total_amount_used : adjustDiscount,
								}}).then(() => {
									parentCallback(null);
								}).catch(next);
							}).catch(next);

						},
						update_wallet: (parentCallback)=>{
							if(!walletDebitAmount || walletDebitAmount<=0 || !userId || !isOutStanding || totalRemaining<=0){
								remainingAmount += totalRemaining;
								return parentCallback(null);
							}

							let tmpDebitAmount =  0;
							if(walletDebitAmount >= totalRemaining){
								walletDebitAmount = walletDebitAmount-totalRemaining;
								tmpDebitAmount 	  = totalRemaining;
							}else{
								walletDebitAmount = 0;
								tmpDebitAmount 	  = walletDebitAmount;
							}

							/** Set wallet options */
							finalWalletDebitAmount = tmpDebitAmount;
							let walletOptions = {
								user_id      	: userId,
								amount       	: tmpDebitAmount,
								transaction_type: Constants.DEBIT,
								order_id		: mainOrderId,
								is_used_points	: isUsedPoints,
								is_double_cashback: isDoubleCashback,
								extra_parameters:{
									order_id 		: orderId,
									branch_id 		: branchId,
									restaurant_id 	: restaurantId,
									order_place 	: true,
								}
							};

							/** Update wallet  */
							Helpers.updateWalletBalance(req,res,next,walletOptions).then(walletResponse=>{
								if(walletResponse.status != Constants.STATUS_SUCCESS) return parentCallback(walletResponse);

								remainingAmount += (walletResponse.remaining_amount) ? walletResponse.remaining_amount :0;

								parentCallback(null,walletResponse.transaction_id);
							}).catch(next);
						},
					},(parentParallelErr)=>{
						if(parentParallelErr) return next(parentParallelErr);

						/** Set order save details  */
						let orderStatus		=	Constants.ORDER_SUBMITTED;
						let orderSaveData 	= 	{
							$set : {
								order_price		:	grandTotal,
								net_amount		:	Helpers.round(orderNetAmount),
								order_status	:	orderStatus,
								is_confirm		:	false,
								is_modified		:	true,
								queue_time		:	Helpers.getUtcDate(),
								number_of_queue : 	Constants.FIRST_REQUEUE_ORDER,
								is_big_order	:	(orderNetAmount >= Constants.BIG_ORDER_AMOUNT) ? true :false,
								kfg_offer_id	:	(cartDetails.kfg_offer_id) 	 ?	cartDetails.kfg_offer_id 	:"",
								kfg_offer_name	:	(cartDetails.kfg_offer_name) ? 	cartDetails.kfg_offer_name 	:"",
								modified		:	Helpers.getUtcDate(),
							},
							$inc : {
								amount_debited_by_wallet : finalWalletDebitAmount
							}
						};

						if(isOutStanding){
							orderSaveData["$set"].outstanding_amount 	= 	totalRemaining;
							orderSaveData["$set"].outstanding_payment	=	Constants.UNPAID;
						}

						if(!userId)   orderSaveData["$set"].modified_by = userId;
						if(!paidAmount) orderSaveData["$set"].paid_amount = oldOrderPrice;

						if(isOutStanding && paymentMethod == Constants.KNET){
							let onlinePaymentAmount = totalRemaining-finalWalletDebitAmount;
							let knetValue	=	(res.locals.settings['Site.knet_charges']) ? res.locals.settings['Site.knet_charges'] :0;
							let knetCharges	=(knetValue) ? (onlinePaymentAmount * knetValue)/Constants.MAX_PERCENTAGE :0;

							orderSaveData["$inc"].total_knet_amount = 	onlinePaymentAmount;
							orderSaveData["$inc"].knet_charges		=	Helpers.round(knetCharges);
						}

						/** Save order details */
						orders.updateOne({_id: orderId },orderSaveData).then(()=>{

							let paymentCartIds 	=	[];
							asyncParallel({
								order_details : (callback)=>{
									let deliveryTime 	= 	(cartDetails.delivery_time) 	? cartDetails.delivery_time :Constants.DEFAULT_DELIVERY_TIME;
									let preparationTime = 	(cartDetails.preparation_time) 	? cartDetails.preparation_time :Constants.DEFAULT_PREPARATION_TIME;

									/** Set order details  */
									let orderDetailsData = {
										total_amount	: 	grandTotal,
										net_amount		: 	Helpers.round(orderNetAmount),
										discount_price 	: (cartDetails.discount) ? cartDetails.discount :0,
										offer_id		: 	cartDetails.offer_id,
										offer_code		: (cartDetails.offer_code)?cartDetails.offer_code :"",
										offer_type		: (cartDetails.offer_type)?cartDetails.offer_type :"",
										delivery_fee 	:(cartDetails.delivery_fees)?cartDetails.delivery_fees:0,
										additional_tax	 : 	cartDetails.additional_tax,
										delivery_duration: 	deliveryTime,
										elapsed_time	 : 	deliveryTime,
										preparation_time : 	preparationTime,
										remaining_preparation_time	: 	preparationTime,
										remaining_delivery_duration	: 	deliveryTime,
									};

									if(cartDetails.additional_tax_percentage){
										orderDetailsData.additional_tax_percentage = cartDetails.additional_tax_percentage;
									}

									if(cartDetails.composite_id){
										orderDetailsData.composite_id =	new ObjectId(cartDetails.composite_id);

										if(cartDetails.composite_discount){
											orderDetailsData.composite_discount =	cartDetails.composite_discount;
										}
										if(cartDetails.composite_delivery_fees){
											orderDetailsData.composite_delivery_fees =	cartDetails.composite_delivery_fees;
										}
									}

									if(cartDetails.corporate_id){
										orderDetailsData.corporate_id =	new ObjectId(cartDetails.corporate_id);

										if(cartDetails.corporate_discount){
											orderDetailsData.corporate_discount =	cartDetails.corporate_discount;
										}
										if(cartDetails.corporate_delivery_fees){
											orderDetailsData.corporate_delivery_fees =	cartDetails.corporate_delivery_fees;
										}
									}

									/** Save order details */
									order_details.updateOne({order_id: orderId },{$set: orderDetailsData}).then(()=>{
										callback(null);
									}).catch(next);
								},
								order_items : (callback)=>{
									/** Manage item save data */
									let itemSaveData 	= [];
									let modifierItemData= [];
									itemList.map(itemData=>{
										let itemDiscount = (itemData.discount) ? itemData.discount:0;
										let subPrice 	 = (itemData.sub_price) ? itemData.sub_price:0;

										let tempObj = {
											order_id 		: 	orderId,
											parent_item_id 	: 	itemData.parent_item_id,
											qty 			: 	itemData.qty,
											item_name 		: 	itemData.item_name,
											item_image 		:	itemData.item_image,
											item_id 		: 	itemData.item_id,
											unit_id 		: 	itemData.unit_id,
											dough_id 		: 	itemData.dough_id,
											selector_id 	: 	itemData.selector_id,
											item_type 		:	itemData.item_type,
											item_main_price :	itemData.item_main_price,
											cuisine_ids 	: (itemData.cuisine_ids) ? itemData.cuisine_ids :[],
											extra_items 	:	[],
											price			:	itemData.item_price,
											sub_total		:	Helpers.round(subPrice-itemDiscount),
											discounted_price:	itemDiscount,
											net_amount		:	subPrice,
											created 		:	Helpers.getUtcDate(),
											add_by_admin	:	itemData.add_by_admin,
											last_qty		:	itemData.last_qty,
											cart_created	:	itemData.created,
										};

										if(itemData.item_unit_id){
											tempObj.item_unit_id =itemData.item_unit_id;
										}

										if(itemData.unit_lists && itemData.unit_lists.length >0){
											tempObj.unit_lists = itemData.unit_lists;
										}

										/** Manage extra items  */
										if(itemData.extra_items && itemData.extra_items.length >0){
											itemData.extra_items.map(extraItemData=>{
												let groupId = extraItemData.group_id;

												extraItemData.extra_item_ids.map(exItemData=>{

													tempObj.extra_items.push({
														group_id			:	groupId,
														extra_item_id		:	exItemData.extra_item_id,
														is_first_component	:	exItemData.is_first_component,
														extra_item_group_id	:	exItemData.extra_group_item_id,
														extra_item_name		:	exItemData.extra_item_name,
														price				:	exItemData.extra_fees
													});
												});
											});
										}

										itemSaveData.push(tempObj);

										let modifierTmpObj 		=	clone(tempObj);
										modifierTmpObj.is_new	=	true;
										modifierItemData.push(modifierTmpObj);
									});

									/** Save order item details */
									order_items.insertMany(itemSaveData).then(()=>{
										callback(null);
									}).catch(next);
								},
								remove_offer_logs : (callback)=>{
									let cartIds = [];
									itemList.map(itemData=>{
										cartIds.push(itemData._id);
										paymentCartIds.push(itemData._id);
									});

									asyncParallel({
										remove_offer_logs : (subCallback)=>{
											/** Delete logs  */
											tmp_offer_logs.deleteMany({
												cart_ids : {$in: cartIds}
											}).then(()=>{
												subCallback(null);
											}).catch(next);
										},
										update_order_id : (subCallback)=>{
											/** update logs  */
											offer_logs.updateMany({
												cart_ids : {$in: cartIds}
											},
											{
												$set: {
													order_id : orderId,
													modified : Helpers.getUtcDate(),
												},
												$unset: {
													cart_ids : 1
												},
											}).then(()=>{
												subCallback(null);
											}).catch(next);
										},
										remove_cart : (subCallback)=>{
											/** Remove carts  */
											user_carts.deleteMany({_id: {$in: cartIds} }).then(()=>{
												subCallback(null);
											}).catch(next);
										},
									},(subParallelErr)=>{
										callback(subParallelErr);
									});
								},
								update_outstanding_amount : (callback)=>{
									if(isOutStanding || totalRemaining<=0) return callback(null);

									/** Set refund options */
									let refundOptions	=	{
										order_id		: 	orderId,
										user_id 		: 	userId,
										device_id 		: 	deviceId,
										is_guest		:	isGuest,
										total_refund	:	totalRemaining,
										total_amount	:	orderTotalAmount,
										unique_order_id:	uniqueOrderId
									};
									callRefundAmount(req,res,next,refundOptions).then(refundResponse=>{
										if(refundResponse.status != Constants.STATUS_SUCCESS) return callback(refundResponse);

										callback(null);
									}).catch(next);
								},
							},(asyncParallelErr)=>{
								if(asyncParallelErr) return next(asyncParallelErr);

								/** Save order type */
								this.saveOrderDetails(req,res,next,{order_id: orderId, modified_by: orderCustomerId, old_item_list: oldItemList}).then(response=>{
									if(response.status != Constants.STATUS_SUCCESS) return next(response.message);

									asyncParallel({
										place_order: (childAsyncCallback)=>{
											if(!restaurantConceptId) return childAsyncCallback(null);

											childAsyncCallback(null);

											/** Place KFG Order */
											this.callAfterPlaceOrder(req,res,next,{
												order_id 			:	orderId,
												is_modify			:	true
											});
										},
										update_gateway_charges : (callback)=>{
											req.body.order_id = orderId;
											this.updatePaymentMethodCharges(req,res,next,{order_id : orderId}).then(updateResponse=>{
												if(updateResponse.status != Constants.STATUS_SUCCESS) return callback(updateResponse.message);
												callback(null);
											}).catch(next);
										}
									},(childAsyncParallelErr)=>{
										if(childAsyncParallelErr) return next(childAsyncParallelErr);

										/** Send success response  */
										resolve({status: Constants.STATUS_SUCCESS, message: res.__("order.order_has_been_placed_successfully"), outstanding_amount: totalRemaining, remaining_amount :remainingAmount });

										/** Calculate order payout */
										Helpers.calculateOrderPayout(req,res,next,{order_id:orderId}).then(()=>{});

										/** Save order type */
										this.updateOrderType(req,res,next,{
											user_id 		: 	userId,
											device_id 		: 	deviceId,
											main_order_id 	:	mainOrderId,
										}).then((response)=>{

											let isNotConfirm =	response.is_not_confirm;
											if(isNotConfirm && orderStatus!=Constants.ORDER_SCHEDULED){
												orderStatus = Constants.ORDER_PENDING;
											}

											Helpers.saveOrderStatusLogs(req,res,next,{
												order_id 		: 	orderId,
												restaurant_id	:	restaurantId,
												updated_by 		: 	userId,
												user_id 		: 	userId,
												user_role_id	:	(userId) ? Constants.CUSTOMER				:"",
												user_type		:	(userId) ? Constants.USER_TYPE_CUSTOMER	:"",
												is_customer		:	(userId) ? true	: false,
												device_id 		: 	deviceId,
												status 			:	orderStatus,
												order_status 	:	orderStatus,
												is_modified     :   true,
												is_admin		:   false,
												is_user			:   false
											}).then(()=>{});
										});

										/** Save payment details */
										if(paymentResponse){
											this.saveUserPaymentDetails(req,res,next,{
												user_id 			: 	userId,
												device_id 			: 	deviceId,
												order_ids 			:	[orderId],
												cart_ids 			:	paymentCartIds,
												payment_method 		:	paymentMethod,
												payment_status 		:	Constants.PAYMENT_SUCCESS,
												payment_response 	:	paymentResponse,
												currency 			:	paymentCurrency,
												amount 				:	orderPrice
											}).then(()=>{ });
										}

										if(isOutStanding){
											sendMailToUsers(req,res,{
												event_type 			: Constants.NOTIFICATION_OVERSTANDING_PAYMENT_MODIFY_ORDER,
												order_id			: orderId,
												unique_order_id		: uniqueOrderId,
												amount				: Helpers.currencyFormat(totalRemaining),
												customer_id			: userId,
											});
										}
									});
								}).catch(next);
							});
						}).catch(next);
					});
				});
			});
        }).catch(next);
	};// end placeModifierOrderByCustomer()

	/**
	 * Function to modify order
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	modifyOrder (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 		= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId		= (req.body.user_id) 	? 	new ObjectId(req.body.user_id) 	:"";
			let orderId		= (req.body.order_id) 	? 	new ObjectId(req.body.order_id)	:"";
			let deviceId	= (req.body.device_id)	?	req.body.device_id				:"";

			/** Send error response **/
			if((!userId && !deviceId) || !orderId){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access"), missing_fields: ["user_id","device_id","order_id"] });
			}

			asyncParallel({
				order_details : (callback)=>{
					/** Set order conditions */
					let orderConditions ={
						_id : orderId,
						$or : [
							{is_completed: {$exists: false}},
							{is_completed: {$ne: true}}
						]
					};

					if(userId){
						orderConditions.customer_id =	userId;
					}else{
						orderConditions.device_id 	=	deviceId;
					}

					/** Get order details */
					const orders = 	this.db.collection(Tables.ORDERS);
					orders.findOne(orderConditions,{projection:{order_date:1}}).then(result=>{
						callback(null,result);
					}).catch(next);
				},
				order_sub_details : (callback)=>{
					/** Get order sub details */
					const order_details = 	this.db.collection(Tables.ORDER_DETAILS);
					order_details.findOne({order_id: orderId},{projection:{preparation_time:1}}).then(result=>{
						callback(null,result);
					}).catch(next);
				},
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				/** Send error response */
				if(!asyncResponse.order_details || !asyncResponse.order_sub_details){
					return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});
				}

				let orderDetails 	=	asyncResponse.order_details;
				let orderSubDetails =	asyncResponse.order_sub_details;
				let orderDate		= 	orderDetails.order_date;
				let preparationTime = 	orderSubDetails.preparation_time;
				let isModifiedAllow = 	false;
				let maxModifiedTime	=	"";
				if(preparationTime){
					let preparationHours= (preparationTime/Constants.MAX_ORDER_MODIFY_DIVIDED)/Constants.MINUTES_IN_A_HOUR;
					maxModifiedTime 	= Helpers.newDate(Helpers.addDaysToDate(preparationHours,orderDate));
					let currentTime    	= Helpers.newDate();

					if(maxModifiedTime > currentTime) isModifiedAllow = true;
				}

				/** Send error response */
				if(!isModifiedAllow){
					return resolve({status : Constants.STATUS_ERROR, message : res.__("orders.not_allowed_to_modify_this_order")});
				}

				/** Add item in cart */
				req.body.is_modified 		= 	true;
				req.body.max_modified_time	=	maxModifiedTime;
				this.reOrder(req,res,next).then(response=>{
					resolve(response);
				}).catch(next);
			});
		}).catch(next);
	};// end modifyOrder()

	/**
	 * Function to cancel modify order
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	cancelModifyOrder (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 		= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId		= (req.body.user_id) 	? 	new ObjectId(req.body.user_id) 	:"";
			let orderId		= (req.body.order_id) 	? 	new ObjectId(req.body.order_id)	:"";
			let deviceId	= (req.body.device_id)	?	req.body.device_id			:"";

			/** Send error response **/
			if((!userId && !deviceId) || !orderId){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access"), missing_fields: ["user_id","device_id","order_id"] });
			}

			/** Set cart conditions */
			let cartConditions = {order_id: orderId};

			if(userId){
				cartConditions.customer_id 	=	userId;
			}else{
				cartConditions.device_id 	=	deviceId;
			}

			/** Delete cart list */
			const user_carts = this.db.collection(Tables.USER_CARTS);
			user_carts.deleteMany(cartConditions).then(()=>{

				/** Send success response */
				resolve({status: Constants.STATUS_SUCCESS, message: res.__("orders.items_have_been_removed_from_modified_list") });
			}).catch(next);
		}).catch(next);
	};// end cancelModifyOrder()

	/**
	 * Function to add order review
	 *
	 * @param req	As	Request Data
	 * @param res	As 	Response Data
	 * @param next 	As Callback
	 *
	 * @return json
	 **/
	addOrderReview (req,res,next){
		return new Promise(async resolve=>{
			/** Sanitize Data **/
			req.body 			= 	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let orderId 		=	(req.body.order_id) 		? 	new ObjectId(req.body.order_id) 	:"";
			let orderUniqueId	=	(req.body.order_unique_id)	?	req.body.order_unique_id 			:"";
			let restaurantId	=	(req.body.restaurant_id)	? 	new ObjectId(req.body.restaurant_id):"";
			let userId 			=	(req.body.user_id) 			? 	new ObjectId(req.body.user_id) 		:"";
			let branchId		=	(req.body.branch_id)		?	new ObjectId(req.body.branch_id)	:"";
			let rating 			= 	(req.body.rating)			?	parseFloat(req.body.rating)			:0;
			let review			=	(req.body.review) 			? 	req.body.review 					:"";

			/** Send error response **/
			if(!orderId || !restaurantId || !userId || !branchId|| !orderUniqueId) return resolve({status:Constants.STATUS_ERROR, message:res.__("system.invalid_access"),missing_fields:["order_id","restaurant_id","order_unique_id","user_id","branch_id","order_unique_id"]});

			/** Apply validation */
			let validationResponse = await Helpers.applyValidationInterCallFunction(req, res, next, addReviewValidation);
			if(validationResponse.status != Constants.STATUS_SUCCESS) return resolve(validationResponse);

			/** Get order review rating details   */
			const order_review_ratings	= this.db.collection(Tables.ORDER_REVIEW_RATINGS);
			order_review_ratings.findOne({
				user_id 		: 	userId,
				restaurant_id 	: 	restaurantId,
				type			:	Constants.RATING_TO_RESTAURANT,
				branch_id 		: 	branchId,
				order_id 		: 	orderId,
			}).then(orderReviewDetails=>{

				/** Send error response */
				if(orderReviewDetails) return resolve({status: Constants.STATUS_ERROR, message: res.__("orders.rating_already_given")});

				let currentRatingId = new ObjectId();
				asyncParallel({
					save_rating : (callback)=>{
						/**
						 * Save rating
						 * branch_id is the branch who receiving rating
						 **/
						order_review_ratings.insertOne({
							_id					:	currentRatingId,
							user_id 			: 	userId,
							type				:	Constants.RATING_TO_RESTAURANT,
							order_id 			: 	orderId,
							restaurant_id 		: 	restaurantId,
							branch_id 			: 	branchId,
							order_unique_number	:	orderUniqueId,
							rating 				:	rating,
							review 				: 	review,
							created 			:	Helpers.getUtcDate(),
						}).then(insertResult=>{
							callback(null,insertResult);
						}).catch(next);
					},
					rating_list : (callback)=>{
						/** Branch rating list  **/
						order_review_ratings.find({
							restaurant_id 	:	restaurantId,
							branch_id		:	branchId,
							_id				:	{$ne:currentRatingId},
						},{projection: {rating:1}}).toArray().then(result=>{
							callback(null, result);
						}).catch(next);
					},
				},(asyncErrs,asyncResponse)=>{
					if(asyncErrs) return next(asyncErrs);

					let ratingList	=	(asyncResponse.rating_list)	? asyncResponse.rating_list	:[];
					let ratingCount	=	ratingList.length+1;
					let totalRating	=	rating;
					if(ratingList.length >0){
						ratingList.map(records=>{
							if(records.rating)  totalRating += parseFloat(records.rating);
						});
					}

					/** Calculate rating */
					let avgRating  = (totalRating && ratingCount) ? Helpers.round(totalRating/ratingCount,0) :0;

					/** Update restaurant branches rating **/
					const restaurant_branches= this.db.collection(Tables.RESTAURANT_BRANCHES);
					restaurant_branches.updateOne({
						_id			 : 	branchId,
						restaurant_id:	restaurantId
					},
					{$set : {
						rating 		:	avgRating,
						modified	:	Helpers.getUtcDate(),
					}}).then(() => {

						/** Send success response **/
						resolve({
							status	: 	Constants.STATUS_SUCCESS,
							message	:	res.__("orders.rating_has_been_added_successfully")
						});
					}).catch(next);
				});
			}).catch(next);
		}).catch(next);
	};// end addOrderReview()

	/**
	 * Function to place interrupt order
	 *
	 * @param req	As	Request Data
	 * @param res	As 	Response Data
	 * @param next 	As Callback
	 * @param options 	As Callback
	 *
	 * @return json
	 **/
	placeInterruptOrder (req,res,next,options={}){
		return new Promise(resolve=>{
			let orderId	=	(options.order_id)	?	new ObjectId(options.order_id)	:"";

			/** Send error response **/
			if(!orderId) return resolve({status:Constants.STATUS_ERROR, message:res.__("system.invalid_access"), missing_fields:["order_id"]});

			const orders 		= 	this.db.collection(Tables.ORDERS);
			const order_items	= 	this.db.collection(Tables.ORDER_ITEMS);
			const order_details = 	this.db.collection(Tables.ORDER_DETAILS);
			asyncParallel({
				order_details : (callback)=>{
					/** Get order details */
					orders.aggregate([
						{$match : {
							_id : orderId
						}},
						{$lookup : {
							from 		 : Tables.USERS,
							localField 	 : "customer_id",
							foreignField : "_id",
							as 			 : "user_details"
						}},
						{$addFields :{
							user_device_type : {$arrayElemAt : ["$user_details.device_details",0]}
						}},
						{$project : {
							_id:0,is_big_order:1, delivery_fee:1, is_confirm:1,order_status:1,net_amount:1,order_price:1, restaurant_name:1, restaurant_id:1, payment_method:1, area_name:1, area_id:1, branch_id:1, request_note:1, delivery_type:1, is_guest:1, customer_id:1, device_id:1, package_id:1, package_delivery_fees:1, is_infinity_user:1, user_mobile_number: {$arrayElemAt : ["$user_details.mobile_number",0]}, payment_id: 1, is_duplicate_order:1, amount_debited_by_wallet: 1, is_first_order:1, is_vip:1,user_device_type: {$arrayElemAt : ["$user_device_type.device_type",0]},full_name:1,first_name:1,last_name:1,mobile_number:1,kfg_order: 1,kfg_offer_id:1,kfg_offer_name:1
						}}
					]).toArray().then(result=>{
						callback(null,result?.[0] ||null);
					}).catch(next);
				},
				order_sub_details : (callback)=>{
					/** Get order sub details */
					order_details.findOne({
						order_id: orderId
					},{projection:{
						_id:0, offer_type:1, offer_id:1, offer_code:1, total_amount:1, net_amount:1,discount_price:1, restaurant_long_lat:1, restaurant_longitude:1, restaurant_latitude:1, restaurant_address:1, delivery_fee:1, customer_longitude:1, customer_long_lat:1, customer_latitude:1, delivery_area_id:1, customer_address:1,
						branch_discount_type:1, branch_discount:1, branch_extra_charge: 1, branch_extra_charge_type: 1,  corporate_delivery_fees:1, corporate_discount:1, corporate_id:1, customer_address_id:1, customer_id:1, device_id:1, offer_discount:1, offer_delivery_fees:1, preparation_time:1, delivery_duration:1, payment_method:1, additional_tax:1,additional_tax_percentage:1,
						composite_id:1, composite_discount:1,composite_delivery_fees:1
					}}).then(result=>{
						callback(null,result);
					}).catch(next);
				},
				item_list : (callback)=>{
					/** Get order item list */
					order_items.find({
						order_id: orderId
					},{projection:{
						_id: 0, parent_item_id: 1, qty: 1, item_name: 1, item_image: 1, item_id: 1, unit_id: 1, dough_id: 1, selector_id: 1, item_type: 1, note: 1, extra_items: 1, price: 1, sub_total: 1, discounted_price: 1, item_main_price:1, net_amount: 1, item_unit_id: 1, cuisine_ids: 1, unit_lists: 1,cart_created:1
					}}).toArray().then(result=>{
						callback(null,result);
					}).catch(next);
				},
				today_order_count: (callback)=>{
					/** Get order count  */
					let currentDate 		= Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));
					const unique_order_ids 	= this.db.collection(Tables.UNIQUE_ORDER_IDS);
					unique_order_ids.findOneAndUpdate({
						order_date: {$gte: currentDate},
					},
					{
						$inc : {
							order_count: 1
						},
						$setOnInsert: {
							order_date : currentDate,
						}
					},{upsert:true, projection :{order_count: 1}}).then(orderCount=>{
						orderCount = (orderCount?.order_count || 0)+1;
						callback(null,orderCount);
					}).catch(next);
				},
				main_order_id: (parentCallback)=>{
					return parentCallback(null, String(new ObjectId()));
				},
				admin_data : (callback)=>{
					const users	=	this.db.collection(Tables.USERS);
					users.findOne({user_role_id : Constants.CRAVEZ},{projection:{_id:1}}).then(adminResult=>{
						callback(null, adminResult);
					}).catch(next);
				},
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				/** Send error response */
				if(!asyncResponse.order_details || !asyncResponse.order_sub_details || asyncResponse.item_list.length <=0){
					return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});
				}

				let orderItems	 	=	asyncResponse.item_list;
				let orderData		= 	asyncResponse.order_details;
				let orderSubDetails = 	asyncResponse.order_sub_details;
				let mainOrderId		= 	asyncResponse.main_order_id;
				let adminData 		= 	asyncResponse.admin_data;
				let todayOrderCount = 	(asyncResponse.today_order_count) ? asyncResponse.today_order_count :1;

				let adminId 		= 	(adminData._id) 				? adminData._id 			:"";
				let isGuest 		= 	(orderData.is_guest) 			? orderData.is_guest 		:"";
				let branchId		=	(orderData.branch_id)			? orderData.branch_id 		:"";
				let deviceId		=	(orderData.device_id)			? orderData.device_id		:"";
				let customerId		=	(orderData.customer_id)			? orderData.customer_id		:"";
				let restaurantId	=	(orderData.restaurant_id)		? orderData.restaurant_id 	:"";
				let userDeviceType 	= 	(orderData.user_device_type) 	? orderData.user_device_type:"";
				let userMobileNumber=	(orderData.user_mobile_number)	? orderData.user_mobile_number :"";
				if(isGuest) userMobileNumber = "";

				asyncParallel({
					unique_order_id: (parentCallback)=>{
						/** get order unique id **/
						Helpers.getUniqueId(req,res,next,{type: "orders", order_count: todayOrderCount}).then(uniqueIdResponse=>{
							parentCallback(null,uniqueIdResponse.result);
						}).catch(next);
					},
					invoice_number : (parentCallback)=>{
						/** Set invoice options */
						let invoiceOptions = {
							type 			:	"order_invoice_number",
							platform 		: 	userDeviceType,
							client_number	: 	userMobileNumber,
						};

						/** get invoice unique number **/
						Helpers.getUniqueId(req,res,next,invoiceOptions).then(uniqueIdResponse=>{
							parentCallback(null,uniqueIdResponse.result);
						}).catch(next);
					},
					transaction_id : (parentCallback)=>{
						/** get transaction unique id **/
						Helpers.getUniqueId(req,res,next,{type:Tables.ORDER_DETAILS}).then(uniqueIdResponse=>{
							parentCallback(null,uniqueIdResponse.result);
						}).catch(next);
					},
				},(parentParallelErr,parentParallelResponse)=>{
					if(parentParallelErr) return eachCallback(parentParallelErr);

					let uniqueOrderId 	= 	parentParallelResponse.unique_order_id;
					let invoiceNumber 	= 	parentParallelResponse.invoice_number;
					let transactionId	=	parentParallelResponse.transaction_id;
					let newOrderId		=	new ObjectId();

					asyncParallel({
						save_order_details : (childCallback)=>{
							/** Set order save details  */
							let orderSaveData = {
								captain_id		:	"",
								parent_order_id	: 	orderId,
								unique_order_id	: 	uniqueOrderId,
								invoice_number  :   invoiceNumber,
								main_order_id	:	mainOrderId,
								queue_time		:	Helpers.getUtcDate(),
								number_of_queue : 	Constants.FIRST_REQUEUE_ORDER,
								order_status	: 	Constants.ORDER_SUBMITTED,
								order_date		: 	Helpers.getUtcDate(),
								last_status_updated_on: Helpers.getUtcDate(),
								created			:	Helpers.getUtcDate(),
								modified		:	Helpers.getUtcDate(),
								customer_id		:	orderData.customer_id,
								device_id		:	orderData.device_id,
								delivery_type	:	orderData.delivery_type,
								request_note	:	orderData.request_note,
								branch_id	 	: 	orderData.branch_id,
								area_id		 	: 	orderData.area_id,
								area_name		: 	orderData.area_name,
								payment_method	: 	orderData.payment_method,
								restaurant_id 	: 	orderData.restaurant_id,
								restaurant_name : 	orderData.restaurant_name,
								order_price		:	orderData.order_price,
								net_amount		:	orderData.net_amount,
								is_confirm		:	orderData.is_confirm,
								delivery_fee	: 	orderData.delivery_fee,
								is_big_order	:	orderData.is_big_order,
								is_first_order	:	orderData.is_first_order,
								is_vip			:	orderData.is_vip,
								is_duplicate_order:	orderData.is_duplicate_order,
								full_name		:	orderData.full_name,
								first_name		:	orderData.first_name,
								last_name		:	orderData.last_name,
								mobile_number	:	orderData.mobile_number,
								kfg_order		:	orderData.kfg_order,
								amount_debited_by_wallet:orderData.amount_debited_by_wallet,
								kfg_offer_id	:	(orderData.kfg_offer_id) ?	orderData.kfg_offer_id 	:"",
								kfg_offer_name	:	(orderData.kfg_offer_name) ? 	orderData.kfg_offer_name 	:"",
							};

							if(orderData.is_guest)	 orderSaveData.is_guest  =	true;
							if(orderData.payment_id) orderSaveData.payment_id=	orderSaveData.payment_id;

							/** Save package details  */
							if(orderData.package_id){
								orderSaveData.package_id 			= 	orderData.package_id;
								orderSaveData.package_delivery_fees =	orderData.package_delivery_fees;
								orderSaveData.is_infinity_user 		=	true;
							}

							/** Save order details */
							orders.updateOne({_id: newOrderId },{$set: orderSaveData},{upsert: true}).then(()=>{
								childCallback(null);
							}).catch(next);
						},
						save_order_sub_details : (childCallback)=>{
							/** Set order details  */
							let orderDetailsData = {
								order_id			:	newOrderId,
								unique_order_id		:	uniqueOrderId,
								transaction_id		:	transactionId,
								customer_id			:	orderSubDetails.customer_id,
								customer_address_id	:	orderSubDetails.customer_address_id,
								delivery_area_id	: 	orderSubDetails.delivery_area_id,
								customer_address	:	orderSubDetails.customer_address,
								customer_latitude	:	orderSubDetails.customer_latitude,
								customer_longitude	:	orderSubDetails.customer_longitude,
								customer_long_lat	:	orderSubDetails.customer_long_lat,
								restaurant_address	:	orderSubDetails.restaurant_address,
								restaurant_latitude : 	orderSubDetails.restaurant_latitude,
								restaurant_longitude: 	orderSubDetails.restaurant_longitude,
								restaurant_long_lat	:	orderSubDetails.restaurant_long_lat,
								total_amount		: 	orderSubDetails.total_amount,
								net_amount			: 	orderSubDetails.net_amount,
								discount_price		: 	orderSubDetails.discount_price,
								offer_id			: 	orderSubDetails.offer_id,
								offer_code			: 	orderSubDetails.offer_code,
								offer_type			: 	orderSubDetails.offer_type,
								delivery_fee		: 	orderSubDetails.delivery_fee,
								additional_tax		: 	orderSubDetails.additional_tax,
								payment_method		: 	orderSubDetails.payment_method,
								delivery_duration	: 	orderSubDetails.delivery_duration,
								elapsed_time		: 	orderSubDetails.delivery_duration,
								preparation_time	: 	orderSubDetails.preparation_time,
								remaining_preparation_time	: 	orderSubDetails.preparation_time,
								remaining_delivery_duration	: 	orderSubDetails.delivery_duration,
							};

							if(orderSubDetails.additional_tax_percentage){
								orderDetailsData.additional_tax_percentage = orderSubDetails.additional_tax_percentage;
							}

							if(orderSubDetails.device_id){
								orderDetailsData.device_id =	orderSubDetails.device_id;
							}

							if(orderSubDetails.offer_discount){
								orderDetailsData.offer_discount =	orderSubDetails.offer_discount;
							}

							if(orderSubDetails.offer_delivery_fees){
								orderDetailsData.offer_delivery_fees =	orderSubDetails.offer_delivery_fees;
							}

							if(orderSubDetails.composite_id){
								orderDetailsData.composite_id =	orderSubDetails.composite_id;

								if(orderSubDetails.composite_discount){
									orderDetailsData.composite_discount =	orderSubDetails.composite_discount;
								}
								if(orderSubDetails.composite_delivery_fees){
									orderDetailsData.composite_delivery_fees =	orderSubDetails.composite_delivery_fees;
								}
							}

							if(orderSubDetails.corporate_id){
								orderDetailsData.corporate_id =	orderSubDetails.corporate_id;

								if(orderSubDetails.corporate_discount){
									orderDetailsData.corporate_discount =	orderSubDetails.corporate_discount;
								}
								if(orderSubDetails.corporate_delivery_fees){
									orderDetailsData.corporate_delivery_fees =	orderSubDetails.corporate_delivery_fees;
								}
							}

							if(orderSubDetails.branch_extra_charge_type){
								orderDetailsData.branch_extra_charge =	orderSubDetails.branch_extra_charge;
								orderDetailsData.branch_extra_charge_type =	orderSubDetails.branch_extra_charge_type;
							}

							if(orderSubDetails.branch_discount_type){
								orderDetailsData.branch_discount =	orderSubDetails.branch_discount;
								orderDetailsData.branch_discount_type =	orderSubDetails.branch_discount_type;
							}

							/** Save order details */
							order_details.insertOne(orderDetailsData).then(()=>{
								childCallback(null);
							}).catch(next);
						},
						save_item_list : (childCallback)=>{
							/** Manage item save data */
							let itemSaveData = [];
							orderItems.map(itemData=>{
								let tempObj = {
									order_id 		: 	newOrderId,
									parent_item_id 	: 	itemData.parent_item_id,
									qty 			: 	itemData.qty,
									item_name 		: 	itemData.item_name,
									item_image 		:	itemData.item_image,
									item_id 		: 	itemData.item_id,
									unit_id 		: 	itemData.unit_id,
									dough_id 		: 	itemData.dough_id,
									selector_id 	: 	itemData.selector_id,
									item_type 		:	itemData.item_type,
									note 			:	itemData.note,
									extra_items 	:	itemData.extra_items,
									price			:	itemData.price,
									sub_total		:	itemData.sub_total,
									item_main_price :	itemData.item_main_price,
									discounted_price:	itemData.discounted_price,
									cuisine_ids		:	(itemData.cuisine_ids) ? itemData.cuisine_ids :[],
									net_amount		:	itemData.net_amount,
									created 		:	Helpers.getUtcDate(),
									cart_created	:	itemData.cart_created,
								};

								if(itemData.item_unit_id)	tempObj.item_unit_id= itemData.item_unit_id;
								if(itemData.unit_lists) 	tempObj.unit_lists 	= itemData.unit_lists;

								itemSaveData.push(tempObj);
							});

							/** Save order item details */
							order_items.insertMany(itemSaveData).then(()=>{
								childCallback(null);
							}).catch(next);
						},
						update_payment_details : (childCallback)=>{
							/** Update payment transactions details */
							const payment_transactions = 	this.db.collection(Tables.PAYMENT_TRANSACTIONS);
							payment_transactions.updateMany({
								order_ids: {$in: [orderId]}
							},
							{$addToSet:{
								order_ids : newOrderId,
							}}).then(()=>{

								/** Remove old order id form payment transactions */
								payment_transactions.updateMany({
									order_ids: {$in: [newOrderId]}
								},
								{$pull:{
									order_ids : {$in: [orderId]},
								}}).then(() => {
									childCallback(null);
								});
							}).catch(next);
						},
						update_wallet_logs : (childCallback)=>{
							/** Update Wallet logs */
							const user_wallet_logs = 	this.db.collection(Tables.USER_WALLET_LOGS);
							user_wallet_logs.updateMany({
								"extra_parameters.order_id" 	: orderId,
								"extra_parameters.order_place"	: true,
							},
							{$set:{
								"extra_parameters.order_id" : 	newOrderId,
							}}).then(()=>{
								childCallback(null);
							}).catch(next);
						},
						update_old_order : (childCallback)=>{
							/** Cancel last order */
							orders.updateOne({
								_id : orderId
							},
							{$set:{
								order_status 	 		: 	Constants.ORDER_CANCELLED,
								rejection_reason 		: 	Constants.PACKAGE_GETS_DAMAGED,
								cancelled_user_role_id 	: 	Constants.CRAVEZ,
							}}).then(()=>{
								childCallback(null);
							}).catch(next);
						},
						update_order_status : (childCallback)=>{
							/** Update last order status logs */
							Helpers.saveOrderStatusLogs(req,res,next,{
								updated_by 		: 	adminId,
								user_role_id 	: 	Constants.CRAVEZ,
								status 			:	Constants.ORDER_CANCELLED,
								order_status	:	orderData.order_status,
								restaurant_id	:	restaurantId,
								order_id 		:	orderId,
								branch_id		:	branchId,
								user_id			:	customerId,
								user_type		:	Constants.USER_TYPE_ADMIN,
								not_refund		:	true,
								not_send_notification: true,
							}).then(()=>{
								childCallback(null)
							}).catch(next);
						}
					},(asyncErr)=>{
						if(asyncErr) return next(asyncErr);

						/** Send response */
						resolve({status: Constants.STATUS_SUCCESS});

						/** Update new order status logs */
						Helpers.saveOrderStatusLogs(req,res,next,{
							order_id 		: 	newOrderId,
							restaurant_id	:	restaurantId,
							user_id			:	customerId,
							updated_by 		: 	adminId,
							user_role_id	:	(customerId) ? Constants.CUSTOMER			:"",
							user_type		:	(customerId) ? Constants.USER_TYPE_CUSTOMER	:"",
							device_id 		: 	deviceId,
							status 			:	Constants.ORDER_SUBMITTED,
							order_status 	:	Constants.ORDER_SUBMITTED,
						}).then(()=>{});
					});
				});
			});
		}).catch(next);
	};// end placeInterruptOrder()

	/**
	 * Function to get orders count
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	getOrdersCount (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 	= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId	= (req.body.user_id) ? new ObjectId(req.body.user_id) :"";

			/** Send error response **/
			if(!userId) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});

           	const orders = this.db.collection(Tables.ORDERS);
			asyncParallel({
				accepted_count : (callback)=>{
					/** Set assigned order conditions */
					let assignmentConditions = {
						captain_id 		: userId,
						current_status 	: Constants.ORDER_DRIVER_ASSIGNED
					};

					/** Get assigned order list */
					const order_assignment_logs	= this.db.collection(Tables.ORDER_ASSIGNMENT_LOGS);
					order_assignment_logs.distinct("order_id", assignmentConditions).then(orderIds=>{
						if(orderIds.length <=0) return callback(null,0);

						/** Get accepted orders count */
						orders.countDocuments({_id: {$in: orderIds}}).then(orderCount=>{
							callback(null,orderCount);
						}).catch(next);
					}).catch(next);
				},
				pickup_count : (callback)=>{
					/** Set pickup order conditions */
					let pickupConditions = {
						captain_id 		: 	userId,
						delivery_status	:	{$in: Constants.DRIVER_PICKUP_ORDER_STATUS},
					};

					/** Get pick orders count */
					orders.countDocuments(pickupConditions).then(orderCount=>{
						callback(null,orderCount);
					}).catch(next);
				},
				delivery_count : (callback)=>{
					/** Set delivery order conditions */
					let deliveryConditions = {
						captain_id 		: 	userId,
						delivery_status	:	{$in: Constants.DRIVER_DELIVERED_ORDER_STATUS},
					};

					/** Get delivery orders count */
					orders.countDocuments(deliveryConditions).then(orderCount=>{
						callback(null,orderCount);
					}).catch(next);
				},
			},(err,response)=>{
				if(err) return next(err);

				/** Send response **/
				resolve({
					status			    : Constants.STATUS_SUCCESS,
					accept_order_count  : (response.accepted_count) ? response.accepted_count :0,
					pick_order_count	: (response.pickup_count)   ? response.pickup_count   :0,
					delivery_order_count: (response.delivery_count) ? response.delivery_count :0
				});
			});
		}).catch(next);
	};// end getOrdersCount()

	/**
	 * Function to get restaurant orders count
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	getRestaurantOrdersCount (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 			=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let branchId		= 	(req.body.branch_id) 		? 	new ObjectId(req.body.branch_id) 	:"";
			let restaurantId	= 	(req.body.restaurant_id) 	?	new ObjectId(req.body.restaurant_id):"";

			/** Send error response **/
			if(!restaurantId) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});

			/** Get order stats */
			const orders = this.db.collection(Tables.ORDERS);
			orders.aggregate([
				{$match	: {
					restaurant_id: restaurantId,
					is_confirm: true,
					...(branchId && {
						branch_id : branchId,
					} || {})
				}},
				{$group	: {
					_id	: null,
					pending_count : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$restaurant_status",Constants.ORDER_PENDING] }
							]},
							1,
							0
						]}
					},
					preparing_count : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$restaurant_status",Constants.ORDER_PREPARING] }
							]},
							1,
							0
						]}
					},
					ready_to_pick_up_count : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$restaurant_status",Constants.ORDER_READY_TO_PICK_UP] }
							]},
							1,
							0
						]}
					},
					on_the_way_count : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$restaurant_status",Constants.ORDER_ON_THE_WAY] }
							]},
							1,
							0
						]}
					},
					delivered_count : {$sum : {
						$cond: [
							{$and: [
								{ $eq : ["$restaurant_status",Constants.ORDER_DELIVERED] }
							]},
							1,
							0
						]}
					},
				}}
			]).toArray().then(result =>{

				/** Send response **/
				resolve({
					status : Constants.STATUS_SUCCESS,
					pending_count 	: result?.[0]?.pending_count || 0,
					preparing_count : result?.[0]?.preparing_count || 0,
					ready_to_pick_up_count : result?.[0]?.ready_to_pick_up_count || 0,
					on_the_way_count : result?.[0]?.on_the_way_count || 0,
					delivered_count  : result?.[0]?.delivered_count || 0,
				});
			}).catch(next);
		}).catch(next);
	};// end getRestaurantOrdersCount()

	/**
	 * Function to get cancel order reason
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	getCancelReason (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 	 = Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userType = (req.body.user_type) ? req.body.user_type 	:"";

			/** Send error response **/
			if(!userType) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			/** Send error response **/
            if(userType != Constants.USER_TYPE_RESTAURANT && userType != Constants.USER_TYPE_CUSTOMER) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			/** Find cancel reasons **/
			const cancel_reasons = this.db.collection(Tables.CANCEL_REASONS);
            cancel_reasons.find({channel_id : userType,status : Constants.ACTIVE },{projection : {_id:1,title :1}}).sort({order: Constants.SORT_ASC}).toArray().then(reasonResult => {

                /** Send success response */
                resolve({ status: Constants.STATUS_SUCCESS, result: reasonResult});
            }).catch(next);
		}).catch(next);
	};// end getCancelReason()

	/**
	 * Function to pay outstanding amount for order
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	payOutstandingAmountForOrder (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 	    	= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId			= (req.body.user_id) 	  		? 	new ObjectId(req.body.user_id) 	:"";
			let orderId			= (req.body.order_id) 	  		? 	new ObjectId(req.body.order_id)	:"";
			let deviceId		= (req.body.device_id)	  		?	req.body.device_id			:"";
			let amount      	= (req.body.amount)		  		? 	parseFloat(req.body.amount) :0;
			let paymentType 	= (req.body.payment_type) 		? 	req.body.payment_type 		:"";
			let paymentResponse	= (req.body.payment_response) 	?	req.body.payment_response 	:"";
			let paymentCurrency	= (req.body.payment_currency) 	?	req.body.payment_currency 	:"";
			let walletDebitAmount=(req.body.wallet_amount)		?	parseFloat(req.body.wallet_amount):0;

			/** Send error response **/
			if((!userId && !deviceId) || !orderId || !paymentType || !amount){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access"), missing_fields: ["user_id","device_id","order_id","amount","payment_type"] });
			}

			/** For check payment method */
			if(!PAYMENT_METHODS[paymentType]) return resolve({status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access")});

			if(paymentType != Constants.WALLET_PAYMENT && (!paymentResponse || !paymentCurrency)) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access"), missing_fields: ["payment_currency","payment_response"]});

			/** Set conditions */
			let conditions = {
				_id 				: orderId,
				outstanding_amount  : amount,
				outstanding_payment : Constants.UNPAID
			};

			if(userId){
				conditions.customer_id = userId;
			}else{
				conditions.device_id = deviceId;
			}

			/** Find order details  **/
			const orders = this.db.collection(Tables.ORDERS);
			orders.findOne(conditions,{projection: {_id:1,unique_order_id:1}}).then(orderResult=>{

				/** Send error response */
				if(!orderResult) return resolve({status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access")});

				let onlinePaymentAmount = amount-walletDebitAmount;
				asyncParallel({
					pay_by_wallet : (callback)=>{
						if(!userId || walletDebitAmount<=0 ) return callback(null);

						/** Update wallet  */
						Helpers.updateWalletBalance(req,res,next,{
							user_id      	: userId,
							amount       	: walletDebitAmount,
							transaction_type: Constants.DEBIT,
							order_id		: orderId
						}).then(response=>{
							if(response.status != Constants.STATUS_SUCCESS) return callback(response);
							callback(null);
						}).catch(next);
					},
					pay_by_other : (callback)=>{
						if(paymentType == Constants.WALLET_PAYMENT) return callback(null);

						/** Save payment details */
						this.saveUserPaymentDetails(req,res,next,{
							user_id 			: 	userId,
							device_id 			: 	deviceId,
							order_ids 			:	[orderId],
							payment_method 		:	paymentType,
							payment_status 		:	Constants.PAYMENT_SUCCESS,
							payment_response 	:	paymentResponse,
							currency 			:	paymentCurrency,
							amount 				:	onlinePaymentAmount
						}).then(response=>{
							if(response.status != Constants.STATUS_SUCCESS) return callback(response);
							callback(null);
						}).catch(next);
					}
				},(asyncErr)=>{
					if(asyncErr) return next(asyncErr);

					/** Set update data */
					let orderSaveData = {
						$set : {
							outstanding_payment	: Constants.PAID,
							modified			: Helpers.getUtcDate()
						},
						$inc : {
							amount_debited_by_wallet: walletDebitAmount,
						}
					};

					if(paymentType == Constants.KNET && onlinePaymentAmount >0){
						let knetValue	=(res.locals.settings['Site.knet_charges']) ? res.locals.settings['Site.knet_charges'] :0;
						let knetCharges	= (knetValue) ? (onlinePaymentAmount*knetValue)/Constants.MAX_PERCENTAGE :0;

						if(!orderSaveData["$inc"])	 orderSaveData["$inc"] = {};
						orderSaveData["$inc"].total_knet_amount =	onlinePaymentAmount
						orderSaveData["$inc"].knet_charges 		=	Helpers.round(knetCharges)
					}

					/** Save order details */
					orders.updateOne({_id: orderId },orderSaveData).then(()=>{

						/** Send success response */
						resolve({status: Constants.STATUS_SUCCESS, message: res.__("orders.outstanding_amount_has_been_paid_successfully")});

						this.updatePaymentMethodCharges(req,res,next,{order_id : orderId});

						/** Send Mail */
						sendMailToUsers(req,res,{
							event_type 			: Constants.NOTIFICATION_ORDER_OUTSTANDING_AMOUNT_PAID,
							user_id				: userId,
							order_id			: orderId,
							unique_order_id		: orderResult.unique_order_id,
							amount				: Helpers.currencyFormat(amount),
						});
					}).catch(next);
				});
			}).catch(next);
		}).catch(next);
	};// end payOutstandingAmountForOrder()

	/**
	 * Function to get customer running order list
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	getCustomerRunningOrderList (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 		= 	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId		= 	(req.body.user_id) 		? 	new ObjectId(req.body.user_id) 	:"";
			let deviceId	=	(req.body.device_id)	?	req.body.device_id			:"";
			let orderIds	=	(req.body.order_ids)	?	req.body.order_ids			:"";

			/** Send error response **/
			if(!userId && !deviceId) {
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});
			}

			/** Set conditions **/
			let orderConditions = {
				$or :[
					{is_completed: {$exists: false}},
					{is_completed: {$ne: true}},
				]
			}

			if(orderIds){
				if(orderIds.constructor !== Array) orderIds =[orderIds];
				orderIds = Helpers.arrayToObject(orderIds);
				orderConditions._id = {$in: orderIds}
			}

			if(userId){
				orderConditions = {customer_id: userId, ...orderConditions};
			}else{
				orderConditions = {device_id: deviceId, ...orderConditions};
			}

			/** Find order details  **/
			const orders = this.db.collection(Tables.ORDERS);
			orders.aggregate([
				{$match : orderConditions},
				{$lookup: {
					from 		 : Tables.ORDER_DETAILS,
					localField 	 : "_id",
					foreignField : "order_id",
					as 			 : "order_detail"
				}},
				{$lookup : {
					from 		 : Tables.PAYMENT_METHODS,
					localField 	 : "payment_method",
					foreignField : "slug",
					as 			 : "payment_method_detail"
				}},
				{$project : {
					_id:1,unique_order_id : 1,order_date : 1, restaurant_name : 1, customer_id : 1,payment_method : 1, customer_status:1, delivery_type:1,net_amount:1,
					order_price:1,delivery_duration: {$arrayElemAt: ["$order_detail.delivery_duration",0]},delivery_fee: {$arrayElemAt: ["$order_detail.delivery_fee",0]},discount_price: {$arrayElemAt: ["$order_detail.discount_price",0]},preparation_time: {$arrayElemAt : ["$order_detail.preparation_time",0]},
					payment_method_title: {$arrayElemAt : ["$payment_method_detail.title",0]}
				}},
				{$sort : { order_date: Constants.SORT_DESC}}
			]).toArray().then(orderResult=>{

				/** Send success response  */
				resolve({
					status 	:  Constants.STATUS_SUCCESS,
					result  :  orderResult
				});
			}).catch(next);
		}).catch(next);
	};// end getCustomerRunningOrderList()

	/**
	 * Function to update customer address in orders
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 * @param options As data object
	 *
	 * @return json
	 **/
	updateCustomerAddressInOrder (req,res,next,options={}){
		return new Promise(resolve=>{
			let customerAddressId = (options.address_id)? options.address_id: "";
			let orderId			  = (options.order_id)	? options.order_id	: "";
			const order_details	  = this.db.collection(Tables.ORDER_DETAILS);

			if(!customerAddressId || !orderId) return resolve({status : Constants.STATUS_SUCCESS});

			Helpers.getCustomerAddress(req,res,next,{customer_address_id : customerAddressId}).then(response=>{
				if(response.status != Constants.STATUS_SUCCESS) return resolve({status : response.status,message:response.message});

				let addressDetails = (response.result && response.result[customerAddressId]) ? response.result[customerAddressId] : "";
				if(!addressDetails) return resolve({status : Constants.STATUS_SUCCESS});

				if(addressDetails._id) delete addressDetails._id;
				if(addressDetails.modified) delete addressDetails.modified;

				order_details.updateOne({
					order_id : new ObjectId(orderId)
				},
				{$set : {
					customer_address_detail : addressDetails,
					modified				: Helpers.getUtcDate()
				}}).then(()=>{

					resolve({status : Constants.STATUS_SUCCESS});
				}).catch(next);
			}).catch(next);
		}).catch(next);
	};// end updateCustomerAddressInOrder()

	/**
	 * Function to update customer details in order
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 * @param options As data object
	 *
	 * @return json
	 **/
	updateCustomerDetailsInOrder (req,res,next,options={}){
		return new Promise(resolve=>{
			let customerId	= (options.customer_id)? options.customer_id: "";
			let orderId		= (options.order_id)	? options.order_id	: "";

			if(!customerId || !orderId) return resolve({status : Constants.STATUS_SUCCESS});

			const users		= this.db.collection(Tables.USERS);
			users.findOne({_id : new ObjectId(customerId)},{projection:{_id: 0, full_name:1,first_name:1,last_name:1,mobile_number:1}}).then(result=>{

				if(!result) return resolve({status : Constants.STATUS_SUCCESS});

				const orders	= this.db.collection(Tables.ORDERS);
				orders.updateOne({
					_id : new ObjectId(orderId)
				},
				{$set : result}).then(()=>{
					resolve({status : Constants.STATUS_SUCCESS});
				}).catch(next);
			}).catch(next);
		}).catch(next);
	};// end updateCustomerDetailsInOrder()

	/**
	 * Function to generate order pdfs
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 * @param options As data object
	 *
	 * @return json
	 **/
	generateOrderPdfs (req,res,next,options={}){
		return new Promise(resolve=>{
			let orderId			= (options.order_id)		? options.order_id	: "";
			let uniqueOrderId	= (options.unique_order_id)	? options.unique_order_id	: "";

			if(!orderId || !uniqueOrderId) return resolve({status : Constants.STATUS_ERROR});

			let a4URL			= Constants.WEBSITE_URL+"orders/print/"+orderId+"?layout="+Constants.A4_LAYOUT;
			let a4FileName		= 'order_'+uniqueOrderId+'_a4.pdf';
			let thermalURL		= Constants.WEBSITE_URL+"orders/print/"+orderId+"?layout="+Constants.THERMAL_LAYOUT;
			let thermalFile 	= 'order_'+uniqueOrderId+'_thermal.pdf';
			asyncParallel({
				a4_file : (callback)=>{
					/** To generate pdf */
					wkhtmltopdf(a4URL,{
						output		: Constants.ORDER_INVOICE_FILE_PATH+a4FileName,
						pageSize	: 'A4',
						encoding	: "UTF-8",
						noOutline	: true,
						disableSmartShrinking : true
					},(err) => {
						if (err) return callback(err,null);

						callback(null,null);
					});
				},
				thermal_file : (callback)=>{
					/** To generate pdf */
					wkhtmltopdf(thermalURL,{
						output		: Constants.ORDER_INVOICE_FILE_PATH+thermalFile,
						pageSize	: 'A4',
						encoding	: "UTF-8",
						noOutline	: true,
						disableSmartShrinking : true
					},(err) => {
						if (err) return callback(err,null);

						callback(null,null);
					});
				},
			},(asyncERR)=>{
				if(asyncERR) return next(asyncERR);

				const orders = this.db.collection(Tables.ORDERS);
				orders.updateOne({
					_id : new ObjectId(orderId)
				},
				{$set : {
					a4_pdf : a4FileName,
					thermal_pdf : thermalFile
				}}).then(()=>{
					resolve({status : Constants.STATUS_SUCCESS});
				}).catch(next);
			});
		}).catch(next);
	};// end generateOrderPdfs()

	/**
	 * Function to update payment method charges
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 * @param options As data object
	 *
	 * @return json
	 **/
	updatePaymentMethodCharges (req,res,next,options={}){
		return new Promise(resolve=>{
			let orderId	 = (options && options.order_id)	? new ObjectId(options.order_id)	:"";

			/** Send error response **/
			if(!orderId) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			const orders	= this.db.collection(Tables.ORDERS);
			asyncParallel({
				order_data :(callback)=>{
					/** Get order details */
					orders.findOne({_id : orderId },{projection : {payment_method : 1,payment_charges : 1,restaurant_id : 1}}).then(result=>{
						callback(null, result);
					}).catch(next);
				},
				order_detail :(callback)=>{
					/** Get detail of Orders **/
					const order_details = this.db.collection(Tables.ORDER_DETAILS);
					order_details.aggregate([
						{$match: {
							order_id : orderId,
						}},
						{$lookup:	{
							"from" 			: 	Tables.OFFERS,
							"localField" 	:	"offer_id",
							"foreignField" 	: 	"_id",
							"as" 			: 	"offer_detail"
						}},
						{ $project: { order_id: 1, net_amount: 1, total_amount: 1, discount_price: 1, delivery_fee: 1, branch_discount: 1, restaurant_discount_ratio: { $arrayElemAt: ["$offer_detail.restaurant_discount_ratio",0]}}},
					]).toArray().then(detailResult=>{
						callback(null,detailResult?.[0] || null);
					}).catch(next);
				}
			},(asyncErr, response)=>{
				if(asyncErr) return next(asyncErr);

				/** Send error response */
				if(!response.order_data || !response.order_detail){
					return resolve({status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });
				}

				let orderData			=	response.order_data;
				let orderDetail			=	response.order_detail;
				let paymentMethod		=	(orderData.payment_method) ? orderData.payment_method : '';
				let restaurantId		=	(orderData.restaurant_id)   ? orderData.restaurant_id   : '';
				let grossAmount			=	orderDetail.net_amount;
				let orderAmount			=	orderDetail.total_amount;
				let deliveryFee			=	orderDetail.delivery_fee;
				let offerDiscount		=	(orderDetail.offer_discount) ? orderDetail.offer_discount :0;
				let restaurantDiscount 	= 	(orderDetail.restaurant_discount_ratio) ? orderDetail.restaurant_discount_ratio :0;
				let amountDebitedByWallet 	= 	(orderDetail.amount_debited_by_wallet) ? orderDetail.amount_debited_by_wallet :0;
				let percentage			=	0;
				let fixedAmount			=	0;

				const restaurant_details	=	this.db.collection(Tables.RESTAURANT_DETAILS);

				let fields	=	{payment_method: {$elemMatch: {method: paymentMethod}}};
				restaurant_details.findOne({restaurant_id : new ObjectId(restaurantId),'payment_method.method':paymentMethod},{projection : fields}).then(detailResult=>{

					let paymentResult		=	(detailResult && detailResult.payment_method) ? detailResult.payment_method[0] : {};
					let commissionType		=	(paymentResult.commission_type) ? paymentResult.commission_type : '';
					let commissionCriteria	=	(paymentResult.commission_criteria) ? paymentResult.commission_criteria : '';
					let commissionValues	= 	(paymentResult.values) ? paymentResult.values : [];

					if(commissionValues && commissionValues.constructor === Array && commissionValues[0]){
						percentage = (commissionValues[0].commission) ? commissionValues[0].commission :0;

						if(commissionType == Constants.COMMISSION_VARIABLE){
							commissionValues.map(value=>{
								commissionFrom	=	value.from;
								commissionTo	=	value.to;
								if(orderAmount > commissionFrom && orderAmount < commissionTo){
									percentage =	(value.commission) ? value.commission :0;
								}
							});
						}
						if(commissionType == Constants.COMMISSION_FIXED_AMOUNT){
							fixedAmount	=	(commissionValues[0].amount) ? commissionValues[0].amount :0;
						}
					}

					let gatewayCharges 		= 0;
					let offerPrice 			= 0;
					let totalPayout			= orderAmount;
					if(offerDiscount) offerPrice 	= (restaurantDiscount !=0)?(restaurantDiscount / 100) * offerDiscount:0;
					if(commissionCriteria == Constants.NET_AMOUNT){
						totalPayout = (grossAmount+deliveryFee)- offerPrice;
					}else{
						totalPayout = grossAmount;
					}
					if(amountDebitedByWallet) orderAmount	=	orderAmount	-	amountDebitedByWallet;
					if(orderAmount > 0){
						if(commissionType == Constants.COMMISSION_FIXED_AMOUNT){
							gatewayCharges 	=	fixedAmount;
						}else{
							gatewayCharges 	=	(percentage) ? (totalPayout*percentage)/Constants.MAX_PERCENTAGE	:0;
						}
					}

					/** Set Update data */
					let updateData = {};
					updateData["payment_charges."+paymentMethod+".paid_amount"] 	= orderAmount;
					updateData["payment_charges."+paymentMethod+".gateway_charge"] 	= gatewayCharges;

					/** Update order details */
					orders.updateOne({ _id : orderId },{$inc : updateData}).then(()=>{

						/** Send success response */
						resolve({status : Constants.STATUS_SUCCESS});
					}).catch(next);
				}).catch(next);
			});
		}).catch(next);
	};// end updatePaymentMethodCharges()

	/**
	 * Function to update order status after api response
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 * @param options As data object
	 *
	 * @return null
	 */
	async callAfterPlaceOrder (req,res,next,options={}){
		try {
			let orderId		=	(options.order_id) 	?	options.order_id 	:"";
			let isModify	=	(options.is_modify)	?	options.is_modify	:false;

			/** Send error response  */
			if(!orderId) return {status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") };

			const url = Constants.WEBSITE_URL + 'place_order/' + orderId + (isModify ? '/1' : '');
			const response = await axios.get(url);

			/** Send error response */
			if(response?.data?.status != Constants.STATUS_SUCCESS) return response?.data;

			return {status: Constants.STATUS_SUCCESS };
		} catch (error) {
			return next(error);
		}
	};//End callAfterPlaceOrder()
}// End Order