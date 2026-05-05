import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, exportToExcel, configDatatable, currencyFormat,round } from '../../../../utils/index.mjs';

// Model for cravez orders half yearly comparison report
export default class CravezOrdersHalfYearlyReport {
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
    async getCravezOrdersHalfYearlyList(req, res, next) {
        try {
            if (isPost(req)) {
                let type            = (req.body.type) ? req.body.type : '';
                const collection    = this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);

                /** Configure Datatable conditions*/
                let dataTableConfig = await configDatatable(req, res, null);
                let commonConditions = {
                    "$and": [{ delivery_type: { $exists: true } }, { delivery_type: { $ne: "" } }, { delivery_type : {$ne : null}}]
                };
                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

                asyncParallel({
                    records: (callback) => {
                        if (type == Constants.PAYMENT_METHOD || type == Constants.CUISINES) return callback(null,null);
                        collection.aggregate([
                            { $match: dataTableConfig.conditions },
                            {
                                $group: {
                                    _id: {
                                        year_month: { $dateToString: { format: "%Y-%m", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE } },
                                        delivery_type: "$delivery_type"
                                    },
                                    total_orders    : { $sum: "$total_orders" },
                                    total_amount    : { $sum: "$total_amount" },
                                    year            : { $last: { "$year": "$date" } },
                                    month           : { $last: { "$month": "$date" } },
                                    delivery_type   : { $first: "$delivery_type"},
                                },
                            },
                            {
                                $addFields: {
                                    avg_chq_value: { $divide: ["$total_amount", "$total_orders"] },
                                }
                            },
                            { $sort: { year: Constants.SORT_ASC, month: Constants.SORT_ASC } },
                        ]).toArray().then(result => {
                            let column = [
                                {
                                    "title" : res.__("admin.report.delivery_by"),
                                    "data"  : "delivery_type"
                                }
                            ];
                            let finalObj = [];
                            let dataArray = [];
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
                                let d = new Date();
                                let n = d.getFullYear();
                                let month = d.getMonth();
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
                                let listOfType = [];
                                result.forEach(sample => {
                                    listOfType.push(sample.delivery_type);
                                });
                                let uniqueArray = [];

                                for (let i = 0, l = listOfType.length; i < l; i++) {
                                    if (uniqueArray.indexOf(listOfType[i]) === -1 && listOfType[i] !== '')
                                        uniqueArray.push(listOfType[i]);
                                }
                                for (let i = result[0].year; i <= n; i++) {
                                    uniqueArray.forEach(item => {
                                        let flag = false;
                                        let data = '';
                                        let firstHalf = 0;
                                        let secondHalf = 0;
                                        let totalOrders = 0;
                                        let totalAmount = 0;
                                        let totalOrders1 = 0;
                                        let totalAmount1 = 0;
                                        let deliveryType = '';
                                        result.forEach(record=>{
                                            if (record.month <= 6 && record.year == i && record.delivery_type == item) {
                                                flag = true;
                                                if (type == Constants.NO_OF_ORDERS) {
                                                    data = record.total_orders;
                                                    firstHalf += data;
                                                } else if (type == Constants.SALES_VALUE) {
                                                    data = (record.total_amount);
                                                    firstHalf += data;
                                                } else if (type == Constants.AVG_CHQ_VALUE) {
                                                    totalOrders += record.total_orders;
                                                    totalAmount += record.total_amount;
                                                }
                                                deliveryType = record.delivery_type
                                            } else if (record.month <= 12 && record.month >= 7 && record.year == i && record.delivery_type == item) {
                                                flag = true;
                                                if (type == Constants.NO_OF_ORDERS) {
                                                    data = record.total_orders;
                                                    secondHalf += data;
                                                } else if (type == Constants.SALES_VALUE) {
                                                    data = (record.total_amount);
                                                    secondHalf += data;
                                                } else if (type == Constants.AVG_CHQ_VALUE) {
                                                    totalOrders1 += record.total_orders;
                                                    totalAmount1 += record.total_amount;
                                                }
                                                deliveryType = record.delivery_type
                                            }
                                        });
                                        let obj = {};
                                        if (flag) {
                                            if (type == Constants.AVG_CHQ_VALUE){
                                                obj[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = round(totalAmount / totalOrders);
                                                obj[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = round(totalAmount1 / totalOrders1);
                                            } else{
                                                obj[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = round(firstHalf);
                                                obj[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = round(secondHalf);
                                            }
                                            obj.delivery_type = deliveryType;
                                            dataArray.push(obj);
                                        }
                                    });
                                }

                                uniqueArray.forEach(list => {
                                    finalObj.push({
                                        delivery_type: list
                                    });
                                });
                                dataArray.forEach(sample => {
                                    let sampleType = sample.delivery_type;
                                    finalObj.forEach((obj, index) => {
                                        if (obj.delivery_type === sampleType) {
                                            finalObj[index] = Object.assign(sample, obj);
                                        }
                                    });
                                });
                                if (type != Constants.AVG_CHQ_VALUE) {
                                    const arr = {};
                                    finalObj.forEach(data => {
                                        for (let [key, value] of Object.entries(data)) {
                                            if (arr[key]) {
                                                arr[key] += value;
                                            } else {
                                                arr[key] = value;
                                            }
                                        }
                                    });
                                    finalObj.forEach(data => {
                                        for (let i = result[0].year; i <= n; i++) {
                                            let val1 = (data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i]) ? data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i]:"";
                                            let val2 = (data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i]) ? data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i]:"";
                                            if (type == Constants.NO_OF_ORDERS){
                                                data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = (arr[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] == "" || val1 == "" || val1 == 0) ? "" : round(val1) + ' (' + round((val1 / arr[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i]) * 100) + '%)';
                                                data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = (arr[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] == "" || val2 == "" || val2 == 0) ? "" : round(val2) + ' (' + round((val2 / arr[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i]) * 100) + '%)';
                                            }else{
                                                data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = (arr[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] == "" || val1 == "" || val1 == 0) ? "" : currencyFormat(val1) + ' (' + round((val1 / arr[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i]) * 100) + '%)';
                                                data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = (arr[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] == "" || val2 == "" || val2 == 0) ? "" : currencyFormat(val2) + ' (' + round((val2 / arr[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i]) * 100) + '%)';
                                            }
                                        }
                                        data['delivery_type'] = Constants.DELIVERY_BY[data.delivery_type];
                                    });
                                } else{
                                    finalObj.forEach(data => {
                                        for (let i = result[0].year; i <= n; i++) {
                                            let val1 = (data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i]) ? data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] : "";
                                            let val2 = (data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i]) ? data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] : "";
                                            data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = (val1 == "" || val1 == 0) ? "" : currencyFormat(val1);
                                            data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = (val2 == "" || val2 == 0) ? "" : currencyFormat(val2);
                                        }
                                        data['delivery_type'] = Constants.DELIVERY_BY[data.delivery_type];
                                    });
                                }
                            }
                            let jsonData = {
                                "data": finalObj,
                                "columns": column
                            }
                            callback(null, jsonData);
                        }).catch(next);
                    },
                    payment_method: (callback) => {
                        if (type != Constants.PAYMENT_METHOD ) return callback(null, null);

                        let commonConditions = {
                            admin_status: Constants.ORDER_DELIVERED,
                            "$and": [{ payment_method: { $exists: true } }, { payment_method: { $ne: "" } }, { payment_method: { $ne: null } }]
                        };
                        const orders = this.db.collection(Tables.ORDERS);
                        orders.aggregate([
                            { $match: commonConditions },
                            {
                                $group: {
                                    _id: {
                                        year_month: { $dateToString: { format: "%Y-%m", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE } },
                                        payment_method: "$payment_method"
                                    },
                                    order_count: { $sum: 1 },
                                    year: { $last: { "$year": "$order_date" } },
                                    month: { $last: { "$month": "$order_date" } },
                                    payment_method: { $first: "$payment_method" },
                                },
                            },
                            { $sort: { year: Constants.SORT_ASC, month: Constants.SORT_ASC } },
                        ]).toArray().then(result => {
                            let column = [
                                {
                                    "title": res.__("admin.report.payment_method"),
                                    "data": "payment_method"
                                }
                            ];
                            let finalObj = [];
                            let dataArray = [];
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
                                let d = new Date();
                                let n = d.getFullYear();
                                let month = d.getMonth();
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
                                let listOfType = [];
                                result.forEach(sample => {
                                    listOfType.push(sample.payment_method);
                                });
                                let uniqueArray = [];

                                for (let i = 0; i < listOfType.length; i++) {
                                    if (uniqueArray.indexOf(listOfType[i]) === -1 && listOfType[i] !== '')
                                        uniqueArray.push(listOfType[i]);
                                }
                                for (let i = result[0].year; i <= n; i++) {
                                    uniqueArray.forEach(item => {
                                        let flag = false;
                                        let data = '';
                                        let firstHalf = 0;
                                        let secondHalf = 0;
                                        let paymentMethod = '';
                                        result.forEach(record => {
                                            if (record.month <= 6 && record.year == i && record.payment_method == item) {
                                                flag = true;
                                                data = (record.order_count);
                                                firstHalf += data;
                                                paymentMethod = record.payment_method
                                            } else if (record.month <= 12 && record.month >= 7 && record.year == i && record.payment_method == item) {
                                                flag = true;
                                                data = (record.order_count);
                                                secondHalf += data;
                                                paymentMethod = record.payment_method
                                            }
                                        });
                                        let obj = {};
                                        if (flag) {
                                            obj[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] =  round(firstHalf);
                                            obj[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = round(secondHalf);
                                            obj.payment_method = paymentMethod;
                                            dataArray.push(obj);
                                        }
                                    });
                                }

                                uniqueArray.forEach(list => {
                                    finalObj.push({
                                        payment_method: list
                                    });
                                });
                                dataArray.forEach(sample => {
                                    let sampleType = sample.payment_method;
                                    finalObj.forEach((obj, index) => {
                                        if (obj.payment_method === sampleType) {
                                            finalObj[index] = Object.assign(sample, obj);
                                        }
                                    });
                                });
                                const arr = {};
                                finalObj.forEach(data => {
                                    for (let [key, value] of Object.entries(data)) {
                                        if (arr[key]) {
                                            arr[key] += value;
                                        } else {
                                            arr[key] = value;
                                        }
                                    }
                                });
                                finalObj.forEach(data => {
                                    for (let i = result[0].year; i <= n; i++) {
                                        let val1 = (data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i]) ? data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] : "";
                                        let val2 = (data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i]) ? data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] : "";
                                        data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = (arr[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] == "" || val1 == "" || val1 == 0) ? "" : round((val1 / arr[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i]) * 100) + '%';
                                        data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = (arr[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] == "" || val2 == "" || val2 == 0) ? "" : round((val2 / arr[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i]) * 100) + '%';
                                    }
                                    data.payment_method = (PAYMENT_METHODS[data.payment_method]) ? PAYMENT_METHODS[data.payment_method] : data.payment_method;
                                });
                            }
                            let jsonData = {
                                "data": finalObj,
                                "columns": column
                            };

                            callback(null, jsonData);
                        }).catch(next);
                    },
                    cuisines: (callback) => {
                        if (type != Constants.CUISINES) return callback(null, null);
                        const order_cuisine_reports = this.db.collection(Tables.ORDER_CUISINE_REPORTS);
                        let commonConditions = {
                            cuisine_id: { $ne: "" }
                        };
                        order_cuisine_reports.aggregate([
                            { $match: commonConditions },
                            {
                                $lookup: {	/** Get cuisine details **/
                                    from: Tables.CUISINES,
                                    localField: "cuisine_id",
                                    foreignField: "_id",
                                    as: "cuisine_details"
                                }
                            },
                            {
                                $addFields: {
                                    cuisine_name: { $arrayElemAt: ["$cuisine_details.name." + Constants.DEFAULT_LANGUAGE_CODE, 0] },
                                }
                            },
                            {
                                $group: {
                                    _id: {
                                        year_month: { $dateToString: { format: "%Y-%m", date: "$date", timezone: Constants. DEFAULT_TIME_ZONE } },
                                        cuisine_id: "$cuisine_id"
                                    },
                                    order_count: { $sum: 1 },
                                    year: { $last: { "$year": "$date" } },
                                    month: { $last: { "$month": "$date" } },
                                    cuisine_id: { $first: "$cuisine_id" },
                                    cuisine_name: { $first: "$cuisine_name" },
                                },
                            },
                            {$match : {$and : [{cuisine_name : {$exists : true}},{cuisine_name : {$ne : null}}],order_count : {$gt : 0}}},
                            { $sort: { year: Constants.SORT_ASC, month: Constants.SORT_ASC } },
                        ]).toArray().then(result => {
                            let column = [
                                {
                                    "title": res.__("admin.report.cuisines"),
                                    "data": "cuisine_name"
                                }
                            ];
                            let finalObj = [];
                            let dataArray = [];
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
                                let d = new Date();
                                let n = d.getFullYear();
                                let month = d.getMonth();
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
                                let listOfType = [];
                                result.forEach(sample => {
                                    listOfType.push(String(sample.cuisine_id));
                                });
                                let uniqueArray = [];

                                for (let i = 0, l = listOfType.length; i < l; i++) {
                                    if (uniqueArray.indexOf(listOfType[i]) === -1 && listOfType[i] !== '')
                                        uniqueArray.push(listOfType[i]);
                                }
                                for (let i = result[0].year; i <= n; i++) {
                                    uniqueArray.forEach(item => {
                                        let flag = false;
                                        let data = '';
                                        let firstHalf = 0;
                                        let secondHalf = 0;
                                        let cuisineName = '';
                                        let cuisineId = '';
                                        result.forEach(record => {
                                            if (record.month <= 6 && record.year == i && String(record.cuisine_id) == item) {
                                                flag = true;
                                                data = (record.order_count);
                                                firstHalf += data;
                                                cuisineName = record.cuisine_name;
                                                cuisineId = record.cuisine_id;
                                            } else if (record.month <= 12 && record.month >= 7 && record.year == i && String(record.cuisine_id) == item) {
                                                flag = true;
                                                data = (record.order_count);
                                                secondHalf += data;
                                                cuisineName = record.cuisine_name;
                                                cuisineId = record.cuisine_id;
                                            }
                                        });
                                        let obj = {};
                                        if (flag) {
                                            obj[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = round(firstHalf);
                                            obj[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = round(secondHalf);
                                            obj.cuisine_name = cuisineName;
                                            obj.cuisine_id = cuisineId;
                                            dataArray.push(obj);
                                        }
                                    });
                                }
                                uniqueArray.forEach(list => {
                                    finalObj.push({
                                        cuisine_id: list
                                    });
                                });
                                dataArray.forEach(sample => {
                                    let sampleType = String(sample.cuisine_id);
                                    finalObj.forEach((obj, index) => {
                                        if (obj.cuisine_id === sampleType) {
                                            finalObj[index] = Object.assign(sample, obj);
                                        }
                                    });
                                });
                                const arr = {};
                                finalObj.forEach(data => {
                                    for (let [key, value] of Object.entries(data)) {
                                        if (arr[key] ) {
                                            arr[key] +=value;
                                        } else {
                                            arr[key] = value;
                                        }
                                    }
                                });

                                finalObj.forEach(data => {
                                    for (let i = result[0].year; i <= n; i++) {
                                        let val1 = (data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i]) ? data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] : "";
                                        let val2 = (data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i]) ? data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] : "";
                                        data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = (arr[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] == "" || val1 == "" || val1 == 0) ? "" : round((val1 / arr[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i]) * 100) + '%';
                                        data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = (arr[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] == "" || val2 == "" || val2 == 0) ? "" : round((val2 / arr[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i]) * 100) + '%';
                                    }
                                });
                            }
                            let jsonData = {
                                "data": finalObj,
                                "columns": column
                            }
                            callback(null, jsonData);
                        }).catch(next);
                    },
                    avg_commission_percent: (callback) => {
                        if (type != Constants.AVG_COMMISSION_PERCENT) return callback(null, null);
                        let commonConditions = {
                            admin_status: Constants.ORDER_DELIVERED,
                            "$and": [{ delivery_type: { $exists: true } }, { delivery_type: { $ne: "" } }, { delivery_type: { $ne: null } }]
                        };
                        const orders = this.db.collection(Tables.ORDERS);
                        orders.aggregate([
                            { $match: commonConditions },
                            {
                                $group: {
                                    _id: {
                                        year_month: { $dateToString: { format: "%Y-%m", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE } },
                                        delivery_type: "$delivery_type"
                                    },
                                    payout_percentage: { $avg: "$payout_percentage" },
                                    year: { $last: { "$year": "$order_date" } },
                                    month: { $last: { "$month": "$order_date" } },
                                    delivery_type: { $first: "$delivery_type" },
                                },
                            },
                            { $sort: { year: Constants.SORT_ASC, month: Constants.SORT_ASC } },
                        ]).toArray().then(result => {
                            let column = [
                                {
                                    "title": res.__("admin.report.delivery_by"),
                                    "data": "delivery_type"
                                }
                            ];
                            let finalObj = [];
                            let dataArray = [];
                            let month1 = 0;
                            let month2 = 0;
                            if (result.length > 0) {
                                if (result[0].month < 6) {
                                    month1 = 7 - result[0].month;
                                    month2 = 6;
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
                                    month1 = 1;
                                    month2 = 6;
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
                                    month2 = 13 - result[0].month;
                                    let obj = {
                                        "title": Constants.REPORT_CHART_MONTH_NAMES[result[0].month] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                                        "data": Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                                    };
                                    column.push(obj);
                                } else if (result[0].month == 12) {
                                    month2 = 1;
                                    let obj = {
                                        "title": Constants.REPORT_CHART_MONTH_NAMES[result[0].month] + '-' + result[0].year,
                                        "data": Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                                    };
                                    column.push(obj);
                                }
                                let d = new Date();
                                let n = d.getFullYear();
                                let month = d.getMonth();
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
                                let listOfType = [];
                                result.forEach(sample => {
                                    listOfType.push(sample.delivery_type);
                                });
                                let uniqueArray = [];

                                for (let i = 0; i < listOfType.length; i++) {
                                    if (uniqueArray.indexOf(listOfType[i]) === -1 && listOfType[i] !== '')
                                        uniqueArray.push(listOfType[i]);
                                }
                                for (let i = result[0].year; i <= n; i++) {
                                    uniqueArray.forEach(item => {
                                        let flag = false;
                                        let data = '';
                                        let firstHalf = 0;
                                        let secondHalf = 0;
                                        let deliveryType = '';
                                        result.forEach(record => {
                                            if (record.month <= 6 && record.year == i && record.delivery_type == item) {
                                                flag = true;
                                                data = (record.payout_percentage);
                                                firstHalf += data;
                                                deliveryType = record.delivery_type
                                            } else if (record.month <= 12 && record.month >= 7 && record.year == i && record.delivery_type == item) {
                                                flag = true;
                                                data = (record.payout_percentage);
                                                secondHalf += data;
                                                deliveryType = record.delivery_type
                                            }
                                        });
                                        let obj = {};
                                        if (flag) {
                                            if (i == result[0].year) {
                                                obj[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = round(firstHalf / month1);
                                                obj[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = round(secondHalf / month2);
                                            } else {
                                                obj[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = round(firstHalf / 6);
                                                obj[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = round(secondHalf / 6);
                                            }
                                            obj.delivery_type = deliveryType;
                                            dataArray.push(obj);
                                        }
                                    });
                                }

                                uniqueArray.forEach(list => {
                                    finalObj.push({
                                        delivery_type: list
                                    });
                                });
                                dataArray.forEach(sample => {
                                    let sampleType = sample.delivery_type;
                                    finalObj.forEach((obj, index) => {
                                        if (obj.delivery_type === sampleType) {
                                            finalObj[index] = Object.assign(sample, obj);
                                        }
                                    });
                                });
                                finalObj.forEach(data => {
                                    for (let i = result[0].year; i <= n; i++) {
                                        let val1 = (data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i]) ? data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] : "";
                                        let val2 = (data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i]) ? data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] : "";
                                        data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = (val1 == "" || val1 == 0) ? "" : (val1) + '%';
                                        data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = (val2 == "" || val2 == 0) ? "" : (val2) + '%';
                                    }
                                    data['delivery_type'] = Constants.DELIVERY_BY[data.delivery_type];
                                });
                            }
                            let jsonData = {
                                "data": finalObj,
                                "columns": column
                            };

                            callback(null, jsonData);
                        }).catch(next);
                    },
                }, (err, response) => {
                    let data = [];
                    let col = [];
                    if (type == Constants.PAYMENT_METHOD){
                        data = response.payment_method.data;
                        col = response.payment_method.columns;
                    } else if (type == Constants.CUISINES) {
                        data = response.cuisines.data;
                        col = response.cuisines.columns;
                    } else if (type == Constants.AVG_COMMISSION_PERCENT) {
                        data = response.avg_commission_percent.data;
                        col = response.avg_commission_percent.columns;
                    } else{
                        data = response.records.data;
                        col = response.records.columns;
                    }
                    /** Send response **/
                    res.send({
                        status          : (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
                        draw            : dataTableConfig.result_draw,
                        data            : data,
                        columns         : col,
                    });
                });
            } else {
                /** render listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/report/cravez_orders_half_yearly_report']);
                res.render('cravez_orders_half_yearly_comparison_report');
            }
        } catch (error) {
            next(error);
        }
    };//End getCravezOrdersHalfYearlyList()


    /**
     *  Function for export Cravez Orders half yearly report
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As 	Callback argument to the middleware function
     *
     * @return null
    */
    async cravezOrdersHalfYearlyReportExport(req, res, next) {
        try {
            let type        = (req.query.type) ? (req.query.type): "";

            let exportConditions= {
                "$and": [{ delivery_type: { $exists: true } }, { delivery_type: { $ne: "" } }, { delivery_type: { $ne: null } }]
            };
            /** Get details **/
            const branch_wise_processed_orders = this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);
            asyncParallel({
                records: (callback) => {
                    if (type == Constants.PAYMENT_METHOD || type == Constants.CUISINES || type == Constants.AVG_COMMISSION_PERCENT) return callback(null, null);
                    branch_wise_processed_orders.aggregate([
                        { $match: exportConditions },
                        {
                            $group: {
                                _id: {
                                    year_month: { $dateToString: { format: "%Y-%m", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE } },
                                    delivery_type: "$delivery_type"
                                },
                                total_orders: { $sum: "$total_orders" },
                                total_amount: { $sum: "$total_amount" },
                                year: { $last: { "$year": "$date" } },
                                month: { $last: { "$month": "$date" } },
                                delivery_type: { $first: "$delivery_type" },
                            },
                        },
                        {
                            $addFields: {
                                avg_chq_value: { $divide: ["$total_amount", "$total_orders"] },
                            }
                        },
                        { $sort: { year: 1, month: 1 } },
                    ]).toArray().then((result) => {
                        let column = [
                            {
                                "title": res.__("admin.report.delivery_by"),
                                "data": "delivery_type"
                            },
                            {
                                "title": res.__("admin.report.report_type"),
                                "data": "report_type"
                            }
                        ];
                        let finalObj = [];
                        let dataArray = [];
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
                            let d = new Date();
                            let n = d.getFullYear();
                            let month = d.getMonth();
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
                            let listOfType = [];
                            result.forEach(sample => {
                                listOfType.push(sample.delivery_type);
                            });
                            let uniqueArray = [];

                            for (let i = 0; i < listOfType.length; i++) {
                                if (uniqueArray.indexOf(listOfType[i]) === -1 && listOfType[i] !== '')
                                    uniqueArray.push(listOfType[i]);
                            }
                            for (let i = result[0].year; i <= n; i++) {
                                uniqueArray.forEach(item => {
                                    let flag = false;
                                    let data = '';
                                    let firstHalf = 0;
                                    let secondHalf = 0;
                                    let totalOrders = 0;
                                    let totalAmount = 0;
                                    let totalOrders1 = 0;
                                    let totalAmount1 = 0;
                                    let deliveryType = '';
                                    result.forEach(record => {
                                        if (record.month <= 6 && record.year == i && record.delivery_type == item) {
                                            flag = true;
                                            if (type == Constants.NO_OF_ORDERS) {
                                                data = record.total_orders;
                                                firstHalf += data;
                                            } else if (type == Constants.SALES_VALUE) {
                                                data = (record.total_amount);
                                                firstHalf += data;
                                            } else if (type == Constants.AVG_CHQ_VALUE) {
                                                totalOrders += record.total_orders;
                                                totalAmount += record.total_amount;
                                            }
                                            deliveryType = record.delivery_type
                                        } else if (record.month <= 12 && record.month >= 7 && record.year == i && record.delivery_type == item) {
                                            flag = true;
                                            if (type == Constants.NO_OF_ORDERS) {
                                                data = record.total_orders;
                                                secondHalf += data;
                                            } else if (type == Constants.SALES_VALUE) {
                                                data = (record.total_amount);
                                                secondHalf += data;
                                            } else if (type == Constants.AVG_CHQ_VALUE) {
                                                totalOrders1 += record.total_orders;
                                                totalAmount1 += record.total_amount;
                                            }
                                            deliveryType = record.delivery_type
                                        }
                                    });
                                    let obj = {};
                                    if (flag) {
                                        if (type == Constants.AVG_CHQ_VALUE) {
                                            obj[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = round(totalAmount / totalOrders);
                                            obj[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = round(totalAmount1 / totalOrders1);
                                        } else {
                                            obj[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = round(firstHalf);
                                            obj[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = round(secondHalf);
                                        }
                                        obj.delivery_type = deliveryType;
                                        dataArray.push(obj);
                                    }
                                });
                            }

                            uniqueArray.forEach(list => {
                                finalObj.push({
                                    delivery_type: list
                                });
                            });
                            dataArray.forEach(sample => {
                                let sampleType = sample.delivery_type;
                                finalObj.forEach((obj, index) => {
                                    if (obj.delivery_type === sampleType) {
                                        finalObj[index] = Object.assign(sample, obj);
                                    }
                                });
                            });
                            if (type != Constants.AVG_CHQ_VALUE) {
                                const arr = {};
                                finalObj.forEach(data => {
                                    for (let [key, value] of Object.entries(data)) {
                                        if (arr[key]) {
                                            arr[key] += value;
                                        } else {
                                            arr[key] = value;
                                        }
                                    }
                                });
                                finalObj.forEach(data => {
                                    for (let i = result[0].year; i <= n; i++) {
                                        let val1 = (data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i]) ? data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] : "";
                                        let val2 = (data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i]) ? data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] : "";
                                        if (type == Constants.NO_OF_ORDERS) {
                                            data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = (arr[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] == "" || val1 == "" || val1 == 0) ? "" : round(val1) + ' (' + round((val1 / arr[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i]) * 100) + '%)';
                                            data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = (arr[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] == "" || val2 == "" || val2 == 0) ? "" : round(val2) + ' (' + round((val2 / arr[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i]) * 100) + '%)';
                                        } else {
                                            data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = (arr[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] == "" || val1 == "" || val1 == 0) ? "" : currencyFormat(val1) + ' (' + round((val1 / arr[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i]) * 100) + '%)';
                                            data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = (arr[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] == "" || val2 == "" || val2 == 0) ? "" : currencyFormat(val2) + ' (' + round((val2 / arr[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i]) * 100) + '%)';
                                        }
                                    }
                                });
                            } else {
                                finalObj.forEach(data => {
                                    for (let i = result[0].year; i <= n; i++) {
                                        let val1 = (data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i]) ? data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] : "";
                                        let val2 = (data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i]) ? data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] : "";
                                        data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = (val1 == "" || val1 == 0) ? "" : currencyFormat(val1);
                                        data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = (val2 == "" || val2 == 0) ? "" : currencyFormat(val2);
                                    }
                                });
                            }
                        }

                        let jsonData = {
                            "data": finalObj,
                            "columns": column
                        }

                        callback(null, jsonData);
                    }).catch(next);
                },
                payment_method: (callback) => {
                    if (type != Constants.PAYMENT_METHOD) return callback(null, null);
                    let commonConditions = {
                        admin_status: Constants.ORDER_DELIVERED,
                        "$and": [{ payment_method: { $exists: true } }, { payment_method: { $ne: "" } }, { payment_method: { $ne: null } }]
                    };
                    const orders = this.db.collection(Tables.ORDERS);
                    orders.aggregate([
                        { $match: commonConditions },
                        {
                            $group: {
                                _id: {
                                    year_month: { $dateToString: { format: "%Y-%m", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE } },
                                    payment_method: "$payment_method"
                                },
                                order_count: { $sum: 1 },
                                year: { $last: { "$year": "$order_date" } },
                                month: { $last: { "$month": "$order_date" } },
                                payment_method: { $first: "$payment_method" },
                            },
                        },
                        { $sort: { year: 1, month: 1 } },
                    ]).toArray().then((result) => {
                        let column = [
                            {
                                "title": res.__("admin.report.payment_method"),
                                "data": "payment_method"
                            },
                            {
                                "title": res.__("admin.report.report_type"),
                                "data": "report_type"
                            }
                        ];
                        let finalObj = [];
                        let dataArray = [];
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
                            let d = new Date();
                            let n = d.getFullYear();
                            let month = d.getMonth();
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
                            let listOfType = [];
                            result.forEach(sample => {
                                listOfType.push(sample.payment_method);
                            });
                            let uniqueArray = [];

                            for (let i = 0; i < listOfType.length; i++) {
                                if (uniqueArray.indexOf(listOfType[i]) === -1 && listOfType[i] !== '')
                                    uniqueArray.push(listOfType[i]);
                            }
                            for (let i = result[0].year; i <= n; i++) {
                                uniqueArray.forEach(item => {
                                    let flag = false;
                                    let data = '';
                                    let firstHalf = 0;
                                    let secondHalf = 0;
                                    let paymentMethod = '';
                                    result.forEach(record => {
                                        if (record.month <= 6 && record.year == i && record.payment_method == item) {
                                            flag = true;
                                            data = (record.order_count);
                                            firstHalf += data;
                                            paymentMethod = record.payment_method
                                        } else if (record.month <= 12 && record.month >= 7 && record.year == i && record.payment_method == item) {
                                            flag = true;
                                            data = (record.order_count);
                                            secondHalf += data;
                                            paymentMethod = record.payment_method
                                        }
                                    });
                                    let obj = {};
                                    if (flag) {
                                        obj[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = round(firstHalf);
                                        obj[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = round(secondHalf);
                                        obj.payment_method = paymentMethod;
                                        dataArray.push(obj);
                                    }
                                });
                            }

                            uniqueArray.forEach(list => {
                                finalObj.push({
                                    payment_method: list
                                });
                            });
                            dataArray.forEach(sample => {
                                let sampleType = sample.payment_method;
                                finalObj.forEach((obj, index) => {
                                    if (obj.payment_method === sampleType) {
                                        finalObj[index] = Object.assign(sample, obj);
                                    }
                                });
                            });
                            const arr = {};
                            finalObj.forEach(data => {
                                for (let [key, value] of Object.entries(data)) {
                                    if (arr[key]) {
                                        arr[key] += value;
                                    } else {
                                        arr[key] = value;
                                    }
                                }
                            });
                            finalObj.forEach(data => {
                                for (let i = result[0].year; i <= n; i++) {
                                    let val1 = (data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i]) ? data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] : "";
                                    let val2 = (data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i]) ? data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] : "";
                                    data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = (arr[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] == "" || val1 == "" || val1 == 0) ? "" : round((val1 / arr[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i]) * 100) + '%';
                                    data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = (arr[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] == "" || val2 == "" || val2 == 0) ? "" : round((val2 / arr[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i]) * 100) + '%';
                                }
                            });
                        }
                        let jsonData = {
                            "data": finalObj,
                            "columns": column
                        }

                        callback(null, jsonData);
                    }).catch(next);
                },
                cuisines: (callback) => {
                    if (type != Constants.CUISINES) return callback(null, null);
                    const order_cuisine_reports = this.db.collection(Tables.ORDER_CUISINE_REPORTS);
                    let commonConditions = {
                        cuisine_id: { $ne: "" }
                    };
                    order_cuisine_reports.aggregate([
                        { $match: commonConditions },
                        {
                            $lookup: {	/** Get cuisine details **/
                                from: Tables.CUISINES,
                                localField: "cuisine_id",
                                foreignField: "_id",
                                as: "cuisine_details"
                            }
                        },
                        {
                            $addFields: {
                                cuisine_name: { $arrayElemAt: ["$cuisine_details.name." + Constants.DEFAULT_LANGUAGE_CODE, 0] },
                            }
                        },
                        {
                            $group: {
                                _id: {
                                    year_month: { $dateToString: { format: "%Y-%m", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE } },
                                    cuisine_id: "$cuisine_id"
                                },
                                order_count: { $sum: 1 },
                                year: { $last: { "$year": "$date" } },
                                month: { $last: { "$month": "$date" } },
                                cuisine_id: { $first: "$cuisine_id" },
                                cuisine_name: { $first: "$cuisine_name" },
                            },
                        },
                        { $sort: { year: Constants.ASC, month: Constants.ASC } },
                    ]).toArray().then((result) => {
                        let column = [
                            {
                                "title": res.__("admin.report.cuisines"),
                                "data": "cuisine_name"
                            },
                            {
                                "title": res.__("admin.report.report_type"),
                                "data": "report_type"
                            }
                        ];
                        let finalObj = [];
                        let dataArray = [];
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
                            let d = new Date();
                            let n = d.getFullYear();
                            let month = d.getMonth();
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
                            let listOfType = [];
                            result.map(sample => {
                                listOfType.push(String(sample.cuisine_id));
                            });
                            let uniqueArray = [];

                            for (let i = 0; i < listOfType.length; i++) {
                                if (uniqueArray.indexOf(listOfType[i]) === -1 && listOfType[i] !== '')
                                    uniqueArray.push(listOfType[i]);
                            }
                            for (let i = result[0].year; i <= n; i++) {
                                uniqueArray.map(item => {
                                    let flag = false;
                                    let data = '';
                                    let firstHalf = 0;
                                    let secondHalf = 0;
                                    let cuisineName = '';
                                    let cuisineId = '';
                                    result.forEach(record => {
                                        if (record.month <= 6 && record.year == i && String(record.cuisine_id) == item) {
                                            flag = true;
                                            data = (record.order_count);
                                            firstHalf += data;
                                            cuisineName = record.cuisine_name;
                                            cuisineId = record.cuisine_id;
                                        } else if (record.month <= 12 && record.month >= 7 && record.year == i && String(record.cuisine_id) == item) {
                                            flag = true;
                                            data = (record.order_count);
                                            secondHalf += data;
                                            cuisineName = record.cuisine_name;
                                            cuisineId = record.cuisine_id;
                                        }
                                    });
                                    let obj = {};
                                    if (flag) {
                                        obj[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = round(firstHalf);
                                        obj[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = round(secondHalf);
                                        obj.cuisine_name = cuisineName;
                                        obj.cuisine_id = cuisineId;
                                        dataArray.push(obj);
                                    }
                                });
                            }
                            uniqueArray.forEach(list => {
                                finalObj.push({
                                    cuisine_id: list
                                });
                            });
                            dataArray.map(sample => {
                                let sampleType = String(sample.cuisine_id);
                                finalObj.forEach((obj, index) => {
                                    if (obj.cuisine_id === sampleType) {
                                        finalObj[index] = Object.assign(sample, obj);
                                    }
                                });
                            });
                            const arr = {};
                            finalObj.forEach(data => {
                                for (let [key, value] of Object.entries(data)) {
                                    if (arr[key]) {
                                        arr[key] += value;
                                    } else {
                                        arr[key] = value;
                                    }
                                }
                            });

                            finalObj.forEach(data => {
                                for (let i = result[0].year; i <= n; i++) {
                                    let val1 = (data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i]) ? data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] : "";
                                    let val2 = (data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i]) ? data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] : "";
                                    data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = (arr[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] == "" || val1 == "" || val1 == 0) ? "" : round((val1 / arr[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i]) * 100) + '%';
                                    data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = (arr[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] == "" || val2 == "" || val2 == 0) ? "" : round((val2 / arr[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i]) * 100) + '%';
                                }
                            });
                        }
                        let jsonData = {
                            "data": finalObj,
                            "columns": column
                        }
                        callback(null, jsonData);
                    }).catch(next);
                },
                avg_commission_percent: (callback) => {
                    if (type != Constants.AVG_COMMISSION_PERCENT) return callback(null, null);
                    let commonConditions = {
                        admin_status: Constants.ORDER_DELIVERED,
                        "$and": [{ delivery_type: { $exists: true } }, { delivery_type: { $ne: "" } }, { delivery_type: { $ne: null } }]
                    };
                    const orders = this.db.collection(Tables.ORDERS);
                    orders.aggregate([
                        { $match: commonConditions },
                        {
                            $group: {
                                _id: {
                                    year_month: { $dateToString: { format: "%Y-%m", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE } },
                                    delivery_type: "$delivery_type"
                                },
                                payout_percentage: { $avg: "$payout_percentage" },
                                year: { $last: { "$year": "$order_date" } },
                                month: { $last: { "$month": "$order_date" } },
                                delivery_type: { $first: "$delivery_type" },
                            },
                        },
                        { $sort: { year: 1, month: 1 } },
                    ]).toArray().then((result) => {
                        let column = [
                            {
                                "title": res.__("admin.report.delivery_by"),
                                "data": "delivery_type"
                            },
                            {
                                "title": res.__("admin.report.report_type"),
                                "data": "report_type"
                            }
                        ];
                        let finalObj = [];
                        let dataArray = [];
                        let month1 = 0;
                        let month2 = 0;
                        if (result.length > 0) {
                            if (result[0].month < 6) {
                                month1 = 7 - result[0].month;
                                month2 = 6;
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
                                month1 = 1;
                                month2 = 6;
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
                                month2 = 13 - result[0].month;
                                let obj = {
                                    "title": Constants.REPORT_CHART_MONTH_NAMES[result[0].month] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                                    "data": Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                                };
                                column.push(obj);
                            } else if (result[0].month == 12) {
                                month2 = 1;
                                let obj = {
                                    "title": Constants.REPORT_CHART_MONTH_NAMES[result[0].month] + '-' + result[0].year,
                                    "data": Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + result[0].year + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + result[0].year,
                                };
                                column.push(obj);
                            }
                            let d = new Date();
                            let n = d.getFullYear();
                            let month = d.getMonth();
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
                            let listOfType = [];
                            result.forEach(sample => {
                                listOfType.push(sample.delivery_type);
                            });
                            let uniqueArray = [];

                            for (let i = 0; i < listOfType.length; i++) {
                                if (uniqueArray.indexOf(listOfType[i]) === -1 && listOfType[i] !== '')
                                    uniqueArray.push(listOfType[i]);
                            }
                            for (let i = result[0].year; i <= n; i++) {
                                uniqueArray.forEach(item => {
                                    let flag = false;
                                    let data = '';
                                    let firstHalf = 0;
                                    let secondHalf = 0;
                                    let deliveryType = '';
                                    result.forEach(record => {
                                        if (record.month <= 6 && record.year == i && record.delivery_type == item) {
                                            flag = true;
                                            data = (record.payout_percentage);
                                            firstHalf += data;
                                            deliveryType = record.delivery_type
                                        } else if (record.month <= 12 && record.month >= 7 && record.year == i && record.delivery_type == item) {
                                            flag = true;
                                            data = (record.payout_percentage);
                                            secondHalf += data;
                                            deliveryType = record.delivery_type
                                        }
                                    });
                                    let obj = {};
                                    if (flag) {
                                        if (i == result[0].year) {
                                            obj[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = round(firstHalf / month1);
                                            obj[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = round(secondHalf / month2);
                                        } else {
                                            obj[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = round(firstHalf / 6);
                                            obj[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = round(secondHalf / 6);
                                        }

                                        obj.delivery_type = deliveryType;
                                        dataArray.push(obj);
                                    }
                                });
                            }

                            uniqueArray.forEach(list => {
                                finalObj.push({
                                    delivery_type: list
                                });
                            });
                            dataArray.forEach(sample => {
                                let sampleType = sample.delivery_type;
                                finalObj.forEach((obj, index) => {
                                    if (obj.delivery_type === sampleType) {
                                        finalObj[index] = Object.assign(sample, obj);
                                    }
                                });
                            });
                            finalObj.forEach(data => {
                                for (let i = result[0].year; i <= n; i++) {
                                    let val1 = (data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i]) ? data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] : "";
                                    let val2 = (data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i]) ? data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] : "";
                                    data[Constants.REPORT_CHART_MONTH_NAMES[1] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[6] + '-' + i] = (val1 == "" || val1 == 0) ? "" : (val1) + '%';
                                    data[Constants.REPORT_CHART_MONTH_NAMES[7] + '-' + i + '-' + Constants.REPORT_CHART_MONTH_NAMES[12] + '-' + i] = (val2 == "" || val2 == 0) ? "" : (val2) + '%';
                                }
                                data['delivery_type'] = Constants.DELIVERY_BY[data.delivery_type];
                            });
                        }
                        let jsonData = {
                            "data": finalObj,
                            "columns": column
                        };

                        callback(null, jsonData);
                    }).catch(next);
                },
            }, (err, response) => {
                let data = [];
                let column = [];
                if (type == Constants.PAYMENT_METHOD) {
                    data = response.payment_method.data;
                    column = response.payment_method.columns;
                } else if (type == Constants.CUISINES) {
                    data = response.cuisines.data;
                    column = response.cuisines.columns;
                } else if (type == Constants.AVG_COMMISSION_PERCENT) {
                    data = response.avg_commission_percent.data;
                    column = response.avg_commission_percent.columns;
                } else {
                    data = response.records.data;
                    column = response.records.columns;
                }

                let temp        = [];
                let commonColls = [];

                /** Define excel heading label **/
                column.forEach(col => {
                    commonColls.push(col.title);
                });

                if (type == Constants.PAYMENT_METHOD) {
                    if (data && data.length > 0) {
                        data.forEach(records => {
                            let buffer = [
                                (records.payment_method) ? records.payment_method : "",
                                Constants.CRAVEZ_ORDERS_REPORT_TYPE[type],
                            ];
                            for (let i = 2; i < column.length; i++) {
                                buffer.push(records[column[i].data]);
                            }
                            temp.push(buffer);
                        });
                    }
                } else if (type == Constants.CUISINES) {
                    if (data && data.length > 0) {
                        data.forEach(records => {
                            let buffer = [
                                (records.cuisine_name) ? records.cuisine_name : "",
                                Constants.CRAVEZ_ORDERS_REPORT_TYPE[type],
                            ];
                            for (let i = 2; i < column.length; i++) {
                                buffer.push(records[column[i].data]);
                            }
                            temp.push(buffer);
                        });
                    }
                } else if (type == Constants.AVG_COMMISSION_PERCENT) {
                    if (data && data.length > 0) {
                        data.forEach(records => {
                            let buffer = [
                                (records.delivery_type) ? records.delivery_type : "",
                                Constants.CRAVEZ_ORDERS_REPORT_TYPE[type],
                            ];
                            for (let i = 2; i < column.length; i++) {
                                buffer.push(records[column[i].data]);
                            }
                            temp.push(buffer);
                        });
                    }
                } else {
                    if (data && data.length > 0) {
                        data.forEach(records => {
                            let buffer = [
                                (records.delivery_type) ? records.delivery_type : "",
                                Constants.CRAVEZ_ORDERS_REPORT_TYPE[type],
                            ];
                            for (let i=2;i<column.length;i++){
                                buffer.push(records[column[i].data]);
                            }
                            temp.push(buffer);
                        });
                    }
                }
                /**  Function to export data in excel format **/
                exportToExcel(req, res, {
                    file_prefix: "CravezOrdersHalfYearlyReport",
                    heading_columns : commonColls,
                    export_data     : temp
                });
            });
        } catch (error) {
            next(error);
        }
    };// end cravezOrdersHalfYearlyReportExport()
}
