import { parallel as asyncParallel } from 'async';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, arrayToObject, newDate, configDatatable } from '../../../../utils/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

// Model for Cancellation Report
export default class CancellationReport {

	constructor(db){
		this.db = db;
	}

	/**
	 * Function to get cancellation report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async cancellationOrder(req,res,next){
		try{
			const collection = this.db.collection(Tables.ORDERS);
			let fromDate 	 = req?.query?.date_from || "";
			let toDate   	 = req?.query?.date_to   || "";
			let restaurantId 	= req?.query?.restaurant_id || "";
			let branchId 		= req?.query?.branch_id  	   || "";

			/** Set common conditions  */
			let commonConditions = { order_status : Constants.ORDER_CANCELLED};
		
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
								from 		 : Tables.RESTAURANT_BRANCHES,
								localField 	 : "branch_id",
								foreignField : "_id",
								as 			 : "branch_details"
							}},
							{$lookup:	{
								from     : Tables.ORDER_STATUS_LOGS,
								let      : {orderId : "$_id"},
								pipeline : [
									{$match : {
										$expr: {
											$and : [
												{$eq: ["$order_id", "$$orderId"]},
												{$eq: ["$status", Constants.ORDER_CANCELLED]},
											]
										},
									}},
									{$lookup : {
										from 		 : Tables.USERS,
										localField 	 : "action_taken_by",
										foreignField : "_id",
										as 			 : "cancelled_details"
									}},
									{$project : { full_name: {$arrayElemAt : ["$cancelled_details.full_name",0]} }},
								],
								as	:	"cancelled_details"
							}},
							{$project : {
								_id:1,unique_order_id:1,restaurant_id:1,restaurant_name:1,order_price:1,rejection_reason:1,
								cancelled_by_name: {$arrayElemAt : ["$cancelled_details.full_name",0]},
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
					total_cancelled_orders : (callback)=>{
						/** Get total cancelled orders **/
						collection.countDocuments(commonConditions).then(totalCancelledResult=>{
							callback(null, totalCancelledResult);
						}).catch(totalCancelledErr=>{
							callback(totalCancelledErr, 0);
						});
					}
				},(err,response)=>{
					if(err) return next(err);
					
					req.breadcrumbs(BREADCRUMBS['admin/sales_reports/sales_report_list']);
					res.render('cancellation_report',{
						layout 		 : false,
						from_date 	 : fromDate,
						to_date   	 : toDate,
						restaurant_id   : tempRestaurantId,
						branch_id       : tempBranchId,
						total_orders : response?.total_orders || 0,
						total_cancelled_orders : response?.total_cancelled_orders || 0,
					});
				});
			}
		}catch(err){
			return next(err);
		}
	}
}
