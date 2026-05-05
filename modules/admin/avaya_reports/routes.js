/** Model file path for current plugin **/
const modulePath				= 	"/"+ADMIN_NAME+"/avaya_reports";
const modelPath  				= 	__dirname+"/model/quality_monitor_form";
const monthlyReportModelPath  	= 	__dirname+"/model/monthly_report";
const {getQualityMonitorForm,getUserList,viewQualityMonitorForm,getQualityMonitorForm1} = require(modelPath);
const {calculateMonthlyStats} = require(monthlyReportModelPath);

/** Set current view folder **/
app.use(modulePath,(req, res, next) => {
   	req.rendering.views	=	__dirname + "/views";
    next();
});


