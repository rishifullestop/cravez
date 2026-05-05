import { body, param, query } from 'express-validator';
import { ObjectId } from 'mongodb';
import Tables from "../../../config/database_tables.mjs";
import * as Constants from "../../../config/global_constant.mjs";

/**
 * Validation for add/edit survey
 */
export const addEditSurveyValidation = [
    body('name_of_survey')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.survey_management.please_enter_name_of_survey')
        }), 
    body('survey_description')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.survey_management.please_enter_survey_description')
        }), 
    body('instance')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.survey_management.please_select_instance')
        }), 
    body('valid_till')
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.survey_management.please_select_valid_till')
        })
];