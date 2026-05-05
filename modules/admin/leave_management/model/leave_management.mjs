import { ObjectId } from 'mongodb';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, getDropdownList, getUtcDate, getDateRange, newDate, getAttributes, sanitizeData, configDatatable, exportToExcel } from '../../../../utils/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { saveSystemLogs, sendMailToUsers } from '../../../../services/index.mjs';
import clone from 'clone';
import {parallel as asyncParallel,  each as  asyncEach} from 'async';

class Leaves {
	constructor(db) {
		this.db = db;
		
		/** Use in export data **/
		this.exportNumber = 0;
		this.exportFilterConditions = {};
		this.exportSortConditions = {};
		this.exportCommonConditions = {};
		this.exportSortConditions[this.exportNumber] = {_id: Constants.SORT_DESC};
	}

	/**
	 * Function to get vacation request list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getVacationRequestList(req, res, next) {
		let authId = (req.session.user && req.session.user._id) ? req.session.user._id : "";
		let authUserRoleId = (req.session.user && req.session.user.user_role_id) ? req.session.user.user_role_id : "";
		let isTeamHead = (req.session.user.team_head) ? req.session.user.team_head : false;

		if (isPost(req)) {
			let exportCount = (req.body.export_count) ? req.body.export_count : 0;
			let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
			let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
			let fromDate = (req.body.fromDate) ? req.body.fromDate : "";
			let toDate = (req.body.toDate) ? req.body.toDate : "";
			let leaveType = (req.body.leaveType) ? req.body.leaveType : "";
			const collection = this.db.collection(Tables.TEAM_AVAILABILITIES);

			/** Common Conditions **/
			let commonConditions = {
				parent_id: new ObjectId(authId),
				leave_type: {$exists: true}
			};

			try {
				/** Configure Datatable conditions*/
				const dataTableConfig = await configDatatable(req, res, null);
				
				/** Conditions for leave date */
				if (fromDate != "" && toDate != "") {
					dataTableConfig.conditions["date"] = {
						$gte: newDate(fromDate),
						$lte: newDate(toDate),
					};
				}
				if (authUserRoleId == Constants.CRAVEZ && dataTableConfig.conditions.parent_id) commonConditions.parent_id = dataTableConfig.conditions.parent_id;

				/**Filter by leave type */
				if (leaveType != "") {
					dataTableConfig.conditions["$and"] = [{
						leave_type: parseInt(leaveType)
					}];
				}

				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				/** Set conditions for export  report **/
				this.exportCommonConditions = commonConditions;
				this.exportFilterConditions[exportCount] = dataTableConfig.conditions;
				this.exportSortConditions[exportCount] = dataTableConfig.sort_conditions;

				const response = await new Promise((resolve, reject) => {
					asyncParallel({
						vacation_request_list: (callback) => {
							/** Get list of vacation requests **/
							collection.aggregate([
								{$match: dataTableConfig.conditions},
								{$sort: dataTableConfig.sort_conditions},
								{$skip: skip},
								{$limit: limit},
								{$lookup: {	/** Get users details **/
									"from": Tables.USERS,
									"localField": "user_id",
									"foreignField": "_id",
									"as": "users_details"
								}},
								{$lookup: {	/** Get parent details **/
									"from": Tables.USERS,
									"localField": "action_taken_by",
									"foreignField": "_id",
									"as": "approved_details"
								}},
								{$project: {
									_id: 1, date: 1, status: 1, leave_type: 1, user_id: 1, parent_id: 1, leave_status: 1, rejection_reason: 1,
									team_member_name: {$arrayElemAt: ["$users_details.full_name", 0]}, action_taken_by: {$arrayElemAt: ["$approved_details.full_name", 0]}
								}}
							]).toArray().then(result => {
								callback(null, result);
							}).catch(next);
						},
						total_records: (callback) => {
							/** Get total number of records in vacation requests  collection **/
							collection.countDocuments(commonConditions).then(countResult => {
								callback(null, countResult);
							}).catch(next);
						},
						filter_records: (callback) => {
							/** Get filtered records counting in vacation requests  **/
							collection.countDocuments(dataTableConfig.conditions).then(filterContResult => {
								callback(null, filterContResult);
							}).catch(next);
						},
						leave_details: (callback) => {
							/** Get leave details for selected user */
							let teamMemberId = (dataTableConfig.conditions.user_id) ? dataTableConfig.conditions.user_id : "";
							if (!teamMemberId) return callback(null, null);

							const user_leaves = this.db.collection(Tables.USER_LEAVES);
							/** Get user leaves details **/
							user_leaves.findOne({user_id: new ObjectId(teamMemberId)}, {projection: {_id: 1, leaves: 1, total_leave: 1}}).then(leaveResult => {
								callback(null, leaveResult);
							}).catch(next);
						},
						team_members: (callback) => {
							/**Get team members if Constants.CRAVEZ select team head */
							let parentId = (dataTableConfig.conditions.parent_id) ? dataTableConfig.conditions.parent_id : "";
							if (!parentId || authUserRoleId != Constants.CRAVEZ) return callback(null, "");

							/** Set options for get users list **/
							let conditions = clone(Constants.ADMIN_USER_COMMON_CONDITIONS);
							conditions.parent_id = new ObjectId(parentId);

							let options = {
								collections: [{
									collection: Tables.USERS,	
									columns: ["_id", "full_name"],
									conditions: conditions
								}]
							};

							/** Get users dropdown list **/
							getDropdownList(req, res, next, options).then(response => {
								if (response.status != Constants.STATUS_SUCCESS) return callback(null, "");
								let memberList = response.final_html_data["0"];
								callback(null, memberList);
							}).catch(next);
						}
					}, (err, response) => {
						if (err) reject(err);
						else resolve(response);
					});
				});

				/** Send response **/
				res.send({
					status: Constants.STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: (response.vacation_request_list) ? response.vacation_request_list : [],
					recordsFiltered: (response.filter_records) ? response.filter_records : 0,
					recordsTotal: (response.total_records) ? response.total_records : 0,
					leave_details: (response.leave_details) ? response.leave_details : {},
					team_members: (response.team_members) ? response.team_members : ""
				});
			} catch (error) {next(error);}
		} else {
			this.exportNumber++;
			let fromDate = (req.query.from_date) ? req.query.from_date : "";
			let toDate = (req.query.to_date) ? req.query.to_date : "";
			let queryLeaveType = (req.query.leave_type) ? req.query.leave_type : "";
			
			try {
				const asyncResponse = await new Promise((resolve, reject) => {
					asyncParallel({
						dropdown_list: (callback) => {
							/** Set options for get users list **/
							let conditions = clone(Constants.ADMIN_USER_COMMON_CONDITIONS);
							conditions.parent_id = new ObjectId(authId);

							/**Select defaut team if tl is logged in */
							let selected = [];
							if (isTeamHead) selected.push(authId);

							/** Set conditions */
							let teamConditions = clone(Constants.ADMIN_USER_COMMON_CONDITIONS);
							teamConditions.team_head = true;
							if (isTeamHead) teamConditions._id = new ObjectId(authId);

							let options = {
								collections: [{
									collection: Tables.USERS,
									columns: ["_id", "full_name"],
									conditions: conditions
								}]
							};

							if (authUserRoleId == Constants.CRAVEZ) {
								options.collections.push({
									collection: Tables.USERS,
									columns: ["_id", "full_name"],
									selected: selected,
									conditions: teamConditions
								});
							}

							/** Get users dropdown list **/
							getDropdownList(req, res, next, options).then(response => {
								let dropDownHtml = (response.final_html_data) ? response.final_html_data : [];
								callback(null, dropDownHtml);
							}).catch(next);
						},
						leave_type_list: (callback) => {
							/** Get leave type list **/
							getAttributes(req, res, next, {type: "vacation_leave_type"}).then(leaveTypeList => {
								let tempLeaveType = {};
								if (leaveTypeList.length > 0) {
									leaveTypeList.map(records => {
										tempLeaveType[String(records.attribute_id)] = records.title;
									});
								}
								callback(null, tempLeaveType);
							}).catch(next);
						},
					}, (asyncErr, asyncResponse) => {
						if (asyncErr) reject(asyncErr);
						else resolve(asyncResponse);
					});
				});

				/** render listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/leave_management/list']);
				res.render('list', {
					users_list: asyncResponse.dropdown_list["0"],
					team_list: asyncResponse.dropdown_list["1"],
					leave_type_list: asyncResponse.leave_type_list,
					export_count: this.exportNumber,
					from_date: fromDate,
					to_date: toDate,
					query_leave_type: queryLeaveType
				});
			} catch (error) {
				next(error);
			}
		}
	}

	/**
	 * Function to get detail of vacation request
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return json
	 */
	async vacationRequestDetails(req, res,next) {
		return new Promise(resolve => {
			let vacationRequestId = (req.params.id) ? req.params.id : "";

			/** Get vacation request details **/
			const team_availabilities = this.db.collection(Tables.TEAM_AVAILABILITIES);
			team_availabilities.findOne({_id: new ObjectId(vacationRequestId)}, {projection: {_id: 1, date: 1, leave_type: 1, user_id: 1, leave_status: 1, rejection_reason: 1}}).then(result => {
				if (!result) return resolve({status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access")});

				/** Send error response */
				if (!result) return resolve({status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access")});

				/** Send success response **/
				resolve({
					status: Constants.STATUS_SUCCESS,
					result: result
				});
			}).catch(next);
		});
	}

	/**
	 * Function for add edit vaction request
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async addEditVacationRequest(req, res, next) {
		try {
			let isEditable = (req.params.id) ? true : false;
			let vacationRequestId = (req.params.id) ? req.params.id : new ObjectId();
			let authId = (req.session.user && req.session.user._id) ? req.session.user._id : "";

			if (isPost(req)) {
				/** Sanitize Data **/
				req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
				let fromDate = req.body.from_date ? req.body.from_date : "";
				let toDate = req.body.to_date ? req.body.to_date : "";

				const team_availabilities = this.db.collection(Tables.TEAM_AVAILABILITIES);
				
				try {
					// const asyncParallelResponse = await new Promise((resolve, reject) => {
					// 	asyncParallel({
					// 		vacation_details: (callback) => {
					// 			if (!isEditable) return callback(null, null);

					// 			/** Find vacation request details **/
					// 			team_availabilities.findOne({
					// 				_id: new ObjectId(vacationRequestId),
					// 				leave_type: Constants.ANNUAL_LEAVE
					// 			}, {projection: {_id: 1, leave_status: 1}}).then(findResult => {
					// 				callback(null, findResult);
					// 			}).catch(next);
					// 		},
					// 	}, (asyncParallelErr, asyncParallelResponse) => {
					// 		if (asyncParallelErr) reject(asyncParallelErr);
					// 		else resolve(asyncParallelResponse);
					// 	});
					// });

					// let vacationRequestDetails = asyncParallelResponse?.vacation_details || {};

					/** Send error response **/
					// if(isEditable && req.body.leave_type == Constants.ANNUAL_LEAVE && req.body.leave_status == Constants.REJECTED && vacationRequestDetails.leave_status == Constants.APPROVED){
					// 	return res.send({
					// 		status	: Constants.STATUS_ERROR,
					// 		message	: [{'param':'leave_status','msg':res.__("admin.leave_management.you_cannot_disapprove_approved_leave")}]
					// 	});
					// }

					/** Check leave date is unique **/
					let tempToDate 	 = newDate(toDate, Constants.DATABASE_DATE_FORMAT);
					let tempFromDate = newDate(fromDate, Constants.DATABASE_DATE_FORMAT);
					tempToDate 		 = newDate(newDate(tempToDate + " " + Constants.END_DATE_TIME_FORMAT));
					tempFromDate 	 = newDate(newDate(tempFromDate + " " + Constants.START_DATE_TIME_FORMAT));
					
					const totalRecords = await new Promise((resolve) => {
						team_availabilities.countDocuments({
							date: {$gte: tempFromDate, $lte: tempToDate},
							user_id: new ObjectId(req.body.team_member),
							leave_type: {$exists: true},
							_id: {$ne: new ObjectId(vacationRequestId)}
						}).then(count => {
							resolve(count);
						}).catch(next);
					});

					if (totalRecords > 0) {
						/** Send error for leave date **/
						return res.send({
							status: Constants.STATUS_ERROR,
							message: [{'param': 'leave_date', 'msg': res.__("admin.leave_management.entered_leave_date_already_exists")}]
						});
					}

					/**Update vacation request details **/
					await new Promise((resolve, reject) => {
						asyncParallel({
							update_details: (callback) => {
								if (!vacationRequestId) return callback(null, null);

								/** Update vacation request record **/
								team_availabilities.updateOne({
									_id: new ObjectId(vacationRequestId),
									parent_id: new ObjectId(authId),
									status: Constants.PENDING,
								},
								{$unset: {
									status: 1,
									leave_type: 1,
									rejection_reason: 1,
									leave_status: 1
								}}).then(updateResult => {
									callback(null, updateResult);
								}).catch(next);
							},
						}, (asyncErr, asyncResponse) => {
							if (asyncErr) reject(asyncErr);
							else resolve(asyncResponse);
						});
					});

					/** set data **/
					let updateData = [];
					let dates = getDateRange(new Date(fromDate), new Date(toDate));
					let date = "";
					dates.map(records => {
						date = newDate(records, Constants.DATABASE_DATE_FORMAT);
						let tempObj = {
							parent_id: new ObjectId(authId),
							user_id: new ObjectId(req.body.team_member),
							leave_type: parseInt(req.body.leave_type),
							status: Constants.PENDING,
							date: getUtcDate(date + " " + Constants.END_DATE_TIME_FORMAT),
							created: getUtcDate(),
							leave_status: parseInt(req.body.leave_status),
						};

						if (req.body.leave_status == Constants.REJECTED) tempObj.rejection_reason = req.body.rejection_reason;
						if (req.body.leave_status == Constants.REJECTED || req.body.leave_status == Constants.APPROVED) tempObj.action_taken_by = new ObjectId(authId);

						updateData.push(tempObj);
					});

					/** Save vacation request details **/
					await new Promise((resolve, reject) => {
						asyncEach(updateData, (records, callback) => {
							let setData = {
								status: Constants.PENDING,
								leave_type: records.leave_type,
								leave_status: records.leave_status
							};

							if (records.rejection_reason) setData.rejection_reason = records.rejection_reason;
							if (records.action_taken_by) setData.action_taken_by = records.action_taken_by;

							team_availabilities.updateOne({
								date: records.date,
								user_id: records.user_id,
								parent_id: records.parent_id
							},
							{
								$set: setData,
								$setOnInsert: {
									shift_id: "",
									created: getUtcDate(),
								}
							}, {upsert: true}).then(() => {
								/** save System logs */
								saveSystemLogs(req, res, {
									user_id: req.session.user._id,
									parent_id: vacationRequestId,
									activity_module: Constants.SYSTEM_LOG_MODULE_VACATION_REQUEST,
									activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
									additional_details: {
										date: records.date,
										user_id: records.user_id,
										parent_id: records.parent_id
									}
								}).then(() => {});

								callback(null);
							}).catch(next);
						}, (eachErr, eachResponse) => {
							if (eachErr) reject(eachErr);
							else resolve(eachResponse);
						});
					});

					/*************** Send notification  ***************/
					sendMailToUsers(req, res, {
						event_type: Constants.NOTIFICATION_VACATION_REQUEST,
						parent_table_id: req.body.team_member,
						user_id: req.body.team_member,
						tl_fullname: req.session.user.full_name,
					});
					/*************** Send notification  ***************/

					/** Send success response **/
					let message = isEditable ? res.__("admin.leave_management.vacation_request_has_been_updated_successfully") : res.__("admin.leave_management.vacation_request_has_been_added_successfully");
					req.flash(Constants.STATUS_SUCCESS, message);
					res.send({
						status: Constants.STATUS_SUCCESS,
						redirect_url: Constants.WEBSITE_ADMIN_URL + "leave_management/vacation_request",
						message: message
					});
				} catch (error) {
					next(error);
				}
			} else {
				let response = {};
				if (isEditable) {
					/** Get vacation request details **/
					response = await this.vacationRequestDetails(req, res, next);
					if (response.status != Constants.STATUS_SUCCESS) return res.status(400).send(response);
				}
				let teamMemeberId = response.result && response.result.user_id ? response.result.user_id : "";
				let leaveType = response.result && response.result.leave_type ? response.result.leave_type : "";

				/** Set options for get users list **/
				let conditions = clone(Constants.ADMIN_USER_COMMON_CONDITIONS);
				conditions.parent_id = new ObjectId(authId);
			
				const dropDownResponse = await getDropdownList(req, res, next, {
					collections: [{
						collection: Tables.USERS,
						columns: ["_id", "full_name"],
						conditions: conditions,
						selected: [teamMemeberId]
					},
					{
						collection: Tables.ATTRIBUTES,
						columns: ["attribute_id", "title"],
						conditions: {
							type: "vacation_leave_type",
							is_show: true,
						},
						selected: [leaveType],
						sort_conditions: {order: Constants.SORT_ASC}
					}]
				});
				if (dropDownResponse.status != Constants.STATUS_SUCCESS) return res.status(400).send(dropDownResponse);
				
				/** Render add edit page  **/
				res.render('add_edit', {
					layout: false,
					result: response?.result || {},
					is_editable: isEditable,
					users_list		: dropDownResponse?.final_html_data?.[0] || "",
					leave_type_list	: dropDownResponse?.final_html_data?.[1] || "",
				});
			}
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Function for delete vacation request
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async vacationRequestDelete(req, res, next) {
		let vacationRequestId = new ObjectId(req.params.id);
		let authId = req.session.user._id;

		try {
			/** Update vacation request record **/
			const team_availabilities = this.db.collection(Tables.TEAM_AVAILABILITIES);
			await new Promise((resolve, reject) => {
				team_availabilities.updateOne({
					_id: vacationRequestId,
					parent_id: new ObjectId(authId),
					status: Constants.PENDING,
				},
				{$unset: {
					status: 1,
					leave_type: 1,
				}}).then(() => {
					resolve();
				}).catch(next);
			});

			/** save System logs */
			saveSystemLogs(req, res, {
				user_id: req.session.user._id,
				parent_id: vacationRequestId,
				activity_module: Constants.SYSTEM_LOG_MODULE_VACATION_REQUEST,
				activity_type: Constants.ACTIVITY_TYPE_DELETE,
				additional_details: {}
			}).then(() => {
			});

			/** Send success response **/
			req.flash(Constants.STATUS_SUCCESS, res.__("admin.leave_management.vacation_request_has_been_deleted_successfully"));
			res.redirect(Constants.WEBSITE_ADMIN_URL + "leave_management/vacation_request");
		} catch (error) {
			next(error);
		}
	}

	/**
	* Function for export data
	*
	* @param req 	As Request Data
	* @param res 	As Response Data
	* @param next 	As Callback argument to the middleware function
	*
	* @return render/json
	*/
	async exportData(req, res, next) {
		let exportType = (req.params.export_type) ? req.params.export_type : "";
		let exportCount = (req.params.export_count) ? req.params.export_count : 0;
		let authId = (req.session.user && req.session.user._id) ? req.session.user._id : "";
		let authUserRoleId = (req.session.user && req.session.user.user_role_id) ? req.session.user.user_role_id : "";
		let parentId = (req.query.parent && authUserRoleId == Constants.CRAVEZ) ? req.query.parent : authId;
		let memberId = (req.query.member) ? req.query.member : "";

		let attributeOptions = {type: "vacation_leave_type"};
		if (exportType == "leave_balance") attributeOptions.is_show = true;

		try {
			/** Get leave type list **/
			const leaveTypeList = await getAttributes(req, res, next, attributeOptions);
			
			if (exportType == "leave_balance") {
				/** Get user leaves details **/
				let exportConditions = {parent_id: new ObjectId(parentId)};
				if (memberId) exportConditions.user_id = new ObjectId(memberId);

				const user_leaves = this.db.collection(Tables.USER_LEAVES);
				const userResult = await new Promise((resolve, reject) => {
					user_leaves.aggregate([
						{$match: exportConditions},
						{$lookup: {	/** Get users details **/
							"from": Tables.USERS,
							"localField": "user_id",
							"foreignField": "_id",
							"as": "users_details"
						}},
						{$project: {
							_id: 1, leaves: 1, total_leave: 1, team_member_name: {$arrayElemAt: ["$users_details.full_name", 0]}
						}}
					]).toArray().then(userResult => {
						resolve(userResult);
					}).catch(next);
				});

				let tempData = [];
				let commonColumns = [];

				/** Define excel heading label **/
				commonColumns = [
					res.__("admin.leave_management.team_member"),
					res.__("admin.leave_management.total_leave"),
				];

				/** Set leave types in excel heading label **/
				leaveTypeList.map(key => {
					commonColumns.push(key.title);
				});

				if (userResult && userResult.length > 0) {
					userResult.map(records => {
						let data = {};

						/** Insert leaves in a array according to the leave type **/
						records.leaves.map(leaveRecords => {
							let leaveType = leaveRecords.leave_type;
							if (!data[leaveType]) data[leaveType] = [];
							data[leaveType].push(leaveRecords.leaves);
						});

						let buffer = [
							(records.team_member_name),
							(records.total_leave),
						];
						/** Insert leaves in buffer **/
						leaveTypeList.map(key => {
							Object.keys(data).map(leaveType => {
								if (String(leaveType) == String(key.attribute_id)) {
									data[leaveType].map(leaveData => {
										buffer.push(leaveData);
									});
								}
							});
						});
						tempData.push(buffer);
					});
				}
				/**  Function to export data in excel format of leave balance **/
				exportToExcel(req, res, {
					file_prefix: "leaveBalanceReport",
					heading_columns: commonColumns,
					export_data: tempData
				});
			} else {
				/** conditions **/
				let filterCondition = (this.exportFilterConditions[exportCount]) ? this.exportFilterConditions[exportCount] :{};
				let sortConditions = (this.exportSortConditions[exportCount]) ? this.exportSortConditions[exportCount] :{_id: Constants.SORT_DESC};
				let conditions = (exportType == Constants.EXPORT_FILTERED) ? filterCondition : (this.exportCommonConditions || {});

				if(!Object.keys(conditions).length) {
					conditions = {parent_id: new ObjectId(authId), leave_type: {$exists: true}};
				}

				/** Get vacation request details **/
				const team_availabilities = this.db.collection(Tables.TEAM_AVAILABILITIES);
				const result = await new Promise((resolve, reject) => {
					team_availabilities.aggregate([
						{$match: conditions},
						{$sort: sortConditions},
						{$lookup: {	/** Get users details **/
							"from": Tables.USERS,
							"localField": "user_id",
							"foreignField": "_id",
							"as": "users_details"
						}},
						{$project: {
							_id: 1, date: 1, leave_type: 1, team_member_name: {$arrayElemAt: ["$users_details.full_name", 0]}
						}}
					]).toArray().then(result => {
						resolve(result);
					}).catch(next);
				});

				let temp = [];
				let commonColls = [];

				/** Define excel heading label **/
				commonColls = [
					res.__("admin.leave_management.team_member"),
					res.__("admin.leave_management.leave_date"),
					res.__("admin.leave_management.leave_type"),
				];

				if (result && result.length > 0) {
					result.map(records => {
						let leaveTypeTitle = "";
						leaveTypeList.map(typeRecords => {
							if (String(typeRecords.attribute_id) == String(records.leave_type)) leaveTypeTitle = typeRecords.title;
						});

						let buffer = [
							(records.team_member_name),
							newDate(records.date, Constants.DATE_FORMAT_EXPORT),
							leaveTypeTitle
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format of vacation request **/
				exportToExcel(req, res, {
					file_prefix: "vacationRequestReport",
					heading_columns: commonColls,
					export_data: temp
				});
			}
		} catch (error) {
			next(error);
		}
	}

	/**
	* Function for view leave balance
	*
	* @param req 	As 	Request Data
    * @param res 	As 	Response Data
    * @param next 	As 	Callback argument to the middleware function
	*
	* @return render
	*/
	async viewLeaveBalance(req, res, next) {
		let teamMemberId = (req.params.id) ? req.params.id : "";

		try {
			const asyncResponse = await new Promise((resolve, reject) => {
				asyncParallel({
					user_leave_list: (callback) => {
						/** Get user leaves details **/
						const user_leaves = this.db.collection(Tables.USER_LEAVES);
						user_leaves.findOne({user_id: new ObjectId(teamMemberId)}, {projection: {_id: 1, leaves: 1, total_leave: 1}}).then(leaveResult => {
							callback(null, leaveResult);
						}).catch(next);
					},
					leave_type_list: (callback) => {
						/** Get leave type list **/
						getAttributes(req, res, next, {type: "vacation_leave_type", is_show: true}).then(leaveTypeList => {
							let tempLeaveType = {};
							if (leaveTypeList.length > 0) {
								leaveTypeList.map(records => {
									tempLeaveType[String(records.attribute_id)] = records.title;
								});
							}
							callback(null, tempLeaveType);
						}).catch(next);
					},
				}, (asyncErr, asyncResponse) => {
					if (asyncErr) reject(asyncErr);
					else resolve(asyncResponse);
				});
			});

			/** Render view leave balance page  **/
			res.render('view_leave_balance', {
				layout: false,
				result: asyncResponse.user_leave_list,
				leave_type_list: asyncResponse.leave_type_list,
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Function for master leave
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async masterLeave(req, res, next) {
		let authId = (req.session.user && req.session.user._id) ? req.session.user._id : "";
		
		if (isPost(req)) {
			/** Sanitize Data **/
			req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
			let leaveData = (req.body.data) ? req.body.data : [];
			let errors = [];

			/**For check error */
			Object.keys(leaveData).map((leaveType) => {
				let leaveRecords = (leaveData[leaveType]) ? leaveData[leaveType] : "";
				if (leaveRecords) {
					let typeValue = leaveRecords.type;
					let frequency = leaveRecords.frequency;
					let leaves = leaveRecords.leaves;

					/**For check frequency */
					if (frequency == "") {
						errors.push({'param': 'frequency_' + typeValue, 'msg': res.__("admin.leave_management.please_select_frequency")});
					}

					/**For Check Leaves */
					if (leaves == "") {
						errors.push({'param': 'leaves_' + typeValue, 'msg': res.__("admin.leave_management.please_enter_leaves")});
					}
					if (leaves < 0 || isNaN(leaves)) {
						errors.push({'param': 'leaves_' + typeValue, 'msg': res.__("admin.leave_management.leaves_should_be_numeric_and_valid")});
					}
				}
			});

			/** Send error response **/
			if (errors.length > 0) return res.send({status: Constants.STATUS_ERROR, message: errors});

			try {
				/**For update leaves */
				const leave_types = this.db.collection(Tables.LEAVE_TYPES);
				await new Promise((resolve, reject) => {
					asyncEach(leaveData, (records, callback) => {
						leave_types.updateOne({
							type: parseInt(records.type),
							created_by: new ObjectId(authId)
						},
						{
							$set: {
								frequency: parseInt(records.frequency),
								leaves: parseFloat(records.leaves),
								user_id: 0,
								team_head: false,
								role_id: 0,
							},
							$setOnInsert: {
								created: getUtcDate(),
							}
						}, {upsert: true}).then(() => {
							callback(null);
						}).catch(next);
					}, (err) => {
						if (err) reject(err);
						else resolve();
					});
				});

				/* send success response */
				req.flash(Constants.STATUS_SUCCESS, res.__("admin.leave_management.vacation_balance_has_been_updated_successfully"));
				res.send({
					message: res.__("admin.leave_management.vacation_balance_has_been_updated_successfully"),
					redirect_url: Constants.WEBSITE_ADMIN_URL + "leave_management/leave_master/",
					status: Constants.STATUS_SUCCESS,
				});

				/** save System logs */
				saveSystemLogs(req, res, {
					user_id: authId,
					parent_id: "",
					activity_module: Constants.SYSTEM_LOG_MODULE_VACATION_BALANCE,
					activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
					additional_details: {}
				}).then(() => {
				});
			} catch (error) {
				next(error);
			}
		} else {
			try {
				const asyncResponse = await new Promise((resolve, reject) => {
					asyncParallel({
						leave_list: (callback) => {
							/**Get details for leaves  **/
							const leave_types = this.db.collection(Tables.LEAVE_TYPES);
							leave_types.find({}, {projection: {_id: 1, frequency: 1, type: 1, leaves: 1}}).toArray().then(leaveResult => {
								callback(null, leaveResult);
							}).catch(next);
						},
						leave_type_list: (callback) => {
							/** Get leave type list **/
							getAttributes(req, res, next, {type: "vacation_leave_type", is_show: true}).then(leaveType => {
								callback(null, leaveType);
							}).catch(next);
						}
					}, (asyncErr, asyncResponse) => {
						if (asyncErr) reject(asyncErr);
						else resolve(asyncResponse);
					});
				});

				/**For render add_edit page */
				req.breadcrumbs(BREADCRUMBS['admin/leave_management/leave_master']);
				res.render('leave_master', {
					leave_result: asyncResponse.leave_list,
					leave_type_list: asyncResponse.leave_type_list
				});
			} catch (error) {
				next(error);
			}
		}
	}

	/**
	 * Function to add/edit weekly off
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async addWeeklyOff(req, res, next) {
		try{
			let isEditable = (req.params.id) ? true : false;
			let weeklyRequestId = (req.params.id) ? req.params.id : "";
			let authId = (req.session.user && req.session.user._id) ? req.session.user._id : "";
			
			if (isPost(req, res,next)) {
				/** Sanitize Data **/
				req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
	
				let dates = (req.body.dates) ? req.body.dates.split(",") : [];
				if (dates.constructor !== Array) dates = [dates];
				let dateArray = [];
				dates.map(records => {
					let date = newDate(records, Constants.DATABASE_DATE_FORMAT);
					dateArray.push(getUtcDate(date + " " + Constants.END_DATE_TIME_FORMAT));
				});
	
				/** Set conditions **/
				let teamAvailabilitiesConditions = {
					date: {$in: dateArray},
					user_id: new ObjectId(req.body.team_member),
					leave_type: {$exists: true},
				};
	
				if (weeklyRequestId) teamAvailabilitiesConditions._id = {$ne: new ObjectId(weeklyRequestId)};
	
				/** Check leave date is unique **/
				const team_availabilities = this.db.collection(Tables.TEAM_AVAILABILITIES);
				const totalRecords = await team_availabilities.countDocuments(teamAvailabilitiesConditions);

				if (totalRecords > 0) {
					/** Send error for leave date **/
					return res.send({
						status: Constants.STATUS_ERROR,
						message: [{'param': 'dates', 'msg': res.__("admin.leave_management.entered_leave_date_already_exists")}]
					});
				}

				/** Update vacation request record **/
				if(weeklyRequestId){
					await team_availabilities.updateOne({
						_id: new ObjectId(weeklyRequestId),
						parent_id: new ObjectId(authId),
					},
					{$unset: {
						status: 1,
						leave_type: 1,
					}});
				}

				/** set data **/
				let updateData = [];
				dates.map(records => {
					let date = newDate(records, Constants.DATABASE_DATE_FORMAT);
					updateData.push({
						parent_id: new ObjectId(authId),
						user_id: new ObjectId(req.body.team_member),
						leave_type: Constants.WEEKLY_OFF,
						date: getUtcDate(date + " " + Constants.END_DATE_TIME_FORMAT),
						created: getUtcDate()
					});
				});

				/** Save vacation request details **/
				await new Promise((resolve, reject) => {
					asyncEach(updateData, (records, callback) => {
						team_availabilities.updateOne({
							date: records.date,
							user_id: records.user_id,
							parent_id: records.parent_id
						},
						{
							$set: {
								//status		:	(teamHead) ? APPROVED : PENDING,
								leave_status: Constants.APPROVED,
								leave_type: records.leave_type,
							},
							$setOnInsert: {
								shift_id: "",
								created: getUtcDate(),
							}
						}, {upsert: true}).then(() => {
							/** save System logs */
							saveSystemLogs(req, res, {
								user_id: req.session.user._id,
								parent_id: weeklyRequestId,
								activity_module: Constants.SYSTEM_LOG_MODULE_WEEKLY_OFF,
								activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
								additional_details: {
									date: records.date,
									user_id: records.user_id,
									parent_id: records.parent_id
								}
							}).then(() => {});

							callback(null);
						}).catch(next);
					}, (eachErr) => {
						if (eachErr) reject(eachErr);
						else resolve();
					});
				});

				/*************** Send notification  ***************/
				sendMailToUsers(req, res, {
					event_type: Constants.NOTIFICATION_WEEKLY_REQUEST,
					parent_table_id: new ObjectId(req.body.team_member),
					user_id: new ObjectId(req.body.team_member),
					tl_fullname: req.session.user.full_name,
				});
				/*************** Send notification  ***************/

				/** Send success response **/
				let message = (isEditable) ? res.__("admin.leave_management.weekly_off_has_been_updated_successfully") : res.__("admin.leave_management.weekly_off_has_been_added_successfully");
				req.flash(Constants.STATUS_SUCCESS, message);
				res.send({
					status: Constants.STATUS_SUCCESS,
					redirect_url: Constants.WEBSITE_ADMIN_URL + "leave_management/vacation_request",
					message: message
				});				
			} else {
				let response = {};
				if (isEditable) {
					/** Get vacation request details **/
					response = await this.vacationRequestDetails(req, res, next);
	
					if (response.status != Constants.STATUS_SUCCESS) return res.status(400).send(response);				
				}

				let teamMemeberId = response?.result?.user_id || "";
	
				/** Set options for get users list **/
				let conditions = clone(Constants.ADMIN_USER_COMMON_CONDITIONS);
				conditions.parent_id = new ObjectId(authId);	
				
				const dropDownResponse = await getDropdownList(req, res, next, {
					collections: [{
						collection: Tables.USERS,
						columns: ["_id", "full_name"],
						conditions: conditions,
						selected: [teamMemeberId]
					}]
				});

				if (dropDownResponse.status != Constants.STATUS_SUCCESS) return res.status(400).send(dropDownResponse);				

				/** Render add edit page  **/
				res.render('weekly_off', {
					layout: false,
					users_list: dropDownResponse?.final_html_data?.["0"] || "",
					result: response?.result || {},
					is_editable: isEditable
				});				
			}
		}catch(error){
			next(error);
		}
	}

	/**
	 * Function to update vacation request status
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return response
	 */
	async updateRequestStatus(req, res, next) {
		let status = (req.body.status) ? req.body.status : "";
		let requestIds = (req.body.request_ids) ? req.body.request_ids.split(",") : [];

		/** Send error response */
		if (!status || requestIds.length == 0) return res.send({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

		/** Send error response if rejection_reason is empty */
		if (status == Constants.REJECTED && !req.body.rejection_reason) return res.send({
			status: Constants.STATUS_ERROR, 
			message: [{'param': 'rejection_reason', 'msg': res.__("admin.leave_management.please_enter_rejection_reason")}]
		});

		try {
			const team_availabilities = this.db.collection(Tables.TEAM_AVAILABILITIES);
			await new Promise((resolve, reject) => {
				asyncEach(requestIds, (requestId, callback) => {
					/** Set updatable data **/
					let updateData = {
						$set: {
							leave_status: parseInt(status),
							modified: getUtcDate()
						}
					};
					if (status == Constants.REJECTED) {
						updateData["$set"].rejection_reason = req.body.rejection_reason;
					} else {
						updateData["$unset"] = {rejection_reason: 1};
					}

					/** Update vacation request status **/
					team_availabilities.updateOne({
						_id: new ObjectId(requestId),
						status: Constants.PENDING,
					}, updateData).then(() => {
						callback(null);

						/** Save system logs */
						saveSystemLogs(req, res, {
							user_id: req.session.user._id,
							parent_id: new ObjectId(requestId),
							activity_module: Constants.SYSTEM_LOG_MODULE_VACATION_REQUEST,
							activity_type: Constants.ACTIVITY_TYPE_STATUS_UPDATE,
							additional_details: {status: status}
						}).then(() => {
						});
					});
				}, (eachErr) => {
					if (eachErr) reject(eachErr);
					else resolve();
				});
			});

			/** Send success response **/
			let message = (status == Constants.IN_REVIEW) ? res.__("admin.leave_management.request_marked_as_inreview_successfully") : ((status == Constants.APPROVED) ? res.__("admin.leave_management.request_marked_as_approved_successfully") : res.__("admin.leave_management.request_marked_as_rejected_successfully"));	
			res.send({
				status: Constants.STATUS_SUCCESS,
				message: message
			});
		} catch (error) {
			next(error);
		}
	}
}

export default Leaves; 