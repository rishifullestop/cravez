import { ObjectId } from 'mongodb';
import { parallel as asyncParallel, each as asyncEach } from 'async';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from '../../../../utils/index.mjs';

export default class DriverScheduleList {
    constructor(db) {
        this.db = db;
    }

	/**
	 * Function to get driver schedule list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	*/
	async getScheduleList (req,res,next){
		return new Promise(resolve=>{
			req.body 		= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			var fromDate	= Helpers.newDate("",Constants.DATABASE_DATE_FORMAT);
			var toDate		= Helpers.newDate(Helpers.addDate(Constants.HOURS_IN_A_DAY*(Constants.DAYS_IN_A_WEEK-1)),Constants.DATABASE_DATE_FORMAT);
			let userId 	  	= (req.body.user_id)   ? req.body.user_id : "";

			/** Send error response */
			if(!userId) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			/**call function for get driver shifts details */
			this.teamAvailabilitiesDetails(req,res,next,{from_date: fromDate, to_date: toDate, user_id: userId}).then(response=>{
				if(response.status != Constants.STATUS_SUCCESS) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

				resolve({
					status : Constants.STATUS_SUCCESS,
					result : response.shift_availability,
				});
			}).catch(next);
		}).catch(next);
	}// End getScheduleList

	/**
	 * Function to get shifts detail
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return json
	*/
	async teamAvailabilitiesDetails (req,res,next,options){
		return new Promise(resolve=>{
			let fromDate  =  Helpers.newDate(options.from_date+" "+Constants.START_DATE_TIME_FORMAT);
			let toDate 	  =  Helpers.newDate(options.to_date+" "+Constants.END_DATE_TIME_FORMAT);
			let userId 	  =  (options.user_id) ? options.user_id : '';

			let commonConditions = {
				date	: { $gte: fromDate, $lte: toDate},
				user_id : new ObjectId(userId)
			};

			asyncParallel({
				team_available:(teamCallback)=>{
					/**Get details from driver_shifts */
					const driver_availabilities = this.db.collection(Tables.DRIVER_AVAILABILITIES);
					driver_availabilities.find(commonConditions,{projection: {
						_id:1,date:1,shift_id:1,user_id:1,city_id:1,area_id:1,leave_type:1
					}}).sort({date : Constants.SORT_ASC}).toArray().then(teamResult=>{
						if(teamResult.length == 0) return teamCallback(null,teamResult);

						/** Push city id, area id and shift id in array */
						let cityIds 	= [];
						let areaIds 	= [];
						let shiftIds 	= [];
						teamResult.map(record=>{
							if(record.city_id) cityIds.push(record.city_id);
							if(record.area_id) areaIds.push(record.area_id);
							if(record.shift_id) shiftIds.push(record.shift_id);
						});

						asyncParallel({
							city_details: (callback)=>{
								/** Get city names */
								const cities = this.db.collection(Tables.CITIES);
								cities.find({_id : {$in : Helpers.arrayToObject(cityIds)}},{projection : {_id: 1,name: 1}}).toArray().then(cityResult=>{
									let cityList = {};
									cityResult.map(city=>{
										cityList[city._id] = city.name;
									});
									callback(null,cityList);
								}).catch(next);
							},
							area_details: (callback)=>{
								/** Get area names */
								const areas = this.db.collection(Tables.AREAS);
								areas.find({_id : {$in : Helpers.arrayToObject(areaIds)}},{projection : {_id: 1,name: 1}}).toArray().then(areaResult=>{
									let areaList = {};
									areaResult.map(area=>{
										areaList[area._id] = area.name;
									});
									callback(null,areaList);
								}).catch(next);
							},
							shift_details: (callback)=>{
								/** Get shifts names */
								const shifts = this.db.collection(Tables.SHIFTS);
								shifts.find({_id : {$in : Helpers.arrayToObject(shiftIds)}},{projection : {_id: 1,shift_name: 1,start_time: 1,end_time: 1 }}).toArray().then(shiftResult=>{
									let shiftList = {};
									shiftResult.map(shift=>{
										shiftList[shift._id] = {
											shift_name 	: shift.shift_name,
											start_time 	: Helpers.set24HourFormat(shift.start_time),
											end_time 	: Helpers.set24HourFormat(shift.end_time),
										}
									});
									callback(null,shiftList);
								}).catch(next);
							},
						},(asyncErr,asyncResponse)=>{
							if(asyncErr) return teamCallback(asyncErr);

							teamResult.map(record=>{
								let shiftId = record?.shift_id || "";

								record.shift_name 	=	shiftId && asyncResponse?.shift_details?.[shiftId]?.shift_name || "";
								record.start_time 	=	shiftId && asyncResponse?.shift_details?.[shiftId]?.start_time || "";
								record.end_time 	=	shiftId && asyncResponse?.shift_details?.[shiftId]?.end_time || "";
								record.area_name 	=	record.area_id && asyncResponse?.area_details?.[record.area_id] || "";
								record.city_name 	=	record.city_id && asyncResponse?.city_details?.[record.city_id] || "";
							});
							teamCallback(null,teamResult);
						});
					}).catch(next);
				},
				leave_type_list:(callback)=>{
					/** Get leave type list **/
					Helpers.getAttributes(req,res,next,{type: "vacation_leave_type"}).then(leaveTypeList=>{

						let tempLeaveType = {};
						if(leaveTypeList.length >0){
							leaveTypeList.map(records=>{
								tempLeaveType[String(records.attribute_id)] = records.title;
							});
						}
						callback(null, tempLeaveType);
					}).catch(next);
				},
				overtime_list:(callback)=>{

					/** Set conditions */
					let overtimeCondition	=	{
						request_date:	{ $gte: fromDate, $lte: toDate},
						user_id		:	new ObjectId(userId),
					};

					/** Get captain overtime request list **/
					const captain_overtime_requests = this.db.collection(Tables.CAPTAIN_OVERTIME_REQUESTS);
					captain_overtime_requests.aggregate([
						{$match : overtimeCondition},
						{$lookup: {	/** Get assign user details **/
							"from" 		  :	Tables.USERS,
							"localField"  :	"added_by",
							"foreignField":	"_id",
							"as" 		  :	"users_details"
						}},
						{$project : {
							request_date: 1, purpose: 1, hours: 1, assign_by: {$arrayElemAt: ["$users_details.full_name",0]}
						}}
					]).toArray().then(result=>{
						if(result.length ==0) return callback(null,{});

						let requestList = {};
						result.map(records=>{
							let requestDate			=	records.request_date;
							let dbDate 				=	Helpers.newDate(requestDate,Constants.DATABASE_DATE_FORMAT);
							records.request_date	=	Helpers.newDate(requestDate,Constants.AM_PM_FORMAT_WITH_DATE);

							if(!requestList[dbDate]) requestList[dbDate] = [];
							requestList[dbDate].push(records);
						});

						callback(null,requestList);
					}).catch(next);
				},
			},(err,response)=>{
				if(err) return next(err);

				let shiftData   	 = response.team_available;
				let leaveList   	 = response.leave_type_list;
				let overtimeList   	 = response.overtime_list;
				let userShifts		 = [];
				let dates  		 	 = Helpers.getDateRange(new Date(fromDate),new Date(toDate));

				shiftData.map((shiftTime)=>{
					let dbDate      = Helpers.newDate(shiftTime.date,Constants.DATABASE_DATE_FORMAT);

					if(!userShifts[dbDate]) userShifts[dbDate] = {};
					userShifts[dbDate]	=	{
						date 	   : dbDate,
						shift_name : shiftTime?.shift_name || "",
						start_time : shiftTime?.start_time || "",
						end_time   : shiftTime?.end_time || "",
						leave_type : shiftTime?.leave_type && leaveList?.[String(shiftTime.leave_type)]  || "",
						city 	   : shiftTime.city_name,
						area 	   : shiftTime.area_name,
					};
				});

				let result	=	[];
				dates.map((shiftDate)=>{
					let date 			= 	Helpers.newDate(shiftDate,Constants.DATABASE_DATE_FORMAT);
					let shiftDetails	=	(userShifts[date])	?	userShifts[date] :{};
					let overtimeDetails	=	(overtimeList[date])?	overtimeList[date] :[];

					result.push({
						date 	   : (shiftDetails.date)		?	shiftDetails.date 		:date,
						shift_name : (shiftDetails.shift_name)	?	shiftDetails.shift_name	:"",
						start_time : (shiftDetails.start_time)	?	shiftDetails.start_time	:"",
						end_time   : (shiftDetails.end_time)	?	shiftDetails.end_time	:"",
						leave_type : (shiftDetails.leave_type)	?	shiftDetails.leave_type	:"",
						city 	   : (shiftDetails.city)		?	shiftDetails.city		:"",
						area 	   : (shiftDetails.area)		?	shiftDetails.area		:"",
						overtime_list: overtimeDetails,
					});
				});

				resolve({
					shift_availability: result,
					status : Constants.STATUS_SUCCESS,
				});
			});
		}).catch(next);
	};// End teamAvailabilitiesDetails()

	/**
	 * Function to get item list
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async getModifierItems (req, res, next,options){
		return new Promise(resolve=>{
			let menuId = (options && options.menu_id) ? options.menu_id :Constants.PIZZA_HUT_MENU_ID;
			let itemId = (options && options.item_id) ? new ObjectId(options.item_id) :"1";

			if(!itemId) return resolve({status:Constants.STATUS_ERROR, message:res.__("system.invalid_access")});

			if(menuId != Constants.PIZZA_HUT_MENU_ID && menuId != Constants.BURGER_KING_MENU_ID){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });
			}

			/** Get order details */
			const items = this.db.collection(Tables.ITEMS);
			items.findOne({_id: itemId},{projection:{item_id: 1, restaurant_id: 1}}).then(result=>{

				if(!result) return resolve({status:Constants.STATUS_ERROR, message:res.__("system.invalid_access") });

				let uniqueItemId = result.item_id;
				let restaurantId = result.restaurant_id;

				let apiData = '<ITEMS> <ITEM ID="2001"> <MODIFIERGROUP GROUPID="10001" APPLICABLEMODIFIERS="0"> <MODITEMS ID="700743" PRICE="0.5" SEQ=""/> <MODITEMS ID="700701" PRICE="0.25" SEQ=""/> <MODITEMS ID="700704" PRICE="0.25" SEQ=""/> <MODITEMS ID="700744" PRICE="0.25" SEQ="" /> </MODIFIERGROUP> <MODIFIERGROUP GROUPID="10000" APPLICABLEMODIFIERS="0"> <MODITEMS ID="700731" PRICE="0.25" SEQ=""/> <MODITEMS ID="700732" PRICE="0.35" SEQ=""/> <MODITEMS ID="700735" PRICE="0.2" SEQ="" /> <MODITEMS ID="700332" PRICE="0.25" SEQ=""/> </MODIFIERGROUP> </ITEM> </ITEMS>';

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				if(!jsonData || !jsonData.ITEMS || !jsonData.ITEMS.ITEM || !jsonData.ITEMS.ITEM.MODIFIERGROUP){
					return resolve({status: Constants.STATUS_ERROR,  message:res.__("system.something_going_wrong_please_try_again") });
				}

				if(jsonData.ITEMS.ITEM.MODIFIERGROUP.constructor != Array ){
					let tempObj = jsonData.ITEMS.ITEM.MODIFIERGROUP;
					jsonData.ITEMS.ITEM.MODIFIERGROUP = [];
					jsonData.ITEMS.ITEM.MODIFIERGROUP.push(tempObj);
				}

				let apiModifierList = jsonData.ITEMS.ITEM.MODIFIERGROUP;

				let missingData 	= [];
				let extraItemIds 	= [];
				let groupIds 		= [];
				apiModifierList.map(record =>{
					if(!record._attributes.GROUPID) 	missingData.push("GROUPID");
					if(!record._attributes.MODITEMS) 	missingData.push("MODITEMS");

					if(record._attributes.GROUPID) groupIds.push(record._attributes.GROUPID);

					if(record._attributes.MODITEMS){
						if(record._attributes.MODITEMS.constructor != Array ){
							let tempObj = record._attributes.MODITEMS;
							record._attributes.MODITEMS = [];
							record._attributes.MODITEMS.push(tempObj);
						}

						record._attributes.MODITEMS.map(data=>{
							if(!data._attributes.ID) 	missingData.push("ID");

							if(data._attributes.ID) extraItemIds.push(String(data._attributes.ID));
						});
					}else{
						missingData.push("MODITEMS");
					}
				});

				/** Send error response */
				if(missingData.length > 0) return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access"), missing: missingData.join(", ") });

				asyncParallel({
					admin_details : (callback)=>{
						/** Get admin details */
						const users	= this.db.collection(Tables.USERS);
						users.findOne({user_role_id: CRAVEZ },{projection:{_id:1}}).then(userResult=>{
							callback(null, userResult);
						}).catch(next);
					},
					group_list : (callback)=>{
						/** Get group list */
						const cravez_choices_groups	= this.db.collection(Tables.CRAVEZ_CHOICES_GROUPS);
						cravez_choices_groups.find({
							kfg_modifier_group_id : {$in: groupIds}
						},{projection: {
							name:1,max:1,min:1,kfg_modifier_group_id:1
						}}).toArray().then(groupResult=>{
							if(groupResult.length <=0) return callback(null,null);

							let groupObj = {};
							groupResult.map(records=>{
								groupObj[records.kfg_modifier_group_id] = records;
							});
							callback(null, groupObj);
						}).catch(next);
					},
					item_list : (callback)=>{
						/** Get item list */
						const cravez_items	= this.db.collection(Tables.CRAVEZ_ITEMS);
						cravez_items.find({
							item_id : {$in: extraItemIds}
						},{projection: {
							item_id: 1, description: 1, item_price: 1, order: 1, name: 1
						}}).toArray().then(exItemResult=>{
							if(exItemResult.length <=0) return callback(null,null);

							let exItemObj = {};
							exItemResult.map(records=>{
								exItemObj[records.item_id] = records;
							});
							callback(null, exItemObj);
						}).catch(next);
					},
				},(asyncErr, asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					if(!asyncResponse.item_list || !asyncResponse.group_list || !asyncResponse.admin_details){
						return resolve({status: Constants.STATUS_ERROR,  message:res.__("system.something_going_wrong_please_try_again") });
					}

					let groupList 	= 	asyncResponse.group_list;
					let itemList 	= 	asyncResponse.item_list;
					let userDetails = 	asyncResponse.admin_details;
					let addedBy		=	userDetails._id;
					let finalArray	=	[];
					let missingItems= 	[];

					apiModifierList.map(record =>{
						let data 		=	record._attributes;
						let tmpGroupId	=	data.GROUPID;
						let tmpObj 		=	{};

						if(groupList[tmpGroupId]){
							data.MODITEMS.map(itemRecords=>{
								let itemData 	=	itemRecords._attributes;
								let tmpItemId 	= 	itemData.ID;

								if(itemList[tmpItemId]){
									finalArray.push({
										group_id	: 	tmpGroupId,
										item_id 	: 	tmpItemId,
										group_name	:	groupList[tmpGroupId].name,
										group_max	:	groupList[tmpGroupId].max,
										group_min	:	groupList[tmpGroupId].min,
										item_name	:	itemList[tmpItemId].name,
										description	:	itemList[tmpItemId].description,
										item_price	:	(itemData.PRICE > 0) ? itemData.PRICE :itemList[tmpItemId].item_price,
										item_order	:	(itemData.SEQ > 0) ? itemData.SEQ :itemList[tmpItemId].order,
									});
								}else{
									if(!tmpObj[tmpGroupId]) tmpObj[tmpGroupId] = {group:tmpGroupId,item:[]};

									tmpObj[tmpGroupId].item.push(tmpItemId);
								}
							});
						}else{
							tmpObj[tmpGroupId] = {group: tmpGroupId};
						}

						if(Object.keys(tmpObj).length >0){
							missingItems.push(Object.values(tmpObj));
						}
					});

					if(missingItems.length >0){
						return resolve({ status: Constants.STATUS_ERROR, message: res.__("system.invalid_access"), missing: missingItems });
					}

					let   itemGroupObj 			= 	{};
					let   itemExItemObj 		= 	{};
					const item_choices_groups	=	this.db.collection(Tables.ITEM_CHOICES_GROUPS);
					const item_extra_masters	=	this.db.collection(Tables.ITEM_EXTRA_MASTERS);
					const item_group_extras		=	this.db.collection(Tables.ITEM_GROUP_EXTRAS);
					asyncEach(finalArray,(records,eachcallback)=>{
						let kfgGroupIdString 	= 	String(records.group_id);
						let kfgGroupIdInt 		= 	parseInt(records.group_id);
						let kfgExItemIdInt		=	parseInt(records.item_id);
						let kfgExItemIdString 	=	String(records.item_id);
						let exItemPrice	 		=	parseFloat(records.item_price);
						let groupMaxQty			=	(records.group_max) ? records.group_max :1;
						let groupMinQty			=	(records.group_min) ? records.group_min :0;

						asyncParallel({
							group_details : (callback)=>{
								if(itemGroupObj[kfgGroupIdInt]) return callback(null, itemGroupObj[kfgGroupIdInt]);

								/** Get group details */
								item_choices_groups.findOne({
									item_id 				:	itemId,
									restaurant_id 			:	restaurantId,
									kfg_modifier_group_id 	:	{$in: [kfgGroupIdInt,kfgGroupIdString]}
								},{projection:{_id:1}}).then(groupResult=>{
									let tmpGroupId =  (groupResult) ? groupResult._id :"";

									if(tmpGroupId){
										if(tmpGroupId)  itemGroupObj[kfgGroupIdInt] = tmpGroupId;
										return callback(null, tmpGroupId);
									}

									item_choices_groups.updateOne({
										item_id 				: 	itemId,
										restaurant_id 			:	restaurantId,
										kfg_modifier_group_id 	:	{$in: [kfgGroupIdInt,kfgGroupIdString]}
									},
									{
										$set : {
											item_unit_id	:	"",
											order			:	2,
											name			:	records.group_name,
											max_quantity	:	groupMaxQty,
											min_quantity	:	groupMinQty,
										},
										$setOnInsert: {
											kfg				: 	true,
											added_by		: 	addedBy,
											created			: 	Helpers.getUtcDate(),
											channel_id		: 	Constants.CHANNEL_SOAP,
											kfg_main_item_id: 	uniqueItemId,
											kfg_modifiers_groups_id : kfgGroupIdInt
										}
									},{upsert: true}).then(updateResult=>{
										let tmpGroupId = updateResult?.upsertedId || "";

										if(tmpGroupId) itemGroupObj[kfgGroupIdInt] = tmpGroupId;

										callback(null, tmpGroupId);
									}).catch(next);
								}).catch(next);
							},
							exitem_details : (callback)=>{
								if(itemExItemObj[kfgGroupIdInt]) return callback(null, itemExItemObj[kfgExItemIdInt]);

								/** Get extra item */
								item_extra_masters.findOne({
									item_id 		:	itemId,
									restaurant_id 	:	restaurantId,
									extra_item_id 	:	{$in: [kfgExItemIdInt,kfgExItemIdString]}
								},{projection:{_id:1}}).then(exItemResult=>{
									let tmpExItemId =  (exItemResult) ? exItemResult._id :"";

									if(tmpExItemId){
										if(tmpExItemId)  itemExItemObj[kfgExItemIdInt] = tmpExItemId;
										return callback(null, tmpExItemId);
									}

									/** Set update data  */
									let exUpdateData = {
										name 		: 	records.item_name,
										order 		: 	records.item_order,
										extra_fees 	:	exItemPrice,
									};

									if(records.description) exUpdateData.description =  records.description;

									/** Save extra item */
									item_extra_masters.updateOne({
										item_id 		:	itemId,
										restaurant_id 	:	restaurantId,
										extra_item_id 	:	{$in: [kfgExItemIdInt,kfgExItemIdString]}
									},
									{
										$set 		: exUpdateData,
										$setOnInsert: {
											kfg				: 	true,
											added_by		: 	addedBy,
											created			: 	Helpers.getUtcDate(),
											kfg_main_item_id: 	uniqueItemId,
											channel_id		: 	Constants.CHANNEL_SOAP,
											extra_item_id 	: 	kfgExItemIdInt
										}
									},{upsert: true}).then(updateResult=>{
										let tmpExItemId = updateResult?.upsertedId || "";

										if(tmpExItemId) itemExItemObj[kfgExItemIdInt] = tmpExItemId;

										callback(null, tmpExItemId);
									}).catch(next);
								}).catch(next);
							},
						},(asyncSubErr, asyncSubResponse)=>{
							if(asyncSubErr) return eachcallback(asyncSubErr);

							if(asyncSubResponse.group_details && asyncSubResponse.exitem_details){
								let groupId 		= 	asyncSubResponse.group_details;
								let exItemgroupId 	=	asyncSubResponse.exitem_details;

								/** Save extra item */
								item_group_extras.updateOne({
									item_id 		:	itemId,
									restaurant_id 	:	restaurantId,
									group_id 		:	groupId,
									item_extra_id 	:	exItemgroupId
								},
								{
									$set 		: {
										max_quantity : groupMaxQty,
										min_quantity : groupMinQty,
										extra_fees	 : exItemPrice,
									},
									$setOnInsert: {
										kfg				: 	true,
										added_by		: 	addedBy,
										created			: 	Helpers.getUtcDate(),
										kfg_main_item_id: 	uniqueItemId,
										channel_id		: 	Constants.CHANNEL_SOAP,
										extra_item_id 	: 	kfgExItemIdInt
									}
								},{upsert: true}).then(()=>{
									eachcallback(null);
								}).catch(next);
							}else{
								let message = "Missing ";
								if(!asyncSubResponse.group_details) message += " Group id - "+kfgGroupIdString;
								if(!asyncSubResponse.exitem_details) message += " extra item id - "+kfgExItemIdString;

								console.error(message);
								eachcallback(null);
							}
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return next(asyncEachErr);

						resolve({status: Constants.STATUS_SUCCESS });
					});
				});
			}).catch(next);
		}).catch(next);
	};//End getModifierItems()
}// End DriverScheduleList