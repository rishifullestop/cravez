import { fileURLToPath } from 'url';
import { dirname } from 'path';
import RestaurantCuisine from "./model/restaurant_cuisine.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure restaurant cuisine routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/restaurant_cuisine';
    const restaurantCuisineModule = new RestaurantCuisine(db);

    // Set views for all /restaurant_cuisine* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    router.get(modulePath, checkLoggedInAdmin, (req, res, next) => {
        restaurantCuisineModule.getRestaurantCuisinesList(req, res, next);
    });

    router.get(modulePath+"/:slug", checkLoggedInAdmin, (req, res, next) => {
        restaurantCuisineModule.getRestaurantCuisinesList(req, res, next);
    });

    router.all(modulePath+"/:slug/:id/select_cuisines", checkLoggedInAdmin, (req, res, next) => {
        restaurantCuisineModule.selectRestaurantCuisines(req, res, next);
    });

    router.all(modulePath+"/:slug/get-cuisine-list", checkLoggedInAdmin, (req, res, next) => {
        restaurantCuisineModule.appendCuisinesList(req, res, next);
    });
} 