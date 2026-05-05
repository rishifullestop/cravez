import { body } from 'express-validator';

// Post excuse validation rules
export const postExcuseValidation = (req) => [
    body('from')
        .notEmpty()
            .withMessage(() => {
                return req.__('driver_excuses.please_select_from_date');
            }),
    body('to')
        .notEmpty()
            .withMessage(() => {
                return req.__('driver_excuses.please_select_to_time');
            }),
    body('date')
        .notEmpty()
            .withMessage(() => {
                return req.__('driver_excuses.please_select_date');
            })
];