import { ObjectId } from 'mongodb';
import { parallel as asyncParallel } from 'async';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from '../../../../utils/index.mjs';

export default class Voc {
    constructor(db) {
        this.db = db;
    }

	/**
	 * Function for get voc question list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async getVocQuestionList (req, res,next){
		try{
			/** Sanitize Data **/
			req.body	=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS_WITHOUT_IFRAME);
			let vocFor	= 	req?.body?.voc_for || "";
			let type	= 	req?.body?.type || "";

			/** Send error response */
			if(!vocFor || !type) return {status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")};

			/** Get voc question list */
			let vocResponse = await Helpers.getUserVocQuestionList(req,res,next,{
				type 		: type,
				user_type 	: vocFor,
			});

			/** Send response */
			return vocResponse;
		}catch(err){ return  next(err); }
	};//End getVocQuestionList()

	/**
	 * Function to save voc responses
	 *
	 * @param req 	As 	Request Data
	 * @param res 	As 	Response Data
	 * @param next	As	Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async saveVocResponses (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body			=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS_WITHOUT_IFRAME);
			let userId			=	req?.body?.user_id && new ObjectId(req.body.user_id) || "";
			let orderId			=	req?.body?.order_id && new ObjectId(req.body.order_id) || "";
			let userType		=	req?.body?.user_type ||"";
			let type			=	req?.body?.type || "";
			let deviceId		=	!userId && req?.body?.device_id || "";
			let questionList	=	req?.body?.question_list || [];

			/** Send error response */
			if((!userId && !deviceId) || !userType || !type || !orderId || !questionList || questionList.length<=0) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			userType = (userType == Constants.USER_TYPE_CUSTOMER || userType == Constants.VOC_FOR_CLIENT) ? Constants.VOC_FOR_CLIENT : Constants.VOC_FOR_CAPTAIN;

			let responseSaveData	= 	[];
			let notGiveAnyAnswer	= 	true;
			questionList.map((records)=>{
				if(records.answer) notGiveAnyAnswer= false;

				responseSaveData.push({
					user_type	:	userType,
					type		:	type,
					user_id		:	userId,
					device_id	:	deviceId,
					order_id	:	orderId,
					question	:	records?.question || "",
					answer		:	records?.answer || "",
					question_id	:	(records.question_id)	? new ObjectId(records.question_id)	:"",
					answer_id	:	(records.answer_id)		? new ObjectId(records.answer_id)	:"",
					is_skip		:	(records.is_skip)		? parseInt(records.is_skip)			:"",
					created		:	Helpers.getUtcDate(),
					modified	:	Helpers.getUtcDate()
				});
			});

			/** Send error response */
			if(notGiveAnyAnswer){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("voc.please_give_me_at_least_one_answer") });
			}

			const orders = this.db.collection(Tables.ORDERS);
			asyncParallel({
				update_order : (callback)=>{
					orders.updateOne({
						_id : new ObjectId(orderId)
					},
					{$set:{
						delay_voc_status : Constants.VOC_SUBMITTED,
					}}).then(() => {
						callback(null,null);
					}).catch(next);
				},
				insert_data : (callback)=>{

					/** Save voc response data **/
					const voc_responses = this.db.collection(Tables.VOC_RESPONSES);
					voc_responses.insertMany(responseSaveData).then(() => {
						callback(null,null);
					}).catch(next);
				},
			},(asyncErr)=>{
				if(asyncErr) return next(asyncErr);

				/** Get order details */
				orders.findOne({
					customer_id 	: new ObjectId(userId),
					delay_voc_status: Constants.PENDING,
				}, {projection: {_id:1,unique_order_id:1},sort:{voc_sent_time:Constants.SORT_DESC}}).then(result => {

					/** Send success response **/
					resolve({
						status		: 	Constants.STATUS_SUCCESS,
						voc_order_id: 	result?._id ||"",
						voc_unique_order_id	: result?.unique_order_id || "",
						message		:	 res.__("voc.voc_response_has_been_added_successfully")
					});
				}).catch(next);
			});
		});
	};//End saveVocResponses()
}// End Voc