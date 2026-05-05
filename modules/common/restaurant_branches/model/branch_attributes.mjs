import { ObjectId } from 'mongodb';
import { each as asyncEach } from 'async';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import {getRestaurantId, sanitizeData, isAdmin, getUtcDate, copyFromParentTable, setBranchAreaAttributes} from "../../../../utils/index.mjs";
import { saveUserActivity } from "../../../../services/index.mjs";

export default class BranchAttributes {
    constructor(db) {
        this.db = db;
    }

	/**
	 * Function to get pending branch attributes
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getBranchAttributes(req,res,next){
		let slug 		= 	req?.params?.slug || "";
		let branchId 	=	req?.params?.id || "";

		/** Get restaurant id **/
		let restaurantId = await getRestaurantId(req,res,next,{slug:slug});

		/** Get restaurant branch attributes list **/
		const restaurant_branch_attributes = this.db.collection(Tables.RESTAURANT_BRANCH_ATTRIBUTES);
		restaurant_branch_attributes.aggregate([
			{$match :  {
				restaurant_id	:	new ObjectId(restaurantId),
				branch_id 		: 	new ObjectId(branchId),
			}},
			{$lookup:	{
				"from" 			: 	Tables.ATTRIBUTES,
				"localField" 	:	"attribute_id",
				"foreignField" 	: 	"attribute_id",
				"as" 			: 	"attribute_detail"
			}},
			{$match:{
				"attribute_detail._id" : {$exists : true}
			}},
			{$project :	{
				attribute_id: 1,value: 1, 
				title: {$arrayElemAt : ["$attribute_detail.title",0]},
				input_type: {$arrayElemAt : ["$attribute_detail.input_type",0]},
				default_value: {$arrayElemAt : ["$attribute_detail.default_value",0]},
				validation_type: {$arrayElemAt : ["$attribute_detail.validation_type",0]},
				required: {$arrayElemAt : ["$attribute_detail.required",0]},
				order: {$arrayElemAt : ["$attribute_detail.order",0]},
				data: {$arrayElemAt : ["$attribute_detail.data",0]}
			}},
			{$sort:{ order: Constants.SORT_ASC }}
		]).toArray().then((attributeResult)=>{

			res.render('branch_attributes',{
				layout	 	 : false,
				slug	 	 : slug,
				result 	 	 : attributeResult,
				restaurant_id: restaurantId,
				branch_id	 : branchId
			});
		}).catch(next);
	};//End getBranchAttributes()

	/**
	 * Function to save branch pending attributes
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async saveBranchAttributes(req,res,next){
		let branchId 		=	req?.params?.id || "";
		let authUserId 		=	req?.session?.user?._id || "";

		/** Sanitize Data **/
		req.body 			= 	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
		let restaurantId	= 	req?.body?.restaurant_id || "";

		/** Send error response */
		if(!restaurantId || !req.body.attributes || req.body.attributes.length == 0){
			return res.send({
				status: Constants.STATUS_ERROR,
				message: res.__("system.something_going_wrong_please_try_again")
			});
		}

		/** Check validations */
		let errors = [];
		req.body.attributes.forEach((attributRecord,index)=>{
			let value 			=	(attributRecord.value)		 	? attributRecord.value		  :"";
			let required 		= 	(attributRecord.required)		? attributRecord.required	  :"";
			let inputType 		= 	(attributRecord.input_type)	 	? attributRecord.input_type	  :"";
			let validateType 	= 	(attributRecord.validate_type) 	? attributRecord.validate_type:"";
			let title 			= 	(attributRecord.title) 		 	? attributRecord.title 		  :"";

			if(value =="" && required == Constants.REQUIRED && inputType !="checkbox"){
				errors.push({"param":"value_"+index,"msg":res.__("branch_attributes.please_enter")+" "+title});
			}else if(value && validateType == "numeric"){
				if(!Constants.VALID_NUMBER_REGEX.test(value)){
					errors.push({"param":"value_"+index,"msg":res.__("branch_attributes.please_enter_valid")+" "+title});
				}
			}else if(value && validateType == "float"){
				if(!Constants.VALID_FLOAT_REGEX.test(value)){
					errors.push({"param":"value_"+index,"msg":res.__("branch_attributes.please_enter_valid")+" "+title});
				}
			}else if(value && validateType == "percentage"){
				if(!Constants.VALID_FLOAT_REGEX.test(value)){
					errors.push({"param":"value_"+index,"msg":res.__("branch_attributes.please_enter_valid")+" "+title});
				}else if(value < 0 || value >100){
					errors.push({"param":"value_"+index,"msg":res.__("branch_attributes.please_enter_valid")+" "+title});
				}
			}

			if(required == Constants.REQUIRED && (validateType == "number" || validateType == "float")){
				if(value <= 0){
					errors.push({"param":"value_"+index,"msg":title+" "+res.__("branch_attributes.should_be_number")});
				}
			}
		});
		
		if(errors.length > 0) return res.send({status: Constants.STATUS_ERROR, message: errors});

		let changeInForm 	= false;
		let collection 		= this.db.collection(Tables.TMP_RESTAURANT_BRANCH_ATTRIBUTES);

		/** For admin only */
		if(isAdmin(req,res)) collection = this.db.collection(Tables.RESTAURANT_BRANCH_ATTRIBUTES);

		let parentIdObject	=	{};
		let extraFields 	= 	{};
		asyncEach(req.body.attributes,(branchAttributes, parentCallback)=>{
			let branchAttributeValue = branchAttributes?.value || "";
			
			if(branchAttributeValue != branchAttributes?.old_value){
				/** If user change value in any 1 input */
				changeInForm 		= true;
				let attributeId		= branchAttributes?.attribute_id ? parseInt(branchAttributes.attribute_id) :"";

				parentIdObject[String(attributeId)] = attributeId;

				/** Save branch attributes */
				collection.updateOne({
					restaurant_id : new ObjectId(restaurantId),
					branch_id	  : new ObjectId(branchId),
					attribute_id  : attributeId
				},
				{
					$set : {
						value 		: branchAttributeValue,
						modified 	: getUtcDate()
					},
					$setOnInsert : {
						added_by   : new ObjectId(authUserId),
						channel_id : req.session.user.channel_id,
						created    : getUtcDate()
					}
				},{upsert: true}).then(()=>{
					
					let branchAreaFields	= setBranchAreaAttributes(attributeId, branchAttributeValue);
					if(branchAreaFields)  extraFields = Object.assign(extraFields,branchAreaFields);

					parentCallback(null);
				}).catch(next);
			}else{
				parentCallback(null);
			}
		},async (parentErr)=>{
			if(parentErr) return res.send({status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again")});

			if(isAdmin(req,res) || changeInForm){
				/** Save user activities **/
				saveUserActivity(req,res,{
					user_id 		:	authUserId,
					parent_type 	:	Tables.RESTAURANT_BRANCH_ATTRIBUTES,
					parent_id 		: 	Object.values(parentIdObject),
					activity_type	:	Constants.ACTIVITY_ADD_EDIT_DETAILS,
					is_not_objectId	:	true,
					additional_details:	{
						restaurant_id: new ObjectId(restaurantId), 
						branch_id: new ObjectId(branchId),
						channel_id : req.session.user.channel_id
					}
				});
			}

			if(isAdmin(req,res) && Object.keys(extraFields).length > 0){
				await this.db.collection(Tables.RESTAURANT_BRANCHES).updateOne({ _id : new ObjectId(branchId), },{$set :extraFields });
			}

			let message = res.__("branch_attributes.attribute_has_been_updated_successfully");
			if(isAdmin(req,res)){
				return res.send({status: Constants.STATUS_SUCCESS, message: message});
			}else{
				message = res.__("branch_attributes.attribute_update_message_for_restaurant");
			}

			if(!changeInForm) return res.send({status: Constants.STATUS_ERROR, message: res.__("branch_attributes.you_have_not_update_any_value_in_attribute")});

			let options = {
				type : "insert_in_tmp_restaurant_branches", 
				parent_table : {
					name 			:	Tables.RESTAURANT_BRANCHES,
					fields 			: 	{ modified: 0,_id: 0},
					conditions 		: 	{_id: new ObjectId(branchId), restaurant_id:  new ObjectId(restaurantId)},
					remove_original : 	false
				},
				child_table : {
					name 		: 	Tables.TMP_RESTAURANT_BRANCHES,
					conditions	:	{restaurant_id: new ObjectId(restaurantId), branch_id: new ObjectId(branchId)},
					additional_fields : {
						submit_for_approval : false, 
						for_reapproval : true, 
						user_id : authUserId, 
						status: Constants.PENDING
					}
				}
			};

			if(Object.keys(extraFields).length > 0) options.child_table.extra_fields = extraFields;

			/** Copy data  tmp_restaurant_branches to  restaurant_branches collections*/
			copyFromParentTable(req,res,next,options).then(response=>{
				if(response.status != Constants.STATUS_SUCCESS) return  res.send({
					status	: Constants.STATUS_ERROR,
					message	: res.__("system.something_going_wrong_please_try_again")
				});

				/** Send success response **/
				res.send({status: Constants.STATUS_SUCCESS, message: message});
			}).catch(next);
		});
	};//End saveBranchAttributes()

}
