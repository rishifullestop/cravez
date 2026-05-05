import { ObjectId } from 'mongodb';
import clone from 'clone';
import { parallel as asyncParallel, each as  asyncEach} from 'async';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from '../../../../utils/index.mjs';

import userCartModal from './user_carts.mjs';

export default class Offer {
    constructor(db) {
        this.db = db;

		this.userCartAPI = new userCartModal(db);
    }

	/**
	 * Function to check offer
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async checkOffer  (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 		=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId	 	=	req?.body?.user_id && new ObjectId(req.body.user_id) || "";
			let deviceId 	=	req?.body?.device_id || "";
			let branchId	= 	(req.body.branch_id) 	?	new ObjectId(req.body.branch_id)	:"";
			let restaurantId= 	(req.body.restaurant_id)?	new ObjectId(req.body.restaurant_id):"";
			let offerCode	= 	(req.body.offer_code)	?	req.body.offer_code					:"";
			let orderId		= 	(req.body.order_id)		?	new ObjectId(req.body.order_id)		:"";
			let mainDeviceId= 	(req.body.main_device_id)?	req.body.main_device_id				:"";

			/** Send error response **/
			if((!userId && !deviceId )|| !branchId || !restaurantId || !offerCode || (orderId && !deviceId)){
				return resolve({status: Constants.STATUS_ERROR, message:res.__("system.invalid_access")});
			}

			/** Get user cart list */
			this.userCartAPI.checkUserOffer(req,res,next,req.body).then(response=>{
				if(response.status != Constants.STATUS_SUCCESS) return resolve(response);

				let offerDetails 	=	response.result;
				let offerCodeId 	=	offerDetails.offer_id;
				let discount 		=	offerDetails.discount;
				let offerType 		=	offerDetails.offer_type;
				let orderPrice 		=	offerDetails.order_price;
				let itemList 		=	offerDetails.item_list;
				let sameOfferCode 	=	offerDetails.same_offer_code;
				let isFreeDelivery 	=	offerDetails.is_free_delivery;

				/** Set cart conditions */
				let cartConditions ={
					branch_id 		: branchId,
					restaurant_id 	: restaurantId,
				};

				if(orderId){
					cartConditions.device_id		=	deviceId;
				}else{
					if(userId){
						cartConditions.customer_id 	= 	userId;
					}else{
						cartConditions.device_id	=	deviceId;
					}
				}

				/** Get cart list */
				const user_carts  = this.db.collection(Tables.USER_CARTS);
				user_carts.distinct("_id",cartConditions).then(cartResult=>{

					let cartIdArray   = cartResult;
					const offer_used  = this.db.collection(Tables.OFFER_USED);
					const offer_logs  = this.db.collection(Tables.OFFER_LOGS);
					const tmp_offer_logs = this.db.collection(Tables.TMP_OFFER_LOGS);
					asyncParallel({
						update_offer_logs : (parentCallback)=>{
							if(orderId) return parentCallback(null);

							/** Set log conditions */
							let logConditions = {
								cart_ids: 	{$in: cartIdArray}
							};

							/** Get offer log details */
							offer_logs.findOne(logConditions,{projection: {_id: 1,order_discount:1,offer_id:1}}).then(logResult=>{
								if(!logResult) return parentCallback(null);

								let tmpLogId 	= logResult._id;
								let logDiscount = logResult.order_discount;
								let logOfferId 	= logResult.offer_id;

								/** Set offer used conditions */
								let offerUsedConditions = {
									offer_id 	: 	offerCodeId,
									offer_type 	:	offerType,
								};

								if(userId){
									offerUsedConditions.user_id 	= 	userId;
								}else{
									offerUsedConditions.device_id	=	deviceId;
								}

								if(orderId) offerUsedConditions.device_id= mainDeviceId;

								/** Update offer used */
								offer_used.updateOne(offerUsedConditions,{
									$set :{
										modified: 	Helpers.getUtcDate()
									},
									$inc :{
										offer_used 			: -1,
										total_amount_used 	: logDiscount*-1,
									},
									$pull :{
										offer_log_ids : tmpLogId,
									},
								}).then(()=>{

									/** Delete logs */
									offer_logs.deleteOne({_id: tmpLogId }).then(()=>{
										parentCallback(null);
									}).catch(next);
								}).catch(next);
							}).catch(next);
						},
						update_tmp_offer_logs : (parentCallback)=>{
							if(sameOfferCode) return parentCallback(null);

							/** Delete logs */
							tmp_offer_logs.deleteOne({cart_ids: {$in: cartIdArray} }).then(()=>{
								parentCallback(null);
							}).catch(next);
						},
					},(asyncParentErr)=>{
						if(asyncParentErr) return next(asyncParentErr);

						asyncParallel({
							update_cart : (callback)=>{
								/** Update cart details **/
								user_carts.updateMany({
									_id: {$in: cartIdArray}
								},
								{$set :{
									offer_id : offerCodeId,
									modified : Helpers.getUtcDate()
								}}).then(()=>{
									callback(null);
								}).catch(next);
							},
							save_offer_logs : (callback)=>{
								if(sameOfferCode) return callback(null);

								/** Set save data */
								let saveInsertData = {
									offer_code 		: 	offerCode,
									offer_id 		: 	offerCodeId,
									order_price 	:	orderPrice,
									order_discount 	: 	discount,
									cart_ids 		: 	cartIdArray,
									modified 		: 	Helpers.getUtcDate(),
									created 		: 	Helpers.getUtcDate(),
								};

								if(userId){
									saveInsertData.user_id 	= 	userId;
								}else{
									saveInsertData.device_id=	deviceId;
								}

								if(orderId) saveInsertData.device_id= mainDeviceId;

								/** Save offer logs details **/
								offer_logs.insertOne(saveInsertData).then(insertResult=>{

									let logId 	= 	(insertResult.insertedId) ? insertResult.insertedId :"";

									/** Set offer used conditions */
									let offerUsedConditions = {
										offer_id 	: 	offerCodeId,
										offer_type 	:	offerType,
									};

									if(userId){
										offerUsedConditions.user_id 	= 	userId;
									}else{
										offerUsedConditions.device_id	=	deviceId;
									}

									if(orderId) offerUsedConditions.device_id= mainDeviceId;

									/** Save offer logs details **/
									offer_used.updateOne(offerUsedConditions,{
										$set :{
											is_exausted : 	false,
											offer_code	:	offerCode,
											modified	: 	Helpers.getUtcDate()
										},
										$inc :{
											offer_used 			: 1,
											total_amount_used 	: discount,
										},
										$addToSet :{
											offer_log_ids : logId,
										},
										$setOnInsert : {
											created  : 	Helpers.getUtcDate()
										}
									},{upsert: true}).then(()=>{
										callback(null);
									}).catch(next);
								}).catch(next);
							},
							update_offer : (callback)=>{
								if(sameOfferCode) return callback(null);

								/** Set save data */
								let saveOfferData = {
									offer_id 		: 	offerCodeId,
									cart_ids 		: 	cartIdArray,
									modified 		: 	Helpers.getUtcDate(),
									created 		: 	Helpers.getUtcDate(),
								};

								if(userId){
									saveOfferData.user_id 	= 	userId;
								}else{
									saveOfferData.device_id	=	deviceId;
								}

								if(orderId) saveOfferData.device_id= mainDeviceId;

								/** Save offer logs details **/
								tmp_offer_logs.insertOne(saveOfferData).then(()=>{
									callback(null);
								}).catch(next);
							},
						},(asyncErr)=>{
							if(asyncErr) return next(asyncErr);

							/** Send success response */
							resolve({
								status : Constants.STATUS_SUCCESS,
								message : res.__("offers.offer_applied_successfully"),
								result : {
									offer_id 	: 	offerCodeId,
									discount 	: 	discount,
									item_list 	:	itemList,
									is_free_delivery:	isFreeDelivery,
								},
							});
						});
					});
				}).catch(next);
			}).catch(next);
		}).catch(next);
	};// end checkOffer()

	/**
	 * Function to get my offer list
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getMyOfferList  (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 		=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let areaId		= 	(req.body.area_id) 		? 	new ObjectId(req.body.area_id)  :"";
			let userId	 	=	req?.body?.user_id && new ObjectId(req.body.user_id) || "";
			let deviceId 	=	!userId && req?.body?.device_id || "";

			/** Send error response **/
			if((!userId && !deviceId) || !areaId) return resolve({status: Constants.STATUS_ERROR, message:res.__("system.invalid_access")});

			const users =  this.db.collection(Tables.USERS);
			asyncParallel({
				user_count : (callback)=>{
					if(!userId) return callback(null,null);

					/** Set user conditions */
					let userConditions 	= 	{
						_id: userId,
						is_guest: {$exists: false},
						created: {$gte: Helpers.newDate(Helpers.subtractDate(Constants.NEW_USER_DAYS*Constants.HOURS_IN_A_DAY))},
						...Constants.CUSTOMER_COMMON_CONDITIONS
					};

					/** Check user type **/
					users.countDocuments(userConditions).then(userResult => {
						callback(null,userResult);
					}).catch(next);
				},
				corporate_details : (callback)=>{
					if(!userId) return callback(null,null);

					/** Set user conditions */
					let userConditions 	= 	{
						_id: userId,
						corporate_id: {$exists: true},
						...Constants.CUSTOMER_COMMON_CONDITIONS
					};

					/** Check user corporate **/
					users.findOne(userConditions,{projection:{corporate_id: 1}}).then(userResult => {
						callback(null,userResult);
					}).catch(next);
				},
				kfg_rest: (callback)=>{
					const restaurants = this.db.collection(Tables.RESTAURANTS);
					restaurants.distinct("_id",{slug : {$in: [Constants.BURGER_KING, Constants.PIZZA_HUT] }}).then(restIds => {
						callback(null, restIds);
					}).catch(next);
				}
			},(asyncErr, response)=>{
				if(asyncErr) return next(asyncErr);

				let kfgRestIds	=	response.kfg_rest;
				let corporateDetails=  (response.corporate_details) ?response.corporate_details:{};
				let userCount 	=  	response.user_count;
				let corporateId	=  	(corporateDetails.corporate_id) ?corporateDetails.corporate_id :"";
				let userType 	=	(deviceId && !userId) ? Constants.APPLICABLE_FOR_GUEST :((userCount >0) ?  Constants.APPLICABLE_FOR_NEW_USERS : Constants.APPLICABLE_FOR_REGISTERED_MEMBER);

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
				let fromDate = Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));
				let toDate   = Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_END_DATE_FORMAT));
				let conditions = {
					is_active	  	:	Constants.ACTIVE,
					status			:	Constants.OFFER_PUBLISHED,
					display_offer 	:  	true,
					listed_on_myoffer:	true,
					$and			:	[
						{$or : [
							{$and : [
								{$or:[
									{kfg_offer_id: {$exists: false}},
									{kfg_offer_id: {$in: ["", null]}},
								]},
								{restaurant_ids	: {$nin: kfgRestIds }}
							]},
							{$and : [
								{kfg_offer_id	: {$exists: true, $nin: ["", null]}},
								{kfg_offer_name	: {$exists: true, $nin: ["", null]}},
								{restaurant_ids	: {$in: kfgRestIds }}
							]},
						]},
						{$or : [
							{"applicable_for.0" : {$exists: false}},
							{applicable_for	   : {$in: [userType]}}
						]},
						{$or : [
							{$and : [
								{ valid_from : {$gte : Helpers.newDate(fromDate)} },
								{ valid_to   : {$lte : Helpers.newDate(toDate)} }
							]},
							{$and : [
								{ valid_to 	 : {$gte : Helpers.newDate(fromDate)} },
								{ valid_from : {$lte : Helpers.newDate(toDate)} }
							]}
						]}
					]
				};

				if(userId){
					conditions["$and"].push({$or: [
						{"user_ids.0": {$exists: false}},
						{user_ids	 : {$in: [userId]} }
					]});
				}

				if(corporateId){
					conditions["$and"].push({$or: [
						{"corporate_ids.0" : {$exists: false}},
						{corporate_ids	   : {$in: [corporateId]}}
					]});
				}else{
					conditions.offer_type = {$ne: Constants.CORPORATE_OFFER};
				}

				/** Get offer listing  */
				const offers = this.db.collection(Tables.OFFERS);
				offers.aggregate([
					{$match : conditions},
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
									{$gt: ["$total_unique_redeem", "$unique_redeem_count"]},
								]},
								{$or:[
									{$eq: ["$total_redeem", ""]},
									{$gt: ["$total_redeem", "$total_redeem_count"]},
								]},
							]
						}
					}},
					{$project : { offer_redeem_details: 0, offer_unique_redeem_details:0}}
				]).toArray().then(offerResult=>{

					let offerIds = [];
					if(offerResult.length >0){
						offerResult.map(records=>{
							offerIds.push(records._id);
						});
					}

					/** Set offer common conditions */
					let commonConditions = {
						_id 			:  	{$in: offerIds},
						display_offer 	:  	true,
						is_active	  	:	Constants.ACTIVE,
						status			:	Constants.OFFER_PUBLISHED,
						listed_on_myoffer:	true,
					};

					/** Set redem offer conditions */
					let offerConditions = clone(commonConditions);
					offerConditions.offer_sub_type = Constants.FREE_OFFER;

					/** Set branch offer conditions */
					let branchOfferConditions = clone(commonConditions);
					branchOfferConditions.offer_sub_type = Constants.PAID_OFFER;

					asyncParallel({
						branch_wise_offer : (callback)=>{
							/** Set area conditions  */
							let areaConditions = { area_id: areaId};

							/** Get area wise branch list */
							const restaurant_branch_areas  = this.db.collection(Tables.RESTAURANT_BRANCH_AREAS);
							restaurant_branch_areas.distinct("branch_id",areaConditions).then(branchIds=>{
								if(branchIds.length<=0) return callback(null,branchIds);

								/** Get active branch list */
								const restaurant_branches  = this.db.collection(Tables.RESTAURANT_BRANCHES);
								restaurant_branches.find({
									_id		 	: 	{$in: branchIds },
									is_active	:	Constants.ACTIVE,
								},{projection: {_id:1, restaurant_id: 1, name:1}}).toArray().then(branchResult=>{
									if(branchResult.length<=0) return callback(null,branchIds);

									let branchIdsArray 		= [];
									let branchIdsList 		= {};
									let restaurantIdsArray 	= [];
									branchResult.map(records=>{
										branchIdsArray.push(records._id);
										restaurantIdsArray.push(records.restaurant_id);

										branchIdsList[records._id] = records;
									});

									asyncParallel({
										restaurant_list : (childCallback)=>{
											/** Get active restaurant list */
											const restaurants  = this.db.collection(Tables.RESTAURANTS);
											restaurants.find({
												_id		 	: 	{$in: restaurantIdsArray },
												is_deleted	:	Constants.NOT_DELETED,
												status		:	Constants.ACTIVE,
											},{projection: {_id:1, name: 1, image:1}}).toArray().then(restaurantResult=>{
												if(restaurantResult.length <=0) return childCallback(null,{});

												let restaurantList = {};
												restaurantResult.map(records=>{
													restaurantList[records._id] = {
														name  : records.name,
														image : records.image,
													};
												});

												childCallback(null,restaurantList);
											}).catch(next);
										},
										offer_list : (childCallback)=>{
											/** Set branch conditions */
											branchOfferConditions.branch_ids = {$in: branchIdsArray};

											/** Get offer list */
											offers.aggregate([
												{$match : branchOfferConditions},
												{$unwind: "$branch_ids"},
												{$group :{
													_id  : 	"$branch_ids",
													count:	{$sum: 1}
												}},
												{$sort : {count: Constants.SORT_DESC }}
											]).toArray().then(offerResult=>{
												childCallback(null, offerResult);
											}).catch(next);
										}
									},(childErr,childResponse)=>{
										if(childErr || Object.keys(childResponse.restaurant_list).length <=0 || childResponse.offer_list.length <=0) return callback(childErr,[]);

										let restaurantList  =	childResponse.restaurant_list;
										let offerList  		=	childResponse.offer_list;
										let finalList 		=	[];

										offerList.map(records=>{
											let offerBranchId 		= 	records._id;
											let offerRestaurantId	=	(branchIdsList[offerBranchId]) ? branchIdsList[offerBranchId].restaurant_id :"";

											if(restaurantList[offerRestaurantId]){
												finalList.push({
													branch_id 		: offerBranchId,
													restaurant_id 	: offerRestaurantId,
													offer_count		: records.count,
													name			: branchIdsList[offerBranchId].name,
													restaurant_name	: restaurantList[offerRestaurantId].name,
													restaurant_image: restaurantList[offerRestaurantId].image,
												});
											}
										});

										callback(null,finalList);
									});
								}).catch(next);
							}).catch(next);
						},
						offer_list : (callback)=>{
							/** Get offer list */
							offers.find(offerConditions,{projection: {title: 1, description: 1, offer_code: 1, image_in_arabic: 1, image_in_english:1,valid_to:1,total_redeem:1,total_unique_redeem:1,offer_value:1,discount_type:1}}).sort({display_order: SORT_ASC, created: Constants.SORT_DESC}).toArray().then(offerResult=>{
								callback(null, offerResult);
							}).catch(next);
						},
						total_offer : (callback)=>{
							/** Get offer list */
							offers.countDocuments(offerConditions).then(contResult=>{
								callback(null,contResult);
							}).catch(next);
						},
					},(asyncErr,asyncResponse)=>{
						if(asyncErr) return next(asyncErr);

						/** Send success response */
						resolve({
							status 				: 	Constants.STATUS_SUCCESS,
							offer_list  		:	asyncResponse.offer_list,
							total_offer  		:	asyncResponse.total_offer,
							branch_offer_list  	:	asyncResponse.branch_wise_offer,
							offer_image_url		:	Constants.OFFER_MANAGEMENT_FILE_URL,
							restaurant_image_url:	Constants.RESTAURANT_FILE_URL,
						});
					});
				}).catch(next);
			});
		}).catch(next);
	};// end getMyOfferList()

	/**
	 * Function to offer redemption
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async offerRedemption  (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 		=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId	 	=	req?.body?.user_id && new ObjectId(req.body.user_id) || "";
			let deviceId 	=	!userId && req?.body?.device_id || "";
			let areaId		= 	(req.body.area_id)		?	new ObjectId(req.body.area_id)	:"";
			let offerCode	= 	(req.body.offer_code)	?	req.body.offer_code			:"";
			let apiType		= 	(req.body.api_type)		?	req.body.api_type			:"";

			/** Send error response **/
			if((!userId && !deviceId) || !areaId || !offerCode) return resolve({status: Constants.STATUS_ERROR, message:res.__("system.invalid_access")});

			/** Add offer conditions */
			let offerConditions = {
				offer_code			:	offerCode,
				is_active			:	Constants.ACTIVE,
				status				:	Constants.OFFER_PUBLISHED,
				listed_on_myoffer	:	true,
			};

			/** Check offer used or not by user in previous **/
			const offers = this.db.collection(Tables.OFFERS);
			offers.aggregate([
				{$match : offerConditions},
				{$lookup: {
					from 		: 	Tables.OFFER_ITEMS,
					localField 	:	"_id",
					foreignField: 	"offer_id",
					as 			: 	"offer_items_list"
				}},
			]).toArray().then(offerResult=>{

				if(!offerResult || offerResult.length ==0) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

				offerResult			= offerResult[0];
				let offerId			= (offerResult._id) 			? 	offerResult._id				:"";
				let restaurantIds	= (offerResult.restaurant_ids) 	? 	offerResult.restaurant_ids	:[];
				let branchIds 		= (offerResult.branch_ids) 		? 	offerResult.branch_ids 	 	:[];
				let itemIds 		= (offerResult.item_ids) 		?	offerResult.item_ids 		:[];
				let offerType      	= (offerResult.offer_type) 		? 	offerResult.offer_type      :"";
				let itemOfferType 	= (offerResult.item_offer_type) ? 	offerResult.item_offer_type :"";
				let offerItemsList 	= (offerResult.offer_items_list) ? 	offerResult.offer_items_list :[];
				let redirectToDetailPage = (offerResult.redirect_to_detail_page) ? 	offerResult.redirect_to_detail_page :false;

				if(offerType == Constants.COMBO_OFFER && itemOfferType == Constants.ITEM_WISE_OFFER){
					itemIds = [];
					offerItemsList.map(records=>{
						itemIds.push(records.item_id);
					});
				}

				/** Send success response */
				if(redirectToDetailPage || restaurantIds.length <=0 || restaurantIds.length >1 || branchIds.length <=0 || branchIds.length >1){
					return resolve({
						status					: Constants.STATUS_SUCCESS,
						is_restaurant_details	: true,
						restaurant_ids			: restaurantIds,
						branch_ids				: branchIds,
					});
				}

				let branchId 		=	branchIds[0];
				let restaurantId	= 	restaurantIds[0];
				asyncParallel({
					branch_available_in_area : (callback)=>{
						/** Check branch available in area  */
						const restaurant_branch_areas  = this.db.collection(Tables.RESTAURANT_BRANCH_AREAS);
						restaurant_branch_areas.findOne({
							area_id		: areaId,
							branch_id	: branchId,
							open		: Constants.OPEN,
						},{projection: {_id:1}}).then(areaResult=>{
							callback(null,areaResult);
						}).catch(next);
					},
					branch_details : (callback)=>{
						/** Get branch details */
						const restaurant_branches  = this.db.collection(Tables.RESTAURANT_BRANCHES);
						restaurant_branches.findOne({
							_id			: branchId,
							is_active	: Constants.ACTIVE,
						},{projection: {_id:1}}).then(branchResult=>{
							callback(null,branchResult);
						}).catch(next);
					},
					restaurant_details : (callback)=>{
						/** Get restaurant details */
						const restaurants  = this.db.collection(Tables.RESTAURANTS);
						restaurants.findOne({
							_id			: 	restaurantId,
							is_deleted	:	Constants.NOT_DELETED,
							status		:	Constants.ACTIVE,
						},{projection: {_id:1}}).then(restaurantResult=>{
							callback(null,restaurantResult);
						}).catch(next);
					},
					item_list : (callback)=>{
						let linkItemConditions = {
							item_id : {$in : itemIds},
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
						/** Get branch linking items  */
						const item_linkings	= this.db.collection(Tables.ITEM_LINKINGS);
						item_linkings.distinct("item_id",linkItemConditions).then(linkingResult=>{
							if(linkingResult.length <=0) return callback(null,[]);

							/** Set item conditions **/
							let itemConditions = {
								_id				:	{$in : linkingResult},
								restaurant_id	:	restaurantId,
								is_active		:	Constants.ACTIVE,
							};

							/** Get item list */
							const items = this.db.collection(Tables.ITEMS);
							items.aggregate([
								{$match  : itemConditions},
								{$lookup : {
									from 		 : Tables.ITEM_UNITS,
									localField 	 : "_id",
									foreignField : "item_id",
									as 			 : "unit_details"
								}},
								{$project : {
									_id:1, price_on_selection:1, item_type:1, no_of_components: 1, no_of_duplicate: 1, unit_id: {$arrayElemAt : ["$unit_details.item_unit_id",0]}, item_unit_id: {$arrayElemAt : ["$unit_details._id",0]}
								}}
							]).toArray().then(itemResult=>{
								callback(null,itemResult);
							}).catch(next);
						}).catch(next);
					}
				},(asyncErr,asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					/** Send error response **/
					if(!asyncResponse.branch_available_in_area) return resolve({status: Constants.STATUS_ERROR, message:res.__("offers.branch_not_available_in_area")});

					/** Send error response **/
					if(!asyncResponse.branch_details || !asyncResponse.restaurant_details || asyncResponse.item_list.length <=0){
						return resolve({status: Constants.STATUS_ERROR, message:res.__("system.something_going_wrong_please_try_again"), asyncResponse:asyncResponse, offerResult:offerResult });
					}

					let totalAddedItem			=	0;
					const item_dough_units  	= 	this.db.collection(Tables.ITEM_DOUGH_UNITS);
					const item_group_extras 	= 	this.db.collection(Tables.ITEM_GROUP_EXTRAS);
					const item_choices_groups	=	this.db.collection(Tables.ITEM_CHOICES_GROUPS);
					asyncEach(asyncResponse.item_list,(records, eachCallback)=>{
						let itemId 				= 	records._id;
						let itemType 			=	records.item_type;
						let unitId 				=	records.unit_id;
						let itemUnitId 			=	records.item_unit_id;
						let noOfDuplicate 		=	records.no_of_duplicate;
						let noOfComponents 		=	records.no_of_components;

						asyncParallel({
							dough_details : (parallelCallback)=>{
								if(itemType != Constants.PIZZA_VGROUP && itemType != Constants.DEAL_ITEM && itemType != Constants.HALF_AND_HALF_ITEM) return parallelCallback(null,[]);

								/** Get dough details  */
								item_dough_units.aggregate([
									{$match  : {
										item_id : itemId,
										parents : {$in: [itemUnitId]}
									}},
									{$limit : 1},
									{$lookup:	{
										from     : Tables.ITEM_SELECTOR_UNITS,
										let      : {doughId : "$_id"},
										pipeline : [
											{$match : {
												$expr: {
													$and : [
														{$eq: ["$item_id",itemId]},
														{$in: ["$$doughId", "$dough_type_parents"]},
														{$in: [itemUnitId, "$parents"]},
													]
												}
											}},
											{$limit : 1},
										],
										as	:	"selector_details"
									}},
									{$project : { _id:1, selector_id: {$arrayElemAt : ["$selector_details._id",0]} }}
								]).toArray().then(doughResult=>{
									doughResult = (doughResult && doughResult[0]) ? doughResult[0] :{};
									parallelCallback(null,doughResult);
								}).catch(next);
							},
							extra_item_list : (parallelCallback)=>{
								/** Get link group list  */
								item_choices_groups.find({
									item_id 	 : itemId,
									min_quantity : {$gt :0}
								},{projection: {_id: 1,min_quantity: 1}}).toArray().then(groupResult=>{
									if(groupResult.length<=0) return parallelCallback(null,null);

									let groupIds =	[];
									let groupObj =	{};
									groupResult.map(data=>{
										groupIds.push(data._id);
										groupObj[data._id] = data;
									});

									/** Get extra item list  */
									item_group_extras.aggregate([
										{$match:	{
											group_id : {$in: groupIds},
											item_id  : itemId,
											$or : [
												{unit_id : unitId},
												{unit_id : {$exists : false}},
												{unit_id : {$in : ["",null]}},
											]
										}},
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
												{$project: { name: 1, extra_fees: 1, order: 1 }},
											],
											as:	"extra_item_detail"
										}},
										{$match: {
											"extra_item_detail._id" : {$exists: true}
										}},
										{$addFields : {
											extra_item_order: {$arrayElemAt:["$extra_item_detail.order",0]},
										}},
										{$sort : {extra_item_order : SORT_ASC }},
										{$group: {
											_id 			: "$group_id",
											extra_item_list : {$push : {
												_id			 : "$_id",
												unit_id      : "$unit_id",
												item_unit_id : "$item_unit_id",
												selector_id  : "$selector_id",
												dough_type_id: "$dough_type_id",
												extra_item_id: {$arrayElemAt: ["$extra_item_detail._id",0]},
												extra_fees	 : {$ifNull: [ "$extra_fees", {$arrayElemAt: ["$extra_item_detail.extra_fees",0]} ] },
											}},
										}},
									]).toArray().then(extraItemResult=>{
										if(extraItemResult.length <= 0) return parallelCallback(null,null);

										let extraItemObj = {};
										extraItemResult.map(data=>{
											extraItemObj[data._id] = data.extra_item_list;
										});

										parallelCallback(extraItemErr,{
											extra_item : extraItemObj,
											group_list : groupObj,
										});
									}).catch(next);
								}).catch(next);
							},
						},(parallelErr,parallelResponse)=>{
							if(parallelErr) return eachCallback(parallelErr);

							let doughDetails 	= 	parallelResponse.dough_details;
							let extraItemList 	=	parallelResponse.extra_item_list;
							let doughId			=	"";
							let selectorId		=	"";
							if(doughDetails){
								doughId 	= 	doughDetails._id;
								selectorId 	=	doughDetails.selector_id;
							}

							let unitExList	= [];
							let finalExList = [];
							if(extraItemList){
								let exItemList 	=	extraItemList.extra_item;
								let groupList	= 	extraItemList.group_list;

								if(Object.keys(groupList).length >0){
									Object.keys(groupList).map(tmpGroupId=>{
										let minQuantity 	= 	groupList[tmpGroupId].min_quantity;
										let tmpUnitExArray 	=	[];
										let tmpExtraArray 	=	[];

										if(exItemList[tmpGroupId] && exItemList[tmpGroupId].length >0){
											exItemList[tmpGroupId].map(exData=>{
												let tmpUnitId 		= 	exData.unit_id;
												let tmpDoughId 		= 	exData.dough_type_id;
												let tmpSelectorId 	=	exData.selector_id;

												if(tmpExtraArray.length != minQuantity){
													if(tmpUnitId && String(tmpUnitId) == String(unitId)){
														let isMatched = true;
														if(tmpDoughId){
															if(String(tmpDoughId) == String(doughId)){
																if(tmpSelectorId && String(tmpSelectorId) != String(selectorId)){
																	isMatched = false;
																}
															}else{
																isMatched = false;
															}
														}

														if(isMatched){
															if(itemType == Constants.DEAL_ITEM){
																tmpUnitExArray.push({
																	extra_item_id 		: exData.extra_item_id,
																	extra_group_item_id : exData._id,
																});
															}else{
																tmpExtraArray.push({
																	extra_item_id 		: exData.extra_item_id,
																	extra_group_item_id : exData._id,
																});
															}
														}
													}else{
														tmpExtraArray.push({
															extra_item_id 		: exData.extra_item_id,
															extra_group_item_id : exData._id,
														});
													}
												}
											});
										}

										if(tmpExtraArray.length >0){
											finalExList.push({
												group_id		:	tmpGroupId,
												extra_item_ids	: 	tmpExtraArray
											});
										}
										if(tmpUnitExArray.length >0){
											unitExList.push({
												group_id		:	tmpGroupId,
												extra_item_ids	: 	tmpUnitExArray
											});
										}
									});
								}
							}

							let unitLists = [];
							if(itemType == Constants.HALF_AND_HALF_ITEM){
								for(var i=0; i<noOfDuplicate; i++){
									unitLists.push({selector_id: selectorId, extra_items: finalExList});
								}
							}else if(itemType == Constants.DEAL_ITEM){
								for(var i=0; i<noOfComponents; i++){
									unitLists.push({
										unit_id		: unitId,
										dough_id	: doughId,
										item_unit_id: itemUnitId,
										selector_id	: selectorId,
										extra_items	: unitExList
									});
								}
							}

							let tmpBodyObj = {
								user_id		: 	userId,
								device_id	: 	deviceId,
								api_type	: 	apiType,
								area_id		: 	areaId,
								offer_id	: 	offerId,
								branch_id	: 	branchId,
								restaurant_id: 	restaurantId,
								item_id 	: 	itemId,
								item_type 	: 	itemType,
								offer_code  :   req.body.offer_code
							};

							if(itemType != Constants.DEAL_ITEM){
								tmpBodyObj.unit_id 		= unitId;
								tmpBodyObj.dough_id 	= doughId;
								tmpBodyObj.item_unit_id = itemUnitId;
								if(itemType != Constants.HALF_AND_HALF_ITEM){
									tmpBodyObj.selector_id = selectorId;
								}
							}

							if(itemType == Constants.HALF_AND_HALF_ITEM){
								tmpBodyObj.unit_lists	=	unitLists;
							}else{
								tmpBodyObj.unit_lists	=	unitLists;
								tmpBodyObj.extra_items	=	finalExList;
							}

							/** Add cart data */
							req.body =	tmpBodyObj;
							this.userCartAPI.updateCart(req,res,next).then(cartResponse=>{
								if(cartResponse.status == Constants.STATUS_SUCCESS){
									totalAddedItem++;
								}
								eachCallback(null);
							}).catch(next);
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return next(asyncEachErr);

						/** Send error response */
						if(totalAddedItem == 0){
							/** Remove from cart*/
							req.body = {
								user_id 		:	userId,
								device_id 		: 	deviceId,
								api_type		: 	apiType,
								restaurant_id 	: 	restaurantId,
							};
							this.userCartAPI.removeCartItems(req,res,next).then(()=>{ });

							return resolve({
								status		:  	Constants.STATUS_ERROR,
								message		:  	res.__("offers.not_eligible_for_this_offer"),
								add_in_cart	:	false,
							});
						}

						/** Set for check offer attributes   */
						req.body = {
							user_id 		:	userId,
							device_id 		: 	deviceId,
							branch_id 		: 	branchId,
							api_type		: 	apiType,
							offer_code 		: 	offerCode,
							restaurant_id 	: 	restaurantId,
						};

						/** Check Offer */
						this.checkOffer(req,res,next).then(offerResponse=>{
							if(offerResponse.status != Constants.STATUS_SUCCESS){
								/** Remove from cart*/
								req.body = {
									user_id 		:	userId,
									device_id 		: 	deviceId,
									api_type		: 	apiType,
									restaurant_id 	: 	restaurantId,
								};
								this.userCartAPI.removeCartItems(req,res,next).then(()=>{ });

								/** Send error response */
								return resolve({
									status	:  	Constants.STATUS_ERROR,
									message	:  	res.__("offers.not_eligible_for_this_offer"),
									add_in_cart: false,
									check_offer: true,
									offerResponse: offerResponse,
								});
							}

							/** Send success response */
							resolve({
								status		: 	Constants.STATUS_SUCCESS,
								message		:	res.__("offers.item_has_added_in_cart"),
								add_in_cart	:  	true
							});
						}).catch(next);
					});
				});
			}).catch(next);
		}).catch(next);
	};// end offerRedemption()

	/*
	* Function to scratch card
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async scratchCard  (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 		=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId		= 	(req.body.user_id)		?	new ObjectId(req.body.user_id)	:"";
			let offerCode	= 	(req.body.offer_code)	?	req.body.offer_code			:"";

			/** Send error response **/
			if(!userId  || !offerCode) return resolve({status: Constants.STATUS_ERROR, message:res.__("system.invalid_access")});

            let fromDate = Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));
			let toDate   = Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_END_DATE_FORMAT));

			/** Set add in wallet logs conditions */
			let addInWalletLogsConditions = {
                offer_code : offerCode,
                $or : [
                    {
                        $and : [
                            { valid_from : {$gte : Helpers.newDate(fromDate)} },
                            { valid_to   : {$lte : Helpers.newDate(toDate)} }
                        ]
                    },
                    {
                        $and : [
                            { valid_to 	 : {$gte : Helpers.newDate(fromDate)} },
                            { valid_from : {$lte : Helpers.newDate(toDate)} }
                        ]
                    }
                ]
            };

			/** Get add in wallet logs details */
			const add_in_wallet_logs = this.db.collection(Tables.ADD_IN_WALLET_LOGS);
			add_in_wallet_logs.findOne(addInWalletLogsConditions,{projection: { _id:1,amount:1,valid_from:1,valid_to:1,order_criteria:1,order_criteria_amount:1}}).then(offerResult=>{

				/** Send error response */
				if(!offerResult) return resolve({status: Constants.STATUS_ERROR, message:res.__("system.invalid_access")});

                let addInWalletId = new ObjectId(offerResult._id);
                let amount        = offerResult.amount;
                let validFrom     = offerResult.valid_from;
                let validTo       = offerResult.valid_to;
                let orderCriteria = offerResult.order_criteria;
                let orderCriteriaAmount = offerResult.order_criteria_amount;

                /** Get user in wallet logs details */
                const user_in_wallet_logs = this.db.collection(Tables.USER_WALLET_LOGS);
                user_in_wallet_logs.findOne({
					user_id 	: userId,
					wallet_id	: addInWalletId,
					is_redeem	: {$exists : false}
				},{projection: { _id:1}}).then(userInWalletResult=>{

                    /** Send error response */
                    if(!userInWalletResult) return resolve({status: Constants.STATUS_ERROR, message:res.__("offers.scratch_card_is_not_valid")});

					asyncParallel({
						update_wallet_balance : (callback)=>{
							/** Set options for update wallet balance*/
							let options = {
								transaction_type : Constants.CREDIT,
								wallet_type      : Constants.POINTS_AMOUNT,
								amount           : amount,
								user_id          : userId,
								expiry_date		 : validTo,
								extra_parameters : {
									from_date 		 	  : validFrom,
									order_criteria 		  : orderCriteria,
									order_criteria_amount : orderCriteriaAmount,
									add_in_wallet_id 	  : addInWalletId
								}
							};
							/** Call update wallet balance*/
							Helpers.updateWalletBalance(req,res,next,options).then(response=>{
								callback(null,response);
							}).catch(next);
						},
						update_user_wallet_logs : (callback)=>{
							/** Update user in wallet logs details */
							user_in_wallet_logs.updateOne({
								user_id : userId,
								wallet_id: addInWalletId
							},
							{
								$set : { is_redeem:true}
							}).then(()=>{
								callback(null);
							}).catch(next);
						}
					},(asyncErr,asyncResponse)=>{
						if(asyncErr) return next(asyncErr);

						/** Send error response */
						if(asyncResponse.update_wallet_balance.status == Constants.STATUS_ERROR) return resolve(asyncResponse.update_wallet_balance.message);

						/** Send response */
						return resolve({
							status	: Constants.STATUS_SUCCESS,
							message	: res.__("offers.scratch_card_has_been_applied_successfully")
						});
					});
                }).catch(next);
			}).catch(next);
		}).catch(next);
	};// end scratchCard()

	/**
	 * Function to branch wise my offer list
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async branchWiseMyOfferList  (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 		=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId	 	=	req?.body?.user_id && new ObjectId(req.body.user_id) || "";
			let deviceId 	=	!userId && req?.body?.device_id || "";
			let areaId		= 	(req.body.area_id) 		? 	new ObjectId(req.body.area_id)  :"";
            let branchId	= 	(req.body.branch_id) 	? 	new ObjectId(req.body.branch_id)  :"";
            let restaurantId= 	(req.body.restaurant_id) ? 	new ObjectId(req.body.restaurant_id)  :"";

			/** Send error response **/
			if((!userId && !deviceId) || !areaId || !branchId || !restaurantId) return resolve({status: Constants.STATUS_ERROR, message:res.__("system.invalid_access")});

			const users =  this.db.collection(Tables.USERS);
			asyncParallel({
				user_count : (callback)=>{
					if(!userId) return callback(null,null);

					/** Set user conditions */
					let userConditions 		= clone(Constants.CUSTOMER_COMMON_CONDITIONS);
					userConditions._id		= userId;
					userConditions.is_guest	= {$exists: false};
					userConditions.created	= {$gte: Helpers.newDate(Helpers.subtractDate(Constants.NEW_USER_DAYS*Constants.HOURS_IN_A_DAY))};

					/** Check user type **/
					users.countDocuments(userConditions).then(userResult=>{
						callback(null,userResult);
					}).catch(next);
				},
				corporate_details : (callback)=>{
					if(!userId) return callback(null,null);

					/** Set user conditions */
					let userConditions 			= 	clone(Constants.CUSTOMER_COMMON_CONDITIONS);
					userConditions._id			= 	userId;
					userConditions.corporate_id	=	{$exists: true};

					/** Check user corporate **/
					users.findOne(userConditions,{projection:{corporate_id: 1}}).then(userResult=>{
						callback(null,userResult);
					}).catch(next);
				},
				kfg_rest: (callback)=>{
					const restaurants = this.db.collection(Tables.RESTAURANTS);
					restaurants.distinct("_id",{slug : {$in: [Constants.BURGER_KING, Constants.PIZZA_HUT] }}).then(restIds=>{
						callback(null, restIds);
					}).catch(next);
				}
			},(asyncErr, response)=>{
				if(asyncErr) return next(asyncErr);

				let kfgRestIds	=	response.kfg_rest;
				let corporateDetails =  (response.corporate_details) ?response.corporate_details:{};
				let userCount 	=  	response.user_count;
				let corporateId	=  	(corporateDetails.corporate_id) ?corporateDetails.corporate_id :"";
				let userType 	=	(deviceId && !userId) ? Constants.APPLICABLE_FOR_GUEST :((userCount >0) ?  Constants.APPLICABLE_FOR_NEW_USERS : Constants.APPLICABLE_FOR_REGISTERED_MEMBER);

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
				let fromDate = Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));
				let toDate   = Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_END_DATE_FORMAT));
				let conditions = {
					is_active	  	:	Constants.ACTIVE,
					status			:	Constants.OFFER_PUBLISHED,
					display_offer 	:  	true,
					listed_on_myoffer:	true,
					$and			:	[
						{$or : [
							{$and : [
								{$or:[
									{kfg_offer_id: {$exists: false}},
									{kfg_offer_id: {$in: ["", null]}},
								]},
								{restaurant_ids	: {$nin: kfgRestIds }}
							]},
							{$and : [
								{kfg_offer_id	: {$exists: true, $nin: ["", null]}},
								{kfg_offer_name	: {$exists: true, $nin: ["", null]}},
								{restaurant_ids	: {$in: kfgRestIds }}
							]},
						]},
						{$or : [
							{"applicable_for.0" : {$exists: false}},
							{applicable_for	   : {$in: [userType]}}
						]},
						{$or : [
							{$and : [
								{ valid_from : {$gte : Helpers.newDate(fromDate)} },
								{ valid_to   : {$lte : Helpers.newDate(toDate)} }
							]},
							{$and : [
								{ valid_to 	 : {$gte : Helpers.newDate(fromDate)} },
								{ valid_from : {$lte : Helpers.newDate(toDate)} }
							]}
						]}
					]
				};

				if(userId){
					conditions["$and"].push({$or: [
						{"user_ids.0": {$exists: false}},
						{user_ids	 : {$in: [userId]} }
					]});
				}

				if(corporateId){
					conditions["$and"].push({$or: [
						{"corporate_ids.0" : {$exists: false}},
						{corporate_ids	   : {$in: [corporateId]}}
					]});
				}else{
					conditions.offer_type = {$ne: Constants.CORPORATE_OFFER};
				}

				/** Get offer listing  */
				const offers = this.db.collection(Tables.OFFERS);
				offers.aggregate([
					{$match : conditions},
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
									{$gt: ["$total_unique_redeem", "$unique_redeem_count"]},
								]},
								{$or:[
									{$eq: ["$total_redeem", ""]},
									{$gt: ["$total_redeem", "$total_redeem_count"]},
								]},
							]
						}
					}},
					{$project : { offer_redeem_details: 0, offer_unique_redeem_details:0}}
				]).toArray().then(offerResult=>{

					let offerIds = [];
					if(offerResult.length >0){
						offerResult.map(records=>{
							offerIds.push(records._id);
						});
					}

					/** Set offer comman  conditions */
					let commonConditions = {
						_id 			:  	{$in: offerIds},
						display_offer 	:  	true,
						is_active	  	:	Constants.ACTIVE,
						status			:	Constants.OFFER_PUBLISHED,
						branch_ids		:	{$in: [branchId]},
						offer_sub_type	:	Constants.PAID_OFFER,
						listed_on_myoffer:	true,
					};

                    asyncParallel({
                        restaurant_details : (childCallback)=>{
                            /** Get active restaurant details */
                            const restaurants  = this.db.collection(Tables.RESTAURANTS);
                            restaurants.findOne({
                                _id		 	: 	restaurantId,
                                is_deleted	:	Constants.NOT_DELETED,
                                status		:	Constants.ACTIVE,
                            },{projection: {_id:1, name: 1, image:1}}).then(restaurantResult=>{
                                childCallback(null,restaurantResult);
                            }).catch(next);
                        },
                        offer_list : (childCallback)=>{
							/** Get offer list */
							offers.find(commonConditions,{projection: {title: 1, description: 1, offer_code: 1, image_in_arabic: 1, image_in_english:1,valid_to:1,total_redeem:1,total_unique_redeem:1,offer_value:1,discount_type:1}}).sort({display_order: SORT_ASC, created: Constants.SORT_DESC}).toArray().then(offerResult=>{
								childCallback(null, offerResult);
							}).catch(next);
                        }
                    },(childErr,childResponse)=>{
                        if(childErr) return next(childErr);

                        let restaurantDetails  	=	childResponse.restaurant_details;
                        let offerList  			=	childResponse.offer_list;

						/** Send error response **/
						if(!restaurantDetails || offerList.length <=0){
							return resolve({status: Constants.STATUS_ERROR, message:res.__("system.something_going_wrong_please_try_again") });
						}

                        /** Send success response */
						resolve({
							status 				: 	Constants.STATUS_SUCCESS,
                            result  			:	offerList,
                            restaurant_details  :	restaurantDetails,
							offer_image_url		:	OFFER_MANAGEMENT_FILE_URL,
							restaurant_image_url:	RESTAURANT_FILE_URL,
						});
					});
				}).catch(next);
			});
		}).catch(next);
	};// end branchWiseMyOfferList()

	/**
	 * Function to get Offer Details
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async getOfferDetails  (req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 		=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let offerCode	= 	(req.body.offer_code) ? 	req.body.offer_code  :"";

			/** Send error response **/
			if(!offerCode) return resolve({status: Constants.STATUS_ERROR, message:res.__("system.invalid_access")});

			/** Add offer conditions */
			let fromDate = Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));
			let toDate   = Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_END_DATE_FORMAT));
			let conditions = {
				offer_code	  	:	offerCode,
				is_active	  	:	Constants.ACTIVE,
				status			:	Constants.OFFER_PUBLISHED,
				$and			:	[
					{$or : [
						{$and : [
							{ valid_from : {$gte : Helpers.newDate(fromDate)} },
							{ valid_to   : {$lte : Helpers.newDate(toDate)} }
						]},
						{$and : [
							{ valid_to 	 : {$gte : Helpers.newDate(fromDate)} },
							{ valid_from : {$lte : Helpers.newDate(toDate)} }
						]}
					]}
				]
			};

			/** Get offer listing  */
			const offers = this.db.collection(Tables.OFFERS);
			offers.aggregate([{$match : conditions}]).toArray().then(offerResult=>{
				if(offerErr) return next(offerErr);

				/** Send success response */
				resolve({
					status : 	Constants.STATUS_SUCCESS,
					result :	offerResult
				});
			}).catch(next);
		}).catch(next);
	};// end getOfferDetails()
}// End Offer