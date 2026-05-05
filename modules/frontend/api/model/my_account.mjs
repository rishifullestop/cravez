import { ObjectId } from 'mongodb';
import clone from 'clone';
import { parallel as asyncParallel, each as asyncEach } from 'async';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from '../../../../utils/index.mjs';
import { sendMailToUsers, sendMail, sendSMS, insertNotifications } from '../../../../services/index.mjs';
import registrationModal from './registration.mjs';
import assignmentModal from './assignment.mjs';
import driverExcuseModal from './driver_excuse.mjs';
import driverBreaksModal from './driver_breaks.mjs';
import {updateProfileValidation, changePasswordValidation, driverEditProfileValidation, customerEditProfileValidation, sendOtpToMobileValidation, updateCustomerMobileNumberValidation, sendOtpToEmailValidation, updateCustomerEmailValidation} from '../validations/my_account.mjs';

export default class MyAccount {
	constructor(db) {
		this.db = db;
		this.registrationAPI = new registrationModal(db);
		this.assignmentAPI = new assignmentModal(db);
		this.driverExcuseAPI = new driverExcuseModal(db);
		this.driverBreaksAPI = new driverBreaksModal(db);
	}

	/**
	 * Function to update profile
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async updateProfile(req, res, next) {
		return new Promise(async resolve => {
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let userId = (req.body.user_id) ? req.body.user_id : "";
			if (!userId) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

			let validationResponse = await Helpers.applyValidationInterCallFunction(req, res, next, updateProfileValidation);
			if (validationResponse.status != Constants.STATUS_SUCCESS) return resolve(validationResponse);

			let name = {
				ar: req.body.name_in_english ? req.body.name_in_english : "",
				en: req.body.name_in_arabic ? req.body.name_in_arabic : ""
			};
			if (req.session && req.session.user) req.session.user.name = name;

			let dataToBeUpdated = {
				name: name,
				restaurant_description: (req.body.restaurant_description) ? req.body.restaurant_description : "",
				restaurant_address: (req.body.restaurant_address) ? req.body.restaurant_address : "",
				contact_person_name: (req.body.contact_person_name) ? req.body.contact_person_name : "",
				account_manager_name: (req.body.account_manager_name) ? req.body.account_manager_name : "",
				email: (req.body.email_address) ? req.body.email_address : "",
				modified: Helpers.getUtcDate()
			};

			const users = this.db.collection(Tables.USERS);
			users.updateOne({ _id: new ObjectId(userId) }, { $set: dataToBeUpdated }).then(() => {
				resolve({ status: Constants.STATUS_SUCCESS, message: res.__("user.profile_has_been_changed_successfully") });
			}).catch(err => next(err));
		}).catch(err => next(err));
	}

	/**
	 * Function to get dashboard data
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async dashboard(req, res, next) {
		return new Promise(async resolve => {
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let userId = (req.body.user_id) ? new ObjectId(req.body.user_id) : "";
			if (!userId) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

			let userOptions = {
				conditions: { _id: new ObjectId(userId), user_type: Constants.USER_TYPE_RESTAURANT, is_deleted: Constants.NOT_DELETED, active: Constants.ACTIVE },
				fields: { mobile_otp: 0, email_otp: 0, is_deleted: 0, created: 0, device_details: 0, modified: 0, mobile_otp_expiry_time: 0, email_otp_expiry_time: 0, password: 0 }
			};

			let userResponse = await this.registrationAPI.getUserData(req, res, next, userOptions);
			if (userResponse.status != Constants.STATUS_SUCCESS) return next(userResponse.message);
			let resultData = (userResponse.result) ? userResponse.result : "";
			if (!resultData) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access"), logout: true });
			resolve({ status: Constants.STATUS_SUCCESS, result: resultData });
		}).catch(err => next(err));
	}

	/**
	 * Function to get user details
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async getUserDetails(req, res, next) {
		return new Promise(resolve => {
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let userId = (req.body.user_id) ? req.body.user_id : "";
			if (!userId) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

			let options = {
				conditions: { _id: new ObjectId(userId), user_type: Constants.USER_TYPE_RESTAURANT, is_deleted: Constants.NOT_DELETED, active: Constants.ACTIVE },
				fields: { _id: 1, name: 1, restaurant_address: 1, email: 1, mobile_number: 1, contact_person_name: 1, account_manager_name: 1, restaurant_description: 1 }
			};

			this.registrationAPI.getUserData(req, res, next, options).then(response => {
				if (response.status != Constants.STATUS_SUCCESS) return next(response.message);
				resolve({ status: Constants.STATUS_SUCCESS, result: (response.result) ? response.result : {} });
			}).catch(next);
		}).catch(err => next(err));
	}

	/**
	 * Function to update user password for restaurant/users/customers/drivers
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async changePassword(req, res, next) {
		return new Promise(async resolve => {
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let userId = (req.body.user_id) ? req.body.user_id : "";
			let userType = (req.body.user_type) ? req.body.user_type : "";
			if (!userId || !userType) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

			let validationResponse = await Helpers.applyValidationInterCallFunction(req, res, next, changePasswordValidation);
			if (validationResponse.status != Constants.STATUS_SUCCESS) return resolve(validationResponse);

			let password = (req.body.password) ? req.body.password : "";
			let oldPassword = (req.body.old_password) ? req.body.old_password : "";
			let userConditions = {};
			if (userType == Constants.USER_TYPE_DRIVER) userConditions = clone(Constants.DRIVER_COMMON_CONDITIONS);
			else if (userType == Constants.USER_TYPE_CUSTOMER) userConditions = clone(Constants.CUSTOMER_COMMON_CONDITIONS);
			else userConditions = clone(Constants.FRONT_USER_COMMON_CONDITIONS);
			userConditions._id = new ObjectId(userId);

			let options = { conditions: userConditions, fields: { _id: 1, password: 1, restaurant_id: 1, user_role_id: 1 } };

			this.registrationAPI.getUserData(req, res, next, options).then(response => {
				if (response.status != Constants.STATUS_SUCCESS) return next(response.message);
				let resultData = (response.result) ? response.result : "";
				if (!resultData) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

				let newPassword = Helpers.generateMD5Hash(password);
				let oldPasswordHash = Helpers.generateMD5Hash(oldPassword);
				let userPassword = (resultData.password) ? resultData.password : "";
				if (oldPasswordHash != userPassword) {
					return resolve({ status: Constants.STATUS_ERROR, message: [{ 'param': 'old_password', 'msg': res.__("user.sorry_current_password_you_have_provided_is_wrong_take_a_bit_of_time_think_and_try_again") }] });
				}

				const users = this.db.collection(Tables.USERS);
				users.updateOne({ _id: new ObjectId(userId) }, { $set: { password: newPassword, modified: Helpers.getUtcDate() } }).then(() => {
					resolve({ status: Constants.STATUS_SUCCESS, message: res.__("user.success_your_password_has_been_changed_successfully") });
					if (resultData.restaurant_id && (userType != Constants.USER_TYPE_DRIVER && userType != Constants.USER_TYPE_CUSTOMER)) {
						sendMailToUsers(req, res, { event_type: Constants.NOTIFICATION_FOR_RESTAURANT_UPDATED_PASSWORD, restaurant_id: resultData.restaurant_id, user_role_id: resultData.user_role_id, user_id: resultData._id });
					}
				}).catch(err => next(err));
			}).catch(err => next(err));
		}).catch(err => next(err));
	}

	/**
	 * Function to update driver profile
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	async driverEditProfile(req, res, next) {
		return new Promise(async resolve => {
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let userId = (req.body.user_id) ? req.body.user_id : "";
			if (!userId) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

			let validationResponse = await Helpers.applyValidationInterCallFunction(req, res, next, driverEditProfileValidation);
			if (validationResponse.status != Constants.STATUS_SUCCESS) return resolve(validationResponse);

			let firstName = req.body.first_name;
			let lastName = req.body.last_name;
			let fullName = firstName + ' ' + lastName;

			const users = this.db.collection(Tables.USERS);
			users.updateOne({ _id: new ObjectId(userId) }, { $set: { first_name: firstName, last_name: lastName, full_name: fullName, modified: Helpers.getUtcDate() } }).then(() => {
				let options = { conditions: { _id: new ObjectId(userId), is_deleted: Constants.NOT_DELETED, active: Constants.ACTIVE }, fields: { otp: 0, email_otp: 0, is_deleted: 0, created: 0, device_details: 0, modified: 0, password: 0 } };
				this.registrationAPI.getUserData(req, res, next, options).then(response => {
					if (response.status != Constants.STATUS_SUCCESS) return next(response.message);
					resolve({ status: Constants.STATUS_SUCCESS, result: response.result, message: res.__("user.profile_has_been_changed_successfully") });
				}).catch(next);
			}).catch(err => next(err));
		}).catch(err => next(err));
	}

	/**
	 * Function to update customer profile
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	async customerEditProfile(req, res, next) {
		return new Promise(async resolve => {
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let userId = (req.body.user_id) ? req.body.user_id : "";
			if (!userId) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

			let validationResponse = await Helpers.applyValidationInterCallFunction(req, res, next, customerEditProfileValidation);
			if (validationResponse.status != Constants.STATUS_SUCCESS) return resolve(validationResponse);

			let firstName = req.body.first_name;
			let lastName = req.body.last_name;
			let fullName = firstName + ' ' + lastName;

			const users = this.db.collection(Tables.USERS);
			users.updateOne({ _id: new ObjectId(userId) }, {
				$set: {
					first_name: firstName,
					last_name: lastName,
					full_name: fullName,
					gender: req.body.gender,
					date_of_birth: Helpers.getUtcDate(req.body.date_of_birth + " " + Constants.START_DATE_TIME_FORMAT),
					modified: Helpers.getUtcDate()
				}
			}).then(() => {
				let options = { conditions: { _id: new ObjectId(userId), is_deleted: Constants.NOT_DELETED, active: Constants.ACTIVE }, fields: { otp: 0, email_otp: 0, is_deleted: 0, created: 0, device_details: 0, modified: 0, password: 0 } };
				this.registrationAPI.getUserData(req, res, next, options).then(response => {
					if (response.status != Constants.STATUS_SUCCESS) return next(response.message);
					resolve({ status: Constants.STATUS_SUCCESS, result: response.result, message: res.__("user.profile_has_been_changed_successfully") });
					Helpers.updateUserDetailsInOrders(req, res, next, { user_id: userId }).then(() => { });
				}).catch(next);
			}).catch(err => next(err));
		}).catch(next);
	}

	/**
	 * Function to get customer and driver details
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async getDriverCustomerDetails(req, res, next) {
		return new Promise(resolve => {
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let userId = (req.body.user_id) ? req.body.user_id : "";
			if (!userId) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

			let options = {
				conditions: { _id: new ObjectId(userId), is_deleted: Constants.NOT_DELETED, active: Constants.ACTIVE },
				fields: { otp: 0, email_otp: 0, is_deleted: 0, created: 0, device_details: 0, modified: 0, password: 0, package_id: 0, package_valid_till: 0, remaining_package_orders: 0 }
			};

			this.registrationAPI.getUserData(req, res, next, options).then(response => {
				if (response.status != Constants.STATUS_SUCCESS) return next(response.message);
				resolve({ status: Constants.STATUS_SUCCESS, result: (response.result) ? response.result : {} });
			}).catch(next);
		});
	}

	/**
	 * Function to send otp to mobile number
	 **/
	async sendOtpToMobile(req, res, next) {
		return new Promise(async resolve => {
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let userId = (req.body.user_id) ? req.body.user_id : "";
			let userType = (req.body.user_type) ? req.body.user_type : "";
			if (!userId || (userType && userType != Constants.USER_TYPE_CUSTOMER && userType != Constants.USER_TYPE_DRIVER)) {
				return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });
			}

			let validationResponse = await Helpers.applyValidationInterCallFunction(req, res, next, sendOtpToMobileValidation);
			if (validationResponse.status != Constants.STATUS_SUCCESS) return resolve(validationResponse);

			let mobileNumber = req.body.mobile_number;
			let errors = [];
			if (mobileNumber) {
				let checkResponse = Helpers.checkNumberValid(req, res, next, { mobile_number: mobileNumber });
				if (checkResponse.status != Constants.STATUS_SUCCESS) {
					if (!errors) errors = [];
					errors = errors.concat(checkResponse.errors || []);
				}
			}
			if (errors) return resolve({ status: Constants.STATUS_ERROR, message: errors });

			let userConditions = {};
			if (!userType || userType == Constants.USER_TYPE_CUSTOMER) userConditions = clone(Constants.CUSTOMER_COMMON_CONDITIONS);
			else userConditions = clone(Constants.DRIVER_COMMON_CONDITIONS);
			userConditions._id = new ObjectId(userId);

			const users = this.db.collection(Tables.USERS);
			users.findOne({ is_deleted: Constants.NOT_DELETED, mobile_number: mobileNumber }, { projection: { _id: 1, mobile_number: 1 } }).then(findResult => {
				if (findResult && findResult.mobile_number == mobileNumber) {
					return resolve({ status: Constants.STATUS_ERROR, message: [{ 'param': 'mobile_number', 'msg': res.__("user.your_mobile_number_is_already_exist") }] });
				}
				users.countDocuments(userConditions).then(countResult => {
					if (countResult == 0) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });

					let mobileOtp = Helpers.getRandomOTP();
					users.updateOne(userConditions, { $set: { otp: mobileOtp, modified: Helpers.getUtcDate() } }).then(() => {

						resolve({ status: Constants.STATUS_SUCCESS, message: res.__("user.please_verify_your_mobile_number_otp_has_been_sent"), otp: mobileOtp });

						let countryCode = Constants.DEFAULT_COUNTRY_CODE;
						let testingMobiles = (res.locals.settings['Site.testing_mobile_numbers']) ? res.locals.settings['Site.testing_mobile_numbers'].split(",") : [];
						if (testingMobiles.indexOf(mobileNumber) !== -1) countryCode = "+91";
						sendSMS(req, res, { sms_type: Constants.SMS_TEMPLATE_FOR_UPDATE_MOBILE_NUMBER_EDIT_PROFILE, user_id: userId, mobile_number: countryCode + mobileNumber, message_params: [mobileOtp] }).then(() => { });
					}).catch(err => next(err));
				}).catch(err => next(err));
			}).catch(err => next(err));
		}).catch(next);
	}

	/**
	 * Function to update customer mobile number
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	async updateCustomerMobileNumber(req, res, next) {
		return new Promise(async resolve => {
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let userId = (req.body.user_id) ? req.body.user_id : "";
			let userType = (req.body.user_type) ? req.body.user_type : "";
			let otp = req.body.otp;
			if (!userId || (userType && userType != Constants.USER_TYPE_CUSTOMER && userType != Constants.USER_TYPE_DRIVER)) {
				return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });
			}

			let validationResponse = await Helpers.applyValidationInterCallFunction(req, res, next, updateCustomerMobileNumberValidation);
			if (validationResponse.status != Constants.STATUS_SUCCESS) return resolve(validationResponse);

			let mobileNumber = req.body.mobile_number;
			if (mobileNumber) {
				let checkResponse = await Helpers.checkNumberValid(req, res, next, { mobile_number: mobileNumber });
				if (checkResponse.status != Constants.STATUS_SUCCESS) {
					return resolve({ status: Constants.STATUS_ERROR, message: checkResponse.errors });
				}
			}

			let userConditions = {};
			if (!userType || userType == Constants.USER_TYPE_CUSTOMER) userConditions = clone(Constants.CUSTOMER_COMMON_CONDITIONS);
			else userConditions = clone(Constants.DRIVER_COMMON_CONDITIONS);
			userConditions._id = new ObjectId(userId);

			const users = this.db.collection(Tables.USERS);
			users.findOne(userConditions, { projection: { otp: 1 } }).then(findResult => {
				if (!findResult) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });
				if (findResult.otp != otp) return resolve({ status: Constants.STATUS_ERROR, message: res.__("user.please_enter_valid_otp") });
				users.updateOne(userConditions, { $set: { mobile_number: mobileNumber, modified: Helpers.getUtcDate() }, $unset: { otp: 1 } }).then(() => {
					resolve({ status: Constants.STATUS_SUCCESS, message: res.__("user.mobile_number_has_been_updated_successfully") });
				}).catch(err => next(err));
			}).catch(err => next(err));
		}).catch(next);
	}

	/**
	 * Function to send otp to email
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	async sendOtpToEmail(req, res, next) {
		return new Promise(async resolve => {
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let userId = (req.body.user_id) ? req.body.user_id : "";
			let userType = (req.body.user_type) ? req.body.user_type : "";
			if (!userId || (userType && userType != Constants.USER_TYPE_CUSTOMER && userType != Constants.USER_TYPE_DRIVER)) {
				return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });
			}

			let validationResponse = await Helpers.applyValidationInterCallFunction(req, res, next, sendOtpToEmailValidation);
			if (validationResponse.status != Constants.STATUS_SUCCESS) return resolve(validationResponse);

			let userConditions = {};
			if (!userType || userType == Constants.USER_TYPE_CUSTOMER) userConditions = clone(Constants.CUSTOMER_COMMON_CONDITIONS);
			else userConditions = clone(Constants.DRIVER_COMMON_CONDITIONS);
			userConditions._id = new ObjectId(userId);

			const users = this.db.collection(Tables.USERS);
			users.findOne({ is_deleted: Constants.NOT_DELETED, email: req.body.email }, { projection: { _id: 1, email: 1 } }).then(findResult => {
				if (findResult && findResult.email == req.body.email.toLowerCase()) {
					return resolve({ status: Constants.STATUS_ERROR, message: [{ 'param': 'email', 'msg': res.__("user.your_email_id_is_already_exist") }] });
				}
				users.findOne(userConditions, { projection: { full_name: 1 } }).then(userResult => {
					if (!userResult) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });
					let emailOtp = Helpers.getRandomOTP();
					let email = (req.body.email) ? req.body.email : "";
					users.updateOne(userConditions, { $set: { otp: emailOtp, modified: Helpers.getUtcDate() } }).then(() => {
						resolve({ status: Constants.STATUS_SUCCESS, message: res.__("user.please_verify_your_email_otp_has_been_sent"), otp: emailOtp });
						let fullName = (userResult.full_name) ? userResult.full_name : "";
						if (email) sendMail(req, res, { to: email, action: "send_otp", rep_array: [fullName, emailOtp] });
					}).catch(err => next(err));
				}).catch(err => next(err));
			}).catch(err => next(err));
		}).catch(next);
	}

	/**
	 * Function to update customer email
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	async updateCustomerEmail(req, res, next) {
		return new Promise(async resolve => {
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let userId = (req.body.user_id) ? req.body.user_id : "";
			let userType = (req.body.user_type) ? req.body.user_type : "";
			if (!userId || (userType && userType != Constants.USER_TYPE_CUSTOMER && userType != Constants.USER_TYPE_DRIVER)) {
				return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });
			}

			let validationResponse = await Helpers.applyValidationInterCallFunction(req, res, next, updateCustomerEmailValidation);
			if (validationResponse.status != Constants.STATUS_SUCCESS) return resolve(validationResponse);

			let userConditions = {};
			if (!userType || userType == Constants.USER_TYPE_CUSTOMER) userConditions = clone(Constants.CUSTOMER_COMMON_CONDITIONS);
			else userConditions = clone(Constants.DRIVER_COMMON_CONDITIONS);
			userConditions._id = new ObjectId(userId);

			let email = req.body.email;
			let otp = req.body.otp;
			const users = this.db.collection(Tables.USERS);
			users.findOne(userConditions, { projection: { otp: 1 } }).then(findResult => {
				if (!findResult) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });
				if (findResult.otp != otp) return resolve({ status: Constants.STATUS_ERROR, message: res.__("user.please_enter_valid_otp") });
				users.updateOne(userConditions, { $set: { is_email_verified: Constants.VERIFIED, email: email, modified: Helpers.getUtcDate() }, $unset: { otp: 1 } }).then(() => {
					resolve({ status: Constants.STATUS_SUCCESS, message: res.__("user.email_has_been_updated_successfully") });
				}).catch(err => next(err));
			}).catch(err => next(err));
		}).catch(next);
	}

	/**
	 * Function to update driver location
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async updateDriverLocation(req, res, next) {
		return new Promise(resolve => {
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let userId = (req.body.user_id) ? new ObjectId(req.body.user_id) : "";
			let latitude = (req.body.latitude) ? parseFloat(req.body.latitude) : "";
			let longitude = (req.body.longitude) ? parseFloat(req.body.longitude) : "";
			let address = (req.body.address) ? req.body.address : "";
			if (!userId || !latitude || !longitude) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

			let userConditions = clone(Constants.DRIVER_COMMON_CONDITIONS);
			userConditions._id = userId;

			const users = this.db.collection(Tables.USERS);
			users.findOne(userConditions, { projection: { _id: 1, longitude: 1, latitude: 1, orders: 1, user_role_id: 1 } }).then(userResult => {
				if (!userResult) return resolve({ status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") });

				let userLatitude = userResult.latitude;
				let userLongitude = userResult.longitude;
				let userOrders = userResult.orders;
				let userRoleId = userResult.user_role_id;

				asyncParallel({
					distance: (callback) => {
						if (!userLatitude && !userLongitude) return callback(null, null);
						this.assignmentAPI.getGeoLocations(req, res, next, { to_lat: latitude, to_long: longitude, from_lat: userLatitude, from_long: userLongitude }).then(response => {
							if (response.status != Constants.STATUS_SUCCESS) return callback(response);
							callback(null, response.distance);
						}).catch(next);
					}
				}, (asyncErr, asyncResponse) => {
					if (asyncErr) return resolve(asyncErr);
					let distanceInMeters = (asyncResponse.distance) ? parseInt(asyncResponse.distance) : 0;
					asyncParallel({
						user_location_logs: (callback) => {
							const user_locations_logs = this.db.collection(Tables.USER_LOCATIONS_LOGS);
							user_locations_logs.insertOne({
								user_id: userId, latitude: latitude, longitude: longitude, long_lat: [longitude, latitude],
								distance_from_last_location: distanceInMeters, address: address, created: Helpers.getUtcDate()
							}).then(() => callback(null)).catch(err => callback(err));
						},
						save_user_details: (callback) => {
							users.updateOne({ _id: userId }, { $set: { longitude: longitude, latitude: latitude, long_lat: [longitude, latitude], location_address: address } }).then(() => callback(null)).catch(err => callback(err));
						},
						update_order_status: (callback) => {
							callback(null, null);
							if (userOrders && userOrders.length > 0) {
								let nearByMeter = (res.locals.settings['Site.near_by_distance_from_restaurant_or_drop_location']) ? res.locals.settings['Site.near_by_distance_from_restaurant_or_drop_location'] : 0;
								const order_details = this.db.collection(Tables.ORDER_DETAILS);
								asyncEach(userOrders, (records, eachCallback) => {
									let orderId = records.order_id;
									let orderStatus = records.status;
									if (orderStatus != Constants.ORDER_DRIVER_ACCEPTED && orderStatus != Constants.ORDER_DRIVER_WAY_TO_CUSTOMER) return eachCallback(null);
									order_details.findOne({ order_id: orderId }, { projection: { _id: 1, customer_latitude: 1, customer_longitude: 1, restaurant_latitude: 1, restaurant_longitude: 1 } }).then(orderResult => {
										if (!orderResult) return eachCallback(null);
										let updatedStatus = "";
										let originLatitude = 0, originLongitude = 0;
										if (orderStatus == Constants.ORDER_DRIVER_ACCEPTED) {
											originLatitude = orderResult.restaurant_latitude;
											originLongitude = orderResult.restaurant_longitude;
											updatedStatus = Constants.ORDER_DRIVER_ARRIVED_AT_RESTAURANT;
										} else {
											originLatitude = orderResult.customer_latitude;
											originLongitude = orderResult.customer_longitude;
											updatedStatus = Constants.ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION;
										}
										if (!originLatitude || !originLongitude) return eachCallback(null);
										Helpers.checkDriverNearByLocation(req, res, next, {
											point_lat_long: { latitude: latitude, longitude: longitude },
											center_point_lat_long: { latitude: originLatitude, longitude: originLongitude },
											radius_in_meter: parseFloat(nearByMeter)
										}).then(locationResponse => {
											if (locationResponse.status == Constants.STATUS_SUCCESS && locationResponse.is_nearby) {
												Helpers.saveOrderStatusLogs(req, res, next, { order_id: orderId, user_id: userId, updated_by: userId, user_role_id: userRoleId, user_type: Constants.DRIVER, status: updatedStatus, order_status: orderStatus }).then(() => eachCallback(null));
											} else eachCallback(null);
										});
									}).catch(e => eachCallback(e));
								}, () => { });
							}
						}
					}, (asyncChildErr) => {
						if (asyncChildErr) return next(asyncChildErr);
						resolve({ status: Constants.STATUS_SUCCESS, message: res.__("my_account.location_has_been_updated_successfully") });
					});
				});
			}).catch(err => next(err));
		}).catch(next);
	}

	/**
	 * Function to update online offline status
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async updateOnlineOfflineStatus(req, res, next) {
		return new Promise(resolve => {
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let userId = (req.body.user_id) ? new ObjectId(req.body.user_id) : "";
			let status = (req.body.status) ? req.body.status : "";
			if (!userId || !status) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

			let userConditions = clone(Constants.DRIVER_COMMON_CONDITIONS);
			userConditions._id = userId;

			const users = this.db.collection(Tables.USERS);
			users.findOne(userConditions, { projection: { _id: 1 } }).then(userResult => {
				if (!userResult) return resolve({ status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") });
				users.updateOne({ _id: userId }, { $set: { is_online: parseInt(status) } }).then(() => {
					this.saveOnlineOfflineLogs(req, res, next, { user_id: userId, status: status }).then(() => { }).catch(next);
					resolve({ status: Constants.STATUS_SUCCESS, message: res.__("my_account.status_has_been_updated_successfully") });
				}).catch(err => next(err));
			}).catch(err => next(err));
		});
	}

	/**
	 * Function to save online offline logs
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async saveOnlineOfflineLogs(req, res, next, options = {}) {
		return new Promise(resolve => {
			let userId = (options.user_id) ? options.user_id : "";
			let status = (options.status) ? options.status : "";
			if (!userId || !status) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

			const user_online_logs = this.db.collection(Tables.USER_ONLINE_LOGS);
			user_online_logs.find({ user_id: new ObjectId(userId) }).sort({ _id: Constants.SORT_DESC }).limit(1).toArray().then(result => {
				let lastLogDetails = (result && result[0]) ? result[0] : null;
				let logId = (lastLogDetails && lastLogDetails._id) ? lastLogDetails._id : "";
				let updateRecordId = new ObjectId();

				asyncParallel([
					(callback) => {
						if (status == Constants.ONLINE && lastLogDetails && lastLogDetails.offline_time == "") {
							user_online_logs.updateOne({ _id: new ObjectId(logId) }, { $set: { offline_time: Helpers.getUtcDate() } }).then(() => callback(null, null)).catch(err => callback(err));
						} else callback(null, null);
					},
					(callback) => {
						let dataToBeUpdated = {};
						if (status == Constants.OFFLINE && lastLogDetails && lastLogDetails.offline_time == "" && logId) {
							updateRecordId = new ObjectId(logId);
							dataToBeUpdated.offline_time = Helpers.getUtcDate();
						}
						if (status == Constants.ONLINE) {
							dataToBeUpdated = { user_id: new ObjectId(userId), online_time: Helpers.getUtcDate(), offline_time: "" };
						}
						if (Object.keys(dataToBeUpdated).length < 1) return callback(null, null);
						user_online_logs.updateOne({ _id: updateRecordId }, { $set: dataToBeUpdated }, { upsert: true }).then(() => callback(null, null)).catch(err => callback(err));
					}
				], (err) => {
					if (err) return next(err);
					resolve({ status: Constants.STATUS_SUCCESS });
				});
			}).catch(err => next(err));
		});
	}

	/**
	 * Function to get captain excuses, breaks, in-out shifts
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async captainDashboard(req, res, next) {
		return new Promise(resolve => {
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let userId = (req.body.user_id) ? new ObjectId(req.body.user_id) : "";
			let deviceToken = (req.body.device_token) ? req.body.device_token : "";
			let currentDate = Helpers.newDate("", Constants.DATABASE_DATE_FORMAT);
			let startDate = Helpers.newDate(currentDate + " " + Constants.START_DATE_TIME_FORMAT);
			let endDate = Helpers.newDate(currentDate + " " + Constants.END_DATE_TIME_FORMAT);
			if (!userId) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

			asyncParallel({
				excuse_list: (callback) => {
					this.driverExcuseAPI.getDriverExcuses(req, res, next).then(response => {
						if (response.status != Constants.STATUS_SUCCESS) return callback(response);
						callback(null, response.result);
					}).catch(next);
				},
				break_list: (callback) => {
					this.driverBreaksAPI.getBreaks(req, res, next).then(response => {
						if (response.status != Constants.STATUS_SUCCESS) return callback(response);
						callback(null, response.result);
					}).catch(next);
				},
				inout_list: (callback) => {
					this.driverBreaksAPI.getInOutShifts(req, res, next).then(response => {
						if (response.status != Constants.STATUS_SUCCESS) return callback(response);
						callback(null, response.result);
					}).catch(next);
				},
				shift_details: (callback) => {
					const driver_availabilities = this.db.collection(Tables.DRIVER_AVAILABILITIES);
					driver_availabilities.findOne({ user_id: userId, date: { $gte: startDate, $lte: endDate } }, { projection: { _id: 1, shift_id: 1, area_id: 1 } }).then(driverAvailabilityResult => {
						let shiftId = (driverAvailabilityResult && driverAvailabilityResult.shift_id) ? driverAvailabilityResult.shift_id : "";
						let areaId = (driverAvailabilityResult && driverAvailabilityResult.area_id) ? driverAvailabilityResult.area_id : "";
						asyncParallel({
							area_details: (childCallback) => {
								if (!areaId) return childCallback(null, null);
								this.db.collection(Tables.AREAS).findOne({ _id: new ObjectId(areaId) }, { projection: { _id: 1, name: 1 } }).then(areaResult => childCallback(null, areaResult)).catch(err => childCallback(err));
							},
							shift_time_details: (childCallback) => {
								if (!shiftId) return childCallback(null, null);
								this.db.collection(Tables.SHIFTS).findOne({ _id: new ObjectId(shiftId) }, { projection: { _id: 1, shift_name: 1, start_time: 1, end_time: 1 } }).then(shiftResult => childCallback(null, shiftResult)).catch(err => childCallback(err));
							}
						}, (childAsyncErr, childAsyncResponse) => callback(childAsyncErr, childAsyncResponse));
					}).catch(err => callback(err));
				},
				vehicle_details: (callback) => {
					const users = this.db.collection(Tables.USERS);
					users.findOne({ _id: userId }, { projection: { _id: 1, vehicle_id: 1, image: 1, driver_id: 1, device_details: 1 } }).then(userResult => {
						if (!userResult) return callback(null, null);
						let vehicleId = new ObjectId(userResult.vehicle_id);
						this.db.collection(Tables.DRIVER_VEHICLES).findOne({ _id: vehicleId }, { projection: { _id: 1, vehicle_type: 1, plate_number: 1 } }).then(vehicleResult => {
							callback(null, { vehicle_details: vehicleResult, driver_details: userResult });
						}).catch(err => callback(err));
					}).catch(err => callback(err));
				}
			}, (asyncErr, asyncResponse) => {
				if (asyncErr) return resolve(asyncErr);

				let shiftResult = asyncResponse.shift_details ? asyncResponse.shift_details : {};
				let shiftTimeDetails = shiftResult.shift_time_details ? shiftResult.shift_time_details : {};
				let vehicleResult = asyncResponse.vehicle_details ? asyncResponse.vehicle_details : {};
				let driverVehicleDetails = vehicleResult.vehicle_details ? vehicleResult.vehicle_details : {};
				let driverDetails = vehicleResult.driver_details ? vehicleResult.driver_details : {};
				let deviceDetails = driverDetails.device_details ? driverDetails.device_details : [];
				let areaDetails = shiftResult.area_details ? shiftResult.area_details : {};
				let shiftStartTime = shiftTimeDetails.start_time ? shiftTimeDetails.start_time : 0;
				let shiftEndTime = shiftTimeDetails.end_time ? shiftTimeDetails.end_time : "";
				let shiftDetails = {};
				let captainDetails = {};
				if (areaDetails.name) shiftDetails["area"] = areaDetails.name;
				if (shiftStartTime >= 0 && shiftEndTime >= 0) shiftDetails["shift_time"] = { start_time: Helpers.set24HourFormat(shiftStartTime), end_time: Helpers.set24HourFormat(shiftEndTime) };
				if (driverVehicleDetails.vehicle_type) captainDetails.vehicle_type = Constants.VEHICLE_TYPE[driverVehicleDetails.vehicle_type];
				if (driverVehicleDetails.plate_number) captainDetails.vehicle_number = driverVehicleDetails.plate_number;
				captainDetails.driver_id = (driverDetails.driver_id) ? driverDetails.driver_id : "";
				captainDetails.image = (driverDetails.image) ? driverDetails.image : "";

				let isSameDevice = false;
				if (deviceDetails.length > 0) {
					deviceDetails.map(data => { if (data.device_token && data.device_token == deviceToken) isSameDevice = true; });
				}

				resolve({
					status: Constants.STATUS_SUCCESS,
					excuse: (asyncResponse.excuse_list) ? asyncResponse.excuse_list : {},
					break: (asyncResponse.break_list) ? asyncResponse.break_list : {},
					inout_shift: (asyncResponse.inout_list) ? asyncResponse.inout_list : {},
					shift_details: shiftDetails,
					captain_details: captainDetails,
					image_path: Constants.USERS_URL,
					is_user_logout: (!isSameDevice) ? true : false
				});
			});
		});
	}

	/**
	 * Function to get user location
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async getUserLocation(req, res, next) {
		return new Promise(resolve => {
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let userId = (req.body.auth_id) ? req.body.auth_id : "";
			if (!userId) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

			let options = { conditions: { _id: new ObjectId(userId), is_deleted: Constants.NOT_DELETED }, fields: { _id: 1, full_name: 1, latitude: 1, longitude: 1, vehicle_type: 1 } };
			this.registrationAPI.getUserData(req, res, next, options).then(response => {
				if (response.status != Constants.STATUS_SUCCESS) return next(response.message);
				resolve({ status: Constants.STATUS_SUCCESS, result: (response.result) ? response.result : {} });
			}).catch(next);
		});
	}

	/**
	 * Function to get referral details
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async getReferralDetails(req, res, next) {
		return new Promise(resolve => {
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let userId = (req.body.user_id) ? new ObjectId(req.body.user_id) : "";
			if (!userId) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

			let userConditions = clone(Constants.CUSTOMER_COMMON_CONDITIONS);
			userConditions._id = userId;

			this.db.collection(Tables.USERS).findOne(userConditions, { projection: { referral_details: 1 } }).then(result => {
				if (!result) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });
				let referralDetails = (result.referral_details) ? result.referral_details : {};
				resolve({
					status: Constants.STATUS_SUCCESS,
					referral_code: (referralDetails.referral_code) ? referralDetails.referral_code : "",
					referral_amount: (res.locals.settings['Rewards_and_referrals.referral_amount']) ? res.locals.settings['Rewards_and_referrals.referral_amount'] : 0,
					enable_referral_amount: (res.locals.settings['Rewards_and_referrals.enable_referral_amount']) ? res.locals.settings['Rewards_and_referrals.enable_referral_amount'] : 0
				});
			}).catch(err => next(err));
		});
	}

	/**
	 * Function to save driver gps logs
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async saveDriverGPSLogs(req, res, next) {
		return new Promise(resolve => {
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let userId = (req.body.user_id) ? new ObjectId(req.body.user_id) : "";
			let status = (req.body.status) ? req.body.status : Constants.DRIVER_GPS_OFF;
			if (!userId || !status) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

			let userConditions = clone(Constants.DRIVER_COMMON_CONDITIONS);
			userConditions._id = userId;

			const users = this.db.collection(Tables.USERS);
			const driver_gps_logs = this.db.collection(Tables.DRIVER_GPS_LOGS);
			users.findOne(userConditions, { projection: { _id: 1, full_name: 1, user_role_id: 1 } }).then(userResult => {
				if (!userResult) return resolve({ status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") });

				asyncParallel([
					(callback) => {
						users.updateOne({ _id: userId }, { $set: { gps_status: parseInt(status) } }).then(() => callback(null)).catch(err => callback(err));
					},
					(callback) => {
						driver_gps_logs.updateOne(
							{ driver_id: userId, gps_status: Constants.DRIVER_GPS_ON },
							{ $set: { gps_status: parseInt(status), modified: Helpers.getUtcDate() }, $setOnInsert: { created: Helpers.getUtcDate() } },
							{ upsert: true }
						).then(() => callback(null)).catch(err => callback(err));
					}
				], (asyncErr) => {
					if (asyncErr) return next(asyncErr);
					resolve({ status: Constants.STATUS_SUCCESS, message: res.__("my_account.status_has_been_updated_successfully") });
					if (status != Constants.DRIVER_GPS_ON) {
						insertNotifications(req, res, {
							notification_data: {
								notification_type: Constants.NOTIFICATION_TO_FLEET_DRIVER_SWITCH_OFF_PHONE_GPS,
								message_params: [userResult.full_name],
								parent_table_id: userId,
								user_id: userId,
								user_role_id: userResult.user_role_id,
								only_for_user_role: true,
								role_id: Constants.FLEET
							}
						}).then(() => { });
					}
				});
			}).catch(err => next(err));
		}).catch(next);
	}
}
