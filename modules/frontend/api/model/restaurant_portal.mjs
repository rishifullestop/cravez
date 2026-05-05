import { ObjectId } from 'mongodb';
import { parallel as asyncParallel } from 'async';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from '../../../../utils/index.mjs';
import { assignCaptainValidation, rejectOrderRequestValidation } from '../validations/restaurant_portal.mjs';

export default class RestaurantPortal {
	constructor(db) {
		this.db = db;
	}

	/**
	 * Function to assign captain to order
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async assignCaptain(req, res, next) {
		return new Promise(async resolve => {
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let orderId = (req.body.order_id) ? req.body.order_id : "";
			let authId = (req.body.user_id) ? req.body.user_id : "";
			let authRoleId = (req.body.user_role_id) ? req.body.user_role_id : "";
			let userType = (req.body.user_type) ? req.body.user_type : "";
			let captainName = (req.body.captain_name) ? req.body.captain_name : "";
			let captainMobile = (req.body.captain_number) ? req.body.captain_number : "";

			if (!userType || !authId || !authRoleId || !orderId) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters"), missing_fields: ["user_type", "order_captain_id", "user_id", "user_role_id"] });

			let validationResponse = await Helpers.applyValidationInterCallFunction(req, res, next, assignCaptainValidation);
			if (validationResponse.status != Constants.STATUS_SUCCESS) return resolve(validationResponse);

			if (captainMobile) {
				let checkResponse = Helpers.checkNumberValid(req, res, next, { mobile_number: captainMobile });
				if (checkResponse.status != Constants.STATUS_SUCCESS) {
					return resolve({ status: Constants.STATUS_ERROR, message: checkResponse.errors });
				}
			}

			const orders = this.db.collection(Tables.ORDERS);
			orders.findOneAndUpdate(
				{ _id: new ObjectId(orderId) },
				{ $set: { order_status: Constants.ORDER_ON_THE_WAY, captain_name: captainName, captain_number: captainMobile } },
				{ projection: { _id: 1, restaurant_status: 1, customer_id: 1 }}
			).then(updateResult => {
				let orderDetails = updateResult || {};
				let orderIdRes = (orderDetails._id) ? orderDetails._id : '';
				let orderStatus = (orderDetails.restaurant_status) ? orderDetails.restaurant_status : '';
				let customerId = (orderDetails.customer_id) ? new ObjectId(orderDetails.customer_id) : '';

				Helpers.saveOrderStatusLogs(req, res, next, {
					updated_by: authId,
					captain_name: captainName,
					user_id: customerId,
					user_role_id: authRoleId,
					status: Constants.ORDER_ON_THE_WAY,
					order_status: orderStatus,
					order_id: orderIdRes,
					user_type: userType,
				}).then(() => {
					resolve({ status: Constants.STATUS_SUCCESS, message: res.__("orders.status_has_been_updated_successfully"), order_status: orderStatus });
				});
			}).catch(err => next(err));
		});
	}

	/**
	 * Function to get captain info
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	async getCaptainInfo(req, res, next) {
		return new Promise(resolve => {
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let orderId = (req.body.order_id) ? new ObjectId(req.body.order_id) : "";

			if (!orderId) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters") });

			const orders = this.db.collection(Tables.ORDERS);
			orders.findOne({ _id: orderId }, { projection: { captain_id: 1, order_date: 1 } }).then(orderResult => {
				if (!orderResult) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });
				if (!orderResult.captain_id) return resolve({ status: Constants.STATUS_ERROR, message: res.__("orders.captain_not_assigned") });

				let captainId = new ObjectId(orderResult.captain_id);
				const users = this.db.collection(Tables.USERS);
				users.findOne({ _id: captainId }, { projection: { _id: 1, full_name: 1, vehicle_id: 1 } }).then(userResult => {
					if (!userResult) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

					let vehicleId = new ObjectId(userResult.vehicle_id);
					const driver_vehicles = this.db.collection(Tables.DRIVER_VEHICLES);
					driver_vehicles.findOne({ _id: vehicleId }, { projection: { plate_number: 1, vehicle_type: 1 } }).then(vehicleResult => {
						if (!vehicleResult) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

						let finalResult = {
							captain_id: userResult._id,
							captain_name: userResult.full_name,
							vehicle_number: vehicleResult.plate_number,
							time_of_arrival: orderResult.order_date,
							vehicle_type: Constants.VEHICLE_TYPE[vehicleResult.vehicle_type]
						};
						resolve({ status: Constants.STATUS_SUCCESS, captain_info: finalResult });
					}).catch(err => next(err));
				}).catch(err => next(err));
			}).catch(err => next(err));
		}).catch(next);
	}

	/**
	 * Function for update order status
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return render
	 */
	async updateOrderStatus(req, res, next) {
		return new Promise(resolve => {
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let orderId = (req.body.order_id) ? req.body.order_id : "";
			let orderStatus = (req.body.order_status) ? req.body.order_status : "";
			let authId = (req.body.user_id) ? req.body.user_id : "";
			let restauarntId = (req.body.restaurant_id) ? req.body.restaurant_id : "";
			let userType = (req.body.user_type) ? req.body.user_type : "";
			let authRoleId = (req.body.user_role_id) ? req.body.user_role_id : "";
			let updateKfg = (req.body.update_kfg) ? req.body.update_kfg : "";

			if (!userType || !restauarntId || !authId || !authRoleId || !orderId || !orderStatus) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters"), missing_fields: ["user_type", "order_id", "user_id", "user_role_id", "restaurant_id", "order_status"] });
			if (!Constants.RESTAURANT_ORDER_STATUS_TYPES[orderStatus]) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

			const orders = this.db.collection(Tables.ORDERS);
			orders.findOne({ _id: new ObjectId(orderId) }, { projection: { _id: 1, unique_order_id: 1, customer_id: 1, branch_id: 1, restaurant_status: 1 } }).then(orderResult => {
				if (!orderResult) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

				let branchId = (orderResult.branch_id) ? orderResult.branch_id : '';
				let customerId = (orderResult.customer_id) ? new ObjectId(orderResult.customer_id) : '';
				let currentStatus = (orderResult.restaurant_status) ? orderResult.restaurant_status : '';

				let updateData = { $set: { order_status: orderStatus, modified: Helpers.getUtcDate() } };
				if (orderStatus == Constants.ORDER_PREPARING && updateKfg) {
					updateData["$unset"] = { reject_by_kfg: 1, is_completed: 1 };
				}

				orders.updateOne({ _id: new ObjectId(orderId) }, updateData).then(() => {
					Helpers.saveOrderStatusLogs(req, res, next, {
						updated_by: authId,
						user_role_id: authRoleId,
						status: orderStatus,
						order_status: currentStatus,
						restaurant_id: restauarntId,
						order_id: orderId,
						branch_id: branchId,
						user_id: customerId,
						user_type: userType,
					}).then(() => {
						resolve({ status: Constants.STATUS_SUCCESS, message: res.__("orders.status_has_been_updated_successfully"), current_status: currentStatus });
					});
				}).catch(err => next(err));
			}).catch(err => next(err));
		}).catch(err => next(err));
	}

	/**
	 * Function to reject order request
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async rejectOrderRequest(req, res, next) {
		return new Promise(async resolve => {
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let orderId = (req.body.order_id) ? req.body.order_id : "";
			let authId = (req.body.user_id) ? req.body.user_id : "";
			let authRoleId = (req.body.user_role_id) ? req.body.user_role_id : "";
			let userType = (req.body.user_type) ? req.body.user_type : "";
			let rejectionReason = (req.body.rejection_reason) ? req.body.rejection_reason : "";

			if (!orderId || !authId || !authRoleId || !userType) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters"), missing_fields: ["user_type", "order_id", "user_id", "user_role_id"] });

			let validationResponse = await Helpers.applyValidationInterCallFunction(req, res, next, rejectOrderRequestValidation);
			if (validationResponse.status != Constants.STATUS_SUCCESS) return resolve(validationResponse);

			const orders = this.db.collection(Tables.ORDERS);
			orders.findOneAndUpdate(
				{ _id: new ObjectId(orderId) },
				{ $set: { order_status: Constants.ORDER_REJECTED, rejection_reason: rejectionReason } },
				{ projection: { _id: 1, order_status: 1, customer_id: 1, restaurant_status: 1 } }
			).then(updateResult => {
				let orderDetails = updateResult || {};
				let orderIdRes = (orderDetails._id) ? orderDetails._id : '';
				let orderStatus = (orderDetails.restaurant_status) ? orderDetails.restaurant_status : '';
				let customerId = (orderDetails.customer_id) ? new ObjectId(orderDetails.customer_id) : '';

				Helpers.saveOrderStatusLogs(req, res, next, {
					send_notification_call_center: true,
					updated_by: authId,
					user_id: customerId,
					user_role_id: authRoleId,
					status: Constants.ORDER_REJECTED,
					order_status: orderStatus,
					order_id: orderIdRes,
					user_type: userType,
				}).then(() => {
					resolve({ status: Constants.STATUS_SUCCESS, message: res.__("orders.status_has_been_updated_successfully"), order_status: orderStatus });
				});
			}).catch(err => next(err));
		}).catch(err => next(err));
	}

	/**
	 * Function to get restaurant dashboard
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	async restaurantDashboard(req, res, next) {
		return new Promise(resolve => {
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let restaurantId = (req.body.restaurant_id) ? new ObjectId(req.body.restaurant_id) : "";
			let branchId = (req.body.branch_id) ? new ObjectId(req.body.branch_id) : "";

			if (!restaurantId) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters") });

			const orders = this.db.collection(Tables.ORDERS);
			const tmp_restaurant_menus = this.db.collection(Tables.TMP_RESTAURANT_MENUS);
			const restaurant_menus = this.db.collection(Tables.RESTAURANT_MENUS);
			const items = this.db.collection(Tables.ITEMS);
			const tmp_items = this.db.collection(Tables.TMP_ITEMS);

			asyncParallel({
				order_stats: (callback) => {
					orders.aggregate([
						{$match	: {
							restaurant_id: restaurantId,
							is_confirm: true,
							...(branchId && {
								branch_id : branchId,
							} || {})
						}},
						{$group	: {
							_id	: null,
							total_orders_delivered : {$sum : {
								$cond: [
									{$and: [
										{ $eq : ["$restaurant_status",Constants.ORDER_DELIVERED] }
									]},
									1,
									0
								]}
							},
							total_orders_cancelled : {$sum : {
								$cond: [
									{$and: [
										{ $eq : ["$restaurant_status",Constants.ORDER_CANCELLED] }
									]},
									1,
									0
								]}
							},
							total_orders_rejected : {$sum : {
								$cond: [
									{$and: [
										{ $eq : ["$restaurant_status",Constants.ORDER_REJECTED] }
									]},
									1,
									0
								]}
							},
							total_payout : {$sum : {
								$cond: [
									{$and: [
										{ $gt : ["$restaurant_payout",0] }
									]},
									'$restaurant_payout',
									0
								]}
							},
						}}
					]).toArray().then(r => callback(null, r?.[0] || {} )).catch(err => callback(err));
				},
				total_menu_rejected: (callback) => {
					let menuRejectedConditions = { restaurant_id: restaurantId, status: Constants.REJECTED };
					tmp_restaurant_menus.countDocuments(menuRejectedConditions).then(r => callback(null, r)).catch(err => callback(err));
				},
				total_menus: (callback) => {
					restaurant_menus.countDocuments({ restaurant_id: restaurantId }).then(r => callback(null, r)).catch(err => callback(err));
				},
				total_items: (callback) => {
					items.countDocuments({ restaurant_id: restaurantId }).then(r => callback(null, r)).catch(err => callback(err));
				},
				total_menu_pending: (callback) => {
					let menuPendingConditions = { restaurant_id: restaurantId, status: Constants.PENDING };
					tmp_restaurant_menus.countDocuments(menuPendingConditions).then(r => callback(null, r)).catch(err => callback(err));
				},
				total_item_pending: (callback) => {
					let itemPendingConditions = { restaurant_id: restaurantId, status: Constants.PENDING };
					tmp_items.countDocuments(itemPendingConditions).then(r => callback(null, r)).catch(err => callback(err));
				},
				total_item_rejected: (callback) => {
					let itemRejectedConditions = { restaurant_id: restaurantId, status: Constants.REJECTED };
					tmp_items.countDocuments(itemRejectedConditions).then(r => callback(null, r)).catch(err => callback(err));
				},
			}, (asyncErr, asyncResponse) => {
				if (asyncErr) return resolve(asyncErr);

				let odStats = asyncResponse?.order_stats | {};
				resolve({
					status: Constants.STATUS_SUCCESS,
					menus_rejected: asyncResponse.total_menu_rejected,
					total_menus: asyncResponse.total_menus,
					total_items: asyncResponse.total_items,
					pending_menus: asyncResponse.total_menu_pending,
					pending_items: asyncResponse.total_item_pending,
					items_rejected: asyncResponse.total_item_rejected,
					total_orders_delivered: odStats.total_orders_delivered,
					total_cancelled_order: odStats.total_orders_cancelled,
					total_rejected_orders: odStats.total_orders_rejected,
					restaurant_revenue: Helpers.currencyFormat(odStats.total_payout > 0 && odStats.total_payout || 0),
				});
			});
		});
	}
}// End RestaurantPortal
