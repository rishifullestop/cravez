import clone from 'clone';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, getDropdownList, round, arrayToObject, newDate, convertTimeFormatToSeconds, getDateRange, convertSecondsToTimeFormat, exportToExcelAvaya } from '../../../../utils/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { parallel as asyncParallel } from 'async';

class MonthlyReport {
    constructor(db) {
        this.db = db;
    }

	/**
	 * Function to export monthly calculation sheet of avaya data 
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async calculateMonthlyStats(req,res,next){
		try {
			if(isPost(req)){ 
				let dateFrom		=	req?.body?.from_date || "";
				let dateTo			=	req?.body?.to_date || "";
				let teamLeaderIds	=	(req?.body?.team_leader_id) ? req?.body?.team_leader_id	: [];
				
				if(teamLeaderIds.constructor !== Array) teamLeaderIds = [teamLeaderIds];
				
				/** Set conditions for users collection **/
				let condition		=	clone(Constants.ADMIN_USER_COMMON_CONDITIONS);
				condition.parent_id = 	{$in : arrayToObject(teamLeaderIds)};
				condition.code 		= 	{$exists:true};
				
				const users	=	this.db.collection(Tables.USERS);
				let result = await users.find(condition,{projection : {code:1}}).toArray();
				
				let codes	=	[];
				if(result.length > 0){
					result.forEach(records=>{
						if(records.code) codes.push(records.code);
					});
				}			
				
				/*Get Month Start Date*/
				let firstDay	= 	dateFrom;
				/*Get Month End Date*/
				let lastDay 	= 	dateTo;
				let startDate 	=	newDate(firstDay,Constants.DATABASE_DATE_FORMAT+" "+Constants.START_DATE_TIME_FORMAT);
				let endDate 	= 	newDate(lastDay,Constants.DATABASE_DATE_FORMAT+" "+Constants.END_DATE_TIME_FORMAT);			
				
				let agentConditions	=	{};
				if(codes.length > 0 || teamLeaderIds.length > 0){
					agentConditions['code']	=	{$in : codes};
				}else{
					agentConditions['code']	=	{$exists : true};
				}
				
				let agentResult = await users.aggregate([
					{ $match : agentConditions},
					{ $group	:	{
						_id		:	"$code",
						AgentGivenName:	{$first: "$first_name"},
						AgentSurName:	{$first: "$last_name"},
					}},
				]).toArray();
				
				let loginIds	=	[];
				if(agentResult.length > 0){
					agentResult.forEach(records=>{
						loginIds.push(records._id)
					});
				}
				
				asyncParallel({
					conformance: (callback)=>{
						/** Get conformance time */
						const avaya_conformance = this.db.collection(Tables.AVAYA_CONFORMANCE);
						avaya_conformance.find({
							date : {$gte: newDate(startDate), $lte: newDate(endDate)},
							code : {$in : loginIds},
						},{projection : {code: 1,time: 1}}).toArray().then(conformanceResult=>{
							
							let conformanceObject = {};
							conformanceResult.forEach(data=>{
								if(!conformanceObject[data.code]) conformanceObject[data.code] = {};
								if(!conformanceObject[data.code]['time']) conformanceObject[data.code]['time'] = 0;
								if(!conformanceObject[data.code]['days']) conformanceObject[data.code]['days'] = 0;
								conformanceObject[data.code]['time']	+=	convertTimeFormatToSeconds(data.time);
								if(convertTimeFormatToSeconds(data.time) > Constants.CONFORMANCE_WORKING_SECONDS) conformanceObject[data.code]['days']	+=	1;
							});
							callback(null,conformanceObject);
						}).catch(next);
					},
					tardiness: (callback)=>{
						/** Get tardiness time */
						const avaya_tardiness = this.db.collection(Tables.AVAYA_TARDINESS);
						avaya_tardiness.find({
							code : {$in : loginIds},
							date : {$gte: newDate(startDate), $lte: newDate(endDate)},
						},{projection : {code: 1,time: 1}}).toArray().then(tardinessResult=>{
							
							let tardinessList = {};
							tardinessResult.forEach(data=>{
								if(!tardinessList[data.code]) tardinessList[data.code] = 0;
								tardinessList[data.code] += convertTimeFormatToSeconds(data.time);
							});
							callback(null,tardinessList);
						}).catch(next);
					},
					nr: (callback)=>{
						/** Get nr time  */
						const avaya_nr = this.db.collection(Tables.AVAYA_NR);
						avaya_nr.find({
							code : {$in : loginIds},
							date : {$gte: newDate(startDate), $lte: newDate(endDate)},
						},{projection : {code: 1,time: 1}}).toArray().then(nrResult=>{
							
							let nrList = {};
							nrResult.forEach(data=>{
								if(!nrList[data.code]) nrList[data.code] = 0;
								nrList[data.code] += convertTimeFormatToSeconds(data.time);
							});
							callback(null,nrList);
						}).catch(next);
					},
					aht: (callback)=>{
						/** Get aht monthly time  */
						const avaya_aht = this.db.collection(Tables.AVAYA_AHT);
						avaya_aht.find({
							code : {$in : loginIds},
							date : {$gte: newDate(startDate), $lte: newDate(endDate)},
						},{projection : {code: 1,talk_time: 1,calls_answered:1}}).toArray().then(ahtResult=>{
							
							let ahtObject = {};
							ahtResult.forEach(data=>{
								if(!ahtObject[data.code]) ahtObject[data.code] = {};
								if(!ahtObject[data.code]['time']) ahtObject[data.code]['time'] = 0;
								if(!ahtObject[data.code]['days']) ahtObject[data.code]['days'] = 0;
								if(data.talk_time) ahtObject[data.code]['time']	+=	data.talk_time;
								ahtObject[data.code]['days']	+=	data.calls_answered;
							});
							callback(null,ahtObject);
						}).catch(next);
					},
					abandoned: (callback)=>{
						/** Get abandoned time */
						const avaya_abandoned = this.db.collection(Tables.AVAYA_ABANDONED);
						avaya_abandoned.find({
							code : {$in : loginIds},
							date : {$gte: newDate(startDate), $lte: newDate(endDate)},
						},{projection : {code: 1,count: 1}}).toArray().then(abandonedResult=>{
							
							let abandonedList = {};
							abandonedResult.forEach(data=>{
								if(!abandonedList[data.code]) abandonedList[data.code] = 0;
								abandonedList[data.code] += data.count;
							});

							callback(null,abandonedList);
						}).catch(next);
					},
					quality: (callback)=>{
						/** Get quality time */
						const avaya_quality_summary = this.db.collection(Tables.AVAYA_QUALITY_SUMMARY);
						avaya_quality_summary.find({
							code : {$in : loginIds},
							call_date_time : {$gte: newDate(startDate), $lte: newDate(endDate)},
						},{projection : {code: 1,data: 1}}).toArray().then(qualityResult=>{
							
							let qualityObject = {};
							qualityResult.forEach(result=>{
								if(!qualityObject[result.code]) qualityObject[result.code] = {};
								if(!qualityObject[result.code][Constants.END_USER_CRITICAL]) qualityObject[result.code][Constants.END_USER_CRITICAL] = 0;
								if(!qualityObject[result.code][Constants.BUSINESS_CRITICAL]) qualityObject[result.code][Constants.BUSINESS_CRITICAL] = 0;
								if(!qualityObject[result.code][Constants.NON_CRITICAL]) qualityObject[result.code][Constants.NON_CRITICAL]		 	 = 0;

								let qualityData	=	result.data;
								qualityData.forEach(value=>{
									if(value.type == Constants.END_USER_CRITICAL) qualityObject[result.code][Constants.END_USER_CRITICAL]	+=	value.number_of_error;
									if(value.type == Constants.BUSINESS_CRITICAL) qualityObject[result.code][Constants.BUSINESS_CRITICAL]	+=	value.number_of_error;
									if(value.type == Constants.NON_CRITICAL) qualityObject[result.code][Constants.NON_CRITICAL]				+=	value.number_of_error;
								});
							});

							callback(null,qualityObject);
						}).catch(next);
					},
					shifts: (callback)=>{
						startDate 	=	newDate(firstDay,Constants.DATABASE_DATE_FORMAT+" "+Constants.START_DATE_TIME_FORMAT);
						endDate 	= 	newDate(lastDay,Constants.DATABASE_DATE_FORMAT+" "+Constants.END_DATE_TIME_FORMAT);

						/** Get shift time */
						const avaya_shift = this.db.collection(Tables.AVAYA_SHIFT);
						avaya_shift.find({
							code : {$in : loginIds},
							date : {$gte: newDate(startDate), $lte: newDate(endDate)},
						},{projection : {code: 1,time: 1,leave_type:1,date:1}}).toArray().then(shiftResult=>{

							let shiftObject = 	{};
							let dates		=	getDateRange(new Date(startDate), new Date(endDate));
							dates.forEach((shiftDate)=>{
								let date = newDate(shiftDate,Constants.DATABASE_DATE_FORMAT);
								
								shiftResult.forEach((shiftTime)=>{
									if(!shiftObject[shiftTime.code]) shiftObject[shiftTime.code] = {};
									if(!shiftObject[shiftTime.code]['casualWeekendLeave']) shiftObject[shiftTime.code]['casualWeekendLeave'] = 0;
									if(!shiftObject[shiftTime.code]['sickWeekendLeave']) shiftObject[shiftTime.code]['sickWeekendLeave'] = 0;
									if(!shiftObject[shiftTime.code]['casualWorkingLeave']) shiftObject[shiftTime.code]['casualWorkingLeave'] = 0;
									if(!shiftObject[shiftTime.code]['sickWorkingLeave']) shiftObject[shiftTime.code]['sickWorkingLeave'] = 0;
									
									if(shiftTime.leave_type){
										let dbDate  = newDate(shiftTime.date,Constants.DATABASE_DATE_FORMAT);
										if(date == dbDate){
											let dayName = new Date(dbDate).getDay();
											if(Constants.WEEKEND_DAYS.indexOf(dayName) > -1){
												if(shiftTime.leave_type == Constants.CASUAL_LEAVE) shiftObject[shiftTime.code]['casualWeekendLeave']	+=	1;
												if(shiftTime.leave_type == Constants.SICK_LEAVE) shiftObject[shiftTime.code]['sickWeekendLeave']		+=	1;
											}else{
												if(shiftTime.leave_type == Constants.CASUAL_LEAVE) shiftObject[shiftTime.code]['casualWorkingLeave']	+=	1;
												if(shiftTime.leave_type == Constants.SICK_LEAVE) shiftObject[shiftTime.code]['sickWorkingLeave']		+=	1;
											}
										}
									}
								});
							});
							callback(null,shiftObject);
						}).catch(next);
					},
				},(asyncError, asyncResponse)=>{
					if(asyncError) return next(asyncError);

					/** Define excel heading label **/
					let commonColls	= [
						res.__("admin.avaya.agent_name"),
						res.__("admin.avaya.code"),
						res.__("admin.avaya.working_days"),
						res.__("admin.avaya.total_conformance"),
						res.__("admin.avaya.conformance"),
						res.__("admin.avaya.conformance_score"),
						res.__("admin.avaya.aht"),
						res.__("admin.avaya.aht_score"),
						res.__("admin.avaya.tardiness"),
						res.__("admin.avaya.tardiness_score"),
						res.__("admin.avaya.nr_percentage"),
						res.__("admin.avaya.nr_score"),
						res.__("admin.avaya.end_user_critical"),
						res.__("admin.avaya.end_user_critical_score"),
						res.__("admin.avaya.business_critical"),
						res.__("admin.avaya.business_critical_score"),
						res.__("admin.avaya.non_critical"),
						res.__("admin.avaya.non_critical_score"),
						res.__("admin.avaya.abandoned"),
						res.__("admin.avaya.abandoned_score"),
						res.__("admin.avaya.shift_score"),
						res.__("admin.avaya.total_score"),
					];

					let temp =[];
					if(agentResult?.length > 0){
						agentResult?.forEach(records=>{
							/** For conformnace */
							let conformanceScore		= 0;
							let tardinessScore			= 0;
							let nrScore					= 0;
							let ahtScore				= 0;
							let abandonedScore			= 0;
							let conformance				= 0;
							let finalScore				= 0;
							let totalConformance		= (asyncResponse.conformance[records._id] && asyncResponse.conformance[records._id].time) ? asyncResponse.conformance[records._id].time : 0;
							let totalWorkingDays		= (asyncResponse.conformance[records._id] && asyncResponse.conformance[records._id].days) ? asyncResponse.conformance[records._id].days : 0;
							if(totalWorkingDays >0 ){
								conformance		= (totalConformance / (totalWorkingDays*(Constants.MINUTES_IN_A_HOUR*Constants.CONFORMANCE_HOURS)*Constants.MINUTES_IN_A_HOUR)) * Constants.MAX_PERCENTAGE;
								Constants.CONFORMANCE_CALCULATION.forEach(percentage=>{
									if(conformance >= percentage.min && conformance <= percentage.max) conformanceScore	=	percentage.percentage;
								});
							}	
							records.working_days		= (totalWorkingDays) ? totalWorkingDays : 0;
							records.total_conformance	= (totalConformance) ? convertSecondsToTimeFormat(totalConformance) : 0;
							records.conformance			= (conformance) ? round(conformance,Constants.ROUND_PRECISION) : 0;
							records.conformance_score	= (conformanceScore) ? conformanceScore : 0;
							finalScore					+=	records.conformance_score;

							/** For tardiness */
							let tardiness				= asyncResponse?.tardiness?.[records._id] || '';
							let tardinessInMints		= (tardiness) ? tardiness / Constants.SECONDS_IN_A_MINUTE : 0;
							Constants.TARDINESS_CALCULATION.forEach(percentage=>{
								if(tardinessInMints >= percentage.min && tardinessInMints <= percentage.max) tardinessScore	=	percentage.percentage;
							});

							records.tardiness			= (tardiness) ? convertSecondsToTimeFormat(tardiness) : 0;
							records.tardiness_score		= (tardinessScore) ? tardinessScore : 0;
							finalScore					+=	records.tardiness_score;

							/** For NR */
							let nr						= (asyncResponse.nr[records._id]) ? asyncResponse.nr[records._id] : '';
							let nrInMints				= (nr) ? nr / Constants.SECONDS_IN_A_MINUTE : 0;
							let nrPercentage			= (nr) ? (nr / totalConformance) *  Constants.MAX_PERCENTAGE : 0;
							Constants.NR_CALCULATION.forEach(percentage=>{
								if(nrInMints >= percentage.min && nrInMints <= percentage.max) nrScore	=	percentage.percentage;
							});
							records.nr					= (nr) ? convertSecondsToTimeFormat(nr) : 0;
							records.nr_percentage		= round(nrPercentage,Constants.ROUND_PRECISION);
							records.nr_score			= (nrScore) ? nrScore : 0;
							finalScore					+=	records.nr_score;

							/** For AHT */
							let totalAHT				= (asyncResponse.aht[records._id] && asyncResponse.aht[records._id].time) ? asyncResponse.aht[records._id].time : 0;
							let totalAhtDays			= (asyncResponse.aht[records._id] && asyncResponse.aht[records._id].days) ? asyncResponse.aht[records._id].days : 0;
							
							let ahtPerMonth				= (totalAHT) ? totalAHT / totalAhtDays : 0;
							records.aht					= (ahtPerMonth) ? round(ahtPerMonth,0) : 0;
							Constants.AHT_CALCULATION.forEach(percentage=>{
								if(ahtPerMonth >= percentage.min && ahtPerMonth <= percentage.max) ahtScore	=	percentage.percentage;
							});

							records.aht_score			= (ahtScore) ? ahtScore : 0;
							finalScore					+=	records.aht_score;

							/** For abandoned */
							let abandonedPerMonth		= asyncResponse?.abandoned?.[records._id] || 0;
							Constants.ABANDONED_CALCULATION.forEach(percentage=>{
								if(abandonedPerMonth == percentage.value) abandonedScore	=	percentage.percentage;
							});
							records.abandoned				= (abandonedPerMonth) ? abandonedPerMonth : 0;
							records.abandoned_score			= (abandonedScore) ? abandonedScore : 0;
							finalScore					+=	records.abandoned_score;

							/** For Quality */
							let endUserCritical		=	(asyncResponse?.quality?.[records._id] && asyncResponse?.quality?.[records._id][Constants.END_USER_CRITICAL]) ? asyncResponse?.quality?.[records._id][Constants.END_USER_CRITICAL] : 0;
							let businessCritical	=	(asyncResponse?.quality?.[records._id] && asyncResponse?.quality?.[records._id][Constants.BUSINESS_CRITICAL]) ? asyncResponse?.quality?.[records._id][Constants.BUSINESS_CRITICAL] :0 ;
							let nonCritical			=	(asyncResponse?.quality?.[records._id] && asyncResponse?.quality?.[records._id][Constants.NON_CRITICAL]) ? asyncResponse?.quality?.[records._id][Constants.NON_CRITICAL] : 0;
							let endUserCriticalScore= 	0;
							let businessCriticalScore= 	0;
							let nonCriticalScore	= 	0;
							Constants.QUALITY_CALCULATION.END_USER_CRITICAL.forEach(endUser=>{
								if(endUserCritical == endUser.value) endUserCriticalScore	=	endUser.percentage;
							});
							Constants.QUALITY_CALCULATION.BUSINESS_CRITICAL.forEach(business=>{
								if(businessCritical == business.value) businessCriticalScore	=	business.percentage;
							});
							Constants.QUALITY_CALCULATION.NON_CRITICAL.forEach(non=>{
								if(nonCritical >= non.min && nonCritical <= non.max) nonCriticalScore	=	non.percentage;
							});

							records.end_user_critical	=	endUserCritical;
							records.end_user_score		=	endUserCriticalScore;
							records.business_critical	=	businessCritical;
							records.business_score		=	businessCriticalScore;
							records.non_critical		=	nonCritical;
							records.non_critical_score	=	nonCriticalScore;
							finalScore					+=	records.end_user_score;
							finalScore					+=	records.business_score;
							finalScore					+=	records.non_critical_score;

							/** For shifts */
							let casualWeekend=	(asyncResponse.shifts[records._id] && asyncResponse.shifts[records._id].casualWeekendLeave) ? asyncResponse.shifts[records._id].casualWeekendLeave : 0;
							let sickWeekend	=	(asyncResponse.shifts[records._id] && asyncResponse.shifts[records._id].sickWeekendLeave) ? asyncResponse.shifts[records._id].sickWeekendLeave : 0;
							let casualWorking=	(asyncResponse.shifts[records._id] && asyncResponse.shifts[records._id].casualWorkingLeave) ? asyncResponse.shifts[records._id].casualWorkingLeave : 0;
							let sickWorking	=	(asyncResponse.shifts[records._id] && asyncResponse.shifts[records._id].sickWorkingLeave) ? asyncResponse.shifts[records._id].sickWorkingLeave : 0;

							let totalCasualWeekEnd	=	(casualWeekend > 0) ? casualWeekend + casualWorking : 0;
							let totalCasualWorking	=	(totalCasualWeekEnd > casualWeekend) ? 0 : casualWorking;
							let totalSickWeedkEnd	=	(sickWeekend > 0) ? sickWeekend + sickWorking : 0;
							let totalSickWorking	=	(totalSickWeedkEnd > sickWeekend) ? 0 : sickWorking;

							let casualWeekendPercentage	=	(totalCasualWeekEnd <= Constants.CASUAL_ONE ) ? Constants.CASUAL_LEAVE_ARRAY[Constants.CASUAL_ONE]['Weekend'] : ((totalCasualWeekEnd == Constants.CASUAL_TWO) ? Constants.ABSENT_TOTAL_PERCENTAGE - Constants.CASUAL_LEAVE_ARRAY[Constants.CASUAL_TWO]['Weekend'] : Constants.ABSENT_TOTAL_PERCENTAGE - Constants.CASUAL_LEAVE_ARRAY[Constants.CASUAL_OTHER]['Weekend']);
							let casualWorkingPercentage	=	(totalCasualWorking <= Constants.CASUAL_ONE ) ? Constants.CASUAL_LEAVE_ARRAY[Constants.CASUAL_ONE]['Working'] : ((totalCasualWorking == Constants.CASUAL_TWO) ? Constants.ABSENT_TOTAL_PERCENTAGE - Constants.CASUAL_LEAVE_ARRAY[Constants.CASUAL_TWO]['Working'] : Constants.ABSENT_TOTAL_PERCENTAGE - Constants.CASUAL_LEAVE_ARRAY[Constants.CASUAL_OTHER]['Working']);
							let sickWeekendPercentage	=	(totalSickWeedkEnd <= Constants.CASUAL_TWO ) ? Constants.SICK_LEAVE_ARRAY[Constants.CASUAL_TWO]['Weekend'] : ((totalSickWeedkEnd == Constants.CASUAL_THREE) ? Constants.ABSENT_TOTAL_PERCENTAGE - Constants.SICK_LEAVE_ARRAY[Constants.CASUAL_THREE]['Weekend'] : Constants.ABSENT_TOTAL_PERCENTAGE - Constants.SICK_LEAVE_ARRAY[Constants.CASUAL_OTHER]['Weekend']);
							let sickWorkingPercentage	=	(totalSickWorking <= Constants.CASUAL_TWO ) ? Constants.SICK_LEAVE_ARRAY[Constants.CASUAL_TWO]['Working'] : ((totalSickWeedkEnd <= Constants.CASUAL_THREE) ? Constants.ABSENT_TOTAL_PERCENTAGE - Constants.SICK_LEAVE_ARRAY[Constants.CASUAL_THREE]['Working'] : ((totalSickWeedkEnd <= Constants.SICK_FIVE) ? Constants.ABSENT_TOTAL_PERCENTAGE - Constants.SICK_LEAVE_ARRAY[Constants.SICK_FIVE]['Working'] : Constants.ABSENT_TOTAL_PERCENTAGE - Constants.SICK_LEAVE_ARRAY[Constants.CASUAL_OTHER]['Working']));
							
							let sumOfPercentages		=	casualWeekendPercentage + casualWorkingPercentage + sickWeekendPercentage + sickWorkingPercentage;

							let totalPercentage			=	(sumOfPercentages < -Constants.ABSENT_TOTAL_PERCENTAGE) ? 0 :  sumOfPercentages + Constants.ABSENT_TOTAL_PERCENTAGE;
							
							records.shift_working_days	=	totalCasualWorking + totalSickWorking;
							records.shift_weekends		=	totalCasualWeekEnd + totalSickWeedkEnd;
							records.shift_score			=	totalPercentage;
							records.total_score			=	finalScore;
						});

						/** Get result of avaya monthly report**/
						if(agentResult?.length > 0){
							agentResult?.forEach(records=>{
								let statusLabelActive	=	(records.active !== undefined && records.active == Constants.ACTIVE) ? res.__("admin.system.active") :res.__("admin.system.inactive");
								let buffer =	[
									(records.AgentGivenName && records.AgentSurName)  	? records.AgentGivenName+' '+records.AgentSurName:"",
									(records._id)				? records._id 					:0,
									(records.working_days) 		? records.working_days 			:0,
									(records.total_conformance)	? records.total_conformance		:0,
									(records.conformance)		? records.conformance			:0,
									(records.conformance_score)	? records.conformance_score+"%" :0,
									(records.aht)				? records.aht 					:0,
									(records.aht_score)			? records.aht_score+"%" 		:0,
									(records.tardiness)			? records.tardiness 			:0,
									(records.tardiness_score)	? records.tardiness_score+"%"	:0,
									(records.nr_percentage)		? records.nr_percentage 		:0,
									(records.nr_score)			? records.nr_score+"%"			:0,
									(records.end_user_critical)	? records.end_user_critical		:0,
									(records.end_user_score)	? records.end_user_score+"%"	:0,
									(records.business_critical)	? records.business_critical		:0,
									(records.business_score)	? records.business_score+"%"	:0,
									(records.non_critical)		? records.non_critical			:0,
									(records.non_critical_score)? records.non_critical_score+"%":0,
									(records.abandoned)			? records.abandoned 			:0,
									(records.abandoned_score)	? records.abandoned_score+"%"	:0,
									(records.shift_score)		? records.shift_score+"%"	:0,
									(records.total_score)		? records.total_score+"%"	:0,
								];
								temp.push(buffer);
							});
						}
					}
					exportToExcelAvaya(req,res,{
						file_name 			: dateFrom+'_'+dateTo+"_avaya_report",
						heading_columns		: commonColls,
						export_data			: temp
					});
				});				
			}else{
				/** Set conditions */
				let teamConditions =  clone(Constants.ADMIN_USER_COMMON_CONDITIONS);
				teamConditions.team_head = true;
				
				/** Get users dropdown list **/
				let response = await getDropdownList(req,res,next,{
					collections : [{
						collection	:	Tables.USERS,
						columns		: 	["_id", "full_name"],
						conditions	: 	teamConditions
					}]
				});
								
				/** Set dropdown options **/
				req.breadcrumbs(BREADCRUMBS['admin/avaya_monthly_reports/avaya_monthly_report_list']);
				res.render('monthly_report',{
					team_list :	response?.final_html_data?.["0"] || "",
				});
			}
		} catch (error) {
			return next(error);
		}
	};//End calculateMonthlyStats()
}
export default MonthlyReport; 
