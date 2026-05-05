import { fileURLToPath } from 'url';
import { dirname } from 'path';
import shiftSetupController from "./model/shift_setup.mjs";
import { addEditValidation, assignShiftValidation, assignShiftTeamScheduleValidation} from "./validations.mjs";
import { validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure shift setup routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath             = '/shift_setup';
    const teamScheduleModulePath = '/team_schedule';
    const shiftSetupModule = new shiftSetupController(db);

    // Set views for all /shift_setup* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    // Set views for all /team_schedule* routes
    router.use(teamScheduleModulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    // Get shift list
    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        shiftSetupModule.getShiftList(req, res, next);
    });

    // Add shift
    router.all(modulePath + "/add", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        shiftSetupModule.addEditShift(req, res, next);
    });

    // Edit shift
    router.all(modulePath + "/edit/:id", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        shiftSetupModule.addEditShift(req, res, next);
    });

    // Delete shift
    router.all(modulePath + "/delete/:id", checkLoggedInAdmin, (req, res, next) => {
        shiftSetupModule.deleteShift(req, res, next);
    });

    // Assign shift
    router.all(modulePath + "/assign_shift/:shift_id", checkLoggedInAdmin, assignShiftValidation, validateRequest, (req, res, next) => {
        shiftSetupModule.assignShift(req, res, next);
    });

    // Assign shift with team availability ID
    router.all(modulePath + "/assign_shift/:shift_id/:id", checkLoggedInAdmin, assignShiftValidation, validateRequest, (req, res, next) => {
        shiftSetupModule.assignShift(req, res, next);
    });

    // Team schedule
    router.all(teamScheduleModulePath, checkLoggedInAdmin,(req, res, next) => {
        shiftSetupModule.teamSchedule(req, res, next);
    });

    // Schedule mail
    router.all(modulePath + "/user_schedule", checkLoggedInAdmin, (req, res, next) => {
        shiftSetupModule.scheduleMail(req, res, next);
    });

    // Schedule export
    router.all(modulePath + "/export_schedule/:from_date/:to_date", checkLoggedInAdmin, (req, res, next) => {
        shiftSetupModule.scheduleExport(req, res, next);
    });

    // Assign shift for team schedule
    router.all(teamScheduleModulePath + "/assign_shift", checkLoggedInAdmin, assignShiftTeamScheduleValidation, validateRequest, (req, res, next) => {
        shiftSetupModule.assignShiftForTeamSchedule(req, res, next);
    });
} 