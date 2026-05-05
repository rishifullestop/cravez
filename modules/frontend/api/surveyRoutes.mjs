import surveyModel from "./model/survey.mjs";
import { authenticateAPIPublicRequest } from "../../../middleware/middleware.mjs";
import {FRONT_END_NAME} from "../../../config/global_constant.mjs";
import { sendApiResponse } from "../../../utils/index.mjs";

/**
 * Configure survey routes
 *
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 */
export default function configure(router, { db }) {
    const modulePath = FRONT_END_NAME+'api/survey';
    const surveyModule   =  new surveyModel(db);

    router.post(modulePath + "/questions", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await surveyModule.getSurveyQuestionList(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/save", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await surveyModule.saveSurveyResponses(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/user-attempts", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await surveyModule.userAttempts(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });
}