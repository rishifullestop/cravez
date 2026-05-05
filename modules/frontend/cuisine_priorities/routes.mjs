import { fileURLToPath } from 'url';
import { dirname } from 'path';
import CuisinePriorities from "./model/cuisine_priorities.mjs";
import { rejectionValidation } from "./validations.mjs";
import { validateRequest } from "../../../utils/index.mjs";
import * as Constants from "../../../config/global_constant.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure cuisine priorities routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedIn - Middleware to check user authentication
 */
export default function configure(router, { db, checkLoggedIn }) {
    const modulePath = Constants.FRONT_END_NAME + "cuisine_priorities/:restaurant_id/:branch_id";
    const cuisinePrioritiesModule = new CuisinePriorities(db);

    // Set views for all /cuisine_priorities* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    // Routing is used to get cuisine priorities list
    router.all(modulePath, checkLoggedIn, (req, res, next) => {
        cuisinePrioritiesModule.getPendingCuisinePrioritiesList(req, res, next);
    });

    // Routing is used to get cuisine priorities list
    router.all(modulePath + "/get_approve_list", checkLoggedIn, (req, res, next) => {
        cuisinePrioritiesModule.getCuisinePrioritiesList(req, res, next);
    });

    // Routing is used to reject cuisine priorities
    router.post(modulePath + "/reject", checkLoggedIn, rejectionValidation, validateRequest, (req, res, next) => {
        cuisinePrioritiesModule.rejectCuisinePriorities(req, res, next);
    });

    // Routing is used to approve cuisine priorities
    router.get(modulePath + "/approve", checkLoggedIn, (req, res, next) => {
        cuisinePrioritiesModule.approveCuisinePriorities(req, res, next);
    });
} 