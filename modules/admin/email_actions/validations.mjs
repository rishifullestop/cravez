import { body } from 'express-validator';

// Validation rules for add/edit email actions
const addEditValidation = [
    body('title')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.email_actions.please_enter_title')),
    body('action')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.email_actions.please_enter_action')),
    body('options')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.email_actions.please_enter_options'))
];

export { addEditValidation }; 