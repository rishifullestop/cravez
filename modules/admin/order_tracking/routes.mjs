import { fileURLToPath } from 'url';
import { dirname } from 'path';
import orderTracking from "./model/order_tracking.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure order tracking routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(app, { db, checkLoggedInAdmin }) {
    const modulePath = '/order_tracking';
    const orderTrackingModule = new orderTracking(db);

    /** Set current view folder **/
	app.use(modulePath,(req, res, next) => {
		req.rendering.views	=	__dirname + "/views";
		next();
	});

	/** Routing is used to get order tracking list **/
	app.all(modulePath,checkLoggedInAdmin,(req, res,next) => {
		orderTrackingModule.getOrderTrackingList(req, res ,next);
	});

	/** Routing is used to get order location using ajax**/
	app.post(modulePath+"/get_order_location",checkLoggedInAdmin,(req, res,next) => {
		orderTrackingModule.getOrderLocation(req, res,next);
	});

	/** Routing is used to get assign captain list **/
	app.get(modulePath+"/assign_captain_list/:order_id",checkLoggedInAdmin,(req, res,next) => {
		orderTrackingModule.assignCaptainList(req, res,next);
	});

	/** Routing is used to get order undo assign  **/
	app.get(modulePath+"/order_undo_assign/:order_id",checkLoggedInAdmin,(req, res,next) => {
		orderTrackingModule.orderUndoAssign(req, res,next);
	});

	/** Routing is used to get assign captain list **/
	app.post(modulePath+"/get_captain_list",checkLoggedInAdmin,(req, res,next) => {
		orderTrackingModule.getCaptainList(req, res,next);
	});

	/** Routing is used to get assign captain list **/
	app.post(modulePath+"/get_floor_status_list",checkLoggedInAdmin,(req, res,next) => {
		orderTrackingModule.getFloorStatusList(req, res,next);
	});

	/** Routing is used to order assign to captain **/
	app.post(modulePath+"/order_assign_to_captain/:order_id/:captain_id/:distance_in_minutes",checkLoggedInAdmin,(req, res,next) => {
		orderTrackingModule.orderAssignToCaptain(req, res,next);
	});

	/** Routing is used to get captain location **/
	app.post(modulePath+"/get_driver_location",checkLoggedInAdmin,(req, res,next) => {
		orderTrackingModule.getDriverLocation(req, res,next);
	});

	/** Routing is used to get order count **/
	app.post(modulePath+"/get_order_data",checkLoggedInAdmin,(req, res,next) => {
		orderTrackingModule.getOrderData(req, res,next);
	});

	/** Routing is used to confirm status **/
	app.all(modulePath+"/confirm_order_status/:order_id",checkLoggedInAdmin,(req, res,next) => {
		orderTrackingModule.confirmStatus(req, res,next);
	});
}