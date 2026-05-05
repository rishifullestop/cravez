
import { utils, write } from "xlsx";
const { book_new, aoa_to_sheet, book_append_sheet } = utils;

import { newDate } from './dateHelper.mjs';
import * as Constants from "../config/global_constant.mjs";

/**
 *  Function is used to export data in excel file
 *
 * @param value as a numeric value
 *
 * @return numeric value after convert format
 */
export const exportToExcel = (req,res,options)=>{
	let fileName = "Untitled";
	if(options.file_name){
		fileName = (options.file_name) ? options.file_name : "";
	}else if(options.file_prefix){
		fileName = options.file_prefix+"_"+newDate("",Constants.DATABASE_DATE_FORMAT);
	}
	let wb 				= book_new();
	let headingColumns 	= (options.heading_columns) ? options.heading_columns : [];
	let exportData 		= (options.export_data) ? options.export_data : [];
	let finalArray 	 	= [];
	finalArray.push(headingColumns);
	let ws = aoa_to_sheet(finalArray.concat(exportData));
	
	book_append_sheet(wb, ws, "Sheet1");
	let wbbuf = write(wb, {
		type: "buffer",
	});
	let finalFileName	=	"attachment; filename="+fileName+".xlsx";
	res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
	res.setHeader("Content-Disposition",finalFileName);
	res.end( new Buffer(wbbuf, "buffer") );
}// end exportToExcel()

/**
 *  Function is used to export data in excel file for avaya
 *
 * @param value as a numeric value
 *
 * @return numeric value after convert format
 */
export const exportToExcelAvaya = (req,res,options)=>{
	let fileName = "Untitled";
	if(options.file_name){
		fileName = (options.file_name) ? options.file_name : "";
	}else if(options.file_prefix){
		fileName = options.file_prefix+"_"+newDate("",DATABASE_DATE_FORMAT);
	}
	let wb 				= utils.book_new();
	let headingColumns 	= (options.heading_columns) ? options.heading_columns : [];
	let exportData 		= (options.export_data) ? options.export_data : [];
	let finalArray 	 	= [];
	finalArray.push(headingColumns);
	let headingLength = headingColumns.length;

	let ws = utils.aoa_to_sheet(finalArray.concat(exportData));
	//let indexArray		= ['6','7'];
	if(Object.keys(ws).length > 0){
		Object.keys(ws).map((objKey,index)=>{
			if(index == 0 || index == 1 || ((index + headingLength) % headingLength == 0 ) || (((index-1) + headingLength) % headingLength == 0 )){

			}else{
				ws[objKey]['alignRight']	=	true;
			}
		});
	}

	/** Add the worksheet to the workbook **/
	utils.book_append_sheet(wb, ws, "Sheet1");
	let wbbuf = write(wb, {
		type: "base64",
	});

	let finalFileName	=	"attachment; filename="+fileName+".xlsx";
	res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
	res.setHeader("Content-Disposition",finalFileName);
	res.end( new Buffer(wbbuf, "base64") );
}// end exportToExcelAvaya()