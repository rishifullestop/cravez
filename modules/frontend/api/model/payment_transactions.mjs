import { ObjectId } from 'mongodb';
import axios from 'axios';
import { parallel as asyncParallel } from 'async';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from '../../../../utils/index.mjs';

export default class PaymentTransactions {
    constructor(db) {
        this.db = db;
    }

    /**
	 * Function to get payment transaction list
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	getPaymentTransactionList(req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 	= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId	= (req.body.user_id) ? new ObjectId(req.body.user_id) :"";

			/** Send error response **/
			if(!userId) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});

			/** Get payment transaction list **/
            const payment_transactions	= this.db.collection(Tables.PAYMENT_TRANSACTIONS);
            payment_transactions.find({ user_id : userId},{projection: {user_id:1,amount:1,currency:1,payment_method:1,payment_status:1,payment_event:1,invoice_number:1,transaction_id:1,order_ids:1,created:1,modified:1}}).toArray().then(paymentResult=>{

				/** Insert order ids in a array  **/
				let orderIds =  [];
				paymentResult.map(records=>{
					records.order_ids.map(orderId=>{
						orderIds.push(orderId);
					});
				});

				if(orderIds.length > 0) orderIds  = Helpers.arrayToObject(orderIds);

                asyncParallel({
					orders : (callback)=>{
                        if(orderIds.length <= 0) return callback(null,null);

                        /** Get order unique id **/
                        const orders = this.db.collection(Tables.ORDERS);
                        orders.find({ _id : {$in : orderIds}},{projection: {_id:1,unique_order_id:1}}).toArray().then(orderResult=>{
                            callback(null,orderResult);
                        }).catch(next);
                    }
                },(err,response)=>{
					if(err) return next(err);

					let orderList = response.orders ? response.orders : [];

					/** Insert unique order id in payment transaction list **/
                    paymentResult.map(paymentRecords=>{
                        orderList.map(orderRecords=>{
                            if(paymentRecords.order_ids && paymentRecords.order_ids.length > 0){
                                paymentRecords.order_ids.map(orderId=>{
                                    if(orderId.toString() == orderRecords._id.toString()){
                                        paymentRecords.unique_order_id = orderRecords.unique_order_id;
                                    }
                                });
                            }
                        })
                    });

                    /**Send success response */
					resolve({status: Constants.STATUS_SUCCESS, payment_transaction_list : paymentResult});
                });
            }).catch(next);
		}).catch(next);
	};// end getPaymentTransactionList()

	/**
	 * Function to get payment execution
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async executePayment (req,res,next){
		try {
			/** Sanitize Data **/
			req.body 				= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId				= (req.body.user_id) 			? new ObjectId(req.body.user_id) :"";
			let fullName			= (req.body.full_name) 			? req.body.full_name :"";
			let mobileNumber		= (req.body.mobile_number) 		? req.body.mobile_number :"";
			let email				= (req.body.email) 				? req.body.email :"";
			let phoneCountryCode	= (req.body.phone_country_code) ? req.body.phone_country_code :"";
			let grandTotal			= (req.body.total_amount) 		? req.body.total_amount : 0;
			let paymentType			= (req.body.payment_type) 		? req.body.payment_type : 1;
			let callBackUrl			= (req.body.call_back_url) 		? req.body.call_back_url : '';
			let errorUrl			= (req.body.error_url) 			? req.body.error_url : '';
			let baseURL				= res.locals.settings["Payment.myfatoorah_base_url"];
			let token				= res.locals.settings["Payment.myfatoorah_token"];

			if( !grandTotal || !paymentType || !callBackUrl || !errorUrl){
				return {status:Constants.STATUS_ERROR, message:res.__("system.invalid_access"), missing_obj : ["full_name",'total_amount','payment_type','call_back_url','error_url']};
			}

			const body = {
				PaymentMethodId: paymentType,
				NotificationOption: "ALL",
				InvoiceValue: grandTotal,
				DisplayCurrencyIso: "KWD",
				CallBackUrl: callBackUrl,
				ErrorUrl: errorUrl,
				Language: "en",
				CustomerReference: "ref 1",
				CustomerCivilId: 12345678,
				UserDefinedField: "Custom field",
				ExpireDate: "",
			};

			if (email) body.CustomerEmail = email;
			if (fullName) body.CustomerName = fullName;
			if (mobileNumber) body.CustomerMobile = mobileNumber;
			if (phoneCountryCode) body.MobileCountryCode = phoneCountryCode;

			const response = await axios.post(
				baseURL + '/v2/ExecutePayment',
				body,
				{
					headers: {
						Accept: 'application/json',
						Authorization: token,
						'Content-Type': 'application/json'
					}
				}
			);

			const responseData = response?.data || {};
			if (!responseData.IsSuccess) {
				return responseData.message;
			}

			return{
				status: Constants.STATUS_SUCCESS,
				invoice_response: responseData.Data
			};
		}catch(err){
			next(err);
		}
	};// end executePayment()

	/**
	 * Function to get payment execution
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async cardPayment (req,res,next){
		try {
			/** Sanitize Data **/
			req.body 		=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let paymentId	= 	(req.body.payment_id) 		? req.body.payment_id :"";
			let baseURL		= 	res.locals.settings["Payment.myfatoorah_base_url"];
			let token		= 	res.locals.settings["Payment.myfatoorah_token"];

			const response = await axios.post(
				baseURL + '/v2/GetPaymentStatus',
				{
					key: paymentId,
					KeyType: "PaymentId"
				},
				{
					headers: {
						Accept: 'application/json',
						Authorization: token,
						'Content-Type': 'application/json'
					}
				}
			);

			const data = response.data;
			if (!data.IsSuccess) {
				return {
					status: Constants.STATUS_ERROR,
					invoice_response: data
				};
			}

			return {
				status: Constants.STATUS_SUCCESS,
				invoice_response: data.Data
			};
		}catch(err){
			next(err);
		}
	};// End cardPayment
}// End PaymentTransactions