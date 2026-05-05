import { fileURLToPath } from 'url';
import { dirname } from 'path';
import overtimeCaptainRequestController from "./model/overtime_captain_request.mjs";
import { addEditOvertimeCaptainRequestValidation } from "./validations.mjs";
import { validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure overtime captain request routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/overtime_captain_request';
    const overtimeCaptainRequestModule = new overtimeCaptainRequestController(db);

    // Set views for all /overtime_captain_request* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    // Get overtime captain request list
    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        overtimeCaptainRequestModule.getOvertimeRequestList(req, res, next);
    });

    // Add overtime captain request
    router.all(modulePath + "/add", checkLoggedInAdmin, addEditOvertimeCaptainRequestValidation, validateRequest, (req, res, next) => {
        overtimeCaptainRequestModule.addOvertimeRequest(req, res, next);
    });

    // Edit overtime captain request
    router.all(modulePath + "/edit/:id", checkLoggedInAdmin, addEditOvertimeCaptainRequestValidation, validateRequest, (req, res, next) => {
        overtimeCaptainRequestModule.addOvertimeRequest(req, res, next);
    });

    // Delete overtime captain request
    router.all(modulePath + "/delete/:id", checkLoggedInAdmin,(req, res, next) => {
        overtimeCaptainRequestModule.deleteOvertimeRequest(req, res, next);
    });

    // Export overtime captain request data
    router.all(modulePath + "/export_data/:export_count/:export_type", checkLoggedInAdmin, (req, res, next) => {
        overtimeCaptainRequestModule.exportData(req, res, next);
    });
} 