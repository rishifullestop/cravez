import { body } from 'express-validator';

// Add / edit banner validation rules
const addEditValidation = [
	body('page_name')
		.notEmpty()
		.withMessage((value, { req }) => {
			return req.__('admin.banner_management.please_select_page_name');
		}),
	body('image')
		.custom((value, { req }) => {
			// On create (no id), image is required
			const isEditable = !!(req.params && req.params.id);
			if (!isEditable && (!req.files || !req.files.image)) {
				throw new Error(req.__('admin.banner_management.please_select_image'));
			}
			return true;
		})
];

export {
	addEditValidation
};


