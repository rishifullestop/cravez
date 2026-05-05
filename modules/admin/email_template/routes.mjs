import { fileURLToPath } from 'url';
import { dirname } from 'path';
import EmailTemplate from "./model/email_template.mjs";
import { addEditValidation } from "./validations.mjs";
import { validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure email template routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/email_template';
    const emailTemplateModule = new EmailTemplate(db);

    // Set views for all /email_template* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        emailTemplateModule.getTemplateList(req, res, next);
    });

    router.all(modulePath+"/add", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        emailTemplateModule.addEditEmailTemplate(req, res, next);
    });

    router.all(modulePath+"/edit/:id", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        emailTemplateModule.addEditEmailTemplate(req, res, next);
    });

    router.post(modulePath+"/get_action_options", checkLoggedInAdmin, (req, res, next) => {
        emailTemplateModule.getEmailActionOptions(req, res, next);
    });
} 