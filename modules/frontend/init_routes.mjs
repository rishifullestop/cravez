import { Router } from 'express';
import * as Constants from "../../config/global_constant.mjs";
import {send404Page} from "../../middleware/middleware.mjs";

export default async function getRestaurantRouter({ db, isLoggedIn, csrfRouteMiddleware, checkLoggedIn }) {
    const router = Router();

    // List all restaurant modules here (folder names)
    const restaurantModules = [
        "users",
        "cuisine_priorities",
        "import_managers",
        "cuisines",
        "notifications",
        "restaurants",
        "ticket_management",
        "user_permissions",
        "reports",
        "orders"
    ];

    try {
        // Dynamically import and initialize each module's routes
        for (const key of restaurantModules) {
            const tmpRoutes = await import(Constants.WEBSITE_MODULES_PATH + `${key}/routes.mjs`);
            tmpRoutes.default(router, { db, isLoggedIn, csrfRouteMiddleware, checkLoggedIn });
        }
    } catch (error) {
        console.log("error ===>", error);
    }


    // 404 handler for all unmatched restaurant routes
    router.use((req, res) => {
        send404Page(req, res);
    });

    return router;
}