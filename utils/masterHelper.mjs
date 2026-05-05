
import Tables from './../config/database_tables.mjs';
import { getDb } from '../config/connection.mjs';
import { ObjectId } from 'mongodb';
import * as Constants from "../config/global_constant.mjs";

/**
 * Function to get master list
 *
 * @param req		As	Request Data
 * @param res		As 	Response Data
 * @param next		As	Callback argument to the middleware function
 * @param options	As	Request params
 *
 * @return json
 */
export const getMasterList = (req,res,next,options)=>{
	return new Promise(async resolve=>{
		try{
			if(!options || !options?.type || options?.type?.constructor !== Array || options?.type?.length <=0){
				/** Send error response **/
				return resolve({
					status 	:	Constants.STATUS_ERROR,
					message	: 	res.__("admin.system.something_going_wrong_please_try_again")
				});
			}

			/** Set master conditions */
			let masterConditions = {
				status			:	Constants.ACTIVE,
				dropdown_type	:	{$in : options?.type},
			};
			if(options?.parent_id) masterConditions.parent_id = new ObjectId(options?.parent_id);

			/** Get master List **/
			const dbInstance = getDb();
			const masters    = dbInstance.collection(Tables.MASTERS);
			let result = await masters.aggregate([
				{$match : 	masterConditions},
				{$sort  : 	{name: Constants.SORT_ASC}},
				{$group	:	{
					_id		:	"$dropdown_type",
					data	:	{$push : {
						_id	: "$_id",
						master_descriptions : "$master_descriptions"
					}}
				}},
			]).toArray();

			let finalResult = {};
			if(result && result.length >0){
				result.map(item=>{
					let masterType =	item._id || "";
					let masterData =	item.data || [];

					if(masterType){
						finalResult[masterType] = masterData;
					}
				});
			}

			/** Send success response **/
			resolve({
				status 	: 	Constants.STATUS_SUCCESS,
				result 	: 	finalResult,
			});
		}catch(e){
			/** Send error response **/
			resolve({
				status 	:	Constants.STATUS_ERROR,
				message	: 	res.__("admin.system.something_going_wrong_please_try_again")
			});
		}
	}).catch(next);
}// end getMasterList()