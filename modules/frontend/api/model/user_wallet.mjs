import { ObjectId } from 'mongodb';
import clone from 'clone';
import { parallel as asyncParallel } from 'async';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from '../../../../utils/index.mjs';
import { sendMailToUsers } from '../../../../services/index.mjs';
import orderModal from './order.mjs';
import userCartsModal from './user_carts.mjs';
import { transferBalanceValidation } from '../validations/user_wallet.mjs';

export default class UserWallet {
	constructor(db) {
		this.db = db;
		this.orderAPI = new orderModal(db);
		this.userCartsAPI = new userCartsModal(db);
	}

	/**
	 * Function to add money
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async addMoney(req, res, next) {
		return new Promise(resolve => {
			/** Sanitize Data **/
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let userId = (req.body.user_id) ? new ObjectId(req.body.user_id) : "";
			let amount = (req.body.amount) ? req.body.amount : "";
			let paymentResponse = (req.body.payment_response) ? req.body.payment_response : "";
			let paymentMethod = (req.body.payment_method) ? req.body.payment_method : "";
			let paymentCurrency = (req.body.payment_currency) ? req.body.payment_currency : "";

			/** Send error response **/
			if (!userId || !amount || !paymentResponse || !paymentMethod || !paymentCurrency) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access"), missing_fields: ["user_id", "amount", "payment_response", "payment_method", "payment_currency"] });

			/** Set payment save options */
			let paymentOptions = {
				user_id: userId,
				payment_response: paymentResponse,
				payment_method: paymentMethod,
				payment_status: Constants.PAYMENT_SUCCESS,
				currency: paymentCurrency,
				amount: amount,
				payment_event: Constants.ADD_MONEY_IN_WALLET,
			};

			this.orderAPI.saveUserPaymentDetails(req, res, next, paymentOptions).then(paymentResponse => {
				if (paymentResponse.status == Constants.STATUS_ERROR) return resolve(paymentResponse);

				let paymentId = (paymentResponse.payment_id) ? paymentResponse.payment_id : '';

				/** Set amount options */
				let creditOptions = {
					user_id: userId,
					amount: amount,
					wallet_type: Constants.TOP_UP_AMOUNT,
					transaction_type: Constants.CREDIT,
					extra_parameters: {
						payment_id: paymentId,
						event_type: Constants.ADD_MONEY_IN_WALLET
					},
				};

				/** Add money in wallet */
				Helpers.updateWalletBalance(req, res, next, creditOptions).then(creditResponse => {
					if (creditResponse.status == Constants.STATUS_ERROR) return resolve(creditResponse);

					/**Send success response */
					resolve({ status: Constants.STATUS_SUCCESS, message: res.__("my_account.money_has_been_added_successfully_in_your_account") });
				}).catch(next);
			}).catch(next);
		}).catch(next);
	}// end addMoney()

	/**
	 * Function to get wallet logs
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async getWalletLogs(req, res, next) {
		return new Promise(resolve => {
			/** Sanitize Data **/
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let userId = (req.body.user_id) ? new ObjectId(req.body.user_id) : "";
			let walletTypes = (req.body.wallet_types) ? req.body.wallet_types : "";
			let paidUnpaid = (req.body.paid) ? JSON.parse(req.body.paid) : false;
			let endDate = (req.body.date_to) ? Helpers.newDate(req.body.date_to, Constants.DATABASE_DATE_FORMAT) : "";
			let startDate = (req.body.date_from) ? Helpers.newDate(req.body.date_from, Constants.DATABASE_DATE_FORMAT) : "";
			let transactionId = (req.body.transaction_id) ? req.body.transaction_id : "";
			let transactionType = (req.body.transaction_type) ? req.body.transaction_type : "";

			/** Send error response **/
			if (!userId) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

			let conditions = {
				user_id: userId
			};

			if (startDate && endDate) {
				let fromDate = Helpers.newDate(startDate + " " + Constants.START_DATE_TIME_FORMAT);
				let toDate = Helpers.newDate(endDate + " " + Constants.END_DATE_TIME_FORMAT);
				conditions.created = { $gte: fromDate, $lte: toDate };
			}

			if (walletTypes && walletTypes.length > 0) conditions['wallet_type'] = { $in: walletTypes };
			if (paidUnpaid) conditions['transaction_type'] = Constants.DEBIT;
			if (transactionType) conditions['$and'] = [{ transaction_type: parseInt(transactionType) }];
			if (transactionId) conditions.transaction_id = new RegExp(Helpers.cleanRegex(transactionId), "i");

			asyncParallel({
				user_wallet_logs: (callback) => {
					/** Get user wallet transaction list **/
					const user_wallet_logs = this.db.collection(Tables.USER_WALLET_LOGS);
					user_wallet_logs.find(conditions, { projection: { user_id: 1, transaction_id: 1, transaction_type: 1, wallet_type: 1, amount: 1, created: 1, "extra_parameters.is_double_cashback": 1 } }).toArray().then(userWalletResult => {
						callback(null, userWalletResult);
					}).catch(err => callback(err));
				},
				user_wallet_balance: (callback) => {
					/** Get user wallet balance details **/
					this.userCartsAPI.getUserWalletBalance(req, res, next).then(response => {
						callback(null, response);
					}).catch(err => callback(err));
				}
			}, (asyncErr, asyncResponse) => {
				if (asyncErr) return next(asyncErr);

				let userWalletBalanceResponse = asyncResponse.user_wallet_balance;
				let userWalletResult = asyncResponse.user_wallet_logs;

				/** Send error response **/
				if (userWalletBalanceResponse.status == Constants.STATUS_ERROR) return resolve(userWalletBalanceResponse);

				/**Send success response */
				resolve({
					status: Constants.STATUS_SUCCESS,
					result: userWalletResult,
					amount_per_points: userWalletBalanceResponse.amount_per_points,
					total_amount: userWalletBalanceResponse.result.total_amount,
					wallet: userWalletBalanceResponse.result.wallet
				});
			});
		}).catch(next);
	}// end getWalletLogs()

	/**
	 * Function to transfer balance
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async transferBalance(req, res, next) {
		return new Promise(async resolve => {
			/** Sanitize Data **/
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let userId = (req.body.user_id) ? new ObjectId(req.body.user_id) : "";
			let mobileNumber = (req.body.mobile_number) ? req.body.mobile_number : "";
			let confirmMobileNumber = (req.body.confirm_mobile_number) ? req.body.confirm_mobile_number : "";
			let amount = (req.body.amount) ? parseFloat(req.body.amount) : "";

			/** Send error response **/
			if (!userId || !amount) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

			/** Apply validation */
			let validationResponse = await Helpers.applyValidationInterCallFunction(req, res, next, transferBalanceValidation);
			if (validationResponse.status != Constants.STATUS_SUCCESS) return resolve(validationResponse);

			const users = this.db.collection(Tables.USERS);
			asyncParallel({
				sender_details: (mainCallback) => {
					/** Find amount sender mobile number **/
					users.findOne({ _id: userId }, { projection: { _id: 1, mobile_number: 1 } }).then(userSenderResult => {
						mainCallback(null, userSenderResult);
					}).catch(err => mainCallback(err));
				},
				customer_details: (mainCallback) => {
					/** Set customer conditions **/
					let userConditions = clone(Constants.CUSTOMER_COMMON_CONDITIONS);
					userConditions.mobile_number = mobileNumber;

					/** Find customer details ** */
					users.findOne(userConditions, { projection: { _id: 1, user_role_id: 1 } }).then(userResult => {
						mainCallback(null, userResult);
					}).catch(err => mainCallback(err));
				},
				get_wallet_balance: (mainCallback) => {
					/** Get wallet balance **/
					Helpers.getWalletBalance(req, res, next, { user_id: userId }).then(walletBalanceResponse => {
						mainCallback(null, walletBalanceResponse);
					}).catch(next);
				},
			}, (mainAsyncErr, mainAsyncResponse) => {
				if (mainAsyncErr) return next(mainAsyncErr);

				let senderDetails = mainAsyncResponse.sender_details;
				let customerDetails = mainAsyncResponse.customer_details;
				let getWalletBalanceResponse = mainAsyncResponse.get_wallet_balance;

				/** Send error message **/
				if (!senderDetails) return resolve({ status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") });

				/** If mobile number is not valid **/
				if (!customerDetails) return resolve({ status: Constants.STATUS_ERROR, message: res.__("user_wallet.please_enter_valid_mobile_number") });

				let senderMobileNumber = senderDetails.mobile_number;
				let transferId = customerDetails._id;
				let userRoleId = customerDetails.user_role_id;
				let totalAmount = (getWalletBalanceResponse.wallet && getWalletBalanceResponse.wallet.top_up_amount) ? getWalletBalanceResponse.wallet.top_up_amount : 0;

				if (totalAmount >= amount) {
					asyncParallel({
						user_transfer_balance: (callback) => {
							/** Set data in a object **/
							let insertData = {
								user_id: userId,
								amount: amount,
								transfer_to: new ObjectId(transferId),
								status: Constants.PENDING,
								created: Helpers.getUtcDate()
							};
							/** Save user transfer balance details **/
							const user_transfer_balances = this.db.collection(Tables.USER_TRANSFER_BALANCES);
							user_transfer_balances.insertOne(insertData).then(insertResult => {
								callback(null, insertResult);
							}).catch(err => callback(err));
						},
						save_user_details: (callback) => {
							/** Set options for update balance */
							let debitOptions = {
								user_id: userId,
								amount: amount,
								wallet_type: Constants.TOP_UP_AMOUNT,
								transaction_type: Constants.DEBIT,
								extra_parameters: { transfer_to: new ObjectId(transferId) },
							};

							/** update wallet balance */
							Helpers.debitWalletBalance(req, res, next, debitOptions).then(updateResponse => {
								callback(null, updateResponse);
							}).catch(next);
						}
					}, (asyncErr, asyncResponse) => {
						if (asyncErr) return next(asyncErr);

						let userTransferBalanceResult = asyncResponse.user_transfer_balance;
						let insertedId = userTransferBalanceResult.insertedId;

						/**Send success response */
						resolve({ status: Constants.STATUS_SUCCESS, message: res.__("user_wallet.amount_has_been_transferred_successfully") });

						/*************** Send Mail  ***************/
						sendMailToUsers(req, res, {
							event_type: Constants.NOTIFICATION_TRANSFER_BALANCE,
							transfer_balance_id: insertedId,
							amount: Helpers.currencyFormat(amount),
							mobile_number: senderMobileNumber,
							transfer_to: transferId,
							user_role_id: userRoleId,
							user_id: userId
						});
						/*************** Send Mail  ***************/
					});
				} else {
					/** Send error response */
					resolve({ status: Constants.STATUS_ERROR, message: res.__("user_wallet.you_have_insufficient_balance") });
				}
			});
		}).catch(next);
	}// end transferBalance()

	/**
	 * Function to get transfer balance list
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async getTransferBalanceList(req, res, next) {
		return new Promise(resolve => {
			/** Sanitize Data **/
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let userId = (req.body.user_id) ? new ObjectId(req.body.user_id) : "";
			let endDate = (req.body.date_to) ? Helpers.newDate(req.body.date_to, Constants.DATABASE_DATE_FORMAT) : "";
			let startDate = (req.body.date_from) ? Helpers.newDate(req.body.date_from, Constants.DATABASE_DATE_FORMAT) : "";

			/** Send error response **/
			if (!userId) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

			/** Set conditions **/
			let conditions = { transfer_to: userId };

			/** Set filter by date **/
			if (startDate && endDate) {
				let fromDate = Helpers.newDate(startDate + " " + Constants.START_DATE_TIME_FORMAT);
				let toDate = Helpers.newDate(endDate + " " + Constants.END_DATE_TIME_FORMAT);
				conditions.created = { $gte: fromDate, $lte: toDate };
			}

			/** Get transfer balance list **/
			const user_transfer_balances = this.db.collection(Tables.USER_TRANSFER_BALANCES);
			user_transfer_balances.find(conditions, { projection: { user_id: 1, amount: 1, created: 1, status: 1 } }).sort({ created: Constants.SORT_DESC }).toArray().then(result => {
				/** Send success response **/
				if (result.length <= 0) return resolve({ status: Constants.STATUS_SUCCESS, result: [] });

				let userIds = [];
				result.map(records => {
					userIds.push(records.user_id);
				});

				/** Get user list **/
				const users = this.db.collection(Tables.USERS);
				users.find({ _id: { $in: userIds } }, { projection: { mobile_number: 1, full_name: 1 } }).toArray().then(userResult => {
					let userObject = {};
					if (userResult.length > 0) {
						userResult.map(records => {
							userObject[records._id] = records;
						});
					}

					/** Add sender details  */
					result.map(records => {
						let tmpUserId = records.user_id;
						records.sender_name = (userObject[tmpUserId]) ? userObject[tmpUserId].full_name : "";
						records.sender_mobile_number = (userObject[tmpUserId]) ? userObject[tmpUserId].mobile_number : "";
					});

					/**Send success response */
					resolve({ status: Constants.STATUS_SUCCESS, result: result });
				}).catch(next);
			}).catch(next);
		}).catch(next);
	}// end getTransferBalanceList()

	/**
	 * Function to update transfer balance status
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async updateTransferBalanceStatus(req, res, next) {
		return new Promise(resolve => {
			/** Sanitize Data **/
			req.body = Helpers.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let userId = (req.body.user_id) ? new ObjectId(req.body.user_id) : "";
			let status = (req.body.status) ? parseInt(req.body.status) : "";
			let transferBalanceId = (req.body.transfer_balance_id) ? new ObjectId(req.body.transfer_balance_id) : "";

			/** Send error response **/
			if (!userId || !status || !transferBalanceId || (status != Constants.APPROVED && status != Constants.REJECTED)) {
				return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });
			}

			/** Get transfer balance details **/
			const user_transfer_balances = this.db.collection(Tables.USER_TRANSFER_BALANCES);
			user_transfer_balances.findOne({
				_id: transferBalanceId,
				status: Constants.PENDING,
				transfer_to: userId,
			}, { projection: { _id: 1, transfer_to: 1, amount: 1, user_id: 1 } }).then(transferResult => {
				/** Send error response **/
				if (!transferResult) return resolve({ status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") });

				/** Update transfer balance details **/
				user_transfer_balances.updateOne({
					_id: transferBalanceId
				},
				{
					$set: {
						status: status,
						modified: Helpers.getUtcDate(),
					}
				}).then(() => {
					/** Send success response */
					let message = (status == Constants.APPROVED) ? res.__("my_account.money_has_been_accepted_successfully") : res.__("my_account.money_has_been_rejected_successfully");
					resolve({ status: Constants.STATUS_SUCCESS, message: message });

					let transferTo = new ObjectId(transferResult.transfer_to);
					let senderId = new ObjectId(transferResult.user_id);
					let amount = transferResult.amount;

					/** Set options */
					let creditOptions = {
						user_id: (status == Constants.APPROVED) ? transferTo : senderId,
						amount: amount,
						wallet_type: (status == Constants.APPROVED) ? Constants.TRANSFERRED_BALANCE_AMOUNT : Constants.TOP_UP_AMOUNT,
						transaction_type: Constants.CREDIT,
						extra_parameters: { transfer_balance_id: transferBalanceId },
					};

					/** update wallet balance */
					Helpers.updateWalletBalance(req, res, next, creditOptions).then(() => { }).catch(next);
				}).catch(next);
			}).catch(next);
		}).catch(next);
	};// end updateTransferBalanceStatus()
}// End UserWallet
