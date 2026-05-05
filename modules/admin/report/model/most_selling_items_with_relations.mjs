import { ObjectId } from 'mongodb';
import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList, newDate, exportToExcel, configDatatable, round } from '../../../../utils/index.mjs';

// Model for most selling items with relations report
export default class MostSellingItemsRelationReport {
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
	async getMostSellingItemsRelation(req,res,next){
		try{
			if(isPost(req)){
				let skip		 = (req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     = (req.body.from_date) 	? req.body.from_date 		:"";
				let toDate 	  	 = (req.body.to_date)   	? req.body.to_date   		:"";
				let restaurantId = (req.body.restaurant_id)	? new ObjectId(req.body.restaurant_id)	: "";
				let itemCount	 = (req.body.item_count)	? parseInt(req.body.item_count)	: Constants.TOP_5;

				const collection = 	this.db.collection(Tables.ORDER_ITEMS);
				const orders 	 = 	this.db.collection(Tables.ORDERS);

				/** Set order condition */
				let orderConditions = {restaurant_id : restaurantId,admin_status : Constants.ORDER_DELIVERED};

				/** Condition for order date */
				if (fromDate != "" && toDate != "") {
					orderConditions.order_date = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					};
				}

				/** Get order ids  */
				let orderIds = await orders.distinct("_id",orderConditions);

				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);

				/** Set common condition */
				let commonConditions = {
					order_id : { $in : orderIds},
				};

				dataTableConfig.conditions	= Object.assign(dataTableConfig.conditions, commonConditions);
				asyncParallel({
					most_selling_items_list :(callback)=>{
						/** Get list of most selling items **/
						collection.aggregate([
							{$match		: dataTableConfig.conditions},
							{$unwind 	: {
								path	: "$extra_items",
								preserveNullAndEmptyArrays:true
							}},
							{$group: {
								_id: {
									item_id : "$item_id",extra_item_id : "$extra_items.extra_item_id"
								},
								item_id 		: {$first : "$item_id"},
								extra_item_id 	: {$first : "$extra_items.extra_item_id"},
								extra_item_name	: {$first : "$extra_items.extra_item_name"},
								item_name  		: {$first : "$item_name"},
								qty  			: {$sum   : "$qty"},
								extra_items_qty	: {$sum: {
									$cond: [{
										$and: [
												{ $ne: ["$extra_items.extra_item_id", null] },
												{ $ne: ["$extra_items.extra_item_id", ""] },
											]
										},
										1,0
									]}
								},
							}},
							{$sort : {extra_items_qty : Constants.SORT_DESC}},
							{$group: {
								_id: {
									item_id : "$item_id",
								},
								item_id 	: {$first 	: "$item_id"},
								item_name  	: {$first 	: "$item_name."+Constants.DEFAULT_LANGUAGE_CODE},
								qty  		: {$sum 	: "$qty"},
								extras		: {$push: {
									$cond:[
										{ $ne: ["$extra_item_id", null] },
										{
											extra_item_id	: "$extra_item_id",
											extra_item_name : "$extra_item_name."+Constants.DEFAULT_LANGUAGE_CODE,
											qty				: "$extra_items_qty",
										},
										"$$REMOVE"
									]
								}},
							}},
							{$addFields : {
								extra_items : { $slice: [ "$extras", 0, 5] }
							}},
							{$sort 	: {qty : Constants.SORT_DESC}},
							{$skip 	: skip},
							{$limit : itemCount},
						]).toArray().then(result=>{
							callback(null, result);
						}).catch(next);
					},
				},(err, response)=>{
					/** Send response **/
					res.send({
						status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
						draw			: dataTableConfig.result_draw,
						data			: response.most_selling_items_list,
						recordsFiltered	: response.most_selling_items_list.length,
						recordsTotal	: response.most_selling_items_list.length,
					});
				});
			}else{
				/** Set dropdown options **/
				let options = {
					collections :[{
						collection : Tables.RESTAURANTS,
						columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
						conditions : {
							is_deleted	: Constants.NOT_DELETED
						},
					}]
				};

				/**Get dropdown list **/
				getDropdownList(req,res, next,options).then(response=> {
					if(response.status != Constants.STATUS_SUCCESS){
						/** Send error response **/
						req.flash(Constants.STATUS_ERROR,response.message);
						return res.redirect(Constants.WEBSITE_ADMIN_URL+"dashboard");
					}

					/** render listing page **/
					req.breadcrumbs(BREADCRUMBS['admin/report/most_selling_items_with_relations']);
					res.render('most_selling_items_with_relations',{
						restaurant_list : response.final_html_data["0"],
					});
				});
			}
		}catch(error){
			return next(error);
		}
	};//End getMostSellingItemsRelation()

	/**
	 *  Function for export most selling items report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async exportMostSellingItemsRelation(req,res,next){
		try{
			let fromDate 		= (req.query.from_date) ? req.query.from_date : "";
			let toDate 			= (req.query.to_date) ? req.query.to_date : "";
			let restaurantId 	= (req.query.restaurant_id)	? new ObjectId(req.query.restaurant_id)	: "";
			let itemCount	 	= (req.query.item_count)	? parseInt(req.query.item_count)	: Constants.TOP_5;

			/** Set order condition */
			let orderConditions = {restaurant_id : restaurantId,admin_status : Constants.ORDER_DELIVERED};

			/** Condition for order date */
			if (fromDate != "" && toDate != "") {
				orderConditions.order_date = {
					$gte: newDate(fromDate),
					$lte: newDate(toDate),
				};
			}

			const orders = this.db.collection(Tables.ORDERS);
			let orderIds = await orders.distinct("_id",orderConditions);


			/** Set common condition */
			let exportConditions = {
				order_id : { $in : orderIds}
			};

			/** Get most selling items details **/
			const order_items = this.db.collection(Tables.ORDER_ITEMS);
			order_items.aggregate([
				{$match : exportConditions},
				{$unwind 	: {
					path	: "$extra_items",
					preserveNullAndEmptyArrays:true
				}},
				{$group: {
					_id: {
						item_id : "$item_id",extra_item_id : "$extra_items.extra_item_id"
					},
					item_id 		: {$first : "$item_id"},
					extra_item_id 	: {$first : "$extra_items.extra_item_id"},
					extra_item_name	: {$first : "$extra_items.extra_item_name"},
					item_name  		: {$first : "$item_name"},
					qty  			: {$sum   : "$qty"},
					extra_items_qty	: {$sum: {
						$cond: [{
							$and: [
									{ $ne: ["$extra_items.extra_item_id", null] },
									{ $ne: ["$extra_items.extra_item_id", ""] },
								]
							},
							1,0
						]}
					},
				}},
				{$sort : {extra_items_qty : Constants.SORT_DESC}},
				{$group: {
					_id: {
						item_id : "$item_id",
					},
					item_id 	: {$first 	: "$item_id"},
					item_name  	: {$first 	: "$item_name."+Constants.DEFAULT_LANGUAGE_CODE},
					qty  		: {$sum 	: "$qty"},
					extras		: {$push: {
						$cond:[
							{ $ne: ["$extra_item_id", null] },
							{
								extra_item_id	: "$extra_item_id",
								extra_item_name : "$extra_item_name."+Constants.DEFAULT_LANGUAGE_CODE,
								qty				: "$extra_items_qty",
							},
							"$$REMOVE"
						]
					}},
				}},
				{$addFields : {
					extra_items : { $slice: [ "$extras", 0, 5] }
				}},
				{$sort 	: {qty : Constants.SORT_DESC}},
				{$limit : itemCount},
			]).toArray().then(findResult=>{
				let temp			= [];
				let topHeadings		= ["Main Item","","","Relation 1","","","Relation 2","","","Relation 3","","","Relation 4","","","Relation 5"];


				/** Define excel heading label **/
				let commonColls	= [
					res.__("admin.report.most_selling_item"),
					res.__("admin.report.sold_time"),
					"",
					res.__("admin.report.item_name"),
					res.__("admin.report.quantity"),
					res.__("admin.report.relation"),

					res.__("admin.report.item_name"),
					res.__("admin.report.quantity"),
					res.__("admin.report.relation"),

					res.__("admin.report.item_name"),
					res.__("admin.report.quantity"),
					res.__("admin.report.relation"),

					res.__("admin.report.item_name"),
					res.__("admin.report.quantity"),
					res.__("admin.report.relation"),

					res.__("admin.report.item_name"),
					res.__("admin.report.quantity"),
					res.__("admin.report.relation"),
				];

				if(findResult && findResult.length > 0){
					findResult.map(records=>{
						let buffer =	[
							(records.item_name) ?   records.item_name  :"",
							(records.qty)  		?   records.qty        :"",
							""
						];
						for (let i=0; i< 5; i++){
							let extraItems = (records.extra_items && records.extra_items.length > 0) ? records.extra_items : [];

							let tmpExtraName = (extraItems[i] && extraItems[i].extra_item_name) || "";
							let tmpExtraQty = (extraItems[i] && extraItems[i].qty) || "";
							let tmpRelation = (tmpExtraQty && records.qty) ? round(tmpExtraQty/records.qty*100)+"%" : "";
							buffer.push(tmpExtraName);
							buffer.push(tmpExtraQty);
							buffer.push(tmpRelation);
						}
						temp.push(buffer);
					});
				}
				let mergedCols = [
					{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
					{ s: { r: 0, c: 3 }, e: { r: 0, c: 5 } },
					{ s: { r: 0, c: 6 }, e: { r: 0, c: 8 } },
					{ s: { r: 0, c: 9 }, e: { r: 0, c: 11 } },
					{ s: { r: 0, c: 12 }, e: { r: 0, c: 14 } },
					{ s: { r: 0, c: 15 }, e: { r: 0, c: 17 } },
				];
				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "RestaurantsMostSellingItems",
					heading_columns		: commonColls,
					export_data			: temp,
					super_headings		: topHeadings,
					merged_columns		: mergedCols
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
	};// end ExportMostSellingItemsRelation()
}
