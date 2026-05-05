import {parallel as asyncParallel} from 'async';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import * as Helper  from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

export default class OrdersReport {
	constructor(db) {
		this.db = db;
	}

	/**
	 * Function to get orders list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getOrdersList (req,res,next){
		if(Helper.isPost(req)){
			let limit	 	  = (req.body.length)   ? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
			let skip     	  = (req.body.start)    ? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
			let fromDate  	  = (req.body.fromDate) ? req.body.fromDate 	    :"";
			let toDate 	  	  = (req.body.toDate)   ? req.body.toDate           :"";
            let restaurantIds = (req.body.restaurant_ids) ? req.body.restaurant_ids : [];
            let deliveryType  = (req.body.delivery_type) ? req.body.delivery_type : [];
			let orderStatus   = (req.body.order_status) ? req.body.order_status : [];
            let branchIds     = (req.body.branch_ids) ? req.body.branch_ids : [];
			const collection  =	this.db.collection(Tables.ORDERS);

            restaurantIds = (restaurantIds && restaurantIds.constructor === Array) ? restaurantIds : [restaurantIds];
            branchIds = (branchIds && branchIds.constructor === Array) ? branchIds : [branchIds];

			deliveryType = (deliveryType && deliveryType.constructor === Array) ? deliveryType : [deliveryType];
			orderStatus = (orderStatus && orderStatus.constructor === Array) ? orderStatus : [orderStatus];

			/** Configure Datatable conditions*/
			const dataTableConfig = await Helper.configDatatable(req, res, null);

			/** Set common conditions */
			let commonConditions = {};

			if (fromDate != "" && toDate != "") {
				commonConditions["order_date"] = {
					$gte: Helper.newDate(fromDate),
					$lte: Helper.newDate(toDate),
				};
			}

			dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

			if(restaurantIds.length > 0) dataTableConfig.conditions.restaurant_id = {$in: Helper.arrayToObject(restaurantIds)};
			if(branchIds.length > 0) dataTableConfig.conditions.branch_id = {$in: Helper.arrayToObject(branchIds)};


			/** Conditions for order status */
			if (orderStatus.length > 0){
				dataTableConfig.conditions["order_status"] = {
					$in: orderStatus }
			}

			/** Conditions for deliveryType */
			if (deliveryType.length > 0){
				dataTableConfig.conditions['delivery_type'] = { $in: deliveryType};
			}

			asyncParallel({
				order_list :(callback)=>{
					/** Get list of order details  **/
					collection.aggregate([
						{$match : dataTableConfig.conditions},
						{$sort  : dataTableConfig.sort_conditions},
						{$skip 	: skip},
						{$limit : limit},
						{$lookup: {	/** Get restaurant branch details **/
							from 		:	Tables.RESTAURANT_BRANCHES,
							localField  :	"branch_id",
							foreignField:	"_id",
							as 		  	:	"branch_details"
						}},
						{$project : {
							_id: 1, order_date: 1, unique_order_id: 1, restaurant_id: 1, restaurant_name: 1, order_status: 1,
							delivery_type: 1, payment_method: 1, invoice_number: 1, is_guest: 1, package_delivery_fees: 1, package_id: 1,
							net_amount: 1, order_price: 1, delivery_fee: 1, branch_id: 1, amount_debited_by_wallet: 1, ticketing: 1,
							branch_name: {$arrayElemAt: ["$branch_details.name."+Constants.DEFAULT_LANGUAGE_CODE,0]},
							branch_address: { $arrayElemAt: ["$branch_details.address", 0] },
							area_id: { $arrayElemAt: ["$branch_details.area_id", 0] },
							customer_id: 1, captain_id:1
						}},
					]).toArray().then(findResult=>{
						if(!findResult?.length < 0) return callback(null,[]);

						let customerIds  = [];
						let captainIds = [];
						let orderIds = [];
						let areaIds = [];
						findResult.map(records => {
							if (records.customer_id) customerIds.push(records.customer_id);
							if (records.captain_id) captainIds.push(records.captain_id);
							if (records.area_id) areaIds.push(records.area_id);
							orderIds.push(records._id);
						});

						let userIds = [...customerIds, ...captainIds];

						asyncParallel({
							user_details: (callback) => {
								const users = this.db.collection(Tables.USERS);
								users.find({ _id: { $in: Helper.arrayToObject(userIds) } }, { projection: { _id: 1, full_name:1, first_name: 1, last_name: 1, client_type: 1, mobile_number: 1, email: 1, driver_id:1, } }).toArray().then(result=>{

									let userData = {};
									result.map(user=>{
										userData[user._id] = user;
									});
									callback(null, userData);
								}).catch(err=>{
									callback(err, null);
								});
							},
							order_details: (callback) => {
								const order_details = this.db.collection(Tables.ORDER_DETAILS);
								order_details.find({ order_id: { $in: Helper.arrayToObject(orderIds) } }, { projection: { order_id: 1, discount_price: 1, offer_code: 1, customer_address_detail: 1, delivery_duration: 1, } }).toArray().then(result=>{
									let orderData = {};
									result.map(order=>{
										orderData[order.order_id] = order;
									});
									callback(null, orderData);
								}).catch(err=>{
									callback(err, null);
								});
							},
							ticket_details: (callback) => {
								const tickets = this.db.collection(Tables.TICKETS);
								tickets.find({ main_order_id: { $in: Helper.arrayToObject(orderIds) } }, { projection: { _id: 0, main_order_id:1, ticket_id: 1 } }).toArray().then(result=>{
									let ticketData = {};
									result.map(ticket => {
										ticketData[ticket.main_order_id] = ticket.ticket_id;
									});
									callback(null, ticketData);
								}).catch(err=>{
									callback(err, null);
								});
							},
							area_details: (callback) => {
								const areas = this.db.collection(Tables.AREAS);
								areas.find({ _id: { $in: Helper.arrayToObject(areaIds) } }, { projection: { _id: 1, name: 1 } }).toArray().then(result=>{
									let areaData = {};
									result.map(area => {
										areaData[area._id] = area.name;
									});
									callback(null, areaData);
								}).catch(err=>{
									callback(err, null);
								});
							},
							transaction_details: (callback) => {
								const payment_transactions = this.db.collection(Tables.PAYMENT_TRANSACTIONS);
								payment_transactions.find({ order_ids: { $in: Helper.arrayToObject(orderIds) } }, { projection: { order_ids: 1, payment_response: 1 } }).toArray().then(result=>{
									let transactionData = {};
									result.map(transaction => {
										let paymentResponse = (transaction.payment_response && transaction.payment_response != undefined) ? JSON.parse(transaction.payment_response) : "";
										let obj = {
											track_id : (paymentResponse && paymentResponse.InvoiceTransactions[0] && paymentResponse.InvoiceTransactions[0].TrackId) ? paymentResponse.InvoiceTransactions[0].TrackId : "",
											payment_id : (paymentResponse && paymentResponse.InvoiceTransactions[0] && paymentResponse.InvoiceTransactions[0].PaymentId) ? paymentResponse.InvoiceTransactions[0].PaymentId : "",
											authorization_id : (paymentResponse && paymentResponse.InvoiceTransactions[0] && paymentResponse.InvoiceTransactions[0].AuthorizationId) ? paymentResponse.InvoiceTransactions[0].AuthorizationId : "",
											gateway_response_code : (paymentResponse && paymentResponse.InvoiceTransactions[0] && paymentResponse.InvoiceTransactions[0].TransactionStatus) ? paymentResponse.InvoiceTransactions[0].TransactionStatus : "",
										}
										delete transaction.payment_response;
										transaction.order_ids.map(rec=>{
											transactionData[rec] = obj;
										});
									});
									callback(null, transactionData);
								}).catch(err=>{
									callback(err, null);
								});
							},
							cashback_details: (callback) => {
								const user_wallet_logs = this.db.collection(Tables.USER_WALLET_LOGS);
								user_wallet_logs.find({ "extra_parameters.order_id": { $in: Helper.arrayToObject(orderIds) }, wallet_type: Constants.CASHBACK_AMOUNT }, { projection: { "extra_parameters.order_id": 1, amount: 1 } }).toArray().then(result=>{

									let cashbackData = {};
									result.map(cashback => {
										cashbackData[cashback.extra_parameters.order_id] = cashback.amount;
									});
									callback(null, cashbackData);
								}).catch(err=>{
									callback(err, null);
								});
							},
						}, (err, response) => {
							if(err) return callback(err, findResult);

							findResult.map((records) => {
								records.client_first_name = records?.customer_id && response?.user_details?.[records?.customer_id]?.first_name || "";
								records.client_last_name  = records?.customer_id && response?.user_details?.[records?.customer_id]?.last_name || "";
								records.client_type 	  = records?.customer_id && response?.user_details?.[records?.customer_id]?.client_type || "";
								records.mobile_number 	  = records?.customer_id && response?.user_details?.[records?.customer_id]?.mobile_number || "";
								records.email 			  = records?.customer_id && response?.user_details?.[records?.customer_id]?.email || "";

								records.driver_id 	 = records?.captain_id && response?.user_details?.[records?.captain_id]?.driver_id || "";
								records.captain_name = records?.captain_id && response?.user_details?.[records?.captain_id]?.full_name || "";

								records.discount_price 			= records?._id && response?.order_details?.[records?._id]?.discount_price || 0;
								records.offer_code 				= records?._id && response?.order_details?.[records?._id]?.offer_code || "";
								records.delivery_duration 		= records?._id && response?.order_details?.[records?._id]?.delivery_duration || 0;
								records.customer_address_detail = records?._id && response?.order_details?.[records?._id]?.customer_address_detail || "";

								records.ticket_no = records?._id && response?.ticket_details?.[records._id] || "";
								records.area_name = records?._id && response?.area_details?.[records.area_id] || "";

								records.cashback = records?._id && response?.cashback_details?.[records._id] || "";

								records.track_id 				=	records?._id && response?.transaction_details?.[records?._id]?.track_id || "";
								records.payment_id 				=	records?._id && response?.transaction_details?.[records?._id]?.payment_id || "";
								records.authorization_id 		=	records?._id && response?.transaction_details?.[records?._id]?.authorization_id || "";
								records.gateway_response_code 	=	records?._id && response?.transaction_details?.[records?._id]?.gateway_response_code || "";
							});
							callback(null, findResult);
						});
					}).catch(err=>{
						callback(err, null);
					});
				},
				filter_records:(callback)=>{
					/** Get filtered records counting in orders **/
					collection.countDocuments(dataTableConfig.conditions).then(filterContResult=>{
						callback(null, filterContResult);
					}).catch(err=>{
						callback(err, null);
					});
				}
			},(err, response)=>{
				/** Send response **/
				res.send({
					status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
					draw			: dataTableConfig.result_draw,
					data			: (response.order_list)     ? response.order_list 	  :[],
					recordsFiltered	: (response.filter_records) ? response.filter_records :0,
					recordsTotal	: (response.filter_records)  ? response.filter_records  :0
				});
			});
		}else{
			/**Get dropdown list **/
			Helper.getDropdownList(req,res, next,{
				collections :[{
					collection : Tables.RESTAURANTS,
					columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
					conditions : {is_deleted: Constants.NOT_DELETED}
				}]
			}).then(response=> {

				/** Send error response **/
				if(response.status != Constants.STATUS_SUCCESS){
					req.flash(Constants.STATUS_ERROR,response.message);
					return res.redirect(Constants.WEBSITE_ADMIN_URL+"dashboard");
				}

                /** render listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/report/orders_report']);
                res.render('orders_report', {
                    restaurant_list: response.final_html_data["0"],
                });
            }).catch(next);
		}
	};//End getOrdersList()

	/**
	 *  Function for export orders records
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async ordersExportData (req,res,next){
		try{
			let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
			let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";
			let restaurantIds	= (req.query.restaurant_ids)? (req.query.restaurant_ids).split(","): [];
			let branchIds		= (req.query.branch_ids) ? (req.query.branch_ids).split(",")   	: [];
			let orderStatus 	= (req.query.order_status) ? req.query.order_status.split(",") : [];
			let deliveryType 	= (req.query.delivery_type) ? req.query.delivery_type.split(",") : [];
			let sortingField  	= (req.query.sort_field) ? req.query.sort_field   	: "_id";
			let sortingDir 	 	= (req.query.sort_dir) ? req.query.sort_dir   		: "asc";
			let sortOrder		= (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;

			if (restaurantIds.constructor != Array) restaurantIds = [restaurantIds];
			if (branchIds.constructor != Array) branchIds = [branchIds];
			if (orderStatus.constructor != Array) orderStatus = [orderStatus];
			if (deliveryType.constructor != Array) deliveryType = [deliveryType];

			let sortConditions = {};
			sortConditions[sortingField] = sortOrder;
			/** Set common conditions */
			let exportConditions = {};

			/** Conditions for order date */
			if (fromDate != "" && toDate != "") {
				exportConditions["order_date"] = {
					$gte: Helper.newDate(fromDate),
					$lte: Helper.newDate(toDate),
				};
			}

			if (restaurantIds.length > 0) exportConditions.restaurant_id = { $in: Helper.arrayToObject(restaurantIds) };
			if (branchIds.length > 0) exportConditions.branch_id = { $in: Helper.arrayToObject(branchIds) };

			/** Conditions for order status */
			if (orderStatus.length > 0) {
				exportConditions["order_status"] = { $in: orderStatus}
			}

			if (deliveryType.length > 0) {
				exportConditions["delivery_type"] = { $in: deliveryType }
			}

			/** Get order details **/
			const orders = this.db.collection(Tables.ORDERS);
			let findResult = await orders.aggregate([
				{ $match: exportConditions},
				{$sort  : sortConditions},
				{$lookup: {	/** Get restaurant branch details **/
					from: "restaurant_branches",
					localField: "branch_id",
					foreignField: "_id",
					as: "branch_details"
				}},
				{$project: {
					_id: 1, order_date: 1, unique_order_id: 1, restaurant_id: 1, restaurant_name: 1, order_status: 1,
					delivery_type: 1, payment_method: 1, invoice_number: 1, is_guest: 1, package_delivery_fees: 1, package_id: 1,
					net_amount: 1, order_price: 1, delivery_fee: 1, branch_id: 1, amount_debited_by_wallet: 1, ticketing: 1,
					branch_name: { $arrayElemAt: ["$branch_details.name." + Constants.DEFAULT_LANGUAGE_CODE, 0] },
					branch_address: { $arrayElemAt: ["$branch_details.address", 0] },
					area_id: { $arrayElemAt: ["$branch_details.area_id", 0] },
					customer_id: 1, captain_id: 1
				}},
			]).toArray();

			let customerIds = [];
			let captainIds = [];
			let orderIds = [];
			let areaIds = [];
			findResult.map((records) => {
				if (records.customer_id) customerIds.push(records.customer_id);
				if (records.captain_id) captainIds.push(records.captain_id);
				if (records.area_id) areaIds.push(records.area_id);
				orderIds.push(records._id);
			});
			let userIds = [...customerIds, ...captainIds];

			asyncParallel({
				user_details: (callback) => {
					const users = this.db.collection(Tables.USERS);
					users.find({ _id: { $in: Helper.arrayToObject(userIds) } }, { projection: { _id: 1, full_name: 1, first_name: 1, last_name: 1, client_type: 1, mobile_number: 1, email: 1, driver_id: 1, } }).toArray().then(result=>{
						let userData = {};
						result.map(user => {
							userData[user._id] = user;
						});
						callback(null, userData);
					}).catch(err=>{
						callback(err, null);
					});
				},
				order_details: (callback) => {
					const order_details = this.db.collection(Tables.ORDER_DETAILS);
					order_details.find({ order_id: { $in: Helper.arrayToObject(orderIds) } }, { projection: { order_id: 1, discount_price: 1, offer_code: 1, customer_address_detail: 1, delivery_duration: 1, } }).toArray().then(result=>{
						let orderData = {};
						result.map(order => {
							orderData[order.order_id] = order;
						});
						callback(null, orderData);
					}).catch(err=>{
						callback(err, null);
					});
				},
				ticket_details: (callback) => {
					const tickets = this.db.collection(Tables.TICKETS);
					tickets.find({ main_order_id: { $in: Helper.arrayToObject(orderIds) } }, { projection: { _id: 0, main_order_id: 1, ticket_id: 1 } }).toArray().then(result=>{
						let ticketData = {};
						result.map(ticket => {
							ticketData[ticket.main_order_id] = ticket.ticket_id;
						});
						callback(null, ticketData);
					}).catch(err=>{
						callback(err, null);
					});
				},
				area_details: (callback) => {
					const areas = this.db.collection(Tables.AREAS);
					areas.find({ _id: { $in: Helper.arrayToObject(areaIds) } }, { projection: { _id: 1, name: 1 } }).toArray().then(result=>{
						let areaData = {};
						result.map(area => {
							areaData[area._id] = area.name;
						});
						callback(null, areaData);
					}).catch(err=>{
						callback(err, null);
					});
				},
				transaction_details: (callback) => {
					const payment_transactions = this.db.collection(Tables.PAYMENT_TRANSACTIONS);
					payment_transactions.find({ order_ids: { $in: Helper.arrayToObject(orderIds) } }, { projection: { order_ids: 1, payment_response: 1 } }).toArray().then(result=>{

						let transactionData = {};
						result.map(transaction => {
							let paymentResponse = (transaction.payment_response && transaction.payment_response != undefined) ? JSON.parse(transaction.payment_response) : "";
							let obj = {
								track_id: (paymentResponse && paymentResponse.InvoiceTransactions[0] && paymentResponse.InvoiceTransactions[0].TrackId) ? paymentResponse.InvoiceTransactions[0].TrackId : "",
								payment_id: (paymentResponse && paymentResponse.InvoiceTransactions[0] && paymentResponse.InvoiceTransactions[0].PaymentId) ? paymentResponse.InvoiceTransactions[0].PaymentId : "",
								authorization_id: (paymentResponse && paymentResponse.InvoiceTransactions[0] && paymentResponse.InvoiceTransactions[0].AuthorizationId) ? paymentResponse.InvoiceTransactions[0].AuthorizationId : "",
								gateway_response_code: (paymentResponse && paymentResponse.InvoiceTransactions[0] && paymentResponse.InvoiceTransactions[0].TransactionStatus) ? paymentResponse.InvoiceTransactions[0].TransactionStatus : "",
							}
							delete transaction.payment_response;
							transaction.order_ids.map(rec => {
								transactionData[rec] = obj;
							});
						});
						callback(null, transactionData);
					}).catch(err=>{
						callback(err, null);
					});
				},
				cashback_details: (callback) => {
					const user_wallet_logs = this.db.collection(Tables.USER_WALLET_LOGS);
					user_wallet_logs.find({ "extra_parameters.order_id": { $in: Helper.arrayToObject(orderIds) }, wallet_type: Constants.CASHBACK_AMOUNT }, { projection: { "extra_parameters.order_id": 1, amount: 1 } }).toArray().then(result=>{
						let cashbackData = {};
						result.map(cashback => {
							cashbackData[cashback.extra_parameters.order_id] = cashback.amount;
						});
						callback(null, cashbackData);
					}).catch(err=>{
						callback(err, null);
					});
				},
			}, (err, response) => {
				if(err) return callback(err, findResult);

				findResult.map((records) => {
					records.client_first_name = records?.customer_id && response?.user_details?.[records?.customer_id]?.first_name || "";
					records.client_last_name  = records?.customer_id && response?.user_details?.[records?.customer_id]?.last_name || "";
					records.client_type 	  = records?.customer_id && response?.user_details?.[records?.customer_id]?.client_type || "";
					records.mobile_number 	  = records?.customer_id && response?.user_details?.[records?.customer_id]?.mobile_number || "";
					records.email 			  = records?.customer_id && response?.user_details?.[records?.customer_id]?.email || "";

					records.driver_id 	 = records?.captain_id && response?.user_details?.[records?.captain_id]?.driver_id || "";
					records.captain_name = records?.captain_id && response?.user_details?.[records?.captain_id]?.full_name || "";

					records.discount_price 			= records?._id && response?.order_details?.[records?._id]?.discount_price || 0;
					records.offer_code 				= records?._id && response?.order_details?.[records?._id]?.offer_code || "";
					records.delivery_duration 		= records?._id && response?.order_details?.[records?._id]?.delivery_duration || 0;
					records.customer_address_detail = records?._id && response?.order_details?.[records?._id]?.customer_address_detail || "";

					records.ticket_no = records?._id && response?.ticket_details?.[records._id] || "";
					records.area_name = records?._id && response?.area_details?.[records.area_id] || "";

					records.cashback = records?._id && response?.cashback_details?.[records._id] || "";

					records.track_id 				=	records?._id && response?.transaction_details?.[records?._id]?.track_id || "";
					records.payment_id 				=	records?._id && response?.transaction_details?.[records?._id]?.payment_id || "";
					records.authorization_id 		=	records?._id && response?.transaction_details?.[records?._id]?.authorization_id || "";
					records.gateway_response_code 	=	records?._id && response?.transaction_details?.[records?._id]?.gateway_response_code || "";
				});

				/** Define excel heading label **/
				let commonColls = [
					res.__("admin.report.order_date"),
					res.__("admin.report.order_id"),
					res.__("admin.report.restaurant_name"),
					res.__("admin.report.branch_name"),
					res.__("admin.report.branch_address"),
					res.__("admin.report.branch_area_name"),
					res.__("admin.report.delivery_address"),
					res.__("admin.report.order_time"),
					res.__("admin.report.mobile_number"),
					res.__("admin.report.email"),
					res.__("admin.report.first_name"),
					res.__("admin.report.last_name"),
					res.__("admin.report.client_type"),
					res.__("admin.report.order_status"),
					res.__("admin.report.payment_method"),
					res.__("admin.report.gross_order_amount"),
					res.__("admin.report.delivery_fees"),
					res.__("admin.report.wallet_share"),
					res.__("admin.report.discount_by_offer"),
					res.__("admin.report.discount_by_infinity"),
					res.__("admin.report.net_order_amount"),
					res.__("admin.report.cashback"),
					res.__("admin.report.offer_code"),
					res.__("admin.report.delivery_duration"),
					res.__("admin.report.delivery_by"),
					res.__("admin.report.invoice_no"),
					res.__("admin.report.addr_client_city"),
					res.__("admin.report.customer_area"),
					res.__("admin.report.business_class"),
					res.__("admin.report.ticket_no"),
					res.__("admin.report.auth_code"),
					res.__("admin.report.knet_payment_id"),
					res.__("admin.report.knet_track_id"),
					res.__("admin.report.gateway_res_code"),
					res.__("admin.report.captain_id"),
					res.__("admin.report.captain_name"),
				];

				let temp = [];
				if (findResult?.length > 0) {
					findResult.map(records => {

						let grossAmount = (typeof records.net_amount !== typeof undefined) ? Helper.round(records.net_amount) : 0;
						let deliveryFees = (typeof records.delivery_fee !== typeof undefined) ? Helper.round(records.delivery_fee) : 0;
						let walletShare = (records.payment_method == Constants.PAYMENT_METHODS[Constants.WALLET_PAYMENT]) ? Helper.round(records.order_price) : ((records.amount_debited_by_wallet) ? Helper.round(records.amount_debited_by_wallet) : Helper.round(0));
						let infinityDiscount = (typeof records.package_delivery_fees !== typeof undefined) ? Helper.round(records.package_delivery_fees) : 0;
						let offerDiscountValue = (typeof records.discount_price !== typeof undefined) ? Helper.round(records.discount_price) : 0;
						let netOrderAmount = ((grossAmount + deliveryFees) - (walletShare + infinityDiscount + offerDiscountValue));

						let buffer = [
							(records.order_date) ? Helper.newDate(records.order_date, Constants.DATABASE_DATE_FORMAT) : "",
							(records.unique_order_id) ? records.unique_order_id : "",
							(records.restaurant_name) ? records.restaurant_name.en : "",
							(records.branch_name) ? records.branch_name : "",
							(records.branch_address) ? records.branch_address : "",
							(records.area_name && records.area_name.en) ? records.area_name.en : "",
							(records.customer_address_detail) ? 'Address Type:' + records.customer_address_detail.address_type + ', Street:' + records.customer_address_detail.street + ', Venue:' + records.customer_address_detail.venue + ', Block:' + (records.customer_address_detail.block_name ? records.customer_address_detail.block_name.en :"") + ', Area:' + (records.customer_address_detail.area_name ? records.customer_address_detail.area_name.en :"") + ', City:' + (records.customer_address_detail.city_name ? records.customer_address_detail.city_name.en :"") + ', Additional Direction:' + records.customer_address_detail.additional_directions : "",
							(records.order_date) ? Helper.newDate(records.order_date, Constants.DATABASE_DATE_TIME_FORMAT) : "",
							(records.mobile_number) ? records.mobile_number : "",
							(records.email) ? records.email : "",
							(records.client_first_name) ? records.client_first_name : "",
							(records.client_last_name) ? records.client_last_name : "",
							(records.is_guest) ? Constants.CLIENT_TYPE[Constants.CLIENT_TYPE_GUEST] : Constants.CLIENT_TYPE[Constants.CLIENT_TYPE_REGISTERED],
							(records.order_status) ? Constants.RESTAURANT_ORDER_STATUS_TYPES[records.order_status] : "",
							(records.payment_method) ? Constants.PAYMENT_METHODS[records.payment_method] : "",
							(records.net_amount) ? Helper.round(records.net_amount, Constants.CURRENCY_ROUND_PRECISION) : 0,
							(records.delivery_fee) ? Helper.round(records.delivery_fee, Constants.CURRENCY_ROUND_PRECISION) : 0,
							(records.payment_method == Constants.WALLET_PAYMENT) ? Helper.round(records.order_price, Constants.CURRENCY_ROUND_PRECISION) : ((records.amount_debited_by_wallet) ? Helper.round(records.amount_debited_by_wallet, Constants.CURRENCY_ROUND_PRECISION) : 0),
							(records.discount_price) ? Helper.round(records.discount_price, Constants.CURRENCY_ROUND_PRECISION) : 0,
							(records.package_delivery_fees) ? Helper.round(records.package_delivery_fees, Constants.CURRENCY_ROUND_PRECISION) : 0,
							Helper.round(netOrderAmount,Constants.CURRENCY_ROUND_PRECISION),
							(records.cashback) ? Helper.round(records.cashback, Constants.CURRENCY_ROUND_PRECISION) : 0,
							(records.offer_code) ? records.offer_code : "",
							(records.delivery_duration) ? records.delivery_duration : "",
							(records.delivery_type) ? Constants.DELIVERY_BY[records.delivery_type] : "",
							(records.invoice_number) ? records.invoice_number : "",
							(records.customer_address_detail && records.customer_address_detail.city_name && records.customer_address_detail.city_name.en) ? records.customer_address_detail.city_name.en : "",
							(records.customer_address_detail && records.customer_address_detail.area_name && records.customer_address_detail.area_name.en) ? records.customer_address_detail.area_name.en : "",
							(records.client_type) ? Constants.USER_CLIENT_TYPE[records.client_type] : "",
							(records.ticket_no) ? records.ticket_no : "",
							(records.authorization_id) ? records.authorization_id : "",
							(records.payment_method == Constants.KNET) ? records.payment_id : "",
							(records.payment_method == Constants.KNET) ? records.track_id : "",
							(records.gateway_response_code) ? records.gateway_response_code : "",
							(records.driver_id) ? records.driver_id : "",
							(records.captain_name) ? records.captain_name : "",
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				Helper.exportToExcel(req, res, {
					file_prefix: "OrdersReport",
					heading_columns: commonColls,
					column_formats : {
						A : {type : "date",	 format : Constants.EXCEL_DATE_FORMAT},
						H : {type : "time",  format : Constants.EXCEL_TIME_FORMAT},
						P : {type : "number",format : Constants.EXCEL_CURRENCY_FORMAT},
						Q : {type : "number",format : Constants.EXCEL_CURRENCY_FORMAT},
						R : {type : "number",format : Constants.EXCEL_CURRENCY_FORMAT},
						S : {type : "number",format : Constants.EXCEL_CURRENCY_FORMAT},
						T : {type : "number",format : Constants.EXCEL_CURRENCY_FORMAT},
						U : {type : "number",format : Constants.EXCEL_CURRENCY_FORMAT},
						V : {type : "number",format : Constants.EXCEL_CURRENCY_FORMAT},
						X : {type : "number",format : Constants.EXCEL_CURRENCY_FORMAT}
					},
					export_data: temp
				});
			});
		}catch(err){
			return next(err);
		}
	};// end ordersExportData()
}