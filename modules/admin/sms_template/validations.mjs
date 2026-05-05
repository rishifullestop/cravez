import { body } from 'express-validator';

const addEditValidation = [
	body('sms_type')
		.custom((value, { req }) => {
			const isEditable = !!req.params.id;
			if (!isEditable) {
				if (!value) {
					throw new Error(req.__('admin.sms_templates.please_enter_sms_type'));
				}
				if (!/^(0*[1-9][0-9]*)$/.test(value)) {
					throw new Error(req.__('admin.sms_templates.sms_type_must_be_numeric_greater_then_zero'));
				}
			}
			return true;
		}),
	body('sms_event')
		.notEmpty()
		.withMessage((value, { req }) => req.__('admin.sms_templates.please_enter_sms_event')),
	body('message_en')
		.notEmpty()
		.withMessage((value, { req }) => req.__('admin.sms_templates.please_enter_message_en')),
	body('message_ar')
		.notEmpty()
		.withMessage((value, { req }) => req.__('admin.sms_templates.please_enter_message_ar'))
];

export {
	addEditValidation
};

