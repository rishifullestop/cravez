import { body } from 'express-validator';
import { cleanRegex } from "../../../utils/index.mjs";
import { ObjectId } from 'mongodb';
import Tables from '../../../config/database_tables.mjs';
import { getDb } from '../../../config/connection.mjs';
import * as Constants from "../../../config/global_constant.mjs";

// Module add / edit ticket validation rules
const addEditValidation = [
    body('ticket_no')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('tickets.please_enter_ticket_no');
            })
        .isNumeric()
            .withMessage((value, { req }) => {
                return req.__('tickets.invalid_ticket_number');
            })
        .custom((value, { req }) => {
            if(value) {
                return validateTicketNo(value, req).then(quRes => {
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('tickets.whoops_you_have_entered_an_already_used_ticket_no_please_try_something_different'));
                    } else {
                        return true;
                    }
                });
            } else {
                return true;
            }
        }),
    body('category_id')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('tickets.please_select_category_id');
            }),
    body('sub_category_id')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('tickets.please_select_sub_category_id');
            }),
    body('title')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('tickets.please_select_title');
            }),
    body('status')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('tickets.please_select_status');
            }),
    body('description')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('tickets.please_enter_description');
            }),
    body('department')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('tickets.please_select_department');
            }),
];

/**
 * Validate if ticket no already exists
 * @param {String} value - Ticket no value
 * @param {Object} req - Request object
 * @returns {Promise<Object>} Validation result
 */
const validateTicketNo = async (value, req) => {
    /** Set conditions for ticket no */
    let conditions = {
        ticket_id: {$regex: '^' + cleanRegex(value) + '$', $options: 'i'}
    };
    
    /** If edit ticket, exclude current ticket from validation */
    if(req?.params?.id)  conditions["_id"] = {$ne: new ObjectId(req.params.id)};
    
    /** Find existing ticket no with same ticket no */
    const dbInstance = getDb();
    const existingTicketNo = await dbInstance.collection(Tables.TICKETS).findOne(conditions, {projection: {_id: 1}});

    return {
        status: existingTicketNo && existingTicketNo._id ? Constants.STATUS_ERROR : Constants.STATUS_SUCCESS
    }
};

// Module add comment validation rules
const addCommentValidation = [
    body('comment')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('tickets.please_enter_comment');
            })
]

export {
    addEditValidation,
    addCommentValidation
}; 
