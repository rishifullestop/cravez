import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, newDate, exportToExcel, configDatatable } from '../../../../utils/index.mjs';

// Model for Payment Report
export default class PaymentReport {
	constructor(db){
		this.db = db;
	}

	/**
	 * Function to get payment status report list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getPaymentReportList(req,res,next){
		try{
			if(isPost(req)){
				let limit		  = (req.body.length) ? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		  = (req.body.start)  ? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate 	  = (req.body.fromDate) 	? req.body.fromDate 				: "";
				let toDate 		  = (req.body.toDate) 	 	? req.body.toDate 					: "";
				const collection  = this.db.collection(Tables.PAYMENT_TRANSACTIONS);

				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);
				let commonConditions	=	{
					payment_event : Constants.ORDER_PAYMENT,
					"order_ids.0" : {$ne: null}
				};

				/** Conditions for date */
				let dateConditions = commonConditions;
				if(fromDate != "" && toDate != "") {
					dateConditions = {...{created :{$gte: newDate(fromDate), $lte: newDate(toDate)} }, ...commonConditions}
				}

				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions,commonConditions);

				asyncParallel({
					result :(callback)=>{
						/** Get list of payments of Orders **/
						collection.aggregate([
							{$match : dateConditions},
							{$lookup: {	/** Get users details **/
								from 		:	Tables.USERS,
								localField  :	"user_id",
								foreignField:	"_id",
								as 		  	:	"user_details"
							}},
							{$project : {
								_id: 1, payment_event: 1, payment_method: 1, payment_response: 1, user_id: 1, payment_status: 1, invoice_number: 1, order_ids: 1, unique_order_ids: "$order_details.unique_order_id",created:1,
								user_name: { $arrayElemAt: ["$user_details.full_name", 0] },
							}},
							{$match : dataTableConfig.conditions},
							{$skip 	: skip},
							{$limit : limit},
							{$lookup: {	/** Get order details **/
								from 		:	Tables.ORDERS,
								localField  :	"order_ids",
								foreignField:	"_id",
								as 		  	:	"order_details"
							}},
							{$lookup : {
								from 		 : Tables.PAYMENT_METHODS,
								localField 	 : "payment_method",
								foreignField : "slug",
								as 			 : "payment_method_details"
							}},
							{$addFields : {
								payment_method	: {$arrayElemAt : ["$payment_method_details.title."+Constants.DEFAULT_LANGUAGE_CODE,0]},
								unique_order_ids: "$order_details.unique_order_id"
							}},
							{$project : {
								order_details: 0, payment_method_details: 0
							}},
						],{allowDiskUse: true}).toArray().then(result=>{
							if(result?.length > 0){
								result.map(records=>{
									let paymentResponse = (records.payment_response && records.payment_response != undefined) ? JSON.parse(records.payment_response) : "";
									if(paymentResponse && paymentResponse.InvoiceTransactions && paymentResponse.InvoiceTransactions.constructor === Array){
										records.transaction_id 	= paymentResponse?.InvoiceTransactions?.[0]?.TransactionId || "";
										records.payment_id 		= paymentResponse?.InvoiceTransactions?.[0]?.PaymentId || "";
									}
									if(paymentResponse && paymentResponse.InvoiceTransactions && paymentResponse.InvoiceTransactions.constructor === Object){
										records.transaction_id 	= paymentResponse?.InvoiceTransactions?.TransactionId || "";
										records.payment_id 		= paymentResponse?.InvoiceTransactions?.PaymentId || "";
									}
									delete records.payment_response;
								});
							}
							callback(null, result);
						});
					},
					filter_records:(callback)=>{
						/** Get filtered records counting in payment transactions **/
						collection.aggregate([
							{$match : dateConditions},
							{$lookup: {	/** Get users details **/
								from 		:	Tables.USERS,
								localField  :	"user_id",
								foreignField:	"_id",
								as 		  	:	"user_details"
							}},
							{$project : {
								_id:1,payment_event:1,payment_response:1,user_id:1,payment_status:1,invoice_number:1,order_ids:1,user_name: {$arrayElemAt: ["$user_details.full_name",0]},created:1,
							}},
							{$match : dataTableConfig.conditions},
							{$count : "count"}
						]).toArray().then(result=>{
							let count = result?.[0]?.count || 0;
							callback(null, count);
						}).catch(callback);
					}
				},(err, response)=>{
					/** Send response **/
					res.send({
						status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
						draw			: dataTableConfig.result_draw,
						data			: (response.result) 		?	response.result 		:[],
						recordsFiltered	: (response.filter_records) ? 	response.filter_records	:0,
						recordsTotal	: (response.filter_records)	? 	response.filter_records  :0
					});
				});
			}else{
				/** render report listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/report/payment_report']);
				res.render('payment_report');
			}
		}catch(err){
			next(err);
		}
	};//End getPaymentReportList()

	/**
	 *  Function for export payment report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async exportData(req,res,next){
		try{
			let fromDate 		= (req.query.from_date) ? req.query.from_date : "";
			let toDate 			= (req.query.to_date) ? req.query.to_date : "";
			let sortingField 	= (req.query.sort_field) ? req.query.sort_field : "_id";
			let sortingDir 		= (req.query.sort_dir) ? req.query.sort_dir : "asc";
			let sortOrder 		= (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;
			let name 			= (req.query.name) ? req.query.name : "";
			let sortConditions = {};
			sortConditions[sortingField] = sortOrder;

			let exportConditions = {
				payment_event: Constants.ORDER_PAYMENT,
				"order_ids.0": { $exists: true }
			};
			if(fromDate != "" && toDate != "") {
				exportConditions = {...{created :{$gte: newDate(fromDate), $lte: newDate(toDate)} }, ...exportConditions};
			}

			let nameCondi= {};
			if (name) nameCondi["user_details.full_name"] = { $regex: name, $options: 'i' };

			/** Get payment transactions details **/
			const payment_transactions	= this.db.collection(Tables.PAYMENT_TRANSACTIONS);
			payment_transactions.aggregate([
				{$match: exportConditions},
				{$sort : sortConditions},
				{$lookup: {	/** Get users details **/
					from 		:	Tables.USERS,
					localField  :	"user_id",
					foreignField:	"_id",
					as 		  	:	"user_details"
				}},
				{$match: nameCondi},
				{$lookup: {	/** Get users details **/
					from		: Tables.ORDERS,
					localField	: "order_ids",
					foreignField: "_id",
					as			: "order_details"
				}},
				{$lookup : {
					from 		 : Tables.PAYMENT_METHODS,
					localField 	 : "payment_method",
					foreignField : "slug",
					as 			 : "payment_method_details"
				}},
				{$project: {
					_id: 1, payment_event: 1, payment_response: 1, user_name: {$arrayElemAt: ["$user_details.full_name", 0] }, user_id: 1, payment_status: 1, invoice_number: 1,  created: 1, order_ids: 1, unique_order_ids: "$order_details.unique_order_id", payment_method: {$arrayElemAt : ["$payment_method_details.title."+Constants.DEFAULT_LANGUAGE_CODE,0]},
				}},
			],{allowDiskUse: true}).toArray().then(result=>{

				if (result?.length > 0) {
					result.map(records=>{
						if(records.payment_response){
							let paymentResponse = JSON.parse(records.payment_response);
							if(paymentResponse && paymentResponse.InvoiceTransactions && paymentResponse.InvoiceTransactions.constructor === Array){
								records.transaction_id 	= paymentResponse?.InvoiceTransactions?.[0]?.TransactionId || "";
								records.payment_id 		= paymentResponse?.InvoiceTransactions?.[0]?.PaymentId || "";
							}
							if(paymentResponse && paymentResponse.InvoiceTransactions && paymentResponse.InvoiceTransactions.constructor === Object){
								records.transaction_id 	= paymentResponse?.InvoiceTransactions?.TransactionId || "";
								records.payment_id 		= paymentResponse?.InvoiceTransactions?.PaymentId || "";
							}
							delete records.payment_response;
						}
					});
				}

				let temp			= [];
				let commonColls		= [];

				/** Define excel heading label **/
				commonColls		= 	[
					res.__("admin.report.order_id"),
					res.__("admin.report.transaction_id"),
					res.__("admin.report.customer_name"),
					res.__("admin.report.payment_id"),
					res.__("admin.report.payment_status"),
					res.__("admin.report.payment_reference"),
					res.__("admin.report.transaction_date"),
				];

				if(result && result.length > 0){
					result.map(records=>{
						let buffer =	[
							(records.unique_order_ids)  ? records.unique_order_ids 			:"",
							(records.transaction_id)	? records.transaction_id 			:"",
							(records.user_name)			? records.user_name 	:"",
							(records.payment_id)		? records.payment_id 	:"",
							Constants.PAYMENT_STATUS?.[records.payment_status]?.status_name ||"",
							(records.payment_method) 	? records.payment_method 			:"",
							(records.created)			? newDate(records.created,Constants.AM_PM_FORMAT_WITH_DATE) :""
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "PaymentStatusReport",
					heading_columns		: commonColls,
					export_data			: temp
				});
			});
		}catch(err){
			next(err);
		}
	};// end exportData()
}
