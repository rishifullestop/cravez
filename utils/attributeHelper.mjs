
import * as Constants from "../config/global_constant.mjs";
import { getDb } from '../config/connection.mjs';
import Tables from '../config/database_tables.mjs';


/**
 * Function for get attributes
 *
 * @param defaultLanguage	As Default Language
 *
 * @return json
 */
export const getAttributes = async (req,res,next,options={}) =>{
	try{
		let type =	options?.type || "";

		/** Send error response */
		if(!type) return {status: STATUS_ERROR, message : res.__("system.missing_parameters")};

		/** Set conditions */
		let conditions = {type: options.type};

		if(options.type == "vacation_leave_type" && typeof options.is_show !== typeof undefined) conditions.is_show = options.is_show;

		const dbInstance = getDb();
		const dbRes = await dbInstance.collection(Tables.ATTRIBUTES).find(
			conditions,
			{ projection: { created:0,modified:0,type:0 } }
		).sort({order:Constants.SORT_ASC}).toArray();

		return dbRes;
	}catch(err){
		console.error('Error in utils/attributeHelper:', err);

		return [];
	}
}//End getAttributes()

/**
 * Function to generate unique attribute id's
 *
 *  @param req		As	Request Data
 * @param res		As 	Response Data
 * @param next		As	Callback argument to the middleware function
 * @param options	As	Request params
 *
 * @return json
 */
export const getAttributeUniqueId = async (req, res,next)=>{
	try{
		const dbInstance = getDb();
		const result = await dbInstance.collection(Tables.ATTRIBUTES).findOne(
			{},
			{
				projection: {attribute_id: 1},
				sort: {attribute_id: Constants.SORT_DESC}
			}
		);

		let uniqueAttributeId = parseInt(result?.attribute_id || 0)+1;

		return {
			status: Constants.STATUS_SUCCESS,
			result: uniqueAttributeId
		}

	}catch(err){
		console.error('Error in utils/attributeHelper:', err);

		return {
			status: Constants.STATUS_ERROR,
			message: res.__("admin.system.something_going_wrong_please_try_again")
		}
	}
};//end getAttributeUniqueId();