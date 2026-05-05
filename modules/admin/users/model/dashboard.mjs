import clone from 'clone';
import * as Constants from "../../../../config/global_constant.mjs";
import * as Helper from "../../../../utils/index.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { parallel as asyncParallel } from 'async';
import { ObjectId } from 'mongodb';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

export default class Dashboard {
    constructor(db) {
        this.db = db;
    }

    async dashboard(req, res, next){
        /** Set breadcrumbs */
        req.breadcrumbs(BREADCRUMBS["admin/dashboard"]);

        /** Get dashboard data */
        switch(req?.session?.user?.user_role_id) {
            case Constants.CRAVEZ:
            case Constants.FINANCE_TEAM:
                this.cravezDashboard(req, res, next).then(response => {
                    let dashboardData = (response.result) ? response.result : {};

                    /**Render dashboard page*/
                    res.render("dashboard/cravez_dashboard", {
                        total_orders: dashboardData.total_orders,
                        orders_on_the_way: dashboardData.orders_on_the_way,
                        orders_at_restaurant: dashboardData.orders_at_restaurant,
                        pending_orders: dashboardData.pending_orders,
                        total_rejected_orders: dashboardData.total_rejected_orders,
                        total_delivered_orders: dashboardData.total_delivered_orders,
                        total_cancelled_orders: dashboardData.total_cancelled_orders,
                        active_customers: dashboardData.active_customers,
                        inactive_customers: dashboardData.inactive_customers,
                        recent_customers: dashboardData.recent_customers,
                        blacklisted_customers: dashboardData.blacklisted_customers,
                        total_restaurants: dashboardData.total_restaurants,
                        total_branches: dashboardData.total_branches,
                        active_captains: dashboardData.active_captains,
                        inactive_captains: dashboardData.inactive_captains,
                        total_captains: dashboardData.total_captains,
                        captain_on_vacation: dashboardData.captain_on_vacation.vacation_count,
                        total_delayed_orders: dashboardData.total_delayed_orders,
                        cash_orders: dashboardData.cash_orders,
                        online_orders: dashboardData.online_orders,
                        total_due_payment: dashboardData.total_due_payment,
                        total_paid_payment: dashboardData.total_paid_payment,
                        sales_chart: dashboardData.sales_chart,
                        total_turnover: dashboardData.total_turnover,
                        delivery_by_cravez_orders: dashboardData.delivery_by_cravez_orders,
                        delivery_by_restaurant_orders: dashboardData.delivery_by_restaurant_orders,
                    });
                });
                break;
            case Constants.CONTENT_TEAM:
                this.contentTLDashboard(req, res, next).then(response => {
                    /** Render to content dashbord page */
                    res.render("dashboard/content_tl_dashboard", {
                        result: response?.result || {},
                        login_details: response?.login_details || {},
                        get_schedule_list: response?.get_schedule_list || {},
                        leave_type_list: response?.leave_type_list || {},
                    });
                });
                break;
            case Constants.QA_TEAM:
                this.qaDashboard(req, res, next).then(response => {
                    /** Render to qa dashbord page */
                    res.render("dashboard/qa_dashboard", {
                        result: response?.result || {},
                        login_details: response?.login_details || {},
                        get_schedule_list: response?.get_schedule_list || {},
                        leave_type_list: response?.leave_type_list || {},
                    });
                });
                break;
            case Constants.SALES_TEAM:
                this.salesDashboard(req, res, next).then(response => {
                    /** Render to sales dashbord page */
                    res.render("dashboard/sales_dashboard", {
                        result: response?.result || {},
                        login_details: response?.login_details || {},
                        get_schedule_list: response?.get_schedule_list || {},
                        leave_type_list: response?.leave_type_list || {},
                    });
                });
                break;
            case Constants.MARKETING_TEAM:
                this.marketingDashboard(req, res, next).then(response => {
                    /** Render to marketing dashbord page */
                    res.render("dashboard/marketing_dashboard", {
                        result: response?.result || {},
                        login_details: response?.login_details || {},
                        get_schedule_list: response?.get_schedule_list || {},
                        leave_type_list: response?.leave_type_list || {},
                        total_agents_on_leaves: response?.total_agents_on_leaves || [],
                        agents_info: response?.agents_info || {},
                    });
                });
                break;
            case Constants.FLEET:
                this.fleetDashboard(req, res, next).then(response => {
                    /** Render to fleet dashbord page */
                    res.render("dashboard/fleet_dashboard", {
                        result: response?.result || {},
                        login_details: response?.login_details || {},
                        get_schedule_list: response?.get_schedule_list || {},
                        leave_type_list: response?.leave_type_list || {},
                    });
                });
                break;
            case Constants.BACK_OFFICE_TEAM:
                this.backOfficeDashboard(req, res, next).then(response => {
                    /** Render to back office dashbord page */
                    res.render("dashboard/back_office_dashboard", {
                        result: response?.result || {},
                        login_details: response?.login_details || {},
                        get_schedule_list: response?.get_schedule_list || {},
                        leave_type_list: response?.leave_type_list || {},
                        total_agents_on_leaves: response?.total_agents_on_leaves || [],
                        agents_info: response?.agents_info || {},
                    });
                });
                break;
            case Constants.SUPERVISOR:
                this.supervisorDashboard(req, res, next).then(response => {
                    /** Render to supervisor dashbord page */
                    res.render("dashboard/supervisor_dashboard", {
                        result: response?.result || {},
                    });
                });
                break;
            default:
                this.callCenterDashboard(req, res, next).then(response => {
                    /** Render to call center dashbord page */
                    res.render("dashboard/call_center_dashboard", {
                        result: response?.result || {},
                        login_details: response?.login_details || {},
                        get_schedule_list: response?.get_schedule_list || {},
                        leave_type_list: response?.leave_type_list || {},
                        total_agents_at_not_ready: response?.total_agents_at_not_ready || [],
                        break_type_list: response?.break_type_list || {},
                        total_agents_on_leaves: response?.total_agents_on_leaves || [],
                        agents_info: response?.agents_info || {},
                    });
                });
                break;
        }
    };

    async cravezDashboard(req, res, next){
        return new Promise(resolve=>{
            try{
                const users =	this.db.collection(Tables.USERS);
                const orders =	this.db.collection(Tables.ORDERS);                
                asyncParallel({
                    order_stats :(callback)=>{                         
                        /** Get orders stats **/
                        orders.aggregate([
                            {$group: {
                                _id: null,
                                total_orders : {$sum: 1},
                                total_rejected_orders: { $sum: 
                                    {$cond: [
                                        {$or: [
                                            {$eq: ["$admin_status", Constants.ORDER_REJECTED]},
                                            {$eq: ["$admin_status", Constants.ORDER_REJECTED_BY_ADMIN]},
                                        ]},
                                        1, 0
                                    ]}},
                                total_delayed_orders: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            {$eq: ["$is_delayed", true]},
                                        ]},
                                        1, 0
                                    ]}},
                                pending_orders: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            { $eq: ["$admin_status", Constants.ORDER_PENDING] }, 
                                            { $eq: ["$is_confirm", false] }, 
                                        ]},
                                        1, 0
                                    ]}},
                                orders_at_restaurant: { $sum: 
                                    {$cond: [
                                        {$or: [
                                            {$eq: ["$admin_status", Constants.ORDER_PREPARING]},
                                            {$eq: ["$admin_status", Constants.ORDER_READY_TO_PICK_UP]},
                                        ]},
                                        1, 0
                                    ]}},
                                orders_on_the_way: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            { $eq: ["$admin_status", Constants.ORDER_ON_THE_WAY] }, 
                                        ]},
                                        1, 0
                                    ]}},
                                total_delivered_orders: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            { $eq: ["$admin_status", Constants.ORDER_DELIVERED] }, 
                                        ]},
                                        1, 0
                                    ]}},
                                total_cancelled_orders: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            { $eq: ["$admin_status", Constants.ORDER_CANCELLED] }, 
                                        ]},
                                        1, 0
                                    ]}},
                                cash_orders: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            { $eq: ["$admin_status", Constants.ORDER_DELIVERED] }, 
                                            { $eq: ["$payment_method", Constants.CASH_PAYMENT] }, 
                                        ]},
                                        1, 0
                                    ]}},
                                online_orders: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            { $eq: ["$admin_status", Constants.ORDER_DELIVERED] }, 
                                            { $ne: ["$payment_method", Constants.CASH_PAYMENT] }, 
                                        ]},
                                        1, 0
                                    ]}},
                                total_due_payment: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            { $ne: ["$is_settlement", true] }, 
                                            { $gt: ["$restaurant_payout", 0] }, 
                                        ]},
                                        "$restaurant_payout", 0
                                    ]}},
                                total_paid_payment: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            { $eq: ["$is_settlement", true] }, 
                                            { $gt: ["$restaurant_payout", 0] }, 
                                        ]},
                                        "$restaurant_payout", 0
                                    ]}},
                                delivery_by_cravez_orders: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            { $eq: ["$delivery_type", Constants.DELIVERY_BY_CRAVEZ] }, 
                                        ]},
                                        1, 0
                                    ]}},
                                delivery_by_restaurant_orders: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            { $eq: ["$delivery_type", Constants.DELIVERY_BY_RESTAURANT] }, 
                                        ]},
                                        1, 0
                                    ]}},
                                total_total_payout: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            { $ne: ["$admin_status", Constants.ORDER_DELIVERED] }, 
                                            { $gt: ["$cravez_payout", 0] }, 
                                        ]},
                                        "$cravez_payout", 0
                                    ]}},
                                total_delivery_fee: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            { $ne: ["$delivery_type", Constants.DELIVERY_BY_CRAVEZ] }, 
                                            { $gt: ["$delivery_fee", 0] }, 
                                        ]},
                                        "$delivery_fee", 0
                                    ]}}, 
                            }}
                        ]).toArray().then(res =>{
                            let odStats = {
                                ...res?.[0] || {},
                                total_turnover : Helper.round((res?.[0]?.total_delivery_fee || 0) + (res?.[0]?.total_total_payout || 0))
                            }
                            callback(null, odStats);
                        }).catch(next); 
                    },
                    customer_stats :(callback)=>{                         
                        /** Get customer stats **/
                        users.aggregate([
                            {$match: Constants.CUSTOMER_COMMON_CONDITIONS},
                            {$group: {
                                _id: null,
                                active_customers : {$sum: 1},
                                blacklisted_customers: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            {$eq: ["$is_black_list", true]},
                                        ]},
                                        1, 0
                                    ]}},
                                recent_customers: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            {$gte: ["$created", Helper.newDate(Helper.subtractDate(Constants.RECENT_CUSTOMER_DAYS*Constants.HOURS_IN_A_DAY))]},
                                            {$lte: ["$created", Helper.newDate()]},
                                        ]},
                                        1, 0
                                    ]}},                                                           
                            }}
                        ]).toArray().then(res =>{
                            callback(null, res?.[0] || {});
                        }).catch(next); 
                    },
                    inactive_customers : (callback)=>{
                        let customerConditions			=	clone(Constants.CUSTOMER_COMMON_CONDITIONS);
                        customerConditions["active"]	=	Constants.DEACTIVE;
                        
                        /** Get total number of inactive customers **/
                        users.countDocuments(customerConditions).then(inactiveCustomerResult=>{
                            callback(null, inactiveCustomerResult);
                        }).catch(next);
                    },
                    total_restaurants : (callback)=>{
                        /** Get total number of restaurants **/
                        const restaurants =	this.db.collection(Tables.RESTAURANTS);
                        restaurants.countDocuments({is_deleted: Constants.NOT_DELETED}).then(restaurantsResult=>{
                            callback(null, restaurantsResult);
                        }).catch(next);
                    },
                    total_branches : (callback)=>{
                        /** Get total number of branches **/
                        const restaurant_branches =	this.db.collection(Tables.RESTAURANT_BRANCHES);
                        restaurant_branches.countDocuments({}).then(branchesResult=>{
                            callback(null, branchesResult);
                        }).catch(next);
                    },
                    total_captains : (callback)=>{
                        let driverConditions=	clone(Constants.DRIVER_COMMON_CONDITIONS);
                        if(driverConditions.active) delete driverConditions.active;

                        /** Get total number of captains **/
                        users.countDocuments(driverConditions).then(totalCaptainResult=>{
                            callback(null, totalCaptainResult);
                        }).catch(next);
                    },
                    captain_on_vacation :(callback)=>{
                        /** Set conditions for captains on vacation **/
                        let conditions	=	{
                            "date"	:	{
                                $gte 	: Helper.newDate(Helper.newDate('',Constants.DATABASE_DATE_FORMAT+" "+Constants.START_DATE_TIME_FORMAT)),
                                $lte 	: Helper.newDate(Helper.newDate('',Constants.DATABASE_DATE_FORMAT+" "+Constants.END_DATE_TIME_FORMAT)),
                            },
                            "leave_type" : {$exists : true,$ne : "" },
                        };

                        /** Get list of captains on vacation **/
                        const driver_availabilities = this.db.collection(Tables.DRIVER_AVAILABILITIES);
                        driver_availabilities.distinct("user_id",conditions).then(vacationResult=>{
                            
                            /** Get total number of captains on vacation **/
                            let driverConditions	=	clone(Constants.DRIVER_COMMON_CONDITIONS);
                            driverConditions["_id"]	=	{$in : vacationResult};
                            users.countDocuments(driverConditions).then(userResult=>{
                                callback(null, {
                                    vacation_ids: vacationResult,
                                    vacation_count: userResult,
                                });
                            }).catch(next);
                        }).catch(next);
                    },                    
                    sales_chart : (callback)=>{
                        /** Get list of cravez payout month wise **/
                        orders.aggregate([
                            {$group	: {
                                _id	: {
                                    "year"	: { $dateToString: { format: "%Y", date: "$order_date", timezone: Constants.        DEFAULT_TIME_ZONE }},
                                },
                                total_cravez_payout : {$sum : "$cravez_payout"}
                            }},
                            {$sort: {_id : Constants.SORT_DESC}}
                        ]).toArray().then(salesResult=>{
                            callback(null, salesResult);
                        }).catch(next);
                    },
                },(err, response)=>{
                    if(err) return next(err);
                    
                    let vacationCaptains =	response?.captain_on_vacation?.vacation_ids ||[];
                    asyncParallel({
                        inactive_captains : (callback)=>{
                            let driverConditions		=	clone(Constants.DRIVER_COMMON_CONDITIONS);
                            driverConditions["active"]	=	Constants.DEACTIVE;
                            
                            /** Get total number of inactive captains not on vacation **/
                            users.countDocuments(driverConditions).then(inactiveCaptainResult=>{
                                callback(null, inactiveCaptainResult);
                            }).catch(next);
                        },
                        active_captains :(callback)=>{
                            /** Set conditions **/
                            let driverConditions	=	clone(Constants.DRIVER_COMMON_CONDITIONS);
                            driverConditions['_id']	=	{$nin : vacationCaptains};
                            
                            /** Get total number of active captains not on vacation **/
                            users.countDocuments(driverConditions).then(activeCaptainResult=>{
                                callback(null, activeCaptainResult);
                            }).catch(next);
                        },
                    },(childErr, childResponse)=>{
                        if(childErr) return next(childErr);

                        let finalResponse = Object.assign(response,childResponse,response?.order_stats || {},response?.customer_stats || {});
                        resolve({status : Constants.STATUS_SUCCESS,result : finalResponse});
                    });
                });
            }catch(error){
               return  next(error);
            }
		}).catch(next);
    };

    /**
	 * For get assign or self overtime requests, members on vacation and members stats
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return array to dashboard data
	 */
    async memberStats(req, res, next){
        try {
            let authId		= new ObjectId(req.session.user._id);
			let teamHead	= req?.session?.user?.team_head	 || false;

            const [overtime_requests, member_on_vacation, members_stats] = await Promise.all([
                // Inline: Count overtime requests
                this.db.collection(Tables.OVERTIME_REQUESTS).countDocuments({ parent_id: authId }),
    
                // Inline: Count members on vacation
                this.db.collection(Tables.TEAM_AVAILABILITIES).countDocuments({
                    parent_id: authId,
                    leave_type: { $exists: true },
                    date: {
                        $gte: Helper.newDate(Helper.newDate('', Constants.DATABASE_DATE_FORMAT + " " + Constants.START_DATE_TIME_FORMAT)),
                        $lte: Helper.newDate(Helper.newDate('', Constants.DATABASE_DATE_FORMAT + " " + Constants.END_DATE_TIME_FORMAT)),
                    }
                }),
    
                // Inline: Members stats (as async IIFE)
                (async () => {
                    if (!teamHead) return {};
    
                    const result = await this.db.collection(Tables.USERS).aggregate([
                        { $match: { parent_id: authId, is_deleted: Constants.NOT_DELETED } },
                        {
                            $group: {
                                _id: null,
                                total_members: { $sum: 1 },
                                active_members: {
                                    $sum: { $cond: [{ $eq: ["$active", Constants.ACTIVE] }, 1, 0] }
                                },
                                deactive_members: {
                                    $sum: { $cond: [{ $eq: ["$active", Constants.DEACTIVE] }, 1, 0] }
                                }
                            }
                        }
                    ]).toArray();
    
                    return result?.[0] || {};
                })()
            ]);

            return {
                status: Constants.STATUS_SUCCESS,
                result : {
                    overtime_requests,
                    member_on_vacation,
                    members_stats
                }
            };
        } catch (error) {
            next(error);
        }
    };

    /**
	 * For get content team dashboard data
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return array to dashboard data
	 */
    async contentTLDashboard(req, res, next){
        try{
            let authId		= new ObjectId(req.session.user._id);
			let teamHead	= req?.session?.user?.team_head	 || false;
			let currentDate = Helper.newDate("",Constants.DATABASE_DATE_FORMAT);
			let startDate   = Helper.getUtcDate(currentDate+" "+Constants.START_DATE_TIME_FORMAT);
			let endDate  	= Helper.getUtcDate(currentDate+" "+Constants.END_DATE_TIME_FORMAT);
			const restaurant_menus     = this.db.collection(Tables.RESTAURANT_MENUS);
			const tmp_restaurant_menus = this.db.collection(Tables.TMP_RESTAURANT_MENUS);

            const [
                approved_restaurants,
                restaurant_requests,
                members_stats,
                menu_requests,
                approved_menu,
                total_menu,
                category_requests,
                approved_category,
                ticket_counts,
                login_details,
                get_schedule_list,
                item_requests,
                approved_item,
                leave_type_list,
                total_agents_at_not_ready,
                break_type_list,
                total_agents_on_leaves,
                agents_info,
                branch_requests,
                approved_branch
            ] = await Promise.all([
                // 1. Approved restaurants
                this.db.collection(Tables.RESTAURANTS).countDocuments({ is_deleted: Constants.NOT_DELETED }),
    
                // 2. Restaurant requests aggregation
                this.db.collection(Tables.RESTAURANT_ENQUIRIES).aggregate([
                    { $match: { is_deleted: Constants.NOT_DELETED } },
                    { $group: {
                        _id: null,
                        pending_restaurant: { $sum: 
                            {$cond: [
                                {$and: [
                                    { $in: ["$approval_status", [Constants.PENDING]] }, 
                                    { $eq: ["$team_approval_status", Constants.APPROVED] }
                                ]},
                                1, 0
                            ]}},
                        in_review_restaurant: { $sum: 
                            { $cond: [
                                {$and: [
                                    { $eq: ["$approval_status", Constants.IN_REVIEW] }, 
                                    { $eq: ["$team_approval_status", Constants.APPROVED] }
                                ]}, 
                                1, 0
                            ]}},
                        rejected_restaurant: { $sum: 
                            { $cond: [
                                {$and: [
                                    { $eq: ["$approval_status", Constants.REJECTED] }, 
                                    { $eq: ["$team_approval_status", Constants.APPROVED] }
                                ]}, 
                                1, 0
                            ]}}
                    }}
                ]).toArray().then(res => res?.[0] || {}),
    
                // 3. Members stats
                this.memberStats(req, res, next).then(response => response?.result || {}),
    
                // 4. Menu requests
                tmp_restaurant_menus.aggregate([
                    { $match: {} },
                    { $group: {
                        _id: null,
                        pending_menu:   { $sum: { $cond: [{ $in: ["$status", [Constants.PENDING]] }, 1, 0] }},
                        in_review_menu: { $sum: { $cond: [{ $eq: ["$status", Constants.IN_REVIEW] }, 1, 0] }},
                        rejected_menu:  { $sum: { $cond: [{ $eq: ["$status", Constants.REJECTED] }, 1, 0] }}
                    }}
                ]).toArray().then(res => res?.[0] || {}),
    
                // 5. Approved menu count
                restaurant_menus.countDocuments({}),
    
                // 6. Total menu (approved + pending)
                (async () => {
                    const menuIds = await restaurant_menus.distinct("_id");
                    const tmpMenuCount = await tmp_restaurant_menus.countDocuments({ _id: { $nin: menuIds } });
                    return (menuIds?.length || 0) + tmpMenuCount;
                })(),
    
                // 7. Category requests
                this.db.collection(Tables.TMP_RESTAURANT_CATEGORIES).aggregate([
                    { $match: {} },
                    { $group: {
                        _id: null,
                        pending:   { $sum: { $cond: [{ $eq: ["$status", Constants.PENDING] }, 1, 0] }},
                        in_review: { $sum: { $cond: [{ $eq: ["$status", Constants.IN_REVIEW] }, 1, 0] }},
                        rejected:  { $sum: { $cond: [{ $eq: ["$status", Constants.REJECTED] }, 1, 0] }}
                    }}
                ]).toArray().then(res => res?.[0] || {}),
    
                // 8. Approved categories
                this.db.collection(Tables.RESTAURANT_CATEGORIES).countDocuments({}),
    
                // 9. Ticket counts
                this.getTicketsCount(req, res, next).then(response => response?.result || {}),
    
                // 10. Login details from last 7 days
                this.getLoginDetails(req, res, next, {
                    fromDate: Helper.addOrSubtractDurationToDate({duration: Constants.DAYS_IN_A_WEEK * Constants.HOURS_IN_A_DAY, subtract: true}),
                    endDate: Helper.newDate()
                }).then(response => response || {}),
    
                // 11. Schedule list
                this.getUpcomingWeekList(req, res, next).then(response => response || {}),
    
                // 12. Item requests
                this.db.collection(Tables.TMP_ITEMS).aggregate([
                    { $match: { submit_for_approval: true } },
                    { $group: {
                        _id: null,
                        pending_item:   { $sum: { $cond: [{ $eq: ["$status", Constants.PENDING] }, 1, 0] }},
                        in_review_item: { $sum: { $cond: [{ $eq: ["$status", Constants.IN_REVIEW] }, 1, 0] }}
                    }}
                ]).toArray().then(res => res?.[0] || {}),
    
                // 13. Approved items
                this.db.collection(Tables.ITEMS).countDocuments({}),
    
                // 14. Leave type list
                Helper.getAttributes(req, res, next, { type: "vacation_leave_type" }).then(list => {
                    return list.reduce((acc, rec) => {
                        acc[String(rec.attribute_id)] = rec.title;
                        return acc;
                    }, {});
                }),
    
                // 15. Total agents at not ready (conditional)
                teamHead ? this.db.collection(Tables.TEAM_BREAKS).aggregate([
                    { $match: { parent_id: authId, date: { $gte: startDate, $lte: endDate } } },
                    { $group: { _id: "$break_type", total_count: { $sum: 1 } } }
                ]).toArray() : null,
    
                // 16. Break type list (conditional)
                teamHead ? Helper.getAttributes(req, res, next, { type: "break_type" }).then(list => {
                    return list.reduce((acc, rec) => {
                        acc[String(rec._id)] = rec.title;
                        return acc;
                    }, {});
                }) : null,
    
                // 17. Total agents on leave (conditional)
                teamHead ? this.db.collection(Tables.TEAM_AVAILABILITIES).aggregate([
                    { $match: { parent_id: authId, leave_type: { $ne: Constants.WEEKLY_OFF }, date: { $gte: startDate, $lte: endDate } } },
                    { $group: { _id: "$leave_type", total_count: { $sum: 1 } } }
                ]).toArray() : null,
    
                // 18. Agent info (conditional)
                teamHead ? this.db.collection(Tables.TEAM_AVAILABILITIES).aggregate([
                    { $match: { parent_id: authId, date: { $gte: startDate, $lte: endDate } } },
                    { $group: {
                        _id: null,
                        total_available_agents: { $sum: { $cond: [{ $or: [{ $ifNull: ["$leave_type", true] }, { $eq: ["$leave_type", ""] }] }, 1, 0] }},
                        total_agents_on_off_today: { $sum: { $cond: [{ $eq: ["$leave_type", Constants.WEEKLY_OFF] }, 1, 0] }}
                    }}
                ]).toArray().then(res => res?.[0] || {}) : null,
    
                // 19. Branch requests
                this.db.collection(Tables.TMP_RESTAURANT_BRANCHES).aggregate([
                    {$group: {
                        _id: null,
                        pending_branch: { $sum: { $cond: [{ $and: [{ $in: ["$status", [Constants.PENDING]] }, { $eq: ["$submit_for_approval", true] }] }, 1, 0] }},
                        in_review_branch: { $sum: { $cond: [{ $and: [{ $eq: ["$status", Constants.IN_REVIEW] }, { $eq: ["$submit_for_approval", true] }] }, 1, 0] }},
                        rejected_branch: { $sum: { $cond: [{ $eq: ["$status", Constants.REJECTED] }, 1, 0] }}
                    }}
                ]).toArray().then(res => res?.[0] || {}),
    
                // 20. Approved branches
                this.db.collection(Tables.RESTAURANT_BRANCHES).countDocuments({})
            ]);

            return {
                status: Constants.STATUS_SUCCESS,
                result: {
                    approved_restaurants,
                    restaurant_requests,
                    members_stats,
                    menu_requests,
                    approved_menu,
                    total_menu,
                    category_requests,
                    approved_category,
                    ticket_counts,
                    login_details,
                    get_schedule_list,
                    item_requests,
                    approved_item,
                    leave_type_list,
                    total_agents_at_not_ready,
                    break_type_list,
                    total_agents_on_leaves,
                    agents_info,
                    branch_requests,
                    approved_branch
                }
            };            
        } catch (error) {
          return next(error);
        }
    };

    /**
	 * For get call center dashboard data
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return array to dashboard data
	 */
    async callCenterDashboard(req, res, next){
        return new Promise(async resolve=>{
            try{
                let authId		= new ObjectId(req.session.user._id);
                let authRoleId	= req?.session?.user?.user_role_id || "";
                let teamHead	= req?.session?.user?.team_head	 || false;
                let currentDate = Helper.newDate("",Constants.DATABASE_DATE_FORMAT);
                let startDate   = Helper.getUtcDate(currentDate+" "+Constants.START_DATE_TIME_FORMAT);
                let endDate  	= Helper.getUtcDate(currentDate+" "+Constants.END_DATE_TIME_FORMAT);
                let assignmentConditions = null;

                if(authRoleId == Constants.CALL_CENTER_TEAM && !teamHead){
                    let assignmentResult  = await Helper.getConditionsBasedOnCallCenterRole(req,res,next);
                    assignmentConditions = assignmentResult?.conditions || [];
                }              

                const orders 		= this.db.collection(Tables.ORDERS);
                const voc_responses = this.db.collection(Tables.VOC_RESPONSES);
                const team_availabilities = this.db.collection(Tables.TEAM_AVAILABILITIES);
                asyncParallel({
                    ticket_counts :(callback)=>{
                        this.getTicketsCount(req, res, next).then(response=>{
                            let ticketCount = (response.result) ? response.result :{};
                            callback(null,ticketCount);
                        }).catch(next);
                    },
                    login_details :(callback)=>{
                        this.getLoginDetails(req, res, next,{
                            fromDate	:	Helper.subtractDate(Constants.DAYS_IN_A_WEEK*Constants.HOURS_IN_A_DAY),
                            endDate		:	Helper.newDate()
                        }).then(response=>{
                            callback(null,response);
                        }).catch(next);
                    },
                    get_schedule_list :(callback)=>{
                        this.getUpcomingWeekList(req, res, next).then(response=>{
                            callback(null,response);
                        }).catch(next);
                    },
                    members_stats :(callback)=>{
                        this.memberStats(req, res, next).then(response=>{
                            callback(null, response?.result || {});
                        }).catch(next);
                    },
                    total_agents_at_not_ready:(callback)=>{
                        if(!teamHead) return callback(null,null);

                        const team_breaks = this.db.collection(Tables.TEAM_BREAKS);
                        team_breaks.aggregate([
                            {$match	: {
                                parent_id:  authId,
                                date : {
                                    $gte: startDate, 
                                    $lte: endDate
                                }
                            }},
                            {$group	: {
                                _id	: "$break_type",
                                total_count : {$sum : 1},
                            }},
                        ]).toArray().then(agentResult=>{
                            callback(null, agentResult);
                        }).catch(next);
                    },
                    break_type_list:(callback)=>{
                        if(!teamHead) return callback(null,null);

                        /** Get leave type list **/
                        Helper.getAttributes(req,res,next,{type: "break_type"}).then(breakTypeList=>{

                            let tempBreakType = {};
                            if(breakTypeList?.length >0){
                                breakTypeList.map(records=>{
                                    tempBreakType[String(records._id)] = records.title;
                                });
                            }
                            callback(null, tempBreakType);
                        }).catch(next);
                    },
                    leave_type_list:(callback)=>{
                        /** Get leave type list **/
                        Helper.getAttributes(req,res,next,{type: "vacation_leave_type",is_show:true}).then(leaveTypeList=>{

                            let tempLeaveType = {};
                            if(leaveTypeList?.length >0){
                                leaveTypeList.map(records=>{
                                    tempLeaveType[String(records.attribute_id)] = records.title;
                                });
                            }
                            callback(null, tempLeaveType);
                        }).catch(next);
                    },
                    total_agents_on_leaves:(callback)=>{
                        if(!teamHead) return callback(null,null);
                        
                        team_availabilities.aggregate([
                            {$match	: {
                                parent_id 	:  authId,
                                leave_type 	: {$ne: Constants.WEEKLY_OFF},
                                date		: { $gte: startDate, $lte: endDate}
                            }},
                            {$group	: {
                                _id	: "$leave_type",
                                total_count : {$sum : 1},
                            }},
                        ]).toArray().then(leaveResult=>{
                            callback(null, leaveResult);
                        }).catch(next);
                    },
                    agents_info :(callback)=>{
                        if(!teamHead) return callback(null,null);

                        team_availabilities.aggregate([
                            {$match	: {
                                parent_id :  authId,
                                date: { $gte: startDate, $lte: endDate}
                            }},
                            {$group	: {
                                _id	: null,
                                total_available_agents : {$sum: {
                                    $cond: [
                                        {$or: [
                                            {$ifNull: ["$leave_type",true]},
                                            {$eq: ["$leave_type",""]}
                                        ]},
                                        1,
                                        0
                                    ]}
                                },
                                total_agents_on_off_today : {$sum : {
                                    $cond: [
                                        {$and: [
                                            { $eq: ["$leave_type",Constants.WEEKLY_OFF]}
                                        ]},
                                        1,
                                        0
                                    ]}
                                },
                            }}
                        ]).toArray().then(tmpResult=>{
                            callback(null, tmpResult?.[0] || {});
                        }).catch(next);
                    },
                    call_center_order:(callback)=>{
                        if(authRoleId != Constants.CALL_CENTER_TEAM) return callback(null,null);

                        /** Add call center task assignment conditions */
                        let commonConditions = {};
                        if(!teamHead && assignmentConditions?.length > 0) commonConditions["$or"] = assignmentConditions;

                        orders.aggregate([
                            {$match: commonConditions },
                            {$group: {
                                _id: null,
                                total_cancelled_orders: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            { $eq: ["$admin_status", Constants.ORDER_CANCELLED] }, 
                                        ]},
                                        1, 0
                                    ]}},
                                total_rejected_orders: { $sum: 
                                    {$cond: [
                                        {$or: [
                                            { $eq: ["$admin_status", Constants.ORDER_REJECTED] }, 
                                            { $eq: ["$admin_status", Constants.ORDER_REJECTED_BY_ADMIN] }
                                        ]},
                                        1, 0
                                    ]}},
                                total_delivered_orders: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            {$eq: ["$admin_status", Constants.ORDER_DELIVERED]},
                                        ]},
                                        1, 0
                                    ]}},
                                total_on_the_way_orders: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            {$eq: ["$admin_status", Constants.ORDER_ON_THE_WAY]},
                                        ]},
                                        1, 0
                                    ]}},
                                total_pick_up_orders: { $sum:  
                                    {$cond: [
                                        {$and: [
                                            {$eq: ["$admin_status", Constants.ORDER_READY_TO_PICK_UP]},
                                        ]},
                                        1, 0
                                    ]}},
                                total_preparing_orders: { $sum: 
                                    {$cond: [   
                                        {$and: [
                                            {$eq: ["$admin_status", Constants.ORDER_PREPARING]},
                                        ]},
                                        1, 0
                                    ]}},
                                total_pending_orders: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            { $eq: ["$admin_status", Constants.ORDER_PENDING] }, 
                                            { $eq: ["$is_confirm", false] }
                                        ]},
                                        1, 0
                                    ]}},
                                total_submitted_orders: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            { $eq: ["$admin_status", Constants.ORDER_PENDING] }, 
                                            { $eq: ["$is_confirm", true] }
                                        ]},
                                        1, 0
                                    ]}}
                            }}
                        ]).toArray().then(res =>{
                            callback(null, res?.[0] || {});
                        }).catch(next);                        
                    },
                    total_offers_counts :(callback)=>{
                        this.getOffersCount(req, res, next).then(response=>{
                            callback(null,response?.result || {});
                        }).catch(next);
                    },
                    total_client_voc : (callback)=>{
                        /** Get total client voc **/
                        voc_responses.countDocuments({
                            user_type : Constants.VOC_FOR_CLIENT,
                            order_id  : {$exists : true, $ne : ""}
                        }).then(vocClientResult=>{
                            callback(null, vocClientResult);
                        }).catch(next);
                    },
                    total_captain_voc : (callback)=>{
                        /** Get total captain voc **/
                        voc_responses.countDocuments({
                            user_type : Constants.VOC_FOR_CAPTAIN,
                            order_id  : {$exists : true, $ne : ""}
                        }).then(vocCaptainResult=>{
                            callback(null,vocCaptainResult);
                        }).catch(next);
                    },
                    total_refund_requests : (callback)=>{
                        /** Get total refund requests **/
                        const payment_refund_logs = this.db.collection(Tables.PAYMENT_REFUND_LOGS);
                        payment_refund_logs.countDocuments({
                            refund_activity_type : Constants.DIRECT_REFUND,
                            order_id : {$exists : true, $ne : ""}
                        }).then(paymentRefundResult=>{
                            callback(null,paymentRefundResult);
                        }).catch(next);
                    },
                    total_order_modification_requests : (callback)=>{
                        /** Get total order modification requests **/
                        const order_modify_logs = this.db.collection(Tables.ORDER_MODIFY_LOGS);
                        order_modify_logs.countDocuments({}).then(modifyResult=>{
                            callback(null,modifyResult);
                        }).catch(next);
                    },
                },(asyncErr, asyncResponse)=>{

                    /** Send success respone */
                    resolve({
                        status : Constants.STATUS_SUCCESS,
                        result : asyncResponse
                    });
                });		
            } catch (error) {
                return next(error);
            }
		}).catch(next);
    };

    /**
	 * For get qa dashboard data
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return array to dashboard data
	 */
    async qaDashboard(req, res, next){
        return new Promise(async resolve=>{
            try{
                let authId		= new ObjectId(req.session.user._id);
                let teamHead	= req?.session?.user?.team_head || false;
                let currentDate = Helper.newDate("",Constants.DATABASE_DATE_FORMAT);
                let startDate   = Helper.getUtcDate(currentDate+" "+Constants.START_DATE_TIME_FORMAT);
                let endDate  	= Helper.getUtcDate(currentDate+" "+Constants.END_DATE_TIME_FORMAT);

                const team_availabilities = this.db.collection(Tables.TEAM_AVAILABILITIES);
                asyncParallel({
                    ticket_counts :(callback)=>{
                        this.getTicketsCount(req, res, next).then(response=>{
                            callback(null,response?.result || {});
                        }).catch(next);
                    },
                    login_details :(callback)=>{
                        this.getLoginDetails(req, res, next,{
                            fromDate	:	Helper.subtractDate(Constants.DAYS_IN_A_WEEK*Constants.HOURS_IN_A_DAY),
                            endDate		:	Helper.newDate()
                        }).then(response=>{
                            callback(null,response);
                        }).catch(next);
                    },
                    get_schedule_list :(callback)=>{
                        this.getUpcomingWeekList(req, res, next).then(response=>{
                            callback(null,response);
                        }).catch(next);
                    },
                    members_stats :(callback)=>{
                        this.memberStats(req, res, next).then(response=>{
                            callback(null, response?.result || {});
                        }).catch(next);
                    },
                    leave_type_list:(callback)=>{
                        /** Get leave type list **/
                        Helper.getAttributes(req,res,next,{type: "vacation_leave_type"}).then(leaveTypeList=>{

                            let tempLeaveType = {};
                            if(leaveTypeList.length >0){
                                leaveTypeList.map(records=>{
                                    tempLeaveType[String(records.attribute_id)] = records.title;
                                });
                            }
                            callback(null, tempLeaveType);
                        }).catch(next);
                    },
                    total_agents_at_not_ready:(callback)=>{
                        if(!teamHead) return callback(null,null);

                        const team_breaks = this.db.collection(Tables.TEAM_BREAKS);
                        team_breaks.aggregate([
                            {$match	: {parent_id :  authId,date: { $gte: startDate, $lte: endDate}}},
                            {$group	: {
                                _id	: "$break_type",
                                total_count : {$sum : 1},
                            }},
                        ]).toArray().then(agentResult=>{
                            callback(null, agentResult);
                        }).catch(next);
                    },
                    break_type_list:(callback)=>{
                        if(!teamHead) return callback(null,null);

                        /** Get leave type list **/
                        Helper.getAttributes(req,res,next,{type: "break_type"}).then(breakTypeList=>{

                            let tempBreakType = {};
                            if(breakTypeList.length >0){
                                breakTypeList.map(records=>{
                                    tempBreakType[String(records._id)] = records.title;
                                });
                            }
                            callback(null, tempBreakType);
                        }).catch(next);
                    },
                    total_agents_on_leaves:(callback)=>{
                        if(!teamHead) return callback(null,null);

                        team_availabilities.aggregate([
                            {$match	: {
                                parent_id 	:  authId,
                                leave_type 	: {$ne: Constants.WEEKLY_OFF},
                                date		: {$gte: startDate, $lte: endDate}
                            }},
                            {$group	: {
                                _id	: "$leave_type",
                                total_count : {$sum : 1},
                            }},
                        ]).toArray().then(leaveResult=>{
                            callback(null, leaveResult);
                        }).catch(next);
                    },
                    agents_info :(callback)=>{
                        if(!teamHead) return callback(null,null);

                        team_availabilities.aggregate([
                            {$match	: {parent_id :  authId,date: { $gte: startDate, $lte: endDate}}},
                            {$group	: {
                                _id	: null,
                                total_available_agents : {$sum : {
                                    $cond: [
                                        {$or: [
                                            {$ifNull: ["$leave_type",true]},
                                            {$eq: ["$leave_type",""]}
                                        ]},
                                        1,
                                        0
                                    ]}
                                },
                                total_agents_on_off_today : {$sum : {
                                    $cond: [
                                        {$and: [
                                            { $eq: ["$leave_type",Constants.WEEKLY_OFF]}
                                        ]},
                                        1,
                                        0
                                    ]}
                                },
                            }}
                        ]).toArray().then(tmpResult=>{
                            callback(null, tmpResult?.[0] || {});
                        }).catch(next);
                    },
                },(asyncErr, asyncResponse)=>{

                    /** Send success respone */
                    resolve({
                        status : Constants.STATUS_SUCCESS,
                        result : asyncResponse
                    });
                });
            } catch (error) {
                return next(error);
            }
		}).catch(next);
    };

    /**
	 * For get sales dashboard data
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return array to dashboard data
	 */
    async salesDashboard(req, res, next){
        return new Promise(async resolve=>{
            try{
                let authId		= new ObjectId(req.session.user._id);
                let teamHead	= req?.session?.user?.team_head || false;
                let currentDate = Helper.newDate("",Constants.DATABASE_DATE_FORMAT);
                let startDate   = Helper.getUtcDate(currentDate+" "+Constants.START_DATE_TIME_FORMAT);
                let endDate  	= Helper.getUtcDate(currentDate+" "+Constants.END_DATE_TIME_FORMAT);

                const team_availabilities = this.db.collection(Tables.TEAM_AVAILABILITIES);
                asyncParallel({
                    approved_restaurants :(callback)=>{
                        const restaurants = this.db.collection(Tables.RESTAURANTS);
                        restaurants.countDocuments({is_deleted:Constants.NOT_DELETED}).then(count=>{
                            callback(null, count);
                        }).catch(next);
                    },
                    restaurant_requests :(callback)=>{
                        const restaurant_enquiries = this.db.collection(Tables.RESTAURANT_ENQUIRIES);
                        restaurant_enquiries.aggregate([
                            {$match	: {is_deleted:Constants.NOT_DELETED}},
                            {$group	: {
                                _id	: null,
                                pending_restaurant : {$sum : {
                                    $cond: [
                                        {$and: [
                                            { $eq : ["$team_approval_status",Constants.PENDING] }
                                        ]},
                                        1,
                                        0
                                    ]}
                                },
                                in_review_restaurant : {$sum : {
                                    $cond: [
                                        {$and: [
                                            { $eq : ["$approval_status",Constants.IN_REVIEW] }
                                        ]},
                                        1,
                                        0
                                    ]}
                                },
                                rejected_restaurant : {$sum : {
                                    $cond: [
                                        {$and: [
                                            { $eq : ["$team_approval_status",Constants.REJECTED] }
                                        ]},
                                        1,
                                        0
                                    ]}
                                },
                            }}
                        ]).toArray().then(result=>{
                            callback(null, result?.[0] || {});
                        }).catch(next);
                    },
                    ticket_counts :(callback)=>{
                        this.getTicketsCount(req, res, next).then(response=>{
                            callback(null,response?.result || {});
                        }).catch(next);
                    },
                    login_details :(callback)=>{
                        this.getLoginDetails(req, res, next,{
                            fromDate	:	Helper.subtractDate(Constants.DAYS_IN_A_WEEK*Constants.HOURS_IN_A_DAY),
                            endDate		:	Helper.newDate()
                        }).then(response=>{
                            callback(null,response);
                        }).catch(next);
                    },
                    get_schedule_list :(callback)=>{
                        this.getUpcomingWeekList(req, res, next).then(response=>{
                            callback(null,response);
                        }).catch(next);
                    },
                    members_stats :(callback)=>{
                        this.memberStats(req, res, next).then(response=>{
                            callback(null, response?.result || {});
                        }).catch(next);
                    },
                    total_agents_at_not_ready:(callback)=>{
                        if(!teamHead) return callback(null,null);

                        const team_breaks = this.db.collection(Tables.TEAM_BREAKS);
                        team_breaks.aggregate([
                            {$match	: {parent_id :  authId,date: { $gte: startDate, $lte: endDate}}},
                            {$group	: {
                                _id	: "$break_type",
                                total_count : {$sum : 1},
                            }},
                        ]).toArray().then(agentResult=>{
                            callback(null, agentResult);
                        }).catch(next);
                    },
                    break_type_list:(callback)=>{
                        if(!teamHead) return callback(null,null);

                        /** Get leave type list **/
                        Helper.getAttributes(req,res,next,{type: "break_type"}).then(breakTypeList=>{

                            let tempBreakType = {};
                            if(breakTypeList.length >0){
                                breakTypeList.map(records=>{
                                    tempBreakType[String(records._id)] = records.title;
                                });
                            }
                            callback(null, tempBreakType);
                        }).catch(next);
                    },
                    total_agents_on_leaves:(callback)=>{
                        if(!teamHead) return callback(null,null);
                        
                        team_availabilities.aggregate([
                            {$match	: {
                                parent_id 	:  authId,
                                leave_type 	: {$ne: Constants.WEEKLY_OFF},
                                date		: { $gte: startDate, $lte: endDate}
                            }},
                            {$group	: {
                                _id	: "$leave_type",
                                total_count : {$sum : 1},
                            }},
                        ]).toArray().then(leaveResult=>{
                            callback(null, leaveResult);
                        }).catch(next);
                    },
                    agents_info :(callback)=>{
                        if(!teamHead) return callback(null,null);

                        team_availabilities.aggregate([
                            {$match	: {parent_id :  authId,date: { $gte: startDate, $lte: endDate}}},
                            {$group	: {
                                _id	: null,
                                total_available_agents : {$sum : {
                                    $cond: [
                                        {$or: [
                                            {$ifNull: ["$leave_type",true]},
                                            {$eq: ["$leave_type",""]}
                                        ]},
                                        1,
                                        0
                                    ]}
                                },
                                total_agents_on_off_today : {$sum : {
                                    $cond: [
                                        {$and: [
                                            { $eq: ["$leave_type",Constants.WEEKLY_OFF]}
                                        ]},
                                        1,
                                        0
                                    ]}
                                },
                            }}
                        ]).toArray().then(tmpResult=>{
                            callback(null, tmpResult?.[0] || {});
                        }).catch(next);
                    },
                    total_offers_counts :(callback)=>{
                        this.getOffersCount(req, res, next).then(response=>{
                            callback(null,response?.result || {});
                        }).catch(next);
                    },
                },(asyncErr, asyncResponse)=>{
                    /** Send success response */
                    resolve({
                        status : Constants.STATUS_SUCCESS,
                        result : asyncResponse
                    });
                });
            } catch (error) {
                return next(error);
            }
		}).catch(next);
    };

    /**
	 * For get marketing dashboard data
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return array to dashboard data
	 */
    async marketingDashboard(req, res, next){
        return new Promise(async resolve=>{
            try{
                let authId			= new ObjectId(req.session.user._id);
                let teamHead		= req?.session?.user?.team_head || false;
                let currentDate 	= Helper.newDate("",Constants.DATABASE_DATE_FORMAT);
                let startDate   	= Helper.getUtcDate(currentDate+" "+Constants.START_DATE_TIME_FORMAT);
                let endDate  		= Helper.getUtcDate(currentDate+" "+Constants.END_DATE_TIME_FORMAT);

                asyncParallel({
                    approved_restaurants :(callback)=>{
                        const restaurants = this.db.collection(Tables.RESTAURANTS);
                        restaurants.countDocuments({is_deleted:Constants.NOT_DELETED}).then(count=>{
                            callback(null, count);
                        }).catch(next);
                    },
                    restaurant_requests :(callback)=>{
                        const restaurant_enquiries = this.db.collection(Tables.RESTAURANT_ENQUIRIES);
                        /** Set conditions **/
                        restaurant_enquiries.aggregate([
                            {$match	: {is_deleted:Constants.NOT_DELETED}},
                            {$group	: {
                                _id	: null,
                                pending_restaurant : {$sum : {
                                    $cond: [
                                        {$and: [
                                            { $eq : ["$team_approval_status",Constants.PENDING] }
                                        ]},
                                        1,
                                        0
                                    ]}
                                },
                                in_review_restaurant : {$sum : {
                                    $cond: [
                                        {$and: [
                                            { $eq : ["$approval_status",Constants.IN_REVIEW] }
                                        ]},
                                        1,
                                        0
                                    ]}
                                },
                                rejected_restaurant : {$sum : {
                                    $cond: [
                                        {$and: [
                                            { $eq : ["$team_approval_status",Constants.REJECTED] }
                                        ]},
                                        1,
                                        0
                                    ]}
                                },
                            }}
                        ]).toArray().then(result=>{
                            callback(null, result?.[0] || {});
                        }).catch(next);
                    },
                    ticket_counts :(callback)=>{
                        this.getTicketsCount(req, res, next).then(response=>{
                            callback(null,response?.result || {});
                        }).catch(next);
                    },
                    login_details :(callback)=>{
                        this.getLoginDetails(req, res, next,{
                            fromDate	:	Helper.subtractDate(Constants.DAYS_IN_A_WEEK*Constants.HOURS_IN_A_DAY),
                            endDate		:	Helper.newDate()
                        }).then(response=>{
                            callback(null,response);
                        }).catch(next);
                    },
                    get_schedule_list :(callback)=>{
                        this.getUpcomingWeekList(req, res, next).then(response=>{
                            callback(null,response);
                        }).catch(next);
                    },
                    leave_type_list:(callback)=>{
                        /** Get leave type list **/
                        Helper.getAttributes(req,res,next,{type: "vacation_leave_type"}).then(leaveTypeList=>{

                            let tempLeaveType = {};
                            if(leaveTypeList.length >0){
                                leaveTypeList.map(records=>{
                                    tempLeaveType[String(records.attribute_id)] = records.title;
                                });
                            }
                            callback(null, tempLeaveType);
                        }).catch(next);
                    },
                    total_offers_counts :(callback)=>{
                        this.getOffersCount(req, res, next).then(response=>{
                            callback(null,response?.result || {});
                        }).catch(next);
                    },
                    members_stats :(callback)=>{
                        this.memberStats(req, res, next).then(response=>{
                            callback(null, response?.result || {});
                        }).catch(next);
                    },
                    total_agents_on_leaves:(callback)=>{
                        if(!teamHead) return callback(null,null);

                        const team_availabilities = this.db.collection(Tables.TEAM_AVAILABILITIES);
                        team_availabilities.aggregate([
                            {$match	: {
                                parent_id 	:  authId,
                                leave_type 	: {$ne: Constants.WEEKLY_OFF},
                                date		: { $gte: startDate, $lte: endDate}
                            }},
                            {$group	: {
                                _id	: "$leave_type",
                                total_count : {$sum : 1},
                            }},
                        ]).toArray().then(leaveResult=>{
                            callback(null, leaveResult);
                        }).catch(next);
                    },
                    agents_info :(callback)=>{
                        if(!teamHead) return callback(null,null);

                        const team_availabilities = this.db.collection(Tables.TEAM_AVAILABILITIES);
                        team_availabilities.aggregate([
                            {$match	: {parent_id :  authId,date: { $gte: startDate, $lte: endDate}}},
                            {$group	: {
                                _id	: null,
                                total_available_agents : {$sum : {
                                    $cond: [
                                        {$or: [
                                            {$ifNull: ["$leave_type",true]},
                                            {$eq: ["$leave_type",""]}
                                        ]},
                                        1,
                                        0
                                    ]}
                                },
                                total_agents_on_off_today : {$sum : {
                                    $cond: [
                                        {$and: [
                                            { $eq: ["$leave_type",Constants.WEEKLY_OFF]}
                                        ]},
                                        1,
                                        0
                                    ]}
                                },
                            }}
                        ]).toArray().then(tmpResult=>{
                            callback(null, tmpResult?.[0] || {});
                        }).catch(next);
                    },
                },(asyncErr, asyncResponse)=>{
                    /** Send success respone */
                    resolve({
                        status : Constants.STATUS_SUCCESS,
                        result : asyncResponse
                    });
                });
            } catch (error) {
                return next(error);
            }
		}).catch(next);
    };

    /**
	 * For get fleet dashboard data
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return array to dashboard data
	 */
    async fleetDashboard(req, res, next){
        return new Promise(async resolve=>{
            try{
                let authId			=   new ObjectId(req.session.user._id);
                let authUserRoleId	=   req?.session?.user?.user_role_id;
                let teamHead		=   req?.session?.user?.team_head || false;
                let currentDate 	=   Helper.newDate("",Constants.DATABASE_DATE_FORMAT);
                let startDate   	=   Helper.getUtcDate(currentDate+" "+Constants.START_DATE_TIME_FORMAT);
                let endDate  		=   Helper.getUtcDate(currentDate+" "+Constants.END_DATE_TIME_FORMAT);
                
                const users 		= this.db.collection(Tables.USERS);
                const driver_breaks = this.db.collection(Tables.DRIVER_BREAKS);
                const orders 		= this.db.collection(Tables.ORDERS);
                asyncParallel({
                    area_ids:(callback)=>{
                        if(authUserRoleId != Constants.FLEET || teamHead) return callback(null,null);

                        /** Get fleet assigned area ids  */
                        Helper.getAreaIdsBasedOnFleetRole(req,res,next).then(areaIds=>{
                            return callback(null,areaIds);
                        }).catch(next);					
                    },
                    all_driver_shift:(callback)=>{
                        if(authUserRoleId != Constants.FLEET || teamHead) return callback(null,null);
                        
                        /** get driver ids */
                        Helper.getAllDriverIdsWhoHaveShift(req,res,next).then(response=>{
                            return callback(null,response?.driver_ids || []);
                        }).catch(next);
                    },
                },(asyncErr, asyncResponse)=>{
                    if(asyncErr) return next(asyncErr);

                    let areaIds 		= 	asyncResponse.area_ids || [];
                    let allDriverShift 	=	asyncResponse.all_driver_shift || [];

                    let orderCommonConditions = {};
                    if(!teamHead || areaIds.length >0){
                        orderCommonConditions.branch_area_id = {$in : Helper.arrayToObject(areaIds)};
                    }

                    asyncParallel({
                        driver_details:(callback)=>{
                            if(authUserRoleId != Constants.FLEET || teamHead) return callback(null,null);

                            /** Get driver ids */
                            Helper.getAllDriverIdsWhoHaveShift(req,res,next,{area_ids: areaIds}).then(shiftRes=>{
                                callback(null, shiftRes?.driver_ids || []);						
                            }).catch(next);	
                        },
                    },(asyncChildErr, asyncChildResponse)=>{
                        if(asyncChildErr) return next(asyncChildErr);

                        let excludedStatus	= [Constants.ORDER_REJECTED,Constants.ORDER_REJECTED_BY_ADMIN,Constants.ORDER_DELIVERED,Constants.ORDER_CANCELLED];
                        let driverIds 		=  asyncChildResponse.driver_details || [];

                        /** Set  captain conditions */
                        let captainConditions 	= 	clone(Constants.DRIVER_COMMON_CONDITIONS);
                        if(!teamHead || driverIds.length >0 || allDriverShift.length >0){
                            if(!captainConditions["$and"]) captainConditions["$and"] = [];
                            captainConditions["$and"].push({
                                $or: [
                                    {_id: {$in:  driverIds}},
                                    {_id: {$nin:  allDriverShift}, force_active: Constants.FORCE_ACTIVE, is_available: Constants.ACTIVE }
                                ]
                            });
                        }

                        asyncParallel({
                            overtime_requests :(callback)=>{
                                let overtimeConditions	=	{};
                                if(authUserRoleId == Constants.FLEET && !teamHead){
                                    overtimeConditions["$and"] = [
                                        { 'user_id' : {$in : Helper.arrayToObject(driverIds)}}
                                    ];
                                }
                                overtimeConditions.request_date = {$gte: Helper.newDate(startDate), $lte: Helper.newDate(endDate) };

                                const captain_overtime_requests = this.db.collection(Tables.CAPTAIN_OVERTIME_REQUESTS);
                                captain_overtime_requests.countDocuments(overtimeConditions).then(totalovertimeResult=>{
                                    callback(null,totalovertimeResult);
                                }).catch(next);
                            },
                            ticket_counts :(callback)=>{
                                this.getTicketsCount(req, res, next).then(response=>{
                                    callback(null,response?.result || {});
                                }).catch(next); 
                            },
                            login_details :(callback)=>{
                                this.getLoginDetails(req, res, next,{
                                    fromDate	:	Helper.subtractDate(Constants.DAYS_IN_A_WEEK*Constants.HOURS_IN_A_DAY),
                                    endDate		:	Helper.newDate()
                                }).then(response=>{
                                    callback(null,response);
                                }).catch(next);
                            },
                            get_schedule_list :(callback)=>{
                                this.getUpcomingWeekList(req, res, next).then(response=>{
                                    callback(null,response);
                                }).catch(next);
                            },
                            members_stats :(callback)=>{
                                this.memberStats(req, res, next).then(response=>{
                                    callback(null, response?.result || {});
                                }).catch(next);
                            },
                            total_captains : (callback)=>{
                                let driverCommonConditions = clone(captainConditions);

                                /** Get total number of captains **/
                                users.countDocuments(driverCommonConditions).then(totalCaptainsResult=>{
                                    callback(null,totalCaptainsResult);
                                }).catch(next);
                            },
                            total_online_captains : (callback)=>{
                                let driverCommonConditions 		 = clone(captainConditions);
                                driverCommonConditions.is_available = Constants.AVAILABLE;

                                /** Get total online captains **/
                                users.countDocuments(driverCommonConditions).then(onlineCaptainsResult=>{
                                    callback(null,onlineCaptainsResult);
                                }).catch(next);
                            },
                            total_offline_captains : (callback)=>{
                                let driverCommonConditions 	 		=	clone(captainConditions);
                                driverCommonConditions.is_available = 	{$ne: Constants.AVAILABLE};

                                /** Get total offline captains **/
                                users.countDocuments(driverCommonConditions).then(offlineCaptainsResult=>{
                                    callback(null,offlineCaptainsResult);
                                }).catch(next);
                            },
                            total_free_captains : (callback)=>{
                                let driverCommonConditions 	 		 = clone(captainConditions);
                                driverCommonConditions.is_available  = Constants.AVAILABLE;
                                if(!driverCommonConditions["$or"]) driverCommonConditions["$or"] = [];
                                driverCommonConditions["$or"].push({$or: [
                                    {order_status : {$exists: false}},
                                    {order_status : Constants.ORDER_DRIVER_FREE },
                                ]});

                                /** Get total free captains **/
                                users.countDocuments(driverCommonConditions).then(freeCaptainsResult=>{
                                    callback(null,freeCaptainsResult);
                                }).catch(next);
                            },
                            total_occupied_captains : (callback)=>{
                                let driverCommonConditions 	 		 = clone(captainConditions);
                                driverCommonConditions.is_available  = Constants.AVAILABLE;
                                driverCommonConditions.order_status  = {$exists: true, $ne: Constants.ORDER_DRIVER_FREE};

                                /** Get total occuiped captains **/
                                users.countDocuments(driverCommonConditions).then(occupiedCaptainsResult=>{
                                    callback(null,occupiedCaptainsResult);
                                }).catch(next);
                            },
                            total_on_the_way_to_restaurant_captains : (callback)=>{
                                let driverCommonConditions 	 		 = clone(captainConditions);
                                driverCommonConditions.is_available  = 	Constants.AVAILABLE;
                                if(!driverCommonConditions["$or"]) driverCommonConditions["$or"] = [];
                                driverCommonConditions["$or"].push({$or: [
                                    {order_status: {$in: [Constants.ORDER_DRIVER_ACCEPTED]}},
                                    {"orders.status": {$in: [Constants.ORDER_DRIVER_ACCEPTED]}}
                                ]});

                                /** Get total way to restaurant captains **/
                                users.countDocuments(driverCommonConditions).then(wayToRestaurantCaptainsResult=>{
                                    callback(null,wayToRestaurantCaptainsResult);
                                }).catch(next);
                            },
                            total_on_the_way_to_delivery_location_captains : (callback)=>{
                                let driverCommonConditions 	 		 = clone(captainConditions);
                                driverCommonConditions.is_available  = Constants.AVAILABLE;
                                if(!driverCommonConditions["$or"]) driverCommonConditions["$or"] = [];
                                driverCommonConditions["$or"].push({$or: [
                                    {order_status: {$in: [Constants.ORDER_DRIVER_WAY_TO_CUSTOMER]}},
                                    {"orders.status": {$in: [Constants.ORDER_DRIVER_WAY_TO_CUSTOMER]}}
                                ]});

                                /** Get total way to delivery captains **/
                                users.countDocuments(driverCommonConditions).then(wayToDeliveryCaptainsResult=>{
                                    callback(null,wayToDeliveryCaptainsResult);
                                }).catch(next);
                            },
                            total_captains_on_break : (callback)=>{
                                let driverCommonConditions 	= clone(captainConditions);

                                /** Get total number of captains **/
                                users.distinct("_id",driverCommonConditions).then(captainIds=>{

                                    /** Get total number of captains on break **/
                                    driver_breaks.countDocuments({
                                        driver_id	 :	{$in : captainIds || []},
                                        date		 :	{$gte : startDate, $lte : endDate},
                                        status		 :  Constants.APPROVED,
                                        is_completed :  {$ne: true}
                                    }).then(CaptainBreakResult=>{
                                        callback(null,CaptainBreakResult);
                                    }).catch(next);
                                }).catch(next);
                            },
                            total_agents_at_not_ready:(callback)=>{
                                if(!teamHead) return callback(null,null);

                                const team_breaks = this.db.collection(Tables.TEAM_BREAKS);
                                team_breaks.aggregate([
                                    {$match	: {parent_id :  authId,date: { $gte: startDate, $lte: endDate}}},
                                    {$group	: {
                                        _id	: "$break_type",
                                        total_count : {$sum : 1},
                                    }},
                                ]).toArray().then(agentResult=>{
                                    callback(null, agentResult);
                                }).catch(next);
                            },
                            break_type_list:(callback)=>{
                                if(!teamHead) return callback(null,null);

                                /** Get leave type list **/
                                Helper.getAttributes(req,res,next,{type: "break_type"}).then(breakTypeList=>{

                                    let tempBreakType = {};
                                    if(breakTypeList.length >0){
                                        breakTypeList.map(records=>{
                                            tempBreakType[String(records._id)] = records.title;
                                        });
                                    }
                                    callback(null, tempBreakType);
                                }).catch(next);
                            },
                            leave_type_list:(callback)=>{
                                /** Get leave type list **/
                                Helper.getAttributes(req,res,next,{type: "vacation_leave_type",is_show:true}).then(leaveTypeList=>{

                                    let tempLeaveType = {};
                                    if(leaveTypeList.length >0){
                                        leaveTypeList.map(records=>{
                                            tempLeaveType[String(records.attribute_id)] = records.title;
                                        });
                                    }
                                    callback(null, tempLeaveType);
                                }).catch(next);
                            },
                            total_agents_on_leaves:(callback)=>{
                                if(!teamHead) return callback(null,null);

                                const team_availabilities = this.db.collection(Tables.TEAM_AVAILABILITIES);
                                team_availabilities.aggregate([
                                    {$match	: {
                                        parent_id 	:  authId,
                                        leave_type 	: {$ne: Constants.WEEKLY_OFF},
                                        date		: { $gte: startDate, $lte: endDate}
                                    }},
                                    {$group	: {
                                        _id	: "$leave_type",
                                        total_count : {$sum : 1},
                                    }},
                                ]).toArray().then(leaveResult=>{
                                    callback(null, leaveResult);
                                }).catch(next);
                            },
                            agents_info :(callback)=>{
                                if(!teamHead) return callback(null,null);

                                const team_availabilities = this.db.collection(Tables.TEAM_AVAILABILITIES);
                                team_availabilities.aggregate([
                                    {$match	: {parent_id :  authId,date: { $gte: startDate, $lte: endDate}}},
                                    {$group	: {
                                        _id	: null,
                                        total_available_agents : {$sum : {
                                            $cond: [
                                                {$or: [
                                                    {$ifNull: ["$leave_type",true]},
                                                    {$eq: ["$leave_type",""]}
                                                ]},
                                                1,
                                                0
                                            ]}
                                        },
                                        total_agents_on_off_today : {$sum : {
                                            $cond: [
                                                {$and: [
                                                    { $eq: ["$leave_type",Constants.WEEKLY_OFF]}
                                                ]},
                                                1,
                                                0
                                            ]}
                                        },
                                    }}
                                ]).toArray().then(tmpResult=>{
                                    callback(null,tmpResult?.[0] || {});
                                }).catch(next);
                            },
                            way_to_customer_orders : (callback)=>{
                                /** Get order way to customer **/
                                let orderWayToCustomerConditions 		    	=	clone(orderCommonConditions);
                                orderWayToCustomerConditions.delivery_status   	=	Constants.ORDER_DRIVER_WAY_TO_CUSTOMER;
                                orderWayToCustomerConditions.is_completed   	=	{$ne: true};
                                
                                /** Get orders way to customer **/
                                orders.countDocuments(orderWayToCustomerConditions).then(wayToCustomerOrdersResult=>{
                                    callback(null,wayToCustomerOrdersResult);
                                }).catch(next);
                            },
                            way_to_restaurant_orders : (callback)=>{
                                /** Get order way to restaurant **/
                                let orderWayToRestaurantConditions 		    	= 	clone(orderCommonConditions);
                                orderWayToRestaurantConditions.delivery_status 	=	Constants.ORDER_DRIVER_ACCEPTED;

                                /** Get orders way to restaurant **/
                                orders.countDocuments(orderWayToRestaurantConditions).then(wayToRestaurantOrdersResult=>{
                                    callback(null,wayToRestaurantOrdersResult);
                                }).catch(next);
                            },
                            delivered_orders : (callback)=>{
                                /** Get order delivered **/
                                let orderDeliveredConditions 		  = clone(orderCommonConditions);
                                orderDeliveredConditions.admin_status = Constants.ORDER_DELIVERED;
                                /** Get orders delivered **/
                                orders.countDocuments(orderDeliveredConditions).then(deliveredOrdersResult=>{
                                    callback(null,deliveredOrdersResult);
                                }).catch(next);
                            },
                            not_assigned_orders : (callback)=>{

                                /** Get order not assigned **/
                                let orderNotAssignedConditions 		    = 	clone(orderCommonConditions);
                                orderNotAssignedConditions.is_completed = 	{$exists: false};
                                orderNotAssignedConditions.admin_status	=   {$nin : excludedStatus};
                                orderNotAssignedConditions["$and"] 		=	[
                                    {admin_status: {$nin: [Constants.ORDER_PAYMENT_PENDING, Constants.ORDER_PAYMENT_FAILED] }},
                                    {$or:[
                                        {delivery_type:	Constants.DELIVERY_BY_CRAVEZ, captain_id:	"", assigned_captain : {$exists: false}},
                                        {delivery_type:	Constants.DELIVERY_BY_RESTAURANT, captain_name: {$exists: false} },
                                    ]}
                                ];

                                /** Get orders not assigned **/
                                orders.countDocuments(orderNotAssignedConditions).then(notAssignedOrdersResult=>{
                                    callback(null,notAssignedOrdersResult);
                                }).catch(next);
                            },
                        },(asyncErr, asyncResponse)=>{
                            /** Send success respone */
                            resolve({
                                status : Constants.STATUS_SUCCESS,
                                result : asyncResponse
                            });
                        });
                    });
                });
            }catch(error){
                return next(error);
            }
		}).catch(next);
    };

    /**
     * Back Office Dashboard
     * @param {Object} req - The request object
     * @param {Object} res - The response object
     * @param {Function} next - The next function
     * @returns {Object} The response object
     */
    async backOfficeDashboard(req, res, next){
        return new Promise(async resolve => {
            try {
                const authId = new ObjectId(req.session.user._id);
                const teamHead = req.session.user.team_head || false;
                const currentDate = Helper.newDate("", Constants.DATABASE_DATE_FORMAT);
                const startDate = Helper.getUtcDate(currentDate + " " + Constants.START_DATE_TIME_FORMAT,);
                const endDate = Helper.getUtcDate(currentDate + " " + Constants.END_DATE_TIME_FORMAT);

                asyncParallel({
                    login_details :(callback)=>{
                        this.getLoginDetails(req, res, next,{
                            fromDate	:	Helper.subtractDate(Constants.DAYS_IN_A_WEEK*Constants.HOURS_IN_A_DAY),
                            endDate		:	Helper.newDate()
                        }).then(response=>{
                            callback(null,response);
                        }).catch(next);
                    },
                    get_schedule_list :(callback)=>{
                        this.getUpcomingWeekList(req, res, next).then(response=>{
                            callback(null,response);
                        }).catch(next);
                    },
                    leave_type_list:(callback)=>{
                        /** Get leave type list **/
                        Helper.getAttributes(req,res,next,{type: "vacation_leave_type"}).then(leaveTypeList=>{

                            let tempLeaveType = {};
                            if(leaveTypeList.length >0){
                                leaveTypeList.map(records=>{
                                    tempLeaveType[String(records.attribute_id)] = records.title;
                                });
                            }
                            callback(null, tempLeaveType);
                        }).catch(next);
                    },
                    total_offers_counts :(callback)=>{
                        this.getOffersCount(req, res, next).then(response=>{
                            callback(null,response?.result || {});
                        }).catch(next);
                    },
                    members_stats :(callback)=>{
                        this.memberStats(req, res, next).then(response=>{
                            callback(null, response?.result || {});
                        }).catch(next);
                    },
                    total_agents_on_leaves:(callback)=>{
                        if(!teamHead) return callback(null,null);

                        const team_availabilities = this.db.collection(Tables.TEAM_AVAILABILITIES);
                        team_availabilities.aggregate([
                            {$match	: {
                                parent_id 	:  authId,
                                leave_type 	: {$ne: Constants.WEEKLY_OFF},
                                date		: { $gte: startDate, $lte: endDate}
                            }},
                            {$group	: {
                                _id	: "$leave_type",
                                total_count : {$sum : 1},
                            }},
                        ]).toArray().then(leaveResult=>{
                            callback(null, leaveResult);
                        }).catch(next);
                    },
                    agents_info :(callback)=>{
                        if(!teamHead) return callback(null,null);

                        const team_availabilities = this.db.collection(Tables.TEAM_AVAILABILITIES);
                        team_availabilities.aggregate([
                            {$match	: {parent_id :  authId,date: { $gte: startDate, $lte: endDate}}},
                            {$group	: {
                                _id	: null,
                                total_available_agents : {$sum : {
                                    $cond: [
                                        {$or: [
                                            {$ifNull: ["$leave_type",true]},
                                            {$eq: ["$leave_type",""]}
                                        ]},
                                        1,
                                        0
                                    ]}
                                },
                                total_agents_on_off_today : {$sum : {
                                    $cond: [
                                        {$and: [
                                            { $eq: ["$leave_type",Constants.WEEKLY_OFF]}
                                        ]},
                                        1,
                                        0
                                    ]}
                                },
                            }}
                        ]).toArray().then(tmpResult=>{
                            callback(null,tmpResult?.[0] || {});
                        }).catch(next);
                    },
                },(asyncErr, asyncResponse)=>{
                    /** Send success respone */
                    resolve({
                        status : Constants.STATUS_SUCCESS,
                        result : asyncResponse
                    });
                });
            }catch(error){
                return next(error);
            }
		}).catch(next);
    };

    /**
     * Supervisor Dashboard
     * @param {Object} req - The request object
     * @param {Object} res - The response object
     * @param {Function} next - The next function
     * @returns {Object} The response object
     */
    async supervisorDashboard(req, res, next){
        return new Promise(async resolve=>{
            try{
                const orders 	= this.db.collection(Tables.ORDERS);
                const users 	= this.db.collection(Tables.USERS);
                const tickets 	= this.db.collection(Tables.TICKETS);
                const restaurant_branches 	= this.db.collection(Tables.RESTAURANT_BRANCHES);
                const payment_transactions 	= this.db.collection(Tables.PAYMENT_TRANSACTIONS);

                asyncParallel({
                    sales_chart : (callback)=>{
                        orders.aggregate([
                            {$match	: {
                                order_date	: { 
                                    $gte: Helper.subtractDate(Constants.DAYS_IN_A_WEEK*Constants.HOURS_IN_A_DAY), 
                                    $lte: Helper.newDate()
                                },
                                admin_status: Constants.ORDER_DELIVERED,
                            }},
                            {$group	: {
                                _id  :{$dayOfMonth: {date: "$order_date", timezone: Constants.DEFAULT_TIME_ZONE}},
                                total_cravez_delivery : {$sum : {
                                    $cond: [
                                        {$and: [
                                            { $eq : ["$delivery_type",Constants.DELIVERY_BY_CRAVEZ] },
                                        ]},
                                        1,
                                        0
                                    ]}
                                },
                                total_restaurant_delivery : {$sum : {
                                    $cond: [
                                        {$and: [
                                            { $eq : ["$delivery_type",Constants.DELIVERY_BY_RESTAURANT] },
                                        ]},
                                        1,
                                        0
                                    ]}
                                },
                                total_pickup_delivery : {$sum : {
                                    $cond: [
                                        {$and: [
                                            { $eq : ["$delivery_type",Constants.DELIVERY_BY_PICK_UP] },
                                        ]},
                                        1,
                                        0
                                    ]}
                                },
                            }},
                            {$sort: {_id : Constants.SORT_ASC}}
                        ]).toArray().then(chartResult=>{
                            callback(null, chartResult);
                        }).catch(next);
                    },
                    order_stats :(callback)=>{
                        /** Get orders stats **/
                        orders.aggregate([
                            {$group: {
                                _id: null,
                                total_orders : {$sum: 1},
                                total_pending_orders: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            { $eq: ["$admin_status", Constants.ORDER_PENDING] }, 
                                            { $eq: ["$is_confirm", false] }, 
                                        ]},
                                        1, 0
                                    ]}},
                                total_submitted_orders: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            { $eq: ["$admin_status", Constants.ORDER_PENDING] }, 
                                            { $eq: ["$is_confirm", true] }, 
                                        ]},
                                        1, 0
                                    ]}},
                                total_preparing_orders: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            {$eq: ["$admin_status", Constants.ORDER_PREPARING]},
                                        ]},
                                        1, 0
                                    ]}},
                                total_ready_to_pickup_orders: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            {$eq: ["$admin_status", Constants.ORDER_READY_TO_PICK_UP]},
                                        ]},
                                        1, 0
                                    ]}},
                                total_out_for_delivery_orders: { $sum: 
                                    {$cond: [
                                        {$or: [
                                            {$eq: ["$admin_status", Constants.ORDER_ON_THE_WAY]},
                                            {$eq: ["$admin_status", Constants.ORDER_ON_THE_WAY_TO_CUSTOMER]},
                                        ]},
                                        1, 0
                                    ]}},
                                total_delivered_orders: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            {$eq: ["$admin_status", Constants.ORDER_DELIVERED]},
                                        ]},
                                        1, 0
                                    ]}},
                                total_rejected_orders: { $sum: 
                                    {$cond: [
                                        {$or: [
                                            {$eq: ["$admin_status", Constants.ORDER_REJECTED]},
                                            {$eq: ["$admin_status", Constants.ORDER_REJECTED_BY_ADMIN]},
                                        ]},
                                        1, 0
                                    ]}},
                                total_cancelled_orders: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            {$eq: ["$admin_status", Constants.ORDER_CANCELLED]},
                                        ]},
                                        1, 0
                                    ]}},
                                first_orders: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            {$eq: ["$admin_status", Constants.ORDER_PENDING]},
                                            {$eq: ["$is_first_order", true]},
                                        ]},
                                        1, 0
                                    ]}},
                                duplicate_orders: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            {$eq: ["$admin_status", Constants.ORDER_PENDING]},
                                            {$eq: ["$is_duplicate_order", true]},
                                        ]},
                                        1, 0
                                    ]}},
                                big_orders: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            {$eq: ["$is_big_order", true]},
                                        ]},
                                        1, 0
                                    ]}},
                                rejected_orders_monitoring: { $sum: 
                                    {$cond: [
                                        {$or: [
                                            {$eq: ["$admin_status", Constants.ORDER_REJECTED]},
                                            {$eq: ["$admin_status", Constants.ORDER_REJECTED_BY_ADMIN]},
                                        ]},
                                        1, 0
                                    ]}},
                                delayed_acceptance: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            {$eq: ["$is_delayed_acceptance", true]},
                                        ]},
                                        1, 0
                                    ]}},
                                delayed_preparation: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            {$eq: ["$is_delayed_preperation", true]},
                                        ]},
                                        1, 0
                                    ]}},
                                delayed_pickup_by_captain: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            {$eq: ["$is_delayed_pickup_by_captain", true]},
                                        ]},
                                        1, 0
                                    ]}},
                                delayed_pickup_by_customer: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            {$eq: ["$is_delayed_picked_up_by_customer", true]},
                                        ]},
                                        1, 0
                                    ]}},
                                vip_orders: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            {$eq: ["$is_vip", true]},
                                        ]},
                                        1, 0
                                    ]}},
                                delayed_delivery: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            {$eq: ["$is_delayed_delivery", true]},
                                        ]},
                                        1, 0
                                    ]}},
                                delivery_cravez: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            {$eq: ["$delivery_type", Constants.DELIVERY_BY_CRAVEZ]},
                                        ]},
                                        1, 0
                                    ]}},
                                delay_in_delivery_by_cravez: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            {$eq: ["$delivery_type", Constants.DELIVERY_BY_CRAVEZ]},
                                            {$eq: ["$is_delayed_delivery", true]},
                                        ]},
                                        1, 0
                                    ]}},
                                delay_in_delivery_by_restaurant: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            {$eq: ["$delivery_type", Constants.DELIVERY_BY_RESTAURANT]},
                                            {$eq: ["$is_delayed_delivery", true]},
                                        ]},
                                        1, 0
                                    ]}},
                                delay_pickup_by_captain_cravez_order: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            {$eq: ["$delivery_type", Constants.DELIVERY_BY_CRAVEZ]},
                                            {$eq: ["$is_delayed_pickup_by_captain", true]},
                                        ]},
                                        1, 0
                                    ]}},
                                delay_in_preparation_cravez_order: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            {$eq: ["$delivery_type", Constants.DELIVERY_BY_CRAVEZ]},
                                            {$eq: ["$is_delayed_preperation", true]},
                                        ]},
                                        1, 0
                                    ]}},                                 
                            }}
                        ]).toArray().then(res =>{
                            callback(null, res?.[0] || {});
                        }).catch(next); 
                    },
                    total_drivers :(callback)=>{
                        let DriverConditions = clone(Constants.DRIVER_COMMON_CONDITIONS);

                        /** Get total drivers count **/
                        users.countDocuments(DriverConditions).then(DriverCount=>{
                            callback(null,DriverCount);
                        }).catch(next);
                    },
                    total_available_drivers :(callback)=>{
                        let availableDriverConditions 			= 	clone(Constants.DRIVER_COMMON_CONDITIONS);
                        availableDriverConditions.is_available 	=	Constants.AVAILABLE;

                        /** Get available drivers count **/
                        users.countDocuments(availableDriverConditions).then(availableDriverCount=>{
                            callback(null,availableDriverCount);
                        }).catch(next);
                    },
                    total_assigned_drivers :(callback)=>{
                        let assignedDriverConditions 				= 	clone(Constants.DRIVER_COMMON_CONDITIONS);
                        assignedDriverConditions.is_available 		= 	Constants.AVAILABLE;
                        assignedDriverConditions.order_status 		=	{$ne : Constants.ORDER_DRIVER_FREE};
                        assignedDriverConditions["orders.order_id"] = 	{$exists : true};

                        /** Get assigned drivers count **/
                        users.countDocuments(assignedDriverConditions).then(assignedDriverCount=>{
                            callback(null,assignedDriverCount);
                        }).catch(next);
                    },
                    total_free_drivers :(callback)=>{
                        let freeDriverConditions 		  		= 	clone(Constants.DRIVER_COMMON_CONDITIONS);
                        freeDriverConditions.is_available 		= 	Constants.AVAILABLE;
                        freeDriverConditions.order_status 		=	Constants.ORDER_DRIVER_FREE;
                        freeDriverConditions["orders.order_id"] = 	{$exists : false};

                        /** Get free drivers count **/
                        users.countDocuments(freeDriverConditions).then(freeDriverCount=>{
                            callback(null,freeDriverCount);
                        }).catch(next);
                    },
                    ticket_stats :(callback)=>{
                        /** Get tickets stats **/
                        tickets.aggregate([
                            {$group: {
                                _id: null,
                                total_tickets : {$sum: 1},
                                total_closed_tickets: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            { $eq: ["$status", Constants.TICKET_CLOSE] }, 
                                        ]},
                                        1, 0
                                    ]}},
                                total_open_tickets: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            { $eq: ["$status", Constants.TICKET_OPEN] }, 
                                        ]},
                                        1, 0
                                    ]}},
                                total_reopen_tickets: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            { $eq: ["$status", Constants.TICKET_REOPENED] }, 
                                        ]},
                                        1, 0
                                    ]}},
                                total_pending_tickets: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            { $eq: ["$status", Constants.PENDING] }, 
                                        ]},
                                        1, 0
                                    ]}},
                            }}
                        ]).toArray().then(res =>{
                            callback(null, res?.[0] || {});
                        }).catch(next); 
                    },
                    branch_stats :(callback)=>{
                        /** Get branch stats **/
                        restaurant_branches.aggregate([
                            {$group: {
                                _id: null,
                                total_branch : {$sum: 1},
                                total_active_branch: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            { $eq: ["$is_active", Constants.ACTIVE] }, 
                                        ]},
                                        1, 0
                                    ]}},
                                total_open_branch: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            { $eq: ["$is_active", Constants.ACTIVE] }, 
                                            { $eq: ["$is_open", Constants.OPEN] }, 
                                            { $eq: ["$branch_status", Constants.OPEN] }, 
                                        ]},
                                        1, 0
                                    ]}},
                                total_busy_branch: { $sum: 
                                    {$cond: [
                                        {$and: [
                                            {$eq: ["$is_active", Constants.ACTIVE] },
                                            {$or: [
                                                { $ne: ["$is_open", Constants.OPEN] },
                                                { $ne: ["$branch_status", Constants.BUSY] },
                                            ]}
                                        ]},
                                        1, 0
                                    ]}},
                            }}
                        ]).toArray().then(res =>{
                            callback(null, res?.[0] || {});
                        }).catch(next); 
                    },
                    total_succeeded_myfatoorah :(callback)=>{
                        /** Get success knet payment count **/
                        payment_transactions.countDocuments({payment_method:Constants.KNET,payment_status:Constants.PAYMENT_SUCCESS}).then(succeededMyfatoorahCount=>{
                            callback(null,succeededMyfatoorahCount);
                        }).catch(next);
                    },
                    total_cancelled_myfatoorah :(callback)=>{
                        /** Get cancelled knet payment count **/
                        payment_transactions.countDocuments({payment_method:Constants.KNET,payment_status:Constants.PAYMENT_CANCELED}).then(cancelledMyfatoorahCount=>{
                            callback(null,cancelledMyfatoorahCount);
                        }).catch(next);
                    },
                    total_succeeded_credit :(callback)=>{
                        /** Get success credit payment count **/
                        payment_transactions.countDocuments({payment_method:Constants.CREDIT_PAYMENT,payment_status:Constants.PAYMENT_SUCCESS}).then(succeededCreditCount=>{
                            callback(null,succeededCreditCount);
                        }).catch(next);
                    },
                    total_cancelled_credit :(callback)=>{
                        /** Get cancelled credit payment count **/
                        payment_transactions.countDocuments({payment_method:Constants.CREDIT_PAYMENT,payment_status:Constants.PAYMENT_CANCELED}).then(cancelledCreditCount=>{
                            callback(null,cancelledCreditCount);
                        }).catch(next);
                    },
                },(asyncErr, asyncResponse)=>{

                    /** Send success respone */
                    resolve({
                        status : Constants.STATUS_SUCCESS,
                        result : {
                            ...asyncResponse, 
                            ...asyncResponse.order_stats || {}, 
                            ...asyncResponse.ticket_stats || {}, 
                            ...asyncResponse.branch_stats || {}
                        }
                    });
                });
            }catch(e){
                return next(e);
            }
		}).catch(next);
    };

    async getTicketsCount(req, res, next){
        return new Promise(async resolve=>{
            try{
                let authUserId		=	new ObjectId(req.session.user._id);
                let authUserRoleId	=	req?.session?.user?.user_role_id || "";
                let ticketCateList  = [];

                /** Get ticket category list */
                if(Constants.TICKET_CATEGORY_ALLOWED_ROLES.indexOf(authUserRoleId) != -1){
                    const users = this.db.collection(Tables.USERS);
                    let userRes = await users.findOne({_id: authUserId },{projection: { ticket_category_ids:1}});
                    ticketCateList = userRes?.ticket_category_ids || [];
                }

                /** Get common conditions */
                let commonConditions = {};
                if(ticketCateList?.length >0){
                    commonConditions.category = {$in : ticketCateList};
                }

                /** Get count of different type tickets */
                const tickets = this.db.collection(Tables.TICKETS);
                let result = await tickets.aggregate([
                    {$match: commonConditions},
                    {$group	: {
                        _id				: 	null,
                        total_tickets	: 	{$sum : 1},
                        total_created_tickets:	{$sum : {
                            $cond: [
                                {$and: [
                                    { $eq : ["$created_by",authUserId] },
                                    { $eq : ["$created_by_role_id",authUserRoleId] }
                                ]},
                                1, 0
                            ]}
                        },
                        total_reopened_tickets:	{$sum : {
                            $cond: [
                                {$and: [
                                    { $eq : ["$status",Constants.TICKET_REOPENED] },
                                    { $eq : ["$assigned_to_role_id",authUserRoleId] }
                                ]},
                                1, 0
                            ]}
                        },
                        total_closed_tickets:	{$sum : {
                            $cond: [
                                {$and: [
                                    { $eq : ["$status",Constants.TICKET_CLOSE] }
                                ]},
                                1, 0
                            ]}
                        },
                        total_qa_commented_tickets:	{$sum : {
                            $cond: [
                                {$and: [
                                    {$ifNull: ["$qa_user_id",false]}
                                ]},
                                1, 0
                            ]}
                        },
                    }}
                ]).toArray();

                /** Send success response */
                resolve({status: Constants.STATUS_SUCCESS, result: result?.[0] || {}});
            }catch(error){
               return next(error);
            }
		}).catch(next);
    };

    async getLoginDetails(req, res, next, options){
        return new Promise(async resolve=>{
            try{
                let date	= 	options.fromDate;
                let toDate	=  	options.endDate;
                let authId  = 	new ObjectId(req.session.user._id);
                
                /** Get user login details */
                const user_logins = this.db.collection(Tables.USER_LOGINS);
                let result = await user_logins.aggregate([
                    { $match: {
                        user_id: new ObjectId(authId),
                        created: { $gte: date}
                    }},
                    {$group :{
                        _id         : "$date",
                        user_id     : {$first : "$user_id"},
                        logout_time : {$max : "$logout_time"},
                        login_time  : {$min : "$created"},
                    }},
                    {$sort : {"_id.date" : Constants.SORT_ASC}},
                ]).toArray();

                /**Call function for get date range */
                let dataAvailability 	= {};
                let dates = Helper.getDateRange(date,toDate).reverse();
                dates.forEach(loginDate=>{
                    let date = Helper.newDate(loginDate,Constants.DATABASE_DATE_FORMAT);
                    result.map(loginTime=>{
                        let dbDate = Helper.newDate(loginTime.login_time,Constants.DATABASE_DATE_FORMAT);
                        
                        /**Check for matching date */
                        if(date == dbDate){
                            if(!dataAvailability[loginDate]) dataAvailability[loginDate] = {
                                login_time 		: loginTime.login_time,
                                logout_time   	: loginTime.logout_time,
                            };
                        }
                    });
                });

                /** Send success response */
                resolve({
                    status       : Constants.STATUS_SUCCESS,
                    date_range   : dates,
                    result       : dataAvailability,
                });
            }catch(error){
                return next(error);
            }
		}).catch(next);
    };

    async getUpcomingWeekList(req, res, next){
        return new Promise(async resolve=>{
            try{
                let authId 	 	= 	new ObjectId(req.session.user._id);
                let teamHead	=   req?.session?.user?.team_head || false;
                let shiftAvailability = {};
                let chooseDate   	  = [];

                /**Return if user is team head */
                if(teamHead) return resolve({ 
                    status: Constants.STATUS_SUCCESS, shift_availablity : shiftAvailability,choose_date : chooseDate
                });

                let date		=  	Helper.addDate(Constants.DAYS_IN_A_WEEK*Constants.HOURS_IN_A_DAY);
                let startDate 	=  	Helper.newDate(Helper.addDate(Constants.SINGLE_DAY*Constants.HOURS_IN_A_DAY),Constants.DATABASE_DATE_FORMAT);
                let fromDate  	=  	Helper.newDate(startDate+" "+Constants.START_DATE_TIME_FORMAT);
                let endDate   	=  	Helper.newDate(date,Constants.DATABASE_DATE_FORMAT);
                let toDate 	  	=  	Helper.newDate(endDate+" "+Constants.END_DATE_TIME_FORMAT);

                /**Get details from team_availabilities */
                const team_availabilities = this.db.collection(Tables.TEAM_AVAILABILITIES);
                let result = await team_availabilities.aggregate([
                    {$match: {
                        user_id: authId,
                        date: { $gte: fromDate, $lte: toDate}
                    }},
                    {$lookup: {
                        from        : Tables.SHIFTS,
                        localField  : "shift_id",
                        foreignField: "_id",
                        as          : "shift_detail",
                    }},
                    {$project: {
                        _id:1,date:1,status:1,shift_id:1,leave_type:1,user_id:1,
                        shift_name:{ $arrayElemAt: ["$shift_detail.shift_name", 0] },
                        start_time: { $arrayElemAt: ["$shift_detail.start_time", 0] },
                        end_time: { $arrayElemAt: ["$shift_detail.end_time", 0] },
                    }},
                ]).toArray();

                /**Call function for get date range */
                let dates  = Helper.getDateRange(fromDate,toDate);
                dates.forEach(shiftDate=>{
                    let date = Helper.newDate(shiftDate,Constants.DATABASE_DATE_FORMAT);
                    chooseDate.push(date);

                    if(result?.length > 0){
                        result.forEach(shiftTime=>{
                            let dbDate  = Helper.newDate(shiftTime.date,Constants.DATABASE_DATE_FORMAT);
                           
                            /**Check for matching date */
                            if(date == dbDate){
                                if(!shiftAvailability[dbDate]) shiftAvailability[dbDate] = {
                                    shift_name : shiftTime.shift_name,
                                    start_time : shiftTime.start_time,
                                    end_time   : shiftTime.end_time,
                                    leave_type : shiftTime.leave_type || "",
                                };
                            }
                        });
                    }else{
                        shiftAvailability[shiftDate] = {
                            shift_name : "",
                            start_time : "",
                            end_time   : "",
                            leave_type : "",
                        };
                    }
                });

                /**For render schedule page */
                resolve({
                    status			  : Constants.STATUS_SUCCESS,
                    shift_availablity : shiftAvailability,
                    choose_date		  : chooseDate,
                });
            }catch(error){
                return next(error);
            }
		}).catch(next);        
    };

    async getOffersCount(req, res, next){
        return new Promise(async resolve=>{
            try{
                /** Get offer ids */
                const offer_logs = this.db.collection(Tables.OFFER_LOGS);
                let offerIds   = await offer_logs.distinct("offer_id",{});
                    
                const offers = this.db.collection(Tables.OFFERS);
                let result = await offers.aggregate([
                    {$group: {
                        _id: null,
                        total_offers: { $sum: 1},
                        total_redeemed_offers: { $sum: 
                            {$cond: [
                                {$and: [
                                    { $in: ["$_id", offerIds] }, 
                                ]},
                                1, 0
                            ]}},
                        total_used_offers: { $sum: 
                            {$cond: [
                                {$and: [
                                    { $in: ["$_id", offerIds] }, 
                                ]},
                                1, 0
                            ]}},
                        total_unused_offers: { $sum: 
                            {$cond: [
                                {$and: [
                                    {$not: [{ $in: ["$_id", offerIds] }] }
                                ]},
                                1, 0
                            ]}},
                    }}
                ]).toArray();

                /** Send success response */
                resolve({status: Constants.STATUS_SUCCESS, result: result?.[0] || {}});                                
            }catch(error){
                return next(error);
            }
	    }).catch(next);
    };

    /**
	 * Function to get agent login logout list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	*/
    async getAgentLogin(req, res, next){
        req.breadcrumbs(BREADCRUMBS['admin/dashboard/agent_login']);
        res.render('dashboard/agent_login_list');
    };

    async getAgentLoginDetail(req, res, next){
        if (Helper.isPost(req)) {
            const response = await this.getLoginDetails(req, res, next, {
                fromDate: req.body.from_date, 
                endDate: req.body.to_date
            });

            res.render('dashboard/agent_login_detail', {
                layout   : false,
                dateRange: response?.date_range || {},
                result   : response?.result || {},
            });
        } else {
            res.render('dashboard/agent_login_detail');
        }
    };
};