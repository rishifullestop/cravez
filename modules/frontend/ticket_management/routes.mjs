import { fileURLToPath } from 'url';
import { dirname } from 'path';
import TicketManagement from "./model/ticket_management.mjs";
import * as Constants from "../../../config/global_constant.mjs";
import { validateRequest } from "../../../utils/index.mjs";
import { addEditValidation, addCommentValidation } from "./validations.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure ticket management routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedIn - Middleware to check user authentication
 */
export default function configure(router, { db, checkLoggedIn }) {
    const modulePath = Constants.FRONT_END_NAME + "tickets";
    const ticketManagementModule = new TicketManagement(db);

	router.use(modulePath, (req, res, next) => {
		req.rendering.views = __dirname + "/views";
		next();
	});

	/** Routing is used to get ticket list **/
	router.all(modulePath,checkLoggedIn,(req, res,next) => {
		ticketManagementModule.ticketList(req, res,next);
	});
	
	/** Routing is used to add ticket **/
	router.all(modulePath+"/add",checkLoggedIn,addEditValidation,validateRequest,(req, res, next) => {
		ticketManagementModule.addTicket(req, res, next);
	});
	
	/** Routing is used to edit ticket **/
	router.all(modulePath+"/edit/:id",checkLoggedIn,addEditValidation,validateRequest,(req, res, next) => {
		ticketManagementModule.addTicket(req, res, next);
	});
	
	/** Routing is used to get category **/
	router.post(modulePath+"/get_category",checkLoggedIn,(req, res, next) => {
		ticketManagementModule.getCategoryList(req, res, next);
	});
	
	/** Routing is used to view ticket **/
	router.get(modulePath+"/view/:id",checkLoggedIn,(req, res, next) => {
		ticketManagementModule.viewTicket(req, res, next);
	});
	
	/** Routing is used to add ticket comments**/
	router.post(modulePath+"/add_comment",checkLoggedIn,addCommentValidation,validateRequest,(req, res, next) => {
		ticketManagementModule.addComment(req, res, next);
	});
}




