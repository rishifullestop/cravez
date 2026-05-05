import { body } from 'express-validator';
import * as Constants from "../../../config/global_constant.mjs";

// Module add / edit validation rules
const addEditValidation = [
    body('title')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.push_notifications.please_enter_title');
        }),
    body('message')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.push_notifications.please_enter_message');
        }),
    body('schedule_type')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.push_notifications.please_select_schedule_type');
        }),
    body('scheduled_time')
        .custom((value, { req }) => {
            if (req.body.schedule_type === Constants.FUTURE_PN && !value) {
                throw new Error(req.__('admin.push_notifications.please_select_schedule_time'));
            }
            return true;
        }),
    body('users')
        .custom((value, { req }) => {
            const allUsers = (req.body.all_users) ? req.body.all_users.split(",") : [];
            const usersList = req.body.users;
            
            if ((!usersList || usersList.length == 0) && (!allUsers || allUsers.length == 0)) {
                throw new Error(req.__('admin.push_notifications.no_user_available_with_these_filters'));
            }
            return true;
        }),
    body('payload_value')
        .custom((value, { req }) => {
            if (req.body.payload_type && !value && 
                [Constants.PAYLOAD_NEWSFEED, Constants.PAYLOAD_OFFERS, Constants.PAYLOAD_EDIT_PROFILE].indexOf(req.body.payload_type) === -1) {
                throw new Error(req.__('admin.push_notifications.payload_value_required_for_selected_payload'));
            }
            return true;
        })
];

export {
    addEditValidation
}; 