import { ObjectId } from 'mongodb';

import * as Constants from "../config/global_constant.mjs";

/**
 * Datatable configuration
 *
 * @param req		As	Request Data
 * @param res		As 	Response Data
 * @param options	As Object of data have multiple values
 *
 * @return json
 */
export const configDatatable = (req,res,options)=>{
	let resultDraw	= 	req?.body?.draw || 1;
	let defaultSort =	{_id: Constants.SORT_DESC};

	try{
		/** Searching  **/
		let conditions 	=	{};
		let searchData 	=	(req.body.columns) ? req.body.columns :[];
		if(searchData.length > 0){
			searchData.forEach((record,index)=>{
				let fieldName 	= ((record.field_name) ? record.field_name : ((record.data) ? record.data : ''));
				let searchValue	= (record.search && record.search.value) ? record.search.value.trim() : '';
				let fieldType	= (record.field_type) ? record.field_type : '';
				if(searchValue && fieldName){
					switch(fieldType){
						case Constants.NUMERIC_FIELD:
							conditions[fieldName] = parseInt(searchValue);
						break;
						case Constants.OBJECT_ID_FIELD:
							conditions[fieldName] = new ObjectId(searchValue);
						break;
						case Constants.EXACT_FIELD:
							conditions[fieldName] = searchValue;
						break;
						default:
							try{
								searchValue 			= cleanRegex(searchValue);
								conditions[fieldName] 	= new RegExp(searchValue, "i");
							}catch(e){
								conditions[fieldName] 	= searchValue;
							}
						break;
					}
				}
			});
		}

		/** Sorting **/
		let sortConditions = {};
		if(req?.body?.order?.length){
			req?.body?.order.forEach(sortData => {
				let sortKey =	sortData?.column || "";
				let sortDir =	sortData?.dir == "asc" &&  Constants.SORT_ASC || Constants.SORT_DESC;
				let keyName = 	searchData?.[sortKey]?.field_name || (searchData?.[sortKey]?.data || "");

				if(keyName) sortConditions[keyName] = sortDir;
			});
		}

		return {
			sort_conditions : Object.keys(sortConditions).length && sortConditions || defaultSort,
			conditions 		: conditions,
			result_draw 	: resultDraw,
			options 		: options,
		};
	}catch(err){
		console.error('Datatable helper error in utils/dataTableHelper:', err);
		return {
			conditions 		: {},
			sort_conditions : defaultSort,
			result_draw 	: resultDraw,
			options 		: options,
		};
	}
}//End configDatatable()

/**
 * function is used to clear regular expression string
 *
 * @param regex	As Regular expression
 *
 * @return regular expression
 */
export const cleanRegex = (regex)=>{
	regex = (regex) ? regex.replace(/[\u200B-\u200D\uFEFF]/g, '') :regex;
	if(Constants.NOT_ALLOWED_CHARACTERS_FOR_REGEX && Constants.NOT_ALLOWED_CHARACTERS_FOR_REGEX.length>0){
		for(let i in Constants.NOT_ALLOWED_CHARACTERS_FOR_REGEX){
			regex = regex.split(Constants.NOT_ALLOWED_CHARACTERS_FOR_REGEX[i]).join('\\'+Constants.NOT_ALLOWED_CHARACTERS_FOR_REGEX[i]);
		}
		return regex ? regex.trim() :regex;
	}else{
		return regex ? regex.trim() :regex;
	}
}//end cleanRegex