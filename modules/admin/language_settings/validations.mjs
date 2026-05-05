import { body } from 'express-validator';
import * as Constants from '../../../config/global_constant.mjs';

// Validation rules for add / edit text settings via /language_settings
const addEditValidation = [
	body('key')
		.notEmpty()
		.withMessage((value, { req }) => {
			return req.__('Please enter key.');
		}),
	body('value')
		.custom((value, { req }) => {
			const val =req?.body?.text_settings_descriptions?.[Constants.DEFAULT_LANGUAGE_MONGO_ID]?.value || "";
			if (!val) {
				throw new Error(req.__('Please enter value.'));
			}
			return true;
		})
];

export {
	addEditValidation
};

