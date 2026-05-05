import { fileURLToPath } from 'url';
import { dirname } from 'path';
import SystemLog from "./model/system_log.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure system logs routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/system_logs';
    const systemLogModule = new SystemLog(db);

    // Set views for all /system_logs* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

	/** Routing is used to get system logs list **/	
    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        systemLogModule.list(req, res, next);
    });
} 