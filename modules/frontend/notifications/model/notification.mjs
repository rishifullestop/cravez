
import { ObjectId } from 'mongodb';
import BREADCRUMBS from "../../../../breadcrumbs.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import {isPost, configDatatable, newDate} from "../../../../utils/index.mjs";
import notificationModel from '../../api/model/notification.mjs';

export default class Notification {
	constructor(db) {
		this.db = db;
		this.notificationAPI = new notificationModel(db);
	}   

	/**
	 * Function to get notification list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	async list(req, res){
		if(isPost(req)){
			let limit			= 	(req.body.length)		? parseInt(req.body.length)	: Constants.FRONT_LISTING_LIMIT;
			let skip			= 	(req.body.start)		? parseInt(req.body.start)	: Constants.DEFAULT_SKIP;
			let fromDate 		= 	(req.body.fromDate)		? req.body.fromDate 		: "";
			let toDate 			= 	(req.body.toDate)		? req.body.toDate 			: "";
			let authId			=	(req.session.user._id)	? req.session.user._id		:"";
			let restaurantId	=	(req.session.user.restaurant_id) ? req.session.user.restaurant_id	:"";
			const collection	=	this.db.collection(Tables.NOTIFICATIONS);

			/** Configure Datatable conditions*/
			let dataTableConfig = await configDatatable(req,res,null);
				
			/** Set common conditions **/
			let	commonConditions = {
				$or : [
					{user_id		:	new ObjectId(authId)},
					{restaurant_id	:	new ObjectId(restaurantId)}
				]
			};

			/** Conditions for date */
			if (fromDate != "" && toDate != "") {
				commonConditions["created"] = {
					$gte : newDate(fromDate),
					$lte : newDate(toDate),
				};
			}
			
			/** Get notifications list or count **/
			let dbRes = await collection.aggregate([
				{$match	: commonConditions},
				{$lookup :{
					"from" 			: Tables.USERS,
					"localField"	: "created_by",
					"foreignField"	: "_id",
					"as" 			: "users_created_by"
				}},
				{$project :{
					_id:1,message:1,created:1,created_by:1,created_role_id:1,user_role_id:1,user_id:1,url:1,extra_parameters:1,restaurant_id:1,parent_table_id:1,created:1,
					created_by_name	: {$arrayElemAt : ["$users_created_by.full_name",0]},
				}},
				{$match: dataTableConfig.conditions },
				{$facet : {
					list : [
						{$sort: dataTableConfig.sort_conditions },
						{$skip: skip },
						{$limit: limit }                            
					],
					count: [
						{$count: "count"},
					],
				}}
			]).toArray();

			/** Send response **/
			res.send({
				status: Constants.STATUS_SUCCESS,
				draw: dataTableConfig.result_draw,
				data			:   dbRes?.[0]?.list ||[],
				recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
				recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
			}); 
		}else{
			req.breadcrumbs(BREADCRUMBS['notifications/list']);
			res.render('list');
		}
	};//End list()

	/**
	 * Function for get counter of unread notifications
	 *
	 * @param req 	As 	Request Data
	 * @param res 	As 	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return json
	 */
	async getHeaderNotificationsCounter(req,res,next){
		try {
			/** Set request body **/
			req.body = {
				user_id 		: req.session.user._id,
				restaurant_id 	: req.session.user.restaurant_id,
			};

			/** Get notifications counter **/
			let response = await this.notificationAPI.getNotificationsCounter(req, res,next);
			res.send(response);
		} catch (error) {
			next(error);
		}
	};//End getHeaderNotificationsCounter()

	/**
	 * Function for get header notifications
	 *
	 * @param req 	As 	Request Data
	 * @param res 	As 	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return json
	 */
	async getHeaderNotifications(req,res,next){
		try {
			/** Set request body **/
			req.body = {
				user_id 		: req.session.user._id,
				restaurant_id 	: req.session.user.restaurant_id,
				limit 			: Constants.FRONT_HEADER_NOTIFICATION_DISPLAY_LIMIT,
			};
			
			/** Get notifications **/
			let response = await this.notificationAPI.getNotifications(req, res,next);
			res.send(response);
		} catch (error) {
			next(error);
		}
	};//End getHeaderNotifications()
}
