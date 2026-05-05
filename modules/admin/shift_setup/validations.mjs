import { body } from 'express-validator';

// Validation rules for add/edit shift operations
const addEditValidation = [
    body('shift_name')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.shift_setup.please_enter_shift_name');
        }),
    body('start_time')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.shift_setup.please_select_shift_start_time');
        }),
    body('end_time')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.shift_setup.please_select_shift_end_time');
        })
];

// Validation rules for assign shift operations
const assignShiftValidation = [
    body('shift_user')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.shift_setup.please_select_user');
        }),
    body('date_time')
        .custom((value, { req }) => {
            if(!req.body.from_date  || !req.body.to_date) {
                throw new Error(req.__('admin.shift_setup.please_select_shift_date_time'));
            }
            return true;
        })
];

// Validation rules for assign shift for team schedule
const assignShiftTeamScheduleValidation = [
    body('shift_user')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.shift_setup.please_select_user');
        }),
    body('shift_id')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.shift_setup.please_select_shift_name');
        }),
    body('date_time')
        .custom((value, { req }) => {
            if(!req.body.from_date  || !req.body.to_date) {
                throw new Error(req.__('admin.shift_setup.please_select_shift_date_time'));
            }
            return true;
        })
];

export {
    addEditValidation,
    assignShiftValidation,
    assignShiftTeamScheduleValidation,
}; 