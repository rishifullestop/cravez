import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { isPost, configDatatable, newDate } from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

class PaymentTransaction {
    constructor(db) {
        this.db = db;
        this.paymentTransactionsCollection = db.collection(Tables.PAYMENT_TRANSACTIONS);
    }

    /**
     * Function to get payment transaction list
     *
     * @param req As Request Data
     * @param res As Response Data
     * @param next As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getPaymentTransactionList(req, res, next) {
        try {
            let paymentStatus = (req.query.payment_status) ? req.query.payment_status : "";
            let paymentMethod = (req.query.payment_method) ? req.query.payment_method : "";

            if (isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                let fromDate = (req.body.fromDate) ? req.body.fromDate : "";
                let toDate = (req.body.toDate) ? req.body.toDate : "";
                let paymentStatus = (req.body.payment_status) ? req.body.payment_status : "";
                let paymentMethod = (req.body.payment_method) ? req.body.payment_method : "";

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);

                /** Conditions for payment method */
                if (paymentMethod) {
                    dataTableConfig.conditions.payment_method = paymentMethod;
                }

                /** Conditions for payment status */
                if (paymentStatus) {
                    dataTableConfig.conditions.payment_status = paymentStatus;
                }

                /** Conditions for payment date */
                if (fromDate != "" && toDate != "") {
                    dataTableConfig.conditions["created"] = {
                        $gte: newDate(fromDate),
                        $lte: newDate(toDate),
                    };
                }

                let dbRes = await this.paymentTransactionsCollection.aggregate([
                    { $match: dataTableConfig.conditions },
                    {
                        $facet : {
                            list : [
                                {$sort: dataTableConfig.sort_conditions },
                                {$skip: skip },
                                {$limit: limit },
                                {
                                    $lookup: {
                                        from: Tables.PAYMENT_METHODS,
                                        localField: "payment_method",
                                        foreignField: "slug",
                                        as: "payment_method_details"
                                    }
                                },
                                {
                                    $lookup: {
                                        from: Tables.USERS,
                                        localField: "user_id",
                                        foreignField: "_id",
                                        as: "user_details"
                                    }
                                },
                                {
                                    $project: {
                                        _id: 1, amount: 1, currency: 1, payment_method: 1, payment_status: 1, payment_response: 1, created: 1, invoice_number: 1, transaction_id: 1, payment_method_name: { $arrayElemAt: ["$payment_method_details.title", 0] }, client_name: { $arrayElemAt: ["$user_details.full_name", 0] }, client_mobile: { $arrayElemAt: ["$user_details.mobile_number", 0] }
                                    }
                                }
                            ],
                            count: [
                                {$count: "count"},
                            ],
                        }
                    }
                ]).toArray();

                /** Send response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data			:   dbRes?.[0]?.list ||[],
                    recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
                }); 
            } else {
                /** render listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/payment_transaction/list']);
                res.render('list', {
                    payment_status: paymentStatus,
                    payment_method: paymentMethod
                });
            }
        } catch (error) {
            next(error);
        }
    } //End getPaymentTransactionList()

    /**
     * Function for get common payment transaction list
     *
     * @param req As Request Data
     * @param res As Response Data
     * @param next As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getCommonPaymentTransactionList(req, res, next) {
        try {
            let userId = (req.params.user_id) ? req.params.user_id : '';
            let orderId = (req.params.order_id) ? req.params.order_id : '';

            if (isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                let fromDate = (req.body.fromDate) ? req.body.fromDate : "";
                let toDate = (req.body.toDate) ? req.body.toDate : "";

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);

                /** Set Common conditions **/
                let commonConditions = {};
                if (userId) commonConditions = { user_id: new ObjectId(userId) };
                if (orderId) commonConditions = { order_ids: { $in: [new ObjectId(orderId)] } };

                /** Conditions for payment date */
                if (fromDate != "" && toDate != "") {
                    dataTableConfig.conditions["created"] = {
                        $gte: newDate(fromDate),
                        $lte: newDate(toDate),
                    };
                }

                dataTableConfig.conditions = Object.assign(commonConditions, dataTableConfig.conditions);

                let dbRes = await this.paymentTransactionsCollection.aggregate([
                    { $match: dataTableConfig.conditions },
                    {
                        $facet : {
                            list : [
                                {$sort: dataTableConfig.sort_conditions },
                                {$skip: skip },
                                {$limit: limit },
                                {
                                    $lookup: {
                                        from: Tables.PAYMENT_METHODS,
                                        localField: "payment_method",
                                        foreignField: "slug",
                                        as: "payment_method_details"
                                    }
                                },
                                {
                                    $lookup: {
                                        from: Tables.USERS,
                                        localField: "user_id",
                                        foreignField: "_id",
                                        as: "user_details"
                                    }
                                },
                                {
                                    $project: {
                                        _id: 1, amount: 1, currency: 1, payment_method: 1, payment_status: 1, payment_response: 1, created: 1, invoice_number: 1, transaction_id: 1, payment_method_name: { $arrayElemAt: ["$payment_method_details.title", 0] }, client_name: { $arrayElemAt: ["$user_details.full_name", 0] }, client_mobile: { $arrayElemAt: ["$user_details.mobile_number", 0] }
                                    }
                                }
                            ],
                            count: [
                                {$count: "count"},
                            ],
                        }
                    }
                ]).toArray();

                /** Send response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data			:   dbRes?.[0]?.list ||[],
                    recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
                });                 
            } else {
                /** render listing page **/
                res.render('common_payment_transaction_list', {
                    layout     : false,
                    user_id: userId,
                    order_id: orderId
                });
            }
        } catch (error) {
            next(error);
        }
    } //End getCommonPaymentTransactionList()
}

export default PaymentTransaction; 