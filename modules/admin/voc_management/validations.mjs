import { body } from 'express-validator';
import * as Constants from "../../../config/global_constant.mjs";

/**
 * Validation for add/edit VOC
 */
export const addEditVOCValidation = [
    body('voc_for')    
        .notEmpty()
        .withMessage((value, { req }) => {
            return req.__('admin.voc_management.please_select_voc_for')
        }),    
    body('captain_type')
        .custom(async (value, { req }) => {
            if(!value && req.body.voc_for == Constants.VOC_FOR_CAPTAIN){
                return Promise.reject(req.__('admin.voc_management.please_select_captain_type'));
            }
            return false;
        }),
    body('client_type')
        .custom(async (value, { req }) => {
            if(!value && req.body.voc_for == Constants.VOC_FOR_CLIENT){
                return Promise.reject(req.__('admin.voc_management.please_select_client_type'));
            }
            return false;
        })
];

/**
 * Validation for add order VOC
 */
export const addOrderVOCValidation = [
    body('type')    
        .notEmpty()
            .withMessage((value, { req }) => {
                return req.__('admin.voc_management.please_select_type')
            }),  
    body('voc_for')
        .custom(async (value, { req }) => {
            if(!value && !req?.params?.voc_type){
                return Promise.reject(req.__('admin.voc_management.please_select_voc_for'));
            }
            return false;
        })
];