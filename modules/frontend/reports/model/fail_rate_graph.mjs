import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { newDate, arrayToObject,isPost, exportToExcel} from "../../../../utils/index.mjs";

export default class FailRateGraph {
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
    async getFailRateGraphList (req,res,next){
        try {
            let restaurantId	= new ObjectId(req.session.user.restaurant_id);
			if(isPost(req)){
				let years			= (req.body.years) 		? req.body.years : [];
				let branchIds		= (req.body.branch_ids) 	? req.body.branch_ids : [];
				let branchArray		= (branchIds.constructor === Array) ? branchIds : [branchIds];
				let yearsArray		= (years.constructor === Array) ? years : [years];				
				
				const collection = 	this.db.collection(Tables.ORDERS);
				
				let commonConditions = { restaurant_id: restaurantId };
				if(branchArray.length > 0) commonConditions.branch_id = { $in: arrayToObject(branchArray) };	
				
				yearsArray	= yearsArray.map(year => parseInt(year));
				let yearConditions = { year: { $in: yearsArray } };				
				
				let result = await collection.aggregate([
					{$match : commonConditions},
					{$group : {
						_id : {
							year_month : { $dateToString: { format: "%Y-%m", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE }}
						},
						year  : {$last : { "$year": "$order_date"}},
						month : {$last : { "$month": "$order_date"}},						
						fail_count : {$sum : {
							$cond: [
								{$or: [
									{ $eq: ["$admin_status", Constants.ORDER_REJECTED] },
									{ $eq: ["$admin_status", Constants.ORDER_REJECTED_BY_ADMIN] },
									{ $eq: ["$admin_status", Constants.ORDER_CANCELLED] },
								]},
								1,
								0
							]}
						},
						total_orders : {$sum :1},
					}},
					{$project: {
						_id: 0, year:"$year",month:"$month", fail_rate: {$multiply:[{$divide:[100,"$total_orders"]},"$fail_count"]}
					}},						
					{$match : yearConditions}
				]).toArray();			
					
				let currentYear		= newDate().getFullYear();
				let currentMonth 	= newDate().getMonth()+1;
				let yearWiseData 	= {};
				
				result.map(record=>{
					if(!yearWiseData[record.year]) yearWiseData[record.year] = {};	
					if (!yearWiseData[record.year][record.month]) yearWiseData[record.year][record.month] = {};		
					yearWiseData[record.year][record.month]["total_acceptable_rate"] = Constants.TOTAL_ACCECPTABLE_RATE;
					yearWiseData[record.year][record.month]["fail_rate"] = record.fail_rate;
				});
			
				let finalArray 	= [];
				let dataYears	= Object.keys(yearWiseData);
				Object.keys(Constants.REPORT_CHART_MONTH_NAMES).map(month=>{
					let tmpRow = [Constants.REPORT_CHART_MONTH_NAMES[month]];
					dataYears.map(tmpYear=>{
						let tmpObj = (yearWiseData[tmpYear] && yearWiseData[tmpYear][month]) ? yearWiseData[tmpYear][month] : {};
						if (!tmpObj.total_acceptable_rate) tmpObj.total_acceptable_rate = Constants.TOTAL_ACCECPTABLE_RATE;
						if (!tmpObj.fail_rate) tmpObj.fail_rate = 0;

						if (tmpYear == currentYear && month > currentMonth && (!tmpObj.total_acceptable_rate || tmpObj.total_acceptable_rate == 0)) {
							tmpObj.total_acceptable_rate = null;
						}
						if (tmpYear == currentYear && month > currentMonth && (!tmpObj.fail_rate || tmpObj.fail_rate == 0)) {
							tmpObj.fail_rate = null;
						}
						
						tmpRow.push(tmpObj.total_acceptable_rate);
						tmpRow.push(tmpObj.fail_rate);
					});
					finalArray.push(tmpRow);
				});

				res.send({status : Constants.STATUS_SUCCESS, result : finalArray,years : dataYears });
			}
		} catch (error) {
            next(error);
        }
    };//End getFailRateGraphList()

	/**
	 *  Function for export fail rate graph
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async exportFailRateGraph (req,res,next){
        try {
            let restaurantId    = new ObjectId(req.session.user.restaurant_id);
			let branchIds       = (req.query.branch_ids) ? (req.query.branch_ids).split(",") : [];
			let years           = (req.query.years) ? (req.query.years).split(",") : [];
			let branchArray = (branchIds.constructor === Array) ? branchIds : [branchIds];
			let yearsArray  = (years.constructor === Array) ? years : [years];			
			
			let exportConditions	= { restaurant_id: restaurantId };
			if (branchArray.length > 0) exportConditions.branch_id = { $in: arrayToObject(branchArray) };
			
			yearsArray      = yearsArray.map(year => parseInt(year));
			let yearConditions = { year: { $in: yearsArray } };			
			
			const orders = this.db.collection(Tables.ORDERS);
			let result = await orders.aggregate([
				{ $match: exportConditions },
				{
					$group: {
						_id: {
							year_month: { $dateToString: { format: "%Y-%m", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE } }
						},
						year : { $last: { "$year" : "$order_date" } },
						month: { $last: { "$month": "$order_date" } },

						fail_count: {
							$sum: {
								$cond: [
									{
										$or: [
											{ $eq: ["$admin_status", Constants.ORDER_REJECTED] },
											{ $eq: ["$admin_status", Constants.ORDER_CANCELLED] },
										]
									},
									1,
									0
								]
							}
						},
						total_orders: { $sum: 1 },
					}
				},
				{
					$project: {
						_id: 0, year: "$year", month: "$month", fail_rate: { $multiply: [{ $divide: [100, "$total_orders"] }, "$fail_count"] }
					}
				},
				{ $match: yearConditions }
			]).toArray();

			let currentYear  = newDate().getFullYear();
			let currentMonth = newDate().getMonth() + 1;
			let yearWiseData = {};

			result.map(record => {
				if (!yearWiseData[record.year]) yearWiseData[record.year] = {};
				if (!yearWiseData[record.year][record.month]) yearWiseData[record.year][record.month] = {};
				yearWiseData[record.year][record.month]["total_acceptable_rate"] = Constants.TOTAL_ACCECPTABLE_RATE;
				yearWiseData[record.year][record.month]["fail_rate"] = record.fail_rate;
			});
		
			let finalArray = [];
			let dataYears  = Object.keys(yearWiseData);

			Object.keys(Constants.REPORT_CHART_MONTH_NAMES).map(month => {
				let tmpRow = [Constants.REPORT_CHART_MONTH_NAMES[month]];
				dataYears.map(tmpYear => {
					let tmpObj = (yearWiseData[tmpYear] && yearWiseData[tmpYear][month]) ? yearWiseData[tmpYear][month] : {};
					if (!tmpObj.total_acceptable_rate) tmpObj.total_acceptable_rate = Constants.TOTAL_ACCECPTABLE_RATE;
					if (!tmpObj.fail_rate) tmpObj.fail_rate = 0;

					if (tmpYear == currentYear && month > currentMonth && (!tmpObj.total_acceptable_rate || tmpObj.total_acceptable_rate == 0)) {
						tmpObj.total_acceptable_rate = null;
					}
					if (tmpYear == currentYear && month > currentMonth && (!tmpObj.fail_rate || tmpObj.fail_rate == 0)) {
						tmpObj.fail_rate = null;
					}

					tmpRow.push(tmpObj.total_acceptable_rate);
					tmpRow.push(tmpObj.fail_rate);
				});
				finalArray.push(tmpRow);
			});
			
			let commonColls = [
				res.__("reports.month"),
				res.__("reports.total_acceptable_rate"),
				res.__("reports.fail_rate"),
			];

			/**  Function to export data in excel format **/
			exportToExcel(req,res,{
				file_prefix 		: "failRateGraphReport",
				heading_columns		: commonColls,
				export_data			: finalArray
			});
		} catch (error) {
            next(error);
        }
    };// end exportFailRateGraph()
}
