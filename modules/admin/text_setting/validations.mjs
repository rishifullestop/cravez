import { body } from 'express-validator';
import { cleanRegex } from "../../../utils/index.mjs";
import { ObjectId } from 'mongodb';
import Tables from '../../../config/database_tables.mjs';
import { getDb } from '../../../config/connection.mjs';
import * as Constants from "../../../config/global_constant.mjs";

// Validation rules for add/edit text settings
const addEditValidation = [
    body('key')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.text_setting.please_enter_key'))
        .custom((value, { req }) => {
            if(value) {
                return validateTextSettingKey(value, req).then(quRes => {
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('admin.text_setting.whoops_you_have_entered_an_already_used'));
                    } else {
                        return true;
                    }
                });
            } else {
                return true;
            }
        }),
    body('value')
        .custom((value, { req }) => {
            if(!req?.body?.text_settings_descriptions?.[Constants.DEFAULT_LANGUAGE_MONGO_ID]?.value) {
                return Promise.reject(req.__('admin.text_setting.please_enter_value'));
            } else {
                return true;
            }
        })
];

/**
 * Validate if text setting key already exists
 * @param {String} value - Key value
 * @param {Object} req - Request object
 * @returns {Promise<Object>} Validation result
 */
const validateTextSettingKey = async (value, req) => {
    let conditions = {
        "key": {$regex: '^' + cleanRegex(value) + '$', $options: 'i'}
    };
    
    if(req.params && req.params.id) {
        conditions["_id"] = {$ne: new ObjectId(req.params.id)};
    }

    // Find existing text setting with same key
    const dbInstance = getDb();
    const existingTextSetting = await dbInstance.collection(Tables.TEXT_SETTINGS).findOne(conditions, {projection: {_id: 1}});

    return {
        status: existingTextSetting && existingTextSetting._id ? Constants.STATUS_ERROR : Constants.STATUS_SUCCESS
    }
};

export {
    addEditValidation
}; 