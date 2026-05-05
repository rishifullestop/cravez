import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, exportToExcel, configDatatable, round, currencyFormat } from '../../../../utils/index.mjs';

// Model for area performance half yearly report
export default class AreaPerformanceHalfYearlyReport {

    constructor(db) {
        this.db = db;
    }

    /**
    * Function to get listing page
    *
    * @param req 	As Request Data
    * @param res 	As Response Data
    *
    * @return render/json
    */
    async getAreaPerformanceHalfYearlyList(req, res, next) {
        try {
            if (isPost(req)) {
                let restaurantIds   = (req.body.restaurant_ids) ? req.body.restaurant_ids : [];
                let areaIds       = (req.body.area_ids) ? req.body.area_ids : [];
                const collection    = this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);

                if (restaurantIds.constructor != Array) restaurantIds = [restaurantIds];
                if (areaIds.constructor != Array) areaIds = [areaIds];

                /** Configure Datatable conditions*/
                let dataTableConfig = await configDatatable(req, res, null);

                let commonConditions = {
                    area_id: { $in: arrayToObject(areaIds) },
                };

                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);
                if (restaurantIds.length > 0) dataTableConfig.conditions.restaurant_id = { $in: arrayToObject(restaurantIds) };

                asyncParallel({
                    records: (callback) => {
                        collection.aggregate([
                            { $match: dataTableConfig.conditions },
                            {
                                $group: {
                                    _id: { $dateToString: { format: "%Y-%m", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE } },
                                    total_orders    : { $sum: "$total_orders" },
                                    total_amount    : { $sum: "$total_amount" },
                                    cravez_payout   : { $sum: "$cravez_payout" },
                                    area_id         : { $first: "$area_id" },
                                    restaurant_id   : { $first: "$restaurant_id" },
                                    restaurant_name : { $last: "$restaurant_name" },
                                    area_name       : { $last: "$area_name" },
                                    year            : { $first: { "$year": "$date" } },
                                    month           : { $first: { "$month": "$date" } },
                                    delivery_fees   : { $sum: { $cond: [{ $eq: ["$delivery_type", "cravez"] }, "$delivery_fee", 0]}},
                                },
                            },
                            {
                                $addFields: {
                                    avg_chq_value: { $divide: ["$total_amount", "$total_orders"] },
                                }
                            },
                            { $sort: { year: 1, month: 1 } },
                        ]).toArray().then(result=>{
                            var column = [
                                {
                                    "title": res.__("admin.report.month_year"),
                                    "data": "year_month"
                                },
                                {
                                    "title": res.__("admin.report.no_of_orders"),
                                    "data": "total_orders"
                                },
                                {
                                    "title": res.__("admin.report.sales_value"),
                                    "data": "total_amount"
                                },
                                {
                                    "title": res.__("admin.report.delivery_fees"),
                                    "data": "delivery_fees"
                                }, {
                                    "title": res.__("admin.report.avg_cheque_value"),
                                    "data": "avg_chq_value"
                                },
                                {
                                    "title": res.__("admin.report.cravez_commission"),
                                    "data": "cravez_payout"
                                },

                            ];
                            var d = new Date();
                            var n = d.getFullYear();
                            let dataArray =[];
                            var year_month =[];
                            if(result.length>0){
                                if (result[0].month < 6) {
                                    year_month = [
                                        Constants.REPORT_CHART_MONTH_NAMES[result[0].month] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + result[0].year,
                                        Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                                    ];
                                } else if (result[0].month == 6) {
                                    year_month = [
                                        Constants.REPORT_CHART_MONTH_NAMES[result[0].month] + '-' + result[0].year,
                                        Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                                    ]
                                } else if (result[0].month < 12 && result[0].month >= 7) {
                                    year_month = [
                                        Constants.REPORT_CHART_MONTH_NAMES[result[0].month] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                                    ]
                                } else if (result[0].month == 12) {
                                    year_month = [
                                        Constants.REPORT_CHART_MONTH_NAMES[result[0].month] + '-' + result[0].year,
                                    ]
                                }
                                for (let i = result[0].year; i <= n; i++) {
                                    var deliveryFees = 0;
                                    var avgChqValue = 0;
                                    var totalOrders = 0;
                                    var totalAmount = 0;
                                    var cravezPayout = 0;
                                    var deliveryFees1 = 0;
                                    var avgChqValue1 = 0;
                                    var totalOrders1 = 0;
                                    var totalAmount1 = 0;
                                    var cravezPayout1 = 0;
                                    var yearMonth ="";
                                    var yearMonth1 = "";
                                    var obj = {};
                                    var obj1 = {};
                                    var flag = false;
                                    var flag1 = false;
                                    result.map(record => {
                                        if (record.month <= 6 && record.year == i) {
                                            flag = true;
                                            deliveryFees += record.delivery_fees;
                                            avgChqValue += record.avg_chq_value;
                                            totalOrders += record.total_orders;
                                            totalAmount += record.total_amount;
                                            cravezPayout += record.cravez_payout;
                                            yearMonth = Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i;
                                        } else if (record.month <= 12 && record.month >= 7 && record.year == i) {
                                            flag1 = true;
                                            deliveryFees1 += record.delivery_fees;
                                            avgChqValue1 += record.avg_chq_value;
                                            totalOrders1 += record.total_orders;
                                            totalAmount1 += record.total_amount;
                                            cravezPayout1 += record.cravez_payout;
                                            yearMonth1 = Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i;
                                        }
                                    });
                                    if (i == result[0].year){
                                        if (year_month.length==2){
                                            obj['year_month'] = year_month[0];
                                            obj1['year_month'] = year_month[1];
                                        } else if (year_month.length == 1){
                                            obj1['year_month'] = year_month[0];
                                        }
                                    } else{
                                        obj['year_month'] = yearMonth;
                                        obj1['year_month'] = yearMonth1;
                                    }
                                    if(flag){
                                        obj.delivery_fees = currencyFormat(deliveryFees);
                                        obj.avg_chq_value = currencyFormat(totalAmount / totalOrders);
                                        obj.total_orders = totalOrders;
                                        obj.total_amount = currencyFormat(totalAmount);
                                        obj.cravez_payout = currencyFormat(cravezPayout);
                                        dataArray.push(obj);
                                    }
                                    if(flag1){
                                        obj1.delivery_fees = currencyFormat(deliveryFees1);
                                        obj1.avg_chq_value = currencyFormat(totalAmount1 / totalOrders1);
                                        obj1.total_orders = totalOrders1;
                                        obj1.total_amount = currencyFormat(totalAmount1);
                                        obj1.cravez_payout = currencyFormat(cravezPayout1);
                                        dataArray.push(obj1);
                                    }
                                }

                            }
                            var jsonData = {
                                "data": dataArray,
                                "columns": column
                            };
                            callback(null, jsonData);
                        }).catch(err=>{
                            callback(err, {});
                        });
                    },
                }, (err, response) => {
                    /** Send response **/
                    res.send({
                        status          : (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
                        draw            : dataTableConfig.result_draw,
                        data            : response.records.data,
                        columns         : response.records.columns,
                    });
                });
            } else {

                /**Get dropdown list **/
                getDropdownList(req, res, next, {
                    collections: [{
                        collection: Tables.RESTAURANTS,
                        columns: ["_id", ["name", Constants.DEFAULT_LANGUAGE_CODE]],
                        conditions: {
                            is_deleted: Constants.NOT_DELETED
                        },
                    },
                    {
                        collection: Tables.AREAS,
                        columns: ["_id", ["name", Constants.DEFAULT_LANGUAGE_CODE]],
                        conditions: {
                            is_active: Constants.ACTIVE,
                        },
                    }]
                }).then(response => {

                    /** render listing page **/
                    req.breadcrumbs(BREADCRUMBS['admin/report/area_performance_half_yearly_report']);
                    res.render('area_performance_half_yearly_report', {
                        restaurant_list : response?.final_html_data?.[0] || "",
                        area_list       : response?.final_html_data?.[1] || "",
                    });
                }).catch(next);
            }
        } catch (error) {
            return next(error);
        }
    };//End getAreaPerformanceHalfYearlyList()


    /**
     *  Function for export area performance Half Yearly report
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As 	Callback argument to the middleware function
     *
     * @return null
    */
    async areaPerformanceHalfYearlyReportExport(req, res, next) {
        try {
            let restaurantIds	= (req.query.restaurant_ids)? (req.query.restaurant_ids).split(","): [];
            let areaIds		    = (req.query.area_ids) ? (req.query.area_ids).split(",")   	: [];

            if (restaurantIds.constructor != Array) restaurantIds = [restaurantIds];
            if (areaIds.constructor != Array) areaIds = [areaIds];

            let exportConditions= {
                area_id: { $in: arrayToObject(areaIds) },
            };

            if (restaurantIds.length > 0) exportConditions.restaurant_id = { $in: arrayToObject(restaurantIds) };

            /** Get details **/
            const branch_wise_processed_orders = this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);

            branch_wise_processed_orders.aggregate([
                { $match: exportConditions },
                {
                    $group: {
                        _id             : { $dateToString: { format: "%Y-%m", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE } },
                        total_orders    : { $sum: "$total_orders" },
                        total_amount    : { $sum: "$total_amount" },
                        cravez_payout   : { $sum: "$cravez_payout" },
                        restaurant_id   : { $first: "$restaurant_id" },
                        area_id         : { $first: "$area_id" },
                        restaurant_name : { $last: "$restaurant_name" },
                        area_name       : { $last: "$area_name" },
                        year            : { $first: { "$year": "$date" } },
                        month           : { $first: { "$month": "$date" } },
                        delivery_fees   : { $sum: { $cond: [{ $eq: ["$delivery_type", "cravez"] }, "$delivery_fee", 0] } },
                    },
                },
                {
                    $addFields: {
                        avg_chq_value: { $divide: ["$total_amount", "$total_orders"] },
                    }
                },
                { $sort: { year: 1, month: 1 } },
            ]).toArray().then(result=>{
                var d = new Date();
                var n = d.getFullYear();
                let dataArray = [];
                var year_month = [];
                if (result.length > 0) {
                    if (result[0].month < 6) {
                        year_month = [
                            Constants.REPORT_CHART_MONTH_NAMES[result[0].month] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + result[0].year,
                            Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                        ];
                    } else if (result[0].month == 6) {
                        year_month = [
                            Constants.REPORT_CHART_MONTH_NAMES[result[0].month] + '-' + result[0].year,
                            Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                        ]
                    } else if (result[0].month < 12 && result[0].month >= 7) {
                        year_month = [
                            Constants.REPORT_CHART_MONTH_NAMES[result[0].month] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                        ]
                    } else if (result[0].month == 12) {
                        year_month = [
                            Constants.REPORT_CHART_MONTH_NAMES[result[0].month] + '-' + result[0].year,
                        ]
                    }
                    for (let i = result[0].year; i <= n; i++) {
                        var deliveryFees = 0;
                        var avgChqValue = 0;
                        var totalOrders = 0;
                        var totalAmount = 0;
                        var cravezPayout = 0;
                        var deliveryFees1 = 0;
                        var avgChqValue1 = 0;
                        var totalOrders1 = 0;
                        var totalAmount1 = 0;
                        var cravezPayout1 = 0;
                        var yearMonth = "";
                        var yearMonth1 = "";
                        var obj = {};
                        var obj1 = {};
                        var flag = false;
                        var flag1 = false;
                        let areaName = '';
                        result.map(record => {
                            if (record.month <= 6 && record.year == i) {
                                flag = true;
                                deliveryFees += record.delivery_fees;
                                avgChqValue += record.avg_chq_value;
                                totalOrders += record.total_orders;
                                totalAmount += record.total_amount;
                                cravezPayout += record.cravez_payout;
                                areaName = record.area_name[Constants.DEFAULT_LANGUAGE_CODE];
                                yearMonth = Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i;
                            } else if (record.month <= 12 && record.month >= 7 && record.year == i) {
                                flag1 = true;
                                deliveryFees1 += record.delivery_fees;
                                avgChqValue1 += record.avg_chq_value;
                                totalOrders1 += record.total_orders;
                                totalAmount1 += record.total_amount;
                                cravezPayout1 += record.cravez_payout;
                                areaName = record.area_name[Constants.DEFAULT_LANGUAGE_CODE];
                                yearMonth1 = Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i;
                            }
                        });
                        if (i == result[0].year) {
                            if (year_month.length == 2) {
                                obj['year_month'] = year_month[0];
                                obj1['year_month'] = year_month[1];
                            } else if (year_month.length == 1) {
                                obj1['year_month'] = year_month[0];
                            }
                        } else {
                            obj['year_month'] = yearMonth;
                            obj1['year_month'] = yearMonth1;
                        }
                        if (flag) {
                            obj.delivery_fees = currencyFormat(deliveryFees);
                            obj.avg_chq_value = currencyFormat(totalAmount / totalOrders);
                            obj.total_orders = totalOrders;
                            obj.total_amount = currencyFormat(totalAmount);
                            obj.cravez_payout = currencyFormat(cravezPayout);
                            obj.area_name = areaName;
                            dataArray.push(obj);
                        }
                        if (flag1) {
                            obj1.delivery_fees = currencyFormat(deliveryFees1);
                            obj1.avg_chq_value = currencyFormat(totalAmount1 / totalOrders1);
                            obj1.total_orders = totalOrders1;
                            obj1.total_amount = currencyFormat(totalAmount1);
                            obj1.cravez_payout = currencyFormat(cravezPayout1);
                            obj1.area_name = areaName;
                            dataArray.push(obj1);
                        }
                    }
                }
                let temp        = [];
                let commonColls = [];

                /** Define excel heading label **/

                commonColls = [
                    res.__("admin.report.area_name"),
                    res.__("admin.report.month_year"),
                    res.__("admin.report.no_of_orders"),
                    res.__("admin.report.sales_value"),
                    res.__("admin.report.delivery_fees"),
                    res.__("admin.report.avg_cheque_value"),
                    res.__("admin.report.cravez_commission"),
                ];

                if (dataArray && dataArray.length > 0) {
                    dataArray.map(records => {
                        let buffer = [
                            (records.area_name) ? records.area_name : "",
                            (records.year_month) ? records.year_month : "",
                            (records.total_orders)      ? round(records.total_orders) : 0,
                            (records.total_amount)      ? (records.total_amount) : currencyFormat(0),
                            (records.delivery_fees)     ? (records.delivery_fees) : currencyFormat(0),
                            (records.avg_chq_value)     ? (records.avg_chq_value) : currencyFormat(0),
                            (records.cravez_payout)     ? (records.cravez_payout) : currencyFormat(0),
                        ];
                        temp.push(buffer);
                    });
                }
                /**  Function to export data in excel format **/
                exportToExcel(req, res, {
                    file_prefix     : "AreaPerformanceHalfYearlyReport",
                    heading_columns : commonColls,
                    export_data     : temp
                });
            }).catch(next);
        } catch (error) {
            return next(error);
        }
    };// end areaPerformanceHalfYearlyReportExport()
}
