import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Notification from "./model/notification.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure notifications routes
 * @param {Object} app - Express app instance
 * @param {Object} db - Database instance
 * @param {Function} checkLoggedInAdmin - Admin authentication middleware
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = "/notifications";
    const notification = new Notification(db);
    
    /** Set current view folder **/
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    /** Routing is used to show notification listing */
    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        notification.list(req, res, next);
    });

    /** Routing is used to get header notification */
    router.post(modulePath + "/get_header_notifications", (req, res, next) => {
        notification.getHeaderNotifications(req, res, next);
    });

    /** Routing is used to get header notification counter */
    router.post(modulePath + "/get_header_notifications_counter", (req, res, next) => {
        notification.getHeaderNotificationsCounter(req, res, next);
    });
} 