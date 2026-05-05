import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Orders from "./model/orders.mjs";
import * as Constants from "../../../config/global_constant.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure order routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedIn - Middleware to check user authentication
 */
export default function configure(app, { db, checkLoggedIn }) {
    const modulePath = Constants.FRONT_END_NAME + "orders";
    const ordersModule = new Orders(db);

    /** Set current view folder **/
    app.use(modulePath,(req, res, next) => {
        req.rendering.views	=	__dirname + "/views";
        next();
    });

    /** Routing is used to list new orders **/
    app.all(modulePath+"/rejected_orders",checkLoggedIn,(req, res,next) => {
        ordersModule.getRejectOrders(req, res,next);
    });

    /** Routing is used to list new orders **/
    app.all(modulePath+"/mark_prepared/:id",checkLoggedIn,(req, res,next) => {
        ordersModule.markOrderPrepared(req, res,next);
    });

    /** Routing is used to assign captain to orders **/
    app.all(modulePath+'/assign_captain',checkLoggedIn,(req, res, next) => {
        ordersModule.assignCaptain(req, res,next);
    });

    /** Routing is used to reject status of orders **/
    app.all(modulePath+'/reject_order_status',checkLoggedIn,(req, res, next) => {
        ordersModule.rejectOrderRequest(req, res,next);
    });

    /** Routing is used to list new orders **/
    app.all(modulePath+"/:order_status",checkLoggedIn,(req, res,next) => {
        ordersModule.getOrders(req, res,next);
    });

    /** Routing is used to get order detail **/
    app.all(modulePath+"/view/:id",checkLoggedIn,(req, res,next) => {
        ordersModule.viewOrderDetails(req, res,next);
    });

    /** Routing is used to get list of items **/
    app.post(modulePath+'/list_items/:order_id',checkLoggedIn,(req, res, next) => {
        ordersModule.listItems(req, res,next);
    });

    /** Routing is used to update status of orders **/
    app.all(modulePath+'/change_order_status/:id',checkLoggedIn,(req, res, next) => {
        ordersModule.updateOrderStatus(req, res,next);
    });

    /** Routing is used to print receipt **/
    app.get(modulePath+'/print/:order_id',(req, res, next) => {
        ordersModule.printOrder(req, res,next);
    });
}