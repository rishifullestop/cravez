import { body } from 'express-validator';
import * as Constants from "../../../config/global_constant.mjs";

// Module add / edit validation rules
const addEditValidation = [
    body('business_rule')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.task_assignment.please_select_business_rule');
        }),
    body('agent_id')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.task_assignment.please_select_agent_id');
        }),
    body('date')
        .custom((value, { req }) => {
            if (!req?.body?.from_date || !req?.body?.to_date) {
                return Promise.reject(req.__('admin.task_assignment.please_select_date'));
            }
            return true;
        })
    
];

export {
    addEditValidation
}; 