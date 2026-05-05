import { body } from 'express-validator';

// Validation rules for add overtime request operations
const addOvertimeRequestValidation = [
    body('agent_id')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.overtime_request.please_select_team_member');
        }),
    body('request_date')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.overtime_request.please_enter_request_date');
        }),
    body('start_time')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.overtime_request.please_select_overtime_start_time');
        }),
    body('end_time')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.overtime_request.please_select_overtime_end_time');
        })
        .custom((value, { req }) => {
            let startTime = parseFloat(req?.body?.start_time && req?.body?.start_time.replace(':', '.') || 0);
            let endTime = parseFloat(value && value.replace(':', '.') || 0);
            
            if (endTime && endTime <= startTime) {
                throw new Error(req.__('admin.overtime_request.overtime_end_time_should_be_greater_than_overtime_start_time'));
            }
            return true;
        }),
    body('overtime_purpose')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.overtime_request.please_enter_overtime_purpose');
        })
];

export {
    addOvertimeRequestValidation
}; 