import { body } from 'express-validator';

// inout shift validation rules
export const inOutShiftValidation = (req) => [
    body('km')
        .notEmpty()
            .withMessage(() => {
                return req.__('driver_break.please_enter_kilometers');
            })
        .isFloat()
            .withMessage(() => {
                return req.__('driver_break.please_enter_valid_kilometers');
            })
        .custom((value) => {
            if (value && value <=0) {
                return Promise.reject(req.__('driver_shifts.km_should_be_greater_than_zero'));
            }
            return true;
        }),
    body('latitude')
        .custom((value) => {
            if (!value || !req?.body?.longitude) {
                return Promise.reject(req.__('driver_break.whoops_its_seems_we_are_not_able_to_get_your_location'));
            }
            return true;
        })
];

// post driver service validation rules
export const postServiceValidation = (req) => [
    body('kilometers')
        .notEmpty()
            .withMessage(() => {
                return req.__('driver_break.please_enter_kilometers');
            })
        .isFloat()
            .withMessage(() => {
                return req.__('driver_break.please_enter_valid_kilometers');
            })
        .custom((value) => {
            if (value && value <=0) {
                return Promise.reject(req.__('driver_shifts.km_should_be_greater_than_zero'));
            }
            return true;
        }),
    body('next_service_date')
        .notEmpty()
            .withMessage(() => {
                return req.__('driver_break.please_select_next_service_date');
            })
];

// post driver fueling validation rules
export const postFuelingValidation = (req) => [
    body('kilometers')
        .notEmpty()
            .withMessage(() => {
                return req.__('driver_break.please_enter_kilometers');
            })
        .isFloat()
            .withMessage(() => {
                return req.__('driver_break.please_enter_valid_kilometers');
            })
        .custom((value) => {
            if (value && value <=0) {
                return Promise.reject(req.__('driver_shifts.km_should_be_greater_than_zero'));
            }
            return true;
        }),
    body('amount')
        .notEmpty()
            .withMessage(() => {
                return req.__('driver_break.please_enter_amount');
            })
        .isFloat()
            .withMessage(() => {
                return req.__('driver_break.please_enter_valid_amount');
            })
];