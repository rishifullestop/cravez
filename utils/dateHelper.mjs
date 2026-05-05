import moment from 'moment';
import { sub, add } from "date-fns";
const { toZonedTime, format } = await import('date-fns-tz');

import * as Constants from "../config/global_constant.mjs";
import { round } from "./index.mjs";


/**
 * Function to get date in any format with utc format
 *
 * @param date 	as	Date object
 *
 * @return date string
 */
export const getUtcDate = (date) => {
	if (date) {
		const now = moment(date, moment.defaultFormat).toDate();
		return now;
	}
	return moment().toDate();
};//end getUtcDate();

/**
 * Function to get date in any format
 *
 * @param date 			as	Date object
 * @param dateFormat	as 	Date format
 *
 * @return date string
 */
export const newDate = (date, dateFormat) => {
	let timeZone = process.env.TZ;
	let now = toZonedTime(date && new Date(date) || new Date(), timeZone);

	if(dateFormat){
		return format(now, dateFormat,{timeZone: timeZone});
	} else {
		return now;
	}
}//end newDate();

/**
 * Function to add or subtract duration in given date or current date
 *
 * @param duration  AS  Number Of duration to be added
 * @param date      AS  date in which duration to be added
 * @param type      AS  hour,min,sec,day,year
 *
 * @return date string
 */
export const addOrSubtractDurationToDate = (options)=>{
	let type        =   options?.type || 'hour';
    let duration    =   options?.duration && parseFloat(options.duration) || 0;
    let baseDate    =   options?.date && new Date(options.date) || new Date();
    let isSubtract  =   options?.subtract || false;

    let updateObj= {hours: duration};
    if(type == "year")  updateObj   =   {years: duration};
    if(type == "month") updateObj   =   {months: duration};
    if(type == "week")  updateObj   =   {weeks: duration};
    if(type == "day")   updateObj   =   {days: duration};
    if(type == "min")   updateObj   =   {minutes: duration};
    if(type == "sec")   updateObj   =   {seconds: duration};

    return isSubtract && sub(baseDate, updateObj) || add(baseDate, updateObj);
}//end addOrSubtractDurationToDate()

/**
 * Function to get current timestamp
 *
 * @param null
 *
 * @return timestamp
 */
export const currentTimeStamp = ()=>{
	return new Date().getTime();
};//end currentTimeStamp();


/**
 * Function to add days in current date
 *
 * @param addDay AS Number Of Hours to be added
 *
 * @return dates array
 */
export const addDate = (hours)=>{
	return addOrSubtractDurationToDate({duration: hours});
}//end addDate();

/**
 * Function to subtract minute in current date time
 *
 * @param minute AS minute to be subtracted
 *
 * @return date string
 */
export const subtractMinute = (minute)=>{
	return addOrSubtractDurationToDate({duration: minute, subtract: true, type: 'min'});
}//end subtractMinute();

/**
 * Function to subtract days in given date
 *
 * @param hours AS Number Of Days to be subtracted
 *
 * @return date string
 */
export const subtractDate = (hours)=>{
	return addOrSubtractDurationToDate({duration: hours, subtract: true});
}//end subtractDate();

/**
 * Function to subtract minute from given date time
 *
 * @param minute AS minute to be subtracted
 *
 * @return date string
 */
export const subtractMinuteFromDate = (dateFrom,minute)=>{
	return addOrSubtractDurationToDate({duration: minute, subtract: true, type: 'min', date: dateFrom || null});
}//end subtractMinuteFromDate();

/**
 * Function to get list of date between two dates
 *
 * @param startDate AS start date
 * @param endDate AS end date
 *
 * @return date string
 */
export const getDateRange = (startDate, endDate)=>{
	const dates = [];
	let currentDate = new Date(startDate);
	while (currentDate <= endDate) {
		dates.push(new Date(currentDate));
		currentDate.setDate(currentDate.getDate() + 1);
	}
	return dates;
}//end getDateRange();

/**
 *  Function to set 24 hour time format
 *
 * @param time as 24 hour time in float
 *
 * @return 24 hour formatted time
 */
export const set24HourFormat = (time)=>{
	try{
		return parseFloat(time).toFixed(2);
	}catch(e){
		return time;
	}
};// end set24HourFormat()

/**
 * Function to get difference in two dates
 *
 * @param startDate AS start date
 * @param endDate 	AS end date
 *
 * @return difference between two days in minute
 */
export const getDifferenceBetweenTwoDatesInMinute = (startDate,endDate)=>{
	startDate 		= 	new Date(startDate);
	endDate 		=	new Date(endDate);
	let timeDiff 	= 	Math.round(endDate.getTime() - startDate.getTime());
	let diffInMinutes=	(timeDiff /Constants.MILLISECONDS_IN_A_SECOND)/Constants.SECONDS_IN_A_MINUTE;
	return diffInMinutes;
}//end getDifferenceBetweenTwoDatesInMinute()

/**
 * Function to add days in given date
 *
 * @param hours AS Number Of Hours to be added
 *
 * @return date string
 */
export const addDaysToDate = (hours,date)=>{
	return addOrSubtractDurationToDate({duration: hours, date: date});
}//end addDays();

/**
 * Function to add minute in current date time
 *
 * @param minute AS minute to be added
 *
 * @return date string
 */
export const addMinute = (minute)=>{
	return addOrSubtractDurationToDate({duration: minute, type: 'min'});
}//end addMinute();

/**
 * Function to convert into hours
 *
 * @example - [1.30, 2.50] => 4.20
 *
 * @return
 */
export const convertIntoTimeFormat = (timeArray)=>{
	if(!timeArray || timeArray.constructor != Array || timeArray.length ==0) return 0;

	let totalMin 	= 	0;
	let totalHours 	=	0;
	timeArray.map(data=>{
		totalHours += parseInt(data);
		if(String(data).split(".").length >1){
			let tmpMin = (String(data).split(".")[1].length == 1) ? String(data).split(".")[1]*10 :String(data).split(".")[1];
			totalMin   += parseFloat(tmpMin);
		}
	});

	/** Convert into hours when mins is more than 60 example => 80 mins => 1.20 hours  */
	if(totalMin >= Constants.MINUTES_IN_A_HOUR){
		let tmpHours 	=	parseInt(totalMin/Constants.MINUTES_IN_A_HOUR);
		let tmpMin 		=	totalMin%Constants.MINUTES_IN_A_HOUR;
		if(tmpMin < 10) tmpMin = "0"+tmpMin;

		totalHours += tmpHours;
		totalMin = tmpMin;
	}else{
		if(totalMin < 10) totalMin = "0"+totalMin;
	}

	return parseFloat(totalHours+"."+totalMin);
};//End convertIntoTimeFormat()

/**
 * Function to get time format in seconds
 *
 * @param time AS time date
 *
 * @return difference between two days in minute
 */
export const convertTimeFormatToSeconds = (time)=>{
	if(!time) return 0;

	let timeSplit = time?.split(':') || [];
	let seconds   = (+timeSplit[0]) * Constants.MINUTES_IN_A_HOUR * Constants.SECONDS_IN_A_MINUTE + (+timeSplit[1]) * Constants.SECONDS_IN_A_MINUTE + (+timeSplit[2]);
	return seconds;
}//end convertTimeFormatToSeconds()

/**
 * Function to get seconds in time format
 *
 * @param startDate AS start date
 * @param endDate 	AS end date
 *
 * @return difference between two days in minute
 */
export const convertSecondsToTimeFormat = (sec,format)=>{
	let hrs = Math.floor(sec / 3600);
    let min = Math.floor((sec - (hrs * 3600)) / 60);
	let seconds = sec - (hrs * 3600) - (min * 60);
	seconds = round(Math.round(seconds * 100) / 100,0); //round to 2 decimal places

	let result = (hrs < 10 ? "0" + hrs : hrs);
	result += ":" + (min < 10 ? "0" + min : min);
	result += ":" + (seconds < 10 ? "0" + seconds : seconds);
	return result;
}//end convertMinutesToTimeFormat()