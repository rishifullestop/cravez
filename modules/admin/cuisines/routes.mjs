import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Cuisine from './model/cuisine.mjs';
import { addEditValidation } from './validations.mjs';
import {validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure cuisines routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/cuisines';
    const cuisineModule = new Cuisine(db);

    // Set views for all /cuisines* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + '/views';
        next();
    });

    // List
    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        cuisineModule.getCuisinesList(req, res, next);
    });

    // Add
    router.all(modulePath + '/add', checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        cuisineModule.addEditCuisine(req, res, next);
    });

    // Edit
    router.all(modulePath + '/edit/:id', checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        cuisineModule.addEditCuisine(req, res, next);
    });

    // Status update
    router.all(modulePath + '/update-status/:id/:status', checkLoggedInAdmin, (req, res, next) => {
        cuisineModule.updateCuisineStatus(req, res, next);
    });

    // Select cuisine priority
    router.all(modulePath + '/select_cuisine_priority', checkLoggedInAdmin, (req, res, next) => {
        cuisineModule.selectCuisinePriority(req, res, next);
    });
} 