import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, newDate, exportToExcel, configDatatable, currencyFormat } from '../../../../utils/index.mjs';

// Model for area sales share report
export default class AreaSalesShareReport {

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
    async getAreaSalesShareList(req, res, next) {
        try {
            let dates       = await this.getDate(3);
            let len         = dates.length;
            let yearMonth   = [];
            let yearArray   = [];
            let monthArray  = [];
            dates.map(record => {
                var year = record.getFullYear();
                var mon = (record.getMonth()) + 1;
                let monthStr = (mon < 10) ? "0"+mon : mon;
                yearMonth.push(year + "-" + monthStr);
                yearArray.push(year);
                monthArray.push(mon);
            });

            if (isPost(req))  {
                let limit           = (req.body.length)         ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip            = (req.body.start)          ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                let restaurantIds   = (req.body.restaurant_ids) ? req.body.restaurant_ids : [];
                const collection    = this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);

                if (restaurantIds.constructor != Array) restaurantIds = [restaurantIds];

                /** Configure Datatable conditions*/
                let dataTableConfig = await configDatatable(req, res, null);
                
                /** Condition for date */
                let commonConditions ={};
                commonConditions["date"] = {
                    $gte: newDate(dates[len - 1]),
                    $lte: newDate(dates[0]),
                };
                commonConditions["restaurant_id"] = { $in: arrayToObject(restaurantIds) };
                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

                asyncParallel({
                    records: (callback) => {
                        collection.aggregate([
                            { $match: dataTableConfig.conditions },
                            { $addFields :{
                                month : { $dateToString: { format: "%Y-%m", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE }}
                            }},
                            {
                                $group: {
                                    _id             : { restaurant_id: "$restaurant_id", area_id: "$area_id" },
                                    current_month	: {$sum : {
                                        $cond: [
                                            {$and: [
                                                { $eq: ["$month", yearMonth[0]] },
                                            ]},
                                            "$total_amount",
                                            0
                                        ]}
                                    },
                                    last_month		: 	{$sum : {
                                        $cond: [
                                            {$and: [
                                                { $eq: ["$month", yearMonth[1]] },
                                            ]},
                                            "$total_amount",
                                            0
                                        ]},
                                    },
                                    third_month		: 	{$sum : {
                                        $cond: [
                                            {$and: [
                                                { $eq: ["$month", yearMonth[2]] },
                                            ]},
                                            "$total_amount",
                                            0
                                        ]},
                                    },
                                    current_month_orders	: {$sum : {
                                        $cond: [
                                            {$and: [
                                                { $eq: ["$month", yearMonth[0]] },
                                            ]},
                                            "$total_orders",
                                            0
                                        ]}
                                    },
                                    last_month_orders	: 	{$sum : {
                                        $cond: [
                                            {$and: [
                                                { $eq: ["$month", yearMonth[1]] },
                                            ]},
                                            "$total_orders",
                                            0
                                        ]},
                                    },
                                    third_month_orders	: 	{$sum : {
                                        $cond: [
                                            {$and: [
                                                { $eq: ["$month", yearMonth[2]] },
                                            ]},
                                            "$total_orders",
                                            0
                                        ]},
                                    },
                                    area_id       	: { $first: "$area_id" },
                                    restaurant_id   : { $first: "$restaurant_id" },
                                    restaurant_name : { $last: "$restaurant_name" },
                                    area_name     	: { $first: "$area_name" },
                                }
                            },
                            { $sort : dataTableConfig.sort_conditions },
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
                                    _id: { restaurant_id: "$restaurant_id", area_id: "$area_id" },
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
                                    _id: { restaurant_id: "$restaurant_id", area_id: "$area_id"},
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
                        collection  : Tables.RESTAURANTS,
                        columns     : ["_id", ["name", Constants.DEFAULT_LANGUAGE_CODE]],
                        conditions  : {
                            is_deleted  : Constants.NOT_DELETED
                        },
                    }]
                }).then(response => {                       

                    /** render listing page **/
                    req.breadcrumbs(BREADCRUMBS['admin/report/area_sales_share_report']);
                    res.render('area_sales_share_report', {
                        restaurant_list : response?.final_html_data?.[0] || "",
                        years           : yearArray,
                        months          : monthArray
                    });
                }).catch(next);
            }
        } catch (error) {
            return next(error);
        }
    };//End getAreaSalesShareList()


    /**
     *  Function for export area sales share report
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As 	Callback argument to the middleware function
     *
     * @return null
    */
    async exportAreaSalesShare(req, res, next) {
        try {
            const monthNames    = ["", "Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec"];
            let sortingField    = (req.query.sort_field)    ? req.query.sort_field : "_id";
            let sortingDir      = (req.query.sort_dir)      ? req.query.sort_dir : "asc";
            let sortOrder       = (sortingDir == 'asc')     ? Constants.SORT_ASC : Constants.SORT_DESC;
            let restaurantIds   = (req.query.restaurant_ids)? (req.query.restaurant_ids).split(",") : [];

            if (restaurantIds.constructor != Array) restaurantIds = [restaurantIds];
            let dates       = await this.getDate(3);
            let len         = dates.length;
            let yearMonth   = [];
            let yearArray   = [];
            let monthArray  = [];
            dates.map(record => {
                var year    = record.getFullYear();
                var mon     = (record.getMonth()) + 1;
                let monthStr = (mon < 10) ? "0"+mon : mon;
                yearMonth.push(year + "-" + monthStr);
                yearArray.push(year);
                monthArray.push(mon);
            });
            let exportConditions        = {};
            let sortConditions          = {};
            sortConditions[sortingField]= sortOrder;

            /** Condition for date */
            exportConditions["date"] = {
                $gte: newDate(dates[len - 1]),
                $lte: newDate(dates[0]),
            };

            if (restaurantIds.length > 0) exportConditions.restaurant_id = { $in: arrayToObject(restaurantIds) };

            /** Get details **/
            const branch_wise_processed_orders = this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);
            branch_wise_processed_orders.aggregate([
                { $match: exportConditions },
                {
                    $addFields: {
                        month: { $dateToString: { format: "%Y-%m", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE } }
                    }
                },
                {
                    $group: {
                        _id: { restaurant_id: "$restaurant_id", area_id: "$area_id" },
                        current_month	: {$sum : {
                            $cond: [
                                {$and: [
                                    { $eq: ["$month", yearMonth[0]] },
                                ]},
                                "$total_amount",
                                0
                            ]}
                        },
                        last_month		: 	{$sum : {
                            $cond: [
                                {$and: [
                                    { $eq: ["$month", yearMonth[1]] },
                                ]},
                                "$total_amount",
                                0
                            ]},
                        },
                        third_month		: 	{$sum : {
                            $cond: [
                                {$and: [
                                    { $eq: ["$month", yearMonth[2]] },
                                ]},
                                "$total_amount",
                                0
                            ]},
                        },
                        current_month_orders	: {$sum : {
                            $cond: [
                                {$and: [
                                    { $eq: ["$month", yearMonth[0]] },
                                ]},
                                "$total_orders",
                                0
                            ]}
                        },
                        last_month_orders	: 	{$sum : {
                            $cond: [
                                {$and: [
                                    { $eq: ["$month", yearMonth[1]] },
                                ]},
                                "$total_orders",
                                0
                            ]},
                        },
                        third_month_orders	: 	{$sum : {
                            $cond: [
                                {$and: [
                                    { $eq: ["$month", yearMonth[2]] },
                                ]},
                                "$total_orders",
                                0
                            ]},
                        },
                        area_id         : { $first: "$area_id" },
                        restaurant_id   : { $first: "$restaurant_id" },
                        restaurant_name : { $last: "$restaurant_name" },
                        area_name       : { $first: "$area_name" },
                    }
                },
                { $sort: sortConditions },
            ]).toArray().then(findResult=>{

                let temp = [];
                let commonColls = [];

                /** Define excel heading label **/

                commonColls = [
                    res.__("admin.report.restaurant_name"),
                    res.__("admin.report.area_name"),
                    monthNames[monthArray[0]] + "-" + yearArray[0]+" Amount",
                    monthNames[monthArray[0]] + "-" + yearArray[0]+" Orders",
                    monthNames[monthArray[1]] + "-" + yearArray[1]+" Amount",
                    monthNames[monthArray[1]] + "-" + yearArray[1]+" Orders",
                    monthNames[monthArray[2]] + "-" + yearArray[2]+" Amount",
                    monthNames[monthArray[2]] + "-" + yearArray[2]+" Orders",
                ];

                if (findResult && findResult.length > 0) {
                    findResult.map(records => {
                        let buffer = [
                            (records.restaurant_name)       ? records.restaurant_name[Constants.DEFAULT_LANGUAGE_CODE] : "",
                            (records.area_name)             ? records.area_name[Constants.DEFAULT_LANGUAGE_CODE] : "",
                            (records.current_month)         ? currencyFormat(records.current_month) : currencyFormat(0),
                            (records.current_month_orders)  ? records.current_month_orders : 0,
                            (records.last_month)            ? currencyFormat(records.last_month) : currencyFormat(0),
                            (records.last_month_orders)     ? records.last_month_orders : 0,
                            (records.third_month)           ? currencyFormat(records.third_month) : currencyFormat(0),
                            (records.third_month_orders)    ? records.third_month_orders : 0,
                        ];
                        temp.push(buffer);
                    });
                }

                /**  Function to export data in excel format **/
                exportToExcel(req, res, {
                    file_prefix     : "AreaSalesShare",
                    heading_columns : commonColls,
                    export_data     : temp
                });
            }).catch(next);
        } catch (error) {
            return next(error);
        }
    };// end exportAreaSalesShare()

    /**
	 * Function to get previous month Date
	 *
	 * @param month As number of last months
	 *
	 * @return json
	*/
	async getDate(months){
        let now         = new Date();
        let dateArray   = [];
        let currentMonth= now.getMonth();
        let currentYear = now.getFullYear();
        for (let i = 0; i < months; i++) {
            let monthDate   = 1;
            let month       = currentMonth - i;
            if (i == 0) monthDate = now.getDate();
            dateArray.push(new Date(currentYear, month, monthDate));
        }
        return dateArray;
    }; // end getDate()
}
