import { body } from 'express-validator';
import * as Constants from "../../../config/global_constant.mjs";

// Admin permission add/edit validation rules
const addEditValidation = [
    body('first_name')
        .trim()
        .notEmpty()
        .withMessage((value, { req, location, path }) => {
            return req.__('admin.admin_permissions.please_enter_first_name', { value, location, path });
        }),
    body('last_name')
        .trim()
        .notEmpty()
        .withMessage((value, { req, location, path }) => {
            return req.__('admin.admin_permissions.please_enter_last_name', { value, location, path });
        }),
    body('user_role')
        .notEmpty()
        .withMessage((value, { req, location, path }) => {
            return req.__('admin.admin_permissions.please_select_user_role', { value, location, path });
        }),
    body('email')
        .trim()
        .notEmpty()
        .withMessage((value, { req, location, path }) => {
            return req.__('admin.admin_permissions.please_enter_mail', { value, location, path });
        })
        .bail()
        .isEmail()
        .withMessage((value, { req, location, path }) => {
            return req.__('admin.admin_permissions.please_enter_valid_email_address', { value, location, path });
        }),
    body('module_ids')
        .notEmpty()
        .withMessage((value, { req, location, path }) => {
            return req.__('admin.admin_permissions.please_select_modules', { value, location, path });
        })
];

// Password validation rules for new admin
const passwordValidation = [
    body('password')
        .if((value, { req }) => !req?.params?.id || req.body.confirm_password)
        .notEmpty()
        .withMessage((value, { req, location, path }) => {
            return req.__('admin.admin_permissions.please_enter_password', { value, location, path });
        })
        .isLength(Constants.PASSWORD_LENGTH_VALIDATION)
        .withMessage((value, { req, location, path }) => {
            return req.__('admin.admin_permissions.password_length_should_be_minimum_6_character', { value, location, path });
        }),
    body('confirm_password')
        .if((value, { req }) => !req?.params?.id || req.body.password)
        .notEmpty()
        .withMessage((value, { req, location, path }) => {
            return req.__('admin.admin_permissions.please_enter_confirm_password', { value, location, path });
        })
        .isLength(Constants.PASSWORD_LENGTH_VALIDATION)
        .withMessage((value, { req, location, path }) => {
            return req.__('admin.admin_permissions.password_length_should_be_minimum_6_character', { value, location, path });
        })
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error(req.__('admin.admin_permissions.confirm_password_should_be_same_as_password'));
            }
            return true;
        })
];

// Code validation rules
const codeValidation = [
    body('code')
        .custom((value, { req, location, path }) => {
            if (value && isNaN(value)) {
                return req.__('admin.admin_permissions.please_enter_valid_code', { value, location, path });
            }
            return true;
        })
];

// Ticket category validation rules
const ticketCategoryValidation = [
    body('ticket_category')
        .if((value, { req }) => Constants.TICKET_CATEGORY_ALLOWED_ROLES.includes(req.body.user_role))
        .notEmpty()
        .withMessage((value, { req, location, path }) => {
            return req.__('admin.admin_permissions.please_select_ticket_category', { value, location, path });
        })
];

// Combine all validations for add
const addValidation = [
    ...addEditValidation,
    ...passwordValidation,
    ...codeValidation,
    ...ticketCategoryValidation
];

// Combine all validations for edit
const editValidation = [
    ...addEditValidation,
    ...codeValidation,
    ...passwordValidation,
    ...ticketCategoryValidation
];

// Assign team validations rules
const assignTeamValidation = [
    body('assign_users')
        .custom((value, { req }) => {
            const teamHeadStatus = req.params.team_head_status ? parseInt(req.params.team_head_status) : "";
            if (!value && teamHeadStatus == Constants.ACTIVE) {
                throw new Error(req.__('admin.admin_permissions.please_select_user'));
            }
            return true;
        }),
    body('shift_user')
        .custom((value, { req }) => {
            const teamHeadStatus = req.params.team_head_status ? parseInt(req.params.team_head_status) : "";
            if (!value && teamHeadStatus != Constants.ACTIVE) {
                throw new Error(req.__('admin.admin_permissions.please_select_user'));
            }
            return true;
        })
];

export {
    addValidation,
    editValidation,
    assignTeamValidation
};