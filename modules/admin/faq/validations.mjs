import { body } from 'express-validator';

// Module add / edit validation rules
const addEditValidation = [
    body('category_id')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.faq.please_select_category');
        }),
    body('sub_category_id')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.faq.please_select_sub_category');
        }),
    body('question_in_english')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.faq.please_enter_faq_question_in_english');
        }),
    body('question_in_arabic')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.faq.please_enter_faq_question_in_arabic');
        }),
    body('answer_in_english')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.faq.please_enter_faq_answer_in_english');
        }),
    body('answer_in_arabic')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.faq.please_enter_faq_answer_in_arabic');
        }),
    body('faq_channel')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.faq.please_select_faq_channel');
        })
];

export {
    addEditValidation
}; 