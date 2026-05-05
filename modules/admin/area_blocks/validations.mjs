import { body } from 'express-validator';
import {cleanRegex} from "../../../utils/index.mjs";
import { ObjectId } from 'mongodb';
import Tables from '../../../config/database_tables.mjs';
import { getDb } from '../../../config/connection.mjs';
import * as Constants from "../../../config/global_constant.mjs";

// Module add / edit validation rules
const addEditValidation = [
    body('city_id')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.area_blocks.please_select_city');
        }),
    body('area_id')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.area_blocks.please_select_area');
        }),
    body('name_english')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.area_blocks.please_enter_block_name_in_english');
        })
        .custom((value,{req, res, next,location,path})=>{
            if(value && req.body.city_id && req.body.area_id){
                return validateBlockName(value,req).then(quRes=>{
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('admin.area_blocks.whoops_you_have_entered_an_already_used_name_in_english_please_try_something_different', { value, location, path }));
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
            return req.__('admin.area_blocks.please_enter_block_name_in_arabic');
        })
        .custom((value,{req, res, next,location,path})=>{
            if(value && req.body.city_id && req.body.area_id){
                return validateBlockName(value,req,true).then(quRes=>{
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('admin.area_blocks.whoops_you_have_entered_an_already_used_name_in_arabic_please_try_something_different', { value, location, path }));
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
 * Validate if block name already exists
 * @param {Object} db - Database instance
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {String} blockId - Block ID for edit case
 * @returns {Promise<Array>} Array of validation errors
 */
const validateBlockName = async (value,req,isArabic = false) => {
    const cityId = new ObjectId(req.body.city_id);
    const areaId = new ObjectId(req.body.area_id);

    let conditions = {
        city_id: cityId,
        area_id: areaId
    };
    if(req.params && req.params.id) conditions["_id"] = {$ne: new ObjectId(req.params.id)};
    if(isArabic) conditions['name.ar'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};
    else conditions['name.en'] = {$regex: '^' + cleanRegex(value) + '$', $options: 'i'};


    // Find existing block with same name
    const dbInstance = getDb();
    const existingBlock = await dbInstance.collection(Tables.AREA_BLOCKS).findOne(conditions, {projection: {_id: 1}});

    return {
        status: existingBlock && existingBlock._id && Constants.STATUS_ERROR || Constants.STATUS_SUCCESS
    }
};

export {
    addEditValidation
};