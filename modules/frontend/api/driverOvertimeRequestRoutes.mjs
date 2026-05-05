import driverOvertimeRequestModel from "./model/driver_overtime_request.mjs";
import { authenticateAPIPublicRequest, authenticateAPIPrivateRequest } from "../../../middleware/middleware.mjs";
import {FRONT_END_NAME} from "../../../config/global_constant.mjs";
import { sendApiResponse } from "../../../utils/index.mjs";

/**
 * Configure driver overtime request routes
 *
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 */
export default function configure(router, { db }) {
    const modulePath = FRONT_END_NAME+'api/driver/overtimes';
    const driverOvertimeRequestModule   =  new driverOvertimeRequestModel(db);

    router.post(modulePath, authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await driverOvertimeRequestModule.getDriverExcuses(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });
}