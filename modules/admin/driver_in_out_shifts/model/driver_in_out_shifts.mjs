import { ObjectId } from 'mongodb';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, configDatatable,newDate, arrayToObject, getDriverIdsBasedOnFleetRole } from '../../../../utils/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { saveSystemLogs} from "../../../../services/index.mjs";

class DriverInOutShifts {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.DRIVER_IN_OUT_SHIFTS);
    }

    /**
     * Get driver in/out shift list (with datatable support)
     */
    async getInOutShiftList(req, res, next) {
        try {
            if(isPost(req)){
                let isTeamHead = req.session.user.team_head || false;
                let authUserRoleId = req.session.user?.user_role_id || '';
                let limit = req.body.length ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = req.body.start ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                let fromDate = req.body.fromDate || '';
                let toDate = req.body.toDate || '';
                
                /** Configure Datatable conditions*/
                let commonConditions = {};
                const dataTableConfig = await configDatatable(req, res, null);
                                   
                if(fromDate && toDate) {
                    commonConditions['created'] = { 
                        $gte: newDate(newDate(fromDate, Constants.CURRENTDATE_START_DATE_FORMAT)), 
                        $lte: newDate(newDate(toDate, Constants.CURRENTDATE_END_DATE_FORMAT))
                    };
                }
                
                if(authUserRoleId == Constants.FLEET && !isTeamHead){
                    let driverIds = await getDriverIdsBasedOnFleetRole(req, res, next);
                    commonConditions.driver_id = { $in: driverIds && arrayToObject(driverIds) || [] };
                }

                // Get list or count of driver in/out shift
                let dbRes = await this.collectionDb.aggregate([
                    {$match: commonConditions },
                    {$lookup: {
                        from: Tables.USERS,
                        localField: 'driver_id',
                        foreignField: '_id',
                        as: 'user_details',
                    }},
                    {$addFields: {
                        driver_name : {$arrayElemAt: ['$user_details.full_name', 0] }, 
                        captain_id  : {$arrayElemAt: ['$user_details.driver_id', 0] }, 
                        longitude   : {$arrayElemAt: ['$user_details.longitude', 0] }, 
                        latitude    : {$arrayElemAt: ['$user_details.latitude', 0] }, 
                        location_address: { $arrayElemAt: ['$user_details.location_address', 0] },
                    }},
                    {$facet : {
                        list : [
                            {$match: dataTableConfig.conditions },
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit },
                            {$project: {
                                _id:1, driver_id:1, start_km:1, km:1, type:1, in_latitude:1, in_longitude:1, out_latitude:1, out_longitude:1, created:1, modified:1, out_km:1, driver_name:1, captain_id: 1, longitude:1, latitude: 1, location_address: 1,
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
                req.breadcrumbs(BREADCRUMBS['admin/driver_in_out_shifts/list']);
                res.render('list');
            }
        } catch (error) { next(error); }
    }

    /**
     * Update shift kilometer
     */
    async updateShiftKilometer(req, res, next) {
        try {
            let shiftId     =   req.body.shift_id ? new ObjectId(req.body.shift_id) : '';
            let driverId    =   req.body.driver_id ? new ObjectId(req.body.driver_id) : '';
            let shiftType   =   req.body.shift_type || '';
            let authUserId  =   req.session.user._id ? new ObjectId(req.session.user._id) : '';
            let kilometer   =   req.body.kilometer ? parseFloat(req.body.kilometer) : 0;
            const users     =   this.db.collection(Tables.USERS);
            const driver_in_out_shifts = this.collectionDb;
            
            if(!shiftId) return res.send({ status: Constants.STATUS_ERROR, message: res.__('system.invalid_access') });
            
            req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
            
            let driverConditions = { ...{ _id: driverId }, ...Constants.DRIVER_COMMON_CONDITIONS };
            let driverDetails = await users.findOne(driverConditions, { projection: { force_active:1, vehicle_type:1, vehicle_id:1, is_suspend:1 } });

            let shiftDetails = await driver_in_out_shifts.findOne({ _id: shiftId }, { projection: { start_km: 1, km:1, type:1 } });

            /** Send error response when details not found */
            if(!shiftDetails || !driverDetails) return res.send({ status: Constants.STATUS_ERROR, message: res.__('admin.system.invalid_access') });

            let tmpType     =   shiftDetails.type || '';
            let tmpStartKm  =   shiftDetails.start_km ? parseFloat(shiftDetails.start_km) : 0;
            let tmpOutKm    =   shiftDetails.km ? parseFloat(shiftDetails.km) : 0;
            let vehicleId   =   driverDetails.vehicle_id ? new ObjectId(driverDetails.vehicle_id) : '';

            // Check current km is more than last shift out
            if(shiftType == Constants.IN_SHIFT){
                let lastShifts = await driver_in_out_shifts.findOne({
                    _id: { $lt: shiftId },
                    vehicle_id: vehicleId,
                    type: Constants.OUT_SHIFT,
                }, { projection: { km:1, vehicle_type: 1 }, sort: { _id: Constants.SORT_DESC } });

                if(lastShifts && lastShifts.km && lastShifts.km > kilometer){
                    return res.send({ status: Constants.STATUS_ERROR, message: [{ 'param': 'kilometer', 'msg': res.__('admin.driver_in_out_shifts.entered_kilometer_greater_then_last_kilometer') }] });
                } else if(tmpType == Constants.OUT_SHIFT && tmpOutKm <= kilometer){
                    return res.send({ status: Constants.STATUS_ERROR, message: [{ 'param': 'kilometer', 'msg': res.__('admin.driver_in_out_shifts.entered_kilometer_greater_then_out_kilometer') }] });
                }
            }

            // Check current km is shift in
            if(shiftType == Constants.OUT_SHIFT){
                let nextShift =  driver_in_out_shifts.findOne({
                    _id: { $gt: shiftId },
                    vehicle_id: vehicleId,
                }, { projection: { start_km:1 }, sort: { _id: Constants.SORT_ASC } });

                if(kilometer <= tmpStartKm){
                    return res.send({ status: Constants.STATUS_ERROR, message: [{ 'param': 'kilometer', 'msg': res.__('admin.driver_in_out_shifts.entered_greater_then_last_kilometer') }] });
                } else if(nextShift && nextShift.start_km && nextShift.start_km < kilometer){
                    return res.send({ status: Constants.STATUS_ERROR, message: [{ 'param': 'kilometer', 'msg': res.__('admin.driver_in_out_shifts.entered_less_then_next_kilometer') }] });
                }
            }

            
            // Set update data
            let saveUpdateData = { km_updated_by: authUserId };
            if(tmpType != Constants.OUT_SHIFT || shiftType == Constants.OUT_SHIFT) saveUpdateData.km = kilometer;
            if(shiftType == Constants.OUT_SHIFT){
                saveUpdateData.total_km = kilometer - tmpStartKm;
                saveUpdateData.out_km = kilometer;
            } else {
                saveUpdateData.start_km = kilometer;
                if(tmpType == Constants.OUT_SHIFT){
                    let tmpKm = tmpOutKm - kilometer;
                    saveUpdateData.total_km = tmpKm;
                }
            }

            await driver_in_out_shifts.updateOne({ _id: shiftId }, { $set: saveUpdateData });
            
            req.flash(Constants.STATUS_SUCCESS, res.__('admin.driver_in_out_shifts.km_has_been_updated'));
            res.send({ status: Constants.STATUS_SUCCESS });
            
            saveSystemLogs(req, res, {
                user_id: authUserId,
                parent_id: shiftId,
                activity_module: Constants.SYSTEM_LOG_MODULE_CAPTAIN_IN_OUT_SHIFTS,
                activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                additional_details: { km: kilometer, type: shiftType, last_db_km: tmpOutKm }
            });                      
        } catch (error) { next(error); }
    }
}

export default DriverInOutShifts; 