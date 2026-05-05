import { ObjectId } from 'mongodb';
import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, newDate, exportToExcel, configDatatable, getAreaList } from '../../../../utils/index.mjs';

// Model for customer segmentation report
export default class CustomerSegmentationReport {
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
	async getCustomerSegmentationReport(req,res,next){
		try{
			if(isPost(req)){
				let limit			= (req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 	= (req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     	= (req.body.from_date) 		? req.body.from_date 		: "";
				let toDate 	  	 	= (req.body.to_date)   		? req.body.to_date   		: "";			
				let cuisineIds		= (req.body.cuisine_ids)   	? req.body.cuisine_ids   	: [];
				let customerCount	= (req.body.top_count)   	? req.body.top_count   		: "";
				let cityId			= (req.body.city_id)   		? req.body.city_id   		: "";
				let areaId			= (req.body.area_id)   		? req.body.area_id   		: "";
				
				cuisineIds	= (cuisineIds && cuisineIds.constructor === Array) ?cuisineIds :[cuisineIds];

				const collection 	= this.db.collection(Tables.ORDER_ITEMS);		
				const orders		= this.db.collection(Tables.ORDERS);

				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);
				
				let commonConditions = {};
				let orderConditions = {admin_status : Constants.ORDER_DELIVERED};
				/** Condition for order date */
				if (fromDate != "" && toDate != "") {
					orderConditions["order_date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					};
				}
				
				let topCustomerCondition	= {
					$skip : 0
				};
				
				/** Manage top customer count conditions*/
				switch(customerCount){
					case Constants.TOP_TEN:
						topCustomerCondition = {$limit : 10};
					break;
					case Constants.TOP_FIFTY:
						topCustomerCondition = {$limit : 50};
					break;
					case Constants.TOP_HUNDRED:
						topCustomerCondition = {$limit : 100};
					break;
				}

				asyncParallel({
					order_ids:(callback)=>{
						/** Get order ids  */
						orders.distinct("_id",orderConditions).then(orderIds=>{
							callback(null,orderIds);
						}).catch(next);
					},
					city_areas:(callback)=>{
						if(!cityId) return callback(null,[]);
						/** Get area ids  */
						const areas = this.db.collection(Tables.AREAS);
						areas.distinct("_id",{city_id : new ObjectId(cityId)}).then(areaIds=>{
							callback(null,areaIds);
						}).catch(next);
					},
				},(asyncErr, asyncResponse)=>{
					if(asyncErr) return next(asyncErr);
					let orderIds	= asyncResponse.order_ids;
					let cityAreas	= asyncResponse.city_areas;
					
					if(cuisineIds.length > 0) commonConditions.cuisine_ids	= {$in : arrayToObject(cuisineIds)};
					commonConditions.order_id	= {$in : arrayToObject(orderIds)};
					if(cityId) orderConditions.area_id	= {$in : arrayToObject(cityAreas)};
					if(areaId) orderConditions.area_id	= new ObjectId(areaId);
					
					dataTableConfig.conditions	= Object.assign(dataTableConfig.conditions, commonConditions);
					
					asyncParallel({
						records :(callback)=>{
							/** Get list of order count **/
							collection.aggregate([
								{$match		: dataTableConfig.conditions},	
								{$unwind	: "$cuisine_ids"},
								{$match		: dataTableConfig.conditions},	
								{$lookup: {	/** Get order details **/
									from 		:	Tables.ORDERS,
									localField  :	"order_id",
									foreignField:	"_id",
									as 		  	:	"order_details"
								}},							
								{$addFields : {									
									customer_name	: {$arrayElemAt: ["$order_details.full_name",0]},
									customer_id		: {$arrayElemAt: ["$order_details.customer_id",0]},
									mobile_number	: {$arrayElemAt: ["$order_details.mobile_number",0]},
									order_date		: {$arrayElemAt: ["$order_details.order_date",0]},
									admin_status	: {$arrayElemAt: ["$order_details.admin_status",0]},
									area_id			: {$arrayElemAt: ["$order_details.area_id",0]},
								}},
								{$match : orderConditions},
								{$group : {
									_id				: {customer_id : "$customer_id",cuisine_id : "$cuisine_ids"},
									total_items		: {$sum : 1},										
									cuisine_id		: {$first : "$cuisine_ids"},								
									customer_name	: {$last : "$customer_name"},								
									mobile_number	: {$last : "$mobile_number"},								
								}},
								{$sort 	: {total_items : Constants.SORT_DESC}},		
								topCustomerCondition,
								{$sort 	: dataTableConfig.sort_conditions},							
								{$skip 	: skip},
								{$limit : limit},							
								{$lookup: {	/** Get cuisine details **/
									from 		:	Tables.CUISINES,
									localField  :	"cuisine_id",
									foreignField:	"_id",
									as 		  	:	"cuisine_details"
								}},															
								{$project: {
									_id:0,total_items: 1,cuisine_id: 1,customer_name: 1,mobile_number: 1, cuisine_name: {$arrayElemAt: ["$cuisine_details.name."+Constants.DEFAULT_LANGUAGE_CODE,0]},
								}},							
							]).toArray().then(result=>{							
								callback(null, result);
							}).catch(next);
						},
						records_total: (callback)=>{
							/** Get total number of records **/
							collection.aggregate([
								{$match		: commonConditions},									
								{$unwind	: "$cuisine_ids"},
								{$match		: commonConditions},	
								{$lookup: {	/** Get order details **/
									from 		:	Tables.ORDERS,
									localField  :	"order_id",
									foreignField:	"_id",
									as 		  	:	"order_details"
								}},							
								{$addFields : {
									customer_id		: {$arrayElemAt: ["$order_details.customer_id",0]},						
									order_date		: {$arrayElemAt: ["$order_details.order_date",0]},
									admin_status	: {$arrayElemAt: ["$order_details.admin_status",0]},
									area_id			: {$arrayElemAt: ["$order_details.area_id",0]},
								}},
								{$match : orderConditions},
								{$group : {
									_id	: {customer_id : "$customer_id",cuisine_id : "$cuisine_ids"},						
								}},									
								topCustomerCondition,								
								{ $count	: "count" }								
							]).toArray().then(countResult=>{
								let count = (countResult && countResult[0] && countResult[0].count) ? countResult[0].count : 0;
								callback(null, count);
							}).catch(next);
						},
						records_filtered: (callback)=>{
							/** Get filtered records **/
							collection.aggregate([
								{$match		: dataTableConfig.conditions},	
								{$unwind	: "$cuisine_ids"},
								{$match		: dataTableConfig.conditions},	
								{$lookup: {	/** Get order details **/
									from 		:	Tables.ORDERS,
									localField  :	"order_id",
									foreignField:	"_id",
									as 		  	:	"order_details"
								}},							
								{$addFields : {
									customer_id		: {$arrayElemAt: ["$order_details.customer_id",0]},						
									order_date		: {$arrayElemAt: ["$order_details.order_date",0]},
									admin_status	: {$arrayElemAt: ["$order_details.admin_status",0]},
									area_id			: {$arrayElemAt: ["$order_details.area_id",0]},
								}},
								{$match : orderConditions},
								{$group : {
									_id	: {customer_id : "$customer_id",cuisine_id : "$cuisine_ids"},						
								}},									
								topCustomerCondition,								
								{ $count	: "count" }
							]).toArray().then(filterCount=>{
								filterCount = (filterCount && filterCount[0]) ? filterCount[0].count :0;
								callback(null, filterCount);
							}).catch(next);
						}
					},(err, response)=>{	
					
						/** Send response **/		
						res.send({
							status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
							draw			: dataTableConfig.result_draw,
							data			: response.records,
							recordsFiltered	: response.records_filtered,
							recordsTotal	: response.records_total,
						});
					});
				});
			}else{			
				/** Set dropdown options **/
				let options = {
					collections :[					
						{
							collection : Tables.CUISINES,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions : {},
						},
						{
							collection : Tables.CITIES,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions : {},
						}
					]
				};

				/**Get dropdown list **/
				getDropdownList(req,res, next,options).then(response=> {
					
					/** render listing page **/
					req.breadcrumbs(BREADCRUMBS['admin/report/customer_segmentation_report']);
					res.render('customer_segmentation_report',{
						cuisine_list	: response?.final_html_data?.[0] || "",					
						city_list		: response?.final_html_data?.[1] || "",					
					});
				}).catch(next);
			}
		}catch(error){
			return next(error);
		}
	};//End getCustomerSegmentationReport()

	/**
	 *  Function for export order value report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async customerSegmentationExport(req,res,next){
		try{
			let fromDate 		= (req.query.from_date) ? req.query.from_date : "";
			let toDate 			= (req.query.to_date) ? req.query.to_date : "";
			let sortingField	= (req.query.sort_field) ? req.query.sort_field : "_id";
			let sortingDir 		= (req.query.sort_dir) ? req.query.sort_dir : "asc";
			let sortOrder 		= (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;
			let cuisineIds 		= (req.query.cuisine_ids) ? (req.query.cuisine_ids).split(",") : [];
			let topCount 		= (req.query.top_count) ? (req.query.top_count) : "";
			let areaId 			= (req.query.area_id) ? (req.query.area_id) : "";
			let cityId 			= (req.query.city_id) ? (req.query.city_id) : "";

			if (cuisineIds.constructor != Array) cuisineIds = [cuisineIds];

			let exportConditions = {};
			let sortConditions = {};
			let orderConditions = { admin_status: Constants.ORDER_DELIVERED };
			sortConditions[sortingField] = sortOrder;

			/** Condition for date */
			if (fromDate != "" && toDate != "") {
				orderConditions["order_date"] = {
					$gte: newDate(fromDate),
					$lte: newDate(toDate),
				};
			}
			let topCustomerCondition = {
				$skip: 0
			};

			/** Manage top customer count conditions*/
			switch (topCount) {
				case Constants.TOP_TEN:
					topCustomerCondition = { $limit: 10 };
					break;
				case Constants.TOP_FIFTY:
					topCustomerCondition = { $limit: 50 };
					break;
				case Constants.TOP_HUNDRED:
					topCustomerCondition = { $limit: 100 };
					break;
			}

			asyncParallel({
				order_ids: (callback) => {
					/** Get order ids  */
					const orders = this.db.collection(Tables.ORDERS);
					orders.distinct("_id", orderConditions).then(orderIds=>{
						callback(null, orderIds);
					}).catch(next);
				},
				city_areas: (callback) => {
					if (!cityId) return callback(null, []);
					/** Get area ids  */
					const areas = this.db.collection(Tables.AREAS);
					areas.distinct("_id", { city_id: new ObjectId(cityId) }).then(areaIds=>{
						callback(null, areaIds);
					}).catch(next);
				},
			}, (asyncErr, asyncResponse) => {
				if (asyncErr) return next(asyncErr);
				let orderIds = asyncResponse.order_ids;
				let cityAreas = asyncResponse.city_areas;

				if (cuisineIds.length > 0) exportConditions.cuisine_ids = { $in: arrayToObject(cuisineIds) };
				exportConditions.order_id = { $in: arrayToObject(orderIds) };
				if (cityId) orderConditions.area_id = { $in: arrayToObject(cityAreas) };
				if (areaId) orderConditions.area_id = new ObjectId(areaId);

				/** Get order details **/
				const order_items	= this.db.collection(Tables.ORDER_ITEMS);
				order_items.aggregate([
					{ $match	: exportConditions},							
					{$unwind	: "$cuisine_ids"},
					{ $match	: exportConditions},	
					{$lookup: {	/** Get order details **/
						from 		:	Tables.ORDERS,
						localField  :	"order_id",
						foreignField:	"_id",
						as 		  	:	"order_details"
					}},							
					{$addFields : {									
						customer_name	: {$arrayElemAt: ["$order_details.full_name",0]},
						customer_id		: {$arrayElemAt: ["$order_details.customer_id",0]},
						mobile_number	: {$arrayElemAt: ["$order_details.mobile_number",0]},
						order_date		: {$arrayElemAt: ["$order_details.order_date",0]},
						admin_status	: {$arrayElemAt: ["$order_details.admin_status",0]},
						area_id			: {$arrayElemAt: ["$order_details.area_id",0]},
					}},
					{$match : orderConditions},
					{$group : {
						_id				: {customer_id : "$customer_id",cuisine_id : "$cuisine_ids"},
						total_items		: {$sum : 1},										
						cuisine_id		: {$first : "$cuisine_ids"},								
						customer_name	: {$last : "$customer_name"},								
						mobile_number	: {$last : "$mobile_number"},								
					}},
					{$sort 	: {total_items : Constants.SORT_DESC}},		
					topCustomerCondition,
					{$sort 	: sortConditions},														
					{$lookup: {	/** Get cuisine details **/
						from 		:	Tables.CUISINES,
						localField  :	"cuisine_id",
						foreignField:	"_id",
						as 		  	:	"cuisine_details"
					}},															
					{$project: {
						_id: 0, total_items: 1, cuisine_id: 1, customer_name: 1, mobile_number: 1, cuisine_name: { $arrayElemAt: ["$cuisine_details.name." + Constants.DEFAULT_LANGUAGE_CODE, 0] },
					}},			
				]).toArray().then(findResult=>{

					let temp			= [];
					let commonColls		= [];

					/** Define excel heading label **/
					commonColls		= 	[
						res.__("admin.report.customer_name"),
						res.__("admin.report.mobile_number"),
						res.__("admin.report.cuisine"),
						res.__("admin.report.total_items"),
					];


					if(findResult && findResult.length > 0){
						findResult.map(records=>{
							let buffer =	[
								(records.customer_name)   ?  records.customer_name   : "",
								(records.mobile_number)   ?  records.mobile_number   : "",
								(records.cuisine_name)	  ?  records.cuisine_name      : "",						
								(records.total_items) 	  ? records.total_items      : "",
							];
							temp.push(buffer);
						});
					}
				
					/**  Function to export data in excel format **/
					exportToExcel(req,res,{
						file_prefix 		: "CustomerSegmentationReport",
						heading_columns		: commonColls,
						export_data			: temp
					});
				}).catch(next);
			});
		}catch(error){
			return next(error);
		}
	};// end customerSegmentationExport()
	
	
	/**
	 *  Function for get city wise area list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
    */
	async getCityAreas(req,res,next){
		try{
			if(!req.body.city_id) return res.send({status : Constants.STATUS_ERROR,message : res.__("admin.system.invalid_access")});

			let areaList = await getAreaList(req,res,next,{city_id : req.body.city_id});

			res.send({
				status 		: Constants.STATUS_SUCCESS,
				area_list	: areaList
			});
		}catch(error){
			return next(error);
		}
	};
}
