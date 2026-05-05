import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, newDate, exportToExcel, configDatatable, round, currencyFormat } from '../../../../utils/index.mjs';

// Model for area performance report
export default class AreaPerformanceReport {

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
    async getAreaPerformanceList(req, res, next) {
        try {
            if (isPost(req)) {
                let limit           = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip            = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                let fromDate        = (req.body.from_date) ? newDate(req.body.from_date) 		: "";
                let toDate          = (req.body.to_date) ? newDate(req.body.to_date)   		: "";
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
                /** Condition for date */
                if (fromDate != "" && toDate != "") {
                    commonConditions["date"] = {
                        $gte: newDate(fromDate),
                        $lte: newDate(toDate),
                    };
                }

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
                                    delivery_fees   : { $sum: { $cond: [{ $eq: ["$delivery_type", Constants.DELIVERY_BY_CRAVEZ] }, "$delivery_fee", 0]}},
                                },
                            },
                            {
                                $addFields: {
                                    avg_chq_value: { $divide: ["$total_amount", "$total_orders"] },
                                }
                            },
                            { $sort: { year: 1, month: 1 } },
                            { $skip : skip },
                            { $limit: limit },
                        ]).toArray().then(result=>{
                            callback(null, result);
                        }).catch(err=>{
                            callback(err, []);
                        });
                    },
                    total_records: (callback) => {
                        /** Get total number of records **/
                        collection.aggregate([
                            { $match: commonConditions },
                            {
                                $group: {
                                    _id: {
                                        year_month: { $dateToString: { format: "%Y-%m", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE } }
                                    },
                                }
                            }
                        ]).toArray().then(countResult=>{
                            callback(null, countResult.length);
                        }).catch(err=>{
                            callback(err, 0);
                        });
                    },
                    filter_records: (callback) => {
                        /** Get filtered records counting **/
                        collection.aggregate([
                            { $match: dataTableConfig.conditions },
                            {
                                $group: {
                                    _id: {
                                        year_month: { $dateToString: { format: "%Y-%m", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE } }
                                    },
                                }
                            }
                        ]).toArray().then(countResult=>{
                            callback(null, countResult.length);
                        }).catch(err=>{
                            callback(err, 0);
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
                    req.breadcrumbs(BREADCRUMBS['admin/report/area_performance_report']);
                    res.render('area_performance_report', {
                        restaurant_list : response?.final_html_data?.[0] || "",
                        area_list       : response?.final_html_data?.[1] || "",
                    });
                }).catch(next);
            }
        } catch (error) {
            return next(error);
        }
    };//End getAreaPerformanceList()


    /**
     *  Function for export area performance report
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As 	Callback argument to the middleware function
     *
     * @return null
    */
    async areaPerformanceReportExport(req, res, next) {
        let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
		let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";		
		let restaurantIds	= (req.query.restaurant_ids)? (req.query.restaurant_ids).split(","): [];
		let areaIds		    = (req.query.area_ids) ? (req.query.area_ids).split(",")   	: [];

        if (restaurantIds.constructor != Array) restaurantIds = [restaurantIds];
        if (areaIds.constructor != Array) areaIds = [areaIds];

        let exportConditions= {
            area_id: { $in: arrayToObject(areaIds) },
        };

        /** Condition for date */
        if (fromDate != "" && toDate != "") {
            exportConditions["date"] = {
                $gte: newDate(fromDate),
                $lte: newDate(toDate),
            };
        }

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
                    delivery_fees   : { $sum: { $cond: [{ $eq: ["$delivery_type", Constants.DELIVERY_BY_CRAVEZ] }, "$delivery_fee", 0] } },
                },
            },
            {
                $addFields: {
                    avg_chq_value: { $divide: ["$total_amount", "$total_orders"] },
                }
            },
            { $sort: { year: 1, month: 1 } },
        ]).toArray().then(findResult=>{
            
            let temp        = [];
            let commonColls = [];

            /** Define excel heading label **/

            commonColls = [
                res.__("admin.report.restaurant_name"),
                res.__("admin.report.area_name"),
                res.__("admin.report.month_year"),
                res.__("admin.report.no_of_orders"),
                res.__("admin.report.sales_value"),
                res.__("admin.report.delivery_fees"),
                res.__("admin.report.avg_cheque_value"),
                res.__("admin.report.cravez_commission"),
            ];
            let totalOrders = 0;
            let totalAmount = 0;
            let totalDeliveryFee = 0;
            let totalCravezPayout = 0;
            let totalAvgChqValue = 0;
                
            if (findResult && findResult.length > 0) {
                findResult.map(records => {
                    totalOrders += records.total_orders;
                    totalAmount += records.total_amount;
                    totalDeliveryFee += records.delivery_fees;
                    totalCravezPayout += records.cravez_payout;
                    totalAvgChqValue += records.avg_chq_value;
                    let buffer = [
                        (records.restaurant_name) ? records.restaurant_name[Constants.DEFAULT_LANGUAGE_CODE] : "",
                        (records.area_name) ? records.area_name[Constants.DEFAULT_LANGUAGE_CODE] : "",
                        (records.month && records.month) ? Constants.REPORT_CHART_MONTH_NAMES[records.month] + '-' + records.year : "",
                        (records.total_orders)      ? round(records.total_orders) : 0,
                        (records.total_amount)      ? currencyFormat(records.total_amount) : currencyFormat(0),
                        (records.delivery_fees)     ? currencyFormat(records.delivery_fees) : currencyFormat(0),
                        (records.avg_chq_value)     ? currencyFormat(records.avg_chq_value) : currencyFormat(0),
                        (records.cravez_payout)     ? currencyFormat(records.cravez_payout) : currencyFormat(0),                        
                    ];
                    temp.push(buffer);
                });
                var rows = temp.length;
                let grandTotal = [
                    res.__(""),
                    res.__(""),
                    res.__("admin.report.average"),
                    parseFloat(totalOrders / rows).toFixed(2) + ' (' + totalOrders + ' Total)',
                    currencyFormat(parseFloat(totalAmount / rows).toFixed(2)) + ' (' + currencyFormat(totalAmount) + ' Total)',
                    currencyFormat(parseFloat(totalDeliveryFee / rows).toFixed(2)) + ' (' + currencyFormat(totalDeliveryFee) + ' Total)',
                    currencyFormat(parseFloat(totalAvgChqValue / rows).toFixed(2)) + ' (' + currencyFormat(totalAvgChqValue) + ' Total)',
                    currencyFormat(parseFloat(totalCravezPayout / rows).toFixed(2)) + ' (' + currencyFormat(totalCravezPayout) + ' Total)',  
                ];
                temp.push(grandTotal);
            }
            /**  Function to export data in excel format **/
            exportToExcel(req, res, {
                file_prefix     : "AreaPerformanceReport",
                heading_columns : commonColls,
                export_data     : temp
            });
        }).catch(next);
    };// end areaPerformanceReportExport()

}
