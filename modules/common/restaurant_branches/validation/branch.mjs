import { body } from 'express-validator';
import { getUtcDate, cleanRegex } from "../../../../utils/index.mjs";
import { ObjectId } from 'mongodb';
import Tables from '../../../../config/database_tables.mjs';
import { getDb } from '../../../../config/connection.mjs';
import * as Constants from "../../../../config/global_constant.mjs";
import { parallel as asyncParallel } from 'async';

// Module add / edit branch validation rules
const addEditBranchValidation = [
    body('name_in_english')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('branch.please_enter_branch_name_in_english');
            })
        .custom((value,{req, res, next,location,path})=>{
            if(value){
                return validateBranchName(value,req,res,next).then(quRes=>{
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('branch.name_in_english_is_already_exist', { value, location, path }));
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
                return req.__('restaubranch.please_enter_branch_name_in_arabic');
            })
        .custom((value,{req, res, next,location,path})=>{
            if(value){
                return validateBranchName(value,req,res,next,true).then(quRes=>{
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('branch.name_in_arabic_is_already_exist', { value, location, path }));
                    }else{
                        return true;
                    }
                }).catch(next);
            }else{
                return true;
            }
        }),
    body('city_id')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('branch.please_select_city');
            }),
    body('area_id')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('branch.please_select_area');
            }),
    body('address')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('branch.please_enter_branch_address');
            }),
    body('latitude')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('branch.please_enter_latitude');
            })
        .custom((value, { req }) => {
            const numeric = Number(value);
            if (Number.isNaN(numeric)) {
                return Promise.reject(req.__('branch.please_enter_valid_latitude'));
            }
            if (!Constants.VALID_LATITUDE_REGEX.test(String(value))) {
                return Promise.reject(req.__('branch.please_enter_valid_latitude'));
            }
            return true;
        }),
    body('longitude')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('branch.please_enter_longitude');
            })
        .custom((value, { req }) => {
            const numeric = Number(value);
            if (Number.isNaN(numeric)) {
                return Promise.reject(req.__('branch.please_enter_valid_longitude'));
            }
            if (!Constants.VALID_LONGITUDE_REGEX.test(String(value))) {
                return Promise.reject(req.__('branch.please_enter_valid_longitude'));
            }
            return true;
        }),
    body('auto_assignment_start_after')
        .custom((value, { req }) => {
            if(value && (value <= 0 || isNaN(value))){
                return Promise.reject(req.__('branch.please_enter_valid_auto_assignment_start_after'));
            }
            return true;
        }),
    body('kfg_offer_name')
        .custom((value, { req }) => {
            if(!value && req?.body?.kfg_offer_id){
                return Promise.reject(req.__('branch.please_enter_kfg_offer_name'));
            }
            return true;
        }),
    body('kfg_offer_id')
        .custom((value, { req }) => {
            if(!value && req?.body?.kfg_offer_name){
                return Promise.reject(req.__('branch.please_enter_kfg_offer_id'));
            }
            return true;
        })
];

// Module branch transfer validation rules
const branchTransferValidation = [
    body('branch_id')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('restaurants.please_enter_branch_id');
            }),
    body('calendar_from')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('restaurants.please_select_calendar_from');
            }),
    body('calendar_to')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('restaurants.please_select_calendar_to');
            })
        .custom((value, { req }) => {
            if(req.body.calendar_from && value && getUtcDate(req.body.calendar_from) >= getUtcDate(value)){
                return Promise.reject(req.__('restaurants.to_should_be_greater'));
            }
            return true;
        })
];

/**
 * Validate if branch name already exists
 * @param {Object} db - Database instance
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {String} branchId - Branch ID for edit case
 * @returns {Promise<Array>} Array of validation errors
 */
const validateBranchName = async (value,req,res,next,isArabic = false) => {
    return new Promise(resolve=>{
        const dbInstance=   getDb();
        let slug  	    =   req?.params?.slug || "";
        let branchId	= 	new ObjectId(req?.params?.id || new ObjectId());
        asyncParallel({
            unique_name : (callback)=>{
                /** Get conditions for query **/
                let conditions = {
                    _id	: { $ne : branchId},
                    restaurant_slug	: slug
                };

                if(isArabic) conditions['name.ar'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};
                else conditions['name.en'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};

                /** Find restaurant branch name is already exists */
                const restaurant_branches = dbInstance.collection(Tables.RESTAURANT_BRANCHES);
                restaurant_branches.findOne(conditions,{projection: { _id: 1}}).then(result=>{
                    callback(null,result);
                }).catch(next);
            },
            pending_unique_name : (callback)=>{
                /** Get conditions for query **/
                let conditions = {
                    branch_id	: { $ne : branchId},
                    restaurant_slug	: slug
                };

                if(isArabic) conditions['name.ar'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};
                else conditions['name.en'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};

                /** Find restaurant branch name is already exists in temp table */
                const tmp_restaurant_branches = dbInstance.collection(Tables.TMP_RESTAURANT_BRANCHES);
                tmp_restaurant_branches.findOne(conditions,{projection: { _id: 1}}).then(result=>{
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
    branchTransferValidation,
    addEditBranchValidation
};