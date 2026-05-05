import { fileURLToPath } from 'url';
import { dirname } from 'path';
import DriverInOutShifts from './model/driver_in_out_shifts.mjs';
import { updateKilometerValidation } from './validations.mjs';
import {validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure driver in/out shifts routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/driver_in_out_shifts';
    const driverInOutShiftsModule = new DriverInOutShifts(db);

    // Set views for all /driver_in_out_shifts* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + '/views';
        next();
    });

    // List driver in/out shifts
    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        driverInOutShiftsModule.getInOutShiftList(req, res, next);
    });

    // Update kilometer
    router.post(modulePath + '/update_kilometer', checkLoggedInAdmin, updateKilometerValidation, validateRequest, (req, res, next) => {
        driverInOutShiftsModule.updateShiftKilometer(req, res, next);
    });
} 