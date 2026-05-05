import { body } from 'express-validator';

// Validation rules for add/edit email templates
const addEditValidation = [
    body('action')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.email_template.please_select_action')),
    body('subject_in_en')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.email_template.please_enter_subject_in_english')),
    body('subject_in_ar')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.email_template.please_enter_subject_in_arabic')),
    body('body_in_en')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.email_template.please_enter_email_body_in_english')),
    body('body_in_ar')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.email_template.please_enter_email_body_in_arabic')),
    body('from_to')
        .custom((value, { req }) => {
            if (!req.body.is_default && (!req.body.from_date || !req.body.to_date)) {
                throw new Error(req.__('admin.email_template.please_select_date_time'));
            }
            return true;
    })
];

export { addEditValidation }; 