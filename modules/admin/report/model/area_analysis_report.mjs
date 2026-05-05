import {parallel as asyncParallel} from 'async';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import * as Helper  from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

export default class AreaAnalysisReport {
	constructor(db) {
		this.db = db;
	}

	/**
	 * Function to get area analysis list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
    async getAreaAnalysisReportList (req,res,next){
		if(Helper.isPost(req)){
			let limit			= (req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
			let skip		 	= (req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
			let fromDate     	= (req.body.from_date) 	    ? req.body.from_date 		: "";
			let toDate 	  	 	= (req.body.to_date)   	    ? req.body.to_date   		: "";
			let restaurantIds	= (req.body.restaurant_ids) ? req.body.restaurant_ids   : [];
			let branchIds		= (req.body.branch_ids)   	? req.body.branch_ids   	: [];
			let areaIds			= (req.body.area_ids)   	? req.body.area_ids   		: [];
            let deliveryBy      = (req.body.delivery_by)    ? req.body.delivery_by : "";

			restaurantIds= (restaurantIds && restaurantIds.constructor === Array) ?restaurantIds :[restaurantIds];
			branchIds	= (branchIds && branchIds.constructor === Array) ?branchIds :[branchIds];
			areaIds		= (areaIds && areaIds.constructor === Array) ?areaIds :[areaIds];

			const collection = 	this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);

			/** Configure Datatable conditions*/
			const dataTableConfig = await Helper.configDatatable(req, res, null);
			let commonConditions = {};

			/** Condition for date */
			if (fromDate != "" && toDate != "") {
				commonConditions["date"] = {
					$gte 	: Helper.newDate(fromDate),
					$lte 	: Helper.newDate(toDate),
				};
			}

			dataTableConfig.conditions = Object.assign(dataTableConfig.conditions,commonConditions);
			if(restaurantIds.length > 0) dataTableConfig.conditions.restaurant_id = {$in : Helper.arrayToObject(restaurantIds)};
			if(branchIds.length > 0) dataTableConfig.conditions.branch_id	= {$in : Helper.arrayToObject(branchIds)};
			if(areaIds.length > 0) dataTableConfig.conditions.area_id 		= {$in : Helper.arrayToObject(areaIds)};

			/** Conditions for search*/
			if (deliveryBy != "") {
				switch (deliveryBy) {
					case Constants.DELIVERY_BY_RESTAURANT:
						dataTableConfig.conditions["delivery_type"] = Constants.DELIVERY_BY_RESTAURANT;
						break;

					case Constants.DELIVERY_BY_CRAVEZ:
						dataTableConfig.conditions["delivery_type"] = Constants.DELIVERY_BY_CRAVEZ;
						break;

					case Constants.DELIVERY_BY_PICK_UP:
						dataTableConfig.conditions["delivery_type"] = Constants.DELIVERY_BY_PICK_UP;
						break;
				}
			}

			asyncParallel({
				records :(callback)=>{
					/** Get list of all orders of guest and customer **/
					collection.aggregate([
						{$match : dataTableConfig.conditions},
						{$lookup:	{
							"from" 			: 	Tables.RESTAURANT_BRANCHES,
							"localField" 	:	"branch_id",
							"foreignField" 	: 	"_id",
							"as" 			: 	"branch_details"
						}},
						{$addFields : {
							branch_name: {$arrayElemAt: ["$branch_details.name",0]},
						}},
						{$group : {
							_id                 : "$restaurant_id",
							total_orders		: {$sum : "$total_orders" },
							branch_id			: {$first: "$branch_id"},
							area_id				: {$first: "$area_id"},
							restaurant_id		: {$first: "$restaurant_id"},
							branch_name			: {$first : "$branch_name"},
							area_name			: {$last : "$area_name"},
							restaurant_name		: {$last : "$restaurant_name"},
							delivery_type       : {$first: "$delivery_type" },
						}},
						{$sort 	: dataTableConfig.sort_conditions},
						{$skip 	: skip},
						{$limit : limit},
					]).toArray().then(result=>{
						callback(null,result);
					}).catch(err=>{
						callback(err, []);
					});
				},
				filter_records:(callback)=>{
					/** Get filtered records counting **/
					collection.aggregate([
						{$match : dataTableConfig.conditions},
						{$group : {
							_id: "$restaurant_id",
						}}
					]).toArray().then(countResult=>{
						callback(null, countResult.length);
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
					recordsFiltered	: response.filter_records,
					recordsTotal	: response.filter_records,
				});
			});
		}else{
			/**Get dropdown list **/
			Helper.getDropdownList(req,res, next,{
				collections :[
					{
						collection : Tables.RESTAURANTS,
						columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
						conditions : {
							is_deleted	: Constants.NOT_DELETED
						},
					},
					{
						collection: Tables.AREAS,
						columns: ["_id", ["name", Constants.DEFAULT_LANGUAGE_CODE]],
						conditions: {
							is_active		: Constants.ACTIVE,
						},
					}
				]
			}).then(response=> {

				/** Send error response **/
				if(response.status != Constants.STATUS_SUCCESS){
					req.flash(Constants.STATUS_ERROR,response.message);
					return res.redirect(Constants.WEBSITE_ADMIN_URL+"dashboard");
				}

				/** render listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/report/area_analysis_report']);
				res.render('area_analysis_report',{
					restaurant_list : response?.final_html_data?.["0"] || "",
					area_list 		: response?.final_html_data?.["1"] || "",
				});
			}).catch(next);
		}
	};//End getAreaAnalysisReportList()

	/**
	 *  Function for all orders export
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async areaAnalysisReportExport (req,res,next){
		let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
		let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";
		let sortingField    = (req.query.sort_field)    ? req.query.sort_field : "_id";
        let sortingDir      = (req.query.sort_dir)      ? req.query.sort_dir : "asc";
        let sortOrder       = (sortingDir == 'asc')     ? Constants.SORT_ASC : Constants.SORT_DESC;
		let restaurantIds	= (req.query.restaurant_ids)? (req.query.restaurant_ids).split(","): [];
		let branchIds		= (req.query.branch_ids) ? (req.query.branch_ids).split(",")   	: [];
		let areaIds			= (req.query.area_ids) ? (req.query.area_ids).split(",")   	: [];
        let deliveryBy      = (req.query.delivery_by) ? req.query.delivery_by : "";

		if(restaurantIds.constructor != Array) restaurantIds = [restaurantIds];
		if(branchIds.constructor != Array) 	branchIds	= [branchIds];
		if(areaIds.constructor != Array) 	areaIds	= [areaIds];

		let exportConditions	= {};
		/** Condition for date */
		if (fromDate != "" && toDate != "") {
			exportConditions["date"] = {
				$gte 	: Helper.newDate(fromDate),
				$lte 	: Helper.newDate(toDate),
			};
		}

		let sortConditions          = {};
		sortConditions[sortingField]= sortOrder;

		if(restaurantIds.length > 0)exportConditions.restaurant_id	= {$in: Helper.arrayToObject(restaurantIds)};
		if(branchIds.length > 0)	exportConditions.branch_id		= {$in: Helper.arrayToObject(branchIds)};
		if(areaIds.length > 0)		exportConditions.area_id		= {$in: Helper.arrayToObject(areaIds)};

        /** Conditions for search*/
        if (deliveryBy != "") {
            switch (deliveryBy) {
                case Constants.DELIVERY_BY_RESTAURANT:
                    exportConditions["delivery_type"] = Constants.DELIVERY_BY_RESTAURANT;
                    break;

                case Constants.DELIVERY_BY_CRAVEZ:
                    exportConditions["delivery_type"] = Constants.DELIVERY_BY_CRAVEZ;
                    break;

                case Constants.DELIVERY_BY_PICK_UP:
                    exportConditions["delivery_type"] = Constants.DELIVERY_BY_PICK_UP;
                    break;
            }
        }

		/** Get order details **/
		const branch_wise_processed_orders	= this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);
		branch_wise_processed_orders.aggregate([
			{$match : exportConditions},
			{$lookup:	{
				"from" 			: 	Tables.RESTAURANT_BRANCHES,
				"localField" 	:	"branch_id",
				"foreignField" 	: 	"_id",
				"as" 			: 	"branch_details"
			}},
			{$addFields : {
				branch_name: {$arrayElemAt: ["$branch_details.name",0]},
			}},
			{$group : {
                _id             : "$restaurant_id",
				total_orders	: {$sum : "$total_orders" },
				branch_id		: {$first: "$branch_id"},
				area_id			: {$first: "$area_id"},
				restaurant_id	: {$first: "$restaurant_id"},
				branch_name		: {$first : "$branch_name"},
				area_name		: {$last : "$area_name"},
                restaurant_name	: {$last : "$restaurant_name"},
                delivery_type   : { $first: "$delivery_type" },
			}},
			{ $sort	: sortConditions},
		]).toArray().then(findResult=>{

			let temp		= [];
			let commonColls	= [];

			/** Define excel heading label **/
			commonColls	= [
				res.__("admin.report.restaurant_name"),
				res.__("admin.report.branch_name"),
				res.__("admin.report.area_name"),
                res.__("admin.report.no_of_orders"),
                res.__("admin.report.delivery_by"),
			];

			if(findResult && findResult.length > 0){
				findResult.map(records=>{
					let buffer =	[
						(records.restaurant_name)	? records.restaurant_name[Constants.DEFAULT_LANGUAGE_CODE] 		:"",
						(records.branch_name)		? records.branch_name[Constants.DEFAULT_LANGUAGE_CODE] 		:"",
						(records.area_name)			? records.area_name[Constants.DEFAULT_LANGUAGE_CODE] 		:"",
						(records.total_orders)		? Helper.round(records.total_orders) : 0,
                        (records.delivery_type) 	? Constants.DELIVERY_BY[records.delivery_type] : "",
					];
					temp.push(buffer);
				});
			}

			/**  Function to export data in excel format **/
			Helper.exportToExcel(req,res,{
                file_prefix         : "AreaAnalysisReport ",
				heading_columns		: commonColls,
				export_data			: temp
			});
		}).catch(next);
    };// end areaAnalysisReportExport()
}