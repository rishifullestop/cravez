import { fileURLToPath } from 'url';
import { dirname } from 'path';
import ScreenVisitLogs from "./model/screen_visit_logs.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure screen visit logs routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/screen_visit_logs';
    const screenVisitLogsModule = new ScreenVisitLogs(db);

    // Set views for all /screen_visit_logs* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        screenVisitLogsModule.getScreenVisitList(req, res, next);
    });

    /** Routing is used to get screen visit list **/
    router.post(modulePath+"/get_user_list",checkLoggedInAdmin,(req, res,next) => {
        screenVisitLogsModule.getUsersList(req, res,next);
    });

}