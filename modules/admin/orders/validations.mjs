import { body } from 'express-validator';
import * as Constants from "../../../config/global_constant.mjs";

// Module change status validation rules
export const changeStatusValidation = [
    body('order_status')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.orders.please_select_order_status');
        }),
    body('rejection_reason')
        .custom((value,{req, res, next,location,path})=>{
            let orderStatus = req.body.order_status;
            if(!value && orderStatus && orderStatus != Constants.ORDER_CANCELLED && Constants.UPDATE_ORDER_STATUS?.[orderStatus]?.reason){
                return Promise.reject(req.__('admin.orders.please_enter_rejection_condition'));
            }else{
                return true;
            }
        }),
    body('cancel_reason')
        .custom((value,{req, res, next,location,path})=>{
            let orderStatus = req.body.order_status;
            if(!value && orderStatus && orderStatus == Constants.ORDER_CANCELLED){
                return Promise.reject(req.__('admin.orders.please_select_cancel_reason'));
            }else{
                return true;
            }
        })
];

// Module reject order validation rules
export const rejectOrderValidation = [
    body('rejection_reason')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.orders.please_enter_rejection_condition');
        })
];

// Module confirm status validation rules
export const confirmStatusValidation = [
    body('confirm_status')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.orders.please_select_confirm_status');
        })
];

// Module refund amount validation rules
export const refundAmountValidation = [
    body('refund_amount')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.orders.please_enter_refund_amount');
        })
        .custom((value,{req, res, next,location,path})=>{
            if(value && (isNaN(value) || value <= 0)){
                return Promise.reject(req.__('admin.orders.please_enter_valid_refund_amount'));
            }else{
                return true;
            }
        }),
    body('refund_type')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.orders.please_select_refund_type');
        }),
    body('caused_by')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.orders.please_select_caused_by');
        })
];


