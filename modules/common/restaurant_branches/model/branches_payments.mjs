import { ObjectId } from 'mongodb';
import { parallel as asyncParallel } from 'async';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { getRestaurantId, getUtcDate, isAdmin, copyFromParentTable} from "../../../../utils/index.mjs";
import { saveUserActivity} from "../../../../services/index.mjs";

export default class BranchPaymentMethods{
    constructor(db) {
        this.db = db;
    }

	/**
	 * Function to render branch payment methods page
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async branchPaymentMethods(req,res,next){
		let slug  		=	(req.params.slug)	?	req.params.slug	:"";
		let branchId 	=	(req.params.id) 	? 	req.params.id	:"";

		/** Get restaurant id **/
		let restaurantId = await getRestaurantId(req,res,next,{slug:slug});

		/** Get restaurant details **/
		const restaurant_details = this.db.collection(Tables.RESTAURANT_DETAILS);
		let result = await restaurant_details.findOne({restaurant_id : new ObjectId(restaurantId)},{projection: { payment_method:1}});

		/** Manage payment list */
		let methodList = [];
		if(result && result.payment_method && result.payment_method.length >0 ){
			methodList = result.payment_method.map(records=>{ return records?.method || "";});
		}

		asyncParallel({
			payment_method_list : (callback)=>{
				/** Get payment methods list **/
				const payment_methods = this.db.collection(Tables.PAYMENT_METHODS);
				payment_methods.find({
					slug : {$in : methodList}
				},{projection: {_id: 0, slug: 1, title: 1}}).toArray().then(methodResult=>{
					callback(null, methodResult);
				}).catch(next);
			},
			selected_method_list : (callback)=>{
				/** Get selected payment methods **/
				const restaurant_branch_payment_methods = this.db.collection(Tables.RESTAURANT_BRANCH_PAYMENT_METHODS);
				restaurant_branch_payment_methods.findOne({
					branch_id 		: 	new ObjectId(branchId),
					restaurant_id 	:	new ObjectId(restaurantId),
				},{projection: {_id: 0, payment_methods: 1}}).then(result=>{
					callback(null, result?.payment_methods || []);
				}).catch(next);
			},
		},(_, response)=>{
			let paymentMethodList	= 	(response.payment_method_list)	?	response.payment_method_list	:[];
			let selectedMethodList	=	(response.selected_method_list)	?	response.selected_method_list	:[];

			/** Add selected flag  */
			if(selectedMethodList.length >0 && paymentMethodList.length >0){
				paymentMethodList.map(data=>{
					if(data.slug && selectedMethodList.indexOf(data.slug) != -1){
						data.is_selected = true;
					}
				});
			}

			/** Render branch Payment methods **/
			res.render('branch_payment_methods',{
				layout			: 	false,
				result			:	paymentMethodList,
				restaurant_id	:	restaurantId,
				branch_id		:	branchId,
				slug            :   slug
			});
		});
	};//End branchPaymentMethods()

	/**
	 * Function to save branch payment methods
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async saveBranchPaymentMethods(req,res,next){
		let branchId 	=	(req.params.id) 		? 	req.params.id			:"";
		let methods		=	(req.body.methods)		?	req.body.methods		:[];
		let restaurantId= 	(req.body.restaurant_id)? 	req.body.restaurant_id 	:"";
		let authUserId 	=	(req.session.user && req.session.user._id) ? req.session.user._id :"";

		/** Send error response */
		if(!restaurantId || methods.constructor !== Array || methods.length <=0){
			return res.send({
				status: STATUS_ERROR,
				message: res.__("system.something_going_wrong_please_try_again")
			});
		}

		/** Get restaurant details **/
		const restaurant_branch_payment_methods = this.db.collection(Tables.RESTAURANT_BRANCH_PAYMENT_METHODS);
		let result = await restaurant_branch_payment_methods.findOne({
			restaurant_id : new ObjectId(restaurantId),
			branch_id	  : new ObjectId(branchId)
		},{projection: { payment_methods:1}});

		let selectedMethods = 	(result && result.payment_methods) ? result.payment_methods :[];
		let newMethods 		=	[];
		let matchAnyMethod	=	false;
		if(selectedMethods.length >0){
			methods.map(key=>{
				if(selectedMethods.indexOf(key) == -1){
					newMethods.push(key);
				}
				if(selectedMethods.indexOf(key) != -1){
					matchAnyMethod = true;
				}
			});
		}else{
			newMethods = methods;
		}

		/** Send error response */
		if(!matchAnyMethod && !isAdmin(req,res)) return res.send({ status: Constants.STATUS_ERROR, message: res.__("branch_payment_methods.you_cannot_remove_all_approved_payment_methods") });

		let collection = this.db.collection(Tables.TMP_RESTAURANT_BRANCH_PAYMENT_METHODS);

		/** For admin only */
		if(isAdmin(req,res)) collection = this.db.collection(Tables.RESTAURANT_BRANCH_PAYMENT_METHODS);

		asyncParallel({
			tmp_branch_payment_update_details : (callback)=>{
				if(newMethods.length <= 0) return callback(null);
				let updateData = {modified: getUtcDate()};

				/** Save payment method details */
				collection.updateOne({
					restaurant_id : new ObjectId(restaurantId),
					branch_id	  : new ObjectId(branchId)
				},
				{
					$set 		: 	updateData,
					$addToSet 	:	{
						payment_methods: {$each : newMethods },
					},
					$setOnInsert : {
						added_by   : new ObjectId(authUserId),
						channel_id : req.session.user.channel_id,
						created    : getUtcDate()
					}
				},{upsert: true}).then(()=>{
					callback(null);
				}).catch(next);
			},
			branch_methods_update_details : (callback)=>{
				/** Update branch payment methods  **/
				restaurant_branch_payment_methods.updateOne({
					restaurant_id : new ObjectId(restaurantId),
					branch_id	  : new ObjectId(branchId)
				},
				{
					$set : {
						modified : getUtcDate()
					},
					$pull : {
						payment_methods: {$nin : methods },
					},
				}).then(()=>{
					callback(null);
				}).catch(next);
			},
			tmp_branch_update_details : (callback)=>{
				if(newMethods.length <= 0 || isAdmin(req,res)) return callback(null);

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
						additional_fields : {submit_for_approval : false, for_reapproval : true, user_id : new ObjectId(authUserId), status: Constants.PENDING},
					}
				}).then(response=>{
					if(response.status != Constants.STATUS_SUCCESS) return  callback(response);
					callback(null);
				}).catch(next);
			},
		},(err)=>{
			if(err) return next(err);

			if(isAdmin(req,res) || newMethods.length >0 || (matchAnyMethod && newMethods.length <= 0 && methods.length != selectedMethods.length)){
				/** Save user activities **/
				saveUserActivity(req,res,{
					user_id 		:	authUserId,
					parent_type 	:	Tables.RESTAURANT_BRANCH_PAYMENT_METHODS,
					parent_id 		: 	methods,
					activity_type	:	Constants.ACTIVITY_ADD_EDIT_DETAILS,
					is_not_objectId	:	true,
					additional_details:	{restaurant_id:new ObjectId(restaurantId), branch_id: new ObjectId(branchId),channel_id	: req.session.user.channel_id},
				}).then(()=>{});
			}

			let message = res.__("branch_payment_methods.payment_method_has_been_assigned_successfully");
			if(isAdmin(req,res)){
				return res.send({
					status	:	Constants.STATUS_SUCCESS,
					message	:	message,
				});
			}else{
				message = res.__("branch_payment_methods.payment_method_assigned_message_for_restaurant")
			}

			if(matchAnyMethod && newMethods.length <= 0 && methods.length != selectedMethods.length) return res.send({
				status			: Constants.STATUS_SUCCESS,
				is_not_redirect	: true,
				message			: res.__("branch_payment_methods.payment_method_has_been_assigned_successfully"),
			});

			if(newMethods.length <= 0) return res.send({
				status		: Constants.STATUS_ERROR,
				message		: res.__("branch_payment_methods.you_have_not_update_any_payment_methods"),
			});

			/** Send success response **/
			res.send({
				status	:	Constants.STATUS_SUCCESS,
				message	:	message,
			});
		});
	};//End saveBranchPaymentMethods()
}
