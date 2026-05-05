import { ObjectId } from 'mongodb';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,exportToExcel, newDate } from '../../../../utils/index.mjs';

// Model for average basket size change report
export default class AverageBasketSizeChangeReport {

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
    async avgBasketSizeChangeReport(req, res, next) {
        if (isPost(req)) {
            let years       = (req.body.years) ? req.body.years : [];
            let yearsArray  = (years.constructor === Array) ? years : [years];
            yearsArray      = yearsArray.map(year => {
                return parseInt(year);
            });
            let months      = (req.body.months) ? req.body.months : [];
            let monthsArray = (months.constructor === Array) ? months : [months];
            monthsArray     = monthsArray.map(month => {
                return parseInt(month);
            });

            let restaurantId = (req.body.restaurant_id) ? new ObjectId(req.body.restaurant_id) : "";
            const avg_basket_size_reports = this.db.collection(Tables.AVG_BASKET_SIZE_REPORTS);
            /** Set order condition */
            let commonConditions = {};
            let yearMonthConditions = { year: { $in: yearsArray } };
            if (restaurantId) commonConditions.restaurant_id = restaurantId;
            if (monthsArray.length > 0) yearMonthConditions['month'] = { $in: monthsArray };

            let groupCondition = {
                _id: {
                    year_month: { $dateToString: { format: "%Y-%m", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE } }
                },

            };
            if (monthsArray.length > 0) groupCondition["_id"] = {
                year_month_day: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE } }
            }
            groupCondition["year"] = { $first: { "$year": "$date" } };
            groupCondition["month"] = { $first: { "$month": "$date" } };
            groupCondition["avg_size"] = { $avg: "$avg_size" };
            if (monthsArray.length > 0) {
                groupCondition["day"] = { $first: { "$dayOfMonth": "$date" } };
            }
            avg_basket_size_reports.aggregate([
                {
                    $match: commonConditions
                },
                {
                    $group: groupCondition
                },
                {
                    $match: yearMonthConditions
                }
            ]).toArray().then(result => {

                let currentYear     = newDate().getFullYear();
                let currentMonth    = newDate().getMonth() + 1;
                let currentDay      = newDate().getDate();
                let yearWiseData    = {};
                let monthWiseData   = {};
                result.map(record => {
                    if (!yearWiseData[record.year]) yearWiseData[record.year] = {};
                    yearWiseData[record.year][record.month] = record.avg_size;
                });

                if (monthsArray.length > 0) {
                    result.map(record => {
                        if (!monthWiseData[record.month]) monthWiseData[record.month] = {};
                        monthWiseData[record.month][record.day] = record.avg_size;
                    });
                }
                let finalArray  = [];
                let dataYears   = Object.keys(yearWiseData);
                let dataMonths  = Object.keys(monthWiseData);

                if (monthsArray.length == 0) {
                    Object.keys(Constants.REPORT_CHART_MONTH_NAMES).map(month => {
                        let tmpRow = [Constants.REPORT_CHART_MONTH_NAMES[month]];
                        dataYears.map(tmpYear => {
                            let count = (yearWiseData[tmpYear] && yearWiseData[tmpYear][month]) ? yearWiseData[tmpYear][month] : 0;
                            if (currentMonth == 1 && month == 2 && tmpYear == currentYear && count == 0) {
                                count = 0;
                            }
                            else if (tmpYear == currentYear && month > currentMonth && count == 0) {
                                count = null;
                            }
                            tmpRow.push(count);
                        });
                        finalArray.push(tmpRow);
                    });
                }
                let daysArray =[];
                if (monthsArray.length > 0) {
                    yearsArray.map(year=>{
                        monthsArray.map(mon => {
                            let days = new Date(year, mon, 0).getDate();
                            daysArray.push(days);
                        });
                    });
                    let size = Math.max(...daysArray);
                    for (let i = 1; i <= size; i++) {
                        let tmpRow = [i.toString()];
                        dataMonths.map((tmpMonth) => {
                            let count = (monthWiseData[tmpMonth] && monthWiseData[tmpMonth][i]) ? monthWiseData[tmpMonth][i] : 0;
                            if (tmpMonth == currentMonth && i > currentDay && count == 0) {
                                count = null;
                            }
                            tmpRow.push(count);
                        })
                        finalArray.push(tmpRow);
                    }
                }

                var month =[];
                dataMonths.map(tmpMonth => {
                    month.push(Constants.REPORT_CHART_MONTH_NAMES[tmpMonth]);
                });
                dataYears = (dataYears.constructor === Array) ? dataYears : [dataYears];

                res.send({ status: Constants.STATUS_SUCCESS, result: finalArray, years: dataYears, months: month});
            }).catch(next);
        } else {

            /**Get dropdown list **/
            getDropdownList(req, res, next, {
                collections: [
                    {
                        collection  : Tables.RESTAURANTS,
                        columns     : ["_id", ["name", Constants.DEFAULT_LANGUAGE_CODE]],
                        conditions  : {
                            is_deleted  : Constants.NOT_DELETED
                        },
                    }
                ]
            }).then(response => {
                /** render listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/report/average_basket_size_change_report']);
                res.render('average_basket_size_change_report', {
                    monthNames: Constants.REPORT_CHART_MONTH_NAMES,
                    restaurant_list: response?.final_html_data?.[0] || "",
                });
            }).catch(next);
        }
    }//End avgBasketSizeChangeReport()

    /**
     *  Function for export avgBasketSizeChangeExport
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As 	Callback argument to the middleware function
     *
     * @return null
    */
    async avgBasketSizeChangeExport(req, res, next) {
        try {
            let years       = (req.query.years) ? (req.query.years).split(",") : [];
            let restaurantId = (req.query.restaurant_id) ? new ObjectId(req.query.restaurant_id) : "";
            let yearsArray  = (years.constructor === Array) ? years : [years];
            yearsArray      = yearsArray.map(year => {
                return parseInt(year);
            });

            let months      = (req.query.months) ? req.query.months.split(",") : [];
            let monthsArray = (months.constructor === Array) ? months : [months];
            monthsArray     = monthsArray.map(month => {
                return parseInt(month);
            });
            const avg_basket_size_reports = this.db.collection(Tables.AVG_BASKET_SIZE_REPORTS);

            /** Set order condition */
            let commonConditions     = { };
            let yearMonthConditions = { year: { $in: yearsArray } };
            if (restaurantId) commonConditions.restaurant_id = restaurantId;
            if (monthsArray.length > 0) yearMonthConditions['month'] = { $in: monthsArray };

            let groupCondition = {
                _id: {
                    year_month: { $dateToString: { format: "%Y-%m", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE } }
                },

            };
            if (monthsArray.length > 0) groupCondition["_id"] = {
                year_month_day: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE } }
            }
            groupCondition["year"] = { $first: { "$year": "$date" } };
            groupCondition["month"] = { $first: { "$month": "$date" } };
            groupCondition["avg_size"] = { $avg: "$avg_size" };
            if (monthsArray.length > 0) {
                groupCondition["day"] = { $first: { "$dayOfMonth": "$date" } };
            }
            avg_basket_size_reports.aggregate([
                {
                    $match: commonConditions
                },
                {
                    $group: groupCondition
                },
                {
                    $match: yearMonthConditions
                }
            ]).toArray().then(result => {
                var currentYear     = newDate().getFullYear();
                var currentMonth    = newDate().getMonth() + 1;
                var currentDay      = newDate().getDate();
                let yearWiseData    = {};
                let monthWiseData   = {};
                result.map(record => {
                    if (!yearWiseData[record.year]) yearWiseData[record.year] = {};
                    yearWiseData[record.year][record.month] = record.avg_size;
                });

                if (monthsArray.length > 0) {
                    result.map(record => {
                        if (!monthWiseData[record.month]) monthWiseData[record.month] = {};
                        monthWiseData[record.month][record.day] = record.avg_size;
                    });
                }
                let finalArray  = [];
                let dataYears   = Object.keys(yearWiseData);
                let dataMonths  = Object.keys(monthWiseData);

                if (monthsArray.length == 0) {
                    Object.keys(Constants.REPORT_CHART_MONTH_NAMES).map(month => {
                        let tmpRow = [Constants.REPORT_CHART_MONTH_NAMES[month]];
                        dataYears.map(tmpYear => {
                            let count = (yearWiseData[tmpYear] && yearWiseData[tmpYear][month]) ? yearWiseData[tmpYear][month] : 0;
                            if (tmpYear == currentYear && month > currentMonth && count == 0) {
                                count = null;
                            }
                            tmpRow.push(count);
                        });
                        finalArray.push(tmpRow);
                    });
                }
                let daysArray =[];
                if (monthsArray.length > 0) {
                    yearsArray.map(year=>{
                        monthsArray.map(mon => {
                            let days = new Date(year, mon, 0).getDate();
                            daysArray.push(days);
                        });
                    });
                    let size = Math.max(...daysArray);
                    for (let i = 1; i <= size; i++) {
                        let tmpRow = [i.toString()];
                        dataMonths.map((tmpMonth) => {
                            let count = (monthWiseData[tmpMonth] && monthWiseData[tmpMonth][i]) ? monthWiseData[tmpMonth][i] : 0;
                            if (tmpMonth == currentMonth && i > currentDay && count == 0) {
                                count = null;
                            }
                            tmpRow.push(count);
                        })
                        finalArray.push(tmpRow);
                    }
                }
                var month = [];
                dataMonths.map(tmpMonth => {
                    month.push(Constants.REPORT_CHART_MONTH_NAMES[tmpMonth]);
                });

                let commonColls = [res.__("admin.report.month")];
                if (monthsArray.length > 0){
                    commonColls = [res.__("admin.report.day")];
                    month.map(rec => {
                        commonColls.push(rec);
                    });
                } else if (monthsArray.length == 0){
                    dataYears.map(rec => {
                        commonColls.push(rec);
                    });
                }
                /**  Function to export data in excel format **/
                exportToExcel(req, res, {
                    file_prefix     : "avgBasketSizeChangeExport",
                    heading_columns : commonColls,
                    export_data     : finalArray
                });
            }).catch(next);
        } catch (error) {
            next(error);
        }
    }// end avgBasketSizeChangeExport()
}