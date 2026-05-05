import { parallel as asyncParallel } from 'async';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, arrayToObject, newDate, configDatatable } from '../../../../utils/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

// Model for Total Order Per Restaurant Without Offers
export default class TotalOrderPerRestaurantWithoutOffers {

    constructor(db) {
		this.db = db;
    }

	/**
	 * Function to get total order per restaurant without offers sales report 
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async totalOrderPerRestaurantWithoutOffers(req,res,next){
		try{
			let fromDate 	 = req?.query?.date_from || "";
			let toDate   	 = req?.query?.date_to || "";
			let restaurantId = req?.query?.restaurant_id || "";
			let branchId 	 = req?.query?.branch_id || "";
			
			/** Set order details conditions  */
			let orderDetailsConditions = { offer_id : {$eq:null}};
			
			/** Find order id */
			const order_details = this.db.collection(Tables.ORDER_DETAILS);
			let orderIds = await order_details.distinct("order_id",orderDetailsConditions);

			/** Set common conditions  */
			let commonConditions = {};
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

				/** Get data from database */
				let dbRes = await collection.aggregate([
					{$match: dataTableConfig.conditions},
					{$group	: {
						_id  :{
							restaurant_id: "$restaurant_id"
						},
						restaurant_name : {$first : "$restaurant_name"},
						total_orders 	: {$sum : 1},
						total_amount 	: {$sum : "$order_price"},
					}},
					{$facet : {
						list : [
							{$sort: dataTableConfig.sort_conditions },
							{$skip: skip},
							{$limit: limit}
						],
						count: [
							{$count: "count"},
						],
					}}
				]).toArray();

				/** Send response **/
				res.send({
					status: Constants.STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data			:   dbRes?.[0]?.list ||[],
					recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
					recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
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
					total_orders_without_offers : (callback)=>{
						/** Get total  orders without offers **/
						collection.countDocuments(commonConditions).then(totalOfferResult=>{
							callback(null,totalOfferResult);
						}).catch(totalOfferErr=>{
							callback(totalOfferErr,0);
						});
					}
				},(err,response)=>{
					if(err) return next(err);
					
					req.breadcrumbs(BREADCRUMBS['admin/sales_reports/sales_report_list']);
					res.render('total_order_per_restaurant_without_offers',{
						layout 		 : false,
						from_date 	 : fromDate,
						to_date   	 : toDate,
						restaurant_id: tempRestaurantId,
						branch_id    : tempBranchId,
						total_orders : response?.total_orders || 0,
						total_orders_without_offers : response?.total_orders_without_offers || 0,
					});
				});
			}
		}catch(err){
			return next(err);
		}
	}
}
