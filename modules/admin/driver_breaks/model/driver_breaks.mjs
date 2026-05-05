import { ObjectId } from 'mongodb';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, newDate, arrayToObject, getDropdownList, addOrSubtractDurationToDate, getDriverIdsBasedOnFleetRole } from '../../../../utils/index.mjs';
import { saveSystemLogs, saveDriverStatusLogs, sendMailToUsers} from "../../../../services/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { eachSeries as asyncEachSeries, parallel as asyncParallel } from 'async';
import clone from 'clone';

class DriverBreaks {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.DRIVER_BREAKS);
    }

    /**
     * Get driver breaks list (with datatable support)
     */
    async getBreaksList(req, res, next) {
        try {
            let tmpBreakStatus = req.params.break_status || '';
            if(isPost(req)){
                let isTeamHead = req.session.user.team_head || false;
                let authUserRoleId = req.session.user?.user_role_id || '';
                let limit       = req.body.length ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip        = req.body.start ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                let fromDate    = req.body.fromDate || '';
                let toDate      = req.body.toDate || '';
                let breakStatus = req.body.break_status || '';

                /** Configure Datatable conditions*/
                let commonConditions = {};
                const dataTableConfig = await configDatatable(req, res, null);

                if(fromDate && toDate){
                    commonConditions['date'] = {
                        $gte: newDate(newDate(fromDate, Constants.CURRENTDATE_START_DATE_FORMAT)),
                        $lte: newDate(newDate(toDate, Constants.CURRENTDATE_END_DATE_FORMAT))
                    };
                }
                if(breakStatus) commonConditions['status'] = parseInt(breakStatus);
                if(tmpBreakStatus == Constants.APPROVED && breakStatus == Constants.APPROVED) commonConditions['is_completed'] = {$ne: true };

                if(authUserRoleId == Constants.FLEET && !isTeamHead){
                    let driverIds = await getDriverIdsBasedOnFleetRole(req, res, next);
                    commonConditions.driver_id = { $in: driverIds && arrayToObject(driverIds) || [] };
                }

                // Get list or count of breaks
                let dbRes = await this.collectionDb.aggregate([
                    {$match: commonConditions },
                    {$lookup: {
                        from: Tables.USERS,
                        localField: 'driver_id',
                        foreignField: '_id',
                        as: 'user_details',
                    }},
                    {$addFields: {
                        driver_name: { $arrayElemAt: ['$user_details.full_name', 0] }
                    }},
                    {$facet : {
                        list : [
                            {$match: dataTableConfig.conditions },
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit },
                            { $project: {
                                _id:1, date:1, driver_id:1, start_time:1, end_time:1, duration:1, elapsed_time:1, is_completed:1, end_timestamp:1, start_timestamp:1, duration_in_minutes:1, rejection_reason:1, status:1, driver_name: 1, created:1, cancel_reason:1,
                            }},
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
                req.breadcrumbs(BREADCRUMBS['admin/driver_breaks/list']);
                res.render('list', { break_status: tmpBreakStatus });
            }
        } catch (error) { next(error); }
    }

    /**
     * Approve a driver break
     */
    async approveBreak(req, res, next) {
        try {
            let action = req.params.action || '';
            let breakId = req.params.id ? new ObjectId(req.params.id) : '';
            let driverId = req.params.driver_id ? new ObjectId(req.params.driver_id) : '';
            req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
            let duration = req.body.duration || '';

            let durationInSeconds = Math.ceil(duration * Constants.SECONDS_IN_A_MINUTE);
            let startDate = newDate();
            let endDate = newDate(addOrSubtractDurationToDate({duration, type: "min"}));
            let startTimeStamp = startDate.getTime();
            let endTimeStamp = endDate.getTime();
            let currentHours = startDate.getHours();
            let currentMinutes = startDate.getMinutes();
            let endTimeHours = endDate.getHours();
            let endTimeMinutes = endDate.getMinutes();
            if(endTimeMinutes < 10) endTimeMinutes = '0' + endTimeMinutes;
            if(currentMinutes < 10) currentMinutes = '0' + currentMinutes;
            let startTime = parseFloat(currentHours + '.' + currentMinutes);
            let endTime = parseFloat(endTimeHours + '.' + endTimeMinutes);
            let dataToBeSave = {
                start_time: startTime,
                end_time: endTime,
                start_timestamp: startTimeStamp,
                end_timestamp: endTimeStamp,
                duration: durationInSeconds,
                status: Constants.APPROVED,
                modified: getUtcDate(),
                duration_in_minutes: parseInt(duration)
            };
            const driver_breaks = this.collectionDb;
            let result = await driver_breaks.findOneAndUpdate({
                _id: breakId,
                driver_id: driverId
            }, {
                $set: dataToBeSave
            }, { projection: { _id: 1, date: 1 }, returnDocument: 'after' });
            let updatedData = result || {};
            let breakDate = updatedData?.date || '';
            dataToBeSave['date'] = breakDate;
            saveSystemLogs(req, res, {
                user_id: req.session.user._id,
                parent_id: breakId,
                activity_module: Constants.SYSTEM_LOG_MODULE_DRIVER_BREAKS,
                activity_type: Constants.ACTIVITY_TYPE_APPROVE,
                additional_details: { status: Constants.APPROVED }
            });
            req.flash(Constants.STATUS_SUCCESS, res.__('admin.driver_breaks.driver_break_has_been_approved_successfully'));
            res.send({
                status: Constants.STATUS_SUCCESS,
                redirect_url: Constants.WEBSITE_ADMIN_URL + 'driver_breaks'
            });
            saveDriverStatusLogs(req, res, next, {
                parent_id: breakId,
                driver_id: driverId,
                type: 'driver_breaks',
                event_type: Constants.IN_BREAK,
                start_time: startTime,
                duration: durationInSeconds
            });
            sendMailToUsers(req, res, {
                event_type: Constants.DRIVER_BREAK_APPROVE_REJECT_EMAIL_EVENTS,
                break_id: breakId,
                action_taken: action,
                user_id: driverId,
                break_details: dataToBeSave
            });
        } catch (error) { next(error); }
    }

    /**
     * Reject a driver break
     */
    async rejectBreak(req, res, next) {
        try {
            let action = req.params.action || '';
            let breakId = req.params.id ? new ObjectId(req.params.id) : '';
            let driverId = req.params.driver_id ? new ObjectId(req.params.driver_id) : '';
            req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
            let rejectionReason = req.body.rejection_reason || '';
            let dataToBeSave = {
                status: Constants.REJECTED,
                is_completed: true,
                rejection_reason: rejectionReason,
                modified: getUtcDate(),
            };
            const driver_breaks = this.collectionDb;
            let result = await driver_breaks.findOneAndUpdate({
                _id: breakId,
                driver_id: driverId
            }, {
                $set: dataToBeSave
            }, { projection: { _id: 1, date: 1, start_time: 1, end_time: 1 }, returnDocument: 'after' });
            let updatedData = result.value;
            let breakDate = updatedData?.date || '';
            let startTime = updatedData?.start_time || '';
            let endTime = updatedData?.end_time || '';
            let dataToSendEmail = {
                date: breakDate,
                rejection_reason: rejectionReason
            };
            saveSystemLogs(req, res, {
                user_id: req.session.user?._id || '',
                parent_id: breakId,
                activity_module: Constants.SYSTEM_LOG_MODULE_DRIVER_BREAKS,
                activity_type: Constants.ACTIVITY_TYPE_REJECT,
                additional_details: { status: Constants.REJECTED }
            });
            req.flash(Constants.STATUS_SUCCESS, res.__('admin.driver_breaks.driver_break_has_been_rejected_successfully'));
            res.send({
                status: Constants.STATUS_SUCCESS,
                redirect_url: Constants.WEBSITE_ADMIN_URL + 'driver_breaks'
            });
            sendMailToUsers(req, res, {
                event_type: Constants.DRIVER_BREAK_APPROVE_REJECT_EMAIL_EVENTS,
                break_id: breakId,
                action_taken: action,
                user_id: driverId,
                break_details: dataToSendEmail
            });
        } catch (error) { next(error); }
    }

    /**
     * Delete a driver break
     */
    async deleteBreak(req, res, next) {
        try {
            let breakId = req.params.id ? new ObjectId(req.params.id) : '';
            let driverId = req.params.driver_id ? new ObjectId(req.params.driver_id) : '';
            const driver_breaks = this.collectionDb;
            await driver_breaks.deleteOne({ _id: breakId, driver_id: driverId });
            saveSystemLogs(req, res, {
                user_id: req.session.user?._id || '',
                parent_id: breakId,
                activity_module: Constants.SYSTEM_LOG_MODULE_DRIVER_BREAKS,
                activity_type: Constants.ACTIVITY_TYPE_DELETE,
                additional_details: {}
            });
            req.flash(Constants.STATUS_SUCCESS, res.__('admin.driver_breaks.break_has_been_deleted_successfully'));
            res.redirect(Constants.WEBSITE_ADMIN_URL + 'driver_breaks');
        } catch (error) { next(error); }
    }

    /**
     * Add a driver break
     */
    async addBreak(req, res, next) {
        try {
            let isTeamHead = req.session.user.team_head || false;
            let authUserRoleId = req.session.user.user_role_id || '';
            let authId = req.session.user._id || '';
            if(isPost(req)){
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let userArray = req.body.user_id || [];
                let currentDate = newDate(newDate('', Constants.CURRENTDATE_START_DATE_FORMAT));
                let duration = req.body.duration || '';
                if(userArray.constructor != Array) userArray = [userArray];

                /** Check alreadt have break */
                let findResult = await this.collectionDb.findOne({
                    driver_id: { $in: arrayToObject(userArray) },
                    date: { $gte: currentDate },
                    is_completed: false
                }, { projection: { _id: 1, status: 1, start_time: 1 } });

                if(findResult) return res.send({ status: Constants.STATUS_ERROR, message: res.__('driver_breaks.break_is_already_in_running') });

                let durationInSeconds=  Math.ceil(duration * Constants.SECONDS_IN_A_MINUTE);
                let startDate       =   newDate();
                let endDate         =   newDate(addOrSubtractDurationToDate({duration, type: "min"}));
                let startTimeStamp  =   startDate.getTime();
                let endTimeStamp    =   endDate.getTime();
                let currentHours    =   startDate.getHours();
                let currentMinutes  =   startDate.getMinutes();
                let endTimeHours    =   endDate.getHours();
                let endTimeMinutes  =   endDate.getMinutes();
                if(endTimeMinutes < 10) endTimeMinutes = '0' + endTimeMinutes;
                if(currentMinutes < 10) currentMinutes = '0' + currentMinutes;
                let startTime = parseFloat(currentHours + '.' + currentMinutes);
                let endTime = parseFloat(endTimeHours + '.' + endTimeMinutes);

                let insertDataArray = [];
                userArray.map(records => {
                    insertDataArray.push({
                        break_type: new ObjectId(Constants.BREAK),
                        date: getUtcDate(currentDate),
                        duration_in_minutes: parseInt(duration),
                        duration: durationInSeconds,
                        start_time: startTime,
                        end_time: endTime,
                        start_timestamp: startTimeStamp,
                        end_timestamp: endTimeStamp,
                        status: Constants.APPROVED,
                        driver_id: new ObjectId(records),
                        is_completed: false,
                        created: getUtcDate()
                    });
                });
                let resultData = [];
                await asyncEachSeries(insertDataArray, async (records) => {
                    const insertResult = await this.collectionDb.insertOne(records);
                    if (insertResult.insertedId) {
                        resultData.push({
                            _id: insertResult.insertedId,
                            driver_id: records.driver_id
                        });
                    }
                });
                req.flash(Constants.STATUS_SUCCESS, res.__('driver_break.break_has_been_added_successfully'));
                res.send({ status: Constants.STATUS_SUCCESS, message: res.__('driver_break.break_has_been_added_successfully') });
                if(resultData.length > 0){
                    resultData.map(records => {
                        saveSystemLogs(req, res, {
                            user_id: req.session.user._id,
                            parent_id: records._id,
                            activity_module: Constants.SYSTEM_LOG_MODULE_DRIVER_BREAKS,
                            activity_type: Constants.ACTIVITY_TYPE_APPROVE,
                            additional_details: { status: Constants.APPROVED }
                        });
                        saveDriverStatusLogs(req, res, next, {
                            parent_id: records._id,
                            driver_id: records.driver_id,
                            type: 'driver_breaks',
                            event_type: Constants.IN_BREAK,
                            start_time: startTime,
                            duration: durationInSeconds
                        });
                        sendMailToUsers(req, res, {
                            event_type: Constants.DRIVER_BREAK_ADD_EMAIL_EVENTS,
                            break_id: records._id,
                            user_id: records.driver_id,
                            break_details: { date: getUtcDate(currentDate) }
                        });
                    });
                }
            } else {
                asyncParallel({
                    driver_ids: (callback) => {
                        if(authUserRoleId != Constants.FLEET || isTeamHead) return callback(null, null);
                        let startDate = newDate(newDate('', Constants.CURRENTDATE_START_DATE_FORMAT));
                        let endDate = newDate(newDate('', Constants.CURRENTDATE_END_DATE_FORMAT));
                        const fleet_areas = this.db.collection(Tables.FLEET_AREAS);
                        fleet_areas.distinct('area_ids', {
                            user_id: ObjectId(authId),
                            date: { $gte: startDate, $lte: endDate },
                        }, (areaErr, areaIds) => {
                            if(areaErr || areaIds.length == 0) return callback(areaErr, areaIds);
                            const driver_availabilities = this.db.collection(Tables.DRIVER_AVAILABILITIES);
                            driver_availabilities.distinct('user_id', {
                                date: { $gte: startDate, $lte: endDate },
                                area_id: { $in: arrayToObject(areaIds) }
                            }, (driverErr, driverIds) => {
                                callback(driverErr, driverIds);
                            });
                        });
                    },
                }, async (asyncErr, asyncResponse) => {
                    if(asyncErr) return next(asyncErr);
                    let driverConditions = clone(Constants.DRIVER_COMMON_CONDITIONS);
                    if(authUserRoleId == Constants.FLEET && !isTeamHead){
                        let driverIds = asyncResponse.driver_ids || [];
                        driverConditions = { ...{ _id: { $in: arrayToObject(driverIds) } }, ...driverConditions };
                    }
                    let dropDownResponse = await getDropdownList(req, res, next, {
                        collections: [
                            {
                                collection: Tables.USERS,
                                columns: ['_id', 'full_name'],
                                conditions: driverConditions,
                            },
                        ],
                    });
                    if(dropDownResponse.status != Constants.STATUS_SUCCESS){
                        req.flash(Constants.STATUS_ERROR, dropDownResponse.message);
                        return res.redirect(Constants.WEBSITE_ADMIN_URL + 'driver_breaks');
                    }
                    res.render('add_edit', {
                        layout: false,
                        captain_list: dropDownResponse.final_html_data['0'],
                    });
                });
            }
        } catch (error) { next(error); }
    }

    /**
     * Cancel a driver break
     */
    async cancelBreak(req, res, next) {
        try {
            let breakId = req.params.id ? new ObjectId(req.params.id) : '';
            let driverId = req.params.driver_id ? new ObjectId(req.params.driver_id) : '';
            let currentDate = newDate(newDate('', Constants.CURRENTDATE_START_DATE_FORMAT));
            req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
            let cancelReason = req.body.cancel_reason || '';
            const driver_breaks = this.collectionDb;
            let findResult = await driver_breaks.findOne({
                _id: breakId,
                driver_id: driverId,
                status: Constants.APPROVED,
            }, { projection: { _id: 1, date: 1, is_completed: 1 } });

            if(!findResult) return res.send({ status: Constants.STATUS_ERROR, message: res.__('admin.system.invalid_access') });

            /** Send  error response*/
			if(findResult.is_completed){
				return res.send({status: Constants.STATUS_ERROR, message: res.__("admin.driver_breaks.its_seem_break_end_or_cancel")});
			}

            await driver_breaks.updateOne({
                _id: breakId,
                driver_id: driverId,
            }, {
                $set: {
                    status: Constants.CANCELLED,
                    is_completed: true,
                    cancel_reason: cancelReason,
                    modified: getUtcDate()
                }
            });
            req.flash(Constants.STATUS_SUCCESS, res.__('admin.driver_breaks.driver_break_has_been_cancelled_successfully'));
            res.send({
                status: Constants.STATUS_SUCCESS,
                redirect_url: Constants.WEBSITE_ADMIN_URL + 'driver_breaks'
            });
            saveSystemLogs(req, res, {
                user_id: req.session.user._id,
                parent_id: breakId,
                activity_module: Constants.SYSTEM_LOG_MODULE_DRIVER_BREAKS,
                activity_type: Constants.ACTIVITY_TYPE_CANCELLED,
                additional_details: { status: Constants.CANCELLED }
            });
            saveDriverStatusLogs(req, res, next, {
                parent_id: breakId,
                driver_id: driverId,
                type: 'driver_breaks',
                event_type: Constants.CANCELLED,
                start_time: getUtcDate()
            });
            sendMailToUsers(req, res, {
                event_type: Constants.DRIVER_BREAK_CANCEL_EMAIL_EVENTS,
                break_id: breakId,
                user_id: driverId,
                break_details: {
                    date: findResult.date,
                    cancel_reason: cancelReason
                }
            });
        } catch (error) { next(error); }
    }

    /**
     * End a driver break
     */
    async endBreak(req, res, next) {
        try {
            let breakId = req.params.break_id ? new ObjectId(req.params.break_id) : '';
            const driver_breaks = this.collectionDb;
            let result = await driver_breaks.findOne({
                _id: breakId,
                status: Constants.APPROVED,
                is_completed: false
            }, { projection: { _id: 1, start_time: 1, driver_id: 1, date: 1 } });

            if(!result){
                req.flash(Constants.STATUS_ERROR, res.__('admin.system.invalid_access'));
                return res.redirect(Constants.WEBSITE_ADMIN_URL + 'driver_breaks');
            }

            let driverId    =   result.driver_id || '';
            let startTime   =   result.start_time ? String(result.start_time).replace('.', ':') : '';
            let endTime     =   newDate('', Constants.BREAK_TIME_FORMAT);
            let breakStart  =   new Date(newDate('', Constants.DATABASE_DATE_FORMAT + ' ' + startTime));
            let breakEnd    =   new Date(newDate('', Constants.DATABASE_DATE_FORMAT + ' ' + endTime));
            let difference  =   Math.ceil((breakEnd - breakStart) / Constants.MILLISECONDS_IN_A_SECOND);
            endTime = parseFloat(endTime.replace(':', '.'));
            let endTimeStamp = newDate().getTime();

            await driver_breaks.updateOne({
                _id: breakId,
            }, {
                $set: {
                    is_completed: true,
                    end_time: endTime,
                    end_timestamp: endTimeStamp,
                    elapsed_time: difference,
                    duration: difference,
                    modified: getUtcDate()
                }
            });

            req.flash(Constants.STATUS_SUCCESS, res.__('admin.driver_breaks.break_has_been_ended_successfully'));
            res.redirect(Constants.WEBSITE_ADMIN_URL + 'driver_breaks');

            saveDriverStatusLogs(req, res, next, {
                parent_id: breakId,
                driver_id: driverId,
                type: 'driver_breaks',
                event_type: Constants.END_BREAK,
                end_time: endTime,
                duration: difference
            });

            saveSystemLogs(req, res, {
                user_id: req.session.user._id,
                parent_id: breakId,
                activity_module: Constants.SYSTEM_LOG_MODULE_DRIVER_BREAKS,
                activity_type: Constants.ACTIVITY_TYPE_END_BREAK
            });

            sendMailToUsers(req, res, {
                event_type: Constants.DRIVER_BREAK_END_EMAIL_EVENTS,
                break_id: breakId,
                user_id: driverId,
                break_details: result
            });
        } catch (error) { next(error); }
    }
}
export default DriverBreaks;
