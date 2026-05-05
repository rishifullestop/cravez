import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { addEditValidation,  cloneExtraItemValidation } from "./validations/extraItemValidation.mjs";
import { validateRequest } from "../../../utils/index.mjs";
import restuarantExtraItem from "./model/extraItems.mjs";
import restuarantPendingExtraItem from "./model/pendingExtraItems.mjs";
import * as Constants from "../../../config/global_constant.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure item managers routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkRestaurantLoggedIn - Middleware to check restaurant authentication
 */
export default function configure(router, { db, checkRestaurantLoggedIn }) {
    const extraItemsModulePath 	        = "/"+Constants.RESTAURANT_NAME+"/:slug/extra_items/:item_id";
    const pendingExtraItemsModulePath 	= "/"+Constants.RESTAURANT_NAME+"/:slug/pending_extra_items/:item_id";
    const extraItemModel         =   new restuarantExtraItem(db);
    const pendingExtraItemModel  =   new restuarantPendingExtraItem(db);

    /** Set current view folder **/
    router.use([extraItemsModulePath,pendingExtraItemsModulePath],(req,res,next) => {
        req.rendering.views	=	__dirname + "/views";

        /** Set query in local variable */
        let finalQuery			=  	(req._parsedUrl && req._parsedUrl.search) ? req._parsedUrl.search : "";
        res.locals.finalQuery	=	finalQuery;

        let slug 		=	req?.params?.slug || "";
        let moduleType	= 	res?.locals?.module_type || "";
        if(moduleType == Constants.MODULE_TYPE_RESTAURANT){
            res.locals.base_url = Constants.WEBSITE_URL+"restaurants/"+slug+"/";
        }else{
            res.locals.base_url = Constants.WEBSITE_ADMIN_URL+"restaurants/"+slug+"/";
        }

        next();
    });

    /** Separate router.use for extra items listing **/
    router.use(extraItemsModulePath,(req,res,next) => {
        let slug    =   req.params.slug || "";
        let itemId  =   req.params.item_id || "";

        res.locals.list_url = Constants.WEBSITE_RESTAURANT_URL+slug+"/extra_items/"+itemId;
        next();
    });

    /** Separate router.use for pending extra items listing **/
    router.use(pendingExtraItemsModulePath,(req,res,next) => {
        let slug 	=   req.params.slug || "";
        let itemId 	=   req.params.item_id || "";

        res.locals.list_url = Constants.WEBSITE_RESTAURANT_URL+slug+"/pending_extra_items/"+itemId;
        next();
    });

    /** Routing is used to get extra items list **/
    router.all(extraItemsModulePath,checkRestaurantLoggedIn,(req, res, next) => {
        extraItemModel.getExtraItemsList(req,res,next);
    });

    /** Routing is used to add extra item **/
    router.all(extraItemsModulePath+"/add",checkRestaurantLoggedIn, addEditValidation, validateRequest, (req, res, next) => {
        extraItemModel.addEditExtraItems(req,res,next);
    });

    /** Routing is used to edit extra item  **/
    router.all(extraItemsModulePath+"/edit/:id",checkRestaurantLoggedIn, addEditValidation, validateRequest,(req, res, next) => {
        extraItemModel.addEditExtraItems(req,res,next);
    });

    /** Routing is used to delete extra item  **/
    router.get(extraItemsModulePath+"/delete/:id",checkRestaurantLoggedIn,(req, res, next) => {
        extraItemModel.deleteExtraItems(req,res,next);
    });

    /** Routing is used to update extra items status **/
    router.post(extraItemsModulePath+"/update-extra-item-status",checkRestaurantLoggedIn,(req, res, next) => {
        extraItemModel.updateExtraItemStatus(req,res,next);
    });

    /** Routing is used to clone extra item **/
    router.all(extraItemsModulePath+"/clone_extra_item/:cloneId",checkRestaurantLoggedIn, cloneExtraItemValidation, validateRequest,(req, res, next) => {
        extraItemModel.cloneExtraItem(req,res,next);
    });

    /** Routing is used to clone extra item **/
    router.post(extraItemsModulePath+"/get_item_list",checkRestaurantLoggedIn,(req, res, next) => {
        extraItemModel.getMainItemList(req,res,next);
    });

    /** Routing is used to clone extra item **/
    router.all(extraItemsModulePath+"/extra_item_order/:id",checkRestaurantLoggedIn,(req, res, next) => {
        extraItemModel.extraItemOrder(req,res,next);
    });

    /************************************************ Pending extra items only *************************************************/

    /** Routing is used to get pending extra items list **/
    router.all(pendingExtraItemsModulePath,checkRestaurantLoggedIn,(req, res, next) => {
        pendingExtraItemModel.getPendingExtraItemsList(req,res,next);
    });

    /** Routing is used to add pending extra item **/
    router.all(pendingExtraItemsModulePath+"/add",checkRestaurantLoggedIn,addEditValidation, validateRequest,(req, res, next) => {
        pendingExtraItemModel.addEditPendingExtraItems(req,res,next);
    });

    /** Routing is used to edit pending extra item **/
    router.all(pendingExtraItemsModulePath+"/edit/:id",checkRestaurantLoggedIn,addEditValidation, validateRequest,(req, res, next) => {
        pendingExtraItemModel.addEditPendingExtraItems(req,res,next);
    });

    /** Routing is used to delete pending extra item  **/
    router.get(pendingExtraItemsModulePath+"/delete/:id",checkRestaurantLoggedIn,(req, res, next) => {
        pendingExtraItemModel.deletePendingExtraItems(req,res,next);
    });
}