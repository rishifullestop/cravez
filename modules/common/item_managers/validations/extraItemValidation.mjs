import { body } from 'express-validator';
import { cleanRegex, arrayToObject } from "../../../../utils/index.mjs";
import { ObjectId } from 'mongodb';
import Tables from "../../../../config/database_tables.mjs";
import { getDb } from "../../../../config/connection.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import { parallel as asyncParallel } from 'async';

/** Common validations for add / edit / clone extra item */
let commonValidations  = [
    body('name_in_english')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('extra_items.please_enter_name_in_english');
            })         
        .custom((value,{req, res, next,location,path})=>{
            if(value){
                return validateExtraItemName(value,req,res,next).then(quRes=>{
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('extra_items.name_english_is_already_exists', { value, location, path }));
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
                return req.__('extra_items.please_enter_name_in_arabic');
            })
        .custom((value,{req, res, next,location,path})=>{
            if(value){
                return validateExtraItemName(value,req,res,next,true).then(quRes=>{
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('extra_items.name_arabic_is_already_exists', { value, location, path }));
                    }else{
                        return true;
                    }
                }).catch(next);
            }else{
                return true;
            }
        }),
    body('extra_fees')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('extra_items.please_enter_extra_fees');
            })
        .isNumeric()
            .withMessage((value, { req }) => {
                return req.__('extra_items.please_enter_valid_extra_fees');
            })
        .custom((value,{req, res, next,location,path})=>{
            if(value && (isNaN(value) || value < 0)){
                return Promise.reject(req.__('extra_items.please_enter_valid_extra_fees'));
            }
            return true;
        })
    
];

// Module add / edit extra item validation rules
const addEditValidation = [
    ...commonValidations,
    ...[  
        body('extra_item_unit_id')
            .notEmpty()
                .withMessage((value, { req }) => {
                    return req.__('extra_items.please_select_extra_item_unit_id');
                })
                
    ]
];


// Module clone extra item validation rules
const cloneExtraItemValidation = [
    ...commonValidations,
    ...[
        body('item_id')
            .notEmpty()
                .withMessage((value, { req }) => {
                    return req.__('extra_items.please_select_item');
                }),
        body('extra_unit_id')
            .notEmpty()
                .withMessage((value, { req }) => {
                    return req.__('extra_items.please_select_extra_unit');
                })
    ]
];

/**
 * Validate if item name already exists
 * @param {Object} value - Input value
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<Array>} Array of validation errors
 */
const validateExtraItemName = async (value,req,res,next,isArabic = false) => {
    return new Promise(resolve=>{
        const db    =   getDb();
        let itemId 	=   req?.params?.item_id && [req.params.item_id] || [];
        let extraItemId =	new ObjectId(req?.params?.id || new ObjectId());

        if(req.params.cloneId && req.body.item_id){
            itemId = !Array.isArray(req.body.item_id) && [req.body.item_id] || req.body.item_id; 
        }

        asyncParallel({
            unique_name : (callback)=>{
                /** Get conditions for query **/
                let conditions = {
                    item_id : {$in: arrayToObject(itemId)},
                    _id	: { $ne : extraItemId},
                };

                if(isArabic) conditions['name.ar'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};
                else conditions['name.en'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};

                /** Find restaurant extra item name is already exists */
                const collection = db.collection(Tables.ITEM_EXTRA_MASTERS);
                collection.findOne(conditions,{projection: { _id: 1}}).then(result=>{
                    callback(null,result);
                }).catch(next);
            },
            pending_unique_name : (callback)=>{
                /** Get conditions for query **/
                let conditions = {
                    item_id : {$in: arrayToObject(itemId)},
                    _id	: { $ne : extraItemId},
                };

                if(isArabic) conditions['name.ar'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};
                else conditions['name.en'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};

                    /** Find restaurant extra item name is already exists in temp table */
                const collection = db.collection(Tables.TMP_ITEM_EXTRA_MASTERS);
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
    cloneExtraItemValidation
};