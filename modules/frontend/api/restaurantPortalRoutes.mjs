import restaurantPortalModel from "./model/restaurant_portal.mjs";
import { authenticateAPIPublicRequest, authenticateAPIPrivateRequest } from "../../../middleware/middleware.mjs";
import {FRONT_END_NAME} from "../../../config/global_constant.mjs";
import { sendApiResponse } from "../../../utils/index.mjs";

/**
 * Configure restaurant portal routes
 *
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 */
export default function configure(router, { db }) {
    const modulePath = FRONT_END_NAME+'api/restaurant';
    const restaurantPortalModule   =  new restaurantPortalModel(db);

    router.post(modulePath + "/assign-captain", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await restaurantPortalModule.assignCaptain(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/captain-info", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await restaurantPortalModule.getCaptainInfo(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/orders/update-status", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await restaurantPortalModule.updateOrderStatus(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/orders/reject", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await restaurantPortalModule.rejectOrderRequest(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/dashboard", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await restaurantPortalModule.restaurantDashboard(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });
}