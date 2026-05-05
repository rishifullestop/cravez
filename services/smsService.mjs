import { ObjectId } from 'mongodb';
import axios from 'axios';

import { getDb } from '../config/connection.mjs';
import * as Constants from "../config/global_constant.mjs";
import Tables from '../config/database_tables.mjs';
import {getUtcDate} from '../utils/index.mjs';

/**
 * Function to send SMS
 *
 * @param req		As 	Request Data
 * @param res		As 	Response Data
 * @param options	As	Data object
 *
 * @return message
 */
export const sendSMS = (req,res,options={})=>{
	return new Promise(async resolve=>{
		let userId			=	options?.user_id && new	ObjectId(options.user_id) || "";
		let smsType			=	options?.sms_type && parseInt(options.sms_type)	  || "";
		let mobileNumber	=	options?.mobile_number || "";
		let messageParams	=	options?.message_params ||"";
		let IsSMSSendingOn 	= 	res?.locals?.settings?.['Fcc.send_sms_on_off'] > 0 || false;
		let accountSid		=	res?.locals?.settings?.['Fcc.sender_id'] || "";
		let accountId		=	res?.locals?.settings?.['Fcc.acount_id'] || "";
		let userName		=	res?.locals?.settings?.['Fcc.user_name'] || "";
		let password		=	res?.locals?.settings?.['Fcc.password']  || "";
		let langCode		=	res?.locals?.settings?.['Fcc.language']  || "";

		/** Send error response **/
		if(!mobileNumber || !smsType) return resolve({status: Constants.STATUS_ERROR, options: options, message: res.__("system.missing_parameters") });

		/** Send success response **/
		if(!IsSMSSendingOn || !accountSid || !accountId || !userName || !password){
			return resolve({status: Constants.STATUS_SUCCESS, message: "message sending turned off"});
		}

		/** Get sms template details */
		const db = getDb();
		const sms_templates	=	db.collection(Tables.SMS_TEMPLATES);
		let templateDetails = 	await sms_templates.findOne({sms_type: smsType});

		/** Send error response **/
		if(!templateDetails) return resolve({status: Constants.STATUS_ERROR, templateDetails, message: res.__("admin.system.something_going_wrong_please_try_again") });

		let userDetails = null;
		if(userId){
			const users	=	db.collection(Tables.USERS);
			userDetails = 	await users.findOne({_id: userId},{projection: {preference_language: 1}});
		}

		let tmpEnMessage 		=	templateDetails?.message?.en || "";
		let tmpArMessage 		=	templateDetails?.message?.ar || "";
		let constants			= 	templateDetails?.constants?.split(",") || [];
		let preferenceLanguage 	= 	userDetails?.preference_language || "";

		if(messageParams && constants.length >0){
			for(let i = 0; i<constants.length; i++){
				let tmpConstant = (constants[i]) ? "{"+constants[i].trim()+"}" :"";

				tmpEnMessage = tmpEnMessage.replace(RegExp(tmpConstant,'g'),messageParams[i]);
				tmpArMessage = tmpArMessage.replace(RegExp(tmpConstant,'g'),messageParams[i]);
			}
		}

		let msgBody = (preferenceLanguage == Constants.ENGLISH_LANGUAGE_MONGO_ID) ? tmpEnMessage :tmpArMessage;

		/** Save sms logs data **/
		let saveData 				= 	{};
		saveData["user_id"] 		= 	userId;
		saveData["mobile_number"] 	= 	mobileNumber;
		saveData["sms_type"] 		= 	smsType;
		saveData["message"] 		= 	msgBody;
		saveData["message_descriptions"] = 	{en: tmpEnMessage, ar: tmpArMessage};
		saveData["created"] 		= 	getUtcDate();

		let Msisdn			=	mobileNumber.replace("+", "");
		let msg				=	msgBody.replace(" ", "+").trim();
		let senderID		=	accountSid.replace(" ", "%20");
		let timestampp 		=	new Date().getTime();
		timestampp			=	parseInt(timestampp/10000000);
		let tempRandNumber	=	Math.floor(100000 + Math.random() * 900000);
		let randomNumber 	=	String(timestampp+tempRandNumber);
		let finalURL 		=	'http://secure1.future-club.com/BulkSMSwebserviceV1/SmsService.asmx/SendSMS?UName='+userName+'&Password='+password+'&AccountID='+accountId+'&Msisdn='+Msisdn+'&Msg='+msg+'&Lang='+langCode+'&SenderID='+senderID+'&TransactionID='+randomNumber;


		saveData["status"] 	= 	Constants.NOT_SENT;
		saveData["response"] = 	"Manually stop.";
		saveSmsLogs(saveData);

		return resolve({status:	Constants.STATUS_SUCCESS});

        axios.get(finalURL).then(response => {
            let responseText = [];
			if(response && response.data){
				let jsonData = JSON.parse(xml2json(response.data, {compact: true, spaces: 4}));
				responseText = (jsonData.string && jsonData.string._text) ? jsonData.string._text.split("  ") : [];
			}

            if(responseText?.[0] > 0){
				/********** Save sms logs ************/
					saveData["status"] 		= 	Constants.NOT_SENT;
					saveData["response"] 	= 	responseText;

					saveSmsLogs(saveData);
				/********** Save sms logs ************/

				/** Send error response **/
				return resolve({
					status	:	Constants.STATUS_ERROR,
					message	: 	responseText?.[1] || ""
				});
			}

			/********** Save sms logs ************/
				saveData["status"]	= 	Constants.SENT;
				saveData["response"]=	responseText;

				saveSmsLogs(saveData);
			/********** Save sms logs ************/

			/** Send success response **/
			resolve({
				status	:	Constants.STATUS_SUCCESS,
				message	: 	responseText
			});

        }).catch(error => {
            console.error('Error:', error.message);

            /********** Save sms logs ************/
                saveData["status"] 		= 	Constants.NOT_SENT;
                saveData["response"] 	= 	error.message;

                saveSmsLogs(saveData);
            /********** Save sms logs ************/

            /** Send error response **/
            return resolve({
                status	:	Constants.STATUS_ERROR,
                message	: 	error.message
            });
        });
	});
}//sendSMS()

/**
 * Function to save sms logs
 *
 * @param options As	Data object
 *
 * @return null
 */
const saveSmsLogs = async (options)=>{
	/** Save sms logs **/
    let dbInstance = getDb();
	await dbInstance.collection(Tables.SMS_LOGS).insertOne(options);
	return;
}//End saveSmsLogs();