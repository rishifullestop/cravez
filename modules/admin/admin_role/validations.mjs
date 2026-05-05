import { body } from 'express-validator';

// Module add / edit validation rules
const addEditValidation = [
    body('role')
		.trim()
		.notEmpty()
		.withMessage((value, { req, location, path }) => {
            return req.__('admin.admin_role.please_enter_role', { value, location, path });
        }),
	body('module_ids')
		.notEmpty()
		.withMessage((value, { req, location, path }) => {
            return req.__('admin.admin_role.please_select_modules', { value, location, path });
        })
];

export {
    addEditValidation
};