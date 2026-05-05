import { body } from 'express-validator';
import { cleanRegex } from "../../../../utils/index.mjs";
import { ObjectId } from 'mongodb';
import Tables from "../../../../config/database_tables.mjs";
import { getDb } from "../../../../config/connection.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import { parallel as asyncParallel } from 'async';

/** Common validations for add / edit / clone choice group */
let commonValidations  = [
    body('group_name_english')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('choice_group.please_enter_group_name_in_english');
            })         
        .custom((value,{req, res, next,location,path})=>{
            if(value){
                return validateChoiceGroupName(value,req,res,next).then(quRes=>{
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('choice_group.enter_group_name_english_is_already_exists', { value, location, path }));
                    }else{
                        return true;
                    }
                }).catch(next);
            }else{
                return true;
            }
        }),        
    body('group_name_arabic')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('choice_group.please_enter_group_name_in_arabic');
            })
        .custom((value,{req, res, next,location,path})=>{
            if(value){
                return validateChoiceGroupName(value,req,res,next,true).then(quRes=>{
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('choice_group.enter_group_name_arabic_is_already_exists', { value, location, path }));
                    }else{
                        return true;
                    }
                }).catch(next);
            }else{
                return true;
            }
        }),
    body('order')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('choice_group.please_enter_order');
            })
        .isInt()
            .withMessage((value, { req }) => {
                return req.__('choice_group.please_enter_valid_order');
            })
        .custom((value,{req, res, next,location,path})=>{
            if(value && (isNaN(value) || value < 0)){
                return Promise.reject(req.__('choice_group.please_enter_valid_order'));
            }
            return true;
        })
];

// Module add / edit validation rules
const addEditValidation = [
    ...commonValidations,
    ...[  
        body('group_min_quantity')
            .notEmpty()
                .withMessage((value, { req }) => {
                    return req.__('choice_group.please_enter_group_min_quantity');
                })
            .isInt()
                .withMessage((value, { req }) => {
                    return req.__('choice_group.please_enter_valid_group_min_quantity');
                })
            .custom((value,{req, res, next,location,path})=>{
                if(value && (isNaN(value) || value < 0)){
                    return Promise.reject(req.__('choice_group.please_enter_valid_group_min_quantity'));
                }
                return true;
            }),
        body('group_max_quantity')
            .notEmpty()
                .withMessage((value, { req }) => {
                    return req.__('choice_group.please_enter_valid_group_max_quantity');
                })
            .isInt()
                .withMessage((value, { req }) => {
                    return req.__('choice_group.please_enter_group_max_quantity');
                })
            .custom((value,{req, res, next,location,path})=>{
                if(value){
                    if(isNaN(value) || value < 0){
                        return Promise.reject(req.__('choice_group.please_enter_group_max_quantity'));
                    }else if(value < req?.body?.group_min_quantity){
                        return Promise.reject(req.__('choice_group.group_max_quantity_shold_be_greater_than_min_quantity'));
                    }
                }
                return true;
            })
    ]
];


// Module clone choice group validation rules
const cloneChoiceGroupValidation = [
    ...commonValidations,
    ...[
        body('item_id')
            .notEmpty()
                .withMessage((value, { req }) => {
                    return req.__('choice_group.please_select_item');
                }),
        body('group_min_quantity')
            .custom((value,{req, res, next,location,path})=>{
                if(value && (isNaN(value) || value < 0)){
                    return Promise.reject(req.__('choice_group.please_enter_valid_group_min_quantity'));
                }
                return true;
            }),
        body('group_max_quantity')
            .custom((value,{req, res, next,location,path})=>{
                if(value){
                    if(isNaN(value) || value < 0){
                        return Promise.reject(req.__('choice_group.please_enter_group_max_quantity'));
                    }else if(value < req?.body?.group_min_quantity){
                        return Promise.reject(req.__('choice_group.group_max_quantity_shold_be_greater_than_min_quantity'));
                    }
                }
                return true;
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
const validateChoiceGroupName = async (value,req,res,next,isArabic = false) => {
    return new Promise(resolve=>{
        const db    =   getDb();
        let itemId 	=   new ObjectId(req.params.item_id);
        let choiceGroupId =	new ObjectId(req?.params?.id || new ObjectId());
        asyncParallel({
            unique_name : (callback)=>{
                /** Get conditions for query **/
                let conditions = {
                    _id	: { $ne : choiceGroupId},
                    item_id : itemId
                };

                if(isArabic) conditions['name.ar'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};
                else conditions['name.en'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};

                /** Find restaurant choice group name is already exists */
                const collection = db.collection(Tables.ITEM_CHOICES_GROUPS);
                collection.findOne(conditions,{projection: { _id: 1}}).then(result=>{
                    callback(null,result);
                }).catch(next);
            },
            pending_unique_name : (callback)=>{
                /** Get conditions for query **/
                let conditions = {
                    _id	: { $ne : choiceGroupId},
                    item_id : itemId
                };

                if(isArabic) conditions['name.ar'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};
                else conditions['name.en'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};

                /** Find restaurant choice group name is already exists in temp table */
                const collection = db.collection(Tables.TMP_ITEM_CHOICES_GROUPS);
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
    cloneChoiceGroupValidation
};