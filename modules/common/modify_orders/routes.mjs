import { fileURLToPath } from 'url';
import { dirname } from 'path';
import modifyOrders from "./model/modify_orders.mjs";
import * as Constants from "../../../config/global_constant.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure modify order routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkRestaurantLoggedIn - Middleware to check restaurant authentication
 */
export default function configure(app, { db, checkRestaurantLoggedIn }) {
    const modulePath    	=   `/${Constants.RESTAURANT_NAME}/modify_orders`;
    const modifyOrderModel 	=   new modifyOrders(db);

	/** Set current view folder **/
	app.use(modulePath,(req, res, next) => {
		req.rendering.views	=	__dirname + "/views";
		res.locals.list_url = Constants.WEBSITE_RESTAURANT_URL+"modify_orders";
		next();
	});

	/** Routing is used to open modify items quantity order page **/
	app.all(modulePath+"/change_quantity/:order_id/:item_id",checkRestaurantLoggedIn,(req, res, next) => {
		modifyOrderModel.changeQuantity(req, res, next);
	});

	/** Routing is used to open modify items quantity order page **/
	app.all(modulePath+"/change_quantity/:order_id/:item_id/:extra_param",checkRestaurantLoggedIn,(req, res, next) => {
		modifyOrderModel.changeQuantity(req, res, next);
	});

	/** Routing is used to open add new items page **/
	app.all(modulePath+"/add_items/:order_id",checkRestaurantLoggedIn,(req, res, next) => {
		modifyOrderModel.addNewItems(req, res, next);
	});

	/** Routing is used to open add new items page **/
	app.post(modulePath+"/get_choice_item",checkRestaurantLoggedIn,(req, res, next) => {
		modifyOrderModel.getChoiceItem(req, res, next);
	});

	/** Routing is used to open add new items page **/
	app.post(modulePath+"/update_new_items",checkRestaurantLoggedIn,(req, res, next) => {
		modifyOrderModel.updateNewItemsInCart(req, res, next);
	});

	/** Routing is used to open add new items page **/
	app.post(modulePath+"/update_deal_items",checkRestaurantLoggedIn,(req, res, next) => {
		modifyOrderModel.updateDealItems(req, res, next);
	});

	/** Routing is used to delete cart item in cart using ajax **/
	app.post(modulePath+"/delete_item_cart",checkRestaurantLoggedIn,(req, res, next) => {
		modifyOrderModel.deleteItemCart(req, res, next);
	});

	/** Routing is used to get list of status_logs **/
	app.post(modulePath+'/add_multiple_item_cart/:order_id',checkRestaurantLoggedIn,(req, res, next) => {
		modifyOrderModel.addItemsCart(req, res,next);
	});

	/** Routing is used to get list of status_logs **/
	app.post(modulePath+'/my_cart/:order_id',checkRestaurantLoggedIn,(req, res, next) => {
		modifyOrderModel.myCart(req, res,next);
	});

	/** Routing is used to check offer code **/
	app.post(modulePath+'/apply_coupon',checkRestaurantLoggedIn,(req, res, next) => {
		modifyOrderModel.applyCoupon(req, res,next);
	});

	/** Routing is used to open add new items page **/
	app.post(modulePath+"/place_order",checkRestaurantLoggedIn,(req, res, next) => {
		modifyOrderModel.placeOrders(req, res, next);
	});
}

