import { ObjectId } from 'mongodb';
import { parallel as asyncParallel } from 'async';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';

export default class Notification {
	constructor(db) {
		this.db = db;
	}

	/**
	 * Function for get notifications counter
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async getNotificationsCounter(req, res, next) {
		return new Promise(resolve => {
			let userId = (req.body.user_id) ? req.body.user_id : "";
			let restaurantId = (req.body.restaurant_id) ? req.body.restaurant_id : "";

			/** Send success response */
			if (!userId) return resolve({ status: Constants.STATUS_SUCCESS, counter: 0 });

			/** Set conditions */
			let conditions = {};
			if (restaurantId) {
				conditions["$or"] = [
					{ user_id: new ObjectId(userId) },
					{ restaurant_id: new ObjectId(restaurantId) }
				];
			} else {
				conditions.user_id = new ObjectId(userId);
			}
			conditions.is_seen = Constants.NOT_SEEN;
			conditions.is_read = Constants.NOT_READ;

			/** Get notifications counter */
			const notifications = this.db.collection(Tables.NOTIFICATIONS);
			notifications.countDocuments(conditions).then(countResult => {
				/** Send success response */
				resolve({
					status: Constants.STATUS_SUCCESS,
					counter: (countResult) ? countResult : 0
				});
			}).catch(next);
		}).catch(next);
	}//End getNotificationsCounter()

	/**
	 * Function for get notifications
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async getNotifications(req, res, next) {
		return new Promise(resolve => {
			let defalutLimit = (res.locals.settings['Site.front_record_limit']) ? parseInt(res.locals.settings['Site.front_record_limit']) : Constants.FRONT_LISTING_LIMIT;
			let userId = (req.body.user_id) ? req.body.user_id : "";
			let skip = (req.body.skip) ? parseInt(req.body.skip) : Constants.DEFAULT_SKIP;
			let limit = (req.body.limit) ? parseInt(req.body.limit) : defalutLimit;
			let restaurantId = (req.body.restaurant_id) ? req.body.restaurant_id : "";

			/** Send error response */
			if (!userId) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters") });

			/** Set conditions */
			let conditions = {};
			if (restaurantId) {
				conditions["$or"] = [
					{ user_id: new ObjectId(userId) },
					{ restaurant_id: new ObjectId(restaurantId) }
				];
			} else {
				conditions.user_id = new ObjectId(userId);
			}

			const notifications = this.db.collection(Tables.NOTIFICATIONS);
			asyncParallel([
				(callback) => {
					/** Get notifications list  **/
					notifications.find(conditions, { projection: { message: 1, is_seen: 1, title: 1, is_read: 1, created: 1, notification_type: 1, extra_parameters: 1, user_role_id: 1, parent_table_id: 1, message_descriptions: 1, title_descriptions: 1 } }).sort({ _id: Constants.SORT_DESC }).skip(skip).limit(limit).toArray().then(result => {
						callback(null, result);
					}).catch(err => callback(err));
				},
				(callback) => {
					/** Get total number of records in notifications collection **/
					notifications.countDocuments(conditions).then(countResult => {
						callback(null, countResult);
					}).catch(err => callback(err));
				},
				(callback) => {
					if (skip != Constants.DEFAULT_SKIP) return callback(null, null);

					/** Mark notifications as read/seen when loading from start **/
					notifications.updateMany(conditions, { $set: { is_read: Constants.READ, is_seen: Constants.SEEN } }).then(() => {
						callback(null, null);
					}).catch(err => callback(err));
				}
			], (err, response) => {
				if (err) return next(err);

				/** Send response **/
				let recordsTotal = (response[1]) ? response[1] : 0;
				resolve({
					status: Constants.STATUS_SUCCESS,
					limit: limit,
					result: (response[0]) ? response[0] : [],
					recordsTotal: recordsTotal,
					recordsSkipTotal: Math.max(0, recordsTotal - skip),
				});
			});
		});
	}//End getNotifications()
}// End Notification