const asyncParallel	=	require('async/parallel');
const eachOfSeries = require("async/eachOfSeries");
const clone			= require('clone');

function QualityMonitorForm() {
	const QualityCategory = this;

	/**
	 * Function to get quality monitor form list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	this.getQualityMonitorForm = (req,res,next)=>{
		if(isPost(req)){
			convertMultipartFormData(req,res);
			/** Sanitize Data */
			req.body 			=	sanitizeData(req.body,NOT_ALLOWED_TAGS_XSS);
			/** Check validation **/
			req.checkBody({
				"agent_id": {
					notEmpty: true,
					errorMessage: res.__("admin.quality_monitor.please_select_agent_id")
				},
				"team_leader_id": {
					notEmpty: true,
					errorMessage: res.__("admin.quality_monitor.please_enter_team_leader_id")
				},
				"customer_name": {
					notEmpty: true,
					errorMessage: res.__("admin.quality_monitor.please_enter_customer_name")
				},
				"type_of_call": {
					notEmpty: true,
					errorMessage: res.__("admin.quality_monitor.please_enter_type_of_call")
				},
				"type_of_call_enquiry": {
					notEmpty: true,
					errorMessage: res.__("admin.quality_monitor.please_enter_type_of_call_enquiry")
				},
				"date_time": {
					notEmpty: true,
					errorMessage: res.__("admin.quality_monitor.please_enter_date_time")
				},
				"call_date_time": {
					notEmpty: true,
					errorMessage: res.__("admin.quality_monitor.please_enter_call_date_time")
				},
				"monitored_by": {
					notEmpty: true,
					errorMessage: res.__("admin.quality_monitor.please_enter_monitored_by")
				},
				"team": {
					notEmpty: true,
					errorMessage: res.__("admin.quality_monitor.please_enter_team")
				},
				"phone_number": {
					notEmpty: true,
					isNumeric:{
						errorMessage: res.__("admin.quality_monitor.invalid_phone_number")
					},
					isLength:{
						options: MOBILE_NUMBER_LENGTH,
						errorMessage: res.__("admin.quality_monitor.invalid_phone_number")
					},
					errorMessage: res.__("admin.quality_monitor.please_enter_phone_number"),
				},
			});
			/** parse Validation array  **/
			let errors = parseValidation(req.validationErrors(),req);
			
			if(errors) return res.send({status	: STATUS_ERROR,	message	: errors});
			
			let id 					= 	(req.body.id)						?	ObjectId(req.body.id)			:ObjectId();
			let qualityId 			= 	(req.body.quality_id)				?	ObjectId(req.body.quality_id)	:ObjectId();
			let agentId 			= 	(req.body.agent_id)					?	req.body.agent_id:"";
			let teamLeaderId 		= 	(req.body.team_leader_id)			? 	req.body.team_leader_id	:"";
			let customerName		= 	(req.body.customer_name)			? 	req.body.customer_name:"";
			let phoneNumber			= 	(req.body.phone_number)				? 	req.body.phone_number:"";
			let typeOfCall			= 	(req.body.type_of_call)				? 	req.body.type_of_call:"";
			let typeOfCallEnquiry	= 	(req.body.type_of_call_enquiry)		? 	req.body.type_of_call_enquiry:"";
			let dateTime			= 	(req.body.date_time)				? 	req.body.date_time:"";
			let callDateTime		= 	(req.body.call_date_time)			? 	req.body.call_date_time	:"";
			let monitoredBy			= 	(req.body.monitored_by)				? 	req.body.monitored_by:"";
			let team				= 	(req.body.team)						? 	req.body.team :"";
			let typeOfSheet			= 	(req.body.type_of_sheet)			? 	req.body.type_of_sheet:"";
			let overAllPercenatge	= 	(req.body.over_all_percenatge)		? 	req.body.over_all_percenatge	:"";
			let data				= 	(req.body.data)						? 	req.body.data					:"";
			
			const avaya_quality_summary = db.collection("avaya_quality_summary");
			const avaya_quality_details = db.collection("avaya_quality_details");
			
			let summaryData	=	[];
			let detailFirstData	=	[];
			let detailSecondData	=	[];
			if(data.length > 0){
				data.map(datas=>{
					summaryData.push({
						'category_id' : ObjectId(datas.first_level_category_id),
						'number_of_error' : parseInt(datas.totel_error),
						'percentage_of_category' : parseFloat(datas.percentage_of),
						'type' : datas.type
					});
				});
				
				data.map((datas,key)=>{
					datas.first_level_category_id = ObjectId(datas.first_level_category_id);
					datas.totel_error =  parseInt(datas.totel_error);
					datas.percentage_of = parseFloat(datas.percentage_of);
					datas.attribute_detail.map(secondLevel=>{  
						secondLevel.second_level_category_id = ObjectId(secondLevel.second_level_category_id);
						secondLevel.second_level_percentage	 = parseFloat(secondLevel.second_level_percentage);
						secondLevel.cn_percentage			 = parseFloat(secondLevel.cn_percentage);
						secondLevel.third_level_detail.map(secondLevel=>{ 
							secondLevel.third_level_category_id = ObjectId(secondLevel.third_level_category_id);
							secondLevel.third_level_percentage = parseFloat(secondLevel.third_level_percentage);
							secondLevel.comment = secondLevel.comment;
						});
					});
				});
			}
			
			avaya_quality_summary.updateOne({
				_id : id
			},
			{
				$set : {
					agent_id 			: ObjectId(agentId),
					team_leader_id 		: ObjectId(teamLeaderId),
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
			},
			{ upsert : true },(err, result)=>{
				if(err) return next(err);
				avaya_quality_details.updateOne({
					_id 		: qualityId,
					parent_id 	: id
				},
				{
					$set : {
						agent_id 			: ObjectId(agentId),
						team_leader_id 		: ObjectId(teamLeaderId),
						customerName 		: customerName,
						phone_number		: phoneNumber,
						type_of_call		: typeOfCall,
						monitored_by		: ObjectId(monitoredBy),
						team				: team,
						type_of_call_enquiry: typeOfCallEnquiry,
						data 				: data
					}
				},
				{ 	upsert : true },(err, result)=>{
					if(err) return next(err);
					req.flash(STATUS_SUCCESS,res.__('admin.quality_monitor_form.summary_added'));
					res.send({
						status : STATUS_SUCCESS,
						message: res.__('admin.quality_monitor_form.summary_added')
					});
				});
			});
		}else{
			const avaya_quality_categories = db.collection('avaya_quality_categories');
			avaya_quality_categories.find({
				 parent_category_id : parseInt(0) 
			},{projection: {
				_id:1,category_name:1,parent_category_id:1,category_percentage:1,type:1
			}}).toArray((err, result)=>{ 
				if(err) return next(err,[]);
				let categoryIds 	= [];
				result.map(record=>{
					categoryIds.push(record._id);
				});
				asyncParallel({
					category_details: (callback)=>{
						/** Get second categories names */
						avaya_quality_categories.aggregate([
							{ $match : { parent_category_id : {$in : arrayToObject(categoryIds)}}},
							{ $lookup: {	/** Get third category **/
								from 		:	"avaya_quality_categories",
								localField  :	"_id",
								foreignField:	"parent_category_id",
								as 		  	:	"sub_category_details"
							}},
							{ $project : {_id: 1,category_name: 1,parent_category_id:1,sub_category_details:1,is_non_critical:1,category_percentage:1}}
						]).toArray((catErr,catResult)=>{
							if(catErr || catResult.length <= 0) return callback(catErr,[]);
							let categoryList = {};
							result.map((record,key)=>{ 
								if(!categoryList[key]) categoryList[record._id] = {};
								categoryList[record._id].name		=	record.category_name;
								categoryList[record._id].type		=	record.type;
								categoryList[record._id]['data']	=	[];
								catResult.map(list=>{ 
									if(String(record._id) == String(list.parent_category_id)) categoryList[record._id]['data'].push(list);
								});
							});
							callback(null,categoryList);
						});
					},
					dropdown_list :(callback)=>{
						/** Set conditions */
						let teamConditions =  clone(ADMIN_USER_COMMON_CONDITIONS);
						teamConditions.team_head = false;
						teamConditions.parent_id = { $exists: true ,$ne : "" };
						
						let qaTeamConditions =  clone(ADMIN_USER_COMMON_CONDITIONS);
						qaTeamConditions.user_role_id = QA_TEAM;
						
						let options = {
							collections : [{
								collection	:	"users",
								columns		: 	["_id", "full_name"],
								conditions	: 	teamConditions
							},{
								collection	:	"users",
								columns		: 	["_id", "full_name"],
								conditions	: 	qaTeamConditions
							}]
						};
						/** Get users dropdown list **/
						getDropdownList(req,res,next,options).then(response=>{ 
							callback(null,response);
						}).catch(next);
					},
				},(asyncErr,asyncResponse)=>{ 
					if(asyncErr) return next(asyncErr);
					
					let categoryDetail	=	(asyncResponse.category_details) 	?  	asyncResponse.category_details : {};
					let teamList		=	(asyncResponse.dropdown_list && asyncResponse.dropdown_list.final_html_data["0"])	?	asyncResponse.dropdown_list.final_html_data["0"]:'';
					let qaList			=	(asyncResponse.dropdown_list && asyncResponse.dropdown_list.final_html_data["1"])	?	asyncResponse.dropdown_list.final_html_data["1"]:'';
										
					req.breadcrumbs(BREADCRUMBS['admin/quality_monitor_form/list']);
					res.render('list',{
						category_details	:	categoryDetail,
						team_list   		: 	teamList,
						qa_list   			: 	qaList,
					});
				});
			});
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
	this.getQualityMonitorForm1 = (req,res,next)=>{
		if(isPost(req)){
			convertMultipartFormData(req,res);
			/** Sanitize Data */
			req.body 			=	sanitizeData(req.body,NOT_ALLOWED_TAGS_XSS);
			/** Check validation **/
			req.checkBody({
				"agent_id": {
					notEmpty: true,
					errorMessage: res.__("admin.quality_monitor.please_select_agent_id")
				},
				"team_leader_id": {
					notEmpty: true,
					errorMessage: res.__("admin.quality_monitor.please_enter_team_leader_id")
				},
				"customer_name": {
					notEmpty: true,
					errorMessage: res.__("admin.quality_monitor.please_enter_customer_name")
				},
				"type_of_call": {
					notEmpty: true,
					errorMessage: res.__("admin.quality_monitor.please_enter_type_of_call")
				},
				"type_of_call_enquiry": {
					notEmpty: true,
					errorMessage: res.__("admin.quality_monitor.please_enter_type_of_call_enquiry")
				},
				"date_time": {
					notEmpty: true,
					errorMessage: res.__("admin.quality_monitor.please_enter_date_time")
				},
				"call_date_time": {
					notEmpty: true,
					errorMessage: res.__("admin.quality_monitor.please_enter_call_date_time")
				},
				"monitored_by": {
					notEmpty: true,
					errorMessage: res.__("admin.quality_monitor.please_enter_monitored_by")
				},
				"team": {
					notEmpty: true,
					errorMessage: res.__("admin.quality_monitor.please_enter_team")
				},
				"phone_number": {
					notEmpty: true,
					isNumeric:{
						errorMessage: res.__("admin.quality_monitor.invalid_phone_number")
					},
					isLength:{
						options: MOBILE_NUMBER_LENGTH,
						errorMessage: res.__("admin.quality_monitor.invalid_phone_number")
					},
					errorMessage: res.__("admin.quality_monitor.please_enter_phone_number"),
				},
			});
			/** parse Validation array  **/
			let errors = parseValidation(req.validationErrors(),req);
			
			if(errors) return res.send({status	: STATUS_ERROR,	message	: errors});
			
			let id 					= 	(req.body.id)						?	ObjectId(req.body.id)			:ObjectId();
			let qualityId 			= 	(req.body.quality_id)				?	ObjectId(req.body.quality_id)	:ObjectId();
			let agentId 			= 	(req.body.agent_id)					?	req.body.agent_id:"";
			let teamLeaderId 		= 	(req.body.team_leader_id)			? 	req.body.team_leader_id	:"";
			let customerName		= 	(req.body.customer_name)			? 	req.body.customer_name:"";
			let phoneNumber			= 	(req.body.phone_number)				? 	req.body.phone_number:"";
			let typeOfCall			= 	(req.body.type_of_call)				? 	req.body.type_of_call:"";
			let typeOfCallEnquiry	= 	(req.body.type_of_call_enquiry)		? 	req.body.type_of_call_enquiry:"";
			let dateTime			= 	(req.body.date_time)				? 	req.body.date_time:"";
			let callDateTime		= 	(req.body.call_date_time)			? 	req.body.call_date_time	:"";
			let monitoredBy			= 	(req.body.monitored_by)				? 	req.body.monitored_by:"";
			let team				= 	(req.body.team)						? 	req.body.team :"";
			let typeOfSheet			= 	(req.body.type_of_sheet)			? 	req.body.type_of_sheet:"";
			let overAllPercenatge	= 	(req.body.over_all_percenatge)		? 	req.body.over_all_percenatge	:"";
			let data				= 	(req.body.data)						? 	req.body.data					:"";
			
			const avaya_quality_summary = db.collection("avaya_quality_summary1");
			const avaya_quality_details = db.collection("avaya_quality_details1");
			
			let summaryData	=	[];
			let detailFirstData	=	[];
			let detailSecondData	=	[];
			if(data.length > 0){
				data.map(datas=>{
					summaryData.push({
						'category_id' : ObjectId(datas.first_level_category_id),
						'number_of_error' : parseInt(datas.totel_error),
						'percentage_of_category' : parseFloat(datas.percentage_of),
						'type' : datas.type
					});
				});
				
				data.map((datas,key)=>{
					datas.first_level_category_id = ObjectId(datas.first_level_category_id);
					datas.totel_error =  parseInt(datas.totel_error);
					datas.percentage_of = parseFloat(datas.percentage_of);
					datas.attribute_detail.map(secondLevel=>{  
						secondLevel.second_level_category_id = ObjectId(secondLevel.second_level_category_id);
						secondLevel.second_level_percentage	 = parseFloat(secondLevel.second_level_percentage);
						secondLevel.cn_percentage			 = parseFloat(secondLevel.cn_percentage);
						secondLevel.third_level_detail.map(secondLevel=>{ 
							secondLevel.third_level_category_id = ObjectId(secondLevel.third_level_category_id);
							secondLevel.third_level_percentage = parseFloat(secondLevel.third_level_percentage);
							secondLevel.comment = secondLevel.comment;
						});
					});
				});
			}
			
			avaya_quality_summary.updateOne({
				_id : id
			},
			{
				$set : {
					agent_id 			: ObjectId(agentId),
					team_leader_id 		: ObjectId(teamLeaderId),
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
			},
			{ upsert : true },(err, result)=>{
				if(err) return next(err);
				avaya_quality_details.updateOne({
					_id 		: qualityId,
					parent_id 	: id
				},
				{
					$set : {
						agent_id 			: ObjectId(agentId),
						team_leader_id 		: ObjectId(teamLeaderId),
						customerName 		: customerName,
						phone_number		: phoneNumber,
						type_of_call		: typeOfCall,
						monitored_by		: ObjectId(monitoredBy),
						team				: team,
						type_of_call_enquiry: typeOfCallEnquiry,
						data 				: data
					}
				},
				{ 	upsert : true },(err, result)=>{
					if(err) return next(err);
					req.flash(STATUS_SUCCESS,res.__('admin.quality_monitor_form.summary_added'));
					res.send({
						status : STATUS_SUCCESS,
						message: res.__('admin.quality_monitor_form.summary_added')
					});
				});
			});
		}else{
			const avaya_quality_categories = db.collection('avaya_quality_categories1');
			avaya_quality_categories.find({
				 parent_category_id : parseInt(0) 
			},{projection: {
				_id:1,category_name:1,parent_category_id:1,category_percentage:1,type:1
			}}).toArray((err, result)=>{ 
				if(err || result.length <= 0) return next(err,[]);
				let categoryIds 	= [];
				result.map(record=>{
					categoryIds.push(record._id);
				});
				asyncParallel({
					category_details: (callback)=>{
						/** Get second categories names */
						avaya_quality_categories.aggregate([
							{ $match : { parent_category_id : {$in : arrayToObject(categoryIds)}}},
							{ $lookup: {	/** Get third category **/
								from 		:	"avaya_quality_categories1",
								localField  :	"_id",
								foreignField:	"parent_category_id",
								as 		  	:	"sub_category_details"
							}},
							{ $project : {_id: 1,category_name: 1,parent_category_id:1,sub_category_details:1,is_non_critical:1,category_percentage:1}}
						]).toArray((catErr,catResult)=>{
							if(catErr || catResult.length <= 0) return callback(catErr,[]);
							let categoryList = {};
							result.map((record,key)=>{ 
								if(!categoryList[key]) categoryList[record._id] = {};
								categoryList[record._id].name		=	record.category_name;
								categoryList[record._id].type		=	record.type;
								categoryList[record._id]['data']	=	[];
								catResult.map(list=>{ 
									if(String(record._id) == String(list.parent_category_id)) categoryList[record._id]['data'].push(list);
								});
							});
							callback(null,categoryList);
						});
					},
					dropdown_list :(callback)=>{
						/** Set conditions */
						let teamConditions =  clone(ADMIN_USER_COMMON_CONDITIONS);
						teamConditions.team_head = false;
						teamConditions.parent_id = { $exists: true ,$ne : "" };
						
						let qaTeamConditions =  clone(ADMIN_USER_COMMON_CONDITIONS);
						qaTeamConditions.user_role_id = QA_TEAM;
						
						let options = {
							collections : [{
								collection	:	"users",
								columns		: 	["_id", "full_name"],
								conditions	: 	teamConditions
							},{
								collection	:	"users",
								columns		: 	["_id", "full_name"],
								conditions	: 	qaTeamConditions
							}]
						};
						/** Get users dropdown list **/
						getDropdownList(req,res,next,options).then(response=>{ 
							callback(null,response);
						}).catch(next);
					},
				},(asyncErr,asyncResponse)=>{ 
					if(asyncErr) return next(asyncErr);
					
					let categoryDetail	=	(asyncResponse.category_details) 	?  	asyncResponse.category_details : {};
					let teamList		=	(asyncResponse.dropdown_list && asyncResponse.dropdown_list.final_html_data["0"])	?	asyncResponse.dropdown_list.final_html_data["0"]:'';
					let qaList			=	(asyncResponse.dropdown_list && asyncResponse.dropdown_list.final_html_data["1"])	?	asyncResponse.dropdown_list.final_html_data["1"]:'';
										
					req.breadcrumbs(BREADCRUMBS['admin/quality_monitor_form/list']);
					res.render('list1',{
						category_details	:	categoryDetail,
						team_list   		: 	teamList,
						qa_list   			: 	qaList,
					});
				});
			});
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
	this.getUserList = (req,res,next)=>{
		let agentId = req.body.agent_id;
		/** Send error response */
		if(!agentId ) return res.send({status: STATUS_ERROR, message :res.__("admin.system.something_going_wrong_please_try_again") });
		const users	=	db.collection('users');
		users.findOne({
			_id : ObjectId(agentId)
		},
		{projection : {parent_id : 1 }},(err,result)=>{
			if(err || !result) return next(err,{});
			let parentId	=	(result.parent_id) ? result.parent_id : '';
        	/** Set options **/
			let options = {
				collections :[
					{
					   collection 	: 	"users",
						columns    	:	["_id", "full_name"],
						conditions 	: {
							_id 	: ObjectId(parentId),
							active 	: ACTIVE,
							team_head : true
						},
					},
				]
			}
			/**Get branch list **/
			getDropdownList(req,res, next,options).then(dropDownResponse=> { 
				if(dropDownResponse.status != STATUS_SUCCESS) return res.send({status: STATUS_ERROR, message :res.__("admin.system.something_going_wrong_please_try_again") });
				res.send({
					status       : STATUS_SUCCESS,
					user_list  : dropDownResponse.final_html_data["0"]
				});
			}).catch(next);
		});
	};//End getUserList()
	
	/**
	 * Function to get quality monitor view
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	this.viewQualityMonitorForm = (req,res,next)=>{
		if(isPost(req)){ 
			let fromDate 		= (req.body.from_date) 	 	? req.body.from_date 				: "";
			let toDate 			= (req.body.to_date) 	 	? req.body.to_date 					: "";
			let teamLeaderId 	= (req.body.team_leader_id) ? req.body.team_leader_id 			: "";
			const collection	= db.collection("avaya_quality_summary");
			
			let commonConditions	=	{};

			if (fromDate != "" && toDate != "") {
				commonConditions["date_time"] = {
					$gte 	: newDate(fromDate),
					$lte 	: newDate(toDate),
				}
			}
			
			if(teamLeaderId) commonConditions['team_leader_id'] = ObjectId(teamLeaderId);
			logger(commonConditions);
			asyncParallel({
				agent_data :(callback)=>{
					/** Get list of avaya quanilty's **/
					collection.aggregate([
						{$match : commonConditions},
						{$lookup: {	/** Get agent details **/
							"from" 		  :	"users",
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
					]).toArray((err, result)=>{    logger(result);
						callback(err, result);
					});
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
					]).toArray((err, allResult)=>{  
						callback(err, allResult);
					});
				},
			},(err,response)=>{  
				if(err){
					/** send error response */
					return res.send({
						status	: STATUS_ERROR,
						message	: res.__("admin.system.invalid_access")
					});
				}
				/** Send response **/
				res.render('quality_data',{
					layout 			  	: 	false,
					agent_data		  	: 	response.agent_data,
					team_leader_data	: 	response.team_leader_data,
					from_date		  	: 	fromDate,
					to_date			  	:	toDate,
					team_leader_id		:	teamLeaderId,
				});
			});
		}else{
			asyncParallel({
				dropdown_list :(callback)=>{
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
						let dropDownHtml = (response.final_html_data) ? response.final_html_data :[];

						callback(null,dropDownHtml);
					}).catch(next);
				},
			},(asyncErr,asyncResponse)=>{
				if(asyncErr) return next(asyncErr);
				
				let teamList		=	(asyncResponse.dropdown_list["0"])	?	asyncResponse.dropdown_list["0"]:'';
									
				req.breadcrumbs(BREADCRUMBS['admin/quality_monitor_form/view']);
				res.render('view',{
					team_list   		: 	teamList,
				});
			});
		}
	};//End viewQualityMonitorForm()
}
module.exports = new QualityMonitorForm();
