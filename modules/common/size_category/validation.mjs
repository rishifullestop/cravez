import { body } from 'express-validator';
import { cleanRegex } from "../../../utils/index.mjs";
import { ObjectId } from 'mongodb';
import Tables from "../../../config/database_tables.mjs";
import { getDb } from "../../../config/connection.mjs";
import * as Constants from "../../../config/global_constant.mjs";

// Module add / edit size category validation rules
const addEditValidation = [
    body('name_english')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('size_category.please_enter_size_category_name_in_english');
            })         
        .custom((value,{req, res, next,location,path})=>{
            if(value){
                return validateSizeCategoryName(value,req,res,next).then(quRes=>{
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('size_category.enter_name_english_is_already_exists', { value, location, path }));
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
                return req.__('size_category.please_enter_size_category_name_in_arabic');
            })
        .custom((value,{req, res, next,location,path})=>{
            if(value){
                return validateSizeCategoryName(value,req,res,next,true).then(quRes=>{
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('size_category.enter_name_arabic_is_already_exists', { value, location, path }));
                    }else{
                        return true;
                    }
                }).catch(next);
            }else{
                return true;
            }
        })
];

/**
 * Validate if item name already exists
 * @param {Object} value - Input value
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<Array>} Array of validation errors
 */
const validateSizeCategoryName = async (value,req,res,next,isArabic = false) => {
    return new Promise(resolve=>{
        const db    =   getDb();
        let slug = req?.params?.slug || "";
        let sizeCategoryId =	new ObjectId(req?.params?.id || new ObjectId());

        /** Get conditions for query **/
        let conditions = {
            restaurant_slug : slug,
            _id	: { $ne : sizeCategoryId},
        };

        if(isArabic) conditions['name.ar'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};
        else conditions['name.en'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};

        /** Find restaurant size category name is already exists */
        const collection = db.collection(Tables.ITEM_UNITS_MASTERS);
        collection.findOne(conditions,{projection: { _id: 1}}).then(result=>{
            
            return resolve({status: result?._id ? Constants.STATUS_ERROR : Constants.STATUS_SUCCESS});
        }).catch(next);
    }).catch(next);
};


export {
    addEditValidation
};