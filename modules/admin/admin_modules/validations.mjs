import { body } from 'express-validator';

// Module add / edit validation rules
const addEditValidation = [
    body('title')
		.trim()
		.notEmpty()
		.withMessage((value, { req, location, path }) => {
            return req.__('admin.admin_module.please_enter_title', { value, location, path });
        }),
	body('path')
		.trim()
		.notEmpty()
		.withMessage((value, { req, location, path }) => {
            return req.__('admin.admin_module.please_enter_path', { value, location, path });
        }),
	body('group_path')
		.trim()
		.notEmpty()
		.withMessage((value, { req, location, path }) => {
            return req.__('admin.admin_module.please_enter_group_path', { value, location, path });
        }),
	body('order')
		.notEmpty()
		.withMessage((value, { req, location, path }) => {
            return req.__('admin.admin_module.please_enter_order', { value, location, path });
        })
		.bail()
		.isNumeric()
		.withMessage((value, { req, location, path }) => {
            return req.__('admin.admin_module.order_must_be_numeric', { value, location, path });
        })
		.bail()
		.matches(/^(0*[1-9][0-9]*)$/)
		.withMessage((value, { req, location, path }) => {
            return req.__('admin.admin_module.order_must_be_greater_then_0', { value, location, path });
        }),
	body('slug')
		.trim()
		.notEmpty()
		.withMessage((value, { req, location, path }) => {
            return req.__('admin.admin_module.please_enter_slug', { value, location, path });
        })
];

// Module update order validation rules
const validateChangeOrder = [
	body('new_order')
		.notEmpty()
        .withMessage((value, { req, location, path }) => {
            return req.__('admin.admin_module.please_enter_order', { value, location, path });
        })
		.bail()
		.isNumeric()
		.withMessage((value, { req, location, path }) => {
            return req.__('admin.admin_module.order_must_be_numeric', { value, location, path });
        })
		.bail()
		.matches(/^(0*[1-9][0-9]*)$/)
		.withMessage((value, { req, location, path }) => {
            return req.__('admin.admin_module.order_must_be_greater_then_0', { value, location, path });
        }),
];



export {
    addEditValidation,
    validateChangeOrder
};
