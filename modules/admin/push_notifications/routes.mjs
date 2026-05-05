import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pushNotifications from "./model/push_notifications.mjs";
import { addEditValidation } from "./validations.mjs";
import { validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure push notifications routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/push_notifications';
    const pushNotificationsModule = new pushNotifications(db);

    // Set views for all /push_notifications* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        pushNotificationsModule.getPNList(req, res, next);
    });

    router.all(modulePath+"/add", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        pushNotificationsModule.addEditNotification(req, res, next);
    });

    router.all(modulePath+"/edit/:id", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        pushNotificationsModule.addEditNotification(req, res, next);
    });

    router.get(modulePath+"/delete/:id", checkLoggedInAdmin, (req, res, next) => {
        pushNotificationsModule.deleteNotification(req, res, next);
    });

    router.get(modulePath+"/view/:id", checkLoggedInAdmin, (req, res, next) => {
        pushNotificationsModule.viewPNDetails(req, res, next);
    });

    router.post(modulePath+"/get_user_dropdown", checkLoggedInAdmin, (req, res, next) => {
        pushNotificationsModule.getUserDropdown(req, res, next);
    });
} 