import { fileURLToPath } from 'url';
import { dirname } from 'path';
import VOCManagement from "./model/voc_management.mjs";
import { addEditVOCValidation, addOrderVOCValidation } from "./validations.mjs";
import { validateRequest, convertMultipartReqBody } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure VOC management routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/voc_management';
    const vocManagementModule = new VOCManagement(db);

    // Set views for all /voc_management* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    /** Routing is used to get voc list **/
    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        vocManagementModule.getVOCList(req, res, next);
    });

    /** Routing is used to add voc **/
    router.all(modulePath + "/add", checkLoggedInAdmin, convertMultipartReqBody, addEditVOCValidation, validateRequest, (req, res, next) => {
        vocManagementModule.addEditVOC(req, res, next);
    });

    /** Routing is used to edit voc **/
    router.all(modulePath + "/edit/:id", checkLoggedInAdmin, convertMultipartReqBody, addEditVOCValidation, validateRequest, (req, res, next) => {
        vocManagementModule.addEditVOC(req, res, next);
    });

    /** Routing is used to delete question and options **/
    router.post(modulePath + "/delete/:id", checkLoggedInAdmin, (req, res, next) => {
        vocManagementModule.VOCQuestionOptionDelete(req, res, next);
    });

    /** Routing is used to delete question and options **/
    router.post(modulePath + "/delete/:id/:option_id", checkLoggedInAdmin, (req, res, next) => {
        vocManagementModule.VOCQuestionOptionDelete(req, res, next);
    });

    /** Routing is used to update voc status **/
    router.get(modulePath + "/update-status/:id/:status", checkLoggedInAdmin, (req, res, next) => {
        vocManagementModule.updateVOCStatus(req, res, next);
    });

    /** Routing is used to get customer voc list **/
    router.all(modulePath + "/customer_voc_list/:user_id", checkLoggedInAdmin, validateRequest, (req, res, next) => {
        vocManagementModule.getCommonVOCList(req, res, next);
    });

    /** Routing is used to get order voc list **/
    router.all(modulePath + "/order_voc_list/:order_id/:voc_type", checkLoggedInAdmin,(req, res, next) => {
        vocManagementModule.getCommonVOCList(req, res, next);
    });

    /** Routing is used to add order voc **/
    router.all(modulePath + "/add_order_voc/:order_id", checkLoggedInAdmin, addOrderVOCValidation, validateRequest, (req, res, next) => {
        vocManagementModule.addOrderVOC(req, res, next);
    });

    /** Routing is used to add order voc **/
    router.all(modulePath + "/add_order_voc/:order_id/:voc_type", checkLoggedInAdmin, addOrderVOCValidation, validateRequest, (req, res, next) => {
        vocManagementModule.addOrderVOC(req, res, next);
    });

    /** Routing is used to question list using ajax **/
    router.post(modulePath + "/get_question_list", checkLoggedInAdmin, (req, res, next) => {
        vocManagementModule.getQuestionList(req, res, next);
    });
} 