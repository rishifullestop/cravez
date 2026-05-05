import myAccountModel from "./model/my_account.mjs";
import { authenticateAPIPublicRequest, authenticateAPIPrivateRequest } from "../../../middleware/middleware.mjs";
import {FRONT_END_NAME} from "../../../config/global_constant.mjs";
import { sendApiResponse } from "../../../utils/index.mjs";

/**
 * Configure my account routes
 *
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 */
export default function configure(router, { db }) {
    const modulePath = FRONT_END_NAME+'api';
    const myAccountModule   =  new myAccountModel(db);

    router.post(modulePath + "/user/update-profile", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await myAccountModule.updateProfile(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/user/dashboard", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await myAccountModule.dashboard(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "user/detail", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await myAccountModule.getUserDetails(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "user/change-password", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await myAccountModule.changePassword(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "driver/update-profile", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await myAccountModule.driverEditProfile(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "customer/update-profile", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await myAccountModule.customerEditProfile(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post([
        modulePath + "driver/details",
        modulePath + "customer/details"
    ], authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await myAccountModule.getDriverCustomerDetails(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "user/send-mobile-otp", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await myAccountModule.sendOtpToMobile(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "customer/update-mobile-number", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await myAccountModule.updateCustomerMobileNumber(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "user/send-email-otp", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await myAccountModule.sendOtpToEmail(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "customer/update-email", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await myAccountModule.updateCustomerEmail(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "driver/update-location", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await myAccountModule.updateDriverLocation(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "driver/update-online-status", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await myAccountModule.updateOnlineOfflineStatus(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "driver/dashboard", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await myAccountModule.captainDashboard(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "user/location", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await myAccountModule.getUserLocation(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "customer/referral-detail", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await myAccountModule.getReferralDetails(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "driver/save-gps-logs", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await myAccountModule.saveDriverGPSLogs(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });
}