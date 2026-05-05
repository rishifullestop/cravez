import { fileURLToPath } from 'url';
import { dirname } from 'path';
import leaveManagementController from "./model/leave_management.mjs";
import { addEditVacationRequestValidation, addWeeklyOffValidation} from "./validations.mjs";
import { validateRequest, convertMultipartReqBody } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure leave management routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/leave_management';
    let basePath     = modulePath + "/vacation_request";
    const leaveModule = new leaveManagementController(db);

    // Set views for all /leave_management* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    // Vacation Request Routes
    router.all(basePath, checkLoggedInAdmin, (req, res, next) => {
        leaveModule.getVacationRequestList(req, res, next);
    });

    router.all(basePath + "/add", checkLoggedInAdmin, addEditVacationRequestValidation,validateRequest, (req, res, next) => {
        leaveModule.addEditVacationRequest(req, res, next);
    });

    router.all(basePath + "/edit/:id", checkLoggedInAdmin, addEditVacationRequestValidation, validateRequest, (req, res, next) => {
        leaveModule.addEditVacationRequest(req, res, next);
    });

    router.all(basePath + "/delete/:id", checkLoggedInAdmin,(req, res, next) => {
        leaveModule.vacationRequestDelete(req, res, next);
    });

    /** Routing is used to update request status **/
    router.post(basePath + "/update_request_status", checkLoggedInAdmin, (req, res, next) => {
        leaveModule.updateRequestStatus(req, res, next);
    });

    // Weekly Off Routes
    router.all(basePath + "/add_weekly_off", checkLoggedInAdmin, addWeeklyOffValidation, validateRequest, (req, res, next) => {
        leaveModule.addWeeklyOff(req, res, next);
    });

    router.all(basePath + "/edit_weekly_off/:id", checkLoggedInAdmin, addWeeklyOffValidation, validateRequest, (req, res, next) => {
        leaveModule.addWeeklyOff(req, res, next);
    });

    // Leave Master Routes
    router.all(modulePath + "/leave_master", checkLoggedInAdmin, convertMultipartReqBody,(req, res, next) => {
        leaveModule.masterLeave(req, res, next);
    });

    // Export Routes
    router.all(basePath + "/export_data/:export_count/:export_type", checkLoggedInAdmin, (req, res, next) => {
        leaveModule.exportData(req, res, next);
    });

    // View Leave Balance Route
    router.all(basePath + "/view_leave_balance/:id", checkLoggedInAdmin, (req, res, next) => {
        leaveModule.viewLeaveBalance(req, res, next);
    });
} 