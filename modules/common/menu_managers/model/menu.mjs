import { ObjectId } from 'mongodb';
import { parallel as asyncParallel, each as asyncEach } from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';

import {isPost, sanitizeData, getUtcDate, configDatatable, getUniqueId,getDropdownList, getRestaurantId, moveUploadedFile, appendFileExistData, arrayToObject,getRestaurantDropdowns,copyFromParentTable,isAdmin} from '../../../../utils/index.mjs';
import {sendMailToUsers,insertNotifications,saveUserActivity} from '../../../../services/index.mjs';

class Menu {
    constructor(db) {
        this.db = db;
    }

    /**
	 * Function to get menu list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
    async getMenuList(req, res, next) {
        try {
            let slug = req?.params?.slug || "";
            if(isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                const collection = this.db.collection(Tables.RESTAURANT_MENUS);

                let commonConditions = { restaurant_slug: slug };

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);

                /** assign in a single object */
                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

                // Get list or count of restaurant menus
                let dbRes = await collection.aggregate([
                    { $match: dataTableConfig.conditions },
                    {$facet : {
                        list : [
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit },
                            {$project: {
                                _id: 1, name: 1, menu_id: 1, image: 1, is_default: 1, status: 1, start_date: 1, start_time: 1, end_date: 1, end_time: 1
                            }}
                        ],
                        count: [
                            {$count: "count"},
                        ],
                    }}
                ]).toArray();

                let list = dbRes?.[0]?.list || [];
                appendFileExistData({
                    file_url: Constants.MENU_FILE_URL,
                    file_path: Constants.MENU_FILE_PATH,
                    result: list,
                    database_field: "image",
                }).then(fileResponse => {

                    /** Send response **/
                    res.send({
                        status: Constants.STATUS_SUCCESS,
                        draw: dataTableConfig.result_draw,
                        data			:   fileResponse?.result || [],
                        recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
                        recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
                    });
                }).catch(next);
            }else {
                res.render("list", {
                    layout: false,
                    slug: slug,
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
	 * Function to get pending menu list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
    async pendingMenuList(req, res, next) {
        try {
            let slug = (req.params && req.params.slug) ? req.params.slug : "";
            let type = (req.params && req.params.type) ? req.params.type :"";
            if (isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                const collection = this.db.collection(Tables.TMP_RESTAURANT_MENUS);

                let commonConditions = {};
                if (!type) commonConditions = { restaurant_slug: slug };
                if (isAdmin(req, res))  commonConditions.status = { $in: [Constants.PENDING, Constants.IN_REVIEW] };

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);

                /** assign in a single object */
                dataTableConfig.conditions = Object.assign(commonConditions, dataTableConfig.conditions);

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

                // Get list or count of restaurant menus
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
                                    _id: 1, name: 1, image: 1, is_default: 1, start_date: 1, start_time: 1, end_date: 1, end_time: 1, status: 1, restaurant_slug: 1, rejection_reason: 1, restaurant_name: { "$arrayElemAt": ["$restaurant_data.default_name", 0] }
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
                    "file_url" 		 : Constants.MENU_FILE_URL,
                    "file_path" 	 : Constants.MENU_FILE_PATH,
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
            } else {
                /** Get restaurant list **/
                let restaurantList =  "";
                if(type) {
                    restaurantList = await getRestaurantDropdowns(req, res, next, {slug: req?.query?.restaurant || ""});
                }

                res.render('pending_menu', {
                    layout: false,
                    slug: slug,
                    type: type,
                    search_status: req?.query?.status || "",
                    restaurant_list: restaurantList,
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
	 * Function to get menu's detail
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next 	As Callback argument to the middleware function
     * @param isPending As boolean argument to the change collection name
	 *
	 * @return json
	 */
    async getMenuDetails(req, res, next,isPending = false) {
        try {
            let menuId  = req?.params?.id || "";
            let slug    = req?.params?.slug ||"";

            /** Get menu details **/
            const restaurant_menus = this.db.collection(isPending ? Tables.TMP_RESTAURANT_MENUS : Tables.RESTAURANT_MENUS);
            let result = await restaurant_menus.findOne({
                _id  : new ObjectId(menuId),
                restaurant_slug : slug
            },{projection: {
                _id:1,name:1,is_default:1,image:1,start_date:1, start_time: 1, end_date:1,end_time :1,menu_id:1,created:1
            }});

            /** Send error response */
            if(!result) return {status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") };

            /** Appened image with full path **/
            let imageResponse = await appendFileExistData({
                "file_url" 		 : Constants.MENU_FILE_URL,
                "file_path" 	 : Constants.MENU_FILE_PATH,
                "result" 		 : [result],
                "database_field" : "image"
            });

            /** Send success response **/
            return {
                status	: Constants.STATUS_SUCCESS,
                result	: imageResponse?.result?.[0] || {}
            };
        } catch (error) {
            next(error);
        }
    }

    /**
	 * Function for add or update menu
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
    async addEditMenu(req, res, next) {
        try {
            let isEditable	= req?.params?.id || false;
            let slug  		= req?.params?.slug || "";

            if(isPost(req)){
                /** Sanitize Data **/
                req.body 			= sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
                let menuId			= req?.params?.id ? new ObjectId(req.params.id) : new ObjectId();
                let authUserId		= req?.session?.user?._id || "";
                let defaultChecked	= req?.body?.default_checked || false;
                let startDate       = req?.body?.start_date ? parseInt( req.body.start_date)  : "";
                let endDate         = req?.body?.end_date   ? parseInt(req.body.end_date)  	: "";
                let startTime       = req?.body?.start_time ? parseFloat(req.body.start_time.replace(':','.')) : "";
                let endTime         = req?.body?.end_time   ? parseFloat(req.body.end_time.replace(':','.'))	 : "";
                let nameEnglish	    = req?.body?.name_in_english || "";
                let nameArabic	    = req?.body?.name_in_arabic || "";
                let menuUniqueId    = req?.body?.menu_id || "";
                let created		    = req?.body?.created || "";

                /* check unique names fields */
                let collection	= this.db.collection(Tables.RESTAURANT_MENUS);
                asyncParallel({
                    unique_menu_id : (callback)=>{
                        if(menuUniqueId) return callback(null,menuUniqueId);

                        /** Get menu unique id **/
                        getUniqueId(req,res,next,{type:"restaurant_menus"}).then(response=>{
                            if(response.status !== Constants.STATUS_SUCCESS) return callback(response);
                            callback(null,response.result);
                        }).catch(next);
                    },
                    restaurant_details : (callback)=>{
                        /** find restaurant details **/
                        const restaurants = this.db.collection(Tables.RESTAURANTS);
                        restaurants.findOne({slug : slug},{projection: { _id: 1,default_name:1}}).then(restaurantResult=>{
                            callback(null, restaurantResult);
                        }).catch(next);
                    },
                },async (asyncErr,asyncResponse)=>{
                    if(asyncErr) return next(asyncErr);

                    let restaurantDetails	= asyncResponse.restaurant_details || {};
                    let restaurantId	 	= restaurantDetails._id || "";
                    let restaurantName	 	= restaurantDetails.default_name || "";

                    /** Upload  image **/
                    let imageResponse = await moveUploadedFile(req,res,{
                        'image'			: req?.files?.image || "",
                        'filePath'		: Constants.MENU_FILE_PATH,
                        'oldPath'		: req?.body?.old_image || "",
                        'ignore_unlink' : true
                    });

                    /** Send error response **/
                    if(imageResponse.status == Constants.STATUS_ERROR){
                        return res.send({status: Constants.STATUS_ERROR, message: [{'param':'image','msg':imageResponse.message}] });
                    }

                    let updateData = {
                        name : {
                            en 	: nameEnglish,
                            ar 	: nameArabic,
                        },
                        start_date	: startDate,
                        start_time	: startTime,
                        end_date	: endDate,
                        end_time	: endTime,
                        is_default	: false,
                        modified 	: getUtcDate()
                    };

                    if(defaultChecked) updateData.is_default = true;

                    /** if user upload new image **/
                    if(imageResponse.fileName) updateData.image = imageResponse.fileName;
                    if(!isAdmin(req,res)){
                        updateData.status	= Constants.PENDING;
                        updateData.user_id	= new ObjectId(authUserId);
                        collection 			= this.db.collection(Tables.TMP_RESTAURANT_MENUS);
                    }

                    /** save details */
                    collection.updateOne({
                        _id : menuId
                    },
                    {
                        $set : updateData ,
                        $setOnInsert: {
                            restaurant_id	: restaurantId,
                            restaurant_slug	: slug,
                            added_by		: new ObjectId(authUserId),
                            channel_id		: req?.session?.user?.channel_id || "",
                            menu_id 		: asyncResponse.unique_menu_id || "",
                            is_active		: Constants.ACTIVE,
                            created 		: (created) ? getUtcDate(created) : getUtcDate(),
                        }
                    },{upsert: true}).then(()=>{

                        /**success response  message**/
                        let isAdminUser		= isAdmin(req,res);
                        let updateMessage	= (isAdminUser) ? res.__("menu_manager.menu_has_been_updated_successfully") : res.__("menu_manager.menu_has_been_updated_and_send_for_approval");
                        let addMessage		= (isAdminUser) ? res.__("menu_manager.menu_has_been_added_successfully") : res.__("menu_manager.menu_has_been_added_and_send_for_approval");
                        let message			= (isEditable) ? updateMessage :addMessage;

                        /* success response*/
                        if(!isEditable) req.flash(Constants.STATUS_SUCCESS,message);
                        res.send({status: Constants.STATUS_SUCCESS, message: message});

                        /** Save user activities **/
                        saveUserActivity(req,res,{
                            user_id 		:	new ObjectId(authUserId),
                            parent_type 	:	Tables.RESTAURANT_MENUS,
                            parent_id 		: 	menuId,
                            activity_type	:	Constants.ACTIVITY_ADD_EDIT_DETAILS,
                            additional_details:	{restaurant_slug: slug,channel_id : req?.session?.user?.channel_id || ""},
                        }).then(()=>{});

                        if(!isAdmin(req,res)){
                            /*************** Send notification  ***************/
                            insertNotifications(req,res,{
                                notification_data : {
                                    notification_type	: Constants.NOTIFICATION_RESTAURANT_MENU_APPROVAL_REQUEST,
                                    message_params 		: [nameEnglish,restaurantName],
                                    parent_table_id 	: menuId,
                                    user_role_id 		: Constants.CRAVEZ,
                                    role_id 			: [Constants.CRAVEZ,Constants.CONTENT_TEAM],
                                    only_for_user_role	: true,
                                    extra_parameters	: {restaurant_slug: slug}
                                }
                            }).then(()=>{});
                            /*************** Send notification  ***************/
                        }
                    });
                });
            }else{
                let response = {};
                if(isEditable){
                    /** Get menu details **/
                    response  =	await this.getMenuDetails(req, res, next);

                    /** Send error response **/
                    if(response.status != Constants.STATUS_SUCCESS)return res.status(400).send(response);
                }

                /** Render add-edit page  **/
                res.render('add_edit',{
                    layout		: false,
                    slug		: slug,
                    result		: response?.result || {},
                    is_editable	: isEditable
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
	 * Function to update pending menu
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
    async editPendingMenu(req, res, next) {
        try {
            let slug  = req?.params?.slug || "";
            if(isPost(req)){
                let menuId		= req?.params?.id ? new ObjectId(req.params.id) : "";
                let authUserId	= req?.session?.user?._id || "";

                /** Sanitize Data **/
                req.body 			= sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
                let defaultChecked	= req?.body?.default_checked || "";
                let startDate = req?.body?.start_date ? parseInt( req.body.start_date)  : "";
                let endDate   = req?.body?.end_date   ? parseInt(req.body.end_date)  	: "";
                let startTime = req?.body?.start_time ? parseFloat(req.body.start_time.replace(':','.')) : "";
                let endTime   = req?.body?.end_time   ? parseFloat(req.body.end_time.replace(':','.'))	 : "";
                let nameEnglish	= req?.body?.name_in_english || "";
                let nameArabic	= req?.body?.name_in_arabic || "";

                /* check unique names fields */
                let tmp_restaurant_menus = this.db.collection(Tables.TMP_RESTAURANT_MENUS);
                asyncParallel({
                    restaurant_details : (callback)=>{
                        /** find restaurant details **/
                        const restaurants = this.db.collection(Tables.RESTAURANTS);
                        restaurants.findOne({slug : slug},{projection: { _id: 1,default_name:1}}).then(restaurantResult=>{
                            callback(null, restaurantResult);
                        }).catch(next);
                    },
                    current_menu_details : (callback)=>{
                        /** Get menu details **/
                        tmp_restaurant_menus.findOne({_id: new ObjectId(menuId), restaurant_slug: slug },{projection: { _id: 1,status:1}}).then(result=>{
                            callback(null, result);
                        }).catch(next);
                    },
                },async (asyncErr,asyncResponse)=>{
                    if(asyncErr) return next(asyncErr);

                    let restaurantDetails	= asyncResponse.restaurant_details || {};
                    let restaurantName		= restaurantDetails.default_name || "";
                    let currentMenuDetails	= asyncResponse.current_menu_details || {};

                    /** Upload  image **/
                    let imageResponse = await moveUploadedFile(req,res,{
                        'image'			: req?.files?.image || "",
                        'filePath'		: Constants.MENU_FILE_PATH,
                        'oldPath'		: req?.body?.old_image || "",
                        'ignore_unlink' : true
                    });

                    /** Send error response **/
                    if(imageResponse.status == Constants.STATUS_ERROR) return res.send({status : Constants.STATUS_ERROR,message	: [{'param':'image','msg':imageResponse.message}]});

                    let updateData = {
                        name : {
                            en 	: nameEnglish,
                            ar 	: nameArabic,
                        },
                        start_date	: startDate,
                        start_time	: startTime,
                        end_date	: endDate,
                        end_time	: endTime,
                        is_default	: false,
                        modified 	: getUtcDate()
                    };

                    if(!isAdmin(req,res)){
                        updateData.user_id	= new ObjectId(authUserId);
                        updateData.status	= Constants.PENDING;
                    }

                    if(defaultChecked) updateData.is_default = true;

                    /** if user upload new image **/
                    if(imageResponse.fileName) updateData.image = imageResponse.fileName;

                    /** save details */
                    tmp_restaurant_menus.updateOne({_id : menuId},{$set : updateData}).then(()=>{

                        let successMessage 	= (isAdmin(req,res) || currentMenuDetails.status != Constants.REJECTED) ? res.__("menu_manager.menu_has_been_updated_successfully") : res.__("menu_manager.pending_menu_has_been_updated_and_send_for_approval");

                        /* success response*/
                        res.send({
                            status		: Constants.STATUS_SUCCESS,
                            redirect_url: res.locals.list_url,
                            message		: successMessage,
                        });

                        if(currentMenuDetails.status && currentMenuDetails.status == Constants.REJECTED && !isAdmin(req,res)){
                            /*************** Send notification  ***************/
                            insertNotifications(req,res,{
                                notification_data : {
                                    notification_type	: Constants.NOTIFICATION_RESTAURANT_MENU_APPROVAL_REQUEST,
                                    message_params 		: [nameEnglish,restaurantName],
                                    parent_table_id 	: menuId,
                                    user_role_id 		: Constants.CRAVEZ,
                                    role_id 			: [Constants.CRAVEZ,Constants.CONTENT_TEAM],
                                    only_for_user_role	: true,
                                    extra_parameters	: {
                                        restaurant_slug	: slug
                                    }
                                }
                            }).then(()=>{});
                            /*************** Send notification  ***************/
                        }

                        /** Save user activities **/
                        saveUserActivity(req,res,{
                            user_id 		:	authUserId,
                            parent_type 	:	Tables.RESTAURANT_MENUS ,
                            parent_id 		: 	menuId,
                            activity_type	:	Constants.ACTIVITY_ADD_EDIT_DETAILS,
                            additional_details:	{restaurant_slug: slug,channel_id	: req?.session?.user?.channel_id || ""},
                        }).then(()=>{});
                    }).catch(next);
                });
            }else{
                /** Get menu details **/
                let response  =	await this.getMenuDetails(req, res, next,true);

                /** Send error response **/
                if(response.status != Constants.STATUS_SUCCESS)return res.status(400).send(response);

                /** Render add-edit page  **/
                res.render('edit_pending',{
                    layout	: false,
                    result	: response?.result || {},
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
	 * Function to reject review menu
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
    async rejectReviewMenu(req, res, next) {
        try {
            let menuId	= req?.body?.menu_id ? new ObjectId(req.body.menu_id) 	: "";
            let status	= req?.body?.status	? parseInt(req.body.status)	: "";
            let slug 	= req?.body?.slug || "";
            let reason	= req?.body?.rejection_reason ||  "";

            /** send error response */
            if(!menuId) return res.send({status: Constants.STATUS_ERROR,message	: res.__("system.invalid_access")});

            let dataToBeUpdated = {
                status		: status,
                modified  	: getUtcDate(),
            };

            if(status == Constants.REJECTED) dataToBeUpdated.rejection_reason = reason;

            /** Send error response **/
            const tmp_restaurant_menus	= this.db.collection(Tables.TMP_RESTAURANT_MENUS);
            let tmpResult = await tmp_restaurant_menus.findOne({
                _id 	: 	new ObjectId(menuId),
                status	:	{$in : [Constants.PENDING,Constants.IN_REVIEW]},
            },
            {projection: {_id:1, name: 1,restaurant_id:1, user_id:1}});

            /** Send error response **/
            if(!tmpResult) return res.send({status: Constants.STATUS_ERROR,message	: res.__("system.invalid_access")});

            /** Update menu status **/
            await tmp_restaurant_menus.updateOne({_id : menuId,restaurant_slug : slug},{$set : dataToBeUpdated});

            /** Update menu status in restaurant_menus collection **/
            if(status == Constants.IN_REVIEW){
                const restaurant_menus = this.db.collection(Tables.RESTAURANT_MENUS);
                await restaurant_menus.updateOne({_id : menuId,restaurant_slug : slug},{$set : {status : Constants.IN_REVIEW,modified : getUtcDate()}});
            }

            let message = (status == Constants.REJECTED) ? res.__("menu_manager.menu_request_rejected_successfully") : res.__("menu_manager.menu_request_marked_in_review");

            /*send success response */
            res.send({status : Constants.STATUS_SUCCESS,message: message,});

            /** Save user activities **/
            saveUserActivity(req,res,{
                user_id 		:	req?.session?.user?._id || "",
                parent_type 	:	Tables.RESTAURANT_MENUS ,
                parent_id 		: 	menuId,
                activity_type	:	Constants.ACTIVITY_UPDATE_STATUS,
                additional_details:	{restaurant_slug: slug,status:status,channel_id	: req?.session?.user?.channel_id || ""},
            }).then(()=>{});


            /*************** Send Mail  ***************/
            if(status == Constants.REJECTED){
                let menuName = tmpResult?.name?.[Constants.DEFAULT_LANGUAGE_CODE] || "";
                sendMailToUsers(req,res,{
                    event_type 		: Constants.RESTAURANT_MENU_REJECT_EMAIL_EVENTS,
                    menu_id			: menuId,
                    menu_name		: menuName,
                    restaurant_slug	: slug,
                    restaurant_id	: tmpResult.restaurant_id || "",
                    user_id			: tmpResult.user_id || "",
                    reject_msg		: reason
                });
            }
            /*************** Send Mail  ***************/
        } catch (error) {
            next(error);
        }
    }

    /**
	 * Function for approve menu
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
    async approveMenu(req, res, next) {
        try {
            let menuId	= req?.body?.menu_id ? new ObjectId(req.body.menu_id) 	: "";
            let slug 	= req?.body?.slug || "";

            /** send error response */
            if(!menuId) return res.send({ status : Constants.STATUS_ERROR,message	: res.__("system.invalid_access")});

            const tmp_restaurant_menus	= this.db.collection(Tables.TMP_RESTAURANT_MENUS);
            let menuData = await tmp_restaurant_menus.findOne({_id : menuId,restaurant_slug : slug},{projection : {restaurant_id:1,name:1,user_id:1}});

            /** Send error response **/
            if(!menuData) return res.send({ status : Constants.STATUS_ERROR,message	: res.__("system.invalid_access")});

            /** Copy data tmp_restaurant_categories to restaurant_categories collections*/
            let response = await copyFromParentTable(req,res,next,{
                type : 	"update_restaurant_menus",
                parent_table : {
                    name 			: Tables.TMP_RESTAURANT_MENUS,
                    fields 			: {_id:0, status:0,restaurant_slug:0,user_id:0,rejection_reason:0},
                    conditions 		: {restaurant_slug: slug, _id: menuId},
                    remove_original : true
                },
                child_table : {
                    name 		: Tables.RESTAURANT_MENUS,
                    conditions	: {restaurant_slug : slug, _id: menuId},
                }
            })

            /** Send error response **/
            if(response.status != Constants.STATUS_SUCCESS) return res.send({status: Constants.STATUS_ERROR,message	: response.message});

            /** Send success response **/
            res.send({status: Constants.STATUS_SUCCESS, message	: res.__("menu_manager.menu_request_approved_successfully")});

            /** Save user activities **/
            saveUserActivity(req,res,{
                user_id 		:	req?.session?.user?._id || "",
                parent_type 	:	Tables.RESTAURANT_MENUS ,
                parent_id 		: 	menuId,
                activity_type	:	Constants.ACTIVITY_UPDATE_STATUS,
                additional_details:	{restaurant_slug: slug,status : Constants.APPROVED,channel_id	: req?.session?.user?.channel_id || ""},
            }).then(()=>{});

            /*************** Send Mail  ***************/
            let menuName = menuData?.name?.[Constants.DEFAULT_LANGUAGE_CODE] || "";
            sendMailToUsers(req,res,{
                event_type 		: Constants.RESTAURANT_MENU_APPROVE_EMAIL_EVENTS,
                menu_id			: menuId,
                menu_name		: menuName,
                restaurant_slug	: slug,
                restaurant_id	: menuData?.restaurant_id || "",
                user_id			: menuData?.user_id || "",
            });
            /*************** Send Mail  ***************/
        } catch (error) {
        next(error);
        }
    }

    /**
	 * Function for update restaurant pending menu's status
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
	 */
    async updateMultipleMenuStatus(req, res, next) {
        try {
            let menuIds	= req?.body?.menu_id?.split(",") || [];
            let status 	= (req?.body?.status) 	? parseInt(req?.body?.status) 	:"";

            /** Send error response */
            if(!menuIds || menuIds.length <=0 || !status){
                return res.send({status : Constants.STATUS_ERROR, message	: res.__("system.invalid_access")});
            }

            /** Convert object id */
            menuIds = arrayToObject(menuIds);

            /** Get restaurant menu details */
            const tmp_restaurant_menus	= this.db.collection(Tables.TMP_RESTAURANT_MENUS);
            let result = await tmp_restaurant_menus.find({
                _id 	:	{$in : menuIds},
                status	: 	{$nin: [Constants.APPROVED, Constants.REJECTED]}
            },{projection: {_id:1, name: 1, restaurant_slug: 1, restaurant_id:1, user_id:1}}).toArray();

            /** send invalid access if zero document found */
            if(!result || result.length <=0) return res.send({status: Constants.STATUS_ERROR,message: res.__("system.invalid_access")});

            asyncParallel({
                update_menu_details :(callback)=>{
                    if(status == Constants.APPROVED) return callback(null);

                    /** Set updated Data  */
                    let updateData = {
                        status 	:	parseInt(status),
                        modified: 	getUtcDate(),
                    };

                    if(status == Constants.REJECTED) updateData.rejection_reason = req.body.rejection_reason;

                    /** Update restaurant menu details */
                    tmp_restaurant_menus.updateMany({_id : {$in : menuIds} },{$set :updateData}).then(()=>{
                        callback(null);
                    }).catch(next);
                },
                approve_menu_details:(callback)=>{
                    if(status != Constants.APPROVED) return callback(null);

                    asyncEach(result,(records, parentCallback)=>{
                        let tempMenuId	    = records._id || "";
                        let restaurantSlug 	= records.restaurant_slug || "";

                        /** Copy data  tmp_restaurant_menus to  restaurant_menus collections*/
                        copyFromParentTable(req,res,next,{
                            type : 	"update_restaurant_menus",
                            parent_table : {
                                name 			:	Tables.TMP_RESTAURANT_MENUS,
                                fields 			: 	{_id:0, status:0,restaurant_slug:0,user_id:0,rejection_reason:0},
                                conditions 		: 	{restaurant_slug: restaurantSlug, _id: new ObjectId(tempMenuId)},
                                remove_original : 	true
                            },
                            child_table : {
                                name 		: 	Tables.RESTAURANT_MENUS,
                                conditions	:	{restaurant_slug: restaurantSlug, _id: new ObjectId(tempMenuId)},
                            }
                        }).then(response=>{
                            if(response.status != Constants.STATUS_SUCCESS) return  parentCallback(response);
                            parentCallback(null);
                        }).catch(next);
                    },(parentErr)=>{
                        callback(parentErr);
                    });
                },
                update_approved_menu:(callback)=>{
                    if(status != Constants.IN_REVIEW) return callback(null);

                    /** Set update data */
                    let updateData ={
                        $set :{
                            status : parseInt(status),
                        }
                    };

                    /** Update restaurant menu details */
                    const restaurant_menus	= this.db.collection(Tables.RESTAURANT_MENUS);
                    restaurant_menus.updateMany({_id : {$in : menuIds} },updateData).then(()=>{
                        callback(null);
                    }).catch(next);
                },
            },(asyncErr)=>{
                if(asyncErr) return next(asyncErr);

                /** Send success response **/
                res.send({
                    status	: Constants.STATUS_SUCCESS,
                    message	: res.__("menu_manager.menu_status_has_been_updated_successfully")
                });

                /*************** Send Mail  ***************/
                    if(status != Constants.IN_REVIEW){
                        result.map(records=>{
                            sendMailToUsers(req,res,{
                                event_type 		: (status == Constants.REJECTED) ? Constants.RESTAURANT_MENU_REJECT_EMAIL_EVENTS :Constants.RESTAURANT_MENU_APPROVE_EMAIL_EVENTS,
                                menu_id			: records._id || "",
                                menu_name		: records?.name?.[Constants.DEFAULT_LANGUAGE_CODE] || "",
                                restaurant_slug	: records.restaurant_slug || "",
                                restaurant_id	: records.restaurant_id || "",
                                user_id			: records.user_id || "",
                                reject_msg		: req.body.rejection_reason || ""
                            });
                        });
                    }
                /*************** Send Mail  ***************/

                /** Save user activities **/
                saveUserActivity(req,res,{
                    user_id 		:	req?.session?.user?._id || "",
                    parent_id 		: 	menuIds,
                    parent_type 	:	Tables.RESTAURANT_MENUS,
                    activity_type	:	Constants.ACTIVITY_UPDATE_STATUS,
                    additional_details:	{status: status,channel_id	: req?.session?.user?.channel_id || ""},
                }).then(()=>{});
            });
        } catch (error) {
        next(error);
        }
    }

    /**
	 * Function for assign branch
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
        */
    async assignBranch(req, res, next) {
        try {
            let menuId	= new ObjectId(req.params.id) ;
            let slug	= req.params.slug;

            /** Get restaurant id **/
            let restaurantId = await getRestaurantId(req,res,next,{slug:slug});

            const restaurant_menu_branches = this.db.collection(Tables.RESTAURANT_MENU_BRANCHES);
            if (isPost(req)){
                /** Sanitize Data **/
                req.body    =   sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
                let branch  =  req?.body?.branch || [];

                /** If branch is not array */
                if(branch.constructor != Array) branch = [branch];

                /** Convert into object id */
                branch = arrayToObject(branch);

                asyncParallel({
                    item_list: (callback)=>{
                        /** Set item conditions */
                        let itemConditions = {
                            restaurant_id : restaurantId,
                            $or: [
                                {"menu_ids.0": {$exists: false}},
                                {"menu_ids": {$in: [menuId]}}
                            ]
                        };

                        /** Get item list mapped with current menu  **/
                        const items	= this.db.collection(Tables.ITEMS);
                        items.find(itemConditions,{projection: {_id: 1, menu_ids: 1, category_ids: 1, restaurant_id: 1, name: 1,price_on_selection: 1}}).toArray().then(itemResult=>{
                            callback(null, itemResult);
                        }).catch(next);
                    },
                    delete_other_mapped_branches: (callback)=>{
                        /** Delete mapped other branches   */
                        restaurant_menu_branches.deleteMany({
                            menu_id 	  	: menuId,
                            branch_id	 	: {$nin: branch },
                            restaurant_id 	: restaurantId,
                        }).then(()=>{
                            callback(null);
                        }).catch(next);
                    },
                },(asyncErr, asyncResponse)=>{
                    if(asyncErr) return next(asyncErr);

                    let mappedItemList = asyncResponse.item_list;
                    asyncParallel({
                        assign_branch : (subCallback)=>{
                            /**  For save restaurant_menu_branches collection */
                            asyncEach(branch, (branchId, eachCallback)=> {
                                restaurant_menu_branches.updateOne({
                                    menu_id 	  : menuId,
                                    restaurant_id : restaurantId,
                                    branch_id 	  : new ObjectId(branchId),
                                },
                                {
                                    $set : {
                                        modified : getUtcDate()
                                    },
                                    $setOnInsert: {
                                        created 	: getUtcDate(),
                                        channel_id	: req?.session?.user?.channel_id || ""
                                    }
                                },{upsert: true}).then(()=>{
                                    eachCallback(null);
                                }).catch(next);
                            },(err)=> {
                                subCallback(err);
                            });
                        },
                        item_mapped_with_branchs : (subCallback)=>{
                            if(mappedItemList.length == 0) return subCallback(null);

                            /**  For mapped branch to item  */
                            const item_linkings	= this.db.collection(Tables.ITEM_LINKINGS);
                            asyncEach(mappedItemList, (records, eachCallback)=> {
                                let tmpItemId = records._id;

                                /** Check item already assign or not */
                                item_linkings.findOne({item_id:tmpItemId},{projection:{type:1}}).then(linkResult=>{
                                    let linkType =	(linkResult) ? linkResult.type 	:Constants.ITEM_LISTED_TO_SELECTED_BRANCH_LIST;

                                    if(linkType == Constants.ITEM_LISTED_TO_SELECTED_BRANCH_LIST) return eachCallback(null);

                                    asyncParallel({
                                        branch_unlink_with_item : (childCallback)=>{
                                            if(linkType != Constants.ITEM_NOT_LISTED_TO_SELECTED_BRANCH_LIST){
                                                return childCallback(null)
                                            }

                                            /** Pull branch if not listed item */
                                            item_linkings.updateMany({
                                                item_id	: tmpItemId,
                                            },
                                            {
                                                $set:{
                                                    modified  : getUtcDate(),
                                                },
                                                $pull:{
                                                    branch_ids: {$in: branch}
                                                },
                                            }).then(()=>{
                                                childCallback(null);
                                            }).catch(next);
                                        },
                                        branch_link_with_item : (childCallback)=>{
                                            if(linkType == Constants.ITEM_NOT_LISTED_TO_SELECTED_BRANCH_LIST){
                                                return childCallback(null)
                                            }

                                            /** Item mapped with branch */
                                            item_linkings.updateMany({
                                                item_id	: tmpItemId,
                                            },
                                            {
                                                $addToSet:{
                                                    branch_ids: {$each: branch}
                                                },
                                                $set : {
                                                    menu_ids			: records.menu_ids,
                                                    category_ids		: records.category_ids,
                                                    type				: Constants.ITEM_LISTED_TO_SELECTED_BRANCH_LIST,
                                                    restaurant_id		: records.restaurant_id,
                                                    modified  			: getUtcDate(),
                                                    customize_attributes: {
                                                        name 				: records.name,
                                                        price_on_selection	: records.price_on_selection
                                                    },
                                                },
                                                $setOnInsert : {
                                                    created	 : getUtcDate()
                                                }
                                            }).then(()=>{
                                                childCallback(null);
                                            }).catch(next);
                                        },
                                    },(asyncChildErr)=>{
                                        eachCallback(asyncChildErr);
                                    });
                                });
                            },(err)=> {
                                subCallback(err);
                            });
                        },
                    },(asyncSubErr)=>{
                        if(asyncSubErr) return next(asyncSubErr);

                        /**Send success response */
                        res.send({
                            status      : Constants.STATUS_SUCCESS,
                            message     : res.__("menu_manager.assign_branch_successfully"),
                            redirect_url: res.locals.list_url,
                        });
                    });
                });
            }else{
                /** Get menu details */
                let menuRes = await this.getMenuDetails(req,res,next);

                /** Send error response */
                if(menuRes.status != Constants.STATUS_SUCCESS) return res.status(400).send(menuRes);

                /** Maped branch list */
                let branchList = await restaurant_menu_branches.find({
                    restaurant_id : restaurantId,
                    menu_id 	  : menuId
                },{projection:{_id:1,branch_id:1}}).toArray();

                /**For get selected branch */
                let selectedBranch = [];
                if (branchList.length > 0) {
                    branchList.forEach(records=> {
                        selectedBranch.push(records.branch_id);
                    });
                }

                /** get dropdown list for branches **/
                let dropDrownResponse = await getDropdownList(req,res,next, {
                    collections : [{
                        collection		: Tables.RESTAURANT_BRANCHES,
                        columns			: ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
                        selected		: selectedBranch,
                        conditions		: {restaurant_id : restaurantId}
                    }]
                });

                /** Send error response */
                if(dropDrownResponse.status != Constants.STATUS_SUCCESS) return res.status(400).send(dropDrownResponse);

                /** For render assign branch page **/
                res.render('assign_branch',{
                    layout	 	 : false,
                    result	 	 : dropDrownResponse?.final_html_data?.[0] || "",
                    menu_id  	 : menuId,
                    menu_details : menuRes?.result || {}
                });
            }
        } catch (error) {
            next(error);
        }
    }
}
export default Menu;