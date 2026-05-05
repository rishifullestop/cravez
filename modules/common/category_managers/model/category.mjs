import { ObjectId } from 'mongodb';
import { parallel as asyncParallel, each as asyncEach } from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import {isPost, sanitizeData, getUtcDate, configDatatable, getUniqueId, getRestaurantDetails, getDropdownList, getRestaurantId, moveUploadedFile, appendFileExistData, arrayToObject,getRestaurantDropdowns,copyFromParentTable,isAdmin} from '../../../../utils/index.mjs';
import {sendMailToUsers,insertNotifications,saveUserActivity} from '../../../../services/index.mjs';

export default class Category {
    constructor(db) {
        this.db = db;
    }

	/**
	 * Function to get categories list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async getCategoryList (req,res,next){
		let slug 	= (req.params && req.params.slug) 	?	req.params.slug 	:"";
		let cuisines= (req.query && req.query.cuisine)	?	req.query.cuisine	:"";

		if(isPost(req)){
			let limit		 = (req.body.length) ? parseInt(req.body.length) :FRONT_LISTING_LIMIT;
			let skip		 = (req.body.start)  ? parseInt(req.body.start)  :DEFAULT_SKIP;
			let cuisineId	 = (req.body.cuisine_id)	?	req.body.cuisine_id	:"";
			const collection = this.db.collection(Tables.RESTAURANT_CATEGORIES);

			/** Configure Datatable conditions*/
			const dataTableConfig = await configDatatable(req, res, null);

			/** Set  Common Conditions **/
			let commonConditions = {restaurant_slug : slug};

			/** Add cuisine id  Conditions **/
			if(cuisineId) dataTableConfig.conditions.cuisine_id = new ObjectId(cuisineId);

			/** Datatable conditions assign in a object*/
			dataTableConfig.conditions = Object.assign(dataTableConfig.conditions,commonConditions);

			// Get list or count of categories
			let dbRes = await collection.aggregate([
				{$match: dataTableConfig.conditions },
				{$facet : {
					list : [
						{$sort: dataTableConfig.sort_conditions },
						{$skip: skip },
						{$limit: limit },
						{$lookup : {
							from : Tables.CUISINES,
							localField: "cuisine_id",
							foreignField: "_id",
							as : "cuisine_data"
						}},
						{$project: {
							_id:1,category_id:1,image:1,name:1,status:1,is_active:1,
							cuisine_name: {"$arrayElemAt":["$cuisine_data.name."+Constants.DEFAULT_LANGUAGE_CODE,0]}
						}}
					],
					count: [
						{$count: "count"},
					],
				}}
			]).toArray();

			/** Appened image with full path **/
			let list = dbRes?.[0]?.list || [];
			appendFileExistData({
				"file_url" 		 : Constants.CATEGORIES_FILE_URL,
				"file_path" 	 : Constants.CATEGORIES_FILE_PATH,
				"result" 		 : list,
				"database_field" : "image"
			}).then(response=>{
				/** Send response **/
				res.send({
					status: Constants.STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data			:   response?.result || [],
					recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
					recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
				});
			}).catch(next);
		}else{
			let cuisineResponse = await this.getRestaurantCuisineList(req,res,next,{slug: slug, cuisine_ids:[cuisines]});

			/** Render lisitng page  **/
			res.render('list',{
				layout		:	false,
				slug		: 	slug,
				cuisine_list:	(cuisineResponse.result) ? cuisineResponse.result :"",
			});
		}
	};//End getCategoryList()

	/**
	 * Function to get category detail
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	async getCategoryDetails  (req, res, next){
		try{
			let categoryId = req?.params?.id || "";
			let slug	   = req?.params?.slug ||"";

			/** Get category details **/
			const restaurant_categories = this.db.collection(Tables.RESTAURANT_CATEGORIES);
			let result = await restaurant_categories.findOne({
				_id  : new ObjectId(categoryId),
                restaurant_slug : slug
			},{projection: {_id:1,image:1,order:1,name:1,cuisine_id:1,category_id:1,tags:1}});

			/** Send error response */
		    if(!result) return {status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") };

            /** Appened image with full path **/
            let imageResponse = await appendFileExistData({
                "file_url" 		 : Constants.CATEGORIES_FILE_URL,
                "file_path" 	 : Constants.CATEGORIES_FILE_PATH,
                "result" 		 : [result],
                "database_field" : "image"
            });

            /** Send success response **/
            return {
                status	: Constants.STATUS_SUCCESS,
                result	: imageResponse?.result?.[0] || {}
            };
		}catch(err){
			next(err);
		}
	};// End getCategoryDetails()

	/**
	 * Function for add or update category
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async addEditCategory (req, res,next){
		let isEditable	=	req?.params?.id || false;
		let slug  		= 	req?.params?.slug || "";
		if(isPost(req)){
			/** Sanitize Data **/
			req.body  		=	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let categoryId	= 	(req.params.id) ? 	new ObjectId(req.params.id) :new ObjectId();
			let authUserId	=	req.session.user._id;
			let categoryNumber=	req?.body?.category_number || "";
			let tags 		=	req?.body?.tags || "";
			let nameEnglish = 	req?.body?.name_english || "";
			let nameArabic  =	req?.body?.name_arabic || "";
			let collection	=	this.db.collection(Tables.RESTAURANT_CATEGORIES);

			asyncParallel({
				category_unique_id : (callback)=>{
					if(categoryNumber) return callback(null,categoryNumber);
					if(isEditable) return callback(null,null);

					/** get category unqiue id **/
					getUniqueId(req,res,next,{type:"categories"}).then(uniqueIdResponse=>{
						callback(null,uniqueIdResponse?.result || "");
					}).catch(next);
				},
				restaurant_details : (callback)=>{
					/** Get restaurant details **/
					getRestaurantDetails(req,res,next,{slug: slug}).then(restaurantResponse=>{
						if(restaurantResponse.status != Constants.STATUS_SUCCESS) return callback(restaurantResponse);
						callback(null,restaurantResponse.result);
					}).catch(next);
				}
			},(err,response)=> {
				if(err) return next(err);

				let categoryUniqueId = (response.category_unique_id)?	response.category_unique_id :"";
				let restaurantDetails= (response.restaurant_details)? 	response.restaurant_details :{};
				let restaurantId	 = (restaurantDetails._id) 		? 	restaurantDetails._id 		:"";
				let restaurantName	 = (restaurantDetails.default_name)? restaurantDetails.default_name :"";

				/** Upload category image **/
				let fileToUpload  = (req.files && req.files.image) ? req.files.image  : "";
				let oldImage 	  = (req.body.old_image) ? req.body.old_image  : "";
				moveUploadedFile(req, res, {
					'image'	  : fileToUpload,
					'filePath': Constants.CATEGORIES_FILE_PATH,
					'oldPath' : oldImage,
					'ignore_unlink' : true
				}).then(imageResponse => {
					if (imageResponse.status == Constants.STATUS_ERROR) {
						/** Send error response **/
						return res.send({
							status : Constants.STATUS_ERROR,
							message: [{ 'param': 'image', 'msg': imageResponse.message }],
						});
					}

					let tagValues = tags.split(",");
					if(!isEditable) tagValues.push(nameEnglish,nameArabic);

					/** set data in object **/
					let updateData = {
						name : {
							ar : nameArabic,
							en : nameEnglish
						},
						order	   	: req.body.order 		? 	parseInt(req.body.order) 		:0,
						cuisine_id	: req.body.cuisine_id	?	new ObjectId(req.body.cuisine_id):"",
						tags        : tagValues,
						modified   	: getUtcDate()
					};

					/** if user upload new image **/
					if(imageResponse.fileName) updateData['image'] = imageResponse.fileName;

					let isAdminUser = isAdmin(req,res);
					if(!isAdminUser){
						collection = this.db.collection(Tables.TMP_RESTAURANT_CATEGORIES);

						updateData.status	=	Constants.PENDING;
						updateData.user_id	= 	new ObjectId(authUserId);
					}

					/** Save category details **/
					collection.updateOne({
						_id : categoryId
					},
					{
						$set : updateData,
						$setOnInsert: {
							restaurant_slug	: 	slug,
							restaurant_id	: 	restaurantId,
							category_id 	: 	categoryUniqueId,
							added_by		: 	new ObjectId(authUserId),
							is_active		:	Constants.ACTIVE,
							channel_id		:	req.session.user.channel_id,
							created     	:	getUtcDate()
						}
					},{upsert: true}).then(() => {

						/** Set message **/
						let updateMessage	= (isAdminUser) ? res.__("categories.category_has_been_updated_successfully") : res.__("categories.category_has_been_updated_and_send_for_approval");
						let addMessage		= (isAdminUser) ? res.__("categories.category_has_been_added_successfully") : res.__("categories.category_has_been_added_and_send_for_approval");
						let message			= (isEditable) ? updateMessage :addMessage;

						/* success response*/
						if(!isEditable) req.flash(Constants.STATUS_SUCCESS,message);
						res.send({status: Constants.STATUS_SUCCESS, message: message});

						/*************** Send notification  ***************/
							if(!isAdminUser){
								insertNotifications(req,res,{
									notification_data : {
										notification_type:	Constants.NOTIFICATION_RESTAURANT_CATEGORY_APPROVAL_REQUEST,
										message_params 	:	[nameEnglish,restaurantName],
										parent_table_id : 	categoryId,
										user_role_id 	: 	Constants.CRAVEZ,
										role_id 		: 	[Constants.CRAVEZ,Constants.CONTENT_TEAM],
										only_for_user_role:	true,
										extra_parameters: 	{
											restaurant_slug	: slug,
											channel_id		: req.session.user.channel_id,
										}
									}
								}).then(()=>{});
							}
						/*************** Send notification  ***************/

						/** Save user activities **/
						saveUserActivity(req,res,{
							user_id 			: authUserId,
							parent_type 		: Tables.RESTAURANT_CATEGORIES,
							parent_id 			: new ObjectId(categoryId),
							activity_type		: Constants.ACTIVITY_ADD_EDIT_DETAILS,
							additional_details	: {restaurant_id: new ObjectId(restaurantId),channel_id: req.session.user.channel_id},
						}).then(()=>{});
					}).catch(next);
				}).catch(next);
			});
		}else{
			let response = {};
			if(isEditable){
				/** Get category details **/
				response  =	await this.getCategoryDetails(req, res, next);

				/** Send error response **/
				if(response.status != Constants.STATUS_SUCCESS) return res.status(400).send(response);
			}

			let result    = (response.result) 	?	response.result 	:{};
			let cuisineId = (result.cuisine_id)	? 	[result.cuisine_id] :[];

			/** Get cuisine dropdown list  */
			let cuisineResponse = await this.getRestaurantCuisineList(req,res,next,{slug: slug, cuisine_ids: cuisineId});

			/** Render add/edit page  **/
			res.render('add_edit',{
				layout		: false,
				result		: result,
				is_editable	: isEditable,
				cuisine_list: (cuisineResponse.result)	?	cuisineResponse.result	:""
			});
		}
	};//End addEditCategory()

	/**
	 * Function to get pending categories list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async getPendingCategoryList (req,res,next){
        try{
            let slug = req?.params?.slug || "";
            let type = req?.params?.type || false;

            if(isPost(req)){
                let limit		 = 	(req.body.length) 	?	parseInt(req.body.length) :Constants.FRONT_LISTING_LIMIT;
                let skip		 = 	(req.body.start)	? 	parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
                const collection =	this.db.collection(Tables.TMP_RESTAURANT_CATEGORIES);

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);

                /** Set  Common Conditions **/
                let commonConditions = {};
                if(!type) commonConditions = { restaurant_slug: slug};

                /** Add status conditions */
                if(isAdmin(req,res)) commonConditions.status = {$in : [Constants.PENDING,Constants.IN_REVIEW]};

                /** Datatable conditions assign in a object*/
                dataTableConfig.conditions = Object.assign(commonConditions,dataTableConfig.conditions);

                let listPipeline = [];
                if(type){
                    listPipeline.push({
                        $lookup: {
                            from: Tables.RESTAURANTS,
                            localField: "restaurant_id",
                            foreignField: "_id",
                            as: "restaurant_data"
                        }
                    });
                }

                // Get list or count of categories
                let dbRes = await collection.aggregate([
                    {$match: dataTableConfig.conditions },
                    {$facet : {
                        list : [
                            ...[
                                {$sort: dataTableConfig.sort_conditions },
                                {$skip: skip },
                                {$limit: limit },
                                {$lookup : {
                                    from : Tables.CUISINES,
                                    localField: "cuisine_id",
                                    foreignField: "_id",
                                    as : "cuisine_data"
                                }},
                            ],
                            ...listPipeline,
                            ...[
                                {$project: {
                                    _id:1,image:1,name:1, status: 1, rejection_msg: 1,is_active:1, restaurant_slug:1,
                                    cuisine_name: {"$arrayElemAt":["$cuisine_data.name."+Constants.DEFAULT_LANGUAGE_CODE,0]},
                                    restaurant_name: {"$arrayElemAt":["$restaurant_data.default_name",0]}
                                }}
                            ]
                        ],
                        count: [
                            {$count: "count"},
                        ],
                    }}
                ]).toArray();

                /** Appened image with full path **/
                let list = dbRes?.[0]?.list || [];
                appendFileExistData({
                    "file_url" 		 : Constants.CATEGORIES_FILE_URL,
                    "file_path" 	 : Constants.CATEGORIES_FILE_PATH,
                    "result" 		 : list,
                    "database_field" : "image"
                }).then(response=>{
                    /** Send response **/
                    res.send({
                        status: Constants.STATUS_SUCCESS,
                        draw: dataTableConfig.result_draw,
                        data			:   response?.result || [],
                        recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
                        recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
                    });
                }).catch(next);
            }else{
                let searchStatus    =   req?.query?.status || "";
                let restaurantList  =   "";
                if(type){
                    restaurantList = await getRestaurantDropdowns(req,res,next,{slug: req?.query?.restaurant || ""});
                }

                /** Render lisitng page  **/
                res.render('pending_list',{
                    layout			: false,
                    slug			: slug,
                    type			: type,
                    search_status 	: searchStatus,
                    restaurant_list	: restaurantList,
                });
            }
        }catch(err){
            next(err);
        }
	};//End getPendingCategoryList()

	/**
	 * Function for update pending category
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async editPendingCategory (req, res,next){
		let slug  		= 	req?.params?.slug || "";
		let categoryId	=	req?.params?.id || "";

		const tmp_restaurant_categories = this.db.collection(Tables.TMP_RESTAURANT_CATEGORIES);
		if(isPost(req)){
			/** Sanitize Data **/
			req.body  		=	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let authUserId	=	req.session.user._id;
			let tags 		=	req?.body?.tags || "";
			let nameEnglish = 	req?.body?.name_english || "";
			let nameArabic  =	req?.body?.name_arabic  || "";

			asyncParallel({
				restaurant_details : (callback)=>{
					/** find restaurant details **/
					getRestaurantDetails(req,res,next,{slug: slug}).then(restaurantResponse=>{
						if(restaurantResponse.status != Constants.STATUS_SUCCESS) return callback(restaurantResponse);
						callback(null,restaurantResponse.result);
					}).catch(next);
				},
				current_category_details : (callback)=>{
					/** Get category details **/
					tmp_restaurant_categories.findOne({_id: new ObjectId(categoryId), restaurant_slug: slug },{projection: { _id: 1,status:1}}).then(result=>{
						callback(null, result);
					}).catch(next);
				},
			},(err,response)=> {
				if(err) return next(err);

				let restaurantDetails= (response.restaurant_details)? 	response.restaurant_details :{};
				let restaurantId	 = (restaurantDetails._id) 		? 	restaurantDetails._id 		:"";
				let restaurantName	 = (restaurantDetails.default_name)? restaurantDetails.default_name :"";
				let currentCategoryDetails	 = (response.current_category_details)	? response.current_category_details :{};

				/** Upload category image **/
				let fileToUpload  = (req.files && req.files.image) ? req.files.image  : "";
				let oldImage 	  = (req.body.old_image) ? req.body.old_image  : "";
				moveUploadedFile(req, res, {
					'image'	  : fileToUpload,
					'filePath': Constants.CATEGORIES_FILE_PATH,
					'oldPath' : oldImage,
					'ignore_unlink' : true
				}).then(imageResponse => {
					if (imageResponse.status == Constants.STATUS_ERROR) {
						/** Send error response **/
						return res.send({
							status : Constants.STATUS_ERROR,
							message: [{ 'param': 'image','msg': imageResponse.message }],
						});
					}

					/** Set updated data */
					let updateData = {
						name : {
							ar : nameArabic, en : nameEnglish
						},
						user_id		: new ObjectId(authUserId),
						order	   	: parseInt(req.body.order),
						cuisine_id	: new ObjectId(req.body.cuisine_id),
						tags        : tags.split(","),
						modified   	: getUtcDate()
					}

					if(!isAdmin(req,res))  updateData.status = Constants.PENDING;

					/** if user upload new image **/
					if(imageResponse.fileName) updateData['image'] = imageResponse.fileName;

					/** Save category details **/
					tmp_restaurant_categories.updateOne({_id : categoryId },{$set: updateData, $unset :{rejection_msg:1}}).then(() => {

						/** Send success response **/
						res.send({
							status	:	Constants.STATUS_SUCCESS,
							message	: 	 (isAdmin(req,res) || currentCategoryDetails.status != Constants.REJECTED) ? res.__("categories.category_has_been_updated_successfully") : res.__("categories.pending_category_has_been_updated_and_send_for_approval")
						});

						if(currentCategoryDetails.status == Constants.REJECTED){
							/*************** Send notification  ***************/
								insertNotifications(req,res,{
									notification_data : {
										notification_type:	Constants.NOTIFICATION_RESTAURANT_CATEGORY_APPROVAL_REQUEST,
										message_params 	:	[nameEnglish,restaurantName],
										parent_table_id : 	categoryId,
										user_role_id 	: 	Constants.CRAVEZ,
										role_id 		: 	[Constants.CRAVEZ,Constants.CONTENT_TEAM],
										only_for_user_role:	true,
										extra_parameters: 	{
											restaurant_slug	: slug,
											channel_id		: req.session.user.channel_id
										}
									}
								}).then(()=>{});
							/*************** Send notification  ***************/
						}

						/** Save user activities **/
						saveUserActivity(req,res,{
							user_id 			: authUserId,
							parent_type 		: Tables.RESTAURANT_CATEGORIES,
							parent_id 			: new ObjectId(categoryId),
							activity_type		: Constants.ACTIVITY_ADD_EDIT_DETAILS,
							additional_details	: {restaurant_id: new ObjectId(restaurantId),channel_id: req.session.user.channel_id},
						}).then(()=>{});
					}).catch(next);
				}).catch(next);
			});
		}else{
			/** Get category details **/
			tmp_restaurant_categories.findOne({
				_id: new ObjectId(categoryId),
				restaurant_slug: slug
			},{projection: {_id:1,image:1,order:1,name:1,cuisine_id:1,tags:1}}).then(result=>{

				/** Send error response **/
				if(!result) return res.status(400).send({status: Constants.STATUS_ERROR,message: res.__("system.invalid_access")});

				let cuisineId = (result.cuisine_id)	? [result.cuisine_id] :[];
				asyncParallel({
					cuisine_list : (callback)=>{
						/** Get cuisine dropdown list  */
						this.getRestaurantCuisineList(req,res,next,{slug: slug, cuisine_ids: cuisineId}).then(cuisineResponse=>{
							callback(null,cuisineResponse?.result || "");
						}).catch(next);
					},
					category_details : (callback)=>{
						/** Appened image with full path **/
						appendFileExistData({
							"file_url" 		 : Constants.CATEGORIES_FILE_URL,
							"file_path" 	 : Constants.CATEGORIES_FILE_PATH,
							"result" 		 : [result],
							"database_field" : "image"
						}).then(imageResponse=>{
							callback(null,imageResponse?.result?.[0] || {});
						}).catch(next);
					}
				},(asyncErr, asyncResponse)=> {
					if(asyncErr) return res.status(400).send({status: Constants.STATUS_ERROR,message: res.__("system.invalid_access")});

					/** Render edit page  **/
					res.render('pending_edit',{
						layout		: false,
						result		: asyncResponse?.category_details || {},
						cuisine_list: asyncResponse?.cuisine_list || ""
					});
				});
			}).catch(next);
		}
	};//End editPendingCategory()

	/**
	 * Function for update restaurant pending category's status
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
	 */
	async updatePendingCategoryStatus (req,res,next){
		let categoryId	=	req?.body?.category_id || "";
		let status		=	req?.body?.status || "";

		/** Send error response **/
		if(!categoryId && status != Constants.IN_REVIEW && status != Constants.REJECTED && status != Constants.APPROVED){
			return res.send({status: Constants.STATUS_ERROR, message:	res.__("system.invalid_access") });
		}

		/** Get restaurant category details */
		const tmp_restaurant_categories	= this.db.collection(Tables.TMP_RESTAURANT_CATEGORIES);
		tmp_restaurant_categories.findOne({
			_id 	: 	new ObjectId(categoryId),
			status	:	{$in : [Constants.PENDING,Constants.IN_REVIEW]},
		},{projection: {_id:1, name: 1, restaurant_slug: 1, restaurant_id:1, user_id:1}}).then(result=>{

			/** Send error response **/
			if(!result) return res.send({status: Constants.STATUS_ERROR, message:	res.__("system.invalid_access") });

			let restaurantSlug	=	(result.restaurant_slug)	?	result.restaurant_slug	:"";
			asyncParallel({
				update_category_details :(callback)=>{
					if(status == Constants.APPROVED) return callback(null);

					/** Set updated Data  */
					let updateData = {
						status 	:	parseInt(status),
						modified: 	getUtcDate(),
					};

					if(status == Constants.REJECTED) updateData.rejection_msg = req.body.reject_msg;

					/** Update restaurant category details */
					tmp_restaurant_categories.updateOne({_id : new ObjectId(categoryId) },{$set :updateData}).then(()=>{
						callback(null);
					}).catch(next);
				},
				approve_category_details:(callback)=>{
					if(status != Constants.APPROVED) return callback(null);

					/** Copy data  tmp_restaurant_categories to  restaurant_categories collections*/
					copyFromParentTable(req,res,next,{
						parent_table : {
							name 			:	Tables.TMP_RESTAURANT_CATEGORIES,
							fields 			: 	{_id:0, status:0,user_id:0},
							conditions 		: 	{_id: new ObjectId(categoryId), restaurant_slug: restaurantSlug},
							remove_original : 	true
						},
						child_table : {
							name 		: 	Tables.RESTAURANT_CATEGORIES,
							conditions	:	{_id: new ObjectId(categoryId), restaurant_slug: restaurantSlug},
						}
					}).then(response=>{
						if(response.status != Constants.STATUS_SUCCESS) return  callback(response);
						callback(null);
					}).catch(next);
				},
				update_approved_category:(callback)=>{

					/** Set update data */
					let updateData ={
						$set :{
							status : parseInt(status),
						}
					};

					if(status != Constants.IN_REVIEW){
						updateData ={
							$unset :{
								status : 1,
							}
						}
					}

					/** Update restaurant category details */
					const restaurant_categories	= this.db.collection(Tables.RESTAURANT_CATEGORIES);
					restaurant_categories.updateOne({_id : new ObjectId(categoryId) },updateData).then(()=>{
						callback(null);
					}).catch(next);
				},
			},(asyncErr)=>{
				if(asyncErr) return next(asyncErr);

				/** Send success response **/
				res.send({
					status	: 	Constants.STATUS_SUCCESS,
					message	:	res.__("categories.category_status_has_been_updated_successfully")
				});

				/*************** Send Mail  ***************/
					if(status != Constants.IN_REVIEW){
						let categoryName = (result.name && result.name[Constants.DEFAULT_LANGUAGE_CODE])	?	result.name[Constants.DEFAULT_LANGUAGE_CODE]	:"";
						sendMailToUsers(req,res,{
							event_type 		:	(status == Constants.REJECTED) ? Constants.RESTAURANT_CATEGORY_REJECT_EMAIL_EVENTS :Constants.RESTAURANT_CATEGORY_APPROVE_EMAIL_EVENTS,
							category_id		: 	categoryId,
							category_name	: 	categoryName,
							restaurant_slug	: 	restaurantSlug,
							restaurant_id	: 	(result.restaurant_id)	?	result.restaurant_id	:"",
							user_id			: 	(result.user_id)		?	result.user_id			:"",
							reject_msg		: 	(req.body.reject_msg)	?	req.body.reject_msg		:""
						});
					}
				/*************** Send Mail  ***************/

				/** Save user activities **/
				let authId = (req.session.user && req.session.user._id) ? new ObjectId(req.session.user._id) :"";
				saveUserActivity(req,res,{
					user_id 		:	authId,
					parent_id 		: 	categoryId,
					parent_type 	:	Tables.RESTAURANT_CATEGORIES,
					activity_type	:	Constants.ACTIVITY_UPDATE_STATUS,
					additional_details:	{status: status,channel_id : req.session.user.channel_id},
				});
			});
		}).catch(next);
	};//End updatePendingCategoryStatus()

	/**
	 * Function for update restaurant pending category's status
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
	 */
	async updateMultiplePendingCategoryStatus (req,res,next){
		let categoryIds	=	req?.body?.category_id?.split(",") || [];
		let status 		= 	req?.body?.status || "";

		if(!categoryIds || categoryIds.length <=0 || !status){
			/** Send error response */
			return res.send({
				status : Constants.STATUS_ERROR,
				message	: res.__("system.invalid_access")
			});
		}

		/** Convert object id */
		categoryIds = arrayToObject(categoryIds);

		/** Get restaurant enquiry details */
		const tmp_restaurant_categories	= this.db.collection(Tables.TMP_RESTAURANT_CATEGORIES);
		tmp_restaurant_categories.find({
			_id 	:	{$in : categoryIds},
			status	: 	{$nin: [Constants.APPROVED, Constants.REJECTED]}
		},{projection: {_id:1, name: 1, restaurant_slug: 1, restaurant_id:1, user_id:1}}).toArray().then(result=>{

			/** send invalid access if zero document found */
			if(!result || result.length <=0){
				return res.send({
					status : Constants.STATUS_ERROR,
					message	: res.__("system.invalid_access")
				});
			}

			asyncParallel({
				update_category_details :(callback)=>{
					if(status == Constants.APPROVED) return callback(null);

					/** Set updated Data  */
					let updateData = {
						status 	:	parseInt(status),
						modified: 	getUtcDate(),
					};

					if(status == Constants.REJECTED) updateData.rejection_msg = req.body.reject_msg;

					/** Update restaurant category details */
					tmp_restaurant_categories.updateMany({_id : {$in : categoryIds} },{$set :updateData}).then(()=>{
						callback(null);
					}).catch(next);
				},
				approve_category_details:(callback)=>{
					if(status != Constants.APPROVED) return callback(null);

					asyncEach(result,(records, parentCallback)=>{
						let tempCategoryId	= (records._id)				?	records._id				:"";
						let restaurantSlug 	= (records.restaurant_slug)	?	records.restaurant_slug	:"";

						/** Copy data  tmp_restaurant_categories to  restaurant_categories collections*/
						copyFromParentTable(req,res,next,{
							parent_table : {
								name 			:	Tables.TMP_RESTAURANT_CATEGORIES,
								fields 			: 	{_id:0, status:0,user_id:0},
								conditions 		: 	{_id: new ObjectId(tempCategoryId), restaurant_slug: restaurantSlug},
								remove_original : 	true
							},
							child_table : {
								name 		: 	Tables.RESTAURANT_CATEGORIES,
								conditions	:	{_id: new ObjectId(tempCategoryId), restaurant_slug: restaurantSlug},
							}
						}).then(response=>{
							if(response.status != Constants.STATUS_SUCCESS) return  parentCallback(response);
							parentCallback(null);
						}).catch(next);
					},(parentErr)=>{
						callback(parentErr);
					});
				},
				update_approved_category:(callback)=>{

					/** Set update data */
					let updateData ={
						$set :{
							status : parseInt(status),
						}
					};

					if(status != Constants.IN_REVIEW){
						updateData ={
							$unset :{
								status : 1,
							}
						}
					}

					/** Update restaurant category details */
					const restaurant_categories	= this.db.collection(Tables.RESTAURANT_CATEGORIES);
					restaurant_categories.updateMany({_id : {$in : categoryIds} },updateData).then(()=>{
						callback(null);
					}).catch(next);
				},
			},(asyncErr)=>{
				if(asyncErr) return next(asyncErr);

				/** Send success response **/
				res.send({
					status	: 	Constants.STATUS_SUCCESS,
					message	:	res.__("categories.category_status_has_been_updated_successfully")
				});

				/*************** Send Mail  ***************/
					if(status != Constants.IN_REVIEW){
						result.map(records=>{
							sendMailToUsers(req,res,{
								event_type 		:	(status == Constants.REJECTED) ? Constants.RESTAURANT_CATEGORY_REJECT_EMAIL_EVENTS :Constants.RESTAURANT_CATEGORY_APPROVE_EMAIL_EVENTS,
								category_id		: 	(records._id)	?	records._id	:"",
								category_name	: 	(records.name && records.name[Constants.DEFAULT_LANGUAGE_CODE])	?	records.name[Constants.DEFAULT_LANGUAGE_CODE]	:"",
								restaurant_slug	: 	(records.restaurant_slug)	?	records.restaurant_slug	:"",
								restaurant_id	: 	(records.restaurant_id)		?	records.restaurant_id	:"",
								user_id			: 	(records.user_id)			?	records.user_id			:"",
								reject_msg		: 	(req.body.reject_msg)		?	req.body.reject_msg		:""
							});
						});
					}
				/*************** Send Mail  ***************/

				/** Save user activities **/
				let authId = (req.session.user && req.session.user._id) ? new ObjectId(req.session.user._id) :"";
				saveUserActivity(req,res,{
					user_id 			:	authId,
					parent_id 			: 	categoryIds,
					parent_type 		:	Tables.RESTAURANT_CATEGORIES,
					activity_type		:	Constants.ACTIVITY_UPDATE_STATUS,
					additional_details	:	{status: status,channel_id	: req.session.user.channel_id},
				}).then(()=>{});
			});
		}).catch(next);
	};//End updateMultiplePendingCategoryStatus()

	/**
	 * Function for get restaurant cuisine list
	 *
	 * @param req 		As 	Request Data
	 * @param res 		As 	Response Data
	 * @param next 		As 	Callback argument to the middleware function
	 * @param options 	As 	object data
	 *
	 * @return null
	 */
	async getRestaurantCuisineList (req,res,next,options){
		return new Promise(async(resolve)=>{
			let slug 		= 	options?.slug || "";
			let cuisineIds	=	options?.cuisine_ids || [];

			/** Send error response **/
            if(!slug) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			/** Get restaurant id */
			let restaurantId = await getRestaurantId(req,res,next,{slug: slug});

			/** Get restaurant  selected cuisine id */
			const restaurant_cuisines = this.db.collection(Tables.RESTAURANT_CUISINES);
            let result = await restaurant_cuisines.distinct("cuisine_id",{restaurant_id: restaurantId});

            /**Get cuisine list **/
            let dropDownResponse = await getDropdownList(req,res,next,{
                collections :[{
                    collection : "cuisines",
                    columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
                    selected   : cuisineIds,
                    conditions : {_id : {$in: result}}
                }]
            });

            if(dropDownResponse.status != Constants.STATUS_SUCCESS) {
                return resolve({status: Constants.STATUS_ERROR, message: dropDownResponse.message});
            }

            /** Send success response */
            resolve({status: Constants.STATUS_SUCCESS, result: dropDownResponse?.final_html_data?.[0] || '' });
		}).catch(next);
	};//End getRestaurantCuisineList()

	/**
	 * Function for update active/ deactive category status
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return null
	 */
	async updateStatus (req, res, next){
        try{
            let categoryId = (req.params.id) ? new ObjectId(req.params.id) : "";
            let status	 = (req.params.status==Constants.ACTIVE) ? Constants.DEACTIVE : Constants.ACTIVE;

            const restaurant_categories = this.db.collection(Tables.RESTAURANT_CATEGORIES);
            await restaurant_categories.updateOne({
                _id : categoryId,
            },
            {$set : {
                is_active	 : status,
                modified 	 : getUtcDate()
            }});

            /** Save user activities **/
            saveUserActivity(req,res,{
                user_id 			:	req.session.user._id,
                parent_id 			: 	categoryId,
                parent_type 		:	Tables.RESTAURANT_CATEGORIES,
                activity_type		:	Constants.ACTIVITY_UPDATE_STATUS,
                additional_details	:	{status: status, channel_id	: req.session.user.channel_id || ""},
            }).then(()=>{});
            /** Send success response **/

            req.flash(Constants.STATUS_SUCCESS,res.__("categories.status_updated_successfully"));
            res.redirect(res.locals.base_url+"category");
        }catch(err){
            next(err);
        }
	};// end updateStatus()

	/**
	 * Function for update active/ deactive pending category status
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return null
	 */
	async updatePendingStatus (req, res, next){
        try{
            let categoryId = (req.params.id) ? new ObjectId(req.params.id) : "";
            let status	 = (req.params.status==Constants.ACTIVE) ? Constants.DEACTIVE : Constants.ACTIVE;

            const tmp_restaurant_categories = this.db.collection(Tables.TMP_RESTAURANT_CATEGORIES);
            await tmp_restaurant_categories.updateOne({
                _id 		: categoryId,
            },
            {$set : {
                is_active	 : status,
                modified 	 : getUtcDate()
            }});

            /** Save user activities **/
            saveUserActivity(req,res,{
                user_id 			:	req.session.user._id,
                parent_id 			: 	categoryId,
                parent_type 		:	Tables.RESTAURANT_CATEGORIES,
                activity_type		:	Constants.ACTIVITY_UPDATE_STATUS,
                additional_details	:	{status: status,channel_id	: req.session.user.channel_id || ""},
            });

            /** Send success response **/
            req.flash(Constants.STATUS_SUCCESS,res.__("categories.status_updated_successfully"));
            res.redirect(res.locals.list_url);
        }catch(err){
            next(err);
        }
	};// end updatePendingStatus()
}