import { ObjectId } from 'mongodb';
import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, newDate, exportToExcel, configDatatable, getDifferenceBetweenTwoDatesInMinute, round } from '../../../../utils/index.mjs';

// Model for captain working hours report
export default class CaptainWorkingHoursReport {
	constructor(db) {
		this.db = db;
	}
	
	/**
	 * Function to get captain working hours report list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
    async getCaptainWorkingHoursReportList(req,res,next){
		try {
			if(isPost(req)){
				let limit		 = 	(req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 = 	(req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     = 	(req.body.from_date) 	? req.body.from_date 		:"";
				let toDate 	  	 = 	(req.body.to_date)   	? req.body.to_date   		:"";
				const user_logins 	= 	this.db.collection(Tables.USER_LOGINS);
				const users 		= 	this.db.collection(Tables.USERS);
			
				asyncParallel({
					driver_ids:(callback)=>{
						/** Get driver ids  */
						users.find({
							user_type	: Constants.USER_TYPE_OTHER,
							user_role_id: Constants.DRIVER
						},{projection: {_id:1}}).toArray().then(result => {
							let userIds = result.map(record=>{
								return new ObjectId(record._id);
							});
							callback(null, userIds);
						}).catch(next);
					},
				},async (asyncErr, asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					let userIds = asyncResponse.driver_ids;			
				
					/** Configure Datatable conditions*/
					let dataTableConfig = await configDatatable(req,res,null);

					let commonConditions = {user_id : {$in: userIds}}
					/** Condition for date */
					if (fromDate != "" && toDate != "") {
						commonConditions["date"] = {
							$gte 	: newDate(fromDate),
							$lte 	: newDate(toDate),
						};
					}
					dataTableConfig.conditions	= Object.assign(dataTableConfig.conditions, commonConditions);
					
					asyncParallel({
						records :(callback)=>{
							/** Get list**/
							user_logins.aggregate([
								{$match : dataTableConfig.conditions},												
								{$lookup:	{
									"from" 			: 	Tables.USERS,
									"localField" 	:	"user_id",
									"foreignField" 	: 	"_id",
									"as" 			: 	"driver_details"
								}},
								{$addFields : {
									captain_name: {$arrayElemAt: ["$driver_details.full_name",0]},
								}},
								{
									$project : {
										_id:0, user_id:1, date:1, logout_time:1, created:1,captain_name:1
									}
								},
								{$sort 	: dataTableConfig.sort_conditions},		
								{$skip 	: skip},
								{$limit : limit},
							]).toArray().then(result => {	
								result.map(record => {
									if (record.created && record.logout_time !="") {
										let diff = getDifferenceBetweenTwoDatesInMinute(record.created, record.logout_time);
										var actualTime = Math.abs(Math.round(diff));
										record.actual_working_time = actualTime/60;
									}
								});						
								callback(null,result);
							}).catch(next);
						},
						total_records:(callback)=>{
							/** Get total number of records **/
							user_logins.countDocuments(commonConditions).then(countResult => {
								callback(null, countResult);
							}).catch(next);
						},
						filter_records:(callback)=>{
							/** Get filtered records counting **/
							user_logins.countDocuments(dataTableConfig.conditions).then(countResult => {
								callback(null, countResult);
							}).catch(next);
						}
					},(err, response)=>{
						/** Send response **/
						res.send({
							status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
							draw			: dataTableConfig.result_draw,
							data			: response.records,
							recordsFiltered	: response.filter_records,
							recordsTotal	: response.total_records,
						});
					});
				});
			}else{
				/** render listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/report/captain_working_hours_report']);
				res.render('captain_working_hours_report');
			}
		} catch (error) {
			next(error);
		}
    };//End getCaptainWorkingHoursReportList()
	
	
	
	/**
	 *  Function for petrol consumption detials
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async captainWorkingHoursReportExport(req,res,next){
		try {
			let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
			let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";		
			let sortingField    = (req.query.sort_field)    ? req.query.sort_field : "_id";
			let sortingDir      = (req.query.sort_dir)      ? req.query.sort_dir : "asc";
			let sortOrder       = (sortingDir == 'asc')     ? Constants.SORT_ASC : Constants.SORT_DESC;		
			const user_logins 	= this.db.collection(Tables.USER_LOGINS);
			const users 		= this.db.collection(Tables.USERS);

			asyncParallel({
				driver_ids:(callback)=>{
					/** Get driver ids  */
					users.find({
						user_type	: Constants.USER_TYPE_OTHER,
						user_role_id: Constants.DRIVER
					},{projection: {_id:1}}).toArray().then(result => {
						let userIds = result.map(record=>{
							return new ObjectId(record._id);
						});
						callback(null, userIds);
					}).catch(next);
				},
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				let userIds = asyncResponse.driver_ids;	
				
				let exportConditions = { user_id: { $in: userIds }};
		
				/** Condition for date */
				if (fromDate != "" && toDate != "") {
					exportConditions["date"] = {
						$gte: newDate(fromDate),
						$lte: newDate(toDate),
					};
				}
		
				let sortConditions = {};
				sortConditions[sortingField] = sortOrder;
			
				user_logins.aggregate([
					{ $match: exportConditions },
					{
						$lookup: {
							"from"			: Tables.USERS,
							"localField"	: "user_id",
							"foreignField"	: "_id",
							"as"			: "driver_details"
						}
					},
					{
						$addFields: {
							captain_name: { $arrayElemAt: ["$driver_details.full_name", 0] },
						}
					},
					{
						$project: {
							_id: 0, user_id: 1, date: 1, logout_time: 1, created: 1, captain_name: 1
						}
					},
					{$sort 	: sortConditions},
				]).toArray().then(findResult => {
					findResult.map(record => {
						if (record.created && record.logout_time != "") {
							let diff = getDifferenceBetweenTwoDatesInMinute(record.created, record.logout_time);
							var actualTime = Math.abs(Math.round(diff));
							record.actual_working_time = actualTime / 60;
						}
					});
				
					let temp			= [];
					let commonColls		= [];

					/** Define excel heading label **/
					commonColls	= [
						res.__("admin.report.current_date"),
						res.__("admin.report.captain_name"),
						res.__("admin.report.login"),
						res.__("admin.report.logout"),
						res.__("admin.report.actual_working_hours"),				
					];

					if(findResult && findResult.length > 0){
						findResult.map(records=>{
							let buffer =	[
								(records.date)	 		? newDate(records.date, Constants.AM_PM_FORMAT_WITH_DATE) : '',
								(records.captain_name)	? records.captain_name 		:"",
								(records.created) 		? newDate(records.created, Constants.AM_PM_FORMAT_WITH_DATE) : '',		
								(records.logout_time) 	? newDate(records.logout_time, Constants.AM_PM_FORMAT_WITH_DATE) : '',
								(records.actual_working_time) ? round(records.actual_working_time) : 0,
							];
							temp.push(buffer);
						});
					}

					/**  Function to export data in excel format **/
					exportToExcel(req,res,{
						file_prefix         : "captainWorkingHoursReport",
						heading_columns		: commonColls,
						export_data			: temp
					});
				}).catch(next);
			});
		} catch (error) {
			next(error);
		}
    };// end captainWorkingHoursReportExport()
}

