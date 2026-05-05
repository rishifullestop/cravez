import paymentTransactionModel from "./model/payment_transactions.mjs";
import { authenticateAPIPublicRequest } from "../../../middleware/middleware.mjs";
import {FRONT_END_NAME} from "../../../config/global_constant.mjs";
import { sendApiResponse } from "../../../utils/index.mjs";

/**
 * Configure payment transaction routes
 *
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 */
export default function configure(router, { db }) {
    const modulePath = FRONT_END_NAME+'api/payment';
    const paymentTransactionModule  =  new paymentTransactionModel(db);

    router.post(modulePath + "/transactions", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await paymentTransactionModule.getPaymentTransactionList(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/execute-payment", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await paymentTransactionModule.executePayment(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/card-payment", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await paymentTransactionModule.cardPayment(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });
}