import { fileURLToPath } from 'url';
import { dirname } from 'path';
import DriverExcuses from './model/driver_excuses.mjs';
import { rejectValidation, cancelValidation } from './validations.mjs';
import {validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure driver excuses routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/driver_excuses';
    const driverExcusesModule = new DriverExcuses(db);

    // Set views for all /driver_excuses* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + '/views';
        next();
    });

    // List driver excuses
    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        driverExcusesModule.getExcusesList(req, res, next);
    });

    // Reject driver excuse
    router.all(modulePath + '/reject/:action/:id/:driver_id', checkLoggedInAdmin, rejectValidation, validateRequest, (req, res, next) => {
        driverExcusesModule.rejectExcuse(req, res, next);
    });

    // Approve driver excuse
    router.all(modulePath + '/approve/:id/:driver_id', checkLoggedInAdmin, (req, res, next) => {
        driverExcusesModule.approveExcuse(req, res, next);
    });

    // Delete driver excuse
    router.all(modulePath + '/delete/:id/:driver_id', checkLoggedInAdmin, (req, res, next) => {
        driverExcusesModule.deleteExcuse(req, res, next);
    });

    // Cancel driver excuse
    router.all(modulePath + '/cancel/:id/:driver_id', checkLoggedInAdmin, cancelValidation, validateRequest, (req, res, next) => {
        driverExcusesModule.cancelExcuse(req, res, next);
    });
} 