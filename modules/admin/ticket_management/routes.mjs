import { fileURLToPath } from 'url';
import { dirname } from 'path';
import TicketManagement from "./model/ticket_management.mjs";
import { 
    addEditTicketValidation, 
    addCommentValidation, 
    reassignTicketValidation, 
    addReviewValidation, 
    reopenTicketValidation
} from "./validations.mjs";
import { validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure ticket management routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/tickets';
    const ticketManagementModule = new TicketManagement(db);

    // Set views for all /tickets* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    /** Routing is used to get all ticket list **/
    router.all(modulePath + "/all_tickets", checkLoggedInAdmin, (req, res, next) => {
        req.params.ticket_type = "all_tickets";
        ticketManagementModule.ticketList(req, res, next);
    });

    /** Routing is used to get my ticket list **/
    router.all(modulePath + "/my_tickets", checkLoggedInAdmin, (req, res, next) => {
        req.params.ticket_type = "my_tickets";
        ticketManagementModule.ticketList(req, res, next);
    });

    /** Routing is used to get incoming ticket list **/
    router.all(modulePath + "/incoming_tickets", checkLoggedInAdmin, (req, res, next) => {
        req.params.ticket_type = "incoming_tickets";
        ticketManagementModule.ticketList(req, res, next);
    });

    /** Routing is used to get close ticket list **/
    router.all(modulePath + "/close_tickets", checkLoggedInAdmin, (req, res, next) => {
        req.params.ticket_type = "close_tickets";
        ticketManagementModule.ticketList(req, res, next);
    });

    /** Routing is used to get reopen ticket list **/
    router.all(modulePath + "/reopen_tickets", checkLoggedInAdmin, (req, res, next) => {
        req.params.ticket_type = "reopen_tickets";
        ticketManagementModule.ticketList(req, res, next);
    });

    /** Routing is used to get qa comment ticket list **/
    router.all(modulePath + "/qa_comment_tickets", checkLoggedInAdmin, (req, res, next) => {
        req.params.ticket_type = "qa_comment_tickets";
        ticketManagementModule.ticketList(req, res, next);
    });

    /** Routing is used to add ticket **/
    router.all(modulePath + "/add", checkLoggedInAdmin, addEditTicketValidation, validateRequest, (req, res, next) => {
        ticketManagementModule.addTicket(req, res, next);
    });

    /** Routing is used to edit ticket **/
    router.all(modulePath + "/edit/:id", checkLoggedInAdmin, addEditTicketValidation, validateRequest, (req, res, next) => {
        ticketManagementModule.addTicket(req, res, next);
    });

    /** Routing is used to get category **/
    router.post(modulePath + "/get_category", checkLoggedInAdmin, (req, res, next) => {
        ticketManagementModule.getCategoryList(req, res, next);
    });

    /** Routing is used to ticket check in  **/
    router.get(modulePath + "/update-status/:id", checkLoggedInAdmin, (req, res, next) => {
        ticketManagementModule.ticketCheckIn(req, res, next);
    });

    /** Routing is used to add ticket comments**/
    router.post(modulePath + "/add_comment", checkLoggedInAdmin, addCommentValidation, validateRequest, (req, res, next) => {
        ticketManagementModule.addComment(req, res, next);
    });

    /** Routing is used to add ticket review**/
    router.post(modulePath + "/add_review", checkLoggedInAdmin, addReviewValidation, validateRequest, (req, res, next) => {
        ticketManagementModule.addReview(req, res, next);
    });

    /** Routing is used to reassign **/
    router.post(modulePath + "/reassign", checkLoggedInAdmin, reassignTicketValidation, validateRequest, (req, res, next) => {
        ticketManagementModule.reAssignTicket(req, res, next);
    });

    /** Routing is used to reopen **/
    router.post(modulePath + "/reopen", checkLoggedInAdmin, reopenTicketValidation, validateRequest, (req, res, next) => {
        ticketManagementModule.reOpenTicket(req, res, next);
    });

    /** Routing is used to close ticket **/
    router.get(modulePath + "/close_ticket/:ticket_id", checkLoggedInAdmin, (req, res, next) => {
        ticketManagementModule.closeTicket(req, res, next);
    });

    /** Routing is used to view ticket **/
    router.get(modulePath + "/view/:id", checkLoggedInAdmin, (req, res, next) => {
        ticketManagementModule.viewTicket(req, res, next);
    });

    /** Routing is used to get customer ticket list **/
    router.all(modulePath + "/customer_ticket_list/:user_id", checkLoggedInAdmin, (req, res, next) => {
        ticketManagementModule.getCommonTicketList(req, res, next);
    });

    /** Routing is used to get order ticket list **/
    router.all(modulePath + "/order_ticket_list/:order_id", checkLoggedInAdmin, (req, res, next) => {
        ticketManagementModule.getCommonTicketList(req, res, next);
    });

    /** Routing is used to add order ticket **/
    router.all(modulePath + "/order_ticket_list/add/:order_id", checkLoggedInAdmin, addEditTicketValidation, validateRequest, (req, res, next) => {
        ticketManagementModule.addTicket(req, res, next);
    });

    /** Routing is used to get user list **/
    router.post(modulePath + "/user_list", checkLoggedInAdmin, (req, res, next) => {
        ticketManagementModule.getUserList(req, res, next);
    });

    /** Routing is used to get export  details **/
    router.get(modulePath + "/:ticket_type/export_data/:export_count/:export_type", checkLoggedInAdmin, (req, res, next) => {
        ticketManagementModule.exportData(req, res, next);
    });

    /** Routing is used to add order ticket **/
    router.all(modulePath + "/customer_ticket_list/add/:user_id", checkLoggedInAdmin, addEditTicketValidation, validateRequest, (req, res, next) => {
        ticketManagementModule.addTicket(req, res, next);
    });
} 