import { ObjectId } from 'mongodb';
import {parallel as asyncParallel} from 'async';

import { newDate, getUtcDate, getDifferenceBetweenTwoDatesInMinute, addDaysToDate, addDate} from './dateHelper.mjs';
import { updateWalletBalance } from './userWalletHelper.mjs';
import { logger } from './index.mjs';
import { sendMailToUsers, socketRequest } from '../services/index.mjs';
import { round } from './numberHelper.mjs';
import * as Constants from "../config/global_constant.mjs";
import { getDb } from '../config/connection.mjs';
import Tables from '../config/database_tables.mjs';

/**
 * Function save order status logs
 *
 *  @param req		As	Request Data
 * @param res		As 	Response Data
 * @param next		As	Callback argument to the middleware function
 * @param options	As	Request params
 *
 * @return json
 */
export const saveOrderStatusLogs = (req,res,next,options = {})=>{
    return new Promise(async resolve=>{
        try {
            let notificationToCallCenter = 	options?.send_notification_call_center || "";
            let captainName		= 	options?.captain_name || "";
            let orderId			= 	options?.order_id ? new ObjectId(options.order_id) : "";
            let userId			= 	options?.user_id ? new ObjectId(options.user_id) : "";
            let updatedBy		= 	options?.updated_by ? new ObjectId(options.updated_by) : "";
            let assignedBy		= 	options?.assigned_by ? new ObjectId(options.assigned_by) : "";
            let currentStatus	= 	options?.order_status || "";
            let orderStatus		= 	options?.status || "";
            let channelId		= 	options?.channel_id || "";
            let userType		= 	options?.user_type || "";
            let userRoleId		= 	options?.user_role_id || "";
            let restaurantId	= 	options?.restaurant_id || "";
            let branchId		= 	options?.branch_id || "";
            let isModified		= 	options?.is_modified || false;
            let isAdmin			= 	options?.is_admin || false;
            let kfgApi			= 	options?.kfg_api || false;
            let optExtraPerms	= 	options?.extra_perms || false;
            let notSendNotification= options?.not_send_notification || false;

            /** Send error response **/
            if(!orderStatus || !orderId){
                return resolve({status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters")});
            }

            /** Set log save data */
            let statusLogData = {
                order_id			: 	orderId,
                status				:	orderStatus,
                status_changed_from	:	currentStatus,
                action_taken_by		:	updatedBy,
                user_role_id		:	userRoleId,
                user_type			:	userType,
                channel_id			:	channelId,
                created				:	getUtcDate(),
            };

            if(isModified) 		statusLogData.is_modified 	=	true;
            if(assignedBy)		statusLogData.assigned_by	= 	assignedBy;
            if(optExtraPerms) 	statusLogData.extra_perms 	=	optExtraPerms;

            /** Save order status logs */
            let dbInstance = getDb();
            const users  = dbInstance.collection(Tables.USERS);
            const orders = dbInstance.collection(Tables.ORDERS);
            const orderStatusLogs = dbInstance.collection(Tables.ORDER_STATUS_LOGS);
            const orderDetails  = 	dbInstance.collection(Tables.ORDER_DETAILS);

            /** Save logs */
            const logRes = await orderStatusLogs.insertOne(statusLogData);

            let orderLogId = logRes?.insertedId || "";

            let orderUpdateData = Constants.ORDER_ACTIONS?.[orderStatus] || {};
			if(isModified && !isAdmin) orderUpdateData = {};

			let orderUpdateDetails= {$set: orderUpdateData};

			if(orderStatus == Constants.ORDER_DRIVER_PASSED || orderStatus == Constants.ORDER_DRIVER_UNDO_ASSIGNED){
				orderUpdateDetails = {
					$set   : {},
					$unset : {
						delivery_status 		: 1,
						assigned_captain 		: 1,
						assigned_captain_status	: 1
					}
				};

				if(orderStatus == Constants.ORDER_DRIVER_UNDO_ASSIGNED) orderUpdateDetails["$set"]["captain_id"] = "";
			}

			if(orderStatus && Constants.ORDER_FINISH_ACTIONS.indexOf(orderStatus) != -1){
				orderUpdateDetails["$set"]["is_completed"] = true;
				orderUpdateDetails["$set"]["queue_time"] = "";
			}

			if(orderStatus && Constants.ORDER_REASON_STATUS.indexOf(orderStatus) == -1){
				if(!orderUpdateDetails["$unset"]) orderUpdateDetails["$unset"] = {};
				orderUpdateDetails["$unset"].rejection_reason = 1;
			}

			if(orderStatus == Constants.ORDER_CANCELLED || orderStatus == Constants.ORDER_REJECTED || orderStatus == Constants.ORDER_REJECTED_BY_ADMIN){
				orderUpdateDetails["$set"]["cancelled_by"] = updatedBy;
			}

            if(orderStatus == Constants.ORDER_PREPARING){
                orderUpdateDetails["$set"].order_preparing_time = getUtcDate();
            }

            if(orderStatus == Constants.ORDER_READY_TO_PICK_UP){
                orderUpdateDetails["$set"].order_ready_to_pick_up_time = getUtcDate();
            }

			/** Remove customer status when order rejected by kfg api  */
			if(kfgApi && orderUpdateDetails["$set"].customer_status) delete orderUpdateDetails["$set"].customer_status;

            orderUpdateDetails["$set"]["last_status_updated_on"] = 	getUtcDate();

            /** Update details in orders collection */
            const updateRes = await orders.findOneAndUpdate(
                {_id: orderId },
                orderUpdateDetails,
                {projection :{_id: 1, rejection_reason:1,branch_id:1,restaurant_id:1,customer_id:1,order_assignment_start_time:1,unique_order_id:1,captain_id:1,order_date:1, is_guest:1,assigned_captain:1}}
            );

            /** Send success response */
            resolve({status: Constants.STATUS_SUCCESS });

            let orderData       =   updateRes || {};
            let lastOdId        =   orderData?._id || "";
            let uniqueOrderId	=	orderData?.unique_order_id || '';

            if(orderLogId && Constants.ORDER_REASON_STATUS.indexOf(orderStatus) >= 0){
                await orderStatusLogs.updateOne({_id: orderLogId},{$set: {"extra_perms.rejection_reason": orderData?.rejection_reason || "" }},()=>{ });
            }

            /** Update order estimate Time */
            if(Constants.ORDER_FINISH_ACTIONS.indexOf(orderStatus) == -1 && [Constants.ORDER_SUBMITTED,Constants.ORDER_SCHEDULED,Constants.ORDER_CONFIRMED].indexOf(orderStatus) >= 0){
                updateOrderEstimateTime(req,res,next,{order_id: orderId}).then(()=>{});
            }

            /** Update assignment start process time **/
            if(orderStatus == Constants.ORDER_PREPARING || orderStatus == Constants.ORDER_READY_TO_PICK_UP){
                if(orderData?.branch_id && orderData?.restaurant_id && !orderData?.order_assignment_start_time){

                    let branchId     = orderData?.branch_id || '';
                    let restaurantId = orderData?.restaurant_id || '';

                    asyncParallel({
                        branch_details : (braCallback)=>{
                            /** Find branch details */
                            const restaurant_branches =	dbInstance.collection(Tables.RESTAURANT_BRANCHES);
                            restaurant_branches.findOne({_id: branchId },{projection: { auto_assignment_start_after: 1}}).then(braResult=>{
                                braCallback(null, braResult);
                            }).catch(next);
                        },
                        rest_details : (resCallback)=>{
                            /** Find restaurant details */
                            const restaurants =	dbInstance.collection(Tables.RESTAURANTS);
                            restaurants.findOne({_id: restaurantId },{projection: { auto_assignment_start_after: 1}}).then(resResult=>{
                                resCallback(null, resResult);
                            }).catch(next);
                        },
                        order_details : (detailCallback)=>{
                            /** Find order details */
                            orderDetails.findOne({order_id: orderId },{projection:{preparation_time:1}}).then(detailsResult=>{
                                detailCallback(null, detailsResult);
                            }).catch(next);
                        },
                    },(_, assignAsyncResponse)=>{

                        let odDetailsRes 		= 	assignAsyncResponse?.order_details || {};
                        let braDetails 	 		= 	assignAsyncResponse?.branch_details || {};
                        let resDetails 	 		=	assignAsyncResponse?.rest_details || {};
                        let odPreparationTime 	=	odDetailsRes?.preparation_time || 0;
                        let braAssignStartTime	=	braDetails?.auto_assignment_start_after || 0;
                        let resAssignStartTime	=	resDetails?.auto_assignment_start_after || 0;
                        let assignmentStartTime	=	braAssignStartTime || resAssignStartTime;

                        let startTimeMin		=	parseFloat(odPreparationTime)-assignmentStartTime;
                        if(startTimeMin < 0) startTimeMin = 0;
                        let finalAssignmentTime	=	getUtcDate(addDate(startTimeMin/Constants.MINUTES_IN_A_HOUR));

                        /** Update auto assignment start time */
                        orders.updateOne({
                            _id : orderId,
                            order_assignment_start_time	: {$exists:false}
                        },{$set: {order_assignment_start_time : finalAssignmentTime, }}).then(()=>{});

                        /** Update auto assignment start time in logs details */
                        orderStatusLogs.updateOne({
                            _id: orderLogId
                        },
                        {$set: {
                            "extra_perms.branch_auto_assignment_start_after_time"	 : braAssignStartTime,
                            "extra_perms.restaurant_auto_assignment_start_after_time": resAssignStartTime,
                        }}).then(()=>{});
                    });
                }
            }

            /** Update captain free time */
            if(lastOdId && (Constants.DRIVER_ORDER_STATUS?.[orderStatus] || Constants.ORDER_FINISH_ACTIONS.indexOf(orderStatus) != -1)){

                let firstOrderPoints	    =   parseFloat(res?.locals?.settings?.['Rewards_and_referrals.first_order_complete_points'] || 0);
                let enableFirstOrderPoints  =   parseInt(res?.locals?.settings?.['Rewards_and_referrals.enable_first_order_complete_points'] || 0);

                /** Referee first order points  */
                if(enableFirstOrderPoints == Constants.ACTIVE && firstOrderPoints >0 && orderStatus == Constants.ORDER_DELIVERED && orderData.customer_id && !orderData.is_guest){

                    let customerId = orderData.customer_id;
                    asyncParallel({
                        customer_details :(firstCallback)=>{
                            users.findOne({
                                _id: customerId,
                                "referral_details.referred_by": {$exists: true, $ne: ""},
                            },{projection:{referral_details:1}}).then(userResult=>{
                                firstCallback(null, userResult);
                            }).catch(next);
                        },
                        user_order_count: (firstCallback)=>{
                            /** Get order count  */
                            orders.countDocuments({
                                customer_id	:	customerId,
                                is_confirm	:	{$exists: false},
                            }).then(orderCount=>{
                                firstCallback(null, orderCount);
                            }).catch(next);
                        },
                    },(_, firstResponse)=>{

                        if(firstResponse?.customer_details?.referral_details?.referred_by && firstResponse?.user_order_count <= 1){

                            /** Add first order points in wallet */
                            updateWalletBalance(req,res,next,{
                                user_id 		:	firstResponse?.customer_details?.referral_details?.referred_by,
                                amount 			: 	firstOrderPoints,
                                wallet_type  	: 	Constants.POINTS_AMOUNT,
                                transaction_type: 	Constants.CREDIT,
                                extra_parameters:	{
                                    first_order :   true,
                                    referee_id	: 	customerId
                                },
                            }).then(()=>{ });
                        }
                    });
                }

                /** Update  delivery time */
                if(orderStatus == Constants.ORDER_DELIVERED && orderData.order_date){
                    let startDate  = orderData.order_date;
                    let endDate    = newDate();
                    let deliveryIn = getDifferenceBetweenTwoDatesInMinute(startDate,endDate);
                    deliveryIn 	   = round(deliveryIn);

                    /** Update delivery in time */
                    orderDetails.updateOne({order_id: orderId },{$set: {delivery_in: parseInt(deliveryIn)}}).then(() => { });
                }

                let captainId =	orderData?.captain_id || orderData?.assigned_captain || "";
                if(captainId){
                    /** Get captain details */
                    users.findOne({_id: captainId},{projection:{orders:1,active_orders:1}}).then(userResult=>{
                        if(userResult){
                            let captainConditions = {_id: captainId};

                            /** Captain update details  */
                            let userUpdateData ={
                                $set :{
                                    modified_at : getUtcDate()
                                }
                            };

                            let captainOrders	=   userResult?.orders || [];
                            let multipleOrders	=	(captainOrders.length >1) ? true :false;

                            if(Constants.DRIVER_ORDER_STATUS[orderStatus]){
                                userUpdateData["$set"].order_status = orderStatus;
                                userUpdateData["$set"]["orders.$.status"] = orderStatus;
                                captainConditions.orders ={$elemMatch:{order_id:orderId }};
                            }

                            if(Constants.ORDER_FINISH_ACTIONS.indexOf(orderStatus)  != -1){
                                if(multipleOrders){
                                    let freeIn 				= 	0;
                                    let nextOrderStatus 	=  	"";
                                    let currentOrderIndex 	=	0;
                                    captainOrders.map((records,captainOrderIndex)=>{
                                        if(String(records.order_id) != String(orderId)) {
                                            if(freeIn < records.free_in)  freeIn = records.free_in;
                                        }

                                        if(String(records.order_id) == String(orderId)) {
                                            currentOrderIndex	=	captainOrderIndex;
                                        }else{
                                            nextOrderStatus 	=  	records.status;
                                        }
                                    });

                                    if(!nextOrderStatus && captainOrders[currentOrderIndex-1]){
                                        nextOrderStatus = captainOrders[currentOrderIndex-1].status;
                                    }

                                    userUpdateData["$set"].free_in 		= 	freeIn;
                                    userUpdateData["$set"].order_status =	nextOrderStatus;

                                    userUpdateData["$pull"] = {orders: {order_id: {$in: [orderId]} }};
                                }else if(captainOrders[0] && String(captainOrders[0].order_id) == String(orderId)){
                                    userUpdateData["$unset"]= {free_in: 1, orders: 1,delivery_latitude:1,delivery_longitude:1,order_prepare_remaining_time:1};

                                    userUpdateData["$set"].order_status = Constants.ORDER_DRIVER_FREE;
                                }

                                if(userResult.active_orders && userResult.active_orders > 0){
                                    userUpdateData["$inc"] 	= {active_orders: -1};
                                }
                            }

                            /** Update captain details  */
                            if(Object.keys(userUpdateData).length > 0){
                                users.updateOne(captainConditions,userUpdateData).then(()=>{ }).catch(next);
                            }

                            if(Constants.ORDER_FINISH_ACTIONS.indexOf(orderStatus)  != -1){
                                const order_assignment_logs = dbInstance.collection(Tables.ORDER_ASSIGNMENT_LOGS);
                                order_assignment_logs.updateMany({
                                    captain_id	: captainId,
                                    order_id	: orderId
                                },
                                {$set: {
                                    current_status 	: 	orderStatus,
                                    modified 		: 	getUtcDate(),
                                }}).then(()=>{ }).catch(next);
                            }
                        }
                    }).catch(next);
                }

                /** Update transmission time*/
                if(orderStatus == Constants.ORDER_PREPARING || orderStatus == Constants.ORDER_READY_TO_PICK_UP){
                    updateOrderTransmissionTime(req,res,next,{order_id: orderId, is_branch_tt: orderStatus == Constants.ORDER_READY_TO_PICK_UP || false }).then(()=>{});
                }
            }

            if(lastOdId && ((orderStatus == Constants.ORDER_DRIVER_PASSED || orderStatus == Constants.ORDER_DRIVER_UNDO_ASSIGNED) && (userId || updatedBy))){
                let orderDriverId = ( orderStatus == Constants.ORDER_PROBLEMATIC) ? updatedBy :userId;

                users.findOne({_id: orderDriverId },{projection:{orders:1, active_orders:1}}).then(userResult=>{
                    if(userResult){
                        /** Captain update details  */
                        let userUpdateData ={
                            $set :{
                                modified_at : getUtcDate()
                            }
                        };
                        let captainOrders	=	userResult?.orders || [];
                        let multipleOrders	=	(captainOrders.length >1) ? true :false;

                        if(!multipleOrders){
                            userUpdateData["$unset"]= {free_in: 1, orders: 1,delivery_latitude:1,delivery_longitude:1,order_prepare_remaining_time:1};

                            userUpdateData["$set"].order_status = Constants.ORDER_DRIVER_FREE;
                        }else{
                            let freeIn 				= 	0;
                            let nextOrderStatus 	=  	"";
                            let currentOrderFlag 	=	false;
                            let currentOrderIndex 	=	0;
                            captainOrders.map((records)=>{
                                if(String(records.order_id) != String(orderId)) {
                                    if(freeIn < records.free_in)  freeIn = records.free_in;
                                }

                                if(String(records.order_id) == String(orderId)) {
                                    currentOrderFlag = true;
                                }else{
                                    nextOrderStatus 	=  	records.status;
                                    currentOrderFlag	=	false;
                                }
                            });

                            if(!nextOrderStatus && captainOrders[currentOrderIndex-1]){
                                nextOrderStatus = captainOrders[currentOrderIndex-1].status;
                            }

                            userUpdateData["$set"].free_in 		= 	freeIn;
                            userUpdateData["$set"].order_status =	nextOrderStatus;
                            userUpdateData["$pull"] = {orders: {order_id: {$in: [orderId]} }};
                        }

                        if(userResult.active_orders && userResult.active_orders > 0){
                            userUpdateData["$inc"] 	= {active_orders: -1};
                        }

                        /** Update captain details  */
                        users.updateOne({_id: orderDriverId },userUpdateData).then(() => { });
                    }
                }).catch(next);
            }


			let eventType			=	'';
			let notificationType	=	'';
			switch(orderStatus){
				case Constants.ORDER_PENDING:
				case Constants.ORDER_SUBMITTED:
					if(isModified){
						eventType			=	Constants.ORDER_STATUS_MODIFIED_EVENT;
						notificationType	=	Constants.NOTIFICATION_ORDER_MODIFIED;
					}else{
						userId				=	restaurantId;
						eventType			=	Constants.ORDER_STATUS_PENDING_EVENT;
						notificationType	=	Constants.NOTIFICATION_ORDER_PENDING;
					}
				break;
				case Constants.ORDER_DRIVER_ACCEPTED:
					eventType			=	Constants.ORDER_STATUS_DRIVER_ACCEPTED_EVENT;
					notificationType	=	Constants.NOTIFICATION_DRIVER_ACCEPTED_ORDER;
				break;
				case Constants.ORDER_DRIVER_ARRIVED_AT_RESTAURANT:
					eventType			=	Constants.ORDER_STATUS_DRIVER_ACCEPTED_EVENT;
					notificationType	=	Constants.NOTIFICATION_DRIVER_ARRIVED_ORDER;
				break;
				case Constants.ORDER_DRIVER_WAY_TO_CUSTOMER:
					eventType			=	Constants.ORDER_STATUS_DRIVER_WAY_TO_CUSTOMER_EVENT;
					notificationType	=	Constants.NOTIFICATION_ORDER_WAY_AT_CUSTOMER_LOCATION;
				break;
				case Constants.ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION:
					eventType			=	Constants.ORDER_STATUS_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION_EVENT;
					notificationType	=	Constants.NOTIFICATION_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION;
				break;
				case Constants.ORDER_DRIVER_ASSIGNED:
					eventType			=	Constants.ORDER_STATUS_DRIVER_ASSIGNED_EVENT;
					notificationType	=	Constants.NOTIFICATION_DRIVER_ASSIGNED_ORDER;
				break;
				case Constants.ORDER_PREPARING:
					eventType			=	Constants.ORDER_STATUS_PREPARING_EVENT;
					notificationType	=	Constants.NOTIFICATION_ORDER_PREPARING;
				break;
				case Constants.ORDER_READY_TO_PICK_UP:
					eventType			=	Constants.ORDER_STATUS_READY_TO_PICK_UP_EVENT;
					notificationType	=	Constants.NOTIFICATION_ORDER_READY_TO_PICK_UP;
				break;
				case Constants.ORDER_ON_THE_WAY:
					eventType			=	Constants.ORDER_STATUS_ON_THE_WAY_EVENT;
					notificationType	=	Constants.NOTIFICATION_ORDER_ON_THE_WAY;
				break;
				case Constants.ORDER_DELIVERED:
					eventType			=	Constants.ORDER_STATUS_DELIVERED_EVENT;
					notificationType	=	Constants.NOTIFICATION_ORDER_DELIVERED;
				break;
				case Constants.ORDER_REJECTED:
				case Constants.ORDER_REJECTED_BY_ADMIN:
					eventType			=	Constants.ORDER_STATUS_REJECTED_EVENT;
					notificationType	=	Constants.NOTIFICATION_ORDER_REJECTED;
				break;
				case Constants.ORDER_CONFIRMED:
					eventType			=	Constants.ORDER_STATUS_CONFIRMED_EVENT;
					notificationType	=	Constants.NOTIFICATION_ORDER_CONFIRMED;
				break;
				case Constants.ORDER_CANCELLED:
					eventType			=	Constants.ORDER_STATUS_CANCELLED_EVENT;
					notificationType	=	Constants.NOTIFICATION_ORDER_CANCELLED;
				break;
				case Constants.ORDER_PROBLEMATIC:
					eventType			=	Constants.ORDER_STATUS_PROBLEMATIC_EVENT;
					notificationType	=	Constants.NOTIFICATION_ORDER_PROBLEMATIC;
				break;
			}

            if(orderStatus != Constants.ORDER_SCHEDULED){
				if(eventType && notificationType && !notSendNotification){

                    /*************** Send Mail  ***************/
                    sendMailToUsers(req,res,{
                        notification_call_center : notificationToCallCenter,
                        event_type 			: eventType,
                        notification_type	: notificationType,
                        user_role_id		: userRoleId,
                        order_id			: orderId,
                        unique_order_id		: uniqueOrderId,
                        action_taken		: orderStatus,
                        user_id				: updatedBy,
                        receiver_id			: userId,
                        captain_name		: captainName,
                        is_admin			: isAdmin,
                        restaurant_id 		: restaurantId,
                        order_status 		: orderStatus
                    });
                    /*************** Send Mail  ***************/
				}

				/* For restaurant refresh button */
				if(Constants.RESTAURANT_ORDER_STATUS_TYPES[orderStatus] && !notSendNotification){
					socketRequest(req,res,{
						emit_function : "remove_class",
						room_id : restaurantId,
						branch_id: branchId,
						class_to_remove : "hide",
						class_remove_from : "status_change_"+orderStatus,
						action: "order_status_refresh"
					});
				}
			}
        } catch (e) {
            console.error("Error at saveOrderStatusLogs utility ",e);
            return {status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") };
        }
    }).catch(next);
};//end saveOrderStatusLogs()

/**
 * Function to update user details in orders (when customer profile is updated)
 *
 * @param req	As Request Data
 * @param res	As Response Data
 * @param next	As Callback argument to the middleware function
 * @param options	As Object Data { user_id }
 *
 * @return Promise
 */
export const updateUserDetailsInOrders = (req, res, next, options = {}) => {
	return new Promise(resolve => {
		let customerId = (options.user_id) ? new ObjectId(options.user_id) : "";
		if (!customerId) return resolve({ status: Constants.STATUS_ERROR });

		let dbInstance = getDb();
		const users = dbInstance.collection(Tables.USERS);
		users.findOne({ _id: customerId }, { projection: { full_name: 1, first_name: 1, last_name: 1, mobile_number: 1 } }).then(result => {
			if (!result) return resolve({ status: Constants.STATUS_ERROR });

			const orders = dbInstance.collection(Tables.ORDERS);
			orders.updateMany(
				{ customer_id: customerId },
				{
					$set: {
						full_name: (result.full_name) ? result.full_name : "",
						first_name: (result.first_name) ? result.first_name : "",
						last_name: (result.last_name) ? result.last_name : "",
						mobile_number: (result.mobile_number) ? result.mobile_number : "",
						modified: getUtcDate()
					}
				}
			).then(() => resolve({ status: Constants.STATUS_SUCCESS })).catch(err => next(err));
		}).catch(err => next(err));
	});
};// end updateUserDetailsInOrders()

/**
 * Function to update transmission time in order
 *
 * @param req	As Request Data
 * @param res	As Response Data
 * @param next	As Callback argument to the middleware function
 *
 * @return json
 **/
export const updateOrderTransmissionTime = async (req,res,next,options = {})=>{
	try {
		let orderId		= options?.order_id || "";
        let isBranchTT	= options?.is_branch_tt || false;

		if(!orderId) return {status: Constants.STATUS_SUCCESS};

        let dbInstance = getDb();
        const orderDb           =   dbInstance.collection(Tables.ORDERS);
		const orderStatusLogs   =   dbInstance.collection(Tables.ORDER_STATUS_LOGS);
		asyncParallel({
			placement_time :(callback)=>{
				orderStatusLogs.findOne({order_id : new ObjectId(orderId),status : Constants.ORDER_SUBMITTED},{ projection: {created : 1}}).then(result=>{
					callback(null, result?.created || "");
				}).catch(next);
			},
			preparing_time :(callback)=>{
				if(isBranchTT) return callback(null,null);

				orderStatusLogs.findOne({order_id : new ObjectId(orderId),status : Constants.ORDER_PREPARING},{ projection: {created : 1}}).then(result=>{
					callback(null, result?.created || "");
				}).catch(next);
			},
			ready_to_pickup :(callback)=>{
				if(!isBranchTT) return callback(null,null);

				orderStatusLogs.findOne({order_id: new ObjectId(orderId),status : Constants.ORDER_READY_TO_PICK_UP},{ projection: {created : 1}}).then(result=>{
					callback(null, result?.created || "");
				}).catch(next);
			},
		},(_,response)=>{
			let endTime = (isBranchTT) ? response.ready_to_pickup : response.preparing_time;
			if(!response.placement_time || !endTime) return {status : Constants.STATUS_ERROR};

            let transmissionTime = getDifferenceBetweenTwoDatesInMinute(response.placement_time,endTime);
			let dataToBeUpdated  = {
				modified : getUtcDate()
			};
			if(isBranchTT && transmissionTime){
				dataToBeUpdated.branch_transmission_time = round(transmissionTime);
			}else if(transmissionTime){
				dataToBeUpdated.transmission_time = round(transmissionTime);
			}

			orderDb.updateOne({ _id : new ObjectId(orderId)},{$set : dataToBeUpdated}).then(()=>{

                /** Send response */
                return {status: Constants.STATUS_SUCCESS};
			}).catch(next);
		});
    } catch (e) {
		console.error("Error at updateOrderTransmissionTime utility ",e);
		return {status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") };
	}
};// end updateOrderTransmissionTime()

/**
 * Function to update order estimate time
 *
 * @param req	As Request Data
 * @param res	As Response Data
 * @param next	As Callback argument to the middleware function
 *
 * @return json
**/
export const updateOrderEstimateTime = (req,res,next,options={})=>{
    try {
        let orderId	= options?.order_id ? new ObjectId(options?.order_id) :"";

        /** Send error response **/
        if(!orderId) return {status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters")};

        let dbInstance = getDb();
        const orderDb          =   dbInstance.collection(Tables.ORDERS);
		const orderDetailsDb   =   dbInstance.collection(Tables.ORDER_DETAILS);
        asyncParallel({
            order_data: (callback)=>{
                /** Get order details */
                orderDb.findOne({
                    _id: orderId
                },{projection: {_id:1, is_big_order:1, order_date:1, delivery_type:1, is_schedule:1, scheduled_date:1, is_confirm:1}}).then(result=>{
                    callback(null, result);
                }).catch(next);
            },
            order_details: (callback)=>{
                /** Get order sub details */
                orderDetailsDb.findOne({order_id: orderId },{projection: {preparation_time:1, delivery_duration:1}}).then(result=>{
                    callback(null, result);
                }).catch(next);
            },
        },(asyncErr,asyncResponse)=>{
            if(asyncErr) return next(asyncErr);

            /** Send error response **/
            if(!asyncResponse.order_data || !asyncResponse.order_details){
                return {status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again"), asyncResponse: asyncResponse };
            }

            let orderData 			= 	asyncResponse.order_data;
            let orderSubDetails		=	asyncResponse.order_details;
            let isConfirm			=	orderData.is_confirm;
            let tmpOrderDate 		= 	orderData.order_date;
            let tmpDeliveryType 	= 	orderData.delivery_type;
            let isSchedule 			= 	orderData.is_schedule;
            let scheduledDate 		= 	orderData.scheduled_date;
            let preparationTime 	= 	orderSubDetails.preparation_time;
            let deliveryDuration 	= 	orderSubDetails.delivery_duration;
            let tmpDate				=	(isSchedule) ? scheduledDate :tmpOrderDate;
            let tmpOrderFinishedTime= 	deliveryDuration/Constants.MINUTES_IN_A_HOUR;
            let estimateTime 		= 	getUtcDate(addDaysToDate(tmpOrderFinishedTime, tmpDate));

            /** Send success response **/
            if(!isConfirm) return {status: Constants.STATUS_SUCCESS, is_confirm : isConfirm };

            /** Update order  */
            orderDb.updateOne({
                _id: orderId
            },
            {$set: {
                order_estimate_time : estimateTime
            }}).then(()=>{

                /** Send success response **/
                return {status: Constants.STATUS_SUCCESS };
            }).catch(next);
        });
    } catch (e) {
		console.error("Error at updateOrderEstimateTime utility ",e);
		return {status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") };
	}
};// end updateOrderEstimateTime()

/**
 * Function to calculate cravez/restaurant commission
 *
 * @param req		As Request Data
 * @param res		As Response Data
 * @param next		As Callback argument to the middleware function
 * @param options	As Object data
 *
 * @return json
 **/
export const calculateOrderPayout = (req,res,next,options)=>{
	return new Promise(resolve=>{
		let orderId  =   (options.order_id) ? new ObjectId(options.order_id) :"";

		/** Send error response */
		if(!orderId) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters")});

		/** Get detail of Order **/
        let dbInstance = getDb();
		const orders = dbInstance.collection(Tables.ORDERS);
		orders.findOne({
			_id : orderId
		},{projection: {
			_id: 1, restaurant_id: 1, delivery_type: 1, knet_charges: 1,refund_amount_status:1,refund_amount:1
		}}).then(orderResult=>{

			/** Send error response */
			if(!orderResult) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });

			let restaurantId =	(orderResult.restaurant_id) ? orderResult.restaurant_id :'';
			asyncParallel({
				restaurant_detail :(callback)=>{
					/** Get restaurant details */
					const restaurant_details = dbInstance.collection(Tables.RESTAURANT_DETAILS);
					restaurant_details.findOne({
						restaurant_id : restaurantId
					},{projection: {commission_value:1,caused_by:1 }}).then(restResult=>{
						callback(null, restResult);
					}).catch(next);
				},
				order_detail :(callback)=>{
					/** Get detail of Orders **/
					const order_details = dbInstance.collection(Tables.ORDER_DETAILS);
					order_details.aggregate([
						{$match: {order_id : orderId}},
						{$lookup:	{
							"from" 			: 	Tables.OFFERS,
							"localField" 	:	"offer_id",
							"foreignField" 	: 	"_id",
							"as" 			: 	"offer_detail"
						}},
						{$project: {
							order_id:1, net_amount:1, total_amount:1, discount_price:1, delivery_fee:1, branch_discount: 1, total_amount: 1,
							restaurant_discount_ratio: {$arrayElemAt: ["$offer_detail.restaurant_discount_ratio",0]}
						}},
					]).toArray().then(detailResult=>{
						callback(null,detailResult?.[0] || null);
					}).catch(next);
				}
			},(asyncErr, response)=>{
				if(asyncErr) return next(asyncErr);

				/** Send error response */
				if(!response.restaurant_detail || !response.order_detail){
					return resolve({status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });
				}

				let restaurantDetail	=	response.restaurant_detail;
				let orderDetail			=	response.order_detail;
				let orderAmount			=	orderDetail.total_amount;
				let deliveryFee			=	orderDetail.delivery_fee;
				let commissionObj		=	restaurantDetail.commission_value;
				let causedBy			=	restaurantDetail.caused_by;
				let deliveryType		=	orderResult.delivery_type;
				let isRefunded			=	orderResult.refund_amount_status;
				let refundAmount		=	orderResult.refund_amount;
				let restaurantDiscountRatio	= (orderDetail.restaurant_discount_ratio) ? orderDetail.restaurant_discount_ratio :0;
                let paymentCharges		=	orderResult?.payment_charges || {};
				let percentage			=	0;

                let knetCharges	=	0;
                if(typeof paymentCharges != typeof undefined){
					Object.keys(paymentCharges).map(charge => {
						knetCharges	+=	paymentCharges[charge].gateway_charge;
					});
				}

				/** get commission according delivery type*/
				let commissionData		= (commissionObj && commissionObj[deliveryType]) ? commissionObj[deliveryType] : {};
				let commissionType		= commissionData.commission_type;
				let commissionValues	= commissionData.values;

				if(commissionValues && commissionValues.constructor === Array && commissionValues[0]){
					percentage = (commissionValues[0].commission) ? commissionValues[0].commission :0;

					if(commissionType == Constants.COMMISSION_VARIABLE){
						commissionValues.map(value=>{
							let commissionFrom	=	value.from;
							let commissionTo	=	value.to;
							if(orderAmount > commissionFrom && orderAmount < commissionTo){
								percentage =	(value.commission) ? value.commission :0;
							}
						});
					}
				}

				let restaturantCausedBy =	0;
				if(causedBy && causedBy.length > 0){
					causedBy.map(rec=>{
						if(rec.cause == Constants.CAUSED_BY_RESTAURANT){
							restaturantCausedBy = round(rec?.percentage || 0);
						}
					});
				}

				let cravezPayout 		=	0;
				let restaurantPayout 	=	0;
				let totalPayout 		=	orderAmount;

				if(orderAmount > 0){
					if(deliveryType == Constants.DELIVERY_BY_CRAVEZ)  totalPayout -= deliveryFee;
					cravezPayout 	=	(percentage) ? (totalPayout*percentage)/Constants.MAX_PERCENTAGE	:0;
					restaurantPayout=	totalPayout-cravezPayout-knetCharges;

					/**Deduct offer discount ratio  from restaurants amount*/
					if(restaurantDiscountRatio){
						let offerAmount = (restaurantPayout*restaurantDiscountRatio)/100;
						restaurantPayout= (restaurantPayout-offerAmount);
					}

					/**Deduct restaurant payout if refund caused by restaurant*/
					if(isRefunded && refundAmount && restaturantCausedBy){
						let causeAmount = (refundAmount*restaturantCausedBy)/100;
						restaurantPayout= (restaurantPayout-causeAmount);
					}
				}

				/** Update orders payout */
				orders.updateOne({
					_id : new ObjectId(orderId)
				},
				{$set : {
					total_payout		:	round(totalPayout),
					cravez_payout		:	round(cravezPayout),
					restaurant_payout	:	round(restaurantPayout),
					restaurant_discount_percentage: restaurantDiscountRatio,
					payout_percentage	:	percentage,
                    gateway_charge		:	round(knetCharges,Constants.CURRENCY_ROUND_PRECISION),
					discount_refund_to_restaurant:	0
				}}).then(()=> {

					resolve({ status : Constants.STATUS_SUCCESS });
				}).catch(next);
			});
		}).catch(next);
	}).catch(next);
}//End calculateOrderPayout()