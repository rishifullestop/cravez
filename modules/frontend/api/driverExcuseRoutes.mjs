import driverExcuseModel from "./model/driver_excuse.mjs";
import { authenticateAPIPublicRequest, authenticateAPIPrivateRequest } from "../../../middleware/middleware.mjs";
import {FRONT_END_NAME} from "../../../config/global_constant.mjs";
import { sendApiResponse } from "../../../utils/index.mjs";

/**
 * Configure driver excuse routes
 *
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 */
export default function configure(router, { db }) {
    const modulePath = FRONT_END_NAME+'api/driver/excuses';
    const driverExcuseModule   =  new driverExcuseModel(db);

    router.post(modulePath + "/list", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await driverExcuseModule.getDriverExcuses(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/post", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await driverExcuseModule.postDriverExcuse(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });
}