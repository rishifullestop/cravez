import * as Constants from "../../../config/global_constant.mjs";
import * as Helper from "../../../utils/index.mjs";
const { ObjectId } = await import("mongodb");
import Tables from '../../../config/database_tables.mjs';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

/** Model file path for current plugin **/
import userModule from "./model/user.mjs";
import dashboardModule from "./model/dashboard.mjs";
import { loginValidation,  passwordResetValidation, passwordForgotValidation, profileValidation} from "./validations.mjs";
import {validateRequest } from "../../../utils/index.mjs";

const modulePath = "/users";
const __filename    =   fileURLToPath(import.meta.url);
const __dirname     =   dirname(__filename);

export default function configure(router, {db, checkLoggedInAdmin, isLoggedIn }) {
    const userModel         =   new userModule(db);
    const dashboardModel    =   new dashboardModule(db);

    /** Before login routings **/

    /** Routing is used to render html and submit login form **/
    router.all(["/login", "/"], isLoggedIn, loginValidation, validateRequest, (req, res, next) => {
        /** Set current view folder **/
        req.rendering.views = __dirname + "/views";

        /** Set layout  **/
        req.rendering.layout = Constants.WEBSITE_ADMIN_LAYOUT_PATH + "before_login";

        userModel.login(req, res, next);
    });

    /** Routing is used to render html and submit forgot password form **/
    router.all("/forgot-password", passwordForgotValidation, validateRequest, (req, res, next) => {
        /** Set current view folder **/
        req.rendering.views = __dirname + "/views";

        /** Set layout  **/
        req.rendering.layout = Constants.WEBSITE_ADMIN_LAYOUT_PATH + "before_login";
        userModel.forgotPassword(req, res, next);
    });

    /** Routing is used to render html and submit reset password form **/
    router.all("/reset-password", passwordResetValidation, validateRequest, (req, res, next) => {
        /** Set current view folder **/
        req.rendering.views = __dirname + "/views";

        /** Set layout  **/
        req.rendering.layout = Constants.WEBSITE_ADMIN_LAYOUT_PATH + "before_login";
        userModel.resetPassword(req, res, next);
    });

    /** Before login routings end **/

    /** Routing is used to update auth user details **/
    router.all("/edit_profile", checkLoggedInAdmin, profileValidation, validateRequest, (req, res, next) => {
        /** Set current view folder **/
        req.rendering.views = __dirname + "/views";
        userModel.editProfile(req, res, next);
    });

    /** Routing is used to render dashboard html */
    router.get("/dashboard", checkLoggedInAdmin, (req, res, next) => {
        /** Set current view folder **/
        req.rendering.views = __dirname + "/views";
        dashboardModel.dashboard(req, res, next);
    });

    /** Routing is used get agent login list **/
    router.all("/dashboard/agent_login", checkLoggedInAdmin, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        dashboardModel.getAgentLogin(req, res, next);
    });

    /** Routing is used get agent login details **/
    router.all("/dashboard/agent_login/get_agent_login_detail", checkLoggedInAdmin, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        dashboardModel.getAgentLoginDetail(req, res, next);
    });

    /** ckeditor image uploader **/
    router.post(modulePath + "/ckeditor_uploader", checkLoggedInAdmin, (req, res, next) => {
        userModel.ckeditorUploader(req, res, next);
    });

    /** Routing is used for admin logout */
    router.get("/logout", (req, res, next) => {
        res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");

        /** Delete user Modules list Flag **/
        let userId = req?.session?.user._id;
        Helper.userModuleFlagAction(userId, "", "delete");
        req.session.destroy();

        if (req.cookies.adminLoggedIn) res.clearCookie("adminLoggedIn");
        res.redirect(Constants.WEBSITE_ADMIN_URL + "login");

        if(userId) {
            /** Update admin login details **/
            const user_logins = db.collection(Tables.USER_LOGINS);
            user_logins.updateOne({
                user_id: new ObjectId(userId),
                logout_time: "",
            },
            { $set: {
                logout_time: Helper.getUtcDate()
            } }, () => { });
        }
    });
}





