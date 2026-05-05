import { body } from 'express-validator';
import { ObjectId } from 'mongodb';
import Tables from '../../../config/database_tables.mjs';
import { getDb } from '../../../config/connection.mjs';
import * as Constants from "../../../config/global_constant.mjs";
let validRegx 	= /^[0-9a-zA-Z ]+$/;
let validArRegx = /^([0-9a-zA-Z ]|[\u0600-\u06ff]|[\u0750-\u077f]|[\ufb50-\ufbc1]|[\ufbd3-\ufd3f]|[\ufd50-\ufd8f]|[\ufd92-\ufdc7]|[\ufe70-\ufefc]|[\ufdf0-\ufdfd])*$/;


// Module add / edit validation rules
const addEditValidation = [
    body('title_in_english')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.offer_management.please_enter_title_in_english');
            })
            .custom((value, { req }) => {
                if (!validRegx.test(value)) {
                    throw new Error(req.__('admin.offer_management.please_enter_valid_title_in_english'));
                }
                return true;
            }),
    body('title_in_arabic')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.offer_management.please_enter_title_in_arabic');
            })
            .custom((value, { req }) => {
                if (!validArRegx.test(value)) {
                    throw new Error(req.__('admin.offer_management.please_enter_valid_title_in_arabic'));
                }
                return true;
            }),
    body('description_in_english')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.offer_management.please_enter_description_in_english');
            }),
    body('description_in_arabic')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.offer_management.please_enter_description_in_arabic');
            }),
    body('offer_code')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.offer_management.please_enter_offer_code');
            })
            .custom((value, { req, res, next }) => {
                if(value && req.body.number_of_offers && req.body.offer_code.length != Constants.RANDOM_OFFER_CODE_MAX_CHARACTER){
                    return Promise.reject(req.__("admin.offer_management.offer_code_allowed_three_characters_only",Constants.RANDOM_OFFER_CODE_MAX_CHARACTER));
                }else if(value){
                    return validateOfferCode(value,req).then(quRes=>{
                        if(quRes.status != Constants.STATUS_SUCCESS) {
                            let numberOfOffers = req.body.number_of_offers ?  req.body.number_of_offers : 0;
                            let msg =  (numberOfOffers > 0) ? req.__("admin.offer_management.generated_offer_code_already_exists") : req.__("admin.offer_management.whoops_you_have_entered_an_already_used_offer_code_please_try_something_different")

                            return Promise.reject(msg);
                        }else{
                            return true;
                        }
                    }).catch(next);
                }
                return true;
            }),
    body('offer_type')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.offer_management.please_select_offer_type');
            }),
    body('valid_till')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.offer_management.please_select_valid_till');
            }),
    body('offer_sub_type')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.offer_management.please_select_offer_sub_type');
            }),

    body('offer_discount_for_restaurant')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.offer_management.please_enter_offer_discount_for_restaurant');
            })
        .isFloat()
            .withMessage((value, { req }) => {
                return req.__('admin.offer_management.please_enter_valid_offer_discount_for_restaurant');
            })
        .custom((value, { req }) => {
            if (value && (isNaN(value) || parseFloat(value) <= 0 || parseFloat(value) > Constants.MAX_PERCENTAGE)) {
                throw new Error(req.__('admin.offer_management.please_enter_valid_offer_discount_for_restaurant'));
            }
            return true;
        }),

    // Conditional validation for non-combo offers
    body('offer_value')
        .custom((value, { req }) => {
            if (req.body.offer_type !== Constants.COMBO_OFFER) {
                if (!value) {
                    throw new Error(req.__('admin.offer_management.please_enter_offer_value'));
                }
                if (isNaN(value) || parseFloat(value) <= 0) {
                    throw new Error(req.__('admin.offer_management.please_enter_valid_offer_value'));
                }
            }
            return true;
        }),
    body('discount_type')
        .custom((value, { req }) => {
            if (req.body.offer_type !== Constants.COMBO_OFFER) {
                if (!value) {
                    throw new Error(req.__('admin.offer_management.please_select_discount_type'));
                }
            }
            return true;
        }),

    // Conditional validation for combo offers
    body('minimum_items')
        .custom((value, { req }) => {
            if (req.body.offer_type === Constants.COMBO_OFFER) {
                if (!value) {
                    throw new Error(req.__('admin.offer_management.please_enter_minimum_items'));
                }
                if (isNaN(value) || parseFloat(value) <= 0) {
                    throw new Error(req.__('admin.offer_management.please_enter_valid_minimum_items'));
                }
            }
            return true;
        }),

    body('item_offer_type')
        .custom((value, { req }) => {
            if (req.body.offer_type === Constants.COMBO_OFFER) {
                if (!value) {
                    throw new Error(req.__('admin.offer_management.please_select_item_offer_type'));
                }
            }
            return true;
        }),

    body('restaurant_ids')
        .custom((value, { req }) => {
            if (req.body.offer_type === Constants.COMBO_OFFER || req.body.listed_on_my_offer) {
                if (!value || value.length === 0) {
                    throw new Error(req.__('admin.offer_management.please_select_restaurant_id'));
                }

                if(req.body.listed_on_my_offer && value.length > 1){
                    throw new Error(req.__('admin.offer_management.you_cannot_select_restaurant_id_more_than_one'));
                }
            }
            return true;
        }),

    body('branch_ids')
        .custom((value, { req }) => {
            if (req.body.offer_type === Constants.COMBO_OFFER || req.body.listed_on_my_offer) {
                if (!value || value.length === 0) {
                    throw new Error(req.__('admin.offer_management.please_select_branch_id'));
                }

                if(req.body.listed_on_my_offer && value.length > 1){
                    throw new Error(req.__('admin.offer_management.you_cannot_select_branch_id_more_than_one'));
                }
            }
            return true;
        }),

    body('category_ids')
        .custom((value, { req }) => {
            if (req.body.offer_type === Constants.COMBO_OFFER || (req.body.listed_on_my_offer && !req.body.redirect_to_details)) {
                if (!value || value.length === 0) {
                    throw new Error(req.__('admin.offer_management.please_select_category_id'));
                }

                if(req.body.listed_on_my_offer && value.length > 1){
                    throw new Error(req.__('admin.offer_management.you_cannot_select_category_id_more_than_one'));
                }
            }
            return true;
        }),

    // Conditional validation for discount price in combo offers
    body('discount_price')
        .custom((value, { req }) => {
            if (req.body.offer_type === Constants.COMBO_OFFER &&
                (!req.body.item_offer_type || req.body.item_offer_type === Constants.GENERAL_ITEM_OFFER)) {
                if (!value) {
                    throw new Error(req.__('admin.offer_management.please_enter_discount_price'));
                }
                if (isNaN(value) || parseFloat(value) <= 0) {
                    throw new Error(req.__('admin.offer_management.please_enter_valid_discount_price'));
                }
            }
            return true;
        }),

    // Conditional validation for offer max amount when discount type is percentage
    body('offer_max_amount')
        .custom((value, { req }) => {
            if (req.body.discount_type === Constants.DISCOUNT_TYPE_PERCENTAGE) {
                if (!value) {
                    throw new Error(req.__('admin.offer_management.please_enter_offer_max_amount'));
                }
                if (isNaN(value) || parseFloat(value) <= 0) {
                    throw new Error(req.__('admin.offer_management.please_enter_valid_offer_max_amount'));
                }
            }
            return true;
        }),

    // Conditional validation for display order when display offer is true
    body('display_order')
        .custom((value, { req }) => {
            if (req.body.display_offer) {
                if (!value) {
                    throw new Error(req.__('admin.offer_management.please_enter_display_order'));
                }
                if (isNaN(value) || parseInt(value) <= 0) {
                    throw new Error(req.__('admin.offer_management.please_enter_valid_display_order'));
                }
            }
            return true;
        }),

    // Conditional validation for total redeem
    body('total_redeem')
        .custom((value, { req }) => {
            if (value && (isNaN(value) || parseInt(value) <= 0)) {
                throw new Error(req.__('admin.offer_management.please_enter_valid_total_redeem'));
            }
            return true;
        }),

    // Conditional validation for total unique redeem
    body('total_unique_redeem')
        .custom((value, { req }) => {
            if (value && (isNaN(value) || parseInt(value) <= 0)) {
                throw new Error(req.__('admin.offer_management.please_enter_valid_total_unique_redeem'));
            }
            return true;
        }),

    // Conditional validation for number of members when applicable for new users
    body('number_of_members')
        .custom((value, { req }) => {
            if (req.body.applicable_for && req.body.applicable_for.indexOf(Constants.APPLICABLE_FOR_NEW_USERS) !== -1) {
                if (!value) {
                    throw new Error(req.__('admin.offer_management.please_enter_number_of_members'));
                }
                if (isNaN(value) || parseInt(value) <= 0) {
                    throw new Error(req.__('admin.offer_management.please_enter_valid_number_of_members'));
                }
            }
            return true;
        }),

    // Conditional validation for item ids when listed on my offer
    body('item_ids')
        .custom((value, { req }) => {
            if (req.body.listed_on_my_offer && (!req.body.redirect_to_details &&
                (req.body.offer_type !== Constants.COMBO_OFFER) || req.body.item_offer_type === Constants.GENERAL_ITEM_OFFER)) {
                if (!value || value.length === 0) {
                    throw new Error(req.__('admin.offer_management.please_select_item_id'));
                }
            }
            return true;
        }),

    // Custom validation for offer value percentage limit
    body('offer_value')
        .custom((value, { req }) => {
            if (req.body.discount_type === Constants.DISCOUNT_TYPE_PERCENTAGE && parseFloat(value) > Constants.MAX_PERCENTAGE) {
                throw new Error(req.__('admin.offer_management.please_enter_valid_offer_value'));
            }
            return true;
        }),

    // Custom validation for min amount
    body('min_amount')
        .custom((value, { req }) => {
            if (req.body.offer_type !== Constants.COMBO_OFFER && value && (isNaN(value) || parseFloat(value) < 0)) {
                throw new Error(req.__('admin.offer_management.please_enter_valid_min_amount'));
            }
            return true;
        }),

    // Custom validation for max amount
    body('max_amount')
        .custom((value, { req }) => {
            if(req.body.offer_type !== Constants.COMBO_OFFER){
                if (value && (isNaN(value) || parseFloat(value) <= 0)) {
                    throw new Error(req.__('admin.offer_management.please_enter_valid_max_amount'));
                }else if (req.body.min_amount && parseFloat(value) <= parseFloat(req.body.min_amount)) {
                    throw new Error(req.__('admin.offer_management.max_amount_should_be_greater_than_min_amount'));
                }
            }
            return true;
        }),

    body('number_of_offers')
        .custom((value, { req }) => {
            if (value && (isNaN(value) || parseFloat(value) <= 0)) {
                throw new Error(req.__("admin.offer_management.please_enter_valid_number_of_offers"));
            }
            return true;
        }),
    body('kfg_offer_name')
        .custom((value, { req }) => {
            if (!value && req.body.kfg_offer_id) {
                throw new Error(req.__("admin.corporate_tie_ups.please_enter_kfg_offer_name"));
            }
            return true;
        }),
    body('kfg_offer_id')
        .custom((value, { req }) => {
            if (!value && req.body.kfg_offer_id) {
                throw new Error(req.__("admin.corporate_tie_ups.please_enter_kfg_offer_id"));
            }
            return true;
        })
];

/**
 * Validate if offer code already exists
 * @param {Object} db - Database instance
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {String} offerCode - Offer code for edit case
 * @returns {Promise<Array>} Array of validation errors
 */
const validateOfferCode = async (value,req) => {
    const offerCode     =   req.body?.offer_code || "";
    let numberOfOffers  =   req.body?.number_of_offers || 0;
    let offerCodeArray  =   [offerCode];

    if(numberOfOffers > 0){
        for(var i=1; i<=numberOfOffers; i++){
            let tmp = "";
            if(i < 10){
                tmp = offerCode+"00"+i;
            }else if(i > 100){
                tmp = offerCode+i;
            }else {
                tmp = offerCode+"0"+i;
            }
            offerCodeArray.push(tmp);
        }
    }

    let conditions = {offer_code: {$in: offerCodeArray}};
    if(req.params && req.params.id) conditions["_id"] = {$ne: new ObjectId(req.params.id)};

    // Find existing offer with same code
    const dbInstance = getDb();
    const existingOffer = await dbInstance.collection(Tables.OFFERS).countDocuments(conditions);

    return {
        status: existingOffer > 0 && Constants.STATUS_ERROR || Constants.STATUS_SUCCESS
    }
};

export {
    addEditValidation
};