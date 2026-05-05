import { ObjectId } from "mongodb";
import clone from "clone";
import { parallel as asyncParallel } from "async";
import * as Constants from "../config/global_constant.mjs";
import * as Helper from "../utils/index.mjs";
import Tables from './../config/database_tables.mjs';
import { getDb } from '../config/connection.mjs';
import { insertNotifications, sendMail, sendSMS } from "../services/index.mjs";

/**
 * Function to send mail on various events
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} options - passed object data
 *
 * @return array
 */
export const sendMailToUsers = async (req,res,options)=>{
	let notificationCallCenter= options?.notification_call_center || "";
	let eventType = options?.event_type || "";
	let NotificationType = options?.notification_type || "";
	let userId = options?.user_id || "";
	let userRoleId = options?.user_role_id || "";
	let receiverId = options?.receiver_id || "";
	let orderId = options?.order_id || "";
	let orderUniqueId = options?.unique_order_id || "";
	let isAdmin = options?.is_admin || "";
	let notificationOptions = clone(options);

	if(notificationOptions.time_out) delete notificationOptions.time_out;
	if(notificationOptions.event_type) delete notificationOptions.event_type;

	let dbInstance = getDb();
	const users = dbInstance.collection(Tables.USERS);
	const orders = dbInstance.collection(Tables.ORDERS);
	const order_details = dbInstance.collection(Tables.ORDER_DETAILS);
	const restaurants = dbInstance.collection(Tables.RESTAURANTS);
	const restaurant_details = dbInstance.collection(Tables.RESTAURANT_DETAILS);
	const restaurant_branches = dbInstance.collection(Tables.RESTAURANT_BRANCHES);
	const tmp_restaurant_branches=	dbInstance.collection(Tables.TMP_RESTAURANT_BRANCHES);
	const restaurant_enquiries	= dbInstance.collection(Tables.RESTAURANT_ENQUIRIES);

	if(eventType == Constants.BRANCH_ENQUIRY_APPROVE_EMAIL_EVENTS){
		/** Save scheduled notifications details */
		const scheduled_notifications = dbInstance.collection(Tables.SCHEDULED_NOTIFICATIONS);
		scheduled_notifications.insertOne({
			is_sent 		: Constants.NOT_SENT,
			scheduled_date 	: options.scheduled_date ? Helper.getUtcDate(options.scheduled_date) : Helper.getUtcDate(),
			event_type		: options.event_type,
			options 		: notificationOptions,
			created 		: Helper.getUtcDate()
		}).then(()=>{}).catch(err=>{
			console.error("save scheduled_notifications in sendMailToUsers error ===>",eventType, err);
		});
	}

	let userDetails = null;
	if(userId && [
		Constants.ORDER_STATUS_PREPARING_EVENT,
		Constants.ORDER_STATUS_DRIVER_WAY_TO_CUSTOMER_EVENT,
		Constants.ORDER_STATUS_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION_EVENT,
		Constants.ORDER_STATUS_ON_THE_WAY_EVENT,
		Constants.ORDER_STATUS_CANCELLED_EVENT,
		Constants.USER_REGISTRATION_EMAIL_EVENTS,
		Constants.TEAM_BREAK_APPROVE_REJECT_EMAIL_EVENTS,
		Constants.TEAM_BREAK_REQUEST_POSTED_EMAIL_EVENTS,
		Constants.NOTIFICATION_OVERTIME_REQUEST,
		Constants.NOTIFICATION_CAPTAIN_OVERTIME_REQUEST,
		Constants.NOTIFICATION_VACATION_REQUEST,
		Constants.NOTIFICATION_WEEKLY_REQUEST,
		Constants.DRIVER_BREAK_APPROVE_REJECT_EMAIL_EVENTS,
		Constants.DRIVER_BREAK_REQUEST_POSTED_EMAIL_EVENTS,
		Constants.DRIVER_BREAK_REQUEST_ENDED_EMAIL_EVENTS,
		Constants.DRIVER_EXCUSES_REQUEST_POSTED_EMAIL_EVENTS,
		Constants.DRIVER_EXCUSE_APPROVE_REJECT_EMAIL_EVENTS,
		Constants.DRIVER_BREAK_CANCEL_EMAIL_EVENTS,
		Constants.DRIVER_EXCUSE_CANCEL_EMAIL_EVENTS,
		Constants.DRIVER_BREAK_ADD_EMAIL_EVENTS,
		Constants.DRIVER_BREAK_END_EMAIL_EVENTS,
	].indexOf(eventType) != -1){
		userDetails = await users.findOne({_id : new ObjectId(userId)},{projection:{full_name:1,_id:1,email:1,user_role_id:1,is_email_verified:1,parent_id:1}});
	}

	let memberDetails = null;
	if(options?.member_id && [
		Constants.DRIVER_EXCUSES_REQUEST_POSTED_EMAIL_EVENTS,
		Constants.TEAM_BREAK_REQUEST_POSTED_EMAIL_EVENTS,
	].indexOf(eventType) != -1){
		memberDetails = await users.findOne({_id : new ObjectId(options?.member_id)},{projection:{full_name:1,_id:1,email:1,user_role_id:1,is_email_verified:1,parent_id:1}});
	}

	let orderDetails = null;
	if(orderId && [
		Constants.ORDER_STATUS_READY_TO_PICK_UP_EVENT,
		Constants.ORDER_STATUS_CANCELLED_EVENT,
		Constants.ORDER_STATUS_PROBLEMATIC_EVENT,
	].indexOf(eventType) != -1){
		orderDetails = await orders.findOne({_id : new ObjectId(orderId)},{projection:{captain_id:1, unique_order_id: 1}});
	}

	let adminUserDetails = null
	if([
		Constants.USER_REGISTRATION_EMAIL_EVENTS,
	].indexOf(eventType) != -1){
		adminUserDetails = await users.findOne({user_role_id: {$in: [Constants.SYSTEM_ADMIN_ROLE_ID, Constants.CRAVEZ]}},{projection:{full_name:1,_id:1},sort: {_id: Constants.SORT_DESC}});
	}

	let restaurantDetails = null;
	if(options?.restaurant_id && [
		Constants.RESTAURANT_CATEGORY_REJECT_EMAIL_EVENTS,
		Constants.RESTAURANT_CATEGORY_APPROVE_EMAIL_EVENTS,
		Constants.RESTAURANT_MENU_REJECT_EMAIL_EVENTS,
		Constants.RESTAURANT_MENU_APPROVE_EMAIL_EVENTS,
		Constants.NOTIFICATION_CUISINE_PRIORITIES_REJECTED,
		Constants.NOTIFICATION_CUISINE_PRIORITIES_APPROVED,
		Constants.NOTIFICATION_FOR_RESTAURANT_UPDATED_PASSWORD,
	].indexOf(eventType) != -1){
		restaurantDetails = await restaurants.findOne({_id : new ObjectId(options.restaurant_id)},{projection :{_id:1,default_name:1,name:1,slug:1}});
	}

	let restaurantUserList = null;
	if(options?.restaurant_id && userId && [
		Constants.RESTAURANT_CATEGORY_REJECT_EMAIL_EVENTS,
		Constants.RESTAURANT_CATEGORY_APPROVE_EMAIL_EVENTS,
		Constants.RESTAURANT_MENU_REJECT_EMAIL_EVENTS,
		Constants.RESTAURANT_MENU_APPROVE_EMAIL_EVENTS,
		Constants.RESTAURANT_ITEM_APPROVE_EMAIL_EVENTS,
		Constants.RESTAURANT_ITEM_REJECT_EMAIL_EVENTS,
	].indexOf(eventType) != -1){
		restaurantUserList = await users.find({
			$or : [
				{_id : new ObjectId(userId),},
				{
					restaurant_id : new ObjectId(options.restaurant_id),
					user_role_id :Constants.RESTAURANT,
					user_type : Constants.USER_TYPE_RESTAURANT
				}
			],
			is_deleted : Constants.NOT_DELETED,
		},{projection:{_id:1,email:1,full_name:1,user_role_id:1}}).toArray();
	}

	/** Send a mail to user according to event type */
	switch(eventType){
		case Constants.CORPORATE_REGISTRATION_EVENT:
			if(options.customer_fullname && options.customer_email && options.customer_password && options.customer_mobile){
				/**** Send add customer user email ****/
				sendMail(req,res,{
					to 			: 	options.customer_email,
					action 		: 	"corporate_registration_mail",
					rep_array	:	[options.customer_fullname,options.customer_email,options.customer_mobile,options.customer_password]
				});
			}
		break;
		case Constants.PACKAGE_PURCHASE_MAIL:
			if(options.email && options.rep_array){
				/**** Send add customer user email ****/
				sendMail(req,res,{
					to 			: 	options.email,
					action 		: 	"package_purchase_mail",
					rep_array	:	options.rep_array
				});
			}
		break;
		case Constants.PACKAGE_ACCEPT_MAIL:
			if(options.email && options.rep_array){
				/**** Send add customer user email ****/
				sendMail(req,res,{
					to 			: 	options.email,
					action 		: 	"package_accept_mail",
					rep_array	:	options.rep_array
				});
			}
		break;
		case Constants.ORDER_STATUS_MODIFIED_EVENT:
			/** Notification to user on placing order */
			insertNotifications(req,res,{
				notification_data : {
					notification_type 	: NotificationType,
					message_params 		: [orderUniqueId],
					parent_table_id 	: orderId,
					user_id 			: userId,
					user_role_id 		: userRoleId,
					user_ids 			: [receiverId],
					role_id 			: Constants.CUSTOMER
				}
			}).then(()=>{});

			/** Notification to admin or restaurant on placing order */
			insertNotifications(req,res,{
				notification_data : {
					notification_type  : NotificationType,
					message_params 	   : [orderUniqueId],
					parent_table_id    : orderId,
					user_id 		   : userId,
					user_role_id 	   : userRoleId,
					...(isAdmin ?
							{
								only_for_user_role : true,
								role_id : Constants.CALL_CENTER_TEAM,
							}
						:
							{
								only_for_user_role : true,
								is_restaurant_notification : true,
								restaurant_id : options.restaurant_id,
								role_id : Constants.RESTAURANT,
							}
					)
				}
			}).then(()=>{});

		break;
		case Constants.ORDER_STATUS_DRIVER_ACCEPTED_EVENT:
			/** Notification to restaurant on accepting order by driver */
			insertNotifications(req,res,{
				notification_data : {
					notification_type  : NotificationType,
					message_params 	   : [orderUniqueId],
					parent_table_id    : orderId,
					order_id		   : orderId,
					user_id 		   : userId,
					user_role_id 	   : userRoleId,
					restaurant_id      : options.restaurant_id,
					role_id            : Constants.RESTAURANT,
					is_restaurant_notification:	true,
					only_for_user_role : true,
				}
			}).then(()=>{});

		break;
		case Constants.ORDER_STATUS_DRIVER_ASSIGNED_EVENT:
			/** Notification to driver on assigning order */
			insertNotifications(req,res,{
				notification_data : {
					notification_type  : NotificationType,
					message_params 	   : [orderUniqueId],
					parent_table_id    : orderId,
					order_id    	   : orderId,
					user_id 		   : userId,
					user_role_id 	   : userRoleId,
					user_ids      	   : [receiverId],
					role_id            : Constants.DRIVER,
				}
			}).then(()=>{});

		break;
		case Constants.ORDER_STATUS_REJECTED_EVENT:
		case Constants.ORDER_STATUS_PENDING_EVENT:

			/** Notification to restaurant on placing order */
			insertNotifications(req,res,{
				notification_data : {
					notification_type : NotificationType,
					message_params : [orderUniqueId],
					parent_table_id : orderId,
					user_id : userId,
					user_role_id : userRoleId,
					...(notificationCallCenter ?
							{
								only_for_user_role : true,
								role_id : Constants.CALL_CENTER_TEAM,
							}
						:
							{
								only_for_user_role : true,
								is_restaurant_notification : true,
								restaurant_id : options.restaurant_id,
								role_id : Constants.RESTAURANT,
							}
					)
				}
			}).then(()=>{});

			/** Notification to customer on order rejected */
			if(Constants.ORDER_STATUS_REJECTED_EVENT && isAdmin){
				insertNotifications(req,res,{
					notification_data : {
						notification_type : NotificationType,
						message_params 	  : [orderUniqueId],
						parent_table_id   : orderId,
						user_id 		  : userId,
						user_role_id 	  : userRoleId,
						user_ids 		  : [receiverId],
						role_id 		  : Constants.CUSTOMER
					}
				}).then(()=>{});
			}

			if(options.order_status == Constants.ORDER_REJECTED_BY_ADMIN){
				insertNotifications(req,res,{
					notification_data : {
						notification_type : NotificationType,
						message_params 	  : [orderUniqueId],
						parent_table_id   : orderId,
						user_id 		  : userId,
						user_role_id 	  : userRoleId,
						user_ids 		  : [receiverId],
						role_id 		  : Constants.CUSTOMER
					}
				}).then(()=>{});
			}
		break;
		case Constants.ORDER_STATUS_CONFIRMED_EVENT:

			/** Notification to restaurant on accepting order */
			insertNotifications(req,res,{
				notification_data : {
					notification_type : NotificationType,
					message_params : [orderUniqueId],
					parent_table_id : orderId,
					user_id : userId,
					user_role_id : userRoleId,
					restaurant_id : options.restaurant_id,
					role_id : Constants.RESTAURANT,
					only_for_user_role: true,
					is_restaurant_notification : true,
				}
			}).then(()=>{});
		break;
		case Constants.ORDER_STATUS_READY_TO_PICK_UP_EVENT:

			/** Notification to driver on order ready to pick up */
			if(orderDetails?.captain_id){
				insertNotifications(req,res,{
					notification_data : {
						notification_type : Constants.NOTIFICATION_TO_DRIVER_ORDER_READY_TO_PICK_UP,
						message_params : [orderUniqueId],
						parent_table_id : orderId,
						user_id : userId,
						user_role_id : userRoleId,
						user_ids : [orderDetails?.captain_id],
						role_id : Constants.DRIVER,
						order_id : orderId
					}
				}).then(()=>{});
			}

			/** Notification to customer on order status update */
			insertNotifications(req,res,{
				notification_data : {
					notification_type : NotificationType,
					message_params : [orderUniqueId],
					parent_table_id : orderId,
					user_id : userId,
					user_role_id : userRoleId,
					user_ids : [receiverId],
					role_id : Constants.CUSTOMER
				}
			}).then(()=>{});
		break;
		case Constants.ORDER_STATUS_PREPARING_EVENT:
		case Constants.ORDER_STATUS_DRIVER_WAY_TO_CUSTOMER_EVENT:
		case Constants.ORDER_STATUS_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION_EVENT:
		case Constants.ORDER_STATUS_ON_THE_WAY_EVENT:

			/** Notification to customer on order status update */
			if(userDetails){
				insertNotifications(req,res,{
					notification_data : {
						notification_type : NotificationType,
						message_params : [orderUniqueId],
						parent_table_id : orderId,
						order_id : orderId,
						user_id : userId,
						user_role_id : userRoleId,
						user_ids : [receiverId],
						role_id : Constants.CUSTOMER
					}
				}).then(()=>{});
			}
		break;
		case Constants.ORDER_STATUS_CANCELLED_EVENT:
			/** Notification to driver on order cancelled */
			if(orderDetails?.captain_id){
				insertNotifications(req,res,{
					notification_data : {
						notification_type : Constants.NOTIFICATION_ORDER_CANCELLED_TO_DRIVER,
						message_params : [orderUniqueId],
						parent_table_id : orderId,
						order_id : orderId,
						user_id : userId,
						user_role_id : userRoleId,
						user_ids : [orderDetails?.captain_id],
						role_id : Constants.DRIVER
					}
				}).then(()=>{});
			}

			/** Notification to customer on order status update */
			if(userDetails){
				insertNotifications(req,res,{
					notification_data : {
						notification_type : NotificationType,
						message_params : [orderUniqueId],
						parent_table_id : orderId,
						user_id : userId,
						user_role_id : userRoleId,
						user_ids : [receiverId],
						role_id : Constants.CUSTOMER
					}
				}).then(()=>{});
			}
		break;
		case Constants.ORDER_STATUS_DELIVERED_EVENT:
			asyncParallel({
				order_data : (callback)=>{
					/** Get captain assigned to order to notify captain in case of order is delivered */
					orders.aggregate([
						{$match :  {_id : 	new ObjectId(orderId) }},
						{$lookup:	{
							"from" 			: 	Tables.USERS,
							"localField" 	:	"captain_id",
							"foreignField" 	: 	"_id",
							"as" 			: 	"captain_detail"
						}},
						{$lookup:	{
							from     : Tables.ORDER_STATUS_LOGS,
							let      : {orderId : "$_id"},
							pipeline : [
								{$match : {
									$expr: {
										$and : [
											{$eq: ["$order_id", "$$orderId"]},
											{$eq: ["$status",Constants.ORDER_DELIVERED]},
										]
									}
								}},
							],
							as:	"logs_detail"
						}},
						{$lookup:	{
							"from" 			: 	Tables.RESTAURANT_BRANCHES,
							"localField" 	:	"branch_id",
							"foreignField" 	: 	"_id",
							"as" 			: 	"branch_detail"
						}},
						{$project :	{
							captain_id:1,unique_order_id:1,order_date:1,restaurant_name:1,
							captain_name: {$arrayElemAt: ["$captain_detail.full_name",0]},
							captain_email: {$arrayElemAt: ["$captain_detail.email",0]},
							delivered_at: {$arrayElemAt: ["$logs_detail.created",0]},
							branch_name: {$arrayElemAt: ["$branch_detail.name",0]},
							branch_address: {$arrayElemAt: ["$branch_detail.address",0]}
						}}
					]).toArray().then(orderResult=>{
						callback(null,orderResult?.[0] || null);
					}).catch(err=>{
						callback(null, err);
					});
				},
				order_details : (callback)=>{
					order_details.findOne({
						order_id : 	new ObjectId(orderId),
					},{projection:{restaurant_address:1,customer_address:1,discount_price:1,net_amount:1,total_amount:1,additional_tax:1,delivery_fee:1}}).then(detailResult=>{
						callback(null, detailResult);
					}).catch(err=>{
						callback(null, err);
					});
				},
				customer_data : (callback)=>{
					users.findOne({_id : new ObjectId(receiverId)},{projection:{full_name:1,email:1,_id:1}}).then(userResult=>{
						callback(null, userResult);
					}).catch(err=>{
						callback(null, err);
					});
				},
				restaurant_user_data : (callback)=>{
					/** Get restaurant data to inform about the order */
					users.aggregate([
						{$match : {
							restaurant_id : new ObjectId(options.restaurant_id),
							user_role_id : Constants.RESTAURANT,
							user_type: Constants.USER_TYPE_RESTAURANT
						}},
						{$lookup:	{
							"from" 			: 	Tables.RESTAURANTS,
							"localField" 	:	"restaurant_id",
							"foreignField" 	: 	"_id",
							"as" 			: 	"rest_detail"
						}},
						{$project:{email:1,_id:1,full_name:1,restaurant_name: {$arrayElemAt: ["$rest_detail.name",0]}}},
					]).toArray().then(restaurantResult=>{
						callback(null,restaurantResult?.[0] || null);
					}).catch(err=>{
						callback(null, err);
					});
				}
			},(err,response)=>{
				/** Send error */
				if(err) return console.error(err);

				let driverId		=	response?.order_data?.captain_id || '';
				let driverMail		=	response?.order_data?.captain_email || '';
				let driverName		=	response?.order_data?.captain_name || '';
				let branchName		=	response?.order_data?.branch_name?.[Constants.DEFAULT_LANGUAGE_CODE] || '';
				let branchAddress	=	response?.order_data?.branch_address || '';
				let customerMail	=	response?.customer_data?.email || '';
				let customerName	=	response?.customer_data?.full_name || '';
				let uniqueOrderId	=	response?.order_data?.unique_order_id || '';
				let orderDate		=	response?.order_data?.order_date && Helper.newDate(response.order_data.order_date,Constants.AM_PM_FORMAT_WITH_DATE) || '';
				let deliveredAt		=	response?.order_data?.delivered_at && Helper.newDate(response.order_data.delivered_at,Constants.AM_PM_FORMAT_WITH_DATE) || '';
				let restaurantAddress=	response?.order_details?.restaurant_address || '';
				let customerAddress	=	response?.order_details?.customer_address || '';
				let netAmount		=	Helper.currencyFormat(response?.order_details?.net_amount || 0);
				let totalAmount		=	Helper.currencyFormat(response?.order_details?.total_amount || 0);
				let discountPrice	=	Helper.currencyFormat(response?.order_details?.discount_price || 0);
				let additionalTax	=	Helper.currencyFormat(response?.order_details?.additional_tax || 0);
				let deliveryFee		=	Helper.currencyFormat(response?.order_details?.delivery_fee || 0);
				let restaurantMail	=	response?.restaurant_user_data?.email ||'';
				let restaurantUserName=	response?.restaurant_user_data?.full_name ||  '';
				let restaurantName	=	response?.restaurant_user_data?.restaurant_name?.[Constants.DEFAULT_LANGUAGE_CODE] || '';

				/** Notification to customer on order status update */
				insertNotifications(req,res,{
					notification_data : {
						notification_type : NotificationType,
						message_params : [orderUniqueId],
						parent_table_id : orderId,
						user_id : userId,
						user_role_id : userRoleId,
						user_ids : [receiverId],
						role_id : Constants.CUSTOMER
					}
				}).then(()=>{});

				if(customerMail) sendMail(req,res,{
					to 			: customerMail,
					action 		: "customer_delivered_mail",
					rep_array 	: [customerName,uniqueOrderId,orderDate,customerAddress,restaurantName,restaurantAddress,netAmount,deliveryFee,additionalTax,discountPrice,totalAmount]
				});

				/** Notification to admin */
				insertNotifications(req,res,{
					notification_data : {
						notification_type : NotificationType,
						message_params : [orderUniqueId],
						parent_table_id : orderId,
						user_id : userId,
						user_role_id : userRoleId,
						only_for_user_role : true,
						role_id : Constants.CRAVEZ,
					}
				}).then(()=>{});

				/** Notification to restaurant on delivering order by driver */
				insertNotifications(req,res,{
					notification_data : {
						notification_type  : NotificationType,
						message_params 	   : [orderUniqueId],
						parent_table_id    : orderId,
						user_id 		   : userId,
						user_role_id 	   : userRoleId,
						restaurant_id      : options.restaurant_id,
						role_id            : Constants.RESTAURANT,
						is_restaurant_notification:	true,
						only_for_user_role : true,
					}
				}).then(()=>{});

				/**Send email function */
				if(restaurantMail) sendMail(req,res,{
					to 			: restaurantMail,
					action 		: "restaurant_delivered_mail",
					rep_array 	: [restaurantUserName,uniqueOrderId,orderDate,deliveredAt,customerName,customerAddress,branchName,branchAddress,netAmount,deliveryFee,additionalTax,discountPrice,totalAmount]
				});

				if(driverId){
					/** Notification to driver on delivering */
					insertNotifications(req,res,{
						notification_data : {
							notification_type : NotificationType,
							message_params : [orderUniqueId],
							parent_table_id : orderId,
							user_id : userId,
							user_role_id : userRoleId,
							user_ids : [driverId],
							role_id : Constants.DRIVER
						}
					}).then(()=>{});

					/**Send email function */
					if(driverMail) sendMail(req,res,{
						to 			: driverMail,
						action 		: "driver_delivered_mail",
						rep_array 	: [driverName,uniqueOrderId,restaurantName,customerName,restaurantAddress,customerAddress,totalAmount]
					});
				}
			});
		break;
		case Constants.ORDER_STATUS_PROBLEMATIC_EVENT:

			/** Notification to customer on order marked problematic */
			if(orderDetails?._id){
				insertNotifications(req,res,{
					notification_data : {
						notification_type 	: NotificationType,
						message_params 		: [orderDetails?.unique_order_id],
						parent_table_id 	: orderId,
						user_id 			: userId,
						user_role_id 		: userRoleId,
						user_ids 			: [receiverId],
						role_id 			: Constants.CUSTOMER
					}
				}).then(()=>{});
			}
		break;
		case Constants.USER_REGISTRATION_EMAIL_EVENTS:

			/** Notification to admin on registration */
			if(adminUserDetails?._id && userDetails?._id){
				insertNotifications(req,res,{
					notification_data : {
						notification_type : Constants.NOTIFICATION_USER_REGISTER,
						message_params : [userDetails?.full_name || ""],
						parent_table_id : userDetails._id,
						user_id : userDetails._id,
						user_role_id : Constants.FRONT_USER_ROLE_ID,
						user_ids : [adminUserDetails?._id],
						role_id : Constants.CRAVEZ,
						extra_parameters : {
							user_id : userDetails?._id || ""
						}
					}
				}).then(()=>{});
			}
			/*************** Send approval request to admin  ***************/
		break;
		case Constants.BRANCH_ENQUIRY_REJECT_EMAIL_EVENTS:

			let tmpBranchId	= options?.branch_id || "";
			tmp_restaurant_branches.aggregate([
				{$match :  {branch_id : new ObjectId(tmpBranchId) }},
				{$lookup:	{
					"from" 			: 	Tables.RESTAURANTS,
					"localField" 	:	"restaurant_id",
					"foreignField" 	: 	"_id",
					"as" 			: 	"restaurant_detail"
				}},
				{$project :	{
					_id:1,user_id:1,restaurant_id:1,branch_number:1,rejection_reason:1,name:1,
					restaurant_name: {$arrayElemAt: ["$restaurant_detail.default_name",0]}
				}}
			]).toArray().then(result=>{
				if(result && result[0]){
					result				=	result[0];
					let userDataId 	 	= 	result?.user_id ? new ObjectId(result.user_id) : "";
					let restaurantId 	= 	result?.restaurant_id ? new ObjectId(result.restaurant_id) : "";
					let branchNumber 	= 	result?.branch_number || "";
					let rejectionReason	= 	result?.rejection_reason || "";
					let restaurantName	=	result?.restaurant_name || "";
					let branchName 		= 	result?.name?.[Constants.DEFAULT_LANGUAGE_CODE] || "";

					/**get details form users */
					let userFindConditions = {
						$or : [
							{_id : userDataId},
							{
								restaurant_id : restaurantId,
								user_role_id :Constants.RESTAURANT,
								user_type : Constants.USER_TYPE_RESTAURANT
							}
						],
						is_deleted : Constants.NOT_DELETED,
					};
					users.find(userFindConditions,{projection:{_id:1,email:1,full_name:1,user_role_id:1}}).toArray().then(userResult=>{

						if(userResult && userResult.length > 0){
							userResult.forEach(userData =>{
								/**Set variable for send email */
								let userEmail  = userData?.email || "";
								let fullName   = userData?.full_name || "";

								/**Send email function */
								if(userEmail) sendMail(req,res,{
									to 			: userEmail,
									action 		: "restaurant_pending_branch_enquiry_rejected",
									rep_array 	: [fullName,branchName,rejectionReason]
								});

								/*************** Send notification  ***************/
									let statusTitle = Constants.STATUS_LABELS?.[Constants.REJECTED]?.status_name?.toLowerCase() || "";
									insertNotifications(req,res,{
										notification_data : {
											notification_type 	: 	Constants.NOTIFICATION_BRANCH_APPROVAL_REQUEST_STATUS_UPDATE,
											message_params 		: 	[branchName,branchNumber,restaurantName,statusTitle],
											parent_table_id 	: 	tmpBranchId,
											user_ids 			: 	[userData._id],
											role_id 			: 	userData.user_role_id,
											extra_parameters 	:	{
												user_id : userData._id
											}
										}
									}).then(()=>{ });
								/*************** Send notification  ***************/
							});
						}
					}).catch(err=>{
						console.error("get user details in sendMailToUsers error ===>",eventType, err);
					});
				}
			}).catch(err=>{
				console.error("get branch enquiry reject email details in sendMailToUsers error ===>",eventType, err);
			});
		break;
		case Constants.RESTAURANT_ENQUIRY_REJECT_EMAIL_EVENTS:
			let restaurantEnquiryId	= options?.enquiry_id || "";
			restaurant_enquiries.findOne({_id : new ObjectId(restaurantEnquiryId)},{projection :{_id :1,email:1,name:1,rejection_msg:1,contact_person_name:1}}).then(enquiryData=>{
				if(enquiryData){
					let reason 	 = enquiryData?.rejection_msg || "";
					let email	 = enquiryData?.email || "";
					let fullName = enquiryData?.contact_person_name || "";

					/**Send email function */
					if(email) sendMail(req,res,{
						to 			: email,
						action 		: "restaurant_enquiry_rejected",
						rep_array 	: [fullName,reason]
					});
				}
			}).catch(err=>{
				console.error("get restaurant enquiry reject email details in sendMailToUsers error ===>",eventType, err);
			});
		break;
		case Constants.RESTAURANT_ENQUIRY_APPROVE_EMAIL_EVENTS:

			let restaurantId	= options?.restaurant_id || "";
			let password		= options?.password || "";
			restaurant_details.findOne({restaurant_id : new ObjectId(restaurantId)},{projection :{_id :1,email:1,account_manager:1}}).then(result=>{
				if(result){
					let email	 		= result?.email || "";
					let accountManager	= result?.account_manager || "";

					/**Send email function */
					if(email) sendMail(req,res,{
						to 			: email,
						action 		: "restaurant_enquiry_approved",
						rep_array 	:[accountManager,email,password]
					});
				}
			}).catch(err=>{
				console.error("get restaurant enquiry approve email details in sendMailToUsers error ===>",eventType, err);
			});
		break;
		case Constants.TEAM_BREAK_APPROVE_REJECT_EMAIL_EVENTS:

			if(userDetails?._id){
				let fullName	= userDetails?.full_name || '';
				let email		= userDetails?.email || '';
				let breakDetail	= options?.break_details || {};
				let startTime	= breakDetail?.start_time ||"";
				let endTime		= breakDetail?.end_time ||"";
				let action		= options?.action_taken ||"";
				let reason		= breakDetail?.rejection_reason ||"";
				let breakDate	= breakDetail?.date && Helper.newDate(breakDetail.date,Constants.DATE_FORMAT_EMAIL) || "";
				let emailAction	= (action == Constants.APPROVED) ? "break_approved" : "break_rejected";
				let repArray	= (action == Constants.APPROVED) ? [fullName,breakDate,startTime,endTime] : [fullName,breakDate,startTime,endTime,reason];

				/**Send email function */
				if(email) sendMail(req,res,{
					to 			: email,
					action 		: emailAction,
					rep_array 	: repArray
				});

				/*************** Send notification ***************/
				insertNotifications(req,res,{
					notification_data : {
						notification_type 	: Constants.NOTIFICATION_TEAM_BREAK_APPROVE_REJECT,
						message_params 		: [Constants.TEAM_BREAK_STATUS?.[action]?.status_name?.toLowerCase() || ""],
						parent_table_id 	: options.break_id,
						user_ids 			: [userDetails._id],
						role_id 			: userDetails.user_role_id,
						extra_parameters 	: {
							parent_id : userDetails.parent_id && new ObjectId(userDetails.parent_id) || ""
						}
					}
				}).then(()=>{ });
				/*************** Send notification  ***************/
			}
		break;
		case Constants.TEAM_BREAK_REQUEST_POSTED_EMAIL_EVENTS:

			if(userDetails?._id){
				let fullName = userDetails?.full_name || '';
				let email = userDetails?.email || '';
				let memberName = memberDetails?.full_name || '';
				let breakDetail = options?.break_details || {};
				let startTime = breakDetail?.start_time || "";
				let endTime = breakDetail?.end_time || "";
				let breakDate = breakDetail?.date	&& Helper.newDate(breakDetail.date,Constants.DATE_FORMAT_EMAIL) || "";

				/**Send email function */
				if(email) sendMail(req,res, {
					to 			: email,
					action 		: "break_request_posted",
					rep_array 	: [fullName,memberName,breakDate,startTime,endTime]
				});

				if(memberDetails?._id){
					/*************** Send notification  ***************/
					insertNotifications(req,res,{
						notification_data : {
							notification_type 	: Constants.NOTIFICATION_TEAM_BREAK_REQUEST_POST,
							message_params 		: [memberName],
							parent_table_id 	: options.break_id,
							user_ids 			: [userDetails._id],
							role_id 			: userDetails.user_role_id,
							extra_parameters 	: {
								member_id : new ObjectId(memberDetails._id)
							}
						}
					}).then(()=>{ });
				}
			}
		break;
		case Constants.RESTAURANT_ENQUIRY_REQUEST_EMAIL_EVENTS:
			if(options.enquiry_id && options.email_address && options.restaurant_name && options.contact_person_name){
				/** Notification to admin for restaurant enquiry */
					insertNotifications(req,res,{
						notification_data : {
							notification_type:	Constants.NOTIFICATION_RESTAURANT_ENQUIRY_REQUEST,
							message_params 	:	[options.restaurant_name],
							parent_table_id : 	options.enquiry_id,
							user_role_id 	: 	Constants.CRAVEZ,
							role_id 		: 	[Constants.CRAVEZ,Constants.SALES_TEAM,Constants.MARKETING_TEAM],
							only_for_user_role:	true,
							extra_parameters: 	{
								enquiry_id 	: options.enquiry_id
							}
						}
					}).then(()=>{});
				/*************** Send approval request to admin  ***************/

				/*** Send email function **/
					if(options.email_address) sendMail(req,res,{
						to 			: options.email_address,
						action 		: "restaurant_enquiry_request",
						rep_array 	: [options.contact_person_name]
					});
			}
		break;
		case Constants.RESTAURANT_CATEGORY_REJECT_EMAIL_EVENTS:

			if(options.category_id && options.category_name && options.restaurant_id && options.reject_msg && options.user_id){
				if(restaurantDetails?._id && restaurantUserList?.length >0){
					let restaurantName = restaurantDetails?.default_name || "";
					restaurantUserList.forEach(userData =>{
						let userEmail  = userData?.email || "";
						let fullName   = userData?.full_name || "";

						/**Send email function */
						if(userEmail) sendMail(req,res,{
							to 			: userEmail,
							action 		: "restaurant_pending_category_rejected",
							rep_array 	: [fullName,options.category_name,options.reject_msg]
						});

						/*************** Send notification  ***************/
							let statusTitle = Constants.STATUS_LABELS?.[Constants.REJECTED]?.status_name?.toLowerCase() || "";
							insertNotifications(req,res,{
								notification_data : {
									notification_type 	: 	Constants.NOTIFICATION_RESTAURANT_CATEGORY_APPROVAL_REQUEST_STATUS_UPDATE,
									message_params 		: 	[options.category_name,restaurantName,statusTitle],
									parent_table_id 	: 	options.category_id,
									user_ids 			: 	[userData._id],
									role_id 			: 	userData.user_role_id,
									extra_parameters 	:	{
										user_id : userData._id
									}
								}
							}).then(()=>{ });
						/*************** Send notification  ***************/
					});
				}
			}
		break;
		case Constants.RESTAURANT_CATEGORY_APPROVE_EMAIL_EVENTS:
			if(options.category_id && options.category_name && options.restaurant_id && options.user_id){

				if(restaurantDetails && restaurantUserList?.length >0){

					let restaurantName = restaurantDetails?.default_name || "";
					restaurantUserList.forEach(userData =>{
						let userEmail  = userData?.email || "";
						let fullName   = userData?.full_name || "";

						/**Send email function */
						if(userEmail) sendMail(req,res,{
							to 			: userEmail,
							action 		: "restaurant_pending_category_approved",
							rep_array 	: [fullName,options.category_name]
						});

						/*************** Send notification  ***************/
							let statusTitle = Constants.STATUS_LABELS[Constants.APPROVED].status_name.toLowerCase();
							insertNotifications(req,res,{
								notification_data : {
									notification_type 	: 	Constants.NOTIFICATION_RESTAURANT_CATEGORY_APPROVAL_REQUEST_STATUS_UPDATE,
									message_params 		: 	[options.category_name,restaurantName,statusTitle],
									parent_table_id 	: 	options.category_id,
									user_ids 			: 	[userData._id],
									role_id 			: 	userData.user_role_id,
									extra_parameters 	:	{
										user_id : userData._id
									}
								}
							}).then(()=>{});
						/*************** Send notification  ***************/
					});
				}
			}
		break;
		case Constants.RESTAURANT_MENU_REJECT_EMAIL_EVENTS:
			if(options.menu_id && options.menu_name && options.restaurant_id && options.reject_msg && options.user_id){

				if(restaurantDetails && restaurantUserList?.length >0){

					let restaurantName = restaurantDetails?.default_name || "";
					restaurantUserList.forEach(userData =>{
						let userEmail  = userData?.email || "";
						let fullName   = userData?.full_name || "";

						/**Send email function */
						if(userEmail) sendMail(req,res,{
							to 			: userEmail,
							action 		: "restaurant_menu_reject",
							rep_array 	: [fullName,options.menu_name,options.reject_msg]
						});

						/*************** Send notification  ***************/
							let statusTitle = Constants.STATUS_LABELS[Constants.REJECTED].status_name.toLowerCase();
							insertNotifications(req,res,{
								notification_data : {
									notification_type 	: 	Constants.NOTIFICATION_RESTAURANT_MENU_APPROVAL_REQUEST_STATUS_UPDATE,
									message_params 		: 	[options.menu_name,restaurantName,statusTitle],
									parent_table_id 	: 	options.menu_id,
									user_ids 			: 	[userData._id],
									role_id 			: 	userData.user_role_id,
									extra_parameters 	:	{
										user_id : userData._id
									}
								}
							}).then(()=>{ });
						/*************** Send notification  ***************/
					});
				}
			}
		break;
		case Constants.RESTAURANT_MENU_APPROVE_EMAIL_EVENTS:
			if(options.menu_id && options.menu_name && options.restaurant_id && options.user_id){

				if(restaurantDetails && restaurantUserList?.length >0){
					let restaurantName = restaurantDetails?.default_name || "";
					restaurantUserList.forEach(userData =>{
						let userEmail  = userData?.email || "";
						let fullName   = userData?.full_name || "";

						/**Send email function */
						if(userEmail) sendMail(req,res,{
							to 			: userEmail,
							action 		: "restaurant_menu_approve",
							rep_array 	: [fullName,options.menu_name]
						});

						/*************** Send notification  ***************/
							let statusTitle = Constants.STATUS_LABELS[Constants.APPROVED].status_name.toLowerCase();
							insertNotifications(req,res,{
								notification_data : {
									notification_type 	: 	Constants.NOTIFICATION_RESTAURANT_MENU_APPROVAL_REQUEST_STATUS_UPDATE,
									message_params 		: 	[options.menu_name,restaurantName,statusTitle],
									parent_table_id 	: 	options.menu_id,
									user_ids 			: 	[userData._id],
									role_id 			: 	userData.user_role_id,
									extra_parameters 	:	{
										user_id : userData._id
									}
								}
							}).then(()=>{});
						/*************** Send notification  ***************/
					});
				}
			}
		break;
		case Constants.RESTAURANT_REGISTRATION_EMAIL_EVENTS:
			if(options.restaurant_id && options.restaurant_name && options.restaurant_email && options.password){

				/**** Send add restaurant user email ****/
					sendMail(req,res,{
						to 			: 	options.restaurant_email,
						action 		: 	"add_restaurant_user",
						rep_array	:	[options.restaurant_name,options.restaurant_email,options.password,Constants.WEBSITE_URL]
					});
				/**** Send add restaurant user email ****/
			}
		break;
		case Constants.NOTIFICATION_OVERTIME_REQUEST:
			if(options.parent_table_id && options.tl_fullname && options.user_id){
				if(userDetails?._id){
					/*************** Send notification  ***************/
					insertNotifications(req,res,{
						notification_data : {
							notification_type 	: 	Constants.NOTIFICATION_OVERTIME_REQUEST,
							message_params 		: 	[options?.tl_fullname || ""],
							parent_table_id 	: 	options.parent_table_id,
							user_ids 			: 	[userDetails._id],
							role_id 			: 	userDetails.user_role_id,
						}
					}).then(()=>{ });
					/*************** Send notification  ***************/
				}
			}
		break;
		case Constants.NOTIFICATION_CAPTAIN_OVERTIME_REQUEST:
			if(options.parent_table_id && options.tl_fullname && options.user_id && userDetails?._id){
				let tlFullName 		= options?.tl_fullname|| "";
				let hours 			= options?.hours || "";
				let requestDate 	= options?.request_date && Helper.newDate(options.request_date,Constants.DATE_FORMAT_EMAIL) ||"";

				if(hours && requestDate){
					/*************** Send notification  ***************/
					insertNotifications(req,res,{
						notification_data : {
							notification_type 	: 	Constants.NOTIFICATION_CAPTAIN_OVERTIME_REQUEST,
							message_params 		: 	[tlFullName,hours,requestDate],
							parent_table_id 	: 	options.parent_table_id,
							user_ids 			: 	[asyncResponse.user_details._id],
							role_id 			: 	asyncResponse.user_details.user_role_id,
						}
					}).then(()=>{ });
					/*************** Send notification  ***************/
				}
			}
		break;
		case Constants.NOTIFICATION_DRIVER_REGISTER:
			if(options.driver_fullname && options.driver_email && options.driver_password){

				let androidApp	= res?.locals?.settings?.['App.driver_android_app_link'] || "";
				let iosApp		= res?.locals?.settings?.['App.driver_ios_app_link'] || "";
				/**** Send add driver user email ****/
					sendMail(req,res,{
						to 			: 	options.driver_email,
						action 		: 	"add_driver",
						rep_array	:	[options.driver_fullname,options.driver_email,options.driver_password,androidApp,iosApp]
					});
				/**** Send add driver user email ****/
			}
		break;
		case Constants.NOTIFICATION_CUSTOMER_REGISTER:
			if(options.customer_fullname && options.customer_email && options.customer_password){
				let androidApp	= res?.locals?.settings?.['App.customer_android_app_link'] || "";
				let iosApp		= res?.locals?.settings?.['App.customer_ios_app_link'] || "";

				/**** Send add customer user email ****/
					sendMail(req,res,{
						to 			: 	options.customer_email,
						action 		: 	"add_customer",
						rep_array	:	[options.customer_fullname,options.customer_email,options.customer_password,androidApp,iosApp]
					});
				/**** Send add customer user email ****/
			}
		break;
		case Constants.NOTIFICATION_ADMIN_USER_REGISTER:
			if(options.fullname && options.email && options.password){
				/**** Send add customer user email ****/
					sendMail(req,res,{
						to 			: 	options.email,
						action 		: 	"add_user",
						rep_array	:	[options.fullname,options.email,options.password,Constants.WEBSITE_ADMIN_URL]
					});
				/**** Send add customer user email ****/
			}
		break;
		case Constants.NOTIFICATION_SEND_LOGIN_CREDENTIALS:
			if(options.fullname && options.email && options.password){

				/**** Send add customer user email ****/
					sendMail(req,res,{
						to 			: 	options.email,
						action 		: 	"send_login_credentials",
						rep_array	:	[options.fullname,options.email,options.password,Constants.WEBSITE_ADMIN_URL]
					});
				/**** Send add customer user email ****/
			}
		break;
		case Constants.NOTIFICATION_VACATION_REQUEST:
			if(options.parent_table_id && options.tl_fullname && options.user_id && userDetails?._id){

				/*************** Send notification  ***************/
				insertNotifications(req,res,{
					notification_data : {
						notification_type 	: 	Constants.NOTIFICATION_VACATION_REQUEST,
						message_params 		: 	[options?.tl_fullname || ""],
						parent_table_id 	: 	options.parent_table_id,
						user_ids 			: 	[userDetails._id],
						role_id 			: 	userDetails.user_role_id,
					}
				}).then(()=>{ });
			}
		break;
		case Constants.NOTIFICATION_WEEKLY_REQUEST:
			if(options.parent_table_id && options.tl_fullname && options.user_id && userDetails?._id){

				/*************** Send notification  ***************/
				insertNotifications(req,res,{
					notification_data : {
						notification_type 	: 	Constants.NOTIFICATION_WEEKLY_REQUEST,
						message_params 		: 	[options?.tl_fullname || ""],
						parent_table_id 	: 	options.parent_table_id,
						user_ids 			: 	[userDetails._id],
						role_id 			: 	userDetails.user_role_id,
					}
				}).then(()=>{ });
			}
		break;
		case Constants.NOTIFICATION_FRONT_CUSTOMER_REGISTER:
			if(options.full_name && options.email && options.validate_string && options.mobile_number && options.otp){

				/**** Send add customer user email ****/
					let verifyLink	=	Constants.WEBSITE_HOST_URL+"verify_email/"+options.validate_string;
					sendMail(req,res,{
						to 			: 	options.email,
						action 		: 	"add_front_customer",
						rep_array	:	[options.full_name,verifyLink]
					});
				/**** Send add customer user email ****/

				/*************** SEND OTP ON USER MOBILE NUMBER  ***************/
					sendSMS(req,res,{
						sms_type        :   Constants.SMS_TEMPLATE_FOR_USER_REGISTRATION,
						user_id         :   options.user_id,
						mobile_number   :   options.mobile_number,
						message_params  :   [options.otp],
					}).then(()=>{});
			}
		break;
		case Constants.NOTIFICATION_FRONT_DRIVER_REGISTER:
			if(options.full_name && options.email && options.validate_string && options.mobile_number && options.otp){

				/**** Send add customer user email ****/
					let verifyLink	=	Constants.WEBSITE_URL+"verify_email/"+options.validate_string;
					sendMail(req,res,{
						to 			: 	options.email,
						action 		: 	"add_front_driver",
						rep_array	:	[options.full_name,verifyLink]
					});
				/**** Send add customer user email ****/

				/*************** SEND OTP ON USER MOBILE NUMBER  ***************/
					sendSMS(req,res,{
						sms_type        :   Constants.SMS_TEMPLATE_FOR_USER_REGISTRATION,
						user_id         :   options.user_id,
						mobile_number   :   options.mobile_number,
						message_params  :   [options.otp],
					}).then(()=>{});
				/*************** SEND OTP ON USER MOBILE NUMBER  ***************/
			}
		break;
		case Constants.RESEND_CUSTOMER_DRIVER_EMAIL_EVENTS:
			if(options.email && options.validate_string && options.full_name){
				/*************** Send Email   ***************/
				let link = Constants.WEBSITE_URL+"verify_email/"+options.validate_string;
				sendMail(req,res,{
					to			: options.email,
					action		: "customer_driver_email_verification",
					rep_array	: [options.full_name,link]
				});
				/*************** Send Email***************/
			}
		break;
		case Constants.CUSTOMER_DRIVER_FORGOT_PASSWORD_EMAIL_EVENTS:
			if(options.email && options.validate_string && options.full_name,options.user_type){
				/*************** Send Email   ***************/
				let link =  Constants.WEBSITE_URL+"reset_password/"+options.validate_string+"/"+options.user_type;
				sendMail(req,res,{
					to			: options.email,
					action		: "customer_driver_forgot_password",
					rep_array	: [options.full_name,link]
				});
				/*************** Send Email***************/
			}
		break;
		case Constants.NOTIFICATION_CUISINE_PRIORITIES_SEND_FOR_APPROVAL:
			if(options.restaurant_id && options.branch_id){
				asyncParallel({
					user_details : (callback)=>{
						users.findOne({restaurant_id : new ObjectId(options.restaurant_id)},{projection:{full_name:1,email:1,_id:1,user_role_id:1}}).then(result=>{
							callback(null, result);
						}).catch(err=>{
							console.error("get user details in sendMailToUsers error ===>",eventType, err);
							callback(err);
						});
					},
					branch_details : (callback)=>{
						restaurant_branches.findOne({_id : new ObjectId(options.branch_id),restaurant_id:new ObjectId(options.restaurant_id)},{projection :{_id:1,name:1}}).then(branchResult=>{
							callback(null,branchResult);
						}).catch(err=>{
							console.error("get branch details in sendMailToUsers error ===>",eventType, err);
							callback(err);
						});
					}
				},(_, asyncResponse)=>{
					if(asyncResponse?.user_details && asyncResponse?.branch_details){
						/*************** Send notification  ***************/
						insertNotifications(req,res,{
							notification_data : {
								notification_type 	: 	Constants.NOTIFICATION_CUISINE_PRIORITIES_SEND_FOR_APPROVAL,
								message_params 		: 	[asyncResponse.branch_details.name.en],
								parent_table_id 	: 	options.branch_id,
								user_ids 			: 	[asyncResponse.user_details._id],
								role_id 			: 	asyncResponse.user_details.user_role_id,
								extra_parameters 	:	{
									restaurant_id : options.restaurant_id,
									branch_id 	  : options.branch_id
								}
							}
						}).then(()=>{ });
						/*************** Send notification  ***************/
					}
				});
			}
		break;
		case Constants.NOTIFICATION_CUISINE_PRIORITIES_REJECTED: restaurantDetails
			if(options.restaurant_id && options.branch_id && restaurantDetails?._id){
				/*************** Send notification  ***************/
				insertNotifications(req,res,{
					notification_data : {
						notification_type 	: 	Constants.NOTIFICATION_CUISINE_PRIORITIES_REJECTED,
						message_params 		: 	[restaurantDetails?.default_name],
						parent_table_id 	: 	options.branch_id,
						user_role_id 		: 	Constants.CRAVEZ,
						role_id 			: 	[Constants.CRAVEZ,Constants.CONTENT_TEAM],
						extra_parameters 	:	{
							restaurant_id : options.restaurant_id,
							branch_id 	  : options.branch_id
						}
					}
				}).then(()=>{ });
				/*************** Send notification  ***************/
			}
		break;
		case Constants.NOTIFICATION_CUISINE_PRIORITIES_APPROVED:
			if(options.restaurant_id && options.branch_id && restaurantDetails?._id){
				/*************** Send notification  ***************/
				insertNotifications(req,res,{
					notification_data : {
						notification_type 	: 	Constants.NOTIFICATION_CUISINE_PRIORITIES_APPROVED,
						message_params 		: 	[restaurantDetails?.default_name],
						parent_table_id 	: 	options.branch_id,
						user_role_id 		: 	Constants.CRAVEZ,
						role_id 			: 	[Constants.CRAVEZ,Constants.CONTENT_TEAM],
						only_for_user_role	:	true,
						extra_parameters 	:	{
							restaurant_id : options.restaurant_id,
							branch_id 	  : options.branch_id
						}
					}
				}).then(()=>{ });
			}
		break;
		case Constants.RESTAURANT_ITEM_APPROVE_EMAIL_EVENTS:
			if(options.item_id && options.item_name && options.restaurant_id && options.user_id && restaurantUserList?.length){

				restaurantUserList.forEach(userData =>{
					let userEmail  = userData?.email || "";
					let fullName   = userData?.full_name || "";

					/**Send email function */
					if(userEmail) sendMail(req,res,{
						to 			: userEmail,
						action 		: "restaurant_item_approve",
						rep_array 	: [fullName,options.item_name]
					});

					/*************** Send notification  ***************/
						let statusTitle = Constants.STATUS_LABELS[Constants.APPROVED].status_name.toLowerCase();
						insertNotifications(req,res,{
							notification_data : {
								notification_type 	: 	Constants.NOTIFICATION_RESTAURANT_ITEM_APPROVAL_REQUEST_STATUS_UPDATE,
								message_params 		: 	[options.item_name,statusTitle],
								parent_table_id 	: 	options.item_id,
								user_ids 			: 	[userData._id],
								role_id 			: 	userData.user_role_id,
								extra_parameters 	:	{
									user_id : userData._id
								}
							}
						}).then(()=>{});
					/*************** Send notification  ***************/
				});
			}
		break;
		case Constants.RESTAURANT_ITEM_REJECT_EMAIL_EVENTS:
			if(options.item_id && options.item_name && options.restaurant_id && options.reject_msg && options.user_id && restaurantUserList?.length){

				restaurantUserList.forEach(userData =>{
					let userEmail  = userData?.email || "";
					let fullName   = userData?.full_name || "";

					/**Send email function */
					if(userEmail) sendMail(req,res,{
						to 			: userEmail,
						action 		: "restaurant_item_reject",
						rep_array 	: [fullName,options.item_name,options.reject_msg]
					});

					/*************** Send notification  ***************/
						let statusTitle = Constants.STATUS_LABELS[Constants.REJECTED].status_name.toLowerCase();
						insertNotifications(req,res,{
							notification_data : {
								notification_type 	: 	Constants.NOTIFICATION_RESTAURANT_ITEM_APPROVAL_REQUEST_STATUS_UPDATE,
								message_params 		: 	[options.item_name,statusTitle],
								parent_table_id 	: 	options.item_id,
								user_ids 			: 	[userData._id],
								role_id 			: 	userData.user_role_id,
								extra_parameters 	:	{
									user_id : userData._id
								}
							}
						}).then(()=>{});
					/*************** Send notification  ***************/
				});
			}
		break;
		case Constants.DRIVER_BREAK_APPROVE_REJECT_EMAIL_EVENTS:
			if(userDetails?._id){
				let fullName = userDetails?.full_name || '';
				let email = userDetails?.email || '';
				let tmpUserRoleId = userDetails?.user_role_id || '';
				let breakDetail = options?.break_details || {};
				let startTime = breakDetail?.start_time || "";
				let endTime = breakDetail?.end_time || "";
				let action = options?.action_taken || "";
				let reason = breakDetail?.rejection_reason || "";
				let breakDate = breakDetail?.date && Helper.newDate(breakDetail.date,Constants.DATE_FORMAT_EMAIL) || "";
				let emailAction = (action == Constants.APPROVED)? "driver_break_approved" : "driver_break_rejected";
				let repArray = (action == Constants.APPROVED) ? [fullName,breakDate,startTime,endTime] : [fullName,breakDate,reason];

				/**Send email function */
				if(email && userDetails.is_email_verified == Constants.VERIFIED){
					sendMail(req,res,{
						to 			: email,
						action 		: emailAction,
						rep_array 	: repArray
					});
				}

				/*************** Send notification ***************/
				if(tmpUserRoleId){
					let statusTitle = Constants.DRIVER_BREAK_STATUS[action].status_name.toLowerCase();
					insertNotifications(req,res,{
						notification_data : {
							notification_type 	: Constants.NOTIFICATION_DRIVER_BREAK_APPROVE_REJECT,
							message_params 		: [statusTitle],
							parent_table_id 	: options.break_id,
							user_ids 			: [userDetails._id],
							role_id 			: tmpUserRoleId,
							extra_parameters 	: {
								parent_id : userDetails.parent_id && new ObjectId(userDetails.parent_id) || ""
							}
						}
					}).then(()=>{ });
				}
			}
		break;
		case Constants.DRIVER_BREAK_REQUEST_POSTED_EMAIL_EVENTS:
			if(userDetails?.id){
				let fullName		= userDetails.full_name;
				let userRoleId		= userDetails.user_role_id;

				/*************** Send notification  ***************/
				insertNotifications(req,res,{
					notification_data : {
						notification_type 	: 	Constants.NOTIFICATION_DRIVER_BREAK_REQUEST_POST,
						message_params 		: 	[fullName],
						parent_table_id 	: 	options.break_id,
						user_id 		    : 	userId,
						user_role_id 		: 	userRoleId,
						role_id 			: 	[Constants.CRAVEZ,Constants.FLEET],
						only_for_user_role	:	true,
						extra_parameters 	:	{}
					}
				}).then(()=>{ });
				/*************** Send notification  ***************/
			}
		break;
		case Constants.DRIVER_BREAK_REQUEST_ENDED_EMAIL_EVENTS:
			if(userDetails?._id){
				let fullName		= userDetails.full_name;
				let userRoleId		= userDetails.user_role_id;

				/*************** Send notification  ***************/
				insertNotifications(req,res,{
					notification_data : {
						notification_type 	: 	Constants.NOTIFICATION_DRIVER_BREAK_ENDED,
						message_params 		: 	[fullName],
						parent_table_id 	: 	options.break_id,
						user_id 		    : 	userId,
						user_role_id 		: 	userRoleId,
						role_id 			: 	[Constants.CRAVEZ,Constants.FLEET],
						only_for_user_role	:	true,
						extra_parameters 	:	{}
					}
				}).then(()=>{ });
				/*************** Send notification  ***************/
			}
		break;
		case Constants.DRIVER_EXCUSES_REQUEST_POSTED_EMAIL_EVENTS:
			if(userDetails?._id){
				let fullName		= userDetails?.full_name || '';
				let email			= userDetails?.email || '';
				let tmpUserRoleId	= userDetails?.user_role_id || '';
				let memberName		= memberDetails?.full_name || '';
				let excuseDetail	= options?.excuses_details || {};
				let startTime		= excuseDetail?.from || "";
				let endTime			= excuseDetail?.to || "";
				let excuseDate		= excuseDetail?.date && Helper.newDate(excuseDetail.date,Constants.DATE_FORMAT_EMAIL) || "";

				/**Send email function */
				if(email  && userDetails.is_email_verified == Constants.VERIFIED){
					sendMail(req,res,{
						to 			: email,
						action 		: "driver_excuse_request_posted",
						rep_array 	: [fullName,memberName,excuseDate,startTime,endTime]
					});
				}

				/*************** Send notification  ***************/
				if(memberDetails._id && tmpUserRoleId){
					insertNotifications(req,res,{
						notification_data : {
							notification_type 	: Constants.NOTIFICATION_EXCUSES_REQUEST_POST,
							message_params 		: [memberName],
							parent_table_id 	: options.excuse_id,
							user_role_id 		: Constants.CRAVEZ,
							role_id 			: [Constants.CRAVEZ,Constants.FLEET],
							only_for_user_role	: true,
							extra_parameters 	: {
								member_id : new ObjectId(memberDetails._id)
							}
						}
					}).then(()=>{ });
				}
				/*************** Send notification  ***************/
			}
		break;
		case Constants.DRIVER_EXCUSE_APPROVE_REJECT_EMAIL_EVENTS:
			if(userDetails?._id){
				let fullName		= 	userDetails?.full_name ||'';
				let email			= 	userDetails?.email ||'';
				let tmpUserRoleId	= 	userDetails?.user_role_id ||'';
				let excuseDetail	= 	options?.excuse_details || {};
				let startTime		= 	excuseDetail?.start_time || "";
				let endTime			= 	excuseDetail?.end_time || "";
				let reason			= 	excuseDetail?.rejection_reason || "";
				let action			= 	options?.action_taken || "";
				let excuseDate		=	excuseDetail?.date && Helper.newDate(excuseDetail.date,Constants.DATE_FORMAT_EMAIL) || "";
				let emailAction		=	(action == "driver_excuse_approved") ? "driver_excuse_approved" : "driver_excuse_rejected";
				let repArray		=	(action == "driver_excuse_approved") ? [fullName,excuseDate,startTime,endTime] : [fullName,excuseDate,startTime,endTime,reason];

				/**Send email function */
				if(email  && userDetails.is_email_verified == Constants.VERIFIED){
					sendMail(req,res,{ to: email, action: emailAction, rep_array: repArray });
				}

				/*************** Send notification ***************/
					if(tmpUserRoleId){
						let statusTitle = (action == "driver_excuse_approved")
							? Constants.DRIVER_EXCUSE_STATUS[Constants.APPROVED].status_name.toLowerCase()
							: Constants.DRIVER_EXCUSE_STATUS[Constants.REJECTED].status_name.toLowerCase();

						insertNotifications(req,res,{
							notification_data : {
								notification_type 	: Constants.NOTIFICATION_DRIVER_EXCUSES_APPROVE_REJECT,
								message_params 		: [statusTitle],
								parent_table_id 	: options.excuse_id,
								user_ids 			: [userDetails._id],
								role_id 			: tmpUserRoleId,
								extra_parameters 	: {
									parent_id : new ObjectId(userDetails.parent_id)
								}
							}
						}).then(()=>{ });
					}
				/*************** Send notification  ***************/
			}
		break;
		case Constants.DRIVER_BREAK_EXCUSE_IMMEDIATELY_CANCELED:
			/*************** Send notification  ***************/
				insertNotifications(req,res,{
					notification_data : {
						notification_type 	: 	Constants.NOTIFICATION_BREAK_EXCUSE_IMMEDIATELY_CANCELED,
						message_params 		: 	[],
						parent_table_id 	: 	userId,
						user_ids 			: 	[userId],
						role_id 			: 	options.user_role_id,
						extra_parameters 	:	{user_id : userId}
					}
				}).then(()=>{});
			/*************** Send notification  ***************/
		break;
		case Constants.ADD_IN_WALLET_EMAIL_EVENTS:
			if(options.wallet_id && options.amount && options.user_list){

				options.user_list.forEach(userData=>{
					let userEmail  = userData?.email || "";
					let fullName   = userData?.full_name || "";

					/**Send email function */
					if(userEmail && userData.is_email_verified == Constants.VERIFIED){
						sendMail(req,res,{
						   to 			: userEmail,
						   action 		: "add_in_wallet",
						   rep_array 	: [fullName,options.amount]
					   });
					}

					/*************** Send notification  ***************/
						insertNotifications(req,res,{
							notification_data : {
								notification_type 	: 	Constants.NOTIFICATION_ADD_IN_WALLET,
								message_params 		: 	[options.amount],
								parent_table_id 	: 	options.wallet_id,
								user_ids 			: 	[userData._id],
								role_id 			: 	userData.user_role_id,
								extra_parameters 	:	{user_id : userData._id}
							}
						}).then(()=>{});
					/*************** Send notification  ***************/
				});
			}
		break;
		case Constants.NOTIFICATION_TRANSFER_BALANCE:
			if(options.transfer_to && options.transfer_balance_id && options.user_role_id && options.amount && options.mobile_number){

				/*************** Send notification  ***************/
					insertNotifications(req,res,{
						notification_data : {
							notification_type 	: 	Constants.NOTIFICATION_TRANSFER_BALANCE,
							message_params 		: 	[options.amount,options.mobile_number],
							parent_table_id 	: 	options.transfer_balance_id,
							user_ids 			: 	[options.transfer_to],
							role_id 			: 	options.user_role_id,
							user_id 			:   userId,
						}
					}).then(()=>{});
				/*************** Send notification  ***************/
			}
		break;
		case Constants.NOTIFICATION_PURCHASE_PACKAGE:
			if(options.transfer_to && options.amount && options.package_request_id){

				/*************** Send notification  ***************/
					insertNotifications(req,res,{
						notification_data : {
							notification_type 	: 	Constants.NOTIFICATION_PURCHASE_PACKAGE,
							message_params 		: 	[options.amount],
							parent_table_id 	: 	options.package_request_id,
							user_ids 			: 	[options.transfer_to],
							role_id 			: 	Constants.CUSTOMER,
						}
					}).then(()=>{});
				/*************** Send notification  ***************/
			}
		break;
		case Constants.NOTIFICATION_PURCHASE_PACKAGE_STATUS:

			if(options.user_id && options.package_id && options.status){

				/*************** Send notification  ***************/
					insertNotifications(req,res,{
						notification_data : {
							notification_type 	: 	Constants.NOTIFICATION_PURCHASE_PACKAGE_STATUS,
							message_params 		: 	[options.status],
							parent_table_id 	: 	options.package_id,
							user_ids 			: 	[options.user_id],
							role_id 			: 	Constants.CUSTOMER,
						}
					}).then(()=>{});
				/*************** Send notification  ***************/
			}
		break;
		case Constants.NOTIFICATION_OVERSTANDING_PAYMENT_MODIFY_ORDER:

			if(options.customer_id && options.order_id && options.amount && options.unique_order_id){

				/*************** Send notification  ***************/
					insertNotifications(req,res,{
						notification_data : {
							notification_type 	: 	Constants.NOTIFICATION_OVERSTANDING_PAYMENT_MODIFY_ORDER,
							message_params 		: 	[options.amount,options.unique_order_id],
							parent_table_id 	: 	options.order_id,
							user_ids 			: 	[options.customer_id],
							role_id 			: 	Constants.CUSTOMER,
						}
					}).then(()=>{});
				/*************** Send notification  ***************/
			}
		break;
		case Constants.NOTIFICATION_SEND_TO_USERS_ORDER_REMIND:
			if(options.user_list && options.user_list.length >0){
				options.user_list.forEach(records =>{
					let tmpUserId = records._id;
					/*************** Send notification  ***************/
						insertNotifications(req,res,{
							notification_data : {
								notification_type 	: 	Constants.NOTIFICATION_SEND_TO_USERS_ORDER_REMIND,
								message_params 		: 	[records.days],
								parent_table_id 	: 	tmpUserId,
								user_ids 			: 	[tmpUserId],
								role_id 			: 	records.user_role_id,
							}
						}).then(()=>{});
					/*************** Send notification  ***************/
				});
			}
		break;

		case Constants.USER_CONTACT_US_EVENTS:
			if(options.name && options.email && options.phone && options.message){
				let adminEmail = res?.locals?.settings?.["Site.email"] || "";
				let emailOptionsContact			= clone(options);
				emailOptionsContact.to			= adminEmail;
				emailOptionsContact.action		= "contact_us";
				emailOptionsContact.rep_array	= [options.name,options.email,options.phone,options.message];

				/** Send email **/
				if(options.email) sendMail(req,res,emailOptionsContact);

				/**Set variable for send reply to user email */
				let emailOptionsReply			= clone(options);
				emailOptionsReply.to			= options.email;
				emailOptionsReply.action		= "reply_to_user";
				emailOptionsReply.rep_array		= [options.name];

				/** Send email **/
				if(options.email) sendMail(req,res,emailOptionsReply);
			}
		break;
		case Constants.DRIVER_BREAK_CANCEL_EMAIL_EVENTS:
			if(userDetails?._id){
				let fullName	= userDetails?.full_name || '';
				let email		= userDetails?.email || '';
				let tmpUserRoleId= userDetails?.user_role_id ||'';
				let breakDetail	= (options.break_details)	? options.break_details 	:{};
				let reason		= (breakDetail.cancel_reason)? breakDetail.cancel_reason :"";
				let breakDate	= (breakDetail.date)		? Helper.newDate(breakDetail.date,Constants.DATE_FORMAT_EMAIL) :"";

					/**Send email function */
				if(email && userDetails.is_email_verified == Constants.VERIFIED){
					sendMail(req,res,{
						to 			: email,
						action 		: "driver_break_cancel",
						rep_array 	: [fullName,breakDate,reason]
					});
				}

				/*************** Send notification ***************/
				if(tmpUserRoleId){
					insertNotifications(req,res,{
						notification_data : {
							notification_type 	: Constants.NOTIFICATION_DRIVER_BREAK_CANCEL,
							message_params 		: [],
							parent_table_id 	: options.break_id,
							user_ids 			: [userDetails._id],
							role_id 			: tmpUserRoleId,
							extra_parameters 	: {
								parent_id : userDetails.parent_id && new ObjectId(userDetails.parent_id) || ""
							}
						}
					}).then(()=>{ });
				}
				/*************** Send notification  ***************/
			}
		break;
		case Constants.DRIVER_BREAK_ADD_EMAIL_EVENTS:
			if(userDetails?._id){
				let fullName		= userDetails.full_name;
				let userRoleId		= userDetails.user_role_id;
				let email			= (userDetails.email) 	? userDetails.email 	:'';
				let breakDetails    = options.break_details ? options.break_details : {};
				let date 			= breakDetails.date 	? Helper.newDate(breakDetails.date,Constants.DATE_FORMAT_EMAIL) : "";

				sendMail(req,res,{
					to 			: email,
					action 		: "driver_break_add",
					rep_array 	: [fullName,date]
				});

				/*************** Send notification  ***************/
				insertNotifications(req,res,{
					notification_data : {
						notification_type 	: Constants.NOTIFICATION_DRIVER_BREAK_ADD,
						message_params 		: [fullName],
						parent_table_id 	: options.break_id,
						user_ids 			: [userId],
						role_id 			: userRoleId,
						extra_parameters 	: {}
					}
				}).then(()=>{ });
				/*************** Send notification  ***************/
			}
		break;
		case Constants.DRIVER_BREAK_END_EMAIL_EVENTS:
			if(userDetails?._id){
				let fullName		= userDetails.full_name;
				let userRoleId		= userDetails.user_role_id;
				let email			= (userDetails.email) 	? userDetails.email 	:'';
				let breakDetails    = options.break_details ? options.break_details : {};
				let date 			= breakDetails.date 	? Helper.newDate(breakDetails.date,Constants.DATE_FORMAT_EMAIL) : "";

				if(email && userDetails.is_email_verified == Constants.VERIFIED) sendMail(req,res,{
					to 			: email,
					action 		: "driver_break_end",
					rep_array 	: [fullName,date]
				});

				/*************** Send notification  ***************/
				insertNotifications(req,res,{
					notification_data : {
						notification_type 	: Constants.NOTIFICATION_DRIVER_BREAK_END,
						message_params 		: [fullName],
						parent_table_id 	: options.break_id,
						user_ids 			: [userId],
						role_id 			: userRoleId,
						extra_parameters 	: {}
					}
				}).then(()=>{ });
				/*************** Send notification  ***************/
			}
		break;
		case Constants.DRIVER_EXCUSE_CANCEL_EMAIL_EVENTS:
			if(userDetails?._id){
				let fullName		= (userDetails.full_name) 	? userDetails.full_name 	:'';
				let email			= (userDetails.email) 		? userDetails.email 		:'';
				let tmpUserRoleId	= (userDetails.user_role_id)? userDetails.user_role_id 	:'';
				let excuseDetail	= (options.excuse_details)	? options.excuse_details 	:{};
				let excuseDate		= (excuseDetail.date)		? Helper.newDate(excuseDetail.date,Constants.DATE_FORMAT_EMAIL) 	: "";
				let startTime		= (excuseDetail.start_time) ? excuseDetail.start_time 	:"";
				let endTime			= (excuseDetail.end_time)	? excuseDetail.end_time 	:"";
				let reason			= (excuseDetail.cancel_reason) ? excuseDetail.cancel_reason :""
				let emailAction		= "driver_excuse_cancel";
				let repArray		= [fullName,excuseDate,startTime,endTime,reason];

				/**Send email function */
				if(email  && userDetails.is_email_verified == Constants.VERIFIED){
					sendMail(req,res,{
						to 			: email,
						action 		: emailAction,
						rep_array 	: repArray
					});
				}

				/*************** Send notification ***************/
					if(tmpUserRoleId){
						insertNotifications(req,res,{
						notification_data : {
								notification_type 	: Constants.NOTIFICATION_DRIVER_EXCUSES_CANCEL,
								message_params 		: [],
								parent_table_id 	: options.excuse_id,
								user_ids 			: [userDetails._id],
								role_id 			: tmpUserRoleId,
								extra_parameters 	: {
									parent_id : userDetails.parent_id && new ObjectId(userDetails.parent_id) || ""
								}
							}
						}).then(()=>{ });
					}
				/*************** Send notification  ***************/
			}
		break;
		case Constants.NOTIFICATION_ORDER_OUTSTANDING_AMOUNT_PAID:
			if(options.order_id && options.amount && options.unique_order_id){
				/*************** Send notification  ***************/
					insertNotifications(req,res,{
						notification_data : {
							notification_type 	: 	Constants.NOTIFICATION_ORDER_OUTSTANDING_AMOUNT_PAID,
							message_params 		: 	[options.amount,options.unique_order_id],
							parent_table_id 	: 	options.order_id,
							user_id 			:   userId,
							only_for_user_role  :   true,
							role_id 			: 	Constants.CALL_CENTER_TEAM,
							extra_parameters 	: {
								order_id : options.order_id
							}
						}
					}).then(()=>{});
				/*************** Send notification  ***************/
			}
		break;
		case Constants.NOTIFICATION_FOR_RESTAURANT_UPDATED_PASSWORD:
			if(options.user_id && options.restaurant_id && restaurantDetails?._id){

				/*************** Send notification  ***************/
				insertNotifications(req,res,{
					notification_data : {
						notification_type 	: 	Constants.NOTIFICATION_FOR_RESTAURANT_UPDATED_PASSWORD,
						message_params 		: 	[restaurantDetails.name[Constants.DEFAULT_LANGUAGE_CODE]],
						parent_table_id 	: 	userId,
						user_id 		    : 	userId,
						user_role_id 		: 	userRoleId,
						role_id 			: 	[Constants.CRAVEZ,Constants.CONTENT_TEAM],
						only_for_user_role	:	true,
						extra_parameters 	:	{
							restaurant_slug : restaurantDetails.slug,
							restaurant_id  	: restaurantDetails?._id
						}
					}
				}).then(()=>{ });
				/*************** Send notification  ***************/
			}
		break;
		case Constants.NOTIFICATION_TO_DRIVER_ORDER_ADDRESSED_CHANGED:

			if(options.driver_id && options.order_id){

				/*************** Send notification  ***************/
					insertNotifications(req,res,{
						notification_data : {
							notification_type 	: 	Constants.NOTIFICATION_TO_DRIVER_ORDER_ADDRESSED_CHANGED,
							message_params 		: 	[options.unique_order_id],
							parent_table_id 	: 	options.order_id,
							user_ids 			: 	[options.driver_id],
							role_id 			: 	Constants.DRIVER,
							extra_parameters	:	(options.extra_parameters) ? options.extra_parameters :{}
						}
					}).then(()=>{});
				/*************** Send notification  ***************/
			}
		break;
	}
}; //End sendMailToUsers()