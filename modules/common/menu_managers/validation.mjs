import { body } from 'express-validator';
import { cleanRegex } from "../../../utils/index.mjs";
import { ObjectId } from 'mongodb';
import Tables from '../../../config/database_tables.mjs';
import { getDb } from '../../../config/connection.mjs';
import * as Constants from "../../../config/global_constant.mjs";
import { parallel as asyncParallel } from 'async';

// Module add / edit validation rules
const addEditValidation = [
    body('menu_type')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('menu_manager.please_enter_menu_type');
            }),
    body('name_in_english')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('menu_manager.please_enter_english_name');
            })         
        .custom((value,{req, res, next,location,path})=>{
            if(value){
                return validateMenuName(value,req,res,next).then(quRes=>{
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('menu_manager.enter_name_english_is_already_exists', { value, location, path }));
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
                return req.__('menu_manager.please_enter_arabic_name');
            })
        .custom((value,{req, res, next,location,path})=>{
            if(value){
                return validateMenuName(value,req,res,next,true).then(quRes=>{
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('menu_manager.enter_name_arabic_is_already_exists', { value, location, path }));
                    }else{
                        return true;
                    }
                }).catch(next);
            }else{
                return true;
            }
        }),

    body('default_checked')
        .custom((value,{req, res, next,location,path})=>{
            if(value){
                return defaultMenuUnique(value,req,res,next).then(quRes=>{
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('menu_manager.selected_is_default_is_already_exists', { value, location, path }));
                    }else{
                        return true;
                    }
                }).catch(next);
            }else{
                return true;
            }
        }),
    body('start_date') 
        .custom((value,{req, res, next,location,path})=>{
            if(!req?.body?.default_checked){
                if(!value){
                    return Promise.reject(req.__('menu_manager.please_select_start_date'));
                }
                return true;
            }
        }),
    body('start_time')
        .custom((value,{req, res, next,location,path})=>{
            if(!req?.body?.default_checked){
                if(!value){
                    return Promise.reject(req.__('menu_manager.please_select_start_time'));
                }
            }
            return true;
        }),
    body('end_date')
        .custom((value,{req, res, next,location,path})=>{
            if(!req?.body?.default_checked){
                if(!value){
                    return Promise.reject(req.__('menu_manager.please_select_end_date'));
                }
                if(value && req.body.start_date){
                    let startDate = parseInt( req.body.start_date);
                    let endDate   = parseInt(value);
                    
                    /*check validation of start date time and end date time */
                    if(endDate < startDate){
                        return Promise.reject(req.__('menu_manager.invalid_to_date'));
                    }
                }
            }
            return true;
        }),
    body('end_time')
        .custom((value,{req, res, next,location,path})=>{
            if(!req?.body?.default_checked){
                if(!value){
                    return Promise.reject(req.__('menu_manager.please_select_end_time'));
                }
                if(value && req.body.start_time){
                    let startTime = parseFloat(req.body.start_time.replace(':','.'));
                    let endTime   = parseFloat(value.replace(':','.'));
                    
                    /*check validation of start date time and end date time */
                    if(endTime <= startTime){
                        return Promise.reject(req.__('menu_manager.invalid_to_time'));
                    }
                }
            }
            return true;
        }),
    body('image')     
        .custom((value,{req, res, next,location,path})=>{
            if(!req?.params?.id && (!req.files || !req.files.image)){
                return Promise.reject(req.__('menu_manager.please_select_image', { value, location, path }));
            }
            return true;
        }),
];

// Module reject menu validation rules
const rejectMenuValidation = [
    body('rejection_reason')
        .custom((value,{req, res, next,location,path})=>{
            if(req?.body?.status == Constants.REJECTED){
                if(!value){
                    return Promise.reject(req.__('menu_manager.please_enter_rejection_reason', { value, location, path }));
                }

                if(value && value.length > Constants.REJECTION_MESSAGE_TEXT_LENGTH){
                    return Promise.reject(req.__('menu_manager.message_max_length', Constants.REJECTION_MESSAGE_TEXT_LENGTH, { value, location, path }));
                }
            }
            return true;
        })
];

// Module assign branch validation rules
const assignBranchValidation = [
    body('branch')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('menu_manager.please_select_branch');
            })
];

/**
 * Validate if category name already exists
 * @param {Object} value - Input value
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<Array>} Array of validation errors
 */
const validateMenuName = async (value,req,res,next,isArabic = false) => {
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

                /** Find restaurant menu name is already exists */
                const collection = db.collection(Tables.RESTAURANT_MENUS);
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

                /** Find restaurant menu name is already exists in temp table */
                const collection = db.collection(Tables.TMP_RESTAURANT_MENUS);
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

/**
 * Validate if default menu is already exists because a restaurant can have only one default menu
 * @param {Object} value - Input value
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<Array>} Array of validation errors
 */
const defaultMenuUnique = async (value,req,res,next) => {
    return new Promise(resolve=>{
        const db    =   getDb();
        let slug  	=   req?.params?.slug || "";
        let menuId	= 	new ObjectId(req?.params?.id || new ObjectId());
        
        /** Get conditions for query **/
        let conditions = {
            _id	: { $ne : menuId},
            restaurant_slug	: slug,
            is_default 		: true
        };
        asyncParallel({
            unique_is_default : (callback)=>{
                /** Find restaurant menu name is already exists */
                const collection = db.collection(Tables.RESTAURANT_MENUS);
                collection.findOne(conditions,{projection: { _id: 1}}).then(result=>{
                    callback(null,result);
                }).catch(next);
            },
            unique_is_default_tmp : (callback)=>{
                /** Find restaurant menu name is already exists in temp table */
                const collection = db.collection(Tables.TMP_RESTAURANT_MENUS);
                collection.findOne(conditions,{projection: { _id: 1}}).then(result=>{
                    callback(null,result);
                }).catch(next);
            },
        },(asyncErr,asyncResponse)=>{

            if(asyncErr || asyncResponse.unique_is_default || asyncResponse.unique_is_default_tmp){
                return resolve({status: Constants.STATUS_ERROR});
            }

            return resolve({status: Constants.STATUS_SUCCESS});
        });
    }).catch(next);
};


export {
    addEditValidation,
    rejectMenuValidation,
    assignBranchValidation
};