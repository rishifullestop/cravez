import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as Constants from "../../../config/global_constant.mjs";
import BREADCRUMBS from "../../../breadcrumbs.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure restaurants routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedIn - Middleware to check user authentication
 */
export default function configure(router, { db, checkLoggedIn }) {
    const modulePath = Constants.FRONT_END_NAME + "restaurants/:slug";

    /** Set current view folder **/
	router.use(modulePath,(req,res,next) => {
		/**Check slug passed in url is correct or not */
		let sessionSlug = req?.session?.user?.restaurant_slug || "";
		let urlSlug  	= req?.params?.slug || "";
		
		if(sessionSlug != urlSlug){
			req.flash(Constants.STATUS_ERROR,res.__("system.invalid_access"));
			if(sessionSlug){
				return res.redirect(Constants.WEBSITE_URL+"restaurants/"+sessionSlug+"/branches");
			}else{
				return res.redirect(Constants.WEBSITE_URL+"login");
			}
		}

		req.rendering.views	=	__dirname + "/views";
		next();
	});

    /** Routing is used to get menu list **/
	router.get(modulePath+"/menu",checkLoggedIn,(req,res,next) => {
		let slug = req?.params?.slug || "";

		/** Set list url */
		res.locals.list_url = 	res.locals.list_url+"/"+slug+"/menu";

		req.breadcrumbs(BREADCRUMBS['menu/list']);
		res.render('list',{
			slug : slug,
			link : Constants.WEBSITE_RESTAURANT_URL+slug+"/menu"
		});
	});

	/** Routing is used to get pending menu list **/
	router.get(modulePath+"/pending_menu",checkLoggedIn,(req,res,next) => {
		let slug = req?.params?.slug || "";

		/** Set list url */
		res.locals.list_url = 	res.locals.list_url+"/"+slug+"/pending_menu";

		req.breadcrumbs(BREADCRUMBS['pending_menu/list']);
		res.render('list',{
			slug : slug,
			link : Constants.WEBSITE_RESTAURANT_URL+slug+"/pending_menu"
		});
	});

	/** Routing is used to get category list **/
	router.get(modulePath+"/category",checkLoggedIn,(req,res,next) => {
		let slug 		=	req?.params?.slug || "";
		let paramQuery 	=	req?.query || "";
		let finalQuery	=	"";
		if(paramQuery && Object.keys(paramQuery).length > 0){

			Object.keys(paramQuery).map((key,index)=>{
				if(!finalQuery) finalQuery = "?";
				finalQuery += "&"+key+"="+paramQuery[key];
			});
		}

		/** Set list url */
		res.locals.list_url = 	res.locals.list_url+"/"+slug+"/category";

		req.breadcrumbs(BREADCRUMBS['category/list']);
		res.render('list',{
			slug : slug,
			link : Constants.WEBSITE_RESTAURANT_URL+slug+"/category"+finalQuery
		});
	});

	/** Routing is used to get pending category list **/
	router.get(modulePath+"/pending_category",checkLoggedIn,(req,res,next) => {
		let slug = req?.params?.slug || "";

		/** Set list url */
		res.locals.list_url = 	res.locals.list_url+"/"+slug+"/pending_category";

		req.breadcrumbs(BREADCRUMBS['pending_category/list']);
		res.render('list',{
			slug : slug,
			link : Constants.WEBSITE_RESTAURANT_URL+slug+"/pending_category"
		});
	});

	/** Routing is used to get branches list **/
	router.get(modulePath+"/branches",checkLoggedIn,(req,res,next) => {
		let slug 		= 	req?.params?.slug || "";
		let branchId 	= 	req?.params?.id || "";
		let paramQuery 	=	req?.query || "";
		let finalQuery	=	"";
		if(paramQuery && Object.keys(paramQuery).length > 0){
			Object.keys(paramQuery).map((key,index)=>{
				if(!finalQuery) finalQuery = "?";
				finalQuery += "&"+key+"="+paramQuery[key];
			});
		}

		/** Set list url */
		res.locals.list_url = 	res.locals.list_url+"/"+slug+"/branches";

		req.breadcrumbs(BREADCRUMBS['branch/list']);
		res.render('list',{
			slug : slug,
			link : (!branchId) ? Constants.WEBSITE_RESTAURANT_URL+slug+"/branches"+finalQuery : Constants.WEBSITE_RESTAURANT_URL+slug+"/branches/view/"+branchId
		});
	});

	/** Routing is used to get branches list **/
	router.get(modulePath+"/branches/:id",checkLoggedIn,(req,res,next) => {
		let slug 		= 	req?.params?.slug || "";
		let branchId 	= 	req?.params?.id || "";
		let paramQuery 	=	req?.query || "";
		let finalQuery	=	"";
		if(paramQuery && Object.keys(paramQuery).length > 0){
			Object.keys(paramQuery).map((key,index)=>{
				if(!finalQuery) finalQuery = "?";
				finalQuery += "&"+key+"="+paramQuery[key];
			});
		}

		/** Set list url */
		res.locals.list_url = 	res.locals.list_url+"/"+slug+"/branches";

		req.breadcrumbs(BREADCRUMBS['branch/list']);
		res.render('list',{
			slug : slug,
			link : (!branchId) ? Constants.WEBSITE_RESTAURANT_URL+slug+"/branches"+finalQuery : Constants.WEBSITE_RESTAURANT_URL+slug+"/branches/view/"+branchId
		});
	});

	/** Routing is used to get pending branches list **/
	router.get(modulePath+"/pending_branches",checkLoggedIn,(req,res,next) => {
		let slug 		= req?.params?.slug || "";
		let branchId 	= req?.params?.id || "";

		/** Set list url */
		res.locals.list_url = 	res.locals.list_url+"/"+slug+"/pending_branches";

		req.breadcrumbs(BREADCRUMBS['pending_branch/list']);
		res.render('list',{
			slug : slug,
			link : (!branchId) ? Constants.WEBSITE_RESTAURANT_URL+slug+"/pending_branches" : Constants.WEBSITE_RESTAURANT_URL+slug+"/pending_branches/view/"+branchId
		});
	});

	/** Routing is used to get pending branches list **/
	router.get(modulePath+"/pending_branches/:id",checkLoggedIn,(req,res,next) => {
		let slug 		= req?.params?.slug || "";
		let branchId 	= req?.params?.id || "";

		/** Set list url */
		res.locals.list_url = 	res.locals.list_url+"/"+slug+"/pending_branches";

		req.breadcrumbs(BREADCRUMBS['pending_branch/list']);
		res.render('list',{
			slug : slug,
			link : (!branchId) ? Constants.WEBSITE_RESTAURANT_URL+slug+"/pending_branches" : Constants.WEBSITE_RESTAURANT_URL+slug+"/pending_branches/view/"+branchId
		});
	});

	/** Routing is used to get item list **/
	router.get(modulePath+"/item",checkLoggedIn,(req,res,next) => {
		let slug 		=	req?.params?.slug || "";
		let itemId 		= 	req?.params?.id || "";
		let finalQuery	=  	req?._parsedUrl?.search || "";

		/** Set list url */
		res.locals.list_url = 	res.locals.list_url+"/"+slug+"/item";
		req.breadcrumbs(BREADCRUMBS['item/list']);

		res.render('list',{
			slug : slug,
			link : itemId ? Constants.WEBSITE_RESTAURANT_URL+slug+"/item/view/"+itemId+finalQuery : Constants.WEBSITE_RESTAURANT_URL+slug+"/item"+finalQuery
		});
	});

	/** Routing is used to get item list **/
	router.get(modulePath+"/item/:id",checkLoggedIn,(req,res,next) => {
		let slug 		=	req?.params?.slug || "";
		let itemId 		= 	req?.params?.id || "";
		let finalQuery	=  	req?._parsedUrl?.search || "";

		/** Set list url */
		res.locals.list_url = 	res.locals.list_url+"/"+slug+"/item";
		req.breadcrumbs(BREADCRUMBS['item/list']);

		res.render('list',{
			slug : slug,
			link : itemId ? Constants.WEBSITE_RESTAURANT_URL+slug+"/item/view/"+itemId+finalQuery : Constants.WEBSITE_RESTAURANT_URL+slug+"/item"+finalQuery
		});
	});

	/** Routing is used to get pending item list **/
	router.get(modulePath+"/pending_item",checkLoggedIn,(req,res,next) => {
		let slug 		= req?.params?.slug || "";
		let itemId 		= req.params.id || "";
		let finalQuery	= req?._parsedUrl?.search || "";

		/** Set list url */
		res.locals.list_url = 	res.locals.list_url+"/"+slug+"/pending_item";
		req.breadcrumbs(BREADCRUMBS['pending_item/list']);
		res.render('list',{
			slug : slug,
			link : itemId ? Constants.WEBSITE_RESTAURANT_URL+slug+"/pending_item/view/"+itemId+finalQuery : Constants.WEBSITE_RESTAURANT_URL+slug+"/pending_item"+finalQuery
		});
	});

	/** Routing is used to get pending item list **/
	router.get(modulePath+"/pending_item/:id",checkLoggedIn,(req,res,next) => {
		let slug 		= req?.params?.slug || "";
		let itemId 		= req.params.id || "";
		let finalQuery	= req?._parsedUrl?.search || "";

		/** Set list url */
		res.locals.list_url = 	res.locals.list_url+"/"+slug+"/pending_item";
		req.breadcrumbs(BREADCRUMBS['pending_item/list']);
		res.render('list',{
			slug : slug,
			link : itemId ? Constants.WEBSITE_RESTAURANT_URL+slug+"/pending_item/view/"+itemId+finalQuery : Constants.WEBSITE_RESTAURANT_URL+slug+"/pending_item"+finalQuery
		});
	});

	/** Routing is used to get item units list **/
	router.get(modulePath+"/size_category",checkLoggedIn,(req,res,next) => {
		let slug	=	req?.params?.slug || "";

		/** Set list url */
		res.locals.list_url = 	res.locals.list_url+"/"+slug+"/size_category";

		req.breadcrumbs(BREADCRUMBS['size_category/list']);
		res.render('list',{
			slug : slug,
			link : Constants.WEBSITE_RESTAURANT_URL+slug+"/size_category"
		});
	});

	/** Routing is used to get choice group  list **/
	router.get(modulePath+"/choice_group/:item_id",checkLoggedIn,(req,res,next) => {
		let slug 	 	= req?.params?.slug || "";
		let itemId   	= req?.params?.item_id || "";
		let finalQuery	= req?._parsedUrl?.search || "";

		/** Set list url */
		res.locals.list_url = res.locals.list_url+"/"+slug+"/choice_group/"+itemId;

		req.breadcrumbs(BREADCRUMBS['choice_group/choice_group_list']);
		res.render('list',{
			slug : slug,
			link : Constants.WEBSITE_RESTAURANT_URL+slug+"/choice_group/"+itemId+finalQuery
		});
	});

	/** Routing is used to get pending choice group  list **/
	router.get(modulePath+"/pending_choice_group/:item_id",checkLoggedIn,(req,res,next) => {
		let slug 	 	= req?.params?.slug || "";
		let itemId   	= req?.params?.item_id || "";
		let finalQuery	= req?._parsedUrl?.search || "";

		/** Set list url */
		res.locals.list_url = 	res.locals.list_url+"/"+slug+"/pending_choice_group/"+itemId;

		req.breadcrumbs(BREADCRUMBS['pending_choice_group/pending_choice_group_list']);
		res.render('list',{
			slug : slug,
			link : Constants.WEBSITE_RESTAURANT_URL+slug+"/pending_choice_group/"+itemId+finalQuery
		});
	});

	/** Routing is used to get extra items list **/
	router.get(modulePath+"/extra_items/:item_id",checkLoggedIn,(req,res,next) => {
		let slug 	 	= req?.params?.slug || "";
		let itemId   	= req?.params?.item_id || "";
		let finalQuery	= req?._parsedUrl?.search || "";

		/** Set list url */
		res.locals.list_url = 	res.locals.list_url+"/"+slug+"/extra_items/"+itemId;

		req.breadcrumbs(BREADCRUMBS['extra_items/extra_items_list']);
		res.render('list',{
			slug : slug,
			link : Constants.WEBSITE_RESTAURANT_URL+slug+"/extra_items/"+itemId+finalQuery
		});
	});

	/** Routing is used to get pending extra items  list **/
	router.get(modulePath+"/pending_extra_items/:item_id",checkLoggedIn,(req,res,next) => {
		let slug 	 	= req?.params?.slug || "";
		let itemId   	= req?.params?.item_id || "";
		let finalQuery	= req?._parsedUrl?.search || "";

		/** Set list url */
		res.locals.list_url = 	res.locals.list_url+"/"+slug+"/pending_extra_items/"+itemId;

		req.breadcrumbs(BREADCRUMBS['pending_extra_items/pending_extra_items_list']);
		res.render('list',{
			slug : slug,
			link : Constants.WEBSITE_RESTAURANT_URL+slug+"/pending_extra_items/"+itemId+finalQuery
		});
	});
}




