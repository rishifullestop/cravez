import { ObjectId } from 'mongodb';
import { parallel as asyncParallel } from 'async';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from '../../../../utils/index.mjs';

export default class Survey {
    constructor(db) {
        this.db = db;
    }

	/**
	 * Function for get survey question list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async getSurveyQuestionList (req, res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body		=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS_WITHOUT_IFRAME);
			let screenType	= 	(req.body.screen_type)	? req.body.screen_type	:"";

			/** Send error response */
			if(!screenType) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			/**For check screen type */
			if(!INSTANCE[screenType] ) return resolve({status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access")});

			let startDate = Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));
			let endDate   = Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_END_DATE_FORMAT));

			/** Set survey conditions */
			let surveyConditions =	{ instance : screenType};

			/** Set survey conditions for start date and end date */
			surveyConditions["$or"]=[
				{$and : [
					{ start_on 	: {$gte : Helpers.newDate(startDate)} },
					{ end_on    : {$lte : Helpers.newDate(endDate)} }
				]},
				{$and : [
					{ end_on 	: {$gte : Helpers.newDate(startDate)} },
					{ start_on 	: {$lte : Helpers.newDate(endDate)} }
				]}
			];


			/** For get survey ids */
			const survey_managements = this.db.collection(Tables.SURVEY_MANAGEMENTS);
			survey_managements.distinct( "_id", surveyConditions).then(surveyIds=>{

				/** Send response **/
				if(surveyIds.length <=0) return resolve({status: Constants.STATUS_SUCCESS, questions: [] });

				/** Get survey question list */
				const survey_questions  = this.db.collection(Tables.SURVEY_QUESTIONS);
				survey_questions.find({survey_id : {$in :surveyIds}},{projection:{_id:1,"options.option":1,"options.option_id":1,question:1,type:1,survey_id:1}}).toArray().then(surveyResult=>{

					/** Send response **/
					resolve({
						status		: Constants.STATUS_SUCCESS,
						questions	: surveyResult
					});
				}).catch(next);
			}).catch(next);
		}).catch(next);
	};//End getSurveyQuestionList()

	/**
	 * Function to save survey responses
	 *
	 * @param req 	As 	Request Data
	 * @param res 	As 	Response Data
	 * @param next	As	Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async saveSurveyResponses (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body			=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS_WITHOUT_IFRAME);
			let userId			=	(req.body.user_id)		? new ObjectId(req.body.user_id)	:"";
			let questionList	=	(req.body.question_list)? req.body.question_list 		:[];

			/** Send error response */
			if(!userId || !questionList || questionList.length<=0) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			let responseSaveData	= 	[];
			let notGiveAnyAnswer	= 	true;
			let userAttemptData     =   {};
			questionList.map((records)=>{
				if((records.selected_option && records.selected_option.length > 0) || records.answer) notGiveAnyAnswer= false;

				let tempObject = {
					user_id			:	userId,
					survey_id   	:   (records.survey_id)	 ? new ObjectId(records.survey_id) :"",
					type			:	(records.type)		 ? records.type				   :"",
					question		:	(records.question)   ? records.question			   :"",
					created     	:   Helpers.getUtcDate()
				};

				if( records.type == Constants.INPUT_QUESTION_TYPE) tempObject.answer = (records.answer) ? records.answer : "";

				if( records.type == Constants.SINGLE_QUESTION_TYPE || records.type == Constants.MULTIPLE_QUESTION_TYPE) tempObject.selected_option = (records.selected_option) ? records.selected_option :[];

				userAttemptData = {
					survey_id   :   (records.survey_id)	? new ObjectId(records.survey_id) :""
				};

				let options = [];
				records.options.map(optionRecords=>{
					options.push({ option : optionRecords.option});
					tempObject.options = options;
				});

				responseSaveData.push(tempObject);
			});

			/** Send error response */
			if(notGiveAnyAnswer){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("survey.please_give_me_at_least_one_answer") });
			}

            asyncParallel({
				save_survey_response :(callback)=>{
                    /** Save survey response data **/
                    const survey_responses = this.db.collection(Tables.SURVEY_RESPONSES);
                    survey_responses.insertMany(responseSaveData).then(()=>{
                        callback(null,null);
                    }).catch(next);
                },
                user_attempts :(callback)=>{
					req.body.is_attempt = true;
					req.body.survey_id  = userAttemptData.survey_id;

                    /** Save user attempts **/
                    this.userAttempts(req,res,next).then(response=>{
                       callback(null,response);
                    }).catch(next);
                }
            },(asyncErr,asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				let userAttempt = asyncResponse.user_attempts;

				/** Send error response */
                if(userAttempt.status == Constants.STATUS_ERROR) return resolve(userAttempt);

				/** Send success response **/
				resolve({
					status	: Constants.STATUS_SUCCESS,
					message	: res.__("survey.survey_response_has_been_added_successfully")
				});
			});
		}).catch(next);
	};//End saveSurveyResponses()

	/**
	 * Function to user attempts
	 *
	 * @param req 	As 	Request Data
	 * @param res 	As 	Response Data
	 * @param next	As	Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async userAttempts (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body		=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS_WITHOUT_IFRAME);
			let userId		=	(req.body.user_id)		? new ObjectId(req.body.user_id)	:"";
            let surveyId	=	(req.body.survey_id)	? new ObjectId(req.body.survey_id)	:"";
            let isAttempt	=	(req.body.is_attempt)	? req.body.is_attempt	        :"";

			/** Send error response */
			if(!userId || !surveyId || !isAttempt) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			isAttempt = (isAttempt == "true") ? true : false;

            /** Insert data in a object **/
            let insertData = {
                user_id     : userId,
                survey_id   : surveyId,
                is_attempt  : isAttempt,
                created     : Helpers.getUtcDate()
            };

			/** Save user attempts **/
			const survey_attempts = this.db.collection("survey_attempts");
			survey_attempts.insertOne(insertData).then(()=>{

				/** Send success response **/
				resolve({
					status	: Constants.STATUS_SUCCESS,
					message	: res.__("survey.user_attempt_has_been_added_successfully")
				});
			}).catch(next);
		}).catch(next);
	};//End userAttempts()
}// End Survey