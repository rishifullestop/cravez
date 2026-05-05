import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, exportToExcel, configDatatable } from '../../../../utils/index.mjs';

// Model for areas contribution half yearly comparison report
export default class AreasContributionHalfYearlyComparisonReport {

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
    async getAreasContributionHalfYearlyList(req, res, next) {
        try {
            if (isPost(req)) {
                let cityIds         = (req.body.city_ids) ? req.body.city_ids : [];
                let type            = (req.body.type) ? req.body.type : '';
                const collection    = this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);

                if (cityIds.constructor != Array) cityIds = [cityIds];

                /** Configure Datatable conditions*/
                let dataTableConfig = await configDatatable(req, res, null);

                let commonConditions = { area_id: { $ne: "" } };
                if (cityIds.length > 0) dataTableConfig.conditions.city_id = { $in: arrayToObject(cityIds) };
                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

                asyncParallel({
                    records: (callback) => {
                        collection.aggregate([
                            { $match: dataTableConfig.conditions },
                            {
                                $group: {
                                    _id: {
                                        year_month: { $dateToString: { format: "%Y-%m", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE } },
                                        area_id :"$area_id",
                                    },
                                    total_orders    : { $sum: "$total_orders" },
                                    total_amount    : { $sum: "$total_amount" },
                                    cravez_payout   : { $sum: "$cravez_payout" },
                                    area_id         : { $first: "$area_id" },
                                    area_name       : { $first: "$area_name" },
                                    year            : { $first: { "$year": "$date" } },
                                    month           : { $first: { "$month": "$date" } },
                                    delivery_fees   : { $sum: { $cond: [{ $eq: ["$delivery_type", Constants.DELIVERY_BY_CRAVEZ] }, "$delivery_fee", 0]}},
                                },
                            },
                            {$sort: { year: Constants.SORT_ASC, month: Constants.SORT_ASC } },
                        ]).toArray().then(result=>{
                            var column = [
                                {
                                    "title": res.__("admin.report.area_name") || "",
                                    "data" : "area_name"
                                }
                            ];
                            var finalObj = [];
                            var dataArray = [];
                            if (result.length>0){
                                if(result[0].month <6){
                                    let obj = {
                                        "title": Constants.REPORT_CHART_MONTH_NAMES[result[0].month] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + result[0].year,
                                        "data": Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + result[0].year,
                                    };
                                    column.push(obj);
                                    let obj1 = {
                                        "title": Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                                        "data": Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                                    };
                                    column.push(obj1);
                                } else if (result[0].month == 6) {
                                    let obj = {
                                        "title": Constants.REPORT_CHART_MONTH_NAMES[result[0].month] + '-' + result[0].year,
                                        "data": Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + result[0].year,
                                    };
                                    column.push(obj);
                                    let obj1 = {
                                        "title": Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                                        "data": Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                                    };
                                    column.push(obj1);
                                } else if (result[0].month < 12 && result[0].month >=7 ) {
                                    let obj = {
                                        "title": Constants.REPORT_CHART_MONTH_NAMES[result[0].month] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                                        "data": Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                                    };
                                    column.push(obj);
                                } else if (result[0].month == 12) {
                                    let obj = {
                                        "title": Constants.REPORT_CHART_MONTH_NAMES[result[0].month] + '-' + result[0].year,
                                        "data": Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                                    };
                                    column.push(obj);
                                }
                                var d = new Date();
                                var n = d.getFullYear();
                                var month = d.getMonth();
                                for (let i = result[0].year+1; i<=n ; i++){
                                    if(i!=n){
                                        let obj = {
                                            "title": Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i,
                                            "data": Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' +i,
                                        };
                                        column.push(obj);
                                        let obj1 = {
                                            "title": Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i,
                                            "data": Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i,
                                        };
                                        column.push(obj1);
                                    } else{
                                        if (month <=6){
                                            let obj = {
                                                "title": Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i,
                                                "data": Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i,
                                            };
                                            column.push(obj);
                                        } else if (month <= 12 && month >= 7){
                                            let obj = {
                                                "title": Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i,
                                                "data": Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i,
                                            };
                                            column.push(obj);
                                            let obj1 = {
                                                "title": Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i,
                                                "data": Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i,
                                            };
                                            column.push(obj1);
                                        }
                                    }
                                }
                                var listOfArea = [];
                                result.forEach(sample => {
                                    listOfArea.push(String(sample.area_id));
                                });

                                var uniqueArray = [];
                                for (let i = 0, l = listOfArea.length; i < l; i++) {
                                    if (uniqueArray.indexOf(listOfArea[i]) === -1 && listOfArea[i] !== '')
                                        uniqueArray.push(listOfArea[i]);
                                }
                                for (let i = result[0].year; i <= n; i++) {
                                    uniqueArray.forEach(area => {
                                        var flag = false;
                                        let data = '';
                                        var firstHalf = 0;
                                        var secondHalf = 0;
                                        let areaName = '';
                                        let areaId = '';
                                        result.forEach(record=>{
                                            if (record.month <= 6 && record.year == i && String(record.area_id) == area){
                                                flag = true;
                                                if (type == Constants.NO_OF_ORDERS) {
                                                    data = (record.total_orders) ? record.total_orders : 0;
                                                    firstHalf+=data;
                                                } else if (type == Constants.SALES_VALUE) {
                                                    data = (record.total_amount) ? (record.total_amount) : (0);
                                                    firstHalf += data;
                                                } else if (type == Constants.DELIVERY_FEES) {
                                                    data = (record.delivery_fees) ? (record.delivery_fees) : (0);
                                                    firstHalf += data;
                                                } else if (type == Constants.COMMISSION) {
                                                    data = (record.cravez_payout) ? (record.cravez_payout) : (0);
                                                    firstHalf += data;
                                                }
                                                areaName = record.area_name[Constants.DEFAULT_LANGUAGE_CODE];
                                                areaId = record.area_id;
                                            } else if (record.month <= 12 && record.month >= 7 && record.year == i && String(record.area_id) == area) {
                                                flag = true;
                                                if (type == Constants.NO_OF_ORDERS) {
                                                    data = (record.total_orders) ? record.total_orders : 0;
                                                    secondHalf += data;
                                                } else if (type == Constants.SALES_VALUE) {
                                                    data = (record.total_amount) ? (record.total_amount) : (0);
                                                    secondHalf += data;
                                                } else if (type == Constants.DELIVERY_FEES) {
                                                    data = (record.delivery_fees) ? (record.delivery_fees) : (0);
                                                    secondHalf += data;
                                                } else if (type == Constants.COMMISSION) {
                                                    data = (record.cravez_payout) ? (record.cravez_payout) : (0);
                                                    secondHalf += data;
                                                }
                                                areaName = record.area_name[Constants.DEFAULT_LANGUAGE_CODE];
                                                areaId = record.area_id;
                                            }
                                        });
                                        var obj = {};
                                        if(flag){
                                            if (type == Constants.NO_OF_ORDERS) {
                                                obj[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = (firstHalf == 0) ? "" : firstHalf;
                                                obj[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = (secondHalf == 0) ? "" : secondHalf;
                                            } else{
                                                obj[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = (firstHalf == 0) ? "" : (firstHalf);
                                                obj[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = (secondHalf == 0) ? "" : (secondHalf);

                                            }

                                            obj.area_name = areaName;
                                            obj.area_id = areaId;
                                            dataArray.push(obj);
                                        }
                                    });
                                }
                                uniqueArray.forEach(list => {
                                    finalObj.push({
                                        area_id: list
                                    });
                                });

                                dataArray.forEach(sample => {
                                    var sampleArea = String(sample.area_id);
                                    finalObj.forEach((obj, index) => {
                                        if (obj.area_id === sampleArea) {
                                            finalObj[index] = Object.assign(sample, obj);
                                        }
                                    });
                                });
                            }
                            var jsonData = {
                                "data": finalObj,
                                "columns": column
                            };

                            callback(null, jsonData);
                        }).catch(next);
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
                        collection: Tables.CITIES,
                        columns: ["_id", ["name", Constants.DEFAULT_LANGUAGE_CODE]],
                        conditions: {},
                    }]
                }).then(response => {
                    /** render listing page **/
                    req.breadcrumbs(BREADCRUMBS['admin/report/areas_contribution_half_yearly_report']);
                    res.render('areas_contribution_half_yearly_comparison_report', {
                        city_list: response?.final_html_data?.[0] || "",
                    });
                }).catch(next);
            }
        } catch (error) {
            return next(error);
        }
    };//End getAreasContributionHalfYearlyList()


    /**
     *  Function for export areas Contribution half yearly report
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As 	Callback argument to the middleware function
     *
     * @return null
    */
    async areasContributionHalfYearlyReportExport(req, res, next) {
        try {
            let type        = (req.query.type) ? (req.query.type): "";
            let cityIds     = (req.query.city_ids) ? (req.query.city_ids).split(",")   	: [];

            if (cityIds.constructor != Array) cityIds = [cityIds];

            let exportConditions = { area_id: { $ne: "" } };
            if (cityIds.length > 0) exportConditions.city_id = { $in: arrayToObject(cityIds) };

            /** Get details **/
            const branch_wise_processed_orders = this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);
            branch_wise_processed_orders.aggregate([
                { $match: exportConditions },
                {$lookup:	{
                    "from" 			: 	Tables.CITIES,
                    "localField" 	:	"city_id",
                    "foreignField" 	: 	"_id",
                    "as" 			: 	"city_details"
                }},
                {$group: {
                    _id: {
                        year_month  : { $dateToString: { format: "%Y-%m", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE } },
                        area_id: "$area_id",
                    },
                    total_orders    : { $sum: "$total_orders" },
                    total_amount    : { $sum: "$total_amount" },
                    cravez_payout   : { $sum: "$cravez_payout" },
                    area_id         : { $first: "$area_id" },
                    area_name       : { $first: "$area_name" },
                    city_name       : { $first: {$arrayElemAt: ["$city_details.name",0]} },
                    year            : { $first: { "$year": "$date" } },
                    month           : { $first: { "$month": "$date" } },
                    delivery_fees   : { $sum: { $cond: [{ $eq: ["$delivery_type", Constants.DELIVERY_BY_CRAVEZ] }, "$delivery_fee", 0] } },
                }},
                { $sort: { year: Constants.SORT_ASC, month: Constants.SORT_ASC } },
            ]).toArray().then(result=>{
                var column = [
                    {
                        "title": res.__("admin.report.report_type") || "",
                        "data": "report_type"
                    },
                    {
                        "title": res.__("admin.report.city_name") || "",
                        "data": "city_name"
                    },
                    {
                        "title": res.__("admin.report.area_name") || "",
                        "data": "area_name"
                    }
                ];
                var finalObj = [];
                var dataArray = [];
                if (result.length > 0) {
                    if (result[0].month < 6) {
                        let obj = {
                            "title": Constants.REPORT_CHART_MONTH_NAMES[result[0].month] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + result[0].year,
                            "data": Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + result[0].year,
                        };
                        column.push(obj);
                        let obj1 = {
                            "title": Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                            "data": Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                        };
                        column.push(obj1);
                    } else if (result[0].month == 6) {
                        let obj = {
                            "title": Constants.REPORT_CHART_MONTH_NAMES[result[0].month] + '-' + result[0].year,
                            "data": Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + result[0].year,
                        };
                        column.push(obj);
                        let obj1 = {
                            "title": Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                            "data": Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                        };
                        column.push(obj1);
                    } else if (result[0].month < 12 && result[0].month >= 7) {
                        let obj = {
                            "title": Constants.REPORT_CHART_MONTH_NAMES[result[0].month] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                            "data": Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                        };
                        column.push(obj);
                    } else if (result[0].month == 12) {
                        let obj = {
                            "title": Constants.REPORT_CHART_MONTH_NAMES[result[0].month] + '-' + result[0].year,
                            "data": Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                        };
                        column.push(obj);
                    }
                    var d = new Date();
                    var n = d.getFullYear();
                    var month = d.getMonth();
                    for (let i = result[0].year + 1; i <= n; i++) {
                        if (i != n) {
                            let obj = {
                                "title": Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i,
                                "data": Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i,
                            };
                            column.push(obj);
                            let obj1 = {
                                "title": Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i,
                                "data": Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i,
                            };
                            column.push(obj1);
                        } else {
                            if (month <= 6) {
                                let obj = {
                                    "title": Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i,
                                    "data": Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i,
                                };
                                column.push(obj);
                            } else if (month <= 12 && month >= 7) {
                                let obj = {
                                    "title": Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i,
                                    "data": Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i,
                                };
                                column.push(obj);
                                let obj1 = {
                                    "title": Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i,
                                    "data": Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i,
                                };
                                column.push(obj1);
                            }
                        }
                    }

                    var listOfArea = [];
                    result.forEach(sample => {
                        listOfArea.push(String(sample.area_id));
                    });

                    var uniqueArray = [];
                    for (let i = 0, l = listOfArea.length; i < l; i++) {
                        if (uniqueArray.indexOf(listOfArea[i]) === -1 && listOfArea[i] !== '')
                            uniqueArray.push(listOfArea[i]);
                    }
                    for (let i = result[0].year; i <= n; i++) {
                        uniqueArray.forEach(area => {
                            var flag = false;
                            let data = '';
                            var firstHalf = 0;
                            var secondHalf = 0;
                            let areaName = '';
                            let cityName = '';
                            let areaId = '';
                            result.forEach(record => {
                                if (record.month <= 6 && record.year == i && String(record.area_id) == area) {
                                    flag = true;
                                    if (type == Constants.NO_OF_ORDERS) {
                                        data = (record.total_orders) ? record.total_orders : 0;
                                        firstHalf += data;
                                    } else if (type == Constants.SALES_VALUE) {
                                        data = (record.total_amount) ? (record.total_amount) : (0);
                                        firstHalf += data;
                                    } else if (type == Constants.DELIVERY_FEES) {
                                        data = (record.delivery_fees) ? (record.delivery_fees) : (0);
                                        firstHalf += data;
                                    } else if (type == Constants.COMMISSION) {
                                        data = (record.cravez_payout) ? (record.cravez_payout) : (0);
                                        firstHalf += data;
                                    }
                                    areaName = record?.area_name?.[Constants.DEFAULT_LANGUAGE_CODE] || "";
                                    cityName = record?.city_name?.[Constants.DEFAULT_LANGUAGE_CODE] || "";
                                    areaId = record.area_id;

                                } else if (record.month <= 12 && record.month >= 7 && record.year == i && String(record.area_id) == area) {
                                    flag = true;
                                    if (type == Constants.NO_OF_ORDERS) {
                                        data = (record.total_orders) ? record.total_orders : 0;
                                        secondHalf += data;
                                    } else if (type == Constants.SALES_VALUE) {
                                        data = (record.total_amount) ? (record.total_amount) : (0);
                                        secondHalf += data;
                                    } else if (type == Constants.DELIVERY_FEES) {
                                        data = (record.delivery_fees) ? (record.delivery_fees) : (0);
                                        secondHalf += data;
                                    } else if (type == Constants.COMMISSION) {
                                        data = (record.cravez_payout) ? (record.cravez_payout) : (0);
                                        secondHalf += data;
                                    }
                                    areaName = record?.area_name?.[Constants.DEFAULT_LANGUAGE_CODE] || "";
                                    cityName = record?.city_name?.[Constants.DEFAULT_LANGUAGE_CODE] || "";
                                    areaId = record.area_id;
                                }
                            });
                            var obj = {};
                            if (flag) {
                                if (type == Constants.NO_OF_ORDERS) {
                                    obj[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = (firstHalf == 0) ? "" : firstHalf;
                                    obj[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = (secondHalf == 0) ? "" : secondHalf;
                                } else {
                                    obj[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = (firstHalf == 0) ? "" : (firstHalf);
                                    obj[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = (secondHalf == 0) ? "" : (secondHalf);
                                }
                                obj.area_name = areaName;
                                obj.city_name = cityName;
                                obj.area_id = areaId;
                                dataArray.push(obj);
                            }
                        });
                    }
                    uniqueArray.forEach(list => {
                        finalObj.push({
                            area_id: list
                        });
                    });

                    dataArray.forEach(sample => {
                        var sampleArea = String(sample.area_id);
                        finalObj.forEach((obj, index) => {
                            if (obj.area_id === sampleArea) {
                                finalObj[index] = Object.assign(sample, obj);
                            }
                        });
                    });
                }

                let temp        = [];
                let commonColls = [];

                /** Define excel heading label **/
                column.forEach(col => {
                    commonColls.push(col.title);
                });

                if (finalObj && finalObj.length > 0) {
                    finalObj.forEach(records => {
                        let buffer = [
                            Constants.AREAS_CONTRIBUTION_REPORT_TYPE[type],
                            (records.city_name) ? records.city_name : "",
                            (records.area_name) ? records.area_name : "",
                        ];
                        for (let i=3;i<column.length;i++){
                            buffer.push(records[column[i].data]);
                        }
                        temp.push(buffer);
                    });
                }
                /**  Function to export data in excel format **/
                exportToExcel(req, res, {
                    file_prefix     : "AreasContributionHalfYearlyReport",
                    heading_columns : commonColls,
                    export_data     : temp
                });
            }).catch(next);
        } catch (error) {
            return next(error);
        }
    };// end areasContributionHalfYearlyReportExport()
}
