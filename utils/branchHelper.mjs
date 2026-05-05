
import clone from 'clone';
import Tables from './../config/database_tables.mjs';
import { getDb } from '../config/connection.mjs';
import { getUtcDate } from './dateHelper.mjs';
import { ObjectId } from 'mongodb';
import {each as asyncEach, eachOfSeries } from 'async';
import * as Constants from "../config/global_constant.mjs";

/**
 *  Function to arrange area setting fields for branch area
 *
 * @param attributeId as value of attribute id
 * @param attributeValue as value of attribute
 *
 * @return Object
 */
export const setBranchAreaFields = (attributeId,attributeValue)=>{
	let branchAreaFields= null;

	switch(attributeId){
		case Constants.DELIVERY_ATTRIBUTE_ID:
			branchAreaFields = {delivery_by : attributeValue};
		break;
		case Constants.DELIVERY_DURATION_ATTRIBUTE_ID:
			branchAreaFields = {delivery_time : (attributeValue) ? parseFloat(attributeValue) :""};
		break;
		case Constants.MINIMUM_ORDER_LIMIT_ATTRIBUTE_ID:
			branchAreaFields = {minimum_order_limit: (attributeValue) ? parseFloat(attributeValue) :0};
		break;
		case Constants.DELIVERY_FEES_ATTRIBUTE_ID:
			branchAreaFields = {delivery_fees : (attributeValue) ? parseFloat(attributeValue) :0};
		break;
		case Constants.ACCEPT_SCHEDULING_ATTRIBUTE_ID:
			branchAreaFields = {accept_scheduling_orders : (attributeValue) ? parseInt(attributeValue) :0};
		break;
		case Constants.PREPARATION_TIME_ATTRIBUTE_ID:
			branchAreaFields = {preparation_time : (attributeValue) ? parseFloat(attributeValue) :0};
		break;
		case Constants.ACCEPT_PICKUP_ORDER:
			branchAreaFields = {accept_pickup_orders : (attributeValue) ? parseInt(attributeValue) :0};
		break;
		case Constants.HAS_OFFERS_ATTRIBUTE_ID:
			branchAreaFields = {has_offers : (attributeValue) ? parseInt(attributeValue) :0};
		break;
		case Constants.TRENDS_ATTRIBUTE_ID:
			branchAreaFields = {trends : (attributeValue) ? parseFloat(attributeValue) :0};
		break;
		case Constants.MORNING_PROFILE_ATTRIBUTE_ID:
			branchAreaFields = {morning_profile: (attributeValue) ? parseFloat(attributeValue) :0};
		break;
		case Constants.EVENING_PROFILE_ATTRIBUTE_ID:
			branchAreaFields = {evening_profile: (attributeValue) ? parseFloat(attributeValue) :0};
		break;
		case Constants.DELIVERY_VEHICLE_TYPE_ATTRIBUTE_ID:
			if(!attributeValue) attributeValue = [];
			if(attributeValue.constructor != Array) attributeValue = [attributeValue];
			branchAreaFields = {delivery_vehicle_type: attributeValue };
		break;
		case Constants.DRIVER_SELECTION_TYPE_ATTRIBUTE_ID:
			branchAreaFields = {driver_selection_type: attributeValue};
		break;
	}
	return branchAreaFields;
}// End setBranchAreaFields()

/**
 *  Function to arrange area setting fields for branch area
 *
 * @param attributeId as value of attribute id
 * @param attributeValue as value of attribute
 *
 * @return Object
 */
export const setBranchAreaAttributes = (attributeId,attributeValue)=>{
	let branchAttributeFields= null;
	switch(attributeId){
		case Constants.SLOGAN_ENGLISH_ATTRIBUTE_ID:
			branchAttributeFields = {slogan_in_english : attributeValue};
		break;
		case Constants.SLOGAN_ARABIC_ATTRIBUTE_ID:
			branchAttributeFields = {slogan_in_arabic : attributeValue};
		break;
		case Constants.BRANCH_ACCEPTS_CASHBACK_PAYMENT_ATTRIBUTE_ID:
			branchAttributeFields = {accepts_cashback_payment : (attributeValue) ? parseInt(attributeValue) :0};
		break;
	}
	return branchAttributeFields;
}// End setBranchAreaAttributes()


/**
 * Function to get branch details using branch id
 *
 * @param req		As 	Request Data
 * @param res		As 	Response Data
 * @param branchId	As	Branch id(DB ObjectId)
 *
 * @return message
 */
export const getBranchDetails = (req,res,next,branchId)=>{
	return new Promise(async resolve=>{
		/** Get branch details by branch id */
		const dbInstance  = getDb();
		let branchData = await dbInstance.collection(Tables.RESTAURANT_BRANCHES).findOne({_id: new ObjectId(branchId)});

		/** Send response */
		resolve(branchData || {});
	}).catch(next);
}//getBranchDetails()

/**
 *  Function is copy details one table another table
 *
 * @param req 	As 	Request Data
 * @param res 	As 	Response Data
 * @param next 	As 	Callback argument to the middleware function
 *
 * @return Json
 */
export const copyFromParentTable = (req,res,next,options)=>{
	return new Promise(async resolve=>{
		try{
			let parentTable =	(options.parent_table)	?	options.parent_table	:"";
			let childTable	=	(options.child_table)	?	options.child_table		:"";
			let type		=	(options.type)			?	options.type			:"";

			if(
				!parentTable ||
				!childTable ||
				parentTable.constructor !== Object ||
				childTable.constructor !== Object ||
				Object.keys(parentTable).length <=0 ||
				Object.keys(childTable).length <=0 ||
				!parentTable.name ||
				!parentTable.conditions ||
				!parentTable.fields ||
				!childTable.name ||
				!childTable.conditions
			){
				/** Send error response */
				return resolve({
					status	: 	Constants.STATUS_ERROR,
					message	:	res.__("admin.system.missing_parameters")
				});
			}

			const db = getDb();
			const parentCollections = db.collection(parentTable.name);
			const childCollections  = db.collection(childTable.name);

			/** Get parent table details **/
			let parentResults = await parentCollections.find(parentTable.conditions,{ projection: parentTable.fields}).toArray();

			if(parentResults.length == 0) return resolve({ status: Constants.STATUS_SUCCESS });

			if(type == "update_restaurant_branch_assignment_slabs"){
				/** Remove parent table records in branch assignment slabs */
				await childCollections.deleteMany(childTable.conditions);
			}

			eachOfSeries(parentResults,(records, firstKey, parentCallback)=>{
				let result = clone(records);

				/** Append or overwrite values in parent details */
				if(childTable.additional_fields && Object.keys(childTable.additional_fields).length >0){
					result = Object.assign(result,childTable.additional_fields);
				}

				/** Set update data */
				let updateData = {};
				if((type == "update_branch_phone_numbers" || type == "update_branch_calendar" || childTable.multiple) && result._id){
					childTable.conditions._id = new ObjectId(result._id);
					delete result._id;
				}

				if(type == "update_branch_attributes" && result.attribute_id){
					childTable.conditions.attribute_id = result.attribute_id;
				}

				if(type == "update_branch_areas"  && result.area_id){
					childTable.conditions.area_id = new ObjectId(result.area_id);
				}

				if(type == "update_restaurant_branch_area_settings" && result.area_id && result.attribute_id){
					childTable.conditions.area_id 		= 	new ObjectId(result.area_id);
					childTable.conditions.attribute_id 	=	result.attribute_id;
				}

				if(type == "approve_branch_payment_methods" && result.payment_methods){
					let tempPaymentMethods  = (result.payment_methods) ? result.payment_methods :[];
					delete result.payment_methods;

					updateData["$addToSet"]	=	{payment_methods: {$each :tempPaymentMethods}};
				}

				updateData["$set"] = result;

				if(type == "insert_in_tmp_restaurant_branches" || type == "insert_in_tmp_restaurant_branch_areas"){
					let dataToBeUpdated = {modified: getUtcDate()};
					if(childTable.extra_fields && Object.keys(childTable.extra_fields).length >0){
						dataToBeUpdated = Object.assign(dataToBeUpdated,childTable.extra_fields);
					}
					updateData = {
						$set : dataToBeUpdated,
						$setOnInsert: result
					};
				}

				if(type == "update_restaurant_branch_assignment_slabs"){
					childTable.conditions.restaurant_id = 	new ObjectId(result.restaurant_id);
					updateData = {
						$set : {
							min_distance	:	parseFloat(result.min_distance),
							max_distance	:	parseFloat(result.max_distance),
							order			:	parseInt(result.order),
							modified		:	getUtcDate()
						},
						$setOnInsert : {created	: getUtcDate()}
					};

					if(result.added_by) updateData["$set"].added_by	= result.added_by;
				}

				/**update on approve menu */
				if(type == "update_restaurant_menus" ){
					updateData["$unset"]	= {status: 1};
				}

				/**update on approve item */
				if(type == "update_branch_items" ){
					updateData["$unset"] = {status: 1};
				}


				/** set condition approval for restuarant branches cuisines */
				if(type == "approve_restaurant_branch_cuisines" && result.cuisine_id){
					childTable.conditions.cuisine_id = new ObjectId(result.cuisine_id);
				}

				/** save child table details */
				const childCollections = db.collection(childTable.name);
				childCollections.updateOne(childTable.conditions,updateData,{upsert: true}).then(()=> {
					parentCallback(null);
				}).catch(next);
			},(asyncErr)=>{
				if(asyncErr){
					/** Send error response */
					return resolve({
						status	: 	Constants.STATUS_ERROR,
						message	:	res.__("admin.system.something_going_wrong_please_try_again")
					});
				}

				if(!parentTable.remove_original) return resolve({ status: Constants.STATUS_SUCCESS });

				/** Remove parent table records */
				parentCollections.deleteMany(parentTable.conditions).then(()=> {
					return resolve({ status	: Constants.STATUS_SUCCESS });
				}).catch(next);
			});
		}catch(e){
			console.log("Error in copyFromParentTable branchHelper.mjs ",e);

			/** Send error response */
			resolve({
				status	: 	Constants.STATUS_ERROR,
				message	:	res.__("admin.system.something_going_wrong_please_try_again")
			});
		}
	}).catch(next);
};//End copyFromParentTable()

/**
 * Function to save restaurant branch logs
 *
 * @param req 	As Request Data
 * @param res 	As Response Data
 * @param next 	As Callback argument to the middleware function
 *
 * @return null
 */
export const saveRestaurantBranchLogs = (req,res,next,options)=>{
	return new Promise(resolve=>{
		/** Set data to be saved */
		let dataToBeSaved = {
			branch_id		: options?.branch_id  && new ObjectId(options.branch_id) || "",
			restaurant_id	: options?.restaurant_id && new ObjectId(options.restaurant_id) || "",
			user_id			: options?.user_id  && new ObjectId(options.user_id) || "",
			user_role		: options?.user_role || "",
			action 			: options?.action && Constants.BRANCH_LOG_STATUS[options?.action] || "",
			created  		: getUtcDate()
		};

		if(options?.channel_id) dataToBeSaved.channel_id = options.channel_id;

		/** Save restaurant branch logs */
		const restaurantBranchLogs	= getDb().collection(Tables.RESTAURANT_BRANCH_LOGS);
		restaurantBranchLogs.insertOne(dataToBeSaved).then(()=>{
			resolve({status : Constants.STATUS_SUCCESS});
		}).catch(next);
	}).catch(next);
};//End saveRestaurantBranchLogs()

