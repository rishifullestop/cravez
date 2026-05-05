import { fileURLToPath } from 'url';
import { dirname } from 'path';

import offer from "./model/offer.mjs";
import { addEditValidation} from "./validations.mjs";
import { validateRequest, convertMultipartReqBody} from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure offer routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(app, { db, checkLoggedInAdmin }) {
	const modulePath = '/offer_management';
	const offerModule = new offer(db);

	/** Set current view folder **/
	app.use(modulePath,(req, res, next) => {
		req.rendering.views	=	__dirname + "/views";
		next();
	});

	/** Routing is used to get offer listing **/
	app.all(modulePath,checkLoggedInAdmin,(req, res, next) => {
		offerModule.getOffersList(req, res, next);
	});

	/** Routing is used to add offer **/
	app.all(modulePath+"/add",checkLoggedInAdmin, convertMultipartReqBody, addEditValidation, validateRequest,(req, res, next) => {
		offerModule.addEditOffer(req, res, next);
	});

	/** Routing is used to edit offer **/
	app.all(modulePath+"/edit/:id",checkLoggedInAdmin, convertMultipartReqBody, addEditValidation, validateRequest,(req, res, next) => {
		offerModule.addEditOffer(req, res, next);
	});

	/** Routing is used to get branch list **/
	app.post(modulePath+"/branch_list",checkLoggedInAdmin,(req, res, next) => {
		offerModule.branchList(req, res, next);
	});

	/** Routing is used to update offer status **/
	app.get(modulePath+"/update-status/:id/:status",checkLoggedInAdmin,(req, res, next) => {
		offerModule.updateOfferStatus(req, res, next);
	});

	/** Routing is used to get category list using ajax **/
	app.post(modulePath+"/category_list",checkLoggedInAdmin,(req, res, next) => {
		offerModule.categoryList(req, res, next);
	});

	/** Routing is used to get cuisine list using ajax **/
	app.post(modulePath+"/cuisine_list",checkLoggedInAdmin,(req, res, next) => {
		offerModule.cuisineList(req, res, next);
	});

	/** Routing is used to get item list using ajax**/
	app.post(modulePath+"/item_list",checkLoggedInAdmin,(req, res, next) => {
		offerModule.itemList(req, res, next);
	});

	/** Routing is used to get restaurant list **/
	app.post(modulePath+"/restaurant_list",checkLoggedInAdmin,(req, res, next) => {
		offerModule.restaurantList(req, res, next);
	});

	/** Routing is used to get user list **/
	app.post(modulePath + "/get_users", checkLoggedInAdmin, (req, res, next) => {
		offerModule.getUsersList(req, res, next);
	});
}



