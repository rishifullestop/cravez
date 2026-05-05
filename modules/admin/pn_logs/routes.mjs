import { fileURLToPath } from 'url';
import { dirname } from 'path';
import PnLogs from "./model/pn_logs.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure pn logs routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/pn_logs';
    const pnLogsModule = new PnLogs(db);

    // Set views for all /pn_logs* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        pnLogsModule.list(req, res, next);
    });

    router.all(modulePath+"/view/:id", checkLoggedInAdmin, (req, res, next) => {
        pnLogsModule.viewDetails(req, res, next);
    });
} 