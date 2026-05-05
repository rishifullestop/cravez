import {parallel as asyncParallel} from 'async';
import clone from 'clone';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import * as Helper  from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

export default class CustomReports {
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
	async getCustomReports (req,res,next){
		if(Helper.isPost(req)){
			let limit		 = (req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
			let skip		 = (req.body.start)  		? parseInt(req.body.start)  : Constants.DEFAULT_SKIP;
			let fromDate     = (req.body.from_date) 	? req.body.from_date 		: "";
			let toDate 	  	 = (req.body.to_date)   	? req.body.to_date   		: "";
			let reportType 	 = (req.body.report_type)   ? req.body.report_type   	: Constants.BUYERS_CRAVEZ_DELIVERY;
			const collection = this.db.collection(Tables.ORDERS);

			/** Set order condition */
			let orderConditions = {admin_status : Constants.ORDER_DELIVERED};
			/** Condition for order date */
			if (fromDate != "" && toDate != "") {
				orderConditions["order_date"] = {
					$gte 	: Helper.newDate(fromDate),
					$lte 	: Helper.newDate(toDate),
				};
			}

			asyncParallel({
				include_customers:(callback)=>{
					/** Get customer ids  */
					let tmpOrderCondition = clone(orderConditions);
					if(reportType == Constants.BUYERS_CRAVEZ_DELIVERY) tmpOrderCondition.delivery_type = Constants.DELIVERY_BY_CRAVEZ;
					if(reportType == Constants.BUYERS_RESTRAUNT_DELIVERY) tmpOrderCondition.delivery_type = Constants.DELIVERY_BY_RESTAURANT;
					if(reportType == Constants.FREE_DELIVERY_CUSTOMERS){
						tmpOrderCondition.delivery_fee	= {$eq : 0};
						tmpOrderCondition.delivery_type = {$ne : Constants.DELIVERY_BY_PICK_UP};
					}
					collection.distinct("customer_id",tmpOrderCondition).then(orderIds=>{
						callback(null,orderIds);
					}).catch(err=>{
						callback(err, []);
					});
				},
				exclude_customers:(callback)=>{
					if(reportType == Constants.SINGLE_REST_CUSTOMERS) return callback(null,[]);
					/** Get customer ids  */
					let tmpOrderCondition = clone(orderConditions);
					if(reportType == Constants.BUYERS_CRAVEZ_DELIVERY) tmpOrderCondition.delivery_type = Constants.DELIVERY_BY_RESTAURANT;
					if(reportType == Constants.BUYERS_RESTRAUNT_DELIVERY) tmpOrderCondition.delivery_type = Constants.DELIVERY_BY_CRAVEZ;
					if(reportType == Constants.FREE_DELIVERY_CUSTOMERS){
						tmpOrderCondition.delivery_fee	= {$gte : 1};
						tmpOrderCondition.delivery_type = {$ne : Constants.DELIVERY_BY_PICK_UP};
					}
					collection.distinct("customer_id",tmpOrderCondition).then(orderIds=>{
						callback(null,orderIds);
					}).catch(err=>{
						callback(err, []);
					});
				},
			},async (asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				let includeCustomers	= asyncResponse.include_customers;
				let excludeCustomers	= asyncResponse.exclude_customers;

				/** Configure Datatable conditions*/
				const dataTableConfig = await Helper.configDatatable(req, res, null);

				/** Set common condition */
				let commonConditions = {
					$and : [
						{customer_id : { $in : Helper.arrayToObject(includeCustomers)}},
						{customer_id : { $nin: Helper.arrayToObject(excludeCustomers)}}
					],
					admin_status: Constants.ORDER_DELIVERED
				};
				if (fromDate != "" && toDate != "") {
					commonConditions["order_date"] = {
						$gte 	: Helper.newDate(fromDate),
						$lte 	: Helper.newDate(toDate),
					};
				}
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				asyncParallel({
					records :(callback)=>{
						/** Get list **/
						let aggregatePipeline = [
							{$match : dataTableConfig.conditions},
							{$sort 	: {order_date : Constants.SORT_DESC}},
							{$group : {
								_id				: "$customer_id",
								customer_id		: {$first : "$customer_id"},
								full_name 		: {$first : "$full_name"},
								mobile_number  	: {$first : "$mobile_number"},
								order_count		: {$sum : 1},
							}},
							{$sort 	: dataTableConfig.sort_conditions},
							{$skip 	: skip},
							{$limit : limit},
						];

						if(reportType == Constants.SINGLE_REST_CUSTOMERS){
							aggregatePipeline = [
								{$match : dataTableConfig.conditions},
								{$sort 	: {order_date : Constants.SORT_DESC}},
								{$group : {
									_id				: "$customer_id",
									customer_id		: {$first : "$customer_id"},
									full_name 		: {$first : "$full_name"},
									mobile_number  	: {$first : "$mobile_number"},
									order_count		: {$sum : 1},
									restaurants		: {$addToSet : "$restaurant_id"}
								}},
								{ $match: {
									$expr: {$eq: [{$size: "$restaurants"}, 1]}
								}},
								{$sort 	: dataTableConfig.sort_conditions},
								{$skip 	: skip},
								{$limit : limit},
							];
						}

						collection.aggregate(aggregatePipeline).toArray().then(result=>{
							callback(null, result);
						}).catch(err=>{
							callback(err, []);
						});
					},
					records_filtered: (callback)=>{
						/** Get filtered records counting  **/

						let aggregatePipeline = [
							{$match: dataTableConfig.conditions},
							{$group:{
								_id	: "$customer_id",
							}},
							{$count : "count"},
						];
						if(reportType == Constants.SINGLE_REST_CUSTOMERS){
							aggregatePipeline = [
								{$match: dataTableConfig.conditions},
								{$group:{
									_id	: "$customer_id",
									restaurants	: {$addToSet : "$restaurant_id"}
								}},
								{ $match: {
										$expr: {$eq: [{$size: "$restaurants"}, 1]}
									}
								},
								{$count : "count"},
							];
						}
						collection.aggregate(aggregatePipeline).toArray().then(filterContResult=>{
							filterContResult = (filterContResult && filterContResult[0] && filterContResult[0].count)	?	filterContResult[0].count :0;
							callback(null,filterContResult);
						}).catch(err=>{
							callback(err, 0);
						});
					}
				},(err, response)=>{
					/** Send response **/
					res.send({
						status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
						draw			: dataTableConfig.result_draw,
						data			: response.records,
						recordsFiltered	: response.records_filtered,
						recordsTotal	: response.records_filtered,
					});
				});
			});
		}else{

			/** render report listing page **/
			req.breadcrumbs(BREADCRUMBS['admin/report/custom_reports']);
			res.render('custom_reports');
		}
	};//End getCustomReports()

	/**
	 *  Function for export report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async customReportsExport (req,res,next){
		let fromDate 		= (req.query.from_date) ? req.query.from_date : "";
		let toDate 			= (req.query.to_date) ? req.query.to_date : "";
		let sortingField 	= (req.query.sort_field) ? req.query.sort_field : "_id";
		let sortingDir 		= (req.query.sort_dir) ? req.query.sort_dir : "asc";
		let sortOrder 		= (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;
		let reportType 		= (req.query.report_type) ? (req.query.report_type) : "";

		let orderConditions = { admin_status: Constants.ORDER_DELIVERED};
		let sortConditions = {};
		sortConditions[sortingField] = sortOrder;

		/** Condition for date */
		if (fromDate != "" && toDate != "") {
			orderConditions["order_date"] = {
				$gte: Helper.newDate(fromDate),
				$lte: Helper.newDate(toDate),
			};
		}

		const collection = this.db.collection(Tables.ORDERS);
		asyncParallel({
			include_customers: (callback) => {
				/** Get customer ids  */
				let tmpOrderCondition = clone(orderConditions);
				if (reportType == Constants.BUYERS_CRAVEZ_DELIVERY) tmpOrderCondition.delivery_type = Constants.DELIVERY_BY_CRAVEZ;
				if (reportType == Constants.BUYERS_RESTRAUNT_DELIVERY) tmpOrderCondition.delivery_type = Constants.DELIVERY_BY_RESTAURANT;
				if (reportType == Constants.FREE_DELIVERY_CUSTOMERS) {
					tmpOrderCondition.delivery_fee = { $eq: 0 };
					tmpOrderCondition.delivery_type = { $ne: Constants.DELIVERY_BY_PICK_UP };
				}
				collection.distinct("customer_id", tmpOrderCondition).then(orderIds=>{
					callback(null, orderIds);
				}).catch(err=>{
					callback(err, []);
				});
			},
			exclude_customers: (callback) => {
				if (reportType == Constants.SINGLE_REST_CUSTOMERS) return callback(null, []);
				/** Get customer ids  */
				let tmpOrderCondition = clone(orderConditions);
				if (reportType == Constants.BUYERS_CRAVEZ_DELIVERY) tmpOrderCondition.delivery_type = Constants.DELIVERY_BY_RESTAURANT;
				if (reportType == Constants.BUYERS_RESTRAUNT_DELIVERY) tmpOrderCondition.delivery_type = Constants.DELIVERY_BY_CRAVEZ;
				if (reportType == Constants.FREE_DELIVERY_CUSTOMERS) {
					tmpOrderCondition.delivery_fee = { $gte: 1 };
					tmpOrderCondition.delivery_type = { $ne: Constants.DELIVERY_BY_PICK_UP };
				}
				collection.distinct("customer_id", tmpOrderCondition).then(orderIds=>{
					callback(null, orderIds);
				}).catch(err=>{
					callback(err, []);
				});
			},
		}, (asyncErr, asyncResponse) => {
			if (asyncErr) return next(asyncErr);

			let includeCustomers = asyncResponse.include_customers;
			let excludeCustomers = asyncResponse.exclude_customers;

			let commonConditions = {
				$and		: [
					{customer_id : { $in : Helper.arrayToObject(includeCustomers)}},
					{customer_id : { $nin: Helper.arrayToObject(excludeCustomers)}}
				],
				admin_status: Constants.ORDER_DELIVERED
			};
			if (fromDate != "" && toDate != "") {
				commonConditions["order_date"] = {
					$gte 	: Helper.newDate(fromDate),
					$lte 	: Helper.newDate(toDate),
				};
			}
			let aggregatePipeline = [
				{ $match: commonConditions},
				{$sort 	: {order_date : Constants.SORT_DESC}},
				{$group : {
					_id				: "$customer_id",
					customer_id		: { $first: "$customer_id" },
					full_name		: { $first: "$full_name" },
					mobile_number	: { $first: "$mobile_number" },
					order_count		: { $sum: 1 },
				}},
				{$sort 	: sortConditions},
			];

			if (reportType == Constants.SINGLE_REST_CUSTOMERS){
				aggregatePipeline = [
					{ $match: commonConditions},
					{$sort 	: {order_date : Constants.SORT_DESC}},
					{$group : {
						_id				: "$customer_id",
						full_name 		: {$first : "$full_name"},
						mobile_number  	: {$first : "$mobile_number"},
						order_count		: {$sum : 1},
						restaurants		: {$addToSet : "$restaurant_id"}
					}},
					{ $match: {
						$expr: {$eq: [{$size: "$restaurants"}, 1]}
					}},
					{$sort 	: sortConditions},
				];
			}

			collection.aggregate(aggregatePipeline).toArray().then(findResult=>{

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
							(records.full_name) 	? records.full_name  :"",
							(records.mobile_number) ? records.mobile_number  :"",
							(records.order_count)	? records.order_count :"",
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				Helper.exportToExcel(req,res,{
					file_prefix 		: "customReportsExport",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		});
	};// end customReportsExport()
}