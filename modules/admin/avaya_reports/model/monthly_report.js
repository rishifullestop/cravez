const asyncParallel	=	require('async/parallel');
const eachOfSeries 	= 	require("async/eachOfSeries");
const clone			=	require('clone');

function MonthlyReport() {
	const QualityCategory = this;

	/**
	 * Function to export monthly calculation sheet of avaya data 
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	this.calculateMonthlyStats = (req,res,next)=>{
		if(isPost(req)){ 
			let dateFrom		=	req.body.from_date;
			let dateTo			=	req.body.to_date;
			let teamLeaderIds	=	(req.body.team_leader_id) ? req.body.team_leader_id	: [];
			
			if(teamLeaderIds.constructor !== Array) teamLeaderIds = [teamLeaderIds];
			
			let condition		=	clone(ADMIN_USER_COMMON_CONDITIONS);
			condition.parent_id = 	{$in : arrayToObject(teamLeaderIds)};
			condition.code = 	{$exists:true};
			
			const users	=	db.collection('users');
			users.find(condition,{projection : {code:1}}).toArray((err,result)=>{  
				if(err) return next(err);
				
				let codes	=	[];
				if(result.length > 0){
					result.map(records=>{
						if(records.code) codes.push(records.code);
					});
				}
				
				let date 		= 	new Date(dateFrom+'-01');
				/*Get Month Start Date*/
				let firstDay	= 	dateFrom;//new Date(date.getFullYear(), date.getMonth(), 1);
				/*Get Month End Date*/
				let lastDay 	= 	dateTo;//new Date(date.getFullYear(), date.getMonth() + 1, 0);
				let startDate 	=	newDate(firstDay,DATABASE_DATE_FORMAT+" "+START_DATE_TIME_FORMAT);
				let endDate 	= 	newDate(lastDay,DATABASE_DATE_FORMAT+" "+END_DATE_TIME_FORMAT);			
				
				let agentConditions	=	{
					//~ Timestamp		:	{$gte: startDate, $lte: endDate}
				};
				if(codes.length > 0 || teamLeaderIds.length > 0){
					agentConditions['code']	=	{$in : codes};
				}else{
					agentConditions['code']	=	{$exists : true};
				}
				
				//~ iAgentPerformanceStat.aggregate([
					//~ { $match : agentConditions},
					//~ { $group	:	{
						//~ _id		:	"$AgentLogin",
						//~ AgentGivenName:	{$first: "$AgentGivenName"},
						//~ AgentSurName:	{$first: "$AgentSurName"},
					//~ }},
				//~ ]).toArray((err,result)=>{
				
				users.aggregate([
					{ $match : agentConditions},
					{ $group	:	{
						_id		:	"$code",
						AgentGivenName:	{$first: "$first_name"},
						AgentSurName:	{$first: "$last_name"},
					}},
				]).toArray((err,result)=>{  
					
					if(err) return next(err);
					let finalArray	=	[];
					let loginIds	=	[];
					if(result.length > 0){
						result.map(records=>{
							loginIds.push(records._id)
						});
					}
					asyncParallel({
						conformance: (callback)=>{
							/** Get conformance time */
							const avaya_conformance = db.collection("avaya_conformance");
							avaya_conformance.find({code : {$in : loginIds},date : {$gte: getUtcDate(startDate), $lte: getUtcDate(endDate)}},{projection : {code: 1,time: 1}}).toArray((conformanceErr,conformanceResult)=>{
								if(conformanceErr) return callback(conformanceErr);
								let conformanceObject = {};
								conformanceResult.map(data=>{
									if(!conformanceObject[data.code]) conformanceObject[data.code] = {};
									if(!conformanceObject[data.code]['time']) conformanceObject[data.code]['time'] = 0;
									if(!conformanceObject[data.code]['days']) conformanceObject[data.code]['days'] = 0;
									conformanceObject[data.code]['time']	+=	convertTimeFormatToSeconds(data.time);
									if(convertTimeFormatToSeconds(data.time) > CONFORMANCE_WORKING_SECONDS) conformanceObject[data.code]['days']	+=	1;
								});
								callback(null,conformanceObject);
							});
						},
						tardiness: (callback)=>{
							/** Get tardiness time */
							const avaya_tardiness = db.collection("avaya_tardiness");
							avaya_tardiness.find({code : {$in : loginIds},date : {$gte: getUtcDate(startDate), $lte: getUtcDate(endDate)}},{projection : {code: 1,time: 1}}).toArray((tardinessErr,tardinessResult)=>{
								if(tardinessErr) return callback(tardinessErr);
								let tardinessList = {};
								tardinessResult.map(data=>{
									if(!tardinessList[data.code]) tardinessList[data.code] = 0;
									tardinessList[data.code] += convertTimeFormatToSeconds(data.time);
								});
								callback(null,tardinessList);
							});
						},
						nr: (callback)=>{
							/** Get nr time  */
							const avaya_nr = db.collection("avaya_nr");
							avaya_nr.find({code : {$in : loginIds},date : {$gte: getUtcDate(startDate), $lte: getUtcDate(endDate)}},{projection : {code: 1,time: 1}}).toArray((nrErr,nrResult)=>{
								if(nrErr) return callback(nrErr);
								let nrList = {};
								nrResult.map(data=>{
									if(!nrList[data.code]) nrList[data.code] = 0;
									nrList[data.code] += convertTimeFormatToSeconds(data.time);
								});
								callback(null,nrList);
							});
						},
						aht: (callback)=>{
							/** Get aht monthly time  */
							const avaya_aht = db.collection("avaya_aht");
							avaya_aht.find({code : {$in : loginIds},date : {$gte: getUtcDate(startDate), $lte: getUtcDate(endDate)}},{projection : {code: 1,talk_time: 1,calls_answered:1}}).toArray((ahtErr,ahtResult)=>{
								if(ahtErr) return callback(ahtErr);
								let ahtObject = {};
								ahtResult.map(data=>{
									if(!ahtObject[data.code]) ahtObject[data.code] = {};
									if(!ahtObject[data.code]['time']) ahtObject[data.code]['time'] = 0;
									if(!ahtObject[data.code]['days']) ahtObject[data.code]['days'] = 0;
									if(data.talk_time) ahtObject[data.code]['time']	+=	data.talk_time;
									ahtObject[data.code]['days']	+=	data.calls_answered;
								});
								callback(null,ahtObject);
							});
						},
						abandoned: (callback)=>{
							/** Get abandoned time */
							const avaya_abandoned = db.collection("avaya_abandoned");
							avaya_abandoned.find({code : {$in : loginIds},date : {$gte: getUtcDate(startDate), $lte: getUtcDate(endDate)}},{projection : {code: 1,count: 1}}).toArray((abandonedErr,abandonedResult)=>{
								if(abandonedErr) return callback(abandonedErr);
								let abandonedList = {};
								abandonedResult.map(data=>{
									if(!abandonedList[data.code]) abandonedList[data.code] = 0;
									abandonedList[data.code] += data.count;
								});

								callback(null,abandonedList);
							});
						},
						quality: (callback)=>{
							/** Get quality time */
							const avaya_quality_summary = db.collection("avaya_quality_summary");
							avaya_quality_summary.find({code : {$in : loginIds},call_date_time : {$gte: getUtcDate(startDate), $lte: getUtcDate(endDate)}},{projection : {code: 1,data: 1}}).toArray((qualityErr,qualityResult)=>{
								if(qualityErr) return callback(qualityErr);
								let qualityObject = {};
								qualityResult.map(result=>{
									if(!qualityObject[result.code]) qualityObject[result.code] = {};
									if(!qualityObject[result.code][END_USER_CRITICAL]) qualityObject[result.code][END_USER_CRITICAL] = 0;
									if(!qualityObject[result.code][BUSINESS_CRITICAL]) qualityObject[result.code][BUSINESS_CRITICAL] = 0;
									if(!qualityObject[result.code][NON_CRITICAL]) qualityObject[result.code][NON_CRITICAL]		 	 = 0;
									let qualityData	=	result.data;
									qualityData.map(value=>{
										if(value.type == END_USER_CRITICAL) qualityObject[result.code][END_USER_CRITICAL]	+=	value.number_of_error;
										if(value.type == BUSINESS_CRITICAL) qualityObject[result.code][BUSINESS_CRITICAL]	+=	value.number_of_error;
										if(value.type == NON_CRITICAL) qualityObject[result.code][NON_CRITICAL]				+=	value.number_of_error;
									});
								});
								callback(null,qualityObject);
							});
						},
						shifts: (callback)=>{
							startDate 	=	newDate(firstDay,DATABASE_DATE_FORMAT+" "+START_DATE_TIME_FORMAT);
							endDate 	= 	newDate(lastDay,DATABASE_DATE_FORMAT+" "+END_DATE_TIME_FORMAT);
							/** Get shift time */
							const avaya_shift = db.collection("avaya_shift");
							avaya_shift.find({code : {$in : loginIds},date : {$gte: getUtcDate(startDate), $lte: getUtcDate(endDate)}},{projection : {code: 1,time: 1,leave_type:1,date:1}}).toArray((shiftErr,shiftResult)=>{
								if(shiftErr) return callback(shiftErr);

								let shiftObject = 	{};
								let dates		=	getDates(new Date(startDate), new Date(endDate));
								dates.map((shiftDate)=>{
									let date = newDate(shiftDate,DATABASE_DATE_FORMAT);
									shiftResult.map((shiftTime)=>{
										if(!shiftObject[shiftTime.code]) shiftObject[shiftTime.code] = {};
										if(!shiftObject[shiftTime.code]['casualWeekendLeave']) shiftObject[shiftTime.code]['casualWeekendLeave'] = 0;
										if(!shiftObject[shiftTime.code]['sickWeekendLeave']) shiftObject[shiftTime.code]['sickWeekendLeave'] = 0;
										if(!shiftObject[shiftTime.code]['casualWorkingLeave']) shiftObject[shiftTime.code]['casualWorkingLeave'] = 0;
										if(!shiftObject[shiftTime.code]['sickWorkingLeave']) shiftObject[shiftTime.code]['sickWorkingLeave'] = 0;
										if(shiftTime.leave_type){
											let dbDate      = newDate(shiftTime.date,DATABASE_DATE_FORMAT);
											if(date == dbDate){
												let dayName 	= new Date(dbDate).getDay();
												let leaveName	= '';
												if(WEEKEND_DAYS.indexOf(dayName) > -1){
													if(shiftTime.leave_type == CASUAL_LEAVE) shiftObject[shiftTime.code]['casualWeekendLeave']	+=	1;
													if(shiftTime.leave_type == SICK_LEAVE) shiftObject[shiftTime.code]['sickWeekendLeave']		+=	1;
												}else{
													if(shiftTime.leave_type == CASUAL_LEAVE) shiftObject[shiftTime.code]['casualWorkingLeave']	+=	1;
													if(shiftTime.leave_type == SICK_LEAVE) shiftObject[shiftTime.code]['sickWorkingLeave']		+=	1;
												}
											}
										}
									});
								});
								callback(null,shiftObject);
							});
						},
					},(asyncError, asyncResponse)=>{
						if(asyncError) return next(asyncError);
						let temp =[];
						let commonColls	= {};
						/** Define excel heading label **/
						commonColls	= [
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
						if(result.length > 0){
							result.map(records=>{
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
									conformance		= (totalConformance / (totalWorkingDays*(MINUTES_IN_A_HOUR*CONFORMANCE_HOURS)*MINUTES_IN_A_HOUR)) * MAX_PERCENTAGE;
									CONFORMANCE_CALCULATION.map(percentage=>{
										if(conformance >= percentage.min && conformance <= percentage.max) conformanceScore	=	percentage.percentage;
									});
								}	
								records.working_days		= (totalWorkingDays) ? totalWorkingDays : 0;
								records.total_conformance	= (totalConformance) ? convertSecondsToTimeFormat(totalConformance) : 0;
								records.conformance			= (conformance) ? round(conformance,ROUND_PRECISION) : 0;
								records.conformance_score	= (conformanceScore) ? conformanceScore : 0;
								finalScore					+=	records.conformance_score;

								/** For tardiness */
								let tardiness				= (asyncResponse.tardiness[records._id]) ? asyncResponse.tardiness[records._id] : '';
								let tardinessInMints		= (tardiness) ? tardiness / SECONDS_IN_A_MINUTE : 0;
								TARDINESS_CALCULATION.map(percentage=>{
									if(tardinessInMints >= percentage.min && tardinessInMints <= percentage.max) tardinessScore	=	percentage.percentage;
								});
								records.tardiness			= (tardiness) ? convertSecondsToTimeFormat(tardiness) : 0;
								records.tardiness_score		= (tardinessScore) ? tardinessScore : 0;
								finalScore					+=	records.tardiness_score;

								/** For NR */
								let nr						= (asyncResponse.nr[records._id]) ? asyncResponse.nr[records._id] : '';
								let nrInMints				= (nr) ? nr / SECONDS_IN_A_MINUTE : 0;
								let nrPercentage			= (nr) ? (nr / totalConformance) *  MAX_PERCENTAGE : 0;
								NR_CALCULATION.map(percentage=>{
									if(nrInMints >= percentage.min && nrInMints <= percentage.max) nrScore	=	percentage.percentage;
								});
								records.nr					= (nr) ? convertSecondsToTimeFormat(nr) : 0;
								records.nr_percentage		= round(nrPercentage,ROUND_PRECISION);
								records.nr_score			= (nrScore) ? nrScore : 0;
								finalScore					+=	records.nr_score;

								/** For AHT */
								let totalAHT				= (asyncResponse.aht[records._id] && asyncResponse.aht[records._id].time) ? asyncResponse.aht[records._id].time : 0;
								let totalAhtDays			= (asyncResponse.aht[records._id] && asyncResponse.aht[records._id].days) ? asyncResponse.aht[records._id].days : 0;
								
								let ahtPerMonth				= (totalAHT) ? totalAHT / totalAhtDays : 0;
								records.aht					= (ahtPerMonth) ? round(ahtPerMonth,0) : 0;
								AHT_CALCULATION.map(percentage=>{
									if(ahtPerMonth >= percentage.min && ahtPerMonth <= percentage.max) ahtScore	=	percentage.percentage;
								});
								records.aht_score			= (ahtScore) ? ahtScore : 0;
								finalScore					+=	records.aht_score;

								/** For abandoned */
								let abandonedPerMonth		= (asyncResponse.abandoned[records._id]) ? asyncResponse.abandoned[records._id] : 0;
								ABANDONED_CALCULATION.map(percentage=>{
									if(abandonedPerMonth == percentage.value) abandonedScore	=	percentage.percentage;
								});
								records.abandoned				= (abandonedPerMonth) ? abandonedPerMonth : 0;
								records.abandoned_score			= (abandonedScore) ? abandonedScore : 0;
								finalScore					+=	records.abandoned_score;

								/** For Quality */
								let endUserCritical		=	(asyncResponse.quality[records._id] && asyncResponse.quality[records._id][END_USER_CRITICAL]) ? asyncResponse.quality[records._id][END_USER_CRITICAL] : 0;
								let businessCritical	=	(asyncResponse.quality[records._id] && asyncResponse.quality[records._id][BUSINESS_CRITICAL]) ? asyncResponse.quality[records._id][BUSINESS_CRITICAL] :0 ;
								let nonCritical			=	(asyncResponse.quality[records._id] && asyncResponse.quality[records._id][NON_CRITICAL]) ? asyncResponse.quality[records._id][NON_CRITICAL] : 0;
								let endUserCriticalScore= 	0;
								let businessCriticalScore= 	0;
								let nonCriticalScore	= 	0;
								QUALITY_CALCULATION.END_USER_CRITICAL.map(endUser=>{
									if(endUserCritical == endUser.value) endUserCriticalScore	=	endUser.percentage;
								});
								QUALITY_CALCULATION.BUSINESS_CRITICAL.map(business=>{
									if(businessCritical == business.value) businessCriticalScore	=	business.percentage;
								});
								QUALITY_CALCULATION.NON_CRITICAL.map(non=>{
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

								
								let casualWeekendPercentage	=	(totalCasualWeekEnd <= CASUAL_ONE ) ? CASUAL_LEAVE[CASUAL_ONE]['Weekend'] : ((totalCasualWeekEnd == CASUAL_TWO) ? ABSENT_TOTAL_PERCENTAGE - CASUAL_LEAVE[CASUAL_TWO]['Weekend'] : ABSENT_TOTAL_PERCENTAGE - CASUAL_LEAVE[CASUAL_OTHER]['Weekend']);
								let casualWorkingPercentage	=	(totalCasualWorking <= CASUAL_ONE ) ? CASUAL_LEAVE[CASUAL_ONE]['Working'] : ((totalCasualWorking == CASUAL_TWO) ? ABSENT_TOTAL_PERCENTAGE - CASUAL_LEAVE[CASUAL_TWO]['Working'] : ABSENT_TOTAL_PERCENTAGE - CASUAL_LEAVE[CASUAL_OTHER]['Working']);
								let sickWeekendPercentage	=	(totalSickWeedkEnd <= CASUAL_TWO ) ? SICK_LEAVE[CASUAL_TWO]['Weekend'] : ((totalSickWeedkEnd == CASUAL_THREE) ? ABSENT_TOTAL_PERCENTAGE - SICK_LEAVE[CASUAL_THREE]['Weekend'] : ABSENT_TOTAL_PERCENTAGE - SICK_LEAVE[CASUAL_OTHER]['Weekend']);
								let sickWorkingPercentage	=	(totalSickWorking <= CASUAL_TWO ) ? SICK_LEAVE[CASUAL_TWO]['Working'] : ((totalSickWeedkEnd <= CASUAL_THREE) ? ABSENT_TOTAL_PERCENTAGE - SICK_LEAVE[CASUAL_THREE]['Working'] : ((totalSickWeedkEnd <= SICK_FIVE) ? ABSENT_TOTAL_PERCENTAGE - SICK_LEAVE[SICK_FIVE]['Working'] : ABSENT_TOTAL_PERCENTAGE -SICK_LEAVE[CASUAL_OTHER]['Working']));
								
								let sumOfPercentages		=	casualWeekendPercentage + casualWorkingPercentage + sickWeekendPercentage + sickWorkingPercentage;

								let totalPercentage			=	(sumOfPercentages < -ABSENT_TOTAL_PERCENTAGE) ? 0 :  sumOfPercentages + ABSENT_TOTAL_PERCENTAGE;
								
								records.shift_working_days	=	totalCasualWorking + totalSickWorking;
								records.shift_weekends		=	totalCasualWeekEnd + totalSickWeedkEnd;
								records.shift_score			=	totalPercentage;
								records.total_score			=	finalScore;
							});
							/** Get result of avaya monthly report**/
							if(result.length > 0){
								result.map(records=>{
									let statusLabelActive	=	(records.active !== undefined && records.active == ACTIVE) ? res.__("admin.system.active") :res.__("admin.system.inactive");
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
				});
			});
		}else{
			/** Set conditions */
			let teamConditions =  clone(ADMIN_USER_COMMON_CONDITIONS);
			teamConditions.team_head = true;
			
			let options = {
				collections : [{
					collection	:	"users",
					columns		: 	["_id", "full_name"],
					conditions	: 	teamConditions
				}]
			};
			/** Get users dropdown list **/
			getDropdownList(req,res,next,options).then(response=>{ 
				let teamList			=	(response && response.final_html_data["0"])	?	response.final_html_data["0"]:'';
							
				/** Set dropdown options **/
				req.breadcrumbs(BREADCRUMBS['admin/avaya_monthly_reports/avaya_monthly_report_list']);
				res.render('monthly_report',{
					team_list   		: 	teamList,
				});
			}).catch(next);
		}	
	};//End calculateMonthlyStats()
}
module.exports = new MonthlyReport();
