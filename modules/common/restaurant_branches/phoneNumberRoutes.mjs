import branchPhoneNumber from "./model/branch_phones.mjs";
import { addBranchPhoneValidation } from "./validation/branchPhone.mjs";
import {validateRequest } from "../../../utils/index.mjs";

/**
 * Configure branch phone number routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkRestaurantLoggedIn }) {
    const modulePath =   "/:slug/branches";
    const branchPhoneNumberModule = new branchPhoneNumber(db);

   /** Routing is used to view branch phone number list **/
	router.get(modulePath+"/branch_phones/:id",checkRestaurantLoggedIn,(req, res, next) => {
		branchPhoneNumberModule.getBranchPhoneNumberList(req,res,next);
	});

	/** Routing is used to add branch phone number **/
	router.all(modulePath+"/add_phone_number/:id",checkRestaurantLoggedIn,addBranchPhoneValidation,validateRequest,(req, res, next) => {
		branchPhoneNumberModule.addOrEditBranchPhoneNumber(req,res,next);
	});

	/** Routing is used to update branch phone number **/
	router.all(modulePath+"/update_phone_number/:id/:phone_number_id",checkRestaurantLoggedIn,addBranchPhoneValidation,validateRequest,(req, res, next) => {
		branchPhoneNumberModule.addOrEditBranchPhoneNumber(req,res,next);
	});

	/** Routing is used to delete branch phone number **/
	router.post(modulePath+"/delete_phone_number/:id",checkRestaurantLoggedIn,(req, res, next) => {
		branchPhoneNumberModule.deleteBranchPhoneNumber(req,res,next);
	});
} 