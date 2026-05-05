import branches from "./model/branches.mjs";
import { branchTransferValidation, addEditBranchValidation } from "./validation/branch.mjs";
import {validateRequest } from "../../../utils/index.mjs";

/**
 * Configure branches routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default async function configure(router, { db, checkRestaurantLoggedIn }) {
    const modulePath =   "/:slug/branches";
    const branchesModule = new branches(db);

	/** Routing is used to get branches list **/
	router.all(modulePath,checkRestaurantLoggedIn,(req,res,next) => {
		branchesModule.getBranchList(req,res,next);
	});

	/** Routing is used to add new branches **/
	router.all(modulePath+"/add",checkRestaurantLoggedIn,addEditBranchValidation,validateRequest,(req, res, next) => {
		branchesModule.addEditBranch(req,res,next);
	});

	/** Routing is used to edit branches **/
	router.all(modulePath+"/edit/:id",checkRestaurantLoggedIn,addEditBranchValidation,validateRequest,(req, res, next) => {
		branchesModule.addEditBranch(req,res,next);
	});

	/** Routing is used to update branches status **/
	router.post(modulePath+"/update-branch-status",checkRestaurantLoggedIn,(req, res, next) => {
		branchesModule.updateBranchStatus(req,res,next);
	});

	/** Routing is used to view branch detail **/
	router.get(modulePath+"/view/:id",checkRestaurantLoggedIn,(req, res, next) => {
		branchesModule.viewBranchDetail(req,res,next);
	});

	/** Routing is used to view branch detail **/
	router.get(modulePath+"/branch_detail/:id",checkRestaurantLoggedIn,(req, res, next) => {
		branchesModule.branchDetailForm(req,res,next);
	});
	/** Routing is used to get area list **/
	router.post(modulePath+"/get_area_list",checkRestaurantLoggedIn,(req, res, next) => {
		branchesModule.getAreaList(req,res,next);
	});

	/** Routing is used to get block list **/
	router.post(modulePath+"/get_block_list",checkRestaurantLoggedIn,(req, res, next) => {
		branchesModule.getBlockList(req,res,next);
	});
}