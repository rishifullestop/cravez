import { body } from 'express-validator';
import * as Constants from "../../../config/global_constant.mjs";

// Login validation rules
const loginValidation = [
    body('username')
        .notEmpty().withMessage('Please enter email')
        .isEmail().withMessage('Please enter valid email address'),
    body('password')
        .notEmpty().withMessage('Please enter password')
];

// User profile validation rules
const profileValidation = [
    body('full_name').notEmpty().withMessage((value, { req, location, path }) => {
        return req.__('admin.user.please_enter_full_name', { value, location, path });
    }),
    body('password').trim()
    .custom((value, { req, res, next, location, path }) => {
        if(!value && (req.body.old_password || req.body.confirm_password)){
            return Promise.reject(req.__('admin.user.please_enter_your_password', { value, location, path }));
        }else if(value && value.length < Constants.PASSWORD_MIN_LENGTH){
            return Promise.reject(req.__('admin.user.password_length_should_be_minimum_6_character', { value, location, path }));
        }
        return true;
    }),
    body('old_password').trim().custom((value, { req, res, next, location, path }) => {
        if(!value && (req.body.password || req.body.confirm_password)){
            return Promise.reject(req.__('admin.user.please_enter_your_old_password', { value, location, path }));
        }
        return true;
    }),
    body('confirm_password').trim()
    .custom((value, { req, res, next, location, path }) => {
        if(!value && (req.body.password || req.body.old_password)){
            return Promise.reject(req.__('admin.user.please_enter_confirm_password', { value, location, path }));
        }else if(value && value.length < Constants.PASSWORD_MIN_LENGTH){
            return Promise.reject(req.__('admin.user.password_length_should_be_minimum_6_character', { value, location, path }));
        }else if(value && req.body.password && value != req.body.password){
            return Promise.reject(req.__('admin.user.confirm_password_should_be_same_as_password', { value, location, path }));
        }
        return true;
    })
];

// Password reset validation rules
const passwordResetValidation = [
    body('password').trim()
    .notEmpty().withMessage((value, { req, location, path }) => {
        return req.__('admin.user.please_enter_your_password', { value, location, path });
    })
    .isLength({min: Constants.PASSWORD_MIN_LENGTH}).withMessage((value, { req, location, path }) => {
        return req.__('admin.user.password_length_should_be_minimum_6_character', { value, location, path });
    }),

    body('confirm_password').trim()
    .notEmpty().withMessage((value, { req, location, path }) => {
        return req.__('admin.user.please_enter_confirm_password', { value, location, path });
    })
    .isLength({min: Constants.PASSWORD_MIN_LENGTH}).withMessage((value, { req, location, path }) => {
        return req.__('admin.user.password_length_should_be_minimum_6_character', { value, location, path });
    })
    .custom((value, { req, res, next, location, path }) => {
        if(value && req.body.password && value != req.body.password){
            return Promise.reject(req.__('admin.user.confirm_password_should_be_same_as_password', { value, location, path }));
        }
        return true;
    })
];

// Password forgot validation rules
const passwordForgotValidation = [
    body('email').notEmpty().withMessage((value, { req, location, path }) => {
        return req.__('admin.user.please_enter_email_address', { value, location, path });
    }).isEmail().withMessage((value, { req, location, path }) => {
        return req.__('admin.user.please_enter_valid_email_address', { value, location, path });
    })
];

export {
    loginValidation,
    profileValidation,
    passwordResetValidation,
    passwordForgotValidation
};