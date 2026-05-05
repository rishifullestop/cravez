import { fileURLToPath } from 'url';
import { dirname } from 'path';
import TaskAssignment from "./model/task_assignment.mjs";
import { addEditValidation } from "./validations.mjs";
import { validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure task assignment routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/task_assignment';
    const taskAssignmentModule = new TaskAssignment(db);

    // Set views for all /task_assignment* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        taskAssignmentModule.getTaskList(req, res, next);
    });

    router.all(modulePath+"/add", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        taskAssignmentModule.addEditTask(req, res, next);
    });

    router.all(modulePath+"/edit/:id", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        taskAssignmentModule.addEditTask(req, res, next);
    });

    router.get(modulePath+"/delete/:id", checkLoggedInAdmin, (req, res, next) => {
        taskAssignmentModule.deleteTask(req, res, next);
    });
} 