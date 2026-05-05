import { fileURLToPath } from 'url';
import { dirname } from 'path';
import EmailActions from './model/email_action.mjs';
import { addEditValidation } from './validations.mjs';
import { validateRequest } from '../../../utils/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure email actions routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/email_actions';
    const emailActionsModule = new EmailActions(db);

    // Set views for all /email_actions* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + '/views';
        next();
    });

    // List route
    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        emailActionsModule.list(req, res, next);
    });

    // Add route
    router.all(modulePath + '/add', checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        emailActionsModule.addEdit(req, res, next);
    });

    // Edit route
    router.all(modulePath + '/edit/:id', checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        emailActionsModule.addEdit(req, res, next);
    });

    // Delete route
    router.get(modulePath + '/delete/:id', checkLoggedInAdmin, (req, res, next) => {
        emailActionsModule.emailDelete(req, res, next);
    });
} 
