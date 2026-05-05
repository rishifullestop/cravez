import { ObjectId } from 'mongodb';
import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, newDate, exportToExcel } from '../../../../utils/index.mjs';

// Model for average unit sold report
export default class AverageUnitSoldReport {
	constructor(db) {
		this.db = db;
		this.monthNames = {
			1 : 'Jan',
			2 : 'Feb',
			3 : 'Mar',
			4 : 'Apr',
			5 : 'May',
			6 : 'Jun',
			7 : 'July',
			8 : 'Aug',
			9 : 'Sep',
			10: 'Oct',
			11: 'Nov',
			12: 'Dec',
		};
	}
	
	
	/**
	* Function to get listing page
	*
	* @param req 	As Request Data
	* @param res 	As Response Data
	*
	* @return render/json
	*/
	async avgUnitSoldMoM(req,res,next){
		try {
			if(isPost(req)){
				let years			= (req.body.years) 		? req.body.years : [];
				let restaurantId	= (req.body.restaurant_id) 	? new ObjectId(req.body.restaurant_id) : "";
				let branchIds		= (req.body.branch_ids) 	? req.body.branch_ids : [];
				let branchArray		= (branchIds.constructor === Array) ? branchIds : [branchIds];
				let yearsArray		= (years.constructor === Array) ? years : [years];
				let yearWiseDates   =  [];
				yearsArray = yearsArray.map(year => {
					yearWiseDates.push({
						order_date : {
							$gte: newDate(newDate(year+"-01-01",Constants.CURRENTDATE_START_DATE_FORMAT)),
							$lte: newDate(newDate(year+"-12-31",Constants.CURRENTDATE_END_DATE_FORMAT)),
						},
					});
				});;
				
				/** Set order condition */
				let orderConditions = {$or: yearWiseDates, admin_status : Constants.ORDER_DELIVERED, };
				if(restaurantId) orderConditions.restaurant_id = restaurantId;
				if(branchArray.length > 0) orderConditions.branch_id = {$in : arrayToObject(branchArray)};
				
				const orders 	 = 	this.db.collection(Tables.ORDERS);
				asyncParallel({
					order_ids:(callback)=>{
						/** Get order ids  */
						orders.find(orderConditions,{projection: {_id:1}}).toArray().then(result => {
							let orderIds = [];
							if(result){
								orderIds = result.map(record=>{
									return new ObjectId(record._id);
								});							
							}
							callback(null,orderIds);						
						}).catch(next);
					},
				},(asyncErr, asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					let orderIds = asyncResponse.order_ids;			
				
					const collection = 	this.db.collection(Tables.ORDER_ITEMS);
					collection.aggregate([
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
							year : {$first : { "$year": "$order_date"}},
							month : {$first : { "$month": "$order_date"}},
							items : {$sum : 1},
						}},
					]).toArray().then(result => {
						
						var currentYear		= newDate().getFullYear();
						var currentMonth 	= newDate().getMonth()+1;
						let yearWiseData 	= {};
						result.map(record=>{
							if(!yearWiseData[record.year]) yearWiseData[record.year] = {};
							let tmpItems	= record.items; 					
							yearWiseData[record.year][record.month] = record.items;
						});
						
						let finalArray 	= [];
						let dataYears	= Object.keys(yearWiseData);
						Object.keys(this.monthNames).map(month=>{
							let tmpRow = [this.monthNames[month]];
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
					}).catch(next);
				});
			}else{	
				let options = {
					collections :[					
						{
							collection : Tables.RESTAURANTS,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions : {
								is_deleted	: Constants.NOT_DELETED
							},
						}
					]
				};

				/**Get dropdown list **/
				getDropdownList(req,res, next,options).then(response=> {
					/** render top selling items report listing page **/
					req.breadcrumbs(BREADCRUMBS['admin/report/average_unit_sold_report']);
					res.render('average_unit_sold_report',{
						restaurant_list : response?.final_html_data?.[0] || "",											
					});
				}).catch(next);
			}	
		} catch (error) {
			next(error);
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
	async avgUnitSoldMoMExport(req,res,next){
		try {
			let restaurantId	= (req.query.restaurant_id)? new ObjectId(req.query.restaurant_id): "";
			let branchIds		= (req.query.branch_ids) ? (req.query.branch_ids).split(",")   	: [];
			let years			= (req.query.years) ? (req.query.years).split(",")  	: [];
		
			let branchArray = (branchIds.constructor === Array) ? branchIds : [branchIds];
			let yearsArray = (years.constructor === Array) ? years : [years];
			yearsArray = yearsArray.map(year => {
				return parseInt(year);
			});
			const orders 	= 	this.db.collection(Tables.ORDERS);

			/** Set order condition */
			let orderConditions = { admin_status: Constants.ORDER_DELIVERED };
			let yearConditions = { year: { $in: yearsArray } };

			if (restaurantId) orderConditions.restaurant_id = restaurantId;
			if (branchArray.length > 0) orderConditions.branch_id = { $in: arrayToObject(branchArray) };

			asyncParallel({
				order_ids:(callback)=>{
					/** Get order ids  */
					orders.aggregate([
						{$match : orderConditions},
						{$project : {year : { "$year": "$order_date" },_id:1,admin_status:1}},
						{$match : yearConditions},
					]).toArray().then(result => {					
						let orderIds = result.map(record=>{
							return Object(record._id);
						});
						callback(null,orderIds);
					}).catch(next);
				},
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);
				let orderIds = asyncResponse.order_ids;				
				
				const collection = 	this.db.collection(Tables.ORDER_ITEMS);
				collection.aggregate([
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
						year : {$first : { "$year": "$order_date"}},
						month : {$first : { "$month": "$order_date"}},
						items : {$sum : 1},
					}},
				]).toArray().then(result => {
					
					var currentYear		= newDate().getFullYear();
					var currentMonth 	= newDate().getMonth()+1;
					
					let yearWiseData 	= {};
					result.map(record=>{
						if(!yearWiseData[record.year]) yearWiseData[record.year] = {};
						let tmpItems	= record.items; 					
						yearWiseData[record.year][record.month] = record.items;
					});
					
					let finalArray 	= [];
					let dataYears	= Object.keys(yearWiseData);
					Object.keys(this.monthNames).map(month=>{
						let tmpRow = [this.monthNames[month]];
						dataYears.map(tmpYear=>{
							let count = (yearWiseData[tmpYear] && yearWiseData[tmpYear][month]) ? yearWiseData[tmpYear][month] : 0;
							if(tmpYear == currentYear && month > currentMonth && count == 0){
								count = null;
							}
							tmpRow.push(count);
						});
						finalArray.push(tmpRow);
					});
					
					let commonColls	= [res.__("admin.report.month")];					
					dataYears.map(rec=>{
						commonColls.push(rec);
					});
					/**  Function to export data in excel format **/
					exportToExcel(req,res,{
						file_prefix 		: "avgUnitSoldMoMExport",
						heading_columns		: commonColls,
						export_data			: finalArray
					});
				}).catch(next);
			});
		} catch (error) {
			next(error);
		}
	};// end avgUnitSoldMoMExport()
}
