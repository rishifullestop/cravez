import { fileURLToPath } from 'url';
import { dirname } from 'path';
import CaptainAssigned from "./model/captain_assigned.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure captain assigned routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/captain_assigned';
    const captainAssignedModule = new CaptainAssigned(db);

    // Set views for all /captain_assigned* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    /**
     * Route to get assigned captain list
     * Displays area-wise captain assignments for fleet and cravez users
     */
    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        captainAssignedModule.getAssignedCaptainList(req, res, next);
    });
} 