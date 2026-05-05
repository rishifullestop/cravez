import { body } from 'express-validator';

// assignCaptain validation rules
export const assignCaptainValidation = (req) => [
	body('captain_name').notEmpty().withMessage(() => req.__('orders.please_enter_captain_name')),
	body('captain_number')
		.notEmpty().withMessage(() => req.__('orders.please_enter_captain_number'))
		.isNumeric().withMessage(() => req.__('orders.invalid_phone_number'))
];

// rejectOrderRequest validation rules
export const rejectOrderRequestValidation = (req) => [
	body('rejection_reason').notEmpty().withMessage(() => req.__('orders.please_enter_rejection_condition'))
];
