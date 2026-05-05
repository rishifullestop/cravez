import { fileURLToPath } from 'url';
import { dirname } from 'path';
import DriverLeaveManagement from './model/driver_leave_management.mjs';
import { vacationRequestValidation, weeklyOffValidation, updateStatusValidation } from './validations.mjs';
import {validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure driver leave management routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/driver_leave_management';
    const leaveModule = new DriverLeaveManagement(db);

    // Set views for all /driver_leave_management* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + '/views';
        next();
    });

    // Add vacation request
    router.all(modulePath + '/driver_vacation_request/add', checkLoggedInAdmin, vacationRequestValidation, validateRequest, (req, res, next) => {
        leaveModule.addEditVacationRequest(req, res, next);
    });

    // Edit vacation request
    router.all(modulePath + '/driver_vacation_request/edit/:id', checkLoggedInAdmin, vacationRequestValidation, validateRequest, (req, res, next) => {
        leaveModule.addEditVacationRequest(req, res, next);
    });

    // List vacation requests
    router.all(modulePath + '/driver_vacation_request', checkLoggedInAdmin, (req, res, next) => {
        leaveModule.getVacationRequestList(req, res, next);
    });

    // Delete vacation request
    router.get(modulePath + '/driver_vacation_request/delete/:id', checkLoggedInAdmin, (req, res, next) => {
        leaveModule.vacationRequestDelete(req, res, next);
    });

    // Export vacation request data
    router.get(modulePath + '/driver_vacation_request/export_data/:export_count/:export_type', checkLoggedInAdmin, (req, res, next) => {
        leaveModule.exportData(req, res, next);
    });

    // View leave balance
    router.get(modulePath + '/driver_vacation_request/view_leave_balance/:id', checkLoggedInAdmin, (req, res, next) => {
        leaveModule.viewLeaveBalance(req, res, next);
    });

    // Add weekly off
    router.all(modulePath + '/driver_vacation_request/add_weekly_off', checkLoggedInAdmin, weeklyOffValidation, validateRequest, (req, res, next) => {
        leaveModule.addWeeklyOff(req, res, next);
    });

    // Edit weekly off
    router.all(modulePath + '/driver_vacation_request/edit_weekly_off/:id', checkLoggedInAdmin, weeklyOffValidation, validateRequest, (req, res, next) => {
        leaveModule.addWeeklyOff(req, res, next);
    });

    // Update pending request status
    router.all(modulePath + '/update_request_status', checkLoggedInAdmin, updateStatusValidation, validateRequest, (req, res, next) => {
        leaveModule.updateRequestStatus(req, res, next);
    });
} 