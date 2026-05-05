
import { ObjectId } from 'mongodb';
import Tables from './../config/database_tables.mjs';
import { getDb } from '../config/connection.mjs';
import * as Constants from "../config/global_constant.mjs";


/**
 * Function for get voc question list
 *
 * @param req 		As 	Request Data
 * @param res 		As 	Response Data
 * @param next		As 	Callback argument to the middleware function
 * @param options	As	Object data
 *
 * @return render/json
 */
export const getUserVocQuestionList = async(req,res,next,options)=>{
    try {
        let userType = 	options?.user_type || "";
        let type	 = 	options?.type || "";

        /** Send error response */
        if(!userType || !type) return {status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters")};


        const dbInstance = getDb();
        const vocIds = await dbInstance.collection(Tables.VOC_MANAGEMENTS).distinct( "_id", {
			voc_for		:	userType,
			type		:	type,
			status		:	Constants.ACTIVE
		});

        /** Send response **/
        if(vocIds.length <=0) return {status: Constants.STATUS_SUCCESS, questions: [] };

        /** Get voc question list */
        const vocResult = await dbInstance.collection(Tables.VOC_QUESTIONS).find({
            voc_id : {$in : vocIds},
            status : Constants.ACTIVE,
        },{projection:{_id:1,"options.option":1,"options.option_id":1,question:1,type:1,voc_id:1}}).toArray();

        /** Send response **/
        return {
            status		: Constants.STATUS_SUCCESS,
            questions	: vocResult
        };
    } catch (error) {
        console.error("Error at getUserVocQuestionList utility ",error);
		return {status: Constants.STATUS_ERROR};
    }
};//End getUserVocQuestionList()

/**
 * Function to save voc responses
 *
 * @param req 		As 	Request Data
 * @param res 		As 	Response Data
 * @param next		As	Callback argument to the middleware function
 * @param options	As	Object data
 *
 * @return render/json
 */
export const saveVocResponses = async(req,res,next,options)=>{
    try {
        let userType		=	(options.user_type)		? options.user_type				:"";
		let type			=	(options.type)			? options.type					:"";
		let userId			=	(options.user_id)		? new ObjectId(options.user_id)		:"";
		let orderId			=	(options.order_id)		? new ObjectId(options.order_id)	:"";
		let captainId		=	(options.captain_id)	? new ObjectId(options.captain_id)	:"";
		let deviceId		=	(options.device_id)		? options.device_id				:"";
		let questionList	=	(options.question_list)	? options.question_list 		:[];
		let isAdmin			=	(options.is_admin)		? options.is_admin				:false;
		let submittedDate	=	(options.submitted_date)? options.submitted_date		:getUtcDate();
		let aghzeyaBillNo	=	(options.aghzeya_bill_no)? options.aghzeya_bill_no		:"";
		let isNotSeen		=	(options.is_not_seen)	?	options.is_not_seen			:false;

        /** Send error response */
		if((!userId && !deviceId) || !userType || !type || !orderId || !questionList || questionList.length<=0){
            return {status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters")};
        }

        userType = (userType == Constants.USER_TYPE_CUSTOMER || userType == Constants.VOC_FOR_CLIENT) ? Constants.VOC_FOR_CLIENT : Constants.VOC_FOR_CAPTAIN;
		let responseSaveData	= 	[];
		let notGiveAnyAnswer	= 	true;
		questionList.map((records)=>{
			if(records.answer) notGiveAnyAnswer= false;

			responseSaveData.push({
				user_type		:	userType,
				is_not_seen		:	isNotSeen,
				type			:	type,
				user_id			:	userId,
				device_id		:	deviceId,
				order_id		:	orderId,
				aghzeya_bill_no	: 	aghzeyaBillNo,
				question_id		:	(records.question_id)	? new ObjectId(records.question_id)	:"",
				answer_id		:	(records.answer_id)		? new ObjectId(records.answer_id)	:"",
				question		:	(records.question)		? records.question				:"",
				answer			:	(records.answer)		? records.answer				:"",
				is_skip			:	(records.is_skip)		? parseInt(records.is_skip)		:"",
				answer_given_by :   (isAdmin) 			    ? new ObjectId(req.session.user._id): "",
				captain_id 		:   captainId,
				created		    :   submittedDate
			});
		});

		/** Send error response */
		if(notGiveAnyAnswer){
			return {status: Constants.STATUS_ERROR, message: res.__("voc.please_give_me_at_least_one_answer") };
		}

        /** Save voc response data **/
        const dbInstance = getDb();
		await dbInstance.collection(Tables.VOC_RESPONSES).insertMany(responseSaveData,{forceServerObjectId:true});

        /** Send success response **/
        return {
            status	: 	Constants.STATUS_SUCCESS,
            message	:	 res.__("voc.voc_response_has_been_added_successfully")
        };
    } catch (error) {
        console.error("Error at saveVocResponses utility ",error);
		return {status: Constants.STATUS_ERROR};
    }
};//End saveVocResponses()