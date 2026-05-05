import { body } from 'express-validator';
import { cleanRegex } from "../../../utils/index.mjs";
import { ObjectId } from 'mongodb';
import Tables from '../../../config/database_tables.mjs';
import { getDb } from '../../../config/connection.mjs';
import * as Constants from "../../../config/global_constant.mjs";

// Module add / edit restaurant user validation rules
const addEditValidation = [
    body('first_name')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('user_permissions.please_enter_first_name');
            }),
    body('last_name')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('user_permissions.please_enter_last_name');
            }),
    body('email')
        .trim()
        .notEmpty()
            .withMessage((value, { req, location, path }) => {
                return req.__('user_permissions.please_enter_mail', { value, location, path });
            })
        .isEmail()
            .withMessage((value, { req, location, path }) => {
                return req.__('user_permissions.please_enter_valid_email_address', { value, location, path });
            })
        .custom((value, { req }) => {
            if(value) {
                return validateUniqueEmail(value, req).then(quRes => {
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('user_permissions.your_email_id_is_already_exist'));
                    } else {
                        return true;
                    }
                });
            } else {
                return true;
            }
        }),
    body('user_role')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('user_permissions.please_select_user_role');
            }),
    body('module_ids')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('user_permissions.please_select_modules');
            }),
    
    body('password')
        .if((value, { req }) => !req?.params?.id || req.body.confirm_password)
        .notEmpty()
            .withMessage((value, { req, location, path }) => {
                return req.__('user_permissions.please_enter_password', { value, location, path });
            })
        .isLength(Constants.PASSWORD_LENGTH_VALIDATION)
            .withMessage((value, { req, location, path }) => {
                return req.__('user_permissions.password_length_should_be_minimum_6_character', { value, location, path });
            }),
    body('confirm_password')
        .if((value, { req }) => !req?.params?.id || req.body.password)
        .notEmpty()
            .withMessage((value, { req, location, path }) => {
                return req.__('user_permissions.please_enter_confirm_password', { value, location, path });
            })
        .isLength(Constants.PASSWORD_LENGTH_VALIDATION)
            .withMessage((value, { req, location, path }) => {
                return req.__('user_permissions.password_length_should_be_minimum_6_character', { value, location, path });
            })
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error(req.__('user_permissions.confirm_password_should_be_same_as_password'));
            }
            return true;
        })
   
];

/**
 * Validate if email already exists
 * @param {String} value - Email value
 * @param {Object} req - Request object
 * @returns {Promise<Object>} Validation result
 */
const validateUniqueEmail = async (value, req) => {
    /** Set conditions for email */
    let conditions = {
        email: {$regex : '^'+value+'$',$options : 'i'},
        is_deleted: Constants.NOT_DELETED,
    };
    
    /** If edit user, exclude current user from validation */
    if(req?.params?.id)  conditions["_id"] = {$ne: new ObjectId(req.params.id)};
    
    /** Find existing user with same email */
    const dbInstance = getDb();
    const existingUser = await dbInstance.collection(Tables.USERS).findOne(conditions, {projection: {_id: 1}});

    return {
        status: existingUser && existingUser._id ? Constants.STATUS_ERROR : Constants.STATUS_SUCCESS
    }
};

export {
    addEditValidation
}; 
