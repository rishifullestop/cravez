import { ObjectId } from 'mongodb';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, getDropdownList, newDate, arrayToObject, set24HourFormat, exportToExcel, getDriverIdsBasedOnFleetRole, getAreaIdsBasedOnFleetRole } from '../../../../utils/index.mjs';
import { saveSystemLogs, sendMailToUsers } from '../../../../services/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { parallel as asyncParallel } from 'async';
import clone from 'clone';

class OvertimeCaptainRequest {
    constructor(db) {
        this.db = db;
        this.collection = this.db.collection(Tables.CAPTAIN_OVERTIME_REQUESTS);
        
        /** Use in export data **/
        this.exportNumber = 0;
        this.exportFilterConditions = {};
        this.exportSortConditions = {};
        this.exportCommonConditions = {};
        this.exportSortConditions[this.exportNumber] = { _id: Constants.SORT_DESC };
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
            let isToday         = (req.query.is_today) ? req.query.is_today : false;
            let isTeamHead      = (req.session.user.team_head) ? req.session.user.team_head : false;
            let authId          = req.session.user._id;
            let authUserRoleId  = req.session.user.user_role_id;
            
            /** Set captain conditions */
            let driverIds;
            let captainConditions = clone(Constants.DRIVER_COMMON_CONDITIONS);
            if (authUserRoleId == Constants.FLEET && !isTeamHead) {
                driverIds = await getDriverIdsBasedOnFleetRole(req, res, next);
                captainConditions = { ...{ _id: { $in: driverIds } }, ...Constants.DRIVER_COMMON_CONDITIONS };
            }

            if (isPost(req)) {
                let limit       = (req.body.length)     ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip        = (req.body.start)      ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                let fromDate    = (req.body.fromDate)   ? req.body.fromDate : "";
                let toDate      = (req.body.toDate)     ? req.body.toDate : "";
                let exportCount = (req.body.export_count) ? parseInt(req.body.export_count) : 0;

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);
                let overtimeConditions = {};
                if (authUserRoleId == Constants.FLEET && !isTeamHead) {
                    overtimeConditions["$and"] = [{ 'user_id': { $in: arrayToObject(driverIds) } }];
                }

                if (authUserRoleId != Constants.CRAVEZ) overtimeConditions.added_by = new ObjectId(authId);

                /** Conditions for request date  */
                if (fromDate != "" && toDate != "") {
                    dataTableConfig.conditions["request_date"] = { 
                        $gte: newDate(newDate(fromDate, Constants.CURRENTDATE_START_DATE_FORMAT)),
                        $lte: newDate(newDate(toDate, Constants.CURRENTDATE_END_DATE_FORMAT)) 
                    };
                }

                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, overtimeConditions);

                /** Set conditions for export  report **/
                this.exportCommonConditions = overtimeConditions;
                this.exportFilterConditions[exportCount] = dataTableConfig.conditions;
                this.exportSortConditions[exportCount] = dataTableConfig.sort_conditions;

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
                                    $lookup: { /** Get users details **/
                                        "from": Tables.USERS,
                                        "localField": "added_by",
                                        "foreignField": "_id",
                                        "as": "added_user_details"
                                    }
                                },
                                {
                                    $project: {
                                        _id: 1, request_date: 1, purpose: 1, hours: 1, user_id: 1, parent_id: 1, 
                                        captain_name: { $arrayElemAt: ["$users_details.full_name", 0] },
                                        added_by: { $arrayElemAt: ["$added_user_details.full_name", 0] }
                                    }
                                }
                            ])
                                .toArray()
                                .then(result => {
                                    callback(null, result);
                                })
                                .catch(callback);
                        },
                        total_records: (callback) => {
                            /** Get total number of records in overtime requests  collection **/
                            this.collection.countDocuments(overtimeConditions)
                                .then(countResult => {
                                    callback(null, countResult);
                                })
                                .catch(callback);
                        },
                        filter_records: (callback) => {
                            /** Get filtered records counting in overtime requests  **/
                            this.collection.countDocuments(dataTableConfig.conditions)
                                .then(filterContResult => {
                                    callback(null, filterContResult);
                                })
                                .catch(callback);
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
                });
            } else {
                this.exportNumber++;

                /** Set dropdown options */
                let listOpt = [{
                    collection: Tables.USERS,
                    columns: ["_id", "full_name"],
                    conditions: captainConditions
                }];

                if (authUserRoleId == Constants.CRAVEZ) {
                    listOpt.push({
                        collection: Tables.USERS,
                        columns: ["_id", "full_name"],
                        conditions: {
                            user_type: Constants.USER_TYPE_ADMIN,
                            is_deleted: Constants.NOT_DELETED,
                            not_shown: { $exists: false },
                            _id: { $ne: authId },
                        }
                    });
                }

                /** Get users dropdown list **/
                const response = await getDropdownList(req, res, next, { collections: listOpt });
                if (response.status != Constants.STATUS_SUCCESS) {
                    /** Send error response */
                    req.flash(Constants.STATUS_ERROR, response.message);
                    return res.redirect(Constants.WEBSITE_ADMIN_URL + "dashboard");
                }

                /** render listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/captain_overtime_request/list']);
                res.render('list', {
                    users_list: response.final_html_data["0"],
                    team_member_list: (response.final_html_data["1"]) ? response.final_html_data["1"] : "",
                    is_today: isToday,
                    export_count: this.exportNumber
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     *  Function for export overtime captain request records
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return null
     */
    async exportData(req, res, next) {
        try {
            let exportType = (req.params.export_type) ? req.params.export_type : "";
            let exportCount = (req.params.export_count) ? req.params.export_count : 0;

            /** conditions **/
            let filterCondition = (this.exportFilterConditions[exportCount]) ? this.exportFilterConditions[exportCount] : {};
            let sortConditions = (this.exportSortConditions[exportCount]) ? this.exportSortConditions[exportCount] : this.exportSortConditions[0];
            let conditions = (exportType == Constants.EXPORT_FILTERED) ? filterCondition : this.exportCommonConditions;

            /** Get driver overtime details **/
            const result = await this.collection.aggregate([
                { $match: conditions },
                { $sort: sortConditions },
                {
                    $lookup: { /** Get users details **/
                        "from": Tables.USERS,
                        "localField": "user_id",
                        "foreignField": "_id",
                        "as": "users_details"
                    }
                },
                {
                    $lookup: { /** Get added by users details **/
                        "from": Tables.USERS,
                        "localField": "added_by",
                        "foreignField": "_id",
                        "as": "added_user_details"
                    }
                },
                {
                    $project: {
                        _id: 1, request_date: 1, purpose: 1, hours: 1, user_id: 1, parent_id: 1,
                        captain_name: { $arrayElemAt: ["$users_details.full_name", 0] },
                        added_by: { $arrayElemAt: ["$added_user_details.full_name", 0] }
                    }
                }
            ]).toArray();

            /** Define excel heading label **/
            let commonColls = [
                res.__("admin.captain_overtime_request.captain"),
                res.__("admin.captain_overtime_request.request_date"),
                res.__("admin.captain_overtime_request.hours"),
                res.__("admin.captain_overtime_request.purpose"),
                res.__("admin.captain_overtime_request.added_by"),
            ];

            let temp = [];
            if (result && result.length > 0) {
                result.map(records => {
                    temp.push([
                        (records.captain_name) ? records.captain_name : "",
                        (records.request_date) ? newDate(records.request_date, Constants.DATE_FORMAT_EXPORT) : "",
                        (records.hours) ? set24HourFormat(records.hours) : "",
                        (records.purpose) ? records.purpose : "",
                        (records.added_by) ? records.added_by : "",
                    ]);
                });
            }

            /**  Function to export data in excel format **/
            exportToExcel(req, res, {
                file_prefix: "OvertimeCaptainRequestReport",
                heading_columns: commonColls,
                export_data: temp
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to overtime request detail
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return json
     */
    async overtimeRequestDetail(req, res, next) {
        try {
            /** Get offer details **/
            const result = await this.collection.findOne(
                { _id: new ObjectId(req.params.id) },
                { projection: { _id: 1, request_date: 1, purpose: 1, hours: 1, user_id: 1, parent_id: 1, user_id: 1 } }
            );

            /** Send error response */
            if (!result) return { status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") };

            /** Send success response **/
            return { status: Constants.STATUS_SUCCESS, result: result };
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
            let isTeamHead = (req.session.user.team_head) ? req.session.user.team_head : false;
            let authUserRoleId = req.session.user.user_role_id;
            let startDate = newDate(newDate("", Constants.CURRENTDATE_START_DATE_FORMAT));
            let endDate = newDate(newDate("", Constants.CURRENTDATE_END_DATE_FORMAT));
            let isEditable = (req.params.id) ? true : false;
            let overtimeRequestId = (req.params.id) ? new ObjectId(req.params.id) : new ObjectId();

            if (isPost(req)) {
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);

                const asyncResponse = await new Promise((resolve, reject) => {
                    asyncParallel({
                        leave_count: (callback) => {
                            if (isEditable) return callback(null, null);

                            /** Check request date is unique **/
                            const driver_availabilities = this.db.collection(Tables.DRIVER_AVAILABILITIES);
                            driver_availabilities.countDocuments({
                                date: { $gte: startDate, $lte: endDate },
                                user_id: new ObjectId(req.body.agent_id),
                                leave_type: { $exists: true },
                            })
                                .then(totalRecords => {
                                    callback(null, totalRecords);
                                })
                                .catch(next);
                        },
                    }, (asyncErr, asyncResponse) => {
                        if (asyncErr) reject(asyncErr);
                        else resolve(asyncResponse);
                    });
                });

                /** Send error for request date **/
                if (asyncResponse.leave_count) {
                    return res.send({
                        status: Constants.STATUS_ERROR,
                        message: [{ 'param': 'request_date', 'msg': res.__("admin.captain_overtime_request.you_have_already_on_leave_you_cannot_add_overtime_request") }]
                    });
                }

                /**add overtime request details **/
                await this.collection.updateOne({
                    _id: overtimeRequestId
                },
                {
                    $set: {
                        user_id: new ObjectId(req.body.agent_id), // captain Id
                        hours: (req.body.overtime_hours) ? parseFloat(req.body.overtime_hours.replace(':', '.')) : 0,
                        purpose: req.body.overtime_purpose,
                        modified: getUtcDate(),
                    },
                    $setOnInsert: {
                        added_by: new ObjectId(authId),
                        request_date: getUtcDate(),
                        created: getUtcDate(),
                    }
                }, { upsert: true });

                /** Send success response **/
                let message = (isEditable) ? res.__("admin.captain_overtime_request.overtime_request_has_been_updated_successfully") : res.__("admin.captain_overtime_request.overtime_request_has_been_added_successfully");
                req.flash(Constants.STATUS_SUCCESS, message);
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "overtime_captain_request",
                });

                /** Save System logs */
                saveSystemLogs(req, res, {
                    user_id: req.session.user._id,
                    parent_id: overtimeRequestId,
                    activity_module: Constants.SYSTEM_LOG_MODULE_CAPTAIN_OVERTIME_REQUEST,
                    activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                    additional_details: {}
                });

                /*************** Send notification  ***************/
                sendMailToUsers(req, res, {
                    event_type: (!isEditable) ? Constants.NOTIFICATION_CAPTAIN_OVERTIME_REQUEST : Constants.NOTIFICATION_TO_CAPTAIN_FOR_UPDATE_OVERTIME_REQUEST_HOURS,
                    parent_table_id: overtimeRequestId,
                    user_id: (req.body.agent_id) ? new ObjectId(req.body.agent_id) : "",
                    tl_fullname: req.session.user.full_name,
                    request_date: getUtcDate(),
                    hours: (req.body.overtime_hours) ? parseFloat(req.body.overtime_hours.replace(':', '.')) : 0,
                });
                /*************** Send notification  ***************/
            } else {
                let overtimeRequestDetails = {};
                if(isEditable) {
                    const otRes = await this.overtimeRequestDetail(req, res, next);
                    overtimeRequestDetails = otRes?.result || {};
                    if(otRes.status != Constants.STATUS_SUCCESS) return res.status(400).send(otRes);
                }

                let selectedUserId = overtimeRequestDetails?.user_id || '';
                if (overtimeRequestDetails?.request_date) {
                    endDate = newDate(newDate(overtimeRequestDetails.request_date, Constants.CURRENTDATE_END_DATE_FORMAT));
                    startDate = newDate(newDate(overtimeRequestDetails.request_date, Constants.CURRENTDATE_START_DATE_FORMAT));
                }

                /** Set driver availability conditions */
                let driverAvailabilityConditions = {date: { $gte: startDate, $lte: endDate } };

                /** Add fleet conditions */
                if (authUserRoleId == Constants.FLEET && !isTeamHead) {
                    let areaIds = await getAreaIdsBasedOnFleetRole(req, res, next);
                    driverAvailabilityConditions.area_id = { $in: areaIds && arrayToObject(areaIds) || [] };
                }

                /** Get driver ids */
                const driver_availabilities = this.db.collection(Tables.DRIVER_AVAILABILITIES);
                const driverIds = await driver_availabilities.distinct("user_id", driverAvailabilityConditions);

                /** Set captain conditions */
                let captainConditions = { ...{ _id: { $in: driverIds } }, ...Constants.DRIVER_COMMON_CONDITIONS };
                if (isEditable) captainConditions = { ...captainConditions, ...{ _id: selectedUserId } };

                /** get user list */
                const dropDownResponse = await getDropdownList(req, res, next, {
                    collections: [{
                        collection: Tables.USERS,
                        columns: ["_id", "full_name"],
                        conditions: captainConditions,
                        selected: [selectedUserId]
                    }]
                });

                /** Send error response */
                if (dropDownResponse.status != Constants.STATUS_SUCCESS) return res.status(400).send(dropDownResponse);
                
                /** Render add page  **/
                res.render('add', {
                    layout      : false,
                    result      : overtimeRequestDetails,
                    is_editable : isEditable,
                    users_list  : dropDownResponse?.final_html_data?.["0"] || ""
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for delete overtime request
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return null
     */
    async deleteOvertimeRequest(req, res, next) {
        try {
            let requestId = new ObjectId(req.params.id);

            /** Delete overtime request */
            await this.collection.deleteOne({ _id: requestId });

            /** Send success response **/
            req.flash(Constants.STATUS_SUCCESS, res.__("admin.captain_overtime_request.overtime_request_deleted_successfully"));
            res.redirect(Constants.WEBSITE_ADMIN_URL + "overtime_captain_request");

            /** save System logs */
            saveSystemLogs(req, res, {
                user_id: req.session.user._id,
                parent_id: requestId,
                activity_module: Constants.SYSTEM_LOG_MODULE_CAPTAIN_OVERTIME_REQUEST,
                activity_type: Constants.ACTIVITY_TYPE_DELETE,
                additional_details: {}
            });
        } catch (error) {
            next(error);
        }
    }
}
export default OvertimeCaptainRequest; 