import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, newDate, exportToExcel, configDatatable, currencyFormat, round } from '../../../../utils/index.mjs';

// Model for cravez orders report
export default class CravezOrdersReport {
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
    async getCravezOrdersList(req, res, next) {
        try {
            if (isPost(req)) {
                let year            = (req.body.year) ? parseInt(req.body.year) 		: "";
                let yearType        = (req.body.year_type) ? (req.body.year_type)   	: "";
                let type            = (req.body.type) ? req.body.type : '';
                const collection    = this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);

                /** Configure Datatable conditions*/
                let dataTableConfig = await configDatatable(req, res, null);
                let commonConditions = {
                    "$and": [{ delivery_type: { $exists: true } }, { delivery_type: { $ne: "" } }, { delivery_type : {$ne : null}}]
                };
                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);
                if (type && yearType) {
                    if (yearType == Constants.FIRST_HALF) {
                        dataTableConfig.conditions.date = {
                            $gte: newDate(year + "-01-01 00:00:00"),
                            $lte: newDate(year + "-06-30 23:59:59"),
                        };
                    } else {
                        dataTableConfig.conditions.date = {
                            $gte: newDate(year + "-07-01 00:00:00"),
                            $lte: newDate(year + "-12-31 23:59:59"),
                        };
                    }
                }
                let yearMonthConditions = { year: year };
                if(yearType == Constants.FIRST_HALF){
                    yearMonthConditions['month'] =  { $gte: 1, $lte: 6 };
                } else{
                    yearMonthConditions['month'] = { $gte: 7, $lte: 12 };
                }
                asyncParallel({
                    records: (callback) => {
                        if (type == Constants.PAYMENT_METHOD || type == Constants.CUISINES || type == Constants.AVG_COMMISSION_PERCENT) return callback(null, null);
                        collection.aggregate([
                            { $match: dataTableConfig.conditions },
                            {
                                $group: {
                                    _id: {
                                        year_month      : { $dateToString: { format: "%Y-%m", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE } },
                                        delivery_type   : "$delivery_type"
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
                            { $match: yearMonthConditions },
                            { $sort: { month: 1} },
                        ]).toArray().then((result) => {
                            let column = [
                                {
                                    "title" : res.__("admin.report.delivery_by"),
                                    "data"  : "delivery_by"
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

                            if(type == Constants.SALES_VALUE || type == Constants.NO_OF_ORDERS){
                                column.push({
                                    "title" : res.__("admin.report.total"),
                                    "data"  : "final_count"
                                });
                            }

                            column.push({
                                "title" : res.__("admin.report.average"),
                                "data"  : "final_avg"
                            });

                            let dataObj             = {};
                            let grandTotal          = {orders : 0,amount : 0,avg_chq_value : 0};
                            let monthTotal          = {};
                            let deliveryTypeTotal   = {};
                            result.forEach(record=>{
                                if(!deliveryTypeTotal[record.delivery_type]) deliveryTypeTotal[record.delivery_type] = {orders : 0,amount : 0,avg_chq_value : 0};
                                if(!monthTotal[record.month]) monthTotal[record.month] = {orders : 0,amount : 0,avg_chq_value : 0};

                                deliveryTypeTotal[record.delivery_type].orders += record.total_orders;
                                deliveryTypeTotal[record.delivery_type].amount += record.total_amount;
                                deliveryTypeTotal[record.delivery_type].avg_chq_value += round(record.total_amount/record.total_orders);

                                monthTotal[record.month].orders += record.total_orders;
                                monthTotal[record.month].amount += record.total_amount;
                                monthTotal[record.month].avg_chq_value += round(record.total_amount/record.total_orders);

                                grandTotal.orders += record.total_orders;
                                grandTotal.amount += record.total_amount;
                                grandTotal.avg_chq_value += round(record.total_amount/record.total_orders);
                            });

                            result.forEach(record=>{
                                let monthStr = Constants.REPORT_CHART_MONTH_NAMES[record.month] + '-' + record.year;
                                if(!dataObj[record.delivery_type]) dataObj[record.delivery_type] = {};
                                if(!dataObj[record.delivery_type][monthStr]) dataObj[record.delivery_type][monthStr] = {};

                                if (type == Constants.AVG_CHQ_VALUE){
                                    record[monthStr] = currencyFormat(record.avg_chq_value);
                                } else if (type == Constants.NO_OF_ORDERS){
                                    record[monthStr] = (record.total_orders) + ' ('+ round((record.total_orders/monthTotal[record.month].orders)*100)+'%)';
                                } else{
                                    record[monthStr] = currencyFormat(record.total_amount) + ' (' + round((record.total_amount / monthTotal[record.month].amount) * 100) + '%)';
                                }
                                record.delivery_by = Constants.DELIVERY_BY[record.delivery_type];
                                dataObj[record.delivery_type][monthStr] = record;
                            });

                            let finalObj = [];
                            Object.values(dataObj).forEach(data=>{
                                let tmpObj = {};
                                Object.keys(data).forEach(monthKey=>{
                                    tmpObj[monthKey]    = data[monthKey][monthKey];
                                    tmpObj.delivery_by  = data[monthKey].delivery_by;
                                    if(type == Constants.NO_OF_ORDERS){
                                        let tmpTotalOrders = (deliveryTypeTotal[data[monthKey].delivery_type].orders) ? deliveryTypeTotal[data[monthKey].delivery_type].orders : 0;
                                        tmpObj.final_count  = tmpTotalOrders + ' ('+round((tmpTotalOrders/grandTotal.orders)*100) +'%)';
                                    }
                                    if(type == Constants.SALES_VALUE){
                                        let tmpTotalValue = (deliveryTypeTotal[data[monthKey].delivery_type].amount) ? deliveryTypeTotal[data[monthKey].delivery_type].amount : 0;
                                        tmpObj.final_count = currencyFormat(tmpTotalValue) + ' ('+round((tmpTotalValue/grandTotal.amount)*100) +'%)';
                                    }

                                    if(type == Constants.SALES_VALUE){
                                        let tmpAvg     = deliveryTypeTotal[data[monthKey].delivery_type].amount/6;
                                        let grandAvg   = grandTotal.amount/6;
                                        tmpObj.final_avg    = currencyFormat(tmpAvg) +' (' +round((tmpAvg/grandAvg)*100) + '%)';
                                    }else if(type == Constants.NO_OF_ORDERS){
                                        let tmpAvg     = deliveryTypeTotal[data[monthKey].delivery_type].orders/6;
                                        let grandAvg   = grandTotal.orders/6;
                                        tmpObj.final_avg = round(tmpAvg) +'(' +round((tmpAvg/grandAvg)*100) + '%)';
                                    }else if(type == Constants.AVG_CHQ_VALUE){
                                        let tmpAvg     = deliveryTypeTotal[data[monthKey].delivery_type].avg_chq_value/6;
                                        tmpObj.final_avg    = currencyFormat(tmpAvg);
                                    }
                                });
                                finalObj.push(tmpObj);
                            });

                            let jsonData = {
                                "data": finalObj,
                                "columns": column
                            };
                            callback(null, jsonData);
                        }).catch(next);
                    },
                    payment_method: (callback) => {
                        if (type != Constants.PAYMENT_METHOD ) return callback(null, null);
                        let commonConditions = {
                            admin_status: Constants.ORDER_DELIVERED,
                        };
                        if (type && yearType) {
                            if (yearType == Constants.FIRST_HALF) {
                                commonConditions.order_date = {
                                    $gte: newDate(year + "-01-01 00:00:00"),
                                    $lte: newDate(year + "-06-30 23:59:59"),
                                };
                            } else {
                                commonConditions.order_date = {
                                    $gte: newDate(year + "-07-01 00:00:00"),
                                    $lte: newDate(year + "-12-31 23:59:59"),
                                };
                            }
                        }
                        commonConditions["$and"] = [{ payment_method: { $exists: true } }, { payment_method: { $ne: "" } }, { payment_method: { $ne: null } }];
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
                            { $match: yearMonthConditions },
                            { $sort: { month: 1 } },
                        ]).toArray().then((result) => {
                            let column = [
                                {
                                    "title": res.__("admin.report.payment_method"),
                                    "data": "payment_method_name"
                                }
                            ];
                            if (yearType == Constants.FIRST_HALF) {
                                for (let i = 1; i <= 6; i++) {
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
                                "title" : res.__("admin.report.average"),
                                "data"  : "final_avg"
                            });

                            let dataObj             = {};
                            let grandTotal          = {orders : 0};
                            let monthTotal          = {};
                            let paymentMethodTotal   = {};

                            result.forEach(record => {
                                if (!paymentMethodTotal[record.payment_method]) paymentMethodTotal[record.payment_method] = { orders: 0};
                                if (!monthTotal[record.month]) monthTotal[record.month] = { orders: 0};

                                paymentMethodTotal[record.payment_method].orders += record.order_count;

                                monthTotal[record.month].orders += record.order_count;

                                grandTotal.orders += record.order_count;
                            });

                            result.forEach(record => {
                                let monthStr = Constants.REPORT_CHART_MONTH_NAMES[record.month] + '-' + record.year;
                                if (!dataObj[record.payment_method]) dataObj[record.payment_method] = {};
                                if (!dataObj[record.payment_method][monthStr]) dataObj[record.payment_method][monthStr] = {};

                                record[monthStr] = round((record.order_count / monthTotal[record.month].orders) * 100) + '%';

                                record.payment_method_name = (Constants.PAYMENT_METHODS[record.payment_method]) ? Constants.PAYMENT_METHODS[record.payment_method] : record.payment_method;
                                dataObj[record.payment_method][monthStr] = record;
                            });

                            let finalObj = [];
                            Object.values(dataObj).forEach(data => {
                                let tmpObj = {};
                                Object.keys(data).forEach(monthKey => {
                                    tmpObj[monthKey]            = data[monthKey][monthKey];
                                    tmpObj.payment_method_name  = data[monthKey].payment_method_name;

                                    let tmpTotalOrders = (paymentMethodTotal[data[monthKey].payment_method].orders) ? paymentMethodTotal[data[monthKey].payment_method].orders : 0;
                                    tmpObj.final_count = round((tmpTotalOrders / grandTotal.orders) * 100) + '%';

                                    let tmpAvg = paymentMethodTotal[data[monthKey].payment_method].orders / 6;
                                    let grandAvg = grandTotal.orders / 6;
                                    tmpObj.final_avg = round((tmpAvg / grandAvg) * 100) + '%';
                                });
                                finalObj.push(tmpObj);
                            });

                            let jsonData = {
                                "data": finalObj,
                                "columns": column
                            }

                            callback(null, jsonData);
                        }).catch(next);
                    },
                    cuisines: (callback) => {
                        if (type != Constants.CUISINES) return callback(null, null);
                        let commonConditions = {};
                        if (type && yearType) {
                            if (yearType == Constants.FIRST_HALF) {
                                commonConditions.date = {
                                    $gte: newDate(year + "-01-01 00:00:00"),
                                    $lte: newDate(year + "-06-30 23:59:59"),
                                };
                            } else {
                                commonConditions.date = {
                                    $gte: newDate(year + "-07-01 00:00:00"),
                                    $lte: newDate(year + "-12-31 23:59:59"),
                                };
                            }
                        }
                        const order_cuisine_reports = this.db.collection(Tables.ORDER_CUISINE_REPORTS);
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
                                    cuisine_name: { $first: "$cuisine_name" },
                                },
                            },
                            { $match: yearMonthConditions },
                            { $sort: { month: 1 } },
                        ]).toArray().then((result) => {
                            let column = [
                                {
                                    "title": res.__("admin.report.cuisines"),
                                    "data": "cuisine_name"
                                }
                            ];
                            if (yearType == Constants.FIRST_HALF) {
                                for (let i = 1; i <= 6; i++) {
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
                                    }
                                    column.push(obj);
                                }
                            }
                            column.push({
                                "title" : res.__("admin.report.average"),
                                "data"  : "final_avg"
                            });

                            let dataObj             = {};
                            let grandTotal          = {orders : 0};
                            let monthTotal          = {};
                            let cuisineTotal        = {};

                            result.forEach(record => {
                                if (!cuisineTotal[record.cuisine_name]) cuisineTotal[record.cuisine_name] = { orders: 0 };
                                if (!monthTotal[record.month]) monthTotal[record.month] = { orders: 0 };

                                cuisineTotal[record.cuisine_name].orders += record.order_count;

                                monthTotal[record.month].orders += record.order_count;

                                grandTotal.orders += record.order_count
                            });

                            result.forEach(record => {
                                let monthStr = Constants.REPORT_CHART_MONTH_NAMES[record.month] + '-' + record.year;
                                if (!dataObj[record.cuisine_name]) dataObj[record.cuisine_name] = {};
                                if (!dataObj[record.cuisine_name][monthStr]) dataObj[record.cuisine_name][monthStr] = {};

                                record[monthStr] = round((record.order_count / monthTotal[record.month].orders) * 100) + '%';

                                record.cuisine_name = record.cuisine_name;

                                dataObj[record.cuisine_name][monthStr] = record;

                            });

                            let finalObj = [];
                            Object.values(dataObj).forEach(data => {
                                let tmpObj = {};
                                Object.keys(data).forEach(monthKey => {
                                    tmpObj[monthKey] = data[monthKey][monthKey];
                                    tmpObj.cuisine_name = data[monthKey].cuisine_name;

                                    let tmpTotalOrders = (cuisineTotal[data[monthKey].cuisine_name].orders) ? cuisineTotal[data[monthKey].cuisine_name].orders : 0;
                                    tmpObj.final_count = round((tmpTotalOrders / grandTotal.orders) * 100) + '%';

                                    let tmpAvg = cuisineTotal[data[monthKey].cuisine_name].orders / 6;
                                    let grandAvg = grandTotal.orders / 6;
                                    tmpObj.final_avg = round((tmpAvg / grandAvg) * 100) + '%';
                                });
                                finalObj.push(tmpObj);
                            });

                            let jsonData = {
                                "data": finalObj,
                                "columns": column
                            };

                            callback(null, jsonData);
                        }).catch(next);
                    },
                    avg_commission_percent: (callback) => {
                        if (type != Constants.AVG_COMMISSION_PERCENT) return callback(null, null);
                        let commonConditions = {
                            admin_status: Constants.ORDER_DELIVERED,
                            "$and": [{ delivery_type: { $exists: true } }, { delivery_type: { $ne: "" } }, { delivery_type: { $ne: null } }]
                        };
                        if (type && yearType) {
                            if (yearType == Constants.FIRST_HALF) {
                                commonConditions.order_date = {
                                    $gte: newDate(year + "-01-01 00:00:00"),
                                    $lte: newDate(year + "-06-30 23:59:59"),
                                };
                            } else {
                                commonConditions.order_date = {
                                    $gte: newDate(year + "-07-01 00:00:00"),
                                    $lte: newDate(year + "-12-31 23:59:59"),
                                };
                            }
                        }
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
                            { $match: yearMonthConditions },
                            { $sort: { month: Constants.SORT_ASC } },
                        ]).toArray().then((result) => {
                            let column = [
                                {
                                    "title": res.__("admin.report.delivery_by"),
                                    "data": "delivery_by"
                                }
                            ];
                            if (yearType == Constants.FIRST_HALF) {
                                for (let i = 1; i <= 6; i++) {
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
                                "title": res.__("admin.report.average"),
                                "data": "final_avg"
                            });

                            let dataObj = {};
                            let grandTotal = { avg_commission_percent: 0 };
                            let monthTotal = {};
                            let deliveryTypeTotal = {};

                            result.forEach(record => {
                                if (!deliveryTypeTotal[record.delivery_type]) deliveryTypeTotal[record.delivery_type] = { avg_commission_percent: 0 };
                                if (!monthTotal[record.month]) monthTotal[record.month] = { avg_commission_percent: 0 };

                                deliveryTypeTotal[record.delivery_type].avg_commission_percent += record.payout_percentage;

                                monthTotal[record.month].avg_commission_percent += record.payout_percentage;

                                grandTotal.avg_commission_percent += record.payout_percentage;
                            });

                            result.forEach(record => {
                                let monthStr = Constants.REPORT_CHART_MONTH_NAMES[record.month] + '-' + record.year;
                                if (!dataObj[record.delivery_type]) dataObj[record.delivery_type] = {};
                                if (!dataObj[record.delivery_type][monthStr]) dataObj[record.delivery_type][monthStr] = {};

                                record[monthStr] = round(record.payout_percentage) + '%';

                                record.delivery_by = Constants.DELIVERY_BY[record.delivery_type];
                                dataObj[record.delivery_type][monthStr] = record;
                            });

                            let finalObj = [];
                            Object.values(dataObj).forEach(data => {
                                let tmpObj = {};
                                Object.keys(data).forEach(monthKey => {
                                    tmpObj[monthKey] = data[monthKey][monthKey];
                                    tmpObj.delivery_by = data[monthKey].delivery_by;

                                    let tmpAvg = deliveryTypeTotal[data[monthKey].delivery_type].avg_commission_percent / 6;
                                    tmpObj.final_avg = round(tmpAvg) + '%';
                                });
                                finalObj.push(tmpObj);
                            });

                            let jsonData = {
                                "data": finalObj,
                                "columns": column
                            }

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
                req.breadcrumbs(BREADCRUMBS['admin/report/cravez_orders_report']);
                res.render('cravez_orders_report');
            }
        } catch (error) {
            next(error);
        }
    };//End getCravezOrdersList()


    /**
     *  Function for export Cravez Orders report
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As 	Callback argument to the middleware function
     *
     * @return null
    */
    async cravezOrdersReportExport(req, res, next) {
        try {
            let year        = (req.query.year) ? parseInt(req.query.year) : "";
            let yearType    = (req.query.year_type) ? (req.query.year_type) : "";
            let type        = (req.query.type) ? (req.query.type): "";

            let exportConditions= {
                "$and": [{ delivery_type: { $exists: true } }, { delivery_type: { $ne: "" } }, { delivery_type: { $ne: null } }]
            };

            if (type && yearType) {
                if (yearType == Constants.FIRST_HALF) {
                    exportConditions.date = {
                        $gte: newDate(year + "-01-01 00:00:00"),
                        $lte: newDate(year + "-06-30 23:59:59"),
                    };
                } else {
                    exportConditions.date = {
                        $gte: newDate(year + "-07-01 00:00:00"),
                        $lte: newDate(year + "-12-31 23:59:59"),
                    };
                }
            }
            let yearMonthConditions = { year: year };
            if (yearType == Constants.FIRST_HALF) {
                yearMonthConditions['month'] = { $gte: 1, $lte: 6 };
            } else {
                yearMonthConditions['month'] = { $gte: 7, $lte: 12 };
            }
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
                        { $match: yearMonthConditions },
                        { $sort: { month: Constants.SORT_ASC } },
                    ]).toArray().then((result) => {
                        let column = [
                            {
                                "title": res.__("admin.report.delivery_by"),
                                "data": "delivery_by"
                            },
                            {
                                "title": res.__("admin.report.report_type"),
                                "data": "report_type"
                            }
                        ];
                        if (yearType == Constants.FIRST_HALF) {
                            for (let i = 1; i <= 6; i++) {
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

                        if (type == Constants.SALES_VALUE || type == Constants.NO_OF_ORDERS) {
                            column.push({
                                "title": res.__("admin.report.total"),
                                "data": "final_count"
                            });
                        }

                        column.push({
                            "title": res.__("admin.report.average"),
                            "data": "final_avg"
                        });

                        let dataObj = {};
                        let grandTotal = { orders: 0, amount: 0, avg_chq_value: 0 };
                        let monthTotal = {};
                        let deliveryTypeTotal = {};
                        result.forEach(record => {
                            if (!deliveryTypeTotal[record.delivery_type]) deliveryTypeTotal[record.delivery_type] = { orders: 0, amount: 0, avg_chq_value: 0 };
                            if (!monthTotal[record.month]) monthTotal[record.month] = { orders: 0, amount: 0, avg_chq_value: 0 };

                            deliveryTypeTotal[record.delivery_type].orders += record.total_orders;
                            deliveryTypeTotal[record.delivery_type].amount += record.total_amount;
                            deliveryTypeTotal[record.delivery_type].avg_chq_value += round(record.total_amount / record.total_orders);

                            monthTotal[record.month].orders += record.total_orders;
                            monthTotal[record.month].amount += record.total_amount;
                            monthTotal[record.month].avg_chq_value += round(record.total_amount / record.total_orders);

                            grandTotal.orders += record.total_orders;
                            grandTotal.amount += record.total_amount;
                            grandTotal.avg_chq_value += round(record.total_amount / record.total_orders);
                        });

                        result.forEach(record => {
                            let monthStr = Constants.REPORT_CHART_MONTH_NAMES[record.month] + '-' + record.year;
                            if (!dataObj[record.delivery_type]) dataObj[record.delivery_type] = {};
                            if (!dataObj[record.delivery_type][monthStr]) dataObj[record.delivery_type][monthStr] = {};

                            if (type == Constants.AVG_CHQ_VALUE) {
                                record[monthStr] = currencyFormat(record.avg_chq_value);
                            } else if (type == Constants.NO_OF_ORDERS) {
                                record[monthStr] = (record.total_orders) + ' (' + round((record.total_orders / monthTotal[record.month].orders) * 100) + '%)';
                            } else {
                                record[monthStr] = currencyFormat(record.total_amount) + ' (' + round((record.total_amount / monthTotal[record.month].amount) * 100) + '%)';
                            }
                            record.delivery_by = Constants.DELIVERY_BY[record.delivery_type];
                            dataObj[record.delivery_type][monthStr] = record;
                        });

                        let finalObj = [];
                        Object.values(dataObj).forEach(data => {
                            let tmpObj = {};
                            Object.keys(data).forEach(monthKey => {
                                tmpObj[monthKey] = data[monthKey][monthKey];
                                tmpObj.delivery_by = data[monthKey].delivery_by;
                                if (type == Constants.NO_OF_ORDERS) {
                                    let tmpTotalOrders = (deliveryTypeTotal[data[monthKey].delivery_type].orders) ? deliveryTypeTotal[data[monthKey].delivery_type].orders : 0;
                                    tmpObj.final_count = tmpTotalOrders + ' (' + round((tmpTotalOrders / grandTotal.orders) * 100) + '%)';
                                }
                                if (type == Constants.SALES_VALUE) {
                                    let tmpTotalValue = (deliveryTypeTotal[data[monthKey].delivery_type].amount) ? deliveryTypeTotal[data[monthKey].delivery_type].amount : 0;
                                    tmpObj.final_count = currencyFormat(tmpTotalValue) + ' (' + round((tmpTotalValue / grandTotal.amount) * 100) + '%)';
                                }

                                if (type == Constants.SALES_VALUE) {
                                    let tmpAvg = deliveryTypeTotal[data[monthKey].delivery_type].amount / 6;
                                    let grandAvg = grandTotal.amount / 6;
                                    tmpObj.final_avg = currencyFormat(tmpAvg) + ' (' + round((tmpAvg / grandAvg) * 100) + '%)';
                                } else if (type == Constants.NO_OF_ORDERS) {
                                    let tmpAvg = deliveryTypeTotal[data[monthKey].delivery_type].orders / 6;
                                    let grandAvg = grandTotal.orders / 6;
                                    tmpObj.final_avg = round(tmpAvg) + '(' + round((tmpAvg / grandAvg) * 100) + '%)';
                                } else if (type == Constants.AVG_CHQ_VALUE) {
                                    let tmpAvg = deliveryTypeTotal[data[monthKey].delivery_type].avg_chq_value / 6;
                                    tmpObj.final_avg = currencyFormat(tmpAvg);
                                }
                            });
                            finalObj.push(tmpObj);
                        });
                        let jsonData = {
                            "data": finalObj,
                            "columns": column,
                            "month_total": monthTotal,
                            "grand_total": grandTotal
                        }

                        callback(null, jsonData);
                    }).catch(next);
                },
                payment_method: (callback) => {
                    if (type != Constants.PAYMENT_METHOD) return callback(null, null);
                    let commonConditions = {
                        admin_status: Constants.ORDER_DELIVERED,
                    };
                    if (type && yearType) {
                        if (yearType == Constants.FIRST_HALF) {
                            commonConditions.order_date = {
                                $gte: newDate(year + "-01-01 00:00:00"),
                                $lte: newDate(year + "-06-30 23:59:59"),
                            };
                        } else {
                            commonConditions.order_date = {
                                $gte: newDate(year + "-07-01 00:00:00"),
                                $lte: newDate(year + "-12-31 23:59:59"),
                            };
                        }
                    }
                    commonConditions["$and"] = [{ payment_method: { $exists: true } }, { payment_method: { $ne: "" } }, { payment_method: { $ne: null } }];
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
                        { $match: yearMonthConditions },
                        { $sort: { month: 1 } },
                    ]).toArray().then((result) => {
                        let column = [
                            {
                                "title": res.__("admin.report.payment_method"),
                                "data": "payment_method_name"
                            },
                            {
                                "title": res.__("admin.report.report_type"),
                                "data": "report_type"
                            }
                        ];
                        if (yearType == Constants.FIRST_HALF) {
                            for (let i = 1; i <= 6; i++) {
                                let obj = {
                                    "title": Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year,
                                    "data": Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year
                                }
                                column.push(obj);
                            }
                        } else if (yearType == Constants.SECOND_HALF) {
                            for (let i = 7; i <= 12; i++) {
                                let obj = {
                                    "title": Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year,
                                    "data": Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year
                                }
                                column.push(obj);
                            }
                        }
                        column.push({
                            "title": res.__("admin.report.average"),
                            "data": "final_avg"
                        });

                        let dataObj = {};
                        let grandTotal = { orders: 0 };
                        let monthTotal = {};
                        let paymentMethodTotal = {};

                        result.forEach(record => {
                            if (!paymentMethodTotal[record.payment_method]) paymentMethodTotal[record.payment_method] = { orders: 0 };
                            if (!monthTotal[record.month]) monthTotal[record.month] = { orders: 0 };

                            paymentMethodTotal[record.payment_method].orders += record.order_count;

                            monthTotal[record.month].orders += record.order_count;

                            grandTotal.orders += record.order_count
                        });

                        result.forEach(record => {
                            let monthStr = Constants.REPORT_CHART_MONTH_NAMES[record.month] + '-' + record.year;
                            if (!dataObj[record.payment_method]) dataObj[record.payment_method] = {};
                            if (!dataObj[record.payment_method][monthStr]) dataObj[record.payment_method][monthStr] = {};

                            record[monthStr] = round((record.order_count / monthTotal[record.month].orders) * 100);

                            record.payment_method_name = (Constants.PAYMENT_METHODS[record.payment_method]) ? Constants.PAYMENT_METHODS[record.payment_method] :record.payment_method;
                            dataObj[record.payment_method][monthStr] = record;

                        });
                        let finalObj = [];
                        Object.values(dataObj).forEach(data => {
                            let tmpObj = {};
                            Object.keys(data).forEach(monthKey => {
                                tmpObj[monthKey] = data[monthKey][monthKey];
                                tmpObj.payment_method_name = data[monthKey].payment_method_name;

                                let tmpTotalOrders = (paymentMethodTotal[data[monthKey].payment_method].orders) ? paymentMethodTotal[data[monthKey].payment_method].orders : 0;
                                tmpObj.final_count = round((tmpTotalOrders / grandTotal.orders) * 100);

                                let tmpAvg = paymentMethodTotal[data[monthKey].payment_method].orders / 6;
                                let grandAvg = grandTotal.orders / 6;
                                tmpObj.final_avg = round((tmpAvg / grandAvg) * 100);
                            });
                            finalObj.push(tmpObj);
                        });

                        let jsonData = {
                            "data": finalObj,
                            "columns": column,
                            "month_total": monthTotal,
                            "grand_total": grandTotal
                        }

                        callback(null, jsonData);
                    }).catch(next);
                },
                cuisines: (callback) => {
                    if (type != Constants.CUISINES) return callback(null, null);
                    let commonConditions = {};
                    if (type && yearType) {
                        if (yearType == Constants.FIRST_HALF) {
                            commonConditions.date = {
                                $gte: newDate(year + "-01-01 00:00:00"),
                                $lte: newDate(year + "-06-30 23:59:59"),
                            };
                        } else {
                            commonConditions.date = {
                                $gte: newDate(year + "-07-01 00:00:00"),
                                $lte: newDate(year + "-12-31 23:59:59"),
                            };
                        }
                    }
                    const order_cuisine_reports = this.db.collection(Tables.ORDER_CUISINE_REPORTS);
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
                                cuisine_name: { $first: "$cuisine_name" },
                            },
                        },
                        { $match: yearMonthConditions },
                        { $sort: { month: Constants.SORT_ASC } },
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
                        if (yearType == Constants.FIRST_HALF) {
                            for (let i = 1; i <= 6; i++) {
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
                                }
                                column.push(obj);
                            }
                        }
                        column.push({
                            "title": res.__("admin.report.average"),
                            "data": "final_avg"
                        });

                        let dataObj = {};
                        let grandTotal = { orders: 0 };
                        let monthTotal = {};
                        let cuisineTotal = {};

                        result.forEach(record => {
                            if (!cuisineTotal[record.cuisine_name]) cuisineTotal[record.cuisine_name] = { orders: 0 };
                            if (!monthTotal[record.month]) monthTotal[record.month] = { orders: 0 };

                            cuisineTotal[record.cuisine_name].orders += record.order_count;

                            monthTotal[record.month].orders += record.order_count;

                            grandTotal.orders += record.order_count
                        });

                        result.forEach(record => {
                            let monthStr = Constants.REPORT_CHART_MONTH_NAMES[record.month] + '-' + record.year;
                            if (!dataObj[record.cuisine_name]) dataObj[record.cuisine_name] = {};
                            if (!dataObj[record.cuisine_name][monthStr]) dataObj[record.cuisine_name][monthStr] = {};

                            record[monthStr] = round((record.order_count / monthTotal[record.month].orders) * 100);

                            record.cuisine_name = record.cuisine_name;

                            dataObj[record.cuisine_name][monthStr] = record;

                        });

                        let finalObj = [];
                        Object.values(dataObj).forEach(data => {
                            let tmpObj = {};
                            Object.keys(data).forEach(monthKey => {
                                tmpObj[monthKey] = data[monthKey][monthKey];
                                tmpObj.cuisine_name = data[monthKey].cuisine_name;

                                let tmpTotalOrders = (cuisineTotal[data[monthKey].cuisine_name].orders) ? cuisineTotal[data[monthKey].cuisine_name].orders : 0;
                                tmpObj.final_count = round((tmpTotalOrders / grandTotal.orders) * 100);

                                let tmpAvg = cuisineTotal[data[monthKey].cuisine_name].orders / 6;
                                let grandAvg = grandTotal.orders / 6;
                                tmpObj.final_avg = round((tmpAvg / grandAvg) * 100);
                            });
                            finalObj.push(tmpObj);
                        });

                        let jsonData = {
                            "data": finalObj,
                            "columns": column,
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
                    if (type && yearType) {
                        if (yearType == Constants.FIRST_HALF) {
                            commonConditions.order_date = {
                                $gte: newDate(year + "-01-01 00:00:00"),
                                $lte: newDate(year + "-06-30 23:59:59"),
                            };
                        } else {
                            commonConditions.order_date = {
                                $gte: newDate(year + "-07-01 00:00:00"),
                                $lte: newDate(year + "-12-31 23:59:59"),
                            };
                        }
                    }
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
                        { $match: yearMonthConditions },
                        { $sort: { month: Constants.SORT_ASC } },
                    ]).toArray().then((result) => {
                        let column = [
                            {
                                "title": res.__("admin.report.delivery_by"),
                                "data": "delivery_by"
                            },
                            {
                                "title": res.__("admin.report.report_type"),
                                "data": "report_type"
                            }
                        ];
                        if (yearType == Constants.FIRST_HALF) {
                            for (let i = 1; i <= 6; i++) {
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
                            "title": res.__("admin.report.average"),
                            "data": "final_avg"
                        });

                        let dataObj = {};
                        let grandTotal = { avg_commission_percent: 0 };
                        let monthTotal = {};
                        let deliveryTypeTotal = {};

                        result.forEach(record => {
                            if (!deliveryTypeTotal[record.delivery_type]) deliveryTypeTotal[record.delivery_type] = { avg_commission_percent: 0 };
                            if (!monthTotal[record.month]) monthTotal[record.month] = { avg_commission_percent: 0 };

                            deliveryTypeTotal[record.delivery_type].avg_commission_percent += record.payout_percentage;

                            monthTotal[record.month].avg_commission_percent += record.payout_percentage;

                            grandTotal.avg_commission_percent += record.payout_percentage;
                        });

                        result.forEach(record => {
                            let monthStr = Constants.REPORT_CHART_MONTH_NAMES[record.month] + '-' + record.year;
                            if (!dataObj[record.delivery_type]) dataObj[record.delivery_type] = {};
                            if (!dataObj[record.delivery_type][monthStr]) dataObj[record.delivery_type][monthStr] = {};

                            record[monthStr] = round(record.payout_percentage);

                            record.delivery_by = Constants.DELIVERY_BY[record.delivery_type];
                            dataObj[record.delivery_type][monthStr] = record;
                        });

                        let finalObj = [];
                        Object.values(dataObj).forEach(data => {
                            let tmpObj = {};
                            Object.keys(data).forEach(monthKey => {
                                tmpObj[monthKey] = data[monthKey][monthKey];
                                tmpObj.delivery_by = data[monthKey].delivery_by;

                                let tmpAvg = deliveryTypeTotal[data[monthKey].delivery_type].avg_commission_percent / 6;
                                tmpObj.final_avg = round(tmpAvg);
                            });
                            finalObj.push(tmpObj);
                        });

                        let jsonData = {
                            "data": finalObj,
                            "columns": column
                        }

                        callback(null, jsonData);
                    }).catch(next);
                },
            }, (err, response) => {
                let data = [];
                let column = [];
                let total = {};
                let monTotal = {};
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
                    total = response.records.grand_total;
                    monTotal = response.records.month_total;
                }

                let temp        = [];
                let commonColls = [];

                    /** Define excel heading label **/
                column.forEach(col => {
                    commonColls.push(col.title);
                });

                if (type == Constants.PAYMENT_METHOD) {
                    if (data && data.length > 0) {
                        const grandTotal = {};
                        data.forEach(field => {
                            for (let [key, value] of Object.entries(field)) {
                                if (grandTotal[key]) {
                                    grandTotal[key] += value;
                                } else {
                                    grandTotal[key] = value;
                                }
                            }
                        });
                        data.forEach(obj => {
                            for (let key in obj) {
                                if (!isNaN(obj[key])) {
                                    obj[key] = (obj[key] + '%');
                                }
                            }
                        });
                        data.map(records => {
                            let buffer = [
                                (records.payment_method_name) ? records.payment_method_name : "",
                                Constants.CRAVEZ_ORDERS_REPORT_TYPE[type],
                            ];
                            for (let i = 2; i < column.length; i++) {
                                buffer.push(records[column[i].data]);
                            }
                            temp.push(buffer);
                        });
                        let totalRow = [
                            res.__(""),
                            res.__("admin.report.grand_total"),
                        ];
                        if (yearType == Constants.FIRST_HALF) {
                            for (let i = 1; i <= 6; i++) {
                                totalRow.push((grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) ? ((round(grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) > 100) ? '100%' : round(grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) + '%') : (0) + '%')
                            }
                        } else if (yearType == Constants.SECOND_HALF) {
                            for (let i = 7; i <= 12; i++) {
                                totalRow.push((grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) ? ((round(grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) > 100) ? '100%' : round(grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) + '%') : (0) + '%')
                            }
                        }
                        totalRow.push((grandTotal.final_avg) ? round(grandTotal.final_avg)+'%' : (0)+'%');
                        temp.push(totalRow);
                    }
                } else if (type == Constants.CUISINES) {
                    if (data && data.length > 0) {
                        const grandTotal = {};
                        data.forEach(field => {
                            for (let [key, value] of Object.entries(field)) {
                                if (grandTotal[key]) {
                                    grandTotal[key] += value;
                                } else {
                                    grandTotal[key] = value;
                                }
                            }
                        });
                        data.map(obj => {
                            for (let key in obj) {
                                if (!isNaN(obj[key])) {
                                    obj[key] = (obj[key] + '%');
                                }
                            }
                        });
                        data.map(records => {
                            let buffer = [
                                (records.cuisine_name) ? records.cuisine_name : "",
                                Constants.CRAVEZ_ORDERS_REPORT_TYPE[type],
                            ];
                            for (let i = 2; i < column.length; i++) {
                                buffer.push(records[column[i].data]);
                            }
                            temp.push(buffer);
                        });
                        let totalRow = [
                            res.__(""),
                            res.__("admin.report.grand_total"),
                        ];
                        if (yearType == Constants.FIRST_HALF) {
                            for (let i = 1; i <= 6; i++) {
                                totalRow.push((grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) ? ((round(grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) > 100) ? '100%' : round(grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) + '%') : (0) + '%')
                            }
                        } else if (yearType == Constants.SECOND_HALF) {
                            for (let i = 7; i <= 12; i++) {
                                totalRow.push((grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) ? ((round(grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) > 100) ? '100%' : round(grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) + '%') : (0) + '%')
                            }
                        }
                        totalRow.push((grandTotal.final_avg) ? round(grandTotal.final_avg) + '%' : (0) + '%');
                        temp.push(totalRow);
                    }
                } else if (type == Constants.AVG_COMMISSION_PERCENT) {
                    if (data && data.length > 0) {
                        const grandTotal = {};
                        data.forEach(field => {
                            for (let [key, value] of Object.entries(field)) {
                                if (grandTotal[key]) {
                                    grandTotal[key] += value;
                                } else {
                                    grandTotal[key] = value;
                                }
                            }
                        });
                        data.map(obj => {
                            for (let key in obj) {
                                if (!isNaN(obj[key])) {
                                    obj[key] = (obj[key] + '%');
                                }
                            }
                        });
                        data.map(records => {
                            let buffer = [
                                (records.delivery_by) ? records.delivery_by : "",
                                Constants.CRAVEZ_ORDERS_REPORT_TYPE[type],
                            ];
                            for (let i = 2; i < column.length; i++) {
                                buffer.push(records[column[i].data]);
                            }
                            temp.push(buffer);
                        });
                        let totalRow = [
                            res.__(""),
                            res.__("admin.report.grand_total"),
                        ];
                        if (yearType == Constants.FIRST_HALF) {
                            for (let i = 1; i <= 6; i++) {
                                totalRow.push((grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) ? ((round(grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) > 100) ? '100%' : round(grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) + '%') : (0) + '%')
                            }
                        } else if (yearType == Constants.SECOND_HALF) {
                            for (let i = 7; i <= 12; i++) {
                                totalRow.push((grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) ? ((round(grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) > 100) ? '100%' : round(grandTotal[Constants.REPORT_CHART_MONTH_NAMES[i] + '-' + year]) + '%') : (0) + '%')
                            }
                        }
                        totalRow.push((grandTotal.final_avg) ? round(grandTotal.final_avg) + '%' : (0) + '%');
                        temp.push(totalRow);
                    }
                } else {
                    if (data && data.length > 0) {
                        data.map(records => {
                            let buffer = [
                                (records.delivery_by) ? records.delivery_by : "",
                                Constants.CRAVEZ_ORDERS_REPORT_TYPE[type],
                            ];
                            for (let i=2;i<column.length;i++){
                                buffer.push(records[column[i].data]);
                            }
                            temp.push(buffer);
                        });
                        let totalRow = [
                            res.__(""),
                            res.__("admin.report.grand_total"),
                        ];
                        if (yearType == Constants.FIRST_HALF) {
                            for (let i = 1; i <= 6; i++) {
                                if (type==Constants.NO_OF_ORDERS) {
                                    totalRow.push((monTotal[i]) ? round(monTotal[i].orders) : (0))
                                } else if (type == Constants.SALES_VALUE){
                                    totalRow.push((monTotal[i]) ? currencyFormat(monTotal[i].amount) : currencyFormat(0))
                                } else{
                                    totalRow.push((monTotal[i]) ? currencyFormat(monTotal[i].avg_chq_value) : currencyFormat(0))
                                }
                            }
                        } else if (yearType == Constants.SECOND_HALF) {
                            for (let i = 7; i <= 12; i++) {
                                if (type == Constants.NO_OF_ORDERS) {
                                    totalRow.push((monTotal[i]) ? round(monTotal[i].orders) : (0))
                                } else if (type == Constants.SALES_VALUE) {
                                    totalRow.push((monTotal[i]) ? currencyFormat(monTotal[i].amount) : currencyFormat(0))
                                } else {
                                    totalRow.push((monTotal[i]) ? currencyFormat(monTotal[i].avg_chq_value) : currencyFormat(0))
                                }
                            }
                        }
                        if (type == Constants.NO_OF_ORDERS) {
                            totalRow.push((total.orders) ? round(total.orders) : (0));
                            totalRow.push((total.orders) ? round(total.orders/6) : (0));
                        } else if (type == Constants.SALES_VALUE) {
                            totalRow.push((total.amount) ? currencyFormat(total.amount) : currencyFormat(0));
                            totalRow.push((total.amount) ? currencyFormat(total.amount/6) : currencyFormat(0));
                        } else {
                            totalRow.push((total.avg_chq_value) ? currencyFormat(total.avg_chq_value/6) : currencyFormat(0))
                        }
                        temp.push(totalRow);
                    }
                }
                /**  Function to export data in excel format **/
                exportToExcel(req, res, {
                    file_prefix: "CravezOrdersReport",
                    heading_columns : commonColls,
                    export_data     : temp
                });
            });
        } catch (error) {
            next(error);
        }
    };// end cravezOrdersReportExport()
}
