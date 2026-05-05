import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, exportToExcel, configDatatable, round, currencyFormat } from '../../../../utils/index.mjs';

// Model for areas contribution report
export default class AreasContributionReport {

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
    async getAreasContributionList(req, res, next) {
        try {
            if (isPost(req)) {
                let year            = (req.body.year) ? parseInt(req.body.year) 	: "";
                let yearType        = (req.body.year_type) ? (req.body.year_type)   : "";
                let cityIds         = (req.body.city_ids) ? req.body.city_ids : [];
                let type            = (req.body.type) ? req.body.type : '';
                const collection    = this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);

                if (cityIds.constructor != Array) cityIds = [cityIds];

                /** Configure Datatable conditions*/
                let dataTableConfig = await configDatatable(req, res, null);
                let yearMonthConditions = { year: year };
                if (yearType == Constants.FIRST_HALF) {
                    yearMonthConditions['month'] = { $gte: 1, $lte: 6 };
                } else {
                    yearMonthConditions['month'] = { $gte: 7, $lte: 12 };
                }
                let commonConditions = { area_id :{$ne:""}};
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
                                    delivery_fees   : { $sum: { $cond: [{ $eq: ["$delivery_type", "cravez"] }, "$delivery_fee", 0]}},
                                },
                            },
                            { $match: yearMonthConditions },
                            { $sort: { month: Constants.SORT_ASC} },
                        ]).toArray().then(result => {
                            let column = [
                                {
                                    "title": res.__("admin.report.area_name") || "",
                                    "data" : "area_name"
                                }
                            ];
                            if (yearType == Constants.FIRST_HALF){
                                for (let i=1;i<=6;i++){
                                    let obj = {
                                        "title": Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year,
                                        "data": Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year
                                    };
                                    column.push(obj);
                                }
                            } else if (yearType == Constants.SECOND_HALF) {
                                for (let i = 7; i <= 12; i++) {
                                    let obj = {
                                        "title": Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year,
                                        "data": Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year
                                    };
                                    column.push(obj);
                                }
                            }
                            column.push({
                                "title": res.__("admin.report.total"),
                                "data": "total"
                            });
                            column.push({
                                "title": res.__("admin.report.average"),
                                "data": "average"
                            });
                            let dataArray = [];
                            result.forEach(record=>{
                                let data = '';
                                if (yearType == Constants.FIRST_HALF && record.month<=6) {
                                    if (type == Constants.NO_OF_ORDERS){
                                        data = (record.total_orders) ? record.total_orders : 0;
                                    } else if (type == Constants.SALES_VALUE){
                                        data = (record.total_amount) ? (record.total_amount) : (0);
                                    } else if (type == Constants.DELIVERY_FEES) {
                                        data = (record.delivery_fees) ? (record.delivery_fees) : (0);
                                    } else if (type == Constants.COMMISSION) {
                                        data = (record.cravez_payout) ? (record.cravez_payout) : (0);
                                    }
                                    let obj = {};
                                    obj[Constants.REPORT_CHART_MONTH_NAMES[record.month] + '-' + record.year] = data;
                                    obj.area_name = record.area_name[Constants.DEFAULT_LANGUAGE_CODE];
                                    obj.area_id = record.area_id;
                                    dataArray.push(obj);
                                } else if (yearType == Constants.SECOND_HALF && record.month <= 12 && record.month >= 7) {
                                    if (type == Constants.NO_OF_ORDERS) {
                                        data = (record.total_orders) ? record.total_orders : 0;
                                    } else if (type == Constants.SALES_VALUE) {
                                        data = (record.total_amount) ? (record.total_amount) : (0);
                                    } else if (type == Constants.DELIVERY_FEES) {
                                        data = (record.delivery_fees) ? (record.delivery_fees) : (0);
                                    } else if (type == Constants.COMMISSION) {
                                        data = (record.cravez_payout) ? (record.cravez_payout) : (0);
                                    }
                                    let obj = {};
                                    obj[Constants.REPORT_CHART_MONTH_NAMES[record.month] + '-' + record.year] = data;
                                    obj.area_name = record.area_name[Constants.DEFAULT_LANGUAGE_CODE];
                                    obj.area_id = record.area_id;
                                    dataArray.push(obj);
                                }
                            });

                            let listOfArea = [];
                            let finalObj = [];
                            dataArray.forEach(sample => {
                                listOfArea.push(String(sample.area_id));
                            });

                            let uniqueArray = [];
                            for (let i = 0, l = listOfArea.length; i < l; i++){
                                if (uniqueArray.indexOf(listOfArea[i]) === -1 && listOfArea[i] !== '')
                                    uniqueArray.push(listOfArea[i]);
                            }

                            uniqueArray.forEach(list => {
                                finalObj.push({
                                    area_id: list
                                });
                            });

                            dataArray.forEach(sample => {
                                let sampleArea = String(sample.area_id);
                                finalObj.forEach((obj, index) => {
                                    if (obj.area_id === sampleArea) {
                                        finalObj[index] = Object.assign(sample, obj);
                                    }
                                });
                            });
                            finalObj.forEach(obj => {
                                let total=0;
                                for (let key in obj) {
                                    if (!isNaN(obj[key])){
                                        total += obj[key];
                                    }
                                }
                                obj.total = round(total);
                                obj.average = round(total/6);
                                for (let key in obj) {
                                    if (type != Constants.NO_OF_ORDERS) {
                                        if (!isNaN(obj[key])) {
                                            obj[key] =currencyFormat(obj[key]);
                                        }
                                    }
                                }
                            });
                            let jsonData = {
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
                        collection: "cities",
                        columns: ["_id", ["name", Constants.DEFAULT_LANGUAGE_CODE]],
                        conditions: {},
                    }]
                }).then(response => {

                    /** render listing page **/
                    req.breadcrumbs(BREADCRUMBS['admin/report/areas_contribution_report']);
                    res.render('areas_contribution_report', {
                        city_list: response?.final_html_data?.[0] || "",
                    });
                }).catch(next);
            }
        } catch (error) {
            next(error);
        }
    };//End getAreasContributionList()


    /**
     *  Function for export areas Contribution report
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As 	Callback argument to the middleware function
     *
     * @return null
    */
    async areasContributionReportExport(req, res, next) {
        try {
            let year        = (req.query.year) ? parseInt(req.query.year) : "";
            let yearType    = (req.query.year_type) ? (req.query.year_type) : "";
            let type        = (req.query.type) ? (req.query.type): "";
            let cityIds     = (req.query.city_ids) ? (req.query.city_ids).split(",")   	: [];

            if (cityIds.constructor != Array) cityIds = [cityIds];

            let exportConditions = { area_id: { $ne: "" } };

            let yearMonthConditions = { year: year };
            if (yearType == Constants.FIRST_HALF) {
                yearMonthConditions['month'] = { $gte: 1, $lte: 6 };
            } else {
                yearMonthConditions['month'] = { $gte: 7, $lte: 12 };
            }
            /** Get details **/
            const branch_wise_processed_orders = this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);
            if (cityIds.length > 0) exportConditions.city_id = { $in: arrayToObject(cityIds) };
            branch_wise_processed_orders.aggregate([
                { $match: exportConditions },
                {$lookup:	{
                    "from" 			: 	"cities",
                    "localField" 	:	"city_id",
                    "foreignField" 	: 	"_id",
                    "as" 			: 	"city_details"
                }},
                {$addFields : {
                    city_name: {$arrayElemAt: ["$city_details.name",0]},
                }},
                {
                    $group: {
                        _id: {
                            year_month  : { $dateToString: { format: "%Y-%m", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE } },
                            area_id: "$area_id",
                        },
                        total_orders    : { $sum: "$total_orders" },
                        total_amount    : { $sum: "$total_amount" },
                        cravez_payout   : { $sum: "$cravez_payout" },
                        area_id         : { $first: "$area_id" },
                        area_name       : { $first: "$area_name" },
                        city_name       : { $first: "$city_name" },
                        year            : { $first: { "$year": "$date" } },
                        month           : { $first: { "$month": "$date" } },
                        delivery_fees   : { $sum: { $cond: [{ $eq: ["$delivery_type", Constants.DELIVERY_BY_CRAVEZ] }, "$delivery_fee", 0] } },
                    },
                },
                { $match: yearMonthConditions },
                { $sort: { month: Constants.SORT_ASC} },
            ]).toArray().then(result => {
                let column = [
                    res.__("admin.report.report_type"),
                    res.__("admin.report.city_name"),
                    res.__("admin.report.area_name"),
                ];
                if (yearType == Constants.FIRST_HALF) {
                    for (let i = 1; i <= 6; i++) {
                        column.push(Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year);
                    }
                } else if (yearType == Constants.SECOND_HALF) {
                    for (let i = 7; i <= 12; i++) {
                        column.push(Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year);
                    }
                }
                column.push(res.__("admin.report.total"));
                column.push(res.__("admin.report.average"));
                let dataArray = [];
                result.forEach(record => {
                    let data = '';
                    if (yearType == Constants.FIRST_HALF && record.month <= 6) {
                        if (type == Constants.NO_OF_ORDERS) {
                            data = (record.total_orders) ? record.total_orders : 0;
                        } else if (type == Constants.SALES_VALUE) {
                            data = (record.total_amount) ? (record.total_amount) : (0);
                        } else if (type == Constants.DELIVERY_FEES) {
                            data = (record.delivery_fees) ? (record.delivery_fees) : (0);
                        } else if (type == Constants.COMMISSION) {
                            data = (record.cravez_payout) ? (record.cravez_payout) : (0);
                        }
                        let obj = {};
                        obj[Constants.REPORT_CHART_MONTH_NAMES[record.month] + '-' + record.year] = data;
                        obj.area_name = record.area_name[Constants.DEFAULT_LANGUAGE_CODE];
                        obj.area_id = record.area_id;
                        obj.city_name = record.city_name[Constants.DEFAULT_LANGUAGE_CODE];
                        dataArray.push(obj);
                    } else if (yearType == Constants.SECOND_HALF && record.month <= 12 && record.month >= 7) {
                        if (type == Constants.NO_OF_ORDERS) {
                            data = (record.total_orders) ? record.total_orders : 0;
                        } else if (type == Constants.SALES_VALUE) {
                            data = (record.total_amount) ? (record.total_amount) : (0);
                        } else if (type == Constants.DELIVERY_FEES) {
                            data = (record.delivery_fees) ? (record.delivery_fees) : (0);
                        } else if (type == Constants.COMMISSION) {
                            data = (record.cravez_payout) ? (record.cravez_payout) : (0);
                        }
                        let obj = {};
                        obj[Constants.REPORT_CHART_MONTH_NAMES[record.month] + '-' + record.year] = data;
                        obj.area_name = record.area_name[Constants.DEFAULT_LANGUAGE_CODE];
                        obj.area_id = record.area_id;
                        obj.city_name = record.city_name[Constants.DEFAULT_LANGUAGE_CODE];
                        dataArray.push(obj);
                    }
                });

                let listOfArea = [];
                let finalObj = [];
                dataArray.forEach(sample => {
                    listOfArea.push(String(sample.area_id));
                });
                let uniqueArray = [];

                for (let i = 0, l = listOfArea.length; i < l; i++) {
                    if (uniqueArray.indexOf(listOfArea[i]) === -1 && listOfArea[i] !== '')
                        uniqueArray.push(listOfArea[i]);
                }
                uniqueArray.forEach(list => {
                    finalObj.push({
                        area_id: list
                    });
                });
                dataArray.forEach(sample => {
                    let sampleArea = String(sample.area_id);
                    finalObj.forEach((obj, index) => {
                        if (obj.area_id === sampleArea) {
                            finalObj[index] = Object.assign(sample, obj);
                        }
                    });
                });
                finalObj.forEach(obj => {
                    let total = 0;
                    for (let key in obj) {
                        if (!isNaN(obj[key])) {
                            total += obj[key];
                        }
                    }
                    obj.Total = round(total);
                    obj.Average = round(total / 6);
                });

                const grandTotal = {};
                finalObj.forEach(field => {
                    for (let [key, value] of Object.entries(field)) {
                        if (grandTotal[key]) {
                            grandTotal[key] += value;
                        } else {
                            grandTotal[key] = value;
                        }
                    }
                });
                finalObj.forEach(obj => {
                    for (let key in obj) {
                        if (type != Constants.NO_OF_ORDERS) {
                            if (!isNaN(obj[key])) {
                                obj[key] = currencyFormat(obj[key]);
                            }
                        }
                    }
                });
                let temp        = [];
                let commonColls = [];

                /** Define excel heading label **/
                column.map(col => {
                    commonColls.push(col);
                });

                if (finalObj && finalObj.length > 0) {
                    finalObj.forEach(records => {
                        let buffer = [
                            Constants.AREAS_CONTRIBUTION_REPORT_TYPE[type],
                            (records.city_name) ? records.city_name : "",
                            (records.area_name) ? records.area_name : "",
                        ];
                        for (let i=3;i<column.length;i++){
                            buffer.push(records[column[i]]);
                        }
                        temp.push(buffer);
                    });

                    let total = [
                        res.__(""),
                        res.__(""),
                        res.__("admin.report.grand_total"),
                    ];
                    if (yearType == Constants.FIRST_HALF) {
                        for (let i = 1; i <= 6; i++) {
                            if (type != Constants.NO_OF_ORDERS) {
                                total.push((grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) ? currencyFormat(grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) : currencyFormat(0))
                            } else {
                                total.push((grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) ? round(grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) : (0))
                            }
                        }
                    } else if (yearType == Constants.SECOND_HALF) {
                        for (let i = 7; i <= 12; i++) {
                            if (type != Constants.NO_OF_ORDERS) {
                                total.push((grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) ? currencyFormat(grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) : currencyFormat(0))
                            } else {
                                total.push((grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) ? round(grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) : (0))
                            }
                        }
                    }
                    if (type != Constants.NO_OF_ORDERS) {
                        total.push((grandTotal.Total) ? currencyFormat(grandTotal.Total) : currencyFormat(0));
                        total.push((grandTotal.Average) ? currencyFormat(grandTotal.Average) : currencyFormat(0));
                    } else {
                        total.push((grandTotal.Total) ? round(grandTotal.Total) : (0));
                        total.push((grandTotal.Average) ? round(grandTotal.Average) : (0));
                    }
                    temp.push(total);
                }
                /**  Function to export data in excel format **/
                exportToExcel(req, res, {
                    file_prefix     : "AreasContributionReport",
                    heading_columns : commonColls,
                    export_data     : temp
                });
            }).catch(next);
        } catch (error) {
            next(error);
        }
    }// end areasContributionReportExport()
}
