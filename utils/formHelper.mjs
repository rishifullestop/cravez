import { validationResult } from 'express-validator';

import * as Constants from "../config/global_constant.mjs"; 
import {parseValidation} from "./dataSanitizer.mjs"; 

/**
 * To check request method is post or get
 *
 * @param req As Request Data
 *
 * @return boolean
 */
export const isPost = (req)=>{
	if(req?.method?.toLowerCase() == "post"){
		return true;
	}else{
		return false;
	}
}//End isPost()

/**
 * Function used to convert
 *
 * @param req 		As	Request Data
 * @param res 		As	Response Data
 * @param options	As	data in Object
 *
 * @return json
 */
export const convertMultipartReqBody = async (req, res, next)=>{
	if(!isPost(req)) return next();

	await convertMultipartFormData(req,res);
	return next();
}// end convertMultipartReqBody()

/**
 * Function to convert multipart form data
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
export const convertMultipartFormData = (req,res) =>{
	if(req.body && Object.keys(req.body).length >0){
		let bodyData = { ...req.body }; // or use clone if necessary

		Object.keys(bodyData).forEach((key) => {
			const value = bodyData[key];

			if (typeof value === 'string' && (value.trim().startsWith('{') || value.trim().startsWith('['))) {
				try {
					bodyData[key] = JSON.parse(value);
				} catch (e) {
					// If parsing fails, keep the original string
					bodyData[key] = value;
				}
			}
		});

		req.body = bodyData;
	}

	if(req.files && Object.keys(req.files).length >0 && !res.exclude_files){
		Object.keys(req.files).forEach((key)=>{
			let oldKey = key;
			try{
				key     = JSON.parse(key);
				oldKey  = key;
			}catch(e){
				key = key.replace(/\[.*\]/, '');
			}
			try{
				try{
					req.files[key] = JSON.parse(req.files[key]);
				}catch(e){
					if(!req.files[key]){
						req.files[key] = [];
					}
					if(req.files[oldKey]){
						req.files[key].push(req.files[oldKey]);
						delete req.files[oldKey];
					}
				}
			}catch(e){
				req.files[key] = req.files[key];
			}
		});
	}

	return {};
}//end convertMultipartFormData();

// Validation middleware handler
export const validateRequest = (req, res, next) => {
    if(!isPost(req)) return next();

    const allErrors = validationResult(req);
    if (!allErrors.isEmpty()) {
        let formErrors = parseValidation(allErrors.errors);
        return res.send({
            status: Constants.STATUS_ERROR,
            message: formErrors
        });
    }
    next();
};

// Mock request for internal use
export const applyValidationInterCallFunction = async (req, res, next, rules) => {
	const mockReq = {body: req.body};

	// Manually run validations
	const validations = rules(req);
	for (let validation of validations) {
	  await validation.run(mockReq);
	}
  
	const allErrors = validationResult(mockReq);
	if (!allErrors.isEmpty()) {
		let formErrors = parseValidation(allErrors.errors);
	  	return { status: Constants.STATUS_ERROR, message: formErrors };
	}

	return { status: Constants.STATUS_SUCCESS};
}