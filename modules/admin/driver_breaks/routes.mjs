import { fileURLToPath } from 'url';
import { dirname } from 'path';
import DriverBreaks from './model/driver_breaks.mjs';
import { addEditValidation, approveValidation, rejectValidation, cancelValidation } from './validations.mjs';
import {validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure driver breaks routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/driver_breaks';
    const driverBreaksModule = new DriverBreaks(db);

    // Set views for all /driver_breaks* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + '/views';
        next();
    });

    // Reject driver break
    router.all(modulePath + '/reject/:action/:id/:driver_id', checkLoggedInAdmin, rejectValidation, validateRequest, (req, res, next) => {
        driverBreaksModule.rejectBreak(req, res, next);
    });

    // Approve driver break
    router.all(modulePath + '/approve/:action/:id/:driver_id', checkLoggedInAdmin, approveValidation, validateRequest, (req, res, next) => {
        driverBreaksModule.approveBreak(req, res, next);
    });

    // Delete driver break
    router.all(modulePath + '/delete/:id/:driver_id', checkLoggedInAdmin, (req, res, next) => {
        driverBreaksModule.deleteBreak(req, res, next);
    });

    // Add driver break
    router.all(modulePath + '/add', checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        driverBreaksModule.addBreak(req, res, next);
    });

    // Cancel driver break
    router.all(modulePath + '/cancel/:id/:driver_id', checkLoggedInAdmin, cancelValidation, validateRequest, (req, res, next) => {
        driverBreaksModule.cancelBreak(req, res, next);
    });

    // End driver break
    router.all(modulePath + '/end_break/:break_id', checkLoggedInAdmin, (req, res, next) => {
        driverBreaksModule.endBreak(req, res, next);
    });

    // List driver breaks (with optional break_status param)
    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        driverBreaksModule.getBreaksList(req, res, next);
    });

    // List driver breaks (with optional break_status param)
    router.all(modulePath + '/:break_status', checkLoggedInAdmin, (req, res, next) => {
        driverBreaksModule.getBreaksList(req, res, next);
    });
} 