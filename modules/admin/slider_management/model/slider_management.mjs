import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, toTitleCase, moveUploadedFile, removeFile, appendFileExistData } from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { saveSystemLogs } from "../../../../services/index.mjs";

class SliderManagement {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.SLIDERS);
    }

    /**
     * Function to get slider list
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getSliderList(req, res, next) {
        try {
            let sliderType = req.params.type;
            let displayType = toTitleCase(sliderType.replace(RegExp("_", "g"), " "));

            /**For check slider type */
            if (Constants.SCREEN_TYPE.indexOf(sliderType) === -1) {
                req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
                return res.redirect(Constants.WEBSITE_ADMIN_URL + "dashboard");
            }

            if (isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                
                /** Common conditions for slider list */
                let commonConditions = {type: sliderType};

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);
                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

                // Get list or count of sliders
                let dbRes = await this.collectionDb.aggregate([
                    { $match: dataTableConfig.conditions },
                    {
                        $facet: {
                            list: [
                                { $sort: dataTableConfig.sort_conditions },
                                { $skip: skip },
                                { $limit: limit },
                                {
                                    $project: {
                                        _id: 1,
                                        description: 1,
                                        image: 1,
                                        created: 1,
                                        status: 1
                                    }
                                }
                            ],
                            count: [
                                { $count: "count" },
                            ],
                        }
                    }
                ]).toArray();

                // Process image paths
                let result = dbRes?.[0]?.list || [];
                if (result.length > 0) {
                    const fileResponse = await appendFileExistData({
                        "file_url": Constants.SLIDER_URL,
                        "file_path": Constants.SLIDER_FILE_PATH,
                        "result": result,
                        "database_field": "image"
                    });
                    result = fileResponse?.result || [];
                }

                /** Send response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data: result,
                    recordsTotal: dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0,
                });
            } else {
                /** render slider listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/slider_management/list']);
                res.render('list', {
                    slider_type: sliderType,
                    display_type: displayType,
                    dynamic_variable: displayType,
                    dynamic_url: sliderType,
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get slider detail
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return json
     */
    async getSliderDetails(req, res, next) {
        try {
            /**For get sliders details   */
            const sliderResult = await this.collectionDb.findOne(
                { _id: new ObjectId(req.params.id) },
                {
                    projection: {
                        _id: 1, description: 1, image: 1, created: 1, time_details: 1, is_default: 1
                    }
                }
            );

            /** Send error response **/
            if (!sliderResult) {
                return {
                    status: Constants.STATUS_ERROR,
                    message: res.__("admin.system.invalid_access")
                };
            }

            /** Append image with full path **/
            const fileResponse = await appendFileExistData({
                "file_url": Constants.SLIDER_URL,
                "file_path": Constants.SLIDER_FILE_PATH,
                "result": [sliderResult],
                "database_field": "image"
            });
            
            return {
                result: fileResponse?.result?.[0] || {},
                status: Constants.STATUS_SUCCESS
            };
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for add or update slider
     *
     * @param req 	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async addEditSlider(req, res, next) {
        try {
            let sliderType = req.params.type;
            let displayType = toTitleCase(sliderType.replace(RegExp("_", "g"), " "));
            let sliderId = (req.params.id) ? new ObjectId(req.params.id) : new ObjectId();
            let isEditable = (req.params.id) ? true : false;
                        
            if (isPost(req)) {
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let splashData      = req?.body?.splash || [];
                let defaultChecked  = req?.body?.default_checked || "";
                let errors = [];

                if(!defaultChecked){
                    /** Check multiple day & time valiadation  */
                    splashData.forEach((records,index)=>{
                        if(records){
                            if(!records.day){
                                errors.push({param: "splash_day_"+index, msg: res.__("admin.slider_management.please_select_day")})
                            }
                            if(!records.start_time){
                                errors.push({param: "splash_start_time_"+index, msg: res.__("admin.slider_management.please_select_start_time")})
                            }
                            if(!records.end_time){
                                errors.push({param: "splash_end_time_"+index, msg: res.__("admin.slider_management.please_select_end_time")})
                            }
                            if(records.start_time && records.end_time && parseFloat(records.start_time.replace(":",".")) >= parseFloat(records.end_time.replace(":",".")) ){
                                errors.push({param: "splash_end_time_"+index, msg: res.__("admin.slider_management.invalid_to_time")})
                            }
                        }
                    });
                }
    
                if (!isEditable && !req.files) {
                    errors.push({ 'param': 'image', 'msg': res.__("admin.slider_management.please_select_image") });
                }
    
                /** Send error response **/
                if(errors.length > 0) return res.send({status: Constants.STATUS_ERROR, message: errors});

                /**Function for upload file */
                const imageResponse = await moveUploadedFile(req, res, {
                    'filePath': Constants.SLIDER_FILE_PATH,
                    'image': req?.files?.image || "",
                    'oldPath': req?.body?.old_image || ""
                });
                
                if (imageResponse.status == Constants.STATUS_ERROR) {
                    /** Send error response **/
                    return res.send({
                        status: Constants.STATUS_ERROR,
                        message: [{ 'param': 'image', 'msg': imageResponse.message }],
                    });
                }

                let timeDetails = [];
                if (splashData.length > 0) {
                    splashData.map(data => {
                        if (data) {
                            timeDetails.push({
                                "day": parseInt(data.day),
                                "start_time": parseFloat(data.start_time.replace(":", ".")),
                                "end_time": parseFloat(data.end_time.replace(":", ".")),
                            });
                        }
                    });
                }

                let updateData = {
                    description: {
                        ar: req?.body?.description_in_arabic || "",
                        en: req?.body?.description_in_english || ""
                    },
                    time_details: timeDetails,
                    is_default: false,
                    modified: getUtcDate()
                };

                if (defaultChecked) updateData.is_default = true;

                if (imageResponse.fileName) updateData['image'] = imageResponse.fileName;

                /** For add and edit sliders details */
                await this.collectionDb.updateOne(
                    { _id: sliderId },
                    {
                        $set: updateData,
                        $setOnInsert: {
                            status: Constants.ACTIVE,
                            type: sliderType,
                            added_by: new ObjectId(req.session.user._id),
                            created: getUtcDate()
                        }
                    },
                    { upsert: true }
                );

                /** For success message */
                let message = (isEditable) ? res.__("admin.slider_management.splash_screen_has_been_updated_successfully", displayType) : res.__("admin.slider_management.splash_screen_has_been_added_successfully", displayType);
                if (!isEditable) req.flash(Constants.STATUS_SUCCESS, message);
                
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "slider_management/" + sliderType,
                    message: message
                });

                /** Save system logs */
                saveSystemLogs(req, res, {
                    user_id: req.session.user._id,
                    parent_id: sliderId,
                    activity_module: Constants.SYSTEM_LOG_MODULE_SLIDER_MANAGEMENT,
                    activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                    additional_details: {}
                });
            } else {
                let response = {};
                if (isEditable) {
                    /** Get slider details **/
                    response = await this.getSliderDetails(req, res, next);
                    if (response.status != Constants.STATUS_SUCCESS) {
                        return res.status(400).send({
                            status: Constants.STATUS_ERROR,
                            message: response.message
                        });
                    }
                }
                
                /** Render add_edit page  **/
                res.render('add_edit', {
                    slider_result: response?.result || {},
                    is_editable: isEditable,
                    slider_type: sliderType,
                    display_type: displayType,
                    layout: false
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for delete slider
     *
     * @param req 	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return null
     */
    async deleteSlider(req, res, next) {
        try {
            let sliderId = new ObjectId(req.params.id);
            let sliderType = req.params.type;
            let displayType = toTitleCase(sliderType.replace(RegExp("_", "g"), " "));

            /**For get slider image from sliders collection  */
            const sliderResult = await this.collectionDb.findOne(
                { _id: sliderId },
                { projection: { _id: 1, image: 1 } }
            );

            /**For check slider result */
            if (!sliderResult) {
                req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
                return res.redirect(Constants.WEBSITE_ADMIN_URL + "slider_management/" + sliderType);
            }

            /**For delete slider */
            await this.collectionDb.deleteOne({ _id: sliderId });

            /** Send success response **/
            req.flash(Constants.STATUS_SUCCESS, res.__("admin.slider_management.splash_screen_deleted_successfully", displayType));
            res.redirect(Constants.WEBSITE_ADMIN_URL + "slider_management/" + sliderType);

            /**Call function for remove file from directory */
            if (sliderResult.image) {
                removeFile({ file_path: Constants.SLIDER_FILE_PATH + sliderResult.image });
            }

            /** save System logs */
            saveSystemLogs(req, res, {
                user_id: req.session.user._id,
                parent_id: sliderId,
                activity_module: Constants.SYSTEM_LOG_MODULE_SLIDER_MANAGEMENT,
                activity_type: Constants.ACTIVITY_TYPE_DELETE,
                additional_details: {}
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for update status
     *
     * @param req 	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return null
     */
    async updateSliderStatus(req, res, next) {
        try {
            let sliderId = new ObjectId(req.params.id);
            let sliderType = req.params.type;
            let displayType = toTitleCase(sliderType.replace(RegExp("_", "g"), " "));

            /** For update slider status*/
            await this.collectionDb.updateOne(
                { _id: sliderId },
                {
                    $set: {
                        modified: getUtcDate(),
                        status: (req.params.status == Constants.ACTIVE) ? Constants.DEACTIVE : Constants.ACTIVE
                    }
                }
            );

            /** Send success response **/
            req.flash(Constants.STATUS_SUCCESS, res.__("admin.slider_management.splash_screen_status_has_been_updated_successfully", displayType));
            res.redirect(Constants.WEBSITE_ADMIN_URL + "slider_management/" + sliderType);

            /** save System logs */
            saveSystemLogs(req, res, {
                user_id: req.session.user._id,
                parent_id: sliderId,
                activity_module: Constants.SYSTEM_LOG_MODULE_SLIDER_MANAGEMENT,
                activity_type: Constants.ACTIVITY_TYPE_STATUS_UPDATE,
                additional_details: {}
            });
        } catch (error) {
            next(error);
        }
    }
}
export default SliderManagement; 