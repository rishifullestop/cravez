import vocModel from "./model/voc.mjs";
import { authenticateAPIPublicRequest } from "../../../middleware/middleware.mjs";
import {FRONT_END_NAME} from "../../../config/global_constant.mjs";
import { sendApiResponse } from "../../../utils/index.mjs";

/**
 * Configure voc routes
 *
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 */
export default function configure(router, { db }) {
    const modulePath = FRONT_END_NAME+'api/voc';
    const vocModule   =  new vocModel(db);

    router.post(modulePath + "/questions", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await vocModule.getVocQuestionList(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/save", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await vocModule.saveVocResponses(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });
}