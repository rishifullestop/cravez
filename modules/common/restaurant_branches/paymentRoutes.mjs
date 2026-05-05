import branchPaymentMethods from "./model/branches_payments.mjs";

/**
 * Configure branch payment methods routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkRestaurantLoggedIn }) {
    const modulePath =   "/:slug/branches";
    const branchPaymentMethodsModule = new branchPaymentMethods(db);

    /** Routing is used to view branch payment method **/
	router.get(modulePath+"/branch_payments/:id",checkRestaurantLoggedIn,(req, res, next) => {
		branchPaymentMethodsModule.branchPaymentMethods(req,res,next);
	});

	/** Routing is used to save branch payment methods **/
	router.post(modulePath+"/save_payment_methods/:id",checkRestaurantLoggedIn,(req, res, next) => {
		branchPaymentMethodsModule.saveBranchPaymentMethods(req,res,next);
	});
} 