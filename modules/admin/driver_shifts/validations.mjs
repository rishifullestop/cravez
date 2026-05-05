import { body, param } from 'express-validator';
import { ObjectId } from 'mongodb';
import Tables from '../../../config/database_tables.mjs';
import { getDb } from '../../../config/connection.mjs';
import * as Constants from "../../../config/global_constant.mjs";
import {newDate, arrayToObject} from "../../../utils/index.mjs";

/**
 * Validation rules for assign shift
 */
const assignShiftValidation = [
	body('shift_name')
		.notEmpty()
		.withMessage((value, { req }) => {
			return req.__('admin.driver_shifts.please_enter_shift_name');
		})
		.custom((value, { req, res, next }) => {
			if (value) {
				return validateShiftAssignment(value, req).then(quRes => {
					if (quRes.status != Constants.STATUS_SUCCESS) {
						return Promise.reject(req.__('admin.driver_shifts.already_assign_shift_for_date'));
					} else {
						return true;
					}
				}).catch(next);
			} else {
				return true;
			}
		}),
	body('user_name')
		.notEmpty()
		.withMessage((value, { req }) => {
			return req.__('admin.driver_shifts.please_enter_user_name');
		}),
	body('city_id')
		.notEmpty()
		.withMessage((value, { req }) => {
			return req.__('admin.driver_shifts.please_select_city');
		}),
	body('area_id')
		.notEmpty()
		.withMessage((value, { req }) => {
			return req.__('admin.driver_shifts.please_select_area');
		}),
    body('shift_date')
		.custom((value, { req, res,next }) => {
			if (!req.body.from_date || !req.body.to_date) {				
                return Promise.reject(req.__('admin.driver_shifts.please_select_shift_date'));
			}else if(req.body.user_name){
                return checkDriverOnLeave(value, req).then(quRes => {
					if (quRes.status != Constants.STATUS_SUCCESS) {
						return Promise.reject(req.__('admin.driver_shifts.already_leave_for_date'));
					} else {
						return true;
					}
				}).catch(next);
            }else{
                return true;
            }
		})
];

/**
 * Validate driver on leave or not
 * @param {String} value - Shift name value
 * @param {Object} req - Request object
 * @returns {Promise<Object>} Validation result
 */
const checkDriverOnLeave = async (value, req) => {
	try {        
        let fromDate    = 	newDate(newDate(req.body.from_date,Constants.CURRENTDATE_START_DATE_FORMAT));
        let toDate      = 	newDate(newDate(req.body.to_date,Constants.CURRENTDATE_END_DATE_FORMAT));
        let userId      =  req.body.user_name;

        /** To convert in array **/
        if(userId.constructor != Array) userId = [userId];

		const dbInstance = getDb();

		// Check for existing shifts in the date range
		const driver_availabilities = dbInstance.collection(Tables.DRIVER_AVAILABILITIES);		
		const existingShifts = await driver_availabilities.countDocuments({
            user_id 	: {$in : arrayToObject(userId)},
            date 		: {$gte: fromDate,$lte: toDate},
            leave_type 	: {$exists : true},
            leave_status: Constants.APPROVED
		});

        return {status: existingShifts ? Constants.STATUS_ERROR : Constants.STATUS_SUCCESS };		
	} catch (error) {
		console.error('Error validating at checkDriverOnLeave driver-shift:', error);
		return { status: Constants.STATUS_ERROR };
	}
};

/**
 * Validate if shift assignment conflicts exist
 * @param {String} value - Shift name value
 * @param {Object} req - Request object
 * @returns {Promise<Object>} Validation result
 */
const validateShiftAssignment = async (value, req) => {
    try {
	    let shiftDataIds = req.body.shift_name || [];

        /** To convert in array **/
        if(shiftDataIds.constructor != Array) shiftDataIds = [shiftDataIds];

		const dbInstance = getDb();
		const shifts = dbInstance.collection(Tables.SHIFTS);
		
		// Check for existing shifts in the date range
		const shiftList = await shifts.aggregate([
            {$match	: {
                _id			: {$in: arrayToObject(shiftDataIds) },
                is_deleted 	: {$ne: Constants.DELETED}
            }},
            {$addFields:{
                is_next_day : {$cond: [
                    {$and: [
                        { $gt : ["$start_time","$end_time"] },
                    ]},
                    true,
                    false
                ]},
            }},
        ]).toArray();

        if(shiftList?.length > 0){
            let isConflictTime = false;
            shiftList.map((shiftTime) => {
                shiftList.map((chileShiftTime) => {
                    if(shiftTime._id != chileShiftTime._id){
                        shiftTime.end_time 		= (shiftTime.is_next_day) 		? 	Constants.HOURS_IN_A_DAY+shiftTime.end_time 		:shiftTime.end_time;
                        chileShiftTime.end_time = (chileShiftTime.is_next_day)	?	Constants.HOURS_IN_A_DAY+chileShiftTime.end_time 	:chileShiftTime.end_time;

                        if(shiftTime.start_time < chileShiftTime.end_time && shiftTime.start_time > chileShiftTime.start_time){
                            isConflictTime = true;
                        }

                        if(shiftTime.end_time < chileShiftTime.start_time && shiftTime.end_time > chileShiftTime.end_time){
                            isConflictTime = true;
                        }
                    }
                });
            });

            if(isConflictTime) return {status: Constants.STATUS_ERROR};		
        }

        return {status: Constants.STATUS_SUCCESS};
	} catch (error) {
		console.error('Error validating at validateShiftAssignment driver-shift:', error);
		return { status: Constants.STATUS_ERROR };
	}
};


export {
	assignShiftValidation,
}; 