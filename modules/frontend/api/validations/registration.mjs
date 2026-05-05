import { body } from 'express-validator';
import * as Constants from '../../../../config/global_constant.mjs';

// Login validation rules
const loginValidation = (req) => [
    body('user_name')
        .notEmpty()
        .withMessage(() => {
            return req.__('user.please_enter_user_name');
        })
        .custom(value => {
            if(value && !Constants.EMAIL_AND_MOBILE_REGULAR_EXPRESSION.test(value)){
                return Promise.reject(req.__('user.please_enter_valid_email_mobile_number'));
            }
            return true;
        }),
    body('password')
        .notEmpty()
        .withMessage(() => {
            return req.__('user.please_enter_password');
        })
];

// Forgot password validation rules
const forgotPasswordValidation = (req) => [
    body('email')
        .custom(value => {
            if(req.body.email_phone == Constants.EMAIL){
                if(!value){
                    return Promise.reject(req.__('user.please_enter_email'));
                }else if(!Constants.EMAIL_REGULAR_EXPRESSION.test(value)){
                    return Promise.reject(req.__('user.please_enter_valid_email_address'));
                }
            }
            return true;
        }),
    body('mobile_number')
        .custom(value => {
            if(req.body.email_phone == Constants.MOBILE_NUMBER){
                if(!value){
                    return Promise.reject(req.__('user.please_enter_mobile_number'));
                }else if(!Constants.MOBILE_NUMBER_REGULAR_EXPRESSION.test(value)){
                    return Promise.reject(req.__('user.invalid_mobile_number'));
                }
            }
            return true;
        })
];

// Reset password validation rules
const resetPasswordValidation = (req) => [
    body('password')
        .notEmpty()
        .withMessage(() => {
            return req.__('user.please_enter_password');
        })
        .isLength(Constants.PASSWORD_LENGTH)
        .withMessage(() => {
            return req.__('user.password_length_should_be_minimum_6_character');
        }),
    body('confirm_password')
        .notEmpty()
        .withMessage(() => {
            return req.__('user.please_enter_confirm_password');
        })
        .bail()
        .isLength(Constants.PASSWORD_LENGTH)
        .withMessage(() => {
            return req.__('user.confirm_password_length_should_be_minimum_6_character');
        })
        .bail()
        .custom((value) => {
            if (value !== req.body.password) {
                throw new Error(req.__('user.confirm_password_should_be_same_as_password'));
            }
            return true;
        })
];

// Verify Otp validation rules
const verifyOTPValidation = (req) => [
    body('otp')
        .notEmpty()
            .withMessage(() => {
                return req.__('user.please_enter_otp');
            })
];

export {
    loginValidation,
    forgotPasswordValidation,
    resetPasswordValidation,
    verifyOTPValidation
};