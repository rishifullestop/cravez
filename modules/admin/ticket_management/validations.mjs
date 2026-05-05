import { body } from 'express-validator';
import { ObjectId } from 'mongodb';
import Tables from '../../../config/database_tables.mjs';
import { getDb } from '../../../config/connection.mjs';
import * as Constants from "../../../config/global_constant.mjs";
import { cleanRegex } from '../../../utils/index.mjs';

// Ticket add/edit validation rules
const addEditTicketValidation = [
    body('ticket_no')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.tickets.please_enter_ticket_no');
        })
        .isNumeric()
        .withMessage((value, { req }) => {
            return req.__('admin.tickets.invalid_ticket_number');
        })
        .custom((value, { req, res, next }) => {
            if (value) {
                return validateTicketNoUnique(value,req).then(quRes=>{
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('admin.tickets.whoops_you_have_entered_an_already_used_ticket_no_please_try_something_different'));
                    }else{
                        return true;
                    }
                }).catch(next);
            }            
            return true;
        }),
    body('category_id')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.tickets.please_select_category_id');
        }),
    body('sub_category_id')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.tickets.please_select_sub_category_id');
        }),
    body('title')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.tickets.please_select_title');
        }),
    body('description')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.tickets.please_enter_description');
        }),
    body('department')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.tickets.please_select_department');
        }), 
    body('order_id')
        .optional()
        .custom((value, { req, res, next  }) => {
            if (value) {
                return validateOrderId(value,req).then(quRes=>{
                    if(quRes.status != Constants.STATUS_SUCCESS) {
                        return Promise.reject(req.__('admin.tickets.order_id_is_not_valid'));
                    }else{
                        return true;
                    }
                }).catch(next);
            }            
            return true;
        }),
    body('client_name')
        .custom((value, { req }) => {
            if (!value && req.body.order_id) {
                return Promise.reject(req.__('admin.tickets.please_enter_client_name'));
            }
            return true;
        }),
    body('client_mobile_number')
        .custom((value, { req }) => {
            if(req.body.order_id){
                if (!value) {
                    return Promise.reject(req.__('admin.tickets.please_enter_client_mobile_number'));
                }else if(!Constants.TICKET_MOBILE_EXPRESSION.test(value)){
                    return Promise.reject(req.__('admin.tickets.invalid_client_mobile_number'));
                }
            }            
            return true;
        }),
    body('client_email')
        .optional()
        .isEmail()
        .withMessage((value, { req }) => {
            return req.__('admin.tickets.please_enter_valid_client_email');
        })
];

// Ticket comment validation rules
const addCommentValidation = [
    body('comment')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.tickets.please_enter_comment');
        })
];

// Ticket reassign validation rules
const reassignTicketValidation = [
    body('department')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.tickets.please_select_department');
        })
];

// Ticket review validation rules
const addReviewValidation = [
    body('review_rating')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.tickets.please_select_rating');
            }),
    body('qa_review')
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.tickets.please_enter_review');
            })
];

// Ticket reopen validation rules
const reopenTicketValidation = [
    body('department')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.tickets.please_select_department');
        })
];

/**
 * Validate if ticket no already exists
 * @param {Object} db - Database instance
 * @param {Object} req - Request object
 * @returns {Promise<Array>} Array of validation errors
 */
const validateTicketNoUnique = async (value,req) => {
    /** Set conditions */
    let conditions = {
        ticket_id: {$regex : '^'+cleanRegex(value)+'$',$options : 'i'},
    };
    if(req.params && req.params.id) conditions["_id"] = {$ne: new ObjectId(req.params.id)};


    // Find existing ticket with same ticket no
    const dbInstance = getDb();
    const existingTicket = await dbInstance.collection(Tables.TICKETS).findOne(conditions, {projection: {_id: 1}});

    return {
        status: existingTicket && existingTicket._id && Constants.STATUS_ERROR || Constants.STATUS_SUCCESS
    }
};

/**
 * Validate entered order id is valid or not
 * @param {Object} db - Database instance
 * @param {Object} req - Request object
 * @returns {Promise<Array>} Array of validation errors
 */
const validateOrderId = async (value,req) => {
    // Check entered order id is valid or not
    const dbInstance = getDb();
    const existingOrder = await dbInstance.collection(Tables.ORDERS).findOne({unique_order_id: value}, {projection: {_id: 1}});

    return {
        status: existingOrder && existingOrder._id && Constants.STATUS_SUCCESS || Constants.STATUS_ERROR
    }
};


export {
    addEditTicketValidation,
    addCommentValidation,
    reassignTicketValidation,
    addReviewValidation,
    reopenTicketValidation
}; 