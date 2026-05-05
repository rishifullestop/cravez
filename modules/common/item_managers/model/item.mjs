import { ObjectId } from 'mongodb';
import { parallel as asyncParallel, each as asyncEach } from 'async';
import clone from 'clone';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, getUniqueId, getDropdownList, getRestaurantDetails, getRestaurantId, moveUploadedFile, appendFileExistData, arrayToObject, copyFromParentTable, isAdmin, round} from '../../../../utils/index.mjs';
import { sendMailToUsers, saveSystemLogs } from '../../../../services/index.mjs';

class Item {
    constructor(db) {
        this.db = db;
    }

    /**
	 * Function to get items list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async getItemList(req,res,next){
		let slug 	 = req?.params?.slug || "";
		let branchId = (req?.query?.branch) 	? new ObjectId(req?.query?.branch) 	  : null;
		let itemUnit = (req?.query?.item_unit) 	? new ObjectId(req?.query?.item_unit) : null;
		let menuId 	 = (req?.query?.menu) 		? new ObjectId(req?.query?.menu) 	  : null;

		if(isPost(req)){
			let limit		 =	(req?.body?.length)	  	?	parseInt(req?.body?.length) 	:Constants.ADMIN_LISTING_LIMIT;
			let skip		 = 	(req?.body?.start)	  	? 	parseInt(req?.body?.start)  		:Constants.DEFAULT_SKIP;
			let cuisineId 	 =  (req?.body?.cuisine_id) 	? 	new ObjectId(req?.body?.cuisine_id) : null;
			let categoryId 	 =  (req?.body?.category_id)	? 	new ObjectId(req?.body?.category_id): null;
			let menuId 	 	 =  (req?.body?.menu_id)		? 	new ObjectId(req?.body?.menu_id)  	: null;
			const collection = 	this.db.collection(Tables.ITEMS);

			/** Get restaurant id **/
			let restaurantId = await getRestaurantId(req,res,next,{slug:slug});

            let dataTableConfig = await configDatatable(req,res,null);

			/** Configure Datatable conditions*/
            let commonConditions = { restaurant_slug :slug};

            asyncParallel({
                item_unit_data:(callback)=>{
                    if(!itemUnit) return callback(null,null);

                    /**Get item unit detail */
                    const item_units = this.db.collection(Tables.ITEM_UNITS);
                    item_units.distinct( "item_id",{item_unit_id : itemUnit}).then(itemUnitResult=>{
                        callback(null,itemUnitResult);
                    }).catch(next);
                },
                category_list:(callback)=>{
                    if(!cuisineId) return callback(null,null);

                    /**Get restaurant categories detail */
                    const restaurant_categories = this.db.collection(Tables.RESTAURANT_CATEGORIES);
                    restaurant_categories.distinct( "_id",{cuisine_id : new ObjectId(cuisineId)}).then(result=>{
                        callback(null,result);
                    }).catch(next);
                },
                branch_item_list:(callback)=>{
                    if(!branchId) return callback(null,null);

                    /**Get item linkings detail */
                    const item_linkings = this.db.collection(Tables.ITEM_LINKINGS);
                    item_linkings.distinct("item_id",{
                        restaurant_id: new ObjectId(restaurantId),
                        $or: [
                            { "type" : Constants.ITEM_NOT_LISTED_TO_SELECTED_BRANCH_LIST,
                                "branch_ids" : { $nin: [branchId]}
                            },
                            {
                                "type" : Constants.ITEM_LISTED_TO_SELECTED_BRANCH_LIST,
                                "$or" : [
                                    {branch_ids	: { $size: 0} },
                                    {branch_ids : { $in: [ branchId ] } }
                                ]
                            }
                        ]
                    }).then(itemLinkingResult=>{
                        callback(null,itemLinkingResult);
                    }).catch(next);
                },
                linked_items:(callback)=>{
                    /**Get item linkings detail */
                    const item_linkings = this.db.collection(Tables.ITEM_LINKINGS);
                    item_linkings.distinct("item_id",{restaurant_id: new ObjectId(restaurantId)}).then(itemLinkingResult=>{
                        callback(null,itemLinkingResult);
                    }).catch(next);
                },
            },async(_,searchResponse)=>{

                /**For get data according to itemunit */
                if(searchResponse.item_unit_data){
                    commonConditions["_id"] = {$in:searchResponse.item_unit_data};
                }

                /**For get data according to  branch linked item */
                if(searchResponse.branch_item_list){
                    commonConditions["$and"] =[{_id : {$in:searchResponse.branch_item_list} }];
                }

                /**For get data according to cuisine */
                if(searchResponse.category_list){
                    commonConditions["$or"] = [
                        {"category_ids" :	{$in: searchResponse.category_list}},
                        {"cuisine_id"   :	cuisineId }
                    ];
                }

                /** assign in a single object */
                dataTableConfig.conditions =Object.assign(commonConditions,dataTableConfig.conditions);

                /**For get data according to category */
                if(categoryId){
                    if(!dataTableConfig.conditions["$and"]) dataTableConfig.conditions["$and"] = [];
                    dataTableConfig.conditions["$and"].push({$or : [
                        {"category_ids"   :{$in: [new ObjectId(categoryId)] }}
                    ]});
                }

                if(menuId){
                    if(!dataTableConfig.conditions["$and"]) dataTableConfig.conditions["$and"] = [];
                    dataTableConfig.conditions["$and"].push({$or : [
                        {"menu_ids"   :{$in: [new ObjectId(menuId)] }}
                    ]});
                }

                // Get list or count of items
                let dbRes = await collection.aggregate([
                    {$match: dataTableConfig.conditions },
                    {$facet : {
                        list : [
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit },
                            {$project: {
                                _id:1,name:1,image:1,description:1,is_active:1,modified:1, restaurant_slug:1,status:1,item_id:1, category_ids:1
                            }}
                        ],
                        count: [
                            {$count: "count"},
                        ],
                    }}
                ]).toArray();

                let result  =  dbRes?.[0]?.list || [];
                let itemIds	=	[];
                if(result?.length) result.map(record=>{ itemIds.push(record._id);});

                if(itemIds?.length){
                    /** Get linking branch list */
                    const item_linkings= this.db.collection(Tables.ITEM_LINKINGS);
                    let linkingResult = await item_linkings.find({
                        item_id : {$in : itemIds},
                        type 	: Constants.ITEM_NOT_LISTED_TO_SELECTED_BRANCH_LIST,
                    },{projection : {item_id: 1, branch_ids:1}}).toArray();

                    let branchIds		=	[];
                    let mapedBranchObj 	=	{};
                    linkingResult.forEach(records=>{
                        branchIds = branchIds.concat(records.branch_ids);

                        if(!mapedBranchObj[records.item_id]){
                            mapedBranchObj[records.item_id] = {};
                        }

                        if(records.branch_ids.length >0){
                            records.branch_ids.map(tmpId=>{
                                mapedBranchObj[records.item_id][tmpId] = tmpId;
                            });
                        }
                    });

                    /** Get branch list */
                    const restaurant_branches=this.db.collection(Tables.RESTAURANT_BRANCHES);
                    let branchResult = await restaurant_branches.find({
                        restaurant_slug : slug,
                        _id 			: {$nin : branchIds},
                    },{projection : {_id: 1, name: 1}}).toArray();

                    result.map(record=>{
                        let tmpItemId = record._id;

                        if(mapedBranchObj[tmpItemId]){
                            if(mapedBranchObj[tmpItemId].length == 0){
                                record.all_branch_mapped = true;
                            }else{
                                record.branch_list = [];
                                branchResult.forEach(data=>{
                                    if(!mapedBranchObj[tmpItemId][data._id]){
                                        record.branch_list.push(data);

                                    }
                                });
                            }
                        }else{
                            record.branch_not_mapped = true;
                        }
                    });
                }

                /** Append image with full path **/
                appendFileExistData({
                    "file_url"		: Constants.ITEMS_FILE_URL,
                    "file_path"		: Constants.ITEMS_FILE_PATH,
                    "result"		: result,
                    "database_field": "image",
                }).then(response=>{

                    /** Send response **/
                    res.send({
                        status: Constants.STATUS_SUCCESS,
                        draw: dataTableConfig.result_draw,
                        data			:   response?.result || [],
                        recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
                        recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
                        linked_items	:   searchResponse?.linked_items || []
                    });
                }).catch(next);
            });
		}else{
			/**Get menu or category list **/
			let dropDownResponse = await getDropdownList(req,res,next,{
				collections  : [
					{
						collection : Tables.RESTAURANT_CATEGORIES,
						columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
						sort_conditions: {order: Constants.SORT_ASC},
						conditions : {
							restaurant_slug :	slug,
							is_active		:	Constants.ACTIVE,
						}
					},
					{
						collection : Tables.RESTAURANT_MENUS,
						columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
						selected   : [menuId],
						conditions : {
							restaurant_slug :	slug,
							is_active		:	Constants.ACTIVE,
						}
					}
				]
			});

            /** Render item list page */
            res.render("items/list",{
                layout			: false,
                slug			: slug,
                branch_id   	: branchId,
                cuisine_id  	: req?.query?.cuisine || "",
                category_list  	: dropDownResponse?.final_html_data?.[0] || "",
                menu_list  		: dropDownResponse?.final_html_data?.[1] || "",
                menu_id  		: menuId
            });
		}
	};//End getItemList()

    /**
	 * Function to get item's detail
	 *
	 * @param req	As	Request Data
	 * @param res	As	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return json
	*/
	async getItemDetails(req,res,next){
		return new Promise(resolve=>{
			let itemId 	  =	req?.params?.id || "";
			let slug	  = req?.params?.slug || "";

			asyncParallel({
				item_details : (callback)=>{
					/** Get item details **/
					const items = this.db.collection(Tables.ITEMS);
					items.aggregate([
						{$match	: {
                            _id: new ObjectId(itemId),
                            restaurant_slug: slug
                        }},
						{$lookup	: {
                            from		 : Tables.CUISINES,
                            localField	 : "cuisine_id",
                            foreignField : "_id",
                            as			 : "cuisine_details",
                        }},
						{$project: {
							category_ids:1,description:1,discount_percentage:1,discount_value:1,image:1,item_price:1,menu_ids:1,name:1,non_sellable:1, is_active:1,item_id:1,cuisine_id:1,grid_image:1,detail_image:1,availability_status:1,is_exclude_form_sync:1,aghzeya:1, price_on_selection:1,
                            cuisine: { $arrayElemAt: ["$cuisine_details.name."+Constants.DEFAULT_LANGUAGE_CODE,0]},
						}},
					]).toArray().then(itemResult=>{
						callback(null, itemResult);
					}).catch(next);
				},
				availability_item_details : (callback)=>{
					/** Get item availability details **/
					const item_availability = this.db.collection(Tables.ITEM_AVAILABILITY);
					item_availability.find({item_id: new ObjectId(itemId) }).toArray().then(availabilityResult=>{
						callback(null, availabilityResult);
					}).catch(next);
				},
				item_units_details : (callback)=>{
					/** Get item unit details **/
					const item_units = this.db.collection(Tables.ITEM_UNITS);
					item_units.aggregate([
						{ $match	: {item_id: new ObjectId(itemId)}},
						{ $sort 	: {sorting:Constants.SORT_ASC}},
						{$lookup	: {
                            from		 : Tables.ITEM_UNITS_MASTERS,
                            localField	 : "item_unit_id",
                            foreignField : "_id",
                            as			 : "item_units_masters_details",
                        }},
						{ $project	: {
                            item_unit_id:1,item_id:1,discount_type:1,discount_value:1,price:1,sorting:1,status:1,
                            item_unit: { $arrayElemAt: ["$item_units_masters_details.name."+Constants.DEFAULT_LANGUAGE_CODE,0]}
                        }},
					]).toArray().then(itemUnitResult=>{
						callback(null, itemUnitResult);
					}).catch(next);
				},
			},async (asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				/** Send error response **/
				if(!asyncResponse.item_details || !asyncResponse.item_details.length){
                    return resolve({status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") });
                }

				/** Append image with full path **/
				let imageResponse = await appendFileExistData({
					"file_url"		: 	Constants.ITEMS_FILE_URL,
					"file_path"		: 	Constants.ITEMS_FILE_PATH,
					"result" 		: 	asyncResponse.item_details,
					"database_field":	"image",
					"image_placeholder" :   "main_image"
				});

                /** Append grid image with full path **/
				let gridImageResponse = await appendFileExistData({
                    "file_url"		: 	Constants.ITEMS_FILE_URL,
                    "file_path"		: 	Constants.ITEMS_FILE_PATH,
                    "result" 		: 	imageResponse?.result || [],
                    "database_field":	"grid_image",
                    "image_placeholder" :   "grid_image_path"
                });

                /** Append grid image with full path **/
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
                    item_unit_details		 :	asyncResponse.item_units_details,
                    item_availability_details:	asyncResponse.availability_item_details,
                    result					 : 	detailImageResponse?.result?.[0] || {},
                });
			});
		});
	};// End getItemDetails()

    /**
	 * Function to add or edit item
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async addEditItem(req,res,next){
        try{
            let slug 		= 	req?.params?.slug || "";
            let isEditable	=	req?.params?.id ? true : false;

            if(isPost(req)){
                /** Sanitize Data **/
                req.body  				= sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
                let itemId		        = req?.params?.id ? new ObjectId(req.params.id) :new ObjectId();
                let priceInputs 		= req?.body?.price || "";
                let availabilityInputs 	= req?.body?.availability || "";
                let priceOnSelection 	= req?.body?.price_on_selection || "";
                let authUserId	        = new ObjectId(req.session.user._id);
                let menuIds 	        = req?.body?.menu_ids || [];
                let categoryIds         = req?.body?.category_ids || [];
                let nameArabic          = req?.body?.name_in_arabic || "";
                let nameEnglish         = req?.body?.name_in_english || "";

                /** Send error response */
                if(!priceInputs || !availabilityInputs || !Array.isArray(priceInputs) || !Array.isArray(availabilityInputs)){
                    return res.send({ status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });
                }

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
			    let lowestUnitPrice  = 0;
                priceInputs.map(records=>{
                    if(records){
                        let index =  records.index;
                        if(records.item_unit || records.price || records.status || records.discount_type || records.discount_value){

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
                            }else if(records.discount_type != Constants.DISCOUNT_BY_PERCENTAGE && records.discount_value >= records.price){
                                errors.push({ 'param': 'discount_value_'+index, 'msg': res.__("items.discount_by_value_should_be_less_than_price") });
                            }

                            /** Get unit lowest price */
                            if(records.status && records.status == Constants.ACTIVE && records.price && (!lowestUnitPrice || (records.price < lowestUnitPrice))){
                                lowestUnitPrice = parseFloat(records.price);
                            }
                        }
                    }
                });

                /** Send error response **/
                if(errors.length >0) return res.send({status: Constants.STATUS_ERROR, message: errors});


                let collection	=	this.db.collection(Tables.ITEMS);
                asyncParallel({
                    restaurant_details : (callback)=>{
                        /** Get restaurant details **/
                        getRestaurantDetails(req,res,next,{slug: slug}).then(restaurantResponse=>{
                            if(restaurantResponse.status != Constants.STATUS_SUCCESS) return callback(restaurantResponse);
                            callback(null,restaurantResponse?.result || {});
                        }).catch(next);
                    },
                    item_unique_id : (callback)=>{
                        if(isEditable) return callback(null,req?.body?.item_id || "");

                        /** get item unqiue id **/
                        getUniqueId(req,res,next,{type:"item"}).then(uniqueIdResponse=>{
                            callback(null,uniqueIdResponse?.result || "");
                        }).catch(next);
                    },
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
                },(err,response)=> {
                    if(err) return next(err);

                    let restaurantDetails = response?.restaurant_details || {};
                    let restaurantId	  = restaurantDetails?._id || "";
                    let itemUniqueId      = response?.item_unique_id || "";
                    let imageResponse 	  = response?.upload_image 	      ? response.upload_image 	     : "";
                    let imageOneResponse  = response?.upload_grid_image   ? response.upload_grid_image  : "";
                    let imageTwoResponse  = response?.upload_detail_image ? response.upload_detail_image: "";

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
                        $set  : {
                            name : {
                                ar : nameArabic,
                                en : nameEnglish
                            },
                            description : {
                                ar : req?.body?.description_in_arabic || "",
                                en : req?.body?.description_in_english || ""
                            },
                            menu_ids 	 		:	arrayToObject(menuIds),
                            category_ids 		: 	arrayToObject(categoryIds),
                            discount_value 		: 	req?.body?.discount_value || 0,
                            discount_percentage : 	req?.body?.discount_percentage || 0,
                            price_on_selection 	: 	parseInt(priceOnSelection || 0),
                            non_sellable 		: 	parseInt(req?.body?.non_sellable || 0),
                            availability_status : 	availabilityStatus,
                            item_price			:	(!priceOnSelection) ? round(parseFloat(req?.body?.item_price),Constants.CURRENCY_ROUND_PRECISION) :0,
                            cuisine_id			:	(req?.body?.cuisine) ? new ObjectId(req?.body?.cuisine) : "",
                            modified   			: 	getUtcDate()
                        },
                        $setOnInsert: {
                            restaurant_id	: restaurantId,
                            restaurant_slug	: slug,
                            item_id			: itemUniqueId,
                            added_by		: authUserId,
                            is_active		: Constants.ACTIVE,
                            created 		: getUtcDate()
                        }
                    };

                    /** if user upload new image **/
                    if(imageResponse?.fileName)    updateData['$set'].image 	   = imageResponse?.fileName;
                    if(imageOneResponse?.fileName) updateData['$set'].grid_image   = imageOneResponse?.fileName;
                    if(imageTwoResponse?.fileName) updateData['$set'].detail_image = imageTwoResponse?.fileName;
                    if(lowestUnitPrice && lowestUnitPrice > 0){
						updateData["$set"].unit_price = lowestUnitPrice;
					}else{
						if(!updateData["$unset"]) updateData["$unset"] = {};
						updateData["$unset"].unit_price = 1;
					}

                    if(!isAdmin(req,res)){
                        updateData['$set'].status				= Constants.PENDING;
                        updateData['$set'].user_id				= authUserId;
                        updateData['$set'].submit_for_approval	= false;
                        collection 						= this.db.collection(Tables.TMP_ITEMS);
                    }

                    /** Save item details */
                    collection.updateOne({_id : itemId},updateData,{upsert: true}).then(()=> {

                        let availabilityCollection	= this.db.collection(Tables.ITEM_AVAILABILITY);
                        let unitsCollection			= this.db.collection(Tables.ITEM_UNITS);

                        if(!isAdmin(req,res)){
                            availabilityCollection	= this.db.collection(Tables.TMP_ITEM_AVAILABILITY);
                            unitsCollection			= this.db.collection(Tables.TMP_ITEM_UNITS);
                        }

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

                            /** Set flash message**/
                            let isAdminUser		= isAdmin(req,res);
                            let updateMessage	= (isAdminUser) ? res.__("items.item_has_been_updated_successfully") :res.__("items.item_has_been_updated_and_send_for_approval");
                            let addMessage		= (isAdminUser) ? res.__("items.item_has_been_added_successfully")   :res.__("items.item_has_been_added_and_send_for_approval");
                            let message			= (isEditable)	? updateMessage :addMessage;

                            /** success response*/
                            if(!isEditable) req.flash(Constants.STATUS_SUCCESS,message);
                            res.send({status: Constants.STATUS_SUCCESS, message	: message});

                            /** Save System logs */
                            saveSystemLogs(req, res, {
                                user_id				: authUserId,
                                parent_type 		: Tables.ITEMS,
                                parent_id 			: itemId,
                                activity_type		: Constants.ACTIVITY_ADD_EDIT_DETAILS,
                                additional_details	: {}
                            }).then(()=>{ });
                        });
                    });
                });
            }else{
                let itemResponse = {};
                if(isEditable){
                    itemResponse = await this.getItemDetails(req,res,next);

                    /** Send error response **/
                    if(itemResponse.status != Constants.STATUS_SUCCESS) return res.status(400).send(itemResponse);
                }

                /** Get restaurant details **/
                let restaurantResponse = await getRestaurantDetails(req,res,next,{slug: slug});

                /** Send error response **/
                if(restaurantResponse.status != Constants.STATUS_SUCCESS) return res.status(400).send(restaurantResponse);

                let restaurantId = 	restaurantResponse?.result?._id || "";

                /** Get restaurant cuisine ids **/
                let restaurant_cuisines	= this.db.collection(Tables.RESTAURANT_CUISINES);
                let cuisineIds = await restaurant_cuisines.distinct("cuisine_id",{restaurant_id : new ObjectId(restaurantId)});

                let itemDetails = itemResponse?.result || {};
                let menuIds 	= itemDetails?.menu_ids || [];
                let categoryIds = itemDetails?.category_ids || [];
                let cuisineId 	= itemDetails?.cuisine_id || "";
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
                        }).then(dropDownRes=> {
                            if(dropDownRes.status != Constants.STATUS_SUCCESS) return callback(dropDownRes);

                            callback(null,dropDownRes?.final_html_data || []);
                        }).catch(next);
                    },
                    item_unit_list : (callback)=>{
                        /** Get item unit master list **/
                        const item_units_masters = this.db.collection(Tables.ITEM_UNITS_MASTERS);
                        item_units_masters.find({ restaurant_slug: slug },{projection: {name:1,_id:1}}).toArray().then(itemUnitMasterResult=>{
                            callback(null, itemUnitMasterResult);
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
                    res.render("items/add_edit",{
                        layout				: false,
                        slug				: slug,
                        result				: itemDetails,
                        is_editable			: isEditable,
                        item_unit_details	: itemResponse?.item_unit_details || [],
                        item_availability_details:	itemResponse?.item_availability_details || [],
                        menu_list 			: asyncResponse?.dropdown_list?.[0] || "",
                        category_list 		: asyncResponse?.dropdown_list?.[1] || "",
                        cuisine_list 		: asyncResponse?.dropdown_list?.[2] || "",
                        item_unit_list		: asyncResponse?.item_unit_list || [],
                    });
                });
            }
        }catch(e){
            return next(e);
        }
	};//End addEditItem()

    /**
	 * Function to remove item unit
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async removeItemUnit(req,res,next){
        try{
            /** Sanitize Data **/
            req.body 		=	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
            let itemId 		=	(req?.body?.item_id) 		?	req?.body?.item_id 		:"";
            let itemUnitId 	=	(req?.body?.item_unit_id) ? 	req?.body?.item_unit_id	:"";

            /** Send error response */
            if(!itemUnitId || !itemId) return res.send({ status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });

            /** Delete item units */
            const item_units = this.db.collection(Tables.ITEM_UNITS);
            await item_units.deleteOne({
                _id	 	: new ObjectId(itemUnitId),
                item_id : new ObjectId(itemId)
            });

            /** Send success response */
            res.send({ status: Constants.STATUS_SUCCESS });
        }catch(e){
            return next(e);
        }
	};//End removeItemUnit()

	/**
	 * Function to remove item availability
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async removeItemAvailability(req,res,next){
        try{
            /** Sanitize Data **/
            req.body 	=	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
            let itemId	=	(req?.body?.item_id)	?	req?.body?.item_id :"";
            let itemAvailabilityId 	= (req?.body?.item_availability_id) ? req?.body?.item_availability_id	:"";

            /** Send error response */
            if(!itemAvailabilityId || !itemId) return res.send({ status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });

		    /** Delete item availability */
            const itemAvailability = this.db.collection(Tables.ITEM_AVAILABILITY);
            await itemAvailability.deleteOne({
                _id	 	: new ObjectId(itemAvailabilityId),
                item_id : new ObjectId(itemId)
            });

			/** Send success response */
            res.send({ status: Constants.STATUS_SUCCESS });
        }catch(e){
            return next(e);
        }
	};//End removeItemAvailability()

    /**
	 * Function to get categories by menus
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async getMenuCategories(req,res,next){
        try{
            let menuIds	= req?.body?.menus || [];
            let categoryCondition = {};
            if(menuIds.constructor === Array && menuIds.length > 0){
                categoryCondition = {menu_ids:{$in: arrayToObject(menuIds)}};
            }

            const items	= this.db.collection(Tables.ITEMS);
            let categoryIds = await items.distinct("category_ids",categoryCondition);

            let dropDownCondition = {
                restaurant_slug : req?.params?.slug,
                is_active		: Constants.ACTIVE,
            };

            if(menuIds.constructor === Array && menuIds.length > 0){
                dropDownCondition = {...{_id: {$in : categoryIds} }, ...dropDownCondition};
            }

            /**Get category list **/
            let dropDownResponse = await getDropdownList(req,res,next,{
                collections :[{
                    collection : Tables.RESTAURANT_CATEGORIES,
                    columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
                    conditions : dropDownCondition
                }]
            });

            /** Send error response **/
            if(dropDownResponse.status != Constants.STATUS_SUCCESS) return res.send(dropDownResponse);

            /** Send success response **/
            res.send({status: Constants.STATUS_SUCCESS,result : dropDownResponse?.final_html_data?.[0] || "" });
        }catch(e){
            return next(e);
        }
	};//End getMenuCategories()

    /**
	 * Function for update item status
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return void
	*/
	async updateItemStatus(req,res,next){
        try{
            let status	 = 	req?.body?.status || 0;
            let itemIds	 =	req?.body?.item_ids?.split(",") || [];

            /** Send error response **/
            if(itemIds.length < 1) return res.send({ status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });

            /** Convert into object ids */
            itemIds = arrayToObject(itemIds);

            /** Update item status */
            const items = this.db.collection(Tables.ITEMS);
            await items.updateMany({
                _id: {$in: itemIds}
            },
            {$set: {
                is_active :	(status == Constants.ACTIVE) 	? Constants.ACTIVE :Constants.DEACTIVE,
                modified  : getUtcDate()
            }});

            let isAdminUser = isAdmin(req,res);
            if(!isAdminUser){
                asyncEach(itemIds,(itemsId, eachCallback)=>{

                    items.findOne({_id : new ObjectId(itemsId)},{projection:{name:1,restaurant_id:1}}).then(result=>{
                        if(!result) return eachCallback(null);

                        let itemName 		= 	result?.name?.[Constants.DEFAULT_LANGUAGE_CODE] || "";
                        let restaurantName  = 	req?.session?.user?.full_name || "";
                        let restaurantSlug  = 	req?.session?.user?.restaurant_slug || "";

                        sendMailToUsers(req,res,{
                            event_type 		:	Constants.ITEM_ACTIVATE_DEACTIVATE_EVENT,
                            item_id			: 	itemsId,
                            item_name		: 	itemName,
                            restaurant_slug	:	restaurantSlug,
                            status			:	(status == Constants.ACTIVE) ? "activated" : "deactivated",
                            restaurant_name	: 	restaurantName,
                            restaurant_id	: 	result?.restaurant_id || "",
                        });
                        eachCallback(null);
                    }).catch(next);
                },()=>{});
            }

            /** success response*/
            res.send({
                status : Constants.STATUS_SUCCESS,
                message: res.__("items.item_status_has_been_updated_successfully"),
            });

            /** Save System logs */
            saveSystemLogs(req, res, {
                user_id				: req?.session?.user?._id || "",
                parent_type 		: Tables.ITEMS,
                parent_id 			: "",
                activity_type		: Constants.ACTIVITY_UPDATE_STATUS,
                additional_details	: {status: (status == Constants.ACTIVE) ?	Constants.ACTIVE 	:Constants.DEACTIVE, item_ids : itemIds}
            }).then(()=>{ });
        }catch(e){
            return next(e);
        }
	};//End updateItemStatus()

    /**
	 * Function to add recommanded items
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async addRecommendedItem(req,res,next){
        try{
            let itemId   = req?.params?.item_id || "";
            let slug 	 = req?.params?.slug || "";

            const item_recommended	= this.db.collection(Tables.ITEM_RECOMMENDED);
            if(isPost(req)){
                /** Sanitize Data **/
                req.body 			= sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
                let recommendedIds	= req?.body?.recommended || [];

                /** Convert into object id  */
                if(recommendedIds.constructor !== Array) recommendedIds = [recommendedIds];
                recommendedIds = arrayToObject(recommendedIds);

                /**For save recommended item*/
                await item_recommended.updateOne({
                    item_id   : new ObjectId(itemId)
                },
                {
                    $set:{
                        added_by : new ObjectId(req?.session?.user?._id || ""),
                        modified : getUtcDate()
                    },
                    $setOnInsert : {
                        created : getUtcDate()
                    },
                    $addToSet: { recommended: { $each: recommendedIds}}
                },{upsert:true});

                /** Save System logs */
                saveSystemLogs(req, res, {
                    user_id				: req?.session?.user?._id || "",
                    parent_type 		: Tables.ITEM_RECOMMENDED,
                    parent_id 			: itemId,
                    activity_type		: Constants.ACTIVITY_ADD_RECOMMENDED_ITEM,
                    additional_details	: {}
                }).then(()=>{ });

                /** Send success response */
                res.send({
                    status	: Constants.STATUS_SUCCESS,
                    message	: res.__("items.recommended_item_has_been_added_successfully")
                });
            }else {
                /**For get item recommended detail */
                let result = await item_recommended.findOne({item_id : new ObjectId(itemId)},{projection:{recommended:1}});

                /**Get item list **/
                let dropDownResponse = await getDropdownList(req,res,next,{
                    collections :[{
                        collection : Tables.ITEMS,
                        selected   : result?.recommended || [],
                        columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
                        conditions : {
                            restaurant_slug : slug,
                            _id				: {$ne : new ObjectId(itemId)},
                        }
                    }]
                });

                /** Send error response **/
                if(dropDownResponse?.status != Constants.STATUS_SUCCESS) return res.status(400).send(dropDownResponse);

                /** Render recommended item page */
                res.render("items/recommended_item",{
                    layout		: false,
                    item_id 	: itemId,
                    item_list	: dropDownResponse?.final_html_data?.[0] || "",
                });
            }
        }catch(e){
            return next(e);
        }
	};//End addRecommendedItem()

    /**
	 * Function to rollback item
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async rollbackItem(req,res,next){
        try{
		    let itemId	= (req?.params?.item)	? new ObjectId(req?.params?.item)	: "";
            let slug	= req?.params?.slug;

            /** Delete item linkings */
            const itemLinkings = this.db.collection(Tables.ITEM_LINKINGS);
            await itemLinkings.deleteOne({item_id : itemId});

            /** Send success response **/
            let tmpQuery = req?.query?.query || "";
            req.flash(Constants.STATUS_SUCCESS,res.__("items.item_override_has_been_rollback_successfully"));
            if(isAdmin(req,res)) return res.redirect(Constants.WEBSITE_ADMIN_URL+"restaurants/"+slug+"/item"+tmpQuery);
            res.redirect(Constants.WEBSITE_URL+"restaurants/"+slug+"/item"+tmpQuery);
        }catch(e){
            return next(e);
        }
	};//End rollbackItem()

    /**
	 * Function to clone item
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async cloneItem(req,res,next){
        try{
            let restaurantSlug  = req?.params?.slug || "";
            let itemId		    = new ObjectId(req?.params?.item);
            if(isPost(req)){
                /** Sanitize Data **/
                req.body 		= sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
                let authUserId	= new ObjectId(req?.session?.user?._id);
                let nameEnglish 				=	req?.body?.name_in_english;
                let nameArabic  				=	req?.body?.name_in_arabic;
                let collection					=	this.db.collection(Tables.ITEMS);
                let unitsCollection				=	this.db.collection(Tables.ITEM_UNITS);
                let availabilityCollection		=	this.db.collection(Tables.ITEM_AVAILABILITY);
                let itemChoiceGroupCollection 	=	this.db.collection(Tables.ITEM_CHOICE_GROUPS);
                let itemGroupExtrasCollection 	=	this.db.collection(Tables.ITEM_GROUP_EXTRAS);
                let itemExtraMastersCollection	=	this.db.collection(Tables.ITEM_EXTRA_MASTERS);

                asyncParallel({
                    parent_item : (callback)=>{
                        collection.findOne({_id: itemId},{projection: {_id : 0,item_id:0}}).then(itemDetails=>{
                            callback(null,itemDetails);
                        }).catch(next);
                    },
                    item_availability : (callback)=>{
                        availabilityCollection.find({item_id: itemId},{projection: {_id: 0}}).toArray().then(result=>{
                            callback(null,result);
                        }).catch(next);
                    },
                    item_units : (callback)=>{
                        unitsCollection.find({item_id: itemId},{projection: {_id: 0}}).toArray().then(result=>{
                            callback(null,result);
                        }).catch(next);
                    },
                    item_unique_id : (callback)=>{
                        /** get item unqiue id **/
                        getUniqueId(req,res,next,{type:"item"}).then(uniqueIdResponse=>{
                            callback(null,uniqueIdResponse?.result || "");
                        }).catch(next);
                    },
                    item_choice_groups : (callback)=>{
                        /** get item choice group details **/
                        itemChoiceGroupCollection.find({item_id:itemId}).toArray().then(choiceResult=>{
                            callback(null,choiceResult);
                        }).catch(next);
                    },
                    item_extra_masters : (callback)=>{
                        /** get item extra masters details **/
                        itemExtraMastersCollection.find({item_id: itemId},{projection: {_id:0}}).toArray().then(extrasResult=>{
                            callback(null,extrasResult);
                        }).catch(next);
                    },
                },(err,response)=> {
                    if(err) return next(err);

                    let itemDetails  		= response.parent_item;
                    let availabilityInputs  = response.item_availability;
                    let priceInputs  		= response.item_units;
                    let itemUniqueId     	= response.item_unique_id;
                    let itemChoiceGroupResult  = response.item_choice_groups;
                    let itemExtraMastersResult = response.item_extra_masters;

                    /** Send error response **/
                    if(!itemDetails) return res.send({status : Constants.STATUS_ERROR,message: res.__("system.invalid_access")});

                    let groupExtraDetails = "";
                    asyncParallel({
                        item_group_extras : (asyncCallback)=>{
                            /** get item group extras details **/
                            asyncEach(itemChoiceGroupResult,(records, asyncEachCallback)=>{
                                if(!records) return asyncEachCallback(null);

                                itemGroupExtrasCollection.find({
                                    item_id : itemId,
                                    group_id : records._id
                                },{projection : {_id : 0}}).toArray().then(groupExtrasResult=>{
                                    groupExtraDetails = groupExtrasResult;
                                    asyncEachCallback(null);
                                }).catch(next);
                            },(eachErr)=>{
                                asyncCallback(eachErr,groupExtraDetails);
                            });
                        },
                    },(asyncParallelErr,asyncResponse)=> {
                        if(asyncParallelErr) return next(asyncParallelErr);

                        let itemGroupExtrasResult = asyncResponse.item_group_extras;

                        let menuIds 	= 	req?.body?.menu_ids || [];
                        let categoryIds =	req?.body?.category_ids || [];
                        if(menuIds.constructor !== Array) 	  menuIds = [menuIds];
                        if(categoryIds.constructor !== Array) categoryIds = [categoryIds];

                        let clonedItemId	= new ObjectId();
                        let dataToBeSaved	= clone(itemDetails);
                        dataToBeSaved.name	= {
                            ar : nameArabic,
                            en : nameEnglish
                        };
                        dataToBeSaved.description = {
                            ar : req?.body?.description_in_arabic || "",
                            en : req?.body?.description_in_english || ""
                        };

                        dataToBeSaved.menu_ids		= arrayToObject(menuIds);
                        dataToBeSaved.category_ids 	= arrayToObject(categoryIds);
                        dataToBeSaved.created 		= getUtcDate();
                        dataToBeSaved.modified 		= getUtcDate();
                        dataToBeSaved._id 			= clonedItemId;
                        dataToBeSaved.added_by		= authUserId;
                        dataToBeSaved.item_id       = itemUniqueId;

                        /** Change collection for restaurant */
                        if(!isAdmin(req,res)){
                            collection = this.db.collection(Tables.TMP_ITEMS);
                            dataToBeSaved.status 				= Constants.PENDING;
                            dataToBeSaved.submit_for_approval 	= false;
                        }

                        let choiceGroupData  = {};
                        let extraMastersData = {};
                        let groupExtrasData  = {};

                        collection.insertOne(dataToBeSaved).then(()=>{

                            /** Change collection for restaurant */
                            if(!isAdmin(req,res)){
                                availabilityCollection	   = this.db.collection(Tables.TMP_ITEM_AVAILABILITY);
                                unitsCollection			   = this.db.collection(Tables.TMP_ITEM_UNITS);
                                itemChoiceGroupCollection  = this.db.collection(Tables.TMP_ITEM_CHOICE_GROUPS);
                                itemExtraMastersCollection = this.db.collection(Tables.TMP_ITEM_EXTRA_MASTERS);
                                itemGroupExtrasCollection  = this.db.collection(Tables.TMP_ITEM_GROUP_EXTRAS);
                                choiceGroupData.status	   = Constants.PENDING;
                                choiceGroupData.user_id	   = new ObjectId(req?.session?.user?._id);
                                extraMastersData.status	   = Constants.PENDING;
                                extraMastersData.user_id   = new ObjectId(req?.session?.user?._id);
                                groupExtrasData.status	   = Constants.PENDING;
                                groupExtrasData.user_id    = new ObjectId(req?.session?.user?._id);
                            }

                            asyncParallel({
                                update_availability_details : (callback)=>{
                                    asyncEach(availabilityInputs,(records, eachCallback)=>{
                                        if(!records) return eachCallback(null);

                                        /** modify data */
                                        let availabilityData 		= clone(records);
                                        availabilityData.created 	= getUtcDate();
                                        availabilityData.modified 	= getUtcDate();
                                        availabilityData.item_id 	= clonedItemId;

                                        /** Update availability details  */
                                        availabilityCollection.insertOne(availabilityData).then(()=> {
                                            eachCallback(null);
                                        }).catch(next);
                                    },(eachErr)=>{
                                        callback(eachErr);
                                    });
                                },
                                update_price_details : (callback)=>{
                                    asyncEach(priceInputs,(records, eachCallback)=>{
                                        if(!records) return eachCallback(null);

                                        /** modify data */
                                        let priceData 		= clone(records);
                                        priceData.created 	= getUtcDate();
                                        priceData.modified 	= getUtcDate();
                                        priceData.item_id 	= clonedItemId;

                                        /** Update price details  */
                                        unitsCollection.insertOne(priceData).then(()=> {
                                            eachCallback(null);
                                        }).catch(next);
                                    },(eachErr)=>{
                                        callback(eachErr);
                                    });
                                },
                                update_item_choice_groups_details : (callback)=>{
                                    asyncEach(itemChoiceGroupResult,(choiceGroupRecords, eachCallback)=>{
                                        if(!choiceGroupRecords) return eachCallback(null);

                                        /** modify data */
                                        choiceGroupData 			= clone(choiceGroupRecords);
                                        choiceGroupData.created 	= getUtcDate();
                                        choiceGroupData.modified 	= getUtcDate();
                                        choiceGroupData.item_id 	= clonedItemId;
                                        delete choiceGroupData._id;

                                        /** Update item choice group details  */
                                        itemChoiceGroupCollection.insertOne(choiceGroupData).then(choiceGroupResult=> {

                                            asyncEach(itemExtraMastersResult,(extraMasterRecords, extraMasterEachCallback)=>{
                                                if(!extraMasterRecords) return extraMasterEachCallback(null);

                                                /** modify data */
                                                extraMastersData 			= clone(extraMasterRecords);
                                                extraMastersData.created 	= getUtcDate();
                                                extraMastersData.modified 	= getUtcDate();
                                                extraMastersData.item_id 	= clonedItemId;

                                                /** Update item extra masters details  */
                                                itemExtraMastersCollection.insertOne(extraMastersData).then(extraMastersResult=> {

                                                    asyncEach(itemGroupExtrasResult,(groupExtrasRecords, groupExtrasEachCallback)=>{
                                                        if(!groupExtrasRecords) return groupExtrasEachCallback(null);

                                                        /** modify data */
                                                        groupExtrasData 			= clone(groupExtrasRecords);
                                                        groupExtrasData.created 	= getUtcDate();
                                                        groupExtrasData.modified 	= getUtcDate();
                                                        groupExtrasData.item_id 	= clonedItemId;
                                                        groupExtrasData.group_id 	= ObjectId(choiceGroupResult.insertedId);
                                                        groupExtrasData.item_extra_id = ObjectId(extraMastersResult.insertedId);

                                                        /** Update item group extras details  */
                                                        itemGroupExtrasCollection.insertOne(groupExtrasData).then(()=> {
                                                            groupExtrasEachCallback(null);
                                                        }).catch(next);
                                                    },(groupExtrasEachErr)=>{
                                                        extraMasterEachCallback(groupExtrasEachErr);
                                                    });
                                                }).catch(next);
                                            },(extraMasterEachErr)=>{
                                                eachCallback(extraMasterEachErr);
                                            });
                                        }).catch(next);
                                    },(eachErr)=>{
                                        callback(eachErr);
                                    });
                                },
                            },(asyncErr)=> {
                                if(asyncErr) return next(asyncErr);

                                /** Set flash message**/
                                let isAdminUser	= isAdmin(req,res);
                                let message		= (isAdminUser) ? res.__("items.item_has_been_cloned_successfully") :res.__("items.item_has_been_cloned_and_send_for_approval");

                                /* success response*/
                                req.flash(Constants.STATUS_SUCCESS,message);
                                res.send({status : Constants.STATUS_SUCCESS,message : message,});

                                /** Save System logs */
                                saveSystemLogs(req, res, {
                                    user_id				: new ObjectId(req?.session?.user?._id),
                                    parent_type 		: "items",
                                    parent_id 			: clonedItemId,
                                    activity_type		: Constants.ACTIVITY_CLONE_DETAILS,
                                    additional_details	: {parent_item : itemId,channel_id	: req?.session?.user?.channel_id || ""}
                                }).then(()=>{ });
                            });
                        }).catch(next);
                    });
                });
            }else{
                /**Get Item Details */
                const items	= this.db.collection(Tables.ITEMS);
                let itemDetails = await items.findOne({ _id : itemId},{projection : {_id : 1, menu_ids : 1, category_ids : 1,name:1,description:1}});

                /** Send error response when item not found **/
                if(!itemDetails) return res.status(400).send({status: Constants.STATUS_ERROR,message:res.__("admin.system.invalid_access")});

                let categoryCondition = {};
                if(itemDetails?.menu_ids?.constructor === Array && itemDetails?.menu_ids?.length > 0){
                    categoryCondition = {menu_ids:{$in: itemDetails?.menu_ids}};
                }

                /** Get category ids  */
                let categoryIds = await items.distinct("category_ids",categoryCondition);


                /**Get menu and category dropdown list **/
                let dropDownResponse = await getDropdownList(req,res,next,{
                    collections :[{
                        collection : Tables.RESTAURANT_MENUS,
                        columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
                        selected   : itemDetails?.menu_ids,
                        conditions : {
                            restaurant_slug : restaurantSlug,
                            is_active		: Constants.ACTIVE,
                        }
                    },
                    {
                        collection : Tables.RESTAURANT_CATEGORIES,
                        columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
                        selected   : itemDetails?.category_ids,
                        conditions : {
                            _id 			: {$in : categoryIds},
                            restaurant_slug : restaurantSlug,
                            is_active		: Constants.ACTIVE,
                        }
                    }]
                });

                /** Send error response when dropdown list not found **/
                if(dropDownResponse.status != Constants.STATUS_SUCCESS) return res.status(400).send(dropDownResponse);

                /** Render clone item page */
                res.render("items/clone",{
                    layout			: false,
                    item_id 		: itemId,
                    result			: itemDetails,
                    menu_list		: dropDownResponse?.final_html_data?.[0] || "",
                    category_list	: dropDownResponse?.final_html_data?.[1] || "",
                });
            }
        }catch(e){
            return next(e);
        }
	};//End cloneItem()

    /**
	 * Function to copy approved item to tmp item
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	async copyItemToPending(req,res,next,options){
		return new Promise(resolve=>{
			let slug 	= req?.params?.slug;
			let itemId 	= (options && options.item_id) ? new ObjectId(options.item_id) : new ObjectId(req?.params?.item_id);

			asyncParallel({
				copy_item : (callback)=>{
					/** Copy data  tmp_item_extra_masters to item_extra_masters collections */
					copyFromParentTable(req,res,next,{
						parent_table : {
							name 			: Tables.ITEMS,
							fields 			: { modified: 0,_id: 0},
							conditions 		: {_id: itemId, restaurant_slug: slug},
							remove_original : false
						},
						child_table : {
							name 			  : Tables.TMP_ITEMS,
							conditions		  :	{restaurant_slug: slug, _id: itemId},
							additional_fields : {user_id : new ObjectId(req?.session?.user?._id), status: Constants.PENDING,modified: getUtcDate(),submit_for_approval : false}
						}
					}).then((itemResponse)=>{
						if(itemResponse.status != Constants.STATUS_SUCCESS) return callback(itemResponse);
						callback(null);
					});
				},
				copy_item_availablity : (callback)=>{
					copyFromParentTable(req,res,next,{
						parent_table	: {
							name 			: Tables.ITEM_AVAILABILITY,
							fields 			: {modified: 0},
							conditions 		: {item_id: itemId},
							remove_original : false
						},
						child_table 			: {
							name 				: Tables.TMP_ITEM_AVAILABILITY,
							conditions			: {item_id: itemId},
							additional_fields 	: {modified: getUtcDate()},
							multiple			: true,
						}
					}).then(availablityResponse=>{
						if(availablityResponse.status != Constants.STATUS_SUCCESS) return callback(availablityResponse);
						callback(null);
					});
				},
				copy_item_units : (callback)=>{
					copyFromParentTable(req,res,next,{
						parent_table 	: {
							name 			: Tables.ITEM_UNITS,
							fields 			: {modified: 0},
							conditions 		: {item_id: itemId},
							remove_original : false
						},
						child_table 			: {
							name 				: Tables.TMP_ITEM_UNITS,
							conditions			: {item_id: itemId},
							additional_fields 	: {modified: getUtcDate()},
							multiple			: true,
						}
					}).then(unitsResponse=>{
						if(unitsResponse.status != Constants.STATUS_SUCCESS) return callback(unitsResponse);
						callback(null);
					});
				},
			},(asyncErr)=>{
				if(asyncErr) return next(asyncErr);
				resolve({status :Constants.STATUS_SUCCESS});
			});
		});
	};//End copyItemToPending()

    /**
	* Function for view item detail
	*
	* @param req 	As 	Request Data
    * @param res 	As 	Response Data
    * @param next 	As 	Callback argument to the middleware function
	*
	* @return render
	*/
	async viewItemDetails(req,res,next){
        try{
            let itemId 	= new ObjectId(req?.params?.id);
            let slug 	= req?.params?.slug;

            /** Get item details **/
            let itemResponse = await this.getItemDetails(req, res, next);

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

                /** Render view page  **/
                res.render('items/view_item_details',{
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
	};//End viewItemDetails()

    /**
	 * Function to overridingItem item
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async overridingItem(req,res,next){
        try{
            let itemId 	= 	(req?.params?.item) ? req?.params?.item : "";
            let slug 	=	req?.params?.slug;
            if(isPost(req)){
                /** Sanitize Data **/
                req.body 	= sanitizeData(req?.body,Constants.NOT_ALLOWED_TAGS_XSS);

                /** Get item details **/
                const items	= this.db.collection(Tables.ITEMS);
                let itemDetails = await items.findOne({_id : new ObjectId(itemId)},{projection : {_id : 1, menu_ids : 1, category_ids : 1,name:1,price_on_selection:1}});

                /** Send error response when item not found **/
                if(!itemDetails) return res.send({status : Constants.STATUS_ERROR,message: res.__("system.invalid_access")});

                /** Get branch ids **/
                let branches	= (req?.body?.branches?.constructor === Array) ? req?.body?.branches : [req?.body?.branches];
                let branchIds	= branches.map(branchId=>{return new ObjectId(branchId);});

                /** Get restaurant id **/
                let restaurantId = await getRestaurantId(req,res,next,{slug:slug});

                /** Which function to use insertOne or updateOne with upsert */
                const item_linkings	= this.db.collection(Tables.ITEM_LINKINGS);
                await item_linkings.updateOne({
                    item_id	: new ObjectId(itemId),
                },
                {
                    $set : {
                        branch_ids			: branchIds,
                        menu_ids			: itemDetails.menu_ids,
                        category_ids		: itemDetails.category_ids,
                        type				: parseInt(req.body.options),
                        restaurant_id		: new ObjectId(restaurantId),
                        customize_attributes: {
                            name 				: itemDetails.name,
                            price_on_selection	: itemDetails.price_on_selection
                        },
                    },
                    $setOnInsert : {
                        created	  : getUtcDate()
                    }
                },
                {upsert :true});

                /** Send success response **/
                res.send({
                    status	: Constants.STATUS_SUCCESS,
                    message	: res.__("items.item_has_been_override_successfully")
                });
            } else {
                /** Get item linkings details **/
                const item_linkings	= this.db.collection(Tables.ITEM_LINKINGS);
                let overrideData = await item_linkings.findOne({item_id	: new ObjectId(itemId)},{projection:{branch_ids : 1,type:1}});

                let branchIds 	= (overrideData && overrideData.branch_ids) ? overrideData.branch_ids : [];
                let type 		= (overrideData && overrideData.type) ? overrideData.type : "";
                asyncParallel({
                    branch_list :(callback)=>{
                        /**Get branch list **/
                        getDropdownList(req,res,next,{
                            collections :[{
                                collection : Tables.RESTAURANT_BRANCHES,
                                columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
                                selected   : branchIds,
                                conditions : {
                                    restaurant_slug : slug,
                                    is_active		: Constants.ACTIVE,
                                }
                            }]
                        }).then(dropDownResponse=> {
                            if(dropDownResponse.status != Constants.STATUS_SUCCESS) return callback(dropDownResponse);
                            callback(null,dropDownResponse?.final_html_data?.[0] || "");
                        }).catch(next);
                    },
                    branch_detail : (callback) => {
                        const restaurant_branches= this.db.collection(Tables.RESTAURANT_BRANCHES);
                        restaurant_branches.find({ _id : {$in : branchIds},is_active: Constants.ACTIVE,restaurant_slug : slug}).toArray().then(result=>{
                            callback(null,result);
                        }).catch(next);
                    }
                },(_, response)=>{

                    /** Render  Over riding item page */
                    res.render("items/overriding",{
                        layout			: false,
                        item_id 		: itemId,
                        override_type	: type,
                        branch_list		: response?.branch_list || "",
                        branch_detail	: response?.branch_detail || []
                    });
                });
            }
        }catch(e){
            return next(e);
        }
	};//End overridingItem()

    /**
	 * Function to add upselling items
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async addUpsellingItem(req,res,next){
		try{
			let itemId   = req?.params?.item_id ;
			let slug 	 = (req?.params && req?.params?.slug) ? req?.params?.slug :"";

            if(isPost(req)){
                /** Sanitize Data **/
                req.body 			= sanitizeData(req?.body,Constants.NOT_ALLOWED_TAGS_XSS);
                let upsellingIds	= (req?.body?.upselling)	?	req?.body?.upselling :[];

                /** Convert into object id  */
                if(upsellingIds.constructor !== Array) upsellingIds = [upsellingIds];
                upsellingIds = arrayToObject(upsellingIds);

                /**For save upselling item*/
                const item_upsellings	= this.db.collection(Tables.ITEM_UPSELLINGS);
                await item_upsellings.updateOne({
                    item_id   : new ObjectId(itemId)
                },
                {
                    $set:{
                        added_by : new ObjectId(req?.session?.user?._id),
                        modified : getUtcDate()
                    },
                    $setOnInsert : {
                        created : getUtcDate()
                    },
                    $addToSet: { upselling: { $each: upsellingIds}}
                },{upsert:true});

                /** Save System logs */
                saveSystemLogs(req, res, {
                    user_id				: req?.session?.user?._id,
                    parent_type 		: Tables.ITEM_UPSELLINGS,
                    parent_id 			: itemId,
                    activity_type		: Constants.ACTIVITY_ADD_UPSELLING_ITEM,
                    additional_details	: {}
                }).then(()=>{ });

                /** Send success response */
                res.send({
                    status	: Constants.STATUS_SUCCESS,
                    message	: res.__("items.upselling_item_has_been_added_successfully")
                });
            }else {
                /**For get item upselling detail */
                const item_upsellings = this.db.collection(Tables.ITEM_UPSELLINGS);
                let itemUpsellingResult = await item_upsellings.findOne({item_id : new ObjectId(itemId)},{projection:{upselling:1}});

                /**Get item list **/
                let selectedUpsellingItem = itemUpsellingResult?.upselling || [];
                let dropDownResponse = await getDropdownList(req,res,next,{
                    collections :[{
                        collection : Tables.ITEMS,
                        selected   : selectedUpsellingItem,
                        columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
                        conditions : {
                            _id				: {$ne : new ObjectId(itemId)},
                            restaurant_slug : slug
                        }
                    }]
                });

                /** Send error response when item list has error **/
                if(dropDownResponse.status != Constants.STATUS_SUCCESS) return res.status(400).send(dropDownResponse);

                /** Render upselling item page */
                res.render("items/upselling_item",{
                    layout		: false,
                    item_id 	: itemId,
                    item_list	: dropDownResponse.final_html_data[0],
                });
            }
        }catch(e){
            return next(e);
        }
	};//End addUpsellingItem()
}
export default Item;