import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, newDate, exportToExcel, configDatatable, currencyFormat, round } from '../../../../utils/index.mjs';

// Model for restaurant performance report
export default class RestaurantPerformanceReport {
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
    async getRestaurantPerformanceList(req, res, next) {
        try{
            if (isPost(req)) {
                let limit           = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip            = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                let fromDate        = (req.body.from_date) ? newDate(req.body.from_date) 		: "";
                let toDate          = (req.body.to_date) ? newDate(req.body.to_date)   		: "";
                let restaurantIds   = (req.body.restaurant_ids) ? req.body.restaurant_ids : [];
                let branchIds       = (req.body.branch_ids) ? req.body.branch_ids : [];
                const collection    = this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);

                if (restaurantIds.constructor != Array) restaurantIds = [restaurantIds];
                if (branchIds.constructor != Array) branchIds = [branchIds];
                
                /** Configure Datatable conditions*/
                let dataTableConfig = await configDatatable(req, res, null);
                let commonConditions = {
                    restaurant_id: { $in: arrayToObject(restaurantIds) },
                };
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
                        collection.aggregate([
                            { $match: dataTableConfig.conditions },
                            {
                                $group: {
                                    _id: { $dateToString: { format: "%Y-%m", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE } },
                                    total_orders    : { $sum: "$total_orders" },
                                    total_amount    : { $sum: "$total_amount" },
                                    cravez_payout   : { $sum: "$cravez_payout" },
                                    branch_id       : { $first: "$branch_id" },
                                    restaurant_id   : { $first: "$restaurant_id" },
                                    restaurant_name : { $last: "$restaurant_name" },
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
                            { $skip : skip },
                            { $limit: limit },
                        ]).toArray().then(result => {
                            callback(null, result);
                        }).catch(next);
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
                        ]).toArray().then(countResult => {
                            callback(null, countResult.length);
                        }).catch(next);
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
                        ]).toArray().then(countResult => {
                            callback(null, countResult.length);
                        }).catch(next);
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
                        collection  : Tables.RESTAURANTS,
                        columns     : ["_id", ["name", Constants.DEFAULT_LANGUAGE_CODE]],
                        conditions  : {
                            is_deleted  : Constants.NOT_DELETED
                        },
                    }]
                }).then(response => {
                   
                    /** render listing page **/
                    req.breadcrumbs(BREADCRUMBS['admin/report/restaurant_performance_report']);
                    res.render('restaurant_performance_report', {
                        restaurant_list : response?.final_html_data?.["0"] || "",
                    });
                }).catch(next);
            }
        }catch(error){
            return next(error);
        }
    };//End getRestaurantPerformanceList()


    /**
     *  Function for export restaurants performance report
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As 	Callback argument to the middleware function
     *
     * @return null
    */
    async restaurantPerformanceReportExport(req, res, next) {
        try{
            let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
            let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";		
            let restaurantIds	= (req.query.restaurant_ids)? (req.query.restaurant_ids).split(","): [];
            let branchIds		= (req.query.branch_ids) ? (req.query.branch_ids).split(",")   	: [];

            if (restaurantIds.constructor != Array) restaurantIds = [restaurantIds];
            if (branchIds.constructor != Array) branchIds = [branchIds];

            let exportConditions= {
                restaurant_id: { $in: arrayToObject(restaurantIds) },
            };

            /** Condition for date */
            if (fromDate != "" && toDate != "") {
                exportConditions["date"] = {
                    $gte: newDate(fromDate),
                    $lte: newDate(toDate),
                };
            }

            if (branchIds.length > 0) exportConditions.branch_id = { $in: arrayToObject(branchIds) };
        
            /** Get details **/
            const branch_wise_processed_orders = this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);
            branch_wise_processed_orders.aggregate([
                { $match: exportConditions },
                {       
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE } },
                        total_orders    : { $sum: "$total_orders" },
                        total_amount    : { $sum: "$total_amount" },
                        cravez_payout   : { $sum: "$cravez_payout" },
                        restaurant_id   : { $first: "$restaurant_id" },
                        branch_id       : { $first: "$branch_id" },
                        restaurant_name : { $last: "$restaurant_name" },
                        year: { $first: { "$year": "$date" } },
                        month: { $first: { "$month": "$date" } },
                        delivery_fees: { $sum: { $cond: [{ $eq: ["$delivery_type", "cravez"] }, "$delivery_fee", 0] } },
                    },
                },
                {
                    $addFields: {
                        avg_chq_value: { $divide: ["$total_amount", "$total_orders"] },
                    }
                },
                { $sort: { year: 1, month: 1 } },
            ]).toArray().then(findResult => {
                
                let temp        = [];
                let commonColls = [];

                /** Define excel heading label **/

                commonColls = [
                    res.__("admin.report.restaurant_name"),
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
                    file_prefix     : "RestaurantsPerformanceReport",
                    heading_columns : commonColls,
                    export_data     : temp
                });
            }).catch(next);
        }catch(error){
            return next(error);
        }
    };// end restaurantPerformanceReportExport()

}
