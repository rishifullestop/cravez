import { fileURLToPath } from 'url';
import { dirname } from 'path';
import OrderAssignment from "./model/order_assignment.mjs";
import OrderAssignmentProcess from "./model/order_assignment_process.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure order assignment routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/order_assignment';
    const processModulePath = '/order_assignment_process';
    const orderAssignmentModule = new OrderAssignment(db);
    const orderAssignmentProcessModule = new OrderAssignmentProcess(db);

    // Set views for all order assignment routes
    router.use([modulePath, processModulePath], (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        orderAssignmentModule.getOrderAssignmentList(req, res, next);
    });

    router.all(processModulePath+"/:order_id", checkLoggedInAdmin, (req, res, next) => {
        orderAssignmentProcessModule.getOrderAssignmentProcessList(req, res, next);
    });
} 