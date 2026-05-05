import { fileURLToPath } from 'url';
import { dirname } from 'path';
import adminModule from "./model/admin_module.mjs";
import { addEditValidation, validateChangeOrder } from "./validations.mjs";
import {validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure admin module routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/admin_modules/:module_type';
    const adminModules = new adminModule(db);

    /** Set current view folder and validate module type **/
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";

        const moduleType = req.params.module_type || "";
        
        /** Check module type 'admin' or 'restaurant' **/
        if (moduleType !== 'admin' && moduleType !== 'restaurant') {
            /** Send error response **/
            req.flash('error', res.__("admin.system.invalid_access"));
            return res.redirect('/admin');
        }

        next();
    });

    /** Routing is used for list page **/
    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        adminModules.list(req, res, next);
    });

    /** Routing is used add admin module **/
    router.all(modulePath + "/add", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        adminModules.addEdit(req, res, next);
    });

    /** Routing is used to edit admin module **/
    router.all(modulePath + "/edit/:id", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        adminModules.addEdit(req, res, next);
    });

    /** Routing is used to update status**/
    router.all(modulePath + "/update-status/:id/:status", checkLoggedInAdmin, (req, res, next) => {
        adminModules.updateAdminModuleStatus(req, res, next);
    });

    /** Routing is used to delete **/
    router.all(modulePath + "/delete/:id", checkLoggedInAdmin, (req, res, next) => {
        adminModules.deleteModule(req, res, next);
    });

    /** Routing is used to change order of module **/
    router.all(modulePath + "/change_order", checkLoggedInAdmin, validateChangeOrder, validateRequest, (req, res, next) => {
        adminModules.changeOrderValue(req, res, next);
    });
} 