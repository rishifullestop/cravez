import { body } from 'express-validator';
import * as Constants from '../../../config/global_constant.mjs';

const addEditValidation = [
	body('min_order_amount')
		.custom((value, { req }) => {
			if (req.body.free_delivery) {
				if (!value) {
					throw new Error(req.__('admin.public_composite.please_enter_min_order_amount'));
				}
				const num = parseFloat(value);
				if (isNaN(num) || num <= 0) {
					throw new Error(req.__('admin.public_composite.please_enter_valid_min_order_amount'));
				}
			}
			return true;
		}),
	body('kfg_offer_name')
		.custom((value, { req }) => {
			const hasId = !!req.body.kfg_offer_id;
			const hasName = !!req.body.kfg_offer_name;
			if (hasId || hasName) {
				if (!hasName) {
					throw new Error(req.__('admin.corporate_tie_ups.please_enter_kfg_offer_name'));
				}
			}
			return true;
		}),
	body('kfg_offer_id')
		.custom((value, { req }) => {
			const hasId = !!req.body.kfg_offer_id;
			const hasName = !!req.body.kfg_offer_name;
			if (hasId || hasName) {
				if (!hasId) {
					throw new Error(req.__('admin.corporate_tie_ups.please_enter_kfg_offer_id'));
				}
			}
			return true;
		}),
];

export { addEditValidation };

