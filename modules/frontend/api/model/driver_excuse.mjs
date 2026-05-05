import { ObjectId } from 'mongodb';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from '../../../../utils/index.mjs';
import {sendMailToUsers, saveDriverStatusLogs} from '../../../../services/index.mjs';
import { postExcuseValidation } from '../validations/driver_excuse.mjs';

export default class DriverExcuse {
    constructor(db) {
        this.db = db;
    }

	/**
	 * Function to post driver excuse
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async postDriverExcuse (req,res,next){
		return new Promise(async resolve=>{
			req.body 	= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId  = (req.body.user_id) ? new ObjectId(req.body.user_id) :"";
			let type 	= (req.body.type)    ? req.body.type 			  :"";
			let date    = (req.body.date) 	 ? req.body.date 			  :"";
			let from    = (req.body.from) 	 ? parseFloat(req.body.from)  :"";
			let to 	    = (req.body.to) 	 ? parseFloat(req.body.to) 	  :"";
			let reason  = (req.body.reason)  ? req.body.reason 			  :"";
			let requestedDate = Helpers.newDate(date,Constants.DATABASE_DATE_FORMAT);

			/** Send error response **/
			if(!userId || [Constants.IN_EXCUSE, Constants.OUT_EXCUSE, Constants.CANCEL_EXCUSE].indexOf(type) == -1){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});
			}

			/** Apply validation */
			if(type == Constants.IN_EXCUSE || type == Constants.OUT_EXCUSE){
				let validationResponse = await Helpers.applyValidationInterCallFunction(req, res, next, postExcuseValidation);
				if(validationResponse.status != Constants.STATUS_SUCCESS) return resolve(validationResponse);
			}

			/** For get driver excuse details */
			const driver_excuses = this.db.collection(Tables.DRIVER_EXCUSES);
			driver_excuses.findOne({
				driver_id    : userId,
				is_completed : false
			},{projection: {_id: 1, status: 1, is_start: 1}, sort: {created: Constants.SORT_DESC}}).then(findResult=>{

				/** Send error response when excuse found but driver post another excuse */
				if(findResult  && type == Constants.IN_EXCUSE) return resolve({status: Constants.STATUS_ERROR, message: res.__("driver_excuses.driver_excuses_is_already_in_running")});

				/** Send error response when excuse not found but driver want to stop or cancel */
				if(!findResult && (type == Constants.OUT_EXCUSE || type == Constants.CANCEL_EXCUSE)) return resolve({status: Constants.STATUS_ERROR, message: res.__("driver_excuses.you_have_not_taken_any_excuses_yet")});

				if(type == Constants.OUT_EXCUSE){
					/** Send error response when excuse not approved but driver want to stop */
					if(findResult.status != Constants.APPROVED) return resolve({status:Constants.STATUS_ERROR, message:res.__("driver_excuses.your_request_not_approve_by_admin")});

					/** Send error response when excuse not start but driver want to stop */
					if(!findResult.is_start) return resolve({status: Constants.STATUS_ERROR, message: res.__("driver_excuses.excuse_not_end_untill_start")});
				}

				if(type == Constants.CANCEL_EXCUSE){
					/** Send error response when excuse reject but driver want to cancel */
					if(findResult.status == Constants.REJECTED ) return resolve({status: Constants.STATUS_ERROR, message: res.__("driver_excuses.your_request_not_approve_by_admin")});

					/** Send error response when excuse start but driver want to cancel  */
					if(findResult.is_start) return resolve({status: Constants.STATUS_ERROR, message: res.__("driver_excuses.not_allow_to_cancel_excuse")});
				}

				if(type == Constants.IN_EXCUSE){
					/** Set insert-able data */
					let insertData = {
						type  			: 	Constants.IN_EXCUSE,
						date			: 	Helpers.getUtcDate(requestedDate+" "+Constants.START_DATE_TIME_FORMAT),
						from 			: 	from,
						to 				: 	to,
						status			: 	Constants.PENDING,
						driver_id   	: 	userId,
						is_completed	: 	false,
						reason 			: 	reason,
						created			: 	Helpers.getUtcDate(),
						modified		:	Helpers.getUtcDate()
					};

					/** insert driver excuse details */
					driver_excuses.insertOne(insertData).then(insertResult=>{

						/**Send success response */
						resolve({status	: Constants.STATUS_SUCCESS,message : res.__("driver_excuses.excuse_has_been_added_successfully")});

						/*************** Send Mail  ***************/
						sendMailToUsers(req,res,{
							event_type 		: Constants.DRIVER_EXCUSES_REQUEST_POSTED_EMAIL_EVENTS,
							excuse_id		: insertResult?.insertedId || "",
							user_id			: Constants.CRAVEZ,
							member_id		: userId,
							excuses_details	: insertData
						});
						/*************** Send Mail  ***************/
					}).catch(next);
				}else if(type == Constants.OUT_EXCUSE){
					/** update driver excuse details */
					driver_excuses.updateOne({
						driver_id 		:	userId,
						is_completed 	:	false,
						status			: 	Constants.APPROVED
					},
					{$set:{
						is_completed: true,
						from 		: from,
						to 			: to,
						type  		: Constants.OUT_EXCUSE,
						modified	: Helpers.getUtcDate()
					}}).then(()=>{

						/**Send success response */
						resolve({status: Constants.STATUS_SUCCESS,message: res.__("driver_excuses.excuse_has_been_ended_successfully")});

						/** Save driver status logs */
						saveDriverStatusLogs(req,res,next,{
							parent_id 	: findResult._id,
							driver_id 	: userId,
							type	  	: Tables.DRIVER_EXCUSES,
							event_type	: Constants.OUT_EXCUSE,
							end_time	: to,
						});
					}).catch(next);
				}else if(type == Constants.CANCEL_EXCUSE){
					/** update driver excuse details */
					driver_excuses.updateOne({
						driver_id 	 :	userId,
						is_completed :	false,
						$or:	[
							{status: Constants.APPROVED},
							{status: Constants.PENDING}
						]
					},
					{$set: {
						is_completed: true,
						status      : Constants.CANCELLED,
						type 		: Constants.CANCEL_EXCUSE,
						modified	: Helpers.getUtcDate()
					}}).then(()=>{

						/**Send success response */
						resolve({status	: Constants.STATUS_SUCCESS,message : res.__("driver_excuses.excuse_has_been_canceled_successfully")});
					}).catch(next);
				}
			}).catch(next);
		}).catch(next);
	}// end postDriverExcuse()

	/**
	 * Function to get latest Excuse
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getDriverExcuses (req,res,next){
		return new Promise(resolve=>{
			let userId  = (req.body.user_id) ? new ObjectId(req.body.user_id) : "";

			/** Send error response **/
			if(!userId) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});

			/** For get driver excuses details */
			const driver_excuses = this.db.collection(Tables.DRIVER_EXCUSES);
			driver_excuses.findOne({
				driver_id 	 : userId,
				is_completed : false
			},{projection: { _id:1,date:1,driver_id:1,from:1,to:1,status:1,is_completed:1,reason:1,is_start:1},sort:{_id:Constants.SORT_DESC}}).then(findResult=>{

				/* If no record found*/
				if(!findResult) return resolve({status: Constants.STATUS_SUCCESS, message: res.__("system.no_record_found")});

				/** Convert into 24 hours format */
				findResult.to 	= Helpers.set24HourFormat(findResult.to);
				findResult.from = Helpers.set24HourFormat(findResult.from);

				/**Send success response */
				resolve({status	: Constants.STATUS_SUCCESS, result: findResult});
			}).catch(next);
		}).catch(next);
	}// end getDriverExcuses()
}// End DriverExcuse