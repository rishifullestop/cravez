import customerAddressModel from "./model/customer_address.mjs";
import { authenticateAPIPublicRequest } from "../../../middleware/middleware.mjs";
import {FRONT_END_NAME} from "../../../config/global_constant.mjs";
import { sendApiResponse } from "../../../utils/index.mjs";

/**
 * Configure customer address routes
 *
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 */
export default function configure(router, { db }) {
    const modulePath = FRONT_END_NAME+'api/customer/address';
    const customerAddressModule   =  new customerAddressModel(db);

    router.post(modulePath + "/list", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await customerAddressModule.getAddressList(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/add", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await customerAddressModule.addEditAddress(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/details", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await customerAddressModule.getAddressDetails(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/edit", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await customerAddressModule.addEditAddress(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/delete", authenticateAPIPublicRequest, async (req, res, next) => {
        let apiResponse = await customerAddressModule.deleteAddress(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });
}