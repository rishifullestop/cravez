import { body } from 'express-validator';
import * as Constants from "../../../config/global_constant.mjs";

// Module rejection validation rules
const rejectionValidation = [
    body('rejection_reason')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('cuisine_priorities.please_enter_rejection_reason');
        })
        .isLength({
            max: Constants.REJECTION_MESSAGE_TEXT_LENGTH
        })
        .withMessage((value, { req }) => {
            return req.__('cuisine_priorities.message_max_length', Constants.REJECTION_MESSAGE_TEXT_LENGTH);
        })
];

export {
    rejectionValidation
}; 