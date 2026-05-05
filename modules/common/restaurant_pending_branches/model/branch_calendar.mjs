import { ObjectId } from 'mongodb';
import { parallel as asyncParallel, each as asyncEach } from 'async';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, getRestaurantId, sanitizeData, getUtcDate} from "../../../../utils/index.mjs";
import { saveUserActivity } from "../../../../services/index.mjs";

export default class BranchCalendar {
    constructor(db) {
        this.db = db;
    }

	/**
	 * Function to get calendar list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async getPendingBranchCalendarList(req,res,next){
		try{
			let slug 		=	req?.params?.slug || "";
			let branchId	=	req?.params?.id ||"";

			/** Get restaurant id **/
			let restaurantId = await getRestaurantId(req,res,next,{slug:slug});

			/** Calendar list */
			const restaurant_branch_calendars = this.db.collection(Tables.TMP_RESTAURANT_BRANCH_CALENDARS);
			restaurant_branch_calendars.find({
				branch_id		: 	new ObjectId(branchId),
				restaurant_id	:	new ObjectId(restaurantId),
				parent_id 		: 	"",
				$and: [
					{$or: [
						{is_exception:	false},
						{is_exception:	{$exists: false}}
					]},
					{$or: [
						{is_sw:	false},
						{is_sw:	{$exists: false}}
					]}
				]
			},{projection: {_id: 1, status: 1, type: 1, day:1,from_hour:1, from_minute:1, to_hour:1,to_minute:1}}).toArray().then(result=>{

				/** Render  branches calendar list  */
				res.render('pending_branches_calendar_list',{
					layout			:	false,
					result			: 	result || [],
					branch_id		: 	branchId,
					restaurant_id	: 	restaurantId,
					slug            :   slug
				});
			}).catch(next);
		}catch(err){
			return next(err);
		}
	};//End getPendingBranchCalendarList()

	/**
	 * Function to get Branch detail
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	async getPendingBranchCalendarChildDetails(req,res,next){
		try{
			let status	= 	req?.body?.status || Constants.OPEN;
			let type	=	req?.body?.type   || "";
			let slug 	=	req?.params?.slug || "";
			let branchId=	req?.params?.id   || "";

			/** Get Restaurant id */
			let restaurantId = await getRestaurantId(req,res,next,{slug:slug});

			/** Send error response */
			if(!type || (status != Constants.OPEN && status != Constants.CLOSE) || !restaurantId || !branchId){
				return res.send({status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again")});
			}

			const tmp_restaurant_branch_calendars = this.db.collection(Tables.TMP_RESTAURANT_BRANCH_CALENDARS);
			asyncParallel({
				calendar_details : (callback)=>{
					/** Get Branch calendar details **/
					tmp_restaurant_branch_calendars.find({
						restaurant_id	: 	new ObjectId(restaurantId),
						branch_id 		: 	new ObjectId(branchId),
						parent_id		:	"",
						status    		:	parseInt(status),
						type    		:	type,
					},{projection: {_id: 1, from_hour: 1, from_minute:1, to_hour:1, to_minute:1,day:1}}).toArray().then(result=>{
						callback(null,result);
					}).catch(next);
				},			
				exception_list : (callback)=>{
					/** Get Branch calendar details **/
					tmp_restaurant_branch_calendars.find({
						restaurant_id	: 	new ObjectId(restaurantId),
						branch_id 		: 	new ObjectId(branchId),
						is_exception	:	true,
						type    		:	type,
					},{projection: {_id: 1, day: 1, from_hour: 1, from_minute:1, to_hour:1, to_minute:1}}).toArray().then(result=>{
						callback(null,result);
					}).catch(next);
				},
				sw_list : (callback)=>{
					/** Get Branch calendar details **/
					tmp_restaurant_branch_calendars.find({
						restaurant_id	: 	new ObjectId(restaurantId),
						branch_id 		: 	new ObjectId(branchId),
						type    		:	Constants.SPECIAL_DAY_OF_WEEK,
						is_sw			:	true,
					},{projection: {_id: 1, day: 1, from_hour: 1, from_minute:1, to_hour:1, to_minute:1}}).toArray().then(result=>{
						callback(null,result);
					}).catch(next);
				},
			},(asyncErr,asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				/** Send succcess response */
				res.send({
					status			: Constants.STATUS_SUCCESS,
					parent_result	: asyncResponse?.calendar_details || {},
					exception_result: asyncResponse?.exception_list || [],
					sw_result		: asyncResponse?.sw_list || []
				});
			});
		}catch(err){
			return next(err);
		}
	};// End getPendingBranchCalendarChildDetails()

	/**
	 * Function for manage calendar details
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async managePendingBranchCalendar(req,res,next){
		try{
			let slug 		=	req?.params?.slug || "";
			let branchId	=	req?.params?.id || "";
			let userId 		= 	req?.session?.user?._id || "";
			const tmp_restaurant_branch_calendars	=	this.db.collection(Tables.TMP_RESTAURANT_BRANCH_CALENDARS);
			if(isPost(req)){
				/** Sanitize Data **/
				req.body 	= 	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
				let status	= 	req.body.status || "";

				let errors =[];
				if(status == Constants.OPEN){
					/** Send error response **/
					if(!req.body.calendar || req.body.calendar.constructor !== Array){
						return res.send({
							status: Constants.STATUS_ERROR, 
							message: [{param: Constants.FRONT_GLOBAL_ERROR, msg: res.__("system.something_going_wrong_please_try_again")}] 
						});
					}
					
					/** Check  calendar valiadation  */
					req.body.calendar.map((records,index)=>{
						if(records){						
							if(!records.from){
								errors.push({param: "calendar_from_"+index, msg: res.__("branch_calendar.please_select_from")})
							}
							if(!records.to){
								errors.push({param: "calendar_to_"+index, msg: res.__("branch_calendar.please_select_to")})
							}						
						}
					});
					
					/** Check  exception valiadation  */
					if(req.body.is_exception){
						/** Send error response **/
						if(!req.body.exception){
							return res.send({
								status : Constants.STATUS_ERROR, 
								message: [{param: Constants.FRONT_GLOBAL_ERROR, msg: res.__("system.something_going_wrong_please_try_again")}] 
							});
						}

						/** Check  exception valiadation  */
						req.body.exception.map((records,index)=>{
							if(records){
								if(!records.day){
									errors.push({param: "exception_day_"+index, msg: res.__("branch_calendar.please_select_day")})
								}
								if(!records.from){
									errors.push({param: "exception_from_"+index, msg: res.__("branch_calendar.please_select_from")})
								}
								if(!records.to){
									errors.push({param: "exception_to_"+index, msg: res.__("branch_calendar.please_select_to")})
								}							
							}
						});
					}
					
					/** Special week conditions*/
					if(req.body.special_week){
						/** Send error response **/
						if(!req.body.sw){
							return res.send({
								status : Constants.STATUS_ERROR, 
								message: [{param: Constants.FRONT_GLOBAL_ERROR, msg: res.__("system.something_going_wrong_please_try_again")}] 
							});
						}

						/** Check  special_week valiadation  */
						req.body.sw.map((records,index)=>{
							if(records){
								if(!records.day){
									errors.push({param: "sw_day_"+index, msg: res.__("branch_calendar.please_select_day")})
								}
								if(!records.from){
									errors.push({param: "sw_from_"+index, msg: res.__("branch_calendar.please_select_from")})
								}
								if(!records.to){
									errors.push({param: "sw_to_"+index, msg: res.__("branch_calendar.please_select_to")})
								}							
							}
						});
					}
				}else{
					if(!req.body.close_day){
						/** Send error response **/
						return res.send({
							status : Constants.STATUS_ERROR, 
							message: [{param: Constants.FRONT_GLOBAL_ERROR, msg: res.__("system.something_going_wrong_please_try_again")}] 
						});
					}

					/** Check  close day valiadation  */
					let tmpDayObj = {};
					req.body.close_day.map((records,index)=>{
						if(records){
							if(!records.day){
								errors.push({param: "close_day_"+index, msg: res.__("branch_calendar.please_select_day")});
							}else if(records.day && tmpDayObj[records.day]){
								errors.push({param: "close_day_"+index, msg: res.__("branch_calendar.day_must_be_unique")});
							}else{
								tmpDayObj[records.day] = true;
							}
						}
					});
				}

				/** Send error response **/
				if(errors.length > 0) return res.send({status: Constants.STATUS_ERROR, message: errors});
				
				/** Get restaurant id **/
				let restaurantId = await getRestaurantId(req,res,next,{slug:slug});

				let type = (status == Constants.OPEN)?	req.body.open_type 	:req.body.close_type;
				asyncParallel({
					calendar_save_details : (callback)=>{
						if(status != Constants.OPEN) return callback(null,null);

						asyncEach(req.body.calendar,(records, asyncEachCallback)=>{
							let calendarId	= (records.id)	? new ObjectId(records.id) :new ObjectId();
							let fromTime	= (records.from)? records.from.split(":"):[0,0];
							let toTime 		= (records.to)	? records.to.split(":")	:[0,0];
							/** Set Update data */
							let updatedata 	=	{
								$set : {
									status 		: 	parseInt(status),
									type		:	type,
									from_hour 	:	(fromTime[0])	?	parseInt(fromTime[0])	:0,
									from_minute	:	(fromTime[1])	?	parseInt(fromTime[1])	:0,
									to_hour		:	(toTime[0])		?	parseInt(toTime[0])		:0,
									to_minute 	:	(toTime[1])		?	parseInt(toTime[1])		:0,
									modified	:	getUtcDate(),
								},
								$setOnInsert : {
									parent_id 		: 	"",
									restaurant_id 	: 	restaurantId,
									branch_id 		: 	new ObjectId(branchId),
									added_by 		: 	new ObjectId(userId),
									channel_id		:	req?.session?.user?.channel_id || "",
									created 		: 	getUtcDate()
								}
							};

							/** Update restaurant branch calendar  */
							tmp_restaurant_branch_calendars.updateOne({_id: calendarId },updatedata,{upsert: true}).then(()=>{

								asyncEachCallback(null);

								/** Save user activities **/
								saveUserActivity(req,res,{
									user_id 		:	userId,
									parent_type 	:	Tables.RESTAURANT_BRANCH_CALENDARS,
									is_not_objectId	:	true,
									parent_id 		: 	new ObjectId(calendarId),
									activity_type	:	Constants.ACTIVITY_ADD_EDIT_DETAILS,
									additional_details:	{
										restaurant_id: new ObjectId(restaurantId), 
										branch_id: new ObjectId(branchId), 
										type: type, 
										status: status,
										channel_id	: req?.session?.user?.channel_id || ""
									},
								});
							}).catch(next);
						},asyncEachErr=>{
							callback(asyncEachErr);
						});					
					},
					exception_save_details : (callback)=>{
						let childArray =  (status == Constants.OPEN) ? req.body.exception :req.body.close_day;

						if(!childArray || !Array.isArray(childArray) || childArray.length == 0) return callback(null,null);

						let deleteAbleId = String(new ObjectId());
						asyncEach(childArray,(records, asyncEachCallback)=>{
							let day = parseInt(records.day);

							/** Set child update data */
							let childUpdatedata = {
								$set : {
									to_be_not_deleted: 	deleteAbleId,
									modified:	getUtcDate(),
								},
								$setOnInsert : {
									parent_id 		: 	"",									
									added_by 		: 	new ObjectId(userId),
									channel_id		:	req?.session?.user?.channel_id || "",
									created 		: 	getUtcDate()
								}
							};

							if(status == Constants.OPEN){
								let childFromTime	=	(records.from)	?	records.from.split(":")	:[0,0];
								let childToTime 	=	(records.to)	?	records.to.split(":")	:[0,0];

								childUpdatedata["$set"]["from_hour"] 	= 	(childFromTime[0])	?	parseInt(childFromTime[0])	:"";
								childUpdatedata["$set"]["from_minute"] 	= 	(childFromTime[1])	?	parseInt(childFromTime[1])	:"";
								childUpdatedata["$set"]["to_hour"] 		= 	(childToTime[0])	?	parseInt(childToTime[0])	:"";
								childUpdatedata["$set"]["to_minute"] 	= 	(childToTime[1])	?	parseInt(childToTime[1])	:"";
								childUpdatedata["$set"]["is_exception"]	= 	true;
							}

							/** Update restaurant branch calendar  */
							tmp_restaurant_branch_calendars.updateOne({
								restaurant_id: 	restaurantId,
								branch_id : 	new ObjectId(branchId),
								type	:	 type,
								day 	: 	day,
								status 	: 	Constants.CLOSE,									
							 },childUpdatedata,{upsert: true}).then(()=>{
								asyncEachCallback(null);
							}).catch(next);
						},asyncEachErr=>{
							if(asyncEachErr) return callback(asyncEachErr);

							/** Delete all the records which are not in the current array */
							tmp_restaurant_branch_calendars.deleteMany({
								restaurant_id: 	restaurantId,
								branch_id : 	new ObjectId(branchId),
								type	  :	 type,  
								to_be_not_deleted: 	{$ne: deleteAbleId},
								status 	: 	Constants.CLOSE,									
							}).then(()=>{
								
								/** Unset to_be_not_deleted field */
								tmp_restaurant_branch_calendars.updateMany({
									restaurant_id: 	restaurantId,
									branch_id : 	new ObjectId(branchId),
									to_be_not_deleted: 	deleteAbleId,								
								},{$unset: {to_be_not_deleted: 1}}).then(()=>{
									callback(null);
								}).catch(next);
							}).catch(next);
						});
					},
					sw_save_details : (callback)=>{
						if(!req.body.special_week) return callback(null,null);

						asyncEach(req.body.sw,(records, asyncEachCallback)=>{
							let swId = (records.id)	?	new ObjectId(records.id) :new ObjectId();

							/** Set child update data */
							let childUpdatedata = {
								$set : {
									status 		: 	Constants.OPEN,
									type		:	Constants.SPECIAL_DAY_OF_WEEK,
									day 		: 	parseInt(records.day),
									modified	:	getUtcDate(),
								},
								$setOnInsert : {
									parent_id 		: 	"",
									is_sw			:	true,
									restaurant_id 	: 	restaurantId,
									branch_id 		: 	new ObjectId(branchId),
									added_by 		: 	new ObjectId(userId),
									channel_id		:	req?.session?.user?.channel_id || "",
									created 		: 	getUtcDate()
								}
							};

							if(status == Constants.OPEN){
								let childFromTime	=	(records.from)	?	records.from.split(":")	:[0,0];
								let childToTime 	=	(records.to)	?	records.to.split(":")	:[0,0];

								childUpdatedata["$set"]["from_hour"] 	= 	(childFromTime[0])	?	parseInt(childFromTime[0])	:"";
								childUpdatedata["$set"]["from_minute"] 	= 	(childFromTime[1])	?	parseInt(childFromTime[1])	:"";
								childUpdatedata["$set"]["to_hour"] 		= 	(childToTime[0])	?	parseInt(childToTime[0])	:"";
								childUpdatedata["$set"]["to_minute"] 	= 	(childToTime[1])	?	parseInt(childToTime[1])	:"";
							}

							/** Update restaurant branch calendar  */
							tmp_restaurant_branch_calendars.updateOne({_id : swId },childUpdatedata,{upsert: true}).then(()=>{
								asyncEachCallback(null);
							}).catch(next);
						},asyncEachErr=>{
							callback(asyncEachErr);
						});
					},
					delete_exception_save_details : (callback)=>{
						if(req.body.is_exception) return callback(null,null);
						if(status != Constants.OPEN) return callback(null,null);

						tmp_restaurant_branch_calendars.deleteMany({restaurant_id: restaurantId,branch_id: new ObjectId(branchId), is_exception: true,}).then(()=>{
							callback(null);
						}).catch(next);
					},
					delete_sw_save_details : (callback)=>{
						if(req.body.special_week) return callback(null,null);
						if(status != Constants.OPEN) return callback(null,null);

						tmp_restaurant_branch_calendars.deleteMany({restaurant_id: restaurantId,branch_id: new ObjectId(branchId), is_sw: true,}).then(()=>{
							callback(null);
						}).catch(next);
					},
				},(asyncErr)=>{
					if(asyncErr) return next(asyncErr);

					/** Send success response **/
					res.send({
						status : Constants.STATUS_SUCCESS,
						message: res.__("pending_branches_calendar.calendar_has_been_updated_successfully"),
					});
				});
			}else{
				/** Render add-edit page  **/
				res.render('pending_branch_calendar_add_edit',{
					layout 		: 	false,
					branch_id	:	branchId,
					result		:	{},
				});
			}
		}catch(err){
			return next(err);
		}
	};//End managePendingBranchCalendar()

	/**
	 * Function for delete branch calendar
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async deletePendingBranchCalendar(req, res, next){
		try{
			let branchId	=	req?.params?.id || "";
			let slug 		=	req?.params?.slug || "";
			let calendarId	=	req?.body?.calendar_id || "";
			let authUserId	=	req?.session?.user?._id || "";
			
			/** Get restaurant id **/
			let restaurantId = await getRestaurantId(req,res,next,{slug:slug});

			/** Send error response */
			if(!calendarId || !restaurantId || !branchId){
				return res.send({status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again")});
			}

			/** Remove branch calendar number **/
			const tmp_restaurant_branch_calendars = this.db.collection(Tables.TMP_RESTAURANT_BRANCH_CALENDARS);
			await tmp_restaurant_branch_calendars.deleteMany({
				restaurant_id :	new ObjectId(restaurantId),
				branch_id 	  : new ObjectId(branchId),
				$or : [
					{_id 		: 	new ObjectId(calendarId)},
					{parent_id 	:	new ObjectId(calendarId)}
				]
			});

			/** Send success response **/
			res.send({status: Constants.STATUS_SUCCESS, message: res.__("pending_branches_calendar.calendar_has_been_deleted_successfully")});

			/** Save user activities **/
			saveUserActivity(req,res,{
				user_id 		:	authUserId,
				parent_type 	:	Tables.RESTAURANT_BRANCH_CALENDARS,
				is_not_objectId	:	true,
				parent_id 		: 	new ObjectId(calendarId),
				activity_type	:	Constants.ACTIVITY_DELETE_DETAILS,
				additional_details:	{
					restaurant_id: new ObjectId(restaurantId), 
					branch_id: new ObjectId(branchId),
					channel_id : req?.session?.user?.channel_id || ""	
				}
			});
		}catch(err){
			return next(err);
		}
	};//End deletePendingBranchCalendar()
}