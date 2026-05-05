import { ObjectId } from 'mongodb';
import clone from 'clone';
import { parallel as asyncParallel } from 'async';

import { getDepartmentName } from './authzHelper.mjs';
import { getUniqueId } from './generatorHelper.mjs';
import * as Constants from "../config/global_constant.mjs";
import { getUtcDate } from './dateHelper.mjs';
import { getDb } from '../config/connection.mjs';
import Tables from '../config/database_tables.mjs';
import { insertNotifications } from '../services/index.mjs';

/**
 * Function to save tickets  logs
 *
 * @param req 		As 	Request Data
 * @param res 		As 	Response Data
 * @param options	As	Object data
 *
 * @return render/json
 */
export const saveTicketsLogs = async (req,res,options)=>{
	try {
		let logType 		= 	options?.log_type;
		let userName 		= 	options?.user_name;
		let description		=	options?.description;
		let department		=	options?.additional_details.assigned_to_role_id;
		let authDepartment 	=	options?.user_role_id;

		if(
			logType == Constants.TICKET_CLOSED_LOG || 
			logType == Constants.TICKET_CHECKIN_LOG || 
			logType == Constants.TICKET_REVIEW_LOG
		) department =	options?.user_role_id;

		let departmentName = "";
		if(department){
			let roleRes = await getDepartmentName(req, res,{department : department});

			if(roleRes.status != Constants.STATUS_SUCCESS) return roleRes;

			departmentName = roleRes?.result?.role_name || "";
		}

		let authDepartmentName = "";
		if(authDepartment){
			let roleRes = await getDepartmentName(req, res,{department : authDepartment});

			if(roleRes.status != Constants.STATUS_SUCCESS) return roleRes;

			authDepartmentName = roleRes?.result?.role_name || "";
		}

		/** Get params array */
		let logParams = [];
		switch(logType){
			case Constants.TICKET_ASSIGNED_LOG :
			case Constants.TICKET_REASSIGNED_LOG :
				logParams = [userName,authDepartmentName,departmentName];
			break;
			case Constants.TICKET_CLOSED_LOG :
				logParams = [userName,departmentName];
			break;
			case Constants.TICKET_CHECKIN_LOG :
				logParams = [userName,departmentName];
			break;
			case Constants.TICKET_REOPENED_LOG :
				logParams = [departmentName,userName,authDepartmentName];
			break;
			case Constants.TICKET_REVIEW_LOG :
				logParams = [userName,departmentName, options.rating, options.comment];
			break;
			case Constants.TICKET_COMMENT_LOG :
				logParams = [userName,authDepartmentName];
			break;
			case Constants.TICKET_UPDATE_LOG :
				logParams = [userName,authDepartmentName];
			break;
		}

		/** Get description from description param parameters **/
		if(Constants.TICKET_LOG_MESSAGE[logType] && logParams.length >0){
			let constants 	=	Constants.TICKET_LOG_MESSAGE[logType]['constants'];
			description 	= 	Constants.TICKET_LOG_MESSAGE[logType]['message'];
			for(let i = 0;i<constants.length;i++){
				description = description.replace(RegExp(constants[i],'g'),logParams[i]);
			}
		}

		/** Save tickets logs */
		let dbInstance 	=	getDb();
		await dbInstance.collection(Tables.TICKET_LOGS).insertOne({
			log_type 	        : 	logType,
			ticket_id       	: 	options.ticket_id,
			order_id 	        : 	options.order_id,
			user_id 	        : 	new ObjectId(options.user_id),
			user_role_id        : 	options.user_role_id,
			description         : 	description,
			additional_details  : 	options.additional_details,
			created 	        :	getUtcDate(),
		});

		/** Send success response */
		return {status: Constants.STATUS_SUCCESS};		
	} catch (e) {
		console.error("Error at saveTicketsLogs utility ",e);	
		return {status: Constants.STATUS_ERROR};
	}
};//end saveTicketsLogs()


/**
 * Function to generate ticket
 *
 * @param req 		As 	Request Data
 * @param res 		As 	Response Data
 * @param next		As	Callback argument to the middleware function
 * @param options	As	Object data
 *
 * @return render/json
 */
export const generateTicket = (req,res,next,options)=>{
	return new Promise(async resolve=>{
		try {
			let orderId		=	options?.order_id	&& 	new ObjectId(options?.order_id)	 || "";
			let createdBy	=	options?.created_by	&&	new ObjectId(options?.created_by) || "";
			let msgParams	=	options?.message_params || "";
			let type		=	options?.type ||"";

			/** Send error response */
			if(!type) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters")});

			/** For check type */
			if(!Constants.AUTOMATED_TICKET_INPUT[type]) return resolve({status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access")});
			
			let categoryId    = Constants.AUTOMATED_TICKET_INPUT[type].category;
			let subCategoryId = Constants.AUTOMATED_TICKET_INPUT[type].sub_category;
			let titleId       = Constants.AUTOMATED_TICKET_INPUT[type].title;
			let department    = Constants.AUTOMATED_TICKET_INPUT[type].department;
			let description   = Constants.AUTOMATED_TICKET_INPUT[type].description;

			/** Replace constant in description */
			if(msgParams && description && Constants.AUTOMATED_TICKET_INPUT[type].constants){
				let constants = clone(Constants.AUTOMATED_TICKET_INPUT[type].constants);

				for(let i = 0;i<constants.length;i++){
					let tmpConstant = (constants[i]) ? constants[i].trim()	:"";
					let tmpValue 	= (msgParams[i]) ? msgParams[i]		 	:"";

					description = description.replace(RegExp(tmpConstant,'g'),tmpValue);
				}
			}

			let dbInstance 	=	getDb();
			const users 	=	dbInstance.collection(Tables.USERS);
			const orders 	=	dbInstance.collection(Tables.ORDERS);
			const tickets 	=	dbInstance.collection(Tables.TICKETS);
			asyncParallel({
				created_by_details : (callback)=>{
					/** Set user conditions */
					let userConditions = {};
					if(createdBy){
						userConditions._id = createdBy;
					}else{
						userConditions.user_role_id = Constants.SYSTEM_ADMIN_ROLE_ID;
					}

					/** Find super admin details */                
					users.findOne(userConditions,{projection:{_id:1,full_name:1,user_role_id:1}}).then(userResult=>{
						callback(null,userResult);
					}).catch(next);
				},
				order_details: (callback)=>{
					if(!orderId) return callback(null,null);

					/** Find client details */
					orders.aggregate([
						{$match :  { _id : orderId }},
						{$lookup:	{
							"from" 			: 	Tables.USERS,
							"localField" 	:	"customer_id",
							"foreignField" 	: 	"_id",
							"as" 			: 	"customer_details"
						}},
						{$project :	{ 
							_id:1,customer_id:1,unique_order_id:1,
							client_name: {$arrayElemAt: ["$customer_details.full_name",0]},
							client_email: {$arrayElemAt: ["$customer_details.email",0]},
							client_mobile_number: {$arrayElemAt: ["$customer_details.mobile_number",0]} 
						}}
					]).toArray().then(orderResult=>{
						callback(null,orderResult?.[0] || {});
					}).catch(next);
				},
				ticket_details: (callback)=>{
					/** Set conidtions for tickets */
					let ticketConditions = {
						category            : new ObjectId(categoryId),
						sub_category        : new ObjectId(subCategoryId),
						title               : new ObjectId(titleId),
						assigned_to_role_id : department
					}
					if(orderId) ticketConditions.main_order_id = orderId;

					/** Find ticket details if already exists */
					tickets.findOne(ticketConditions,{projection:{_id:1,ticket_id:1}}).then(ticketResult=>{
						callback(null,ticketResult);
					}).catch(next);
				},
				ticket_unique_id: (callback)=>{
					/** get ticket unique id **/
					getUniqueId(req,res,next,{type:"ticket_no"}).then(uniqueIdResponse=>{
						callback(null,uniqueIdResponse?.result || "");
					}).catch(next);
				}
			},(err,response)=>{
				if(err) return next(err);

				let createdByDetails    = response?.created_by_details || {};
				let orderDetails        = response?.order_details      || {};
				let ticketDetails       = response?.ticket_details     || {};
				let ticketNo 			= response.ticket_unique_id || "";
				let createdByName	    = createdByDetails?.full_name || "";
				let createdByRoleId	    = createdByDetails?.user_role_id || "";
				let orderUniqueId       = orderDetails?.unique_order_id || "";
				let clientEmail         = orderDetails?.client_email || "";
				let clientName          = orderDetails?.client_name || "";
				let clientMobileNumber  = orderDetails?.client_mobile_number || "";
				createdBy           	= createdByDetails?._id ? new ObjectId(createdByDetails?._id)  :"";

				asyncParallel({
					save_ticket_details : (childCallback)=>{
						if(ticketDetails) return childCallback(null,{ticket_id: ticketDetails._id, ticket_number: ticketDetails.ticket_id});

						/** Set ticket data */
						let updateAbleData = {
							category  				:	new ObjectId(categoryId),
							sub_category	  		:	new ObjectId(subCategoryId),
							title	  				:	new ObjectId(titleId),
							description	  			:	description,
							ticket_type	   			:	(orderId) ? Constants.EXTERNAL_TICKET :Constants.INTERNAL_TICKET,
							order_id	   			:	orderUniqueId,
							assigned_to_role_id	   	:	department,
							check_in				:	false,
							is_not_seen				:	true,
							assigned_to				:	"",
							check_in_by				:	"",
							status					: 	Constants.PENDING,
							created_by				:	createdBy,
							created_by_role_id		:  	createdByRoleId,
							ticket_id				:	ticketNo,
							created 				: 	getUtcDate(),
							last_activity_type		: 	Constants.TICKET_ASSIGNED,
							last_activity_date_time	:  	getUtcDate(),
						};

						if(orderId){
							updateAbleData.main_order_id 	=	orderId;
							updateAbleData.client_details	= 	{
								email			:	clientEmail,
								name	  		: 	clientName,
								mobile_number   : 	clientMobileNumber,
							};
						}
						/** Save ticket details **/
						tickets.insertOne(updateAbleData).then(insertResult=>{
							childCallback(null,{ticket_id: insertResult?.insertedId || "", ticket_number: ticketNo});
						}).catch(next);
					},
					update_flag_in_orders : (childCallback)=>{
						if(!orderId) return childCallback(null);

						/** Update order details */
						orders.updateOne({_id: orderId},{$set: {ticketing: true }}).then(()=>{
							childCallback(null);
						}).catch(next);
					},
				},(asyncErr,asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					let ticketId 	 =  asyncResponse?.save_ticket_details?.ticket_id || "";
					let ticketNumber =  asyncResponse?.save_ticket_details?.ticket_number || "";

					if(!ticketDetails){
						/** Save ticket logs **/
						saveTicketsLogs(req, res,{
							user_name 			: 	createdByName,
							order_id 			: 	orderUniqueId,
							ticket_number		: 	ticketNumber,
							log_type			: 	Constants.TICKET_ASSIGNED_LOG,
							ticket_id 			: 	ticketId,
							description 		: 	description,
							user_id 			: 	createdBy,
							user_role_id 		: 	createdByRoleId,
							additional_details	: 	{
								update_by 			:	createdBy,
								activity_type 		:	Constants.TICKET_ASSIGNED,
								assigned_to_role_id	:	department
							},
						}).then(()=>{ });

						/** Notification for ticket assigned */
							insertNotifications(req,res,{
								notification_data : {
									notification_type:	Constants.NOTIFICATION_TICKET_ASSIGNED,
									message_params 	:	[ticketNumber],
									parent_table_id : 	ticketId,
									user_id 		: 	createdBy,
									user_role_id 	: 	createdByRoleId,
									role_id 		: 	[department],
									only_for_user_role:	true,
									extra_parameters: 	{
										ticket_id 	: ticketId
									}
								}
							}).then(()=>{});
						/** Notification for ticket assigned */
					}

					/** Send success response */
					return resolve({status: Constants.STATUS_SUCCESS});
				});
			});

		} catch (error) {
			return next(error);
		}
	}).catch(next);
};//End generateTicket()