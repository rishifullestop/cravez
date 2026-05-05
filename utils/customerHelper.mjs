import { ObjectId } from 'mongodb';
import clone from 'clone';

import { updateWalletBalance } from './userWalletHelper.mjs';
import * as Constants from "../config/global_constant.mjs";
import { getDb } from '../config/connection.mjs';
import Tables from '../config/database_tables.mjs';


/**
 * Function for checked entered referral code is valid or not
 *
 * @param req 		As 	Request data
 * @param res 		As 	Response data
 * @param next		As 	Next function
 * @param options	As	Object data
 *
 * @return json
 */
export const checkReferralCode = async (req,res,next,options)=>{
	return new Promise(resolve=>{
		let referralCode = options?.referral_code || "";

		/** Send success response **/
		if(!referralCode) return resolve({status: Constants.STATUS_SUCCESS, user_id : ""});

		/** Check referral code is valid or not **/
        let dbInstance 	=	getDb();
		const users		=	dbInstance.collection(Tables.USERS);

		/** Set conditions */
		let conditions	=	clone(Constants.CUSTOMER_COMMON_CONDITIONS);
		conditions['referral_details.referral_code'] = {$regex:'^'+referralCode+'$','$options':'i'};

		users.findOne(conditions,{projection: {_id :1}}).then(result=>{
			/** Send error response */
			if(!result) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again")});

			/** Send success response **/
			resolve({
				status 	: Constants.STATUS_SUCCESS,
				user_id : result?._id || "",
			});
		}).catch(next);
	}).catch(next);
};// end checkReferralCode()

/**
 *  Function to save reward logs and update points in users table
 *
 * @param req 		As	Request Data
 * @param res 		As	Response Data
 * @param options	As 	Object Data
 *
 * @return object
 */
export const updateUserRewardPoints = (req,res,next,options)=>{
	return new Promise(resolve=>{
		if(!options?.user_id || !options?.reward_type || typeof options?.points === typeof undefined){
			/** Send error response **/
			return resolve({
				status 	:	Constants.STATUS_ERROR,
				message	:	res.__("system.something_going_wrong_please_try_again")
			});
		}

		let userId			= new ObjectId(options?.user_id);
		let additionalInfo	= options?.additional_info || {};
		let type			= options?.type ? options?.type : Constants.CREDIT;

		if(options?.reward_type) additionalInfo.reward_type = options?.reward_type;

		/** Add points in wallet */
		updateWalletBalance(req,res,next,{
			user_id 		:	userId,
			amount 			: 	options?.points,
			wallet_type  	: 	Constants.TRANSFERRED_BALANCE_AMOUNT,
			transaction_type: 	type,
			extra_parameters:	additionalInfo,
		}).then(creditResponse=>{
			if(creditResponse.status != Constants.STATUS_SUCCESS) return resolve(creditResponse);

			/** Send success response **/
			resolve({status:Constants.STATUS_SUCCESS});
		}).catch(next);
	}).catch(next);
}// end updateUserRewardPoints()