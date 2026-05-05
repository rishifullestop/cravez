import { ObjectId } from 'mongodb';
import { parallel } from 'async';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { isPost, configDatatable, sanitizeData } from "../../../../utils/index.mjs";
import { saveSystemLogs } from "../../../../services/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

/**
 * Notification Types Model Class
 */
class NotificationTypes {
    constructor(db) {
        this.db = db;
        this.notificationTypesCollection = db.collection(Tables.NOTIFICATION_TYPES);
    }

    /**
     * Function to get notification type list
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

            /** Configure Datatable conditions */
            const dataTableConfig = await configDatatable(req, res, null);

            // Get list or count of area blocks 
            let dbRes = await this.notificationTypesCollection.aggregate([
                { $match: dataTableConfig.conditions },
                {$facet : {
                    list : [
                        {$sort: dataTableConfig.sort_conditions },
                        {$skip: skip },
                        {$limit: limit },
                        {$project: {
                            _id: 1, title: 1, message: 1, notification_type: 1, constants: 1, modified: 1
                        }}
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
            /** render notification listing page **/
            req.breadcrumbs(BREADCRUMBS['admin/notification_types/list']);
            res.render('list');
        }
    }

    /**
     * Function for add or edit notification type
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async addEditNotificationType(req, res, next) {
        let isEditable = (req.params.id) ? true : false;
        let notificationTypeId = (req.params.id) ? new ObjectId(req.params.id) : new ObjectId();

        if (isPost(req)) {            
            /** Sanitize Data **/
            req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
            let notificationType = (req.body.notification_type) ? parseInt(req.body.notification_type) : "";

            /** Save notification type details **/
            const updateData = {
                $set: {
                    title: {
                        en: req.body.title_en,
                        ar: req.body.title_ar,
                    },
                    message: {
                        en: req.body.message_en,
                        ar: req.body.message_ar,
                    },
                },
                $setOnInsert: {
                    constants: req.body.constants,
                    notification_type: notificationType,
                },
            };

            await this.notificationTypesCollection.updateOne(
                { _id: notificationTypeId },
                updateData,
                { upsert: true }
            );

            /** Send success response **/
            let message = (isEditable) ? res.__("admin.notification_types.notification_has_been_updated_successfully") : res.__("admin.notification_types.notification_has_been_added_successfully");
            if (!isEditable) req.flash(Constants.STATUS_SUCCESS, message);
            res.send({ status: Constants.STATUS_SUCCESS, message: message });

            /** Save system logs */
            saveSystemLogs(req, res, {
                user_id: req.session.user._id,
                parent_id: notificationTypeId,
                activity_module: Constants.SYSTEM_LOG_MODULE_NOTIFICATION_TYPE,
                activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
            });            
        } else {    
            let notificationDetails = {};
            if(isEditable){
                notificationDetails = await this.notificationTypesCollection.findOne(
                    { _id: new ObjectId(req.params.id) },
                    { projection: { _id: 1, title: 1, message: 1, notification_descriptions: 1, constants: 1, notification_type: 1 } }
                );                
            }

            /** Send error response **/
            if (isEditable && !notificationDetails) {
                return res.status(400).send({ status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") });
            }

            let lastType = await this.notificationTypesCollection.findOne({}, 
                { projection: { notification_type: 1 }, sort: { notification_type: Constants.SORT_DESC } }
            );
            let notificationType = lastType && lastType.notification_type + 1 || 1;           
            
            /** Render add/edit page  **/
            res.render('add_edit', {
                layout: false,
                result: notificationDetails ||{},
                is_editable: isEditable,
                notification_type: notificationType
            });            
        }
    }

    /**
     * Function to delete notification type
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async deleteNotificationType(req, res, next) {        
        const notificationTypeId = new ObjectId(req.params.id);

        /** Check if notification type exists **/
        const notificationType = await this.notificationTypesCollection.findOne(
            { _id: notificationTypeId },
            { projection: { _id: 1 } }
        );

        if (!notificationType) {
            req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
            return res.redirect(Constants.WEBSITE_ADMIN_URL+'notification_types');
        }

        /** Delete notification type **/
        await this.notificationTypesCollection.deleteOne({ _id: notificationTypeId });
        
        /** Save system logs */
        saveSystemLogs(req, res, {
            user_id: req.session.user._id,
            parent_id: notificationTypeId,
            activity_module: Constants.SYSTEM_LOG_MODULE_NOTIFICATION_TYPE,
            activity_type: Constants.ACTIVITY_TYPE_DELETE,
        });
        
        /** Send success response **/
        req.flash(Constants.STATUS_SUCCESS, res.__("admin.notification_types.notification_has_been_deleted_successfully"));
        res.redirect(Constants.WEBSITE_ADMIN_URL+'notification_types');        
    }
}

export default NotificationTypes; 