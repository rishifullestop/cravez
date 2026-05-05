import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, newDate, exportToExcel, configDatatable } from '../../../../utils/index.mjs';

// Model for restaurant busy report
export default class RestaurantBusyReport {
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
	async getBusyReportList(req,res,next){
		try{
			if(isPost(req)){
				let limit			= (req.body.length) 	? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 	= (req.body.start)  	? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     	= (req.body.from_date) 	? req.body.from_date 		:"";
				let toDate 	  	 	= (req.body.to_date)   	? req.body.to_date   		:"";
				let branchIds		= (req.body.branch_ids) ? req.body.branch_ids   	:[];
				let restaurantIds	= (req.body.restaurant_ids)	? req.body.restaurant_ids:[];

				const collection 	= this.db.collection(Tables.BRANCH_BUSY_STATUS_LOGS);

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
								branch_id 	: 1, restaurant_id 	: 1, busy_status_time : 1,
								available_time : 1,
							}},
							{$sort 	: dataTableConfig.sort_conditions},
							{$skip 	: skip},
							{$limit : limit},
						]).toArray().then(result=>{
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
						is_deleted: Constants.NOT_DELETED
					},
				}] });
					
				/** render listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/report/restaurant_busy_report']);
				res.render('restaurant_busy_report',{
					restaurant_list : response?.final_html_data?.["0"] || ""
				});
			}
		}catch(error){
			return next(error);
		}
	};//End getBusyReportList()


	/**
	 *  Function for export restaurants busy report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async exportBusyReport(req,res,next){
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
			const collection = this.db.collection(Tables.BRANCH_BUSY_STATUS_LOGS);
			collection.aggregate([
				{$match : exportConditions},
				{$lookup: {
					"from"			: Tables.RESTAURANT_BRANCHES,
					"localField"	: "branch_id",
					"foreignField"	: "_id",
					"as"			: "branch_details"
				}},
				{$lookup: {
					"from"			: Tables.RESTAURANTS,
					"localField"	: "restaurant_id",
					"foreignField"	: "_id",
					"as"			: "restaurant_details"
				}},
				{$project: {
						branch_name		: { $arrayElemAt: ["$branch_details.name", 0] },
					restaurant_name	: { $arrayElemAt: ["$restaurant_details.name", 0] },
					branch_id: 1, restaurant_id: 1, busy_status_time: 1,
					available_time: 1,
				}},
				{$sort 	: sortConditions},
			]).toArray().then(findResult=>{

				let temp			= [];
				let commonColls		= [];

				/** Define excel heading label **/

				commonColls	= [
					res.__("admin.report.restaurant_name"),
					res.__("admin.report.branch_name"),
					res.__("admin.report.busy_time"),
					res.__("admin.report.available_time"),
				];

				if(findResult && findResult.length > 0){
					findResult.map(records=>{
						let buffer =	[
							(records.restaurant_name)	? records.restaurant_name[Constants.DEFAULT_LANGUAGE_CODE] :"",
							(records.branch_name)		? records.branch_name[Constants.DEFAULT_LANGUAGE_CODE] 	:"",
							(records.busy_status_time) ? newDate(records.busy_status_time, Constants.AM_PM_FORMAT_WITH_DATE) : "",
							(records.available_time) ? newDate(records.available_time, Constants.AM_PM_FORMAT_WITH_DATE) : "",
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "RestaurantsBusyReport",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
	};// end exportBusyReport()
}
