import clone from 'clone';
import { ObjectId } from 'mongodb';
import { parallel as asyncParallel } from 'async';
import BREADCRUMBS from "../../../../breadcrumbs.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { getUtcDate, arrayToObject,isPost, userModuleFlagAction, sanitizeData, moveUploadedFile, applyValidationInterCallFunction} from "../../../../utils/index.mjs";
import { sendMailToUsers} from "../../../../services/index.mjs";
import myAccountModel from '../../api/model/my_account.mjs';
import registrationModel from '../../api/model/registration.mjs';
import customerDriverRegistrationModel from '../../api/model/customer_driver_registration.mjs';

import { restaurantEditProfileValidation, subAdminEditProfileValidation } from '../validations.mjs';

class User {
    constructor(db){
        this.db = db;
        this.myAccountAPI      =   new myAccountModel(db);
        this.registrationAPI   =   new registrationModel(db);
        this.customerDriverRegistrationAPI = new customerDriverRegistrationModel(db);
    }

    /**
	 * Function for login user
	 *
	 * @param req 	As 	Request Data
	 * @param res 	As 	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return json
	 */
	async login(req,res,next){
        try{
            if(isPost(req)){
                let response = await this.registrationAPI.login(req, res,next);

                /** If login failed, return error response **/
                if(response.status != Constants.STATUS_SUCCESS) return res.send(response);

                /** Send success response **/
                let redirectUrl = Constants.WEBSITE_URL+"dashboard";
                if(response?.is_verified === Constants.NOT_VERIFIED && response?.validate_string){
                    redirectUrl = Constants.WEBSITE_URL+"verify_account/"+response.validate_string;
                }else{
                    /** Set User Session **/
                    let userData  = response?.result || {};
                    if(userData.password) delete userData.password;
                    req.session.user = {...userData, channel_id : Constants.CHANNEL_MERCHANT};
                }

                setTimeout(()=>{
                    req.flash(Constants.STATUS_SUCCESS,response.message);
                    res.send({status: Constants.STATUS_SUCCESS, redirect_url: redirectUrl});
                },1000);
            }else{
                /** Render to login page **/
                res.render("login",{csrf_token : req?.csrfTokenValue || "" });
            }
        }catch(error){
            next(error);
        }
	};//End login()

    /**
	 * Function for forgot password
	 *
	 * @param req 	As 	Request Data
	 * @param res 	As 	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return json
	 */
	async forgotPassword(req,res,next){
        try{
            if(isPost(req)){
                let response = await this.registrationAPI.forgotPassword(req, res,next);
                if(response.status != Constants.STATUS_SUCCESS) return res.send(response);

                if(!response.forgot_validate_string) return res.send({status : Constants.STATUS_ERROR, message : res.__("system.something_going_wrong_please_try_again")});

                /** Send success response **/
                req.flash(Constants.STATUS_SUCCESS,response.message);
                res.send({
                    status 		 : Constants.STATUS_SUCCESS,
                    redirect_url : Constants.WEBSITE_URL+"verify_otp/forgot_password/"+response.forgot_validate_string+"/"+response.otp_type
                });
            }else{
                /** Render to forgot password  page **/
                res.render("forgot_password",{csrf_token : req?.csrfTokenValue || ""});
            }
        }catch(error){
            next(error);
        }
	};//End forgotPassword()

    /**
	 * Function for verify otp
	 *
	 * @param req 	As 	Request Data
	 * @param res 	As 	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return json
	 */
	async verifyOtp(req,res,next){
        try{
            let page 			= req.params.page || "";
            let validateString 	= req.params.validate_string || "";
            let otpType			= req.params.otp_type || "";
            if(page != "forgot_password"){
                /** Send error response **/
                req.flash(Constants.STATUS_ERROR,res.__("user.link_expired_or_wrong_link"));
                return res.redirect(Constants.WEBSITE_URL+"login");
            }

            if(isPost(req)){
                req.body.page 				= page;
                req.body.validate_string	= validateString;

                let response = await this.registrationAPI.verifyOTP(req, res,next);

                /** If verify otp failed, send error response **/
                if(response.status != Constants.STATUS_SUCCESS) return res.send(response);

                if(!response.forgot_validate_string) return res.send({status : Constants.STATUS_ERROR, message : res.__("system.something_going_wrong_please_try_again")});

                /** Set redirect url **/
                let redirectUrl =  Constants.WEBSITE_URL+"login";
                if(page	== "forgot_password"){
                    redirectUrl = Constants.WEBSITE_URL+"reset_password/"+response.forgot_validate_string;
                }

                /** Send success response **/
                if(response.message) req.flash(Constants.STATUS_SUCCESS,response.message);
                res.send({status: Constants.STATUS_SUCCESS,redirect_url : redirectUrl});
            }else{
                /** Set conditions **/
                let conditions =  clone(Constants.FRONT_USER_COMMON_CONDITIONS);
                if(page == "forgot_password"){
                    conditions.forgot_validate_string = validateString;
                }

                /** Get user details **/
                const users = this.db.collection(Tables.USERS);
                let result = await users.findOne(conditions,{projection: {_id :1}});

                /** If user not found, send error response **/
                if(!result){
                    req.flash(Constants.STATUS_ERROR,res.__("user.link_expired_or_wrong_link"));
                    return res.redirect(Constants.WEBSITE_URL+"login");
                }

                /** render to verify otp page **/
                res.render("verify_otp",{
                    page 			: page,
                    validate_string : validateString,
                    otp_type		: otpType,
                    csrf_token 		: req?.csrfTokenValue || ""
                });
            }
        }catch(error){
            next(error);
        }
	};//End verifyOtp()

    /**
	 * Function for resend otp
	 *
	 * @param req 	As 	Request Data
	 * @param res 	As 	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return json
	 */
	async resendOTP(req,res,next){
		try{
			req.body.type = req.params.type || "";
			let response = await this.registrationAPI.resendOtp(req, res,next);

            /**Set flash and send success response */
			if(response.status == Constants.STATUS_SUCCESS) req.flash(Constants.STATUS_SUCCESS,response.message);
			res.send(response);
		}catch(error){
			next(error);
		}
	}//End resendOTP()

    /**
	 * Function for reset password
	 *
	 * @param req 	As 	Request Data
	 * @param res 	As 	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return json
	 */
	async resetPassword(req,res,next){
        try{
            let validateString	= req.params.validate_string || "";
            if(isPost(req)){
                req.body.forgot_validate_string = validateString;
                if(req.body.user_type){ //condition for driver /customer
                    let response = await this.customerDriverRegistrationAPI.customerDriverResetPassword(req, res,next);

                    /** If reset password failed, send error response **/
                    if(response.status != Constants.STATUS_SUCCESS) return res.send(response);

                    /** Send success response **/
                    req.flash(Constants.STATUS_SUCCESS,response.message);
                    res.send({
                        status 		 : Constants.STATUS_SUCCESS,
                        redirect_url : Constants.WEBSITE_URL+"login"
                    });
                } else{
                    let response = await this.registrationAPI.resetPassword(req, res,next);

                    /** If reset password failed, send error response **/
                    if(response.status != Constants.STATUS_SUCCESS) return res.send(response);

                    /** Send success response **/
                    req.flash(Constants.STATUS_SUCCESS,response.message);
                    res.send({
                        status 		 : Constants.STATUS_SUCCESS,
                        redirect_url : Constants.WEBSITE_URL+"login"
                    });
                }
            }else{
                /** Set user conditions **/
                let conditions = clone(Constants.FRONT_USER_COMMON_CONDITIONS);
                if(req?.params?.user_type){
                    //condition for driver /customer
                    conditions	= (req.params.user_type == Constants.USER_TYPE_CUSTOMER) ? clone(Constants.CUSTOMER_COMMON_CONDITIONS) : clone(Constants.DRIVER_COMMON_CONDITIONS);
                }
                conditions.forgot_validate_string = validateString;

                /** Get user details **/
                const users = this.db.collection(Tables.USERS);
                let result = await users.findOne(conditions,{projection: {_id :1}});

                /** If user not found, send error response **/
                if(!result){
                    req.flash(Constants.STATUS_ERROR,res.__("user.link_expired_or_wrong_link"));
                    return res.redirect(Constants.WEBSITE_URL+'login');
                }

                /** render to reset password page **/
                res.render("reset_password",{
                    validate_string : validateString,
                    csrf_token 		: req?.csrfTokenValue || "",
                    user_type		: req?.params?.user_type || ""
                });
            }
        }catch(error){
            next(error);
        }
	};//End resetPassword()

    /**
	 * Function for logout
	 *
	 * @param req 	As 	Request Data
	 * @param res 	As 	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return json
	 */
	async logout(req,res,next){
        try{
            let userId = req?.session?.user?._id || "";

            if(!userId){
                /** Send error response */
                req.flash(Constants.STATUS_ERROR,res.__("system.something_going_wrong_please_try_again"));
                return res.redirect(Constants.WEBSITE_URL);
            }

            /** Update user logout time **/
            const user_logins =	this.db.collection(Tables.USER_LOGINS);
            await user_logins.updateOne({
                user_id		: 	new ObjectId(userId),
                device_type : 	"",
                device_token: 	"",
                logout_time	:	""
            },
            {$set:{
                logout_time	: getUtcDate()
            }});

            /** Delete user module flag **/
            userModuleFlagAction(userId,"","delete");
	    req.session.destroy();

            /** Clear cache control and cookie **/
            res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
            if(req.cookies.frontLoggedIn) res.clearCookie("frontLoggedIn");

            /** Redirect to login page **/
            res.redirect(Constants.WEBSITE_URL+"login");
        }catch(error){
            next(error);
        }
	};//End logout()

    /**
	 * Function to verify email
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async verifyEmail(req, res,next){
		try{
            /** Call verify email API **/
			req.body.validate_string = req.params.validate_string || "";
            let response = await this.customerDriverRegistrationAPI.verifyEmailAddress(req, res,next);

            /** Send response **/
            req.flash(response.status,response.message);
			res.redirect(Constants.WEBSITE_URL);
		}catch(error){
			next(error);
		}
	};//End verifyEmail()

    /**
	 * Function to handle restaurant on boarding requests
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async restaurantOnBoarding(req, res,next){
        try{
            if(isPost(req)){
                /** Sanitize Data **/
                req.body 					= sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
                let restaurantDescription 	= req?.body?.restaurant_description || "";

                asyncParallel({
                    file_upload : (callback)=>{
                        /** Upload file **/
                        moveUploadedFile(req, res, {
                            'image' 			: req?.files?.file || "",
                            'filePath'  		: Constants.RESTAURANT_ONBOARDING_FILE_PATH,
                            'allowedExtensions' : Constants.ALLOWED_RESTAURANT_ONBOARDING_EXTENSIONS,
                            'allowedImageError' : Constants.ALLOWED_RESTAURANT_ONBOARDING_ERROR_MESSAGE,
                            'allowedMimeTypes'	: Constants.ALLOWED_RESTAURANT_ONBOARDING_MIME_EXTENSIONS,
                            'allowedMimeError'	: Constants.ALLOWED_RESTAURANT_ONBOARDING_MIME_ERROR_MESSAGE
                        }).then(fileResponse => {
                            callback(null,fileResponse);
                        }).catch(next);
                    },
                    landing_image_upload : (callback)=>{
                        /** Upload image **/
                        moveUploadedFile(req, res, {
                            'image' 	: req?.files?.landing_image || "",
                            'filePath'  : Constants.RESTAURANT_ONBOARDING_FILE_PATH
                        }).then(imageResponse => {
                            callback(null,imageResponse);
                        }).catch(next);
                    },
                    restaurant_logo_upload : (callback)=>{
                        /** Upload image **/
                        moveUploadedFile(req, res, {
                            'image' 	: req?.files?.restaurant_logo || "",
                            'filePath'  : Constants.RESTAURANT_ONBOARDING_FILE_PATH
                        }).then(logoResponse => {
                            callback(null,logoResponse);
                        }).catch(next);
                    },
                    detail_image_upload : (callback)=>{
                        /** Upload image **/
                        moveUploadedFile(req, res, {
                            'image' 	: req?.files?.detail_image || "",
                            'filePath'  : Constants.RESTAURANT_ONBOARDING_FILE_PATH
                        }).then(detailImageResponse => {
                            callback(null,detailImageResponse);
                        }).catch(next);
                    },
                },async (err,response)=>{
                    if(err) return next(err);

                    let fileUpload 			 = response?.file_upload || {};
                    let landingImageUpload 	 = response?.landing_image_upload || {};
                    let restaurantLogoUpload = response?.restaurant_logo_upload || {};
                    let detailImageUpload    = response?.detail_image_upload || {};
                    let errors = [];

                    /** If file extension error **/
                    if (fileUpload.status == Constants.STATUS_ERROR) {
                        errors.push({ 'param': 'file', 'msg': fileUpload.message });
                    }

                    /** If landing image extension error **/
                    if (landingImageUpload.status == Constants.STATUS_ERROR) {
                        errors.push({ 'param': 'landing_image', 'msg': landingImageUpload.message });
                    }

                    /** If restaurant logo image extension error **/
                    if (restaurantLogoUpload.status == Constants.STATUS_ERROR) {
                        errors.push({ 'param': 'restaurant_logo', 'msg': restaurantLogoUpload.message });
                    }

                    /** If detail image extension error **/
                    if (detailImageUpload.status == Constants.STATUS_ERROR) {
                        errors.push({ 'param': 'detail_image', 'msg': detailImageUpload.message });
                    }

                    /** Send error response **/
                    if(errors.length >0) return res.send({status : Constants.STATUS_ERROR,message: errors});

                    const users = this.db.collection(Tables.USERS);
                    let adminResult = await users.findOne({ user_role_id: Constants.SYSTEM_ADMIN_ROLE_ID }, { projection: { _id: 1 } });

                    /** set data in object **/
                    let updateData = {
                        name : {
                            ar : req?.body?.restaurant_arabic_name || "",
                            en : req?.body?.restaurant_english_name || ""
                        },
                        restaurant_description 	: restaurantDescription,
                        restaurant_address     	: req?.body?.restaurant_address || "",
                        phone_country_code		: Constants.DEFAULT_COUNTRY_CODE,
                        approval_status			: Constants.PENDING,
                        mobile_number         	: req?.body?.contact_number || "",
                        contact_person_name     : req?.body?.contact_person_name || "",
                        account_manager_name	: req?.body?.account_manager_name || "",
                        email          			: req?.body?.email_address || "",
                        is_deleted				: Constants.NOT_DELETED,
                        added_by				: adminResult?._id || "",
                        team_approval_status	: Constants.PENDING,
                        created 			   	: getUtcDate()
                    };

                    /** if file upload **/
                    if(fileUpload.fileName) updateData['file'] = fileUpload.fileName;

                    /** if landing image upload **/
                    if(landingImageUpload.fileName) updateData['landing_image'] = landingImageUpload.fileName;

                    /** if restaurant logo upload **/
                    if(restaurantLogoUpload.fileName) updateData['restaurant_logo'] = restaurantLogoUpload.fileName;

                    /** if detail image upload **/
                    if(detailImageUpload.fileName) updateData['detail_image'] = detailImageUpload.fileName;

                    /** Save enquiry form details **/
                    const restaurant_enquiries = this.db.collection(Tables.RESTAURANT_ENQUIRIES);
                    let qryResult = await restaurant_enquiries.insertOne(updateData);

                    let enquiryId 	= qryResult?.insertedId || "";

                    /** Send success response **/
                    req.flash(Constants.STATUS_SUCCESS,res.__("restaurant_onboarding.restaurant_on_boarding_request_has_been_submitted_successfully"));
                    res.send({
                        status		: Constants.STATUS_SUCCESS,
                        redirect_url: Constants.WEBSITE_URL+"restaurant_on_boarding"
                    });

                    /*************** Send Mail  ***************/
                    sendMailToUsers(req,res,{
                        event_type 			: 	Constants.RESTAURANT_ENQUIRY_REQUEST_EMAIL_EVENTS,
                        enquiry_id			: 	enquiryId,
                        email_address		:	req?.body?.email_address || "",
                        restaurant_name		:	req?.body?.restaurant_english_name || "",
                        contact_person_name	:	req?.body?.contact_person_name || "",
                    });
                    /*************** Send Mail  ***************/
                });
            }else{
                /** Render onboarding page  **/
                res.render("onboarding",{ csrf_token : req?.csrfTokenValue || ""});
            }
        }catch(error){
            next(error);
        }
    }//End restaurantOnBoarding()

    /**
	 * Function for show dashboard
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render
	 */
	async dashboard(req, res, next){
        try{
            let restaurantId		= 	new ObjectId(req?.session?.user?.restaurant_id);
            let restaurantBranches	=	req?.session?.user?.branches ? new ObjectId(req.session.user.branches) : '';
            let orderLimit			=	(res.locals.settings["Site.order_limit"]) ? parseFloat(res.locals.settings["Site.order_limit"]) :0;
            const orders 			=	this.db.collection(Tables.ORDERS);

            /** Set common conditions */
            let commonConditions= {
                restaurant_id	:	restaurantId,
                is_confirm		:	true,
            };
            if(restaurantBranches) commonConditions['branch_id'] =	restaurantBranches;

            asyncParallel({
                orders_list : (callback)=>{
                    /** Get list of orders **/
                    orders.find(commonConditions,{projection : {_id: 1,customer_id:1,unique_order_id:1,branch_id:1,order_date:1,net_amount:1,restaurant_status:1}}).sort({_id : Constants.SORT_DESC}).limit(orderLimit).toArray().then(orderResult=>{
                        if(orderResult?.length == 0) return callback(null, []);

                        /** Push branch id, customer id in array */
                        let branchIds 		= [];
                        let userIds 		= [];
                        orderResult.forEach(record=>{
                            if(record.branch_id) branchIds.push(record.branch_id);
                            if(record.customer_id) userIds.push(record.customer_id);
                        });

                        asyncParallel({
                            branch_detail : (childCallback)=>{
                                /** Get branch details */
                                const restaurant_branches = this.db.collection(Tables.RESTAURANT_BRANCHES);
                                restaurant_branches.find({_id : {$in : arrayToObject(branchIds)}},{projection : {_id: 1,name: 1}}).toArray().then(branchResult=>{
                                    if(branchResult?.length == 0) return childCallback(null, {});

                                    let branchList = {};
                                    branchResult.forEach(branch=>{
                                        branchList[branch._id] = branch?.name?.[Constants.DEFAULT_LANGUAGE_CODE] || "";
                                    });
                                    childCallback(null,branchList);
                                }).catch(next);
                            },
                            user_detail : (childCallback)=>{
                                /** Get customer  details */
                                const users = this.db.collection(Tables.USERS);
                                users.find({_id : {$in : arrayToObject(userIds)}},{projection : {_id: 1,full_name: 1,mobile_number:1}}).toArray().then(userResult=>{
                                    if(userResult?.length == 0) return childCallback(null, {});

                                    let userList = {};
                                    userResult.forEach(user=>{
                                        userList[user._id] = { 'name' : user?.full_name || "", 'mobile' :  user?.mobile_number || ""};
                                    });
                                    childCallback(null,userList);
                                }).catch(next);
                            },
                        },(childErr, childResponse)=>{
                            if(childErr) return callback(childErr);

                            orderResult.forEach(record=>{
                                let branchId = record?.branch_id || "";
                                record.branch_name   = childResponse?.branch_detail?.[branchId] ||"";

                                let customerId = record?.customer_id || "";
                                record.customer_name   = childResponse?.user_detail?.[customerId]?.name || "";
                                record.customer_mobile = childResponse?.user_detail?.[customerId]?.mobile || "";
                            });

                            callback(null,orderResult);
                        });
                    }).catch(next);
                },
                order_stats :(callback)=>{
                    /** Get orders stats **/
                    orders.aggregate([
                        {$match: commonConditions},
                        {$group: {
                            _id: null,
                            total_orders : {$sum: 1},
                            orders_on_way: { $sum:
                                {$cond: [
                                    {$and: [
                                        { $eq: ["$restaurant_status", Constants.ORDER_ON_THE_WAY] },
                                    ]},
                                    1, 0
                                ]}},
                            new_orders: { $sum:
                                {$cond: [
                                    {$and: [
                                        { $eq: ["$restaurant_status", Constants.ORDER_PENDING] },
                                        { $eq: ["$is_confirm", true] },
                                    ]},
                                    1, 0
                                ]}},
                            orders_at_restaurant: { $sum:
                                {$cond: [
                                    {$and: [
                                        { $eq: ["$restaurant_status", Constants.ORDER_PREPARING] },
                                    ]},
                                    1, 0
                                ]}},
                            completed_orders: { $sum:
                                {$cond: [
                                    {$and: [
                                        { $eq: ["$restaurant_status", Constants.ORDER_DELIVERED] },
                                    ]},
                                    1, 0
                                ]}},
                            total_delayed_orders: { $sum:
                                {$cond: [
                                    {$and: [
                                        { $eq: ["$is_delayed", true] },
                                    ]},
                                    1, 0
                                ]}},

                        }}
                    ]).toArray().then(res =>{
                        callback(null, res?.[0] || {});
                    }).catch(next);
                },
                chart_stats : (callback)=>{
                    /** Get chart stats **/
                    orders.aggregate([
                        {$match	: commonConditions},
                        {$group	: {
                            _id  :{$year: {date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE}},
                            total_orders: {$sum : 1},
                            total_cancelled_orders: { $sum:
                                {$cond: [
                                    {$and: [
                                        { $eq: ["$restaurant_status", Constants.ORDER_CANCELLED] },
                                    ]},
                                    1, 0
                                ]}},
                        }},
                        {$sort: {_id : Constants.SORT_DESC}}
                    ]).toArray().then(res =>{
                        callback(null, res);
                    }).catch(next);
                },
                payment_stats : (callback)=>{
                    orders.aggregate([
                        {$match	: {
                            restaurant_id : restaurantId
                        }},
                        {$group	: {
                            _id : null,
                            due_payment: { $sum:
                                {$cond: [
                                    {$and: [
                                        { $ne: ["$is_settlement", true] },
                                        { $gt: ["$restaurant_payout", 0] },
                                    ]},
                                    "$restaurant_payout", 0
                                ]}},
                            paid_payment: { $sum:
                                {$cond: [
                                    {$and: [
                                        { $eq: ["$is_settlement", true] },
                                        { $gt: ["$restaurant_payout", 0] },
                                    ]},
                                    "$restaurant_payout", 0
                                ]}},
                        }},
                    ]).toArray().then(res =>{
                        callback(null, res?.[0] || {});
                    }).catch(next);
                },
            },(err, response)=>{
                if(err) return next(err);

                /** Render to dashbord page */
                req.breadcrumbs(BREADCRUMBS["dashboard"]);
                res.render("dashboard", {
                    result 				: response?.orders_list || [],
                    total_orders 		: response?.order_stats?.total_orders ||0,
                    new_orders 			: response?.order_stats?.new_orders ||0,
                    orders_at_restaurant: response?.order_stats?.orders_at_restaurant ||0,
                    orders_on_way 		: response?.order_stats?.orders_on_way ||0,
                    completed_orders 	: response?.order_stats?.completed_orders ||0,
                    total_delayed_orders: response?.order_stats?.total_delayed_orders ||0,
                    total_order_chart   : response?.chart_stats || [],
                    total_cancelled_order_chart : response?.chart_stats || [],
                    total_due_payment	: response?.payment_stats?.due_payment ||0,
                    total_paid_payment	: response?.payment_stats?.paid_payment ||0
                });
            });
        }catch(error){
            next(error);
        }
	};//End dashboard()

	/**
	 * Function for change password
	 *
	 * @param req 	As 	Request Data
	 * @param res 	As 	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async changePassword(req,res,next){
        try{
            if(isPost(req)){
                req.body.user_id = req?.session?.user?._id || "";

                let response = await this.myAccountAPI.changePassword(req, res,next);
                if(response.status != Constants.STATUS_SUCCESS) return res.send(response);

                /** Send success response **/
                req.flash(Constants.STATUS_SUCCESS,response.message);
                res.send({
                    status 		 : Constants.STATUS_SUCCESS,
                    redirect_url : Constants.WEBSITE_URL+"dashboard"
                });
            }else{
                /** Render change password page **/
                req.breadcrumbs(BREADCRUMBS["users/change_password"]);
                res.render("change_password",{csrf_token : req?.csrfTokenValue || ""});
            }
        }catch(error){
            next(error);
        }
    }//End changePassword()

	/**
	 * Function for edit profile
	 *
	 * @param req 	As 	Request Data
	 * @param res 	As 	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async editProfile(req,res,next){
        try{
            let restaurantId = new ObjectId(req.session.user.restaurant_id);
            let authUserId = new ObjectId(req.session.user._id);

            const users	= this.db.collection(Tables.USERS);
            const restaurants = this.db.collection(Tables.RESTAURANTS);
            const restaurant_details = 	this.db.collection(Tables.RESTAURANT_DETAILS);

            if(isPost(req)){
                /** Sanitize Data **/
                req.body =	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);

                /** Apply validation */
                let validationResponse = await applyValidationInterCallFunction(req, res, next, restaurantEditProfileValidation);
                if(validationResponse.status != Constants.STATUS_SUCCESS) return res.send(validationResponse);

                asyncParallel({
                    update_user_details : (callback)=>{
                        /** Update user details */
                        users.updateOne({
                            _id 		 	: 	new ObjectId(authUserId),
                            restaurant_id	:	new ObjectId(restaurantId),
                        },{$set: {
                            full_name 	:	req?.body?.account_manager_name || "",
                            modified	:	getUtcDate(),
                        }}).then(() => {
                            callback(null);
                        }).catch(next);
                    },
                    update_restaurant_details : (callback)=>{
                        /** Update restaurants details */
                        restaurants.updateOne({
                            _id : new ObjectId(restaurantId)
                        },{$set: {
                            name :	{
                                en: req?.body?.name_in_english || "",
                                ar: req?.body?.name_in_arabic || ""
                            },
                            address		:	req?.body?.restaurant_address || "",
                            description	:	req?.body?.restaurant_description || "",
                            thermal_layout_format: req?.body?.thermal_layout_format || "",
                            modified	: 	getUtcDate()
                        }}).then(() => {
                            callback(null);
                        }).catch(next);
                    },
                    update_restaurant_sub_details : (callback)=>{
                        /** Update restaurant sub details */
                        restaurant_details.updateOne({
                            restaurant_id : new ObjectId(restaurantId),
                        },{$set: {
                            account_manager	:	req?.body?.account_manager_name || "",
                            contact_person	:	req?.body?.contact_person_name || "",
                            address			:	req?.body?.restaurant_address || "",
                            modified		:	getUtcDate(),
                        }}).then(() => {
                            callback(null);
                        }).catch(next);
                    }
                },(err)=>{
                    if(err) return next(err);

                    /** Send success response **/
                    req.flash(Constants.STATUS_SUCCESS,res.__("user.profile_has_been_changed_successfully"));
                    res.send({
                        status 		 : Constants.STATUS_SUCCESS,
                        redirect_url : Constants.WEBSITE_URL
                    });
                });
            }else{
                asyncParallel({
                    restaurant_details : (callback)=>{
                        /** Get restaurant details */
                        restaurants.findOne({
                            _id : new ObjectId(restaurantId),
                        },{projection:{_id:0,name:1,description:1,thermal_layout_format:1}}).then(result => {
                            callback(null, result);
                        }).catch(next);
                    },
                    restaurant_sub_details : (callback)=>{
                        /** Get restaurant sub details */
                        restaurant_details.findOne({
                            restaurant_id : new ObjectId(restaurantId),
                        },{projection:{_id:0,account_manager:1, address:1,contact_person:1, email:1,mobile_number:1}}).then(result => {
                            callback(null, result);
                        }).catch(next);
                    }
                },(err,response)=>{
                    if(err) return next(err);

                    /** render edit profile page **/
                    req.breadcrumbs(BREADCRUMBS["users/edit_profile"]);
                    res.render("edit_profile",{
                        csrf_token				: 	req?.csrfTokenValue || "",
                        restaurant_details 		: 	response?.restaurant_details || {},
                        restaurant_sub_details 	:	response?.restaurant_sub_details || {},
                    });
                });
            }
        }catch(error){
            next(error);
        }
	};//End editProfile()

	/**
	 * Function for edit profile for restaurant roles(Except restaurant owner)
	 *
	 * @param req 	As 	Request Data
	 * @param res 	As 	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async subAdminEditProfile(req,res,next){
        try{
            let userId = new ObjectId(req.session.user._id);
            if(isPost(req)){
                /** Sanitize Data **/
                req.body =	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);

                /** Apply validation */
                let validationResponse = await applyValidationInterCallFunction(req, res, next, subAdminEditProfileValidation);
                if(validationResponse.status != Constants.STATUS_SUCCESS) return res.send(validationResponse);

                /** Update user details */
                const users = this.db.collection(Tables.USERS);
                let result = await users.updateOne({
                    _id : userId,
                },{$set: {
                    first_name	: 	req?.body?.first_name || "",
                    last_name	: 	req?.body?.last_name || "",
                    full_name 	:	req?.body?.first_name+" "+req?.body?.last_name || "",
                    modified	:	getUtcDate(),
                }});

                /** Send success response **/
                req.flash(Constants.STATUS_SUCCESS,res.__("user.profile_has_been_changed_successfully"));
                res.send({
                    status 		 : Constants.STATUS_SUCCESS,
                    redirect_url : Constants.WEBSITE_URL
                });
            }else{
                /** Set conditions **/
                let conditions = {_id : userId, ...clone(Constants.FRONT_USER_COMMON_CONDITIONS)};

                /** Get user details **/
                const users	= this.db.collection(Tables.USERS);
                let result = await users.findOne(conditions,{projection: {first_name: 1,last_name: 1, email: 1, branches: 1}});

                /** Send error response if user not found */
                if(!result){
                    req.flash(Constants.STATUS_ERROR,res.__("system.something_going_wrong_please_try_again"));
                    return res.redirect(Constants.WEBSITE_URL+"logout");
                }

                let restaurantId 		=	req.session.user.restaurant_id;
                let branchConditions 	= {
                    restaurant_id	: 	new ObjectId(restaurantId)
                    };
                if(result.branches) branchConditions._id = new ObjectId(result.branches);

                /** Get branch list */
                const restaurant_branches = this.db.collection(Tables.RESTAURANT_BRANCHES);
                let branchResult = await restaurant_branches.find(branchConditions,{projection: {_id:0, name: 1}}).toArray();

                /** render edit profile page **/
                req.breadcrumbs(BREADCRUMBS["users/edit_profile"]);
                res.render("user_edit_profile",{
                    csrf_token	 : 	req?.csrfTokenValue || "",
                    user_details : 	result,
                    branch_list	 : 	branchResult
                });
            }
        }catch(error){
            next(error);
        }
	};//End subAdminEditProfile()
}
export default User;
