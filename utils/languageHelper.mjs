import { ObjectId } from 'mongodb';

import * as Constants from "../config/global_constant.mjs";
import { getDb } from '../config/connection.mjs';
import Tables from '../config/database_tables.mjs';

/**
 * Function for get languages list
 *
 * @param defaultLanguage As Default Language
 *
 * @return json
 */
export const getLanguages = async (defaultLanguage) =>{
	try{
		/** Set  Condition **/
		let conditions	=	{active: Constants.ACTIVE};
		if(defaultLanguage) conditions._id = new ObjectId(defaultLanguage);

		const dbInstance = getDb();
		const result = await dbInstance.collection(Tables.LANGUAGES)
					.find(conditions)
					.toArray();

		return result;
	} catch (err) {
		console.error('Error in utils/languageHelper:', err);

		/** Send blank response **/
		return [];
	}
}//End getLanguages()

/**
 * Function to convert multi language data
 *
 * @param to		As	Recipient Email Address
 * @param repArray  As 	Response Array
 * @param options  	As 	data as json format
 *
 * @return json
 */
export const convertDataToMultiLanguage = (req,res,options) =>{
	if(!options?.result?.length || !options?.description_field || !options?.field) return options?.result || [];

	let dbKey = options?.description_field || "";
	let field = options?.field || "";

	options?.result?.forEach(records=>{
		let multiLanguageData = records?.[dbKey] || {};
		let multiData = {};

		Constants.SYSTEM_LANGUAGES.forEach(langData=>{
			multiData[langData.code] = multiLanguageData?.[langData.id]?.[field] || "";
		});

		records[field] = multiData;
		delete records[dbKey];
	});

	return options?.result || [];
}// end convertDataToMultiLanguage