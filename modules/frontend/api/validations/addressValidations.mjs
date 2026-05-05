import { body } from 'express-validator';
import { ObjectId } from 'mongodb';

// Customer address add/edit validation rules
export const addEditAddressValidation = (req) => [
    body('first_name')
        .notEmpty()
            .withMessage(() => {
                return req.__('customer_address.please_enter_first_name');
            }),
    body('last_name')
        .notEmpty()
            .withMessage(() => {
                return req.__('customer_address.please_enter_last_name');
            }),
    body('mobile_number')
        .notEmpty()
            .withMessage(() => {
                return req.__('customer_address.please_enter_mobile_number');
            })
        .isNumeric()
            .withMessage(() => {
                return req.__('customer_address.invalid_phone_number');
            }),
    body('latitude')
        .notEmpty()
            .withMessage(() => {
                return req.__('customer_address.please_enter_latitude');
            })
        .isNumeric()
            .withMessage(() => {
                return req.__('customer_address.please_enter_valid_latitude');
            }),
    body('longitude')
        .notEmpty()
            .withMessage(() => {
                return req.__('customer_address.please_enter_longitude');
            })
        .isNumeric()
            .withMessage(() => {
                return req.__('customer_address.please_enter_valid_longitude');
            }),
    body('street')
        .notEmpty()
            .withMessage(() => {
                return req.__('customer_address.please_enter_street');
            }),
    body('address_title')
        .notEmpty()
            .withMessage(() => {
                return req.__('customer_address.please_enter_address_title');
            }),
    body('building_number')
        .notEmpty()
            .withMessage(() => {
                return req.__('customer_address.please_enter_building_number');
            }),
    body('address_type')
        .notEmpty()
            .withMessage(() => {
                return req.__('customer_address.please_enter_address_type');
            }),
    body('city_id')
        .notEmpty()
            .withMessage(() => {
                return req.__('customer_address.please_select_city');
            })
        .custom(value => {
            if(value && !ObjectId.isValid(value)){
                return Promise.reject(req.__('customer_address.please_select_city'));
            }
            return true;
        }),
    body('area_id')
        .notEmpty()
            .withMessage(() => {
                return req.__('customer_address.please_select_area');
            })
        .custom(value => {
            if(value && !ObjectId.isValid(value)){
                return Promise.reject(req.__('customer_address.please_select_area'));
            }
            return true;
        }),
    body('block_id')
        .notEmpty()
            .withMessage(() => {
                return req.__('customer_address.please_select_block');
            })
        .custom(value => {
            if(value && !ObjectId.isValid(value)){
                return Promise.reject(req.__('customer_address.please_select_block'));
            }
            return true;
        }),
    body('landline_number')
        .custom(value => {
            if(value && isNaN(value)){
                return Promise.reject(req.__('customer_address.invalid_landline_number'));
            }
            return true;
        })
];