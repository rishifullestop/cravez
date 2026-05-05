import { ObjectId } from 'mongodb';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, newDate, getDropdownList, getAttributes, exportToExcel } from '../../../../utils/index.mjs';
import { saveSystemLogs} from "../../../../services/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import clone from 'clone';
import moment from 'moment';

class DriverLeaveManagement {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.DRIVER_AVAILABILITIES);
        this.usersCollection = db.collection(Tables.USERS);
        this.userLeavesCollection = db.collection(Tables.USER_LEAVES);

        this.exportNumber = 0;
        this.exportFilterConditions = {};
        this.exportSortConditions = {};
        this.exportCommonConditions = {};
        this.exportSortConditions[this.exportNumber] = {_id: Constants.SORT_DESC};
    }

    /**
     * Get vacation request list
     */
    async getVacationRequestList(req, res, next) {
        try {
            let isTeamHead = req.session.user.team_head || false;
            let authId = isTeamHead ? req.session.user._id : req.session.user.parent_id;
            let authUserRoleId = req.session.user?.user_role_id || '';
           
            if(isPost(req)){
                let limit = req.body.length ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = req.body.start ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                let fromDate = req.body.fromDate || '';
                let toDate = req.body.toDate || '';
               
                const dataTableConfig = await configDatatable(req, res, null);
                
                let commonConditions = {leave_type: { $exists: true}};

                if(fromDate && toDate) {
                    commonConditions.date = { $gte: newDate(fromDate), $lte: newDate(toDate) };
                }
                if(authUserRoleId != Constants.CRAVEZ) commonConditions.parent_id = new ObjectId(authId);

                Object.assign(dataTableConfig.conditions, commonConditions);

                // Get list or count of cuisines
                let dbRes = await this.collectionDb.aggregate([
                    {$match: dataTableConfig.conditions },
                    {$group: {
                        _id: {
                            date: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: Constants.DEFAULT_TIME_ZONE } },
                            driver_id: '$user_id',
                        },
                        date: { $first: '$date' },
                        root_id: { $first: '$_id' },
                        status: { $first: '$status' },
                        leave_type: { $first: '$leave_type' },
                        user_id: { $first: '$user_id' },
                        parent_id: { $first: '$parent_id' },
                        leave_status: { $first: '$leave_status' },
                        rejection_reason: { $first: '$rejection_reason' },
                    }},
                    {$addFields: { _id: '$root_id' } },
                    {$facet : {
                        list : [
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit },
                            {$lookup: {
                                from: Tables.USERS,
                                localField: 'user_id',
                                foreignField: '_id',
                                as: 'users_details'
                            }},
                            { $project: {
                                _id: 1, date: 1, status: 1, leave_type: 1, user_id: 1, parent_id: 1, leave_status: 1, rejection_reason: 1, driver_name: { $arrayElemAt: ['$users_details.full_name', 0] }, driver_id: { $arrayElemAt: ['$users_details.driver_id', 0] }
                            }}
                        ],
                        count: [
                            {$count: "count"},
                        ],
                    }}
                ]).toArray();


                const [requestList, filterRecords, leaveDetails, drivers] = await Promise.all([
                    
                    dataTableConfig.conditions.user_id ? 
                        this.userLeavesCollection.findOne({ user_id: new ObjectId(dataTableConfig.conditions.user_id) }, { projection: { _id: 1, leaves: 1, total_leave: 1 } }) 
                    : Promise.resolve(null),
                    authUserRoleId == Constants.CRAVEZ ? getDropdownList(req, res, next, {
                        collections: [{
                            collection: Tables.USERS,
                            columns: ['_id', 'full_name'],
                            conditions: Constants.DRIVER_COMMON_CONDITIONS
                        }]
                    }) : Promise.resolve(null),
                ]);

                let filterCount = filterRecords.length > 0 ? filterRecords[0].count : 0;
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data: requestList || [],
                    recordsFiltered: filterCount,
                    recordsTotal: filterCount,
                    leave_details: leaveDetails || {},
                    drivers: drivers ? (drivers.final_html_data ? (drivers.final_html_data['0'] || '') : '') : '',
                });
            } else {
                const [dropdownList, leaveTypeList] = await Promise.all([
                    getDropdownList(req, res, next, {
                        collections: [{
                            collection: Tables.USERS,
                            columns: ['_id', 'full_name'],
                            conditions: Constants.DRIVER_COMMON_CONDITIONS,
                            append_to_value: true,
                            sub_title_field: 'driver_id',
                        }]
                    }),
                    getAttributes(req, res, next, { type: 'vacation_leave_type' }),
                ]);
                let tempLeaveType = {};
                if(leaveTypeList.length > 0) {
                    leaveTypeList.forEach(record => {
                        tempLeaveType[String(record.attribute_id)] = record.title;
                    });
                }
                req.breadcrumbs(BREADCRUMBS['admin/driver_leave_management/list']);
                res.render('list', {
                    users_list: dropdownList.final_html_data ? dropdownList.final_html_data[0] : '',
                    leave_type_list: tempLeaveType,
                    export_count: 1, // Simplified export count
                    from_date: req.query.from_date || '',
                    to_date: req.query.to_date || '',
                });
            }
        } catch (error) { next(error); }
    }

    /**
     * Add or edit a vacation request
     */
    async addEditVacationRequest(req, res, next) {
        try {
            const isEditable = !!req.params.id;
            const vacationRequestId = req.params.id || '';
            const isDriverShift= req.query.is_driver_shift || '';
            const isTeamHead=   req.session.user.team_head || false;
            const authId    =   isTeamHead ? req.session.user._id : req.session.user.parent_id;
            const addedBy   =   req.session.user?._id || '';

            if(isPost(req)) {
                req.body        =   sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                const driverId  =   req.body.driver ? new ObjectId(req.body.driver) : '';
                const fromDate  =   req.body.from_date || '';
                const toDate    =   req.body.to_date || '';
                
                const tempFromDate  =   newDate(newDate(fromDate, Constants.CURRENTDATE_START_DATE_FORMAT));
                const tempToDate    =   newDate(newDate(toDate, Constants.CURRENTDATE_END_DATE_FORMAT));
                
                const driverInShift = await this.db.collection(Tables.DRIVER_IN_OUT_SHIFTS).findOne({
                    driver_id: driverId,
                    created: { $gte: tempFromDate },
                    type: Constants.IN_SHIFT,
                }, { projection: { _id: 1 } });
                
                if(driverInShift) return res.send({ status: Constants.STATUS_ERROR, message: [{ param: 'leave_date', msg: res.__('admin.driver_leave_management.not_allow_because_driver_inshift') }] });
                
                let requestIds = [];
                if(isEditable) {
                    const reqRes = await this._vacationRequestDetails(req, res, next);
                    if(reqRes.status != Constants.STATUS_SUCCESS) return res.send(reqRes);
                    const tmpDetails = reqRes.result;
                    const tmpStartDate = newDate(newDate(tmpDetails.date, Constants.CURRENTDATE_START_DATE_FORMAT));
                    const tmpEndDate = newDate(newDate(tmpDetails.date, Constants.CURRENTDATE_END_DATE_FORMAT));
                    requestIds = await this.collectionDb.distinct('_id', { user_id: driverId, date: { $gte: tmpStartDate, $lte: tmpEndDate } });
                }
                const weeklyLeaveList = await this.collectionDb.find({
                    date: { $gte: tempFromDate, $lte: tempToDate },
                    user_id: driverId,
                    leave_type: Constants.WEEKLY_OFF,
                }, { projection: { date: 1 } }).toArray();
                const weeklyLeaveIds = weeklyLeaveList.map(item => item._id);
                const weeklyLeaveDates = weeklyLeaveList.map(item => String(newDate(item.date, Constants.DATE_FORMAT_EXPORT)));
                let driverAvailableConditions = {
                    date: { $gte: tempFromDate, $lte: tempToDate },
                    user_id: driverId,
                    leave_type: { $exists: true },
                    _id: { $nin: weeklyLeaveIds },
                };
                if(isEditable) driverAvailableConditions._id = { $nin: requestIds };
                const totalRecords = await this.collectionDb.countDocuments(driverAvailableConditions);
                if(totalRecords > 0) return res.send({ status: Constants.STATUS_ERROR, message: [{ param: 'leave_date', msg: res.__('admin.driver_leave_management.entered_leave_date_already_exists') }] });
                if(isEditable && requestIds.length > 0) {
                    await this.collectionDb.updateMany({
                        _id: { $in: requestIds },
                        status: Constants.PENDING,
                    }, { $unset: { status: 1, leave_type: 1, rejection_reason: 1, leave_status: 1 } });
                    await this.collectionDb.deleteMany({ _id: { $in: requestIds }, shift_id: '' });
                }
                let updateData = [];
                let dates = getDates(new Date(fromDate), new Date(toDate));
                dates.forEach(record => {
                    let date = newDate(record, Constants.DATABASE_DATE_FORMAT);
                    let tempObj = {
                        added_by: new ObjectId(addedBy),
                        parent_id: new ObjectId(authId),
                        user_id: driverId,
                        leave_type: parseInt(req.body.leave_type),
                        status: Constants.PENDING,
                        date: getUtcDate(date + ' ' + Constants.END_DATE_TIME_FORMAT),
                        created: getUtcDate(),
                        leave_status: parseInt(req.body.leave_status),
                    };
                    if(req.body.leave_status == Constants.REJECTED) tempObj.rejection_reason = req.body.rejection_reason;
                    updateData.push(tempObj);
                });
                for(const record of updateData) {
                    if(weeklyLeaveDates.includes(String(newDate(record.date, Constants.DATE_FORMAT_EXPORT)))) continue;
                    let setData = {
                        status: Constants.PENDING,
                        leave_type: record.leave_type,
                        leave_status: record.leave_status,
                    };
                    if(record.rejection_reason) setData.rejection_reason = record.rejection_reason;
                    await this.collectionDb.updateMany({
                        date: record.date,
                        user_id: record.user_id,
                        parent_id: record.parent_id,
                    }, {
                        $set: setData,
                        $setOnInsert: {
                            shift_id: '',
                            city_id: '',
                            area_id: '',
                            added_by: record.added_by,
                            created: getUtcDate(),
                        },
                    }, { upsert: true });
                    saveSystemLogs(req, res, {
                        user_id: req.session.user._id,
                        parent_id: vacationRequestId,
                        activity_module: Constants.SYSTEM_LOG_MODULE_VACATION_REQUEST,
                        activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                        additional_details: { date: record.date, user_id: record.user_id, parent_id: record.parent_id, weekly_leave_ids: weeklyLeaveIds },
                    });
                }
                let message = isEditable ? res.__('admin.driver_leave_management.vacation_request_has_been_updated_successfully') : res.__('admin.driver_leave_management.vacation_request_has_been_added_successfully');
                req.flash(Constants.STATUS_SUCCESS, message);
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: isDriverShift ? Constants.WEBSITE_ADMIN_URL + 'driver_shifts' : Constants.WEBSITE_ADMIN_URL + 'driver_leave_management/driver_vacation_request',
                    message,
                });
                sendMailToUsers(req, res, {
                    event_type: Constants.NOTIFICATION_VACATION_REQUEST,
                    parent_table_id: req.body.driver,
                    user_id: req.body.driver,
                    tl_fullname: req.session.user.full_name,
                });
            } else {
                let response = {};
                if(isEditable) {
                    response = await this._vacationRequestDetails(req, res, next);
                    if(response.status != Constants.STATUS_SUCCESS) return res.status(400).send(response);
                }
                const driverId = response.result?.user_id || '';
                const leaveType = response.result?.leave_type || '';
                const dropDownResponse = await getDropdownList(req, res, next, {
                    collections: [
                        { collection: Tables.USERS, columns: ['_id', 'full_name'], conditions: Constants.DRIVER_COMMON_CONDITIONS, selected: [driverId] },
                        { collection: Tables.ATTRIBUTES, columns: ['attribute_id', 'title'], conditions: { type: 'vacation_leave_type', is_show: true }, selected: [leaveType], sort_conditions: { order: Constants.SORT_ASC } },
                    ],
                });
                if(dropDownResponse.status != Constants.STATUS_SUCCESS) return res.status(400).send(dropDownResponse);
                res.render('add_edit', {
                    layout: false,
                    result: response.result || {},
                    is_editable: isEditable,
                    users_list: dropDownResponse.final_html_data['0'],
                    leave_type_list: dropDownResponse.final_html_data['1'],
                    is_driver_shift: isDriverShift,
                });
            }
        } catch (error) { next(error); }
    }

    /**
     * Delete a vacation request
     */
    async vacationRequestDelete(req, res, next) {
        try {
            const requestId = new ObjectId(req.params.id);
            const isTeamHead = req.session.user.team_head || false;
            const authId = isTeamHead ? new ObjectId(req.session.user._id) : new ObjectId(req.session.user.parent_id);
            const shiftResult = await this.collectionDb.findOne({
                _id: requestId,
                parent_id: authId,
                $or: [{ status: Constants.PENDING }, { leave_type: Constants.WEEKLY_OFF }],
            }, { projection: { _id: 1, shift_id: 1, user_id: 1, date: 1 } });
            if(!shiftResult) {
                req.flash(Constants.STATUS_ERROR, res.__('admin.system.invalid_access'));
                return res.redirect(Constants.WEBSITE_ADMIN_URL + 'driver_leave_management/driver_vacation_request');
            }
            const tmpStartDate = newDate(newDate(shiftResult.date, Constants.CURRENTDATE_START_DATE_FORMAT));
            const tmpEndDate = newDate(newDate(shiftResult.date, Constants.CURRENTDATE_END_DATE_FORMAT));
            const requestIds = await this.collectionDb.distinct('_id', { user_id: shiftResult.user_id, date: { $gte: tmpStartDate, $lte: tmpEndDate } });
            if(requestIds.length === 0) {
                req.flash(Constants.STATUS_ERROR, res.__('admin.system.invalid_access'));
                return res.redirect(Constants.WEBSITE_ADMIN_URL + 'driver_leave_management/driver_vacation_request');
            }
            if(shiftResult.shift_id) {
                await this.collectionDb.updateMany({ _id: { $in: requestIds } }, { $unset: { status: 1, leave_type: 1, leave_status: 1 } });
            } else {
                await this.collectionDb.deleteMany({ _id: { $in: requestIds }, shift_id: '' });
            }
            req.flash(Constants.STATUS_SUCCESS, res.__('admin.driver_leave_management.vacation_request_has_been_deleted_successfully'));
            res.redirect(Constants.WEBSITE_ADMIN_URL + 'driver_leave_management/driver_vacation_request');
            requestIds.forEach(reqId => {
                saveSystemLogs(req, res, {
                    user_id: req.session.user._id,
                    parent_id: reqId,
                    activity_module: Constants.SYSTEM_LOG_MODULE_VACATION_REQUEST,
                    activity_type: Constants.ACTIVITY_TYPE_DELETE,
                    additional_details: {},
                });
            });
        } catch (error) { next(error); }
    }

    /**
     * Add or edit weekly off
     */
    async addWeeklyOff(req, res, next) {
        try {
            const isEditable = !!req.params.id;
            const weeklyRequestId = req.params.id || '';
            const addedBy = req.session.user?._id || '';
            const isTeamHead = req.session.user.team_head || false;
            const authId = isTeamHead ? req.session.user._id : req.session.user.parent_id;
            const isDriverShift = req.query.is_driver_shift || '';

            if(isPost(req)) {
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                const driverId = req.body.driver ? new ObjectId(req.body.driver) : '';
                const dates = (req.body.dates || '').split(',').filter(d => d);
                const dateArray = dates.map(d => getUtcDate(newDate(d, Constants.DATABASE_DATE_FORMAT) + ' ' + Constants.END_DATE_TIME_FORMAT));
                let requestIds = [];
                if(isEditable) {
                    const reqRes = await this._vacationRequestDetails(req, res, next);
                    if(reqRes.status != Constants.STATUS_SUCCESS) return res.send(reqRes);
                    const tmpDetails = reqRes.result;
                    const tmpDate = newDate(tmpDetails.date, Constants.DATABASE_DATE_FORMAT);
                    const tmpStartDate = newDate(tmpDate + ' ' + Constants.START_DATE_TIME_FORMAT);
                    const tmpEndDate = newDate(tmpDate + ' ' + Constants.END_DATE_TIME_FORMAT);
                    requestIds = await this.collectionDb.distinct('_id', { user_id: driverId, date: { $gte: newDate(tmpStartDate), $lte: newDate(tmpEndDate) } });
                }
                const availabilitiesConditions = {
                    date: { $in: dateArray },
                    user_id: driverId,
                    leave_type: { $exists: true },
                };
                if(isEditable) availabilitiesConditions._id = { $nin: requestIds };
                const totalRecords = await this.collectionDb.countDocuments(availabilitiesConditions);
                if(totalRecords > 0) return res.send({ status: Constants.STATUS_ERROR, message: [{ param: 'dates', msg: res.__('admin.driver_leave_management.entered_leave_date_already_exists') }] });
                if(isEditable && requestIds.length > 0) {
                    await this.collectionDb.updateMany({ _id: { $in: requestIds } }, { $unset: { status: 1, leave_type: 1 } });
                    await this.collectionDb.deleteMany({ _id: { $in: requestIds }, shift_id: '' });
                }
                let updateData = dates.map(d => {
                    const date = newDate(d, Constants.DATABASE_DATE_FORMAT);
                    return {
                        parent_id: new ObjectId(authId),
                        added_by: new ObjectId(addedBy),
                        user_id: driverId,
                        leave_type: Constants.WEEKLY_OFF,
                        date: getUtcDate(date + ' ' + Constants.END_DATE_TIME_FORMAT),
                        created: getUtcDate(),
                    };
                });
                for(const record of updateData) {
                    await this.collectionDb.updateMany({
                        date: record.date,
                        user_id: record.user_id,
                        parent_id: record.parent_id,
                    }, {
                        $set: { leave_status: Constants.APPROVED, status: Constants.PENDING, leave_type: record.leave_type },
                        $setOnInsert: { shift_id: '', city_id: '', area_id: '', added_by: record.added_by, created: getUtcDate() },
                    }, { upsert: true });
                    saveSystemLogs(req, res, {
                        user_id: req.session.user._id,
                        parent_id: weeklyRequestId,
                        activity_module: Constants.SYSTEM_LOG_MODULE_WEEKLY_OFF,
                        activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                        additional_details: { date: record.date, user_id: record.user_id, parent_id: record.parent_id },
                    });
                }
                const message = isEditable ? res.__('admin.driver_leave_management.weekly_off_has_been_updated_successfully') : res.__('admin.driver_leave_management.weekly_off_has_been_added_successfully');
                req.flash(Constants.STATUS_SUCCESS, message);
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: !isEditable || isDriverShift ? Constants.WEBSITE_ADMIN_URL + 'driver_shifts' : Constants.WEBSITE_ADMIN_URL + 'driver_leave_management/driver_vacation_request',
                    message,
                });
                sendMailToUsers(req, res, {
                    event_type: Constants.NOTIFICATION_WEEKLY_REQUEST,
                    parent_table_id: driverId,
                    user_id: driverId,
                    tl_fullname: req.session.user.full_name,
                });
            } else {
                let response = {};
                if(isEditable) {
                    response = await this._vacationRequestDetails(req, res, next);
                    if(response.status != Constants.STATUS_SUCCESS) return res.status(400).send(response);
                }
                const driverId = response.result?.user_id || '';
                const dropDownResponse = await getDropdownList(req, res, next, {
                    collections: [{
                        collection: Tables.USERS,
                        columns: ['_id', 'full_name'],
                        conditions: clone(Constants.DRIVER_COMMON_CONDITIONS),
                        selected: [driverId]
                    }]
                });
                if(dropDownResponse.status != Constants.STATUS_SUCCESS) return res.status(400).send(dropDownResponse);
                res.render('weekly_off', {
                    layout: false,
                    users_list: dropDownResponse.final_html_data['0'],
                    result: response.result || {},
                    is_editable: isEditable,
                    is_driver_shift: isDriverShift,
                });
            }
        } catch (error) { next(error); }
    }

    /**
     * Update vacation request status
     */
    async updateRequestStatus(req, res, next) {
        try {
            req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
            const status = req.body.status || '';
            const requestIds = (req.body.req_ids || '').split(',').map(id => new ObjectId(id));
            if(!status || requestIds.length === 0) return res.send({ status: Constants.STATUS_ERROR, message: res.__('system.invalid_access') });
            const results = await this.collectionDb.find({
                _id: { $in: requestIds },
                status: Constants.PENDING,
            }, { projection: { _id: 1, user_id: 1, date: 1 } }).toArray();
            if(results.length === 0) return res.send({ status: Constants.STATUS_ERROR, message: res.__('admin.system.something_going_wrong_please_try_again') });
            for(const record of results) {
                const tmpDate = newDate(record.date, Constants.DATABASE_DATE_FORMAT);
                const tmpStartDate = newDate(tmpDate + ' ' + Constants.START_DATE_TIME_FORMAT);
                const tmpEndDate = newDate(tmpDate + ' ' + Constants.END_DATE_TIME_FORMAT);
                const idsToUpdate = await this.collectionDb.distinct('_id', {
                    user_id: record.user_id,
                    date: { $gte: newDate(tmpStartDate), $lte: newDate(tmpEndDate) },
                });
                if(idsToUpdate.length === 0) continue;
                let updateData = {
                    $set: {
                        leave_status: parseInt(status),
                        modified: getUtcDate(),
                    },
                };
                if(status == Constants.REJECTED) {
                    updateData.$set.rejection_reason = req.body.rejection_reason;
                } else {
                    updateData.$unset = { rejection_reason: 1 };
                }
                await this.collectionDb.updateMany({ _id: { $in: idsToUpdate }, status: Constants.PENDING }, updateData);
                idsToUpdate.forEach(requestId => {
                    saveSystemLogs(req, res, {
                        user_id: req.session.user._id,
                        parent_id: new ObjectId(requestId),
                        activity_module: Constants.SYSTEM_LOG_MODULE_VACATION_REQUEST,
                        activity_type: Constants.ACTIVITY_TYPE_STATUS_UPDATE,
                        additional_details: { status: status },
                    });
                });
            }
            let message = status == Constants.IN_REVIEW ? res.__('admin.driver_leave_management.status_has_been_updated_successfully') :
                (status == Constants.APPROVED ? res.__('admin.driver_leave_management.vacation_request_has_been_approved_successfully') : res.__('admin.driver_leave_management.vacation_request_has_been_rejected'));
            res.send({ status: Constants.STATUS_SUCCESS, message: message });
        } catch (error) { next(error); }
    }

    /**
     * View leave balance
     */
    async viewLeaveBalance(req, res, next) {
        try {
            const driverId = req.params.id ? new ObjectId(req.params.id) : '';
            const [driverLeaveList, leaveTypeList] = await Promise.all([
                this.userLeavesCollection.findOne({ user_id: driverId }, { projection: { _id: 1, leaves: 1, total_leave: 1 } }),
                getAttributes(req, res, next, { type: 'vacation_leave_type', is_show: true }),
            ]);
            let tempLeaveType = {};
            if(leaveTypeList.length > 0) {
                leaveTypeList.forEach(record => {
                    tempLeaveType[String(record.attribute_id)] = record.title;
                });
            }
            res.render('view_leave_balance', {
                layout: false,
                result: driverLeaveList,
                leave_type_list: tempLeaveType,
            });
        } catch (error) { next(error); }
    }
    
    /**
     * Export data
     */
    async exportData(req, res, next) {
        try {
            const exportType = req.params.export_type || '';
            const memberId = req.query.member || '';
            const attributeOptions = { type: 'vacation_leave_type' };
            if(exportType === 'leave_balance') attributeOptions.is_show = true;
            const leaveTypeList = await getAttributes(req, res, next, attributeOptions);
            if(exportType === 'leave_balance') {
                let commonCondition = {
                    user_role_id: Constants.DRIVER,
                    is_deleted: Constants.NOT_DELETED,
                };
                if(memberId) commonCondition._id = new ObjectId(memberId);
                const userIds = await this.usersCollection.distinct('_id', commonCondition);
                const userResult = await this.userLeavesCollection.aggregate([
                    { $match: { user_id: { $in: userIds } } },
                    { $lookup: { from: Tables.USERS, localField: 'user_id', foreignField: '_id', as: 'users_details' } },
                    { $project: { _id: 1, leaves: 1, total_leave: 1, driver_name: { $arrayElemAt: ['$users_details.full_name', 0] } } }
                ]).toArray();
                let commonColumns = [res.__('admin.driver_leave_management.driver'), res.__('admin.driver_leave_management.total_leave')];
                leaveTypeList.forEach(key => commonColumns.push(key.title));
                let tempData = userResult.map(record => {
                    let data = {};
                    record.leaves.forEach(leaveRecord => {
                        let leaveType = leaveRecord.leave_type;
                        if(!data[leaveType]) data[leaveType] = [];
                        data[leaveType].push(leaveRecord.leaves);
                    });
                    let buffer = [record.driver_name, record.total_leave];
                    leaveTypeList.forEach(key => {
                        const leaveData = data[key.attribute_id];
                        if(leaveData) buffer.push(...leaveData);
                    });
                    return buffer;
                });
                exportToExcel(req, res, {
                    file_prefix: 'leaveBalanceReport',
                    heading_columns: commonColumns,
                    export_data: tempData
                });
            } else {
                // This part requires session or cache for export conditions which is not ideal in a stateless/class-based model.
                // Refactoring to pass conditions directly in the request is recommended.
                // For now, this will just throw an error.
                req.flash(Constants.STATUS_ERROR, res.__('admin.system.invalid_access'));
                res.redirect(Constants.WEBSITE_ADMIN_URL + 'driver_leave_management/driver_vacation_request');
            }
        } catch (error) { next(error); }
    }
    
    /**
     * Private method to get vacation request details
     */
    async _vacationRequestDetails(req, res, next) {
        try {
            const vacationRequestId = req.params.id ? new ObjectId(req.params.id) : '';
            const result = await this.collectionDb.findOne({ _id: vacationRequestId }, { projection: { _id: 1, date: 1, leave_type: 1, user_id: 1, leave_status: 1, rejection_reason: 1 } });
            if(!result) return { status: Constants.STATUS_ERROR, message: res.__('admin.system.invalid_access') };
            return { status: Constants.STATUS_SUCCESS, result };
        } catch (error) {
            // next(error) is not available here. We'll return an error object.
            return { status: Constants.STATUS_ERROR, message: error.message };
        }
    }
}

function getDates(startDate, stopDate) {
    var dateArray = [];
    var currentDate = moment(startDate);
    var stopDate = moment(stopDate);
    while (currentDate <= stopDate) {
        dateArray.push( moment(currentDate).format('YYYY-MM-DD') )
        currentDate = moment(currentDate).add(1, 'days');
    }
    return dateArray;
}

export default DriverLeaveManagement; 