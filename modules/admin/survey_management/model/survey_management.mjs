import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { isPost, getUtcDate, configDatatable, newDate, sanitizeData } from "../../../../utils/index.mjs";
import { saveSystemLogs } from "../../../../services/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

export default class SurveyManagement {
    constructor(db) {
        this.db = db;
        this.surveyManagementsCollection = db.collection(Tables.SURVEY_MANAGEMENTS);
        this.surveyQuestionsCollection = db.collection(Tables.SURVEY_QUESTIONS);
        this.surveyResponsesCollection = db.collection(Tables.SURVEY_RESPONSES);
        this.surveyAttemptsCollection = db.collection(Tables.SURVEY_ATTEMPTS);
        this.usersCollection = db.collection(Tables.USERS);
    }

    /**
     * Function to get survey list
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     *
     * @return render/json
     */
    async getSurveyList(req, res, next) {
        try {
            if (isPost(req)) {
                const limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                const skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                const fromDate = req.body.fromDate;
                const toDate = req.body.toDate;

                /** Configure Datatable conditions */
                const dataTableConfig = await configDatatable(req, res, null);

                /** Condition for date */
                if (fromDate != "" && toDate != "") {
                    dataTableConfig.conditions["$or"] = [
                        {
                            $and: [
                                { start_on: { $gte: newDate(fromDate) } },
                                { end_on: { $lte: newDate(toDate) } }
                            ]
                        },
                        {
                            $and: [
                                { end_on: { $gte: newDate(fromDate) } },
                                { start_on: { $lte: newDate(toDate) } }
                            ]
                        }
                    ];
                }

                let dbRes = await this.surveyManagementsCollection.aggregate([
                    { $match: dataTableConfig.conditions },
                    {
                        $facet: {
                            list: [
                                { $sort: dataTableConfig.sort_conditions },
                                { $skip: skip },
                                { $limit: limit },
                                {
                                    $project: {
                                        _id: 1,
                                        name: 1,
                                        description: 1,
                                        instance: 1,
                                        start_on: 1,
                                        end_on: 1,
                                        status: 1
                                    }
                                }
                            ],
                            count: [
                                { $count: "count" }
                            ]
                        }
                    }
                ]).toArray();

                /** Send response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data: dbRes?.[0]?.list || [],
                    recordsTotal: dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0
                });
            } else {
                /** render survey listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/survey_management/list']);
                res.render('list');
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get survey detail
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return json
     */
    async getSurveyDetails(req, res, next) {
        try {
            const surveyId = new ObjectId(req.params.id);

            /** Get survey details **/
            const surveyResult = await this.surveyManagementsCollection.aggregate([
                { $match: { _id: surveyId } },
                {
                    $lookup: {
                        from: Tables.SURVEY_QUESTIONS,
                        let: { surveyId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$survey_id", "$$surveyId"] }
                                        ]
                                    }
                                }
                            },
                            { $sort: { "created": Constants.SORT_ASC } }
                        ],
                        as: 'survey_questions_details'
                    }
                }
            ]).toArray();

            /** Send error response */
            if (surveyResult.length <= 0) {
                return {
                    status: Constants.STATUS_ERROR,
                    message: res.__("admin.system.invalid_access")
                };
            }

            return {
                status: Constants.STATUS_SUCCESS,
                result: surveyResult[0]
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Function for add or update survey
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async addEditSurvey(req, res, next) {
        try {
            const surveyId = (req.params.id) ? new ObjectId(req.params.id) : new ObjectId();
            const isEditable = (req.params.id) ? true : false;

            if (isPost(req)) {
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                const inputData = req?.body?.data;

                let errors = [];
                let questionsArrayAll = [];
                if(inputData?.question && Object.keys(inputData?.question).length){
                    Object.keys(inputData.question).map((key)=> {
                        
                        let questionsArray 	= {};
                        
                        if(inputData?.question?.[key]?.question_val == ""){
                            errors.push({ 'param': 'question_'+inputData?.question?.[key]?.question_val_index, 'msg': res.__("admin.survey_management.please_enter_question")});
                        }
                        
                        questionsArray.question = inputData?.question?.[key]?.question_val;
                        questionsArray._id 		= (inputData?.question?.[key]?._id) ? new ObjectId(inputData?.question?.[key]?._id)	:new ObjectId();

                        if(!inputData?.question?.[key]?.question_type || inputData?.question?.[key]?.question_type == ""){
                            errors.push({ 'param': 'question_type_'+inputData?.question?.[key]?.question_val_index, 'msg': res.__("admin.survey_management.please_select_question_type")});
                        }

                        questionsArray.type = inputData?.question?.[key]?.question_type;
                        let optionsArray 	= [];
                        let uniqueOption    = {};
                        if(inputData?.question?.[key]?.question_type != Constants.INPUT_QUESTION_TYPE){

                            inputData?.question?.[key]?.options.map(records=>{
                                /** check if option is blank */
                                if(records?.option == ""){
                                    errors.push({ 'param': 'option_'+inputData?.question?.[key]?.question_val_index+'_'+records?.index, 'msg': res.__("admin.survey_management.please_enter_option")});
                                }
                                
                                /** check duplicate entry for option field*/
                                if(inputData?.question?.[key]?.question_val && records?.option){
                                    let tempOption   = records?.option?.trim()?.toLowerCase();
                                    if(uniqueOption[tempOption]){
                                        errors.push({ 'param': 'option_'+inputData?.question?.[key]?.question_val_index+'_'+records?.index, 'msg': res.__("admin.survey_management.whoops_you_have_entered_an_already_used_option_please_try_something_different")});
                                    }else{
                                        uniqueOption[tempOption] = true;
                                    }
                                }
                                    
                                optionsArray.push({
                                    option: records?.option,
                                    option_id: records?.option_id ? new ObjectId(records?.option_id) : new ObjectId(),
                                    created  : getUtcDate(),
                                    modified : getUtcDate()
                                });                                
                            });

                            questionsArray.options = optionsArray;
                        }
                        questionsArrayAll.push(questionsArray);
                    });
                }

                /** Send error response */
                if(errors.length) return res.send({status: Constants.STATUS_ERROR, message: errors});

                const validFrom = newDate(req.body.start_date, Constants.DATABASE_DATE_FORMAT);
                const validTo = newDate(req.body.end_date, Constants.DATABASE_DATE_FORMAT);

                /** Save survey details **/
                await this.surveyManagementsCollection.updateOne({
                    _id: surveyId
                }, {
                    $set: {
                        name: req.body.name_of_survey,
                        description: req.body.survey_description,
                        instance: req.body.instance,
                        start_on: getUtcDate(validFrom + " " + Constants.START_DATE_TIME_FORMAT),
                        end_on: getUtcDate(validTo + " " + Constants.END_DATE_TIME_FORMAT),
                        modified: getUtcDate()
                    },
                    $setOnInsert: {
                        status: Constants.NOT_LIVE,
                        created: getUtcDate()
                    }
                }, { upsert: true });

                /** Save questions **/
                for (const queryData of questionsArrayAll) {
                    const queryDataValues = { ...queryData };
                    queryDataValues.modified = getUtcDate();
                    queryDataValues.survey_id = surveyId;

                    /** if question type input answer then blank all option fields **/
                    if (queryDataValues?.type == Constants.INPUT_QUESTION_TYPE) {
                        queryDataValues.options = [];
                    }

                    /** For save survey_questions */
                    await this.surveyQuestionsCollection.updateOne({
                        _id: queryDataValues._id
                    }, {
                        $set: queryDataValues,
                        $setOnInsert: {
                            created: getUtcDate()
                        }
                    }, { upsert: true });
                }

                const message = (isEditable) ?
                    res.__("admin.survey_management.survey_has_been_updated_successfully") :
                    res.__("admin.survey_management.survey_has_been_added_successfully");

                req.flash(Constants.STATUS_SUCCESS, message);
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "survey_management"
                });

                /** save System logs */
                saveSystemLogs(req, res, {
                    user_id: req.session.user._id,
                    parent_id: surveyId,
                    activity_module: Constants.SYSTEM_LOG_MODULE_SURVEY_MANAGEMENT,
                    activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                    additional_details: {}
                });
            } else {
                let response = {};
                if (isEditable) {
                    /** Get survey details **/
                    response = await this.getSurveyDetails(req, res, next);
                    if (response.status != Constants.STATUS_SUCCESS) {
                        /** Send error response **/
                        req.flash(Constants.STATUS_ERROR, response.message);
                        return res.redirect(Constants.WEBSITE_ADMIN_URL + "survey_management");
                    }
                }

                /** Render add_edit page  **/
                const breadcrumbs = (isEditable) ? 'admin/survey_management/edit' : 'admin/survey_management/add';
                req.breadcrumbs(BREADCRUMBS[breadcrumbs]);
                res.render('add_edit', {
                    survey_result: response.result,
                    is_editable: isEditable
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for make live
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return null
     */
    async makeLive(req, res, next) {
        try {
            /** For update status */
            await this.surveyManagementsCollection.updateOne(
                { _id: new ObjectId(req.params.id) },
                {
                    $set: {
                        modified: getUtcDate(),
                        status: (req.params.status == Constants.LIVE) ? Constants.NOT_LIVE : Constants.LIVE
                    }
                }
            );

            /** Send success response **/
            req.flash(Constants.STATUS_SUCCESS, res.__("admin.survey_management.survey_status_has_been_updated_successfully"));
            res.redirect(Constants.WEBSITE_ADMIN_URL + "survey_management");

            /** save System logs */
            saveSystemLogs(req, res, {
                user_id: req.session.user._id,
                parent_id: req.params.id,
                activity_module: Constants.SYSTEM_LOG_MODULE_SURVEY_MANAGEMENT,
                activity_type: Constants.ACTIVITY_TYPE_STATUS_UPDATE,
                additional_details: {}
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for delete survey
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return null
     */
    async deleteSurvey(req, res, next) {
        try {
            const surveyId = new ObjectId(req.params.id);

            /** For get survey_attempts detail */
            const countResult = await this.surveyAttemptsCollection.countDocuments({ survey_id: surveyId });

            /** For check count result */
            if (countResult) {
                req.flash(Constants.STATUS_ERROR, res.__("admin.survey_management.not_possible_to_delete_this_survey"));
                return res.redirect(Constants.WEBSITE_ADMIN_URL + "survey_management");
            }

            /** For delete survey details */
            await this.surveyManagementsCollection.deleteOne({ _id: surveyId });

            /** Send success response **/
            req.flash(Constants.STATUS_SUCCESS, res.__("admin.survey_management.survey_has_been_deleted_successfully"));
            res.redirect(Constants.WEBSITE_ADMIN_URL + "survey_management");

            /** save System logs */
            saveSystemLogs(req, res, {
                user_id: req.session.user._id,
                parent_id: req.params.id,
                activity_module: Constants.SYSTEM_LOG_MODULE_SURVEY_MANAGEMENT,
                activity_type: Constants.ACTIVITY_TYPE_DELETE,
                additional_details: {}
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for view Graph
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async viewGraph(req, res, next) {
        try {
            const surveyId = new ObjectId(req.params.id);

            /** For get survey_responses details */
            const responseResult = await this.surveyResponsesCollection.aggregate([
                { $match: { survey_id: surveyId } },
                { $unwind: "$options" },
                {
                    $group: {
                        _id: { question: "$question", option: "$options.option" },
                        total_ids: { $addToSet: "$_id" },
                        count: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $in: ["$options.option", "$selected_option"] }
                                        ]
                                    },
                                    1, 0
                                ]
                            }
                        },
                        question: { $first: "$question" }
                    }
                },
                {
                    $addFields: {
                        total_attempts: { $size: "$total_ids" }
                    }
                },
                {
                    $group: {
                        _id: "$question",
                        total_attempts: { $first: "$total_attempts" },
                        options: {
                            $push: {
                                option: "$_id.option",
                                count: "$count"
                            }
                        }
                    }
                }
            ]).toArray();

            /** For Render view graph page **/
            req.breadcrumbs(BREADCRUMBS["admin/survey_management/view_graph"]);
            res.render('view_graph', {
                response_result: responseResult
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for view survey
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async viewSurvey(req, res, next) {
        try {
            const surveyId = new ObjectId(req.params.survey_id);
            const userId = new ObjectId(req.params.user_id);

            /** Get details for more than one collection */
            const [userRecords, surveyAttemptsRecord, surveyRecords, surveyResponseRecords] = await Promise.all([
                /** For get user details */
                this.usersCollection.findOne({ _id: userId }, { projection: { _id: 1, full_name: 1 } }),
                
                /** For get survey attempts details */
                this.surveyAttemptsCollection.findOne({ survey_id: surveyId }, { projection: { _id: 1, created: 1 } }),
                
                /** For get surveys details */
                this.surveyManagementsCollection.findOne({ _id: surveyId }, { projection: { _id: 1, name: 1, created: 1 } }),
                
                /** For get survey responses details */
                this.surveyResponsesCollection.find({
                    survey_id: surveyId,
                    user_id: userId
                }, {
                    projection: { _id: 1, options: 1, selected_option: 1, question: 1, answer: 1 }
                }).toArray()
            ]);

            /** For Render view page **/
            req.breadcrumbs(BREADCRUMBS["admin/survey_management/view"]);
            res.render('view', {
                response_result: surveyResponseRecords,
                user_details: userRecords,
                survey_details: surveyRecords,
                dynamic_variable: res.__("admin.survey_management.view_history"),
                dynamic_url: surveyId,
                survey_id: surveyId,
                attempt_details: surveyAttemptsRecord
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for Survey Question Option Delete
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return null
     */
    async surveyQuestionOptionDelete(req, res, next) {
        try {
            const condition = { _id: new ObjectId(req.params.id) };

            /** For check delete type */
            if (req.body.type && req.body.type == "option") {
                if (!req.params.option_id) {
                    return res.send({
                        status: Constants.STATUS_ERROR,
                        message: res.__("admin.system.invalid_access")
                    });
                }

                await this.surveyQuestionsCollection.updateOne(condition, {
                    $pull: { "options": { "option_id": new ObjectId(req.params.option_id) } }
                });

                /** Send success response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    message: res.__("admin.survey_management.option_deleted_successfully")
                });
            } else {
                await this.surveyQuestionsCollection.deleteOne(condition);

                /** Send success response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    message: res.__("admin.survey_management.question_deleted_successfully")
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get view History
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     *
     * @return render/json
     */
    async viewHistory(req, res, next) {
        try {
            const surveyId = new ObjectId(req.params.id);

            if (isPost(req)) {
                const limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                const skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                const fromDate = req.body.fromDate;
                const toDate = req.body.toDate;
                const surveyStatus = req.body.status;

                /** Set variable for common conditions */
                const commonConditions = {
                    survey_id: surveyId
                };

                /** Configure Datatable conditions */
                const dataTableConfig = await configDatatable(req, res, null);
                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

                /** condition for is_attempt */
                if (surveyStatus != "") {
                    if (surveyStatus == Constants.ATTEMPTED) {
                        dataTableConfig.conditions["is_attempt"] = true;
                    } else if (surveyStatus == Constants.SKIPPED) {
                        dataTableConfig.conditions["is_attempt"] = false;
                    }
                }

                /** Condition for date */
                if (fromDate != "" && toDate != "") {
                    dataTableConfig.conditions["created"] = {
                        $gte: newDate(fromDate),
                        $lte: newDate(toDate)
                    };
                }

                let dbRes = await this.surveyAttemptsCollection.aggregate([
                    { $match: commonConditions },
                    {
                        $lookup: {
                            'from': Tables.USERS,
                            'localField': "user_id",
                            'foreignField': "_id",
                            'as': "user_data"
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            user_id: 1,
                            survey_id: 1,
                            is_attempt: 1,
                            created: 1,
                            user_name: { $arrayElemAt: ["$user_data.full_name", 0] }
                        }
                    },
                    { $match: dataTableConfig.conditions },
                    { $sort: dataTableConfig.sort_conditions },
                    { $skip: skip },
                    { $limit: limit }
                ]).toArray();

                /** Get filtered count */
                const filteredCountResult = await this.surveyAttemptsCollection.aggregate([
                    {
                        $lookup: {
                            "from": Tables.USERS,
                            "localField": "user_id",
                            "foreignField": "_id",
                            "as": "user_data"
                        }
                    },
                    {
                        $project: {
                            created: 1,
                            is_attempt: 1,
                            survey_id: 1,
                            user_name: { $arrayElemAt: ["$user_data.full_name", 0] }
                        }
                    },
                    { $match: dataTableConfig.conditions },
                    { $count: "count" }
                ]).toArray();

                const filteredCount = (filteredCountResult && filteredCountResult[0] && filteredCountResult[0].count) ? filteredCountResult[0].count : 0;

                /** Send response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data: dbRes || [],
                    recordsFiltered: filteredCount,
                    recordsTotal: filteredCount
                });
            } else {
                /** render view_history page **/
                req.breadcrumbs(BREADCRUMBS['admin/survey_management/view_history']);
                res.render('view_history', {
                    survey_id: surveyId
                });
            }
        } catch (error) {
            next(error);
        }
    }
} 