import crypto from 'node:crypto';
import { ObjectId } from 'mongodb';
import {parallel as asyncParallel} from 'async';

import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import * as Helper from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { saveSystemLogs, sendMailToUsers, saveReclaimLogs, insertNotifications, sendSMS} from "../../../../services/index.mjs";

export default class UserManagement {
	constructor(db) {
		this.db = db;
		this.collectionDb = this.db.collection(Tables.USERS);
	}

	/**
	 * Function to get list of drivers
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	async listDriver (req, res, next){
		let userType	= (req.query.user_type)	? req.query.user_type : '';

		if(Helper.isPost(req)){
			let limit			= 	(req.body.length)	? parseInt(req.body.length)	: Constants.ADMIN_LISTING_LIMIT;
			let skip			= 	(req.body.start) 	? parseInt(req.body.start)	: Constants.DEFAULT_SKIP;

			/** Configure Datatable conditions*/
			const dataTableConfig = await Helper.configDatatable(req, res, null);

			let commonConditions = {
				user_role_id : Constants.DRIVER,
				is_deleted 	 : Constants.NOT_DELETED,
			};

			if(userType){
				switch(userType){
					case "available_drivers":
						commonConditions.is_available 	= 	Constants.AVAILABLE;
						commonConditions.active 		=	Constants.ACTIVE;
					break;
					case "assign_drivers":
						commonConditions.active 		=	Constants.ACTIVE;
						commonConditions.is_available 	= 	Constants.AVAILABLE;
						commonConditions.order_status 	=	{$ne : Constants.ORDER_DRIVER_FREE};
					break;
					case "free_drivers":
						commonConditions.active 		=	Constants.ACTIVE;
						commonConditions.is_available 	= 	Constants.AVAILABLE;
						commonConditions.order_status 	=	Constants.ORDER_DRIVER_FREE;
					break;
					case "1":
						commonConditions.active =	Constants.ACTIVE;
					break;
					case "0":
						commonConditions.active =	Constants.DEACTIVE;
					break;
				}
			}

			dataTableConfig.conditions = Object.assign(commonConditions, dataTableConfig.conditions);

			// Get list or count of drivers with aggregation
			let dbRes = await this.collectionDb.aggregate([
				{$match: dataTableConfig.conditions },
				{$facet : {
					list : [
						{$addFields	: {
							original_email : "$email",
							"email" : { $toLower: "$email" },
						}},
						{$sort		: dataTableConfig.sort_conditions },
						{$skip		: skip },
						{$limit		: limit},
						{$project	: {_id : 1, full_name:1, email : "$original_email", modified : 1, active : 1,driver_id:1,mobile_number:1}}
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
			/** render driver listing page **/
			req.breadcrumbs(BREADCRUMBS['admin/user_management/list_driver']);
			res.render('list_driver',{user_type : userType});
		}
	};//End listDriver()

	/**
	 * Function for add/edit driver
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
   	async addEditDriver (req, res, next){
		let authId			= (req.session.user && req.session.user._id)	? req.session.user._id :"";
		let driverId		= (req.params.id) ? new ObjectId(req.params.id)	: new ObjectId();
		let isEditable		= (req.params.id) ?	true : false;
		if(Helper.isPost(req)){
			/** Sanitize Data **/
			req.body 			= 	Helper.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let password		=	req?.body?.password ||"";
			let uniqueDriverId	=	req?.body?.driver_id ||"";
			let mobileNumber	=	req?.body?.mobile_number ||"";
			let oldImage		=	req?.body?.old_image ||"";
			let image			= 	req?.files?.image || "";
			let firstName 		= 	req?.body?.first_name || "";
			let lastName 		= 	req?.body?.last_name || "";
			let email 			= 	req?.body?.email || "";
			let fullName		= 	firstName+' '+ lastName;

			/**Function for upload image */
			let imageResponse = await Helper.moveUploadedFile(req, res,{
				filePath : Constants.USERS_FILE_PATH,
				image 	 : image,
				oldPath  : oldImage
			});

			/** Send error response **/
			if(imageResponse.status == Constants.STATUS_ERROR){
				return res.send({ status	: Constants.STATUS_ERROR, message: [{'param':'image','msg':imageResponse.message}] });
			}

			/** Generate slug */
			let slug = "";
			if(isEditable && fullName){
				let slugResponse = await Helper.getDatabaseSlug({
					title 		:	fullName,
					table_name 	: 	Tables.USERS,
					slug_field 	: 	"slug"
				});

				slug = slugResponse?.title || "";
			}

			/** Generate password */
			let newPassword = password && Helper.generateMD5Hash(password) || "";

			/** Set update data */
			let updateData	= {
				$set : {
					email: email,
					mobile_number: mobileNumber,
					first_name: firstName,
					last_name: lastName,
					full_name: fullName,
					driver_id: uniqueDriverId,
					modified: Helper.getUtcDate()
				},
				$setOnInsert : {
					slug 				: slug,
					user_role_id		: Constants.DRIVER,
					phone_country_code 	: Constants.DEFAULT_COUNTRY_CODE,
					user_type			: Constants.USER_TYPE_OTHER,
					order_status 		: Constants.ORDER_DRIVER_FREE,
					active 				: Constants.ACTIVE,
					is_verified 		: Constants.VERIFIED,
					is_email_verified	: Constants.VERIFIED,
					is_mobile_verified	: Constants.VERIFIED,
					is_deleted 			: Constants.NOT_DELETED,
					created_by			: new ObjectId(authId),
					created 			: Helper.getUtcDate(),
				}
			};

			if(newPassword) updateData["$set"]['password'] = newPassword;
			if(imageResponse?.fileName) updateData['$set'].image = imageResponse.fileName;

			/** Save / update user data **/
			await this.collectionDb.updateOne({_id: driverId},updateData,{upsert: true});

			/*************** Send mail  ***************/
				if(!isEditable){
					sendMailToUsers(req,res,{
						event_type 			:	Constants.NOTIFICATION_DRIVER_REGISTER,
						driver_fullname		: 	fullName,
						driver_email		: 	email,
						driver_password		: 	password,
					});
				}
			/*************** Send mail  ***************/

			/** Save system logs */
			saveSystemLogs(req, res, {
				user_id				: 	authId,
				parent_id			: 	driverId,
				activity_module		: 	Constants.SYSTEM_LOG_MODULE_DRIVER_MANAGEMENT,
				activity_type		: 	Constants.ACTIVITY_TYPE_ADD_EDIT,
				additional_details	:	{}
			}).then(()=>{ });

			/** Send success response **/
			let message = (isEditable) ? res.__("admin.user_management.driver_updated_successfully") :res.__("admin.user_management.driver_has_been_added_successfully");
			req.flash(Constants.STATUS_SUCCESS,message);
			res.send({
				status		: Constants.STATUS_SUCCESS,
				redirect_url: Constants.WEBSITE_ADMIN_URL+"user_management/list_driver",
			});
		}else{
			let response = {};
			if(isEditable){
				response  =	await this.getDriverDetails(req, res,next);

				/** Send error response **/
				if(response.status != Constants.STATUS_SUCCESS){
					req.flash(Constants.STATUS_ERROR,response.message);
					return res.redirect(Constants.WEBSITE_ADMIN_URL+"user_management/list_driver");
				}
			}

			/** get driver id **/
			let driverIdRes = !isEditable && await Helper.getUniqueId(req,res,next,{type:"user_driver_id"}) || "";

			/** Render add edit page  **/
			req.breadcrumbs(BREADCRUMBS[`admin/user_management${isEditable && 'edit_driver' || 'add_driver'}`]);
			res.render('add_driver',{
				is_editable   : isEditable,
				result		  : response?.result || {},
				driver_id     : driverIdRes?.result || ""
			});
		}
	};//End addEditDriver()

	/**
	 * Function for delete driver
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return null
	 */
	async deleteDriver (req, res, next) {
		try{
			/** Delete driver*/
			await this.collectionDb.updateOne({
				_id 		: new ObjectId(req.params.id),
			},
			{$set : {
				is_deleted 	: Constants.DELETED,
				deleted_at	: Helper.getUtcDate(),
				modified	: Helper.getUtcDate(),
				deleted_by 	: new ObjectId(req.session.user._id)
			}});

			/** Send success response **/
			req.flash(Constants.STATUS_SUCCESS,res.__("admin.user_management.driver_deleted_successfully"));
			res.redirect(Constants.WEBSITE_ADMIN_URL+"user_management/list_driver");

			/** Save system logs */
			saveSystemLogs(req, res, {
				user_id				: req.session.user._id,
				parent_id			: req.params.id,
				activity_module		: Constants.SYSTEM_LOG_MODULE_DRIVER_MANAGEMENT,
				activity_type		: Constants.ACTIVITY_TYPE_DELETE,
				additional_details	: {}
			}).then(()=>{ });
		}catch(err){
			next(err);
		}
	};//End deleteDriver()

	/**
	 * Function for view driver
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render
	 */
	async viewDriverDetails (req, res, next){
		try{
			/** Get Driver details **/
			let response = await this.getDriverDetails(req, res, next);

			/** Send error response **/
			if(response.status != Constants.STATUS_SUCCESS){
				req.flash(Constants.STATUS_ERROR,response.message);
				return res.redirect(Constants.WEBSITE_ADMIN_URL+"user_management/list_driver");
			}

			/** Render view page*/
			req.breadcrumbs(BREADCRUMBS['admin/user_management/view_driver']);
			res.render('view_driver',{
				result : response.result,
				driver_id : req.params.id,
			});
		}catch(err){
			next(err);
		}
	};//End viewDriverDetails()

	/**
	 * Function to get driver detail
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	async getDriverDetails (req, res, next){
		try{
			/** Get driver details **/
			let result = await this.collectionDb.findOne({ _id: new ObjectId(req.params.id) });

			/** Send error response */
			if(!result) return {status : Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") };

			/** Append image with full path **/
			let fileResponse = await Helper.appendFileExistData({
				file_url : Constants.USERS_URL,
				file_path : Constants.USERS_FILE_PATH,
				result : [result],
				database_field : "image"
			});

			return {
				result : fileResponse?.result?.[0] || {},
				status : Constants.STATUS_SUCCESS
			}
		}catch(err){
			next(err);
		}
	};// End getDriverDetails()

	/**
	 * Function for view address details
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render
	 */
	async viewAddressDetails (req, res, next){
		try{
			const customer_addresses =	this.db.collection(Tables.CUSTOMER_ADDRESSES);
			let dbRes = await customer_addresses.aggregate([
				{$match: {
					_id: new ObjectId(req.params.id)
				}},
				{$lookup: {	/** Get city details **/
					from 		:	Tables.CITIES,
					localField  :	"city_id",
					foreignField:	"_id",
					as 		  	:	"city_details"
				}},
				{$lookup: {	/** Get area details **/
					from 		:	Tables.AREAS,
					localField  :	"area_id",
					foreignField:	"_id",
					as 		  	:	"area_details"
				}},
				{$lookup: {	/** Get block details **/
					from 		:	Tables.AREA_BLOCKS,
					localField  :	"block_id",
					foreignField:	"_id",
					as 		  	:	"block_details"
				}},
				{$addFields	: {
					city_name:	{$arrayElemAt: ["$city_details.name",0]},
					block_name:	{$arrayElemAt: ["$block_details.name",0]},
					area_name:	{$arrayElemAt: ["$area_details.name",0]},
				}}
			]).toArray();

			/** Send error response */
			if(!dbRes?.length) return res.status(400).send({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

			/** Render address list page */
			res.render('view_customer_address',{
				layout  : false,
				result : dbRes?.[0] || {},
			});
		}catch(err){
			next(err);
		}
	};//End viewAddressDetails()

	/**
	 * Function for update active/ deactive driver status
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return null
	 */
	async updateDriverStatus  (req, res, next){
		try{
			let userId = (req.params.id) ? req.params.id : "";
			let status = (req.params.status==Constants.ACTIVE) ? Constants.DEACTIVE : Constants.ACTIVE;

			/** Update status  */
			await this.collectionDb.updateOne({
				_id : new ObjectId(userId),
			},
			{$set : {
				active	 : status,
				modified : Helper.getUtcDate()
			}});

			/** Send success response **/
			req.flash(Constants.STATUS_SUCCESS,res.__("admin.user_management.status_updated_successfully"));
			res.redirect(Constants.WEBSITE_ADMIN_URL+'user_management/list_driver');

			/** Save system logs */
			saveSystemLogs(req, res, {
				user_id				: req.session.user._id,
				parent_id			: userId,
				activity_module		: Constants.SYSTEM_LOG_MODULE_DRIVER_MANAGEMENT,
				activity_type		: Constants.ACTIVITY_TYPE_STATUS_UPDATE,
				additional_details	: {status}
			}).then(()=>{ });
		}catch(err){
			next(err);
		}
	};// end updateDriverStatus()

	/**
	 * Function for driver/customer reclaim
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return null
	 */
	async reclaim  (req, res, next){
		try{
			let userId = req.params.id;

			/** Get user details  */
			let findResult = await this.collectionDb.findOne({ _id : new ObjectId(userId)},{projection:{_id:1,user_role_id:1}});

			if(!findResult) return res.send({status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") });

			/** Update user details */
			await this.collectionDb.updateOne({
				_id : new ObjectId(userId),
			},
			{$set : {
				active	 			: Constants.ACTIVE,
				is_verified 		: Constants.VERIFIED,
				is_email_verified	: Constants.VERIFIED,
				is_mobile_verified	: Constants.VERIFIED,
				modified 			: Helper.getUtcDate()
			}});

			/**For render schedule page */
			req.flash(Constants.STATUS_SUCCESS,res.__("admin.user_management.reclaimed_successfully"));
			res.send({
				status: Constants.STATUS_SUCCESS,
				layout: false,
			});

			let userRoleId = findResult.user_role_id ? findResult.user_role_id : "";
			if(userRoleId == Constants.CUSTOMER){
				/** Save reclaim logs */
				saveReclaimLogs(req, res, {
					action_taken_by		: req.session.user._id,
					user_id				: userId,
					action				: Constants.RECLAIM_LOGS_RECLAIM_ACTION,
					channel				: req.session.user.channel_id,
				}).then(()=>{ });
			}
		}catch(err){
			next(err);
		}
	};// end reclaim()

	// Customer section //

	/**
	 * Function to get customer list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	async listCustomer (req, res, next){
		let status		= (req.query.active)	? req.query.active : '';
		let newUsers	= (req.query.new_users)	? req.query.new_users : false;
		let blacklisted	= (req.query.blacklisted)	? req.query.blacklisted : '';
		let corporateId	= (req.query.corporate_id)	? req.query.corporate_id : '';
		if(Helper.isPost(req)){
			let limit = (req.body.length)	? parseInt(req.body.length)	: Constants.ADMIN_LISTING_LIMIT;
			let skip = (req.body.start) 	? parseInt(req.body.start)	: Constants.DEFAULT_SKIP;

			/** Configure Datatable conditions*/
			const dataTableConfig = await Helper.configDatatable(req, res, null);

			let commonConditions = {
				user_role_id : Constants.CUSTOMER,
				is_deleted 	 : Constants.NOT_DELETED,
			};

			if(status) 		commonConditions['active']				=	parseInt(status);
			if(blacklisted) commonConditions['is_black_list']		=	true;
			if(newUsers) 	commonConditions['created']				=	{$lte : Helper.newDate(),$gte : Helper.subtractDate(Constants.RECENT_CUSTOMER_DAYS*Constants.HOURS_IN_A_DAY)};
			if(corporateId) commonConditions = {...{corporate_id : new ObjectId(corporateId)}, ...commonConditions };

			dataTableConfig.conditions = Object.assign(commonConditions, dataTableConfig.conditions);

			// Get list or count of customers with aggregation
			let dbRes = await this.collectionDb.aggregate([
				{$match: dataTableConfig.conditions },
				{$facet : {
					list : [
						{$addFields	: {
							original_email : "$email",
							"email" : { $toLower: "$email" },
							original_full_name : "$full_name",
							"full_name" : { $toLower: "$full_name" },
						}},
						{$sort: dataTableConfig.sort_conditions},
						{$skip: skip },
						{$limit: limit},
						{$project: {
							_id:1,full_name:"$original_full_name",email:"$original_email",modified:1,active:1,client_type:1,is_guest:1,is_black_list:1,mobile_number:1
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
			/** render customer listing page **/
			req.breadcrumbs(BREADCRUMBS['admin/user_management/list_customer']);
			res.render('list_customer',{
				status 		 : status,
				blacklisted  : blacklisted,
				new_users  	 : newUsers,
				corporate_id : corporateId
			});
		}
	};//End listCustomer()

	/**
	 * Function for add/edit customer
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
   	async addEditCustomer (req, res, next){
		let authId			= (req.session.user && req.session.user._id)	? req.session.user._id :"";
		let customerId		= (req.params.id) ? new ObjectId(req.params.id)	:new ObjectId();
		let isEditable		= (req.params.id) ?	true : false;
		if(Helper.isPost(req)){
			/** Sanitize Data **/
			req.body 		= 	Helper.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let password	=	(req.body.password)	? 	req.body.password			:"";
			let mobileNumber=   (req.body.mobile_number)? 	req.body.mobile_number 		:"";
			let firstName 	= 	(req.body.first_name)	?	req.body.first_name	:"";
			let lastName 	= 	(req.body.last_name)	? 	req.body.last_name	:"";
			let email 		= 	(req.body.email)		? 	req.body.email		:"";
			let receiveNewsletter=   (req.body.receive_newsletter)	?	req.body.receive_newsletter	: 0;
			let referralCode=	(req.body.referral_code) ? req.body.referral_code : "";
			let fullName	= 	firstName+' '+ lastName;

			asyncParallel({
				referral_code : (callback)=>{
					if(isEditable) return callback(null,null);
					/** Set referral options **/
					let referralOptions = { prefix : fullName};

					/** Generate referral code **/
					Helper.generateReferralCode(req,res,referralOptions).then(referralResponse=>{
						let callbackErr 	 =	(referralResponse.status != Constants.STATUS_SUCCESS) ? true :null;
						let userReferralCode =	(referralResponse.referral_code)	?	referralResponse.referral_code	:"";

						callback(callbackErr,userReferralCode);
					}).catch(next);
				},
				slug : (callback)=>{
					if(isEditable) return callback(null,null);
					/** Set options for slug **/
					let options = {
						title 		:	fullName,
						table_name 	: 	Tables.USERS,
						slug_field 	: 	"slug"
					};

					/** Get slug **/
					Helper.getDatabaseSlug(options).then(slugResponse=>{
						let slug 		= (slugResponse && slugResponse.title) ? slugResponse.title :"";
						callback(null,slug);
					}).catch(next);
				},
				referral_detail : (callback)=>{
					if(isEditable) return callback(null,null);
					Helper.checkReferralCode(req,res,{referral_code:referralCode}).then(referredResponse=>{
						callback(null,referredResponse);
					});
				},
				new_password : (callback)=>{
					if(!password) return callback(null,null);
					/**Generate password hash */
					let newPassword = Helper.generateMD5Hash(password);
					callback(null,newPassword);
				},
			},async (asyncErr, asyncResponse)=>{
				if(asyncErr) return res.send({status : Constants.STATUS_ERROR, message : res.__("system.something_going_wrong_please_try_again")});

				let userReferralCode= (asyncResponse.referral_code) ? asyncResponse.referral_code	:"";
				let slug 			= (asyncResponse.slug) ? asyncResponse.slug :"";
				let referredDetail 	= (asyncResponse.referral_detail) ? asyncResponse.referral_detail :"";
				let newPassword 	= (asyncResponse.new_password) ? asyncResponse.new_password :"";

				if(referredDetail && referredDetail.status != Constants.STATUS_SUCCESS) return res.send({status :Constants.STATUS_ERROR,message:[{param:'referral_code',msg:res.__("admin.user_management.enterd_referral_code_is_not_valid")}]});

				/** Referred user id **/
				let referredUserId	=	(referredDetail.user_id)	?	new ObjectId(referredDetail.user_id)	:"";

				let updateData	=	{
					$set : {
						first_name 			: firstName,
						last_name 			: lastName,
						full_name			: fullName,
						gender 				: (req.body.gender)	?	req.body.gender	:"",
						date_of_birth 		: (req.body.dateofbirth)	?	Helper.getUtcDate(req.body.dateofbirth+" "+Constants.START_DATE_TIME_FORMAT) :"",
						modified   			: Helper.getUtcDate()
					},
					$setOnInsert : {
						slug 				: slug,
						email 				: email,
						user_role_id		: Constants.CUSTOMER,
						phone_country_code 	: Constants.DEFAULT_COUNTRY_CODE,
						mobile_number 		: mobileNumber,
						user_type			: Constants.USER_TYPE_OTHER,
						referral_details		: {
							referral_code 		: userReferralCode,
							referrer_user_code 	: referralCode,
							referred_by 		: referredUserId,
						},
						active 				: Constants.ACTIVE,
						is_verified 		: Constants.VERIFIED,
						is_email_verified	: Constants.VERIFIED,
						is_mobile_verified	: Constants.VERIFIED,
						is_deleted 			: Constants.NOT_DELETED,
						created_by			: new ObjectId(authId),
						created 			: Helper.getUtcDate(),
					}
				};
				if(password) updateData["$set"]['password']	=	newPassword;


				/** Save / update user data */
				let  qryResult = await this.collectionDb.updateOne({_id : customerId},updateData,{upsert: true});

				let userId 	= qryResult?.upsertedId?._id || customerId;
				if(receiveNewsletter){
					let currentTime	= 	Helper.currentTimeStamp();
					let encId		=	crypto.createHash("md5").update(currentTime+email).digest("hex");

					/** Save newsletter subscribers data **/
					const newsletter_subscribers = this.db.collection(Tables.NEWSLETTER_SUBSCRIBERS);
					await newsletter_subscribers.insertOne({
						email 			: 	email,
						status 			:  	Constants.ACTIVE,
						user_id 		: 	new ObjectId(userId),
						enc_id			:	encId,
						is_subscribe	:	Constants.SUBSCRIBED,
						modified 		: 	Helper.getUtcDate(),
						created 		: 	Helper.getUtcDate()
					});
				}

				if(!isEditable){
					let refereeEnable	= res.locals.settings["Rewards_and_referrals.enable_referee_amount"];
					let refereeAmount	= res.locals.settings["Rewards_and_referrals.referee_amount"];
					let referralEnable	= res.locals.settings["Rewards_and_referrals.enable_referral_amount"];
					let referralAmount	= res.locals.settings["Rewards_and_referrals.referral_amount"];

					if(refereeEnable && referralCode){
						Helper.updateUserRewardPoints(req,res,next,{
							user_id			:	userId,
							reward_type		:	Constants.REGISTRATION_REWARD,
							points			:	parseFloat(refereeAmount),
							additional_info	:	{
								referrer_user_code 	: req.body.referral_code,
								referred_by 		: referredUserId,
							}
						}).then(()=>{});
					}
					if(referralEnable && referralCode){
						Helper.updateUserRewardPoints(req,res,next,{
							user_id			:	referredUserId,
							reward_type		:	Constants.REGISTRATION_REWARD,
							points			:	parseFloat(referralAmount),
							additional_info	:	{
								referee_user_id : userId,
							}
						}).then(()=>{});
					}

					if(!isEditable){
						/*************** Send mail  ***************/
						sendMailToUsers(req,res,{
							event_type 			:	Constants.NOTIFICATION_CUSTOMER_REGISTER,
							customer_fullname	: 	fullName,
							customer_email		: 	email,
							customer_password	: 	password,
						});
						/*************** Send mail  ***************/
					}
				}

				if(isEditable){
					/** Update user details in orders */
					Helper.updateUserDetailsInOrders(req,res,next,{user_id: userId }).then(()=>{});
				}

				/** Save system logs */
				saveSystemLogs(req, res, {
					user_id				: authId,
					parent_id			: userId,
					activity_module		: Constants.SYSTEM_LOG_MODULE_CUSTOMER_MANAGEMENT,
					activity_type		: Constants.ACTIVITY_TYPE_ADD_EDIT,
					additional_details	: {}
				}).then(()=>{ });

				/** Send success response **/
				let message = (isEditable) ? res.__("admin.user_management.customer_updated_successfully") :res.__("admin.user_management.customer_has_been_added_successfully");
				req.flash(Constants.STATUS_SUCCESS,message);
				res.send({
					status		: Constants.STATUS_SUCCESS,
					redirect_url: Constants.WEBSITE_ADMIN_URL+"user_management/list_customer",
				});
			});
		}else{
			let response = {};
			if(isEditable){
				response  =	await this.getCustomerDetails(req, res,next);

				/** Send error response **/
				if(response.status != Constants.STATUS_SUCCESS){
					req.flash(Constants.STATUS_ERROR,response.message);
					return res.redirect(Constants.WEBSITE_ADMIN_URL+"user_management/list_customer");
				}
			}

			/** Render add edit page  **/
			let breadcrumbs = (isEditable) ?  'admin/user_management/edit_customer' :'admin/user_management/add_customer';
			req.breadcrumbs(BREADCRUMBS[breadcrumbs]);
			res.render('add_customer',{
				result		  : response.result,
				is_editable   : isEditable
			});
		}
	};//End addEditCustomer()

	/**
	 * Function for delete customer
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return null
	 */
	async deleteCustomer (req, res, next) {
		try{
			/** Delete customer*/
			await this.collectionDb.updateOne({
				_id 		: new ObjectId(req.params.id),
			},
			{$set : {
				is_deleted 	: Constants.DELETED,
				deleted_at	: Helper.getUtcDate(),
				modified	: Helper.getUtcDate(),
				deleted_by 	: new ObjectId(req.session.user._id)
			}});

			/** Send success response **/
			req.flash(Constants.STATUS_SUCCESS,res.__("admin.user_management.customer_deleted_successfully"));
			res.redirect(Constants.WEBSITE_ADMIN_URL+"user_management/list_customer");

			/** Save system logs */
			saveSystemLogs(req, res, {
				user_id				: req.session.user._id,
				parent_id			: req.params.id,
				activity_module		: Constants.SYSTEM_LOG_MODULE_CUSTOMER_MANAGEMENT,
				activity_type		: Constants.ACTIVITY_TYPE_DELETE,
				additional_details	: {}
			}).then(()=>{ });
		}catch(err){
			next(err);
		}
	};//End deleteCustomer()

	/**
	 * Function for view customer
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render
	 */
	async viewCustomerDetails (req, res, next){
		/** Render view page*/
		req.breadcrumbs(BREADCRUMBS['admin/user_management/view_customer']);
		res.render('view_customer',{
			type	: 	req.params.type,
			user_id : 	req.params.id,
		});
	};//End viewCustomerDetails()

	/**
	 * Function for view customer details
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render
	 */
	async customerDetails (req, res, next){
		try{
			/** Get Customer details **/
			let response = await this.getCustomerDetails(req, res, next);

			/** Send error response **/
			if(response.status != Constants.STATUS_SUCCESS){
				req.flash(Constants.STATUS_ERROR,response.message);
				return res.redirect(Constants.WEBSITE_ADMIN_URL+"user_management/list_customer");
			}

			/** Render details page */
			res.render('customer_details',{
				layout:false,
				result: response.result
			});
		}catch(err){
			next(err);
		}
	};//End customerDetails()

	/**
	 * Function for get customer order list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render
	 */
	async getCustomerOrderList (req, res, next){
		let userId	= req?.params?.id || '';
		if(Helper.isPost(req)){
			let fromDate 	= 	(req.body.fromDate) ? req.body.fromDate : "";
			let toDate 		= 	(req.body.toDate)   ? req.body.toDate 	: "";
			let limit 		= 	(req.body.length) ? parseInt(req.body.length)	: Constants.ADMIN_LISTING_LIMIT;
			let skip 		=	(req.body.start)	? parseInt(req.body.start)	: Constants.DEFAULT_SKIP;
			let authRoleId	=	(req.session.user.user_role_id)	? req.session.user.user_role_id :"";
			let teamHead	= 	req.session.user.team_head	? req.session.user.team_head 	:false;
			const collection= this.db.collection(Tables.ORDERS);

			/** Configure Datatable conditions*/
			const dataTableConfig = await Helper.configDatatable(req, res, null);

			let commonConditions = {customer_id: new ObjectId(userId)};
			if(authRoleId == Constants.CALL_CENTER_TEAM && !teamHead){
				let taskAssignments 	=	await Helper.getConditionsBasedOnCallCenterRole(req,res,next);
				let businessConditions 	=	taskAssignments?.conditions || [];

				if(businessConditions?.length){
					businessConditions.push({delivery_type : Constants.DELIVERY_BY_PICK_UP});
					commonConditions["$or"] = businessConditions;
				}else{
					/** Send response **/
					return res.send({
						status			: Constants.STATUS_SUCCESS,
						draw			: dataTableConfig.result_draw,
						data			: [],
						recordsFiltered	: 0,
						recordsTotal	: 0,
					});
				}
			}

			/** Conditions for order date */
			let dateConditions = {};
			if (fromDate != "" && toDate != "") {
				dateConditions["order_date"] = {
					$gte 	: Helper.newDate(fromDate),
					$lte 	: Helper.newDate(toDate),
				};
			}

			dataTableConfig.conditions = Object.assign(dateConditions, commonConditions, dataTableConfig.conditions);

			// Get list or count of orders with aggregation
			let dbRes = await collection.aggregate([
				{$match: dataTableConfig.conditions },
				{$facet : {
					list : [
						{$sort  : dataTableConfig.sort_conditions},
						{$skip 	: skip},
						{$limit : limit},
						{$lookup: {	/** Get order details **/
							from 		:	Tables.ORDER_DETAILS,
							localField  :	"_id",
							foreignField:	"order_id",
							as 		  	:	"order_details"
						}},
						{$project : {
							_id:1,customer_id:1,restaurant_id:1,is_confirm:1,invoice_number:1,unique_order_id:1,order_date:1,last_status_updated_on:1,restaurant_name:1,order_price:1,admin_status:1,net_amount:1,is_modified:1,delivery_type:1,payment_method:1, customer_latitude: {$arrayElemAt: ["$order_details.customer_latitude",0]}, customer_longitude: {$arrayElemAt: ["$order_details.customer_longitude",0]}, delivery_duration: {$arrayElemAt: ["$order_details.delivery_duration",0]},amount_debited_by_wallet:1,
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
			/**Get dropdown list **/
			let dropDownResponse = await Helper.getDropdownList(req,res, next,{
				collections :[
					{
						collection : Tables.RESTAURANTS,
						columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
						conditions : {
							status		: Constants.ACTIVE,
							is_deleted	: Constants.NOT_DELETED
						},
					}
				],
			});

			/** Send error response **/
			if(dropDownResponse.status != Constants.STATUS_SUCCESS) return res.status(400).send(dropDownResponse);

			res.render('customer_order_list',{
				layout			: false,
				user_id			: userId,
				from_date 		: req?.query?.from_date || "",
				to_date 		: req?.query?.to_date || "",
				restaurant_list	: dropDownResponse.final_html_data["0"],
			});
		}
	};//End getCustomerOrderList()

	/**
	 * Function for get customer address list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render
	 */
	async getCustomerAddressList (req, res, next){
		let userId	=	(req.params.id) ? req.params.id : '';

		if(Helper.isPost(req)){
			let limit			= 	(req.body.length)	? parseInt(req.body.length)	: Constants.ADMIN_LISTING_LIMIT;
			let skip			= 	(req.body.start) 	? parseInt(req.body.start)	: Constants.DEFAULT_SKIP;
			const collection	= 	this.db.collection(Tables.CUSTOMER_ADDRESSES);

			/** Configure Datatable conditions*/
			const dataTableConfig = await Helper.configDatatable(req, res, null);

			let commonConditions = {user_id: new ObjectId(userId)};
			dataTableConfig.conditions = Object.assign(commonConditions, dataTableConfig.conditions);

			// Get list or count of address with aggregation
			let dbRes = await collection.aggregate([
				{$match: dataTableConfig.conditions },
				{$facet : {
					list : [
						{$sort  : dataTableConfig.sort_conditions},
						{$skip 	: skip},
						{$limit : limit},
						{$lookup: {	/** Get city details **/
							from 		:	Tables.CITIES,
							localField  :	"city_id",
							foreignField:	"_id",
							as 		  	:	"city_details"
						}},
						{$lookup: {	/** Get area details **/
							from 		:	Tables.AREAS,
							localField  :	"area_id",
							foreignField:	"_id",
							as 		  	:	"area_details"
						}},
						{$lookup: {	/** Get block details **/
							from 		:	Tables.AREA_BLOCKS,
							localField  :	"block_id",
							foreignField:	"_id",
							as 		  	:	"block_details"
						}},
						{$project : {
							city_id : 1,area_id : 1, block_id : 1, street : 1, address_type:1,
							city_name:	{$arrayElemAt: ["$city_details.name",0]},
							block_name:	{$arrayElemAt: ["$block_details.name",0]},
							area_name:	{$arrayElemAt: ["$area_details.name",0]},
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
			/** Render address list page */
			res.render('customer_address_list',{
				layout  : false,
				user_id : userId,
			});
		}
	};//End getCustomerAddressList()

	/**
	 * Function for get packages list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render
	 */
	async getPackagesList (req, res, next){
		let userId	=	(req.params.id) ? req.params.id : '';

		if(Helper.isPost(req)){
			let limit			= 	(req.body.length)	? parseInt(req.body.length)	: Constants.ADMIN_LISTING_LIMIT;
			let skip			= 	(req.body.start) 	? parseInt(req.body.start)	: Constants.DEFAULT_SKIP;
			const collection	= 	this.db.collection(Tables.PACKAGE_PURCHASES);

			/** Configure Datatable conditions*/
			const dataTableConfig = await Helper.configDatatable(req, res, null);

			let commonConditions = {user_id: new ObjectId(userId)};
			dataTableConfig.conditions = Object.assign(dataTableConfig.conditions,commonConditions);

			// Get list or count of packages with aggregation
			let dbRes = await collection.aggregate([
				{$match: dataTableConfig.conditions },
				{$facet : {
					list : [
						{$sort  : dataTableConfig.sort_conditions},
						{$skip 	: skip},
						{$limit : limit},
						{$lookup : {
							from 		 : Tables.PACKAGES,
							localField 	 : "package_id",
							foreignField : "_id",
							as 			 : "package_details"
						}},
						{$lookup : {
							from 		 : Tables.USERS,
							localField 	 : "friend_id",
							foreignField : "_id",
							as 			 : "user_details"
						}},
						{$project : {
							_id:1,amount:1,valid_till:1,number_of_orders:1,friend_id:1,
							package_name: {$arrayElemAt : ["$package_details.title",0]},
							friend_name: {$arrayElemAt : ["$user_details.full_name",0]}
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
			/** Render package list page */
			res.render('package_purchased',{
				layout  : false,
				user_id : userId,
			});
		}
	};//End getPackagesList()

	/**
	 * Function for get refund list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render
	 */
	async getRefundList (req, res, next){
		let userId	=	(req.params.id) ? req.params.id : '';

		if(Helper.isPost(req)){
			let limit			= 	(req.body.length)	? parseInt(req.body.length)	: Constants.ADMIN_LISTING_LIMIT;
			let skip			= 	(req.body.start) 	? parseInt(req.body.start)	: Constants.DEFAULT_SKIP;
			let walletType		= 	(req.body.wallet_type) ? req.body.wallet_type	: "";
			const collection	= 	this.db.collection(Tables.PAYMENT_REFUND_LOGS);

			/** Configure Datatable conditions*/
			const dataTableConfig = await Helper.configDatatable(req, res, null);

			let commonConditions = {
				user_id : new ObjectId(userId),
				payment_type : Constants.ORDER_REFUND_PAYMENT
			};

			if(walletType){
				if(walletType == Constants.REFUND_AMOUNT){
					dataTableConfig.conditions["$or"] = [
						{wallet_type : {$exists: false}},
						{wallet_type : walletType},
					];
				}else{
					dataTableConfig.conditions.wallet_type = walletType;
				}
			}

			dataTableConfig.conditions = Object.assign(commonConditions, dataTableConfig.conditions);

			// Get list or count of refund with aggregation
			let dbRes = await collection.aggregate([
				{$match: dataTableConfig.conditions },
				{$facet : {
					list : [
						{$sort  : dataTableConfig.sort_conditions},
						{$skip 	: skip},
						{$limit : limit},
						{$project : {
							order_id:1,unique_order_id : 1, total_amount : 1,payment_detail : 1, status : 1, created : 1, refunded_on:1, wallet_type: 1
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
			/** Render refund list page */
			res.render('refund_list',{
				layout  : false,
				user_id : userId,
			});
		}
	};//End getRefundList()

	/**
	 * Function for update active/ deactive status
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return null
	 */
	async updateCustomerStatus  (req, res, next){
		try{
			let userId = (req.params.id) ? req.params.id : "";
			let status = (req.params.status==Constants.ACTIVE) ? Constants.DEACTIVE : Constants.ACTIVE;
			let action = (req.params.status==Constants.ACTIVE) ? Constants.RECLAIM_LOGS_DEACTIVE_ACTION : Constants.RECLAIM_LOGS_ACTIVE_ACTION;

			await this.collectionDb.updateOne({
				_id : new ObjectId(userId),
			},
			{$set : {
				active	 : status,
				modified : Helper.getUtcDate()
			}});

			/** Save system logs */
			saveSystemLogs(req, res, {
				user_id				: req.session.user._id,
				parent_id			: userId,
				activity_module		: Constants.SYSTEM_LOG_MODULE_CUSTOMER_MANAGEMENT,
				activity_type		: Constants.ACTIVITY_TYPE_STATUS_UPDATE,
				additional_details	: {}
			}).then(()=>{ });

			/** Save reclaim logs */
			saveReclaimLogs(req, res, {
				action_taken_by		: req.session.user._id,
				user_id				: userId,
				action				: action,
				channel				: req.session.user.channel_id,
			}).then(()=>{ });

			/** Send success response **/
			req.flash(Constants.STATUS_SUCCESS,res.__("admin.user_management.customer_status_updated_successfully"));
			res.redirect(Constants.WEBSITE_ADMIN_URL+'user_management/list_customer');
		}catch(err){
			next(err);
		}
	};// end updateCustomerStatus()

	/**
	 * Function to get customer detail
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	async getCustomerDetails (req, res, next){
		try{
			let userId = new ObjectId(req.params.id);

			/** Get customer details **/
			let result = await this.collectionDb.aggregate([
				{$match:{ _id: userId}},
				{'$lookup': {
					'from'        : Tables.USERS,
					'localField'  : "referral_details.referred_by",
					'foreignField': "_id",
					'as'          : "user_detail",
				}},
				{$addFields: {
					referral_name: {$arrayElemAt: ["$user_detail.full_name", 0] }
				}},
				{$project: {
					user_detail: 0
				}},
			]). toArray();

			/** Send error response */
			if(!result?.length) return {status : Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") };

			/** Send success response */
			return {
				status	: Constants.STATUS_SUCCESS,
				result	: result[0]
			};
		}catch(err){
			next(err);
		}
	};// End getCustomerDetails()

	/**
	 * Function for assign category to customer
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async assignCategoryToCustomer(req, res, next){
		try{
			let userId	= (req.params.id) ? new ObjectId(req.params.id) :"";
			if(Helper.isPost(req)){

				/** Update details **/
				await this.collectionDb.updateOne({
					_id : userId
				},
				{$set : {
					client_type : req.body.category,
					modified    : Helper.getUtcDate()
				}});

				/*send success response */
				res.send({status : Constants.STATUS_SUCCESS, message: res.__("admin.user_management.category_has_been_assigned_successfully")});
			}else{
				/** Get customer details **/
				let result = await this.collectionDb.findOne({ _id: userId },{projection : { client_type:1}});

				/** Send error response */
				if(!result) return res.status(400).send({status  : Constants.STATUS_ERROR,message : res.__("admin.system.invalid_access")});

				/** Render assign category view */
				res.render('assign_category',{
					layout		  : false,
					user_id		  : userId,
					client_type   : result.client_type
				});
			}
		}catch(err){
			next(err);
		}
	};//End assignCategoryToCustomer()

	/**
	 * Function for update black list status
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async updateBlackListStatus (req, res, next){
		try{
			let isBlackList	= (req.params.status == Constants.BLACKLISTED) ? false : true;

			/** Update black list status **/
			await this.collectionDb.updateOne({
				_id : new ObjectId(req.params.id)
			},
			{$set : {
				is_black_list : isBlackList,
				modified	  : Helper.getUtcDate()
			}});

			/** Send success response **/
			let message = (isBlackList == true) ? res.__("admin.user_management.user_has_been_added_in_blacklist_successfully") : res.__("admin.user_management.user_has_been_removed_from_blacklist_successfully");
			req.flash(Constants.STATUS_SUCCESS,message);
			res.redirect(Constants.WEBSITE_ADMIN_URL+"user_management/list_customer");
		}catch(err){
			next(err);
		}
	};//End updateBlackListStatus()

	/**
	 * Function for get customer account list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render
	 */
	async getCustomerAccountList (req, res, next){
		let userId	=	(req.params.id) ? req.params.id : '';

		if(Helper.isPost(req)){
			let limit			= 	(req.body.length)	? parseInt(req.body.length)	: Constants.ADMIN_LISTING_LIMIT;
			let skip			= 	(req.body.start) 	? parseInt(req.body.start)	: Constants.DEFAULT_SKIP;
			const collection	= 	this.db.collection(Tables.USER_ACCOUNTS_LOGS);

			/** Configure Datatable conditions*/
			const dataTableConfig = await Helper.configDatatable(req, res, null);

			let commonConditions = {
				user_id : new ObjectId(userId),
				$and 	: [{ action : {$in :[
					Constants.RECLAIM_LOGS_ACTIVE_ACTION,
					Constants.RECLAIM_LOGS_DEACTIVE_ACTION,
					Constants.RECLAIM_LOGS_RECLAIM_ACTION,
					Constants.RECLAIM_LOGS_REGISTRATION
				]} }]
			};

			dataTableConfig.conditions = Object.assign(commonConditions, dataTableConfig.conditions);

			// Get list or count of account logs with aggregation
			let dbRes = await collection.aggregate([
				{$match: dataTableConfig.conditions },
				{$facet : {
					list : [
						{$sort  : dataTableConfig.sort_conditions},
						{$skip 	: skip},
						{$limit : limit},
						{$lookup : {
							from 		 : Tables.USERS,
							localField 	 : "action_taken_by",
							foreignField : "_id",
							as 			 : "user_details"
						}},
						{$project : {
							_id:1,action:1,channel:1,created:1,action_taken_by: {$arrayElemAt : ["$user_details.full_name",0]}
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
			/** Render account list page */
			res.render('customer_account_list',{
				layout  : false,
				user_id : userId,
			});
		}
	};//End getCustomerAccountList()

	/**
	 * Function for view customer wallet details
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render
	 */
	async customerWalletDetails (req, res, next){
		try{
			/**  All queries in parallel using object keys */
			const response = await Helper.runTaskParallel({
				wallet_details:
					Helper.getWalletBalance(req, res, next,{user_id:req.params.id}).then(findResult=> findResult || {}),
				customer_details:
					this.collectionDb.findOne({_id: new ObjectId(req.params.id)},{projection : { is_guest : 1}}).then(result=> result)
			});

			/** Render details page */
			res.render('customer_wallet_details',{
				layout		: false,
				customer_id : req.params.id,
				result		: response.wallet_details,
				customer_detail : response.customer_details
			});
		}catch(err){
			next(err);
		}
	};//End customerWalletDetails()

	/**
	 * Function for get customer wallet transaction/ reward points list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render
	 */
	async getCustomerWalletTransactionAndRewardPointsList (req, res, next){
		let userId		= (req.params.id)   ? req.params.id 	: '';
		let walletType  = (req.params.type) ? req.params.type   : "";

		if(Helper.isPost(req)){
			let limit			= 	(req.body.length)	? parseInt(req.body.length)	: Constants.ADMIN_LISTING_LIMIT;
			let skip			= 	(req.body.start) 	? parseInt(req.body.start)	: Constants.DEFAULT_SKIP;
			const collection	= 	this.db.collection(Tables.USER_WALLET_LOGS);

			/** Configure Datatable conditions*/
			const dataTableConfig = await Helper.configDatatable(req, res, null);

			let commonConditions = {
				$and :[
					{wallet_type : {$ne : Constants.POINTS_AMOUNT}},
					{user_id 	 : new ObjectId(userId)}
				]
			};

			/** Set condition if type is points amount **/
			if(walletType) commonConditions["$and"] = [{wallet_type : walletType},{user_id 	 : new ObjectId(userId)}];

			dataTableConfig.conditions = Object.assign(dataTableConfig.conditions,commonConditions);

			// Get list or count of transaction/ reward points with aggregation
			let dbRes = await collection.aggregate([
				{$match: dataTableConfig.conditions },
				{$facet : {
					list : [
						{$sort  : dataTableConfig.sort_conditions},
						{$skip 	: skip},
						{$limit : limit},
						{$project : {
							_id : 1,transaction_id : 1,transaction_type : 1,wallet_type : 1,amount : 1,remaining_amount:1,created:1
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
			/** Render customer wallet transaction / reward points list page */
			res.render('customer_wallet_transaction_and_reward_points_list',{
				layout  	: false,
				user_id 	: userId,
				wallet_type : walletType
			});
		}
	};//End getCustomerWalletTransactionAndRewardPointsList()

	/**
	 * Function for get customer verification list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render
	 */
	async getCustomerVerificationList (req, res, next){
		let userId	=	req.params.id;

		if(Helper.isPost(req)){
			let limit			= 	(req.body.length)	? parseInt(req.body.length)	: Constants.ADMIN_LISTING_LIMIT;
			let skip			= 	(req.body.start) 	? parseInt(req.body.start)	: Constants.DEFAULT_SKIP;
			const collection	= 	this.db.collection(Tables.USER_ACCOUNTS_LOGS);

			/** Configure Datatable conditions*/
			const dataTableConfig = await Helper.configDatatable(req, res, null);

			let commonConditions = {
				user_id : new ObjectId(userId),
				$and	: [{ action: {$in :[Constants.RECLAIM_LOGS_VERIFY_MOBILE_ACTION,Constants.RECLAIM_LOGS_VERIFY_EMAIL_ACTION]} }]
			};

			dataTableConfig.conditions = Object.assign(dataTableConfig.conditions,commonConditions);

			// Get list or count of account logs with aggregation
			let dbRes = await collection.aggregate([
				{$match: dataTableConfig.conditions },
				{$facet : {
					list : [
						{$sort  : dataTableConfig.sort_conditions},
						{$skip 	: skip},
						{$limit : limit},
						{$lookup : {
							from 		 : Tables.USERS,
							localField 	 : "verified_by",
							foreignField : "_id",
							as 			 : "verified_by_details"
						}},
						{$project : {
							_id:1,action:1,channel:1,created:1,retry_count:1,function:1,status:1,sender :1,reset_tries: 1,verification_type : 1, otp:1,expiry_date : 1,
							verified_by_name: {$arrayElemAt : ["$verified_by_details.full_name",0]},
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
				data : dbRes?.[0]?.list ||[],
				recordsTotal : dbRes?.[0]?.count?.[0]?.count || 0,
				recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0,
			});
		}else{
			/** Render verification list page */
			res.render('customer_verification_list',{
				layout  : false,
				user_id : userId,
			});
		}
	};//End getCustomerVerificationList()

	/**
	 * Function to get list of items
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	async driverLocationList (req, res, next){
		try{
			let userId =	(req.params.id) ? new ObjectId(req.params.id) : '';
			let dateForm =	(req.body.date_from) ? req.body.date_from : "";
			let dateTo =	(req.body.date_to) ? req.body.date_to : "";

			if(!userId) {
				req.flash(Constants.STATUS_ERROR,res.__("admin.system.invalid_access"));
				return res.redirect(Constants.WEBSITE_ADMIN_URL+"orders");
			}

			let commonConditions = {};
			if(dateForm && dateTo) commonConditions["created"] = { $gte: Helper.newDate(dateForm), $lte: Helper.newDate(dateTo)};

			// Get location with aggregation
			const user_locations_logs	= 	this.db.collection(Tables.USER_LOCATIONS_LOGS);
			let dbRes = await user_locations_logs.aggregate([
				{$match: {
					user_id: userId
				}},
				{$facet : {
					list : [
						{$match : commonConditions},
						{$sort  : {_id: Constants.SORT_DESC}},
						{$lookup: {
							from 		 : Tables.USERS,
							localField 	 : "verified_by",
							foreignField : "_id",
							as 			 : "verified_by_details"
						}},
						{$project : {
							_id : 1, user_id : 1,latitude : 1, longitude : 1, long_lat : 1,distance_from_last_location:1,created:1,address:1
						}}
					],
					latest_location: [
						{$sort  : {_id: Constants.SORT_DESC}},
						{$project : {
							_id : 1, user_id : 1,latitude : 1, longitude : 1, long_lat : 1,created:1,address:1
						}}
					],
				}}
			]).toArray();

			/** Send response **/
			res.send({
				status: Constants.STATUS_SUCCESS,
				result : dbRes?.[0]?.list ||[],
				latest_location : dbRes?.[0]?.latest_location?.[0] || null
			});
		}catch(err){
			next(err);
		}
	};//End driverLocationList()

	/**
	 * Function for update multiple driver details
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return void
	 */
	async updateMultipleDriverDetails(req, res, next){
		try{
			let status	 	= 	(req.body.status)		?	req.body.status					:0;
			let driverIds	=	(req.body.driver_ids)	?	req.body.driver_ids.split(",")	:[];

			/** Send error response **/
			if(driverIds.length < 1 || !status){
				return res.send({ status: Constants.STATUS_ERROR, message: res.__("admin.system.something_going_wrong_please_try_again") });
			}

			/** Convert into object ids */
			driverIds = Helper.arrayToObject(driverIds);

			/** Set update data */
			let updateData = {modified: Helper.getUtcDate()};

			let activityType = "";
			if(status == Constants.DRIVER_ACTIVE || status == Constants.DRIVER_DEACTIVE){
				updateData.active = (status == Constants.DRIVER_ACTIVE) ?	Constants.ACTIVE 	:Constants.DEACTIVE;

				activityType = Constants.ACTIVITY_TYPE_STATUS_UPDATE;
			}
			if(status == Constants.DRIVER_DELETE){
				updateData.is_deleted = Constants.DELETED;
				updateData.deleted_at = Helper.getUtcDate();
				updateData.deleted_by = new ObjectId(req.session.user._id);

				activityType = Constants.ACTIVITY_TYPE_DELETE;
			}

			/** Update driver details */
			await this.collectionDb.updateMany({ _id: {$in: driverIds} }, {$set: updateData});

			/* success response*/
			res.send({
				status : Constants.STATUS_SUCCESS,
				message: res.__("admin.user_management.action_performed_message"),
			});

			/** Save system logs */
			driverIds.forEach(tmpDriverId=>{
				let additionalDetails = {};
				if(activityType == Constants.ACTIVITY_TYPE_STATUS_UPDATE){
					additionalDetails.status = (status == Constants.DRIVER_ACTIVE) ?	Constants.ACTIVE 	:Constants.DEACTIVE;
				}

				saveSystemLogs(req, res, {
					user_id				: req.session.user._id,
					parent_id			: tmpDriverId,
					activity_module		: Constants.SYSTEM_LOG_MODULE_DRIVER_MANAGEMENT,
					activity_type		: activityType,
					additional_details	: additionalDetails
				}).then(()=>{ });
			});
		}catch(err){
			next(err);
		}
	};//End updateMultipleDriverDetails()

	/**
	 * Function for add amount in wallet
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
   	async addWalletAmount (req, res, next){
		let authId		= (req.session.user && req.session.user._id)? new ObjectId(req.session.user._id) :"";
		let customerId	= new ObjectId(req.params.id);

		if(Helper.isPost(req)){
			/** Sanitize Data **/
			req.body 	= 	Helper.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let amount 	=	(req.body.amount) ? parseFloat(req.body.amount) : "";

			/** Add amount in wallet */
			Helper.updateWalletBalance(req,res,next,{
				user_id 		 : customerId,
				amount 			 : Helper.round(amount),
				wallet_type  	 : req.body.wallet_type,
				transaction_type : Constants.CREDIT,
				extra_parameters : { added_by : authId, date_time : Helper.getUtcDate()},
			}).then(creditResponse=>{

				let message = creditResponse.message;
				if(creditResponse.status == Constants.STATUS_SUCCESS) message = res.__("admin.user_management.amount_has_been_added_successfully")
				req.flash(creditResponse.status,message);
				res.send({
					status		: Constants.STATUS_SUCCESS,
					redirect_url: Constants.WEBSITE_ADMIN_URL+"user_management/view_customer/"+customerId,
				});

				/*************** Send notification  ***************/
				let notificationMessageParams = [Constants.WALLET_TYPE[req.body.wallet_type],Helper.round(amount)];
				insertNotifications(req,res,{
					notification_data : {
						notification_type 	: Constants.NOTIFICATION_ADD_WALLET_AMOUNT,
						message_params 		: notificationMessageParams,
						parent_table_id 	: customerId,
						user_ids 			: [customerId],
						role_id 			: Constants.CUSTOMER,
						extra_parameters 	: {
							user_ids 		: [customerId],
						}
					}
				}).then(()=>{});
				/*************** Send notification  ***************/
			}).catch(next);
		}else{
			res.render('add_wallet_amount',{
				customer_id : customerId,
				layout		: false
			});
		}
	};//End addWalletAmount()

	/**
	 * Function to verify customer
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	async verifyCustomer(req, res, next){
		/** Sanitize Data **/
		req.body = Helper.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);

		let userId	= new ObjectId(req.params.id);
		let logId	= req.body.log_id;
		let authId	= (req.session.user && req.session.user._id) ? req.session.user._id :"";

		if(!logId) return res.status(400).send({status  : Constants.STATUS_ERROR,message : res.__("admin.system.something_going_wrong_please_try_again")});
		if(req.body.verification_type == Constants.CUSTOMER_VERIFY_BY_CODE){
			if(!req.body.otp) return res.send({status  : Constants.STATUS_ERROR,message : [
				{'param':'otp','msg': res.__("admin.user_management.please_enter_code") }
			]});
		}

		const user_accounts_logs = this.db.collection(Tables.USER_ACCOUNTS_LOGS);
		asyncParallel({
			user_details : (callback)=>{
				this.collectionDb.findOne({_id : userId},{projection : {is_verified : 1,is_mobile_verified : 1,is_email_verified : 1,mobile_number:1}}).then(result=>{
					callback(null,result);
				}).catch(err=>{ callback(err,null) });
			},
			log_details : (callback)=>{
				user_accounts_logs.findOne({_id : new ObjectId(logId)},{projection : {action :1,otp: 1}}).then(result=>{
					callback(null,result);
				}).catch(err=>{ callback(err,null) });
			},
		},async (asyncErr,response)=>{
			if(asyncErr) return next(asyncErr);

			if(!response.user_details || !response.log_details) return res.status(400).send({status: Constants.STATUS_ERROR,message: res.__("admin.system.something_going_wrong_please_try_again")});

			if(req.body.verification_type == Constants.CUSTOMER_VERIFY_BY_CODE && req.body.otp != response.log_details.otp){
				return res.send({status	: Constants.STATUS_ERROR, message: [{param : "otp",msg : res.__("admin.user_management.entered_wrong_code")}]});
			}

			let mobileOTP = await Helper.getRandomOTP();
			asyncParallel({
				send_sms : (childCallback)=>{
					if(req.body.verification_type != Constants.CUSTOMER_REGENERATE_VERIFY_CODE) return childCallback(null,null);

					let mobileNumber	= response.user_details.mobile_number;
					let countryCode		= Constants.DEFAULT_COUNTRY_CODE;

					/** To allow testing mobile numbers for send OTP*/
					let testingMobiles = (res.locals.settings['Site.testing_mobile_numbers']) ? res.locals.settings['Site.testing_mobile_numbers'].split(",") : [];
					if(testingMobiles.indexOf(mobileNumber) !== -1) countryCode = Constants.INDIA_COUNTRY_CODE;
					mobileNumber = countryCode + mobileNumber;

					/**Send sms **/
					sendSMS(req,res,{
						sms_type        :   Constants.SMS_TEMPLATE_FOR_RESEND_OTP,
						user_id         :   userId,
						mobile_number   :   mobileNumber,
						message_params  :   [mobileOTP],
					}).then(()=>{});
					/**************** Send otp for verify *******************/

					childCallback(null,null);
				},
				update_user : (childCallback)=>{
					let updateData =  {
						is_email_verified 	: Constants.VERIFIED,
						is_mobile_verified	: Constants.VERIFIED,
						is_verified 		: Constants.VERIFIED,
						modified			: Helper.getUtcDate()
					};

					if(req.body.verification_type == Constants.CUSTOMER_REGENERATE_VERIFY_CODE){
						updateData =  {
							otp 		: mobileOTP,
							modified	: Helper.getUtcDate()
						};
					}

					this.collectionDb.updateOne({_id : userId },{$set : updateData}).then(()=>{
						childCallback(null,null);
					}).catch(err=>{ childCallback(err,null) });
				},
				update_log : (childCallback)=>{
					let updateData =  {
						verification_type	: req.body.verification_type,
						verified_by			: new ObjectId(authId),
						status 				: Constants.VERIFIED,
						modified			: Helper.getUtcDate()
					};

					if(req.body.verification_type == Constants.CUSTOMER_REGENERATE_VERIFY_CODE){
						updateData =  {
							otp 				: mobileOTP,
							expiry_date    		: Helper.getUtcDate(Helper.addDate(Constants.VERIFY_EXPIRE_DAY*Constants.HOURS_IN_A_DAY)),
							verification_type	: req.body.verification_type,
							modified			: Helper.getUtcDate()
						};
					}

					user_accounts_logs.updateOne({_id : new ObjectId(logId) },{$set : updateData}).then(()=>{
						childCallback(null,null);
					}).catch(err=>{ childCallback(err,null) });
				},
			},(updateErr)=>{
				if(updateErr) return next(updateErr);

				/** Send success response **/
				let message = res.__("admin.user_management.user_has_been_verified_successfully");
				if(req.body.verification_type == Constants.CUSTOMER_REGENERATE_VERIFY_CODE){
					message = res.__("admin.user_management.otp_has_been_sent_successfully");
				}
				req.flash(Constants.STATUS_SUCCESS,message);
				res.send({
					status : Constants.STATUS_SUCCESS,
					message : message,
					redirect_url : Constants.WEBSITE_ADMIN_URL+"user_management/view_customer/"+userId+"/verification_list"
				});
			});
		});
	};//End verifyCustomer()

	/**
	 * Function to load map to show in address
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return null
	 */
	async loadMap (req, res, next) {
		res.render('load_map',{
			layout : false
		})
	};//End loadMap()
}