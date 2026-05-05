import { fileURLToPath } from 'url';
import { dirname } from 'path';
import TextSetting from "./model/text_setting.mjs";
import { addEditValidation } from "./validations.mjs";
import { validateRequest, convertMultipartReqBody } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure text setting routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/text-setting/';
    const textSettingModule = new TextSetting(db);

    // Set views for all /text-setting* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    router.all(modulePath+":type", checkLoggedInAdmin, (req, res, next) => {
        textSettingModule.getTextSettingList(req, res, next);
    });

    router.all(modulePath+":type/add", checkLoggedInAdmin, convertMultipartReqBody, addEditValidation, validateRequest, (req, res, next) => {
        textSettingModule.addEditTextSetting(req, res, next);
    });

    router.all(modulePath+":type/edit/:id", checkLoggedInAdmin, convertMultipartReqBody, addEditValidation, validateRequest, (req, res, next) => {
        textSettingModule.addEditTextSetting(req, res, next);
    });

    router.all(modulePath+":type/writeFileDirectly", checkLoggedInAdmin, (req, res, next) => {
        textSettingModule.writeFileDirectly(req, res, next);
    });
} 