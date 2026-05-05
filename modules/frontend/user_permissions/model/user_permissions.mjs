
import { ObjectId } from 'mongodb';
import { parallel as asyncParallel } from 'async';
import BREADCRUMBS from "../../../../breadcrumbs.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { getUtcDate, userModuleFlagAction,isPost, sanitizeData, configDatatable, getDatabaseSlug, generateMD5Hash,getDropdownList} from "../../../../utils/index.mjs";
import {sendMail} from "../../../../services/index.mjs";
import adminModule from '../../../admin/admin_modules/model/admin_module.mjs';

export default class UserPermission {
	constructor(db) {
		this.db = db;
		this.adminModel = new adminModule(db);
	}

	/**
	 * Function to get user permission list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async list (req, res, next){
		try{
			if(isPost(req)){
				let limit		=	(req.body.length)	? 	parseInt(req.body.length)	: Constants.FRONT_LISTING_LIMIT;
				let skip		= 	(req.body.start) 	?	parseInt(req.body.start)	: Constants.DEFAULT_SKIP;
				let restaurantId=	(req.session.user)	?	req.session.user.restaurant_id :"";
				let authUserId	=	(req.session.user)	?	req.session.user._id :"";
				const collection= 	this.db.collection(Tables.USERS);

				/** Configure Datatable conditions **/
				let dataTableConfig = await configDatatable(req,res,null);
				let commonConditions = {
					_id			 : 	{$ne : new ObjectId(authUserId) },
					restaurant_id:	new ObjectId(restaurantId),
					user_type	 : 	Constants.USER_TYPE_RESTAURANT,
					user_role_id : 	{$ne: Constants.RESTAURANT},
					is_deleted 	 : 	Constants.NOT_DELETED
				};

				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions,commonConditions);

				let dbRes = await collection.aggregate([
					{$match: dataTableConfig.conditions },
					{$facet : {
						list : [
							{$sort: dataTableConfig.sort_conditions },
							{$skip: skip },
							{$limit: limit},
							{$project :	{
								_id : 1, full_name : 1,email : 1, modified : 1, active : 1,
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
				/** render listing page **/
				req.breadcrumbs(BREADCRUMBS['user_permissions/list']);
				res.render('list');
			}
		}catch(err){
			return next(err);
		}
	}//End list()

	/**
	 * Function for add user permission
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
   	async add (req, res,next){
		try{
			let restaurantId=	(req.session.user) ? req.session.user.restaurant_id :"";
			let authUserId	=	(req.session.user) ? req.session.user._id :"";

			if(isPost(req)){
				/** Sanitize Data **/
				req.body 		= 	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
				let password	=	req?.body?.password || "";
				let firstName 	= 	req?.body?.first_name || "";
				let lastName 	= 	req?.body?.last_name || "";
				let email 		= 	req?.body?.email || "";
				let fullName	= 	firstName+' '+ lastName;

				/**Check email is unique*/
				const users  = this.db.collection(Tables.USERS);
				asyncParallel({
					slug :(callback)=>{
						/** Get slug **/
						getDatabaseSlug({title: fullName, table_name: Tables.USERS, slug_field: "slug"}).then(response=>{
							callback(null,response?.title || "");
						}).catch(next);
					},
					module_list :(callback)=>{
						/**Get module list */
						this.adminModel.formatModuleIdsArray(req, res, {user_type: Constants.USER_TYPE_RESTAURANT}).then(moduleArray=>{
							callback(null,moduleArray);
						}).catch(next);
					},
				},(_, asyncResponse)=>{

					let newPassword	= generateMD5Hash(password);

					/** Save user details **/
					users.insertOne({
						parent_id 	:	new ObjectId(authUserId),
						restaurant_id:	new ObjectId(restaurantId),
						first_name 	: 	firstName,
						last_name 	: 	lastName,
						full_name	: 	fullName,
						email 		: 	email,
						user_role_id:	req?.body?.user_role || "",
						slug 		: 	asyncResponse?.slug || "",
						password	: 	newPassword,
						module_ids	: 	asyncResponse?.module_list || [],
						user_type	: 	Constants.USER_TYPE_RESTAURANT,
						active 		: 	Constants.ACTIVE,
						is_verified	: 	Constants.VERIFIED,
						is_deleted 	: 	Constants.NOT_DELETED,
						branches 	: 	(req?.body?.branches)	?	new ObjectId(req.body.branches)	:"",
						created 	: 	getUtcDate(),
						modified 	:	getUtcDate()
					}).then(()=>{

						/** Send success response **/
						req.flash(Constants.STATUS_SUCCESS,res.__("user_permissions.user_permissions_has_been_added_successfully"));
						res.send({
							status		: Constants.STATUS_SUCCESS,
							redirect_url: Constants.WEBSITE_URL+"user_permissions",
							message		: res.__("user_permissions.user_permissions_has_been_added_successfully")
						});

						/** Send email **/
						sendMail(req,res,{
							to 			: email,
							action 		: "restaurant_add_user",
							rep_array 	: [fullName,email,password,Constants.WEBSITE_URL]
						});
					}).catch(next);
				});
			}else{
				asyncParallel({
					branch_list : (callback)=>{
						/**Get branch list **/
						getDropdownList(req,res,next,{
							collections :[{
								collection : Tables.RESTAURANT_BRANCHES,
								columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
								conditions : {restaurant_id : new ObjectId(restaurantId)}
							}]
						}).then(dropDownRes=> {
							callback(null,dropDownRes?.final_html_data?.[0] || "");
						}).catch(next);
					},
					role_list : (callback)=>{
						/** Get role list */
						this.getRestaurantRoleList(req,res,next).then(response=> {
							callback(null,response?.result || []);
						}).catch(next);
					},
					modules_list : (callback)=>{
						/** Include restaurant modules Module **/
						this.adminModel.getAdminModulesTree(req, res, {
							user_type: Constants.USER_TYPE_RESTAURANT,
							only_for_menu: false
						}).then(moduleResponse=>{
							callback(null,moduleResponse?.result || []);
						}).catch(next);
					},
					restaurant_data : (callback)=>{
						const users	=	this.db.collection(Tables.USERS);
						users.findOne({restaurant_id : new ObjectId(restaurantId)},{projection: {branch_permission :1,employee_permission:1}}).then(result=>{
							if(result?.branch_permission) result.branch_permission.push(Constants.RESTAURANT_DASHBOARD);
							if(result?.employee_permission) result.employee_permission.push(Constants.RESTAURANT_DASHBOARD);
							callback(null,result);
						}).catch(next);
					}
				},(err, response)=>{
					if(err) return next(err);

					req.breadcrumbs(BREADCRUMBS['user_permissions/add']);
					res.render('add',{
						branch_list	:	response.branch_list,
						role_list	: 	response.role_list,
						modules_list: 	response.modules_list,
						branch_permission	:	(response?.restaurant_data?.branch_permission) ? response?.restaurant_data?.branch_permission : [],
						employee_permission	:	(response?.restaurant_data?.employee_permission) ? response?.restaurant_data?.employee_permission : [],
					});
				});
			}
		}catch(err){
			return next(err);
		}
	};//End add()

	/**
	 * Function for edit user permission
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async edit (req, res,next){
		try{
			let id 			= 	(req.params.id)	? req.params.id	: "";
			let restaurantId=	(req.session.user) ? req.session.user.restaurant_id :"";

			if(isPost(req)){
				/** Sanitize Data **/
				req.body		= 	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
				let password	=	req?.body?.password || "";
				let email		=	req?.body?.email || "";
				let firstName	= 	req?.body?.first_name || "";
				let lastName 	= 	req?.body?.last_name || "";
				let fullName 	=	firstName+' '+ lastName;

				/** Configure  unique  email conditions*/
				const users = this.db.collection(Tables.USERS);
				asyncParallel({
					password :(callback)=>{
						if(!password) return callback(null,null);

						/**Genrate password hash */
						let newPassword	= generateMD5Hash(password);
						callback(null,newPassword);
					},
					module_list :(callback)=>{
						/**Get module list */
						this.adminModel.formatModuleIdsArray(req, res, {user_type: Constants.USER_TYPE_RESTAURANT}).then(moduleArray=>{
							callback(null,moduleArray);
						}).catch(next);
					},
				},(asyncerr, asyncResponse)=>{

					/** Set update data */
					let updateData	=	{
						first_name	: 	firstName,
						last_name 	: 	lastName,
						full_name	: 	fullName,
						branches	: 	(req?.body?.branches)	?	new ObjectId(req.body.branches)	:"",
						user_role_id:	req?.body?.user_role || "",
						module_ids	: 	asyncResponse?.module_list || [],
						modified 	:	getUtcDate()
					};

					/** Update data when enter password */
					if(asyncResponse.password) updateData['password'] =	asyncResponse.password;

					/** update user permission data*/
					users.updateOne({_id: new ObjectId(id)},{$set: updateData}).then(()=>{

						/** Delete user permission from cache */
						userModuleFlagAction(id,"","delete");

						/** Send success response **/
						req.flash(Constants.STATUS_SUCCESS,res.__("user_permissions.user_permissions_updated_successfully"));
						res.send({
							status		: Constants.STATUS_SUCCESS,
							redirect_url: Constants.WEBSITE_URL+"user_permissions",
							message		: res.__("user_permissions.user_permissions_updated_successfully"),
						});
					}).catch(next);
				});
			} else{
				/** Get user permission details */
				let response = await this.getUserPermissionDetails(req, res,next);

				/** Send error response **/
				if(response.status != Constants.STATUS_SUCCESS){
					req.flash(Constants.STATUS_ERROR,response.message);
					res.redirect(Constants.WEBSITE_URL+'user_permissions');
				}

				let permissionDetails	= 	response.result;
				let branchId =	permissionDetails?.branches || "";
				asyncParallel({
					branch_list : (callback)=>{
						/** Set dropdown options for branch list **/
						getDropdownList(req,res,next,{
							collections :[{
								collection : Tables.RESTAURANT_BRANCHES,
								columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
								selected   : [branchId],
								conditions : {restaurant_id : new ObjectId(restaurantId)}
							}]
						}).then(dropDownResponse=> {
							callback(null,dropDownResponse?.final_html_data?.[0] || "");
						}).catch(next);
					},
					role_list : (callback)=>{
						/** Get role list */
						this.getRestaurantRoleList(req,res,next).then(response=> {
							callback(null,response?.result || []);
						}).catch(next);
					},
					modules_list : (callback)=>{
						/** Include restaurant modules Module **/
						this.adminModel.getAdminModulesTree(req, res, {
							user_type: Constants.USER_TYPE_RESTAURANT,
							only_for_menu: false
						}).then(moduleResponse=>{
							callback(null,moduleResponse?.result || []);
						}).catch(next);
					},
					restaurant_data : (callback)=>{
						const users	=	this.db.collection(Tables.USERS);
						users.findOne({restaurant_id : new ObjectId(restaurantId)},{projection: {branch_permission :1,employee_permission:1}}).then(result=>{
							if(result?.branch_permission) result.branch_permission.push(Constants.RESTAURANT_DASHBOARD);
							if(result?.employee_permission) result.employee_permission.push(Constants.RESTAURANT_DASHBOARD);
							callback(null,result);
						}).catch(next);
					}
				},(err, asyncRes)=>{
					if(err) return next(err);

					/** Render edit page  **/
					req.breadcrumbs(BREADCRUMBS['user_permissions/edit']);
					res.render('edit',{
						result	   			:	permissionDetails,
						branch_list			:	asyncRes?.branch_list || "",
						role_list			: 	asyncRes?.role_list || [],
						modules_list		: 	asyncRes?.modules_list || [],
						branch_permission	:	asyncRes?.restaurant_data?.branch_permission || [],
						employee_permission	:	asyncRes?.restaurant_data?.employee_permission || [],
					});
				});
			}
		}catch(err){
			return next(err);
		}
	};//End edit()

	/**
	 * Function for delete
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async deleteUserPermission (req, res,next){
		try{
			let id		=	(req.params.id) 	? 	req.params.id 			:"";
			let authId	=	(req.session.user) 	?	req.session.user._id 	:"";

			/** Delete user permission*/
			const users = this.db.collection(Tables.USERS);
			await users.updateOne({
				_id	:  {
					$eq: new ObjectId(id),
					$ne: new ObjectId(authId)
				},
				user_type: Constants.USER_TYPE_RESTAURANT
			},
			{$set : {
				is_deleted 	: Constants.DELETED,
				deleted_by	: new ObjectId(authId),
				deleted_at	: getUtcDate(),
				modified	: getUtcDate()
			}});

			/** Send success response **/
			req.flash(Constants.STATUS_SUCCESS,res.__("user_permissions.user_permissions_deleted_successfully"));
			res.redirect(Constants.WEBSITE_URL+"user_permissions");
		}catch(err){
			return next(err);
		}
	}//End deleteUserPermission()

	/**
	 * Function for get user Permission Details
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	async getUserPermissionDetails (req,res,next){
		return new Promise(async resolve=>{
			try{
				let id			=	(req.params.id)		?	req.params.id			:"";
				let authUserId	=	(req.session.user)	?	req.session.user._id 	:"";
				let restaurantId=	(req.session.user) 	? 	req.session.user.restaurant_id :"";

				/** Get user details  */
				const users	= this.db.collection(Tables.USERS);
				let result = await users.findOne({
					_id	:  {
						$eq: new ObjectId(id),
						$ne: new ObjectId(authUserId)
					},
					is_deleted	 :  Constants.NOT_DELETED,
					user_type	 :  Constants.USER_TYPE_RESTAURANT,
					user_role_id : 	{$ne: Constants.RESTAURANT},
					restaurant_id:  new ObjectId(restaurantId),
				},{projection: {
					_id: 1, first_name: 1, last_name: 1, full_name: 1,email: 1, modified: 1,active: 1, branches: 1,user_role_id:1,module_ids:1
				}});

				/** Send error response **/
				if(!result) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

				/** Send suucess response */
				resolve({status: Constants.STATUS_SUCCESS, result: result});
			}catch(err){
				return next(err);
			}
		}).catch(next);
	}//End getUserPermissionDetails();

	/**
	 * Function for update active/ deactive status
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async updateStatus  (req, res,next){
		try{
			let userId 		=	(req.params.id) 			? 	req.params.id	:"";
			let authUserId	=	(req.session.user)			?	req.session.user._id 	:"";
			let restaurantId=	(req.session.user) 			?	req.session.user.restaurant_id :"";
			let status	 	= 	(req.params.status==Constants.ACTIVE) ?	Constants.DEACTIVE 		:Constants.ACTIVE;

			/** Update user status */
			const users = this.db.collection(Tables.USERS);
			await users.updateOne({
				_id	:  {
					$eq : new ObjectId(userId),
					$ne : new ObjectId(authUserId)
				},
				is_deleted	 :  Constants.NOT_DELETED,
				user_type	 :  Constants.USER_TYPE_RESTAURANT,
				user_role_id : 	{$ne: Constants.RESTAURANT},
				restaurant_id:  new ObjectId(restaurantId),
			},
			{$set : {
				active	 : status,
				modified : getUtcDate()
			}});

				/** Send success response **/
			req.flash(Constants.STATUS_SUCCESS,res.__("user_permissions.status_updated_successfully"));
			res.redirect(Constants.WEBSITE_URL+'user_permissions');
		}catch(err){
			return next(err);
		}
	};// end updateStatus()

	/**
	 * Function to get restaurant roles list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	async getRestaurantRoleList (req,res,next){
		return new Promise(async resolve=>{
			try{
				/** Get  admin role list **/
				const admin_roles = this.db.collection(Tables.ADMIN_ROLES);
				let result = await admin_roles.find({
					user_type : Constants.USER_TYPE_RESTAURANT,
					is_shown : Constants.SHOWN,
				},{projection: {_id:1,role_name:1}}).sort({"role_name": Constants.SORT_ASC}).toArray();

				/** Send error response */
				if(result.length <=0) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });

				/** Send success response **/
				resolve({
					status:	Constants.STATUS_SUCCESS,
					result: result
				});
			}catch(err){
				return next(err);
			}
		}).catch(next);
	}// End getRestaurantRoleList()

	/**
	 * Function for view modules of selected role
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render
	 */
	async getRestaurantRoleModulesData (req, res,next){
		try{
			let roleId = (req.body.id) ? req.body.id : "";

			/** Send error response */
			if(!roleId) return res.send({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

			/** Get selected role details */
			const admin_roles	= this.db.collection(Tables.ADMIN_ROLES);
			let result = await admin_roles.findOne({
				_id : new ObjectId(roleId),
				user_type : Constants.USER_TYPE_RESTAURANT
			},{projection: {_id : 1,role_name :1,module_ids:1}});

			/** Send error response */
			if(!result) return res.send({status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });

			/** Send success response */
			res.send({ status: Constants.STATUS_SUCCESS, result: result });
		}catch(err){
			return next(err);
		}
	}//end getRestaurantRoleModulesData()
}
