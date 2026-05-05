import { ObjectId } from 'mongodb';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, newDate, arrayToObject, getDriverIdsBasedOnFleetRole } from '../../../../utils/index.mjs';
import { saveSystemLogs, saveDriverStatusLogs, sendMailToUsers} from "../../../../services/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';


class DriverExcuses {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.DRIVER_EXCUSES);
    }

    /**
     * Get driver excuses list (with datatable support)
     */
    async getExcusesList(req, res, next) {
        try {
            if(isPost(req)){
                let isTeamHead = req.session.user.team_head || false;
                let authUserRoleId = req.session.user?.user_role_id || '';
                
                let limit = req.body.length ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = req.body.start ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                let fromDate= req.body.fromDate || '';
                let toDate  = req.body.toDate || '';
               
                let commonConditions = {};
                const dataTableConfig = await configDatatable(req, res, null);
                if(fromDate && toDate) {
                    commonConditions['date'] = { $gte: newDate(fromDate), $lte: newDate(toDate) };
                }
                
                if(authUserRoleId == Constants.FLEET && !isTeamHead) {
                    driverIds = await getDriverIdsBasedOnFleetRole(req, res, next);
                    commonConditions.driver_id = { $in: arrayToObject(driverIds) };
                }

                // Get list or count of excuses
                let dbRes = await this.collectionDb.aggregate([
                    {$match: commonConditions },
                    {$lookup: {
                        from: Tables.USERS,
                        localField: 'driver_id',
                        foreignField: '_id',
                        as: 'user_details',
                    }},
                    {$addFields: {
                        driver_name : { $arrayElemAt: ['$user_details.full_name', 0] },
                        captain_id  : { $arrayElemAt: ['$user_details.driver_id', 0] }
                    }},
                    {$facet : {
                        list : [
                            {$match: dataTableConfig.conditions },
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit },
                            { $project: {
                                _id:1, date:1, driver_id:1, from:1, to:1, rejection_reason:1, cancel_reason:1, is_completed:1, status:1, reason:1,  captain_id: 1, created:1,driver_name: 1
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
                req.breadcrumbs(BREADCRUMBS['admin/driver_excuses/list']);
                res.render('list');
            }
        } catch (error) { next(error); }
    }

    /**
     * Approve a driver excuse
     */
    async approveExcuse(req, res, next) {
        try {
            let excuseId = req.params.id ? new ObjectId(req.params.id) : '';
            let driverId = req.params.driver_id ? new ObjectId(req.params.driver_id) : '';
            const driver_excuses = this.collectionDb;
            const findExcuseResult = await driver_excuses.findOne({
                _id: excuseId,
                status: Constants.PENDING,
                driver_id: driverId,
            }, { projection: { status: 1, is_completed: 1, modified: 1, date: 1, from: 1, to: 1 } });
            if(!findExcuseResult){
                req.flash(Constants.STATUS_ERROR, res.__('admin.system.invalid_access'));
                return res.redirect(Constants.WEBSITE_ADMIN_URL + 'driver_excuses');
            }
            findExcuseResult.start_time = findExcuseResult.from;
            findExcuseResult.end_time = findExcuseResult.to;
            await driver_excuses.updateOne({
                _id: excuseId,
                status: Constants.PENDING,
                driver_id: driverId,
            }, { $set: { status: Constants.APPROVED, modified: getUtcDate() } });
            saveSystemLogs(req, res, {
                user_id: req.session.user?._id || '',
                parent_id: excuseId,
                activity_module: Constants.SYSTEM_LOG_MODULE_DRIVER_EXCUSES,
                activity_type: Constants.ACTIVITY_TYPE_APPROVE,
                additional_details: { status: Constants.PENDING }
            });
            req.flash(Constants.STATUS_SUCCESS, res.__('admin.driver_excuses.driver_excuses_has_been_approved_successfully'));
            res.redirect(Constants.WEBSITE_ADMIN_URL + 'driver_excuses');
            sendMailToUsers(req, res, {
                event_type: Constants.DRIVER_EXCUSE_APPROVE_REJECT_EMAIL_EVENTS,
                excuse_id: excuseId,
                action_taken: 'driver_excuse_approved',
                user_id: driverId,
                excuse_details: findExcuseResult
            });
        } catch (error) { next(error); }
    }

    /**
     * Reject a driver excuse
     */
    async rejectExcuse(req, res, next) {
        try {
            let action = req.params.action || '';
            let excuseId = req.params.id ? new ObjectId(req.params.id) : '';
            let driverId = req.params.driver_id ? new ObjectId(req.params.driver_id) : '';
            req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
            let rejectionReason = req.body.rejection_reason || '';
            let dataToBeSave = {
                status: Constants.REJECTED,
                rejection_reason: rejectionReason,
                is_completed: true,
                modified: getUtcDate(),
            };
            const driver_excuses = this.collectionDb;
            const result = await driver_excuses.findOneAndUpdate({ _id: excuseId, driver_id: driverId, status: Constants.PENDING }, { $set: dataToBeSave }, { projection: { from: 1, to: 1, date: 1 }, returnDocument: 'after' });
            let resultData = result || {};
            let date = resultData?.date || '';
            let startTime = resultData?.from || '';
            let endTime = resultData?.to || '';
            let dataToBeSend = {
                date,
                start_time: startTime,
                end_time: endTime,
                rejection_reason: rejectionReason,
            };
            saveSystemLogs(req, res, {
                user_id: req.session.user?._id || '',
                parent_id: excuseId,
                activity_module: Constants.SYSTEM_LOG_MODULE_DRIVER_EXCUSES,
                activity_type: Constants.ACTIVITY_TYPE_REJECT,
                additional_details: { status: Constants.REJECTED }
            });
            req.flash(Constants.STATUS_SUCCESS, res.__('admin.driver_excuses.driver_excuses_has_been_rejected_successfully'));
            res.send({
                status: Constants.STATUS_SUCCESS,
                redirect_url: Constants.WEBSITE_ADMIN_URL + 'driver_excuses'
            });
            saveDriverStatusLogs(req, res, next, {
                parent_id: excuseId,
                driver_id: driverId,
                type: 'driver_excuses',
                event_type: Constants.IN_EXCUSE,
                start_time: startTime,
            });
            sendMailToUsers(req, res, {
                event_type: Constants.DRIVER_EXCUSE_APPROVE_REJECT_EMAIL_EVENTS,
                excuse_id: excuseId,
                action_taken: action,
                user_id: driverId,
                excuse_details: dataToBeSend
            });
        } catch (error) { next(error); }
    }

    /**
     * Delete a driver excuse
     */
    async deleteExcuse(req, res, next) {
        try {
            let excuseId = req.params.id ? new ObjectId(req.params.id) : '';
            let driverId = req.params.driver_id ? new ObjectId(req.params.driver_id) : '';
            
            await this.collectionDb.deleteOne({ _id: excuseId, driver_id: driverId, status: Constants.PENDING });
            saveSystemLogs(req, res, {
                user_id: req.session.user?._id || '',
                parent_id: excuseId,
                activity_module: Constants.SYSTEM_LOG_MODULE_DRIVER_EXCUSES,
                activity_type: Constants.ACTIVITY_TYPE_DELETE,
                additional_details: {}
            });
            req.flash(Constants.STATUS_SUCCESS, res.__('admin.driver_excuses.driver_excuses_has_been_deleted_successfully'));
            res.redirect(Constants.WEBSITE_ADMIN_URL + 'driver_excuses');
        } catch (error) { next(error); }
    }

    /**
     * Cancel a driver excuse
     */
    async cancelExcuse(req, res, next) {
        try {
            let excuseId = req.params.id ? new ObjectId(req.params.id) : '';
            let driverId = req.params.driver_id ? new ObjectId(req.params.driver_id) : '';
            req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
            let cancelReason = req.body.cancel_reason || '';
            const driver_excuses = this.collectionDb;
            const findResult = await driver_excuses.findOne({
                _id: excuseId,
                driver_id: driverId,
                status: Constants.APPROVED,
                is_completed: false,
            }, { projection: { _id: 1, date: 1, from: 1, to: 1 } });
            if(!findResult) return res.send({ status: Constants.STATUS_ERROR, message: res.__('admin.system.invalid_access') });
            await driver_excuses.updateOne({
                _id: excuseId,
                driver_id: driverId,
            }, {
                $set: {
                    status: Constants.CANCELLED,
                    is_completed: true,
                    cancel_reason: cancelReason,
                    modified: getUtcDate()
                }
            });
            req.flash(Constants.STATUS_SUCCESS, res.__('admin.driver_excuses.driver_excuse_has_been_cancelled_successfully'));
            res.send({
                status: Constants.STATUS_SUCCESS,
                redirect_url: Constants.WEBSITE_ADMIN_URL + 'driver_excuses'
            });
            saveSystemLogs(req, res, {
                user_id: req.session.user._id,
                parent_id: excuseId,
                activity_module: Constants.SYSTEM_LOG_MODULE_DRIVER_EXCUSES,
                activity_type: Constants.ACTIVITY_TYPE_CANCELLED,
                additional_details: { status: Constants.CANCELLED }
            });
            saveDriverStatusLogs(req, res, next, {
                parent_id: excuseId,
                driver_id: driverId,
                type: 'driver_excuses',
                event_type: Constants.CANCELLED,
                start_time: findResult.from
            });
            sendMailToUsers(req, res, {
                event_type: Constants.DRIVER_EXCUSE_CANCEL_EMAIL_EVENTS,
                excuse_id: excuseId,
                user_id: driverId,
                excuse_details: {
                    date: findResult.date,
                    start_time: findResult.from,
                    end_time: findResult.to,
                    cancel_reason: cancelReason
                }
            });
        } catch (error) { next(error); }
    }
}
export default DriverExcuses; 
