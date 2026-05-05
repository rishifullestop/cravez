import { ObjectId } from 'mongodb';
import clone from 'clone';
import { parallel as asyncParallel } from 'async';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from '../../../../utils/index.mjs';
import {sendMailToUsers} from '../../../../services/index.mjs';
import orderModal from './order.mjs';
import { contactUsValidation } from '../validations/home.mjs';

export default class Home {
    constructor(db) {
        this.db = db;

		this.orderAPI  = new orderModal(db);
    }

	/**
	 * Function to get cms details
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getCmsDetails (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
            req.body 	    =	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
            let slug        = 	(req.body.slug) 		? 	req.body.slug 		 :"";
			let languageId	= 	(req.body.language_id) 	?	req.body.language_id :Constants.DEFAULT_LANGUAGE_MONGO_ID;

			/** Send error response **/
			if(!slug) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});

			/**Set condition  */
			let conditions = {slug : slug };
			conditions["pages_descriptions."+languageId+".language_id"] = languageId;

			/** Set fields */
			let projectionFields = { _id: 0};
			projectionFields["pages_descriptions."+languageId+".body"] = 1;
			projectionFields["pages_descriptions."+languageId+".name"] = 1;

            /**Get details from pages */
			const pages	= this.db.collection(Tables.PAGES);
            pages.findOne(conditions,{projection : projectionFields}).then(pageResult=>{

                /** Send error response */
				if(!pageResult) return resolve({status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access")});

				pageResult 		=	pageResult?.pages_descriptions?.[languageId] || {};
				pageResult.body = 	pageResult?.body?.replace(new RegExp('WEBSITE_IMG_URL/','g'),Constants.WEBSITE_IMG_URL) || "";

				/** Send success response **/
				resolve({status: Constants.STATUS_SUCCESS, result: pageResult});
            }).catch(next);
        }).catch(next);
	};// end getCmsDetails()

	/**
	 * Function is used to get site settings
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	*/
	async getSystemSettings (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
            req.body 	    =	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let keysArray	=  (req.body.settings) ? req.body.settings :  [];

			/**Check For keysArray */
			if(!keysArray) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});

			let settingsData	= {};
			if(keysArray.length > 0){
				keysArray.map(key =>{
					settingsData[key] = res?.locals?.settings?.[key] || '';
				});
			}

			/**Send success Response */
			return resolve({
				status 		: Constants.STATUS_SUCCESS,
				result 		: settingsData,
				file_path 	: Constants.SETTING_FILE_URL
			});
		}).catch(next);
	};// End getSystemSettings

	/**
	 * Function to get faq list
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getFaqList (req,res,next){
		return new Promise(resolve=>{
			/** Set condition for faqs */
			let conditions = {is_active : Constants.ACTIVE};

			let categoryId 		= req.body.category_id ? new ObjectId(req.body.category_id) : "";
			let subCategoryId 	= req.body.sub_category_id ? new ObjectId(req.body.sub_category_id) : "";

			if(categoryId) conditions.category_id 			= categoryId;
			if(subCategoryId) conditions.sub_category_id 	= subCategoryId;

			/**For get faq list */
			const faqs = this.db.collection(Tables.FAQS);
			faqs.aggregate([
				{$match : conditions},
				{$lookup:{
					"from"			: Tables.MASTERS,
					"localField" 	: "category_id",
					"foreignField"	: "_id",
					"as" 			: "category_details"
				}},
				{$lookup:{
					"from"			: Tables.MASTERS,
					"localField" 	: "sub_category_id",
					"foreignField"  : "_id",
					"as" 			: "sub_category_details"
				}},
				{$project:{
					_id:1,question:1,answer:1,created:1,
					category_name: {$arrayElemAt : ["$category_details.name",0]},
					sub_category_name: {$arrayElemAt : ["$sub_category_details.name",0]}
				}}
			]).sort({_id: Constants.SORT_DESC}).toArray().then(result=>{

				/** Send success response */
				resolve({status	: Constants.STATUS_SUCCESS, result: result});
			}).catch(next);
		}).catch(next);
	}// end getFaqList()

	/**
	 * Function to get all packages
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getAllPackages (req,res,next){
		return new Promise(resolve=>{
			/**For get all packages */
			const packages = this.db.collection(Tables.PACKAGES);
			packages.find({
				valid_from : { $lte : Helpers.getUtcDate()},
				valid_to   : { $gte : Helpers.getUtcDate()}
			},{projection: { _id: 1,amount:1,title:1,days:1,number_of_orders:1,days:1,tags:1,name:1}}).toArray().then(packagesResult=>{

				/** Send error response */
				if(!packagesResult) return resolve({status: Constants.STATUS_ERROR, message: res.__("admin.system.no_record_found")});

				/**Send success response */
				resolve({
					status	: Constants.STATUS_SUCCESS,
					result	: packagesResult,
					enable_infinity_package	: res?.locals?.settings?.["App.enable_infinity_package"] || ''
				});
			}).catch(next);
		}).catch(next);
	}// end getAllPackages()

	/**
	 * Function to add user favorites item
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async addUserFavoriteItem (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
            req.body 	    =	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
            let itemId  	= 	(req.body.item_id) 			? 	new ObjectId(req.body.item_id) 		:"";
            let userId  	= 	(req.body.user_id) 			? 	new ObjectId(req.body.user_id) 		:"";
			let branchId	=	(req.body.branch_id) 		?	new ObjectId(req.body.branch_id) 	:"";
			let areaId		=	(req.body.area_id) 			?	new ObjectId(req.body.area_id) 		:"";
			let restaurantId=	(req.body.restaurant_id) 	?	new ObjectId(req.body.restaurant_id):"";

			/** Send error response **/
			if(!itemId || !userId || !restaurantId || !branchId || !areaId) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});

			/** For get item details */
			const items = this.db.collection(Tables.ITEMS);
			items.findOne({
				_id 		: 	itemId,
				is_active 	:	Constants.ACTIVE,
			},{projection: { _id: 1}}).then(itemResult=>{

				/** Send error response */
				if(!itemResult) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

				/** For get user favorites details */
				const user_favorites = this.db.collection(Tables.USER_FAVORITES);
				user_favorites.findOne({ item_id : itemId, user_id: userId},{projection: { item_id: 1,user_id: 1}}).then(itemFavResult=>{

					if(itemFavResult) return resolve({status: Constants.STATUS_ERROR, message : res.__("admin.home.this_item_is_already_favourite")});

					/** Save user favorites details */
					user_favorites.updateOne({
						item_id: itemId,
						user_id: userId,
					},
					{
						$set: {
							modified: Helpers.getUtcDate()
						},
						$setOnInsert: {
							area_id 	  : areaId,
							branch_id 	  : branchId,
							restaurant_id : restaurantId,
							created 	  : Helpers.getUtcDate()
						}
					},{upsert: true}).then(()=>{

						/**Send success response */
						resolve({status: Constants.STATUS_SUCCESS, message: res.__("admin.home.user_favourite_item_has_been_added_successfully") });
					}).catch(next);
				}).catch(next);
			}).catch(next);
		}).catch(next);
	}// end addUserFavoriteItem()

	/**
	 * Function to delete user favorite item
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async deleteFavoriteItem (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
            req.body 	=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
            let itemId	=	(req.body.item_id) 	?	new ObjectId(req.body.item_id) :"";
            let userId  = 	(req.body.user_id)	? 	new ObjectId(req.body.user_id) :"";

			/** Send error response **/
			if(!itemId || !userId) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});

			/** delete user favorite item */
			const user_favorites = this.db.collection(Tables.USER_FAVORITES);
			user_favorites.deleteOne({
				item_id : itemId,
				user_id : userId
			}).then(()=>{

				/** Send success response */
				resolve({status	: Constants.STATUS_SUCCESS,message : res.__("admin.home.user_favourite_item_has_been_deleted_successfully")});
			}).catch(next);
		}).catch(next);
	}// end deleteFavoriteItem()

	/**
	 * Function to get user favorites item list
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getFavoriteItemList (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
            req.body 	=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId	=	(req.body.user_id) ? new ObjectId(req.body.user_id) :"";

			/** Send error response **/
			if(!userId) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			/** For get user favorites item details */
			const user_favorites = this.db.collection(Tables.USER_FAVORITES);
			user_favorites.aggregate([
				{$match : {user_id : userId}},
				{$lookup:{
					"from"			: Tables.ITEMS,
					"localField" 	: "item_id",
					"foreignField"	: "_id",
					"as" 			: "item_details"
				}},
				{$lookup:{
					"from"			: Tables.RESTAURANT_BRANCHES,
					"localField" 	: "branch_id",
					"foreignField"	: "_id",
					"as" 			: "branch_details"
				}},
				{$lookup:	{
					from     : Tables.RESTAURANT_BRANCH_AREAS,
					let      : {restaurantId : "$restaurant_id", branchId : "$branch_id", areaId : "$area_id"},
					pipeline : [
						{$match : {
							$expr: {
								$and : [
									{$eq: ["$restaurant_id", "$$restaurantId"]},
									{$eq: ["$branch_id", "$$branchId"]},
									{$eq: ["$area_id", "$$areaId" ]},
								]
							}
						}},
						{$project : {
							delivery_fees: 1, delivery_time: 1, open: 1, delivery_by: 1, trends : 1, area_id: 1, accept_pickup_orders: 1, accept_scheduling_orders: 1
						}},
					],
					as	:	"area_details"
				}},
				{$match : {
					"area_details._id" 		:	{$exists :true},
					"branch_details._id"	:	{$exists :true},
				}},
				{$project:{
					_id: 0, restaurant_id: 1, branch_id: 1, area_id: 1, item_id: 1,
					is_open				: 	{$arrayElemAt: ["$branch_details.is_open",0]},
					delivery_by			: 	{$arrayElemAt: ["$area_details.delivery_by",0]},
					delivery_time		: 	{$arrayElemAt: ["$area_details.delivery_time",0]},
					delivery_fees		: 	{$arrayElemAt: ["$area_details.delivery_fees",0]},
					minimum_order_amount: 	{$arrayElemAt: ["$area_details.minimum_order_amount",0]},
					item_name			:	{$arrayElemAt: ["$item_details.name",0]},
					item_image			:	{$arrayElemAt: ["$item_details.image",0]},
					item_price			:	{$arrayElemAt: ["$item_details.item_price",0]},
					price_on_selection	:	{$arrayElemAt: ["$item_details.price_on_selection",0]},
				}}
			]).toArray().then(userFavoriteItemResult=>{

				/**Send success response */
				if(userFavoriteItemResult.length <=0) return resolve({
					status				: 	Constants.STATUS_SUCCESS,
					result				:	userFavoriteItemResult,
					restaurant_image_url:	Constants.RESTAURANT_FILE_URL,
					item_image_url		:	Constants.ITEMS_FILE_URL,
				});

				/** Push restaurant id in a array */
				let restaurantIds = [];
				userFavoriteItemResult.map(records=>{
					restaurantIds.push(records.restaurant_id);
				});

				/** For get restaurant details */
				const restaurants = this.db.collection(Tables.RESTAURANTS);
				restaurants.find({_id: {$in:restaurantIds},is_deleted:Constants.NOT_DELETED },{projection: { _id: 1,name:1,image:1}}).toArray().then(restaurantResult=>{

					/** Push item details according to the restaurant id */
					restaurantResult.map(restaurantRecords=>{
						userFavoriteItemResult.map(favRecords=>{
							if(restaurantRecords._id.toString() == favRecords.restaurant_id.toString()){
								if(!restaurantRecords.items) restaurantRecords.items = [];

								/** Push item details */
								restaurantRecords.items.push({
									item_id			 	:	favRecords.item_id,
									item_name 			:	favRecords.item_name,
									item_image 			:	favRecords.item_image,
									item_price 			: 	favRecords.item_price,
									price_on_selection 	:	favRecords.price_on_selection,
								});

								restaurantRecords.branch_id				=	favRecords.branch_id,
								restaurantRecords.area_id			 	=	favRecords.area_id,
								restaurantRecords.delivery_by           =	favRecords.delivery_by;
								restaurantRecords.delivery_time         =	favRecords.delivery_time;
								restaurantRecords.delivery_fees         =	favRecords.delivery_fees;
								restaurantRecords.minimum_order_amount  =	favRecords.minimum_order_amount;
								restaurantRecords.is_open =	(favRecords.is_open)? favRecords.is_open :Constants.CLOSE;
							}
						});
					});

					/** Send success response */
					resolve({
						status				: 	Constants.STATUS_SUCCESS,
						result				:	restaurantResult,
						restaurant_image_url:	Constants.RESTAURANT_FILE_URL,
						item_image_url		:	Constants.ITEMS_FILE_URL,
					});
				}).catch(next);
			}).catch(next);
		}).catch(next);
	}// end getFavoriteItemList()

	/**
	 * Function to get slider images
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getSliderImages (req,res,next){
		return new Promise(resolve=>{
			let type 		= 	(req.body.type) ? req.body.type : "";
			let currentDay 	= 	parseInt(Helpers.newDate().getDay());
			let currentTime = 	parseFloat(Helpers.newDate("",TIME_FORMAT));
			let userId		= 	(req.body.user_id)	? 	new ObjectId(req.body.user_id) 		:"";
			let version		=	(req.body.version)	?	parseFloat(req.body.version)	:"";

			/** Send error response **/
			if(!type) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			/**For check type */
			if(type != Constants.SPLASH_SCREEN) return resolve({status : Constants.STATUS_ERROR, message : res.__("admin.system.invalid_access")});

			const sliders = this.db.collection(Tables.SLIDERS);
			asyncParallel({
				get_default : (callback)=>{
					sliders.find({
						status: Constants.ACTIVE,
						type: type,
						$or : [
							{is_default : true},
							{is_default : {$exists: false}},
						]
					},{projection: { _id:1,description:1,image:1}}).toArray().then(defaultResult=>{
						callback(null,defaultResult);
					}).catch(next);
				},
				get_match : (callback)=>{
					sliders.find({
						status: Constants.ACTIVE,
						type: type,
						'$and': [
							{"time_details.day"   : {$eq : currentDay }},
							{$or: [
								{$and : [
									{"time_details.start_time" : {$gte : currentTime }},
									{"time_details.end_time"   : {$lte : currentTime }}
								]},
								{$and : [
									{"time_details.end_time"   : {$gte : currentTime }},
									{"time_details.start_time" : {$lte : currentTime }}
								]}
							]},
						]
					},{projection: { _id:1,description:1,image:1}}).toArray().then(result=>{
						callback(null,result);
					}).catch(next);
				},
				user_details : (callback)=>{
					if(!userId) return callback(null,null);

					/** Set customer conditions **/
					let userConditions 	= 	{_id: userId, ...Constants.CUSTOMER_COMMON_CONDITIONS};

					/** Get user details **/
					const users	= this.db.collection(Tables.USERS);
					users.findOne(userConditions,{projection: {_id :1,package_id:1}}).then(result=>{
						callback(null,result);
					}).catch(next);
				},
				order_details : (callback)=>{
					if(!userId) return callback(null,null);

					/** Get order details */
					const orders = this.db.collection(Tables.ORDERS);
					orders.findOne({
						customer_id 	: new ObjectId(userId),
						delay_voc_status: Constants.PENDING,
					}, {projection: {_id:1,unique_order_id:1},sort:{voc_sent_time:Constants.SORT_DESC}}).then(result=>{
						callback(null,result);
					}).catch(next);
				},
			},(asyncErr,asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				let defaultMatch =	(asyncResponse.get_default) ? asyncResponse.get_default : [];
				let exactMatch	 =	(asyncResponse.get_match)   ? asyncResponse.get_match   : [];
				let orderDetails =	(asyncResponse.order_details)? asyncResponse.order_details :{};
				let userDetails  =  asyncResponse.user_details;
				let appVersion 	 =  (res.locals.settings["App.version"]) ? parseFloat(res.locals.settings["App.version"]) :'';
				let forceArMessage=  (res.locals.settings["App.force_update_ar_message"]) ? res.locals.settings["App.force_update_ar_message"] :'';
				let forceEngMessage=  (res.locals.settings["App.force_update_eng_message"]) ? res.locals.settings["App.force_update_eng_message"] :'';

				/** Send success response **/
				resolve({
					status 				: Constants.STATUS_SUCCESS,
					slider_image_url 	: Constants.SLIDER_URL,
					result 				: (exactMatch.length > 0) ? exactMatch :defaultMatch,
					is_user_deleted 	: (userId && !userDetails) ? true : false,
					infinity_service 	: (userDetails && userDetails.package_id) ? true : false,
					force_update 		: (version !== appVersion) ? true : false,
					voc_order_id 		: (orderDetails._id) ? orderDetails._id :"",
					voc_unique_order_id	: (orderDetails.unique_order_id)? orderDetails.unique_order_id :"",
					force_update_message: {ar: forceArMessage, en: forceEngMessage}
				});
			});
		}).catch(next);
	}// end getSliderImages()

	/**
	 * Function to get city list
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getCityList (req,res,next){
		return new Promise(resolve=>{
			/** For get city list */
			const cities = this.db.collection(Tables.CITIES);
			cities.find({},{projection: { _id:1,name:1}}).toArray().then(cityResult=>{

				/** Send success response */
				resolve({status	: Constants.STATUS_SUCCESS, result: cityResult});
			}).catch(next);
		}).catch(next);
	}// end getCityList()

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
			let cityId = (req.body.city_id) ? req.body.city_id :"";

			/** Send error response **/
			if(!cityId) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});

			/** For get area list */
			const areas = this.db.collection(Tables.AREAS);
			areas.find({city_id: new ObjectId(cityId), is_active: Constants.ACTIVE},{projection: { _id:1,name:1}}).toArray().then(areaResult=>{

				/**Send success response */
				resolve({status	: Constants.STATUS_SUCCESS, result: areaResult});
			}).catch(next);
		}).catch(next);
	}// end getAreaList()

	/**
	 * Function to get block list
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getBlockList (req,res,next){
		return new Promise(resolve=>{
			let areaId = (req.body.area_id) ? req.body.area_id : "";

			/** Send error response **/
			if(!areaId) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});

			/** For get block list */
			const area_blocks = this.db.collection(Tables.AREA_BLOCKS);
			area_blocks.find({area_id: new ObjectId(areaId), is_active: Constants.ACTIVE},{projection: { _id:1,name:1}}).toArray().then(blockResult=>{

				/**Send success response */
				resolve({status	: Constants.STATUS_SUCCESS, result: blockResult});
			}).catch(next);
		}).catch(next);
	}// end getBlockList()

	/**
	 * Function to get cuisines list
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getCuisinesList (req,res,next){
		return new Promise(resolve=>{
			req.body 		=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let cuisineName	= 	(req.body.name) ? req.body.name :"";

			/** Set conditions */
			let cuisineConditions = { is_active: Constants.ACTIVE};
			if(cuisineName){
				let searchValue = Helpers.cleanRegex(cuisineName);
				cuisineConditions["$or"] = [
					{"name.en" : { $regex: new RegExp('^' + searchValue, 'i') } },
					{"name.ar" : { $regex: new RegExp('^' + searchValue, 'i') } },
				];
			}

			/** Get cuisine list  */
			const cuisines = this.db.collection(Tables.CUISINES);
			cuisines.aggregate([
				{$match 	: cuisineConditions},
				{$project : {_id:1, name: 1, order:1 }},
				{$group : {
					_id 		: null,
					max_order 	: {$max : "$order"},
					data		: {$push :{
						_id 	: "$_id",
						name 	: "$name",
						order 	: "$order"
					}},
				}},
				{$unwind : "$data"},
				{$project :{
					_id : "$data._id", name: "$data.name", order: {$ifNull: ["$data.order", {$add: [ "$max_order", 1]}] }
				}},
				{$sort : {"order": Constants.SORT_ASC, "name.en": Constants.SORT_ASC} }
			]).toArray().then(cuisineResult=>{

				/** Send success */
				resolve({status: Constants.STATUS_SUCCESS, result: cuisineResult});
			}).catch(next);
		}).catch(next);
	}// end getCuisinesList()

	/**
	 * Function to get area Id
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getAreaId (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
            req.body = Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
            let name = (req.body.name) ? req.body.name :"";

			/** Send error response **/
			if(!name) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			/**Set condition  */
			let conditions = {
				"$or": [
					{ "name.en" : {$regex : new RegExp(name, "i")} },
					{ "name.ar" : {$regex : new RegExp(name, "i")} }
				]
			};

		    /**Get details from pages */
			const areas	= this.db.collection(Tables.AREAS);
            areas.findOne(conditions,{projection : {_id: 1, name:1}}).then(areaResult=>{

                /** Send error response */
				if(!areaResult) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.no_record_found")});

				/** Send success response **/
				resolve({status	: Constants.STATUS_SUCCESS, result: areaResult});
            }).catch(next);
        }).catch(next);
	};// end getAreaId()

	/**
	 * Function to get master list
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getMasterList (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
            req.body 	= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let options = clone(req.body);
			let type 	= options.type ? options.type : "";

			/** Send error response **/
			if(!type) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});

			options.type = [type];
			Helpers.getMasterList(req,res,next,options).then(masterRes=>{
				if(masterRes.status == Constants.STATUS_ERROR) return resolve(masterRes);

				let masterData = masterRes?.result?.[type] || [];

				masterData = Helpers.convertDataToMultiLanguage(req,res,{ result : masterData, description_field: "master_descriptions", field: "name" });

				/** Send success response **/
				resolve({status	: Constants.STATUS_SUCCESS,result: masterData});
			}).catch(next);
        }).catch(next);
	};// end getMasterList()

	/**
	 * Function to purchase package
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async purchasePackage (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
            req.body 			= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
            let userId 			= (req.body.user_id) ? new ObjectId(req.body.user_id) :"";
            let friendId		= (req.body.friend_user_id) ? new ObjectId(req.body.friend_user_id) :"";
            let packageId 		= (req.body.package_id) ? new ObjectId(req.body.package_id) :"";
            let paymentResponse = (req.body.payment_response) ? req.body.payment_response :"";
            let paymentMethod 	= (req.body.payment_method) ? req.body.payment_method :"";
            let transactionId	= (paymentResponse && paymentResponse.InvoiceTransactions && paymentResponse.InvoiceTransactions[0]) ? paymentResponse.InvoiceTransactions[0].TransactionId : '';

            /** Send error response **/
			if(!packageId || !userId || !paymentResponse || !paymentMethod) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access"),missing_fields:["package_id","payment_response","payment_method","user_id"]});

            const packages	=	this.db.collection(Tables.PACKAGES);
            const users		=	this.db.collection(Tables.USERS);
            packages.findOne({ _id : packageId},{projection : { amount : 1, days:1, number_of_orders:1}}).then(packageResult=>{

                /** Send error response */
				if(!packageResult) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

				let amount				=	(packageResult.amount) ? packageResult.amount : 0;
				let noOfOrders			=	(packageResult.number_of_orders) ? packageResult.number_of_orders : "";
				let days				=	(packageResult.days) ? packageResult.days : 0;
				let packageValidTill	=	Helpers.newDate(Helpers.addDaysToDate(days*Constants.HOURS_IN_A_DAY),Constants.DATABASE_DATE_FORMAT+' '+Constants.END_DATE_TIME_FORMAT);

				let paymentOptions = {
					user_id 		: userId,
					payment_response: paymentResponse,
					payment_method	: paymentMethod,
					payment_status	: Constants.PAYMENT_SUCCESS,
					currency		: Constants.CURRENCY_SYMBOL,
					amount 			: amount,
					payment_event	: Constants.PACKAGE_PURCHASE_PAYMENT_EVENT,
				};

				this.orderAPI.saveUserPaymentDetails(req,res,next,paymentOptions).then(paymentResponse=>{
					if(paymentResponse.status == Constants.STATUS_ERROR) return next(paymentResponse);

					let invoiceNumber	=	paymentResponse.invoice_number;
					let paymentId		=	new ObjectId(paymentResponse.payment_id);

					asyncParallel({
						package_purchase : (callback)=>{
							if(friendId) return callback(null,null);

							let purchaseOptions	=	{
								user_id 		 : userId,
								amount 			 : amount,
								number_of_orders : noOfOrders,
								valid_till 		 : Helpers.getUtcDate(packageValidTill),
								package_id 		 : packageId,
								payment_id		 : paymentId
							};

							/** To save purchased package detail */
							this.packagePurchased(req,res,next,purchaseOptions).then(packageResponse=>{
								if(packageResponse.status == Constants.STATUS_ERROR) return resolve(packageResponse);
								callback(null,null);
							}).catch(next);
						},
						save_package : (callback)=>{
							if(!friendId) return callback(null,null);

							/** To save package request detail if purchased for friend */
							let insertData	=	{
								user_id		:	friendId, // for whom package has been purchased
								friend_id	:	userId,  // purchaser of package
								package_id	:	packageId,
								amount		:	amount,
								valid_till	:	Helpers.getUtcDate(packageValidTill),
								number_of_orders : noOfOrders,
								status		:	Constants.PACKAGE_REQUEST_PENDING,
								payment_id	: 	paymentId,
								created		: 	Helpers.getUtcDate(),
								modified	: 	Helpers.getUtcDate()
							};

							const package_requests	=	this.db.collection(Tables.PACKAGE_REQUESTS);
							package_requests.insertOne(insertData).then(insertResult=>{
								callback(null,insertResult);
							}).catch(next);
						},
						update_user: (callback)=>{
							/** To update user package details */
							if(friendId) return callback(null,null);

							users.updateOne({
								_id	: userId,
							},
							{$set: {
								package_id 	: packageId,
								remaining_package_orders : noOfOrders,
								package_valid_till : Helpers.getUtcDate(packageValidTill),
								remaining_package_days : days,
								package_status: Constants.PACKAGE_RUNNING
							}}).then(()=>{
								callback(null);
							}).catch(next);
						},
						user_data: (callback)=>{
							/** To find user details */
							users.findOne({_id : userId},{projection: {_id:1,full_name:1,email:1}}).then(result=>{
								callback(null,result);
							}).catch(next);
						}
					},(asyncErr,asyncResponse)=>{
						if(asyncErr) return next(asyncErr);

						let savePackageResult =	(asyncResponse.save_package) ? asyncResponse.save_package :{};
						let packageRequestId  = (savePackageResult.insertedId) ? savePackageResult.insertedId:"";
						let userDetail		  =	(asyncResponse.user_data) ? asyncResponse.user_data : '';
						packageValidTill 	  = (packageValidTill) ? Helpers.newDate(packageValidTill,Constants.DATE_FORMAT_EMAIL) : '';
						noOfOrders			  =	(noOfOrders)	?	noOfOrders : Constants.PACKAGE_UMLIMITED;

						if(userDetail){
							let fullName	=	userDetail.full_name;
							let email		=	userDetail.email;
							let repArray	=	[fullName,Helpers.currencyFormat(amount),transactionId,invoiceNumber,packageValidTill,noOfOrders];
							/*************** Send Mail  ***************/
							sendMailToUsers(req,res,{
								event_type 			: Constants.PACKAGE_PURCHASE_MAIL,
								email				: email,
								rep_array			: repArray
							});
						}

						/** Send success response **/
						resolve({status	: Constants.STATUS_SUCCESS, message : res.__("home.package_purchased_successfully")});

						/** To notify friend about the package */
						if(friendId){
							/*************** Send Mail  ***************/
							sendMailToUsers(req,res,{
								event_type 			: Constants.NOTIFICATION_PURCHASE_PACKAGE,
								amount				: Helpers.currencyFormat(amount),
								transfer_to     	: friendId,
								package_id			: packageId,
								package_request_id  : packageRequestId,
							});
						}
					});
				}).catch(next);
			}).catch(next);
		}).catch(next);
	}; // end purchasePackage()

	/**
	 * Function to validate phone number
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	async validateMobileNumber (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data */
			req.body 			= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let mobileNumber 	= (req.body.mobile_number) 	? req.body.mobile_number	:"";

			/** Send error response */
			if(!mobileNumber) return resolve({status : Constants.STATUS_ERROR, message	: res.__("system.invalid_access"),missing_fields:["mobile_number"]});

			let conditions	= {
				mobile_number : mobileNumber,
				is_guest : {$eq: null},
				...Constants.CUSTOMER_COMMON_CONDITIONS
			};

			/** Get user details **/
			const users = this.db.collection(Tables.USERS);
			users.findOne(conditions,{projection: {_id:1}}).then(result=>{

				/** Send error response */
				if(!result) return resolve({status : Constants.STATUS_ERROR,message : res.__("home.mobile_number_not_exist")});

				/** Send success response **/
				resolve({
					status 	: Constants.STATUS_SUCCESS,
					user_id	: result?._id || "",
					message	: res.__("home.your_mobile_number_verified"),
				});
			}).catch(next);
		}).catch(next);
	};//End validateMobileNumber()

	/**
	 * Function to get pending request list
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getPendingPackageRequestList (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data */
			req.body 	= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId 	= (req.body.user_id) 	? new ObjectId(req.body.user_id)	:"";

			/** Send error response */
			if(!userId) return resolve({status : Constants.STATUS_ERROR, message: res.__("system.invalid_access"),missing_fields:["user_id"]});

			/** For get package requests details */
			const package_requests = this.db.collection(Tables.PACKAGE_REQUESTS);
			package_requests.aggregate([
				{$match : {
					user_id: userId,
					status : Constants.PACKAGE_REQUEST_PENDING
				}},
				{$lookup:{
					"from"			: Tables.PACKAGES,
					"localField" 	: "package_id",
					"foreignField"	: "_id",
					"as" 			: "package_details"
				}},
				{$lookup:{
					"from"			: Tables.USERS,
					"localField" 	: "friend_id",
					"foreignField"	: "_id",
					"as" 			: "user_details"
				}},
				{$project:{
					_id: 1,amount:1,created:1,
					package_name: {$arrayElemAt : ["$package_details.title",0]},
					number_of_orders: {$arrayElemAt : ["$package_details.number_of_orders",0]},
					friend_name: {$arrayElemAt : ["$user_details.full_name",0]},
					friend_number: {$arrayElemAt : ["$user_details.mobile_number",0]}
				}}
			]).toArray().then(packageResult=>{

				if(packageResult.length > 0){
					packageResult.map(records=>{
						records.number_of_orders	=	(records.number_of_orders) ? records.number_of_orders : Constants.PACKAGE_UMLIMITED;
					});
				}

				/**Send success response */
				resolve({status	: Constants.STATUS_SUCCESS, result: packageResult});
			}).catch(next);
		}).catch(next);
	}// end getPendingPackageRequestList()

	/**
	 * Function to accept/reject pending package
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async acceptRejectPackage (req,res,next){
		return new Promise(resolve=>{

			/** Sanitize Data */
			req.body 			= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let requestId 		= (req.body.request_id) 	? new ObjectId(req.body.request_id)	:"";
			let userId 			= (req.body.user_id) 		? new ObjectId(req.body.user_id)	:"";
			let status 			= (req.body.status) 		? req.body.status		:"";

			/** Send error response */
			if(!requestId || !userId || !status) return resolve({status : Constants.STATUS_ERROR, message	: res.__("system.invalid_access"),missing_fields:["request_id","status","user_id"]});

			if(!Constants.PACKAGE_REQUEST_STATUS_OBJECT[status]) return resolve({status : Constants.STATUS_ERROR, message	: res.__("system.invalid_access")});

			const package_requests = this.db.collection(Tables.PACKAGE_REQUESTS);
			package_requests.findOneAndUpdate({
				_id 		: 	requestId,
				user_id		:	userId
			},
			{
				$set : {
					status 		: status,
					modified 	: Helpers.getUtcDate(),
				},
				$unset: {
					payment_id : 1
				}
			},{projection :{_id:1,number_of_orders: 1,valid_till:1,package_id:1,friend_id:1,amount:1,payment_id:1}}).then(packageResult=>{

				if(!packageResult) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});

				let currentDate			= Helpers.newDate("",Constants.DATABASE_DATE_FORMAT);
				let packageId			= (packageResult.package_id) ? packageResult.package_id : "";
				let noOfOrders			= (packageResult.number_of_orders) ? packageResult.number_of_orders : "";
				let packageValidTill	= (packageResult.valid_till) ? Helpers.newDate(packageResult.valid_till,Constants.DATABASE_DATE_FORMAT) : '';
				let friendId			= (packageResult.friend_id) ? packageResult.friend_id : '';
				let amount				= (packageResult.amount) ? packageResult.amount : 0;
				let paymentId			= (packageResult.payment_id) ? packageResult.payment_id : '';
				let remainingDays		= (packageValidTill) ? (Helpers.getDifferenceBetweenTwoDatesInMinute(currentDate,packageValidTill))/(Constants.MINUTES_IN_A_HOUR*Constants.HOURS_IN_A_DAY) : 0;
				let packageValidTillTIME= (packageResult.valid_till) ? Helpers.getUtcDate(Helpers.newDate(packageResult.valid_till,Constants.DATABASE_DATE_FORMAT+' '+Constants.END_DATE_TIME_FORMAT)) : '';

				asyncParallel({
					update_user : (callback)=>{
						if(status != Constants.PACKAGE_REQUEST_ACCEPTED) return callback(null,null);

						/**For get faq details */
						const users = this.db.collection(Tables.USERS);
						users.findOneAndUpdate({
							_id	: userId,
						},
						{$set: {
							package_id : packageId,
							remaining_package_orders : noOfOrders,
							package_valid_till : packageValidTillTIME,
							remaining_package_days : Helpers.round(remainingDays,0),
							package_status: Constants.PACKAGE_RUNNING
						}},{projection : {full_name:1,email:1}}).then(userResult => {
							callback(null,userResult);
						}).catch(next);
					},
					package_purchase : (callback)=>{
						if(status != Constants.PACKAGE_REQUEST_ACCEPTED) return callback(null,null);

						let purchaseOptions	=	{
							user_id 		 : userId,
							friend_id		 : friendId,
							amount 			 : amount,
							number_of_orders : noOfOrders,
							valid_till 		 : packageValidTillTIME,
							package_id 		 : packageId,
							payment_id		 : paymentId
						};

						this.packagePurchased(req,res,next,purchaseOptions).then(packageReponse=>{
							if(packageReponse.status == Constants.STATUS_ERROR) return resolve(packageReponse);
							callback(null,null);
						}).catch(next);
					},
					payment_transaction : (callback)=>{
						if(status != Constants.PACKAGE_REQUEST_REJECTED || !paymentId) return callback(null,null);

						const payment_transactions	=	this.db.collection(Tables.PAYMENT_TRANSACTIONS);
						payment_transactions.findOne({_id : paymentId},{projection : {transaction_id:1,payment_response:1}}).then(payResult => {

							let transactionId	=	(payResult.transaction_id) ? payResult.transaction_id : '';
							let paymentResponse	=	(payResult.payment_response) ? JSON.parse(payResult.payment_response) : {};
							let paymentGateway	=	(paymentResponse.InvoiceTransactions && paymentResponse.InvoiceTransactions[0]) ? paymentResponse.InvoiceTransactions[0].PaymentGateway : '';

							let refundOptions	=	{
								user_id 		 : userId,
								amount 			 : amount,
								package_id		 : packageId,
								payment_type	 : Constants.PACKAGE_REFUND_PAYMENT,
								refund_activity_type :Constants.REFUND_PACKAGE_REJECT,
								refund_detail	 : [{
									transaction_id	 : transactionId,
									type	:	paymentGateway,
									amount 	:   amount,
								}]
							};

							Helpers.refundAmount(req,res,next,refundOptions).then(refundResponse=>{
								if(refundResponse.status == Constants.STATUS_ERROR) return resolve(refundResponse);
								callback(null,null);
							}).catch(next);
						}).catch(next);
					},
				},(asyncErr,asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					let userDetail	=	asyncResponse?.update_user || {};
					let fullName	=	(userDetail.full_name) ? userDetail.full_name : '';
					let email		=	(userDetail.email) ? userDetail.email : '';
					packageValidTill=	(packageValidTill) ? Helpers.newDate(packageValidTill,Constants.DATE_FORMAT_EMAIL) : '';

					if(status == Constants.PACKAGE_REQUEST_ACCEPTED){
						let repArray	=	[fullName,packageValidTill];
						/*************** Send Mail  ***************/
						sendMailToUsers(req,res,{
							event_type 			: Constants.PACKAGE_ACCEPT_MAIL,
							email				: email,
							rep_array			: repArray
						});
					}

					/*************** Send Mail  ***************/
					sendMailToUsers(req,res,{
						event_type 			: Constants.NOTIFICATION_PURCHASE_PACKAGE_STATUS,
						package_id			: packageId,
						status				: status,
						user_id     		: friendId
					});

					/*************** Send Mail  ***************/

					/**Send success response */
					let message	=	(status == Constants.PACKAGE_REQUEST_ACCEPTED) ? res.__("home.request_accepted_successfully") : res.__("home.request_rejected_successfully");
					resolve({status	: Constants.STATUS_SUCCESS,message	: message});
				});
			}).catch(next);
		}).catch(next);
	}// end acceptRejectPackage()

	/**
	 * Function to manage package purchased
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 * @param options As data object
	 *
	 * @return json
	**/
	async packagePurchased (req,res,next,options={}){
		return new Promise(resolve=>{
			let userId		=	(options.user_id) ? new ObjectId(options.user_id) : '';
			let friendId	=	(options.friend_id) ? new ObjectId(options.friend_id) : '';
			let packageId	=	(options.package_id) ? new ObjectId(options.package_id) : '';
			let paymentId	=	(options.payment_id) ? new ObjectId(options.payment_id) : '';
			let amount		=	(options.amount) ? options.amount : '';
			let validTill	=	(options.valid_till) ? options.valid_till : '';
			let noOfOrders	=	(options.number_of_orders) ? options.number_of_orders : '';

			/** Send error response **/
			if(!packageId || !userId || !amount || !validTill) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access"),missing_fields:["package_id","valid_till","amount","user_id"]});

			let insertData	=	{
				user_id		:	userId,
				package_id	:	packageId,
				payment_id	:	paymentId,
				amount		:	parseFloat(amount),
				valid_till	:	validTill,
				number_of_orders : noOfOrders,
				created		: 	Helpers.getUtcDate(),
				modified	: 	Helpers.getUtcDate(),
			};
			if(friendId) insertData['friend_id'] = friendId;

			const package_purchases = this.db.collection(Tables.PACKAGE_PURCHASES);
			package_purchases.insertOne(insertData).then(()=>{
                resolve({
					status	:	Constants.STATUS_SUCCESS
				});
			}).catch(next);
		}).catch(next);
	} // End packagePurchased

	/**
	 * Function to save User Contact Details
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async contactUs (req, res,next){
		return new Promise(async resolve=>{
			/** Sanitize Data **/
			req.body 	= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId 	= (req.body.user_id) ? new ObjectId(req.body.user_id)	:"";

			/** Apply validation */
			let validationResponse = await Helpers.applyValidationInterCallFunction(req, res, next, contactUsValidation);
			if(validationResponse.status != Constants.STATUS_SUCCESS) return resolve(validationResponse);

			asyncParallel({
				user_details : (callback)=>{
					if(!userId) return callback(null,null);

					/**For get user details */
					const users	= this.db.collection(Tables.USERS);
            		users.findOne({ _id : userId},{projection : {email:1}}).then(userResult=>{
						callback(null,userResult);
					}).catch(next);
				},
			},(asyncErr,asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				let userResult = asyncResponse.user_details ? asyncResponse.user_details : {};
                let email 	   = userResult.email 			? userResult.email 			 : "";

				/** Set insert data in a object */
				let insertAbleData = {
					name 		: req.body.name,
                    phone 		: req.body.mobile_number,
                    message 	: req.body.message,
                    email       : email,
                    modified 	: Helpers.getUtcDate(),
                    created 	: Helpers.getUtcDate(),
				};

				if(userId) insertAbleData.user_id = userId;

                /** Insert contacts details */
                const contacts = this.db.collection(Tables.CONTACTS);
                contacts.insertOne(insertAbleData).then(()=>{

                    /** Send success response **/
                    resolve({
                        status	: Constants.STATUS_SUCCESS,
                        message : res.__("contact_us.contact_has_been_saved_successfully"),
                    });

                    /** Send Mail To Admin */
                    sendMailToUsers(req,res,{
                        event_type 	: Constants.USER_CONTACT_US_EVENTS,
                        name		: req.body.name,
                        email 		: email,
                        phone 		: req.body.mobile_number,
                        message 	: req.body.message,
                    });
                }).catch(next);
			});
		}).catch(next);
	};//End contactUs()

	/**
	 * Function to get area Id form lat long
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getAreaIdByLatLong (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
            req.body 		= 	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
            let location	= 	(req.body.location) ? 	req.body.location	:"";

			/** Send error response **/
			if(!location || !location.results || location.results.length <=0){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});
			}

			/** Get area name  */
			let areaName = "";
			location.results.map(records=>{
				if(records.address_components){
					records.address_components.map(data=>{
						if(!areaName && data.types && data.types.length >0 && data.types.indexOf("locality") != -1){
							areaName = data.long_name;
						}
					});
				}
			});

			/** Send error response **/
			if(!areaName){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("home.not_able_to_get_area_details"), location: location });
			}

			/**Set condition  */
			let conditions = {
				is_active : Constants.ACTIVE,
				"$or": [
					{ "name.en" : {$regex : '^'+areaName+'$', '$options' : 'i'} },
					{ "name.ar" : {$regex : '^'+areaName+'$', '$options' : 'i'} }
				]
			};

			/** Get area details  */
			const areas	= this.db.collection(Tables.AREAS);
			areas.findOne(conditions,{projection : {_id: 1, name:1}}).then(areaResult=>{

				/** Send error response */
				if(!areaResult) return resolve({status: Constants.STATUS_ERROR, message: res.__("home.not_able_to_get_area_details") });

				/** Send success response */
				resolve({
					status		: 	Constants.STATUS_SUCCESS,
					area_id		: 	areaResult._id,
					area_name	:	areaResult.name
				});
			}).catch(next);
        }).catch(next);
	};// end getAreaIdByLatLong()

	/**
	 * Function to update user language id
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async changeLanguage (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
            req.body 	    =	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
            let userId		= 	(req.body.user_id) 		?	new ObjectId(req.body.user_id) 	:"";
			let languageId	= 	(req.body.language_id) 	?	req.body.language_id 		:"";

			/** Send error response **/
			if(!userId || !languageId){
				return resolve({status: Constants.STATUS_ERROR, message : res.__("system.invalid_access")});
			}

			/** Update user language details */
			const users = this.db.collection(Tables.USERS);
			users.updateOne({
				_id : userId,
			},
			{$set: {
				preference_language : languageId,
				modified			: Helpers.getUtcDate()
			}}).then(()=> {

				/** Send success response **/
				resolve({status	: Constants.STATUS_SUCCESS});
			}).catch(next);
        }).catch(next);
	};// end changeLanguage()

	/**
	 * Function to get featured restaurants
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getFeaturedRestaurants (req,res,next){
		return new Promise(resolve=>{
			/** For get city list */
			const restaurants = this.db.collection(Tables.RESTAURANTS);
			restaurants.find({status:Constants.ACTIVE,is_deleted:Constants.NOT_DELETED},{projection: { _id: 1,image:1,name:1}}).toArray().then(result=>{

				let restaurantIds		=	[];
				let restaurantImages	=	{};
				if(result.length > 0){
					result.map(records=>{
						restaurantIds.push(records._id);
						restaurantImages[records._id]	=	records;
					});
				}
				const restaurant_branches = this.db.collection(Tables.RESTAURANT_BRANCHES);
				restaurant_branches.find({restaurant_id : {$in : restaurantIds},is_featured:FEATURED,is_active:Constants.ACTIVE},{projection:{_id:1,name:1,slogan_in_arabic:1,slogan_in_english:1,restaurant_id:1}}).toArray().then(branchResult=>{

					if(branchResult.length > 0){
						branchResult.map(records=>{
							records.image			=	(restaurantImages[records.restaurant_id]) ? restaurantImages[records.restaurant_id].image 	:"";
							records.restaurant_name	=	(restaurantImages[records.restaurant_id]) ? restaurantImages[records.restaurant_id].name	:{};
						});
					}

					/**Send success response */
					resolve({status	: Constants.STATUS_SUCCESS, result: branchResult,image_path:Constants.RESTAURANT_FILE_URL});
				}).catch(next);
			}).catch(next);
		}).catch(next);
	}// end getFeaturedRestaurants()

	/**
	 * Function to get ads slider images
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getAdsSliderImages (req,res,next){
		return new Promise(resolve=>{
			const ads_sliders = this.db.collection(Tables.ADS_SLIDERS);
			ads_sliders.find().sort({ position: Constants.SORT_ASC }).toArray().then(result=>{

				let ads ={};
				result.map(record=>{
					if(record.position == Constants.POSITION_1) ads['position_'+record.position] = record.image;
					else ads['position_'+record.position] = record.image[0];
				});

				/** Send success response **/
				resolve({
					status 		: Constants.STATUS_SUCCESS,
					image_path 	: Constants.ADS_SLIDER_FILE_URL,
					result		: ads,
				});
			}).catch(next);
		}).catch(next);
	}// end getAdsSliderImages()

	/**
 	* Function to get banners
 	*
 	* @param req	As Request Data
 	* @param res	As Response Data
 	* @param next	As Callback argument to the middleware function
 	*
 	* @return json
 	*/
	async getBanners (req, res, next){
		return new Promise(resolve => {
			let pageName	=	(req.body.page_name) ? req.body.page_name : Constants.HOME_BANNER;

			const banners = this.db.collection(Tables.BANNERS);
			banners.find({
				page_name : pageName,
				status: Constants.ACTIVE,
			}, { projection: { image:1, description:1}}).toArray().then(result=>{

				/** Send response **/
				resolve({
					status		: Constants.STATUS_SUCCESS,
					image_path	: Constants.BANNER_URL,
					result		: result,
				});
			}).catch(next);
		}).catch(next);
	};//End getBanners()
}// End Home