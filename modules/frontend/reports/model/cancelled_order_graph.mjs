import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { newDate, arrayToObject,isPost, exportToExcel} from "../../../../utils/index.mjs";

export default class CancelledOrderGraph {
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
    async getCancelledOrderGraphReport (req, res, next) {
        try {
            let restaurantId = new ObjectId(req.session.user.restaurant_id);
            if (isPost(req)) {
                let years       = (req.body.years) ? req.body.years : [];
                let branchIds   = (req.body.branch_ids) ? req.body.branch_ids : [];
                let branchArray = (branchIds.constructor === Array) ? branchIds : [branchIds];
                let yearsArray  = (years.constructor === Array) ? years : [years];
                yearsArray      = yearsArray.map(year => parseInt(year));
                
                let commonConditions = {restaurant_id   : restaurantId, order_status: Constants.ORDER_CANCELLED};
                if (branchArray.length > 0) commonConditions.branch_id = { $in: arrayToObject(branchArray) };

                let yearConditions = { year: { $in: yearsArray } };

                const orders = this.db.collection(Tables.ORDERS);
                let result = await orders.aggregate([
                    { $match: commonConditions },
                    {$group: {
                        _id: {
                            year_month: { $dateToString: { format: "%Y-%m", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE } }
                        },
                        year        : { $last: { "$year": "$order_date" } },
                        month       : { $last: { "$month": "$order_date" } },
                        count       : { $sum: 1 },
                    }},
                    {$match: yearConditions },
                ]).toArray();

                let currentYear     = newDate().getFullYear();
                let currentMonth    = newDate().getMonth() + 1;
                let yearWiseData    = {};
                result.map(record => {
                    if (!yearWiseData[record.year]) yearWiseData[record.year] = {};
                    yearWiseData[record.year][record.month] = record.count;
                });

                let finalArray = [];
                let dataYears = Object.keys(yearWiseData);
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
                
                res.send({ status: Constants.STATUS_SUCCESS, result: finalArray, years: dataYears });
            } 
        } catch (error) {
            next(error);
        }
    };//End getCancelledOrderGraphReport()

    /**
     *  Function for export lost revenue graph report
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As 	Callback argument to the middleware function
     *
     * @return null
    */
    async exportCancelledOrderGraphReport (req, res, next) {
        try {
            let restaurantId    = new ObjectId(req.session.user.restaurant_id);
            let branchIds       = (req.query.branch_ids) ? (req.query.branch_ids).split(",") : [];
            let years           = (req.query.years) ? (req.query.years).split(",") : [];
            let branchArray = (branchIds.constructor === Array) ? branchIds : [branchIds];
            let yearsArray  = (years.constructor === Array) ? years : [years];
            yearsArray      = yearsArray.map(year => parseInt(year));

            /** Set order condition */
            let commonConditions = {
                restaurant_id   : restaurantId,
                order_status    : Constants.ORDER_CANCELLED
            };
            let yearConditions = { year: { $in: yearsArray } };

            if (branchArray.length > 0) commonConditions.branch_id = { $in: arrayToObject(branchArray) };

            const collection = this.db.collection(Tables.ORDERS);
            let result = await collection.aggregate([
                { $match: commonConditions },
                {
                    $group: {
                        _id: {
                            year_month: { $dateToString: { format: "%Y-%m", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE } }
                        },
                        year        : { $last: { "$year": "$order_date" } },
                        month       : { $last: { "$month": "$order_date" } },
                        count       : { $sum: 1 },
                    }
                },
                { $match: yearConditions },
            ]).toArray();

            let currentYear = newDate().getFullYear();
            let currentMonth = newDate().getMonth() + 1;

            let yearWiseData = {};
            result.map(record => {
                if (!yearWiseData[record.year]) yearWiseData[record.year] = {};
                yearWiseData[record.year][record.month] = record.count;
            });

            let finalArray = [];
            let dataYears = Object.keys(yearWiseData);
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

            let commonColls = [res.__("reports.month")];
            dataYears.map(rec => {
                commonColls.push(rec);
            });
            /**  Function to export data in excel format **/
            exportToExcel(req, res, {
                file_prefix     : "CancelledOrderGraphReport",
                heading_columns : commonColls,
                export_data     : finalArray
            });
        } catch (error) {
            next(error);
        }
    };// end exportCancelledOrderGraphReport()
}
