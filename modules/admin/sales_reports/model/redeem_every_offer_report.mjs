import { parallel as asyncParallel } from 'async';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, arrayToObject, newDate, configDatatable } from '../../../../utils/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

// Model for Redeem Every Offer Report
export default class RedeemEveryOfferReport {

	constructor(db){
		this.db = db;
	}
	
	/**
	 * Function to get redeem every offer report list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async redeemEveryOffer(req,res,next){
		try{
			const order_details = this.db.collection(Tables.ORDER_DETAILS);
			const collection    = this.db.collection(Tables.ORDERS);
			let fromDate 	    = req?.query?.date_from || "";
			let toDate   	    = req?.query?.date_to   || "";
			let restaurantId 	= req?.query?.restaurant_id  || "";
			let branchId 		= req?.query?.branch_id  	   || "";

			/** Get order ids array for offer orders  */
			const orderIds = await order_details.distinct("order_id",{ offer_id : {$exists:true,$ne:null}});

			/** Set common conditions  */
			let commonConditions = {};

			/** Set order id conditions  */
			if(orderIds.length > 0) commonConditions._id = {$in : orderIds};
			
			if(isPost(req)){
				let limit 	= (req.body.length) ? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip  	= (req.body.start)  ? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;

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
					{ $match: dataTableConfig.conditions },
					{$facet : {
						list : [
							{$sort: dataTableConfig.sort_conditions },
							{$skip: skip },
							{$limit: limit },
							{$lookup : {
								from 		 : Tables.ORDER_DETAILS,
								localField 	 : "_id",
								foreignField : "order_id",
								as 			 : "order_details"
							}},
							{$lookup : {
								from 		 : Tables.RESTAURANT_BRANCHES,
								localField 	 : "branch_id",
								foreignField : "_id",
								as 			 : "branch_details"
							}},
							{$project : {
								_id:1,unique_order_id:1,restaurant_id:1,restaurant_name:1,order_price:1,
								offer_discount:{$arrayElemAt : ["$order_details.offer_discount",0]},
								offer_code: {$arrayElemAt : ["$order_details.offer_code",0]},
								branch_name: {$arrayElemAt : ["$branch_details.name."+Constants.DEFAULT_LANGUAGE_CODE,0]}
							}}
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
							callback(null, totalOrderResult);
						}).catch(totalOrderErr=>{
							callback(totalOrderErr, 0);
						});
					},
					total_offer_orders : (callback)=>{
						/** Get total offer orders **/
						collection.countDocuments(commonConditions).then(totalOfferResult=>{
							callback(null, totalOfferResult);
						}).catch(totalOfferErr=>{
							callback(totalOfferErr, 0);
						});
					}
				},(err,response)=>{
					if(err) return next(err);
					
					req.breadcrumbs(BREADCRUMBS['admin/sales_reports/sales_report_list']);
					res.render('redeem_every_offer_report',{
						layout 		 : false,
						total_orders : response?.total_orders || 0,
						from_date 	 : fromDate,
						to_date   	 : toDate,
						total_offer_orders : response?.total_offer_orders || 0,
						restaurant_id   : tempRestaurantId,
						branch_id       : tempBranchId
					});
				});
			}
		}catch(err){
			return next(err);
		}
	}
}
