import { ObjectId } from 'mongodb';
import clone from 'clone';
import { parallel as asyncParallel } from 'async';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from '../../../../utils/index.mjs';
import { sendSMS, sendMail } from '../../../../services/index.mjs';
import { loginValidation, forgotPasswordValidation, resetPasswordValidation, verifyOTPValidation } from '../validations/registration.mjs';

export default class Registration {
    constructor(db) {
        this.db = db;
    }

	/**
	 * Function to get user data
	 *
	 * @param req		As	Request Data
	 * @param res		As 	Response Data
	 * @param options	As  object of data
	 *
	 * @return json
	 **/
	async getUserData (req,res,next,options){
		return new Promise(resolve=>{
			let conditions	= (options.conditions)	? options.conditions	:{};
			let fields		= (options.fields)		? options.fields		:{};

			if(!conditions){
				/** Send error response **/
				return resolve({
					status	: Constants.STATUS_ERROR,
					message	: res.__("system.something_going_wrong_please_try_again")
				});
			}

			/** Get user details **/
			const users	= this.db.collection(Tables.USERS);
			users.findOne(conditions,{projection: fields}).then(result=>{

				/** Send success response **/
				if(!result)return resolve({status : Constants.STATUS_SUCCESS,result : false});

				/** If user role id customer**/
				if(result.user_role_id == Constants.CUSTOMER && !result.package_status) result.package_status = Constants.PACKAGE_NOT_PURCHASED;

				/** Send success response **/
				if(!result.profile_image) return resolve({status: Constants.STATUS_SUCCESS, result: result});

				/** Append image with full path **/
				Helpers.appendFileExistData({
					"file_url" 			: Constants.USERS_URL,
					"file_path" 		: Constants.USERS_FILE_PATH,
					"result" 			: [result],
					"database_field" 	: "profile_image"
				}).then(fileResponse=>{

					/** Send success response **/
					resolve({
						status	: Constants.STATUS_SUCCESS,
						result 	: fileResponse?.result?.[0] || {},
					});
				}).catch(next);
			}).catch(next);
		}).catch(next);
	};// end getUserData()

	/**
	 * Function for login user
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async login (req,res,next){
		return new Promise(async resolve=>{
			/** Sanitize Data **/
			req.body = 	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);

			/** Apply validation */
            let validationResponse = await Helpers.applyValidationInterCallFunction(req, res, next, loginValidation);
            if(validationResponse.status != Constants.STATUS_SUCCESS) return resolve(validationResponse);

			let userName 	= (req.body.user_name)	? req.body.user_name :"";
			let password 	= (req.body.password)	? req.body.password	 :"";
			let passwordHash= Helpers.generateMD5Hash(password);

			/** Set conditions **/
			let conditions	=	{
				user_type	: Constants.USER_TYPE_RESTAURANT,
				is_deleted	: Constants.NOT_DELETED,
				password	: passwordHash,
				"$or"		: [
					{"email": {$regex : '^'+userName+'$',$options : 'i'}}, //check user name with case insensitive
					{'mobile_number': userName}
				],
			};

			/** Get user details **/
			let userResponse = await this.getUserData(req,res,next,{
				conditions	: conditions,
				fields		: {mobile_otp:0,email_otp:0,is_deleted:0,created:0,device_details:0,modified:0}
			});

			console.log('userResponse ',userResponse)

			if(userResponse.status != Constants.STATUS_SUCCESS) return next(userResponse.message);
			let resultData	= (userResponse.result) ? userResponse.result :"";

			/** Send error response **/
			if(!resultData){
				return resolve({
					status	: Constants.STATUS_ERROR,
					message	: [{"param":"password","msg":res.__("user.email_password_entered_incorrect")}]
				});
			}

			if(resultData.active != Constants.ACTIVE){
				/** Response if user deactivated by admin*/
				return resolve({
					status	: Constants.STATUS_ERROR,
					message	: res.__("user.account_temporarily_disabled")
				});
			}

			if(resultData.is_verified == Constants.VERIFIED){
				/**remove password from login */
				delete resultData.password;

				let restaurantId = (resultData.restaurant_id)	?	new ObjectId(resultData.restaurant_id)	:"";

				/** Get restaurants details **/
				const restaurants	= this.db.collection(Tables.RESTAURANTS);
				restaurants.findOne({
					_id			: 	restaurantId,
					is_deleted	:	Constants.NOT_DELETED,
				},{projection: {slug: 1}}).then(restaurantResult=>{

					resultData.restaurant_slug = restaurantResult?.slug || "";

					/** Save user login Logs **/
					this.saveLoginLogs(req,res,resultData).then(()=>{});

					/** Send success response **/
					resolve({
						status		: Constants.STATUS_SUCCESS,
						result		: resultData,
						image_path	: Constants.USERS_URL
					});
				}).catch(next);
			}else{
				/** Get otp number **/
				let mobileOTP		= await Helpers.getRandomOTP();
				let emailOTP		= await Helpers.getRandomOTP();
				let mobileNumber	= (resultData.mobile_number) ? resultData.mobile_number	:"";
				let countryCode		= (resultData.country_code)	 ? resultData.country_code	:Constants.DEFAULT_COUNTRY_CODE;

				/** To allow testing mobile numbers for send OTP*/
				let testingMobiles = (res.locals.settings['Site.testing_mobile_numbers']) ? res.locals.settings['Site.testing_mobile_numbers'].split(",") : [];

				if(testingMobiles.indexOf(mobileNumber) !== -1){
					countryCode = Constants.INDIA_COUNTRY_CODE;
				}

				mobileNumber		= countryCode+mobileNumber;
				let timeStamp		= Helpers.currentTimeStamp();
				let validateString	= Helpers.generateMD5Hash(timeStamp+mobileNumber);

				/** Update otp in users **/
				const users = this.db.collection(Tables.USERS);
				users.updateOne({
					_id:new ObjectId(resultData._id)
				},
				{$set :{
					email_otp		: emailOTP,
					mobile_otp		: mobileOTP,
					validate_string	: validateString,
					modified 		: Helpers.getUtcDate(),
				}}).then(()=>{

					/** Send otp for verify */
					sendSMS(req,res,{
						sms_type        :   Constants.SMS_TEMPLATE_FOR_RESEND_OTP,
						user_id         :   resultData._id,
						mobile_number   :   mobileNumber,
						message_params  :   [mobileOTP],
					});

					/**Send email */
					let email		=	(resultData.email) 		? resultData.email		:"";
					let fullName	=	(resultData.full_name) 	? resultData.full_name	:"";
					if(email) sendMail(req,res,{
						to 			: email,
						action 		: "send_otp",
						rep_array 	: [fullName,emailOTP]
					});

					/** Send success response **/
					let returnResponse = {
						status 	: Constants.STATUS_SUCCESS,
						message	: res.__('user.user_not_verified_login_mesage',mobileNumber)
					};

					if(Helpers.isMobileApi(req,res)){
						returnResponse.result = {
							is_verified	: Constants.NOT_VERIFIED,
							user_id		: resultData._id,
							mobile_otp	: mobileOTP,
							email_otp	: emailOTP,
						};
					}else{
						returnResponse.validate_string 	= validateString;
						returnResponse.is_verified 		= Constants.NOT_VERIFIED;
					}

					/** Response if user not verified*/
					resolve(returnResponse);
				}).catch(next);
			}
		}).catch(next);
	};//End login()

	/**
	 * Function to save user login activity
	 *
	 * @param req		As 	Request Data
	 * @param res		As 	Response Data
	 * @param options	As  object of data
	 *
	 * @return json
	 **/
	async saveLoginLogs (req,res,options){
		return new Promise(resolve=>{
			try{
				let userId			= (options._id)				? options._id		:	"";
				let deviceType 		= (req.body.device_type)	? req.body.device_type 	:"";
				let deviceToken 	= (req.body.device_token)	? req.body.device_token :"";

				/** Send error response **/
				if(!userId) return resolve({status : Constants.STATUS_ERROR, options : options, message : res.__("system.something_going_wrong_please_try_again")});

				asyncParallel([
					(callback)=>{
						/** Manage update data **/
						let userUpdatedData = {
							$set	:	{
								last_login	: Helpers.getUtcDate(),
								modified	: Helpers.getUtcDate(),
							}
						};

						if(deviceType && deviceToken){
							userUpdatedData["$set"]["device_details"] = [{
								device_type 	: deviceType.toLowerCase(),
								device_token	: deviceToken,
							}];
						}

						/** Save user device details **/
						const users	=	this.db.collection(Tables.USERS);
						users.updateOne({_id : new ObjectId(userId)},userUpdatedData).then(()=>{
							callback(null);
						}).catch(err=>{
							callback(err);
						});
					},
					(callback)=>{
						/** Save user login details **/
						const user_logins	=	this.db.collection(Tables.USER_LOGINS);
						user_logins.insertOne({
							user_id			: new ObjectId(userId),
							device_type 	: deviceType,
							device_token	: deviceToken,
							date 			: Helpers.getUtcDate(Helpers.newDate("",Constants.DATABASE_DATE_FORMAT+" "+Constants.START_DATE_TIME_FORMAT)),
							logout_time		: "",
							created 		: Helpers.getUtcDate(),
						}).then(()=>{
							callback(null);
						}).catch(err=>{
							callback(err);
						});
					},
				],(err)=>{
					/** Send error response **/
					if(err) return resolve({status : Constants.STATUS_ERROR, options: options, message : res.__("system.something_going_wrong_please_try_again")});

					/** Send success response **/
					resolve({status	: Constants.STATUS_SUCCESS, options	: options});
				});
			}catch(e){
				/** Send error response **/
				resolve({
					status	: Constants.STATUS_ERROR,
					options	: options,
					message	: res.__("system.something_going_wrong_please_try_again")
				});
			}
		}).catch(next);
	};// End saveLoginLogs()

	/**
	 * Function to logout
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async logOut(req,res,next){
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 		= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId 		= (req.body.user_id) 		? req.body.user_id 		:"";
			let deviceType 	= (req.body.device_type)	? req.body.device_type 	:"";
			let deviceToken = (req.body.device_token)	? req.body.device_token	:"";

			/** Send error response **/
			if(!userId) return resolve({status : Constants.STATUS_ERROR, message	: res.__("system.invalid_access")});

			asyncParallel({
				update_device_details : (callback)=>{
					if(!(deviceType && deviceToken)) return callback(null);

					/** Update user details **/
					const users	=	this.db.collection(Tables.USERS);
					users.updateOne({
						_id	: new ObjectId(userId),
						"device_details.device_type" : deviceType,
						"device_details.device_token" : deviceToken,
					},
					{$pull: {
						device_details: {
							device_type	: deviceType,
							device_token: deviceToken
						}
					},$set:{
						is_online		: Constants.OFFLINE,
						is_available 	: Constants.NOT_AVAILABLE,
						modified		: Helpers.getUtcDate()
					}}).then(()=>{
						callback(null);
					}).catch(next);
				},
				update_logout_time : (callback)=>{
					/** Save user login details **/
					const user_logins = this.db.collection(Tables.USER_LOGINS);
					user_logins.updateOne({
						user_id		: new ObjectId(userId),
						device_type : deviceType,
						device_token: deviceToken,
					},
					{$set :{
						logout_time	: Helpers.getUtcDate()
					}}).then(()=>{
						callback(null);
					}).catch(next);
				}
			},(asyncErr)=>{
				if(asyncErr) return resolve({
					status	: Constants.STATUS_ERROR,
					message	: asyncErr
				});

				/** Send success response **/
				resolve({
					status	: Constants.STATUS_SUCCESS,
					message	: res.__("user.you_have_logged_out_successfully")
				});
			});
		}).catch(next);
	};//End logOut()

	/**
	 * Function for recover forgot password
	 *
	 * @param req 	As 	Request Data
	 * @param res 	As 	Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render/json
	 **/
    async forgotPassword (req,res,next){
		return new Promise(async resolve=>{
			/** Sanitize Data **/
			req.body 			= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let selectedType 	= (req.body.email_phone) ? req.body.email_phone : "";

			/** Apply validation */
            let validationResponse = await Helpers.applyValidationInterCallFunction(req, res, next, forgotPasswordValidation);
            if(validationResponse.status != Constants.STATUS_SUCCESS) return resolve(validationResponse);

			let mobileNumber	= (req.body.mobile_number)	? req.body.mobile_number :"";
			let userEmail		= (req.body.email)  		? req.body.email 		 :"";
			let isMobile		= (selectedType == Constants.MOBILE_NUMBER) ? true : false;

			/** Set options for get user details **/
			let options = {
				conditions		: {
					user_type	: Constants.USER_TYPE_RESTAURANT,
					is_deleted	: Constants.NOT_DELETED
				},
				fields	:	{
					_id :1,full_name:1,mobile_number:1,country_code:1,is_verified:1,active:1,email:1
				}
			};

			/**Condition  for mobile or email*/
			if(isMobile){
				options.conditions.mobile_number = mobileNumber;
			}else{
				options.conditions.email = userEmail;
			}

			/** Get user details **/
			let response =  await this.getUserData(req,res,next,options);
			if(response.status != Constants.STATUS_SUCCESS) return next(response.message);

			/** Send error response **/
			let inputParam = (isMobile) ? "mobile_number" :"email";
			if(!response.result) return resolve({status : Constants.STATUS_ERROR, message	: [{param: inputParam, msg:res.__("user.email_not_registered")}]});

			let result 			= response.result;
			let activeStatus	= (result.active)		? result.active			: "";
			let verifiedStatus	= (result.is_verified)	? result.is_verified	: "";
			let countryCode		= (result.country_code)	? result.country_code	: Constants.DEFAULT_COUNTRY_CODE;
			let email			= (result.email)		? result.email			: "";
			let fullName		= (result.full_name) 	? result.full_name		: "";

			/** To allow testing mobile numbers for send OTP*/
			let testingMobiles = (res.locals.settings['Site.testing_mobile_numbers']) ? res.locals.settings['Site.testing_mobile_numbers'].split(",") : [];
			if(testingMobiles.indexOf(mobileNumber) !== -1){
				countryCode = Constants.INDIA_COUNTRY_CODE;
			}

			if(isMobile) mobileNumber	= countryCode+mobileNumber;
			let timeStamp				= Helpers.currentTimeStamp();
			let forgotValidateString	= Helpers.generateMD5Hash(timeStamp+mobileNumber);

			/** Send error response **/
			if(activeStatus != Constants.ACTIVE)return resolve({status: Constants.STATUS_ERROR, message: [{param: inputParam, msg: res.__("user.account_temporarily_disabled")}]});

			/** Send error response **/
			if(verifiedStatus != Constants.VERIFIED) return resolve({status: Constants.STATUS_ERROR, message: [{param: inputParam, msg: res.__("user.account_is_not_verified")}]});

			/** Get Otp **/
			let mobileOTP 	 = await Helpers.getRandomOTP();
			let dataToBeSaved = {
				mobile_otp				: mobileOTP,
				modified				: Helpers.getUtcDate(),
				forgot_validate_string	: forgotValidateString,
			};

			if(!isMobile){
				dataToBeSaved = {
					email_otp				: mobileOTP,
					modified				: Helpers.getUtcDate(),
					forgot_validate_string	: forgotValidateString,
				};
			}

			/** Update otp number **/
			const users = this.db.collection(Tables.USERS);
			users.updateOne({_id : new ObjectId(result._id)},{$set: dataToBeSaved}).then(()=>{

				if(isMobile){
					/*********** Send sms for forgot password ***************/
						sendSMS(req,res,{
							sms_type        :   Constants.SMS_TEMPLATE_FOR_FORGOT_PASSWORD,
							user_id         :   result._id,
							mobile_number   :   mobileNumber,
							message_params  :   [mobileOTP],
						});
					/*********** Send sms for forgot password ***************/
				} else if(email) {
					/*********** Send email for forgot password ***************/
						sendMail(req,res, {
							to 		 : email,
							action 	 : "forgot_password",
							rep_array: [fullName,mobileOTP]
						});
					/*********** Send email for forgot password ***************/
				}

				/** Send success response **/
				let flashVariable = (isMobile) ?  mobileNumber :email;
				let returnResponse = {
					status 		: Constants.STATUS_SUCCESS,
					otp_type	: (isMobile) ? "mobile_otp" : "email_otp",
					message		: res.__("user.otp_sent_successfully_on_mobile",flashVariable)
				};

				if(Helpers.isMobileApi(req,res)){
					returnResponse.mobile_otp	= mobileOTP;
					returnResponse.user_id 		= result._id;
				}else{
					returnResponse.forgot_validate_string 	= forgotValidateString;
				}
				/** Send success response **/
				resolve(returnResponse);
			}).catch(next);
		}).catch(next);
	};// end forgotPassword()

	/**
	 * Function for reset password
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async resetPassword (req,res,next){
		return new Promise(async resolve=>{
			/** Sanitize Data **/
			req.body 			= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId			= (req.body.user_id)				? req.body.user_id				 	:"";
			let validateString	= (req.body.forgot_validate_string)	? req.body.forgot_validate_string	:"";

			/** Send error response */
			if(!userId && !validateString) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.invalid_access")});

			/** Apply validation */
            let validationResponse = await Helpers.applyValidationInterCallFunction(req, res, next, resetPasswordValidation);
            if(validationResponse.status != Constants.STATUS_SUCCESS) return resolve(validationResponse);

			/** Set user conditions **/
			let conditions = clone(Constants.FRONT_USER_COMMON_CONDITIONS);
			if(validateString) conditions = {forgot_validate_string: validateString, ...conditions};
			else conditions = {_id: new ObjectId(userId), ...conditions};

			/** Get user details **/
			this.getUserData(req,res,next,{
				conditions	: conditions,
				fields		: {_id :1}
			}).then((response)=>{
				if(response.status != Constants.STATUS_SUCCESS || !response.result) return next(res.__("system.something_going_wrong_please_try_again"));

				let result		= response.result;
				let resultId  	= (result._id)			?	result._id			:"";
				let password	= (req.body.password)	?	req.body.password	:"";
				let newPassword = Helpers.generateMD5Hash(password)

				/** Update user password **/
				let users = this.db.collection(Tables.USERS);
				users.updateOne({
					_id : new ObjectId(resultId)
				},
				{
					$set	: 	{
						password	: newPassword,
						modified 	: Helpers.getUtcDate()
					},
					$unset  :	{
						forgot_validate_string : 1
					}
				}).then(()=>{

					/** Send success response **/
					resolve({
						status	: Constants.STATUS_SUCCESS,
						message : res.__("user.your_password_has_been_reset_successfully"),
					});
				}).catch(next);
			}).catch(next);
		}).catch(next);
	};//End resetPassword()

	/**
	 * Function for resend otp
	 *
	 * @param req	As	Request Data
	 * @param res	As	Response Data
	 * @param next	As	Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async resendOtp (req,res,next){
		return new Promise(async resolve=>{
			/** Sanitize Data **/
			req.body 			= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId			= (req.body.user_id)		? req.body.user_id	:"";
			let page			= (req.body.page)			? req.body.page		:"";
			let otpType			= (req.body.type)			? req.body.type		:"";
			let validateString	= (req.body.validate_string)? req.body.validate_string	:"";

			if(!otpType || (!userId && !validateString)) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			/** Set user conditions **/
			let userConditions = clone(Constants.FRONT_USER_COMMON_CONDITIONS);
			if(page == "forgot_password") conditions = {forgot_validate_string: validateString, ...conditions};
			else if(validateString) conditions = {validate_string: validateString, ...conditions};
			else conditions = {_id: new ObjectId(userId), ...conditions};

			/** Get user details **/
			let response = await this.getUserData(req,res,next,{
				conditions	: userConditions,
				fields		: {_id:1,mobile_number:1,country_code:1,email:1,full_name:1}
			});
			if(response.status != Constants.STATUS_SUCCESS || !response.result) return next(res.__("system.something_going_wrong_please_try_again"));

			let result	= response.result;
			let otp		= await Helpers.getRandomOTP();

			/** Update otp number **/
			let dataToBeUpdated = {
				modified : Helpers.getUtcDate()
			};

			/** Save otp in users collection**/
			if(otpType == "mobile_otp") {
				dataToBeUpdated.mobile_otp = otp;
			}else{
				dataToBeUpdated.email_otp = otp;
			}

			const users = this.db.collection(Tables.USERS);
			users.updateOne({_id : new ObjectId(result._id)},{$set: dataToBeUpdated}).then(()=>{

				let mobileNumber	= (result.mobile_number) ? result.mobile_number	: "";
				let email			= (result.email) 		 ? result.email			: "";

				/******************* Send OTP To User  **********************/
				if(otpType == "mobile_otp"){
					let countryCode		= (result.country_code)	 ? result.country_code	: Constants.DEFAULT_COUNTRY_CODE;

					/** To allow testing mobile numbers for send OTP*/
					let testingMobiles = (res.locals.settings['Site.testing_mobile_numbers']) ? res.locals.settings['Site.testing_mobile_numbers'].split(",") : [];
					if(testingMobiles.indexOf(mobileNumber) !== -1){
						countryCode = Constants.INDIA_COUNTRY_CODE;
					}

					/**Send sms **/
					mobileNumber = countryCode+mobileNumber;
					sendSMS(req,res,{
						sms_type        :   Constants.SMS_TEMPLATE_FOR_RESEND_OTP,
						user_id         :   result._id,
						mobile_number   :   mobileNumber,
						message_params  :   [otp],
					});
				}

				if(otpType == "email_otp" && email){
					/**Send Mail */
					let fullName = (result.full_name) 	? result.full_name	:"";
					sendMail(req,res,{
						to 			: email,
						action 		: "send_otp",
						rep_array 	: [fullName,otp]
					});
				}
				/*************** Send OTP To User ***************/

				/** Send success response **/
				let otpSentTo	= (otpType == "email_otp") ? email : mobileNumber;
				let returnResponse = {
					status 	: Constants.STATUS_SUCCESS,
					message	: res.__("user.otp_sent_successfully_on_mobile",otpSentTo)
				};

				if(Helpers.isMobileApi(req,res)){
					returnResponse[otpType] = otp;
					returnResponse.user_id	= result._id;
				}
				resolve(returnResponse);
			}).catch(next);
		}).catch(next);
	};//End resendOtp()

	/**
	 * Function for verify OTP
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async verifyOTP (req,res,next){
		return new Promise(async resolve=>{
			/** Sanitize Data **/
			req.body 			= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId			= (req.body.user_id)			? req.body.user_id	:"";
			let mobileOTP		= (req.body.otp)				? req.body.otp 		:"";
			let otpType			= (req.body.otp_type)			? req.body.otp_type :"";
			let page			= (req.body.page)				? req.body.page		:"";
			let validateString	= (req.body.validate_string)	? req.body.validate_string	:"";

			/** Send error response **/
			if(!userId && (!validateString || !page || page != "forgot_password" ||!otpType)){
				return resolve({status:	Constants.STATUS_ERROR, message: 	res.__("system.invalid_access") });
			}

			/** Apply validation */
            let validationResponse = await Helpers.applyValidationInterCallFunction(req, res, next, verifyOTPValidation);
            if(validationResponse.status != Constants.STATUS_SUCCESS) return resolve(validationResponse);

			/** Set user conditions **/
			let userConditions 	= 	clone(Constants.FRONT_USER_COMMON_CONDITIONS);
			if(page == "forgot_password") conditions = {forgot_validate_string: validateString, ...conditions};
			else conditions = {_id: new ObjectId(userId), ...conditions};

			/** Get user details **/
			this.getUserData(req,res,next,{
				conditions	:	userConditions,
				fields		:	{_id:1,mobile_otp:1,email_otp:1}
			}).then(userResponse=>{
				if(userResponse.status != Constants.STATUS_SUCCESS) return next(userResponse);

				let resultData	=	(userResponse.result) ? userResponse.result :null;

				/** Send error response **/
				if(!resultData) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.something_going_wrong_please_try_again")});
				let dataBaseOTP = (otpType == "mobile_otp") ? resultData.mobile_otp : resultData.email_otp;

				/** Check entered otp is matched or not **/
				if(mobileOTP != dataBaseOTP) return resolve({status : Constants.STATUS_ERROR, message : [{param:"otp",msg:res.__("user.incorrect_otp_message")}]});

				/**Fields to remove from table */
				let fieldsToUnset = {mobile_otp : 1};
				if(otpType == "email_otp") fieldsToUnset = {email_otp : 1};

				/** Update user details **/
				let resultId 	= (resultData._id) ? resultData._id	:"";
				const users 	= this.db.collection(Tables.USERS);
				users.updateOne({
					_id : new ObjectId(resultId)
				},{
					$set  : {
						modified :	Helpers.getUtcDate()
					},
					$unset	:	fieldsToUnset
				}).then(()=>{

					let returnResponse = {status: Constants.STATUS_SUCCESS};
					if(!Helpers.isMobileApi(req,res)){
						returnResponse.forgot_validate_string	= validateString;
					}
					/** Send success response **/
					resolve(returnResponse);
				}).catch(next);
			}).catch(next);
		}).catch(next);
	};//End verifyOTP()
}// End Registration