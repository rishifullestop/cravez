import { body} from 'express-validator';
import * as Constants from "../../../config/global_constant.mjs";

// Validation rules for vacation request operations
const addEditVacationRequestValidation = [
	body('team_member')
		.notEmpty()
		.withMessage((value, { req }) => {
			return req.__('admin.leave_management.please_select_team_member');
		}),
	body('leave_type')
		.notEmpty()
		.withMessage((value, { req }) => {
			return req.__('admin.leave_management.please_select_leave_type');
		}),
	body('leave_status')
		.notEmpty()
		.withMessage((value, { req }) => {
			return req.__('admin.leave_management.please_select_leave_status');
		}),
	body('leave_date')
		.custom((value,{req, res, next,location,path})=>{
			let fromDate = req?.body?.from_date|| false; 
			let toDate 	 = req?.body?.to_date|| false; 

			if(!fromDate || !toDate){
				return Promise.reject(req.__('admin.leave_management.please_select_leave_date', { value, location, path }));
			}else{
				return true;
			}
		}),  
	body('rejection_reason')
		.custom((value,{req, res, next,location,path})=>{
			let leaveStatus = req?.body?.leave_status|| false; 

			if(leaveStatus == Constants.REJECTED && !value){
				return Promise.reject(req.__('admin.leave_management.please_enter_rejection_reason', { value, location, path }));
			}else{
				return true;
			}
		}), 
];

// Validation for weekly off operations
const addWeeklyOffValidation = [
	body('team_member')
		.notEmpty()
		.withMessage((value, { req }) => {
			return req.__('admin.leave_management.please_select_team_member');
		})
		.isMongoId()
		.withMessage((value, { req }) => {
			return req.__('admin.system.invalid_team_member');
		}),
	body('dates')
		.notEmpty()
		.withMessage((value, { req }) => {
			return req.__('admin.leave_management.please_select_dates');
		})
		.isString()
		.withMessage((value, { req }) => {
			return req.__('admin.leave_management.invalid_dates_format');
		})
];

export {
	addEditVacationRequestValidation,
	addWeeklyOffValidation
}; 