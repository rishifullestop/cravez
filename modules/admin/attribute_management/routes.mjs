import { fileURLToPath } from 'url';
import { dirname } from 'path';
import AttributeManagement from "./model/attribute_management.mjs";
import { addEditValidation, changeOrderValidation } from "./validations.mjs";
import {validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure attribute management routes
 * @param {Object} app - Express application instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(app, { db, checkLoggedInAdmin }) {
    const attributeManagementModule = new AttributeManagement(db);
    const modulePath = "/attribute_management/:type";

    /** Set current view folder **/
    app.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    /** Routing is used for list page **/
    app.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        attributeManagementModule.attributeList(req, res, next);
    });

    /** Routing is used add attribute **/
    app.all(modulePath + "/add", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        attributeManagementModule.addEditAttribute(req, res, next);
    });

    /** Routing is used to edit attribute **/
    app.all(modulePath + "/edit/:id", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        attributeManagementModule.addEditAttribute(req, res, next);
    });

    /** Routing is used to delete attribute **/
    app.all(modulePath + "/delete/:id", checkLoggedInAdmin, (req, res, next) => {
        attributeManagementModule.deleteAttribute(req, res, next);
    });

    /** Routing is used to change order value **/
    app.all(modulePath + "/change_order", checkLoggedInAdmin, changeOrderValidation, validateRequest, (req, res, next) => {
        attributeManagementModule.changeOrderValue(req, res, next);
    });
} 