import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Faq from "./model/faq.mjs";
import { addEditValidation } from "./validations.mjs";
import { validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure FAQ routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/faqs';
    const faqModule = new Faq(db);

    // Set views for all /faqs* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        faqModule.getFaqList(req, res, next);
    });

    router.all(modulePath+"/add", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        faqModule.addEditFaq(req, res, next);
    });

    router.all(modulePath+"/edit/:id", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        faqModule.addEditFaq(req, res, next);
    });

    router.all(modulePath+"/update-status/:id/:status", checkLoggedInAdmin, (req, res, next) => {
        faqModule.updateFaqStatus(req, res, next);
    });

    router.get(modulePath+"/delete/:id", checkLoggedInAdmin, (req, res, next) => {
        faqModule.faqDelete(req, res, next);
    });

    router.post(modulePath+"/sub_category", checkLoggedInAdmin, (req, res, next) => {
        faqModule.faqSubCategory(req, res, next);
    });
} 