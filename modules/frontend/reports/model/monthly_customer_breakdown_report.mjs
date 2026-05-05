import { ObjectId } from 'mongodb';
import { parallel as asyncParallel } from 'async';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from '../../../../utils/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

export default class CustomerBreakdownReports {
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
	async getCustomerBreakdownReport (req,res,next){
		try{
			let restaurantId = new ObjectId(req.session.user.restaurant_id);
			if(isPost(req)){
				let year		= (req.body.year) ? parseInt(req.body.year) : "";
				const users		= this.db.collection(Tables.USERS);
				const orders	= this.db.collection(Tables.ORDERS);
				let query       = { userId: "$_id", yearMonth: "$year_month", restaurantId: restaurantId };

				asyncParallel({
					customer_without_order:(callback)=>{
						users.aggregate([
							{$match : Constants.CUSTOMER_COMMON_CONDITIONS},
							{$addFields : {
								year 		: {$year: "$created" },
								year_month	: {$dateToString: {format: "%Y-%m",date: "$created",timezone: Constants.DEFAULT_TIME_ZONE}}
							}},
							{$match : {year : year}},
							{$lookup:	{
								from     : Tables.ORDERS,
								let      : query,
								pipeline : [
									{$addFields : {
										year_month	: {$dateToString: {format: "%Y-%m",date: "$created",timezone: Constants.DEFAULT_TIME_ZONE}}
									}},
									{$match : {
										$expr: {
											$and : [
												{$eq: ["$customer_id", "$$userId"]},
												{$eq: ["$restaurant_id", "$$restaurantId"] },
												{$eq: ["$year_month", "$$yearMonth"]},
											]
										}
									}},
								],
								as	:	"order_detials"
							}},
							{$addFields : {order_count : { "$size": "$order_detials" }}},
							{$match : {order_count :0}},
							{$group : {
								_id : {
									year_month : { $dateToString: { format: "%Y-%m", date: "$created", timezone: Constants.DEFAULT_TIME_ZONE }}
								},
								year  : {$first : { "$year": "$created"}},
								month : {$first : { "$month": "$created"}},
								count : {$sum : 1},
							}},
						],{ allowDiskUse: true}).toArray().then(result=>{
							callback(null,result);
						}).catch(next);
					},
					multi_order_customer:(callback)=>{
						users.aggregate([
							{$match : Constants.CUSTOMER_COMMON_CONDITIONS},
							{$addFields : {
								year 		: {$year: "$created" },
								year_month	: {$dateToString: {format: "%Y-%m",date: "$created",timezone: Constants.DEFAULT_TIME_ZONE}}
							}},
							{$match : {year : year}},
							{$lookup:	{
								from     : Tables.ORDERS,
								let      : query,
								pipeline : [
									{$addFields : {
										year_month	: {$dateToString: {format: "%Y-%m",date: "$created",timezone: Constants.DEFAULT_TIME_ZONE}}
									}},
									{$match : {
										$expr: {
											$and : [
												{$eq: ["$customer_id", "$$userId"]},
												{$eq: ["$year_month", "$$yearMonth"]},
												{ $eq: ["$restaurant_id", "$$restaurantId"] },
											]
										}
									}},
								],
								as	:	"order_detials"
							}},
							{$addFields : {order_count : { "$size": "$order_detials" }}},
							{$match : {order_count :{$gt : 1}}},
							{$group : {
								_id : {
									year_month : { $dateToString: { format: "%Y-%m", date: "$created", timezone: Constants.DEFAULT_TIME_ZONE }}
								},
								year  : {$first : { "$year": "$created"}},
								month : {$first : { "$month": "$created"}},
								count : {$sum : 1},
							}},

						],{ allowDiskUse: true}).toArray().then(result=>{
							callback(null,result);
						}).catch(next);
					},
					repeating_customers :(callback)=>{
						orders.aggregate([
							{ $match: { admin_status: Constants.ORDER_DELIVERED, restaurant_id:restaurantId}},
							{$addFields : {
								year 		: {$year: "$order_date" },
								year_month	: { $dateToString: { format: "%Y-%m", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE }}
							}},
							{$match : {year : year}},
							{$group : {
								_id : {
									year_month : "$year_month",
									customer_id : "$customer_id"
								},
								year_month  : {$first : "$year_month"},
								year  		: {$first : { "$year": "$order_date"}},
								month 		: {$first : { "$month": "$order_date"}},
								order_count : {$sum : 1},
							}},
							{$match : {order_count :{$gt : 1}}},
							{$group : {
								_id 	: "$year_month",
								year  	: {$first : "$year"},
								month 	: {$first : "$month"},
								count 	: {$sum : 1},
							}},
						],{ allowDiskUse: true}).toArray().then(result=>{
							callback(null,result);
						}).catch(next);
					},
					winback_customers :(callback)=>{
						let orderCutoffdate	= Helpers.newDate((year-1)+"-07-01");
						let todayDate		= Helpers.newDate();

						orders.aggregate([
							{$match : {
								admin_status: Constants.ORDER_DELIVERED,
								restaurant_id: restaurantId,
								"$and" 		: [{order_date: {$gte : orderCutoffdate}},{order_date: {$lte : todayDate}}]
							}},
							{$addFields : {
								year_month	: { $dateToString: { format: "%Y-%m", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE }}
							}},
							{$group : {
								_id : {
									year_month : "$year_month",
								},
								customer_ids: {$addToSet : "$customer_id"},
								year_month  : {$first : "$year_month"},
								year  		: {$first : { "$year": "$order_date"}},
								month 		: {$first : { "$month": "$order_date"}},
							}},
							{$sort : {year_month : Constants.SORT_ASC}}
						],{ allowDiskUse: true}).toArray().then(result=>{

							let customerLists = {};
							result.map(record=>{
								customerLists[record.year_month] = record.customer_ids.map(rec=>{ return String(rec)});
							});
							let winbackUsers = {};
							result.map(record=>{
								let currentYearMonth	= record.year_month;
								let lastMonth			= (record.month-1) < 10 ? "0"+(record.month-1) : record.month-1;
								let lastYearMonth		= (record.month == 1 ? (record.year-1) : record.year)+"-"+lastMonth;
								if(record.year == year){
									if(!winbackUsers[currentYearMonth]) winbackUsers[currentYearMonth] = {month : record.month,year : record.year,customers : []};

									record.customer_ids.map(cid=>{
										if(!customerLists[lastYearMonth] || ( customerLists[lastYearMonth] && customerLists[lastYearMonth].indexOf(String(cid))) == -1){
											let orderInSixMonth  = false;
											for(i=2; i<= 6; i++){
												if(customerLists[lastYearMonth] && customerLists[lastYearMonth].indexOf(String(cid)) != -1){
													orderInSixMonth = true;
												}
											}
											if(orderInSixMonth) winbackUsers[currentYearMonth].customers.push(String(cid));
										}
									});
								}
							});
							callback(null,Object.values(winbackUsers));
						}).catch(next);
					},
				},(err, response)=>{

					let currentYear		= Helpers.newDate().getFullYear();
					let currentMonth 	= Helpers.newDate().getMonth()+1;
					let yearWiseData 	= {};
					response.customer_without_order.map(record=>{
						if(!yearWiseData[record.year]) yearWiseData[record.year] = {};
						if(!yearWiseData[record.year][record.month]) yearWiseData[record.year][record.month] = {};
						yearWiseData[record.year][record.month]["customer_without_order"] = record.count;
					});
					response.multi_order_customer.map(record=>{
						if(!yearWiseData[record.year]) yearWiseData[record.year] = {};
						if(!yearWiseData[record.year][record.month]) yearWiseData[record.year][record.month] = {};
						yearWiseData[record.year][record.month]["multi_order_customer"] = record.count;
					});
					response.repeating_customers.map(record=>{
						if(!yearWiseData[record.year]) yearWiseData[record.year] = {};
						if(!yearWiseData[record.year][record.month]) yearWiseData[record.year][record.month] = {};
						yearWiseData[record.year][record.month]["repeating_customers"] = record.count;
					});
					response.winback_customers.map(record=>{
						if(!yearWiseData[record.year]) yearWiseData[record.year] = {};
						if(!yearWiseData[record.year][record.month]) yearWiseData[record.year][record.month] = {};
						yearWiseData[record.year][record.month]["winback_customers"] = record.customers.length;
					});

					let finalArray 	= [];
					let dataYears	= Object.keys(yearWiseData);

					Object.keys(Constants.REPORT_CHART_MONTH_NAMES).map(month=>{
						let tmpRow = [Constants.REPORT_CHART_MONTH_NAMES[month]];
						dataYears.map(tmpYear=>{
							let tmpObj = (yearWiseData[tmpYear] && yearWiseData[tmpYear][month]) ? yearWiseData[tmpYear][month] : {};
							if(!tmpObj.customer_without_order)	tmpObj.customer_without_order	= 0;
							if(!tmpObj.multi_order_customer)	tmpObj.multi_order_customer 	= 0;
							if(!tmpObj.repeating_customers) 	tmpObj.repeating_customers		= 0;
							if(!tmpObj.winback_customers)		tmpObj.winback_customers		= 0;

							if(tmpYear == currentYear && month > currentMonth){
								tmpObj.customer_without_order = null;
							}
							if(tmpYear == currentYear && month > currentMonth){
								tmpObj.multi_order_customer = null;
							}
							if(tmpYear == currentYear && month > currentMonth){
								tmpObj.repeating_customers = null;
							}
							if(tmpYear == currentYear && month > currentMonth){
								tmpObj.winback_customers = null;
							}
							tmpRow.push(tmpObj.customer_without_order);
							tmpRow.push(tmpObj.multi_order_customer);
							tmpRow.push(tmpObj.repeating_customers);
							tmpRow.push(tmpObj.winback_customers);
						});
						finalArray.push(tmpRow);
					});
					res.send({status : Constants.STATUS_SUCCESS, result : finalArray,years : dataYears});
				});
			}else{
				/** render listing page **/
				req.breadcrumbs(BREADCRUMBS['reports/monthly_customer_breakdown_report']);
				res.render('monthly_customer_breakdown_report');
			}
		}catch(err){ return next(err); }
	};//End getCustomerBreakdownReport()


	/**
	 *  Function for export report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async exportCustomerBreakdownReport (req,res,next){
		try{
			let restaurantId = new ObjectId(req.session.user.restaurant_id);
			let year		= (req.query.year) ? parseInt(req.query.year) : "";;
			const users		= this.db.collection(Tables.USERS);
			const orders	= this.db.collection(Tables.ORDERS);

			let query = { userId: "$_id", yearMonth: "$year_month", restaurantId: restaurantId };

			asyncParallel({
				customer_without_order:(callback)=>{
					users.aggregate([
						{$match : Constants.CUSTOMER_COMMON_CONDITIONS},
						{$addFields : {
							year 		: {$year: "$created" },
							year_month	: {$dateToString: {format: "%Y-%m",date: "$created",timezone: Constants.DEFAULT_TIME_ZONE}}
						}},
						{$match : {year : year}},
						{$lookup:	{
							from     : Tables.ORDERS,
							let      : query,
							pipeline : [
								{$addFields : {
									year_month	: {$dateToString: {format: "%Y-%m",date: "$created",timezone: Constants.DEFAULT_TIME_ZONE}}
								}},
								{$match : {
									$expr: {
										$and : [
											{$eq: ["$customer_id", "$$userId"]},
											{$eq: ["$year_month", "$$yearMonth"]},
											{$eq: ["$restaurant_id", "$$restaurantId"] },
										]
									}
								}},
							],
							as	:	"order_detials"
						}},
						{$addFields : {order_count : { "$size": "$order_detials" }}},
						{$match : {order_count :0}},
						{$group : {
							_id : {
								year_month : { $dateToString: { format: "%Y-%m", date: "$created", timezone: Constants.DEFAULT_TIME_ZONE }}
							},
							year  : {$first : { "$year": "$created"}},
							month : {$first : { "$month": "$created"}},
							count : {$sum : 1},
						}},
					]).toArray().then(result=>{
						callback(null,result);
					}).catch(next);
				},
				multi_order_customer:(callback)=>{
					users.aggregate([
						{$match : Constants.CUSTOMER_COMMON_CONDITIONS},
						{$addFields : {
							year 		: {$year: "$created" },
							year_month	: {$dateToString: {format: "%Y-%m",date: "$created",timezone: Constants.DEFAULT_TIME_ZONE}}
						}},
						{$match : {year : year}},
						{$lookup:	{
							from     : Tables.ORDERS,
							let      : query,
							pipeline : [
								{$addFields : {
									year_month	: {$dateToString: {format: "%Y-%m",date: "$created",timezone: Constants.DEFAULT_TIME_ZONE}}
								}},
								{$match : {
									$expr: {
										$and : [
											{$eq: ["$customer_id", "$$userId"]},
											{$eq: ["$year_month", "$$yearMonth"]},
											{ $eq: ["$restaurant_id", "$$restaurantId"] },
										]
									}
								}},
							],
							as	:	"order_detials"
						}},
						{$addFields : {order_count : { "$size": "$order_detials" }}},
						{$match : {order_count :{$gt : 1}}},
						{$group : {
							_id : {
								year_month : { $dateToString: { format: "%Y-%m", date: "$created", timezone: Constants.DEFAULT_TIME_ZONE }}
							},
							year  : {$first : { "$year": "$created"}},
							month : {$first : { "$month": "$created"}},
							count : {$sum : 1},
						}},

					]).toArray().then(result=>{
						callback(null,result);
					}).catch(next);
				},
				repeating_customers :(callback)=>{
					orders.aggregate([
						{ $match: { admin_status: Constants.ORDER_DELIVERED, restaurant_id: restaurantId}},
						{$addFields : {
							year 		: {$year: "$order_date" },
							year_month	: { $dateToString: { format: "%Y-%m", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE }}
						}},
						{$match : {year : year}},
						{$group : {
							_id : {
								year_month : "$year_month",
								customer_id : "$customer_id"
							},
							year_month  : {$first : "$year_month"},
							year  		: {$first : { "$year": "$order_date"}},
							month 		: {$first : { "$month": "$order_date"}},
							order_count : {$sum : 1},
						}},
						{$match : {order_count :{$gt : 1}}},
						{$group : {
							_id 	: "$year_month",
							year  	: {$first : "$year"},
							month 	: {$first : "$month"},
							count 	: {$sum : 1},
						}},
					]).toArray().then(result=>{
						callback(null,result);
					}).catch(next);
				},
				winback_customers :(callback)=>{
					let orderCutoffdate	= Helpers.newDate((year-1)+"-07-01");
					let todayDate		= Helpers.newDate();

					orders.aggregate([
						{$match : {
							admin_status: Constants.ORDER_DELIVERED,
							restaurant_id: restaurantId,
							"$and" 		: [{order_date: {$gte : orderCutoffdate}},{order_date: {$lte : todayDate}}]
						}},
						{$addFields : {
							year_month	: { $dateToString: { format: "%Y-%m", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE }}
						}},
						{$group : {
							_id : {
								year_month : "$year_month",
							},
							customer_ids: {$addToSet : "$customer_id"},
							year_month  : {$first : "$year_month"},
							year  		: {$first : { "$year": "$order_date"}},
							month 		: {$first : { "$month": "$order_date"}},
						}},
						{$sort : {year_month : Constants.SORT_ASC}}
					]).toArray().then(result=>{

						let customerLists = {};
						result.map(record=>{
							customerLists[record.year_month] = record.customer_ids.map(rec=>{ return String(rec)});
						});
						let winbackUsers = {};
						result.map(record=>{
							let currentYearMonth	= record.year_month;
							let lastMonth			= (record.month-1) < 10 ? "0"+(record.month-1) : record.month-1;
							let lastYearMonth		= (record.month == 1 ? (record.year-1) : record.year)+"-"+lastMonth;
							if(record.year == year){
								if(!winbackUsers[currentYearMonth]) winbackUsers[currentYearMonth] = {month : record.month,year : record.year,customers : []};

								record.customer_ids.map(cid=>{
									if(!customerLists[lastYearMonth] || ( customerLists[lastYearMonth] && customerLists[lastYearMonth].indexOf(String(cid))) == -1){
										let orderInSixMonth  = false;
										for(i=2; i<= 6; i++){
											if(customerLists[lastYearMonth] && customerLists[lastYearMonth].indexOf(String(cid)) != -1){
												orderInSixMonth = true;
											}
										}
										if(orderInSixMonth) winbackUsers[currentYearMonth].customers.push(String(cid));
									}
								});
							}
						});
						callback(null,Object.values(winbackUsers));
					}).catch(next);
				},
			},(err, response)=>{

				/** Send response **/
				var currentYear		= Helpers.newDate().getFullYear();
				var currentMonth 	= Helpers.newDate().getMonth()+1;
				let yearWiseData 	= {};
				response.customer_without_order.map(record=>{
					if(!yearWiseData[record.year]) yearWiseData[record.year] = {};
					if(!yearWiseData[record.year][record.month]) yearWiseData[record.year][record.month] = {};
					yearWiseData[record.year][record.month]["customer_without_order"] = record.count;
				});
				response.multi_order_customer.map(record=>{
					if(!yearWiseData[record.year]) yearWiseData[record.year] = {};
					if(!yearWiseData[record.year][record.month]) yearWiseData[record.year][record.month] = {};
					yearWiseData[record.year][record.month]["multi_order_customer"] = record.count;
				});
				response.repeating_customers.map(record=>{
					if(!yearWiseData[record.year]) yearWiseData[record.year] = {};
					if(!yearWiseData[record.year][record.month]) yearWiseData[record.year][record.month] = {};
					yearWiseData[record.year][record.month]["repeating_customers"] = record.count;
				});
				response.winback_customers.map(record=>{
					if(!yearWiseData[record.year]) yearWiseData[record.year] = {};
					if(!yearWiseData[record.year][record.month]) yearWiseData[record.year][record.month] = {};
					yearWiseData[record.year][record.month]["winback_customers"] = record.customers.length;
				});

				let finalArray 	= [];
				let dataYears	= Object.keys(yearWiseData);
				Object.keys(Constants.REPORT_CHART_MONTH_NAMES).map(month=>{
					let tmpRow = [Constants.REPORT_CHART_MONTH_NAMES[month]];
					dataYears.map(tmpYear=>{
						let tmpObj = (yearWiseData[tmpYear] && yearWiseData[tmpYear][month]) ? yearWiseData[tmpYear][month] : {};
						if(!tmpObj.customer_without_order)	tmpObj.customer_without_order	= 0;
						if(!tmpObj.multi_order_customer)	tmpObj.multi_order_customer 	= 0;
						if(!tmpObj.repeating_customers) 	tmpObj.repeating_customers		= 0;
						if(!tmpObj.winback_customers)		tmpObj.winback_customers		= 0;

						if(tmpYear == currentYear && month > currentMonth && (!tmpObj.customer_without_order || tmpObj.customer_without_order == 0)){
							tmpObj.customer_without_order = null;
						}
						if(tmpYear == currentYear && month > currentMonth && (!tmpObj.multi_order_customer || tmpObj.multi_order_customer == 0)){
							tmpObj.multi_order_customer = null;
						}
						if(tmpYear == currentYear && month > currentMonth && (!tmpObj.repeating_customers || tmpObj.repeating_customers == 0)){
							tmpObj.repeating_customers = null;
						}
						if(tmpYear == currentYear && month > currentMonth && (!tmpObj.winback_customers || tmpObj.winback_customers == 0)){
							tmpObj.winback_customers = null;
						}
						tmpRow.push(tmpObj.customer_without_order);
						tmpRow.push(tmpObj.multi_order_customer);
						tmpRow.push(tmpObj.repeating_customers);
						tmpRow.push(tmpObj.winback_customers);
					});
					finalArray.push(tmpRow);
				});

				let commonColls	= [
					res.__("reports.month"),
					res.__("reports.new_customer_without_purchase"),
					res.__("reports.new_customer_multi_purchase"),
					res.__("reports.repeating_customer"),
					res.__("reports.winback_customers")
				];

				/**  Function to export data in excel format **/
				Helpers.exportToExcel(req,res,{
					file_prefix 		: "CustomerBreakdownExport",
					heading_columns		: commonColls,
					export_data			: finalArray
				});
			});
		}catch(err){ return next(err); }
	};// end exportCustomerBreakdownReport()
}