import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, getDropdownList, moveUploadedFile, removeFile, appendFileExistData, arrayToObject, newDate, addMinute} from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { saveSystemLogs, insertNotifications } from "../../../../services/index.mjs";

class PushNotification {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.PUSH_NOTIFICATIONS);
    }

    /**
     * Function to get PN list
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getPNList(req, res, next) {
        try {
            if(isPost(req)){
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                let fromDate = (req.body.fromDate) ? req.body.fromDate : "";
                let toDate = (req.body.toDate) ? req.body.toDate : "";
                
                let commonConditions = {};

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);
                
                /** Conditions for created */
                if (fromDate != "" && toDate != "") {
                    dataTableConfig.conditions["scheduled_time"] = {
                        $gte: newDate(fromDate),
                        $lte: newDate(toDate),
                    }
                }
                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

                // Get list or count of area blocks 
                let dbRes = await this.collectionDb.aggregate([
                    { $match: dataTableConfig.conditions },
                    {$facet : {
                        list : [
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit},
                            {$project: {
                                _id: 1, title: 1, message: 1, scheduled_time: 1, created: 1, status: 1 
                            }}
                        ],
                        count: [
                            {$count: "count"},
                        ],
                    }}
                ]).toArray();

                /** Send response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data			:   dbRes?.[0]?.list ||[],
                    recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
                }); 
            } else {
                /** render PN listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/push_notifications/list']);
                res.render('list');
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get PN detail
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return json
     */
    async getPNDetails(req, res, next) {
        try {
            const result = await this.collectionDb.aggregate([
                { $match: { _id: new ObjectId(req.params.id) } },
                {
                    $lookup: {
                        from: Tables.USERS,
                        let: { customerIds: "$user_ids" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $in: ["$_id", "$$customerIds"] },
                                        ]
                                    }
                                }
                            },
                            {
                                $group: {
                                    _id: null,
                                    user_names: { $push: "$full_name" }
                                }
                            }
                        ],
                        as: "user_details"
                    }
                },
                {
                    $project: {
                        _id: 1,
                        title: 1,
                        message: 1,
                        scheduled_time: 1,
                        created: 1,
                        status: 1,
                        payload_value_array: 1,
                        image: 1,
                        payload_type: 1,
                        payload_value: 1,
                        user_names: { $arrayElemAt: ["$user_details.user_names", 0] }
                    }
                }
            ]).toArray();

            /** Send error response **/
            if (result.length == 0) {
                return {
                    status: Constants.STATUS_ERROR,
                    message: res.__("admin.system.invalid_access")
                };
            }

            /** Append image with full path **/
            const fileResponse = await appendFileExistData({
                "file_url": Constants.PN_IMAGE_URL,
                "file_path": Constants.PN_IMAGE_FILE_PATH,
                "result": result,
                "database_field": "image"
            });
            
            return {
                result: fileResponse?.result?.[0] || {},
                status: Constants.STATUS_SUCCESS
            };
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for add or update PN
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async addEditNotification(req, res, next) {
        try {
            let notificationId = (req.params.id) ? new ObjectId(req.params.id) : new ObjectId();
            let isEditable = (req.params.id) ? true : false;

            if(isPost(req)){
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);

                let scheduleType = req.body.schedule_type;
                let scheduleTime = req.body.scheduled_time;
                let allUsers = (req.body.all_users) ? req.body.all_users.split(",") : [];
                let usersList = req.body.users;

                usersList = (req.body.users) ? req.body.users : allUsers;
                let userIds = (usersList.constructor === Array) ? usersList : [usersList];

                /** Save push notifications details **/
                let dataToBeUpdated = {
                    user_ids: arrayToObject(userIds),
                    title: req.body.title,
                    message: req.body.message,
                    payload_type: req.body.payload_type,
                    payload_value: req.body.payload_value,
                    offer_code: (req.body.offer_code) ? req.body.offer_code : "",
                    schedule_type: scheduleType,
                    scheduled_time: (scheduleType == Constants.FUTURE_PN) ? getUtcDate(scheduleTime) : getUtcDate(),
                    status: Constants.PN_SCHEDULED,
                    modified: getUtcDate()
                };

                if(req.body.payload_value) {
                    dataToBeUpdated.payload_value_array = req.body.payload_value.split(",");
                }

                let pnImage = (req.files && req.files.image) ? req.files.image : "";
                let oldImage = (req.body.old_image) ? req.body.old_image : "";
                let imageOptions = {
                    'image': pnImage,
                    'filePath': Constants.PN_IMAGE_FILE_PATH,
                    'oldPath': oldImage
                };

                /** Function for upload file */
                const imageResponse = await moveUploadedFile(req, res, imageOptions);
                
                if(imageResponse.status == Constants.STATUS_ERROR){
                    /** Send error response **/
                    return res.send({
                        status: Constants.STATUS_ERROR,
                        message: [{'param':'image','msg':imageResponse.message}],
                    });
                }

                if(imageResponse.fileName) {
                    dataToBeUpdated.image = imageResponse.fileName;
                }

                await this.collectionDb.updateOne({
                    _id: notificationId,
                }, {
                    $set: dataToBeUpdated,
                    $setOnInsert: {
                        created: getUtcDate()
                    }
                }, { upsert: true });

                /** save System logs */
                saveSystemLogs(req, res, {
                    user_id: req.session.user._id,
                    parent_id: notificationId,
                    activity_module: Constants.SYSTEM_LOG_MODULE_PUSH_NOTIFICATION,
                    activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                    additional_details: {
                        parent_id: new ObjectId(req.session.user._id)
                    }
                });

                /** Send Instant PN*/
                if(scheduleType == Constants.INSTANT_PN) {
                    this.sendScheduledNotifications(req, res, next);
                }

                let message = (isEditable) ? res.__("admin.push_notifications.pn_has_been_updated_successfully") : res.__("admin.push_notifications.pn_has_been_scheduled_successfully");
                req.flash(Constants.STATUS_SUCCESS, message);
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "push_notifications",
                });
            } else {
                /** Get PN details if editing **/
                let pnDetails = {};
                if(isEditable) {
                    const response = await this.getPNDetails(req, res, next);

                    /** Send error response **/
                    if(response.status != Constants.STATUS_SUCCESS) return res.status(400).send(response);
                    
                    pnDetails = response.result;
                }

                /** Get dropdowns **/
                const dropDownResponse = await getDropdownList(req, res, next, {
                    collections: [
                        {
                            collection: Tables.RESTAURANTS,
                            columns: ["_id", ["name", Constants.DEFAULT_LANGUAGE_CODE]],
                            conditions: {}
                        }
                    ]
                });

                /** Send error response **/
                if(dropDownResponse.status != Constants.STATUS_SUCCESS) return res.status(400).send(dropDownResponse);

                /** Render add_edit page  **/
                res.render('add_edit', {
                    result: pnDetails,
                    restaurant_list: dropDownResponse?.final_html_data?.[0] || "",
                    is_editable: isEditable,
                    layout: false
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for view pn details
     *
     * @param req As Request Data
     * @param res As Response Data
     * @param next As Callback argument to the middleware function
     *
     * @return render
     */
    async viewPNDetails(req, res, next) {
        try {
            /** Get PN details **/
            const response = await this.getPNDetails(req, res, next);
            if(response.status != Constants.STATUS_SUCCESS){
                /** Send error response **/
                req.flash(Constants.STATUS_ERROR, response.message);
                res.redirect(Constants.WEBSITE_ADMIN_URL + "push_notifications");
                return;
            }
            
            /** Render view page*/
            req.breadcrumbs(BREADCRUMBS['admin/push_notifications/view']);
            res.render('view', {
                result: response.result,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for delete pn
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return null
     */
    async deleteNotification(req, res, next) {
        try {
            let notificationId = new ObjectId(req.params.id);

            /** For get pn image from push_notifications collection  */
            const response = await this.getPNDetails(req, res, next);
            if(response.status != Constants.STATUS_SUCCESS){
                /** Send error response **/
                req.flash(Constants.STATUS_ERROR, response.message);
                return res.redirect(Constants.WEBSITE_ADMIN_URL + "push_notifications");
            }

            /** For delete push_notifications */
            await this.collectionDb.deleteOne({ _id: notificationId });

            /** Send success response **/
            req.flash(Constants.STATUS_SUCCESS, res.__("admin.push_notifications.pn_deleted_successfully"));
            res.redirect(Constants.WEBSITE_ADMIN_URL + "push_notifications");

            /** Call function for remove file from directory */
            if(response?.result?.image) {
                removeFile({ file_path: Constants.PN_IMAGE_FILE_PATH + response?.result?.image });
            }

            /** save System logs */
            saveSystemLogs(req, res, {
                user_id: req.session.user._id,
                parent_id: notificationId,
                activity_module: Constants.SYSTEM_LOG_MODULE_PUSH_NOTIFICATION,
                activity_type: Constants.ACTIVITY_TYPE_DELETE,
                additional_details: { }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for get user list
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return null
     */
    async getUserDropdown(req, res, next) {
        try {
            /** Set conditions */
            let userConditions = {
                is_deleted: Constants.NOT_DELETED,
                user_role_id: Constants.CUSTOMER
            };
            
            if(req.body.client_status != "") {
                userConditions.active = parseInt(req.body.client_status);
            }
            
            if(req.body.customer_type && req.body.customer_type == Constants.CLIENT_TYPE_GUEST){
                userConditions.is_guest = true;
            } else if(req.body.customer_type == Constants.CLIENT_TYPE_REGISTERED){
                userConditions["$or"] = [{is_guest: false}, {is_guest: {$exists: false}}];
            }
            
            if(req.body.start_date && req.body.end_date){
                userConditions.date_of_birth = {
                    $gte: newDate(req.body.start_date),
                    $lte: newDate(req.body.end_date)
                }
            }

            /** wallet balance rules*/
            let walletBalance = (req.body.wallet_balance != "") ? parseFloat(req.body.wallet_balance) : "";
            let walletRules = req.body.wallet_rules;
            if(walletRules || walletBalance){
                if(walletRules == Constants.AMOUNT_EQUALS_TO){
                    userConditions.total_amount = { $eq: walletBalance };
                } else if(walletRules == Constants.AMOUNT_LESS_THAN){
                    userConditions.total_amount = { $lt: walletBalance };
                } else if(walletRules == Constants.AMOUNT_GREATER_THAN){
                    userConditions.total_amount = { $gt: walletBalance };
                } else if(walletRules == Constants.AMOUNT_LESS_THAN_EQUALS_TO){
                    userConditions.total_amount = { $lte: walletBalance };
                } else if(walletRules == Constants.AMOUNT_GREATER_THAN_EQUALS_TO){
                    userConditions.total_amount = { $gte: walletBalance };
                } else if(walletRules == Constants.AMOUNT_IS_NULL){
                    userConditions["$or"] = [{total_amount: ""}, {total_amount: {$exists: false}}];
                } else if(walletRules == Constants.AMOUNT_IS_NOT_NULL){
                    userConditions.total_amount = { $gte: 0 };
                } else {
                    userConditions.total_amount = { $eq: walletBalance };
                }
            }

            /** order amount rules*/
            let orderConditions = {};
            let orderAmount = (req.body.order_amount != "") ? parseFloat(req.body.order_amount) : "";
            let amountRules = req.body.order_amount_rules;
            if(amountRules || orderAmount){
                if(amountRules == Constants.AMOUNT_EQUALS_TO){
                    orderConditions.order_amount = { $eq: orderAmount };
                } else if(amountRules == Constants.AMOUNT_LESS_THAN){
                    orderConditions.order_amount = { $lt: orderAmount };
                } else if(amountRules == Constants.AMOUNT_GREATER_THAN){
                    orderConditions.order_amount = { $gt: orderAmount };
                } else if(amountRules == Constants.AMOUNT_LESS_THAN_EQUALS_TO){
                    orderConditions.order_amount = { $lte: orderAmount };
                } else if(amountRules == Constants.AMOUNT_GREATER_THAN_EQUALS_TO){
                    orderConditions.order_amount = { $gte: orderAmount };
                } else if(amountRules == Constants.AMOUNT_IS_NULL){
                    orderConditions["$or"] = [{order_amount: ""}, {order_amount: {$exists: false}}];
                } else if(amountRules == Constants.AMOUNT_IS_NOT_NULL){
                    orderConditions.order_amount = { $gte: 0 };
                } else {
                    orderConditions.order_amount = { $eq: orderAmount };
                }
            }

            /** order count rules*/
            let numberOfOrders = (req.body.no_of_orders != "") ? parseFloat(req.body.no_of_orders) : "";
            let countRules = req.body.order_count_rules;
            if(countRules || numberOfOrders){
                if(countRules == Constants.AMOUNT_EQUALS_TO){
                    orderConditions.number_of_orders = { $eq: numberOfOrders };
                } else if(countRules == Constants.AMOUNT_LESS_THAN){
                    orderConditions.number_of_orders = { $lt: numberOfOrders };
                } else if(countRules == Constants.AMOUNT_GREATER_THAN){
                    orderConditions.number_of_orders = { $gt: numberOfOrders };
                } else if(countRules == Constants.AMOUNT_LESS_THAN_EQUALS_TO){
                    orderConditions.number_of_orders = { $lte: numberOfOrders };
                } else if(countRules == Constants.AMOUNT_GREATER_THAN_EQUALS_TO){
                    orderConditions.number_of_orders = { $gte: numberOfOrders };
                } else if(countRules == Constants.AMOUNT_IS_NULL){
                    orderConditions["$or"] = [{number_of_orders: ""}, {number_of_orders: {$exists: false}}];
                } else if(countRules == Constants.AMOUNT_IS_NOT_NULL){
                    orderConditions.number_of_orders = { $gte: 0 };
                } else {
                    orderConditions.number_of_orders = { $eq: numberOfOrders };
                }
            }

            if(req.body.restaurants) {
                let restaurantIds = (req.body.restaurants.constructor === Array) ? req.body.restaurants : [req.body.restaurants];
                orderConditions.restaurant_ids = { $in: arrayToObject(restaurantIds) };
            }

            const users = this.db.collection(Tables.USERS);
            const findResult = await users.aggregate([
                { $match: userConditions },
                {$lookup: {
                    from: Tables.ORDERS,
                    let: { customerId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$customer_id", "$$customerId"] },
                                    ]
                                }
                            }
                        },
                        {
                            $group: {
                                _id: "$customer_id",
                                number_of_orders: { $sum: 1 },
                                order_amount: { $sum: "$order_price" },
                                restaurant_ids: { $push: "$restaurant_id" },
                            }
                        },
                    ],
                    as: "order_details"
                }},
                {
                    $addFields: {
                        order_amount: { $arrayElemAt: ["$order_details.order_amount", 0] },
                        number_of_orders: { $arrayElemAt: ["$order_details.number_of_orders", 0] },
                        restaurant_ids: { $arrayElemAt: ["$order_details.restaurant_ids", 0] }
                    }
                },
                { $match: orderConditions },
                { $project: { _id: 1, order_amount: "$order_amount", number_of_orders: "$number_of_orders", restaurant_ids: "$restaurant_ids" } },
            ]).toArray();

            /** Push user id in a array */
            let userIds = [];
            findResult.map(record => {
                if(record._id){
                    userIds.push(record._id);
                }
            });

            if(userIds.length == 0){
                return res.send({
                    status: Constants.STATUS_ERROR,
                    message: res.__("admin.push_notifications.no_user_available_with_these_filters")
                });
            }

            /** Get user list **/
            const dropDownResponse = await getDropdownList(req, res, next, {
                collections: [
                    {
                        collection: Tables.USERS,
                        columns: ["_id", "full_name"],
                        sub_title_field: "email",
                        conditions: { _id: { $in: userIds } }
                    }
                ]
            });

            if(dropDownResponse.status != Constants.STATUS_SUCCESS) {
                return res.send({
                    status: Constants.STATUS_ERROR, 
                    message: res.__("admin.system.something_going_wrong_please_try_again") 
                });
            }

            res.send({
                status: Constants.STATUS_SUCCESS,
                user_list: dropDownResponse?.final_html_data?.[0] || ""
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to send scheduled pn
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return null
     */
    async sendScheduledNotifications(req, res, next) {
        try {
            const result = await this.collectionDb.find({
                status: Constants.PN_SCHEDULED,
                scheduled_time: { $lte: newDate(addMinute(1)) }
            }, {
                projection: {
                    _id: 1,
                    user_ids: 1,
                    title: 1,
                    message: 1,
                    payload_value_array: 1,
                    image: 1,
                    payload_type: 1,
                    payload_value: 1
                }
            }).toArray();

            let successfullIds = [];
            
            for (const records of result) {
                /*************** Send notification  ***************/
                let notificationMessageParams = [records.title, records.message];
                await insertNotifications(req, res, {
                    notification_data: {
                        notification_type: Constants.NOTIFICATION_SCHEDULED_PUSH_NOTIFICATION,
                        message_params: notificationMessageParams,
                        parent_table_id: records._id,
                        user_ids: records.user_ids,
                        role_id: Constants.CUSTOMER,
                        extra_parameters: {
                            user_ids: records.user_ids,
                            title: records.title,
                            message: records.message,
                            image: records.image,
                            payload_type: records.payload_type,
                            payload_value: records.payload_value,
                            payload_value_array: records.payload_value_array,
                        }
                    }
                });
                successfullIds.push(records._id);
                /*************** Send notification  ***************/
            }

            if(successfullIds.length > 0){
                /** Update team availability status  */
                await this.collectionDb.updateMany({
                    _id: {
                        $in: arrayToObject(successfullIds)
                    }
                }, {
                    $set: {
                        status: Constants.PN_SENT
                    }
                });
            }

            return { status: Constants.STATUS_SUCCESS };
        } catch (error) {
            next(error);
        }
    }
}

export default PushNotification; 