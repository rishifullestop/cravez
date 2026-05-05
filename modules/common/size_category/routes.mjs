import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { addEditValidation } from "./validation.mjs";
import { validateRequest } from "../../../utils/index.mjs";
import sizeCategory from "./model/sizeCategory.mjs";
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
	const modulePath        =   `/${Constants.RESTAURANT_NAME}/:slug/size_category`;
    const sizeCategoryModel =   new sizeCategory(db);

    /** Set current view folder **/
    router.use(modulePath,(req,res,next) => {
        req.rendering.views	=	__dirname + "/views";

		let slug 		=	req?.params?.slug || "";
		let moduleType	= 	res?.locals?.module_type || "";

		if(moduleType == Constants.MODULE_TYPE_RESTAURANT){
			res.locals.base_url = Constants.WEBSITE_URL+"restaurants/"+slug+"/";
		}else{
			res.locals.base_url = Constants.WEBSITE_ADMIN_URL+"restaurants/"+slug+"/";
		}
		res.locals.list_url = Constants.WEBSITE_RESTAURANT_URL+slug+"/size_category";

        next();
    });

	/** Routing is used to get size category list **/
	router.all(modulePath,checkRestaurantLoggedIn,(req,res,next) => {
		sizeCategoryModel.getSizeCategoryList(req,res,next);
	});

	/** Routing is used to add size category **/
	router.all(modulePath+"/add",checkRestaurantLoggedIn,addEditValidation, validateRequest,(req, res, next) => {
		sizeCategoryModel.addEditSizeCategory(req,res,next);
	});

	/** Routing is used to edit size category **/
	router.all(modulePath+"/edit/:id",checkRestaurantLoggedIn,addEditValidation, validateRequest,(req, res, next) => {
		sizeCategoryModel.addEditSizeCategory(req,res,next);
	});

	/** Routing is used to delete size category **/
	router.get(modulePath+"/delete/:id",checkRestaurantLoggedIn,(req, res, next) => {
		sizeCategoryModel.deleteSizeCategory(req,res,next);
	});

	/** Routing is used to get restaurant Link Iteam Units **/
	router.all(modulePath+"/unit_item/:id",checkRestaurantLoggedIn,(req,res,next) => {
		sizeCategoryModel.restaurantLinkIteamUnits(req,res,next);
	});    
};

