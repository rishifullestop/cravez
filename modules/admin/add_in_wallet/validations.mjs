import { body } from 'express-validator';
import { ObjectId } from 'mongodb';
import Tables from "../../../config/database_tables.mjs";
import * as Constants from "../../../config/global_constant.mjs";
import { getDb } from "../../../config/connection.mjs";

/**
 * Validation for add wallet
 */
export const addWalletValidation = [
    body('offer_name_in_english')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.add_in_wallet.please_enter_offer_name_in_english')
            }),    
    body('offer_name_in_arabic')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.add_in_wallet.please_enter_offer_name_in_arabic')
            }),
    body('client_criteria')
            .notEmpty()
                .withMessage((value, { req }) => {
                    return req.__('admin.add_in_wallet.please_select_client_criteria')
                }),
    body('account_criteria')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.add_in_wallet.please_select_account_criteria')
            }),
    body('account_criteria_amount')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.add_in_wallet.please_enter_account_criteria_amount')
            })
        .isNumeric()
            .withMessage((value, { req }) => {
                return req.__('admin.add_in_wallet.please_enter_valid_account_criteria_amount')
            })
        .custom((value, { req, res, next }) => {
            if (value <=0) {
                return Promise.reject(req.__('admin.add_in_wallet.please_enter_valid_account_criteria_amount'));
            }            
            return true;
        }),
    body('valid_till')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.add_in_wallet.please_select_valid_till')
            }),
    body('amount')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.add_in_wallet.please_enter_amount')
            })
        .isNumeric()
            .withMessage((value, { req }) => {
                return req.__('admin.add_in_wallet.please_enter_valid_amount')
            })
        .custom((value, { req, res, next }) => {
            if (value <=0) {
                return Promise.reject(req.__('admin.add_in_wallet.please_enter_valid_amount'));
            }            
            return true;
        }),
    body('order_criteria_type')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.add_in_wallet.please_select_order_criteria_type')
            }),
    body('offer_code')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.add_in_wallet.please_enter_offer_code')
            })
        .custom((value, { req, res, next }) => {
            if (value) {
                return checkOfferCodeUnique(value,req).then(quRes=>{
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('admin.add_in_wallet.whoops_you_have_entered_an_already_used_offer_code_please_try_something_different'));
                    }
                    return true;
                }).catch(next);
            }            
            return true;
        }),
    body('order_criteria')
        .custom((value, { req, res, next }) => {
            if (req.body.order_criteria_type == Constants.ORDER_CRITERIA_TYPE_ORDER_AMOUNT && !value) {
                return Promise.reject(req.__('admin.add_in_wallet.please_select_order_criteria'));
            }            
            return true;
        }),
    body('order_criteria_amount')
        .custom((value, { req, res, next }) => {
            if (req.body.order_criteria_type == Constants.ORDER_CRITERIA_TYPE_ORDER_AMOUNT) {
                if (!value) {   
                    return Promise.reject(req.__('admin.add_in_wallet.please_enter_order_criteria_amount'));
                }else if (value <=0) {
                    return Promise.reject(req.__('admin.add_in_wallet.please_enter_valid_order_criteria_amount'));
                }
            }    
            return true;
        }),
    body('number_of_orders')
        .custom((value, { req, res, next }) => {
            if (req.body.order_criteria_type == Constants.ORDER_CRITERIA_TYPE_NO_OF_ORDERS) {
                if (!value) {
                    return Promise.reject(req.__('admin.add_in_wallet.please_enter_number_of_orders'));
                }else if (value && (value <= 0 || !Constants.VALID_NUMBER_REGEX.test(value))) {
                    return Promise.reject(req.__('admin.add_in_wallet.please_enter_valid_number_of_orders'));
                }
            }    
            return true;
        }),
]; 

/**
 * Validate if ticket no already exists
 * @param {Object} db - Database instance
 * @param {Object} req - Request object
 * @returns {Promise<Array>} Array of validation errors
 */
const checkOfferCodeUnique = async (value,req) => {
    /** Set conditions */
    let conditions = {offer_code: value};
    if(req.params && req.params.id) conditions["_id"] = {$ne: new ObjectId(req.params.id)};

    // Find existing offer code with same offer code
    const dbInstance = getDb();
    const existingOfferCode = await dbInstance.collection(Tables.ADD_IN_WALLET_LOGS).findOne(conditions, {projection: {_id: 1}});

    return {
        status: existingOfferCode && existingOfferCode._id && Constants.STATUS_ERROR || Constants.STATUS_SUCCESS
    }
};