import { body } from 'express-validator';
import { cleanRegex } from "../../../utils/index.mjs";
import { ObjectId } from 'mongodb';
import Tables from '../../../config/database_tables.mjs';
import { getDb } from '../../../config/connection.mjs';
import * as Constants from "../../../config/global_constant.mjs";
import { parallel as asyncParallel } from 'async';

// Module add / edit validation rules
const addEditValidation = [
    body('cuisine_id')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('categories.please_select_one_cuisine');
            }),
    body('name_english')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('categories.please_enter_category_name_in_english');
            })         
        .custom((value,{req, res, next,location,path})=>{
            if(value){
                return validateCategoryhName(value,req,res,next).then(quRes=>{
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('categories.whoops_you_have_entered_an_already_used_name_in_english_please_try_something_different', { value, location, path }));
                    }else{
                        return true;
                    }
                }).catch(next);
            }else{
                return true;
            }
        }),        
    body('name_arabic')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('categories.please_enter_category_name_in_arabic');
            })
        .custom((value,{req, res, next,location,path})=>{
            if(value){
                return validateCategoryhName(value,req,res,next,true).then(quRes=>{
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('categories.whoops_you_have_entered_an_already_used_name_in_arabic_please_try_something_different', { value, location, path }));
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
                return req.__('categories.please_enter_category_order');
            })
        .isNumeric()
            .withMessage((value, { req }) => {
                return req.__('categories.please_enter_order_in_numeric_only');
            })
        .custom((value,{req, res, next,location,path})=>{
            if(isNaN(value) || value <=0){
                return Promise.reject(req.__('categories.please_enter_order_in_numeric_only', { value, location, path }));
            }else{
                return true;
            }
        }),
    body('tags')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('categories.please_enter_category_tags');
            }),
    body('image')     
        .custom((value,{req, res, next,location,path})=>{
            if(!req?.params?.id && (!req.files || !req.files.image)){
                return Promise.reject(req.__('categories.please_select_image', { value, location, path }));
            }else{
                return true;
            }
        }),
];

// Module add / edit validation rules
const rejectCategoryValidation = [
    body('reject_msg')
        .custom((value,{req, res, next,location,path})=>{
            if(!value && req?.body?.status == Constants.REJECTED){
                return Promise.reject(req.__('categories.please_enter_rejection_message', { value, location, path }));
            }else{
                return true;
            }
        })
];

/**
 * Validate if category name already exists
 * @param {Object} value - Input value
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<Array>} Array of validation errors
 */
const validateCategoryhName = async (value,req,res,next,isArabic = false) => {
    return new Promise(resolve=>{
        const db    =   getDb();
        let slug  	=   req?.params?.slug || "";
        let catId	= 	new ObjectId(req?.params?.id || new ObjectId());
        asyncParallel({
            unique_name : (callback)=>{
                /** Get conditions for query **/
                let conditions = {
                    _id	: { $ne : catId},
                    restaurant_slug	: slug
                };

                if(isArabic) conditions['name.ar'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};
                else conditions['name.en'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};

                /** Find restaurant category name is already exists */
                const collection = db.collection(Tables.RESTAURANT_CATEGORIES);
                collection.findOne(conditions,{projection: { _id: 1}}).then(result=>{
                    callback(null,result);
                }).catch(next);
            },
            pending_unique_name : (callback)=>{
                /** Get conditions for query **/
                let conditions = {
                    _id	: { $ne : catId},
                    restaurant_slug	: slug
                };

                if(isArabic) conditions['name.ar'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};
                else conditions['name.en'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};

                /** Find restaurant category name is already exists in temp table */
                const collection = db.collection(Tables.TMP_RESTAURANT_CATEGORIES);
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
    rejectCategoryValidation
};