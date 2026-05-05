import { fileURLToPath } from 'url';
import { dirname } from 'path';
import AssignmentSlabs from "./model/assignment_slabs.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure assignment slabs routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath =   '/assignment_slabs' ;
    const assignmentSlabsModule = new AssignmentSlabs(db);

    // Set views for all /assignment_slabs* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    // List page and setup
    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        assignmentSlabsModule.setupDistance(req, res, next);
    });
} 