import crypto from 'node:crypto';

import * as Constants from "../config/global_constant.mjs";

import randomstring from 'randomstring';
const generate = randomstring.generate;

/**
 * Function to generate MD5 hash
 *
 * @param req		As Request Data
 * @param res		As Response Data
 * @param next		As Callback argument to the middleware function
 * @param options	As Object data
 *
 * @return json
 **/
export const generateMD5Hash = (password)=>{
	let newHash	= crypto.createHash('md5').update(password).digest('hex');
	return newHash;
}; //End  generateMD5Hash()

/**
 *  Function to generate a random sting
 *
 * @param req 		As Request Data
 * @param res 		As Response Data
 * @param options	As options
 *
 * @return string
 */
export const getRandomString = (req,res,options)=>{
	try{
		let srtingLength	= parseInt(options && options?.srting_length ||  Constants.DEFAULT_RANDOM_NUMBER_LENGTH);

		/**Generate random string **/
		let unique = generate({
			length			: srtingLength,
			charset			: 'alphanumeric',
			capitalization	: 'uppercase'
		});

		return {
			status 	: 	Constants.STATUS_SUCCESS,
			result	:	unique
		};
	}catch(err){
		console.error('Error in utils/securityHelper:', err);

		return {
			status 	: 	Constants.STATUS_ERROR,
			result	:	''
		};
	}
}//End getRandomString()