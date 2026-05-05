import { ObjectId } from 'mongodb';
import { parallel as asyncParallel } from 'async';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from '../../../../utils/index.mjs';
import {sendMailToUsers, saveDriverStatusLogs} from '../../../../services/index.mjs';
import { inOutShiftValidation, postServiceValidation } from '../validations/driver_breaks.mjs';

export default class DriverBreaks {
    constructor(db) {
        this.db = db;
    }

	/**
	 * Function to update driver breaks
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async updateDriverBreaks (req,res,next){
		return new Promise(resolve=>{
			let type 	= (req.body.type)    ? req.body.type 			  : "";
			let userId  = (req.body.user_id) ? new ObjectId(req.body.user_id) : "";

			/** Send error response **/
			if(!type || !userId) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			/** For check type */
			if(Constants.DRIVER_BREAK_TYPE.indexOf(type) == -1 ) return resolve({status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access")});

			let currentDate = Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));

			/** For get driver breaks details */
			const driver_breaks = this.db.collection(Tables.DRIVER_BREAKS);
			driver_breaks.findOne({
				driver_id    : userId,
				date         : {$gte: currentDate},
				is_completed : false
			},{projection: {_id: 1,status: 1, start_time: 1,duration:1}}).then(findResult=>{

				/** Send  error response when any running break found */
				if(findResult && type == Constants.IN_BREAK) return resolve({status: Constants.STATUS_ERROR, message: res.__("driver_breaks.break_is_already_in_running")});

				if(type == Constants.END_BREAK){
					/** Send  error response when any running break not found */
					if(!findResult) return resolve({status: Constants.STATUS_ERROR, message: res.__("driver_breaks.you_have_not_taken_any_break_yet")});

					/** Send error response when break not approved */
					if(findResult.status != Constants.APPROVED) return resolve({status: Constants.STATUS_ERROR, message: res.__("driver_break.break_is_not_approved_yet_you_cannot_end_this_break")});
				}

				if(type == Constants.IN_BREAK){
					/** Set insert-able data */
					let insertAbleData = {
						break_type  		: 	new ObjectId(Constants.BREAK),
						date				: 	Helpers.getUtcDate(currentDate),
						duration_in_minutes : 	"",
						duration			: 	"",
						start_time  		: 	"",
						end_time    		: 	"",
						status				: 	Constants.PENDING,
						driver_id   		: 	userId,
						is_completed		: 	false,
						created				: 	Helpers.getUtcDate(),
						modified			:	Helpers.getUtcDate()
					};

					/** Save driver breaks details */
					driver_breaks.insertOne(insertAbleData).then(insertResult=>{

						/**Send success response */
						resolve({status	: Constants.STATUS_SUCCESS, message: res.__("driver_break.break_has_been_added_successfully")});

						/*************** Send Mail  ***************/
							sendMailToUsers(req,res,{
								event_type 		:	Constants.DRIVER_BREAK_REQUEST_POSTED_EMAIL_EVENTS,
								break_id		: 	insertResult.insertedId,
								user_id			: 	userId,
								break_details	: 	insertAbleData
							});
						/*************** Send Mail  ***************/
					}).catch(next);
				}else if(type == Constants.END_BREAK){
					/** Get break end time **/
					let startTime 	= 	(findResult.start_time) ? String(Helpers.set24HourFormat(findResult.start_time)).replace('.',':') :"";
					let endTime 	=	Helpers.newDate("",Constants.BREAK_TIME_FORMAT);
					let breakStart	=	new Date(Helpers.newDate("",Constants.DATABASE_DATE_FORMAT+' '+startTime));
					let breakEnd	= 	new Date(Helpers.newDate("",Constants.DATABASE_DATE_FORMAT+' '+endTime));
					let difference	= 	Math.ceil((breakEnd - breakStart)/Constants.MILLISECONDS_IN_A_SECOND);
					endTime 		=	parseFloat(endTime.replace(':','.'));
					let endTimeStamp=	Helpers.newDate().getTime();

					/** update driver breaks details */
					driver_breaks.updateOne({
						driver_id 	 :	userId,
						is_completed : 	false,
						status		 : 	Constants.APPROVED,
						date         : 	{$gte: currentDate}
					},
					{$set: {
						is_completed : 	true,
						end_time     : 	endTime,
						end_timestamp:	endTimeStamp,
						elapsed_time :	difference,
						duration     :	difference,
						modified	 :	Helpers.getUtcDate()
					}}).then(()=>{

						/**Send success response */
						resolve({status: Constants.STATUS_SUCCESS, message: res.__("driver_break.break_has_been_ended_successfully")});

						/*************** Send Mail  ***************/
							sendMailToUsers(req,res,{
								event_type 		:	Constants.DRIVER_BREAK_REQUEST_ENDED_EMAIL_EVENTS,
								break_id		: 	findResult._id,
								user_id			: 	userId,
							});
						/*************** Send Mail  ***************/

						/** Save driver status logs */
						saveDriverStatusLogs(req,res,next,{
							parent_id 	: 	findResult._id,
							driver_id 	: 	userId,
							type	  	: 	Tables.DRIVER_BREAKS,
							event_type	: 	Constants.END_BREAK,
							end_time	: 	endTime,
							duration	:	difference
						});
					}).catch(next);
				}
			}).catch(next);
		}).catch(next);
	}// end updateDriverBreaks()

	/**
	 * Function to get latest break
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getBreaks (req,res,next){
		return new Promise(resolve=>{
			let userId  = (req.body.user_id) ? new ObjectId(req.body.user_id) : "";

			/** Send error response **/
			if(!userId) return resolve({status:Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			/** Set condition **/
			let currentDate = Helpers.newDate("",Constants.DATABASE_DATE_FORMAT);
			let condition = {
				driver_id 	: userId,
				date      	: { $eq: Helpers.getUtcDate(currentDate+" "+Constants.START_DATE_TIME_FORMAT)},
				is_completed: false
			};

			/** For get driver breaks details */
			const driver_breaks = this.db.collection(Tables.DRIVER_BREAKS);
			driver_breaks.findOne(condition,{
				projection: {
					_id:1,date:1,driver_id:1,start_time:1,end_time:1,duration_in_minutes:1,status:1,rejection_reason:1,is_completed:1
				},
				sort:{
					created:Constants.SORT_DESC
				}
			}).then(findResult=>{

				/** Send success response */
				if(!findResult)	return resolve({status: Constants.STATUS_SUCCESS,message: res.__("system.no_record_found")});

				/** Convert into 24 hours format */
				findResult.end_time 	= 	Helpers.set24HourFormat(findResult.end_time);
				findResult.start_time	=	Helpers.set24HourFormat(findResult.start_time);

				/** Send success response */
				resolve({status	: Constants.STATUS_SUCCESS, result: findResult});
			}).catch(next);
		}).catch(next);
	}// end getBreaks()

	/**
	 * Function to update In Out Shifts
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async updateInOutShifts (req,res,next){
		return new Promise(async resolve=>{
			/** Sanitize Data **/
			req.body 		= 	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let type 		=	(req.body.type)    		?	req.body.type 			  		:"";
			let userId  	= 	(req.body.user_id) 		? 	new ObjectId(req.body.user_id) 		:"";
			let km  		= 	(req.body.km) 	 		? 	parseFloat(req.body.km) 		:"";
			let latitude 	= 	(req.body.latitude)  	? 	parseFloat(req.body.latitude)  	:0;
            let longitude 	= 	(req.body.longitude)	? 	parseFloat(req.body.longitude) 	:0;

			/** Send error response **/
			if(!userId || (type != Constants.IN_SHIFT && type != Constants.OUT_SHIFT) ){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});
			}

			/** Apply validation */
			let validationResponse = await Helpers.applyValidationInterCallFunction(req, res, next, inOutShiftValidation);
			if(validationResponse.status != Constants.STATUS_SUCCESS) return resolve(validationResponse);

			/** Set driver conditions **/
            let driverConditions = {
				_id : userId,
				...Constants.DRIVER_COMMON_CONDITIONS
			};

			const users 				= 	this.db.collection(Tables.USERS);
			const driver_in_out_shifts 	= 	this.db.collection(Tables.DRIVER_IN_OUT_SHIFTS);
			const driver_availabilities =	this.db.collection(Tables.DRIVER_AVAILABILITIES);
			asyncParallel({
				driver_details : (callback)=>{
					/** Get driver details  */
					users.findOne(driverConditions,{projection: {force_active:1,vehicle_type:1,vehicle_id:1,is_suspend:1}}).then(userResult=>{
						callback(null,userResult);
					}).catch(next);
				},
				driver_leave_count : (callback)=>{
					if(type != Constants.IN_SHIFT) return callback(null, 0);

					let startDate= 	Helpers.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT);
					let endDate	= 	Helpers.newDate("",Constants.CURRENTDATE_END_DATE_FORMAT);

					/** Get today user leave count  */
					driver_availabilities.countDocuments({
						user_id : 	userId,
						date 	:	{
							$gte	: 	Helpers.newDate(startDate),
							$lte	:	Helpers.newDate(endDate)
						},
						leave_status:	Constants.APPROVED,
						leave_type 	:	{$exists :true},
					}).then(leaveCount=>{
						callback(null, leaveCount);
					}).catch(next);
				},
				last_shift_details : (callback)=>{
					if(type != Constants.IN_SHIFT) return callback(null, null);

					driver_in_out_shifts.findOne({
						driver_id 	:	userId,
						type 		: 	Constants.OUT_SHIFT,
					},{projection: {km:1, vehicle_type: 1}, sort: {created: Constants.SORT_DESC}}).then(shiftResult=>{
						callback(null,shiftResult);
					}).catch(next);
				}
			},(asyncParentErr, asyncParentResponse)=>{
				if(asyncParentErr) return next(asyncParentErr);

				/** Send error response **/
				if(!asyncParentResponse.driver_details || asyncParentResponse.driver_leave_count) {
					return resolve({
						status 	: Constants.STATUS_ERROR,
						message : (!asyncParentResponse.driver_details) ? res.__("system.invalid_access") :res.__("driver_break.not_allow_in_shift")
					});
				}

				let userResult 	 	= 	asyncParentResponse.driver_details;
				let lastShiftDetails= 	(asyncParentResponse.last_shift_details) ? asyncParentResponse.last_shift_details :{};
				let isSuspend 	 	= 	userResult.is_suspend;
				let forceActive 	=  	userResult.force_active;
				let vehicleId 		=  	userResult.vehicle_id;
				let vehicleType 	=  	(userResult.vehicle_type) ? userResult.vehicle_type :"";
				let isForceActive	=	(forceActive == Constants.FORCE_ACTIVE) ? true :false;
				let userSuspend		=	(isSuspend == Constants.SUSPEND)	?	true :false;
				let tmpErrMsg		=	"";

				/** Check current km is more than last shift out */
				if(type == Constants.IN_SHIFT && lastShiftDetails && lastShiftDetails.km && lastShiftDetails.km > km){
					tmpErrMsg = res.__("driver_break.please_enter_km_greater_then_last_km");
				}

				/** Send error response **/
				if(tmpErrMsg) return resolve({status: Constants.STATUS_ERROR, message: tmpErrMsg });

				let currentTime		= 	parseFloat(Helpers.newDate('',Constants.SHIFT_TIME_FORMAT));
				let currentDate		=	Helpers.newDate("",Constants.DATABASE_DATE_FORMAT);
				let fromDate		= 	Helpers.newDate(currentDate+" "+Constants.START_DATE_TIME_FORMAT);
				let toDate 			=  	Helpers.newDate(currentDate+" "+Constants.END_DATE_TIME_FORMAT);

				const shifts  =	this.db.collection(Tables.SHIFTS);
                asyncParallel({
					check_driver_shift : (callback)=>{
						if(type != Constants.IN_SHIFT) return callback(null,true);

						/** Send response when admin mark force active */
						if(isForceActive) return callback(null,true);

						/** Check driver availabilities */
						driver_availabilities.findOne({
							user_id	:	userId,
							date	: 	{$gte: fromDate, $lte: toDate}
						},{projection: {shift_id:1}}).then(driverResult=>{
							if(!driverResult || !driverResult.shift_id){
								return callback(null,false);
							}

							/** Check driver shifts */
							shifts.aggregate([
								{$match	: {
									_id	:	new ObjectId(driverResult.shift_id),
								}},
								{$addFields:{
									is_next_day : {$cond: [
										{$and: [
											{ $gt : ["$start_time","$end_time"] },
										]},
										true,
										false
									]},
								}},
								{$match	: {
									$or :[
										{$and : [
											{is_next_day: true },
											{start_time : {$lte: currentTime } },
											{end_time   : {$lte: currentTime } }
										]},
										{$and : [
											{is_next_day: true },
											{start_time : {$gte: currentTime } },
											{end_time   : {$gte: currentTime } }
										]},
										{$and : [
											{end_time 	: {$gte: currentTime } },
											{start_time : {$lte: currentTime } }
										]}
									]
								}},
							]).toArray().then(shiftResult=>{
								let shiftFlag = shiftResult?.[0]._id ? true : false;
								callback(null,shiftFlag);
							}).catch(next);
						}).catch(next);
					},
					have_orders : (callback)=>{
						if(type != Constants.OUT_SHIFT || userSuspend) return callback(null,0);

						/** Check driver have orders */
						const orders = this.db.collection(Tables.ORDERS);
						orders.countDocuments({
							$and: [
								{$or : [
									{captain_id		 	: userId},
									{assigned_captain	: userId},
								]},
								{order_status: 	{$nin : [Constants.ORDER_DELIVERED, Constants.ORDER_REJECTED ] } },
								{$or : [
									{is_completed: {$ne 	 :true }},
									{is_completed: {$exists  :false }},
								]},
							]
						}).then(contResult=>{
							callback(null,contResult);
						}).catch(next);
					},
					allow_outshift : (callback)=>{
						if(type != Constants.OUT_SHIFT) return callback(null,false);
						if(userSuspend) return callback(null,true);

						/** Check driver availabilities */
						driver_availabilities.findOne({
							user_id	:	userId,
							date	: 	{$gte: fromDate, $lte: toDate}
						},{projection: {shift_id:1}}).then(driverResult=>{
							if(!driverResult || !driverResult.shift_id){
								return callback(null, true);
							}

							/** Check driver shifts */
							shifts.aggregate([
								{$match	: {
									_id	:	new ObjectId(driverResult.shift_id),
								}},
								{$addFields:{
									is_next_day : {$cond: [
										{$and: [
											{ $gt : ["$start_time","$end_time"] },
										]},
										true,
										false
									]},
								}},
								{$match	: {
									$or :[
										{$and : [
											{is_next_day: true },
											{start_time : {$lte: currentTime } },
											{end_time   : {$lte: currentTime } }
										]},
										{$and : [
											{is_next_day: true },
											{start_time : {$gte: currentTime } },
											{end_time   : {$gte: currentTime } }
										]},
										{$and : [
											{end_time 	: {$gte: currentTime } },
											{start_time : {$lte: currentTime } }
										]}
									]
								}},
							]).toArray().then(shiftResult=>{
								if(shiftResult.length == 0) return  callback(null,true);

								let shiftDetails	=	shiftResult[0];
								let tmpEndTime 		=	shiftDetails.end_time;
								let isNextDay 		=	shiftDetails.is_next_day;
								let allowOutShift 	=	true;

								if(currentTime < tmpEndTime) allowOutShift = false;
								if(isNextDay && tmpEndTime < currentTime) allowOutShift = false;
;
								callback(null, allowOutShift);
							}).catch(next);
						}).catch(next);
					},
				},(asyncErr, asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					/** Send error response */
                    if(!asyncResponse.check_driver_shift && type == Constants.IN_SHIFT) return resolve({status: Constants.STATUS_ERROR, message: res.__("driver_shift.you_have_not_assigned_any_shift")});

					/** Send error response */
					if(type == Constants.OUT_SHIFT){
						if(!asyncResponse.allow_outshift) return resolve({status: Constants.STATUS_ERROR, message: res.__("driver_shift.not_allowed_to_untill_shift_closed")});

						if(asyncResponse.have_orders) return resolve({status: Constants.STATUS_ERROR, message: res.__("driver_shift.not_allowed_to_untill_closed_orders")});
					}

                    /** Set condition **/
                    let startDate 	= 	Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));
                    let endDate 	=	Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_END_DATE_FORMAT));
                    let condition = {
                        driver_id : userId,
                        created:{
                            $gte: startDate,
                            $lte: endDate
						},
						type : Constants.IN_SHIFT
                    };

                    /** For get driver shift details */
                    driver_in_out_shifts.findOne(condition,{projection: {_id: 1,km:1,start_km:1,type:1}}).then(driverShiftResult=>{

                        /** Send error response */
                        if(driverShiftResult  && type == Constants.IN_SHIFT) 	return resolve({status: Constants.STATUS_ERROR, message: res.__("driver_shift.driver_shift_is_already_in_added")});
                        if(!driverShiftResult && type == Constants.OUT_SHIFT) return resolve({status: Constants.STATUS_ERROR, message: res.__("driver_shift.you_have_not_taken_any_shift_yet")});

						if(type == Constants.OUT_SHIFT && driverShiftResult && driverShiftResult.start_km >= km) return resolve({status: Constants.STATUS_ERROR, message: res.__("driver_shift.please_enter_km_more_than_in_shift_km")});

						req.body.status = (type == Constants.IN_SHIFT) ? Constants.ONLINE : Constants.OFFLINE;
						this.updateOnlineOfflineStatus(req,res,next).then(response=>{
							if(response.status != Constants.STATUS_SUCCESS) return resolve(response);

							/** Set data */
							let updateData = {
								driver_id   : userId,
								type 		: type,
								km 			: km,
								vehicle_id	: vehicleId,
								vehicle_type: vehicleType,
								modified	: Helpers.getUtcDate()
							};

							if(type == Constants.IN_SHIFT){
								updateData.start_km 	= 	km;
								updateData.in_latitude 	= 	latitude;
								updateData.in_longitude =	longitude;
							}

							if(type == Constants.OUT_SHIFT){
								let startKm =  (driverShiftResult.start_km) ? driverShiftResult.start_km :0;

								updateData.total_km 		= 	km -  startKm;
								updateData.out_latitude 	= 	latitude;
								updateData.out_longitude 	=	longitude;
							}

							asyncParallel({
								driver_shift : (subCallback)=>{
									/** Update driver in out shifts details */
									driver_in_out_shifts.updateOne({
										driver_id 	: 	userId,
										type 		: 	Constants.IN_SHIFT,
										created		:	{
											$gte: startDate,
											$lte: endDate
										}
									},
									{
										$set: updateData,
										$setOnInsert: {
											created : Helpers.getUtcDate(),
										}
									},{upsert: true}).then(()=>{
										subCallback(null);
									}).catch(next);
								},
								update_driver_details : (subCallback)=>{
									if(type != Constants.IN_SHIFT) return subCallback(null);

									/** Mark unsuspend when driver mark in-shift*/
									users.updateOne({
										_id: userId
									},
									{
										$set: {
											is_suspend: Constants.UNSUSPEND
										},
										$unset: {
											is_highlight: 1
										},
									}).then(()=>{
										subCallback(null);
									}).catch(next);
								},
							},(asyncChildErr)=>{
								if(asyncChildErr) return next(asyncChildErr);

								/** Send success response **/
								resolve({
									status	: Constants.STATUS_SUCCESS,
									message : (type == Constants.IN_SHIFT) ? res.__("driver_shifts.in_shift_has_been_added_successfully") : res.__("driver_shifts.out_shift_has_been_added_successfully")
								});
							});
						}).catch(next);
                    }).catch(next);
                });
            });
		}).catch(next);
	}// end updateInOutShifts()

	/**
	 * Function to update online offline status
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async updateOnlineOfflineStatus (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 	= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId	= (req.body.user_id) ? new ObjectId(req.body.user_id) :"";
            let status	= (req.body.status)  ? req.body.status  		  :"";

			/** Send error response **/
			if(!userId || !status) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});

			/** Set driver conditions **/
			let userConditions = {
				_id : userId,
				...Constants.DRIVER_COMMON_CONDITIONS
			};

			/** Find if user is not driver */
			const users	= 	this.db.collection(Tables.USERS);
			users.findOne(userConditions,{projection: { _id:1}}).then(userResult=>{

				/** Send error response **/
				if(!userResult) return resolve({status : Constants.STATUS_ERROR, message : res.__("admin.system.invalid_access")});

				/** Update user online offline status */
				users.updateOne({ _id : userId},{$set : {is_online : parseInt(status)}}).then(()=>{

					/** Save user online offline logs **/
					this.saveOnlineOfflineLogs(req,res,next,{user_id : userId, status: status}).then({}).catch(next);

					/**Send success response */
					resolve({status: Constants.STATUS_SUCCESS, message: res.__("my_account.status_has_been_updated_successfully") });
				}).catch(next);
			}).catch(next);
		}).catch(next);
	};// end updateOnlineOfflineStatus()

	/**
	 * Function to save online offline logs
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async saveOnlineOfflineLogs (req,res,next,options){
		return new Promise(resolve=>{
			let userId	= (options.user_id) ? options.user_id :"";
			let status	= (options.status)  ? options.status : "";

			/** Send error response **/
			if(!userId || !status) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});

            /** Find user online logs details **/
			const user_online_logs = this.db.collection(Tables.USER_ONLINE_LOGS);
			user_online_logs.find({user_id : new ObjectId(userId)}).sort({_id : Constants.SORT_DESC}).limit(1).toArray().then(result=>{

				let lastLogDetails	= (result && result[0]) ? result[0] : null;
				let logId 			= (lastLogDetails && lastLogDetails._id) ? lastLogDetails._id : "";
				let updateRecordId	= new ObjectId();

				asyncParallel([
					callback=>{
						/** Update offline time if user is already online but api get same status again */
						if(status == Constants.ONLINE && lastLogDetails && lastLogDetails.offline_time == ""){
							user_online_logs.updateOne({
								_id : new ObjectId(logId)
							},{$set: {
								offline_time : Helpers.getUtcDate()}
							}).then(()=>{
								callback(null,null);
							}).catch(next);
						}else{
							callback(null,null);
						}
					},
					callback=>{
						let dataToBeUpdated = {};

						if(status == Constants.OFFLINE && lastLogDetails && lastLogDetails.offline_time == "" && logId){
							updateRecordId = logId;
							dataToBeUpdated.offline_time = Helpers.getUtcDate();
						}

						if(status == Constants.ONLINE){
							dataToBeUpdated = {
								user_id		: new ObjectId(userId),
								online_time	: Helpers.getUtcDate(),
								offline_time: ""
							};
						}

						if(Object.keys(dataToBeUpdated).length < 1) return callback(null,null);

                        /** Update user online logs **/
						user_online_logs.updateOne({
							_id : new ObjectId(updateRecordId)
						},{$set: dataToBeUpdated},{upsert : true}).then(()=>{
							callback(null,null);
						}).catch(next);
					}
				],(err)=>{
					if(err) return next(err);

					resolve({status : Constants.STATUS_SUCCESS});
				});
			}).catch(next);
		}).catch(next);
	};// end saveOnlineOfflineLogs()

	/**
	 * Function to get in out shifts
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getInOutShifts (req,res,next){
		return new Promise(resolve=>{
			let userId  = (req.body.user_id) ? new ObjectId(req.body.user_id) : "";

			/** Send error response **/
			if(!userId) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});

			let startDate 	= Helpers.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT);
			let endDate 	= Helpers.newDate("",Constants.CURRENTDATE_END_DATE_FORMAT);

			/** For get driver shift details */
			const driver_in_out_shifts = this.db.collection(Tables.DRIVER_IN_OUT_SHIFTS);
			driver_in_out_shifts.findOne({
				driver_id : userId,
				created:{
					$gte: Helpers.newDate(startDate),
				 	$lte: Helpers.newDate(endDate)
			 	}
			},{projection: { _id:1,driver_id:1,type:1,km:1,created:1,modified:1},sort:{_id:Constants.SORT_DESC}}).then(findResult=>{

				/**Send success response */
				resolve({status	: Constants.STATUS_SUCCESS, result: findResult});
			}).catch(next);
		}).catch(next);
	}// end getInOutShifts()

	/**
	 * Function to save driver service details
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async driverService (req,res,next){
		return new Promise(async resolve=>{
			/** Sanitize Data **/
            req.body 			= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
            let userId 			= (req.body.user_id) 			? 	new ObjectId(req.body.user_id) 	:"";
            let kilometers 		= (req.body.kilometers) 		? 	parseInt(req.body.kilometers) 	:"";
            let nextServiceDate = (req.body.next_service_date) 	?	req.body.next_service_date 		:"";

			/** Send error response **/
			if(!userId) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});

			/** Apply validation */
			let validationResponse = await Helpers.applyValidationInterCallFunction(req, res, next, postServiceValidation);
			if(validationResponse.status != Constants.STATUS_SUCCESS) return resolve(validationResponse);

			/** Insert driver service details */
			const driver_services = this.db.collection(Tables.DRIVER_SERVICES);
			driver_services.insertOne({
				user_id 	  		: userId,
				kilometers	  		: kilometers,
				next_service_date	: Helpers.getUtcDate(nextServiceDate+" "+Constants.START_DATE_TIME_FORMAT),
				created 	  		: Helpers.getUtcDate()
			}).then(()=>{

				/**Send success response */
				resolve({status	: Constants.STATUS_SUCCESS,message : res.__("driver_break.driver_service_detail_has_been_added_successfully")});
			}).catch(next);
        }).catch(next);
	};// end driverService()

	/**
	 * Function to save driver fueling details
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async driverFueling (req,res,next){
		return new Promise(async resolve=>{
			/** Sanitize Data **/
            req.body 		= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
            let userId 		= (req.body.user_id) ? new ObjectId(req.body.user_id) :"";
            let kilometers 	= (req.body.kilometers) ? parseInt(req.body.kilometers) :"";
            let amount   	= (req.body.amount) ? parseFloat(req.body.amount) :"";

			/** Send error response **/
			if(!userId) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});

			/** Apply validation */
			let validationResponse = await Helpers.applyValidationInterCallFunction(req, res, next, postFuelingValidation);
			if(validationResponse.status != Constants.STATUS_SUCCESS) return resolve(validationResponse);

			/** Insert driver fueling details */
			const driver_fuels = this.db.collection(Tables.DRIVER_FUELS);
			driver_fuels.insertOne({
				user_id 	: userId,
				kilometers	: kilometers,
				amount		: amount,
				created 	: Helpers.getUtcDate()
			}).then(()=>{

				/**Send success response */
				resolve({status	: Constants.STATUS_SUCCESS,message : res.__("driver_break.driver_fueling_details_has_been_added_successfully")});
			}).catch(next);
        }).catch(next);
	};// end driverFueling()
}// End DriverBreaks