import { ObjectId } from 'mongodb';
import BREADCRUMBS from "../../../../breadcrumbs.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { newDate, arrayToObject,isPost, getDropdownList, exportToExcel} from "../../../../utils/index.mjs";

export default class RevenueGenerated {
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
	async getRevenueGeneratedReport (req,res,next){
		try {
			let restaurantId	= new ObjectId(req.session.user.restaurant_id);
			if(isPost(req)){ 
				let years			= (req.body.years) 		? req.body.years : [];
				let branchIds		= (req.body.branch_ids) 	? req.body.branch_ids : [];
				let branchArray		= (branchIds.constructor === Array) ? branchIds : [branchIds];
				let yearsArray		= (years.constructor === Array) ? years : [years];
				yearsArray			= yearsArray.map(year=> parseInt(year));
				
				let commonConditions =	{restaurant_id: restaurantId};				
				if(branchArray.length > 0) commonConditions.branch_id = {$in : arrayToObject(branchArray)};		
				
				let yearConditions	= {year : {$in :yearsArray}};
				
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
				/**Get dropdown list **/
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

				/** render top selling items report listing page **/
				req.breadcrumbs(BREADCRUMBS['reports/revenue_generated']);
				res.render('revenue_generated',{
					branch_list : response?.final_html_data?.["0"] || "",											
				});
			}	
		} catch (error) {
			return next(error);
		}
	};//End getRevenueGeneratedReport()

	/**
	 *  Function for export revenue Generated report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async exportRevenueGeneratedReport (req,res,next){
		try {
			let restaurantId	= new ObjectId(req.session.user.restaurant_id);
			let branchIds		= (req.query.branch_ids) ? (req.query.branch_ids).split(",")   	: [];
			let years			= (req.query.years) ? (req.query.years)  	: [];
		
			let branchArray = (branchIds.constructor === Array) ? branchIds : [branchIds];
			let yearsArray = (years.constructor === Array) ? years : [years];
			yearsArray = yearsArray.map(year => parseInt(year));
			
			/** Set order condition */
			let commonConditions = {restaurant_id:	restaurantId};
			if (branchArray.length > 0) commonConditions.branch_id = { $in: arrayToObject(branchArray) };		

			let yearConditions = { year: { $in: yearsArray } };
				
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
				file_prefix 		: "RevenueGeneratedReport",
				heading_columns		: commonColls,
				export_data			: finalArray
			});
		} catch (error) {
			return next(error);
		}
	};// end exportRevenueGeneratedReport()
}
