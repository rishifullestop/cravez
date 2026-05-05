import { ObjectId } from 'mongodb';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, getDropdownList, newDate, arrayToObject, set24HourFormat, exportToExcel, getDateRange, getAttributes, getCityList, getAreaList, addDate } from '../../../../utils/index.mjs';
import { saveSystemLogs, sendMail } from '../../../../services/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import {parallel as asyncParallel, each as asyncEach} from "async";

class DriverShifts {
	constructor(db) {
		this.db = db;
		this.DriverShifts = this;
	}

	/**
	 * Function to get shift list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	*/
	async getShiftList(req, res, next) {
		let authUserRoleId = req.session.user.user_role_id;
		try {
            if (isPost(req)) {
                let fromDate = req?.body?.from_date || "";
                let toDate   = req?.body?.to_date   || "";
                let userId   = req?.body?.user_id   || "";

                /**call function for get shifts details */               
                const response = await this.teamAvailabilitiesDetails(req, res, next, {
                    from_date: fromDate,
                    to_date: toDate, 
                    user_id: userId
                });
                
                if (response.status != Constants.STATUS_SUCCESS) {
                    /** send error response */
                    req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
                    return res.redirect(Constants.WEBSITE_ADMIN_URL+"dashboard");
                }

                /**For render schedule page */
                res.render('schedule', {
                    layout: response.layout,
                    user_data: response.user_data,
                    shift_availablity: response.shift_availablity,
                    leave_type_list: response.leave_type_list,
                    choose_date: response.choose_date,
                    from_date: fromDate,
                    to_date: toDate,
                    parent_id: userId
                });               
            } else {
                let userList = "";
                if(authUserRoleId == Constants.CRAVEZ){
                    let userConditions = {...{user_role_id: Constants.FLEET, team_head: true }, ...Constants.ADMIN_USER_COMMON_CONDITIONS};
                    let dropRes = await getDropdownList(req, res, next, {
                        collections: [{
                            collection: Tables.USERS,
                            columns: ["_id", "full_name"],
                            conditions: userConditions
                        }]
                    });

                    userList = dropRes?.final_html_data?.[0] || "";

                    if(dropRes.status != Constants.STATUS_SUCCESS){
                        req.flash(Constants.STATUS_ERROR, dropRes.message);
                        return res.redirect(Constants.WEBSITE_ADMIN_URL + "dashboard");
                    }
                }   

                /** render shifts listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/driver_shifts/list']);
                res.render('list', {
                    user_list: userList
                });               
            }
        } catch (error) {
            console.log("Error at driver shifts getShiftList ",error);

            req.flash(Constants.STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
            return res.redirect(Constants.WEBSITE_ADMIN_URL + "dashboard");
        }
	}

	/**
	 * Function to get shifts detail
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return json
	*/
	async teamAvailabilitiesDetails(req, res, next, options) {
        try{
            let authUserRoleId = req.session.user.user_role_id;
            let isTeamHead  =   (req.session.user.team_head) ? req.session.user.team_head : false;
            let authId      =   (isTeamHead) ? req.session.user._id : req.session.user.parent_id;
            let fromDate    =   newDate(newDate(options.from_date,Constants.CURRENTDATE_START_DATE_FORMAT));
            let toDate      =   newDate(newDate(options.to_date,Constants.CURRENTDATE_END_DATE_FORMAT));
            let userId      =   options?.user_id || '';
    
            let commonConditions = {
                date: { $gte: fromDate, $lte: toDate },
                $or: [
                    { shift_id: { $ne: "" } },
                    { leave_type: {$exists: true}, leave_status: Constants.APPROVED }
                ]
            };
    
            if (authUserRoleId != Constants.CRAVEZ) commonConditions.parent_id = new ObjectId(authId);
            if (userId) commonConditions.parent_id = new ObjectId(userId);
    
           
            const response = await new Promise((resolve, reject) => {
                asyncParallel({
                    team_available: (teamCallback) => {
                        if (!userId && authUserRoleId == Constants.CRAVEZ) return teamCallback(null, []);

                        /**Get details from driver_shifts */
                        const driver_availabilities = this.db.collection(Tables.DRIVER_AVAILABILITIES);
                        driver_availabilities.aggregate([
                            { $match: commonConditions },
                            {
                                $lookup: {
                                    'from': Tables.USERS,
                                    'localField': "user_id",
                                    'foreignField': "_id",
                                    'as': "user_detail",
                                }
                            },
                            {
                                $lookup: {
                                    'from': Tables.SHIFTS,
                                    'localField': "shift_id",
                                    'foreignField': "_id",
                                    'as': "shift_detail",
                                }
                            },
                            {
                                $project: {
                                    _id: 1, date: 1, status: 1, shift_id: 1, user_id: 1, city_id: 1, area_id: 1, leave_type: 1, leave_status: 1,
                                    user_name: { $arrayElemAt: ["$user_detail.full_name", 0] }, 
                                    user_email: { $arrayElemAt: ["$user_detail.email", 0] },
                                    shift: {
                                        shift_name: { $arrayElemAt: ["$shift_detail.shift_name", 0] },
                                        start_time: { $arrayElemAt: ["$shift_detail.start_time", 0] },
                                        end_time: { $arrayElemAt: ["$shift_detail.end_time", 0] },
                                    }
                                }
                            },
                            { $sort: { "shift.start_time": Constants.SORT_ASC, "shift.end_time": Constants.SORT_ASC } },
                        ]).toArray().then(teamResult => {
                            if (!teamResult?.length) return teamCallback(null, []);

                            /** Push city id, area id and shift id in array */
                            let cityIds = [];
                            let areaIds = [];
                            teamResult.map(record => {
                                if (record.city_id) cityIds.push(record.city_id);
                                if (record.area_id) areaIds.push(record.area_id);
                            });

                            asyncParallel({
                                city_details: (callback) => {
                                    if (cityIds.length == 0) return callback(null, {});

                                    /** Get city names */
                                    const cities = this.db.collection(Tables.CITIES);
                                    cities.find({ _id: { $in: arrayToObject(cityIds) } }, {projection: {_id: 1, name: 1 } }).toArray().then(cityResult => {

                                        let cityList = {};
                                        if(cityResult.length) cityResult.map(city => {
                                            cityList[city._id] = city?.name?.[Constants.DEFAULT_LANGUAGE_CODE] || "";
                                        });
                                        callback(null, cityList);
                                    }).catch(next);
                                },
                                area_details: (callback) => {
                                    if (areaIds.length == 0) return callback(null, {});

                                    /** Get area names */
                                    const areas = this.db.collection(Tables.AREAS);
                                    areas.find({ _id: { $in: arrayToObject(areaIds) } }, { projection: { _id: 1, name: 1 } }).toArray().then(areaResult => {
                                        
                                        let areaList = {};
                                        if(areaResult.length) areaResult.map(area => {
                                            areaList[area._id] = area?.name?.[Constants.DEFAULT_LANGUAGE_CODE] || "";
                                        });
                                        callback(null, areaList);
                                    }).catch(next);
                                },
                            }, (asyncErr, asyncRes) => {
                                if (asyncErr) return teamCallback(asyncErr);

                                teamResult.map(record => {
                                    record.area_name = asyncRes?.area_details?.[record.area_id] || "";
                                    record.city_name = asyncRes?.city_details?.[record.city_id] || "";
                                });

                                teamCallback(null, teamResult);
                            });
                        });
                    },
                    leave_type_list: (callback) => {
                        /** Get leave type list **/
                        getAttributes(req, res, next, { type: "vacation_leave_type" }).then(leaveTypeList => {

                            let tempLeaveType = {};
                            if (leaveTypeList.length > 0) {
                                leaveTypeList.map(records => {
                                    tempLeaveType[String(records.attribute_id)] = records.title;
                                });
                            }
                            callback(null, tempLeaveType);
                        }).catch(next);
                    },
                }, (err, response) => {
                    if (err) return reject(err);
                    resolve(response);
                });
            });

            let shiftData = response.team_available;
            let userShifts = [];

            /** Call function for get date range */
            let dates = getDateRange(new Date(fromDate), new Date(toDate));
            let chooseDate = [];

            dates.map((shiftDate) => {
                let date = newDate(shiftDate, Constants.DATABASE_DATE_FORMAT);
                chooseDate.push(date);
                shiftData.map((shiftTime) => {
                    let dbDate = newDate(shiftTime.date, Constants.DATABASE_DATE_FORMAT);
                    let driverDataId = (shiftTime._id) ? shiftTime._id : "";
                    let shiftId = (shiftTime.shift_id) ? shiftTime.shift_id : "";
                    let userId = (shiftTime.user_id) ? String(shiftTime.user_id) : "";
                    let leaveStatus = (shiftTime.leave_status) ? shiftTime.leave_status : "";

                    if (date == dbDate) {
                        if (!userShifts[userId]) userShifts[userId] = {};
                        if (userShifts[userId]) {
                            userShifts[userId].name = shiftTime.user_name;
                            userShifts[userId].user_email = shiftTime.user_email;
                        }

                        if (userShifts[userId]) {
                            if (!userShifts[userId][dbDate]) userShifts[userId][dbDate] = [];
                            userShifts[userId][dbDate].push({
                                city: shiftTime.city_name,
                                date: shiftTime.date,
                                area: shiftTime.area_name,
                                shift: shiftTime.shift,
                                leave_type: (shiftTime.leave_type && leaveStatus == Constants.APPROVED) ? shiftTime.leave_type : "",
                                status: shiftTime.status,
                                shift_id: shiftId,
                                id: driverDataId
                            });
                        }
                    }
                });
            });

            /** For render schedule page **/
            return {
                layout: false,
                shift_availablity: userShifts,
                choose_date: chooseDate,
                leave_type_list: response.leave_type_list,
                status: Constants.STATUS_SUCCESS,
            };
        }catch (error) {
            console.log("Error at driver shifts teamAvailabilitiesDetails ",error);            
            return {status: Constants.STATUS_ERROR};
        }
	}

	/**
	 * Function for add and edit shift
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	*/
	async assignShift(req, res, next) {        
        try {
            let editable    = req?.params?.id || false;
            let assignId    = req?.params?.id && new ObjectId(req.params.id) || new ObjectId();
            let isTeamHead  = (req.session.user.team_head) ? req.session.user.team_head : false;
            let authUserRoleId = req.session.user.user_role_id;
            let authId = (isTeamHead || authUserRoleId == Constants.CRAVEZ) ? req.session.user._id : req.session.user.parent_id;
            let addedBy = (req.session.user && req.session.user._id) ? req.session.user._id : "";

            if (isPost(req)) {
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let fromDate        =   req?.body?.from_date  || "";
                let toDate          =   req?.body?.to_date    || "";
                let shiftUser       =   req?.body?.user_name  || [];
                let shiftDataIds    =   req?.body?.shift_name || [];
                let cityId          =   req.body.city_id && new ObjectId(req.body.city_id) || "";
                let areaId          =   req.body.area_id && new ObjectId(req.body.area_id) || "";
                let shiftArray      =   [];

                /** To convert in array **/
                if (shiftUser.constructor != Array) shiftUser = [shiftUser];
                if (shiftDataIds.constructor != Array) shiftDataIds = [shiftDataIds];             

                const driver_availabilities = this.db.collection(Tables.DRIVER_AVAILABILITIES);   

                let allRequestedIds;
                let availabilityDetails;
                if(editable){
                    /** Get driver availabilities details */
                    availabilityDetails = await driver_availabilities.findOne({ _id: assignId }, { projection: { status: 1, leave_type: 1, rejection_reason: 1, leave_status: 1, date: 1, user_id: 1 } });

                    /** Send error response */
                    if(!availabilityDetails) return res.send({ status: Constants.STATUS_ERROR, message: res.__("admin.system.something_going_wrong_please_try_again") });

                    let tmpStartDate =  newDate(newDate(availabilityDetails.date, Constants.CURRENTDATE_START_DATE_FORMAT));
                    let tmpEndDate   =  newDate(newDate(availabilityDetails.date, Constants.CURRENTDATE_END_DATE_FORMAT));

                    /** Get request ids */
                    allRequestedIds = await driver_availabilities.distinct("_id", { user_id: availabilityDetails.user_id, date: {$gte: tmpStartDate, $lte: tmpEndDate } });
                }                

                /** Call function for get date range **/
                let dates = getDateRange(new Date(fromDate), new Date(toDate));
                dates.map((shiftDate) => {
                    let chooseDate = newDate(shiftDate, Constants.CURRENTDATE_END_DATE_FORMAT);
                    shiftUser.map((shiftUserId) => {
                        shiftDataIds.map(shiftId => {
                            shiftArray.push({
                                shift_id    :   new ObjectId(shiftId),
                                user_id     :   new ObjectId(shiftUserId),
                                parent_id   :   new ObjectId(authId),
                                added_by    :   new ObjectId(addedBy),
                                city_id     :   cityId,
                                area_id     :   areaId,
                                date        :   getUtcDate(chooseDate),
                                created     :   getUtcDate()
                            });
                        });
                    });
                });

                asyncEach(shiftArray, (records, eachCallback)=> {
                    
                    /** delete old assign shifts */
                    driver_availabilities.deleteMany({
                        date 	  : records.date,
                        user_id  : records.user_id,
                    }).then(()=>{
                        
                        /** Set update data */
                        let updatedData ={
                            $set : {
                                city_id    	: records.city_id,
                                area_id    	: records.area_id,
                                parent_id  	: records.parent_id,
                            },
                            $setOnInsert: {
                                added_by  : records.added_by,
                                created   : getUtcDate()
                            }
                        };

                        /** Set conditions */
                        let cuConditions = {
                            date 	  : records.date,
                            user_id   : records.user_id,
                            shift_id  : records.shift_id,
                        };

                        if(availabilityDetails?._id){
                            if(availabilityDetails?.leave_type){
                                updatedData["$set"].status 				= 	availabilityDetails.status;
                                updatedData["$set"].leave_type 		 	=	availabilityDetails.leave_type;
                                updatedData["$set"].leave_status 	 	=	availabilityDetails.leave_status;
                                updatedData["$set"].rejection_reason	=	availabilityDetails.rejection_reason;
                            }

                            if(allRequestedIds?.length) cuConditions._id = {$nin: allRequestedIds};
                        }

                        /** Save driver shift details */
                        driver_availabilities.updateOne(cuConditions,updatedData,{upsert: true}).then(() => {
                            eachCallback(null);
                        }).catch(next);
                    }).catch(next);
                },async (err)=> {
                    if(err) return next(err);

                    /** Delete driver availabilities details */
                    if(allRequestedIds?.length){
                        await driver_availabilities.deleteMany({_id: {$in: allRequestedIds}}); 
                    }

                    /** Send success response **/
                    let message = (editable) ? res.__("admin.driver_shifts.shift_has_been_updated_successfully") : res.__("admin.driver_shifts.shift_has_been_assigned_successfully");
                    res.send({
                        status: Constants.STATUS_SUCCESS,
                        redirect_url: Constants.WEBSITE_ADMIN_URL + "driver_shifts",
                        message: message,
                    });

                    /** save System logs */
                    saveSystemLogs(req, res, {
                        user_id: authId,
                        parent_id: assignId,
                        activity_module: Constants.SYSTEM_LOG_MODULE_DRIVER_SHIFT_SETUP,
                        activity_type: Constants.ACTIVITY_TYPE_ASSIGN,
                        additional_details: {}
                    }).then(() => { }); 
                });                               
            } else {
                let shiftDetails = {};
                if (editable) {
                    /** Get shift details **/
                    let shiftResponse = await this.getShiftDetails(req, res, next);

                    /** Send error response **/
                    if (shiftResponse.status != Constants.STATUS_SUCCESS) return res.status(400).send(shiftResponse);
                    
                    shiftDetails = shiftResponse.result;
                }
                
                asyncParallel({
                    shifts: (callback) => {
                        const shifts = this.db.collection(Tables.SHIFTS);
                        shifts.find({ parent_id: new ObjectId(authId), is_deleted: { $ne: Constants.DELETED } }, { _id: 1, shift_name: 1, start_time: 1, end_time: 1, is_deleted: 1 }).toArray().then(result => {
                            callback(null, result);
                        }).catch(next);
                    },
                    cities: (callback) => {
                        /** Get city dropdown list **/
                        getCityList(req, res, next, {city_id: shiftDetails?.city_id || ''}).then(response => {
                            callback(null, response);
                        }).catch(next);
                    },
                    user_list: (callback) => {
                        /** Get users dropdown list **/
                        let selectedUser = (shiftDetails.user_id) ? shiftDetails.user_id : '';

                        /** Set driver conditions */
                        let drConditions = { ...Constants.DRIVER_COMMON_CONDITIONS };
                        if (editable) drConditions = { ...{ _id: selectedUser }, ...drConditions };

                        getDropdownList(req, res, next, {
                            collections: [{
                                collection: Tables.USERS,
                                columns: ["_id", "full_name"],
                                selected: [selectedUser],
                                conditions: drConditions,
                                append_to_value: true,
                                sub_title_field: "driver_id",
                            }]
                        }).then(response => {
                            callback(null, response?.final_html_data?.[0] || "");
                        }).catch(next);
                    },
                }, (_, asyncRes) => {

                    /** Render add_edit page  **/
                    res.render('add_edit', {
                        layout      : false,
                        result      : shiftDetails,
                        is_editable : editable,
                        shift_list  : asyncRes?.shifts || [],
                        users_list  : asyncRes?.user_list || "",
                        cities      : asyncRes?.cities || ''
                    });
                });           
            }
        } catch (error) {
            return next(error);
        }
	}

	/**
	 * Function for get area list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async areaList(req, res, next) {
		let cityId = req.body.city_id;
		let areaId = req.body.area_id;

		/** Send error response */
		if (!cityId) return res.send({ status: Constants.STATUS_ERROR, message: res.__("admin.system.something_going_wrong_please_try_again") });

		/** Get area dropdown list **/
		try {
			const response = await getAreaList(req, res, next, {city_id: cityId, area_id: areaId });
			
            res.send({ status: Constants.STATUS_SUCCESS, area_list: response});
		} catch (error) {
			return next(error);
		}
	}

	/**
	 * Function to get shift detail
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return json
	*/
	async getShiftDetails(req, res, next) {
		try {
            let isTeamHead = (req.session.user.team_head) ? req.session.user.team_head : false;
            let authUserRoleId = req.session.user.user_role_id;
            let authId  = (isTeamHead || authUserRoleId == Constants.CRAVEZ) ? req.session.user._id : req.session.user.parent_id;
            let shiftId = (req.params.id) ? req.params.id : "";

            /** Get shift details **/
            const driver_availabilities = this.db.collection(Tables.DRIVER_AVAILABILITIES);
            let shiftResult = await driver_availabilities.findOne({
                _id: new ObjectId(shiftId),
                parent_id: new ObjectId(authId)
            });

            /** Send error response */
			if (!shiftResult) return { status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") };
            
			/** Get other shift details of current date */
			let tmpStartDate = newDate(newDate(shiftResult.date, Constants.CURRENTDATE_START_DATE_FORMAT));
			let tmpEndDate   = newDate(newDate(shiftResult.date, Constants.CURRENTDATE_END_DATE_FORMAT));

            let shiftList = await driver_availabilities.find({
                user_id: shiftResult.user_id, 
                date: { $gte: tmpStartDate, $lte: tmpEndDate } 
            }).toArray();

            shiftResult.all_shift_ids = [shiftResult.shift_id];
			if(shiftList?.length) shiftList.map(records => {
				shiftResult.all_shift_ids.push(records.shift_id);
			});

			/** Send success response **/
			return { status: Constants.STATUS_SUCCESS, result: shiftResult };			
		} catch (error) {
			return next(error);
		}
	}

	/**
	 * Function to export schedule list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	*/
	async scheduleExport(req, res, next) {
		let fromDate    = (req.params.from_date)    ? req.params.from_date : "";
		let toDate      = (req.params.to_date)    ? req.params.to_date : "";
		let parentId    = (req.params.parent_id ) ? req.params.parent_id : "";

		try {
			const asyncResponse = await new Promise((resolve, reject) => {
				asyncParallel({
					availabilities_details: (callback) => {
						/**call function for get shifts details */
						this.teamAvailabilitiesDetails(req, res, next, { from_date: fromDate, to_date: toDate, user_id: parentId }).then((response) => {
							if (response.status != Constants.STATUS_SUCCESS) return callback(response);
							callback(null, response);
						}).catch(next);
					},
					team_details: (callback) => {
						/** Get roles name  **/
						const admin_roles = this.db.collection(Tables.ADMIN_ROLES);
						admin_roles.findOne({
							_id: new ObjectId(req.session.user.user_role_id),
							$and: [
								{ _id: { $ne: new ObjectId(Constants.CRAVEZ) } }
							],
						}, { projection: { role_name: 1 } }).then(roleResult=> {
							callback(null, roleResult);
						}).catch(next);
					},
				}, (asyncErr, asyncResponse) => {
					if (asyncErr) return reject(asyncErr);
					resolve(asyncResponse);
				});
			});

			let shiftAvailablity=  asyncResponse.availabilities_details.shift_availablity;
			let chooseDate      =   asyncResponse.availabilities_details.choose_date;
			let leaveTypeList   =   asyncResponse.availabilities_details.leave_type_list;
			let teamDetails     =   asyncResponse.team_details;
			let teamName        =   (teamDetails && teamDetails.role_name) ? teamDetails.role_name.replace(RegExp(" ", "g"), "") + "-" : "";

			let temp = [];
			let commonColls = [res.__("admin.driver_shifts.user_name")];

			/**For get date range */
			chooseDate.map((dates) => {
				commonColls.push(dates)
			});

			Object.keys(shiftAvailablity).map(userId => {
				let buffer = [
					shiftAvailablity?.[userId]?.name || ""
				];
				let bufferAreas = [""];
				let bufferShifts = [""];
				let leaveStatus = {};
				let shiftFound = false;
				let maxListRow = 1;

				chooseDate.map(dateRecords => {
					let shiftData = (shiftAvailablity[userId][dateRecords]) ? shiftAvailablity[userId][dateRecords] : [];
					let leaveType = (shiftData[0] && shiftData[0].leave_type) ? shiftData[0].leave_type : "";
					if (leaveType) {
						if (!leaveStatus[userId]) leaveStatus[userId] = {};
						leaveStatus[userId][dateRecords] = leaveTypeList[String(leaveType)];
					} else {
						maxListRow = (maxListRow < shiftData.length) ? shiftData.length : maxListRow;
					}
				});

				let tmpArray = [];
				for (let i = 0; i <= maxListRow - 1; i++) {
					tmpArray.push(i);
				}

				tmpArray.map(i => {
					if (i > 0) {
						buffer = [""];
						bufferAreas = [""];
						bufferShifts = [""];
					}

					chooseDate.map(dbDate => {
						if (!leaveStatus[userId] || !leaveStatus[userId][dbDate]) {
							let shiftData = (shiftAvailablity[userId][dbDate] && shiftAvailablity[userId][dbDate][i]) ? shiftAvailablity[userId][dbDate][i] : {};

							let cityName = (shiftData.city) ? shiftData.city : "";
							let areaName = (shiftData.area) ? shiftData.area : "";
							let shiftDetails = (shiftData.shift) ? shiftData.shift : {};
							let startTime = (shiftDetails.start_time) ? set24HourFormat(shiftDetails.start_time) : "";
							let endTime = (shiftDetails.end_time) ? set24HourFormat(shiftDetails.end_time) : "";
							let time = (startTime && endTime) ? "(" + startTime + " - " + endTime + ")" : "";
							let shiftName = (shiftDetails.shift_name) ? shiftDetails.shift_name : "";
							shiftFound = true;

							if (cityName) {
								buffer.push(res.__('admin.driver_shifts.city') + ": " + cityName);
							}
							else buffer.push("-");

							if (areaName) {
								bufferAreas.push(res.__('admin.driver_shifts.areas') + ": " + areaName);
							}
							else bufferAreas.push("-");

							if (shiftName) {
								bufferShifts.push(res.__('admin.driver_shifts.shift_name') + ": " + shiftName + " " + time);
							}
							else bufferShifts.push("-");

						} else {
							if (i == 0) buffer.push(leaveStatus[userId][dbDate]);
							else buffer.push("");

							bufferShifts.push("");
							bufferAreas.push("");
						}
					});

					temp.push(buffer);
					if (shiftFound) {
						temp.push(bufferAreas);
						temp.push(bufferShifts);
					}
					temp.push([""]);
				});
				temp.push([""]);
			});

			/**  Function to export data in excel format **/
			exportToExcel(req, res, {
				file_prefix: teamName + "DriverScheduleReport",
				heading_columns: commonColls,
				export_data: temp
			});
		} catch (error) {
			/** Send error response **/
			req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(Constants.WEBSITE_ADMIN_URL + "driver_shifts");
		}
	}

	/**
	 * Function to mail team schedule list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	*/
	async scheduleMail(req, res, next) {
        try {
            let fromDate    =   newDate();
            let toDate      =   addDate(Constants.HOURS_IN_A_DAY * Constants.DAYS_IN_A_WEEK - 1);
            let parentId    =   (req.params.parent_id) ? req.params.parent_id : "";

			const asyncResponse = await new Promise((resolve, reject) => {
				asyncParallel({
					availabilities_details: (callback) => {
						/**call function for get shifts details */
						this.teamAvailabilitiesDetails(req, res, next, { from_date: fromDate, to_date: toDate, user_id: parentId }).then(response => {
							if (response.status != Constants.STATUS_SUCCESS) return callback(response);

							callback(null, response);
						}).catch(next);
					},
				}, (asyncErr, asyncResponse) => {
					if (asyncErr) return reject(asyncErr);
					resolve(asyncResponse);
				});
			});

			let shiftAvailablity= asyncResponse.availabilities_details.shift_availablity;
			let chooseDate      = asyncResponse.availabilities_details.choose_date;
			let leaveTypeList   = asyncResponse.availabilities_details.leave_type_list;
			
			Object.keys(shiftAvailablity).map(userId => {
				let scheduleHtml =
					"<table border='1' cellspacing='0' width=90%>" +
					"<thead>" +
					"<tr>" +
					"<th align='left'>&nbsp; " + res.__('admin.driver_shifts.date') + "</th>" +
					"<th align='left'>&nbsp; " + res.__('admin.driver_shifts.shift') + "</th>" +
					"</tr>" +
					"</thead>" +
					"<tbody>";

				chooseDate.map(dateRecords => {
					scheduleHtml += "<tr> <td>" + dateRecords + "</td>";
					var shiftData = (shiftAvailablity[userId][dateRecords]) ? shiftAvailablity[userId][dateRecords] : [];
					var leaveType = (shiftData[0] && shiftData[0].leave_type) ? shiftData[0].leave_type : "";

					if (shiftData.length > 0 && !leaveType) {
						scheduleHtml += "<td> <table border='0' cellspacing='0' width=100%>";

						shiftData.map(tmpData => {
							var tmpShift = (tmpData.shift) ? tmpData.shift : {};
							var cityName = (tmpData.city) ? tmpData.city : "";
							var areaName = (tmpData.area) ? tmpData.area : "";
							var shiftName = (tmpShift.shift_name) ? tmpShift.shift_name : "";
							var startTime = (tmpShift.start_time) ? set24HourFormat(tmpShift.start_time) : "";
							var endTime = (tmpShift.end_time) ? set24HourFormat(tmpShift.end_time) : "";
							var time = (startTime && endTime) ? "(" + startTime + " - " + endTime + ")" : "";

							scheduleHtml += "<tr>" +
								"<td>" + res.__('admin.driver_shifts.city') + ":</td>" +
								"<td>" + cityName + "</td>" +
								"</tr>" +
								"<tr>" +
								"<td>" + res.__('admin.driver_shifts.areas') + ":</td>" +
								"<td>" + areaName + "</td>" +
								"</tr>" +
								"<tr>" +
								"<td>" + res.__('admin.driver_shifts.shift_name') + ":</td>" +
								"<td>" + shiftName + " " + time + "</td>" +
								"</tr>";
						});
						scheduleHtml += "</table> </td>";

					} else if (leaveType) {
						scheduleHtml += "<td>" + leaveTypeList[String(leaveType)] + "</td>";
					} else {
						scheduleHtml += "<td></td>";
					}
					scheduleHtml += "</tr>";
				});
				scheduleHtml +=
					"</tbody>" +
					"</table>";

				if (shiftAvailablity[userId].user_email) {
					/**For send mail */
					sendMail(req, res, {
						to: shiftAvailablity[userId].user_email,
						action: "driver_schedule_mail",
						rep_array: [shiftAvailablity[userId].name, scheduleHtml]
					});
				}
			});

			/**For send success response */
			req.flash(Constants.STATUS_SUCCESS, res.__("admin.driver_shifts.your_driver_schedule_mail_has_been_sent"));
			res.redirect(Constants.WEBSITE_ADMIN_URL + 'driver_shifts');
		} catch (error) {
            console.log(error)
			/** Send error response **/
			req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(Constants.WEBSITE_ADMIN_URL + "driver_shifts");
		}
	}

	/**
	 * Function for delete shift
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async deleteShift(req, res, next) {
		let availableId = new ObjectId(req.params.id);
		var currentDate = newDate(newDate("", CURRENTDATE_END_DATE_FORMAT));
		var currentTime = newDate("", SHIFT_TIME_FORMAT);

		let conditions = { _id: availableId, };

		try {
			const driver_availabilities = this.db.collection(Tables.DRIVER_AVAILABILITIES);
			const result = await new Promise((resolve, reject) => {
				driver_availabilities.findOne(conditions, { projection: { _id: 1, shift_id: 1, date: 1 } }, (err, result) => {
					if (err) return reject(err);
					resolve(result);
				});
			});

			/** Send error response */
			if (!result) {
				req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
				return res.redirect(Constants.WEBSITE_ADMIN_URL + "driver_shifts");
			}

			/**Get shift detail */
			const shifts = this.db.collection(Tables.SHIFTS);
			const shiftResult = await new Promise((resolve, reject) => {
				shifts.findOne({ _id: new ObjectId(result.shift_id) }, { projection: { _id: 1, start_time: 1 } }, (err, shiftResult) => {
					if (err) return reject(err);
					resolve(shiftResult);
				});
			});

			/** Send error response */
			if (!shiftResult) {
				req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
				return res.redirect(Constants.WEBSITE_ADMIN_URL + "driver_shifts");
			}

			if (result.date > currentDate || (result.date >= currentDate && shiftResult.start_time > parseFloat(currentTime))) {
				/** Delete shift */
				await new Promise((resolve, reject) => {
					driver_availabilities.deleteOne(conditions, (updateErr) => {
						if (updateErr) return reject(updateErr);
						resolve();
					});
				});

				/** Send success response **/
				req.flash(Constants.STATUS_SUCCESS, res.__("admin.driver_shifts.shift_deleted_successfully"));
				res.redirect(Constants.WEBSITE_ADMIN_URL + "driver_shifts");

				/** save System logs */
				saveSystemLogs(req, res, {
					user_id: req.session.user._id,
					parent_id: availableId,
					activity_module: Constants.SYSTEM_LOG_MODULE_DRIVER_SHIFT_SETUP,
					activity_type: Constants.ACTIVITY_TYPE_DELETE,
				}).then(() => { });
			}
		} catch (error) {
			return next(error);
		}
	}
}

export default DriverShifts; 