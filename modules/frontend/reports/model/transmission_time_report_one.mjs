import { ObjectId } from 'mongodb';
import { parallel as asyncParallel } from 'async';
import BREADCRUMBS from "../../../../breadcrumbs.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { round, arrayToObject,isPost, getDropdownList, configDatatable, exportToExcel, newDate,} from "../../../../utils/index.mjs";

export default class TransmissionTimeReportOne {
    constructor(db) {
        this.db = db;
    }  

    /**
     * Function to get transmission time report
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     *
     * @return render/json
     */
    async getTransmissionTimeReportOneList (req, res, next) {
        try {
            let restaurantId = (req.session.user.restaurant_id) ? new ObjectId(req.session.user.restaurant_id) : '';
            if (isPost(req)) {
                let limit           = (req.body.length) ? parseInt(req.body.length) : Constants.FRONT_LISTING_LIMIT;
                let skip            = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                let fromDate        = (req.body.from_date) ? req.body.from_date : "";
                let toDate          = (req.body.to_date) ? req.body.to_date : "";
                let branchIds       = (req.body.branch_ids) ? req.body.branch_ids : [];

                branchIds = (branchIds && branchIds.constructor === Array) ? branchIds : [branchIds];

                const collection = this.db.collection(Tables.OPERATION_REPORTS);

                /** Configure Datatable conditions*/
                let dataTableConfig = await configDatatable(req, res, null);
                    
                let commonConditions = { restaurant_id: restaurantId };

                /** Condition for date */
                if (fromDate != "" && toDate != "") {
                    commonConditions["date"] = {
                        $gte: newDate(fromDate),
                        $lte: newDate(toDate),
                    };
                }

                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);
                if (branchIds.length > 0) dataTableConfig.conditions.branch_id = { $in: arrayToObject(branchIds) };

                asyncParallel({
                    records: (callback) => {
                        /** Get list of all orders of guest and customer **/
                        collection.aggregate([
                            {$match: dataTableConfig.conditions },
                            {$sort : dataTableConfig.sort_conditions },
                            {$lookup: {
                                "from"          : Tables.RESTAURANT_BRANCHES,
                                "localField"    : "branch_id",
                                "foreignField"  : "_id",
                                "as"            : "branch_details"
                            }},
                            {$group: {
                                _id: {
                                    "restaurant_id" : "$restaurant_id",
                                    "branch_id"     : "$branch_id",
                                },
                                branch_id           : { $first: "$branch_id" },
                                restaurant_id       : { $first: "$restaurant_id" },
                                total_orders        : { $sum: "$total_orders" },
                                successful_orders   : { $sum: "$delivered_orders" },
                                tt_3_to_5           : { $sum: "$tt_3_to_5" },
                                tt_5_to_7           : { $sum: "$tt_5_to_7" },
                                tt_7_to_10          : { $sum: "$tt_7_to_10" },
                                tt_more_than_10     : { $sum: "$tt_more_than_10" },
                                tt_less_than_3      : { $sum: "$tt_less_than_3" },
                                branch_name         : { $first: { $arrayElemAt: ["$branch_details.name", 0] } },
                            }},
                            {$skip : skip },
                            {$limit: limit },
                        ]).toArray().then(result => {
                            callback(null, result);
                        }).catch(err => {
                            callback(err, null);
                        });
                    },
                    total_records: (callback) => {
                        /** Get total number of records **/
                        collection.aggregate([
                            { $match: commonConditions },
                            {
                                $group: {
                                    _id: {
                                        "restaurant_id" : "$restaurant_id",
                                        "branch_id"     : "$branch_id",
                                    },
                                }
                            }
                        ]).toArray().then(result => {
                            callback(null, result.length);
                        }).catch(err => {
                            callback(err, null);
                        });
                    },
                    filter_records: (callback) => {
                        /** Get filtered records counting **/
                        collection.aggregate([
                            { $match: dataTableConfig.conditions },
                            {
                                $group: {
                                    _id: {
                                        "restaurant_id" : "$restaurant_id",
                                        "branch_id"     : "$branch_id",
                                    },
                                }
                            }
                        ]).toArray().then(result => {
                            callback(null, result.length);
                        }).catch(err => {
                            callback(err, null);
                        });
                    }
                }, (err, response) => {
                    /** Send response **/
                    res.send({
                        status          : (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
                        draw            : dataTableConfig.result_draw,
                        data            : response.records,
                        recordsFiltered : response.filter_records,
                        recordsTotal    : response.total_records,
                    });
                });
            } else {
                /**Get dropdown list **/
                let dropdownList = await getDropdownList(req, res, next, {
                    collections: [
                        {
                            collection  : Tables.RESTAURANT_BRANCHES,
                            columns     : ["_id", ["name", Constants.DEFAULT_LANGUAGE_CODE]],
                            conditions  : {
                                restaurant_id   : restaurantId,
                                is_active       : Constants.ACTIVE,
                            },
                        }
                    ]
                });               

                /** render listing page **/
                req.breadcrumbs(BREADCRUMBS['reports/transmission_time_report_one']);
                res.render('transmission_time_report_one', {
                    branch_list: dropdownList?.final_html_data?.["0"] || "",
                });
            }
        } catch (error) {
            return next(error);
        }
    };//End getTransmissionTimeReportOneList()

    /**
     *  Function for transmission time report export
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As 	Callback argument to the middleware function
     *
     * @return null
    */
    async getTransmissionTimeReportOneExport (req, res, next) {
        try {
            let restaurantId    = (req.session.user.restaurant_id) ? new ObjectId(req.session.user.restaurant_id) : '';
            let fromDate        = (req.query.from_date) ? req.query.from_date : "";
            let toDate          = (req.query.to_date) ? req.query.to_date : "";
            let branchIds       = (req.query.branch_ids) ? (req.query.branch_ids).split(",") : [];

            if (branchIds.constructor != Array) branchIds = [branchIds];

            let exportConditions = { restaurant_id: restaurantId };
            /** Condition for date */
            if (fromDate != "" && toDate != "") {
                exportConditions["date"] = {
                    $gte: newDate(fromDate),
                    $lte: newDate(toDate),
                };
            }

            if (branchIds.length > 0) exportConditions.branch_id = { $in: arrayToObject(branchIds) };

            /** Get order details **/
            const operation_reports = this.db.collection(Tables.OPERATION_REPORTS);
            let result = await operation_reports.aggregate([
                { $match: exportConditions },
                { $sort : { _id: Constants.SORT_DESC } },
                {
                    $lookup: {
                        "from"          : Tables.RESTAURANT_BRANCHES,
                        "localField"    : "branch_id",
                        "foreignField"  : "_id",
                        "as"            : "branch_details"
                    }
                },
                {
                    $addFields: {
                        branch_name: { $arrayElemAt: ["$branch_details.name", 0] },
                    }
                },
                {
                    $group: {
                        _id: {
                            "restaurant_id" : "$restaurant_id",
                            "branch_id"     : "$branch_id",
                        },
                        branch_id           : { $first: "$branch_id" },
                        total_orders        : { $sum: "$total_orders" },
                        successful_orders   : { $sum: "$delivered_orders" },
                        tt_3_to_5           : { $sum: "$tt_3_to_5" },
                        tt_5_to_7           : { $sum: "$tt_5_to_7" },
                        tt_7_to_10          : { $sum: "$tt_7_to_10" },
                        tt_more_than_10     : { $sum: "$tt_more_than_10" },
                        tt_less_than_3      : { $sum: "$tt_less_than_3" },
                        branch_name         : { $first: "$branch_name" },
                    }
                },
            ]).toArray();

            
            /** Define excel heading label **/
            let commonColls = [
                res.__("reports.branch_name"),
                res.__("reports.successful_orders"),
                res.__("reports.less_than_3_min"),
                res.__("reports.3_to_5_min"),
                res.__("reports.5_to_7_min"),
                res.__("reports.7_to_10_min"),
                res.__("reports.more_than_10_min"),
            ];

            let temp = [];
            if (result?.length > 0) {
                result.map(records => {
                    temp.push([
                        records?.branch_name?.[Constants.DEFAULT_LANGUAGE_CODE] || "",
                        (records.successful_orders) ? round(records.successful_orders) : 0,
                        (records.tt_less_than_3)    ? round((records.tt_less_than_3 / records.total_orders) * 100) + "" + res.__("reports.percent") : 0,
                        (records.tt_3_to_5)         ? round((records.tt_3_to_5 / records.total_orders) * 100) + "" + res.__("reports.percent") : 0,
                        (records.tt_5_to_7)         ? round((records.tt_5_to_7 / records.total_orders) * 100) + "" + res.__("reports.percent") : 0,
                        (records.tt_7_to_10)        ? round((records.tt_7_to_10 / records.total_orders) * 100) + "" + res.__("reports.percent") : 0,
                        (records.tt_more_than_10)   ? round((records.tt_more_than_10 / records.total_orders) * 100) + "" + res.__("reports.percent") : 0,
                    ]);
                });
            } 

            /**  Function to export data in excel format **/
            exportToExcel(req, res, {
                file_prefix     : "TransmissionTimeReportOne",
                heading_columns : commonColls,
                export_data     : temp
            });
        } catch (error) {
            return next(error);
        }
    };// end getTransmissionTimeReportOneExport()
}
