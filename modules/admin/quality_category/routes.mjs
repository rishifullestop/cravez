import { fileURLToPath } from 'url';
import { dirname } from 'path';
import QualityCategory from "./model/quality_category.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure quality category routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/quality_category';
    const qualityCategoryModule = new QualityCategory(db);

    // Set views for all /quality_category* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    // Routing is used to add category
    router.all(modulePath + "/add", checkLoggedInAdmin, (req, res, next) => {
        qualityCategoryModule.addEditCategory(req, res, next);
    });
    // Routing is used to add category
    router.all(modulePath + "/add/:parent_category_id", checkLoggedInAdmin, (req, res, next) => {
        qualityCategoryModule.addEditCategory(req, res, next);
    });

    // Routing is used to edit category
    router.all(modulePath + "/edit/:id", checkLoggedInAdmin, (req, res, next) => {
        qualityCategoryModule.addEditCategory(req, res, next);
    });

    // Routing is used to edit category
    router.all(modulePath + "/edit/:id/:parent_category_id", checkLoggedInAdmin, (req, res, next) => {
        qualityCategoryModule.addEditCategory(req, res, next);
    });

    // Routing is used to delete category details
    router.get(modulePath + "/delete/:id", checkLoggedInAdmin, (req, res, next) => {
        qualityCategoryModule.categoryDelete(req, res, next);
    });

     // Routing is used to delete category details
     router.get(modulePath + "/delete/:id/:parent_id", checkLoggedInAdmin, (req, res, next) => {
        qualityCategoryModule.categoryDelete(req, res, next);
    });

    // Routing is used to get category list
    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        qualityCategoryModule.getCategoryList(req, res, next);
    });

    // Routing is used to get category list
    router.all(modulePath + "/:category_id", checkLoggedInAdmin, (req, res, next) => {
        qualityCategoryModule.getCategoryList(req, res, next);
    });
} 