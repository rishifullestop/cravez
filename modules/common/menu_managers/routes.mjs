import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { addEditValidation,rejectMenuValidation,assignBranchValidation } from "./validation.mjs";
import { validateRequest } from "../../../utils/index.mjs";
import restuarantMenu from "./model/menu.mjs";
import * as Constants from "../../../config/global_constant.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure menu managers routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkRestaurantLoggedIn - Middleware to check restaurant authentication
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkRestaurantLoggedIn, checkLoggedInAdmin }) {
    const modulePath =   `/${Constants.RESTAURANT_NAME}/:slug/menu`;
    const pendingModulePath = `/${Constants.RESTAURANT_NAME}/:slug/pending_menu`;
    const pendingMenu = `/${Constants.RESTAURANT_NAME}/pending_menu`;
    const menuModel = new restuarantMenu(db);

    /** Set current view folder **/
    router.use(modulePath, (req, res, next) => {
        req.rendering.views	=	__dirname + "/views";
        let slug = req?.params?.slug || "";

        /** Set list url **/
        res.locals.list_url = Constants.WEBSITE_RESTAURANT_URL+slug+"/menu";

        next();
    });

    /** Set current view folder **/
    router.use(pendingModulePath, (req, res, next) => {
        req.rendering.views	=	__dirname + "/views";
        let slug = req?.params?.slug || "";

        /** Set list url **/
        res.locals.list_url = Constants.WEBSITE_RESTAURANT_URL+slug+"/pending_menu";

        next();
    });

    /** Set current view folder **/
    router.use(pendingMenu,(req,res,next) => {
        req.rendering.views	=	__dirname + "/views";

        res.locals.base_url = Constants.WEBSITE_ADMIN_URL+"restaurant_menu";

        /** Set list url **/
        res.locals.list_url = Constants.WEBSITE_RESTAURANT_URL+"pending_menu";

        next();
    });

    // Menu list
    router.all(modulePath, checkRestaurantLoggedIn, (req, res, next) => {
        menuModel.getMenuList(req, res, next);
    });

    // Add menu
    router.all(modulePath + "/add", checkRestaurantLoggedIn, addEditValidation, validateRequest,(req, res, next) => {
        menuModel.addEditMenu(req, res, next);
    });

    // Edit menu
    router.all(modulePath + "/edit/:id", checkRestaurantLoggedIn, addEditValidation, validateRequest, (req, res, next) => {
        menuModel.addEditMenu(req, res, next);
    });

    // Assign branch menu
    router.all(modulePath + "/assign_branches/:id", checkRestaurantLoggedIn, assignBranchValidation, validateRequest, (req, res, next) => {
        menuModel.assignBranch(req, res, next);
    });

    // Pending menu list
    router.all(pendingModulePath, checkRestaurantLoggedIn, (req, res, next) => {
        menuModel.pendingMenuList(req, res, next);
    });

    // Edit pending menu
    router.all(pendingModulePath + "/edit/:id", checkRestaurantLoggedIn, addEditValidation, validateRequest,(req, res, next) => {
        menuModel.editPendingMenu(req, res, next);
    });

    // Admin-only review/reject menu
    router.post(pendingModulePath + "/review_reject", checkLoggedInAdmin, rejectMenuValidation, validateRequest, (req, res, next) => {
        menuModel.rejectReviewMenu(req, res, next);
    });

    // Admin-only approve menu
    router.post(pendingModulePath + "/approve", checkLoggedInAdmin, (req, res, next) => {
        menuModel.approveMenu(req, res, next);
    });

    // Admin-only update multiple pending menu statuses
    router.post(pendingMenu + "/update_multiple_status", checkLoggedInAdmin, rejectMenuValidation, validateRequest, (req, res, next) => {
        menuModel.updateMultipleMenuStatus(req, res, next);
    });

    // Admin-only pending menu list
    router.all(pendingMenu, checkLoggedInAdmin, (req, res, next) => {
        req.params.type = true;
        menuModel.pendingMenuList(req, res, next);
    });
}