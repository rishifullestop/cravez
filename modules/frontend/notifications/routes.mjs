import { fileURLToPath } from 'url';
import { dirname } from 'path';
import notification from "./model/notification.mjs";
import * as Constants from "../../../config/global_constant.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure notification routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedIn - Middleware to check user authentication
 */
export default function configure(router, { db, checkLoggedIn }) {
    const modulePath = Constants.FRONT_END_NAME + "notifications";
    const notificationModule = new notification(db);

    // Set views for all /notification* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    /**Routing is used to show notification listing */
	router.all(modulePath,checkLoggedIn,(req,res,next) => {
		notificationModule.list(req,res,next);
	});

	/**Routing is used to get header notificaion */
	router.post(modulePath+"/get_header_notifications",checkLoggedIn,(req,res,next)=>{
		notificationModule.getHeaderNotifications(req,res,next);
	});

	/**Routing is used to get header notification counter */
	router.post(modulePath+"/get_header_notifications_counter",checkLoggedIn,(req,res,next)=>{
		notificationModule.getHeaderNotificationsCounter(req,res,next);
	});
}
