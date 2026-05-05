import clone from 'clone';
import { ObjectId } from 'mongodb';
import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, arrayToObject, newDate, exportToExcel, configDatatable } from '../../../../utils/index.mjs';

// Model for offer only customer report
export default class OfferOnlyCustomerReport {
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
	async getOfferOnlyCustomers(req,res,next){
		try{
			if(isPost(req)){
				let limit		 = (req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 = (req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     = (req.body.from_date) 	? req.body.from_date 		:"";
				let toDate 	  	 = (req.body.to_date)   	? req.body.to_date   		:"";
				let netAmount 	 = (req.body.net_amount)   	? req.body.net_amount   	:"";
				const collection = this.db.collection(Tables.ORDERS);

				/** Set order condition */
				let orderConditions = {admin_status : Constants.ORDER_DELIVERED};			
				/** Condition for order date */
				if (fromDate != "" && toDate != "") {
					orderConditions = { ...{order_date: {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					}},...orderConditions};
				}
					
				switch(netAmount){
					case Constants.ZERO_TO_TWO:
						orderConditions.net_amount = {$lte : 2};
					break;
					case Constants.THREE_TO_FIVE:
						orderConditions.net_amount = {$gte : 3, $lte : 5};
					break;
					case Constants.SIX_TO_TEN:
						orderConditions.net_amount = {$gte : 6, $lte : 10};
					break;
					case Constants.GREATER_THAN_TEN:
						orderConditions.net_amount = {$gt : 10};
					break;
				}
				
				asyncParallel({
					order_ids:(callback)=>{
						/** Get order ids  */
						let tmpOfferCondition	= clone(orderConditions);
						tmpOfferCondition["$and"]	= [{offer_id : {$exists : true}},{offer_id : {$ne : ""}},{offer_id : {$ne : null}}]; 
						collection.aggregate([
							{$match : orderConditions},
							{$lookup: {	
								from 		:	Tables.ORDER_DETAILS,
								localField  :	"_id",
								foreignField:	"order_id",
								as 		  	:	"order_details"
							}},
							{$project : {
								_id			: 1, 
								order_date	: 1, 
								admin_status: 1, 
								net_amount	: 1, 
								offer_id	: {$arrayElemAt: ["$order_details.offer_id",0]}
							}},
							{$match : tmpOfferCondition},
						]).toArray().then(result=>{
							let orderIds = result.map(order=>{
								return new ObjectId(order._id);
							});
							callback(null,orderIds);
						}).catch(next);
					},
					customer_ids:(callback)=>{
						/** Get customer ids  */
						let customerCondition		= clone(orderConditions);
						customerCondition["$or"]	= [{offer_id : {$exists : false}},{offer_id : {$eq : ""}},{offer_id : {$eq : null}}]; 
						
						collection.aggregate([
							{$match : orderConditions},
							{$lookup: {	
								from 		:	Tables.ORDER_DETAILS,
								localField  :	"_id",
								foreignField:	"order_id",
								as 		  	:	"order_details"
							}},
							{$project : {
								_id			: 1, 
								customer_id	: 1,
								order_date	: 1, 
								admin_status: 1, 							
								net_amount	: 1, 							
								offer_id	: {$arrayElemAt: ["$order_details.offer_id",0]}
							}},
							{$match : customerCondition},
						]).toArray().then(result=>{						
							let customerIds = result.map(order=>{
								return new ObjectId(order.customer_id);
							});
							callback(null,customerIds);
						}).catch(next);
					},
				},async (asyncErr, asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					let orderIds	= asyncResponse.order_ids;
					let customerIds = asyncResponse.customer_ids;
					
					/** Configure Datatable conditions*/
					let dataTableConfig = await configDatatable(req,res,null);
						
					/** Set common condition */
					let commonConditions = {
						_id 		: { $in : arrayToObject(orderIds)},
						customer_id : { $nin: customerIds},
						admin_status: Constants.ORDER_DELIVERED
					};
					
					dataTableConfig.conditions	= Object.assign(dataTableConfig.conditions, commonConditions);
					
					asyncParallel({
						records :(callback)=>{
							/** Get list **/
							collection.aggregate([
								{$match : dataTableConfig.conditions},
								{$group: {
									_id				: "$customer_id",
									full_name 		: {$first : "$full_name"},
									mobile_number  	: {$first : "$mobile_number"},
									order_count		: {$sum : 1}
								}},
								{$sort 	: dataTableConfig.sort_conditions},
								{$skip 	: skip},
								{$limit : limit},
							]).toArray().then(result=>{
								callback(null, result);
							}).catch(next);
						},
						records_total: (callback)=>{
							/** Get total number of records **/
							collection.aggregate([
								{$match: commonConditions},
								{$group:{
									_id	: "$customer_id",
								}},
								{$count : "count"},
							]).toArray().then(countResult=>{
								countResult = (countResult && countResult[0] && countResult[0].count)	?	countResult[0].count :0;
								callback(null, countResult);
							}).catch(next);
						},
						records_filtered: (callback)=>{
							/** Get filtered records counting in order items   **/
							collection.aggregate([
								{$match : dataTableConfig.conditions},
								{$group:{
									_id	: "$customer_id",
								}},
								{$count : "count"},
							]).toArray().then(filterContResult=>{
								filterContResult = (filterContResult && filterContResult[0] && filterContResult[0].count)	?	filterContResult[0].count :0;
								callback(null,filterContResult);
							}).catch(next);
						}
					},(err, response)=>{
						/** Send response **/
						res.send({
							status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
							draw			: dataTableConfig.result_draw,
							data			: response.records,
							recordsFiltered	: response.records_filtered,
							recordsTotal	: response.records_total,
						});
					});
				});
			}else{			
				/** render top selling items report listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/report/offer_only_customer_report']);
				res.render('offer_only_customer_report');
			}		
		}catch(error){
			return next(error);
		}
	};//End getOfferOnlyCustomers()

	/**
	 *  Function for export top selling items report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async offerOnlyCustomersExport(req,res,next){	
		try{
			let fromDate = (req.query.from_date) ? req.query.from_date : "";
			let toDate = (req.query.to_date) ? req.query.to_date : "";
			let sortingField = (req.query.sort_field) ? req.query.sort_field : "_id";
			let sortingDir = (req.query.sort_dir) ? req.query.sort_dir : "asc";
			let sortOrder = (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;
			let netAmount = (req.query.net_amount) ? req.query.net_amount : "";

			/** Set order condition */
			let orderConditions = { admin_status: Constants.ORDER_DELIVERED };
			/** Condition for order date */
			if (fromDate != "" && toDate != "") {
				orderConditions["order_date"] = {
					$gte: newDate(fromDate),
					$lte: newDate(toDate),
				};
			}
			let sortConditions = {};
			sortConditions[sortingField] = sortOrder;
			switch (netAmount) {
				case Constants.ZERO_TO_TWO:
					orderConditions.net_amount = { $lte: 2 };
					break;
				case Constants.THREE_TO_FIVE:
					orderConditions.net_amount = { $gte: 3, $lte: 5 };
					break;
				case Constants.SIX_TO_TEN:
					orderConditions.net_amount = { $gte: 6, $lte: 10 };
					break;
				case Constants.GREATER_THAN_TEN:
					orderConditions.net_amount = { $gt: 10 };
					break;
			}

			const orders		= this.db.collection(Tables.ORDERS);
			asyncParallel({
				order_ids:(callback)=>{
					/** Get order ids  */
					let tmpOfferCondition	= clone(orderConditions);
					tmpOfferCondition["$and"]	= [{offer_id : {$exists : true}},{offer_id : {$ne : ""}},{offer_id : {$ne : null}}]; 
					orders.aggregate([
						{$match : orderConditions},
						{$lookup: {	
							from 		:	Tables.ORDER_DETAILS,
							localField  :	"_id",
							foreignField:	"order_id",
							as 		  	:	"order_details"
						}},
						{$project : {
							_id			: 1, 
							order_date	: 1, 
							admin_status: 1, 
							net_amount	: 1, 
							offer_id	: {$arrayElemAt: ["$order_details.offer_id",0]}
						}},
						{$match : tmpOfferCondition},
					]).toArray().then(result=>{
						let orderIds = result.map(order=>{
							return new ObjectId(order._id);
						});
						callback(null,orderIds);
					}).catch(next);
				},
				customer_ids:(callback)=>{
					/** Get customer ids  */
					let customerCondition		= clone(orderConditions);
					customerCondition["$or"]	= [{offer_id : {$exists : false}},{offer_id : {$eq : ""}},{offer_id : {$eq : null}}]; 
					
					orders.aggregate([
						{$match : orderConditions},
						{$lookup: {	
							from 		:	Tables.ORDER_DETAILS,
							localField  :	"_id",
							foreignField:	"order_id",
							as 		  	:	"order_details"
						}},
						{$project : {
							_id			: 1, 
							customer_id	: 1,
							order_date	: 1, 
							admin_status: 1, 							
							net_amount	: 1, 
							offer_id	: {$arrayElemAt: ["$order_details.offer_id",0]}
						}},
						{$match : customerCondition},
					]).toArray().then(result=>{						
						let customerIds = result.map(order=>{
							return new ObjectId(order.customer_id);
						});
						callback(null,customerIds);
					}).catch(next);
				},
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				let orderIds	= asyncResponse.order_ids;
				let customerIds = asyncResponse.customer_ids;

				/** Set common condition */
				let commonConditions = {
					_id 		: { $in : arrayToObject(orderIds)},
					customer_id : { $nin : customerIds},
					admin_status: Constants.ORDER_DELIVERED
				};
				orders.aggregate([
					{ $match: commonConditions},			
					{$group : {
						_id				: "$customer_id",
						full_name 		: {$first : "$full_name"},
						mobile_number  	: {$first : "$mobile_number"},
						order_count		: {$sum : 1}
					}},
					{$sort 	: sortConditions},
				]).toArray().then(findResult=>{

					let temp			= [];
					let commonColls		= [];

					/** Define excel heading label **/
					commonColls	= [
						res.__("admin.report.customer_name"),
						res.__("admin.report.mobile_number"),			
						res.__("admin.report.orders"),			
					];

					if(findResult && findResult.length > 0){
						findResult.map(records=>{
							let buffer =	[
								(records.full_name) 	?  records.full_name  :"",
								(records.mobile_number) ?  records.mobile_number  :"",
								(records.order_count)  	?  records.order_count    :0
							];
							temp.push(buffer);
						});
					}

					/**  Function to export data in excel format **/
					exportToExcel(req,res,{
						file_prefix 		: "OfferOnlyCustomersExport",
						heading_columns		: commonColls,
						export_data			: temp
					});
				}).catch(next);
			});
		}catch(error){
			return next(error);
		}
	};// end offerOnlyCustomersExport()
}
