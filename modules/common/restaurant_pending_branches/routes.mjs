import { Router } from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as Constants from "../../../config/global_constant.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function getBranchRouter({ db, checkRestaurantLoggedIn, checkLoggedInAdmin }) {
	const router = Router();

	/** Set current view folder **/
	const modulePath =   "/:slug/pending_branches";
	router.use(modulePath,(req,res,next) => {
		req.rendering.views	= __dirname + "/views";
		
		let slug 		= req?.params?.slug || "";
		let moduleType 	= res?.locals?.module_type || "";

		/** Set base url **/
		if(moduleType == Constants.MODULE_TYPE_RESTAURANT){
			res.locals.base_url = Constants.WEBSITE_URL+"restaurants/"+slug+"/";
		}else{
			res.locals.base_url = Constants.WEBSITE_ADMIN_URL+"restaurants/"+slug+"/";
		}

		/** Set list url **/
		res.locals.list_url = Constants.WEBSITE_RESTAURANT_URL+slug+"/pending_branches";

		next();
	});

	const pendingBranchRelatedRoutes = [
		"branchRoutes",
		"areaRoutes",
		"attributeRoutes",
		"calendarRoutes",
		"paymentRoutes",
		"phoneNumberRoutes"
	];

	try {
		// Dynamically import and initialize each module's routes
		for (const key of pendingBranchRelatedRoutes) {
			const tmpRoutes = await import(`./${key}.mjs`);
			tmpRoutes.default(router, { db, checkRestaurantLoggedIn, checkLoggedInAdmin });
		}    
	} catch (error) {
		console.log("error ===>", error);
	}	

	return router;
}