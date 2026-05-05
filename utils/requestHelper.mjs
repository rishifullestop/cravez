
import * as Constants from "../config/global_constant.mjs";

/**
 *  Function for convert into api sent format
 */
export const sendApiResponse = (req, res, next, response)=>{
	if(!response.status) response.status = Constants.STATUS_SUCCESS;
	if(response.message && typeof response.message === "string") {
		response.message = [{ msg: response.message, param: response.status }];
	}

	// Convert the object to a JSON string
	const jsonString = JSON.stringify(response);

	// Encode the JSON string as a binary buffer
	const binaryBuffer = Buffer.from(jsonString, 'utf-8');

	// Encode the binary buffer to a Base64 string
	const encoded = binaryBuffer.toString('base64');

	/** Send response */
	return res.send({response: encoded});	
}// end sendApiResponse()

/**
 * Function to Check request is called from mobile of web
 *
 * @param req	As Request Data
 *
 * @return boolean
 */
export const isMobileApi = (req)=>{
	if(req?.headers?.authkey == Constants.WEBSITE_HEADER_AUTH_KEY && req?.path?.includes('/api/')){
		return true;
	}else{
		return false;
	}
}//End isMobileApi()

/**
 * Function to Check request is called from  web
 *
 * @param req	As Request Data
 *
 * @return boolean
 */
export const isWebApi = (req)=>{
	if(req?.headers?.authkey == Constants.WEBSITE_HEADER_AUTH_KEY && req?.body?.api_type == "web"){
		return true;
	}else{
		return false;
	}
}//End isWebApi()