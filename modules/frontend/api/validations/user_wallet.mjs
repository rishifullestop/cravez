import { body } from 'express-validator';
import * as Constants from '../../../../config/global_constant.mjs';

// transfer balance validation rules
export const transferBalanceValidation = (req) => [
	body('mobile_number')
		.notEmpty()
			.withMessage(() => req.__('user.please_enter_mobile_number'))
		.isNumeric()
			.withMessage(() => req.__('user.invalid_mobile_number'))
		.isLength(Constants.MOBILE_LENGTH_VALIDATION)
			.withMessage(() => req.__('user.invalid_mobile_number')),
	body('confirm_mobile_number')
		.notEmpty()
			.withMessage(() => req.__('user.please_enter_confirm_mobile_number'))
		.custom((value) => value === req.body.mobile_number)
			.withMessage(() => req.__('user_wallet.mobile_number_should_be_matched'))
];