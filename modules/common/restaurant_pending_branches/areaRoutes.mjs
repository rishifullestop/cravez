
import branchArea from "./model/branch_area.mjs";
import { addBranchAreaValidation } from "../restaurant_branches/validation/branchArea.mjs";
import {validateRequest, convertMultipartReqBody } from "../../../utils/index.mjs";

/**
 * Configure branch area routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkRestaurantLoggedIn }) {
    const modulePath =   "/:slug/pending_branches";
    const branchAreaModule = new branchArea(db);

   /** Routing is used to get branch area list **/
    router.all(modulePath+'/branch_areas/:id', checkRestaurantLoggedIn, (req, res, next) => {
        branchAreaModule.getBranchPendingArea(req, res, next);
    });

    router.all(modulePath+"/add_branch_areas/:id", checkRestaurantLoggedIn, addBranchAreaValidation, validateRequest, (req, res, next) => {
        branchAreaModule.addBranchPendingArea(req, res, next);
    });

    /** Routing is used to add branch area **/
	router.all(modulePath+"/branch_areas/export_data/:id/:export_type",checkRestaurantLoggedIn,(req, res, next) => {
		branchAreaModule.branchAreaExport(req,res,next);
	});

	/** Routing is used to add branch area settings **/
	router.post(modulePath+"/get_branch_area_settings/:id",checkRestaurantLoggedIn,(req, res, next) => {
		branchAreaModule.getBranchPendingAreaSettings(req,res,next);
	});

	/** Routing is used to update branch area status **/
	router.post(modulePath+"/update_branch_area_status/:id",checkRestaurantLoggedIn,(req, res, next) => {
		branchAreaModule.updateBranchPendingAreaStatus(req,res,next);
	});

	/** Routing is used to save branch area settings **/
	router.post(modulePath+"/save_branch_area_settings/:id",checkRestaurantLoggedIn,convertMultipartReqBody,(req, res, next) => {
		branchAreaModule.saveBranchPendingAreaSettings(req,res,next);
	});
} 