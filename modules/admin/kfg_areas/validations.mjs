import { body } from 'express-validator';

const assignAreaValidation = [
	body('area_id')
		.notEmpty()
		.withMessage((value, { req }) => {
			return req.__('admin.kfg_areas.please_select_area');
		})
];

const assignBlockValidation = [
	body('block_id')
		.notEmpty()
		.withMessage((value, { req }) => {
			return req.__('admin.kfg_areas.please_select_block');
		})
];

export {
	assignAreaValidation,
	assignBlockValidation
};

