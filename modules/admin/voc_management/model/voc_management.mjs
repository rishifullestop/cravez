import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { isPost, getUtcDate, configDatatable, newDate, sanitizeData, saveVocResponses, getUserVocQuestionList } from "../../../../utils/index.mjs";
import { saveSystemLogs } from "../../../../services/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

export default class VOCManagement {
    constructor(db) {
        this.db = db;
        this.vocManagementsCollection = db.collection(Tables.VOC_MANAGEMENTS);
        this.vocQuestionsCollection = db.collection(Tables.VOC_QUESTIONS);
        this.vocResponsesCollection = db.collection(Tables.VOC_RESPONSES);
        this.ordersCollection = db.collection(Tables.ORDERS);
        this.usersCollection = db.collection(Tables.USERS);
    }

    /**
     * Function to get voc management list
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     *
     * @return render/json
     */
    async getVOCList(req, res, next) {
        try {
            if (isPost(req)) {
                const limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                const skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;

                /** Configure Datatable conditions */
                const dataTableConfig = await configDatatable(req, res, null);

                let dbRes = await this.vocManagementsCollection.aggregate([
                    {$match: dataTableConfig.conditions },
                    {$facet: {
                        list: [
                            { $sort: dataTableConfig.sort_conditions },
                            { $skip: skip },
                            { $limit: limit },
                            {
                                $project: {
                                    _id: 1,
                                    voc_for: 1,
                                    type: 1,
                                    status: 1,
                                    not_editable: 1
                                }
                            }
                        ],
                        count: [
                            { $count: "count" }
                        ]
                    }}
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
                /** render voc listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/voc_management/list']);
                res.render('list');
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get voc detail
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return json
     */
    async getVOCDetails(req, res, next) {
        try {
            const vocId = new ObjectId(req.params.id);

            /** Get voc details **/
            const vocResult = await this.vocManagementsCollection.aggregate([
                { $match: { _id: vocId } },
                {$lookup: {
                    from: Tables.VOC_QUESTIONS,
                    let: { vocId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$voc_id", "$$vocId"] }
                                    ]
                                }
                            }
                        },
                        { $sort: { "created": Constants.SORT_ASC } }
                    ],
                    as: 'voc_questions_details'
                }}
            ]).toArray();

            /** Send error response */
            if (vocResult.length <= 0) {
                return {
                    status: Constants.STATUS_ERROR,
                    message: res.__("admin.system.invalid_access")
                };
            }

            return {
                status: Constants.STATUS_SUCCESS,
                result: vocResult[0]
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Function for add or update voc
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async addEditVOC(req, res, next) {
        try {
            const vocId = (req.params.id) ? new ObjectId(req.params.id) : new ObjectId();
            const isEditable = (req.params.id) ? true : false;

            if (isPost(req)) {
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                const inputData = req.body.data;

                let errors = [];
                let questionsArrayAll = [];
                if(inputData?.question && Object.keys(inputData?.question).length){
                    Object.keys(inputData?.question).map((key)=> {
                        let questionsArray 	= {};

                        if(inputData?.question[key]?.question_val == ""){
                            errors.push({ 'param': 'question_'+inputData?.question[key]?.question_val_index, 'msg': res.__("admin.voc_management.please_enter_question")});
                        }
                        questionsArray.question = inputData?.question[key]?.question_val;
                        questionsArray._id 		= (inputData?.question[key]._id) ? new ObjectId(inputData?.question[key]._id)	:new ObjectId();

                        if(!inputData?.question[key]?.question_type || inputData?.question[key]?.question_type == ""){
                            errors.push({ 'param': 'question_type_'+inputData?.question[key]?.question_val_index, 'msg': res.__("admin.voc_management.please_select_question_type")});
                        }

                        questionsArray.type = inputData?.question[key]?.question_type;
                        let optionsArray 	= [];
                        if(inputData?.question[key]?.question_type != Constants.INPUT_QUESTION_TYPE){
                            inputData?.question[key]?.options.map((records,k)=>{
                                /** check if option is blank */
                                if(records?.option == ""){
                                    errors.push({ 'param': 'option_'+inputData?.question[key]?.question_val_index+'_'+records?.index, 'msg': res.__("admin.voc_management.please_enter_option")});
                                }
                                optionsArray.push(
                                    {
                                        option	 : records.option,
                                        option_id: records?.option_id ? new ObjectId(records?.option_id) : new ObjectId(),
                                        created  : getUtcDate(),
                                        modified : getUtcDate(),
                                    }
                                );
                            });
                            questionsArray.options = optionsArray;
                        }
                        questionsArrayAll.push(questionsArray);
                    });
                }

                /** Send error response **/
                if(errors.length > 0 ) return res.send({status	: Constants.STATUS_ERROR, message	: errors});

                const vocFor        = req?.body?.voc_for;
                const captainType   = req?.body?.captain_type;
                const clientType    = req?.body?.client_type;

                /** Get voc for and type if already exists in records **/
                const vocDetails = await this.vocManagementsCollection.findOne({
                    voc_for: vocFor,
                    type: (vocFor == Constants.VOC_FOR_CAPTAIN) ? captainType : clientType
                }, { projection: { _id: 1 } });

                const findVocId = vocDetails?._id ? new ObjectId(vocDetails._id) : "";

                /** Set data in a object **/
                const insertData = {
                    $set: {
                        modified: getUtcDate()
                    },
                    $setOnInsert: {
                        status: Constants.ACTIVE,
                        created: getUtcDate()
                    }
                };

                /** Set data **/
                if (vocFor == Constants.VOC_FOR_CAPTAIN &&
                    (captainType == Constants.VOC_TYPE_FOR_CAPTAIN_DELAYED_PICK_UP_TIME ||
                     captainType == Constants.VOC_TYPE_FOR_CAPTAIN_DELAY_IN_ORDER_DELIVERY ||
                     captainType == Constants.VOC_TYPE_FOR_CAPTAIN_ORDER_MARKED_PROBLEMATIC)) {
                    insertData["$setOnInsert"].not_editable = true;
                }

                /** Save voc details **/
                const result = await this.vocManagementsCollection.updateOne({
                    voc_for: vocFor,
                    type: (vocFor == Constants.VOC_FOR_CAPTAIN) ? captainType : clientType
                }, insertData, { upsert: true });

                const upsertedId = result.upsertedId ? result.upsertedId : {};
                const updatedId = upsertedId._id ? new ObjectId(upsertedId._id) : "";

                /** Save questions **/
                for (const queryData of questionsArrayAll) {
                    const queryDataValues = { ...queryData };
                    queryDataValues.modified = getUtcDate();
                    queryDataValues.voc_id = (findVocId) ? findVocId : updatedId;

                    /** if question type input answer then blank all option fields **/
                    if (queryDataValues.type == Constants.INPUT_VOC_QUESTION_TYPE) {
                        queryDataValues.options = [];
                    }

                    /** For save voc questions */
                    await this.vocQuestionsCollection.updateOne({
                        _id: queryDataValues._id
                    }, {
                        $set: queryDataValues,
                        $setOnInsert: {
                            created: getUtcDate(),
                            status: Constants.ACTIVE
                        }
                    }, { upsert: true });
                }

                const message = (isEditable) ?
                    res.__("admin.voc_management.voc_has_been_updated_successfully") :
                    res.__("admin.voc_management.voc_has_been_added_successfully");

                req.flash(Constants.STATUS_SUCCESS, message);
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "voc_management"
                });

                /** save System logs */
                saveSystemLogs(req, res, {
                    user_id: req.session.user._id,
                    parent_id: vocId,
                    activity_module: Constants.SYSTEM_LOG_MODULE_VOC_MANAGEMENT,
                    activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                    additional_details: {}
                });
            } else {
                let response = {};
                if (isEditable) {
                    /** Get voc details **/
                    response = await this.getVOCDetails(req, res, next);
                    if (response.status != Constants.STATUS_SUCCESS) {
                        /** Send error response **/
                        req.flash(Constants.STATUS_ERROR, response.message);
                        return res.redirect(Constants.WEBSITE_ADMIN_URL + "voc_management");
                    }
                }

                /** Render add_edit page  **/
                const breadcrumbs = (isEditable) ? 'admin/voc_management/edit' : 'admin/voc_management/add';
                req.breadcrumbs(BREADCRUMBS[breadcrumbs]);
                res.render('add_edit', {
                    result: response.result,
                    is_editable: isEditable
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for VOC Question Option Delete
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return null
     */
    async VOCQuestionOptionDelete(req, res, next) {
        try {
            const condition = { _id: new ObjectId(req.params.id) };

            /**For check delete type */
            if (req.body.type && req.body.type == "option") {
                if (!req.params.option_id) {
                    return res.send({
                        status: Constants.STATUS_ERROR,
                        message: res.__("admin.system.invalid_access")
                    });
                }

                await this.vocQuestionsCollection.updateOne(condition, {
                    $pull: { "options": { "option_id": new ObjectId(req.params.option_id) } }
                });

                /** Send success response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    message: res.__("admin.voc_management.option_has_been_deleted_successfully")
                });
            } else {
                await this.vocQuestionsCollection.deleteOne(condition);

                /** Send success response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    message: res.__("admin.voc_management.question_has_been_deleted_successfully")
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for update voc status
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return null
     */
    async updateVOCStatus(req, res, next) {
        try {
            const vocId = req.params.id;
            const vocStatus = (req.params.status == Constants.ACTIVE) ? Constants.DEACTIVE : Constants.ACTIVE;

            /** Update voc status **/
            await this.vocManagementsCollection.updateOne({
                _id: new ObjectId(vocId)
            }, {
                $set: {
                    status: vocStatus,
                    modified: getUtcDate()
                }
            });

            /** Update voc status in voc questions **/
            await this.vocQuestionsCollection.updateMany({
                voc_id: new ObjectId(vocId)
            }, {
                $set: {
                    status: vocStatus,
                    modified: getUtcDate()
                }
            });

            /** Send success response **/
            req.flash(Constants.STATUS_SUCCESS, res.__("admin.voc_management.voc_status_has_been_updated_successfully"));
            res.redirect(Constants.WEBSITE_ADMIN_URL + "voc_management");
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for get common voc list
     *
     * @param req As Request Data
     * @param res As Response Data
     *
     * @return render
     */
    async getCommonVOCList(req, res, next) {
        try {
            const userId = req.params.user_id || '';
            const orderId = req.params.order_id || '';
            const vocType = req.params.voc_type || '';

            if (isPost(req)) {
                const limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                const skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;

                /** Configure Datatable conditions */
                const dataTableConfig = await configDatatable(req, res, null);

                /** Set Common conditions **/
                let commonConditions = {};

                if (userId) commonConditions = { user_id: new ObjectId(userId) };

                if (orderId) {
                    if (vocType == Constants.VOC_FOR_CLIENT) {
                        commonConditions = { order_id: new ObjectId(orderId), user_type: vocType };
                    } else if (vocType == Constants.VOC_FOR_CAPTAIN) {
                        commonConditions = { order_id: new ObjectId(orderId), user_type: vocType };
                    }
                }

                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

                let dbRes = await this.vocResponsesCollection.aggregate([
                    { $match: dataTableConfig.conditions },
                    {
                        $facet: {
                            list: [
                                { $sort: dataTableConfig.sort_conditions },
                                { $skip: skip },
                                { $limit: limit },
                                {
                                    $project: {
                                        _id: 1, type: 1, question: 1, answer: 1, user_type: 1, created: 1
                                    }
                                }
                            ],
                            count: [
                                { $count: "count" }
                            ]
                        }
                    }
                ]).toArray();

                let result 		=	dbRes?.[0]?.list || [];
                let authId 		=	req?.session?.user?._id || "";
                let authRoleId	= 	req?.session?.user?.user_role_id || "";
                if(result?.length && authRoleId == Constants.FLEET){
                    let allVocIds = [];
                    result.map(records=>{
                        allVocIds.push(records._id);
                    });

                    /** Update ticket seen data **/
                    await this.vocResponsesCollection.updateMany({
                        _id 	 	: {$in: allVocIds},
                        is_not_seen	: true,
                    },
                    {$set:{
                        is_not_seen	:	false,
                        seen_by 	: 	new ObjectId(authId),
                        seen_time 	: 	getUtcDate(),
                        modified	: 	getUtcDate(),
                    }});
                }

                /** Send response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data: result,
                    recordsTotal: dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0
                });
            } else {
                /** Render common voc list page */
                res.render('common_voc_list', {
                    layout: false,
                    user_id: userId,
                    order_id: orderId,
                    voc_type: vocType
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for add order voc
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async addOrderVOC(req, res, next) {
        try {
            const orderId = req.params.order_id || '';
            let vocType = req.params.voc_type || '';

            if (isPost(req)) {
                /** Sanitize Data ** */
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                const questionList = req.body.question_list ? req.body.question_list : [];

                /** Send error response ** */
                if(!questionList?.length) {
                    return res.send({
                        status: Constants.STATUS_ERROR,
                        message: res.__("admin.voc_management.its_seems_this_voc_not_have_any_question")
                    });
                }

                /** Get voc question list ** */
                vocType = (vocType) ? vocType : req.body.voc_for;
                const vocRes = await getUserVocQuestionList(req, res, next, {type: req.body.type, user_type: vocType});

                /** Get order details  ** */
                const orderResult = await this.ordersCollection.findOne({
                    _id: new ObjectId(orderId)
                }, { projection: { _id: 1, device_id: 1, customer_id: 1, captain_id: 1 } });

                if(!orderResult || vocRes.status == Constants.STATUS_ERROR) {
                    return res.send({
                        status: Constants.STATUS_ERROR,
                        message: res.__("admin.system.something_going_wrong_please_try_again")
                    });
                }

                const questionDetails = vocRes.questions || [];
                const deviceId      = orderResult?.device_id || '';
                const userId        = orderResult?.customer_id || '';
                const captainId     = orderResult?.captain_id || '';
                const type          = req.body.type;
                const submittedDate = newDate();

                /** Push answer in question list ** */
                let notGiveAnyAnswer = true;
                const finalList = [];

                questionList.forEach(questionListRecords => {
                    questionDetails.forEach(questionDetailsRecords => {
                        if (questionListRecords.answer_id) {
                            questionDetailsRecords.options.forEach(optionRecords => {
                                if (optionRecords.option_id == questionListRecords.answer_id) {
                                    questionListRecords.answer = optionRecords.option;
                                }
                            });
                        }
                    });

                    if (questionListRecords.answer) notGiveAnyAnswer = false;

                    if (questionListRecords.answer) {
                        finalList.push(questionListRecords);
                    }
                });

                /** Send error response */
                if (notGiveAnyAnswer) {
                    return res.send({
                        status: Constants.STATUS_ERROR,
                        message: res.__("voc.please_give_me_at_least_one_answer")
                    });
                }


                /** Save voc response details** */
                const response = await saveVocResponses(req, res, next, {
                    user_type: vocType,
                    type: type,
                    user_id: userId,
                    order_id: orderId,
                    device_id: deviceId,
                    question_list: finalList,
                    submitted_date: submittedDate,
                    captain_id: captainId,
                    is_admin: true,
                    is_not_seen: true
                });

                /** Send error response */
                if (response.status == Constants.STATUS_ERROR) {
                    return res.send(response);
                }

                req.flash(Constants.STATUS_SUCCESS, response.message);
                res.send(response);
            } else {
                res.render('add_order_voc', {
                    layout: false,
                    voc_type: vocType,
                    order_id: orderId
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for get question list
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getQuestionList(req, res, next) {
        try {
            const vocType = req.body.user_type;
            const type = req.body.type;

            /** Send error response */
            if (!vocType || !type) {
                return res.send({
                    status: Constants.STATUS_ERROR,
                    message: res.__("admin.system.something_going_wrong_please_try_again")
                });
            }

            /** Set options */
            const vocOptions = {
                type: type,
                user_type: vocType
            };

            /** Get voc question list ** */
            const response = await getUserVocQuestionList(req, res, next, vocOptions);

            res.render('questions', {
                layout: false,
                questions: (response.questions) ? response.questions : []
            });
        } catch (error) {
            next(error);
        }
    }
}