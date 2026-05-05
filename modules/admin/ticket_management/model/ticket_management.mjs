import { ObjectId } from 'mongodb';
import {parallel as asyncParallel} from "async";

import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { isPost, sanitizeData, getUtcDate, configDatatable, getUniqueId, arrayToObject, newDate, getTicketCategoryIdsBasedOnRole, getDropdownList, saveTicketsLogs, exportToExcel } from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { insertNotifications } from "../../../../services/index.mjs";

class TicketManagement {
    constructor(db) {
        this.db = db;
        this.ticketsCollection = db.collection(Tables.TICKETS);
        this.usersCollection = db.collection(Tables.USERS);
        this.adminRolesCollection = db.collection(Tables.ADMIN_ROLES);
        this.ticketCategoriesCollection = db.collection(Tables.CATEGORIES);
        this.ticketSubCategoriesCollection = db.collection(Tables.TICKET_SUB_CATEGORIES);
        this.ticketCommentsCollection = db.collection(Tables.TICKET_COMMENTS);
        this.ticketReviewsCollection = db.collection(Tables.TICKET_REVIEWS);
        this.ordersCollection = db.collection(Tables.ORDERS);
        this.ticketThreadsCollection = db.collection(Tables.TICKET_THREADS);
        this.ticketLogsCollection = db.collection(Tables.TICKET_LOGS);
        
        /** Use in export data **/
        this.exportNumber = 0;
        this.exportFilterConditions = {};
        this.exportSortConditions = {};
        this.exportCommonConditions = {};
        this.exportSortConditions[this.exportNumber] = { last_activity_date_time: Constants.SORT_DESC };
    }

    /**
     * Function to get ticket list
     *
     * @param req As Request Data
     * @param res As Response Data
     * @param next As Callback argument to the middleware function
     *
     * @return render/json
     */
    async ticketList(req, res, next) {
        try {
            let ticketType      =   req?.params?.ticket_type || "";
            let authUserId      =   new ObjectId(req.session.user._id);
            let authUserRoleId  =   req.session.user.user_role_id;
            let ticketStatus    =   req?.query?.status || "";

            // Get category list if user has permission
            let categoryList = null;
            if (Constants.TICKET_CATEGORY_ALLOWED_ROLES.indexOf(authUserRoleId) !== -1) {
                categoryList = await getTicketCategoryIdsBasedOnRole(req, res, next);
            }

            if (isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                let fromDate = (req.body.fromDate) ? req.body.fromDate : "";
                let toDate = (req.body.toDate) ? req.body.toDate : "";
                let status = (req.body.status) ? req.body.status : "";
                let toDepartment = (req.body.toDepartment) ? req.body.toDepartment : '';
                let toUser = (req.body.toUser) ? req.body.toUser : '';
                let byDepartment = (req.body.byDepartment) ? req.body.byDepartment : '';
                let byUser = (req.body.byUser) ? req.body.byUser : '';
                let categoryId = (req.body.categoryId) ? req.body.categoryId : '';
                let subCategoryId = (req.body.subCategoryId) ? req.body.subCategoryId : '';
                let title = (req.body.title) ? req.body.title : '';
                let exportCount = (req.body.export_count) ? req.body.export_count : 0;

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);
                let commonConditions = {};

                if (toDepartment) {
                    if (toDepartment.constructor !== Array) toDepartment = [toDepartment];
                    dataTableConfig.conditions['assigned_to_role_id'] = { $in: toDepartment };
                }
                if (toUser) {
                    if (toUser.constructor !== Array) toUser = [toUser];
                    dataTableConfig.conditions['check_in_by'] = { $in: arrayToObject(toUser) };
                }
                if (byDepartment) {
                    if (byDepartment.constructor !== Array) byDepartment = [byDepartment];
                    dataTableConfig.conditions['created_by_role_id'] = { $in: byDepartment };
                }
                if (byUser) {
                    if (byUser.constructor !== Array) byUser = [byUser];
                    dataTableConfig.conditions['created_by'] = { $in: arrayToObject(byUser) };
                }
                if (categoryId) {
                    if (categoryId.constructor !== Array) categoryId = [categoryId];
                    dataTableConfig.conditions['category'] = { $in: arrayToObject(categoryId) };
                }
                if (subCategoryId && subCategoryId != "") {
                    if (subCategoryId.constructor !== Array) subCategoryId = [subCategoryId];
                    dataTableConfig.conditions['sub_category'] = { $in: arrayToObject(subCategoryId) };
                }
                if (title && title != "") {
                    if (title.constructor !== Array) title = [title];
                    dataTableConfig.conditions['title'] = { $in: arrayToObject(title) };
                }

                /** Add my tickets conditions */
                if (ticketType == "my_tickets") {
                    commonConditions = {
                        created_by: authUserId,
                        created_by_role_id: authUserRoleId,
                    };
                }

                /** Add close tickets conditions */
                if (ticketType == "close_tickets") {
                    commonConditions = {
                        $and: [{ status: Constants.TICKET_CLOSE }],
                    };
                }

                /** Add incoming tickets conditions */
                if (ticketType == "incoming_tickets") {
                    commonConditions = {
                        $and: [
                            { assigned_to_role_id: authUserRoleId },
                            {
                                $or: [
                                    { status: Constants.PENDING },
                                    { status: Constants.TICKET_OPEN },
                                ]
                            }
                        ],
                    };
                }

                /** Add reopen tickets conditions */
                if (ticketType == "reopen_tickets") {
                    commonConditions = {
                        $and: [
                            { assigned_to_role_id: authUserRoleId },
                            { status: Constants.TICKET_REOPENED }
                        ],
                    };
                }

                /** Add qa comment tickets conditions */
                if (ticketType == "qa_comment_tickets") {
                    commonConditions = {
                        $and: [
                            { qa_user_id: { $ne: null } },
                        ],
                    };
                }

                if (categoryList) {
                    if (!commonConditions["$and"]) commonConditions["$and"] = [];
                    commonConditions["$and"].push({
                        category: { $in: categoryList }
                    });
                }

                /** Conditions for created */
                if (fromDate != "" && toDate != "") {
                    dataTableConfig.conditions["created"] = {
                        $gte: newDate(fromDate),
                        $lte: newDate(toDate),
                    }
                }

                /** Conditions for status */
                if (status) {
                    if (status.constructor !== Array) status = [status];
                    status = status.map(key => { return (key) ? parseInt(key) : key });

                    dataTableConfig.conditions["status"] = { $in: status };
                }

                dataTableConfig.conditions = Object.assign(commonConditions, dataTableConfig.conditions);

                /** Set conditions for export  report **/
                this.exportCommonConditions = commonConditions;
                this.exportFilterConditions[exportCount] = dataTableConfig.conditions;
                this.exportSortConditions[exportCount] = dataTableConfig.sort_conditions;

                let dbRes = await this.ticketsCollection.aggregate([
                    { $match: dataTableConfig.conditions },
                    {
                        $facet : {
                            list : [
                                {$sort: dataTableConfig.sort_conditions },
                                {$skip: skip },
                                {$limit: limit },
                                {$lookup: {
									from 		: Tables.USERS,
									localField 	: "created_by",
									foreignField: "_id",
									as 			: "from_details"
								}},
								{$lookup : {
									from 		: Tables.ADMIN_ROLES,
									localField 	: "assigned_to_role_id",
									foreignField: "role_id",
									as 			: "role_details"
								}},
								{$project : {
									_id:1, created_by_name:1, ticket_id:1, category_details:1,category:1, sub_category:1, title:1, description:1,created:1,order_id:1,status:1,
									check_in: 1, assigned_to_role_id: 1, "client_details.mobile_number": 1, department_name : {$arrayElemAt : ["$role_details.role_name",0]},last_activity_date_time:1,created_by_role_id:1,created_by:1,assigned_to:1, created_by_name : {$arrayElemAt : ["$from_details.full_name",0]}
								}}
                            ],
                            count: [
                                {$count: "count"},
                            ],
                        }
                    }
                ]).toArray();

                let catObj = {};
                let result = dbRes?.[0]?.list || [];
                if(result?.length){
                    /** Push category ids in array */
                    let tmpCatIds = [];
                    result.map(record=>{
                        tmpCatIds.push(record.category);
                        tmpCatIds.push(record.sub_category);
                        tmpCatIds.push(record.title);
                    });

                    /** Get category list */
                    const cateList = await this.ticketCategoriesCollection.find(
                        { _id: { $in: arrayToObject(tmpCatIds) } },
                        { projection: { _id: 1, category_name: 1 } }
                    ).toArray();

                    if(cateList?.length){
                        cateList.map(catData=>{
                            catObj[catData._id] = catData?.category_name;
                        });
                    }
                }

                /** Send response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data			:   result,
                    recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
                    categories		:   catObj,
                }); 
            } else {
                this.exportNumber++;

                /** Set category conditions */
				let categoryConditions  = {parent_category_id: 0};
				if(categoryList) categoryConditions._id = {$in: categoryList};				

				/**Get dropdown list **/
				const dropDownResponse = await getDropdownList(req,res, next,{
					collections :[{
						collection : Tables.CATEGORIES,
						columns    : ["_id","category_name"],
						conditions : categoryConditions,
					},{
						collection : Tables.ADMIN_ROLES,
						columns    : ["_id","role_name"],
						conditions : {user_type : Constants.USER_TYPE_ADMIN, is_shown: Constants.SHOWN},
					}]
				});

                /** Send error response **/
                if(dropDownResponse.status != Constants.STATUS_SUCCESS){
                    req.flash(Constants.STATUS_ERROR,dropDownResponse.message);
                    return res.redirect(Constants.WEBSITE_ADMIN_URL+"dashboard");
                }

                /** render listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/ticket_management/list']);
                res.render('list', {
                    dynamic_variable: 	res.__("admin.tickets."+ticketType),
                    ticket_type 	: 	ticketType,
                    category_list 	:	dropDownResponse?.final_html_data?.[0] || "",
                    department_list	: 	dropDownResponse?.final_html_data?.[1] || "",
                    ticket_status   :   ticketStatus,
                    export_count 	:   this.exportNumber
                });
            }
        } catch (error) {
            next(error);
        }
    }

    // Additional methods will be added here...
    // For now, I'll create placeholder methods for the exported functions

    async addTicket(req, res, next) {
        try {
            let ticketId		=	(req.params.id) ? new ObjectId(req.params.id) : new ObjectId();
            let isEditable		= 	(req.params.id) ? true :false;
            let authUserId 		=	new ObjectId(req.session.user._id);
            let authUserRoleId 	=	req.session.user.user_role_id;
            let mainOrderId		=	(req.params.order_id) ? new ObjectId(req.params.order_id) :"";
            let mainCustomerId	=	(req.params.user_id)  ? new ObjectId(req.params.user_id)  :"";
            let requestType    	=   (req.query.type) ? req.query.type :"";

            if(isPost(req)){
                /** Sanitize Data **/
                req.body        =   sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let ticketNo	=	req?.body?.ticket_no || "";
                let orderId 	=	req?.body?.order_id || "";
                let department  =   req?.body?.department || "";
                let ticketDetails= null;

                if(isEditable){
                    /** Get old ticket details */
                    ticketDetails = await this.ticketsCollection.findOne(
                        {_id: ticketId}, 
                        {projection: {_id:1,assigned_to_role_id:1}
                    });

                    if(!ticketDetails){
                        return res.send({status: Constants.STATUS_ERROR, message: res.__("admin.system.something_going_wrong_please_try_again")});
                    }
                }

                let orderMainId = "";
                if(orderId){
                    let orderDetails = await this.ordersCollection.findOne(
                        {unique_order_id: orderId}, 
                        {projection: {_id:1}
                    });

                    if(!orderDetails){
                        return res.send({status: Constants.STATUS_ERROR, message: res.__("admin.system.something_going_wrong_please_try_again")});
                    }

                    orderMainId = orderDetails._id;
                }

                /** Set updateable data */
                let updateAbleData = {
                    category  				:	new ObjectId(req.body.category_id),
                    sub_category	  		:	new ObjectId(req.body.sub_category_id),
                    title	  				:	new ObjectId(req.body.title),
                    description	  			:	req.body.description,
                    ticket_type	   			:	(orderId) ? Constants.EXTERNAL_TICKET :Constants.INTERNAL_TICKET,
                    order_id	   			:	orderId,
                    assigned_to_role_id	   	:	department,
                };

                /** if edit and assign to other department */
                if(isEditable && ticketDetails.assigned_to_role_id != department){
                    updateAbleData.check_in_by	= "";
                    updateAbleData.check_in 	= false;
                }

                if(orderId){
                    updateAbleData.main_order_id 	=	orderMainId;
                    updateAbleData.client_details	= 	{
                        email			:	req.body.client_email,
                        name	  		: 	req.body.client_name,
                        mobile_number   : 	req.body.client_mobile_number,
                    };
                }

                let dataToInsert = {
                    assigned_to			:	"",
                    status				: 	Constants.PENDING,
                    created_by			:	authUserId,
                    created_by_role_id	:  	authUserRoleId,
                    ticket_id			:	ticketNo,
                    is_not_seen			:	true,
                    created 			: 	getUtcDate(),
                    last_activity_type	: 	Constants.TICKET_ASSIGNED,
                    last_activity_date_time: getUtcDate(),
                };

                if(!isEditable){
                    dataToInsert.check_in_by	= "";
                    dataToInsert.check_in 		= false;
                }

                /** Save / update ticket details */
                await this.ticketsCollection.updateOne({
                    _id: ticketId
                },{
                    $set: updateAbleData,
                    $setOnInsert: dataToInsert
                },{upsert: true});               

                /** Send success response **/
                let message = (isEditable) ? res.__("admin.tickets.ticket_has_been_updated_successfully") :res.__("admin.tickets.ticket_has_been_added_successfully");
                if(!isEditable) req.flash(Constants.STATUS_SUCCESS,message);
                res.send({
                    status		: Constants.STATUS_SUCCESS,
                    message		: message,
                    redirect_url: (requestType=='captain_tracking') ? Constants.WEBSITE_ADMIN_URL+'captain_tracking' : ''
                });

                /** Save ticket logs **/
                saveTicketsLogs(req, res,{
                    order_id 			: 	orderId,
                    ticket_number		: 	ticketNo,
                    log_type			: 	(isEditable) ? Constants.TICKET_UPDATE_LOG : Constants.TICKET_ASSIGNED_LOG,
                    ticket_id 			: 	ticketId,
                    description 		: 	req.body.description,
                    user_id 			: 	authUserId,
                    user_role_id 		: 	authUserRoleId,
                    user_name 			: 	req.session.user.full_name,
                    additional_details	: 	{
                        update_by 			:	authUserId,
                        activity_type 		:	(isEditable) ? Constants.TICKET_UPDATE :Constants.TICKET_ASSIGNED,
                        assigned_to_role_id	:	department
                    },
                });

                /** Update order details */
                if(orderMainId){
                    this.ordersCollection.updateOne({_id: orderMainId },{$set: {ticketing: true}}).then(()=>{ });
                }

                if(!isEditable){
                    /** Notification for ticket assigned */
                        insertNotifications(req,res,{
                            notification_data : {
                                notification_type:	Constants.NOTIFICATION_TICKET_ASSIGNED,
                                message_params 	:	[ticketNo],
                                parent_table_id : 	ticketId,
                                user_id 		: 	authUserId,
                                user_role_id 	: 	authUserRoleId,
                                role_id 		: 	[department],
                                only_for_user_role:	true,
                                extra_parameters: 	{ticket_id: ticketId}
                            }
                        }).then(()=>{});
                    /** Notification for ticket assigned */
                }                                
            }else{
                let ticketDetails = {};

                /** Get ticket details */
                if(isEditable){
                    ticketDetails = await this.ticketsCollection.findOne(
                        {_id: ticketId,status: {$ne : Constants.TICKET_CLOSE}},
                    );

                    /** Send error response **/
                    if(!ticketDetails){
                        return res.status(400).send({ status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") });
                    }
                }

                /** Get order details */
                let orderDetails = {};
                if(mainOrderId){
                    orderDetails = await this.ordersCollection.findOne(
                        {_id: mainOrderId}, 
                        {projection: {_id:1,unique_order_id:1,customer_id:1}
                    });

                    if(!orderDetails){
                        return res.status(400).send({ status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") });
                    }
                }

                /** Get category list */
                let categoryList = null;
                if(Constants.TICKET_CATEGORY_ALLOWED_ROLES.indexOf(authUserRoleId) !== -1){
                    categoryList = await getTicketCategoryIdsBasedOnRole(req, res, next);
                }

                /** Generate unique ticket no */
                let ticketNo = "";
                if(!isEditable){
                    let ticketNoRes = await getUniqueId(req,res,next,{type:"ticket_no"});
                    ticketNo = ticketNoRes?.result || "";
                }
                
                let category 	  =	ticketDetails.category || "";
                let subCategory   =	ticketDetails.sub_category || "";
                let title 		  =	ticketDetails.title || "";
                let department 	  = ticketDetails.assigned_to_role_id || "";
                let uniqueOrderId =	orderDetails.unique_order_id || "";
                let customerId    =	orderDetails.customer_id || "";

                /** Get client details */
                let clientDetails = {};
                if(customerId || mainCustomerId){
                    clientDetails = await this.usersCollection.findOne({_id: customerId || mainCustomerId}, {projection: {_id:1,full_name:1,email:1,mobile_number:1,phone_country_code:1}});
                }               

                /** Set category conditions */
                let categoryConditions  = {parent_category_id: 0};
                if(categoryList) categoryConditions._id = {$in : categoryList};

                /** Set dropdown options for category list **/
                let options = {
                    collections :[{
                        collection 	:	Tables.CATEGORIES,
                        selected 	: 	[category],
                        columns    	: 	["_id","category_name"],
                        conditions 	: 	categoryConditions,
                    },{
                        collection : Tables.ADMIN_ROLES,
                        selected : [department],
                        columns    : ["_id","role_name"],
                        conditions : {user_type : Constants.USER_TYPE_ADMIN, is_shown: Constants.SHOWN},
                    }]
                };

                if(isEditable){
                    /** Get subcategory or title list */
                    options.collections.push({
                        collection 	: 	Tables.CATEGORIES,
                        columns    	: 	["_id","category_name"],
                        selected 	: 	[subCategory],
                        conditions	:	{
                            parent_category_id: new ObjectId(category)
                        },
                    },{
                        collection 	: 	Tables.CATEGORIES,
                        columns    	: 	["_id","category_name"],
                        selected 	: 	[title],
                        conditions	:	{
                            parent_category_id: new ObjectId(subCategory)
                        },
                    });
                }

                /** Get dropdown list */
                let dropDownResponse = await getDropdownList(req,res, next,options);

                /** Send error response **/
                if(dropDownResponse.status != Constants.STATUS_SUCCESS){
                    req.flash(Constants.STATUS_ERROR,dropDownResponse.message);
                    return res.redirect(Constants.WEBSITE_ADMIN_URL+"tickets/my_tickets");
                }

                 /** render ticket add page **/
                 res.render('add',{
                    layout			:	false,
                    is_editable		:	isEditable,
                    result			: 	ticketDetails,
                    category_list 	:	dropDownResponse?.final_html_data?.[0] || "",
                    department_list	: 	dropDownResponse?.final_html_data?.[1] || "",
                    subcategory_list: 	dropDownResponse?.final_html_data?.[2] || "",
                    title_list		: 	dropDownResponse?.final_html_data?.[3] || "",
                    unique_order_id :   uniqueOrderId,
                    client_details  :   clientDetails,
                    ticket_no		:   ticketNo,
                    request_type 	:	requestType
                });                              
            }
        } catch (error) {
            next(error);
        }
    }

    async getCategoryList(req, res, next) {
        try {
            let categoryId = req.body.category_id || "";
            
            /** Send error response */
            if(!categoryId) return res.send({status : Constants.STATUS_ERROR, message :res.__("admin.system.something_going_wrong_please_try_again")});

            if(categoryId.constructor !== Array) categoryId = [categoryId];
            
            /**Get dropdown list **/
            let dropRes = await getDropdownList(req,res, next,{
                collections :[{
                    collection : Tables.CATEGORIES,
                    columns    : ["_id","category_name"],
                    conditions : {
                        parent_category_id: {$in : arrayToObject(categoryId)}
                    },
                }]
            });

            if(dropRes.status != Constants.STATUS_SUCCESS) return res.send({status: Constants.STATUS_ERROR, message: dropRes.message });

            /** Send success response */
            res.send({
                status: Constants.STATUS_SUCCESS,
                result: dropRes?.final_html_data?.[0] || ""
            });
        } catch (error) {
            next(error);
        }
    }

    async ticketCheckIn(req, res, next) {
        // Implementation will be added
        try {
            let ticketId		= 	new ObjectId(req?.params?.id);
            let authUserId 		=	new ObjectId(req.session.user._id);
            let authUserRoleId 	=	req.session.user.user_role_id;

            /** Get ticket details */
            const result = await this.ticketsCollection.findOne({
                _id 	 :	ticketId,
                check_in :	false,
                assigned_to_role_id: authUserRoleId,
            },{projection: { _id:1, order_id:1, ticket_id:1}});

            /** Send error response */
            if(!result){
                req.flash(Constants.STATUS_SUCCESS,res.__("admin.system.invalid_access"));
                return res.redirect(Constants.WEBSITE_ADMIN_URL+"tickets/view/"+ticketId);
            }

            /** Update tickets details  */
            await this.ticketsCollection.updateOne({
                _id: ticketId
            },
            {$set : {
                check_in	:	true,
                status		:	Constants.TICKET_OPEN,
                check_in_by	:	authUserId,
            }});

            /** Send success response */
            req.flash(Constants.STATUS_SUCCESS,res.__("admin.tickets.ticket_has_been_checkin_successfully"));
            res.redirect(Constants.WEBSITE_ADMIN_URL+"tickets/view/"+ticketId);

            /** Save ticket logs **/
            saveTicketsLogs(req, res,{
                order_id 			: 	result?.order_id || "",
                ticket_number		: 	result?.ticket_id || "",
                log_type			: 	Constants.TICKET_CHECKIN_LOG,
                ticket_id 			: 	new ObjectId(ticketId),
                description 		: 	"",
                user_id 			: 	authUserId,
                user_role_id 		: 	authUserRoleId,
                user_name 			: 	req.session.user.full_name,
                additional_details	: 	{
                    check_in_by 	:	authUserId,
                    activity_type 	:	Constants.TICKET_CHECKIN
                }
            });
        } catch (error) {
            next(error);
        }
    }

    async addComment(req, res, next) {
        try {
            /** Sanitize Data **/
            req.body = sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);

            let userId 		=   new ObjectId(req.session.user._id);
            let redirect 	=   req.query.redirect || "";
            let userRoleId	=   req.session.user.user_role_id;
            let ticketId 	= 	new ObjectId(req.body.ticket_id);
            let comment 	=	req.body.comment;

            /** Get ticket details */
            const result = await this.ticketsCollection.findOne({
                _id : ticketId
            },{projection: { _id:1, order_id: 1,ticket_id: 1,seen_by:1,created_by:1}});

            /** Send error response */
            if(!result) return res.send({status: Constants.STATUS_ERROR,message: [{param: Constants.ADMIN_GLOBAL_ERROR,msg:res.__("admin.system.invalid_access")}]});

            asyncParallel({
                ticket_details : (callback)=>{
                    let ticketUpdateData = {last_activity_date_time : getUtcDate(), comment: comment};

                    if(userRoleId == Constants.FLEET && !result.seen_by && result.created_by && String(result.created_by) != String(userId)){
                        ticketUpdateData.is_not_seen	=	false;
                        ticketUpdateData.seen_by 		= 	new ObjectId(userId);
                        ticketUpdateData.seen_time 		=	getUtcDate();
                    }

                    /** Save last activity date time details **/
                    this.ticketsCollection.updateOne({_id : ticketId},{$set : ticketUpdateData }).then(()=>{
                        callback(null,null);
                    }).catch(next);
                },
                ticket_threads : (callback)=>{
                    /** Save ticket details **/
                    this.ticketThreadsCollection.insertOne({
                        ticket_id 		: ticketId,
                        user_id  		: new ObjectId(userId),
                        user_role_id	: userRoleId,
                        order_id		: req.body.order_id,
                        response		: comment,
                        created			: getUtcDate()
                    }).then(()=>{
                        callback(null,null);
                    }).catch(next);
                }
            },(asyncErr)=> {
                if(asyncErr) return next(asyncErr);

                /** Send success response **/
                if(redirect != "captain_tracking") req.flash(Constants.STATUS_SUCCESS,res.__("admin.tickets.comment_has_been_added_successfully"));
                res.send({
                    status	: Constants.STATUS_SUCCESS,
                    message	: res.__("admin.tickets.comment_has_been_added_successfully")
                });

                /** Save ticket logs **/
                saveTicketsLogs(req, res,{
                    order_id 			: 	result.order_id,
                    ticket_number		: 	result.ticket_id,
                    log_type			: 	Constants.TICKET_COMMENT_LOG,
                    ticket_id 			: 	ticketId,
                    description 		: 	"",
                    user_id 			: 	new ObjectId(userId),
                    user_role_id 		: 	userRoleId,
                    user_name 			: 	req.session.user.full_name,
                    additional_details	: 	{
                        comment 		:	comment
                    },
                }).then(()=>{});
            });            
        } catch (error) {
            next(error);
        }
    }

    async reAssignTicket(req, res, next) {
        try {
            let userId 		= new ObjectId(req.session.user._id);
            let userRoleId	= req.session.user.user_role_id;
            let ticketId = new ObjectId(req.body.ticket_id);

            /** Get ticket details */
            const result = await this.ticketsCollection.findOne({
                _id : ticketId
            },{projection: { _id:1,order_id : 1,ticket_id:1}});

            /** Send error response */
            if(!result) return res.send({status: Constants.STATUS_ERROR, message: [{param: Constants.ADMIN_GLOBAL_ERROR,'msg':res.__("admin.system.invalid_access")}]});

            /** Update ticket details */
            await this.ticketsCollection.updateOne({
                _id : ticketId
            },
            {$set : {
                assigned_to_role_id 	: req.body.department,
                last_activity_date_time : getUtcDate(),
                last_activity_type		: Constants.TICKET_RESPONDED,
                check_in_by				: "",
                check_in 				: false
            }});

            /** Send success response **/
            req.flash(Constants.STATUS_SUCCESS,res.__("admin.tickets.reassigned_successfully"));
            res.send({
                status	: Constants.STATUS_SUCCESS,
                message	: res.__("admin.tickets.reassigned_successfully")
            });

            /**Save ticket logs */
            saveTicketsLogs(req, res,{
                order_id 			: 	result?.order_id || "",
                ticket_number 		: 	result?.ticket_id || "",
                log_type			: 	Constants.TICKET_REASSIGNED_LOG,
                ticket_id 			: 	ticketId,
                description 		: 	"",
                user_id 			: 	userId,
                user_role_id 		: 	userRoleId,
                user_name 			: 	req.session.user.full_name,
                additional_details	: 	{
                    assigned_by 		:	userId,
                    activity_type 		:	Constants.TICKET_RESPONDED,
                    assigned_to_role_id	:	req.body.department
                },
            }).then(()=>{});

            /** Notification to selected admin for reassign ticket */
                insertNotifications(req,res,{
                    notification_data : {
                        notification_type:	Constants.NOTIFICATION_TICKET_ASSIGNED,
                        message_params 	:	[result.ticket_id],
                        parent_table_id : 	ticketId,
                        user_id 		: 	userId,
                        user_role_id 	: 	userRoleId,
                        role_id 		: 	[req.body.department],
                        only_for_user_role:	true,
                        extra_parameters: 	{
                            assigned_by :   userId,
                            ticket_id   :   ticketId
                        }
                    }
                }).then(()=>{});
            /** Notification to selected admin for reassign ticket */
        } catch (error) {
            next(error);
        }
    }

    async closeTicket(req, res, next) {
        try {
            let userId 		= new ObjectId(req.session.user._id);
            let userRoleId	= req.session.user.user_role_id;
            let ticketId	= new ObjectId(req.params.ticket_id);

            /** Get ticket details */
            const result = await this.ticketsCollection.findOne({
                _id : ticketId
            },{projection: { _id:1,order_id : 1, ticket_id:1}});

            /** Send error response */
            if(!result) return res.send({status	: Constants.STATUS_ERROR,message: [{param: Constants.ADMIN_GLOBAL_ERROR,'msg':res.__("admin.system.invalid_access")}]});

            /** Update ticket details */
            await this.ticketsCollection.updateOne({
                _id : ticketId
            },
            {$set : {
                last_activity_date_time : getUtcDate(),
                closed_by				: new ObjectId(userId),
                last_activity_type		: Constants.TICKET_CLOSED,
                status 					: Constants.TICKET_CLOSE,
                check_in_by				: "",
                check_in 				: false
            }});

            /** Send success response **/
            req.flash(Constants.STATUS_SUCCESS,res.__("admin.tickets.ticket_closed_successfully"));
            res.redirect(Constants.WEBSITE_ADMIN_URL+"tickets/view/"+ticketId);

            /** Save ticket logs **/
            saveTicketsLogs(req, res,{
                order_id 			: 	result?.order_id || "",
                ticket_number		: 	result?.ticket_id || "",
                log_type			: 	Constants.TICKET_CLOSED_LOG,
                ticket_id 			: 	ticketId,
                description 		: 	"",
                user_id 			: 	new ObjectId(userId),
                user_role_id 		: 	userRoleId,
                user_name 			: 	req.session.user.full_name,
                additional_details	: 	{
                    closed_by 		:	new ObjectId(userId),
                    activity_type 	:	Constants.TICKET_CLOSED,
                },
            }).then(()=>{});
        } catch (error) {
            next(error);
        }
    }

    async viewTicket(req, res, next) {
        try {
            let ticketId	    = new ObjectId(req.params.id);
            let authUserId	    = new ObjectId(req.session.user._id);
            let authUserRoleId  = req.session.user.user_role_id;

            // Get category list if user has permission
            let categoryList = null;
            if (Constants.TICKET_CATEGORY_ALLOWED_ROLES.indexOf(authUserRoleId) !== -1) {
                categoryList = await getTicketCategoryIdsBasedOnRole(req, res, next);
            }

            /** Set conditions */
            let ticketConditions = {_id: ticketId};
            if(categoryList) ticketConditions["$and"] = [{category : {$in : categoryList}}];

            asyncParallel({
                ticket_details : (callback)=>{
                    this.ticketsCollection.aggregate([
                        {$match : ticketConditions},
                        {$lookup : {
                            from 		: Tables.ADMIN_ROLES,
                            localField 	: "assigned_to_role_id",
                            foreignField: "role_id",
                            as 			: "department_details"
                        }},
                        {$lookup : {
                            from 		: Tables.USERS,
                            localField 	: "created_by",
                            foreignField: "_id",
                            as 			: "user_details"
                        }},
                        {$lookup : {
                            from 		: Tables.USERS,
                            localField 	: "qa_user_id",
                            foreignField: "_id",
                            as 			: "qa_user_details"
                        }},
                        {$lookup : {
                            from 		: Tables.ADMIN_ROLES,
                            localField 	: "created_by_role_id",
                            foreignField: "role_id",
                            as 			: "created_by_role_details"
                        }},
                        {$project : {
                            _id:1,ticket_id:1,description:1,created:1,created_by_role_id:1,last_activity_date_time:1,last_activity_type:1,status:1,order_id:1,check_in:1,check_in_by:1, qa_comment: 1, qa_rating: 1,ticket_type:1, assigned_to_role_id:1,client_details:1,category:1,sub_category:1,title:1,main_order_id:1, qa_user_id:1,assigned_to:1,created_by:1,
                            department			: {$arrayElemAt : ["$department_details.role_name",0]},
                            created_by_name		: {$arrayElemAt : ["$user_details.full_name",0]},
                            created_by_department: {$arrayElemAt:["$created_by_role_details.role_name",0]},
                            qa_user_name		 : {$arrayElemAt : ["$qa_user_details.full_name",0]},
                        }}
                    ]).toArray().then(result=>{
                        if(!result || result.length <=0) return callback(null,{result: null});

                        /** Get categories*/
                        let ticketDetails	= result[0];
                        let categoryIds 	= [ticketDetails.category,ticketDetails.sub_category,ticketDetails.title];
                        
                        /** Get categories */
                        this.ticketCategoriesCollection.find(
                            {_id: {$in : arrayToObject(categoryIds)}},
                            {projection : {_id:1,category_name : 1}}
                        ).toArray().then(categoryData=>{
                           
                            let categoryList = {};
                            if(categoryData?.length) categoryData.map(master=>{categoryList[master._id] = master.category_name;});
                            callback(null,{result : ticketDetails,categories : categoryList});
                        }).catch(next);
                    }).catch(next);
                },
                comments : (callback)=>{
                    this.ticketThreadsCollection.aggregate([
                        {$match : {ticket_id : ticketId}},
                        {$lookup : {
                            from 		: Tables.USERS,
                            localField 	: "user_id",
                            foreignField: "_id",
                            as 			: "user_details"
                        }},
                        {$project : {
                            _id:1,response:1,created:1,user_name : {$arrayElemAt : ["$user_details.full_name",0]},
                        }},
                        {$sort: {
                            _id: Constants.SORT_DESC
                        }}
                    ]).toArray().then(result=>{
                        callback(null,result);
                    }).catch(next);
                },
                departments : (callback)=>{
                    /** get dropdown list for given role users **/
                    getDropdownList(req, res, next, {
                        collections: [{
                            collection: Tables.ADMIN_ROLES,
                            columns: ["_id", "role_name"],
                            conditions: {user_type : Constants.USER_TYPE_ADMIN,is_shown: Constants.SHOWN},
                        }]
                    }).then(dropRes => {
                        callback(null,dropRes?.final_html_data?.[0] || "");
                    });
                },
                history : (callback)=>{
                    this.ticketLogsCollection.aggregate([
                        {$match : {ticket_id : ticketId}},
                        {$lookup : {
                            from 		: Tables.USERS,
                            localField 	: "user_id",
                            foreignField: "_id",
                            as 			: "user_details"
                        }},
                        {$project : {
                            _id:1, description:1, created:1, user_name: {$arrayElemAt: ["$user_details.full_name",0]},
                        }},
                        {$sort: {_id: Constants.SORT_DESC}}
                    ]).toArray().then(result=>{
                        callback(null,result);
                    }).catch(next);
                },
            },(asyncErr,response)=>{
                if(asyncErr) return next(asyncErr);

                if(!response.ticket_details.result){
                    /** Send error response */
                    req.flash(Constants.STATUS_ERROR,res.__("admin.system.invalid_access"));
                    return res.redirect(Constants.WEBSITE_ADMIN_URL+"tickets/my_tickets");
                }

                /** Render view page */
                req.breadcrumbs(BREADCRUMBS['admin/ticket_management/view']);            
                res.render("view",{
                    result 		: response.ticket_details.result,
                    comments	: response.comments,
                    history		: response.history,
                    departments	: response.departments,
                    categories	: response.ticket_details.categories
                });
            });
        } catch (error) {
            next(error);
        }
    }

    async reOpenTicket(req, res, next) {
        try {
            /** Sanitize Data **/
            req.body     =  sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
            let ticketId =	new ObjectId(req.body.ticket_id);

            /** Get ticket details */
            const result = await this.ticketsCollection.findOne(
                {_id: ticketId, status: Constants.TICKET_CLOSE}, 
                {projection: {_id:1, order_id : 1,ticket_id:1}}
            );

            if(!result) return res.send({status: Constants.STATUS_ERROR, message: [{param: Constants.ADMIN_GLOBAL_ERROR, msg: res.__("admin.system.invalid_access")}]});

            let authUserId 		= new ObjectId(req.session.user._id);
            let authUserRoleId	= req.session.user.user_role_id;

            /** Update ticket details */
            await this.ticketsCollection.updateOne({
                _id : ticketId
            },
            {$set : {
                status 					: Constants.TICKET_REOPENED,
                assigned_to_role_id 	: req.body.department,
                last_activity_date_time : getUtcDate(),
                last_activity_type		: Constants.TICKET_REOPENED_ACTIVITY,
                check_in_by				: "",
                check_in 				: false
            }});

            /** Send success response **/
            req.flash(Constants.STATUS_SUCCESS,res.__("admin.tickets.reopened_successfully"));
            res.send({
                status	: Constants.STATUS_SUCCESS,
                message	: res.__("admin.tickets.reopened_successfully")
            });

            /** Save ticket logs **/
            saveTicketsLogs(req, res,{
                order_id 			: 	result?.order_id || "",
                ticket_number		: 	result?.ticket_id || "",
                log_type			: 	Constants.TICKET_REOPENED_LOG,
                ticket_id 			: 	ticketId,
                description 		: 	"",
                user_id 			: 	new ObjectId(authUserId),
                user_role_id 		: 	authUserRoleId,
                user_name 			: 	req.session.user.full_name,
                additional_details	: 	{
                    assigned_by 		:	new ObjectId(authUserId),
                    activity_type 		:	Constants.TICKET_REOPENED_ACTIVITY,
                    assigned_to_role_id	:	req.body.department
                },
            }).then(()=>{});

            /** Notification to selected admin for reopen ticket */
                insertNotifications(req,res,{
                    notification_data : {
                        notification_type:	Constants.NOTIFICATION_TICKET_REOPENED_AND_ASSIGNED,
                        message_params 	:	[result.ticket_id],
                        parent_table_id : 	ticketId,
                        user_id 		: 	authUserId,
                        user_role_id 	: 	authUserRoleId,
                        role_id 		: 	[req.body.department],
                        only_for_user_role:	true,
                        extra_parameters: 	{
                            reopened_by : authUserId, ticket_id:ticketId
                        }
                    }
                }).then(()=>{});
            /** Notification to selected admin for reopen ticket */
        } catch (error) {
            next(error);
        }
    }

    async addReview(req, res, next) {
        try {
            /** Sanitize Data **/
            req.body = sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
            let ticketId = new ObjectId(req.body.ticket_id);

            /** Get ticket details */
            const result = await this.ticketsCollection.findOne(
                {_id: ticketId, status: Constants.TICKET_CLOSE}, 
                {projection: {_id:1, order_id : 1,ticket_id:1}}
            );

            /** Send error response */
            if(!result) return res.send({status: Constants.STATUS_ERROR, message: [{param: Constants.ADMIN_GLOBAL_ERROR, msg: res.__("admin.system.invalid_access")}]});    

            let authUserId 		= 	new ObjectId(req.session.user._id);
            let authUserRoleId	=	req.session.user.user_role_id;
            let qaReview 		=	req.body.qa_review;
            let rating 			=	parseFloat(req.body.review_rating);

            /** Update ticket details */
            await this.ticketsCollection.updateOne({
                _id : ticketId
            },
            {$set : {
                qa_comment 	: 	qaReview,
                qa_rating 	: 	rating,
                qa_user_id 	:	authUserId,
                modified 	: 	getUtcDate()
            }});

            /** Send success response **/
            req.flash(Constants.STATUS_SUCCESS,res.__("admin.tickets.review_has_been_added_successfully"));
            res.send({
                status	: Constants.STATUS_SUCCESS,
                message	: res.__("admin.tickets.review_has_been_added_successfully")
            });

            /**Save logs */
            saveTicketsLogs(req, res,{
                order_id 			: 	result?.order_id || "",
                ticket_number		: 	result?.ticket_id || "",
                log_type			: 	Constants.TICKET_REVIEW_LOG,
                ticket_id 			: 	ticketId,
                comment 			: 	qaReview,
                rating 				: 	rating,
                user_id 			: 	authUserId,
                user_role_id 		: 	authUserRoleId,
                user_name 			: 	req.session.user.full_name,
                additional_details	: 	{
                    added_by 		:	authUserId,
                    activity_type 	:	Constants.TICKET_REVIEW_ACTIVITY,
                },
            }).then(()=>{});
        } catch (error) {
            next(error);
        }
    }

    async getCommonTicketList(req, res, next) {
        try {
            let userId	=	(req.params.user_id)  ? req.params.user_id  : '';
            let orderId	=	(req.params.order_id) ? req.params.order_id : '';

            if(isPost(req)){
                let limit			= 	(req.body.length)	? parseInt(req.body.length)	: ADMIN_LISTING_LIMIT;
                let skip			= 	(req.body.start) 	? parseInt(req.body.start)	: DEFAULT_SKIP;
                let fromDate  	  	= 	(req.body.fromDate)	? req.body.fromDate 		:"";
                let toDate 	  	 	=	(req.body.toDate)   ? req.body.toDate 			:"";
                const collection	= 	this.ticketsCollection;

                /** Set order conditions */
                let orderConditions = {};
                if(userId) orderConditions = { customer_id : new ObjectId(userId)};
                if(orderId) orderConditions = { _id : new ObjectId(orderId)};

                /** Get unique order id*/
                const orderUniqueIds = await this.ordersCollection.distinct("unique_order_id",orderConditions);
                                   
                /** Configure Datatable conditions*/
                let dataTableConfig = await configDatatable(req,res,null);

                /** Set conditions */
                let commonConditions = {order_id : { $in : orderUniqueIds} };

                /** Set conditions for created */
                if (fromDate != "" && toDate != "") {
                    dataTableConfig.conditions["created"] = {
                        $gte 	: newDate(fromDate),
                        $lte 	: newDate(toDate),
                    }
                }

                dataTableConfig.conditions = Object.assign(commonConditions, dataTableConfig.conditions);

                let dbRes = await this.ticketsCollection.aggregate([
                    {$match: dataTableConfig.conditions },
                    {$facet : {
                        list : [
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit },
                            {$lookup : {
                                from 		: Tables.ADMIN_ROLES,
                                localField 	: "assigned_to_role_id",
                                foreignField: "role_id",
                                as 			: "role_details"
                            }},
                            {$lookup: {
                                from 		: Tables.USERS,
                                localField 	: "created_by",
                                foreignField: "_id",
                                as 			: "from_details"
                            }},
                            {$project : {
                                _id:1, ticket_id:1, category_details:1,category:1, sub_category:1, title:1, description:1,created:1,order_id:1,status:1, check_in: 1, assigned_to_role_id: 1, "client_details.mobile_number": 1, 
                                department_name : {$arrayElemAt : ["$role_details.role_name",0]},
                                created_by_name : {$arrayElemAt : ["$from_details.full_name",0]}
                            }}
                        ],
                        count: [
                            {$count: "count"},
                        ],
                    }}
                ]).toArray();

                let catObj = {};
                let result = dbRes?.[0]?.list || [];
                if(result?.length){
                    /** Push category ids in array */
                    let tmpCatIds = [];
                    result.map(record=>{
                        tmpCatIds.push(record.category);
                        tmpCatIds.push(record.sub_category);
                        tmpCatIds.push(record.title);
                    });

                    /** Get category list */
                    const cateList = await this.ticketCategoriesCollection.find(
                        { _id: { $in: arrayToObject(tmpCatIds) } },
                        { projection: { _id: 1, category_name: 1 } }
                    ).toArray();

                    if(cateList?.length){
                        cateList.map(catData=>{
                            catObj[catData._id] = catData?.category_name;
                        });
                    }
                }

                /** Send response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data			:   result,
                    recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
                    categories		:   catObj,
                });                 
            }else{
                /**Get dropdown list **/
                const dropDownResponse = await getDropdownList(req,res, next,{
                    collections :[{
                        collection : Tables.ADMIN_ROLES,
                        columns    : ["_id","role_name"],
                        conditions : {user_type : Constants.USER_TYPE_ADMIN, is_shown: Constants.SHOWN},
                    }]
                });

                /** Send error response */
                if(dropDownResponse.status != Constants.STATUS_SUCCESS) return res.status(400).send(dropDownResponse);

                /** Render customer/order ticket list page */
                res.render('common_ticket_list',{
                    layout  		: false,
                    user_id   		: userId,
                    order_id		: orderId,
                    department_list	: dropDownResponse.final_html_data["0"],
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
	 * Function for get user list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
    async getUserList(req, res, next) {
        try {
            let userRoleId = req.body.user_role_id;

            /** Send error response */
            if(!userRoleId) return res.send({status: Constants.STATUS_ERROR, message :res.__("admin.system.something_going_wrong_please_try_again") });
            
            /** Set user role id */
            if(userRoleId.constructor !== Array)  userRoleId = [userRoleId];
            
            /** Get dropdown list **/
            const dropRes = await getDropdownList(req,res, next,{
                collections :[{
                    collection : Tables.USERS,
                    columns    : ["_id","full_name"],
                    conditions : {active : Constants.ACTIVE, is_deleted : Constants.NOT_DELETED , user_role_id : {$in : userRoleId}},
                }]
            });

            /** Send error response */
            if(dropRes.status != Constants.STATUS_SUCCESS) return res.send(dropRes);

            /** Send response */
            res.send({ status: Constants.STATUS_SUCCESS, user_list : dropRes?.final_html_data?.[0] || "" });
        } catch (error) {
            next(error);
        }
    }

    async exportData(req, res, next) {
        try {
            let exportType	= (req.params.export_type) 	? req.params.export_type	:"";
            let exportCount = (req.params.export_count) ? req.params.export_count	:0;

            /** Set conditions **/
            let filterCondition = this.exportFilterConditions?.[exportCount] || {};
            let conditions		= exportType == Constants.EXPORT_FILTERED && filterCondition || this.exportCommonConditions;
            let sortConditions	= this.exportSortConditions?.[exportCount] && this.exportSortConditions[exportCount] || this.exportSortConditions?.[0] || {_id: Constants.SORT_DESC};

            /** Get ticket list **/
            const result = await this.ticketsCollection.aggregate([
                {$match	: conditions},
                {$lookup: {
                    from 		: Tables.USERS,
                    localField 	: "created_by",
                    foreignField: "_id",
                    as 			: "from_details"
                }},
                {$addFields :{
                    created_by_name : {$arrayElemAt : ["$from_details.full_name",0]}
                }},
                {$sort 	: sortConditions},
                {$lookup: {
                    from 		: Tables.ADMIN_ROLES,
                    localField 	: "assigned_to_role_id",
                    foreignField: "role_id",
                    as 			: "role_details"
                }},
                {$project : {
                    _id:1, created_by_name:1, ticket_id:1, category_details:1,category:1, sub_category:1, title:1, description:1,created:1,order_id:1,status:1,
                    check_in: 1, assigned_to_role_id: 1, department_name : {$arrayElemAt : ["$role_details.role_name",0]},last_activity_date_time:1,created_by_role_id:1,created_by:1,assigned_to:1,client_details:1,status:1
                }}
            ],{allowDiskUse: true}).toArray();          
            

            /** Push category ids in array */
            let categoryIds = [];
            if(result?.length) result.map(record=>{
                categoryIds.push(record.category);
                categoryIds.push(record.sub_category);
                categoryIds.push(record.title);
            });

            /** Get categories names*/
            const categoryData = await this.ticketCategoriesCollection.find(
                {_id : {$in : arrayToObject(categoryIds)}},
                {projection : {_id:1,category_name : 1}}
            ).toArray();

            /** Set category list */
            let categoryList = {};
            if(categoryData?.length) categoryData.map(master=>{
                categoryList[master._id] = master.category_name;
            });

            /** Define excel heading label **/
            let commonColls	= 	[
                res.__("admin.tickets.ticket_no"),
                res.__("admin.tickets.order_id"),
                res.__("admin.tickets.category"),
                res.__("admin.tickets.sub_category"),
                res.__("admin.tickets.title"),
                res.__("admin.tickets.description"),
                res.__("admin.tickets.department"),
                res.__("admin.tickets.from"),
                res.__("admin.tickets.last_changed_date"),
                res.__("admin.system.status"),
                res.__("admin.tickets.client_name"),
                res.__("admin.tickets.client_email"),
                res.__("admin.tickets.client_mobile_number"),
            ];

            let temp = [];
            if(result?.length){
                result.map(records=>{
                    let buffer =	[
                        (records.ticket_id)	? records.ticket_id	:"",
                        (records.order_id)	? records.order_id	:"",
                        (records.category && categoryList[records.category]) 		 ? 	categoryList[records.category] 		:"",
                        (records.sub_category && categoryList[records.sub_category]) ? 	categoryList[records.sub_category] 	:"",
                        (records.title && categoryList[records.title]) ? categoryList[records.title] :"",
                        (records.description )     ? records.description 	 :"",
                        (records.department_name)  ? records.department_name :"",
                        (records.created_by_name)  ? records.created_by_name :"",
                        (records.last_activity_date_time) ? newDate(records.last_activity_date_time,Constants.AM_PM_FORMAT_WITH_DATE) :"",
                        (records.status && Constants.TICKET_STATUS[records.status])        ? Constants.TICKET_STATUS[records.status]:"",
                        (records.client_details && records.client_details.name)  ? records.client_details.name  :"",
                        (records.client_details && records.client_details.email) ? records.client_details.email :"",
                        (records.client_details && records.client_details.mobile_number) ? records.client_details.mobile_number :"",
                    ];
                    temp.push(buffer);
                });
            }

            /**  Function to export data in excel format **/
            exportToExcel(req,res,{
                file_prefix 		: "TicketReport",
                heading_columns		: commonColls,
                export_data			: temp
            });
        } catch (error) {
            next(error);
        }
    }
}

export default TicketManagement; 