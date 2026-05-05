import { fileURLToPath } from 'url';
import { dirname } from 'path';
import CuisinePriorities from "./model/cuisine_priorities.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure cuisine priorities routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath =   '/cuisine_priorities/:restaurant_id/:branch_id' ;
    const cuisinePrioritiesModule = new CuisinePriorities(db);

    // Set views for all /cuisine_priorities* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    /** Routing is used to get pending cuisine priorities list **/
    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        cuisinePrioritiesModule.getPendingCuisinePrioritiesList(req, res, next);
    });

    /** Routing is used to get cuisine priorities list **/
    router.all(`${modulePath}/get_approve_list`, checkLoggedInAdmin, (req, res, next) => {
        cuisinePrioritiesModule.getCuisinePrioritiesList(req, res, next);
    });

    /** Routing is used to select cuisine priority **/
    router.all(`${modulePath}/select_cuisine_priority`, checkLoggedInAdmin, (req, res, next) => {
        cuisinePrioritiesModule.selectCuisinePriority(req, res, next);
    });
} 