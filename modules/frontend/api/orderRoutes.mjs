import orderModel from "./model/order.mjs";
import { authenticateAPIPublicRequest } from "../../../middleware/middleware.mjs";
import {FRONT_END_NAME} from "../../../config/global_constant.mjs";
import { sendApiResponse } from "../../../utils/index.mjs";

/**
 * Configure order routes
 *
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 */
export default function configure(router, { db }) {
    const modulePath = FRONT_END_NAME+'api/orders';
    const orderModule   =  new orderModel(db);

    router.post(modulePath, authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await orderModule.getOrdersList(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/place", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await orderModule.placeOrder(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/place-modified-order", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await orderModule.placeModifierOrder(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/save-payment-transaction", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await orderModule.savePaymentTransactionDetails(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/detail", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await orderModule.getOrderDetails(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/accept-orders", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await orderModule.getAcceptedOrderList(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/mark-problematic", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await orderModule.markOrderProblematic(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/problematic-reasons", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await orderModule.orderProblematicReasonList(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/update-status", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await orderModule.updateOrderStatus(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/re-orders", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await orderModule.reOrder(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/customer/place-modified-order", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await orderModule.placeModifierOrderByCustomer(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/modified-order", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await orderModule.modifyOrder(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/cancel-modified-order", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await orderModule.cancelModifyOrder(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/post-review", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await orderModule.addOrderReview(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/count", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await orderModule.getOrdersCount(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/restaurant-count", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await orderModule.getRestaurantOrdersCount(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/cancel-reasons", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await orderModule.getCancelReason(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/pay-outstanding-amount", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await orderModule.payOutstandingAmountForOrder(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/running-orders", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await orderModule.getCustomerRunningOrderList(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });
}