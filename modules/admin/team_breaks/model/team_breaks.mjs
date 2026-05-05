import { ObjectId } from 'mongodb';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, getDropdownList, getAttributes, newDate, arrayToObject } from '../../../../utils/index.mjs';
import { sendMailToUsers } from '../../../../services/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { parallel as asyncParallel, each as asyncEach } from 'async';

class TeamBreaks {
    constructor(db) {
        this.db = db;
        this.collection = this.db.collection(Tables.TEAM_BREAKS);
    }

    /**
     * Function to get team breaks list
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getBreaksList(req, res, next) {
        try {
            let authUserId = new ObjectId(req.session.user._id);

            if (isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                let fromDate = (req.body.fromDate) ? req.body.fromDate : "";
                let toDate = (req.body.toDate) ? req.body.toDate : "";
                let breakType = (req.body.breakType) ? req.body.breakType : "";

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);
                let commonConditions = {};

                if (req.session.user.user_role_id != Constants.CRAVEZ) {
                    commonConditions = {
                        $or: [
                            { user_id: authUserId },
                            { parent_id: authUserId }
                        ]
                    };
                }

                /**Filter by date */
                if (fromDate != "" && toDate != "") {
                    dataTableConfig.conditions["date"] = {
                        $gte: newDate(fromDate),
                        $lte: newDate(toDate),
                    };
                }

                /**Filter by break type */
                if (breakType != "") {
                    dataTableConfig.conditions.break_type = new ObjectId(breakType);
                }

                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

                const response = await new Promise((resolve, reject) => {
                    asyncParallel({
                        total_record: (callback) => {
                            /** Get list of team_breaks **/
                            this.collection.aggregate([
                                { $match: commonConditions },
                                {
                                    $lookup: {
                                        from: Tables.USERS,
                                        localField: "user_id",
                                        foreignField: "_id",
                                        as: "user_details",
                                    }
                                },
                                { $addFields: { user_name: { $arrayElemAt: ["$user_details.full_name", 0] } } },
                                { $match: dataTableConfig.conditions },
                                { $sort: dataTableConfig.sort_conditions },
                                { $skip: skip },
                                { $limit: limit },
                                {
                                    $lookup: {
                                        from: Tables.ATTRIBUTES,
                                        localField: "break_type",
                                        foreignField: "_id",
                                        as: "break_types",
                                    }
                                },
                                {
                                    $project: {
                                        _id: 1, parent_id: 1, date: 1, user_id: 1, break_type: 1, start_time: 1, end_time: 1, duration: 1, rejection_reason: 1, status: 1, user_name: 1, created: 1,
                                        break_type_name: { $arrayElemAt: ["$break_types.title", 0] },
                                    }
                                }
                            ])
                                .toArray()
                                .then(result => {
                                    callback(null, result);
                                })
                                .catch(callback);
                        },
                        total_count: (callback) => {
                            /** Get total number of records in team_breaks collection **/
                            this.collection.countDocuments(commonConditions)
                                .then(countResult => {
                                    callback(null, countResult);
                                })
                                .catch(callback);
                        },
                        filter_result: (callback) => {
                            /** Get filtered records counting in team breaks collection **/
                            this.collection.aggregate([
                                { $match: commonConditions },
                                {
                                    $lookup: {
                                        from: Tables.USERS,
                                        localField: "user_id",
                                        foreignField: "_id",
                                        as: "user_details",
                                    }
                                },
                                {
                                    $project: {
                                        _id: 1, parent_id: 1, user_id: 1, break_type: 1, start_time: 1, end_time: 1, duration: 1, date: 1, status: 1, user_name: { $arrayElemAt: ["$user_details.full_name", 0] }
                                    }
                                },
                                { $match: dataTableConfig.conditions },
                                { $count: "count" },
                            ])
                                .toArray()
                                .then(filterContResult => {
                                    filterContResult = (filterContResult && filterContResult[0]) ? filterContResult[0].count : 0;
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
                    data: (response.total_record) ? response.total_record : [],
                    recordsFiltered: (response.filter_result) ? response.filter_result : 0,
                    recordsTotal: (response.total_count) ? response.total_count : 0
                });
            } else {
                let queryBreakType = (req.query.break_type) ? req.query.break_type : "";
                const attributes = await getAttributes(req, res, next, { type: "break_type" });

                /** render team breaks listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/team_breaks/list']);
                res.render('list', {
                    break_types: attributes,
                    query_break_type: queryBreakType
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for add or update break
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async addEditBreak(req, res, next) {
        try {
            let isEditable = (req.params.id) ? true : false;
            let authId = req.session.user._id;
            let teamHead = req.session.user.team_head;

            if (isPost(req)) {
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);

                let startTime = (req.body.start_time) ? parseFloat(req.body.start_time.replace(':', '.')) : 0;
                let endTime = (req.body.end_time) ? parseFloat(req.body.end_time.replace(':', '.')) : 0;
                let breakType = (req.body.break_type) ? req.body.break_type : "";
                let currentHours = newDate().getHours();
                let currentMinutes = newDate().getMinutes();
                if (currentMinutes < 10) currentMinutes = "0" + currentMinutes;

                let currentTime = parseFloat(currentHours + "." + currentMinutes);

                let errors = [];
                if (startTime && startTime < currentTime) {
                    errors.push({ 'param': 'start_time', 'msg': res.__("admin.team_breaks.start_time_should_be_greater_than_current_time") });
                }
                if (endTime && endTime <= startTime) {
                    errors.push({ 'param': 'end_time', 'msg': res.__("admin.team_breaks.end_time_should_be_greater_than_start_time") });
                }

                /** Send error response **/
                if (errors.length > 0) return res.send({ status: Constants.STATUS_ERROR, message: errors });

                let userIds = (teamHead) ? req.body.user_id : authId;

                /**To convert in arrray */
                if (userIds.constructor != Array) userIds = [userIds];

                /** Find user details **/
                const users = this.db.collection(Tables.USERS);
                const userList = await users.find({
                    _id: { $in: arrayToObject(userIds) },
                    is_deleted: Constants.NOT_DELETED,
                    active: Constants.ACTIVE,
                    user_type: Constants.USER_TYPE_ADMIN,
                }, { projection: { _id: 1, parent_id: 1 } }).toArray();

                /** Send error response */
                if (userList.length <= 0) {
                    return res.send({
                        status: Constants.STATUS_ERROR,
                        message: res.__("admin.system.something_going_wrong_please_try_again"),
                    });
                }

                let currentDate = newDate("", Constants.DATABASE_DATE_FORMAT);
                let timeStart   = new Date(currentDate + " " + req.body.start_time);
                let timeEnd     = new Date(currentDate + " " + req.body.end_time);
                let difference  = Math.ceil((timeEnd - timeStart) / Constants.MILLISECONDS_IN_A_SECOND);
                let breakDate   = newDate("",Constants.CURRENTDATE_START_DATE_FORMAT);

                /** Set data to update */
                let dataToUpdate = {
                    date: getUtcDate(breakDate),
                    break_type: new ObjectId(breakType),
                    start_time: parseFloat(startTime),
                    end_time: parseFloat(endTime),
                    duration: difference,
                    modified: getUtcDate()
                };

                let emailSendData = [];

                console.log("teamHead ",teamHead);
                console.log("req.session.user ",req.session.user);

                await new Promise((resolve, reject) => {
                    asyncEach(userList, (records, eachCallback) => {
                        let tmpUserId = records._id;
                        let tmpParentId = records.parent_id;

                        /** Save team breaks details */
                        this.collection.updateOne({
                            _id: new ObjectId()
                        },
                        {
                            $set: dataToUpdate,
                            $setOnInsert: {
                                parent_id: tmpParentId,
                                user_id: tmpUserId,
                                status: (req.session.user.user_role_id == Constants.CRAVEZ || teamHead) ? Constants.APPROVED : Constants.PENDING,
                                created: getUtcDate(),
                            }
                        }, { upsert: true })
                            .then(updateResult => {
                                let tmpBreakId = (updateResult && updateResult.upsertedId && updateResult.upsertedId._id) ? updateResult.upsertedId._id : "";

                                emailSendData.push({
                                    break_id: tmpBreakId,
                                    user_id: tmpUserId,
                                    parent_id: tmpParentId,
                                });
                                eachCallback(null);
                            })
                            .catch(eachCallback);
                    }, (eachErr) => {
                        if (eachErr) reject(eachErr);
                        else resolve();
                    });
                });

                /** Send success response **/
                let message = (isEditable) ? res.__("admin.team_breaks.break_has_been_updated_successfully") : res.__("admin.team_breaks.break_has_been_added_successfully");
                if (!isEditable) req.flash(Constants.STATUS_SUCCESS, message);
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "team_breaks",
                    message: message,
                });

                if (emailSendData.length > 0) {
                    emailSendData.map(records => {
                        if (records.parent_id && records.break_id) {
                            if (req.session.user.user_role_id == Constants.CRAVEZ || teamHead) {
                                /*************** Send Mail  ***************/
                                sendMailToUsers(req, res, {
                                    event_type: Constants.TEAM_BREAK_APPROVE_REJECT_EMAIL_EVENTS,
                                    break_id: records.break_id,
                                    action_taken: Constants.APPROVED,
                                    user_id: records.user_id,
                                    break_details: {
                                        user_id: records.user_id,
                                        date: breakDate,
                                        start_time: parseFloat(startTime),
                                        end_time: parseFloat(endTime)
                                    }
                                });
                                /*************** Send Mail  ***************/
                            } else {
                                /*************** Send Mail  ***************/
                                sendMailToUsers(req, res, {
                                    event_type: Constants.TEAM_BREAK_REQUEST_POSTED_EMAIL_EVENTS,
                                    break_id: records.break_id,
                                    user_id: records.parent_id,
                                    member_id: records.user_id,
                                    break_details: dataToUpdate
                                });
                                /*************** Send Mail  ***************/
                            }
                        }
                    });
                }
            } else {
                const asyncResponse = await new Promise((resolve, reject) => {
                    asyncParallel({
                        break_details: (callback) => {
                            if (!isEditable) return callback(null, null);
                            this.getBreakDetails(req, res, next)
                                .then(response => {
                                    callback(null, response);
                                })
                                .catch(callback);
                        },
                        attributes: (callback) => {
                            getAttributes(req, res, next, { type: "break_type" })
                                .then(attributes => {
                                    callback(null, attributes);
                                })
                                .catch(callback);
                        }
                    }, (asyncErr, response) => {
                        if (asyncErr) reject(asyncErr);
                        else resolve(response);
                    });
                });

                let teamBreakResponse = (asyncResponse.break_details) ? asyncResponse.break_details : {};
                let teamBreakDetails = (teamBreakResponse.result) ? teamBreakResponse.result : {};
                let attributes = (asyncResponse.attributes) ? asyncResponse.attributes : [];

                /** Send error response **/
                if (isEditable && teamBreakResponse.status != Constants.STATUS_SUCCESS) {
                    return res.status(400).send({ status: Constants.STATUS_ERROR, message: teamBreakResponse.message });
                }

                /** Set dropdown options **/
                let selectedUser = (teamBreakDetails.user_id) ? teamBreakDetails.user_id : authId;
                let options = {
                    collections: [
                        {
                            collection: Tables.USERS,
                            columns: ["_id", "full_name"],
                            conditions: {
                                is_deleted: Constants.NOT_DELETED,
                                active: Constants.ACTIVE,
                                user_type: Constants.USER_TYPE_ADMIN,
                                $or: [
                                    { _id: new ObjectId(authId) },
                                    { parent_id: new ObjectId(authId) }
                                ],
                            },
                            selected: [selectedUser]
                        },
                    ],
                };

                /**Get team member dropdown list **/
                const dropDownResponse = await getDropdownList(req, res, next, options);
                if (dropDownResponse.status != Constants.STATUS_SUCCESS) {
                    /** Send error response **/
                    return res.status(400).send({ status: Constants.STATUS_ERROR, message: dropDownResponse.message });
                }

                /** Render edit page  **/
                let breadcrumbs = (isEditable) ? 'admin/team_breaks/edit' : 'admin/team_breaks/add';
                req.breadcrumbs(BREADCRUMBS[breadcrumbs]);
                res.render('add_edit', {
                    layout: false,
                    result: teamBreakDetails,
                    break_types: attributes,
                    is_editable: isEditable,
                    team_member_list: dropDownResponse.final_html_data["0"]
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get break detail
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return json
     */
    async getBreakDetails(req, res, next) {
        try {
            let breakId = (req.params.id) ? req.params.id : "";

            /**For check break id */
            if (!breakId) return { status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") };

            /** Get break details **/
            const breakResult = await this.collection.findOne({
                _id: new ObjectId(breakId),
            }, {
                projection: {
                    _id: 1, parent_id: 1, user_id: 1, date: 1, break_type: 1, start_time: 1, end_time: 1, duration: 1, reason: 1, status: 1, approved_by: 1
                }
            });

            /** Send error response */
            if (!breakResult) return { status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") };

            /** Send success response **/
            return {
                status: Constants.STATUS_SUCCESS,
                result: breakResult
            };
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for approve break
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return null
     */
    async acceptBreak(req, res, next) {
        try {
            let action = (req.params.action) ? req.params.action : "";
            let breakId = (req.params.id) ? new ObjectId(req.params.id) : "";
            let authId = (req.session.user && req.session.user._id) ? new ObjectId(req.session.user._id) : "";

            /**set fields to approve details **/
            let dataToBeSave = {};
            if (action == Constants.APPROVED) {
                dataToBeSave["$set"] = {
                    status: Constants.APPROVED,
                    modified: getUtcDate()
                };
                dataToBeSave["$unset"] = { rejection_reason: 1 };
            }

            /**Set fields to rejects break **/
            let rejectionReason = req?.body?.rejection_reason || '';
            if (action == Constants.REJECTED) {
                dataToBeSave["$set"] = {
                    status: Constants.REJECTED,
                    rejection_reason: rejectionReason,
                    approved_by: authId,
                    modified: getUtcDate(),
                };
            }

            /**if no data to update */
            if (Object.keys(dataToBeSave).length < 1) {
                req.flash(Constants.STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
                return res.redirect(Constants.WEBSITE_ADMIN_URL + "team_breaks");
            }

            const result = await this.collection.findOneAndUpdate({
                _id: breakId,
                $or: [
                    { user_id: new ObjectId(authId) },
                    { parent_id: new ObjectId(authId) }
                ]
            }, dataToBeSave, { projection: { _id: 1, user_id: 1, rejection_reason: 1, date: 1, start_time: 1, end_time: 1 } });

            /** if action type approved **/
            if (action == Constants.APPROVED) {
                /** Send success response **/
                req.flash(Constants.STATUS_SUCCESS, res.__("admin.team_breaks.team_break_has_been_approved"));
                res.redirect(Constants.WEBSITE_ADMIN_URL + "team_breaks");
            }

            /** if action type rejected **/
            if (action == Constants.REJECTED) {
                /** Send success response **/
                req.flash(Constants.STATUS_SUCCESS, res.__("admin.team_breaks.team_break_has_been_rejected"));
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "team_breaks"
                });
            }

            let breakDetails = result || {};
            let userId = (breakDetails.user_id) ? breakDetails.user_id : "";
            if (action == Constants.REJECTED) breakDetails.rejection_reason = rejectionReason;

            /*************** Send Mail  ***************/
            sendMailToUsers(req, res, {
                event_type: Constants.TEAM_BREAK_APPROVE_REJECT_EMAIL_EVENTS,
                break_id: breakId,
                action_taken: action,
                user_id: userId,
                break_details: breakDetails
            });
            /*************** Send Mail  ***************/
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for delete breaks
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return null
     */
    async deleteBreak(req, res, next) {
        try {
            let breakId = (req.params.id) ? new ObjectId(req.params.id) : "";
            let authId = (req.session.user && req.session.user._id) ? new ObjectId(req.session.user._id) : "";

            /** Remove team breaks record **/
            await this.collection.deleteOne({
                _id: breakId,
                $or: [
                    { user_id: new ObjectId(authId) },
                    { parent_id: new ObjectId(authId) }
                ]
            });

            /** Send success response **/
            req.flash(Constants.STATUS_SUCCESS, res.__("admin.team_breaks.break_deleted_successfully"));
            res.redirect(Constants.WEBSITE_ADMIN_URL + "team_breaks");
        } catch (error) {
            next(error);
        }
    }
}

export default TeamBreaks; 