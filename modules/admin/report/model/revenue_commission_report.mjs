import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, newDate, exportToExcel, configDatatable, currencyFormat } from '../../../../utils/index.mjs';

// Model for revenue commission report
export default class RevenueCommissionReport {
	constructor(db) {
		this.db = db;
	}
	/**
	 * Function to get revenue commission list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getRevenueCommissionList(req,res,next){
		try{
			if(isPost(req)){ 
				let limit			= (req.body.length) 	? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 	= (req.body.start)  	? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     	= (req.body.from_date) 	? req.body.from_date 		:"";
				let toDate 	  	 	= (req.body.to_date)   	? req.body.to_date   		:"";
				let branchIds		= (req.body.branch_ids) ? req.body.branch_ids   	:[];
				let restaurantIds	= (req.body.restaurant_ids)? req.body.restaurant_ids:[];
				let cityIds			= (req.body.city_ids)   ? req.body.city_ids:[];
				const collection 	= this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);

				if(restaurantIds.constructor != Array) restaurantIds = [restaurantIds];
				if(branchIds.constructor != Array) 	branchIds	= [branchIds];
				if(cityIds.constructor != Array) 	cityIds	= [cityIds];

				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);

					/** Condition for date */
					if (fromDate != "" && toDate != "") {
						dataTableConfig.conditions["date"] = {
							$gte 	: newDate(fromDate),
							$lte 	: newDate(toDate),
						};
					}

					if(restaurantIds.length > 0){
						dataTableConfig.conditions.restaurant_id = {$in: arrayToObject(restaurantIds)};
					}

					if(branchIds.length > 0){
						dataTableConfig.conditions.branch_id = {$in: arrayToObject(branchIds)};
					}

					if(cityIds.length > 0){
						dataTableConfig.conditions.city_id 	= {$in: arrayToObject(cityIds)};
					}
					
					asyncParallel({
						records :(callback)=>{
							/** Get list of driver petrol consumption**/
							collection.aggregate([
								{$match : dataTableConfig.conditions},
								{$lookup:	{
									"from" 			: 	Tables.RESTAURANT_BRANCHES,
									"localField" 	:	"branch_id",
									"foreignField" 	: 	"_id",
									"as" 			: 	"branch_details"
								}},							
								{$lookup:	{
									"from" 			: 	Tables.CITIES,
									"localField" 	:	"city_id",
									"foreignField" 	: 	"_id",
									"as" 			: 	"city_details"
								}},							
								{$addFields : {
									branch_name: {$arrayElemAt: ["$branch_details.name",0]},
									city_name: {$arrayElemAt: ["$city_details.name",0]},
								}},
								{$group : {
									_id					: {
										"restaurant_id" : "$restaurant_id",
										"branch_id" 	: "$branch_id",
										"city_id" 		: "$city_id",
									},
									commission			: {$sum  : "$restaurant_payout" },
									branch_id			: {$first: "$branch_id"},
									restaurant_id		: {$first: "$restaurant_id"},
									restaurant_name		: {$last : "$restaurant_name"},
									branch_name			: {$first : "$branch_name"},	
									city_name			: {$first : "$city_name"},	
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
								{$group : {
									_id					: {
										"restaurant_id" : "$restaurant_id",
										"branch_id" 	: "$branch_id",
										"city_id" 		: "$city_id"
									}
								}}
							]).toArray().then(countResult=>{
								callback(null, countResult.length);
							}).catch(next);
						},
						filter_records:(callback)=>{
							/** Get filtered records counting **/
							collection.aggregate([
								{$match : dataTableConfig.conditions},
								{$group : {
									_id					: {
										"restaurant_id" : "$restaurant_id",
										"branch_id" 	: "$branch_id",
										"city_id" 		: "$city_id"
									}
								}}
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
					})
			}else{

				/**Get dropdown list **/
				getDropdownList(req,res, next,{ 
					collections :[ 
						{
							collection : Tables.RESTAURANTS,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions : {
								is_deleted	: Constants.NOT_DELETED
							},
						},
						{
							collection : Tables.CITIES,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
						}
					] 
				}).then(response=> {	

					/** render listing page **/
					req.breadcrumbs(BREADCRUMBS['admin/report/revenue_commission_report']);
					res.render('revenue_commission_report',{
						restaurant_list : response?.final_html_data?.[0] || "",
						city_list 		: response?.final_html_data?.[1] || "",
					});
				}).catch(next);
			}
		}catch(error){
			return next(error);
		}
	};//End getRevenueCommissionList()

	/**
	 *  Function for revenue commission report export
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async getRevenueCommissionReportExport(req,res,next){
		try{
			let fromDate 		= (req.query.from_date) ? req.query.from_date : "";
			let toDate 			= (req.query.to_date) ? req.query.to_date : "";
			let sortingField 	= (req.query.sort_field) ? req.query.sort_field : "_id";
			let sortingDir 		= (req.query.sort_dir) ? req.query.sort_dir : "asc";
			let sortOrder 		= (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;
			let restaurantIds 	= (req.query.restaurant_ids) ? (req.query.restaurant_ids).split(",") : [];
			let branchIds 		= (req.query.branch_ids) ? (req.query.branch_ids).split(",") : [];
			let cityIds 		= (req.query.city_ids) ? (req.query.city_ids).split(",") : [];

			restaurantIds 	= (restaurantIds && restaurantIds.constructor === Array) ? restaurantIds : [restaurantIds];
			branchIds 		= (branchIds && branchIds.constructor === Array) ? branchIds : [branchIds];
			cityIds 		= (cityIds && cityIds.constructor === Array) ? cityIds : [cityIds];

			let sortConditions = {};
			let exportConditions = {};
			sortConditions[sortingField] = sortOrder;

			if (fromDate != "" && toDate != "") {
				exportConditions["date"] = {
					$gte: newDate(fromDate),
					$lte: newDate(toDate),
				};
			}

			if (restaurantIds.length > 0) exportConditions.restaurant_id = { $in: arrayToObject(restaurantIds) };
			if (branchIds.length > 0) exportConditions.branch_id = { $in: arrayToObject(branchIds) };
			if (cityIds.length > 0) exportConditions.city_id = { $in: arrayToObject(cityIds) };

			/** Get order details **/
			const branch_wise_processed_orders	= this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);
			branch_wise_processed_orders.aggregate([
				{ $match: exportConditions},
				{$sort 	: sortConditions},
				{$lookup:	{
					"from" 			: 	Tables.RESTAURANT_BRANCHES,
					"localField" 	:	"branch_id",
					"foreignField" 	: 	"_id",
					"as" 			: 	"branch_details"
				}},							
				{$lookup:	{
					"from" 			: 	Tables.CITIES,
					"localField" 	:	"city_id",
					"foreignField" 	: 	"_id",
					"as" 			: 	"city_details"
				}},							
				{$addFields : {
					branch_name: {$arrayElemAt: ["$branch_details.name",0]},
					city_name: {$arrayElemAt: ["$city_details.name",0]},
				}},
				{$group : {
					_id					: {
						"restaurant_id" : "$restaurant_id",
						"branch_id" 	: "$branch_id",
						"city_id" 		: "$city_id"
					},
					commission			: {$sum  : "$restaurant_payout" },
					branch_id			: {$first: "$branch_id"},
					restaurant_id		: {$first: "$restaurant_id"},
					restaurant_name		: {$last : "$restaurant_name"},
					branch_name			: {$first : "$branch_name"},	
					city_name			: {$first : "$city_name"},	
				}},
			]).toArray().then(findResult=>{

				let temp			= [];
				let commonColls		= [];

				/** Define excel heading label **/
				commonColls	= [
					res.__("admin.report.restaurant_name"),
					res.__("admin.report.branch_name"),
					res.__("admin.report.city_name"),
					res.__("admin.report.commission"),
				];

				if(findResult && findResult.length > 0){
					findResult.map(records=>{
						let buffer =	[
							(records.restaurant_name)	? 	records.restaurant_name[Constants.DEFAULT_LANGUAGE_CODE]:"",
							(records.branch_name)		? 	records.branch_name[Constants.DEFAULT_LANGUAGE_CODE] 	:"",
							(records.city_name)			? 	records.city_name[Constants.DEFAULT_LANGUAGE_CODE] 		:"",
							(records.commission)		? 	currencyFormat(records.commission) : currencyFormat(0),	
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "RevenueCommissionReport",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
	};// end getRevenueCommissionReportExport()
}