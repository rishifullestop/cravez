import { ObjectId } from 'mongodb';
import { parallel as asyncParallel } from 'async';
import BREADCRUMBS from "../../../../breadcrumbs.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { newDate, arrayToObject,isPost, getDropdownList, exportToExcel, configDatatable,} from "../../../../utils/index.mjs";

export default class MenuEngineeringReport {
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
    async getMenuEngineeringReportList (req, res, next) {
		try {
			let restaurantId	= (req.session.user.restaurant_id) ? new ObjectId(req.session.user.restaurant_id) :'';
			if(isPost(req)){
				let limit		 = (req.body.length) 		? parseInt(req.body.length) :Constants.FRONT_LISTING_LIMIT;
				let skip		 = (req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     = (req.body.from_date) 	? req.body.from_date 		:"";
				let toDate 	  	 = (req.body.to_date)   	? req.body.to_date   		:"";
				let branchIds	 = (req.body.branch_ids)   	? req.body.branch_ids   	: [];
				
				branchIds = (branchIds && branchIds.constructor === Array) ? branchIds : [branchIds];
				
				/** Set order condition */
				let orderConditions = {
					restaurant_id: restaurantId,
					admin_status : Constants.ORDER_DELIVERED,
				};			
				/** Condition for order date */
				if (fromDate != "" && toDate != "") {
					orderConditions = {...{
						order_date : {
							$gte 	: newDate(fromDate),
							$lte 	: newDate(toDate),
						}
					}, ...orderConditions};
				}
				if (branchIds.length > 0) orderConditions.branch_id = { $in: arrayToObject(branchIds) };
				
				const orders = 	this.db.collection(Tables.ORDERS);
				let orderIds = await orders.distinct("_id",orderConditions);			

				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);

				/** Set common condition */
				let commonConditions = {order_id: { $in : orderIds}};
				
				dataTableConfig.conditions	= Object.assign(dataTableConfig.conditions, commonConditions);
				
				const collection = 	this.db.collection(Tables.ORDER_ITEMS);
				asyncParallel({
					lowest_selling_items_list :(callback)=>{
						/** Get list of top selling items **/
						collection.aggregate([
							{$match : dataTableConfig.conditions},
							{$lookup:	{ /** Get item details **/
								"from" 			: 	Tables.ITEMS,
								"localField" 	:	"item_id",
								"foreignField" 	: 	"_id",
								"as" 			: 	"item_detail"
							}},
							{$addFields : { item_name: {$arrayElemAt: ["$item_detail.name."+Constants.DEFAULT_LANGUAGE_CODE,0]} }},
							{$group: {
								_id: {
									item_id : "$item_id"
								},
								item_id 	: {$first : "$item_id"},
								item_name  	: {$first : "$item_name"},
								quantity: { $sum: "$qty"}
							}},
							{$sort: { quantity: Constants.SORT_ASC}},
							{$skip 	: skip},
							{$limit : limit},
						]).toArray().then(result=>{
							callback(null, result);
						}).catch(err=>{
							callback(err, []);
						});
					},
					records_total: (callback)=>{
						/** Get total number of records in order items  collection **/
						collection.distinct("item_id",commonConditions).then(itemIds=>{
							let count = itemIds.length;
							callback(null, count);
						}).catch(err=>{
							callback(err, 0);
						});
					},
					records_filtered: (callback)=>{
						/** Get filtered records counting in order items   **/
						collection.distinct("item_id",dataTableConfig.conditions).then(itemIds=>{
							let filterCount = itemIds.length;
							callback(null, filterCount);
						}).catch(err=>{
							callback(err, 0);
						});
					}
				},(err, response)=>{
					/** Send response **/
					res.send({
						status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
						draw			: dataTableConfig.result_draw,
						data			: response.lowest_selling_items_list,
						recordsFiltered	: response.records_filtered,
						recordsTotal	: response.records_total,
					});
				});
			}else{	
				/**Get dropdown list **/
				let response = await getDropdownList(req, res, next, {
					collections: [
						{
							collection	: Tables.RESTAURANT_BRANCHES,
							columns		: ["_id", ["name", Constants.DEFAULT_LANGUAGE_CODE]],
							conditions	: {
								restaurant_id	: restaurantId,
								is_active		: Constants.ACTIVE,
							},
						}
					]
				});
					
				/** render listing page **/
				req.breadcrumbs(BREADCRUMBS['reports/menu_engineering_report']);
				res.render('menu_engineering_report', {
					branch_list: response?.final_html_data?.["0"] || "",
				});
			}
		} catch (error) {
			next(error);
		}	
    };//End menuEngineeringReportList()


    /**
     *  Function for export area sales share report
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As 	Callback argument to the middleware function
     *
     * @return null
    */
    async menuEngineeringReportExport (req, res, next) {
		try {
			let restaurantId = (req.session.user.restaurant_id) ? new ObjectId(req.session.user.restaurant_id) :'';
			let fromDate	 = (req.query.from_date) ? req.query.from_date : "";
			let toDate 		 = (req.query.to_date) ? req.query.to_date : "";
			
			let branchIds = (req.query.branch_ids) ? (req.query.branch_ids).split(",") : [];

			branchIds = (branchIds && branchIds.constructor === Array) ? branchIds : [branchIds];
			
			/** Set order condition */
			let orderConditions = {
				restaurant_id	: restaurantId,
				admin_status	: Constants.ORDER_DELIVERED,
			};
			/** Condition for order date */
			if (fromDate != "" && toDate != "") {
				orderConditions = {...{
					order_date : {
						$gte: newDate(fromDate),
						$lte: newDate(toDate),
					}
				}, ...orderConditions};
			}
			if (branchIds.length > 0) orderConditions.branch_id = { $in: arrayToObject(branchIds) };

			const orders = 	this.db.collection(Tables.ORDERS);
			let orderIds = await orders.distinct("_id",orderConditions);
			
			/** Get list of top selling items **/
			const collection= this.db.collection(Tables.ORDER_ITEMS);
			let findResult = await collection.aggregate([
				{$match: { 
					order_id: { $in: orderIds }
				}},
				{$lookup: { /** Get item details **/
					"from"			: Tables.ITEMS,
					"localField"	: "item_id",
					"foreignField"	: "_id",
					"as"			: "item_detail"
				}},
				{$group: {
					_id: {
						item_id: "$item_id"
					},
					item_id		: { $first: "$item_id" },
					item_name	: { $first: { $arrayElemAt: ["$item_detail.name." + Constants.DEFAULT_LANGUAGE_CODE, 0] } },
					quantity	: { $sum: "$qty" }
				}},
				{$sort	: { quantity: Constants.SORT_ASC } },
			]).toArray();
				
			/** Define excel heading label **/
			let commonColls		= 	[			
				res.__("reports.item_name"),
				res.__("reports.quantity"),
			];
			
			let temp = [];
			if(findResult && findResult.length > 0){
				findResult.map(records=>{
					let buffer =	[
						(records.item_name) ? records.item_name     :"",
						(records.quantity)  ? records.quantity      :"",
					];
					temp.push(buffer);
				});
			}

			/**  Function to export data in excel format **/
			exportToExcel(req,res,{
				file_prefix 		: "menuEngineeringReportExport",
				heading_columns		: commonColls,
				export_data			: temp
			});
		} catch (error) {
			next(error);
		}
    }// end menuEngineeringReportExport()	
}
