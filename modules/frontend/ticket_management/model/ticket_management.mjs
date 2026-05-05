
import { ObjectId } from 'mongodb';
import { parallel as asyncParallel } from 'async';
import BREADCRUMBS from "../../../../breadcrumbs.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { getUtcDate, newDate, arrayToObject,isPost, sanitizeData, configDatatable, getUniqueId, getDropdownList,} from "../../../../utils/index.mjs";
import {insertNotifications} from "../../../../services/index.mjs";

export default class TicketManagement {
	constructor(db) {
		this.db = db;
		this.ticketCollection = db.collection(Tables.TICKETS);
	}   

	/**
	* Function to get ticket list
	*
	* @param req 	As Request Data
	* @param res 	As Response Data
	* @param next 	As Callback argument to the middleware function
	*
	* @return render/json
	*/
	async ticketList (req,res,next){
		try{
			let restaurantId =	req?.session?.user?.restaurant_id || '';

			if(isPost(req)){
				let limit		=	(req.body.length) 	? 	parseInt(req.body.length) 	:Constants.ADMIN_LISTING_LIMIT;
				let skip		= 	(req.body.start)  	? 	parseInt(req.body.start)	:Constants.DEFAULT_SKIP;
				let fromDate  	= 	(req.body.fromDate)	? 	req.body.fromDate 			:"";
				let toDate 	  	=	(req.body.toDate)   ?	req.body.toDate 		    :"";

				/** Configure Datatable conditions*/
				const dataTableConfig = await configDatatable(req, res, null);

				let commonConditions = {restaurant_id:	new ObjectId(restaurantId)};

				/** Conditions for created */
				if (fromDate != "" && toDate != "") {
					dataTableConfig.conditions["created"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					}
				}

				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions,commonConditions);

				// Get ticket list or count
				let dbRes = await this.ticketCollection.aggregate([
					{$match : dataTableConfig.conditions},
					{$facet : {
						list : [
							{$sort 	: dataTableConfig.sort_conditions},
							{$skip 	: skip},
							{$limit : limit},
							{$lookup : {
								from 		: Tables.ADMIN_ROLES,
								localField 	: "assigned_to_role_id",
								foreignField: "role_id",
								as 			: "role_details"
							}},
							{$lookup : {
								from 		: Tables.CATEGORIES,
								localField 	: "category",
								foreignField: "_id",
								as 			: "category_details"
							}},
							{$lookup : {
								from 		: Tables.CATEGORIES,
								localField 	: "sub_category",
								foreignField: "_id",
								as 			: "sub_category_details"
							}},
							{$lookup : {
								from 		: Tables.CATEGORIES,
								localField 	: "title",
								foreignField: "_id",
								as 			: "title_details"
							}},
							{$project : {
								_id:1, ticket_id:1,category:1, sub_category:1, title:1, description:1,created:1,status:1,last_activity_date_time:1,last_activity_type:1,assigned_to_role_id: 1, 
								department_name : {$arrayElemAt : ["$role_details.role_name",0]},
								category_name : {$arrayElemAt : ["$category_details.category_name",0]},
								sub_category_name : {$arrayElemAt : ["$sub_category_details.category_name",0]},
								title_name : {$arrayElemAt : ["$title_details.category_name",0]},
							}}                          
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
				/**Get dropdown list **/
				const dropDownResponse = await getDropdownList(req,res, next,{
					collections :[{
						collection : Tables.CATEGORIES,
						columns    : ["_id","category_name"],
						conditions : {
							parent_category_id	: 	0,
							category_type		:	Constants.CATEGORY_TYPE_MERCHANT_PORTAL
						},
					},{
						collection : Tables.ADMIN_ROLES,
						columns    : ["_id","role_name"],
						conditions : {user_type : Constants.USER_TYPE_ADMIN, is_shown: Constants.SHOWN},
					}]
				});			

				/** render ticket listing page **/
				req.breadcrumbs(BREADCRUMBS['tickets/list']);
				res.render('list',{
					category_list 	:	dropDownResponse?.final_html_data?.["0"] || "",
					department_list	: 	dropDownResponse?.final_html_data?.["1"] || "",
				});
			}
		}catch(error){
			return next(error);
		}
	};//End ticketList()

	/**
	* Function for add ticket
	*
	* @param req 	As Request Data
	* @param res 	As Response Data
	* @param next 	As Callback argument to the middleware function
	*
	* @return null
	*/
	async addTicket (req, res, next){
		try{
			let ticketId		=	(req.params.id) ? new ObjectId(req.params.id) :new ObjectId();
			let isEditable		= 	(req.params.id) ? true :false;
			let authUserId 		=	new ObjectId(req.session.user._id);
			let restaurantId	=	new ObjectId(req.session.user.restaurant_id);
			let authUserRoleId 	=	req.session.user.user_role_id;
			
			if(isPost(req)){
				/** Sanitize Data **/
				req.body 	 = 	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
				let ticketNo =	req?.body?.ticket_no || "";		
				
				/** Save ticket details **/
				await this.ticketCollection.updateOne({
					_id : ticketId
				},
				{
					$set 		: {
						category  				:	new ObjectId(req.body.category_id),
						sub_category	  		:	new ObjectId(req.body.sub_category_id),
						title	  				:	new ObjectId(req.body.title),
						status	  				:	parseInt(req.body.status),
						description	  			:	req?.body?.description || "",
						ticket_type	   			:	Constants.INTERNAL_TICKET,
						assigned_to_role_id	   	:	req.body.department,
					},
					$setOnInsert: {
						check_in			:	false,
						assigned_to			:	"",
						check_in_by			:	"",
						created_by			:	authUserId,
						created_by_role_id	:  	authUserRoleId,
						restaurant_id		:	new ObjectId(restaurantId),
						ticket_id			:	ticketNo,
						created 			: 	getUtcDate(),
						last_activity_type		: 	Constants.TICKET_ASSIGNED,
						last_activity_date_time	:  	getUtcDate(),
					}
				},{upsert: true});

				/** Send success response **/
				let message = (isEditable) ? res.__("tickets.ticket_has_been_updated_successfully") :res.__("tickets.ticket_has_been_added_successfully");
				res.send({status: Constants.STATUS_SUCCESS, message});

				/** Save ticket logs **/
				this.saveTicketsLogs(req, res, next,{
					ticket_number		: 	ticketNo,
					log_type			: 	(isEditable) ? Constants.TICKET_UPDATE_LOG : Constants.TICKET_ASSIGNED_LOG,
					ticket_id 			: 	ticketId,
					description 		: 	req.body.description,
					user_id 			: 	authUserId,
					user_role_id 		: 	authUserRoleId,
					additional_details	: 	{
						restaurant_id		:	new ObjectId(restaurantId),
						update_by 			:	authUserId,
						activity_type 		:	(isEditable) ? Constants.TICKET_UPDATE :Constants.TICKET_ASSIGNED,
						assigned_to_role_id	:	req.body.department
					},
				}).then(()=>{ });

				if(!isEditable){
					/** Notification for ticket assigned */
						insertNotifications(req,res,{
							notification_data : {
								notification_type:	Constants.NOTIFICATION_TICKET_ASSIGNED,
								message_params 	:	[ticketNo],
								parent_table_id : 	ticketId,
								user_id 		: 	authUserId,
								user_role_id 	: 	authUserRoleId,
								role_id 		: 	[req.body.department],
								only_for_user_role:	true,
								extra_parameters: 	{
									ticket_id 	 : ticketId,
									restaurant_id: new ObjectId(restaurantId),
								}
							}
						}).then(()=>{});
					/** Notification for ticket assigned */
				}
			}else{
				asyncParallel({
					ticket_details : (callback)=>{
						if(!isEditable)  return callback(null,null);

						/** Get tickets details */
						this.ticketCollection.findOne({ _id: new ObjectId(ticketId)}).then(result=>{
							callback(null, result);
						}).catch(err=>{
							callback(err);
						});
					},
					ticket_no :(callback)=>{
						if(isEditable) return callback(null,null);

						/**Get unique ticket no**/
						getUniqueId(req,res,next,{type:"ticket_no"}).then(uniqueIdResponse=>{
							callback(null,uniqueIdResponse?.result || "");
						}).catch(next);
					},
				},(asyncErr, asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					/** Send error response **/
					if(isEditable && !asyncResponse.ticket_details){
						return res.status(400).send({status: Constants.STATUS_ERROR, message :res.__("system.invalid_access")});
					}

					let ticketNo    = 	asyncResponse?.ticket_no || "";
					let ticketDetails = asyncResponse?.ticket_details || {};
					let category 	=	ticketDetails.category 				|| "";
					let subCategory =	ticketDetails.sub_category 			|| "";
					let title 		=	ticketDetails.title		 			|| "";
					let department 	= 	ticketDetails.assigned_to_role_id 	|| "";

					/** Set dropdown options for category list **/
					let options = {
						collections :[{
							collection 	:	Tables.CATEGORIES,
							selected 	: 	[category],
							columns    	: 	["_id","category_name"],
							conditions 	: 	{
								parent_category_id	:	0,
								category_type		:	Constants.CATEGORY_TYPE_MERCHANT_PORTAL
							},
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

					/**Get dropdown list **/
					getDropdownList(req,res, next,options).then(dropDownResponse=> {
						if(dropDownResponse.status != Constants.STATUS_SUCCESS) return res.status(400).send(dropDownResponse);

						/** render ticket add page **/
						res.render('add',{
							layout			:	false,
							is_editable		:	isEditable,
							result			: 	asyncResponse.ticket_details,
							category_list 	:	dropDownResponse?.final_html_data?.["0"] || "",
							department_list	: 	dropDownResponse?.final_html_data?.["1"] || "",
							subcategory_list: 	dropDownResponse?.final_html_data?.["2"] || "",
							title_list		: 	dropDownResponse?.final_html_data?.["3"] || "",
							ticket_no		:   ticketNo
						});
					}).catch(next);
				});
			}
		}catch(error){
			return next(error);
		}
	};//End addTicket()

	/**
	* Function for get category list
	*
	* @param req 	As Request Data
	* @param res 	As Response Data
	* @param next 	As Callback argument to the middleware function
	*
	* @return null
	*/
	async getCategoryList (req, res, next){
		try{
			let categoryId 	= req?.body?.category_id || "";

			/** Send success response */
			if(!categoryId) return res.send({status : Constants.STATUS_SUCCESS, result : "" });

			/**Get dropdown list **/
			let dropDownResponse = await getDropdownList(req,res, next,{
				collections :[{
					collection : Tables.CATEGORIES,
					columns    : ["_id","category_name"],
					conditions : {
						parent_category_id: new ObjectId(categoryId)
					},
				}]
			});
			if(dropDownResponse.status != Constants.STATUS_SUCCESS) return res.send(dropDownResponse);

			/** Send success response */
			res.send({
				status: Constants.STATUS_SUCCESS,
				result: dropDownResponse?.final_html_data?.["0"] || ""
			});
		}catch(error){
			return next(error);
		}
	};//End getCategoryList()

	/**
    * Function to save tickets  logs
    *
    * @param req 		As Request Data
    * @param res 		As Response Data
    * @param options 	As Object Data
    *
    * @return render
    */
  	async saveTicketsLogs (req, res, next, options){
		return new Promise(resolve=>{
			let logType 		= 	options.log_type;
			let description		=	options.description;
			let department		=	options.additional_details.assigned_to_role_id;
			let authDepartment 	=	options.user_role_id;

			asyncParallel({
				department_details : (callback)=>{
					if(!department) return callback(null,{});
					
					/** Get department name  **/
					this.getDepartmentName(req, res,{department : department}).then(roleResponse=>{
						if(roleResponse.status != Constants.STATUS_SUCCESS) return callback(roleResponse);

						callback(null,roleResponse.result);
					}).catch(next);
				},
				auth_department_details : (callback)=>{
					if(!authDepartment) return callback(null,{});

					/** Get department name  **/
					this.getDepartmentName(req, res,{department : authDepartment}).then(roleResponse=>{
						if(roleResponse.status != Constants.STATUS_SUCCESS) return callback(roleResponse);

						callback(null,roleResponse.result);
					}).catch(next);
				},
			},async (asyncErr,asyncResponse)=>{
				if(asyncErr) return resolve({status: Constants.STATUS_ERROR});

				let authUserName		=	req.session.user.full_name;
				let departmentName		=	asyncResponse.department_details.role_name;
				let authdepartmentName	=	asyncResponse.auth_department_details.role_name;
				let logParams			=	[];

				/** Get params array */
				switch(logType){
					case Constants.TICKET_ASSIGNED_LOG :
						logParams = [authUserName,authdepartmentName,departmentName];
					break;
					case Constants.TICKET_UPDATE_LOG :
						logParams = [authUserName,authdepartmentName];
					break;
				}

				/** Get description from description param parameters **/
				if(Constants.TICKET_LOG_MESSAGE[logType] && logParams.length >0){
					let constants 	=	Constants.TICKET_LOG_MESSAGE[logType]['constants'];
					description 	= 	Constants.TICKET_LOG_MESSAGE[logType]['message'];
					for(let i = 0;i<constants.length;i++){
						description = description.replace(RegExp(constants[i],'g'),logParams[i]);
					}
				}

				/** Save tickets logs */
				const ticket_logs =	this.db.collection(Tables.TICKET_LOGS);
				await ticket_logs.insertOne({
					log_type 	        : 	logType,
					ticket_id       	: 	options.ticket_id,
					order_id 	        : 	options.order_id,
					user_id 	        : 	new ObjectId(options.user_id),
					user_role_id        : 	options.user_role_id,
					description         : 	description,
					additional_details  : 	options.additional_details,
					created 	        :	getUtcDate(),
				});

				/** Send success response */
				resolve({status: Constants.STATUS_SUCCESS});
			});
		});
	};//End saveTicketsLogs()

	/**
	* Function for get department name
	*
	* @param req 		As Request Data
	* @param res 		As Response Data
	* @param next 		As Callback argument to the middleware function
	* @param options 	As Object Data
	*
	* @return null
	*/
	async getDepartmentName (req,res,options){
		return new Promise(async resolve=>{
			try{
				let department = (options.department) ? options.department :"";
	
				/** Send error response */
				if(!department) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again")});
	
				/** Get roles name  **/
				const admin_roles = this.db.collection(Tables.ADMIN_ROLES);
				let roleResult  = await admin_roles.findOne({
					_id : new ObjectId(department),
				},{projection: { role_name:1}});

				if(!roleResult) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again")});
	
				/** Send success response */
				resolve({status: Constants.STATUS_SUCCESS, result: roleResult});
			}catch(error){
				console.log(error);
				resolve({status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again")});
			}
		});
	};//End getDepartmentName()

	/**
	* Function to view ticket details
	*
	* @param req 	As Request Data
	* @param res 	As Response Data
	* @param next 	As Callback argument to the middleware function
	*
	* @return null
	*/
	async viewTicket (req, res, next){
		let ticketId			= (req.params.id) ? new ObjectId(req.params.id) : "";
		const ticket_threads	= this.db.collection(Tables.TICKET_THREADS);
		const ticket_logs 		= this.db.collection(Tables.TICKET_LOGS);
		let authUserId			= new ObjectId(req.session.user._id);
		let authUserRoleId		= req.session.user.user_role_id;

		/** Set conditions */
		let ticketConditions = {_id : ticketId};

		if(Constants.TICKET_CATEGORY_ALLOWED_ROLES.indexOf(authUserRoleId) != -1){
			/** Get assign category list */
			const users 	= this.db.collection(Tables.USERS);
			let result = await users.findOne({_id: authUserId },{projection: { ticket_category_ids:1}});
			
			ticketConditions["$and"] = [{
				category : {$in : result?.ticket_category_ids || []}
			}];
		}

		asyncParallel({
			ticket_details : (callback)=>{
				this.ticketCollection.aggregate([
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
						localField 	: "assigned_to",
						foreignField: "_id",
						as 			: "assigned_details"
					}},
					{$project : {_id:1,ticket_id:1,description:1,created:1,created_by_role_id:1,last_activity_date_time:1,last_activity_type:1,status:1,order_id:1,check_in:1,check_in_by:1, qa_comment: 1, qa_rating: 1,ticket_type:1, assigned_to_role_id:1,client_details:1,category:1,sub_category:1,title:1,
						department			: {$arrayElemAt : ["$department_details.role_name",0]},
						created_by_name		: {$arrayElemAt : ["$user_details.full_name",0]},
						assigned_to_name	: {$arrayElemAt : ["$assigned_details.full_name",0]},
					}}
				]).toArray().then(result=>{
					if(!result || result.length <=0) return callback(null,{result: null});

					/** Get categories*/
					let ticketDetails	= result[0];
					let categoryIds 	= [ticketDetails.category,ticketDetails.sub_category,ticketDetails.title];
					
					const categories	= this.db.collection(Tables.CATEGORIES);
					categories.find({_id : {$in : arrayToObject(categoryIds)}},{projection : {_id:1,category_name : 1}}).toArray().then(categoryData=>{
						if(!categoryData) return  callback(null,{});

						let categoryList = {};
						categoryData.map(master=>{categoryList[master._id] = master.category_name;});
						callback(null,{result : ticketDetails,categories : categoryList});
					}).catch(err=>{
						callback(err,{result: null});
					});
				}).catch(err=>{
					callback(err,{result: null});
				});
			},
			comments : (callback)=>{
				ticket_threads.aggregate([
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
				}).catch(err=>{
					callback(err,null);
				});
			},
			departments : (callback)=>{
				/** get dropdown list for given role users **/
				getDropdownList(req, res, next, {
					collections: [{
						collection: Tables.ADMIN_ROLES,
						columns: ["_id", "role_name"],
						conditions: {user_type : Constants.USER_TYPE_ADMIN,is_shown: Constants.SHOWN},
					}]
				}).then(response => {
					callback(null,response?.final_html_data?.[0] || "");
				}).catch(err=>{
					callback(err,null);
				});
			},
			history : (callback)=>{
				ticket_logs.aggregate([
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
				}).catch(err=>{
					callback(err,null);
				});
			}
		},(asyncErr,response)=>{
			if(asyncErr) return next(asyncErr);

			if(!response.ticket_details.result){
				/** Send error response */
				req.flash(Constants.STATUS_ERROR,res.__("system.invalid_access"));
				return res.redirect(Constants.WEBSITE_URL+"tickets");
			}

			/** Render view page */
			req.breadcrumbs(BREADCRUMBS['tickets/view']);
			res.render("view",{
				result 		: response.ticket_details.result,
				comments	: response.comments,
				history		: response.history,
				departments	: response.departments,
				categories	: response.ticket_details.categories
			});
		});
	};//End viewTicket()

	/**
	* Function for add comment
	*
	* @param req 	As Request Data
	* @param res 	As Response Data
	* @param next 	As Callback argument to the middleware function
	*
	* @return null
	*/
	async addComment (req, res, next){
		/** Sanitize Data **/
		req.body = sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
		let userId 			=	new ObjectId(req.session.user._id);
		let userRoleId 		=	req.session.user.user_role_id;
		let restaurantId	=	new ObjectId(req.session.user.restaurant_id);
		let ticketId 		= 	(req.body.ticket_id) ?	new ObjectId(req.body.ticket_id) 	: "";

		/** find tickets number if already exists **/
		const ticket_threads = this.db.collection(Tables.TICKET_THREADS);
		this.ticketCollection.findOne({_id : ticketId},{projection: { _id:1,order_id : 1,ticket_id: 1}}).then(result=>{
			if(!result) return res.send({
				status	: Constants.STATUS_ERROR,
				message : [{param: Constants.ADMIN_GLOBAL_ERROR,msg:res.__("system.invalid_access")}]
			});

			asyncParallel({
				ticket_details : (callback)=>{
				/** Save last activity date time details **/
					this.ticketCollection.updateOne({_id : ticketId},{$set : {last_activity_date_time : getUtcDate()}}).then(()=>{
						callback(null,null);
					}).catch(next);
				},
				ticket_threads : (callback)=>{
					/** Save ticket details **/
					ticket_threads.insertOne({
						ticket_id 		: ticketId,
						user_id  		: new ObjectId(userId),
						user_role_id	: userRoleId,
						order_id		: req.body.order_id,
						response		: req.body.comment,
						created			: getUtcDate()
					}).then(()=>{
						callback(null,null);
					}).catch(next);
				}
			},(asyncErr,response)=> {
				if(asyncErr) return next(asyncErr);

				/** Send success response **/
				req.flash(Constants.STATUS_SUCCESS,res.__("tickets.comment_has_been_added_successfully"));
				res.send({
					status	: Constants.STATUS_SUCCESS,
					message	: res.__("tickets.comment_has_been_added_successfully")
				});

				/** Save ticket logs **/
				this.saveTicketsLogs(req, res, next,{
					order_id 			: 	result.order_id,
					ticket_number		: 	result.ticket_id,
					log_type			: 	Constants.TICKET_COMMENT_LOG,
					ticket_id 			: 	ticketId,
					description 		: 	"",
					user_id 			: 	new ObjectId(userId),
					user_role_id 		: 	userRoleId,
					additional_details	: 	{
						comment 		:	req.body.comment
					},
				}).then(()=>{});
			});
		}).catch(next);
	};//End addComment()
}

