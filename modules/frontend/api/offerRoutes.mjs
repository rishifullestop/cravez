import offerModel from "./model/offer.mjs";
import { authenticateAPIPublicRequest } from "../../../middleware/middleware.mjs";
import {FRONT_END_NAME} from "../../../config/global_constant.mjs";
import { sendApiResponse } from "../../../utils/index.mjs";

/**
 * Configure offer routes
 *
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 */
export default function configure(router, { db }) {
    const modulePath = FRONT_END_NAME+'api/offers';
    const offerModule   =  new offerModel(db);

    router.post(modulePath + "/verify-code", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await offerModule.checkOffer(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "my-offers", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await offerModule.getMyOfferList(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "redemption", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await offerModule.offerRedemption(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "scratch-card", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await offerModule.scratchCard(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "branch-offers", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await offerModule.branchWiseMyOfferList(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "detail", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await offerModule.getOfferDetails(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });
}