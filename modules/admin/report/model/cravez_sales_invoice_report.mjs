import { ObjectId } from 'mongodb';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,newDate, exportToExcel, currencyFormat, round } from '../../../../utils/index.mjs';

// Model for cravez sales invoice report
export default class CravezSalesInvoiceReport {
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
    async getCravezSalesInvoiceReportList(req,res,next){
		try{
			if(isPost(req)){
				let fromDate     	= (req.body.from_date) 		? req.body.from_date 		: "";
				let toDate 	  	 	= (req.body.to_date)   		? req.body.to_date   		: "";
				let restaurantIds	= (req.body.restaurant_ids) ? new ObjectId(req.body.restaurant_ids)  : "";

				const orders = 	this.db.collection(Tables.ORDERS);

				let commonConditions	= {
					restaurant_id:restaurantIds,
					$and: [
						{ payment_method: { $exists: true } }, 
						{ payment_method: { $ne: "" } }, 
						{ payment_method: { $ne: null } }, 
						{ delivery_type: { $exists: true } }, 
						{ delivery_type: { $ne: "" } }, 
						{ delivery_type: { $ne: null } }
					]
				};

				/** Condition for order date */
				if (fromDate != "" && toDate != "") {
					commonConditions["order_date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					};
				}

				orders.aggregate([
					{ $match: commonConditions },
					{
						$group: {
							_id: {
								payment_method: "$payment_method",
								delivery_type: "$delivery_type"
							},
							no_of_order		: { $sum: 1 },
							refund_no_of_order: {
								$sum: {
									$cond: [
										{
											$and: [
												{ $eq: ["$refund_amount_status", true] },
											]
										},
										1,
										0
									]
								}
							},
							payment_method	: { $first: "$payment_method" },
							delivery_type	: { $first: "$delivery_type" },
							sales_value     : { $sum: "$net_amount" },
							delivery_charges: { $sum: "$delivery_fee" },
							refund_order_value: {
								$sum: {
									$cond: [
										{
											$and: [
												{ $eq: ["$refund_amount_status", true] },
											]
										},
										"$net_amount",
										0
									]
								}
							},
							cravez_commission: { $sum: "$cravez_payout" },
							knet_charges: { $sum: "$knet_charges" },
						},
					},
					{ $sort:{created:Constants.SORT_DESC} },
				]).toArray().then(result => {
					let finalArray=[];
					let obj1 = {};
					let obj2 = {};
					let obj3 = {};
					let obj4 = {};
					let obj5 = {};
					let obj6 = {};
					let obj7 = {};
					let obj8 = {};
					let obj9 = {};
					let obj10 = {};
					let obj11 = {};
					if(result.length>0){
						result.map(record => {
							if (record._id.payment_method == Constants.CASH_PAYMENT && record._id.delivery_type == Constants.DELIVERY_BY_CRAVEZ) {
								obj1['crv_cash_orders'] = (record.no_of_order) ? record.no_of_order:0;
								obj2['crv_cash_refund_orders'] = (record.refund_no_of_order) ? record.refund_no_of_order : 0;
								obj3['crv_cash_sales_value'] = record.sales_value;
								obj4['crv_cash_delivery_charge'] = record.delivery_charges;
								obj5['crv_cash_refund_order_value'] = record.refund_order_value;
								obj6['crv_cash_cravez_commission'] = record.cravez_commission;
								obj7['crv_cash_knet_charges'] = record.knet_charges;
								obj8['crv_cash_net_orders'] = record.no_of_order + record.refund_no_of_order;
								obj9['crv_cash_net_value_sales'] = record.sales_value + record.delivery_charges + record.refund_order_value;
								obj10['crv_cash_net_amount_cravez'] = record.cravez_commission + record.delivery_charges + record.knet_charges;
								obj11['crv_cash_net_due_amount'] = (record.sales_value + record.delivery_charges + record.refund_order_value) - (record.cravez_commission + record.delivery_charges + record.knet_charges);
							} else if (record._id.payment_method == Constants.KNET && record._id.delivery_type == Constants.DELIVERY_BY_CRAVEZ) {
								obj1['crv_knet_orders'] = (record.no_of_order) ? record.no_of_order : 0;
								obj2['crv_knet_refund_orders'] = (record.refund_no_of_order) ? record.refund_no_of_order : 0;
								obj3['crv_knet_sales_value'] = record.sales_value;
								obj4['crv_knet_delivery_charge'] = record.delivery_charges;
								obj5['crv_knet_refund_order_value'] = record.refund_order_value;
								obj6['crv_knet_cravez_commission'] = record.cravez_commission;
								obj7['crv_knet_knet_charges'] = record.knet_charges;
								obj8['crv_knet_net_orders'] = record.no_of_order + record.refund_no_of_order;
								obj9['crv_knet_net_value_sales'] = record.sales_value + record.delivery_charges + record.refund_order_value;
								obj10['crv_knet_net_amount_cravez'] = record.cravez_commission + record.delivery_charges + record.knet_charges;
								obj11['crv_knet_net_due_amount'] = (record.sales_value + record.delivery_charges + record.refund_order_value) - (record.cravez_commission + record.delivery_charges + record.knet_charges);
							} else if (record._id.payment_method == Constants.CREDIT_PAYMENT && record._id.delivery_type == Constants.DELIVERY_BY_CRAVEZ) {
								obj1['crv_credit_orders'] = (record.no_of_order) ? record.no_of_order : 0;
								obj2['crv_credit_refund_orders'] = (record.refund_no_of_order) ? record.refund_no_of_order : 0;
								obj3['crv_credit_sales_value'] = record.sales_value;
								obj4['crv_credit_delivery_charge'] = record.delivery_charges;
								obj5['crv_credit_refund_order_value'] = record.refund_order_value;
								obj6['crv_credit_cravez_commission'] = record.cravez_commission;
								obj7['crv_credit_knet_charges'] = record.knet_charges;
								obj8['crv_credit_net_orders'] = record.no_of_order + record.refund_no_of_order;
								obj9['crv_credit_net_value_sales'] = record.sales_value + record.delivery_charges + record.refund_order_value;
								obj10['crv_credit_net_amount_cravez'] = record.cravez_commission + record.delivery_charges + record.knet_charges;
								obj11['crv_credit_net_due_amount'] = (record.sales_value + record.delivery_charges + record.refund_order_value) - (record.cravez_commission + record.delivery_charges + record.knet_charges);
							} else if (record._id.payment_method == Constants.CASH_PAYMENT && record._id.delivery_type == Constants.DELIVERY_BY_RESTAURANT) {
								obj1['res_cash_orders'] = (record.no_of_order) ? record.no_of_order : 0;
								obj2['res_cash_refund_orders'] = (record.refund_no_of_order) ? record.refund_no_of_order : 0;
								obj3['res_cash_sales_value'] = record.sales_value;
								obj4['res_cash_delivery_charge'] = record.delivery_charges;
								obj5['res_cash_refund_order_value'] = record.refund_order_value;
								obj6['res_cash_cravez_commission'] = record.cravez_commission;
								obj7['res_cash_knet_charges'] = record.knet_charges;
								obj8['res_cash_net_orders'] = record.no_of_order + record.refund_no_of_order;
								obj9['res_cash_net_value_sales'] = record.sales_value + record.delivery_charges + record.refund_order_value;
								obj10['res_cash_net_amount_cravez'] = record.cravez_commission + record.delivery_charges + record.knet_charges;
								obj11['res_cash_net_due_amount'] = (0) - (record.cravez_commission + record.delivery_charges + record.knet_charges);
							} else if (record._id.payment_method == Constants.KNET && record._id.delivery_type == Constants.DELIVERY_BY_RESTAURANT) {
								obj1['res_knet_orders'] = (record.no_of_order) ? record.no_of_order : 0;
								obj2['res_knet_refund_orders'] = (record.refund_no_of_order) ? record.refund_no_of_order : 0;
								obj3['res_knet_sales_value'] = record.sales_value;
								obj4['res_knet_delivery_charge'] = record.delivery_charges;
								obj5['res_knet_refund_order_value'] = record.refund_order_value;
								obj6['res_knet_cravez_commission'] = record.cravez_commission;
								obj7['res_knet_knet_charges'] = record.knet_charges;
								obj8['res_knet_net_orders'] = record.no_of_order + record.refund_no_of_order;
								obj9['res_knet_net_value_sales'] = record.sales_value + record.delivery_charges + record.refund_order_value;
								obj10['res_knet_net_amount_cravez'] = record.cravez_commission + record.delivery_charges + record.knet_charges;
								obj11['res_knet_net_due_amount'] = (record.sales_value + record.delivery_charges + record.refund_order_value) - (record.cravez_commission + record.delivery_charges + record.knet_charges);
							} else if (record._id.payment_method == Constants.CREDIT_PAYMENT && record._id.delivery_type == Constants.DELIVERY_BY_RESTAURANT) {
								obj1['res_credit_orders'] = (record.no_of_order) ? record.no_of_order : 0;
								obj2['res_credit_refund_orders'] = (record.refund_no_of_order) ? record.refund_no_of_order : 0;
								obj3['res_credit_sales_value'] = record.sales_value;
								obj4['res_credit_delivery_charge'] = record.delivery_charges;
								obj5['res_credit_refund_order_value'] = record.refund_order_value;
								obj6['res_credit_cravez_commission'] = record.cravez_commission;
								obj7['res_credit_knet_charges'] = record.knet_charges;
								obj8['res_credit_net_orders'] = record.no_of_order + record.refund_no_of_order;
								obj9['res_credit_net_value_sales'] = record.sales_value + record.delivery_charges + record.refund_order_value;
								obj10['res_credit_net_amount_cravez'] = record.cravez_commission + record.delivery_charges + record.knet_charges;
								obj11['res_credit_net_due_amount'] = (record.sales_value + record.delivery_charges + record.refund_order_value) - (record.cravez_commission + record.delivery_charges + record.knet_charges);
							} else if (record._id.payment_method == Constants.CASH_PAYMENT && record._id.delivery_type == Constants.DELIVERY_BY_PICK_UP) {
								obj1['pck_cash_orders'] = (record.no_of_order) ? record.no_of_order : 0;
								obj2['pck_cash_refund_orders'] = (record.refund_no_of_order) ? record.refund_no_of_order : 0;
								obj3['pck_cash_sales_value'] = record.sales_value;
								obj4['pck_cash_delivery_charge'] = record.delivery_charges;
								obj5['pck_cash_refund_order_value'] = record.refund_order_value;
								obj6['pck_cash_cravez_commission'] = record.cravez_commission;
								obj7['pck_cash_knet_charges'] = record.knet_charges;
								obj8['pck_cash_net_orders'] = record.no_of_order + record.refund_no_of_order;
								obj9['pck_cash_net_value_sales'] = record.sales_value + record.delivery_charges + record.refund_order_value;
								obj10['pck_cash_net_amount_cravez'] = record.cravez_commission + record.delivery_charges + record.knet_charges;
								obj11['pck_cash_net_due_amount'] = (0) - (record.cravez_commission + record.delivery_charges + record.knet_charges);
							} else if (record._id.payment_method == Constants.KNET && record._id.delivery_type == Constants.DELIVERY_BY_PICK_UP) {
								obj1['pck_knet_orders'] = (record.no_of_order) ? record.no_of_order : 0;
								obj2['pck_knet_refund_orders'] = (record.refund_no_of_order) ? record.refund_no_of_order : 0;
								obj3['pck_knet_sales_value'] = record.sales_value;
								obj4['pck_knet_delivery_charge'] = record.delivery_charges;
								obj5['pck_knet_refund_order_value'] = record.refund_order_value;
								obj6['pck_knet_cravez_commission'] = record.cravez_commission;
								obj7['pck_knet_knet_charges'] = record.knet_charges;
								obj8['pck_knet_net_orders'] = record.no_of_order + record.refund_no_of_order;
								obj9['pck_knet_net_value_sales'] = record.sales_value + record.delivery_charges + record.refund_order_value;
								obj10['pck_knet_net_amount_cravez'] = record.cravez_commission + record.delivery_charges + record.knet_charges;
								obj11['pck_knet_net_due_amount'] = (record.sales_value + record.delivery_charges + record.refund_order_value) - (record.cravez_commission + record.delivery_charges + record.knet_charges);
							} else if (record._id.payment_method == Constants.CREDIT_PAYMENT && record._id.delivery_type == Constants.DELIVERY_BY_PICK_UP) {
								obj1['pck_credit_orders'] = (record.no_of_order) ? record.no_of_order : 0;
								obj2['pck_credit_refund_orders'] = (record.refund_no_of_order) ? record.refund_no_of_order:0;
								obj3['pck_credit_sales_value'] = record.sales_value;
								obj4['pck_credit_delivery_charge'] = record.delivery_charges;
								obj5['pck_credit_refund_order_value'] = record.refund_order_value;
								obj6['pck_credit_cravez_commission'] = record.cravez_commission;
								obj7['pck_credit_knet_charges'] = record.knet_charges;
								obj8['pck_credit_net_orders'] = record.no_of_order + record.refund_no_of_order;
								obj9['pck_credit_net_value_sales'] = record.sales_value + record.delivery_charges + record.refund_order_value;
								obj10['pck_credit_net_amount_cravez'] = record.cravez_commission + record.delivery_charges + record.knet_charges;
								obj11['pck_credit_net_due_amount'] = (record.sales_value + record.delivery_charges + record.refund_order_value) - (record.cravez_commission + record.delivery_charges + record.knet_charges);
							}
						});
						finalArray.push(obj1);
						finalArray.push(obj2);
						finalArray.push(obj3);
						finalArray.push(obj4);
						finalArray.push(obj5);
						finalArray.push(obj6);
						finalArray.push(obj7);
						finalArray.push(obj8);
						finalArray.push(obj9);
						finalArray.push(obj10);
						finalArray.push(obj11);
						finalArray.map(obj => {
							let total = 0;
							for (let key in obj) {
								if (!isNaN(obj[key])) {
									total += obj[key];
								}
							}
							obj.total = round(total);
						});
					}
					/** Send response **/
					res.send({
						status  : Constants.STATUS_SUCCESS,
						data: finalArray,
					});
				}).catch(next);
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
						},
					]
				};

				/**Get dropdown list **/
				getDropdownList(req,res, next,options).then(response=> {
					/** render listing page **/
					req.breadcrumbs(BREADCRUMBS['admin/report/cravez_sales_invoice_report']);
					res.render('cravez_sales_invoice_report',{
						restaurant_list : response?.final_html_data?.["0"] || "",
					});
				});
			}
		} catch (error) {
			return next(error);
		}
    }//End getCravezSalesInvoiceReportList()


	/**
	 *  Function for export cravez sales invoice report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async cravezSalesInvoiceReportExport(req,res,next){
		try{
			let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
			let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";

			let restaurantIds = (req.query.restaurant_ids) ? new ObjectId(req.query.restaurant_ids) : "";

			let commonConditions = {
				restaurant_id: restaurantIds,
				$and: [{ payment_method: { $exists: true } }, { payment_method: { $ne: "" } }, { payment_method: { $ne: null } }, { delivery_type: { $exists: true } }, { delivery_type: { $ne: "" } }, { delivery_type: { $ne: null } }]
			};
			const orders = this.db.collection(Tables.ORDERS);
			/** Condition for order date */
			if (fromDate != "" && toDate != "") {
				commonConditions["order_date"] = {
					$gte: newDate(fromDate),
					$lte: newDate(toDate),
				};
			}

			orders.aggregate([
				{ $match: commonConditions },
				{
					$group: {
						_id: {
							payment_method: "$payment_method",
							delivery_type: "$delivery_type"
						},
						no_of_order: { $sum: 1 },
						refund_no_of_order: {
							$sum: {
								$cond: [
									{
										$and: [
											{ $eq: ["$refund_amount_status", true] },
										]
									},
									1,
									0
								]
							}
						},
						payment_method: { $first: "$payment_method" },
						delivery_type: { $first: "$delivery_type" },
						sales_value: { $sum: "$net_amount" },
						delivery_charges: { $sum: "$delivery_fee" },
						refund_order_value: {
							$sum: {
								$cond: [
									{
										$and: [
											{ $eq: ["$refund_amount_status", true] },
										]
									},
									"$net_amount",
									0
								]
							}
						},
						cravez_commission: { $sum: "$cravez_payout" },
						knet_charges: { $sum: "$knet_charges" },
					},
				},
				{ $sort: { created: Constants.SORT_DESC } },
			]).toArray().then(result => {
				let finalArray = [];
				let obj1 = {};
				let obj2 = {};
				let obj3 = {};
				let obj4 = {};
				let obj5 = {};
				let obj6 = {};
				let obj7 = {};
				let obj8 = {};
				let obj9 = {};
				let obj10 = {};
				let obj11 = {};
				if (result.length > 0) {
					result.map(record => {
						if (record._id.payment_method == Constants.CASH_PAYMENT && record._id.delivery_type == Constants.DELIVERY_BY_CRAVEZ) {
							obj1['crv_cash_orders'] = (record.no_of_order) ? record.no_of_order : 0;
							obj2['crv_cash_refund_orders'] = (record.refund_no_of_order) ? record.refund_no_of_order : 0;
							obj3['crv_cash_sales_value'] = record.sales_value;
							obj4['crv_cash_delivery_charge'] = record.delivery_charges;
							obj5['crv_cash_refund_order_value'] = record.refund_order_value;
							obj6['crv_cash_cravez_commission'] = record.cravez_commission;
							obj7['crv_cash_knet_charges'] = record.knet_charges;
							obj8['crv_cash_net_orders'] = record.no_of_order + record.refund_no_of_order;
							obj9['crv_cash_net_value_sales'] = record.sales_value + record.delivery_charges + record.refund_order_value;
							obj10['crv_cash_net_amount_cravez'] = record.cravez_commission + record.delivery_charges + record.knet_charges;
							obj11['crv_cash_net_due_amount'] = (record.sales_value + record.delivery_charges + record.refund_order_value) - (record.cravez_commission + record.delivery_charges + record.knet_charges);
						} else if (record._id.payment_method == Constants.KNET && record._id.delivery_type == Constants.DELIVERY_BY_CRAVEZ) {
							obj1['crv_knet_orders'] = (record.no_of_order) ? record.no_of_order : 0;
							obj2['crv_knet_refund_orders'] = (record.refund_no_of_order) ? record.refund_no_of_order : 0;
							obj3['crv_knet_sales_value'] = record.sales_value;
							obj4['crv_knet_delivery_charge'] = record.delivery_charges;
							obj5['crv_knet_refund_order_value'] = record.refund_order_value;
							obj6['crv_knet_cravez_commission'] = record.cravez_commission;
							obj7['crv_knet_knet_charges'] = record.knet_charges;
							obj8['crv_knet_net_orders'] = record.no_of_order + record.refund_no_of_order;
							obj9['crv_knet_net_value_sales'] = record.sales_value + record.delivery_charges + record.refund_order_value;
							obj10['crv_knet_net_amount_cravez'] = record.cravez_commission + record.delivery_charges + record.knet_charges;
							obj11['crv_knet_net_due_amount'] = (record.sales_value + record.delivery_charges + record.refund_order_value) - (record.cravez_commission + record.delivery_charges + record.knet_charges);
						} else if (record._id.payment_method == Constants.CREDIT_PAYMENT && record._id.delivery_type == Constants.DELIVERY_BY_CRAVEZ) {
							obj1['crv_credit_orders'] = (record.no_of_order) ? record.no_of_order : 0;
							obj2['crv_credit_refund_orders'] = (record.refund_no_of_order) ? record.refund_no_of_order : 0;
							obj3['crv_credit_sales_value'] = record.sales_value;
							obj4['crv_credit_delivery_charge'] = record.delivery_charges;
							obj5['crv_credit_refund_order_value'] = record.refund_order_value;
							obj6['crv_credit_cravez_commission'] = record.cravez_commission;
							obj7['crv_credit_knet_charges'] = record.knet_charges;
							obj8['crv_credit_net_orders'] = record.no_of_order + record.refund_no_of_order;
							obj9['crv_credit_net_value_sales'] = record.sales_value + record.delivery_charges + record.refund_order_value;
							obj10['crv_credit_net_amount_cravez'] = record.cravez_commission + record.delivery_charges + record.knet_charges;
							obj11['crv_credit_net_due_amount'] = (record.sales_value + record.delivery_charges + record.refund_order_value) - (record.cravez_commission + record.delivery_charges + record.knet_charges);
						} else if (record._id.payment_method == Constants.CASH_PAYMENT && record._id.delivery_type == Constants.DELIVERY_BY_RESTAURANT) {
							obj1['res_cash_orders'] = (record.no_of_order) ? record.no_of_order : 0;
							obj2['res_cash_refund_orders'] = (record.refund_no_of_order) ? record.refund_no_of_order : 0;
							obj3['res_cash_sales_value'] = record.sales_value;
							obj4['res_cash_delivery_charge'] = record.delivery_charges;
							obj5['res_cash_refund_order_value'] = record.refund_order_value;
							obj6['res_cash_cravez_commission'] = record.cravez_commission;
							obj7['res_cash_knet_charges'] = record.knet_charges;
							obj8['res_cash_net_orders'] = record.no_of_order + record.refund_no_of_order;
							obj9['res_cash_net_value_sales'] = record.sales_value + record.delivery_charges + record.refund_order_value;
							obj10['res_cash_net_amount_cravez'] = record.cravez_commission + record.delivery_charges + record.knet_charges;
							obj11['res_cash_net_due_amount'] = (0) - (record.cravez_commission + record.delivery_charges + record.knet_charges);
						} else if (record._id.payment_method == Constants.KNET && record._id.delivery_type == Constants.DELIVERY_BY_RESTAURANT) {
							obj1['res_knet_orders'] = (record.no_of_order) ? record.no_of_order : 0;
							obj2['res_knet_refund_orders'] = (record.refund_no_of_order) ? record.refund_no_of_order : 0;
							obj3['res_knet_sales_value'] = record.sales_value;
							obj4['res_knet_delivery_charge'] = record.delivery_charges;
							obj5['res_knet_refund_order_value'] = record.refund_order_value;
							obj6['res_knet_cravez_commission'] = record.cravez_commission;
							obj7['res_knet_knet_charges'] = record.knet_charges;
							obj8['res_knet_net_orders'] = record.no_of_order + record.refund_no_of_order;
							obj9['res_knet_net_value_sales'] = record.sales_value + record.delivery_charges + record.refund_order_value;
							obj10['res_knet_net_amount_cravez'] = record.cravez_commission + record.delivery_charges + record.knet_charges;
							obj11['res_knet_net_due_amount'] = (record.sales_value + record.delivery_charges + record.refund_order_value) - (record.cravez_commission + record.delivery_charges + record.knet_charges);
						} else if (record._id.payment_method == Constants.CREDIT_PAYMENT && record._id.delivery_type == Constants.DELIVERY_BY_RESTAURANT) {
							obj1['res_credit_orders'] = (record.no_of_order) ? record.no_of_order : 0;
							obj2['res_credit_refund_orders'] = (record.refund_no_of_order) ? record.refund_no_of_order : 0;
							obj3['res_credit_sales_value'] = record.sales_value;
							obj4['res_credit_delivery_charge'] = record.delivery_charges;
							obj5['res_credit_refund_order_value'] = record.refund_order_value;
							obj6['res_credit_cravez_commission'] = record.cravez_commission;
							obj7['res_credit_knet_charges'] = record.knet_charges;
							obj8['res_credit_net_orders'] = record.no_of_order + record.refund_no_of_order;
							obj9['res_credit_net_value_sales'] = record.sales_value + record.delivery_charges + record.refund_order_value;
							obj10['res_credit_net_amount_cravez'] = record.cravez_commission + record.delivery_charges + record.knet_charges;
							obj11['res_credit_net_due_amount'] = (record.sales_value + record.delivery_charges + record.refund_order_value) - (record.cravez_commission + record.delivery_charges + record.knet_charges);
						} else if (record._id.payment_method == Constants.CASH_PAYMENT && record._id.delivery_type == Constants.DELIVERY_BY_PICK_UP) {
							obj1['pck_cash_orders'] = (record.no_of_order) ? record.no_of_order : 0;
							obj2['pck_cash_refund_orders'] = (record.refund_no_of_order) ? record.refund_no_of_order : 0;
							obj3['pck_cash_sales_value'] = record.sales_value;
							obj4['pck_cash_delivery_charge'] = record.delivery_charges;
							obj5['pck_cash_refund_order_value'] = record.refund_order_value;
							obj6['pck_cash_cravez_commission'] = record.cravez_commission;
							obj7['pck_cash_knet_charges'] = record.knet_charges;
							obj8['pck_cash_net_orders'] = record.no_of_order + record.refund_no_of_order;
							obj9['pck_cash_net_value_sales'] = record.sales_value + record.delivery_charges + record.refund_order_value;
							obj10['pck_cash_net_amount_cravez'] = record.cravez_commission + record.delivery_charges + record.knet_charges;
							obj11['pck_cash_net_due_amount'] = (0) - (record.cravez_commission + record.delivery_charges + record.knet_charges);
						} else if (record._id.payment_method == Constants.KNET && record._id.delivery_type == Constants.DELIVERY_BY_PICK_UP) {
							obj1['pck_knet_orders'] = (record.no_of_order) ? record.no_of_order : 0;
							obj2['pck_knet_refund_orders'] = (record.refund_no_of_order) ? record.refund_no_of_order : 0;
							obj3['pck_knet_sales_value'] = record.sales_value;
							obj4['pck_knet_delivery_charge'] = record.delivery_charges;
							obj5['pck_knet_refund_order_value'] = record.refund_order_value;
							obj6['pck_knet_cravez_commission'] = record.cravez_commission;
							obj7['pck_knet_knet_charges'] = record.knet_charges;
							obj8['pck_knet_net_orders'] = record.no_of_order + record.refund_no_of_order;
							obj9['pck_knet_net_value_sales'] = record.sales_value + record.delivery_charges + record.refund_order_value;
							obj10['pck_knet_net_amount_cravez'] = record.cravez_commission + record.delivery_charges + record.knet_charges;
							obj11['pck_knet_net_due_amount'] = (record.sales_value + record.delivery_charges + record.refund_order_value) - (record.cravez_commission + record.delivery_charges + record.knet_charges);
						} else if (record._id.payment_method == Constants.CREDIT_PAYMENT && record._id.delivery_type == Constants.DELIVERY_BY_PICK_UP) {
							obj1['pck_credit_orders'] = (record.no_of_order) ? record.no_of_order : 0;
							obj2['pck_credit_refund_orders'] = (record.refund_no_of_order) ? record.refund_no_of_order : 0;
							obj3['pck_credit_sales_value'] = record.sales_value;
							obj4['pck_credit_delivery_charge'] = record.delivery_charges;
							obj5['pck_credit_refund_order_value'] = record.refund_order_value;
							obj6['pck_credit_cravez_commission'] = record.cravez_commission;
							obj7['pck_credit_knet_charges'] = record.knet_charges;
							obj8['pck_credit_net_orders'] = record.no_of_order + record.refund_no_of_order;
							obj9['pck_credit_net_value_sales'] = record.sales_value + record.delivery_charges + record.refund_order_value;
							obj10['pck_credit_net_amount_cravez'] = record.cravez_commission + record.delivery_charges + record.knet_charges;
							obj11['pck_credit_net_due_amount'] = (record.sales_value + record.delivery_charges + record.refund_order_value) - (record.cravez_commission + record.delivery_charges + record.knet_charges);
						}
					});
					finalArray.push(obj1);
					finalArray.push(obj2);
					finalArray.push(obj3);
					finalArray.push(obj4);
					finalArray.push(obj5);
					finalArray.push(obj6);
					finalArray.push(obj7);
					finalArray.push(obj8);
					finalArray.push(obj9);
					finalArray.push(obj10);
					finalArray.push(obj11);
					finalArray.map(obj => {
						let total = 0;
						for (let key in obj) {
							if (!isNaN(obj[key])) {
								total += obj[key];
							}
						}
						obj.total = round(total);
					});
				}

				let temp			= [];
				let commonColls		= [];

				/** Define excel heading label **/
				commonColls		= 	[
					res.__(""),
					res.__("admin.report.payment_method"),
					res.__("admin.report.cash_crv"),
					res.__("admin.report.k_net_crv"),
					res.__("admin.report.credit_card_crv"),
					res.__("admin.report.cash_res"),
					res.__("admin.report.k_net_res"),
					res.__("admin.report.credit_card_res"),
					res.__("admin.report.cash_pck"),
					res.__("admin.report.k_net_pck"),
					res.__("admin.report.credit_card_pck"),
					res.__("admin.report.total"),
				];


				if (finalArray && finalArray.length > 0){
					let row1 =	[
						res.__("admin.report.no_of_orders"),
						res.__("admin.report.no_of_orders"),
						(finalArray[0].crv_cash_orders) ? (finalArray[0].crv_cash_orders) : 0,
						(finalArray[0].crv_knet_orders) ? (finalArray[0].crv_knet_orders) : 0,
						(finalArray[0].crv_credit_orders) ? (finalArray[0].crv_credit_orders) : 0,
						(finalArray[0].res_cash_orders) ? (finalArray[0].res_cash_orders) : 0,
						(finalArray[0].res_knet_orders) ? (finalArray[0].res_knet_orders) : 0,
						(finalArray[0].res_credit_orders) ? (finalArray[0].res_credit_orders):0,
						(finalArray[0].pck_cash_orders) ? (finalArray[0].pck_cash_orders):0,
						(finalArray[0].pck_knet_orders)? (finalArray[0].pck_knet_orders):0,
						(finalArray[0].pck_credit_orders)? (finalArray[0].pck_credit_orders):0,
						(finalArray[0].total) ? (finalArray[0].total) : 0,
					];
					temp.push(row1);
					let row2 = [
						res.__(""),
						res.__("admin.report.refund_no_of_orders"),
						(finalArray[1].crv_cash_refund_orders) ? (finalArray[1].crv_cash_refund_orders) : 0,
						(finalArray[1].crv_knet_refund_orders) ? (finalArray[1].crv_knet_refund_orders) : 0,
						(finalArray[1].crv_credit_refund_orders) ? (finalArray[1].crv_credit_refund_orders) : 0,
						(finalArray[1].res_cash_refund_orders) ? (finalArray[1].res_cash_refund_orders) : 0,
						(finalArray[1].res_knet_refund_orders) ? (finalArray[1].res_knet_refund_orders) : 0,
						(finalArray[1].res_credit_refund_orders) ? (finalArray[1].res_credit_refund_orders) : 0,
						(finalArray[1].pck_cash_refund_orders) ? (finalArray[1].pck_cash_refund_orders) : 0,
						(finalArray[1].pck_knet_refund_orders) ? (finalArray[1].pck_knet_refund_orders) : 0,
						(finalArray[1].pck_credit_refund_orders) ? (finalArray[1].pck_credit_refund_orders) : 0,
						(finalArray[1].total) ? (finalArray[1].total) : 0,
					];
					temp.push(row2);
					let row3 = [
						res.__(""),
						res.__("admin.report.net_number_of_orders"),
						(finalArray[7].crv_cash_net_orders) ? (finalArray[7].crv_cash_net_orders) : 0,
						(finalArray[7].crv_knet_net_orders) ? (finalArray[7].crv_knet_net_orders) : 0,
						(finalArray[7].crv_credit_net_orders) ? (finalArray[7].crv_credit_net_orders) : 0,
						(finalArray[7].res_cash_net_orders) ? (finalArray[7].res_cash_net_orders) : 0,
						(finalArray[7].res_knet_net_orders) ? (finalArray[7].res_knet_net_orders) : 0,
						(finalArray[7].res_credit_net_orders) ? (finalArray[7].res_credit_net_orders) : 0,
						(finalArray[7].pck_cash_net_orders) ? (finalArray[7].pck_cash_net_orders) : 0,
						(finalArray[7].pck_knet_net_orders) ? (finalArray[7].pck_knet_net_orders) : 0,
						(finalArray[7].pck_credit_net_orders) ? (finalArray[7].pck_credit_net_orders) : 0,
						(finalArray[7].total) ? (finalArray[7].total) : 0,
					];
					temp.push(row3);
					let row4 = [
						res.__("admin.report.value_of_orders"),
						res.__("admin.report.value_of_sales"),
						currencyFormat(finalArray[2].crv_cash_sales_value),
						currencyFormat(finalArray[2].crv_knet_sales_value),
						currencyFormat(finalArray[2].crv_credit_sales_value),
						currencyFormat(finalArray[2].res_cash_sales_value),
						currencyFormat(finalArray[2].res_knet_sales_value),
						currencyFormat(finalArray[2].res_credit_sales_value),
						currencyFormat(finalArray[2].pck_cash_sales_value),
						currencyFormat(finalArray[2].pck_knet_sales_value),
						currencyFormat(finalArray[2].pck_credit_sales_value),
						currencyFormat(finalArray[2].total),
					];
					temp.push(row4);
					let row5 = [
						res.__(""),
						res.__("admin.report.delivery_charges"),
						currencyFormat(finalArray[3].crv_cash_delivery_charge),
						currencyFormat(finalArray[3].crv_knet_delivery_charge),
						currencyFormat(finalArray[3].crv_credit_delivery_charge),
						currencyFormat(finalArray[3].res_cash_delivery_charge),
						currencyFormat(finalArray[3].res_knet_delivery_charge),
						currencyFormat(finalArray[3].res_credit_delivery_charge),
						currencyFormat(finalArray[3].pck_cash_delivery_charge),
						currencyFormat(finalArray[3].pck_knet_delivery_charge),
						currencyFormat(finalArray[3].pck_credit_delivery_charge),
						currencyFormat(finalArray[3].total),
					];
					temp.push(row5);
					let row6 = [
						res.__(""),
						res.__("admin.report.total_value_of_refunded_orders"),
						currencyFormat(finalArray[4].crv_cash_refund_order_value),
						currencyFormat(finalArray[4].crv_knet_refund_order_value),
						currencyFormat(finalArray[4].crv_credit_refund_order_value),
						currencyFormat(finalArray[4].res_cash_refund_order_value),
						currencyFormat(finalArray[4].res_knet_refund_order_value),
						currencyFormat(finalArray[4].res_credit_refund_order_value),
						currencyFormat(finalArray[4].pck_cash_refund_order_value),
						currencyFormat(finalArray[4].pck_knet_refund_order_value),
						currencyFormat(finalArray[4].pck_credit_refund_order_value),
						currencyFormat(finalArray[4].total),
					];
					temp.push(row6);
					let row7 = [
						res.__(""),
						res.__("admin.report.net_value_of_sales"),
						currencyFormat(finalArray[8].crv_cash_net_value_sales),
						currencyFormat(finalArray[8].crv_knet_net_value_sales),
						currencyFormat(finalArray[8].crv_credit_net_value_sales),
						currencyFormat(finalArray[8].res_cash_net_value_sales),
						currencyFormat(finalArray[8].res_knet_net_value_sales),
						currencyFormat(finalArray[8].res_credit_net_value_sales),
						currencyFormat(finalArray[8].pck_cash_net_value_sales),
						currencyFormat(finalArray[8].pck_knet_net_value_sales),
						currencyFormat(finalArray[8].pck_credit_net_value_sales),
						currencyFormat(finalArray[8].total),
					];
					temp.push(row7);
					let row9 = [
						res.__("admin.report.cravez_commission_bank_charges"),
						res.__("admin.report.cravez_commisson"),
						currencyFormat(finalArray[5].crv_cash_cravez_commission),
						currencyFormat(finalArray[5].crv_knet_cravez_commission),
						currencyFormat(finalArray[5].crv_credit_cravez_commission),
						currencyFormat(finalArray[5].res_cash_cravez_commission),
						currencyFormat(finalArray[5].res_knet_cravez_commission),
						currencyFormat(finalArray[5].res_credit_cravez_commission),
						currencyFormat(finalArray[5].pck_cash_cravez_commission),
						currencyFormat(finalArray[5].pck_knet_cravez_commission),
						currencyFormat(finalArray[5].pck_credit_cravez_commission),
						currencyFormat(finalArray[5].total),
					];
					temp.push(row9);
					temp.push(row5);
					let row10 = [
						res.__(""),
						res.__("admin.report.bank_charge_k_net"),
						currencyFormat(finalArray[6].crv_cash_knet_charges),
						currencyFormat(finalArray[6].crv_knet_knet_charges),
						currencyFormat(finalArray[6].crv_credit_knet_charges),
						currencyFormat(finalArray[6].res_cash_knet_charges),
						currencyFormat(finalArray[6].res_knet_knet_charges),
						currencyFormat(finalArray[6].res_credit_knet_charges),
						currencyFormat(finalArray[6].pck_cash_knet_charges),
						currencyFormat(finalArray[6].pck_knet_knet_charges),
						currencyFormat(finalArray[6].pck_credit_knet_charges),
						currencyFormat(finalArray[6].total)
					];
					temp.push(row10);
					let row11 = [
						res.__(""),
						res.__("admin.report.net_amount_of_cravez"),
						currencyFormat(finalArray[9].crv_cash_net_amount_cravez),
						currencyFormat(finalArray[9].crv_knet_net_amount_cravez),
						currencyFormat(finalArray[9].crv_credit_net_amount_cravez),
						currencyFormat(finalArray[9].res_cash_net_amount_cravez),
						currencyFormat(finalArray[9].res_knet_net_amount_cravez),
						currencyFormat(finalArray[9].res_credit_net_amount_cravez),
						currencyFormat(finalArray[9].pck_cash_net_amount_cravez),
						currencyFormat(finalArray[9].pck_knet_net_amount_cravez),
						currencyFormat(finalArray[9].pck_credit_net_amount_cravez),
						currencyFormat(finalArray[9].total)
					];
					temp.push(row11);
					temp.push([]);
					let row12 = [
						res.__(""),
						res.__("admin.report.collected_amount_by_cravez"),
						currencyFormat(finalArray[8].crv_cash_net_value_sales),
						currencyFormat(finalArray[8].crv_knet_net_value_sales),
						currencyFormat(finalArray[8].crv_credit_net_value_sales),
						currencyFormat(0),
						currencyFormat(finalArray[8].res_knet_net_value_sales),
						currencyFormat(finalArray[8].res_credit_net_value_sales),
						currencyFormat(0),
						currencyFormat(finalArray[8].pck_knet_net_value_sales),
						currencyFormat(finalArray[8].pck_credit_net_value_sales),
						currencyFormat((finalArray[8].total - (((finalArray[8].res_cash_net_value_sales) ? finalArray[8].res_cash_net_value_sales : 0) + ((finalArray[8].pck_cash_net_value_sales) ? finalArray[8].pck_cash_net_value_sales : 0))))
					];
					temp.push(row12);
					let row13 = [
						res.__(""),
						res.__("admin.report.cravez_commission_bank_charges"),
						'-'+currencyFormat(finalArray[9].crv_cash_net_amount_cravez),
						'-' +currencyFormat(finalArray[9].crv_knet_net_amount_cravez),
						'-' +currencyFormat(finalArray[9].crv_credit_net_amount_cravez),
						'-' +currencyFormat(finalArray[9].res_cash_net_amount_cravez),
						'-' +currencyFormat(finalArray[9].res_knet_net_amount_cravez),
						'-' +currencyFormat(finalArray[9].res_credit_net_amount_cravez),
						'-' +currencyFormat(finalArray[9].pck_cash_net_amount_cravez),
						'-' +currencyFormat(finalArray[9].pck_knet_net_amount_cravez),
						'-' +currencyFormat(finalArray[9].pck_credit_net_amount_cravez),
						'-' +currencyFormat(finalArray[9].total)
					];
					temp.push(row13);
					let row14 = [
						res.__(""),
						res.__("admin.report.net_due_amount_for_restaurant"),
						currencyFormat(finalArray[10].crv_cash_net_due_amount),
						currencyFormat(finalArray[10].crv_knet_net_due_amount),
						currencyFormat(finalArray[10].crv_credit_net_due_amount),
						currencyFormat(finalArray[10].res_cash_net_due_amount),
						currencyFormat(finalArray[10].res_knet_net_due_amount),
						currencyFormat(finalArray[10].res_credit_net_due_amount),
						currencyFormat(finalArray[10].pck_cash_net_due_amount),
						currencyFormat(finalArray[10].pck_knet_net_due_amount),
						currencyFormat(finalArray[10].pck_credit_net_due_amount),
						currencyFormat(finalArray[10].total)
					];
					temp.push(row14);
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "CravezSalesInvoiceReport",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
	}// end cravezSalesInvoiceReportExport()
}
