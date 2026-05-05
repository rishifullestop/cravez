import { ObjectId } from 'mongodb';
import clone from 'clone';
import { parallel as asyncParallel, each as asyncEach } from 'async';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, getAreaIdsBasedOnFleetRole, getAllDriverIdsWhoHaveShift, newDate, getDropdownList, subtractDate, arrayToObject, getDifferenceBetweenTwoDatesInMinute } from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { saveSystemLogs, saveDriverStatusLogs, sendMailToUsers } from "../../../../services/index.mjs";

import orderTrackingModel from '../../order_tracking/model/order_tracking.mjs';

class CaptainTracking {
    constructor(db) {
        this.db = db;
        this.userCollectionDb = db.collection(Tables.USERS);

        this.orderTrackingModule = new orderTrackingModel(db);
    }

    /**
     * Function to get captain tracking list
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getCaptainTrackingList(req, res, next) {
        let isTeamHead		= 	(req.session.user.team_head) ? req.session.user.team_head :false;
		let authUserRoleId	=	req.session.user.user_role_id;
		let startDate   	= 	newDate(newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));
		let endDate  		= 	newDate(newDate("",Constants.CURRENTDATE_END_DATE_FORMAT));
		let captainType		=   (req.query.captain_type) 	? req.query.captain_type 		:'';
		let captainId 		= 	(req.query.captain_id)   	? new ObjectId(req.query.captain_id):"";
		let orderCountType	=   (req.query.order_count_type)? req.query.order_count_type 	:'';

        /** Get fleet area ids */
        let fleetAreaIds        = [];
        let allDriverIds        = [];
        let areaWiseDriverIds   = [];
        if(authUserRoleId == Constants.FLEET && !isTeamHead){
            fleetAreaIds = await getAreaIdsBasedOnFleetRole(req, res, next);

            let allDriverRes = await getAllDriverIdsWhoHaveShift(req,res,next);
            allDriverIds = allDriverRes?.driver_ids || [];

            let areaWiseDriverRes = await getAllDriverIdsWhoHaveShift(req,res,next,{area_ids: fleetAreaIds});
            areaWiseDriverIds = areaWiseDriverRes?.driver_ids || [];
        }

        /** Set  captain conditions */
        let captainConditions = clone(Constants.DRIVER_COMMON_CONDITIONS);
        if(authUserRoleId == Constants.FLEET){
            if(!isTeamHead || areaWiseDriverIds.length >0 || allDriverIds.length >0){
                if(!captainConditions["$or"]) captainConditions["$or"] = [];
                captainConditions["$or"].push({_id: {$in:  areaWiseDriverIds}});
                captainConditions["$or"].push({_id: {$nin:  allDriverIds}, force_active: Constants.FORCE_ACTIVE, is_available: Constants.ACTIVE });
            }
        }

        let commonConditions = 	clone(captainConditions);
        if(isPost(req)){
            let limit = (req.body.length) ? parseInt(req.body.length) :ADMIN_LISTING_LIMIT;
            let skip = (req.body.start)   ? parseInt(req.body.start)  :DEFAULT_SKIP;

            /** Configure Datatable conditions*/
            let dataTableConfig = await configDatatable(req,res,null);

            if(captainType){
                switch(captainType){
                    case "active_captains":
                        captainConditions.is_available = Constants.AVAILABLE;
                    break;
                    case "inactive_captains":
                        captainConditions.is_available = {$ne : Constants.AVAILABLE};
                    break;
                    case "busy_captains":
                        captainConditions.is_available = Constants.AVAILABLE;
                        captainConditions.order_status = {$ne : Constants.ORDER_DRIVER_FREE};
                    break;
                    case "free_captains":
                        captainConditions.is_available = Constants.AVAILABLE;
                        if(!captainConditions["$or"]) captainConditions["$or"] = [];
                        captainConditions["$or"].push({$or: [
                            {order_status : {$exists: false}},
                            {order_status : Constants.ORDER_DRIVER_FREE },
                        ]});
                    break;
                    case "arrived_at_customer_location_captains":
                        captainConditions.is_available  	= Constants.AVAILABLE;
                        captainConditions["orders.status"]  = Constants.ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION;
                    break;
                    case "online_captains":
                        captainConditions.is_available 	= Constants.AVAILABLE;
                        captainConditions.is_online  	= Constants.ONLINE;
                    break;
                    case "offline_captains":
                        if(!captainConditions["$or"]) captainConditions["$or"] = [];
                        captainConditions["$or"].push({$or: [
                            {is_online : {$exists:false}},
                            {is_online : Constants.OFFLINE}
                        ]});
                    break;
                    case "assigned_captains":
                        captainConditions.is_available 		= 	Constants.AVAILABLE;
                        captainConditions["orders.status"] 	=	Constants.ORDER_DRIVER_ASSIGNED;
                    break;
                    case "way_to_restaurant_captains":
                        captainConditions.is_available 		= 	Constants.AVAILABLE;
                        captainConditions["orders.status"] 	=	Constants.ORDER_DRIVER_ACCEPTED;
                    break;
                    case "arrived_at_restaurant_captains":
                        captainConditions.is_available 		= 	Constants.AVAILABLE;
                        captainConditions["orders.status"]	=	Constants.ORDER_DRIVER_ARRIVED_AT_RESTAURANT;
                    break;
                    case "way_to_customer_captains":
                        captainConditions.is_available 		= 	Constants.AVAILABLE;
                        captainConditions["orders.status"]	=	Constants.ORDER_DRIVER_WAY_TO_CUSTOMER;
                    break;
                }
            }

            dataTableConfig.conditions = Object.assign(captainConditions, dataTableConfig.conditions);
            dataTableConfig.sort_conditions["_id"] = Constants.SORT_DESC;

            // Get list or count of captains
            let dbRes = await this.userCollectionDb.aggregate([
                { $match: dataTableConfig.conditions },
                {$facet : {
                    list : [
                        {$sort: dataTableConfig.sort_conditions },
                        {$skip: skip},
                        {$limit: limit},
                        {$project: {
                            _id:1,full_name:1,is_available :1,active_orders :1,force_active:1,is_online:1, orders:1,is_suspend:1,is_highlight:1,vehicle_id:1
                        }}
                    ],
                    count: [
                        {$count: "count"},
                    ],
                }}
            ]).toArray();

            let result      =   dbRes?.[0]?.list || [];
            let allUserIds  =   [];
            if(result.length) result.map(records=>{
                allUserIds.push(records._id);

                let tmpNotAccepted = 0;
                if(records.orders && records.orders.length >0){
                    records.orders.map(tmpData=>{
                        if(tmpData.status == Constants.ORDER_DRIVER_ASSIGNED){
                            tmpNotAccepted++;
                        }
                    });
                }

                records.in_shift 			= 	false;
                records.not_accepted_orders =	tmpNotAccepted;
            });

            asyncParallel({
                driver_in_out_shifts :(childCallback)=>{
                    if(!result.length) return childCallback(null, result);

                    let currentTime		= 	parseFloat(newDate('',Constants.SHIFT_TIME_FORMAT));
                    let prevStartDate 	=	newDate(subtractDate(Constants.HOURS_IN_A_DAY),Constants.CURRENTDATE_START_DATE_FORMAT);
                    let prevEndDate 	=	newDate(subtractDate(Constants.HOURS_IN_A_DAY),Constants.CURRENTDATE_END_DATE_FORMAT);

                    const shifts = this.db.collection(Tables.SHIFTS);
                    const driver_availabilities = this.db.collection(Tables.DRIVER_AVAILABILITIES);
                    const driver_in_out_shifts = this.db.collection(Tables.DRIVER_IN_OUT_SHIFTS);
                    asyncEach(result, (records, eachCallback) => {
                        let tmpDriverId 	=	records._id;
                        let tmpForceAct 	= 	records.force_active;
                        let tmpVehicleId	= 	records.vehicle_id;

                        asyncParallel({
                            check_previous : (subCallback)=>{
                                driver_in_out_shifts.findOne({
                                    driver_id :	tmpDriverId,
                                    type 	  : Constants.IN_SHIFT,
                                    created	  :	{
                                        $gte: newDate(prevStartDate),
                                        $lte: newDate(prevEndDate)
                                    }
                                },{projection: {_id:1},sort:{created:Constants.SORT_DESC}}).then(findResult=>{
                                    if(!findResult) return subCallback(null,false);

                                    /** For get driver shift details */
                                    driver_availabilities.distinct("shift_id",{
                                        user_id	: 	tmpDriverId,
                                        date	: 	{$gte: newDate(prevStartDate), $lte: newDate(prevEndDate)}
                                    }).then(shiftIds=>{
                                        if(!shiftIds.length) return subCallback(null,false);

                                        /** Check driver shifts */
                                        shifts.aggregate([
                                            {$match	: {
                                                _id	: {$in: arrayToObject(shiftIds) },
                                                is_deleted: {$ne: Constants.DELETED},
                                            }},
                                            {$addFields:{
                                                is_next_day : {$cond: [
                                                    {$and: [
                                                        { $gt : ["$start_time","$end_time"] },
                                                    ]},
                                                    true,
                                                    false
                                                ]},
                                            }},
                                            {$match	: {
                                                $or :[
                                                    {$and : [
                                                        {is_next_day: true },
                                                        {start_time : {$lte: currentTime } },
                                                        {end_time   : {$lte: currentTime } }
                                                    ]},
                                                    {$and : [
                                                        {is_next_day: true },
                                                        {start_time : {$gte: currentTime } },
                                                        {end_time   : {$gte: currentTime } }
                                                    ]},
                                                    {$and : [
                                                        {end_time 	: {$gte: currentTime } },
                                                        {start_time : {$lte: currentTime } }
                                                    ]}
                                                ]
                                            }},
                                        ]).toArray().then(shiftResult=>{
                                            let shiftFlag = (shiftResult && shiftResult[0]) ? true : false;
                                            subCallback(null,shiftFlag);
                                        }).catch(next);
                                    }).catch(next);
                                }).catch(next);
                            },
                            force_active : (subCallback)=>{
                                /** Get driver in out shift details */
                                if(tmpForceAct == Constants.FORCE_ACTIVE && tmpVehicleId){

                                    driver_in_out_shifts.findOne({
                                        driver_id :	tmpDriverId,
                                        type 	  : Constants.IN_SHIFT,
                                        vehicle_id:	tmpVehicleId,
                                    },{projection: {created:1},sort:{created:Constants.SORT_DESC}}).then(findResult=>{
                                        let tmpCreated = (findResult) ? findResult.created :false;
                                        subCallback(null,tmpCreated);
                                    }).catch(next);
                                }else{
                                    subCallback(null, false);
                                }
                            },
                        },(asyncErr, asyncRes)=>{
                            if(asyncErr) return next(asyncErr);

                            /** Set conditions */
                            let inoutConditions = {
                                driver_id :	tmpDriverId,
                                type 	  : Constants.IN_SHIFT,
                                created	  :	{
                                    $gte: newDate(startDate),
                                    $lte: newDate(endDate)
                                }
                            };

                            if(asyncRes.check_previous){
                                inoutConditions.created = {$gte: newDate(prevStartDate), $lte: newDate(endDate) };
                            }else if(asyncRes.force_active){
                                inoutConditions.created = {$gte: newDate(asyncRes.force_active)};
                            }

                            /** For get driver shift details */
                            driver_in_out_shifts.findOne(inoutConditions,{projection:{ _id:1},sort:{created:Constants.SORT_DESC}}).then(findResult=>{
                                if(findResult) records.in_shift = findResult._id;
                                eachCallback(null);
                            }).catch(next);
                        });
                    },(eachErr) => {
                        childCallback(eachErr);
                    });
                },
            },()=>{

                /** Send response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data			:   result,
                    recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
                });
            });
        }else{
            /**Set driver conditions */
            let driverConditions = clone(commonConditions);
            asyncParallel({
                captain_list : (callback)=>{
                    /**Get dropdown list **/
                    getDropdownList(req,res, next,{
                        collections :[
                            {
                                collection 	: Tables.USERS,
                                columns    	: ["_id","full_name"],
                                conditions 	: driverConditions,
                                selected    :  [captainId],
                                sort_conditions : {is_available : Constants.SORT_DESC,full_name: Constants.SORT_ASC}
                            }
                        ],
                    }).then(dropDownResponse=> {
                        callback(null,dropDownResponse?.final_html_data?.[0] || "");
                    }).catch(next);
                },
                captain_stats : (callback)=>{
                    this.getCaptainRuleStats(req,res, next).then(response=>{
                        callback(null,response);
                    }).catch(next);
                },
            },(asyncParallelErr, asyncParallelResponse)=>{
                if(asyncParallelErr) return next(asyncParallelErr);

                /** render captain tracking page **/
                req.breadcrumbs(BREADCRUMBS['admin/captain_tracking/captain_tracking']);
                let statistics = asyncParallelResponse?.captain_stats || {};
                res.render('captain_tracking',{
                    active_captains 				: statistics.active_captains,
                    not_active_captains 			: statistics.not_active_captains,
                    busy_captains 					: statistics.busy_captains,
                    free_captains 					: statistics.free_captains,
                    way_to_customer_captains		: statistics.way_to_customer_captains,
                    arrived_at_restaurant_captains	: statistics.arrived_at_restaurant_captains,
                    way_to_restaurant_captains 		: statistics.way_to_restaurant_captains,
                    assigned_captains 				: statistics.assigned_captains,
                    captain_type  					: captainType,
                    captain_list  					: asyncParallelResponse.captain_list,
                    captain_id    					: captainId,
                    order_count_type 				: orderCountType,
                    arrived_at_customer_location_captains : statistics.arrived_at_customer_location_captains,
                });
            });
        }
    }

    /**
     * Function to get captain location
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return json
     */
    async getCaptainLocation(req, res, next) {
        try {
            let isTeamHead		= (req.session.user.team_head) ? req.session.user.team_head :false;
            let authUserRoleId	= req.session.user.user_role_id;
            let currentDate 	= newDate("",Constants.DATABASE_DATE_FORMAT);
            let endDate  		= newDate(currentDate+" "+Constants.END_DATE_TIME_FORMAT);
            let startDate   	= newDate(currentDate+" "+Constants.START_DATE_TIME_FORMAT);
            let captainType		= (req.query.captain_type) ? req.query.captain_type : '';

            /** Get fleet area ids */
            let fleetAreaIds        = [];
            let allDriverIds        = [];
            if(authUserRoleId == Constants.FLEET && !isTeamHead){
                fleetAreaIds = await getAreaIdsBasedOnFleetRole(req, res, next);

                let allDriverRes = await getAllDriverIdsWhoHaveShift(req,res,next);
                allDriverIds = allDriverRes?.driver_ids || [];
            }

            /** Set driver availability conditions */
            let driverAvailabilityConditions ={date: { $gte: startDate, $lte: endDate}};

            /** Set condition for fleet user */
            if(authUserRoleId == Constants.FLEET){
                if(!isTeamHead || fleetAreaIds.length >0){
                    driverAvailabilityConditions.area_id = {$in : arrayToObject(fleetAreaIds)};
                }
            }

            let availableDriverIds = [];
            if(authUserRoleId == Constants.FLEET){
                const driver_availabilities	= this.db.collection(Tables.DRIVER_AVAILABILITIES);
                availableDriverIds = await driver_availabilities.distinct("user_id",driverAvailabilityConditions);
            }

            /** Set  captain conditions */
            let conditions 			=  clone(Constants.DRIVER_COMMON_CONDITIONS);
            conditions.is_available = Constants.AVAILABLE;

            /** Set condition for fleet user */
            if(authUserRoleId == Constants.FLEET){
                if(!isTeamHead || availableDriverIds.length >0){
                    if(!conditions["$or"]) conditions["$or"] = [];
                    conditions["$or"].push({_id: {$in:  availableDriverIds}});
                    conditions["$or"].push({_id: {$nin: allDriverIds}, force_active: Constants.FORCE_ACTIVE, is_available: Constants.ACTIVE });
                }
            }

            /** Set conditions **/
            if(captainType){
                switch(captainType){
                    case "active_captains":
                        conditions.is_available = Constants.AVAILABLE;
                    break;
                    case "inactive_captains":
                        conditions.is_available = {$ne : Constants.AVAILABLE};
                    break;
                    case "busy_captains":
                        conditions.is_available = Constants.AVAILABLE;
                        conditions.order_status = {$ne : Constants.ORDER_DRIVER_FREE};
                    break;
                    case "free_captains":
                        if(!conditions["$or"]) conditions["$or"] = [];
                        conditions.is_available = Constants.AVAILABLE;
                        conditions["$or"].push({$or: [
                            {order_status : {$exists:false}},
                            {order_status : Constants.ORDER_DRIVER_FREE}
                        ]});
                    break;
                    case "arrived_at_customer_location_captains":
                        conditions.is_available =	Constants.AVAILABLE;
                        conditions.order_status	= 	Constants.ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION;
                    break;
                }
            }

            /** Get captain details **/
            this.userCollectionDb.find(conditions,{projection: {_id:1,longitude:1,latitude:1,active_orders:1,full_name:1,mobile_number:1,order_status:1}}).toArray().then(result=>{

                /** Send response **/
                res.send({ status: Constants.STATUS_SUCCESS, result	: result });
            }).catch(next);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to update force active status
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return json
     */
    async updateForceActiveStatus(req, res, next) {
        try {
            let driverId			= 	new ObjectId(req.params.id);
            let forceActiveStatus	= 	(req.params.status == Constants.FORCE_ACTIVE) ? Constants.FORCE_DEACTIVE 	: Constants.FORCE_ACTIVE;
            let currentDate 		= 	newDate(newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));
            let currentTime 		=	parseFloat(newDate("",Constants.EXCUSES_TIME_FORMAT));
            let updateBreakOrExcuses=	false;

            const driver_breaks 	= 	this.db.collection(Tables.DRIVER_BREAKS);
            const driver_excuses	=	this.db.collection(Tables.DRIVER_EXCUSES);
            asyncParallel({
                driver_details:(callback)=>{
                    /** Get user details  */
                    this.userCollectionDb.findOne({_id: driverId },{projection: {_id:1,user_role_id: 1}}).then(result=>{
                        callback(null, result);
                    }).catch(next);
                },
                break_list:(callback)=>{
                    if(forceActiveStatus != Constants.FORCE_ACTIVE) return callback(null,[]);

                    /** Get driver breaks list */
                    driver_breaks.find({
                        driver_id    : 	driverId,
                        status 		 : 	Constants.APPROVED,
                        date         : 	{$gte: currentDate},
                        is_completed : 	false
                    }).toArray().then(breakResult=>{
                        callback(null,breakResult);
                    }).catch(next);
                },
                excuses_list : (callback)=>{
                    if(forceActiveStatus != Constants.FORCE_ACTIVE) return callback(null,[]);

                    /** Get driver excuses list */
                    driver_excuses.findOne({
                        driver_id    : 	driverId,
                        date         : 	{$gte: currentDate},
                        status 		 : 	Constants.APPROVED,
                        is_completed :	false,
                    }).then(excuseResult=>{
                        callback(null, excuseResult);
                    }).catch(next);
                },
                update_break_list : (callback)=>{
                    if(forceActiveStatus != Constants.FORCE_ACTIVE) return callback(null,[]);

                    /** Update driver break list */
                    driver_breaks.updateMany({
                        driver_id    : driverId,
                        status 		 : 	Constants.PENDING,
                        date         : {$gte: currentDate},
                        is_completed : false
                    },
                    {$set:{
                        status 			 : Constants.REJECTED,
                        rejection_reason : res.__("admin.captain_tracking.rejected_dueto_force_active"),
                        is_completed	 : true,
                        modified		 : getUtcDate()
                    }}).then(updateRes=>{
                        if(updateRes && updateRes.result && updateRes.result.nModified){
                            updateBreakOrExcuses = true;
                        }
                        callback(null);
                    }).catch(next);
                },
                update_excuses_list : (callback)=>{
                    if(forceActiveStatus != Constants.FORCE_ACTIVE) return callback(null,[]);

                    /** Update driver excuses list */
                    driver_excuses.updateMany({
                        driver_id    : 	driverId,
                        date         : 	{$gte: currentDate},
                        status 		 : 	Constants.PENDING,
                        is_completed :	false,
                    },
                    {$set:{
                        status 			 : Constants.REJECTED,
                        rejection_reason: res.__("admin.captain_tracking.excuses_rejected_dueto_force_active"),
                        is_completed	 : true,
                        modified		 : getUtcDate()
                    }}).then(updateRes=>{
                        if(updateRes && updateRes.result && updateRes.result.nModified){
                            updateBreakOrExcuses = true;
                        }
                        callback(null);
                    }).catch(next);
                },
                in_shift_detail: (callback)=>{
                    if(forceActiveStatus == Constants.FORCE_ACTIVE) return callback(null,false);

                    /** Get shift in out detail **/
                    const driver_in_out_shifts = this.db.collection(Tables.DRIVER_IN_OUT_SHIFTS);
                    driver_in_out_shifts.findOne({
                        driver_id :	driverId,
                        vehicle_id:	{$exists: true},
                        type 	  : Constants.IN_SHIFT
                    },{projection: {_id:1}}).then(shiftResult=>{
                        callback(null, shiftResult);
                    }).catch(next);
                }
            },(asyncErr, asyncResponse)=>{
                if(asyncErr) return next(asyncErr);

                /** Send error response */
                if(!asyncResponse.driver_details){
                    req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
                    return res.redirect(Constants.WEBSITE_ADMIN_URL+"captain_tracking");
                }

                /** Send error response */
                if(asyncResponse.in_shift_detail){
                    req.flash(Constants.STATUS_ERROR, res.__("admin.captain_tracking.you_can_not_mark_force_inactive_untill_the_driver_mark_out_shift"));
                    return res.redirect(Constants.WEBSITE_ADMIN_URL+"captain_tracking");
                }

                let userRoleId 	= 	asyncResponse.driver_details.user_role_id;
                let breakList 	= 	asyncResponse.break_list;
                let excusesList =	asyncResponse.excuses_list;
                asyncParallel({
                    update_driver_details:(childCallback)=>{
                        /** Update driver details */
                        this.userCollectionDb.updateOne({
                            _id : driverId
                        },
                        {$set : {
                            force_active : forceActiveStatus,
                            modified	 : getUtcDate()
                        }}).then(()=>{
                            childCallback(null);
                        }).catch(next);
                    },
                    update_break_details:(childCallback)=>{
                        if(forceActiveStatus != Constants.FORCE_ACTIVE || !breakList || breakList.length == 0){
                            return childCallback(null);
                        }

                        updateBreakOrExcuses = true;
                        asyncEach(breakList, (records, eachCallback) => {
                            let breakId 	= 	records._id;
                            let startTime 	= 	(records.start_time) ? String(records.start_time).replace('.',':') :"";
                            let endTime 	=	newDate("",Constants.BREAK_TIME_FORMAT);
                            let breakStart	=	new Date(newDate("",Constants.DATABASE_DATE_FORMAT+' '+startTime));
                            let breakEnd	= 	new Date(newDate("",Constants.DATABASE_DATE_FORMAT+' '+endTime));
                            let difference	= 	Math.ceil((breakEnd - breakStart)/Constants.MILLISECONDS_IN_A_SECOND);
                            endTime 		=	parseFloat(endTime.replace(':','.'));

                            /** update driver breaks details */
                            driver_breaks.updateOne({
                                _id :	breakId,
                            },
                            {$set: {
                                is_completed : 	true,
                                end_time     : 	endTime,
                                duration     :	difference,
                                modified	 :	getUtcDate()
                            }}).then(()=>{
                                eachCallback(null);

                                /** Save driver status logs */
                                saveDriverStatusLogs(req,res,next,{
                                    parent_id 	: 	breakId,
                                    driver_id 	: 	driverId,
                                    type	  	: 	'driver_breaks',
                                    event_type	: 	Constants.END_BREAK,
                                    end_time	: 	endTime,
                                    duration	:	difference
                                });

                                /** save System logs */
                                saveSystemLogs(req, res, {
                                    user_id			: 	req.session.user._id,
                                    parent_id		:	breakId,
                                    activity_module	: 	Constants.SYSTEM_LOG_MODULE_DRIVER_BREAKS,
                                    activity_type	: 	Constants.ACTIVITY_TYPE_END_BREAK
                                });
                            });
                        },(eachErr) => {
                            childCallback(eachErr);
                        });
                    },
                    update_excuses_details : (childCallback)=>{
                        if(forceActiveStatus != Constants.FORCE_ACTIVE || !excusesList){
                            return childCallback(null);
                        }

                        updateBreakOrExcuses = true;
                        let excuseId	=	excusesList._id;
                        let isStart 	= 	excusesList.is_start;
                        let type		=	(!isStart) ? Constants.CANCEL_EXCUSE :Constants.OUT_EXCUSE;

                        /** Update driver excuse details */
                        driver_excuses.updateOne({
                            _id :	excuseId,
                        },
                        {$set:{
                            is_completed: true,
                            from 		: currentTime,
                            to 			: currentTime,
                            type  		: type,
                            modified	: getUtcDate()
                        }}).then(()=>{
                            childCallback(null);
                        }).catch(next);

                        if(type == Constants.OUT_EXCUSE){
                            /** Save driver status logs */
                            saveDriverStatusLogs(req,res,next,{
                                parent_id 	: excuseId,
                                driver_id 	: driverId,
                                type	  	: 'driver_excuses',
                                event_type	: Constants.OUT_EXCUSE,
                                end_time	: currentTime,
                            });
                        }
                    },
                },(asyncChildErr)=>{
                    if(asyncChildErr) return next(asyncChildErr);

                    /** Send success response **/
                    req.flash(Constants.STATUS_SUCCESS,res.__("admin.captain_tracking.force_active_has_been_updated_successfully"));
                    res.redirect(Constants.WEBSITE_ADMIN_URL+"captain_tracking");

                    if(updateBreakOrExcuses){
                        /** Send notificatin */
                        sendMailToUsers(req,res,{
                            event_type 	: 	Constants.DRIVER_BREAK_EXCUSE_IMMEDIATELY_CANCELED,
                            user_id		:	driverId,
                            user_role_id: 	userRoleId,
                        });
                    }
                });
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get captain deliveries list
     *
     * @param req	As Request Data
     * @param res	As Response Data
     *
     * @return json
     */
    async getCaptainDeliveriesList(req, res, next) {
        try {
            let isTeamHead		= 	(req.session.user.team_head) ? req.session.user.team_head :false;
            let authUserRoleId	= 	(req.session.user && req.session.user.user_role_id) ? req.session.user.user_role_id :"";
            let limit       	= 	(req.body.length) 			?	parseInt(req.body.length) 	:Constants.ADMIN_LISTING_LIMIT;
            let skip        	= 	(req.body.start)   			?	parseInt(req.body.start)  	:Constants.DEFAULT_SKIP;
            let captainType		= 	(req.query.captain_type) 	? 	req.query.captain_type 		:'';
            let captainId		= 	(req.body.captain_id) 		?	req.body.captain_id 		:'';
            let orderCountType	=	(req.body.order_count_type)	?	req.body.order_count_type	:'';
            const collection    = 	this.db.collection(Tables.ORDERS);

            /** Set common conditions in a object **/
            let prevStartDate 	 =	newDate(newDate(subtractDate(Constants.HOURS_IN_A_DAY),Constants.CURRENTDATE_START_DATE_FORMAT));
            let commonConditions = {
                order_date  : {$gte: prevStartDate},
                is_completed: {$exists: false},
                $and: [
                    {$or: [
                        {assigned_captain : {$ne: null} },
                        {captain_id	  	  : {$ne : ""} },
                        {problem_type	  : {$exists: true}}
                    ]}
                ],
            };

            /** search by captain id */
            if(captainId){
                commonConditions = {
                    order_date  : {$gte: prevStartDate},
                    is_completed: { $exists: false },
                    $and: [{
                        $or: [
                            {assigned_captain : new ObjectId(captainId)},
                            {captain_id	  	  : new ObjectId(captainId)}
                        ]
                    }],
                };

                if(orderCountType && orderCountType == "not_accepted_orders"){
                    commonConditions.assigned_captain_status = Constants.ORDER_DRIVER_ASSIGNED;
                }
            }

            /** Set captain conditions */
            let captainConditions = clone(Constants.DRIVER_COMMON_CONDITIONS);

            if(captainType){
                switch(captainType){
                    case "active_captains":
                        captainConditions.is_available = Constants.AVAILABLE;
                    break;
                    case "inactive_captains":
                        captainConditions.is_available = {$ne : Constants.AVAILABLE};
                    break;
                    case "busy_captains":
                        captainConditions.is_available = Constants.AVAILABLE;
                        captainConditions.order_status = {$ne : Constants.ORDER_DRIVER_FREE};
                    break;
                    case "free_captains":
                        captainConditions.is_available = Constants.AVAILABLE;
                        if(!captainConditions["$or"]) captainConditions["$or"] = [];
                        captainConditions["$or"].push({$or: [
                            {order_status : {$exists: false}},
                            {order_status : Constants.ORDER_DRIVER_FREE },
                        ]});
                    break;
                    case "arrived_at_customer_location_captains":
                        captainConditions.is_available = Constants.AVAILABLE;
                        captainConditions.order_status = Constants.ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION;
                    break;

                    case "assigned_captains":
                        captainConditions.is_available = Constants.AVAILABLE;
                        captainConditions.order_status = Constants.ORDER_DRIVER_ASSIGNED;
                    break;
                    case "way_to_restaurant_captains":
                        captainConditions.is_available = Constants.AVAILABLE;
                        captainConditions.order_status = Constants.ORDER_DRIVER_ACCEPTED;
                    break;

                    case "arrived_at_restaurant_captains":
                        captainConditions.is_available = Constants.AVAILABLE;
                        captainConditions.order_status = Constants.ORDER_DRIVER_ARRIVED_AT_RESTAURANT;
                    break;
                    case "way_to_customer_captains":
                        captainConditions.is_available = Constants.AVAILABLE;
                        captainConditions.order_status = Constants.ORDER_DRIVER_WAY_TO_CUSTOMER;
                    break;
                }
            }

            /** Get fleet area ids */
            let fleetAreaIds  = [];
            if(authUserRoleId == Constants.FLEET && !isTeamHead){
                fleetAreaIds = await getAreaIdsBasedOnFleetRole(req, res, next);
            }

            let typeCaptainIds = [];
            if(captainType){
                typeCaptainIds = await this.userCollectionDb.distinct("_id",captainConditions);
            }

            /** Set  captain conditions */
            if(captainType) commonConditions["$and"].push({captain_id: {$in: typeCaptainIds}});

            // Fleet area conditions
            if(authUserRoleId == Constants.FLEET && !isTeamHead){
                commonConditions.branch_area_id = {$in: arrayToObject(fleetAreaIds)};
            }

            /** Configure Datatable conditions*/
            let dataTableConfig = await configDatatable(req,res,null);

            dataTableConfig.conditions = Object.assign(dataTableConfig.conditions,commonConditions);

            asyncParallel({
                captain_deliveries_list :(callback)=>{
                    /** Get list of captain deliveries  **/
                    collection.find(dataTableConfig.conditions,{projection: {_id:1,unique_order_id:1,captain_id:1,delivery_status:1,admin_status :1,area_name:1,order_date:1,elapsed_time:1,is_completed:1,assigned_captain:1,branch_id:1,is_schedule:1,order_estimate_time:1,scheduled_date:1,aghzeya_bill_no:1,branch_area_id:1}}).sort(dataTableConfig.sort_conditions).limit(limit).skip(skip).toArray().then(result=>{
                        if(result.length <= 0) return callback(null,result);

                        const restaurant_branches = this.db.collection(Tables.RESTAURANT_BRANCHES);
                        const tickets 		= this.db.collection(Tables.TICKETS);
                        const order_details = this.db.collection(Tables.ORDER_DETAILS);
                        const voc_responses = this.db.collection(Tables.VOC_RESPONSES);
                        asyncEach(result, (records, eachCallback) => {
                            asyncParallel({
                                ticket_count :(childCallback)=>{
                                    /** Get tickets count **/
                                    tickets.find({order_id: records.unique_order_id},{projection : {_id:1,is_not_seen:1,created_by:1}}).toArray().then(ticketResult=>{
                                        childCallback(null,ticketResult);
                                    }).catch(next);
                                },
                                order_details :(childCallback)=>{
                                    /** Get order details **/
                                    order_details.findOne({order_id: records._id},{projection:{_id:1,delivery_duration:1,elapsed_time:1,delivery_area_id:1}}).then(orderDetailsResult=>{
                                        childCallback(null,orderDetailsResult);
                                    }).catch(next);
                                },
                                delivery_areas : (childCallback)=>{
                                    const areas = this.db.collection(Tables.AREAS);
                                    areas.find({},{projection : {_id:1,name:1}}).toArray().then(areaResult=>{
                                        let deliveryAreaList = {};
                                        areaResult.map(area=>{
                                            deliveryAreaList[area._id] = area.name;
                                        });
                                        childCallback(null,deliveryAreaList);
                                    }).catch(next);
                                },
                                captain_details :(childCallback)=>{
                                    let tmpCaptainId = (records.captain_id) ? records.captain_id :records.assigned_captain;

                                    /** Get captain details **/
                                    this.userCollectionDb.findOne({ _id: tmpCaptainId},{projection:{_id:1,full_name:1}}).then(userResult=>{
                                        childCallback(null,userResult);
                                    }).catch(next);
                                },
                                voc_responses :(childCallback)=>{
                                    /** Get voc responses **/
                                    voc_responses.find({order_id: records._id},{projection : {_id:1,is_not_seen:1,answer_given_by:1}}).toArray().then(vocResult=>{
                                        childCallback(null,vocResult);
                                    }).catch(next);
                                },
                                branch_details :(childCallback)=>{
                                    if(!records.branch_id) return childCallback(null,{});

                                    /** Get branch details **/
                                    restaurant_branches.findOne({_id: records.branch_id},{projection:{_id:1,area_id:1,name:1}}).then(branchResult=>{
                                        childCallback(null,branchResult);
                                    }).catch(next);
                                },
                            },(asyncChildErr, asyncChildResponse)=>{
                                if(asyncChildErr) return eachCallback(asyncChildErr);

                                let tmpBranchAreaId =	(asyncChildResponse.branch_details) ? asyncChildResponse.branch_details.area_id :{};
                                let vocCount		=	(asyncChildResponse.voc_responses) ? asyncChildResponse.voc_responses :[];
                                let ticketCount		=	(asyncChildResponse.ticket_count) ? asyncChildResponse.ticket_count :[];
                                let captainDetails	=	(asyncChildResponse.captain_details) ? asyncChildResponse.captain_details :{};
                                let orderSubDetails	=	(asyncChildResponse.order_details) ? asyncChildResponse.order_details :{};
                                let deliveryAreas	=	(asyncChildResponse.delivery_areas) ? asyncChildResponse.delivery_areas :{};

                                let deliveryAreaId = (orderSubDetails.delivery_area_id) ? orderSubDetails.delivery_area_id : "";

                                records.restaurant_branch_name = (asyncChildResponse.branch_details) ? asyncChildResponse.branch_details.name[Constants.DEFAULT_LANGUAGE_CODE] :"";

                                records.area_name = (deliveryAreas[tmpBranchAreaId]) ? deliveryAreas[tmpBranchAreaId] :{};

                                records.tickets = ticketCount;
                                records.voc 	= vocCount;
                                records.captain	= (captainDetails.full_name) ? captainDetails.full_name :"";
                                records.delivery_area_name = (deliveryAreas[deliveryAreaId]) ? deliveryAreas[deliveryAreaId] : "";
                                records.delivery_duration = (orderSubDetails.delivery_duration) ?   orderSubDetails.delivery_duration :0;
                                records.elapsed_time = ( orderSubDetails.elapsed_time) ?   orderSubDetails.elapsed_time :0;
                                /** Insert time passed in records **/
                                let currentDate = newDate();
                                let timePassed  = getDifferenceBetweenTwoDatesInMinute(records.order_date,currentDate);
                                records.time_passed = (timePassed >0) ? parseInt(timePassed) :0;
                                eachCallback(null);
                            });
                        },(asyncErr) => {
                            callback(asyncErr,result);
                        });
                    });
                },
                filter_records:(callback)=>{
                    /** Get filtered records counting in captain deliveries  **/
                    collection.countDocuments(dataTableConfig.conditions).then(filterContResult=>{
                        callback(null, filterContResult);
                    }).catch(next);
                }
            },(err, response)=>{
                /** Send response **/
                res.send({
                    status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
                    draw			: dataTableConfig.result_draw,
                    data			: (response.captain_deliveries_list) ? response.captain_deliveries_list :[],
                    recordsFiltered	: (response.filter_records) ? response.filter_records 	:0,
                    recordsTotal	: (response.filter_records) ? response.filter_records	:0,
                });
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get captain VOC list
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getCaptainVOCList(req, res, next) {
        try {
            let orderId	= (req.params.order_id) ? new ObjectId(req.params.order_id) : '';
            if (isPost(req)) {
                let limit			= 	(req.body.length)	? parseInt(req.body.length)	: Constants.ADMIN_LISTING_LIMIT;
                let skip			= 	(req.body.start) 	? parseInt(req.body.start)	: Constants.DEFAULT_SKIP;
                const collection	= 	this.db.collection(Tables.VOC_RESPONSES);

                /** Configure Datatable conditions*/
                let dataTableConfig = await configDatatable(req,res,null);

                /** Set Common conditions **/
				let commonConditions = { order_id: orderId};

                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions,commonConditions);

                // Get list or count of voc responses
                let dbRes = await collection.aggregate([
                    { $match: dataTableConfig.conditions },
                    {$facet : {
                        list : [
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit },
                            {$project: {_id : 1,type : 1,question : 1,answer : 1,user_type:1,created:1}}
                        ],
                        count: [
                            {$count: "count"},
                        ],
                    }}
                ]).toArray();

                /** Send response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data			:   dbRes?.[0]?.list ||[],
                    recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
                });
            } else {
                res.render('captain_voc_list', {
                    layout     : false,
                    order_id   : orderId
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get captain ticket list
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getCaptainTicketList(req, res, next) {
        try {
            let orderId	=	(req.params.order_id) ? req.params.order_id : '';
            if(isPost(req)){
                let limit			= 	(req.body.length)	? parseInt(req.body.length)	: Constants.ADMIN_LISTING_LIMIT;
                let skip			= 	(req.body.start) 	? parseInt(req.body.start)	: Constants.DEFAULT_SKIP;
                const collection	= 	this.db.collection(Tables.TICKETS);

                const orders	= this.db.collection(Tables.ORDERS);
                let orderUniqueIds = await orders.distinct("unique_order_id",{_id : new ObjectId(orderId)});

                /** Configure Datatable conditions*/
                let dataTableConfig = await configDatatable(req,res,null);

                /** Set conditions */
                let commonConditions = {$and: [{order_id: { $in: orderUniqueIds}}]};
                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions,commonConditions);

                // Get list or count of tickets
                 let dbRes = await collection.aggregate([
                    { $match: dataTableConfig.conditions },
                    {$facet : {
                        list : [
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit },
                            {$lookup : {
                                from 		: Tables.ADMIN_ROLES,
                                localField 	: "assigned_to_role_id",
                                foreignField: "role_id",
                                as 			: "role_details"
                            }},
                            {$lookup: {
                                from 		: Tables.USERS,
                                localField 	: "created_by",
                                foreignField: "_id",
                                as 			: "from_details"
                            }},
                            {$project : {
                                _id:1, created_by_name:1, ticket_id:1, category_details:1,category:1, sub_category:1, title:1, description:1,created:1,order_id:1,status:1, comment:1,check_in: 1, assigned_to_role_id: 1, "client_details.mobile_number": 1,
                                department_name : {$arrayElemAt : ["$role_details.role_name",0]},
                                created_by_name : {$arrayElemAt : ["$from_details.full_name",0]}
                            }}
                        ],
                        count: [
                            {$count: "count"},
                        ],
                    }}
                ]).toArray();

                let result = dbRes?.[0]?.list || [];

                /** Push category ids in array */
                let categoryIds = [];
                result.map(record=>{
                    categoryIds.push(record.category);
                    categoryIds.push(record.sub_category);
                    categoryIds.push(record.title);
                });

                asyncParallel({
                    category_list : (asyncCallback)=>{
                        if(categoryIds.length <= 0) return asyncCallback(null,{});

                        /** Get categories names */
                        const categories = this.db.collection(Tables.CATEGORIES);
                        categories.find({_id : {$in : arrayToObject(categoryIds)}},{projection : {_id:1,category_name : 1}}).toArray().then(categoryData=>{
                            if(categoryData.length <= 0) return asyncCallback(null,{});

                            let categoryList = {};
                            categoryData.map(master=>{
                                categoryList[master._id] = master.category_name;
                            });
                            asyncCallback(null,categoryList);
                        }).catch(next);
                    },
                },(_, asyncRes)=>{

                    /** Send response **/
                    res.send({
                        status: Constants.STATUS_SUCCESS,
                        draw: dataTableConfig.result_draw,
                        data			:   result,
                        recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
                        recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
                        categories		:   asyncRes?.category_list || {},
                    });
                });
            }else{
                /** Render captain ticket list page */
                res.render('captain_ticket_list',{
                    layout   : false,
                    order_id : orderId
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get captain stats
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return json
     */
    async getCaptainStats(req, res, next) {
        try {
            let captainId   	=	(req.params.id) ? new ObjectId(req.params.id) : "";
            let currentDate 	=	newDate(newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));
            let currentTime 	=	parseFloat(newDate("",Constants.EXCUSES_TIME_FORMAT));
            let prevStartDate 	= 	newDate(subtractDate(Constants.HOURS_IN_A_DAY),Constants.CURRENTDATE_START_DATE_FORMAT);
            let prevEndDate 	= 	newDate(subtractDate(Constants.HOURS_IN_A_DAY),Constants.CURRENTDATE_END_DATE_FORMAT);
            let endDate  		=	newDate(newDate("",Constants.CURRENTDATE_END_DATE_FORMAT));

            const shifts 				=	this.db.collection(Tables.SHIFTS);
            const driver_breaks         =   this.db.collection(Tables.DRIVER_BREAKS);
            const driver_excuses        =   this.db.collection(Tables.DRIVER_EXCUSES);
            const driver_in_out_shifts 	=	this.db.collection(Tables.DRIVER_IN_OUT_SHIFTS);
            const driver_availabilities	=	this.db.collection(Tables.DRIVER_AVAILABILITIES);
            asyncParallel({
                driver_breaks : (callback)=>{
                    /** Get driver breaks details */
                    driver_breaks.findOne({
                        driver_id    :  captainId,
                        date         : 	{$gte: currentDate},
                        status 		 : 	Constants.APPROVED,
                        is_completed :	false,
                        $or 		 : 	[
                            {start_time: {$gte: currentTime }},
                            {start_time: {$lte: currentTime }}
                        ],
                    },{projection: {driver_id:1}}).then(breakResult=>{
                        callback(null,breakResult);
                    }).catch(next);
                },
                driver_excuses : (callback)=>{
                    /** Get driver excuses details */
                    driver_excuses.findOne({
                        driver_id    : 	captainId,
                        date         : 	{$gte: currentDate},
                        status 		 : 	Constants.APPROVED,
                        is_completed :	false,
                        $or 		 : 	[
                            {$and : [
                                {from 	: {$gte: currentTime } },
                                {to 	: {$lte: currentTime } }
                            ]},
                            {$and : [
                                {to 	: {$gte: currentTime } },
                                {from 	: {$lte: currentTime } }
                            ]}
                        ],
                    },{projection: {driver_id:1}}).then(excuseResult=>{
                        callback(null,excuseResult);
                    }).catch(next);
                },
                driver_details : (callback)=>{
                    /** Get driver details */
                    this.userCollectionDb.findOne({ _id: captainId},{projection: {is_online:1,vehicle_id:1,vehicle_type:1,is_gps:1,force_active:1}}).then(driverOnlineResult=>{
                        callback(null, driverOnlineResult);
                    }).catch(next);
                },
                check_previous : (callback)=>{
                    driver_in_out_shifts.findOne({
                        driver_id :	captainId,
                        type 	  : Constants.IN_SHIFT,
                        created	  :	{
                            $gte: newDate(prevStartDate),
                            $lte: newDate(prevEndDate)
                        }
                    },{projection: {_id:1},sort:{created:Constants.SORT_DESC}}).then(findResult=>{
                        if(!findResult) return callback(null,false);

                        /** For get driver shift details */
                        driver_availabilities.distinct("shift_id",{
                            user_id	: 	captainId,
                            date	: 	{$gte: newDate(prevStartDate), $lte: newDate(prevEndDate)}
                        },(driverErr, shiftIds)=>{
                            if(driverErr || shiftIds.length==0) return callback(driverErr,false);

                            /** Check driver shifts */
                            shifts.aggregate([
                                {$match	: {
                                    _id	: {$in: arrayToObject(shiftIds) },
                                    is_deleted: {$ne: Constants.DELETED},
                                }},
                                {$addFields:{
                                    is_next_day : {$cond: [
                                        {$and: [
                                            { $gt : ["$start_time","$end_time"] },
                                        ]},
                                        true,
                                        false
                                    ]},
                                }},
                                {$match	: {
                                    $or :[
                                        {$and : [
                                            {is_next_day: true },
                                            {start_time : {$lte: currentTime } },
                                            {end_time   : {$lte: currentTime } }
                                        ]},
                                        {$and : [
                                            {is_next_day: true },
                                            {start_time : {$gte: currentTime } },
                                            {end_time   : {$gte: currentTime } }
                                        ]},
                                        {$and : [
                                            {end_time 	: {$gte: currentTime } },
                                            {start_time : {$lte: currentTime } }
                                        ]}
                                    ]
                                }},
                            ]).toArray().then(shiftResult=>{
                                let shiftFlag = (shiftResult && shiftResult[0]) ? true : false;
                                callback(null,shiftFlag);
                            }).catch(next);
                        });
                    });
                },
            },(asyncErr,asyncResponse)=>{
                if(asyncErr) return next(asyncErr);

                let driverBreakDetails 	  = (asyncResponse.driver_breaks)  ? asyncResponse.driver_breaks   :"";
                let driverExcusesDetails  = (asyncResponse.driver_excuses) ? asyncResponse.driver_excuses  :"";
                let driverDetails 		  = (asyncResponse.driver_details) ? asyncResponse.driver_details  :{};

                /* Shift conditions */
                let shiftConditions = {
                    driver_id	: 	captainId,
                    created     : 	{$gte: currentDate},
                    type		:	Constants.IN_SHIFT
                };
                if(asyncResponse.check_previous){
                    shiftConditions.created = {$gte: newDate(prevStartDate), $lte: newDate(endDate) };
                }else if(driverDetails.force_active && driverDetails.force_active==Constants.FORCE_ACTIVE){
                    delete shiftConditions.created;
                }

                /** Get driver inshift details */
                driver_in_out_shifts.findOne(shiftConditions,{projection: {driver_id:1},sort:{created:Constants.SORT_DESC}}).then(driverInshiftDetails=>{

                    /** render get captain stats page **/
                    res.render('captain_stats',{
                        layout		   : false,
                        driver_break   : driverBreakDetails,
                        driver_excuse  : driverExcusesDetails,
                        driver_inshift : driverInshiftDetails,
                        driver_details : driverDetails
                    });
                });
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get captain rules
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return json
     */
    async getCaptainRules(req, res, next) {
        try {
            let response = await this.getCaptainRuleStats(req,res, next);

            /** Send response **/
            res.send({
                active_captains 						: response.active_captains || 0,
                not_active_captains 					: response.not_active_captains || 0,
                busy_captains 							: response.busy_captains || 0,
                free_captains 							: response.free_captains || 0,
                arrived_at_customer_location_captains	: response.arrived_at_customer_location_captains || 0,
                way_to_customer_captains 				: response.way_to_customer_captains || 0,
                arrived_at_restaurant_captains 			: response.arrived_at_restaurant_captains || 0,
                way_to_restaurant_captains 				: response.way_to_restaurant_captains || 0,
                assigned_captains 						: response.assigned_captains || 0,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
	 * Function to get captain rules stats
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return json
	 */
	async getCaptainRuleStats(req,res, next){
        return new Promise(async resolve=>{
            try {
                let isTeamHead		= 	(req.session.user.team_head) ? req.session.user.team_head :false;
                let authUserRoleId	=	req.session.user.user_role_id;

                /** Get fleet area ids */
                let fleetAreaIds        = [];
                let allDriverIds        = [];
                let areaWiseDriverIds   = [];
                if(authUserRoleId == Constants.FLEET && !isTeamHead){
                    fleetAreaIds = await getAreaIdsBasedOnFleetRole(req, res, next);

                    let allDriverRes = await getAllDriverIdsWhoHaveShift(req,res,next);
                    allDriverIds = allDriverRes?.driver_ids || [];

                    let areaWiseDriverRes = await getAllDriverIdsWhoHaveShift(req,res,next,{area_ids: fleetAreaIds});
                    areaWiseDriverIds = areaWiseDriverRes?.driver_ids || [];
                }

                /** Set  captain conditions */
                let captainConditions 	= 	clone(Constants.DRIVER_COMMON_CONDITIONS);
                if(authUserRoleId == Constants.FLEET){
                    if(!isTeamHead || areaWiseDriverIds.length >0){
                        if(!captainConditions["$or"]) captainConditions["$or"] = [];
                        captainConditions["$or"].push({_id: {$in:  areaWiseDriverIds}});
                        captainConditions["$or"].push({_id: {$nin: allDriverIds}, force_active: Constants.FORCE_ACTIVE, is_available: Constants.ACTIVE });
                    }
                }

                asyncParallel({
                    active_captains : (callback)=>{
                        let activeConditions 		  = clone(captainConditions);
                        activeConditions.is_available = Constants.AVAILABLE;

                        /** Get total number of active captains **/
                        this.userCollectionDb.countDocuments(activeConditions).then(activeCaptainResult=>{
                            callback(null,activeCaptainResult);
                        }).catch(next);
                    },
                    not_active_captains : (callback)=>{
                        let notActiveConditions 		 = clone(captainConditions);
                        notActiveConditions.is_available = {$ne : Constants.AVAILABLE};

                        /** Get total number of not active captains **/
                        this.userCollectionDb.countDocuments(notActiveConditions).then(notActiveCaptainResult=>{
                            callback(null,notActiveCaptainResult);
                        }).catch(next);
                    },
                    free_captains : (callback)=>{
                        let freeConditions 			= clone(captainConditions);
                        freeConditions.is_available = Constants.AVAILABLE;
                        freeConditions["$or"] 		= [
                            {order_status: {$exists: false} },
                            {order_status: Constants.ORDER_DRIVER_FREE },
                        ];

                        /** Get total number of free captains **/
                        this.userCollectionDb.countDocuments(freeConditions).then(freeCaptainResult=>{
                            callback(null,freeCaptainResult);
                        }).catch(next);
                    },
                    assigned_captains : (callback)=>{
                        let assignConditions 				= clone(captainConditions);
                        assignConditions.is_available		= Constants.AVAILABLE;
                        assignConditions["orders.status"]	= Constants.ORDER_DRIVER_ASSIGNED;

                        /** Get total number of assigned captains **/
                        this.userCollectionDb.countDocuments(assignConditions).then(captainResult=>{
                            callback(null,captainResult);
                        }).catch(next);
                    },
                    way_to_restaurant_captains : (callback)=>{
                        let arrivedConditions 				= clone(captainConditions);
                        arrivedConditions.is_available		= Constants.AVAILABLE;
                        arrivedConditions["orders.status"]  = Constants.ORDER_DRIVER_ACCEPTED;

                        /** Get total number of way to restaurant captains **/
                        this.userCollectionDb.countDocuments(arrivedConditions).then(arrivedCaptainResult=>{
                            callback(null,arrivedCaptainResult);
                        }).catch(next);
                    },
                    arrived_at_restaurant_captains : (callback)=>{
                        let arrivedConditions 				= clone(captainConditions);
                        arrivedConditions.is_available		= Constants.AVAILABLE;
                        arrivedConditions["orders.status"]  = Constants.ORDER_DRIVER_ARRIVED_AT_RESTAURANT;

                        /** Get total number of arrived at restaurant captains **/
                        this.userCollectionDb.countDocuments(arrivedConditions).then(arrivedCaptainResult=>{
                            callback(null,arrivedCaptainResult);
                        }).catch(next);
                    },
                    way_to_customer_captains : (callback)=>{
                        let arrivedConditions 				= clone(captainConditions);
                        arrivedConditions.is_available		= Constants.AVAILABLE;
                        arrivedConditions["orders.status"]  = Constants.ORDER_DRIVER_WAY_TO_CUSTOMER;

                        /** Get total number of way to customer captains **/
                        this.userCollectionDb.countDocuments(arrivedConditions).then(arrivedCaptainResult=>{
                            callback(null,arrivedCaptainResult);
                        }).catch(next);
                    },
                    arrived_at_customer_location_captains : (callback)=>{
                        let arrivedConditions 				= clone(captainConditions);
                        arrivedConditions.is_available		= Constants.AVAILABLE;
                        arrivedConditions["orders.status"]  = Constants.ORDER_DRIVER_ARRIVED_AT_CUSTOMER_LOCATION;

                        /** Get total number of arrived at customer location captains **/
                        this.userCollectionDb.countDocuments(arrivedConditions).then(arrivedCaptainResult=>{
                            callback(null,arrivedCaptainResult);
                        }).catch(next);
                    }
                },(asyncParallelErr, asyncParallelResponse)=>{
                    if(asyncParallelErr) return next(asyncParallelErr);

                    return resolve({
                        active_captains 	: asyncParallelResponse.active_captains,
                        not_active_captains : asyncParallelResponse.not_active_captains,
                        free_captains 		: asyncParallelResponse.free_captains,
                        arrived_at_customer_location_captains : asyncParallelResponse.arrived_at_customer_location_captains,
                        way_to_customer_captains : asyncParallelResponse.way_to_customer_captains,
                        arrived_at_restaurant_captains : asyncParallelResponse.arrived_at_restaurant_captains,
                        way_to_restaurant_captains : asyncParallelResponse.way_to_restaurant_captains,
                        assigned_captains : asyncParallelResponse.assigned_captains,
                    });
                });
            } catch (error) {
                next(error);
            }
        }).catch(next);
	};

   /**
     * Function to update suspend status
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return redirect to list
     */
    async updateSuspendStatus(req, res, next) {
        try {
            let driverId = new ObjectId(req.params.id);
            let suspendStatus = (req.params.status == Constants.SUSPEND) ? Constants.UNSUSPEND : Constants.SUSPEND;

            /** Manage update data */
            let updateData = {
                $set: {
                    is_suspend: suspendStatus,
                    modified: getUtcDate()
                }
            };

            if (suspendStatus == Constants.UNSUSPEND) {
                updateData["$unset"] = { is_highlight: 1 };
            }

            /** Update driver details */
            await this.userCollectionDb.updateOne({ _id: driverId }, updateData);

            /** Send success response **/
            let message = (suspendStatus) ? res.__("admin.captain_tracking.captain_mark_as_suspended") : res.__("admin.captain_tracking.captain_mark_as_unsuspended");
            req.flash(Constants.STATUS_SUCCESS, message);
            res.redirect(Constants.WEBSITE_ADMIN_URL + "captain_tracking");
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to add ticket comment
     *
     * @param req	As Request Data
     * @param res	As Response Data
     *
     * @return render
     */
    async addTicketComment(req, res, next) {
        /** Render ticket comment section  */
		res.render('add_comment', {
			layout: false,
			ticket_id: req.params.ticket_id,
		});
    }

    /**
     * Function to get assign captain list
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render
     */
    async assignCaptainList(req, res, next) {
        try {
            let authUserRoleId	= 	req.session.user.user_role_id;
            let orderId			= 	new ObjectId(req.params.order_id);
            let isTeamHead		=	(req.session.user.team_head) 	? req.session.user.team_head	:false;

            /** Get order details */
            let orderList = await this.db.collection(Tables.ORDERS).aggregate([
                {$match: {
                    _id 			: 	orderId,
                    is_confirm 		: 	true,
                    delivery_type 	: 	Constants.DELIVERY_BY_CRAVEZ,
                    $and 			:	[
                        {is_completed: {$exists  :false }},
                        {is_completed: {$ne 	 :true }},
                    ]
                }},
                {$lookup: {	/** Get branch details **/
                    from 		:	Tables.RESTAURANT_BRANCHES,
                    localField  :	"branch_id",
                    foreignField:	"_id",
                    as 		  	:	"branch_details"
                }},
                {$project: {
                    _id:1, branch_area_id: {$arrayElemAt: ["$branch_details.area_id",0]}
                }},
            ]).toArray();

            /** Send error response */
            if(!orderList.length) return res.status(400).send({ status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") });

            let orderDetils     =   orderList[0];
            let deliveryAreaId	= 	orderDetils?.branch_area_id || '';

            /** Set area conditions */
            let areaConditions 	= 	{is_active: Constants.ACTIVE};

            /** Add fleet conditions */
            if(authUserRoleId == Constants.FLEET && !isTeamHead){
                let fleetAreaIds = await getAreaIdsBasedOnFleetRole(req, res, next);

                areaConditions= {...{_id: {$in: arrayToObject(fleetAreaIds)}}, ...areaConditions};
            }

            asyncParallel({
                total_captains:(childCallback)=>{
                    /** Get driver ids */
                    const driver_in_out_shifts	= this.db.collection(Tables.DRIVER_IN_OUT_SHIFTS);
                    driver_in_out_shifts.distinct("driver_id",{type : Constants.IN_SHIFT}).then(driverIds=>{
                        let driverCount = (driverIds) ? driverIds.length :0;
                        childCallback(null,driverCount);
                    }).catch(next);
                },
                area_list:(childCallback)=>{
                    /**Get dropdown list **/
                    getDropdownList(req,res, next,{
                        collections :[{
                            collection 	: Tables.AREAS,
                            columns    	: ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
                            conditions 	: areaConditions
                        }],
                    }).then(dropDownResponse=> {
                        childCallback(null, dropDownResponse?.final_html_data?.[0] || "" );
                    }).catch(next);
                },
            },(err, response)=>{
                if(err) return next(err);

                /** render assign captain page **/
                res.render('assign_captain',{
                    layout			:	false,
                    order_id		: 	orderId,
                    area_list		: 	response.area_list,
                    total_captains	: 	response?.total_captains || Constants.ADMIN_LISTING_LIMIT,
                    branch_area_id	: 	deliveryAreaId
                });
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to order reassign to captain
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return response
     */
    async orderReassignToCaptain(req, res, next) {
        try {
            req.body 				= 	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
            let orderId				= 	(req.body.order_id) 			?	new ObjectId(req.body.order_id) 		:'';
            let captainId			= 	(req.body.captain_id) 			? 	new ObjectId(req.body.captain_id) 		:'';
            let distanceInMinutes	=	(req.body.distance_in_minutes) 	?	parseInt(req.body.distance_in_minutes) 	:'';
            let authRoleId 			= 	req.session.user.user_role_id;
            let authId 	  			= 	req.session.user._id;

            /** Set order conditions */
            let orderConditions = {
                _id 			: 	orderId,
                is_confirm 		: 	true,
                delivery_type 	: 	Constants.DELIVERY_BY_CRAVEZ,
                is_completed	: 	{$ne:true }
            };

            /** Get order details  */
            const orders = this.db.collection(Tables.ORDERS);
            let orderResult = await orders.findOne(orderConditions,{projection: {order_assignment_process_time:1}});

            /** Send error response */
            if(!orderResult) return res.send({status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") });

            /** Send error response */
            if(orderResult?.order_assignment_process_time) return res.send({status: Constants.STATUS_ERROR, message: res.__("admin.orders.already_assignment_process_running") });


            /** Undo order assignment **/
            let undoRespnose = await this.orderTrackingModule.undoOrderAssignment(req, res, next, {
                order_id 	: orderId,
                user_id 	: authId,
                user_role_id: authRoleId,
            });

            if(undoRespnose.status==Constants.STATUS_ERROR) return res.send(undoRespnose);

            /** Reassign order **/
            let assignRespnose = await this.orderTrackingModule.assignOrderToCaptain(req, res, next, {
                order_id 			: orderId,
                captain_id 			: captainId,
                distance_in_minutes : distanceInMinutes,
                user_id 			: authId,
                user_role_id 		: authRoleId,
            });

            if(assignRespnose.status==Constants.STATUS_ERROR) return res.send(assignRespnose);

            /** Send success response **/
            let msg = res.__("admin.captain_tracking.order_reassigned_successfully");
            req.flash(Constants.STATUS_SUCCESS,msg);
            res.send({status: Constants.STATUS_SUCCESS, message: msg});
        } catch (error) {
            next(error);
        }
    }
}

export default CaptainTracking;
