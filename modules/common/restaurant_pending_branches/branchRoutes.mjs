import pendingBranches from "./model/pending_branches.mjs";
import { addEditBranchValidation } from "../restaurant_branches/validation/branch.mjs";
import {validateRequest } from "../../../utils/index.mjs";
import * as Constants from "../../../config/global_constant.mjs";

/**
 * Configure branches routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default async function configure(router, { db, checkRestaurantLoggedIn, checkLoggedInAdmin }) {
    const modulePath =   "/:slug/pending_branches";
    const branchesModule = new pendingBranches(db);

	//** Routing is used to get pending branches list **/
	router.all(modulePath,checkRestaurantLoggedIn,(req,res,next) => {
		branchesModule.getPendingBranchList(req,res,next);
	});

	/** Routing is used to view branche detail **/
	router.get(modulePath+"/view/:id",checkRestaurantLoggedIn,(req, res, next) => {
		branchesModule.viewPendingBranchDetail(req,res,next);
	});

	/** Routing is used to update pending branches **/
	router.post(modulePath+"/update/:id",checkRestaurantLoggedIn, addEditBranchValidation,validateRequest,(req, res, next) => {
		branchesModule.updateBranch(req,res,next);
	});

	/** Routing is used to view branch detail **/
	router.get(modulePath+"/branch_detail/:id",checkRestaurantLoggedIn,(req, res, next) => {
		branchesModule.pendingBranchDetailForm(req,res,next);
	});

	/** Routing is used to submit branch for approval **/
	router.post(modulePath+"/send_for_approval/:id",checkRestaurantLoggedIn,(req, res, next) => {
		branchesModule.sendForApproval(req,res,next);
	});

	/********************************* Admin Routes ******************************** */

	/** Routing is used to update pending branch details : Only for admin **/
	router.post(modulePath+"/reject",checkLoggedInAdmin,(req, res, next) =>{
		branchesModule.rejectBranchRequest(req,res,next).then(response=>{
			if(response.status == Constants.STATUS_SUCCESS) req.flash(Constants.STATUS_SUCCESS,res.__("pending_branches.restaurant_enquiry_has_been_rejected"));
			res.send(response);
		}).catch(next);
	});

	/** Routing is used to publish branch : Only for admin **/
	router.get(modulePath+"/publish/:id",checkLoggedInAdmin,(req, res, next) => {
		branchesModule.publishBranch(req,res,next);
	});

	/** Routing is used to update pending branch details : Only for admin **/
	router.get(modulePath+"/approve/:id",checkLoggedInAdmin,(req, res, next) => {
		let slug  		= 	req?.params?.slug || "";
		let branchId	=	req?.params?.id || "";

		branchesModule.approveBranchPendingRequest(req,res,next).then(response=>{
			/** Send response */
			req.flash(response.status, response.message);
			let redirectPath = (response.status != Constants.STATUS_SUCCESS) ? "/pending_branches" :"/branches/"+branchId;
			res.redirect(Constants.WEBSITE_ADMIN_URL+"restaurants/"+slug+redirectPath);
		}).catch(next);
	});

	/** Routing is used to review pending branch details : Only for admin **/
	router.get(modulePath+"/review/:id",checkLoggedInAdmin,(req, res, next) => {
		let redirectUrl	= req?.query?.redirect ? req.query.redirect : Constants.WEBSITE_ADMIN_URL+"restaurant_pending_branches";

		branchesModule.markBranchInReview(req,res,next).then(response=>{
			/** Send response */
			req.flash(response.status, response.message);
			res.redirect(redirectUrl);
		}).catch(next);
	});

	/********************************* Admin Routes ******************************** */
}