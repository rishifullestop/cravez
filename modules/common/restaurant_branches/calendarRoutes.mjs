
import branchCalendar from "./model/branch_calendar.mjs";
import { addUpdateValidation } from "./validation/branchCalendar.mjs";
import { validateRequest, convertMultipartReqBody } from "../../../utils/index.mjs";


/**
 * Configure branch calendar routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkRestaurantLoggedIn }) {
    const modulePath =   "/:slug/branches";
    const branchCalendarModule = new branchCalendar(db);

	/** Routing is used to view branch calendar **/
	router.get(modulePath+"/branch_calendars/:id",checkRestaurantLoggedIn,(req, res, next) => {
		branchCalendarModule.getBranchCalendarList(req,res,next);
	});

	/** Routing is used to save branch calendar **/
	router.all(modulePath+"/add_branch_calendar/:id",checkRestaurantLoggedIn,convertMultipartReqBody,addUpdateValidation,validateRequest,(req, res, next) => {
		branchCalendarModule.manageBranchCalendar(req,res,next);
	});

	/** Routing is used to update branch calendar **/
	router.post(modulePath+"/delete_calendar/:id",checkRestaurantLoggedIn,(req, res, next) => {
		branchCalendarModule.deleteBranchCalendar(req,res,next);
	});

	/** Routing is used to get branch calendar details **/
	router.post(modulePath+"/get_calendar_child_details/:id",checkRestaurantLoggedIn,(req, res, next) => {
		branchCalendarModule.getBranchCalendarChildDetails(req,res,next);
	});
} 