import { fileURLToPath } from 'url';
import { dirname } from 'path';
import EmailLog from "./model/email_log.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure email logs routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/email_logs';
    const emailLogModule = new EmailLog(db);

    // Set views for all /email_logs* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        emailLogModule.list(req, res, next);
    });

    router.get(modulePath+"/view/:id", checkLoggedInAdmin, (req, res, next) => {
        emailLogModule.viewDetails(req, res, next);
    });
} 