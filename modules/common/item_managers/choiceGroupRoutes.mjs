import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { addEditValidation, cloneChoiceGroupValidation } from "./validations/choiceGroupValidation.mjs";
import { validateRequest } from "../../../utils/index.mjs";
import choiceGroup from "./model/choiceGroup.mjs";
import pendingChoiceGroup from "./model/pendingChoiceGroup.mjs";
import * as Constants from "../../../config/global_constant.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure choice group managers routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 * @param {Function} options.checkRestaurantLoggedIn - Middleware to check restaurant authentication
 */
export default function configure(router, { db, checkRestaurantLoggedIn }) {
    const choiceModulePath 	        =   `/${Constants.RESTAURANT_NAME}/:slug/choice_group/:item_id`;
    const pendingChoiceModulePath 	=   `/${Constants.RESTAURANT_NAME}/:slug/pending_choice_group/:item_id`;
    const choiceGroupModel   =   new choiceGroup(db);
    const pendingGroupModel  =   new pendingChoiceGroup(db);

    /** Set current view folder **/
    router.use([choiceModulePath,pendingChoiceModulePath],(req,res,next) => {
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

    /** Seperate app.use for choice group listing **/
    router.use(choiceModulePath,(req,res,next) => {        
        let slug    =   req?.params?.slug || "";
        let itemId  =   req?.params?.item_id || "";
        res.locals.list_url = Constants.WEBSITE_RESTAURANT_URL+slug+"/choice_group/"+itemId;
        next();
    });

    /** Seperate app.use for pending choice group listing **/
    router.use(pendingChoiceModulePath,(req,res,next) => {
        let slug    =   req?.params?.slug || "";
        let itemId  =   req?.params?.item_id || "";
        res.locals.list_url = Constants.WEBSITE_RESTAURANT_URL+slug+"/pending_choice_group/"+itemId;
        next();
    });

    /******************* Routing for choice group only   *******************/

    /** Routing is used to get choice group list **/
    router.all(choiceModulePath,checkRestaurantLoggedIn,(req, res, next) => {
        choiceGroupModel.getChoiceGroupList(req,res,next);
    });

    /** Routing is used to  save choice group  **/
    router.all(choiceModulePath+"/add",checkRestaurantLoggedIn, addEditValidation, validateRequest, (req, res, next) => {
        choiceGroupModel.addEditChoiceGroup(req,res,next);
    });

    /** Routing is used to edit choice group  **/
    router.all(choiceModulePath+"/edit/:id",checkRestaurantLoggedIn, addEditValidation, validateRequest, (req, res, next) => {
        choiceGroupModel.addEditChoiceGroup(req,res,next);
    });

    /** Routing is used to delete choice group  **/
    router.get(choiceModulePath+"/delete/:id",checkRestaurantLoggedIn,(req, res, next) => {
        choiceGroupModel.deleteChoiceGroup(req,res,next);
    });

    /** Routing is used to add extra items in choice group **/
    router.all(choiceModulePath+"/add_extra/:id",checkRestaurantLoggedIn,(req, res, next) => {
        choiceGroupModel.addExtraItemChoiceGroup(req,res,next);
    });

    /** Routing is used to clone choice group  **/
    router.all(choiceModulePath+"/clone/:cloneId",checkRestaurantLoggedIn, cloneChoiceGroupValidation, validateRequest, (req, res, next) => {
        choiceGroupModel.cloneChoiceGroup(req,res,next);
    });

    /** Routing is used to clone choice group  **/
    router.post(choiceModulePath+"/get_item_list",checkRestaurantLoggedIn,(req, res, next) => {
        choiceGroupModel.getChoiceItemList(req,res,next);
    });

    /******************* Routing for pending choice group only   *******************/

    /** Routing is used to get pending choice group list **/
    router.all(pendingChoiceModulePath,checkRestaurantLoggedIn,(req, res, next) => {
        pendingGroupModel.pendingChoiceGroupList(req,res,next);
    });

    /** Routing is used to add  pending choice group **/
    router.all(pendingChoiceModulePath+"/add",checkRestaurantLoggedIn, addEditValidation, validateRequest, (req, res, next) => {
        pendingGroupModel.addEditpendingChoiceGroup(req,res,next);
    });

    /** Routing is used to edit  pending choice group details **/
    router.all(pendingChoiceModulePath+"/edit/:id",checkRestaurantLoggedIn, addEditValidation, validateRequest, (req, res, next) => {
        pendingGroupModel.addEditpendingChoiceGroup(req,res,next);
    });

    /** Routing is used to add extra items in choice group **/
    router.all(pendingChoiceModulePath+"/add_extra/:id",checkRestaurantLoggedIn,(req, res, next) => {
        pendingGroupModel.addPendingExtraItemChoiceGroup(req,res,next);
    });

    /** Routing is used to delete pending choice group  **/
    router.get(pendingChoiceModulePath+"/delete/:id",checkRestaurantLoggedIn,(req, res, next) => {
        pendingGroupModel.deletePendingChoiceGroup(req,res,next);
    });
} 