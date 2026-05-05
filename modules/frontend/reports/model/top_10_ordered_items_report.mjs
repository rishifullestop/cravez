import { ObjectId } from 'mongodb';
import BREADCRUMBS from "../../../../breadcrumbs.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { newDate, arrayToObject,isPost, getDropdownList, exportToExcel} from "../../../../utils/index.mjs";

export default class TopTenOrderedItemsReport {
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
    async getTopTenOrderedItemsReport (req, res, next) {
        try {
            let restaurantId = new ObjectId(req.session.user.restaurant_id);
            if (isPost(req)) {
                let years       = (req.body.years) ? req.body.years : [];
                let branchIds   = (req.body.branch_ids) ? req.body.branch_ids : [];
                let branchArray = (branchIds.constructor === Array) ? branchIds : [branchIds];
                let yearsArray  = (years.constructor === Array) ? years : [years];
                yearsArray = yearsArray.map(year => parseInt(year));
                const orders = this.db.collection(Tables.ORDERS);
                const collection = this.db.collection(Tables.ORDER_ITEMS);

                let orderConditions = {
                    restaurant_id   : restaurantId,
                    admin_status    : Constants.ORDER_DELIVERED
                };

                let yearConditions = { year: { $in: yearsArray } };

                if (branchArray.length > 0) orderConditions.branch_id = { $in: arrayToObject(branchArray) };

                let orderResult = await orders.aggregate([
                    { $match: orderConditions },
                    { $project: { year: { "$year": "$order_date" }, _id: 1, admin_status: 1 } },
                    { $match: yearConditions },
                ]).toArray();

                let orderIds = orderResult.map(record => new ObjectId(record._id));    
                
                let result = await collection.aggregate([
                    { $match: { 
                        order_id: { $in: orderIds }
                    }},
                    {$lookup:	{ /** Get item details **/
                        "from" 			: 	Tables.ITEMS,
                        "localField" 	:	"item_id",
                        "foreignField" 	: 	"_id",
                        "as" 			: 	"item_detail"
                    }},
                    {$lookup: { /** Get order details **/
                        "from"          : Tables.ORDERS,
                        "localField"    : "order_id",
                        "foreignField"  : "_id",
                        "as"            : "order_detail"
                    }},
                    {$group: {
                        _id             : "$item_id",
                        year            : {$last: { "$year": { $arrayElemAt: ["$order_detail.order_date", 0] } } },
                        item_name       : {$first: { $arrayElemAt: ["$item_detail.name." + Constants.DEFAULT_LANGUAGE_CODE, 0] } },
                        qty             : {$sum: "$qty" },
                    }},
                    {$sort: { qty: Constants.SORT_DESC}},
                    {$limit : 10}
                ]).toArray();
                    
                let currentYear     = newDate().getFullYear();
                let yearWiseData    = {};
                
                result.map(record => {
                    if (!yearWiseData[record.year]) yearWiseData[record.year] = {};
                    yearWiseData[record.year][record.item_name] = record.qty;
                });
                
                let finalArray  = [];
                let dataYears   = Object.keys(yearWiseData);
                result.map(record => {
                    let tmpRow = [record.item_name];
                    dataYears.map(tmpYear => {
                        let count = (yearWiseData[tmpYear] && yearWiseData[tmpYear][record.item_name]) ? yearWiseData[tmpYear][record.item_name] : 0;
                        if (tmpYear == currentYear && count == 0) {
                            count = null;
                        }
                        tmpRow.push(count)
                    });
                    finalArray.push(tmpRow);
                });
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
                req.breadcrumbs(BREADCRUMBS['reports/top_ten_ordered_items_report']);
                res.render('top_10_ordered_items_report', {
                    branch_list: response?.final_html_data?.["0"] || "",
                });
            }
        } catch (error) {
            return next(error);
        }
    };//End getTopTenOrderedItemsReport()

    /**
     *  Function for export Top Ten Ordered Items report
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As 	Callback argument to the middleware function
     *
     * @return null
    */
    async exportTopTenOrderedItemsReport (req, res, next) {
        try {
            let restaurantId    = new ObjectId(req.session.user.restaurant_id);
            let branchIds       = (req.query.branch_ids) ? (req.query.branch_ids).split(",") : [];
            let years           = (req.query.years) ? (req.query.years).split(",") : [];

            let branchArray = (branchIds.constructor === Array) ? branchIds : [branchIds];
            let yearsArray  = (years.constructor === Array) ? years : [years];
            yearsArray = yearsArray.map(year => parseInt(year));

            /** Set order condition */
            let orderConditions = {
                restaurant_id   : restaurantId,
                admin_status    : Constants.ORDER_DELIVERED
            };
            let yearConditions = { year: { $in: yearsArray } };

            if (branchArray.length > 0) orderConditions.branch_id = { $in: arrayToObject(branchArray) };

            const orders = this.db.collection(Tables.ORDERS);
            let orderResult = await orders.aggregate([
                { $match: orderConditions },
                { $project: { year: { "$year": "$order_date" }, _id: 1, admin_status: 1 } },
                { $match: yearConditions },
            ]).toArray();

            let orderIds = orderResult.map(record => new ObjectId(record._id)); 
            
            const orderItems = this.db.collection(Tables.ORDER_ITEMS);           
            let result = await orderItems.aggregate([
                {$match: {
                    order_id: { $in: orderIds }
                }},
                {$lookup:	{ /** Get item details **/
                    "from" 			: 	Tables.ITEMS,
                    "localField" 	:	"item_id",
                    "foreignField" 	: 	"_id",
                    "as" 			: 	"item_detail"
                }},
                {$lookup: { /** Get order details **/
                    "from"          : Tables.ORDERS,
                    "localField"    : "order_id",
                    "foreignField"  : "_id",
                    "as"            : "order_detail"
                }},
                {$group: {
                    _id       : "$item_id",
                    year      : {$last:  {"$year": {$arrayElemAt: ["$order_detail.order_date", 0] } } },
                    item_name : {$first: {$arrayElemAt: ["$item_detail.name." + Constants.DEFAULT_LANGUAGE_CODE, 0] } },
                    qty       : {$sum: "$qty" },
                }},
                {$sort: { qty: Constants.SORT_DESC}},
                {$limit : 10}
            ]).toArray();

            let currentYear = newDate().getFullYear();
            let yearWiseData = {};
    
            result.map(record => {
                if (!yearWiseData[record.year]) yearWiseData[record.year] = {};
                yearWiseData[record.year][record.item_name] = record.qty;
            });

            let finalArray = [];
            let dataYears = Object.keys(yearWiseData);
            result.map(record => {
                let tmpRow = [record.item_name];
                dataYears.map(tmpYear => {
                    let count = (yearWiseData[tmpYear] && yearWiseData[tmpYear][record.item_name]) ? yearWiseData[tmpYear][record.item_name] : 0;
                    if (tmpYear == currentYear && count == 0) {
                        count = null;
                    }
                    tmpRow.push(count)
                });
                finalArray.push(tmpRow);
            });

            let commonColls = [res.__("reports.Items")];
            dataYears.map(rec => {
                commonColls.push(rec);
            });

            /**  Function to export data in excel format **/
            exportToExcel(req, res, {
                file_prefix     : "TopTenOrderedItemsReport",
                heading_columns : commonColls,
                export_data     : finalArray
            });      
        } catch (error) {
            return next(error);
        }
    };// end exportTopTenOrderedItemsReport()
}
