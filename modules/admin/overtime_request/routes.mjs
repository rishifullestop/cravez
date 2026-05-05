import { fileURLToPath } from 'url';
import { dirname } from 'path';
import overtimeRequestController from "./model/overtime_request.mjs";
import { addOvertimeRequestValidation } from "./validations.mjs";
import { validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure overtime request routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/overtime_request';
    const overtimeRequestModule = new overtimeRequestController(db);

    // Set views for all /overtime_request* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    // Get overtime request list
    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        overtimeRequestModule.getOvertimeRequestList(req, res, next);
    });

    // Add overtime request
    router.all(modulePath + "/add", checkLoggedInAdmin, addOvertimeRequestValidation, validateRequest, (req, res, next) => {
        overtimeRequestModule.addOvertimeRequest(req, res, next);
    });
} 