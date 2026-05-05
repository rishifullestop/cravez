import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, newDate, exportToExcel, configDatatable, getDifferenceBetweenTwoDatesInMinute, round } from '../../../../utils/index.mjs';

// Model for delivery time analysis report
export default class DeliveryTimeAnalysisReport {
	constructor(db) {
		this.db = db;
	}

	/**
	 * Function to get captain wise orders
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getDeliveryTimeAnalysisReportList(req,res,next){
		try{
			if(isPost(req)){
				let limit			= (req.body.length) 	? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 	= (req.body.start)  	? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     	= (req.body.from_date) 	? req.body.from_date 		:"";
				let toDate 	  	 	= (req.body.to_date)   	? req.body.to_date   		:"";
				const orders 		= this.db.collection(Tables.ORDERS);

				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);

				let commonConditions = { admin_status: Constants.ORDER_DELIVERED };
				/** Condition for date */
				if (fromDate != "" && toDate != "") {
					commonConditions["order_date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					};
				}

				dataTableConfig.conditions	=	Object.assign(commonConditions,dataTableConfig.conditions);
				if(dataTableConfig.sort_conditions) dataTableConfig.sort_conditions["_id"] = Constants.SORT_DESC;

				asyncParallel({
					records :(callback)=>{
						/** Get list **/
						orders.aggregate([
							{$match : dataTableConfig.conditions},
							{$lookup:	{
								"from" 			: 	Tables.ORDER_DETAILS,
								"localField" 	:	"_id",
								"foreignField" 	: 	"order_id",
								"as" 			: 	"order_details"
							}},
							{$lookup: {
								"from"			: Tables.USERS,
								"localField"	: "captain_id",
								"foreignField"	: "_id",
								"as"			: "user_details"
							}},
							{$lookup: {
								"from"			: Tables.ORDER_STATUS_LOGS,
								"localField"	: "_id",
								"foreignField"	: "order_id",
								"as"			: "logs_details"
							}},
							{$addFields : {
								delivery_duration		: { $arrayElemAt: ["$order_details.delivery_duration",0]},
								delivery_man			: { $arrayElemAt: ["$user_details.full_name", 0] },
								actual_delivery_time	: { $arrayElemAt: ["$order_details.delivery_in", 0] },
								preparation_time		: { $arrayElemAt: ["$order_details.preparation_time", 0] },
								customer_address_detail	: { $arrayElemAt: ["$order_details.customer_address_detail", 0] },
							}},
							{$project :{
								delivery_man:1,logs_details:1, actual_delivery_time:1, delivery_duration: 1, preparation_time: 1, customer_address_detail:1, area_name: 1, area_id: 1, delivery_type: 1, order_date: 1, restaurant_id: 1, restaurant_name: 1, unique_order_id:1, branch_id:1
							}},
							{$sort 	: dataTableConfig.sort_conditions},
							{$skip 	: skip},
							{$limit : limit},
						]).toArray().then(result=>{
							if(result.length == 0) return callback(null,result);

							let allBranchIds = [];
							result.map(record=>{
								var preparingTime 	= "";
								var readyTime 		= "";
								if (record.logs_details.length>0){
									record.logs_details.map(log=>{
										if (log.status == Constants.ORDER_PREPARING){
											preparingTime = log.created;
										} else if (log.status == Constants.ORDER_READY_TO_PICK_UP){
											readyTime = log.created;
										}
									});
								}
								if (record.logs_details.length > 0 && preparingTime != "" && readyTime!=""){
									let diff = getDifferenceBetweenTwoDatesInMinute(preparingTime, readyTime);
									var actualTime = round(diff);
									record.actual_preparing_time = actualTime;
								}

								if(record.branch_id) allBranchIds.push(record.branch_id);
							});

							asyncParallel({
								branch_list : (childCallback)=>{
									if(allBranchIds.length==0) return childCallback(null,{});

									/** Get branch details **/
									const restaurant_branches = this.db.collection(Tables.RESTAURANT_BRANCHES);
									restaurant_branches.find({
										_id : {$in: allBranchIds}
									},{projection: {_id:1, area_id:1}}).toArray().then(branchResult=>{

										let tmpBranchObj = {};
										branchResult.map(records=>{
											tmpBranchObj[records._id] = records;
										});
										childCallback(null,tmpBranchObj);
									}).catch(next);
								},
								delivery_areas : (childCallback)=>{
									const areas = this.db.collection(Tables.AREAS);
									areas.find({},{projection: {_id:1,name:1}}).toArray().then(areaResult=>{
										let deliveryAreaList = {};

										areaResult.map(area=>{
											deliveryAreaList[area._id] = area.name;
										});
										childCallback(null,deliveryAreaList);
									}).catch(next);
								},
							},(childErr, childResponse)=>{
								if(childErr) return callback(childErr, result);

								let tmpBranchList = (childResponse.branch_list) ? childResponse.branch_list :{};
								result.map(record=>{
									let branchAreaId = (tmpBranchList[record.branch_id]) ? tmpBranchList[record.branch_id].area_id: "";
									record.area_name = (childResponse.delivery_areas[branchAreaId]) ? childResponse.delivery_areas[branchAreaId] :{};
								});

								callback(null,result);
							});
						});
					},
					total_records:(callback)=>{
						/** Get total number of records **/
						orders.countDocuments(commonConditions).then(countResult=>{
							callback(null, countResult);
						}).catch(next);
					},
					filter_records:(callback)=>{
						/** Get filtered records counting **/
						orders.countDocuments(dataTableConfig.conditions).then(countResult=>{
							callback(null, countResult);
						}).catch(next);
					}
				},(err, response)=>{
					/** Send response **/
					res.send({
						status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
						draw			: dataTableConfig.result_draw,
						data			: response.records,
						recordsFiltered	: response.filter_records,
						recordsTotal	: response.total_records,
					});
				});
			}else{
				/** render listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/report/delivery_time_analysis_report']);
				res.render('delivery_time_analysis_report');
			}
		}catch(error){
			return next(error);
		}
	};//End getDeliveryTimeAnalysisReportList()

	/**
	 *  Function for Delivery Time Analysis export
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
	async getDeliveryTimeAnalysisReportExport(req,res,next){
		try{
			let fromDate 		= (req.query.from_date) ? req.query.from_date : "";
			let toDate 			= (req.query.to_date) ? req.query.to_date : "";
			let sortingField 	= (req.query.sort_field) ? req.query.sort_field : "_id";
			let sortingDir 		= (req.query.sort_dir) ? req.query.sort_dir : "asc";
			let sortOrder 		= (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;

			let exportConditions = {
				admin_status: Constants.ORDER_DELIVERED
			};
			let sortConditions = {};
			sortConditions[sortingField] = sortOrder;
			if(sortConditions) sortConditions["_id"] = Constants.SORT_DESC;

			if (fromDate != "" && toDate != "") {
				exportConditions["order_date"] = {
					$gte: newDate(fromDate),
					$lte: newDate(toDate),
				};
			}
			/** Get order details **/
			const orders = this.db.collection(Tables.ORDERS);
			orders.aggregate([
				{$match: exportConditions},
				{$lookup:	{
					"from" 			: 	Tables.ORDER_DETAILS,
					"localField" 	:	"_id",
					"foreignField" 	: 	"order_id",
					"as" 			: 	"order_details"
				}},
				{$lookup: {
					"from"			: Tables.USERS,
					"localField"	: "captain_id",
					"foreignField"	: "_id",
					"as"			: "user_details"
				}},
				{$lookup: {
					"from"			: Tables.ORDER_STATUS_LOGS,
					"localField"	: "_id",
					"foreignField"	: "order_id",
					"as"			: "logs_details"
				}},
				{$project: {
					logs_details: 1, area_name: 1, area_id: 1, delivery_type: 1, order_date: 1, restaurant_id: 1, restaurant_name: 1, unique_order_id: 1, branch_id:1,
					delivery_duration		: { $arrayElemAt: ["$order_details.delivery_duration", 0] },
					delivery_man			: { $arrayElemAt: ["$user_details.full_name", 0] },
					actual_delivery_time	: { $arrayElemAt: ["$order_details.delivery_in", 0] },
					preparation_time		: { $arrayElemAt: ["$order_details.preparation_time", 0] },
					customer_address_detail	: { $arrayElemAt: ["$order_details.customer_address_detail", 0] },
				}},
				{$sort: sortConditions},
			]).toArray().then(result=>{

				let allBranchIds = [];
				result.map(record => {
					var preparingTime = 0;
					var readyTime = 0;
					record.logs_details.map(log => {
						if (log.status == Constants.ORDER_PREPARING) {
							preparingTime = log.created;
						} else if (log.status == Constants.ORDER_READY_TO_PICK_UP) {
							readyTime = log.created;
						}
					});
					if (record.logs_details.length > 0 && preparingTime != "" && readyTime != "") {
						let diff = getDifferenceBetweenTwoDatesInMinute(preparingTime,readyTime);
						var actualTime = Math.abs(Math.round(diff));
						record.actual_preparing_time = actualTime;
					}
					if(record.branch_id) allBranchIds.push(record.branch_id);
				});

				asyncParallel({
					branch_list: (childCallback)=>{
						if(allBranchIds.length==0) return childCallback(null,{});

						/** Get branch details **/
						const restaurant_branches = this.db.collection(Tables.RESTAURANT_BRANCHES);
						restaurant_branches.find({
							_id : {$in: allBranchIds}
						},{projection: {_id:1, area_id:1}}).toArray().then(branchResult=>{

							let tmpBranchObj = {};
							branchResult.map(records=>{
								tmpBranchObj[records._id] = records;
							});
							childCallback(null,tmpBranchObj);
						}).catch(next);
					},
					delivery_areas : (childCallback)=>{
						const areas = this.db.collection(Tables.AREAS);
						areas.find({},{projection: {_id:1,name:1}}).toArray().then(areaResult=>{
							let deliveryAreaList = {};

							areaResult.map(area=>{
								deliveryAreaList[area._id] = area.name;
							});
							childCallback(null,deliveryAreaList);
						}).catch(next);
					},
				},(childErr, childResponse)=>{
					if(childErr) return next(childErr);

					let tmpBranchList 		= 	(childResponse.branch_list) 	? 	childResponse.branch_list 		:{};
					let deliveryAreasList 	=	(childResponse.delivery_areas) 	?	childResponse.delivery_areas 	:{};

					/** Define excel heading label **/
					let commonColls	= [
						res.__("admin.report.order_id"),
						res.__("admin.report.restaurant_name"),
						res.__("admin.report.area_name"),
						res.__("admin.report.customer_area"),
						res.__("admin.report.delivery_time"),
						res.__("admin.report.actual_delivery_time"),
						res.__("admin.report.difference"),
						res.__("admin.report.deliver_by"),
						res.__("admin.report.preparation_time"),
						res.__("admin.report.actual_preparation_time"),
						res.__("admin.report.preparation_difference"),
						res.__("admin.report.delivery_man"),
						res.__("admin.report.order_date"),
						res.__("admin.report.order_time"),
					];

					let temp = [];
					if (result && result.length > 0){
						result.map(records=>{
							let branchAreaId = (tmpBranchList[records.branch_id]) ? tmpBranchList[records.branch_id].area_id: "";
							records.area_name = (deliveryAreasList[branchAreaId]) ? deliveryAreasList[branchAreaId] :{};

							var actualDeliveryTime 	= (records.actual_delivery_time) ? records.actual_delivery_time : 0;
							var deliveryTime 		= (records.delivery_duration) ? records.delivery_duration : 0;
							var deliveryDifference 	= round(actualDeliveryTime - deliveryTime);
							var actualPrepTime 		= (records.actual_preparing_time) ? records.actual_preparing_time : 0;
							var prepTime 			= (records.preparation_time) ? records.preparation_time : 0;
							var prepDifference 		= round(actualPrepTime - prepTime);
							let buffer =	[
								(records.unique_order_id) 			? records.unique_order_id : "",
								(records.restaurant_name)			? 	records.restaurant_name[Constants.DEFAULT_LANGUAGE_CODE] 		:"",
								(records.area_name)					? 	records.area_name[Constants.DEFAULT_LANGUAGE_CODE] 		:"",
								(records.customer_address_detail) 	? records.customer_address_detail.area_name[Constants.DEFAULT_LANGUAGE_CODE] 		:"",
								(records.delivery_duration) 		? records.delivery_duration : 0,
								(records.actual_delivery_time) 		? records.actual_delivery_time : 0,
								deliveryDifference,
								(records.delivery_type) 			? Constants.DELIVERY_BY[records.delivery_type] : "",
								(records.preparation_time) 			? records.preparation_time : 0,
								(records.actual_preparing_time) 	? records.actual_preparing_time : 0,
								prepDifference,
								(records.delivery_man) 				? records.delivery_man : "",
								(records.order_date) 				? newDate(records.order_date, Constants.DATE_FORMAT_EXPORT) : '',
								(records.order_date) 				? newDate(records.order_date, Constants.AVAYA_TIME_FORMAT) : '',
							];
							temp.push(buffer);
						});
					}

					/**  Function to export data in excel format **/
					exportToExcel(req,res,{
						file_prefix 		: "DeliveryTimeAnalysisExport",
						heading_columns		: commonColls,
						export_data			: temp
					});
				});
			});
		}catch(error){
			return next(error);
		}
	};// end getDeliveryTimeAnalysisReportExport()
}
