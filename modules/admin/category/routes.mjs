import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Category from "./model/category.mjs";
import { addEditValidation } from "./validations.mjs";
import {validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/category';
    const categoryModule = new Category(db);

    // Set views for all /category* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    router.all(modulePath + "/add", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        categoryModule.addEditCategory(req, res, next);
    });

    router.all(modulePath + "/add/:parent_category_id", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        categoryModule.addEditCategory(req, res, next);
    });

    router.all(modulePath + "/edit/:id", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        categoryModule.addEditCategory(req, res, next);
    });

    router.all(modulePath + "/edit/:id/:parent_category_id", checkLoggedInAdmin, addEditValidation, validateRequest, (req, res, next) => {
        categoryModule.addEditCategory(req, res, next);
    });

    router.all(modulePath + "/delete/:id", checkLoggedInAdmin, (req, res, next) => {
        categoryModule.categoryDelete(req, res, next);
    });

    router.all(modulePath + "/delete/:id/:parent_id", checkLoggedInAdmin, (req, res, next) => {
        categoryModule.categoryDelete(req, res, next);
    });

    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        categoryModule.getCategoryList(req, res, next);
    });

    router.all(modulePath+"/:category_id", checkLoggedInAdmin, (req, res, next) => {
        categoryModule.getCategoryList(req, res, next);
    });
    
} 