import { fileURLToPath } from 'url';
import { dirname } from 'path';
import ManageVehicles from "./model/manage_vehicles.mjs";
import { addEditValidation } from "./validations.mjs";
import { validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure manage vehicles routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/manage_vehicles';
    const manageVehiclesModule = new ManageVehicles(db);

    // Set views for all /manage_vehicles* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        manageVehiclesModule.getManageVehicleList(req, res, next);
    });

    router.get(modulePath+"/export_data/:export_count/:export_type", checkLoggedInAdmin, (req, res, next) => {
        manageVehiclesModule.exportData(req, res, next);
    });

    router.all(modulePath+"/add", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        manageVehiclesModule.addEditVehicle(req, res, next);
    });

    router.all(modulePath+"/edit/:id", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        manageVehiclesModule.addEditVehicle(req, res, next);
    });
} 