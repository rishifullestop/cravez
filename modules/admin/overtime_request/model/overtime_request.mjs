import { ObjectId } from 'mongodb';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, getDropdownList, newDate, round } from '../../../../utils/index.mjs';
import { saveSystemLogs, sendMailToUsers } from '../../../../services/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { parallel as asyncParallel } from 'async';
import clone from 'clone';

class OvertimeRequest {
    constructor(db) {
        this.db = db;
        this.collection = this.db.collection(Tables.OVERTIME_REQUESTS);
    }

    /**
     * Function to get overtime request list
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getOvertimeRequestList(req, res, next) {
        try {
            let authId = req.session.user._id;
            let authUserRoleId = req.session.user.user_role_id;
            let isTeamHead = (req.session.user.team_head) ? req.session.user.team_head : false;

            if (isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                let fromDate = (req.body.fromDate) ? req.body.fromDate : "";
                let toDate = (req.body.toDate) ? req.body.toDate : "";

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);

                /** Common Conditions **/
                let commonConditions = {};

                if (isTeamHead || authUserRoleId == Constants.CRAVEZ) commonConditions.parent_id = new ObjectId(authId);
                else commonConditions.user_id = new ObjectId(authId);

                /** Conditions for request date  */
                if (fromDate != "" && toDate != "") {
                    dataTableConfig.conditions["request_date"] = {
                        $gte: newDate(fromDate),
                        $lte: newDate(toDate),
                    };
                }

                if (authUserRoleId == Constants.CRAVEZ && dataTableConfig.conditions.parent_id) {
                    commonConditions.parent_id = dataTableConfig.conditions.parent_id;
                }

                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

                const response = await new Promise((resolve, reject) => {
                    asyncParallel({
                        overtime_request_list: (callback) => {
                            /** Get list of overtime requests **/
                            this.collection.aggregate([
                                { $match: dataTableConfig.conditions },
                                { $sort: dataTableConfig.sort_conditions },
                                { $skip: skip },
                                { $limit: limit },
                                {
                                    $lookup: { /** Get users details **/
                                        "from": Tables.USERS,
                                        "localField": "user_id",
                                        "foreignField": "_id",
                                        "as": "users_details"
                                    }
                                },
                                {
                                    $project: {
                                        _id: 1, request_date: 1, purpose: 1, hours: 1, user_id: 1, parent_id: 1, from_time: 1, to_time: 1,
                                        team_member_name: { $arrayElemAt: ["$users_details.full_name", 0] }
                                    }
                                }
                            ])
                                .toArray()
                                .then(result => {
                                    callback(null, result);
                                })
                                .catch(next);
                        },
                        total_records: (callback) => {
                            /** Get total number of records in overtime requests  collection **/
                            this.collection.countDocuments(commonConditions)
                                .then(countResult => {
                                    callback(null, countResult);
                                })
                                .catch(next);
                        },
                        filter_records: (callback) => {
                            /** Get filtered records counting in overtime requests  **/
                            this.collection.countDocuments(dataTableConfig.conditions)
                                .then(filterContResult => {
                                    callback(null, filterContResult);
                                })
                                .catch(next);
                        },
                        team_members: (callback) => {
                            /**Get team members if cravez select team head */
                            let parentId = (dataTableConfig.conditions.parent_id) ? dataTableConfig.conditions.parent_id : "";
                            if (!parentId || authUserRoleId != Constants.CRAVEZ) return callback(null, "");

                            /** Set options for get users list **/
                            let conditions = clone(Constants.ADMIN_USER_COMMON_CONDITIONS);
                            conditions.parent_id = new ObjectId(parentId);

                            let options = {
                                collections: [{
                                    collection: Tables.USERS,
                                    columns: ["_id", "full_name"],
                                    conditions: conditions
                                }]
                            };

                            /** Get users dropdown list **/
                            getDropdownList(req, res, next, options)
                                .then(response => {
                                    if (response.status != Constants.STATUS_SUCCESS) return callback(null, "");
                                    callback(null, response.final_html_data["0"]);
                                })
                                .catch(next);
                        }
                    }, (err, response) => {
                        if (err) reject(err);
                        else resolve(response);
                    });
                });

                /** Send response **/
                res.send({
                    status: (!response) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
                    draw: dataTableConfig.result_draw,
                    data: (response.overtime_request_list) ? response.overtime_request_list : [],
                    recordsFiltered: (response.filter_records) ? response.filter_records : 0,
                    recordsTotal: (response.total_records) ? response.total_records : 0,
                    team_members: (response.team_members) ? response.team_members : ""
                });
            } else {
                /** Set options for get users list **/
                let conditions = clone(Constants.ADMIN_USER_COMMON_CONDITIONS);
                conditions.parent_id = new ObjectId(authId);

                /**Select defaut team if tl is logged in */
                let selected = [];
                if (isTeamHead) selected.push(authId);

                /** Set conditions */
                let teamConditions = clone(Constants.ADMIN_USER_COMMON_CONDITIONS);
                teamConditions.team_head = true;
                if (isTeamHead) teamConditions._id = new ObjectId(authId);

                let options = {
                    collections: [{
                        collection: Tables.USERS,
                        columns: ["_id", "full_name"],
                        conditions: conditions
                    }]
                };

                if (authUserRoleId == Constants.CRAVEZ) {
                    options.collections.push({
                        collection: Tables.USERS,
                        columns: ["_id", "full_name"],
                        selected: selected,
                        conditions: teamConditions
                    });
                }

                /** Get users dropdown list **/
                const response = await getDropdownList(req, res, next, options);
                if (response.status != Constants.STATUS_SUCCESS) {
                    /** Send error response */
                    req.flash(Constants.STATUS_ERROR, response.message);
                    return res.redirect(Constants.WEBSITE_ADMIN_URL + "dashboard");
                }

                /** render listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/overtime_request/list']);
                res.render('list', {
                    users_list: response.final_html_data["0"],
                    team_list: response.final_html_data["1"],
                    isTeamHead: isTeamHead
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for add overtime request
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async addOvertimeRequest(req, res, next) {
        try {
            let authId = req.session.user._id;

            if (isPost(req)) {
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let startTime = (req.body.start_time) ? parseFloat(req.body.start_time.replace(':', '.')) : 0;
                let endTime = (req.body.end_time) ? parseFloat(req.body.end_time.replace(':', '.')) : 0;

                let errors = [];

                /**For check error */
                if (endTime && endTime <= startTime) {
                    /**Send error response */
                    errors.push({ 'param': 'end_time', 'msg': res.__("admin.overtime_request.overtime_end_time_should_be_greater_than_overtime_start_time") });
                }

                /** Send error response **/
                if (errors.length > 0) return res.send({ status: Constants.STATUS_ERROR, message: errors });

                /** Check request date is unique **/
                let tempToDate = newDate("", Constants.DATABASE_DATE_FORMAT);
                let tempFromDate = newDate("", Constants.DATABASE_DATE_FORMAT);
                tempToDate = newDate(tempToDate + " " + Constants.END_DATE_TIME_FORMAT);
                tempFromDate = newDate(tempFromDate + " " + Constants.START_DATE_TIME_FORMAT);

                const team_availabilities = this.db.collection(Tables.TEAM_AVAILABILITIES);
                const totalRecords = await team_availabilities.countDocuments({
                    date: { $gte: tempFromDate, $lte: tempToDate },
                    user_id: new ObjectId(req.body.agent_id),
                    leave_type: { $exists: true },
                });

                if (totalRecords > 0) {
                    /** Send error for request date ** */
                    return res.send({
                        status: Constants.STATUS_ERROR,
                        message: [{ 'param': 'request_date', 'msg': res.__("admin.overtime_request.you_have_already_on_leave_you_cannot_add_overtime_request") }]
                    });
                }

                let hours = round(endTime - startTime);

                /**add overtime request details **/
                const result = await this.collection.insertOne({
                    parent_id: new ObjectId(authId),
                    user_id: new ObjectId(req.body.agent_id), // Team Member Id
                    request_date: getUtcDate(),
                    hours: hours,
                    purpose: req.body.overtime_purpose,
                    from_time: startTime,
                    to_time: endTime,
                    modified: getUtcDate(),
                    created: getUtcDate(),
                });

                /** Send success response **/
                req.flash(Constants.STATUS_SUCCESS, res.__("admin.overtime_request.overtime_request_has_been_added_successfully"));
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "overtime_request",
                });

                /*************** Send notification  ***************/
                sendMailToUsers(req, res, {
                    event_type: Constants.NOTIFICATION_OVERTIME_REQUEST,
                    parent_table_id: result.insertedId,
                    user_id: (req.body.agent_id) ? new ObjectId(req.body.agent_id) : "",
                    tl_fullname: req.session.user.full_name,
                });
                /*************** Send notification  ***************/

                /** save System logs */
                saveSystemLogs(req, res, {
                    user_id: req.session.user._id,
                    parent_id: result.insertedId,
                    activity_module: Constants.SYSTEM_LOG_MODULE_OVERTIME_REQUEST,
                    activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                    additional_details: {}
                });
            } else {
                /** Set user conditions **/
                let conditions = clone(Constants.ADMIN_USER_COMMON_CONDITIONS);
                conditions.parent_id = new ObjectId(authId);

                /** Set options for get users list **/
                let options = {
                    collections: [{
                        collection: Tables.USERS,
                        columns: ["_id", "full_name"],
                        conditions: conditions,
                    }]
                };

                const dropDownResponse = await getDropdownList(req, res, next, options);
                if (dropDownResponse.status != Constants.STATUS_SUCCESS) {
                    req.flash(Constants.STATUS_ERROR, dropDownResponse.message);
                    return res.redirect(Constants.WEBSITE_ADMIN_URL + "overtime_request");
                }

                /** Render add page  **/
                res.render('add', {
                    layout: false,
                    users_list: dropDownResponse.final_html_data["0"],
                });
            }
        } catch (error) {
            next(error);
        }
    }
}

export default OvertimeRequest; 