import { ObjectId } from 'mongodb';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from '../../../../utils/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

export default class OperationReport {
    constructor(db) {
        this.db = db;
    }

	/**
	 * Function to get operation performance list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getOperationReportList (req,res,next){
		try{
			let restaurantId = (req.session.user.restaurant_id) ? new ObjectId(req.session.user.restaurant_id) : '';
			if(Helpers.isPost(req)){
				let limit 			= (req.body.length) 		? parseInt(req.body.length) :Constants.FRONT_LISTING_LIMIT;
				let skip		 	= (req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     	= (req.body.from_date) 		? req.body.from_date 		: "";
				let toDate 	  	 	= (req.body.to_date)   		? req.body.to_date   		: "";
				let branchIds		= (req.body.branch_ids)   	? req.body.branch_ids   	: [];
				branchIds	= (branchIds && branchIds.constructor === Array) ?branchIds :[branchIds];

				// Configure Data-table conditions
				const dataTableConfig = await Helpers.configDatatable(req, res, null);
				let commonConditions = { restaurant_id: restaurantId };

				/** Condition for date */
				if (fromDate != "" && toDate != "") {
					commonConditions["date"] = {
						$gte 	: Helpers.newDate(fromDate),
						$lte 	: Helpers.newDate(toDate),
					};
				}

				dataTableConfig.conditions = Object.assign(commonConditions, dataTableConfig.conditions);
				if(branchIds.length > 0) dataTableConfig.conditions.branch_id = {$in : Helpers.arrayToObject(branchIds)};

				/** Get list or count of top selling items **/
				const collection = 	this.db.collection(Tables.OPERATION_REPORTS);
				let dbRes = await collection.aggregate([
					{$match: dataTableConfig.conditions},
					{$sort 	: dataTableConfig.sort_conditions},
					{$group : {
						_id					: "$branch_id",
						branch_id			: {$first: "$branch_id"},
						cancelled_orders	: {$sum : "$cancelled_orders"},
						contacted_orders	: {$sum : "$contacted_orders"},
						total_orders		: {$sum : "$total_orders"},
						manual_transmission	: {$sum : "$manual_transmission"},
						lost_revenue		: {$sum : "$lost_revenue"},
						transmission_time	: {$sum : "$transmission_time"},
					}},
					{$facet : {
						list: [
							{$skip 	: skip},
							{$limit : limit},
							{$lookup:	{
								"from" 			: 	Tables.RESTAURANT_BRANCHES,
								"localField" 	:	"branch_id",
								"foreignField" 	: 	"_id",
								"as" 			: 	"branch_details"
							}},
							{$addFields : {
								branch_name: {$arrayElemAt: ["$branch_details.name",0]},
							}},
						],
						count: [
							{$count: "count"},
						],
					}}
				]).toArray();

				// Send response
				res.send({
					status: Constants.STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data			:   dbRes?.[0]?.list ||[],
					recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
					recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
				});
			}else{
				/**Get dropdown list **/
				let response = await Helpers.getDropdownList(req, res, next, {
					collections: [{
						collection  : Tables.RESTAURANT_BRANCHES,
						columns     : ["_id", ["name", Constants.DEFAULT_LANGUAGE_CODE]],
						conditions  : {
							restaurant_id	: restaurantId,
							is_active		: Constants.ACTIVE,
						},
					}]
				});

				/** Send error response **/
				if (response.status != Constants.Constants.STATUS_SUCCESS) {
					req.flash(Constants.STATUS_ERROR, response.message);
					return res.redirect(Constants.WEBSITE_URL + "dashboard");
				}

				/** render listing page **/
				req.breadcrumbs(BREADCRUMBS['reports/operation_report']);
				res.render('operation_report',{
					branch_list: response?.final_html_data?.["0"] || "",
				});
			}
		}catch(err){ return next(err); }
	};//End getOperationReportList()

	/**
	 *  Function operation report export
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async getOperationReportExport (req,res,next){
		try{
			let restaurantId 	= (req.session.user.restaurant_id) ? new ObjectId(req.session.user.restaurant_id) : '';
			let fromDate     	= (req.query.from_date) ? req.query.from_date 		: "";
			let toDate 	  	 	= (req.query.to_date)   ? req.query.to_date   		: "";
			let branchIds		= (req.query.branch_ids)? (req.query.branch_ids).split(",")   	: [];

			if(branchIds.constructor != Array) 	branchIds	= [branchIds];

			let exportConditions = {restaurant_id: restaurantId };

			/** Condition for date */
			if (fromDate != "" && toDate != "") {
				exportConditions["date"] = {
					$gte 	: Helpers.newDate(fromDate),
					$lte 	: Helpers.newDate(toDate),
				};
			}

			if(branchIds.length > 0)	exportConditions.branch_id = {$in: Helpers.arrayToObject(branchIds)};

			/** Get order details **/
			const operation_reports	= this.db.collection(Tables.OPERATION_REPORTS);
			let findResult = await operation_reports.aggregate([
				{$match : exportConditions},
				{$sort 	: {_id : Constants.SORT_DESC}},
				{$group : {
					_id					: "$branch_id",
					branch_id			: {$first: "$branch_id"},
					cancelled_orders	: {$sum: "$cancelled_orders"},
					contacted_orders	: {$sum: "$contacted_orders"},
					total_orders		: {$sum: "$total_orders"},
					manual_transmission	: {$sum : "$manual_transmission"},
					lost_revenue		: {$sum : "$lost_revenue"},
					transmission_time	: {$sum : "$transmission_time"},
					branch_name			: {$first : "$branch_name"},
				}},
				{$lookup:	{
					"from" 			: 	Tables.RESTAURANT_BRANCHES,
					"localField" 	:	"branch_id",
					"foreignField" 	: 	"_id",
					"as" 			: 	"branch_details"
				}},
				{$addFields : {
					branch_name: {$arrayElemAt: ["$branch_details.name",0]},
				}},
			]).toArray();

			/** Define excel heading label **/
			let commonColls	= [
				res.__("reports.branch_name"),
				res.__("reports.cancelled_orders"),
				res.__("reports.fail_rate"),
				res.__("reports.lost_revenue"),
				res.__("reports.transmission_time"),
				res.__("reports.contact_per_order"),
				res.__("reports.manual_transmission_percentage"),
			];

			let temp = [];
			if(findResult && findResult.length > 0){
				findResult.map(records=>{
					temp.push([
						(records.branch_name)		? 	records.branch_name[Constants.DEFAULT_LANGUAGE_CODE] 		:"",
						(records.cancelled_orders)	? Helpers.round(records.cancelled_orders) : 0,
						(records.cancelled_orders)	? Helpers.round((records.cancelled_orders/records.total_orders)*100)+""+res.__("reports.percent") : 0,
						Helpers.currencyFormat(records.lost_revenue),
						(records.transmission_time) ? Helpers.round(records.transmission_time) : 0,
						(records.contacted_orders) ? Helpers.round((records.contacted_orders / records.total_orders) * 100) + "" + res.__("reports.percent"): 0,
						(records.manual_transmission)	? Helpers.round((records.manual_transmission/records.total_orders)*100)+""+res.__("reports.percent") : 0,
					]);
				});
			}

			/**  Function to export data in excel format **/
			Helpers.exportToExcel(req,res,{
				file_prefix 		: "OperationPerformanceReport",
				heading_columns		: commonColls,
				export_data			: temp
			});
		}catch(err){ return next(err); }
	};// end getOperationReportExport()
}