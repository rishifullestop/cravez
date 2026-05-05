import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList, newDate, exportToExcel } from '../../../../utils/index.mjs';

// Model for monthly customer breakdown report
export default class MonthlyCustomerBreakdownReport {
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
	async getCustomerBreakdownReport(req,res,next){
		try{
			if(isPost(req)){
				let year		= (req.body.year) ? parseInt(req.body.year) : "";
				const monthly_customer_breakdown = this.db.collection(Tables.MONTHLY_CUSTOMER_BREAKDOWN);

				monthly_customer_breakdown.aggregate([
					{$match : {year : year}},
					{$project : {
						year_month  : 1,
						year:1,
						month:1,
						customer_without_order: { $avg: "$customer_without_order"},
						multi_order_customer: { $avg: "$multi_order_customer" },
						repeating_customers: { $avg: "$repeating_customers" },
						winback_customers: { $avg: "$winback_customers" },
					}},
				]).toArray().then(result=>{

					/** Send response **/
					var currentYear		= newDate().getFullYear();
					var currentMonth 	= newDate().getMonth()+1;
					let yearWiseData 	= {};
					result.map(record=>{
						if(!yearWiseData[record.year]) yearWiseData[record.year] = {};
						if(!yearWiseData[record.year][record.month]) yearWiseData[record.year][record.month] = {};
						yearWiseData[record.year][record.month]["customer_without_order"] = record.customer_without_order;
						yearWiseData[record.year][record.month]["multi_order_customer"] = record.multi_order_customer;
						yearWiseData[record.year][record.month]["repeating_customers"] = record.repeating_customers;
						yearWiseData[record.year][record.month]["winback_customers"] = record.winback_customers;
					});

					let finalArray 	= [];
					let dataYears	= Object.keys(yearWiseData);

					Object.keys(Constants.REPORT_CHART_MONTH_NAMES).map(month=>{
						let tmpRow = [Constants.REPORT_CHART_MONTH_NAMES[month]];
						dataYears.map(tmpYear=>{
							let tmpObj = (yearWiseData[tmpYear] && yearWiseData[tmpYear][month]) ? yearWiseData[tmpYear][month] : {};
							if(!tmpObj.customer_without_order)	tmpObj.customer_without_order	= 0;
							if(!tmpObj.multi_order_customer)	tmpObj.multi_order_customer 	= 0;
							if(!tmpObj.repeating_customers) 	tmpObj.repeating_customers		= 0;
							if(!tmpObj.winback_customers)		tmpObj.winback_customers		= 0;

							if(tmpYear == currentYear && month > currentMonth && (!tmpObj.customer_without_order || tmpObj.customer_without_order == 0)){
								tmpObj.customer_without_order = null;
							}
							if(tmpYear == currentYear && month > currentMonth && (!tmpObj.multi_order_customer || tmpObj.multi_order_customer == 0)){
								tmpObj.multi_order_customer = null;
							}
							if(tmpYear == currentYear && month > currentMonth && (!tmpObj.repeating_customers || tmpObj.repeating_customers == 0)){
								tmpObj.repeating_customers = null;
							}
							if(tmpYear == currentYear && month > currentMonth && (!tmpObj.winback_customers || tmpObj.winback_customers == 0)){
								tmpObj.winback_customers = null;
							}
							tmpRow.push(tmpObj.customer_without_order);
							tmpRow.push(tmpObj.multi_order_customer);
							tmpRow.push(tmpObj.repeating_customers);
							tmpRow.push(tmpObj.winback_customers);
						});
						finalArray.push(tmpRow);
					});
					dataYears = (dataYears.constructor === Array) ? dataYears : [dataYears];

					res.send({status : Constants.STATUS_SUCCESS, result : finalArray,years : dataYears});
				}).catch(next);
			}else{
				/**Get dropdown list **/
				let dropDownResponse = await getDropdownList(req,res, next,{ collections :[ {
					collection : Tables.RESTAURANTS,
					columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
					conditions : {
						is_deleted	: Constants.NOT_DELETED
					},
				}] });

				/** render listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/report/monthly_customer_breakdown_report']);
				res.render('monthly_customer_breakdown_report',{
					restaurant_list : dropDownResponse?.final_html_data?.[0] || "",
				});
			}
		}catch(error){
			return next(error);
		}
	};//End getCustomerBreakdownReport()


	/**
	 *  Function for export report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async exportCustomerBreakdownReport(req,res,next){
		try{
			let year		= (req.query.year) ? parseInt(req.query.year) : "";;
			const monthly_customer_breakdown = this.db.collection(Tables.MONTHLY_CUSTOMER_BREAKDOWN);

			monthly_customer_breakdown.aggregate([
				{ $match: { year: year } },
				{
					$project: {
						year_month: 1,
						year: 1,
						month: 1,
						customer_without_order: { $avg: "$customer_without_order" },
						multi_order_customer: { $avg: "$multi_order_customer" },
						repeating_customers: { $avg: "$repeating_customers" },
						winback_customers: { $avg: "$winback_customers" },
					}
				},
			]).toArray().then(result=>{
				/** Send response **/
				var currentYear = newDate().getFullYear();
				var currentMonth = newDate().getMonth() + 1;
				let yearWiseData = {};
				result.map(record => {
					if (!yearWiseData[record.year]) yearWiseData[record.year] = {};
					if (!yearWiseData[record.year][record.month]) yearWiseData[record.year][record.month] = {};
					yearWiseData[record.year][record.month]["customer_without_order"] = record.customer_without_order;
					yearWiseData[record.year][record.month]["multi_order_customer"] = record.multi_order_customer;
					yearWiseData[record.year][record.month]["repeating_customers"] = record.repeating_customers;
					yearWiseData[record.year][record.month]["winback_customers"] = record.winback_customers;
				});

				let finalArray = [];
				let dataYears = Object.keys(yearWiseData);

					Object.keys(Constants.REPORT_CHART_MONTH_NAMES).map(month => {
					let tmpRow = [Constants.REPORT_CHART_MONTH_NAMES[month]];
					dataYears.map(tmpYear => {
						let tmpObj = (yearWiseData[tmpYear] && yearWiseData[tmpYear][month]) ? yearWiseData[tmpYear][month] : {};
						if (!tmpObj.customer_without_order) tmpObj.customer_without_order = 0;
						if (!tmpObj.multi_order_customer) tmpObj.multi_order_customer = 0;
						if (!tmpObj.repeating_customers) tmpObj.repeating_customers = 0;
						if (!tmpObj.winback_customers) tmpObj.winback_customers = 0;

						if (tmpYear == currentYear && month > currentMonth && (!tmpObj.customer_without_order || tmpObj.customer_without_order == 0)) {
							tmpObj.customer_without_order = null;
						}
						if (tmpYear == currentYear && month > currentMonth && (!tmpObj.multi_order_customer || tmpObj.multi_order_customer == 0)) {
							tmpObj.multi_order_customer = null;
						}
						if (tmpYear == currentYear && month > currentMonth && (!tmpObj.repeating_customers || tmpObj.repeating_customers == 0)) {
							tmpObj.repeating_customers = null;
						}
						if (tmpYear == currentYear && month > currentMonth && (!tmpObj.winback_customers || tmpObj.winback_customers == 0)) {
							tmpObj.winback_customers = null;
						}
						tmpRow.push(tmpObj.customer_without_order);
						tmpRow.push(tmpObj.multi_order_customer);
						tmpRow.push(tmpObj.repeating_customers);
						tmpRow.push(tmpObj.winback_customers);
					});
					finalArray.push(tmpRow);
				});

				let commonColls	= [
					res.__("admin.report.month"),
					res.__("admin.report.new_customer_without_purchase"),
					res.__("admin.report.new_customer_multi_purchase"),
					res.__("admin.report.repeating_customer"),
					res.__("admin.report.winback_customers")
				];

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "CustomerBreakdownExport",
					heading_columns		: commonColls,
					export_data			: finalArray
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
	};// end exportCustomerBreakdownReport()
}
