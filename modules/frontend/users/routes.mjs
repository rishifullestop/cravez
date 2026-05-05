import { fileURLToPath } from 'url';
import { dirname } from 'path';
import https from 'https';
import OS from 'os';
import User from "./model/user.mjs";
import { restaurantOnboardingValidation } from "./validations.mjs";
import { validateRequest } from "../../../utils/index.mjs";
import * as Constants from "../../../config/global_constant.mjs";
import { pushNotification } from "../../../services/index.mjs";


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure users routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.csrfRouteMiddleware - CSRF protection middleware
 * @param {Function} options.isLoggedIn - Middleware to check if user is logged in
 * @param {Function} options.checkLoggedIn - Middleware to check if user is logged in
 */
export default function configure(router, { db, isLoggedIn, csrfRouteMiddleware, checkLoggedIn}) {
    const beforeLoginModulepath = Constants.FRONT_END_NAME;
    const userModule = new User(db);

    /************************ Before Login Routes *************************/

        /** Currently redirect to login page */
        router.get(Constants.FRONT_END_NAME, (req, res, next) => {
            res.redirect(Constants.WEBSITE_URL+"login");
        });

        /** Routing is used to render html and submit login form **/
        router.all(beforeLoginModulepath+"login", isLoggedIn, csrfRouteMiddleware,(req, res, next) => {
            /** Set current view folder and layout **/
            req.rendering.views = __dirname + "/views";
            req.rendering.layout = Constants.WEBSITE_LAYOUT_PATH + "before_login";
            userModule.login(req, res, next);
        });

        /** Routing is used to render html and submit forgot form **/
        router.all(beforeLoginModulepath+"forgot_password",isLoggedIn, csrfRouteMiddleware,(req, res)=>{
            /** Set current view folder and layout **/
            req.rendering.views = __dirname + "/views";
            req.rendering.layout = Constants.WEBSITE_LAYOUT_PATH+"before_login";
            userModule.forgotPassword(req,res);
        });

        /** Routing is used to render html and submit reset password form **/
        router.all(beforeLoginModulepath+"reset_password/:validate_string",isLoggedIn, csrfRouteMiddleware,(req, res,next)=>{
            /** Set current view folder and layout **/
            req.rendering.views = __dirname + "/views";
            req.rendering.layout 	= Constants.WEBSITE_LAYOUT_PATH+"before_login";

            userModule.resetPassword(req,res,next);
        });

        /** Routing is used to render html and submit reset password form **/
        router.all(beforeLoginModulepath+"reset_password/:validate_string/:user_type",isLoggedIn, csrfRouteMiddleware,(req, res,next)=>{
            /** Set current view folder and layout **/
            req.rendering.views = __dirname + "/views";
            req.rendering.layout 	= Constants.WEBSITE_LAYOUT_PATH+"before_login";

            userModule.resetPassword(req,res,next);
        });

        /** Routing is used to render html and submit registration form **/
        router.all(beforeLoginModulepath+"verify_account/:validate_string",isLoggedIn, csrfRouteMiddleware,(req, res,next)=>{
            /** Set current view folder and layout**/
            req.rendering.views = __dirname + "/views";
            req.rendering.layout 	= Constants.WEBSITE_LAYOUT_PATH+"before_login";

            userModule.verifyAccount(req,res,next);
        });

        /** Routing is used to resend otp **/
        router.post(beforeLoginModulepath+"resend_otp/:type",isLoggedIn,(req, res,next)=>{
            /** Set current view folder and layout**/
            req.rendering.views = __dirname + "/views";
            userModule.resendOTP(req,res,next);
        });

        /** Routing is used to render html and submit verify otp form **/
        router.all(beforeLoginModulepath+"verify_otp/:page/:validate_string/:otp_type",isLoggedIn, csrfRouteMiddleware,(req, res,next)=>{
            /** Set current view folder and layout **/
            req.rendering.views = __dirname + "/views";
            req.rendering.layout 	= Constants.WEBSITE_LAYOUT_PATH+"before_login";
            userModule.verifyOtp(req,res,next);
        });

        /** Routing is used for user logout */
        router.get(beforeLoginModulepath+"logout",(req, res,next)=>{
            /** Set current view folder and layout**/
            req.rendering.views = __dirname + "/views";
            userModule.logout(req,res,next);
        });

        /**Routing For restaurant on boarding */
        router.all(beforeLoginModulepath+"restaurant_on_boarding",isLoggedIn,csrfRouteMiddleware,restaurantOnboardingValidation,validateRequest,(req, res,next)=>{
            /** Set current view folder and layout **/
            req.rendering.views  = __dirname + "/views";
            req.rendering.layout =   Constants.WEBSITE_LAYOUT_PATH+"before_login";
            userModule.restaurantOnBoarding(req,res,next);
        });

        /** Routing is used to verify driver/customer account(email only) **/
        router.get(beforeLoginModulepath+'verify_email/:validate_string',isLoggedIn,(req, res,next)=>{
            /** Set current view folder and layout**/
            req.rendering.views = __dirname + "/views";
            userModule.verifyEmail(req, res,next);
        });


    /********************************************* After Login Routes *********************************************/


        /** Routing is used to render html and submit reset password form **/
        router.all(beforeLoginModulepath+"dashboard",checkLoggedIn,(req, res,next)=>{
            /** Set current view folder and layout**/
            req.rendering.views = __dirname + "/views";
            userModule.dashboard(req,res,next);
        });

        /** Routing for change password */
        router.all(beforeLoginModulepath + "change_password",checkLoggedIn, csrfRouteMiddleware,(req,res,next)=>{
            /** Set current view folder and layout**/
            req.rendering.views = __dirname + "/views";
            userModule.changePassword(req,res,next);
        });

        /** Routing for edit profile */
        router.all(beforeLoginModulepath + "edit_profile",checkLoggedIn, csrfRouteMiddleware,(req,res,next)=>{
            /** Set current view folder and layout**/
            req.rendering.views = __dirname + "/views";

            if(req?.session?.user?.user_role_id == Constants.RESTAURANT){
                return userModule.editProfile(req,res,next);
            }
            return userModule.subAdminEditProfile(req,res,next);
        });

        /** Routing is used to get app link **/
        router.get(beforeLoginModulepath+"app_link",(req,res,next)=>{
            res.end("");
        });

        /** Routing is used for change language */
        router.all(beforeLoginModulepath+"change_language",(req, res,next)=>{
            if(req?.query?.lang) res.cookie("language_id",req.query.lang);
            let backURL = req?.header('Referer') || '/';
            res.redirect(backURL);
        });

    /******************************* Testing  Routes *******************************/

        /** Send push notification **/
        router.get(beforeLoginModulepath+'push_notification/:user_id',(req, res,next)=>{
            pushNotification(req,res,{pn_body:"test pn",pn_title:"test",user_id:req.params.user_id}).then((response)=>{
                res.send(response);
            }).catch(next);
        });

        /** Routing is used to send pn for driver arrived**/
        router.get(beforeLoginModulepath+'direct_push_notification/:user_id/:order_id/:notification_type',(req, res,next)=>{
            let notificationType 	= req.params.notification_type;
            let pnTitle 			= Constants.NOTIFICATION_MESSAGES?.[notificationType]?.title || "Test pn";
            let pnMessage 			= Constants.NOTIFICATION_MESSAGES?.[notificationType]?.message || "Test";

            pushNotification(req,res,{pn_body:pnMessage, pn_title:pnTitle,pn_type:notificationType, user_id:req.params.user_id,order_id : req.params.order_id}).then((response)=>{
                res.send(response);
            }).catch(next);
        });

        router.get(beforeLoginModulepath+"img_server",(req, res, next) => {
            req.rendering.layout 	= Constants.WEBSITE_LAYOUT_PATH+"blank";
            res.render("img_server");
        });

        router.get(beforeLoginModulepath+"get_server_ip",(req, res, next) => {
            const ipAddress = req.socket.remoteAddress;

            let  allNetworkInterfaces = OS.networkInterfaces();
            let ipAddr = (allNetworkInterfaces && allNetworkInterfaces.ens160 && allNetworkInterfaces.ens160[0] && allNetworkInterfaces.ens160[0].address) ? allNetworkInterfaces.ens160[0].address :"";

            https.get('https://api.ipify.org?format=json', function(resf){
                resf.setEncoding('utf8');
                resf.on('data', function(chunk){
                    let jjj = JSON.parse(chunk);
                    jjj = (jjj && jjj.ip) ? jjj.ip :"";

                    res.send(ipAddress+" --- "+jjj+"  --- "+ipAddr);
                }).on('error', (err) => {
                    console.error('Error fetching IP address:', err);
                    res.send('');
                });
            });
        });
}