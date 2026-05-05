import { fileURLToPath } from 'url';
import { dirname } from 'path';
import teamBreaksController from "./model/team_breaks.mjs";
import { addEditBreakValidation, approveRejectBreakValidation } from "./validations.mjs";
import { validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure team breaks routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/team_breaks';
    const teamBreaksModule = new teamBreaksController(db);

    // Set views for all /team_breaks* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    // Get team breaks list
    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        teamBreaksModule.getBreaksList(req, res, next);
    });

    // Add break
    router.all(modulePath + "/add", checkLoggedInAdmin, addEditBreakValidation, validateRequest, (req, res, next) => {
        teamBreaksModule.addEditBreak(req, res, next);
    });

    // Edit break
    router.all(modulePath + "/edit/:id", checkLoggedInAdmin, addEditBreakValidation, validateRequest, (req, res, next) => {
        teamBreaksModule.addEditBreak(req, res, next);
    });

    // Approve/Reject break
    router.all(modulePath + "/approve_reject/:action/:id", checkLoggedInAdmin, approveRejectBreakValidation, validateRequest, (req, res, next) => {
        teamBreaksModule.acceptBreak(req, res, next);
    });

    // Delete break
    router.all(modulePath + "/delete/:id", checkLoggedInAdmin, (req, res, next) => {
        teamBreaksModule.deleteBreak(req, res, next);
    });
} 