import { ObjectId } from 'mongodb';
import { getDb } from '../config/connection.mjs';
import Tables from '../config/database_tables.mjs';
import { getUtcDate} from '../utils/index.mjs';
import * as Constants from "../config/global_constant.mjs";
import { parallel as asyncParallel, each as asyncEach } from 'async';

/**
 *  Function to insert notification
 *
 * @param req 			As Request Data
 * @param res 			As Response Data
 * @param options		As options
 *
 * @return array
 */
export const pushNotification = async (req,res,options={}) =>{	
	try{
		let body				=	(options)			?	options							:{};
		let pnBody				=	(options.pn_body)	?	options.pn_body					:"";
		let pnType				=	(options.pn_type)	?	options.pn_type					:"";
		let pnDeviceToken		=	(options.device_token)?	options.device_token			:"";
		let pnDeviceType		=	(options.device_type)?	options.device_type				:"";
		let pnUserRoleId		=	(options.user_role_id)?	options.user_role_id			:"";
		let userId				=	(options.user_id)	?	new ObjectId(options.user_id)		:"";
		let orderId				=	(options.order_id)	?	new ObjectId(options.order_id)		:"";
		let parentId			=	(options.parent_id)	?	new ObjectId(options.parent_id)		:"";
		let restaurantId		=	(options.restaurant_id)? new ObjectId(options.restaurant_id):"";
		let userLanguageId		=   (options.user_language_id) ?	options.user_language_id :"";
		let isRestaurantNotification= (options.is_restaurant_notification) ?	options.is_restaurant_notification	:"";
		let pnBodyDescriptions	=  (options.pn_body_descriptions) ?	options.pn_body_descriptions :{};
		let extraParameters		=	(options.extra_parameters) ? options.extra_parameters : "";
		delete body.extra_parameters;
		let pnTitle				=	pnBody;
		let serverKey 			= 	Constants.WEBSITE_PN_ANDROID_SERVER_KEY;

		if(pnBodyDescriptions){
			if(pnBodyDescriptions.title && pnBodyDescriptions.title[Constants.DEFAULT_LANGUAGE_CODE]){
				pnTitle = pnBodyDescriptions.title[Constants.DEFAULT_LANGUAGE_CODE];
			}
			if(pnBodyDescriptions.message && pnBodyDescriptions.message[Constants.DEFAULT_LANGUAGE_CODE]){
				pnBody = pnBodyDescriptions.message[Constants.DEFAULT_LANGUAGE_CODE];
			}
		}

		if(pnType == Constants.NOTIFICATION_TO_DRIVER_ORDER_ASSIGNMENT_REQUEST_PASSED){
			pnType = Constants.NOTIFICATION_TO_DRIVER_ORDER_UNDO_ASSIGNED;
			if(body) body.pn_type = Constants.NOTIFICATION_TO_DRIVER_ORDER_UNDO_ASSIGNED;
		}

		if((!userId && !isRestaurantNotification && !pnDeviceToken && !pnDeviceType) || (isRestaurantNotification && !restaurantId)){
			/** Send error response **/
			return {
				status 	: 	Constants.STATUS_ERROR,
				message	:	res.__("system.missing_parameters"),
				missing_fields: ["user_id", "restaurant_id"]
			};
		}

		let dbInstance = getDb();

		/** Set user conditions */
		let userConditions = {_id: userId};
		if(isRestaurantNotification && restaurantId){
			userConditions = {
				restaurant_id 	: restaurantId,
				is_deleted 		: Constants.NOT_DELETED,
			};
		}

		let result = {};
		if(pnDeviceToken && pnDeviceType){
			result = {
				_id 		:	pnDeviceType,
				device_token:	[pnDeviceToken],
				user_role_id:	pnUserRoleId,
				preference_language: userLanguageId
			};
		}else{
			/** Get user details */
			let users = dbInstance.collection(Tables.USERS);
			result = await users.aggregate([
				{$match : 	userConditions},
				{$unwind :	"$device_details"},
				{$group	 :	{
					_id 		:	"$device_details.device_type",
					device_token:	{$push : "$device_details.device_token"},
					user_role_id:	{$first: "$user_role_id"},
					restaurant_id:	{$first: "$restaurant_id"},
					language_id	:	{$first: "$language_id"},
				}}
			]).toArray();
		}

		/** Get order details */
		let orderResult;
		if((orderId || parentId) || (pnType == Constants.NOTIFICATION_OVERSTANDING_PAYMENT_MODIFY_ORDER)){
			const orders = dbInstance.collection(Tables.ORDERS);
			orderResult = await orders.findOne({_id: {$in : [orderId,parentId]}},{projection:{outstanding_amount:1,payment_method:1}});
		}
		
		let outstandingAmount = orderResult && orderResult?.outstanding_amount || "";
		let paymentMethod 	  = orderResult && orderResult.payment_method || "";

		if(!result || result.length == 0){
			/**Save log request **/
			savePNRequest({
				title 			: pnTitle,
				body 			: pnBody,
				body_descriptions: pnBodyDescriptions,
				user_id			: userId,
				device_type 	: "",
				device_token	: "",
				server_key		: serverKey,
				parent_id		: parentId,
				restaurant_id	: restaurantId,
				request			: "",
				response		: "result is blank",
				err				: Constants.STATUS_ERROR,
				created			: getUtcDate()
			}); //call function to save

			/** Send error response **/
			return {
				status 	: Constants.STATUS_ERROR,
				result	: result,
				message : "result is blank"
			}
		}

		let serviceOptions	= {
			token: {
				key		: 	Constants.WEBSITE_ROOT_PATH+"cert/AuthKey_82FBB56236.p8",
				keyId	: 	"82FBB56236",
				teamId	:	"SFA9GUN7NY"
			},
			production: false,
			// topic: "com.fullestop.PushChat"
		};
		let service =   new Provider(serviceOptions);

		asyncEach(result,(records,eachCallback)=>{
			let deviceType	= (records._id) 			? 	records._id.toLowerCase() 	:"";
			let userRoleId	= (records.user_role_id)	? 	records.user_role_id 		:"";
			let deviceToken	= (records.device_token)	?	records.device_token		:[];
			let tmpRestaurantId	= (records.restaurant_id)?	records.restaurant_id		:"";
			let tmpLanguageId = (records.language_id)	?	records.language_id			:"";

			if(pnBodyDescriptions){
				let tmpMessage 	= 	(pnBodyDescriptions.message)? 	pnBodyDescriptions.message 	:{};
				let tmpTitle 	=	(pnBodyDescriptions.title)	?	pnBodyDescriptions.title 	:{};
				if(tmpLanguageId == Constants.ARABIC_LANGUAGE_MONGO_ID){
					pnTitle =	(tmpTitle.ar) 		? 	tmpTitle.ar 	:pnTitle;
					pnBody 	=	(tmpMessage.ar) 	?	tmpMessage.ar 	:pnBody;
				}else{
					pnTitle =	(tmpTitle.en) 		? 	tmpTitle.en 	:pnTitle;
					pnBody 	=	(tmpMessage.en) 	?	tmpMessage.en 	:pnBody;
				}
			}

			if(!deviceType || deviceToken.length <=0){
				/**Save log request **/
				savePNRequest({
					title 			: pnTitle,
					body 			: pnBody,
					user_id			: userId,
					device_type 	: deviceType,
					device_token	: deviceToken,
					server_key		: serverKey,
					parent_id		: parentId,
					restaurant_id	: restaurantId,
					body_descriptions: pnBodyDescriptions,
					request			: "",
					response		: "device type/device token error",
					err				: Constants.STATUS_ERROR,
					created			: getUtcDate()
				}); //call function to save
				eachCallback(null)
			}else{
				asyncEach(deviceToken,(tmpToken,subEachCallback)=>{

					asyncParallel({
						android_pn : (callback)=>{
							if(deviceType != "android") return callback(null);

							let fcm 	=	new FCM(serverKey);
							body.title 	= 	pnTitle;
							body.body 	=	pnBody;

							if(pnType == Constants.NOTIFICATION_OVERSTANDING_PAYMENT_MODIFY_ORDER){
								if(paymentMethod) 		body.payment_method 	=	paymentMethod;
								if(outstandingAmount) 	body.outstanding_amount = 	outstandingAmount;
							}

							if(pnType == Constants.NOTIFICATION_TO_DRIVER_ORDER_ADDRESSED_CHANGED && extraParameters){
								if(extraParameters.status)   body.driver_status =	extraParameters.status;
							}

							if(pnType == Constants.NOTIFICATION_SCHEDULED_PUSH_NOTIFICATION && extraParameters){
								if(extraParameters.image)   body.image =	PN_IMAGE_URL+extraParameters.image;
								if(extraParameters.payload_type) body.payload_type =	extraParameters.payload_type;
								if(extraParameters.payload_value) body.payload_value 	= extraParameters.payload_value;
								if(extraParameters.payload_value_array) body.payload_value_array 	=	extraParameters.payload_value_array;
								if(extraParameters.title) pnTitle 	= extraParameters.title;
								if(extraParameters.title) body.title= extraParameters.title;
							}
							let message = {to: tmpToken, data: body};

							fcm.send(message,(err, response)=>{
								/**Save log request **/
								savePNRequest( {
									title 			: pnTitle,
									body 			: pnBody,
									user_id			: userId,
									device_type 	: deviceType,
									body_descriptions: pnBodyDescriptions,
									device_token	: tmpToken,
									server_key		: serverKey,
									request			: message,
									parent_id		: parentId,
									restaurant_id	: restaurantId,
									response		: response,
									err				: err,
									created			: getUtcDate()
								});
								callback(null);
							});
						},
						iphone_pn : (callback)=>{
							if(deviceType != "iphone") return callback(null);

							if(pnType == Constants.NOTIFICATION_OVERSTANDING_PAYMENT_MODIFY_ORDER){
								if(paymentMethod) 	  pnBody.payment_method 	=	paymentMethod;
								if(outstandingAmount) pnBody.outstanding_amount = 	outstandingAmount;
							}

							if(pnType == Constants.NOTIFICATION_TO_DRIVER_ORDER_ADDRESSED_CHANGED && extraParameters){
								if(extraParameters.status)   body.driver_status =	extraParameters.status;
							}

							if(pnType == Constants.NOTIFICATION_SCHEDULED_PUSH_NOTIFICATION && extraParameters){
								if(extraParameters.image)   body.pn_image =	Constants.PN_IMAGE_URL+extraParameters.image;
								if(extraParameters.payload_type) body.payload_type =	extraParameters.payload_type;
								if(extraParameters.payload_value) body.payload_value 	= extraParameters.payload_value;
								if(extraParameters.payload_value_array) body.payload_value_array =	extraParameters.payload_value_array;
								if(extraParameters.title) pnTitle 	=	extraParameters.title;
							}

							let tokens	=   tmpToken;
							let pnTempNotificationData = {
								alert	: pnTitle,
								data	: pnBody,
								payload : { data : body},
								aps 	: {
									"alert"			: 	{body : pnBody,title:pnTitle},
									"title"			: 	pnTitle,
									"message"		: 	pnBody,
									"data"			:	body,
									"pn_type"		: 	pnType,
									"category"		: 	String(pnType),
									"mutable-content": 	1,
									"sound"			: 	"notification.caf",
								},
								topic: "com.fullestop.cravezCaptain"
							};

							if(pnType == Constants.NOTIFICATION_DRIVER_ASSIGNED_ORDER) pnTempNotificationData.aps.sound = "captain_assignment_notification.caf";
							if(userRoleId == Constants.CUSTOMER) pnTempNotificationData.topic = "com.fullestop.PushChat";

							if(tmpRestaurantId) pnTempNotificationData.topic = "com.fullestop.cravezRestaurant.dev";

							/** Send order id in PN*/
							if(orderId)  pnTempNotificationData.data.order_id = orderId;
							if(parentId) pnTempNotificationData.data.parent_id = parentId;
							if(outstandingAmount) pnTempNotificationData.data.outstanding_amount = outstandingAmount;
							if(paymentMethod) pnTempNotificationData.data.payment_method = paymentMethod;

							let note = new Notification(pnTempNotificationData);
							service.send(note, tokens).then(result =>{
								/**Save log request **/
								savePNRequest({
									title 			: 	pnTitle,
									body 			: 	pnBody,
									user_id			: 	new ObjectId(userId),
									device_type 	: 	deviceType,
									device_token	:	tmpToken,
									request			: 	pnTempNotificationData,
									body_descriptions: pnBodyDescriptions,
									response		: 	result,
									created			:	getUtcDate()
								});
								callback(null);
							});
						},
						other_device:(callback)=>{
							if(deviceType == "iphone" ||deviceType == "android") return callback(null);

							/**Save log request **/
							savePNRequest({
								title 			: pnTitle,
								body 			: pnBody,
								user_id			: userId,
								device_type 	: deviceType,
								device_token	: tmpToken,
								server_key		: serverKey,
								parent_id		: parentId,
								restaurant_id	: restaurantId,
								body_descriptions: pnBodyDescriptions,
								request			: "",
								response		: "Invalid device type",
								err				: Constants.STATUS_ERROR,
								created			: getUtcDate()
							});
							callback(null);
						},
					},(asyncErr)=>{
						subEachCallback(asyncErr)
					});
				},(asyncSubEachErr)=>{
					eachCallback(asyncSubEachErr);
				});
			}
		},()=>{
			service.shutdown();

			return { status: Constants.STATUS_SUCCESS};
		});
	}catch(error){
		console.error("Error in pushNotificationService:", error);

		return {
			status 	: 	Constants.STATUS_ERROR, 
			message	:	res.__("admin.system.something_going_wrong_please_try_again")
		};
	}
}// end pushNotification()

/**Function to save pn log */
const savePNRequest = (options)=>{
	const dbInstance = getDb();
	dbInstance.collection(Tables.PN_LOGS).insertOne(options).then(()=>{}).catch(()=>{});
	return "";
}//End savePNRequest();