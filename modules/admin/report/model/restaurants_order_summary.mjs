import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, newDate, exportToExcel, configDatatable, currencyFormat,round } from '../../../../utils/index.mjs';

// Model for restaurants order summary
export default class RestaurantsOrderSummary {
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
    async getRestaurantsOrderList(req, res, next) {
        try{
            if (isPost(req)) {
                let limit           = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip            = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                let date            = (req.body.date) ? req.body.date : "";
                let restaurantIds   = (req.body.restaurant_ids) ? req.body.restaurant_ids : [];
                let areaIds         = (req.body.area_ids) ? req.body.area_ids : [];
                const collection    = this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);

                var startDate   = newDate(date,Constants.CURRENTDATE_START_DATE_FORMAT);
                var endDate     = newDate(date,Constants.CURRENTDATE_END_DATE_FORMAT);
                if (restaurantIds.constructor != Array) restaurantIds = [restaurantIds];
                if (areaIds.constructor != Array) areaIds = [areaIds];

                /** Configure Datatable conditions*/
                let dataTableConfig = await configDatatable(req, res, null);
                let commonConditions = {};
                /** Condition for date */
                if (date!= "") {
                    commonConditions["date"] = {
                        $gte: newDate(startDate),
                        $lte: newDate(endDate),
                    };
                }
                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);
                if (restaurantIds.length > 0) dataTableConfig.conditions.restaurant_id = { $in: arrayToObject(restaurantIds) };
                if (areaIds.length > 0) dataTableConfig.conditions.area_id = { $in: arrayToObject(areaIds) };
                asyncParallel({
                    records: (callback) => {
                        collection.aggregate([
                            { $match: dataTableConfig.conditions },
                            {
                                $group: {
                                    _id             : { restaurant_id: "$restaurant_id",area_id:"$area_id",delivery_type : "$delivery_type" },
                                    total_orders    : { $sum: "$total_orders" },
                                    total_amount    : { $sum: "$total_amount" },
                                    cravez_payout   : { $sum: "$cravez_payout" },
                                    branch_id       : { $first: "$branch_id" },
                                    restaurant_id   : { $first: "$restaurant_id" },
                                    area_id         : { $first: "$area_id" },
                                    delivery_type   : { $first: "$delivery_type" },
                                    area_name       : { $first: "$area_name" },
                                    restaurant_name : { $last: "$restaurant_name" },
                                    delivery_fees: { $sum: { $cond: [{ $eq: ["$delivery_type", Constants.DELIVERY_BY_CRAVEZ] }, "$delivery_fee", 0]}},
                                },
                            },
                            {
                                $addFields: {
                                    total_revenue: { $add: ["$delivery_fees", "$cravez_payout"] },
                                    avg_chq_value: { $divide: ["$total_amount", "$total_orders"] },
                                }
                            },
                            {
                                $addFields: {
                                    avg_rev_per_order: { $divide: ["$total_revenue", "$total_orders"] },
                                }
                            },
                            { $sort : dataTableConfig.sort_conditions },
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
                                    _id: { restaurant_id: "$restaurant_id",area_id:"$area_id",delivery_type : "$delivery_type" }
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
                                    _id: { restaurant_id: "$restaurant_id",area_id:"$area_id",delivery_type : "$delivery_type" }
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
                    },
                    {
                        collection: Tables.AREAS,
                        columns: ["_id", ["name", Constants.DEFAULT_LANGUAGE_CODE]],
                        conditions: {
                            is_active		: Constants.ACTIVE,
                        },
                    }]
                }).then(response => {
                    /** render listing page **/
                    req.breadcrumbs(BREADCRUMBS['admin/report/restaurants_order_summary']);
                    res.render('restaurants_order_summary', {
                        restaurant_list : response?.final_html_data?.["0"] || "",
                        area_list       : response?.final_html_data?.["1"] || "",
                    });
                }).catch(next);
            }
        }catch(error){
            return next(error);
        }
    };//End getRestaurantsOrderList()


    /**
     *  Function for export restaurants order report
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As 	Callback argument to the middleware function
     *
     * @return null
    */
    async exportRestaurantsOrder(req, res, next) {
        try{
            let date            = (req.query.date) ? req.query.date : "";
            let sortingField    = (req.query.sort_field) ? req.query.sort_field : "_id";
            let sortingDir      = (req.query.sort_dir) ? req.query.sort_dir : "asc";
            let sortOrder       = (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;
            let restaurantIds   = (req.query.restaurant_ids) ? (req.query.restaurant_ids).split(",") : [];
            let areaIds         = (req.query.area_ids) ? (req.query.area_ids).split(",") : [];
            let currentDate     = (req.query.date) ? newDate(req.query.date) : "";
            let previousDate    = (req.query.date) ? newDate(req.query.date) : "";

            var startDate   = newDate(date, Constants.CURRENTDATE_START_DATE_FORMAT);
            var endDate     = newDate(date, Constants.CURRENTDATE_END_DATE_FORMAT);
            if (restaurantIds.constructor != Array) restaurantIds = [restaurantIds];
            if (areaIds.constructor != Array) areaIds = [areaIds];

            let exportConditions= {};
            let sortConditions  = {};
            sortConditions[sortingField] = sortOrder;

            /** Condition for date */
            if (date != "") {
                exportConditions["date"] = {
                    $gte: newDate(startDate),
                    $lte: newDate(endDate),
                };
            }

            let commonConditions = {};
            /** Condition for date */
            previousDate.setDate(previousDate.getDate() - 1);

            let previousStartDate = newDate(previousDate, Constants.CURRENTDATE_START_DATE_FORMAT);
            let currentEndDate = newDate(currentDate, Constants.CURRENTDATE_END_DATE_FORMAT);
            let currentStartDate = newDate(currentDate, Constants.CURRENTDATE_START_DATE_FORMAT);

            let previousMonthCurrentDate = currentDate;
            previousMonthCurrentDate.setMonth(currentDate.getMonth() - 1);

            let previousMonthDate = previousDate;
            previousMonthDate.setMonth(previousDate.getMonth() - 1);


            var previousMonthStartDate = newDate(previousMonthDate, Constants.CURRENTDATE_START_DATE_FORMAT);
            var previousMonthCurrentEndDate = newDate(previousMonthDate, Constants.CURRENTDATE_END_DATE_FORMAT);

            let previousMonthConditions = {};
            if (currentDate != "") {
                commonConditions["date"] = {
                    $gte: newDate(previousStartDate),
                    $lte: newDate(currentEndDate),
                };
                previousMonthConditions["$or"] = [
                    {
                        date: {
                            $gte: newDate(currentStartDate),
                            $lte: newDate(currentEndDate)
                        }
                    },
                    {
                        date: {
                            $gte: newDate(previousMonthStartDate),
                            $lte: newDate(previousMonthCurrentEndDate)
                        }
                    }
                ];
            }

            if (restaurantIds.length > 0) exportConditions.restaurant_id = { $in: arrayToObject(restaurantIds) };
            if (areaIds.length > 0) exportConditions.area_id = { $in: arrayToObject(areaIds) };

            /** Get details **/
            const branch_wise_processed_orders = this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);
            asyncParallel({
                record: (callback) => {
                    branch_wise_processed_orders.aggregate([
                        { $match: exportConditions },
                        {
                            $group: {
                                _id             : { restaurant_id: "$restaurant_id",area_id:"$area_id",delivery_type : "$delivery_type" },
                                total_orders    : { $sum: "$total_orders" },
                                total_amount    : { $sum: "$total_amount" },
                                cravez_payout   : { $sum: "$cravez_payout" },
                                restaurant_id   : { $first: "$restaurant_id" },
                                area_id         : { $first: "$area_id" },
                                area_name       : { $first: "$area_name" },
                                delivery_type   : { $first: "$delivery_type" },
                                restaurant_name : { $last: "$restaurant_name" },
                                delivery_fees: { $sum: { $cond: [{ $eq: ["$delivery_type", Constants.DELIVERY_BY_CRAVEZ] }, "$delivery_fee", 0] } },
                            }
                        },
                        {
                            $addFields: {
                                total_revenue: { $add: ["$delivery_fees", "$cravez_payout"] },
                                avg_chq_value: { $divide: ["$total_amount", "$total_orders"] },
                            }
                        },
                        {
                            $addFields: {
                                avg_rev_per_order: { $divide: ["$total_revenue", "$total_orders"] },
                            }
                        },
                        { $sort: sortConditions },
                    ]).toArray().then(findResult => {
                        callback(null, findResult);
                    }).catch(next);
                },
                current_month: (callback) => {
                    branch_wise_processed_orders.aggregate([
                        { $match: commonConditions },
                        {
                            $group: {
                                _id: { year_month_day: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE } } },
                                total_orders: { $sum: "$total_orders" },
                                total_amount: { $sum: "$total_amount" },
                                cravez_payout: { $sum: "$cravez_payout" },
                                date: { $first: "$date" },
                                delivery_fees: { $sum: { $cond: [{ $eq: ["$delivery_type", Constants.DELIVERY_BY_CRAVEZ] }, "$delivery_fee", 0] } },
                            },
                        },
                        {
                            $addFields: {
                                total_revenue: { $add: ["$delivery_fees", "$cravez_payout"] },
                                avg_chq_value: { $divide: ["$total_amount", "$total_orders"] },
                            }
                        },
                        {
                            $addFields: {
                                avg_rev_per_order: { $divide: ["$total_revenue", "$total_orders"] },
                            }
                        },
                        { $sort: { date: 1 } }
                    ]).toArray().then(result => {
                        callback(null, result);
                    }).catch(next);
                },
                previous_month: (callback) => {
                    branch_wise_processed_orders.aggregate([
                        { $match: previousMonthConditions },
                        {
                            $group: {
                                _id: { year_month_day: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE } } },
                                total_orders: { $sum: "$total_orders" },
                                total_amount: { $sum: "$total_amount" },
                                cravez_payout: { $sum: "$cravez_payout" },
                                date: { $first: "$date" },
                                delivery_fees: { $sum: { $cond: [{ $eq: ["$delivery_type", Constants.DELIVERY_BY_CRAVEZ] }, "$delivery_fee", 0] } },
                            },
                        },
                        {
                            $addFields: {
                                total_revenue: { $add: ["$delivery_fees", "$cravez_payout"] },
                                avg_chq_value: { $divide: ["$total_amount", "$total_orders"] },
                            }
                        },
                        {
                            $addFields: {
                                avg_rev_per_order: { $divide: ["$total_revenue", "$total_orders"] },
                            }
                        },
                        { $sort: { date: 1 } }
                    ]).toArray().then(result => {
                        callback(null, result);
                    }).catch(next);
                },
            }, (err, response) => {
                let data            = (response.record) ? response.record:[];
                let currentMonth    = (response.current_month) ? response.current_month : [];
                let previousMonth   = (response.previous_month) ? response.previous_month : [];
                let temp        = [];
                let commonColls = [];

                /** Define excel heading label **/

                commonColls = [
                    res.__("admin.report.restaurant_name"),
                    res.__("admin.report.no_of_orders"),
                    res.__("admin.report.order_amount"),
                    res.__("admin.report.delivery_fees"),
                    res.__("admin.report.our_commission"),
                    res.__("admin.report.total_revenues"),
                    res.__("admin.report.avg_rev_per_order"),
                    res.__("admin.report.avg_amount_per_order"),
                    res.__("admin.report.delivery_by"),
                ];
                let totalOrders = 0;
                let totalAmount = 0;
                let totalDeliveryFee = 0;
                let totalCravezPayout = 0;
                let totalRevenue = 0;
                let totalAvgRevenue = 0;
                let totalAvgChqValue = 0;

                if (data && data.length > 0) {
                    data.map(records => {
                        totalOrders += records.total_orders;
                        totalAmount += records.total_amount;
                        totalDeliveryFee += records.delivery_fees;
                        totalCravezPayout += records.cravez_payout;
                        totalRevenue += records.total_revenue;
                        totalAvgRevenue += records.avg_rev_per_order;
                        totalAvgChqValue += records.avg_chq_value;
                        let buffer = [
                            (records.restaurant_name)   ? records.restaurant_name[Constants.DEFAULT_LANGUAGE_CODE] : "",
                            (records.total_orders)      ? round(records.total_orders) : 0,
                            (records.total_amount)      ? currencyFormat(records.total_amount) : currencyFormat(0),
                            (records.delivery_fees)     ? currencyFormat(records.delivery_fees) : currencyFormat(0),
                            (records.cravez_payout)     ? currencyFormat(records.cravez_payout) : currencyFormat(0),
                            (records.total_revenue)     ? currencyFormat(records.total_revenue) : currencyFormat(0),
                            (records.avg_rev_per_order) ? currencyFormat(records.avg_rev_per_order) : currencyFormat(0),
                            (records.avg_chq_value)     ? currencyFormat(records.avg_chq_value) : currencyFormat(0),
                            (records.delivery_type)     ? Constants.DELIVERY_BY[records.delivery_type] : "",
                        ];
                        temp.push(buffer);
                    });
                    let grandTotal = [
                        res.__("admin.report.grand_total"),
                        totalOrders,
                        currencyFormat(totalAmount),
                        currencyFormat(totalDeliveryFee),
                        currencyFormat(totalCravezPayout),
                        currencyFormat(totalRevenue),
                        currencyFormat(totalAvgRevenue),
                        currencyFormat(totalAvgChqValue),
                    ];
                    temp.push(grandTotal);
                }
                for (let i=0;i<=2;i++){
                    let array = [];
                    temp.push(array);
                }

                if (currentMonth && currentMonth.length > 1){
                    var row1 = [
                        newDate(currentMonth[0].date, Constants.DATE_FORMAT_EXPORT),
                        currentMonth[0].total_orders,
                        currencyFormat(currentMonth[0].total_amount),
                        currencyFormat(currentMonth[0].delivery_fees),
                        currencyFormat(currentMonth[0].cravez_payout),
                        currencyFormat(currentMonth[0].total_revenue),
                        currencyFormat(currentMonth[0].avg_rev_per_order),
                        currencyFormat(currentMonth[0].avg_chq_value),
                    ];

                    var row2= [
                        res.__("admin.report.change_in_value"),
                        (currentMonth[1].total_orders - currentMonth[0].total_orders),
                        currencyFormat(currentMonth[1].total_amount - currentMonth[0].total_amount),
                        currencyFormat(currentMonth[1].delivery_fees - currentMonth[0].delivery_fees),
                        currencyFormat(currentMonth[1].cravez_payout - currentMonth[0].cravez_payout),
                        currencyFormat(currentMonth[1].total_revenue - currentMonth[0].total_revenue),
                        currencyFormat(currentMonth[1].avg_rev_per_order - currentMonth[0].avg_rev_per_order),
                        currencyFormat(currentMonth[1].avg_chq_value - currentMonth[0].avg_chq_value),
                    ];

                    var row3 = [
                        res.__("admin.report.change_percent"),
                        (isNaN(round(((currentMonth[1].total_orders - currentMonth[0].total_orders) / currentMonth[0].total_orders) * 100)) ? 0 : round(((currentMonth[1].total_orders - currentMonth[0].total_orders) / currentMonth[0].total_orders) * 100)) + res.__("admin.report.percent"),
                        (isNaN(round(((currentMonth[1].total_amount - currentMonth[0].total_amount) / currentMonth[0].total_amount) * 100)) ? 0 : round(((currentMonth[1].total_amount - currentMonth[0].total_amount) / currentMonth[0].total_amount) * 100))+res.__("admin.report.percent"),
                        (isNaN(round(((currentMonth[1].delivery_fees - currentMonth[0].delivery_fees) / currentMonth[0].delivery_fees) * 100)) ? 0 : round(((currentMonth[1].delivery_fees - currentMonth[0].delivery_fees) / currentMonth[0].delivery_fees) * 100)) + res.__("admin.report.percent"),
                        (isNaN(round(((currentMonth[1].cravez_payout - currentMonth[0].cravez_payout) / currentMonth[0].cravez_payout) * 100)) ? 0 : round(((currentMonth[1].cravez_payout - currentMonth[0].cravez_payout) / currentMonth[0].cravez_payout) * 100)) + res.__("admin.report.percent"),
                        (isNaN(round(((currentMonth[1].total_revenue - currentMonth[0].total_revenue) / currentMonth[0].total_revenue) * 100)) ? 0 : round(((currentMonth[1].total_revenue - currentMonth[0].total_revenue) / currentMonth[0].total_revenue) * 100)) + res.__("admin.report.percent"),
                        (isNaN(round(((currentMonth[1].avg_rev_per_order - currentMonth[0].avg_rev_per_order) / currentMonth[0].avg_rev_per_order) * 100)) ? 0 : round(((currentMonth[1].avg_rev_per_order - currentMonth[0].avg_rev_per_order) / currentMonth[0].avg_rev_per_order) * 100)) + res.__("admin.report.percent"),
                        (isNaN(round(((currentMonth[1].avg_chq_value - currentMonth[0].avg_chq_value) / currentMonth[0].avg_chq_value) * 100)) ? 0 : round(((currentMonth[1].avg_chq_value - currentMonth[0].avg_chq_value) / currentMonth[0].avg_chq_value) * 100)) + res.__("admin.report.percent"),
                    ];
                    temp.push(row1);
                    temp.push(row2);
                    temp.push(row3);
                }

                for (let i=0;i<=2;i++){
                    let array = [];
                    temp.push(array);
                }

                if (previousMonth && previousMonth.length > 1){
                    var row1 = [
                        newDate(previousMonth[0].date, Constants.DATE_FORMAT_EXPORT),
                        previousMonth[0].total_orders,
                        currencyFormat(previousMonth[0].total_amount),
                        currencyFormat(previousMonth[0].delivery_fees),
                        currencyFormat(previousMonth[0].cravez_payout),
                        currencyFormat(previousMonth[0].total_revenue),
                        currencyFormat(previousMonth[0].avg_rev_per_order),
                        currencyFormat(previousMonth[0].avg_chq_value),
                    ];

                    var row2= [
                        res.__("admin.report.change_in_value"),
                        (previousMonth[1].total_orders - previousMonth[0].total_orders),
                        currencyFormat(previousMonth[1].total_amount - previousMonth[0].total_amount),
                        currencyFormat(previousMonth[1].delivery_fees - previousMonth[0].delivery_fees),
                        currencyFormat(previousMonth[1].cravez_payout - previousMonth[0].cravez_payout),
                        currencyFormat(previousMonth[1].total_revenue - previousMonth[0].total_revenue),
                        currencyFormat(previousMonth[1].avg_rev_per_order - previousMonth[0].avg_rev_per_order),
                        currencyFormat(previousMonth[1].avg_chq_value - previousMonth[0].avg_chq_value),
                    ];

                    var row3 = [
                        res.__("admin.report.change_percent"),
                        (isNaN(round(((previousMonth[1].total_orders - previousMonth[0].total_orders) / previousMonth[0].total_orders) * 100)) ? 0 : round(((previousMonth[1].total_orders - previousMonth[0].total_orders) / previousMonth[0].total_orders) * 100)) + res.__("admin.report.percent"),
                        (isNaN(round(((previousMonth[1].total_amount - previousMonth[0].total_amount) / previousMonth[0].total_amount) * 100)) ? 0 : round(((previousMonth[1].total_amount - previousMonth[0].total_amount) / previousMonth[0].total_amount) * 100)) + res.__("admin.report.percent"),
                        (isNaN(round(((previousMonth[1].delivery_fees - previousMonth[0].delivery_fees) / previousMonth[0].delivery_fees) * 100)) ? 0 : round(((previousMonth[1].delivery_fees - previousMonth[0].delivery_fees) / previousMonth[0].delivery_fees) * 100)) + res.__("admin.report.percent"),
                        (isNaN(round(((previousMonth[1].cravez_payout - previousMonth[0].cravez_payout) / previousMonth[0].cravez_payout) * 100)) ? 0 : round(((previousMonth[1].cravez_payout - previousMonth[0].cravez_payout) / previousMonth[0].cravez_payout) * 100)) + res.__("admin.report.percent"),
                        (isNaN(round(((previousMonth[1].total_revenue - previousMonth[0].total_revenue) / previousMonth[0].total_revenue) * 100)) ? 0 : round(((previousMonth[1].total_revenue - previousMonth[0].total_revenue) / previousMonth[0].total_revenue) * 100)) + res.__("admin.report.percent"),
                        (isNaN(round(((previousMonth[1].avg_rev_per_order - previousMonth[0].avg_rev_per_order) / previousMonth[0].avg_rev_per_order) * 100)) ? 0 : round(((previousMonth[1].avg_rev_per_order - previousMonth[0].avg_rev_per_order) / previousMonth[0].avg_rev_per_order) * 100)) + res.__("admin.report.percent"),
                        (isNaN(round(((previousMonth[1].avg_chq_value - previousMonth[0].avg_chq_value) / previousMonth[0].avg_chq_value) * 100)) ? 0 : round(((previousMonth[1].avg_chq_value - previousMonth[0].avg_chq_value) / previousMonth[0].avg_chq_value) * 100)) + res.__("admin.report.percent"),
                    ];
                    temp.push(row1);
                    temp.push(row2);
                    temp.push(row3);
                }
                /**  Function to export data in excel format **/
                exportToExcel(req, res, {
                    file_prefix     : "RestaurantsOrderSummary",
                    heading_columns : commonColls,
                    export_data     : temp,
                    column_formats : {
                        C : {type : "number",format : Constants.EXCEL_CURRENCY_FORMAT},
                        D : {type : "number",format : Constants.EXCEL_CURRENCY_FORMAT},
                        E : {type : "number",format : Constants.EXCEL_CURRENCY_FORMAT},
                        F : {type : "number",format : Constants.EXCEL_CURRENCY_FORMAT},
                        G : {type : "number",format : Constants.EXCEL_CURRENCY_FORMAT},
                        H : {type : "number",format : Constants.EXCEL_CURRENCY_FORMAT},
                    },
                });
            });
        }catch(error){
            return next(error);
        }
    };// end exportRestaurantsOrder()

    /**
    * Function to get summary for previous date
    *
    * @param req 	As Request Data
    * @param res 	As Response Data
    *
    * @return render/json
    */
    async getPreviousDateData(req, res, next) {
        try{
            if (isPost(req)) {
                let currentDate        = (req.body.date) ? newDate(req.body.date) : "";
                let previousDate       = (req.body.date) ? newDate(req.body.date):"";
                const collection= this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);

                let commonConditions = {};
                /** Condition for date */
                previousDate.setDate(previousDate.getDate() - 1);

                let previousStartDate = newDate(previousDate, Constants.CURRENTDATE_START_DATE_FORMAT);
                let currentEndDate = newDate(currentDate, Constants.CURRENTDATE_END_DATE_FORMAT);
                let currentStartDate = newDate(currentDate, Constants.CURRENTDATE_START_DATE_FORMAT);

                let previousMonthCurrentDate = currentDate;
                previousMonthCurrentDate.setMonth(currentDate.getMonth() - 1);

                let previousMonthDate = previousDate;
                previousMonthDate.setMonth(previousDate.getMonth() - 1);


                var previousMonthStartDate = newDate(previousMonthDate, Constants.CURRENTDATE_START_DATE_FORMAT);
                var previousMonthCurrentEndDate = newDate(previousMonthDate, Constants.CURRENTDATE_END_DATE_FORMAT);


                let previousMonthConditions = {};
                if (currentDate != "") {
                    commonConditions["date"]={
                        $gte: newDate(previousStartDate),
                        $lte: newDate(currentEndDate),
                    };
                    previousMonthConditions["$or"]	= [
                        {
                            date : {
                                $gte: newDate(currentStartDate),
                                $lte: newDate(currentEndDate)
                            }
                        },
                        {
                            date : {
                                $gte: newDate(previousMonthStartDate),
                                $lte: newDate(previousMonthCurrentEndDate)
                            }
                        }
                    ];
                }

                asyncParallel({
                    current_month: (callback) => {
                        collection.aggregate([
                            { $match: commonConditions },
                            {
                                $group: {
                                    _id             : { year_month_day: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE } } },
                                    total_orders    : { $sum: "$total_orders" },
                                    total_amount    : { $sum: "$total_amount" },
                                    cravez_payout   : { $sum: "$cravez_payout" },
                                    date            : { $first: "$date" },
                                    delivery_fees: { $sum: { $cond: [{ $eq: ["$delivery_type", Constants.DELIVERY_BY_CRAVEZ] }, "$delivery_fee", 0]}},
                                },
                            },
                            {
                                $addFields: {
                                    total_revenue: { $add: ["$delivery_fees", "$cravez_payout"] },
                                    avg_chq_value: { $divide: ["$total_amount", "$total_orders"] },
                                }
                            },
                            {
                                $addFields: {
                                    avg_rev_per_order: { $divide: ["$total_revenue", "$total_orders"] },
                                }
                            },
                            { $sort:{date:1}}
                        ]).toArray().then(result => {
                            callback(null, result);
                        }).catch(next);
                    },
                    previous_month: (callback) => {
                        collection.aggregate([
                            { $match: previousMonthConditions },
                            {
                                $group: {
                                    _id: { year_month_day: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE } } },
                                    total_orders: { $sum: "$total_orders" },
                                    total_amount: { $sum: "$total_amount" },
                                    cravez_payout: { $sum: "$cravez_payout" },
                                    date: { $first: "$date" },
                                    delivery_fees: { $sum: { $cond: [{ $eq: ["$delivery_type", Constants.DELIVERY_BY_CRAVEZ] }, "$delivery_fee", 0] } },
                                },
                            },
                            {
                                $addFields: {
                                    total_revenue: { $add: ["$delivery_fees", "$cravez_payout"] },
                                    avg_chq_value: { $divide: ["$total_amount", "$total_orders"] },
                                }
                            },
                            {
                                $addFields: {
                                    avg_rev_per_order: { $divide: ["$total_revenue", "$total_orders"] },
                                }
                            },
                            { $sort: { date: 1 } }
                        ]).toArray().then(result => {
                            callback(null, result);
                        }).catch(next);
                    },
                }, (err, response) => {
                    /** Send response **/
                    res.send({
                        status      : (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
                        data        : (response.current_month) ? response.current_month:[],
                        prev_data   : (response.previous_month) ? response.previous_month : [],
                    });
                });
            }
        }catch(error){
            return next(error);
        }
    };//End getPreviousDateData()
}
