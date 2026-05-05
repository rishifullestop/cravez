import { fileURLToPath } from 'url';
import { dirname } from 'path';
import QualityMonitorForm from "./model/quality_monitor_form.mjs";
import MonthlyReport from "./model/monthly_report.mjs";

import { qualityMonitorFormValidation, qualityMonitorFormValidationOne } from "./validations.mjs";
import { convertMultipartReqBody, validateRequest } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure avaya reports routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/avaya_reports';
    const qualityMonitorFormModule = new QualityMonitorForm(db);
    const monthlyReportModule = new MonthlyReport(db);

    // Set views for all /avaya_reports* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

    /** Routing is used to get quality monitor form list **/
    router.all(modulePath+"/quality_monitor_form",checkLoggedInAdmin,convertMultipartReqBody, qualityMonitorFormValidation, validateRequest, (req, res,next) => {
        qualityMonitorFormModule.getQualityMonitorForm(req,res,next);
    });

    /** Routing is used to get quality monitor form list **/
    router.all(modulePath+"/quality_monitor_form1",checkLoggedInAdmin,convertMultipartReqBody, qualityMonitorFormValidationOne, validateRequest,(req, res,next) => {
        qualityMonitorFormModule.getQualityMonitorForm1(req,res,next);
    });

    /** Routing is used to get user list **/
    router.post(modulePath+"/get_user_list",checkLoggedInAdmin,(req, res, next) => {
        qualityMonitorFormModule.getUserList(req, res, next);
    });

     /** Routing is used to view quality monitor form list **/
     router.all(modulePath+"/view_monitor_form",checkLoggedInAdmin,(req, res,next) => {
        qualityMonitorFormModule.viewQualityMonitorForm(req,res);
    });

    /** Routing is used to get monthly agent performance **/
    router.all(modulePath+"/monthly_performance",checkLoggedInAdmin,(req, res,next)=>{
        monthlyReportModule.calculateMonthlyStats(req, res,next);
    });
} 