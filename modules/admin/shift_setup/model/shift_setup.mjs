import { ObjectId } from 'mongodb';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, getDropdownList, getAttributes, getDateRange, newDate, addDate, set24HourFormat, exportToExcel, arrayToObject } from '../../../../utils/index.mjs';
import {saveSystemLogs, sendMail} from '../../../../services/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { parallel as asyncParallel, each as asyncEach } from 'async';
import clone from 'clone';

class ShiftSetup {
    constructor(db) {
        this.db = db;
        this.collection = this.db.collection(Tables.SHIFTS);
    }

    /**
     * Function to get shift list
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getShiftList(req, res, next) {
        try {
            let authUserId = new ObjectId(req.session.user._id);
            let authUserRoleId = req.session.user.user_role_id;

            if (isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                let commonConditions = {
                    parent_id: (req.session.user.parent_id) ? new ObjectId(req.session.user.parent_id) : authUserId,
                    is_deleted: { $ne: Constants.DELETED },
                };

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);

                if (authUserRoleId == Constants.CRAVEZ && dataTableConfig.conditions.parent_id) {
                    commonConditions = { parent_id: dataTableConfig.conditions.parent_id };
                }

                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

                const response = await new Promise((resolve, reject) => {
                    asyncParallel({
                        records: (callback) => {
                            /** Get list of shift's **/
                            this.collection.find(dataTableConfig.conditions, { projection: { _id: 1, shift_name: 1, start_time: 1, end_time: 1 } })
                                .sort(dataTableConfig.sort_conditions)
                                .limit(limit)
                                .skip(skip)
                                .toArray()
                                .then(result => {
                                    callback(null, result);
                                })
                                .catch(next);
                        },
                        total_count: (callback) => {
                            /** Get total number of records in shifts collection **/
                            this.collection.countDocuments(commonConditions)
                                .then(countResult => {
                                    callback(null, countResult);
                                })
                                .catch(next);
                        },
                        filtered_count: (callback) => {
                            /** Get filtered records counting in shifts **/
                            this.collection.countDocuments(dataTableConfig.conditions)
                                .then(filterContResult => {
                                    callback(null, filterContResult);
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
                    data: (response.records) ? response.records : [],
                    recordsFiltered: (response.filtered_count) ? response.filtered_count : 0,
                    recordsTotal: (response.total_count) ? response.total_count : 0,
                });
            } else {
                const asyncResponse = await new Promise((resolve, reject) => {
                    asyncParallel({
                        user_list: (callback) => {
                            if (authUserRoleId != Constants.CRAVEZ) return callback(null, "");

                            let userConditions = clone(Constants.ADMIN_USER_COMMON_CONDITIONS);
                            userConditions.team_head = true;

                            /* Configure conditions for get given users list */
                            let options = {
                                collections: [{
                                    collection: Tables.USERS,
                                    columns: ["_id", "full_name"],
                                    conditions: userConditions
                                }]
                            };
                            /** get dropdown list for given role users **/
                            getDropdownList(req, res, next, options)
                                .then(dropDrownResponse => {
                                    if (dropDrownResponse.status != Constants.STATUS_SUCCESS) return callback(dropDrownResponse.message, "");
                                    callback(null, dropDrownResponse.final_html_data[0]);
                                })
                                .catch(callback);
                        },
                    }, (err, response) => {
                        if (err) reject(err);
                        else resolve(response);
                    });
                });

                /** render shift listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/shift_setup/list']);
                res.render('list', {
                    user_list: asyncResponse.user_list
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get shift detail
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return json
     */
    async getShiftDetails(req, res, next) {
        try {
            let authId = (req.session.user._id) ? req.session.user._id : "";
            let shiftId = (req.params.id) ? req.params.id : "";

            /** Get shift details **/
            const shiftResult = await this.collection.findOne({
                _id: new ObjectId(shiftId),
                is_deleted: { $ne: Constants.DELETED },
                parent_id: (req.session.user.parent_id) ? new ObjectId(req.session.user.parent_id) : new ObjectId(authId),
            }, { projection: { _id: 1, shift_name: 1, start_time: 1, end_time: 1 } });

            /** Send error response */
            if (!shiftResult) {
                return {
                    status: Constants.STATUS_ERROR,
                    message: res.__("admin.system.invalid_access")
                };
            }

            /** Send success response **/
            return {
                status: Constants.STATUS_SUCCESS,
                result: shiftResult
            };
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for add and edit shift
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async addEditShift(req, res, next) {
        try {
            let editable = (req.params.id) ? true : false;
            let shiftId = (req.params.id) ? new ObjectId(req.params.id) : new ObjectId();
            let authId = (req.session.user._id) ? req.session.user._id : "";
            let userRoleId = (req.session.user.user_role_id) ? req.session.user.user_role_id : "";

            if (isPost(req)) {
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let startTime = (req.body.start_time) ? parseFloat(req.body.start_time.replace(':', '.')) : 0;
                let endTime = (req.body.end_time) ? parseFloat(req.body.end_time.replace(':', '.')) : 0;

                startTime = (startTime == 0) ? parseFloat(Constants.SHIFT_TIME) : startTime;
                endTime = (endTime == 0) ? parseFloat(Constants.SHIFT_TIME) : endTime;

                /** Add and edit shift details **/
                await this.collection.updateOne({
                    _id: shiftId,
                    parent_id: (req.session.user.parent_id) ? new ObjectId(req.session.user.parent_id) : new ObjectId(authId),
                }, {
                    $set: {
                        shift_name: req.body.shift_name,
                        start_time: startTime,
                        end_time: endTime,
                        role_id: userRoleId,
                        modified: getUtcDate()
                    },
                    $setOnInsert: {
                        is_deleted: Constants.NOT_DELETED,
                        created: getUtcDate(),
                    }
                }, { upsert: true });

                let message = (editable) ? res.__("admin.shift_setup.shift_setup_has_been_updated_successfully") : res.__("admin.shift_setup.shift_setup_has_been_added_successfully");

                /** Send success response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "shift_setup",
                    message: message,
                });

                /** save System logs */
                saveSystemLogs(req, res, {
                    user_id: authId,
                    parent_id: shiftId,
                    activity_module: Constants.SYSTEM_LOG_MODULE_SHIFT_SETUP,
                    activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                    additional_details: {}
                });
            } else {
                let response = {};
                if (editable) {
                    /** Get shift details **/
                    response = await this.getShiftDetails(req, res, next);
                    if (response.status != Constants.STATUS_SUCCESS) {
                        /** Send error response **/
                        req.flash(Constants.STATUS_ERROR, response.message);
                        return res.redirect(Constants.WEBSITE_ADMIN_URL + "shift_setup");
                    }
                }

                /** Render add_edit page  **/
                let breadcrumbs = (editable) ? 'admin/shift_setup/edit' : 'admin/shift_setup/add';
                req.breadcrumbs(BREADCRUMBS[breadcrumbs]);
                res.render('add_edit', {
                    result: (response.result) ? response.result : {},
                    is_editable: editable,
                    layout: false
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for delete shift
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async deleteShift(req, res, next) {
        try {
            let shiftId = (req.params.id) ? new ObjectId(req.params.id) : "";
            let authId = (req.session.user && req.session.user._id) ? new ObjectId(req.session.user._id) : "";

            /** Get shift details **/
            const shiftResult = await this.collection.findOne({ _id: shiftId, is_deleted: { $ne: Constants.DELETED } }, { projection: { _id: 1, start_time: 1 } });

            /** Send error response */
            if (!shiftResult) {
                req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
                return res.redirect(Constants.WEBSITE_ADMIN_URL + "shift_setup");
            }

            let currentTime = parseFloat(newDate('', Constants.SHIFT_TIME_FORMAT));
            let shiftStartTime = shiftResult.start_time;
            let deleteAbleDate = getUtcDate(getUtcDate(addDate(Constants.HOURS_IN_A_DAY), Constants.CURRENTDATE_START_DATE_FORMAT));
            let isDeleteToday = false;

            if (shiftStartTime > currentTime) {
                isDeleteToday = true;
                deleteAbleDate = getUtcDate(getUtcDate("", Constants.CURRENTDATE_START_DATE_FORMAT));
            }

            const driver_availabilities = this.db.collection(Tables.DRIVER_AVAILABILITIES);

            await new Promise((resolve, reject) => {
                asyncParallel({
                    delete_team_shifts: (callback) => {
                        // Delete future assigned shifts of teams
                        const team_availabilities = this.db.collection(Tables.TEAM_AVAILABILITIES);
                        team_availabilities.deleteMany({
                            shift_id: shiftId,
                            date: { $gte: deleteAbleDate }
                        }, (deleteErr) => {
                            callback(deleteErr);
                        });
                    },
                    delete_driver_shifts: (callback) => {
                        // Delete future assigned shifts of drivers
                        driver_availabilities.deleteMany({
                            shift_id: shiftId,
                            date: { $gte: deleteAbleDate }
                        }, (deleteErr) => {
                            callback(deleteErr);
                        });
                    },
                    delete_shift: (callback) => {
                        /** Soft delete shift record **/
                        this.collection.updateOne({ _id: shiftId }, {
                            $set: {
                                is_deleted: Constants.DELETED,
                                deleted_by: authId,
                                deleted_at: getUtcDate(),
                                modified: getUtcDate()
                            }
                        }, (shiftErr) => {
                            callback(shiftErr);
                        });
                    },
                }, (asyncErr) => {
                    if (asyncErr) reject(asyncErr);
                    else resolve();
                });
            });

            /** Send success response **/
            req.flash(Constants.STATUS_SUCCESS, res.__("admin.shift_setup.shift_deleted_successfully"));
            res.redirect(Constants.WEBSITE_ADMIN_URL + "shift_setup");

            /** save System logs */
            saveSystemLogs(req, res, {
                user_id: authId,
                parent_id: shiftId,
                activity_module: Constants.SYSTEM_LOG_MODULE_SHIFT_SETUP,
                activity_type: Constants.ACTIVITY_TYPE_DELETE,
                additional_details: {}
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for assign shift
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async assignShift(req, res, next) {
        try {
            let authId = (req.session.user && req.session.user._id) ? new ObjectId(req.session.user._id) : "";
            let shiftId = (req.params.shift_id) ? new ObjectId(req.params.shift_id) : "";
            let teamAvailabilitesId = (req.params.id) ? new ObjectId(req.params.id) : "";

            if (isPost(req)) {
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let fromDate = (req.body.from_date) ? getUtcDate(req.body.from_date) : "";
                let toDate = (req.body.to_date) ? getUtcDate(req.body.to_date) : "";

                /** Set options **/
                let shiftDataId = (req.body.shift_id) ? new ObjectId(req.body.shift_id) : shiftId;

                /** to assign shift **/
                const response = await this.commonAssignShift(req, res, next, {
                    from_date: fromDate,
                    to_date: toDate,
                    shift_user: req.body.shift_user,
                    shift_id: shiftDataId,
                    auth_id: authId
                });

                res.send(response);
            } else {
                /* Configure conditions for get already assigned and shifted users list */
                const asyncResponse = await new Promise((resolve, reject) => {
                    asyncParallel({
                        team_availabilities_detail: (callback) => {
                            if (!teamAvailabilitesId) return callback(null, []);

                            /**For get details from team_availabilities */
                            const team_availabilities = this.db.collection(Tables.TEAM_AVAILABILITIES);
                            team_availabilities.find({
                                _id: teamAvailabilitesId,
                                parent_id: authId,
                            }, { projection: { _id: 1, date: 1, user_id: 1, shift_id: 1 } }).toArray((teamErr, teamResult) => {
                                callback(teamErr, teamResult);
                            });
                        },
                        shift_detail: (callback) => {
                            if (!teamAvailabilitesId) return callback(null, []);

                            let conditions = {
                                parent_id: (req.session.user.parent_id) ? new ObjectId(req.session.user.parent_id) : authId,
                                $or: [
                                    { is_deleted: { $ne: Constants.DELETED } },
                                ]
                            };
                            if (shiftId) conditions["$or"].push({ _id: shiftId });

                            /**For get shift details */
                            this.collection.find(conditions, { projection: { _id: 1, shift_name: 1, start_time: 1, end_time: 1 } }).toArray((shiftErr, shiftResult) => {
                                callback(shiftErr, shiftResult);
                            });
                        }
                    }, (err, response) => {
                        if (err) reject(err);
                        else resolve(response);
                    });
                });

                /**For get selected user */
                let teamAvailabilitesDetail = asyncResponse.team_availabilities_detail;
                let selectedUser = [];
                if (teamAvailabilitesDetail.length > 0) {
                    teamAvailabilitesDetail.map((teamResult) => {
                        selectedUser.push(teamResult.user_id);
                    });
                }

                /** Set user conditions */
                let userConditions = clone(Constants.ADMIN_USER_COMMON_CONDITIONS);
                userConditions.parent_id = authId;

                /* Configure conditions for get given users list */
                let options = {
                    collections: [{
                        collection: Tables.USERS,
                        columns: ["_id", "full_name"],
                        selected: selectedUser,
                        conditions: userConditions
                    }]
                };
                /** get dropdown list for given role users **/
                const dropDrownResponse = await getDropdownList(req, res, next, options);

                if (dropDrownResponse.status != Constants.STATUS_SUCCESS) {
                    req.flash(Constants.STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
                    return res.redirect(Constants.WEBSITE_ADMIN_URL + 'shift_setup');
                }

                /** For render assign shift page **/
                res.render('assign_shift', {
                    shift_detail: asyncResponse.shift_detail,
                    team_availabilities_detail: teamAvailabilitesDetail,
                    layout: false,
                    result: (dropDrownResponse.final_html_data[0]) ? dropDrownResponse.final_html_data[0] : "",
                    shift_id: shiftId
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get team availabilities detail
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     * @param options	As Options object
     *
     * @return json
     */
    async teamAvailabilitiesDetails(req, res, next, options) {
        try {
            let authId = (req.session.user && req.session.user._id) ? req.session.user._id : "";
            let startDate = newDate(options.from_date, Constants.DATABASE_DATE_FORMAT);
            let fromDate = newDate(startDate + " " + Constants.START_DATE_TIME_FORMAT);
            let endDate = newDate(options.to_date, Constants.DATABASE_DATE_FORMAT);
            let toDate = newDate(endDate + " " + Constants.END_DATE_TIME_FORMAT);

            const asyncResponse = await new Promise((resolve, reject) => {
                asyncParallel({
                    user_records: (callback) => {
                        /**set conditions */
                        let userConditions = clone(Constants.ADMIN_USER_COMMON_CONDITIONS);
                        if (req.session.user.user_role_id != Constants.CRAVEZ) userConditions.parent_id = new ObjectId(authId);

                        userConditions["$or"] = [{ team_head: { $exists: false } }, { team_head: false }];
                        userConditions.user_role_id = { $ne: Constants.CRAVEZ };

                        /**Get details from users */
                        const users = this.db.collection(Tables.USERS);
                        users.find(userConditions, { projection: { full_name: 1, email: 1, _id: 1 } }).toArray().then(userResult => {
                            callback(null, userResult);
                        }).catch(next);
                    },
                    team_available: (callback) => {
                        /**set conditions */
                        let teamAvailabilitiesConditions = {
                            date: { $gte: fromDate, $lte: toDate }
                        };

                        if (req.session.user.user_role_id != Constants.CRAVEZ) teamAvailabilitiesConditions.parent_id = new ObjectId(authId);

                        /**Get details from team_availabilities */
                        const team_availabilities = this.db.collection(Tables.TEAM_AVAILABILITIES);
                        team_availabilities.aggregate([
                            { $match: teamAvailabilitiesConditions },
                            {
                                '$lookup': {
                                    'from': Tables.SHIFTS,
                                    'localField': "shift_id",
                                    'foreignField': "_id",
                                    'as': "shift_detail",
                                }
                            },
                            {
                                $project: {
                                    _id: 1, date: 1, status: 1, shift_id: 1, leave_type: 1, user_id: 1, shift_name: { $arrayElemAt: ["$shift_detail.shift_name", 0] }, start_time: { $arrayElemAt: ["$shift_detail.start_time", 0] }, end_time: { $arrayElemAt: ["$shift_detail.end_time", 0] },
                                }
                            },
                        ]).toArray().then(teamResult => {
                            callback(null, teamResult);
                        }).catch(next);
                    },
                }, (err, response) => {
                    if (err) reject(err);
                    else resolve(response);
                });
            });

            let userDetails = asyncResponse.user_records;
            let shiftData = asyncResponse.team_available;
            let shiftAailability = {};

            /**Call function for get date range */
            var dates = getDateRange(new Date(fromDate), new Date(toDate));
            let chooseDate = [];
            dates.map((shiftDate) => {
                let date = newDate(shiftDate, Constants.DATABASE_DATE_FORMAT);
                chooseDate.push(date);
                shiftData.map((shiftTime) => {
                    let dbDate = newDate(shiftTime.date, Constants.DATABASE_DATE_FORMAT);
                    let teamId = (shiftTime.user_id) ? shiftTime.user_id : "";
                    let teamDataId = (shiftTime._id) ? shiftTime._id : "";
                    let shiftId = (shiftTime.shift_id) ? shiftTime.shift_id : "";

                    /**Check for matching date */
                    if (date == dbDate) {
                        if (!shiftAailability[dbDate]) shiftAailability[dbDate] = {};
                        if (!shiftAailability[dbDate][teamId]) shiftAailability[dbDate][teamId] = {
                            shift_name: shiftTime.shift_name,
                            start_time: shiftTime.start_time,
                            end_time: shiftTime.end_time,
                            leave_type: (shiftTime.leave_type) ? shiftTime.leave_type : "",
                            status: shiftTime.status,
                            shift_id: shiftId,
                            id: teamDataId
                        };
                    }
                });
            });

            /**For render schedule page */
            return {
                layout: false,
                user_data: userDetails,
                shift_availablity: shiftAailability,
                choose_date: chooseDate,
                status: Constants.STATUS_SUCCESS,
            };
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get team schedule list
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async teamSchedule(req, res, next) {
        try {
            let authId = (req.session.user._id) ? req.session.user._id : "";

            if (isPost(req)) {
                let fromDate = (req.body.from_date) ? req.body.from_date : "";
                let toDate = (req.body.to_date) ? req.body.to_date : "";

                const asyncResponse = await new Promise((resolve, reject) => {
                    asyncParallel({
                        availabilities_details: (callback) => {
                            /**call function for get team availabilities details */
                            this.teamAvailabilitiesDetails(req, res, next, { from_date: fromDate, to_date: toDate }).then((response) => {
                                if (response.status != Constants.STATUS_SUCCESS) return callback(response);

                                callback(null, response);
                            }).catch(next);
                        },
                        leave_type_list: (callback) => {
                            /** Get leave type list **/
                            getAttributes(req, res, next, { type: "vacation_leave_type" }).then(leaveTypeList => {

                                let tempLeaveType = {};
                                if (leaveTypeList.length > 0) {
                                    leaveTypeList.map(records => {
                                        tempLeaveType[String(records.attribute_id)] = records.title;
                                    });
                                }
                                callback(null, tempLeaveType);
                            }).catch(next);
                        },
                    }, (asyncErr, asyncResponse) => {
                        if (asyncErr) reject(asyncErr);
                        else resolve(asyncResponse);
                    });
                });

                /**For render schedule page */
                res.render('schedule', {
                    layout: asyncResponse.availabilities_details.layout,
                    user_data: asyncResponse.availabilities_details.user_data,
                    shift_availablity: asyncResponse.availabilities_details.shift_availablity,
                    choose_date: asyncResponse.availabilities_details.choose_date,
                    leave_type_list: asyncResponse.leave_type_list,
                    from_date: fromDate,
                    to_date: toDate,
                    session_details: req.session.user
                });
            } else {
                /** render team_schedule listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/shift_setup/team_schedule']);
                res.render('team_schedule');
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to mail team schedule list
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async scheduleMail(req, res, next) {
        try {
            let authId = (req.session.user._id) ? req.session.user._id : "";
            let fromDate = newDate();
            let toDate = addDate(Constants.HOURS_IN_A_DAY * Constants.DAYS_IN_A_WEEK - 1);

            /**Call function for get date range */
            var dates = getDateRange(new Date(fromDate), new Date(toDate));

            const asyncResponse = await new Promise((resolve, reject) => {
                asyncParallel({
                    availabilities_details: (callback) => {
                        this.teamAvailabilitiesDetails(req, res, next, { from_date: fromDate, to_date: toDate }).then((response) => {
                            if (response.status != Constants.STATUS_SUCCESS) return callback(response);
                            callback(null, response);
                        }).catch(next);
                    },
                    leave_type_list: (callback) => {
                        /** Get leave type list **/
                        getAttributes(req, res, next, { type: "vacation_leave_type" }).then(leaveTypeList => {
                            let tempLeaveType = {};
                            if (leaveTypeList.length > 0) {
                                leaveTypeList.map(records => {
                                    tempLeaveType[String(records.attribute_id)] = records.title;
                                });
                            }
                            callback(null, tempLeaveType);
                        }).catch(next);
                    },
                }, (asyncErr, asyncResponse) => {
                    if (asyncErr) reject(asyncErr);
                    else resolve(asyncResponse);
                });
            });

            let userData = asyncResponse.availabilities_details.user_data;
            let shiftAvailablity = asyncResponse.availabilities_details.shift_availablity;
            let leaveTypeList = asyncResponse.leave_type_list;

            userData.map((userRecords) => {
                let scheduleHtml = "<table border='1' cellspacing='0' width=90%>" +
                    "<thead><tr>" +
                    "<th align='left'>&nbsp; " + res.__('admin.shift_setup.date') + "</th>" +
                    "<th align='left'>&nbsp; " + res.__('admin.shift_setup.shift') + "</th>" +
                    "</tr></thead><tbody>";

                dates.map((dateRecords) => {
                    let date = newDate(dateRecords, Constants.DATABASE_DATE_FORMAT);
                    let shiftData = (shiftAvailablity[date] && shiftAvailablity[date][userRecords._id]) ? shiftAvailablity[date][userRecords._id] : {};
                    let startTime = set24HourFormat(shiftData.start_time);
                    let endTime = set24HourFormat(shiftData.end_time);
                    let time = (startTime && endTime) ? startTime + " - " + endTime : "";
                    let shiftName = shiftData.shift_name;
                    let tableData = (shiftName && startTime && endTime) ? "<td>&nbsp; " + shiftName + " (" + time + ")</td>" : "<td></td>";

                    if (shiftData.leave_type) {
                        let leaveTypeTitle = (leaveTypeList[String(shiftData.leave_type)]) ? leaveTypeList[String(shiftData.leave_type)] : "";
                        tableData = "<td>&nbsp;&nbsp;" + leaveTypeTitle + "</td>";
                    }

                    scheduleHtml += "<tr><td>&nbsp;" + date + "</td>" + tableData + "</tr>";
                });

                scheduleHtml += "</tbody></table>";

                /**For send mail */
                sendMail(req, res, {
                    to: userRecords.email,
                    action: "team_schedule_mail",
                    rep_array: [userRecords.full_name, scheduleHtml]
                });
            });

            /**For send success response */
            req.flash(Constants.STATUS_SUCCESS, res.__("admin.shift_setup.your_team_schedule_mail_has_been_sent"));
            res.redirect(Constants.WEBSITE_ADMIN_URL + 'team_schedule');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to export schedule list
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async scheduleExport(req, res, next) {
        try {
            let fromDate = (req.params.from_date) ? (req.params.from_date) : "";
            let toDate = (req.params.to_date) ? (req.params.to_date) : "";

            const asyncResponse = await new Promise((resolve, reject) => {
                asyncParallel({
                    availabilities_details: (callback) => {
                        this.teamAvailabilitiesDetails(req, res, next, { from_date: fromDate, to_date: toDate }).then((response) => {
                            if (response.status != Constants.STATUS_SUCCESS) return callback(response);
                            callback(null, response);
                        }).catch(next);
                    },
                    leave_type_list: (callback) => {
                        /** Get leave type list **/
                        getAttributes(req, res, next, { type: "vacation_leave_type" }).then(leaveTypeList => {
                            let tempLeaveType = {};
                            if (leaveTypeList.length > 0) {
                                leaveTypeList.map(records => {
                                    tempLeaveType[String(records.attribute_id)] = records.title;
                                });
                            }
                            callback(null, tempLeaveType);
                        }).catch(next);
                    },
                    team_details: (callback) => {
                        /** Get roles name  **/
                        const admin_roles = this.db.collection(Tables.ADMIN_ROLES);
                        admin_roles.findOne({
                            _id: new ObjectId(req.session.user.user_role_id),
                            $and: [
                                { _id: { $ne: new ObjectId(Constants.CRAVEZ) } }
                            ],
                        }, { projection: { role_name: 1 } }, (roleErr, roleResult) => {
                            callback(roleErr, roleResult);
                        });
                    },
                }, (asyncErr, asyncResponse) => {
                    if (asyncErr) reject(asyncErr);
                    else resolve(asyncResponse);
                });
            });

            let userData = asyncResponse.availabilities_details.user_data;
            let shiftAvailablity = asyncResponse.availabilities_details.shift_availablity;
            let chooseDate = asyncResponse.availabilities_details.choose_date;
            let leaveTypeList = asyncResponse.leave_type_list;
            let teamDetails = asyncResponse.team_details;
            let teamName = (teamDetails && teamDetails.role_name) ? teamDetails.role_name.replace(RegExp(" ", "g"), "") + "-" : "";
            let temp = [];
            let commonColls = [res.__("admin.shift_setup.user_name")];

            /**For get date range */
            chooseDate.map((dates) => {
                commonColls.push(dates)
            });

            userData.map((userRecords) => {
                let buffer = [userRecords.full_name];
                chooseDate.map((dateRecords) => {
                    let shiftData = (shiftAvailablity[dateRecords] && shiftAvailablity[dateRecords][userRecords._id]) ? shiftAvailablity[dateRecords][userRecords._id] : {};
                    let startTime = (shiftData.start_time) ? set24HourFormat(shiftData.start_time) : "";
                    let endTime = (shiftData.end_time) ? set24HourFormat(shiftData.end_time) : "";
                    let shiftTime = (startTime && endTime) ? startTime + " - " + endTime : "";
                    if (shiftData.leave_type) {
                        let leaveTypeTitle = (leaveTypeList[String(shiftData.leave_type)]) ? leaveTypeList[String(shiftData.leave_type)] : "";
                        buffer.push(leaveTypeTitle);
                    } else {
                        buffer.push(shiftTime);
                    }
                });
                temp.push(buffer);
            });

            /**  Function to export data in excel format **/
            exportToExcel(req, res, {
                file_prefix: teamName + "TeamScheduleReport",
                heading_columns: commonColls,
                export_data: temp
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for assign shift for team schedule
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async assignShiftForTeamSchedule(req, res, next) {
        try {
            let authId = (req.session.user._id) ? new ObjectId(req.session.user._id) : "";

            if (isPost(req)) {
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let fromDate = (req.body.from_date) ? getUtcDate(req.body.from_date) : "";
                let toDate = (req.body.to_date) ? getUtcDate(req.body.to_date) : "";

                /** to assign shift **/
                const response = await this.commonAssignShift(req, res, next, {
                    from_date: fromDate,
                    to_date: toDate,
                    shift_user: req.body.shift_user,
                    shift_id: req.body.shift_id,
                });

                res.send(response);
            } else {
                /* Configure conditions for get already assigned and shifted users list */
                const asyncResponse = await new Promise((resolve, reject) => {
                    asyncParallel({
                        shift_detail: (callback) => {
                            /**For get shift details */
                            this.collection.find({
                                parent_id: (req.session.user.parent_id) ? new ObjectId(req.session.user.parent_id) : authId,
                                is_deleted: { $ne: Constants.DELETED }
                            }, { projection: { _id: 1, shift_name: 1, start_time: 1, end_time: 1 } }).toArray((shiftErr, shiftResult) => {
                                callback(shiftErr, shiftResult);
                            });
                        },
                        user_list: (callback) => {
                            /** Set user conditions */
                            let userConditions = clone(Constants.ADMIN_USER_COMMON_CONDITIONS);
                            userConditions.parent_id = authId;

                            /** get dropdown list for given role users **/
                            getDropdownList(req, res, next, {
                                collections: [{
                                    collection: Tables.USERS,
                                    columns: ["_id", "full_name"],
                                    conditions: userConditions
                                }]
                            }).then(dropDrownResponse => {
                                callback(null, dropDrownResponse);
                            }).catch(next);
                        }
                    }, (err, response) => {
                        if (err) reject(err);
                        else resolve(response);
                    });
                });

                /** Send error response */
                if (asyncResponse.user_list.status != Constants.STATUS_SUCCESS) {
                    return res.status(400).send({
                        status: Constants.STATUS_ERROR,
                        message: asyncResponse.user_list.message
                    });
                }

                /** For render assign shift page **/
                res.render('assign_shift_team_schedule', {
                    layout: false,
                    shift_detail: asyncResponse.shift_detail,
                    result: (asyncResponse.user_list.final_html_data[0]) ? asyncResponse.user_list.final_html_data[0] : "",
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to assign shift
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     * @param options	As Options object
     *
     * @return json
     */
    async commonAssignShift(req, res, next, options) {
        try {
            let fromDate = options.from_date ? options.from_date : "";
            let toDate = options.to_date ? options.to_date : "";
            let shiftUser = options.shift_user ? options.shift_user : [];
            let shiftId = options.shift_id ? new ObjectId(options.shift_id) : "";
            let authId = (req.session.user._id) ? new ObjectId(req.session.user._id) : "";

            if (!fromDate || !toDate || !shiftUser || shiftUser.length < 0 || !shiftId) {
                return { status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") };
            }

            /**For convert in arrray */
            if (shiftUser.constructor != Array) shiftUser = [shiftUser];

            /**call function for get date range */
            let dates = getDateRange(new Date(fromDate), new Date(toDate));

            /** Manage user shift */
            let shiftArray = [];
            dates.map(shiftDate => {
                let chooseDate = newDate(shiftDate, Constants.DATABASE_DATE_FORMAT);
                shiftUser.map(shiftUserId => {
                    shiftArray.push({
                        shift_id: shiftId,
                        user_id: new ObjectId(shiftUserId),
                        parent_id: authId,
                        date: getUtcDate(chooseDate + " " + Constants.END_DATE_TIME_FORMAT),
                        created: getUtcDate()
                    });
                });
            });

            /**  For save team_availablities collection */
            const team_availabilities = this.db.collection(Tables.TEAM_AVAILABILITIES);

            await new Promise((resolve, reject) => {
                asyncEach(shiftArray, (records, callback) => {
                    team_availabilities.updateOne({
                        date: records.date,
                        user_id: records.user_id,
                        parent_id: records.parent_id
                    }, {
                        $set: {
                            shift_id: records.shift_id,
                        },
                        $setOnInsert: {
                            created: getUtcDate(),
                        }
                    }, { upsert: true }, (updateErr, updateData) => {
                        callback(updateErr);
                    });
                }, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            /** save System logs */
            saveSystemLogs(req, res, {
                user_id: authId,
                parent_id: shiftId,
                activity_module: Constants.SYSTEM_LOG_MODULE_SHIFT_SETUP,
                activity_type: Constants.ACTIVITY_TYPE_ASSIGN,
                additional_details: {}
            });

            /* send success response */
            const response = {
                message: res.__("admin.shift_setup.shift_has_been_assigned_successfully"),
                status: Constants.STATUS_SUCCESS,
            };

            /**For save shift_logs collection */
            let userArray = arrayToObject(shiftUser);

            const shift_logs = this.db.collection(Tables.SHIFT_LOGS);
            shift_logs.insertOne({
                user_id: userArray,
                shift_id: shiftId,
                created_by: authId,
                created: getUtcDate()
            }, (logsErr) => {
                if (logsErr) return console.error(logsErr);
            });

            return response;
        } catch (error) {
            next(error);
        }
    }
}

export default ShiftSetup;