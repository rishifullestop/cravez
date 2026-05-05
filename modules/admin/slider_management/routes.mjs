import { fileURLToPath } from 'url';
import { dirname } from 'path';
import SliderManagement from "./model/slider_management.mjs";
import { convertMultipartReqBody } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure slider management routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/slider_management';
    const sliderManagementModule = new SliderManagement(db);

    // Set views for all /slider_management* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    router.all(modulePath+"/:type", checkLoggedInAdmin, (req, res, next) => {
        sliderManagementModule.getSliderList(req, res, next);
    });

    router.all(modulePath+"/:type/add", checkLoggedInAdmin, convertMultipartReqBody, (req, res, next) => {
        sliderManagementModule.addEditSlider(req, res, next);
    });

    router.all(modulePath+"/:type/edit/:id", checkLoggedInAdmin, convertMultipartReqBody, (req, res, next) => {
        sliderManagementModule.addEditSlider(req, res, next);
    });

    router.get(modulePath+"/:type/delete/:id", checkLoggedInAdmin, (req, res, next) => {
        sliderManagementModule.deleteSlider(req, res, next);
    });

    router.get(modulePath+"/:type/update_status/:id/:status", checkLoggedInAdmin, (req, res, next) => {
        sliderManagementModule.updateSliderStatus(req, res, next);
    });
} 