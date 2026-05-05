/** Model file path for current plugin **/
const modelPath  	= 	__dirname+"/model/driver_leave_management";
const modulePath	= 	"/"+ADMIN_NAME+"/driver_leave_management";
const { addEditVacationRequest, getVacationRequestList, vacationRequestDelete, exportData,updateRequestStatus,viewLeaveBalance,addWeeklyOff} = require(modelPath);

/** Set current view folder **/
app.use(modulePath,(req, res, next) => {
   	req.rendering.views  = __dirname + "/views";
    next();
});

/** Routing is used to add  vacation request **/
app.all(modulePath+"/driver_vacation_request/add",checkLoggedInAdmin,(req, res, next) => {
	addEditVacationRequest(req, res, next);
});

/** Routing is used to edit vacation request **/
app.all(modulePath+"/driver_vacation_request/edit/:id",checkLoggedInAdmin,(req, res, next) => {
	addEditVacationRequest(req, res, next);
});

/** Routing is used to get vacation request list **/
app.all(modulePath+"/driver_vacation_request",checkLoggedInAdmin,(req, res,next) => {
	getVacationRequestList(req, res,next);
});

/** Routing is used to delete vacation request details **/
app.get(modulePath+"/driver_vacation_request/delete/:id",checkLoggedInAdmin,(req, res, next) => {
	vacationRequestDelete(req, res, next);
});

/** Routing is used to get export vacation request details **/
app.get(modulePath+"/driver_vacation_request/export_data/:export_count/:export_type",checkLoggedInAdmin,(req, res,next)=>{
    exportData(req,res,next);
});

/** Routing is used to view leave balance **/
app.get(modulePath+"/driver_vacation_request/view_leave_balance/:id",checkLoggedInAdmin,(req, res, next) => {
	viewLeaveBalance(req, res, next);
});

/** Routing is used to add  vacation request **/
app.all(modulePath+"/driver_vacation_request/add",checkLoggedInAdmin,(req, res, next) => {
	addEditVacationRequest(req, res, next);
});

/** Routing is used to add weekly off **/
app.all(modulePath+"/driver_vacation_request/add_weekly_off",checkLoggedInAdmin,(req, res, next) => {
	addWeeklyOff(req, res, next);
});

/** Routing is used to edit weekly off **/
app.all(modulePath+"/driver_vacation_request/edit_weekly_off/:id",checkLoggedInAdmin,(req, res, next) => {
	addWeeklyOff(req, res, next);
});

/** Routing is used to update pending request status **/
app.all(modulePath + "/update_request_status", checkLoggedInAdmin, (req, res, next) => {
	updateRequestStatus(req, res, next);
});
