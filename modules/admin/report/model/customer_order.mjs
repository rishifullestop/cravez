import { ObjectId } from 'mongodb';
import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList, newDate, exportToExcel, configDatatable, currencyFormat } from '../../../../utils/index.mjs';

// Model for customer order report
export default class CustomerOrder {
	constructor(db) {
		this.db = db;
	}


	/**
	 * Function to get customer order report list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getCustomerOrderReportList(req,res,next){
		try{
			if(isPost(req)){
				let limit		  	= 	(req.body.length) 	? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		  	= 	(req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate      	= 	(req.body.from_date) 	? req.body.from_date 		:"";
				let toDate 	  	  	= 	(req.body.to_date)   	? req.body.to_date   		:"";
				let branchId 	  	=	(req.body.branch_id)   	? new ObjectId(req.body.branch_id)   	:"";
				let restaurantId	= 	(req.body.restaurant_id)? new ObjectId(req.body.restaurant_id)  :"";
				const collection  	= 	this.db.collection(Tables.REPORTS_CUSTOMER_ORDERS);

				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);
				let commonConditions = {};

				/** Condition for date */
				if (fromDate != "" && toDate != "") {
					commonConditions["date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					};
				}

				/** Add branch conditions  */
				if(branchId) commonConditions.branch_id = branchId;

				/** Add restaurant conditions  */
				if(restaurantId) commonConditions.restaurant_id = restaurantId;

				asyncParallel({
					customer_order_list :(callback)=>{
						/** Get list of customer orders **/
						collection.aggregate([
							{$match: commonConditions},
							{$group: {
								_id: {
									customer_id : "$customer_id",
									date 		: "$date",
								},
								date 				: {$first 	: "$date"},
								customer_id 		: {$first 	: "$customer_id"},
								total_orders 		: {$sum 	: "$total_orders"},
								total_order_amount	: {$sum 	: "$total_order_amount"},
							}},
							{$lookup:	{
								"from" 			: 	Tables.USERS,
								"localField" 	:	"customer_id",
								"foreignField" 	: 	"_id",
								"as" 			: 	"customer_detail"
							}},
							{$project :	{ _id:0,date:1,customer_id:1,total_orders:1,total_order_amount:1,customer_name: {$arrayElemAt: ["$customer_detail.full_name",0]} }},
							{$match : dataTableConfig.conditions},
							{$sort 	: dataTableConfig.sort_conditions},
							{$skip 	: skip},
							{$limit : limit},
						]).toArray().then(result=>{
							callback(null, result);
						}).catch(next);
					},
					total_records:(callback)=>{
						/** Get total number of records in customer orders collection **/
						collection.aggregate([
							{$match: commonConditions},
							{$group:{
								_id: {
									customer_id : "$customer_id",
									date 		: "$date",
								}
							}},
							{$count : "count"},
						]).toArray().then(countResult=>{
							countResult = (countResult && countResult[0] && countResult[0].count)	?	countResult[0].count :0;
							callback(null, countResult);
						}).catch(next);
					},
					filter_records:(callback)=>{
						/** Get filtered records counting in customer orders**/
						collection.aggregate([
							{$match: commonConditions},
							{$group:{
								_id: {
									customer_id : "$customer_id",
									date 		: "$date",
								},
								date 				: {$first 	: "$date"},
								customer_id 		: {$first 	: "$customer_id"},
								total_orders 		: {$sum 	: "$total_orders"},
								total_order_amount	: {$sum 	: "$total_order_amount"},
							}},
							{$lookup:	{
								"from" 			: 	Tables.USERS,
								"localField" 	:	"customer_id",
								"foreignField" 	: 	"_id",
								"as" 			: 	"customer_detail"
							}},
							{$project :	{_id:0,date:1,customer_id:1,total_orders:1,total_order_amount:1,customer_name: {$arrayElemAt: ["$customer_detail.full_name",0]} }},
							{$match	: dataTableConfig.conditions},
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
						data			: (response.customer_order_list) ? response.customer_order_list :[],
						recordsFiltered	: (response.filter_records)     ? response.filter_records 	  :0,
						recordsTotal	: (response.total_records)      ? response.total_records      :0
					});
				});
			}else{
				/** Set dropdown options **/
				let options = {
					collections :[
						{
							collection : Tables.RESTAURANTS,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions : {							
								is_deleted	: Constants.NOT_DELETED
							},
						}
					],
				};

				/**Get dropdown list **/
				getDropdownList(req,res, next,options).then(dropDownResponse=> {
					
					/** render customer order report listing page **/
					req.breadcrumbs(BREADCRUMBS['admin/report/customer_order_list']);
					res.render('customer_order_list',{
						restaurant_list	: dropDownResponse?.final_html_data?.[0] || "",
					});
				}).catch(next);
			}
		}catch(error){
			return next(error);
		}
	};//End getCustomerOrderReportList()

	/**
	 * Function for get branch list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async branchList(req,res,next){
		try{
			let restaurantId = req.body.restaurant_id;

			/** Send error response */
			if(!restaurantId ) return res.send({status: Constants.STATUS_ERROR, message :res.__("admin.system.something_going_wrong_please_try_again") });

			/** Set options **/
			let options = {
				collections :[
					{
					collection : Tables.RESTAURANT_BRANCHES,
						columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
						conditions : {
							restaurant_id : new ObjectId(restaurantId),
							is_active	  : Constants.ACTIVE,
						},
					},
				]
			}

			/**Get branch list **/
			getDropdownList(req,res, next,options).then(dropDownResponse=> {
				if(dropDownResponse.status != Constants.STATUS_SUCCESS) return res.send({status: Constants.STATUS_ERROR, message :res.__("admin.system.something_going_wrong_please_try_again") });

				res.send({
					status       : Constants.STATUS_SUCCESS,
					branch_list  : dropDownResponse?.final_html_data?.[0] || ""
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
	};//End branchList()

	/**
	 *  Function for export customer order report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
   async customerOrderExportData(req,res,next){
		try{
			let fromDate 		= (req.query.from_date) ? req.query.from_date : "";
			let toDate 			= (req.query.to_date) ? req.query.to_date : "";
			let sortingField 	= (req.query.sort_field) ? req.query.sort_field : "_id";
			let sortingDir 		= (req.query.sort_dir) ? req.query.sort_dir : "asc";
			let sortOrder 		= (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;
			let branchId 		= (req.query.branch_id) ? (req.query.branch_id) : "";
			let restaurantId 	= (req.query.restaurant_id) ? (req.query.restaurant_id) : "";
			
			let commonConditions = {};
			/** Condition for date */
			if (fromDate != "" && toDate != "") {
				commonConditions["date"] = {
					$gte: newDate(fromDate),
					$lte: newDate(toDate),
				};
			}

			/** Add branch conditions  */
			if (branchId) commonConditions.branch_id = new ObjectId(branchId);

			/** Add restaurant conditions  */
			if (restaurantId) commonConditions.restaurant_id = new ObjectId(restaurantId);

			let sortConditions = {};
			sortConditions[sortingField] = sortOrder;

			/** Get customer order list **/
			const reports_customer_orders	= this.db.collection(Tables.REPORTS_CUSTOMER_ORDERS);
			reports_customer_orders.aggregate([
				{$match: commonConditions},
				{$group: {
					_id: {
						customer_id : "$customer_id",
						date 		: "$date",
					},
					date 				: {$first 	: "$date"},
					customer_id 		: {$first 	: "$customer_id"},
					total_orders 		: {$sum 	: "$total_orders"},
					total_order_amount	: {$sum 	: "$total_order_amount"},
				}},
				{$lookup:	{
					"from" 			: 	Tables.USERS,
					"localField" 	:	"customer_id",
					"foreignField" 	: 	"_id",
					"as" 			: 	"customer_detail"
				}},
				{$project :	{ _id:0,date:1,customer_id:1,total_orders:1,total_order_amount:1,customer_name: {$arrayElemAt: ["$customer_detail.full_name",0]} }},
				{$sort 	: sortConditions}
			]).toArray().then(result=>{

				let temp			= [];
				let commonColls		= [];

				/** Define excel heading label **/
				commonColls		= 	[
					res.__("admin.report.customer_name"),
					res.__("admin.report.total_orders"),
					res.__("admin.report.total_order_value"),
					res.__("admin.report.date")
				];

				if(result && result.length > 0){
					result.map(records=>{
						let buffer =	[
							(records.customer_name)		? 	records.customer_name 		:"",
							(records.total_orders)		? 	records.total_orders 		:"",
							(records.total_order_amount)? 	currencyFormat(records.total_order_amount)	:0,
							(records.date)				? 	newDate(records.date,Constants.DATE_FORMAT_EXPORT) 	:""
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "CustomerOrderReport",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
	};// end customerOrderExportData()
}
