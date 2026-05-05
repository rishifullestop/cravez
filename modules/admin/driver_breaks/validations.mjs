import { body } from 'express-validator';
import * as Constants from '../../../config/global_constant.mjs';

// Add/Edit validation rules for driver breaks
const addEditValidation = [
    body('user_id')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.driver_breaks.please_select_captain_name')),
    body('duration')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.driver_breaks.please_enter_duration'))
        .isInt()
        .withMessage((value, { req }) => req.__('admin.driver_breaks.please_enter_valid_duration'))
];

// Approve validation
const approveValidation = [
    body('duration')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.driver_breaks.please_enter_duration'))
        .isInt()
        .withMessage((value, { req }) => req.__('admin.driver_breaks.please_enter_valid_duration'))
];

// Reject validation
const rejectValidation = [
    body('rejection_reason')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.driver_breaks.please_enter_reason'))
        .isLength({ max: Constants.REJECTION_MESSAGE_TEXT_LENGTH })
        .withMessage((value, { req }) => req.__('admin.driver_breaks.message_max_length', Constants.REJECTION_MESSAGE_TEXT_LENGTH))
];

// Cancel validation
const cancelValidation = [
    body('cancel_reason')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.driver_breaks.please_enter_reason'))
        .isLength({ max: Constants.REJECTION_MESSAGE_TEXT_LENGTH })
        .withMessage((value, { req }) => req.__('admin.driver_breaks.message_max_length', Constants.REJECTION_MESSAGE_TEXT_LENGTH))
];



export {
    addEditValidation,
    approveValidation,
    rejectValidation,
    cancelValidation
};