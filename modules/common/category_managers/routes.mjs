import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { addEditValidation, rejectCategoryValidation } from "./validation.mjs";
import { validateRequest } from "../../../utils/index.mjs";
import restaurantCategory from "./model/category.mjs";
import * as Constants from "../../../config/global_constant.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure category managers routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkRestaurantLoggedIn - Middleware to check restaurant authentication
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkRestaurantLoggedIn, checkLoggedInAdmin }) {
    const modulePath        =   `/${Constants.RESTAURANT_NAME}/:slug/category`;
    const pendingModulePath =   `/${Constants.RESTAURANT_NAME}/:slug/pending_category`;
    const pendingCategory   =   `/${Constants.RESTAURANT_NAME}/pending_category`;
    const categoryModel     =   new restaurantCategory(db);

    /** Set current view folder **/
    router.use(modulePath,(req,res,next) => {
        req.rendering.views	=	__dirname + "/views";
        let slug		= req?.params?.slug || "";
        let moduleType 	= res?.locals?.module_type ||"";

        if(moduleType == Constants.MODULE_TYPE_RESTAURANT){
            res.locals.base_url = Constants.WEBSITE_URL+"restaurants/"+slug+"/";
        }else{
            res.locals.base_url = Constants.WEBSITE_ADMIN_URL+"restaurants/"+slug+"/";
        }

        /** Set list url **/
        res.locals.list_url = Constants.WEBSITE_RESTAURANT_URL+slug+"/category";

        next();
    });

    /** Set current view folder **/
    router.use(pendingModulePath,(req,res,next) => {
        req.rendering.views	=	__dirname + "/views";
        let slug		= req?.params?.slug || "";
        let moduleType 	= res?.locals?.module_type ||"";

        if(moduleType == Constants.MODULE_TYPE_RESTAURANT){
            res.locals.base_url = Constants.WEBSITE_URL+"restaurants/"+slug+"/";
        }else{
            res.locals.base_url = Constants.WEBSITE_ADMIN_URL+"restaurants/"+slug+"/";
        }

        /** Set list url **/
        res.locals.list_url = Constants.WEBSITE_RESTAURANT_URL+slug+"/pending_category";

        next();
    });

    /** Set current view folder **/
    router.use(pendingCategory,(req,res,next) => {
        req.rendering.views	=	__dirname + "/views";

        res.locals.base_url = Constants.WEBSITE_ADMIN_URL+"restaurant_category";

        /** Set list url **/
        res.locals.list_url = Constants.WEBSITE_RESTAURANT_URL+"pending_category";

        next();
    });

    // Category list
    router.all(modulePath, checkRestaurantLoggedIn, (req, res, next) => {
        categoryModel.getCategoryList(req, res, next);
    });

    // Add category
    router.all(modulePath + "/add", checkRestaurantLoggedIn, addEditValidation, validateRequest, (req, res, next) => {
        categoryModel.addEditCategory(req, res, next);
    });

    // Edit category
    router.all(modulePath + "/edit/:id", checkRestaurantLoggedIn, addEditValidation, validateRequest, (req, res, next) => {
        categoryModel.addEditCategory(req, res, next);
    });

    // Update status
    router.all(modulePath + "/update-status/:id/:status", checkRestaurantLoggedIn, (req, res, next) => {
        categoryModel.updateStatus(req, res, next);
    });

    // Pending category list
    router.all(pendingModulePath, checkRestaurantLoggedIn, (req, res, next) => {
        categoryModel.getPendingCategoryList(req, res, next);
    });

    // Edit pending category
    router.all(pendingModulePath + "/edit/:id", checkRestaurantLoggedIn, addEditValidation, validateRequest, (req, res, next) => {
        categoryModel.editPendingCategory(req, res, next);
    });

    // Update pending status
    router.all(pendingModulePath + "/update-status/:id/:status", checkRestaurantLoggedIn,  (req, res, next) => {
        categoryModel.updatePendingStatus(req, res, next);
    });

    // Admin-only pending category list
    router.all(pendingCategory, checkLoggedInAdmin, (req, res, next) => {
        req.params.type = true;
        categoryModel.getPendingCategoryList(req, res, next);
    });

    // Admin-only update pending category status
    router.post(pendingCategory + "/update_status", checkLoggedInAdmin, rejectCategoryValidation, validateRequest, (req, res, next) => {
        categoryModel.updatePendingCategoryStatus(req, res, next);
    });

    // Admin-only update multiple pending category statuses
    router.post(pendingCategory + "/update_multiple_status", checkLoggedInAdmin, rejectCategoryValidation, validateRequest, (req, res, next) => {
        categoryModel.updateMultiplePendingCategoryStatus(req, res, next);
    });
}