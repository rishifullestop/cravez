import { body } from 'express-validator';
import * as Constants from '../../../config/global_constant.mjs';

// Validation rules for quality monitor form
const qualityMonitorFormValidation = [
    body('agent_id')
        .notEmpty()
            .withMessage((value, { req }) => req.__('admin.quality_monitor.please_select_agent_id')),
    body('team_leader_id')
        .notEmpty()
            .withMessage((value, { req }) => req.__('admin.quality_monitor.please_enter_team_leader_id')),
    body('customer_name')
        .notEmpty()
            .withMessage((value, { req }) => req.__('admin.quality_monitor.please_enter_customer_name')),
    body('phone_number')    
        .notEmpty()
            .withMessage((value, { req }) => req.__('admin.quality_monitor.please_enter_phone_number')),
    body('type_of_call')
        .notEmpty()
            .withMessage((value, { req }) => req.__('admin.quality_monitor.please_enter_type_of_call')),
    body('type_of_call_enquiry')
        .notEmpty()
            .withMessage((value, { req }) => req.__('admin.quality_monitor.please_enter_type_of_call_enquiry')),
    body('date_time')
        .notEmpty()
            .withMessage((value, { req }) => req.__('admin.quality_monitor.please_enter_date_time')),
    body('call_date_time')
        .notEmpty()
            .withMessage((value, { req }) => req.__('admin.quality_monitor.please_enter_call_date_time')),  
    body('monitored_by')
        .notEmpty()
            .withMessage((value, { req }) => req.__('admin.quality_monitor.please_enter_monitored_by')),
    body('team')
        .notEmpty()
            .withMessage((value, { req }) => req.__('admin.quality_monitor.please_enter_team')),
    body('phone_number')
        .notEmpty()
            .withMessage((value, { req }) => req.__('admin.quality_monitor.please_enter_phone_number'))
        .isLength(Constants.MOBILE_LENGTH_VALIDATION)
            .withMessage((value, { req }) => req.__('admin.quality_monitor.invalid_phone_number'))
        .isNumeric()
            .withMessage((value, { req }) => req.__('admin.quality_monitor.invalid_phone_number')),
];

// Validation rules for quality monitor one form
const qualityMonitorFormValidationOne = [
    body('agent_id')
        .notEmpty()
            .withMessage((value, { req }) => req.__('admin.quality_monitor.please_select_agent_id')),
    body('team_leader_id')
        .notEmpty()
            .withMessage((value, { req }) => req.__('admin.quality_monitor.please_enter_team_leader_id')),
    body('customer_name')
        .notEmpty()
            .withMessage((value, { req }) => req.__('admin.quality_monitor.please_enter_customer_name')),
    body('phone_number')    
        .notEmpty()
            .withMessage((value, { req }) => req.__('admin.quality_monitor.please_enter_phone_number')),
    body('type_of_call')
        .notEmpty()
            .withMessage((value, { req }) => req.__('admin.quality_monitor.please_enter_type_of_call')),
    body('type_of_call_enquiry')
        .notEmpty()
            .withMessage((value, { req }) => req.__('admin.quality_monitor.please_enter_type_of_call_enquiry')),
    body('date_time')
        .notEmpty()
            .withMessage((value, { req }) => req.__('admin.quality_monitor.please_enter_date_time')),
    body('call_date_time')
        .notEmpty()
            .withMessage((value, { req }) => req.__('admin.quality_monitor.please_enter_call_date_time')),  
    body('monitored_by')
        .notEmpty()
            .withMessage((value, { req }) => req.__('admin.quality_monitor.please_enter_monitored_by')),
    body('team')
        .notEmpty()
            .withMessage((value, { req }) => req.__('admin.quality_monitor.please_enter_team')),
    body('phone_number')
        .notEmpty()
            .withMessage((value, { req }) => req.__('admin.quality_monitor.please_enter_phone_number'))
        .isLength(Constants.MOBILE_LENGTH_VALIDATION)
            .withMessage((value, { req }) => req.__('admin.quality_monitor.invalid_phone_number'))
        .isNumeric()
            .withMessage((value, { req }) => req.__('admin.quality_monitor.invalid_phone_number')),
];

export { qualityMonitorFormValidation, qualityMonitorFormValidationOne }; 