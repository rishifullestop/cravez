import { ObjectId } from 'mongodb';
import { parallel as asyncParallel, each as asyncEach } from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';

import * as Helpers from '../../../../utils/index.mjs';
import {sendMailToUsers} from '../../../../services/index.mjs';

import offerModal from '../../../frontend/api/model/offer.mjs';
import cartModal from '../../../frontend/api/model/user_carts.mjs';
import orderModal from '../../../frontend/api/model/order.mjs';
import restaurantModal from '../../../frontend/api/model/restaurant.mjs';

class ModifyOrders {
    constructor(db) {
        this.db = db;
        this.orderDB = db.collection(Tables.ORDERS);
		this.orderDetailsDB = db.collection(Tables.ORDER_DETAILS);
		this.orderItemDB = db.collection(Tables.ORDER_ITEMS);
		this.userCartDB = db.collection(Tables.USER_CARTS);

		this.cartAPI   =   new cartModal(db);
		this.offerAPI  =   new offerModal(db);
		this.orderAPI  =   new orderModal(db);
		this.restaurantAPI = new restaurantModal(db);
    }

	/**
	 * Function for modify order for backend
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async addNewItems (req, res,next){
		try{
			let orderId	= req?.params?.order_id && new ObjectId(req.params.order_id) || '';

			/** Get detail of order **/
			let orderResult = await this.orderDB.findOne({
				_id : new ObjectId(orderId)
			},{projection: {
				_id:1,restaurant_id:1,area_id:1,branch_id:1,customer_id:1,device_id:1
			}});

			/** If order not found then return error **/
			if(!orderResult){
				return res.status(400).send({
					status  : Constants.STATUS_ERROR,
					message : res.__("system.something_going_wrong_please_try_again")
				});
			}

			let restaurantId		=	orderResult?.restaurant_id || '';
			let branchId			=	orderResult?.branch_id || '';
			let areaId				=	orderResult?.area_id || '';
			let userId				=	orderResult?.customer_id || '';
			let deviceId			=	orderResult?.device_id || '';

			if(!req?.body) req.body = {};
			req.body.branch_id		=	branchId;
			req.body.restaurant_id	=	restaurantId;
			req.body.area_id		=	areaId;
			req.body.user_id		=	userId;
			req.body.device_id		=	deviceId;

			/** Get item details */
			this.restaurantAPI.getCategoryListWithItem(req,res,next).then(response=>{
				if(response.status != Constants.STATUS_SUCCESS) return next(response);

				/** Render add new item page */
				res.render('add_new_item',{
					layout			:	false,
					item_list		:	response,
					order_id		:	orderId,
					restaurant_id	:	restaurantId,
					branch_id		:	branchId,
					area_id			:	areaId,
				});
			}).catch(next);
		}catch(err){return next(err); }
	};

	/**
	 * Function for change quantity order for backend
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async changeQuantity (req, res,next){
		try{
			if(!req?.session?.deal_form) req.session.deal_form = {};
			req.session.deal_form = {};

			let orderId		=	req?.params?.order_id && new ObjectId(req.params.order_id) 	|| '';
			let itemId		=	req?.params?.item_id && new ObjectId(req.params.item_id) 	|| '';
			let extraParam	=	req?.params?.extra_param && req.params.extra_param 		|| '';

			/** Get detail of order **/
			let orderResult = await this.orderDB.findOne({
				_id : orderId
			},{projection: {
				_id:1,customer_id:1,device_id:1,restaurant_id:1,branch_id:1,area_id:1,cart_id:1
			}});

			/** If order not found then return error **/
			if(!orderResult){
				return res.status(400).send({
					status  : Constants.STATUS_ERROR,
					message : res.__("system.something_going_wrong_please_try_again")
				});
			}

			/** Get detail of order item **/
			let orderItems = await this.orderItemDB.findOne({
				order_id : orderId,
				item_id	 :	itemId
			},{projection: {
				_id:1,customer_id:1,device_id:1,restaurant_id:1,branch_id:1,area_id:1,cart_id:1
			}});

			let customerId		=	orderResult?.customer_id || '';
			let deviceId		=	orderResult?.device_id || '';
			let restaurantId	=	orderResult?.restaurant_id || '';
			let areaId			=	orderResult?.area_id || '';
			let branchId		=	orderResult?.branch_id || '';
			let cartId			=	orderResult?.cart_id || '';
			deviceId			=	orderId+(customerId || deviceId);

			asyncParallel({
				update_cart :(childCallback)=>{
					if(extraParam != 'addtocart' || !orderItems) return childCallback(null,null);

					let orderItemsPush = {
						is_admin	: true,
						order_id	: orderId,
						device_id	: deviceId,
						cart_id		: cartId,
						restaurant_id	: restaurantId,
						branch_id	: branchId,
						area_id	: areaId
					};


					let itemId			=	orderItems?.item_id || '';
					let itemUnitId		=	orderItems?.item_unit_id || '';
					let qty				=	orderItems?.qty || '';
					let unitId			=	orderItems?.unit_id || '';
					let doughId			=	orderItems?.dough_id || '';
					let selectorId		=	orderItems?.selector_id || '';
					let itemType		=	orderItems?.item_type || '';
					let price			=	orderItems?.price || '';
					let subTotal		=	orderItems?.sub_total || '';
					let discountedPrice	=	orderItems?.discounted_price || '';
					let netAmount		=	orderItems?.net_amount || '';

					/**Half And Half Type Item Add In Cart**/
					if(itemType == Constants.HALF_AND_HALF_ITEM){
						let unitLists	= (orderItems.unit_lists)	? orderItems.unit_lists	:[];
						let unitExtraIds = [];

						if(unitLists.length >0){
							unitLists.map(unitRecords=>{
								let selectorId		= (unitRecords.selector_id)	? unitRecords.selector_id	:"";
								let extraItems		= (unitRecords.extra_items)	? unitRecords.extra_items	:[];
								let extraIds = [];
								if(extraItems.length >0){
									extraItems.map(extraRecord=>{
										let tmpExtraItem 	=	[];
										let groupId			=	extraRecord.group_id;
										let extraItemIds			=	extraRecord.extra_item_ids;
										if(extraItemIds.length > 0 ){
											extraItemIds.map(extraIdRecord=>{
												tmpExtraItem.push({
													extra_item_id 		: extraIdRecord.extra_item_id,
													extra_group_item_id : extraIdRecord.extra_group_item_id,
												});
											});
										}
										if(tmpExtraItem.length >0){
											extraIds.push({
												group_id 		:	groupId,
												extra_item_ids 	: 	tmpExtraItem,
											});
										}
									});
								}
								if(extraIds.length >0){
									unitExtraIds.push({
										selector_id		:	selectorId,
										extra_items		: 	extraIds,
									});
								}
							});
						}

						orderItemsPush	=	{...orderItemsPush, ...{
							item_unit_id : itemUnitId,
							qty : qty,
							item_id : itemId,
							unit_id : unitId,
							dough_id : doughId,
							item_type : itemType,
							price : price,
							sub_total : subTotal,
							discounted_price : discountedPrice,
							net_amount : netAmount,
							unit_lists : unitExtraIds,
						}};

					}else if(itemType == Constants.DEAL_ITEM){

						/**Deal Type Item Add In Cart**/
						let dealUnitLists= (orderItems.unit_lists)	? orderItems.unit_lists	:[];
						let extraItems	= (orderItems.extra_items)	? orderItems.extra_items	:[];
						let extraIds 	= [];

						if(extraItems.length >0){
							extraItems.map(extraRecord=>{
								let tmpExtraItem =[];
								let groupId		=	extraRecord.group_id;
								if(extraRecord.extra_item_id){
									tmpExtraItem.push({
										extra_item_id 		: extraRecord.extra_item_id,
										extra_group_item_id : extraRecord.extra_item_group_id,
									});
								}
								if(tmpExtraItem.length >0){
									extraIds.push({
										group_id 		:	groupId,
										extra_item_ids 	: 	tmpExtraItem,
									});
								}
							});
						}

						let dealUnitExtraIds = [];
						if(dealUnitLists.length >0){
							dealUnitLists.map(dealUnitRecords=>{
								let unitId			= dealUnitRecords?.unit_id || "";
								let itemUnitId		= dealUnitRecords?.item_unit_id || "";
								let doughId			= dealUnitRecords?.dough_id || "";
								let selectorId		= dealUnitRecords?.selector_id || "";
								let dealExtraItems	= dealUnitRecords?.extra_items || [];

								let dealExtraIds = [];
								if(dealExtraItems.length >0){
									dealExtraItems.map(extraRecord=>{
										let tmpExtraItem 	=	[];
										let groupId			=	extraRecord.group_id;
										let dealExtraItemIds=	extraRecord.extra_item_ids;
										if(dealExtraItemIds.length > 0 ){
											dealExtraItemIds.map(extraIdRecord=>{
												tmpExtraItem.push({
													extra_item_id 		: extraIdRecord.extra_item_id,
													extra_group_item_id : extraIdRecord.extra_group_item_id,
												});
											});
										}
										if(tmpExtraItem.length >0){
											dealExtraIds.push({
												group_id 		:	groupId,
												extra_item_ids 	: 	tmpExtraItem,
											});
										}
									});
								}

								if(dealExtraIds.length >0){
									dealUnitExtraIds.push({
										unit_id			:	unitId,
										item_unit_id	:	itemUnitId,
										dough_id		:	doughId,
										selector_id		:	selectorId,
										extra_items		: 	dealExtraIds,
									});
								}
							});
						}

						orderItemsPush	=	{...orderItemsPush, ...{
							item_id : itemId,
							qty : qty,
							item_type : itemType,
							unit_lists : dealUnitExtraIds,
							extra_items : extraIds,
						}};

					}else{
						let extraItems	=	orderItems?.extra_items || '';

						let extraIds = [];
						if(extraItems?.length >0){
							extraItems.map(extraRecord=>{
								let tmpExtraItem =[];
								let groupId		=	extraRecord.group_id;
								if(extraRecord.extra_item_id){
									tmpExtraItem.push({
										extra_item_id 		: extraRecord.extra_item_id,
										extra_group_item_id : extraRecord.extra_item_group_id,
									});
								}

								if(tmpExtraItem.length >0){
									extraIds.push({
										group_id 		:	groupId,
										extra_item_ids 	: 	tmpExtraItem,
									});
								}
							});
						}

						orderItemsPush	=	{...orderItemsPush, ...{
							item_unit_id	: itemUnitId,
							cart_id			: cartId,
							qty				: qty,
							item_id			: itemId,
							unit_id			: unitId,
							dough_id		: doughId,
							selector_id		: selectorId,
							item_type		: itemType,
							price         	: price,
							sub_total    	: subTotal,
							discounted_price: discountedPrice,
							net_amount    	: netAmount,
							extra_items		: extraIds
						}};
					}

					if(!req.body) req.body = {};
					req.body =	orderItemsPush;
					this.cartAPI.updateCart(req,res,next).then(response=>{
						if(response.status != Constants.STATUS_SUCCESS) return childCallback(response);
						childCallback(null);
					}).catch(next);
				},
				get_item_details :(childCallback)=>{

					if(!req.body) req.body = {};
					req.body.item_id		=	itemId;
					req.body.branch_id		=	branchId;
					req.body.restaurant_id	=	restaurantId;
					req.body.area_id		=	areaId;
					req.body.device_id		=	deviceId;

					/** Get item details */
					this.restaurantAPI.getItemDetails(req,res,next).then(response=>{
						if(response.status != Constants.STATUS_SUCCESS) return childCallback(response);
						childCallback(null,response);
					});
				}
			},(addCartErr, addCartAsyncResponse)=>{
				if(addCartErr) return next(addCartErr);

				let itemDetailResponse	= addCartAsyncResponse?.get_item_details || {};
				let cartId				= itemDetailResponse?.item_details?.cart_id || '';

				asyncParallel({
					cart_data :(secondChildCallback)=>{
						if(cartId == '') return secondChildCallback(null,null);

						/** Get detail of User Cart **/
						this.userCartDB.findOne({_id : cartId }).then(cartResult=>{
							secondChildCallback(null,cartResult);
						}).catch(next);
					},
				},(cartErr, cartResponse)=>{
					if(cartErr) return next(cartErr);

					let cartData		=	cartResponse?.cart_data || {};
					let itemType		=	cartData?.item_type || "";
					let cartUnitId	 	=	'';
					let cartDoughId		=	'';
					let cartSelectorId	=	'';
					let cartExtraItem 	=	{};
					let unitLists		=	{};
					let unitData		=	[];
					let doughData 		=	[];
					let selectorData 	=	[];
					let extraData 		=	[];
					let extraGroupData 	=	[];
					let extraItemIds 	=	[];

					if(itemType == Constants.HALF_AND_HALF_ITEM){
						cartUnitId	 	=	cartData?.unit_id || '';
						cartDoughId		=	cartData?.dough_id || '';
						unitLists		=	cartData?.unit_lists || {};

						if(unitLists.length > 0){
							unitLists.map((records,key)=>{
								selectorData[key] = records.selector_id;
								extraData = records.extra_items;
								if(extraData.length > 0){
									extraData.map(eRecords=>{
										extraItemIds = 	eRecords.extra_item_ids;
										if(extraItemIds.length > 0){
											extraItemIds.map(cExtraRecords=>{
												if(!extraGroupData[key]) extraGroupData[key] = [];
												extraGroupData[key].push(cExtraRecords.extra_group_item_id);
											});
										}
									});
								}
							});
						}

					}else if(itemType == Constants.DEAL_ITEM){
						unitLists		=	cartData?.unit_lists || {};
						cartExtraItem 	=	cartData?.extra_items || {};
						deviceUniqueId 	= 	cartData?.device_id ||"";

						if(unitLists.length > 0){
							unitLists.map((records,key)=>{
								let itemUnitId 	= records?.item_unit_id || "";
								let selectorId 	= records?.selector_id || "";
								unitId 			= records?.unit_id || "";
								doughId 		= records?.dough_id || "";
								extraData 		= records?.extra_items || "";

								let dealItemsPush =	{
									"cart_id"			: cartId,
									"user_id"			: "",
									"unit_id"			: unitId,
									"selector_id"		: selectorId,
									"item_unit_id"		: itemUnitId,
									"dough_id"			: doughId,
									"extra_items"		: extraData,
								};

								sessionKey	=	key+1;
								if(dealItemsPush){
									if(!req.session.deal_form)  req.session.deal_form = {};
									req.session.deal_form[deviceUniqueId+"_"+orderId+"_"+sessionKey] = dealItemsPush;
								}

								unitData[key] 		= 	unitId;
								doughData[key] 		= 	doughId;
								selectorData[key] 	=	selectorId;
								if(extraData.length > 0){
									extraData.map(eRecords=>{
										extraItemIds = 	eRecords.extra_item_ids;
										if(extraItemIds.length > 0){
											extraItemIds.map(cExtraRecords=>{
												if(!extraGroupData[key]) extraGroupData[key] = [];
												extraGroupData[key].push(cExtraRecords.extra_group_item_id);
											});
										}
									});
								}
							});
						}
					}else{
						cartUnitId	 	=	cartData?.unit_id || '';
						cartDoughId		=	cartData?.dough_id || '';
						cartExtraItem 	=	cartData?.extra_items || {};
						cartSelectorId	=	cartData?.selector_id || '';
					}

					let doughItem = {};
					let selector = {};
					let itemUnitList	=	itemDetailResponse?.item_unit_list || [];
					itemDetailResponse.dough_list		=	{};
					itemDetailResponse.selector_list 	=   {};

					if(itemUnitList && itemUnitList.length >0){
						let unitId	=	'';
						itemUnitList.map(records=>{
							unitId	=	records.unit_id;

							let tmpDoughItem =[];
							if(records.dough_list && records.dough_list.length >0 && unitId != ""){
								records.dough_list.map(data=>{
									let tmpSelectItem=[];
									doughId		=	data._id;
									if(doughId){
										tmpDoughItem.push({
											id	:	data._id,
											price	: data.price,
											unit_name: data.unit_name,
											item_unit_id: data.item_unit_id,
										});
										/** For Selector Array*/
										if(data.selector_list && data.selector_list.length >0){
											data.selector_list.map(selectData=>{
												if(selectData._id){
													tmpSelectItem.push({
														id			:	selectData._id,
														price		: 	selectData.price,
														unit_name	: 	selectData.unit_name,
														item_unit_id: 	selectData.item_unit_id,
														sorting		:	selectData.sorting
													});
												}
											});
											let tmpSelectItemLength	=	tmpSelectItem.length;
											if(tmpSelectItemLength >0){
												selector[doughId] = tmpSelectItem;
											}
										}
									}
								});

								let tmpDoughItemLength	=	tmpDoughItem.length;
								if(tmpDoughItemLength >0){
									doughItem[unitId] 	= tmpDoughItem;
								}

								itemDetailResponse.dough_list 		=	doughItem;
								itemDetailResponse.selector_list 	=   selector;
							}
						});
					}

					/** Render change quantity */
					res.render('change_quantity',{
						layout			:	false,
						item_detail		:	itemDetailResponse,
						unit_id			:	cartUnitId,
						dough_id		:	cartDoughId,
						selector_id		:	cartSelectorId,
						extra_items		:	cartExtraItem,
						unit_lists		:	unitLists,
						unit_data		:	unitData,
						dough_data 		:	doughData,
						extra_group_data:	extraGroupData,
						selector_data 	:	selectorData,
						order_id		:	orderId,
						restaurant_id	:	restaurantId,
						branch_id		:	branchId,
						area_id			:	areaId,
						item_id			:	itemId,
						customer_id		:	customerId,
						device_id		:	deviceId,
					});
				});
			});
		}catch(err){return next(err); }
	};

	/**
	 * Function for get choice items details for backend
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async getChoiceItem (req, res,next){
		try{
			if(Helpers.isPost(req)){
				/** Sanitize Data **/
				req.body	  		= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
				let orderId 		= req?.body?.order_id || "";
				let itemId 			= req?.body?.item_id || "";
				let unitId 			= req?.body?.unit_id || "";
				let selectorId 		= req?.body?.selector_id || "";
				let doughTypeId		= req?.body?.dough_type_id || "";

				/** Get detail of order **/
				let orderResult = await this.orderDB.findOne({
					_id : new ObjectId(orderId)
				},{projection: {
					_id:1,restaurant_id:1,area_id:1,branch_id:1
				}});

				/** If order not found then return error **/
				if(!orderResult){
					return res.send({
						status  : Constants.STATUS_ERROR,
						message : res.__("system.something_going_wrong_please_try_again")
					});
				}

				let restaurantId		=	orderResult?.restaurant_id || '';
				let branchId			=	orderResult?.branch_id || '';

				req.body.item_id		=	itemId;
				req.body.branch_id		=	branchId;
				req.body.restaurant_id	=	restaurantId;
				req.body.unit_id		=	unitId;
				req.body.selector_id	=	selectorId;
				req.body.dough_type_id	=	doughTypeId;
				this.restaurantAPI.getItemChoiceList(req,res,next).then(response=>{
					if(response.status != Constants.STATUS_SUCCESS) return next(response);

					res.send({
						status	: response?.status || Constants.STATUS_ERROR,
						data	: response?.result || [],
					});
				}).catch(next);
			}
		}catch(err){return next(err); }
	};

	/**
	 * Function to get cart list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	*/
	async myCart (req, res,next){
		try{
			let orderId	= req?.params?.order_id && new ObjectId(req.params.order_id) || '';

			/** Get detail of order **/
			let orderResult = await this.orderDB.findOne({
				_id : new ObjectId(orderId)
			},{projection: {
				_id:1,restaurant_id:1,area_id:1,branch_id:1,customer_id:1,device_id:1
			}});

			/** If order not found then return error **/
			if(!orderResult){
				return res.status(400).send({
					status  : Constants.STATUS_ERROR,
					message : res.__("system.something_going_wrong_please_try_again")
				});
			}

			let restaurantId		=	orderResult?.restaurant_id || '';
			let branchId			=	orderResult?.branch_id || '';
			let areaId				=	orderResult?.area_id || '';
			let userId				=	orderResult?.customer_id || '';
			let deviceId			=	orderResult?.device_id || '';

			if(!req.body) req.body = {};
			req.body.branch_id		=	branchId;
			req.body.restaurant_id	=	restaurantId;
			req.body.area_id		=	areaId;
			req.body.device_id		=	orderId+(userId || deviceId);
			req.body.customer_id	=	"";
			req.body.user_id		=	"";

			/** Get cart details */
			this.cartAPI.getCartList(req,res,next).then(response=>{
				if(response.status != Constants.STATUS_SUCCESS) return next(response);

				/** Render my cart page */
				res.render('my_cart',{
					layout		:	false,
					cart_list	:	response,
					order_id	:	orderId
				});
			}).catch(next);
		}catch(err){return next(err); }
	};

	/**
	 * Function to item add in cart from item detail section
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	*/
	async updateNewItemsInCart (req, res,next){
		try{
			if(Helpers.isPost(req)){
				/** Sanitize Data **/
				req.body = Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
				let itemType = req?.body?.item_type || "";
				let orderId  = req?.body?.order_id ||  "";
				let userId 	 = req?.body?.user_id ||  "";
				let deviceId = req?.body?.device_id ||  "";
				let unitLists = req?.body?.unit_lists || [];
				let deviceUniqueId = orderId+(userId || deviceId);
				let errors=	[];
				let unitExtraIds = [];

				/**HALF AND HALF**/
				if(itemType == Constants.HALF_AND_HALF_ITEM){

					if(unitLists.length >0){
						unitLists.map((unitRecords,unitKeys)=>{
							let extraIds = [];
							let selectorId		= (unitRecords.selector_id)	? unitRecords.selector_id	:"";
							let extraItems		= (unitRecords.extra_items)	? unitRecords.extra_items	:[];

							if(extraItems.length >0){
								extraItems.map(records=>{
									let tmpExtraItem =[];
									let maxRecord	=	records.max_quantity;
									let minRecord	=	records.min_quantity;
									let groupId		=	records.group_id;
									if(records.extra_item_ids && records.extra_item_ids.length >0){
										records.extra_item_ids.map(data=>{
											if(data.extra_group_item_id){
												tmpExtraItem.push({
													extra_item_id 		: data.extra_item_id,
													extra_group_item_id : data.extra_group_item_id,
												});
											}
										});
									}

									let tmpLength =	tmpExtraItem.length;
									unitKeys	  =	unitKeys+1;
									if(minRecord > 0 && maxRecord > 0){
										if(minRecord > tmpLength){
											errors.push({param: "unit_lists_"+unitKeys+"_extra_items_"+groupId, msg: res.__("admin.order.please_select_extra_items_min")});
										}
										if(tmpLength > maxRecord){
											errors.push({param: "unit_lists_"+unitKeys+"_extra_items_"+groupId, msg: res.__("admin.order.please_select_extra_items_max")});
										}
									}else if(minRecord == 0 && maxRecord > 0){
										if(tmpLength > maxRecord){
											errors.push({param: "unit_lists_"+unitKeys+"_extra_items_"+groupId, msg: res.__("admin.order.please_select_extra_items_max")});
										}
									}

									if(tmpLength >0){
										extraIds.push({
											group_id 		: groupId,
											extra_item_ids 	: tmpExtraItem,
										});
									}
								});
							}

							if(extraIds.length >0){
								unitExtraIds.push({
									selector_id		:	selectorId,
									extra_items		: 	extraIds,
								});
							}
						});
					}

				}else if(itemType == Constants.DEAL_ITEM){

					/**DEAL ITEM CONDITION**/
					let extraIds = [];
					let totalDealComponents = req?.body?.total_deal_components || "";
					let dealFormSession	=	req?.session?.deal_form || {};
					let sessionLength	=	Object.keys(dealFormSession).length;

					if(sessionLength > 0 && sessionLength==totalDealComponents){
						let dealExtraItems	= req?.body?.deal_extra_items || [];
						if(dealExtraItems.length >0){
							dealExtraItems.map(records=>{
								let tmpExtraItem =[];
								let maxRecord	=	records.max_quantity;
								let minRecord	=	records.min_quantity;
								let groupId		=	records.group_id;

								if(records.extra_item_ids && records.extra_item_ids.length >0){
									records.extra_item_ids.map(data=>{
										if(data.extra_group_item_id){
											tmpExtraItem.push({
												extra_item_id 		: data.extra_item_id,
												extra_group_item_id : data.extra_group_item_id,
											});
										}
									});
								}

								let tmpLength	=	tmpExtraItem.length;
								if(minRecord > 0 && maxRecord > 0){
									if(minRecord > tmpLength){
										errors.push({param: "deal_extra_items_"+groupId, msg: res.__("admin.order.please_select_extra_items_min")});
									}
									if(tmpLength > maxRecord){
										errors.push({param: "deal_extra_items_"+groupId, msg: res.__("admin.order.please_select_extra_items_max")});
									}
								}else if(minRecord == 0 && maxRecord > 0){
									if(tmpLength > maxRecord){
										errors.push({param: "deal_extra_items_"+groupId, msg: res.__("admin.order.please_select_extra_items_max")});
									}
								}

								if(tmpLength >0){
									extraIds.push({
										group_id 		: records.group_id,
										extra_item_ids 	: tmpExtraItem,
									});
								}
							});
						}
					}else{
						errors.push({param: "choose_pizza", msg: res.__("admin.order.please_select_pizza_value")});
					}

					if(Object.keys(dealFormSession).length >0){
						Object.keys(dealFormSession).map(dealRecords=>{
							unitExtraIds.push(dealFormSession[dealRecords]);
						});
					}

					if(req.body.user_id) 		delete req.body.user_id;
					if(req.body.unit_id) 		delete req.body.unit_id;
					if(req.body.extra_items) 	delete req.body.extra_items;
					if(req.body.selector_id) 	delete req.body.selector_id;
					if(req.body.item_unit_id) 	delete req.body.item_unit_id;
					if(req.body.dough_id) 		delete req.body.dough_id;
					if(req.body.deal_extra_items)delete req.body.deal_extra_items;

					req.body.unit_lists		= 	unitExtraIds;
					req.body.extra_items	=	extraIds?.length && extraIds || "";

				}else{
					let extraItems	= req?.body?.extra_items || [];

					let extraIds = [];
					if(extraItems.length >0){
						extraItems.map(records=>{
							let tmpExtraItem =[];
							let maxRecord	=	records.max_quantity;
							let minRecord	=	records.min_quantity;
							let groupId		=	records.group_id;

							if(records.extra_item_ids && records.extra_item_ids.length >0){
								records.extra_item_ids.map(data=>{
									if(data.extra_group_item_id){
										tmpExtraItem.push({
											extra_item_id 		: data.extra_item_id,
											extra_group_item_id : data.extra_group_item_id,
										});
									}
								});
							}

							let tmpLength	=	tmpExtraItem.length;
							if(minRecord > 0 && maxRecord > 0){
								if(minRecord > tmpLength){
									errors.push({param: "extra_items_"+groupId, msg: res.__("admin.order.please_select_extra_items_min")});
								}
								if(tmpLength > maxRecord){
									errors.push({param: "extra_items_"+groupId, msg: res.__("admin.order.please_select_extra_items_max")});
								}
							}else if(minRecord == 0 && maxRecord > 0){
								if(tmpLength > maxRecord){
									errors.push({param: "extra_items_"+groupId, msg: res.__("admin.order.please_select_extra_items_max")});
								}
							}

							if(tmpLength >0){
								extraIds.push({
									group_id 		: records.group_id,
									extra_item_ids 	: tmpExtraItem,
								});
							}
						});
					}

					req.body.extra_items = extraIds?.length && extraIds || "";
				}

				/** Send error response **/
				if(errors.length > 0) return res.send({status: Constants.STATUS_ERROR, message: errors});

				req.body.user_id		=	'';
				req.body.device_id		=	deviceUniqueId;
				req.body.unit_lists		=	unitExtraIds?.length && unitExtraIds || "";

				this.cartAPI.updateCart(req,res,next).then(response=>{
					if(response.status != Constants.STATUS_SUCCESS) return next(response);

					if(itemType == Constants.DEAL_ITEM && req?.session?.deal_form) req.session.deal_form = {};

					res.send(response);
				}).catch(next);
			}
		}catch(err){return next(err); }
	};//updateNewItemsInCart()

	/**
	 * Function to item add in cart from item detail section
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	*/
	async updateDealItems (req, res,next){
		try{
			if(Helpers.isPost(req)){
				/** Sanitize Data **/
				req.body = Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
				let itemType 	=	req?.body?.item_type || "";
				let extraItems	= 	req?.body?.extra_items || [];
				let orderId 	= 	req?.body?.order_id || "";
				let userId 		= 	req?.body?.user_id || "";
				let deviceId 	= 	req?.body?.device_id || "";
				let deviceUniqueId = orderId+(userId || deviceId);
				let dealForm	=	req?.body?.deal_form || 0;

				/** Send response if item type is different */
				if(itemType != Constants.DEAL_ITEM) return res.send({status: Constants.STATUS_SUCCESS});

				let errors		=	[];
				let extraIds 	=	[];
				if(extraItems.length >0){
					extraItems.map(records=>{
						let tmpExtraItem =[];
						let maxRecord	=	records.max_quantity;
						let minRecord	=	records.min_quantity;
						let groupId		=	records.group_id;

						if(records.extra_item_ids && records.extra_item_ids.length >0){
							records.extra_item_ids.map(data=>{
								if(data.extra_group_item_id){
									tmpExtraItem.push({
										extra_item_id 		: data.extra_item_id,
										extra_group_item_id : data.extra_group_item_id,
									});
								}
							});
						}
						let tmpLength	=	tmpExtraItem.length;
						if(minRecord > 0 && maxRecord > 0){
							if(minRecord > tmpLength){
								errors.push({param: "extra_items_"+groupId, msg: res.__("admin.order.please_select_extra_items_min")});
							}
							if(tmpLength > maxRecord){
								errors.push({param: "extra_items_"+groupId, msg: res.__("admin.order.please_select_extra_items_max")});
							}
						}else if(minRecord == 0 && maxRecord > 0){
							if(tmpLength > maxRecord){
								errors.push({param: "extra_items_"+groupId, msg: res.__("admin.order.please_select_extra_items_max")});
							}
						}
						if(tmpLength >0){
							extraIds.push({
								group_id 		: records.group_id,
								extra_item_ids 	: tmpExtraItem,
							});
						}
					});
				}

				/** Send error response **/
				if(errors.length > 0) return res.send({status: Constants.STATUS_ERROR, message: errors});

				req.body.user_id	=	'';
				req.body.extra_items=	extraIds;
				req.body.device_id	=	deviceUniqueId;
				if(req.body.item_id) 			delete req.body.item_id;
				if(req.body.order_id) 			delete req.body.order_id;
				if(req.body.restaurant_id) 		delete req.body.restaurant_id;
				if(req.body.branch_id) 			delete req.body.branch_id;
				if(req.body.area_id) 			delete req.body.area_id;
				if(req.body.device_id) 			delete req.body.device_id;
				if(req.body.item_type) 			delete req.body.item_type;
				if(req.body.deal_extra_items) 	delete req.body.deal_extra_items;
				if(req.body.qty)	  			delete req.body.qty;


				if(!req?.session?.deal_form)  req.session.deal_form = {};
				req.session.deal_form[deviceUniqueId+"_"+orderId+"_"+dealForm] = req.body;

				res.send({status: Constants.STATUS_SUCCESS,data:req.session.deal_form});
			}
		}catch(err){return next(err); }
	};//updateDealItems()

	/**
	 * Function to delete items from cart
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	*/
	async deleteItemCart (req, res,next){
		try{
			if(Helpers.isPost(req)){
				/** Sanitize Data **/
				req.body	= 	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
				let orderId	= 	req?.body?.order_id || "";
				let cartId	= 	req?.body?.cart_id || "";

				/** Get detail of order **/
				let orderResult = await this.orderDB.findOne({
					_id : new ObjectId(orderId)
				},{projection: {
					_id:1,restaurant_id:1,customer_id:1,device_id:1
				}});

				/** If order not found then return error **/
				if(!orderResult){
					return res.send({
						status  : Constants.STATUS_ERROR,
						message : res.__("system.something_going_wrong_please_try_again")
					});
				}

				let restaurantId = orderResult?.restaurant_id || '';
				let userId		 = orderResult?.customer_id || '';
				let deviceId	 = orderResult?.device_id || '';

				req.body.user_id	=	"";
				req.body.device_id	= orderId+(userId || deviceId);
				if(!cartId) req.body.restaurant_id	= restaurantId;

				this.cartAPI.removeCartItems(req,res,next).then(response=>{
					if(response.status != Constants.STATUS_SUCCESS) return next(response);

					res.send({
						status  : Constants.STATUS_SUCCESS,
						message : response.message
					});
				}).catch(next);
			}
		}catch(err){return next(err); }
	}//deleteItemCart()

	/**
	 * Function to add items cart on click on modify order first time
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	*/
	async addItemsCart (req, res,next){
		try{
			let orderId	= req?.params?.order_id && new ObjectId(req.params.order_id) || '';

			/** Get detail of order **/
			let orderResult = await this.orderDB.findOne({
				_id : orderId
			},{projection: {
				_id:1,customer_id:1,device_id:1,restaurant_id:1,branch_id:1,area_id:1,cart_id:1
			}});

			/** If order not found then return error **/
			if(!orderResult){
				return res.send({
					status  : Constants.STATUS_ERROR,
					message : res.__("system.something_going_wrong_please_try_again")
				});
			}

			/** Get order item list **/
			let orderItems = await this.orderItemDB.find({order_id : orderId }).toArray();

			let customerId	 =	orderResult?.customer_id || '';
			let restaurantId =	orderResult?.restaurant_id || '';
			let areaId		 =	orderResult?.area_id || '';
			let branchId	 =	orderResult?.branch_id || '';
			let cartId		 =	orderResult?.cart_id || '';
			let deviceId	 =	orderId+(customerId || orderResult?.device_id || '');

			if(!req.body) req.body = {};
			req.body.device_id	=	deviceId;
			let responseCount = await this.cartAPI.getCartCount(req,res,next);
			if(responseCount.status != Constants.STATUS_SUCCESS) return next(responseCount);

			/** Send error response if item not found */
			if(!orderItems?.length) return res.send({status: Constants.STATUS_ERROR, message: __('admin.order.item_not_available') });

			asyncEach(orderItems,(records, asyncEachCallback)=>{
				let itemId			=	records?.item_id || '';
				let itemUnitId		=	records?.item_unit_id || '';
				let qty				=	records?.qty || '';
				let unitId			=	records?.unit_id || '';
				let doughId			=	records?.dough_id || '';
				let itemType		=	records?.item_type || '';
				let price			=	records?.price || '';
				let subTotal		=	records?.sub_total || '';
				let discountedPrice	=	records?.discounted_price || '';
				let netAmount		=	records?.net_amount || '';

				let orderItemsPush = {
					is_admin		: true,
					order_id		: orderId,
					item_unit_id	: itemUnitId,
					device_id		: deviceId,
					cart_id			: cartId,
					restaurant_id	: restaurantId,
					branch_id		: branchId,
					area_id			: areaId,
					qty				: qty,
					item_id			: itemId,
					unit_id			: unitId,
					dough_id		: doughId,
					item_type		: itemType,
					price         	: price,
					sub_total    	: subTotal,
					discounted_price: discountedPrice,
					net_amount    	: netAmount
				}

				/**Half And Half Type Item Add In Cart**/
				if(itemType == Constants.HALF_AND_HALF_ITEM){
					let unitLists	 = records?.unit_lists || [];
					let unitExtraIds = [];

					if(unitLists.length >0){
						unitLists.map(unitRecords=>{
							let selectorId		= (unitRecords.selector_id)	? unitRecords.selector_id	:"";
							let extraItems		= (unitRecords.extra_items)	? unitRecords.extra_items	:[];
							let extraIds = [];
							if(extraItems.length >0){
								extraItems.map(extraRecord=>{
									let tmpExtraItem 	=	[];
									let groupId			=	extraRecord.group_id;
									let extraItemIds	=	extraRecord.extra_item_ids;
									if(extraItemIds.length > 0 ){
										extraItemIds.map(extraIdRecord=>{
											tmpExtraItem.push({
												extra_item_id 		: extraIdRecord.extra_item_id,
												extra_group_item_id : extraIdRecord.extra_group_item_id,
											});
										});
									}
									if(tmpExtraItem.length >0){
										extraIds.push({
											group_id 		:	groupId,
											extra_item_ids 	: 	tmpExtraItem,
										});
									}
								});
							}
							if(extraIds.length >0){
								unitExtraIds.push({
									selector_id		:	selectorId,
									extra_items		: 	extraIds,
								});
							}
						});
					}

					orderItemsPush = {...orderItemsPush, ...{
						unit_lists : unitExtraIds
					}};

				}else if(itemType == Constants.DEAL_ITEM){
					/**Deal Type Item Add In Cart**/
					let dealUnitLists	=	records?.unit_lists || [];
					let extraItems	 	=	records?.extra_items || [];

					let extraIds = [];
					if(extraItems.length >0){
						extraItems.map(extraRecord=>{
							let tmpExtraItem =[];
							let groupId		=	extraRecord.group_id;
							if(extraRecord.extra_item_id){
								tmpExtraItem.push({
									extra_item_id 		: extraRecord.extra_item_id,
									extra_group_item_id : extraRecord.extra_item_group_id,
								});
							}
							if(tmpExtraItem.length >0){
								extraIds.push({
									group_id 		:	groupId,
									extra_item_ids 	: 	tmpExtraItem,
								});
							}
						});
					}

					let dealUnitExtraIds = [];
					if(dealUnitLists.length >0){
						dealUnitLists.map(dealUnitRecords=>{
							let unitId			= (dealUnitRecords.unit_id)	? dealUnitRecords.unit_id	:"";
							let itemUnitId		= (dealUnitRecords.item_unit_id) ? dealUnitRecords.item_unit_id	:"";
							let doughId			= (dealUnitRecords.dough_id)	? dealUnitRecords.dough_id	:"";
							let selectorId		= (dealUnitRecords.selector_id)	? dealUnitRecords.selector_id	:"";
							let dealExtraItems		= (dealUnitRecords.extra_items)	? dealUnitRecords.extra_items :[];
							let dealExtraIds = [];
							if(dealExtraItems.length >0){
								dealExtraItems.map(extraRecord=>{
									let tmpExtraItem 	=	[];
									let groupId			=	extraRecord.group_id;
									let dealExtraItemIds			=	extraRecord.extra_item_ids;
									if(dealExtraItemIds.length > 0 ){
										dealExtraItemIds.map(extraIdRecord=>{
											tmpExtraItem.push({
												extra_item_id 		: extraIdRecord.extra_item_id,
												extra_group_item_id : extraIdRecord.extra_group_item_id,
											});
										});
									}
									if(tmpExtraItem.length >0){
										dealExtraIds.push({
											group_id 		:	groupId,
											extra_item_ids 	: 	tmpExtraItem,
										});
									}
								});
							}

							if(dealExtraIds.length >0){
								dealUnitExtraIds.push({
									unit_id			:	unitId,
									item_unit_id	:	itemUnitId,
									dough_id		:	doughId,
									selector_id		:	selectorId,
									extra_items		: 	dealExtraIds,
								});
							}
						});
					}

					orderItemsPush = {...orderItemsPush, ...{
						unit_lists : dealUnitExtraIds,
						extra_items : extraIds,
					}};

				}else{
					let selectorId	=	records?.selector_id || '';
					let extraItems	=	records?.extra_items || '';
					let extraIds 	=	[];

					if(extraItems.length >0){
						extraItems.map(extraRecord=>{
							let tmpExtraItem =[];
							let groupId	=	extraRecord.group_id;
							if(extraRecord.extra_item_id){
								tmpExtraItem.push({
									extra_item_id 		: extraRecord.extra_item_id,
									extra_group_item_id : extraRecord.extra_item_group_id,
								});
							}
							if(tmpExtraItem.length >0){
								extraIds.push({
									group_id 		:	groupId,
									extra_item_ids 	: 	tmpExtraItem,
								});
							}
						});
					}

					orderItemsPush = {...orderItemsPush, ...{
						selector_id : selectorId,
						extra_items : extraIds,
					}};
				}

				if(!req.body) req.body = {};
				req.body =	orderItemsPush;
				this.cartAPI.updateCart(req,res,next).then(response=>{
					if(response.status != Constants.STATUS_SUCCESS) return asyncEachCallback(response.message);

					asyncEachCallback(null);
				}).catch(next);
			},(asyncEachErr)=>{

				/** Send response */
				res.send({
					status	: 	asyncEachErr && Constants.STATUS_ERROR || Constants.STATUS_SUCCESS,
					message	:	asyncEachErr
				});
			});
		}catch(err){return next(err); }
	}//addItemsCart()

	/**
	 * Function to apply offer promo code
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	*/
	async applyCoupon (req, res,next){
		try{
			if(Helpers.isPost(req)){
				/** Sanitize Data **/
				req.body		= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
				let offerCode 	= req?.body?.offer_code || "";
				let branchId 	= req?.body?.branch_id || "";
				let restaurantId= req?.body?.restaurant_id || "";
				let userId 		= req?.body?.user_id || "";
				let orderId		= req?.body?.order_id || "";

				/** Get detail of order **/
				let orderResult = await this.orderDB.findOne({
					_id : new ObjectId(orderId)
				},{projection: {
					_id:1,restaurant_id:1,customer_id:1,device_id:1
				}});

				/** If order not found then return error **/
				if(!orderResult){
					return res.send({
						status  : Constants.STATUS_ERROR,
						message : res.__("system.something_going_wrong_please_try_again")
					});
				}

				req.body.user_id		=	userId;
				req.body.main_device_id	=	orderResult?.device_id || "";
				req.body.order_id		=	orderId;
				req.body.branch_id		=	branchId;
				req.body.restaurant_id	=	restaurantId;
				req.body.offer_code		=	offerCode;
				this.offerAPI.checkOffer(req,res,next).then(response=>{
					res.send(response);
				}).catch(next);
			}
		}catch(err){return next(err); }
	};//placeOrders()

	/**
	 * Function to item add in cart from item detail section
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	*/
	async placeOrders (req, res,next){
		try{
			let authId	= req?.session?.user?._id || "";
			if(Helpers.isPost(req)){
				/** Sanitize Data **/
				req.body	 = Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
				let orderId  = req?.body?.order_id || "";
				let deviceId = req?.body?.device_id || "";

				/** Get detail of order **/
				let orderResult = await this.orderDB.findOne({
					_id : new ObjectId(orderId)
				},{projection: {
					_id:1,device_id:1,customer_id:1,paid_amount:1,order_price:1,is_guest:1,is_modified:1,payment_method:1,unique_order_id:1
				}});

				/** Get detail of order **/
				let orderDetailsResult = await this.orderDetailsDB.findOne({
					order_id : new ObjectId(orderId)
				},{projection: {
					_id:1,total_amount:1,paid_amount:1
				}});

				/** If order not found then return error **/
				if(!orderResult || !orderDetailsResult){
					let msg = res.__("system.something_going_wrong_please_try_again");
					req.flash(Constants.STATUS_ERROR,response.message);
					return res.send({ status  : Constants.STATUS_SUCCESS, message : msg });
				}

				let orderDeviceId		=	orderResult?.device_id || '';
				let orderCustomerId		=	orderResult?.customer_id || '';
				let isGuest				=	orderResult?.is_guest || '';
				let uniqueOrderId		=	orderResult?.unique_order_id ||'';
				let orderTotalAmount	=	orderResult?.paid_amount || orderResult?.order_price || 0;
				let totalPaidAmount 	= 	orderResult?.paid_amount || orderResult?.order_price || 0;
				let orderModified		=	orderResult?.is_modified || false;
				let paymentMethod		=	orderResult?.payment_method ||  "";

				if(orderModified){
					req.flash(Constants.STATUS_ERROR, res.__("admin.order.already_modify_orders"));
					return res.send({ status: Constants.STATUS_SUCCESS, message: res.__("system.invalid_access")});
				}

				req.body.customer_id	=	orderCustomerId;
				req.body.main_device_id	=	orderDeviceId;
				req.body.order_id		=	orderId;
				req.body.modified_by	=	authId;
				req.body.device_id		=	deviceId;

				this.orderAPI.placeModifierOrder(req,res,next).then(async response=>{
					if(response.status	!= Constants.STATUS_SUCCESS){
						req.flash(Constants.STATUS_ERROR,response.message);
						return res.send(response);
					}

					/** Check Order payment method is cash or amount is equal the previous amount */
					if(paymentMethod == Constants.CASH_PAYMENT || orderTotalAmount == response.grand_total){
						req.flash(Constants.STATUS_SUCCESS,response.message);
						return res.send(response);
					}

					/*Refund Amount Condition */
					refundDetail	=	[];
					if(orderTotalAmount > response.grand_total){
						let totalRefundAmount = (orderTotalAmount - response.grand_total);

						Helpers.callRefundAmount(req,res,next,{
							order_id				: 	orderId,
							user_id 				: 	orderCustomerId,
							device_id 				: 	orderDeviceId,
							is_guest				:	isGuest,
							total_refund			:	totalRefundAmount,
							total_amount			:	totalPaidAmount,
							unique_order_id			:	uniqueOrderId,
							refund_activity_type	:	REFUND_MODIFY_ORDER,
						}).then(fetchAmountResponse=>{
							if(fetchAmountResponse.message) req.flash(fetchAmountResponse.status,fetchAmountResponse.message);
							res.send(fetchAmountResponse);
						}).catch(next);

					}else if(orderTotalAmount < response.grand_total){
						totalPaidAmount	=	(response.grand_total - orderTotalAmount);

						/** update order details */
						await this.orderDB.updateOne({
							_id: new ObjectId(orderId)
						},{$set: {
							outstanding_amount	: totalPaidAmount,
							outstanding_payment : Constants.UNPAID
						}});

						/*************** Send Mail  ***************/
						sendMailToUsers(req,res,{
							event_type 			: Constants.NOTIFICATION_OVERSTANDING_PAYMENT_MODIFY_ORDER,
							order_id			: orderId,
							unique_order_id		: uniqueOrderId,
							amount				: Helpers.currencyFormat(totalPaidAmount),
							customer_id			: orderCustomerId,
						});

						if(response.message) req.flash(Constants.STATUS_SUCCESS,response.message);
						res.send(response);
					}
				}).catch(next);
			}
		}catch(err){return next(err); }
	};//placeOrders()
}
export default ModifyOrders;