import { fileURLToPath } from 'url';
import { dirname } from 'path';
import SurveyManagement from "./model/survey_management.mjs";
import { addEditSurveyValidation } from "./validations.mjs";
import { validateRequest, convertMultipartReqBody } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure Survey management routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/survey_management';
    const surveyManagementModule = new SurveyManagement(db);

    // Set views for all /survey_management* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    /** Routing is used to get survey list **/
    router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
        surveyManagementModule.getSurveyList(req, res, next);
    });

    /** Routing is used to add survey **/
    router.all(modulePath + "/add", checkLoggedInAdmin, convertMultipartReqBody, addEditSurveyValidation, validateRequest, (req, res, next) => {
        surveyManagementModule.addEditSurvey(req, res, next);
    });

    /** Routing is used to edit survey **/
    router.all(modulePath + "/edit/:id", checkLoggedInAdmin, convertMultipartReqBody, addEditSurveyValidation, validateRequest, (req, res, next) => {
        surveyManagementModule.addEditSurvey(req, res, next);
    });

    /** Routing is used to make live **/
    router.get(modulePath + "/make_live/:id/:status", checkLoggedInAdmin,(req, res, next) => {
        surveyManagementModule.makeLive(req, res, next);
    });

    /** Routing is delete survey **/
    router.get(modulePath + "/delete/:id", checkLoggedInAdmin, (req, res, next) => {
        surveyManagementModule.deleteSurvey(req, res, next);
    });

    /** Routing is view survey **/
    router.get(modulePath + "/view_graph/:id", checkLoggedInAdmin, (req, res, next) => {
        surveyManagementModule.viewGraph(req, res, next);
    });

    /** Routing is view survey **/
    router.get(modulePath + "/view/:survey_id/:user_id", checkLoggedInAdmin, (req, res, next) => {
        surveyManagementModule.viewSurvey(req, res, next);
    });

    /** Routing is used to get survey delete **/
    router.post(modulePath + "/delete/:id", checkLoggedInAdmin, (req, res, next) => {
        surveyManagementModule.surveyQuestionOptionDelete(req, res, next);
    });

     /** Routing is used to get survey delete **/
     router.post(modulePath + "/delete/:id/:option_id", checkLoggedInAdmin, (req, res, next) => {
        surveyManagementModule.surveyQuestionOptionDelete(req, res, next);
    });

    /** Routing is view history **/
    router.all(modulePath + "/view_history/:id", checkLoggedInAdmin, (req, res, next) => {
        surveyManagementModule.viewHistory(req, res, next);
    });
} 