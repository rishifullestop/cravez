import { body } from 'express-validator';
import * as Constants from '../../../config/global_constant.mjs';

// Validation rules for vacation request add/edit
const vacationRequestValidation = [
    body('driver')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.driver_leave_management.please_select_driver')),
    body('leave_type')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.driver_leave_management.please_select_leave_type')),
    body('leave_status')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.driver_leave_management.please_select_leave_status')),
    body('from_date')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.driver_leave_management.please_select_leave_date')),
    body('to_date')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.driver_leave_management.please_select_leave_date')),
    body('rejection_reason')
        .if(body('leave_status').equals(String(Constants.REJECTED)))
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.driver_leave_management.please_enter_rejection_reason'))
];

// Validation rules for weekly off
const weeklyOffValidation = [
    body('driver')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.driver_leave_management.please_select_driver')),
    body('dates')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.driver_leave_management.please_select_dates'))
];

// Validation rules for status update
const updateStatusValidation = [
    body('status')
        .notEmpty()
        .withMessage((value, { req }) => req.__('system.invalid_access')),
    body('req_ids')
        .notEmpty()
        .withMessage((value, { req }) => req.__('system.invalid_access')),
    body('rejection_reason')
        .if(body('status').equals(String(Constants.REJECTED)))
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.driver_leave_management.please_enter_rejection_reason'))
];

export {
    vacationRequestValidation,
    weeklyOffValidation,
    updateStatusValidation
};