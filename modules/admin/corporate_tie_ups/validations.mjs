import { body } from 'express-validator';

// Validation rules for add/edit corporate tie up
const addEditValidation = [
    body('corporate_name_in_english')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.corporate_tie_ups.please_enter_corporate_name_in_english')),
    body('corporate_name_in_arabic')
        .notEmpty()
        .withMessage((value, { req }) => req.__('admin.corporate_tie_ups.please_enter_corporate_name_in_arabic')),
    body('min_order_amount').custom((value, { req }) => {
        if (req.body.free_delivery && (!req.body.min_order_amount || isNaN(req.body.min_order_amount) || req.body.min_order_amount <= 0)) {
            throw new Error(`min_order_amount|${req.__('admin.corporate_tie_ups.please_enter_valid_min_order_amount')}`);
        }
        return true;
    }),
    body('kfg_offer_name').custom((value, { req }) => {
        if (!value && req.body.kfg_offer_id) {
            throw new Error(`kfg_offer_name|${req.__('admin.corporate_tie_ups.please_enter_kfg_offer_name')}`);
        }
        return true;
    }),
    body('kfg_offer_id').custom((value, { req }) => {
        if (!value && req.body.kfg_offer_name) {
            throw new Error(`kfg_offer_id|${req.__('admin.corporate_tie_ups.please_enter_kfg_offer_id')}`);
        }
        return true;
    })
];

export {
    addEditValidation
};