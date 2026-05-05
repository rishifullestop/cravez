import { ObjectId } from 'mongodb';
import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList,arrayToObject, newDate, configDatatable } from '../../../../utils/index.mjs';

// Model for bi analytics report
export default class BIAnalyticsReport {
	constructor(db) {
		this.db = db;
	}

	/**
	 * Function to get Analytics Report list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getAnalyticsReportList(req,res,next){
		try {
			if(isPost(req)){
				let fromDate     	= (req.body.from_date) 		? req.body.from_date 		: "";
				let toDate 	  	 	= (req.body.to_date)   		? req.body.to_date   		: "";
				let restaurantIds	= (req.body.restaurant_ids) ? req.body.restaurant_ids   : [];
				let areaIds			= (req.body.area_ids)   	? req.body.area_ids   		: [];
				let cuisineIds		= (req.body.cuisine_ids)   	? req.body.cuisine_ids   	: [];
				let itemIds			= (req.body.item_ids)   	? req.body.item_ids   		: [];
				let gender			= (req.body.gender)   		? req.body.gender   		: "";
				let offerCode		= (req.body.offer_code)		? req.body.offer_code  		: "";
				let weekDays		= (req.body.week_days)   	? req.body.week_days   	: [];
				let ageGroups		= (req.body.age_group)   	? req.body.age_group   	: [];
				let customerMinAov	= (req.body.min_aov)   		? parseFloat(req.body.min_aov)	: "";
				let customerMaxAov	= (req.body.max_aov)   		? parseFloat(req.body.max_aov)	: "";

				restaurantIds	= (restaurantIds && restaurantIds.constructor === Array) ?restaurantIds :[restaurantIds];
				areaIds			= (areaIds && areaIds.constructor === Array) ?areaIds :[areaIds];
				cuisineIds		= (cuisineIds && cuisineIds.constructor === Array) ?cuisineIds :[cuisineIds];
				weekDays		= (weekDays && weekDays.constructor === Array) ?weekDays :[weekDays];
				weekDays		= weekDays.map(day=>{return parseInt(day);});

				const users = this.db.collection(Tables.USERS);

				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);

				let commonConditions		= {user_role_id: Constants.CUSTOMER, is_deleted : Constants.NOT_DELETED};
				let orderCondition			= {admin_status : Constants.ORDER_DELIVERED};
				let orderDetailsCondition	= {};
				let weekDayCondition		= {};
				let itemCondition			= {};
				let ageCondition			= [];

				/** Condition for date */
				if (fromDate != "" && toDate != "") {
					orderCondition.order_date = {
						$gte: newDate(fromDate),
						$lte: newDate(toDate),
					};
				}

				if(restaurantIds.length > 0) orderCondition.restaurant_id	= {$in :arrayToObject(restaurantIds)};
				if(areaIds.length > 0) orderDetailsCondition.delivery_area_id= {$in :arrayToObject(areaIds)};
				if(offerCode) orderDetailsCondition.offer_code				= {$regex: offerCode,$options: 'i'};
				if(weekDays.length > 0) weekDayCondition.week_day			= {$in : weekDays};
				if(cuisineIds.length > 0) itemCondition.cuisine_ids			= {$in : arrayToObject(cuisineIds)};
				if(itemIds.length > 0) itemCondition.item_id				= {$in : arrayToObject(itemIds)};

				ageGroups.map(age=>{
					switch(age){
						case Constants.ZERO_TO_SIXTEEN:
							ageCondition.push({date_of_birth : {
								$gt: newDate(this.getYearFromAge(16)),
								$lte: newDate(),
							}});
							ageCondition.push({$or : [{date_of_birth : {$exists : false}},{date_of_birth : {$eq : ""}}]});
						break;
						case Constants.SIXTEEN_TO_EIGHTEEN:
							ageCondition.push({date_of_birth : {
								$gt: newDate(this.getYearFromAge(18)),
								$lte: newDate(this.getYearFromAge(16)),
							}});
						break;
						case Constants.EIGHTEEN_TO_TWENTY_THREE:
							ageCondition.push({date_of_birth : {
								$gt: newDate(this.getYearFromAge(23)),
								$lte: newDate(this.getYearFromAge(18)),
							}});
						break;
						case Constants.TWENTY_TWENTY_THREE_TO_TWENTY_EIGHT:
							ageCondition.push({date_of_birth : {
								$gt: newDate(this.getYearFromAge(28)),
								$lte: newDate(this.getYearFromAge(23)),
							}});
						break;
						case Constants.TWENTY_EIGHT_TO_FORTY_TWO:
							ageCondition.push({date_of_birth : {
								$gt: newDate(this.getYearFromAge(42)),
								$lte: newDate(this.getYearFromAge(28)),
							}});
						break;
						case Constants.MORE_THAN_FORTY_TWO:
								ageCondition.push({date_of_birth : {
									$lte: newDate(this.getYearFromAge(42)),
								}});
						break;
					}
				});

				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);
				asyncParallel({
					order_ids :(firstCallback)=>{
						if(itemIds.length == 0 && cuisineIds.length == 0) return firstCallback(null,null);

						const order_items	= this.db.collection(Tables.ORDER_ITEMS);
						order_items.distinct("order_id",itemCondition).then(itemOrders => {
							firstCallback(null,itemOrders);
						}).catch(next);
					}
				},(_,itemResponse)=>{

					if(itemResponse && itemResponse.order_ids){
						orderCondition._id = {$in : itemResponse.order_ids};
					}

					asyncParallel({
						orders :(parentCallback)=>{
							const orders	= this.db.collection(Tables.ORDERS);
							orders.aggregate([
								{$match : orderCondition},

								{$addFields : {
									week_day 	: {$dateToString: { format: "%u", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE }},
									hour_str	: {$dateToString: { format: "%H.%M", date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE }},
								}},
								{$project	: {
									hours 		: { $toDouble: "$hour_str" },
									week_day	:  {$toInt: "$week_day" },
									customer_id	: 1,
									order_date	: 1
								}},
								{$match : weekDayCondition}
							]).toArray().then(result => {
								let userIds = {};
								result.forEach(record=>{
									userIds[record.customer_id]= new ObjectId(record.customer_id);
								});
								parentCallback(null,Object.values(userIds));
							}).catch(next);
						},
						order_details :(parentCallback)=>{
							if(!offerCode &&  areaIds.length == 0) return parentCallback(null,null);
							const order_details	= this.db.collection(Tables.ORDER_DETAILS);
							order_details.distinct("customer_id",orderDetailsCondition).then(userIds => {
								parentCallback(null,userIds);
							}).catch(next);
						},
					},(parellelErr,parentResponse)=>{
						if(parellelErr) return next(parellelErr);


						let ordersCustomers		= arrayToObject(parentResponse.orders);
						let detailsCustomers 	= arrayToObject(parentResponse.order_details);
						dataTableConfig.conditions["$and"] = [
							{_id : {$in : ordersCustomers}},
						];

						if(offerCode != "" || areaIds.length > 0){
							dataTableConfig.conditions["$and"].push({_id : {$in : detailsCustomers}});
						}
						if(gender) dataTableConfig.conditions.gender = gender;
						if(ageCondition.length > 0) dataTableConfig.conditions["$or"] = ageCondition;
						let customerAoVCondition = {};
						if(customerMinAov || customerMaxAov){
							customerAoVCondition.aov = {};
						}
						if(customerMinAov) customerAoVCondition.aov["$gte"] = customerMinAov;
						if(customerMaxAov) customerAoVCondition.aov["$lte"] = customerMaxAov;

						asyncParallel({
							records :(callback)=>{
								/** Get list **/
								users.aggregate([
									{ $match: dataTableConfig.conditions },

									{$lookup:	{
										from     : Tables.CUSTOMER_ORDER_STATS,
										let      : {customerId : "$_id"},
										pipeline : [
											{$match : {
												$expr: {
													$and : [
														{$eq: ["$customer_id", "$$customerId"]},
														{$gte: ["$date", newDate(fromDate)]},
														{$lte: ["$date", newDate(toDate)]},
													]
												}
											}},
											{$group : {
												_id 		 : "$customer_id",
												total_amount : {$sum : "$total_amount"},
												total_orders : {$sum : "$total_orders"},
											}}
										],
										as	:	"aov_details"
									}},
									{$addFields : {
										total_order_count: {$arrayElemAt: ["$aov_details.total_orders",0]},
										total_order_amount: {$arrayElemAt: ["$aov_details.total_amount",0]},
									}},
									{
										$project: {
											full_name: 1, email: 1, mobile_number: 1, date_of_birth: 1,gender:1, created: 1, modified: 1,
											aov	   : {$divide : ["$total_order_amount","$total_order_count"]}
										}
									},
									{$match : customerAoVCondition},
									{ $sort : dataTableConfig.sort_conditions },
								]).toArray().then(result => {
									callback(null, result);
								}).catch(next);
							},
							filter_records:(callback)=>{
								/** Get filtered records counting **/
								users.aggregate([
									{$match: dataTableConfig.conditions },
									{$lookup:	{
										from     : Tables.CUSTOMER_ORDER_STATS,
										let      : {customerId : "$_id"},
										pipeline : [
											{$match : {
												$expr: {
													$and : [
														{$eq: ["$customer_id", "$$customerId"]},
														{$gte: ["$date", newDate(fromDate)]},
														{$lte: ["$date", newDate(toDate)]},
													]
												}
											}},
											{$group : {
												_id 		 : "$customer_id",
												total_amount : {$sum : "$total_amount"},
												total_orders : {$sum : "$total_orders"},
											}}
										],
										as	:	"aov_details"
									}},
									{$addFields : {
										total_order_count: {$arrayElemAt: ["$aov_details.total_orders",0]},
										total_order_amount: {$arrayElemAt: ["$aov_details.total_amount",0]},
									}},
									{$project: {
										aov	: {$divide : ["$total_order_amount","$total_order_count"]}
									}},
									{$match : customerAoVCondition},
									{"$count" : "count"}
								]).toArray().then(result => {
									let countResult = (result && result[0] && result[0].count) ? result[0].count : "";
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
								recordsTotal	: response.filter_records,
							});
						});
					});
				});
			}else{
				/**Get dropdown list **/
				getDropdownList(req,res, next,{ collections :[
					{
						collection : Tables.RESTAURANTS,
						columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
						conditions : {
							is_deleted	: Constants.NOT_DELETED
						},
					},
					{
						collection : Tables.AREAS,
						columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
						conditions : {
							is_active : Constants.ACTIVE
						},
					},
					{
						collection : Tables.CUISINES,
						columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
						conditions : {
							is_active : Constants.ACTIVE
						},
					}
				]}).then(response=> {

					/** render listing page **/
					req.breadcrumbs(BREADCRUMBS['admin/report/bi_analytics_report']);
					res.render('bi_analytics_report',{
						restaurant_list : response?.final_html_data?.[0] || "",
						area_list : response?.final_html_data?.[1] || "",
						cuisine_list : response?.final_html_data?.[2] || "",
					});
				}).catch(next);
			}
		} catch (error) {
			next(error);
		}
    };//End getAnalyticsReportList()

    /**
	 * Function for get item list using ajax
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async getItemList(req,res,next){
		try {
			/** Sanitize Data **/
			let limit = (req.query.length) ? parseInt(req.query.length) :10;
			let page = (req.query.page) ? parseInt(req.query.page) : 1;
			let skip = (limit*page)-limit;
			let name = (req.query.q) ? req.query.q  : "";
			let restaurantIds	= (req.query.restaurant_ids)? req.query.restaurant_ids  : [];
			let cuisineIds		= (req.query.cuisine_ids)   ? req.query.cuisine_ids   	: [];

			restaurantIds	= (restaurantIds && restaurantIds.constructor === Array) ?restaurantIds :[restaurantIds];
			cuisineIds		= (cuisineIds && cuisineIds.constructor === Array) ?cuisineIds :[cuisineIds];

			const items	= this.db.collection(Tables.ITEMS);
			let conditions = {
				is_active	: Constants.ACTIVE,
			};
			if(restaurantIds.length > 0) conditions.restaurant_id	= {$in :arrayToObject(restaurantIds)};
			if(cuisineIds.length > 0) conditions.cuisine_id			= {$in : arrayToObject(cuisineIds)};
			if (name) conditions['name.'+Constants.DEFAULT_LANGUAGE_CODE] = { $regex: name, $options: 'i' };

			asyncParallel({
				records : (callback)=>{
					items.find(conditions,{projection: {_id:1,name:1}}).sort({name:1}).limit(limit).skip(skip).toArray().then(result => {
						result.forEach(record=>{
							record.text = record.name[Constants.DEFAULT_LANGUAGE_CODE];
							record.id = record._id;
							delete record.name;
							delete record._id;
						});
						callback(null,result);
					}).catch(next);
				},
				count : (callback)=>{
					items.countDocuments(conditions).then(countResult => {
						callback(null,countResult);
					}).catch(next);
				},
			},(asyncErr,response)=>{

				res.send({
					result		: response.records,
					total_count : response.count
				});
			});
		} catch (error) {
			next(error);
		}
	}; //End getItemList()

	async getYearFromAge(age){
		let currentDate = newDate();
		return currentDate.setFullYear(currentDate.getFullYear() - age);
	}
}
