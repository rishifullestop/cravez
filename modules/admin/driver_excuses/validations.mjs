import { body } from 'express-validator';
import * as Constants from '../../../config/global_constant.mjs';

// Validation rules for rejecting an excuse
const rejectValidation = [
    body('rejection_reason')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.driver_excuses.please_enter_reason'))
        .isLength({ max: Constants.REJECTION_MESSAGE_TEXT_LENGTH })
        .withMessage((value, { req }) => req.__('admin.driver_excuses.message_max_length', Constants.REJECTION_MESSAGE_TEXT_LENGTH))
];

// Validation rules for cancelling an excuse
const cancelValidation = [
    body('cancel_reason')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.driver_excuses.please_enter_reason'))
        .isLength({ max: Constants.REJECTION_MESSAGE_TEXT_LENGTH })
        .withMessage((value, { req }) => req.__('admin.driver_excuses.message_max_length', Constants.REJECTION_MESSAGE_TEXT_LENGTH))
];


export {
    rejectValidation,
    cancelValidation
};