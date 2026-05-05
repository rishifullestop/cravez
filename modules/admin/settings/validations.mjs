import { body } from 'express-validator';
import { ObjectId } from 'mongodb';
import Tables from '../../../config/database_tables.mjs';
import { getDb } from '../../../config/connection.mjs';
import * as Constants from "../../../config/global_constant.mjs";
import { isPost } from '../../../utils/index.mjs';

// Add and edit setting validation rules
const addEditSettingValidation = [
    body('title')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.setting.please_enter_title');
        }),
    body('key_value')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.setting.please_enter_key_value');
        })
        .custom((value, { req }) => {
            if (value) {
                return validateKeyValue(value, req).then(quRes => {
                    if (quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('admin.setting.key_value_is_already_exist'));
                    } else {
                        return true;
                    }
                });
            }
            return true;
        }),
    body('input_type')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.setting.please_select_input_type');
        }),
    body('image_value')
        .custom((value, { req }) => {
            if (req.body.input_type == Constants.INPUT_FILE && !req.params.id && (!req?.files || !req?.files?.image_value)){
                let imageValidateType = (req.body.image_validate_type) ? req.body.image_validate_type : 'valid_image';
                if(imageValidateType == 'valid_image'){
                    throw new Error(req.__('admin.settings.please_select_image'));
                }else if(imageValidateType == 'valid_document'){
                    throw new Error(req.__('admin.settings.please_select_document'));
                }else{
                    throw new Error(req.__('admin.settings.please_select_file'));
                }
            }
            return true;
        }),
    body('value')
        .custom((value, { req }) => {
            if (req.body.input_type != Constants.INPUT_FILE) {
                if (!value || value.trim() === '') {
                    throw new Error(req.__('admin.settings.please_enter_value'));
                }
            }
            return true;
        }),
    body('order')
        .custom((value, { req }) => {
            if (value && (isNaN(value) || value <= 0 || !Constants.VALID_NUMBER_REGEX.test(value))) {
                throw new Error(req.__('admin.setting.please_enter_valid_order'));
            }
            return true;
        }),
    body('allowed_extensions')
        .custom((value, { req }) => {
            if (req.body.image_validate_type == Constants.VALIDATE_OTHER && req.body.input_type == Constants.INPUT_FILE) {
                if (!value || value.trim() === '') {
                    throw new Error(req.__('admin.settings.please_enter_allowed_extensions'));
                }
            }
            return true;
        }),
    body('allowed_mimes')
        .custom((value, { req }) => {
            if (req.body.image_validate_type == Constants.VALIDATE_OTHER && req.body.input_type == Constants.INPUT_FILE) {
                if (!value || value.trim() === '') {
                    throw new Error(req.__('admin.settings.please_enter_allowed_mimes'));
                }
            }
            return true;
        })
];

// Prefix settings validation rules
const prefixSettingsValidation = (req, res, next) => {
    if(!isPost(req)) return next();

    let errors = [];
    try{
        let stgList = req?.body?.settings || [];
        if(stgList.constructor == String){
            stgList = JSON.parse(stgList);
            req.body.settings = stgList;
        }

        if(stgList?.length){
            let startDate	=	"";
            let endDate		=	"";
            stgList.forEach((records, index) => {
                let keyValue		=	records?.key_value      || "";
                let oldImage		=	records?.old_image      || "";
                let value 			=	records?.value          || "";
                let title 			= 	records?.title?.toLowerCase()|| "";
                let uppercasetitle 	= 	records?.title          || "";
                let required 		= 	records?.required       || "";
                let inputType 		= 	records?.input_type     || "";
                let validateType 	= 	records?.validate_type  || "";            
                startDate			=	((validateType == "start_time") || (validateType == "start_date"))	?	value	:startDate;
                endDate				=	((validateType == "end_time") || (validateType == "end_date"))		?	value	:endDate;

                if(inputType == "ck_editor" && required == Constants.REQUIRED && value){
                    value =  value.replace(new RegExp(/&nbsp;|<br \/\>/g),' ').trim();
                }

                if(required == Constants.REQUIRED){

                    if(inputType !="checkbox" && inputType != Constants.INPUT_FILE){
                        if(!value || value.trim() === ''){
                            errors.push({"param":"setting_"+index+"_value","msg":res.__("admin.setting.please_enter_value",title)});
                        }
                    }

                    if(inputType == Constants.INPUT_FILE && !oldImage){
                        if(!req?.files || !req?.files?.[keyValue]){
                            errors.push({"param":"setting_"+index+"_value","msg":res.__("admin.settings.please_select_image")});
                        }
                    }
                }

                if(value){
                    if(validateType == "number" && !Constants.VALID_NUMBER_REGEX.test(value)){
                        errors.push({"param":"setting_"+index+"_value","msg":res.__("admin.setting.please_enter_valid_value",title)});
                    }
                    
                    if(validateType == "float" && !Constants.VALID_FLOAT_REGEX.test(value)){
                        errors.push({"param":"setting_"+index+"_value","msg":res.__("admin.setting.please_enter_valid_value",title)});
                    }

                    if(validateType == "percentage"){
                        if(!Constants.VALID_FLOAT_REGEX.test(value)){
                            errors.push({"param":"setting_"+index+"_value","msg":res.__("admin.setting.please_enter_valid_value",title)});
                        }

                        if(value < 0 || value >Constants.MAX_PERCENTAGE){
                            errors.push({"param":"setting_"+index+"_value","msg":res.__("admin.setting.please_enter_valid_value",title)});
                        }
                    }

                    if(validateType == "number" || validateType == "float"){
                        if(value <= 0){
                            errors.push({"param":"setting_"+index+"_value","msg":res.__("admin.setting.value_should_be_greater_than",uppercasetitle)});
                        }
                    }
                }

                if(startDate && endDate && (validateType == "end_time" || validateType == "end_date")){
                    if(startDate >= endDate){
                        message = (validateType == "end_time")	?	res.__("admin.setting.end_time_should_be_greater_than_start_time")	:	res.__("admin.setting.end_date_should_be_greater_than_start_date");
                        errors.push({"param":"setting_"+index+"_value","msg":message});
                    }
                }
            });
        }else{
            errors.push({
                param: Constants.ADMIN_GLOBAL_ERROR,
                msg: res.__("admin.system.something_going_wrong_please_try_again")
            });
        }
    }catch(err){
        console.error("Error at prefixSettingsValidation validation ", err, req.body);
        return res.send({
            status: Constants.STATUS_ERROR,
            message: res.__("admin.system.something_going_wrong_please_try_again")
        });
    }

    /** Send response **/
    return errors.length > 0 ? res.send({
        status: Constants.STATUS_ERROR,
        message: errors
    }) : next();
};

/**
 * Validate if key value already exists
 * @param {String} value - Key value to validate
 * @param {Object} req - Request object
 * @returns {Promise<Object>} Validation result
 */
const validateKeyValue = async (value, req) => {
    /** Set conditions */
    const conditions = {key_value: { $regex: "^" + value + "$", $options: "i" }};
    if(req.params.id) conditions._id = { $ne: new ObjectId(req.params.id) };
    
    /** Get existing setting */
    const dbInstance = getDb();
    const existingSetting = await dbInstance.collection(Tables.SETTINGS).countDocuments(conditions);
    
    /** Return validation result */
    return {
        status: existingSetting  ? Constants.STATUS_ERROR : Constants.STATUS_SUCCESS
    };
};

export {
    addEditSettingValidation,
    prefixSettingsValidation
}; 