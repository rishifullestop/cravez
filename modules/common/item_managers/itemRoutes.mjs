import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { addEditValidation, recommendedItemValidation, rejectItemValidation, overridingItemValidation, upsellingItemValidation, cloneItemValidation } from "./validations/itemValidation.mjs";
import { validateRequest, convertMultipartReqBody } from "../../../utils/index.mjs";
import restaurantItem from "./model/item.mjs";
import restaurantPendingItem from "./model/pendingItem.mjs";
import * as Constants from "../../../config/global_constant.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure item managers routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkRestaurantLoggedIn - Middleware to check restaurant authentication
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkRestaurantLoggedIn, checkLoggedInAdmin }) {
    const modulePath        =   `/${Constants.RESTAURANT_NAME}/:slug/item`;
    const pendingModulePath =   `/${Constants.RESTAURANT_NAME}/:slug/pending_item`;
    const pendingItem       =   `/${Constants.RESTAURANT_NAME}/pending_item`;
    const itemModel         =   new restaurantItem(db);
    const pendingItemModel  =   new restaurantPendingItem(db);

    /** Set current view folder **/
    router.use([modulePath,pendingModulePath,pendingItem],(req,res,next) => {
        req.rendering.views	=	__dirname + "/views";

        /** Set query in local variable */
        let finalQuery			=  	(req._parsedUrl && req._parsedUrl.search) ? req._parsedUrl.search : "";
        res.locals.finalQuery	=	finalQuery;

        next();
    });

    /** Seperate router.use for item listing **/
    router.use(modulePath,(req,res,next) => {
        let slug 		=	(req?.params?.slug) 		? 	req?.params?.slug 		:"";
        let moduleType	= 	(res?.locals?.module_type) 	?	res?.locals?.module_type:"";

        if(moduleType == Constants.MODULE_TYPE_RESTAURANT){
            res.locals.base_url = Constants.WEBSITE_URL+"restaurants/"+slug+"/";
        }else{
            res.locals.base_url = Constants.WEBSITE_ADMIN_URL+"restaurants/"+slug+"/";
        }
        res.locals.list_url 	= 	Constants.WEBSITE_RESTAURANT_URL+slug+"/item";
        next();
    });

    router.use(pendingModulePath,(req,res,next) => {
        let slug 		= (req.params.slug) 		? req.params.slug 	     :"";
        let moduleType	= (res.locals.module_type) 	? res.locals.module_type :"";

        if(moduleType == Constants.MODULE_TYPE_RESTAURANT){
            res.locals.base_url = Constants.WEBSITE_URL+"restaurants/"+slug+"/";
        }else{
            res.locals.base_url = Constants.WEBSITE_ADMIN_URL+"restaurants/"+slug+"/";
        }
        res.locals.list_url = Constants.WEBSITE_RESTAURANT_URL+slug+"/pending_item";
        next();
    });

    /** Seperate app.use for pending item listing only in admin **/
    router.use(pendingItem,(req,res,next) => {
        res.locals.base_url = Constants.WEBSITE_ADMIN_URL+"restaurants/";
        res.locals.list_url = Constants.WEBSITE_RESTAURANT_URL+"pending_item";
        next();
    });

    /** Routing is used to get item list **/
    router.all(modulePath,checkRestaurantLoggedIn,(req,res,next) => {
        itemModel.getItemList(req,res,next);
    });

    /** Routing is used to add item **/
    router.all(modulePath+"/add",checkRestaurantLoggedIn,convertMultipartReqBody,addEditValidation,validateRequest, (req, res, next) => {
        itemModel.addEditItem(req,res,next);
    });

    /** Routing is used to edit item **/
    router.all(modulePath+"/edit/:id",checkRestaurantLoggedIn,convertMultipartReqBody,addEditValidation,validateRequest,(req, res, next) => {
        itemModel.addEditItem(req,res,next);
    });

    /** Routing is used to update item status **/
    router.post(modulePath+"/update-status",checkRestaurantLoggedIn,(req, res, next) => {
        itemModel. updateItemStatus(req,res,next);
    });

    /** Routing is used to save recommended item **/
    router.all(modulePath+"/recommended_item/:item_id",checkRestaurantLoggedIn, recommendedItemValidation,validateRequest,(req,res,next)=>{
        itemModel.addRecommendedItem(req,res,next);
    });

    /** Routing is used to remove item unit **/
    router.post(modulePath+"/remove_item_unit",checkRestaurantLoggedIn,(req, res, next) => {
        itemModel.removeItemUnit(req,res,next);
    });
    /** Routing is used to remove item unit **/
    router.post(modulePath+"/remove_item_availability",checkRestaurantLoggedIn,(req, res, next) => {
        itemModel.removeItemAvailability(req,res,next);
    });

    /** Routing is used to overriding item **/
    router.all(modulePath+"/overriding/:item",checkRestaurantLoggedIn, overridingItemValidation,validateRequest,(req, res, next) => {
        itemModel.overridingItem(req,res,next);
    });

    /** Routing is used to rollback overriding item **/
    router.get(modulePath+"/rollback/:item",checkRestaurantLoggedIn,(req, res, next) => {
        itemModel.rollbackItem(req,res,next);
    });

    /** Routing is used to clone item **/
    router.all(modulePath+"/clone/:item",checkRestaurantLoggedIn,cloneItemValidation,validateRequest,(req, res, next) => {
        itemModel.cloneItem(req,res,next);
    });

    /** Routing is used to get menu wise category */
    router.post(modulePath+"/get_categories",checkRestaurantLoggedIn,(req, res, next) => {
        itemModel.getMenuCategories(req,res,next);
    });

    /** Routing is used to view item details **/
    router.all(modulePath+"/view/:id",checkRestaurantLoggedIn,(req, res, next) => {
        itemModel.viewItemDetails(req,res,next);
    });

    /** Routing is used to save upselling item **/
    router.all(modulePath+"/upselling_item/:item_id",checkRestaurantLoggedIn, upsellingItemValidation,validateRequest,(req, res, next) => {
        itemModel.addUpsellingItem(req,res,next);
    });

    /************************************************ Pending item only *************************************************/


    /** Routing is used to get item action **/
    router.all(pendingItem+"/item_action",checkRestaurantLoggedIn,rejectItemValidation,validateRequest,(req,res,next) => {
        pendingItemModel.itemActions(req,res,next);
    });

    /** Routing is used to get item list **/
    router.all(pendingModulePath,checkRestaurantLoggedIn,(req,res,next) => {
        pendingItemModel.pendingItemList(req,res,next);
    });

    /** Routing is used to edit item **/
    router.all(pendingModulePath+"/edit/:id",checkRestaurantLoggedIn,convertMultipartReqBody,addEditValidation,validateRequest,(req, res, next) => {
        pendingItemModel.editPendingItem(req,res,next);
    });

    /** Routing is used to send item for approval **/
    router.get(pendingModulePath+"/send_for_approval/:id",checkRestaurantLoggedIn,(req, res, next) => {
        pendingItemModel.sendItemForApproval(req,res,next);
    });

    /** Routing is used to remove item unit **/
    router.post(pendingModulePath+"/remove_item_unit",checkRestaurantLoggedIn,(req, res, next) => {
        pendingItemModel.removeTmpItemUnit(req,res,next);
    });
    /** Routing is used to remove item unit **/
    router.post(pendingModulePath+"/remove_item_availability",checkRestaurantLoggedIn,(req, res, next) => {
        pendingItemModel.removeTmpItemAvailability(req,res,next);
    });

    /** Routing is used to view pending item details **/
    router.all(pendingModulePath+"/view/:id",checkRestaurantLoggedIn,(req, res, next) => {
        pendingItemModel.viewPendingItemDetails(req,res,next);
    });

    /** Routing is used to get pending item list **/
    router.all(pendingItem,checkLoggedInAdmin,(req,res,next) => {
        req.params.type = true;
        pendingItemModel.pendingItemList(req,res,next);
    });
}