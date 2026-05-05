
/**
 * Function for make string to title case
 *
 * @param str AS String
 *
 * @return string
 */
export const toTitleCase = (str)=>{
	return str.replace(/\w\S*/g,(txt)=>{return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}//end toTitleCase();

/**
 * to replace /n with <br> tag
 *
 * @param html	As Html
 *
 * @return html
 */
export const nl2br = (html)=>{
	if(html){
		return html.replace(/\n/g, "<br />");
	}else{
		return html;
	}
}//end nl2br