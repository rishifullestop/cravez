import { body } from 'express-validator';
import {cleanRegex} from "../../../utils/index.mjs";
import { ObjectId } from 'mongodb';
import Tables from '../../../config/database_tables.mjs';
import { getDb } from '../../../config/connection.mjs';
import * as Constants from "../../../config/global_constant.mjs";

// Module add / edit validation rules
const addEditValidation = [
    body('city_id')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.areas.please_select_city');
        }),
    body('name_english')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.areas.please_enter_area_name_in_english');
        })
        .custom((value, {req, res, next, location, path}) => {
            if(value && req.body.city_id) {
                return validateAreaName(value, req).then(quRes => {
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('admin.areas.whoops_you_have_entered_an_already_used_name_in_english_please_try_something_different', { value, location, path }));
                    } else {
                        return true;
                    }
                }).catch(next);
            } else {
                return true;
            }
        }),
    body('name_arabic')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.areas.please_enter_area_name_in_arabic');
        })
        .custom((value, {req, res, next, location, path}) => {
            if(value && req.body.city_id) {
                return validateAreaName(value, req, true).then(quRes => {
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('admin.areas.whoops_you_have_entered_an_already_used_name_in_arabic_please_try_something_different', { value, location, path }));
                    } else {
                        return true;
                    }
                }).catch(next);
            } else {
                return true;
            }
        })
];

/**
 * Validate if area name already exists
 * @param {String} value - Name value to validate
 * @param {Object} req - Request object
 * @param {Boolean} isArabic - Whether checking Arabic name
 * @returns {Promise<Object>} Validation result
 */
const validateAreaName = async (value, req, isArabic = false) => {
    const cityId = new ObjectId(req.body.city_id);

    let conditions = {
        city_id: cityId
    };
    if(req.params && req.params.id) conditions["_id"] = {$ne: new ObjectId(req.params.id)};
    if(isArabic) conditions['name.ar'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};
    else conditions['name.en'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};

    // Find existing area with same name
    const dbInstance = getDb();
    const existingArea = await dbInstance.collection(Tables.AREAS).findOne(conditions, {projection: {_id: 1}});

    return {
        status: existingArea && existingArea._id ? Constants.STATUS_ERROR : Constants.STATUS_SUCCESS
    }
};

export {
    addEditValidation
};