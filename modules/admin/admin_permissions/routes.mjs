import { fileURLToPath } from 'url';
import { dirname } from 'path';
import AdminPermission from "./model/admin_permissions.mjs";
import { addValidation, editValidation, assignTeamValidation } from "./validations.mjs";
import {validateRequest } from "../../../utils/index.mjs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure admin permissions routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/admin_permissions';
    const adminPermissions = new AdminPermission(db);

    /** Set current view folder **/
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    /** Routing is used for list page **/
    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        adminPermissions.list(req, res, next);
    });

    /** Routing is used add admin permission **/
    router.all(modulePath + "/add", checkLoggedInAdmin, addValidation, validateRequest, (req, res, next) => {
        adminPermissions.add(req, res, next);
    });

    /** Routing is used to edit admin permission **/
    router.all(modulePath + "/edit/:id", checkLoggedInAdmin, editValidation, validateRequest, (req, res, next) => {
        adminPermissions.edit(req, res, next);
    });

    /** Routing is used to delete permission **/
    router.all(modulePath + "/delete/:id", checkLoggedInAdmin, (req, res, next) => {
        adminPermissions.delete(req, res, next);
    });

    /** Routing is used to view permission **/
    router.get(modulePath + "/view/:id", checkLoggedInAdmin, (req, res, next) => {
        adminPermissions.viewDetials(req, res, next);
    });

    /** Routing is used to get allowed modules of a role **/
    router.post(modulePath + "/get_role_modules", checkLoggedInAdmin, (req, res, next) => {
        adminPermissions.getAdminRoleModulesData(req, res, next);
    });

    /** Routing is used to get role users list for dropdown **/
    router.post(modulePath + "/get_role_users", checkLoggedInAdmin, (req, res, next) => {
        adminPermissions.getRoleUserList(req, res, next);
    });

    /** Routing is used to get given role users for assign and shift **/
    router.all(modulePath + "/get_role_users_and_update/:team_head_status/:user_role_id/:user_id", checkLoggedInAdmin, assignTeamValidation, validateRequest, (req, res, next) => {
        adminPermissions.getRoleUsersAndUpdate(req, res, next);
    });

    /** Routing is used to update status **/
    router.all(modulePath + "/update-status/:id/:status", checkLoggedInAdmin, (req, res, next) => {
        adminPermissions.updateStatus(req, res, next);
    });

    /** Routing is used to send login credentials **/
    router.get(modulePath + "/send_login_credentials/:id", checkLoggedInAdmin, (req, res, next) => {
        adminPermissions.sendLoginCredentials(req, res, next);
    });
}