import { body } from 'express-validator';
import { cleanRegex } from "../../../../utils/index.mjs";
import { ObjectId } from 'mongodb';
import Tables from "../../../../config/database_tables.mjs";
import { getDb } from "../../../../config/connection.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import { parallel as asyncParallel } from 'async';

/** Common validations for add / edit / clone item */
let commonValidations  = [
    body('name_in_english')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('items.please_enter_item_name_in_english');
            })         
        .custom((value,{req, res, next,location,path})=>{
            if(value){
                return validateItemName(value,req,res,next).then(quRes=>{
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('items.whoops_you_have_entered_an_already_used_name_in_english_please_try_something_different', { value, location, path }));
                    }else{
                        return true;
                    }
                }).catch(next);
            }else{
                return true;
            }
        }),        
    body('name_in_arabic')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('items.please_enter_item_name_in_arabic');
            })
        .custom((value,{req, res, next,location,path})=>{
            if(value){
                return validateItemName(value,req,res,next,true).then(quRes=>{
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('items.whoops_you_have_entered_an_already_used_name_in_arabic_please_try_something_different', { value, location, path }));
                    }else{
                        return true;
                    }
                }).catch(next);
            }else{
                return true;
            }
        }),
    body('description_in_english')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('items.please_enter_item_description_in_english');
            }),
    body('description_in_arabic')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('items.please_enter_item_description_in_arabic');
            }) 
];

// Module add / edit validation rules
const addEditValidation = [
    ...commonValidations,
    ...[
        
        body('item_price')     
            .custom((value,{req, res, next,location,path})=>{
                if(!req?.body?.price_on_selection && !value){
                    return Promise.reject(req.__('items.please_enter_price'));
                }else if(value && (isNaN(value) || value <=0)){
                    return Promise.reject(req.__('items.please_enter_valid_price'));
                }
                return true;
            }),
        body('discount_value')     
            .custom((value,{req, res, next,location,path})=>{
                if(value){
                    if(isNaN(value) || value <=0){
                        return Promise.reject(req.__('items.please_enter_valid_discount_by_value'));
                    }else if(req?.body?.item_price && parseFloat(value) >= parseFloat(req?.body?.item_price)){
                        return Promise.reject(req.__('items.discount_by_value_should_be_less_than_price'));
                    }
                }
                return true;
            }),
        body('discount_percentage')     
            .custom((value,{req, res, next,location,path})=>{
                if(value && (isNaN(value) || value <=0 || value > Constants.MAX_PERCENTAGE)){
                    return Promise.reject(req.__('items.please_enter_valid_discount_percentage'));
                }
                return true;
            }),
        body('image')     
            .custom((value,{req, res, next,location,path})=>{
                if(!req?.params?.id && (!req.files || !req.files.image)){
                    return Promise.reject(req.__('items.please_select_image', { value, location, path }));
                }
                return true;
            }),
        body('grid_image')     
            .custom((value,{req, res, next,location,path})=>{
                if(!req?.params?.id && (!req.files || !req.files.grid_image)){
                    return Promise.reject(req.__('items.please_select_grid_image', { value, location, path }));
                }
                return true;
            }),
        body('detail_image')     
            .custom((value,{req, res, next,location,path})=>{
                if(!req?.params?.id && (!req.files || !req.files.detail_image)){
                    return Promise.reject(req.__('items.please_select_detail_image', { value, location, path }));
                }
                return true;
            }),
    ]
];

// Module recommended item validation rules
const recommendedItemValidation = [
    body('recommended')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('items.please_select_item');
            }),
];

// Module reject item validation rules
const rejectItemValidation = [
    body('rejection_reason')
        .custom((value,{req, res, next,location,path})=>{
            if(!value && req?.body?.status == Constants.REJECTED){
                return Promise.reject(req.__('items.please_enter_rejection_reason', { value, location, path }));
            }else{
                return true;
            }
        })
];

// Module overriding item validation rules
const overridingItemValidation = [
    body('branches')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('items.please_select_branches');
            }),
    body('options')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('items.please_select_option');
            })
];

// Module upselling item validation rules
const upsellingItemValidation = [
    body('upselling')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('items.please_select_item');
            })
];

// Module clone item validation rules
const cloneItemValidation = commonValidations;

/**
 * Validate if item name already exists
 * @param {Object} value - Input value
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<Array>} Array of validation errors
 */
const validateItemName = async (value,req,res,next,isArabic = false) => {
    return new Promise(resolve=>{
        const db    =   getDb();
        let slug  	=   req?.params?.slug || "";
        let itemId	= 	new ObjectId(req?.params?.id || new ObjectId());
        asyncParallel({
            unique_name : (callback)=>{
                /** Get conditions for query **/
                let conditions = {
                    _id	: { $ne : itemId},
                    restaurant_slug	: slug
                };

                if(isArabic) conditions['name.ar'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};
                else conditions['name.en'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};

                /** Find restaurant category name is already exists */
                const collection = db.collection(Tables.ITEMS);
                collection.findOne(conditions,{projection: { _id: 1}}).then(result=>{
                    callback(null,result);
                }).catch(next);
            },
            pending_unique_name : (callback)=>{
                /** Get conditions for query **/
                let conditions = {
                    _id	: { $ne : itemId},
                    restaurant_slug	: slug
                };

                if(isArabic) conditions['name.ar'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};
                else conditions['name.en'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};

                /** Find restaurant category name is already exists in temp table */
                const collection = db.collection(Tables.TMP_ITEMS);
                collection.findOne(conditions,{projection: { _id: 1}}).then(result=>{
                    callback(null,result);
                }).catch(next);
            },
        },(asyncErr,asyncResponse)=>{

            if(asyncErr || asyncResponse.unique_name || asyncResponse.pending_unique_name){
                return resolve({status: Constants.STATUS_ERROR});
            }

            return resolve({status: Constants.STATUS_SUCCESS});
        });
    }).catch(next);
};


export {
    addEditValidation,
    recommendedItemValidation,
    rejectItemValidation,
    overridingItemValidation,
    upsellingItemValidation,
    cloneItemValidation
};