import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Contact from "./model/contact.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure Contact routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/contact';
    const contactModule = new Contact(db);

    // Set views for all /contact* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    // Contact list (datatable or page)
    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        contactModule.getContactList(req, res, next);
    });

    // View contact details
    router.all(modulePath + "/view/:id", checkLoggedInAdmin, (req, res, next) => {
        contactModule.view(req, res, next);
    });
} 