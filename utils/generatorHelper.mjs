import slug from 'slug';
import { generate } from 'randomstring';

import Tables from './../config/database_tables.mjs';
import { getDb } from '../config/connection.mjs';
import * as Constants from "../config/global_constant.mjs";
import { newDate } from './dateHelper.mjs';

/**
 * Generate unique ID based on type
 *
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 * @param {Object} options - Options object containing:
 *   @param {string} type - Type of unique ID to generate
 *   @param {number} [order_count] - Order count for order IDs
 *   @param {string} [client_number] - Client number for invoice numbers
 *   @param {string} [platform] - Device platform
 * @returns {Promise<Object>} Promise resolving to unique ID
 */
export const getUniqueId = async (req, res, next, options) => {
	const type = options?.type || "";
	const dbInstance = getDb();

	if (!type) {
		return {
			status: Constants.STATUS_ERROR,
			message: res.__("system.missing_parameters")
		};
	}

	const timestampp = Math.floor(new Date().getTime() / 10000000);
	const tempRandNumber = Math.floor(100000 + Math.random() * 900000);
	let randomNumber = String(timestampp + tempRandNumber);

	// Manage day of the year
	const currentYear = String(newDate("", Constants.ORDER_YEAR_FORMAT));
	const currentDate = new Date(newDate());
	const startDate = new Date(currentDate.getFullYear(), 0, 0);
	const diffBetweenDate = currentDate - startDate;
	const oneDayTimeStamp = Constants.MILLISECONDS_IN_A_SECOND * Constants.MINUTES_IN_A_HOUR * Constants.SECONDS_IN_A_MINUTE * Constants.HOURS_IN_A_DAY;
	let dayOftheYear = String(Math.floor(diffBetweenDate / oneDayTimeStamp));

	if (dayOftheYear.length < 3) {
		dayOftheYear = dayOftheYear.padStart(3, '0');
	}

	try {
		const collections = {
			areas: { collection: Tables.AREAS, field: "area_id" },
			area_blocks: { collection: Tables.AREA_BLOCKS, field: "block_id" },
			cities: { collection: Tables.CITIES, field: "city_id" },
			categories: { collection: Tables.CATEGORIES, field: "category_id" },
			restaturant_categories: { collection: Tables.RESTAURANT_CATEGORIES, field: "category_id" },
			restaurant_branches: { collection: Tables.RESTAURANT_BRANCHES, field: "branch_number" },
			restaurants: { collection: Tables.RESTAURANTS, field: "restaurant_number" },
			restaurant_menus: { collection: Tables.RESTAURANT_MENUS, field: "menu_id" },
			cuisines: { collection: Tables.CUISINES, field: "cuisine_id" },
			item_unit: { collection: Tables.ITEM_UNITS_MASTERS, field: "item_unit_id" },
			item: { collection: Tables.ITEMS, field: "item_id" },
			main_order_id: { collection: Tables.ORDERS, field: "main_order_id" },
			order_details: { collection: Tables.ORDER_DETAILS, field: "transaction_id" },
			user_wallet_logs: { collection: Tables.USER_WALLET_LOGS, field: "transaction_id" },
			payment_transactions: { collection: Tables.PAYMENT_TRANSACTIONS, field: "invoice_number" },
			tickets: { collection: Tables.TICKETS, field: "invoice_number" },
			agent_id: { collection: Tables.USERS, field: "agent_id" },
		};

		if (collections[type]) {
			const { collection, field } = collections[type];
			const coll = dbInstance.collection(collection);
			const countResult = await coll.countDocuments({ [field]: randomNumber });

			if (countResult === 0) {
				return { status: Constants.STATUS_SUCCESS, result: randomNumber };
			}

			return await getUniqueId(req, res, next, options);
		}

		// Special cases
		switch (type) {
			case "orders": {
				const orderRandomPostFix = randomNumber.slice(-4);
				let orderCount = String(options?.order_count || 0);

				if (orderCount.length < Constants.MAX_ORDER_COUNT_DIGIT_FOR_UNIQUE_ID) {
					orderCount = orderCount.padStart(Constants.MAX_ORDER_COUNT_DIGIT_FOR_UNIQUE_ID, '0');
				} else if (orderCount.length > Constants.MAX_ORDER_COUNT_DIGIT_FOR_UNIQUE_ID) {
					orderCount = orderCount.slice(0, Constants.MAX_ORDER_COUNT_DIGIT_FOR_UNIQUE_ID);
				}

				const uniqueOrderId = currentYear + dayOftheYear + orderCount + orderRandomPostFix;
				const orders = dbInstance.collection(Tables.ORDERS);
				const countResult = await orders.countDocuments({ unique_order_id: uniqueOrderId });

				if (countResult === 0) {
					return { status: Constants.STATUS_SUCCESS, result: uniqueOrderId };
				}

				options.order_count = (options.order_count || 0) + 1;
				return await getUniqueId(req, res, next, options);
			}

			case "order_invoice_number": {
				let clientNumber = options?.client_number || Constants.GUEST_MOBILE_NUMBER;
				const devicePlatform = options?.platform?.toLowerCase() || "";
				const platform = devicePlatform === Constants.ANDROID_DEVICE ? Constants.ANDROID_PLATFORM : Constants.IOS_PLATFORM;

				if (clientNumber.length < Constants.MAX_CLIENT_NUMBER_DIGIT) {
					clientNumber = clientNumber.padStart(Constants.MAX_CLIENT_NUMBER_DIGIT, '0');
				} else if (clientNumber.length > Constants.MAX_CLIENT_NUMBER_DIGIT) {
					clientNumber = clientNumber.slice(0, Constants.MAX_CLIENT_NUMBER_DIGIT);
				}

				const orderInvoiceNumber = Constants.ORDER_INSTITUTION_NUMBER + clientNumber + currentYear + dayOftheYear + newDate("", Constants.ORDER_HOUR_MINUTE_SECOND_FORMAT) + platform;
				const orders = dbInstance.collection(Tables.ORDERS);
				const countResult = await orders.countDocuments({ invoice_number: orderInvoiceNumber });

				if (countResult === 0) {
					return { status: Constants.STATUS_SUCCESS, result: orderInvoiceNumber };
				}

				return await getUniqueId(req, res, next, options);
			}

			case "user_driver_id": {
				randomNumber = randomNumber.slice(0, 3);
				const captainUniqueId = Constants.CAPTAIN_ID_PREFIX + randomNumber;
				const users = dbInstance.collection(Tables.USERS);
				const count = await users.countDocuments({ driver_id: captainUniqueId });
				if (count === 0) {
					return { status: Constants.STATUS_SUCCESS, result: captainUniqueId };
				}
				return await getUniqueId(req, res, next, options);
			}

			case "ticket_no": {
				const tempRandNumber = Math.floor(1000000 + Math.random() * 9000000);
				randomNumber = String(timestampp + tempRandNumber);
				const tickets = dbInstance.collection(Tables.TICKETS);
				const count = await tickets.countDocuments({ ticket_id: randomNumber });
				if (count === 0) {
					return { status: Constants.STATUS_SUCCESS, result: randomNumber };
				}
				return await getUniqueId(req, res, next, options);
			}

			default:
				return {
					status: Constants.STATUS_ERROR,
					message: res.__("system.invalid_access")
				};
		}
	} catch (error) {
		console.error("Error in getUniqueId:", error);
		return {
			status: Constants.STATUS_ERROR,
			message: res.__("system.something_going_wrong_please_try_again")
		};
	}
};

/**
 * Function to get data base slug
 *
 * @param tableName AS Table Name
 * @param title AS Title
 * @param slugField AS Slug Field Name in database
 *
 * @return string
 */
export const getDatabaseSlug = async(options={})=>{
	try{
		const tableName = options?.table_name || "";
		const title 	= options?.title || "";
		const slugField = options?.slug_field || "";

		if(!title || !tableName) {
			return { title: "", options };
		}

		const dbInstance = getDb();
		const convertTitleIntoSlug = slug(title).toLowerCase();
		const collection = dbInstance.collection(String(tableName));

		// Check for existing slugs
		const conditions = {
			[slugField]: { $regex: new RegExp(convertTitleIntoSlug, "i") }
		};

		const count = await collection.countDocuments(conditions);

		return {
			title: count > 0 ? `${convertTitleIntoSlug}-${count}` :convertTitleIntoSlug
		};
	}catch(e){
		console.log("Error at getDatabaseSlug",e);
		return {title: ''}
	}
}//end getDatabaseSlug();

/**
 * Function to genrate random otp
 *
 * @param null
 *
 * @return OTP
 */
export const getRandomOTP = ()=> String(Math.floor(100000 + Math.random() * 900000));

/**
 * Function to generate offer code
 *
 * @param to		As	Recipient Email Address
 * @param repArray  As 	Response Array
 * @param options  	As 	data as json format
 *
 * @return json
 */
export const generateOfferCode = async (req,res,next,options)=>{
	try{
		const dbInstance = getDb();
		let unique = generate({
			length	: 3,
			charset	: 'numeric',
		});

		let offerCode = "CRV"+unique;

		/** Check offer code is unique  */
		const offers =	dbInstance.collection(Tables.OFFERS);
		const count = await offers.countDocuments({offer_code: offerCode});

		if(count == 0) return {status:	Constants.STATUS_SUCCESS, offer_code: offerCode};

		return await generateOfferCode(req,res,next,options);
	}catch(e){
		console.log("Error at generateOfferCode",e);
		return {status:	Constants.STATUS_ERROR, offer_code: ""};
	}
}// end generateOfferCode

/**
 *  Function to generate user referral code
 *
 * @param req 		As	Request Data
 * @param res 		As	Response Data
 * @param options	As 	Object Data
 *
 * @return object
 */
export const generateReferralCode = (req,res,options)=>{
	return new Promise(async resolve=>{
		try{
			let prefix		 =	options?.prefix?.toUpperCase()	|| "";
			prefix			 =	(prefix)	?	prefix.replace(/ /g,'').trim().substring(0,Constants.PREFIX_MAX_LIMIT) :"";
			let codeMaxLimit =	(prefix)	?	Constants.TOTAL_REFERRAL_CHARACTER_LIMIT-prefix.length	:Constants.TOTAL_REFERRAL_CHARACTER_LIMIT;

			/** Generate unique code **/
			let unique =  generate({length: codeMaxLimit, charset: 'alphanumeric', capitalization: 'uppercase'});
			let referralCode = prefix+unique;

			/** Check referral code is unique **/
			const users = getDb().collection(Tables.USERS);
			let count = await users.countDocuments({"referral_details.referral_code":referralCode});

			/** Send success response if referral code is unique generated **/
			if(count == 0) return resolve({status:	Constants.STATUS_SUCCESS, referral_code: referralCode});

			/** Generate referral code again **/
			return await generateReferralCode(req,res,options);
		}catch(e){
			console.log("Error at generateReferralCode",e);
			return resolve({status:	Constants.STATUS_ERROR, referral_code: ""});
		}
	}).catch(e=>{
		console.log("Error at generateReferralCode",e);
		resolve({status:	Constants.STATUS_ERROR, referral_code: ""});
	});
}// end generateReferralCode();