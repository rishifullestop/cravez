import { body } from 'express-validator';
import * as Constants from "../../../config/global_constant.mjs";

// Validation rules for add/edit break operations
const addEditBreakValidation = [ 
    body('user_id')
        .custom((value, { req }) => {
            if(!value && req?.session?.user?.team_head){
                throw new Error(req.__('admin.team_breaks.please_select_team_member'));
            }
            return true;
        }),
    body('break_type')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.team_breaks.please_select_break_type');
        }),
    body('start_time')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.team_breaks.please_select_break_start_time');
        })
        .custom((value, { req }) => {
            let currentHours 	=   new Date().getHours();
			let currentMinutes 	=   new Date().getMinutes();
            let currentTime		=   parseFloat(currentHours+"."+currentMinutes);
            let tmpVal          =   parseFloat(value && value.replace(':','.') || 0);
            
            if(tmpVal  < currentTime){
                throw new Error(req.__('admin.team_breaks.start_time_should_be_greater_than_current_time'));
            }
            return true;
        }),
    body('end_time')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.team_breaks.please_select_break_end_time');
        })
        .custom((value, { req }) => {
            let startTime   =   parseFloat(req?.body?.start_time && req?.body?.start_time.replace(':','.') || 0);
            let tmpVal      =   parseFloat(value && value.replace(':','.') || 0);
            if(tmpVal  <= startTime){
                throw new Error(req.__('admin.team_breaks.end_time_should_be_greater_than_start_time'));
            }
            return true;
        })
];

// Validation rules for approve/reject break operations
const approveRejectBreakValidation = [
    body('rejection_reason')
        .custom((value, { req }) => {
            if(!value && req.params.action == Constants.REJECTED) {
                throw new Error(req.__('admin.team_breaks.please_enter_reason'));
            }
            return true;
        })
];


export {
    addEditBreakValidation,
    approveRejectBreakValidation,
}; 