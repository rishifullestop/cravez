import { body } from 'express-validator';
import * as Constants from "../../../../config/global_constant.mjs";

// Module add / edit validation rules
const addBranchPhoneValidation = [
    body('attribute_id')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('branch_phones.please_select_category');
            }),
    body('value')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('branch_phones.please_enter_phone_number');
            })
        .isNumeric()
            .withMessage((value, { req }) => {
                return req.__('branch_phones.please_enter_valid_phone_number');
            })
        .isLength(Constants.MOBILE_LENGTH_VALIDATION)
            .withMessage((value, { req }) => {
                return req.__('branch_phones.please_enter_valid_phone_number');
            }),
    body('contact_name')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('branch_phones.please_enter_contact_name');
            })
];

export {
    addBranchPhoneValidation
};