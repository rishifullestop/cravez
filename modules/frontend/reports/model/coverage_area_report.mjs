import { ObjectId } from 'mongodb';
import { parallel as asyncParallel } from 'async';
import BREADCRUMBS from "../../../../breadcrumbs.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { newDate, arrayToObject,isPost, getDropdownList, exportToExcel, round, currencyFormat, configDatatable} from "../../../../utils/index.mjs";

export default class CoverageAreaReport {
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
    async getCoverageAreaReport (req, res, next){
        try {
            let restaurantId	= (req.session.user.restaurant_id) ? new ObjectId(req.session.user.restaurant_id) :'';
			if(isPost(req)){
				let limit		= (req.body.length) 	? parseInt(req.body.length) :Constants.FRONT_LISTING_LIMIT;
				let skip		= (req.body.start)  	? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate   	= (req.body.from_date) 	? req.body.from_date 		: "";
				let toDate 	  	= (req.body.to_date)   	? req.body.to_date   		: "";
				let areaIds		= (req.body.area_ids)	? req.body.area_ids   		: [];
				let cityIds		= (req.body.city_ids)   ? req.body.city_ids   		: [];
		
				areaIds		= (areaIds && areaIds.constructor === Array) ?areaIds :[areaIds];
				cityIds		= (cityIds && cityIds.constructor === Array) ?cityIds :[cityIds];				
				
				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);
					
				let commonConditions = {restaurant_id : restaurantId};
				
				/** Condition for date */
				if (fromDate != "" && toDate != "") {
					commonConditions["date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					};
				}
				
				dataTableConfig.conditions	= Object.assign(dataTableConfig.conditions, commonConditions);
				if(areaIds.length > 0) dataTableConfig.conditions.area_id	= {$in : arrayToObject(areaIds)};
				if(cityIds.length > 0) dataTableConfig.conditions.city_id 	= {$in : arrayToObject(cityIds)};
			
				const collection = 	this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);
				asyncParallel({
					records :(callback)=>{						
						/** Get list of driver petrol consumption**/
						collection.aggregate([
							{$match : dataTableConfig.conditions},							
							{$group : {
								_id				: {area_id : "$area_id",restaurant_id : "$restaurant_id"},
								total_orders	: {$sum : "$total_orders" },
								total_amount	: {$sum : "$total_amount" },								
								city_id			: {$first: "$city_id"},													
								city_name		: {$last : "$city_name"},													
								area_name		: {$last : "$area_name"},								
							}},
							{$lookup:	{
								"from" 			: 	Tables.CITIES,
								"localField" 	:	"city_id",
								"foreignField" 	: 	"_id",
								"as" 			: 	"city_details"
							}},							
							{$addFields : {								
								city_name: {$arrayElemAt: ["$city_details.name",0]},
							}},
							{$group	: {
								_id  : {restaurant_id : "$restaurant_id"},
								data : {$push : "$$ROOT"},
								restaurant_amount : { $sum: "$total_amount"}
							}},
							{$unwind : "$data"},							
							{$project: {
								_id:0, 
								total_orders: "$data.total_orders",
								total_amount: "$data.total_amount",
								area_name: "$data.area_name."+Constants.DEFAULT_LANGUAGE_CODE,
								city_name: "$data.city_name."+Constants.DEFAULT_LANGUAGE_CODE, 
								restaurant_amount:1,
								area_sales: {$multiply:[{$divide:[100,"$restaurant_amount"]},"$data.total_amount"]}
							}},
							{$sort 	: dataTableConfig.sort_conditions},	
							{$skip 	: skip},
							{$limit : limit},
						]).toArray().then(result=>{									
							callback(null,result);
						}).catch(err=>{
							callback(err,null);
						});
					},
					total_records:(callback)=>{
						/** Get total number of records **/
						collection.aggregate([
							{$match : commonConditions},							
							{$group : {
								_id	: {area_id : "$area_id",restaurant_id : "$restaurant_id"},
							}}
						]).toArray().then(result=>{									
							callback(null,result?.length || 0);
						}).catch(err=>{
							callback(err,0);
						});
					},
					filter_records:(callback)=>{
						/** Get filtered records counting **/
						collection.aggregate([
							{$match : dataTableConfig.conditions},							
							{$group : {
								_id	: {area_id : "$area_id",restaurant_id : "$restaurant_id"},
							}}
						]).toArray().then(result=>{	
							callback(null,result?.length || 0);
						}).catch(err=>{
							callback(err,0);
						});
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
				const restaurant_branch_areas	= this.db.collection(Tables.RESTAURANT_BRANCH_AREAS);
				let areaIds = await restaurant_branch_areas.distinct("area_id",{restaurant_id : new ObjectId(restaurantId)});
				
				const areas = this.db.collection(Tables.AREAS);
				let cityIds = await areas.distinct("city_id",{_id: {$in : arrayToObject(areaIds)}});

				/**Get dropdown list **/
				let response = await getDropdownList(req,res, next,{
					collections :[						
						{
							collection : Tables.CITIES,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions : {_id : {$in : arrayToObject(cityIds)}},
						},
						{
							collection : Tables.AREAS,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions : {_id : {$in : arrayToObject(areaIds)}},
						}
					]
				});
					
				/** render listing page **/
				req.breadcrumbs(BREADCRUMBS['reports/coverage_area_report']);
				res.render('coverage_area_report',{
					city_list : response?.final_html_data?.[0] || "",
					area_list : response?.final_html_data?.[1] || ""
				});
			}
		} catch (error) {
			return next(error);
		}
    };//End getCoverageAreaReport()


    /**
     *  Function for export area sales share report
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As 	Callback argument to the middleware function
     *
     * @return null
    */
    async exportAreaSalesShare (req, res, next) {
		try {
			let restaurantId = (req.session.user.restaurant_id) ? new ObjectId(req.session.user.restaurant_id) :'';
			let fromDate	 = (req.query.from_date) ? req.query.from_date : "";
			let toDate 		 = (req.query.to_date) ? req.query.to_date : "";
			let sortingField = (req.query.sort_field) ? req.query.sort_field : "_id";
			let sortingDir   = (req.query.sort_dir) ? req.query.sort_dir : "asc";
			let sortOrder    = (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;

			let cityIds = (req.query.city_ids) ? (req.query.city_ids).split(",") : [];
			let areaIds = (req.query.area_ids) ? (req.query.area_ids).split(",") : [];

			cityIds = (cityIds && cityIds.constructor === Array) ? cityIds : [cityIds];
			areaIds = (areaIds && areaIds.constructor === Array) ? areaIds : [areaIds];
			
			/** Set sort condition */
			let sortConditions		= {};
			sortConditions[sortingField] = sortOrder;
			
			/** Set export condition */
			let exportConditions	= {restaurant_id : restaurantId};	
			if (fromDate != "" && toDate != "") exportConditions["date"] = {$gte: newDate(fromDate), $lte: newDate(toDate)};			
			if (areaIds.length > 0) exportConditions.area_id = { $in: arrayToObject(areaIds) };
			if (cityIds.length > 0) exportConditions.city_id = { $in: arrayToObject(cityIds) };

			/** Get order details **/
			const branch_wise_processed_orders	= this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);
			let result = await branch_wise_processed_orders.aggregate([
				{$match: exportConditions},						
				{$group : {
					_id				: {area_id : "$area_id",restaurant_id : "$restaurant_id"},
					total_orders	: {$sum : "$total_orders" },
					total_amount	: {$sum : "$total_amount" },								
					city_id			: {$first: "$city_id"},													
					city_name		: {$last : "$city_name"},													
					area_name		: {$last : "$area_name"},								
				}},
				{$lookup:	{
					"from" 			: 	Tables.CITIES,
					"localField" 	:	"city_id",
					"foreignField" 	: 	"_id",
					"as" 			: 	"city_details"
				}},							
				{$addFields : {								
					city_name: {$arrayElemAt: ["$city_details.name",0]},
				}},
				{$group	: {
					_id  : {restaurant_id : "$restaurant_id"},
					data : {$push : "$$ROOT"},
					restaurant_amount : { $sum: "$total_amount"}
				}},
				{$unwind : "$data"},							
				{$project: {
					_id:0, total_orders: "$data.total_orders",total_amount: "$data.total_amount",
					area_name: "$data.area_name."+Constants.DEFAULT_LANGUAGE_CODE,
					city_name: "$data.city_name."+Constants.DEFAULT_LANGUAGE_CODE, 
					restaurant_amount:1,
					area_sales: {$multiply:[{$divide:[100,"$restaurant_amount"]},"$data.total_amount"]}
				}},
				{$sort 	: sortConditions},	
			]).toArray();

			/** Define excel heading label **/
			let commonColls	= 	[			
				res.__("reports.city_name"),
				res.__("reports.area_name"),
				res.__("reports.total_orders"),
				res.__("reports.total_amount"),
				res.__("reports.sales_share"),
			];
			
			/** Define excel data **/
			let temp = [];
			if(result && result.length > 0){
				result.map(records=>{
					let totalOrders = (records.total_orders) ?  round(records.total_orders) :0;
					let totalAmount = (records.total_amount) ?  round(records.total_amount) :0;
					let buffer =	[
						(records.city_name)   ?  records.city_name      :"",
						(records.area_name)   ?  records.area_name       :"",
						totalOrders,
						currencyFormat(totalAmount),
						(records.area_sales) ?  round(records.area_sales,Constants.CURRENCY_ROUND_PRECISION)+"%" : "0%",
					];
					temp.push(buffer);
				});
			}

			/**  Function to export data in excel format **/
			exportToExcel(req,res,{
				file_prefix 		: "AreaSalesShareReport",
				heading_columns		: commonColls,
				export_data			: temp
			});			
		} catch (error) {
			return next(error);
		}
    };// end exportAreaSalesShare()
	
	/**
	 * Function for get branch list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async areaDropdown (req,res,next){
		try {
			let cityIds	= req.body.city_ids;
			if(cityIds.constructor != Array) cityIds = [cityIds];
			let restaurantId = (req.session.user.restaurant_id) ? new ObjectId(req.session.user.restaurant_id) :'';
			
			/** Send success response */
			if(cityIds.length == 0) return res.send({status: Constants.STATUS_SUCCESS, area_list: "" });

			const restaurant_branch_areas = this.db.collection(Tables.RESTAURANT_BRANCH_AREAS);
			let areaIds = await restaurant_branch_areas.distinct("area_id",{restaurant_id : restaurantId});

			/** Send success response */
			if(areaIds.length == 0) return res.send({status: Constants.STATUS_SUCCESS, area_list: "" });

			/**Get area list **/
			let dropDownResponse = await getDropdownList(req,res, next,{collections :[ {
				collection : Tables.AREAS,
				columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
				conditions : {
					_id 	: {$in : arrayToObject(areaIds)},
					is_active : Constants.ACTIVE,
					city_id : {$in : arrayToObject(cityIds)}
				}
			}]});

			/** Send success response */
			res.send({
				status    : Constants.STATUS_SUCCESS,
				area_list :	dropDownResponse?.final_html_data?.[0] || ""
			});
		} catch (error) {
			return next(error);
		}
	};//End areaDropdown()
}
