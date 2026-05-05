import { fileURLToPath } from 'url';
import { dirname } from 'path';
import AreaAssignment from './model/fleet_area_assignment.mjs';
import { assignAreaValidation } from './validations.mjs';
import { validateRequest } from '../../../utils/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure email actions routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/fleet_area_assignment';
    const areaAssignmentModule = new AreaAssignment(db);

    // Set views for all /fleet_area_assignment* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + '/views';
        next();
    });

    /** Routing is used to get fleet area assignment list **/
    router.all(modulePath,checkLoggedInAdmin,(req, res,next) => {
        areaAssignmentModule.getAreaList(req, res,next);
    });

    /** Routing is used to assign fleet area **/
    router.all(modulePath+"/add",checkLoggedInAdmin,assignAreaValidation, validateRequest,(req, res, next) => {
        areaAssignmentModule.assignArea(req, res, next);
    });

    /** Routing is used to edit fleet area assignment **/
    router.all(modulePath+"/edit/:id",checkLoggedInAdmin,assignAreaValidation, validateRequest,(req, res, next) => { 
        areaAssignmentModule.assignArea(req, res, next);
    });

    /** Routing is used to get area list**/
    router.post(modulePath+"/area_list",checkLoggedInAdmin,(req, res, next) => {
        areaAssignmentModule.areaList(req, res, next);
    });
} 
