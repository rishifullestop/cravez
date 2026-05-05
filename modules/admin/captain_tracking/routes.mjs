import { fileURLToPath } from 'url';
import { dirname } from 'path';
import captainTracking from "./model/captain_tracking.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure captain tracking routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/captain_tracking';
    const captainTrackingModule = new captainTracking(db);

    // Set views for all /captain_tracking* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        captainTrackingModule.getCaptainTrackingList(req, res, next);
    });

    router.post(modulePath + "/get_captain_location", checkLoggedInAdmin, (req, res, next) => {
        captainTrackingModule.getCaptainLocation(req, res, next);
    });

    router.get(modulePath + "/update-force-active/:id/:status", checkLoggedInAdmin, (req, res, next) => {
        captainTrackingModule.updateForceActiveStatus(req, res, next);
    });

    router.post(modulePath + "/get_captain_deliveries", checkLoggedInAdmin, (req, res, next) => {
        captainTrackingModule.getCaptainDeliveriesList(req, res, next);
    });

    router.all(modulePath + "/get_captain_voc_list/:order_id", checkLoggedInAdmin, (req, res, next) => {
        captainTrackingModule.getCaptainVOCList(req, res, next);
    });

    router.all(modulePath + "/get_captain_ticket_list/:order_id", checkLoggedInAdmin, (req, res, next) => {
        captainTrackingModule.getCaptainTicketList(req, res, next);
    });

    router.get(modulePath + "/get_captain_stats/:id", checkLoggedInAdmin, (req, res, next) => {
        captainTrackingModule.getCaptainStats(req, res, next);
    });

    router.get(modulePath + "/get_captain_rules", checkLoggedInAdmin, (req, res, next) => {
        captainTrackingModule.getCaptainRules(req, res, next);
    });

    router.get(modulePath + "/suspend-status/:id/:status", checkLoggedInAdmin, (req, res, next) => {
        captainTrackingModule.updateSuspendStatus(req, res, next);
    });

    router.get(modulePath + "/tickets/add_comment/:ticket_id", checkLoggedInAdmin, (req, res, next) => {
        captainTrackingModule.addTicketComment(req, res, next);
    });

    router.get(modulePath + "/assign_captain_list/:order_id", checkLoggedInAdmin, (req, res, next) => {
        captainTrackingModule.assignCaptainList(req, res, next);
    });

    router.post(modulePath + "/order_reassign_to_captain", checkLoggedInAdmin, (req, res, next) => {
        captainTrackingModule.orderReassignToCaptain(req, res, next);
    });
} 