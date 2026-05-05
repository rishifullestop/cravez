import { ObjectId } from 'mongodb';
import {parallel as asyncParallel} from 'async';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import * as Helper  from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

export default class ManualWalletRefundReport {
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
	async getManualWalletRefundList (req,res,next){
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
		Helper.getDropdownList(req,res, next,options).then(dropDownResponse=> {
			/** Send error response **/
			if(dropDownResponse.status != Constants.STATUS_SUCCESS){
				req.flash(Constants.STATUS_ERROR,dropDownResponse.message);
				return res.redirect(Constants.WEBSITE_ADMIN_URL+"dashboard");
			}

			/** render manual wallet refund report listing page **/
			req.breadcrumbs(BREADCRUMBS['admin/report/manual_wallet_refund_report']);
			res.render('manual_wallet_refund_report',{
				restaurant_list	: dropDownResponse.final_html_data["0"]
			});
		}).catch(next);
	};//End getManualWalletRefundList()

	/**
	 * Function to get manual wallet refund report list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async appendManualWalletRefundList (req,res,next){
		let fromDate     = 	(req.params.from_date) 		? req.params.from_date 				:"";
		let toDate 	  	 = 	(req.params.to_date)   		? req.params.to_date   				:"";
		let restaurantId = 	(req.params.restaurant_id)  ? new ObjectId(req.params.restaurant_id):"";
		let branchId	 = (req.params.branch_id)		? new ObjectId(req.params.branch_id)  	:"";

		if(Helper.isPost(req)){
			let limit 		 = 	(req.body.length) ? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
			let skip  		 = 	(req.body.start)  ? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
			const collection = 	this.db.collection(Tables.ORDERS);

			/** Configure Datatable conditions*/
			const dataTableConfig = await Helper.configDatatable(req, res, null);

			/** Set condition */
			let commonConditions = { refund_type : {$exists : true}};

			/** Condition for order date */
			if (fromDate != "" && toDate != "") {
				commonConditions["order_date"] = {
					$gte 	: Helper.newDate(fromDate),
					$lte 	: Helper.newDate(toDate),
				};
			}

			/** Add restaurant conditions  */
			if(restaurantId) commonConditions.restaurant_id = restaurantId;

			/** Add branch conditions  */
			if(branchId) commonConditions.branch_id = branchId;

			dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

			asyncParallel({
				refund_list :(callback)=>{
					/** Get list of manual wallet refund **/
					collection.aggregate([
						{$match : dataTableConfig.conditions},
						{$skip 	: skip},
						{$limit : limit},
						{$lookup:	{ /** Get customer details **/
							"from" 			: 	Tables.USERS,
							"localField" 	:	"customer_id",
							"foreignField" 	: 	"_id",
							"as" 			: 	"customer_detail"
						}},
						{$addFields : {
							user_name: {$arrayElemAt: ["$customer_detail.full_name",0]},
							user_email: {$arrayElemAt: ["$customer_detail.email",0]},
							user_mobile_number: {$arrayElemAt: ["$customer_detail.mobile_number",0]}
						}},
						{$group: {
							_id: {
								customer_id : "$customer_id"
							},
							user_name 			: {$first : "$user_name"},
							user_email  		: {$first : "$user_email"},
							user_mobile_number  : {$first : "$user_mobile_number"},
							refund_amount 		: {$sum   : "$refund_amount"},
							customer_id 		: {$first : "$customer_id"}
						}},
						{ $sort: { refund_amount: Constants.SORT_DESC } },
					]).toArray().then(result=>{
						callback(null, result);
					}).catch(err=>{
						callback(err, []);
					});
				},
				records_filtered: (callback)=>{
					/** Get filtered records counting in orders collection   **/
					collection.distinct("customer_id",dataTableConfig.conditions).then(customerIds=>{
						callback(null, customerIds?.length || 0);
					}).catch(err=>{
						callback(err, 0);
					});
				}
			},(err, response)=>{
				/** Send response **/
				res.send({
					status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
					draw			: dataTableConfig.result_draw,
					data			: response.refund_list,
					recordsFiltered	: response.records_filtered,
					recordsTotal	: response.records_filtered,
				});
			});
		}else{
			res.render('manual_wallet_refund',{
				layout 		  : false,
				from_date 	  : fromDate,
				to_date 	  : toDate,
				restaurant_id : restaurantId,
				branch_id     : branchId
			});
		}
	};//End appendManualWalletRefundList()

	/**
	 *  Function for export manual wallet refund report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async manualWalletRefundExportData (req,res,next){
		let tmpFromDate  = (req.params.from_date) 	  ? (req.params.from_date) 			   : "";
		let tmpToDate 	 = (req.params.to_date)   	  ? (req.params.to_date)   			   : "";
		let restaurantId = (req.params.restaurant_id) ? new ObjectId(req.params.restaurant_id) : "";
		let branchId 	 = (req.params.branch_id)     ? new ObjectId(req.params.branch_id)     : "";
		let fromDate  	 = Helper.newDate(tmpFromDate+" "+START_DATE_TIME_FORMAT);
		let toDate 	  	 = Helper.newDate(tmpToDate+" "+END_DATE_TIME_FORMAT);

		/** Set conditions  */
		let commonConditions = {
			refund_type : {$exists : true},
			order_date  : {
				$gte : Helper.newDate(fromDate),
				$lte : Helper.newDate(toDate)
			}
		};

		/** Add restaurant conditions  */
		if(restaurantId) commonConditions.restaurant_id = restaurantId;

		/** Add branch conditions  */
		if(branchId) commonConditions.branch_id = branchId;

		/** Get manual wallet refund report details **/
		const orders = this.db.collection(Tables.ORDERS);
		orders.aggregate([
			{$match : commonConditions},
			{$lookup:	{ /** Get customer details **/
				"from" 			: 	Tables.USERS,
				"localField" 	:	"customer_id",
				"foreignField" 	: 	"_id",
				"as" 			: 	"customer_detail"
			}},
			{$addFields : {
				user_name: {$arrayElemAt: ["$customer_detail.full_name",0]},
				user_email: {$arrayElemAt: ["$customer_detail.email",0]},
				user_mobile_number: {$arrayElemAt: ["$customer_detail.mobile_number",0]}
			}},
			{$group: {
				_id: {
					customer_id : "$customer_id"
				},
				user_name 			: {$first : "$user_name"},
				user_email  		: {$first : "$user_email"},
				user_mobile_number  : {$first : "$user_mobile_number"},
				refund_amount 		: {$sum : "$refund_amount"}
			}},
			{ $sort: { refund_amount: Constants.SORT_DESC } },
		]).toArray().then(result=>{

			let temp		= [];
			let commonColls	= [];

			/** Define excel heading label **/
			commonColls		= 	[
				res.__("admin.report.user_name"),
				res.__("admin.report.user_email"),
				res.__("admin.report.user_mobile_number"),
				res.__("admin.report.refunded_amount")
			];

			if(result && result.length > 0){
				result.map(records=>{
					let buffer =	[
						(records.user_name)   		 ?  records.user_name  :"",
                        (records.user_email)  		 ?  records.user_email :"",
                        (records.user_mobile_number) ?  records.user_mobile_number            :"",
                        (records.refund_amount)      ?  Helper.currencyFormat(records.refund_amount) :""
					];
					temp.push(buffer);
				});
			}

			/**  Function to export data in excel format **/
			Helper.exportToExcel(req,res,{
				file_prefix 		: "ManualWalletRefundReport",
				heading_columns		: commonColls,
				export_data			: temp
			});
		}).catch(next);
	};// end manualWalletRefundExportData()
}
