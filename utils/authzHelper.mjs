import { ObjectId } from 'mongodb';

import { newDate, subtractDate } from './dateHelper.mjs';
import { arrayToObject } from './arrayHelper.mjs';
import * as Constants from "../config/global_constant.mjs";
import { getDb } from '../config/connection.mjs';
import Tables from '../config/database_tables.mjs';
import myCache from '../cache.mjs';
import {ADMIN_PERMISSION_CLASSES, PERMISSION_CLASSES }from "../permissions.mjs";

/**
 * Function to get area ids based on fleet role
 *
 *  @param req		As	Request Data
 * @param res		As 	Response Data
 * @param next		As	Callback argument to the middleware function
 * @param options	As	Request params
 *
 * @return json
 */
export const getAreaIdsBasedOnFleetRole = async (req,res,next)=>{
	try {
		let authId 		=	req?.session?.user?._id || '';
		let startDate 	= 	newDate(newDate('', Constants.CURRENTDATE_START_DATE_FORMAT));
		let endDate 	=	newDate(newDate('', Constants.CURRENTDATE_END_DATE_FORMAT));
		let dbInstance 	=	getDb();

		const areaIds = dbInstance.collection(Tables.FLEET_AREAS).distinct('area_ids', {
			user_id: new ObjectId(authId),
			date: { $gte: startDate, $lte: endDate },
		});

		return areaIds || [];
	} catch (e) {
		console.error("Error at getAreaIdsBasedOnFleetRole utility ",e);
		return [];
	}
};//end getAreaIdsBasedOnFleetRole()

/**
 * Function to get driver ids based on fleet role
 *
 *  @param req		As	Request Data
 * @param res		As 	Response Data
 * @param next		As	Callback argument to the middleware function
 * @param options	As	Request params
 *
 * @return json
 */
export const getDriverIdsBasedOnFleetRole = async (req,res,next)=>{
	try {
		let startDate 	= 	newDate(newDate('', Constants.CURRENTDATE_START_DATE_FORMAT));
		let endDate 	=	newDate(newDate('', Constants.CURRENTDATE_END_DATE_FORMAT));
		let dbInstance 	=	getDb();
		let driverIds;

		const areaIds = await getAreaIdsBasedOnFleetRole(req,res,next);

		if(areaIds.length){
			driverIds = dbInstance.collection(Tables.DRIVER_AVAILABILITIES).distinct('user_id', {
				date: { $gte: startDate, $lte: endDate },
				area_id: { $in: arrayToObject(areaIds) }
			});
		}

		return driverIds || [];
	} catch (e) {
		console.error("Error at getDriverIdsBasedOnFleetRole utility ",e);
		return [];
	}
};//end getDriverIdsBasedOnFleetRole()


/**
 * Function is used to get permission classes
 *
 * @param classes as a array
 *
 * @return class name
 */
export const getPermissionClass = (moduleType,classes) => {
	if(moduleType == Constants.MODULE_TYPE_ADMIN){
		let data = ADMIN_PERMISSION_CLASSES;
		classes.map((tempClass)=>{
			data = data[tempClass];
		});
		return data+" hideMe permission_classes";
	}else{
		let data = PERMISSION_CLASSES;
		classes.map((tempClass)=>{
			data = data[tempClass];
		});

		return data+" hideMe permission_classes";
	}
}// getPermissionClass();

/**
 * function is used to update user wise module flag
 *
 * @param userId as User Id
 * @param data as Data to be updated
 * @param type as update Type : delete/add/get
 *
 * @return regular expression
 */
export const userModuleFlagAction = (userId, data, type) => {
	try {
		let adminModulesList = myCache.get("admin_modules_list") || {};

		switch(type) {
			case "add":
				adminModulesList[userId] = data;
				myCache.set("admin_modules_list", adminModulesList, 0);
				return true;

			case "delete":
				delete adminModulesList[userId];
				myCache.set("admin_modules_list", adminModulesList, 0);
				return true;

			case "get":
				return adminModulesList[userId] || null;

			default:
				console.warn(`Invalid type '${type}' provided to userModuleFlagAction`);
				return null;
		}
	} catch (error) {
		console.error("Error in userModuleFlagAction:", error);
		return null;
	}
}//end userModuleFlagAction

/**
 * Function to get conditions based on call center role
 *
 *  @param req		As	Request Data
 * @param res		As 	Response Data
 * @param next		As	Callback argument to the middleware function
 * @param options	As	Request params
 *
 * @return json
 */
export const getConditionsBasedOnCallCenterRole = async (req,res,next)=>{
	try {
		let authId 		=	req?.session?.user?._id || '';
		let startDate 	= 	newDate(newDate('', Constants.CURRENTDATE_START_DATE_FORMAT));
		let endDate 	=	newDate(newDate('', Constants.CURRENTDATE_END_DATE_FORMAT));
		let dbInstance 	=	getDb();

		let taskList = await dbInstance.collection(Tables.TASK_ASSIGNMENTS).find({
			agent_id	: new ObjectId(authId),
			$or			:	[
				{$and : [
					{from_date : {$gte : startDate } },
					{to_date   : {$lte : endDate} }
				]},
				{$and : [
					{ to_date   : {$gte : startDate} },
					{ from_date : {$lte : endDate} }
				]}
			]
		},{projection: {business_rule:1}}).toArray();

		let taskConditions = [];
		let businessRule ={};
		if(taskList?.length){
			taskList.forEach(records=>{
				if(records.business_rule && records.business_rule.length >0){
					records.business_rule.forEach(key=>{
						businessRule[key] = key;
					});
				}
			});

			if(Object.keys(businessRule)?.length){
				taskConditions = getTaskAssignmentConditions(businessRule);
			}
		}

		return {conditions: taskConditions || [], rules: businessRule};
	} catch (e) {
		console.error("Error at getConditionsBasedOnCallCenterRole utility ",e);
		return {conditions: [], rules: {}};
	}
};//end getConditionsBasedOnCallCenterRole()

/**
 * Function to get task assignment conditions
 *
 * @param rules	As	Assignment rules
 *
 * @return json
 */
export const getTaskAssignmentConditions = (rules={})=>{
	try {
		if(!rules || rules.constructor != Object || Object.keys(rules).length <=0) return [];

		let taskConditions = [];
		Object.keys(rules).forEach(records=>{
			switch(records){
				case rules[Constants.FIRST_ORDERS]:
					taskConditions.push({is_first_order: true,admin_status: Constants.ORDER_PENDING});
				break;
				case rules[Constants.DUPLICATE_ORDERS]:
					taskConditions.push({is_duplicate_order: true,admin_status: Constants.ORDER_PENDING});
				break;
				case rules[Constants.DELAYED_ORDERS]:
					taskConditions.push({is_delayed_orders:true});
				break;
				case rules[Constants.TICKETING]:
					taskConditions.push({ticketing:true});
				break;
				case rules[Constants.BIG_ORDERS]:
					taskConditions.push({is_big_order:true,admin_status: Constants.ORDER_PENDING});
				break;
				case rules[Constants.REJECTED_ORDERS]:
					taskConditions.push({admin_status : {$in : [Constants.ORDER_REJECTED, Constants.ORDER_REJECTED_BY_ADMIN]}});
				break;
				case rules[Constants.DELAYED_ACCEPTANCE]:
					taskConditions.push({is_delayed_acceptance:true, "confirm_status.is_delayed_acceptance" :{$exists :false} });
				break;
				case rules[Constants.CRAVEZ_DELIVERY_MONITORING]:
					taskConditions.push({delivery_type : Constants.DELIVERY_BY_CRAVEZ});
				break;
				case rules[Constants.RESTAURANT_DELIVERY_MONITORING]:
					taskConditions.push({delivery_type : Constants.DELIVERY_BY_RESTAURANT});
				break;
				case rules[Constants.DELAYED_PICKUP_BY_CUSTOMER]:
					taskConditions.push({is_delayed_picked_up_by_customer : true, "confirm_status.is_delayed_picked_up_by_customer" :{$exists :false} });
				break;
				case rules[Constants.DELAYED_PICKUP_BY_RESTAURANT]:
					taskConditions.push({is_delayed_pickup : true, delivery_type : Constants.DELIVERY_BY_RESTAURANT, "confirm_status.delayed_pickup_by_restaurant" :{$exists :false} });
				break;
				case rules[Constants.DELAYED_PICKUP_BY_CAPTAIN]:
					taskConditions.push({is_delayed_pickup_by_captain : true, "confirm_status.is_delayed_pickup_by_captain" :{$exists :false} });
				break;
				case rules[Constants.VIP_ORDERS]:
					taskConditions.push({is_vip : true});
				break;
				case rules[Constants.DELAYED_PREPARATION]:
					taskConditions.push({is_delayed_preperation : true, "confirm_status.is_delayed_preperation" :{$exists :false} });
				break;
				case rules[Constants.DELAYED_IN_DELIVERY]:
					taskConditions.push({is_delayed_delivery : true, "confirm_status.is_delayed_delivery" :{$exists :false} });
				break;
			}
		});
		return taskConditions;
	} catch (e) {
		console.error("Error at getTaskAssignmentConditions utility ",e);
		return [];
	}
};//end getTaskAssignmentConditions()

/** Function to get role wise field name */
export const getRoleFieldName = (role)=>{
	if([Constants.RESTAURANT,Constants.BRANCH_EMPLOYEE,Constants.BRANCH_MANAGER].includes(role)){
		return "is_store";
	}else if([Constants.CRAVEZ,Constants.FLEET,Constants.CONTENT_TEAM,Constants.QA_TEAM,Constants.CALL_CENTER_TEAM,Constants.SALES_TEAM,Constants.MARKETING_TEAM,Constants.BACK_OFFICE_TEAM,Constants.SUPERVISOR,Constants.FINANCE_TEAM].includes(role)){
		return "is_admin";
	}else if([Constants.CUSTOMER].includes(role)){
		return "is_customer";
	}else if([Constants.DRIVER].includes(role)){
		return "is_driver";
	}else{
		return "";
	}
}//end getRoleFieldName()

/**
 * Function to get ticket category ids based on role
 *
 *  @param req		As	Request Data
 * @param res		As 	Response Data
 * @param next		As	Callback argument to the middleware function
 * @param options	As	Request params
 *
 * @return json
 */
export const getTicketCategoryIdsBasedOnRole = async (req,res,next)=>{
	try {
		let dbInstance 	=	getDb();
		let authUserId 	= 	new ObjectId(req.session.user._id);

		/** Get assign category list */
		const users 	= dbInstance.collection(Tables.USERS);
		const userResult = await users.findOne({_id: authUserId },{projection: { ticket_category_ids:1 }});
		let categoryList = userResult?.ticket_category_ids || null;

		return categoryList
	} catch (e) {
		console.error("Error at getTicketCategoryIdsBasedOnRole utility ",e);
		return [];
	}
};//end getTicketCategoryIdsBasedOnRole()


/**
 * Function to get department name
 *
 * @param req 		As 	Request Data
 * @param res 		As 	Response Data
 * @param next		As	Callback argument to the middleware function
 * @param options	As	Object data
 *
 * @return render/json
 */
export const getDepartmentName = async (req,res,options)=>{
	try {
		let dbInstance 	=	getDb();
		let department  =  options?.department || "";

		/** Send error response without department */
		if(!department) return {status: Constants.STATUS_ERROR, message: res.__("admin.system.something_going_wrong_please_try_again")};

		/** Get Role name */
		const roleResult = await dbInstance.collection(Tables.ADMIN_ROLES).findOne(
			{_id: new ObjectId(department)},
			{projection: { role_name:1}}
		);

		/** Send error response without role name */
		if(!roleResult) return {status: Constants.STATUS_ERROR, message: res.__("admin.system.something_going_wrong_please_try_again")};

		/** Send success response */
		return {status: Constants.STATUS_SUCCESS, result: roleResult};
	} catch (e) {
		console.error("Error at getDepartmentName utility ",e);
		return {status: Constants.STATUS_ERROR, message: res.__("admin.system.something_going_wrong_please_try_again")};
	}
};//end getDepartmentName()

/**
 * Function to check number valid
 *
 * @param req	As Request Data
 * @param res	As Response Data
 * @param next	As Callback argument to the middleware function
 *
 * @return json
**/
export const checkNumberValid = (req,res,next,options={})=>{
	let mobileNumber	=	(options.mobile_number) ? options.mobile_number 	: '';

	let isMobileError		=	false;
	let allowedMobilePrefix	=	res?.locals?.settings?.["Site.allowed_mobile_prefix"]?.split(',') || [];
	if(mobileNumber && allowedMobilePrefix && allowedMobilePrefix.length > 0){
		allowedMobilePrefix.map(prefix=>{
			let length		=	prefix.length;
			let firstChar	=	(mobileNumber) ? mobileNumber.substring(0,length) : '';
			if(allowedMobilePrefix.indexOf(firstChar) == -1) isMobileError	=	true;
		});
	}

	let errorArray	=	[];
	if(mobileNumber && isMobileError) errorArray.push({ param : "mobile_number", msg : res.__("admin.user_management.mobile_number_should_start_with",allowedMobilePrefix.join(','))});

	if(errorArray.length > 0) return {status: Constants.STATUS_ERROR, errors : errorArray};
	return {status : Constants.STATUS_SUCCESS};
}; // end checkNumberValid()

/**
 *  Function to all driver ids who have shift
 *
 * @param req 	As	Request Data
 * @param res 	As	Response Data
 * @param next 	As	Callback argument to the middleware function
 *
 * @return response
 */
export const getAllDriverIdsWhoHaveShift = (req,res,next,options)=>{
	return new Promise(resolve=>{
		let areaIds			=	(options && options.area_ids) ? arrayToObject(options.area_ids) :"";
		let prevStartDate 	=	newDate(newDate(subtractDate(Constants.HOURS_IN_A_DAY),Constants.CURRENTDATE_START_DATE_FORMAT));
		let startDate 		=	newDate(newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));
		let endDate 		=	newDate(newDate("",Constants.CURRENTDATE_END_DATE_FORMAT));
		let dbInstance 		=	getDb();

		/** Set Conditions */
		let conditions = {
			date 	 : {$gte: prevStartDate, $lte: endDate},
			shift_id : {$nin: ["", null]}
		};

		if(areaIds) conditions.area_id = {$in: areaIds};

		/** Get driver ids who have shift */
		const driver_availabilities	= dbInstance.collection(Tables.DRIVER_AVAILABILITIES);
		driver_availabilities.aggregate([
			{$match	: conditions},
			{$lookup:	{
				from     : 	Tables.SHIFTS,
				let      :	{shiftId : "$shift_id"},
				as		 :	"shift_details",
				pipeline :	[
					{$match: {
						$expr: {
							$and : [
								{$eq: ["$_id", "$$shiftId"]},
							]
						}
					}},
					{$project:{
						is_next_day : {$cond: [
							{$and: [
								{ $gt : ["$start_time","$end_time"] },
							]},
							true,
							false
						]},
					}},
				],
			}},
			{$match	: {
				$or: [
					{"shift_details.is_next_day" : true},
					{date : {$gte: startDate }},
				]
			}},
			{$group	: {
				_id		: 	null,
				user_id	:	{$addToSet: "$user_id"}
			}},
		]).toArray().then((shiftResult)=>{

			/** Send success response */
			resolve({
				status		: Constants.STATUS_SUCCESS,
				driver_ids	: shiftResult?.[0]?.user_id || []
			});
		}).catch(next);
	}).catch(next);
};//End getAllDriverIdsWhoHaveShift()

/**
 * Function is used to identify request is from admin or restaurant (function created for model files)
 *
 *  @param req		As	Request Data
 *  @param res		As 	Response Data
 *
 * @return class name
 */
export const isAdmin = (req,res)=>{
	if(res.locals.module_type == Constants.MODULE_TYPE_ADMIN) return true;
	return false;
}// isAdmin();

/**
 * Function is used to identify request is from admin or restaurant (function created for view files)
 *
 * @param moduleType as module type
 *
 * @return class name
 */
export const isRestaurant = (moduleType)=>{
	if(moduleType == Constants.MODULE_TYPE_RESTAURANT) return true;
	return false;
}// isRestaurant();