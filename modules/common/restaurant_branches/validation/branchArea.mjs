import { body } from 'express-validator';

// Module add / edit validation rules
const addBranchAreaValidation = [
    body('area_id')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('branch_area.please_select_atleast_one_area');
        }),
];

export {
    addBranchAreaValidation
};