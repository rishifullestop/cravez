import { body } from 'express-validator';
import { cleanRegex } from "../../../utils/index.mjs";
import { ObjectId } from 'mongodb';
import Tables from '../../../config/database_tables.mjs';
import { getDb } from '../../../config/connection.mjs';
import * as Constants from "../../../config/global_constant.mjs";

// Restaurant edit profile validation rules
const restaurantEditProfileValidation = (req) => [
    body('name_in_english')
        .notEmpty()
        .withMessage(() => {
            return req.__('users.please_enter_restaurant_name_in_english');
        }),
    body('name_in_arabic')
        .notEmpty()
        .withMessage(() => {
            return req.__('users.please_enter_restaurant_name_in_arabic');
        }),
    body('restaurant_address')
        .notEmpty()
        .withMessage(() => {
            return req.__('users.please_enter_restaurant_address');
        }),
    body('restaurant_description')
        .notEmpty()
        .withMessage(() => {
            return req.__('users.please_enter_restaurant_description');
        }),
    body('contact_person_name')
        .notEmpty()
        .withMessage(() => {
            return req.__('users.please_enter_contact_person_name');
        }),
    body('account_manager_name')
        .notEmpty()
        .withMessage(() => {
            return req.__('users.please_enter_account_manager_name');
        }),
    body('thermal_layout_format')
        .notEmpty()
        .withMessage(() => {
            return req.__('users.please_select_thermal_layout_format');
        }),
    body('email_address')
        .notEmpty()
        .withMessage(() => {
            return req.__('users.please_enter_email');
        })
        .isEmail()
        .withMessage(() => {
            return req.__('users.please_enter_valid_email_address');
        }),
    body('mobile_number')
        .notEmpty()
            .withMessage(() => {
                return req.__('users.please_enter_mobile_number');
            })
        .isNumeric()
            .withMessage(() => {
                return req.__('users.invalid_mobile_number');
            })
        .isLength(Constants.MOBILE_LENGTH_VALIDATION )
            .withMessage(() => {
                return req.__('users.invalid_mobile_number');
            })
        .custom(async (value) => {
            if (value){
                let quRes = await validateMobileExists(value, req);

                if (quRes.status != Constants.STATUS_SUCCESS){
                    return Promise.reject(req.__('user.mobile_number_is_already_exist'));
                } else {
                    return true;
                }
            }
            return true;
        })
];

// Edit profile validation rules
const subAdminEditProfileValidation = (req) => [
    body('first_name')
        .notEmpty()
            .withMessage(() => {
                return req.__('users.please_enter_restaurant_name_in_english');
            }),
    body('last_name')
        .notEmpty()
            .withMessage(() => {
                return req.__('users.please_enter_restaurant_name_in_arabic');
            })
];

// Restaurant onboarding validation rules
const restaurantOnboardingValidation = [
    body('restaurant_english_name')
        .notEmpty()
            .withMessage((value, { req, location, path }) => {
                return req.__('restaurant_onboarding.please_enter_restaurant_name_in_english', { value, location, path });
            }),
    body('restaurant_arabic_name')
        .notEmpty()
            .withMessage((value, { req, location, path }) => {
                return req.__('restaurant_onboarding.please_enter_restaurant_name_in_arabic', { value, location, path });
            }),
    body('restaurant_address')
        .notEmpty()
            .withMessage((value, { req, location, path }) => {
                return req.__('restaurant_onboarding.please_enter_restaurant_address', { value, location, path });
            }),
    body('contact_number')
        .notEmpty()
            .withMessage((value, { req, location, path }) => {
                return req.__('restaurant_onboarding.please_enter_restaurant_contact_number', { value, location, path });
            })
        .isNumeric()
            .withMessage((value, { req, location, path }) => {
                return req.__('restaurant_onboarding.invalid_mobile_number', { value, location, path });
            })
        .isLength(Constants.MOBILE_LENGTH_VALIDATION )
            .withMessage((value, { req, location, path }) => {
                return req.__('restaurant_onboarding.mobile_number_limit', { value, location, path });
            }),
    body('contact_person_name')
        .notEmpty()
            .withMessage((value, { req, location, path }) => {
                return req.__('restaurant_onboarding.please_enter_contact_person_name', { value, location, path });
            }),
    body('account_manager_name')
        .notEmpty()
            .withMessage((value, { req, location, path }) => {
                return req.__('restaurant_onboarding.please_enter_account_manager_name', { value, location, path });
            }),
    body('email_address')
        .notEmpty()
            .withMessage((value, { req, location, path }) => {
                return req.__('restaurant_onboarding.please_enter_restaurant_email_address', { value, location, path });
            })
        .isEmail()
            .withMessage((value, { req, location, path }) => {
                return req.__('restaurant_onboarding.please_enter_valid_email_address', { value, location, path });
            }),
    body('restaurant_description')
        .custom((value, { req, location, path }) => {
            if (value?.trim()?.length > Constants.RESTAURANT_DESCRIPTION_MAX_LENGTH){
                return Promise.reject(req.__('restaurant_onboarding.maximum_characters_allowed', { value, location, path }));
            }
            return true;
        }),
    body('file')
        .custom((value, { req, location, path }) => {
            if (!req?.files?.file){
                return Promise.reject(req.__('restaurant_onboarding.please_select_file', { value, location, path }));
            }
            return true;
        }),
    body('landing_image')
        .custom((value, { req, location, path }) => {
            if (!req?.files?.landing_image){
                return Promise.reject(req.__('restaurant_onboarding.please_select_landing_image', { value, location, path }));
            }
            return true;
        }),
    body('restaurant_logo')
        .custom((value, { req, location, path }) => {
            if (!req?.files?.file){
                return Promise.reject(req.__('restaurant_onboarding.please_select_logo', { value, location, path }));
            }
            return true;
        }),
    body('detail_image')
        .custom((value, { req, location, path }) => {
            if (!req?.files?.detail_image){
                return Promise.reject(req.__('restaurant_onboarding.please_select_detail_image', { value, location, path }));
            }
            return true;
        })
];

/**
 * Validate if mobile number already exists
 * @param {String} mobile - Mobile number
 * @param {Object} req - Request object
 * @returns {Promise<Object>} Validation result
 */
const validateMobileExists = async (mobile, req) => {
    try{
        let restaurantId=	(req.session && req.session.user) ? req.session.user.restaurant_id	:"";

        const conditions = {
            mobile_number   : mobile,
            restaurant_id	: {$ne: new ObjectId(restaurantId)},
            is_deleted      : Constants.NOT_DELETED
        };

        // Find existing user with same mobile number
        const dbInstance = getDb();
        const existingUser = await dbInstance.collection(Tables.USERS).findOne(conditions, { projection: { _id: 1 } });

        return {
            status: existingUser && existingUser._id ? Constants.STATUS_ERROR : Constants.STATUS_SUCCESS
        };
    }catch(error){
        console.log('Error in validateMobileExists at frontend/users/validations.mjs', error);
        return {
            status: Constants.STATUS_ERROR,
            message: error.message
        };
    }
};

export {
    restaurantEditProfileValidation,
    subAdminEditProfileValidation,
    restaurantOnboardingValidation
};