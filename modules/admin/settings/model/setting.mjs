import { ObjectId } from 'mongodb';
import { writeFile } from 'fs';
import axios from 'axios'; 
import {forEachOf as asyncForEachOf} from 'async'; 
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, appendFileExistData, moveUploadedFile, removeFile } from '../../../../utils/index.mjs';
import { saveSystemLogs } from '../../../../services/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import myCache from '../../../../cache.mjs';

class Setting {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.SETTINGS);
    }

    /**
     * Function to get settings list
     *
     * @param req As Request Data
     * @param res As Response Data
     * @param next As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getSettingList(req, res, next) {
        try {
            if (isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);

                // Get list or count of settings 
                let dbRes = await this.collectionDb.aggregate([
                    {$match: dataTableConfig.conditions },
                    {$facet : {
                        list : [
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit},
                            {$project: {
                                _id: 1, title: 1, value: 1, modified: 1, key_value: 1, input_type: 1 
                            }}
                        ],
                        count: [
                            {$count: "count"},
                        ],
                    }}
                ]).toArray();

                let result = dbRes?.[0]?.list ||[];
                if(result.length > 0){
                    let appendOpt = await appendFileExistData({
                        "file_url": Constants.SETTING_FILE_URL,
                        "file_path": Constants.SETTING_FILE_PATH,
                        "result": result,
                        "database_field": "value"
                    });

                    result = appendOpt?.result || [];
                }

                /** Send response **/
                res.send({
                    status          :   Constants.STATUS_SUCCESS,
                    draw            :   dataTableConfig.result_draw,
                    data			:   result,
                    recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
                });                 
            } else {
                /** render listing page **/
                req.breadcrumbs(BREADCRUMBS["admin/setting/list"]);
                res.render('list');
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for add setting
     * @param req As Request Data
     * @param res As Response Data
     * @param next As Callback argument to the middleware function
     *
     * @return render/json
     */
    async addSetting(req, res, next) {
        try {
            if (isPost(req)) {
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let title = (req.body.title) ? req.body.title : "";
                let value = (req.body.value) ? req.body.value : "";
                let keyValue = (req.body.key_value) ? req.body.key_value : "";
                let inputType = (req.body.input_type) ? req.body.input_type : "";
                let validatType = (req.body.validate_type) ? req.body.validate_type : "";
                let imageValidateType = (req.body.image_validate_type) ? req.body.image_validate_type : 'valid_image';
                let allowedExtensions = (req.body.allowed_extensions) ? req.body.allowed_extensions.split(',') : "";
                let allowedMimes = (req.body.allowed_mimes) ? req.body.allowed_mimes.split(',') : "";
                let order = (req.body.order) ? req.body.order : "";
                let editable = (req.body.editable) ? req.body.editable : 0;
                let required = (req.body.required) ? req.body.required : 0;
                
                /** Handle file upload if needed **/
                let imageName = '';
                if (inputType == Constants.INPUT_FILE && req.files && req.files.image_value) {
                    let imgOptions = {
                        image               : req.files.image_value,
                        filePath            : Constants.SETTING_FILE_PATH,
                        allowedExtensions   : Constants.ALLOWED_IMAGE_EXTENSIONS,
                        allowedImageError   : Constants.ALLOWED_IMAGE_ERROR_MESSAGE,
                        allowedMimeTypes    : Constants.ALLOWED_IMAGE_MIME_EXTENSIONS,
                        allowedMimeError    : Constants.ALLOWED_IMAGE_MIME_ERROR_MESSAGE,
                    };

                    if (imageValidateType == 'valid_document') {
                        imgOptions.allowedExtensions = Constants.DOCUMENT_ATTACHMENT_EXTENSIONS;
                        imgOptions.allowedImageError = Constants.DOCUMENT_ATTACHMENT_ERROR_MESSAGE;
                        imgOptions.allowedMimeTypes = Constants.DOCUMENT_MIME_EXTENSIONS;
                        imgOptions.allowedMimeError = Constants.DOCUMENT_MIME_ERROR_MESSAGE;

                    } else if (imageValidateType == 'other' && inputType == Constants.INPUT_FILE) {
                        let allowedExtensionsErrorMessage = "Please select valid file, Valid file extensions are " + allowedExtensions.join(", ") + ".";
                        let allowedMimesErrorMessage = "Please select valid mime type, Valid mime types are " + allowedMimes.join(", ") + ".";
                       
                        imgOptions.allowedExtensions = allowedExtensions;
                        imgOptions.allowedImageError = allowedExtensionsErrorMessage;
                        imgOptions.allowedMimeTypes = allowedMimes;
                        imgOptions.allowedMimeError = allowedMimesErrorMessage;
                    }

                    /** Move uploaded file **/
                    const uploadResponse = await moveUploadedFile(req, res, imgOptions);
                    imageName = uploadResponse?.fileName || "";

                    if (uploadResponse.status == Constants.STATUS_ERROR) {
                        return res.send({status: Constants.STATUS_ERROR, message: [
                            { 'param': 'image_value', 'msg': uploadResponse.message }
                        ]});
                    }
                }

                let type = keyValue.split('.');
                type = (type[0]) ? type[0] : "";
                order = (order != "") ? parseInt(order) : "";

                let dataToBeInsert = {
                    type: type,
                    title: title,
                    key_value: keyValue,
                    input_type: inputType,
                    validate_type: (inputType != Constants.INPUT_FILE) ? validatType : imageValidateType,
                    value: (value && inputType != Constants.INPUT_FILE) ? value : imageName,
                    order_weight: order,
                    editable: parseInt(editable),
                    required: parseInt(required),
                    created: getUtcDate(),
                    modified: getUtcDate(),
                };

                if (inputType == "select") {
                    try {
                        let tmpValue = value.split(",");
                        dataToBeInsert.select_list = value;
                        dataToBeInsert.value = tmpValue[0];
                    } catch (e) {
                        dataToBeInsert.select_list = "";
                        dataToBeInsert.value = value;
                    }
                }

                if (imageValidateType == Constants.VALIDATE_OTHER && inputType == Constants.INPUT_FILE) {
                    dataToBeInsert['allowed_extensions'] = allowedExtensions;
                    dataToBeInsert['allowed_mimes'] = allowedMimes;
                }

                const insertResult = await this.collectionDb.insertOne(dataToBeInsert);
                
                if (insertResult.insertedId) {
                    /** Write setting in file **/
                    await this.writeSettingDetails(req, res);
                    
                    /** Send success response **/
                    req.flash(Constants.STATUS_SUCCESS, res.__("admin.setting.setting_has_been_added_successfully"));
                    res.send({
                        status: Constants.STATUS_SUCCESS,
                        redirect_url: Constants.WEBSITE_ADMIN_URL + "settings",
                        message: res.__("admin.setting.setting_has_been_added_successfully")
                    });
                } else {
                    /** Send error response **/
                    res.send({
                        status: Constants.STATUS_ERROR,
                        message: [{ param: Constants.ADMIN_GLOBAL_ERROR, msg: res.__("admin.system.something_going_wrong_please_try_again") }],
                    });
                }
            }else {
                /** Render view file **/
                req.breadcrumbs(BREADCRUMBS["admin/setting/add"]);
                res.render('add');
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for delete setting
     * @param req As Request Data
     * @param res As Response Data
     * @param next As Callback argument to the middleware function
     *
     * @return null
     */
    async deleteSetting(req, res, next) {
        try {
            let id = (req.params.id) ? req.params.id : '';
            if (id) {
                /** Get setting details **/
                const result = await this.collectionDb.findOne({
                    _id: new ObjectId(id)
                });

                if(!result) {
                    /** Send error response **/
                    req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
                    return res.redirect(Constants.WEBSITE_ADMIN_URL + "settings");
                }
                
                /**  Remove file if input type is file **/
                if (result.input_type == Constants.INPUT_FILE && result.value) {
                    removeFile({file_path: Constants.SETTING_FILE_PATH + result.value});
                }

                /** Delete setting **/
                await this.collectionDb.deleteOne({ _id: new ObjectId(id) });                
               
                /** Write setting in file **/
                await this.writeSettingDetails(req, res);
                
                /** Send success response **/
                req.flash(Constants.STATUS_SUCCESS, res.__("admin.setting.setting_deleted_successfully"));
                res.redirect(Constants.WEBSITE_ADMIN_URL + "settings");               
            } else {
                /** Send error response **/
                req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
                res.redirect(Constants.WEBSITE_ADMIN_URL + "settings");
            }
        } catch (error) {
            /** Send error response **/
            req.flash(Constants.STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
            res.redirect(Constants.WEBSITE_ADMIN_URL + "settings");
        }
    }

    /**
     * Function to get detail of a setting
     *
     * @param req As Request Data
     * @param res As Response Data
     * @param next As Callback argument to the middleware function
     *
     * @return json
     */
    async getSettingDetails(req, res, next) {
        try {
            let settingId = (req.params.id) ? req.params.id : "";
            if (!settingId || settingId == "") {
                return {
                    status: Constants.STATUS_ERROR,
                    message: res.__("admin.system.invalid_access")
                };
            }

            /**Get settings details*/
            const result = await this.collectionDb.findOne({
                _id: new ObjectId(settingId)
            });

            if(!result) {
                return {
                    status: Constants.STATUS_ERROR,
                    message: res.__("admin.system.invalid_access")
                };
            }

            /** Append file with full path **/
            const imageRes = await appendFileExistData({
                "file_url": Constants.SETTING_FILE_URL,
                "file_path": Constants.SETTING_FILE_PATH,
                "result": [result],
                "database_field": "value"
            });
            
            /** Send success response **/
            return {
                status: Constants.STATUS_SUCCESS,
                result: imageRes?.result?.[0] || {}
            };            
        } catch (error) {
            /** Send error response */
            return {
                status: Constants.STATUS_ERROR,
                message: res.__("admin.system.something_going_wrong_please_try_again")
            };
        }
    }

    /**
     * Function for update setting details
     *
     * @param req As Request Data
     * @param res As Response Data
     * @param next As Callback argument to the middleware function
     *
     * @return render/json
     */
    async editSetting(req, res, next) {
        try {
            let id = (req.params.id) ? req.params.id : "";
            
            if (isPost(req)) {                
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let title = (req.body.title) ? req.body.title : "";
                let value = (req.body.value) ? req.body.value : "";
                let keyValue = (req.body.key_value) ? req.body.key_value : "";
                let inputType = (req.body.input_type) ? req.body.input_type : "";
                let validatType = (req.body.validate_type) ? req.body.validate_type : '';
                let imageValidateType = (req.body.image_validate_type) ? req.body.image_validate_type : 'valid_image';
                let allowedExtensions = (req.body.allowed_extensions) ? req.body.allowed_extensions.split(',') : "";
                let allowedMimes = (req.body.allowed_mimes) ? req.body.allowed_mimes.split(',') : "";
                let order = (req.body.order) ? req.body.order : "";
                let editable = (req.body.editable) ? req.body.editable : 0;
                let required = (req.body.required) ? req.body.required : 0;

                /** Handle file upload if needed **/
                let imageName = '';
                if (inputType == Constants.INPUT_FILE && req.files && req.files.image_value) {
                    let imgOptions = {
                        image               : req.files.image_value,
                        oldPath             : req?.body?.old_image || "",
                        filePath            : Constants.SETTING_FILE_PATH,
                        allowedExtensions   : Constants.ALLOWED_IMAGE_EXTENSIONS,
                        allowedImageError   : Constants.ALLOWED_IMAGE_ERROR_MESSAGE,
                        allowedMimeTypes    : Constants.ALLOWED_IMAGE_MIME_EXTENSIONS,
                        allowedMimeError    : Constants.ALLOWED_IMAGE_MIME_ERROR_MESSAGE,
                    };

                    if (imageValidateType == 'valid_document') {
                        imgOptions.allowedExtensions = Constants.DOCUMENT_ATTACHMENT_EXTENSIONS;
                        imgOptions.allowedImageError = Constants.DOCUMENT_ATTACHMENT_ERROR_MESSAGE;
                        imgOptions.allowedMimeTypes = Constants.DOCUMENT_MIME_EXTENSIONS;
                        imgOptions.allowedMimeError = Constants.DOCUMENT_MIME_ERROR_MESSAGE;

                    } else if (imageValidateType == 'other' && inputType == Constants.INPUT_FILE) {
                        let allowedExtensionsErrorMessage = "Please select valid file, Valid file extensions are " + allowedExtensions.join(", ") + ".";
                        let allowedMimesErrorMessage = "Please select valid mime type, Valid mime types are " + allowedMimes.join(", ") + ".";
                       
                        imgOptions.allowedExtensions = allowedExtensions;
                        imgOptions.allowedImageError = allowedExtensionsErrorMessage;
                        imgOptions.allowedMimeTypes = allowedMimes;
                        imgOptions.allowedMimeError = allowedMimesErrorMessage;
                    }

                    /** Move uploaded file **/
                    const uploadResponse = await moveUploadedFile(req, res, imgOptions);
                    imageName = uploadResponse?.fileName || "";

                    if (uploadResponse.status == Constants.STATUS_ERROR) {
                        return res.send({status: Constants.STATUS_ERROR, message: [
                            { 'param': 'image_value', 'msg': uploadResponse.message }
                        ]});
                    }
                }

                let type = keyValue.split('.');
                type = (type[0]) ? type[0] : "";
                order = (order != "") ? parseInt(order) : "";

                let dataToUpdate = {
                    type: type,
                    title: title,
                    key_value: keyValue,
                    input_type: inputType,
                    validate_type: (inputType != Constants.INPUT_FILE) ? validatType : imageValidateType,
                    value: (value && inputType != Constants.INPUT_FILE) ? value : ((imageName) ? imageName : req.body.old_image),
                    allowed_extensions: allowedExtensions,
                    allowed_mimes: allowedMimes,
                    order_weight: order,
                    editable: parseInt(editable),
                    required: parseInt(required),
                    modified: getUtcDate()
                };

                if (imageValidateType == Constants.VALIDATE_OTHER && inputType == Constants.INPUT_FILE) {
                    dataToUpdate['allowed_extensions'] = allowedExtensions;
                    dataToUpdate['allowed_mimes'] = allowedMimes;
                }

                /** update setting data*/
                const updateResult = await this.collectionDb.updateOne({
                    _id: new ObjectId(id)
                }, { $set: dataToUpdate });

                if (updateResult.modifiedCount > 0) {
                    /** Write setting in file **/
                    await this.writeSettingDetails(req, res);
                    
                    /** Send success response **/
                    req.flash(Constants.STATUS_SUCCESS, res.__("admin.setting.setting_has_been_updated_successfully"));
                    res.send({
                        status: Constants.STATUS_SUCCESS,
                        redirect_url: Constants.WEBSITE_ADMIN_URL + 'settings',
                        message: res.__("admin.setting.setting_has_been_updated_successfully"),
                    });
                } else {
                    /** Send error response **/
                    res.send({
                        status: Constants.STATUS_ERROR,
                        message: [{ param: Constants.ADMIN_GLOBAL_ERROR, msg: res.__("admin.system.something_going_wrong_please_try_again") }],
                    });
                }
            } else {
                const response = await this.getSettingDetails(req, res, next);
                if (response.status == Constants.STATUS_SUCCESS) {
                    /** Render edit page  **/
                    req.breadcrumbs(BREADCRUMBS['admin/setting/edit']);
                    res.render('edit', {
                        result: response.result,
                    });
                } else {
                    /** Send error response **/
                    req.flash(Constants.STATUS_ERROR, response.message);
                    res.redirect(Constants.WEBSITE_ADMIN_URL + 'settings');
                }
            }
        } catch (error) {
            /** Send error response **/
            res.send({
                status: Constants.STATUS_ERROR,
                message: [{ param: Constants.ADMIN_GLOBAL_ERROR, msg: res.__("admin.system.something_going_wrong_please_try_again") }]
            });
        }
    }

    /**
     * Function to get settings list and update settings
     *
     * @param req As Request Data
     * @param res As Response Data
     * @param next As Callback argument to the middleware function
     *
     * @return render/json
     */
    async prefix(req, res, next) {
        try {
            let type = (req.params.type) ? req.params.type : "";
            let displayType = type.replace(RegExp("_", "g"), " ");
            
            if (isPost(req)) {
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, [/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi]);
                
                /** check validation for images */
                let errMessageArray = [];
                let imageNames      = {};                
                asyncForEachOf(req.body.settings, (record, key, callback) => {

                    if (record?.input_type != Constants.INPUT_FILE || !req?.files?.[record?.key_value]) return callback(null);

                    let allowedExtensions   =   record?.allowed_extensions?.split(',') || [];
					let allowedMimes        =   record?.allowed_mimes?.split(',') || [];

                    /** Set default options for upload file */
                    let imgOptions = {
                        'image'             : req?.files?.[record?.key_value],
                        'filePath'          : Constants.SETTING_FILE_PATH,
                        'allowedExtensions' : Constants.ALLOWED_IMAGE_EXTENSIONS,
                        'allowedImageError' : Constants.ALLOWED_IMAGE_ERROR_MESSAGE,
                        'allowedMimeTypes'  : Constants.ALLOWED_IMAGE_MIME_EXTENSIONS,
                        'allowedMimeError'  : Constants.ALLOWED_IMAGE_MIME_ERROR_MESSAGE,
                    };

                    /** Set options for upload document */
                    if (record?.validate_type == 'valid_document') {
                        imgOptions.allowedExtensions = Constants.DOCUMENT_ATTACHMENT_EXTENSIONS;
                        imgOptions.allowedImageError = Constants.DOCUMENT_ATTACHMENT_ERROR_MESSAGE;
                        imgOptions.allowedMimeTypes = Constants.DOCUMENT_MIME_EXTENSIONS;
                        imgOptions.allowedMimeError = Constants.DOCUMENT_MIME_ERROR_MESSAGE;

                    }
                    /** Set options for other document */
                    if (record?.validate_type == 'other' && inputType == Constants.INPUT_FILE) {
                        let allowedExtensionsErrorMessage = "Please select valid file, Valid file extensions are " + allowedExtensions.join(", ") + ".";
                        let allowedMimesErrorMessage = "Please select valid mime type, Valid mime types are " + allowedMimes.join(", ") + ".";
                       
                        imgOptions.allowedExtensions = allowedExtensions;
                        imgOptions.allowedImageError = allowedExtensionsErrorMessage;
                        imgOptions.allowedMimeTypes = allowedMimes;
                        imgOptions.allowedMimeError = allowedMimesErrorMessage;
                    }                   

                    /** Upload setting image **/
                    moveUploadedFile(req, res, options).then(response => {
                        if (response.status == Constants.STATUS_ERROR) {
                            errMessageArray.push({ 'param': "setting_" + key + "_value", 'msg': response.message });
                        } else {
                            imageNames[record.id] = response?.fileName || "";
                        }
                        callback(null);
                    });
                }, async () => {
                    if (errMessageArray.length > 0) {
                        /** Remove uploaded file **/
                        Object.keys(imageNames).map(key => {
                            removeFile({file_path: Constants.SETTING_FILE_PATH + imageNames[key]});
                        });

                        /** Send error response **/
                        return res.send({status: Constants.STATUS_ERROR, message: errMessageArray});
                    }
                    
                    try {
                        req.body.settings.forEach(async (data, dataIndex) => {
                            let value     = (data.value) ? data.value : "";
                            let settingId = (data.id) ? data.id : "";

                            if (settingId){
                                
                                if(data.input_type == Constants.INPUT_FILE) {
                                    value = (imageNames[settingId]) ? imageNames[settingId] : data.old_image;
                                }

                                /** Update settings details **/
                                await this.collectionDb.updateOne({
                                    "_id": new ObjectId(settingId),
                                }, {$set: {
                                    "value": value,
                                    "modified": getUtcDate()
                                } });

                                if (req.body.settings.length - 1 == dataIndex) {
                                    /** save System logs */
                                    saveSystemLogs(req, res, {
                                        user_id: req.session.user._id,
                                        parent_id: settingId,
                                        activity_module: Constants.SYSTEM_LOG_MODULE_SETTINGS,
                                        activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                                        additional_details: {}
                                    });
                                }                         
                            } 
                        });

                        /** Write setting in file **/
                        await this.writeSettingDetails(req, res);

                        /** Send success response **/
                        req.flash(Constants.STATUS_SUCCESS, res.__("admin.setting.setting_details_has_been_updated_successfully"));
                        res.send({
                            status: Constants.STATUS_SUCCESS,
                            redirect_url: Constants.WEBSITE_ADMIN_URL + "settings/prefix/" + type,
                            message: res.__("admin.setting.setting_details_has_been_updated_successfully"),
                        });
                    } catch (e) {
                        /** Send error response **/
                        res.send({
                            status: Constants.STATUS_ERROR,
                            message: [{ param: Constants.ADMIN_GLOBAL_ERROR, msg: res.__("admin.system.something_going_wrong_please_try_again") }]
                        });
                    }
                });               
            } else{
                /**Add breadcrumb */
                req.breadcrumbs(BREADCRUMBS["admin/setting/prefix"]);

                /** Get settings details **/
                const response = await this.getPrefixSettingDetails(req, res);

                /** Send error response if no result found **/
                if(response.status == Constants.STATUS_ERROR) {
                    req.flash("error", response.message);
                    return res.redirect(Constants.WEBSITE_ADMIN_URL + "dashboard");
                }

                /** Render prefix page **/
                res.render("prefix", {
                    result: response.result,
                    type: type,
                    dynamic_variable: displayType + " " + res.__("admin.setting.settings"),
                    dynamic_url: type,
                    displayType: displayType
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get detail of a setting
     *
     * @param req As Request Data
     * @param res As Response Data
     * @param next As Callback argument to the middleware function
     *
     * @return json
     */
    async getPrefixSettingDetails(req, res, next) {
        try {
            let type = (req.params.type) ? req.params.type : "";

            /** Send error response if type is not provided **/
            if (!type) return { status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") };

            /**Get settings details*/
            const result = await this.collectionDb.find({
                "key_value" : {$regex: type },
                "editable"  : {$ne: 0}
            }).sort({ order_weight: 1 }).toArray();

            /** Send error response if no result found **/
            if(!result?.length) return { status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") };

            /** Append file with full path **/
            const imageRes = await appendFileExistData({
                "file_url"      : Constants.SETTING_FILE_URL,
                "file_path"     : Constants.SETTING_FILE_PATH,
                "result"        : result,
                "database_field": "value"
            });

            /** Send success response **/
            return {
                status: Constants.STATUS_SUCCESS,
                result: imageRes?.result || []
            };
        } catch (error) {
            /** Send error response */
            return {
                status: Constants.STATUS_ERROR,
                message: res.__("admin.system.something_going_wrong_please_try_again")
            };
        }
    }

    /**
     * Function to write setting details
     *
     * @param req As Request Data
     * @param res As Response Data
     * @param next As Callback argument to the middleware function
     *
     * @return json
     */
    async writeSettingDetails(req, res, next) {
        try {
            const result = await this.collectionDb.find({}, { projection: { _id: 1, key_value: 1, value: 1 } }).toArray();
            
            if (result && result.length > 0) {
                let settingsObj = {};
                result.map(record => {
                    let settingKey = (record.key_value) ? record.key_value : "";
                    let settingValue = (record.value) ? record.value : "";

                    settingKey = settingKey.replace(/"/g, '\\"');
                    settingKey = settingKey.replace(/'/g, "\\'");
                    settingValue = settingValue.replace(/"/g, '\\"');
                    settingValue = settingValue.replace(/'/g, "\\'");

                    settingsObj[settingKey] = settingValue;
                });
                
                writeFile(Constants.WEBSITE_ROOT_PATH + "config/settings.json", JSON.stringify(settingsObj), "utf8", function (err) { });
            }

            /** Copy settings file to server **/
            if(Constants?.UPLOAD_TO_SERVER){
                axios.post(Constants.UPLOAD_SERVER_URL + 'write_settings').then(() => { }).catch(error => {
                    console.error("Error writing settings to server ",Constants.UPLOAD_SERVER_URL, error);
                }); 
            }

            if (process?.env?.COPY_SYSTEM_SETTINGS && JSON.parse(process?.env?.COPY_SYSTEM_SETTINGS) && typeof Constants.SETTINGS_FILE_WRITE_URL !== undefined) {
                axios.get(Constants.SETTINGS_FILE_WRITE_URL).then(() => { }).catch(error => {
                    console.error("Error copying settings file to server ", Constants.SETTINGS_FILE_WRITE_URL, error);
                });
            }

            setTimeout(function () {
                if (typeof myCache !== 'undefined') {
                    myCache.del("settings");
                }
            }, 5000);

            return { status: Constants.STATUS_SUCCESS };
        } catch (error) {
            return { status: Constants.STATUS_ERROR };
        }
    }
}
export default Setting; 