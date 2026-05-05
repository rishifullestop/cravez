import { body } from 'express-validator';
import * as Constants from "../../../config/global_constant.mjs";

// Validation rules for add/edit CMS
const addEditValidation = [
    body('pages_descriptions').custom((value, { req }) => {
        const langId = Constants.DEFAULT_LANGUAGE_MONGO_ID;
        if (!value || !value[langId] || value[langId] === '') {
            throw new Error(req.__("admin.system.something_going_wrong_please_try_again"));
        }
        return true;
    }),
    body('pages_descriptions.*.name')
        .notEmpty()
        .withMessage((value, { req }) => req.__("admin.cms.please_enter_page_name")),
    body('pages_descriptions.*.body')
        .notEmpty()
        .withMessage((value, { req }) => req.__("admin.cms.please_enter_page_description"))   
];

export {
    addEditValidation,
}; 