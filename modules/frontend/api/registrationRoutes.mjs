import registrationModel from "./model/registration.mjs";
import { authenticateAPIPublicRequest } from "../../../middleware/middleware.mjs";
import {FRONT_END_NAME} from "../../../config/global_constant.mjs";
import { sendApiResponse } from "../../../utils/index.mjs";

/**
 * Configure restaurant registration routes
 *
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 */
export default function configure(router, { db }) {
    const modulePath = FRONT_END_NAME+'api/restaurant';
    const registrationModule   =  new registrationModel(db);

    router.post(modulePath + "/login", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await registrationModule.login(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/logOut", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await registrationModule.logOut(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/forgot-password", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await registrationModule.forgotPassword(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/reset-password", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await registrationModule.resetPassword(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/resend-otp", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await registrationModule.resendOtp(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/verify-otp", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await registrationModule.verifyOTP(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });
}