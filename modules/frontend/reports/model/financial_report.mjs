import { ObjectId } from 'mongodb';
import { parallel as asyncParallel } from 'async';
import BREADCRUMBS from "../../../../breadcrumbs.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { newDate, isPost, configDatatable, exportToExcel, currencyFormat} from "../../../../utils/index.mjs";

export default class FinancialReport {
    constructor(db) {
        this.db = db;
    }

	/**
	 * Function to get Financial Report list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
    async getFinancialReportList (req,res,next){
        try {
            let restaurantId = (req.session.user.restaurant_id) ? new ObjectId(req.session.user.restaurant_id) : '';
            if(isPost(req)){
                let limit 			= (req.body.length) 		? parseInt(req.body.length) : Constants.FRONT_LISTING_LIMIT;
                let skip		 	= (req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
                let fromDate     	= (req.body.from_date) 		? req.body.from_date 		: "";
                let toDate 	  	 	= (req.body.to_date)   		? req.body.to_date   		: "";

                const collection = 	this.db.collection(Tables.ORDERS);

                /** Configure Datatable conditions*/
                let dataTableConfig = await configDatatable(req,res,null);
                   
                let commonConditions = {restaurant_id: restaurantId , admin_status : Constants.ORDER_DELIVERED};

                /** Condition for date */
                if (fromDate != "" && toDate != "") {
                    dataTableConfig.conditions["created"] = {
                        $gte 	: newDate(fromDate),
                        $lte 	: newDate(toDate),
                    };
                }

                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions,commonConditions);
                asyncParallel({
                    records :(callback)=>{
                        /** Get list of all orders of guest and customer **/
                        collection.aggregate([
                            { $match: dataTableConfig.conditions},

                            {$lookup:	{
                                "from"          : 	Tables.PAYMENT_TRANSACTIONS,
                                "localField" 	:	"payment_id",
                                "foreignField" 	: 	"_id",
                                "as" 			: 	"payment_details"
                            }},
                            {
                                $lookup: {
                                    "from"          : Tables.ORDER_SETTLEMENT_PAYMENT_LOGS,
                                    "localField"    : "_id",
                                    "foreignField"  : "order_ids",
                                    "as"            : "bank_details"
                                }
                            },
                            {
                                $project : {
                                    payment_method  : 1,
                                    order_price      : 1,
                                    unique_order_id : 1,
                                    full_name       : 1,
                                    mobile_number   : 1,
                                    order_date      : 1,
                                    amount_debited_by_wallet:1,
                                    account_number  : { $arrayElemAt: ["$bank_details.bank_account_number", 0] },
                                    remarks         : { $arrayElemAt: ["$bank_details.remarks", 0] },
                                    due_amount      : { $ifNull: ["$is_settlement", "" || "$restaurant_payout"]},
                                    payment_id      : { $arrayElemAt: ["$payment_details.invoice_number",0]},
                                    payment_date    : { $arrayElemAt: ["$payment_details.created", 0] },
                                    amount          : { $arrayElemAt: ["$payment_details.amount", 0] },
                                    currency        : { $arrayElemAt: ["$payment_details.currency", 0] },
                                    payment_status  : { $arrayElemAt: ["$payment_details.payment_status", 0] },
                                    payment_response: { $arrayElemAt: ["$payment_details.payment_response", 0] },
                                }
                            },
                            {$sort : dataTableConfig.sort_conditions },
                            {$skip 	: skip},
                            {$limit : limit},
                        ]).toArray().then(result=>{
                            if (result.length > 0) {
                                result.map((records) => {
                                    let paymentResponse     = (records.payment_response && records.payment_response != undefined) ? JSON.parse(records.payment_response) : "";
                                    records.transaction_id  = (paymentResponse && paymentResponse.InvoiceTransactions && paymentResponse.InvoiceTransactions.TransactionId) ? paymentResponse.InvoiceTransactions.TransactionId : "";
                                    records.reference_id    = (paymentResponse && paymentResponse.InvoiceTransactions && paymentResponse.InvoiceTransactions.ReferenceId) ? paymentResponse.InvoiceTransactions.ReferenceId : "";
                                    records.authorization_id= (paymentResponse && paymentResponse.InvoiceTransactions && paymentResponse.InvoiceTransactions.AuthorizationId) ? paymentResponse.InvoiceTransactions.AuthorizationId : "";
                                    records.card_number     = (paymentResponse && paymentResponse.InvoiceTransactions && paymentResponse.InvoiceTransactions.CardNumber) ? paymentResponse.InvoiceTransactions.CardNumber : "";
                                    delete records.payment_response;
                                });
                            }
                            callback(null,result);
                        }).catch(err=>{
                            callback(err,null);
                        });
                    },
                    total_records:(callback)=>{
                        /** Get total number of records in collection **/
                        collection.countDocuments(commonConditions).then(countResult=>{
                            callback(null, countResult);
                        }).catch(err=>{
                            callback(err,null);
                        });
                    },
                    filter_records:(callback)=>{
                        /** Get filtered records counting **/
                        collection.countDocuments(dataTableConfig.conditions).then(countResult=>{
                            callback(null, countResult);
                        }).catch(err=>{
                            callback(err,null);
                        });
                    }
                },(err, response)=>{
                    /** Send response **/
                    res.send({
                        status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
                        draw			: dataTableConfig.result_draw,
                        data			: response.records,
                        recordsFiltered	: response.filter_records,
                        recordsTotal	: response.total_records,
                    });
                });
            }else{
                /** render listing page **/
                req.breadcrumbs(BREADCRUMBS['reports/financial_report']);
                res.render('financial_report');
            }
        } catch (error) {
            next(error);
        }
    };//End getFinancialReportList()

	/**
	 *  Function financial report export
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async getFinancialReportExport (req,res,next){
        try {
            let restaurantId    = (req.session.user.restaurant_id) ? new ObjectId(req.session.user.restaurant_id) : '';
            let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
            let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";

            let exportConditions = { restaurant_id: restaurantId, admin_status: Constants.ORDER_DELIVERED };
            
            /** Condition for date */
            if (fromDate != "" && toDate != "") {
                exportConditions["created"] = {
                    $gte 	: newDate(fromDate),
                    $lte 	: newDate(toDate),
                };
            }

            /** Get order details **/
            const orders = this.db.collection(Tables.ORDERS);
            let result = await orders.aggregate([
                {$match: exportConditions},
                {$sort : {_id : Constants.SORT_DESC}},
                {$lookup: {
                    "from"          : Tables.PAYMENT_TRANSACTIONS,
                    "localField"    : "payment_id",
                    "foreignField"  : "_id",
                    "as"            : "payment_details"
                }},
                {$lookup: {
                    "from"          : Tables.ORDER_SETTLEMENT_PAYMENT_LOGS,
                    "localField"    : "_id",
                    "foreignField"  : "order_ids",
                    "as"            : "bank_details"
                }},
                {$project: {
                    payment_method  : 1,
                    is_settlement   : 1,
                    order_price      : 1,
                    unique_order_id : 1,
                    full_name       : 1,
                    mobile_number   : 1,
                    order_date      : 1,
                    amount_debited_by_wallet: 1,
                    account_number  : { $arrayElemAt: ["$bank_details.bank_account_number", 0] },
                    remarks         : { $arrayElemAt: ["$bank_details.remarks", 0] },
                    due_amount      : { $ifNull: ["$is_settlement", "" || "$restaurant_payout"] },
                    payment_id      : { $arrayElemAt: ["$payment_details.invoice_number", 0] },
                    payment_date    : { $arrayElemAt: ["$payment_details.created", 0] },
                    amount          : { $arrayElemAt: ["$payment_details.amount", 0] },
                    currency        : { $arrayElemAt: ["$payment_details.currency", 0] },
                    payment_status  : { $arrayElemAt: ["$payment_details.payment_status", 0] },
                    payment_response: { $arrayElemAt: ["$payment_details.payment_response", 0] },
                }},
            ]).toArray();
               
            if (result.length > 0) {
                result.map((records) => {
                    let paymentResponse     = (records.payment_response && records.payment_response != undefined) ? JSON.parse(records.payment_response) : "";
                    records.transaction_id  = (paymentResponse && paymentResponse.InvoiceTransactions && paymentResponse.InvoiceTransactions.TransactionId) ? paymentResponse.InvoiceTransactions.TransactionId : "";
                    records.reference_id    = (paymentResponse && paymentResponse.InvoiceTransactions && paymentResponse.InvoiceTransactions.ReferenceId) ? paymentResponse.InvoiceTransactions.ReferenceId : "";
                    records.authorization_id= (paymentResponse && paymentResponse.InvoiceTransactions && paymentResponse.InvoiceTransactions.AuthorizationId) ? paymentResponse.InvoiceTransactions.AuthorizationId : "";
                    records.card_number     = (paymentResponse && paymentResponse.InvoiceTransactions && paymentResponse.InvoiceTransactions.CardNumber) ? paymentResponse.InvoiceTransactions.CardNumber : "";
                    delete records.payment_response;
                });
            }
            
            /** Define excel heading label **/
            let commonColls	= [
                res.__("reports.payment_id"),
                res.__("reports.unique_order_id"),
                res.__("reports.payment_method"),
                res.__("reports.amount"),
                res.__("reports.due_amount"),
                res.__("reports.payment_date"),
                res.__("reports.payment_status"),
                res.__("reports.user_name"),
                res.__("reports.mobile_number"),
                res.__("reports.account_number"),
                res.__("reports.remark"),
                res.__("reports.transaction_id"),
                res.__("reports.authorization_id"),
                res.__("reports.card_number"),
            ];
            
            let temp		= [];
            if(result && result.length > 0){
                result.map(records=>{
                    let amount = currencyFormat(0);
                    if (records.payment_method == Constants.CASH_PAYMENT && records.order_price) {
                            amount = currencyFormat(records.order_price);
                    } else {
                        if (records.amount_debited_by_wallet && records.order_price) {
                            amount = currencyFormat(records.order_price - records.amount_debited_by_wallet);
                        } else {
                            if (records.order_price) amount = currencyFormat(records.order_price);
                        }
                    }
                    let paymentDate = (records.payment_date) ? records.payment_date : records.order_date;
                    let buffer =	[
                        (records.payment_id)        ? records.payment_id 		:"",
                        (records.unique_order_id)   ? records.unique_order_id : "",
                        (records.payment_method)    ? records.payment_method : "",
                        amount,
                        (records.due_amount)        ? currencyFormat(records.due_amount) : currencyFormat(0),
                        (records.payment_date)      ? newDate(paymentDate, Constants.AM_PM_FORMAT_WITH_DATE) : "",
                        records.payment_status && Constants.PAYMENT_STATUS?.[records.payment_status]?.status_name || "",
                        (records.full_name)         ? records.full_name : "",
                        (records.mobile_number)     ? records.mobile_number : "",
                        (records.account_number)    ? records.account_number : "",
                        (records.remarks)           ? records.remarks : "",
                        (records.transaction_id)    ? records.transaction_id : "",
                        (records.authorization_id)  ? records.authorization_id : "",
                        (records.card_number)       ? records.card_number : "",
                    ];
                    temp.push(buffer);
                });
            }

            /**  Function to export data in excel format **/
            exportToExcel(req,res,{
                file_prefix 		: "FinancialReport",
                heading_columns		: commonColls,
                export_data			: temp
            });
        } catch (error) {
            next(error);
        }
    };// end getFinancialReportExport()
}
