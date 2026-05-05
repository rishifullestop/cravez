import { body, param } from 'express-validator';
import * as Constants from "../../../config/global_constant.mjs";

// Validation rules for add/edit overtime captain request operations
const addEditOvertimeCaptainRequestValidation = [
    body('agent_id')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.captain_overtime_request.please_select_captain');
        }),
    body('request_date')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.captain_overtime_request.please_enter_request_date');
        }),
    body('overtime_hours')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.captain_overtime_request.please_enter_overtime_hours');
        })
        .isFloat()
        .withMessage((value, { req }) => {
            return req.__('admin.captain_overtime_request.please_enter_valid_overtime_hours');
        })
        .custom((value, { req }) => {
            let hours = parseFloat(value);
            if (hours <= Constants.OVERTIME_MIN_HOURS || hours >= Constants.OVERTIME_MAX_HOURS) {
                throw new Error(req.__('admin.captain_overtime_request.please_enter_min_one_max_twentyfour'));
            }
            return true;
        }),
    body('overtime_purpose')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.captain_overtime_request.please_enter_overtime_purpose');
        })
];

export {
    addEditOvertimeCaptainRequestValidation
}; 