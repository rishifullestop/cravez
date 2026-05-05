import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, moveUploadedFile, appendFileExistData, getDropdownList, exportToExcel, arrayToObject } from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { saveSystemLogs } from "../../../../services/index.mjs";

class ManageVehicles {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.DRIVER_VEHICLES);
       
        this.exportNumber = 0;
        this.exportFilterConditions = {};
        this.exportSortConditions = {};
        this.exportCommonConditions = {};
        this.exportSortConditions[this.exportNumber] = { _id: Constants.SORT_DESC };
    }

    /**
     * Function to get manage vehicle list
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getManageVehicleList(req, res, next) {
        try {
            if (isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                let driverIds = (req.body.driver_id) ? req.body.driver_id : '';
                let exportCount = (req.body.export_count) ? req.body.export_count : 0;

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);
                
                let commonConditions = {};
                if(!driverIds){
                    // Get available driver IDs
                    const availableDriverIds = await this.db.collection(Tables.USERS).distinct("_id", Constants.DRIVER_COMMON_CONDITIONS);
                    
                    if (availableDriverIds.length > 0) {
                        commonConditions['driver_id'] = { $in: arrayToObject(availableDriverIds) };
                    }
                }

                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

                /** Conditions for driver name */
                if (driverIds) {
                    if (driverIds.constructor !== Array) driverIds = [driverIds];
                    dataTableConfig.conditions['driver_id'] = { $in: arrayToObject(driverIds) };
                }

                /** Set conditions for export report **/
                this.exportCommonConditions = commonConditions;
                this.exportFilterConditions[exportCount] = dataTableConfig.conditions;
                this.exportSortConditions[exportCount] = dataTableConfig.sort_conditions;

                // Get list or count of driver vehicles
                let dbRes = await this.collectionDb.aggregate([
                    { $match: dataTableConfig.conditions },
                    {
                        $facet : {
                            list : [
                                {$sort: dataTableConfig.sort_conditions },
                                {$skip: skip },
                                {$limit: limit },
                                {$lookup: {
                                    from: Tables.USERS,
                                    localField: "driver_id",
                                    foreignField: "_id",
                                    as: "driver_details"
                                }},
                                {$project: {
                                    _id: 1,plate_number: 1, licence: 1, manufacture: 1, year: 1, model: 1, status: 1, vehicle_type: 1, location: 1, color: 1, driver_id: 1, driver_name: { $arrayElemAt: ["$driver_details.full_name", 0] },
                                }}
                            ],
                            count: [
                                {$count: "count"},
                            ],
                        }
                    }
                ]).toArray();

                // Process licence image paths
                let result = dbRes?.[0]?.list ||[];
                if (result.length > 0) {
                    const fileResponse = await appendFileExistData({
                        "file_url": Constants.MANAGE_VEHICLE_URL,
                        "file_path": Constants.MANAGE_VEHICLE_FILE_PATH,
                        "result": result,
                        "database_field": "licence"
                    });
                    result = fileResponse?.result || [];
                }

                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data			:   result,
                    recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
                });
            } else {
                this.exportNumber++;

                /** Set dropdown options **/
                const dropDownResponse = await getDropdownList(req, res, next, {
                    collections: [
                        {
                            collection: Tables.USERS,
                            columns: ["_id", "full_name"],
                            conditions: Constants.DRIVER_COMMON_CONDITIONS,
                        },
                    ]
                });

                /** render manage vehicle listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/manage_vehicles/list']);
                res.render('list', {
                    driver_list: dropDownResponse?.final_html_data?.[0] || "",
                    export_count: this.exportNumber
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for export area records
     *
     * @param req 	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return null
     */
    async exportData(req, res, next) {
        try {
            let exportType = (req.params.export_type) ? req.params.export_type : "";
            let exportCount = (req.params.export_count) ? req.params.export_count : 0;

            /** conditions **/
            let filterCondition = this.exportFilterConditions?.[exportCount] || {};
            let sortConditions = this.exportSortConditions?.[exportCount] || this.exportSortConditions?.[0] || {_id: Constants.SORT_DESC};
            let conditions = (exportType == Constants.EXPORT_FILTERED) ? filterCondition : this.exportCommonConditions || {};

            /** Get driver vehicles details **/
            const result = await this.collectionDb.aggregate([
                { $match: conditions },
                { $sort: sortConditions },
                {
                    $lookup: {
                        from: Tables.USERS,
                        localField: "driver_id",
                        foreignField: "_id",
                        as: "driver_details"
                    }
                },
                {
                    $project: {
                        _id: 1,
                        plate_number: 1,
                        licence: 1,
                        manufacture: 1,
                        year: 1,
                        model: 1,
                        status: 1,
                        vehicle_type: 1,
                        location: 1,
                        color: 1,
                        driver_id: 1,
                        driver_name: { $arrayElemAt: ["$driver_details.full_name", 0] },
                    }
                },
            ]).toArray();
            
            /** Define excel heading label **/
            let commonColls = [
                res.__("admin.manage_vehicles.driver_name"),
                res.__("admin.manage_vehicles.plate_number"),
                res.__("admin.manage_vehicles.vehicle_type"),
                res.__("admin.manage_vehicles.model"),
                res.__("admin.manage_vehicles.manufacture"),
                res.__("admin.manage_vehicles.year"),
                res.__("admin.manage_vehicles.color"),
                res.__("admin.manage_vehicles.location"),
                res.__("admin.system.status")
            ];
            
            let temp = [];
            if (result && result.length > 0) {
                result.forEach(records => {
                    let buffer = [
                        (records.driver_name) ? records.driver_name : "",
                        (records.plate_number) ? records.plate_number : "",
                        (records.vehicle_type) ? Constants.VEHICLE_TYPE[records.vehicle_type] : "",
                        (records.model) ? records.model : "",
                        (records.manufacture) ? records.manufacture : "",
                        (records.year) ? records.year : "",
                        (records.color) ? records.color : "",
                        (records.location) ? records.location : "",
                        (records.status) ? Constants.VEHICLE_STATUS[records.status] : ""
                    ];
                    temp.push(buffer);
                });
            }

            /** Function to export data in excel format **/
            exportToExcel(req, res, {
                file_prefix: "VehicleReport",
                heading_columns: commonColls,
                export_data: temp
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get driver vehicle detail
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return json
     */
    async getDriverVehicleDetails(req, res, next) {
        try {
            let vehicleId = (req.params.id) ? req.params.id : "";

            /** Get driver vehicle details **/
            const result = await this.collectionDb.findOne(
                { _id: new ObjectId(vehicleId) },
                {
                    projection: {
                        _id: 1, plate_number: 1, licence: 1, model: 1, manufacture: 1, year: 1, vehicle_type: 1, status: 1, color: 1, location: 1, driver_id: 1
                    }
                }
            );

            /** Send error response */
            if (!result) {
                return {
                    status: Constants.STATUS_ERROR,
                    message: res.__("admin.system.invalid_access")
                };
            }

            /** Set options for append image full path **/
            const fileResponse = await appendFileExistData({
                "file_url": Constants.MANAGE_VEHICLE_URL,
                "file_path": Constants.MANAGE_VEHICLE_FILE_PATH,
                "result": [result],
                "database_field": "licence"
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
     * Function for add or update vehicle
     *
     * @param req 	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async addEditVehicle(req, res, next) {
        try {
            let isEditable = (req.params.id) ? true : false;

            if (isPost(req)) {
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let vehicleId = (req.params.id) ? new ObjectId(req.params.id) : new ObjectId();
                let driverId = (req.body.driver_id) ? new ObjectId(req.body.driver_id) : "";

                /**Function for upload file */
                const imageResponse = await moveUploadedFile(req, res, {
                    'image': req?.files?.licence || "",
                    'filePath': Constants.MANAGE_VEHICLE_FILE_PATH,
                    'oldPath': req?.body?.old_image || ""
                });

                if (imageResponse.status == Constants.STATUS_ERROR) {
                    /** Send error response **/
                    return res.send({
                        status: Constants.STATUS_ERROR,
                        message: [{ 'param': 'licence', 'msg': imageResponse.message }],
                    });
                }

                /** Set update data */
                let updateData = {
                    driver_id: driverId,
                    plate_number: req?.body?.plate_number || "",
                    vehicle_type: req?.body?.vehicle_type || "",
                    model: req?.body?.model || "",
                    manufacture: req?.body?.manufacture || "",
                    year: req?.body?.year ? parseInt(req.body.year) : "",
                    color: req?.body?.color || "",
                    status: req?.body?.status || "",
                    location: req?.body?.location || "",
                    modified: getUtcDate()
                };

                if (imageResponse?.fileName) updateData['licence'] = imageResponse.fileName;

                /** Save driver vehicle details **/
                await this.collectionDb.updateOne(
                    { _id: vehicleId },
                    {
                        $set: updateData,
                        $setOnInsert: {
                            added_by: new ObjectId(req.session.user._id),
                            created: getUtcDate()
                        }
                    },
                    { upsert: true }
                );

                if (!isEditable) {
                    /** Update vehicle details in users collection **/
                    await this.db.collection(Tables.USERS).updateOne(
                        {
                            _id: driverId,
                            vehicle_id: vehicleId
                        },
                        {
                            $set: {
                                vehicle_type: req.body.vehicle_type,
                                modified: getUtcDate()
                            }
                        }
                    );
                }

                /** Send success response **/
                let message = (isEditable) ? res.__("admin.manage_vehicles.vehicle_has_been_updated_successfully") : res.__("admin.manage_vehicles.vehicle_has_been_added_successfully");
                if (!isEditable) req.flash(Constants.STATUS_SUCCESS, message);
                
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "/manage_vehicles",
                    message: message
                });

                /** save System logs */
                saveSystemLogs(req, res, {
                    user_id: req.session.user._id,
                    parent_id: vehicleId,
                    activity_module: Constants.SYSTEM_LOG_MODULE_MANAGE_VEHICLE,
                    activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                    additional_details: {}
                });
            } else {
                let response = {};
                if (isEditable) {
                    /** Get driver vehicle details **/
                    response = await this.getDriverVehicleDetails(req, res, next);
                    if (response.status != Constants.STATUS_SUCCESS) {
                        return res.status(400).send({
                            status: Constants.STATUS_ERROR,
                            message: response.message
                        });
                    }
                }
                
                /** Set dropdown options **/
                let result = response?.result || {};
                const dropDownResponse = await getDropdownList(req, res, next, {
                    collections: [
                        {
                            collection: Tables.USERS,
                            columns: ["_id", "full_name"],
                            conditions: Constants.DRIVER_COMMON_CONDITIONS,
                            selected: [result?.driver_id || ""]
                        },
                    ]
                });

                /** Render add edit page */
                res.render('add_edit', {
                    layout: false,
                    result: result,
                    is_editable: isEditable,
                    driver_list: dropDownResponse?.final_html_data?.[0] || ""
                });
            }
        } catch (error) {
            next(error);
        }
    }
}
export default ManageVehicles; 