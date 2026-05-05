import { body } from 'express-validator';

// Module add request validation rules
const addRequestValidation = [
    body('note')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('import_managers.please_enter_note');
            }),
    body('imported_file')
        .custom((value, { req }) => {
            if (!req?.files?.imported_file) {
                return Promise.reject(req.__('import_managers.please_select_file'));
            }
            return true;
        }),
];

export {
    addRequestValidation
}; 