import { parallel as asyncParallel } from 'async';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, arrayToObject, newDate, configDatatable } from '../../../../utils/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

// Model for Total Order Per Restaurant With Offers
export default class TotalOrderPerRestaurantWithOffers {

	constructor(db){
		this.db = db;
	}

	/**
	 * Function to get total order per restaurant with offers sales report 
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async totalOrderPerRestaurantWithOffers(req,res,next){
		try{
			let fromDate 	 = req?.query?.date_from || "";
			let toDate   	 = req?.query?.date_to || "";
			let restaurantId = req?.query?.restaurant_id || "";
			let branchId 	 = req?.query?.branch_id || "";
			
			/** Find order id */
			const order_details = this.db.collection(Tables.ORDER_DETAILS);
			let orderIds = await order_details.distinct("order_id",{ offer_id : {$exists:true,$ne:null}});

			/** Set common conditions  */
			let commonConditions = {};

			/** Set order id conditions  */
			if(orderIds?.length > 0) commonConditions._id = {$in : orderIds};

			const collection = this.db.collection(Tables.ORDERS);
			if(isPost(req)){
				let limit  = (req.body.length) ? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip   = (req.body.start)  ? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;

				/** Configure Datatable conditions*/
				const dataTableConfig = await configDatatable(req, res, null);

				/** Conditions for date */
				if (fromDate != "" && toDate != "") {
					commonConditions["order_date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					}
				}

				/** Conditions for restaurant */
				if (restaurantId && restaurantId != "null") {
					restaurantId = restaurantId.split("-");
					if(restaurantId.constructor !== Array)	restaurantId = [restaurantId];
					restaurantId = arrayToObject(restaurantId);
					commonConditions["restaurant_id"] = {$in : restaurantId};
				}

				/** Conditions for branch */
				if (branchId && branchId != "null") {
					branchId = branchId.split("-");
					if(branchId.constructor !== Array)	branchId = [branchId];
					branchId = arrayToObject(branchId);
					commonConditions["branch_id"] = {$in : branchId};
				}

				dataTableConfig.conditions = Object.assign(commonConditions, dataTableConfig.conditions);

				asyncParallel({
					data: (callback)=>{
						/** Get records in orders collection **/
						collection.aggregate([
							{$match	: dataTableConfig.conditions},
							{$lookup:	{
								"from" 			: 	Tables.ORDER_DETAILS,
								"localField" 	:	"_id",
								"foreignField" 	: 	"order_id",
								"as" 			: 	"order_detail"
							}},
							{$addFields:	{
								offer_discount: {$arrayElemAt: ["$order_detail.offer_discount",0]}
							}},
							{$group	: {
								_id  :{
									restaurant_id   : "$restaurant_id"
								},
								restaurant_name : { $first : "$restaurant_name"},
								total_orders 	: {$sum : 1},
								total_amount 	: {$sum : "$order_price"},
								total_offer_discount : {$sum : "$offer_discount"},
							}},
							{$sort 	: dataTableConfig.sort_conditions},
							{$skip 	: skip},
							{$limit : limit}
						]).toArray().then(findResult=>{
							callback(null,findResult);
						}).catch(findErr=>{
							callback(findErr,[]);
						});
					},
					records_filtered: (callback)=>{
						/** Get filtered records counting in orders **/
						collection.aggregate([
							{$match	: dataTableConfig.conditions},
							{$group	: {
								_id  :{
									restaurant_id   : "$restaurant_id"
								},
								total_orders : {$sum : 1},
								total_amount : {$sum : "$order_price"},
							}},
							{ $count	: "count" }
						]).toArray().then(filterCount=>{
							callback(null, filterCount?.[0]?.count || 0);
						}).catch(filterErr=>{
							callback(filterErr, 0);
						});
					}
				},(err, response)=>{
					/** Send response **/
					res.send({
						status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
						draw			: dataTableConfig.result_draw,
						data			: response?.data || [],
						recordsFiltered	: response?.records_filtered || 0,
						recordsTotal	: response?.records_filtered || 0,
					});
				});
			}else{

				let tempRestaurantId = restaurantId?.replace(/,/g,"-");
				let tempBranchId 	 = branchId?.replace(/,/g,"-");
				/** Conditions for date */
				if (fromDate != "" && toDate != "") {
					commonConditions["order_date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					}
				}

				/** Conditions for restaurant */
				if (tempRestaurantId && tempRestaurantId != "null") {
					restaurantId = tempRestaurantId.split("-");
					if(restaurantId.constructor !== Array)	restaurantId = [restaurantId];
					restaurantId = arrayToObject(restaurantId);
					commonConditions["restaurant_id"] = {$in : restaurantId};
				}

				/** Conditions for branch */
				if (tempBranchId && tempBranchId != "null") {
					branchId = tempBranchId.split("-");
					if(branchId.constructor !== Array)	branchId = [branchId];
					branchId = arrayToObject(branchId);
					commonConditions["branch_id"] = {$in : branchId};
				}

				asyncParallel({
					total_orders : (callback)=>{
						/** Set conditions for total orders */
						let totalOrderConditions = {
							order_date : {
								$gte 	: newDate(fromDate),
								$lte 	: newDate(toDate),
							}
						};

						/** Conditions for restaurant */
						if (tempRestaurantId && tempRestaurantId != "null") {
							restaurantId = tempRestaurantId.split("-");
							if(restaurantId.constructor !== Array)	restaurantId = [restaurantId];
							restaurantId = arrayToObject(restaurantId);
							totalOrderConditions["restaurant_id"] = {$in : restaurantId};
						}

						/** Conditions for branch */
						if (tempBranchId && tempBranchId != "null") {
							branchId = tempBranchId.split("-");
							if(branchId.constructor !== Array)	branchId = [branchId];
							branchId = arrayToObject(branchId);
							totalOrderConditions["branch_id"] = {$in : branchId};
						}

						/** Get total orders **/
						collection.countDocuments(totalOrderConditions).then(totalOrderResult=>{
							callback(null,totalOrderResult);
						}).catch(totalOrderErr=>{
							callback(totalOrderErr,0);
						});
					},
					total_offer_orders : (callback)=>{
						/** Get total offer orders **/
						collection.countDocuments(commonConditions).then(totalOfferResult=>{
							callback(null,totalOfferResult);
						}).catch(totalOfferErr=>{
							callback(totalOfferErr,0);
						});
					}
				},(err,response)=>{
					if(err) return next(err);
					
					req.breadcrumbs(BREADCRUMBS['admin/sales_reports/sales_report_list']);
					res.render('total_order_per_restaurant_with_offers',{
						layout 		 : false,
						total_orders : response?.total_orders || 0,
						from_date 	 : fromDate,
						to_date   	 : toDate,
						total_offer_orders : response?.total_offer_orders || 0,
						restaurant_id   : tempRestaurantId,
						branch_id       : tempBranchId,
					});
				});
			}
		}catch(err){
			return next(err);
		}
	}
}
