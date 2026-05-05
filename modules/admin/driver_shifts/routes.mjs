import { fileURLToPath } from 'url';
import { dirname } from 'path';
import driverShifts from './model/driver_shifts.mjs';
import { assignShiftValidation } from './validations.mjs';
import { validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure driver shifts routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
	const modulePath = '/driver_shifts';
	const driverShiftsModule = new driverShifts(db);

	// Set views for all /driver_shifts* routes
	router.use(modulePath, (req, res, next) => {
		req.rendering.views = __dirname + "/views";
		next();
	});

	// Get shift list
	router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
		driverShiftsModule.getShiftList(req, res, next);
	});

	// Add shift
	router.all(modulePath + "/add", checkLoggedInAdmin, assignShiftValidation, validateRequest, (req, res, next) => {
		driverShiftsModule.assignShift(req, res, next);
	});

	// Edit shift
	router.all(modulePath + "/edit/:id", checkLoggedInAdmin, assignShiftValidation, validateRequest, (req, res, next) => {
		driverShiftsModule.assignShift(req, res, next);
	});

	// Delete shift
	router.all(modulePath + "/delete/:id", checkLoggedInAdmin, (req, res, next) => {
		driverShiftsModule.deleteShift(req, res, next);
	});

	// Get area list
	router.post(modulePath + "/area_list", checkLoggedInAdmin, (req, res, next) => {
		driverShiftsModule.areaList(req, res, next);
	});

	// Export schedule
	router.get(modulePath + "/export_schedule/:from_date/:to_date", checkLoggedInAdmin, (req, res, next) => {
		driverShiftsModule.scheduleExport(req, res, next);
	});

    router.get(modulePath + "/export_schedule/:from_date/:to_date/:parent_id", checkLoggedInAdmin, (req, res, next) => {
		driverShiftsModule.scheduleExport(req, res, next);
	});

	// Send mail schedule
	router.get(modulePath + "/user_schedule", checkLoggedInAdmin, (req, res, next) => {
		driverShiftsModule.scheduleMail(req, res, next);
	});
    
    router.get(modulePath + "/user_schedule/:parent_id", checkLoggedInAdmin, (req, res, next) => {
		driverShiftsModule.scheduleMail(req, res, next);
	});
} 