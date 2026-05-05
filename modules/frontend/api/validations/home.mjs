import { body } from 'express-validator';
import * as Constants from '../../../../config/global_constant.mjs';

// contact us validation rules
export const contactUsValidation = (req) => [
    body('mobile_number')
        .notEmpty()
            .withMessage(() => {
                return req.__('contact_us.please_enter_mobile_number');
            })
        .isNumeric()
            .withMessage(() => {
                return req.__('contact_us.invalid_mobile_number');
            })
        .isLength(Constants.MOBILE_LENGTH_VALIDATION )
            .withMessage(() => {
                return req.__('contact_us.invalid_mobile_number');
            }),
    body('name')
        .notEmpty()
            .withMessage(() => {
                return req.__('contact_us.please_enter_name');
            }),
    body('message')
        .notEmpty()
            .withMessage(() => {
                return req.__('contact_us.please_enter_message');
            })
];