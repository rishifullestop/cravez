import { ObjectId } from 'mongodb';
import clone from 'clone';
import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, newDate, exportToExcel, configDatatable, currencyFormat } from '../../../../utils/index.mjs';

// Model for settled payments
export default class SettledPayments {
	constructor(db) {
		this.db = db;
	}
	/**
	 * Function to get settled payments list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getSettledPaymentsList(req,res,next){
		try{
			if(isPost(req)){
				let limit		  = (req.body.length) ? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		  = (req.body.start)  ? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate      = (req.body.from_date) ? req.body.from_date : "";
				let toDate 	  	  = (req.body.to_date)   ? req.body.to_date   : "";
				let restaurantId  = (req.body.restaurant_id)   	? req.body.restaurant_id 	 : '';
				let branchId 	  = (req.body.branch_id)   		? req.body.branch_id 	 : '';
				let settlementMethod = (req.body.settlement_method)  ? req.body.settlement_method 	: '';
				let proceedBy 		 = (req.body.proceed_by)   		 ? req.body.proceed_by 			: '';
				let paymentMethod 	 = (req.body.payment_method)   	 ? req.body.payment_method 	 	: '';
				const collection  = this.db.collection(Tables.ORDERS);

				asyncParallel({
					restaurant_details:(callback)=>{
						if(!settlementMethod) return callback(null,null);

						/** Set restaurant conditions */
						let restaurantConditions = {
							settlement_method : {$in : [settlementMethod]}
						};

						/** Get restaurant ids */
						const restaurant_details = this.db.collection(Tables.RESTAURANT_DETAILS);
						restaurant_details.distinct("restaurant_id",restaurantConditions).then(restaurantIds => {
							callback(null,restaurantIds);
						}).catch(next);
					},
					restaurant_id:(callback)=>{
						if(!proceedBy) return callback(null,null);

						/** Set conditions */
						let settlementPaymentConditions = {
							proceed_by : new ObjectId(proceedBy)
						};

						/** Get restaurant ids */
						const order_settlement_payment_logs = this.db.collection(Tables.ORDER_SETTLEMENT_PAYMENT_LOGS);
						order_settlement_payment_logs.distinct("restaurant_id",settlementPaymentConditions).then(restaurantIds => {
							callback(null,restaurantIds);
						}).catch(next);
					},
				},async (asyncErr, asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					let restaurantIds     = asyncResponse.restaurant_details;
					let restaurantIdArray = asyncResponse.restaurant_id;

					/** Configure Datatable conditions*/
					let dataTableConfig = await configDatatable(req,res,null);

					/** Set common condition  */
					let commonConditions = {
						is_settlement : true
					};

					/** Condition for settlement method */
					if(settlementMethod) commonConditions.restaurant_id = {$in : restaurantIds};

					/** Conditions for order date */
					if (fromDate != "" && toDate != "") {
						dataTableConfig.conditions["order_date"] = {
							$gte 	: newDate(fromDate),
							$lte 	: newDate(toDate),
						};
					}

					/** Conditions for proceed by */
					if(proceedBy) dataTableConfig.conditions.restaurant_id = {$in : restaurantIdArray};
					
					/** Conditions for payment method */
					if(paymentMethod){
						if(paymentMethod.constructor !== Array)  paymentMethod = [paymentMethod];
						dataTableConfig.conditions['payment_method']	=	{$in : paymentMethod};
					}
					
					/** Conditions for restaurants */
					if(restaurantId){
						if(restaurantId.constructor !== Array)  restaurantId = [restaurantId];
						restaurantId = arrayToObject(restaurantId);

						if(!dataTableConfig.conditions['$and']) dataTableConfig.conditions['$and'] = [];
						dataTableConfig.conditions['$and'].push({
							restaurant_id : {$in : restaurantId}
						});
					}
					
					/** Conditions for branches */
					if(branchId){
						if(branchId.constructor !== Array)  branchId = [branchId];
						branchId = arrayToObject(branchId);

						if(!dataTableConfig.conditions['$and']) dataTableConfig.conditions['$and'] = [];
						dataTableConfig.conditions['$and'].push({
							branch_id : {$in : branchId}
						});
					}
					
					dataTableConfig.conditions = Object.assign(dataTableConfig.conditions,commonConditions);
					
					asyncParallel({
						settled_list :(callback)=>{
							/** Get list of  settled payments list  **/
							collection.aggregate([
								{$match	: dataTableConfig.conditions},
								{$group	: {
									_id  : { restaurant_id   : "$restaurant_id"},
									restaurant_name 	: { $first : "$restaurant_name"},
									restaurant_id   	: { $first : "$restaurant_id"},
									account_manager_name: { $first : "$account_manager_name"},
									email_address   	: { $first : "$email_address"},
									mobile_number   	: { $first : "$mobile_number"},
									branch_detail   	: { $addToSet  : "$branch_id"},
									restaurant_payout   : { $sum : "$restaurant_payout"},
								}},
								{$sort 	: dataTableConfig.sort_conditions},
								{$skip 	: skip},
								{$limit : limit},
								{$lookup:	{ /** Get restaurant details */
									"from" 			: 	Tables.RESTAURANT_DETAILS,
									"localField" 	:	"restaurant_id",
									"foreignField" 	: 	"restaurant_id",
									"as" 			: 	"restaurant_detail"
								}},
								{$addFields:	{
									total_branches 		 : {$size: "$branch_detail"},
									account_manager_name : {$arrayElemAt: ["$restaurant_detail.account_manager",0]},
									email_address	: {$arrayElemAt: ["$restaurant_detail.email",0]},
									mobile_number  	: {$arrayElemAt:["$restaurant_detail.mobile_number",0]},
								}},
								{$project : {restaurant_detail: 0}}
							]).toArray().then(findResult => {
								callback(null,findResult);
							}).catch(next);
						},
						total_records:(callback)=>{
							/** Get total number of records in orders collection **/
							collection.distinct("restaurant_id",commonConditions).then(restaurantIds => {
								let count = (restaurantIds) ? restaurantIds.length :"";
								callback(null, count);
							}).catch(next);
						},
						filter_records:(callback)=>{
							/** Get filtered records counting in orders **/
							collection.distinct("restaurant_id",dataTableConfig.conditions).then(restaurantIds => {
								let filterCount = (restaurantIds) ? restaurantIds.length :"";
								callback(null, filterCount);
							}).catch(next);
						}
					},(err, response)=>{
						/** Send response **/
						res.send({
							status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
							draw			: dataTableConfig.result_draw,
							data			: (response.settled_list) 	? response.settled_list 	:[],
							recordsFiltered	: (response.filter_records) ? response.filter_records	:0,
							recordsTotal	: (response.total_records)  ? response.total_records 	:0
						});
					});
				});
			}else{
				let conditions = clone(Constants.ADMIN_USER_COMMON_CONDITIONS);

				/** Set dropdown options **/
				let options = {
					collections :[
						{
							collection : Tables.SETTLEMENT_METHODS,
							columns    : ["slug","title"],
						},
						{
							collection : Tables.USERS,
							columns    : ["_id","full_name"],
							conditions : conditions
						},
						{
							collection : Tables.RESTAURANTS,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions : {
								is_deleted	: Constants.NOT_DELETED
							},
						},
						{
							collection : Tables.PAYMENT_METHODS,
							columns    : ["slug",["title",Constants.DEFAULT_LANGUAGE_CODE]]
						}
					]
				};

				/**Get dropdown list **/
				getDropdownList(req,res, next,options).then(response=> {
					/** render settled payments listing page **/
					req.breadcrumbs(BREADCRUMBS['admin/report/settled_payment_list']);
					res.render('settled_payment_list',{
						settlement_methods : response?.final_html_data?.[0] || "",
						user_list 		   : response?.final_html_data?.[1] || "",
						restaurant_list    : response?.final_html_data?.[2] || "",
						payment_methods    : response?.final_html_data?.[3] || ""
					});
				}).catch(next);
			}
		}catch(error){
			return next(error);
		}
	};//End getSettledPaymentsList()
	
	/**
	 *  Function for export user records
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async settledExportData(req,res,next){
		try{
			let fromDate 		= (req.query.from_date) ? req.query.from_date : "";
			let toDate 			= (req.query.to_date) ? req.query.to_date : "";
			let branchId 		= (req.query.branch_id) ? (req.query.branch_id) : "";
			let restaurantId 	= (req.query.restaurant_id) ? (req.query.restaurant_id) : "";

			let settlementMethod= (req.query.settlement_method) ? req.query.settlement_method : '';
			let proceedBy 		= (req.query.proceed_by) ? req.query.proceed_by : '';
			let paymentMethod 	= (req.query.payment_method) ? (req.query.payment_method): "";

			asyncParallel({
				restaurant_details: (callback) => {
					if (!settlementMethod) return callback(null, null);

					/** Set restaurant conditions */
					let restaurantConditions = {
						settlement_method: { $in: [settlementMethod] }
					};

					/** Get restaurant ids */
					const restaurant_details = this.db.collection(Tables.RESTAURANT_DETAILS);
					restaurant_details.distinct("restaurant_id", restaurantConditions).then(restaurantIds => {
						callback(null, restaurantIds);
					}).catch(next);
				},
				restaurant_id: (callback) => {
					if (!proceedBy) return callback(null, null);

					/** Set conditions */
					let settlementPaymentConditions = {
						proceed_by: new ObjectId(proceedBy)
					};

					/** Get restaurant ids */
					const order_settlement_payment_logs = this.db.collection(Tables.ORDER_SETTLEMENT_PAYMENT_LOGS);
					order_settlement_payment_logs.distinct("restaurant_id", settlementPaymentConditions).then(restaurantIds => {
						callback(null, restaurantIds);
					}).catch(next);
				},
			}, (asyncErr, asyncResponse) => {
				if (asyncErr) return next(asyncErr);

				let restaurantIds 		= asyncResponse.restaurant_details;
				let restaurantIdArray 	= asyncResponse.restaurant_id;

				/** Set export condition  */
				let exportConditions = {
					is_settlement: true
				};
			
				/** Condition for settlement method */
				if (settlementMethod) exportConditions.restaurant_id = { $in: restaurantIds };

				/** Conditions for order date */
				if (fromDate != "" && toDate != "") {
					exportConditions["order_date"] = {
						$gte: newDate(fromDate),
						$lte: newDate(toDate),
					};
				}

				/** Conditions for proceed by */
				if (proceedBy) exportConditions.restaurant_id = { $in: restaurantIdArray };

				/** Conditions for payment method */
				if (paymentMethod) {
					if (paymentMethod.constructor !== Array) paymentMethod = [paymentMethod];
					exportConditions['payment_method'] = { $in: paymentMethod };
				}

				/** Conditions for restaurants */
				if (restaurantId) {
					if (restaurantId.constructor !== Array) restaurantId = [restaurantId];
					restaurantId = arrayToObject(restaurantId);

					if (!exportConditions['$and']) exportConditions['$and'] = [];
					exportConditions['$and'].push({
						restaurant_id: { $in: restaurantId }
					});
				}

				/** Conditions for branches */
				if (branchId) {
					if (branchId.constructor !== Array) branchId = [branchId];
					branchId = arrayToObject(branchId);

					if (!exportConditions['$and']) exportConditions['$and'] = [];
					exportConditions['$and'].push({
						branch_id: { $in: branchId }
					});
				}
				
				/** Get order details **/
				const orders	= this.db.collection(Tables.ORDERS);
				orders.aggregate([
					{ $match: exportConditions},
					{$group	: {
						_id  : { restaurant_id   : "$restaurant_id"},
						restaurant_name 	: { $first : "$restaurant_name"},
						restaurant_id   	: { $first : "$restaurant_id"},
						account_manager_name: { $first : "$account_manager_name"},
						email_address   	: { $first : "$email_address"},
						mobile_number   	: { $first : "$mobile_number"},
						branch_detail   	: { $addToSet  : "$branch_id"},
						restaurant_payout   : { $sum : "$restaurant_payout"},
					}},
					{$sort 	: {"_id" : -1}},
					{$lookup:	{ /** Get restaurant details */
						"from" 			: 	Tables.RESTAURANT_DETAILS,
						"localField" 	:	"restaurant_id",
						"foreignField" 	: 	"restaurant_id",
						"as" 			: 	"restaurant_detail"
					}},
					{$addFields:	{
						total_branches 		 : {$size: "$branch_detail"},
						account_manager_name : {$arrayElemAt: ["$restaurant_detail.account_manager",0]},
						email_address	: {$arrayElemAt: ["$restaurant_detail.email",0]},
						mobile_number  	: {$arrayElemAt:["$restaurant_detail.mobile_number",0]},
					}},
					{$project : {restaurant_detail: 0}}
				]).toArray().then(findResult => {
					let temp			= [];
					let commonColls		= [];

					/** Define excel heading label **/
					commonColls		= 	[
						res.__("admin.settled_payments.restaurant_name"),
						res.__("admin.settled_payments.contact_number"),
						res.__("admin.settled_payments.email_address"),
						res.__("admin.settled_payments.account_manager_name"),
						res.__("admin.settled_payments.total_branches"),
						res.__("admin.settled_payments.paid_amount"),
					];

					if(findResult && findResult.length > 0){
						findResult.map(records=>{
							let buffer =	[
								(records.restaurant_name.en)	? 	records.restaurant_name.en 			:"",
								(records.mobile_number)			? 	records.mobile_number 				:"",
								(records.email_address) 		? 	records.email_address 				:"",
								(records.account_manager_name) 	? 	records.account_manager_name 		:"",
								(records.total_branches) 		? 	records.total_branches 				:"",
								(records.restaurant_payout) 	? 	currencyFormat(records.restaurant_payout) 			:currencyFormat(0),
							];
							temp.push(buffer);
						});
					}

					/**  Function to export data in excel format **/
					exportToExcel(req,res,{
						file_prefix 		: "SettledPaymentReport",
						heading_columns		: commonColls,
						export_data			: temp
					});
				}).catch(next);
			});
		}catch(error){
			return next(error);
		}
	};// end settledExportData()
}
