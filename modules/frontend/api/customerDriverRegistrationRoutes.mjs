import customerDriverModel from "./model/customer_driver_registration.mjs";
import { authenticateAPIPublicRequest } from "../../../middleware/middleware.mjs";
import {FRONT_END_NAME} from "../../../config/global_constant.mjs";
import { sendApiResponse } from "../../../utils/index.mjs";

/**
 * Configure customer driver registration routes
 *
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 */
export default function configure(router, { db }) {
    const modulePath = FRONT_END_NAME+'api';
    const customerDriverModule   =  new customerDriverModel(db);

    router.post(modulePath + "/registration/customer", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await customerDriverModule.customerRegistration(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/registration/driver", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await customerDriverModule.driverRegistration(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/auth/login", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await customerDriverModule.login(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/auth/send-verification-mail", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await customerDriverModule.sendVerificationMail(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/auth/forgot-password", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await customerDriverModule.forgotPassword(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/auth/resend-otp", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await customerDriverModule.resendOtp(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/auth/verify-mobile-number", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await customerDriverModule.verifyMobileNumber(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/auth/verify-email", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await customerDriverModule.verifyEmailAddress(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/auth/reset-password", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await customerDriverModule.customerDriverResetPassword(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/auth/send-reclaim-otp", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await customerDriverModule.sendReclaimOTP(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/auth/reclaim-account", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await customerDriverModule.reClaimAccount(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/auth/logout", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await customerDriverModule.logOut(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/auth/verify-forget-token", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await customerDriverModule.verifyForgetPasswordString(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });
}