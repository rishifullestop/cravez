import { parallel as asyncParallel, each as asyncEach} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, newDate, exportToExcel, configDatatable, currencyFormat } from '../../../../utils/index.mjs';

// Model for order payment cancel report
export default class OrderPaymentCancelReport {
	constructor(db) {
		this.db = db;
	}


	/**
	 * Function to get order payment cancel list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getOrderPaymentCancelList(req,res,next){
		try{
			if(isPost(req)){
				let limit		 = 	(req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 = 	(req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     = 	(req.body.from_date) 	? req.body.from_date 		:"";
				let toDate 	  	 = 	(req.body.to_date)   	? req.body.to_date   		:"";
				const collection = 	this.db.collection(Tables.PAYMENT_TRANSACTIONS);

				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);

				/** Set common conditions  */
				let commonConditions = { payment_status : Constants.PAYMENT_CANCELED};

				/** Condition for payment date */
				if (fromDate != "" && toDate != "") {
					commonConditions["created"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					};
				}

				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);
				asyncParallel({
					order_payment_list :(callback)=>{
						/** Get list of order payment cancel **/
						collection.aggregate([
							{$match : dataTableConfig.conditions},
							{$sort 	: dataTableConfig.sort_conditions},
							{$skip 	: skip},
							{$limit : limit},
							{$lookup:	{
								"from" 			: 	Tables.USERS,
								"localField" 	:	"user_id",
								"foreignField" 	: 	"_id",
								"as" 			: 	"customer_detail"
							}},
							{$project :	{ _id:1,invoice_number:1,transaction_id:1,payment_status:1,amount:1,created:1,order_ids:1,user_id:1,user_name: {$arrayElemAt: ["$customer_detail.full_name",0]}}},
						]).toArray().then(result=>{
							if(!result || result.length < 0) return callback(null,result);

							/** Get order unique id **/
							asyncEach(result,(records, eachCallback) => {
								if(!records.order_ids || records.order_ids.length <= 0) return eachCallback(null);

								let orderDetails = [];
								asyncEach(records.order_ids,(orderId, childEachCallback) => {
									if(!orderId) return childEachCallback(null);

									const orders = 	this.db.collection(Tables.ORDERS);
									orders.findOne({_id  : orderId},{projection: { _id:1,unique_order_id:1}}).then(orderResult=>{
										if(!orderResult) return childEachCallback(null);

										orderDetails.push({ order_id : orderResult._id ? orderResult._id : "",unique_order_id : orderResult.unique_order_id ? orderResult.unique_order_id : ""});
										childEachCallback(null);
									}).catch(next);
								},()=>{
									records.order_details = orderDetails;
									eachCallback(null);
								});
							},(asyncErr) => {
								callback(asyncErr, result);
							});
						});
					},
					total_records:(callback)=>{
						/** Get total number of records in orders collection **/
						collection.countDocuments(commonConditions).then(countResult=>{
							callback(null, countResult);
						}).catch(next);
					},
					filter_records:(callback)=>{
						/** Get filtered records counting in orders**/
						collection.countDocuments(dataTableConfig.conditions).then(countResult=>{
							callback(null, countResult);
						}).catch(next);
					}
				},(err, response)=>{
					/** Send response **/
					res.send({
						status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
						draw			: dataTableConfig.result_draw,
						data			: (response.order_payment_list) ? response.order_payment_list :[],
						recordsFiltered	: (response.filter_records) ? response.filter_records :0,
						recordsTotal	: (response.total_records)  ? response.total_records  :0
					});
				});
			}else{
				/** render order payment cancel listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/report/order_payment_cancel_report']);
				res.render('order_payment_cancel_report');
			}
		}catch(error){
			return next(error);
		}
	};//End getOrderPaymentCancelList()

	/**
	 *  Function for export order payment cancel report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async exportOrderPaymentCancel(req,res,next){
		try{
			let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
			let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";
			let sortingField  	= (req.query.sort_field) ? req.query.sort_field   	: "_id";
			let sortingDir 	 	= (req.query.sort_dir) ? req.query.sort_dir   		: "asc";
			let sortOrder		= (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;

			let exportConditions	= {payment_status : Constants.PAYMENT_CANCELED};
			let sortConditions		= {};
			sortConditions[sortingField] = sortOrder;

			/** Condition for date */
			if (fromDate != "" && toDate != "") {
				exportConditions["created"] = {
					$gte 	: newDate(fromDate),
					$lte 	: newDate(toDate),
				};
			}

			/** Get details **/
			const collection = 	this.db.collection(Tables.PAYMENT_TRANSACTIONS);
			collection.aggregate([
				{$match : exportConditions},
				{$sort 	: sortConditions},
				{$lookup:	{
					"from" 			: 	Tables.USERS,
					"localField" 	:	"user_id",
					"foreignField" 	: 	"_id",
					"as" 			: 	"customer_detail"
				}},
				{$project :	{ _id:1,invoice_number:1,transaction_id:1,payment_status:1,amount:1,created:1,order_ids:1,user_id:1,user_name: {$arrayElemAt: ["$customer_detail.full_name",0]}}},
			]).toArray().then(result=>{

				/** Get order unique id **/
				asyncEach(result,(records, eachCallback) => {
					if(!records.order_ids || records.order_ids.length <= 0) return eachCallback(null);

					let orderDetails = [];
					asyncEach(records.order_ids,(orderId, childEachCallback) => {
						if(!orderId) return childEachCallback(null);

						const orders = 	this.db.collection(Tables.ORDERS);
						orders.findOne({_id  : orderId},{projection: { _id:1,unique_order_id:1}}).then(orderResult=>{
							if(!orderResult) return childEachCallback(null);

							orderDetails.push({ order_id : orderResult._id ? orderResult._id : "",unique_order_id : orderResult.unique_order_id ? orderResult.unique_order_id : ""});
							childEachCallback(null);
						}).catch(next);
					},()=>{
						records.order_details = orderDetails;
							eachCallback(null);
					});
				},(asyncErr) => {
					if (asyncErr) return next(asyncErr);

					let temp			= [];
					let commonColls		= [];

					/** Define excel heading label **/

					commonColls	= [
						res.__("admin.report.invoice_number"),
						res.__("admin.report.transaction_id"),
						res.__("admin.report.order_ids"),
						res.__("admin.report.user_name"),
						res.__("admin.report.amount"),
						res.__("admin.report.payment_date"),
					];

					if (result && result.length > 0){
						result.map(records=>{
							let buffer =	[
								(records.invoice_number) ? records.invoice_number :"",
								(records.transaction_id) ? records.transaction_id 	:"",
								(records.order_ids) ? records.order_ids : "",
								(records.user_name) ? records.user_name : "",
								(records.amount) ? currencyFormat(records.amount) : currencyFormat(0),
								(records.created) ? newDate(records.created, Constants.AM_PM_FORMAT_WITH_DATE) : '',
							];
							temp.push(buffer);
						});
					}

					/**  Function to export data in excel format **/
					exportToExcel(req,res,{
						file_prefix 		: "OrderPaymentCancle",
						heading_columns		: commonColls,
						export_data			: temp
					});
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
	};// end exportOrderPaymentCancel()
}
