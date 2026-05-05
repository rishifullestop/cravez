import clone from 'clone';
import { ObjectId } from 'mongodb';
import {parallel as asyncParallel, each as asyncEach} from 'async';

import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import * as Helper from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { saveSystemLogs} from "../../../../services/index.mjs";

export default class Offer {
    constructor(db) {
        this.db = db;
		this.collectionDb = db.collection(Tables.OFFERS);
    }

	/**
	 * Function to get offer list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getOffersList (req, res, next){
		let offerType = (req.query.offer_type)	? req.query.offer_type : '';

		if(Helper.isPost(req)){
			let limit		  = (req.body.length) ? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
			let skip		  = (req.body.start)  ? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
			let fromDate      = (req.body.from_date) ? req.body.from_date : "";
			let toDate 	  	  = (req.body.to_date)   ? req.body.to_date   : "";

			let offerIds = [];
			if(offerType) {
				// Get offer ids from offer_logs
				const offerLogs = this.db.collection(Tables.OFFER_LOGS);
				offerIds = await offerLogs.distinct("offer_id", {});
			}

			/** Configure Datatable conditions*/
			const dataTableConfig = await Helper.configDatatable(req, res, null);

			/** Set conditions */
			let commonConditions = {};
			if(offerType){
				switch(offerType){
					case "redeemed_offers":
						commonConditions._id = {$in : Helper.arrayToObject(offerIds)};
					break;
					case "unused_offers":
						commonConditions._id = {$nin : Helper.arrayToObject(offerIds)};
					break;
				}
			}

			/** Condition for date */
			if (fromDate != "" && toDate != "") {
				dataTableConfig.conditions["$or"] = [
					{$and : [
						{ valid_from : {$gte : Helper.newDate(fromDate)} },
						{ valid_to   : {$lte : Helper.newDate(toDate)} }
					]},
					{$and : [
						{ valid_to 	 : {$gte : Helper.newDate(fromDate)} },
						{ valid_from : {$lte : Helper.newDate(toDate)} }
					]}
				];
			}

			dataTableConfig.conditions= Object.assign(dataTableConfig.conditions,commonConditions);

			// Get list or count of offers with aggregation
			let dbRes = await this.collectionDb.aggregate([
				{$match: dataTableConfig.conditions },
				{$facet : {
					list : [
						{$sort  : dataTableConfig.sort_conditions},
						{$skip 	: skip},
						{$limit : limit},
						{$lookup:	{
							from     : Tables.OFFER_LOGS,
							let      : {offerId : "$_id"},
							pipeline : [
								{$match : {
									$expr: {$and : [
										{$eq: ["$offer_id", "$$offerId"]},
									]}
								}},
								{$addFields : { isDevice : {$ifNull: [ "$user_id", true ] }}},
								{$group	: {
									_id : {
										user_device_id: {$cond: [
											{$and: [
												{$eq: ["$isDevice",true] },
											]},
											"$device_id",
											"$user_id",
										]}
									},
									total_redeem_count: {$sum: 1},
								}},
							],
							as:	"offer_redeem_details"
						}},
						{$project : {
							_id:1,title:1,offer_code:1,valid_from:1,valid_to:1,is_active:1,status:1,total_redeem:1,
							unique_redeem_count : {$size: "$offer_redeem_details"},
							total_redeem_count  : {$sum: "$offer_redeem_details.total_redeem_count"},
						}},
					],
					count: [
						{$count: "count"},
					],
				}}
			]).toArray();

			/** Send response **/
			res.send({
				status: Constants.STATUS_SUCCESS,
				draw: dataTableConfig.result_draw,
				data			:   dbRes?.[0]?.list ||[],
				recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
				recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
			});
		}else{
			/** render offers listing page **/
			req.breadcrumbs(BREADCRUMBS['admin/offer_management/list']);
			res.render('list',{offer_type : offerType});
		}

	};//End getOffersList()

	/**
	 * Function to get offer details
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	async getOfferDetails (req, res, next){
		try {
			/** Get offer details **/
			const result = await this.collectionDb.findOne({_id: new ObjectId(req.params.id) });

			/** Send error response */
			if(!result) {
				return {
					status: Constants.STATUS_ERROR,
					message: res.__("admin.system.invalid_access")
				};
			}

			/** Append image with full path **/
			const imageResponse = await Helper.appendFileExistData({
				"file_url" 			: 	Constants.OFFER_MANAGEMENT_FILE_URL,
				"file_path" 		: 	Constants.OFFER_MANAGEMENT_FILE_PATH,
				"result" 			: 	[result],
				"database_field" 	: 	"image_in_english",
				"image_placeholder" :   "en_image"
			});

			/** Append image with full path **/
			const imageArabicResponse = await Helper.appendFileExistData({
				"file_url" 			: 	Constants.OFFER_MANAGEMENT_FILE_URL,
				"file_path" 		: 	Constants.OFFER_MANAGEMENT_FILE_PATH,
				"result" 			: 	imageResponse.result,
				"database_field" 	: 	"image_in_arabic",
				"image_placeholder" :   "ar_image"
			});

			/** Send success response **/
			return {
				status	: Constants.STATUS_SUCCESS,
				result	: imageArabicResponse?.result?.[0] || {}
			};
		} catch (error) {
            next(error);
        }
	};// End this.getOfferDetails()

	/**
	 * Function for new add or update offer
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async addEditOffer  (req, res, next){
		let isEditable	= (req.params.id) ?	true : false;
		let offerId		= (req.params.id) ? new ObjectId(req.params.id)	:new ObjectId();
		if(Helper.isPost(req)){
			/** Sanitize Data **/
			req.body 			= 	Helper.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let offerType		=	(req.body.offer_type) 		? 	req.body.offer_type 		:"";
			let itemOfferType	=	(req.body.item_offer_type) 	? 	req.body.item_offer_type 	:"";
			let items			=	(req.body.items) 			? 	req.body.items 				:"";
			let listedOnMyOffer =   (req.body.listed_on_my_offer)? 	req.body.listed_on_my_offer :"";
			let redirectToDetails=   (req.body.redirect_to_details)? req.body.redirect_to_details :"";
			let applicableFor	= 	(req.body.applicable_for) 	?	req.body.applicable_for 	:[];
			let kfgOfferId		=	(req.body.kfg_offer_id) 	? 	req.body.kfg_offer_id 		:"";
			let kfgOfferName	=	(req.body.kfg_offer_name) 	? 	req.body.kfg_offer_name 	:"";

			/** Send error response */
			if(offerType == Constants.COMBO_OFFER && itemOfferType == Constants.ITEM_WISE_OFFER && req.body.restaurant_ids && req.body.branch_ids && req.body.category_ids && (!items || items.length <=0)){
				return res.send({status: Constants.STATUS_ERROR, message :res.__("admin.system.something_going_wrong_please_try_again") });
			}

			let userIds 	  = (req.body.user_ids) 	  ? req.body.user_ids 		:[];
			let restaurantIds = (req.body.restaurant_ids) ? req.body.restaurant_ids :[];
			let branchIds 	  = (req.body.branch_ids)	  ? req.body.branch_ids 	:[];
			let categoryIds	  = (req.body.category_ids)   ? req.body.category_ids 	:[];
			let cuisineIds 	  = (req.body.cuisine_ids) 	  ? req.body.cuisine_ids 	:[];
			let itemIds 	  = (req.body.item_ids) 	  ? req.body.item_ids 		:[];
			let corporateIds  = (req.body.corporate_ids)  ? req.body.corporate_ids 	:[];

			/** Convert array to object **/
			userIds			= (userIds.constructor === Array) 		? userIds 		: [userIds];
			restaurantIds	= (restaurantIds.constructor === Array) ? restaurantIds : [restaurantIds];
			branchIds		= (branchIds.constructor === Array) 	? branchIds 	: [branchIds];
			cuisineIds		= (cuisineIds.constructor === Array) 	? cuisineIds 	: [cuisineIds];
			itemIds			= (itemIds.constructor === Array) 		? itemIds 		: [itemIds];
			categoryIds		= (categoryIds.constructor === Array) 	? categoryIds 	: [categoryIds];
			corporateIds	= (corporateIds.constructor === Array) 	? corporateIds 	: [corporateIds];
			applicableFor	= (applicableFor.constructor === Array) ? applicableFor : [applicableFor];

			let errors = [];
			if(offerType == Constants.COMBO_OFFER){
				if(itemOfferType == Constants.ITEM_WISE_OFFER){
					let selectedCount = 0;
					if(items.length >0){
						items.map((records,index)=>{
							if(records.is_selected){
								selectedCount++;
								if(!records.price){
									errors.push({'param': 'items_'+index, 'msg': res.__("admin.offer_management.please_enter_price") });
								}else if(isNaN(records.price) || records.price<0 || records.price > Constants.MAX_PERCENTAGE){
									errors.push({'param': 'items_'+index, 'msg': res.__("admin.offer_management.please_enter_valid_price") });
								}
							}
						});
					}
					if(!selectedCount && req.body.restaurant_ids && req.body.branch_ids && req.body.category_ids){
						let params 		= (items.length >0) ? "items_select_0" :Constants.ADMIN_GLOBAL_ERROR;
						let tmpMessage	= (items.length >0) ? res.__("admin.offer_management.please_select_item") :res.__("admin.offer_management.select_at_least_one_item");

						errors.push({'param': params, 'msg': tmpMessage });
					}
				}else if(!itemIds || itemIds.length <=0){
					errors.push({'param': "item_ids", 'msg': res.__("admin.offer_management.select_at_least_one_item") });
				}
			}

			/** Send error response **/
			if(errors.length > 0) return res.send({ status: Constants.STATUS_ERROR, message: errors});

			let numberOfOffers = req.body.number_of_offers ?  req.body.number_of_offers : 0;
			let offerCode 	   = req.body.offer_code       ?  req.body.offer_code       : "";
			let offerCodeArray = [];

			/** Generate offer code **/
			if(numberOfOffers > 0){
				for(var i=1; i<=numberOfOffers; i++){
					let tmp = "";
					if(i < 10){
						tmp = offerCode+"00"+i;
					}else if(i > 100){
						tmp = offerCode+i;
					}else {
						tmp = offerCode+"0"+i;
					}
					offerCodeArray.push(tmp);
				}
			}

			asyncParallel({
				image_in_english: (callback)=>{
					let options = {
						'image' 	: (req.files && req.files.image_in_english) ? req.files.image_in_english :"",
						'filePath'  : Constants.OFFER_MANAGEMENT_FILE_PATH,
						'oldPath' 	: (req.body.old_image_in_english) ? req.body.old_image_in_english : ""
					};
					/** Upload image in english **/
					Helper.moveUploadedFile(req, res, options).then(fileResponse => {
						callback(null,fileResponse);
					});
				},
				image_in_arabic: (callback)=>{
					let options = {
						'image' 	: (req.files && req.files.image_in_arabic) ? req.files.image_in_arabic :"",
						'filePath'  : Constants.OFFER_MANAGEMENT_FILE_PATH,
						'oldPath' 	: (req.body.old_image_in_arabic) ? req.body.old_image_in_arabic : ""
					};
						/** Upload image in arabic **/
					Helper.moveUploadedFile(req, res, options).then(fileResponse => {
						callback(null,fileResponse);
					});
				}
			},(err,response)=>{
				if(err) return next(err);

				let imageInEnglishResponse = response.image_in_english ? response.image_in_english : "";
				let imageInArabicResponse  = response.image_in_arabic  ? response.image_in_arabic  : "";

				/** Set error if image is not in format **/
				let imageErrors = [];
				if(imageInEnglishResponse.status == Constants.STATUS_ERROR) {
					imageErrors.push({'param': 'image_in_english','msg': imageInEnglishResponse.message });
				}

				/** Set error if image is not in format **/
				if(imageInArabicResponse.status == Constants.STATUS_ERROR) {
					imageErrors.push({ 'param': 'image_in_arabic', 'msg': imageInArabicResponse.message });
				}

				/** Send error response **/
				if(imageErrors.length >0) return res.send({status:Constants.STATUS_ERROR, message:imageErrors });

				let fromDate 	= req.body.start_date;
				let toDate 	 	= req.body.end_date;
				let tempToDate  = Helper.newDate(toDate,Constants.DATABASE_DATE_FORMAT);
				let tempFromDate= Helper.newDate(fromDate,Constants.DATABASE_DATE_FORMAT);
				tempToDate  	= Helper.newDate(tempToDate+" "+Constants.END_DATE_TIME_FORMAT);
				tempFromDate  	= Helper.newDate(tempFromDate+" "+Constants.START_DATE_TIME_FORMAT);

				/** convert ids to object ids*/
				userIds			= Helper.arrayToObject(userIds);
				restaurantIds	= Helper.arrayToObject(restaurantIds);
				branchIds		= Helper.arrayToObject(branchIds);
				cuisineIds		= Helper.arrayToObject(cuisineIds);
				itemIds			= Helper.arrayToObject(itemIds);
				categoryIds		= Helper.arrayToObject(categoryIds);
				corporateIds	= Helper.arrayToObject(corporateIds);

				/** Set data in a object **/
				let updateData = {
					$set :{
						title : {
							en : req.body.title_in_english,
							ar : req.body.title_in_arabic
						},
						description : {
							en : req.body.description_in_english,
							ar : req.body.description_in_arabic
						},
						offer_type 		 	: req.body.offer_type,
						offer_value 		: (req.body.offer_value)	  ?	parseFloat(req.body.offer_value) :"",
						offer_max_amount 	: (req.body.offer_max_amount) ? parseFloat(req.body.offer_max_amount) :0,
						min_amount 		 	: (req.body.min_amount) ? parseFloat(req.body.min_amount) :"",
						max_amount 		 	: (req.body.max_amount) ? parseFloat(req.body.max_amount) :"",
						total_redeem		: (req.body.total_redeem) ? parseInt(req.body.total_redeem) :"",
						total_unique_redeem	: (req.body.total_unique_redeem) ? parseInt(req.body.total_unique_redeem) :"",
						applicable_for 	 	: applicableFor,
						corporate_ids 	 	: corporateIds,
						user_ids  		 	: userIds,
						restaurant_ids   	: restaurantIds,
						branch_ids  		: branchIds,
						category_ids  		: categoryIds,
						cuisine_ids 		: cuisineIds,
						item_ids  			: itemIds,
						valid_from			: tempFromDate,
						valid_to			: tempToDate,
						display_offer		: (req.body.display_offer) ? true : false,
						display_order		: (req.body.display_order) ? parseInt(req.body.display_order) : "",
						discount_type		: req.body.discount_type,
						number_of_members	: (req.body.number_of_members) ? parseInt(req.body.number_of_members) : "",
						modified			: Helper.getUtcDate(),
						is_free_delivery	: (req.body.free_delivery) 	? true : false,
						listed_on_myoffer   : (listedOnMyOffer)  	   	? true : false,
						redirect_to_detail_page: (redirectToDetails)  	? true : false,
						offer_sub_type      : req.body.offer_sub_type,
						restaurant_type     : req.body.restaurant_type,
						restaurant_discount_ratio : parseFloat(req.body.offer_discount_for_restaurant),
						cravez_discount_ratio 	  : Constants.MAX_PERCENTAGE - parseFloat(req.body.offer_discount_for_restaurant),
						kfg_offer_id		: 	kfgOfferId,
						kfg_offer_name		: 	kfgOfferName,
					},
					$setOnInsert : {
						offer_code 	:	offerCode,
						status 	  	: 	Constants.OFFER_PUBLISHED,
						is_active	: 	Constants.ACTIVE,
						created   	: 	Helper.getUtcDate()
					}
				};

				if(offerType == Constants.COMBO_OFFER){
					updateData["$set"].minimum_items 	=  parseFloat(req.body.minimum_items) ;
					updateData["$set"].item_offer_type  =  req.body.item_offer_type;

					if(itemOfferType == Constants.GENERAL_ITEM_OFFER) updateData["$set"].discount_price =  parseFloat(req.body.discount_price);
				}else{
					if(!updateData["$unset"]) updateData["$unset"] ={};

					updateData["$unset"].minimum_items 		= 1;
					updateData["$unset"].item_offer_type 	= 1;
					updateData["$unset"].discount_price 	= 1;
				}

				/** if upload image in english **/
				if(imageInEnglishResponse.fileName) updateData["$set"]['image_in_english'] = imageInEnglishResponse.fileName;

				/** if upload image in arabic **/
				if(imageInArabicResponse.fileName) updateData["$set"]['image_in_arabic'] = imageInArabicResponse.fileName;

				let insertDataArray = [];
				if(numberOfOffers > 0){
					offerCodeArray.map(records=>{
						let tmpInsertData = clone(updateData);
						tmpInsertData["$setOnInsert"].offer_code = records;

						insertDataArray.push({ update_data: tmpInsertData, tmp_data:{_id:new ObjectId()}});
					});
				}else{
					insertDataArray.push({ update_data : updateData, tmp_data : {_id: offerId}});
				}

				/** Update details **/
				const offer_items = this.db.collection(Tables.OFFER_ITEMS);
				asyncEach(insertDataArray, (records, eachCallback)=> {
					let tmpOfferId = records.tmp_data._id;

					/** Update offer details */
					this.collectionDb.updateOne({_id:tmpOfferId},records.update_data,{upsert:true}).then(()=>{

						asyncParallel({
							save_offer_item :(callback)=>{
								/** Delete offer items */
								offer_items.deleteMany({offer_id: tmpOfferId}).then(()=>{

									if(offerType != Constants.COMBO_OFFER || itemOfferType != Constants.ITEM_WISE_OFFER) return callback(null);

									asyncEach(req.body.items, (records, childEachCallback)=> {
										if(records.is_selected){
											/** Update offer items */
											offer_items.updateOne({
												offer_id 	:	tmpOfferId,
												item_id		: 	new ObjectId(records.item_id),
											},
											{
												$set : {
													price 		: 	parseFloat(records.price),
													modified   	:	Helper.getUtcDate()
												},
												$setOnInsert : {
													restaurant_id  	: new ObjectId(records.restaurant_id),
													created   		: Helper.getUtcDate()
												}
											},{upsert: true}).then(()=>{
												childEachCallback(null);
											}).catch(next);
										}else{
											childEachCallback(null);
										}
									},(asyncEachErr)=> {
										callback(asyncEachErr);
									});
								}).catch(next);
							},
						},(asyncErr)=>{
							/** save System logs */
							saveSystemLogs(req, res, {
								user_id				: req.session.user._id,
								parent_id			: tmpOfferId,
								activity_module		: Constants.SYSTEM_LOG_MODULE_OFFER_MANAGEMENT,
								activity_type		: Constants.ACTIVITY_TYPE_ADD_EDIT,
								additional_details	: {}
							});

							eachCallback(asyncErr);
						});
					}).catch(next);
				},(eachErr)=> {
					if(eachErr) return next(eachErr);

					/** Send success response **/
					let message = (isEditable) ? res.__("admin.offer_management.offer_has_been_updated_successfully") :res.__("admin.offer_management.offer_has_been_added_successfully");
					if(!isEditable) req.flash(Constants.STATUS_SUCCESS,message);
					res.send({
						status		: Constants.STATUS_SUCCESS,
						redirect_url: Constants.WEBSITE_ADMIN_URL+"offer_management",
						message		: message
					});
				});
			});
		}else{
			let offerData = {};
			if(isEditable){
				const offerDetails = await this.getOfferDetails(req, res, next);

				/** Send error response **/
				if(offerDetails.status != Constants.STATUS_SUCCESS) return res.status(400).send(offerDetails);

				offerData = offerDetails.result;
			}

			let restaurantIds  	= offerData?.restaurant_ids || [];
			let userIds  	   	= offerData?.user_ids || [];
			let branchIds  	   	= offerData?.branch_ids || [];
			let cuisineIds     	= offerData?.cuisine_ids || [];
			let categoryIds    	= offerData?.category_ids || [];
			let itemIds    	   	= offerData?.item_ids || [];
			let corporateIds   	= offerData?.corporate_ids || [];
			let offerType 		= offerData?.offer_type || "";
			let itemOfferType 	= offerData?.item_offer_type || "";
			let onlyList 		= (offerType == Constants.COMBO_OFFER && itemOfferType ==Constants.ITEM_WISE_OFFER) ? true :false;
			asyncParallel({
				category_list : (callback)=>{
					if(!isEditable) return callback(null,null);

					/** Get branch list **/
					this.categoryListHtml(req,res,next,{restaurant_ids:restaurantIds,category_ids:categoryIds}).then(categoryResponse=>{
						if(categoryResponse.status == Constants.STATUS_ERROR) return callback(categoryResponse.message);
						callback(null,categoryResponse.category_list);
					}).catch(next);
				},
				cuisine_ids : (callback)=>{
					if(!isEditable) return callback(null,null);

					/** Get cuisine ids  */
					const restaurant_cuisines = this.db.collection(Tables.RESTAURANT_CUISINES);
					restaurant_cuisines.distinct("cuisine_id",{restaurant_id : {$in: restaurantIds}}).then(cuisineIds=>{
						callback(null,cuisineIds);
					}).catch(next);
				},
				item_list : (callback)=>{
					if(!isEditable) return callback(null,null);

					/** Get branch list **/
					this.itemListWithHtml(req,res,next,{restaurant_ids:restaurantIds,category_ids:categoryIds,branch_ids: branchIds,item_ids: itemIds,only_list:onlyList}).then(itemResponse=>{
						if(itemResponse.status == Constants.STATUS_ERROR) return callback(itemResponse.message);
						callback(null,itemResponse?.item_list || "");
					}).catch(next);
				},
				branch_list: (callback)=>{
					if(!isEditable) return callback(null,null);

					/** Get branch list **/
					this.branchListWithHtml(req,res,next,{restaurant_ids:restaurantIds,branch_ids:branchIds}).then(branchResponse=>{
						callback(null,branchResponse?.branch_list || "");
					}).catch(next);
				},
				offer_code :(callback)=>{
					if(isEditable) return callback(null,null);

					/**Get unique offer code **/
					Helper.generateOfferCode(req,res, next,{}).then(offerResponse=> {
						callback(null,offerResponse?.offer_code || "");
					}).catch(next);
				},
				offer_item_list :(callback)=>{
					if(!isEditable || offerType != Constants.COMBO_OFFER || itemOfferType !=Constants.ITEM_WISE_OFFER) return callback(null,null);

					/** Get offer item list */
					const offer_items = this.db.collection(Tables.OFFER_ITEMS);
					offer_items.find({ offer_id: new ObjectId(offerId) },{projection:{item_id:1, price:1}}).toArray().then(itemResult=>{
						callback(null,itemResult);
					}).catch(next);
				},
				selected_user : (callback)=>{
					if(userIds.length ==0) return callback(null,[]);

					const users = this.db.collection(Tables.USERS);
					users.find({_id: {$in: userIds}},{projection: {_id:1,full_name:1,mobile_number:1}}).sort({full_name: Constants.SORT_ASC}).toArray().then(result=>{
						callback(null,result);
					}).catch(next);
				},
			},async (asyncErr,asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				let cuisineIdsResponse = asyncResponse.cuisine_ids || [];
				let itemList    	   = asyncResponse.item_list || "";
				let branchList		   = asyncResponse.branch_list || "";
				let categoryList	   = asyncResponse.category_list || "";
				let offerCode    	   = asyncResponse.offer_code || "";

				/** Set dropdown options **/
				let options = {
					collections :[
						{
							collection : Tables.RESTAURANTS,
							columns    :  ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions : {
								status		: Constants.ACTIVE,
								is_deleted	: Constants.NOT_DELETED,
							},
							selected   : restaurantIds
						},
						{
							collection : Tables.CORPORATE_TIE_UPS,
							columns    :  ["_id",["corporate_name",Constants.DEFAULT_LANGUAGE_CODE]],
							selected   : corporateIds
						}
					],
				};
				/**Check for is editable */
				if(isEditable){
					options.collections.push({
						collection : Tables.CUISINES,
						columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
						conditions : {
							_id 	   : {$in : cuisineIdsResponse},
							is_active  : Constants.ACTIVE,
						},
						selected   : cuisineIds
					});
				}

				/**Get dropdown list **/
				let dropDownResponse = await Helper.getDropdownList(req,res, next,options);

				/** Send error response **/
				if(dropDownResponse.status != Constants.STATUS_SUCCESS) return res.status(400).send(dropDownResponse);

				 /** render add/edit offer page **/
				req.breadcrumbs(BREADCRUMBS['admin/offer_management/'+ (isEditable ? 'edit' : 'add')]);
				res.render('add_edit', {
					layout			:	false,
					result			: 	offerData,
					is_editable		: 	isEditable,
					restaurant_list	:   dropDownResponse?.final_html_data?.[0] || "",
					corporate_list	: 	dropDownResponse?.final_html_data?.[1] || "",
					cuisine_list	: 	dropDownResponse?.final_html_data?.[2] || "",
					selected_user	: 	asyncResponse?.selected_user || [],
					offer_item_list	: 	asyncResponse?.offer_item_list || [],
					item_list		: 	itemList,
					offer_code		:   offerCode,
					branch_list		:   branchList,
					category_list	:   categoryList
				});
			});
		}
	};//End addEditOffer()

	/**
	 * Function for get branch list using ajax
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async branchList (req, res, next){
		this.branchListWithHtml(req,res,next,req.body).then(response=>{
			res.send(response);
		}).catch(next);
	};//End branchList()

	/**
	 * Function for get branch list with html
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async branchListWithHtml (req,res,next,options){
		return new Promise(resolve=>{
			let restaurantIds 	= (options.restaurant_ids) 	? options.restaurant_ids 	:[];
			let branchIds 		= (options.branch_ids) 	 	? options.branch_ids  		:[];

			if(restaurantIds.length <= 0) return resolve({status : Constants.STATUS_SUCCESS,branch_list : ""});

			restaurantIds = Helper.arrayToObject(restaurantIds);

			asyncParallel({
				branch_list :(callback)=>{
					let sortConditions = {};
					sortConditions["name."+Constants.DEFAULT_LANGUAGE_CODE] = Constants.SORT_ASC;

					/** Get list of branch  **/
					const restaurant_branches  = this.db.collection(Tables.RESTAURANT_BRANCHES);
					restaurant_branches.find({
						restaurant_id : {$in : restaurantIds},
						is_active	  : Constants.ACTIVE,
					},{projection: {_id:1,name:1,restaurant_id:1}}).sort(sortConditions).toArray().then(result=>{
						if(result.length <=0) return  callback(null,null);

						/** Manage list  */
						let branchList = {};
						result.map(records=>{
							if(!branchList[records.restaurant_id]) branchList[records.restaurant_id] =[];

							branchList[records.restaurant_id].push(records);
						});
						callback(null, branchList);
					}).catch(next);
				},
				restaurant_list:(callback)=>{
					/** Get list of restaurants  **/
					const restaurants  = this.db.collection(Tables.RESTAURANTS);
					restaurants.find({
						_id 		: {$in : restaurantIds},
						status		: Constants.ACTIVE,
						is_deleted	: Constants.NOT_DELETED,
					},{projection: {_id:1,name:1}}).toArray().then(result=>{
						if(result.length <=0) return  callback(null,null);

						/** Manage list  */
						let restaurantList = {};
						result.map(records=>{
							restaurantList[records._id] = records.name[Constants.DEFAULT_LANGUAGE_CODE];
						});
						callback(null, restaurantList);
					}).catch(next);
				},
			},(parallelErr, parallelResponse)=>{
				if(parallelErr) return next(parallelErr);

				/** Send error response */
				if(!parallelResponse.branch_list || !parallelResponse.restaurant_list){
					return resolve({status: Constants.STATUS_ERROR, message :res.__("admin.system.something_going_wrong_please_try_again") });
				}

				let branchList 		=	parallelResponse.branch_list;
				let restaurantList 	=	parallelResponse.restaurant_list;
				let finalBranchList =   "";

				Object.keys(restaurantList).map(restaurantId=>{
					let restaurantName = (restaurantList[restaurantId]) ? restaurantList[restaurantId] :"";

					if(branchList[restaurantId]){
						finalBranchList += "<optgroup label='"+restaurantName+"'>";

						branchList[restaurantId].map(records=>{
							let branchId  	=  records._id;
							let branchName 	=  records.name[Constants.DEFAULT_LANGUAGE_CODE];
							let selectedFlag = "";

							if(branchIds.length >0){
								branchIds.map(tempBranchId=>{
									if(String(tempBranchId) == branchId) selectedFlag ="selected";
								});
							}
							finalBranchList += '<option value="'+records._id+'" '+selectedFlag+'>'+branchName+'</option>';
						});

						finalBranchList += "</optgroup>";
					}
				});

				/** Send success response */
				resolve({
					status      : Constants.STATUS_SUCCESS,
					branch_list : finalBranchList
				});
			});
		}).catch(next);
	};//End branchListWithHtml()

	/**
	 * Function for get cuisine list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async cuisineList (req, res, next){
		let restauarantIds = req.body.restaurant_ids;

		/** Send error response */
		if(!restauarantIds && restauarantIds.length <= 0) return res.send({status: Constants.STATUS_ERROR, message :res.__("admin.system.something_going_wrong_please_try_again") });

		restauarantIds = Helper.arrayToObject(restauarantIds);

		/** Get cuisine ids  */
		const restaurant_cuisines = this.db.collection(Tables.RESTAURANT_CUISINES);
		restaurant_cuisines.distinct("cuisine_id",{restaurant_id : {$in: restauarantIds}}).then(cuisineIds=>{

			/**Get cuisine list **/
			Helper.getDropdownList(req,res, next,{
				collections :[
					{
						collection : Tables.CUISINES,
						columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
						conditions : {
							_id : {$in : cuisineIds},
							is_active  : Constants.ACTIVE,
						}
					},
				]
			}).then(dropDownResponse=> {
				if(dropDownResponse.status != Constants.STATUS_SUCCESS) return res.send({status: Constants.STATUS_ERROR, message :res.__("admin.system.something_going_wrong_please_try_again") });

				res.send({
					status       : Constants.STATUS_SUCCESS,
					cuisine_list : dropDownResponse.final_html_data["0"]
				});
			}).catch(next);
		}).catch(next);
	};//End cuisineList()

	/**
	 * Function for get category list using ajax
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async categoryList (req, res, next){
		this.categoryListHtml(req,res,next,req.body).then(response=>{
			res.send(response);
		}).catch(next);
	};//End categoryList()

	/**
	 * Function for get category list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async categoryListHtml (req,res,next,options){
		return new Promise(resolve=>{
			let restaurantIds 	= (options.restaurant_ids) 	? options.restaurant_ids 	:[];
			let categoryIds		= (options.category_ids) 	? options.category_ids 		:[];

			/** Send error response */
			if(restaurantIds.length <= 0) return resolve({status : Constants.STATUS_SUCCESS,category_list : ""});

			restaurantIds = Helper.arrayToObject(restaurantIds);

			asyncParallel({
				category_list :(callback)=>{
					let sortConditions = {};
					sortConditions["name."+Constants.DEFAULT_LANGUAGE_CODE] = Constants.SORT_ASC;

					/** Get list of branch  **/
					const restaurant_categories  = this.db.collection(Tables.RESTAURANT_CATEGORIES);
					restaurant_categories.find({
						is_active	  : Constants.ACTIVE,
						restaurant_id : {$in : restaurantIds}
					},{projection: {_id:1,name:1,restaurant_id:1}}).sort(sortConditions).toArray().then(result=>{
						if(result.length <=0) return  callback(null,null);

						/** Manage list  */
						let categoryList = {};
						result.map(records=>{
							if(!categoryList[records.restaurant_id]) categoryList[records.restaurant_id] =[];

							categoryList[records.restaurant_id].push(records);
						});
						callback(null, categoryList);
					}).catch(next);
				},
				restaurant_list:(callback)=>{
					/** Get list of restaurants  **/
					const restaurants  = this.db.collection(Tables.RESTAURANTS);
					restaurants.find({
						_id 		: {$in : restaurantIds},
						status		: Constants.ACTIVE,
						is_deleted	: Constants.NOT_DELETED,
					},{projection: {_id:1,name:1}}).toArray().then(result=>{
						if(result.length <=0) return  callback(null,null);

						/** Manage list  */
						let restaurantList = {};
						result.map(records=>{
							restaurantList[records._id] = records.name[Constants.DEFAULT_LANGUAGE_CODE];
						});
						callback(null, restaurantList);
					}).catch(next);
				},
			},(parallelErr, parallelResponse)=>{
				if(parallelErr) return next(parallelErr);

				if(!parallelResponse.category_list || !parallelResponse.restaurant_list){
					return resolve({status : Constants.STATUS_SUCCESS,category_list : ""});
				}

				let categoryList 		=	parallelResponse.category_list;
				let restaurantList 		=	parallelResponse.restaurant_list;
				let finalCategoryList 	=   "";

				Object.keys(restaurantList).map(restaurantId=>{
					let restaurantName = (restaurantList[restaurantId]) ? restaurantList[restaurantId] :"";

					if(categoryList[restaurantId]){
						finalCategoryList += "<optgroup label='"+restaurantName+"'>";

						categoryList[restaurantId].map(records=>{
							let categoryId 	 = records._id;
							let categoryName = records.name[Constants.DEFAULT_LANGUAGE_CODE];
							let selectedFlag = "";

							if(categoryIds.length >0){
								categoryIds.map(tempCategoryId=>{
									if(String(tempCategoryId) == categoryId) selectedFlag ="selected";
								});
							}
							finalCategoryList += '<option value="'+records._id+'" '+selectedFlag+'>'+categoryName+'</option>';
						});

						finalCategoryList += "</optgroup>";
					}
				});

				/** Send success response */
				resolve({
					status      	: Constants.STATUS_SUCCESS,
					category_list 	: finalCategoryList
				});
			});
		}).catch(next);
	};//End categoryListHtml()

	/**
	 * Function for get item list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async itemList (req, res, next){
		this.itemListWithHtml(req,res,next,req.body).then(response=>{
			res.send(response);
		}).catch(next);
	};//End itemList()

	/**
	 * Function to get item list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async itemListWithHtml (req,res,next,options){
		return new Promise(resolve=>{
			let restaurantIds 	= (options.restaurant_ids) 	? options.restaurant_ids 	:[];
			let branchIds 		= (options.branch_ids) 	 	? options.branch_ids  		:[];
			let categoryIds 	= (options.category_ids) 	? options.category_ids  	:[];
			let itemIds 		= (options.item_ids) 		? options.item_ids  		:[];
			let onlyList 		= (options.only_list) 		? JSON.parse(options.only_list) :false;

			if(restaurantIds.length <= 0 || categoryIds.length <= 0) return resolve({status : Constants.STATUS_SUCCESS,item_list : ""});

			restaurantIds 	= Helper.arrayToObject(restaurantIds);
			branchIds 		= Helper.arrayToObject(branchIds);
			categoryIds 	= Helper.arrayToObject(categoryIds);

			console.log("options ",options)

			asyncParallel({
				item_list :(callback)=>{
					/** Set conditions */
					let linkItemConditions = {
						restaurant_id : {$in: restaurantIds},
						$or : [
							{
								type : Constants.ITEM_NOT_LISTED_TO_SELECTED_BRANCH_LIST,
								branch_ids: { $nin: branchIds}
							},
							{
								type: Constants.ITEM_LISTED_TO_SELECTED_BRANCH_LIST,
								$or : [
									{branch_ids	: { $size: 0} },
									{branch_ids : { $in: branchIds } }
								]
							}
						]
					};

					/** Get item ids  */
					const item_linkings = this.db.collection(Tables.ITEM_LINKINGS);
					item_linkings.distinct("item_id",linkItemConditions).then(itemIds=>{

						/** Get item ids  */
						const items = this.db.collection(Tables.ITEMS);
						items.find({
							_id 	  : {$in : itemIds},
							is_active : Constants.ACTIVE,
							$or 	  : [
								{category_ids	: { $size: 0} },
								{category_ids   : { $in: categoryIds } }
							]
						},{ projection: { restaurant_id: 1,name:1,item_price:1 } }).toArray().then(result=>{
							if(result.length <=0) return  callback(null,null);

							/** Manage list  */
							let itemsList = {};
							result.map(records=>{
								if(!itemsList[records.restaurant_id]) itemsList[records.restaurant_id] =[];

								itemsList[records.restaurant_id].push(records);
							});
							callback(null, itemsList);
						}).catch(next);
					}).catch(next);
				},
				restaurant_list:(callback)=>{
					/** Get list of restaurants  **/
					const restaurants  = this.db.collection(Tables.RESTAURANTS);
					restaurants.find({
						_id 		: {$in : restaurantIds},
						status		: Constants.ACTIVE,
						is_deleted	: Constants.NOT_DELETED,
					},{projection: {_id:1,name:1}}).toArray().then(result=>{
						if(result.length <=0) return  callback(null,null);

						/** Manage list  */
						let restaurantList = {};
						result.map(records=>{
							restaurantList[records._id] = records.name[Constants.DEFAULT_LANGUAGE_CODE];
						});
						callback(null, restaurantList);
					}).catch(next);
				},
			},(parallelErr, parallelResponse)=>{
				if(parallelErr) return next(parallelErr);

				let itemList 		=	parallelResponse.item_list;
				let restaurantList 	=	parallelResponse.restaurant_list;
				let finalItemList 	=   "";

				if(onlyList){
					finalItemList = [];

					Object.keys(restaurantList).map(restaurantId=>{
						if(itemList && itemList[restaurantId]){
							finalItemList.push({
								restaurant_id 	: restaurantId,
								restaurant_name : restaurantList[restaurantId],
								item_list 		: itemList[restaurantId],
							});
						}
					});
				}else{
					Object.keys(restaurantList).map(restaurantId=>{
						let restaurantName = (restaurantList[restaurantId]) ? restaurantList[restaurantId] :"";

						if(itemList && itemList[restaurantId]){
							finalItemList += "<optgroup label='"+restaurantName+"'>";

							itemList[restaurantId].map(records=>{
								let itemId  		=  records._id;
								let itemName 		=  records.name[Constants.DEFAULT_LANGUAGE_CODE];
								let selectedFlag 	= "";

								if(itemIds.length >0){
									itemIds.map(tempItemId=>{
										if(String(tempItemId) == itemId) selectedFlag ='selected';
									});
								}

								finalItemList += `<option value='${records._id}' ${selectedFlag}>${itemName}</option>`;
							});

							finalItemList += "</optgroup>";
						}
					});
				}

				console.log('finalItemList ',finalItemList)

				/** Send success response */
				resolve({
					status    : Constants.STATUS_SUCCESS,
					item_list : finalItemList
				});
			});
		}).catch(next);
	};//End itemListWithHtml()

	/**
	 * Function for update offer status
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async updateOfferStatus (req, res, next){
		let offerStatus	= (req.params.status == Constants.ACTIVE) ? Constants.DEACTIVE 	:Constants.ACTIVE;

		/** Update offers status **/
		this.collectionDb.updateOne({
			_id : new ObjectId(req.params.id)
		},
		{$set : {
			is_active 	: offerStatus,
			modified	: Helper.getUtcDate()
		}}).then(()=>{

			/** Send success response **/
			req.flash(Constants.STATUS_SUCCESS,res.__("admin.offer_management.offer_status_has_been_updated_successfully"));
			res.redirect(Constants.WEBSITE_ADMIN_URL+"offer_management");
		}).catch(next);
	};//End updateOfferStatus()

	/**
	 * Function for get restaurant list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async restaurantList (req, res, next){
		let restauarantType = req.body.restaurant_type;

		/** Send error response */
		if(!restauarantType) return res.send({status: Constants.STATUS_ERROR, message :res.__("admin.system.something_going_wrong_please_try_again") });

		/** Set conditions */
		let conditions = {};
		if(restauarantType == Constants.REDEEMED_FOR_ALL_RESTAURANTS_DELIVERED_BY_CRAVEZ){
			conditions = {
				delivery_by : {$in : [Constants.DELIVERY_BY_CRAVEZ]}
			}
		}else if(restauarantType == Constants.REDEEMED_FOR_ALL_RESTAURANTS_DELIVERED_BY_RESTAURANT){
			conditions = {
				delivery_by : {$in : [Constants.DELIVERY_BY_RESTAURANT]}
			}
		}

		/** Get restaurant ids  */
		const restaurant_details = this.db.collection(Tables.RESTAURANT_DETAILS);
		restaurant_details.distinct("restaurant_id",conditions).then(restaurantIds=>{

			/** Set options for restaurant list **/
			let options = {
				collections :[
					{
						collection : Tables.RESTAURANTS,
						columns    :  ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
						conditions : {
							_id 		: {$in : restaurantIds},
							status		: Constants.ACTIVE,
							is_deleted	: Constants.NOT_DELETED,
						}
					},
				]
			}

			/**Get restaurant list **/
			Helper.getDropdownList(req,res, next,options).then(dropDownResponse=> {
				if(dropDownResponse.status != Constants.STATUS_SUCCESS) return res.send({status: Constants.STATUS_ERROR, message :res.__("admin.system.something_going_wrong_please_try_again") });

				res.send({
					status       	: Constants.STATUS_SUCCESS,
					restaurant_list : dropDownResponse.final_html_data["0"]
				});
			}).catch(next);
		}).catch(next);
	};//End restaurantList()

	/**
	 *  Function get user List
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
	*/
	async getUsersList (req, res, next){
		let limit 	=	(req.body.length) 	? 	parseInt(req.body.length) 	:10;
		let page 	= 	(req.body.page) 	?	parseInt(req.body.page)		:1;
		let name 	= 	(req.body.q) 		?	req.body.q  				:"";
		let userIds = 	(req.body.user_ids) ? 	Helper.arrayToObject(req.body.user_ids.split(","))  :[];
		let skip 	= 	(limit*page)-limit;

		/** Set conditions */
		let conditions = clone(Constants.CUSTOMER_COMMON_CONDITIONS);
		if (userIds.length >0) conditions['_id'] = {$nin: userIds};
		if (name){
			conditions["$or"] = [
				{full_name : { $regex: name, $options: 'i' } },
				{mobile_number : { $regex: name, $options: 'i' } },
			];
		}

		const users	= this.db.collection(Tables.USERS);
		asyncParallel({
			records : (callback)=>{
				/** Get user list */
				users.aggregate([
					{$match		: conditions},
					{$sort		: {full_name: Constants.SORT_ASC}},
					{$skip		: skip },
					{$limit		: limit},
					{$project	: {_id:1,full_name: 1,mobile_number:1}},
				]).toArray().then(result=>{
					if(result.length ==0) return callback(null, result);

					let tmpUserList = [];
					result.map(record=>{
						tmpUserList.push({
							id 		: record._id,
							text 	: record.full_name+((record.mobile_number) ? "("+record.mobile_number+")" :""),
						});
					});
					callback(null,tmpUserList);
				}).catch(next);
			},
			selected_user : (callback)=>{
				if(userIds.length ==0 || page != 1) return callback(null,[]);

				/** Set conditions */
				let selectedConditions = {
					_id			:	{$in: userIds},
					user_role_id:	Constants.CUSTOMER,
					is_deleted	: 	Constants.NOT_DELETED,
				};

				if (name) selectedConditions['full_name'] = { $regex: name, $options: 'i' }

				/** Get pervious selected user list */
				users.aggregate([
					{$match		: selectedConditions},
					{$sort		: {full_name: Constants.SORT_ASC}},
					{$project	: {_id:1,full_name: 1,mobile_number:1}},
				]).toArray().then(result=>{
					if(result.length ==0) return callback(null, result);

					let tmpUserList = [];
					result.map(record=>{
						tmpUserList.push({
							id 		: record._id,
							text 	: record.full_name+((record.mobile_number) ? "("+record.mobile_number+")" :""),
						});
					});
					callback(null,tmpUserList);
				}).catch(next);
			},
			count : (callback)=>{
				/** Get user count */
				users.countDocuments(conditions).then(countResult=>{
					callback(null,countResult);
				}).catch(next);
			},
		},(asyncErr,response)=>{
			let userList 		= (response.records) ? response.records :[];
			let selectedList 	= (response.selected_user) ? response.selected_user :[];
			let finalList 		=	selectedList.concat(userList);

			res.send({
				result			: finalList,
				selected_user	: selectedList,
				total_count 	: response.count
			});
		});
	};//end getUsersList()
}