import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, newDate, exportToExcel, configDatatable, getDifferenceBetweenTwoDatesInMinute, round } from '../../../../utils/index.mjs';

// Model for restaurant open close report
export default class RestaurantOpenCloseReport {
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
    async getRestaurantOpenCloseReportList(req,res,next){
		try{
			if(isPost(req)){
				let limit			= (req.body.length) 	? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 	= (req.body.start)  	? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     	= (req.body.from_date) 	? req.body.from_date 		:"";
				let toDate 	  	 	= (req.body.to_date)   	? req.body.to_date   		:"";
				let branchIds		= (req.body.branch_ids) ? req.body.branch_ids   	:[];
				let restaurantIds	= (req.body.restaurant_ids)	? req.body.restaurant_ids:[];

				const collection = this.db.collection(Tables.BRANCH_OPEN_CLOSE_LOGS);

				if(restaurantIds.constructor != Array) restaurantIds = [restaurantIds];
				if(branchIds.constructor != Array) 	branchIds	= [branchIds];

				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);
				let commonConditions = {};
				/** Condition for date */
				if (fromDate != "" && toDate != "") {
					commonConditions.created = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					};
				}

				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions,commonConditions);
				if(restaurantIds.length > 0) dataTableConfig.conditions.restaurant_id = {$in: arrayToObject(restaurantIds)};
				if(branchIds.length > 0) dataTableConfig.conditions.branch_id = {$in: arrayToObject(branchIds)};

				asyncParallel({
					records :(callback)=>{
						collection.aggregate([
							{$match : dataTableConfig.conditions},
							{$lookup:	{
								"from" 			: 	Tables.RESTAURANT_BRANCHES,
								"localField" 	:	"branch_id",
								"foreignField" 	: 	"_id",
								"as" 			: 	"branch_details"
							}},
							{$lookup:	{
								"from" 			: 	Tables.RESTAURANTS,
								"localField" 	:	"restaurant_id",
								"foreignField" 	: 	"_id",
								"as" 			: 	"restaurant_details"
							}},
							{$project : {
								branch_name: {$arrayElemAt: ["$branch_details.name",0]},
								restaurant_name: {$arrayElemAt: ["$restaurant_details.name",0]},
								branch_id: 1, restaurant_id: 1, closing_time : 1,
								opening_time : 1,
							}},
							{$sort 	: dataTableConfig.sort_conditions},
							{$skip 	: skip},
							{$limit : limit},
						]).toArray().then(result=>{
							result.map(record=>{
								var diff = "";
								if (record.closing_time && record.opening_time) {
									diff = getDifferenceBetweenTwoDatesInMinute(record.opening_time, record.closing_time);
									diff = diff/60;
								}
								record.difference = round(diff);
							});
							callback(null,result);
						}).catch(next);
					},
					total_records:(callback)=>{
						/** Get total number of records **/
						collection.aggregate([
							{$match : commonConditions},
						]).toArray().then(countResult=>{
							callback(null, countResult.length);
						}).catch(next);
					},
					filter_records:(callback)=>{
						/** Get filtered records counting **/
						collection.aggregate([
							{$match : dataTableConfig.conditions},
						]).toArray().then(countResult=>{
							callback(null, countResult.length);
						}).catch(next);
					}
				},(err, response)=>{
					/** Send response **/
					res.send({
						status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
						draw			: dataTableConfig.result_draw,
						data			: response.records,
						recordsFiltered	: response.filter_records,
						recordsTotal	: response.total_records,
					});
				});
			}else{
				/**Get dropdown list **/
				let response = await getDropdownList(req,res, next,{ collections :[ {
					collection : Tables.RESTAURANTS,
					columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
					conditions : {
						is_deleted	: Constants.NOT_DELETED
					},
				}] });

				/** render listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/report/restaurant_open_close_report']);
				res.render('restaurant_open_close_report',{
					restaurant_list : response?.final_html_data?.["0"] || ""
				});
			}
		}catch(error){
			return next(error);
		}
    };//End getRestaurantOpenCloseReportList()


	/**
	 *  Function for export restaurants open close report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async restaurantOpenCloseReportExport(req,res,next){
		try{
			let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
			let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";
			let sortingField  	= (req.query.sort_field) ? req.query.sort_field   	: "_id";
			let sortingDir 	 	= (req.query.sort_dir) ? req.query.sort_dir   		: "asc";
			let sortOrder		= (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;
			let branchIds		= (req.query.branch_ids) ? (req.query.branch_ids).split(",")   	: [];
			let restaurantIds	= (req.query.restaurant_ids)? (req.query.restaurant_ids).split(","): [];
			
			if(restaurantIds.constructor != Array) restaurantIds = [restaurantIds];
			if(branchIds.constructor != Array) 	branchIds	= [branchIds];
			
			let exportConditions	= {};
			let sortConditions		= {};
			sortConditions[sortingField] = sortOrder;

			/** Condition for date */
			if (fromDate != "" && toDate != "") {
				exportConditions["created"] = {
					$gte 	: newDate(fromDate),
					$lte 	: newDate(toDate),
				};
			}

			if(restaurantIds.length > 0) exportConditions.restaurant_id = {$in: arrayToObject(restaurantIds)};
			if(branchIds.length > 0) exportConditions.branch_id = {$in: arrayToObject(branchIds)};
			
			/** Get details **/
			const collection = this.db.collection(Tables.BRANCH_OPEN_CLOSE_LOGS);

			collection.aggregate([
				{$match : exportConditions},
				{
					$lookup: {
						"from"			: Tables.RESTAURANT_BRANCHES,
						"localField"	: "branch_id",
						"foreignField"	: "_id",
						"as"			: "branch_details"
					}
				},
				{
					$lookup: {
						"from"			: Tables.RESTAURANTS,
						"localField"	: "restaurant_id",
						"foreignField"	: "_id",
						"as"			: "restaurant_details"
					}
				},
				{
					$project: {
						branch_name		: { $arrayElemAt: ["$branch_details.name", 0] },
						restaurant_name	: { $arrayElemAt: ["$restaurant_details.name", 0] },
						branch_id: 1, restaurant_id: 1, closing_time: 1,
						opening_time: 1,
					}
				},
				{$sort 	: sortConditions},
			]).toArray().then(findResult=>{
				findResult.map(record => {
					var diff = "";
					if (record.closing_time && record.opening_time) {
						diff = getDifferenceBetweenTwoDatesInMinute(record.opening_time, record.closing_time);
					}
					record.difference = round(diff/60);
				});

				let temp			= [];
				let commonColls		= [];

				/** Define excel heading label **/

				commonColls	= [
					res.__("admin.report.restaurant_name"),
					res.__("admin.report.branch_name"),
					res.__("admin.report.open_time"),
					res.__("admin.report.close_time"),
					res.__("admin.report.opened_time"),
				];

				if(findResult && findResult.length > 0){
					findResult.map(records=>{
						let buffer =	[
							(records.restaurant_name)	? records.restaurant_name[Constants.DEFAULT_LANGUAGE_CODE] :"",
							(records.branch_name)		? records.branch_name[Constants.DEFAULT_LANGUAGE_CODE] 	:"",
							(records.opening_time)      ? newDate(records.opening_time, Constants.AM_PM_FORMAT_WITH_DATE) : "",
							(records.closing_time)      ? newDate(records.closing_time, Constants.AM_PM_FORMAT_WITH_DATE) : "",
							(records.difference)        ? records.difference : "",
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "RestaurantsOpenCloseReport",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
    };// end restaurantOpenCloseReportExport()
}
