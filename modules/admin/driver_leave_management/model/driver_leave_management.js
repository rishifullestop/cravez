const clone			= 	require('clone');
const eachOfSeries 	= 	require("async/eachOfSeries");
const asyncParallel	=	require('async/parallel');

function Leaves() {

	/** Use in export data **/
	let exportNumber					= 0;
	let exportFilterConditions 			= {};
	let exportSortConditions			= {};
	let exportCommonConditions			= {};
	exportSortConditions[exportNumber]	= {_id:SORT_DESC};

	/**
	 * Function to get vacation request list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	this.getVacationRequestList = (req,res,next)=>{
		let isTeamHead		= (req.session.user.team_head) ? req.session.user.team_head :false;
		let authId 	  		= (isTeamHead) ? req.session.user._id : req.session.user.parent_id;
		let authUserRoleId	= (req.session.user && req.session.user.user_role_id) ? req.session.user.user_role_id :"";
		if(isPost(req)){
			let exportCount	  = (req.body.export_count)	?	req.body.export_count 		:0;
			let limit	      = (req.body.length)   	? 	parseInt(req.body.length)	:ADMIN_LISTING_LIMIT;
			let skip	  	  = (req.body.start)    	? 	parseInt(req.body.start)  	:DEFAULT_SKIP;
			let fromDate  	  = (req.body.fromDate) 	? 	req.body.fromDate 			:"";
			let toDate 	  	  =	(req.body.toDate)   	? 	req.body.toDate 		    :"";
			const collection  =	db.collection('driver_availabilities');

			/** Common Conditions **/
			let commonConditions = {leave_type:	{$exists :true} };

			/** Configure Datatable conditions*/
			configDatatable(req,res,null).then(dataTableConfig=>{

				/** Conditions for leave date */
				let dateConditions = {};
				if(fromDate != "" && toDate != ""){
					dateConditions["date"] = {$gte: newDate(fromDate), $lte: newDate(toDate) };
				}

				if(authUserRoleId != CRAVEZ)  commonConditions.parent_id = ObjectId(authId);

				dataTableConfig.conditions = Object.assign(dateConditions,dataTableConfig.conditions,commonConditions);

				/** Set conditions for export  report **/
				exportCommonConditions				= commonConditions;
				exportFilterConditions[exportCount] = dataTableConfig.conditions;
				exportSortConditions[exportCount]	= dataTableConfig.sort_conditions;
				asyncParallel({
					request_list :(callback)=>{
						/** Get list of vacation requests **/
						collection.aggregate([
							{$match: dataTableConfig.conditions},
							{$group: {
								_id: {
									date	 : 	{$dateToString: { format: "%Y-%m-%d", date: "$date", timezone: DEFAULT_TIME_ZONE }},
									driver_id: 	"$user_id",
								},
								date 		: 	{$first: "$date"},
								root_id		: 	{$first: "$_id"},
								status		: 	{$first: "$status"},
								leave_type 	:	{$first: "$leave_type"},
								user_id 	:	{$first: "$user_id"},
								parent_id 	:	{$first: "$parent_id"},
								leave_status:	{$first: "$leave_status"},
								rejection_reason: {$first: "$rejection_reason"},
							}},
							{$addFields	:	{_id: "$root_id"}},
							{$sort 		: 	dataTableConfig.sort_conditions},
							{$skip 		: 	skip},
							{$limit 	: 	limit},
							{$lookup	: 	{	/** Get users details **/
								"from" 		  :	"users",
								"localField"  :	"user_id",
								"foreignField":	"_id",
								"as" 		  :	"users_details"
							}},
							{$project : {
								_id:1,date:1,status:1,leave_type:1,user_id:1,parent_id:1,leave_status:1,rejection_reason:1, driver_name: {$arrayElemAt : ["$users_details.full_name",0]}, driver_id: {$arrayElemAt : ["$users_details.driver_id",0]}
							}}
						]).toArray((err, result)=>{
							callback(err, result);
						});
					},
					filter_records:(callback)=>{
						/** Get filtered records counting in vacation requests  **/
						collection.aggregate([
							{$match: dataTableConfig.conditions},
							{$group: {
								_id: {
									date	 : 	{$dateToString: { format: "%Y-%m-%d", date: "$date", timezone: DEFAULT_TIME_ZONE }},
									driver_id: 	"$user_id",
								},
							}},
							{$count	: "count"},
						]).toArray((err, filterContResult)=>{
							filterContResult = (filterContResult && filterContResult[0]) ? filterContResult[0].count :0;
							callback(err, filterContResult);
						});
					},
					leave_details:(callback)=>{
						/** Get leave details for selected user */
						let driverId = (dataTableConfig.conditions.user_id) ? dataTableConfig.conditions.user_id : "";
						if(!driverId) return callback(null,null);

						let leaveCondition= {user_id: ObjectId(driverId) };

						/** Get user leaves details **/
						const user_leaves  = db.collection("user_leaves");
						user_leaves.findOne(leaveCondition,{projection: { _id:1,leaves:1,total_leave:1}},(err,leaveResult)=>{
							callback(err,leaveResult);
						});
					},
					drivers :(callback)=>{
						if(authUserRoleId != CRAVEZ) return callback(null,"");

						/** Get users dropdown list **/
						getDropdownList(req,res,next,{
							collections : [{
								collection 	: "users",
								columns 	: ["_id","full_name"],
								conditions 	: DRIVER_COMMON_CONDITIONS
							}]
						}).then(response=>{
							let memberList = (response.final_html_data && response.final_html_data["0"]) ? response.final_html_data["0"] :"";
							callback(null,memberList);
						}).catch(next);
					}
				},(err, response)=>{

					/** Send response **/
					res.send({
						status			: (!err) ? STATUS_SUCCESS : STATUS_ERROR,
						draw			: dataTableConfig.result_draw,
						data			: (response.request_list) 	? 	response.request_list 	:[],
						recordsFiltered	: (response.filter_records) ? 	response.filter_records :0,
						recordsTotal	: (response.filter_records) ? 	response.filter_records :0,
						leave_details	: (response.leave_details) 	? 	response.leave_details 	:{},
						drivers			: (response.drivers) 		?	response.drivers 		:""
					});
				});
			});
		}else{
			exportNumber++;
			let fromDate = (req.query.from_date) ? req.query.from_date 	:"";
			let toDate 	 = (req.query.to_date) 	 ? req.query.to_date 	:"";
			asyncParallel({
				dropdown_list :(callback)=>{
					/** Get users dropdown list **/
					getDropdownList(req,res,next,{
						collections : [{
							collection 	: "users",
							columns 	: ["_id","full_name"],
							conditions 	: DRIVER_COMMON_CONDITIONS,
							append_to_value: true,
							sub_title_field: "driver_id",
						}]
					}).then(response=>{
						let dropDownHtml = (response.final_html_data && response.final_html_data[0]) ? response.final_html_data[0] :"";
						callback(null,dropDownHtml);
					}).catch(next);
				},
				leave_type_list:(callback)=>{
					/** Get leave type list **/
					getAttributes(req,res,next,{type: "vacation_leave_type"}).then(leaveTypeList=>{
						let tempLeaveType = {};
						if(leaveTypeList.length >0){
							leaveTypeList.map(records=>{
								tempLeaveType[String(records.attribute_id)] = records.title;
							});
						}
						callback(null, tempLeaveType);
					}).catch(next);
				},
			},(asyncErr, asyncResponse)=>{

				/** render listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/driver_leave_management/list']);
				res.render('list',{
					users_list   	: asyncResponse.dropdown_list,
					leave_type_list : asyncResponse.leave_type_list,
					export_count 	: exportNumber,
					from_date 		: fromDate,
					to_date 		: toDate
				});
			});
		}
	};//End getVacationRequestList()

	/**
	 * Function to get detail of vacation request
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return json
	 */
	let vacationRequestDetails = (req,res)=>{
		return new Promise(resolve=>{
			let vacationRequestId  = (req.params.id) ? req.params.id : "";

			/** Get vacation request details **/
			const driver_availabilities = db.collection("driver_availabilities");
			driver_availabilities.findOne({ _id: ObjectId(vacationRequestId)},{projection: { _id:1,date:1,leave_type:1,user_id:1,leave_status:1,rejection_reason:1}},(err,result)=>{
				if(err) return next(err);

				/** Send error response */
				if(!result) return resolve({ status: STATUS_ERROR, message: res.__("admin.system.invalid_access")});

				/** Send success response **/
				resolve({ status: STATUS_SUCCESS, result: result });
			});
		});
	};//End vacationRequestDetails()

	/**
	 * Function for add edit vaction request
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	this.addEditVacationRequest = async (req, res,next)=>{
		let isEditable         = (req.params.id) ? true 		 : false;
		let vacationRequestId  = (req.params.id) ? req.params.id : "";
		let isDriverShift  		= (req.query.is_driver_shift) ? req.query.is_driver_shift : "";
		let isTeamHead		   = (req.session.user.team_head) ? req.session.user.team_head :false;
		let authId 	  		   = (isTeamHead) ? req.session.user._id : req.session.user.parent_id;
		let addedBy 	 	   = (req.session.user && req.session.user._id) ? req.session.user._id :"";

		if(isPost(req)){
			/** Sanitize Data **/
			req.body 		= 	sanitizeData(req.body,NOT_ALLOWED_TAGS_XSS);
			let driverId	=	(req.body.driver)	? 	ObjectId(req.body.driver) 	:"";
			let fromDate  	=	req.body.from_date 	? 	req.body.from_date 			:"";
			let toDate    	= 	req.body.to_date   	?	req.body.to_date   			:"";

			/** Check validation **/
			req.checkBody({
				'driver': {
					notEmpty: true,
					errorMessage: res.__("admin.driver_leave_management.please_select_driver")
				},
				'leave_type': {
					notEmpty: true,
					errorMessage: res.__("admin.driver_leave_management.please_select_leave_type")
				},
				'leave_status': {
					notEmpty: true,
					errorMessage: res.__("admin.driver_leave_management.please_select_leave_status")
				}
			});

			if(req.body.leave_status != "" && req.body.leave_status == REJECTED ){
				/** Check validation if leave status is rejected **/
				req.checkBody({
					'rejection_reason': {
						notEmpty: true,
						errorMessage: res.__("admin.driver_leave_management.please_enter_rejection_reason")
					}
				});
			}

			/** parse Validation array  **/
			let errors = parseValidation(req.validationErrors(),req);

			/** Add date validation */
			if(fromDate == "" && toDate == ""){
				if (!errors) errors = [];
				errors.push({'param':'leave_date','msg':res.__("admin.driver_leave_management.please_select_leave_date")});
			}

			/** Send error response **/
			if(errors) return res.send({status: STATUS_ERROR, message: errors});

			let tempFromDate= 	newDate(newDate(fromDate,CURRENTDATE_START_DATE_FORMAT));
			let tempToDate  = 	newDate(newDate(toDate,CURRENTDATE_END_DATE_FORMAT));

			/**Update vacation request details **/
			const driver_availabilities	=	db.collection("driver_availabilities");
			asyncParallel({
				request_ids :(callback)=>{
					if(!vacationRequestId) return callback(null,null);

					vacationRequestDetails(req, res, next).then(reqRes=>{
						if(reqRes.status != STATUS_SUCCESS) return callback(reqRes);

						let tmpDetails 	=	reqRes.result;
						let tmpStartDate=	newDate(newDate(tmpDetails.date, CURRENTDATE_START_DATE_FORMAT));
						let tmpEndDate	=	newDate(newDate(tmpDetails.date, CURRENTDATE_END_DATE_FORMAT));

						/** Get request ids */
						driver_availabilities.distinct("_id",{user_id: driverId, date: {$gte: tmpStartDate, $lte: tmpEndDate } },(err, requestIds)=>{
							callback(err, requestIds);
						});
					}).catch(next);
				},
				weekly_leave :(callback)=>{
					if(isEditable) return callback(null,[]);

					/** Find vacation request details **/
					driver_availabilities.find({
						date 		: 	{$gte: tempFromDate, $lte: tempToDate},
						user_id		: 	ObjectId(req.body.driver),
						leave_type	: 	WEEKLY_OFF,
					},{projection: {date:1}}).toArray((leaveErr,leaveResult)=>{
						callback(leaveErr,leaveResult);
					});
				},
				driver_inshift : (callback)=>{
					/** Get driver inshift list */
					const driver_in_out_shifts = db.collection("driver_in_out_shifts");
					driver_in_out_shifts.findOne({
						driver_id	: 	ObjectId(req.body.driver),
						created     : 	{$gte: tempFromDate},
						type		:	IN_SHIFT,
					},{projection:{_id:1}},(err, result)=>{
						callback(err, result);
					});
				},
			},(asyncErr,asyncRes)=>{
				if(asyncErr) return next(asyncErr);

				/** Send error response **/
				if(asyncRes.driver_inshift) return res.send({status: STATUS_ERROR, message: [{'param':'leave_date','msg':res.__("admin.driver_leave_management.not_allow_because_driver_inshift")}]});

				let requestIds 			=	asyncRes.request_ids;
				let weeklyLeaveList		= 	(asyncRes.weekly_leave) ? asyncRes.weekly_leave :[];
				let weeklyLeaveIds		= 	[];
				let weeklyLeaveDates	= 	[];
				if(weeklyLeaveList.length >0){
					weeklyLeaveList.map(tmpData=>{
						if(tmpData._id) weeklyLeaveIds.push(tmpData._id);
						if(tmpData.date) weeklyLeaveDates.push(String(newDate(tmpData.date,DATE_FORMAT_EXPORT)));
					});
				}

				/** Set conditions **/
				let driverAvailableConditions = {
					date 		: 	{$gte: tempFromDate, $lte: tempToDate },
					user_id 	: 	driverId,
					leave_type 	:	{$exists :true},
					$and		:	[ {_id: {$nin: weeklyLeaveIds}} ]
				};

				if(requestIds) driverAvailableConditions._id = {$nin : requestIds };

				/** Check leave date is unique **/
				driver_availabilities.countDocuments(driverAvailableConditions,(countErr,totalRecords)=>{
					if(countErr) return next(countErr);

					if(totalRecords > 0){
						/** Send error for leave date **/
						return res.send({
							status	: STATUS_ERROR,
							message	: [{'param':'leave_date','msg':res.__("admin.driver_leave_management.entered_leave_date_already_exists")}]
						});
					}

					/**Update vacation request details **/
					asyncParallel({
						update_details :(callback)=>{
							if(!requestIds) return callback(null);

							/** Update vacation request record **/
							driver_availabilities.updateMany({
								_id		: 	{$in: requestIds},
								status 	:	PENDING,
							},
							{$unset : {
								status			 :	1,
								leave_type		 :	1,
								rejection_reason :  1,
								leave_status     :  1
							}},(updateErr) => {
								if(updateErr) return callback(updateErr);

								/** Delete vacation request if driver not assign any shift  **/
								driver_availabilities.deleteMany({_id: {$in: requestIds}, shift_id: "",},(deleteErr)=>{
									callback(deleteErr);
								});
							});
						},
					},(asyncErr)=>{
						if(asyncErr) return next(asyncErr);

						/** set data **/
						let updateData = [];
						let dates 	   = getDates(new Date(fromDate), new Date(toDate));
						let date 	   = "";
						dates.map(records=>{
							date = newDate(records,DATABASE_DATE_FORMAT);
							let tempObj = {
								added_by   	: ObjectId(addedBy),
								parent_id  	: ObjectId(authId),
								user_id    	: ObjectId(req.body.driver),
								leave_type	: parseInt(req.body.leave_type),
								status     	: PENDING,
								date	   	: getUtcDate(date+" "+END_DATE_TIME_FORMAT),
								created    	: getUtcDate(),
								leave_status: parseInt(req.body.leave_status)
							};
							if(req.body.leave_status == REJECTED) tempObj.rejection_reason = req.body.rejection_reason;

							updateData.push(tempObj);
						});

						eachOfSeries(updateData,(records, firstKey, seriesCallback)=>{
							let setData = {
								status		 :	PENDING,
								leave_type	 :	records.leave_type,
								leave_status :  records.leave_status,
							};

							if(records.rejection_reason) setData.rejection_reason =  records.rejection_reason;

							/** Skip when already posted weekly off */
							if(weeklyLeaveDates.indexOf(String(newDate(records.date,DATE_FORMAT_EXPORT)) ) != -1) return seriesCallback(null);

							/** Save vacation request details **/
							driver_availabilities.updateMany({
								date 	  : records.date,
								user_id   : records.user_id,
								parent_id : records.parent_id,
							},
							{	$set : setData,
								$setOnInsert: {
									shift_id	: 	"",
									city_id		: 	"",
									area_id		: 	"",
									added_by  	: 	records.added_by,
									created		:	getUtcDate(),
								}
							},{upsert: true},(updateErr) => {
								seriesCallback(updateErr);

								/** save System logs */
								saveSystemLogs(req, res, {
									user_id				: req.session.user._id,
									parent_id			: vacationRequestId,
									activity_module		: SYSTEM_LOG_MODULE_VACATION_REQUEST,
									activity_type		: ACTIVITY_TYPE_ADD_EDIT,
									additional_details	: {
										date 	  		 :	records.date,
										user_id  		 : 	records.user_id,
										parent_id 		 : 	records.parent_id,
										weekly_leave_ids : 	weeklyLeaveIds
									}
								}).then(()=>{ });
							});
						},(eachErr)=> {
							if(eachErr) return next(eachErr);

							/** Send success response **/
							let message = isEditable ? res.__("admin.driver_leave_management.vacation_request_has_been_updated_successfully") : res.__("admin.driver_leave_management.vacation_request_has_been_added_successfully");
							req.flash(STATUS_SUCCESS,message);
							res.send({
								status		: STATUS_SUCCESS,
								redirect_url: (isDriverShift) ? WEBSITE_ADMIN_URL+"driver_shifts" :WEBSITE_ADMIN_URL+"driver_leave_management/driver_vacation_request",
								message		: message
							});

							/*************** Send notification  ***************/
								sendMailToUsers(req,res,{
									event_type 		:	NOTIFICATION_VACATION_REQUEST,
									parent_table_id	: 	req.body.driver,
									user_id			: 	req.body.driver,
									tl_fullname		: 	req.session.user.full_name,
								});
							/*************** Send notification  ***************/
						});
					});
				});
			});
		}else{
			let response = {};
			if(isEditable){
				/** Get vacation request details **/
				response  =	await vacationRequestDetails(req, res, next);
				if(response.status != STATUS_SUCCESS){
					/** Send error response **/
					return res.status(400).send({status: STATUS_ERROR, message: response.message });
				}
			}

			let driverId 	=	response.result && response.result.user_id 		?	response.result.user_id 	:"";
			let leaveType 	= 	response.result && response.result.leave_type 	? 	response.result.leave_type 	:"";
			let options = {
				collections: [{
					collection: "users",
					columns	  : ["_id", "full_name"],
					conditions: DRIVER_COMMON_CONDITIONS,
					selected  : [driverId]
				},
				{
					collection: "attributes",
					columns	  : ["attribute_id", "title"],
					conditions: {
						type 	: "vacation_leave_type",
						is_show : true,
					},
					selected  		:	[leaveType],
					sort_conditions : 	{order: SORT_ASC}
				}]
			};
			getDropdownList(req,res,next,options).then(dropDownResponse =>{
				if(dropDownResponse.status != STATUS_SUCCESS){
					return res.status(400).send({ status: STATUS_ERROR, message: dropDownResponse.message });
				}

				/** Render add edit page  **/
				res.render('add_edit',{
					layout      	:	false,
					result			:	response.result,
					is_editable		: 	isEditable,
					users_list  	:	dropDownResponse.final_html_data["0"],
					leave_type_list :	dropDownResponse.final_html_data["1"],
					is_driver_shift :	isDriverShift,
				});
			}).catch(next);
		}
	};//End addEditVacationRequest()

	/**
	 * Function for delete vacation request
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	this.vacationRequestDelete = (req, res, next)=>{
		let requestId  	= 	ObjectId(req.params.id);
		let isTeamHead	= 	(req.session.user.team_head) ? req.session.user.team_head :false;
		let authId 	  	=	(isTeamHead) ? ObjectId(req.session.user._id) :ObjectId(req.session.user.parent_id);

		/** Update vacation request record **/
		const driver_availabilities = db.collection("driver_availabilities");
		driver_availabilities.findOne({
			_id 		:	requestId,
			parent_id	: 	ObjectId(authId),
			$or			:	[
				{status 	: PENDING},
				{leave_type : WEEKLY_OFF},
			]
		},{projection: { _id:1,shift_id:1,user_id:1,date:1}},(shiftErr,shiftResult)=>{
			if(shiftErr) return next(shiftErr);

			if(!shiftResult){
				/** Send success response **/
				req.flash(STATUS_ERROR,res.__("admin.system.invalid_access"));
				return res.redirect(WEBSITE_ADMIN_URL+"driver_leave_management/driver_vacation_request");
			}

			let tmpStartDate= 	newDate(newDate(shiftResult.date,CURRENTDATE_START_DATE_FORMAT));
			let tmpEndDate  = 	newDate(newDate(shiftResult.date,CURRENTDATE_END_DATE_FORMAT));

			/** Get request ids */
			driver_availabilities.distinct("_id",{ user_id: shiftResult.user_id, date: {$gte: tmpStartDate, $lte: tmpEndDate }, },(errs, requestIds)=>{
				if(errs) return next(errs);

				if(requestIds.length == 0){
					/** Send success response **/
					req.flash(STATUS_ERROR,res.__("admin.system.invalid_access"));
					return res.redirect(WEBSITE_ADMIN_URL+"driver_leave_management/driver_vacation_request");
				}

				asyncParallel({
					delete_request:(callback)=>{
						if(shiftResult.shift_id) return callback(null);

						/** Delete vacation request if driver not assign any shift  **/
						driver_availabilities.deleteMany({_id: {$in: requestIds}, shift_id: "",},(deleteErr)=>{
							callback(deleteErr);
						});
					},
					update_request:(callback)=>{
						if(!shiftResult.shift_id) return callback(null);

						/** Update vacation request record **/
						driver_availabilities.updateMany({
							_id	: {$in: requestIds},
						},
						{$unset : {
							status		:	1,
							leave_type	:	1,
							leave_status:	1,
						}},(updateErr) => {
							callback(updateErr);
						});
					},
				},(asyncErr)=>{
					if(asyncErr) return next(asyncErr);

					/** Send success response **/
					req.flash(STATUS_SUCCESS,res.__("admin.driver_leave_management.vacation_request_has_been_deleted_successfully"));
					res.redirect(WEBSITE_ADMIN_URL+"driver_leave_management/driver_vacation_request");

					/** save System logs */
					requestIds.map(reqId=>{
						saveSystemLogs(req, res, {
							user_id				: req.session.user._id,
							parent_id			: reqId,
							activity_module		: SYSTEM_LOG_MODULE_VACATION_REQUEST,
							activity_type		: ACTIVITY_TYPE_DELETE,
							additional_details	: {}
						}).then(()=>{ });
					});
				});
			});
		});
	};//End vacationRequestDelete()

	/**
	* Function for export data
	*
	* @param req 	As Request Data
	* @param res 	As Response Data
	* @param next 	As Callback argument to the middleware function
	*
	* @return render/json
	*/
	this.exportData = (req,res,next)=>{
		let exportType	= 	(req.params.export_type) 	?	req.params.export_type  :"";
		let exportCount	= 	(req.params.export_count)	? 	req.params.export_count :0;
		let memberId	=	(req.query.member)			?	req.query.member 		:"";

		let attributeOptions = {type: "vacation_leave_type"};
		if(exportType == "leave_balance") attributeOptions.is_show = true;

		/** Get leave type list **/
		getAttributes(req,res,next,attributeOptions).then(leaveTypeList=>{
			if(exportType == "leave_balance") {
				
				/** Get user leaves details **/
				let commonCondition = {
					user_role_id	: 	DRIVER,
					is_deleted		: 	NOT_DELETED
				}

				if(memberId) commonCondition  = {...{_id: ObjectId(memberId)}, ...commonCondition};

				/** Get driver ids */
				const users = db.collection("users");
				users.distinct("_id",commonCondition,(err, userIds)=>{
					if(err) return next(err);
					
					/** Get driver leave list */
					const user_leaves   =	db.collection("user_leaves");
					user_leaves.aggregate([
						{$match : {user_id : {$in : userIds}}},
						{$lookup: {	/** Get users details **/
							"from" 		  :	"users",
							"localField"  :	"user_id",
							"foreignField":	"_id",
							"as" 		  :	"users_details"
						}},
						{$project : { _id:1,leaves:1,total_leave:1,driver_name: {$arrayElemAt : ["$users_details.full_name",0]} }}
					]).toArray((userErr, userResult)=>{
						if(userErr) return next(userErr);

						/** Define excel heading label **/
						let tempData		= [];
						let commonColumns	= [
							res.__("admin.driver_leave_management.driver"),
							res.__("admin.driver_leave_management.total_leave"),
						];

						/** Set leave types in excel heading label **/
						leaveTypeList.map(key=>{
							commonColumns.push(key.title);
						});

						if(userResult && userResult.length > 0){
							userResult.map(records=>{
								let data = {};

								/** Insert leaves in a array according to the leave type **/
								records.leaves.map(leaveRecords=> {
									let leaveType = leaveRecords.leave_type;
									if(!data[leaveType]) data[leaveType] = [];
									data[leaveType].push(leaveRecords.leaves);
								});

								let buffer = [
									(records.driver_name),
									(records.total_leave),
								];

								/** Insert leaves in buffer **/
								leaveTypeList.map(key=>{
									Object.keys(data).map(leaveType=>{
										if(String(leaveType) == String(key.attribute_id)){
											data[leaveType].map(leaveData=>{
												buffer.push(leaveData);
											});
										}
									});
								});

								tempData.push(buffer);
							});
						}
						/**  Function to export data in excel format of leave balance **/
						exportToExcel(req,res,{
							file_prefix 		: "leaveBalanceReport",
							heading_columns		: commonColumns,
							export_data			: tempData
						});
					});
				});
			}else {
				/** conditions **/
				let filterCondition = (exportFilterConditions[exportCount]) ? exportFilterConditions[exportCount] :"";

				if(!filterCondition) {
					req.flash(STATUS_ERROR,res.__("admin.system.invalid_access"));
					return res.redirect(WEBSITE_ADMIN_URL+"driver_leave_management/driver_vacation_request");
				}

				let sortConditions = (exportSortConditions[exportCount]) ? exportSortConditions[exportCount] : exportSortConditions[0];
				let conditions	   = (exportType == EXPORT_FILTERED) 	 ? filterCondition 					 : exportCommonConditions;

				/** Get vacation request details **/
				const driver_availabilities = db.collection("driver_availabilities");
				driver_availabilities.aggregate([
					{$match : conditions},
					{$group: {
						_id: {
							date	 : 	{$dateToString: { format: "%Y-%m-%d", date: "$date", timezone: DEFAULT_TIME_ZONE }},
							driver_id: 	"$user_id",
						},
						date 		: 	{$first: "$date"},
						root_id		: 	{$first: "$_id"},
						status		: 	{$first: "$status"},
						leave_type 	:	{$first: "$leave_type"},
						user_id 	:	{$first: "$user_id"},
						parent_id 	:	{$first: "$parent_id"},
						leave_status:	{$first: "$leave_status"},
						rejection_reason:	{$first: "$rejection_reason"},
					}},
					{$addFields	:	{_id: "$root_id"}},
					{$sort 	: sortConditions},
					{$lookup: {	/** Get users details **/
						"from" 		  :	"users",
						"localField"  :	"user_id",
						"foreignField":	"_id",
						"as" 		  :	"users_details"
					}},
					{$project : { _id:1,date:1,leave_type:1,driver_name: {$arrayElemAt : ["$users_details.full_name",0]} }}
				]).toArray((err, result)=>{
					if(err) return next(err);

					let temp		= [];
					let commonColls	= [];

					/** Define excel heading label **/
					commonColls	= [
						res.__("admin.driver_leave_management.driver"),
						res.__("admin.driver_leave_management.leave_date"),
						res.__("admin.driver_leave_management.leave_type"),
					];

					if(result && result.length > 0){
						result.map(records=>{
							let leaveTypeTitle = "";
							leaveTypeList.map(typeRecords=>{
								if(String(typeRecords.attribute_id) == String(records.leave_type)) leaveTypeTitle = typeRecords.title;
							});

							let buffer = [
								(records.driver_name),
								newDate(records.date,DATE_FORMAT_EXPORT),
								leaveTypeTitle
							];
							temp.push(buffer);
						});
					}

					/**  Function to export data in excel format of vacation request **/
					exportToExcel(req,res,{
						file_prefix 		: "vacationRequestReport",
						heading_columns		: commonColls,
						export_data			: temp
					});
				});
			}
		}).catch(next);
	};// end exportData()

	/**
	* Function for view leave balance
	*
	* @param req 	As 	Request Data
    * @param res 	As 	Response Data
    * @param next 	As 	Callback argument to the middleware function
	*
	* @return render
	*/
	this.viewLeaveBalance = (req,res,next)=>{
		let driverId 	= (req.params.id) ? req.params.id : "";

		asyncParallel({
			driver_leave_list :(callback)=>{
				/** Get driver leaves details **/
				const user_leaves   = db.collection("user_leaves");
				user_leaves.findOne({ user_id : ObjectId(driverId)},{projection: { _id:1,leaves:1,total_leave:1}},(err,leaveResult)=>{
					callback(err,leaveResult);
				});
			},
			leave_type_list:(callback)=>{
				/** Get leave type list **/
				getAttributes(req,res,next,{type: "vacation_leave_type", is_show :true}).then(leaveTypeList=>{

					let tempLeaveType = {};
					if(leaveTypeList.length >0){
						leaveTypeList.map(records=>{
							tempLeaveType[String(records.attribute_id)] = records.title;
						});
					}
					callback(null, tempLeaveType);
				}).catch(next);
			},
		},(asyncErr, asyncResponse)=>{
			if(asyncErr) return next(asyncErr);

			/** Render view leave balance page  **/
			res.render('view_leave_balance',{
				layout  		:	false,
				result			: 	asyncResponse.driver_leave_list,
				leave_type_list	: 	asyncResponse.leave_type_list,
			});
		});
	};//End viewLeaveBalance()

	/**
	 * Function to add/edit weekly off
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	this.addWeeklyOff = async (req, res,next)=>{
		let isEditable         = (req.params.id) 	?	true 		 			:false;
		let weeklyRequestId    = (req.params.id) 	? 	req.params.id 			:"";
		let addedBy 	 	   = (req.session.user._id)? req.session.user._id 	:"";
		let isTeamHead		   = (req.session.user.team_head) ? req.session.user.team_head :false;
		let authId 	  		   = (isTeamHead) 		? 	req.session.user._id 	:req.session.user.parent_id;
		let isDriverShift  	   = (req.query.is_driver_shift) ? req.query.is_driver_shift : "";

		if(isPost(req,res)){
			/** Sanitize Data **/
			req.body		=	sanitizeData(req.body,NOT_ALLOWED_TAGS_XSS);
			let driverId	=	(req.body.driver) ? ObjectId(req.body.driver) :"";

			/** Check validation **/
			req.checkBody({
				'driver': {
					notEmpty: true,
					errorMessage: res.__("admin.driver_leave_management.please_select_driver")
				},
				'dates': {
					notEmpty: true,
					errorMessage: res.__("admin.driver_leave_management.please_select_dates")
				}
			});

			/** parse Validation array  **/
			let errors = parseValidation(req.validationErrors(),req);

			/** Send error response **/
			if(errors) return res.send({status: STATUS_ERROR, message: errors});

			let dates = (req.body.dates) ? req.body.dates.split(",") : [];
			if(dates.constructor !== Array)	dates = [dates];
			let dateArray = [];
			dates.map(records=>{
				date = newDate(records,DATABASE_DATE_FORMAT);
				dateArray.push(getUtcDate(date+" "+END_DATE_TIME_FORMAT));
			});

			/**Update vacation request details **/
			const driver_availabilities	=	db.collection("driver_availabilities");
			asyncParallel({
				request_ids :(callback)=>{
					if(!weeklyRequestId) return callback(null,null);

					vacationRequestDetails(req, res, next).then(reqRes=>{
						if(reqRes.status != STATUS_SUCCESS) return callback(reqRes);

						let tmpDetails 	=	(reqRes.result)	?	reqRes.result 	:{};
						let tmpDate		= 	newDate(tmpDetails.date,DATABASE_DATE_FORMAT);
						let tmpStartDate=	newDate(tmpDate+" "+START_DATE_TIME_FORMAT);
						let tmpEndDate	=	newDate(tmpDate+" "+END_DATE_TIME_FORMAT);

						/** Get request ids */
						driver_availabilities.distinct("_id",{
							user_id	: 	driverId,
							date	: 	{$gte: newDate(tmpStartDate), $lte: newDate(tmpEndDate) },
						},(err, requestIds)=>{
							callback(err, requestIds);
						});
					}).catch(next);
				},
			},(asyncErr,asyncRes)=>{
				if(asyncErr) return next(asyncErr);

				/** Set conditions **/
				let requestIds 	=	asyncRes.request_ids;
				let availabilitiesConditions = {
					date 		: 	{$in : dateArray},
					user_id 	: 	driverId,
					leave_type 	:	{$exists :true},
				};

				if(requestIds) availabilitiesConditions._id = {$nin : requestIds };

				/** Check leave date is unique **/
				const driver_availabilities = db.collection("driver_availabilities");
				driver_availabilities.countDocuments(availabilitiesConditions,(countErr,totalRecords)=>{
					if(countErr) return next(countErr);

					if(totalRecords > 0){
						/** Send error for leave date **/
						return res.send({
							status	: STATUS_ERROR,
							message	: [{'param':'dates','msg':res.__("admin.driver_leave_management.entered_leave_date_already_exists")}]
						});
					}

					/**Update vacation request details **/
					asyncParallel({
						update_details :(callback)=>{
							if(!requestIds) return callback(null);

							/** Update vacation request record **/
							driver_availabilities.updateMany({
								_id : {$in: requestIds},
							},
							{$unset : {
								status		:	1,
								leave_type	:	1,
							}},(updateErr) => {
								if(updateErr) return callback(updateErr);

								/** Delete vacation request if driver not assign any shift  **/
								driver_availabilities.deleteMany({_id: {$in: requestIds}, shift_id: "",},(deleteErr)=>{
									callback(deleteErr);
								});
							});
						},
					},(asyncErr)=>{
						if(asyncErr) return next(asyncErr);

						/** set data **/
						let updateData = [];
						dates.map(records=>{
							date = newDate(records,DATABASE_DATE_FORMAT);
							updateData.push({
								parent_id  : ObjectId(authId),
								added_by   : ObjectId(addedBy),
								user_id    : driverId,
								leave_type : WEEKLY_OFF,
								date	   : getUtcDate(date+" "+END_DATE_TIME_FORMAT),
								created    : getUtcDate()
							});
						});

						eachOfSeries(updateData,(records, firstKey, seriesCallback)=>{

							/** Save vacation request details **/
							driver_availabilities.updateMany({
								date 	  : records.date,
								user_id   : records.user_id,
								parent_id : records.parent_id,
							},
							{	$set : {
									leave_status : 	APPROVED,
									status 		 :	PENDING,
									leave_type	 :	records.leave_type,
								},
								$setOnInsert: {
									shift_id	: 	"",
									city_id		: 	"",
									area_id		: 	"",
									added_by  	: 	records.added_by,
									created		:	getUtcDate(),
								}
							},{upsert: true},(updateErr) =>{
								seriesCallback(updateErr);

								/** save System logs */
								saveSystemLogs(req, res, {
									user_id				: req.session.user._id,
									parent_id			: weeklyRequestId,
									activity_module		: SYSTEM_LOG_MODULE_WEEKLY_OFF,
									activity_type		: ACTIVITY_TYPE_ADD_EDIT,
									additional_details	: {
										date 	  : records.date,
										user_id   : records.user_id,
										parent_id : records.parent_id
									}
								}).then(()=>{ });
							});
						},(eachErr)=> {
							if(eachErr) return next(eachErr);

							/** Send success response **/
							let message = (isEditable) ? res.__("admin.driver_leave_management.weekly_off_has_been_updated_successfully") : res.__("admin.driver_leave_management.weekly_off_has_been_added_successfully");
							req.flash(STATUS_SUCCESS,message);
							res.send({
								status		: STATUS_SUCCESS,
								redirect_url: (!isEditable || isDriverShift) ? WEBSITE_ADMIN_URL+"driver_shifts" :WEBSITE_ADMIN_URL+"driver_leave_management/driver_vacation_request",
								message		: message
							});

							/*************** Send notification  ***************/
							sendMailToUsers(req,res,{
								event_type 			:	NOTIFICATION_WEEKLY_REQUEST,
								parent_table_id 	: 	ObjectId(req.body.driver),
								user_id				: 	ObjectId(req.body.driver),
								tl_fullname			: 	req.session.user.full_name,
							});
							/*************** Send notification  ***************/
						});
					});
				});
			});
		}else{
			let response = {};
			if(isEditable){
			 	/** Get vacation request details **/
			 	response  =	await vacationRequestDetails(req, res, next);
			 	if(response.status != STATUS_SUCCESS){
			 		/** Send error response **/
			 		return res.status(400).send({status: STATUS_ERROR, message: response.message });
				}
			}

			/** Get driver list **/
			let driverId = response.result && response.result.user_id ? response.result.user_id :"";
			getDropdownList(req,res,next,{
				collections: [{
					collection: "users",
					columns	  : ["_id", "full_name"],
					conditions: clone(DRIVER_COMMON_CONDITIONS),
					selected  : [driverId]
				}]
			}).then(dropDownResponse =>{
				if(dropDownResponse.status != STATUS_SUCCESS){
					return res.status(400).send({status: STATUS_ERROR, message: dropDownResponse.message });
				}

				/** Render add edit page  **/
				res.render('weekly_off',{
					layout      : false,
					users_list  : dropDownResponse.final_html_data["0"],
					result		: response.result,
					is_editable	: isEditable,
					is_driver_shift :	isDriverShift,
				});
			}).catch(next);
		}
	};//End addWeeklyOff()

	/**
	 * Function to update vacation request status
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return response
	 */
	this.updateRequestStatus = (req, res, next)=>{
		/** Sanitize Data **/
		req.body	 	=	sanitizeData(req.body,NOT_ALLOWED_TAGS_XSS);
		let status 		= 	(req.body.status) 	? 	req.body.status 			:"";
		let requestIds	= 	(req.body.req_ids) 	?	req.body.req_ids.split(",") :[];

		/** Send error response */
		if(!status || requestIds.length ==0){
			return res.send({status: STATUS_ERROR, message: res.__("system.invalid_access") });
		}

		/** Send error response if rejection_reason is empty */
		if(status == REJECTED && !req.body.rejection_reason) return res.send({ status: STATUS_ERROR, message: [{ 'param': 'rejection_reason', 'msg': res.__("admin.driver_leave_management.please_enter_rejection_reason")}]});

		const driver_availabilities = db.collection("driver_availabilities");
		driver_availabilities.find({
			_id 	:	{$in: arrayToObject(requestIds) },
			status 	:	PENDING
		},{projection: {_id:1,user_id:1,date:1 }}).toArray((err, result)=>{
			if(err) return next(err);

			/** Send error response */
			if(result.length ==0){
				return res.send({ status: STATUS_ERROR, message: res.__("admin.system.something_going_wrong_please_try_again") });
			}

			eachOfSeries(result,(records, firstKey, callback)=>{
				let tmpDate		= 	newDate(records.date,DATABASE_DATE_FORMAT);
				let tmpStartDate=	newDate(tmpDate+" "+START_DATE_TIME_FORMAT);
				let tmpEndDate	=	newDate(tmpDate+" "+END_DATE_TIME_FORMAT);

				/** Get request ids */
				driver_availabilities.distinct("_id",{
					user_id	: 	records.user_id,
					date	: 	{$gte: newDate(tmpStartDate), $lte: newDate(tmpEndDate) },
				},(err, requestIds)=>{
					if(err || requestIds.length ==0) return callback(err);

					/** Set updatable data **/
					let updateData = {
						$set :{
							leave_status:	parseInt(status),
							modified 	: 	getUtcDate()
						}
					};

					if(status==REJECTED){
						updateData["$set"].rejection_reason = req.body.rejection_reason;
					}else{
						updateData["$unset"] = {rejection_reason: 1};
					}

					/** Update vacation request status **/
					driver_availabilities.updateMany({_id: {$in: requestIds}, status: PENDING },updateData,(updateErr) => {
						callback(updateErr);

						/** Save system logs */
						requestIds.map(requestId=>{
							saveSystemLogs(req, res, {
								user_id				: req.session.user._id,
								parent_id			: ObjectId(requestId),
								activity_module		: SYSTEM_LOG_MODULE_VACATION_REQUEST,
								activity_type		: ACTIVITY_TYPE_STATUS_UPDATE,
								additional_details	: {status : status}
							}).then(()=>{ });
						});
					});
				});
			},(eachErr)=>{
				if(eachErr) return next(eachErr);

				/** Send success response **/
				let message = (status == IN_REVIEW) ? res.__("admin.driver_leave_management.status_has_been_updated_successfully") : ((status == APPROVED) ? res.__("admin.driver_leave_management.vacation_request_has_been_approved_successfully") : res.__("admin.driver_leave_management.vacation_request_has_been_rejected"));
				res.send({status: STATUS_SUCCESS, message: message });
			});
		});
	};//End updateRequestStatus()
}
module.exports = new Leaves();