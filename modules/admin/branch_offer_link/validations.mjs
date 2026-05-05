import { body } from 'express-validator';

const addEditValidation = [
    body('restaurant_id')
        .notEmpty()
        .withMessage((value, { req }) => req.__("admin.branch_offer_link.please_select_restaurant")),
    body('branch_ids')
        .notEmpty()
        .withMessage((value, { req }) => req.__("admin.branch_offer_link.please_select_branch")),
    body('area_id')
        .notEmpty()
        .withMessage((value, { req }) => req.__("admin.branch_offer_link.please_select_area")),
];

export {
    addEditValidation
}; 