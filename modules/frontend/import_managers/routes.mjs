import { fileURLToPath } from 'url';
import { dirname } from 'path';
import ImportManager from "./model/import_manager.mjs";
import { addRequestValidation } from "./validations.mjs";
import { validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure import managers routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedIn - Middleware to check user authentication
 */
export default function configure(router, { db, checkLoggedIn }) {
    const modulePath = '/import_managers';
    const importManagerModule = new ImportManager(db);

    // Set views for all /import_managers* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    // Routing is used to get import manager list
    router.all(modulePath, checkLoggedIn, (req, res, next) => {
        importManagerModule.getImportManagerList(req, res, next);
    });

    // Routing is used to add import manager
    router.all(modulePath + "/add", checkLoggedIn, addRequestValidation, validateRequest, (req, res, next) => {
        importManagerModule.addImportManager(req, res, next);
    });

    // Routing is used to download file
    router.get(modulePath + "/download/:id", checkLoggedIn, (req, res, next) => {
        importManagerModule.downloadFile(req, res, next);
    });
} 