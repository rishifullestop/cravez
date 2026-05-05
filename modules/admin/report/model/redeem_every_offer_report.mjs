import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, newDate, exportToExcel, configDatatable, currencyFormat } from '../../../../utils/index.mjs';

// Model for redeem every offer report
export default class RedeemEveryOfferReport {
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
    async getRedeemEveryOfferReport(req,res,next){
		try{
			if(isPost(req)){
				let limit		 = (req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 = (req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let userType     = (req.body.user_type)     ? req.body.user_type   	:"";
				let fromDate     = (req.body.from_date) 	? req.body.from_date 		: "";
				let toDate 	  	 = (req.body.to_date)   	? req.body.to_date   		: "";

				const order_details = this.db.collection(Tables.ORDER_DETAILS);

				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);
				/** Set common condition */
				let commonConditions = { offer_id: { $ne: null } };
				let conditions = {};
				if(fromDate != "" && toDate != "") {
					conditions["order_date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					};
				}
				let userConditions = {};
				if (userType == Constants.CLIENT_TYPE_GUEST){
					userConditions['is_guest'] = true;
				} else if (userType == Constants.CLIENT_TYPE_REGISTERED){
					userConditions["is_guest"] = null;
				}
				dataTableConfig.conditions	= Object.assign(dataTableConfig.conditions, commonConditions);
				let filterConditions = Object.assign(conditions, userConditions);
				asyncParallel({
					records :(callback)=>{
						/** Get list **/
						order_details.aggregate([
							{ $match: dataTableConfig.conditions},
							{
								$lookup: {
									"from"			: Tables.ORDERS,
									"localField"	: "order_id",
									"foreignField"	: "_id",
									"as"			: "order_details"
								}
							},
							{
								$addFields: {
									order_date		: { $arrayElemAt: ["$order_details.order_date", 0] },
									order_price		: { $arrayElemAt: ["$order_details.order_price", 0] },
									delivery_fee	: { $arrayElemAt: ["$order_details.delivery_fee", 0] },
									restaurant_id	: { $arrayElemAt: ["$order_details.restaurant_id", 0] },
									area_id			: { $arrayElemAt: ["$order_details.area_id", 0] },
									restaurant_name	: { $arrayElemAt: ["$order_details.restaurant_name", 0] },
									area_name		: { $arrayElemAt: ["$order_details.area_name", 0] },
									user_name		: { $arrayElemAt: ["$order_details.full_name", 0] },
									user_mobile		: { $arrayElemAt: ["$order_details.mobile_number", 0] },
								}
							},
							{
								$lookup: {
									"from"			: Tables.OFFERS,
									"localField"	: "offer_id",
									"foreignField"	: "_id",
									"as"			: "offer_details"
								}
							},
							{
								$addFields: {
									offer_code	: { $arrayElemAt: ["$offer_details.offer_code", 0] },
									title		: { $arrayElemAt: ["$offer_details.title", 0] },
								}
							},
							{
								$lookup: {
									"from"          : Tables.USERS,
									"localField"	: "customer_id",
									"foreignField"  : "_id",
									"as"            : "user_details"
								}
							},
							{
								$addFields: {
									is_guest    : { $arrayElemAt: ["$user_details.is_guest", 0] },
								}
							},
							{
								$project: {
									user_mobile:1,is_guest:1,user_name:1,title:1,offer_code:1,discount_price:1,area_name:1,restaurant_name:1,area_id:1,restaurant_id:1,delivery_fee:1,order_price:1,order_date:1,customer_address_detail: 1, delivery_duration: 1, delivery_in:1
								}
							},
							{ $match: filterConditions},
							{$sort 	: dataTableConfig.sort_conditions},
							{$skip 	: skip},
							{$limit : limit},
						]).toArray().then(result=>{
							callback(null, result);
						}).catch(next);
					},
					records_total: (callback)=>{
						/** Get total number of records **/
						order_details.aggregate([
							{ $match: { offer_id: { $ne: null }}},
							{
								$lookup: {
									"from"			: Tables.ORDERS,
									"localField"	: "order_id",
									"foreignField"	: "_id",
									"as"			: "order_details"
								}
							},
							{
								$addFields: {
									order_date: { $arrayElemAt: ["$order_details.order_date", 0] },
								}
							},
							{
								$project: {
									order_date: 1
								}
							},
							{
								$match: { order_date:{
									$gte: newDate(fromDate),
									$lte: newDate(toDate)}
								}
							},
						]).toArray().then(countResult=>{
							callback(null, countResult.length);
						}).catch(next);
					},
					records_filtered: (callback)=>{
						/** Get filtered records counting   **/
						order_details.aggregate([
							{ $match: commonConditions },
							{
								$lookup: {
									"from"			: Tables.ORDERS,
									"localField"	: "order_id",
									"foreignField"	: "_id",
									"as"			: "order_details"
								}
							},
							{
								$addFields: {
									order_date: { $arrayElemAt: ["$order_details.order_date", 0] },
								}
							},
							{
								$lookup: {
									"from"			: Tables.USERS,
									"localField"	: "customer_id",
									"foreignField"	: "_id",
									"as"			: "user_details"
								}
							},
							{
								$addFields: {
									is_guest: { $arrayElemAt: ["$user_details.is_guest", 0] },
								}
							},
							{
								$project: {
									order_date: 1, is_guest:1
								}
							},
							{ $match: filterConditions},
						]).toArray().then(countResult => {
							callback(null, countResult.length);
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
			}else{
				/** render report listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/report/redeem_every_offer_report']);
				res.render('redeem_every_offer_report');
			}
		}catch(error){
			return next(error);
		}
    };//End getRedeemEveryOfferReport()

	/**
	 *  Function for export Redeem Every Offer Report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async redeemEveryOfferReportExport(req,res,next){
		try{
			let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
			let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";
			let sortingField  	= (req.query.sort_field) ? req.query.sort_field   	: "_id";
			let sortingDir 	 	= (req.query.sort_dir) ? req.query.sort_dir   		: "asc";
			let sortOrder		= (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;
			let userType        = (req.query.user_type) ? req.query.user_type : "";


			let commonConditions = { offer_id: { $ne: null } };
			let conditions = {};
			if (fromDate != "" && toDate != "") {
				conditions["order_date"] = {
					$gte: newDate(fromDate),
					$lte: newDate(toDate),
				};
			}
			let userConditions = {};
			if (userType == Constants.CLIENT_TYPE_GUEST) {
				userConditions['is_guest'] = true;
			} else if (userType == Constants.CLIENT_TYPE_REGISTERED) {
				userConditions["is_guest"] = null;
			}
			let sortConditions			 = {};
			sortConditions[sortingField] = sortOrder;

			const order_details = this.db.collection(Tables.ORDER_DETAILS);
			let filterConditions = Object.assign(conditions, userConditions);
			order_details.aggregate([
				{ $match: commonConditions},
				{
					$lookup: {
						"from"			: Tables.ORDERS,
						"localField"	: "order_id",
						"foreignField"	: "_id",
						"as"			: "order_details"
					}
				},
				{
					$addFields: {
						order_date		: { $arrayElemAt: ["$order_details.order_date", 0] },
						order_price		: { $arrayElemAt: ["$order_details.order_price", 0] },
						delivery_fee	: { $arrayElemAt: ["$order_details.delivery_fee", 0] },
						restaurant_id	: { $arrayElemAt: ["$order_details.restaurant_id", 0] },
						area_id			: { $arrayElemAt: ["$order_details.area_id", 0] },
						restaurant_name	: { $arrayElemAt: ["$order_details.restaurant_name", 0] },
						area_name		: { $arrayElemAt: ["$order_details.area_name", 0] },
						user_name		: { $arrayElemAt: ["$order_details.full_name", 0] },
						user_mobile		: { $arrayElemAt: ["$order_details.mobile_number", 0] },
					}
				},
				{
					$lookup: {
						"from"			: Tables.OFFERS,
						"localField"	: "offer_id",
						"foreignField"	: "_id",
						"as"			: "offer_details"
					}
				},
				{
					$addFields: {
						offer_code	: { $arrayElemAt: ["$offer_details.offer_code", 0] },
						title		: { $arrayElemAt: ["$offer_details.title", 0] },
					}
				},
				{
					$lookup: {
						"from"			: Tables.USERS,
						"localField"	: "customer_id",
						"foreignField"	: "_id",
						"as"			: "user_details"
					}
				},
				{
					$addFields: {
						is_guest	: { $arrayElemAt: ["$user_details.is_guest", 0] },
					}
				},
				{
					$project: {
						user_mobile: 1, is_guest: 1, user_name: 1, title: 1, offer_code: 1, discount_price: 1, area_name: 1, restaurant_name: 1, area_id: 1, restaurant_id: 1, delivery_fee: 1, order_price: 1, order_date: 1, customer_address_detail: 1, delivery_duration: 1, delivery_in: 1
					}
				},
				{ $match: filterConditions },
				{$sort 	: sortConditions},
			]).toArray().then(findResult=>{

				let temp			= [];
				let commonColls		= [];

				/** Define excel heading label **/
				commonColls	= [
					res.__("admin.report.code"),
					res.__("admin.report.order_date"),
					res.__("admin.report.customer_name"),
					res.__("admin.report.customer_mobile"),
					res.__("admin.report.customer_area"),
					res.__("admin.report.order_value"),
					res.__("admin.report.delivery_fees"),
					res.__("admin.report.total_order_value"),
					res.__("admin.report.discount_by_code"),
					res.__("admin.report.applicable_offer"),
					res.__("admin.report.net_order_value"),
					res.__("admin.report.restaurant"),
					res.__("admin.report.restaurant_area"),
					res.__("admin.report.promise_delivery_time"),
					res.__("admin.report.actual_delivery_time"),
					res.__("admin.report.delay_early"),
				];

				if(findResult && findResult.length > 0){
					findResult.map(records=>{
						var deliveryFee = (records.delivery_fee) ? records.delivery_fee :0;
						var orderValue 	= (records.order_price) ? records.order_price:0;
						var totalvalue 	= deliveryFee+orderValue;
						var discount 	= (records.discount_price) ? records.discount_price :0;
						var netValue 	= totalvalue-discount;
						var promiseTime = (records.delivery_duration) ? records.delivery_duration :0;
						var actualTime 	= (records.delivery_in) ? records.delivery_in:0;
						var delayEarly 	= promiseTime-actualTime;
						let buffer =	[
							(records.offer_code) 	? records.offer_code  :"",
							(records.order_date)	? 	newDate(records.order_date,Constants.AM_PM_FORMAT_WITH_DATE) :"",
							(records.user_name) 	? records.user_name  :"",
							(records.user_mobile) 	? records.user_mobile : "",
							(records.customer_address_detail) ? records.customer_address_detail.area_name[Constants.DEFAULT_LANGUAGE_CODE] : "",
							(records.order_price) 	? currencyFormat(records.order_price) : currencyFormat(0),
							(records.delivery_fee) 	? currencyFormat(records.delivery_fee) : currencyFormat(0),
							currencyFormat(totalvalue),
							(records.discount_price)? currencyFormat(records.discount_price) : currencyFormat(0),
							(records.title) 		? records.title[Constants.DEFAULT_LANGUAGE_CODE] : "",
							currencyFormat(netValue),
							(records.restaurant_name) ? records.restaurant_name[Constants.DEFAULT_LANGUAGE_CODE] : "",
							(records.area_name) 	? records.area_name[Constants.DEFAULT_LANGUAGE_CODE] : "",
							(records.delivery_duration) ? records.delivery_duration : 0,
							(records.delivery_in) 	? records.delivery_in : 0,
							delayEarly
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "redeemEveryOfferExport",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
    };// end redeemEveryOfferReportExport()
}
