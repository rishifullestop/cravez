import userCartModel from "./model/user_carts.mjs";
import { authenticateAPIPublicRequest } from "../../../middleware/middleware.mjs";
import {FRONT_END_NAME} from "../../../config/global_constant.mjs";
import { sendApiResponse } from "../../../utils/index.mjs";

/**
 * Configure user cart routes
 *
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 */
export default function configure(router, { db }) {
    const modulePath = FRONT_END_NAME+'api/carts';
    const userCartModule   =  new userCartModel(db);

    router.post(modulePath, authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await userCartModule.getCartList(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/update", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await userCartModule.updateCart(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/remove-items", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await userCartModule.removeCartItems(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/count", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await userCartModule.getCartCount(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/update-qty", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await userCartModule.updateCartQty(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/wallet-balance", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await userCartModule.getUserWalletBalance(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/check-order-schedule", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await userCartModule.checkOrderSchedule(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/check-pick-order", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await userCartModule.checkOrderPickUpStore(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/check-delivery-address", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await userCartModule.checkDeliveryAddress(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/remove-offers", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await userCartModule.removeOfferFromCart(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/supplier-invoice", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await userCartModule.getSupplierInvoice(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });
}