import { body } from 'express-validator';
import {cleanRegex} from "../../../utils/index.mjs";
import { ObjectId } from 'mongodb';
import Tables from '../../../config/database_tables.mjs';
import { getDb } from '../../../config/connection.mjs';
import * as Constants from '../../../config/global_constant.mjs';

// Add/Edit validation rules for cuisines
const addEditValidation = [
    body('name_english')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.cuisines.please_enter_cuisine_name_in_english'))
        .custom((value, { req, res, next, location, path }) => {
            if(value){
                return validateCuisineName(value, req).then(quRes => {
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('admin.cuisines.whoops_you_have_entered_an_already_used_name_in_english_please_try_something_different', { value, location, path }));
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
        .withMessage((value, { req }) => req.__('admin.cuisines.please_enter_cuisine_name_in_arabic'))
        .custom((value, { req, res, next, location, path }) => {
            if(value){
                return validateCuisineName(value, req, true).then(quRes => {
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('admin.cuisines.whoops_you_have_entered_an_already_used_name_in_arabic_please_try_something_different', { value, location, path }));
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
 * Validate if cuisine name already exists
 */
const validateCuisineName = async (value, req, isArabic = false) => {
    let conditions = {};
    if(req.params && req.params.id) conditions['_id'] = { $ne: new ObjectId(req.params.id) };
    if(isArabic) conditions['name.ar'] = { $regex: '^' + cleanRegex(value) + '$', $options: 'i' };
    else conditions['name.en'] = { $regex: '^' + cleanRegex(value) + '$', $options: 'i' };

    // Find existing cuisine with same name
    const dbInstance = getDb();
    const existingCuisine = await dbInstance.collection(Tables.CUISINES).findOne(conditions, {projection: {_id: 1}});
    return {
        status: existingCuisine && existingCuisine._id && Constants.STATUS_ERROR || Constants.STATUS_SUCCESS
    };
};

export {
    addEditValidation
};