import { ObjectId } from 'mongodb';
import { getDb } from '../config/connection.mjs';
import Tables from '../config/database_tables.mjs';
import { getUtcDate, getRoleFieldName } from '../utils/index.mjs';
import * as Constants from "../config/global_constant.mjs";
import clone from 'clone';
import { socketRequest } from './socketService.mjs';
import { pushNotification } from './pushNotificationService.mjs';


/**
 *  Function to insert notification
 *
 * @param req 			As Request Data
 * @param res 			As Response Data
 * @param options		As options
 *
 * @return array
 */
export const insertNotifications = async (req,res,options={}) =>{	
	try{
		let notificationData	= 	options?.notification_data || {};
		let messageParams		= 	notificationData?.message_params || "";
		let parentTableId		= 	notificationData?.parent_table_id || "";
		let orderId				= 	notificationData?.order_id || "";
		let restaurantId		= 	notificationData?.restaurant_id || "";
		let notificationType	= 	notificationData?.notification_type || "";
		let createdBy			=	notificationData?.user_id || (req?.session?.user?._id || "");
		let createdByRoleId		=	notificationData?.user_role_id || (req?.session?.user?.user_role_id || "");
		let onlyForUserRole		= 	notificationData?.only_for_user_role || false;
		let isRestaurantNotification = 	notificationData?.is_restaurant_notification || false;

		/** Get notification type details */
		let dbInstance = getDb();
		const typeResult = await dbInstance.collection(Tables.NOTIFICATION_TYPES).findOne({notification_type: parseInt(notificationType)});

		/** Send error response when details not found based on notification type */
		if(!typeResult){
			return {
				status 	: 	Constants.STATUS_ERROR, user_list: [],
				message	:	res.__("admin.system.something_going_wrong_please_try_again")
			};
		}

		let constants		= 	typeResult?.constants?.split(",") || [];
		let tmpEnTitle 		=	typeResult?.title?.en || "";
		let tmpArTitle	 	=	typeResult?.title?.ar || "";
		let tmpEnMessage 	=	typeResult?.message?.en || "";
		let tmpArMessage 	=	typeResult?.message?.ar || "";

		if(messageParams){
			/** Get message from message param parameters **/
			for(let i = 0;i<constants.length;i++){
				let tmpConstant = (constants[i]) ? "{"+constants[i].trim()+"}" :"";
				if(notificationType == Constants.NOTIFICATION_SCHEDULED_PUSH_NOTIFICATION){
					tmpEnTitle= tmpEnTitle.replace(RegExp(tmpConstant,'g'),messageParams[i]);
					tmpArTitle= tmpArTitle.replace(RegExp(tmpConstant,'g'),messageParams[i]);
				}
				tmpEnMessage = tmpEnMessage.replace(RegExp(tmpConstant,'g'),messageParams[i]);
				tmpArMessage = tmpArMessage.replace(RegExp(tmpConstant,'g'),messageParams[i]);
			}
		}else{
			tmpEnMessage = notificationData?.message || "";
			tmpArMessage = notificationData?.message || "";
		}

		/** Get created by role id if is passed blank */
		if(!createdBy || !createdByRoleId){
			const userResult = await dbInstance.collection(Tables.USERS).findOne({
				user_role_id : Constants.CRAVEZ
			},{projection:{_id:1}});

			if(!createdBy)		createdBy = userResult?._id || "";
			if(!createdByRoleId)createdByRoleId = userResult?.user_role_id || "";
		}

		/** Set data */
		let saveNotificationData= {
			user_id				: "",
			user_role_id		: "",
			created_by			: new ObjectId(createdBy),
			created_role_id		: createdByRoleId,
			title				: tmpEnTitle,
			message				: tmpEnMessage,
			title_descriptions 	: {en: tmpEnTitle, ar: tmpArTitle},
			message_descriptions: {en: tmpEnMessage, ar: tmpArMessage},
			parent_table_id		: new ObjectId(parentTableId),
			extra_parameters	: notificationData?.extra_parameters || {},
			notification_type	: notificationType,
			is_seen				: Constants.NOT_SEEN,
			is_read				: Constants.NOT_READ,
			created				: getUtcDate(),
			modified			: getUtcDate()
		};

		if(restaurantId) saveNotificationData["restaurant_id"] = new ObjectId(restaurantId);

		let userRoleId = (notificationData['role_id'])? notificationData['role_id'] : Constants.RESTAURANT;
		let selectedUserIds	= notificationData?.user_ids || [];

			/** Save notification data **/
		const saveDataStatus = await saveNotifications(req,res,{
			user_ids			:	selectedUserIds,
			notification_data	:	saveNotificationData,
			notification_type	:	notificationType,
			user_role_id		:	userRoleId,
			only_for_user_role	: 	onlyForUserRole,
			order_id			:	orderId,
			restaurant_id		:	restaurantId,
			is_restaurant_notification:	isRestaurantNotification,
		})
		
		/** Send response */
		return {
			status 	 : 	saveDataStatus?.status,
			user_list:	saveDataStatus?.user_list || [],
			message	 :	saveDataStatus?.message || ""
		};
	}catch(error){
		console.error("Error in insertNotification:", error);

		return {
			status 	: 	Constants.STATUS_ERROR, user_list: [],
			message	:	res.__("admin.system.something_going_wrong_please_try_again")
		};
	}
}// end insertNotification()

/**
 *  Function to save notifications
 *
 * @param req 			As Request Data
 * @param res 			As Response Data
 * @param options		As options
 *
 * @return array
 */
export const saveNotifications = async (req,res,options={}) =>{
	try{
		let userIds			 =	options?.user_ids || [];
		let notificationType =	options?.notification_type || "";
		let onlyForUserRole	 =	options?.only_for_user_role || false;
		let orderId			 =	options?.order_id || "";
		let restaurantId	 = 	options?.restaurant_id || "";
		let isRestaurantNotification = 	options?.is_restaurant_notification || false;

		if((userIds.length>0 || onlyForUserRole) && notificationType){
			let saveNotificationData	=	options?.notification_data || [];
			let notificationUserRoleId	=	options?.user_role_id || "";
			let notificationsList		=	[];

			if(!onlyForUserRole){
				let roleFieldName	= getRoleFieldName(notificationUserRoleId);

				/** Set insertable data **/
				notificationsList 	= 	[];
				userIds.map(records=>{
					let tempNotificationData	 		 = 	{...saveNotificationData};
					tempNotificationData['user_id'] 	 = 	new ObjectId(records);
					tempNotificationData['user_role_id'] = 	notificationUserRoleId;
					if(roleFieldName) tempNotificationData[roleFieldName] = 	true;
					notificationsList.push(tempNotificationData);
				});
			}else{
				if(notificationUserRoleId.constructor !== Array) notificationUserRoleId = [notificationUserRoleId];

				/** Send multiple  role id */
				notificationsList = notificationUserRoleId.map(roleRecords=>{
					let roleFieldName						= getRoleFieldName(roleRecords);
					let tempNotificationData 				= clone(saveNotificationData);
					tempNotificationData['user_role_id'] 	= roleRecords;
					if(roleFieldName) tempNotificationData[roleFieldName] = true;
					return tempNotificationData
				});
			}

			/** Insert in notification table **/
			let dbInstance = getDb();
			const notifications	= 	dbInstance.collection(Tables.NOTIFICATIONS);
			await notifications.insertMany(notificationsList,{forceServerObjectId:true});

			if(saveNotificationData?.restaurant_id){
				socketRequest(req,res,{
					room_id 		: String(saveNotificationData?.restaurant_id),
					emit_function	: "notification_received",
					message			: saveNotificationData["message"],
					type			: notificationType
				});
			}else{
				/** Send push notification**/
				notificationsList.map(notificationUserId=>{
					if(onlyForUserRole){
						/** generate notification url*/
						let urlResponse = generateNotificationUrl(req,res,{result : [notificationUserId]});
						let tmpNotification = urlResponse?.data?.[0]|| {};
						socketRequest(req,res,{
							room_id 		: tmpNotification.user_role_id,
							emit_function	: "notification_received",
							message			: tmpNotification.message,
							url				: tmpNotification.url,
							type			: notificationType
						});
					}else{
						if(!isRestaurantNotification){
							pushNotification(req,res,{
								order_id 	: 	orderId,
								pn_type		: 	notificationType,
								pn_body		:	saveNotificationData?.message || "",
								user_id		:	String(notificationUserId?.user_id || ""),
								parent_id	:	saveNotificationData?.parent_table_id || "",
								restaurant_id:	restaurantId,
								is_restaurant_notification:	isRestaurantNotification,
								extra_parameters : saveNotificationData?.extra_parameters || {},
								pn_body_descriptions: {
									message : saveNotificationData?.message_descriptions || {},
									title 	: saveNotificationData?.title_descriptions || {},
								},
							}).then(()=>{});
						}

						/** generate notification url*/
						let urlResponse = generateNotificationUrl(req,res,{result : [notificationUserId]});
						let tmpNotification = urlResponse?.data?.[0]|| {};
						socketRequest(req,res,{
							room_id 		: tmpNotification.user_id,
							emit_function	: "notification_received",
							message			: tmpNotification.message,
							url				: tmpNotification.url,
							type			: notificationType
						});
					}
				});
			}

			/** Set insertable data **/
			return {
				status 		: 	Constants.STATUS_SUCCESS,
				user_list 	: 	notificationsList
			};			
		}else{
			/** Send error response **/
			return {
				status 		: 	Constants.STATUS_ERROR,
				user_list 	: 	[],
				message		:	res.__('admin.users.no_user_selected')
			};
		}
	}catch(error){
		console.error("Error in saveNotifications:", error);

		return {
			status 	: 	Constants.STATUS_ERROR, user_list: [],
			message	:	res.__("admin.system.something_going_wrong_please_try_again")
		};
	}
}// end saveNotifications()

/**
 *  Function is genrate notification url
 *
 * @param req As request Data
 *
 * @return Json
 */
export const generateNotificationUrl = (req,res,options)=>{
	try{
		let notificationData = options?.result || [];
		if(!notificationData || !notificationData.length){
			return {data : [],options:options};
		}

		notificationData.map((notification)=>{
			let type 		= (notification.notification_type) ? notification.notification_type : "";
			let userRoleId	= (notification.user_role_id) 	   ? notification.user_role_id : "";
			let extraParams = (notification.extra_parameters)  ? notification.extra_parameters  : "";
			let parentTableId = (notification.parent_table_id) ? notification.parent_table_id   : "";

			let tmpUrl = "javascript:void(0);";

			switch(type) {
				case Constants.NOTIFICATION_USER_REGISTER:
					if(extraParams.user_id && extraParams.user_type){
						tmpUrl = Constants.WEBSITE_ADMIN_URL+"users/"+extraParams.user_type+"/view/"+extraParams.user_id;
					}
				break;
				case Constants.NOTIFICATION_RESTAURANT_ENQUIRY_REQUEST:
					if(extraParams.enquiry_id){
						tmpUrl = Constants.WEBSITE_ADMIN_URL+"restaurant_enquiries/view/"+extraParams.enquiry_id;
					}
				break;
				case Constants.NOTIFICATION_BRANCH_APPROVAL_REQUEST:
					tmpUrl = Constants.WEBSITE_ADMIN_URL+"restaurant_pending_branches";
				break;
				case Constants.NOTIFICATION_RESTAURANT_CATEGORY_APPROVAL_REQUEST:
					tmpUrl = Constants.WEBSITE_ADMIN_URL+"restaurant_category";
				break;
				case Constants.NOTIFICATION_RESTAURANT_MENU_APPROVAL_REQUEST:
					tmpUrl = Constants.WEBSITE_ADMIN_URL+"restaurant_menu";
				break;
				case Constants.NOTIFICATION_TICKET_ASSIGNED:
				case Constants.NOTIFICATION_TICKET_REOPENED_AND_ASSIGNED:
					if(extraParams.ticket_id){
						tmpUrl = Constants.WEBSITE_ADMIN_URL+"tickets/view/"+extraParams.ticket_id;
					}
				break;
				case Constants.NOTIFICATION_OVERTIME_REQUEST:
					tmpUrl = Constants.WEBSITE_ADMIN_URL+"overtime_request";
				break;
				case Constants.NOTIFICATION_TEAM_BREAK_REQUEST_POST:
					tmpUrl = Constants.WEBSITE_ADMIN_URL+"team_breaks";
				break;
				case Constants.NOTIFICATION_TEAM_BREAK_APPROVE_REJECT:
					tmpUrl = Constants.WEBSITE_ADMIN_URL+"team_breaks";
				break;
				case Constants.NOTIFICATION_CUISINE_PRIORITIES_REJECTED:
					tmpUrl = Constants.WEBSITE_ADMIN_URL+"cuisine_priorities/"+extraParams.restaurant_id+"/"+extraParams.branch_id;
				break;
				case Constants.NOTIFICATION_CUISINE_PRIORITIES_APPROVED:
					tmpUrl = Constants.WEBSITE_ADMIN_URL+"cuisine_priorities/"+extraParams.restaurant_id+"/"+extraParams.branch_id;
				break;
				case Constants.NOTIFICATION_CUISINE_PRIORITIES_SEND_FOR_APPROVAL:
					tmpUrl = Constants.WEBSITE_URL+"cuisine_priorities/"+extraParams.restaurant_id+"/"+extraParams.branch_id;
				break;
				case Constants.NOTIFICATION_RESTAURANT_ITEM_APPROVAL_REQUEST:
					tmpUrl = Constants.WEBSITE_ADMIN_URL+"restaurants/"+extraParams.restaurant_slug+"/pending_item/"+extraParams.item_id;
				break;
				case Constants.NOTIFICATION_DRIVER_BREAK_REQUEST_POST:
					tmpUrl = Constants.WEBSITE_ADMIN_URL+"driver_breaks";
				break;
				case Constants.NOTIFICATION_DRIVER_BREAK_ENDED:
					tmpUrl = Constants.WEBSITE_ADMIN_URL+"driver_breaks";
				break;
				case Constants.NOTIFICATION_ORDER_CONFIRMED:
				case Constants.NOTIFICATION_ORDER_MODIFIED:
				case Constants.NOTIFICATION_ORDER_DELIVERED:
				case Constants.NOTIFICATION_ORDER_CANCELLED:
				case Constants.NOTIFICATION_ORDER_REJECTED:
				case Constants.NOTIFICATION_ORDER_ON_THE_WAY:
				case Constants.NOTIFICATION_ORDER_READY_TO_PICK_UP:
				case Constants.NOTIFICATION_ORDER_PREPARING:
				case Constants.NOTIFICATION_ORDER_PENDING:
					if(userRoleId == Constants.FRONT_USER_ROLE_ID){
						tmpUrl = Constants.WEBSITE_URL+"orders/view/"+parentTableId;
					}else {
						tmpUrl = Constants.WEBSITE_ADMIN_URL+"orders/view/"+parentTableId;
					}
				break;
				case Constants.NOTIFICATION_EXCUSES_REQUEST_POST :
					tmpUrl = Constants.WEBSITE_ADMIN_URL+"driver_excuses";
				break;
				case Constants.NOTIFICATION_TO_FLEET_ORDER_MARKED_PROBLEMATIC :
					if(extraParams.order_id){
						tmpUrl = Constants.WEBSITE_ADMIN_URL+"orders/view/"+extraParams.order_id;
					}
				break;
				default:
					let defaultURL = "javascript:void(0);";
					if(userRoleId == Constants.FRONT_USER_ROLE_ID) defaultURL = Constants.WEBSITE_URL+"notifications";
					tmpUrl = defaultURL;
			}

			notification.url = tmpUrl;
		});

		return {data : notificationData,options:options};
	}catch(error){
		console.error("Error in generateNotificationUrl:", error);

		return {data: [], options:options};
	}
};//End generateNotificationUrl()
