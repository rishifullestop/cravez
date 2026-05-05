import { body } from 'express-validator';
import * as Constants from '../../../../config/global_constant.mjs';

// add review rules
export const addReviewValidation = (req) => [
	body('rating')
		.notEmpty()
			.withMessage(() => req.__('orders.please_select_rating'))
		.isInt()
			.withMessage(() => req.__('orders.invalid_rating'))
		.custom((value) => value > Constants.MAX_RATTING)
			.withMessage(() => res.__("orders.rating_greater_than_zero",Constants.MAX_RATTING))
];