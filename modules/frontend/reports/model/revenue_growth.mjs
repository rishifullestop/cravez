import { ObjectId } from 'mongodb';
import BREADCRUMBS from "../../../../breadcrumbs.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { newDate, arrayToObject,isPost, getDropdownList, exportToExcel} from "../../../../utils/index.mjs";

export default class RevenueGrowth {
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
	async getRevenueGrowthReport (req,res,next){
		try {
			let restaurantId	= new ObjectId(req.session.user.restaurant_id);
			if(isPost(req)){ 
				let years			= (req.body.years) 		? req.body.years : [];
				let branchIds		= (req.body.branch_ids) 	? req.body.branch_ids : [];
				let branchArray		= (branchIds.constructor === Array) ? branchIds : [branchIds];
				let yearsArray		= (years.constructor === Array) ? years : [years];
				yearsArray			= yearsArray.map(year=> parseInt(year));
				
				let commonConditions	=	{restaurant_id: restaurantId};
				
				let yearConditions	= {year: { $in: yearsArray }};
				
				if(branchArray.length > 0) commonConditions.branch_id = {$in : arrayToObject(branchArray)};		
				
				const collection = this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);
				let result = await collection.aggregate([
					{$match : commonConditions},
					{$group :{
						_id : {
							year_month : { $dateToString: { format: "%Y-%m", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE }}
						},
						year : {$last : { "$year": "$date"}},
						month : {$last : { "$month": "$date"}},
						restaurant_payout : {$sum : "$restaurant_payout"},
					}},
					{$match : yearConditions},
				]).toArray();
					
				let currentYear		= newDate().getFullYear();
				let currentMonth 	= newDate().getMonth()+1;
				let yearWiseData 	= {};
				result.map(record=>{
					if(!yearWiseData[record.year]) yearWiseData[record.year] = {};
					yearWiseData[record.year][record.month] = record?.restaurant_payout || 0;
				});
				
				let finalArray 	= [];
				let dataYears	= Object.keys(yearWiseData);
				Object.keys(Constants.REPORT_CHART_MONTH_NAMES).map(month=>{
					let tmpRow = [Constants.REPORT_CHART_MONTH_NAMES[month]];
					dataYears.map(tmpYear=>{
						let count = (yearWiseData[tmpYear] && yearWiseData[tmpYear][month]) ? yearWiseData[tmpYear][month] : 0;
						if(tmpYear == currentYear && month > currentMonth && count == 0) count = null;
						tmpRow.push(count);
					});
					finalArray.push(tmpRow);
				});
				
				/** Send response **/
				res.send({status : Constants.STATUS_SUCCESS, result : finalArray,years : dataYears });
			}else{	
				let response = await getDropdownList(req, res, next, {
					collections :[					
						{
							collection : Tables.RESTAURANT_BRANCHES,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions : {
								restaurant_id 	: restaurantId,
								is_active		: Constants.ACTIVE,
							},
						}
					]
				});

				/** render revenue growth report listing page **/
				req.breadcrumbs(BREADCRUMBS['reports/revenue_growth']);
				res.render('revenue_growth',{
					branch_list : response?.final_html_data?.["0"] || "",											
				});
			}
		} catch (error) {
			return next(error);
		}
	};//End getRevenueGrowthReport()

	/**
	 *  Function for export revenue growth report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async exportRevenueGrowthReport (req,res,next){
		try {
			let restaurantId	= new ObjectId(req.session.user.restaurant_id);
			let branchIds		= (req.query.branch_ids) ? (req.query.branch_ids).split(",")   	: [];
			let years			= (req.query.years) ? (req.query.years)  	: [];
		
			let branchArray = (branchIds.constructor === Array) ? branchIds : [branchIds];
			let yearsArray = (years.constructor === Array) ? years : [years];
			yearsArray = yearsArray.map(year => parseInt(year));
			
			/** Set order condition */
			let commonConditions =	{restaurant_id: restaurantId};
			let yearConditions = { year: { $in: yearsArray } };

			if (branchArray.length > 0) commonConditions.branch_id = { $in: arrayToObject(branchArray) };		
				
			const collection = this.db.collection(Tables.BRANCH_WISE_PROCESSED_ORDERS);
			let result = await collection.aggregate([
				{$match : commonConditions},
				{$group :{
					_id : {
						year_month : { $dateToString: { format: "%Y-%m", date: "$date", timezone: Constants.DEFAULT_TIME_ZONE }}
					},
					year : {$last : { "$year": "$date"}},
					month : {$last : { "$month": "$date"}},
					restaurant_payout : {$sum : "$restaurant_payout"},
				}},
				{$match : yearConditions},
			]).toArray();
				
			let currentYear		= newDate().getFullYear();
			let currentMonth 	= newDate().getMonth()+1;
			
			let yearWiseData 	= {};
			result.map(record=>{
				if(!yearWiseData[record.year]) yearWiseData[record.year] = {};
				yearWiseData[record.year][record.month] = record?.restaurant_payout || 0;
			});
			
			let finalArray 	= [];
			let dataYears	= Object.keys(yearWiseData);
			Object.keys(Constants.REPORT_CHART_MONTH_NAMES).map(month=>{
				let tmpRow = [Constants.REPORT_CHART_MONTH_NAMES[month]];
				dataYears.map(tmpYear=>{
					let count = (yearWiseData[tmpYear] && yearWiseData[tmpYear][month]) ? yearWiseData[tmpYear][month] : 0;
					if(tmpYear == currentYear && month > currentMonth && count == 0) count = null;
					tmpRow.push(count);
				});
				finalArray.push(tmpRow);
			});
			
			let commonColls	= [res.__("reports.month")];					
			dataYears.map(rec=>{
				commonColls.push(rec);
			});
			/**  Function to export data in excel format **/
			exportToExcel(req,res,{
				file_prefix 		: "RevenueGrowthReport",
				heading_columns		: commonColls,
				export_data			: finalArray
			});
		} catch (error) {
			return next(error);
		}
	};// end exportRevenueGrowthReport()
}
