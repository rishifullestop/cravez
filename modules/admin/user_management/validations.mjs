import { body } from 'express-validator';
import { ObjectId } from 'mongodb';
import Tables from '../../../config/database_tables.mjs';
import { getDb } from '../../../config/connection.mjs';
import * as Constants from "../../../config/global_constant.mjs";
import * as Helper from "../../../utils/index.mjs";

const basicRules = [
    body('first_name')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.user_management.please_enter_first_name');
        }),
    body('last_name')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.user_management.please_enter_last_name');
        }),
    body('email')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.user_management.please_enter_user_name');
        })
        .isEmail()
        .withMessage((value, { req }) => {
            return req.__('admin.user_management.please_enter_valid_user_name');
        })
        .custom((value, { req }) => {
            if (value){
                return validateEmail(value, req).then(quRes => {
                    if (quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('admin.user_management.user_name_is_already_exist'));
                    } else {
                        return true;
                    }
                });
            }
            return true;
        }),
    body('mobile_number')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.user_management.please_enter_phone_number');
            })
        .isLength(Constants.MOBILE_LENGTH_VALIDATION)
            .withMessage((value, { req }) => {
                return req.__('admin.user_management.invalid_phone_number');
            })
        .isNumeric()
            .withMessage((value, { req }) => {
                return req.__('admin.user_management.invalid_phone_number');
            })
        .custom((value, { req,res,next }) => {
            if (value){
                let response = Helper.checkNumberValid(req,res,next,{mobile_number :value});
                if(response.status != Constants.STATUS_SUCCESS){
                    return Promise.reject(response?.errors?.[0]?.msg || req.__('admin.user_management.invalid_phone_number'));
                }

                return validatePhone(value, req).then(quRes => {
                    if (quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('admin.user_management.mobile_number_is_already_exist'));
                    } else {
                        return true;
                    }
                });
            }
            return true;
        }),
];

const passwordRules = [
    body('password')
        .if((value, { req }) => !req?.params?.id || req.body.confirm_password)
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.user_management.please_enter_confirm_password');
            })
        .bail()
        .isLength(Constants.PASSWORD_LENGTH_VALIDATION)
            .withMessage((value, { req }) => {
                return req.__('admin.user_management.password_length_should_be_minimum_6_character');
            })
        .custom((value, { req }) => value === req.body.password)
            .withMessage((value, { req }) =>
              req.__('admin.user_management.confirm_password_should_be_same_as_password')
            ),
    body('confirm_password')
        .if((value, { req }) => !req?.params?.id || req.body.password)
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.user_management.please_enter_confirm_password');
            })
        .bail()
        .isLength(Constants.PASSWORD_LENGTH_VALIDATION)
            .withMessage((value, { req }) => {
                return req.__('admin.user_management.password_length_should_be_minimum_6_character');
            })
        .custom((value, { req }) => value === req.body.password)
            .withMessage((value, { req }) =>
              req.__('admin.user_management.confirm_password_should_be_same_as_password')
            ),
];

// Driver add/edit validation rules
const addEditDriverValidation = [
    ...basicRules,
    ...passwordRules,
    body('driver_id')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.user_management.please_enter_driver_id');
        })
        .custom((value, { req }) => {
            if (value){
                return validateDriverId(value, req).then(quRes => {
                    if (quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('admin.user_management.whoops_you_have_entered_an_already_used_driver_id_please_try_something_different'));
                    } else {
                        return true;
                    }
                });
            }
            return true;
        }),
    body('image')
        .if((value, { req }) => !req?.params?.id)
        .custom((value, { req }) => {
            if (!req?.files?.image) {
                return Promise.reject(req.__('admin.user_management.please_select_photo'));
            }
            return true;
        })
];

// Vehicle add/edit validation rules
const addEditVehicleValidation = [
    body('plate_number')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.user_management.please_enter_plate_number');
        }),
    body('vehicle_type')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.user_management.please_select_vehicle_type');
        }),
    body('status')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.user_management.please_select_status');
        }),
    body('location')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.user_management.please_enter_location');
        }),
    body('year')
        .optional()
        .custom((value, { req }) => {
            if (value && (isNaN(req.body.year) || req.body.year.length != Constants.YEAR_LIMIT || req.body.year < 0)){
                return Promise.reject(req.__('admin.user_management.please_enter_valid_year'));
            }
            return true;
        }),
    body('licence')
        .if((value, { req }) => !req?.params?.id)
        .custom((value, { req }) => {
            if (!req?.files?.licence) {
                return Promise.reject(req.__('admin.user_management.please_select_licence'));
            }
            return true;
        })
];

// Assign vehicle validation rules
const assignVehicleValidation = [
    body('vehicle')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.user_management.please_select_vehicle');
        })
];

// Customer add/edit validation rules
const addEditCustomerValidation = [
    ...basicRules,
    ...passwordRules,
    body('gender')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.user_management.please_select_gender');
        }),
    body('dateofbirth')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.user_management.please_select_date_of_birth');
        })
];

// Assign category to customer validation rules
const assignCategoryToCustomerValidation = [
    body('category')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.user_management.please_select_category');
        })
];

// Wallet amount validation rules
const addWalletAmountValidation = [
    body('wallet_type')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.user_management.please_select_wallet_type');
            }),
    body('amount')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.user_management.please_enter_amount');
            })
        .isNumeric()
            .withMessage((value, { req }) => {
                return req.__('admin.user_management.amount_should_be_greater_than_zero');
            })
        .custom((value, { req }) => {
            if(isNaN(value) || value < 0){
                return Promise.reject(req.__('admin.user_management.amount_should_be_greater_than_zero'));
            }
            return true;
        })
];

/**
 * Validate if email already exists
 * @param {String} value - Email to validate
 * @param {Object} req - Request object
 * @returns {Promise<Object>} Validation result
 */
const validateEmail = async (value, req) => {
    const dbInstance = getDb();

    let conditions = {
        email       :   {$regex: "^" + value + "$", $options: "i"},
        is_deleted  :   Constants.NOT_DELETED
    };

    if (req?.params?.id) conditions._id = { $ne: new ObjectId(req?.params?.id) };

    const existingUserCount = await dbInstance.collection(Tables.USERS).countDocuments(conditions);

    return {
        status: existingUserCount ? Constants.STATUS_ERROR : Constants.STATUS_SUCCESS
    };
};

/**
 * Validate if phone already exists
 * @param {String} value - Phone to validate
 * @param {Object} req - Request object
 * @returns {Promise<Object>} Validation result
 */
const validatePhone = async (value, req) => {
    const dbInstance = getDb();

    let conditions = {
        mobile_number: value,
        is_deleted: Constants.NOT_DELETED
    };

    if (req?.params?.id) conditions._id = { $ne: new ObjectId(req?.params?.id) };

    const existingUserCount = await dbInstance.collection(Tables.USERS).countDocuments(conditions);

    return {
        status: existingUserCount ? Constants.STATUS_ERROR : Constants.STATUS_SUCCESS
    };
};

/**
 * Validate if driver id already exists
 * @param {String} value - Driver id to validate
 * @param {Object} req - Request object
 * @returns {Promise<Object>} Validation result
 */
const validateDriverId = async (value, req) => {
    const dbInstance = getDb();

    let conditions = {
        user_role_id    : Constants.DRIVER,
        is_deleted      : Constants.NOT_DELETED,
        driver_id       : { $regex: "^" + value + "$", $options: "i" },
    };

    if (req?.params?.id) conditions._id = { $ne: new ObjectId(req?.params?.id) };

    const existingUserCount = await dbInstance.collection(Tables.USERS).countDocuments(conditions);

    return {
        status: existingUserCount ? Constants.STATUS_ERROR : Constants.STATUS_SUCCESS
    };
};

export {
    addEditDriverValidation,
    addEditCustomerValidation,
    addEditVehicleValidation,
    addWalletAmountValidation,
    assignVehicleValidation,
    assignCategoryToCustomerValidation
};