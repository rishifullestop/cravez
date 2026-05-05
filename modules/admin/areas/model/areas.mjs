import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, getUniqueId, getCityList, exportToExcel } from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { saveSystemLogs} from "../../../../services/index.mjs";

class Areas {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.AREAS);
        this.exportNumber = 0;
        this.exportFilterConditions = {};
        this.exportSortConditions = {};
        this.exportCommonConditions = {};
        this.exportSortConditions[this.exportNumber] = {_id: Constants.SORT_DESC};
    }

    /**
     * Function to get areas list
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getAreasList(req, res, next) {
        try {
            if(isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                let exportCount = (req.body.export_count) ? req.body.export_count : 0;

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);

                /** Set conditions for export report **/
                this.exportFilterConditions[exportCount] = dataTableConfig.conditions;
                this.exportSortConditions[exportCount] = dataTableConfig.sort_conditions;

                // Get list or count of areas
                let dbRes = await this.collectionDb.aggregate([
                    {$match: dataTableConfig.conditions},
                    {
                        $facet: {
                            list: [
                                {$sort: dataTableConfig.sort_conditions},
                                {$skip: skip},
                                {$limit: limit},
                                {$lookup: {
                                    from: Tables.CITIES,
                                    localField: "city_id",
                                    foreignField: "_id",
                                    as: "city_data"
                                }},
                                {$project: {
                                    _id: 1,
                                    name: 1,
                                    is_active: 1,
                                    area_id: 1,
                                    city_name: {$arrayElemAt: ["$city_data.name." + Constants.DEFAULT_LANGUAGE_CODE, 0]}
                                }}
                            ],
                            count: [
                                {$count: "count"}
                            ]
                        }
                    }
                ]).toArray();

                /** Send response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data: dbRes?.[0]?.list || [],
                    recordsTotal: dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0
                });
            } else {
                this.exportNumber++;

                /** get dropdown options for city list **/
                const ciryList = await getCityList(req, res, next);

                /** render areas listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/area/list']);
                res.render('list', {
                    city_list: ciryList,
                    export_count: this.exportNumber
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get area detail
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return json
     */
    async getAreaDetails(req, res, next) {
        try {
            let areaId = (req.params.id) ? req.params.id : "";

            /** Get area details **/
            const result = await this.collectionDb.findOne({
                _id: new ObjectId(areaId)
            }, {projection: {_id: 1, name: 1, city_id: 1}});

            /** Send error response */
            if(!result) {
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
            next(error);
        }
    }

    /**
     * Function for add or update area
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async addEditArea(req, res, next) {
        try {
            let isEditable = (req.params.id) ? true : false;
            let areaId = (req.params.id) ? new ObjectId(req.params.id) : new ObjectId();

            if(isPost(req)) {
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);

                let nameEnglish = req.body.name_english;
                let nameArabic = req.body.name_arabic;
                let cityId = new ObjectId(req.body.city_id);

                // Get unique ID for new areas
                let areaUniqueId = {};
                if(!isEditable) {
                    const uniqueIdResponse = await getUniqueId(req, res, next, {type: "areas"});
                    areaUniqueId = uniqueIdResponse.result || {};
                }

                /** set data in object **/
                let updateData = {
                    name: {
                        ar: nameArabic,
                        en: nameEnglish
                    },
                    city_id: cityId,
                    modified: getUtcDate()
                };

                /** Save area details **/
                await this.collectionDb.updateOne({
                    _id: areaId
                }, {
                    $set: updateData,
                    $setOnInsert: {
                        area_id: areaUniqueId,
                        is_active: Constants.ACTIVE,
                        created: getUtcDate()
                    }
                }, {upsert: true});

                /** save System logs */
                saveSystemLogs(req, res, {
                    user_id: req.session.user._id,
                    parent_id: areaId,
                    activity_module: Constants.SYSTEM_LOG_MODULE_AREAS,
                    activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                    additional_details: {}
                });

                /** Send success response **/
                let message = (isEditable) ? res.__("admin.areas.area_has_been_updated_successfully") : res.__("admin.areas.area_has_been_added_successfully");
                if(!isEditable) req.flash(Constants.STATUS_SUCCESS, message);

                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "areas",
                    message: message,
                    current_id: areaId
                });
            } else {
                let response = {};
                if(isEditable) {
                    /** Get area details **/
                    response = await this.getAreaDetails(req, res, next);
                    if(response.status != Constants.STATUS_SUCCESS) {
                        /** Send error response **/
                        req.flash(Constants.STATUS_ERROR, response.message);
                        return res.redirect(Constants.WEBSITE_ADMIN_URL + "areas");
                    }
                }
                let result = (response.result) ? response.result : {};
                let cityId = (result.city_id) ? new ObjectId(result.city_id) : "";

                /** Get city list **/
                const cityList = await getCityList(req, res, next, {city_id: cityId});

                /** Render edit page  **/
                req.breadcrumbs(BREADCRUMBS[`admin/area/${isEditable && 'edit' || 'add'}`]);
                res.render('add_edit', {
                    layout      : false,
                    result      : result,
                    is_editable : isEditable,
                    city_list   : cityList
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for update area's status
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return null
     */
    async updateAreaStatus(req, res, next) {
        try {
            let areaId = (req.params.id) ? req.params.id : "";
            let areaStatus = (req.params.status == Constants.ACTIVE) ? Constants.DEACTIVE : Constants.ACTIVE;

            /** Update area record **/
            await this.collectionDb.updateOne({
                _id: new ObjectId(areaId)
            }, {
                $set: {
                    is_active: areaStatus,
                    modified: getUtcDate()
                }
            });

            /** save System logs */
            saveSystemLogs(req, res, {
                user_id: req.session.user._id,
                parent_id: areaId,
                activity_module: Constants.SYSTEM_LOG_MODULE_AREAS,
                activity_type: Constants.ACTIVITY_TYPE_STATUS_UPDATE,
                additional_details: {}
            });

            /** Send success response **/
            req.flash(Constants.STATUS_SUCCESS, res.__("admin.areas.area_status_has_been_updated_successfully"));
            res.redirect(Constants.WEBSITE_ADMIN_URL + "areas");
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for export area records
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return null
     */
    async exportData(req, res, next) {
        try {
            let exportType = (req.params.export_type) ? req.params.export_type : "";
            let exportCount = (req.params.export_count) ? req.params.export_count : 0;

            /** conditions **/
            let filterCondition = (this.exportFilterConditions[exportCount]) ? this.exportFilterConditions[exportCount] : {};
            let sortConditions = (this.exportSortConditions[exportCount]) ? this.exportSortConditions[exportCount] : this.exportSortConditions[0];
            let conditions = (exportType == Constants.EXPORT_FILTERED) ? filterCondition : this.exportCommonConditions;

            /** Get areas details **/
            const result = await this.collectionDb.aggregate([
                {$match: conditions},
                {$sort: sortConditions},
                {$lookup: {
                    from: Tables.CITIES,
                    localField: "city_id",
                    foreignField: "_id",
                    as: "city_data"
                }},
                {$project: {
                    _id: 1,
                    name: 1,
                    area_id: 1,
                    city_name: {$arrayElemAt: ["$city_data.name." + Constants.DEFAULT_LANGUAGE_CODE, 0]}
                }}
            ]).toArray();

            let temp = [];
            let commonColls = [];

            /** Define excel heading label **/
            commonColls = [
                res.__("admin.areas.area_id"),
                res.__("admin.areas.name_in_english"),
                res.__("admin.areas.name_in_arabic"),
                res.__("admin.areas.city")
            ];

            if(result && result.length > 0) {
                result.map(records => {
                    let buffer = [
                        (records.area_id) ? records.area_id : "",
                        (records.name && records.name.en) ? records.name.en : "",
                        (records.name && records.name.ar) ? records.name.ar : "",
                        (records.city_name) ? records.city_name : ""
                    ];
                    temp.push(buffer);
                });
            }

            /** Function to export data in excel format **/
            exportToExcel(req, res, {
                file_prefix: "AreaReport",
                heading_columns: commonColls,
                export_data: temp
            });
        } catch (error) {
            next(error);
        }
    }
}

export default Areas;