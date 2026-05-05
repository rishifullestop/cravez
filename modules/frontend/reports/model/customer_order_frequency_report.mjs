import { ObjectId } from 'mongodb';
import BREADCRUMBS from "../../../../breadcrumbs.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { newDate, arrayToObject,isPost, getDropdownList, exportToExcel} from "../../../../utils/index.mjs";

export default class CustomerOrderFrequency {
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
    async getCustomerOrderFrequencyReport (req, res, next){
        try {
            let restaurantId = new ObjectId(req.session.user.restaurant_id);
            if (isPost(req)) {
                let years       = (req.body.years) ? req.body.years : [];
                let branchIds   = (req.body.branch_ids) ? req.body.branch_ids : [];
                let branchArray = (branchIds.constructor === Array) ? branchIds : [branchIds];
                let yearsArray  = (years.constructor === Array) ? years : [years];                
                
                let commonConditions = { restaurant_id: restaurantId, admin_status: Constants.ORDER_DELIVERED };
                if (branchArray.length > 0) commonConditions.branch_id = { $in: arrayToObject(branchArray) };
                
                yearsArray = yearsArray.map(year => parseInt(year));
                let yearConditions = { year: { $in: yearsArray } };
                
                const orders = this.db.collection(Tables.ORDERS);
                let result = await orders.aggregate([
                    { $match: commonConditions },
                    {
                        $group: {
                            _id         : "$customer_id",
                            order_count : { $sum: 1 },
                            order_date  : { $last: "$order_date" },
                        }
                    },
                    {
                        $group: {
                            _id             : "$order_count",
                            year            : { $last: { "$year": "$order_date" } },
                            customer_count  : { $sum: 1 },
                            order_count     : {$first:"$order_count"},
                        }
                    },
                    { $match: yearConditions },
                ]).toArray();
                
                let currentYear     = newDate().getFullYear();
                let yearWiseData    = {};
                let total = 0;
                result.map(record => {
                    if (!yearWiseData[record.year]) yearWiseData[record.year] = {};
                    if (record.order_count > 4){
                        total+=record.customer_count;
                        yearWiseData[record.year]['>4'] = total;
                    } else{
                        yearWiseData[record.year][record.order_count] = record.customer_count;
                    }
                });
            
                let finalArray  = [];
                let dataYears   = Object.keys(yearWiseData);
            
                for(let i=1;i<=5;i++){                    
                    let tmpRow = (i < 5)? [i.toString()] : [">4"];
                    dataYears.map(tmpYear => {
                        let count = 0;
                        if(i>4){
                            count = (yearWiseData[tmpYear] && yearWiseData[tmpYear]['>4']) ? yearWiseData[tmpYear]['>4'] : 0;
                        }else{
                            count = (yearWiseData[tmpYear] && yearWiseData[tmpYear][i]) ? yearWiseData[tmpYear][i] : 0;
                        }
                        if (tmpYear == currentYear && i > 5 && count == 0) {
                            count = null;
                        }
                        tmpRow.push(count)
                    });
                    finalArray.push(tmpRow);
                }
            
                res.send({ status: Constants.STATUS_SUCCESS, result: finalArray, years: dataYears });
            } else {
                /**Get dropdown list **/
                let response = await getDropdownList(req, res, next, {
                    collections: [
                        {
                            collection  : Tables.RESTAURANT_BRANCHES,
                            columns     : ["_id", ["name", Constants.DEFAULT_LANGUAGE_CODE]],
                            conditions  : {
                                restaurant_id   : restaurantId,
                                is_active       : Constants.ACTIVE,
                            },
                        }
                    ]
                });

                /** render top selling items report listing page **/
                req.breadcrumbs(BREADCRUMBS['reports/customer_order_frequency_report']);
                res.render('customer_order_frequency_report', {
                    branch_list: response?.final_html_data?.[0] || "",
                });
            }
        } catch (error) {
            next(error);
        }
    };//End getCustomerOrderFrequencyReport()

    /**
     *  Function for export Customer Order Frequency report
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As 	Callback argument to the middleware function
     *
     * @return null
    */
    async exportCustomerOrderFrequencyReport (req, res, next){
        try {
            let restaurantId    = new ObjectId(req.session.user.restaurant_id);
            let branchIds       = (req.query.branch_ids) ? (req.query.branch_ids).split(",") : [];
            let years           = (req.query.years) ? (req.query.years).split(",") : [];

            let branchArray = (branchIds.constructor === Array) ? branchIds : [branchIds];
            let yearsArray  = (years.constructor === Array) ? years : [years];            
            
            /** Set order condition */
            let commonConditions = { restaurant_id: restaurantId, admin_status: Constants.ORDER_DELIVERED };
            if (branchArray.length > 0) commonConditions.branch_id = { $in: arrayToObject(branchArray) };
            
            yearsArray = yearsArray.map(year => parseInt(year));
            let yearConditions = { year: { $in: yearsArray } };

            const orders = this.db.collection(Tables.ORDERS);
            let result = await orders.aggregate([
                { $match: commonConditions },
                {
                    $group: {
                        _id         : "$customer_id",
                        order_count : { $sum: 1 },
                        order_date  : { $last: "$order_date" },
                    }
                },
                {
                    $group: {
                        _id             : "$order_count",
                        year            : { $last: { "$year": "$order_date" } },
                        customer_count  : { $sum: 1 },
                        order_count     : { $first: "$order_count" },
                    }
                },
                { $match: yearConditions },
            ]).toArray();

            let currentYear = newDate().getFullYear();
            let yearWiseData = {};
            let total = 0;

            result.map(record => {
                if (!yearWiseData[record.year]) yearWiseData[record.year] = {};
                if (record.order_count > 4) {
                    total += record.customer_count;
                    yearWiseData[record.year]['>4'] = total;
                } else {
                    yearWiseData[record.year][record.order_count] = record.customer_count;
                }
            });
            let finalArray = [];
            let dataYears = Object.keys(yearWiseData);

            for (let i = 1; i <= 5; i++) {
                let tmpRow = (i < 5) ? [i.toString()] : [">4"];
                dataYears.map(tmpYear => {
                    let count = 0;
                    if (i > 4 && !yearWiseData[tmpYear][i]) {
                        count = (yearWiseData[tmpYear] && yearWiseData[tmpYear]['>4']) ? yearWiseData[tmpYear]['>4'] : 0;
                    } else {
                        count = (yearWiseData[tmpYear] && yearWiseData[tmpYear][i]) ? yearWiseData[tmpYear][i] : 0;
                    }
                    if (tmpYear == currentYear && i > 5 && count == 0) {
                        count = null;
                    }
                    tmpRow.push(count)
                });
                finalArray.push(tmpRow);
            }
            let commonColls = [res.__("reports.frequency")];
            dataYears.map(rec => {
                commonColls.push(res.__("reports.customers")+' '+ rec);
            });
            /**  Function to export data in excel format **/
            exportToExcel(req, res, {
                file_prefix     : "CustomerOrderFrequencyReport",
                heading_columns : commonColls,
                export_data     : finalArray
            });
        } catch (error) {
            next(error);
        }
    };// end exportCustomerOrderFrequencyReport()
}
