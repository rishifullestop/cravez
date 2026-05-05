
import branchArea from "./model/branch_area.mjs";
import { addBranchAreaValidation } from "./validation/branchArea.mjs";
import {validateRequest, convertMultipartReqBody } from "../../../utils/index.mjs";

/**
 * Configure branch area routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkRestaurantLoggedIn }) {
    const modulePath =   "/:slug/branches";
    const branchAreaModule = new branchArea(db);

   /** Routing is used to get branch area list **/
    router.all(modulePath+'/branch_areas/:id', checkRestaurantLoggedIn, (req, res, next) => {
        branchAreaModule.getBranchArea(req, res, next);
    });

    router.all(modulePath+"/add_branch_areas/:id", checkRestaurantLoggedIn, addBranchAreaValidation, validateRequest, (req, res, next) => {
        branchAreaModule.addBranchArea(req, res, next);
    });

	/** Routing is used to add branch area settings **/
	router.post(modulePath+"/get_branch_area_settings/:id",checkRestaurantLoggedIn,(req, res, next) => {
		branchAreaModule.getBranchAreaSettings(req,res,next);
	});

	/** Routing is used to update branch area status **/
	router.post(modulePath+"/update_branch_area_status/:id",checkRestaurantLoggedIn,(req, res, next) => {
		branchAreaModule.updateBranchAreaStatus(req,res,next);
	});

	/** Routing is used to save branch area settings **/
	router.post(modulePath+"/save_branch_area_settings/:id",checkRestaurantLoggedIn,convertMultipartReqBody,(req, res, next) => {
		branchAreaModule.saveBranchAreaSettings(req,res,next);
	});
}