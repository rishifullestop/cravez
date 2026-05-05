import { ObjectId } from 'mongodb';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from '../../../../utils/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

export default class TopContributionLostRevenueReport {
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
	async getTopContributionLostRevenueList (req,res,next){
		try{
			let restaurantId	= new ObjectId(req.session.user.restaurant_id);
			if(Helpers.isPost(req)){
				let years			= (req.body.years) 		? req.body.years : [];
				let branchIds		= (req.body.branch_ids) ? req.body.branch_ids : [];
				let branchArray		= (branchIds.constructor === Array) ? branchIds : [branchIds];
				let yearsArray		= (years.constructor === Array) ? years : [years];
				yearsArray			= yearsArray.map(year=> parseInt(year));

				let commonConditions	=	{
					restaurant_id:	restaurantId,
					admin_status : Constants.ORDER_CANCELLED
				};

				let yearConditions	= {year : {$in :yearsArray}};

				if(branchArray.length > 0) commonConditions.branch_id = {$in : Helpers.arrayToObject(branchArray)};

				const collection = 	this.db.collection(Tables.ORDERS);
				let result = await collection.aggregate([
					{$match 	: commonConditions},
					{$addFields	: {"cancel_reason_id": { "$toString": "$cancel_reason_id" } } },
					{$group 	: {
						_id : {
							year_month : { $dateToString: { format: "%Y-%m", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE }}
						},
						year  : {$first : {"$year": "$order_date"}},
						month : {$first : {"$month": "$order_date"}},

						unavailable_items : {$sum : {
							$cond: [
								{$and: [
									{ $eq : ["$cancel_reason_id",Constants.UNAVAILABLE_ITEMS] },
								]},
								1,
								0
							]}
						},
						shortage_delivery_driver : {$sum : {
							$cond: [
								{$and: [
									{ $eq : ["$cancel_reason_id",Constants.SHORTAGE_OF_DELIVERY_DRIVER] },
								]},
								1,
								0
							]}
						},
						no_response : {$sum : {
							$cond: [
								{$and: [
									{ $eq : ["$cancel_reason_id",Constants.NO_RESPONSE_FROM_RESTAURANT] },
								]},
								1,
								0
							]}
						},
						wrong_order: {
							$sum: {
								$cond: [
									{
										$and: [
											{ $eq: ["$cancel_reason_id", Constants.WRONG_ORDER_BY_CRAVEZ] },
										]
									},
									1,
									0
								]
							}
						},
					}},
					{$match : yearConditions}
				]).toArray();

				let currentYear		= Helpers.newDate().getFullYear();
				let currentMonth 	= Helpers.newDate().getMonth()+1;
				let yearWiseData 	= {};

				result.map(record=>{
					if(!yearWiseData[record.year]) yearWiseData[record.year] = {};
					if (!yearWiseData[record.year][record.month]) yearWiseData[record.year][record.month] = {};
					yearWiseData[record.year][record.month]["unavailable_items"] = record.unavailable_items;
					yearWiseData[record.year][record.month]["shortage_delivery_driver"] = record.shortage_delivery_driver;
					yearWiseData[record.year][record.month]["no_response"] = record.no_response;
					yearWiseData[record.year][record.month]["wrong_order"] = record.wrong_order;
				});

				let finalArray 	= [];
				let dataYears	= Object.keys(yearWiseData);
				Object.keys(Constants.REPORT_CHART_MONTH_NAMES).map(month=>{
					let tmpRow = [Constants.REPORT_CHART_MONTH_NAMES[month]];
					dataYears.map(tmpYear=>{
						let tmpObj = (yearWiseData[tmpYear] && yearWiseData[tmpYear][month]) ? yearWiseData[tmpYear][month] : {};
						if (!tmpObj.unavailable_items) tmpObj.unavailable_items = 0;
						if (!tmpObj.shortage_delivery_driver) tmpObj.shortage_delivery_driver = 0;
						if (!tmpObj.no_response) tmpObj.no_response = 0;
						if (!tmpObj.wrong_order) tmpObj.wrong_order = 0;

						if (tmpYear == currentYear && month > currentMonth && (!tmpObj.unavailable_items || tmpObj.unavailable_items == 0)) {
							tmpObj.unavailable_items = null;
						}
						if (tmpYear == currentYear && month > currentMonth && (!tmpObj.shortage_delivery_driver || tmpObj.shortage_delivery_driver == 0)) {
							tmpObj.shortage_delivery_driver = null;
						}
						if (tmpYear == currentYear && month > currentMonth && (!tmpObj.no_response || tmpObj.no_response == 0)) {
							tmpObj.no_response = null;
						}
						if (tmpYear == currentYear && month > currentMonth && (!tmpObj.wrong_order || tmpObj.wrong_order == 0)) {
							tmpObj.wrong_order = null;
						}
						tmpRow.push(tmpObj.unavailable_items);
						tmpRow.push(tmpObj.shortage_delivery_driver);
						tmpRow.push(tmpObj.no_response);
						tmpRow.push(tmpObj.wrong_order);
					});
					finalArray.push(tmpRow);
				});

				res.send({status : STATUS_SUCCESS, result : finalArray,years : dataYears });

			}else{
				/**Get dropdown list **/
				let response = await Helpers.getDropdownList(req, res, next, {
					collections :[
						{
							collection : Tables.RESTAURANT_BRANCHES,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions : {
								restaurant_id 	: restaurantId,
								is_active		: Constants.ACTIVE,
							},
						},
					]
				});

				/** Send error response **/
				if(response.status != STATUS_SUCCESS){
					req.flash(Constants.STATUS_ERROR,response.message);
					return res.redirect(Constants.WEBSITE_URL+"dashboard");
				}

				/** render listing page **/
				req.breadcrumbs(BREADCRUMBS['reports/top_contribution_lost_revenue']);
				res.render('top_contribution_to_lost_revenue',{
					branch_list : response?.final_html_data?.["0"] || "",
				});
			}
		}catch(err){ return next(err); }
    };//End getTopContributionLostRevenueList()

	/**
	 *  Function for export top_contribution_lost_revenue
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async topContributionLostRevenueExportData (req,res,next){
		try{
			let restaurantId    =	new ObjectId(req.session.user.restaurant_id);
			let branchIds       =	(req.query.branch_ids) ? (req.query.branch_ids).split(",") : [];
			let years           =	(req.query.years) ? (req.query.years).split(",") : [];
			let branchArray 	=	(branchIds.constructor === Array) ? branchIds : [branchIds];
			let yearsArray  	=	(years.constructor === Array) ? years : [years];
			yearsArray			=	yearsArray.map(year=> parseInt(year));

			let exportConditions	= {
				restaurant_id: restaurantId,
				admin_status : Constants.ORDER_CANCELLED
			};
			let yearConditions = { year: { $in: yearsArray } };

			if (branchArray.length > 0) exportConditions.branch_id = { $in: Helpers.arrayToObject(branchArray) };

			const orders = this.db.collection(Tables.ORDERS);
			let result = await orders.aggregate([
				{ $match: exportConditions },
				{ $addFields: { "cancel_reason_id": { "$toString": "$cancel_reason_id" } } },
				{$group: {
					_id: {
						year_month: { $dateToString: { format: "%Y-%m", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE } }
					},
					year : { $first: { "$year": "$order_date" } },
					month: { $first: { "$month": "$order_date" } },

					unavailable_items: {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$cancel_reason_id", Constants.UNAVAILABLE_ITEMS] },
									]
								},
								1,
								0
							]
						}
					},
					shortage_delivery_driver: {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$cancel_reason_id", Constants.SHORTAGE_OF_DELIVERY_DRIVER] },
									]
								},
								1,
								0
							]
						}
					},
					no_response: {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$cancel_reason_id", Constants.NO_RESPONSE_FROM_RESTAURANT] },
									]
								},
								1,
								0
							]
						}
					},
					wrong_order: {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$cancel_reason_id", Constants.WRONG_ORDER_BY_CRAVEZ] },
									]
								},
								1,
								0
							]
						}
					},
				}},
				{$match: yearConditions}
			]).toArray();

			var currentYear = Helpers.newDate().getFullYear();
			var currentMonth = Helpers.newDate().getMonth() + 1;
			let yearWiseData = {};

			if(result?.length){
				result.map(record => {
					if (!yearWiseData[record.year]) yearWiseData[record.year] = {};
					if (!yearWiseData[record.year][record.month]) yearWiseData[record.year][record.month] = {};
					yearWiseData[record.year][record.month]["unavailable_items"] = record.unavailable_items;
					yearWiseData[record.year][record.month]["shortage_delivery_driver"] = record.shortage_delivery_driver;
					yearWiseData[record.year][record.month]["no_response"] = record.no_response;
					yearWiseData[record.year][record.month]["wrong_order"] = record.wrong_order;
				});
			}

			let finalArray = [];
			let dataYears = Object.keys(yearWiseData);
			Object.keys(Constants.REPORT_CHART_MONTH_NAMES).map(month => {
				let tmpRow = [Constants.REPORT_CHART_MONTH_NAMES[month]];
				dataYears.map(tmpYear => {
					let tmpObj = (yearWiseData[tmpYear] && yearWiseData[tmpYear][month]) ? yearWiseData[tmpYear][month] : {};
					if (!tmpObj.unavailable_items) tmpObj.unavailable_items = 0;
					if (!tmpObj.shortage_delivery_driver) tmpObj.shortage_delivery_driver = 0;
					if (!tmpObj.no_response) tmpObj.no_response = 0;
					if (!tmpObj.wrong_order) tmpObj.wrong_order = 0;

					if (tmpYear == currentYear && month > currentMonth && (!tmpObj.unavailable_items || tmpObj.unavailable_items == 0)) {
						tmpObj.unavailable_items = null;
					}
					if (tmpYear == currentYear && month > currentMonth && (!tmpObj.shortage_delivery_driver || tmpObj.shortage_delivery_driver == 0)) {
						tmpObj.shortage_delivery_driver = null;
					}
					if (tmpYear == currentYear && month > currentMonth && (!tmpObj.no_response || tmpObj.no_response == 0)) {
						tmpObj.no_response = null;
					}
					if (tmpYear == currentYear && month > currentMonth && (!tmpObj.wrong_order || tmpObj.wrong_order == 0)) {
						tmpObj.wrong_order = null;
					}
					tmpRow.push(tmpObj.unavailable_items);
					tmpRow.push(tmpObj.shortage_delivery_driver);
					tmpRow.push(tmpObj.no_response);
					tmpRow.push(tmpObj.wrong_order);
				});
				finalArray.push(tmpRow);
			});

			let commonColls = [
				res.__("reports.month"),
				res.__("reports.unavailable_items"),
				res.__("reports.shortage_of_delivery_driver"),
				res.__("reports.no_response_from_restaurant"),
				res.__("reports.wrong_order")
			];

			/**  Function to export data in excel format **/
			Helpers.exportToExcel(req,res,{
				file_prefix 	: "TopContributionToLostRevenueReport",
				heading_columns	: commonColls,
				export_data		: finalArray
			});
		}catch(err){ return next(err); }
    };// end topContributionLostRevenueExportData()
}
