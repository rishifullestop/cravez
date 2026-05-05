import { ObjectId } from 'mongodb';
import odbc from 'odbc';
import clone from 'clone';
import { writeFile } from 'fs';
import { parallel as asyncParallel, each as asyncEach, eachOfSeries, forEachOf as asyncForEachOf} from 'async';

import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import * as Helper from "../../../../utils/index.mjs";
import * as services from "../../../../services/index.mjs";
import myCache from '../../../../cache.mjs';

import pushNotificationsModule from '../../../admin/push_notifications/model/push_notifications.mjs';
import assignmentModule from '../../api/model/assignment.mjs';
import userCartModule from '../../api/model/user_carts.mjs';

export default class Cron {
	constructor(db) {
		this.db = db;
        this.pushNotificationsModule = new pushNotificationsModule(db);
        this.assignmentModel = new assignmentModule(db);
        this.userCartModel = new userCartModule(db);
	}

	/**
	 * Function to update user leave (frequency time: 1st day of each month )
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render
	 */
	async updateUserLeave (req, res,next){
        /** Send response to client and work in background */
		res.render('blank',{layout:false});

		const users 			= 	this.db.collection(Tables.USERS);
		const user_leaves		=	this.db.collection(Tables.USER_LEAVES);
		const leave_types		=	this.db.collection(Tables.LEAVE_TYPES);
		const user_leave_logs	=	this.db.collection(Tables.USER_LEAVE_LOGS);
		let currentMonthName	= 	Helper.newDate('',Constants.MONTH_DATE_FORMAT).toLowerCase();
		let todaysDate			= 	Helper.newDate("",Constants.DAY_DATE_FORMAT);

		asyncParallel({
			lapse_leave : (callback)=>{
				if(currentMonthName != Constants.FIRST_MONTH_NAME || todaysDate != 1) return callback(null);

				/** Get user leave list */
				user_leaves.find({
					"leaves.leaves" : {$gt :0}
				},{projection: {_id: 1, user_id :1, leaves: 1, parent_id:1}}).toArray().then(result=>{
					if(!result || result.length <=0) return callback(null);

					eachOfSeries(result,(leaveData, firstKey, firstCallback)=>{

						eachOfSeries(leaveData.leaves,(leaveRecords, childKey, firstChildCallback)=>{
							/** Decrease user leaves **/
							this.decrementOrIncrementUserLeave(req, res,{
								type 		:	Constants.DEBIT,
								parent_id 	: 	leaveData?.parent_id || "",
								user_id 	: 	leaveData?.user_id || "",
								leave_count : 	leaveRecords?.leaves || 0,
								leave_type 	: 	leaveRecords?.leave_type || ""
							}).then(()=>{
								firstChildCallback(null);
							}).catch(err=>{
								firstChildCallback(err);
							});
						},firstChildEachErr=>{
							firstCallback(firstChildEachErr);
						});
					},(firstEachErr)=>{
						callback(firstEachErr);
					});
				}).catch(err=>{
					callback(err);
				});
			},
			leave_type_list : (callback)=>{
				/** Check leave is details exists of this user */
				Helper.getAttributes(req,res,next,{type: "vacation_leave_type", is_show: true}).then(leaveType=>{
					callback(null,leaveType);
				}).catch(next);
			},
		},async (asyncFirstErr,asyncFirstResponse)=>{
			if(asyncFirstErr){
				console.error("Error On Crons updateUserLeave first parallel",asyncFirstErr);
			}

            try{
                let leaveTypeList = asyncFirstResponse?.leave_type_list || [];

                /** Get leave type list **/
                let result = await leave_types.find({},{projection: {type: 1, frequency: 1, leaves: 1,role_id:1,team_head:1,user_id:1}}).toArray();

                if(result && result.length >0 && leaveTypeList.length >0){
                    eachOfSeries(result,(records, parentkey, parentCallback)=>{

                        /** Get total leaves according to frequency */
                        let totalLeave = 0;
                        if(records.frequency == Constants.MONTHLY && Constants.FREQUENCY_MONTH_LIST[Constants.MONTHLY].indexOf(currentMonthName) != -1) totalLeave = parseInt(records.leaves);
                        if(records.frequency == Constants.QUATERLY && Constants.FREQUENCY_MONTH_LIST[Constants.QUATERLY].indexOf(currentMonthName) != -1) totalLeave = parseInt(records.leaves);
                        if(records.frequency == Constants.HALF_YEARLY && Constants.FREQUENCY_MONTH_LIST[Constants.HALF_YEARLY].indexOf(currentMonthName) != -1) totalLeave = parseInt(records.leaves);

						if(totalLeave <= 0) return parentCallback(null);

                        /** Set common conditions */
                        let userConditions = clone(Constants.ADMIN_USER_COMMON_CONDITIONS);

                        /** Add role id conditions  */
                        if(records.role_id == 0){
                            userConditions.user_role_id = {$ne: Constants.CRAVEZ};
                        }else{
                            userConditions.user_role_id = records.role_id;
                        }

                        /** Add team head conditions  */
                        if(typeof records.team_head !== typeof undefined) userConditions.team_head = records.team_head;

                        /** Add user id conditions  */
                        if(records.user_id){
                            let userIdArray =	(records.user_id.constructor !== Array)	? [records.user_id] :records.user_id;
                            userIdArray		=	Helper.arrayToObject(userIdArray);

                            userConditions._id = {$in :userIdArray};
                        }

                        let finalConditions = {
                            $or : [
                                userConditions,
                                clone(Constants.DRIVER_COMMON_CONDITIONS)
                            ]
                        };

                        /** Get user list **/
                        users.find(finalConditions,{projection: {_id:1, parent_id:1,user_role_id : 1 }}).toArray().then(userResult=>{
							if(!userResult || userResult.length <=0) return parentCallback(null);

                            eachOfSeries(userResult,(userData, childkey, childCallback)=>{

                                asyncParallel({
                                    old_data_count : (secondParallelCallback)=>{
                                        /** Check leave is add or not this current month */
                                        user_leave_logs.countDocuments({
                                            user_id 	:	userData._id,
                                            leave_type 	:	records.type,
                                            type 		:	Constants.CREDIT,
                                            month 		:	Helper.getUtcDate('',Constants.MONTH_DATE_FORMAT),
                                            year 		:	Helper.getUtcDate('',Constants.YEAR_DATE_FORMAT)
                                        }).then(contResult=>{
                                            secondParallelCallback(null,contResult);
                                        }).catch(err=>{
                                            secondParallelCallback(err);
                                        });
                                    },
                                    check_leave_records_exits : (secondParallelCallback)=>{
                                        /** Check leave is details exists of this user */
                                        user_leaves.countDocuments({
                                            user_id :	userData._id,
                                        }).then(contResult=>{
                                            secondParallelCallback(null,contResult);
                                        }).catch(err=>{
                                            secondParallelCallback(err);
                                        });
                                    },
                                },(secondParallelErr,secondParallelResponse)=>{
									if(secondParallelErr  || secondParallelResponse?.old_data_count >0) return childCallback(secondParallelErr);

                                    if(secondParallelResponse?.check_leave_records_exits == 0){
										/** Save leave details  */
                                        let leaveUpdateData = {
                                            user_id 		: userData._id,
                                            user_role_id 	: userData.user_role_id,
                                            parent_id		: (userData.parent_id) ? userData.parent_id :"",
                                            total_leave		: totalLeave,
                                            leaves			: []
                                        };

                                        leaveTypeList.map(leaveTypeRecords=>{
                                            let tempObj = {leave_type: leaveTypeRecords.attribute_id,leaves:0};

                                            if(String(leaveTypeRecords.attribute_id) == String(records.type)) tempObj.leaves = totalLeave;

                                            leaveUpdateData.leaves.push(tempObj);
                                        });

                                        /** Save user leave details */
                                        user_leaves.insertOne(leaveUpdateData).then(()=>{

                                            /** Save user leave logs **/
                                            this.saveUserLeaveLogs(req, res,{
                                                parent_id 	: 	(userData.parent_id) ? userData.parent_id :"",
                                                user_id 	: 	userData._id,
                                                leave_count : 	totalLeave,
                                                type 		:	Constants.CREDIT,
                                                leave_type 	: 	records.type
                                            }).then(()=>{
                                                childCallback(null);
                                            }).catch(err=>{
                                                childCallback(err);
                                            });
                                        }).catch(err=>{
											childCallback(err);
										});
                                    }else{
										/** Increase user leaves **/
                                        this.decrementOrIncrementUserLeave(req, res,{
                                            type 		:	Constants.CREDIT,
                                            user_id 	: 	userData._id,
                                            parent_id 	: 	(userData.parent_id) ? userData.parent_id :"",
                                            leave_count : 	totalLeave,
                                            leave_type 	: 	records.type
                                        }).then(()=>{
                                            childCallback(null);
                                        }).catch(err=>{
                                            childCallback(err);
                                        });
                                    }
                                });
                            },childEachErr=>{
                                parentCallback(childEachErr);
                            });
                        });
                    },asyncEachErr=>{
                        if(asyncEachErr){
                            console.error("Error On Crons updateUserLeave",asyncEachErr);
                        }
                    });
                }
            }catch(err){
                console.error("Error On Crons updateUserLeave at try catch",err);
            }
		});
	};//End updateUserLeave()

    /**
	 * Function to decrement or increment user leave
	 *
	 * @param req 		As Request Data
	 * @param res 		As Response Data
	 * @param options 	As Object Data
	 *
	 * @return render
	 */
	async decrementOrIncrementUserLeave (req, res,options){
		return new Promise(resolve=>{
            let leaveType 	= 	(options.leave_type)	?	options.leave_type			:"";
			let totalLeave	=	(options.leave_count)	?	options.leave_count			:0;
			let type		=	(options.type)			?	options.type				:Constants.DEBIT;
			let userId 		= 	(options.user_id)		?	new ObjectId(options.user_id)	:"";
			let parentId	=	(options.parent_id)		?	new ObjectId(options.parent_id)	:"";

			/** Send error response */
			if(!userId || !leaveType || !totalLeave) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters") });

			if(type == Constants.DEBIT)  totalLeave = totalLeave*-1;

			/** Decrement or increment user leave */
			const user_leaves =	this.db.collection(Tables.USER_LEAVES);
			user_leaves.updateOne({
				user_id : 	userId,
				leaves	:	{$elemMatch: { leave_type: leaveType } }
			},
            {$inc: {
                "leaves.$.leaves":	totalLeave,
                "total_leave"	:	totalLeave,
            }}).then(()=>{

				/** Save user leave logs **/
				this.saveUserLeaveLogs(req, res,{
					type 		:	type,
					user_id 	: 	userId,
					parent_id 	: 	parentId,
					leave_count : 	totalLeave,
					leave_type 	: 	leaveType
				}).then(()=>{

					/** Send success response **/
					resolve({status: Constants.STATUS_SUCCESS });
				}).catch(err=>{
					return resolve({status: Constants.STATUS_ERROR, message: err});
				});
			}).catch(err=>{
				return resolve({status: Constants.STATUS_ERROR, message: err});
			});
		});
	};//End decrementOrIncrementUserLeave()

    /**
	 * Function to save user leave logs
	 *
	 * @param req 		As Request Data
	 * @param res 		As Response Data
	 * @param options 	As Object Data
	 *
	 * @return render
	 */
	async saveUserLeaveLogs (req, res,options){
		return new Promise(resolve=>{
			/** Save user leave logs */
			const user_leave_logs =	this.db.collection(Tables.USER_LEAVE_LOGS);
			user_leave_logs.insertOne({
				parent_id 	: 	(options.parent_id)	? options.parent_id	:"",
				user_id 	: 	options.user_id,
				leave_count : 	options.leave_count,
				type 		:	options.type,
				leave_type 	: 	options.leave_type,
				month 		:	Helper.newDate('',Constants.MONTH_DATE_FORMAT),
				year 		:	Helper.newDate('',Constants.YEAR_DATE_FORMAT),
				created 	:	Helper.getUtcDate(),
			}).then(()=>{
				/** Send success response */
				resolve({status: Constants.STATUS_SUCCESS});
			}).catch(err=>{
				return resolve({status: Constants.STATUS_ERROR, message: err});
			});
		});
	};//End saveUserLeaveLogs()

    /**
	 * Function to lapse user leave (frequency time: every day -12.01 )
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render
	 */
	async lapseUserLeave (req, res){
        /** Send response to client and work in background */
		res.render('blank',{layout:false});

		let todayStartDate	=	Helper.newDate('',Constants.DATABASE_DATE_FORMAT);
		todayStartDate		=	Helper.newDate(todayStartDate+" "+Constants.START_DATE_TIME_FORMAT);

		asyncParallel({
			team_leave_details : (parentCallback)=>{
				/** Get user leave list */
				const team_availabilities	=	this.db.collection(Tables.TEAM_AVAILABILITIES);
				team_availabilities.find({
					date 		:	{$lt: todayStartDate },
					leave_type	:	{$exists: true},
					status		:	Constants.PENDING,
					leave_status:	Constants.APPROVED,
				},{projection: {_id: 1, user_id: 1, leave_type: 1, parent_id: 1, date:1}}).toArray().then(result=>{
					if(result?.length <=0) return parentCallback(null);

					if(result && result.length >0){
						eachOfSeries(result,(records, key, seriesCallback)=>{
							let tmpUserId	 	=	(records.user_id)		?	records.user_id		:"";
							let tmpLeaveType 	=	(records.leave_type)	?	records.leave_type	:"";
							let tmpParentId		=	(records.parent_id) 	? 	records.parent_id 	:"";

							asyncParallel({
								leave_update_details : (parallelCallback)=>{
									if(tmpLeaveType == Constants.WEEKLY_OFF) return parallelCallback(null);

									/** Decrease user leaves **/
									this.decrementOrIncrementUserLeave(req, res,{
										type 		:	Constants.DEBIT,
										user_id 	: 	tmpUserId,
										parent_id 	: 	tmpParentId,
										leave_count : 	1,
										leave_type 	: 	tmpLeaveType
									}).then(()=>{
										parallelCallback(null);
									}).catch(err=>{
										parallelCallback(err);
									});
								},
								availability_update_details : (parallelCallback)=>{
									/** Update team availability status  */
									team_availabilities.updateOne({_id : records._id,},{$set: {status : Constants.TAKEN }}).then(()=>{
										parallelCallback(null);
									}).catch(err=>{
										parallelCallback(err);
									});
								},
							},(parallelErr)=>{
								seriesCallback(parallelErr);
							});
						},seriesEachErr=>{
							parentCallback(seriesEachErr);
						});
					}
				}).catch(err=>{
					parentCallback(err);
				});
			},
			driver_leave_details : (parentCallback)=>{
				/** Get driver leave list */
				const driver_availabilities	=	this.db.collection(Tables.DRIVER_AVAILABILITIES);
				driver_availabilities.aggregate([
					{$match: {
						date 		:	{$lt: todayStartDate },
						leave_type	:	{$exists: true},
						status		:	Constants.PENDING,
						leave_status:	Constants.APPROVED,
					}},
					{$group: {
						_id: {
							date	: 	{$dateToString: {format: "%Y-%m-%d", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE }},
							user_id	: 	"$user_id",
						},
						date 		: 	{$first: "$date"},
						user_id 	:	{$first: "$user_id"},
						leave_ids	: 	{$push: "$_id"},
						leave_type 	:	{$first: "$leave_type"},
						parent_id 	:	{$first: "$parent_id"},
					}},
				]).toArray().then(result=>{
					if(result?.length <=0) return parentCallback(null);

					if(result && result.length >0){
						eachOfSeries(result,(records, key, seriesCallback)=>{
							let tmpDate	 		=	(records.date)			?	Helper.newDate(records.date):"";
							let tmpUserId	 	=	(records.user_id)		?	records.user_id		:"";
							let tmpLeaveType 	=	(records.leave_type)	?	records.leave_type	:"";
							let tmpParentId		=	(records.parent_id) 	? 	records.parent_id 	:"";
							let leaveIds		=	(records.leave_ids) 	? 	records.leave_ids 	:[];

							asyncParallel({
								leave_weekly : (parallelCallback)=>{
									if(tmpLeaveType != Constants.WEEKLY_OFF) return parallelCallback(null);

									asyncParallel({
										previous_day_leave : (childCallback)=>{
											let preStartDate   	= 	Helper.newDate(Helper.newDate(Helper.subtractMinuteFromDate(tmpDate,Constants.HOURS_IN_A_DAY*Constants.MINUTES_IN_A_HOUR),Constants.CURRENTDATE_START_DATE_FORMAT));
											let preEndDate		= 	Helper.newDate(Helper.newDate(preStartDate,Constants.CURRENTDATE_END_DATE_FORMAT));

											driver_availabilities.find({
												user_id 	:	tmpUserId,
												date 		:	{$gte: preStartDate, $lte: preEndDate},
												leave_type	:	{$exists: true},
												leave_status:	Constants.APPROVED,
												status 		:	Constants.TAKEN
											},{projection: {_id:1}}).toArray().then(leaveResult=>{
												childCallback(null, leaveResult);
											}).catch(err=>{
												childCallback(err);
											});
										},
										next_day_leave : (childCallback)=>{
											let tmpStartDate   	= 	Helper.newDate(Helper.newDate(Helper.addDaysToDate(Constants.HOURS_IN_A_DAY, tmpDate),Constants.CURRENTDATE_START_DATE_FORMAT));
											let tmpEndDate		= 	Helper.newDate(Helper.newDate(tmpStartDate,Constants.CURRENTDATE_END_DATE_FORMAT));

											driver_availabilities.find({
												user_id 	:	tmpUserId,
												date 		:	{$gte: tmpStartDate, $lt: tmpEndDate},
												leave_type	:	{$exists: true},
												leave_status:	Constants.APPROVED,
												status 		:	Constants.TAKEN
											},{projection: {_id:1}}).toArray().then(leaveResult=>{
												childCallback(null, leaveResult);
											}).catch(err=>{
												childCallback(err);
											});
										},
									},(childParallelErr, childParallelRes)=>{

                                        if(childParallelRes?.previous_day_leave?.length > 0 && childParallelRes?.next_day_leave?.length > 0){

											/** Decrease user leaves **/
											this.decrementOrIncrementUserLeave(req, res,{
												type 		:	Constants.DEBIT,
												user_id 	: 	tmpUserId,
												parent_id 	: 	tmpParentId,
												leave_count : 	1,
												leave_type 	: 	tmpLeaveType
											}).then(()=>{
												parallelCallback(null);
											}).catch(err=>{
												parallelCallback(err);
											});
										}else{
											parallelCallback(childParallelErr);
										}
									});
								},
								leave_update_details : (parallelCallback)=>{
									if(tmpLeaveType == Constants.WEEKLY_OFF) return parallelCallback(null);

									/** Decrease user leaves **/
									this.decrementOrIncrementUserLeave(req, res,{
										type 		:	Constants.DEBIT,
										user_id 	: 	tmpUserId,
										parent_id 	: 	tmpParentId,
										leave_count : 	1,
										leave_type 	: 	tmpLeaveType
									}).then(()=>{
										parallelCallback(null);
									}).catch(err=>{
										parallelCallback(err);
									});
								},
								availability_update_details : (parallelCallback)=>{
									/** Update team availability status  */
									driver_availabilities.updateMany({_id: {$in: leaveIds }},{$set: {status: Constants.TAKEN }}).then(()=>{
										parallelCallback(null);
									}).catch(err=>{
										parallelCallback(err);
									});
								},
							},(parallelErr)=>{
								seriesCallback(parallelErr);
							});
						},seriesEachErr=>{
							parentCallback(seriesEachErr);
						});
					}
				}).catch(err=>{
					parentCallback(err);
				});
			},
		},(parallelErr)=>{
			if(parallelErr){
				console.error("Error On Crons lapseUserLeave",parallelErr);
			}
		});
	};//End lapseUserLeave()

	/**
	 * Function to send scheduled email/sms/notification
	 *  Frequency : every 30 minutes/1 hour or accordingly
	 *
	 * @param req 		As Request Data
	 * @param res 		As Response Data
	 * @param options 	As Object Data
	 *
	 * @return render
	 */
	async sendScheduledNotifications (req, res){

        /** Send response to client and work in background */
		res.render('blank',{layout:false});

        /** Get scheduled notifications list */
		const scheduled_notifications = this.db.collection(Tables.SCHEDULED_NOTIFICATIONS);
		scheduled_notifications.find({
			is_sent : Constants.NOT_SENT,
			$or		:	[
				{scheduled_date : {$exists : false}},
				{scheduled_date : {$lte : Helper.newDate()}},
			]
		}).toArray().then(result=>{

            if(result && result.length >0){
                let successfullIds = [];
                asyncEach(result,(records, mailParentCallback)=>{
                    /** Send a mail to user according to event type */
                    switch(records.event_type){
                        case Constants.BRANCH_ENQUIRY_APPROVE_EMAIL_EVENTS:

                            /**Send mails on branch approval */
                            if(records.options.restaurant_id && records.options.branch_id  && records.options.user_id && records.options.branch_number && records.options.restaurant_name && records.options.branch_name){

                                /** Set conditions */
                                let userFindConditions = {
                                    $or : [
                                        {_id : new ObjectId(records.options.user_id)},
                                        {
                                            restaurant_id : new ObjectId(records.options.restaurant_id),
                                            user_role_id :Constants.RESTAURANT,
                                            user_type : Constants.USER_TYPE_RESTAURANT
                                        }
                                    ],
                                    is_deleted: Constants.NOT_DELETED,
                                };

                                /** Get details form users */
                                const users = this.db.collection(Tables.USERS);
                                users.find(userFindConditions,{projection:{_id:1,email:1,full_name:1,user_role_id:1}}).toArray().then(userResult=>{
                                    /**For check error */
                                    if(userResult?.length == 0) return mailParentCallback(null);

                                    userResult.map(userData =>{
                                        /**Set variable for send email */
                                        let userEmail  = (userData.email) 	     ? userData.email 		:"";
                                        let fullName   = (userData.full_name)    ? userData.full_name 	:"";

                                        if(Constants.EMAIL_EVENTS[Constants.BRANCH_ENQUIRY_APPROVE_EMAIL_EVENTS].notification_types.indexOf(Constants.NOTIFICATION_TYPE_EMAIL) !== -1){

                                            /**Send email function */
                                            if(userEmail) services.sendMail(req,res,{
                                                to 			: userEmail,
                                                action 		: "restaurant_pending_branch_enquiry_approved",
                                                rep_array 	: [fullName,records.options.branch_name]
                                            });
                                        }

                                        if(Constants.EMAIL_EVENTS[Constants.BRANCH_ENQUIRY_APPROVE_EMAIL_EVENTS].notification_types.indexOf(Constants.NOTIFICATION_TYPE_NOTIFICATION) !== -1){
                                            /*************** Send notification  ***************/
                                                let statusTitle = Constants.STATUS_LABELS[Constants.APPROVED].status_name.toLowerCase();
                                                let notificationMessageParams = [records.options.branch_name,records.options.branch_number,records.options.restaurant_name,statusTitle];
                                                services.insertNotifications(req,res,{
                                                    notification_data : {
                                                        notification_type 	: 	Constants.NOTIFICATION_BRANCH_APPROVAL_REQUEST_STATUS_UPDATE,
                                                        message_params 		: 	notificationMessageParams,
                                                        parent_table_id 	: 	records.options.branch_id,
                                                        user_ids 			: 	[userData._id],
                                                        role_id 			: 	userData.user_role_id,
                                                        extra_parameters 	:	{
                                                            user_id : userData._id
                                                        }
                                                    }
                                                });
                                            /*************** Send notification  ***************/
                                        }
                                    });
                                    successfullIds.push(records._id);
                                    mailParentCallback(null);
                                });
                            }else{
                                mailParentCallback(null);
                            }
                        break;
                    }
                },(parentErr)=>{
                    if(parentErr){
                        console.error("Error in send schedule async each",parentErr);
                    }

                    if(successfullIds?.length>0){
                        /** Update team availability status  */
                        scheduled_notifications.updateMany({
                            _id : {
                                $in : Helper.arrayToObject(successfullIds)
                            }
                        },
                        {$set: {
                            is_sent : Constants.SENT
                        }}).then(()=>{}).catch(()=>{});
                    }
                });
            }
		}).catch(err=>{
			console.error("Error in send schedule find",err);
		});
	};//End sendScheduledNotifications()

    /**
	 * Function to start driver excuses
	 *  Frequency : every 5 to 15 minutes
	 *
	 * @param req 	As	 Request Data
	 * @param res 	As	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render driver_excuses
	 */
	async startDriverExcuses (req, res,next){
        /** Send response to client and work in background */
		res.render('blank',{layout:false});

        try {
            let startDate 	=	Helper.newDate(Helper.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));
            let endDate 	= 	Helper.newDate(Helper.newDate("",Constants.CURRENTDATE_END_DATE_FORMAT));
            let currentTime =	parseFloat(Helper.newDate("",Constants.BREAK_TIME_FORMAT).replace(':','.'));

            /** Get driver excuses list */
            const driver_excuses = this.db.collection(Tables.DRIVER_EXCUSES);
            let result = await driver_excuses.find({
                date		:	{$gte: startDate, $lte: endDate},
                status		: 	Constants.APPROVED,
                is_start 	:	{$exists: false},
                from		:	{$lte 	: currentTime},
                is_completed:	false,
            }).toArray();

            if(result && result.length >0){
                asyncEach(result,(records, asyncEachCallback)=>{

                    /** Update driver excuse start flag  */
                    driver_excuses.updateOne({
                        _id : records._id,
                    },
                    {$set: {
                        is_start 	: 	true,
                        modified	:	getUtcDate()
                    }}).then(()=>{

                        /** Save driver status logs */
                        services.saveDriverStatusLogs(req,res,next,{
                            parent_id 	: records._id,
                            driver_id 	: records.driver_id,
                            type	  	: Tables.DRIVER_EXCUSES,
                            event_type	: Constants.IN_EXCUSE,
                            start_time	: records.from,
                        }).then(()=>{
                            asyncEachCallback(null);
                        }).catch(err=>{
                            asyncEachCallback(err);
                        });
                    }).catch(err=>{
                        asyncEachCallback(err);
                    });
                },(asyncEachErr)=>{
                    if(asyncEachErr){
                        console.error("async each error in startDriverExcuses",asyncEachErr);
                    }
                });
            }
        } catch (error) {
            console.error("Error in startDriverExcuses try catch",error);
        }

	};//End startDriverExcuses()

	/**
	 * Function to save open branch details
	 *  Frequency : every 00.05 am
	 *
	 * @param req 	As	 Request Data
	 * @param res 	As	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render driver_excuses
	 */
	async saveOpenBranchList (req, res,next,options){
		try {
			let isToday		= 	(req.params.today) ? parseInt(req.params.today) :"";
			let branchId 	=	(options && options.branch_id)	?	new ObjectId(options.branch_id)	:"";
			var date		=	(branchId || isToday) ? new Date() :new Date(new Date(). getTime() + Constants.ONE_DAY_TIMESTAMP);
			let currentDay 	= 	parseInt(date.getUTCDay());
			let deleteAbleId= 	String(new ObjectId());

			/** If current day is 0 then set it to 7 for sunday */
			if(currentDay == 0) currentDay = 7;

			let startDate 	= 	Helper.newDate(Helper.newDate(date,Constants.CURRENTDATE_START_DATE_FORMAT));
			let endDate 	= 	Helper.newDate(Helper.newDate(date,Constants.CURRENTDATE_END_DATE_FORMAT));

			const restaurant_open_branches 		= 	this.db.collection(Tables.RESTAURANT_OPEN_BRANCHES);
			const restaurant_branch_calendars 	=	this.db.collection(Tables.RESTAURANT_BRANCH_CALENDARS);
			asyncParallel({
				open_branch_list : (callback)=>{
					let calendarConditions = {
						parent_id	:	"",
						status		: 	Constants.OPEN,
						type		: 	Constants.DEFAULT_WEEK,
						$and		:	[
							{$or: [
								{is_exception:	false},
								{is_exception:	{$exists: false}}
							]},
							{$or: [
								{is_sw:	false},
								{is_sw:	{$exists: false}}
							]},
						]
					};

					if(branchId) calendarConditions = {branch_id: branchId, ...calendarConditions};

					restaurant_branch_calendars.aggregate([
						{$match : calendarConditions},
						{$lookup:	{
							from     : Tables.RESTAURANT_BRANCH_CALENDARS,
							let      : {branchId : "$branch_id"},
							pipeline : [
								{$match : {
									$expr: {
										$and : [
											{$eq: ["$is_exception",true]},
											{$eq: ["$branch_id", "$$branchId"]},
											{$eq: ["$day", currentDay]},
										]
									}
								}},
								{$project : { to_hour: 1, to_minute: 1, from_hour: 1, from_minute: 1 }},
							],
							as	:	"exception_details"
						}},
						{$lookup:	{
							from     : Tables.RESTAURANT_BRANCH_CALENDARS,
							let      : {branchId : "$branch_id"},
							pipeline : [
								{$match : {
									$expr: {
										$and : [
											{$eq: ["$is_sw", true]},
											{$eq: ["$branch_id", "$$branchId"]},
											{$eq: ["$day", currentDay]},
										]
									}
								}},
								{$project : { to_hour: 1, to_minute: 1, from_hour: 1, from_minute: 1 }},
							],
							as	:	"sw_details"
						}},
						{$lookup:	{ /** Check this branch close or not today */
							from     : Tables.RESTAURANT_BRANCH_CALENDARS,
							let      : {branchId : "$branch_id"},
							pipeline : [
								{$match : {
									$expr: {
										$and : [
											{$eq: ["$branch_id", "$$branchId"]},
											{$eq: ["$day", currentDay]},
											{$eq: ["$status",Constants.CLOSE]},
											{$eq: ["$type",Constants.WEEK_DAY]},
										]
									}
								}},
							],
							as	:	"close_day_details"
						}},
						{$match: {
							close_day_details : {$size : 0}
						}}
					]).toArray().then((result)=>{
						callback(null,result);
					}).catch((err)=>{
						callback(err);
					});
				},
				delete_branch_list : (callback)=>{
					/** Set conditions */
					let deleteConditions = {
						created	 :	{
							$gte : startDate,
							$lte : endDate,
						},
					};

					if(branchId) deleteConditions = {branch_id: branchId, ...deleteConditions};

					/** update as delete */
					restaurant_open_branches.updateMany(deleteConditions,{$set: { to_be_deleted: deleteAbleId }}).then((result)=>{
						callback(null,result);
					}).catch((err)=>{
						callback(err);
					});
				},
			},(asyncErr,asyncResponse)=>{
				if(asyncErr){
					console.log("Async parallel error on branchCron at saveOpenBranchList");
					return console.log(asyncErr);
				}

				if(asyncResponse?.open_branch_list?.length >0){

					asyncEach(asyncResponse.open_branch_list,(records, eachCallback)=>{

						asyncParallel({
							close_list : (parallelCallback)=>{
                               if(!records?.exception_details?.length) return parallelCallback(null);

								asyncEach(records.exception_details,(closeRecords, eachCloseCallback)=>{
									let fromHour 	=	closeRecords?.from_hour || "00";
									let fromMinute 	=	closeRecords?.from_minute || "00";
									let toHour 		=	closeRecords?.to_hour || "00";
									let toMinute 	=	closeRecords?.to_minute || "00";

									if(String(fromMinute).length ==1) 	fromMinute 	= 	"0"+fromMinute;
									if(String(toMinute).length ==1) 	toMinute	= 	"0"+toMinute;

									restaurant_open_branches.updateOne({
										branch_id 		: 	records.branch_id,
										restaurant_id 	:	records.restaurant_id,
										created			:	{
											$gte : startDate, $lte : endDate,
										},
										type	: Constants.CLOSE,
										from 	: parseFloat(fromHour+"."+fromMinute),
										to 		: parseFloat(toHour+"."+toMinute)
									},
									{
										$set : {
											modified: Helper.getUtcDate()
										},
										$setOnInsert : {
											created: endDate
										},
										$unset : {
											to_be_deleted : 1
										}
									},{upsert : true}).then((result)=>{
										eachCloseCallback(null,result);
									}).catch((err)=>{
										eachCloseCallback(err);
									});
								},(asyncEachCloseErr)=>{
									parallelCallback(asyncEachCloseErr);
								});
							},
							sw_list : (parallelCallback)=>{
								if(!records?.sw_details?.length) return parallelCallback(null);

								asyncEach(records.sw_details,(swRecords, eachSwCallback)=>{
									let fromHour 	=	swRecords?.from_hour || "00";
									let fromMinute 	=	swRecords?.from_minute || "00";
									let toHour 		=	swRecords?.to_hour || "00";
									let toMinute 	=	swRecords?.to_minute || "00";

									if(String(fromMinute).length ==1) 	fromMinute 	= 	"0"+fromMinute;
									if(String(toMinute).length ==1) 	toMinute	= 	"0"+toMinute;

									restaurant_open_branches.updateOne({
										branch_id 		: 	records.branch_id,
										restaurant_id 	:	records.restaurant_id,
										created			:	{
											$gte : startDate, $lte : endDate,
										},
										type	: Constants.OPEN,
										from 	: parseFloat(fromHour+"."+fromMinute),
										to 		: parseFloat(toHour+"."+toMinute)
									},
									{
										$set : {
											modified: Helper.getUtcDate()
										},
										$setOnInsert : {
											created : endDate
										},
										$unset : {
											to_be_deleted : 1
										}
									},{upsert : true}).then((result)=>{
										eachSwCallback(null,result);
									}).catch((err)=>{
										eachSwCallback(err);
									});
								},(asyncSwErr)=>{
									parallelCallback(asyncSwErr);
								});
							},
							open_list : (parallelCallback)=>{
								if(records?.sw_details?.length) return parallelCallback(null);

								let fromHour 	=	records?.from_hour || "00";
								let fromMinute 	=	records?.from_minute || "00";
								let toHour 		=	records?.to_hour || "00";
								let toMinute 	=	records?.to_minute || "00";

								if(String(fromMinute).length ==1) 	fromMinute 	= 	"0"+fromMinute;
								if(String(toMinute).length ==1) 	toMinute	= 	"0"+toMinute;

								restaurant_open_branches.updateOne({
									branch_id 		: 	records.branch_id,
									restaurant_id 	:	records.restaurant_id,
									created			:	{
										$gte : startDate, $lte : endDate,
									},
									type	: Constants.OPEN,
									from 	: parseFloat(fromHour+"."+fromMinute),
									to 		: parseFloat(toHour+"."+toMinute)
								},
								{
									$set : {
										modified: Helper.getUtcDate()
									},
									$setOnInsert : {
										created : endDate
									},
									$unset : {
										to_be_deleted : 1
									}
								},{upsert : true}).then((result)=>{
									parallelCallback(null,result);
								}).catch((err)=>{
									parallelCallback(err);
								});
							},
						},(asyncParallelErr)=>{
							eachCallback(asyncParallelErr);
						});
					},(asyncEachErr)=>{
						if(asyncEachErr){
							console.log("Async each error on branchCron at saveOpenBranchList");
							return console.log(asyncEachErr);
						}

						asyncParallel({
							delete_branch_list : (subCallback)=>{
								/** Set conditions */
								let deleteConditions = {
									created	 :	{
										$gte : startDate,
										$lte : endDate,
									},
									to_be_deleted: deleteAbleId
								};

								if(branchId) deleteConditions = {branch_id: branchId, ...deleteConditions};

								/** Mark as delete */
								restaurant_open_branches.deleteMany(deleteConditions).then((result)=>{
									subCallback(null,result);
								}).catch((err)=>{
									subCallback(err);
								});
							},
						},(asyncSubErr)=>{
							if(asyncSubErr){
								console.log("Async sub parallel error on branchCron at saveOpenBranchList");
								return console.log(asyncSubErr);
							}
						});
					});
				}
			});
			if(branchId) return "";
			res.render('blank',{layout:false});
		} catch (error) {
			console.log("Error on branchCron at saveOpenBranchList");
			return console.log(error);
		}
	};//End saveOpenBranchList()

	/**
	 * Function to save branch open status
	 *  Frequency : every 5 minutes
	 *
	 * @param req 	As	 Request Data
	 * @param res 	As	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render driver_excuses
	 */
	async saveBranchOpenStatus (req, res,next){
		/** Send response to client and work in background */
		res.render('blank',{layout:false});

		try {
			let startDate 	= 	Helper.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT);
			let endDate 	= 	Helper.newDate("",Constants.CURRENTDATE_END_DATE_FORMAT);
			let currentTime =	Helper.newDate("",Constants.OPEN_TIME_FORMAT);
			startDate 		= 	Helper.newDate(startDate);
			endDate 		=	Helper.newDate(endDate);
			currentTime 	=	parseFloat(currentTime.replace(':','.'));

			const restaurant_open_branches = this.db.collection(Tables.RESTAURANT_OPEN_BRANCHES);
			asyncParallel({
				branch_list : (parentCallback)=>{
					/** Get branch open status */
					restaurant_open_branches.aggregate([
						{$match :{
							created: {
								$gte: startDate, $lte: endDate,
							},
						}},
						{$addFields:{
							is_overnight: {$cond: [
								{$and: [
									{$lt: ["$to", "$from"] },
								]},
								true, false
							]}
						}},
						{$match :{
							$or: [
								{
									type	: 	Constants.OPEN,
									$and	:	[
										{$or:	[
											{from: 	{$lte: currentTime}},
											{
												is_overnight : true,
												from: 	{$gte: currentTime},
												to: 	{$gte: currentTime}
											}
										]},
										{$or:	[
											{to :{$gte: currentTime}},
											{is_overnight : true}
										]}
									]
								},
								{
									type	: 	Constants.CLOSE,
									from 	: 	{$lte: currentTime},
									to 		:	{$gte: currentTime}
								}
							]
						}},
						{$group :{
							_id 		:	"$branch_id",
							open_from	: 	{$min: "$from"},
							close_to	: 	{$max: "$to"},
							open_count  : 	{$sum: {$cond: [
									{$and: [
										{ $eq : ["$type", Constants.OPEN] },
									]},
									1,0
								]},
							},
							close_count  : {$sum: {$cond: [
									{$and: [
										{ $eq : ["$type", Constants.CLOSE] },
									]},
									1,0
								]},
							},
						}},
						{$match : {
							open_count  : {$gte: 1},
							close_count : {$lt : 1},
						}}
					]).toArray().then((result)=>{
						parentCallback(null,result);
					}).catch((err)=>{
						parentCallback(err);
					});
				},
				open_branch_list : (parentCallback)=>{
					restaurant_open_branches.aggregate([
						{$match :{
							type	: 	Constants.OPEN,
							created	: 	{
								$gte: startDate, $lte: endDate,
							},
						}},
						{$group :{
							_id 		:	"$branch_id",
							open_from	: 	{$min: "$from"},
							close_to	: 	{$max: "$to"},
						}},
					]).toArray().then((result)=>{
						parentCallback(null,result);
					}).catch((err)=>{
						parentCallback(err);
					});
				},
			},(parentAsyncErr,parentAsyncResponse)=>{
				if(parentAsyncErr){
					console.log("parent parallel on branchCron at saveBranchOpenStatus");
					return console.log(parentAsyncErr);
				}

				let branchIds 		= 	[];
				let branchList 		=	parentAsyncResponse?.branch_list || [];
				let branchOpenList 	=	parentAsyncResponse?.open_branch_list || [];
				if(branchList?.length >0){
					branchList.map(records=>{
						branchIds.push(records._id);
					});
				}

				const restaurant_branches = this.db.collection(Tables.RESTAURANT_BRANCHES);
				asyncParallel({
					mark_branch_open : (callback)=>{
						/** update branch details */
						restaurant_branches.find({
							_id		: { $in: branchIds },
							is_open	: Constants.CLOSE,
						},{projection: { _id: 1 }}).toArray().then((result) => {

							restaurant_branches.updateMany({
								_id : {$in: branchIds}
							},
							{$set: {
								is_open: Constants.OPEN,
							}}).then(()=>{

								if(result?.length >0){
									result.forEach(record => {
										this.saveBranchOpenCloseLogs(req, res, next, {
											status: Constants.BRANCH_OPEN,
											branch_id: record._id
										});
									});
								}
								callback(null,null);
							}).catch((err)=>{
								callback(err);
							});
						}).catch((err)=>{
							callback(err);
						});
					},
					mark_branch_close : (callback)=>{
						/** update branch details */
						restaurant_branches.find({
							_id		: { $nin: branchIds },
							is_open	: Constants.OPEN,
						},{projection: { _id: 1 } }).toArray().then((result) => {

							restaurant_branches.updateMany({
								_id : {$nin: branchIds}
							},
							{$set: {
								is_open: Constants.CLOSE,
							}}).then(()=>{

								if(result?.length >0){
									result.forEach(record => {
										this.saveBranchOpenCloseLogs(req,res,next, {status: Constants.CLOSE, branch_id: record._id});
									});
								}

								callback(null,null);
							}).catch((err)=>{
								callback(err);
							});
						}).catch((err)=>{
							callback(err);
						});
					},
					update_branch_hours : (callback)=>{
						if(!branchOpenList?.length) return callback(null);

						asyncEach(branchOpenList,(records, eachCallback)=>{
							let openTime	= 	parseFloat(records.open_from).toFixed(Constants.ROUND_PRECISION);
							let closeTime 	=	parseFloat(records.close_to).toFixed(Constants.ROUND_PRECISION);
							if(openTime.length<=4) 	openTime	= 	"0"+openTime;
							if(closeTime.length<=4) closeTime 	=	"0"+closeTime;

							/** update branch details */
							restaurant_branches.updateOne({
								_id : records._id
							},
							{$set: {
								open_time : openTime,
								close_time:	closeTime,
							}}).then(()=>{
								eachCallback(null,null);
							}).catch((err)=>{
								eachCallback(err);
							});
						},(asyncEachErr)=>{
							callback(asyncEachErr);
						});
					}
				},(asyncErr)=>{
					if(asyncErr){
						console.log("Async parallel error on branchCron at saveBranchOpenStatus",asyncErr);
					}
				});
			});
		} catch (error) {
			console.log("Error on branchCron at saveBranchOpenStatus",error);
		}
	};//End saveBranchOpenStatus()

	/**
	 * Function to save branch open close logs
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return JSON
	 */
	async saveBranchOpenCloseLogs (req, res, next, options) {
		try {
			let branchId = (options.branch_id) ? new ObjectId(options.branch_id) : "";
			let branchStatus = (options.status == Constants.CLOSE) ? Constants.CLOSE : Constants.BRANCH_OPEN;

			let dataToBeUpdate = {
				status: parseInt(branchStatus),
				modified: Helper.getUtcDate(),
			};

			let flag = true;
			if (branchStatus == Constants.CLOSE) {
				dataToBeUpdate.closing_time = Helper.getUtcDate();
				flag =false;
			}

			/** Get Branch details **/
			const restaurant_branches = this.db.collection(Tables.RESTAURANT_BRANCHES);
			let result = await restaurant_branches.findOne({ _id: branchId }, { projection: { restaurant_id: 1 } });

			let restaurantId = (result && result.restaurant_id) ? new ObjectId(result.restaurant_id) : "";

			/** If restaurant id not found then return error */
			if(!restaurantId) return {
				status: Constants.STATUS_ERROR
			};

			const branch_open_close_logs = this.db.collection(Tables.BRANCH_OPEN_CLOSE_LOGS);
			await branch_open_close_logs.updateOne({
				branch_id: branchId,
				status: Constants.BRANCH_OPEN,
			},
			{
				$set: dataToBeUpdate,
				$setOnInsert: {
					restaurant_id: restaurantId,
					created		: Helper.getUtcDate(),
					opening_time :Helper.getUtcDate(),
				}
			}, { upsert: flag });

			return {
				status: Constants.STATUS_SUCCESS
			};
		} catch (error) {
			console.log("Error on branchCron at saveBranchOpenCloseLogs catch block",error);
		}
	};// End saveBranchOpenCloseLogs()

	/**
	 * Function to update order rules status
	 *  Frequency : every 1 minutes
	 *
	 * @param req 	As	 Request Data
	 * @param res 	As	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render null
	 */
	async updateOrderRulesStatus (req, res,next){
		/** Send response to client and work in background */
		res.render('blank',{layout:false});

		let orderTypeArray = [
			// {
			// 	from 	: 	ORDER_PENDING,
			// 	to 	 	: 	ORDER_CONFIRMED,
			// 	effected_status : "is_delayed_acceptance",
			// 	minutes 	: DELAYED_ACCEPTANCE_MINUTE
			// },
			{
				from 	: 	Constants.ORDER_PENDING,
				to 	 	: 	Constants.ORDER_PREPARING,
				effected_status : "is_delayed_acceptance",
				minutes :	Constants.DELAYED_ACCEPTANCE_MINUTE
			},
			{
				from 	: 	Constants.ORDER_PREPARING,
				to 	 	: 	Constants.ORDER_READY_TO_PICK_UP,
				effected_status : "is_delayed_preperation"
			},
			{
				from 	: 	Constants.ORDER_READY_TO_PICK_UP,
				to 	 	: 	Constants.ORDER_ON_THE_WAY,
				effected_status : "is_delayed_pickup_by_captain",
				is_assign_caption : true,
				minutes : Constants.DELAYED_PICKUP_BY_CAPTAIN_MINUTE,
			},
			{
				from 	: 	Constants.ORDER_ON_THE_WAY,
				to 	 	: 	Constants.ORDER_DELIVERED,
				is_assign_caption : true,
				effected_status : "is_delayed_delivery"
			},
			{
				from 	: 	Constants.ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION,
				to 	 	: 	Constants.ORDER_DELIVERED,
				effected_status : "is_delayed_picked_up_by_customer",
				minutes : Constants.DELAYED_PICKEDUP_BY_CUSTOMER_MINUTE,
			},
			{
				from 	: 	Constants.ORDER_READY_TO_PICK_UP,
				to 	 	: 	Constants.ORDER_ON_THE_WAY,
				effected_status : "is_delayed_pickup",
				minutes : Constants.DELAYED_PICKEDUP_BY_CRAVEZ_OR_RESTAURANT_MINUTE,
			},
		];

		let ruleProcessTime	=	Helper.newDate(Helper.newDate(Constants.ORDER_RULE_PROCESS_TIME_IN_MINUTES));
		let tmpOrderDate	=	Helper.newDate(Helper.subtractDate(Constants.HOURS_IN_A_DAY),Constants.CURRENTDATE_START_DATE_FORMAT);

		const orders = this.db.collection(Tables.ORDERS);
		asyncParallel({
			order_list : (callback)=>{
				/** Set order conditions */
				let orderConditions = {
					order_date	: {$gte: Helper.newDate(tmpOrderDate)},
					is_completed: {$exists: false},
					$or 		:	[
						{rule_process_time: {$exists : false }},
						{rule_process_time: {$lte 	 : ruleProcessTime }},
					],
				};

				/** Get orders list */
				orders.find(orderConditions,{projection: {delivery_type: 1, captain_id:1, captain_name:1, delivery_status:1,is_delayed_acceptance:1,is_delayed_preperation:1,is_delayed_pickup_by_captain:1,is_delayed_delivery:1,is_delayed_picked_up_by_customer:1,is_delayed_pickup:1,is_confirm:1}}).toArray().then(orderResult=>{
					if(orderResult.length <=0) return callback(null,null);

					let orderIds 	=	[];
					let orderObject =	{};
					orderResult.map(records=>{
						orderIds.push(records._id);
						orderObject[records._id] = records;
					});

					callback(null,{
						order_ids 	: 	orderIds,
						order_list 	:	orderObject,
					});
				}).catch(err=>{
					callback(err);
				});
			},
			pickup_delayed_voc_list : (callback)=>{
				let deliveryVocOptions ={
					type 		: Constants.VOC_TYPE_FOR_CAPTAIN_DELAYED_PICK_UP_TIME,
					user_type 	: Constants.VOC_FOR_CAPTAIN,
				};

				/**Get voc question list **/
				Helper.getUserVocQuestionList(req,res, next,deliveryVocOptions).then(vocResponse=> {
					if(vocResponse.status != Constants.STATUS_SUCCESS) return callback(vocResponse);
					callback(null,vocResponse.questions);
				}).catch(next);
			},
			delivery_delayed_voc_list : (callback)=>{
				let deliveryVocOptions ={
					type 		: Constants.VOC_TYPE_FOR_CAPTAIN_DELAY_IN_ORDER_DELIVERY,
					user_type 	: Constants.VOC_FOR_CAPTAIN,
				};

				/**Get voc question list **/
				Helper.getUserVocQuestionList(req,res, next,deliveryVocOptions).then(vocResponse=> {
					if(vocResponse.status != Constants.STATUS_SUCCESS) return callback(vocResponse);
					callback(null,vocResponse.questions);
				}).catch(next);
			},
		},async (asyncErr, asyncResponse)=>{
			if(asyncErr){
				console.error("Async parallel error on updateOrderRulesStatus",asyncErr);
			}

			if(asyncResponse?.order_list && asyncResponse?.order_ids?.length){
				let orderIds 				= 	asyncResponse?.order_list?.order_ids;
				let orderObject 			= 	asyncResponse?.order_list?.order_list;
				let deliveryDelayedVocList 	= 	asyncResponse?.delivery_delayed_voc_list;
				let pickupDelayedVocList 	=	asyncResponse?.pickup_delayed_voc_list;

				await orders.updateMany({_id:{$in: orderIds}},{$set:{rule_process_time: Helper.getUtcDate() }});

				const order_details 	= 	this.db.collection(Tables.ORDER_DETAILS);
				const voc_responses 	= 	this.db.collection(Tables.VOC_RESPONSES);
				const order_status_logs = 	this.db.collection(Tables.ORDER_STATUS_LOGS);
				eachOfSeries(orderTypeArray,(records, firstKey, eachCallback)=>{
					let formStatus 		=	records.from;
					let toStatus 		= 	records.to;
					let effectedStatus 	= 	records.effected_status;
					let minutes 		= 	records.minutes;
					let isAssignCaption	= 	records.is_assign_caption;

					/** Set log conditions */
					let logConditions = {
						order_id : 	{$in : orderIds},
						status 	 : 	formStatus,
					};

					/** Get order logs details */
					order_status_logs.find(logConditions).toArray().then(logResult=>{
						if(logResult.length <= 0) return eachCallback(null);

						eachOfSeries(logResult,(logData, secondKey, eachSubCallback)=>{
							let orderId 		= 	logData.order_id;
							let created 		= 	logData.created;
							let tmpDeliveryType =	(orderObject[orderId].delivery_type) ? orderObject[orderId].delivery_type :"";

							if(effectedStatus == "is_delayed_acceptance" && !orderObject[orderId].is_confirm) return eachSubCallback(null);

							if(effectedStatus == "is_delayed_pickup_by_captain" && tmpDeliveryType != Constants.DELIVERY_BY_CRAVEZ)  return eachSubCallback(null);

							if(effectedStatus == "is_delayed_pickup" && tmpDeliveryType != Constants.DELIVERY_BY_RESTAURANT)  return eachSubCallback(null);

							/** Check caption is assign or not */
							if(isAssignCaption){
								let tmpCaptionId 	= (orderObject[orderId].captain_id) ? orderObject[orderId].captain_id :"";
								let tmpCaptionName 	= (orderObject[orderId].captain_name) ? orderObject[orderId].captain_name :"";

								if(tmpDeliveryType == Constants.DELIVERY_BY_CRAVEZ && !tmpCaptionId){
									return eachSubCallback(null);
								}else if(tmpDeliveryType == Constants.DELIVERY_BY_RESTAURANT && !tmpCaptionName){
									return eachSubCallback(null);
								}
							}

							asyncParallel({
								order_details : (parallelCallback)=>{
									if(effectedStatus != "is_delayed_preperation" && effectedStatus != "is_delayed_delivery" && effectedStatus != "is_delayed_pickup_by_captain") return parallelCallback(null);

									/** Get order details */
									order_details.findOne({ order_id:  orderId},{projection: {delivery_duration: 1, preparation_time: 1,customer_longitude:1,customer_latitude:1,restaurant_latitude:1,restaurant_longitude:1,customer_id:1,device_id:1}}).then(detailsResult=>{
										parallelCallback(null,detailsResult);
									}).catch(err=>{
										parallelCallback(err);
									});
								},
							},(parallelErr, parallelResponse)=>{
								if(parallelErr) return eachSubCallback(parallelErr);

								let orderSubDetails = (parallelResponse.order_details) ? parallelResponse.order_details :{};

								let customerLatitude    = (orderSubDetails.customer_latitude)    ? orderSubDetails.customer_latitude 	:"";
								let customerLongitude   = (orderSubDetails.customer_longitude)   ? orderSubDetails.customer_longitude 	:"";
								let restaurantLongitude = (orderSubDetails.restaurant_longitude) ? orderSubDetails.restaurant_longitude :"";
								let restaurantLatitude  = (orderSubDetails.restaurant_latitude)  ? orderSubDetails.restaurant_latitude  :"";
								let deviceId = (orderSubDetails.device_id) ?orderSubDetails.device_id 	:"";
								let userId  = (orderSubDetails.customer_id)? orderSubDetails.customer_id :"";
								let deliveryDuration  = (orderSubDetails.delivery_duration)? orderSubDetails.delivery_duration :0;
								let preparationTime  = (orderSubDetails.preparation_time)? orderSubDetails.preparation_time :0;

								let deliveryBy    = (orderObject[orderId]) ? orderObject[orderId].delivery_type  :"";
								let deliveryStatus= (orderObject[orderId]) ? orderObject[orderId].delivery_status :"";

								if(effectedStatus == "is_delayed_preperation" && preparationTime){
									minutes = preparationTime;
								}else if(effectedStatus == "is_delayed_delivery" && deliveryDuration){
									minutes = deliveryDuration;
								}

								if(minutes<=0) return eachSubCallback(null);

								let hours	  = minutes/Constants.MINUTES_IN_A_HOUR;
								let checkDate =	Helper.newDate(Helper.addDaysToDate(hours,created));

								/** Check status time is more than current time like delivery time 2.30 or current time is 2.00 */
								if(checkDate > Helper.newDate()) return eachSubCallback(null);

								/** Set conditions */
								let orderOnTimeConditions ={
									order_id			:  orderId,
									status				:  toStatus,
									status_changed_from	:  formStatus,
									created				:   {
										$gt : Helper.newDate(created),
										$lt : Helper.newDate(checkDate)
									},
								};

								if(effectedStatus == "is_delayed_delivery"){
									orderOnTimeConditions.status = {$in : [toStatus, Constants.ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION ]};
								}
								if(effectedStatus == "is_delayed_acceptance"){
									orderOnTimeConditions.status_changed_from = {$in: [formStatus, Constants.ORDER_SCHEDULED]};
								}

								// if(effectedStatus == "is_delayed_acceptance"){
								// 	delete orderOnTimeConditions.status;
								// 	delete orderOnTimeConditions.status_changed_from;

								// 	orderOnTimeConditions["$or"] = [
								// 		{
								// 			status 				: Constants.ORDER_PREPARING,
								// 			status_changed_from : formStatus,
								// 		},
								// 		{
								// 			status 				: toStatus,
								// 			status_changed_from : Constants.ORDER_NOT_CONFIRMED,
								// 		}
								// 	];
								// }

								asyncParallel({
									get_distance_between_locations : (childCallback)=>{
										return childCallback(null,null);

										// if(effectedStatus != "is_delayed_pickup_by_captain" && effectedStatus != "is_delayed_delivery") return childCallback(null,null);

										// /** Get driver distance in meters **/
										// this.assignmentModel.getDistanceBetweenLocations(req,res,next,{
										// 	locations 		 : [{ latitude  : customerLatitude, longitude : customerLongitude}],
										// 	pickup_latitude  : restaurantLatitude,
										// 	pickup_longitude : restaurantLongitude,
										// }).then((locationResponse)=>{
										// 	childCallback(null,locationResponse);
										// }).catch(next);
									},
									order_status_logs : (childCallback)=>{
										/** Check order status update on time */
										order_status_logs.findOne(orderOnTimeConditions,{projection: {_id: 1}}).then(orderOnTimeResult=>{
											childCallback(null,orderOnTimeResult);
										}).catch(err=>{
											childCallback(err);
										});
									}
								},(childAsyncErr,childAsyncResponse)=>{
									if(childAsyncErr) return eachSubCallback(childAsyncErr);

									let getDistanceBetweenLocations = (childAsyncResponse.get_distance_between_locations) ? childAsyncResponse.get_distance_between_locations :{};

									// if(getDistanceBetweenLocations && getDistanceBetweenLocations.status == Constants.STATUS_ERROR){
									// 	console.error("\n Get distance error in updateOrderRulesStatus");
									// 	console.error(getDistanceBetweenLocations.message);
									// }

									let locations 	 	   = (getDistanceBetweenLocations.locations && getDistanceBetweenLocations.locations[0]) ? getDistanceBetweenLocations.locations[0] : {};
									let distanceInMeters   = (locations.distance_in_meters) ? parseInt(locations.distance_in_meters) :0;
									let orderOnTimeResult  = childAsyncResponse.order_status_logs;

									/** Set update data */
									let updateOrderData = {
										$set :{
											modified : Helper.getUtcDate()
										},
										$unset : {
											rule_process_time : 1
										},
									};

									let orderDelayFlag	=	(orderOnTimeResult) ? false :true;
									updateOrderData["$set"][effectedStatus] = 	orderDelayFlag;

									if(orderDelayFlag){
										updateOrderData["$set"].is_delayed = orderDelayFlag;
									}

									if(effectedStatus == "is_delayed_pickup_by_captain" || effectedStatus == "is_delayed_delivery"){
										updateOrderData["$set"].is_delayed = orderDelayFlag;
									}

									/** Update order details */
									orders.updateOne({_id: orderId},updateOrderData).then(()=>{

										if(orderDelayFlag){
											/** Set options */
											let ticketOptions = {
												order_id : orderId
											};
											if(effectedStatus == "is_delayed_preperation"){
												ticketOptions.type = Constants.AUTOMATED_TICKET_FOR_DELAYED_PREPRATION;
											}else if(effectedStatus == "is_delayed_pickup_by_captain" && deliveryBy == Constants.DELIVERY_BY_CRAVEZ){
												ticketOptions.type = Constants.AUTOMATED_TICKET_FOR_DELAYED_PICKUP_ORDER;
											}else if(effectedStatus == "is_delayed_pickup" && deliveryBy == Constants.DELIVERY_BY_RESTAURANT){
												ticketOptions.type = Constants.AUTOMATED_TICKET_FOR_FOLLOW_UP_RESTAURANT;
											}else if(effectedStatus == "is_delayed_delivery" && deliveryBy == Constants.DELIVERY_BY_CRAVEZ){
												ticketOptions.type = Constants.AUTOMATED_TICKET_FOR_DELAYED_DELIVER_ORDER;
											}else if(effectedStatus == "is_delayed_delivery" && deliveryBy == Constants.DELIVERY_BY_RESTAURANT){
												ticketOptions.type = Constants.AUTOMATED_TICKET_FOR_FOLLOW_UP_WITH_RESTAURANT_AND_CUSTOMER;
											}

											asyncParallel({
												save_voc_response : (childParallelCallback)=>{
													return childParallelCallback(null,null);

													if(effectedStatus != "is_delayed_pickup_by_captain" && effectedStatus != "is_delayed_delivery"){
														return childParallelCallback(null,null);
													}

													let vocType = (effectedStatus == "is_delayed_pickup_by_captain") ? Constants.VOC_TYPE_FOR_CAPTAIN_DELAYED_PICK_UP_TIME : Constants.VOC_TYPE_FOR_CAPTAIN_DELAY_IN_ORDER_DELIVERY;

													/** Check voc already exists or not */
													voc_responses.findOne({
														order_id:  orderId,
														type	:  vocType
													},{projection: {_id: 1}}).then(vocResult=>{
														if(vocResult) return childParallelCallback(null,null);

														let vocQuestions = [];
														if(effectedStatus == "is_delayed_pickup_by_captain"){
															vocQuestions = clone(pickupDelayedVocList);
														}else{
															vocQuestions = clone(deliveryDelayedVocList);
														}

														/** Push answer in question list **/
														vocQuestions.map(questionRecords=>{
															questionRecords.question_id = questionRecords._id;

															if(questionRecords.type == Constants.INPUT_VOC_QUESTION_TYPE){
																questionRecords.answer = String(distanceInMeters);
															}

															let deliveryStatusTitle = (Constants.DELIVERY_ORDER_STATUS[deliveryStatus] && Constants.DELIVERY_ORDER_STATUS[deliveryStatus].status_name) ? Constants.DELIVERY_ORDER_STATUS[deliveryStatus].status_name : "";

															questionRecords.options.map(optionRecords=>{
																if(optionRecords.option.toLowerCase() == deliveryStatusTitle.toLowerCase()){
																	questionRecords.answer 	  = deliveryStatusTitle;
																	questionRecords.answer_id = optionRecords.option_id;
																}
															});
														});

														/** Set options for save voc response **/
														let vocOptions = {
															user_type     : Constants.VOC_FOR_CAPTAIN,
															type 		  : vocType,
															user_id 	  : userId,
															order_id 	  : orderId,
															device_id 	  : deviceId,
															question_list : vocQuestions
														};
														/** Save voc response details**/
														Helper.saveVocResponses(req,res, next,vocOptions).then(saveVocResponse=> {
															childParallelCallback(null,saveVocResponse);
														}).catch(next);
													}).catch(err=>{
														childParallelCallback(err);
													});
												},
												generate_ticket : (childParallelCallback)=>{
													return childParallelCallback(null,null);

													if(Object.keys(ticketOptions).length ==1)  return childParallelCallback(null,null);

													/** Genrate ticket */
													Helper.generateTicket(req,res,next,ticketOptions).then(ticketResponse=>{
														childParallelCallback(null,ticketResponse);
													}).catch(next);
												}
											},(childParallelErr,childParallelResponse)=>{
												if(childParallelErr) return eachSubCallback(childParallelErr);

												let saveVoc         = childParallelResponse.save_voc_response;
												let generateTicket  = childParallelResponse.generate_ticket;

												if(saveVoc && saveVoc.status == Constants.STATUS_ERROR){
													console.error("\n Automatic voc error in updateOrderRulesStatus",saveVoc);
												}

												if(generateTicket && generateTicket.status == Constants.STATUS_ERROR){
													console.error("\n Automatic ticket error in updateOrderRulesStatus",generateTicket);
												}

												eachSubCallback(null);
											});
										}else{
											eachSubCallback(null);
										}
									}).catch(err=>{
										eachSubCallback(err);
									});
								});
							});
						},(asyncSubEachErr)=>{
							eachCallback(asyncSubEachErr);
						});
					}).catch(err=>{
						eachCallback(err);
					});
				},(asyncEachErr)=>{
					/** unset tmp order rule process time */
					orders.updateMany({_id: {$in:orderIds}},{$unset: {rule_process_time: 1}}).then(()=>{ });

					if(asyncEachErr){
						console.error("Async each error on updateOrderRulesStatus",asyncEachErr);
					}
				});
			}
		});

	};//End updateOrderRulesStatus()

    /**
	 * Function to update offer status
	 *
	 * @param req 	As	 Request Data
	 * @param res 	As	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render null
	 */
	async updateOfferStatus (req, res,next){
        /** Send response to client and work in background */
		res.render('blank',{layout:false});

		/** Update offer details */
		const offers = this.db.collection(Tables.OFFERS);
		offers.updateMany({
			status 	  	: 	Constants.OFFER_PUBLISHED,
			valid_to	:	{$lte: Helper.newDate()},
		},
		{$set: {
			status 	    : 	Constants.OFFER_EXPIRED,
			modified	:	Helper.getUtcDate()
		}}).then(()=>{}).catch(err=>{
			console.error("update many error in updateOfferStatus",err);
		});
	};//End updateOfferStatus()

	/**
	 * Function to update order delivery preparation time
	 *
	 * @param req 	As	 Request Data
	 * @param res 	As	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render null
	 */
	async updateOrderDeliveryPreparationTime (req, res,next){
		/** Send response to client and work in backgHelper.round */
		res.render('blank',{layout:false});

		/** Set order conditions */
		let orderProcessTime= Helper.newDate(Helper.subtractMinute(1));
		let tmpOrderDate	= Helper.newDate(Helper.subtractMinute(Constants.PREVIOUS_MAX_DAY_TO_UPDATE_REMAINING_PREPARATION_TIME_IN_ORDERS*Constants.HOURS_IN_A_DAY*Constants.MINUTES_IN_A_HOUR),Constants.CURRENTDATE_START_DATE_FORMAT);
		let orderConditions = {
			order_date	:	{$gte: Helper.newDate(tmpOrderDate)},
			order_assignment_start_time: {$lte: Helper.newDate(Helper.addMinute(2))},
			$and : [
				{is_completed: {$exists: false}},
				{is_completed: {$ne: true}},
				{$or :	[
					{prepare_time_proceed : {$exists: false}},
					{prepare_time_proceed : {$lte: orderProcessTime}}
				]}
			],
		};

		/** Get orders list */
		const orders = this.db.collection(Tables.ORDERS);
		orders.distinct("_id",orderConditions).then(orderIds=>{
			if(orderIds?.length <=0) return;

			if(orderIds && orderIds.length > 0){
				const users 		=	this.db.collection(Tables.USERS);
				const order_details = 	this.db.collection(Tables.ORDER_DETAILS);

				asyncParallel({
					update_order_details : (callback)=>{
						/** Update flag in orders table */
						orders.updateMany({_id: {$in: orderIds} },{ $set: {prepare_time_proceed  : Helper.getUtcDate() }}).then(()=>{
							callback(null);
						}).catch(err=>{
							callback(err);
						});
					},
					order_log_list : (callback)=>{
						/** Get order log list */
						const order_status_logs = this.db.collection(Tables.ORDER_STATUS_LOGS);
						order_status_logs.find({
							order_id : {$in : orderIds},
							status	 : {$in: [Constants.ORDER_PREPARING, Constants.ORDER_READY_TO_PICK_UP]}
						},{projection: {created:1,order_id:1}}).sort({_id: Constants.SORT_DESC}).toArray().then(result=>{
							if(result.length <=0) return callback(null,null);

							let finalLogList = {};
							result.map(records=>{
								finalLogList[records.order_id] = records;
							});

							callback(null,finalLogList);
						}).catch(err=>{
							callback(err);
						});
					},
					order_details : (callback)=>{
						/** Set order details  */
						let orderDetailsConditions ={
							order_id : {$in : orderIds},
							$or 	 : [
								{$or:[
									{remaining_preparation_time: {$exists: false}},
									{remaining_delivery_duration: {$exists: false}},
								]},
								{remaining_preparation_time: {$gt: 0}},
								{remaining_delivery_duration: {$gt: 0}},
							],
						};

						/** Get order details */
						order_details.find(orderDetailsConditions,{projection: {_id:1,order_id:1,delivery_duration:1,preparation_time:1}}).toArray().then(result=>{
							if(result.length <=0) return callback(null,null);

							let finalList = {};
							result.map(records=>{
								finalList[records.order_id] = records;
							});
							callback(null,finalList);
						}).catch(err=>{
							callback(err);
						});
					},
				},(asyncErr,asyncResponse)=>{
					if(asyncErr){
						console.error("First parallel error at orderCron in updateOrderDeliveryPreparationTime",asyncErr);
					}

					if(asyncResponse?.order_log_list && asyncResponse?.order_details){
						let logList 	=  	asyncResponse?.order_log_list;
						let orderList 	=  	asyncResponse?.order_details;
						let updatedList =	[];

						Object.keys(logList).map(orderId=>{
							if(orderList[orderId]){
								let orderDetails	=	orderList[orderId];
								let logCreated 		=	logList[orderId].created;
								let deliveryTime 	= 	(orderDetails.delivery_duration) ? orderDetails.delivery_duration    :0;
								let preparationTime	= 	(orderDetails.preparation_time)? orderDetails.preparation_time :0;
								let deliveryDate	=	Helper.addDaysToDate((deliveryTime/Constants.MINUTES_IN_A_HOUR),logCreated);
								let preparationDate	=	Helper.addDaysToDate((preparationTime/Constants.MINUTES_IN_A_HOUR),logCreated);

								let remainingDeliveryMinute 	= 	Helper.getDifferenceBetweenTwoDatesInMinute(Helper.newDate(),deliveryDate);
								let remainingPreparationMinute 	=	Helper.getDifferenceBetweenTwoDatesInMinute(Helper.newDate(),preparationDate);

								updatedList.push({
									order_id : orderId,
									preparation_minute 	: (remainingPreparationMinute >0) ? Helper.round(remainingPreparationMinute,0): 0,
									delivery_minute 	: (remainingDeliveryMinute >0) ? Helper.round(remainingDeliveryMinute,0): 0,
								});
							}
						});

						if(updatedList.length > 0){
							eachOfSeries(updatedList,(records, seriesKey, callback)=>{
								let orderMainId 		= 	new ObjectId(records.order_id);
								let odDeliveryTime 		=	records.delivery_minute;
								let odPreparationTime 	=	records.preparation_minute;

								asyncParallel({
									update_order_details : (parallelCallback)=>{
										/** Update order details */
										order_details.updateOne({
											order_id: orderMainId
										},
										{$set: {
											modified : Helper.getUtcDate(),
											remaining_preparation_time	: odPreparationTime,
											remaining_delivery_duration : odDeliveryTime
										}}).then(()=>{
											parallelCallback(null);
										}).catch(err=>{
											parallelCallback(err);
										});
									},
									update_order : (parallelCallback)=>{
										/** Update order main details */
										orders.updateOne({
											_id: orderMainId
										},
										{
											$set: {
												remaining_delivery_duration: odDeliveryTime,
												remaining_preparation_time: odPreparationTime
											},
											$unset: {
												prepare_time_proceed : 1
											}
										}).then(()=>{
											parallelCallback(null);
										}).catch(err=>{
											parallelCallback(err);
										});
									},
									update_driver : (parallelCallback)=>{

										/** Set user conditions */
										let driverConditions = 	clone(Constants.DRIVER_COMMON_CONDITIONS);
										driverConditions["orders.order_id"]	=	orderMainId;

										/** Get assign order driver list */
										users.find(driverConditions,{projection: {_id:1, orders:1 }}).toArray().then(userResult=>{
											if(userResult.length == 0) return parallelCallback(null);

											eachOfSeries(userResult,(userData, seriesIndex, subCallback)=>{

												let totalDeliveryTime 	 =	odDeliveryTime;
												let totalpreparationTime =	odPreparationTime;
												userData.orders.map(tmpData=>{
													if(String(tmpData.order_id) != String(orderMainId)){
														if(tmpData.free_in) 		  	totalDeliveryTime 	 += tmpData.free_in;
														if(tmpData.preparation_time)	totalpreparationTime += tmpData.preparation_time;
													}
												});

												/** Update users order detail accordingly */
												users.updateOne({
													_id		: 	userData._id,
													orders	:	{$elemMatch: { order_id: orderMainId } }
												},
												{$set :{
													free_in			   			: 	parseInt(totalDeliveryTime),
													order_prepare_remaining_time: 	parseInt(totalpreparationTime),
													"orders.$.free_in" 			: 	parseInt(odDeliveryTime),
													"orders.$.preparation_time" :	parseInt(odPreparationTime)
												}}).then(()=>{
													subCallback(null);
												}).catch(err=>{
													subCallback(err);
												});
											},(asyncChildErr)=>{
												parallelCallback(asyncChildErr);
											});
										}).catch(err=>{
											parallelCallback(err);
										});
									},
								},(asyncErr)=>{
									callback(asyncErr);
								});
							},(asyncErr)=>{
								/** Unset prepare_time_proceed flag */
								orders.updateMany({_id: {$in: orderIds} },{$unset: {prepare_time_proceed  : 1 }}).then(()=>{ });

								if(asyncErr){
									console.error("Async error at orderCron in updateOrderDeliveryPreparationTime",asyncErr);
								}
							});
						}else{
							/** Unset prepare_time_proceed flag */
							orders.updateMany({_id: {$in: orderIds} },{$unset: {prepare_time_proceed  : 1 }}).then(()=>{ });
						}
					}else{
						/** Unset prepare_time_proceed flag */
						orders.updateMany({_id: {$in: orderIds} },{$unset: {prepare_time_proceed  : 1 }}).then(()=>{ });
					}
				});
			}
		}).catch(err=>{
			console.error("Error at orderCron in updateOrderDeliveryPreparationTime in distinct query",err);
		});
	};//End updateOrderDeliveryPreparationTime()

	/**
	 * Function to order scheduled (frequency time: every 1mins )
	 *
	 * @param req 	As	 Request Data
	 * @param res 	As	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render null
	 */
	async orderScheduled (req, res,next){
		/** Send response to client and work in backgHelper.round */
		res.render('blank',{layout:false});

		let orderProcessTime = Helper.newDate(Helper.subtractMinute(Constants.ORDER_PROCESS_TIME_IN_MINUTES));
        let tmpOrderDate	 = Helper.newDate(Helper.subtractMinute(Constants.PREVIOUS_MAX_DAY_TO_UPDATE_ORDER_STATUS_SCHEDULED_TO_SUBMITTED*Constants.HOURS_IN_A_DAY*Constants.MINUTES_IN_A_HOUR),Constants.CURRENTDATE_START_DATE_FORMAT);
		let orderIdsObj = {};

		const orders = this.db.collection(Tables.ORDERS);
		asyncParallel({
			order_list : (callback)=>{
				/** Set order conditions */
				let orderConditions = {
					order_date		: {$gte: Helper.newDate(tmpOrderDate)},
					order_status 	: {$nin : [
						Constants.ORDER_DELIVERED,
						Constants.ORDER_CANCELLED,
						Constants.ORDER_REJECTED,
						Constants.ORDER_REJECTED_BY_ADMIN,
					]},
					scheduled_date	: {$lte: Helper.newDate()},
					is_schedule		: true,
					$and			:	[
						{scheduled_to_submit_time: {$exists : false }},
						{$or :	[
							{is_completed: {$exists  :false }},
							{is_completed: {$ne 	 :true }},
						]},
						{$or :	[
							{scheduled_process_time: {$exists : false }},
							{scheduled_process_time: {$lte 	 : orderProcessTime }},
						]}
					]
				};

				/** Get orders list */
				orders.find(orderConditions).toArray().then(result=>{
					let allOrderIds = [];
					result.map(records=>{
						allOrderIds.push(records._id);
					});

					orders.updateMany({_id:{$in: allOrderIds}},{$set:{scheduled_process_time: Helper.getUtcDate() }}).then(()=>{
						callback(null, result);
					}).catch(err=>{
						callback(err);
					});
				}).catch(err=>{
					callback(err);
				});
			},
			user_details : (callback)=>{
				/** Get user details */
				const users = this.db.collection(Tables.USERS);
				users.findOne({user_role_id : Constants.SYSTEM_ADMIN_ROLE_ID },{projection:{_id:1}}).then(result=>{
					callback(null, result);
				}).catch(err=>{
					callback(err);
				});
			},
		},(asyncErr,asyncResponse)=>{
			if(asyncErr){
				return console.error("async parallel Error at orderCron in orderScheduled",asyncErr);
			}

			let orderList  	= 	asyncResponse?.order_list || [];
			let adminId     =	asyncResponse?.user_details?._id || "";
			if(orderList?.length > 0 && adminId){
				eachOfSeries(orderList,(records, key, eachCallback)=>{
					if(orderIdsObj[String(records._id)]) return eachCallback(null);

					orderIdsObj[String(records._id)] = true;

					/** Update order details */
					orders.updateOne({
						_id: records._id
					},
					{
						$set:{
							scheduled_to_submit_time: Helper.getUtcDate()
						},
						$unset:{
							scheduled_process_time: 1
						}
					}).then(()=>{

						let tmpDbStatus	= 	records.order_status;
						let isConfirm 	= 	records.is_confirm;
						let orderStatus =	Constants.ORDER_SUBMITTED;
						if(!isConfirm) orderStatus = Constants.ORDER_PENDING;

						if(tmpDbStatus != Constants.ORDER_SCHEDULED) return eachCallback(null);

						Helper.saveOrderStatusLogs(req,res,next,{
							updated_by		:	adminId,
							send_notification_call_center : isConfirm ? true :false,
							order_id 		: 	records._id,
							restaurant_id	:	records.restaurant_id,
							user_id			:	records.customer_id,
							device_id 		: 	records.device_id,
							user_role_id	:	Constants.CUSTOMER,
							user_type		:	Constants.USER_TYPE_CUSTOMER,
							status 			:	orderStatus,
							order_status 	:	tmpDbStatus,
						}).then(()=>{
							eachCallback(null);
						}).catch(err=>{
							return eachCallback(err);
						});
					}).catch(err=>{
						return eachCallback(err);
					});
				},eachErr=>{
					if(eachErr){
						console.error("async series Error at orderCron in orderScheduled",eachErr);
					}
				});
			}
		});
	};//End orderScheduled()

	/**
	 * Function to order canceled (frequency time: every 28mins )
	 *
	 * @param req 	As	 Request Data
	 * @param res 	As	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render null
	 */
	async orderCanceled (req, res,next){
		/** Send response to client and work in background */
		res.render('blank',{layout:false});

		const orders = this.db.collection(Tables.ORDERS);
		asyncParallel({
			order_list : (callback)=>{
				let tmpOrderDate	= Helper.newDate(Helper.subtractMinute(15*Constants.HOURS_IN_A_DAY*Constants.MINUTES_IN_A_HOUR),Constants.CURRENTDATE_START_DATE_FORMAT);

				/** Set order conditions */
				let orderConditions = {
					order_date 		: {
						$gte: Helper.newDate(tmpOrderDate),
						$lte: Helper.newDate(Helper.subtractMinute(Constants.MAX_MINUTE_FOR_ORDER_CANCELED/Constants.MINUTES_IN_A_HOUR))
					},
					order_status	: Constants.ORDER_PENDING,
					is_confirm		: false,
				};

				/** Get orders list */
				orders.find(orderConditions,{projection: {customer_id:1,restaurant_id:1,device_id:1}}).toArray().then(result=>{
					callback(null, result);
				}).catch(err=>{
					callback(err);
				});
			},
			user_details : (callback)=>{
				/** Get user details */
				const users = this.db.collection(Tables.USERS);
				users.findOne({user_role_id : Constants.SYSTEM_ADMIN_ROLE_ID },{projection:{_id:1}}).then(result=>{
					callback(null, result);
				}).catch(err=>{
					callback(err);
				});
			},
		},(asyncErr,asyncResponse)=>{
			if(asyncErr){
				console.error("first async parallel Error at orderCron in orderCanceled",asyncErr);
			}

			let orderList  	= 	asyncResponse?.order_list || [];
			let adminId     =	asyncResponse?.user_details?._id || "";
			if(orderList?.length > 0 && adminId){
				asyncEach(orderList,(records,eachCallback)=>{
                    /** Update order details */
					orders.updateOne({
						_id : new ObjectId(records._id),
					},
					{$set: {
						cancelled_by	 	: adminId,
						order_status	 	: Constants.ORDER_CANCELLED,
						rejection_reason 	: Constants.ORDER_CANCELED_REASON,
						modified 			: Helper.getUtcDate(),
					}}).then(()=>{

						Helper.saveOrderStatusLogs(req,res,next,{
							updated_by		:	adminId,
							user_id			:	records.customer_id,
							restaurant_id	:	records.restaurant_id,
							device_id		:	records.device_id,
							status 			:	Constants.ORDER_CANCELLED,
							order_status	:	Constants.ORDER_PENDING,
							order_id 		:	records._id,
						});

						eachCallback(null);
					}).catch(err=>{
						return eachCallback(err);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr){
						console.error("async each Error at orderCron in orderCanceled",asyncEachErr);
					}
				});
			}
		});
	};//End orderCanceled()

	/**
	 * Function to update wallet user logs
	 *
	 * @param req 	As	 Request Data
	 * @param res 	As	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render null
	 */
	async updateWalletLogs (req, res,next){
        /** Send response to client and work in background */
        res.render('blank',{layout:false});

		try{
			const user_wallet_logs	= this.db.collection(Tables.USER_WALLET_LOGS);
			let result = await user_wallet_logs.find({
				transaction_type				: Constants.CREDIT,
				remaining_amount				: {$gt : 0},
				"extra_parameters.is_expired"	: {$exists : false},
				"extra_parameters.expiry_date" 	: {$lte : Helper.newDate()}
			},{projection : {_id : 1,remaining_amount : 1,user_id:1,wallet_type:1}}).toArray();

			if(result && result.length > 0){
				asyncEach(result,(records, asyncCallback)=>{
					let remainingAmount = (records.remaining_amount) ? parseFloat(records.remaining_amount) : 0;

					let userId	 	= 	(records.user_id)	? new ObjectId(records.user_id) :"";
					let recordId	=	(records._id)		? new ObjectId(records._id) 	:"";
					asyncParallel([
						(callback)=>{
							user_wallet_logs.updateOne({
								_id : recordId
							},
							{$set : {
								"extra_parameters.is_expired" : true
							}}).then(()=>{
								callback(null);
							}).catch(err=>{
								callback(err);
							});
						},
						(callback)=>{
							/**To debit amount from users table */
							Helper.debitWalletBalance(req,res,{
								user_id			: userId,
								amount			: remainingAmount,
								wallet_type		: records.wallet_type,
								extra_parameters: {
									parent_wallet_id : recordId
								},
								is_expire_cron : true
							}).then(()=>{
								callback(null);
							}).catch(err=>{
								callback(err);
							});
						}
					],(parallelErr)=>{
						asyncCallback(parallelErr);
					});
				},(asyncErr)=>{
					if(asyncErr){
						console.error("Async each error on updateWalletLogs",asyncErr);
					}
				});
			}
		}catch(err){
			console.log('Catch error at crons/updateWalletLogs', err);
		}
	};//End updateWalletLogs()/

	/**
	 * Function to update driver available status
	 *
	 * @param req 	As	 Request Data
	 * @param res 	As	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render null
	 */
	async updateDriverAvailableStatus (req, res,next){

        /** Send response to client and work in background */
		res.render('blank',{layout:false});

		const users = this.db.collection(Tables.USERS);
		asyncParallel({
			update_driver_details : (callback)=>{
				let driverUpdateConditions = clone(Constants.DRIVER_COMMON_CONDITIONS);
				driverUpdateConditions.is_online = {$ne: Constants.ONLINE};

				/** Update driver available status  */
				users.updateMany(driverUpdateConditions,
				{$set: {
					is_available: Constants.NOT_AVAILABLE,
				}}).then(()=>{
					callback(null);
				}).catch(err=>{
					callback(err);
				});
			},
			driver_ids : (callback)=>{
				let driverConditions = clone(Constants.DRIVER_COMMON_CONDITIONS);
				driverConditions.is_online = Constants.ONLINE;

				/** Get driver list */
				users.distinct( "_id",driverConditions).then(driverIds=>{
					callback(null, driverIds);
				}).catch(err=>{
					callback(err, []);
				});
			},
		},(parentErr,parentResponse)=>{
			if(parentErr){
				console.error("Parallel Error in updateDriverAvailableStatus",parentErr);
			}

			let driverIds   =   parentResponse?.driver_ids || [];
			let currentDate =	Helper.newDate(Helper.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));
			let dayEndDate 	= 	Helper.newDate(Helper.newDate("",Constants.CURRENTDATE_END_DATE_FORMAT));
			let currentTime	= 	parseFloat(Helper.newDate("",Constants.EXCUSES_TIME_FORMAT));
			if(driverIds.length > 0){
				asyncParallel({
					driver_breaks : (callback)=>{
						/** Get driver breaks list */
						const driver_breaks = this.db.collection(Tables.DRIVER_BREAKS);
						driver_breaks.find({
							driver_id    : 	{$in: driverIds},
							date         : 	{$gte: currentDate},
							status 		 : 	Constants.APPROVED,
							is_completed :	false,
							$or 		 : 	[
								{start_time: {$gte: currentTime }},
								{start_time: {$lte: currentTime }}
							],
						},{projection: {driver_id:1}}).toArray().then(breakResult=>{
							if(breakResult.length <=0) return callback(null,{});

							let breakList = {};
							breakResult.map(records=>{
								breakList[records.driver_id] = records;
							});
							callback(null,breakList);
						}).catch(err=>{
							callback(err,{});
						});
					},
					driver_excuses : (callback)=>{
						/** Get driver excuses list */
						const driver_excuses = this.db.collection(Tables.DRIVER_EXCUSES);
						driver_excuses.find({
							driver_id    : 	{$in: driverIds},
							date         : 	{$gte: currentDate, $lte: dayEndDate},
							status 		 : 	Constants.APPROVED,
							is_completed :	false,
							$or 		 : 	[
								{$and : [
									{from 	: {$gte: currentTime } },
									{to 	: {$lte: currentTime } }
								]},
								{$and : [
									{to 	: {$gte: currentTime } },
									{from 	: {$lte: currentTime } }
								]}
							],
						},{projection: {driver_id:1}}).toArray().then(excuseResult=>{
							if(excuseResult.length <=0) return callback(null,{});

							let excuseList = {};
							excuseResult.map(records=>{
								excuseList[records.driver_id] = records;
							});
							callback(null,excuseList);
						}).catch(err=>{
							callback(err,{});
						});
					},
					driver_inshift : (callback)=>{
						let shiftList 		=	{};
						let currentTime		=	parseFloat(Helper.newDate('',Constants.SHIFT_TIME_FORMAT));
						let prevStartDate 	=	Helper.newDate(Helper.newDate(Helper.subtractDate(Constants.HOURS_IN_A_DAY),Constants.CURRENTDATE_START_DATE_FORMAT));
						let prevEndDate 	=	Helper.newDate(Helper.newDate(Helper.subtractDate(Constants.HOURS_IN_A_DAY),Constants.CURRENTDATE_END_DATE_FORMAT));

						const shifts = this.db.collection(Tables.SHIFTS);
						const driver_availabilities = this.db.collection(Tables.DRIVER_AVAILABILITIES);
						const driver_in_out_shifts = this.db.collection(Tables.DRIVER_IN_OUT_SHIFTS);

                        asyncEach(driverIds,(driverId,eachCallback)=>{

							asyncParallel({
								check_previous : (chiildCallback)=>{
									driver_in_out_shifts.findOne({
										driver_id :	new ObjectId(driverId),
										type 	  : Constants.IN_SHIFT,
										created	  :	{
											$gte: prevStartDate,
											$lte: prevEndDate
										}
									},{projection: {_id:1},sort:{created:Constants.SORT_DESC}}).then(findResult=>{
										if(!findResult) return chiildCallback(null,false);

										/** For get driver shift details */
										driver_availabilities.distinct("shift_id",{
											user_id	: 	new ObjectId(driverId),
											date	: 	{$gte: prevStartDate, $lte: prevEndDate }
										}).then(shiftIds=>{
											if(shiftIds.length==0) return chiildCallback(null,false);

											/** Check driver shifts */
											shifts.aggregate([
												{$match	: {
													_id	: {$in: Helper.arrayToObject(shiftIds) },
													is_deleted: {$ne: Constants.DELETED},
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
												let shiftFlag = (shiftResult && shiftResult[0]) ? true : false;
												chiildCallback(null,shiftFlag);
											}).catch(err=>{
												chiildCallback(err,false);
											});
										}).catch(err=>{
                                            chiildCallback(err,false);
                                        });
									}).catch(err=>{
                                        chiildCallback(err,false);
                                    });
								},
								force_active : (chiildCallback)=>{
									/** Get driver details  */
									users.findOne({_id: new ObjectId(driverId)},{projection: {force_active:1,vehicle_id:1}}).then(userResult=>{
										if(!userResult || userResult.force_active != Constants.FORCE_ACTIVE || !userResult.vehicle_id){
											return chiildCallback(null,false);
										}

										driver_in_out_shifts.findOne({
											driver_id :	new ObjectId(driverId),
											type 	  : Constants.IN_SHIFT,
											vehicle_id:	userResult.vehicle_id,
										},{projection: {created:1},sort:{created:Constants.SORT_DESC}}).then(findResult=>{
											return chiildCallback(null,findResult?.created || false);
										}).catch(err=>{
											return chiildCallback(err,false);
										});
									}).catch(err=>{
										return chiildCallback(err,false);
									});
								}
							},(asyncChildErr, asyncChildResponse)=>{
								if(asyncChildErr) return eachCallback(asyncChildErr);

								/** Set conditions */
								let inoutConditions = {
									driver_id 	:	new ObjectId(driverId),
									created     : 	{$gte: currentDate},
									type		:	Constants.IN_SHIFT,
								};

								if(asyncChildResponse.check_previous){
									inoutConditions.created = {$gte: prevStartDate };
								}else if(asyncChildResponse.force_active){
									inoutConditions.created = {$gte: Helper.newDate(asyncChildResponse.force_active)};
								}

								/** Get driver inshift list */
								driver_in_out_shifts.findOne(inoutConditions,{projection: { _id:1},sort:{created:Constants.SORT_DESC}}).then(findResult=>{
									if(findResult) shiftList[driverId] = findResult;
									eachCallback(null);
								}).catch(err=>{
									eachCallback(err);
								});
							});
						},(asyncEachErr)=>{
							callback(asyncEachErr,shiftList);
						});
					},
				},(asyncErr,asyncResponse)=>{
					if(asyncErr){
						return console.log("Async parallel error on updateDriverAvailableStatus",asyncErr);
					}

					let driverBreakList 	= (asyncResponse.driver_breaks) ? asyncResponse.driver_breaks  :{};
					let driverExcusesList 	= (asyncResponse.driver_excuses)? asyncResponse.driver_excuses :{};
					let driverInshiftList 	= (asyncResponse.driver_inshift)? asyncResponse.driver_inshift :{};

					asyncEach(driverIds,(driverId,eachCallback)=>{
						let isAvailable = Constants.NOT_AVAILABLE;

						if(driverInshiftList[driverId]) isAvailable = Constants.AVAILABLE;

						if(driverBreakList[driverId] || driverExcusesList[driverId]){
							isAvailable = Constants.NOT_AVAILABLE;
						}

						/** Update driver available status  */
						users.updateOne({
							_id : new ObjectId(driverId),
						},
						{$set: {
							is_available 	: isAvailable,
						}}).then(()=>{
							eachCallback(null);
						}).catch(err=>{
							eachCallback(err);
						});
					},(asyncEachErr)=>{
						if(asyncEachErr){
							console.error("Async each error on updateDriverAvailableStatus",asyncEachErr);
						}
					});
				});
			}
		});
	};//End updateDriverAvailableStatus()

	/**
	 * Function to assign captain  (frequency time: every minutes )
	 *
	 * @param req 	As	 Request Data
	 * @param res 	As	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render null
	 */
	async assignCaptain (req,res,next){
		let orderProcessTime = Helper.newDate(Helper.subtractMinute(Constants.ORDER_PROCESS_TIME_IN_MINUTES));
		let enableAutoAssimentProcess =  (res.locals.settings['Order_Assignment.assignment_process']) ? parseInt(res.locals.settings['Order_Assignment.assignment_process']) :0;

		/** Stop auto assigned process when admin disable  */
		if(!enableAutoAssimentProcess) return res.render('blank',{layout:false});

        /** Send response to client and work in backgHelper.round */
        res.render('blank',{layout:false});

		/** Set order conditions */
		let tmpOrderDate= Helper.newDate(Helper.subtractMinute(Constants.PREVIOUS_MAX_DAY_TO_ASSIGN_ORDER_TO_DRIVER*Constants.HOURS_IN_A_DAY*Constants.MINUTES_IN_A_HOUR),Constants.CURRENTDATE_START_DATE_FORMAT);
		let orderConditions = {
			order_date 		: 	{$gte: Helper.newDate(tmpOrderDate)},
			is_confirm 		: 	true,
			captain_id 		: 	"",
			delivery_type 	: 	Constants.DELIVERY_BY_CRAVEZ,
			assigned_captain: 	{$exists: false},
			order_assignment_start_time: {$lte: Helper.newDate()},
			$and 			:	[
				{is_completed: {$exists  :false }},
				{is_completed: {$ne 	 :true }},
				{$or :[
					{admin_status: {$in: [Constants.ORDER_PREPARING,Constants.ORDER_READY_TO_PICK_UP]}},
				]}
			],
			$or 			:	[
				{order_assignment_process_time: {$exists : false }},
				{order_assignment_process_time: {$lte 	 : orderProcessTime }},
			],
		};

		/** Get order list */
		const orders = this.db.collection(Tables.ORDERS);
		orders.aggregate([
			{$match :  orderConditions},
			{$lookup:	{
				"from" 			: 	Tables.ORDER_DETAILS,
				"localField" 	:	"_id",
				"foreignField" 	: 	"order_id",
				"as" 			: 	"order_detail"
			}},
			{$project	:	{ _id:1, order_preparing_time: 1, order_ready_to_pick_up_time:1, remaining_preparation_time: {$arrayElemAt: ["$order_detail.remaining_preparation_time",0]} }},
			{$match 	:  	{
				remaining_preparation_time: {$exists: true},
			}},
			{$addFields:{
				sort_time: {$ifNull: [ "$order_preparing_time", "$order_ready_to_pick_up_time" ] }
			}},
			{$sort:{ sort_time: Constants.SORT_ASC}},
		]).toArray().then(result=>{

			if(result && result.length >0){
				eachOfSeries(result,(records, key, seriesCallback)=>{
					this.assignmentModel.assignCaptainByOrderId(req,res,next,{order_id: records._id }).then(response=>{
						if(response.status!= Constants.STATUS_SUCCESS){
							console.error("Map error in assignCaptain, Time- "+Helper.newDate());
							console.error(response);
						}
						seriesCallback(null);
					}).catch(next);
				},()=>{ });
			}
		}).catch(err=>{
			console.error("Error in assignCaptain",err);
		});
	};//End assignCaptain()

	/**
	 * Function to update order assignment logs
	 *
	 * @param req 	As	 Request Data
	 * @param res 	As	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render null
	 */
	async updateOrderAssignmentLogs (req, res,next){
		/** Send response to client and work in background */
		res.render('blank',{layout:false});

		const order_assignment_logs = this.db.collection(Tables.ORDER_ASSIGNMENT_LOGS);
		asyncParallel({
			assignment_list : (callback)=>{
				let assignmentProcessTime = Helper.newDate(Helper.subtractMinute(Constants.ASSIGNMENT_CRON_PROCESS_MINUTE));

				/** Get order assignment logs list */
				order_assignment_logs.aggregate([
					{$match :{
						current_status	: 	Constants.ORDER_DRIVER_ASSIGNED,
						cancelled_at 	:	{$lte: Helper.newDate() },
						$or				:	[
							{process_time : {$exists: false}},
							{process_time : {$lte: assignmentProcessTime}}
						]
					}},
					{$lookup:	{
                        "from" 			: 	Tables.ORDERS,
                        "localField" 	:	"order_id",
                        "foreignField" 	: 	"_id",
                        "as" 			: 	"order_details"
                    }},
					{$project : {
						_id:1, order_id:1, captain_id: 1, unique_order_id: {$arrayElemAt: ["$order_details.unique_order_id",0]}
					}},
				]).toArray().then(result=>{
					callback(null, result);
				}).catch(err=>{
					callback(err);
				});
			},
			user_details : (callback)=>{
				/** Get user details */
				const users = this.db.collection(Tables.USERS);
				users.findOne({user_role_id : Constants.SYSTEM_ADMIN_ROLE_ID },{projection:{_id:1,user_role_id:1}}).then(result=>{
					callback(null, result);
				}).catch(err=>{
					callback(err);
				});
			},
		},(asyncErr,asyncResponse)=>{
			if(asyncErr){
				console.error("Async parallel error in updateOrderAssignmentLogs",asyncErr);
			}

			let assignmentList  = 	asyncResponse?.assignment_list || [];
			let userDetails 	=	asyncResponse?.user_details || {};
			let adminId 		=	userDetails?._id || "";
			let adminRoleId 	=	userDetails?.user_role_id || "";

			if(assignmentList?.length >0){
				let assignmentIds = [];
				assignmentList.map(records=>{
					assignmentIds.push(records._id);
				});

				/** Update order assignment logs details */
				order_assignment_logs.updateMany({
					_id:{$in: assignmentIds}
				},
				{$set:{
					process_time: Helper.getUtcDate()
				}}).then(()=>{

					eachOfSeries(assignmentList,(records, parentkey, callback)=>{
						let orderId 	 	=	records.order_id;
						let captainId 	 	= 	records.captain_id;
						let uniqueOrderId 	= 	records.unique_order_id;

						/** Update order assignment logs details  */
						order_assignment_logs.updateOne({
							_id	: new ObjectId(records._id),
						},
						{
							$set: {
								current_status 	: 	Constants.ORDER_DRIVER_PASSED,
								modified 		:	Helper.getUtcDate(),
							},
							$unset : {
								process_time : 1
							}
						}).then(()=>{
							callback(null);

							/** Save order status logs */
							Helper.saveOrderStatusLogs(req,res,next,{
								order_id 		:	orderId,
								updated_by		:	adminId,
								user_id			:	captainId,
								status 			:	Constants.ORDER_DRIVER_PASSED,
								order_status	:	Constants.ORDER_DRIVER_ASSIGNED,
							}).then(()=>{
								callback(null);
							});
						}).catch(err=>{
							callback(err);
						});
					},(asyncEachErr)=>{
						if(asyncEachErr){
							console.error("Each error in updateOrderAssignmentLogs",asyncEachErr);
						}
					});
				}).catch(err=>{
					console.error("Error in updateOrderAssignmentLogs",err);
				});
			}
		});
	};//End updateOrderAssignmentLogs()

	/**
	 * Function to update captain  free time
	 *
	 * @param req 	As	 Request Data
	 * @param res 	As	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render null
	 */
	async updateCaptainFreeTime  (req,res,next){
		/** Send response to client and work in background */
		return res.render('blank',{layout:false});

		/** Set driver conditions */
		let orderProcessTime 			= Helper.newDate(Helper.subtractMinute(Constants.DRIVER_ORDER_PROCESS_TIME_IN_MINUTES));
		let driverConditions 			= clone(Constants.DRIVER_COMMON_CONDITIONS);
		driverConditions["orders.0"]	= {$exists: true};
		driverConditions["$or"]			= [
			{process_time : {$exists: false}},
			{process_time : {$lte: orderProcessTime}}
		];

		const users = this.db.collection(Tables.USERS);
		const order_details = this.db.collection(Tables.ORDER_DETAILS);

		/** Get user list */
		users.find(driverConditions,{projection: {_id:1,orders:1}}).toArray().then(result=>{
			if(result && result.length > 0){
				let captainIds = [];
				result.map(records=>{
					captainIds.push(records._id);
				});

				/** Update user details */
				users.updateMany({_id:{$in: captainIds}},{$set:{process_time: Helper.getUtcDate()}}).then(()=>{
					asyncEach(result,(records,callback)=>{

						let orderIds 		=	[];
						let firstOrderId 	= 	"";
						let orderList		=	records.orders;
						orderList.map((data,key)=>{
							if(key ==0) firstOrderId = data.order_id;
							orderIds.push(data.order_id);
						});

						/** Find order details */
						order_details.find({
							order_id:  { $in : Helper.arrayToObject(orderIds)}
						},{projection: {
							remaining_delivery_duration: 1,remaining_preparation_time:1,order_id:1
						}}).sort({remaining_delivery_duration: Constants.SORT_DESC}).toArray().then(orderResult=>{

							if(orderResult && orderResult.length > 0){
								asyncEach(orderResult,(data,childCallback)=>{
									let freeIn			=	orderResult[0]?.remaining_delivery_duration || 0;
									let orderPrepareTime=	(String(data.order_id) == String(firstOrderId)) ? data.remaining_preparation_time : '';
									let dataToBeUpdated	=	{};
									dataToBeUpdated['$set']	=	{
										free_in: parseInt(freeIn),
										"orders.$.free_in" : parseInt(data.remaining_delivery_duration)
									}
									if(orderPrepareTime){
										dataToBeUpdated['$set']["order_prepare_remaining_time"] = parseInt(orderPrepareTime);
									}

									dataToBeUpdated['$unset']	=	{ process_time : 1 };

									/** Update users order detail accordingly */
									users.updateOne({
										_id		: new ObjectId(records._id),
										orders: { $elemMatch: { order_id: data.order_id } }
									},dataToBeUpdated).then(()=>{
										childCallback(null);
									}).catch(err=>{
										childCallback(err);
									});
								},(asyncChildEachErr)=>{
									callback(asyncChildEachErr);
								});
							}else{
								callback(null);
							}
						}).catch(err=>{
							callback(err);
						});
					},(asyncEachErr)=>{
						if(asyncEachErr){
							console.error("Error in updateCaptainFreeTime after asyncEach",asyncEachErr);
						}
					});
				}).catch(err=>{
					console.error("Error in updateCaptainFreeTime after updateMany",err);
				});
			}
		}).catch(err=>{
			console.error("Error in updateCaptainFreeTime after find",err);
		});
	};//End updateCaptainFreeTime()

	/**
	 * Function to send notifications to users for order remind
	 *
	 * @param req 	As	 Request Data
	 * @param res 	As	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render null
	 */
	async sendOrderRemindNotification (req,res,next){
		/** Send response to client and work in backgHelper.round */
		res.render('blank',{layout:false});

        let days        = 	parseInt(res?.locals?.settings?.['Site.order_remind_notification_days'] || 0);
        let hoursInADay = 	days*Constants.HOURS_IN_A_DAY;
        let remindDate	=	Helper.newDate(Helper.subtractDate(hoursInADay));

        /** Get customers list from orders**/
		const orders = this.db.collection(Tables.ORDERS);
		orders.distinct("customer_id",{created: {$gt: remindDate}}).then(customerIds=>{

			if(customerIds?.length){
				/** Set customer conditions **/
				let userConditions 		= 	clone(Constants.CUSTOMER_COMMON_CONDITIONS);
				userConditions._id 		= 	{$nin : customerIds};
				userConditions["$or"] 	=	[
					{order_remind_time : {$exists : false}},
					{order_remind_time : {$lt: remindDate }}
				];

				/** Get customer list**/
				const users = this.db.collection(Tables.USERS);
				users.find(userConditions,{projection:{_id:1,user_role_id:1}}).toArray().then(userResult=>{

					if(userResult?.length > 0){

						/** Insert user id in a array**/
						let userIds = [];
						userResult.forEach(records=>{
							userIds.push(records._id);
						});

						/** Save order remind time in users collection **/
						users.updateMany({
							_id: {$in: userIds}
						},
						{$set:{
							order_remind_time: Helper.getUtcDate()
						}}).then(()=>{

							/*************** Send Mail  ***************/
								services.sendMailToUsers(req,res,{
									event_type 	:	Constants.NOTIFICATION_SEND_TO_USERS_ORDER_REMIND,
									user_list	: 	userResult,
									days		: 	days
								});
							/*************** Send Mail  ***************/
						}).catch(err=>{
							console.error("Error in sendOrderRemindNotification users update",err);
						});
					}
				}).catch(err=>{
					console.error("Error in sendOrderRemindNotification users find",err);
				});
			}
        }).catch(err=>{
			console.error("Error in sendOrderRemindNotification orders find",err);
		});
	};//End sendOrderRemindNotification()

	/**
	 * Function to get report of customer order value
	 *
	 * @param req 	As	 Request Data
	 * @param res 	As	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render null
	 */
	async getReportCustomerOrderValue (req, res,next){
		try {
			/** Send response to client and work in background */
			res.render('blank',{layout:false});

			let days = req?.params?.days ? parseInt(req.params.days) :"";
			if(days <=0 || isNaN(days)) days = Constants.CUSTOMER_ORDER_REPORT_DAYS;

			let hoursInADay =  days*Constants.HOURS_IN_A_DAY;
			let fromDate	=  Helper.newDate(Helper.subtractDate(hoursInADay));
			let toDate      =  Helper.newDate(Helper.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));
			let dates  		=  Helper.getDateRange(fromDate,toDate);

			const orders    	  =  this.db.collection(Tables.ORDERS);
			const customer_orders =  this.db.collection(Tables.CUSTOMER_ORDERS);
			asyncEach(dates, (date, parentCallback)=> {
				let tempToDate  = 	Helper.newDate(date,Constants.DATABASE_DATE_FORMAT);
				let tempFromDate= 	Helper.newDate(date,Constants.DATABASE_DATE_FORMAT);
				tempToDate  	=	Helper.newDate(tempToDate+" "+Constants.END_DATE_TIME_FORMAT);
				tempFromDate  	=	Helper.newDate(tempFromDate+" "+Constants.START_DATE_TIME_FORMAT);

				/** Get customer orders */
				orders.aggregate([
					{$match :  {
						order_date 		:	{$gte: tempFromDate, $lte: tempToDate },
						customer_id 	:	{$exists: true, $nin:[null,""]},
						is_completed 	:	true,
					}},
					{$lookup:	{
						"from" 			: 	Tables.ORDER_DETAILS,
						"localField" 	:	"_id",
						"foreignField" 	: 	"order_id",
						"as" 			: 	"order_detail"
					}},
					{$addFields:	{
						delivery_area_id: {$arrayElemAt: ["$order_detail.delivery_area_id",0]}
					}},
					{$group	: {
						_id :  {
							restaurant_id   : "$restaurant_id",
							branch_id       : "$branch_id",
							delivery_area_id: "$delivery_area_id",
							customer_id     :  "$customer_id",
						},
						restaurant_id 		:	{$first : "$restaurant_id"},
						branch_id      	 	:	{$first : "$branch_id"},
						delivery_area_id	: 	{$first : "$delivery_area_id"},
						area_id				: 	{$first : "$area_id"},
						total_orders    	:   {$sum   : 1},
						total_order_amount	:  	{$sum   : "$order_price"},
						total_net_amount	:	{$sum   : "$net_amount"},
						customer_id     	: 	{$first : "$customer_id"},
					}},
				]).toArray().then(result=>{
					if(result?.length <=0) return parentCallback(null);

					asyncEach(result, (records, eachCallback)=> {

						/** Insert customer orders */
						customer_orders.insertOne({
							restaurant_id 	  	: 	records.restaurant_id,
							branch_id     	  	: 	records.branch_id,
							delivery_area_id  	: 	records.delivery_area_id,
							area_id     	  	: 	records.area_id,
							customer_id       	: 	records.customer_id,
							total_orders      	: 	records.total_orders,
							total_order_amount 	: 	Helper.round(records.total_order_amount),
							total_net_amount 	: 	Helper.round(records.total_net_amount),
							date              	:	Helper.getUtcDate(tempFromDate),
							created             :	Helper.getUtcDate()
						}).then(()=>{
							eachCallback(null);
						}).catch(err=>{
							eachCallback(err);
						});
					},(childEachErr)=>{
						parentCallback(childEachErr);
					});
				}).catch(err=>{
					parentCallback(err);
				});
			},(eachErr)=> {
				if(eachErr){
					console.error("Error in getReportCustomerOrderValue");
					return console.error(eachErr);
				}
			});
		} catch (error) {
			console.error("Catch error in getReportCustomerOrderValue",error);
		}
	};//End getReportCustomerOrderValue()

	/**
	 * Function to refund customer amount like order/package value
	 *
	 * @param req 	As	 Request Data
	 * @param res 	As	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render null
	 */
	async paymentRefund (req, res,next){
		try {
			/** Send response to client and work in background */
			res.render('blank',{layout:false});

			const payment_refund_logs 	=  this.db.collection(Tables.PAYMENT_REFUND_LOGS);
			let paymentResult = await payment_refund_logs.find({
				status: Constants.REFUND_INITIALIZE,
			},{projection:{_id:1,user_id:1,order_id:1,device_id:1,payment_detail:1,transaction_id:1,payment_type:1, wallet_type: 1 }}).toArray();

			if(paymentResult && paymentResult.length > 0){
				asyncEach(paymentResult,(records, asyncEachCallback)=>{
					let logId     		=   records?._id || "";
					let orderId     	=   records?.order_id || "";
					let userId			= 	records?.user_id || "";
					let deviceId		= 	records?.device_id || "";
					let refundDetails	= 	records?.payment_detail || [];
					let paymentType		= 	records?.payment_type || "";
					let walletType		= 	records?.wallet_type || "";

					let fetchAmountData	=	{
						refund_id		:	logId,
						order_id		:	orderId,
						refund_detail	:	refundDetails,
						user_id			:	userId,
						device_id		:	deviceId,
						wallet_type		:	walletType
					};
					Helper.paymentRefundProcess(req,res,next,fetchAmountData).then(fetchAmountResponse=>{
						/** Send error response */
						if(fetchAmountResponse.status != Constants.STATUS_SUCCESS){
							return  asyncEachCallback(fetchAmountResponse);
						}

						let paymentResponse	=	(fetchAmountResponse.gateway_response && fetchAmountResponse.gateway_response.payment_response) ? fetchAmountResponse.gateway_response.payment_response : "";
						let walletResponse	=	(fetchAmountResponse.gateway_response && fetchAmountResponse.gateway_response.wallet_response) ? fetchAmountResponse.gateway_response.wallet_response : "";

						if(walletResponse || paymentResponse){
							let dataToUpdate =	{modified: Helper.getUtcDate()};
							let conditions	 =	{
								_id : logId,
							};

							let walletStatusFlag	=	false;
							if(walletResponse){
								if(walletResponse.status == Constants.STATUS_SUCCESS){
									conditions["payment_detail.type"] = Constants.WALLET_PAYMENT;
									dataToUpdate["payment_detail.$.is_paid"] = true;
									dataToUpdate["payment_detail.$.transaction_id"] = walletResponse.transaction_id;
									walletStatusFlag	=	true;
								}
							}else{
								walletStatusFlag	=	true;
							}
							let gatewayStatusFlag	=	false;
							if(paymentResponse){
								if(paymentResponse.IsSuccess == true){
									conditions["payment_detail.type"] = {$in:Constants.ONLINE_PAYMENT};
									dataToUpdate["payment_detail.$.is_paid"] = true;
									dataToUpdate["payment_detail.$.transaction_detail"] = paymentResponse.Data;
									gatewayStatusFlag	=	true;
								}
							}else{
								gatewayStatusFlag	=	true;
							}
							if(walletStatusFlag && gatewayStatusFlag){
								dataToUpdate['status'] 		= Constants.REFUND_COMPLETED;
								dataToUpdate['refunded_on'] = Helper.getUtcDate();
							}

							payment_refund_logs.updateOne(conditions,{$set: dataToUpdate}).then(()=>{
								asyncEachCallback(null);
							}).catch(err=>{
								asyncEachCallback(err);
							});
						}else{
							asyncEachCallback(null);
						}
					}).catch(next);
				},()=>{});
			}
		} catch (error) {
			console.error("Catch error in paymentRefund",error);
		}
	};//End paymentRefund()

    /**
	 * Function to update remaining package days ( once in a day)
	 *
	 * @param req 	As	 Request Data
	 * @param res 	As	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render null
	 */
	async updatePackageDays (req, res,next){
		try {
			/** Send response to client and work in background */
			res.render('blank',{layout:false});

			const users = this.db.collection(Tables.USERS);
			let result = await users.find({
				package_id : {$exists : true }
			},{projection:{_id:1,package_valid_till: 1}}).toArray();

			let currentDate	= Helper.newDate("",Constants.DATABASE_DATE_FORMAT);
			if(result && result.length > 0){
				result.forEach((records)=>{
					let packageValidTill	=	Helper.newDate(records.package_valid_till,Constants.DATABASE_DATE_FORMAT);
					let remainingDays		=	(packageValidTill) ? (Helper.getDifferenceBetweenTwoDatesInMinute(currentDate,packageValidTill))/(Constants.MINUTES_IN_A_HOUR*Constants.HOURS_IN_A_DAY) : 0;

					let dataToBeUpdated	=	{};
					if(remainingDays > 0){
						dataToBeUpdated['$set'] = { 'remaining_package_days' : Helper.round(remainingDays,0) };
					}else{
						dataToBeUpdated['$set'] = { package_status : Constants.PACKAGE_EXPIRE };
						dataToBeUpdated["$unset"] 	= {
							package_id 				: 1,
							package_valid_till 		: 1,
							remaining_package_days 	: 1,
							remaining_package_orders: 1
						};
					}

					users.updateOne({_id : records._id},dataToBeUpdated).then(()=>{}).catch(err=>{
						console.error("Error in updatePackageDays",err);
					});
				});
			}
		} catch (error) {
			console.error("Catch error in updatePackageDays",error);
		}
	}; // End updatePackageDays

	/**
	 * Function to mark menu active
	 *
	 * @param req 	As	 Request Data
	 * @param res 	As	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render null
	 */
	async markMenuActive (req, res,next){
		/** Send response to client and work in background */
		res.render('blank',{layout:false});

		try{
			/** Set restaurant conditions */
			let conditions = {
				status 		: Constants.ACTIVE,
				is_deleted	: Constants.NOT_DELETED,
			};

			/** Get restaurant list */
			const restaurants = this.db.collection(Tables.RESTAURANTS);
			let restaurantIds = await restaurants.distinct("_id",conditions);

			/** Get default restaurant list */
			const restaurant_menus 	= this.db.collection(Tables.RESTAURANT_MENUS);
			let defaultRestaurantIds = await restaurant_menus.distinct("restaurant_id",{is_active :ACTIVE,is_default : true });

			let defaultRestObj = {};
			defaultRestaurantIds.map(resId=>{
				defaultRestObj[resId] = true;
			});

			if(restaurantIds && restaurantIds.length >0){
				let currentDay 	=	parseInt(Helper.newDate("","d"));
				let currentTime =	parseFloat(Helper.newDate("",Constants.TIME_FORMAT));

				const items = 	this.db.collection(Tables.ITEMS);
				asyncEach(restaurantIds,(restaurantId,eachCallback)=>{

					/** Set menu conditions */
					let menuConditions = {
						restaurant_id:  restaurantId,
						$or : [
							{is_default: true},
							{$and: [
								{$or: [
									{$and : [
										{start_date : {$gte : currentDay }},
										{end_date   : {$lte : currentDay }}
									]},
									{$and : [
										{end_date 	 : {$gte : currentDay }},
										{start_date : {$lte : currentDay }}
									]}
								]},
								{$or: [
									{$and : [
										{start_time : {$gte : currentTime }},
										{end_time   : {$lte : currentTime }}
									]},
									{$and : [
										{end_time 	: {$gte : currentTime }},
										{start_time : {$lte : currentTime }}
									]}
								]},
							]}
						]
					};

					if(defaultRestObj[restaurantId]){
						menuConditions = {
							restaurant_id	:  restaurantId,
							is_default		:  true
						};
					}

					/** Get menu details */
					restaurant_menus.findOne(menuConditions,{projection: {_id: 1,start_date: 1}, sort: {start_date: Constants.SORT_ASC}}).then(menuResult=>{

						let menuId = "";
						if(menuResult) menuId = menuResult._id;

						asyncParallel({
							update_menu : (parallelCallback)=>{
								if(!menuId) return parallelCallback(null);

								restaurant_menus.updateOne({
									_id : menuId,
								},
								{$set :{
									menu_active : true
								}}).then(()=>{
									parallelCallback(null);
								}).catch(err=>{
									parallelCallback(err);
								});
							},
							menu_deactive : (parallelCallback)=>{
								restaurant_menus.updateMany({
									restaurant_id	:  	restaurantId,
									_id 			:	{$nin: [menuId]},
								},
								{$set :{
									menu_active : false
								}}).then(()=>{
									parallelCallback(null);
								}).catch(err=>{
									parallelCallback(err);
								});
							},
							update_item : (parallelCallback)=>{
								items.updateMany({
									restaurant_id: restaurantId,
									$or : [
										{"menu_ids.0": {$exists: false}},
										{"menu_ids": {$in: [menuId]}}
									]
								},
								{$set :{
									menu_active : true
								}}).then(()=>{
									parallelCallback(null);
								}).catch(err=>{
									parallelCallback(err);
								});
							},
							item_deactive : (parallelCallback)=>{
								items.updateMany({
									"restaurant_id"	: restaurantId,
									"menu_ids.0"	: {$exists: true},
									"menu_ids"		: {$nin: [menuId]}
								},
								{$set :{
									menu_active : false
								}}).then(()=>{
									parallelCallback(null);
								}).catch(err=>{
									parallelCallback(err);
								});
							},
						},(asyncParentErr)=>{
							eachCallback(asyncParentErr);
						});
					}).catch(err=>{
						eachCallback(err);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr){
						console.error("Each error in markMenuActive",asyncEachErr);
					}
				});
			}
		}catch(error){
			console.error("Catch error in markMenuActive",error);
		}
	}; // End markMenuActive

	/**
	 * Function to remove modified order form cart
	 *
	 * @param req 	As	 Request Data
	 * @param res 	As	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render null
	 */
	async removeModifiedOrderFromCart (req, res,next){
		try {
			/** Send response to client and work in background */
			res.render('blank',{layout:false});

			const user_carts = 	this.db.collection(Tables.USER_CARTS);
			await user_carts.deleteMany({
				max_modified_time : {$lt: Helper.newDate()}
			});
		} catch (error) {
			console.error("Catch error in removeModifiedOrderFromCart",error);
		}
	}; // End removeModifiedOrderFromCart

	/**
	 * Function to update cravez items
	 *
	 * @param req 	As	 Request Data
	 * @param res 	As	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render null
	 */
	async updateCravezItems (req, res,next){
		res.render('blank',{layout:false});

		let itemId		    = 	(req.params.item_id) 		?	String(req.params.item_id) 		:"";
		let itemVGroupId	= 	(req.params.vgroup_id) 		?	String(req.params.vgroup_id) 	:"";
		let todayStartDate 	=	Helper.newDate('',Constants.DATABASE_DATE_FORMAT);
		todayStartDate		=	Helper.newDate(todayStartDate+" "+Constants.START_DATE_TIME_FORMAT);
		let isAllItemUpdate	=	true;

		let listConditions = {
			$or : [
				{is_combo: {$nin : ["1",1]}},
				{restaurant_slug: Constants.PIZZA_HUT }
			],
		};

		if(itemVGroupId){
			listConditions = {vgroup_id: {$in: [itemVGroupId,parseInt(itemVGroupId)]} };

			isAllItemUpdate = false;
		}else if(itemId){
			listConditions = {item_id : String(itemId), $or: [{is_combo: {$nin : ["1",1]}}, {restaurant_slug: Constants.PIZZA_HUT } ] };

			isAllItemUpdate = false;
		}

		const items	 				=	this.db.collection(Tables.ITEMS);
		const cravez_items			=	this.db.collection(Tables.CRAVEZ_ITEMS);
		const item_units_masters	=	this.db.collection(Tables.ITEM_UNITS_MASTERS);
		asyncParallel({
			item_list : (parentCallback)=>{

				console.log("listConditions",JSON.stringify(listConditions));

				cravez_items.aggregate([
					{$match: listConditions},
					{$addFields:{
						deal_item_ids : {$ifNull: [ "$v_group_item_ids.item_id", [] ] }
					}},
					{$lookup:	{
						from 			: 	Tables.CRAVEZ_ITEM_UNITS,
						localField	 	:	"item_id",
						foreignField 	: 	"kfg_item_id",
						as	 			: 	"unit_list"
					}},
					{$lookup:	{
						from 			: 	Tables.CRAVEZ_ITEM_EXTRA_MASTERS,
						localField	 	:	"item_id",
						foreignField 	: 	"kfg_item_id",
						as	 			: 	"ex_item_list"
					}},
					{$lookup:	{
						from 			: 	Tables.CRAVEZ_ITEM_GROUP_EXTRAS,
						localField	 	:	"item_id",
						foreignField 	: 	"kfg_item_id",
						as	 			: 	"group_extra_list"
					}},
					{$lookup:	{
						from     : Tables.CRAVEZ_CHOICES_GROUPS,
						let      : {restaurantId : "$restaurant_id", itemId : "$item_id"},
						pipeline : [
							{$match : {
								$expr: {
									$and : [
										{$eq: ["$restaurant_id", "$$restaurantId"]},
										{$eq: ["$kfg_item_id", "$$itemId"]},
									],
								},
							}},
						],
						as	:	"group_list"
					}},
					{$lookup:	{
						from     : Tables.CRAVEZ_ITEM_EXTRA_MASTERS,
						let      : {restaurantId : "$restaurant_id", deal_item_ids : "$deal_item_ids"},
						pipeline : [
							{$match : {
								$expr: {
									$and : [
										{$in: ["$kfg_item_id", "$$deal_item_ids"]},
									],
								},
							}},
						],
						as	:	"deal_ex_item_list"
					}},
					{$lookup:	{
						from     : Tables.CRAVEZ_ITEM_GROUP_EXTRAS,
						let      : {restaurantId : "$restaurant_id", deal_item_ids : "$deal_item_ids"},
						pipeline : [
							{$match : {
								$expr: {
									$and : [
										{$in: ["$kfg_item_id", "$$deal_item_ids"]},
									],
								},
							}},
						],
						as	:	"deal_group_extra_list"
					}},
					{$lookup:	{
						from     : Tables.CRAVEZ_CHOICES_GROUPS,
						let      : {restaurantId : "$restaurant_id", deal_item_ids : "$deal_item_ids"},
						pipeline : [
							{$match : {
								$expr: {
									$and : [
										{$eq: ["$restaurant_id", "$$restaurantId"]},
										{$in: ["$kfg_item_id", "$$deal_item_ids"]},
									],
								},
							}},
						],
						as	:	"deal_group_list"
					}},
					{$group	:	{
						_id : 	{$cond: [
									{$and: [
										{$gt: ["$vgroup_id",0] },
									]},
									{
										restaurant_id	: "$restaurant_id",
										vgroup_id 		: "$vgroup_id",
									},
									"$item_id"
								]},
						name 					:	{$first : "$name"},
						item_id 				:	{$first : "$item_id"},
						submenu_ids 			:	{$first : "$submenu_ids"},
						deal_item_ids 			:	{$first : "$deal_item_ids"},
						deal_vgroup_ids			:	{$first : "$v_group_item_ids"},
						description 			:	{$first : "$description"},
						item_price 				:	{$min 	: "$item_price"},
						no_of_components 		:	{$first : "$no_of_components"},
						combo_upsell_item_ids	:	{$first : "$combo_upsell_item_ids"},
						first_component_details	:	{$first : "$first_component_details"},
						branch_ids 				:	{$first : "$branch_ids"},
						start_time 				:	{$first : "$start_time"},
						end_time 				:	{$first : "$end_time"},
						category_ids 			:	{$first : "$category_ids"},
						category_id 			:	{$first : "$category_id"},
						is_active 				:	{$max 	: "$is_active"},
						is_combo 				:	{$first : "$is_combo"},
						size 					:	{$first : "$size"},
						dough_type 				:	{$first : "$dough_type"},
						selector 				:	{$first : "$selector"},
						is_half 				:	{$first : "$is_half"},
						vgroup_id 				:	{$first : "$vgroup_id"},
						restaurant_id 			:	{$first : "$restaurant_id"},
						restaurant_slug 		:	{$first : "$restaurant_slug"},
						channel_id				:	{$first : "$channel_id"},
						added_by				:	{$first : "$added_by"},
						order 					:	{$max 	: "$order"},
						modified 				:	{$max 	: "$modified"},
						created 				:	{$min 	: "$created"},
						time_array				:	{$addToSet : {
							start_time 	: 	"$start_time",
							end_time 	: 	"$end_time",
						}},
						group_list 				: 	{$push 	: "$group_list"},
						group_extra_list		: 	{$push 	: "$group_extra_list"},
						ex_item_list 			: 	{$push 	: "$ex_item_list"},
						deal_group_list 		: 	{$push 	: "$deal_group_list"},
						deal_ex_item_list 		: 	{$push 	: "$deal_ex_item_list"},
						deal_group_extra_list	: 	{$push 	: "$deal_group_extra_list"},
						unit_list 				: 	{$push 	: "$unit_list"},
						vgroup_item_ids 		: 	{$push 	: {$cond: [
							{$and: [
								{ $gt : ["$vgroup_id",0] },
							]},
							{item_id: "$item_id", dough_type: "$dough_type", size: "$size", selector:"$selector", item_price: "$item_price", name: "$name", order: "$order", description: "$description"},
							""
						]}},
						all_ids : {$push: "$_id"}
					}},
					{$lookup:	{
						from     : Tables.CRAVEZ_VGROUPS,
						let      : {restaurantId : "$restaurant_id", vgroupId : "$vgroup_id"},
						pipeline : [
							{$match : {
								$expr: {
									$and : [
										{$eq: ["$restaurant_id", "$$restaurantId"]},
										{$eq: ["$kfg_vgroup_id", "$$vgroupId"]},
									],
								},
							}},
						],
						as	:	"vgroup_details"
					}},
					{$lookup:	{
						from     : Tables.ITEMS,
						let      : {restaurantId : "$restaurant_id", itemId : "$item_id", vgroupId :"$vgroup_id"},
						pipeline : [
							{$match : {
								$expr: {
									$and : [
										{$eq: ["$restaurant_id", "$$restaurantId"]},
										{$or: [
											{$eq: ["$item_id", "$$itemId"] },
											{$eq: ["$kfg_vgroup_id", "$$vgroupId" ]},
										]}
									],

								}
							}},
							{$project : {_id: 1 }},
						],
						as	:	"item_details"
					}},
					{$addFields:{
						vgroup_name			: 	{$arrayElemAt: ["$vgroup_details.name",0]},
						vgroup_description	: 	{$arrayElemAt: ["$vgroup_details.description",0]},
						no_of_duplicate		: 	{$arrayElemAt:["$vgroup_details.no_of_duplicate",0]},
						main_item_id		:	{$arrayElemAt:["$item_details._id",0]},
						vgroup_item_ids		:	{$ifNull: [ "$deal_vgroup_ids", "$vgroup_item_ids" ] },
						group_list			: 	{
							$reduce: {
								input: "$group_list",
								initialValue: [],
								in: {$concatArrays: ["$$value", "$$this" ] }
							}
						},
						group_extra_list	: 	{
							$reduce: {
								input: "$group_extra_list",
								initialValue: [],
								in: {$concatArrays: ["$$value", "$$this" ] }
							}
						},
						ex_item_list		: 	{
							$reduce: {
								input: "$ex_item_list",
								initialValue: [],
								in: {$concatArrays: ["$$value", "$$this" ] }
							}
						},
						unit_list			: 	{
							$reduce: {
								input: "$unit_list",
								initialValue: [],
								in: {$concatArrays: ["$$value", "$$this" ] }
							}
						},
						deal_group_list		: 	{
							$reduce: {
								input: "$deal_group_list",
								initialValue: [],
								in: {$concatArrays: ["$$value", "$$this" ] }
							}
						},
						deal_group_extra_list	: 	{
							$reduce: {
								input: "$deal_group_extra_list",
								initialValue: [],
								in: {$concatArrays: ["$$value", "$$this" ] }
							}
						},
						deal_ex_item_list		: 	{
							$reduce: {
								input: "$deal_ex_item_list",
								initialValue: [],
								in: {$concatArrays: ["$$value", "$$this" ] }
							}
						},
					}},
					{$project : {vgroup_details: 0, item_details:0}},
				], { allowDiskUse: true }).toArray().then(result=>{
					console.log("Item Query Done"+(result ? result.length :null));
					parentCallback(null,result);
				}).catch(next);
			},
			unit_list : (parentCallback)=>{
				item_units_masters.find({ restaurant_slug: {$in: [Constants.PIZZA_HUT, Constants.BURGER_KING]},kfg: true }).toArray().then(result=>{
					console.log("Item Done"+(result ? result.length :null));

					let unitList =	{size_list: {}, dough_list: {}, selector_list: {}, item_list: {} };
					result.map(records=>{
						let restId = records.restaurant_id;
						if(records.size_id){
							if(!unitList.size_list[restId]) unitList.size_list[restId] = {};

							unitList.size_list[restId][records.size_id] = records._id;
						}
						if(records.dough_type){
							if(!unitList.dough_list[restId]) unitList.dough_list[restId] = {};

							unitList.dough_list[restId][records.dough_type] = records._id;
						}
						if(records.kfg_selector){
							if(!unitList.selector_list[restId]) unitList.selector_list[restId] = {};

							unitList.selector_list[restId][records.kfg_selector] = records._id;
						}
						if(records.cravez_item_id){
							if(!unitList.item_list[restId]) unitList.item_list[restId] = {};

							unitList.item_list[restId][records.cravez_item_id] = records._id;
						}
					});

					parentCallback(null,unitList);
				}).catch(next);
			},
			update_delete_flag : (parentCallback)=>{
				if(!isAllItemUpdate) return parentCallback(null);

				items.updateMany({
					restaurant_slug : {$in: [Constants.PIZZA_HUT, Constants.BURGER_KING]},
					$or : [
						{is_combo: {$nin : ["1",1,true]}},
						{restaurant_slug: Constants.PIZZA_HUT }
					]
				},{$set: {to_be_deleted: true }}).then(()=>{
					parentCallback(null);
				}).catch(next);
			},
		},(parentErr,parentResponse)=>{
			if(parentErr){
				console.error("Parent parallel error in updateCravezItems");
				console.error(parentErr);
				return  res.send({error : parentErr });
			}

			// return res.send({jk : parentResponse, parentErr: parentErr})

			console.log("parentResponse.item_list ",parentResponse.item_list.length)

			let cravezItemList 	= 	parentResponse.item_list;
			let unitList 		=	parentResponse.unit_list;
			if(cravezItemList && cravezItemList.length >0){
				let activeItemList			=	[];
				let missingUnitList			=	[];

				const item_units	 		=	this.db.collection(Tables.ITEM_UNITS);
				const item_linkings	 		=	this.db.collection(Tables.ITEM_LINKINGS);
				const item_dough_units		=	this.db.collection(Tables.ITEM_DOUGH_UNITS);
				const item_availability	 	=	this.db.collection(Tables.ITEM_AVAILABILITY);
				const item_choices_groups	=	this.db.collection(Tables.ITEM_CHOICES_GROUPS);
				const item_group_extras		=	this.db.collection(Tables.ITEM_GROUP_EXTRAS);
				const item_extra_masters	=	this.db.collection(Tables.ITEM_EXTRA_MASTERS);
				const item_selector_units	=	this.db.collection(Tables.ITEM_SELECTOR_UNITS);
				const restaurant_branches 	=	this.db.collection(Tables.RESTAURANT_BRANCHES);
				const restaurant_categories =	this.db.collection(Tables.RESTAURANT_CATEGORIES);

				eachOfSeries(cravezItemList,(records,firstKey,parentCallback)=>{
					let vgroupId 		= 	records.vgroup_id;
					let restaurantId 	=	records.restaurant_id;
					let vgroupItemIds 	=	records.vgroup_item_ids;
					let restaurantSlug 	=	records.restaurant_slug;

					if(!vgroupId) return parentCallback(null);

					eachOfSeries(vgroupItemIds,(data,secondKey,childEachCallback)=>{
						let itemId 		= 	data.item_id;
						let size 		= 	data.size;
						let doughType 	=	data.dough_type;
						let selector 	=	data.selector;

						if(size){
							if(unitList.size_list[restaurantId] && unitList.size_list[restaurantId][size]){
								data.item_unit_id = unitList.size_list[restaurantId][size];
							}

							if(doughType){
								if(unitList.dough_list[restaurantId] && unitList.dough_list[restaurantId][doughType]){
									data.dough_item_unit_id = unitList.dough_list[restaurantId][doughType];
								}

								if(selector){
									if(unitList.selector_list[restaurantId] && unitList.selector_list[restaurantId][selector]){
										data.selector_item_unit_id = unitList.selector_list[restaurantId][selector];
									}
								}
							}
						}else{
							if(unitList.item_list[restaurantId] && unitList.item_list[restaurantId][itemId]){
								data.item_unit_id = unitList.item_list[restaurantId][itemId];
							}
						}

						asyncParallel({
							unique_item_unit_id : (parellelCallback)=>{
								if(data.item_unit_id) return parellelCallback(null);

								/** Get unique Id Response **/
								Helper.getUniqueId(req,res,next,{type:"item_unit"}).then(uniqueIdResponse=>{
									let uniqueItemUnitid = (uniqueIdResponse.result) ? uniqueIdResponse.result :"";
									parellelCallback(null,uniqueItemUnitid);
								}).catch(next);
							},
						},(_,childParallelResponse)=>{

							let unitUniqueId = 	childParallelResponse.unique_item_unit_id;

							asyncParallel({
								upsell_details : (parellelCallback)=>{
									if(data.item_unit_id || parseInt(size)) return parellelCallback(null);

									let upserllConditions = {
										restaurant_slug :	restaurantSlug,
										cravez_item_id :	parseInt(itemId)
									};

									/** Get size details details */
									item_units_masters.findOne(upserllConditions,{projection: {_id: 1,}}).then(masterResult=>{
										let masterId = (masterResult) ? masterResult._id:"";

										if(masterResult){
											data.item_unit_id = masterId;
											return parellelCallback(null,masterId);
										}

										let updateData = {
											name  	:	data.name,
											modified: 	Helper.getUtcDate(),
										};

										if(data.description &&(data.description.en ||data.description.ar)){
											updateData.description = data.description;
										}

										/** Save unit master details */
										item_units_masters.updateOne(upserllConditions,
										{
											$set		:	updateData,
											$setOnInsert:	{
												channel_id		:	records.channel_id,
												added_by   		:	records.added_by,
												item_unit_id 	:	unitUniqueId,
												restaurant_id 	:	restaurantId,
												created   		:	Helper.getUtcDate(),
												kfg		 		: 	true,
											}
										},{upsert: true }).then(insertResult=>{
											let masterId = (insertResult &&  insertResult.upsertedId && insertResult.upsertedId._id) ? insertResult.upsertedId._id:"";

											if(masterId){
												data.item_unit_id = masterId;
											}
											parellelCallback(null,masterId);
										}).catch(next);
									}).catch(next);
								},
								update_unit : (parellelCallback)=>{
									if(!data.item_unit_id || parseInt(size)) return parellelCallback(null);

									if(!itemId)  return parellelCallback(null);

									/** Update unit master detils */
									item_units_masters.updateOne({
										_id 			:	data.item_unit_id,
										restaurant_slug :	restaurantSlug,
										cravez_item_id 	:	{$exists: false},
									},
									{$set		:	{
										cravez_item_id :	parseInt(itemId)
									}}).then(()=>{
										parellelCallback(null);
									}).catch(next);
								},
							},(parallelSubErr)=>{
								childEachCallback(parallelSubErr);
							});
						});
					},(childEachErr)=>{
						parentCallback(childEachErr);
					});
				},(parentEachErr)=>{
					if(parentEachErr){
						console.error("First each error in updateCravezItems");
						return console.error(parentEachErr);
					}

					eachOfSeries(cravezItemList,(records,thirdKey,eachCallback)=>{
						let itemId	 		=	records.item_id;
						let vgroupId 		= 	records.vgroup_id;
						let doughType 		= 	records.dough_type;
						let mainItemId 		=	records.main_item_id;
						let branchIds 		=	records.branch_ids;
						let submenuIds 		=	records.submenu_ids;
						let restaurantId 	=	records.restaurant_id;
						let restaurantSlug 	=	records.restaurant_slug;
						let addedBy			=	records.added_by;
						let vgroupItemIds 	=	records.vgroup_item_ids;
						let dealVgroupIds 	=	(records.deal_vgroup_ids) ? records.deal_vgroup_ids :[];
						let cravezUnitList 		=	records.unit_list;
						let cravezExItemList 	=	records.ex_item_list;
						let cravezGroupExtraList=	records.group_extra_list;
						let cravezGroupList 	=	records.group_list;
						let dealGroupList 		=	records.deal_group_list;
						let dealExItemList 		=	records.deal_ex_item_list;
						let dealGroupExtraList	=	records.deal_group_extra_list;

						console.log("item id "+itemId+" index -"+thirdKey);

						/** Manage units */
						let isMissing 	= false;
						let saveGroup 	= false;
						if(vgroupItemIds && vgroupItemIds.length >0){
							vgroupItemIds.map(unitData=>{
								let missingObj = {};
								if(unitData.size > 0){
									if(unitList.size_list[restaurantId] && unitList.size_list[restaurantId][unitData.size]){
										unitData.item_unit_id = unitList.size_list[restaurantId][unitData.size];
									}else{
										isMissing		=	true;
										missingObj.size = 	unitData.size;
									}

									if(unitData.dough_type){
										saveGroup = true;
										if(unitList.dough_list[restaurantId] && unitList.dough_list[restaurantId][unitData.dough_type]){
											unitData.dough_item_unit_id = unitList.dough_list[restaurantId][unitData.dough_type];
										}else{
											isMissing				=	true;
											missingObj.dough_type 	=	unitData.dough_type;
										}

										if(unitData.selector){
											if(unitList.selector_list[restaurantId] && unitList.selector_list[restaurantId][unitData.selector]){
												unitData.selector_item_unit_id = unitList.selector_list[restaurantId][unitData.selector];
											}else{
												isMissing			=	true;
												missingObj.selector	= 	unitData.selector;
											}
										}
									}
								}

								if(Object.keys(missingObj).length >0){
									missingObj.vgroup_id = 	vgroupId;
									missingObj.item_id	 =	unitData.item_id;
									missingUnitList.push(missingObj);
								}
							});
						}

						if(dealVgroupIds && dealVgroupIds.length >0){
							dealVgroupIds.map(unitData=>{
								let missingObj = {};
								if(unitData.size > 0){
									if(unitList.size_list[restaurantId] && unitList.size_list[restaurantId][unitData.size]){
										unitData.item_unit_id = unitList.size_list[restaurantId][unitData.size];
									}else{
										isMissing		=	true;
										missingObj.size = 	unitData.size;
									}

									if(unitData.dough_type){
										saveGroup = true;
										if(unitList.dough_list[restaurantId] && unitList.dough_list[restaurantId][unitData.dough_type]){
											unitData.dough_item_unit_id = unitList.dough_list[restaurantId][unitData.dough_type];
										}else{
											isMissing				=	true;
											missingObj.dough_type 	=	unitData.dough_type;
										}

										if(unitData.selector){
											if(unitList.selector_list[restaurantId] && unitList.selector_list[restaurantId][unitData.selector]){
												unitData.selector_item_unit_id = unitList.selector_list[restaurantId][unitData.selector];
											}else{
												isMissing			=	true;
												missingObj.selector	= 	unitData.selector;
											}
										}
									}
								}

								if(Object.keys(missingObj).length >0){
									missingObj.vgroup_id = 	vgroupId;
									missingObj.item_id	 =	unitData.item_id;
									missingUnitList.push(missingObj);
								}
							});
						}

						if(isMissing) {
							console.log("missing ", JSON.stringify(missingUnitList));
							return eachCallback(null);
						}

						asyncParallel({
							branch_list : (parellelCallback)=>{
								if(branchIds == 0) return parellelCallback(null,[]);

								let tempStoreId	=	(branchIds) ? branchIds.split(',') :[];
								if(tempStoreId.length >0){
									let tmpBraIds = [];
									tempStoreId.map(tmpId=>{
										tmpBraIds.push(String(tmpId), parseInt(tmpId));
									});
									tempStoreId = tmpBraIds;
								}

								/** Get branch list */
								restaurant_branches.distinct("_id",{restaurant_id: restaurantId, kfg_store_id: {$in: tempStoreId}}).then(branchResult=>{
									parellelCallback(null,branchResult);
								}).catch(next);
							},
							category_list : (parellelCallback)=>{
								if(!submenuIds) return  parellelCallback(null,[]);

								submenuIds			= submenuIds.split(',');
								let submenuIdsString= submenuIds.map(tmpId =>{ return  String(tmpId) });
								let submenuIdsInt 	= submenuIds.map(tmpId =>{ return  parseInt(tmpId) });

								/** Get category details list */
								restaurant_categories.distinct( "_id",{
									$or : [
										{kfg_sub_menu_id:  {$in : submenuIdsString}},
										{kfg_sub_menu_id:  {$in : submenuIdsInt}},
									]
								}).then(categoryResult=>{
									parellelCallback(null,categoryResult);
								}).catch(next);
							},
							item_unqiue_id : (parellelCallback)=>{
								if(!vgroupId) return parellelCallback(null,itemId);

								/** get item unqiue id **/
								Helper.getUniqueId(req,res,next,{type:"item"}).then(uniqueIdResponse=>{
									parellelCallback(null,uniqueIdResponse.result);
								}).catch(next);
							},
							item_mark_delete : (parellelCallback)=>{
								if(!mainItemId) return parellelCallback(null);

								asyncParallel({
									item_link_delete : (subCallback)=>{
										item_linkings.updateMany({
											item_id : mainItemId
										},
										{$set: {
											to_be_deleted	: 	true,
											modified 		:	Helper.getUtcDate(),
										}}).then(()=>{
											subCallback(null);
										}).catch(next);
									},
									item_availability_delete : (subCallback)=>{
										item_availability.deleteMany({item_id: mainItemId }).then(()=>{
											subCallback(null);
										}).catch(next);
									},
									units_delete : (subCallback)=>{
										item_units.updateMany({
											item_id : mainItemId
										},
										{$set: {
											to_be_deleted	: true,
											modified 		: Helper.getUtcDate(),
										}}).then(()=>{
											subCallback(null);
										}).catch(next);
									},
									dough_delete : (subCallback)=>{
										item_dough_units.updateMany({
											item_id : mainItemId
										},
										{$set: {
											to_be_deleted	: true,
											modified 		: Helper.getUtcDate(),
										}}).then(()=>{
											subCallback(null);
										}).catch(next);
									},
									selector_delete : (subCallback)=>{
										item_selector_units.updateMany({
											item_id : mainItemId
										},
										{$set: {
											to_be_deleted	: true,
											modified 		: Helper.getUtcDate(),
										}}).then(()=>{
											subCallback(null);
										}).catch(next);
									},
									group_delete : (subCallback)=>{
										item_choices_groups.updateMany({
											item_id : mainItemId,
										},
										{$set: {
											to_be_deleted	: true,
											modified 		: Helper.getUtcDate(),
										}}).then(()=>{
											subCallback(null);
										}).catch(next);
									},
									group_item_delete : (subCallback)=>{
										item_extra_masters.updateMany({
											item_id : mainItemId,
										},
										{$set: {
											to_be_deleted	: true,
											modified 		: Helper.getUtcDate(),
										}}).then(()=>{
											subCallback(null);
										}).catch(next);
									},
									group_item_extra : (subCallback)=>{
										item_group_extras.updateMany({
											item_id : mainItemId,
										},
										{$set: {
											to_be_deleted	: true,
											modified 		: Helper.getUtcDate(),
										}}).then(()=>{
											subCallback(null);
										}).catch(next);
									},
									update_unit_price : (parellelSubCallback)=>{
										parellelSubCallback(null);

										/** Update item unit price **/
										this.updateItemUnitPrice(req, res,next,{item_id: mainItemId}).then(()=>{});
									},
								},(parallelErr)=>{
									parellelCallback(parallelErr);
								});
							},
							item_unqiue_id : (parellelCallback)=>{
								if(!vgroupId) return parellelCallback(null,itemId);

								/** get item unqiue id **/
								Helper.getUniqueId(req,res,next,{type:"item"}).then(uniqueIdResponse=>{
									parellelCallback(null,uniqueIdResponse.result);
								}).catch(next);
							},
						},(parallelErr, parallelResponse)=>{
							if(parallelErr) return eachCallback(parallelErr);

							let branchList 		= 	parallelResponse.branch_list;
							let categoryList 	= 	parallelResponse.category_list;
							let itemUnqiueId	=	parallelResponse.item_unqiue_id;

							let isCombo = (records.is_combo && restaurantSlug == Constants.BURGER_KING) ? true :false;
							let updateAbleData = {
								name 					: 	records.name,
								description 			:	records.description,
								menu_ids				:	[],
								category_ids			:	categoryList,
								is_combo				:	isCombo,
								order					:	records.order,
								channel_id				:	records.channel_id,
								item_price				:	records.item_price,
								kfg_category_id			:	records.category_id,
								kfg_sub_category_id		:	submenuIds,
								price_on_selection		:	(vgroupId) ? Constants.PRICE_ON_SELECTION 	:0,
								modified	:  (records.modified)	?	Helper.getUtcDate(records.modified) :Helper.getUtcDate(),
							};

							if(records.combo_upsell_item_ids) updateAbleData.combo_upsell_item_ids = records.combo_upsell_item_ids;
							if(records.first_component_details) updateAbleData.first_component_details = records.first_component_details;

							let onlyInsertData = {
								kfg		  		:	true,
								is_active		:	Constants.DEACTIVE,
								item_id			:	itemUnqiueId,
								restaurant_slug	:	records.restaurant_slug,
								added_by   		:	records.added_by,
								created  : (records.created) ? Helper.getUtcDate(records.created) :Helper.getUtcDate()
							};

							if(records.is_half && parseInt(records.is_half) >0){
								updateAbleData.is_half = true;
							}

							let itemConditions  =  {restaurant_id: 	restaurantId};

							if(vgroupId){
								itemConditions.kfg_vgroup_id 	=	vgroupId;

								let tmpVgroupItems = 	records.vgroup_item_ids.map(tmpData=>{
															return {
																item_id 	:	tmpData.item_id,
																size 		: 	tmpData.size,
																selector 	: 	tmpData.selector,
																dough_type 	: 	tmpData.dough_type,
															}
														});

								updateAbleData.name			 	=	records.vgroup_name;
								updateAbleData.is_vgroup		=	true;
								updateAbleData.no_of_duplicate 	=	records.no_of_duplicate;
								updateAbleData.description		=	records.vgroup_description;
								updateAbleData.v_group_item_ids = 	tmpVgroupItems;
							}else{
								itemConditions.item_id 	=	itemUnqiueId;
							}

							/** Manage item type */
							let itemType = "";
							if(!vgroupId && !records.is_combo) 	itemType	= 	Constants.NORMAL_ITEM;
							if(vgroupId && doughType <=0) 		itemType 	=	Constants.NORMAL_VGROUP;
							if(restaurantSlug == Constants.BURGER_KING && records.is_combo)	itemType = 	Constants.COMBO_ITEM;

							let isDealItem = false;
							if(restaurantSlug == Constants.PIZZA_HUT){
								if(doughType >0) itemType 	= 	Constants.PIZZA_VGROUP;

								if(records.is_half && parseInt(records.is_half) >0){
									if(vgroupId >0 && vgroupId == 2){
										updateAbleData.is_half = true;
										itemType	= 	Constants.HALF_AND_HALF_ITEM;
									}else{
										itemType	= 	Constants.NORMAL_ITEM;
									}
								}

								if(records.is_combo){
									isDealItem	=	true;
									itemType	=	Constants.DEAL_ITEM;
									let tmpVgroupItems = 	dealVgroupIds.map(tmpData=>{
										return {
											item_id 	:	tmpData.item_id,
											size 		: 	tmpData.size,
											selector 	: 	tmpData.selector,
											dough_type 	: 	tmpData.dough_type,
										}
									});

									updateAbleData.is_deal 			=	true;
									updateAbleData.v_group_item_ids	= 	tmpVgroupItems;
									updateAbleData.no_of_components	= 	records.no_of_components;
								}
							}

							if(itemType) updateAbleData.item_type = itemType;

							if(mainItemId){
								itemConditions = {_id: mainItemId};

								onlyInsertData.restaurant_id = restaurantId;
								if(vgroupId){
									onlyInsertData.kfg_vgroup_id = vgroupId;
								}
							}

							items.updateOne(itemConditions,{
								$set 		: 	updateAbleData,
								$setOnInsert:	onlyInsertData,
								$unset		:	{to_be_deleted: 1},
							},{upsert: true}).then(itemResult => {

								if(itemResult && itemResult.upsertedId && itemResult.upsertedId._id){
									mainItemId = itemResult.upsertedId._id;
								}

								if(mainItemId){
									activeItemList.push({
										item_id 		: 	itemId,
										cravez_item_ids : 	records.all_ids,
										main_item_id	: 	mainItemId,
										is_active		:	records.is_active
									});

									let itemUnitObj			=	{};
									let dealGroupIds 		=	{};
									let dealExItemIds		= 	{};
									let itemUnitSelectorObj	=	{};
									asyncParallel({
										availability_details : (parellelSubCallback)=>{
											if(records.time_array.length <=0) return parellelSubCallback(null);

											let timeArray =	records.time_array.map(data=>{
												let fromTime	=	parseFloat(data.start_time.substr(0,5).replace(":","."));
												let toTime		=	parseFloat(data.end_time.substr(0,5).replace(":","."));

												if(data.start_time =="00:00:00" && data.end_time == "00:00:00"){
													fromTime	=	parseFloat(Constants.DAY_INITIAL_START_TIME.replace(':','.'));
													toTime	 	=	parseFloat(Constants.DAY_INITIAL_END_TIME.replace(':','.'));
												}

												return {
													item_id  	: 	mainItemId,
													from_time	:	fromTime,
													to_time		:	toTime,
													kfg		  	:	true,
													channel_id	:	records.channel_id,
													modified    : 	Helper.getUtcDate(),
													created 	: 	Helper.getUtcDate(),
													restaurant_id	: 	restaurantId,
													restaurant_slug	:	restaurantSlug,
												};
											});

											item_availability.insertMany(timeArray).then(()=>{
												parellelSubCallback(null);
											}).catch(next);
										},
										linkings_details : (parellelSubCallback)=>{
											item_linkings.updateOne({
												item_id	: mainItemId,
											},
											{
												$set : {
													menu_ids			: [],
													branch_ids			: branchList,
													category_ids		: categoryList,
													kfg_store_id		: branchIds,
													kfg		  			: true,
													type				: Constants.ITEM_LISTED_TO_SELECTED_BRANCH_LIST,
													restaurant_id		: restaurantId,
													restaurant_slug		: restaurantSlug,
													channel_id			: records.channel_id,
													customize_attributes: {
														name 				: updateAbleData.name,
														price_on_selection	: updateAbleData.price_on_selection
													},
												},
												$setOnInsert : {
													created	 :(records.created) ? Helper.getUtcDate(records.created) :Helper.getUtcDate()
												},
												$unset :{
													to_be_deleted : 1
												}
											},{upsert :true}).then(()=>{
												parellelSubCallback(null);
											}).catch(next);
										},
										save_units : (parellelSubCallback)=>{
											if(!cravezUnitList || cravezUnitList.length <=0) return parellelSubCallback(null);

											eachOfSeries(cravezUnitList,(unitData,unitIndex, unitEachCallback)=>{
												let itemUnitId 		=	unitData.item_unit_id;
												let unitPrice 		=	unitData.price;
												let unitSorting 	=	unitData.sorting;
												let unitStatus 		=	unitData.status;

												/** Save units details */
												item_units.updateOne({
													item_id 		: 	mainItemId,
													restaurant_id 	:	restaurantId,
													item_unit_id 	: 	itemUnitId,
												},
												{
													$set:	{
														price 	: unitPrice,
														sorting : unitSorting,
														status 	: unitStatus,
													},
													$setOnInsert:	{
														added_by		:	addedBy,
														channel_id		:	Constants.CHANNEL_SOAP,
														restaurant_slug :	restaurantSlug,
														created   		:	Helper.getUtcDate(),
														kfg		 		: 	true,
													}
												},{upsert: true }).then(()=>{
													unitEachCallback(null);
												}).catch(next);
											},(parentEachErr)=>{
												parellelSubCallback(parentEachErr);
											});
										},
										save_extra_group : (parellelSubCallback)=>{
											if((!vgroupId && !isDealItem) || vgroupItemIds.length <=0){
												return parellelSubCallback(null);
											}

											asyncParallel({
												group_id : (groupCallback)=>{
													if(isDealItem || !saveGroup) return groupCallback(null,null);

													/** Get group details */
													item_choices_groups.findOne({
														restaurant_id 	:  	restaurantId,
														item_id 		:  	mainItemId,
														is_choice		:	true,
													},{projection: {_id:1}}).then(groupResult=>{

														let groupId = (groupResult) ? groupResult._id :"";

														if(groupId){
															item_choices_groups.updateOne({_id: groupId },{
																$set :	{
																	name : {
																		en : "Your Choice of Pizza",
																		ar : "اختيارك من البيتزا",
																	},
																	min_quantity 	: 1,
																	max_quantity 	: 1,
																	order 		 	: 1,
																	modified 		: Helper.getUtcDate(),
																},
																$unset: {to_be_deleted: true }
															}).then(()=>{
																groupCallback(null,groupId)
															}).catch(next);
														}else{
															/** Update group details */
															item_choices_groups.updateOne({
																restaurant_id 	:  	restaurantId,
																item_id 		:  	mainItemId,
																is_choice		:	true,
															},
															{
																$set :	{
																	name : {
																		en : "Your Choice of Pizza",
																		ar : "اختيارك من البيتزا",
																	},
																	min_quantity 	: 1,
																	max_quantity 	: 1,
																	order 		 	: 1,
																	modified 		: Helper.getUtcDate(),
																},
																$setOnInsert:	{
																	kfg		 		: 	true,
																	added_by   		:	records.added_by,
																	channel_id		:	records.channel_id,
																	restaurant_slug : 	restaurantSlug,
																	cravez_item_id 	:	itemUnqiueId,
																	created   		:	Helper.getUtcDate(),
																}
															},{upsert: true }).then(choiceResult=>{
																let choiceId = (choiceResult &&  choiceResult.upsertedId && choiceResult.upsertedId._id) ? choiceResult.upsertedId._id:"";
																groupCallback(null,choiceId);
															}).catch(next);
														}
													}).catch(next);
												},
											},(asyncGroupErr, asyncGroupResponse)=>{
												if(asyncGroupErr) return  parellelSubCallback(asyncEachSubErr);

												let groupId 		= 	asyncGroupResponse.group_id;
												let tmpUnitDough 	=	{};
												let tmpUnitselector = 	{};
												eachOfSeries(vgroupItemIds,(unitRecords,fourthKey, eachSubCallback)=>{
													if(!unitRecords.item_unit_id && !unitRecords.dough_item_unit_id && !unitRecords.selector_item_unit_id){
														return eachSubCallback(null);
													}

													let size	 		= 	unitRecords.size;
													let selector	 	= 	unitRecords.selector;
													let tmpPrice 		= 	unitRecords.item_price;
													let itemOrder 		= 	unitRecords.order;
													let tmpItemName		= 	unitRecords.name;
													let tmpItemId 		= 	unitRecords.item_id;
													let doughType	 	= 	unitRecords.dough_type;
													let sizeUnitId 		= 	unitRecords.item_unit_id;
													let doughUnitId		= 	unitRecords.dough_item_unit_id;
													let selectorUnitId 	=	unitRecords.selector_item_unit_id;

													if(size >0)  tmpPrice = 0;

													asyncParallel({
														unit_id : (unitCallback)=>{
															if(itemUnitObj[sizeUnitId]){
																return unitCallback(null,itemUnitObj[sizeUnitId]);
															}

															/** Get unit details */
															item_units.findOne({
																item_id 	 : 	mainItemId,
																item_unit_id :  sizeUnitId
															},{projection: {_id:1}}).then(unitResult=>{

																let unitUpdateData = {
																	price 		: 	(tmpPrice) ? tmpPrice :0,
																	sorting		:	(itemOrder) ? itemOrder :0,
																	status 		: 	Constants.ACTIVE,
																	modified	:	Helper.getUtcDate(),
																};

																if(size){
																	unitUpdateData.kfg_size = size;
																}else{
																	unitUpdateData.cravez_item_id = tmpItemId;
																}

																let unitId = (unitResult) ? unitResult._id :"";
																if(unitId){
																	/** Update unit details */
																	item_units.updateOne({
																		_id: unitId
																	},
																	{
																		$set : 	unitUpdateData,
																		$unset: {to_be_deleted: true }
																	}).then(()=>{
																		itemUnitObj[sizeUnitId] = unitId;
																		return unitCallback(null,unitId);
																	}).catch(next);
																}else{

																	/** Save unit details */
																	item_units.updateOne({
																		item_id 	 : 	mainItemId,
																		item_unit_id :  sizeUnitId
																	},
																	{
																		$set : 	unitUpdateData,
																		$setOnInsert:	{
																			kfg		 :	true,
																			created  :	(records.created) ? Helper.getUtcDate(records.created) :Helper.getUtcDate()
																		},
																		$unset : {
																			to_be_deleted: true
																		}
																	},{upsert: true}).then(unitResult=>{
																		if(unitResult && unitResult.upsertedId && unitResult.upsertedId._id){
																			unitId = unitResult.upsertedId._id;
																			itemUnitObj[sizeUnitId] = unitId;
																		}
																		return unitCallback(null,unitId);
																	}).catch(next);
																}
															}).catch(next);
														},
													},(childUnitErr, childUnitResponse)=>{
														if(childUnitErr || !doughUnitId){
															return eachSubCallback(childUnitErr);
														}

														let unitId = childUnitResponse.unit_id;

														if(doughUnitId && !unitId){
															console.log("Unit mongo id not found ",JSON.stringify(unitRecords));
															return eachSubCallback(null);
														}

														asyncParallel({
															dough_id : (doughCallback)=>{
																if(!doughUnitId) return doughCallback(null,null);

																/** Get dough details */
																item_dough_units.findOne({
																	item_id 	 : 	mainItemId,
																	item_unit_id :  doughUnitId
																},{projection: {_id:1}}).then(doughResult=>{

																	let doughId =(doughResult) ? doughResult._id :"";

																	let doughUpdateData = {
																		$set : 	{
																			price 		: 	0,
																			sorting		:	0,
																			status 		: 	Constants.ACTIVE,
																			modified	:	Helper.getUtcDate(),
																			kfg_dough_type:	doughType,
																		},
																		$setOnInsert:	{
																			kfg		 :	true,
																			restaurant_id 	:  	restaurantId,
																			restaurant_slug : 	restaurantSlug,
																			created  :	(records.created) ? Helper.getUtcDate(records.created) :Helper.getUtcDate()
																		},
																		$unset : {
																			to_be_deleted: true
																		}
																	}

																	if(!tmpUnitDough[doughType]){
																		tmpUnitDough[doughType] = true;
																		doughUpdateData["$set"].parents = [unitId];
																	}else{
																		doughUpdateData["$addToSet"] = {parents: unitId};
																	}

																	if(doughId){
																		/** Update dough details */
																		item_dough_units.updateOne({_id: doughId },doughUpdateData).then(()=>{
																			itemUnitObj[doughUnitId] = doughId;
																			return doughCallback(null,doughId);
																		}).catch(next);
																	}else{
																		/** Save dough details */
																		item_dough_units.updateOne({
																			item_id 	 : 	mainItemId,
																			item_unit_id :  doughUnitId
																		},doughUpdateData,{upsert: true}).then(doughResult=>{
																			if(doughResult && doughResult.upsertedId && doughResult.upsertedId._id){
																				doughId = doughResult.upsertedId._id;
																				itemUnitObj[doughUnitId] = doughId;
																			}
																			doughCallback(null,doughId);
																		}).catch(next);
																	}
																}).catch(next);
															},
														},(childDoughErr, childDoughResponse)=>{
															if(childDoughErr){
																return eachSubCallback(childDoughErr);
															}

															let doughItemUnitId = childDoughResponse.dough_id;
															asyncParallel({
																selector_id : (selectorCallback)=>{
																	if(isNaN(selector) || !parseInt(selector) || !selectorUnitId) return selectorCallback(null,null);

																	/** Get selector details */
																	item_selector_units.findOne({
																		item_id 	 : 	mainItemId,
																		item_unit_id :  selectorUnitId
																	},{projection: {_id:1}}).then(selectorResult=>{

																		let selectorId =(selectorResult) ? selectorResult._id :"";

																		let selectorUpdateData = {
																			$set : 	{
																				price 		: 	0,
																				sorting		:	0,
																				status 		: 	Constants.ACTIVE,
																				modified	: 	Helper.getUtcDate(),
																				kfg_selector:	selector,
																			},
																			$setOnInsert:	{
																				kfg		 :	true,
																				restaurant_id 	:  	restaurantId,
																				restaurant_slug : 	restaurantSlug,
																				created  :	(records.created) ? Helper.getUtcDate(records.created) :Helper.getUtcDate()
																			},
																			$unset : {
																				to_be_deleted: true
																			}
																		}

																		if(!tmpUnitselector[selector]){
																			tmpUnitselector[selector] = true;

																			selectorUpdateData["$set"].parents = [unitId];
																			selectorUpdateData["$set"].dough_type_parents = [doughItemUnitId];
																		}else{
																			selectorUpdateData["$addToSet"] = {
																				parents			  : unitId,
																				dough_type_parents: doughItemUnitId
																			};
																		}

																		if(selectorId){
																			/** Update selector details */
																			item_selector_units.updateOne({_id: selectorId },selectorUpdateData).then(()=>{
																				itemUnitObj[selectorUnitId] = selectorId;

																				if(!itemUnitSelectorObj[sizeUnitId]){
																					itemUnitSelectorObj[sizeUnitId] = {};
																				}
																				if(!itemUnitSelectorObj[sizeUnitId][doughUnitId]){
																					itemUnitSelectorObj[sizeUnitId][doughUnitId] = {};
																				}

																				itemUnitSelectorObj[sizeUnitId][doughUnitId][selectorUnitId] =  selectorId;

																				selectorCallback(null,selectorId);
																			}).catch(next);
																		}else{
																			/** Save selector details */
																			item_selector_units.updateOne({
																				item_id 	 : 	mainItemId,
																				item_unit_id :  selectorUnitId
																			},selectorUpdateData,{upsert: true}).then(selectorResult=>{
																				if(selectorResult && selectorResult.upsertedId && selectorResult.upsertedId._id){
																					selectorId = selectorResult.upsertedId._id;
																					itemUnitObj[selectorUnitId] = selectorId;

																					if(!itemUnitSelectorObj[sizeUnitId]){
																						itemUnitSelectorObj[sizeUnitId] = {};
																					}
																					if(!itemUnitSelectorObj[sizeUnitId][doughUnitId]){
																						itemUnitSelectorObj[sizeUnitId][doughUnitId] = {};
																					}

																					itemUnitSelectorObj[sizeUnitId][doughUnitId][selectorUnitId] =  selectorId;
																				}
																				selectorCallback(null,selectorId);
																			}).catch(next);
																		}
																	}).catch(next);
																},
															},(childSelectorErr,childSelectorResponse)=>{
																if(childSelectorErr){
																	return eachSubCallback(childSelectorErr);
																}

																if(isDealItem) return eachSubCallback(null,null);

																let selectorItemUnitId = childSelectorResponse.selector_id;
																asyncParallel({
																	extra_item_id : (extraCallback)=>{

																		item_extra_masters.findOne({
																			restaurant_id 	:  	restaurantId,
																			item_id 		:  	mainItemId,
																			extra_item_id	:	parseInt(tmpItemId),
																			is_extra		:	true,
																		},{projection: {_id: 1,}}).then(extraResult=>{

																			let extraId = (extraResult) ? extraResult._id:"";
																			if(extraId){
																				item_extra_masters.updateOne({
																					_id: extraId
																				},
																				{
																					$set: {
																						name  		: tmpItemName,
																						extra_fees 	: 0,
																						modified 	: Helper.getUtcDate(),
																					},
																					$unset: {
																						to_be_deleted: true
																					}
																				}).then(()=>{
																					return extraCallback(null,extraId);
																				}).catch(next);
																			}else{
																				let exUpdateData = {
																					name  		: tmpItemName,
																					extra_fees 	: 0,
																					modified 	: Helper.getUtcDate(),
																				};

																				item_extra_masters.updateOne({
																					restaurant_id:  restaurantId,
																					item_id 	:  	mainItemId,
																					extra_item_id	:	parseInt(tmpItemId),
																					is_extra	:	true,
																				},
																				{
																					$set		:	exUpdateData,
																					$setOnInsert:	{
																						added_by :records.added_by,
																						channel_id:records.channel_id,
																						is_active	:	Constants.ACTIVE,
																						restaurant_slug: 	restaurantSlug,
																						created   	 :Helper.getUtcDate(),
																						kfg		 	 : 	true,
																					}
																				},{upsert: true }).then(extraResult=>{
																					let extraId = (extraResult &&  extraResult.upsertedId && extraResult.upsertedId._id) ? extraResult.upsertedId._id:"";
																					extraCallback(null,extraId);
																				}).catch(next);
																			}
																		}).catch(next);
																	},
																},(parallelItemExtraErr,parallelItemExtraResponse)=>{
																	if(parallelItemExtraErr) eachSubCallback(parallelItemExtraErr);

																	if(!parallelItemExtraResponse.extra_item_id){
																		console.log("Extra item mongo id not found ",JSON.stringify(unitRecords));
																		return eachSubCallback(null);
																	}

																	let exItemId = parallelItemExtraResponse.extra_item_id;

																	let groupExConditions = {
																		group_id 		: 	groupId,
																		item_id 		: 	mainItemId,
																		restaurant_id 	:	restaurantId,
																		item_extra_id	:	exItemId,
																		kfg_dough_type	:	doughType,
																		kfg_size		:	size
																	};

																	if(selector){
																		groupExConditions.kfg_selector = selector;
																	}

																	let  groupUpdateData = {
																		$set	:	{
																			modified 	 :	Helper.getUtcDate(),
																			unit_id		 :	sizeUnitId,
																			size_id		 :	unitId,
																			dough_type_id:	doughItemUnitId,
																			dough_master_unit_id:	doughUnitId,
																			extra_fees 		: 	parseFloat(unitRecords.item_price),
																			max_quantity 	: 	1,
																			min_quantity 	: 	1,
																		},
																		$setOnInsert:	{
																			channel_id:records.channel_id,
																			added_by :records.added_by,
																			restaurant_slug:restaurantSlug,
																			created :	Helper.getUtcDate(),
																			kfg		: 	true,
																		},
																		$unset	 : 	{
																			to_be_deleted: true
																		}
																	};

																	if(selector){
																		groupUpdateData["$set"].selector_id = selectorItemUnitId;
																		groupUpdateData["$set"].selector_master_unit_id = selectorUnitId;
																	}

																	item_group_extras.updateOne( groupExConditions, groupUpdateData, {upsert: true }).then(()=>{
																		eachSubCallback(null);
																	}).catch(next);
																});
															});
														});
													});
												},(asyncEachSubErr)=>{
													parellelSubCallback(asyncEachSubErr);
												});
											});
										},
										save_deal_groups : (parellelSubCallback)=>{
											if(!isDealItem || !dealGroupList || dealGroupList.length <=0){
												return parellelSubCallback(null);
											}

											asyncParallel({
												group_id : (groupCallback)=>{
													eachOfSeries(dealGroupList,(groupData,groupIndex,groupEachCallback)=>{
														let tmpGroupId 	= 	groupData._id;

														/** Set group conditions */
														let groupConditions = {
															item_id 		: 	mainItemId,
															restaurant_id 	:	restaurantId,
														};

														if(groupData.kfg_modifiers_groups_id){
															groupConditions.kfg_modifiers_groups_id = parseInt(groupData.kfg_modifiers_groups_id);
														}
														if(groupData.kfg_groups_class){
															groupConditions.kfg_groups_class = parseInt(groupData.kfg_groups_class);
														}

														/** Get item choice detils */
														item_choices_groups.findOne(groupConditions,{projection: {_id: 1,}}).then(masterResult=>{

															if(masterResult){
																let choiceId =  masterResult._id;
																dealGroupIds[tmpGroupId] = choiceId;

																item_choices_groups.updateOne({_id: choiceId },{
																	$set: {
																		name   		: groupData.name,
																		order 	 	: groupData.order,
																		modified	: groupData.modified,
																		min_quantity: groupData.min_quantity,
																		max_quantity: groupData.max_quantity,
																	},
																	$unset: {to_be_deleted: true }
																}).then(()=>{
																	groupEachCallback(null);
																}).catch(next);
															}else{
																/** Save item choice detils */
																item_choices_groups.updateOne(groupConditions,
																{
																	$set:	{
																		name   		: groupData.name,
																		order 	 	: groupData.order,
																		modified	: groupData.modified,
																		min_quantity: groupData.min_quantity,
																		max_quantity: groupData.max_quantity,
																	},
																	$setOnInsert:	{
																		added_by		:	addedBy,
																		channel_id		:	Constants.CHANNEL_SOAP,
																		restaurant_slug :	restaurantSlug,
																		created   		:	Helper.getUtcDate(),
																		kfg		 		: 	true,
																	},
																	$unset: {
																		to_be_deleted: 1
																	}
																},{upsert: true }).then(insertResult=>{
																	if(insertResult &&  insertResult.upsertedId && insertResult.upsertedId._id){
																		dealGroupIds[tmpGroupId] = insertResult.upsertedId._id;
																	}
																	groupEachCallback(null);
																}).catch(next);
															}
														}).catch(next);
													},(groupEachErr)=>{
														groupCallback(groupEachErr);
													});
												},
											},(asyncGroupErr)=>{
												if(asyncGroupErr) return  parellelSubCallback(asyncEachSubErr);

												eachOfSeries(dealExItemList,(exData,exItemKey, eachSubCallback)=>{
													let tmpExItemId 	= 	exData._id;
													let tmpKfgItemId 	= 	exData.kfg_item_id;
													let kfgExItemId 	=	parseInt(exData.extra_item_id);

													/** Set conditions */
													let exMasterConditions = {
														item_id 		:	mainItemId,
														restaurant_id 	:	restaurantId,
														extra_item_id	:	kfgExItemId,
													};

													if(tmpKfgItemId && dealVgroupIds){
														dealVgroupIds.map(dealItemRecords=>{
															if(dealItemRecords.item_id && dealItemRecords.item_id ==  tmpKfgItemId){
																exMasterConditions.item_unit_id = dealItemRecords.item_unit_id;
															}
														});
													}

													item_extra_masters.findOne(exMasterConditions,{projection: {_id: 1,}}).then(masterResult=>{

														if(masterResult){
															dealExItemIds[tmpExItemId] = masterResult._id;

															item_extra_masters.updateOne({
																_id:  masterResult._id
															},{
																$set: {
																	name   				: 	exData.name,
																	modified 			:	exData.modified,
																	extra_fees			: 	exData.extra_fees,
																	kfg_sur_chg_usel 	:	exData.kfg_sur_chg_usel,
																	kfg_size_sur_chg 	: 	exData.kfg_size_sur_chg,
																	item_short_name		:	exData.item_short_name,
																},
																$unset: {to_be_deleted: true }
															}).then(()=>{
																eachSubCallback(null);
															}).catch(next);
														}else{
															/** Save extra master details */
															item_extra_masters.updateOne(exMasterConditions,
															{
																$set:	{
																	name   				: 	exData.name,
																	modified 			:	exData.modified,
																	extra_fees			: 	exData.extra_fees,
																	kfg_sur_chg_usel 	:	exData.kfg_sur_chg_usel,
																	kfg_size_sur_chg 	: 	exData.kfg_size_sur_chg,
																	item_short_name		:	exData.item_short_name,
																},
																$setOnInsert:	{
																	is_active		:	Constants.ACTIVE,
																	channel_id		:	Constants.CHANNEL_SOAP,
																	added_by		:	addedBy,
																	restaurant_slug :	restaurantSlug,
																	kfg_main_item_id: 	String(tmpKfgItemId),
																	created   		:	Helper.getUtcDate(),
																	kfg		 		: 	true,
																},
																$unset: {
																	to_be_deleted: 1
																}
															},{upsert: true }).then(insertResult=>{
																if(insertResult &&  insertResult.upsertedId && insertResult.upsertedId._id){
																	dealExItemIds[tmpExItemId] = insertResult.upsertedId._id;
																}
																eachSubCallback(null);
															}).catch(next);
														}
													}).catch(next);
												},(asyncEachSubErr)=>{
													parellelSubCallback(asyncEachSubErr);
												});
											});
										},
									},(parallelErr)=>{
										if(parallelErr) return  eachCallback(parallelErr);

										asyncParallel({
											save_groups : (parellelSubCallback)=>{
												if(!cravezGroupList || cravezGroupList.length <=0){
													return parellelSubCallback(null);
												}

												let groupIds 	=	{};
												let exItemIds	= 	{};
												asyncParallel({
													group_id : (groupCallback)=>{
														eachOfSeries(cravezGroupList,(groupData,groupIndex,groupEachCallback)=>{
															let tmpGroupId 		= 	groupData._id;
															let tmpKfgItemId 	= 	groupData.kfg_item_id;

															/** Set group conditions */
															let groupConditions = {
																item_id 		: 	mainItemId,
																restaurant_id 	:	restaurantId,
															};

															if(groupData.kfg_combo_components_id && parseInt(groupData.kfg_combo_components_id)){
																groupConditions.kfg_combo_components_id = parseInt(groupData.kfg_combo_components_id);
															}else if(groupData.kfg_modifiers_groups_id){
																groupConditions.kfg_modifiers_groups_id = parseInt(groupData.kfg_modifiers_groups_id);
															}

															if(isDealItem && groupData.kfg_groups_class){
																groupConditions.kfg_groups_class = parseInt(groupData.kfg_groups_class);
															}

															if(tmpKfgItemId && vgroupItemIds && vgroupItemIds.length >0 ){
																vgroupItemIds.map(dealItemRecords=>{
																	if(dealItemRecords.item_id && dealItemRecords.item_id ==  tmpKfgItemId){
																		let unitMasterId = dealItemRecords.item_unit_id;

																		let dealUnitId = (itemUnitObj[unitMasterId]) ? itemUnitObj[unitMasterId] :"";

																		if(dealUnitId){
																			groupConditions.item_unit_id = unitMasterId;
																		}
																	}
																});
															}

															/** Get item choice detils */
															item_choices_groups.findOne(groupConditions,{projection: {_id: 1,}}).then(masterResult=>{

																if(masterResult){
																	let choiceId =  masterResult._id;
																	groupIds[tmpGroupId] = choiceId;

																	item_choices_groups.updateOne({_id: choiceId },{
																		$set: {
																			name   		: groupData.name,
																			order 	 	: groupData.order,
																			modified	: groupData.modified,
																			min_quantity: groupData.min_quantity,
																			max_quantity: groupData.max_quantity,
																		},
																		$unset: {to_be_deleted: true }
																	}).then(()=>{
																		groupEachCallback(null);
																	}).catch(next);
																}else{
																	/** Save item choice detils */
																	item_choices_groups.updateOne(groupConditions, {
																		$set:	{
																			name   		: groupData.name,
																			order 	 	: groupData.order,
																			modified	: groupData.modified,
																			min_quantity: groupData.min_quantity,
																			max_quantity: groupData.max_quantity,
																		},
																		$setOnInsert:	{
																			added_by		:	addedBy,
																			channel_id		:	Constants.CHANNEL_SOAP,
																			restaurant_slug :	restaurantSlug,
																			created   		:	Helper.getUtcDate(),
																			kfg		 		: 	true,
																		},
																		$unset: {
																			to_be_deleted: 1
																		}
																	},{upsert: true }).then(insertResult=>{
																		if(insertResult &&  insertResult.upsertedId && insertResult.upsertedId._id){
																			groupIds[tmpGroupId] = insertResult.upsertedId._id;
																		}
																		groupEachCallback(null);
																	}).catch(next);
																}
															}).catch(next);
														},(groupEachErr)=>{
															groupCallback(groupEachErr);
														});
													},
												},(asyncGroupErr)=>{
													if(asyncGroupErr) return  parellelSubCallback(asyncEachSubErr);

													eachOfSeries(cravezExItemList,(exData,exItemKey, eachSubCallback)=>{
														let tmpExItemId 	= 	exData._id;
														let kfgExItemId 	=	parseInt(exData.extra_item_id);
														let tmpKfgItemId 	= 	exData.kfg_item_id;

														/** Set conditions */
														let exMasterConditions = {
															item_id 		:	mainItemId,
															restaurant_id 	:	restaurantId,
															extra_item_id	:	kfgExItemId,
														};

														if(exData.kfg_combo_components_id){
															exMasterConditions.kfg_combo_components_id = exData.kfg_combo_components_id;
														}

														if(exData.item_unit_id){
															exMasterConditions.item_unit_id = exData.item_unit_id;
														}

														if(tmpKfgItemId && vgroupItemIds && vgroupItemIds.length >0 ){
															vgroupItemIds.map(dealItemRecords=>{
																if(dealItemRecords.item_id && dealItemRecords.item_id ==  tmpKfgItemId){
																	let unitMasterId = dealItemRecords.item_unit_id;

																	let dealUnitId = (itemUnitObj[unitMasterId]) ? itemUnitObj[unitMasterId] :"";

																	if(dealUnitId){
																		exMasterConditions.item_unit_id = unitMasterId;
																	}
																}
															});
														}

														item_extra_masters.findOne(exMasterConditions,{projection: {_id: 1,}}).then(masterResult=>{

															if(masterResult){
																exItemIds[tmpExItemId] = masterResult._id;

																item_extra_masters.updateOne({
																	_id:  masterResult._id
																},{
																	$set: {
																		name   				: 	exData.name,
																		modified 			:	exData.modified,
																		extra_fees			: 	exData.extra_fees,
																		kfg_sur_chg_usel 	:	exData.kfg_sur_chg_usel,
																		kfg_size_sur_chg 	: 	exData.kfg_size_sur_chg,
																		item_short_name		:	exData.item_short_name,
																	},
																	$unset: {to_be_deleted: true }
																}).then(()=>{
																	eachSubCallback(null);
																}).catch(next);
															}else{
																/** Save extra master details */
																item_extra_masters.updateOne(exMasterConditions,
																{
																	$set:	{
																		name   				: 	exData.name,
																		modified 			:	exData.modified,
																		extra_fees			: 	exData.extra_fees,
																		kfg_sur_chg_usel 	:	exData.kfg_sur_chg_usel,
																		kfg_size_sur_chg 	: 	exData.kfg_size_sur_chg,
																		item_short_name		:	exData.item_short_name,
																	},
																	$setOnInsert:	{
																		is_active		:	Constants.ACTIVE,
																		channel_id		:	Constants.CHANNEL_SOAP,
																		added_by		:	addedBy,
																		restaurant_slug :	restaurantSlug,
																		kfg_main_item_id: String(tmpKfgItemId),
																		created   		:	Helper.getUtcDate(),
																		kfg		 		: 	true,
																	},
																	$unset: {
																		to_be_deleted: 1
																	}
																},{upsert: true }).then(insertResult=>{
																	if(insertResult &&  insertResult.upsertedId && insertResult.upsertedId._id){
																		exItemIds[tmpExItemId] = insertResult.upsertedId._id;
																	}
																	eachSubCallback(null);
																}).catch(next);
															}
														}).catch(next);
													},(asyncEachSubErr)=>{
														if(asyncEachSubErr) return  parellelSubCallback(asyncEachSubErr);

														eachOfSeries(cravezGroupExtraList,(groupExData, groupExKey, eachExtraCallback)=>{
															let tmpGroupId 		= 	groupExData.group_id;
															let tmpItemExtraId 	= 	groupExData.item_extra_id;
															let tmpKfgItemId 	= 	groupExData.kfg_item_id;
															let groupId 		=	"";
															let itemExtraId		=	"";

															if(groupIds[tmpGroupId])  groupId = groupIds[tmpGroupId];
															if(exItemIds[tmpItemExtraId]) itemExtraId = exItemIds[tmpItemExtraId];

															if(!groupId || !itemExtraId){
																console.log("Group id or extra item not found ",JSON.stringify(groupExData),"\n");
																console.log("Groupids ",JSON.stringify(groupIds),"\n");
																console.log("extraid ",JSON.stringify(exItemIds),"\n");
																return eachExtraCallback(null);
															}

															/** Set conditions  */
															let groupExConditions = {
																item_id 		: 	mainItemId,
																group_id 		: 	groupId,
																item_extra_id	:	itemExtraId,
																restaurant_id 	:	restaurantId,
															};

															if(groupExData.unit_id){
																groupExConditions.unit_id = groupExData.unit_id;
															}

															/** Set on insert data */
															let groupExInsertData = {
																channel_id		:	Constants.CHANNEL_SOAP,
																added_by		:	addedBy,
																restaurant_slug :	restaurantSlug,
																created   		:	Helper.getUtcDate(),
																kfg		 		: 	true,
															};

															if(groupExData.kfg_combo_components_id && parseInt(groupExData.kfg_combo_components_id)){
																groupExInsertData.kfg_combo_components_id = groupExData.kfg_combo_components_id;
															};

															if(groupExData.kfg_upsell_id){
																groupExInsertData.kfg_upsell_id = groupExData.kfg_upsell_id;
															};

															if(tmpKfgItemId && vgroupItemIds && vgroupItemIds.length >0){
																vgroupItemIds.map(dealItemRecords=>{
																	if(dealItemRecords.item_id && dealItemRecords.item_id ==  tmpKfgItemId){
																		let unitMasterId = dealItemRecords.item_unit_id;
																		let selectorMasterId = dealItemRecords.selector_item_unit_id;
																		let doughMasterId = dealItemRecords.dough_item_unit_id;

																		let dealUnitId = (itemUnitObj[unitMasterId]) ? itemUnitObj[unitMasterId] :"";

																		let dealSelectorUnitId = (itemUnitObj[selectorMasterId]) ? itemUnitObj[selectorMasterId] :"";

																		let dealDoughUnitId = (itemUnitObj[doughMasterId]) ? itemUnitObj[doughMasterId] :"";

																		if(dealUnitId){
																			groupExConditions.unit_id = unitMasterId;

																			groupExInsertData.size_id = dealUnitId;
																		}

																		if(itemType == Constants.HALF_AND_HALF_ITEM || itemType == Constants.PIZZA_VGROUP){
																			if(dealDoughUnitId){
																				groupExConditions.dough_type_id = dealDoughUnitId;

																				groupExInsertData.dough_master_unit_id = doughMasterId;
																			}

																			if(dealSelectorUnitId && itemType == Constants.HALF_AND_HALF_ITEM){
																				groupExConditions.selector_id = dealSelectorUnitId;

																				groupExInsertData.selector_master_unit_id = selectorMasterId;
																			}
																		}

																	}
																});
															}

															/** Save item group details */
															item_group_extras.updateOne(groupExConditions,
															{
																$set	:	{
																	extra_fees	:	groupExData.extra_fees,
																	modified 	:	Helper.getUtcDate(),
																},
																$setOnInsert	:	groupExInsertData,
																$unset: {
																	to_be_deleted: 1
																}
															},{upsert: true }).then(()=>{
																eachExtraCallback(null);
															}).catch(next);
														},(groupExEachSubErr)=>{
															parellelSubCallback(groupExEachSubErr);
														});
													});
												});
											},
											save_deal_groups : (subParellelCallback)=>{
												if(!isDealItem || !dealGroupExtraList || dealGroupExtraList.length <=0){
													return subParellelCallback(null);
												}

												eachOfSeries(dealGroupExtraList,(groupExData, groupExKey, eachExtraCallback)=>{
													let tmpGroupId 		= 	groupExData.group_id;
													let tmpItemExtraId 	= 	groupExData.item_extra_id;
													let tmpKfgItemId 	= 	groupExData.kfg_item_id;
													let groupId 		=	"";
													let itemExtraId		=	"";

													if(dealGroupIds[tmpGroupId])  groupId = dealGroupIds[tmpGroupId];
													if(dealExItemIds[tmpItemExtraId]) itemExtraId = dealExItemIds[tmpItemExtraId];

													if(!groupId || !itemExtraId){
														console.log("Group id or extra item not found ",JSON.stringify(groupExData),"\n");
														console.log("Groupids ",JSON.stringify(dealGroupIds),"\n");
														console.log("extraid ",JSON.stringify(dealExItemIds),"\n");
														return eachExtraCallback(null);
													}

													/** Set conditions  */
													let groupExConditions = {
														item_id 		: 	mainItemId,
														group_id 		: 	groupId,
														item_extra_id	:	itemExtraId,
														restaurant_id 	:	restaurantId,
													};

													/** Set on insert data */
													let groupExInsertData = {
														channel_id		:	Constants.CHANNEL_SOAP,
														added_by		:	addedBy,
														restaurant_slug :	restaurantSlug,
														created   		:	Helper.getUtcDate(),
														kfg		 		: 	true,
													};

													if(tmpKfgItemId && dealVgroupIds){
														dealVgroupIds.map(dealItemRecords=>{
															if(dealItemRecords.item_id && dealItemRecords.item_id ==  tmpKfgItemId){
																let unitMasterId = dealItemRecords.item_unit_id;
																let selectorMasterId = dealItemRecords.selector_item_unit_id;
																let doughMasterId = dealItemRecords.dough_item_unit_id;

																let dealUnitId = (itemUnitObj[unitMasterId]) ? itemUnitObj[unitMasterId] :"";

																let dealSelectorUnitId = (itemUnitObj[selectorMasterId]) ? itemUnitObj[selectorMasterId] :"";

																let dealDoughUnitId = (itemUnitObj[doughMasterId]) ? itemUnitObj[doughMasterId] :"";

																if(dealUnitId){
																	groupExConditions.unit_id = unitMasterId;

																	groupExInsertData.size_id = dealUnitId;
																}

																if(dealSelectorUnitId){
																	groupExConditions.selector_id = dealSelectorUnitId;

																	groupExInsertData.selector_master_unit_id = selectorMasterId;
																}

																if(dealDoughUnitId){
																	groupExConditions.dough_type_id = dealDoughUnitId;

																	groupExInsertData.dough_master_unit_id = doughMasterId;
																}
															}
														});
													}

													/** Save item group details */
													item_group_extras.updateOne(groupExConditions,
													{
														$set	:	{
															extra_fees	:	groupExData.extra_fees,
															modified 	:	Helper.getUtcDate(),
														},
														$setOnInsert	:	groupExInsertData,
														$unset: {
															to_be_deleted: 1
														}
													},{upsert: true }).then(()=>{
														eachExtraCallback(null);
													}).catch(next);
												},(groupExEachSubErr)=>{
													subParellelCallback(groupExEachSubErr);
												});
											},
										},(subParallelErr)=>{
											eachCallback(subParallelErr);
										});
									});
								}else{
									eachCallback(null);
								}
							}).catch(next);
						});
					},(asyncEachErr)=>{
						if(asyncEachErr){
							console.error("Second each error in updateCravezItems");
							return console.error(asyncEachErr);
						}else{
							asyncParallel({
								mark_delete_not_coming_from_tmp_table: (parentSubCallback)=>{
									if(!isAllItemUpdate) return parentSubCallback(null);

									items.find({
										restaurant_slug : {$in: [Constants.PIZZA_HUT, Constants.BURGER_KING]},
										$or : [
											{is_combo: {$nin : ["1",1,true]}},
											{restaurant_slug: Constants.PIZZA_HUT }
										],
										to_be_deleted: true
									},{projection:{_id:1}}).toArray().then(result=>{
										if(result.length == 0) return parentSubCallback(null);

										asyncEach(result,(records,eachCallback)=>{
											let mainItemId = records._id;

											asyncParallel({
												delete_item : (parellelSubCallback)=>{
													items.deleteOne({_id: mainItemId}).then(()=>{
														parellelSubCallback(null);
													}).catch(next);
												},
												delete_linkings : (parellelSubCallback)=>{
													item_linkings.deleteMany({item_id: mainItemId}).then(()=>{
														parellelSubCallback(null);
													}).catch(next);
												},
												delete_units : (parellelSubCallback)=>{
													item_units.deleteMany({item_id: mainItemId}).then(()=>{
														parellelSubCallback(null);
													}).catch(next);
												},
												delete_dough : (parellelSubCallback)=>{
													item_dough_units.deleteMany({item_id: mainItemId}).then(()=>{
														parellelSubCallback(null);
													}).catch(next);
												},
												selector_dough : (parellelSubCallback)=>{
													item_selector_units.deleteMany({item_id: mainItemId}).then(()=>{
														parellelSubCallback(null);
													}).catch(next);
												},
												group_delete : (parellelSubCallback)=>{
													item_choices_groups.deleteMany({item_id: mainItemId}).then(()=>{
														parellelSubCallback(null);
													}).catch(next);
												},
												group_item_delete : (parellelSubCallback)=>{
													item_extra_masters.deleteMany({item_id: mainItemId}).then(()=>{
														parellelSubCallback(null);
													}).catch(next);
												},
												group_item_extra : (parellelSubCallback)=>{
													item_group_extras.deleteMany({item_id: mainItemId}).then(()=>{
														parellelSubCallback(null);
													}).catch(next);
												},
											},(parallelErr)=>{
												eachCallback(parallelErr);
											});
										},(asyncSubEachErr)=>{
											parentSubCallback(asyncSubEachErr);
										});
									}).catch(next);
								},
								update_item_coming_from_tmp_table: (parentSubCallback)=>{
									asyncEach(activeItemList,(records,eachCallback)=>{
										let itemId 			= 	records.item_id;
										let isActive 		=	records.is_active;
										let mainItemId 		= 	records.main_item_id;
										let cravezItemIds 	=	records.cravez_item_ids;

										asyncParallel({
											update_craver_item : (parellelSubCallback)=>{
												cravez_items.updateMany({
													_id: {$in : cravezItemIds}
												},
												{$set: {
													is_updated: false
												}}).then(()=>{
													parellelSubCallback(null);
												}).catch(next);
											},
											update_item : (parellelSubCallback)=>{
												items.updateOne({
													_id : mainItemId
												},
												{$set: {
													is_active	: isActive,
													modified 	: Helper.getUtcDate(),
												}}).then(()=>{
													parellelSubCallback(null);
												}).catch(next);
											},
											delete_linkings : (parellelSubCallback)=>{
												item_linkings.deleteMany({
													item_id 		: mainItemId,
													to_be_deleted 	: true,
												}).then(()=>{
													parellelSubCallback(null);
												}).catch(next);
											},
											delete_units : (parellelSubCallback)=>{
												item_units.deleteMany({
													item_id 		: mainItemId,
													to_be_deleted 	: true,
												}).then(()=>{
													parellelSubCallback(null);
												}).catch(next);
											},
											delete_dough : (parellelSubCallback)=>{
												item_dough_units.deleteMany({
													item_id 		: mainItemId,
													to_be_deleted 	: true,
												}).then(()=>{
													parellelSubCallback(null);
												}).catch(next);
											},
											selector_dough : (parellelSubCallback)=>{
												item_selector_units.deleteMany({
													item_id 		: mainItemId,
													to_be_deleted 	: true,
												}).then(()=>{
													parellelSubCallback(null);
												}).catch(next);
											},
											group_delete : (parellelSubCallback)=>{
												item_choices_groups.deleteMany({
													item_id 		: mainItemId,
													to_be_deleted 	: true,
												}).then(()=>{
													parellelSubCallback(null);
												}).catch(next);
											},
											group_item_delete : (parellelSubCallback)=>{
												item_extra_masters.deleteMany({
													item_id 		: mainItemId,
													to_be_deleted 	: true,
												}).then(()=>{
													parellelSubCallback(null);
												}).catch(next);
											},
											group_item_extra : (parellelSubCallback)=>{
												item_group_extras.deleteMany({
													item_id 		: mainItemId,
													to_be_deleted 	: true,
												}).then(()=>{
													parellelSubCallback(null);
												}).catch(next);
											},
											update_unit_price : (parellelSubCallback)=>{
												parellelSubCallback(null);

												/** Update item unit price **/
												this.updateItemUnitPrice(req, res,next,{item_id: mainItemId}).then(()=>{});
											},
										},(parallelErr)=>{
											eachCallback(parallelErr);
										});
									},(asyncSubEachErr)=>{
										parentSubCallback(asyncSubEachErr);
									});
								},
							},(parentErr)=>{
								if(parentErr){
									console.error("Last each error in updateCravezItems");
									return console.error(parentErr);
								}else{
									console.error("Done updateCravezItems");
								}
							});
						}
					});
				});
			}
		});
	}; // End updateCravezItems

	/**
	 * Function to update cravez combo items
	 *
	 * @param req 	As	 Request Data
	 * @param res 	As	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render null
	 */
	async updateCravezComboItems (req, res,next){
		res.render('blank',{layout:false});

		let itemId		    = 	(req.params.item_id) ?	String(req.params.item_id) :"";
		let todayStartDate 	=	Helper.newDate('',Constants.DATABASE_DATE_FORMAT);
		todayStartDate		=	Helper.newDate(todayStartDate+" "+Constants.START_DATE_TIME_FORMAT);
		let isAllItemUpdate	=	true;

		console.log("Start updateCravezComboItems ");

		let listConditions = {
			// is_updated 		: 	true,
			restaurant_slug :	Constants.BURGER_KING,
			is_combo 		: 	{$in : ["1",1]},
			//non_sellable	: 	{$ne : NON_SELLABLE},
			// modified 		:	{$gte: todayStartDate},
		};

		if(itemId){
			isAllItemUpdate = 	false;
			listConditions	=	{item_id : String(itemId)};
		}

		const items	 				=	this.db.collection(Tables.ITEMS);
		const cravez_items			=	this.db.collection(Tables.CRAVEZ_ITEMS);
		const item_units_masters	=	this.db.collection(Tables.ITEM_UNITS_MASTERS);
		asyncParallel({
			item_list : (parentCallback)=>{

				cravez_items.aggregate([
					{$match: listConditions},
					{$lookup:	{
						from     : Tables.ITEMS,
						let      : {restaurantId : "$restaurant_id", itemId : "$item_id"},
						pipeline : [
							{$match : {
								$expr: {
									$and : [
										{$eq: ["$restaurant_id", "$$restaurantId"]},
										{$eq: ["$item_id", "$$itemId"]},
									],
								}
							}},
							{$project : {_id: 1 }},
						],
						as	:	"item_details"
					}},
					{$addFields:{
						main_item_id :	{$arrayElemAt:["$item_details._id",0]},
					}},
					{$lookup:	{
						from 			: 	Tables.CRAVEZ_ITEM_UNITS,
						localField	 	:	"item_id",
						foreignField 	: 	"kfg_item_id",
						as	 			: 	"unit_list"
					}},
					{$lookup:	{
						from 			: 	Tables.CRAVEZ_ITEM_EXTRA_MASTERS,
						localField	 	:	"item_id",
						foreignField 	: 	"kfg_item_id",
						as	 			: 	"ex_item_list"
					}},
					{$lookup:	{
						from 			: 	Tables.CRAVEZ_ITEM_GROUP_EXTRAS,
						localField	 	:	"item_id",
						foreignField 	: 	"kfg_item_id",
						as	 			: 	"group_extra_list"
					}},
					{$lookup:	{
						from     : Tables.CRAVEZ_CHOICES_GROUPS,
						let      : {restaurantId : "$restaurant_id", itemId : "$item_id"},
						pipeline : [
							{$match : {
								$expr: {
									$and : [
										{$eq: ["$restaurant_id", "$$restaurantId"]},
										{$eq: ["$kfg_item_id", "$$itemId"]},
									],
								},
							}},
						],
						as	:	"group_list"
					}},
					{$project : {vgroup_details: 0, item_details:0}}
				]).toArray().then(result=>{
					parentCallback(null,result);
				}).catch(next);
			},
			update_delete_flag : (parentCallback)=>{
				if(!isAllItemUpdate) return parentCallback(null);

				items.updateMany({
					restaurant_slug :	Constants.BURGER_KING,
					is_combo 		: 	true,
				},{$set: {to_be_deleted: true }}).then(()=>{
					parentCallback(null);
				}).catch(next);
			},
		},(parentErr,parentResponse)=>{
			if(parentErr){
				console.error("Parent parallel error in updateCravezItems");
				console.error(parentErr);
				return  res.send({error : parentErr });
			}

			// return res.send({parentResponse : parentResponse})

			let cravezItemList 	=  parentResponse.item_list;
			if(cravezItemList && cravezItemList.length >0){
				const item_units	 		=	this.db.collection(Tables.ITEM_UNITS);
				const item_linkings	 		=	this.db.collection(Tables.ITEM_LINKINGS);
				const item_availability	 	=	this.db.collection(Tables.ITEM_AVAILABILITY);
				const item_choices_groups	=	this.db.collection(Tables.ITEM_CHOICES_GROUPS);
				const item_group_extras		=	this.db.collection(Tables.ITEM_GROUP_EXTRAS);
				const item_extra_masters	=	this.db.collection(Tables.ITEM_EXTRA_MASTERS);
				const restaurant_branches 	=	this.db.collection(Tables.RESTAURANT_BRANCHES);
				const restaurant_categories =	this.db.collection(Tables.RESTAURANT_CATEGORIES);

				console.log("total items "+cravezItemList.length);

				let activeItemList = [];
				eachOfSeries(cravezItemList,(records,firstKey,parentEachCallback)=>{
					let addedBy 		= 	records.added_by;
					let itemId 			= 	records.item_id;
					let mainItemId 		=	records.main_item_id;
					let restaurantId 	=	records.restaurant_id;
					let restaurantSlug 	=	records.restaurant_slug;
					let unitList 		=	records.unit_list;
					let exItemList 		=	records.ex_item_list;
					let groupExtraList 	=	records.group_extra_list;
					let groupList 		=	records.group_list;
					let branchIds 		=	records.branch_ids;
					let submenuIds 		=	records.submenu_ids;
					let modifiedDate 	=	(records.modified)? Helper.getUtcDate(records.modified):Helper.getUtcDate();
					let createdDate 	=	(records.created) ? Helper.getUtcDate(records.created) :Helper.getUtcDate();

					console.log("item id "+itemId+" index -"+firstKey);

					asyncParallel({
						branch_list : (parellelCallback)=>{
							if(branchIds == 0) return parellelCallback(null,[]);

							let tempStoreId	=	(branchIds) ? branchIds.split(',') :[];
							if(tempStoreId.length >0){
								let tmpBraIds = [];
								tempStoreId.map(tmpId=>{
									tmpBraIds.push(String(tmpId), parseInt(tmpId));
								});
								tempStoreId = tmpBraIds;
							}

							/** Get branch list */
							restaurant_branches.distinct("_id",{restaurant_id: restaurantId, kfg_store_id: {$in: tempStoreId}}).then(branchResult=>{
								parellelCallback(null,branchResult);
							}).catch(next);
						},
						category_list : (parellelCallback)=>{
							if(!submenuIds) return  parellelCallback(null,[]);

							submenuIds	=	submenuIds.split(',');

							submenuIds = submenuIds.map(key =>{ return (key) ? parseInt(key) : 0});

							let catConditions = {
								restaurant_id 	: 	restaurantId,
								kfg_sub_menu_id :  {$in : submenuIds},
							};

							/** Get category details list */
							restaurant_categories.distinct("_id",catConditions).then(categoryResult=>{
								parellelCallback(null,categoryResult);
							}).catch(next);
						},
						item_mark_delete : (parellelCallback)=>{
							if(!mainItemId) return parellelCallback(null);

							asyncParallel({
								item_link_delete : (subCallback)=>{
									item_linkings.updateMany({
										item_id : mainItemId
									},
									{$set: {
										to_be_deleted	: 	true,
										modified 		:	Helper.getUtcDate(),
									}}).then(()=>{
										subCallback(null);
									}).catch(next);
								},
								item_availability_delete : (subCallback)=>{
									item_availability.deleteMany({item_id: mainItemId }).then(()=>{
										subCallback(null);
									}).catch(next);
								},
								units_delete : (subCallback)=>{
									item_units.updateMany({
										item_id : mainItemId
									},
									{$set: {
										to_be_deleted	: true,
										modified 		: Helper.getUtcDate(),
									}}).then(()=>{
										subCallback(null);
									}).catch(next);
								},
								group_delete : (subCallback)=>{
									item_choices_groups.updateMany({
										item_id : mainItemId,
									},
									{$set: {
										to_be_deleted	: true,
										modified 		: Helper.getUtcDate(),
									}}).then(()=>{
										subCallback(null);
									}).catch(next);
								},
								group_item_delete : (subCallback)=>{
									item_extra_masters.updateMany({
										item_id : mainItemId,
									},
									{$set: {
										to_be_deleted	: true,
										modified 		: Helper.getUtcDate(),
									}}).then(()=>{
										subCallback(null);
									}).catch(next);
								},
								group_item_extra : (subCallback)=>{
									item_group_extras.updateMany({
										item_id : mainItemId,
									},
									{$set: {
										to_be_deleted	: true,
										modified 		: Helper.getUtcDate(),
									}}).then(()=>{
										subCallback(null);
									}).catch(next);
								},
							},(parallelErr)=>{
								parellelCallback(parallelErr);
							});
						},
					},(parallelErr, parallelResponse)=>{
						if(parallelErr) return parentEachCallback(parallelErr);

						let branchList 		= 	parallelResponse.branch_list;
						let categoryList 	= 	parallelResponse.category_list;

						let updateAbleData = {
							name 				: 	records.name,
							description 		:	records.description,
							menu_ids			:	[],
							category_ids		:	categoryList,
							is_combo			:	true,
							item_type			:	Constants.COMBO_ITEM,
							order				:	records.order,
							channel_id			:	records.channel_id,
							item_price			:	records.item_price,
							kfg_category_id		:	records.category_id,
							kfg_sub_category_id	:	submenuIds,
							price_on_selection	:	0,
							is_active			:	Constants.DEACTIVE,
							modified			:  	modifiedDate,
						};

						if(records.combo_upsell_item_ids) updateAbleData.combo_upsell_item_ids = records.combo_upsell_item_ids;
						if(records.first_component_details) updateAbleData.first_component_details = records.first_component_details;

						/** Set item conditions */
						let itemConditions =  {
							item_id			: 	itemId,
							restaurant_id	: 	restaurantId
						};

						if(mainItemId){
							itemConditions = {_id: mainItemId};
						}

						items.updateOne(itemConditions,
						{
							$set 		: 	updateAbleData,
							$setOnInsert:	{
								kfg		  		:	true,
								item_id			:	itemId,
								restaurant_id	:	restaurantId,
								restaurant_slug	:	restaurantSlug,
								added_by   		:	addedBy,
								created  		:	createdDate
							},
							$unset:	{
								to_be_deleted	:	1,
							}
						},{upsert: true}).then(itemResult => {

							if(itemResult && itemResult.upsertedId && itemResult.upsertedId._id){
								mainItemId = itemResult.upsertedId._id;
							}

							if(!mainItemId) return parentEachCallback(null);

							activeItemList.push({
								item_id 	: 	itemId,
								main_item_id: 	mainItemId,
								is_active	:	records.is_active
							});

							asyncParallel({
								availability_details : (parellelSubCallback)=>{
									let fromTime	=	parseFloat(records.start_time.substr(0,5).replace(":","."));
									let toTime		=	parseFloat(records.end_time.substr(0,5).replace(":","."));

									if(records.start_time =="00:00:00" && records.end_time == "00:00:00"){
										fromTime=	parseFloat(Constants.DAY_INITIAL_START_TIME.replace(':','.'));
										toTime	=	parseFloat(Constants.DAY_INITIAL_END_TIME.replace(':','.'));
									}

									/** save availability details */
									item_availability.insertOne({
										item_id  	: 	mainItemId,
										from_time	:	fromTime,
										to_time		:	toTime,
										kfg		  	:	true,
										channel_id	:	records.channel_id,
										modified    : 	modifiedDate,
										created 	: 	createdDate,
										restaurant_id	:	restaurantId,
										restaurant_slug	:	restaurantSlug,
									}).then(()=>{
										parellelSubCallback(null);
									}).catch(next);
								},
								linkings_details : (parellelSubCallback)=>{
									item_linkings.updateOne({
										item_id	: mainItemId,
									},
									{
										$set : {
											menu_ids			: [],
											branch_ids			: branchList,
											category_ids		: categoryList,
											kfg_store_id		: branchIds,
											kfg		  			: true,
											type				: Constants.ITEM_LISTED_TO_SELECTED_BRANCH_LIST,
											restaurant_id		: restaurantId,
											restaurant_slug		: restaurantSlug,
											channel_id			: records.channel_id,
											customize_attributes: {
												name 				: updateAbleData.name,
												price_on_selection	: updateAbleData.price_on_selection
											},
										},
										$setOnInsert : {
											created: createdDate
										},
										$unset :{
											to_be_deleted : 1
										}
									},{upsert :true}).then(()=>{
										parellelSubCallback(null);
									}).catch(next);
								},
								save_units : (parellelSubCallback)=>{
									eachOfSeries(unitList,(unitData,secondKey, unitEachCallback)=>{
										let itemUnitId 		=	unitData.item_unit_id;
										let unitPrice 		=	unitData.price;
										let unitSorting 	=	unitData.sorting;
										let unitStatus 		=	unitData.status;
										let isAutoSelected	=	unitData.is_auto_selected;

										/** Set update data */
										let unitUpdateData ={
											$set:	{
												price 	: unitPrice,
												sorting : unitSorting,
												status 	: unitStatus,
											},
											$setOnInsert:	{
												added_by		:	addedBy,
												channel_id		:	Constants.CHANNEL_SOAP,
												restaurant_slug :	restaurantSlug,
												created   		:	Helper.getUtcDate(),
												kfg		 		: 	true,
											},
											$unset: {
												to_be_deleted: 1
											}
										}

										if(isAutoSelected){
											unitUpdateData["$set"].is_auto_selected = isAutoSelected;
										}

										/** Save units details */
										item_units.updateOne({
											item_id 		: 	mainItemId,
											restaurant_id 	:	restaurantId,
											item_unit_id 	: 	itemUnitId,
										},unitUpdateData,{upsert: true }).then(insertResult=>{
											unitEachCallback(null,insertResult);
										}).catch(next);
									},(parentEachErr)=>{
										parellelSubCallback(parentEachErr);
									});
								},
								save_exitems : (parellelSubCallback)=>{
									if(!groupList || groupList.length <=0){
										return parellelSubCallback(null);
									}

									let groupIds 	=	{};
									let exItemIds	= 	{};
									asyncParallel({
										group_id : (groupCallback)=>{
											eachOfSeries(groupList,(groupData,thirdkey,groupEachCallback)=>{
												let tmpGroupId 		= 	groupData._id;

												/** Set group conditions */
												let groupConditions = {
													item_id 		: 	mainItemId,
													restaurant_id 	:	restaurantId,
												};

												if(groupData.kfg_combo_components_id && parseInt(groupData.kfg_combo_components_id)){
													groupConditions.kfg_combo_components_id = parseInt(groupData.kfg_combo_components_id);
												}else{
													groupConditions.kfg_modifiers_groups_id = parseInt(groupData.kfg_modifiers_groups_id);
												}

												/** Get item choice detils */
												item_choices_groups.findOne(groupConditions,{projection: {_id: 1,}}).then(masterResult=>{

													if(masterResult){
														let choiceId =  masterResult._id;
														groupIds[tmpGroupId] = choiceId;

														item_choices_groups.updateOne({_id: choiceId },{
															$set: {order : groupData.order },
															$unset: {to_be_deleted: true }
														}).then(()=>{
															groupEachCallback(null);
														}).catch(next);
													}else{
														/** Save item choice detils */
														item_choices_groups.updateOne(groupConditions,
														{
															$set:	{
																name   		: groupData.name,
																order 	 	: groupData.order,
																modified	: groupData.modified,
																min_quantity: groupData.min_quantity,
																max_quantity: groupData.max_quantity,
															},
															$setOnInsert:	{
																added_by		:	addedBy,
																channel_id		:	Constants.CHANNEL_SOAP,
																restaurant_slug :	restaurantSlug,
																created   		:	Helper.getUtcDate(),
																kfg		 		: 	true,
															},
															$unset: {
																to_be_deleted: 1
															}
														},{upsert: true }).then(insertResult=>{
															if(insertResult &&  insertResult.upsertedId && insertResult.upsertedId._id){
																groupIds[tmpGroupId] = insertResult.upsertedId._id;
															}
															groupEachCallback(null);
														}).catch(next);
													}
												}).catch(next);
											},(groupEachErr)=>{
												groupCallback(groupEachErr);
											});
										},
									},(asyncGroupErr)=>{
										if(asyncGroupErr) return  parellelSubCallback(asyncEachSubErr);

										eachOfSeries(exItemList,(exData,fourthKey, eachSubCallback)=>{
											let tmpExItemId 	= 	exData._id;
											let kfgExItemId 	=	parseInt(exData.extra_item_id);

											/** Set conditions */
											let exMasterConditions = {
												item_id 		:	mainItemId,
												restaurant_id 	:	restaurantId,
												extra_item_id	:	kfgExItemId,
											};

											if(exData.kfg_combo_components_id){
												exMasterConditions.kfg_combo_components_id = exData.kfg_combo_components_id;
											}

											if(exData.item_unit_id){
												exMasterConditions.item_unit_id = exData.item_unit_id;
											}

											item_extra_masters.findOne(exMasterConditions,{projection: {_id: 1,}}).then(masterResult=>{

												let exUpdateData = {
													$set:	{
														name   			: 	exData.name,
														modified 		:	exData.modified,
														extra_fees		: 	exData.extra_fees,
														kfg_sur_chg_usel:	exData.kfg_sur_chg_usel,
														kfg_size_sur_chg: 	exData.kfg_size_sur_chg,
														item_short_name	:	exData.item_short_name,
														is_active		:	exData.is_active,
													},
													$setOnInsert:	{
														channel_id		:	Constants.CHANNEL_SOAP,
														added_by		:	addedBy,
														restaurant_slug :	restaurantSlug,
														created   		:	Helper.getUtcDate(),
														kfg		 		: 	true,
													},
													$unset: {
														to_be_deleted: 1
													}
												};

												if(exData.is_first_component){
													exUpdateData["$set"].is_first_component = exData.is_first_component;
												}else{
													exUpdateData["$unset"].is_first_component = 1;
												}

												if(exData.is_auto_selected){
													exUpdateData["$set"].is_auto_selected = exData.is_auto_selected;
												}else{
													exUpdateData["$unset"].is_auto_selected = 1;
												}

												if(masterResult){
													exItemIds[tmpExItemId] = masterResult._id;

													item_extra_masters.updateOne({_id:  masterResult._id },exUpdateData).then(()=>{
														eachSubCallback(null);
													}).catch(next);
												}else{
													/** Save extra master details */
													item_extra_masters.updateOne(exMasterConditions,exUpdateData,{upsert: true}).then(insertResult=>{
														if(insertResult &&  insertResult.upsertedId && insertResult.upsertedId._id){
															exItemIds[tmpExItemId] = insertResult.upsertedId._id;
														}
														eachSubCallback(null);
													}).catch(next);
												}
											}).catch(next);
										},(asyncEachSubErr)=>{
											if(asyncEachSubErr) return  parellelSubCallback(asyncEachSubErr);

											eachOfSeries(groupExtraList,(groupExData, fivethKey, eachExtraCallback)=>{
												let tmpGroupId 		= 	groupExData.group_id;
												let tmpItemExtraId 	= 	groupExData.item_extra_id;
												let groupId 		=	"";
												let itemExtraId		=	"";

												if(groupIds[tmpGroupId])  groupId = groupIds[tmpGroupId];
												if(exItemIds[tmpItemExtraId]) itemExtraId = exItemIds[tmpItemExtraId];

												if(!groupId || !itemExtraId){
													console.log("Group id or extra item not found ",JSON.stringify(groupExData),"\n");
													console.log("Groupids ",JSON.stringify(groupIds),"\n");
													console.log("extraid ",JSON.stringify(exItemIds),"\n");
													return eachExtraCallback(null);
												}

												/** Set conditions  */
												let groupExConditions = {
													item_id 		: 	mainItemId,
													group_id 		: 	groupId,
													item_extra_id	:	itemExtraId,
													restaurant_id 	:	restaurantId,
												};

												if(groupExData.unit_id){
													groupExConditions.unit_id = groupExData.unit_id;
												}

												/** Set on update data */
												let groupExUpdateData = {
													$set	:	{
														extra_fees	:	groupExData.extra_fees,
														modified 	:	Helper.getUtcDate(),
													},
													$setOnInsert	:	{
														channel_id		:	Constants.CHANNEL_SOAP,
														added_by		:	addedBy,
														restaurant_slug :	restaurantSlug,
														created   		:	Helper.getUtcDate(),
														kfg		 		: 	true,
													},
													$unset: {
														to_be_deleted: 1
													}
												};

												if(groupExData.kfg_combo_components_id && parseInt(groupExData.kfg_combo_components_id)){
													groupExUpdateData["$setOnInsert"].kfg_combo_components_id = groupExData.kfg_combo_components_id;
												};

												if(groupExData.is_first_component){
													groupExUpdateData["$set"].is_first_component = groupExData.is_first_component;
												}else{
													groupExUpdateData["$unset"].is_first_component = 1;
												}

												if(groupExData.kfg_upsell_id){
													groupExUpdateData["$setOnInsert"].kfg_upsell_id = groupExData.kfg_upsell_id;
												};

												if(groupExData.is_auto_selected){
													groupExUpdateData["$set"].is_auto_selected = groupExData.is_auto_selected;
												}else{
													groupExUpdateData["$unset"].is_auto_selected = 1;
												}

												/** Save item group details */
												item_group_extras.updateOne(groupExConditions,groupExUpdateData,{upsert: true }).then(()=>{
													eachExtraCallback(null);
												}).catch(next);
											},(groupExEachSubErr)=>{
												parellelSubCallback(groupExEachSubErr);
											});
										});
									});
								},
							},(parallelErr)=>{
								parentEachCallback(parallelErr);
							});
						}).catch(next);
					});
				},(parentEachErr)=>{
					if(parentEachErr){
						console.error("First each error in updateCravezComboItems");
						return console.error(parentEachErr);
					}else{
						asyncParallel({
							mark_delete_not_coming_from_tmp_table: (parentSubCallback)=>{
								if(!isAllItemUpdate) return parentSubCallback(null);

								items.find({
									restaurant_slug :	Constants.BURGER_KING,
									is_combo 		: 	true,
									to_be_deleted: true
								},{projection:{_id:1}}).toArray().then(result=>{
									if(result.length == 0) return parentSubCallback(null);

									asyncEach(result,(records,eachCallback)=>{
										let mainItemId = records._id;

										asyncParallel({
											delete_item : (parellelSubCallback)=>{
												items.deleteOne({_id: mainItemId}).then(()=>{
													parellelSubCallback(null);
												}).catch(next);
											},
											delete_linkings : (parellelSubCallback)=>{
												item_linkings.deleteMany({item_id: mainItemId}).then(()=>{
													parellelSubCallback(null);
												}).catch(next);
											},
											delete_units : (parellelSubCallback)=>{
												item_units.deleteMany({item_id: mainItemId}).then(()=>{
													parellelSubCallback(null);
												}).catch(next);
											},
											group_delete : (parellelSubCallback)=>{
												item_choices_groups.deleteMany({item_id: mainItemId}).then(()=>{
													parellelSubCallback(null);
												}).catch(next);
											},
											group_item_delete : (parellelSubCallback)=>{
												item_extra_masters.deleteMany({item_id: mainItemId}).then(()=>{
													parellelSubCallback(null);
												}).catch(next);
											},
											group_item_extra : (parellelSubCallback)=>{
												item_group_extras.deleteMany({item_id: mainItemId}).then(()=>{
													parellelSubCallback(null);
												}).catch(next);
											},
										},(parallelErr)=>{
											eachCallback(parallelErr);
										});
									},(asyncSubEachErr)=>{
										parentSubCallback(asyncSubEachErr);
									});
								}).catch(next);
							},
							update_item_coming_from_tmp_table: (parentSubCallback)=>{
								asyncEach(activeItemList,(records,eachCallback)=>{
									let itemId 		= 	records.item_id;
									let isActive 	=	records.is_active;
									let mainItemId 	= 	records.main_item_id;

									asyncParallel({
										update_craver_item : (parellelSubCallback)=>{
											cravez_items.updateOne({
												item_id: itemId
											},
											{$set: {
												is_updated: false
											}}).then(()=>{
												parellelSubCallback(null);
											}).catch(next);
										},
										update_item : (parellelSubCallback)=>{
											items.updateOne({
												_id: mainItemId
											},
											{$set: {
												is_active	: isActive,
												modified 	: Helper.getUtcDate(),
											}}).then(()=>{
												parellelSubCallback(null);
											}).catch(next);
										},
										delete_linkings : (parellelSubCallback)=>{
											item_linkings.deleteMany({
												item_id 		: mainItemId,
												to_be_deleted 	: true,
											}).then(()=>{
												parellelSubCallback(null);
											}).catch(next);
										},
										delete_units : (parellelSubCallback)=>{
											item_units.deleteMany({
												item_id 		: mainItemId,
												to_be_deleted 	: true,
											}).then(()=>{
												parellelSubCallback(null);
											}).catch(next);
										},
										group_delete : (parellelSubCallback)=>{
											item_choices_groups.deleteMany({
												item_id 		: mainItemId,
												to_be_deleted 	: true,
											}).then(()=>{
												parellelSubCallback(null);
											}).catch(next);
										},
										group_item_delete : (parellelSubCallback)=>{
											item_extra_masters.deleteMany({
												item_id 		: mainItemId,
												to_be_deleted 	: true,
											}).then(()=>{
												parellelSubCallback(null);
											}).catch(next);
										},
										group_item_extra : (parellelSubCallback)=>{
											item_group_extras.deleteMany({
												item_id 		: mainItemId,
												to_be_deleted 	: true,
											}).then(()=>{
												parellelSubCallback(null);
											}).catch(next);
										},
										update_unit_price : (parellelSubCallback)=>{
											parellelSubCallback(null);

											/** Update item unit price **/
											this.updateItemUnitPrice(req, res,next,{item_id: mainItemId}).then(()=>{});
										},
									},(parallelErr)=>{
										eachCallback(parallelErr);
									});
								},(asyncSubEachErr)=>{
									parentSubCallback(asyncSubEachErr);
								});
							},
						},(parentErr)=>{
							if(parentErr){
								console.error("Last each error in updateCravezComboItems");
								return console.error(parentErr);
							}else{
								console.log("updateCravezComboItems Done");
							}
						});
					}
				});
			}
		});
	}; // End updateCravezComboItems

	/**
	 * Function to update item unit price
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async updateItemUnitPrice (req,res,next,options){
		return new Promise(resolve=>{
			let itemId = (options.item_id) ? new ObjectId(options.item_id) :"";

			/** Send error response **/
			if(!itemId) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters")});

			/** Get item unit lowest price */
			const item_units = this.db.collection(Tables.ITEM_UNITS);
            item_units.findOne({
				item_id			:	itemId,
				status			: 	Constants.ACTIVE,
				to_be_deleted	: 	{$exists: false}
			},{projection:{price:1},sort:{price: Constants.SORT_ASC}}).then(result => {

				let updateData = {
					$set : {modified: Helper.getUtcDate()}
				};

				if(result) updateData["$set"].unit_price = result.price;
				if(!result) updateData["$unset"] = {unit_price: 1};

				/** Update unit price in items */
				const items = this.db.collection(Tables.ITEMS);
				items.updateOne({_id: itemId},updateData).then(() => {

					/**Send success response */
					resolve({status: Constants.STATUS_SUCCESS });
				}).catch(next);
			}).catch(next);
        }).catch(next);
	};// end updateItemUnitPrice()

	/**
	 * Function to migrate agent performance stats
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * Cron Hit once in a day and get one day before data
	 * @return render
	 */
	async agentPerformance (req, res, next){
		try {
			/** Send response to client and work in background */
			res.render('blank',{layout:false});

			let date = Helper.subtractDate(Constants.HOURS_IN_A_DAY);
			let startDate	=	Helper.newDate(date,Constants.DATABASE_DATE_FORMAT+" "+Constants.START_DATE_TIME_FORMAT);
			let endDate		=	Helper.newDate(date,Constants.DATABASE_DATE_FORMAT+" "+Constants.END_DATE_TIME_FORMAT);
			let options		=	{
				start_date	:	startDate,
				end_date	:	endDate
			};
			asyncParallel({
				performance_stat :(parentCallback)=>{
					this.agentPerformanceStats(req,res,next,options);
					parentCallback(null);
				},
				activity_stat :(parentCallback)=>{
					this.agentActivityStats(req,res,next,options);
					parentCallback(null);
				},
				login_stat :(parentCallback)=>{
					this.agentLoginStats(req,res,next,options);
					parentCallback(null);
				},
				shift_stat :(parentCallback)=>{
					this.agentShiftsStats(req,res,next,options);
					parentCallback(null);
				},
			},(parentAsyncError)=>{
				if(parentAsyncError){
					console.error("Error in agentPerformance",parentAsyncError);
				}
			});
		} catch (error) {
			console.error("Catch error in agentPerformance",error);
		}
	}; //end agentPerformance

	/**
	 * Function to calculate agent performance stats like offered/answered/outbound/abandoned/conformance/aht
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render
	 */
	async agentPerformanceStats (req, res, next,options){
		try {
			let startDate 	=	options.start_date;
			let endDate 	= 	options.end_date;
			const iAgentPerformanceStat	=	this.db.collection(Tables.IAGENTPERFORMANCESTAT);
			iAgentPerformanceStat.aggregate([
				{ $match : { Timestamp		:	{$gte: startDate, $lte: endDate}}},
				{ $addFields: {
					convertedOffered: { $convert: { input: "$CallsOffered", to: "int" } },
					convertedAnswered: { $convert: { input: "$CallsAnswered", to: "int" } },
					convertedDNInExtCalls: { $convert: { input: "$DNInExtCalls", to: "int" } },
					convertedDNInIntCalls: { $convert: { input: "$DNInIntCalls", to: "int" } },
					convertedDNOutExtCalls: { $convert: { input: "$DNOutExtCalls", to: "int" } },
					convertedDNOutIntCalls: { $convert: { input: "$DNOutIntCalls", to: "int" } },
					convertedCallsReturnedToQDueToTimeout: { $convert: { input: "$CallsReturnedToQDueToTimeout", to: "int" } },
					convertedTalkTime: { $convert: { input: "$TalkTime", to: "int" } },
					convertedLoggedInTime: { $convert: { input: "$LoggedInTime", to: "int" } },
				}},
				{ $group	:	{
					_id		:	"$AgentLogin",
					CallsOffered:	{$sum : "$convertedOffered"},
					CallsAnswered:	{$sum : "$convertedAnswered"},
					DNInExtCalls:	{$sum : "$convertedDNInExtCalls"},
					DNInIntCalls:	{$sum : "$convertedDNInIntCalls"},
					DNOutExtCalls:	{$sum : "$convertedDNOutExtCalls"},
					DNOutIntCalls:	{$sum : "$convertedDNOutIntCalls"},
					CallsReturnedToQDueToTimeout:	{$sum : "$CallsReturnedToQDueToTimeout"},
					LoggedInTime:	{$sum : "$convertedLoggedInTime"},
					AgentGivenName:	{$first: "$AgentGivenName"},
					AgentSurName:	{$first: "$AgentSurName"},
					Timestamp	:	{$first: "$Timestamp"},
					TalkTime	:	{$sum : "$convertedTalkTime"},
				}},
			]).toArray().then(result=>{
				if(result && result.length > 0){
					asyncEach(result,(data, asyncEachCallback)=>{
						let agentName	=	data?.AgentGivenName+' '+data?.AgentSurName;
						asyncParallel({
							offered :(callback)=>{
								const avaya_offered	=	this.db.collection(Tables.AVAYA_OFFERED);
								avaya_offered.insertOne({
									agent_name 		: agentName,
									code 			: data._id,
									date			: Helper.getUtcDate(data.Timestamp),
									count 			: data.CallsOffered,
									created			: Helper.getUtcDate()
								}).then(()=>{
									callback(null);
								}).catch(err=>{
									callback(err);
								});
								callback(null);
							},
							answered :(callback)=>{
								const avaya_answered	=	this.db.collection(Tables.AVAYA_ANSWERED);
								avaya_answered.insertOne({
									agent_name 		: agentName,
									code 			: data._id,
									date			: Helper.getUtcDate(data.Timestamp),
									count 			: data.CallsAnswered,
									created			: Helper.getUtcDate()
								}).then(()=>{
									callback(null);
								}).catch(err=>{
									callback(err);
								});
							},
							outbound :(callback)=>{
								let dnOutboundCalls	=	data.DNInExtCalls + data.DNInIntCalls + data.DNOutExtCalls + data.DNOutIntCalls;
								const avaya_outbound	=	this.db.collection(Tables.AVAYA_OUTBOUND);
								avaya_outbound.insertOne({
									agent_name 		: agentName,
									code 			: data._id,
									date			: Helper.getUtcDate(data.Timestamp),
									count 			: dnOutboundCalls,
									created			: Helper.getUtcDate()
								}).then(()=>{
									callback(null);
								}).catch(err=>{
									callback(err);
								});
							},
							abandoned :(callback)=>{
								const avaya_abandoned	=	this.db.collection(Tables.AVAYA_ABANDONED);
								avaya_abandoned.insertOne({
									agent_name 		: agentName,
									code 			: data._id,
									date			: Helper.getUtcDate(data.Timestamp),
									count 			: data.CallsReturnedToQDueToTimeout,
									created			: Helper.getUtcDate()
								}).then(()=>{
									callback(null);
								}).catch(err=>{
									callback(err);
								});
							},
							conformance :(callback)=>{
								const avaya_conformance	=	this.db.collection(Tables.AVAYA_CONFORMANCE);
								avaya_conformance.insertOne({
									agent_name 		: agentName,
									code 			: data._id,
									date			: Helper.getUtcDate(data.Timestamp),
									time			: Helper.convertSecondsToTimeFormat(data.LoggedInTime,Constants.AVAYA_TIME_FORMAT),
									created			: Helper.getUtcDate()
								}).then(()=>{
									callback(null);
								}).catch(err=>{
									callback(err);
								});
							},
							aht :(callback)=>{
								const avaya_aht	=	this.db.collection(Tables.AVAYA_AHT);
								avaya_aht.insertOne({
									agent_name 		: agentName,
									code 			: data._id,
									date			: Helper.getUtcDate(data.Timestamp),
									time			: (data.TalkTime) ? Helper.convertSecondsToTimeFormat(data.TalkTime / data.CallsAnswered,Constants.AVAYA_TIME_FORMAT) : '',
									talk_time		: data.TalkTime,
									calls_answered	: data.CallsAnswered,
									created			: Helper.getUtcDate()
								}).then(()=>{
									callback(null);
								}).catch(err=>{
									callback(err);
								});
							},
						},(asyncError)=>{
							asyncEachCallback(asyncError);
						});
					},(asyncErr)=>{
						if(asyncErr){
							console.error("Error in asyncEach of series at agentPerformanceStats",asyncErr);
						}
					});
				}
			}).catch(err=>{
				console.error("Error in agentPerformanceStats",err);
			});

			return {status: Constants.STATUS_SUCCESS};
		} catch (error) {
			console.error("Catch error in agentPerformanceStats",error);
		}
	}; //end agentPerformanceStats

	/**
	 * Function to calculate agent activity stats like NR
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render
	 */
	async agentActivityStats (req, res, next,options){
		try {
			let startDate 	=	options.start_date;
			let endDate 	= 	options.end_date;
			const iActivityCodeStat	=	this.db.collection(Tables.IACTIVITYCODESTAT);
			iActivityCodeStat.aggregate([
				{ $match : {
					Timestamp			:	{$gte: startDate, $lte: endDate},
					$or: [
						{ActivityCodeName : "Short Break"},
						{ActivityCodeName : "Not_Ready_Default_Reason_Code"}
					]
				}},
				{ $addFields: {
					convertedActivityTime: { $convert: { input: "$ActivityTime", to: "int" } },
				}},
				{ $group	:	{
					_id		:	"$AgentLogin",
					ActivityTime:	{$sum : "$convertedActivityTime"},
					AgentGivenName:	{$first: "$AgentGivenName"},
					AgentSurName:	{$first: "$AgentSurName"},
					Timestamp	:	{$first: "$Timestamp"},
				}},
			]).toArray().then(result=>{

				if(result && result.length > 0){
					asyncEach(result,(data, asyncEachCallback)=>{
						let agentName	=	data?.AgentGivenName+' '+data?.AgentSurName;

						const avaya_nr	=	this.db.collection(Tables.AVAYA_NR);
						avaya_nr.insertOne({
							agent_name 		: agentName,
							code 			: data._id,
							date			: Helper.getUtcDate(data.Timestamp),
							time			: Helper.convertSecondsToTimeFormat(data.ActivityTime,Constants.AVAYA_TIME_FORMAT),
							created			: Helper.getUtcDate()
						}).then(()=>{
							asyncEachCallback(null);
						}).catch(()=>{
							asyncEachCallback(null);
						});
					},(asyncErr)=>{
						if(asyncErr){
							console.error("Error in asyncEach of series at agentActivityStats",asyncErr);
						}
					});
				}
			}).catch(err=>{
				console.error("Error in agentActivityStats",err);
			});

			return {status: Constants.STATUS_SUCCESS};
		} catch (error) {
			console.error("Catch error in agentActivityStats",error);
		}
	}; //end agentActivityStats

	/**
	 * Function to calculate agent login stats like login_time/tardiness/
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render
	 */
	async agentLoginStats (req, res, next,options){
		try {
			let startDate 	=	options.start_date;
			let endDate 	= 	options.end_date;
			const eAgentLoginStat	=	this.db.collection(Tables.EAGENTLOGINSTAT);
			eAgentLoginStat.aggregate([
				{ $match : { Timestamp:	{$gte: startDate, $lte: endDate}}},
				{ $group	:	{
					_id		:	"$AgentLogin",
					Time	:	{$first : "$Time"},
					AgentGivenName:	{$first: "$AgentGivenName"},
					AgentSurName:	{$first: "$AgentSurName"},
					Timestamp	:	{$first: "$Timestamp"},
				}},
			]).toArray().then(result=>{
				if(result && result.length > 0){
					asyncEach(result,(data, asyncEachCallback)=>{
						let agentName	=	data?.AgentGivenName+' '+data?.AgentSurName;
						asyncParallel({
							login_time :(callback)=>{
								const avaya_login_time	=	this.db.collection(Tables.AVAYA_LOGIN_TIME);
								avaya_login_time.insertOne({
									agent_name 		: agentName,
									code 			: data._id,
									date			: Helper.getUtcDate(data.Timestamp),
									time			: data.Time,
									created			: Helper.getUtcDate()
								}).then(()=>{}).catch(()=>{});
								callback(null);
							},
							tardiness :(callback)=>{
								const users	=	this.db.collection(Tables.USERS);
								users.aggregate([
									{$match : { code : data._id}},
									{$lookup:	{
										from     : Tables.TEAM_AVAILABILITIES,
										let      : {userId : "$_id"},
										pipeline : [
											{$match : {
												$expr: {
													$and : [
														{$eq: ["$user_id", "$$userId"]},
														{$gte: ["$date", Helper.getUtcDate(startDate)]},
														{$lte: ["$date", Helper.getUtcDate(endDate)]},
													]
												}
											}},
										],
										as:	"shift_detail"
									}},
									{ $project : {_id:1,shift_id: {$arrayElemAt: ["$shift_detail.shift_id",0]} }}
								]).toArray().then(tardResult=>{

									let shiftId	=	(tardResult[0] && tardResult[0].shift_id) ? tardResult[0].shift_id : '';
									if(shiftId){
										const shifts	=	this.db.collection(Tables.SHIFTS);
										shifts.findOne({
											_id : 	new ObjectId(shiftId),
										},{projection:{start_time:1}}).then(shiftResult=>{

											let shiftStartTime	=	(shiftResult && shiftResult.start_time) ? shiftResult.start_time : '';
											if (shiftStartTime && shiftStartTime.toString().indexOf('.') != -1){
												shiftStartTime	=	String(shiftStartTime).replace(".",":")+':00';
											}else{
												shiftStartTime	=	shiftStartTime+':00:00';
											}
											shiftStartTime		=	Helper.newDate(Helper.newDate(startDate,Constants.DATABASE_DATE_FORMAT)+' '+shiftStartTime);
											let loginTime		=	Helper.newDate(Helper.newDate(startDate,Constants.DATABASE_DATE_FORMAT)+' '+data.Time);
											let tardMints		=	0;

											if(loginTime > shiftStartTime){
												tardMints	=	Helper.getDifferenceBetweenTwoDatesInMinute(shiftStartTime,loginTime);
												const avaya_tardiness	=	this.db.collection(Tables.AVAYA_TARDINESS);
												avaya_tardiness.insertOne({
													agent_name 		: agentName,
													code 			: data._id,
													date			: Helper.getUtcDate(data.Timestamp),
													time			: Helper.convertSecondsToTimeFormat(tardMints * Constants.SECONDS_IN_A_MINUTE,Constants.AVAYA_TIME_FORMAT),
													created			: Helper.getUtcDate()
												}).then(()=>{}).catch(()=>{});
											}
											callback(null);
										});
									}else{
										callback(null);
									}
								});
							},
						},(asyncError)=>{
							asyncEachCallback(asyncError);
						});
					},(asyncErr)=>{
						if(asyncErr){
							console.error("Error in asyncEach of series at agentLoginStats",asyncErr);
						}
					});
				}
			}).catch(err=>{
				console.error("Error in agentLoginStats",err);
			});

			return {status: Constants.STATUS_SUCCESS};
		} catch (error) {
			console.error("Catch error in agentLoginStats",error);
		}
	}; //end agentLoginStats

	/**
	 * Function to calculate agent shift stats like shift_detail
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render
	 */
	async agentShiftsStats (req, res, next,options){
		try {
			let startDate 	=	options.start_date;
			let endDate 	= 	options.end_date;
			let teamConditions 		 =  clone(Constants.ADMIN_USER_COMMON_CONDITIONS);
			teamConditions.team_head = false;
			teamConditions.parent_id = { $exists: true ,$ne : "" };

			const users		=	this.db.collection(Tables.USERS);
			users.find(teamConditions,{projection : { _id:1,full_name:1,code:1}}).toArray().then(userResult=>{
				if(userResult.length > 0){
					asyncEach(userResult,(data, asyncEachCallback)=>{
						let userName	=	(data.full_name) ? data.full_name : '';
						let code		=	(data.code) 	 ? data.code 	  : '';
						const team_availabilities	=	this.db.collection(Tables.TEAM_AVAILABILITIES);
						team_availabilities.findOne({
							user_id	:	data._id,
							date	:	{$gte : Helper.getUtcDate(startDate), $lte : Helper.getUtcDate(endDate)}
						},{
							projection : { shift_id:1, leave_type:1}
						}).then(result=>{
							if(!result) return asyncEachCallback(null,{});

							let shiftId 	= (result?.shift_id) ? result?.shift_id : '';
							let leaveType	= (result?.leave_type) ? result?.leave_type : '';
							asyncParallel({
								shift_detail :(callback)=>{
									if(!shiftId) return callback(null,{});

									const shifts	=	this.db.collection(Tables.SHIFTS);
									shifts.findOne({
										_id	:	shiftId,
									},{
										projection : { start_time:1 }
									}).then(shiftResult=>{
										callback(null,shiftResult);
									}).catch(err=>{
										callback(err,{});
									});
								},
							},(childAsyncError, childAsyncResponse)=>{
								if(childAsyncError) return asyncEachCallback(childAsyncError);

								let shiftDetails	=	(childAsyncResponse.shift_detail) ? childAsyncResponse.shift_detail : {};
								let startTime		=	(shiftDetails.start_time) ? shiftDetails.start_time : '';
								if (startTime){
									if(startTime.toString().indexOf('.') != -1){
										startTime	=	String(startTime).replace(".",":")+':00';
									}else{
										startTime	=	startTime+':00:00';
									}
								}
								let dataToInsert	=	{
									agent_name 		: userName,
									code 			: code,
									date			: Helper.getUtcDate(startDate),
									created			: Helper.getUtcDate()
								};
								if(startTime) dataToInsert['time']			=	startTime;
								if(leaveType) dataToInsert['leave_type']	=	leaveType;

								const avaya_shift	=	this.db.collection(Tables.AVAYA_SHIFT);
								avaya_shift.insertOne(dataToInsert).then(()=>{}).catch(()=>{});
								asyncEachCallback(null);
							});
						});
					},(asyncError)=>{
						if(asyncError){
							console.error("Error in asyncEach of series at agentShiftsStats",asyncError);
						}
					});
				}
			}).catch(err=>{
				console.error("Error in agentShiftsStats",err);
			});

			return {status: Constants.STATUS_SUCCESS};
		} catch (error) {
			console.error("Catch error in agentShiftsStats",error);
		}
	}; // End agentShiftsStats

	/**
	 * Function to calculate agent date wise report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render
	 */
	async calculateDailyStats (req, res, next,options){
		try {
			let date 		=	(req.params.date) 	? 	req.params.date 	:"";
			let startDate 	=	Helper.newDate(date,Constants.DATABASE_DATE_FORMAT+" "+Constants.START_DATE_TIME_FORMAT);
			let endDate 	= 	Helper.newDate(date,Constants.DATABASE_DATE_FORMAT+" "+Constants.END_DATE_TIME_FORMAT);
			const iAgentPerformanceStat	=	this.db.collection(Tables.IACTIVITYCODESTAT);
			iAgentPerformanceStat.aggregate([
				{$match : {
					Timestamp		:	{$gte: startDate, $lte: endDate}}
				},
				{ $group	:	{
					_id		:	"$AgentLogin",
					AgentGivenName:	{$first: "$AgentGivenName"},
					AgentSurName:	{$first: "$AgentSurName"},
				}},
			]).toArray().then(result=>{

				let finalArray	=	[];
				let loginIds	=	[];
				if(result.length > 0){
					result.map(records=>{
						loginIds.push(records._id)
					});
				}
				asyncParallel({
					offered: (callback)=>{
						/** Get offered counts */
						const avaya_offered = this.db.collection(Tables.AVAYA_OFFERED);
						avaya_offered.find({code : {$in : loginIds},date : {$gte: Helper.getUtcDate(startDate), $lte: Helper.getUtcDate(endDate)}},{projection : {code: 1,count: 1}}).toArray().then(offeredResult=>{
							let offeredList = {};
							offeredResult.map(data=>{
								offeredList[data.code] = data.count;
							});
							callback(null,offeredList);
						}).catch(err=>{
							callback(err,{});
						});
					},
					answered: (callback)=>{
						/** Get answered counts */
						const avaya_answered = this.db.collection(Tables.AVAYA_ANSWERED);
						avaya_answered.find({code : {$in : loginIds},date : {$gte: Helper.getUtcDate(startDate), $lte: Helper.getUtcDate(endDate)}},{projection : {code: 1,count: 1}}).toArray().then(answeredResult=>{
							let answeredList = {};
							answeredResult.map(data=>{
								answeredList[data.code] = data.count;
							});
							callback(null,answeredList);
						}).catch(err=>{
							callback(err,{});
						});
					},
					abandoned: (callback)=>{
						/** Get abandoned counts */
						const avaya_abandoned = this.db.collection(Tables.AVAYA_ABANDONED);
						avaya_abandoned.find({code : {$in : loginIds},date : {$gte: Helper.getUtcDate(startDate), $lte: Helper.getUtcDate(endDate)}},{projection : {code: 1,count: 1}}).toArray().then(abandonedResult=>{
							let abandonedList = {};
							abandonedResult.map(data=>{
								abandonedList[data.code] = data.count;
							});
							callback(null,abandonedList);
						}).catch(err=>{
							callback(err,{});
						});
					},
					outbound: (callback)=>{
						/** Get outbound counts */
						const avaya_outbound = this.db.collection(Tables.AVAYA_OUTBOUND);
						avaya_outbound.find({code : {$in : loginIds},date : {$gte: Helper.getUtcDate(startDate), $lte : Helper.getUtcDate(endDate)}},{projection : {code: 1,count: 1}}).toArray().then(outboundResult=>{
							let outboundList = {};
							outboundResult.map(data=>{
								outboundList[data.code] = data.count;
							});
							callback(null,outboundList);
						}).catch(err=>{
							callback(err,{});
						});
					},
					aht: (callback)=>{
						/** Get aht time */
						const avaya_aht = this.db.collection(Tables.AVAYA_AHT);
						avaya_aht.find({code : {$in : loginIds},date : {$gte: Helper.getUtcDate(startDate), $lte: Helper.getUtcDate(endDate)}},{projection : {code: 1,time: 1}}).toArray().then(ahtResult=>{
							let ahtList = {};
							ahtResult.map(data=>{
								ahtList[data.code] = data.time;
							});
							callback(null,ahtList);
						}).catch(err=>{
							callback(err,{});
						});
					},
					conformance: (callback)=>{
						/** Get conformance time */
						const avaya_conformance = this.db.collection(Tables.AVAYA_CONFORMANCE);
						avaya_conformance.find({code : {$in : loginIds},date : {$gte: Helper.getUtcDate(startDate), $lte: Helper.getUtcDate(endDate)}},{projection : {code: 1,time: 1}}).toArray().then(conformanceResult=>{
							let conformanceList = {};
							conformanceResult.map(data=>{
								conformanceList[data.code] = data.time;
							});
							callback(null,conformanceList);
						}).catch(err=>{
							callback(err,{});
						});
					},
					shift: (callback)=>{
						/** Get shift time/leave type */
						const avaya_shift = this.db.collection(Tables.AVAYA_SHIFT);
						avaya_shift.find({code : {$in : loginIds},date : {$gte: Helper.getUtcDate(startDate), $lte: Helper.getUtcDate(endDate)}},{projection : {code: 1,time: 1,leave_type:1}}).toArray().then(shiftResult=>{
							let shiftList = {};
							shiftResult.map(data=>{
								if(data.time) shiftList[data.code] = data.time;
								if(data.leave_type) shiftList[data.code] = data.leave_type;
							});
							callback(null,shiftList);
						}).catch(err=>{
							callback(err,{});
						});
					},
					login: (callback)=>{
						/** Get login time  */
						const avaya_login_time = this.db.collection(Tables.AVAYA_LOGIN_TIME);
						avaya_login_time.find({code : {$in : loginIds},date : {$gte: Helper.getUtcDate(startDate), $lte: Helper.getUtcDate(endDate)}},{projection : {code: 1,time: 1}}).toArray().then(loginResult=>{
							let loginList = {};
							loginResult.map(data=>{
								loginList[data.code] = data.time;
							});
							callback(null,loginList);
						}).catch(err=>{
							callback(err,{});
						});
					},
					tardiness: (callback)=>{
						/** Get tardiness time  */
						const avaya_tardiness = this.db.collection(Tables.AVAYA_TARDINESS);
						avaya_tardiness.find({code : {$in : loginIds},date : {$gte: Helper.getUtcDate(startDate), $lte: Helper.getUtcDate(endDate)}},{projection : {code: 1,time: 1}}).toArray().then(tardinessResult=>{
							let tardinessList = {};
							tardinessResult.map(data=>{
								tardinessList[data.code] = data.time;
							});
							callback(null,tardinessList);
						}).catch(err=>{
							callback(err,{});
						});
					},
					nr: (callback)=>{
						/** Get nr time  */
						const avaya_nr = this.db.collection(Tables.AVAYA_NR);
						avaya_nr.find({code : {$in : loginIds},date : {$gte: Helper.getUtcDate(startDate), $lte: Helper.getUtcDate(endDate)}},{projection : {code: 1,time: 1}}).toArray().then(nrResult=>{
							let nrList = {};
							nrResult.map(data=>{
								nrList[data.code] = data.time;
							});
							callback(null,nrList);
						}).catch(err=>{
							callback(err,{});
						});
					},
				},(asyncError, asyncResponse)=>{
					if(asyncError) {
						console.error("Error in asyncEach of series at calculateDailyStats",asyncError);
					}

					if(result.length > 0){
						result.map(records=>{
							let conformance		= (asyncResponse.conformance[records._id]) ? asyncResponse.conformance[records._id] : '';
							let nr				= (asyncResponse.nr[records._id]) ? asyncResponse.nr[records._id] : '';
							let nrPercentage	= 0; // NR percentage will be calculated if nr is not empty otherwise 0
							if(nr) nrPercentage	= (Helper.convertTimeFormatToSeconds(nr)/Helper.convertTimeFormatToSeconds(conformance))*Constants.MAX_PERCENTAGE;
							records.offered		= (asyncResponse.offered[records._id]) ? asyncResponse.offered[records._id] : 0;
							records.answered	= (asyncResponse.answered[records._id]) ? asyncResponse.answered[records._id] : 0;
							records.abandoned	= (asyncResponse.abandoned[records._id]) ? asyncResponse.abandoned[records._id] : 0;
							records.outbound	= (asyncResponse.outbound[records._id]) ? asyncResponse.outbound[records._id] : 0;
							records.aht			= (asyncResponse.aht[records._id]) ? asyncResponse.aht[records._id] : '';
							records.conformance	= conformance;
							records.shift		= (asyncResponse.shift[records._id]) ? asyncResponse.shift[records._id] : '';
							records.login		= (asyncResponse.login[records._id]) ? asyncResponse.login[records._id] : '';
							records.tardiness	= (asyncResponse.tardiness[records._id]) ? asyncResponse.tardiness[records._id] : '';
							records.nr			= Helper.round(nrPercentage,Constants.ROUND_PRECISION);
						});

						res.send({"result":result});
					}else{
						res.render('blank',{layout:false});
					}
				});
			});
		} catch (error) {
			console.error("Catch error in calculateDailyStats",error);
		}
	}; // End calculateDailyStats

	/**
	 * Function to calculate weekly quality stats
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render
	 */
	async weeklyQualityStats (req, res, next){
		try {
			let startDate 	=	Helper.newDate("2020-02-01",Constants.DATABASE_DATE_FORMAT+" "+Constants.START_DATE_TIME_FORMAT);
			let endDate 	= 	Helper.newDate("2020-02-29",Constants.DATABASE_DATE_FORMAT+" "+Constants.END_DATE_TIME_FORMAT);
			const avaya_quality_summary	=	this.db.collection(Tables.AVAYA_QUALITY_SUMMARY);
			avaya_quality_summary.aggregate([
				{ $match : { call_date_time	:	{$gte: Helper.getUtcDate(startDate), $lte: Helper.getUtcDate(endDate)}}},
				{
					"$unwind": "$data"
				},
				{
					"$project": {
						"weekOfMonth": {$floor: {$divide: [{$dayOfMonth: "$call_date_time"}, 7]}},
						"month": { $month: "$call_date_time" },
						"data": 1,
						"agent_id": 1
					}
				},
				{$group: {
					_id : {
						_id : "$weekOfMonth",
						type : "$data.type",
						agent_id : 	"$agent_id",
					},
					main_id : {$first : "$weekOfMonth" },
					month : {$first : "$month" },
					type : {$first : "$data.type" },
					data : {$first : "$data" },
					total_value : {$sum : "$data.number_of_error" },
					agent_id : {$first : "$agent_id" }
				}},
				{$group: {
					_id                 :   {
						main_id 			: 	"$main_id",
						agent_id 			: 	"$agent_id",
					},
					month : {$first : "$month" },
					non_critical_count  :   {
						'$sum': {
							$cond: [
								{$and: [
									{ $eq : ["$type",Constants.NON_CRITICAL] },
								]},
								'$total_value',
								0
							]
						}
					},
					business_count  :   {
						'$sum': {
							$cond: [
								{$and: [
									{ $eq : ["$type",Constants.BUSINESS_CRITICAL] },
								]},
								'$total_value',
								0
							]
						}
					},
					end_user_count  :   {
						'$sum': {
							$cond: [
								{$and: [
									{ $eq : ["$type",Constants.END_USER_CRITICAL] },
								]},
								'$total_value',
								0
							]
						}
					}
				}},
				{$group: {
					_id :	"$_id.agent_id",
					month : {$first : "$month" },
					data:	{
						$push:	{
							weekOfMonth:"$_id.main_id",
							non_critical_count:"$non_critical_count",
							business_count:"$business_count",
							end_user_count:"$end_user_count"
						}

					}
				}}
			]).toArray().then(result=>{
				res.send({
					"result":result
				});
			}).catch(err=>{
				console.error("Error in weeklyQualityStats",err);
			});
		} catch (error) {
			console.error("Catch error in weeklyQualityStats",error);
		}
	};// End weeklyQualityStats

	/**
	 * Function to save captain wise orders
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return render
	 */
	async saveCaptainWiseOrders (req, res,next){
		/** Send response to client and work in background */
		res.render('blank', { layout: false });

		let numberOfDays 	   = (req.params.days) ? parseInt(req.params.days) :2;
		if(numberOfDays <= 0 || isNaN(numberOfDays)) numberOfDays = 2;

		let hoursInADay   =  numberOfDays*Constants.HOURS_IN_A_DAY;
		let tempStartDate =  Helper.newDate(Helper.subtractDate(hoursInADay));
		let startDate     =  Helper.newDate(tempStartDate,Constants.DATABASE_DATE_FORMAT);
		startDate  	      =  Helper.newDate(startDate+" "+Constants.START_DATE_TIME_FORMAT);
		let endDate  	  =  Helper.newDate(Helper.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));

		const orders  	  					=  this.db.collection(Tables.ORDERS);
		const captain_wise_processed_orders	=  this.db.collection(Tables.CAPTAIN_WISE_PROCESSED_ORDERS);
		const driver_in_out_shifts = this.db.collection(Tables.DRIVER_IN_OUT_SHIFTS);

		let datesArray = Helper.getDateRange(startDate, endDate);
		eachOfSeries(datesArray, (tmpDate, key, seariesCallback) => {
			let tmpCurrentDate = Helper.newDate(tmpDate, Constants.DATABASE_DATE_FORMAT);
			let tmpStartDate = Helper.newDate(tmpCurrentDate + " " + Constants.START_DATE_TIME_FORMAT);
			let tmpEndDate = Helper.newDate(tmpCurrentDate + " " + Constants.END_DATE_TIME_FORMAT);

			asyncParallel({
				orders_count: (callback) => {
					orders.aggregate([
						{$match :{
							order_date		: { $gte: tmpStartDate, $lt: tmpEndDate },
							captain_id		: {$ne : ""},
							admin_status 	: Constants.ORDER_DELIVERED
						}},
						{$group :{
							_id : {
								captain_id 	: "$captain_id",
								date 		: { $dateToString: { format: "%Y-%m-%d", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE }}
							},
							captain_id 		: {$first : "$captain_id"},
							order_date   	: {$first : "$order_date"},
							orders			: {$sum : 1},
							delayed_orders	: {$sum: {
								$cond: [
									{$and : [ { $eq: [  "$is_delayed", true]}]},
									1,
									0
								]
							}},
						}},
					]).toArray().then(result => {
						callback(null, result);
					}).catch(err => {
						callback(err, []);
					});
				},
				working_hours: (callback) => {
					driver_in_out_shifts.aggregate([
						{$match :{
							created	: { $gte: tmpStartDate, $lt: tmpEndDate },
							type	: Constants.OUT_SHIFT
						}},
						{$group :{
							_id : {
								captain_id : "$driver_id",
								date : { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: Constants.DEFAULT_TIME_ZONE }}
							},
							captain_id: { $first: "$driver_id"},
							created: { $first: "$created"},
							shifts : {$push : {
								created: "$created",
								modified: "$modified",
							}}
						}},
					]).toArray().then(result => {
						if(result){
							result.map(record=>{
								let difference = 0;
								record.shifts.map(shift=>{
									let tmpCreated 	=	Helper.newDate(Helper.newDate(shift.created, "yyyy/MM/dd HH:MM:00"));
									let tmpModified	= 	Helper.newDate(Helper.newDate(shift.modified, "yyyy/MM/dd HH:MM:00"));
									difference += Helper.getDifferenceBetweenTwoDatesInMinute(tmpCreated,tmpModified);
								});
								record.working_minutes = Math.round(difference);
								record.working_hours = Math.round(difference/Constants.MINUTES_IN_A_HOUR);
							});
						}
						callback(null, result);
					}).catch(err => {
						callback(err, []);
					});
				}
			}, (err, response) => {
				if(err){
					console.error("Error in saveCaptainWiseOrders",err);
					return seariesCallback(null);
				}

				let orderCount   = (response.orders_count) ? response.orders_count :[];
				let workingHours = (response.working_hours) ? response.working_hours : [];
				asyncParallel({
					save_orders_count: (childCallback) => {
						if(!orderCount || orderCount.length ==0) return childCallback(null);

						eachOfSeries(orderCount, (records, key,eachCallback)=> {
							let created			=	records.order_date;
							let createdDate		=  	Helper.newDate(created,Constants.DATABASE_DATE_FORMAT);
							let createdStart	=	Helper.newDate(createdDate+" "+Constants.START_DATE_TIME_FORMAT);
							let createdEnd		=	Helper.newDate(createdDate+" "+Constants.END_DATE_TIME_FORMAT);

							captain_wise_processed_orders.updateOne({
								captain_id : new ObjectId(records.captain_id),
								date      : {
									$gte: Helper.newDate(createdStart),
									$lte: Helper.newDate(createdEnd)
								},
							},
							{
								$set : {
									delayed_orders : (records.delayed_orders) ? parseInt(records.delayed_orders) : 0,
									orders		: (records.orders) ? parseInt(records.orders) : 0,
								},
								$setOnInsert : {
									date			: records.order_date,
									working_minutes : 0,
									working_hours 	: 0,
									created			: Helper.getUtcDate(),
								}
							},{upsert : true}).then(() => {
								eachCallback(null);
							}).catch(err => {
								eachCallback(err);
							});
						},(childEachErr)=>{
							childCallback(childEachErr);
						});
					},
				}, (childErr) => {
					if(childErr){
						console.error("Error in child Parallel saveCaptainWiseOrders",childErr);
						return seariesCallback(null);
					}

					if(workingHours && workingHours.length > 0){
						/** Update driver wise orders*/
						eachOfSeries(workingHours, (records, key,eachCallback)=> {
							let created			=	records.created;
							let createdDate		=  	Helper.newDate(created,Constants.DATABASE_DATE_FORMAT);
							let createdStart	=	Helper.newDate(createdDate+" "+Constants.START_DATE_TIME_FORMAT);
							let createdEnd		=	Helper.newDate(createdDate+" "+Constants.END_DATE_TIME_FORMAT);

							captain_wise_processed_orders.updateOne({
								captain_id : new ObjectId(records.captain_id),
								date      : {
									$gte: Helper.newDate(createdStart),
									$lte: Helper.newDate(createdEnd)
								},
							},
							{
								$set : {
									working_minutes: (records.working_minutes) ? Helper.round(records.working_minutes) : 0,
									working_hours: (records.working_hours) ? Helper.round(records.working_hours) : 0,
								},
								$setOnInsert : {
									date			: records.created,
									orders			: 0,
									delayed_orders 	: 0,
									created			: Helper.getUtcDate(),
								}
							},{upsert : true}).then(() => {
								eachCallback(null);
							}).catch(err => {
								eachCallback(err);
							});
						},(childEachErr)=>{
							if(childEachErr) console.error("Error in child series saveCaptainWiseOrders",childEachErr);
							seariesCallback(null);
						});
					}else{
						seariesCallback(null);
					}
				});
			});
		}, (eachErr) => {
			if (eachErr) {
				console.error("async each error in saveCaptainWiseOrders",eachErr);
			}
		});
	};//End saveCaptainWiseOrders()

	/**
	 * Function to save captain wise orders
	 *
	 * @param req 		As Request Data
	 * @param res 		As Response Data
	 * @param options 	As Object Data
	 *
	 * @return render
	 */
	async saveRestaurnatWiseOrders (req, res,next){
		try {
			/** Send response to client and work in background */
			res.render('blank', { layout: false });

			this.saveCronLogs(req, res, next, {method_name: "saveRestaurnatWiseOrders"});

			/** Get number of days */
			let numberOfDays 	   = (req.params.days) ? parseInt(req.params.days) :2;
			if(numberOfDays <= 0 || isNaN(numberOfDays)) numberOfDays = 2;

			/** Get start and end date */
			let hoursInADay   =  numberOfDays*Constants.HOURS_IN_A_DAY;
			let tempStartDate =  Helper.newDate(Helper.subtractDate(hoursInADay));
			let startDate     =  Helper.newDate(tempStartDate,Constants.DATABASE_DATE_FORMAT);
			startDate  	      =  Helper.newDate(startDate+" "+Constants.START_DATE_TIME_FORMAT);
			let endDate  	  =  Helper.newDate(Helper.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));

			const orders  =  this.db.collection(Tables.ORDERS);
			const branch_wise_processed_orders	=  this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);

			let datesArray = Helper.getDateRange(startDate, endDate);
			eachOfSeries(datesArray, (tmpDate, key, seariesCallback) => {
				let tmpCurrentDate = Helper.newDate(tmpDate, Constants.DATABASE_DATE_FORMAT);
				let tmpStartDate = Helper.newDate(tmpCurrentDate + " " + Constants.START_DATE_TIME_FORMAT);
				let tmpEndDate = Helper.newDate(tmpCurrentDate + " " + Constants.END_DATE_TIME_FORMAT);

				/** Get driver in out shift details */
				orders.aggregate([
					{$match :{
						order_date		: { $gte: tmpStartDate, $lt: tmpEndDate},
						admin_status 	: Constants.ORDER_DELIVERED
					}},
					{$lookup:	{
						"from" 			: 	Tables.AREAS,
						"localField" 	:	"area_id",
						"foreignField" 	: 	"_id",
						"as" 			: 	"area_details"
					}},
					{$addFields : {
						city_id		: {$arrayElemAt: ["$area_details.city_id",0]},
					}},
					{$group : {
						_id : {
							branch_id		: "$branch_id",
							area_id			: "$area_id",
							delivery_type	: "$delivery_type",
							date 			: { $dateToString: { format: "%Y-%m-%d", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE }}
						},
						branch_id 		: {$first : "$branch_id"},
						restaurant_id	: {$first : "$restaurant_id"},
						area_id 		: {$first : "$area_id"},
						area_name 		: {$first : "$area_name"},
						restaurant_name : {$first : "$restaurant_name"},
						branch_name		: {$first : "$branch_name"},
						city_id 		: {$first : "$city_id"},
						order_date   	: {$first : "$order_date"},
						delivery_type	: {$first : "$delivery_type"},
						total_amount	: {$sum : "$order_price"},
						delivery_fee	: {$sum : "$delivery_fee"},
						cravez_payout	: {$sum : "$cravez_payout"},
						restaurant_payout: {$sum : "$restaurant_payout"},
						total_orders	: {$sum : 1},
						guest_orders	: {$sum: {
							$cond: [
								{$and : [ { $eq: [  "$is_guest", true]}]},
								1,
								0
							]
						}},
					}}
				],{allowDiskUse: true}).toArray().then(result=>{
					if(result.length <=0) return seariesCallback(null);

					/** Update driver wise orders*/
					asyncEach(result, (records, eachCallback)=> {
						let created			=	records.order_date;
						let createdDate		=  	Helper.newDate(created,Constants.DATABASE_DATE_FORMAT);
						let createdStart	=	Helper.newDate(createdDate+" "+Constants.START_DATE_TIME_FORMAT);
						let createdEnd		=	Helper.newDate(createdDate+" "+Constants.END_DATE_TIME_FORMAT);

						branch_wise_processed_orders.updateOne({
							branch_id : (records.branch_id) ? new ObjectId(records.branch_id) : "",
							area_id   : (records.area_id) ? new ObjectId(records.area_id) : "",
							date      : {
								$gte: Helper.newDate(createdStart),
								$lte: Helper.newDate(createdEnd)
							},
							delivery_type	: records.delivery_type,
						},
						{
							$set : {
								guest_orders	: (records.guest_orders) 	? parseInt(records.guest_orders) : 0,
								total_orders	: (records.total_orders) 	? parseInt(records.total_orders) : 0,
								restaurant_id	: (records.restaurant_id) 	? new ObjectId(records.restaurant_id) : "",
								city_id			: (records.city_id) 		? new ObjectId(records.city_id) : "",
								area_name		: records.area_name,
								restaurant_name	: records.restaurant_name,
								branch_name		: records.branch_name,
								total_amount	: (records.total_amount) 	? Helper.round(records.total_amount, Constants.CURRENCY_ROUND_PRECISION) : 0,
								delivery_fee	: (records.delivery_fee) 	? Helper.round(records.delivery_fee, Constants.CURRENCY_ROUND_PRECISION) : 0,
								cravez_payout	: (records.cravez_payout) 	? Helper.round(records.cravez_payout, Constants.CURRENCY_ROUND_PRECISION) : 0,
								restaurant_payout: (records.restaurant_payout)? Helper.round(records.restaurant_payout, Constants.CURRENCY_ROUND_PRECISION):0,
							},
							$setOnInsert : {
								date	: records.order_date,
								created	: Helper.getUtcDate(),
							}
						},{upsert : true}).then(()=>{
							eachCallback(null);
						}).catch(()=>{
							eachCallback(null);
						});
					},()=>{
						seariesCallback(null);
					});
				}).catch(err=>{
					console.error("Error in saveRestaurnatWiseOrders",err);
					return seariesCallback(null);
				});
			}, (eachErr) => {
				if(eachErr) console.error("Error in eachOfSeries at saveRestaurnatWiseOrders",eachErr);
			});
		} catch (error) {
			console.error("Catch error in saveRestaurnatWiseOrders",error);
		}
	};//End saveRestaurnatWiseOrders()

	/**
	 * Function to save cuisine report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render
	 */
	async saveOrderCuisineReport (req, res, next){
		try{
			/** Send response to client and work in background */
			res.render('blank', { layout: false });

			let numberOfDays = (req.params.days) ? parseInt(req.params.days) :2;
			if(numberOfDays <= 0 || isNaN(numberOfDays)) numberOfDays = 2;

			let hoursInADay   =  numberOfDays*Constants.HOURS_IN_A_DAY;
			let tempStartDate =  Helper.newDate(Helper.subtractDate(hoursInADay));
			let startDate     =  Helper.newDate(tempStartDate,Constants.DATABASE_DATE_FORMAT);
			startDate  	      =  Helper.newDate(startDate+" "+Constants.START_DATE_TIME_FORMAT);
			let endDate  	  =  Helper.newDate(Helper.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));
			let datesArray	  =  Helper.getDateRange(startDate,endDate);

			const areas	= this.db.collection(Tables.AREAS);
			let result = await areas.find({},{projection : {_id : 1,city_id : 1}}).toArray();

			let areaList = {};
			if(result && result.length >0){
				result.map(rec=>{
					areaList[rec._id] = rec.city_id;
				});
			}

			const orders = this.db.collection(Tables.ORDERS);
			const order_cuisine_reports	=	this.db.collection(Tables.ORDER_CUISINE_REPORTS);

			eachOfSeries(datesArray,(tmpDate, key,seariesCallback)=>{
				let tmpCurrentDate	= Helper.newDate(tmpDate,Constants.DATABASE_DATE_FORMAT);
				let tmpStartDate	= Helper.newDate(tmpCurrentDate+" "+Constants.START_DATE_TIME_FORMAT);
				let tmpEndDate		= Helper.newDate(tmpCurrentDate+" "+Constants.END_DATE_TIME_FORMAT);

				/** Get orders list */
				orders.aggregate([
					{$match :{
						order_date : {$gte: tmpStartDate, $lt: tmpEndDate},
						admin_status: Constants.ORDER_DELIVERED,
						area_id: {$exists: true, $ne: ""}
					}},
					{$lookup:	{
						from     : Tables.ORDER_ITEMS,
						let      : {orderId : "$_id"},
						pipeline : [
							{$match : {
								$expr: {
									$and : [
										{$eq: ["$order_id", "$$orderId"]},
									]
								}
							}},
							{$project : {
								item_id: 1, cuisine_ids: 1,
							}},
						],
						as	:	"order_items"
					}},
					{$lookup:	{
						from     : Tables.RESTAURANT_BRANCHES,
						let      : {branchId : "$branch_id"},
						pipeline : [
							{$match : {
								$expr: {
									$and : [
										{$eq: ["$_id", "$$branchId"]},
									]
								}
							}},
							{$project : {
								name: 1,
							}},
						],
						as	:	"branch_details"
					}},
					{$project : {
						_id : 1,area_id : 1,order_date : 1,order_price : 1,branch_id:1,restaurant_id : 1,delivery_type:1,order_items:1,area_name:1,restaurant_name:1,
						branch_name: {$arrayElemAt: ["$branch_details.name",0]},
					}}
				]).toArray().then(orderList=>{
					if(!orderList?.length) return seariesCallback(null);

					let finalSaveData	=  {};
					orderList.forEach(records=>{
						let orderId 		=	records._id;
						let areaId 			= 	records.area_id;
						let cityId			=	(areaList[areaId]) ? new ObjectId(areaList[areaId]) : "";
						let branchId 		= 	records.branch_id;
						let restaurantId 	=	records.restaurant_id;
						let orderAmount 	=	(records.order_price) ? parseFloat(records.order_price) : 0;
						let orderItems 		=	records.order_items;
						let orderDate 		=	records.order_date;
						let dateString 		=	Helper.newDate(orderDate,Constants.DATABASE_DATE_FORMAT);

						let uniqueItemList	=	{};
						let uniqueOrderList	=	{};
						let orderDetails	=	{
							branch_id 			: new ObjectId(branchId),
							area_id   			: (areaId) ? new ObjectId(areaId) : "",
							restaurant_id 		: new ObjectId(restaurantId),
							city_id 			: cityId,
							delivery_type 		: records.delivery_type,
							area_name			: records.area_name,
							restaurant_name		: records.restaurant_name,
							branch_name			: records.branch_name,
							total_orders		: 1,
							total_amount		: orderAmount,
							date				: orderDate,
							cron_date			: dateString
						};

						uniqueOrderList[orderId] = {};
						orderItems.forEach(itemData=>{
							let tmpItemId = itemData.item_id;

							if(!uniqueItemList[tmpItemId]){
								uniqueItemList[tmpItemId] = true;
								if(itemData.cuisine_ids && itemData.cuisine_ids.length > 0){
										itemData.cuisine_ids.map(cuisineId=>{
											if(!uniqueOrderList[orderId][cuisineId]){
											let uniqueCombiKey	= dateString+branchId+areaId+cuisineId;
											if(finalSaveData[uniqueCombiKey]){
												let currentCount	= finalSaveData[uniqueCombiKey].total_orders;
												let currentAmount	= finalSaveData[uniqueCombiKey].total_amount;

												finalSaveData[uniqueCombiKey].total_amount = Helper.round(currentAmount+orderAmount);
												finalSaveData[uniqueCombiKey].total_orders = parseInt(currentCount+1);
											}else{
												let tmpDetails = clone(orderDetails);
												tmpDetails.cuisine_id = new ObjectId(cuisineId);
												finalSaveData[uniqueCombiKey] = tmpDetails;
											}
											uniqueOrderList[orderId][cuisineId] = true;
										}
									});
								}
							}
						});
					});

					let dataToBeSaved = Object.values(finalSaveData);
					if(!dataToBeSaved?.length) return seariesCallback(null);

					/** Save cuisine report data */
					asyncEach(dataToBeSaved, (records, childEachCallback)=> {
						let created			=	records.cron_date;
						let createdDate		=  	Helper.newDate(created,Constants.DATABASE_DATE_FORMAT);
						let createdStart	=	Helper.newDate(createdDate+" "+Constants.START_DATE_TIME_FORMAT);
						let createdEnd		=	Helper.newDate(createdDate+" "+Constants.END_DATE_TIME_FORMAT);

						order_cuisine_reports.updateOne({
							branch_id : new ObjectId(records.branch_id),
							area_id   : new ObjectId(records.area_id),
							cuisine_id: new ObjectId(records.cuisine_id),
							date      : {
								$gte: Helper.newDate(createdStart),
								$lte: Helper.newDate(createdEnd)
							},
						},
						{
							$set : {
								total_orders	: new ObjectId(records.total_orders),
								restaurant_id	: new ObjectId(records.restaurant_id),
								city_id			: new ObjectId(records.city_id),
								delivery_type	: records.delivery_type,
								area_name		: records.area_name,
								restaurant_name	: records.restaurant_name,
								branch_name		: records.branch_name,
								total_amount	: Helper.round(records.total_amount),
							},
							$setOnInsert : {
								date	: records.date,
								created	: Helper.getUtcDate(),
							},
						},{upsert : true}).then(()=>{
							childEachCallback(null);
						}).catch(err=>{
							childEachCallback(err);
						});
					},(childEachErr)=>{
						if(childEachErr){
							console.error("Error in saveOrderCuisineReport");
							console.error(childEachErr);
						}
						seariesCallback(null);
					});
				}).catch(err=>{
					seariesCallback(err);
				});
			},(seariesErr)=>{
				if(seariesErr){
					console.error("Searies error On Crons saveCuisineReport");
					return  console.error(seariesErr);
				}
			});
		} catch (error) {
			console.error("Catch error in saveOrderCuisineReport",error);
		}
	};// End saveOrderCuisineReport

	/**
	 * Function to send scheduled push notification
	 *  Frequency : every 30 minutes/1 hour or accordingly
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param options As Object Data
	 *
	 * @return render
	 */
	async sendScheduledPNs (req, res,next){
		try {
			/** Send response to client and work in background */
			res.render('blank', { layout: false });

			/** Send notifications */
			this.pushNotificationsModule.sendScheduledNotifications(req,res,next);
		} catch (error) {
			console.error("Catch error in sendScheduledPNs",error);
		}
	};//End sendScheduledPNs()

	/**
	 * Function to send abandon cart notification
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render
	 */
	async abandonCartNotification (req, res, next){
		try {
			/** Send response to client and work in background */
			res.render('blank',{layout:false});

			/** Get customer orders */
			let abandonCartTime = 	parseFloat(res.locals.settings['App.abandon_cart_time'] || 0);
			let currentDate		=	Helper.getUtcDate(Helper.subtractMinute(abandonCartTime));

			const user_carts = this.db.collection(Tables.USER_CARTS);
			let result = await user_carts.aggregate([
				{$match : {
					created				: {$lte : currentDate},
					is_abandon_pn_sent	: {$exists : false}
				}},
				{$lookup:	{
					from     : Tables.ITEMS,
					let      : {itemId : "$item_id"},
					pipeline : [
						{$match : {
							$expr: {
								$and : [
									{$eq: ["$_id", "$$itemId"]},
									{$eq: ["$is_active", Constants.ACTIVE]},
								]
							}
						}},
						{$project : {_id: 1}},
					],
					as:	"item_details"
				}},
				{$match:{
					"item_details._id" : {$exists: true}
				}},
				{$addFields : { isDevice : {$ifNull: [ "$customer_id", true ] }}},
				{$group	: {
					_id : {
						user_device_id: {$cond: [
							{$and: [
								{$eq: ["$isDevice",true] },
							]},
							"$device_id",
							"$customer_id",
						]}
					},
					device_id	: 	{$first: "$device_id"} ,
					device_type	: 	{$first: "$device_type"} ,
					device_token: 	{$first: "$device_token"} ,
					customer_id	: 	{$first: "$customer_id"},
					cart_ids	:	{$push: "$_id"},
				}},
			]).toArray();

			if(result && result.length > 0){
				asyncEach(result,(records, asyncCallback)=>{

					let customerId	=	records?.customer_id  || "";
					let deviceType	=	records?.device_type  || "";
					let deviceToken	=	records?.device_token || "";
					let cartIds		=	records?.cart_ids 	  || [];

					/** Update cart details */
					user_carts.updateMany({
						_id: {$in: cartIds}
					},
					{$set:{
						is_abandon_pn_sent : Helper.getUtcDate()
					}}).then(()=>{

						/*************** Send push notification  ***************/
						if(customerId || (deviceType && deviceToken)){
							services.pushNotification(req,res,{
								pn_type		: 	Constants.NOTIFICATION_CART_ITEMS_PENDING,
								pn_body		:	res.__("user_cart.abandon_pn_message"),
								user_id		:	String(customerId),
								device_token:	(!customerId)  	? 	deviceToken :"",
								device_type	:	(!customerId)	?	deviceType	:"",
								user_role_id:	Constants.CUSTOMER
							}).then(()=>{
								this.saveAbandonedCartsReport(req, res, next, {customer_id: customerId, cart_ids: cartIds});
							});
						}
						/*************** Send Mail  ***************/

						asyncCallback(null);
					}).catch(err=>{
						asyncCallback(err);
					});
				},(asyncErr)=>{
					if(asyncErr){
						console.error("Async each error on abandonCartNotification",asyncErr);
					}
				});
			}
		} catch (error) {
			console.error("Catch error in abandonCartNotification",error);
		}
	};//end abandonCartNotification

	/**
	 * Function to save abandoned carts reports
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return render
	 */
	async saveAbandonedCartsReport (req, res,next, options) {
		if(!options?.cart_ids?.length) return {status: Constants.STATUS_SUCCESS};

		const user_carts = this.db.collection(Tables.USER_CARTS);
		user_carts.aggregate([
			{$match: {
				_id: { $in: Helper.arrayToObject(options.cart_ids) }
			}},
			{$lookup: {
				"from"			: Tables.USERS,
				"localField"	: "customer_id",
				"foreignField"	: "_id",
				"as"			: "user_detail"
			}},
			{$lookup: {
				"from"			: Tables.RESTAURANTS,
				"localField"	: "restaurant_id",
				"foreignField"	: "_id",
				"as"			: "restaurant_detail"
			}},
			{$lookup: {
				"from"			: Tables.RESTAURANT_BRANCHES,
				"localField"	: "branch_id",
				"foreignField"	: "_id",
				"as"			: "branch_detail"
			}},
			{$lookup: {
				"from"			: Tables.ITEMS,
				"localField"	: "item_id",
				"foreignField"	: "_id",
				"as"			: "item_detail"
			}},
			{$group: {
				_id: {
					customer_id		: "$customer_id",
					restaurant_id	: "$restaurant_id",
					branch_id		: "$branch_id"
				},
				cart_ids			: { $push: "$_id" },
				customer_id			: { $first: "$customer_id" },
				branch_id			: { $first: "$branch_id" },
				item_id				: { $push: "$item_id" },
				restaurant_id		: { $first: "$restaurant_id"},
				user_name			: { $first: {$arrayElemAt: ["$user_detail.full_name", 0] } },
				customer_mobile		: { $first: {$arrayElemAt: ["$user_detail.mobile_number", 0] } },
				restaurant_name		: { $first: {$arrayElemAt: ["$restaurant_detail.name", 0] } },
				branch_name			: { $first: {$arrayElemAt: ["$branch_detail.name", 0] } },
				item_name			: { $push: {$arrayElemAt: ["$item_detail.name", 0] } },
			}},
		]).toArray().then(result => {
			if(!result?.length) return {status: Constants.STATUS_SUCCESS};

			const abandoned_carts_reports 	= this.db.collection(Tables.ABANDONED_CARTS_REPORTS);
			asyncEach(result, (records, eachCallback) => {
				abandoned_carts_reports.insertOne({
					customer_mobile	: records.customer_mobile,
					customer_id		: records.customer_id,
					cart_ids		: Helper.arrayToObject(records.cart_ids),
					customer_name	: records.user_name,
					restaurant_name	: records.restaurant_name,
					restaurant_id	: records.restaurant_id,
					branch_name		: records.branch_name,
					item_id			: records.item_id,
					item_name		: records.item_name,
					branch_id		: records.branch_id,
					pn_status		: Constants.SENT,
					order_posting_status: Constants.NOT_ORDERED,
					created			: Helper.getUtcDate(),
				}).then(() => {
					eachCallback(null);
				}).catch(err => {
					eachCallback(err);
				});
			}, (eachErr) => {
				if(eachErr) console.error("Error in each of series at saveAbandonedCartsReport",eachErr);

				return {status: Constants.STATUS_SUCCESS};
			});
		}).catch(err => {
			console.error("Error in saveAbandonedCartsReport",err);

			return {status: Constants.STATUS_SUCCESS};
		});
	};//End saveAbandonedCartsReport()

	/**
	 * Function to save driver petrol consumptions details
	 *
	 * @param req 		As Request Data
	 * @param res 		As Response Data
	 * @param options 	As Object Data
	 *
	 * @return render
	 */
	async saveDriverPetrolConsumption (req, res,next){

		/** Send response to client and work in background */
		res.render('blank',{layout:false});

		let numberOfDays 	   = (req.params.days) ? parseInt(req.params.days) :2;
		let AveragePerKmPetrol = parseFloat(res?.locals?.settings?.['App.average_per_km_petrol'] || 1);

		if(numberOfDays <= 0 || isNaN(numberOfDays)) numberOfDays = 2;

		let hoursInADay   =  numberOfDays*Constants.HOURS_IN_A_DAY;
		let tempStartDate =  Helper.newDate(Helper.subtractDate(hoursInADay));
		let startDate     =  Helper.newDate(tempStartDate,Constants.DATABASE_DATE_FORMAT);
		startDate  	      =  Helper.newDate(startDate+" "+Constants.START_DATE_TIME_FORMAT);
		let endDate  	  =  Helper.newDate(Helper.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));

		const driver_in_out_shifts  	  =  this.db.collection(Tables.DRIVER_IN_OUT_SHIFTS);
		const driver_petrol_consumptions  =  this.db.collection(Tables.DRIVER_PETROL_CONSUMPTIONS);

		/** Get driver in out shift details */
		driver_in_out_shifts.aggregate([
			{$match :{
				created : {$gte: startDate, $lt: endDate}
			}},
			{$lookup:	{
				"from" 			: 	Tables.USERS,
				"localField" 	:	"driver_id",
				"foreignField" 	: 	"_id",
				"as" 			: 	"driver_details"
			}},
			{$addFields : {
				vehicle_type: {$arrayElemAt: ["$driver_details.vehicle_type",0]},
				vehicle_id: {$arrayElemAt: ["$driver_details.vehicle_id",0]}
			}},
			{$group :{
				_id : {
					driver_id : "$driver_id",
					date : { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: Constants.DEFAULT_TIME_ZONE }}
				},
				total_km  	: {$sum   : "$total_km"},
				driver_id 	: {$first : "$driver_id"},
				vehicle_type: {$first : "$vehicle_type"},
				vehicle_id	: {$first : "$vehicle_id"},
				created     : {$first : "$created"}
			}}
		]).toArray().then(result=>{

			if(result && result.length > 0){
				/** Update driver petrol consumption details*/
				asyncEach(result, (records, eachCallback)=> {
					let totalKm = Helper.round(records.total_km);
					let petrolConsumption = Helper.round(totalKm*AveragePerKmPetrol);
					let created			=	records.created;
					let vehicleType		=	records.vehicle_type;
					let vehicleId		=	(records.vehicle_id) ? new ObjectId(records.vehicle_id) : "";
					let createdDate		=  	Helper.newDate(created,Constants.DATABASE_DATE_FORMAT);
					let createdStart	=	Helper.newDate(createdDate+" "+Constants.START_DATE_TIME_FORMAT);
					let createdEnd		=	Helper.newDate(createdDate+" "+Constants.END_DATE_TIME_FORMAT);

					driver_petrol_consumptions.updateOne({
						driver_id : records.driver_id,
						date      : {
							$gte: Helper.newDate(createdStart),
							$lte: Helper.newDate(createdEnd)
						},
					},
					{
						$set : {
							total_km          	: totalKm,
							petrol_consumption	: petrolConsumption,
							vehicle_id			: vehicleId,
							vehicle_type		: vehicleType,
							modified           	: Helper.getUtcDate()
						},
						$setOnInsert : {
							date	: 	records.created,
							created	:	Helper.getUtcDate(),
						}
					},{upsert : true}).then(()=>{
						eachCallback(null);
					}).catch(err=>{
						eachCallback(err);
					});
				},(childEachErr)=>{
					if(childEachErr){
						console.error("Error in saveDriverPetrolConsumption after asyncEach",childEachErr);
					}
				});
			}
		}).catch(err=>{
			console.error("Error in saveDriverPetrolConsumption after aggregate",err);
		});
	};//End saveDriverPetrolConsumption()

	/**
	 * Function to get avaya date from avaya db and put or cravez database
	 *
	 * @param date 		as	Date object
	 * @param format 	as 	Date format
	 *
	 * @return date string
	 */
	async getAvayaData (req,res,next,options){
		return new Promise(resolve=>{
			const connectionConfig = {
				connectionString: 'DSN=avayaodbc',
				connectionTimeout: 10,
				loginTimeout: 10,
			};

			odbc.connect(connectionConfig, (error, connection) => {

				let startDate 	=	Helper.newDate(Helper.subtractDate(Constants.HOURS_IN_A_DAY),Constants.DATABASE_DATE_FORMAT+" "+Constants.START_DATE_TIME_FORMAT);
				let endDate 	= 	Helper.newDate(Helper.subtractDate(Constants.HOURS_IN_A_DAY),Constants.DATABASE_DATE_FORMAT+" "+Constants.END_DATE_TIME_FORMAT);

				asyncParallel({
					i_agent_performance_stat_fetch:(callback)=>{
						if(connection == "") return callback(null,null);

						connection.query("SELECT * FROM iAgentPerformanceStat WHERE Timestamp >= '"+startDate+"' AND Timestamp <= '"+endDate+"'", (error, result) => {
							if(error || result.length <=0) return callback(error, {});
							callback(null, result);
						});
					},
					e_agent_login_stat_fetch:(callback)=>{
						if(connection == "") return callback(null,null);

						connection.query("SELECT * FROM eAgentLoginStat WHERE Timestamp >= '"+startDate+"' AND Timestamp <= '"+endDate+"'", (error, result) => {
							if(error || result.length <=0) return callback(error, {});
							callback(null, result);
						});
					},
					i_activity_code_stat_fetch:(callback)=>{
						if(connection == "") return callback(null,null);

						connection.query("SELECT * FROM iActivityCodeStat WHERE Timestamp >= '"+startDate+"' AND Timestamp <= '"+endDate+"'", (error, result) => {
							if(error || result.length <=0) return callback(error, {});
							callback(null, result);
						});
					},
				},(asyncErr, asyncResponse)=>{
					if(asyncErr) {
						console.error("Error in asyncEach of series at getAvayaData",asyncErr);
					}

					let iAgentPerformanceStatFetch 	= (asyncResponse.i_agent_performance_stat_fetch) ? asyncResponse.i_agent_performance_stat_fetch:{};
					let eAgentLoginStatFetch	 	= (asyncResponse.e_agent_login_stat_fetch) ?asyncResponse.e_agent_login_stat_fetch:{};
					let iActivityCodeStatFetch 	 	= (asyncResponse.i_activity_code_stat_fetch) ?asyncResponse.i_activity_code_stat_fetch:{};

					asyncParallel({
						i_agent_performance_stat_insert:(childCallback)=>{
							if(Object.keys(iAgentPerformanceStatFetch).length <=0) return childCallback(null, null);

							const iAgentPerformanceStat = this.db.collection(Tables.IAGENTPERFORMANCESTAT);
							iAgentPerformanceStat.insertMany(iAgentPerformanceStatFetch).then(()=>{
								childCallback(null);
							}).catch(()=>{
								childCallback(null);
							});
						},
						e_agent_login_stat_insert:(childCallback)=>{
							if(Object.keys(eAgentLoginStatFetch).length <=0) return childCallback(null, null);

							const eAgentLoginStat = this.db.collection(Tables.EAGENTLOGINSTAT);
							eAgentLoginStat.insertMany(eAgentLoginStatFetch).then(()=>{
								childCallback(null);
							}).catch(()=>{
								childCallback(null);
							});
						},
						i_activity_code_stat_insert:(childCallback)=>{
							if(Object.keys(iActivityCodeStatFetch).length <=0) return childCallback(null, null);

							const iActivityCodeStat = this.db.collection(Tables.IACTIVITYCODESTAT);
							iActivityCodeStat.insertMany(iActivityCodeStatFetch).then(()=>{
								childCallback(null);
							}).catch(()=>{
								childCallback(null);
							});
						},
					},(childAsyncErr, childAsyncResponse)=>{
						if(childAsyncErr) {
							console.error("Error in asyncEach of series at getAvayaData",childAsyncErr);
						}

						resolve({status : Constants.STATUS_SUCCESS});
					});
				});
			});
		});
	};// End getAvayaData

	/**
	 * Function to get bulk avaya data
	 *
	 *
	 * @param req 		As Request Data
	 * @param res 		As Response Data
	 * @param options 	As Object Data
	 *
	 * @return render
	*/
	async getBulkAvayaData (req, res,next){
		try {
			/** Send response to client and work in background */
			res.render('blank',{layout:false});

			const connectionConfig = {
				connectionString: 'DSN=Avaya',
				connectionTimeout: 10,
				loginTimeout: 10,
			}
			odbc.connect(connectionConfig, (error, connection) => {
				var getDataInterval = null;
				var daysHours	=	totalDays*24;
				var subtractHoursTimestamp = daysHours * 60 * 60 * 1000;
				now 	= new Date(Date.now() - subtractHoursTimestamp);
				var dates = [],
				currentDate = now,
				toDate 		= new Date(),
				addDays = function(days) {
					var date = new Date(this.valueOf());
					date.setDate(date.getDate() + days);
					return date;
				};

				while (currentDate <= toDate) {
					dates.push(currentDate);
					currentDate = addDays.call(currentDate, 1);
				}
				getDataInterval = setInterval(function(){
					var totalPushDate = 2;
					var items = dates.splice(0, totalPushDate);
					if(dates.length == 0) clearInterval(getDataInterval);
					var options	=	{
						'dates':items,
						'connection':connection,
					}

					this.getAvayaData(req, res,next,options).then(returnValue=>{
						res.send({
							"status":Constants.STATUS_SUCCESS
						});
					});
				},10000);
			});
		} catch (error) {
			console.error("Catch error in getBulkAvayaData",error);
		}
	};//End getBulkAvayaData()

	/**
	 * Function to send pn to customer for order delayed voc
	 *
	 * @param req 		As Request Data
	 * @param res 		As Response Data
	 * @param options 	As Object Data
	 *
	 * @return render
	 */
	async sendAutomaticOrdersVocPN (req, res,next){
		try{
			/** Send response to client and work in backgHelper.round */
			res.render('blank',{layout:false});

			const orders  =  this.db.collection(Tables.ORDERS);
			let bufferTime=  parseInt(res?.locals?.settings?.['Site.delay_voc_pn_buffer'] || 0);

			let dateObj 	=	new Date();
			dateObj.setDate(dateObj.getDate() - 1);
			let startDate 	=	Helper.newDate(dateObj,Constants.CURRENTDATE_START_DATE_FORMAT);

			/** Get order list */
			let result = await orders.aggregate([
				{$match :{
					order_date 	        : {$gte: Helper.newDate(startDate)},
					delay_voc_status 	: {$exists : false},
					is_delayed			: true,
					admin_status 		: {$nin : [Constants.ORDER_DELIVERED,Constants.ORDER_CANCELLED,Constants.ORDER_REJECTED,Constants.ORDER_REJECTED_BY_ADMIN]},
					delivery_type 		: {$in :[Constants.DELIVERY_BY_CRAVEZ,Constants.DELIVERY_BY_RESTAURANT]}
				}},
				{$lookup:	{
					"from" 			: 	Tables.ORDER_DETAILS,
					"localField" 	:	"_id",
					"foreignField" 	: 	"order_id",
					"as" 			: 	"order_detials"
				}},
				{$project : {
					_id: 1,unique_order_id :1,customer_id :1, order_date : 1,restaurant_name:1,
					delivery_duration: {$arrayElemAt: ["$order_detials.delivery_duration",0]},
				}},
			]).toArray();

			if(result && result.length > 0){
				/** Update driver wise orders*/
				asyncEach(result, (records, eachCallback)=> {
					let orderDate			= records.order_date;
					let deliveryDuration	= (records.delivery_duration) ? parseInt(records.delivery_duration) : 0;
					let totalAllowedTime	= (deliveryDuration+bufferTime)/Constants.MINUTES_IN_A_HOUR;
					let finalDate			= Helper.addDaysToDate(totalAllowedTime,orderDate);

					if(finalDate <= Helper.newDate()){
						orders.updateOne({
							_id : new ObjectId(records._id),
						},
						{$set : {
							delay_voc_status: Constants.PENDING,
							voc_sent_time	: Helper.getUtcDate(),
						}}).then(()=>{
							eachCallback(null);

							/** Notification to customer for order delay voc */
								services.insertNotifications(req,res,{
									notification_data : {
										notification_type 	: 	Constants.NOTIFICATION_ORDER_DELAY_VOC_PN,
										message_params 		: 	[records?.restaurant_name?.[Constants.DEFAULT_LANGUAGE_CODE] || ""],
										parent_table_id 	: 	records._id,
										user_ids 			: 	[records.customer_id],
										role_id 			: 	Constants.CUSTOMER,
										extra_parameters 	:	{
											user_id : new ObjectId(records.customer_id)
										}
									}
								});
							/*************** Send approval request to admin  ***************/
						}).catch((err)=>{
							eachCallback(err);
						});
					}else{
						eachCallback(null);
					}
				},(childEachErr)=>{
					if(childEachErr){
						console.error("Error in sendAutomaticOrdersVocPN");
						return console.error(childEachErr);
					}
				});
			}
		} catch (error) {
			console.error("Error in sendAutomaticOrdersVocPN",error);
		}
	};//End sendAutomaticOrdersVocPN()

	/**
	 * Function to send pn to driver and cravez for driver not join the shift
	 *
	 * @param req 		As Request Data
	 * @param res 		As Response Data
	 * @param options 	As Object Data
	 *
	 * @return render
	 */
	async sendShiftJoinPN (req, res,next){
		/** Send response to client and work in background */
		res.render('blank',{layout:false});

		const shifts				= this.db.collection(Tables.SHIFTS);
		const users					= this.db.collection(Tables.USERS);
		const driver_in_out_shifts  = this.db.collection(Tables.DRIVER_IN_OUT_SHIFTS);

		let bufferTime		= parseInt(res?.locals?.settings?.['Site.shift_not_join_pn_waiting'] || 0);
		let checkTime 		= Helper.subtractMinute(bufferTime);
		let lowerCheckTime 	= Helper.subtractMinute(bufferTime+Constants.MINUTES_IN_A_HOUR);
		let finalTime		= parseFloat(Helper.newDate(checkTime,Constants.TIME_FORMAT));
		let lowerTime		= parseFloat(Helper.newDate(lowerCheckTime,Constants.TIME_FORMAT));

		let createdDate		=  	Helper.newDate("",Constants.DATABASE_DATE_FORMAT);
		let createdStart	=	Helper.newDate(createdDate+" "+Constants.START_DATE_TIME_FORMAT);
		let createdEnd		=	Helper.newDate(createdDate+" "+Constants.END_DATE_TIME_FORMAT);

		/** Get driver in out shift details */
		shifts.aggregate([
			{$match : {
				$or : [
					{pn_sent_time : {$exists : false}},
					{pn_sent_time : {$lte : createdStart}},
				],
				start_time 	:	{$lte : finalTime,$gte : lowerTime},
				is_deleted	: 	{$ne: Constants.DELETED}
			}},
			{$lookup:	{
				from     : Tables.DRIVER_AVAILABILITIES,
				let      : {shiftId : "$_id"},
				pipeline : [
					{$match : {
						date: {$gte: createdStart, $lte: createdEnd},
						$expr: {
							$and : [
								{$eq: ["$shift_id","$$shiftId"]},
							]
						},
					}},
				],
				as	:	"assigned_drivers"
			}},
			{$unwind: "$assigned_drivers" },
			{$group : {
				_id: "$_id",
				start_time :{$first : "$start_time"},
				shift_name :{$first : "$shift_name"},
				assigned_drivers: { $push:  "$assigned_drivers.user_id"},
			}},
		]).toArray().then(result=>{

			if(result && result.length > 0){
				/** Update driver wise orders*/
				asyncEach(result, (shift, eachCallback)=> {
					if(!shift.assigned_drivers || shift.assigned_drivers.length == 0) return eachCallback(null);

					asyncParallel({
						update_shift : (childCallback)=>{
							shifts.updateOne({_id : new ObjectId(shift._id)},{$set : {pn_sent_time : Helper.getUtcDate()}}).then(()=>{
								childCallback(null,null);
							}).catch(err=>{
								childCallback(err,null);
							});
						},
						joined_captains : (childCallback)=>{
							driver_in_out_shifts.distinct("driver_id",{
								created    : {$gte : createdStart,$lte : createdEnd},
								driver_id  : {$in : Helper.arrayToObject(shift.assigned_drivers)}
							}).then(joinedDriverIds=>{
								childCallback(null,joinedDriverIds);
							}).catch(err=>{
								childCallback(err,null);
							});
						},
					},(asyncErr,asyncResponse)=>{
						if(asyncErr) return eachCallback(asyncErr);

						let driverCondition = {
							_id : {$in : Helper.arrayToObject(shift.assigned_drivers || [])},
							...clone(Constants.DRIVER_COMMON_CONDITIONS),
						}
						driverCondition["$and"]	= [
							{_id : {$nin : Helper.arrayToObject(asyncResponse?.joined_captains || [])}},
						];

						users.find(driverCondition,{projection:{_id:1,full_name:1,user_role_id:1}}).toArray().then(driverList=>{

							eachCallback(null);

							driverList.map(driver=>{
								if(!driver._id) return;

								/** Notification to driver to join shift and admin */
									let shiftTime = String(shift.start_time).replace(".",":");
									services.insertNotifications(req,res,{
										notification_data : {
											notification_type 	: 	Constants.NOTIFICATION_SHIFT_NOT_JOIN_PN_DRIVER,
											message_params 		: 	[shift.shift_name,shiftTime],
											parent_table_id 	: 	new ObjectId(shift._id),
											user_ids 			: 	[driver._id],
											role_id 			: 	driver.user_role_id,
											extra_parameters 	:	{
												driver_id : new ObjectId(driver._id),
												shift_name: shift.shift_name
											}
										}
									});

									/** Send Pn To Admin*/
									services.insertNotifications(req,res,{
										notification_data : {
											notification_type 	: 	Constants.NOTIFICATION_SHIFT_NOT_JOIN_PN_CRAVEZ,
											message_params 		: 	[driver.full_name,shift.shift_name],
											parent_table_id 	: 	new ObjectId(shift._id),
											user_id 		    : 	new ObjectId(driver._id),
											user_role_id 		: 	driver.user_role_id,
											role_id 			: 	[Constants.CRAVEZ,Constants.FLEET],
											only_for_user_role	:	true,
											extra_parameters 	:	{
												driver_id : new ObjectId(driver._id),
											}
										}
									});
								/*************** Notification to driver to join shift and admin  ***************/
							});
						}).catch(err=>{
							eachCallback(err);
						});
					});
				},(childEachErr)=>{
					if(childEachErr){
						console.error("Error in sendShiftJoinPN after asyncEach",childEachErr);
					}
				});
			}
		}).catch(err=>{
			console.error("Error in sendShiftJoinPN after aggregate",err);
		});
	};//End sendShiftJoinPN()

	/**
	 * Function to write settings file
	 *
	 *
	 * @param req 		As Request Data
	 * @param res 		As Response Data
	 * @param options 	As Object Data
	 *
	 * @return render
	*/
	async writeSettingsFile (req, res,next){
		try {
			/** Send response to client and work in background */
			res.render('blank',{layout:false});

			const settings 	= this.db.collection(Tables.SETTINGS);
			let result = await settings.find({},{projection: {_id:1,key_value:1,value:1}}).toArray();
			if(result && result.length > 0){
				let settingsObj = {};
				result.map(record=>{
					let settingKey 		=	(record.key_value)	?	record.key_value	:"";
					let settingValue	= 	(record.value)		?	record.value		:"";

						settingKey 		= 	settingKey.replace(/"/g,'\\"');
						settingKey 		=	settingKey.replace(/'/g,"\\'");
						settingValue 	= 	settingValue.replace(/"/g,'\\"');
						settingValue 	= 	settingValue.replace(/'/g,"\\'");

					settingsObj[settingKey] = settingValue;
				});

				writeFile(Constants.WEBSITE_ROOT_PATH+"config/settings.json", JSON.stringify(settingsObj), "utf8",function(err){});

				setTimeout(function(){
					if (typeof myCache !== 'undefined') {
						myCache.del( "settings");
					}
				},5000);
			}
		} catch (error) {
			console.error("Catch error in writeSettingsFile",error);
		}
	};//End writeSettingsFile()

	/**
	 * Function to auto end or cancel driver break
	 *
	 * @param req 		As Request Data
	 * @param res 		As Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render
	*/
	async autoEndBreak (req, res,next){
		/** Send response to client and work in background */
		res.render('blank',{layout:false});

		let currentDate 	=	Helper.newDate(Helper.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));
		let currentTime		= 	parseFloat(Helper.newDate("",Constants.EXCUSES_TIME_FORMAT));
		const driver_breaks =	this.db.collection(Tables.DRIVER_BREAKS);
		asyncParallel({
			driver_breaks : (callback)=>{
				/** Get driver breaks list */
				driver_breaks.find({
					date         : 	{$gte: currentDate},
					status 		 : 	Constants.APPROVED,
					is_completed :	false,
					end_time	 :	{$lte: currentTime},
				}).toArray().then(breakResult=>{
					callback(null,breakResult);
				}).catch(err=>{
					callback(err,[]);
				});
			},
		},(asyncErr,asyncResponse)=>{
			if(asyncErr){
				console.error("Parallel error in autoEndBreak",asyncErr);
			}

			if(asyncResponse?.driver_breaks?.length >0){
				asyncEach(asyncResponse?.driver_breaks,(records, eachCallback)=>{
					let breakId  	= 	records._id;
					let driverId  	= 	records.driver_id;
					let startTime 	=	(records.start_time)? String(Helper.set24HourFormat(records.start_time)).replace('.',':') :"";
					let endTime 	=	Helper.newDate("",Constants.BREAK_TIME_FORMAT);
					let breakStart	=	Helper.newDate(Helper.newDate("",Constants.DATABASE_DATE_FORMAT+' '+startTime));
					let breakEnd	= 	Helper.newDate(Helper.newDate("",Constants.DATABASE_DATE_FORMAT+' '+endTime));
					let difference	= 	Math.ceil((breakEnd - breakStart)/Constants.MILLISECONDS_IN_A_SECOND);
					endTime 		=	parseFloat(endTime.replace(':','.'));
					let endTimeStamp=	Helper.newDate().getTime();

					/** Update driver breaks details */
					driver_breaks.updateOne({
						_id 	 	 :	breakId,
						driver_id 	 :	driverId,
						is_completed : 	false,
						status		 : 	Constants.APPROVED,
						date         : 	{$gte: currentDate}
					},
					{$set: {
						is_completed : 	true,
						end_time     : 	endTime,
						end_timestamp:	endTimeStamp,
						elapsed_time :	difference,
						ia_auto_end  :	Helper.getUtcDate(),
						modified	 :	Helper.getUtcDate()
					}}).then(()=>{

						/*************** Send Mail  ***************/
							services.sendMailToUsers(req,res,{
								event_type 		:	Constants.DRIVER_BREAK_REQUEST_ENDED_EMAIL_EVENTS,
								break_id		: 	breakId,
								user_id			: 	driverId,
							});
						/*************** Send Mail  ***************/

						/** Save driver status logs */
							services.saveDriverStatusLogs(req,res,next,{
								parent_id 	: 	breakId,
								driver_id 	: 	driverId,
								type	  	: 	'driver_breaks',
								event_type	: 	Constants.END_BREAK,
								end_time	: 	endTime,
								duration	:	records?.duration || 0
							}).then(()=>{});

						/*************** Send Mail  ***************/
							services.sendMailToUsers(req,res,{
								event_type 		: 	Constants.DRIVER_BREAK_END_EMAIL_EVENTS,
								break_id		: 	breakId,
								user_id			: 	driverId,
								break_details	:	records
							});
						/*************** Send Mail  ***************/

						eachCallback(null);
					}).catch(err=>{
						eachCallback(err);
					});
				},(eachErr)=>{
					if(eachErr){
						console.error("Each error in autoEndBreak",eachErr);
					}
				});
			}
		});
	};//End autoEndBreak()

	/**
	 * Function to save operation reports
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return render
	 */
	async saveOperationReport (req, res,next){
		try {
			/** Send response to client and work in background */
			res.render('blank', { layout: false });

			/** Get number of days */
			let numberOfDays  = (req.params.days) ? parseInt(req.params.days) :2;
			if(numberOfDays	 <= 0 || isNaN(numberOfDays)) numberOfDays = 2;

			/** Get start and end date */
			let hoursInADay   =  numberOfDays*Constants.HOURS_IN_A_DAY;
			let tempStartDate =  Helper.newDate(Helper.subtractDate(hoursInADay));
			let startDate     =  Helper.newDate(tempStartDate,Constants.DATABASE_DATE_FORMAT);
			startDate  	      =  Helper.newDate(startDate+" "+Constants.START_DATE_TIME_FORMAT);
			let endDate  	  =  Helper.newDate(Helper.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));

			const orders  	  		= this.db.collection(Tables.ORDERS);
			const operation_reports	= this.db.collection(Tables.OPERATION_REPORTS);
			let datesArray	  		= Helper.getDateRange(startDate,endDate);
			eachOfSeries(datesArray,(tmpDate, key,seariesCallback)=>{
				let tmpCurrentDate	= Helper.newDate(tmpDate,Constants.DATABASE_DATE_FORMAT);
				let tmpStartDate	= Helper.newDate(tmpCurrentDate+" "+Constants.START_DATE_TIME_FORMAT);
				let tmpEndDate		= Helper.newDate(tmpCurrentDate+" "+Constants.END_DATE_TIME_FORMAT);

				orders.aggregate([
					{$match :{
						order_date 	: {$gte: tmpStartDate, $lt: tmpEndDate},
						is_completed: true,
					}},
					{$group : {
						_id : {
							branch_id	: "$branch_id",
							date 		: { $dateToString: {format: "%Y-%m-%d",date: "$order_date",timezone: Constants.DEFAULT_TIME_ZONE}}
						},
						branch_id 		: {$first : "$branch_id"},
						restaurant_id	: {$first : "$restaurant_id"},
						restaurant_name : {$first : "$restaurant_name"},
						order_date   	: {$first : "$order_date"},
						total_orders	: {$sum : 1},
						total_amount	: {$sum : "$order_price"},
						transmission_time: {$sum : "$transmission_time"},
						branch_transmission_time: {$sum : "$branch_transmission_time"},
						contacted_orders: {$sum: {
							$cond: [
								{$and : [ { $eq: [  "$ticketing", true]}]},
								1,
								0
							]
						}},
						delivered_orders: {$sum: {
							$cond: [
								{$and : [ { $eq: [  "$admin_status", Constants.ORDER_DELIVERED]}]},
								1,
								0
							]
						}},
						sales	: {$sum: {
							$cond: [
								{$and : [ { $eq: [  "$admin_status", Constants.ORDER_DELIVERED]}]},
								"$order_price",
								0
							]
						}},
						cancelled_orders: {$sum: {
							$cond: [
								{$and : [ { $eq: [  "$admin_status", Constants.ORDER_CANCELLED]}]},
								1,
								0
							]
						}},
						manual_transmission: {$sum: {
							$cond: [
								{$or : [
									{ $eq: [  "$admin_status", Constants.ORDER_CANCELLED]},
									{ $eq: [  "$is_modified", true]}
								]},
								1,
								0
							]
						}},
						rejected_orders: {$sum: {
							$cond: [{$or : [
								{$eq: ["$admin_status",Constants.ORDER_REJECTED]},
								{ $eq: ["$admin_status", Constants.ORDER_REJECTED_BY_ADMIN]},
							]},1,0]
						}},
						lost_revenue: {
							$sum: {
								$cond: [
									{
										$or: [
											{ $eq: ["$admin_status", Constants.ORDER_CANCELLED] },
											{ $eq: ["$admin_status", Constants.ORDER_REJECTED] },
											{ $eq: ["$admin_status", Constants.ORDER_REJECTED_BY_ADMIN] }
										]

									},
									"$order_price",
									0
								]
							}
						},
						tt_less_than_3: {$sum: {
							$cond: [{$and : [ { $gte: ["$transmission_time",0]},{ $lt: ["$transmission_time",3]}]},1,0]
						}},
						tt_3_to_5: {$sum: {
							$cond: [{$and : [{ $gte: ["$transmission_time",3]},{ $lt: [ "$transmission_time",5]}]},1,0]
						}},
						tt_5_to_7: {$sum: {
							$cond: [{$and : [{ $gte: ["$transmission_time",5]},{ $lt: [ "$transmission_time",7]}]},1,0]
						}},
						tt_7_to_10: {$sum: {
							$cond: [{$and : [{ $gte: ["$transmission_time",7]},{ $lt: ["$transmission_time",10]}]},1,0]
						}},
						tt_more_than_10: {$sum: {
							$cond: [{$and : [{ $gte: ["$transmission_time", 10]}]},1,0]
						}},
					}}
				]).toArray().then(result=>{
					if(result.length <=0) return seariesCallback(null);

					/** Update driver wise orders*/
					asyncEach(result, (records, eachCallback)=> {
						let created			=	records.order_date;
						let createdDate		=  	Helper.newDate(created,Constants.DATABASE_DATE_FORMAT);
						let createdStart	=	Helper.newDate(createdDate+" "+Constants.START_DATE_TIME_FORMAT);
						let createdEnd		=	Helper.newDate(createdDate+" "+Constants.END_DATE_TIME_FORMAT);

						operation_reports.updateOne({
							branch_id : new ObjectId(records.branch_id),
							date      : {
								$gte: Helper.newDate(createdStart),
								$lte: Helper.newDate(createdEnd)
							},
						},
						{
							$set : {
								total_orders	: (records.total_orders) 	? parseInt(records.total_orders) : 0,
								restaurant_id	: (records.restaurant_id) 	? new ObjectId(records.restaurant_id) : "",
								restaurant_name	: records.restaurant_name,
								branch_transmission_time: Helper.round(records.branch_transmission_time),
								transmission_time: Helper.round(records.transmission_time),
								cancelled_orders: parseInt(records.cancelled_orders),
								rejected_orders : parseInt(records.rejected_orders),
								contacted_orders: parseInt(records.contacted_orders),
								delivered_orders: parseInt(records.delivered_orders),
								manual_transmission: parseInt(records.manual_transmission),
								tt_less_than_3	: parseInt(records.tt_less_than_3),
								tt_3_to_5		: parseInt(records.tt_3_to_5),
								tt_5_to_7		: parseInt(records.tt_5_to_7),
								tt_7_to_10		: parseInt(records.tt_7_to_10),
								tt_more_than_10	: parseInt(records.tt_more_than_10),
								sales			: Helper.round(records.sales,Constants.CURRENCY_ROUND_PRECISION),
								lost_revenue	: Helper.round(records.lost_revenue,Constants.CURRENCY_ROUND_PRECISION),
								total_amount	: (records.total_amount) ? Helper.round(records.total_amount,Constants.CURRENCY_ROUND_PRECISION) : 0,
							},
							$setOnInsert : {
								date	: records.order_date,
								created	: Helper.getUtcDate(),
							}
						},{upsert : true}).then(()=>{
							eachCallback(null);
						}).catch(err=>{
							eachCallback(err);
						});
					},(childEachErr)=>{
						seariesCallback(childEachErr);
					});
				}).catch(err=>{
					seariesCallback(err);
				});
			},(eachErr)=>{
				if(eachErr){
					console.error("Error at eachErr in saveOperationReport",eachErr);
				}
			});
		} catch (error) {
			console.error("Error in saveOperationReport",error);
		}
	};//End saveOperationReport()

	/**
	 * Function to save customer breakdown reports
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return render
	 */
	async saveCustomerBreakdownReport (req, res,next){
		try {
			/** Send response to client and work in background */
			res.render('blank', { layout: false });

			/** Get current year, month and date */
			let currentYear		= Helper.newDate().getFullYear();
			let currentMonth 	= Helper.newDate().getMonth()+1;
			let currentDate 	= Helper.newDate().getDate();
			let reportYear		= (req.params.year) ? parseInt(req.params.year)   : currentYear;
			let reportMonth		= (req.params.month) ? parseInt(req.params.month) : currentMonth;

			let reportStartDate	= (reportMonth == 1 && currentMonth==1 && currentDate == 1) ? (reportYear -1)+"-"+12+"-01" : reportYear+"-"+reportMonth+"-01";
			let reportEndDate	= reportYear+"-"+reportMonth+"-31";
			let startDate		= Helper.newDate(reportStartDate+" "+Constants.START_DATE_TIME_FORMAT);
			let endDate			= Helper.newDate(reportEndDate+" "+Constants.END_DATE_TIME_FORMAT);

			const users		= this.db.collection(Tables.USERS);
			const orders	= this.db.collection(Tables.ORDERS);
			let cusomersConditions		= clone(Constants.CUSTOMER_COMMON_CONDITIONS);
			cusomersConditions.created	= {$gte: startDate, $lt: endDate};

			let customerIds = await users.distinct("_id",cusomersConditions);

			asyncParallel({
				customer_without_order:(callback)=>{
					orders.aggregate([
						{$match : {
							order_date 	: {$gte: startDate, $lt: endDate},
							customer_id : {$in : customerIds},
							admin_status: Constants.ORDER_DELIVERED
						}},
						{$group : {
							_id : "$customer_id",
						}},
					]).toArray().then(result=>{

						let registredUsers	= customerIds.length;
						let orderedCustomer	= result.length;
						let dataArray = [{
							_id		: reportYear+'-'+reportMonth,
							year 	: reportYear,
							month 	: reportMonth,
							count 	: (registredUsers-orderedCustomer),
						}];
						callback(null,dataArray);
					}).catch(err=>{
						callback(err);
					});
				},
				multi_order_customer:(callback)=>{
					orders.aggregate([
						{$match : {
							order_date 	: {$gte: startDate, $lt: endDate},
							customer_id : {$in : customerIds},
							admin_status : Constants.ORDER_DELIVERED,
						}},
						{$group : {
							_id : "$customer_id",
							count : {$sum : 1},
						}},
						{$match : {count :{$gt : 1}}},
					]).toArray().then(result=>{
						let orderedCustomer	= result.length;
						let dataArray = [{
							_id		: reportYear+'-'+reportMonth,
							year	: reportYear,
							month	: reportMonth,
							count	: orderedCustomer,
						}];
						callback(null,dataArray);
					}).catch(err=>{
						callback(err);
					});
				},
				repeating_customers :(callback)=>{
					orders.aggregate([
						{$match : {
							order_date 	: {$gte: startDate, $lt: endDate},
							admin_status : Constants.ORDER_DELIVERED
						}},
						{$addFields : {
							year 		: {$year: "$order_date" },
							year_month	: { $dateToString: { format: "%Y-%m", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE }}
						}},
						{$group : {
							_id : {
								year_month : "$year_month",
								customer_id : "$customer_id"
							},
							year_month  : {$first : "$year_month"},
							year  		: {$first : { "$year": "$order_date"}},
							month 		: {$first : { "$month": "$order_date"}},
							order_count : {$sum : 1},
						}},
						{$match : {order_count :{$gt : 1}}},
						{$group : {
							_id 	: "$year_month",
							year  	: {$first : "$year"},
							month 	: {$first : "$month"},
							count 	: {$sum : 1},
						}},
					]).toArray().then(result=>{
						callback(null,result);
					}).catch(err=>{
						callback(err);
					});
				},
				winback_customers :(callback)=>{
					let orderCutoffdate	= Helper.newDate(reportYear+"-"+(reportMonth - 6)+"-01");
					switch(reportMonth){
						case 6:
							orderCutoffdate	= Helper.newDate((reportYear-1)+"-12-01");
						break;
						case 5:
							orderCutoffdate	= Helper.newDate((reportYear-1)+"-11-01");
						break;
						case 4:
							orderCutoffdate	= Helper.newDate((reportYear-1)+"-10-01");
						break;
						case 3:
							orderCutoffdate	= Helper.newDate((reportYear-1)+"-9-01");
						break;
						case 2:
							orderCutoffdate	= Helper.newDate((reportYear-1)+"-8-01");
						break;
						case 1:
							orderCutoffdate	= Helper.newDate((reportYear-1)+"-7-01");
						break;
					}

					orders.aggregate([
						{$match : {
							order_date : {$gte: orderCutoffdate, $lt: endDate},
							admin_status: Constants.ORDER_DELIVERED,
						}},
						{$addFields : {
							year_month	: { $dateToString: { format: "%Y-%m", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE }}
						}},
						{$group : {
							_id : {
								year_month : "$year_month",
							},
							customer_ids: {$addToSet : "$customer_id"},
							year_month  : {$first : "$year_month"},
							year  		: {$first : { "$year": "$order_date"}},
							month 		: {$first : { "$month": "$order_date"}},
						}},
						{$sort : {year_month : Constants.SORT_ASC}}
					],{ allowDiskUse: true}).toArray().then(result=>{

						let customerLists = {};
						result.map(record=>{
							customerLists[record.year_month] = record.customer_ids.map(rec=>{ return String(rec)});
						});
						let winbackUsers = {};
						result.map(record=>{
							let currentYearMonth	= record.year_month;
							let lastMonth			= (record.month-1) < 10 ? "0"+(record.month-1) : record.month-1;
							let lastYearMonth		= (record.month == 1 ? (record.year-1) : record.year)+"-"+lastMonth;
							let reportStartDate		= reportYear+"-"+reportMonth+"-01";
							if(record.year == reportYear && record.month == reportMonth){
								if(!winbackUsers[currentYearMonth]) winbackUsers[currentYearMonth] = {month : record.month,year : record.year,customers : []};

								record.customer_ids.map(cid=>{
									if(!customerLists[lastYearMonth] || ( customerLists[lastYearMonth] && customerLists[lastYearMonth].indexOf(String(cid))) == -1){
										let orderInSixMonth  = false;
										let tmpReportYear	 = reportYear;
										for(i=2; i<= 6; i++){
											let prevMonth	= (record.month-i) < 10 ? "0"+(record.month-i) : record.month-i;
											let prevYearMonth= tmpReportYear+"-"+prevMonth;
											if(prevMonth == "01") tmpReportYear--;

											if(customerLists[prevYearMonth] && customerLists[prevYearMonth].indexOf(String(cid)) != -1){
												orderInSixMonth = true;
											}
										}
										if(orderInSixMonth) winbackUsers[currentYearMonth].customers.push(String(cid));
									}
								});
							}
						});
						callback(null,Object.values(winbackUsers));
					}).catch(err=>{
						callback(err);
					});
				},
			},(err, response)=>{


				let yearWiseData 	= {};
				response?.customer_without_order?.map(record=>{
					let tmpKey	= record.year+"-"+record.month;
					let tmpDate = Helper.getUtcDate(record.year+"-"+record.month+"-01 00:00:00");
					if(!yearWiseData[tmpKey]) yearWiseData[tmpKey] = {};
					yearWiseData[tmpKey]["year"]	= record.year;
					yearWiseData[tmpKey]["month"]	= record.month;
					yearWiseData[tmpKey]["date"]	= tmpDate;
					yearWiseData[tmpKey]["customer_without_order"] = record.count;
				});
				response?.multi_order_customer?.map(record=>{
					let tmpKey	= record.year+"-"+record.month;
					let tmpDate = Helper.getUtcDate(record.year+"-"+record.month+"-01 00:00:00");
					if(!yearWiseData[tmpKey]) yearWiseData[tmpKey] = {};
					yearWiseData[tmpKey]["year"]	= record.year;
					yearWiseData[tmpKey]["month"]	= record.month;
					yearWiseData[tmpKey]["date"]	= tmpDate;
					yearWiseData[tmpKey]["multi_order_customer"] = record.count;
				});

				response?.repeating_customers?.map(record=>{
					let tmpKey	= record.year+"-"+record.month;
					let tmpDate = Helper.getUtcDate(record.year+"-"+record.month+"-01 00:00:00");
					if(!yearWiseData[tmpKey]) yearWiseData[tmpKey] = {};
					yearWiseData[tmpKey]["year"]	= record.year;
					yearWiseData[tmpKey]["month"]	= record.month;
					yearWiseData[tmpKey]["date"]	= tmpDate;
					yearWiseData[tmpKey]["repeating_customers"] = record.count;
				});
				response?.winback_customers?.map(record=>{
					let tmpKey	= record.year+"-"+record.month;
					let tmpDate = Helper.getUtcDate(record.year+"-"+record.month+"-01 00:00:00");
					if(!yearWiseData[tmpKey]) yearWiseData[tmpKey] = {};
					yearWiseData[tmpKey]["year"]	= record.year;
					yearWiseData[tmpKey]["month"]	= record.month;
					yearWiseData[tmpKey]["date"]	= tmpDate;
					yearWiseData[tmpKey]["winback_customers"] = record.customers.length;
				});

				const monthly_customer_breakdown = this.db.collection(Tables.MONTHLY_CUSTOMER_BREAKDOWN);
				asyncForEachOf(yearWiseData, (records, key, childEachCallback)=> {
					if(!records.customer_without_order)	records.customer_without_order	= 0;
					if(!records.multi_order_customer)	records.multi_order_customer	= 0;
					if(!records.repeating_customers)	records.repeating_customers		= 0;
					if(!records.winback_customers)		records.winback_customers		= 0;
					;
					monthly_customer_breakdown.updateOne({
						year_month : key
					},
					{
						$set : records,
						$setOnInsert : {created : Helper.getUtcDate()}
					},{upsert : true}).then(()=>{
						childEachCallback(null);
					}).catch(err=>{
						childEachCallback(err);
					});
				},(err)=>{
					if(err) console.error("Error in saveCustomerBreakdownReport",err);
				});
			});
		} catch (error) {
			console.error("Error in saveCustomerBreakdownReport",error);
		}
	};//End saveCustomerBreakdownReport()

	/**
	 * Function to save average basket size reports
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return render
	 */
	async saveAverageBasketSizeReport (req, res, next) {
		/** Send response to client and work in background */
		res.render('blank', { layout: false });

		let numberOfDays = (req.params.days) ? parseInt(req.params.days) : 2;
		if (numberOfDays <= 0 || isNaN(numberOfDays)) numberOfDays = 2;

		let hoursInADay 	= numberOfDays * Constants.HOURS_IN_A_DAY;
		let tempStartDate 	= Helper.newDate(Helper.subtractDate(hoursInADay));
		let startDate 		= Helper.newDate(tempStartDate, Constants.DATABASE_DATE_FORMAT);
		startDate 			= Helper.newDate(startDate + " " + Constants.START_DATE_TIME_FORMAT);
		let endDate 		= Helper.newDate(Helper.newDate("", Constants.CURRENTDATE_START_DATE_FORMAT));

		const orders 					= this.db.collection(Tables.ORDERS);
		const order_items 				= this.db.collection(Tables.ORDER_ITEMS);
		const avg_basket_size_reports 	= this.db.collection(Tables.AVG_BASKET_SIZE_REPORTS);

		let datesArray = Helper.getDateRange(startDate, endDate);
		eachOfSeries(datesArray, (tmpDate, key, seariesCallback) => {
			let tmpCurrentDate = Helper.newDate(tmpDate, Constants.DATABASE_DATE_FORMAT);
			let tmpStartDate = Helper.newDate(tmpCurrentDate + " " + Constants.START_DATE_TIME_FORMAT);
			let tmpEndDate = Helper.newDate(tmpCurrentDate + " " + Constants.END_DATE_TIME_FORMAT);

			orders.aggregate([
				{$match: {
					order_date	: { $gte: tmpStartDate, $lt: tmpEndDate },
					admin_status: Constants.ORDER_DELIVERED
				}},
				{$project: {_id: 1, admin_status: 1 }},
			]).toArray().then(result => {

				let orderIds = result.map(record => {
					return new ObjectId(record._id);
				});

				order_items.aggregate([
					{$match: { order_id: { $in: orderIds } } },
					{$lookup: { /** Get order details **/
						"from"			: Tables.ORDERS,
						"localField"	: "order_id",
						"foreignField"	: "_id",
						"as"			: "order_detail"
					}},
					{$addFields: {
						order_date		: { $arrayElemAt: ["$order_detail.order_date", 0] },
						restaurant_id	: { $arrayElemAt: ["$order_detail.restaurant_id", 0] },
						restaurant_name	: { $arrayElemAt: ["$order_detail.restaurant_name", 0] },
						branch_id		: { $arrayElemAt: ["$order_detail.branch_id", 0] },
					}},
					{$group: {
						_id: {
							year_month_date: { $dateToString: { format: "%Y-%m-%d", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE } },
							restaurant_id:"$restaurant_id",
							branch_id:"$branch_id"
						},
						year			: { $first: { "$year": "$order_date" } },
						month			: { $first: { "$month": "$order_date" } },
						items			: { $sum: "$qty"},
						order_ids		: { $addToSet: "$order_id" },
						order_date 		: {$first : "$order_date"},
						restaurant_name	: { $first: "$restaurant_name" },
						restaurant_id	: { $first: "$restaurant_id" },
						branch_id		: { $first: "$branch_id" },
					}},
				]).toArray().then(result => {
					if (!result?.length) return seariesCallback(null);

					asyncEach(result, (records, eachCallback) => {
						let created 	= records.order_date;
						let createdDate = Helper.newDate(created, Constants.DATABASE_DATE_FORMAT);
						let createdStart= Helper.newDate(createdDate + " " + Constants.START_DATE_TIME_FORMAT);
						let createdEnd 	= Helper.newDate(createdDate + " " + Constants.END_DATE_TIME_FORMAT);
						let tmpItems 	= (records.items) ? records.items : 0;
						let orderCount 	= (records.order_ids) ? records.order_ids.length : 0;
						let avgSize 	= (tmpItems && orderCount) ? Math.round(tmpItems / orderCount) : 0;

						avg_basket_size_reports.updateOne({
							restaurant_id: new ObjectId(records.restaurant_id),
							branch_id	: new ObjectId(records.branch_id),
							date: {
								$gte: Helper.newDate(createdStart),
								$lte: Helper.newDate(createdEnd)
							}},
							{
								$set: {
									total_orders	: orderCount,
									total_items		: tmpItems,
									avg_size 		: avgSize,
									restaurant_name	: records.restaurant_name,
								},
								$setOnInsert: {
									date	: records.order_date,
									created	: Helper.getUtcDate(),
								}
							}, { upsert: true }).then(() => {
								eachCallback(null);
							}).catch(err => {
								eachCallback(err);
							});
					}, (childEachErr) => {
						if (childEachErr) console.error("Error in saveOperationReport eachCallback",childEachErr);

						seariesCallback(null);
					});
				}).catch(err => {
					console.error("Error in saveAverageBasketSizeReport find order items",err);
				});
			}).catch(err => {
				console.error("Error in saveAverageBasketSizeReport orders find",err);
			});
		}, () => {});
	};//End saveAverageBasketSizeReport()

	/**
	 * Function to save customer order reports
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return render
	 */
	async saveCustomerOrderStatsReport (req, res, next){
		/** Send response to client and work in background */
		res.render('blank', { layout: false });

		this.saveCronLogs(req, res, next, {method_name: "saveCustomerOrderStatsReport"});

		let numberOfDays = (req.params.days) ? parseInt(req.params.days) : 2;
		if (numberOfDays <= 0 || isNaN(numberOfDays)) numberOfDays = 2;

		let hoursInADay 	= numberOfDays * Constants.HOURS_IN_A_DAY;
		let tempStartDate 	= Helper.newDate(Helper.subtractDate(hoursInADay));
		let startDate 		= Helper.newDate(tempStartDate, Constants.DATABASE_DATE_FORMAT);
		startDate 			= Helper.newDate(startDate + " " + Constants.START_DATE_TIME_FORMAT);
		let endDate 		= Helper.newDate(Helper.newDate("", Constants.CURRENTDATE_START_DATE_FORMAT));

		const orders 				= this.db.collection(Tables.ORDERS);
		const customer_order_stats 	= this.db.collection(Tables.CUSTOMER_ORDER_STATS);

		let datesArray = Helper.getDateRange(startDate, endDate);
		eachOfSeries(datesArray, (tmpDate, key, seariesCallback) => {
			let tmpCurrentDate = Helper.newDate(tmpDate, Constants.DATABASE_DATE_FORMAT);
			let tmpStartDate = Helper.newDate(tmpCurrentDate + " " + Constants.START_DATE_TIME_FORMAT);
			let tmpEndDate = Helper.newDate(tmpCurrentDate + " " + Constants.END_DATE_TIME_FORMAT);

			orders.aggregate([
				{$match: {
					order_date	: { $gte: tmpStartDate, $lt: tmpEndDate },
					admin_status: Constants.ORDER_DELIVERED
				}},
				{$group : {
					_id 			: "$customer_id",
					total_orders 	: {$sum : 1},
					total_amount	: {$sum : "$order_price"},
					customer_id		: {$first : "$customer_id"},
					order_date		: {$first : "$order_date"},
				}}
			]).toArray().then(result => {
				if (result.length == 0) return seariesCallback(null);

				asyncEach(result, (records, eachCallback) => {
					let created 	= records.order_date;
					let createdDate = Helper.newDate(created, Constants.DATABASE_DATE_FORMAT);
					let createdStart= Helper.newDate(createdDate + " " + Constants.START_DATE_TIME_FORMAT);
					let createdEnd 	= Helper.newDate(createdDate + " " + Constants.END_DATE_TIME_FORMAT);
					let orderCount 	= (records.total_orders) ? parseFloat(records.total_orders) : 0;
					let totalAmount = (records.total_amount) ? parseFloat(records.total_amount) : 0;
					let avgValue 	= (orderCount && totalAmount) ? Helper.round(totalAmount / orderCount) : 0;

					customer_order_stats.updateOne({
						customer_id: new ObjectId(records.customer_id),
						date: {
							$gte: Helper.newDate(createdStart),
							$lte: Helper.newDate(createdEnd)
						}
					},
					{
						$set: {
							total_orders	: orderCount,
							total_amount	: totalAmount,
							avg_order_value	: avgValue
						},
						$setOnInsert: {
							date	: records.order_date,
							created	: Helper.getUtcDate(),
						}
					}, { upsert: true }).then(() => {
						eachCallback(null);
					}).catch(err => {
						eachCallback(err);
					});
				}, (childEachErr) => {
					if (childEachErr) {
						console.error("Error in saveCustomerOrderStatsReport eachCallback",childEachErr);
					}

					seariesCallback(null);
				});
			}).catch(err => {
				console.error("Error in saveCustomerOrderStatsReport find",err);
				return seariesCallback(null);
			});
		}, (eachErr) => {
			if (eachErr) {
				console.error("Error at eachErr in saveCustomerOrderStatsReport",eachErr);
			}
		});
	};//End saveCustomerOrderStatsReport()

	/**
	 * Function to save cron logs
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return render
	 */
	async saveCronLogs (req, res,next, options) {
		try {
			let methodName 	= 	(options.method_name) 	?	options.method_name :"";
			let cronData 	=	(options.data)			? 	options.data 		:"";

			/** Set data */
			let insertAbleData = {
				method_name: methodName,
				created	   : Helper.getUtcDate(),
			};
			if(cronData) insertAbleData.cron_data = cronData;

			const system_cron_logs 	= this.db.collection(Tables.SYSTEM_CRON_LOGS);
			await system_cron_logs.insertOne(insertAbleData);

			let result = await system_cron_logs.find({method_name: methodName }, { projection: { _id: 1} }).sort({_id: Constants.SORT_ASC}).toArray();

			if(result.length>10){
				await system_cron_logs.deleteOne({ _id: result[0]._id });
			}
		} catch (error) {
			console.error("Catch error in saveCronLogs",error);
		}
	};//End saveCronLogs()

	/**
	 * Function to remove offer from cart
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render
	 */
	async removeCartOffer (req, res, next){
		try {
			/** Send response to client and work in background */
			res.render('blank', { layout: false });

			this.saveCronLogs(req, res, next, {method_name: "saveRestaurnatWiseOrders"});

			/** Get customer orders */
			let removeOfferTime = 30;
			let currentDate		= Helper.getUtcDate(Helper.subtractMinute(removeOfferTime));

			const user_carts	= this.db.collection(Tables.USER_CARTS);
			let result = await user_carts.find({
				created		: {$lte : currentDate},
				offer_id	: {$exists : true}
			},
			{projection : {
				_id : 1,customer_id:1,device_id:1,branch_id:1,restaurant_id:1,offer_id:1
			}}).toArray();

			if(result && result.length > 0){
				asyncEach(result,(records, asyncCallback)=>{
					/** call function from user cart*/
					req.body = {
						user_id			: records.customer_id,
						device_id		: records.device_id,
						branch_id		: records.branch_id,
						restaurant_id	: records.restaurant_id,
						offer_id		: records.offer_id
					};
					this.userCartModel.removeOfferFromCart(req,res,next).then(()=>{});

					asyncCallback(null);
				},(asyncErr)=>{
					if(asyncErr) console.error("Each error in removeCartOffer",asyncErr);
				});
			}
		} catch (error) {
			console.error("Error in removeCartOffer",error);
		}
	};//end removeCartOffer()
}