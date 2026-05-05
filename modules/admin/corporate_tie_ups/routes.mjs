import { fileURLToPath } from 'url';
import { dirname } from 'path';
import CorporateTieUps from "./model/corporate_tie_ups.mjs";
import { addEditValidation } from "./validations.mjs";
import {validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure corporate tie ups routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/corporate_tie_ups';
    const corporateModule = new CorporateTieUps(db);

    // Set views for all /corporate_tie_ups* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    // Corporate tie ups list
    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        corporateModule.getCorporateList(req, res, next);
    });

    // Add corporate tie up
    router.all(modulePath + "/add", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        corporateModule.addEditCorporate(req, res, next);
    });

    // Edit corporate tie up
    router.all(modulePath + "/edit/:id", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        corporateModule.addEditCorporate(req, res, next);
    });

    // Delete corporate tie up
    router.get(modulePath + "/delete/:id", checkLoggedInAdmin, (req, res, next) => {
        corporateModule.corporateDelete(req, res, next);
    });

    // Import user in corporate
    router.all(modulePath + "/import_user/:id", checkLoggedInAdmin, (req, res, next) => {
        corporateModule.importUser(req, res, next);
    });

    // Add user to corporate
    router.all(modulePath + "/add_user/:id", checkLoggedInAdmin, (req, res, next) => {
        corporateModule.addUser(req, res, next);
    });
} 