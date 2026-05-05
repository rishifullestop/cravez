import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, newDate, exportToExcel, configDatatable, currencyFormat, getDifferenceBetweenTwoDatesInMinute } from '../../../../utils/index.mjs';

// Model for delivery fees revenue report
export default class DeliveryFeesRevenueReport {
	constructor(db) {
		this.db = db;
	}

	/**
	 * Function to get delivery fees revenue report list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getDeliveryFeesReportList(req,res,next){
		try{
			if(isPost(req)){
				let limit			= (req.body.length) 	? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 	= (req.body.start)  	? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     	= (req.body.from_date) 	? req.body.from_date 		:"";
				let toDate 	  	 	= (req.body.to_date)   	? req.body.to_date   		:"";
				let areaIds			= (req.body.area_ids)   ? req.body.area_ids   		:[];
				let branchIds		= (req.body.branch_ids) ? req.body.branch_ids   	:[];
				let restaurantIds	= (req.body.restaurant_ids)? req.body.restaurant_ids:[];
				let cityIds			= (req.body.city_ids)   ? req.body.city_ids:[];
				const collection 	= this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);

				if(restaurantIds.constructor != Array) restaurantIds = [restaurantIds];
				if(areaIds.constructor != Array) 	areaIds 	= [areaIds];
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

				if(areaIds.length > 0){
					dataTableConfig.conditions.area_id 	= {$in: arrayToObject(areaIds)};
				}

				if(cityIds.length > 0){
					dataTableConfig.conditions.city_id 	= {$in: arrayToObject(cityIds)};
				}

				let commonConditions	=	{
					delivery_type	:	{$in : [Constants.DELIVERY_BY_CRAVEZ,Constants.DELIVERY_BY_RESTAURANT]}
				};

				dataTableConfig.conditions	=	Object.assign(commonConditions,dataTableConfig.conditions);

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
									"area_id" 		: "$area_id",
									"delivery_type" : "$delivery_type",
								},
								delivery_fee		: {$sum  : "$delivery_fee" },
								branch_id			: {$first: "$branch_id"},
								area_id				: {$first: "$area_id"},
								restaurant_id		: {$first: "$restaurant_id"},
								area_name			: {$last : "$area_name"},
								restaurant_name		: {$last : "$restaurant_name"},
								branch_name			: {$first : "$branch_name"},
								city_name			: {$first : "$city_name"},
								total_orders		: {$sum  : "$total_orders" },
								delivery_type		: {$first : "$delivery_type"},
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
							{$group : {
								_id					: {
									"restaurant_id" : "$restaurant_id",
									"branch_id" 	: "$branch_id",
									"area_id" 		: "$area_id"
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
									"area_id" 		: "$area_id"
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
				});				
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
					req.breadcrumbs(BREADCRUMBS['admin/report/delivery_fees_revenue_report']);
					res.render('delivery_fees_revenue_report',{
						restaurant_list : response?.final_html_data?.[0] || "",
						city_list 		: response?.final_html_data?.[1] || "",
					});
				}).catch(next);
			}
		}catch(error){
			return next(error);
		}
	};//End getDeliveryFeesReportList()

	/**
	 *  Function for delivery fees revenue report export
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async getDeliveryFeesRevenueReportExport(req,res,next){
		try{
			let fromDate 		= (req.query.from_date) ? req.query.from_date : "";
			let toDate 			= (req.query.to_date) ? req.query.to_date : "";
			let sortingField 	= (req.query.sort_field) ? req.query.sort_field : "_id";
			let sortingDir 		= (req.query.sort_dir) ? req.query.sort_dir : "asc";
			let sortOrder 		= (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;
			let restaurantIds 	= (req.query.restaurant_ids) ? (req.query.restaurant_ids).split(",") : [];
			let branchIds 		= (req.query.branch_ids) ? (req.query.branch_ids).split(",") : [];
			let areaIds 		= (req.query.area_ids) ? (req.query.area_ids).split(",") : [];
			let cityIds 		= (req.query.city_ids) ? (req.query.city_ids).split(",") : [];

			restaurantIds 	= (restaurantIds && restaurantIds.constructor === Array) ? restaurantIds : [restaurantIds];
			branchIds 		= (branchIds && branchIds.constructor === Array) ? branchIds : [branchIds];
			areaIds 		= (areaIds && areaIds.constructor === Array) ? areaIds : [areaIds];
			cityIds 		= (cityIds && cityIds.constructor === Array) ? cityIds : [cityIds];

			let diffDays = 1;
			if (fromDate && toDate) {
				let difference = getDifferenceBetweenTwoDatesInMinute(fromDate, toDate);
				diffDays = (difference / Constants.MINUTES_IN_A_HOUR) / Constants.HOURS_IN_A_DAY;
			}

			let exportConditions = {
				delivery_type	:	{$in : [Constants.DELIVERY_BY_CRAVEZ,Constants.DELIVERY_BY_RESTAURANT]}
			};
			let sortConditions = {};
			sortConditions[sortingField] = sortOrder;

			if (fromDate != "" && toDate != "") {
				exportConditions["date"] = {
					$gte: newDate(fromDate),
					$lte: newDate(toDate),
				};
			}

			if (restaurantIds.length > 0) exportConditions.restaurant_id = { $in: arrayToObject(restaurantIds) };
			if (branchIds.length > 0) exportConditions.branch_id = { $in: arrayToObject(branchIds) };
			if (areaIds.length > 0) exportConditions.area_id = { $in: arrayToObject(areaIds) };
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
						"area_id" 		: "$area_id",
						"delivery_type" : "$delivery_type",
					},
					delivery_fee		: {$sum  : "$delivery_fee" },
					branch_id			: {$first: "$branch_id"},
					area_id				: {$first: "$area_id"},
					restaurant_id		: {$first: "$restaurant_id"},
					area_name			: {$last : "$area_name"},
					restaurant_name		: {$last : "$restaurant_name"},
					branch_name			: {$first : "$branch_name"},
					city_name			: {$first : "$city_name"},
					total_orders		: {$sum  : "$total_orders" },
					delivery_type		: {$first : "$delivery_type"},
				}},
			]).toArray().then(findResult=>{

				let temp			= [];
				let commonColls		= [];

				/** Define excel heading label **/
				commonColls	= [
					res.__("admin.report.restaurant_name"),
					res.__("admin.report.branch_name"),
					res.__("admin.report.area_name"),
					res.__("admin.report.city_name"),
					res.__("admin.report.delivery_by"),
					res.__("admin.report.qty"),
					res.__("admin.report.total_delivery_fees"),
				];

				if(findResult && findResult.length > 0){
					findResult.map(records=>{
						let buffer =	[
							(records.restaurant_name)	? 	records.restaurant_name[Constants.DEFAULT_LANGUAGE_CODE]:"",
							(records.branch_name)		? 	records.branch_name[Constants.DEFAULT_LANGUAGE_CODE] 	:"",
							(records.area_name)			? 	records.area_name[Constants.DEFAULT_LANGUAGE_CODE] 		:"",
							(records.city_name)			? 	records.city_name[Constants.DEFAULT_LANGUAGE_CODE] 		:"",
							(records.delivery_type)		? 	Constants.DELIVERY_BY[records.delivery_type] 			:"",
							(records.total_orders)		? 	records.total_orders 		: 0,
							(records.delivery_fee)		? 	currencyFormat(records.delivery_fee) : 0
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "DeliveryFeesRevenueExport",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
	};// end getDeliveryFeesRevenueReportExport()

	/**
	 * Function for get area list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async cityAreaDropdown(req,res,next){
		try{
			let branchIds	= (req.body.branch_ids) ? req.body.branch_ids : [];
			let cityIds		= (req.body.city_ids) ? req.body.city_ids : [];
			if(branchIds.constructor != Array) branchIds = [branchIds];
			if(cityIds.constructor != Array) cityIds = [cityIds];

			asyncParallel({
				restaurant_areas :(callback)=>{
					if(branchIds.length == 0) return callback(null,null);
					const restaurant_branch_areas = this.db.collection(Tables.RESTAURANT_BRANCH_AREAS);
					restaurant_branch_areas.distinct("area_id",{branch_id : {$in : arrayToObject(branchIds)}}).then(areaIds=>{
						callback(null,areaIds);
					}).catch(next);
				}
			},(err, response)=>{
				if(err) return next(err);

				let areaIds	 =	(response.restaurant_areas) ? response.restaurant_areas : [];

				let conditions = {is_active : Constants.ACTIVE};
				if(branchIds.length > 0){
					conditions["_id"]	=	{$in : arrayToObject(areaIds)};
				}
				if(cityIds.length > 0){
					conditions["city_id"]	=	{$in : arrayToObject(cityIds)};
				}

				/**Get area list **/
				getDropdownList(req,res, next,{collections :[ {
					collection : Tables.AREAS,
					columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
					conditions : conditions
				}]}).then(dropDownResponse=> {
					if(dropDownResponse.status != Constants.STATUS_SUCCESS) return res.send(dropDownResponse);

					/** Send success response */
					res.send({
						status    : Constants.STATUS_SUCCESS,
						area_list :	dropDownResponse?.final_html_data?.[0] || ""
					});
				}).catch(next);
			});
		}catch(error){
			return next(error);
		}
	};//End cityAreaDropdown()
}
