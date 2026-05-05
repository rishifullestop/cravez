import { ObjectId } from 'mongodb';
import  clone  from 'clone';
import { each as asyncEach } from 'async';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { isPost, getUtcDate, configDatatable, newDate, sanitizeData, generateOfferCode, updateWalletBalance, currencyFormat } from "../../../../utils/index.mjs";
import {saveSystemLogs, sendMailToUsers} from "../../../../services/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

export default class AddInWallet {
    constructor(db) {
        this.db = db;
        this.addInWalletLogsCollection = db.collection(Tables.ADD_IN_WALLET_LOGS);
        this.userInWalletLogsCollection = db.collection(Tables.USER_IN_WALLET_LOGS);
        this.usersCollection = db.collection(Tables.USERS);
        this.ordersCollection = db.collection(Tables.ORDERS);
    }

    /**
     * Function to get add in wallet logs list
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     *
     * @return render/json
     */
    async getWalletList(req, res) {
        try {
            if (isPost(req)) {
                const limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                const skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                const fromDate = (req.body.from_date) ? req.body.from_date : "";
                const toDate = (req.body.to_date) ? req.body.to_date : "";

                /** Configure Datatable conditions */
                const dataTableConfig = await configDatatable(req, res, null);

                /** Condition for date */
                if (fromDate != "" && toDate != "") {
                    dataTableConfig.conditions["$or"] = [
                        {
                            $and: [
                                { valid_from: { $gte: newDate(fromDate) } },
                                { valid_to: { $lte: newDate(toDate) } }
                            ]
                        },
                        {
                            $and: [
                                { valid_to: { $gte: newDate(fromDate) } },
                                { valid_from: { $lte: newDate(toDate) } }
                            ]
                        }
                    ];
                }

                let dbRes = await this.addInWalletLogsCollection.aggregate([
                    {$match: dataTableConfig.conditions },
                    {$facet: {
                        list: [
                            { $sort: dataTableConfig.sort_conditions },
                            { $skip: skip },
                            { $limit: limit },
                            {
                                $project: {
                                    _id: 1,
                                    offer_name: 1,
                                    client_criteria: 1,
                                    account_criteria: 1,
                                    account_criteria_amount: 1,
                                    order_criteria: 1,
                                    order_criteria_amount: 1,
                                    number_of_orders: 1,
                                    valid_from: 1,
                                    valid_to: 1,
                                    amount: 1
                                }
                            }
                        ],
                        count: [
                            { $count: "count" }
                        ]
                    }}
                ]).toArray();

                /** Send response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data: dbRes?.[0]?.list || [],
                    recordsTotal: dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0
                });
            } else {
                /** render add in wallet listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/add_in_wallet/list']);
                res.render('list');
            }
        } catch (error) {
            res.status(500).send({
                status: Constants.STATUS_ERROR,
                message: error.message
            });
        }
    }

    /**
     * Function for add or update wallet logs
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async addWallet(req, res, next) {
        try {
            if (isPost(req)) {
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let orderCriteriaType = req.body.order_criteria_type;
                let addInWalletId     = new ObjectId();
                let offerCode         = req.body.offer_code;               
               
                let amountPerPoint			= (res.locals.settings['Points_system.amount_per_points']) ? res.locals.settings['Points_system.amount_per_points'] : "";
                let fromDate				= newDate(req.body.start_date,Constants.DATABASE_DATE_FORMAT);
                let toDate  				= newDate(req.body.end_date,Constants.DATABASE_DATE_FORMAT);
                fromDate  					= newDate(fromDate+" "+Constants.START_DATE_TIME_FORMAT);
                toDate  					= newDate(toDate+" "+Constants.END_DATE_TIME_FORMAT);
                let accountCriteria  		= req.body.account_criteria;
                let accountCriteriaAmount   = parseFloat(req.body.account_criteria_amount);
                let clientCriteria 			= parseInt(req.body.client_criteria);
                let numberOfOrders 			= (req.body.number_of_orders) ? parseInt(req.body.number_of_orders)  :0;
                let amount 					= (req.body.amount) ? amountPerPoint*parseFloat(req.body.amount) : 0;
                let orderCriteria 			= (req.body.order_criteria) ? req.body.order_criteria 	:"";
                let orderCriteriaAmount 	= (req.body.order_criteria_amount) ? parseFloat(req.body.order_criteria_amount) : 0;
                    
                /** Set data in a object **/
                let updateData = {
                    _id : addInWalletId,
                    offer_name : {
                        ar : req.body.offer_name_in_arabic,
                        en : req.body.offer_name_in_english
                    },
                    client_criteria  		: clientCriteria,
                    account_criteria 		: accountCriteria,
                    account_criteria_amount : accountCriteriaAmount,
                    order_criteria_type 	: orderCriteriaType,
                    order_criteria 			: orderCriteria,
                    order_criteria_amount 	: orderCriteriaAmount,
                    number_of_orders 		: numberOfOrders,
                    valid_from				: fromDate,
                    valid_to				: toDate,
                    amount 					: amount,
                    created_by 				: new ObjectId(req.session.user._id),
                    created    				: getUtcDate(),
                    offer_code 				: offerCode,
                };

                    /** Save add in wallet logs details **/
                const result = await this.addInWalletLogsCollection.insertOne(updateData);

                let walletId = result.insertedId;

                /** Set customer common conditions  **/
                let conditions 		= clone(Constants.CUSTOMER_COMMON_CONDITIONS);
                conditions.active 	= clientCriteria;
                conditions.is_guest = {$exists : false};

                /** Set conditions according to the account criteria **/
                if(accountCriteria == Constants.ACCOUNT_CRITERIA_AMOUNT_LESS_THAN){
                    conditions.total_amount = {$lt : accountCriteriaAmount};
                }else if(accountCriteria == Constants.ACCOUNT_CRITERIA_AMOUNT_GREATER_THAN){
                    conditions.total_amount = {$gt : accountCriteriaAmount};
                }else if(accountCriteria == Constants.ACCOUNT_CRITERIA_AMOUNT_LESS_THAN_EQUAL_TO){
                    conditions.total_amount = {$lte : accountCriteriaAmount};
                }else if(accountCriteria == Constants.ACCOUNT_CRITERIA_AMOUNT_GREATER_THAN_EQUAL_TO){
                    conditions.total_amount = {$gte : accountCriteriaAmount};
                }

                /** Set aggregate pipline**/
                let aggregatePipLine = [
                    {$match   : conditions},
                    {$project : {_id:1,email:1,full_name:1,user_role_id:1,total_amount:1,is_email_verified:1}},
                ];

                /** Insert lookup in aggregate pipline**/
                if(orderCriteriaType == Constants.ORDER_CRITERIA_TYPE_NO_OF_ORDERS){
                    aggregatePipLine.push(
                        {$lookup : {
                            from 		 : Tables.ORDERS,
                            localField 	 : "_id",
                            foreignField : "customer_id",
                            as 			 : "order_details"
                        }},
                        {$project : {
                            _id:1,email:1,full_name:1,user_role_id:1,total_amount:1, is_email_verified:1,
                            no_of_orders: {$size:"$order_details"}
                        }},
                        {$match : { no_of_orders : {$gte : numberOfOrders}}},
                    );
                }

                /** Find user list **/
                const userResult = await this.usersCollection.aggregate(aggregatePipLine).toArray();                    

                if(userResult && userResult.length >0){
                    /** Push User Data in a array */
                    let dataArray = [];
                    userResult.map(records=>{
                        dataArray.push({
                            user_id 	: new ObjectId(records._id),
                            amount 		: amount,
                            wallet_id 	: walletId,
                            added_by	: new ObjectId(req.session.user._id),
                            created		: getUtcDate(),
                        });
                    });

                    /** Save tmp wallet logs details **/
                    await this.userInWalletLogsCollection.insertMany(dataArray,{forceServerObjectId: true});
                        
                    // asyncEach(userResult,(records, eachCallback) => {
                        
                    //     /** Call update wallet balance*/
                    //     updateWalletBalance(req,res,next,{
                    //         transaction_type : Constants.CREDIT,
                    //         wallet_type      : Constants.POINTS_AMOUNT,
                    //         amount           : amount,
                    //         user_id          : new ObjectId(records._id),
                    //         expiry_date		 : toDate,
                    //         extra_parameters : {
                    //             from_date 		 	  : fromDate,
                    //             order_criteria 		  : orderCriteria,
                    //             order_criteria_amount : orderCriteriaAmount,
                    //             add_in_wallet_id 	  : walletId
                    //         }
                    //     }).then(response=>{
                    //         if(response.status == Constants.STATUS_ERROR) return eachCallback(response.message);
                    //         eachCallback(null);
                    //     }).catch(next);
                    // },(asyncErr) => {
                    //     if(asyncErr){
                    //         console.error(asyncErr);
                    //         console.error("async each error in add in wallet");
                    //     }else{
                    //         /*************** Send Mail  ***************/
                    //         sendMailToUsers(req,res,{
                    //             event_type 		: Constants.ADD_IN_WALLET_EMAIL_EVENTS,
                    //             wallet_id		: walletId,
                    //             amount			: currencyFormat(amount),
                    //             user_list		: userResult
                    //         });
                    //         /*************** Send Mail  ***************/
                    //     }
                    // });
                }

                /** Send success response **/
                req.flash(Constants.STATUS_SUCCESS,res.__("admin.add_in_wallet.wallet_has_been_added_successfully"));
                res.send({
                    status		: Constants.STATUS_SUCCESS,
                    message		: res.__("admin.add_in_wallet.wallet_has_been_added_successfully")
                });

                /** save System logs */
                saveSystemLogs(req, res, {
                    user_id				: req.session.user._id,
                    parent_id			: walletId,
                    activity_module		: Constants.SYSTEM_LOG_MODULE_ADD_IN_WALLET,
                    activity_type		: Constants.ACTIVITY_TYPE_ADD_EDIT,
                    additional_details	: {}
                }).then(()=>{ });
            } else {
                /** Get unique offer code **/
                const offerResponse = await generateOfferCode(req, res, next, {});
                res.render('add_edit', {
                    layout: false,
                    offer_code: offerResponse?.offer_code || ""
                });
            }
        } catch (error) {
            next(error);
        }
    }
} 