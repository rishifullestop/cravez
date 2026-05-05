import { ObjectId } from 'mongodb';
import { parallel as asyncParallel } from 'async';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { getRestaurantId, getUtcDate} from "../../../../utils/index.mjs";
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
	async pendingBranchPaymentMethods(req,res,next){
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
				const tmp_restaurant_branch_payment_methods = this.db.collection(Tables.TMP_RESTAURANT_BRANCH_PAYMENT_METHODS);
				tmp_restaurant_branch_payment_methods.findOne({
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
			res.render('pending_branches_payment_methods',{
				layout			: 	false,
				result			:	paymentMethodList,
				restaurant_id	:	restaurantId,
				branch_id		:	branchId,
				slug            :   slug
			});
		});
	};//End pendingBranchPaymentMethods()

	/**
	 * Function to save branch payment methods
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async savePendingBranchPaymentMethods(req,res,next){
		let branchId 	=	req?.params?.id || "";
		let methods		=	req?.body?.methods || [];
		let restaurantId= 	req?.body?.restaurant_id || "";
		let authUserId 	=	req?.session?.user?._id || "";

		/** Send error response */
		if(!restaurantId || methods.constructor !== Array || methods.length <=0){
			return res.send({
				status: Constants.STATUS_ERROR,
				message: res.__("system.something_going_wrong_please_try_again")
			});
		}
		/** Save approval details */
		const tmp_restaurant_branch_payment_methods = this.db.collection(Tables.TMP_RESTAURANT_BRANCH_PAYMENT_METHODS);
		await tmp_restaurant_branch_payment_methods.updateOne({
			restaurant_id : new ObjectId(restaurantId),
			branch_id	  : new ObjectId(branchId)
		},
		{
			$set : {
				modified 		: 	getUtcDate(),
				payment_methods :	methods
			},
			$setOnInsert : {
				added_by   : new ObjectId(authUserId),
				channel_id : req.session.user.channel_id,
				created    : getUtcDate()
			}
		},{upsert: true});

		/** Send success response **/
		res.send({
			status	: Constants.STATUS_SUCCESS,
			message	: res.__("pending_branches_payment_methods.payment_method_has_been_assigned_successfully"),
		});

			/** Save user activities **/
		saveUserActivity(req,res,{
			user_id 		:	authUserId,
			parent_id 		: 	methods,
			is_not_objectId	:	true,
			parent_type 	:	Tables.RESTAURANT_BRANCH_PAYMENT_METHODS,
			activity_type	:	Constants.ACTIVITY_ADD_EDIT_DETAILS,
			additional_details:	{
				restaurant_id: new ObjectId(restaurantId), 
				branch_id: new ObjectId(branchId),
				channel_id : req.session.user.channel_id
			}
		}).then(()=>{ });		
	};//End savePendingBranchPaymentMethods()
}
