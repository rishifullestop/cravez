import { ObjectId } from 'mongodb';
import { parallel } from 'async';
import clone from 'clone';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { isPost, configDatatable, newDate, getUtcDate } from "../../../../utils/index.mjs";
import { generateNotificationUrl } from "../../../../services/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

/**
 * Notification Model Class
 */
class Notification {
    constructor(db) {
        this.db = db;
        this.notificationsCollection = db.collection(Tables.NOTIFICATIONS);
    }

    /**
     * Function to get notification list
     *
     * @param req As Request Data
     * @param res As Response Data
     *
     * @return render/json
     */
    async list(req, res, next) {
        if (isPost(req)) {
            let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
            let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
            let fromDate = (req.body.fromDate) ? req.body.fromDate : "";
            let toDate = (req.body.toDate) ? req.body.toDate : "";
            let authId = (req.session.user._id) ? req.session.user._id : "";
            let authUserRoleId = (req.session.user.user_role_id) ? req.session.user.user_role_id : "";

            /** Configure Datatable conditions */
            const dataTableConfig = await configDatatable(req, res, null);
            
            /** Set common conditions **/
            let commonConditions = {
                $or: [
                    { user_id: new ObjectId(authId) },
                    {
                        user_id: "",
                        user_role_id: authUserRoleId
                    }
                ]
            };

            /** Conditions for date */
            if (fromDate != "" && toDate != "") {
                dataTableConfig.conditions["created"] = { $gte: newDate(fromDate), $lte: newDate(toDate) };
            }

            dataTableConfig.conditions = Object.assign(commonConditions, dataTableConfig.conditions);

            // Get list or count of notifications 
            let dbRes = await this.notificationsCollection.aggregate([
                {$match: commonConditions },
                {$lookup: {
                    "from": Tables.USERS,
                    "localField": "created_by",
                    "foreignField": "_id",
                    "as": "users_created_by"
                }},
                {$project: {
                    _id: 1, message: 1, created: 1, created_by: 1, created_role_id: 1, user_role_id: 1, user_id: 1, url: 1, extra_parameters: 1, notification_type: 1,
                    created_by_name: { $arrayElemAt: ["$users_created_by.full_name", 0] }, parent_table_id: 1
                }},
                {$match: dataTableConfig.conditions},
                {$facet : {
                    list : [
                        {$sort: dataTableConfig.sort_conditions },
                        {$skip: skip },
                        {$limit: limit },
                    ],
                    count: [
                        {$count: "count"},
                    ],
                }}
            ]).toArray();

            let list = dbRes?.[0]?.list ||[];
            const linksRes = await generateNotificationUrl(req, res, {result:list});
            list = linksRes?.data || [];

            /** Send response **/
            res.send({
                status: Constants.STATUS_SUCCESS,
                draw: dataTableConfig.result_draw,
                data			:   list,
                recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
                recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
            });           
        } else {
            req.breadcrumbs(BREADCRUMBS['admin/notification/list']);
            res.render('list');
        }
    }

    /**
     * Function to get header notifications
     *
     * @param req As Request Data
     * @param res As Response Data
     *
     * @return render/json
     */
    async getHeaderNotifications(req, res, next) {
        let authId = (req.session.user && req.session.user._id) ? req.session.user._id : "";
        let authUserRoleId = (req.session.user && req.session.user.user_role_id) ? req.session.user.user_role_id : "";

        /** Send error response **/
        if (!authId) return res.send({ status: Constants.STATUS_ERROR, result: [], message: res.__("admin.system.invalid_access") });

        try {
            /** Set common conditions ** */
            let commonConditions = {
                $or: [
                    { user_id: new ObjectId(authId) },
                    {
                        user_id: "",
                        user_role_id: authUserRoleId
                    }
                ]
            };

            /** Get list of notification ** */
            const result = await this.notificationsCollection.find(
                commonConditions,
                { projection: { _id: 1, message: 1, url: 1, created: 1, is_seen: 1, notification_type: 1, extra_parameters: 1, parent_table_id: 1 } }
            ).sort({ created: Constants.SORT_DESC }).limit(Constants.ADMIN_HEADER_NOTIFICATION_DISPLAY_LIMIT).toArray();

            /** Update unread notifications as read notifications ** */
            let updateNotificationConditions = clone(commonConditions);
            updateNotificationConditions["is_seen"] = Constants.NOT_SEEN;
            
            await this.notificationsCollection.updateMany(updateNotificationConditions, {
                $set: {
                    is_seen: Constants.SEEN,
                    is_read: Constants.READ,
                    modified: getUtcDate()
                }
            });

            /** Function to generate notification url ** */
            const linksRes = await generateNotificationUrl(req, res, { result: result });
            res.send({
                status: Constants.STATUS_SUCCESS,
                result: linksRes?.data || [],
            });
        } catch (error) {
            console.error('Error in getHeaderNotifications:', error);
            /** Send error response ** */
            res.send({
                status: Constants.STATUS_ERROR,
                result: [],
                message: res.__("admin.system.something_going_wrong_please_try_again")
            });
        }
    }

    /**
     * Function to get header notifications counter
     *
     * @param req As Request Data
     * @param res As Response Data
     *
     * @return render/json
     */
    async getHeaderNotificationsCounter(req, res, next) {
        let authId = (req.session.user && req.session.user._id) ? req.session.user._id : "";
        let authUserRoleId = (req.session.user && req.session.user.user_role_id) ? req.session.user.user_role_id : "";

        if (authId) {
            try {
                /** Set common conditions ** */
                let commonConditions = {
                    $or: [
                        { user_id: new ObjectId(authId) },
                        {
                            user_id: "",
                            user_role_id: authUserRoleId
                        }
                    ],
                    is_seen: Constants.NOT_SEEN,
                };

                /** Get count of unseen notification ** */
                const count = await this.notificationsCollection.countDocuments(commonConditions);
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    counter: count || 0,
                });
            } catch (error) {
                console.error('Error in getHeaderNotificationsCounter:', error);
                res.send({
                    status: Constants.STATUS_ERROR,
                    counter: 0,
                    message: res.__("admin.system.something_going_wrong_please_try_again")
                });
            }
        } else {
            /** Send error response ** */
            res.send({
                status: Constants.STATUS_ERROR,
                counter: 0,
                message: res.__("admin.system.invalid_access")
            });
        }
    }
}

export default Notification; 