import { ObjectId } from 'mongodb';
import clone from 'clone';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, getDropdownList, sanitizeData, arrayToObject, newDate, getUtcDate, getDateRange, convertSecondsToTimeFormat } from '../../../../utils/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { parallel as asyncParallel } from 'async';

class QualityMonitorForm{
	
    constructor(db) {
        this.db = db;
    }

	/**
	 * Function to get quality monitor form list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getQualityMonitorForm(req,res,next){
		try {
			if(isPost(req)){				
				/** Sanitize Data */
				req.body =	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
				let id 					= 	req?.body?.id ?	new ObjectId(req.body.id)			:new ObjectId();
				let qualityId 			= 	req?.body?.quality_id ?	new ObjectId(req.body.quality_id)	:new ObjectId();
				let agentId 			= 	req?.body?.agent_id				|| "";
				let teamLeaderId 		= 	req?.body?.team_leader_id		|| "";
				let customerName		= 	req?.body?.customer_name		|| "";
				let phoneNumber			= 	req?.body?.phone_number			|| "";
				let typeOfCall			= 	req?.body?.type_of_call			|| "";
				let typeOfCallEnquiry	= 	req?.body?.type_of_call_enquiry	|| "";
				let dateTime			= 	req?.body?.date_time			|| "";
				let callDateTime		= 	req?.body?.call_date_time		|| "";
				let monitoredBy			= 	req?.body?.monitored_by			|| "";
				let team				= 	req?.body?.team					|| "";
				let typeOfSheet			= 	req?.body?.type_of_sheet		|| "";
				let overAllPercenatge	= 	req?.body?.over_all_percenatge	|| "";
				let data				= 	req?.body?.data					|| "";				
				
				let summaryData	=	[];
				if(data.length > 0){
					data.forEach(datas=>{
						summaryData.push({
							'category_id' : new ObjectId(datas.first_level_category_id),
							'number_of_error' : parseInt(datas.totel_error),
							'percentage_of_category' : parseFloat(datas.percentage_of),
							'type' : datas.type
						});
					});
					
					data.forEach(datas=>{
						datas.first_level_category_id = new ObjectId(datas.first_level_category_id);
						datas.totel_error =  parseInt(datas.totel_error);
						datas.percentage_of = parseFloat(datas.percentage_of);
						
						datas.attribute_detail.forEach(secondLevel=>{  
							secondLevel.second_level_category_id = new ObjectId(secondLevel.second_level_category_id);
							secondLevel.second_level_percentage	 = parseFloat(secondLevel.second_level_percentage);
							secondLevel.cn_percentage			 = parseFloat(secondLevel.cn_percentage);
							
							secondLevel.third_level_detail.forEach(secondLevel=>{ 
								secondLevel.third_level_category_id = new ObjectId(secondLevel.third_level_category_id);
								secondLevel.third_level_percentage = parseFloat(secondLevel.third_level_percentage);
								secondLevel.comment = secondLevel.comment;
							});
						});
					});
				}
				
				const avaya_quality_summary = this.db.collection(Tables.AVAYA_QUALITY_SUMMARY);
				await avaya_quality_summary.updateOne({
					_id : id
				},
				{
					$set : {
						agent_id 			: new ObjectId(agentId),
						team_leader_id 		: new ObjectId(teamLeaderId),
						date_time			: getUtcDate(dateTime),
						call_date_time		: getUtcDate(callDateTime),
						type_of_sheet		: typeOfSheet,
						over_all_percenatge	: parseFloat(overAllPercenatge),
						data				: summaryData,
						modified   			: getUtcDate()
					},
					$setOnInsert : {
						created 			: getUtcDate(),
					}
				},{ upsert : true });
				
				const avaya_quality_details = this.db.collection(Tables.AVAYA_QUALITY_DETAILS);
				await avaya_quality_details.updateOne({
					_id 		: qualityId,
					parent_id 	: id
				},
				{
					$set : {
						agent_id 			: new ObjectId(agentId),
						team_leader_id 		: new ObjectId(teamLeaderId),
						customerName 		: customerName,
						phone_number		: phoneNumber,
						type_of_call		: typeOfCall,
						monitored_by		: new ObjectId(monitoredBy),
						team				: team,
						type_of_call_enquiry: typeOfCallEnquiry,
						data 				: data
					}
				},
				{upsert : true });
				
				req.flash(Constants.STATUS_SUCCESS,res.__('admin.quality_monitor_form.summary_added'));
				res.send({
					status : Constants.STATUS_SUCCESS,
					message: res.__('admin.quality_monitor_form.summary_added')
				});
			}else{
				const avaya_quality_categories = this.db.collection(Tables.AVAYA_QUALITY_CATEGORIES);
				let result = await avaya_quality_categories.find({
					parent_category_id : 0
				},{projection: {
					_id:1,category_name:1,parent_category_id:1,category_percentage:1,type:1
				}}).toArray();
								
				let categoryIds = [];
				result.forEach(record=>{
					categoryIds.push(record._id);
				});
				
				asyncParallel({
					category_details: (callback)=>{
						/** Get second categories names */
						avaya_quality_categories.aggregate([
							{ $match : { parent_category_id : {$in : arrayToObject(categoryIds)}}},
							{ $lookup: {	/** Get third category **/
								from 		:	Tables.AVAYA_QUALITY_CATEGORIES,
								localField  :	"_id",
								foreignField:	"parent_category_id",
								as 		  	:	"sub_category_details"
							}},
							{ $project : {
								_id: 1,category_name: 1,parent_category_id:1,sub_category_details:1,is_non_critical:1,category_percentage:1
							}}
						]).toArray().then(catResult=>{
							if(catResult.length <= 0) return callback(null,[]);

							let categoryList = {};
							result.forEach((record,key)=>{ 
								if(!categoryList[key]) categoryList[record._id] = {};
								categoryList[record._id].name		=	record.category_name;
								categoryList[record._id].type		=	record.type;
								categoryList[record._id]['data']	=	[];
								catResult.forEach(list=>{ 
									if(String(record._id) == String(list.parent_category_id)) categoryList[record._id]['data'].push(list);
								});
							});
							callback(null,categoryList);
						}).catch(next);
					},
					dropdown_list :(callback)=>{
						/** Set conditions */
						let teamConditions =  clone(Constants.ADMIN_USER_COMMON_CONDITIONS);
						teamConditions.team_head = false;
						teamConditions.parent_id = { $exists: true ,$ne : "" };
						
						let qaTeamConditions =  clone(Constants.ADMIN_USER_COMMON_CONDITIONS);
						qaTeamConditions.user_role_id = Constants.QA_TEAM;
						
						/** Get users dropdown list **/
						getDropdownList(req,res,next,{
							collections : [{
								collection	:	Tables.USERS,
								columns		: 	["_id", "full_name"],
								conditions	: 	teamConditions
							},{
								collection	:	Tables.USERS,
								columns		: 	["_id", "full_name"],
								conditions	: 	qaTeamConditions
							}]
						}).then(response=>{ 
							callback(null,response?.final_html_data || []);
						}).catch(next);
					},
				},(asyncErr,asyncResponse)=>{ 
					if(asyncErr) return next(asyncErr);
					
					/** Render view */					
					req.breadcrumbs(BREADCRUMBS['admin/quality_monitor_form/list']);
					res.render('list',{
						category_details	:	asyncResponse?.category_details || {},
						team_list   		: 	asyncResponse?.dropdown_list?.[0] || '',
						qa_list   			: 	asyncResponse?.dropdown_list?.[1] || '',
					});
				});
			}			
		} catch (error) {
			return next(error);
		}
	};//End getQualityMonitorForm()
	
	/**
	 * Function to get quality monitor form list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getQualityMonitorForm1(req,res,next){
		try {
			if(isPost(req)){
				/** Sanitize Data */
				req.body =	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
				let id 					= 	req?.body?.id ?	new ObjectId(req.body.id) :new ObjectId();
				let qualityId 			= 	req?.body?.quality_id ?	new ObjectId(req.body.quality_id)	:new ObjectId();
				let agentId 			= 	req?.body?.agent_id || "";
				let teamLeaderId 		= 	req?.body?.team_leader_id || "";
				let customerName		= 	req?.body?.customer_name || "";
				let phoneNumber			= 	req?.body?.phone_number || "";
				let typeOfCall			= 	req?.body?.type_of_call || "";
				let typeOfCallEnquiry	= 	req?.body?.type_of_call_enquiry || "";
				let dateTime			= 	req?.body?.date_time || "";
				let callDateTime		= 	req?.body?.call_date_time || "";
				let monitoredBy			= 	req?.body?.monitored_by || "";
				let team				= 	req?.body?.team || "";
				let typeOfSheet			= 	req?.body?.type_of_sheet || "";
				let overAllPercenatge	= 	req?.body?.over_all_percenatge || "";
				let data				= 	req?.body?.data || "";
				
				let summaryData	=	[];
				if(data.length > 0){
					data.forEach(datas=>{
						summaryData.push({
							'category_id' : new ObjectId(datas.first_level_category_id),
							'number_of_error' : parseInt(datas.totel_error),
							'percentage_of_category' : parseFloat(datas.percentage_of),
							'type' : datas.type
						});
					});
					
					data.forEach(datas=>{
						datas.first_level_category_id = new ObjectId(datas.first_level_category_id);
						datas.totel_error =  parseInt(datas.totel_error);
						datas.percentage_of = parseFloat(datas.percentage_of);

						datas.attribute_detail.forEach(secondLevel=>{  
							secondLevel.second_level_category_id = new ObjectId(secondLevel.second_level_category_id);
							secondLevel.second_level_percentage	 = parseFloat(secondLevel.second_level_percentage);
							secondLevel.cn_percentage			 = parseFloat(secondLevel.cn_percentage);
							
							secondLevel.third_level_detail.forEach(secondLevel=>{ 
								secondLevel.third_level_category_id = new ObjectId(secondLevel.third_level_category_id);
								secondLevel.third_level_percentage = parseFloat(secondLevel.third_level_percentage);
								secondLevel.comment = secondLevel.comment;
							});
						});
					});
				}
				
				const avaya_quality_summary = this.db.collection(Tables.AVAYA_QUALITY_SUMMARY1);
				await avaya_quality_summary.updateOne({
					_id : id
				},
				{
					$set : {
						agent_id 			: new ObjectId(agentId),
						team_leader_id 		: new ObjectId(teamLeaderId),
						date_time			: getUtcDate(dateTime),
						call_date_time		: getUtcDate(callDateTime),
						type_of_sheet		: typeOfSheet,
						over_all_percenatge	: parseFloat(overAllPercenatge),
						data				: summaryData,
						modified   			: getUtcDate()
					},
					$setOnInsert : {
						created 			: getUtcDate(),
					}
				},{ upsert : true });
				
				const avaya_quality_details = this.db.collection(Tables.AVAYA_QUALITY_DETAILS1);
				await avaya_quality_details.updateOne({
					_id 		: qualityId,
					parent_id 	: id
				},
				{
					$set : {
						agent_id 			: new ObjectId(agentId),
						team_leader_id 		: new ObjectId(teamLeaderId),
						customerName 		: customerName,
						phone_number		: phoneNumber,
						type_of_call		: typeOfCall,
						monitored_by		: new ObjectId(monitoredBy),
						team				: team,
						type_of_call_enquiry: typeOfCallEnquiry,
						data 				: data
					}
				},{upsert : true });
				
				req.flash(Constants.STATUS_SUCCESS,res.__('admin.quality_monitor_form.summary_added'));
				res.send({
					status : Constants.STATUS_SUCCESS,
					message: res.__('admin.quality_monitor_form.summary_added')
				});				
			}else{
				const avaya_quality_categories = this.db.collection(Tables.AVAYA_QUALITY_CATEGORIES1);
				let result = await avaya_quality_categories.find({
					parent_category_id : 0 
				},{projection: {
					_id:1,category_name:1,parent_category_id:1,category_percentage:1,type:1
				}}).toArray();
				
				let categoryIds 	= [];
				result.forEach(record=>{
					categoryIds.push(record._id);
				});

				asyncParallel({
					category_details: (callback)=>{
						/** Get second categories names */
						avaya_quality_categories.aggregate([
							{ $match : { parent_category_id : {$in : arrayToObject(categoryIds)}}},
							{ $lookup: {	/** Get third category **/
								from 		:	Tables.AVAYA_QUALITY_CATEGORIES1,
								localField  :	"_id",
								foreignField:	"parent_category_id",
								as 		  	:	"sub_category_details"
							}},
							{ $project : {
								_id: 1,category_name: 1,parent_category_id:1,sub_category_details:1,is_non_critical:1,category_percentage:1
							}}
						]).toArray().then(catResult=>{
							if(catResult.length <= 0) return callback(null,[]);

							let categoryList = {};
							result.forEach((record,key)=>{ 
								if(!categoryList[key]) categoryList[record._id] = {};
								categoryList[record._id].name		=	record.category_name;
								categoryList[record._id].type		=	record.type;
								categoryList[record._id]['data']	=	[];
								catResult.forEach(list=>{ 
									if(String(record._id) == String(list.parent_category_id)) categoryList[record._id]['data'].push(list);
								});
							});
							callback(null,categoryList);
						}).catch(next);
					},
					dropdown_list :(callback)=>{
						/** Set conditions */
						let teamConditions =  clone(Constants.ADMIN_USER_COMMON_CONDITIONS);
						teamConditions.team_head = false;
						teamConditions.parent_id = { $exists: true ,$ne : "" };
						
						let qaTeamConditions =  clone(Constants.ADMIN_USER_COMMON_CONDITIONS);
						qaTeamConditions.user_role_id = Constants.QA_TEAM;
						
						/** Get users dropdown list **/
						getDropdownList(req,res,next,{
							collections : [{
								collection	:	Tables.USERS,
								columns		: 	["_id", "full_name"],
								conditions	: 	teamConditions
							},{
								collection	:	Tables.USERS,
								columns		: 	["_id", "full_name"],
								conditions	: 	qaTeamConditions
							}]
						}).then(response=>{ 
							callback(null,response?.final_html_data || []);
						}).catch(next);
					},
				},(asyncErr,asyncResponse)=>{ 
					if(asyncErr) return next(asyncErr);
					
					/** Render view */										
					req.breadcrumbs(BREADCRUMBS['admin/quality_monitor_form/list']);
					res.render('list1',{
						category_details	:	asyncResponse?.category_details || {},
						team_list   		: 	asyncResponse?.dropdown_list?.[0] || '',
						qa_list   			: 	asyncResponse?.dropdown_list?.[1] || '',
					});
				});
			}
		} catch (error) {
			return next(error);
		}
	};//End getQualityMonitorForm()
	
	/**
	 * Function for get user list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async getUserList(req,res,next){
		try {
			let agentId = req.body.agent_id;

			/** Send error response */
			if(!agentId ) return res.send({status: Constants.STATUS_ERROR, message :res.__("admin.system.something_going_wrong_please_try_again") });

			/** Find user by id */
			const users	=	this.db.collection(Tables.USERS);
			let result = await users.findOne({
				_id : new ObjectId(agentId)
			},{projection : {parent_id : 1 }});

			/** Send error response */
			if(!result ) return res.send({status: Constants.STATUS_ERROR, message :res.__("admin.system.something_going_wrong_please_try_again") });

			/**Get user list by parent id **/
			let dropDownResponse = await getDropdownList(req,res, next,{
				collections :[
					{
					collection 	: 	Tables.USERS,
						columns    	:	["_id", "full_name"],
						conditions 	: {
							_id 	: new ObjectId(result.parent_id),
							active 	: Constants.ACTIVE,
							team_head : true
						},
					},
				]
			});
			
			/** Send response */
			res.send({
				status     : Constants.STATUS_SUCCESS,
				user_list  : dropDownResponse?.final_html_data?.["0"] || ''
			});
		} catch (error) {
			return next(error);
		}
	};//End getUserList()
	
	/**
	 * Function to get quality monitor view
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async viewQualityMonitorForm(req,res,next){
		try {
			if(isPost(req)){ 
				let fromDate 		= req?.body?.from_date || "";
				let toDate 			= req?.body?.to_date || "";
				let teamLeaderId 	= req?.body?.team_leader_id || "";
				const collection	= this.db.collection(Tables.AVAYA_QUALITY_SUMMARY);
				
				/** Set conditions */
				let commonConditions	=	{};
				if (fromDate && toDate) {
					commonConditions.date_time = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					}
				}
				
				if(teamLeaderId) commonConditions.team_leader_id = new ObjectId(teamLeaderId);
				
				asyncParallel({
					agent_data :(callback)=>{
						/** Get list of avaya quanilty's **/
						collection.aggregate([
							{$match : commonConditions},
							{$lookup: {	/** Get agent details **/
								"from" 		  :	Tables.USERS,
								"localField"  :	"agent_id",
								"foreignField":	"_id",
								"as" 		  :	"agent_details"
							}},
							{$group :{
								_id 				 :	"$agent_id",
								over_all_percentage  : 	{$sum: "$over_all_percenatge"},
								over_all_count  	 : 	{$sum: 1},
								agent_name			 :  {$first : "$agent_details.full_name"},
							}},
						]).toArray().then(result=>{
							callback(null, result);
						}).catch(next);
					},
					team_leader_data :(callback)=>{
						/** Get filtered records couting in avaya quanilty **/
						collection.aggregate([
							{$match : commonConditions},
							{$group :{
								_id : null,
								over_all_percentage  : 	{$sum: "$over_all_percenatge"},
								over_all_count  	 : 	{$sum: 1},
							}},
						]).toArray().then(allResult=>{
							callback(null, allResult);
						}).catch(next);
					},
				},(asyncErr,asyncResponse)=>{  
					if(asyncErr){
						/** send error response */
						return res.send({
							status	: Constants.STATUS_ERROR,
							message	: res.__("admin.system.invalid_access")
						});
					}
					/** Send response **/
					res.render('quality_data',{
						layout 			  	: 	false,
						agent_data		  	: 	asyncResponse?.agent_data || [],
						team_leader_data	: 	asyncResponse?.team_leader_data || [],
						from_date		  	: 	fromDate,
						to_date			  	:	toDate,
						team_leader_id		:	teamLeaderId,
					});
				});
			}else{
				asyncParallel({
					dropdown_list :(callback)=>{
						/** Set conditions */
						let teamConditions =  clone(Constants.ADMIN_USER_COMMON_CONDITIONS);
						teamConditions.team_head = true;
						
						/** Get users dropdown list **/
						getDropdownList(req,res,next,{
							collections : [{
								collection	:	Tables.USERS,
								columns		: 	["_id", "full_name"],
								conditions	: 	teamConditions
							}]
						}).then(response=>{
							callback(null,response?.final_html_data || []);
						}).catch(next);
					},
				},(asyncErr,asyncResponse)=>{
					if(asyncErr) return next(asyncErr);
					
					/** Render view */										
					req.breadcrumbs(BREADCRUMBS['admin/quality_monitor_form/view']);
					res.render('view',{
						team_list :	asyncResponse?.dropdown_list?.["0"] ||'',
					});
				});
			}
		} catch (error) {
			return next(error);
		}
	};//End viewQualityMonitorForm()
}
export default QualityMonitorForm; 
