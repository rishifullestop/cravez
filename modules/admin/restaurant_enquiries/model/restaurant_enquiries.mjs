import { ObjectId } from 'mongodb';
import { parallel as asyncParallel } from 'async';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import * as Helper from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { sendMailToUsers, saveUserActivity, insertNotifications} from "../../../../services/index.mjs";

export default class Enquiry {

	constructor(db) {
		this.db = db;
		this.collectionDb = db.collection(Tables.RESTAURANT_ENQUIRIES);
	}

	/**
	 * Function to get enquiry list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getEnquiryList (req,res,next){
		let userRoleId	= req?.session?.user?.user_role_id || "";
		if(Helper.isPost(req)){
			let limit		= (req?.body?.length) 	?	parseInt(req?.body?.length)	:Constants.ADMIN_LISTING_LIMIT;
			let skip		= (req?.body?.start)  	? 	parseInt(req?.body?.start)  :Constants.DEFAULT_SKIP;
			let fromDate 	= req?.body?.fromDate || "";
			let toDate		= req?.body?.toDate || "";
			let status		= req?.body?.status || "";
			let isContentTeam= (userRoleId == Constants.CONTENT_TEAM) ? true :false;

			/** Configure Datatable conditions*/
			const dataTableConfig = await Helper.configDatatable(req, res, null);

			/** Set conditions **/
			let commonConditions = {is_deleted: Constants.NOT_DELETED};

			/** Set conditions according to the user role id **/
			if(isContentTeam) commonConditions.team_approval_status = Constants.APPROVED;

			if (fromDate != "" && toDate != "") {
				dataTableConfig.conditions["created"] = {$gte : Helper.newDate(fromDate), $lte : Helper.newDate(toDate)};
			}

			/** Set conditions for status **/
			if (status) {
				if(!isContentTeam && userRoleId != Constants.CRAVEZ && (status == Constants.APPROVED || status == Constants.PENDING)){
					if(status == Constants.APPROVED){
						dataTableConfig.conditions["$or"] = [
							{approval_status	 : 	Constants.APPROVED },
							{team_approval_status:	Constants.APPROVED}
						];
					}else{
						dataTableConfig.conditions["team_approval_status"] = parseInt(status);
					}
				}else{
					dataTableConfig.conditions["approval_status"] = parseInt(status);
				}
			}

			dataTableConfig.conditions = Object.assign(dataTableConfig.conditions,commonConditions);

			// Get list or count of restaurant enquiries
			let dbRes = await this.collectionDb.aggregate([
				{ $match: dataTableConfig.conditions },
				{$facet : {
					list : [
						{$sort: dataTableConfig.sort_conditions },
						{$skip: skip },
						{$limit: limit },
						{$project: {
							_id:1,name:1,mobile_number:1,email:1,approval_status:1,restaurant_description:1,file:1,team_approval_status:1,restaurant_id:1
						}}
					],
					count: [
						{$count: "count"},
					],
				}}
			]).toArray();

			/** Send response **/
			res.send({
				status: Constants.STATUS_SUCCESS,
				draw: dataTableConfig.result_draw,
				data			:   dbRes?.[0]?.list ||[],
				recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
				recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
			});
		}else{
			/** render restaurant enquiry  listing page **/
			let searchStatus = (req.query && req.query.status) ? req.query.status : "";
			req.breadcrumbs(BREADCRUMBS['admin/restaurant_enquiries']);
			res.render('list',{search_status: searchStatus});
		}
	}//End getEnquiryList()

	/**
	 * Function to approve restaurant enquiry request
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async approveEnquiry (req,res,next){
		let enquiryId 		= (req.params.id)			 ?	new ObjectId(req.params.id)			:"";
		let restaurantId	= (req.params.restaurant_id) ?	req.params.restaurant_id			:"";
		let actionType 		= (req.params.action_type)   ?  req.params.action_type				:"";
		let userRoleId		= (req.session.user.user_role_id) ? req.session.user.user_role_id   :"";
		let isContentTeam	= (userRoleId == Constants.CONTENT_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;
		let isFinanceTeam	= (userRoleId == Constants.FINANCE_TEAM || userRoleId == Constants.CRAVEZ) ? true :false;

		if(Helper.isPost(req)){
			/** Sanitize Data **/
			req.body 					=	Helper.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let causedByArray 			=	req.body.caused_by 						?	req.body.caused_by 						:[];
			let deliveryVehicleType		=	(req.body.delivery_vehicle_type) 	  	?	req.body.delivery_vehicle_type			:"";
			let autoAssignmentStartAfter=	(req.body.auto_assignment_start_after) 	?	req.body.auto_assignment_start_after	:"";
			let bankId		=	(req.body.bank_id)		?	new ObjectId(req.body.bank_id)	:"";
			let mobileNumber=	(req.body.phone_number)	?	req.body.phone_number		:"";
			let email 		=	(req.body.email)		?	req.body.email				:"";
			let accountManagerName		=	(req.body.account_manager_name)			?	req.body.account_manager_name		:"";
			let restaurantNameInEnglish	=	(req.body.restaurant_name_in_english)	?	req.body.restaurant_name_in_english	:"";
			let errors = [];

			if(isFinanceTeam){
				/** Check commission type range validation */
				if(req.body.delivery_by){
					if(req.body.delivery_by.constructor !== Array) req.body.delivery_by = [req.body.delivery_by];
					req.body.delivery_by.map(deliveryBy=>{
						if(deliveryBy == Constants.DELIVERY_BY_CRAVEZ){
							if(req.body.commission_type){
								req.body.provided_services.map((records,index)=>{
									if(records){
										let rangeCorrect = true;
										if(req.body.commission_type == Constants.COMMISSION_FIXED || req.body.commission_type == Constants.COMMISSION_VARIABLE){
											if(!records.commission){
												errors.push({param: "provided_services_commission_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_commission")});
											}else if(isNaN(records.commission) || records.commission < 0 || records.commission>100){
												errors.push({param: "provided_services_commission_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_valid_commission")});
											}
										}
										if(req.body.commission_type == Constants.COMMISSION_VARIABLE){
											if(!records.to){
												rangeCorrect = false;
												errors.push({param: "provided_services_to_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_amount_to")});
											}else if(isNaN(records.to) || records.to < 0){
												rangeCorrect = false;
												errors.push({param: "provided_services_to_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_valid_amount_to")});
											}

											if(!records.from){
												rangeCorrect = false;
												errors.push({param: "provided_services_from_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_amount_from")});
											}else if(isNaN(records.from) || records.from < 0){
												rangeCorrect = false;
												errors.push({param: "provided_services_from_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_valid_amount_from")});
											}
											if(rangeCorrect){
												if(parseFloat(records.from) >= parseFloat(records.to)){
													errors.push({param: "provided_services_to_"+index, msg: res.__("admin.restaurant_enquiry.amount_to_greater_than_amount_from")});
												}
											}
										}
										if(req.body.commission_type == Constants.COMMISSION_FIXED_AMOUNT){
											if(!records.amount){
												errors.push({param: "provided_services_amount_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_amount")});
											}else if(isNaN(records.amount) || records.amount <= 0){
												errors.push({param: "provided_services_amount_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_valid_amount")});
											}
										}
									}
								});
							}
						}
						if(deliveryBy == Constants.DELIVERY_BY_RESTAURANT){
							/** Check restaurant commission type range validation */
							if(req.body.restaurant_commission_type){
								req.body.restaurant_provided_services.map((records,index)=>{
									if(records){
										let rangeCorrect = true;
										if(req.body.restaurant_commission_type == Constants.COMMISSION_FIXED || req.body.restaurant_commission_type == Constants.COMMISSION_VARIABLE){
											if(!records.commission){
												errors.push({param: "restaurant_provided_services_commission_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_commission")});
											}else if(isNaN(records.commission) || records.commission < 0 || records.commission>100){
												errors.push({param: "restaurant_provided_services_commission_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_valid_commission")});
											}
										}
										if(req.body.restaurant_commission_type == Constants.COMMISSION_VARIABLE){
											if(!records.to){
												rangeCorrect = false;
												errors.push({param: "restaurant_provided_services_to_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_amount_to")});
											}else if(isNaN(records.to) || records.to < 0){
												rangeCorrect = false;
												errors.push({param: "restaurant_provided_services_to_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_valid_amount_to")});
											}

											if(!records.from){
												rangeCorrect = false;
												errors.push({param: "restaurant_provided_services_from_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_amount_from")});
											}else if(isNaN(records.from) || records.from < 0){
												rangeCorrect = false;
												errors.push({param: "restaurant_provided_services_from_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_valid_amount_from")});
											}
											if(rangeCorrect){
												if(parseFloat(records.from) >= parseFloat(records.to)){
													errors.push({param: "restaurant_provided_services_to_"+index, msg: res.__("admin.restaurant_enquiry.amount_to_greater_than_amount_from")});
												}
											}
										}
										if(req.body.restaurant_commission_type == Constants.COMMISSION_FIXED_AMOUNT){
											if(!records.amount){
												errors.push({param: "restaurant_provided_services_amount_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_amount")});
											}else if(isNaN(records.amount) || records.amount <= 0){
												errors.push({param: "restaurant_provided_services_amount_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_valid_amount")});
											}
										}
									}
								});
							}
						}
					});
				}

				/** Check pickup commission type range validation */
				if(req.body.pickup_enable){
					if(req.body.pickup_commission_type){
						req.body.pickup_provided_services.map((records,index)=>{
							if(records){
								let rangeCorrect = true;
								if(req.body.pickup_commission_type == Constants.COMMISSION_FIXED || req.body.pickup_commission_type == Constants.COMMISSION_VARIABLE){
									if(!records.commission){
										errors.push({param: "pickup_provided_services_commission_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_commission")});
									}else if(isNaN(records.commission) || records.commission < 0 || records.commission>100){
										errors.push({param: "pickup_provided_services_commission_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_valid_commission")});
									}
								}
								if(req.body.pickup_commission_type == Constants.COMMISSION_VARIABLE){
									if(!records.to){
										rangeCorrect = false;
										errors.push({param: "pickup_provided_services_to_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_amount_to")});
									}else if(isNaN(records.to) || records.to < 0){
										rangeCorrect = false;
										errors.push({param: "pickup_provided_services_to_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_valid_amount_to")});
									}

									if(!records.from){
										rangeCorrect = false;
										errors.push({param: "pickup_provided_services_from_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_amount_from")});
									}else if(isNaN(records.from) || records.from < 0){
										rangeCorrect = false;
										errors.push({param: "pickup_provided_services_from_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_valid_amount_from")});
									}
									if(rangeCorrect){
										if(parseFloat(records.from) >= parseFloat(records.to)){
											errors.push({param: "pickup_provided_services_to_"+index, msg: res.__("admin.restaurant_enquiry.amount_to_greater_than_amount_from")});
										}
									}
								}
								if(req.body.pickup_commission_type == Constants.COMMISSION_FIXED_AMOUNT){
									if(!records.amount){
										errors.push({param: "pickup_provided_services_amount_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_amount")});
									}else if(isNaN(records.amount) || records.amount <= 0){
										errors.push({param: "pickup_provided_services_amount_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_valid_amount")});
									}
								}
							}
						});
					}
				}

				/** Check payment methods validation */
				let anyPaymentMethodSelect = false;
				if(req.body.payment_methods) req?.body?.payment_methods.map((records,index)=>{
					if(records.values && records.values.length > 0){
						if(records.method){
							anyPaymentMethodSelect = true;
							records.values.map((data,keyIndex)=>{
								if(data.index){
									let rangeCorrect = true;
									if(records.payment_commission_type == Constants.COMMISSION_FIXED || records.payment_commission_type == Constants.COMMISSION_VARIABLE){
										if(!data.commission){
											errors.push({param: "payment_methods_commission_"+index+'_values_'+keyIndex, msg: res.__("admin.restaurant_enquiry.please_enter_commission")});
										}else if(isNaN(data.commission) || data.commission < 0 || data.commission>100){
											errors.push({param: "payment_methods_commission_"+index+'_values_'+keyIndex, msg: res.__("admin.restaurant_enquiry.please_enter_valid_commission")});
										}
									}
									if(records.payment_commission_type == Constants.COMMISSION_VARIABLE){
										if(!data.to){
											rangeCorrect = false;
											errors.push({param: "payment_methods_to_"+index+'_values_'+keyIndex, msg: res.__("admin.restaurant_enquiry.please_enter_amount_to")});
										}else if(isNaN(data.to) || data.to < 0){
											rangeCorrect = false;
											errors.push({param: "payment_methods_to_"+index+'_values_'+keyIndex, msg: res.__("admin.restaurant_enquiry.please_enter_valid_amount_to")});
										}

										if(!data.from){
											rangeCorrect = false;
											errors.push({param: "payment_methods_from_"+index+'_values_'+keyIndex, msg: res.__("admin.restaurant_enquiry.please_enter_amount_from")});
										}else if(isNaN(data.from) || data.from < 0){
											rangeCorrect = false;
											errors.push({param: "payment_methods_from_"+index+'_values_'+keyIndex, msg: res.__("admin.restaurant_enquiry.please_enter_valid_amount_from")});
										}
										if(rangeCorrect){
											if(parseFloat(data.from) >= parseFloat(data.to)){
												errors.push({param: "payment_methods_to_"+index+'_values_'+keyIndex, msg: res.__("admin.restaurant_enquiry.amount_to_greater_than_amount_from")});
											}
										}
									}
									if(records.payment_commission_type == Constants.COMMISSION_FIXED_AMOUNT){
										if(!data.amount){
											errors.push({param: "payment_methods_amount_"+index+'_values_'+keyIndex, msg: res.__("admin.restaurant_enquiry.please_enter_amount")});
										}else if(isNaN(data.amount) || data.amount <= 0){
											errors.push({param: "payment_methods_amount_"+index+'_values_'+keyIndex, msg: res.__("admin.restaurant_enquiry.please_enter_valid_amount")});
										}
									}
								}
							});
						}
					}
				});
				if(!anyPaymentMethodSelect) errors.push({param: "payment_methods", msg: res.__("admin.restaurant_enquiry.please_select_at_least_one_payment_method")});
			}

			if(isContentTeam || isFinanceTeam){
				/** Check compensation  validation */
				let anyCompensationSelect = false;
				causedByArray.map((records,index)=>{
					if(records.cause){
						anyCompensationSelect = true;
						if(records.percentage && (isNaN(records.percentage) || records.percentage < 0 || records.percentage > 100)){
							errors.push({param: "caused_by_percentage_"+index, msg: res.__("admin.restaurant_enquiry.please_enter_valid_caused_by_whom_percentage")});
						}
					}
				});
				if(!anyCompensationSelect) errors.push({param: "caused_by", msg: res.__("admin.restaurant_enquiry.please_select_at_least_one_caused_by_whom")});
			}

			/** Send errors response  */
			if(errors?.length >0) return res.send({status: Constants.STATUS_ERROR, message: errors});


			let enquryDetails = null;
			if(enquiryId){
				/** Get restaurant enquiries details */
				enquryDetails = await this.collectionDb.findOne({
					_id 			:	new ObjectId(enquiryId),
					is_deleted		:	Constants.NOT_DELETED,
				},{projection:{_id:1,name:1,restaurant_description:1,phone_country_code:1, landing_image:1, restaurant_logo:1, detail_image: 1, added_by:1, restaurant_id: 1}});

				if(!restaurantId && enquryDetails?.restaurant_id) restaurantId = enquryDetails?.restaurant_id;
			}

			/** Set user conditions */
			let uniqueConditions = {
				is_deleted	: 	Constants.NOT_DELETED,
				$or			:	[
					{email : {$regex : '^'+email+'$',$options : 'i'}},
					{mobile_number : mobileNumber}
				]
			}

			if(restaurantId) uniqueConditions.restaurant_id = {$ne: new ObjectId(restaurantId)};

			const users	= this.db.collection(Tables.USERS);
			asyncParallel({
				upload_file_details : (callback)=>{
					/** upload restaurant logo **/
					Helper.moveUploadedFile(req, res, {
						image	: req?.files?.logo || "",
						oldPath	: req?.body?.old_logo || "",
						filePath: Constants.RESTAURANT_FILE_PATH,
						ignore_unlink : true
					}).then(imageResponse=>{
						callback(null,imageResponse);
					}).catch(next);
				},
				image_upload : (callback)=>{
					/** upload image **/
					Helper.moveUploadedFile(req, res, {
						image	: req?.files?.landing_image || "",
						oldPath	: req?.body?.old_landing_image || "",
						filePath: Constants.RESTAURANT_FILE_PATH,
						ignore_unlink : true
					}).then(imageResponse=>{
						callback(null,imageResponse);
					}).catch(next);
				},
				upload_detail_image : (callback)=>{
					/** upload image **/
					Helper.moveUploadedFile(req, res, {
						image	: req?.files?.detail_image || "",
						oldPath	: req?.body?.old_detail_image || "",
						filePath: Constants.RESTAURANT_FILE_PATH,
						ignore_unlink : true
					}).then(imageResponse=>{
						callback(null,imageResponse);
					}).catch(next);
				},
				upload_web_image : (callback)=>{
					/** upload image **/
					Helper.moveUploadedFile(req, res, {
						image	: req?.files?.web_image || "",
						oldPath	: req?.body?.old_web_image || "",
						filePath: Constants.RESTAURANT_FILE_PATH,
						ignore_unlink : true
					}).then(imageResponse=>{
						callback(null,imageResponse);
					}).catch(next);
				},
				restaurant_enqury_details : (callback)=>{
					if(!enquiryId || !enquryDetails?._id) return callback(null,null);

					asyncParallel({
						upload_restaurant_logo : (childCallback)=>{
							if(!enquryDetails.restaurant_logo || (req.files && req.files.logo)){
								return childCallback(null,null);
							}

							/** Copy restaurant logo **/
							Helper.copyFileFromSource(req, res, next, {
								source_path 		: 	Constants.RESTAURANT_ONBOARDING_FILE_PATH,
								source_file_name	: 	enquryDetails.restaurant_logo,
								destination_path 	:	Constants.RESTAURANT_FILE_PATH,
							}).then(response=>{
								if(response.status == Constants.STATUS_SUCCESS){
									enquryDetails.enquiry_restaurant_logo = response.file_name;
								}
								childCallback(null);
							});
						},
						upload_landing_image : (childCallback)=>{
							if(!enquryDetails.landing_image || (req.files && req.files.landing_image)){
								return childCallback(null);
							}

							/** Copy restaurant landing image **/
							Helper.copyFileFromSource(req, res, next, {
								source_path 		: 	Constants.RESTAURANT_ONBOARDING_FILE_PATH,
								source_file_name	: 	enquryDetails.landing_image,
								destination_path 	:	Constants.RESTAURANT_FILE_PATH,
							}).then(response=>{
								if(response.status == Constants.STATUS_SUCCESS){
									enquryDetails.enquiry_landing_image = response.file_name;
								}
								childCallback(null);
							});
						},
						upload_detail_image : (childCallback)=>{
							if(!enquryDetails.detail_image || (req.files && req.files.detail_image)){
								return childCallback(null);
							}

							/** Copy restaurant details image **/
							Helper.copyFileFromSource(req, res, next, {
								source_path 		: 	Constants.RESTAURANT_ONBOARDING_FILE_PATH,
								source_file_name	: 	enquryDetails.detail_image,
								destination_path 	:	Constants.RESTAURANT_FILE_PATH,
							}).then(response=>{
								if(response.status == Constants.STATUS_SUCCESS){
									enquryDetails.enquiry_detail_image = response.file_name;
								}
								childCallback(null);
							});
						},
						upload_web_image : (childCallback)=>{
							if(!enquryDetails.web_image || (req.files && req.files.web_image)){
								return childCallback(null);
							}

							/** Copy restaurant details image **/
							Helper.copyFileFromSource(req, res, next, {
								source_path 		: 	Constants.RESTAURANT_ONBOARDING_FILE_PATH,
								source_file_name	: 	enquryDetails.web_image,
								destination_path 	:	Constants.RESTAURANT_FILE_PATH,
							}).then(response=>{
								if(response.status == Constants.STATUS_SUCCESS){
									enquryDetails.web_image = response.file_name;
								}
								childCallback(null);
							});
						},
					},()=>{
						callback(null,enquryDetails);
					});
				},
				slug_details : (callback)=>{
					if(!enquiryId) return callback(null,null);

					/** Get slug **/
					Helper.getDatabaseSlug({title: accountManagerName, table_name: Tables.USERS, slug_field: "slug"}).then(slugResponse=>{
						callback(null,slugResponse);
					}).catch(next);
				},
				restaurant_slug : (callback)=>{
					if(!enquiryId) return callback(null,null);

					/** Get slug **/
					Helper.getDatabaseSlug({title: restaurantNameInEnglish, table_name: Tables.RESTAURANTS, slug_field: "slug"}).then(slugResponse=>{
						callback(null,slugResponse.title);
					}).catch(next);
				},
				random_pass : (callback)=>{
					if((!enquiryId && !actionType)) return callback(null,{});

					/** generate a random string for password*/
					let randomResponse = Helper.getRandomString(req,res,{srting_lengsth :Constants.PASSWORD_MIN_LENGTH});
					let password 		= (randomResponse.result)	?	randomResponse.result	:"";
					let bcryptPassword	= Helper.generateMD5Hash(password);
					callback(null,{bcrypt_password: bcryptPassword, password:password});
				},
				unique_restaurant_id : (callback)=>{
					if(!enquiryId) return callback(null,null);

					/** Get unique id **/
					Helper.getUniqueId(req,res,next,{type:Tables.RESTAURANTS}).then(response=>{
						if(response.status !== Constants.STATUS_SUCCESS) return callback(response.message,null);
						callback(null,response.result);
					}).catch(next);
				},
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				let randomPass 			= 	(asyncResponse.random_pass)			?	asyncResponse.random_pass			:{};
				let slugDetails 		= 	(asyncResponse.slug_details)		?	asyncResponse.slug_details			:"";
				let uploadFileDetails	=	(asyncResponse.upload_file_details)	?	asyncResponse.upload_file_details	:"";
				let imageFileName		=	(uploadFileDetails.fileName)		?	uploadFileDetails.fileName			:"";
				let password			=	(randomPass.password)				?	randomPass.password					:"";
				let bcryptPassword		=	(randomPass.bcrypt_password)		?	randomPass.bcrypt_password			:"";
				let authUserId			=	(req.session.user) 					? 	req.session.user._id				:"";
				let restaurantSlug 		= 	(asyncResponse.restaurant_slug) 	?	asyncResponse.restaurant_slug		:"";
				let enquryDetails 		= 	(asyncResponse.restaurant_enqury_details) ?	asyncResponse.restaurant_enqury_details :"";
				let imageUpload			=	(asyncResponse.image_upload)		?	asyncResponse.image_upload	:{};
				let detailImageUpload	=	(asyncResponse.upload_detail_image)	?	asyncResponse.upload_detail_image :{};
				let detailWebImageUpload=	(asyncResponse.upload_web_image)	?	asyncResponse.upload_web_image :{};

				/** If logo extension error **/
				if (uploadFileDetails.status == Constants.STATUS_ERROR) {
					errors.push({ 'param': 'logo', 'msg': uploadFileDetails.message });
				}

				/** If landing image extension error **/
				if (imageUpload.status == Constants.STATUS_ERROR) {
					errors.push({ 'param': 'landing_image', 'msg': imageUpload.message });
				}

				/** If detail image extension error **/
				if (detailImageUpload.status == Constants.STATUS_ERROR) {
					errors.push({ 'param': 'detail_image', 'msg': detailImageUpload.message });
				}

				/** If web image extension error **/
				if (detailWebImageUpload.status == Constants.STATUS_ERROR) {
					errors.push({ 'param': 'web_image', 'msg': detailWebImageUpload.message });
				}

				/** Send error response **/
				if(errors?.length >0) return res.send({status: Constants.STATUS_ERROR,message:errors});

				asyncParallel({
					create_supplier : (parentCallback)=>{
						if(!req.body.settlement_methods || req.body.settlement_methods.indexOf(Constants.TRANSFER_SETTLEMENT_METHOD) < 0) return parentCallback(null,null);

						/** create supplier on payment gateway */
						Helper.createSupplierOnMyFatoorah(req,res,next,{
							restaurant_name	:	{en: req.body.restaurant_name_in_english , ar: req.body.restaurant_name_in_arabic},
							email			:	req.body.email,
							mobile			:	req.body.phone_number,
							beneficiary		:	req.body.beneficiary,
							bank_account	:	req.body.bank_account,
							settlement_type	:	req.body.settlement_type,
							iban			:	req.body.iban,
							restaurant_id	:	restaurantId,
							bank_id			:	bankId,
						}).then(supplierResponse=>{
							parentCallback(null,supplierResponse);
						}).catch(next);
					}
				},(asyncParentErr, asyncParentResponse)=>{
					if(asyncParentErr) return next(asyncParentErr);

					/** Send error response */
					if(asyncParentResponse.create_supplier && asyncParentResponse.create_supplier.status !=  Constants.STATUS_SUCCESS){
						return res.send(asyncParentResponse.create_supplier);
					}

					let supplierResponse		=	(asyncParentResponse.create_supplier) 	? asyncParentResponse.create_supplier 	: {};
					let supplierCode			=	(supplierResponse.supplier_code)		?	supplierResponse.supplier_code		:"";
					let supplierCodeResponse	=	(supplierResponse.supplier_code_response)?	supplierResponse.supplier_code_response	:"";

					restaurantId = (restaurantId) ? new ObjectId(restaurantId) :new ObjectId();
					asyncParallel({
						restaurant_save_details : (callback)=>{
							/** Set restaurant update Data */
							let updateData = {
								$set :{
									name		:	{en: req.body.restaurant_name_in_english , ar: req.body.restaurant_name_in_arabic},
									default_name:	req.body.restaurant_name_in_english,
									address		:	req.body.address,
									thermal_layout_format: req.body.thermal_layout_format,
									delivery_vehicle_type		  : (deliveryVehicleType) 		? 	deliveryVehicleType 				 :[],
									auto_assignment_start_after	  : (autoAssignmentStartAfter) 	?	parseFloat(autoAssignmentStartAfter) :"",
									modified 	: 	Helper.getUtcDate()
								},
								$setOnInsert: {
									open		:	false,
									is_deleted 	: 	Constants.NOT_DELETED,
									status		:	Constants.ACTIVE,
									restaurant_number: 	(asyncResponse.unique_restaurant_id) ? asyncResponse.unique_restaurant_id : "",
									created		:	Helper.getUtcDate(),
								}
							}

							if(supplierCode) 		 updateData["$set"].supplier_code = supplierCode;
							if(supplierCodeResponse) updateData["$set"].supplier_code_response = supplierCodeResponse;

							if(imageFileName) updateData["$set"].image = imageFileName;
							if(enquryDetails){
								updateData["$set"].description	=	(enquryDetails.restaurant_description)	?	enquryDetails.restaurant_description	:"";
								updateData["$set"].added_by 	= 	(enquryDetails.added_by) ? new ObjectId(enquryDetails.added_by)	:"";
							}

							if(restaurantSlug) updateData["$setOnInsert"].slug = restaurantSlug;

							if(imageUpload.fileName) updateData["$set"].landing_image = imageUpload.fileName;
							if(detailImageUpload.fileName) updateData["$set"].detail_image = detailImageUpload.fileName;
							if(detailWebImageUpload.fileName) updateData["$set"].web_image = detailWebImageUpload.fileName;

							if(enquryDetails){
								if(enquryDetails.enquiry_restaurant_logo){
									updateData["$set"].image = enquryDetails.enquiry_restaurant_logo;
								}
								if(enquryDetails.enquiry_landing_image){
									updateData["$set"].landing_image = enquryDetails.enquiry_landing_image;
								}
								if(enquryDetails.enquiry_detail_image){
									updateData["$set"].detail_image = enquryDetails.enquiry_detail_image;
								}
								if(enquryDetails.enquiry_web_image){
									updateData["$set"].web_image = enquryDetails.enquiry_web_image;
								}
							}

							/** Save restaurant details */
							const restaurants =	this.db.collection(Tables.RESTAURANTS);
							restaurants.updateOne({_id : restaurantId },updateData,{upsert: true}).then(() =>{
								callback(null);
							}).catch(next);
						},
						user_save_details : (callback)=>{
							/** User update data */
							let userUpdateData = {
								$set :{
									full_name 	:	accountManagerName,
									modified	:	Helper.getUtcDate(),
									email 		:	email,
									mobile_number:	req.body.phone_number,
								},
								$setOnInsert: {
									active : Constants.ACTIVE,
									is_verified : Constants.VERIFIED,
									is_deleted : Constants.NOT_DELETED,
									created : Helper.getUtcDate(),
								}
							};

							if(bcryptPassword) userUpdateData["$set"].password 	= bcryptPassword;
							if(slugDetails && slugDetails.title) userUpdateData["$setOnInsert"].slug = slugDetails.title;

							if(enquryDetails){
								userUpdateData["$setOnInsert"].phone_country_code = (enquryDetails.phone_country_code)?	enquryDetails.phone_country_code:"";
							}

							/** Save users details **/
							users.updateOne({
								restaurant_id 	:	restaurantId,
								user_role_id	:	Constants.RESTAURANT,
								user_type		:	Constants.USER_TYPE_RESTAURANT,
							},userUpdateData,{upsert: true}).then(() =>{
								callback(null);
							}).catch(next);
						},
						restaurant_save_subdetails : (callback)=>{
							let commissionValue 			= 	[];
							let commissionType				=	'';
							let paymentCommissionValue 		= 	[];
							let restaurantCommissionValue 	= 	[];
							let restaurantCommissionType  	=	'';
							let pickupCommissionValue 	  	=	[];
							let pickupCommissionType	  	=	'';

							if(isFinanceTeam){
								if(req.body.delivery_by.constructor !== Array)			req.body.delivery_by = [req.body.delivery_by];
								if(req.body.settlement_methods.constructor !== Array)	req.body.settlement_methods = [req.body.settlement_methods];

								/** Set commission value */
								commissionValue = 	[];
								commissionType	=	(req.body.commission_type)	?	req.body.commission_type :"";
								req.body.provided_services.map(records=>{
									if(records){
										let tempObject = {};
										if(commissionType == Constants.COMMISSION_FIXED || commissionType == Constants.COMMISSION_VARIABLE){
											tempObject.commission = (records.commission)	?	parseFloat(records.commission) :0;
										}

										if(commissionType == Constants.COMMISSION_VARIABLE){
											tempObject.from = (records.from)	?	parseFloat(records.from)	:0;
											tempObject.to 	= (records.to)		?	parseFloat(records.to)		:0;
										}

										if(commissionType == Constants.COMMISSION_FIXED_AMOUNT){
											tempObject.amount = (records.amount)	?	parseFloat(records.amount)	:0;
										}

										commissionValue.push(tempObject);
									}
								});

								/** Set restaurant commission value */
								restaurantCommissionValue = [];
								restaurantCommissionType  =	(req.body.restaurant_commission_type)	?	req.body.restaurant_commission_type :"";
								req.body.restaurant_provided_services.map(records=>{
									if(records){
										let tempObject = {};

										if(restaurantCommissionType == Constants.COMMISSION_FIXED || restaurantCommissionType == Constants.COMMISSION_VARIABLE){
											tempObject.commission = (records.commission)	?	parseFloat(records.commission) :0;
										}

										if(restaurantCommissionType == Constants.COMMISSION_VARIABLE){
											tempObject.from = (records.from)	?	parseFloat(records.from)	:0;
											tempObject.to 	= (records.to)		?	parseFloat(records.to)		:0;
										}

										if(restaurantCommissionType == Constants.COMMISSION_FIXED_AMOUNT){
											tempObject.amount = (records.amount)	?	parseFloat(records.amount)	:0;
										}

										restaurantCommissionValue.push(tempObject);
									}
								});

								/** Set pickup commission value */
								pickupCommissionValue = [];
								pickupCommissionType  =	(req.body.pickup_commission_type)	?	req.body.pickup_commission_type :"";
								req.body.pickup_provided_services.map(records=>{
									if(records){
										let tempObject = {};

										if(pickupCommissionType == Constants.COMMISSION_FIXED || pickupCommissionType == Constants.COMMISSION_VARIABLE){
											tempObject.commission = (records.commission)	?	parseFloat(records.commission) :0;
										}

										if(pickupCommissionType == Constants.COMMISSION_VARIABLE){
											tempObject.from = (records.from)	?	parseFloat(records.from)	:0;
											tempObject.to 	= (records.to)		?	parseFloat(records.to)		:0;
										}

										if(pickupCommissionType == Constants.COMMISSION_FIXED_AMOUNT){
											tempObject.amount = (records.amount)	?	parseFloat(records.amount)	:0;
										}

										pickupCommissionValue.push(tempObject);
									}
								});

								/** Set payment commission value */
								paymentCommissionValue = [];
								req.body.payment_methods.map((records,key)=>{
									if(records.method){
										let tempObject	=	{};
										let paymentCommissionType  =	(records.payment_commission_type)	?	records.payment_commission_type :"";
										tempObject['method']	=	 records.method;
										tempObject['commission_type'] = paymentCommissionType;
										tempObject['commission_criteria'] = records.commission_criteria;
										if(paymentCommissionType == Constants.COMMISSION_FIXED || paymentCommissionType == Constants.COMMISSION_VARIABLE) tempObject['commission'] = (records.values && records.values[0]) ? parseFloat(records.values[0].commission) : 0;

										if(paymentCommissionType == Constants.COMMISSION_VARIABLE){
											tempObject['from'] = parseFloat(records.values[0].from);
											tempObject['to'] = parseFloat(records.values[0].to);
										}

										if(paymentCommissionType == Constants.COMMISSION_FIXED_AMOUNT) tempObject['amount'] = parseFloat(records.values[0].amount);

										if(records.values && records.values.length > 0){
											if(!tempObject['values']) tempObject['values']	=	[];
											records.values.map((data,keyIndex)=>{
												if(data.index){
													let valueObject	=	{};
													if(paymentCommissionType == Constants.COMMISSION_FIXED || paymentCommissionType == Constants.COMMISSION_VARIABLE){
														valueObject['commission'] = (data.commission)	?	parseFloat(data.commission) :0;
													}

													if(paymentCommissionType == Constants.COMMISSION_VARIABLE){
														valueObject['from'] = (data.from)	?	parseFloat(data.from)	:0;
														valueObject['to']	= (data.to)		?	parseFloat(data.to)		:0;
													}

													if(paymentCommissionType == Constants.COMMISSION_FIXED_AMOUNT){
														valueObject['amount'] = (data.amount)	?	parseFloat(data.amount)	:0;
													}
													tempObject['values'].push(valueObject);
												}
											});
										}
										paymentCommissionValue.push(tempObject);
									}
								});
							}

							let updateSetData	=	{
								account_manager	:	accountManagerName,
								email 			:	email,
								contact_person	:	req.body.contact_person_name,
								address			:	req.body.address,
								mobile_number 	:(req.body.phone_number) ? req.body.phone_number :"",
								modified		:	Helper.getUtcDate(),
							};

							let commissionValueUpdateData = {};
							if(isFinanceTeam){
								updateSetData['delivery_by']		=	req.body.delivery_by;
								updateSetData['payment_method']		=	paymentCommissionValue;
								updateSetData['settlement_method']	=	req.body.settlement_methods;
								updateSetData['beneficiary']		=	req.body.beneficiary;
								updateSetData['iban']				=	req.body.iban;
								updateSetData['bank_id']			=	bankId;
								updateSetData['bank_account']		=	req.body.bank_account;
								updateSetData['settlement_type']	=	req.body.settlement_type;
								updateSetData['pickup_enable']		=   req.body.pickup_enable   ? true : false;

								/** Set cravez / restaurant commission details */
								req.body.delivery_by.map(deliveryBy=>{
									if(deliveryBy == Constants.DELIVERY_BY_CRAVEZ){
										commissionValueUpdateData.cravez = {
											commission_type 	: commissionType,
											delivery_by     	: req.body.cravez_delivery_by,
											commission_criteria : req.body.commission_criteria,
											values 				: commissionValue
										}
									}

									if(deliveryBy == Constants.DELIVERY_BY_RESTAURANT){
										commissionValueUpdateData.restaurant = {
											commission_type 	: restaurantCommissionType,
											delivery_by     	: req.body.restaurant_delivery_by,
											commission_criteria : req.body.restaurant_commission_criteria,
											values 				: restaurantCommissionValue
										}
									}
								});

								/** Set pick-up commission details */
								if(req.body.pickup_enable){
									commissionValueUpdateData["pick-up"] = {
										commission_type 	: pickupCommissionType,
										delivery_by     	: req.body.pickup_delivery_by,
										commission_criteria : req.body.pickup_commission_criteria,
										values 			    : pickupCommissionValue
									}
								}
								updateSetData['commission_value'] = commissionValueUpdateData;
							}

							/** Set restaurant update Data */
							let restaurantDetailsUpdateData = {
								$set : updateSetData,
								$setOnInsert: {
									approved_by		:	new ObjectId(authUserId),
									approved_on		:	Helper.getUtcDate(),
									created			:	Helper.getUtcDate(),
								}
							}

							/** Set caused by */
							if(isContentTeam || isFinanceTeam){
								let causedByList = [];
								causedByArray.map((records)=>{
									if(records.cause){
										causedByList.push({cause: records.cause, percentage: (records.percentage) ? parseFloat(records.percentage)	:0});
									}
								});

								restaurantDetailsUpdateData["$set"].caused_by 		= causedByList;
								restaurantDetailsUpdateData["$set"].contract_number = req.body.contract_number;
								restaurantDetailsUpdateData["$set"].contract_date 	= Helper.getUtcDate(req.body.contract_date+" "+Constants.END_DATE_TIME_FORMAT);
								restaurantDetailsUpdateData["$set"].effective_date 	= Helper.getUtcDate(req.body.effective_date+" "+Constants.END_DATE_TIME_FORMAT);
								restaurantDetailsUpdateData["$set"].valid_from 		= Helper.getUtcDate(req.body.valid_from+" "+Constants.END_DATE_TIME_FORMAT);
								restaurantDetailsUpdateData["$set"].expire_date 	= Helper.getUtcDate(req.body.expire_date+" "+Constants.END_DATE_TIME_FORMAT);
							}

							if(enquryDetails){
								restaurantDetailsUpdateData["$setOnInsert"].phone_country_code = (enquryDetails.phone_country_code)	? enquryDetails.phone_country_code	:"";
							}

							/** Save  restaurant details **/
							const restaurant_details = this.db.collection(Tables.RESTAURANT_DETAILS);
							restaurant_details.updateOne({ restaurant_id: restaurantId },restaurantDetailsUpdateData,{upsert: true}).then(() =>{
								callback(null);
							}).catch(next);
						},
						enquiries_update_details : (callback)=>{
							if(!enquiryId) return callback(null,{});

							/** Set data in a object */
							let setData = {
								admin_id      : new ObjectId(authUserId),
								restaurant_id : restaurantId
							};

							/** Set status if user role id is  sales,marketing and cravez **/
							if(isContentTeam){
								setData.approval_status = Constants.APPROVED;
							}else{
								setData.team_approval_status = Constants.APPROVED;
							}
							/** Save restaurant details */
							this.collectionDb.updateOne({ _id : new ObjectId(enquiryId)},{$set : setData}).then(() =>{
								callback(null);
							}).catch(next);
						},
						branch_areas_update_details : (callback)=>{
							if(req.body.pickup_enable || !restaurantId) return callback(null,{});

							/** Save restaurant all branch area attributes details */
							const tmp_restaurant_branch_areas=this.db.collection(Tables.TMP_RESTAURANT_BRANCH_AREAS);
							const restaurant_branch_areas	= this.db.collection(Tables.RESTAURANT_BRANCH_AREAS);
							restaurant_branch_areas.updateMany({
								restaurant_id:restaurantId
							},
							{$set:{
								accept_pickup_orders : Constants.DEACTIVE,
								modified			 : Helper.getUtcDate()
							}}).then(() =>{

								tmp_restaurant_branch_areas.updateMany({
									restaurant_id:restaurantId
								},
								{$set:{
									accept_pickup_orders : Constants.DEACTIVE,
									modified			 : Helper.getUtcDate()
								}}).then(() =>{
									callback(null);
								}).catch(next);
							}).catch(next);
						},
						branch_area_settings_update_details : (callback)=>{
							if(req.body.pickup_enable || !restaurantId) return callback(null,{});

							/** Save restaurant all branch area attributes details */
							const tmp_restaurant_branch_area_settings=this.db.collection(Tables.TMP_RESTAURANT_BRANCH_AREA_SETTINGS);
							const restaurant_branch_area_settings =  this.db.collection(Tables.RESTAURANT_BRANCH_AREA_SETTINGS);
							restaurant_branch_area_settings.updateMany({
								restaurant_id	:	restaurantId,
								attribute_id	:	Constants.ACCEPT_PICKUP_ORDER
							},
							{$set:{
								attribute_value : 	Constants.DEACTIVE,
								modified		:	Helper.getUtcDate()
							}}).then(() =>{

								tmp_restaurant_branch_area_settings.updateMany({
									restaurant_id	:	restaurantId,
									attribute_id	:	Constants.ACCEPT_PICKUP_ORDER
								},
								{$set:{
									attribute_value : 	Constants.DEACTIVE,
									modified		:	Helper.getUtcDate()
								}}).then(() =>{
									callback(null);
								}).catch(next);
							}).catch(next);
						},
					},(asyncErr)=>{
						if(asyncErr) return next(asyncErr);

						if(enquiryId && password && restaurantId && isContentTeam){
							/*************** Send Mail  ***************/
							sendMailToUsers(req,res,{
								event_type 		: Constants.RESTAURANT_ENQUIRY_APPROVE_EMAIL_EVENTS,
								restaurant_id	: restaurantId,
								password		: password
							});
							/*************** Send Mail  ***************/
						}else if(enquiryId){
							/** Notification to content team for restaurant enquiry */
							let notificationMessageParams = [req.body.restaurant_name_in_english];
							insertNotifications(req,res,{
								notification_data : {
									notification_type :	Constants.NOTIFICATION_RESTAURANT_ENQUIRY_REQUEST,
									message_params 	  :	notificationMessageParams,
									parent_table_id   : enquiryId,
									user_role_id 	  : Constants.CRAVEZ,
									role_id 		  : [Constants.CONTENT_TEAM],
									only_for_user_role:	true,
									extra_parameters  : {
										enquiry_id 	: enquiryId
									}
								}
							}).then(()=>{});
							/*************** Send approval request to content team  ***************/
						}

						/** send success response */
						let approveMessage = (isContentTeam) ? res.__("admin.restaurant_enquiry.restaurant_enquiry_has_been_approved_and_mail_send") : res.__("admin.restaurant_enquiry.restaurant_enquiry_has_been_approved");
						let message 	   = (!enquiryId)    ? res.__("admin.restaurant_enquiry.restaurant_details_has_been_updated_successfully")   : approveMessage;
						req.flash(Constants.STATUS_SUCCESS,message);
						res.send({
							status 		:	Constants.STATUS_SUCCESS,
							message 	: 	message,
							redirect_url:	Constants.WEBSITE_ADMIN_URL + "restaurant_enquiries"
						});

						/** Save user activities **/
						saveUserActivity(req,res,{
							user_id 		:	authUserId,
							parent_type 	:	(!enquiryId)	?	"restaurants" 	:"restaurant_enquiries",
							parent_id 		: 	(!enquiryId)	?	restaurantId 	:enquiryId,
							activity_type	:	(!enquiryId) 	? 	Constants.ACTIVITY_UPDATE_RESTAURANT_DETAILS :Constants.ACTIVITY_APPROVE_RESTAURANT,
							additional_details:	(enquiryId)		?	{restaurant_id: restaurantId} :"",
						}).then(()=>{});
					});
				});
			});
		}else{
			let enquiryDetails = null;
			if(enquiryId){
				let enquiryResponse = await this.getEnquiryDetails(req,res,next);

				if(
					enquiryResponse?.result?.approval_status &&
					[Constants.PENDING, Constants.IN_REVIEW].indexOf(enquiryResponse?.result?.approval_status) != -1
				){
					enquiryDetails = enquiryResponse?.result;
				}
			}

			asyncParallel({
				settlement_method_list : (callback)=>{
					/** Get  settlement methods list */
					const settlement_methods = this.db.collection(Tables.SETTLEMENT_METHODS);
					settlement_methods.find({},{projection: {title:1,slug:1}}).toArray().then(result=>{
						callback(null,result);
					}).catch(next);
				},
				delivery_method_list : (callback)=>{
					/** Get  delivery methods list */
					const delivery_methods = this.db.collection(Tables.DELIVERY_METHODS);
					delivery_methods.find({},{projection: {title:1,slug:1}}).toArray().then(result=>{
						callback(null,result);
					}).catch(next);
				},
				payment_method_list : (callback)=>{
					/** Get  payment methods list */
					const payment_methods = this.db.collection(Tables.PAYMENT_METHODS);
					payment_methods.find({},{projection: {title:1,slug:1}}).toArray().then(result=>{
						callback(null,result);
					}).catch(next);
				},
				restaurant_details : (callback)=>{
					if(!restaurantId) return callback(null,null);

					/** Get  restaurant details */
					const restaurants	= this.db.collection(Tables.RESTAURANTS);
					restaurants.aggregate([
						{$match	: {
							_id : new ObjectId(restaurantId)
						}},
						{$lookup : {
							"from" 			: 	Tables.RESTAURANT_DETAILS,
							"localField" 	:	"_id",
							"foreignField" 	: 	"restaurant_id",
							"as" 			: 	"restaurant_sub_details"
						}},
					]).toArray().then(result=>{
						if(!result || result.length <=0) return callback(null,null);

						/** Append image with full path **/
						Helper.appendFileExistData({
							"file_url" 			: 	Constants.RESTAURANT_FILE_URL,
							"file_path" 		: 	Constants.RESTAURANT_FILE_PATH,
							"result" 			: 	result,
							"database_field" 	: 	"landing_image",
							"image_placeholder" :   "landing_image_full_path"
						}).then(response=>{

							/** Append image with full path **/
							Helper.appendFileExistData({
								"file_url" 			: 	Constants.RESTAURANT_FILE_URL,
								"file_path" 		: 	Constants.RESTAURANT_FILE_PATH,
								"result" 			: 	response.result,
								"database_field" 	: 	"image",
								"image_placeholder" :   "image_full_path"
							}).then(imageResponse=>{

								/** Append image with full path **/
								Helper.appendFileExistData({
									"file_url" 			: 	Constants.RESTAURANT_FILE_URL,
									"file_path" 		: 	Constants.RESTAURANT_FILE_PATH,
									"result" 			: 	imageResponse.result,
									"database_field" 	: 	"detail_image",
									"image_placeholder" :   "detail_image_full_path"
								}).then(imageOneResponse=>{

									/** Append image with full path **/
									Helper.appendFileExistData({
										"file_url" 			: 	Constants.RESTAURANT_FILE_URL,
										"file_path" 		: 	Constants.RESTAURANT_FILE_PATH,
										"result" 			: 	imageOneResponse.result,
										"database_field" 	: 	"web_image",
										"image_placeholder" :   "web_image_full_path"
									}).then(imageWebResponse=>{
										callback(null,imageWebResponse?.result?.[0] || {});
									}).catch(next);
								}).catch(next);
							}).catch(next);
						}).catch(next);
					}).catch(next);
				},
				restaurant : (callback)=>{
					if(!restaurantId) return callback(null,null);

					/** Get restaurant details */
					const restaurant_details = this.db.collection(Tables.RESTAURANT_DETAILS);
					restaurant_details.findOne({restaurant_id : new ObjectId(restaurantId)},{projection: {pickup_enable:1}}).then(result=>{
						callback(null, result);
					}).catch(next);
				},
			},(err,response)=>{
				if(err) return next(err);

				if(!response || (!enquiryDetails && !response?.restaurant_details)){
					/** Send error response */
					req.flash(Constants.STATUS_ERROR,res.__("admin.system.invalid_access"));
					return res.redirect(Constants.WEBSITE_ADMIN_URL + "restaurant_enquiries");
				}

				/** Get bank list*/
				let bankId	=	response?.restaurant_details?.restaurant_sub_details?.[0]?.bank_id || '';
				Helper.getMyFatoorahBankList(req,res,next, {bank_id: bankId} ).then(bankResponse=>{
					if(bankResponse.status != Constants.STATUS_SUCCESS) return next(bankResponse);

					/** Render view page*/
					req.breadcrumbs(BREADCRUMBS['admin/restaurant_enquiries/'+(!actionType ? 'edit_restaurant' : 'approve_enquiry')]);
					res.render("approve_enquiry",{
						result					: enquiryDetails || {},
						restaurant_details		: response?.restaurant_details || {},
						settlement_method_list	: response?.settlement_method_list || [],
						delivery_method_list	: response?.delivery_method_list || [],
						payment_method_list		: response?.payment_method_list || [],
						restaurant				: response?.restaurant || {},
						action_type				: actionType,
						bank_list				: bankResponse.bank_list
					});
				}).catch(next);
			});
		}
	};//End approveEnquiry()

	/**
	 * Function to get restaurant enquiry details
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getEnquiryDetails (req,res,next){
		return new Promise(async resolve=>{
			try{
				let enquiryId = req.params.id;

				/* get  document details */
				let result = await this.collectionDb.findOne({
					_id : 	new ObjectId(enquiryId)
				},{projection: {
					_id:1,name:1,restaurant_address:1,contact_person_name:1,account_manager_name:1,mobile_number:1,email:1,approval_status:1,restaurant_description:1,rejection_msg:1, is_deleted:1, team_approval_status: 1,restaurant_id:1,landing_image:1,restaurant_logo:1,detail_image:1
				}});

				/** send invalid access if no document found */
				if(!result){
					return resolve({
						status : Constants.STATUS_ERROR,
						message : res.__("admin.system.invalid_access")
					});
				}

				if(result.is_deleted != Constants.NOT_DELETED){
					return resolve({
						status : Constants.STATUS_ERROR,
						message : res.__("admin.restaurant_enquiry.this_restaurant_enquiry_is_deleted_from_the_system")
					});
				}

				/** Appened image with full path **/
				Helper.appendFileExistData({
					"file_url" 			: 	Constants.RESTAURANT_ONBOARDING_FILE_URL,
					"file_path" 		: 	Constants.RESTAURANT_ONBOARDING_FILE_PATH,
					"result" 			: 	[result],
					"database_field" 	: 	"landing_image",
					"image_placeholder" :   "landing_image_full_path"
				}).then(imageResponse=>{

					/** Appened image with full path **/
					Helper.appendFileExistData({
						"file_url" 			: 	Constants.RESTAURANT_ONBOARDING_FILE_URL,
						"file_path" 		: 	Constants.RESTAURANT_ONBOARDING_FILE_PATH,
						"result" 			: 	imageResponse.result,
						"database_field" 	: 	"restaurant_logo",
						"image_placeholder" :   "restaurant_logo_full_path"
					}).then(imageLandingResponse=>{

						/** Appened image with full path **/
						Helper.appendFileExistData({
							"file_url" 			: 	Constants.RESTAURANT_ONBOARDING_FILE_URL,
							"file_path" 		: 	Constants.RESTAURANT_ONBOARDING_FILE_PATH,
							"result" 			: 	imageLandingResponse.result,
							"database_field" 	: 	"detail_image",
							"image_placeholder" :   "detail_image_full_path"
						}).then(imageDetailResponse=>{

							/** send success response */
							resolve({
								status : Constants.STATUS_SUCCESS,
								result : imageDetailResponse?.result?.[0] || {}
							});
						}).catch(next);
					}).catch(next);
				}).catch(next);
			}catch(e){
				return next(e);
			}
		}).catch(next);
	}//End getEnquiryDetails()

	/**
	 * Function to reject restaurant enquiry request
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async rejectEnquiry (req,res,next){
		try{
			/** Sanitize Data **/
			req.body	  = Helper.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let enquiryId = req?.body?.enquiry_id || "";
			let userId 	  = req?.session?.user?._id || "";

			/** send error response */
			if(!enquiryId){
				return res.send({
					status : Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access")
				});
			}

			/* check document exist or not */
			let resultCount = await this.collectionDb.countDocuments({
				_id 		: 	new ObjectId(enquiryId),
				is_deleted	:	Constants.NOT_DELETED
			});

			/** send invalid access if zero document found */
			if(resultCount <=0){
				return res.send({
					status : Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access"),
				});
			}

			/* set rejected status in restaurant enquiry */
			await this.collectionDb.updateOne({
				_id : new ObjectId(enquiryId)
			},
			{$set : {
				approval_status : Constants.REJECTED,
				rejection_msg   : req.body.reject_msg,
				admin_id 		: new ObjectId(userId),
				team_approval_status : Constants.REJECTED,
			}});

			/* send success response */
			res.send({
				status 	 : Constants.STATUS_SUCCESS,
				message  : res.__("admin.restaurant_enquiry.restaurant_enquiry_has_been_rejected"),
			});

			/*************** Send Mail  ***************/
			sendMailToUsers(req,res,{
				event_type 	: Constants.RESTAURANT_ENQUIRY_REJECT_EMAIL_EVENTS,
				enquiry_id	: enquiryId
			});
			/*************** Send Mail  ***************/

			/** Save user activities **/
			saveUserActivity(req,res,{
				user_id 		:	userId,
				parent_type 	:	Tables.RESTAURANT_ENQUIRIES,
				parent_id 		: 	enquiryId,
				activity_type	:	Constants.ACTIVITY_UPDATE_STATUS,
				additional_details:	{status: Constants.REJECTED},
			});
		}catch(e){
			return next(e);
		}
	}//End rejectEnquiry()

	/**
	 * Function to view restaurant enquiry
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async viewEnquiry (req,res,next){
		try{
			/** get enquiry details from database */
			let enquiryResponse = await this.getEnquiryDetails(req,res,next);

			/** send error response if enquiry details not found */
			if(enquiryResponse?.status != Constants.STATUS_SUCCESS){
				req.flash(Constants.STATUS_ERROR,enquiryResponse?.message);
				return res.redirect(Constants.WEBSITE_ADMIN_URL+"restaurant_enquiries");
			}

			/** Render view page*/
			req.breadcrumbs(BREADCRUMBS['admin/restaurant_enquiries/view']);
			res.render("view",{
				result: enquiryResponse?.result || {},
			});
		}catch(e){
			return next(e);
		}
	}//End viewEnquiry()

	/**
	 * Function for update restaurant enquiry's status
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
	 */
	async updateStatus (req,res,next){
		try{
			let enquiryId 	=	req.params.id;
			let pageType 	= 	req?.query?.page_type || "";
			let redirectUrl =	Constants.WEBSITE_ADMIN_URL+"restaurant_enquiries"+(pageType && "/view/"+enquiryId ||  "");

			/** Get restaurant enquiry details */
			let result = await this.collectionDb.findOne({
				_id 			: 	new ObjectId(enquiryId),
				approval_status :	Constants.PENDING,
				is_deleted		:	Constants.NOT_DELETED
			},{projection: {_id:1, approval_status: 1}});

			/** Send error response **/
			if(!result){
				req.flash(Constants.STATUS_ERROR,res.__("admin.system.invalid_access"));
				return res.redirect(redirectUrl);
			}

			/** Update restaurant enquiry details */
			await this.collectionDb.updateOne({
				_id : new ObjectId(enquiryId)
			},{$set :{
				approval_status 	 : Constants.IN_REVIEW,
				team_approval_status : Constants.IN_REVIEW,
				modified  			 : Helper.getUtcDate(),
			}});

			/** Send success response **/
			req.flash(Constants.STATUS_SUCCESS,res.__("admin.restaurant_enquiry.status_has_been_updated_successfully"));
			res.redirect(redirectUrl);

			/** Save user activities **/
			saveUserActivity(req,res,{
				user_id 		:	req?.session?.user?._id || "",
				parent_type 	:	Tables.RESTAURANT_ENQUIRIES,
				parent_id 		: 	enquiryId,
				activity_type	:	Constants.ACTIVITY_UPDATE_STATUS,
				additional_details:	{status: Constants.IN_REVIEW},
			});
		}catch(e){
			return next(e);
		}
	}//End updateStatus()

	/**
	 * Function for update restaurant enquiry's status
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
	 */
	async updateMultipleStatus (req,res,next){
		try{
			let enquiryIds	=	req?.body?.enquiry_id?.split(",") || [];
			let status 		= 	req?.body?.status || "";
			let authId 	  	= 	req?.session?.user?._id || "";

			if(!enquiryIds || enquiryIds.length <=0 || !status){
				return res.send({
					status : Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access")
				});
			}

			if(status == Constants.REJECTED && !req?.body?.reject_msg){
				return res.send({
					status : Constants.STATUS_ERROR, message: [{'param':'reject_msg','msg':res.__("admin.restaurant_enquiry.please_enter_rejection_condition")}]
				});
			}

			/** Convert object id */
			enquiryIds = Helper.arrayToObject(enquiryIds);

			/** Get restaurant enquiry details */
			let result = await this.collectionDb.find({
				_id 			: {$in : enquiryIds},
				is_deleted		: Constants.NOT_DELETED,
				approval_status : {$nin: [Constants.APPROVED, Constants.REJECTED]}
			},{projection: {_id:1,email:1, name:1}}).toArray();

			/** send invalid access if zero document found */
			if(!result || result.length <=0){
				return res.send({
					status : Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access")
				});
			}

			/** Set update data */
			let updateData = {
				approval_status 		: parseInt(status),
				team_approval_status 	: parseInt(status),
				modified  				: Helper.getUtcDate()
			}

			if(status == Constants.REJECTED){
				updateData.admin_id		= new ObjectId(authId);
				updateData.rejection_msg= req?.body?.reject_msg || "";
			}

			/** Update restaurant enquiry details */
			await this.collectionDb.updateMany({
				_id 			: {$in :enquiryIds},
				approval_status : {$nin : [Constants.APPROVED, Constants.REJECTED]}
			},{$set :updateData});

			/** Send mail when reject request **/
			if(status == Constants.REJECTED){
				result.map(records=>{
					if(records._id){
						/*************** Send Mail  ***************/
						sendMailToUsers(req,res,{
							event_type 	: Constants.RESTAURANT_ENQUIRY_REJECT_EMAIL_EVENTS,
							enquiry_id	: records._id
						});
						/*************** Send Mail  ***************/
					}
				});
			}

			/** Send success response **/
			res.send({
				status : Constants.STATUS_SUCCESS,
				message	: res.__("admin.restaurant_enquiry.status_has_been_updated_successfully")
			});

			/** Save user activities **/
			saveUserActivity(req,res,{
				user_id 		:	authId,
				parent_type 	:	Tables.RESTAURANT_ENQUIRIES,
				parent_id 		: 	enquiryIds,
				activity_type	:	Constants.ACTIVITY_UPDATE_STATUS,
				additional_details:	{status: status},
			});
		}catch(e){
			return next(e);
		}
	}//End updateMultipleStatus()

	/**
	 * Function for delete restaurant enquiry
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
	 */
	async deleteRestaurantEnquiry (req,res,next){
		try{
			let enquiryId 	= req.params.id;
			let authUserId	= req.session.user?._id || "";

			/** Delete restaurant enquiry **/
			await this.collectionDb.updateOne({
				_id : new ObjectId(enquiryId)
			},
			{$set : {
				is_deleted 	: Constants.DELETED,
				deleted_by	: new ObjectId(authUserId),
				deleted_at	: Helper.getUtcDate(),
				modified	: Helper.getUtcDate()
			}});

			/** Send success response **/
			req.flash(Constants.STATUS_SUCCESS,res.__("admin.restaurant_enquiry.enquiry_deleted_successfully"));
			res.redirect(Constants.WEBSITE_ADMIN_URL+"restaurant_enquiries");

			/** Save user activities **/
			saveUserActivity(req,res,{
				user_id 		:	authUserId,
				parent_type 	:	Tables.RESTAURANT_ENQUIRIES,
				parent_id 		: 	new ObjectId(enquiryId),
				activity_type	:	Constants.ACTIVITY_DELETE_DETAILS
			});
		}catch(e){
			return next(e);
		}
	}//End deleteRestaurantEnquiry()

	/**
	* Function for download file
	*
	* @param req 	As Request Data
	* @param res 	As Response Data
	* @param next 	As Callback argument to the middleware function
	*
	* @return null
	*/
	async downloadFile (req, res, next){
		try{
			let enquiryId = req.params.id;

			/** find import manager record **/
			let result = await this.collectionDb.findOne({_id : new ObjectId(enquiryId)},{projection: {_id:1,file:1}});

			/** Send error response **/
			if(!result || !result?.file){
				req.flash(Constants.STATUS_ERROR,res.__("admin.system.invalid_access"));
				return res.redirect(Constants.WEBSITE_ADMIN_URL+"restaurant_enquiries");
			}

			res.download(Constants.RESTAURANT_ONBOARDING_FILE_PATH+result.file);
		}catch(e){
			return next(e);
		}
	}//End downloadFile()

	/**
	 * Function to add enquiry
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async addEnquiry (req, res,next){
		try{
			let userId 	  = req.session.user?._id || "";
			if(Helper.isPost(req)){
				/** Sanitize Data **/
				req.body = Helper.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);

				asyncParallel({
					file_upload : (callback)=>{
						if(!req?.files?.file) return callback(null,null);

						/** Upload file **/
						Helper.moveUploadedFile(req, res, {
							image 				: req.files.file,
							filePath  			: Constants.RESTAURANT_ONBOARDING_FILE_PATH,
							allowedExtensions 	: Constants.ALLOWED_RESTAURANT_ONBOARDING_EXTENSIONS,
							allowedImageError 	: Constants.ALLOWED_RESTAURANT_ONBOARDING_ERROR_MESSAGE,
							allowedMimeTypes	: Constants.ALLOWED_RESTAURANT_ONBOARDING_MIME_EXTENSIONS,
							allowedMimeError	: Constants.ALLOWED_RESTAURANT_ONBOARDING_MIME_ERROR_MESSAGE
						}).then(fileResponse => {
							callback(null,fileResponse);
						}).catch(next);
					},
					landing_image_upload : (callback)=>{
						if(!req?.files?.landing_image) return callback(null,null);

						/** Upload image **/
						Helper.moveUploadedFile(req, res, {
							image 	: req.files.landing_image,
							filePath: Constants.RESTAURANT_ONBOARDING_FILE_PATH
						}).then(imageResponse => {
							callback(null,imageResponse);
						}).catch(next);
					},
					restaurant_logo_upload : (callback)=>{
						if(!req?.files?.restaurant_logo) return callback(null,null);

						/** Upload image **/
						Helper.moveUploadedFile(req, res, {
							image 	: req.files.restaurant_logo,
							filePath: Constants.RESTAURANT_ONBOARDING_FILE_PATH
						}).then(logoResponse => {
							callback(null,logoResponse);
						}).catch(next);
					},
					upload_detail_image : (callback)=>{
						if(!req?.files?.detail_image) return callback(null,null);

						/** Upload image **/
						Helper.moveUploadedFile(req, res, {
							image 	: req.files.detail_image,
							filePath: Constants.RESTAURANT_ONBOARDING_FILE_PATH
						}).then(detailImageResponse => {
							callback(null,detailImageResponse);
						}).catch(next);
					},
				},async (err,response)=>{
					if(err) return next(err);

					let fileUpload 			 = response?.file_upload || {};
					let landingImageUpload 	 = response?.landing_image_upload || {};
					let restaurantLogoUpload = response?.restaurant_logo_upload || {};
					let detailImageUpload 	 = response?.upload_detail_image || {};

					/** If file upload error **/
					let errors = [];
					if (fileUpload.status == Constants.STATUS_ERROR) {
						errors.push({ 'param': 'file', 'msg': fileUpload.message });
					}

					/** If landing image extension error **/
					if (landingImageUpload.status == Constants.STATUS_ERROR) {
						errors.push({ 'param': 'landing_image', 'msg': landingImageUpload.message });
					}

					/** If restaurant logo image extension error **/
					if (restaurantLogoUpload.status == Constants.STATUS_ERROR) {
						errors.push({ 'param': 'restaurant_logo', 'msg': restaurantLogoUpload.message });
					}

					/** If detail image extension error **/
					if (detailImageUpload.status == Constants.STATUS_ERROR) {
						errors.push({ 'param': 'detail_image', 'msg': detailImageUpload.message });
					}

					/** Send error response **/
					if(errors && errors.length >0) return res.send({ status : Constants.STATUS_ERROR,message: errors});

					/** set data in object **/
					let updateData = {
						name : {
							ar : req?.body?.restaurant_arabic_name || "",
							en : req?.body?.restaurant_english_name || ""
						},
						restaurant_description 	: req?.body?.restaurant_description || "",
						restaurant_address     	: req?.body?.restaurant_address || "",
						phone_country_code		: Constants.DEFAULT_COUNTRY_CODE,
						approval_status			: Constants.IN_REVIEW,
						mobile_number         	: req?.body?.contact_number || "",
						contact_person_name     : req?.body?.contact_person_name || "",
						account_manager_name	: req?.body?.account_manager_name || "",
						email          			: req?.body?.email_address || "",
						added_by				: new ObjectId(userId),
						is_deleted				: Constants.NOT_DELETED,
						team_approval_status	: Constants.IN_REVIEW,
						created 			   	: Helper.getUtcDate()
					};

					/** if file upload **/
					if(fileUpload?.fileName) updateData['file'] = fileUpload.fileName;

					/** if landing image upload **/
					if(landingImageUpload?.fileName) updateData['landing_image'] = landingImageUpload.fileName;

					/** if restaurant logo upload **/
					if(restaurantLogoUpload?.fileName) updateData['restaurant_logo'] = restaurantLogoUpload.fileName;

					/** if detail image upload **/
					if(detailImageUpload?.fileName) updateData['detail_image'] = detailImageUpload.fileName;

					/** Save enquiry form details **/
					let qryResult = await this.collectionDb.insertOne(updateData);

					/** Send success response **/
					let enquiryId = qryResult?.insertedId || "";
					req.flash(Constants.STATUS_SUCCESS,res.__("admin.restaurant_enquiry.restaurant_on_boarding_request_has_been_submitted_successfully"));
					res.send({
						status		: Constants.STATUS_SUCCESS,
						redirect_url: Constants.WEBSITE_ADMIN_URL+"restaurant_enquiries/approve/"+enquiryId
					});

					/** Save user activities **/
					saveUserActivity(req,res,{
						user_id 		:	userId,
						parent_type 	:	Tables.RESTAURANT_ENQUIRIES,
						parent_id 		: 	enquiryId,
						activity_type	:	Constants.ACTIVITY_ADD_EDIT_DETAILS,
						additional_details:	{},
					});
				});
			}else{
				/** Render onboarding page  **/
				req.breadcrumbs(BREADCRUMBS['admin/restaurant_enquiries/add']);
				res.render("add");
			}
		}catch(e){
			return next(e);
		}
	}//End addEnquiry()
}