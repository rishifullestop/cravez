import { ObjectId } from 'mongodb';
import clone from 'clone';
import { parallel as asyncParallel, each as asyncEach } from 'async';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from '../../../../utils/index.mjs';
import userCartModal from './user_carts.mjs';


export default class Restaurant {
    constructor(db) {
        this.db = db;

		this.userCartAPI  = new userCartModal(db);
    }

	/**
	 * Function to get area list
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getAreaList (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
            req.body 		=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
            let areaName	= 	(req.body.area_name) ? req.body.area_name :"";

			asyncParallel({
				area_list : (callback)=>{
					/** Set conditions */
					let areaConditions = { is_active: Constants.ACTIVE};
					if(areaName){
						let searchValue = Helpers.cleanRegex(areaName);
						areaConditions["$or"] = [
							{"name.en" : { $regex: new RegExp('^' + searchValue, 'i') } },
							{"name.ar" : { $regex: new RegExp('^' + searchValue, 'i') } },
						];
					}

					/** Get area list  */
					const areas = this.db.collection(Tables.AREAS);
					areas.aggregate([
						{$match: areaConditions},
						{$sort : {"name.en" : Constants.SORT_ASC }},
						{$group: {
							_id 		:	"$city_id",
							area_list	:	{$push 	: {
								_id		: 	"$_id",
								name 	:	"$name",
							}},
						}},
					]).toArray().then(areaResult=>{
						callback(null, areaResult);
					}).catch(next);
				},
				city_list : (callback)=>{
					/** Get city list **/
					const cities	= this.db.collection(Tables.CITIES);
					cities.find({},{projection: {name: 1}}).toArray().then(cityResult=>{
						if(cityResult.length <=0) return callback(null,{});

						let cityData = {};
						cityResult.map(records=>{  cityData[records._id] = records; });
						callback(null, cityData);
					}).catch(next);
				},
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				let cityList 	=	asyncResponse.city_list;
				let areaList	= 	asyncResponse.area_list;

				/** Add city name */
				areaList.map(records=>{
					records.city_name = (cityList[records._id])  ? cityList[records._id].name :"";
				});

				/** Send success response */
				resolve({status: Constants.STATUS_SUCCESS, result: areaList});
			});
		}).catch(next);
	};// end getAreaList()

	/**
	 * Function to get item list
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getItemList (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
            req.body 		=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
            let areaId		= 	(req.body.area_id) 		? 	new ObjectId(req.body.area_id) 	:"";
            let userId		= 	(req.body.user_id) 		? 	new ObjectId(req.body.user_id) 	:"";
			let itemName	= 	(req.body.item_name)	?	req.body.item_name			:"";
			let skip		= 	(req.body.skip)			?	parseInt(req.body.skip)		:0;
			let limit		= 	(req.body.limit)		?	parseInt(req.body.limit)	:0;
			let tmpLimit	=	(res.locals.settings['Site.front_record_limit']) ? parseInt(res.locals.settings['Site.front_record_limit']) :Constants.FRONT_LISTING_LIMIT;
			limit			=	(!limit)  ? tmpLimit :limit;

			/** Send error response **/
			if(!areaId) return resolve({status:Constants.STATUS_ERROR, message:res.__("system.invalid_access")});

			let openingTime 	= 	(res.locals.settings["App.opening_time"]) ? res.locals.settings["App.opening_time"] : "";
			let closingTime		= 	(res.locals.settings["App.closing_time"]) ? res.locals.settings["App.closing_time"] : "";
			let weatherMessage 	=	(res.locals.settings["App.weather_message"]) ? res.locals.settings["App.weather_message"] : "";
			let weatherMessageInArabic 		=	(res.locals.settings["App.weather_message_in_arabic"]) ? res.locals.settings["App.weather_message_in_arabic"] : "";
			let unlimitedDeliveriesMessage 	=	(res.locals.settings["App.unlimited_free_deliveries"]) ? res.locals.settings["App.unlimited_free_deliveries"] : "";
			let unlimitedDeliveriesMessageInArabic 	=	(res.locals.settings["App.unlimited_free_deliveries_in_arabic"]) ? res.locals.settings["App.unlimited_free_deliveries_in_arabic"] : "";

			/** Set success response */
			let successResponse = {
				status			: 	Constants.STATUS_SUCCESS,
				result			: 	[],
				total_item		: 	0,
				weather_message	:{
					en : weatherMessage,
					ar : weatherMessageInArabic
				},
				open_time		: 	openingTime,
				close_time		: 	closingTime,
				item_image_url	:	Constants.ITEMS_FILE_URL,
				unlimited_free_deliveries_message :{
					en: unlimitedDeliveriesMessage,
					ar: unlimitedDeliveriesMessageInArabic,
				}
			};

			asyncParallel({
				restaurant_list : (callback)=>{
					/** Set restaurant conditions **/
					let restaurantConditions = {
						is_deleted	:	Constants.NOT_DELETED,
						status		:	Constants.ACTIVE,
					};

					/** Get restaurant list **/
					const restaurants	= this.db.collection(Tables.RESTAURANTS);
					restaurants.find(restaurantConditions,{projection: {name: 1 }}).toArray().then(restaurantResult=>{
						callback(null,restaurantResult);
					}).catch(next);
				},
				branch_list : (callback)=>{
					let branchConditions ={
						is_active :	Constants.ACTIVE,
					};

					/** Get restaurant branch list **/
					const restaurant_branches 	= this.db.collection(Tables.RESTAURANT_BRANCHES);
					restaurant_branches.distinct("_id", branchConditions).then(branchResult=>{
						callback(null, branchResult);
					}).catch(next);
				},
				availability_item_list : (callback)=>{
					let currentTime = parseFloat(Helpers.newDate("",Constants.SHIFT_TIME_FORMAT));

					/** Set availability item conditions **/
					let availabilityConditions = {
						from_time	:	{$lte: currentTime},
						to_time		:	{$gte: currentTime},
					};

					/** Get availability item list **/
					const item_availability	= this.db.collection(Tables.ITEM_AVAILABILITY);
					item_availability.distinct( "item_id", availabilityConditions).then(availabilityResult=>{
						callback(null,availabilityResult);
					}).catch(next);
				},
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				let branchList 				=	asyncResponse.branch_list;
				let restaurantList 			=	asyncResponse.restaurant_list;
				let availabilityItemIds		=	asyncResponse.availability_item_list;
				let restaurantIds			=	[];
				let restaurantDetailsList	=	{};

				/** Send success response */
				if(restaurantList.length <=0 || branchList.length <=0 || availabilityItemIds.length <=0){
					return resolve(successResponse);
				}

				/** Get restaurant id list  */
				restaurantList.map(records=>{
					restaurantIds.push(records._id);
					restaurantDetailsList[records._id] =  records;
				});

				/** Set area conditions  */
				let areaConditions = {
					area_id			:	areaId,
					branch_id		:	{$in : branchList},
					restaurant_id	:	{$in : restaurantIds},
				};

				/** Get area wise branches list */
				const restaurant_branch_areas = this.db.collection(Tables.RESTAURANT_BRANCH_AREAS);
				restaurant_branch_areas.aggregate([
					{$match : areaConditions},
					{$group: {
						_id 		: "$restaurant_id",
						branch_id 	: {$first: "$branch_id"},
					}}
				]).toArray().then(areaResult=>{

					/** Send success response */
					if(areaResult.length <=0) return resolve(successResponse);

					let branchIdWithRestaurant	= {};
					let branchIdsList 			= [];
					let finalRestaurantIds 		= [];
					areaResult.map(records=>{
						branchIdsList.push(records.branch_id);
						finalRestaurantIds.push(records._id);

						branchIdWithRestaurant[records._id] = records.branch_id;
					});

					/** Set inactive branches item conditions **/
					let branchItemConditions = {
						branch_ids 		: 	{$in: branchIdsList },
						restaurant_id 	:	{$in: finalRestaurantIds},
					};

					const branch_inactive_items	=	this.db.collection(Tables.BRANCH_INACTIVE_ITEMS);
					branch_inactive_items.distinct("item_id", branchItemConditions).then(inactiveBranchIds=>{

						/** Set linking item conditions **/
						let linkItemConditions = {
							$or : [
								{
									type : Constants.ITEM_NOT_LISTED_TO_SELECTED_BRANCH_LIST,
									branch_ids: { $nin: branchIdsList }
								},
								{
									type: Constants.ITEM_LISTED_TO_SELECTED_BRANCH_LIST,
									$or : [
										{branch_ids	: { $size: 0} },
										{branch_ids : { $in: branchIdsList } }
									]
								}
							]
						};

						/** Get item linking list **/
						const item_linkings	= this.db.collection(Tables.ITEM_LINKINGS);
						item_linkings.distinct("item_id", linkItemConditions).then(itemIds=>{

							/** Send success response */
							if(itemIds.length <=0) return resolve(successResponse);

							/** Set item conditions **/
							let itemConditions = {
								$and :[
									{ _id	:	{$in : itemIds} },
									{ _id	:	{$in : availabilityItemIds} },
									{ _id	:	{$nin : inactiveBranchIds} }
								],
								restaurant_id	:	{$in : finalRestaurantIds},
								menu_active		:	true,
								is_active		:	Constants.ACTIVE,
								non_sellable	:	{$ne : Constants.NON_SELLABLE},
								"category_ids.0": 	{$exists: true}
							};

							if(itemName){
								itemName = Helpers.cleanRegex(itemName);
								itemConditions["$or"] = [
									{"name.en" : new RegExp(itemName, "i")},
									{"name.ar" : new RegExp(itemName, "i")},
									{"description.en" : new RegExp(itemName, "i")},
									{"description.ar" : new RegExp(itemName, "i")},
								];

								if(itemName.split(" ").length >1){
									itemName.split(" ").map(key=>{
										itemConditions["$or"].push({"name.en": new RegExp(key, "i")})
										itemConditions["$or"].push({"name.ar": new RegExp(key, "i")})
										itemConditions["$or"].push({"description.en": new RegExp(key, "i")})
										itemConditions["$or"].push({"description.ar": new RegExp(key, "i")})
									});
								}
							}

							const items = this.db.collection(Tables.ITEMS);
							asyncParallel({
								item_list : (callback)=>{
									/** Get item list */
									items.aggregate([
										{$match : itemConditions},
										{$sort: {order: Constants.SORT_ASC}},
										{$skip: skip},
										{$limit: limit},
										{$lookup:	{
											from     : Tables.ITEM_UNITS,
											let      : {itemId : "$_id"},
											pipeline : [
												{$match : {
													$expr: {
														$and : [
															{$eq: ["$item_id", "$$itemId"]},
															{$eq: ["$status", Constants.ACTIVE]},
														]
													}
												}},
											],
											as : "unit_list"
										}},
										{$addFields : {
											price_on_selection: {$cond: [
												{$and: [
													{$eq: [{$size: "$unit_list"}, 1] },
													{$eq: ["$kfg", true] },
												]},
												0, "$price_on_selection"
											]},
										}},
										{$project : {
											_id: 1, name: 1, description: 1, price_on_selection: 1, category_ids: 1, image:1, restaurant_id:1, discount_percentage: 1, discount_value: 1,grid_image :1,detail_image:1,item_id: 1,kfg:1,
											item_price	: 	{$cond: [
												{$and: [
													{$eq: ["$item_type", Constants.DEAL_ITEM] },
												]},
												"$item_price", {$ifNull: [ "$unit_price", "$item_price" ] }
											]},
										}},
									]).toArray().then(itemResult=>{
										if(itemResult.length <=0) return  callback(null,itemResult);

										itemResult.map(records=>{
											let tmpRestaurantId = records.restaurant_id;

											if(records.image){
												records.image = records.image.replace(RegExp('Large','g'),"Small");
											}

											records.area_id 		=	areaId;
											records.branch_id 		= 	(branchIdWithRestaurant[tmpRestaurantId]) ? branchIdWithRestaurant[tmpRestaurantId] :"";
											records.restaurant_name = 	(restaurantDetailsList[tmpRestaurantId]) ? restaurantDetailsList[tmpRestaurantId].name :{};
										});

										callback(null,itemResult);
									}).catch(next);
								},
								item_count : (callback)=>{
									/** Get item total items */
									items.countDocuments(itemConditions).then(contResult=>{
										callback(null,contResult);
									}).catch(next);
								},
								favorite_list : (favoriteCallback)=>{
									if(!userId) return favoriteCallback(null, {});

									/** Set conditions */
									let favoriteConditions = {
										user_id:  userId,
										$and :[
											{ item_id	:	{$in : itemIds} },
											{ item_id	:	{$in : availabilityItemIds} }
										]
									};

									/** Get favorite item list **/
									const user_favorites = this.db.collection(Tables.USER_FAVORITES);
									user_favorites.distinct("item_id",favoriteConditions).then(favoriteResult=>{
										if(favoriteResult.length <= 0) return favoriteCallback(null, {});

										let favoriteList = {};
										favoriteResult.map(tempItemId=>{
											favoriteList[String(tempItemId)] = true;
										});

										favoriteCallback(null, favoriteList);
									}).catch(next);
								},
							},(asyncChildErr, asyncChildResponse)=>{
								if(asyncChildErr) return next(asyncChildErr);

								let itemList 		=	asyncChildResponse.item_list;
								let favoriteList 	= 	asyncChildResponse.favorite_list;

								if(itemList.length >0){
									itemList.map(records=>{
										if(records.item_price){
											let tmpPrice 		=	records.item_price;
											let percentage		=	records.discount_percentage;
											let discountValue	=	records.discount_value;

											if(discountValue){
												let tmpDiscount= (tmpPrice>=discountValue) ? discountValue :tmpPrice;

												records.strikethrough_price = tmpPrice;
												records.item_price = Helpers.round(tmpPrice-tmpDiscount);
											}else if(percentage){
												let tmpDiscount = 	(tmpPrice*percentage)/100;

												records.strikethrough_price= tmpPrice;
												records.item_price = Helpers.round(tmpPrice-tmpDiscount);
											}
										}

										/** Add favorite status  */
										records.is_favorite =	(favoriteList[records._id]) ? Constants.FAVOURITE :Constants.UNFAVOURITE;
									});
								}

								/** Send response */
								successResponse.total_item 	=	asyncChildResponse.item_count;
								successResponse.result 		= 	itemList;
								resolve(successResponse);
							});
						}).catch(next);
					}).catch(next);
				}).catch(next);
			});
        }).catch(next);
	};// end getItemList()

	/**
	 * Function to get restaurant list
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getRestaurantList (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 			=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let areaId			= 	(req.body.area_id) 			? 	req.body.area_id 				:"";
			let restaurantName	= 	(req.body.restaurant_name) 	?	req.body.restaurant_name		:"";
			let categoryTags	= 	(req.body.category_tags) 	?	req.body.category_tags			:[];
			let sortBy			=	(req.body.sort_by) 			?	req.body.sort_by				:"";
			let latitude		=	(req.body.latitude) 		?	parseFloat(req.body.latitude)	:"";
			let longitude		=	(req.body.longitude) 		?	parseFloat(req.body.longitude)	:"";
			let cuisineId		=	(req.body.cuisine_id) 		?	req.body.cuisine_id				:[];
			let acceptPickup	=	(req.body.accept_pickup)	?JSON.parse(req.body.accept_pickup)	:false;
			let branchOpen		=	(req.body.is_open) 			?	JSON.parse(req.body.is_open)	:false;
			let hasOffer		=	(req.body.has_discount)		?JSON.parse(req.body.has_discount)	:false;
			let payOnline		=	(req.body.pay_online)		?JSON.parse(req.body.pay_online)	:false;
			let acceptPreOrder	=	(req.body.accept_pre_order) ?JSON.parse(req.body.accept_pre_order) :false;
			let deliveryByCravez=	(req.body.delivery_by_cravez)?	JSON.parse(req.body.delivery_by_cravez)	:false;
			let skip			= 	(req.body.skip)			?	parseInt(req.body.skip)		:0;
			let limit			= 	(req.body.limit)		?	parseInt(req.body.limit)	:0;
			let tmpLimit		=	(res.locals.settings['Site.front_record_limit']) ? parseInt(res.locals.settings['Site.front_record_limit']) :Constants.FRONT_LISTING_LIMIT;
			limit				=	(!limit)  ? tmpLimit :limit;
			let userId			= 	(req.body.user_id) 	? 	new ObjectId(req.body.user_id) 	:"";
			let deviceId		= 	(req.body.device_id)?	req.body.device_id			:"";

			/** Send error response **/
			if(!areaId) return resolve({status:Constants.STATUS_ERROR, message:res.__("system.invalid_access")});

			const users	= this.db.collection(Tables.USERS);
			asyncParallel({
				restaurant_list : (callback)=>{
					/** Set sort conditions **/
					let sortRestaurantConditions	=	{};
					if(sortBy == 'restaurant') sortRestaurantConditions  = {created: Constants.SORT_DESC};

					/** Set restaurant conditions **/
					let restaurantConditions = {
						is_deleted	:	Constants.NOT_DELETED,
						status		:	Constants.ACTIVE,
					};

					/** Add restaurant name conditions */
					if(restaurantName){
						let searchValue = Helpers.cleanRegex(restaurantName.trim());
						restaurantConditions["$or"] = [
							{"name.en" : new RegExp(searchValue, "i") },
							{"name.ar" : new RegExp(searchValue, "i") }
						];
					}

					/** Get restaurant list **/
					const restaurants	= this.db.collection(Tables.RESTAURANTS);
					restaurants.find(restaurantConditions,{projection: {image: 1, name: 1, landing_image:1,detail_image:1,web_image:1}}).sort(sortRestaurantConditions).toArray().then(restaurantResult=>{
						callback(null,restaurantResult);
					}).catch(next);
				},
				category_restaurant_list : (callback)=>{
					if(categoryTags.constructor != Array)  categoryTags = [categoryTags];
					if(categoryTags.length <= 0) return callback(null,null) ;

					/** Set restaurant conditions **/
					let categoryConditions = {
						is_active	:	Constants.ACTIVE,
						$or 		: 	[],
					};

					/** Add category tags conditions */
					categoryTags.map(tags=>{
						let searchTags = Helpers.cleanRegex(tags);

						categoryConditions["$or"].push({
							tags : {$in : new RegExp(searchTags, "i")}
						});
					});

					/** Get restaurant list **/
					const restaurant_categories	= this.db.collection(Tables.RESTAURANT_CATEGORIES);
					restaurant_categories.distinct( "restaurant_id", categoryConditions).then(catResult=>{
						callback(null, catResult);
					}).catch(next);
				},
				cuisine_restaurant_list : (callback)=>{
					if(cuisineId.constructor != Array)  cuisineId = [cuisineId];
					if(cuisineId.length <= 0) return callback(null,null);

					/** Convert into object id */
					cuisineId = Helpers.arrayToObject(cuisineId);

					/** Get branch list **/
					const restaurant_cuisines	= this.db.collection(Tables.RESTAURANT_CUISINES);
					restaurant_cuisines.distinct("restaurant_id", {cuisine_id : {$in : cuisineId}}).then(cuisineResult=>{
						callback(null, cuisineResult);
					}).catch(next);
				},
				delivery_methods_list : (callback)=>{
					/** Get delivery method list **/
					const delivery_methods	= this.db.collection(Tables.DELIVERY_METHODS);
					delivery_methods.find({},{projection: {slug: 1, title: 1 }}).toArray().then(methodResult=>{


						let methodList = {};
						methodResult.map(records=>{
							methodList[records.slug] = records.title;
						});
						callback(null, methodList);
					}).catch(next);
				},
				payonline_branch_list : (callback)=>{
					if(!payOnline) return callback(null,null);

					let onlineConditions = {
						$or : [
							{payment_methods : {$nin : [Constants.CASH_PAYMENT] }},
							{
								payment_methods : {$in : [Constants.CASH_PAYMENT] },
								$where: "this.payment_methods.length > 1"
							},
						]
					};

					/** Get branch list **/
					const restaurant_branch_payment_methods	= this.db.collection(Tables.RESTAURANT_BRANCH_PAYMENT_METHODS);
					restaurant_branch_payment_methods.distinct("branch_id", onlineConditions).then(branchResult=>{
						callback(null, branchResult);
					}).catch(next);
				},
				user_details : (callback)=>{
					if(!userId) return callback(null,null);

					/** Set customer conditions **/
					let userConditions = {...{_id: new ObjectId(userId) },...Constants.CUSTOMER_COMMON_CONDITIONS};

					/** Get user details **/
					users.findOne(userConditions,{projection:{_id: 1, package_id: 1, corporate_id: 1}}).then(userResult=>{
						callback(null,userResult);
					}).catch(next);
				},
				new_user_count : (callback)=>{
					if(!userId) return callback(null,null);

					/** Set user conditions */
					let userConditions 		= {...{_id: new ObjectId(userId) },...Constants.CUSTOMER_COMMON_CONDITIONS};
					userConditions.is_guest	= {$exists: false};
					userConditions.created	= {$gte: Helpers.newDate(Helpers.subtractDate(Constants.NEW_USER_DAYS*Constants.HOURS_IN_A_DAY))};

					/** Check user type **/
					users.countDocuments(userConditions).then(userResult=>{
						callback(null,userResult);
					}).catch(next);
				},
				order_details: (callback)=>{
					if(!userId) return callback(null,null);

					const orders	= this.db.collection(Tables.ORDERS);
					orders.findOne({
						customer_id 	: new ObjectId(userId),
						delay_voc_status: Constants.PENDING,
					}, {projection: {_id:1,unique_order_id:1},sort:{voc_sent_time:Constants.SORT_DESC}}).then(result=>{
						callback(null, result);
					}).catch(next);
				}
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				let weatherMessage 				= (res.locals.settings["App.weather_message"]) ? res.locals.settings["App.weather_message"] : "";
				let weatherMessageInArabic 		= (res.locals.settings["App.weather_message_in_arabic"]) ? res.locals.settings["App.weather_message_in_arabic"] : "";
				let unlimitedDeliveriesMessage 	= (res.locals.settings["App.unlimited_free_deliveries"]) ? res.locals.settings["App.unlimited_free_deliveries"] : "";
				let unlimitedDeliveriesMessageInArabic 	= (res.locals.settings["App.unlimited_free_deliveries_in_arabic"]) ? res.locals.settings["App.unlimited_free_deliveries_in_arabic"] : "";
				let enableInfinityPackage 		= (res.locals.settings["App.enable_infinity_package"]) ? res.locals.settings["App.enable_infinity_package"] :false;
				let userDetails = 	(asyncResponse.user_details) ? asyncResponse.user_details :{};
				let newUserCount=	asyncResponse.new_user_count;
				let corporateId	=  	(userDetails.corporate_id) ? userDetails.corporate_id:"";
				let userType 	=	(deviceId && !userId) ? Constants.APPLICABLE_FOR_GUEST :((newUserCount >0) ?  Constants.APPLICABLE_FOR_NEW_USERS : Constants.APPLICABLE_FOR_REGISTERED_MEMBER);
				let orderDetails =	(asyncResponse.order_details)? asyncResponse.order_details :{};
				let userInfinityService = (userDetails.package_id) ? true :false;
				if(!enableInfinityPackage) userInfinityService = true;

				/** Set success response */
				let successResponse = {
					status	: 	Constants.STATUS_SUCCESS,
					result	:	[],
					restaurant_image_url	:	Constants.RESTAURANT_FILE_URL,
					cuisinePrioritiesList 	: 	[],
					voc_order_id 		: (orderDetails._id) ? orderDetails._id :"",
					voc_unique_order_id	: (orderDetails.unique_order_id)? orderDetails.unique_order_id :"",
					weather_message :{
						en: weatherMessage,
						ar: weatherMessageInArabic,
					},
					unlimited_free_deliveries_message :{
						en: unlimitedDeliveriesMessage,
						ar: unlimitedDeliveriesMessageInArabic,
					},
					is_user_deleted : (userId && !userDetails._id) 	? 	true	:false,
					infinity_service: userInfinityService,
					server: "137",
				};

				/** Send success response */
				if(asyncResponse.restaurant_list.length <=0) return resolve(successResponse);

				let restaurantList 			=	asyncResponse.restaurant_list;
				let cuisineRestaurantList 	=	asyncResponse.cuisine_restaurant_list;
				let categoryRestaurantIds 	=	asyncResponse.category_restaurant_list;
				let deliveryMethodList 		=	asyncResponse.delivery_methods_list;
				let payonlineBranchList 	=	asyncResponse.payonline_branch_list;
				let restaurantIds			=	[];
				let restaurantDetailsList	=	{};

				/** Get restaurant id list  */
				restaurantList.map(records=>{
					restaurantIds.push(records._id);
					restaurantDetailsList[records._id] =  records;
				});

				/** Set branch conditions **/
				let branchConditions = {
					restaurant_id	:	{$in: restaurantIds},
					is_active		:	Constants.ACTIVE,
				};

				/** Add category wise restaurant id **/
				if(categoryRestaurantIds){
					branchConditions["$and"] = [{
						restaurant_id : {$in: categoryRestaurantIds}
					}];
				}

				/** Add cuisine wise restaurant id **/
				if(cuisineRestaurantList){
					if(!branchConditions["$and"]) branchConditions["$and"] = [];
					branchConditions["$and"].push({
						restaurant_id : {$in: cuisineRestaurantList}
					});
				}

				/** Add payonline branch id conditions **/
				if(payOnline){
					if(!branchConditions["$and"]) branchConditions["$and"] = [];
					branchConditions["$and"].push({
						_id : {$in: payonlineBranchList}
					});
				}

				/** Add sort conditions */
				let currentHours 	= 	parseFloat(Helpers.newDate("",Constants.AREA_PROFILE_TIME_FORMAT));
				let sortConditions 	= 	{is_open: Constants.SORT_DESC};
				let sortingProfile 	=	(currentHours < Constants.MORNING_PROFILE_MAX_TIME) ? "morning_profile" : "evening_profile";
				sortConditions[sortingProfile] 	= Constants.SORT_ASC;
				sortConditions["rating"] 		= Constants.SORT_DESC;

				if(sortBy == "rating")  	sortConditions  = {is_open: Constants.SORT_DESC, rating: Constants.SORT_DESC};
				if(sortBy == "feature") 	sortConditions  = {is_open: Constants.SORT_DESC,is_feature: Constants.SORT_DESC};
				if(sortBy == "delivery_time")sortConditions = {is_open: Constants.SORT_DESC,delivery_time: Constants.SORT_ASC};
				if(sortBy == "delivery_fees") sortConditions={is_open: Constants.SORT_DESC,delivery_fees: Constants.SORT_ASC};
				if(sortBy == "minimum_order_limit"){
					sortConditions = {is_open: Constants.SORT_DESC, minimum_order_limit: Constants.SORT_ASC};
				}

				let aggregatePipLine = [];
				if(sortBy == "nearest" && latitude && longitude){
					sortConditions = {is_open: Constants.SORT_DESC, distance: Constants.SORT_ASC};
					sortConditions[sortingProfile] 	= Constants.SORT_ASC;
					sortConditions["rating"] 		= Constants.SORT_DESC;

					aggregatePipLine.push({$geoNear : {
						near	: {
							type			: 	"Point",
							coordinates		:	[ longitude , latitude ]
						},
						distanceMultiplier	: 	1 / Constants.ONE_MILE_IN_METER,	//  return distance in miles
						distanceField		: 	"distance",				//  return  total distance
						spherical			: 	true,					//	Required if using a 2dsphere index. use to check coordinate in circle
						query				: 	branchConditions,
					}});
				}

				/** Add area wise conditions */
				let areaWiseConditions = {};
				if(acceptPickup) 	 areaWiseConditions.accept_pickup_orders 	= Constants.ACCEPT;
				if(acceptPreOrder) 	 areaWiseConditions.accept_scheduling_orders= Constants.ACCEPT;
				if(hasOffer) 		areaWiseConditions.has_offers 				= Constants.ACTIVE;
				if(deliveryByCravez) areaWiseConditions.delivery_by_cravez 		= true;
				if(branchOpen) 		areaWiseConditions.is_open 					= Constants.OPEN;

				/** Change sort conditions after search term */
				if(restaurantName || categoryTags.length >0){
					sortConditions 	= {is_open: Constants.SORT_DESC};
					sortConditions[sortingProfile]	= Constants.SORT_ASC;
					sortConditions["rating"] 		= Constants.SORT_DESC;
				}

				if(cuisineRestaurantList){
					aggregatePipLine.push(
						{$match: branchConditions},
						{$lookup:	{
							from     : Tables.RESTAURANT_BRANCH_CUISINES,
							let      : {restaurantId : "$restaurant_id", branchId : "$_id"},
							pipeline : [
								{$match : {
									$expr: {
										$and : [
											{$eq: ["$restaurant_id", "$$restaurantId"]},
											{$eq: ["$branch_id", "$$branchId"]},
											{$in: ["$cuisine_id", cuisineId ]},
										]
									}
								}},
							],
							as : "branch_cuisine_details"
						}},
						{$addFields :{
							branch_cuisine_order : 	{$min: "$branch_cuisine_details.order" },
						}},
					);

					/** Add sorting */
					sortConditions["branch_cuisine_order"]	= Constants.SORT_ASC;
				}

				sortConditions["_id"] = Constants.SORT_ASC;
				aggregatePipLine.push(
					{$match: branchConditions},
					{$lookup:	{
						from     : Tables.RESTAURANT_BRANCH_AREAS,
						let      : {restaurantId : "$restaurant_id", branchId : "$_id"},
						pipeline : [
							{$match : {
								$expr: {
									$and : [
										{$eq: ["$restaurant_id", "$$restaurantId"]},
										{$eq: ["$branch_id", "$$branchId"]},
										{$eq: ["$area_id",new ObjectId(areaId)]},
									]
								}
							}},
							{$project : {
								delivery_fees: 1, delivery_time: 1, open: 1, delivery_by: 1, trends : 1, area_id: 1,morning_profile : 1,evening_profile: 1, accept_pickup_orders: 1, accept_scheduling_orders: 1, minimum_order_limit:1, has_offers: 1
							}},
						],
						as	:	"area_details"
					}},
					{$match : {
						"area_details.area_id" : new ObjectId(areaId)
					}},
					{$addFields :{
						area_id				: 	{$arrayElemAt: ["$area_details.area_id",0]},
						trends				: 	{$arrayElemAt: ["$area_details.trends",0]},
						morning_profile		: 	{$arrayElemAt: ["$area_details.morning_profile",0]},
						evening_profile		: 	{$arrayElemAt: ["$area_details.evening_profile",0]},
						has_offers			: 	{$arrayElemAt: ["$area_details.has_offers",0]},
						delivery_by			: 	{$arrayElemAt: ["$area_details.delivery_by",0]},
						delivery_time		: 	{$arrayElemAt: ["$area_details.delivery_time",0]},
						delivery_fees		: 	{$arrayElemAt: ["$area_details.delivery_fees",0]},
						accept_pickup_orders: 	{$arrayElemAt: ["$area_details.accept_pickup_orders",0]},
						minimum_order_limit	: 	{$arrayElemAt: ["$area_details.minimum_order_limit",0]},
						accept_scheduling_orders:{$arrayElemAt: ["$area_details.accept_scheduling_orders",0]},
						delivery_by_cravez	: 	{$cond: [
													{$and: [
														{$eq: [{$arrayElemAt: ["$area_details.delivery_by",0]}, Constants.DELIVERY_BY_CRAVEZ] },
													]},
													true, false
												]},
						delivery_by_restaurant:	{$cond: [
													{$and: [
														{$eq: [{$arrayElemAt: ["$area_details.delivery_by",0]}, Constants.DELIVERY_BY_RESTAURANT] },
													]},
													true, false
												]},
						is_open : {$cond: [
							{$and: [
								{$eq: [{$arrayElemAt: ["$area_details.open",0]}, Constants.OPEN ] },
							]},
							{$cond: [
								{$and: [
									{$eq: ["$branch_status", Constants.OPEN] },
								]},
								{$cond: [
									{$and: [
										{$eq: ["$is_open", Constants.OPEN] },
									]},
									Constants.OPEN, Constants.CLOSE
								]}, Constants.CLOSE,
							]}, Constants.CLOSE
						]}
					}},
					{$match : areaWiseConditions},
					{$sort  : sortConditions},
					{$group : {
						_id 			: 	"$restaurant_id",
						branch_id		:	{$first: "$_id"},
						rating			:	{$first: "$rating"},
						area_id			:	{$first: "$area_id"},
						restaurant_id	:	{$first: "$restaurant_id"},
						address			:	{$first: "$address"},
						name			:	{$first: "$name"},
						distance		:	{$first: "$distance"},
						is_feature		:	{$first: "$is_feature"},
						minimum_order_limit:{$first: "$minimum_order_limit"},
						trends			:	{$first: "$trends"},
						has_offers		:	{$first: "$has_offers"},
						delivery_by		:	{$first: "$delivery_by"},
						delivery_time	:	{$first: "$delivery_time"},
						delivery_fees	:	{$first: "$delivery_fees"},
						slogan_in_english:	{$first: "$slogan_in_english"},
						slogan_in_arabic:	{$first: "$slogan_in_arabic"},
						is_open			:	{$first: "$is_open"},
						morning_profile	:	{$first: "$morning_profile"},
						evening_profile	:	{$first: "$evening_profile"},
						branch_cuisine_order	:	{$min: "$branch_cuisine_order"},
						accept_pickup_orders	:	{$first: "$accept_pickup_orders"},
						accept_scheduling_orders:	{$first: "$accept_scheduling_orders"},
						delivery_by_cravez		:	{$first: "$delivery_by_cravez"},
						branch_status			:	{$first: "$branch_status"},
					}},
				);

				const restaurant_branches = this.db.collection(Tables.RESTAURANT_BRANCHES);
				asyncParallel({
					branch_list : (parallelCallback)=>{
						/** Manage aggregate pipline */
						let findAggregatePipLine = clone(aggregatePipLine);
						findAggregatePipLine.push(
							{$sort  : sortConditions},
							{$skip 	: skip},
							{$limit : limit},
						);
						/** Get restaurant branch list **/
						restaurant_branches.aggregate(findAggregatePipLine).toArray().then(branchResult=>{
							parallelCallback(null,branchResult);
						}).catch(next);
					},
					branch_count : (parallelCallback)=>{
						/** Manage aggregate pipline */
						let countAggregatePipLine = clone(aggregatePipLine);
						countAggregatePipLine.push({$count : "count"});

						/** Get restaurant branch count **/
						restaurant_branches.aggregate(countAggregatePipLine).toArray().then(branchCount=>{
							branchCount  = (branchCount && branchCount[0]) ? branchCount[0].count :0;
							parallelCallback(null,branchCount);
						}).catch(next);
					},
				},(parentParallelErr, parentParallelResponse)=>{
					if(parentParallelErr)  return next(parentParallelErr);

					let branchResult	= 	parentParallelResponse.branch_list;
					let branchCount  	=	parentParallelResponse.branch_count;

					successResponse.result 			 		=	branchResult;
					successResponse.total_restaurant 		= 	branchCount;
					successResponse.cuisinePrioritiesList 	=	[];

					/** Send success response */
					if(branchResult.length <=0) return resolve(successResponse);

					let branchIds = [];
					/** Add additional details **/
					branchResult.map(records=>{
						records.branch_offer_count = 0;

						branchIds.push(records.branch_id);
						/** Add restaurant details  **/
						if(restaurantDetailsList[records.restaurant_id]){
							records.restaurant_name  =	restaurantDetailsList[records.restaurant_id].name;
							records.restaurant_image = 	restaurantDetailsList[records.restaurant_id].image;
							records.grid_image= restaurantDetailsList[records.restaurant_id].landing_image;
							records.detail_image=restaurantDetailsList[records.restaurant_id].detail_image;
						}
						if(records.delivery_by && deliveryMethodList[records.delivery_by]) records.delivery_by = deliveryMethodList[records.delivery_by];
					});

					/** Convert into object id */
					branchIds = Helpers.arrayToObject(branchIds);

					asyncParallel({
						cuisine_priorities_list : (parallelCallback)=>{
							/** Get cuisine priorities list **/
							const restaurant_branch_cuisines = this.db.collection(Tables.RESTAURANT_BRANCH_CUISINES);
							restaurant_branch_cuisines.aggregate([
								{$match  : {branch_id	: 	{$in : branchIds}}},
								{$sort	 : {order	 	:	Constants.SORT_ASC }},
								{$lookup : {
									from			: Tables.CUISINES,
									localField		: "cuisine_id",
									foreignField	: "_id",
									as				: "cuisines",
								}},
								{$group: {
									"_id" : "$branch_id",
									"data":	{$push: {
										_id				:	"$_id",
										cuisine_id 		: 	"$cuisine_id",
										cuisine_name 	:	{$arrayElemAt: ["$cuisines.name", 0] },
									}}
								}},
								{$addFields :{
									"data": { "$slice": [ "$data", Constants.CUISINE_PRIORITIES_LIMIT ]},
								}}
							]).toArray().then(cuisineResult=>{
								parallelCallback(null, cuisineResult);
							}).catch(next);
						},
						attributes_details: (parallelCallback)=>{
							/** Check branch attributes details */
							const restaurant_branch_attributes = this.db.collection(Tables.RESTAURANT_BRANCH_ATTRIBUTES);
							restaurant_branch_attributes.find({
								branch_id		: {$in: branchIds},
								attribute_id	: {$in: [
									Constants.BRANCH_OFFERS_DOUBLE_CASHBACK_ATTRIBUTE_ID,
									Constants.BRANCH_OFFERS_CASHBACK_ATTRIBUTE_ID,
								]},
							},{projection: {attribute_id:1, value: 1,branch_id:1}}).toArray().then(attributeResult=>{

								let attributeList =  {};
								attributeResult.map(records=>{
									if(!attributeList[records.branch_id]){
										attributeList[records.branch_id] = {};
									}

									attributeList[records.branch_id][records.attribute_id] = records.value;
								});
								parallelCallback(null,attributeList);
							}).catch(next);
						},
						branch_offer: (parallelCallback)=>{
							if(!userId && !deviceId) return parallelCallback(null);

							let offerFromDate = Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));
							let offerToDate   = Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_END_DATE_FORMAT));

							/** Set lookup conditions */
							let lookupConditions = {
								$and : [
									{$eq: ["$offer_id", "$$offerId"]},
								]
							};

							if(userId){
								lookupConditions["$and"].push({$eq: ["$user_id", userId ]});
							}else{
								lookupConditions["$and"].push({$eq: ["$device_id", deviceId ]});
							}

							const offers = this.db.collection(Tables.OFFERS);
							asyncEach(branchResult, (records, eachCallback)=> {
								let tmpBranchId 	= 	records.branch_id;
								let tmpRestaurantId =	records.restaurant_id;

								/** Add offer conditions */
								let offerConditions = {
									display_offer	:  	true,
									is_active		:	Constants.ACTIVE,
									status			:	Constants.OFFER_PUBLISHED,
									$and			:	[
										{$or : [
											{"applicable_for.0" : {$exists: false}},
											{applicable_for	   : {$in: [userType]}}
										]},
										{$or : [
											{"restaurant_ids.0" : {$exists: false}},
											{restaurant_ids	 	: {$in: [tmpRestaurantId]}}
										]},
										{$or : [
											{"branch_ids.0" : {$exists: false}},
											{branch_ids	 	: {$in: [tmpBranchId]}}
										]},
										{$or : [
											{$and : [
												{valid_from : {$gte : Helpers.newDate(offerFromDate)} },
												{valid_to   : {$lte : Helpers.newDate(offerToDate)} }
											]},
											{$and : [
												{valid_to 	: {$gte : Helpers.newDate(offerFromDate)} },
												{valid_from : {$lte : Helpers.newDate(offerToDate)} }
											]}
										]}
									]
								};

								if(userId){
									offerConditions["$and"].push({$or: [
										{"user_ids.0": {$exists: false}},
										{user_ids	 : {$in: [userId]} }
									]});
								}

								if(corporateId){
									offerConditions["$and"].push({$or: [
										{"corporate_ids.0" : {$exists: false}},
										{corporate_ids	   : {$in: [corporateId]}}
									]});
								}else{
									offerConditions.offer_type = {$ne: Constants.CORPORATE_OFFER};
								}

								/** Get branch offer count */
								offers.aggregate([
									{$match : offerConditions},
									{$lookup:	{
										from     : Tables.OFFER_LOGS,
										let      : {offerId : "$_id"},
										pipeline : [
											{$match : {
												$expr: lookupConditions
											}},
											{$project : {_id: 1}},
										],
										as:	"offer_unique_redeem_details"
									}},
									{$lookup : {
										from 		 : Tables.OFFER_LOGS,
										localField 	 : "_id",
										foreignField : "offer_id",
										as 			 : "offer_redeem_details"
									}},
									{$addFields :{
										unique_redeem_count : {$size: "$offer_unique_redeem_details"},
										total_redeem_count  : {$size: "$offer_redeem_details"},
									}},
									{$match : {
										$expr: {
											$and : [
												{$or:[
													{$eq: ["$total_unique_redeem", ""]},
													{$gt: ["$total_unique_redeem","$unique_redeem_count"]},
												]},
												{$or:[
													{$eq: ["$total_redeem", ""]},
													{$gt: ["$total_redeem", "$total_redeem_count"]},
												]},
											]
										}
									}},
									{$count: "count"}
								]).toArray().then(offerResult=>{
									let tmpOfferCount = (offerResult && offerResult[0]) ? offerResult[0].count :0;

									/** Add branch offer count  */
									records.branch_offer_count = tmpOfferCount;

									eachCallback(null);
								}).catch(next);
							},()=> {
								parallelCallback(null);
							});
						},
					},(asyncParallelErr, asyncParallelResponse)=>{
						if(asyncParallelErr) return next(asyncParallelErr);

						let cuisinePrioritiesList = (asyncParallelResponse.cuisine_priorities_list) ? asyncParallelResponse.cuisine_priorities_list : [];
						let branchAttributesList = (asyncParallelResponse.attributes_details) ? asyncParallelResponse.attributes_details :{};

						/** Add additional details **/
						branchResult.map(branchData=>{
							/** Add additional details **/
							if(cuisinePrioritiesList.length >0){
								cuisinePrioritiesList.map(cuisineData=>{
									if(String(branchData.branch_id) == String(cuisineData._id)){
										branchData.cuisine_priorities = cuisineData.data;
									}
								});
							}

							/** Add attributes details **/
							let isCashback 			= 	0;
							let isDoubleCashback 	=	0;
							if(branchAttributesList[branchData.branch_id]){
								if(branchAttributesList[branchData.branch_id][Constants.BRANCH_OFFERS_DOUBLE_CASHBACK_ATTRIBUTE_ID]){
									isDoubleCashback = parseInt(branchAttributesList[branchData.branch_id][Constants.BRANCH_OFFERS_DOUBLE_CASHBACK_ATTRIBUTE_ID]);
								}
								if(branchAttributesList[branchData.branch_id][Constants.BRANCH_OFFERS_CASHBACK_ATTRIBUTE_ID]){
									isCashback =  parseInt(branchAttributesList[branchData.branch_id][Constants.BRANCH_OFFERS_CASHBACK_ATTRIBUTE_ID]);
								}
							}
							branchData.is_cashback 			=	 isCashback;
							branchData.is_double_cashback 	=	 isDoubleCashback
						});

						/** Send success response **/
						successResponse.result 					= 	branchResult;
						successResponse.cuisinePrioritiesList 	=	cuisinePrioritiesList;
						resolve(successResponse);
					});
				});
			});
		}).catch(next);
	};// end getRestaurantList()

	/**
	 * Function to get category list
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getCategoryListWithItem (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
            req.body 		=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
            let areaId		=	(req.body.area_id) 		? 	new ObjectId(req.body.area_id) 		 :"";
            let branchId	=	(req.body.branch_id) 	? 	new ObjectId(req.body.branch_id) 	 :"";
            let restaurantId= 	(req.body.restaurant_id)?	new ObjectId(req.body.restaurant_id) :"";
			let userId		= 	(req.body.user_id) 		?	new ObjectId(req.body.user_id) 		 :"";
			let deviceId	= 	(req.body.device_id) 		? req.body.device_id 		 		 :"";
			let openingTime = 	(res.locals.settings["App.opening_time"]) ? res.locals.settings["App.opening_time"] : "";
			let closingTime = 	(res.locals.settings["App.closing_time"]) ? res.locals.settings["App.closing_time"] : "";

			/** Send error response **/
			if(!restaurantId || !areaId || !branchId) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			let currentTime =	parseFloat(Helpers.newDate("",Constants.SHIFT_TIME_FORMAT));
			let currentDay 	=	parseInt(Helpers.newDate("","d"));
			const items		= 	this.db.collection(Tables.ITEMS);
			const users		=	this.db.collection(Tables.USERS);
			const item_linkings= this.db.collection(Tables.ITEM_LINKINGS);
			const branch_inactive_items= this.db.collection(Tables.BRANCH_INACTIVE_ITEMS);
			const restaurant_open_branches	= 	this.db.collection(Tables.RESTAURANT_OPEN_BRANCHES);
			asyncParallel({
				restaurant_details : (callback)=>{
					/** Set restaurant conditions **/
					let restaurantConditions = {
						_id			:	restaurantId,
						is_deleted	:	Constants.NOT_DELETED,
						status		:	Constants.ACTIVE,
					};

					/** Get restaurant details **/
					const restaurants	= this.db.collection(Tables.RESTAURANTS);
					restaurants.findOne(restaurantConditions,{projection: {image: 1, name: 1, landing_image:1,detail_image:1,web_image:1 }}).then(restaurantResult=>{
						if(restaurantResult && restaurantResult.web_image){
							restaurantResult.web_images = restaurantResult.web_image;
							delete restaurantResult.web_image;
						}
						callback(null,restaurantResult);
					}).catch(next);
				},
				area_details : (callback)=>{
					/** Set area conditions **/
					let areaConditions = {
						restaurant_id	:	restaurantId,
						branch_id		:	branchId,
						area_id			:	areaId,
					};

					/** Get branch area details **/
					const restaurant_branch_areas	= this.db.collection(Tables.RESTAURANT_BRANCH_AREAS);
					restaurant_branch_areas.findOne(areaConditions,{projection: {minimum_order_limit: 1, has_offers: 1, delivery_by: 1, delivery_time: 1, delivery_fees: 1, accept_pickup_orders: 1, accept_scheduling_orders: 1}}).then(areaResult=>{
						callback(null, areaResult);
					}).catch(next);
				},
				linking_item_list : (callback)=>{
					/** Set linking item conditions **/
					let linkItemConditions = {
						restaurant_id	:	restaurantId,
						$or : [
							{
								type : Constants.ITEM_NOT_LISTED_TO_SELECTED_BRANCH_LIST,
								branch_ids: { $nin: [ branchId] }
							},
							{
								type: Constants.ITEM_LISTED_TO_SELECTED_BRANCH_LIST,
								$or : [
									{branch_ids	: { $size: 0} },
									{branch_ids : { $in: [ branchId ] } }
								]
							}
						]
					};

					/** Get item linking list **/
					item_linkings.find(linkItemConditions,{projection: {"customize_attributes.price_on_selection": 0}}).toArray().then(linkingResult=>{
						if(linkingResult.length <=0)  return callback(null,null);

						let itemIdsList 	  = [];
						let customizeItemList = {};
						linkingResult.map(records=>{
							if(records.customize_attributes) customizeItemList[records.item_id] = records.customize_attributes;

							itemIdsList.push(records.item_id);
						});

						callback(null, { customize_item_list: customizeItemList, item_ids: itemIdsList});
					}).catch(next);
				},
				inactive_branches_list : (callback)=>{
					/** Set linking item conditions **/
					let branchesItemConditions = {
						branch_ids		: 	{ $in: [ branchId] },
						restaurant_id	:	restaurantId,
					};

					/** Get inactive branches item list **/
					branch_inactive_items.distinct("item_id", branchesItemConditions).then(inactiveBranchIds=>{
						callback(null,inactiveBranchIds);
					}).catch(next);
				},
				category_list : (callback)=>{
					/** Set category conditions **/
					let categoryConditions = {
						restaurant_id	:	restaurantId,
						is_active		:	Constants.ACTIVE,
					};

					/** Get category list **/
					const restaurant_categories	= this.db.collection(Tables.RESTAURANT_CATEGORIES);
					restaurant_categories.find(categoryConditions,{projection: {_id: 1, name: 1}}).sort({order: Constants.SORT_ASC}).toArray().then(categoryResult=>{
						callback(null,categoryResult);
					}).catch(next);
				},
				availability_item_list : (callback)=>{
					/** Set availability item conditions **/
					let availabilityConditions = {
						restaurant_id	:	restaurantId,
						$or: [
							{$and : [
								{from_time : {$gte : currentTime }},
								{to_time   : {$lte : currentTime }}
							]},
							{$and : [
								{to_time	: {$gte : currentTime }},
								{from_time 	: {$lte : currentTime }}
							]}
						],
					};

					/** Get availability item list **/
					const item_availability	= this.db.collection(Tables.ITEM_AVAILABILITY);
					item_availability.distinct( "item_id", availabilityConditions).then(availabilityResult=>{
						callback(null,availabilityResult);
					}).catch(next);
				},
				branch_details : (callback)=>{
					/** Set branch conditions **/
					let branchConditions = {
						_id				:	branchId,
						is_active		:	Constants.ACTIVE,
						restaurant_id	:	restaurantId,
					};

					/** Get branch details **/
					const restaurant_branches	= this.db.collection(Tables.RESTAURANT_BRANCHES);
					restaurant_branches.findOne(branchConditions,{projection: {slogan_in_english: 1, slogan_in_arabic: 1, open_time: 1, close_time: 1}}).then(branchResult=>{
						callback(null, branchResult);
					}).catch(next);
				},
				favorite_list : (favoriteCallback)=>{
					if(!userId) return favoriteCallback(null, {});

					/** Get favorite item list **/
					const user_favorites	= this.db.collection(Tables.USER_FAVORITES);
					user_favorites.distinct( "item_id",{user_id:  userId}).then(favoriteResult=>{
						if(favoriteResult.length <= 0) return favoriteCallback(null, {});

						let favoriteList = {};
						favoriteResult.map(tempItemId=>{
							favoriteList[String(tempItemId)] = true;
						});

						favoriteCallback(null, favoriteList);
					}).catch(next);
				},
				cuisine_priorities_list : (callback)=>{
					/** Get cuisine priorities list **/
					const restaurant_branch_cuisines	= this.db.collection(Tables.RESTAURANT_BRANCH_CUISINES);
					restaurant_branch_cuisines.aggregate([
						{$match 	: 	{
							branch_id 		: 	branchId,
							restaurant_id 	:	restaurantId
						}},
						{$sort	 	: 	{order	: Constants.SORT_ASC }},
						{$limit		:	Constants.CUISINE_PRIORITIES_LIMIT},
						{$lookup	: 	{
							from			: Tables.CUISINES,
							localField		: "cuisine_id",
							foreignField	: "_id",
							as				: "cuisines",
						}},
						{$project	: { _id: 1, cuisine_id: 1, cuisine_name: { $arrayElemAt: ["$cuisines.name", 0] }}},
					]).toArray().then(cuisineResult=>{
						callback(null, cuisineResult);
					}).catch(next);
				},
				active_menu_details : (callback)=>{
					/** Get linked branch menu  list **/
					const restaurant_menu_branches	= this.db.collection(Tables.RESTAURANT_MENU_BRANCHES);
					restaurant_menu_branches.distinct( "menu_id", {branch_id: branchId }).then(linkingMenuIds=>{
						if(linkingMenuIds.length <=0)  return callback(null,{link_menu : false, menu_id: null});

						let menuConditions = {
							_id			 :  {$in: linkingMenuIds},
							restaurant_id:  restaurantId,
							$or : [
								{is_default: true},
								{$and: [
									{$or: [
										{$and : [
											{start_date : {$gte : currentDay }},
											{end_date   : {$lte : currentDay }}
										]},
										{$and : [
											{end_date 	: {$gte : currentDay }},
											{start_date : {$lte : currentDay }}
										]}
									]},
									{$or: [
										{$and : [
											{start_time : {$gte : currentTime }},
											{end_time   : {$lte : currentTime }}
										]},
										{$and : [
											{end_time 	: {$gte : currentTime }},
											{start_time : {$lte : currentTime }}
										]}
									]},
								]}
							]
						};

						/** Get menu details */
						const restaurant_menus	= this.db.collection(Tables.RESTAURANT_MENUS);
						restaurant_menus.findOne(menuConditions,{projection: {_id: 1,start_date: 1,is_default:1}, sort: {is_default: Constants.SORT_DESC}}).then(menuResult=>{
							let branchMenuId = (menuResult) ? menuResult._id : "";
							callback(null,{link_menu : true, menu_id: branchMenuId});
						}).catch(next);
					}).catch(next);
				},
				cart_count : (callback)=>{
					if(!userId && !deviceId) return callback(null,0);

					/** Get cart count */
					this.userCartAPI.getCartCount(req,res,next).then(cartResponse=>{
						if(cartResponse.status != Constants.STATUS_SUCCESS) return callback(cartResponse);
						callback(null,cartResponse.count);
					}).catch(next);
				},
				recommended_item_list : (callback)=>{
					/** Get recommended item **/
					const item_recommended = this.db.collection(Tables.ITEM_RECOMMENDED);
					item_recommended.find({restaurant_id: restaurantId},{projection: {recommended: 1}}).toArray().then(recommendedResult=>{
						if(!recommendedResult || recommendedResult.length <= 0)  return callback(null,[]);

						/** Push recommended item id in a array **/
						let recommended = [];
						recommendedResult.map(records=>{
							if(records.recommended){
								records.recommended.map(tmpRecommendedId=>{
									recommended.push(tmpRecommendedId);
								});
							}
						});

						/** Set linking item conditions **/
						let linkItemConditions = {
							restaurant_id: restaurantId,
							item_id: {$in: recommended},
							$or: [
								{
									type : Constants.ITEM_NOT_LISTED_TO_SELECTED_BRANCH_LIST,
									branch_ids: { $nin: [ branchId] }
								},
								{
									type: Constants.ITEM_LISTED_TO_SELECTED_BRANCH_LIST,
									$or : [
										{branch_ids: { $size: 0} },
										{branch_ids: { $in: [ branchId ] } }
									]
								}
							]
						};

						/** Get item ids from item linkings **/
						item_linkings.distinct("item_id", linkItemConditions).then(itemIds=>{
							if(itemIds.length <=0)  return callback(null,[]);

							/** Get item details **/
							items.find({
								_id			:	{$in : itemIds},
								restaurant_id:	restaurantId,
								is_active	:	Constants.ACTIVE,
							},{projection: {_id: 1, name: 1, description: 1, price_on_selection: 1, item_price: 1, image: 1, category_ids: 1}}).toArray().then(itemResult=>{
								callback(null, itemResult);
							}).catch(next);
						}).catch(next);
					}).catch(next);
				},
				upselling_item_list : (callback)=>{
					/** Get upselling item **/
					const item_upsellings = this.db.collection(Tables.ITEM_UPSELLINGS);
					item_upsellings.find({restaurant_id: restaurantId},{projection: {upselling: 1}}).toArray().then(upsellingResult=>{
						if(!upsellingResult || upsellingResult.length <= 0)  return callback(null,[]);

						/** Push upselling item id in a array **/
						let upselling = [];
						upsellingResult.map(records=>{
							if(records.upselling){
								records.upselling.map(tmpUpsellingId=>{
									upselling.push(tmpUpsellingId);
								});
							}
						});

						/** Set linking item conditions **/
						let linkItemConditions = {
							restaurant_id: restaurantId,
							item_id	: {$in : upselling},
							$or : [
								{
									type : Constants.ITEM_NOT_LISTED_TO_SELECTED_BRANCH_LIST,
									branch_ids: { $nin: [ branchId] }
								},
								{
									type: Constants.ITEM_LISTED_TO_SELECTED_BRANCH_LIST,
									$or : [
										{branch_ids	: { $size: 0} },
										{branch_ids : { $in: [ branchId ] } }
									]
								}
							]
						};

						/** Get item ids from item linkings **/
						item_linkings.distinct("item_id",linkItemConditions).then(itemIds=>{
							if(itemIds.length <=0)  return callback(null,[]);

							/** Get item details **/
							items.find({
								_id				:	{$in : itemIds},
								restaurant_id	:	restaurantId,
								is_active		:	Constants.ACTIVE,
							},{projection: {_id: 1, name: 1, description: 1, price_on_selection: 1, item_price: 1, image: 1,category_ids:1}}).toArray().then(itemResult=>{
								callback(null, itemResult);
							}).catch(next);
						}).catch(next);
					}).catch(next);
				},
				attributes_details: (callback)=>{
					/** Check branch attributes details */
					const restaurant_branch_attributes = this.db.collection(Tables.RESTAURANT_BRANCH_ATTRIBUTES);
					restaurant_branch_attributes.find({
						branch_id		: branchId,
						restaurant_id 	: restaurantId,
						attribute_id	: {$in: [
							Constants.BRANCH_OFFERS_DOUBLE_CASHBACK_ATTRIBUTE_ID,
							Constants.BRANCH_OFFERS_CASHBACK_ATTRIBUTE_ID,
						]},
					},{projection: {attribute_id:1, value: 1}}).toArray().then(attributeResult=>{

						let attributeList =  {};
						attributeResult.map(attributeData=>{
							attributeList[attributeData.attribute_id] = attributeData.value;
						});
						callback(null,attributeList);
					}).catch(next);
				},
				payment_method_list: (callback)=>{
					/** Get branch selected payment method list */
					const restaurant_branch_payment_methods = this.db.collection(Tables.RESTAURANT_BRANCH_PAYMENT_METHODS);
					restaurant_branch_payment_methods.aggregate([
						{$match		: {
							branch_id		: 	branchId,
							restaurant_id	:	restaurantId
						}},
						{$addFields:{
							payment_methods : {$ifNull: [ "$payment_methods", [] ] }
						}},
						{$lookup: {
							from: Tables.PAYMENT_METHODS,
							let: {methods: '$payment_methods' },
							pipeline: [
								{$match: {
									$expr: {
										$in: ['$slug', '$$methods']
									}
								}},
								{$project: { _id :0, slug : 1,title : 1}}
							],
							as:'payment_methods'
						}},
						{$project : {
							payment_methods : 1
						}}
					]).toArray().then(result=>{
						let tmpPaymentMethod = (result && result[0]) ? result[0].payment_methods :[];
						callback(null, tmpPaymentMethod);
					}).catch(next);
				},
				new_user_count : (callback)=>{
					if(!userId) return callback(null,null);

					/** Set user conditions */
					let userConditions 		= {...{_id: userId}, ...Constants.CUSTOMER_COMMON_CONDITIONS};
					userConditions.is_guest	= {$exists: false};
					userConditions.created	= {$gte: Helpers.newDate(Helpers.subtractDate(Constants.NEW_USER_DAYS*Constants.HOURS_IN_A_DAY))};

					/** Check user type **/
					users.countDocuments(userConditions).then(userResult => {
						callback(null,userResult);
					}).catch(next);
				},
				corporate_details : (callback)=>{
					if(!userId) return callback(null,null);

					/** Set user conditions */
					let userConditions 			= {...{_id: new ObjectId(userId) },...Constants.CUSTOMER_COMMON_CONDITIONS};
					userConditions.corporate_id	= {$exists: true};

					/** Check user corporate **/
					users.findOne(userConditions,{projection:{corporate_id: 1}}).then(userResult=>{
						callback(null,userResult);
					}).catch(next);
				},
				branch_calender_list  : (callback)=>{
					let startDateTime 	= 	Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));
					let endDateTime 	= 	Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_END_DATE_FORMAT));

					/** Get branch open time */
					restaurant_open_branches.find({
						branch_id		: 	branchId,
						created			:	{$gte: startDateTime, $lte: endDateTime},
						restaurant_id	: 	restaurantId,
						type			: 	OPEN,
						$or : [
							{$or: [
								{$and : [
									{from : {$gte: currentTime }},
									{to   : {$lte: currentTime }}
								]},
								{$and : [
									{to 	: {$gte: currentTime }},
									{from 	: {$lte: currentTime }}
								]}
							]},
							{$or: [
								{
									to	:	{$gte: currentTime},
									$or :	[
										{from : {$gte: currentTime }},
									],
								}
							]}
						]
					}).toArray().then(openResult=>{
						if(openResult.length ==0) return callback(null,[]);

						let openTime	= 	0;
						let closeTime 	=	0;
						openResult.map((records,index)=>{
							let tmpOpenTime 	= 	records.from;
							let tmpCloseTime	=	records.to;

							if(index == 0){
								openTime	= 	tmpOpenTime;
								closeTime 	=	tmpCloseTime;
							}

							if(tmpOpenTime < openTime) 	 openTime	= 	tmpOpenTime;
							if(tmpCloseTime > closeTime) closeTime 	=	tmpCloseTime;
						});

						callback(null,[{open_time: openTime, close_time: closeTime, openResult: openResult }]);
					}).catch(next);
				},
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				/** Send error response */
				if(!asyncResponse.restaurant_details || !asyncResponse.area_details  ||  !asyncResponse.branch_details){
					return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });
				}

				let inactiveItemIds		= 	asyncResponse.inactive_branches_list;
				let favoriteList 		= 	asyncResponse.favorite_list;
				let branchDetails 		= 	asyncResponse.branch_details;
				let areaDetails 		= 	asyncResponse.area_details;
				let restaurantDetails 	=	asyncResponse.restaurant_details;
				let availabilityItemIds	=	asyncResponse.availability_item_list;
				let categoryList 		=	asyncResponse.category_list;
				let cuisinePrioritiesList=	asyncResponse.cuisine_priorities_list;
				let activeMenuDetails 	=	asyncResponse.active_menu_details;
				let activeMenuId		=	activeMenuDetails.menu_id;
				let isBranchLinkMenu	=	activeMenuDetails.link_menu;
				let cartCount 			=	asyncResponse.cart_count;
				let recommendedItemList =	asyncResponse.recommended_item_list;
				let upsellingItemList   =	asyncResponse.upselling_item_list;
				let paymentMethodList   =	asyncResponse.payment_method_list;
				let branchCalenderList	=	asyncResponse.branch_calender_list;
				let branchAttributesDetails=asyncResponse.attributes_details;
				let corporateDetails=(asyncResponse.corporate_details)? asyncResponse.corporate_details:{};
				let corporateId		=  	(corporateDetails.corporate_id) ?corporateDetails.corporate_id :"";
				let newUserCount	=	asyncResponse.new_user_count;
				let userType 		=	(deviceId && !userId) ? Constants.APPLICABLE_FOR_GUEST :((newUserCount >0) ?  Constants.APPLICABLE_FOR_NEW_USERS : Constants.APPLICABLE_FOR_REGISTERED_MEMBER);
				let calenderOpenTime	=	openingTime;
				let calenderCloseTime	=	closingTime;

				/** set branch time an open time*/
				if(branchDetails.open_time != "") calenderOpenTime = String(branchDetails.open_time).replace(".",":");
				if(branchDetails.close_time != "") calenderCloseTime = String(branchDetails.close_time).replace(".",":");

				/** Set branch time an open time */
				if(branchCalenderList.length >0){
					let tmpOpenTime = String(branchCalenderList[0].open_time.toFixed(Constants.ROUND_PRECISION)).replace(".",":");
					let tmpCloseTime = String(branchCalenderList[0].close_time.toFixed(Constants.ROUND_PRECISION)).replace(".",":");
					if(tmpOpenTime.length<=4)	tmpOpenTime		= 	"0"+tmpOpenTime;
					if(tmpCloseTime.length<=4) 	tmpCloseTime 	=	"0"+tmpCloseTime;

					calenderOpenTime	=	tmpOpenTime
					calenderCloseTime	=	tmpCloseTime;
				}

				/** Add cuisine priorities details in branch details **/
				branchDetails.cuisine_priorities 	= 	cuisinePrioritiesList;
				branchDetails.payment_methods 		=	paymentMethodList;

				/** Add branch area attribute */
				let tmpDeliveryBy							=	areaDetails.delivery_by;
				restaurantDetails.has_offers 				=	areaDetails.has_offers;
				restaurantDetails.delivery_by 				=	tmpDeliveryBy;
				restaurantDetails.delivery_time 			=	areaDetails.delivery_time;
				restaurantDetails.delivery_fees 			=	areaDetails.delivery_fees;
				restaurantDetails.minimum_order_limit 		=  	areaDetails.minimum_order_limit;
				restaurantDetails.accept_pickup_orders 		=	areaDetails.accept_pickup_orders;
				restaurantDetails.accept_scheduling_orders 	=	areaDetails.accept_scheduling_orders;
				restaurantDetails.delivery_by_cravez = (tmpDeliveryBy == Constants.DELIVERY_BY_CRAVEZ) ? true :false;

				let isCashback 			= 	0;
				let isDoubleCashback 	=	0;
				if(branchAttributesDetails){
					if(branchAttributesDetails[Constants.BRANCH_OFFERS_DOUBLE_CASHBACK_ATTRIBUTE_ID]){
						isDoubleCashback = parseInt(branchAttributesDetails[Constants.BRANCH_OFFERS_DOUBLE_CASHBACK_ATTRIBUTE_ID]);
					}
					if(branchAttributesDetails[Constants.BRANCH_OFFERS_CASHBACK_ATTRIBUTE_ID]){
						isCashback =  parseInt(branchAttributesDetails[Constants.BRANCH_OFFERS_CASHBACK_ATTRIBUTE_ID]);
					}
				}
				restaurantDetails.is_cashback 			=	isCashback;
				restaurantDetails.is_double_cashback	=	isDoubleCashback
				restaurantDetails.branch_offer_count  	=	0;

				/** Set return response  */
				let successResponse = {
					status 				:	Constants.STATUS_SUCCESS,
					result 				: 	[],
					open_time			: 	calenderOpenTime,
					close_time			: 	calenderCloseTime,
					restaurant_details 	: 	restaurantDetails,
					branch_details	 	: 	branchDetails,
					restaurant_image_url:	Constants.RESTAURANT_FILE_URL,
					item_image_url		:	Constants.ITEMS_FILE_URL,
					cart_count          :   cartCount,
					recommended_items   :   recommendedItemList,
					upselling_items 	:   upsellingItemList,
					asyncResponse 		:   asyncResponse,
					currentTime 		:   currentTime,
					currentDay 			:   currentDay,
				};

				/** Send success response */
				if(!asyncResponse.linking_item_list || !categoryList || categoryList.length <=0){
					return resolve(successResponse);
				}

				let customizeItemList	=	asyncResponse.linking_item_list.customize_item_list;
				let itemIds				=	asyncResponse.linking_item_list.item_ids;
				let allCategoryIds		=	[];

				categoryList.map(records=>{
					allCategoryIds.push(records._id);
				});

				/** Set item conditions **/
				let itemConditions = {
					restaurant_id:	restaurantId,
					$and :[
						{ _id	:	{$in : itemIds} },
						{ _id	:	{$in : availabilityItemIds} },
						{ _id	:	{$nin : inactiveItemIds} }
					],
					is_active		:	Constants.ACTIVE,
					non_sellable	:	{$ne : Constants.NON_SELLABLE},
					"category_ids.0": 	{$exists: true}
				};

				if(isBranchLinkMenu){
					itemConditions["$or"] = [
						{"menu_ids.0": {$exists: false}},
						{"menu_ids": {$in: [activeMenuId]}}
					];
				}else{
					itemConditions["menu_ids"] = activeMenuId;
				}

				asyncParallel({
					item_list : (parallelCallback)=>{
						/** Get item list */
						const items = this.db.collection(Tables.ITEMS);
						items.aggregate([
							{$match : itemConditions},
							{$lookup:	{
								from     : Tables.ITEM_UNITS,
								let      : {itemId : "$_id"},
								pipeline : [
									{$match : {
										$expr: {
											$and : [
												{$eq: ["$item_id", "$$itemId"]},
												{$eq: ["$status", Constants.ACTIVE]},
											]
										}
									}},
								],
								as : "unit_list"
							}},
							{$addFields : {
								price_on_selection: {$cond: [
									{$and: [
										{$eq: [{$size: "$unit_list"}, 1] },
										{$eq: ["$kfg", true] },
									]},
									0, "$price_on_selection"
								]},
							}},
							{$project : {
								_id:1,name:1,description:1, category_ids:1, item_price:1,image:1,order:1, discount_percentage: 1, discount_value: 1,grid_image:1,detail_image:1, price_on_selection: 1, item_id: 1,kfg:1,
								item_price	: 	{$cond: [
									{$and: [
										{$eq: ["$item_type", Constants.DEAL_ITEM] },
									]},
									"$item_price", {$ifNull: [ "$unit_price", "$item_price" ] }
								]},
							}},
							{$sort: {order: Constants.SORT_ASC}}
						]).toArray().then(itemResult=>{
							parallelCallback(null, itemResult);
						}).catch(next);
					},
					branch_offer : (parallelCallback)=>{
						if(!userId && !deviceId) return parallelCallback(null);

						let offerFromDate = Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));
						let offerToDate   = Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_END_DATE_FORMAT));

						/** Set lookup conditions */
						let lookupConditions = {
							$and : [
								{$eq: ["$offer_id", "$$offerId"]},
							]
						};

						if(userId){
							lookupConditions["$and"].push({$eq: ["$user_id", userId ]});
						}else{
							lookupConditions["$and"].push({$eq: ["$device_id", deviceId ]});
						}

						/** Add offer conditions */
						let offerConditions = {
							display_offer	:  	true,
							is_active		:	Constants.ACTIVE,
							status			:	Constants.OFFER_PUBLISHED,
							$and			:	[
								{$or : [
									{"applicable_for.0" : {$exists: false}},
									{applicable_for	   : {$in: [userType]}}
								]},
								{$or : [
									{"restaurant_ids.0" : {$exists: false}},
									{restaurant_ids	 	: {$in: [restaurantId]}}
								]},
								{$or : [
									{"branch_ids.0" : {$exists: false}},
									{branch_ids	 	: {$in: [branchId]}}
								]},
								{$or : [
									{$and : [
										{ valid_from : {$gte : Helpers.newDate(offerFromDate)} },
										{ valid_to   : {$lte : Helpers.newDate(offerToDate)} }
									]},
									{$and : [
										{ valid_to 	 : {$gte : Helpers.newDate(offerFromDate)} },
										{ valid_from : {$lte : Helpers.newDate(offerToDate)} }
									]}
								]}
							]
						};

						if(userId){
							offerConditions["$and"].push({$or: [
								{"user_ids.0": {$exists: false}},
								{user_ids	 : {$in: [userId]} }
							]});
						}

						if(corporateId){
							offerConditions["$and"].push({$or: [
								{"corporate_ids.0" : {$exists: false}},
								{corporate_ids	   : {$in: [corporateId]}}
							]});
						}else{
							offerConditions.offer_type = {$ne: Constants.CORPORATE_OFFER};
						}

						/** Get branch offer count */
						const offers = this.db.collection(Tables.OFFERS);
						offers.aggregate([
							{$match : offerConditions},
							{$lookup:	{
								from     : Tables.OFFER_LOGS,
								let      : {offerId : "$_id"},
								pipeline : [
									{$match : {
										$expr: lookupConditions
									}},
									{$project : {_id: 1}},
								],
								as:	"offer_unique_redeem_details"
							}},
							{$lookup : {
								from 		 : Tables.OFFER_LOGS,
								localField 	 : "_id",
								foreignField : "offer_id",
								as 			 : "offer_redeem_details"
							}},
							{$addFields :{
								unique_redeem_count : {$size: "$offer_unique_redeem_details"},
								total_redeem_count  : {$size: "$offer_redeem_details"},
							}},
							{$match : {
								$expr: {
									$and : [
										{$or:[
											{$eq: ["$total_unique_redeem", ""]},
											{$gt: ["$total_unique_redeem","$unique_redeem_count"]},
										]},
										{$or:[
											{$eq: ["$total_redeem", ""]},
											{$gt: ["$total_redeem", "$total_redeem_count"]},
										]},
									]
								}
							}},
							{$count: "count"}
						]).toArray().then(offerResult=>{
							let tmpOfferCount = (offerResult && offerResult[0]) ? offerResult[0].count :0;

							/** Add branch offer count  */
							restaurantDetails.branch_offer_count =	tmpOfferCount;

							parallelCallback(null);
						}).catch(next);
					},
					item_order_list : (parallelCallback)=>{
						/** Set item order conditions **/
						let orderConditions = {
							restaurant_id	: 	restaurantId,
							category_id		: 	{$in: allCategoryIds},
						};

						/** Get item order list **/
						const item_category_orders	= this.db.collection(Tables.ITEM_CATEGORY_ORDERS);
						item_category_orders.find(orderConditions,{projection: {item_id: 1, category_id: 1, order: 1}}).sort({order: Constants.SORT_ASC}).toArray().then(orderResult=>{
							if(orderResult.length <=0) return parallelCallback(null,{});

							let tmpOrderObj = {};
							orderResult.map(records=>{
								let itemId 		=	records.item_id;
								let catId 		= 	records.category_id;
								let itemOrder 	= 	records.order;

								if(!tmpOrderObj[catId]) tmpOrderObj[catId] = {};

								if(!tmpOrderObj[catId].max_order) tmpOrderObj[catId].max_order = 0;
								if(!tmpOrderObj[catId].item_list) tmpOrderObj[catId].item_list = {};

								tmpOrderObj[catId].item_list[itemId] =	itemOrder;
								if(itemOrder > tmpOrderObj[catId].max_order){
									tmpOrderObj[catId].max_order =	itemOrder;
								}
							});
							parallelCallback(null,tmpOrderObj);
						}).catch(next);
					},
				},(asyncChildErr, asyncChildResponse)=>{
					if(asyncChildErr) return next(asyncChildErr);

					let itemResult 		=	asyncChildResponse.item_list;
					let itemOrderList 	=	asyncChildResponse.item_order_list;

					/** Send success response */
					if(itemResult.length <=0) return resolve(successResponse);

					let finalCategoryList 	= {};
					categoryList.map((categoryData,categoryIndex)=>{
						let tmpCategoryId = categoryData._id;
						itemResult.map(itemData=>{
							let isVaild	= false;
							if(itemData.image){
								itemData.image = itemData.image.replace(RegExp('Large','g'),"Small");
							}

							if(itemData.item_price){
								let tmpPrice 		=	itemData.item_price;
								let percentage		=	itemData.discount_percentage;
								let discountValue	=	itemData.discount_value;

								if(discountValue){
									let tmpDiscount= (tmpPrice>=discountValue) ? discountValue :tmpPrice;

									itemData.strikethrough_price = tmpPrice;
									itemData.item_price = Helpers.round(tmpPrice-tmpDiscount);
								}else if(percentage){
									let tmpDiscount = 	(tmpPrice*percentage)/100;

									itemData.strikethrough_price= tmpPrice;
									itemData.item_price = Helpers.round(tmpPrice-tmpDiscount);
								}
							}

							if(itemData.category_ids.length > 0){
								itemData.category_ids.map(itemCateId=>{
									if(String(itemCateId) == String(tmpCategoryId)){
										isVaild = true;
									}
								});
							}

							/** Add favorite status  */
							itemData.is_favorite =	(favoriteList[itemData._id]) ? Constants.FAVOURITE :Constants.UNFAVOURITE;

							if(isVaild){
								let tmpItemOrder = itemData.order;
								if(itemOrderList[tmpCategoryId]){
									let orderDetails = itemOrderList[tmpCategoryId];
									if(orderDetails.item_list && orderDetails.item_list[itemData._id]){
										tmpItemOrder= orderDetails.item_list[itemData._id];
									}else if(orderDetails.max_order){
										tmpItemOrder= orderDetails.max_order+categoryIndex+1;
									}
								}

								if(!finalCategoryList[tmpCategoryId])  finalCategoryList[tmpCategoryId] = clone(categoryData);

								let tempItemDetails 	= 	clone(itemData);
								tempItemDetails.order 	=	tmpItemOrder;
								if(customizeItemList[itemData._id] && !itemData.kfg){
									tempItemDetails = Object.assign(tempItemDetails, customizeItemList[itemData._id]);
								}

								if(!finalCategoryList[tmpCategoryId].item_list) finalCategoryList[tmpCategoryId].item_list = [];

								finalCategoryList[tmpCategoryId].item_list.push(tempItemDetails);
							}
						});
					});

					Object.keys(finalCategoryList).map(tmpKey=>{
						let tmpItemList = (finalCategoryList[tmpKey]) ? finalCategoryList[tmpKey].item_list :[];

						let sortedItemList = tmpItemList.sort(this.sortByKey(["order"]));

						finalCategoryList[tmpKey].item_list = sortedItemList;
					});

					/**Send success response */
					successResponse.result = Object.values(finalCategoryList);
					resolve(successResponse);
				});
			});
        }).catch(next);
	};// end getCategoryListWithItem()

	/**
	 * Function to sort array
	*/
	sortByKey = (fields) => (a, b) => fields.map(o => {
		let dir = 1;
		if (o[0] === '-') { dir = -1; o=o.substring(1); }
		return a[o] > b[o] ? dir : a[o] < b[o] ? -(dir) : 0;
	}).reduce((p, n) => p ? p : n, 0);

	/**
	 * Function to get item details
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getItemDetails (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 		=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let categoryId	= 	(req.body.category_id) 		?	new ObjectId(req.body.category_id) 		:"";
            let branchId	= 	(req.body.branch_id) 		?	new ObjectId(req.body.branch_id) 		:"";
            let itemId		= 	(req.body.item_id) 			?	new ObjectId(req.body.item_id) 			:"";
			let restaurantId= 	(req.body.restaurant_id) 	?	new ObjectId(req.body.restaurant_id) 	:"";
			let userId		= 	(req.body.user_id) 			?	new ObjectId(req.body.user_id) 			:"";
			let areaId		=	(req.body.area_id) 			? 	new ObjectId(req.body.area_id) 			:"";
			let cartId		=	(req.body.cart_id) 			? 	new ObjectId(req.body.cart_id) 			:"";
			let deviceId	= 	(req.body.device_id)	 	?	req.body.device_id						:"";

			/** Send error response **/
			if(!restaurantId || !itemId || !areaId) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			/** Set item conditions **/
			let itemConditions = {
				_id				:	itemId,
				is_active		:	Constants.ACTIVE,
				restaurant_id	:	restaurantId,
			};

			/** Add category conditions */
			if(categoryId){
				itemConditions["$or"] = [
					{"category_ids.0" :{$exists: false}},
					{"category_ids"   :{$in: [categoryId] }}
				];
			}

			const items	 		=	this.db.collection(Tables.ITEMS);
			const item_linkings	= 	this.db.collection(Tables.ITEM_LINKINGS);
			asyncParallel({
				item_details: (parentCallback)=>{
					/** Get item details */
					items.findOne(itemConditions,{projection: {_id: 1, name: 1, description: 1, item_type : 1, price_on_selection: 1,item_price: 1,no_of_components:1,image:1,no_of_duplicate:1, discount_percentage:1,discount_value:1,grid_image:1,detail_image:1,kfg:1,v_group_item_ids:1}}).then(itemResult=>{
						parentCallback(null, itemResult);
					}).catch(next);
				},
				item_unit_list : (callback)=>{
					/** Get item unit list **/
					const item_units =	this.db.collection(Tables.ITEM_UNITS);
					item_units.aggregate([
						{$match :{
							item_id : itemId,
							status	: Constants.ACTIVE,
						}},
						{$sort : {price: Constants.SORT_ASC, sorting: Constants.SORT_ASC}},
						{$lookup: {
							from 			: 	Tables.ITEM_UNITS_MASTERS,
							localField 		:	"item_unit_id",
							foreignField 	: 	"_id",
							as	 			: 	"unit_detail"
						}},
						{$project : {
							_id: 1, unit_id: "$item_unit_id", price: 1, discount_type: 1, discount_value: 1, unit_name: {$arrayElemAt: ["$unit_detail.name",0]},
							kfg_size_id: {$arrayElemAt: ["$unit_detail.size_id",0]}
						}}
					]).toArray().then(unitResult=>{
						callback(null, unitResult);
					}).catch(next);
				},
			},(parentErr, parentResponse)=>{
				if(parentErr) return next(parentErr);

				/** Send error response **/
				if(!parentResponse.item_details){
					return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });
				}

				let itemResult 		=	parentResponse.item_details;
				let itemUnitList	= 	parentResponse.item_unit_list;
				let itemUnitIds		= 	[];
				if(itemResult.item_price){
					let tmpPrice 		=	itemResult.item_price;
					let percentage		=	itemResult.discount_percentage;
					let discountValue	=	itemResult.discount_value;

					if(discountValue){
						let tmpDiscount= (tmpPrice>=discountValue) ? discountValue :tmpPrice;

						itemResult.strikethrough_price = tmpPrice;
						itemResult.item_price = Helpers.round(tmpPrice-tmpDiscount);
					}else if(percentage){
						let tmpDiscount = 	(tmpPrice*percentage)/100;

						itemResult.strikethrough_price= tmpPrice;
						itemResult.item_price = Helpers.round(tmpPrice-tmpDiscount);
					}
				}

				if(itemUnitList.length >0){
					itemUnitList.map(records=>{
						itemUnitIds.push(records.unit_id);
					});
				}

				let itemType 		= 	itemResult.item_type;
				let vGroupItemIds 	=	itemResult.v_group_item_ids;
				asyncParallel({
					item_dough_list : (callback)=>{
						if(itemType != PIZZA_VGROUP && itemType != Constants.DEAL_ITEM && itemType != HALF_AND_HALF_ITEM) return callback(null,[]);

						/** Get dough list **/
						const item_dough_units = this.db.collection(Tables.ITEM_DOUGH_UNITS);
						item_dough_units.aggregate([
							{$match :{
								item_id : itemId,
								status	: Constants.ACTIVE,
							}},
							{$sort : {sorting: Constants.SORT_ASC}},
							{$lookup: {
								from 			: 	Tables.ITEM_UNITS_MASTERS,
								localField 		:	"item_unit_id",
								foreignField 	: 	"_id",
								as	 			: 	"unit_detail"
							}},
							{$project : {
								_id: 1, price: 1, item_unit_id: 1, parents: 1,kfg_dough_type: 1,
								unit_name: {$arrayElemAt: ["$unit_detail.name",0]},
							}}
						]).toArray().then(unitResult=>{
							callback(null, unitResult);
						}).catch(next);
					},
					item_selector_list : (callback)=>{
						if(itemType != Constants.DEAL_ITEM && itemType != HALF_AND_HALF_ITEM) return callback(null,[]);

						/** Get selector list **/
						const item_selector_units = this.db.collection(Tables.ITEM_SELECTOR_UNITS);
						item_selector_units.aggregate([
							{$match :{
								item_id : itemId,
								status	: Constants.ACTIVE,
							}},
							{$sort : {sorting: Constants.SORT_ASC}},
							{$lookup: {
								from 			: 	Tables.ITEM_UNITS_MASTERS,
								localField 		:	"item_unit_id",
								foreignField 	: 	"_id",
								as	 			: 	"unit_detail"
							}},
							{$project : {
								_id: 1, price: 1, item_unit_id: 1, parents: 1, dough_type_parents :1, sorting : 1,kfg_selector: 1,
								unit_name: {$arrayElemAt: ["$unit_detail.name",0]},
							}}
						]).toArray().then(unitResult=>{
							callback(null, unitResult);
						}).catch(next);
					},
					item_choice_of_list : (callback)=>{
						/** Set choice conditions  */
						let choiceConditions = {
							item_id : itemId,
							is_auto_selected: {$exists: false},
							$or	: [
								{unit_id: {$in: itemUnitIds}},
							]
						};

						if(itemType == Constants.DEAL_ITEM){
							choiceConditions.unit_id = {$exists: true};
						}else{
							choiceConditions["$or"].push({unit_id: {$exists: false}});
						}

						/** Get choice count */
						const item_group_extras	 = this.db.collection(Tables.ITEM_GROUP_EXTRAS);
						item_group_extras.countDocuments(choiceConditions).then(contResult=>{
							callback(null,contResult);
						}).catch(next);
					},
					favorite_details : (favoriteCallback)=>{
						if(!userId) return favoriteCallback(null,null);

						/** Get favorite item list **/
						const user_favorites	= this.db.collection(Tables.USER_FAVORITES);
						user_favorites.countDocuments({
							user_id	:	userId,
							item_id	:	itemId,
						}).then(favoriteResult=>{
							favoriteCallback(null, favoriteResult);
						}).catch(next);
					},
					cart_details : (cartCallback)=>{
						if(!cartId) return cartCallback(null,null);

						/** Set cart conditions */
						let cartConditions = {
							_id				:	cartId,
							item_id			:	itemId,
							restaurant_id	:	restaurantId,
							$or : [
								{max_modified_time : {$exists: false}},
								{max_modified_time : {$gte: Helpers.newDate()}},
							]
						};

						if(userId){
							cartConditions.customer_id 	= 	userId;
						}else{
							cartConditions.device_id	=	deviceId;
						}

						/** Get user cart details **/
						const user_carts = this.db.collection(Tables.USER_CARTS);
						user_carts.findOne(cartConditions,{projection:{_id:1,qty:1,dough_id:1,item_unit_id:1,unit_id:1,selector_id:1,unit_lists:1,extra_items:1,note:1}}).then(cartResult=>{
							cartCallback(null, cartResult);
						}).catch(next);
					},
					area_details : (callback)=>{
						/** Set area conditions **/
						let areaConditions = {
							restaurant_id	:	restaurantId,
							branch_id		:	branchId,
							area_id			:	areaId,
						};

						/** Get branch area details **/
						const restaurant_branch_areas	= this.db.collection(Tables.RESTAURANT_BRANCH_AREAS);
						restaurant_branch_areas.findOne(areaConditions,{projection: {minimum_order_limit: 1, has_offers:1}}).then(areaResult=>{
							callback(null, areaResult);
						}).catch(next);
					},
					recommended_item_list : (callback)=>{
						/** Get recommended item **/
						const item_recommended = this.db.collection(Tables.ITEM_RECOMMENDED);
						item_recommended.findOne({item_id : itemId},{projection: {recommended: 1}}).then(itemRecommendedResult=>{
							if(!itemRecommendedResult)  return callback(null,[]);

							let recommonded = itemRecommendedResult.recommended ? itemRecommendedResult.recommended : [];

							/** Set linking item conditions **/
							let linkItemConditions = {
								restaurant_id:	restaurantId,
								item_id	: {$in : recommonded},
								$or : [
									{
										type : Constants.ITEM_NOT_LISTED_TO_SELECTED_BRANCH_LIST,
										branch_ids: { $nin: [ branchId] }
									},
									{
										type: Constants.ITEM_LISTED_TO_SELECTED_BRANCH_LIST,
										$or : [
											{branch_ids	: { $size: 0} },
											{branch_ids : { $in: [ branchId ] } }
										]
									}
								]
							};

							/** Get item ids from item linkings **/
							item_linkings.distinct( "item_id", linkItemConditions).then(itemIds=>{
								if(itemIds.length <=0)  return callback(null,[]);

								/** Set item conditions **/
								let itemCommonConditions = {
									_id				:	{$in : itemIds},
									restaurant_id	:	restaurantId,
									is_active		:	Constants.ACTIVE,
								};

								/** Get item details **/
								items.find(itemCommonConditions,{projection: {_id: 1, name: 1, description: 1,price_on_selection: 1, item_price: 1, image: 1,category_ids:1}}).toArray().then(itemDetailsResult=>{
									callback(null, itemDetailsResult);
								}).catch(next);
							}).catch(next);
						}).catch(next);
					},
					upselling_item_list : (callback)=>{
						/** Get upselling item **/
						const item_upsellings = this.db.collection(Tables.ITEM_UPSELLINGS);
						item_upsellings.findOne({item_id : itemId},{projection: {upselling: 1}}).then(itemUpsellingResult=>{
							if(!itemUpsellingResult)  return callback(null,[]);

							let upselling = itemUpsellingResult.upselling ? itemUpsellingResult.upselling : [];

							/** Set linking item conditions **/
							let linkItemConditions = {
								restaurant_id:	restaurantId,
								item_id	: {$in : upselling},
								$or : [
									{
										type : Constants.ITEM_NOT_LISTED_TO_SELECTED_BRANCH_LIST,
										branch_ids: { $nin: [ branchId] }
									},
									{
										type: Constants.ITEM_LISTED_TO_SELECTED_BRANCH_LIST,
										$or : [
											{branch_ids	: { $size: 0} },
											{branch_ids : { $in: [ branchId ] } }
										]
									}
								]
							};

							/** Get item ids from item linkings **/
							item_linkings.distinct( "item_id", linkItemConditions).then(itemIds=>{
								if(itemIds.length <=0)  return callback(null,[]);

								/** Set item conditions **/
								let itemCommonConditions = {
									_id				:	{$in : itemIds},
									restaurant_id	:	restaurantId,
									is_active		:	Constants.ACTIVE,
								};

								/** Get item details **/
								items.find(itemCommonConditions,{projection: {_id: 1, name: 1, description: 1,price_on_selection: 1, item_price: 1, image: 1,category_ids:1}}).toArray().then(itemDetailsResult=>{
									callback(null, itemDetailsResult);
								}).catch(next);
							}).catch(next);
						}).catch(next);
					},
					deal_item_choice : (callback)=>{
						if(itemType != Constants.DEAL_ITEM) return callback(null,false);

						/** Check deal item have any extra item **/
						const item_group_extras	 = this.db.collection(Tables.ITEM_GROUP_EXTRAS);
						item_group_extras.countDocuments({
							item_id : 	itemId,
							$or		:	[
								{unit_id : {$exists: false} },
								{unit_id : ""},
							]
						}).then(contResult=>{
							let haveExtras = (contResult && contResult> 0) ? true :false;
							callback(null,haveExtras);
						}).catch(next);
					},
					cart_amount_details : (callback)=>{
						if(!userId && !deviceId) return callback(null,{})

						/** Get cart total */
						let cartOptions = {
							user_id 		: userId,
							device_id 		: deviceId,
							cart_total_only : true,
						};

						this.userCartAPI.getUserCartList(req,res,next,cartOptions).then(cartResponse=>{
							if(cartResponse.status != Constants.STATUS_SUCCESS) return callback(cartResponse);
							callback(null,cartResponse);
						}).catch(next);
					},
					cart_count : (callback)=>{
						if(!userId && !deviceId) return callback(null,0)

						/** Get cart count */
						this.userCartAPI.getCartCount(req,res,next).then(cartResponse=>{
							if(cartResponse.status != Constants.STATUS_SUCCESS) return callback(cartResponse);
							callback(null,cartResponse.count);
						}).catch(next);
					},
					attributes_details: (callback)=>{
						/** Check branch attributes details */
						const restaurant_branch_attributes = this.db.collection(Tables.RESTAURANT_BRANCH_ATTRIBUTES);
						restaurant_branch_attributes.find({
							branch_id		: branchId,
							restaurant_id 	: restaurantId,
							attribute_id	: {$in: [
								Constants.BRANCH_OFFERS_DOUBLE_CASHBACK_ATTRIBUTE_ID,
								Constants.BRANCH_OFFERS_CASHBACK_ATTRIBUTE_ID,
							]},
						},{projection:{attribute_id:1,value:1}}).toArray().then(attributeResult=>{

							let attributeList =  {};
							attributeResult.map(attributeData=>{
								attributeList[attributeData.attribute_id] = attributeData.value;
							});
							callback(attributeErr,attributeList);
						}).catch(next);
					},
					branch_calender_list  : (callback)=>{
						let currentTime 	=	parseFloat(Helpers.newDate("",Constants.SHIFT_TIME_FORMAT));
						let startDateTime 	= 	Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));
						let endDateTime 	= 	Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_END_DATE_FORMAT));

						/** Get branch open time */
						const restaurant_open_branches	= 	this.db.collection(Tables.RESTAURANT_OPEN_BRANCHES);
						restaurant_open_branches.find({
							branch_id		: 	branchId,
							created			:	{
								$gte: startDateTime, $lte: endDateTime,
							},
							type			: 	Constants.OPEN,
							restaurant_id	: 	restaurantId,
							$or : [
								{$or: [
									{$and : [
										{ from : {$gte: currentTime }},
										{ to   : {$lte: currentTime }}
									]},
									{$and : [
										{ to 	: {$gte: currentTime }},
										{ from 	: {$lte: currentTime }}
									]}
								]},
								{$or: [
									{
										to	:	{$gte: currentTime},
										$or : [
											{ from : {$gte: currentTime }},
										],
									}
								]}
							]
						}).toArray().then(openResult=>{
							if(openResult.length ==0) return callback(null,[]);

							let openTime	= 	0;
							let closeTime 	=	0;
							openResult.map((records,index)=>{
								let tmpOpenTime 	= 	records.from;
								let tmpCloseTime	=	records.to;

								if(index == 0){
									openTime	= 	tmpOpenTime;
									closeTime 	=	tmpCloseTime;
								}

								if(tmpOpenTime < openTime) 	 openTime	= 	tmpOpenTime;
								if(tmpCloseTime > closeTime) closeTime 	=	tmpCloseTime;
							});

							callback(null,[{open_time: openTime, close_time: closeTime, openResult: openResult }]);
						}).catch(next);
					},
				},(asyncErr, asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					let cartCount 			=	(asyncResponse.cart_count) ? asyncResponse.cart_count :0;
					let cartAmountDetails 	=	(asyncResponse.cart_amount_details) ? asyncResponse.cart_amount_details :{};
					let branchAttributesDetails= asyncResponse.attributes_details;
					let branchCalenderList	=	asyncResponse.branch_calender_list;

					/** Add favorite status  */
					itemResult.is_favorite =	(asyncResponse.favorite_details) ? Constants.FAVOURITE :Constants.UNFAVOURITE;

					/** Add cart details */
					itemResult.cart_details= (asyncResponse.cart_details) ?asyncResponse.cart_details :{};
					itemResult.cart_id 	= (asyncResponse.cart_details) ?asyncResponse.cart_details._id :"";
					itemResult.cart_qty	= (asyncResponse.cart_details) ?asyncResponse.cart_details.qty :"";

					let areaDetails 		= 	asyncResponse.area_details;
					let itemDoughList 		= 	asyncResponse.item_dough_list;
					let itemSelectorList 	=	asyncResponse.item_selector_list;
					let recommendedItemList =	asyncResponse.recommended_item_list;
					let upsellingItemList 	=	asyncResponse.upselling_item_list;
					if(itemUnitList.length >0){
						itemUnitList.map(records=>{
							let firstUnitId 	=	records._id;
							let unitPrice		=	records.price;
							let discountType	=	records.discount_type;
							let kfgSizeId		=	records.kfg_size_id;
							let discountValue	=	(records.discount_value) ?  parseFloat(records.discount_value) :0;

							if(unitPrice){
								let tmpPrice =	unitPrice;

								if(discountValue && discountType){
									if(discountType == DISCOUNT_BY_VALUE){
										let tmpDiscount= (tmpPrice>=discountValue) ? discountValue :tmpPrice;

										records.strikethrough_price = tmpPrice;
										records.price = Helpers.round(tmpPrice-tmpDiscount);
									}else{
										let tmpDiscount = 	(tmpPrice*discountValue)/100;

										records.strikethrough_price= tmpPrice;
										records.price = Helpers.round(tmpPrice-tmpDiscount);
									}
								}
							}

							if(itemDoughList.length >0){
								itemDoughList.map(doughData=>{
									let tempDoughId 	=	doughData._id;
									let doughParentMatch= 	false;
									let kfgDoughType	=	doughData.kfg_dough_type;

									if(doughData.parents.length >0){
										doughData.parents.map(doughParentId=>{
											if(String(doughParentId) == String(firstUnitId)) doughParentMatch = true;
										});
									}

									if(doughParentMatch){
										if(!records.dough_list) records.dough_list = [];

										let selectorList = [];
										if(itemSelectorList.length >0){
											itemSelectorList.map(selectorData=>{
												let selectorParentMatch	= 	false;
												let selectorDoughMatch	= 	false;
												let KfgMatched			= 	false;
												let kfgSelector			=	selectorData.kfg_selector;

												if(selectorData.parents.length >0){
													selectorData.parents.map(selectorParentId=>{
														if(String(selectorParentId) == String(firstUnitId)) selectorParentMatch = true;
													});
												}
												if(selectorData.dough_type_parents.length >0){
													selectorData.dough_type_parents.map(selectorDoughId=>{
														if(String(selectorDoughId) == String(tempDoughId)) selectorDoughMatch = true;
													});
												}

												if(!vGroupItemIds) KfgMatched = true;
												if(vGroupItemIds){
													vGroupItemIds.map(tmpData=>{
														if(tmpData.size == kfgSizeId && tmpData.dough_type == kfgDoughType && tmpData.selector == kfgSelector){
															KfgMatched = true
														}
													});
												}

												if(selectorParentMatch && selectorDoughMatch && KfgMatched){
													selectorList.push({
														_id 		:	selectorData._id,
														price 		:	selectorData.price,
														unit_name 	: 	selectorData.unit_name,
														item_unit_id: 	selectorData.item_unit_id,
														sorting		: 	selectorData.sorting,
													});
												}
											});
										}

										records.dough_list.push({
											_id 		:	tempDoughId,
											price 		:	doughData.price,
											unit_name 	: 	doughData.unit_name,
											item_unit_id: 	doughData.item_unit_id,
											selector_list: 	selectorList,
										});
									}
								});
							}
						});
					}
					let openingTime = (res.locals.settings["App.opening_time"]) ? res.locals.settings["App.opening_time"] : "";
					let closingTime = (res.locals.settings["App.closing_time"]) ? res.locals.settings["App.closing_time"] : "";

					/** Set branch time an open time */
					if(branchCalenderList.length >0){
						let tmpOpenTime = String(branchCalenderList[0].open_time.toFixed(Constants.ROUND_PRECISION)).replace(".",":");
						let tmpCloseTime = String(branchCalenderList[0].close_time.toFixed(Constants.ROUND_PRECISION)).replace(".",":");
						if(tmpOpenTime.length<=4)	tmpOpenTime		= 	"0"+tmpOpenTime;
						if(tmpCloseTime.length<=4) 	tmpCloseTime 	=	"0"+tmpCloseTime;

						openingTime	=	tmpOpenTime
						closingTime	=	tmpCloseTime;
					}

					let restaurantDetails = {
						minimum_order_limit :  	(areaDetails && areaDetails.minimum_order_limit) ? areaDetails.minimum_order_limit :"",
						has_offers 			:	(areaDetails && areaDetails.minimum_order_limit) ? areaDetails.minimum_order_limit :"",
					};
					let isCashback 			= 	0;
					let isDoubleCashback 	=	0;
					if(branchAttributesDetails){
						if(branchAttributesDetails[Constants.BRANCH_OFFERS_DOUBLE_CASHBACK_ATTRIBUTE_ID]){
							isDoubleCashback = parseInt(branchAttributesDetails[Constants.BRANCH_OFFERS_DOUBLE_CASHBACK_ATTRIBUTE_ID]);
						}
						if(branchAttributesDetails[Constants.BRANCH_OFFERS_CASHBACK_ATTRIBUTE_ID]){
							isCashback =  parseInt(branchAttributesDetails[Constants.BRANCH_OFFERS_CASHBACK_ATTRIBUTE_ID]);
						}
					}
					restaurantDetails.is_cashback 			=	 isCashback;
					restaurantDetails.is_double_cashback 	=	 isDoubleCashback

					/** Send success response */
					return resolve({
						status 			:	Constants.STATUS_SUCCESS,
						item_details 	: 	itemResult,
						item_unit_list 	: 	itemUnitList,
						item_image_url	:	Constants.ITEMS_FILE_URL,
						item_choice 	: 	(asyncResponse.item_choice_of_list) ? true :false,
						restaurant_details: restaurantDetails,
						open_time	: openingTime,
						close_time	: closingTime,
						recommended_item_list : recommendedItemList,
						upselling_item_list   : upsellingItemList,
						deal_item_choice   	: (asyncResponse.deal_item_choice) ? asyncResponse.deal_item_choice :false,
						total_amount 	: (cartAmountDetails.grand_total) ? cartAmountDetails.grand_total :0,
						total_discount 	: (cartAmountDetails.total_discount) ? cartAmountDetails.total_discount :0,
						cart_count 		: cartCount,
					});
				});
			});
        }).catch(next);
	};// end getItemDetails()

	/**
	 * Function to get item choice list
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getItemChoiceList (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 		=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let itemId		= 	(req.body.item_id) 			?	new ObjectId(req.body.item_id) 			:"";
            let unitId		= 	(req.body.unit_id) 			?	new ObjectId(req.body.unit_id) 			:"";
            let doughTypeId	= 	(req.body.dough_type_id)	?	new ObjectId(req.body.dough_type_id) 	:"";
            let selectorId	= 	(req.body.selector_id)		?	new ObjectId(req.body.selector_id) 		:"";
            let branchId	= 	(req.body.branch_id) 		?	new ObjectId(req.body.branch_id) 		:"";
            let restaurantId= 	(req.body.restaurant_id) 	?	new ObjectId(req.body.restaurant_id)	:"";

			/** Send error response **/
			if(!itemId || !restaurantId) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			/** Set item conditions **/
			let itemConditions = {
				_id				:	itemId,
				is_active		:	Constants.ACTIVE,
				restaurant_id	:	restaurantId,
			};

			/** Get item details */
			const items	 = this.db.collection(Tables.ITEMS);
			items.findOne(itemConditions,{projection: {item_type: 1}},(itemErr, itemResult)=>{
				if(itemErr) return next(itemErr);

				/** Send error response */
				if(!itemResult) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

				let itemType = itemResult.item_type;

				/** Set group conditions */
				let groupConditions = {
					item_id : 	itemId,
					$or 	:	[
						{$or:	[
							{unit_id : {$exists: false} },
							{unit_id : ""},
						]}
					]
				};

				/** Set unit wise conditions */
				if(unitId){
					let tempConditions = {unit_id : unitId };

					if(doughTypeId) tempConditions.dough_type_id	=	doughTypeId;
					if(selectorId) 	tempConditions.selector_id		= 	selectorId;

					groupConditions["$or"].push(tempConditions);

					if(itemType == Constants.DEAL_ITEM) groupConditions["$or"] =  [{$and:[tempConditions]}];
				}

				/** Get item group list */
				const item_group_extras = 	this.db.collection(Tables.ITEM_GROUP_EXTRAS);
				item_group_extras.aggregate([
					{$match:	groupConditions},
					{$lookup:	{
						from     : Tables.ITEM_EXTRA_MASTERS,
						let      : {itemExtraId : "$item_extra_id"},
						pipeline : [
							{$match : {
								$expr: {
									$and : [
										{$eq: ["$_id", "$$itemExtraId"]},
										{$eq: ["$is_active", Constants.ACTIVE]},
									]
								}
							}},
							{$lookup: {
								from 		: 	Tables.ITEM_UNITS_MASTERS,
								localField 	:	"extra_item_unit_id",
								foreignField: 	"_id",
								as 			: 	"extra_unit_detail"
							}},
							{$project: {
								name: 1, extra_fees: 1, order: 1, extra_item_unit_id: 1,
								extra_unit_name: {$arrayElemAt: ["$extra_unit_detail.name",0]}
							}},
						],
						as:	"extra_item_detail"
					}},
					{$match: {
						"extra_item_detail._id" : {$exists: true}
					}},
					{$addFields : {
						extra_item_order: {$ifNull: [ "$order", {$arrayElemAt: ["$extra_item_detail.order",0]} ] },
					}},
					{$sort : {extra_item_order : Constants.SORT_ASC }},
					{$group: {
						_id 			: "$group_id",
						extra_item_list : {$push : {
							_id				: "$_id",
							item_unit_id	: "$item_unit_id",
							extra_item_id	: {$arrayElemAt: ["$extra_item_detail._id",0]},
							extra_item_name	: {$arrayElemAt: ["$extra_item_detail.name",0]},
							extra_unit_name	: {$arrayElemAt: ["$extra_item_detail.extra_unit_name",0]},
							extra_fees		: {$ifNull: [ "$extra_fees", {$arrayElemAt: ["$extra_item_detail.extra_fees",0]} ] },
							extra_item_order: "$extra_item_order",
						}},
					}},
					{$lookup: {
						from 		: 	Tables.ITEM_CHOICES_GROUPS,
						localField 	:	"_id",
						foreignField: 	"_id",
						as 			: 	"group_detail"
					}},
					{$project :{
						_id : 1, extra_item_list: 1,
						group_name	 : {$arrayElemAt: ["$group_detail.name",0]},
						max_quantity : {$arrayElemAt: ["$group_detail.max_quantity",0]},
						min_quantity : {$arrayElemAt: ["$group_detail.min_quantity",0]},
						group_order	 : {$arrayElemAt: ["$group_detail.order",0]},
					}},
					{$sort : {group_order : Constants.SORT_ASC }},
				]).toArray().then(extraItemResult=>{

					/** Send success response */
					resolve({
						status:	Constants.STATUS_SUCCESS,
						result: extraItemResult
					});
				}).catch(next);
			}).catch(next);
        }).catch(next);
	};// end getItemChoiceList()

	/**
	 * Function to get branch payment method
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getPaymentMethods (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
            req.body 			= 	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
            let branchId		= 	(req.body.branch_id) 		? 	new ObjectId(req.body.branch_id) 	:"";
            let restaurantId	=	(req.body.restaurant_id)	?	new ObjectId(req.body.restaurant_id):"";

			/** Send error response **/
			if(!restaurantId || !branchId){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });
			}

			/** Get branch selected payment method list */
			const restaurant_branch_payment_methods = this.db.collection(Tables.RESTAURANT_BRANCH_PAYMENT_METHODS);
			restaurant_branch_payment_methods.aggregate([
				{$match		: {
					branch_id		: 	branchId,
					restaurant_id	:	restaurantId
				}},
				{$lookup: {
					from: Tables.PAYMENT_METHODS,
					let: {methods: '$payment_methods' },
					pipeline: [
						{$match: {
							$expr: {
								$in: ['$slug', '$$methods']
							}
						}},
						{$project: { _id :0, slug : 1,title : 1}}
					],
					as:'payment_methods'
				}},
				{$project : {
					payment_methods : 1
				}}
			]).toArray().then(result=>{

				/** Send success response */
				resolve({
					status			: Constants.STATUS_SUCCESS,
					payment_methods	: (result && result[0]) ? result[0].payment_methods :[]
				});
			}).catch(next);
		}).catch(next);
	};// end getPaymentMethods()
}// End Restaurant