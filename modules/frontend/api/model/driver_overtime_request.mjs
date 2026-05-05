import { ObjectId } from 'mongodb';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from '../../../../utils/index.mjs';

export default class DriverOvertimeRequest {
    constructor(db) {
        this.db = db;
    }

	/**
	 * Function for get captain overtime request list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async getOvertimeRequestList (req, res,next){
		return new Promise(resolve=>{
			req.body 		 =	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId		 = 	(req.body.user_id)	? req.body.user_id		:"";
			let currentDate	 =	Helpers.newDate("",Constants.DATABASE_DATE_FORMAT);
			let fromDate	 = 	Helpers.newDate(currentDate+" "+Constants.START_DATE_TIME_FORMAT);
			let toDate 		 =  Helpers.newDate(currentDate+" "+Constants.END_DATE_TIME_FORMAT);

			/** Send error response */
			if(!userId) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			const captain_overtime_requests = this.db.collection(Tables.CAPTAIN_OVERTIME_REQUESTS);
			captain_overtime_requests.aggregate([
				{$match : {
					request_date:	{ $gte: fromDate, $lte: toDate},
					user_id		:	new ObjectId(userId),
				}},
				{$lookup: {	/** Get TL details **/
					"from" 		  :	Tables.USERS,
					"localField"  :	"added_by",
					"foreignField":	"_id",
					"as" 		  :	"users_details"
				}},
				{$project : {
					request_date:1,purpose:1,hours:1,tl_name: {$arrayElemAt : ["$users_details.full_name",0]}
				}}
			]).toArray().then(result=>{

				if(result.length > 0){
					result.map(records=>{
						records.hours 		 =	Helpers.set24HourFormat(records.hours);
						records.request_date = 	(records.request_date)  ? Helpers.newDate(records.request_date,Constants.AM_PM_FORMAT_WITH_DATE) :"";
					});
				}

				/** Send response **/
				resolve({
					status: Constants.STATUS_SUCCESS,
					result: result
				});
			}).catch(next);
		}).catch(next);
	};//End getOvertimeRequestList()
}// End DriverOvertimeRequest