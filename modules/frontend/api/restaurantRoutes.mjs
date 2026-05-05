import restaurantModel from "./model/restaurant.mjs";
import { authenticateAPIPublicRequest } from "../../../middleware/middleware.mjs";
import {FRONT_END_NAME} from "../../../config/global_constant.mjs";
import { sendApiResponse } from "../../../utils/index.mjs";

/**
 * Configure restaurant routes
 *
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 */
export default function configure(router, { db }) {
    const modulePath = FRONT_END_NAME+'api/restaurants';
    const restaurantModule   =  new restaurantModel(db);

    router.post(modulePath, authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await restaurantModule.getRestaurantList(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/areas", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await restaurantModule.getAreaList(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/items", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await restaurantModule.getItemList(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/categories-items", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await restaurantModule.getCategoryListWithItem(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/items/detail", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await restaurantModule.getItemDetails(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/items/choices", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await restaurantModule.getItemChoiceList(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/payment-methods", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await restaurantModule.getPaymentMethods(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });
}