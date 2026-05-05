import { ObjectId } from 'mongodb';
import { parallel as asyncParallel } from 'async';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, getRestaurantId, sanitizeData, isAdmin, getUtcDate, copyFromParentTable, getDropdownList} from "../../../../utils/index.mjs";
import { saveUserActivity } from "../../../../services/index.mjs";

export default class BranchPhones {
    constructor(db) {
        this.db = db;
    }

	/**
	 * Function to get  branch phones
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async getBranchPhoneNumberList(req,res,next){
		try{
			let slug 		=	(req.params && req.params.slug) ? req.params.slug 	:"";
			let branchId	=	(req.params && req.params.id) 	? req.params.id		: "";
	
			/** Get restaurant id **/
			let restaurantId = await getRestaurantId(req,res,next,{slug:slug});
	
			/** Get phone number list **/
			const restaurant_branch_phone_numbers = this.db.collection(Tables.RESTAURANT_BRANCH_PHONE_NUMBERS);
			let result = await restaurant_branch_phone_numbers.aggregate([
				{$match :  {
					restaurant_id	:	new ObjectId(restaurantId),
					branch_id 		: 	new ObjectId(branchId),
				}},
				{$sort 	:  	{_id: Constants.SORT_DESC}},
				{$lookup:	{
					"from" 			: 	Tables.ATTRIBUTES,
					"localField" 	:	"attribute_id",
					"foreignField" 	: 	"attribute_id",
					"as" 			: 	"attribute_detail"
				}},
				{$project :	{
					_id: 1, value: 1, country_code: 1,contact_name:1, attribute_name: {$arrayElemAt : ["$attribute_detail.title",0]},
				}},
			]).toArray();
	
			/** Render branch phone number list **/
			res.render('branch_phones',{
				layout			:	false,
				result			: 	(result) ? result :[],
				branch_id		: 	branchId,
				restaurant_id	: 	restaurantId,
				slug            :   slug
			});
		}catch(e){
			next(e);
		}
	}//End getBranchPhoneNumberList()

	/**
	 * Function to get phones number detail
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	async getPhoneNumberDetails(req, res, next){
		try{
			let phoneNumberId	=	(req.params.phone_number_id) 	? 	req.params.phone_number_id  :"";
			let slug 			=	(req.params && req.params.slug) ? 	req.params.slug 			:"";
			let branchId		=	(req.params && req.params.id) 	?	new ObjectId(req.params.id)		:"";

			/** Get restaurant id **/
			let restaurantId = await getRestaurantId(req,res,next,{slug:slug});

			/** Get phones number details **/
			const restaurant_branch_phone_numbers = this.db.collection(Tables.RESTAURANT_BRANCH_PHONE_NUMBERS);
			let result = await restaurant_branch_phone_numbers.findOne({
				_id  		  : new ObjectId(phoneNumberId),
				restaurant_id :	new ObjectId(restaurantId),
				branch_id 	  : new ObjectId(branchId),
			},{projection: { _id:1, value:1,attribute_id:1,contact_name:1}});

			/** Send error response */
			if(!result) return {status : Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") };

			/** Send success response **/
			return {
				status	: Constants.STATUS_SUCCESS,
				result	: result
			};
		}catch(e){
			next(e);
		}
	}// End getPhoneNumberDetails()

	/**
	 * Function to get  branch phones
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async addOrEditBranchPhoneNumber(req,res,next){
		try{
			let isEditable	=	(req.params.phone_number_id) 	?	true 					:false;
			let slug 		=	(req.params && req.params.slug) ? 	req.params.slug 		:"";
			let branchId	=	(req.params && req.params.id) 	?	new ObjectId(req.params.id)	:"";
			let authUserId 	=	(req.session.user && req.session.user._id) ? req.session.user._id :"";

			if(isPost(req)){
				/** Sanitize Data **/
				req.body 			= 	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
				let phoneNumberId 	=	(req.params.phone_number_id) ? new ObjectId(req.params.phone_number_id)   :new ObjectId();

				/** Get restaurant id **/
				let restaurantId =  await getRestaurantId(req,res,next,{slug:slug});

				let collection = this.db.collection(Tables.TMP_RESTAURANT_BRANCH_PHONE_NUMBERS);

				/** For admin only */
				if(isAdmin(req,res)) collection = this.db.collection(Tables.RESTAURANT_BRANCH_PHONE_NUMBERS);

				asyncParallel({
					phone_number_update_details : (callback)=>{

						/** Set conditions */
						let updateConditions = {
							_id				:	new ObjectId(phoneNumberId),
							restaurant_id	: 	new ObjectId(restaurantId),
							branch_id	  	:	new ObjectId(branchId)
						};					

						/** Save phone number details */
						collection.updateOne(updateConditions,{
							$set : {
								value 		: req.body.value,
								attribute_id: parseInt(req.body.attribute_id),
								contact_name: req.body.contact_name,
								modified 	: getUtcDate()
							},
							$setOnInsert : {
								country_code: 	Constants.DEFAULT_COUNTRY_CODE,
								added_by	:	new ObjectId(authUserId),
								channel_id	:	req.session.user.channel_id,
								created		:	getUtcDate()
							}
						},{upsert: true}).then(()=>{
							callback(null);
						}).catch(next);
					},
					tmp_branch_update_details : (callback)=>{
						if(isAdmin(req,res)) return callback(null);

						/** Copy data  tmp_restaurant_branches to  restaurant_branches collections*/
						copyFromParentTable(req,res,next,{
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
									user_id : new ObjectId(authUserId), 
									status: Constants.PENDING
								}
							}
						}).then(response=>{
							if(response.status != Constants.STATUS_SUCCESS) return  callback(response);
							callback(null);
						}).catch(next);
					},
				},(err)=>{
					if(err) return next(err);

					let message = (isEditable) ? res.__("branch_phones.phone_number_has_been_updated_successfully_you_can_see_updated_details_in_pending_branches_section") :res.__("branch_phones.phone_number_has_been_added_successfully_you_can_see_updated_details_in_pending_branches_section");

					/** Send success response **/
					if(isAdmin(req,res)){
						message = (isEditable) ? res.__("branch_phones.phone_number_has_been_updated_successfully") :res.__("branch_phones.phone_number_has_been_added_successfully");
					}
					res.send({status : Constants.STATUS_SUCCESS, message: message});

					/** Save user activities **/
					saveUserActivity(req,res,{
						user_id 		:	authUserId,
						parent_type 	:	Tables.RESTAURANT_BRANCH_PHONE_NUMBERS,
						parent_id 		: 	phoneNumberId,
						activity_type	:	Constants.ACTIVITY_ADD_EDIT_DETAILS,
						additional_details:	{restaurant_id: new ObjectId(restaurantId), branch_id: new ObjectId(branchId),channel_id: req.session.user.channel_id},
					});
				});
			}else{
				let result = {};
				if(isEditable){
					/** Get  phone number details **/
					let response  =	await this.getPhoneNumberDetails(req, res, next);

					/** Send error response */
					if(response.status != Constants.STATUS_SUCCESS) return res.status(400).send(response);

					result = response?.result || {};
				}

				/** Get attribute list **/
				let attributeId = result?.attribute_id || "";
				let dropdownResponse = await getDropdownList(req,res,next,{
					collections : [{
						collection 	: 	Tables.ATTRIBUTES,
						columns 	: 	["attribute_id","title"],
						selected 	: 	[attributeId],
						conditions 	: 	{type : "branch_phone_numbers"}
					}]
				});

				/** Send error response */
				if(dropdownResponse.status != Constants.STATUS_SUCCESS) return res.status(400).send(dropdownResponse);

				/** Render add or edit page  **/
				res.render('branch_phone_add_edit',{
					layout			:	false,
					branch_id		:	branchId,
					result			:	result,
					is_editable		:	isEditable,
					attribute_list	:	dropdownResponse?.final_html_data?.[0] || "",
				});
			}
		}catch(e){
			next(e);
		}
	}//End addOrEditBranchPhoneNumber()

	/**
	 * Function for delete branch phones
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async deleteBranchPhoneNumber(req, res, next){
		try{
			let phoneNumberId	=	(req.body.phone_number_id) 		? 	req.body.phone_number_id	:"";
			let slug 			=	(req.params && req.params.slug) ? 	req.params.slug 			:"";
			let branchId		=	(req.params && req.params.id) 	?	new ObjectId(req.params.id)	:"";
			let authUserId		=	(req.session.user && req.session.user._id) ? req.session.user._id :"";

			/** Get restaurant id **/
			let restaurantId = await getRestaurantId(req,res,next,{slug:slug});

			/** Send error response */
			if(!phoneNumberId) return res.send({status : Constants.STATUS_ERROR, message: res.__("system.missing_parameters")});

			/** Get branch phones count **/
			const restaurant_branch_phone_numbers = this.db.collection(Tables.RESTAURANT_BRANCH_PHONE_NUMBERS);
			let countResult = await restaurant_branch_phone_numbers.countDocuments({
				restaurant_id :	new ObjectId(restaurantId),
				branch_id 	  : new ObjectId(branchId)
			});

			/** Send error response */
			if(countResult <=1) return res.send({status : Constants.STATUS_ERROR, message: res.__("branch_phones.you_cannot_remove_all_approved_phone_number")});

			/** Remove branch phones number **/
			await restaurant_branch_phone_numbers.deleteOne({
				_id  		  : new ObjectId(phoneNumberId),
				restaurant_id :	new ObjectId(restaurantId),
				branch_id 	  : new ObjectId(branchId),
			});

			/** Send success response **/
			res.send({status : Constants.STATUS_SUCCESS, message: res.__("branch_phones.phone_number_has_been_deleted_successfully")});

			/** Save user activities **/
			saveUserActivity(req,res,{
				user_id 		:	authUserId,
				parent_type 	:	Tables.RESTAURANT_BRANCH_PHONE_NUMBERS,
				parent_id 		: 	new ObjectId(phoneNumberId),
				activity_type	:	Constants.ACTIVITY_DELETE_DETAILS,
				additional_details:	{
					restaurant_id: new ObjectId(restaurantId), 
					branch_id: new ObjectId(branchId),
					channel_id: req.session.user.channel_id
				}
			}).then(()=>{});
		}catch(e){
			next(e);
		}
	}//End deleteBranchPhoneNumber()
}
