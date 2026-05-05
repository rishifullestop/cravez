import { body } from 'express-validator';
import * as Constants from "../../../config/global_constant.mjs";

// Module add / edit validation rules
const addEditValidation = [
    body('valid_till')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.super_packages.please_select_valid_till');
            }),
    body('amount')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.super_packages.please_enter_amount');
            })
        .isNumeric()
            .withMessage((value, { req }) => {
                return req.__('admin.super_packages.please_enter_valid_amount');
            })
        .custom((value, { req }) => {
            if (value && (value <= 0 || isNaN(value))) {
                return Promise.reject(req.__('admin.super_packages.amount_should_be_greater_than_zero'));
            }
            return true;
        }),
    body('days')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.super_packages.please_enter_days');
            })
        .isNumeric()
            .withMessage((value, { req }) => {
                return req.__('admin.super_packages.please_enter_valid_days');
            })
        .custom((value, { req }) => {
            if (value && (value <= 0 || isNaN(value))) {
                return Promise.reject(req.__('admin.super_packages.days_should_be_greater_than_zero'));
            }
            return true;
        }),
    body('number_of_orders')
        .custom((value, { req }) => {
            if (value && (value <= 0 || isNaN(value) || !Constants.VALID_NUMBER_REGEX.test(value))) {
                return Promise.reject(req.__('admin.super_packages.please_enter_valid_number_of_orders'));
            }
            return true;
        })
];

export {
    addEditValidation
}; 