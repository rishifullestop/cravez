import { fileURLToPath } from 'url';
import { dirname } from 'path';
import SuperPackages from "./model/super_packages.mjs";
import { addEditValidation } from "./validations.mjs";
import { validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure super packages routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/super_packages';
    const superPackagesModule = new SuperPackages(db);

    // Set views for all /super_packages* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        superPackagesModule.getPackageList(req, res, next);
    });

    router.all(modulePath+"/add", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        superPackagesModule.addEditSuperPackage(req, res, next);
    });

    router.all(modulePath+"/edit/:id", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        superPackagesModule.addEditSuperPackage(req, res, next);
    });

    router.get(modulePath+"/delete/:id", checkLoggedInAdmin, (req, res, next) => {
        superPackagesModule.deletePackage(req, res, next);
    });
} 