import { ObjectId } from 'mongodb';
import clone from 'clone';
import { parallel as asyncParallel, each as asyncEach, eachOfSeries, forEachOf as asyncForEachOf } from 'async';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from '../../../../utils/index.mjs';

export default class UserCarts {
	constructor(db) {
		this.db = db;
	}

	/**
	 * Function to update cart
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	updateCart(req, res, next) {
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 		= Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let cartId  	= (req.body.cart_id) 		? new ObjectId(req.body.cart_id) 		:"";
			let userId  	= (req.body.user_id) 		? new ObjectId(req.body.user_id) 		:"";
			let deviceId	= (req.body.device_id) 		? req.body.device_id 		 		:"";
			let restaurantId= (req.body.restaurant_id) 	? new ObjectId(req.body.restaurant_id)	:"";
			let branchId	= (req.body.branch_id)	    ? new ObjectId(req.body.branch_id)		:"";
			let areaId		= (req.body.area_id)	    ? new ObjectId(req.body.area_id)		:"";
			let qty			= (req.body.qty)	    	? parseInt(req.body.qty)			:1;
			let itemId		= (req.body.item_id)		? new ObjectId(req.body.item_id)		:"";
			let unitId		= (req.body.unit_id)		? new ObjectId(req.body.unit_id)		:"";
			let itemUnitId	= (req.body.item_unit_id)	? new ObjectId(req.body.item_unit_id)	:"";
			let doughId		= (req.body.dough_id)		? new ObjectId(req.body.dough_id)		:"";
			let selectorId	= (req.body.selector_id)	? new ObjectId(req.body.selector_id)	:"";
			let itemType	= (req.body.item_type)		? req.body.item_type				:"";
			let offerId		= (req.body.offer_id)		? new ObjectId(req.body.offer_id)		:"";
			let extraItems	= (req.body.extra_items)	? req.body.extra_items				:[];
			let unitLists	= (req.body.unit_lists)		? req.body.unit_lists				:[];
			let note		= (req.body.note)			? req.body.note						:"";
			let orderId		= (req.body.order_id)		? new ObjectId(req.body.order_id)		:"";
			let isAdmin		= (req.body.is_admin)		? JSON.parse(req.body.is_admin)		:false;
			let maxModifiedTime= (req.body.max_modified_time) ? req.body.max_modified_time	:"";
			let addByAdmin	= (req.body.add_by_admin) ? req.body.add_by_admin	:false;

			/** Check extra items */
			let missingParameter = false;
			if(extraItems.length>0){
				extraItems.map(extraItem=>{
					if(!extraItem.group_id || !extraItem.extra_item_ids || extraItem.extra_item_ids.length <=0) missingParameter = true;

					if(extraItem.extra_item_ids && extraItem.extra_item_ids.length >0){
						extraItem.extra_item_ids.map(records=>{
							if(!records.extra_item_id || !records.extra_group_item_id) missingParameter = true;

							if(extraItem.group_id) extraItem.group_id	    = new ObjectId(extraItem.group_id);

							if(records.extra_item_id) records.extra_item_id = new ObjectId(records.extra_item_id);

							if(records.extra_group_item_id) records.extra_group_item_id =  new ObjectId(records.extra_group_item_id);
						});
					}
				});
			}

			/** Check deal extra items */
			let doughMissingParameter 	 = false;
			let selectorMissingParameter = false;
			let pizzaMissingParameter 	 = false;
			if(itemType == Constants.DEAL_ITEM || itemType == Constants.HALF_AND_HALF_ITEM){
				let isDealItem = (itemType == Constants.DEAL_ITEM) 			? true :false;
				let isHalfItem = (itemType == Constants.HALF_AND_HALF_ITEM) 	? true :false;
				if(isHalfItem && unitLists.length <=0) pizzaMissingParameter = true;

				if(isHalfItem && (!unitId || !doughId || !itemUnitId)) doughMissingParameter = true;

				if(!pizzaMissingParameter){
					unitLists.map(data=>{
						if(isHalfItem && !data.selector_id)  		selectorMissingParameter= true;

						if(isHalfItem && (!data.extra_items || data.extra_items.length <=0)){
							pizzaMissingParameter = true;
						}

						if(!pizzaMissingParameter && data.extra_items && data.extra_items.length>0){
							data.extra_items.map(extraItem=>{
								if(!extraItem.group_id || !extraItem.extra_item_ids || extraItem.extra_item_ids.length <=0) pizzaMissingParameter = true;

								if(extraItem.extra_item_ids && extraItem.extra_item_ids.length >0){
									extraItem.extra_item_ids.map(records=>{
										if(!records.extra_item_id || !records.extra_group_item_id) pizzaMissingParameter = true;

										if(extraItem.group_id) extraItem.group_id	    = new ObjectId(extraItem.group_id);

										if(records.extra_item_id) records.extra_item_id = new ObjectId(records.extra_item_id);

										if(records.extra_group_item_id) records.extra_group_item_id =  new ObjectId(records.extra_group_item_id);
									});
								}
							});
						}

						/** Convert into object id */
						if(data.unit_id) 		data.unit_id 		=	new ObjectId(data.unit_id);
						if(data.dough_id) 		data.dough_id 		=	new ObjectId(data.dough_id);
						if(data.item_unit_id)	data.item_unit_id 	= 	new ObjectId(data.item_unit_id);
						if(data.selector_id) 	data.selector_id 	= 	new ObjectId(data.selector_id);
					});
				}
			}

			/** Send error response **/
			if(missingParameter || (!userId && !deviceId) || !restaurantId || !branchId || !areaId || !itemId || (!itemUnitId && (doughId || selectorId))) return resolve({status : Constants.STATUS_ERROR, message : res.__("system.missing_parameters")});

			/** Send error response **/
			if(doughMissingParameter) return resolve({status : Constants.STATUS_ERROR, message : res.__("user_carts.you_should_select_dough") });
			if(selectorMissingParameter) return resolve({status : Constants.STATUS_ERROR, message : res.__("user_carts.you_should_select_selector") });
			if(pizzaMissingParameter) return resolve({status : Constants.STATUS_ERROR, message : res.__("user_carts.you_should_select_extras") });

			const users 				= this.db.collection(Tables.USERS);
			const items 				= this.db.collection(Tables.ITEMS);
			const user_carts 			= this.db.collection(Tables.USER_CARTS);
			const item_units 			= this.db.collection(Tables.ITEM_UNITS);
			const restaurants 			= this.db.collection(Tables.RESTAURANTS);
			const item_dough_units 		= this.db.collection(Tables.ITEM_DOUGH_UNITS);
			const item_group_extras     = this.db.collection(Tables.ITEM_GROUP_EXTRAS);
			const item_extra_masters    = this.db.collection(Tables.ITEM_EXTRA_MASTERS);
			const restaurant_branches 	= this.db.collection(Tables.RESTAURANT_BRANCHES);
			const item_selector_units 	= this.db.collection(Tables.ITEM_SELECTOR_UNITS);
			const item_choices_groups   = this.db.collection(Tables.ITEM_CHOICES_GROUPS);
			const restaurant_branch_areas   = this.db.collection(Tables.RESTAURANT_BRANCH_AREAS);

			asyncParallel({
				user_details : (callback)=>{
					if(!userId) return callback(null,1);

					/** Find user record using user id **/
					users.countDocuments({
						_id 		: userId,
						is_deleted  : Constants.NOT_DELETED,
						active      : Constants.ACTIVE
					}).then((userResult) => callback(null, userResult)).catch(callback);
				},
				restaurant_details : (callback)=>{
					/** Find restaurant record using restaurant id **/
					restaurants.countDocuments({
						_id 	   	: restaurantId,
						is_deleted	: Constants.NOT_DELETED,
						status		: Constants.ACTIVE
					}).then((restaurantResult) => callback(null, restaurantResult)).catch(callback);
				},
				branch_details : (callback)=>{
					/** Find branch record using branch id **/
					restaurant_branches.countDocuments({
						_id 		  : branchId,
						restaurant_id : restaurantId,
						is_active	  : Constants.ACTIVE
					}).then((branchResult) => callback(null, branchResult)).catch(callback);
                },
                area_details : (callback)=>{
                    /** Get branch area details **/
                    restaurant_branch_areas.countDocuments({
                        branch_id 		: branchId,
                        area_id 		: areaId,
                        restaurant_id	: restaurantId,
                    }).then((areaResult) => callback(null, areaResult)).catch(callback);
                },
				item_details : (callback)=>{
					/** Find item record using item id**/
					items.countDocuments({
						_id 		  : itemId,
						restaurant_id : restaurantId,
						is_active	  : Constants.ACTIVE
					}).then((itemResult) => callback(null, itemResult)).catch(callback);
				},
				unit_details : (callback)=>{
					if(!unitId) return callback(null,1);

					/** Find item unit record using unit id**/
					item_units.countDocuments({
						item_unit_id : unitId,
						item_id 	 : itemId,
						status	     : Constants.ACTIVE
					}).then((unitResult) => callback(null, unitResult)).catch(callback);
				},
				dough_details : (callback)=>{
					if(!doughId) return callback(null,1);

					/** Find item dough units record using dough id **/
					item_dough_units.countDocuments({
						_id			 : doughId,
						parents 	 : { $in: [itemUnitId]},
						item_id 	 : itemId,
						restaurant_id: restaurantId,
						status		 : Constants.ACTIVE
					}).then((doughResult) => callback(null, doughResult)).catch(callback);
				},
				selector_details : (callback)=>{
					if(!selectorId) return callback(null,1);

					/** Find item selector units record using selector id **/
					item_selector_units.countDocuments({
						_id			       : selectorId,
						parents 	       : { $in: [itemUnitId]},
						item_id 	 	   : itemId,
						restaurant_id	   : restaurantId,
						status		 	   : Constants.ACTIVE,
						dough_type_parents : { $in: [doughId]},
					}).then((selectorResult) => callback(null, selectorResult)).catch(callback);
				},
				extra_items_details : (callback)=>{
					let isCorrectGroup = true;
					if(!extraItems || extraItems.length <= 0 ) return callback(null,isCorrectGroup);

					/** Find extra items multiple record **/
					asyncEach(extraItems, (records, eachCallback)=> {

						asyncParallel({
							group_id: (groupCallback)=>{
								/** Find item choices groups record using group id **/
								item_choices_groups.countDocuments({
									_id			  : records.group_id,
									item_id 	  : itemId,
									restaurant_id : restaurantId
								}).then((itemChoicesGroupsResult) => groupCallback(null, itemChoicesGroupsResult)).catch(groupCallback);
							},
							extra_item_details: (extraItemCallback)=>{
								asyncEach(records.extra_item_ids, (extraItemRecords, childEachCallback)=> {
									asyncParallel({
										extra_item_id: (childCallback)=>{
											/** Find item extra items record using extra item id **/
											item_extra_masters.countDocuments({
												_id			 : extraItemRecords.extra_item_id,
												item_id 	 : itemId,
												restaurant_id: restaurantId
											}).then((itemExtraMastersResult) => childCallback(null, itemExtraMastersResult)).catch(childCallback);
										},
										extra_group_item_id: (childCallback)=>{
											/** Find item group extras record using extra group item id **/
											item_group_extras.countDocuments({
												_id				: extraItemRecords.extra_group_item_id,
												group_id		: records.group_id,
												item_extra_id	: extraItemRecords.extra_item_id,
												item_id 		: itemId
											}).then((itemGroupExtrasResult) => childCallback(null, itemGroupExtrasResult)).catch(childCallback);
										},
									},(childAsyncErr,childAsyncResponse)=>{
										if(!childAsyncErr && (!childAsyncResponse.extra_item_id || !childAsyncResponse.extra_group_item_id)) isCorrectGroup = false;

										childEachCallback(childAsyncErr);
									});
								},(childEachErr)=> {
									extraItemCallback(childEachErr,null);
								});
							},
						},(asyncGroupErr,asyncGroupResponse)=>{
							if(!asyncGroupErr && !asyncGroupResponse.group_id) isCorrectGroup = false;

							eachCallback(asyncGroupErr);
						});
					},(eachErr)=> {
						callback(eachErr,isCorrectGroup);
					});
				},
				offer_details : (callback)=>{
					callback(null,1);
				},
				cart_details : (callback)=>{
					if(cartId || !isAdmin) return callback(null,null);

					/** Set cart conditions */
					let cartConditions = {
						restaurant_id	:	restaurantId,
						branch_id		:	branchId,
						item_id			:	itemId,
					};

					if(userId){
						cartConditions.customer_id  = userId;
					}else{
						cartConditions.device_id 	= deviceId;
					}

					/** Get cart details */
					user_carts.findOne(cartConditions, { projection: { _id: 1 } })
						.then((cartResult) => {
							if (cartResult) cartId = cartResult._id;
							callback(null, cartResult);
						})
						.catch(callback);
				},
				cart_item_details : (callback)=>{
					if(!cartId || !orderId) return callback(null,null);

					/** Get cart details */
					user_carts.findOne({ _id: cartId }, { projection: { extra_items: 1 } })
						.then((cartItemResult) => {
							if (!cartItemResult || !cartItemResult.extra_items || cartItemResult.extra_items.length === 0) {
								return callback(null, null);
							}
							let cartExtraItemObject = {};
							cartItemResult.extra_items.forEach(data => {
								if (data.extra_item_ids && data.extra_item_ids.length > 0) {
									if (!cartExtraItemObject[data.group_id]) cartExtraItemObject[data.group_id] = {};
									data.extra_item_ids.forEach(items => {
										cartExtraItemObject[data.group_id][items.extra_group_item_id] = true;
									});
								}
							});
							callback(null, cartExtraItemObject);
						})
						.catch(callback);
				},
				all_extra_details : (callback)=>{
					/** Set conditions */
					let itemGroupConditions = {
						item_id				: 	itemId,
						is_auto_selected	:	{$exists : false}
					};

					/** Get link group list  */
					item_group_extras.aggregate([
						{$match:	itemGroupConditions},
						{$lookup:	{
							from     : Tables.ITEM_UNITS,
							let      : {unitId : "$unit_id"},
							pipeline : [
								{$match : {
									$expr: {
										$and : [
											{$eq: ["$item_unit_id", "$$unitId"]},
											{$eq: ["$item_id", itemId]},
										]
									}
								}},
							],
							as:	"units_list"
						}},
						{$match : {
							$or : [
								{"units_list.0" 	: {$exists: false}},
								{"units_list.status": Constants.ACTIVE},
							]
						}},
						{$lookup:	{
							from     : Tables.ITEM_EXTRA_MASTERS,
							let      : {itemExtraId : "$item_extra_id"},
							pipeline : [
								{$match : {
									$expr: {
										$and : [
											{$eq: ["$_id", "$$itemExtraId"]},
											{$eq: ["$is_active", Constants.ACTIVE]},
										]
									}
								}},
							],
							as:	"extra_item_detail"
						}},
						{$match: {
							"extra_item_detail._id" : {$exists: true}
						}},
						{$group: {
							_id 		: 	null,
							group_id	:	{$push: "$group_id"},
						}},
					]).toArray()
						.then((groupExResult) => {
							if (groupExResult.length <= 0) return callback(null, null);

							let tmpGroupIds = (groupExResult && groupExResult[0]) ? groupExResult[0].group_id : [];
							return item_choices_groups.find({ _id : { $in: tmpGroupIds }, item_id : itemId }, { projection: { max_quantity: 1, min_quantity: 1, is_choice: 1 } }).toArray();
						})
						.then((groupResult) => {
							if (!groupResult || groupResult.length <= 0) return callback(null, null);

							let extraItemObj = {};
							let extraRequiredCount = 0;
							groupResult.forEach(records => {
								if (records.min_quantity > 0) {
									let tmpMinQty = records.min_quantity;
									if (itemType == Constants.HALF_AND_HALF_ITEM && records.is_choice) tmpMinQty += tmpMinQty;
									extraItemObj[records._id] = tmpMinQty;
									extraRequiredCount += tmpMinQty;
								}
							});
							callback(null, { required_group_details : extraItemObj, required_extra_count : extraRequiredCount });
						})
						.catch(callback);
				},
				valid_conditions_item : (callback)=>{
					/** Find item  details **/
					items.findOne({
						_id 		  : itemId,
						restaurant_id : restaurantId,
						is_active	  : Constants.ACTIVE
					},{projection: {item_type: 1, no_of_components: 1, no_of_duplicate: 1 }})
						.then((itemResult) => {
						if(!itemResult) return callback(null, true);

						let tmpItemType 	= 	itemResult.item_type;
						let noOfComponents 	= 	itemResult.no_of_components;
						let noOfDuplicate 	=	itemResult.no_of_duplicate;

						if(tmpItemType != Constants.DEAL_ITEM && tmpItemType != Constants.HALF_AND_HALF_ITEM){
							return callback(null, true);
						}

						itemType		=	tmpItemType;
						let isDealItem	=	(tmpItemType == Constants.DEAL_ITEM) 			? true :false;
						let isHalfItem 	= 	(tmpItemType == Constants.HALF_AND_HALF_ITEM) ? true :false;

						if(isDealItem && !noOfComponents) return callback(null, true);

						if(unitLists.length<=0 || ((isHalfItem && unitLists.length < noOfDuplicate) && (isDealItem && unitLists.length < noOfComponents))){
							return callback(null, false);
						}

						let validAllOverItem = 	true;
						let validItemGroup	 = 	true;
						asyncEach(unitLists, (data, eachCallback)=> {
							let tmpUnitId 		= 	(data.unit_id) 		?	new ObjectId(data.unit_id)     :"";
							let tmpDoughId 		=	(data.dough_id) 	? 	new ObjectId(data.dough_id)    :"";
							let tmpItemUnitId 	= 	(data.item_unit_id) ? 	new ObjectId(data.item_unit_id):"";
							let tmpSelectorId 	= 	(data.selector_id) 	? 	new ObjectId(data.selector_id) :"";

							asyncParallel({
								valid_unit : (firstParallelCallback)=>{
									if(isHalfItem) return firstParallelCallback(null,true);

									item_units.countDocuments({
										item_unit_id : tmpUnitId,
										item_id 	 : itemId,
										status	     : Constants.ACTIVE
									}).then((unitResult) => firstParallelCallback(null, unitResult)).catch(firstParallelCallback);
								},
								valid_dough: (firstParallelCallback)=>{
									if(isHalfItem) return firstParallelCallback(null,true);

									item_dough_units.countDocuments({
										_id			 : tmpDoughId,
										parents 	 : { $in: [tmpItemUnitId]},
										item_id 	 : itemId,
										restaurant_id: restaurantId,
										status		 : Constants.ACTIVE
									}).then((doughResult) => firstParallelCallback(null, doughResult)).catch(firstParallelCallback);
								},
								valid_selector: (firstParallelCallback)=>{
									let selectorItemUnitId	= (isHalfItem) ? itemUnitId	:tmpItemUnitId;
									let selectorDoughId 	= (isHalfItem) ? doughId 	:tmpDoughId;

									item_selector_units.countDocuments({
										_id			       : tmpSelectorId,
										parents 	       : {$in: [selectorItemUnitId]},
										item_id 	 	   : itemId,
										restaurant_id	   : restaurantId,
										status		 	   : Constants.ACTIVE,
										dough_type_parents : {$in: [selectorDoughId]},
									}).then((selectorResult) => firstParallelCallback(null, selectorResult)).catch(firstParallelCallback);
								},
							},(asyncFirstErr,asyncFirstResponse)=>{
								if(asyncFirstErr) return eachCallback(asyncFirstErr);

								if(!asyncFirstResponse.valid_unit || !asyncFirstResponse.valid_dough || !asyncFirstResponse.valid_selector){
									validAllOverItem = false;
								}

								if(!validAllOverItem || !data.extra_items || data.extra_items.length <=0) return eachCallback(null);

								asyncEach(data.extra_items, (records, eachSubCallback)=> {
									let groupId = (records.group_id) ? new ObjectId(records.group_id) :"";

									asyncParallel({
										group_id: (groupCallback)=>{
											item_choices_groups.countDocuments({
												_id			  : groupId,
												item_id 	  : itemId,
												restaurant_id : restaurantId
											}).then((groupsResult) => groupCallback(null, groupsResult)).catch(groupCallback);
										},
										extra_item_details: (extraItemCallback)=>{
											asyncEach(records.extra_item_ids, (extraItemRecords, childEachCallback)=> {
												let extraItemId  = (extraItemRecords.extra_item_id) ? new ObjectId(extraItemRecords.extra_item_id) :"";
												let extraGroupId = (extraItemRecords.extra_group_item_id) ? new ObjectId(extraItemRecords.extra_group_item_id) :"";

												asyncParallel({
													extra_item_id: (childCallback)=>{
														item_extra_masters.countDocuments({
															_id			 : extraItemId,
															item_id 	 : itemId,
															restaurant_id: restaurantId
														}).then((extraResult) => childCallback(null, extraResult)).catch(childCallback);
													},
													extra_group_item_id: (childCallback)=>{
														item_group_extras.countDocuments({
															_id				: extraGroupId,
															group_id		: groupId,
															item_extra_id	: extraItemId,
															item_id 		: itemId
														}).then((groupExtraResult) => childCallback(null, groupExtraResult)).catch(childCallback);
													},
												},(childErr,childResponse)=>{
													if(childErr) return childEachCallback(childErr);

													if(!childResponse.extra_item_id || !childResponse.extra_group_item_id){
														validItemGroup = false;
													}
													childEachCallback(null);
												});
											},(childEachErr)=> {
												extraItemCallback(childEachErr,null);
											});
										},
									},(asyncGroupErr,asyncGroupResponse)=>{
										if(asyncGroupErr) return eachSubCallback(asyncGroupErr);

										if(!asyncGroupResponse.group_id) validItemGroup = false;

										eachSubCallback(null);
									});
								},(eachSubErr)=> {
									eachCallback(eachSubErr);
								});
							});
						},(eachErr)=> {
							let isValid =  (validAllOverItem && validItemGroup) ? true:false;
							callback(eachErr,isValid);
						});
					}).catch(callback);
				},
				total_orders : (callback)=>{
					if(userId || orderId) return callback(null,0);

					/** Get order count  */
					const orders = this.db.collection(Tables.ORDERS);
					orders.countDocuments({ device_id: deviceId }).then((orderCount) => callback(null, orderCount)).catch(callback);
				},
				delete_other_restaurant_modified_orders : (callback)=>{
					let cartConditions = {
						restaurant_id:	{$ne : restaurantId},
						order_id	 :  {$exists : true}
					};
					if(userId) cartConditions.customer_id = userId;
					else cartConditions.device_id = deviceId;

					user_carts.deleteMany(cartConditions).then(() => callback(null)).catch(callback);
				},
				guest_have_modified_order : (callback)=>{
					if(userId || orderId) return callback(null,false);

					let cartConditions = {
						restaurant_id:	restaurantId,
						order_id	 :  {$exists : true}
					};
					if(userId) cartConditions.customer_id = userId;
					else cartConditions.device_id = deviceId;

					user_carts.countDocuments(cartConditions).then((orderCount) => callback(null, orderCount)).catch(callback);
				},
				autoselect_combo_items : (callback)=>{
					items.findOne({
						_id 		  : itemId,
						is_active	  : Constants.ACTIVE,
						item_type	  : Constants.COMBO_ITEM,
						restaurant_id : restaurantId,
					},{projection: {_id: 1}})
						.then((itemResult) => {
							if(!itemResult) return callback(null, itemResult);

							asyncParallel({
								unit_id : (childCallback)=>{
									if(unitId) return childCallback(null,unitId);

									item_units.findOne({
										item_id 		 : itemId,
										is_auto_selected : true
									},{projection: {_id: 1,item_unit_id: 1}})
										.then((unitResult) => {
											let tmpUnitId = (unitResult) ? unitResult.item_unit_id : "";
											childCallback(null, tmpUnitId);
										})
										.catch(childCallback);
								},
							},(childErr, childResponse)=>{
								if(childErr || !childResponse.unit_id) return callback(childErr,null);

								let tmpUnitId = childResponse.unit_id;

								item_group_extras.aggregate([
									{$match: 	{
										item_id 		 	: 	itemId,
										unit_id 			: 	tmpUnitId,
										is_auto_selected 	:	true
									}},
									{$lookup: {
										from 		: 	Tables.ITEM_EXTRA_MASTERS,
										localField 	:	"item_extra_id",
										foreignField: 	"_id",
										as 			: 	"extra_item_detail"
									}},
									{$addFields : {
										extra_fees : {$ifNull: [ "$extra_fees", {$arrayElemAt: ["$extra_item_detail.extra_fees",0]} ] },
									}},
									{$sort  : {group_id: Constants.SORT_ASC, extra_fees: Constants.SORT_ASC }},
									{$group	: {
										_id			 		: "$group_id",
										group_id			: {$first : "$group_id"},
										item_extra_id		: {$first : "$item_extra_id"},
										extra_group_item_id	: {$first : "$_id"},
									}},
								]).toArray()
									.then((exItemResult) => {
										if(exItemResult.length <= 0) return callback(null, null);

										let tmpExList = {};
										exItemResult.forEach(tmpData =>{
											let tmpGroupId 		= 	tmpData.group_id;
											let tmpGroupExId 	= 	tmpData.extra_group_item_id;
											let tmpItemExtraId 	=	tmpData.item_extra_id;

											if(!tmpExList[tmpGroupId]){
												tmpExList[tmpGroupId] = { group_id : tmpGroupId, extra_item_ids : [] };
											}
											tmpExList[tmpGroupId].extra_item_ids.push({
												extra_item_id 		: tmpItemExtraId,
												extra_group_item_id : tmpGroupExId,
											});
										});

										callback(null, { unit_id : tmpUnitId, extra_items : Object.values(tmpExList) });
									})
									.catch(callback);
							});
						})
						.catch(callback);
				},
				delete_other_area_cart_items : (callback)=>{
					if(!areaId) return callback(null);

					let cartConditions = { area_id: {$ne: areaId} };
					if(userId) cartConditions.customer_id = userId;
					else cartConditions.device_id = deviceId;

					user_carts.deleteMany(cartConditions).then(() => callback(null)).catch(callback);
				},
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				let validConditionsItem = (asyncResponse.valid_conditions_item) ? asyncResponse.valid_conditions_item : false;
				let userDetails 		= (asyncResponse.user_details) 		 ? asyncResponse.user_details 	    :0;
				let restaurantDetails 	= (asyncResponse.restaurant_details) ? asyncResponse.restaurant_details :0;
				let branchDetails 	 	= (asyncResponse.branch_details) 	 ? asyncResponse.branch_details 	:0;
				let areaDetails 	 	= (asyncResponse.area_details) 	 	 ? asyncResponse.area_details 	:0;
				let itemDetails 		= (asyncResponse.item_details) 		 ? asyncResponse.item_details 	    :0;
				let unitDetails		 	= (asyncResponse.unit_details) 		 ? asyncResponse.unit_details 	    :0;
				let doughDetails 	 	= (asyncResponse.dough_details) 	 ? asyncResponse.dough_details 	    :0;
				let selectorDetails 	= (asyncResponse.selector_details) 	 ? asyncResponse.selector_details   :0;
				let offerDetails 	 	= (asyncResponse.offer_details) 	 ? asyncResponse.offer_details      :0;
				let extraItemsDetails 	= (asyncResponse.extra_items_details)? asyncResponse.extra_items_details:false;
				let allExtraDetails 	= (asyncResponse.all_extra_details)	? asyncResponse.all_extra_details	:"";
				let cartItemDetails 	= (asyncResponse.cart_item_details)	? asyncResponse.cart_item_details	:"";

				/** Send error response if user id,restaurant id, branch id, item id, unit id, dough id, selector id, offer id is not valid **/
				if(!validConditionsItem || userDetails == 0 || restaurantDetails == 0 || branchDetails == 0 || areaDetails ==0 || itemDetails == 0 || unitDetails == 0 || doughDetails == 0 || selectorDetails == 0 || offerDetails == 0 || !extraItemsDetails){
					let returnResponse = {
						status 	: 	Constants.STATUS_ERROR,
						message	:	res.__("system.something_going_wrong_please_try_again")
					};

					if(userDetails == 0) 		returnResponse.vaild_user_id 		= true;
					if(restaurantDetails == 0) 	returnResponse.vaild_restaurant_id 	= true;
					if(branchDetails == 0)		returnResponse.vaild_branch_id 		= true;
					if(itemDetails == 0) 		returnResponse.vaild_item_id 		= true;
					if(unitDetails == 0) 		returnResponse.vaild_unit_id 		= true;
					if(doughDetails == 0)	 	returnResponse.vaild_dough_id 		= true;
					if(selectorDetails == 0) 	returnResponse.vaild_selector_id 	= true;
					if(offerDetails == 0) 		returnResponse.vaild_offer_id 		= true;
					if(areaDetails == 0) 		returnResponse.vaild_area_id 		= true;
					if(!extraItemsDetails) 		returnResponse.vaild_extra_item 	= true;
					if(!validConditionsItem) 	returnResponse.vaild_conditions_item = true;

					return resolve(returnResponse);
				}

				/** Send error response */
				if(allExtraDetails && allExtraDetails.required_extra_count && allExtraDetails.required_extra_count >0){
					if(extraItems.length <=0 && unitLists.length <=0){
						return resolve({
							status 	: 	Constants.STATUS_ERROR,
							message	:	res.__("user_carts.you_should_select_extras")
						});
					}

					let requiredGroupDetails	= 	allExtraDetails.required_group_details;
					let requiredExtraCount 		=	allExtraDetails.required_extra_count;
					let selectedExtraCount		= 	0;

					if(extraItems.length >0){
						extraItems.map(records=>{
							let tmpGroupId = records.group_id;
							if(requiredGroupDetails[tmpGroupId]){
								if(records.extra_item_ids.length > requiredGroupDetails[tmpGroupId]){
									selectedExtraCount += requiredGroupDetails[tmpGroupId]
								}else{
									selectedExtraCount += records.extra_item_ids.length;
								}
							}
						});
					}

					if(unitLists.length >0){
						unitLists.map(data=>{
							if(data.extra_items && data.extra_items.length >0){
								data.extra_items.map(records=>{
									let tmpGroupId = records.group_id;
									if(requiredGroupDetails[tmpGroupId]){
										if(records.extra_item_ids.length > requiredGroupDetails[tmpGroupId]){
											selectedExtraCount += requiredGroupDetails[tmpGroupId]
										}else{
											selectedExtraCount += records.extra_item_ids.length;
										}
									}
								});
							}
						});
					}

					if(requiredExtraCount > selectedExtraCount){
						return resolve({
							status 	: 	Constants.STATUS_ERROR,
							message	:	res.__("user_carts.you_should_select_extras")
						});
					}
				}

				/** Add auto select extra item (only in kfg combo items)  */
				if(asyncResponse.autoselect_combo_items){
					unitId 		= 	asyncResponse.autoselect_combo_items.unit_id;
					extraItems 	=	extraItems.concat(asyncResponse.autoselect_combo_items.extra_items);
				}

				if(cartId && orderId){
					if(extraItems.length >0 && cartItemDetails){
						extraItems.map(records=>{
							let tmpGroupId = records.group_id;
							if(records.extra_item_ids.length > 0){
								records.extra_item_ids.map(ids => {
									if(!cartItemDetails[tmpGroupId] || cartItemDetails[tmpGroupId][ids.extra_group_item_id]){
										addByAdmin=	true;
									}
								});
							}

							if(!addByAdmin && cartItemDetails[tmpGroupId] && records.extra_item_ids.length != Object.keys(cartItemDetails[tmpGroupId]).length){
								addByAdmin=	true;
							}
						});

						if(!addByAdmin && extraItems.length != Object.keys(cartItemDetails).length){
							addByAdmin=	true;
						}
					}else if(cartItemDetails || (!cartItemDetails && extraItems.length >0 )){
						addByAdmin=	true;
					}
				}

				/** Set update data */
				let updatedData = {
					qty				:	qty,
					restaurant_id	:	restaurantId,
                    branch_id		:	branchId,
                    area_id 		:   areaId,
					item_id			:	itemId,
					item_type		:	itemType,
					note			:	note,
					extra_items		:	extraItems,
					unit_lists		:	unitLists,
					modified 		: 	Helpers.getUtcDate()
				};

				if(unitId) 		updatedData.unit_id 	= unitId;
				if(doughId) 	updatedData.dough_id 	= doughId;
				if(selectorId) 	updatedData.selector_id = selectorId;
				if(offerId) 	updatedData.offer_id 	= offerId;
				if(itemUnitId) 	updatedData.item_unit_id= itemUnitId;
				if(orderId)		updatedData.order_id	= orderId;
				if(maxModifiedTime)	updatedData.max_modified_time 	= 	Helpers.getUtcDate(maxModifiedTime);
				if(req.body.device_type)  updatedData.device_type  	= 	req.body.device_type;
				if(req.body.device_token) updatedData.device_token 	=	req.body.device_token;
				if(addByAdmin) updatedData.add_by_admin 	=	addByAdmin;

				if(userId){
					updatedData.customer_id  = userId;
				}else{
					updatedData.device_id 	 = deviceId;
				}

				if(!cartId){
					cartId = new ObjectId();
					updatedData.last_qty	=	parseInt(qty);
				}

				/** Update cart details */
				user_carts.updateOne(
					{ _id : new ObjectId(cartId) },
					{
						$set: updatedData,
						$setOnInsert: { created : Helpers.getUtcDate() }
					},
					{ upsert: true }
				)
					.then(() => {
					asyncParallel({
						cart_details : (childCallback)=>{
							let cartOptions = {
								user_id 		: userId,
								device_id 		: deviceId,
								cart_total_only : true,
							};

							this.getUserCartList(req,res,next,cartOptions).then(cartResponse=>{
								if(cartResponse.status != Constants.STATUS_SUCCESS) return childCallback(cartResponse);
								childCallback(null,cartResponse);
							}).catch(next);
						},
						cart_count : (childCallback)=>{
							this.getCartCount(req,res,next).then(cartResponse=>{
								if(cartResponse.status != Constants.STATUS_SUCCESS) return childCallback(cartResponse);
								childCallback(null,cartResponse.count);
							}).catch(next);
						},
					},(asyncChildErr, asyncChildResponse)=>{
						if(asyncChildErr) return next(asyncChildErr);

						/** Send success response **/
						resolve({
							status			: Constants.STATUS_SUCCESS,
							cart_id 		: cartId,
							total_amount 	: asyncChildResponse.cart_details.grand_total,
							total_discount 	: asyncChildResponse.cart_details.total_discount,
							cart_count 		: asyncChildResponse.cart_count,
							message 		: res.__("user_carts.item_added_into_cart_successfully"),
						});
					});
				});
				}).catch(next);
        }).catch(next);
	} // end updateCart()

	/**
	 * Function to remove item form cart
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	removeCartItems(req, res, next) {
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 		=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
            let cartId		= 	(req.body.cart_id) 			?	new ObjectId(req.body.cart_id) 			:"";
            let userId		= 	(req.body.user_id) 			?	new ObjectId(req.body.user_id) 			:"";
			let deviceId	= 	(req.body.device_id)		?	req.body.device_id					:"";
			let restaurantId= 	(req.body.restaurant_id) 	?	new ObjectId(req.body.restaurant_id)	:"";
			let isDeleteAll	= 	(req.body.is_delete_all) 	?	JSON.parse(req.body.is_delete_all)	:"";

			/** Send error response **/
			if((!userId && !deviceId) || (!cartId && !restaurantId && !isDeleteAll)) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters")});

			/** Set cart conditions */
			let cartConditions = {};
			if(userId){
				cartConditions.customer_id 	= 	userId;
			}else{
				cartConditions.device_id	=	deviceId;
			}

			if(cartId) 			cartConditions._id 				=	cartId;
			if(restaurantId) 	cartConditions.restaurant_id 	=	restaurantId;

			/** Get cart count  */
			const user_carts = 	this.db.collection(Tables.USER_CARTS);
			user_carts.distinct("_id", cartConditions)
				.then((cartResult) => {
					/** Send error response */
					if (cartResult.length <= 0) return resolve({ status: Constants.STATUS_SUCCESS, message: res.__("user_carts.item_has_deleted_from_cart_successfully") });

					asyncParallel({
						remove_cart : (callback) => {
							user_carts.deleteMany({ _id: { $in: cartResult } }).then(() => callback(null)).catch(callback);
						},
						check_offer : (callback) => {
							let offerConditions = { cart_ids : { $in: cartResult } };
							if (userId) offerConditions.user_id = userId;
							else offerConditions.device_id = deviceId;

							const tmp_offer_logs = this.db.collection(Tables.TMP_OFFER_LOGS);
							tmp_offer_logs.find(offerConditions, { projection: { cart_ids: 1 } }).toArray()
								.then((offerResult) => {
									if (offerResult.length <= 0) return callback(null);

									let allCatrIds = [];
									offerResult.forEach(records => { allCatrIds = allCatrIds.concat(records.cart_ids); });

									const offer_logs = this.db.collection(Tables.OFFER_LOGS);
									asyncParallel({
										check_offer_logs : (subCallback) => {
											offer_logs.find({ cart_ids : { $in: allCatrIds } }, { projection: { cart_ids: 1, order_discount: 1, offer_id: 1 } }).toArray()
												.then((logResult) => {
													if (logResult.length <= 0) return subCallback(null);

													let allLogIds = [];
													let totalAmount = 0;
													logResult.forEach(records => {
														allLogIds.push(records._id);
														totalAmount += records.order_discount;
													});

													let usedConditions = { offer_log_ids : { $in : allLogIds } };
													if (userId) usedConditions.user_id = userId;
													else usedConditions.device_id = deviceId;
													const offer_used = this.db.collection(Tables.OFFER_USED);

													asyncParallel({
														remove_temp_offer_logs : (childCallback) => {
															tmp_offer_logs.deleteMany(offerConditions).then(() => childCallback(null)).catch(childCallback);
														},
														remove_offer_logs : (childCallback) => {
															offer_logs.deleteMany({ _id : { $in: allLogIds } }).then(() => childCallback(null)).catch(childCallback);
														},
														update_offer : (childCallback) => {
															offer_used.updateMany(usedConditions, {
																$set: { modified : Helpers.getUtcDate() },
																$inc : { offer_used : -1, total_amount_used : totalAmount * -1 },
																$pull : { offer_log_ids : { $in : allLogIds } }
															}).then(() => childCallback(null)).catch(childCallback);
														}
													}, (childParallelErr) => subCallback(childParallelErr));
												})
												.catch(subCallback);
										},
										remove_all_offer : (subCallback) => {
											if (restaurantId) return subCallback(null);
											user_carts.updateMany({ _id : { $in : allCatrIds } }, { $set: { modified : Helpers.getUtcDate() }, $unset : { offer_id : 1 } }).then(() => subCallback(null)).catch(subCallback);
										}
									}, (asyncSubErr) => callback(asyncSubErr));
								})
								.catch(callback);
						}
					}, (asyncErr) => {
						if (asyncErr) return next(asyncErr);
						resolve({ status: Constants.STATUS_SUCCESS, message: res.__("user_carts.item_has_deleted_from_cart_successfully") });
					});
				})
				.catch(next);
        }).catch(next);
	} // end removeCartItems()

	/**
	 * Function to get cart item count
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	getCartCount(req, res, next) {
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 	=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId	= 	(req.body.user_id)	?	new ObjectId(req.body.user_id)	:"";
			let deviceId= 	(req.body.device_id)?	req.body.device_id			:"";

			/** Send error response **/
			if(!userId && !deviceId) return resolve({status: Constants.STATUS_ERROR, message:res.__("system.missing_parameters")});

			/** Set cart conditions */
			let conditions = {
				$or : [
					{max_modified_time : {$exists: false}},
					{max_modified_time : {$gte: Helpers.newDate()}},
				]
			};
			if(userId){
				conditions.customer_id 	= 	userId;
			}else{
				conditions.device_id	=	deviceId;
			}

			/** Get cart count */
			const user_carts = 	this.db.collection(Tables.USER_CARTS);
			user_carts.aggregate([
				{$match : 	conditions},
				{$lookup:	{
					from     : Tables.ITEMS,
					let      : {itemId : "$item_id"},
					pipeline : [
						{$match : {
							$expr: {
								$and : [
									{$eq: ["$_id", "$$itemId"]},
									{$eq: ["$is_active", Constants.ACTIVE]},
								]
							}
						}},
						{$project : {_id: 1}},
					],
					as:	"item_details"
				}},
				{$match:{
					"item_details._id" : {$exists: true}
				}},
				{$count		: "count"},
			]).toArray()
				.then((cartResult) => {
					let cartCount = (cartResult && cartResult[0]) ? cartResult[0].count : 0;
					resolve({ status: Constants.STATUS_SUCCESS, count: cartCount });
				})
				.catch(next);
		}).catch(next);
	} // end getCartCount()

	/**
	 * Function to get cart item list
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	getCartList(req, res, next) {
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body = Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);

			/** Get user cart list */
			let cartOptions 	= clone(req.body);
			cartOptions.is_cart = true;
			this.getUserCartList(req,res,next,cartOptions).then(response=>{
				resolve(response);
			}).catch(next);
        }).catch(next);
	} // end getCartList()

	/**
	 * Function to get cart item list
	 *
	 * @param req		As Request Data
	 * @param res		As Response Data
	 * @param next		As Callback argument to the middleware function
	 * @param options	As object data
	 *
	 * @return json
	**/
	getUserCartList(req, res, next, options) {
		return new Promise(resolve=>{
			let userId					= 	(options.user_id)					?	new ObjectId(options.user_id)			:"";
            let deviceId				= 	(options.device_id)	 				?	options.device_id					:"";
			let isCart					= 	(options.is_cart)					?	options.is_cart						:"";
			let isPlaceOrder			= 	(options.is_place_order)			?	options.is_place_order				:"";
			let isCheckOffer			= 	(options.is_check_offer)			?	options.is_check_offer				:"";
			let branchId				= 	(options.branch_id) 				?	new ObjectId(options.branch_id)			:"";
			let restaurantId			= 	(options.restaurant_id)				?	new ObjectId(options.restaurant_id)		:"";
			let modifiedOrderId			=	(options.order_id)					?	new ObjectId(options.order_id)			:"";
			let cartTotalOnly 			= 	(options.cart_total_only)			?	options.cart_total_only				:false;
			let pickupBranchList		= 	(options.pickup_branch_list)		?	options.pickup_branch_list			:{};
			let isBranchAvailability	=	(options.is_branch_availability)	?	options.is_branch_availability		:"";
			let isPlaceModifiedOrder	= 	(options.is_place_modified_order)	?	options.is_place_modified_order		:"";
			let scheduledBranchList 	= 	(options.scheduled_branch_list)		? 	options.scheduled_branch_list 		:{};
			let restaurantOrderDetails 	=	(options.restaurant_order_details)	?	options.restaurant_order_details	:{};
			restaurantOrderDetails		=	{};

			/** Send error response **/
			if(!userId && !deviceId) return resolve({status: Constants.STATUS_ERROR, message:res.__("system.missing_parameters")});

			/** Set success response */
			let successResponse = {
				status: Constants.STATUS_SUCCESS, result: [], grand_total: 0, total_discount: 0, item_image_url: Constants.ITEMS_FILE_URL
			};

			if(isCart){
				successResponse.pick_restaurant_note = {
					en : (res.locals.settings["App.pick_restaurant_note"]) ? res.locals.settings["App.pick_restaurant_note"]	:"",
					ar : (res.locals.settings["App.pick_restaurant_note_in_arabic"]) ? res.locals.settings["App.pick_restaurant_note_in_arabic"] :"",
				};
			}

			const users 		= 	this.db.collection(Tables.USERS);
			const orders		= 	this.db.collection(Tables.ORDERS);
			const user_carts 	= 	this.db.collection(Tables.USER_CARTS);
			asyncParallel({
				corporate_details : (parentCallback)=>{
					if(!userId || (!isCart && !isPlaceOrder)) return parentCallback(null,null);

					let userConditions 			=	clone(Constants.CUSTOMER_COMMON_CONDITIONS);
					userConditions._id 			= 	userId;
					userConditions.corporate_id = 	{$exists : true};

					/** Get users details **/
					users.findOne(userConditions,{projection: {corporate_id: 1}})
						.then((userResult) => {
							if(!userResult) return parentCallback(null, userResult);
							let corporateId = userResult.corporate_id;
							const corporate_tie_ups = this.db.collection(Tables.CORPORATE_TIE_UPS);
							return corporate_tie_ups.findOne({ _id : corporateId },{projection: {discounts:1, free_delivery:1,minimum_order_amount:1,kfg_offer_id:1,kfg_offer_name:1}});
						})
						.then((corporateResult) => parentCallback(null, corporateResult))
						.catch(parentCallback);
				},
				public_composite_offers : (parentCallback)=>{
					if(!isCart && !isPlaceOrder) return parentCallback(null,null);

					const public_composite_offers = this.db.collection(Tables.PUBLIC_COMPOSITE_OFFERS);
					public_composite_offers.findOne(
						{ is_active : Constants.ACTIVE },
						{ projection: {free_delivery: 1, minimum_order_amount: 1, discounts:1,kfg_offer_id:1,kfg_offer_name:1}, sort: {_id: Constants.SORT_DESC} }
					).then((offerResult) => parentCallback(null, offerResult)).catch(parentCallback);
				},
				cart_list : (parentCallback)=>{
					/** Set cart conditions */
					let conditions = {};

					if(!isPlaceModifiedOrder){
						conditions = {
							$or : [
								{max_modified_time : {$exists: false}},
								{max_modified_time : {$gte: Helpers.newDate()}},
							]
						};
					}

					if(userId){
						conditions.customer_id 	= 	userId;
					}else{
						conditions.device_id	=	deviceId;
					}

					if(isCheckOffer){
						conditions.branch_id	 = branchId;
						conditions.restaurant_id = restaurantId;
					}

					if(isBranchAvailability){
						conditions.restaurant_id = restaurantId;
					}

					/** Get cart list */
					user_carts.aggregate([
						{$match : 	conditions},
						{$lookup:	{
							from     : Tables.ITEMS,
							let      : {itemId : "$item_id"},
							pipeline : [
								{$match : {
									$expr: {
										$and : [
											{$eq: ["$_id", "$$itemId"]},
											{$eq: ["$is_active", Constants.ACTIVE]},
										]
									}
								}},
								{$project : {_id: 1}},
							],
							as:	"item_details"
						}},
						{$match:{
							"item_details._id" : {$exists: true}
						}},
						{$sort		: {_id: Constants.SORT_ASC}},
						{$project	: {created: 0, modified: 0, item_details: 0}},
					]).toArray()
						.then((cartResult) => parentCallback(null, cartResult))
						.catch(parentCallback);
				},
				package_details : (parentCallback)=>{
					if(!userId || (!isCart && !isPlaceOrder)) return parentCallback(null,null);

					let userConditions 			=	clone(Constants.CUSTOMER_COMMON_CONDITIONS);
					userConditions._id 			= 	userId;
					userConditions.package_id 	= 	{$exists : true};
					userConditions.package_status = Constants.PACKAGE_RUNNING;

					users.findOne(userConditions,{projection: {package_id: 1, remaining_package_orders: 1}})
						.then((userResult) => parentCallback(null, userResult))
						.catch(parentCallback);
				},
				order_details : (callback)=>{
					if(!isPlaceModifiedOrder || !modifiedOrderId) return callback(null,null);

					orders.findOne({ _id : modifiedOrderId },{projection: { delivery_type: 1}})
						.then((orderResult) => callback(null, orderResult))
						.catch(callback);
				},
				outstanding_details : (callback)=>{
					if(!userId || cartTotalOnly || isBranchAvailability || isPlaceModifiedOrder){
						return callback(null,{});
					}

					users.findOne({
						_id 			:	userId,
						revert_orders 	: 	{$exists: true}
					},{projection: { revert_orders: 1}})
						.then((userResult) => {
							let totalOutStanding = 0;
							let outStandingOrderList = [];
							if(userResult && userResult.revert_orders && userResult.revert_orders.length > 0){
								outStandingOrderList = userResult.revert_orders;
								userResult.revert_orders.forEach(records => {
									if(records.outstanding_amount) totalOutStanding += records.outstanding_amount;
								});
								successResponse.outstanding_order_amount = Helpers.round(totalOutStanding);
								successResponse.outstanding_order_list = outStandingOrderList;
							}
							callback(null, { outstanding_amount : totalOutStanding, outstanding_order_list : outStandingOrderList });
						})
						.catch(callback);
				},
				kfg_rest: (callback)=>{
					const restaurants = this.db.collection(Tables.RESTAURANTS);
					restaurants.distinct("_id",{slug : {$in: [Constants.BURGER_KING, Constants.PIZZA_HUT] }})
						.then((restIds) => {
							const ids = (restIds && restIds.length) ? restIds.map(r => String(r)) : restIds;
							callback(null, ids);
						})
						.catch(callback);
				}
			},(parentParallelErr,parentParallelResponse)=>{
				if(parentParallelErr) return next(parentParallelErr);

				let compositeOffersDetails	=	parentParallelResponse.public_composite_offers;
				let kfgRestIds				=	parentParallelResponse.kfg_rest;
				let cartResult 		 		=	parentParallelResponse.cart_list;
				let corporateDetails 		= 	parentParallelResponse.corporate_details;
				let packageDetails 	 		= 	parentParallelResponse.package_details;
				let modifiedOrderDetails	=  (parentParallelResponse.order_details) ? parentParallelResponse.order_details :{};
				let modifiedDeliveryType	=  (modifiedOrderDetails.delivery_type) ? modifiedOrderDetails.delivery_type :"";
				let packageId		 		=	"";
				let packageCount	 		=	0;
				let unLimitedPackage 		=	false;
				if(packageDetails){
					packageId 		= 	packageDetails.package_id;
					packageCount	=	packageDetails.remaining_package_orders;

					/** When package order count is empty */
					if(packageCount.length <=0) unLimitedPackage = true;
				}

				/** Send success response */
				if(cartResult.length < 0) return resolve(successResponse);

				let cartList 	= 	{};
				cartResult.map(data=>{
                    let restaurantId    =   data.restaurant_id;
					let branchId        =   data.branch_id;

					if(isPlaceOrder && pickupBranchList[restaurantId])  branchId = new ObjectId(pickupBranchList[restaurantId]);

					if(!cartList[restaurantId]) cartList[restaurantId] = {};
					if(!cartList[restaurantId][branchId]){
						cartList[restaurantId][branchId] = {
							restaurant_id	: 	restaurantId,
							branch_id		:	branchId,
							customer_id		:	data.customer_id,
							device_id		:	data.device_id,
							area_id		    :	data.area_id,
							offer_id		:	data.offer_id,
							is_kfg_rest		:	false
						};
					}

					if(kfgRestIds && kfgRestIds.length >0){
						kfgRestIds.map(tmpkey=>{
							if(String(tmpkey) == String(tmpkey)) cartList[restaurantId][branchId].is_kfg_rest = true;
						});
					}

					if(data.order_id) cartList[restaurantId][branchId].order_id = data.order_id;
					if(data.block_branch_id) cartList[restaurantId][branchId].block_branch_id = data.block_branch_id;

                    if(!cartList[restaurantId][branchId].item_list) cartList[restaurantId][branchId].item_list = [];

                    if(data.restaurant_id)  delete data.restaurant_id;
                    if(data.branch_id)      delete data.branch_id;
                    if(data.area_id)        delete data.area_id;
                    if(data.order_id)       delete data.order_id;
                    if(typeof data.device_id != typeof undefined) delete data.device_id;
                    if(typeof data.customer_id != typeof undefined) delete data.customer_id;

					cartList[restaurantId][branchId].item_list.push(data);
				});

				const areas					= 	this.db.collection(Tables.AREAS);
				const items					= 	this.db.collection(Tables.ITEMS);
				const item_units			= 	this.db.collection(Tables.ITEM_UNITS);
				const restaurants 			=	this.db.collection(Tables.RESTAURANTS);
				const item_dough_units		= 	this.db.collection(Tables.ITEM_DOUGH_UNITS);
				const item_group_extras		= 	this.db.collection(Tables.ITEM_GROUP_EXTRAS);
				const restaurant_details 	=	this.db.collection(Tables.RESTAURANT_DETAILS);
				const item_extra_masters	= 	this.db.collection(Tables.ITEM_EXTRA_MASTERS);
				const item_selector_units	= 	this.db.collection(Tables.ITEM_SELECTOR_UNITS);
				const item_choices_groups	= 	this.db.collection(Tables.ITEM_CHOICES_GROUPS);
				const restaurant_branches	=	this.db.collection(Tables.RESTAURANT_BRANCHES);
				const restaurant_categories = 	this.db.collection(Tables.RESTAURANT_CATEGORIES);
				const restaurant_branch_areas		=	this.db.collection(Tables.RESTAURANT_BRANCH_AREAS);
				const restaurant_branch_attributes	=	this.db.collection(Tables.RESTAURANT_BRANCH_ATTRIBUTES);
				asyncForEachOf(cartList,(listData,tempBranchId,parentEachCallback)=>{
					asyncEach(cartList[tempBranchId], (records, eachCallback)=> {
						let restaurantId	=	records.restaurant_id;
						let branchId 		= 	records.branch_id;
						let areaId 	    	= 	records.area_id;
						let deliveryAreaId 	= 	records.area_id;
						let offerId 		= 	records.offer_id;
						let blockBranchId 	= 	records.block_branch_id;
						let isKfgRest 		= 	(records.is_kfg_rest) ? records.is_kfg_rest :false;
						let deliveryBy  	=   "";
						let scheduledBranchId = (scheduledBranchList[restaurantId] && scheduledBranchList[restaurantId][branchId]) ? scheduledBranchList[restaurantId][branchId] :"";

						if(isPlaceOrder && pickupBranchList[restaurantId])  deliveryBy = Constants.DELIVERY_BY_PICK_UP;
						if(isPlaceOrder && modifiedDeliveryType)  deliveryBy = modifiedDeliveryType;

						if(blockBranchId) branchId = blockBranchId;

						if(restaurantOrderDetails[restaurantId] && restaurantOrderDetails[restaurantId][branchId] && restaurantOrderDetails[restaurantId][branchId].area_id){
							deliveryAreaId = new ObjectId(restaurantOrderDetails[restaurantId][branchId].area_id);
						}

						records.branch_available = true;
						asyncParallel({
							restaurant_details : (callback)=>{
								if(cartTotalOnly) return callback(null);

								/** Get restaurant details **/
								restaurants.findOne({
									_id 		: restaurantId,
									status      : Constants.ACTIVE,
									is_deleted  : Constants.NOT_DELETED,
								},{projection: {name: 1, image: 1, concept_id: 1,landing_image:1,detail_image:1,supplier_code:1}})
									.then((restaurantResult) => {
										if(restaurantResult){
											records.restaurant_name	=  restaurantResult.name;
											records.restaurant_image=  restaurantResult.image;
											records.concept_id		=  restaurantResult.concept_id;
											records.partners 		=  (restaurantResult.concept_id) ? Constants.KFG_PARTNER :"";
											records.grid_image		= 	restaurantResult.landing_image;
											records.detail_image	=	restaurantResult.detail_image;
											records.supplier_code	=	restaurantResult.supplier_code;
										}else{
											records.branch_available =  false;
										}
										callback(null, restaurantResult);
									})
									.catch(callback);
							},
							restaurant_subDetails :(callback)=>{
								if(cartTotalOnly) return callback(null);

								/** Get restaurant sub details */
								restaurant_details.findOne({restaurant_id: restaurantId },{projection: {commission_value: 1, payment_method: 1}})
									.then((restResult) => {
										if(restResult){
											records.commission_details =	restResult;
										}else{
											records.branch_available =  false;
										}
										callback(null, restResult);
									})
									.catch(callback);
							},
							branch_details : (callback)=>{
								if(cartTotalOnly) return callback(null);

								/** Get restaurant details **/
								restaurant_branches.aggregate([
									{$match: {
										_id 			:	branchId,
										is_active		: 	Constants.ACTIVE,
										restaurant_id	: 	restaurantId,
									}},
									{$lookup:	{
										from     : Tables.RESTAURANT_BRANCH_AREAS,
										let      : {restaurantId: "$restaurant_id", branchId : "$_id", areaId : "$area_id" },
										pipeline : [
											{$match : {
												$expr: {
													$and : [
														{$eq: ["$restaurant_id", "$$restaurantId"]},
														{$eq: ["$branch_id", "$$branchId"]},
														{$eq: ["$area_id", "$$areaId"]},
													]
												}
											}},
											{$project : { delivery_fees: 1, delivery_time:1, open:1,accept_pickup_orders:1,minimum_order_limit:1,accept_scheduling_orders:1, preparation_time: 1, delivery_by:1 }},
										],
										as	:	"area_details"
									}},
									{$project :{
										name: 1, address:1, branch_status:1, is_open:1, latitude:1,longitude:1,accepts_cashback_payment:1, kfg_offer_id:1,kfg_offer_name:1, area_id: 1, area_details: {$arrayElemAt: ["$area_details",0]},
									}},
								]).toArray()
									.then((branchResult) => {
									if(branchResult && branchResult[0]){
										branchResult			=  branchResult[0];
										records.branch_name	    =  branchResult.name;
										records.is_open	        =  branchResult.is_open;
										records.branch_address	=  branchResult.address;
										records.branch_status	=  branchResult.branch_status;
										records.branch_kfg_details=  {
											kfg_offer_name 	:	(branchResult.kfg_offer_name) 	?	branchResult.kfg_offer_name :"",
											kfg_offer_id	: 	(branchResult.kfg_offer_id)		? 	branchResult.kfg_offer_id 	:"",
										};

										if(isPlaceOrder){
											records.branch_latitude		=  branchResult.latitude;
											records.branch_longitude	=  branchResult.longitude;
											records.accepts_cashback_payment= branchResult.accepts_cashback_payment;
										}

										if(scheduledBranchId){
											records.is_open	        =  Constants.OPEN;
											records.branch_status	=  Constants.OPEN;
										}

										if(deliveryBy == Constants.DELIVERY_BY_PICK_UP){
											records.area_status	   				=	Constants.OPEN;
											records.delivery_fees				=  	0;
											records.delivery_by					= 	Constants.DELIVERY_BY_PICK_UP;
											records.delivery_time				=	(branchResult.area_details) ? 	branchResult.area_details.delivery_time 			:0;
											records.preparation_time			=	(branchResult.area_details) ? 	branchResult.area_details.preparation_time 			:0;
											records.minimum_order_limit			=	(branchResult.area_details) ? 	branchResult.area_details.minimum_order_limit 		:0;
											records.accept_pickup_orders		=	(branchResult.area_details) ?	branchResult.area_details.accept_pickup_orders 		:0;
											records.accept_scheduling_orders	=	(branchResult.area_details)	? 	branchResult.area_details.accept_scheduling_orders	:0;
										}
									}else{
										records.branch_available =  false;
									}
									callback(null, branchResult);
								})
									.catch(callback);
							},
							area_details : (callback)=>{
								if(cartTotalOnly || deliveryBy == Constants.DELIVERY_BY_PICK_UP) return callback(null);

								/** Get branch area details **/
								restaurant_branch_areas.findOne({
									branch_id 		: branchId,
									area_id 		: deliveryAreaId,
									restaurant_id	: restaurantId,
								},{projection: {delivery_fees: 1, delivery_time:1, open:1,accept_pickup_orders:1,minimum_order_limit:1,accept_scheduling_orders:1, preparation_time: 1, delivery_by:1}})
									.then((areaResult) => {
										if(areaResult){
										records.area_status	    =  	areaResult.open;
										records.delivery_time	=  	(deliveryBy != Constants.DELIVERY_BY_PICK_UP) ? areaResult.delivery_time :0;
										records.delivery_fees	=  	(deliveryBy != Constants.DELIVERY_BY_PICK_UP) ? areaResult.delivery_fees :0;
										records.delivery_by		=  	(deliveryBy) ? deliveryBy :areaResult.delivery_by;
										records.preparation_time=	areaResult.preparation_time;
										records.minimum_order_limit		=  areaResult.minimum_order_limit;
										records.accept_pickup_orders	=  areaResult.accept_pickup_orders;
										records.accept_scheduling_orders=	areaResult.accept_scheduling_orders;
									}else{
										if(deliveryBy == Constants.DELIVERY_BY_PICK_UP){
											records.delivery_by		=  	deliveryBy;
											records.area_status		=	Constants.OPEN;
											records.delivery_fees	=  	0;
										}else{
											records.branch_available =  false;
										}
									}
									callback(null, areaResult);
								})
									.catch(callback);
							},
							item_list : (callback)=>{
								asyncEach(records.item_list, (itemData, itemEachCallback)=> {
									let itemId 		= 	itemData.item_id;
									let unitId 		= 	itemData.unit_id;
									let doughId 	= 	itemData.dough_id;
									let selectorId 	=	itemData.selector_id;

                                    if(!itemData.extra_item_list) itemData.extra_item_list = {en:[],ar:[]};
                                    if(doughId && !itemData.dough_list) itemData.dough_list= {en:[],ar:[]};
                                    if(selectorId && !itemData.selector_list) itemData.selector_list = {en:[],ar:[]};
                                    if(unitId && !itemData.unit_list) itemData.unit_list = {en:[],ar:[]};

									itemData.item_available =  true;

									asyncParallel({
										item_details : (itemCallback)=>{
											/** Get item details **/
											items.findOne({
												_id 			: 	itemId,
												restaurant_id 	:	restaurantId,
												is_active      	:	Constants.ACTIVE,
											},{projection: {name: 1, image: 1, item_price: 1,category_ids: 1, discount_percentage: 1, discount_value: 1,grid_image:1,detail_image:1, cuisine_id: 1 }})
												.then((itemResult) => {
													if(itemResult){
														let tmpCuisineId	=  itemResult.cuisine_id;
														let tmpCategoryIds	=  itemResult.category_ids;
														itemData.item_name	=  itemResult.name;
														itemData.item_image	=  itemResult.image;
														itemData.discount_value	=  itemResult.discount_value;
														itemData.discount_percentage= itemResult.discount_percentage;
														itemData.grid_image= itemResult.grid_image;
														itemData.detail_image= itemResult.detail_image;
														if(itemResult.item_price) itemData.item_price	=  itemResult.item_price;

														if(tmpCuisineId) itemData.cuisine_ids=  [tmpCuisineId];

														if(tmpCuisineId || (!isCheckOffer && !isPlaceOrder)){
															return itemCallback(null, itemResult);
														}

														/** Set category conditions  */
														let tmpCatConditions = {
															is_active : Constants.ACTIVE
														};

														if(tmpCategoryIds && tmpCategoryIds.length >0){
															tmpCatConditions._id = {$in: tmpCategoryIds};
														}

														/** Get cuisine id */
														return restaurant_categories.distinct("cuisine_id", tmpCatConditions)
															.then((cuisineResult) => {
																itemData.category_ids = itemResult.category_ids;
																if(cuisineResult) itemData.cuisine_ids = cuisineResult;
																itemCallback(null, itemResult);
															});
													}else{
														itemData.item_available =  false;
														itemCallback(null, itemResult);
													}
												})
												.catch(itemCallback);
										},
										unit_details : (unitCallback)=>{
											if(!unitId) return unitCallback(null,null);

											item_units.aggregate([
												{$match: 	{
													item_id		: itemId,
													item_unit_id: unitId
												}},
												{$lookup: 	{
													from			: Tables.ITEM_UNITS_MASTERS,
													localField		: "item_unit_id",
													foreignField	: "_id",
													as				: "unit_details",
												}},
												{$project	: 	{
													price: 1, discount_type: 1, discount_value: 1, unit_name: {$arrayElemAt:["$unit_details.name", 0] },
												}},
											]).toArray()
												.then((unitResult) => {
													if(unitResult && unitResult.length >0){
														if(unitResult[0].price) itemData.unit_price =  unitResult[0].price;
														itemData.unit_name 			=  unitResult[0].unit_name;
														itemData.unit_discount_type =  unitResult[0].discount_type;
														itemData.unit_discount_value=  unitResult[0].discount_value;
														itemData.unit_list.en.push(unitResult[0].unit_name.en);
														itemData.unit_list.ar.push(unitResult[0].unit_name.ar);
													}else{
														itemData.item_available =  false;
													}
													unitCallback(null, unitResult);
												})
												.catch(unitCallback);
										},
										dough_details : (unitCallback)=>{
											if(!doughId) return unitCallback(null,null);
											item_dough_units.aggregate([
												{$match: 	{ _id		: doughId }},
												{$lookup: 	{ from: Tables.ITEM_UNITS_MASTERS, localField: "item_unit_id", foreignField: "_id", as: "unit_details" }},
												{$project	: 	{ unit_name: {$arrayElemAt:["$unit_details.name", 0] } }},
											]).toArray()
												.then((doughResult) => {
													if(doughResult && doughResult.length >0){
														itemData.dough_name =  doughResult[0].unit_name;
														itemData.dough_list.en.push(doughResult[0].unit_name.en);
														itemData.dough_list.ar.push(doughResult[0].unit_name.ar);
													}
													unitCallback(null, doughResult);
												})
												.catch(unitCallback);
										},
										selector_details : (unitCallback)=>{
											if(!selectorId) return unitCallback(null,null);
											item_selector_units.aggregate([
												{$match: 	{ _id		: selectorId }},
												{$lookup: 	{ from: Tables.ITEM_UNITS_MASTERS, localField: "item_unit_id", foreignField: "_id", as: "unit_details" }},
												{$project	: 	{ unit_name: {$arrayElemAt:["$unit_details.name", 0] } }},
											]).toArray()
												.then((selectorResult) => {
													if(selectorResult && selectorResult.length >0){
														itemData.selector_name =  selectorResult[0].unit_name;
														itemData.selector_list.en.push(selectorResult[0].unit_name.en);
														itemData.selector_list.ar.push(selectorResult[0].unit_name.ar);
													}
													unitCallback(null, selectorResult);
												})
												.catch(unitCallback);
										},
										extra_item_list : (exItemCallback)=>{
											if(!itemData.extra_items || itemData.extra_items.length <= 0) return exItemCallback(null,null);

											asyncEach(itemData.extra_items, (exItemData, exItemEachCallback)=> {
												let groupId = exItemData.group_id;

												asyncParallel({
													extra_group_item_list : (groupCallback)=>{
														asyncEach(exItemData.extra_item_ids, (exItemData, groupExItemEachCallback)=> {
															let extraItemId = exItemData.extra_item_id;
															let groupItemId	= exItemData.extra_group_item_id;

															asyncParallel({
																extra_details : (extraItemCallback)=>{
																	item_extra_masters.findOne({
																		_id 	 : 	extraItemId,
																		item_id	 :	itemId,
																		$or : [
																			{is_active:	Constants.ACTIVE },
																			{is_auto_selected:true },
																		]
																	},{projection: {name: 1, extra_fees: 1,is_first_component:1}})
																		.then((exItemResult) => {
																			if(exItemResult){
																				exItemData.extra_item_name = exItemResult.name;
																				exItemData.is_first_component = exItemResult.is_first_component;
																				if(exItemResult.extra_fees) exItemData.extra_fees = exItemResult.extra_fees;
																			}else{
																				itemData.item_available =  false;
																			}
																			extraItemCallback(null, exItemResult);
																		})
																		.catch(extraItemCallback);
																},
																extra_group_details: (extraItemGroupCallback)=>{
																	item_group_extras.findOne({
																		_id 	: 	groupItemId,
																		item_id	:	itemId,
																		group_id: 	groupId,
																		item_extra_id : extraItemId,
																	},{projection: {extra_fees: 1, is_first_component:1}})
																		.then((groupItemResult) => {
																			if(groupItemResult){
																				exItemData.is_first_component = groupItemResult.is_first_component;
																				if(groupItemResult.extra_fees) exItemData.extra_fees = groupItemResult.extra_fees;
																			}else{
																				itemData.item_available =  false;
																			}
																			extraItemGroupCallback(null, groupItemResult);
																		})
																		.catch(extraItemGroupCallback);
																},
															},(parallelExGroupErr)=>{
																groupExItemEachCallback(parallelExGroupErr);
															});

														},(asyncGroupExItemErr)=>{
															groupCallback(asyncGroupExItemErr);
														});
													},
													group_details : (groupCallback)=>{
														item_choices_groups.findOne({
															_id 	: 	groupId,
															item_id	:	itemId,
														},{projection: {order: 1}})
															.then((groupResult) => {
																if(groupResult) exItemData.group_order = groupResult.order;
																groupCallback(null, groupResult);
															})
															.catch(groupCallback);
													},
												},(parallelErr)=>{
													exItemEachCallback(parallelErr);
												});
											},(asyncExItemErr)=>{
												itemData.extra_items = itemData.extra_items.sort(sortArrayByKey(["group_order"]));

												itemData.extra_items.map(tmpGroupData=>{
													if(tmpGroupData.extra_item_ids){
														tmpGroupData.extra_item_ids.map(tmpGroupItemData=>{
															if(tmpGroupItemData.extra_item_name){
																itemData.extra_item_list.en.push(tmpGroupItemData.extra_item_name.en);
																itemData.extra_item_list.ar.push(tmpGroupItemData.extra_item_name.ar);
															}
														});
													}
												});

												exItemCallback(asyncExItemErr);
											});
										},
										unit_item_list : (exItemCallback)=>{
											if(!itemData.unit_lists || itemData.unit_lists.length <= 0) return exItemCallback(null,null);

											asyncEach(itemData.unit_lists, (data, eachCallback)=> {
												let unitId 		= 	data.unit_id;
												let doughId 	= 	data.dough_id;
												let selectorId 	=	data.selector_id;

												if(!itemData.unit_dough_list) itemData.unit_dough_list = {en:[],ar:[]};
												if(!itemData.unit_selector_list) itemData.unit_selector_list = {en:[],ar:[]};
												if(!itemData.unit_item_list) itemData.unit_item_list = {en:[],ar:[]};

												asyncParallel({
													unit_details : (listCallback)=>{
														if(!unitId) return listCallback(null,null);

														item_units.aggregate([
															{$match: 	{ item_id: itemId, item_unit_id: unitId }},
															{$lookup: 	{ from: Tables.ITEM_UNITS_MASTERS, localField: "item_unit_id", foreignField: "_id", as: "unit_details" }},
															{$project	: 	{ price: 1, unit_name: {$arrayElemAt:["$unit_details.name", 0] } }},
														]).toArray()
															.then((unitResult) => {
																if(unitResult && unitResult.length >0){
																	data.unit_name  =  unitResult[0].unit_name;
																	if(unitResult[0].price) itemData.unit_price =  unitResult[0].price;
																	itemData.unit_item_list.en.push(unitResult[0].unit_name.en);
																	itemData.unit_item_list.ar.push(unitResult[0].unit_name.ar);
																}else{
																	itemData.item_available =  false;
																}
																listCallback(null, unitResult);
															})
															.catch(listCallback);
													},
													dough_details : (listCallback)=>{
														if(!doughId) return listCallback(null,null);
														item_dough_units.aggregate([
															{$match: 	{ _id: doughId }},
															{$lookup: 	{ from: Tables.ITEM_UNITS_MASTERS, localField: "item_unit_id", foreignField: "_id", as: "unit_details" }},
															{$project	: 	{ unit_name: {$arrayElemAt:["$unit_details.name", 0] } }},
														]).toArray()
															.then((doughResult) => {
																if(doughResult && doughResult.length >0){
																	data.dough_name  =  doughResult[0].unit_name;
																	itemData.unit_dough_list.en.push(doughResult[0].unit_name.en);
																	itemData.unit_dough_list.ar.push(doughResult[0].unit_name.ar);
																}
																listCallback(null, doughResult);
															})
															.catch(listCallback);
													},
													selector_details : (listCallback)=>{
														if(!selectorId) return listCallback(null,null);
														item_selector_units.aggregate([
															{$match: 	{ _id: selectorId }},
															{$lookup: 	{ from: Tables.ITEM_UNITS_MASTERS, localField: "item_unit_id", foreignField: "_id", as: "unit_details" }},
															{$project	: 	{ unit_name: {$arrayElemAt:["$unit_details.name", 0] } }},
														]).toArray()
															.then((selectorResult) => {
																if(selectorResult && selectorResult.length >0){
																	data.selector_name  =  selectorResult[0].unit_name;
																	itemData.unit_selector_list.en.push(selectorResult[0].unit_name.en);
																	itemData.unit_selector_list.ar.push(selectorResult[0].unit_name.ar);
																}
																listCallback(null, selectorResult);
															})
															.catch(listCallback);
													},
													extra_group_item_list : (listCallback)=>{
														if(!data.extra_items || data.extra_items.length <=0) return listCallback(null);

														asyncEach(data.extra_items, (exItemData, exItemEachCallback)=> {
															let groupId = exItemData.group_id;

															asyncParallel({
																extra_group_item_list : (groupCallback)=>{
																	asyncEach(exItemData.extra_item_ids, (exItemData, groupExItemEachCallback)=> {
																		let extraItemId = exItemData.extra_item_id;
																		let groupItemId	= exItemData.extra_group_item_id;

																		asyncParallel({
																			extra_details : (extraItemCallback)=>{
																				item_extra_masters.findOne({
																					_id 	 : 	extraItemId,
																					item_id	 :	itemId,
																				},{projection: {name: 1, extra_fees: 1}})
																					.then((exItemResult) => {
																						if(exItemResult){
																							itemData.extra_item_list.en.push(exItemResult.name.en);
																							itemData.extra_item_list.ar.push(exItemResult.name.ar);
																							exItemData.extra_item_name = exItemResult.name;
																							if(exItemResult.extra_fees) exItemData.extra_fees = exItemResult.extra_fees;
																						}else{
																							itemData.item_available =  false;
																						}
																						extraItemCallback(null, exItemResult);
																					})
																					.catch(extraItemCallback);
																			},
																			extra_group_details: (extraItemGroupCallback)=>{
																				item_group_extras.findOne({
																					_id 	: 	groupItemId,
																					item_id	:	itemId,
																					group_id: 	groupId,
																					item_extra_id : extraItemId,
																				},{projection: {extra_fees: 1}})
																					.then((groupItemResult) => {
																						if(groupItemResult){
																							if(groupItemResult.extra_fees) exItemData.extra_fees = groupItemResult.extra_fees;
																						}else{
																							itemData.item_available =  false;
																						}
																						extraItemGroupCallback(null, groupItemResult);
																					})
																					.catch(extraItemGroupCallback);
																			},
																		},(parallelExGroupErr)=>{
																			groupExItemEachCallback(parallelExGroupErr);
																		});

																	},(asyncGroupExItemErr)=>{
																		groupCallback(asyncGroupExItemErr);
																	});
																},
															},(parallelErr)=>{
																exItemEachCallback(parallelErr);
															});
														},(asyncExItemErr)=>{
															listCallback(asyncExItemErr);
														});
													}
												},(parallelErr)=>{
													eachCallback(parallelErr);
												});
											},(eachErr)=> {
												exItemCallback(eachErr);
											});
										},
									},(parallelErr)=>{
										itemEachCallback(parallelErr);
									});
								},(asyncItemErr)=>{
									callback(asyncItemErr);
								});
							},
							get_offer_details : (callback)=>{
								if(!offerId || isCheckOffer) return callback(null,null);

								/** Set offer option */
								let offerOptios = {
									restaurant_id 	: restaurantId,
									branch_id	 	: branchId,
									offer_id 		: offerId,
									user_id 		: userId,
									device_id 		: deviceId,
								};

								/** Check offer */
								this.checkUserOffer(req,res,next,offerOptios).then(response=>{
									if(response.status == Constants.STATUS_SUCCESS){
										records.offer_details =  response.result;
									}else{
										delete records.offer_id;
									}
									callback(null);
								}).catch(next);
							},
							get_eligible_offer: (callback)=>{
								if(!isCart || isPlaceOrder || isCheckOffer || cartTotalOnly) return callback(null);

								/** Eligible offer options  */
								let eligibleOfferOptions ={
									user_id	 	 : userId,
									device_id	 : deviceId,
									branch_id	 : branchId,
									restaurant_id: restaurantId,
									is_kfg_rest	 : isKfgRest,
									item_ids 	 : [],
								};

								records.item_list.map(tmpData=>{
									eligibleOfferOptions.item_ids.push(tmpData.item_id);
								});

								this.getEligibleOffer(req,res,next,eligibleOfferOptions).then(response=>{
									if(response.status == Constants.STATUS_SUCCESS){
										records.eligible_offer_list =  response.result;
									}
									callback(null);
								}).catch(next);
							},
							get_all_branch_list : (callback)=>{
								if(!isCart || isPlaceOrder || cartTotalOnly) return callback(null);

								/** Set sort conditions */
								let sortConditions ={};
								sortConditions["name."+Constants.DEFAULT_LANGUAGE_CODE] = Constants.SORT_ASC;

								/** Get restaurant all branch list */
								restaurant_branches.find({
									restaurant_id	: 	restaurantId,
									is_active		: 	Constants.ACTIVE,
									is_open			:	Constants.OPEN,
								},{projection: {_id:1, name: 1, address: 1}}).sort(sortConditions).toArray()
									.then((branchResult) => {
										records.all_branch_list = (branchResult) ? branchResult :[];
										callback(null, branchResult);
									})
									.catch(callback);
							},
							get_area_name: (callback)=>{
								if(!isPlaceOrder) return callback(null);

								areas.findOne({_id:areaId },{projection:{name: 1}})
									.then((areaResult) => {
										if(areaResult) records.area_name =  areaResult.name;
										callback(null, areaResult);
									})
									.catch(callback);
							},
							branch_attributes: (callback)=>{
								if(!isCart && !isPlaceOrder && !cartTotalOnly) return callback(null,null);

								restaurant_branch_attributes.find({
									branch_id		: branchId,
									restaurant_id 	: restaurantId,
									attribute_id	: {$in: [
										Constants.BRANCH_ADDITIONAL_TAX_ATTRIBUTE_ID,
										Constants.BRANCH_EXTRA_CHARGE_BY_VALUE_ATTRIBUTE_ID,
										Constants.BRANCH_DISCOUNT_BY_VALUE_ATTRIBUTE_ID,
										Constants.BRANCH_DISCOUNT_BY_PERCENTAGE_ATTRIBUTE_ID,
										Constants.BRANCH_EXTRA_CHARGE_PERCENTAGE_ATTRIBUTE_ID,
										Constants.BRANCH_OFFERS_DOUBLE_CASHBACK_ATTRIBUTE_ID,
									]},
								},{projection: {attribute_id:1, value: 1}}).toArray()
									.then((attributeResult) => {
										if(attributeResult.length <=0) return callback(null, attributeResult);

										let attributeList =  {};
										attributeResult.forEach(attributeData=>{
											attributeList[attributeData.attribute_id] = attributeData.value;
										});

										records.attribute_list  =  attributeList;
										if(isPlaceOrder){
											records.is_double_cashback =  (attributeList[Constants.BRANCH_OFFERS_DOUBLE_CASHBACK_ATTRIBUTE_ID] && attributeList[Constants.BRANCH_OFFERS_DOUBLE_CASHBACK_ATTRIBUTE_ID] == Constants.DOUBLE_CASHBACK) ? true :false;
										}
										callback(null, attributeList);
									})
									.catch(callback);
							},
							order_details : (callback)=>{
								if(!records.order_id) return callback(null);

								orders.findOne(
									{ _id : records.order_id },
									{projection: {order_price: 1, paid_amount: 1, unique_order_id:1,package_id:1, payment_method:1, delivery_type: 1}}
								)
									.then((orderResult) => {
										if(orderResult) records.order_details = orderResult;
										callback(null, orderResult);
									})
									.catch(callback);
							},
						},(parallelErr)=>{
							eachCallback(parallelErr);
						});
					},(subEachErr)=> {
						parentEachCallback(subEachErr);
					});
				},(eachErr)=> {
					if(eachErr) return next(eachErr);

					let grandTotal 		=	0;
					let totalDiscount	=	0;
					let totalItemPrice 	=	0;
					let itemIdsArray 	=	[];
					let cuisineIdsArray	=	[];
					let categoryIdsArray=	[];
					let finalList 		= 	[];
					let itemSubTotal	= 	0;
					Object.keys(cartList).map(restaurantId=>{
						Object.keys(cartList[restaurantId]).map(branchId=>{
							let data 			= 	clone(cartList[restaurantId][branchId]);
							let isKfgRest		=	data.is_kfg_rest;
							let branchKfgDetails=	(data.branch_kfg_details) ? data.branch_kfg_details :{};
							let branchKfgId		=	(branchKfgDetails.kfg_offer_id) 	? 	branchKfgDetails.kfg_offer_id 	:"";
							let branchKfgName	=	(branchKfgDetails.kfg_offer_name) 	?	branchKfgDetails.kfg_offer_name :"";
							data.discount 		=	0;
							let offerItemList 	= 	{};
							let totalAmount		=	0;
							let isApplyMainOffer= false;

							if(data.offer_details){
								isApplyMainOffer	=	true;
								data.discount	  	=	data.offer_details.discount;
								data.offer_code	  	= 	data.offer_details.offer_code;
								data.offer_type	  	= 	data.offer_details.offer_type;
								data.offer_discount	= 	data.offer_details.discount;
								data.restaurant_discount_ratio = data.offer_details.restaurant_discount_ratio;
								data.kfg_offer_id	= 	data.offer_details.kfg_offer_id;
								data.kfg_offer_name = 	data.offer_details.kfg_offer_name;

								if(data.offer_details.is_free_delivery && data.delivery_fees){
									if(isPlaceOrder) data.offer_delivery_fees = data.delivery_fees;
									data.delivery_fees 	= 0;
								}

								if(data.offer_details.item_list.length >0){
									data.offer_details.item_list.map(tmpRecords=>{
										offerItemList[tmpRecords.item_id] = tmpRecords.discount;
									});
								}
								/** Less discount */
								grandTotal 		-= data.offer_details.discount;
								totalAmount 	-= data.offer_details.discount;
								totalDiscount	+=	data.offer_details.discount
							}

							/** Add package details */
							if(data.delivery_by != Constants.DELIVERY_BY_PICK_UP && data.delivery_fees){
								if(packageId && (unLimitedPackage || packageCount >0)){
									data.package_delivery_fees  = data.delivery_fees;
									data.package_id  			= packageId;
									data.delivery_fees  		= 0;
									if(!unLimitedPackage) packageCount 	-= 1;
								}else if(data.order_details && data.order_details.package_id){
									data.package_id  	= data.order_details.package_id;
									data.delivery_fees  = 0;
								}
							}

							if(data.delivery_by != Constants.DELIVERY_BY_PICK_UP && data.delivery_fees){
								grandTotal += parseFloat(data.delivery_fees);
								totalAmount += parseFloat(data.delivery_fees);
							}

							let totalItemAmount = 0;
							data.item_list.map(records=>{
								let qty		  	= 	(records.qty) 		 ? records.qty 		  :0;
								let itemPrice	= 	(records.item_price) ? records.item_price :0;

								if(itemPrice){
									let tmpPrice 		=	itemPrice;
									let percentage		=	records.discount_percentage;
									let discountValue	=	records.discount_value;

									if(discountValue){
										let tmpDiscount= (tmpPrice>=discountValue) ? discountValue :tmpPrice;

										records.strikethrough_price = tmpPrice;
										itemPrice = Helpers.round(tmpPrice-tmpDiscount);
									}else if(percentage){
										let tmpDiscount = 	(tmpPrice*percentage)/100;

										records.strikethrough_price	= tmpPrice;
										itemPrice = Helpers.round(tmpPrice-tmpDiscount);
									}
								}

								if(records.unit_id && records.unit_price >0){
									itemPrice	= 	(records.unit_price) ? records.unit_price :0;
									let discountType  =  (records.unit_discount_type) ? records.unit_discount_type :0;
									let discountValue = (records.unit_discount_value) ? records.unit_discount_value :0;

									let tmpPrice =	itemPrice;
									if(discountValue && discountType){
										if(discountType == Constants.DISCOUNT_BY_VALUE){
											let tmpDiscount= (tmpPrice>=discountValue) ? discountValue :tmpPrice;

											records.strikethrough_price = tmpPrice;
											itemPrice = Helpers.round(tmpPrice-tmpDiscount);
										}else{
											let tmpDiscount = 	(tmpPrice*discountValue)/100;

											records.strikethrough_price= tmpPrice;
											itemPrice = Helpers.round(tmpPrice-tmpDiscount);
										}
									}
								}

								if(records.item_type == Constants.HALF_AND_HALF_ITEM || records.item_type == Constants.PIZZA_VGROUP){
									itemPrice = 0;
								}

								/** Add item main price */
								records.item_main_price =	Helpers.round(itemPrice);

								if(records.extra_items && records.extra_items.length >0){
									records.extra_items.map(extraData=>{

										extraData.extra_item_ids.map(itemData=>{
											itemPrice += (itemData.extra_fees) ? parseFloat(itemData.extra_fees) :0;
										});
									});
								}

								if(records.unit_lists && records.unit_lists.length >0){
									records.unit_lists.map(tmpExtraItem=>{
										if(tmpExtraItem.extra_items && tmpExtraItem.extra_items.length >0){
											tmpExtraItem.extra_items.map(extraData=>{

												extraData.extra_item_ids.map(itemData=>{
													itemPrice += (itemData.extra_fees) ? parseFloat(itemData.extra_fees) :0;
												});
											});
										}
									});
								}

								if(!isPlaceOrder){
									if(typeof records.offer_id != typeof undefined) delete records.offer_id;
									if(typeof records.unit_id != typeof undefined)  delete records.unit_id;
									if(typeof records.unit_price != typeof undefined)  delete records.unit_price;
									if(typeof records.dough_id != typeof undefined) delete records.dough_id;
									if(typeof records.selector_id != typeof undefined) delete records.selector_id;
								}

								let itemDiscount	=	(offerItemList[records.item_id]) ? offerItemList[records.item_id] :0;
								let priceWithQty	=	Helpers.round(itemPrice*qty);
								records.discount  	= 	itemDiscount;
								records.sub_price  	= 	priceWithQty;
								records.item_price 	=	Helpers.round(itemPrice);
								grandTotal 			+= 	priceWithQty;
								totalAmount			+= 	priceWithQty;
								totalItemAmount		+= 	priceWithQty;
								itemSubTotal		+=  priceWithQty;

								if(isCheckOffer){
									totalItemPrice +=	priceWithQty;

									itemIdsArray.push({
										item_id : records.item_id,
										price 	: Helpers.round(priceWithQty),
									});

									if(records.category_ids && records.category_ids.length >0){
										categoryIdsArray = categoryIdsArray.concat(records.category_ids);
									}

									if(records.cuisine_ids && records.cuisine_ids.length >0){
										cuisineIdsArray = cuisineIdsArray.concat(records.cuisine_ids);
									}
								}
							});

							if(data.branch_status != Constants.OPEN || data.is_open != Constants.OPEN || data.area_status != Constants.OPEN){
                                data.branch_open    = Constants.CLOSE;
                                data.message        = res.__("user_carts.branch_not_available_this_area");
                            }else{
                                data.branch_open    = Constants.OPEN;
							}

							if(typeof data.area_status != typeof undefined)     delete data.area_status;
                            if(typeof data.is_open != typeof undefined)         delete data.is_open;
                            if(typeof data.branch_status != typeof undefined)   delete data.branch_status;
                            if(typeof data.offer_details != typeof undefined)   delete data.offer_details;

							if(!isApplyMainOffer){
								/** Add public composite  offer */
								let isApplyComposite = false;
								if(compositeOffersDetails && (isPlaceOrder || isCart)){
									let compositeDiscounts 	= (compositeOffersDetails.discounts) ? compositeOffersDetails.discounts :[];
									let freeDelivery 		= (compositeOffersDetails.free_delivery) ? compositeOffersDetails.free_delivery :"";
									let minimumOrderAmount	= (compositeOffersDetails.minimum_order_amount) ? compositeOffersDetails.minimum_order_amount :0;
									let kfgOfferId			= (compositeOffersDetails.kfg_offer_id) ? compositeOffersDetails.kfg_offer_id :'';
									let kfgOfferName		= (compositeOffersDetails.kfg_offer_name) ? compositeOffersDetails.kfg_offer_name :'';

									if(!isKfgRest || (isKfgRest && kfgOfferId && kfgOfferName)){

										if(freeDelivery && totalItemAmount >= minimumOrderAmount && data.delivery_fees){
											let tmpDeliveryFees				= 	data.delivery_fees;
											data.composite_id  				=	compositeOffersDetails._id;
											data.composite_delivery_fees  	= 	tmpDeliveryFees;
											grandTotal  					-=	parseFloat(data.delivery_fees);
											totalAmount 					-= 	parseFloat(data.delivery_fees);
											data.delivery_fees 			  	 = 	0;

											if(kfgOfferId && kfgOfferName){
												data.kfg_offer_id  		=	kfgOfferId;
												data.kfg_offer_name  	= 	kfgOfferName;
											}
										}

										if(compositeDiscounts.length >0  && totalItemAmount >0){
											let tmpDiscount 	= 0;
											let isAddDiscount   = false;
											let alreadyAddedDiscount = (data.discount)  ? data.discount:0;
											compositeDiscounts.map(discountData=>{
												if(!isAddDiscount){
													let minAmount = (discountData.min_order_amount) ? discountData.min_order_amount :0;
													let maxAmount = (discountData.max_order_amount) ? discountData.max_order_amount :0;
													let discountType = (discountData.discount_type) ? discountData.discount_type :0;
													let discountValue = (discountData.discount_value) ? discountData.discount_value :0;

													if(totalItemAmount >= minAmount && maxAmount >= totalItemAmount){
														isAddDiscount = true;
														if(discountType == Constants.DISCOUNT_BY_PERCENTAGE){
															tmpDiscount = Helpers.round((totalItemAmount*discountValue)/100);
														}else{
															tmpDiscount = discountValue;
														}
													}
												}
											});

											if(tmpDiscount >0){
												totalDiscount		    -=  alreadyAddedDiscount;
												grandTotal		  		+=  alreadyAddedDiscount;
												totalAmount		   		+=  alreadyAddedDiscount;
												data.composite_id  		=	compositeOffersDetails._id;
												data.composite_discount	= 	tmpDiscount;
												let completeDiscount    =	tmpDiscount+alreadyAddedDiscount;
												let finalDiscount	  	= 	(completeDiscount > totalItemAmount) ? totalItemAmount :completeDiscount;
												isApplyComposite		= 	true;
												if(completeDiscount > totalItemAmount){
													data.composite_discount = totalItemAmount-alreadyAddedDiscount;
												}

												if(kfgOfferId && kfgOfferName){
													data.kfg_offer_id  		=	kfgOfferId;
													data.kfg_offer_name  	= 	kfgOfferName;
												}

												data.discount	= 	 finalDiscount;
												totalDiscount	+=   finalDiscount;
												grandTotal 		-= 	 finalDiscount;
												totalAmount 	-= 	 finalDiscount;
											}
										}
									}
								}

								/** Add corporate offer */
								let isApplyCorporate = false;
								if(!isApplyComposite && corporateDetails && (isPlaceOrder || isCart)){
									let corporateDiscounts 	= (corporateDetails.discounts) ? corporateDetails.discounts :[];
									let freeDelivery 		= (corporateDetails.free_delivery) ? corporateDetails.free_delivery :"";
									let minimumOrderAmount	= (corporateDetails.minimum_order_amount) ? corporateDetails.minimum_order_amount :0;
									let kfgOfferId			= (corporateDetails.kfg_offer_id) ? corporateDetails.kfg_offer_id :'';
									let kfgOfferName		= (corporateDetails.kfg_offer_name) ? corporateDetails.kfg_offer_name :'';

									if(!isKfgRest || (isKfgRest && kfgOfferId && kfgOfferName)){
										if(freeDelivery && totalItemAmount >= minimumOrderAmount && data.delivery_fees){
											let tmpDeliveryFees				= data.delivery_fees;
											data.corporate_id  			  	= corporateDetails._id;
											data.corporate_delivery_fees  	= tmpDeliveryFees;
											grandTotal  					-= parseFloat(data.delivery_fees);
											totalAmount 					-= parseFloat(data.delivery_fees);
											data.delivery_fees 			  	 = 0;

											if(kfgOfferId && kfgOfferName){
												data.kfg_offer_id  	=	kfgOfferId;
												data.kfg_offer_name = 	kfgOfferName;
											}
										}

										if(corporateDiscounts.length >0  && totalItemAmount >0){
											let tmpDiscount 	= 0;
											let isAddDiscount   = false;
											let alreadyAddedDiscount = (data.discount)  ? data.discount:0;
											corporateDiscounts.map(discountData=>{
												if(!isAddDiscount){
													let minAmount = (discountData.min_order_amount) ? discountData.min_order_amount :0;
													let maxAmount = (discountData.max_order_amount) ? discountData.max_order_amount :0;
													let discountType = (discountData.discount_type) ? discountData.discount_type :0;
													let discountValue = (discountData.discount_value) ? discountData.discount_value :0;

													if(totalItemAmount >= minAmount && maxAmount >= totalItemAmount){
														isAddDiscount = true;
														if(discountType == Constants.DISCOUNT_BY_PERCENTAGE){
															tmpDiscount = Helpers.round((totalItemAmount*discountValue)/100);
														}else{
															tmpDiscount = discountValue;
														}
													}
												}
											});

											if(tmpDiscount >0){
												totalDiscount		    -=   alreadyAddedDiscount;
												grandTotal		  		+=   alreadyAddedDiscount;
												totalAmount		   		+=   alreadyAddedDiscount;
												data.corporate_id  		=	corporateDetails._id;
												data.corporate_discount	= 	tmpDiscount;
												let completeDiscount    =	tmpDiscount+alreadyAddedDiscount;
												let finalDiscount	  	= 	(completeDiscount > totalItemAmount) ? totalItemAmount :completeDiscount;
												isApplyCorporate		= 	true;

												if(completeDiscount > totalItemAmount){
													data.corporate_discount = totalItemAmount-alreadyAddedDiscount;
												}

												if(kfgOfferId && kfgOfferName){
													data.kfg_offer_id  	=	kfgOfferId;
													data.kfg_offer_name = 	kfgOfferName;
												}

												data.discount	= 	 finalDiscount;
												totalDiscount	+=   finalDiscount;
												grandTotal 		-= 	 finalDiscount;
												totalAmount 	-= 	 finalDiscount;
											}
										}
									}
								}

								/** Add branch discount */
								if(data.attribute_list && totalItemAmount >0){
									let branchDicountAdded 	  	= 	false;
									let branchExtraChargeAdded 	= 	false;
									let alreadyAddedDiscount	=	(data.discount)  ? data.discount:0;

									/** Add extra charge by value discount */
									if(!branchExtraChargeAdded && data.attribute_list[Constants.BRANCH_EXTRA_CHARGE_BY_VALUE_ATTRIBUTE_ID] && data.attribute_list[Constants.BRANCH_EXTRA_CHARGE_BY_VALUE_ATTRIBUTE_ID] >0){
										let extraCharge = parseFloat(data.attribute_list[Constants.BRANCH_EXTRA_CHARGE_BY_VALUE_ATTRIBUTE_ID]);

										if(extraCharge >0){
											data.branch_extra_charge		= 	extraCharge;
											data.branch_extra_charge_type	= 	Constants.BRANCH_EXTRA_CHARGE;

											branchExtraChargeAdded	= 	true;
											grandTotal 				+= 	 extraCharge;
											totalAmount 			+= 	 extraCharge;
										}
									}

									/** Add extra charge by percentage discount */
									if(!branchExtraChargeAdded && data.attribute_list[Constants.BRANCH_EXTRA_CHARGE_PERCENTAGE_ATTRIBUTE_ID]){
										let extraPercentage = parseFloat(data.attribute_list[Constants.BRANCH_EXTRA_CHARGE_PERCENTAGE_ATTRIBUTE_ID]);
										let extraCharge 	= Helpers.round((totalItemAmount*extraPercentage)/100);

										if(extraCharge >0){
											data.branch_extra_charge		= 	extraCharge;
											data.branch_extra_charge_type	= 	Constants.BRANCH_EXTRA_CHARGE_PERCENTAGE;

											branchExtraChargeAdded	= 	true;
											grandTotal 				+= 	extraCharge;
											totalAmount 			+= 	extraCharge;
										}
									}

									if(!isApplyCorporate && !isApplyComposite && (!isKfgRest || (isKfgRest && branchKfgId && branchKfgName))){

										/** Add discount by value*/
										if(!branchDicountAdded && data.attribute_list[Constants.BRANCH_DISCOUNT_BY_VALUE_ATTRIBUTE_ID]){
											let branchDiscount = parseFloat(data.attribute_list[Constants.BRANCH_DISCOUNT_BY_VALUE_ATTRIBUTE_ID]);
											let completeDiscount= branchDiscount+alreadyAddedDiscount;

											if(completeDiscount > totalItemAmount){
												branchDiscount  = totalItemAmount-alreadyAddedDiscount;
											}

											if(branchDiscount >0){
												data.branch_discount		= 	branchDiscount;
												data.branch_discount_type	= 	Constants.BRANCH_DISCOUNT_BY_VALUE;

												branchDicountAdded	= 	true;
												data.discount		+= 	 branchDiscount;
												totalDiscount		+=   branchDiscount;
												grandTotal 			-= 	 branchDiscount;
												totalAmount 		-= 	 branchDiscount;

												if(branchKfgId && branchKfgName){
													data.kfg_offer_id  	=	branchKfgId;
													data.kfg_offer_name = 	branchKfgName;
												}
											}
										}

										/** Add discount by percentage*/
										if(!branchDicountAdded && data.attribute_list[Constants.BRANCH_DISCOUNT_BY_PERCENTAGE_ATTRIBUTE_ID]){
											let branchPercentage = parseFloat(data.attribute_list[Constants.BRANCH_DISCOUNT_BY_PERCENTAGE_ATTRIBUTE_ID]);
											let branchDiscount 	= Helpers.round((totalItemAmount*branchPercentage)/100);
											let completeDiscount= branchDiscount+alreadyAddedDiscount;

											if(completeDiscount > totalItemAmount){
												branchDiscount  = totalItemAmount-alreadyAddedDiscount;
											}

											if(branchDiscount >0){
												data.branch_discount		= 	branchDiscount;
												data.branch_discount_type	= 	Constants.BRANCH_DISCOUNT_BY_PERCENTAGE;

												branchDicountAdded	= 	true;
												data.discount		+= 	 branchDiscount;
												totalDiscount		+=   branchDiscount;
												grandTotal 			-= 	 branchDiscount;
												totalAmount 		-= 	 branchDiscount;

												if(branchKfgId && branchKfgName){
													data.kfg_offer_id  	=	branchKfgId;
													data.kfg_offer_name = 	branchKfgName;
												}
											}
										}
									}
								}
							}

							/** Add additional tax */
							data.additional_tax = 0;
							if(data.attribute_list && data.attribute_list[Constants.BRANCH_ADDITIONAL_TAX_ATTRIBUTE_ID] && data.attribute_list[Constants.BRANCH_ADDITIONAL_TAX_ATTRIBUTE_ID] >0){
								let additionalTax  = parseFloat(data.attribute_list[Constants.BRANCH_ADDITIONAL_TAX_ATTRIBUTE_ID]);

								let tmpItemAmount   = totalItemAmount-data.discount;
								if(tmpItemAmount >0){
									let finalAdditionalTax = Helpers.round((tmpItemAmount*additionalTax)/100);

									data.additional_tax_percentage =  additionalTax;
									data.additional_tax =  finalAdditionalTax;
									totalAmount 		+= finalAdditionalTax;
									grandTotal 			+= finalAdditionalTax;
								}
							}

							if(data.attribute_list) delete data.attribute_list;

							if(isPlaceOrder) data.total_amount = Helpers.round(totalAmount, Constants.CURRENCY_ROUND_PRECISION);

							finalList.push(data);
						});
					});

					/** Set response */
					successResponse.result 			= 	finalList;
					successResponse.grand_total 	= 	Helpers.round(grandTotal, Constants.CURRENCY_ROUND_PRECISION);
					successResponse.item_sub_total 	= 	Helpers.round(itemSubTotal, Constants.CURRENCY_ROUND_PRECISION);
					successResponse.total_discount 	=	Helpers.round(totalDiscount, Constants.CURRENCY_ROUND_PRECISION);
					if(isCheckOffer){
						successResponse.item_ids 			= 	itemIdsArray;
						successResponse.category_ids 		= 	categoryIdsArray;
						successResponse.cuisine_ids	 		= 	cuisineIdsArray;
						successResponse.total_item_price 	=	Helpers.round(totalItemPrice);
					}

					/** Send success response */
					resolve(successResponse);
				});
			});
        }).catch(next);
	} // end getUserCartList()

	/**
	 * Function to sort array
	**/
	sortArrayByKey = (fields) => (a, b) => fields.map(o => {
		let dir = 1;
		if (o[0] === '-') { dir = -1; o=o.substring(1); }
		return a[o] > b[o] ? dir : a[o] < b[o] ? -(dir) : 0;
	}).reduce((p, n) => p ? p : n, 0);

	/**
	 * Function to get eligible Offer
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 * @param options As data object
	 *
	 * @return json
	**/
	getEligibleOffer(req, res, next, options) {
		return new Promise(resolve=>{
			let itemIds		= 	(options.item_ids)		?	options.item_ids				:[];
			let branchId	= 	(options.branch_id) 	?	new ObjectId(options.branch_id)		:"";
			let userId		= 	(options.user_id) 		?	new ObjectId(options.user_id)		:"";
			let deviceId	= 	(options.device_id)		?	options.device_id				:"";
			let restaurantId= 	(options.restaurant_id)	?	new ObjectId(options.restaurant_id)	:"";
			let isKfgRest	= 	(options.is_kfg_rest)	?	options.is_kfg_rest				:"";

			/** Send success response **/
			if((!userId && !deviceId) || !branchId || !restaurantId || itemIds.length <=0){
				return resolve({status: Constants.STATUS_SUCCESS, result: [] });
			}

			/** Get item category */
			const items = this.db.collection(Tables.ITEMS);
			items.find({
				_id 		  : {$in : itemIds},
				restaurant_id :	restaurantId,
			},{projection: {category_ids: 1}}).toArray()
				.then((itemResult) => {
				/** Send success response */
				if(itemResult.length <=0) return resolve({status: Constants.STATUS_SUCCESS, result: [] });

				let categoryIdsArray = [];
				itemResult.forEach(records=>{
					categoryIdsArray = categoryIdsArray.concat(records.category_ids);
				});

				const users =  this.db.collection(Tables.USERS);
				asyncParallel({
					user_count : (callback)=>{
						if(!userId) return callback(null,null);

						/** Set user conditions */
						let userConditions 		= clone(Constants.CUSTOMER_COMMON_CONDITIONS);
						userConditions._id		= userId;
						userConditions.is_guest	= {$exists: false};
						userConditions.created	= {$gte: Helpers.newDate(Helpers.subtractDate(Constants.NEW_USER_DAYS*Constants.HOURS_IN_A_DAY))};

						/** Check user type **/
						users.countDocuments(userConditions)
							.then((userResult) => callback(null, userResult))
							.catch(callback);
					},
					corporate_details : (callback)=>{
						if(!userId) return callback(null,null);

						/** Set user conditions */
						let userConditions 			= clone(Constants.CUSTOMER_COMMON_CONDITIONS);
						userConditions._id			= userId;
						userConditions.corporate_id	= {$exists: true};

						/** Check user corporate **/
						users.findOne(userConditions,{projection:{corporate_id: 1}})
							.then((userResult) => callback(null, userResult))
							.catch(callback);
					},
					cuisine_list : (callback)=>{
						/** Set cuisine conditions */
						let cuisineConditions 	= {
							restaurant_id : restaurantId
						};
						if(categoryIdsArray.length >0) cuisineConditions._id = {$in: categoryIdsArray};

						/** Get cuisine list **/
						const restaurant_categories = this.db.collection(Tables.RESTAURANT_CATEGORIES);
						restaurant_categories.distinct("cuisine_id",cuisineConditions)
							.then((cuisineIds) => callback(null, cuisineIds))
							.catch(callback);
					},
				},(asyncErr, response)=>{
					if(asyncErr) return next(asyncErr);

					let corporateDetails =  (response.corporate_details) ?response.corporate_details:{};
					let userCount 	=  	response.user_count;
					let cuisineList =	response.cuisine_list;
					let corporateId	=  	(corporateDetails.corporate_id) ?corporateDetails.corporate_id :"";
					let userType 	=	(deviceId && !userId) ? Constants.APPLICABLE_FOR_GUEST :((userCount >0) ?  Constants.APPLICABLE_FOR_NEW_USERS : Constants.APPLICABLE_FOR_REGISTERED_MEMBER);

					/** Set lookup conditions */
					let lookupConditions = {
						$and : [
							{$eq: ["$offer_id", "$$offerId"]},
						]
					};

					if(userId){
						lookupConditions["$and"].push({$eq: ["$user_id", userId ]});
					}else{
						lookupConditions["$and"].push({$eq: ["$device_id", deviceId ]});
					}

					/** Add offer conditions */
					let fromDate = Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));
					let toDate   = Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_END_DATE_FORMAT));
					let offerConditions = {
						display_offer	:  	true,
						is_active		:	Constants.ACTIVE,
						status			:	Constants.OFFER_PUBLISHED,
						$and			:	[
							{$or : [
								{"applicable_for.0" : {$exists: false}},
								{applicable_for	   : {$in: [userType]}}
							]},
							{$or : [
								{"restaurant_ids.0" : {$exists: false}},
								{restaurant_ids	 	: {$in: [restaurantId]}}
							]},
							{$or : [
								{"branch_ids.0" : {$exists: false}},
								{branch_ids	 	: {$in: [branchId]}}
							]},
							{$or : [
								{"cuisine_ids.0" : {$exists: false}},
								{cuisine_ids	 : {$in: cuisineList}}
							]},
							{$or : [
								{$and :[
									{"item_ids.0" : {$exists: false}},
									{offer_type : {$ne: Constants.COMBO_OFFER}}
								]},
								{$and :[
									{item_ids : {$in: itemIds}},
									{item_offer_type: {$ne: Constants.ITEM_WISE_OFFER}}
								]},
								{$and :[
									{"item_ids.0" : {$exists: false}},
									{item_offer_type: Constants.ITEM_WISE_OFFER}
								]},
							]},
							{$or : [
								{$and : [
									{ valid_from : {$gte : Helpers.newDate(fromDate)} },
									{ valid_to   : {$lte : Helpers.newDate(toDate)} }
								]},
								{$and : [
									{ valid_to 	 : {$gte : Helpers.newDate(fromDate)} },
									{ valid_from : {$lte : Helpers.newDate(toDate)} }
								]}
							]}
						]
					};

					if(isKfgRest){
						offerConditions["$and"].push(
							{"kfg_offer_id": {$exists: true, $nin: ["", null]}},
							{"kfg_offer_name": {$exists: true, $nin: ["", null]}},
						);
					}

					if(categoryIdsArray.length >0){
						offerConditions["$and"].push({$or: [
							{"category_ids.0": {$exists: false}},
							{category_ids	 : {$in: categoryIdsArray}}
						]});
					}

					if(userId){
						offerConditions["$and"].push({$or: [
							{"user_ids.0": {$exists: false}},
							{user_ids	 : {$in: [userId]} }
						]});
					}

					if(corporateId){
						offerConditions["$and"].push({$or: [
							{"corporate_ids.0" : {$exists: false}},
							{corporate_ids	   : {$in: [corporateId]}}
						]});
					}else{
						offerConditions.offer_type = {$ne: Constants.CORPORATE_OFFER};
					}

					/** Get offer list */
					const offers = this.db.collection(Tables.OFFERS);
					offers.aggregate([
						{$match : offerConditions},
						{$lookup:	{
							from     : Tables.OFFER_ITEMS,
							let      : {offerId : "$_id"},
							pipeline : [
								{$match : {
									$expr: {
										$and : [
											{$eq: ["$offer_id", "$$offerId"]},
										]
									},
								}},
								{$match: {
									"item_id" : {$in: itemIds}
								}},
							],
							as:	"offer_items_details"
						}},
						{$addFields: { total_offer_items : {$size: "$offer_items_details"} }},
						{$match : {
							$expr: {
								$or : [
									{$ne: ["$item_offer_type", Constants.ITEM_WISE_OFFER]},
									{$and: [
										{$eq: ["$item_offer_type", Constants.ITEM_WISE_OFFER]},
										{$lte: ["$minimum_items", "$total_offer_items"]},
									]},
								]
							},
						}},
						{$lookup:	{
							from     : Tables.OFFER_LOGS,
							let      : {offerId : "$_id"},
							pipeline : [
								{$match : {
									$expr: lookupConditions
								}},
								{$project : {_id: 1}},
							],
							as:	"offer_unique_redeem_details"
						}},
						{$lookup : {
							from 		 : Tables.OFFER_LOGS,
							localField 	 : "_id",
							foreignField : "offer_id",
							as 			 : "offer_redeem_details"
						}},
						{$addFields :{
							unique_redeem_count : {$size: "$offer_unique_redeem_details"},
							total_redeem_count  : {$size: "$offer_redeem_details"},
						}},
						{$match : {
							$expr: {
								$and : [
									{$or:[
										{$eq: ["$total_unique_redeem", ""]},
										{$gt: ["$total_unique_redeem", "$unique_redeem_count"]},
									]},
									{$or:[
										{$eq: ["$total_redeem", ""]},
										{$gt: ["$total_redeem", "$total_redeem_count"]},
									]},
								]
							}
						}},
						{$sort: {display_order: Constants.SORT_ASC, created: Constants.SORT_DESC}},
						{$project : { title: 1, description: 1, offer_code: 1, unique_redeem_count: 1, total_redeem_count: 1}},
					]).toArray()
						.then((offerResult) => {
							resolve({status: Constants.STATUS_SUCCESS, result: offerResult });
						})
						.catch(next);
				});
			}).catch(next);
		}).catch(next);
	} // end getEligibleOffer()

	/**
	 * Function to get update user id
	 *
	 * @param req		As Request Data
	 * @param res		As Response Data
	 * @param next		As Callback argument to the middleware function
	 * @param options	As object data
	 *
	 * @return json
	**/
	updateUserId(req, res, next, options) {
		return new Promise(resolve=>{
			let userId	= 	(options.user_id)	?	new ObjectId(options.user_id)	:"";
            let deviceId= 	(options.device_id)	?	options.device_id			:"";

			/** Send error response **/
			if(!userId || !deviceId) return resolve({status: Constants.STATUS_ERROR, message:res.__("system.missing_parameters")});

			/** Update cart details */
			const user_carts = 	this.db.collection(Tables.USER_CARTS);
			user_carts.updateMany({
				device_id : deviceId
			},
			{$set: {
				device_id	: "",
				customer_id : userId,
				modified 	: Helpers.getUtcDate(),
			}},(updateErr)=>{
				if(updateErr) return next(updateErr);

				/** Send success response */
				resolve({status: Constants.STATUS_SUCCESS});
			});
        }).catch(next);
	} // end updateUserId()

	/**
	 * Function to update cart qty
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	updateCartQty(req, res, next) {
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 	=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId	= 	(req.body.user_id)	?	new ObjectId(req.body.user_id)	:"";
            let cartId	= 	(req.body.cart_id)	?	new ObjectId(req.body.cart_id)	:"";
            let deviceId= 	(req.body.device_id)?	req.body.device_id			:"";
            let qty		= 	(req.body.qty)		?	parseInt(req.body.qty)		:0;

			/** Send error response **/
			if((!userId && !deviceId )|| !cartId || isNaN(qty)) return resolve({status: Constants.STATUS_ERROR, message:res.__("system.missing_parameters")});

			if(qty <= 0){
				/** remove cart item */
				this.removeCartItems(req,res,next).then(response=>{
					if(response.status != Constants.STATUS_SUCCESS) return resolve(response);

					asyncParallel({
						cart_details : (childCallback)=>{
							/** Get cart total */
							let cartOptions = {
								user_id 		: userId,
								device_id 		: deviceId,
								cart_total_only : true,
							};

							this.getUserCartList(req,res,next,cartOptions).then(cartResponse=>{
								if(cartResponse.status != Constants.STATUS_SUCCESS) return childCallback(cartResponse);
								childCallback(null,cartResponse);
							}).catch(next);
						},
						cart_count : (childCallback)=>{
							/** Get cart coount */
							this.getCartCount(req,res,next).then(cartResponse=>{
								if(cartResponse.status != Constants.STATUS_SUCCESS) return childCallback(cartResponse);
								childCallback(null,cartResponse.count);
							}).catch(next);
						},
					},(asyncChildErr, asyncChildResponse)=>{
						if(asyncChildErr) return next(asyncChildErr);

						response.total_amount 	= (asyncChildResponse.cart_details.grand_total) ? asyncChildResponse.cart_details.grand_total :0;
						response.total_discount = (asyncChildResponse.cart_details.total_discount) ? asyncChildResponse.cart_details.total_discount :0;
						response.cart_count 	= (asyncChildResponse.cart_count) ? asyncChildResponse.cart_count :0;

						/** Send success response **/
						resolve(response);
					});
				}).catch(next);
			}else{

				/** Set cart conditions */
				let cartConditions = {
					_id : cartId,
				};

				if(userId){
					cartConditions.customer_id 	= 	userId;
				}else{
					cartConditions.device_id	=	deviceId;
				}

				/** Update cart item qty */
				const user_carts = 	this.db.collection(Tables.USER_CARTS);
				user_carts.updateOne(cartConditions,
				{$set: {
					qty 	 : qty,
					modified : Helpers.getUtcDate(),
				}}).then(() => {
					asyncParallel({
						cart_details : (childCallback)=>{
							/** Get cart total */
							let cartOptions = {
								user_id 		: userId,
								device_id 		: deviceId,
								cart_total_only : true,
							};

							this.getUserCartList(req,res,next,cartOptions).then(cartResponse=>{
								if(cartResponse.status != Constants.STATUS_SUCCESS) return childCallback(cartResponse);
								childCallback(null,cartResponse);
							}).catch(next);
						},
						cart_count : (childCallback)=>{
							/** Get cart coount */
							this.getCartCount(req,res,next).then(cartResponse=>{
								if(cartResponse.status != Constants.STATUS_SUCCESS) return childCallback(cartResponse);
								childCallback(null,cartResponse.count);
							}).catch(next);
						},
					},(asyncChildErr, asyncChildResponse)=>{
						if(asyncChildErr) return next(asyncChildErr);

						/** Send success response **/
						resolve({
							status			: Constants.STATUS_SUCCESS,
							total_amount 	: asyncChildResponse.cart_details.grand_total,
							total_discount 	: asyncChildResponse.cart_details.total_discount,
							cart_count 		: asyncChildResponse.cart_count,
							message 		: res.__("user_carts.qty_has_been_updated_successfully"),
						});
					});
				}).catch(next);
			}
		}).catch(next);
	} // end updateCartQty()

	/**
	 * Function to check offer
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	checkUserOffer(req, res, next, options) {
		return new Promise(resolve=>{
			let userId		= 	(options.user_id)		?	new ObjectId(options.user_id)		:"";
            let deviceId	= 	(options.device_id)		?	options.device_id				:"";
			let branchId	= 	(options.branch_id) 	?	new ObjectId(options.branch_id)		:"";
			let restaurantId= 	(options.restaurant_id)	?	new ObjectId(options.restaurant_id)	:"";
            let offerCode	= 	(options.offer_code)	?	options.offer_code				:"";
            let offerId		= 	(options.offer_id)		?	new ObjectId(options.offer_id)		:"";
			let orderId		= 	(options.order_id)		?	new ObjectId(options.order_id)		:"";
			let mainDeviceId= 	(options.main_device_id)?	options.main_device_id			:"";

			/** Send error response **/
			if((!userId && !deviceId )|| !branchId || !restaurantId || (!offerCode && !offerId)){
				return resolve({status: Constants.STATUS_ERROR, message:res.__("system.missing_parameters")});
			}

			const offers 		=	this.db.collection(Tables.OFFERS);
			const offer_logs 	= 	this.db.collection(Tables.OFFER_LOGS);
			asyncParallel({
				restaurant_details : (callback)=>{
					/** Get restaurant details **/
					const restaurants = this.db.collection(Tables.RESTAURANTS);
					restaurants.findOne({
						_id 		: restaurantId,
						status      : Constants.ACTIVE,
						is_deleted  : Constants.NOT_DELETED,
						concept_id	: {$exists : true}
					},{projection: {concept_id: 1}}).then((restaurantResult) => callback(null, restaurantResult)).catch(callback);
				},
				user_details : (callback)=>{
					if(!userId) return callback(null,null);

					/** Set user conditions */
					let userConditions 		= clone(Constants.CUSTOMER_COMMON_CONDITIONS);
					userConditions._id		= userId;
					userConditions.is_guest	= {$exists: false};
					userConditions.created	= {$gte: Helpers.newDate(Helpers.subtractDate(Constants.NEW_USER_DAYS*Constants.HOURS_IN_A_DAY))};

					/** Check user type **/
					const users = this.db.collection(Tables.USERS);
					users.countDocuments(userConditions).then((userResult) => callback(null, userResult)).catch(callback);
				},
				cart_list : (callback)=>{
					/** Set cart options */
					let cartOptions 			=	clone(options);
					cartOptions.is_check_offer	=	true;

					if(orderId && cartOptions.user_id) delete cartOptions.user_id;

					/** Get user cart list */
					this.getUserCartList(req,res,next,cartOptions).then(response=>{
						callback(null,response);
					}).catch(next);
				},
				user_offer_used : (callback)=>{
					if(offerId) return callback(null,{});

					/** Set offer conditions */
					let offerConditions = {};
					if(offerId) 	offerConditions.offer_id 	= offerId;
					if(offerCode) 	offerConditions.offer_code 	={$regex:'^'+offerCode+'$','$options':'i'};

					if(userId){
						offerConditions.user_id		= 	userId;
					}else if(orderId){
						offerConditions.device_id	=	mainDeviceId;
					}else{
						offerConditions.device_id	=	deviceId;
					}

					/** Check offer used or not by user in pervious **/
					const offer_used = this.db.collection(Tables.OFFER_USED);
					offer_used.findOne(offerConditions,{projection: {offer_used: 1, total_amount_used: 1}})
						.then((offerResult) => callback(null, offerResult)).catch(callback);
				},
				offer_used_count : (callback)=>{
					let offerConditions = {};
					if(offerId) 	offerConditions.offer_id 	= offerId;
					if(offerCode) 	offerConditions.offer_code 	={$regex:'^'+offerCode+'$','$options':'i'};

					offer_logs.countDocuments(offerConditions).then((offerResult) => callback(null, offerResult)).catch(callback);
				},
				order_details : (callback)=>{
					if(!orderId) return callback(null,null);

					let offerConditions = {};
					if(offerId) 	offerConditions.offer_id 	= offerId;
					if(offerCode) 	offerConditions.offer_code 	={$regex:'^'+offerCode+'$','$options':'i'};

					const order_details = this.db.collection(Tables.ORDER_DETAILS);
					order_details.findOne({order_id: orderId},{projection: {offer_code: 1}})
						.then((orderResult) => callback(null, orderResult)).catch(callback);
				},
				user_corporate_details : (callback)=>{
					if(!userId) return callback(null,null);

					let userConditions 			= clone(Constants.CUSTOMER_COMMON_CONDITIONS);
					userConditions._id			= userId;
					userConditions.corporate_id	= {$exists: true};

					const users = this.db.collection(Tables.USERS);
					users.findOne(userConditions,{projection: {corporate_id: 1}})
						.then((userResult) => callback(null, userResult)).catch(callback);
				},
				offer_details : (callback)=>{
					if(!offerCode) return callback(null,true);

					offers.findOne({
						offer_code : {$regex:'^'+offerCode+'$','$options':'i'}
					},{projection: {_id: 1}})
						.then((offerResult) => {
							let isOfferValid = (offerResult && offerResult._id) ? true : false;
							callback(null, isOfferValid);
						})
						.catch(callback);
				},
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				/** Send error response  */
				if(asyncResponse.cart_list.status != Constants.STATUS_SUCCESS || !asyncResponse.cart_list.result || asyncResponse.cart_list.result.length <=0){
					return resolve({status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });
				}

				/** Send error response  */
				if(offerCode && !asyncResponse.offer_details){
					return resolve({status: Constants.STATUS_ERROR, message: res.__("offers.entered_offer_code_not_valid") });
				}

				let restaurantDetails	=  (asyncResponse.restaurant_details) ? 	asyncResponse.restaurant_details :{};
				let corporateDetails	=  (asyncResponse.user_corporate_details) ? 	asyncResponse.user_corporate_details :{};
				let corporateId	=  (corporateDetails.corporate_id) ? corporateDetails.corporate_id :"";
				let orderDetails  		=  (asyncResponse.order_details) ? 	asyncResponse.order_details :{};
				let lastOrderOfferCode  =  (orderDetails.offer_code)	 ?	orderDetails.offer_code :"";
				let userDetails 		=  asyncResponse.user_details;
				let cartList 			=  asyncResponse.cart_list;
				let userOfferUsed 		=  (asyncResponse.user_offer_used) ? asyncResponse.user_offer_used :{};
				let itemListArray 		=  (cartList.item_ids)		?	cartList.item_ids		:[];
				let categoryIdsArray	=  (cartList.category_ids) 	? 	cartList.category_ids 	:[];
				let cuisineIdsArray		=  (cartList.cuisine_ids)	?	cartList.cuisine_ids	:[];
				let totalItemPrice 		=  cartList.total_item_price;
				let totalOfferUsed 		=  asyncResponse.offer_used_count;
				let userOfferUsedCount	=  (userOfferUsed.offer_used) ? userOfferUsed.offer_used :0;
				let itemIdsArray		=  [];
				let checkRedeem			=  true;

				/** This conditions user when admin order modify  */
				if(orderId && offerCode && offerCode == lastOrderOfferCode) checkRedeem = false;

				itemListArray.map(records=>{
					itemIdsArray.push(records.item_id);
				});

				/** Manage user type (guest, new user, registered user ) */
				let userType = (deviceId && !userId) ? Constants.APPLICABLE_FOR_GUEST :((userDetails >0) ?  Constants.APPLICABLE_FOR_NEW_USERS :Constants.APPLICABLE_FOR_REGISTERED_MEMBER);

				let fromDate = Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_START_DATE_FORMAT));
				let toDate   = Helpers.newDate(Helpers.newDate("",Constants.CURRENTDATE_END_DATE_FORMAT));

				/** Add offer conditions */
				let offerConditions = {
					is_active	:	Constants.ACTIVE,
					status		:	Constants.OFFER_PUBLISHED,
					$and		:	[
						{$or : [
							{"applicable_for.0" : {$exists: false}},
							{applicable_for	   : {$in: [userType]}}
						]},
						{$or : [
							{"restaurant_ids.0" : {$exists: false}},
							{restaurant_ids	 	: {$in: [restaurantId]}}
						]},
						{$or : [
							{"branch_ids.0" : {$exists: false}},
							{branch_ids	 	: {$in: [branchId]}}
						]},
						{$or : [
							{"cuisine_ids.0" : {$exists: false}},
							{cuisine_ids	 : {$in: cuisineIdsArray}}
						]},
						{$or : [
							{$and :[
								{"item_ids.0" : {$exists: false}},
								{offer_type : {$ne: Constants.COMBO_OFFER}}
							]},
							{$and :[
								{item_ids : {$in: itemIdsArray}},
								{item_offer_type: {$ne: Constants.ITEM_WISE_OFFER}}
							]},
							{$and :[
								{"item_ids.0" : {$exists: false}},
								{item_offer_type: Constants.ITEM_WISE_OFFER}
							]},
						]},
						{$or : [
							{$and :[
								{min_amount : ""},
								{max_amount : ""}
							]},
							{$or :[
								{$and : [
									{min_amount : {$gte: totalItemPrice } },
									{max_amount : {$lte: totalItemPrice } }
								]},
								{$and : [
									{max_amount : {$gte: totalItemPrice } },
									{min_amount : {$lte: totalItemPrice } }
								]},
								{$and :[
									{max_amount : "" },
									{min_amount : {$lte: totalItemPrice } }
								]},
								{$and :[
									{min_amount : "" },
									{max_amount : {$gte: totalItemPrice } }
								]},
							]},
						]},
						{$or : [
							{$and : [
								{ valid_from : {$gte : Helpers.newDate(fromDate)} },
								{ valid_to   : {$lte : Helpers.newDate(toDate)} }
							]},
							{$and : [
								{ valid_to 	 : {$gte : Helpers.newDate(fromDate)} },
								{ valid_from : {$lte : Helpers.newDate(toDate)} }
							]}
						]}
					],
				};

				if(offerId) 	offerConditions._id 		= offerId;
				if(offerCode) 	offerConditions.offer_code 	= {$regex:'^'+offerCode+'$','$options':'i'};

				if(restaurantDetails && restaurantDetails._id){
					offerConditions['kfg_offer_id'] 	= {$exists : true, $nin : ["",null]};
					offerConditions['kfg_offer_name'] 	= {$exists : true, $nin : ["",null] };
				}

				if(categoryIdsArray.length >0){
					offerConditions["$and"].push({$or: [
						{"category_ids.0": {$exists: false}},
						{category_ids	 : {$in: categoryIdsArray}}
					]});
				}

				if(userId){
					offerConditions["$and"].push({$or: [
						{"user_ids.0": {$exists: false}},
						{user_ids	 : {$in: [userId]} }
					]});
				}

				if(checkRedeem){
					/** Add conditions if user already used this offer  */
					if(userOfferUsedCount >0){
						offerConditions["$and"].push({$or:[
							{total_unique_redeem: "" },
							{total_unique_redeem: {$gt: userOfferUsedCount}},
						]});
					}

					/** Add conditions if this offer used count is greater than 1 */
					if(totalOfferUsed >0){
						offerConditions["$and"].push({$or:[
							{total_redeem: "" },
							{total_redeem: {$gt: totalOfferUsed	}},
						]});
					}
				}

				if(corporateId){
					offerConditions["$and"].push({$or: [
						{"corporate_ids.0" : {$exists: false}},
						{corporate_ids	   : {$in: [corporateId]}}
					]});
				}else{
					offerConditions.offer_type = {$ne: Constants.CORPORATE_OFFER};
				}

				/** Get offer details */
				offers.findOne(offerConditions,{projection: {item_ids: 1, item_offer_type: 1, minimum_items:1, offer_type: 1, offer_value: 1, redeem_type: 1, user_specific_redeem:1, global_redeem:1, discount_price:1, item_ids: 1, discount_type:1,offer_max_amount:1,multiple_redeem_type:1, offer_code:1, is_free_delivery:1,restaurant_discount_ratio:1,kfg_offer_id:1,kfg_offer_name:1}})
					.then((offerResult) => {
					/** Send error response */
					if(!offerResult) return resolve({status: Constants.STATUS_ERROR, message: res.__("offers.this_offer_code_is_either_expired_or_not_active_yet") });

					let kfgOfferId 	   	= (offerResult.kfg_offer_id) 		? offerResult.kfg_offer_id	  :"";
					let kfgOfferName  	= (offerResult.kfg_offer_name) 		? offerResult.kfg_offer_name	  :"";
					let itemOfferType 	= (offerResult.item_offer_type)  ? offerResult.item_offer_type  :"";
					let minimumItems   	= (offerResult.minimum_items) 	? offerResult.minimum_items   :0;
					let offerType      	= (offerResult.offer_type) 		? offerResult.offer_type      :"";

					/** Check offer type is combo  or item offer type is general */
					if(offerType == Constants.COMBO_OFFER && itemOfferType == Constants.GENERAL_ITEM_OFFER){
						let matchedItems = 0;

						offerResult.item_ids.forEach(tempItemId=>{
							itemIdsArray.forEach(tmpId=>{
								if(String(tmpId) == String(tempItemId)) matchedItems++;
							});
						});

						/** Send error response */
						if(matchedItems < minimumItems){
							return resolve({status: Constants.STATUS_ERROR, message: res.__("offers.this_offer_code_is_either_expired_or_not_active_yet") });
						}
					}

					asyncParallel({
						item_list : (callback)=>{
							if(offerType != Constants.COMBO_OFFER || itemOfferType != Constants.ITEM_WISE_OFFER) return callback(null,null);

							const offer_items = 	this.db.collection(Tables.OFFER_ITEMS);
							offer_items.find({
								offer_id 	 	: offerResult._id,
								item_id 		: {$in: itemIdsArray},
								restaurant_id 	: restaurantId,
							},{projection: {price: 1, item_id: 1}}).toArray()
								.then((itemOfferResult) => callback(null, itemOfferResult))
								.catch(callback);
						},
					},(asyncSubErr, asyncSubResponse)=>{
						if(asyncSubErr) return next(asyncSubErr);

						/** Send error response */
						let offerItemList = asyncSubResponse.item_list;
						if(offerType == Constants.COMBO_OFFER && itemOfferType == Constants.ITEM_WISE_OFFER && (offerItemList.length <=0 || offerItemList.length < minimumItems)){
							return resolve({status:Constants.STATUS_ERROR, message:res.__("offers.this_offer_code_is_either_expired_or_not_active_yet") });
						}

						/** Calculate discount for combo offer */
						let totalDiscount = 0;
						let itemWiseOffer = [];
						if(offerType == Constants.COMBO_OFFER){
							if(itemOfferType == Constants.GENERAL_ITEM_OFFER){
								totalDiscount = offerResult.discount_price;
							}else if(itemOfferType == Constants.ITEM_WISE_OFFER) {
								offerItemList.map(records=>{
									itemListArray.map(data=>{
										if(String(data.item_id) == String(records.item_id)){
											let tmpPercentage   =  records.price;
											let tmpItemPrice 	=  data.price;
											let tmpDiscount 	=  Helpers.round((tmpItemPrice*tmpPercentage)/100);

											if(totalDiscount >= totalItemPrice) tmpDiscount =0;

											totalDiscount += tmpDiscount;

											itemWiseOffer.push({
												item_id  : records.item_id,
												discount : tmpDiscount,
											});
										}
									});
								});
							}
						}

						/** Calculate discount for other offer type */
						if(offerType != Constants.COMBO_OFFER){
							let offerMaxAmount= (offerResult.offer_max_amount) ? offerResult.offer_max_amount :0;
							let offerValue 	= (offerResult.offer_value) ? offerResult.offer_value :0;
							let discountType= (offerResult.discount_type) ? offerResult.discount_type :"";

							if(discountType == Constants.DISCOUNT_TYPE_VALUE){
								totalDiscount = offerValue;
							}else{
								let tmpDiscount = Helpers.round((totalItemPrice*offerValue)/100);
								totalDiscount	= (tmpDiscount > offerMaxAmount) ? offerMaxAmount :tmpDiscount;
							}
						}

						/** Check if total dicount is more then item price */
						if(totalDiscount > totalItemPrice) totalDiscount = totalItemPrice;

						/** Send error response */
						if(totalDiscount ==0){
							return resolve({
								status : Constants.STATUS_ERROR,
								message:  res.__("offers.this_offer_code_is_either_expired_or_not_active_yet"),
							});
						}

						/** Send success response */
						resolve({
							status : Constants.STATUS_SUCCESS,
							result : {
								offer_id 	: offerResult._id,
								discount 	: totalDiscount,
								offer_type 	: offerType,
								order_price : totalItemPrice,
								item_list 	: itemWiseOffer,
								offer_code 	: offerResult.offer_code,
								restaurant_discount_ratio 	: offerResult.restaurant_discount_ratio,
								is_free_delivery: offerResult.is_free_delivery,
								same_offer_code	: (!checkRedeem) ? true :false,
								kfg_offer_id : kfgOfferId,
								kfg_offer_name : kfgOfferName
							},
						});
					});
				}).catch(next);
			});
		}).catch(next);
	} // end checkUserOffer()

	/**
	 * Function to get wallet balance
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	getUserWalletBalance(req, res, next) {
		return new Promise(async(resolve)=>{
			/** Sanitize Data **/
			req.body 	=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId	=	(req.body.user_id)	?	new ObjectId(req.body.user_id)	:"";

			/** Send error response **/
			if(!userId) return resolve({status:Constants.STATUS_ERROR,message:res.__("system.missing_parameters")});

			/** Get wallet balance */
			let response = await Helpers.getWalletBalance(req,res,next,{user_id: userId});

			/** Send response */
			resolve({
				status 	: 	Constants.STATUS_SUCCESS,
				result	:	response,
				max_point_usage_percentage	:	(res.locals.settings["Points_system.max_point_usage"]) ?	parseFloat(res.locals.settings["Points_system.max_point_usage"])	:0,
				amount_per_points			:	(res.locals.settings["Points_system.amount_per_points"]) ?	parseFloat(res.locals.settings["Points_system.amount_per_points"])	:0,
				minimum_value_for_order		:	(res.locals.settings["Points_system.minimum_value_for_order"]) ?	parseFloat(res.locals.settings["Points_system.minimum_value_for_order"])	:0,
			});
		}).catch(next);
	} // end getUserWalletBalance()

	/**
	 * Function to check order schedule
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	checkOrderSchedule(req, res, next) {
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 		=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId		= 	(req.body.user_id)			?	new ObjectId(req.body.user_id)		:"";
			let branchId	= 	(req.body.branch_id) 		?	new ObjectId(req.body.branch_id)	:"";
			let restaurantId= 	(req.body.restaurant_id)	?	new ObjectId(req.body.restaurant_id):"";
			let deviceId	= 	(req.body.device_id)		?	req.body.device_id				:"";
			let scheduledTime=	(req.body.scheduled_time)	?	req.body.scheduled_time			:"";

			/** Send error response **/
			if((!userId && !deviceId )|| !branchId || !restaurantId || !scheduledTime){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters")});
			}

			/** Get total scheduled days form current date */
			let diffInMinute    	= 	Helpers.getDifferenceBetweenTwoDatesInMinute(Helpers.newDate(),scheduledTime);
			let totalScheduledDays 	=	parseInt(diffInMinute/(Constants.HOURS_IN_A_DAY*Constants.MINUTES_IN_A_HOUR));

			/** Set cart options */
			let cartOptions 					=	clone(req.body);
			cartOptions.is_branch_availability	=	true;

			/** Get user cart list */
			this.getUserCartList(req,res,next,cartOptions).then(response=>{
				if(response.status != Constants.STATUS_SUCCESS) return resolve(response);

				/** Send error response **/
				if(!response.result || response.result.length <=0){
					return resolve({status: Constants.STATUS_ERROR, message: res.__("user_carts.cart_not_have_any_item") });
				}

				let cartList 	= 	response.result;
				let allItemList	=	{};
				let areaIdList	=	{};
				var tmpDate		=	new Date(scheduledTime);
				let scheduleDay = 	parseInt(tmpDate.getUTCDay());
				let scheduleTime= 	parseFloat(Helpers.newDate(scheduledTime,Constants.TIME_FORMAT));
				cartList.map(records=>{
					records.item_list.map(data=>{
						allItemList[data.item_id] = data.item_id;
					});

					areaIdList[records.area_id] = records.area_id;

					if(records.block_branch_id)  branchId = records.block_branch_id;

				});
				allItemList = 	Object.values(allItemList);
				areaIdList	=	Object.values(areaIdList);

				asyncParallel({
					items_availability : (callback)=>{
						/** Set availability item conditions **/
						let availabilityConditions = {
							item_id		:	{$in : allItemList},
							from_time	:	{$lte: scheduleTime},
							to_time		:	{$gte: scheduleTime},
						};

						/** Get availability item list **/
						const item_availability	= this.db.collection(Tables.ITEM_AVAILABILITY);
						item_availability.distinct("item_id", availabilityConditions)
							.then((availabilityResult) => {
								if(availabilityResult.length <=0 || availabilityResult.length < allItemList.length) return callback(null, false);

								let linkItemConditions = {
									item_id	:	{$in:  allItemList},
									$or : [
										{ type : Constants.ITEM_NOT_LISTED_TO_SELECTED_BRANCH_LIST, branch_ids: { $nin: [ branchId] } },
										{ type: Constants.ITEM_LISTED_TO_SELECTED_BRANCH_LIST, $or : [ {branch_ids: { $size: 0} }, {branch_ids : { $in: [ branchId ] } } ] }
									]
								};

								const item_linkings	= this.db.collection(Tables.ITEM_LINKINGS);
								return item_linkings.distinct("item_id", linkItemConditions);
							})
							.then((linkingResult) => {
								if(linkingResult.length <=0 || linkingResult.length < allItemList.length) return callback(null, false);

								let itemConditions = {
									_id				:	{$in: linkingResult},
									restaurant_id	:	restaurantId,
									is_active		:	Constants.ACTIVE,
								};

								const items	= this.db.collection(Tables.ITEMS);
								return items.distinct("_id", itemConditions);
							})
							.then((itemResult) => {
								let itemAvailability = (itemResult && itemResult.length >0 && itemResult.length >= allItemList.length) ? true : false;
								callback(null, itemAvailability);
							})
							.catch(callback);
					},
					branch_availability: (callback)=>{

						/** Add calendar conditions */
						let calendarConditions = {
							branch_id	:	branchId,
							parent_id	:	"",
							status		: 	Constants.OPEN,
							type		: 	Constants.DEFAULT_WEEK,
						};

						/** Get calendar details */
						const restaurant_branch_calendars	= this.db.collection(Tables.RESTAURANT_BRANCH_CALENDARS);
						restaurant_branch_calendars.aggregate([
							{$match : calendarConditions},
							{$lookup:	{
								from     : Tables.RESTAURANT_BRANCH_CALENDARS,
								let      : {parentId : "$_id", branchId : "$branch_id"},
								pipeline : [
									{$match : {
										$expr: {
											$and : [
												{$eq: ["$branch_id", "$$branchId"]},
												{$eq: ["$parent_id", "$$parentId"]},
												{$eq: ["$day", scheduleDay]},
											]
										}
									}},
									{$project : { to_hour: 1, to_minute: 1, from_hour: 1, from_minute: 1 }},
								],
								as	:	"exception_details"
							}},
							{$lookup:	{ /** Check this branch close or not today */
								from     : Tables.RESTAURANT_BRANCH_CALENDARS,
								let      : {branchId : "$branch_id"},
								pipeline : [
									{$match : {
										$expr: {
											$and : [
												{$eq: ["$branch_id", "$$branchId"]},
												{$eq: ["$day", scheduleDay]},
												{$eq: ["$status",Constants.CLOSE]},
												{$eq: ["$type", Constants.WEEK_DAY]},
											]
										}
									}},
								],
								as	:	"close_day_details"
							}},
							{$match: {
								close_day_details : {$size : 0}
							}}
						]).toArray()
							.then((result) => {
							if(result.length <=0) return callback(null, false);

							let calendarDetails = result[0];
							let exceptionList	= (calendarDetails.exception_details) ? calendarDetails.exception_details:[];
							let openFromHour 	=	(calendarDetails.from_hour)	?	calendarDetails.from_hour		:"00";
							let openFromMinute 	=	(calendarDetails.from_minute)?	calendarDetails.from_minute	:"00";
							let openToHour 		=	(calendarDetails.to_hour)	?	calendarDetails.to_hour		:"00";
							let openToMinute 	=	(calendarDetails.to_minute)	?	calendarDetails.to_minute		:"00";

							if(String(openFromMinute).length ==1) 	openFromMinute 	= 	"0"+openFromMinute;
							if(String(openToMinute).length ==1) 	openToMinute	= 	"0"+openToMinute;

							let scheduleOpenTime=	Helpers.newDate(scheduledTime,Constants.OPEN_TIME_FORMAT);
							scheduleOpenTime	=	parseFloat(scheduleOpenTime.replace(':','.'));
							let openFrom		=	parseFloat(openFromHour+"."+openFromMinute);
							let openTo			=	parseFloat(openToHour+"."+openToMinute);
							let openCount  		= 	0;
							let closeCount 		= 	0;
							let isOverNight 	=	(openTo < openFrom) ? true :false;

							if(openFrom <= scheduleOpenTime && openTo>=scheduleOpenTime) openCount++;

							if((openFrom <= scheduleOpenTime || (isOverNight && (openFrom >= scheduleOpenTime && openTo >= scheduleOpenTime ))) && (openTo >= scheduleOpenTime || isOverNight)){
								openCount++;
							}

							if(exceptionList.length>0){
								exceptionList.forEach(records=>{
									let exceptionFromHour 	=	(records.from_hour)	?	records.from_hour :"00";
									let exceptionFromMinute =	(records.from_minute)?	records.from_minute :"00";
									let exceptionToHour		=	(records.to_hour)	?	records.to_hour	 :"00";
									let exceptionToMinute 	=	(records.to_minute)	? records.to_minute :"00";

									if(String(exceptionFromMinute).length ==1){
										exceptionFromMinute 	= 	"0"+exceptionFromMinute;
									}
									if(String(exceptionToMinute).length ==1){
										exceptionToMinute	= 	"0"+exceptionToMinute;
									}

									let exceptionFrom	=	parseFloat(exceptionFromHour+"."+exceptionFromMinute);
									let exceptionTo		=	parseFloat(exceptionToHour+"."+exceptionToMinute);

									if(exceptionFrom <= scheduleOpenTime && exceptionTo>=scheduleOpenTime){
										closeCount++;
									}
								});
							}
							let branchAvailability = (openCount >=1 && closeCount<1) ? true :false;

							callback(null, branchAvailability);
						})
							.catch(callback);
					},
					area_scheduling_availability: (callback)=>{
						const restaurant_branch_areas	= this.db.collection(Tables.RESTAURANT_BRANCH_AREAS);
						restaurant_branch_areas.find({
							branch_id				:	branchId,
							area_id					:	{$in: areaIdList},
							restaurant_id			:	restaurantId,
							open					:	Constants.OPEN,
							accept_scheduling_orders:	Constants.ACCEPT
						},{projection: {_id: 1}}).toArray()
							.then((areaResult) => {
								let acceptAreaIds 	= (areaResult) ? areaResult :[];
								let acceptScheduling= (acceptAreaIds.length == areaIdList.length) ? true : false;
								callback(null, acceptScheduling);
							})
							.catch(callback);
					},
					attribute_details: (callback)=>{
						const restaurant_branch_attributes= this.db.collection(Tables.RESTAURANT_BRANCH_ATTRIBUTES);
						restaurant_branch_attributes.findOne({
							branch_id	  :	branchId,
							attribute_id  :	Constants.MAXIMUM_DURATION_IN_DAYS_FOR_SCHEDULED_ORDERS_ATTRIBUTE_ID
						},{projection: {_id: 0,value:1}})
							.then((attributeResult) => {
								attributeResult = (attributeResult) ? attributeResult:{};
								callback(null, attributeResult);
							})
							.catch(callback);
					},
				},(asyncErr, asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					let itemsAvailability 	= 	asyncResponse.items_availability;
					let branchAvailability	=	asyncResponse.branch_availability;
					let areaAvailability	=	asyncResponse.area_scheduling_availability;
					let attributeDetails 	= 	asyncResponse.attribute_details;
					let totalAllowDays 		=	attributeDetails.value ? parseFloat(attributeDetails.value) :"";

					/** Send error response **/
					if(totalAllowDays &&  totalAllowDays < totalScheduledDays){
						return resolve({ status: Constants.STATUS_ERROR, message: res.__("user_carts.branch_allow_max_schedule_day",totalAllowDays) });
					}

					/** Send success response */
					resolve({
						status 				: 	Constants.STATUS_SUCCESS,
						branch_available 	:	(branchAvailability && itemsAvailability && areaAvailability) ? true :false
					});
				});
			}).catch(next);
		}).catch(next);
	} // end checkOrderSchedule()

	/**
	 * Function to check order pickup store
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	checkOrderPickUpStore(req, res, next) {
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 		=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId		= 	(req.body.user_id)			?	new ObjectId(req.body.user_id)		:"";
			let branchId	= 	(req.body.branch_id) 		?	new ObjectId(req.body.branch_id)	:"";
			let restaurantId= 	(req.body.restaurant_id)	?	new ObjectId(req.body.restaurant_id):"";
			let deviceId	= 	(req.body.device_id)		?	req.body.device_id				:"";
			let scheduledTime= 	(req.body.scheduled_time)	?	req.body.scheduled_time			:Helpers.newDate();

			/** Send error response **/
			if((!userId && !deviceId )|| !branchId || !restaurantId){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters")});
			}

			/** Get total scheduled days form current date */
			let diffInMinute    	= 	Helpers.getDifferenceBetweenTwoDatesInMinute(Helpers.newDate(),scheduledTime);
			let totalScheduledDays 	=	parseInt(diffInMinute/(Constants.HOURS_IN_A_DAY*Constants.MINUTES_IN_A_HOUR));

			/** Set cart options */
			let cartOptions 					=	clone(req.body);
			cartOptions.is_branch_availability	=	true;

			/** Get user cart list */
			this.getUserCartList(req,res,next,cartOptions).then(response=>{
				if(response.status != Constants.STATUS_SUCCESS) return resolve(response);

				/** Send error response **/
				if(!response.result || response.result.length <=0){
					return resolve({
						status	: 	Constants.STATUS_ERROR,
						message	:	res.__("user_carts.cart_not_have_any_item")
					});
				}

				let cartList 	= 	response.result;
				let allItemList	=	{};
				var tmpDate		=	new Date(scheduledTime);
				let scheduleDay = 	parseInt(tmpDate.getUTCDay());
				let scheduleTime= 	parseFloat(Helpers.newDate(scheduledTime,Constants.TIME_FORMAT));
				cartList.map(records=>{
					records.item_list.map(data=>{
						allItemList[data.item_id] = data.item_id;
					});
				});
				allItemList = Object.values(allItemList);

				asyncParallel({
					items_availability : (callback)=>{
						/** Set availability item conditions **/
						let availabilityConditions = {
							item_id		:	{$in : allItemList},
							from_time	:	{$lte: scheduleTime},
							to_time		:	{$gte: scheduleTime},
						};

						/** Get availability item list **/
						const item_availability	= this.db.collection(Tables.ITEM_AVAILABILITY);
						item_availability.distinct("item_id", availabilityConditions)
							.then((availabilityResult) => {
								if(availabilityResult.length <=0 || availabilityResult.length < allItemList.length) return callback(null, false);

								let linkItemConditions = {
									item_id	:	{$in:  allItemList},
									$or : [
										{ type : Constants.ITEM_NOT_LISTED_TO_SELECTED_BRANCH_LIST, branch_ids: { $nin: [ branchId] } },
										{ type: Constants.ITEM_LISTED_TO_SELECTED_BRANCH_LIST, $or : [ {branch_ids: { $size: 0} }, {branch_ids : { $in: [ branchId ] } } ] }
									]
								};

								const item_linkings	= this.db.collection(Tables.ITEM_LINKINGS);
								return item_linkings.distinct("item_id", linkItemConditions);
							})
							.then((linkingResult) => {
								if(linkingResult.length <=0 || linkingResult.length < allItemList.length) return callback(null, false);

								let itemConditions = {
									_id				:	{$in: linkingResult},
									restaurant_id	:	restaurantId,
									is_active		:	Constants.ACTIVE,
								};

								const items	= this.db.collection(Tables.ITEMS);
								return items.distinct("_id", itemConditions);
							})
							.then((itemResult) => {
								let itemAvailability = (itemResult && itemResult.length >0 && itemResult.length >= allItemList.length) ? true : false;
								callback(null, itemAvailability);
							})
							.catch(callback);
					},
					branch_availability: (callback)=>{

						/** Add calendar conditions */
						let calendarConditions = {
							branch_id	:	branchId,
							parent_id	:	"",
							status		: 	Constants.OPEN,
							type		: 	Constants.DEFAULT_WEEK,
						};

						/** Get calendar details */
						const restaurant_branch_calendars	= this.db.collection(Tables.RESTAURANT_BRANCH_CALENDARS);
						restaurant_branch_calendars.aggregate([
							{$match : calendarConditions},
							{$lookup:	{
								from     : Tables.RESTAURANT_BRANCH_CALENDARS,
								let      : {parentId : "$_id", branchId : "$branch_id"},
								pipeline : [
									{$match : {
										$expr: {
											$and : [
												{$eq: ["$branch_id", "$$branchId"]},
												{$eq: ["$parent_id", "$$parentId"]},
												{$eq: ["$day", scheduleDay]},
											]
										}
									}},
									{$project : { to_hour: 1, to_minute: 1, from_hour: 1, from_minute: 1 }},
								],
								as	:	"exception_details"
							}},
							{$lookup:	{ /** Check this branch close or not today */
								from     : Tables.RESTAURANT_BRANCH_CALENDARS,
								let      : {branchId : "$branch_id"},
								pipeline : [
									{$match : {
										$expr: {
											$and : [
												{$eq: ["$branch_id", "$$branchId"]},
												{$eq: ["$day", scheduleDay]},
												{$eq: ["$status",Constants.CLOSE]},
												{$eq: ["$type", Constants.WEEK_DAY]},
											]
										}
									}},
								],
								as	:	"close_day_details"
							}},
							{$match: {
								close_day_details : {$size : 0}
							}}
						]).toArray()
							.then((result)=>{
							if(result.length <=0) return callback(null,false);

							let calendarDetails = result[0];
							let exceptionList	= (calendarDetails.exception_details) ? calendarDetails.exception_details:[];
							let openFromHour 	=	(calendarDetails.from_hour)	?	calendarDetails.from_hour	:"00";
							let openFromMinute 	=	(calendarDetails.from_minute)?	calendarDetails.from_minute	:"00";
							let openToHour 		=	(calendarDetails.to_hour)	?	calendarDetails.to_hour		:"00";
							let openToMinute 	=	(calendarDetails.to_minute)	?	calendarDetails.to_minute	:"00";

							if(String(openFromMinute).length ==1) 	openFromMinute 	= 	"0"+openFromMinute;
							if(String(openToMinute).length ==1) 	openToMinute	= 	"0"+openToMinute;

							let scheduleOpenTime=	Helpers.newDate(scheduledTime,Constants.OPEN_TIME_FORMAT);
							scheduleOpenTime	=	parseFloat(scheduleOpenTime.replace(':','.'));
							let openFrom		=	parseFloat(openFromHour+"."+openFromMinute);
							let openTo			=	parseFloat(openToHour+"."+openToMinute);
							let openCount  		= 	0;
							let closeCount 		= 	0;
							let isOverNight 	=	(openTo < openFrom) ? true :false;

							if(openFrom <= scheduleOpenTime && openTo>=scheduleOpenTime) openCount++;

							if((openFrom <= scheduleOpenTime || (isOverNight && (openFrom >= scheduleOpenTime && openTo >= scheduleOpenTime ))) && (openTo >= scheduleOpenTime || isOverNight)){
								openCount++;
							}

							if(exceptionList.length>0){
								exceptionList.map(records=>{
									let exceptionFromHour 	=	(records.from_hour)	?	records.from_hour :"00";
									let exceptionFromMinute =	(records.from_minute)?	records.from_minute :"00";
									let exceptionToHour		=	(records.to_hour)	?	records.to_hour	 :"00";
									let exceptionToMinute 	=	(records.to_minute)	? records.to_minute :"00";

									if(String(exceptionFromMinute).length ==1){
										exceptionFromMinute 	= 	"0"+exceptionFromMinute;
									}
									if(String(exceptionToMinute).length ==1){
										exceptionToMinute	= 	"0"+exceptionToMinute;
									}

									let exceptionFrom	=	parseFloat(exceptionFromHour+"."+exceptionFromMinute);
									let exceptionTo		=	parseFloat(exceptionToHour+"."+exceptionToMinute);

									if(exceptionFrom <= scheduleOpenTime && exceptionTo>=scheduleOpenTime){
										closeCount++;
									}
								});
							}
							let branchAvailability = (openCount >=1 && closeCount<1) ? true :false;

							callback(null,branchAvailability);
						})
							.catch(callback);
					},
					attribute_details: (callback)=>{
						const restaurant_branch_attributes= this.db.collection(Tables.RESTAURANT_BRANCH_ATTRIBUTES);
						restaurant_branch_attributes.findOne({
							branch_id	  :	branchId,
							attribute_id  :	Constants.MAXIMUM_DURATION_IN_DAYS_FOR_SCHEDULED_ORDERS_ATTRIBUTE_ID
						},{projection: {_id: 0,value:1}})
							.then((attributeResult) => {
								attributeResult = (attributeResult) ? attributeResult:{};
								callback(null, attributeResult);
							})
							.catch(callback);
					},
				},(asyncErr, asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					let itemsAvailability 	= 	asyncResponse.items_availability;
					let branchAvailability	=	asyncResponse.branch_availability;
					let attributeDetails 	= 	asyncResponse.attribute_details;
					let totalAllowDays 	= attributeDetails.value ? parseFloat(attributeDetails.value) :"";

					/** Send error response **/
					if(totalAllowDays &&  totalAllowDays < totalScheduledDays){
						return resolve({
							status	: 	Constants.STATUS_ERROR,
							message	:	res.__("user_carts.branch_allow_max_schedule_day",totalAllowDays)
						});
					}

					/** Send success response */
					resolve({
						status 				: 	Constants.STATUS_SUCCESS,
						branch_available 	:	(branchAvailability && itemsAvailability) ? true :false,
					});
				});
			}).catch(next);
		}).catch(next);
	} // end checkOrderPickUpStore()

	/**
	 * Function to check delivery address
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	checkDeliveryAddress(req, res, next) {
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 			=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let userId			= 	(req.body.user_id)			?	new ObjectId(req.body.user_id)			:"";
			let deviceId		= 	(req.body.device_id)		?	req.body.device_id					:"";
			let blockId			= 	(req.body.block_id)			?	new ObjectId(req.body.block_id)			:"";
			let areaId			= 	(req.body.area_id)			?	new ObjectId(req.body.area_id)			:"";
			let branchId		= 	(req.body.branch_id) 		?	new ObjectId(req.body.branch_id)		:"";
			let restaurantId	= 	(req.body.restaurant_id)	?	new ObjectId(req.body.restaurant_id)	:"";
			let selectedAreaId 	= 	(req.body.selected_area_id)	?	new ObjectId(req.body.selected_area_id)	:"";
			let checkOnlyAvailability= 	(req.body.check_only_availability)? req.body.check_only_availability :false;

			/** Send error response **/
			if((!userId && !deviceId ) || !branchId || !restaurantId || !areaId){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters")});
			}

			/** Send error response **/
			if(selectedAreaId && String(selectedAreaId) != String(areaId)){
				return resolve({status: Constants.STATUS_ERROR, is_different_area: true, message: res.__("user_carts.selected_address_area_different")});
			}

			/** Set cart conditions  */
			let cartConditions = {};
			if(userId){
				cartConditions.customer_id 	= 	userId;
			}else{
				cartConditions.device_id	=	deviceId;
			}
			cartConditions.branch_id		=	branchId;
			cartConditions.restaurant_id	=	restaurantId;

			const user_carts = this.db.collection(Tables.USER_CARTS);
			asyncParallel({
				update_cart: (childCallback)=>{
					if(checkOnlyAvailability) return childCallback(null);

					user_carts.updateMany(cartConditions,{$unset: { block_branch_id : 1 }}).then(() => childCallback(null)).catch(next);
				},
			},(asyncChildErr)=>{
				if(asyncChildErr) return next(asyncChildErr);

				asyncParallel({
					branch_availability: (callback)=>{
						/** Check branch this open */
						const restaurant_branches = this.db.collection(Tables.RESTAURANT_BRANCHES);
						restaurant_branches.findOne({
							_id 			: 	branchId,
							is_active 		: 	Constants.ACTIVE,
							branch_status 	: 	Constants.OPEN,
							restaurant_id 	: 	restaurantId,
						},{projection: {_id: 1}}).then((branchResult) => callback(null, branchResult)).catch(next);
					},
					area_availability: (callback)=>{
						const restaurant_branch_areas 	= this.db.collection(Tables.RESTAURANT_BRANCH_AREAS);
						restaurant_branch_areas.findOne({
							branch_id 		: 	branchId,
							area_id 		: 	areaId,
							restaurant_id 	: 	restaurantId,
							open 			: 	Constants.OPEN,
						},{projection: {_id: 1, kfg_store:1, block_ids:1, delivery_fees: 1}}).then((areaResult) => {
							if(!areaResult || !areaResult.kfg_store){
								return callback(null, {branch_available : areaResult, branch_id : branchId});
							}

							let blockIds		=	(areaResult.block_ids) ? areaResult.block_ids : [];
							let isBlockMatched	=	false;
							if(blockIds.length > 0){
								blockIds.forEach(record => {
									if(String(blockId) == String(record)) isBlockMatched = areaResult;
								});
							}
							if(isBlockMatched || checkOnlyAvailability){
								return callback(null, {branch_available : isBlockMatched, branch_id : branchId});
							}

							this.checkAvailableBranchInBlock(req, res, next,{
								branch_id 		:	branchId,
								block_id		: 	blockId,
								area_id			: 	areaId,
								user_id			: 	userId,
								device_id		: 	deviceId,
								restaurant_id	: 	restaurantId,
							}).then((apiResponse) => {
								if(!apiResponse || apiResponse.status !== Constants.STATUS_SUCCESS) return callback(apiResponse && apiResponse.message, {branch_available : false, branch_id : ""});
								if(!apiResponse.branch_available) return callback(null, {branch_available : apiResponse.branch_available, branch_id : apiResponse.branch_id});

								user_carts.updateMany(cartConditions, {$set: { block_branch_id : new ObjectId(apiResponse.branch_id) }}).then(() => callback(null, {branch_available : apiResponse.branch_available, branch_id : apiResponse.branch_id})).catch(next);
							}).catch(next);
						}).catch(next);
					},
				},(asyncErr, asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					let branchAvailability	=	asyncResponse.branch_availability;
					let areaAvailability	=	asyncResponse.area_availability;
					let isAreaAvailable		=	areaAvailability.branch_available;

					/** Send success response */
					resolve({
						status 		: 	Constants.STATUS_SUCCESS,
						is_delivery	:	(branchAvailability  && isAreaAvailable) ? true :false,
						branch_id	:	areaAvailability.branch_id,
						area_details:	areaAvailability.branch_available,
						message		:	(!branchAvailability || !isAreaAvailable) ? res.__("user_carts.branch_not_provide_at_this_location") :""
					});
				});
			});
		}).catch(next);
	} // end checkDeliveryAddress()

	/**
	 * Function to check branch available in selected blocks and items
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	checkAvailableBranchInBlock(req, res, next, options) {
		return new Promise(resolve=>{
			let userId				= 	(options.user_id)		?	new ObjectId(options.user_id)		:"";
			let areaId				= 	(options.area_id)		?	new ObjectId(options.area_id)		:"";
			let blockId				= 	(options.block_id)		?	new ObjectId(options.block_id)		:"";
			let deviceId			= 	(options.device_id)		?	options.device_id				:"";
			let restaurantId		= 	(options.restaurant_id)	?	new ObjectId(options.restaurant_id)	:"";
			let perviouesBranchId	= 	(options.branch_id)		?	new ObjectId(options.branch_id)		:"";

			/** Send error response **/
			if((!userId && !deviceId ) || !areaId || !blockId || !perviouesBranchId || !restaurantId){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters"), body: req.body});
			}

			asyncParallel({
				cart_list : (parentCallback)=>{
					let conditions = {};
					if(userId){
						conditions.customer_id 	= 	userId;
					}else{
						conditions.device_id	=	deviceId;
					}
					conditions.branch_id		=	perviouesBranchId;
					conditions.restaurant_id	=	restaurantId;
					conditions["$or"]			=	[
						{max_modified_time : {$exists: false}},
						{max_modified_time : {$gte: Helpers.newDate()}},
					];

					/** Get cart list */
					const user_carts = this.db.collection(Tables.USER_CARTS);
					user_carts.aggregate([
						{$match : 	conditions},
						{$lookup:	{
							from     : Tables.ITEMS,
							let      : {itemId : "$item_id"},
							pipeline : [
								{$match : {
									$expr: {
										$and : [
											{$eq: ["$_id", "$$itemId"]},
											{$eq: ["$is_active", Constants.ACTIVE]},
										]
									}
								}},
								{$project : {_id: 1}},
							],
							as:	"item_details"
						}},
						{$match:{
							"item_details._id" : {$exists: true}
						}},
						{$sort		: {created: Constants.SORT_DESC}},
						{$project	: {created: 0, modified: 0, item_details: 0}},
					]).toArray()
						.then((cartResult) => parentCallback(null, cartResult))
						.catch(parentCallback);
				},
				branch_list : (parentCallback)=>{
					const restaurant_branch_areas 	= this.db.collection(Tables.RESTAURANT_BRANCH_AREAS);
					restaurant_branch_areas.find({
						restaurant_id 	: 	restaurantId,
						branch_id 		: 	{$ne : perviouesBranchId},
						area_id 		: 	areaId,
						block_ids	 	: 	{$in: [blockId]},
						open 			: 	Constants.OPEN,
					},{projection: {_id: 1, kfg_store:1, branch_id:1}}).toArray()
						.then((areaResult) => parentCallback(null, areaResult))
						.catch(parentCallback);
				}
			},(parentErr, parentResponse)=>{
				if(parentErr) return next(parentErr);

				let cartList 	= 	parentResponse.cart_list;
				let branchList 	=	parentResponse.branch_list;

				/** Send error response */
				if(cartList.length == 0) return resolve({status: Constants.STATUS_ERROR, message : res.__("user_carts.cart_not_have_any_item") });

				/** Send success response */
				if(branchList.length == 0) return resolve({status : Constants.STATUS_SUCCESS, branch_available : false, branch_id: "", branchList: branchList	});

				/** Create item id array */
				let itemIds	=	[];
				cartList.map(records=>{
					itemIds.push(records.item_id);
				});

				const items							=	this.db.collection(Tables.ITEMS);
				const item_linkings					=	this.db.collection(Tables.ITEM_LINKINGS);
				const item_availability				= 	this.db.collection(Tables.ITEM_AVAILABILITY);
				const restaurant_branch_calendars	=	this.db.collection(Tables.RESTAURANT_BRANCH_CALENDARS);

				let scheduledTime	=	Helpers.newDate();
				let tmpDate			=	new Date(scheduledTime);
				let scheduleDay 	= 	parseInt(tmpDate.getUTCDay());
				let scheduleTime	= 	parseFloat(Helpers.newDate(scheduledTime,Constants.TIME_FORMAT));
				let newBranchId		=	"";
				let isBranchFound	= 	false;
				eachOfSeries(branchList, (branchArea, index, seriesCallback) => {
					if(isBranchFound) return seriesCallback(null);

					let branchId = new ObjectId(branchArea.branch_id);
					asyncParallel({
						items_availability : (callback)=>{
							let availabilityConditions = {
								item_id		:	{$in : itemIds},
								from_time	:	{$lte: scheduleTime},
								to_time		:	{$gte: scheduleTime},
							};

							item_availability.distinct("item_id", availabilityConditions)
								.then((availabilityResult) => {
									if(availabilityResult.length <=0 || availabilityResult.length < itemIds.length) return callback(null, false);

									let linkItemConditions = {
										item_id	:	{$in:  availabilityResult},
										$or : [
											{ type : Constants.ITEM_NOT_LISTED_TO_SELECTED_BRANCH_LIST, branch_ids: { $nin: [ branchId] } },
											{ type: Constants.ITEM_LISTED_TO_SELECTED_BRANCH_LIST, $or : [ {branch_ids: { $size: 0} }, {branch_ids : { $in: [ branchId ] } } ] }
										]
									};

									return item_linkings.distinct("item_id", linkItemConditions);
								})
								.then((linkingResult) => {
									if(linkingResult.length <=0 || linkingResult.length < itemIds.length) return callback(null, false);

									let itemConditions = {
										_id				:	{$in: linkingResult},
										restaurant_id	:	restaurantId,
										is_active		:	Constants.ACTIVE,
									};

									return items.distinct("_id", itemConditions);
								})
								.then((itemResult) => {
									let itemAvailability = (itemResult && itemResult.length >0 && itemResult.length >= itemIds.length) ? true : false;
									callback(null, itemAvailability);
								})
								.catch(callback);
						},
						branch_availability: (callback)=>{

							/** Add calendar conditions */
							let calendarConditions = {
								branch_id	:	branchId,
								parent_id	:	"",
								status		: 	Constants.OPEN,
								type		: 	Constants.DEFAULT_WEEK,
							};

							/** Get calendar details */
							restaurant_branch_calendars.aggregate([
								{$match : calendarConditions},
								{$lookup:	{
									from     : Tables.RESTAURANT_BRANCH_CALENDARS,
									let      : {parentId : "$_id", branchId : "$branch_id"},
									pipeline : [
										{$match : {
											$expr: {
												$and : [
													{$eq: ["$branch_id", "$$branchId"]},
													{$eq: ["$parent_id", "$$parentId"]},
													{$eq: ["$day", scheduleDay]},
												]
											}
										}},
										{$project : { to_hour: 1, to_minute: 1, from_hour: 1, from_minute: 1 }},
									],
									as	:	"exception_details"
								}},
								{$lookup:	{ /** Check this branch close or not today */
									from     : Tables.RESTAURANT_BRANCH_CALENDARS,
									let      : {branchId : "$branch_id"},
									pipeline : [
										{$match : {
											$expr: {
												$and : [
													{$eq: ["$branch_id", "$$branchId"]},
													{$eq: ["$day", scheduleDay]},
													{$eq: ["$status",Constants.CLOSE]},
													{$eq: ["$type", Constants.WEEK_DAY]},
												]
											}
										}},
									],
									as	:	"close_day_details"
								}},
								{$match: {
									close_day_details : {$size : 0}
								}}
							]).toArray()
								.then((result)=>{
								if(result.length <=0) return callback(null,false);

								let calendarDetails = result[0];
								let exceptionList	= (calendarDetails.exception_details) ? calendarDetails.exception_details:[];
								let openFromHour 	=	(calendarDetails.from_hour)	?	calendarDetails.from_hour		:"00";
								let openFromMinute 	=	(calendarDetails.from_minute)?	calendarDetails.from_minute	:"00";
								let openToHour 		=	(calendarDetails.to_hour)	?	calendarDetails.to_hour		:"00";
								let openToMinute 	=	(calendarDetails.to_minute)	?	calendarDetails.to_minute		:"00";

								if(String(openFromMinute).length ==1) 	openFromMinute 	= 	"0"+openFromMinute;
								if(String(openToMinute).length ==1) 	openToMinute	= 	"0"+openToMinute;

								let scheduleOpenTime=	Helpers.newDate(scheduledTime,Constants.OPEN_TIME_FORMAT);
								scheduleOpenTime	=	parseFloat(scheduleOpenTime.replace(':','.'));
								let openFrom		=	parseFloat(openFromHour+"."+openFromMinute);
								let openTo			=	parseFloat(openToHour+"."+openToMinute);
								let openCount  		= 	0;
								let closeCount 		= 	0;
								let isOverNight 	=	(openTo < openFrom) ? true :false;

								if(openFrom <= scheduleOpenTime && openTo>=scheduleOpenTime) openCount++;

								if((openFrom <= scheduleOpenTime || (isOverNight && (openFrom >= scheduleOpenTime && openTo >= scheduleOpenTime ))) && (openTo >= scheduleOpenTime || isOverNight)){
									openCount++;
								}

								if(exceptionList.length>0){
									exceptionList.map(records=>{
										let exceptionFromHour 	=	(records.from_hour)	?	records.from_hour :"00";
										let exceptionFromMinute =	(records.from_minute)?	records.from_minute :"00";
										let exceptionToHour		=	(records.to_hour)	?	records.to_hour	 :"00";
										let exceptionToMinute 	=	(records.to_minute)	? records.to_minute :"00";

										if(String(exceptionFromMinute).length ==1){
											exceptionFromMinute 	= 	"0"+exceptionFromMinute;
										}
										if(String(exceptionToMinute).length ==1){
											exceptionToMinute	= 	"0"+exceptionToMinute;
										}

										let exceptionFrom	=	parseFloat(exceptionFromHour+"."+exceptionFromMinute);
										let exceptionTo		=	parseFloat(exceptionToHour+"."+exceptionToMinute);

										if(exceptionFrom <= scheduleOpenTime && exceptionTo>=scheduleOpenTime){
											closeCount++;
										}
									});
								}
								let branchAvailability = (openCount >=1 && closeCount<1) ? true :false;

								callback(null,branchAvailability);
							})
								.catch(callback);
						},
					},(asyncErr, asyncResponse)=>{
						if(asyncErr) return seriesCallback(asyncErr);

						let itemsAvailability 	= asyncResponse.items_availability;
						let branchAvailability	= asyncResponse.branch_availability;

						if(branchAvailability && itemsAvailability){
							newBranchId		= branchId;
							isBranchFound	= true;
						}
						seriesCallback(null);
					});
				},(seriesErr)=>{
					if(seriesErr) return next(seriesErr);

					resolve({
						status				: 	Constants.STATUS_SUCCESS,
						branch_id			: 	newBranchId,
						branch_available	:	isBranchFound,
					});
				});
			});
		}).catch(next);
	} // end checkAvailableBranchInBlock()

	/**
	 * Function to remove offer from cart
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	removeOfferFromCart(req, res, next) {
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 		=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let deviceId	= 	(req.body.device_id)		?	req.body.device_id				:"";
			let userId		= 	(req.body.user_id)			?	new ObjectId(req.body.user_id)		:"";
			let branchId	= 	(req.body.branch_id) 		?	new ObjectId(req.body.branch_id)	:"";
			let restaurantId= 	(req.body.restaurant_id)	?	new ObjectId(req.body.restaurant_id):"";
			let offerId		= 	(req.body.offer_id)			?	new ObjectId(req.body.offer_id)		:"";

			/** Send error response **/
			if((!userId && !deviceId)|| !branchId || !restaurantId || !offerId){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters")});
			}

			/** Set cart conditions */
			let cartConditions ={
				branch_id 		: branchId,
				restaurant_id 	: restaurantId,
				offer_id        : offerId
			};

			if(userId){
				cartConditions.customer_id 	= 	userId;
			}else{
				cartConditions.device_id	=	deviceId;
			}

			/** Find user cart details */
			const user_carts = this.db.collection(Tables.USER_CARTS);
			user_carts.distinct("_id", cartConditions)
				.then((cartIds) => {
				/** Send error response **/
				if(cartIds.length <=0) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

				asyncParallel({
					update_offer_logs : (parentCallback)=>{
						const offer_logs  = this.db.collection(Tables.OFFER_LOGS);
						offer_logs.findOne({ cart_ids: { $in: cartIds } },{projection: {_id: 1,order_discount:1,offer_id:1}})
							.then((logResult) => {
								if(!logResult) return parentCallback(null);

								let tmpLogId 	= logResult._id;
								let logDiscount = logResult.order_discount;
								let logOfferId 	= logResult.offer_id;

								let offerUsedConditions = { offer_id : logOfferId };
								if(userId) offerUsedConditions.user_id = userId;
								else offerUsedConditions.device_id = deviceId;

								const offer_used  = this.db.collection(Tables.OFFER_USED);
								offer_used.updateOne(offerUsedConditions,{
									$set : { modified: Helpers.getUtcDate() },
									$inc : { offer_used : -1, total_amount_used : logDiscount*-1 },
									$pull : { offer_log_ids : tmpLogId },
								})
									.then(() => offer_logs.deleteOne({_id: tmpLogId}))
									.then(() => parentCallback(null))
									.catch(parentCallback);
							})
							.catch(parentCallback);
					},
					update_tmp_offer_logs : (parentCallback)=>{
						const tmp_offer_logs = this.db.collection(Tables.TMP_OFFER_LOGS);
						tmp_offer_logs.deleteMany({cart_ids: {$in: cartIds}}).then(() => parentCallback(null)).catch(parentCallback);
					},
					update_cart : (parentCallback)=>{
						user_carts.updateMany(
							{ _id: {$in: cartIds} },
							{ $unset : { offer_id : 1 } }
						).then(() => parentCallback(null)).catch(parentCallback);
					},
				},(asyncParentErr)=>{
					if(asyncParentErr) return next(asyncParentErr);

					/** Send success response */
					resolve({
						status  : Constants.STATUS_SUCCESS,
						message	:	res.__("user_carts.offer_has_been_removed_successfully_from_cart")
					});
				});
			}).catch(next);
		}).catch(next);
	} // end removeOfferFromCart()

	/**
	 * Function to create supplier invoice
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	getSupplierInvoice(req, res, next) {
		return new Promise(resolve=>{
			/** Sanitize Data **/
			req.body 				=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
            let userId				= 	(req.body.user_id)			?	new ObjectId(req.body.user_id)			:"";
            let deviceId			= 	(req.body.device_id)		?	req.body.device_id					:"";
			let paymentMethod		=	(req.body.payment_method)	?	req.body.payment_method				:"";
			let walletDebitAmount	=	(req.body.wallet_amount)	?	parseFloat(req.body.wallet_amount)	:0;
            let orderRestaurantList	=	(req.body.order_restaurant_list) ? req.body.order_restaurant_list	:[];

			/** Send error response **/
			if((!userId && !deviceId) || orderRestaurantList.constructor != Array || orderRestaurantList.length == 0 || !paymentMethod){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters"), body: req.body });
			}

			let restaurantIdArray	=	[];
			let pickupBranchList 	=  	{};
			let missingObject	 	=  	{};
			let tmpRestObj	 		=  	{};
			orderRestaurantList.map(records=>{
				let restaurantId	=	records.restaurant_id;
				let branchId    	= 	records.branch_id;
				let deliveryBy     	= 	records.delivery_by;

				if(restaurantId && branchId){
					restaurantIdArray.push(new ObjectId(restaurantId));

					if(!tmpRestObj[restaurantId]) tmpRestObj[restaurantId] ={};
					if(!tmpRestObj[restaurantId][branchId]) tmpRestObj[restaurantId][branchId] ={};
					tmpRestObj[restaurantId][branchId]  = records;

					if(deliveryBy == Constants.DELIVERY_BY_PICK_UP){
						if(!pickupBranchList[restaurantId]) pickupBranchList[restaurantId] ={};
						pickupBranchList[restaurantId] = branchId;
					}
				}else{
					if(!branchId)	 	missingObject.branch_id 	= true;
					if(!restaurantId)	missingObject.restaurant_id = true;
				}
			});

			/** Send error response */
			if(Object.keys(missingObject).length >0){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters"), missingObject: missingObject});
			}

			asyncParallel({
				cart_list: (callback)=>{
					/** Get cart list */
					let cartOptions 					=	clone(req.body);
					cartOptions.is_place_order 			= 	true;
					cartOptions.pickup_branch_list 		= 	pickupBranchList;
					this.getUserCartList(req,res,next,cartOptions).then(response=>{
						callback(null,response);
					}).catch(next);
				},
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				/** Send error response */
				if(asyncResponse.cart_list.status != Constants.STATUS_SUCCESS) return resolve({status: Constants.STATUS_ERROR,cart_list : asyncResponse.cart_list});

				if(asyncResponse.cart_list.length ==0){
					return resolve({status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again"), asyncResponse: asyncResponse });
				}

				const supplier_invoice_logs	= 	this.db.collection(Tables.SUPPLIER_INVOICE_LOGS);
				let cartList 		= 	asyncResponse.cart_list.result;
				let invoiceArray	=	[];
				let logsArray		=	[];
				let cartIds 		= 	[];
				let orderTotalAmount=	0;
				cartList.map(records=>{
					let restaurantId 	= 	records.restaurant_id;
					let branchId    	= 	records.branch_id;
					let supplierCode 	= 	records.supplier_code;
					let offerDiscount 	= 	records.offer_discount;
					let offerRestRatio 	= 	records.restaurant_discount_ratio;
					let totalAmount 	=	records.total_amount;
					let itemList 	 	=	records.item_list;
					let deliveryBy     	= 	records.delivery_by;
					let deliveryFees    = 	records.delivery_fees;
					let branchDiscount 	= 	(records.branch_discount) ? records.branch_discount :0;
					let totalDiscount   = 	(records.discount)	?	records.discount	:0;
					let netAmount 		=	totalAmount;
					let grossAmount 	=	netAmount+totalDiscount-deliveryFees;
					let systemDeliveryFess=	(deliveryBy != Constants.DELIVERY_BY_RESTAURANT) ? deliveryFees :0;
					let commissionDetails= 	(records.commission_details) ? records.commission_details :{};
					let paymentResult	=	(commissionDetails.payment_method) ? commissionDetails.payment_method :[];
					let commissionObj	=	(commissionDetails.commission_value && commissionDetails.commission_value[deliveryBy]) ? commissionDetails.commission_value[deliveryBy] :{};

					let logObj 	= {};
					itemList.map(itemData=>{
						cartIds.push(itemData._id);
					});

					let totalPayableAmount 	= 	totalAmount;
					let orderWalletAmount	=	0;
					if(walletDebitAmount >0){
						if(walletDebitAmount >= totalAmount){
							totalPayableAmount 	= 	0;
							orderWalletAmount 	=	totalAmount;
							walletDebitAmount 	=	walletDebitAmount-totalAmount;
						}else if(walletDebitAmount < totalAmount){
							orderWalletAmount 	=	walletDebitAmount;
							totalPayableAmount	=	totalAmount- walletDebitAmount;
							walletDebitAmount	=	0;
						}
					}

					/** Manage logs object */
					logObj.restaurant_id 				= 	restaurantId;
					logObj.wallet_amount 				=	orderWalletAmount;
					logObj.total_discount 				=	totalDiscount;
					logObj.delivery_fees 				=	deliveryFees;
					logObj.supplier_code 				=	supplierCode;
					logObj.net_amount_without_wallet 	=	netAmount;
					logObj.gross_amount_without_wallet	=	grossAmount;
					logObj.total_payable_amount 		=	totalPayableAmount;
					logObj.branch_discount				=	(branchDiscount)	? 	branchDiscount	:0;
					logObj.branch_discount_type			=	(records.branch_discount_type)	? 	records.branch_discount_type :"";
					logObj.restaurant_discount			=	0;
					logObj.offer_discount				=	(offerDiscount)		? 	offerDiscount	:0;
					logObj.restaurant_offer_ratio		=	(offerRestRatio) 	?	offerRestRatio 	:0;

					if(totalPayableAmount > 0 && supplierCode){
						let finalNetAmount 		=	netAmount-orderWalletAmount;
						let finalGrossAmount 	=	grossAmount-orderWalletAmount;
						let gateWayCharges		=	0;
						let restDiscount		=	0;
						let systemPayout		=	0;

						if(offerRestRatio && offerDiscount){
							restDiscount =  Helpers.round(offerDiscount*offerRestRatio/100);
						}

						/** Manage logs object */
						logObj.total_payable_amount 	=	totalPayableAmount;
						logObj.net_amount_with_wallet 	=	finalNetAmount;
						logObj.gross_amount_with_wallet	=	finalGrossAmount;
						logObj.restaurant_discount		=	restDiscount;

						/** Let calculate payment gateway charges  */
						if(paymentResult.length >0){
							paymentResult.map(payData=>{
								if(payData.method == paymentMethod){
									let commissionPer		=	payData.commission;
									let commissionValues	=	payData.values;
									let commissionType 		= 	payData.commission_type;
									let commissionCriteria 	=	payData.commission_criteria;
									let paymentAmount		=	(commissionCriteria == Constants.GROSS_AMOUNT) ? finalGrossAmount :finalNetAmount;

									if(!commissionType){
										gateWayCharges = paymentAmount*commissionPer/100;
									}else if(commissionValues && commissionValues.constructor === Array &&  commissionValues.length >0){
										if(commissionType == Constants.COMMISSION_FIXED || commissionType == Constants.COMMISSION_VARIABLE){
											let tmpPercentage = (commissionValues[0].commission) ? commissionValues[0].commission :0;

											if(commissionType == Constants.COMMISSION_VARIABLE){
												commissionValues.map(value=>{
													if(totalAmount >= value.from && totalAmount <= value.to){
														tmpPercentage =	(value.commission) ? value.commission :0;
													}
												});
											}

											if(tmpPercentage >0){
												gateWayCharges = paymentAmount*tmpPercentage/100;
											}
										}else if(commissionType == Constants.COMMISSION_FIXED_AMOUNT){
											gateWayCharges	=	(commissionValues[0].amount) ? commissionValues[0].amount :0;
										}
									}

									/** Manage logs object */
									logObj.gateway_charges_details 	= payData;
									logObj.gateway_charges_amount 	= paymentAmount;
									logObj.final_gateway_charges 	= gateWayCharges;
								}
							});
						}

						/** calculate system payout */
						if(commissionObj && commissionObj.constructor === Object && Object.keys(commissionObj).length >0){
							let commiValues		=	commissionObj.values;
							let commiType 		= 	commissionObj.commission_type;
							let commiCriteria 	=	commissionObj.commission_criteria;
							let commiAmount		=	(commiCriteria == Constants.GROSS_AMOUNT) ? finalGrossAmount :finalNetAmount;

							if(commiValues && commiValues.constructor === Array &&  commiValues.length >0){
								if(commiType == Constants.COMMISSION_FIXED || commiType == Constants.COMMISSION_VARIABLE){
									let tmpPercentage = (commiValues[0].commission) ? commiValues[0].commission :0;

									if(commiType == Constants.COMMISSION_VARIABLE){
										commiValues.map(value=>{
											if(totalAmount >= value.from && totalAmount <= value.to){
												tmpPercentage =	(value.commission) ? value.commission :0;
											}
										});
									}

									if(tmpPercentage >0){
										systemPayout = commiAmount*tmpPercentage/100;
									}
								}else if(commiType == Constants.COMMISSION_FIXED_AMOUNT){
									systemPayout	=	(commiValues[0].amount) ? commiValues[0].amount :0;
								}
							}

							/** Manage logs object */
							logObj.commission_details 	= 	commissionObj;
							logObj.commission_amount 	=	commiAmount;
							logObj.final_commission 	= 	systemPayout;
						}

						orderTotalAmount 	+= 	totalPayableAmount;
						let proposedShare	= 	totalPayableAmount-systemPayout-gateWayCharges-restDiscount-systemDeliveryFess;
						invoiceArray.push({
							"SupplierCode" : supplierCode,
							"InvoiceShare" : totalPayableAmount,
							"ProposedShare": (proposedShare >0) ? proposedShare :0
						});

						/** Manage logs object */
						logObj.invoice_share 		=	totalPayableAmount;
						logObj.proposed_share 		=	(proposedShare >0) ? proposedShare :0;
						logObj.actual_proposed_share=	proposedShare;

						logsArray.push(logObj);
					}else{
						logObj.not_create_supplier = true;

						logsArray.push(logObj);
					}
				});

				/** Save supplier invoice logs */
				supplier_invoice_logs.insertOne({
					user_id		: userId,
					device_id	: deviceId,
					cart_ids	: cartIds,
					request		: req.body,
					invoice_list: invoiceArray,
					calculation	: logsArray,
					created		: Helpers.getUtcDate()
				},()=>{ });

				/** Send success response */
				resolve({
					status		 : 	Constants.STATUS_SUCCESS,
					invoice_data :	invoiceArray,
					total_amount :	orderTotalAmount,
				});
			});
		}).catch(next);
	} // end getSupplierInvoice()

}
