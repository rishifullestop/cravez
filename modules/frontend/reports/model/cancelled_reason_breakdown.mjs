import { ObjectId } from 'mongodb';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from '../../../../utils/index.mjs';

let REASONS ={
	no_response_from_restaurant : "No response from restaurant",
	failing_to_punch			:"Failing to punch the order",
	delay_delivery				:"Late delivery",
	wrong_address				:"Wrong address by customer",
	mobile_off					:"Mobile switched off",
	duplicate_order				:"Duplicate order",
	changed_mind				:"Changed mind",
	changed_mind_at_delivery	:"Changed mind at delivery time",
};

export default class CancelledReasonBreakdownReport {
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
	async getCancelledReasonBreakdownList (req,res,next){
		try{
			let restaurantId	= new ObjectId(req.session.user.restaurant_id);
			if(Helpers.isPost(req)){
				let years			= (req.body.years) 		? parseInt(req.body.years) : "";
				let branchIds		= (req.body.branch_ids) ? req.body.branch_ids : [];
				let branchArray		= (branchIds.constructor === Array) ? branchIds : [branchIds];

				let commonConditions	=	{
					restaurant_id:	restaurantId,
					admin_status : Constants.ORDER_CANCELLED
				};

				let yearConditions	= {year : years};

				if(branchArray.length > 0) commonConditions.branch_id = {$in : Helpers.arrayToObject(branchArray)};

				const collection = 	this.db.collection(Tables.ORDERS);
				let result = await collection.aggregate([
					{$match 	: commonConditions},
					{$addFields: { "cancel_reason_id": { "$toString": "$cancel_reason_id" } } },
					{$group 	: {
						_id : {
							year: { $dateToString: { format: "%Y", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE }}
						},
						year  : {$first : { "$year": "$order_date"}},
						no_response_from_restaurant : {$sum : {
							$cond: [
								{$and: [
									{ $eq: ["$cancel_reason_id", Constants.NO_RESPONSE_FROM_RESTAURANT] },
								]},
								"$order_price",
								0
							]}
						},
						failing_to_punch : {$sum : {
							$cond: [
								{$and: [
									{ $eq: ["$cancel_reason_id", Constants.FAILING_TO_PUNCH_THE_ORDER] },
								]},
								"$order_price",
								0
							]}
						},
						delay_delivery : {$sum : {
							$cond: [
								{$and: [
									{ $eq: ["$cancel_reason_id", Constants.DELAY_DELIVERY] },
								]},
								"$order_price",
								0
							]}
						},
						wrong_address: {
							$sum: {
								$cond: [
									{
										$and: [
											{ $eq: ["$cancel_reason_id", Constants.WRONG_ADDRESS_BY_CUSTOMER] },
										]
									},
									"$order_price",
									0
								]
							}
						},
						mobile_off: {
							$sum: {
								$cond: [
									{
										$and: [
											{ $eq: ["$cancel_reason_id", Constants.MOBILE_SWITCHED_OFF] },
										]
									},
									"$order_price",
									0
								]
							}
						},
						duplicate_order: {
							$sum: {
								$cond: [
									{
										$and: [
											{ $eq: ["$cancel_reason_id", Constants.DUPLICATE_ORDER] },
										]
									},
									"$order_price",
									0
								]
							}
						},
						changed_mind: {
							$sum: {
								$cond: [
									{
										$and: [
											{ $eq: ["$cancel_reason_id", Constants.CHANGED_MIND] },
										]
									},
									"$order_price",
									0
								]
							}
						},
						changed_mind_at_delivery: {
							$sum: {
								$cond: [
									{
										$and: [
											{ $eq: ["$cancel_reason_id", Constants.CHANGED_MIND_AT_DELIVERY] },
										]
									},
									"$order_price",
									0
								]
							}
						},
					}},
					{$match : yearConditions}
				]).toArray();

				var currentYear		= Helpers.newDate().getFullYear();
				let yearWiseData 	= {};
				result.map(record=>{
					if(!yearWiseData[record.year]) yearWiseData[record.year] = {};
					yearWiseData[record.year]["no_response_from_restaurant"] = record.no_response_from_restaurant;
					yearWiseData[record.year]["failing_to_punch"] = record.failing_to_punch;
					yearWiseData[record.year]["delay_delivery"] = record.delay_delivery;
					yearWiseData[record.year]["wrong_address"] = record.wrong_address;
					yearWiseData[record.year]["mobile_off"] = record.mobile_off;
					yearWiseData[record.year]["duplicate_order"] = record.duplicate_order;
					yearWiseData[record.year]["changed_mind"] = record.changed_mind;
					yearWiseData[record.year]["changed_mind_at_delivery"] = record.changed_mind_at_delivery;
				});

				let finalArray 	= [];
				let dataYears	= Object.keys(yearWiseData);
				Object.keys(REASONS).map(record=>{
					let tmpRow = [REASONS[record]];
					dataYears.map(tmpYear=>{
						let tmpObj = (yearWiseData[tmpYear]) ? yearWiseData[tmpYear] : {};
						if (!tmpObj[record]) tmpObj[record] = 0;
						if (tmpYear == currentYear && (!tmpObj[record] || tmpObj[record] == 0)) {
							tmpObj[record] = null;
						}
						tmpRow.push(tmpObj[record]);
					});
					finalArray.push(tmpRow);
				});
				res.send({status : Constants.STATUS_SUCCESS, result : finalArray, years: dataYears });

			}
		}catch(err){ return next(err); }
	};//End getCancelledReasonBreakdownList()

	/**
	 *  Function for export Cancelled Reason Breakdown report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async CancelledReasonBreakdownExportData (req,res,next){
		try{
			let restaurantId    = new ObjectId(req.session.user.restaurant_id);
			let branchIds       = (req.query.branch_ids) ? (req.query.branch_ids).split(",") : [];
			let years           = (req.query.years) ? parseInt(req.query.years) : "";

			let branchArray = (branchIds.constructor === Array) ? branchIds : [branchIds];

			let exportConditions	= {
				restaurant_id: restaurantId,
				admin_status : Constants.ORDER_CANCELLED
			};
			let yearConditions = { year: years };

			if (branchArray.length > 0) exportConditions.branch_id = { $in: Helpers.arrayToObject(branchArray) };

			const orders = this.db.collection(Tables.ORDERS);
			let result = await orders.aggregate([
				{$match: exportConditions },
				{$addFields: { "cancel_reason_id": { "$toString": "$cancel_reason_id" }}},
				{$group: {
					_id: {
						year: { $dateToString: { format: "%Y", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE } }
					},
					year: { $first: { "$year": "$order_date" } },
					no_response_from_restaurant: {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$cancel_reason_id", Constants.NO_RESPONSE_FROM_RESTAURANT] },
									]
								},
								"$order_price",
								0
							]
						}
					},
					failing_to_punch: {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$cancel_reason_id", Constants.FAILING_TO_PUNCH_THE_ORDER] },
									]
								},
								"$order_price",
								0
							]
						}
					},
					delay_delivery: {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$cancel_reason_id", Constants.DELAY_DELIVERY] },
									]
								},
								"$order_price",
								0
							]
						}
					},
					wrong_address: {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$cancel_reason_id", Constants.WRONG_ADDRESS_BY_CUSTOMER] },
									]
								},
								"$order_price",
								0
							]
						}
					},
					mobile_off: {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$cancel_reason_id", Constants.MOBILE_SWITCHED_OFF] },
									]
								},
								"$order_price",
								0
							]
						}
					},
					duplicate_order: {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$cancel_reason_id", Constants.DUPLICATE_ORDER] },
									]
								},
								"$order_price",
								0
							]
						}
					},
					changed_mind: {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$cancel_reason_id", Constants.CHANGED_MIND] },
									]
								},
								"$order_price",
								0
							]
						}
					},
					changed_mind_at_delivery: {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$cancel_reason_id", Constants.CHANGED_MIND_AT_DELIVERY] },
									]
								},
								"$order_price",
								0
							]
						}
					},
				}},
				{$match: yearConditions}
			]).toArray();

			var currentYear = Helpers.newDate().getFullYear();
			let yearWiseData = {};

			result.map(record => {
				if (!yearWiseData[record.year]) yearWiseData[record.year] = {};
				yearWiseData[record.year]["no_response_from_restaurant"] = record.no_response_from_restaurant;
				yearWiseData[record.year]["failing_to_punch"] = record.failing_to_punch;
				yearWiseData[record.year]["delay_delivery"] = record.delay_delivery;
				yearWiseData[record.year]["wrong_address"] = record.wrong_address;
				yearWiseData[record.year]["mobile_off"] = record.mobile_off;
				yearWiseData[record.year]["duplicate_order"] = record.duplicate_order;
				yearWiseData[record.year]["changed_mind"] = record.changed_mind;
				yearWiseData[record.year]["changed_mind_at_delivery"] = record.changed_mind_at_delivery;
			});

			let finalArray = [];
			let dataYears = Object.keys(yearWiseData);
			Object.keys(REASONS).map(record => {
				let tmpRow = [REASONS[record]];
				dataYears.map(tmpYear => {
					let tmpObj = (yearWiseData[tmpYear]) ? yearWiseData[tmpYear] : {};
					if (!tmpObj[record]) tmpObj[record] = 0;
					if (tmpYear == currentYear && (!tmpObj[record] || tmpObj[record] == 0)) {
						tmpObj[record] = null;
					}
					tmpRow.push(tmpObj[record]);
				});
				finalArray.push(tmpRow);
			});

			let commonColls = [res.__("reports.reasons")];
			dataYears.map(rec => {
				commonColls.push(rec);
			});

			/**  Function to export data in excel format **/
			Helpers.exportToExcel(req,res,{
				file_prefix 		: "cancelledReasonBreakdownReport",
				heading_columns		: commonColls,
				export_data			: finalArray
			});
		}catch(err){ return next(err); }
	};// end CancelledReasonBreakdownExportData()
}
