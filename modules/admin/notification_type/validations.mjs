import { body } from 'express-validator';
import { ObjectId } from 'mongodb';
import Tables from "../../../config/database_tables.mjs";
import * as Constants from "../../../config/global_constant.mjs";
import { getDb } from "../../../config/connection.mjs";

/**
 * Validation rules for adding/editing notification type
 */
export const addEditNotificationTypeValidation = [
    body('notification_type')
        .if((value, { req }) => !req.params.id) // Only validate for new records
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.notification_types.please_enter_notification_type')
            })
        .isNumeric()
            .withMessage((value, { req }) => {
                return req.__('admin.notification_types.notification_type_must_be_numeric')
            })
        .custom((value, { req, res, next }) => {
            if (value && value <= 0) {
                return Promise.reject(req.__('admin.notification_types.notification_type_must_be_greater_then_0'));
            }
            return true;
        })
        .custom(async (value, { req, res, next }) => {
            if (value) {
                return checkNotificationTypeUnique(value, req).then(quRes => {
                    if (quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('admin.notification_types.notification_type_is_already_exist'));
                    }
                    return true;
                }).catch(next);
            }
            return true;
        }),
    
    body('title_en')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.notification_types.please_enter_title_en')
            }),    
    body('title_ar')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.notification_types.please_enter_title_ar')
            }),
    
    body('message_en')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.notification_types.please_enter_message_en')
            }),
    
    body('message_ar')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.notification_types.please_enter_message_ar')
            }),
];

/**
 * Validate if notification type already exists
 * @param {number} value - Notification type value
 * @param {Object} req - Request object
 * @returns {Promise<Object>} Validation result
 */
const checkNotificationTypeUnique = async (value, req) => {
    /** Set conditions */
    let conditions = { notification_type: parseInt(value) };
    if (req.params && req.params.id) {
        conditions["_id"] = { $ne: new ObjectId(req.params.id) };
    }

    // Find existing notification type with same notification_type
    const dbInstance = getDb();
    const existingNotificationType = await dbInstance.collection(Tables.NOTIFICATION_TYPES).findOne(conditions, { projection: { _id: 1 } });

    return {
        status: existingNotificationType && existingNotificationType._id ? Constants.STATUS_ERROR : Constants.STATUS_SUCCESS
    };
}; 