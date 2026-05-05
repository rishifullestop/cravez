
import branchAttribute from "./model/branch_attributes.mjs";


/**
 * Configure branch attribute routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkRestaurantLoggedIn }) {
    const modulePath =   "/:slug/branches";
    const branchAttributeModule = new branchAttribute(db);

    /** Routing is used to view branch attribute **/
	router.get(modulePath+"/branch_attributes/:id",checkRestaurantLoggedIn,(req, res, next) => {
		branchAttributeModule.getBranchAttributes(req,res,next);
	});

	/** Routing is used to save branch attribute **/
	router.post(modulePath+"/save_branch_attributes/:id",checkRestaurantLoggedIn,(req, res, next) => {
		branchAttributeModule.saveBranchAttributes(req,res,next);
	});
} 