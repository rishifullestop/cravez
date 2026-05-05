import crypto from 'crypto';
import * as Constants from "../../../../config/global_constant.mjs";
import * as Helper from "../../../../utils/index.mjs";
import * as Services from "../../../../services/index.mjs";
import Tables from '../../../../config/database_tables.mjs';
const { ObjectId } = await import("mongodb");

/**
 * User class for handling user-related operations
 * @class User
 */
class User {
    /**
     * Creates an instance of User
     * @param {Object} db - Database connection instance
     */
    constructor(db) {
        this.UserModel = this;
        this.db = db;
    }

    /**
     * Handles user login functionality
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next middleware function
     * @returns {Promise<void>}
     */
    login = async (req, res, next) => {
        try {
            if(Helper.isPost(req)){
                /** Sanitize Data **/
                req.body = Helper.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let username = req.body.username || "";
                let simplePassword = req.body.password || "";

                /** Set login options **/
                let loginOptions = {
                    user_name: username,
                    password: simplePassword
                };

                /** call login function **/
                const responseData = await this.adminLoginFunction(req, res, next, loginOptions);

                if(responseData.status != Constants.STATUS_SUCCESS){
                    /** Send error response **/
                    return res.send({
                        status: Constants.STATUS_ERROR,
                        message: (responseData.errors) ? responseData.errors : [],
                    });
                }

                /** Send success response **/
                res.send({
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "dashboard",
                    status: Constants.STATUS_SUCCESS,
                });
            } else {
                if(Constants.ALLOWED_ADMIN_TO_SET_COOKIE != Constants.ACTIVE){
                    res.render("login");
                    return;
                }

                /** Login user using cookie*/
                let cookie = req.cookies.adminLoggedIn;
                if(!cookie){
                    res.render("login");
                    return;
                }

                let username = (cookie.username) ? cookie.username : "";
                let password = (cookie.password) ? cookie.password : "";
                let decipherUser = crypto.createDecipher("aes256", "username");
                let decryptedUsername = decipherUser.update(username, "hex", "utf8") + decipherUser.final("utf8");
                let decipherPassword = crypto.createDecipher("aes256", "password");
                let decryptedPassword = decipherPassword.update(password, "hex", "utf8") + decipherPassword.final("utf8");

                /** Set login options **/
                let loginOptions = {
                    user_name: decryptedUsername,
                    password: decryptedPassword
                };

                /** call login function **/
                const responseData = await this.adminLoginFunction(req, res, next, loginOptions);
                if(responseData.status != Constants.STATUS_SUCCESS){
                    /** Delete cookie*/
                    res.clearCookie("adminLoggedIn");
                    res.render("login");
                    return;
                }

                /** Redirect to dashboard*/
                res.redirect(Constants.WEBSITE_ADMIN_URL + "dashboard");
            }
        } catch (err) {
            next(err);
        }
    };

    /**
     * Handles admin login functionality
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next middleware function
     * @param {Object} options - Login options containing username and password
     * @returns {Promise<Object>} Login response data
     */
    adminLoginFunction = async (req, res, next, options) => {
        try {
            let username        =   options?.user_name || "";
			let simplePassword  =   options?.password  || "";
			let rememberMe      =   req?.body?.remember_me || false;
			let password        =   Helper.generateMD5Hash(simplePassword);

            const users = this.db.collection(Tables.USERS);
            const resultData = await users.findOne(
                {
                    "user_type": Constants.USER_TYPE_ADMIN,
                    "is_deleted": Constants.NOT_DELETED,
                    "password": password,
                    "email": {$regex: "^" + username + "$", $options: "i"}
                },
                { projection: {
                    user_role_id: 1,
                    user_type: 1,
                    first_name: 1,
                    last_name: 1,
                    full_name: 1,
                    slug: 1,
                    email: 1,
                    active: 1,
                    created: 1,
                    team_head: 1,
                    parent_id: 1
                }}
            );

            /** Send error response **/
            if(!resultData){
                return {
                    status: Constants.STATUS_ERROR,
                    errors: [{"param": "password", "msg": res.__("admin.user.please_enter_correct_email_or_password")}],
                    options: options
                };
            }

            if(resultData.active != Constants.ACTIVE) {
                /** Send error response **/
                return {
                    status: Constants.STATUS_ERROR,
                    errors: [{"param": "password", "msg": res.__("admin.user.account_temporarily_disabled")}],
                    options: options
                };
            }

            /** If user check stay sign in check box*/
            if(rememberMe == true){
                let cookie = req.cookies.adminLoggedIn;
                if (cookie === undefined){
                    let userCipher = crypto.createCipher("aes256", "username");
                    let encryptedUserName = userCipher.update(username, "utf8", "hex") + userCipher.final("hex");
                    let passwordCipher = crypto.createCipher("aes256", "password");
                    let encryptedPassword = passwordCipher.update(simplePassword, "utf8", "hex") + passwordCipher.final("hex");

                    /**set a new cookie*/
                    res.cookie("adminLoggedIn", {username: encryptedUserName, password: encryptedPassword}, { maxAge: Constants.ADMIN_LOGGED_IN_COOKIE_EXPIRE_TIME, httpOnly: true });
                }
            }

            /** Save admin login details **/
            const user_logins = this.db.collection(Tables.USER_LOGINS);
            user_logins.insertOne({
                user_id: new ObjectId(resultData._id),
                date: Helper.getUtcDate(Helper.newDate("", Constants.DATABASE_DATE_FORMAT + " " + Constants.START_DATE_TIME_FORMAT)),
                logout_time: "",
                created: Helper.getUtcDate(),
            }, () => {});

            req.session.user = resultData;
            req.session.user.channel_id = Constants.CHANNEL_UIOS;

            /** Send success response **/
            return{
                status: Constants.STATUS_SUCCESS,
                options: options
            };
        } catch (err) {
            return {
                status: Constants.STATUS_ERROR,
                errors: [{"param": "password", "msg": res.__("admin.user.please_enter_correct_email_or_password")}],
                options: options
            };
        }
    };

    /**
     * Handles forgot password functionality
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next middleware function
     * @returns {Promise<void>}
     */
    forgotPassword = async (req, res, next) => {
        if (Helper.isPost(req)) {
            try {
                /** Sanitize Data **/
                req.body = Helper.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                const email = req.body.email || "";

                const users = this.db.collection(Tables.USERS);
                const result = await users.findOne({
                    "email": email,
                    "user_type": Constants.USER_TYPE_ADMIN
                }, { projection: { _id: 1, full_name: 1 } });

                /** Send success response even if user not found (security) **/
                if (!result){
                    req.flash(Constants.STATUS_SUCCESS, res.__("admin.user.receive_email_with_link").replace(RegExp("{EMAIL}", "g"), email));
                    return res.send({
                        status: Constants.STATUS_SUCCESS,
                        redirect_url: Constants.WEBSITE_ADMIN_URL + "forgot-password",
                        message: res.__("admin.user.receive_email_with_link").replace(RegExp("{EMAIL}", "g"), email)
                    });
                }

                const currentTime    =  Helper.currentTimeStamp();
                const validateString =  Helper.generateMD5Hash(currentTime + email);

                /** Update forgot pasword string */
                const updateResult = await users.updateOne(
                    { _id: new ObjectId(result._id) },
                    {
                        $set: {
                            forgot_password_validate_string: validateString,
                            modified: Helper.getUtcDate()
                        }
                    }
                );

                if (updateResult) {
                    /** Send Mail for reset password link **/
                    const link = Constants.WEBSITE_ADMIN_URL + 'reset-password?validate_string=' + validateString;
                    Services.sendMail(req, res, {
                        to: email,
                        action: "admin_forgot_password",
                        user_id: result._id,
                        rep_array: [result.full_name, link]
                    }, this.db);

                    /** Send success response **/
                    req.flash(Constants.STATUS_SUCCESS, res.__("admin.user.receive_email_with_link").replace(RegExp("{EMAIL}", "g"), email));
                    return res.send({
                        status: Constants.STATUS_SUCCESS,
                        redirect_url: Constants.WEBSITE_ADMIN_URL + "forgot-password",
                        message: res.__("admin.user.receive_email_with_link").replace(RegExp("{EMAIL}", "g"), email)
                    });
                }else{
                    /** Send error response **/
                    return res.send({
                        status: Constants.STATUS_ERROR,
                        message: [{ "param": "email", "msg": res.__("admin.system.something_going_wrong_please_try_again") }]
                    });
                }
            } catch (e) { return next(e); }
        }else{
            /** Render forgot password page **/
            return res.render("forgot_password");
        }
    };

    /**
     * Handles password reset functionality
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next middleware function
     * @returns {Promise<void>}
     */
    resetPassword = async (req, res, next) => {
        try {
            if (!req.query?.validate_string) {
                req.flash(Constants.STATUS_ERROR, res.__("admin.user.link_expired_or_wrong_link"));
                return res.redirect(Constants.WEBSITE_ADMIN_URL + "login");
            }

            const isPost            =   Helper.isPost(req);
            const validateString    =   req.query.validate_string || "";

            /** Get user details **/
            const users  = this.db.collection(Tables.USERS);
            const result = await users.findOne({
                forgot_password_validate_string: validateString,
                user_type: Constants.USER_TYPE_ADMIN,
                is_deleted: Constants.NOT_DELETED,
            }, { projection: { _id: 1, full_name: 1 } });

            /** Send error response when details not found */
            if (!result) {
                if(isPost){
                    return res.send({
                        status: Constants.STATUS_ERROR,
                        message: [{ "param": "confirm_password", "msg": res.__("admin.user.link_expired_or_wrong_link") }]
                    });
                }

                req.flash(Constants.STATUS_ERROR, res.__("admin.user.link_expired_or_wrong_link"));
                return res.redirect(Constants.WEBSITE_ADMIN_URL + "login");
            }

            if (isPost) {
                const password      =   req.body.password || "";
                const newPassword   =   Helper.generateMD5Hash(password);

                /** update password */
                const updateResult = await users.updateOne(
                    { _id: new ObjectId(result._id) },
                    {
                        $set: {
                            password: newPassword,
                            modified: Helper.getUtcDate()
                        },
                        $unset: {
                            forgot_password_validate_string: 1
                        }
                    }
                );

                if (!updateResult) {
                    return res.send({
                        status: Constants.STATUS_ERROR,
                        message: [{ param: Constants.ADMIN_GLOBAL_ERROR, msg: res.__("admin.system.something_going_wrong_please_try_again") }]
                    });
                }

                /** send Success response **/
                req.flash(Constants.STATUS_SUCCESS, res.__("admin.user.your_password_has_been_reset_successfully"));
                return res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "login",
                    message: res.__("admin.user.your_password_has_been_reset_successfully")
                });
            } else {
                /** Render reset password page **/
                res.render("reset_password", {
                    validate_string: validateString
                });
            }
        } catch (e) { return next(e); }
    };

    /**
     * Handles user profile editing functionality
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next middleware function
     * @returns {Promise<void>}
     */
    editProfile = async (req, res, next) => {
        try {
            const users =   this.db.collection(Tables.USERS);
            let authId  =   new ObjectId(req?.session?.user?._id || "");
            let isPost  =   Helper.isPost(req);

            /** Get login user details */
            const result = await users.findOne({
                "_id": authId, "user_role_id": { $nin: [Constants.RESTAURANT] }
            }, { projection: { _id: 1, full_name: 1, email: 1, mobile_number: 1, password: 1 } });

            /** Send error response when login user details not found */
            if(!result){
                if(isPost){
                    return res.send({
                        status: Constants.STATUS_ERROR,
                        message: [{ param: Constants.ADMIN_GLOBAL_ERROR, msg: res.__("admin.system.something_going_wrong_please_try_again") }]
                    });
                }
                req.flash(Constants.STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again-2"));
                return res.redirect(Constants.WEBSITE_ADMIN_URL + "dashboard");
            }

            if(Helper.isPost(req)){
                /** Sanitize Data **/
                req.body        =   Helper.sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let password    =   req?.body?.password || "";
                let fullName    =   req?.body?.full_name || "";

                /** Check old password is mathed or not */
                if(password){
                    let passwordHash = Helper.generateMD5Hash(req.body.old_password);
                    if (passwordHash != result.password) {
                        return res.send({
                            status: Constants.STATUS_ERROR,
                            message: [{ "param": "old_password", "msg": res.__("admin.user_profile.old_password_you_entered_did_not_matched") }],
                        });
                    }
                }

                /** Set update data */
                let updateData = {
                    full_name   : fullName,
                    modified    : Helper.getUtcDate()
                };
                if(password) updateData.password = Helper.generateMD5Hash(password);

                /** Update login user details */
                await users.updateOne(
                    { _id: authId },
                    { $set: updateData }
                );

                /** Update name in session */
                req.session.user.full_name	= fullName;

                /** Send success response **/
                req.flash(Constants.STATUS_SUCCESS,res.__("admin.user.your_profile_has_been_updated_successfully"));
                res.send({
                    status		:   Constants.STATUS_SUCCESS,
                    redirect_url:   Constants.WEBSITE_ADMIN_URL+"dashboard",
                    message		:   res.__("admin.user.your_profile_has_been_updated_successfully"),
                });
            }else{
                // req.breadcrumbs(Constants.BREADCRUMBS["admin/user_profile/edit"]);
                res.render("edit_profile", {
                    result: result
                });
            }
        }catch(err) {
            return next(err);
        }
    };

    /**
     * Handles CKEditor file upload functionality
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next middleware function
     * @returns {Promise<void>}
     */
    ckeditorUploader = async (req, res, next) => {
        const image = (req.files && req.files.upload) ? req.files.upload : "";
        const arr = {};
        if (image == '' || req.files.name == "") {
            arr["uploaded"] = 0;
            arr["error"] = {
                message: [res.__("admin_ckeditor_please_select_image")]
            };
            res.send(arr);
        } else {
            /** Upload image **/
            const response = await Helper.moveUploadedFile(req, res, {
                'image': image,
                'filePath': Constants.CK_EDITOR_FILE_PATH,
                'allowedExtensions': Constants.ALLOWED_IMAGE_EXTENSIONS,
                'allowedImageError': Constants.ALLOWED_IMAGE_ERROR_MESSAGE,
                'allowedMimeTypes': Constants.ALLOWED_IMAGE_MIME_EXTENSIONS,
                'allowedMimeError': Constants.ALLOWED_IMAGE_MIME_ERROR_MESSAGE,
            });

            if (response.status == Constants.STATUS_SUCCESS) {
                arr["fileName"] = (response.fileName) ? response.fileName : "";
                arr["url"] = (response.fileName) ? Constants.CK_EDITOR_URL + response.fileName : "";
                arr["uploaded"] = 1;
            } else {
                arr["uploaded"] = 0;
                arr["error"] = {
                    message: response.message
                };
            }
            res.send(arr);
        }
    };

    /**
     * Handles agent login list functionality
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next middleware function
     * @returns {Promise<void>}
     */
    getAgentLogin = async (req, res, next) => {
        //req.breadcrumbs(BREADCRUMBS['admin/dashboard/agent_login']);
		res.render('dashboard/agent_login_list');
    };
}
export default User;