import { fileURLToPath } from 'url';
import { dirname } from 'path';
import areas from "./model/areas.mjs";
import { addEditValidation } from "./validations.mjs";
import {validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure areas routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath =   '/areas' ;
    const areasModule = new areas(db);

    // Set views for all /areas* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        areasModule.getAreasList(req, res, next);
    });

    router.all(modulePath+"/add", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        areasModule.addEditArea(req, res, next);
    });

    router.all(modulePath+"/edit/:id", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        areasModule.addEditArea(req, res, next);
    });

    router.all(modulePath+"/update-status/:id/:status", checkLoggedInAdmin, (req, res, next) => {
        areasModule.updateAreaStatus(req, res, next);
    });

    router.all(modulePath+"/export_data/:export_type/:export_count", checkLoggedInAdmin, (req, res, next) => {
        areasModule.exportData(req, res, next);
    });
} 