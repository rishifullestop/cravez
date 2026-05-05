import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as Constants from "../../../config/global_constant.mjs";
import {convertMultipartReqBody } from "../../../utils/index.mjs";
import adminRole from "./model/admin_roles.mjs";
import { addEditValidation, } from "./validations.mjs";
import {validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure admin role routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/admin_role/:user_type';
    const adminModules  =   new adminRole(db);

    /** Set current view folder and validate module type **/
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";

        const userType = req.params.user_type || "";
        
        /** Check module type 'admin' or 'restaurant' **/
        if (userType !== Constants.MODULE_TYPE_ADMIN && userType !== Constants.MODULE_TYPE_RESTAURANT) {
            /** Send error response **/
            req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
            return res.redirect(Constants.WEBSITE_ADMIN_URL);
        }

        next();
    });

    /** Routing is used for list page **/
    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        adminModules.list(req, res, next);
    });

    /** Routing is used add admin role **/
    router.all(modulePath + "/add", checkLoggedInAdmin, convertMultipartReqBody, addEditValidation, validateRequest, (req, res, next) => {
        adminModules.add(req, res, next);
    });

    /** Routing is used to edit admin role **/
    router.all(modulePath + "/edit/:id", checkLoggedInAdmin, convertMultipartReqBody, addEditValidation, validateRequest, (req, res, next) => {
        adminModules.edit(req, res, next);
    });

    /** Routing is used to delete **/
    router.all(modulePath + "/delete/:id", checkLoggedInAdmin, (req, res, next) => {
        adminModules.delete(req, res, next);
    });
} 