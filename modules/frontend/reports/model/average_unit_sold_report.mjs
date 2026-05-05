import { ObjectId } from 'mongodb';
import BREADCRUMBS from "../../../../breadcrumbs.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { newDate, arrayToObject,isPost, getDropdownList, exportToExcel} from "../../../../utils/index.mjs";

export default class AvgUnitSoldReport {
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
	async avgUnitSoldMoM (req,res,next){
		try {
			let restaurantId	= new ObjectId(req.session.user.restaurant_id);
			if(isPost(req)){
				let years			= (req.body.years) 		? req.body.years : [];
				let branchIds		= (req.body.branch_ids) ? req.body.branch_ids : [];
				let branchArray		= (branchIds.constructor === Array) ? branchIds : [branchIds];
				let yearsArray		= (years.constructor === Array) ? years : [years];
				
				yearsArray			= yearsArray.map(year=>parseInt(year));

				/** Set order condition */
				let orderConditions = {
					restaurant_id	: restaurantId,
					admin_status 	: Constants.ORDER_DELIVERED
				};
				let yearConditions	= {year : {$in :yearsArray}};
				
				if(branchArray.length > 0) orderConditions.branch_id = {$in : arrayToObject(branchArray)};
				
				const orders = 	this.db.collection(Tables.ORDERS);
				let orderResult = await orders.aggregate([
					{$match : orderConditions},
					{$project : {year : { "$year": "$order_date" },_id:1,admin_status:1}},
					{$match : yearConditions},
				]).toArray();

				let orderIds = orderResult.map(record=> new ObjectId(record._id));		
				
				const collection = 	this.db.collection(Tables.ORDER_ITEMS);
				let result = await collection.aggregate([
					{$match : {order_id : {$in : orderIds}}},
					{$lookup:	{ /** Get order details **/
						"from" 			: 	Tables.ORDERS,
						"localField" 	:	"order_id",
						"foreignField" 	: 	"_id",
						"as" 			: 	"order_detail"
					}},
					{$addFields : { order_date: {$arrayElemAt: ["$order_detail.order_date",0]}}},
					{$group :{
						_id : {
							year_month : { $dateToString: { format: "%Y-%m", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE }}
						},
						year : {$last : { "$year": "$order_date"}},
						month : {$last : { "$month": "$order_date"}},
						items : {$sum : 1},
					}},
				]).toArray();

				let currentYear		= newDate().getFullYear();
				let currentMonth 	= newDate().getMonth()+1;
				let yearWiseData 	= {};
				result.map(record=>{
					if(!yearWiseData[record.year]) yearWiseData[record.year] = {};
					yearWiseData[record.year][record.month] = record.items;
				});
				
				let finalArray 	= [];
				let dataYears	= Object.keys(yearWiseData);
				Object.keys(Constants.REPORT_CHART_MONTH_NAMES).map(month=>{
					let tmpRow = [Constants.REPORT_CHART_MONTH_NAMES[month]];
					dataYears.map(tmpYear=>{
						let count = (yearWiseData[tmpYear] && yearWiseData[tmpYear][month]) ? yearWiseData[tmpYear][month] : 0;
						if(tmpYear == currentYear && month > currentMonth && count == 0){
							count = null;
						}
						tmpRow.push(count);
					});
					finalArray.push(tmpRow);
				});
				
				res.send({status : Constants.STATUS_SUCCESS, result : finalArray,years : dataYears });
			}else{	
				/**Get dropdown list **/
				let response = await getDropdownList(req,res, next,{
					collections :[					
						{
							collection : Tables.RESTAURANT_BRANCHES,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions : {
								is_active		: Constants.ACTIVE,
								restaurant_id 	: restaurantId
							},
						}
					]
				});

				/** render top selling items report listing page **/
				req.breadcrumbs(BREADCRUMBS['reports/average_unit_sold_report']);
				res.render('average_unit_sold_report',{
					branch_list : response?.final_html_data?.[0] || "",											
				});
			}	
		} catch (error) {
			return next(error);
		}
	};//End avgUnitSoldMoM()

	/**
	 *  Function for export top selling items report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async avgUnitSoldMoMExport (req,res,next){
		try {
			let restaurantId	= new ObjectId(req.session.user.restaurant_id);
			let branchIds		= (req.query.branch_ids) ? (req.query.branch_ids).split(",")   	: [];
			let years			= (req.query.years) ? (req.query.years)  	: [];
		
			let branchArray = (branchIds.constructor === Array) ? branchIds : [branchIds];
			let yearsArray = (years.constructor === Array) ? years : [years];
			yearsArray = yearsArray.map(year => parseInt(year));

			/** Set order condition */
			let orderConditions = { 
				restaurant_id	: restaurantId,
				admin_status	: Constants.ORDER_DELIVERED 
			};
			let yearConditions = { year: { $in: yearsArray } };

			if (branchArray.length > 0) orderConditions.branch_id = { $in: arrayToObject(branchArray) };

			const orders = 	this.db.collection(Tables.ORDERS);
			let orderResult = await orders.aggregate([
				{$match : orderConditions},
				{$project : {year : { "$year": "$order_date" },_id:1,admin_status:1}},
				{$match : yearConditions},
			]).toArray();

			let orderIds = orderResult.map(record=> new ObjectId(record._id));

			const collection = 	this.db.collection(Tables.ORDER_ITEMS);
			let result = await collection.aggregate([
				{$match : {order_id : {$in : orderIds}}},
				{$lookup:	{ /** Get order details **/
					"from" 			: 	Tables.ORDERS,
					"localField" 	:	"order_id",
					"foreignField" 	: 	"_id",
					"as" 			: 	"order_detail"
				}},
				{$addFields : { order_date: {$arrayElemAt: ["$order_detail.order_date",0]}}},
				{$group :{
					_id : {
						year_month : { $dateToString: { format: "%Y-%m", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE }}
					},
					year : {$last : { "$year": "$order_date"}},
					month : {$last : { "$month": "$order_date"}},
					items : {$sum : 1},
				}},
			]).toArray();

			let currentYear		= newDate().getFullYear();
			let currentMonth 	= newDate().getMonth()+1;				
			let yearWiseData 	= {};
			result.map(record=>{
				if(!yearWiseData[record.year]) yearWiseData[record.year] = {};
				yearWiseData[record.year][record.month] = record.items;
			});
			
			let finalArray 	= [];
			let dataYears	= Object.keys(yearWiseData);
			Object.keys(Constants.REPORT_CHART_MONTH_NAMES).map(month=>{
				let tmpRow = [Constants.REPORT_CHART_MONTH_NAMES[month]];
				dataYears.map(tmpYear=>{
					let count = (yearWiseData[tmpYear] && yearWiseData[tmpYear][month]) ? yearWiseData[tmpYear][month] : 0;
					if(tmpYear == currentYear && month > currentMonth && count == 0){
						count = null;
					}
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
				file_prefix 		: "avgUnitSoldMoMExport",
				heading_columns		: commonColls,
				export_data			: finalArray
			});
		} catch (error) {
			return next(error);
		}
	};// end avgUnitSoldMoMExport()
}
