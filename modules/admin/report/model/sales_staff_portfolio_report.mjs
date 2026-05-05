import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, newDate, exportToExcel, configDatatable, currencyFormat, round } from '../../../../utils/index.mjs';

// Model for sales staff portfolio report
export default class SalesStaffPortfolioReport {
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
    async getSalesStaffPortfolioList(req, res, next) {
		try{
            if (isPost(req)) {
                let year            = (req.body.year) ? parseInt(req.body.year) 	: "";
                let yearType        = (req.body.year_type) ? (req.body.year_type)   : "";
                let type            = (req.body.type) ? req.body.type : '';
                const collection    = this.db.collection(Tables.ORDERS);

                /** Configure Datatable conditions*/
                let dataTableConfig = await configDatatable(req, res, null);
                dataTableConfig.conditions.admin_status = Constants.ORDER_DELIVERED;
                if (type && yearType) {
                    if (yearType == Constants.FIRST_HALF) {
                        dataTableConfig.conditions.order_date = {
                            $gte : newDate(year+"-01-01 00:00:00"),
                            $lte : newDate(year+"-06-30 23:59:59"),
                        };
                    }else{
                        dataTableConfig.conditions.order_date = {
                            $gte : newDate(year+"-07-01 00:00:00"),
                            $lte : newDate(year+"-12-31 23:59:59"),
                        };
                    }
                }

                let yearMonthConditions = { year: year };
                if (yearType == Constants.FIRST_HALF) {
                    yearMonthConditions['month'] = { $gte: 1, $lte: 6 };
                } else {
                    yearMonthConditions['month'] = { $gte: 7, $lte: 12 };
                }
                asyncParallel({
                    records: (callback) => {
                        collection.aggregate([
                            {$match: dataTableConfig.conditions },
                            {$lookup:	{
                                "from" 			: 	Tables.RESTAURANTS,
                                "localField"    :	"restaurant_id",
                                "foreignField" 	: 	"_id",
                                "as" 			: 	"restaurant_details"
                            }},
                            {$addFields : {
                                added_by: { $arrayElemAt: ["$restaurant_details.added_by",0]},
                            }},
                            { $match: { added_by: { $ne: "" }, added_by:{$ne:null}}},
                            {
                                $lookup: {
                                    "from"          : Tables.USERS,
                                    "localField"    : "added_by",
                                    "foreignField"  : "_id",
                                    "as"            : "user_details"
                                }
                            },
                            {
                                $addFields: {
                                    name: { $arrayElemAt: ["$user_details.full_name", 0] },
                                }
                            },
                            {
                                $group: {
                                    _id: {
                                        year_month: { $dateToString: { format: "%Y-%m", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE } },
                                        restaurant_id:"$restaurant_id",
                                    },
                                    total_orders    : { $sum: 1 },
                                    total_amount    : { $sum: "$order_price" },
                                    cravez_payout   : { $sum: "$cravez_payout" },
                                    name            : { $first: "$name" },
                                    year            : { $last: { "$year": "$order_date" } },
                                    month           : { $last: { "$month": "$order_date" } },
                                    added_by        : { $first: "$added_by"}
                                },
                            },
                            {
                                $group: {
                                    _id: {
                                        year: "$year",
                                        month: "$month",
                                        added_by: "$added_by",
                                    },
                                    total_orders: { $sum: "$total_orders" },
                                    total_amount: { $sum: "$total_amount" },
                                    cravez_payout: { $sum: "$cravez_payout" },
                                    name: { $first: "$name" },
                                    year: { $first: "$year"},
                                    month: { $first: "$month" },
                                },
                            },
                            { $match: yearMonthConditions },
                            { $sort: { month: Constants.SORT_ASC} },
                        ]).toArray().then(result => {
                            let column = [
                                {
                                    "title": res.__("admin.report.name"),
                                    "data" : "name"
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
                            result.map(record=>{
                                let data = '';
                                if (yearType == Constants.FIRST_HALF && record.month<=6) {
                                    if (type == Constants.NO_OF_ORDERS){
                                        data = (record.total_orders) ? record.total_orders : 0;
                                    } else if (type == Constants.SALES_VALUE){
                                        data = (record.total_amount) ? (record.total_amount) : (0);
                                    } else if (type == Constants.COMMISSION) {
                                        data = (record.cravez_payout) ? (record.cravez_payout) : (0);
                                    }
                                    let obj = {};
                                    obj[Constants.REPORT_CHART_MONTH_NAMES[record.month] + '-' + record.year] = data;
                                    obj.name = record.name;
                                    dataArray.push(obj);
                                } else if (yearType == Constants.SECOND_HALF && record.month <= 12 && record.month >= 7) {
                                    if (type == Constants.NO_OF_ORDERS) {
                                        data = (record.total_orders) ? record.total_orders : 0;
                                    } else if (type == Constants.SALES_VALUE) {
                                        data = (record.total_amount) ? (record.total_amount) : (0);
                                    } else if (type == Constants.COMMISSION) {
                                        data = (record.cravez_payout) ? (record.cravez_payout) : (0);
                                    }
                                    let obj = {};
                                    obj[Constants.REPORT_CHART_MONTH_NAMES[record.month] + '-' + record.year] = data;
                                    obj.name = record.name;
                                    dataArray.push(obj);
                                }
                            });

                            let listOfName = [];
                            let finalObj = [];
                            dataArray.map(sample => {
                                listOfName.push(String(sample.name));
                            });

                            let uniqueArray = [];
                            for (let i = 0, l = listOfName.length; i < l; i++){
                                if (uniqueArray.indexOf(listOfName[i]) === -1 && listOfName[i] !== '')
                                    uniqueArray.push(listOfName[i]);
                            }

                            uniqueArray.map(list => {
                                finalObj.push({
                                    name: list
                                });
                            });

                            dataArray.map(sample => {
                                let sampleName = sample.name;
                                finalObj.map((obj, index) => {
                                    if (obj.name === sampleName) {
                                        finalObj[index] = Object.assign(sample, obj);
                                    }
                                });
                            });
                            finalObj.map(obj => {
                                let total = 0;
                                for (let key in obj) {
                                    if (!isNaN(obj[key])) {
                                        total += obj[key];
                                    }
                                }
                                obj.total = round(total);
                                obj.average = round(total / 6);
                                for (let key in obj) {
                                    if (type != Constants.NO_OF_ORDERS) {
                                        if (!isNaN(obj[key])) {
                                            obj[key] = currencyFormat(obj[key]);
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
                /** render listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/report/sales_staff_portfolio_report']);
                res.render('sales_staff_portfolio_report');
            }
        }catch(error){
            return next(error);
        }
    };//End getSalesStaffPortfolioList()


    /**
     *  Function for export Sales Staff Portfolio report
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As 	Callback argument to the middleware function
     *
     * @return null
    */
    async salesStaffPortfolioReportExport(req, res, next) {
		try{
            let year        = (req.query.year) ? parseInt(req.query.year) : "";
            let yearType    = (req.query.year_type) ? (req.query.year_type) : "";
            let type        = (req.query.type) ? (req.query.type): "";

            let exportCondition = {admin_status : Constants.ORDER_DELIVERED};

            if(type && yearType) {
                if (yearType == Constants.FIRST_HALF) {
                    exportCondition.order_date = {
                        $gte : newDate(year+"-01-01 00:00:00"),
                        $lte : newDate(year+"-06-30 23:59:59"),
                    };
                }else{
                    exportCondition.order_date = {
                        $gte : newDate(year+"-07-01 00:00:00"),
                        $lte : newDate(year+"-12-31 23:59:59"),
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
            const collection = this.db.collection(Tables.ORDERS);

            collection.aggregate([
                {$match : exportCondition},
                {
                    $lookup: {
                        "from": Tables.RESTAURANTS,
                        "localField": "restaurant_id",
                        "foreignField": "_id",
                        "as": "restaurant_details"
                    }
                },
                {
                    $addFields: {
                        added_by: { $arrayElemAt: ["$restaurant_details.added_by", 0] },
                    }
                },
                { $match: { added_by: { $ne: "" }, added_by: { $ne: null } } },
                {
                    $lookup: {
                        "from": Tables.USERS,
                        "localField": "added_by",
                        "foreignField": "_id",
                        "as": "user_details"
                    }
                },
                {
                    $addFields: {
                        name: { $arrayElemAt: ["$user_details.full_name", 0] },
                    }
                },
                {
                    $group: {
                        _id: {
                            year_month: { $dateToString: { format: "%Y-%m", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE } },
                            restaurant_id: "$restaurant_id",
                        },
                        total_orders: { $sum: 1 },
                        total_amount: { $sum: "$order_price" },
                        cravez_payout: { $sum: "$cravez_payout" },
                        name: { $first: "$name" },
                        year: { $first: { "$year": "$order_date" } },
                        month: { $first: { "$month": "$order_date" } },
                        added_by: { $first: "$added_by" }
                    },
                },
                {
                    $group: {
                        _id: {
                            year: "$year",
                            month: "$month",
                            added_by: "$added_by",
                        },
                        total_orders: { $sum: "$total_orders" },
                        total_amount: { $sum: "$total_amount" },
                        cravez_payout: { $sum: "$cravez_payout" },
                        name: { $first: "$name" },
                        year: { $first: "$year" },
                        month: { $first: "$month" },
                    },
                },
                { $match: yearMonthConditions },
                { $sort: { month: Constants.SORT_ASC } },
            ]).toArray().then(result => {
                let column = [
                    res.__("admin.report.report_type"),
                    res.__("admin.report.name"),
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
                result.map(record => {
                    let data = '';
                    if (yearType == Constants.FIRST_HALF && record.month <= 6) {
                        if (type == Constants.NO_OF_ORDERS) {
                            data = (record.total_orders) ? record.total_orders : 0;
                        } else if (type == Constants.SALES_VALUE) {
                            data = (record.total_amount) ? (record.total_amount) : (0);
                        }  else if (type == Constants.COMMISSION) {
                            data = (record.cravez_payout) ? (record.cravez_payout) : (0);
                        }
                        let obj = {};
                        obj[Constants.REPORT_CHART_MONTH_NAMES[record.month] + '-' + record.year] = data;
                        obj.name = record.name;
                        dataArray.push(obj);
                    } else if (yearType == Constants.SECOND_HALF && record.month <= 12 && record.month >= 7) {
                        if (type == Constants.NO_OF_ORDERS) {
                            data = (record.total_orders) ? record.total_orders : 0;
                        } else if (type == Constants.SALES_VALUE) {
                            data = (record.total_amount) ? (record.total_amount) : (0);
                        }else if (type == Constants.COMMISSION) {
                            data = (record.cravez_payout) ? (record.cravez_payout) : (0);
                        }
                        let obj = {};
                        obj[Constants.REPORT_CHART_MONTH_NAMES[record.month] + '-' + record.year] = data;
                        obj.name = record.name;
                        dataArray.push(obj);
                    }
                });

                let listOfName = [];
                let finalObj = [];
                dataArray.map(sample => {
                    listOfName.push(String(sample.name));
                });

                let uniqueArray = [];
                for (let i = 0, l = listOfName.length; i < l; i++) {
                    if (uniqueArray.indexOf(listOfName[i]) === -1 && listOfName[i] !== '')
                        uniqueArray.push(listOfName[i]);
                }

                uniqueArray.map(list => {
                    finalObj.push({
                        name: list
                    });
                });

                dataArray.map(sample => {
                    let sampleName = sample.name;
                    finalObj.map((obj, index) => {
                        if (obj.name === sampleName) {
                            finalObj[index] = Object.assign(sample, obj);
                        }
                    });
                });
                finalObj.map(obj => {
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
                finalObj.map(obj => {
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
                    finalObj.map(records => {
                        let buffer = [
                            Constants.SALES_STAFF_PORTFOLIO_REPORT_TYPE[type],
                            (records.name) ? records.name : "",
                        ];
                        for (let i=2;i<column.length;i++){
                            buffer.push(records[column[i]]);
                        }
                        temp.push(buffer);
                    });
                    let total = [
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
                    file_prefix     : "SalesStaffPortfolioReport",
                    heading_columns : commonColls,
                    export_data     : temp
                });
            }).catch(next);
        }catch(error){
            return next(error);
        }
    };// end salesStaffPortfolioReportExport()
}
