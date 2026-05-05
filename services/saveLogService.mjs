import { ObjectId } from 'mongodb';
import { getUtcDate, newDate, addDate, arrayToObject } from '../utils/index.mjs';
import * as Constants from "../config/global_constant.mjs";
import { getDb } from '../config/connection.mjs';
import Tables from '../config/database_tables.mjs';

/**
 * Function to save system logs
 *
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Object} options - Options object containing:
 *   @param {string} user_id - User ID
 *   @param {string} parent_id - Parent ID
 *   @param {string} activity_module - Activity module
 *   @param {string} parent_type - Parent type
 *   @param {string} activity_type - Activity type
 *   @param {Object} additional_details - Additional details
 * @returns {Promise<Object>} Promise resolving to status object
 */
export const saveSystemLogs = async (req, res, options) => {
	const userId 			=	options?.user_id && ObjectId.isValid(options?.user_id) 		? 	new ObjectId(options?.user_id) 	 :"";
	const parentId 			=	options?.parent_id && ObjectId.isValid(options?.parent_id) 	?	new ObjectId(options?.parent_id) :"";
	const activityModule 	=	options?.activity_module || options?.parent_type || "";
	const activityType 		=	options?.activity_type || "";
	const additionalDetails =	options?.additional_details || "";

	if (!userId || !activityType || !activityModule) {
		return {
			status: Constants.STATUS_ERROR,
			message: res.__("admin.system.missing_parameters")
		};
	}

	try {
		const dbInstance 	= 	getDb();
		const system_logs	=	dbInstance.collection(Tables.SYSTEM_LOGS);
		await system_logs.insertOne({
			user_id: userId,
			parent_id: parentId,
			activity_module: activityModule,
			activity_type: activityType,
			created: getUtcDate(),
			...(additionalDetails && { additional_details: additionalDetails })
		});

		return { status: Constants.STATUS_SUCCESS };
	} catch (error) {
		console.error("Error in saveSystemLogs:", error);
		return {
			status: Constants.STATUS_ERROR,
			message: res.__("admin.system.something_going_wrong_please_try_again")
		};
	}
};// end saveSystemLogs()

/**
 * Function to save driver break logs
 *
 *  @param req		As	Request Data
 * @param res		As 	Response Data
 * @param next		As	Callback argument to the middleware function
 * @param options	As	Request params
 *
 * @return json
 */
export const saveDriverStatusLogs = async (req, res,next, options)=>{
	try {
		const {
			type = '',
			parent_id: parentId = '',
			driver_id: driverId = '',
			event_type: eventType = '',
			start_time,
			end_time,
			duration
		} = options;

		if (!type || !driverId || !parentId || !eventType) {
			return { status: Constants.STATUS_ERROR, message: res.__('system.missing_parameters') };
		}

		let startDate   =   newDate(newDate('', Constants.CURRENTDATE_START_DATE_FORMAT));
		let endDate     =   newDate(newDate('', Constants.CURRENTDATE_END_DATE_FORMAT));

		const condition = {
			driver_id: new ObjectId(driverId),
			created: { $gte: startDate, $lte: endDate }
		};

		let dbInstance = getDb();
		const driver_in_out_shifts = dbInstance.collection(Tables.DRIVER_IN_OUT_SHIFTS);
		const driverShiftResult = await driver_in_out_shifts.findOne(condition, {projection: { _id: 1 }});

		if (!driverShiftResult) {
			return { status: Constants.STATUS_ERROR, message: res.__('system.shift_not_found') };
		}

		const shiftId = driverShiftResult._id;

		const insertAbleData = {
			shift_id: new ObjectId(shiftId),
			parent_id: new ObjectId(parentId),
			driver_id: new ObjectId(driverId),
			type,
			event_type: eventType,
			created: getUtcDate()
		};

		if (eventType === Constants.IN_BREAK) {
			insertAbleData.start_time = start_time;
			insertAbleData.duration = duration;
		}

		if (eventType === Constants.END_BREAK) {
			insertAbleData.end_time = end_time;
			insertAbleData.duration = duration;
		}

		if (eventType === Constants.IN_EXCUSE) {
			insertAbleData.start_time = start_time;
		}

		if (eventType === Constants.OUT_EXCUSE) {
			insertAbleData.end_time = end_time;
		}

		const driver_shift_logs = dbInstance.collection(Tables.DRIVER_SHIFT_LOGS);
		await driver_shift_logs.insertOne(insertAbleData);

		return { status: Constants.STATUS_SUCCESS };
	} catch (error) {
		next(error);
	}
};//end saveDriverStatusLogs()

/**
 *  Function is use to save reclaim logs
 *
 * @param req As request Data
 *
 * @return Json
 */
export const saveReclaimLogs = async (req,res,options={})=>{
	try{
		let action 		 =	(options.action)			?	options.action	                    :"";
		let actionTakenBy= 	(options.action_taken_by)	?	new ObjectId(options.action_taken_by)	:"";
		let userId 		 = 	(options.user_id)		    ?	new ObjectId(options.user_id)		    :"";
		let channel 	 = 	(options.channel)			?	options.channel		                :"";
		let currentDate	 =	newDate("",Constants.DATABASE_DATE_FORMAT);
		let fromDate	 = 	newDate(currentDate+" "+Constants.START_DATE_TIME_FORMAT);
		let toDate 		 =  newDate(currentDate+" "+Constants.END_DATE_TIME_FORMAT);

		if(!action || !userId || !actionTakenBy){
			/** Send error response */
			return {
				status	: 	Constants.STATUS_ERROR,
				message	:	res.__("admin.system.missing_parameters")
			};
		}

		/** Set insertable data */
		let insertAbleData = {
			$set : {
				action_taken_by	: 	actionTakenBy,
				action		    :	action,
				channel		    : 	channel,
			},
			$setOnInsert : {
				user_id  :	userId,
				created	 :	getUtcDate()
			}
		};

		/** Set conditions */
		let conditions = { _id: new ObjectId()};

		if(action == Constants.RECLAIM_LOGS_VERIFY_MOBILE_ACTION || action == Constants.RECLAIM_LOGS_VERIFY_EMAIL_ACTION){
			conditions = {
				user_id : userId,
				action	: action,
				created : { $gte: fromDate, $lte: toDate}
			};
			insertAbleData['$inc'] = {retry_count : 1};
			insertAbleData['$setOnInsert'].expiry_date = getUtcDate(addDate(Constants.VERIFY_EXPIRE_DAY*Constants.HOURS_IN_A_DAY));

			if(options.reset_tries){
				insertAbleData['$inc'].reset_tries = 1;
			}
			if(options.otp){
				insertAbleData['$set'].otp = options.otp;
			}

			insertAbleData['$set'].function = options.function;
			if(typeof options.status != typeof undefined){
				insertAbleData['$set'].status = options.status;
			}
		}

		/** Save customer reclaim details **/
		let dbInstance = getDb();
		const user_accounts_logs = dbInstance.collection(Tables.USER_ACCOUNTS_LOGS);
		await user_accounts_logs.updateOne(conditions,insertAbleData,{upsert: true});

		/** Send success response */
		return {status: Constants.STATUS_SUCCESS};
	}catch(e){
		console.error("Error in saveReclaimLogs:", e);

		/** Send error response */
		return {
			status	: 	Constants.STATUS_ERROR,
			message	:	res.__("admin.system.something_going_wrong_please_try_again")
		};
	}
};//End saveReclaimLogs()

/**
 * Function to save payment gateway logs
 *
 * @param req		As Request Data
 * @param res		As Response Data
 * @param next		As Callback argument to the middleware function
 *
 * @return json
 */
export const savePaymentGatewayLogs = (req,res,next,options={})=>{
	return new Promise(async resolve=>{
		let logId = (options.log_id) ? new ObjectId(options.log_id)	:new ObjectId();

		/** Set insert-able data */
		let insertAbleData = {
			$set : {
				order_id 		:	new ObjectId(options.order_id),
				request			:	options.request,
				response		:	options.response,
				gateway_type	:	options.type,
				gateway_event	:	options.event,
				modified		:	getUtcDate(),
			},
			$setOnInsert: {
				created : getUtcDate()
			},
		};

		if(options.extra_perms) 	insertAbleData["$set"].extra_perms 	=	options.extra_perms;
		if(options.crv_response)	insertAbleData["$set"].crv_response	= 	options.crv_response;

		/** Save payment gateway logs  **/
		let dbInstance = getDb();
		const payment_gateway_logs = dbInstance.collection(Tables.PAYMENT_GATEWAY_LOGS);
		await payment_gateway_logs.updateOne({_id: logId,},insertAbleData,{upsert: true});

		return resolve({status: Constants.STATUS_SUCCESS});
	}).catch(next);
};//End savePaymentGatewayLogs()

/**
 *  Function is save user activity
 *
 * @param req As request Data
 *
 * @return Json
 */
export const saveUserActivity = (req,res,options)=>{
	return new Promise(resolve=>{
		let userId 				=	(options.user_id)				?	options.user_id				:"";
		let parentType 			= 	(options.parent_type)			?	options.parent_type			:"";
		let parentId 			= 	(options.parent_id)				?	options.parent_id			:"";
		let activityType 		= 	(options.activity_type)			?	options.activity_type		:"";
		let additionalDetails 	= 	(options.additional_details)	?	options.additional_details	:"";
		let isNotObjectId 		= 	(options.is_not_objectId)		?	options.is_not_objectId		:false;
		parentId				=	(parentId.constructor !== Array)?	[parentId]					:parentId;

		if(!userId || !parentType || !parentId || !activityType || parentId.length <=0){
			/** Send error response */
			return resolve({
				status	: 	Constants.STATUS_ERROR,
				message	:	res.__("admin.system.missing_parameters")
			});
		}

		try{
			/** Convert into object id */
			if(!isNotObjectId) parentId = arrayToObject(parentId);

			/** Set insertable data */
			let insertAbleData = {
				user_id 			:	new ObjectId(userId),
				parent_type			:	parentType,
				parent_id			: 	parentId,
				activity_type		: 	activityType,
				created				:	getUtcDate()
			}

			if(additionalDetails) insertAbleData.additional_details = additionalDetails;

			/** Save user activities details **/
			const user_activities = getDb().collection(Tables.USER_ACTIVITIES);
			user_activities.insertOne(insertAbleData).then(()=>{
				/** Send success response */
				resolve({status: Constants.STATUS_SUCCESS});
			}).catch(next);
		}catch(e){
			/** Send error response */
			return resolve({
				status	: 	Constants.STATUS_ERROR,
				message	:	res.__("admin.system.something_going_wrong_please_try_again")
			});
		}
	});
};//End saveUserActivity()

/**
 *  Function is save restaurant assignment logs
 *
 * @param req 	As 	Request Data
 * @param res 	As 	Response Data
 * @param next 	As 	Callback argument to the middleware function
 *
 * @return Json
 */
export const restaurantAssignmentLogs = (req,res,next,options)=>{
	return new Promise(resolve=>{
		try{
			let branchId        = (options.branch_id)	  ?	options.branch_id	    :"";
			let restaurantId	= (options.restaurant_id) ?	options.restaurant_id	:"";
			let authUserId		= (options.user_id)		  ?	options.user_id		    :"";
			let slabData		= (options.slab_data)	  ?	options.slab_data		:[];

			let slabs           = [];
			if(slabData && slabData.length>0){
				slabData.map((data)=>{
					slabs.push({
						min_distance : data.min_distance,
						max_distance : data.max_distance,
						order		 : data.order
					});
				});
			}

			/** Save assignment logs */
			let restaurant_branch_assignment_slabs_logs = getDb().collection(Tables.RESTAURANT_BRANCH_ASSIGNMENT_SLABS_LOGS);
			restaurant_branch_assignment_slabs_logs.insertOne({
				branch_id	   :  new ObjectId(branchId),
				restaurant_id  :  new ObjectId(restaurantId),
				user_id 	   :  new ObjectId(authUserId),
				slabs		   :  slabs,
				created		   :  getUtcDate()
			}).then(()=>{
				/** Send success response */
				resolve({status: Constants.STATUS_SUCCESS});
			}).catch(next);
		}catch(e){

			/** Send error response */
			resolve({
				status	: 	Constants.STATUS_ERROR,
				message	:	res.__("admin.system.something_going_wrong_please_try_again")
			});
		}
	}).catch(next);
};//End restaurantAssignmentLogs()