import { ObjectId } from 'mongodb';
import { parallel as asyncParallel } from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, moveUploadedFile, appendFileExistData, getDropdownList, exportToExcel } from '../../../../utils/index.mjs';
import { saveSystemLogs } from '../../../../services/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

class ManageVehicle {
    constructor(db) {
        this.db = db;
        this.driverVehiclesCollection = db.collection(Tables.DRIVER_VEHICLES);
        this.usersCollection = db.collection(Tables.USERS);
        this.driverInOutShiftsCollection = db.collection(Tables.DRIVER_IN_OUT_SHIFTS);

        /** Use in export data **/
        this.exportNumber = 0;
        this.exportFilterConditions = {};
        this.exportSortConditions = {};
        this.exportCommonConditions = {};
        this.exportSortConditions[this.exportNumber] = { _id: Constants.SORT_DESC };
    }

    /**
     * Function to get manage vehicle list
     *
     * @param req As Request Data
     * @param res As Response Data
     * @param next As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getManageVehicleList(req, res, next) {
        try {
            let driverId = (req.params.driver_id) ? req.params.driver_id : "";

            if (isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                let exportCount = (req.body.export_count) ? req.body.export_count : 0;

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);

                let commonConditions = {driver_id: new ObjectId(driverId)};

                dataTableConfig.conditions = Object.assign(commonConditions, dataTableConfig.conditions);

                /** Set conditions for export competition report **/
                this.exportCommonConditions = commonConditions;
                this.exportFilterConditions[exportCount] = dataTableConfig.conditions;
                this.exportSortConditions[exportCount] = dataTableConfig.sort_conditions;

                let dbRes = await this.driverVehiclesCollection.aggregate([
                    {$match: dataTableConfig.conditions },
                    {$facet : {
                        list : [
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit },
                            {$project: {
                                _id: 1, plate_number: 1, licence: 1, manufacture: 1, year: 1, model: 1
                            }}
                        ],
                        count: [
                            {$count: "count"},
                        ],
                    }}
                ]).toArray();

                let result = dbRes?.[0]?.list || [];
                if(result.length){
                    let appendRes = await appendFileExistData({
                        "file_url": Constants.MANAGE_VEHICLE_URL,
                        "file_path": Constants.MANAGE_VEHICLE_FILE_PATH,
                        "result": result,
                        "database_field": "licence"
                    });
                    result = appendRes?.result || [];
                }

                /** Send response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data			:   result,
                    recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
                });
            } else {
                /** render manage vehicle listing page **/
                this.exportNumber++;
                req.breadcrumbs(BREADCRUMBS['admin/manage_vehicle/list']);
                res.render('manage_vehicle_list', {
                    export_count: this.exportNumber,
                    driver_id: driverId
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for assign vehicle to driver
     *
     * @param req As Request Data
     * @param res As Response Data
     * @param next As Callback argument to the middleware function
     *
     * @return null
     */
    async assignVehicleToDriver(req, res, next) {
        try {
            let driverId = (req.params.driver_id) ? new ObjectId(req.params.driver_id) : "";

            /** Get customer details **/
            const result = await this.usersCollection.findOne({ _id: driverId }, { projection: { vehicle_id: 1 } });

            /** Send error response */
            if (!result){
                if(isPost(req)) return res.send({status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access")});
                return res.status(400).send({status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access")});
            }

            if (isPost(req)) {
                let vehicleId = (req.body.vehicle) ? req.body.vehicle : '';


                const response = await new Promise((resolve, reject) => {
                    asyncParallel({
                        new_vehicle: (callback) => {
                            /** Find vehicle type **/
                            this.driverVehiclesCollection.findOne({
                                _id: new ObjectId(vehicleId),
                                driver_id: driverId
                            }, { projection: { vehicle_type: 1 } }).then(findResult => {
                                callback(null, findResult);
                            }).catch(callback);
                        },
                        in_shift_detail: (callback) => {
                            if (!result.vehicle_id) return callback(null, null);

                            /** Get shift in out detail **/
                            this.driverInOutShiftsCollection.findOne({
                                driver_id: driverId,
                                vehicle_id: result.vehicle_id,
                                type: Constants.IN_SHIFT,
                            }, { projection: { _id: 1 } }).then(shiftResult => {
                                callback(null, shiftResult);
                            }).catch(callback);
                        }
                    }, (err, response) => {
                        if (err) return reject(err);
                        resolve(response);
                    });
                });

                /** Send error response **/
                if (response.in_shift_detail) {
                    return res.send({
                        status: Constants.STATUS_ERROR,
                        message: res.__("admin.user_management.you_can_not_assign_vehicle_untill_the_driver_mark_out_shift_from_old_vehicle")
                    });
                }

                /** Send error response **/
                if (!response.new_vehicle) {
                    return res.send({
                        status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access")
                    });
                }

                /** Update details **/
                await this.usersCollection.updateOne({
                    _id: driverId
                }, {
                    $set: {
                        vehicle_id: new ObjectId(vehicleId),
                        vehicle_type: response?.new_vehicle?.vehicle_type || "",
                        modified: getUtcDate()
                    }
                });

                /*send success response */
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    message: res.__("admin.user_management.vehicle_has_been_assigned_successfully")
                });
            } else {
                /**Get vehicle list **/
                let vehicleId = result?.vehicle_id || "";
                const dropDownRes = await getDropdownList(req, res, next, {
                    collections: [{
                        collection: Tables.DRIVER_VEHICLES,
                        columns: ["_id", "plate_number"],
                        selected: [vehicleId],
                        conditions: { driver_id: driverId }
                    }]
                });

                if (dropDownRes.status != Constants.STATUS_SUCCESS) return res.status(400).send(dropDownRes);

                /** Render assign vehicle page **/
                res.render('assign_vehicle', {
                    layout: false,
                    driver_id: driverId,
                    vehicle_list: dropDownRes?.final_html_data?.[0] || ""
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get driver vehicle detail
     *
     * @param req As Request Data
     * @param res As Response Data
     * @param next As Callback argument to the middleware function
     *
     * @return json
     */
    async getDriverVehicleDetails(req, res, next) {
        try {
            let vehicleId = (req.params.id) ? req.params.id : "";
            let driverId = (req.params.driver_id) ? req.params.driver_id : "";

            /** Get driver vehicle details **/
            const result = await this.driverVehiclesCollection.findOne({
                _id: new ObjectId(vehicleId),
                driver_id: new ObjectId(driverId)
            }, { projection: { _id: 1, plate_number: 1, licence: 1, model: 1, manufacture: 1, year: 1, vehicle_type: 1, status: 1, color: 1, location: 1 } });

            /** Send error response */
            if (!result) {
                return {
                    status: Constants.STATUS_ERROR,
                    message: res.__("admin.system.invalid_access")
                };
            }

            /** Set options for append image full path **/
            let options = {
                "file_url": Constants.MANAGE_VEHICLE_URL,
                "file_path": Constants.MANAGE_VEHICLE_FILE_PATH,
                "result": [result],
                "database_field": "licence"
            };

            /** Append image with full path **/
            const fileResponse = await appendFileExistData(options);

            return {
                result: (fileResponse.result[0]) ? fileResponse.result[0] : {},
                status: Constants.STATUS_SUCCESS
            };
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for add or update vehicle
     *
     * @param req As Request Data
     * @param res As Response Data
     * @param next As Callback argument to the middleware function
     *
     * @return render/json
     */
    async addEditVehicle(req, res, next) {
        try {
            let isEditable = (req.params.id) ? true : false;
            let driverId = (req.params.driver_id) ? new ObjectId(req.params.driver_id) : "";

            if (isPost(req)) {
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let vehicleId = (req.params.id) ? new ObjectId(req.params.id) : new ObjectId();

                let licenceFile = "";
                if(req?.files?.licence){
                    let uploadRes = await moveUploadedFile(req, res, {
                        'image': req.files.licence,
                        'filePath': Constants.MANAGE_VEHICLE_FILE_PATH
                    });

                    licenceFile = uploadRes?.fileName || "";

                    /** Send error response when file upload failed */
                    if (uploadRes.status == Constants.STATUS_ERROR) {
                        return res.send({status: Constants.STATUS_ERROR, message: [{ 'param': 'licence', 'msg': uploadRes.message }] });
                    }
                }

                /** Set update data */
                let updateData = {
                    plate_number: req.body.plate_number,
                    vehicle_type: req.body.vehicle_type,
                    model: (req.body.model) ? req.body.model : "",
                    manufacture: (req.body.manufacture) ? req.body.manufacture : "",
                    year: (req.body.year) ? parseInt(req.body.year) : "",
                    color: (req.body.color) ? req.body.color : "",
                    status: req.body.status,
                    location: req.body.location,
                    modified: getUtcDate()
                };

                if (licenceFile) updateData['licence'] = licenceFile;

                /** Save driver vehicle details **/
                await this.driverVehiclesCollection.updateOne({
                    _id: vehicleId,
                    driver_id: driverId
                }, {
                    $set: updateData,
                    $setOnInsert: {
                        added_by: new ObjectId(req.session.user._id),
                        created: getUtcDate()
                    }
                }, { upsert: true });

                if (isEditable) {
                    /** Update vehicle details in users collection **/
                    await this.usersCollection.updateOne({
                        _id: driverId,
                        vehicle_id: vehicleId
                    }, {
                        $set: {
                            vehicle_type: req.body.vehicle_type,
                            modified: getUtcDate()
                        }
                    });
                }

                /** Send success response **/
                let message = (isEditable) ? res.__("admin.user_management.vehicle_has_been_updated_successfully") : res.__("admin.user_management.vehicle_has_been_added_successfully");
                if (!isEditable) req.flash(Constants.STATUS_SUCCESS, message);
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "/user_management/manage_vehicle/" + driverId,
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
                        /** Send error response **/
                        req.flash(Constants.STATUS_ERROR, response.message);
                        return res.redirect(Constants.WEBSITE_ADMIN_URL + "/user_management/manage_vehicle/" + driverId);
                    }
                }

                /** Render add edit vehicle page */
                res.render('add_edit_vehicle', {
                    layout: false,
                    result: (response.result) ? response.result : {},
                    is_editable: isEditable,
                    driver_id: driverId
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for export vehicle records
     *
     * @param req As Request Data
     * @param res As Response Data
     * @param next As Callback argument to the middleware function
     *
     * @return null
     */
    async exportData(req, res, next) {
        try {
            let driverId = (req.params.driver_id) ? req.params.driver_id : "";
            let exportType = (req.params.export_type) ? req.params.export_type : "";
            let exportCount = (req.params.export_count) ? req.params.export_count : 0;

            /** conditions **/
            let filterCondition = (this.exportFilterConditions[exportCount]) ? this.exportFilterConditions[exportCount] : {};
            let sortConditions = (this.exportSortConditions[exportCount]) ? this.exportSortConditions[exportCount] : (this.exportSortConditions?.[0] || {_id: Constants.SORT_DESC});
            let conditions = (exportType == Constants.EXPORT_FILTERED) ? filterCondition : this.exportCommonConditions;

            if(!Object.keys(conditions).length) conditions = {driver_id: new ObjectId(driverId)};

            /** Get users details **/
            const result = await this.driverVehiclesCollection.find(conditions).sort(sortConditions).toArray();

            let temp = [];
            let commonColls = [];

            /** Define excel heading label ** */
            commonColls = [
                res.__("admin.user_management.plate_number"),
                res.__("admin.user_management.vehicle_type"),
                res.__("admin.user_management.model"),
                res.__("admin.user_management.manufacture"),
                res.__("admin.user_management.year"),
                res.__("admin.user_management.colour"),
                res.__("admin.user_management.status"),
                res.__("admin.user_management.location")
            ];

            if (result && result.length > 0) {
                result.map(records => {
                    let buffer = [
                        records.plate_number,
                        records?.vehicle_type && Constants.VEHICLE_TYPE?.[records.vehicle_type] || "",
                        records.model,
                        records.manufacture,
                        records.year,
                        records.color,
                        records?.status && Constants.VEHICLE_STATUS?.[records.status] || "",
                        records.location
                    ];
                    temp.push(buffer);
                });
            }

            /**  Function to export data in excel format ** */
            exportToExcel(req, res, {
                file_prefix: "VehicleReport",
                heading_columns: commonColls,
                export_data: temp
            });
        } catch (error) {
            next(error);
        }
    }
}

export default ManageVehicle;