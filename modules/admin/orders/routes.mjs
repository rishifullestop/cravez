import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { ObjectId } from 'mongodb';

import orders from "./model/orders.mjs";
import * as Constants from "../../../config/global_constant.mjs";
import Tables from '../../../config/database_tables.mjs';
import { newDate, validateRequest} from "../../../utils/index.mjs";
import { changeStatusValidation, refundAmountValidation, rejectOrderValidation, confirmStatusValidation} from "./validations.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure order routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(app, { db, checkLoggedInAdmin }) {
    const modulePath = '/orders';
    const ordersModule = new orders(db);

    // Set views for all order routes
    app.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

	/** Routing is used to get orders list **/
	app.all(modulePath,checkLoggedInAdmin,(req, res,next) => {
		ordersModule.getOrdersList(req, res,next);
	});

	/** Routing is used to accept order **/
	app.all(modulePath+'/accept_status/:_id',checkLoggedInAdmin,(req, res, next) => {
		ordersModule.acceptOrder(req, res,next);
	});

	/** Routing is used to get export  details **/
	app.get(modulePath+"/export_data/:export_count/:export_type",checkLoggedInAdmin,(req, res,next)=>{
		ordersModule.exportData(req,res,next);
	});

	/** Routing is used to change status of orders **/
	app.all(modulePath+'/change_status/:_id',checkLoggedInAdmin,changeStatusValidation, validateRequest,(req, res, next) => {
		ordersModule.changeStatus(req, res,next);
	});

	/** Routing is used to requeue orders **/
	app.all(modulePath+'/requeue/:_id',checkLoggedInAdmin,(req, res, next) => {
		ordersModule.requeueOrder(req, res,next);
	});

	/** Routing is used to reschedule orders **/
	app.all(modulePath+'/reschedule/:_id',checkLoggedInAdmin,(req, res, next) => {
		ordersModule.rescheduleOrder(req, res,next);
	});

	/** Routing is used to refund orders amount **/
	app.all(modulePath+'/refund_amount/:id',checkLoggedInAdmin, refundAmountValidation, validateRequest,(req, res, next) => {
		ordersModule.orderRefundAmount(req, res,next);
	});

	/** Routing is used to reject status of orders **/
	app.all(modulePath+'/reject_order_status',checkLoggedInAdmin, rejectOrderValidation, validateRequest,(req, res, next) => {
		ordersModule.rejectOrderRequest(req, res,next);
	});

	/** Routing is used to view orders detail **/
	app.all(modulePath+'/view/:id',checkLoggedInAdmin,(req, res,next) => {
		ordersModule.viewOrderDetails(req, res,next);
	});
	app.all(modulePath+'/view/:id/:type',checkLoggedInAdmin,(req, res,next) => {
		ordersModule.viewOrderDetails(req, res,next);
	});

	/** Routing is used to get list of items **/
	app.post(modulePath+'/list_items/:order_id',checkLoggedInAdmin,(req, res, next) => {
		ordersModule.listItems(req, res,next);
	});

	/** Routing is used to get list of status_logs **/
	app.post(modulePath+'/status_logs/:order_id',checkLoggedInAdmin,(req, res, next) => {
		ordersModule.listStatusLogs(req, res,next);
	});

	/** Routing is used to get branch list **/
	app.post(modulePath+"/branch_list",checkLoggedInAdmin,(req, res, next) => {
		ordersModule.branchList(req, res, next);
	});

	/** Routing is used to get location using ajax**/
	app.post(modulePath+"/get_location",checkLoggedInAdmin,(req, res, next) => {
		ordersModule.getLocation(req, res, next);
	});

	/** Routing is used to change address of order **/
	app.all(modulePath+"/change_address/:order_id",checkLoggedInAdmin,(req, res, next) => {
		ordersModule.changeAddress(req, res, next);
	});

	/** Routing is used to get order count **/
	app.post(modulePath+"/get_order_rules",checkLoggedInAdmin,(req, res,next) => {
		ordersModule.getOrderRules(req, res,next);
	});

	/** Routing is used to get list of refund and compensation  **/
	app.post(modulePath+'/refund_details/:order_id',checkLoggedInAdmin,(req, res, next) => {
		ordersModule.refundCompensationList(req, res,next);
	});

	/** Routing is used to get block list **/
	app.post(modulePath+"/get_block_list",checkLoggedInAdmin,(req, res, next) => {
		ordersModule.getBlockList(req,res,next);
	});

	/** Routing is used to get area list **/
	app.post(modulePath+"/get_area_list",checkLoggedInAdmin,(req, res, next) => {
		ordersModule.getAreaList(req,res,next);
	});

	/** Routing is used to confirm status **/
	app.all(modulePath+"/confirm_order_status/:order_id",checkLoggedInAdmin, confirmStatusValidation, validateRequest,(req, res,next) => {
		ordersModule.confirmStatus(req, res,next);
	});

	/** Routing is used to order revert **/
	app.all(modulePath+"/order_revert/:order_id",checkLoggedInAdmin,(req, res,next) => {
		ordersModule.orderRevert(req, res,next);
	});

	/** Routing is used to get kfg request or response **/
	app.get([
		modulePath+"/kfg_content",
		modulePath+"/kfg_content/:method_name"
	],async (req, res,next)=>{
		try{
			let methodName		=	req.params.method_name;
			let uniqueOrderId	=	(req.query.order_id) 	?	req.query.order_id		:'';
			let conceptId		=	(req.query.concept_id)	?	req.query.concept_id	:'';
			let fromDate		=	(req.query.from_date)	?	req.query.from_date		:'';
			let toDate			=	(req.query.to_date)		?	req.query.to_date		:'';
			let menuId			=	(req.query.menu_id)		?	req.query.menu_id		:'';
			let withoutCombo	=	(req.query.without_combo)?	parseInt(req.query.without_combo) :false;
			if(withoutCombo && methodName != "GetItemsModifierMap") withoutCombo =false;

			if(!methodName && !fromDate && !toDate) return res.send({err: "Please enter date." });

			/** Set conditions */
			let conditions = {};

			/** Add method name conditions */
			if(methodName) conditions.method_name = new RegExp(methodName, "i");

			if(menuId){
				conditions["$and"] =[{$or: [
					{"request.MenuCategoryId": {$in: [String(menuId), parseInt(menuId)]} },
					{"request.MenuId" :  {$in: [String(menuId), parseInt(menuId)]} },
				]}];
			}

			if(uniqueOrderId){
				if(!conditions["$and"]) conditions["$and"] =[];
				conditions["$and"].push({"request.Xml":  new RegExp(uniqueOrderId, "i") } );
			}

			if(conceptId){
				if(!conditions["$and"]) conditions["$and"] =[];
				conditions["$and"].push({"request.ConceptId": {$in: [String(conceptId),parseInt(conceptId)]}  } );
			}

			/** Add from date conditions */
			if(fromDate){
				fromDate  			= 	newDate(fromDate+" "+Constants.START_DATE_TIME_FORMAT);
				conditions.created	=	{$gte:	newDate(fromDate)};
			}

			/** Add to date conditions */
			if(toDate){
				if(!conditions.created) conditions.created = {};

				toDate 	  					=	newDate(toDate+" "+Constants.END_DATE_TIME_FORMAT);
				conditions.created["$lte"]	=	newDate(toDate);
			}

			if(withoutCombo){
				const cravez_items = db.collection(Tables.CRAVEZ_ITEMS);
				let coItemIds = await cravez_items.distinct("item_id",{restaurant_slug: "burger-king", is_combo: 1});

				if(coItemIds){
					if(!conditions["$and"]) conditions["$and"] =[];
					conditions["$and"].push({"request.ItemIds.long": {$nin: coItemIds}});
				}
			}

			/** Get kfg request or response */
			const kfg_request_response = db.collection(Tables.KFG_REQUEST_RESPONSE);
			let result = await kfg_request_response.find(conditions,{projection : {extra_perms: 0}}).sort({_id: Constants.SORT_DESC}).toArray();

			/** Send response */
			res.send(result);
		}catch(err){
			return next(err);
		}
	});

	/** Routing is used to get myfatoorah logs **/
	app.get([
		modulePath+"/myfatoorah_logs",
		modulePath+"/myfatoorah_logs/:rest_id"
	],async (req, res,next)=>{
		try{
			let restId	=	(req.params.rest_id) ? new ObjectId(req.params.rest_id)	:"";

			let restEmail = "";
			if(restId){
				/** Check if restaurant exist or not **/
				const restaurant_details =	db.collection(Tables.RESTAURANT_DETAILS);
				let restaurantDetails = await restaurant_details.findOne({restaurant_id: restId},{projection:{email:1}});

				restEmail = restaurantDetails?.email || "";
			}

			/** Set conditions */
			let conditions = {};
			if(restId){
				conditions["$or"] = [
					{restaurant_id: restId},
					{"request.body.Email": restEmail},
				];
			}

			/** Get myfatoorah logs */
			const myfatoorah_logs  = db.collection(Tables.MYFATOORAH_LOGS);
			let result = await myfatoorah_logs.find(conditions).sort({_id: Constants.SORT_DESC}).toArray();

			/** Send response */
			res.send({result});
		}catch(err){
			return next(err);
		}
	});

	/** Routing is used to get supplier invoice logs **/
	app.get(modulePath+"/supplier_invoice_logs",async (req, res,next)=>{
		try{
			let userId			=	(req.query.user_id) 	?	new ObjectId(req.query.user_id)	:'';
			let uniqueOrderId	=	(req.query.order_id) 	?	req.query.order_id			:'';

			/** Set conditions */
			let conditions = {};
			if(userId) 	conditions.user_id = userId;
			if(uniqueOrderId) conditions.unique_order_id = {$in: [uniqueOrderId]};

			/** Get myfatoorah logs */
			const supplier_invoice_logs  = db.collection(Tables.SUPPLIER_INVOICE_LOGS);
			let result = await supplier_invoice_logs.find(conditions).sort({_id: Constants.SORT_DESC}).toArray();

			/** Send response */
			res.send({result});
		}catch(err){
			return next(err);
		}
	});
}
