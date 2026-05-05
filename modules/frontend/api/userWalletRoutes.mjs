import userWalletModel from "./model/user_wallet.mjs";
import { authenticateAPIPublicRequest, authenticateAPIPrivateRequest } from "../../../middleware/middleware.mjs";
import {FRONT_END_NAME} from "../../../config/global_constant.mjs";
import { sendApiResponse } from "../../../utils/index.mjs";

/**
 * Configure user-wallet routes
 *
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 */
export default function configure(router, { db }) {
    const modulePath = FRONT_END_NAME+'api/wallet';
    const userWalletModule   =  new userWalletModel(db);

    router.post(modulePath + "/add-money", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await userWalletModule.addMoney(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/transactions", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await userWalletModule.getWalletLogs(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/transfer-balance", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await userWalletModule.transferBalance(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/transfer-balance/list", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await userWalletModule.getTransferBalanceList(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/transfer-balance/update-status", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await userWalletModule.updateTransferBalanceStatus(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });
}