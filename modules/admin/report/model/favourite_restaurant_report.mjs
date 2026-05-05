import { ObjectId } from 'mongodb';
import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList, newDate, exportToExcel, configDatatable, currencyFormat } from '../../../../utils/index.mjs';

// Model for favourite restaurant report
export default class FavouriteRestaurantReport {
	constructor(db) {
		this.db = db;
	}

	
	/**
	 * Function to get favourite restaurant cuisines  list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getFavouriteRestaurantList(req,res,next){
		try{
			if(isPost(req)){
				let limit		 = 	(req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 = 	(req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     = 	(req.body.from_date) 	? req.body.from_date 		:"";
				let toDate 	  	 = 	(req.body.to_date)   	? req.body.to_date   		:"";
				let areaId		 = 	(req.body.area_id)		? new ObjectId(req.body.area_id):"";
				const collection = 	this.db.collection(Tables.ORDER_CUISINE_REPORTS);

				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);

				/** Set common conditions  */
				let commonConditions = {};

				/** Condition for order date */
				if (fromDate != "" && toDate != "") {
					commonConditions["date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					};
				}

				/** Add restaurant conditions  */
				if(areaId) dataTableConfig.conditions.area_id = areaId;
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);
				
				asyncParallel({
					records :(callback)=>{
						/** Get list of favourite restaurant cuisines **/
						collection.aggregate([
							{$match : dataTableConfig.conditions},
							{$group	: {
								_id : {
									branch_id    : "$branch_id",
									area_id    	 : "$area_id"
								},
								branch_id   	: { $first	: "$branch_id"},
								cuisine_id  	: { $first	: "$cuisine_id"},
								area_id  		: { $first	: "$area_id"},
								total_amount  	: { $sum	: "$total_amount"},
								restaurant_name	: { $first	: "$restaurant_name"},
								area_name		: { $first	: "$area_name"},
							}},
							{$sort	: {total_amount : Constants.SORT_DESC}},
							{$lookup: {	/** Get restaurant branch details **/
								from 		:	Tables.RESTAURANT_BRANCHES,
								localField  :	"branch_id",
								foreignField:	"_id",
								as 		  	:	"branch_details"
							}},
							{$addFields : {branch_name	: {$arrayElemAt: ["$branch_details.name",0]}}},
							{$group	: {
								_id				: "$area_id",								
								branch_id   	: { $first	: "$branch_id"},								
								area_id  		: { $first	: "$area_id"},								
								order_amount  	: { $first	: "$total_amount"},
								restaurant_name	: { $first	: "$restaurant_name."+Constants.DEFAULT_LANGUAGE_CODE},
								branch_name		: { $first	: "$branch_name."+Constants.DEFAULT_LANGUAGE_CODE},			
								area_name		: { $first	: "$area_name."+Constants.DEFAULT_LANGUAGE_CODE},
							}},							
							{$sort 	: dataTableConfig.sort_conditions},
							{$skip 	: skip},
							{$limit : limit},
						]).toArray().then(result=>{
							callback(null, result);
						}).catch(next);
					},
					total_records:(callback)=>{
						/** Get total number of records in order cuisine reports collection **/
						collection.aggregate([
							{$match: commonConditions},
							{$group:{
								_id : {
									branch_id    : "$branch_id",									
									area_id    	 : "$area_id"
								},
							}},
							{$count : "count"},
						]).toArray().then(countResult=>{
							countResult = (countResult && countResult[0] && countResult[0].count)	?	countResult[0].count :0;
							callback(null, countResult);
						}).catch(next);
					},
					filter_records:(callback)=>{
						/** Get filtered records counting in order cuisine reports**/
						collection.aggregate([
							{$match : dataTableConfig.conditions},
							{$group:{
								_id : {
									branch_id    : "$branch_id",									
									area_id    	 : "$area_id"
								},								
							}},
							{$count : "count"},
						]).toArray().then(filterContResult=>{
							filterContResult = (filterContResult && filterContResult[0] && filterContResult[0].count)	?	filterContResult[0].count :0;
							callback(null,filterContResult);
						}).catch(next);
					}
				},(err, response)=>{
					/** Send response **/
					res.send({
						status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
						draw			: dataTableConfig.result_draw,
						data			: response.records,
						recordsFiltered	: response.filter_records,
						recordsTotal	: response.total_records
					});
				});
			}else{
				/**Get dropdown list **/
				let dropDownResponse = await getDropdownList(req,res, next,{
					collections :[
						{
							collection : Tables.AREAS,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions : {},
						},					
					],
				});
				
				/** render favourite restaurant cuisines listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/report/favourite_restaurant_report']);
				res.render('favourite_restaurant_report',{
					area_list: dropDownResponse?.final_html_data?.[0] || "",			
				});
			}
		}catch(error){
			return next(error);
		}
	};//End getFavouriteRestaurantList()

	/**
	 *  Function for export favourite restaurant cuisines list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async favouriteRestaurantExport(req,res,next){
		try{
			let fromDate 	= (req.query.from_date) ? req.query.from_date : "";
			let toDate 		= (req.query.to_date) ? req.query.to_date : "";
			let sortingField= (req.query.sort_field) ? req.query.sort_field : "_id";
			let sortingDir 	= (req.query.sort_dir) ? req.query.sort_dir : "asc";
			let sortOrder 	= (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;
			let areaId 		= (req.query.area_id) ? (req.query.area_id) : "";

			let exportConditions = {};
			let sortConditions = {};
			sortConditions[sortingField] = sortOrder;

			/** Condition for date */
			if (fromDate != "" && toDate != "") {
				exportConditions["date"] = {
					$gte: newDate(fromDate),
					$lte: newDate(toDate),
				};
			}
			if (areaId) exportConditions.area_id = new ObjectId(areaId);
			
			/** Get order details **/
			const order_cuisine_reports	= this.db.collection(Tables.ORDER_CUISINE_REPORTS);
			order_cuisine_reports.aggregate([
				{ $match: exportConditions},			
				{$group	: {
					_id : {
						branch_id    : "$branch_id",
						area_id    	 : "$area_id"
					},
					branch_id   	: { $first	: "$branch_id"},
					cuisine_id  	: { $first	: "$cuisine_id"},
					area_id  		: { $first	: "$area_id"},
					total_amount  	: { $sum	: "$total_amount"},
					restaurant_name	: { $first	: "$restaurant_name"},
					area_name		: { $first	: "$area_name"},
				}},
				{$sort	: {total_amount : Constants.SORT_DESC}},
				{$lookup: {	/** Get restaurant branch details **/
					from 		:	Tables.RESTAURANT_BRANCHES,
					localField  :	"branch_id",
					foreignField:	"_id",
					as 		  	:	"branch_details"
				}},
				{$addFields : {branch_name	: {$arrayElemAt: ["$branch_details.name",0]}}},
				{$group	: {
					_id				: "$area_id",								
					branch_id   	: { $first	: "$branch_id"},								
					area_id  		: { $first	: "$area_id"},								
					order_amount  	: { $first	: "$total_amount"},
					restaurant_name	: { $first	: "$restaurant_name."+Constants.DEFAULT_LANGUAGE_CODE},
					branch_name		: { $first	: "$branch_name."+Constants.DEFAULT_LANGUAGE_CODE},			
					area_name		: { $first	: "$area_name."+Constants.DEFAULT_LANGUAGE_CODE},
				}},		
				{$sort 	: sortConditions},
			]).toArray().then(findResult=>{

				let temp			= [];
				let commonColls		= [];

				/** Define excel heading label **/
				commonColls	= [
					res.__("admin.report.restaurant_name"),
					res.__("admin.report.branch"),
					res.__("admin.report.area"),				
					res.__("admin.report.order_amount")				
				];

				if(findResult && findResult.length > 0){
					findResult.map(records=>{
						let buffer =	[
							(records.restaurant_name)	? records.restaurant_name	: "",
							(records.branch_name)		? records.branch_name		: "",
							(records.area_name)			? records.area_name			: "",						
							(records.order_amount)		? currencyFormat(records.order_amount) :""
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "favouriteRestaurantExport",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
	};// end favouriteRestaurantExport()
}
