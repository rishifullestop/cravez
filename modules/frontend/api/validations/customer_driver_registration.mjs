import { body } from 'express-validator';
import * as Constants from '../../../../config/global_constant.mjs';

// customer registration validation rules
export const customerRegistrationValidation = (req) => [
    body('first_name')
        .notEmpty()
            .withMessage(() => {
                return req.__('user.please_enter_first_name');
            })
        .custom(value => {
            if(value && !Constants.USER_NAME_EXPRESSION.test(value)){
                return Promise.reject(req.__('user.please_enter_valid_first_name'));
            }
            return true;
        }),
    body('last_name')
        .notEmpty()
            .withMessage(() => {
                return req.__('user.please_enter_last_name');
            })
        .custom(value => {
            if(value && !Constants.USER_NAME_EXPRESSION.test(value)){
                return Promise.reject(req.__('user.please_enter_valid_last_name'));
            }
            return true;
        }),
    body('email')
        .notEmpty()
            .withMessage(() => {
                return req.__('user.please_enter_mail');
            })
        .isEmail()
            .withMessage(() => {
                return req.__('user.please_enter_valid_email_address');
            }),
    body('mobile_number')
        .notEmpty()
            .withMessage(() => {
                return req.__('user.please_enter_phone_number');
            })
        .isNumeric()
            .withMessage(() => {
                return req.__('user.invalid_phone_number');
            })
        .isLength(Constants.MOBILE_LENGTH_VALIDATION )
            .withMessage(() => {
                return req.__('user.invalid_phone_number');
            }),
    body('gender')
        .notEmpty()
            .withMessage(() => {
                return req.__('user.please_select_gender');
            }),
    body('date_of_birth')
        .notEmpty()
            .withMessage(() => {
                return req.__('user.please_select_date_of_birth');
            }),
    body('password')
        .notEmpty()
            .withMessage(() => {
                return req.__('user.please_enter_password');
            })
        .isLength(Constants.PASSWORD_LENGTH_VALIDATION )
            .withMessage(() => {
                return req.__('user.password_length_should_be_minimum_6_character');
            }),
    body('confirm_password')
        .notEmpty()
            .withMessage(() => {
                return req.__('user.please_enter_confirm_password');
            })
        .isLength(Constants.PASSWORD_LENGTH_VALIDATION )
            .withMessage(() => {
                return req.__('user.password_length_should_be_minimum_6_character');
            })
        .custom(value => {
            if(value && req.body.password && value != req.body.password){
                return Promise.reject(req.__('user.confirm_password_should_be_same_as_password'));
            }
            return true;
        }),
];

// driver registration validation rules
export const driverRegistrationValidation = (req) => [
    body('first_name')
        .notEmpty()
            .withMessage(() => {
                return req.__('user.please_enter_first_name');
            })
        .custom(value => {
            if(value && !Constants.USER_NAME_EXPRESSION.test(value)){
                return Promise.reject(req.__('user.please_enter_valid_first_name'));
            }
            return true;
        }),
    body('last_name')
        .notEmpty()
            .withMessage(() => {
                return req.__('user.please_enter_last_name');
            })
        .custom(value => {
            if(value && !Constants.USER_NAME_EXPRESSION.test(value)){
                return Promise.reject(req.__('user.please_enter_valid_last_name'));
            }
            return true;
        }),
    body('email')
        .notEmpty()
            .withMessage(() => {
                return req.__('user.please_enter_mail');
            })
        .isEmail()
            .withMessage(() => {
                return req.__('user.please_enter_valid_email_address');
            }),
    body('mobile_number')
        .notEmpty()
            .withMessage(() => {
                return req.__('user.please_enter_phone_number');
            })
        .isNumeric()
            .withMessage(() => {
                return req.__('user.invalid_phone_number');
            })
        .isLength(Constants.MOBILE_LENGTH_VALIDATION )
            .withMessage(() => {
                return req.__('user.invalid_phone_number');
            }),
    body('password')
        .notEmpty()
            .withMessage(() => {
                return req.__('user.please_enter_password');
            })
        .isLength(Constants.PASSWORD_LENGTH_VALIDATION )
            .withMessage(() => {
                return req.__('user.password_length_should_be_minimum_6_character');
            }),
    body('confirm_password')
        .notEmpty()
            .withMessage(() => {
                return req.__('user.please_enter_confirm_password');
            })
        .isLength(Constants.PASSWORD_LENGTH_VALIDATION )
            .withMessage(() => {
                return req.__('user.password_length_should_be_minimum_6_character');
            })
        .custom(value => {
            if(value && req.body.password && value != req.body.password){
                return Promise.reject(req.__('user.confirm_password_should_be_same_as_password'));
            }
            return true;
        }),
];

// login validation rules
export const loginValidation = (req) => [
    body('user_name')
        .custom(value => {
            let socialId   = req?.body?.social_id || "";
            let socialType = req?.body?.social_type?.toLowerCase() || "";

            if(!["facebook","google","twitter"].includes(socialType) || socialId == "") {
                if(!value){
                    return Promise.reject(req.__('user.please_enter_user_name'));
                }else if(value && !Constants.EMAIL_AND_MOBILE_REGULAR_EXPRESSION.test(value)){
                    return Promise.reject(req.__('user.please_enter_valid_email_mobile_number'));
                }
            }
            return true;
        }),
    body('password')
        .custom(value => {
            let socialId   = req?.body?.social_id || "";
            let socialType = req?.body?.social_type?.toLowerCase() || "";

            if((!["facebook","google","twitter"].includes(socialType) || socialId == "") && !value) {
                return Promise.reject(req.__('user.please_enter_password'));
            }
            return true;
        })
];

// forgot password validation rules
export const forgotPasswordValidation = (req) => [
    body('email')
        .custom(value => {
            if(req?.body?.type == Constants.EMAIL) {
                if(!value){
                    return Promise.reject(req.__('user.please_enter_email'));
                }else if(value && !Constants.EMAIL_REGULAR_EXPRESSION.test(value)){
                    return Promise.reject(req.__('user.please_enter_valid_email_address'));
                }
            }
            return true;
        }),
    body('mobile_number')
        .custom(value => {
            if(req?.body?.type == Constants.MOBILE_NUMBER) {
                if(!value){
                    return Promise.reject(req.__('user.please_enter_mobile_number'));
                }else if(value && !Constants.MOBILE_REGULAR_EXPRESSION.test(value)){
                    return Promise.reject(req.__('user.invalid_mobile_number'));
                }
            }
            return true;
        })
];

// verify mobile number validation rules
export const verifyMobileNumberValidation = (req) => [
    body('otp')
        .notEmpty()
            .withMessage(() => {
                return req.__('user.please_enter_otp');
            })
];

// verify reset  password validation rules
export const resetPasswordValidation = (req) => [
    body('password')
        .notEmpty()
            .withMessage(() => {
                return req.__('user.please_enter_password');
            })
        .isLength(Constants.PASSWORD_LENGTH_VALIDATION )
            .withMessage(() => {
                return req.__('user.password_length_should_be_minimum_6_character');
            }),
    body('confirm_password')
        .notEmpty()
            .withMessage(() => {
                return req.__('user.please_enter_confirm_password');
            })
        .isLength(Constants.PASSWORD_LENGTH_VALIDATION )
            .withMessage(() => {
                return req.__('user.password_length_should_be_minimum_6_character');
            })
        .custom(value => {
            if(value && req.body.password && value != req.body.password){
                return Promise.reject(req.__('user.confirm_password_should_be_same_as_password'));
            }
            return true;
        })
];

// ReClaim account validation rules
export const reClaimAccountValidation = (req) => [
    body('otp')
        .notEmpty()
            .withMessage(() => {
                return req.__('user.please_enter_otp');
            })
];