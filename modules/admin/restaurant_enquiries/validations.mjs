import { body } from 'express-validator';
import { ObjectId } from 'mongodb';
import Tables from '../../../config/database_tables.mjs';
import { getDb } from '../../../config/connection.mjs';
import * as Constants from "../../../config/global_constant.mjs";

// Module reject enquiry validation
const rejectEnquiryValidation = [
    body('reject_msg')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.please_enter_rejection_condition');
            })
];

// Module add enquiry validation
const addEnquiryValidation = [
    body('restaurant_english_name')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.please_enter_restaurant_name_in_english');
            }),
    body('restaurant_arabic_name')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.please_enter_restaurant_name_in_arabic');
            }),
    body('restaurant_address')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.please_enter_restaurant_address');
            }),
    body('contact_number')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.please_enter_contract_number');
            })
        .isLength(Constants.MOBILE_LENGTH_VALIDATION)
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.invalid_phone_number');
            })
        .isNumeric()
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.invalid_phone_number');
            }),
    body('contact_person_name')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.please_enter_contact_person_name');
            }),
    body('account_manager_name')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.please_enter_account_manager_name');
            }),
    body('email_address')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.please_enter_email');
            })
        .isEmail()
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.please_enter_valid_email_address');
            }),
    body('file')
        .custom((value, { req }) => {
            if (!req?.files?.file){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_select_file'));
            }
            return true;
        }),
    body('landing_image')
        .custom((value, { req }) => {
            if (!req?.files?.landing_image){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_select_image'));
            }
            return true;
        }),
    body('restaurant_logo')
        .custom((value, { req }) => {
            if (!req?.files?.restaurant_logo){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_select_logo'));
            }
            return true;
        }),
    body('detail_image')
        .custom((value, { req }) => {
            if (!req?.files?.detail_image){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_select_detail_image'));
            }
            return true;
        }),
    body('restaurant_description')
        .custom((value, { req }) => {
            if (value && value?.trim()?.length > Constants.RESTAURANT_DESCRIPTION_MAX_LENGTH){
                return Promise.reject(req.__('admin.restaurant_enquiry.maximum_characters_allowed'));
            }
            return true;
        })
];


// Module approve enquiry validation
const approveEnquiryValidation = [
    body('thermal_layout_format')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.please_select_thermal_layout_format');
            }),
    body('restaurant_name_in_english')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.please_enter_restaurant_name_in_english');
            }),
    body('restaurant_name_in_arabic')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.please_enter_restaurant_name_in_arabic');
            }),
    body('contact_person_name')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.please_enter_contact_person_name');
            }),
    body('account_manager_name')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.please_enter_account_manager_name');
            }),
    body('phone_number')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.please_enter_phone_number');
            })
        .isLength(Constants.MOBILE_LENGTH_VALIDATION)
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.invalid_phone_number');
            })
        .isNumeric()
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.invalid_phone_number');
            })
        .custom((value, { req }) => {
            if (value){
                return validatePhone(value, req).then(quRes => {
                    if (quRes?.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('admin.restaurant_enquiry.phone_number_is_already_exist'));
                    } else {
                        return true;
                    }
                });
            }
            return true;
        }),
    body('email')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.please_enter_email');
            })
        .isEmail()
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.please_enter_valid_email_address');
            })
        .custom((value, { req }) => {
            if (value){
                return validateEmail(value, req).then(quRes => {
                    if (quRes?.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('admin.restaurant_enquiry.email_already_exists'));
                    } else {
                        return true;
                    }
                });
            }
            return true;
        }),
    body('address')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.please_enter_address');
            }),
    body('delivery_vehicle_type')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.please_select_atleast_one_vehicle_type');
            }),
    body('auto_assignment_start_after')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.please_enter_auto_assignment_start_after');
            })
        .isFloat()
            .withMessage((value, { req }) => {
                return req.__('admin.restaurant_enquiry.please_enter_valid_auto_assignment_start_after');
            })
        .custom((value, { req }) => {
            if (value && (isNaN(value) || value < 0)){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_enter_valid_auto_assignment_start_after'));
            }
            return true;
        }),
    body('auto_close_order_time')
        .custom((value, { req }) => {
            if (value && (isNaN(value) || value < 0)){
                return Promise.reject(req.__('admin.restaurant_enquiry.invalid_auto_close_order_time'));
            }
            return true;
        }),
    body('logo')
        .custom((value, { req }) => {
            if (!req.body.old_logo && !req?.files?.logo){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_select_logo'));
            }
            return true;
        }),
    body('landing_image')
        .custom((value, { req }) => {
            if (!req.body.old_landing_image && !req?.files?.landing_image){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_select_image'));
            }
            return true;
        }),
    body('detail_image')
        .custom((value, { req }) => {
            if (!req.body.old_detail_image && !req?.files?.detail_image){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_select_detail_image'));
            }
            return true;
        }),
    body('web_image')
        .custom((value, { req }) => {
            if (!req.body.old_web_image && !req?.files?.web_image){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_select_web_image'));
            }
            return true;
        }),
    body('delivery_by')
        .custom((value, { req }) => {
            let userRoleId		= req?.session?.user?.user_role_id || "";
			let isFinanceTeam	= (userRoleId == Constants.FINANCE_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;

            if (isFinanceTeam && !value){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_select_delivery_by'));
            }
            return true;
        }),
    body('payment_methods')
        .custom((value, { req }) => {
            let userRoleId		= req?.session?.user?.user_role_id || "";
			let isFinanceTeam	= (userRoleId == Constants.FINANCE_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;

            let isSelected = false;
            if(value &&  value.constructor !== Array) value = [value];
            value.forEach(element => {
                if(element.method) isSelected = true;
            });

            if (isFinanceTeam && !isSelected){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_select_at_least_one_payment_method'));
            }
            return true;
        }),
    body('commission_type')
        .custom((value, { req }) => {
            let userRoleId		= req?.session?.user?.user_role_id || "";
			let isFinanceTeam	= (userRoleId == Constants.FINANCE_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;
            let deliveryByArray = req.body.delivery_by || [];
            if(deliveryByArray.constructor !== Array) deliveryByArray = [deliveryByArray];

            if(!value && isFinanceTeam && deliveryByArray.indexOf(Constants.DELIVERY_BY_CRAVEZ) != -1){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_select_commission_type'));
            }
            return true;
        }),
    body('commission_criteria')
        .custom((value, { req }) => {
            let userRoleId		= req?.session?.user?.user_role_id || "";
			let isFinanceTeam	= (userRoleId == Constants.FINANCE_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;
            let deliveryByArray = req.body.delivery_by || [];
            if(deliveryByArray.constructor !== Array) deliveryByArray = [deliveryByArray];

            if(!value && isFinanceTeam && deliveryByArray.indexOf(Constants.DELIVERY_BY_CRAVEZ) != -1){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_select_commission_criteria'));
            }
            return true;
        }),
    body('restaurant_commission_type')
        .custom((value, { req }) => {
            let userRoleId		= req?.session?.user?.user_role_id || "";
			let isFinanceTeam	= (userRoleId == Constants.FINANCE_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;
            let deliveryByArray = req.body.delivery_by || [];
            if(deliveryByArray.constructor !== Array) deliveryByArray = [deliveryByArray];

            if(!value && isFinanceTeam && deliveryByArray.indexOf(Constants.DELIVERY_BY_CRAVEZ) != -1){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_select_commission_type'));
            }
            return true;
        }),
    body('restaurant_commission_criteria')
        .custom((value, { req }) => {
            let userRoleId		= req?.session?.user?.user_role_id || "";
			let isFinanceTeam	= (userRoleId == Constants.FINANCE_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;
            let deliveryByArray = req.body.delivery_by || [];
            if(deliveryByArray.constructor !== Array) deliveryByArray = [deliveryByArray];

            if(!value && isFinanceTeam && deliveryByArray.indexOf(Constants.DELIVERY_BY_RESTAURANT) != -1){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_select_commission_criteria'));
            }
            return true;
        }),
    body('pickup_commission_type')
        .custom((value, { req }) => {
            let userRoleId		= req?.session?.user?.user_role_id || "";
			let isFinanceTeam	= (userRoleId == Constants.FINANCE_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;

            if(!value && isFinanceTeam && req.body.pickup_enable){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_select_commission_type'));
            }
            return true;
        }),
    body('pickup_commission_criteria')
        .custom((value, { req }) => {
            let userRoleId		= req?.session?.user?.user_role_id || "";
			let isFinanceTeam	= (userRoleId == Constants.FINANCE_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;

            if(!value && isFinanceTeam && req.body.pickup_enable){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_select_commission_criteria'));
            }
            return true;
        }),
    body('beneficiary')
        .custom((value, { req }) => {
            let userRoleId		= req?.session?.user?.user_role_id || "";
			let isFinanceTeam	= (userRoleId == Constants.FINANCE_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;

            if (isFinanceTeam && !value){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_enter_beneficiary'));
            }
            return true;
        }),
    body('iban')
        .custom((value, { req }) => {
            let userRoleId		= req?.session?.user?.user_role_id || "";
			let isFinanceTeam	= (userRoleId == Constants.FINANCE_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;

            if (isFinanceTeam && !value){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_enter_iban'));
            }
            return true;
        }),
    body('bank_id')
        .custom((value, { req }) => {
            let userRoleId		= req?.session?.user?.user_role_id || "";
			let isFinanceTeam	= (userRoleId == Constants.FINANCE_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;

            if (isFinanceTeam && !value){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_select_bank'));
            }
            return true;
        }),
    body('bank_account')
        .custom((value, { req }) => {
            let userRoleId		= req?.session?.user?.user_role_id || "";
			let isFinanceTeam	= (userRoleId == Constants.FINANCE_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;

            if (isFinanceTeam && !value){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_enter_bank_account'));
            }
            return true;
        }),
    body('settlement_methods')
        .custom((value, { req }) => {
            let userRoleId		= req?.session?.user?.user_role_id || "";
			let isFinanceTeam	= (userRoleId == Constants.FINANCE_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;

            if (isFinanceTeam && !value){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_select_at_least_one_settlement_methods'));
            }
            return true;
        }),
    body('settlement_type')
        .custom((value, { req }) => {
            let userRoleId		= req?.session?.user?.user_role_id || "";
			let isFinanceTeam	= (userRoleId == Constants.FINANCE_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;

            if (isFinanceTeam && !value){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_select_settlement_type'));
            }
            return true;
        }),
    body('contract_number')
        .custom((value, { req }) => {
            let userRoleId		= req?.session?.user?.user_role_id || "";
			let isFinanceTeam	= (userRoleId == Constants.FINANCE_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;
            let isContentTeam	= (userRoleId == Constants.CONTENT_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;

            if ((isFinanceTeam || isContentTeam) && !value){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_enter_contract_number'));
            }
            return true;
        }),
    body('contract_date')
        .custom((value, { req }) => {
            let userRoleId		= req?.session?.user?.user_role_id || "";
            let isFinanceTeam	= (userRoleId == Constants.FINANCE_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;
            let isContentTeam	= (userRoleId == Constants.CONTENT_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;

            if ((isFinanceTeam || isContentTeam) && !value){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_select_contract_date'));
            }
            return true;
        }),
    body('effective_date')
        .custom((value, { req }) => {
            let userRoleId		= req?.session?.user?.user_role_id || "";
            let isFinanceTeam	= (userRoleId == Constants.FINANCE_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;
            let isContentTeam	= (userRoleId == Constants.CONTENT_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;

            if ((isFinanceTeam || isContentTeam) && !value){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_select_effective_date'));
            }
            return true;
        }),
    body('valid_from')
        .custom((value, { req }) => {
            let userRoleId		= req?.session?.user?.user_role_id || "";
            let isFinanceTeam	= (userRoleId == Constants.FINANCE_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;
            let isContentTeam	= (userRoleId == Constants.CONTENT_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;

            if ((isFinanceTeam || isContentTeam) && !value){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_select_valid_from'));
            }
            return true;
        }),
    body('expire_date')
        .custom((value, { req }) => {
            let userRoleId		= req?.session?.user?.user_role_id || "";
            let isFinanceTeam	= (userRoleId == Constants.FINANCE_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;
            let isContentTeam	= (userRoleId == Constants.CONTENT_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;

            if ((isFinanceTeam || isContentTeam) && !value){
                return Promise.reject(req.__('admin.restaurant_enquiry.please_select_expire_date'));
            }
            return true;
        }),
];

/**
 * Validate if email already exists
 * @param {String} value - Email to validate
 * @param {Object} req - Request object
 * @returns {Promise<Object>} Validation result
 */
const validateEmail = async (value, req) => {
    let restaurantId = req?.params?.restaurant_id || "";
    let conditions = {
        email       :   {$regex: "^" + value + "$", $options: "i"},
        is_deleted  :   Constants.NOT_DELETED
    };

    if(!restaurantId) restaurantId = await fetchRestaurantId(req);
    if(restaurantId) conditions.restaurant_id = { $ne: new ObjectId(restaurantId) };

    const dbInstance = getDb();
    const existingUserCount = await dbInstance.collection(Tables.USERS).countDocuments(conditions);

    return {
        status: existingUserCount ? Constants.STATUS_ERROR : Constants.STATUS_SUCCESS
    };
};

const fetchRestaurantId = async (req) => {
    try{
        if (req?.params?.restaurant_id) return req?.params?.restaurant_id;
        if (!req?.params?.id) return "";

        const dbInstance = getDb();
        const enquiryDetails = await dbInstance.collection(Tables.RESTAURANT_ENQUIRIES).findOne({_id : new ObjectId(req?.params?.id)},{projection: {restaurant_id: 1}});

        return enquiryDetails?.restaurant_id || "";
    }catch(err){
        return "";
    }
};

/**
 * Validate if phone already exists
 * @param {String} value - Phone to validate
 * @param {Object} req - Request object
 * @returns {Promise<Object>} Validation result
 */
const validatePhone = async (value, req) => {
    let restaurantId = req?.params?.restaurant_id || "";
    let conditions = {
        mobile_number: value,
        is_deleted: Constants.NOT_DELETED
    };

    if(!restaurantId) restaurantId = await fetchRestaurantId(req);
    if(restaurantId) conditions.restaurant_id = { $ne: new ObjectId(restaurantId) };

    const dbInstance = getDb();
    const existingUserCount = await dbInstance.collection(Tables.USERS).countDocuments(conditions);
    return {
        status: existingUserCount ? Constants.STATUS_ERROR : Constants.STATUS_SUCCESS
    };
};

export {
    approveEnquiryValidation,
    rejectEnquiryValidation,
    addEnquiryValidation
};