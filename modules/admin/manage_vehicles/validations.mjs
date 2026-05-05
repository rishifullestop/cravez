import { body } from 'express-validator';
import * as Constants from "../../../config/global_constant.mjs";

// Module add / edit validation rules
const addEditValidation = [
    body('driver_id')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.manage_vehicles.please_select_driver');
        }),
    body('plate_number')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.manage_vehicles.please_enter_plate_number');
        }),
    body('vehicle_type')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.manage_vehicles.please_select_vehicle_type');
        }),
    body('status')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.manage_vehicles.please_select_status');
        }),
    body('location')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.manage_vehicles.please_enter_location');
        }),
    body('year')
        .custom((value, { req }) => {
            if (value && (isNaN(value) || value.length != Constants.YEAR_LIMIT)) {
                return Promise.reject(req.__('admin.manage_vehicles.please_enter_valid_year'));
            }
            return true;
        }),
    body('licence')
        .custom((value, { req }) => {            
            if (!req?.params?.id && !req?.files?.licence) {
                return Promise.reject(req.__('admin.manage_vehicles.please_select_licence'));
            }            
            return true;
        })
];

export {
    addEditValidation
}; 