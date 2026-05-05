import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Cms from "./model/cms.mjs";
import { addEditValidation } from "./validations.mjs";
import {validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure CMS routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/cms';
    const cmsModule = new Cms(db);

    // Set views for all /cms* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        cmsModule.getCmsList(req, res, next);
    });

    router.all(modulePath + "/add", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        cmsModule.addEditCms(req, res, next);
    });

    router.all(modulePath + "/edit/:id", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        cmsModule.addEditCms(req, res, next);
    });

    router.all(modulePath + "/delete/:id", checkLoggedInAdmin, (req, res, next) => {
        cmsModule.deleteCms(req, res, next);
    });
} 