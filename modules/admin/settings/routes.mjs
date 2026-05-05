import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Setting from "./model/setting.mjs";
import { addEditSettingValidation, prefixSettingsValidation } from "./validations.mjs";
import { validateRequest, convertMultipartReqBody } from "../../../utils/index.mjs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure settings routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/settings';
    const settingsModule = new Setting(db);

    // Set views for all /settings* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    // Get settings list
    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        settingsModule.getSettingList(req, res, next);
    });

    // Add setting
    router.all(modulePath + "/add", checkLoggedInAdmin, addEditSettingValidation, validateRequest, (req, res, next) => {
        settingsModule.addSetting(req, res, next);
    });

    // Delete setting
    router.all(modulePath + "/delete/:id", checkLoggedInAdmin, (req, res, next) => {
        settingsModule.deleteSetting(req, res, next);
    });

    // Edit setting
    router.all(modulePath + "/edit/:id", checkLoggedInAdmin, addEditSettingValidation, validateRequest, (req, res, next) => {
        settingsModule.editSetting(req, res, next);
    });

    // Prefix settings routes for different types
    router.all(modulePath + "/prefix/Site", checkLoggedInAdmin, convertMultipartReqBody, prefixSettingsValidation, (req, res, next) => {
        req.params.type = "Site";
        settingsModule.prefix(req, res, next);
    });

    router.all(modulePath + "/prefix/Email", checkLoggedInAdmin, convertMultipartReqBody, prefixSettingsValidation, (req, res, next) => {
        req.params.type = "Email";
        settingsModule.prefix(req, res, next);
    });

    router.all(modulePath + "/prefix/Twilio", checkLoggedInAdmin, convertMultipartReqBody, prefixSettingsValidation, (req, res, next) => {
        req.params.type = "Twilio";
        settingsModule.prefix(req, res, next);
    });

    router.all(modulePath + "/prefix/Rewards_and_referrals", checkLoggedInAdmin, convertMultipartReqBody, prefixSettingsValidation, (req, res, next) => {
        req.params.type = "Rewards_and_referrals";
        settingsModule.prefix(req, res, next);
    });

    router.all(modulePath + "/prefix/Points_system", checkLoggedInAdmin, convertMultipartReqBody, prefixSettingsValidation, (req, res, next) => {
        req.params.type = "Points_system";
        settingsModule.prefix(req, res, next);
    });

    router.all(modulePath + "/prefix/SMS", checkLoggedInAdmin, convertMultipartReqBody, prefixSettingsValidation, (req, res, next) => {
        req.params.type = "SMS";
        settingsModule.prefix(req, res, next);
    });

    router.all(modulePath + "/prefix/Order_Assignment", checkLoggedInAdmin, convertMultipartReqBody, prefixSettingsValidation, (req, res, next) => {
        req.params.type = "Order_Assignment";
        settingsModule.prefix(req, res, next);
    });

    router.all(modulePath + "/prefix/Refund_Permission", checkLoggedInAdmin, convertMultipartReqBody, prefixSettingsValidation, (req, res, next) => {
        req.params.type = "Refund_Permission";
        settingsModule.prefix(req, res, next);
    });

    router.all(modulePath + "/prefix/System_images", checkLoggedInAdmin, convertMultipartReqBody, prefixSettingsValidation, (req, res, next) => {
        req.params.type = "System_images";
        settingsModule.prefix(req, res, next);
    });

    router.all(modulePath + "/prefix/App", checkLoggedInAdmin, convertMultipartReqBody, prefixSettingsValidation, (req, res, next) => {
        req.params.type = "App";
        settingsModule.prefix(req, res, next);
    });

    router.all(modulePath + "/prefix/Payment", checkLoggedInAdmin, convertMultipartReqBody, prefixSettingsValidation, (req, res, next) => {
        req.params.type = "Payment";
        settingsModule.prefix(req, res, next);
    });

    router.all(modulePath + "/prefix/Compensation_Permission", checkLoggedInAdmin, convertMultipartReqBody, prefixSettingsValidation, (req, res, next) => {
        req.params.type = "Compensation_Permission";
        settingsModule.prefix(req, res, next);
    });

    // Generic prefix route for any type
    router.all(modulePath + "/prefix/:type", checkLoggedInAdmin, convertMultipartReqBody, prefixSettingsValidation,(req, res, next) => {
        settingsModule.prefix(req, res, next);
    });
} 