import { body } from 'express-validator';
import * as Constants from "../../../../config/global_constant.mjs";

// Module add / edit validation rules
const addUpdateValidation = [
    body('status')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('branch_calendar.please_select_status');
            }),
    body('open_type')
        .custom((value, { req }) => {
            if(!value && req.body.status == Constants.OPEN){
                return Promise.reject(req.__('branch_calendar.please_select_type'));
            }
            return true;
        }),
    body('close_type')
        .custom((value, { req }) => {
            if(!value && req.body.status != Constants.OPEN){
                return Promise.reject(req.__('branch_calendar.please_select_type'));
            }
            return true;
        })
];

export {
    addUpdateValidation
};