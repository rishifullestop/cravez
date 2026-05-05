import { ObjectId } from 'mongodb';
import { each as asyncEach, parallel as asyncParallel } from 'async';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import {getRestaurantId, sanitizeData, getUtcDate, setBranchAreaAttributes, getAttributes} from "../../../../utils/index.mjs";
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
	async getBranchPendingAttributes(req,res,next){
		let slug 		= 	req?.params?.slug || "";
		let branchId 	=	req?.params?.id || "";

		/** Get restaurant id **/
		let restaurantId = await getRestaurantId(req,res,next,{slug:slug});

		asyncParallel({
			attributes : (callback)=>{
				/** Get list of branch attributes **/
				getAttributes(req,res,next,{type: "branch_attributes"}).then(branchAttributes=>{
					callback(null,branchAttributes);
				}).catch(next);
			},
			branch_attributes : (callback)=>{
				/** Get restaurant branch attributes list **/
				const tmp_restaurant_branch_attributes = this.db.collection(Tables.TMP_RESTAURANT_BRANCH_ATTRIBUTES);
				tmp_restaurant_branch_attributes.aggregate([
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
				]).toArray().then(attributeResult=>{
					callback(null, attributeResult);
				}).catch(next);
			}
		},(asyncErr, asyncResponse)=>{
			if(asyncErr) return next(asyncErr);

			let result = (asyncResponse?.branch_attributes?.length>0) ? asyncResponse.branch_attributes : asyncResponse.attributes;
			res.render('branch_pending_attributes',{
				layout	 	 : false,
				slug	 	 : slug,
				result 	 	 : result,
				restaurant_id: restaurantId,
				branch_id	 : branchId
			});
		});
	};//End getBranchPendingAttributes()

	/**
	 * Function to save branch pending attributes
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async saveBranchPendingAttributes(req,res,next){
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

		let parentIdObject	=	{};
		const tmp_restaurant_branches			= this.db.collection(Tables.TMP_RESTAURANT_BRANCHES);
		const tmp_restaurant_branch_attributes 	= this.db.collection(Tables.TMP_RESTAURANT_BRANCH_ATTRIBUTES);
		asyncEach(req.body.attributes,(branchAttributes, parentCallback)=>{
			let attributeId		= (branchAttributes.attribute_id) ? parseInt(branchAttributes.attribute_id) :"";
			let attributeValue 	= branchAttributes?.value || "";

			parentIdObject[String(attributeId)] = attributeId;

			/** Save branch attributes */
			tmp_restaurant_branch_attributes.updateOne({
				restaurant_id : new ObjectId(restaurantId),
				branch_id	  : new ObjectId(branchId),
				attribute_id  : attributeId
			},
			{
				$set : {
					value 		: attributeValue,
					modified	: getUtcDate()
				},
				$setOnInsert : {
					added_by   : new ObjectId(authUserId),
					channel_id : req.session.user.channel_id,
					created    : getUtcDate()
				}
			},{upsert: true}).then(()=>{
				
				let branchAreaFields = setBranchAreaAttributes(attributeId, attributeValue);
				if(branchAreaFields){
					tmp_restaurant_branches.updateOne({ 
						branch_id : new ObjectId(branchId)
					},{$set :branchAreaFields }).then(()=>{
						parentCallback(null);
					}).catch(next);
				}else{
					parentCallback(null);
				}
			}).catch(next);
		},(parentErr)=>{
			if(parentErr) return res.send({
				status	: Constants.STATUS_ERROR,
				message	: res.__("system.something_going_wrong_please_try_again"),
			});

			/** Send success response **/
			res.send({
				status	: Constants.STATUS_SUCCESS,
				message	: res.__("pending_branches_attributes.attribute_has_been_updated_successfully"),
			});

			/** Save user activities **/
			saveUserActivity(req,res,{
				user_id 		:	authUserId,
				parent_type 	:	Tables.RESTAURANT_BRANCH_ATTRIBUTES,
				is_not_objectId	:	true,
				parent_id 		: 	Object.values(parentIdObject),
				activity_type	:	Constants.ACTIVITY_ADD_EDIT_DETAILS,
				additional_details:	{
					restaurant_id: new ObjectId(restaurantId), 
					branch_id: new ObjectId(branchId),
					channel_id : req.session.user.channel_id
				}
			});
		});		
	};//End saveBranchPendingAttributes()
}
