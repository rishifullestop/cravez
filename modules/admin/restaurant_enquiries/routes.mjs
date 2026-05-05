import { fileURLToPath } from 'url';
import { dirname } from 'path';
import enquiryController from "./model/restaurant_enquiries.mjs";
import { approveEnquiryValidation, rejectEnquiryValidation, addEnquiryValidation } from "./validations.mjs";
import { validateRequest, convertMultipartReqBody } from "../../../utils/index.mjs";
import * as Constants from "../../../config/global_constant.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure restaurant enquiries routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/restaurant_enquiries';
	const enquiryModel = new enquiryController(db);

	/** Set current view folder **/
	router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

	/** Routing is used to get restaurant enquiry list **/
	router.all(modulePath,checkLoggedInAdmin,(req, res) => {
		enquiryModel.getEnquiryList(req, res);
	});

	/** Routing is used to approve restaurant enquiry request **/
	router.all(modulePath+"/approve/:id",checkLoggedInAdmin,convertMultipartReqBody,approveEnquiryValidation,validateRequest,(req, res, next) => {
		req.params.action_type = Constants.APPROVED;
		enquiryModel.approveEnquiry(req, res, next);
	});

	/** Routing is used to approve restaurant enquiry request **/
	router.all(modulePath+"/approve/:id/:restaurant_id",checkLoggedInAdmin,convertMultipartReqBody,approveEnquiryValidation,validateRequest,(req, res, next) => {
		req.params.action_type = Constants.APPROVED;
		enquiryModel.approveEnquiry(req, res, next);
	});

	/** Routing is used to reject restaurant enquiry request**/
	router.post(modulePath+"/reject_enquiry",checkLoggedInAdmin,rejectEnquiryValidation,validateRequest,(req, res, next) => {
		enquiryModel.rejectEnquiry(req, res, next);
	});

	/** Routing is used to view restaurant enquiry **/
	router.get(modulePath+"/view/:id",checkLoggedInAdmin,(req, res, next) => {
		enquiryModel.viewEnquiry(req, res, next);
	});

	/** Routing is used to add restaurant enquiry **/
	router.all(modulePath+"/add",checkLoggedInAdmin,addEnquiryValidation,validateRequest,(req, res, next) => {
		enquiryModel.addEnquiry(req, res, next);
	});

	/** Routing is used to upsate restaurant enquiry status **/
	router.get(modulePath+"/update-status/:id",checkLoggedInAdmin,(req, res, next) => {
		enquiryModel.updateStatus(req, res, next);
	});
	/** Routing is used to upsate restaurant enquiry status **/
	router.post(modulePath+"/update-multiple-status",checkLoggedInAdmin,(req, res, next) => {
		enquiryModel.updateMultipleStatus(req, res, next);
	});

	/** Routing is used to update restaurant details **/
	router.all(modulePath+"/update-restaurant/:restaurant_id",checkLoggedInAdmin,convertMultipartReqBody,approveEnquiryValidation,validateRequest,(req, res, next) => {
		enquiryModel.approveEnquiry(req, res, next);
	});

	/** Routing is used to delete restaurant enquiry **/
	router.get(modulePath+"/delete-enquiry/:id",checkLoggedInAdmin,(req, res, next) => {
		enquiryModel.deleteRestaurantEnquiry(req, res, next);
	});

	/** Routing is used to download file restaurant enquiry **/
	router.get(modulePath+"/download-file/:id",checkLoggedInAdmin,(req, res, next) => {
		enquiryModel.downloadFile(req, res, next);
	});
}