import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, getLanguages } from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { writeFileSync } from 'fs';
import clone from 'clone';

class TextSetting {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.TEXT_SETTINGS);
    }

    /**
     * Function to get text settings list
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getTextSettingList(req, res, next) {
        try {
            let textSettingType = (req.params.type) ? req.params.type : "";
            if(textSettingType && Constants.TEXT_SETTINGS_NAME[textSettingType]){
                let textSettingName = Constants.TEXT_SETTINGS_NAME[textSettingType];

                if(isPost(req)){
                    let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                    let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                    
                    /** Configure Datatable conditions*/
                    const dataTableConfig = await configDatatable(req, res, null);
                    let commonConditions = {
                        type: textSettingType
                    };
                    dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

                    // Get list and counts using aggregation with $facet
                    let dbRes = await this.collectionDb.aggregate([
                        {$match: dataTableConfig.conditions},
                        {$facet: {
                            list: [
                                {$sort: dataTableConfig.sort_conditions},
                                {$skip: skip},
                                {$limit: limit},
                                {$project: {_id: 1, key: 1, value: 1, modified: 1}}
                            ],
                            count: [
                                {$count: "count"},
                            ],
                        }}
                    ]).toArray();

                    /** Send response **/
                    res.send({
                        status: Constants.STATUS_SUCCESS,
                        draw: dataTableConfig.result_draw,
                        data: dbRes?.[0]?.list || [],
                        recordsTotal: dbRes?.[0]?.count?.[0]?.count || 0,
                        recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0,
                    });
                } else {
                    /** render listing page **/
                    req.breadcrumbs(BREADCRUMBS["admin/text_setting/list"]);
                    res.render("list", {
                        type: textSettingType,
                        dynamic_variable: textSettingName + " " + res.__("admin.text_setting.management"),
                        dynamic_url: textSettingType
                    });
                }
            } else {
                /** Send error response **/
                req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
                res.redirect(Constants.WEBSITE_ADMIN_URL + "dashboard");
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get text setting's detail
     *
     * @param req		As Request Data
     * @param res		As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return json
     */
    async getTextSettingDetails(req, res, next) {
        try {
            let textSettingId = (req.params.id) ? req.params.id : "";
            if(!textSettingId || textSettingId == ""){
                return {
                    status: Constants.STATUS_ERROR,
                    message: res.__("admin.system.invalid_access")
                };
            }

            /** Get text settings details **/
            const result = await this.collectionDb.findOne({
                _id: new ObjectId(textSettingId)
            }, {
                projection: {
                    _id: 1,
                    key: 1,
                    value: 1,
                    modified: 1,
                    default_language_id: 1,
                    text_settings_descriptions: 1
                }
            });


            if(!result){
                /** Send error response **/
                return {
                    status: Constants.STATUS_ERROR,
                    message: res.__("admin.system.invalid_access")
                };
            }

            /** Send success response **/
            return {
                status: Constants.STATUS_SUCCESS,
                result: result
            };
        } catch (error) {
            return {
                status: Constants.STATUS_ERROR,
                message: res.__("admin.system.something_going_wrong_please_try_again")
            };
        }
    }

    /**
     * Function for add/edit text settings
     *
     * @param req As Request Data
     * @param res As Response Data
     * @param next As Callback argument to the middleware function
     *
     * @return render/json
     */
    async addEditTextSetting(req, res, next) {
        try {
            let textSettingType = (req.params.type) ? req.params.type : "";
            if(textSettingType && Constants.TEXT_SETTINGS_NAME[textSettingType]){
                let settingId = (req?.params?.id) ? new ObjectId(req.params.id) : new ObjectId();
                let isEditable= req?.params?.id || false;
                let textSettingName = Constants.TEXT_SETTINGS_NAME[textSettingType];
                if(isPost(req)){
                    /** Sanitize Data **/
                    req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);

                    /** Send error response **/
                    if(!req?.body?.text_settings_descriptions?.[Constants.DEFAULT_LANGUAGE_MONGO_ID]){
                        res.send({
                            status: Constants.STATUS_ERROR,
                            message: [{param: Constants.ADMIN_GLOBAL_ERROR, msg: res.__("admin.system.something_going_wrong_please_try_again")}]
                        });
                    }
                  
                    let allData  = req.body;
                    req.body     = clone(allData.text_settings_descriptions[Constants.DEFAULT_LANGUAGE_MONGO_ID]);
                    req.body.key = (allData.key) ? allData.key : "";

                    let key = (req.body.key) ? req.body.key : "";
                    let value = (req.body.value) ? req.body.value : "";

                    /** Insert record*/
                    await this.collectionDb.updateOne(
                        { _id: settingId },
                        {
                            $set: {
                                key: key,
                                value: value,
                                default_language_id: Constants.DEFAULT_LANGUAGE_MONGO_ID,
                                text_settings_descriptions: allData?.text_settings_descriptions || {},
                                type: textSettingType,
                                modified: getUtcDate()
                            },
                            $setOnInsert: {
                                created: getUtcDate(),
                            }
                        },
                        { upsert: true }
                    );

                    /** Write text setting in file */
                    await this.writeTextSettingFile();

                    /** Send success response **/
                    let message = (isEditable) ? res.__("admin.text_setting.text_setting_has_been_updated_successfully") : res.__("admin.text_setting.text_setting_has_been_added_successfully");
                    req.flash(Constants.STATUS_SUCCESS, message);
                    res.send({
                        status: Constants.STATUS_SUCCESS,
                        redirect_url: Constants.WEBSITE_ADMIN_URL + "text-setting/" + textSettingType + (!isEditable && "/add" || ""),
                        message: message,
                        current_id: settingId
                    });                                       
                } else {
                    let result = {};
                    if(isEditable){
                        /** Get text settings details **/
                        const response = await this.getTextSettingDetails(req, res, next);

                        if(response.status != Constants.STATUS_SUCCESS){
                            /** Send error response **/
                            req.flash(Constants.STATUS_ERROR, response.message);
                            res.redirect(Constants.WEBSITE_ADMIN_URL + "text-setting/" + textSettingType);
                        }

                        result = response?.result || {};
                    }

                    /** Get language list **/
                    const languageList = await getLanguages();

                    /** Render add page **/
                    req.breadcrumbs(BREADCRUMBS["admin/text_setting/"+(isEditable && 'edit' || 'add')]);
                    res.render((isEditable && 'edit' || 'add'), {
                        result: result,
                        language_list: languageList,
                        type: textSettingType,
                        dynamic_variable: textSettingName + " " + res.__("admin.text_setting.management"),
                        dynamic_url: textSettingType,
                    });
                }
            } else {
                /** Send error response **/
                req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
                res.redirect(Constants.WEBSITE_ADMIN_URL + "dashboard");
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for write file directly
     *
     * @param req As Request Data
     * @param res As Response Data
     * @param next As Callback argument to the middleware function
     *
     * @return render/json
     */
    async writeFileDirectly(req, res, next) {
        try {
            await this.writeTextSettingFile();
            /** Send success response **/
            res.send({status: Constants.STATUS_SUCCESS});
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to write text setting file.
     *
     * @return Promise
     */
    async writeTextSettingFile() {
        try {
            /** Get Active Languages List **/
            const languageResult = await getLanguages();

            /** Get All text settings **/
            const result = await this.collectionDb.find({},{projection: {_id:1, key:1, value:1, text_settings_descriptions:1}}).toArray();

            if(languageResult?.length && result?.length){
                let lngObject = {}; 
                languageResult.map(lngData=>{
					let langId 	    = 	lngData._id;
					let folderCode 	=	lngData.folder_code;

					if(!lngObject[folderCode]) lngObject[folderCode] = {};

					result.map(stgData=>{
						let stgKey 	=	stgData?.key || "";
						let value 	=	stgData?.text_settings_descriptions?.[langId]?.value || (stgData?.value || "");

						lngObject[folderCode][stgKey] = value;
					});
				});

                /** Write data in locales folder */
				Object.keys(lngObject).map(folderCode=>{
					let tmpPath = Constants.WEBSITE_ROOT_PATH+"locales/"+folderCode+".json";

					writeFileSync(tmpPath, JSON.stringify(lngObject[folderCode]), "utf8",()=>{});
				});
            }
            return true;
        } catch (error) {
            console.error('Error writing text setting file:', error);
            return false;
        }
    }   
}

export default TextSetting; 