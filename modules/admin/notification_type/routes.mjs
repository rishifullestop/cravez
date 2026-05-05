import { fileURLToPath } from 'url';
import { dirname } from 'path';
import NotificationTypes from "./model/notification_types.mjs";
import { addEditNotificationTypeValidation} from "./validations.mjs";
import { validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure notification type routes
 * @param {Object} app - Express app instance
 * @param {Object} db - Database instance
 * @param {Function} checkLoggedInAdmin - Admin authentication middleware
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = "/notification_types";
    const notificationTypes = new NotificationTypes(db);
    
    /** Set current view folder **/
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    /** Routing is used to show notification type listing */
    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {        
        notificationTypes.list(req, res, next);
    });

    /** Routing is used to add or edit notification type **/
    router.all(modulePath + "/add", checkLoggedInAdmin, addEditNotificationTypeValidation, validateRequest, (req, res, next) => {
        notificationTypes.addEditNotificationType(req, res, next);
    });

    /** Routing is used to add or edit notification type **/
    router.all(modulePath + "/edit/:id", checkLoggedInAdmin, addEditNotificationTypeValidation, validateRequest, (req, res, next) => {
        notificationTypes.addEditNotificationType(req, res, next);
    });
    
    /** Routing is used to delete notification type **/
    router.get(modulePath + "/delete/:id", checkLoggedInAdmin, (req, res, next) => {
        notificationTypes.deleteNotificationType(req, res, next);
    });
} 