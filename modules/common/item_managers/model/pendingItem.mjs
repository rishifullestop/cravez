import { ObjectId } from 'mongodb';
import { parallel as asyncParallel, each as asyncEach } from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, getDropdownList, getRestaurantDetails, moveUploadedFile, appendFileExistData, arrayToObject, getRestaurantDropdowns, copyFromParentTable, isAdmin, round } from '../../../../utils/index.mjs';
import { sendMailToUsers, insertNotifications, saveSystemLogs } from '../../../../services/index.mjs';

class PendingItem {
    constructor(db) {
        this.db = db;
    }

    /**
	 * Function to get pending items list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async pendingItemList(req,res,next){
		let slug = req?.params?.slug || "";
		let type = req?.params?.type || "";

		if(isPost(req)){
			let limit		 = (req?.body?.length)  ? parseInt(req?.body?.length) : Constants.ADMIN_LISTING_LIMIT;
			let skip		 = (req?.body?.start)	  ? parseInt(req?.body?.start)  : Constants.DEFAULT_SKIP;
			const collection = this.db.collection(Tables.TMP_ITEMS);

			/** Configure Datatable conditions*/
			let commonConditions = {};
			if(!type) commonConditions = { restaurant_slug: slug};

			/** Add status conditions */
			if(isAdmin(req,res)){
				commonConditions.status 			 = {$in : [Constants.PENDING,Constants.IN_REVIEW]};
				commonConditions.submit_for_approval = true;
			}

			/** Configure Datatable conditions*/
            const dataTableConfig = await configDatatable(req, res, null);
        
            dataTableConfig.conditions	= Object.assign(commonConditions,dataTableConfig.conditions);

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

            // Get list or count of pending items 
            let dbRes = await collection.aggregate([
                {$match: dataTableConfig.conditions },
                {$facet : {
                    list : [
                        ...[
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit },
                        ],
                        ...listPipeline,
                        ...[
                            {$project: {
                                _id:1,name:1,item_id:1,image:1,description:1,is_active:1,modified:1,status:1,submit_for_approval:1,restaurant_slug:1,reject_reason:1,restaurant_name: {"$arrayElemAt":["$restaurant_data.default_name",0]}
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
                "file_url" 		 : Constants.ITEMS_FILE_URL,
                "file_path" 	 : Constants.ITEMS_FILE_PATH,
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
            let restaurantList  =   "";
            if(type){
                restaurantList = await getRestaurantDropdowns(req,res,next,{slug: req?.query?.restaurant || ""});
            }

            /** Render recommended item page */
            res.render("items/pending_item",{
                layout			: false,
                slug			: slug,
                type			: type,
                search_status 	: req?.query?.status || "",
                restaurant_list	: restaurantList
            });
		}
	};//End pendingItemList()

    /**
	 * Function to get pending item's detail
	 *
	 * @param req	As	Request Data
	 * @param res	As	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return json
	*/
	async getPendingItemDetails(req,res,next){
		return new Promise(resolve=>{
			let itemId 	  =	req?.params?.id || "";
			let slug	  = req?.params?.slug || "";

			asyncParallel({
				item_details : (callback)=>{
					/** Get item details **/
					const tmp_items = this.db.collection(Tables.TMP_ITEMS);
					let itemCommonConditions = {
						_id : new ObjectId(itemId),
						restaurant_slug: slug
					};

					/** Add status conditions */
					if(isAdmin(req,res)){
						itemCommonConditions.status = {$in : [Constants.PENDING,Constants.IN_REVIEW]};
						itemCommonConditions.submit_for_approval = true;
					}
                    tmp_items.aggregate([
						{ $match	: itemCommonConditions},
						{$lookup	: {
                            from		 : Tables.CUISINES,
                            localField	 : "cuisine_id",
                            foreignField : "_id",
                            as			 : "cuisine_details",
                        }},
						{$project: {
							category_ids:1,description:1,discount_percentage:1,discount_value:1,image:1,item_price:1,menu_ids:1,name:1,non_sellable:1,price_on_selection:1,is_active:1,item_id:1,cuisine_id:1,grid_image:1,detail_image:1,
                            cuisine: { $arrayElemAt: ["$cuisine_details.name."+Constants.DEFAULT_LANGUAGE_CODE,0]},
						}},
					]).toArray().then(tmpItemResult=>{
						callback(null, tmpItemResult);
					}).catch(next);
				},
				availability_item_details : (callback)=>{
					/** Get item availability details **/
					const tmp_item_availability = this.db.collection(Tables.TMP_ITEM_AVAILABILITY);
					tmp_item_availability.find({item_id: new ObjectId(itemId) }).toArray().then(tmpAvailabilityResult=>{
						callback(null, tmpAvailabilityResult);
					}).catch(next);
				},
				item_units_details : (callback)=>{
					/** Get item unit details **/
					const tmp_item_units = this.db.collection(Tables.TMP_ITEM_UNITS);
					tmp_item_units.aggregate([
						{ $match	: {item_id: new ObjectId(itemId)}},
						{ $sort 	: {"sorting":Constants.SORT_ASC}},
						{$lookup	: {
                            from		 : Tables.ITEM_UNITS_MASTERS,
                            localField	 : "item_unit_id",
                            foreignField : "_id",
                            as			 : "item_units_masters_details",
                        }},
						{$project : { 
                            item_unit_id:1,item_id:1,discount_type:1,discount_value:1,price:1,sorting:1,status:1,item_unit: { $arrayElemAt: ["$item_units_masters_details.name."+Constants.DEFAULT_LANGUAGE_CODE,0]},
                        }},
					]).toArray().then(tmpItemUnitResult=>{
						callback(null, tmpItemUnitResult);
					}).catch(next);
				},
			},async (err,response)=>{
				if(err) return next(err);

				/** Send error response **/
				if(!response?.item_details || !response?.item_details?.length){
                    return resolve({status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") });
                }

				/** Appened image with full path **/
				let imageResponse = await appendFileExistData({
					"file_url"		: 	Constants.ITEMS_FILE_URL,
					"file_path"		: 	Constants.ITEMS_FILE_PATH,
					"result" 		: 	response.item_details,
					"database_field":	"image",
					"image_placeholder" :   "main_image"
				});                

                /** Appened grid image with full path **/
				let gridImageResponse = await appendFileExistData({
                    "file_url"		: 	Constants.ITEMS_FILE_URL,
                    "file_path"		: 	Constants.ITEMS_FILE_PATH,
                    "result" 		: 	imageResponse?.result || [],
                    "database_field":	"grid_image",
                    "image_placeholder" :   "grid_image_path"
                });

                /** Appened grid image with full path **/
				let detailImageResponse = await appendFileExistData({
                    "file_url"		: 	Constants.ITEMS_FILE_URL,
                    "file_path"		: 	Constants.ITEMS_FILE_PATH,
                    "result" 		: 	gridImageResponse?.result || [],
                    "database_field":	"detail_image",
                    "image_placeholder" :   "detail_image_path"
                });

                /** Send success response **/
                resolve({
                    status					 : 	Constants.STATUS_SUCCESS,
                    item_unit_details		 :	response.item_units_details,
                    item_availability_details:	response.availability_item_details,
                    result					 : 	detailImageResponse?.result?.[0] || {},
                });
			});
		});
	};// End getPendingItemDetails()

    /**
	 * Function to edit pending item
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async editPendingItem(req,res,next){
		let slug 	= 	req?.params?.slug || "";
		let itemId	= 	new ObjectId(req?.params?.id || "");

		if(isPost(req)){
			/** Sanitize Data **/
			req.body  				= sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let authUserId			= req?.session?.user?._id || "";
			let menuIds 			= req?.body?.menu_ids || [];
			let categoryIds 		= req?.body?.category_ids || [];
			let priceInputs 		= req?.body?.price || "";
			let availabilityInputs	= req?.body?.availability || "";
			let priceOnSelection 	= req?.body?.price_on_selection || "";

			/** Send error response */
			if(!priceInputs || !availabilityInputs)  return res.send({ status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });

			/** Add availability tab input validation **/
			let errors = [];			
			let availabilityStatus = Constants.NOT_AVAILABLE;
			availabilityInputs.map(records=>{
				if(records){
					let index =  records.index;
					if(records.from_time || records.to_time){
						availabilityStatus = Constants.AVAILABLE;

						if(!records.from_time){
							errors.push({ 'param': 'from_time_'+index, 'msg': res.__("items.please_enter_from_time") });
						}

						if(!records.to_time){
							errors.push({ 'param': 'to_time_'+index, 'msg': res.__("items.please_enter_to_time") });
						}

						if(records.from_time && records.to_time){
							let fromTime = parseFloat(records.from_time.replace(':','.'));
							let toTime   = parseFloat(records.to_time.replace(':','.'));

							if(toTime <= fromTime) errors.push({'param': 'to_time_'+index,'msg':res.__("items.to_time_greater_than_from_time")});
						}
					}
				}
			});

			/** Add price tab input validation **/
			let previousItemUnit = {};
			priceInputs.map(records=>{
				if(records){
					let index =  records.index;
					if(records.item_unit || records.price || records.discount_type || records.discount_value){

						if(!records.item_unit){
							errors.push({ 'param': 'item_unit_'+index, 'msg': res.__("items.please_select_item_unit") });
						}
						else if(previousItemUnit[records.item_unit]){
							errors.push({ 'param': 'item_unit_'+index, 'msg': res.__("items.please_select_another_item_unit") });
						}else{
							previousItemUnit[records.item_unit] = true;
						}
						if(!records.price){
							errors.push({ 'param': 'price_'+index, 'msg': res.__("items.please_enter_price") });
						}

						if(records.price && (isNaN(records.price) || records.price <=0)){
							errors.push({ 'param': 'price_'+index, 'msg': res.__("items.please_enter_valid_price") });
						}

						if(records.sorting && (isNaN(records.sorting) || records.sorting <=0)){
							errors.push({ 'param': 'sorting_'+index, 'msg': res.__("items.please_enter_valid_sorting") });
						}

						if(records.discount_value &&  (isNaN(records.discount_value) || records.discount_value <= 0)){
							errors.push({'param':'discount_value_'+index,'msg':res.__("items.please_enter_valid_discount_value")});
						}else if(records.discount_type == Constants.DISCOUNT_BY_PERCENTAGE && records.discount_value > Constants.MAX_PERCENTAGE){
							errors.push({'param':'discount_value_'+index,'msg':res.__("items.please_enter_valid_discount_value")});
						}
					}
				}
			});

			/** Send error response **/
			if(errors.length >0) return res.send({status: Constants.STATUS_ERROR, message: errors});

			let nameEnglish  = 	req.body.name_in_english;
			let nameArabic   =	req.body.name_in_arabic;
			const collection =  this.db.collection(Tables.TMP_ITEMS);
			asyncParallel({
				upload_image: (childCallback)=>{
					/** Upload image **/
					moveUploadedFile(req, res,{
						'image'	  		:	req?.files?.image || "",
						'filePath'		: 	Constants.ITEMS_FILE_PATH,
						'oldPath' 		: 	req?.body?.old_image || "",
						'ignore_unlink' : 	true
					}).then(imageFileResponse => {
						childCallback(null,imageFileResponse);
					}).catch(next);
				},
				upload_grid_image: (childCallback)=>{
					/** Upload image **/
					moveUploadedFile(req, res,{
						'image'	  		:	req?.files?.grid_image || "",
						'filePath'		: 	Constants.ITEMS_FILE_PATH,
						'oldPath' 		: 	req?.body?.old_grid_image || "",
						'ignore_unlink' : 	true
					}).then(imageOneFileResponse => {
						childCallback(null,imageOneFileResponse);
					}).catch(next);
				},
				upload_detail_image: (childCallback)=>{
					/** Upload image **/
					moveUploadedFile(req, res,{
						'image'	  		:	req?.files?.detail_image || "",
						'filePath'		: 	Constants.ITEMS_FILE_PATH,
						'oldPath' 		: 	req?.body?.old_detail_image || "",
						'ignore_unlink' : 	true
					}).then(imageTwoFileResponse => {
						childCallback(null,imageTwoFileResponse);
					}).catch(next);
				}
			},(asyncParallelErr,asyncParallelResponse)=>{
				if(asyncParallelErr) return next(asyncParallelErr);

				let imageResponse 	  = asyncParallelResponse.upload_image 	      ? asyncParallelResponse.upload_image 	     : "";
				let imageOneResponse  = asyncParallelResponse.upload_grid_image   ? asyncParallelResponse.upload_grid_image  : "";
				let imageTwoResponse  = asyncParallelResponse.upload_detail_image ? asyncParallelResponse.upload_detail_image: "";

				/** Set error if image is not in format **/
				let imageErrors = [];
				if(imageResponse.status == Constants.STATUS_ERROR) {
					imageErrors.push({'param': 'image','msg': imageResponse.message });
				}

				/** Set error if image is not in format **/
				if(imageOneResponse.status == Constants.STATUS_ERROR) {
					imageErrors.push({ 'param': 'grid_image', 'msg': imageOneResponse.message });
				}

				/** Set error if image is not in format **/
				if(imageTwoResponse.status == Constants.STATUS_ERROR) {
					imageErrors.push({ 'param': 'detail_image', 'msg': imageTwoResponse.message });
				}

				/** Send error response **/
				if(imageErrors.length >0) return res.send({status:Constants.STATUS_ERROR, message:imageErrors });

				if(menuIds.constructor !== Array) 	  menuIds = [menuIds];
				if(categoryIds.constructor !== Array) categoryIds = [categoryIds];

				/** set data in object **/
				let updateData = {
					name : {
						ar : nameArabic,
						en : nameEnglish
					},
					description : {
						ar : req?.body?.description_in_arabic,
						en : req?.body?.description_in_english
					},
					menu_ids 	 		:	arrayToObject(menuIds),
					category_ids 		: 	arrayToObject(categoryIds),
					discount_value 		: 	(req?.body?.discount_value) 	? req?.body?.discount_value 				:0,
					discount_percentage : 	(req?.body?.discount_percentage)? parseFloat(req?.body?.discount_percentage):0,
					price_on_selection 	: 	(priceOnSelection) 				? parseInt(priceOnSelection)				:0,
					non_sellable 		: 	(req?.body?.non_sellable) 		? parseInt(req?.body?.non_sellable) 		:0,
					comment	 			: 	(req?.body?.comment)			? req?.body?.comment						:"",
					availability_status : 	availabilityStatus,
					item_price 			: 	(!priceOnSelection)				? round(parseFloat(req?.body?.item_price),Constants.CURRENCY_ROUND_PRECISION)			:0,
					cuisine_id			:	(req?.body?.cuisine) ? new ObjectId(req?.body?.cuisine) : "",
					modified   			: 	getUtcDate()
				};

				/** if user upload new image **/
				if(imageResponse.fileName) updateData.image           = imageResponse.fileName;
				if(imageOneResponse.fileName) updateData.grid_image   = imageOneResponse.fileName;
				if(imageTwoResponse.fileName) updateData.detail_image = imageTwoResponse.fileName;

				if(!isAdmin(req,res)){
					updateData.user_id = new ObjectId(authUserId);
				}

				/** Save pending item details */
				collection.updateOne({ _id : itemId },{ $set : updateData}).then(()=> {

					let availabilityCollection	= this.db.collection(Tables.TMP_ITEM_AVAILABILITY);
					let unitsCollection			= this.db.collection(Tables.TMP_ITEM_UNITS);
					asyncParallel({
						update_availability_details : (callback)=>{
							asyncEach(availabilityInputs,(records, eachCallback)=>{
								if(!records) return eachCallback(null);

								let fromTime = (records.from_time) ? 	parseFloat(records.from_time.replace(':','.'))	:"";
								let toTime   = (records.to_time)   ?	parseFloat(records.to_time.replace(':','.'))	:"";

								if(!availabilityStatus){
									fromTime	=	parseFloat(Constants.DAY_INITIAL_START_TIME.replace(':','.'));
									toTime	 	=	parseFloat(Constants.DAY_INITIAL_END_TIME.replace(':','.'));
								}

								if(!fromTime && !toTime) return eachCallback(null);

								/** Update availability details  */
								availabilityCollection.updateOne({
									_id: (records.id) ? new ObjectId(records.id) :new ObjectId()
								},
								{
									$set: {
										from_time 	:	fromTime,
										to_time		: 	toTime,
										comment		: 	records.comment,
										modified   	:	getUtcDate(),
									},
									$setOnInsert: {
										item_id	:	itemId,
										created : 	getUtcDate(),
									}
								},{upsert: true}).then(()=> {
									eachCallback(null);
								}).catch(next);
							},(eachErr)=>{
								callback(eachErr);
							});
						},
						update_price_details : (callback)=>{
							asyncEach(priceInputs,(records, eachCallback)=>{
								if(!records) return eachCallback(null);

								if(!records.item_unit || !records.price){
									return eachCallback(null);
								}

								let priceId = (records.id) ? new ObjectId(records.id) :new ObjectId();

								/** Update price details  */
								unitsCollection.updateOne({
									_id: priceId
								},
								{
									$set: {
										item_unit_id	:	new ObjectId(records.item_unit),
										price			: 	round(parseFloat(records.price),Constants.CURRENCY_ROUND_PRECISION),
										discount_type	: 	records.discount_type ? records.discount_type : 0,
										discount_value	: 	records.discount_value ? parseFloat(records.discount_value) : 0,
										status			: 	(records.status)	? 	parseInt(records.status)	:Constants.DEACTIVE,
										sorting			: 	(records.sorting) 	?	parseInt(records.sorting)	:"",
										modified   		:	getUtcDate(),
									},
									$setOnInsert: {
										item_id	:	itemId,
										created : 	getUtcDate(),
									}
								},{upsert: true}).then(()=> {
									eachCallback(null);
								}).catch(next);
							},(eachErr)=>{
								callback(eachErr);
							});
						},
					},(asyncErr)=> {
						if(asyncErr) return next(asyncErr);

						/** success response*/
						req.flash(Constants.STATUS_SUCCESS,res.__("items.item_has_been_updated_successfully"));
						res.send({
							status	: Constants.STATUS_SUCCESS,
							message	: res.__("items.item_has_been_updated_successfully"),
						});

						/** Save System logs */
						saveSystemLogs(req, res, {
							user_id				: req?.session?.user?._id,
							parent_type 		: "items",
							parent_id 			: itemId,
							activity_type		: Constants.ACTIVITY_ADD_EDIT_DETAILS,
							additional_details	: {channel_id: req?.session?.user?.channel_id}
						}).then(()=>{ });
					});
				}).catch(next);
			});		
		}else{
			/** Get pending item details **/
			let response = await this.getPendingItemDetails(req,res,next);

            /** Send error response **/
			if(response.status != Constants.STATUS_SUCCESS) res.status(400).send(response);

			/** Get restaurant details **/
			let restaurantResponse = await getRestaurantDetails(req,res,next,{slug: slug});
			if(restaurantResponse.status != Constants.STATUS_SUCCESS) res.status(400).send(restaurantResponse);

			let restaurantId = 	restaurantResponse.result ? restaurantResponse.result._id : "";

            /** Get restaurant cuisine ids **/
            let restaurant_cuisines	= this.db.collection(Tables.RESTAURANT_CUISINES);
            let cuisineIds = await restaurant_cuisines.distinct("cuisine_id",{restaurant_id : new ObjectId(restaurantId)});

            let itemDetails 	= response?.result || {};
            let menuIds 		= itemDetails?.menu_ids || [];
            let categoryIds 	= itemDetails?.category_ids || [];
            let cuisineId 		= itemDetails?.cuisine_id || "";
            asyncParallel({
                dropdown_list : (callback)=>{
                    /**Get menu or category list **/
                    getDropdownList(req,res,next,{
                        collections :[{
                            collection : Tables.RESTAURANT_MENUS,
                            columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
                            selected   : menuIds,
                            conditions : {
                                restaurant_slug :	slug,
                                is_active		:	Constants.ACTIVE,
                            }
                        },
                        {
                            collection : Tables.RESTAURANT_CATEGORIES,
                            columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
                            selected   : categoryIds,
                            sort_conditions: {order: Constants.SORT_ASC},
                            conditions : {
                                restaurant_slug :	slug,
                                is_active		:	Constants.ACTIVE,
                            }
                        },
                        {
                            collection : Tables.CUISINES,
                            columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
                            selected   : [cuisineId],
                            sort_conditions: {order: Constants.SORT_ASC},
                            conditions : {_id : {$in : cuisineIds}, is_active: Constants.ACTIVE}
                        }]
                    }).then(dropDownResponse=> {
                        if(dropDownResponse?.status != Constants.STATUS_SUCCESS) return callback(dropDownResponse);

                        callback(null,dropDownResponse?.final_html_data || []);
                    }).catch(next);
                },
                item_unit_list : (callback)=>{
                    /** Get item unit master list **/
                    const item_units_masters = this.db.collection(Tables.ITEM_UNITS_MASTERS);
                    item_units_masters.find({ restaurant_slug: slug },{projection: {name:1,_id:1}}).toArray().then(result=>{
                        callback(null, result);
                    }).catch(next);
                },
            },(asyncErr, asyncResponse)=>{
				if(asyncErr){
					return res.status(400).send({
						status: Constants.STATUS_ERROR,
						message: res.__("system.something_going_wrong_please_try_again")
					});
				}

                /** Render  add or edit item page */
                res.render("items/edit_pending",{
                    layout			:	false,
                    slug			:	slug,
                    result			:	itemDetails,
                    item_unit_details:	response?.item_unit_details || [],
                    item_availability_details:	response?.item_availability_details ||[],
                    menu_list 		:	asyncResponse?.dropdown_list?.[0] || "",
                    category_list 	:	asyncResponse?.dropdown_list?.[1] || "",
                    cuisine_list 	:	asyncResponse?.dropdown_list?.[2] || "",
                    item_unit_list	:	asyncResponse?.item_unit_list || [],
                });
            });
		}
	};//editPendingItem()

	/**
	 * Function to remove tmp item unit
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async removeTmpItemUnit(req,res,next){
		try{
			/** Sanitize Data **/
			req.body 		= sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let itemId 		= (req?.body?.item_id) 	  ?	req?.body?.item_id 		:"";
			let itemUnitId 	= (req?.body?.item_unit_id) ?	req?.body?.item_unit_id	:"";

		/** Send error response */
			if(!itemUnitId || !itemId) return res.send({ status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });

			/** Delete item units */
			const tmp_item_units = this.db.collection(Tables.TMP_ITEM_UNITS);
			await tmp_item_units.deleteOne({
				_id	 	: new ObjectId(itemUnitId),
				item_id : new ObjectId(itemId)
			});

			/** Send success response */
			res.send({ status: Constants.STATUS_SUCCESS });
		}catch(e){
			return next(e);
		}
	};//End removeTmpItemUnit()

	/**
	 * Function to remove tmp item availability
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async removeTmpItemAvailability(req,res,next){
		try{
			/** Sanitize Data **/
			req.body 	=	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let itemId	=	(req?.body?.item_id)	?	req?.body?.item_id :"";
			let itemAvailabilityId 	= (req?.body?.item_availability_id) ? req?.body?.item_availability_id	:"";

			/** Send error response */
			if(!itemAvailabilityId || !itemId) return res.send({ status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });

			/** Delete item availability */
			const itemAvailability = this.db.collection(Tables.TMP_ITEM_AVAILABILITY);
			await itemAvailability.deleteOne({
				_id	 	: new ObjectId(itemAvailabilityId),
				item_id : new ObjectId(itemId)
			});

			/** Send success response */
			res.send({ status: Constants.STATUS_SUCCESS });
		}catch(e){
			return next(e);
		}
	};//End removeTmpItemAvailability()

	/**
	* Function for view pending item detail
	*
	* @param req 	As 	Request Data
    * @param res 	As 	Response Data
    * @param next 	As 	Callback argument to the middleware function
	*
	* @return render
	*/
	async viewPendingItemDetails(req,res,next){
		try{
			let itemId 	= new ObjectId(req?.params?.id);
			let slug 	= req?.params?.slug;

			/** Get item details **/
			let itemResponse = await this.getPendingItemDetails(req, res, next);

			/** Send error response **/
			if(itemResponse.status != Constants.STATUS_SUCCESS) return res.status(400).send(itemResponse);

			let itemDetails = itemResponse.result;
			let categoryIds = arrayToObject(itemDetails.category_ids);
			let menuIds     = arrayToObject(itemDetails.menu_ids);
			asyncParallel({
				category_name : (callback)=>{
					/** Get category name **/
					const restaurant_categories = this.db.collection(Tables.RESTAURANT_CATEGORIES);
					restaurant_categories.find({_id: {$in : categoryIds}},{$projection: {name:1}}).toArray().then(categoryResult=>{
						callback(null, categoryResult);
					}).catch(next);
				},
				menu_name : (callback)=>{
					/** Get menu name **/
					const restaurant_menus = this.db.collection(Tables.RESTAURANT_MENUS);
					restaurant_menus.find({_id: {$in : menuIds}},{$projection: {name:1}}).toArray().then(menuResult=>{
						callback(null, menuResult);
					}).catch(next);
				}
			},(_,asyncResponse)=>{

				/** Render view pending item page  **/
				res.render('items/view_pending_item_details',{
					layout		 		      : false,
					item_details 		      : itemDetails,
					item_unit_details    	  : itemResponse.item_unit_details,
					item_availability_details : itemResponse.item_availability_details,
					category_names 			  : asyncResponse.category_name,
					menu_names 			  	  : asyncResponse.menu_name,
					item_id					  : itemId,
					slug					  : slug
				});
			});
		}catch(e){
			return next(e);
		}
	};//End viewPendingItemDetails()

	/**
	 * Function for update item Actions
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return void
	*/
	async itemActions(req,res,next){
		try{
			let status	 = req?.body?.status;
			let itemIds	 = (req?.body?.item_id) ? req?.body?.item_id.split(",") : [];
			let slug 	 = req?.body?.slug;

			/** Send error response **/
			if(itemIds.length <= 0) return res.send({ status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });

			/** Convert into object ids */
			itemIds = arrayToObject(itemIds);

			if(status == Constants.APPROVED){

				/**For get tmp items details */
				const tmp_items	= this.db.collection(Tables.TMP_ITEMS);
				let tempItemData = await tmp_items.find({_id: {$in:itemIds}},{projection : {_id:1,restaurant_id:1,name:1,user_id:1,restaurant_slug:1}}).toArray();

				/**Check for temp items data */
				if(tempItemData.length <= 0) return res.send({ status: Constants.STATUS_ERROR,message : res.__("system.invalid_access")});

				asyncEach(tempItemData,(records, eachCallback)=>{
					asyncParallel({
						update_item : (callback)=>{
							copyFromParentTable(req,res,next,{
								type : 	"update_branch_items",
								parent_table : {
									name 			: Tables.TMP_ITEMS,
									fields 			: {_id:0, status:0,restaurant_slug:0,user_id:0,rejection_reason:0,submit_for_approval:0},
									conditions 		: {restaurant_slug: records.restaurant_slug, _id: records._id},
									remove_original : true
								},
								child_table : {
									name 		: Tables.ITEMS,
									conditions	: {restaurant_slug : records.restaurant_slug, _id: records._id},
								}
							}).then(itemResponse=>{
								if(itemResponse.status != Constants.STATUS_SUCCESS) return callback(itemResponse);
								callback(null,itemResponse);
							});
						},
						update_item_availablity : (callback)=>{
							copyFromParentTable(req,res,next,{
								parent_table	: {
									name 			: Tables.TMP_ITEM_AVAILABILITY,
									fields 			: {},
									conditions 		: {item_id: records._id},
									remove_original : true
								},
								child_table 	: {
									name 		: Tables.ITEM_AVAILABILITY,
									conditions	: {item_id: records._id},
									multiple	: true,
								}
							}).then(availablityResponse=>{
								if(availablityResponse.status != Constants.STATUS_SUCCESS) return callback(availablityResponse);
								callback(null,availablityResponse);
							});
						},
						update_item_units : (callback)=>{
							let options = {
								parent_table 	: {
									name 			: Tables.TMP_ITEM_UNITS,
									fields 			: {},
									conditions 		: {item_id: records._id},
									remove_original : true
								},
								child_table 	: {
									name 		: Tables.ITEM_UNITS,
									conditions	: {item_id: records._id},
									multiple	: true,
								}
							};
							copyFromParentTable(req,res,next,options).then(unitsResponse=>{
								if(unitsResponse.status != Constants.STATUS_SUCCESS) return callback(unitsResponse);
								callback(null,unitsResponse);
							});
						},
						update_choice_group : (callback)=>{
							copyFromParentTable(req,res,next,{
								parent_table : {
									name 			: Tables.TMP_ITEM_CHOICE_GROUPS,
									fields 			: {},
									conditions 		: {item_id: records._id},
									remove_original : true
								},
								child_table : {
									name 		: Tables.ITEM_CHOICE_GROUPS,
									conditions	: {item_id: records._id},
									multiple	: true,
								}
							}).then(choiceResponse=>{
								if(choiceResponse.status != Constants.STATUS_SUCCESS) return callback(choiceResponse);
								callback(null,choiceResponse);
							});
						},
						update_extra_items : (callback)=>{
							copyFromParentTable(req,res,next,{
								parent_table : {
									name 			: Tables.TMP_ITEM_EXTRA_MASTERS,
									fields 			: {},
									conditions 		: {item_id: records._id},
									remove_original : true
								},
								child_table : {
									name 		: Tables.ITEM_EXTRA_MASTERS,
									conditions	: {item_id: records._id},
									multiple	: true,
								}
							}).then(extraItemsResponse=>{
								if(extraItemsResponse.status != Constants.STATUS_SUCCESS) return callback(extraItemsResponse);
								callback(null,extraItemsResponse);
							});
						},
						update_item_group_extras : (callback)=>{
							copyFromParentTable(req,res,next,{
								parent_table : {
									name 			: Tables.TMP_ITEM_GROUP_EXTRAS,
									fields 			: {},
									conditions 		: {item_id: records._id},
									remove_original : true
								},
								child_table : {
									name 		: Tables.ITEM_GROUP_EXTRAS,
									conditions	: {item_id: records._id},
									multiple	: true,
								}
							}).then(itemGroupExtraResponse=>{
								if(itemGroupExtraResponse.status != Constants.STATUS_SUCCESS) return callback(itemGroupExtraResponse);
								callback(null,itemGroupExtraResponse);
							});
						}
					},(asyncErr)=>{
						if(asyncErr) return next(asyncErr);

						/*************** Send Mail  ***************/
						let itemName = records?.name?.[Constants.DEFAULT_LANGUAGE_CODE]|| "";
						sendMailToUsers(req,res,{
							event_type 		: Constants.RESTAURANT_ITEM_APPROVE_EMAIL_EVENTS,
							item_id		    : records._id,
							item_name		: itemName,
							restaurant_slug	: records.restaurant_slug,
							restaurant_id	: (records.restaurant_id)	? records.restaurant_id	:"",
							user_id			: (records.user_id)		    ? records.user_id		:"",
						});
						/*************** Send Mail  ***************/

						eachCallback(null);
					});
				},(eachErr)=>{
					if(eachErr) return next(eachErr);

					/**Send success response */
					if(slug) req.flash(Constants.STATUS_SUCCESS,res.__("items.item_request_approved_successfully"));
					res.send({
						status 		 : Constants.STATUS_SUCCESS,
						message		 : res.__("items.item_request_approved_successfully"),
						redirect_url : Constants.WEBSITE_ADMIN_URL+"restaurants/"+slug+"/pending_item"
					});

					/** Save System logs */
					saveSystemLogs(req, res, {
						user_id				: req.session.user._id,
						parent_type 		: Tables.ITEMS,
						parent_id 			: "",
						activity_type		: Constants.ACTIVITY_UPDATE_STATUS,
						additional_details	: {status: status, item_ids : itemIds,channel_id : req.session.user.channel_id}
					}).then(()=>{ });
				});
			}else{
				let setData  = { modified : getUtcDate() };

				/** Check for status */
				if(status == Constants.REJECTED){
					setData.status 		  		= Constants.REJECTED;
					setData.reject_reason 		= req.body.rejection_reason;
					setData.submit_for_approval = false;
				}else if(status == Constants.IN_REVIEW){
					setData.status = Constants.IN_REVIEW;
				}

				/** Send error response **/
				const tmp_items	= this.db.collection(Tables.TMP_ITEMS);
				let tempItemData = await tmp_items.find({_id: {$in:itemIds},status:{$in : [Constants.PENDING,Constants.IN_REVIEW]}},{projection : {_id:1,restaurant_id:1,name:1,user_id:1,restaurant_slug:1}}).toArray();

				/**Check for temp items data */
				if(tempItemData.length <= 0) return res.send({ status : Constants.STATUS_ERROR,message : res.__("system.invalid_access")});

				/** Update item status */
				await tmp_items.updateMany({_id: {$in: itemIds}},{$set: setData});

				asyncParallel({
					update_item_status : (callback)=>{
						const items = this.db.collection(Tables.ITEMS);
						items.updateOne({_id : {$in: itemIds}},{$set : {status : setData.status,modified: getUtcDate()}}).then(()=>{
							callback(null);
						}).catch(next);
					}
				},(asyncErr)=>{
					if(asyncErr) return next(asyncErr);

					let message = (status == Constants.REJECTED) ? res.__("items.item_request_rejected_successfully") : res.__("items.item_request_marked_in_review");

					/** success response*/
					if(slug) req.flash(Constants.STATUS_SUCCESS,message);
					res.send({
						status 		 : Constants.STATUS_SUCCESS,
						message	     : message,
						redirect_url : Constants.WEBSITE_ADMIN_URL+"restaurants/"+slug+"/pending_item"
					});

					if(status == Constants.REJECTED){
						tempItemData.map(records=>{
							/*************** Send Mail  ***************/
							let itemName = records?.name?.[Constants.DEFAULT_LANGUAGE_CODE]|| "";
							sendMailToUsers(req,res,{
								event_type 		: Constants.RESTAURANT_ITEM_REJECT_EMAIL_EVENTS,
								item_id		    : records._id,
								item_name		: itemName,
								restaurant_slug	: records.restaurant_slug,
								restaurant_id	: (records.restaurant_id) ? records.restaurant_id :"",
								user_id			: (records.user_id)		  ? records.user_id		  :"",
								reject_msg		: req?.body?.rejection_reason || ""
							});
							/*************** Send Mail  ***************/
						});
					}

					/** Save System logs */
					saveSystemLogs(req, res, {
						user_id				: req?.session?.user?._id,
						parent_type 		: Tables.ITEMS,
						parent_id 			: "",
						activity_type		: Constants.ACTIVITY_UPDATE_STATUS,
						additional_details	: {status : status, item_ids : itemIds,channel_id: req?.session?.user?.channel_id || ""}
					}).then(()=>{ });
				});
			}
		}catch(e){
			return next(e);
		}
	};//End itemActions()

	/**
	* Function is used to send item for approval
	*
	* @param req 	As 	Request Data
    * @param res 	As 	Response Data
    * @param next 	As 	Callback argument to the middleware function
	*
	* @return render
	*/
	async sendItemForApproval(req,res,next){
		try{
			let itemId	 =	(req?.params?.id) 	? new ObjectId(req?.params?.id) : "";
			let slug 	 = 	(req?.params?.slug) 	? req?.params?.slug: "";

			/** Get tmp item details **/
			const tmp_items = this.db.collection(Tables.TMP_ITEMS);
			let itemResult = await tmp_items.findOne({_id: itemId,restaurant_slug: slug},{projection: {_id: 1,name:1}});

			/** Send error response when item not found **/
			if(!itemResult) {
				req.flash(Constants.STATUS_ERROR,res.__("system.something_going_wrong_please_try_again"));
				return res.redirect(res.locals.base_url+"pending_item");
			}

			asyncParallel({
				udpate_status_in_item_table:(callback)=>{
					/** Update item status */
					const items = this.db.collection(Tables.ITEMS);
					items.updateOne({
						_id: itemId
					},
					{$set: {
						status : Constants.PENDING
					}}).then(()=>{
						callback(null);
					}).catch(next);
				},
				udpate_status_in_tmp_item_table:(callback)=>{
					/** Update item status */
					const tmp_items = this.db.collection(Tables.TMP_ITEMS);
					tmp_items.updateOne({
						_id: itemId
					},
					{$set: {
						submit_for_approval : true,
						status : Constants.PENDING
					}}).then(()=>{
						callback(null);
					}).catch(next);
				},
				restaurant_details : (callback)=>{
					/** Get restaurant details **/
					getRestaurantDetails(req,res,next,{slug: slug}).then(restaurantResponse=>{
						if(restaurantResponse.status != Constants.STATUS_SUCCESS) return callback(restaurantResponse);
						callback(null,restaurantResponse.result);
					}).catch(next);
				}
			},(asyncErr,asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				req.flash(Constants.STATUS_SUCCESS,res.__("items.item_has_been_submitted_for_approval_successfully"));
				res.redirect(res.locals.base_url+"pending_item");

				if(!isAdmin(req,res)){
					let nameEnglish 	  = itemResult?.name?.[Constants.DEFAULT_LANGUAGE_CODE] || "";
					let restaurantDetails = asyncResponse?.restaurant_details || {};
					let restaurantName	  = restaurantDetails?.default_name || "";

					/*************** Send notification  ***************/
					insertNotifications(req,res,{
						notification_data : {
							notification_type	: Constants.NOTIFICATION_RESTAURANT_ITEM_APPROVAL_REQUEST,
							message_params 		: [nameEnglish,restaurantName],
							parent_table_id 	: itemId,
							user_role_id 		: Constants.CRAVEZ,
							role_id 			: [Constants.CRAVEZ,Constants.CONTENT_TEAM],
							only_for_user_role	: true,
							extra_parameters	: {
								restaurant_slug	: slug,
								item_id 		: itemId
							}
						}
					});
					/*************** Send notification  ***************/
				}

				/** Save System logs */
				saveSystemLogs(req, res, {
					user_id				: req?.session?.user?._id,
					parent_type 		: Tables.ITEMS,
					parent_id 			: itemId,
					activity_type		: Constants.ACTIVITY_SEND_ITEM_FOR_APPROVAL
				});
			});
		}catch(e){
			return next(e);
		}
	};//End sendItemForApproval()
}
export default PendingItem; 