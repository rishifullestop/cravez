import driverBreakModel from "./model/driver_breaks.mjs";
import { authenticateAPIPublicRequest, authenticateAPIPrivateRequest } from "../../../middleware/middleware.mjs";
import {FRONT_END_NAME} from "../../../config/global_constant.mjs";
import { sendApiResponse } from "../../../utils/index.mjs";

/**
 * Configure driver breaks routes
 *
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 */
export default function configure(router, { db }) {
    const modulePath = FRONT_END_NAME+'api/driver';
    const driverBreakModule   =  new driverBreakModel(db);

    router.post(modulePath + "/breaks/update", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await driverBreakModule.updateDriverBreaks(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/breaks/list", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await driverBreakModule.getBreaks(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/in-out-shift/update", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await driverBreakModule.updateInOutShifts(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/in-out-shift/list", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await driverBreakModule.getInOutShifts(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/service/save", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await driverBreakModule.driverService(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });

    router.post(modulePath + "/fueling/save", authenticateAPIPublicRequest, authenticateAPIPrivateRequest, async (req, res, next) => {
        let apiResponse = await driverBreakModule.driverFueling(req, res, next);
        sendApiResponse(req, res, next, apiResponse);
    });
}