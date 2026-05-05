
/**
 * Function for sanitize form data
 *
 * @param data				As Request Body
 * @param notAllowedTags	As Array of not allowed tags
 *
 * @return json
 */
export const sanitizeData = (data,notAllowedTags)=>{

	let sanitized = arrayStripTags(data || {},notAllowedTags);
	return sanitized;
}//End sanitizeData()

/**
 * Function to strip not allowed tags from array
 *
 * @param array				As Data Array
 * @param notAllowedTags	As Tags to be removed
 *
 * @return array
 */
export const arrayStripTags = (array,notAllowedTags)=>{
	if (array.constructor === Object){
		var result = {};
	}else{
		var result = [];
	}
	for(let key in array){
		let value = (array[key] != null) ? array[key] : '';
		if(value.constructor === Array || value.constructor === Object) {
			result[key] = arrayStripTags(value,notAllowedTags);
		}else{
			result[key] = stripHtml(value.toString().trim(),notAllowedTags);
		}
	}
	return result;
}//End arrayStripTags()

/**
 * Function to Remove Unwanted tags from html
 *
 * @param html				As Html Code
 * @param notAllowedTags	As Tags to be removed
 *
 * @return html
 */
export const stripHtml = (html,notAllowedTags)=>{
	let unwantedTags= notAllowedTags;
	for(let j = 0;j < unwantedTags.length;j++){
		html = html.replace(unwantedTags[j],'');
	}
	return html;
}//end stripHtml();

/**
 * Function for parse validation
 *
 * @param validationErrors  As validationErrors Array
 * @param req				As Request Data
 *
 * @return array
 */
export const parseValidation = (validationErrors, req) => {
	let usedFields = [];
	let newValidations = [];
	if (Array.isArray(validationErrors)) {
		validationErrors.map((item) => {
			if (usedFields.indexOf(item.path) == -1) {
				usedFields.push(item.path);
				item.param = item.path ? item.path.replaceAll(".","_") :item;
				newValidations.push(item);
			}
		});
		return newValidations;
	} else {
		return false;
	}
}//End parseValidation();

