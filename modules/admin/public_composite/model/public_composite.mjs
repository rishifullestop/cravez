import { ObjectId } from 'mongodb';
import clone from 'clone';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, arrayToObject, getDropdownList, newDate } from '../../../../utils/index.mjs';
import { saveSystemLogs } from '../../../../services/index.mjs';

class PublicComposite {
	constructor(db) {
		this.db = db;
		this.collection = db.collection(Tables.PUBLIC_COMPOSITE_OFFERS);
	}

	async getCompositeList(req, res, next) {
		try {
			if (isPost(req)) {
				const limit = req.body.length ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
				const skip = req.body.start ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;

				const dataTableConfig = await configDatatable(req, res, null);

				const pipeline = [
					{
						$facet: {
							result: [
								{ $match: dataTableConfig.conditions },
								{ $sort: dataTableConfig.sort_conditions },
								{ $skip: skip },
								{ $limit: limit },
								{
									$project: {
										_id: 1,
										minimum_order_amount: 1,
										free_delivery: 1,
										created: 1,
										is_active: 1
									}
								}
							],
							filter_records: [
								{ $match: dataTableConfig.conditions },
								{ $count: 'count' }
							],
							total_records: [
								{ $count: 'count' }
							]
						}
					}
				];

				const dbRes = await this.collection.aggregate(pipeline).toArray();
				const facet = dbRes?.[0] || {};

				return res.send({
					status: Constants.STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: facet.result || [],
					recordsFiltered: facet.filter_records?.[0]?.count || 0,
					recordsTotal: facet.total_records?.[0]?.count || 0
				});
			}

			const haveResult = await this.collection.countDocuments({});
			req.breadcrumbs(BREADCRUMBS['admin/public_composite/list']);
			return res.render('list', { haveResult: haveResult || 0 });
		} catch (err) {
			next(err);
		}
	}

	async compositeDetails(req, res, next) {
		try {
			const compositeId = req.params.id || '';
			const result = await this.collection.findOne(
				{ _id: new ObjectId(compositeId) },
				{
					projection: {
						_id: 1,
						discounts: 1,
						free_delivery: 1,
						minimum_order_amount: 1,
						kfg_offer_id: 1,
						kfg_offer_name: 1
					}
				}
			);

			if (!result) {
				return {
					status: Constants.STATUS_ERROR,
					message: res.__('admin.system.invalid_access')
				};
			}

			return {
				status: Constants.STATUS_SUCCESS,
				result
			};
		} catch (err) {
			next(err);
		}
	}

	async addEditComposite(req, res, next) {
		const isEditable = !!(req.params && req.params.id);
		const compositeId = req.params?.id ? new ObjectId(req.params.id) : new ObjectId();
		const authId = req.session.user && req.session.user._id ? req.session.user._id : '';

		try {
			if (isPost(req)) {
				req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);

				const discount = req.body.discount || [];
				const freeDelivery = !!req.body.free_delivery;
				const minOrderAmount = freeDelivery && req.body.min_order_amount ? req.body.min_order_amount : 0;
				const kfgOfferId = req.body.kfg_offer_id || '';
				const kfgOfferName = req.body.kfg_offer_name || '';

				const errors = [];
				if(discount.length > 0){
					discount.map((data)=>{
						let index =  data.index;
						if(data.min_order_amount || data.max_order_amount || data.discount_type || data.discount_value){
							if(!data.min_order_amount){
								let param = "min_order_amount_"+index;
								errors.push({'param':param,'msg':res.__("admin.public_composite.please_enter_min_order_amount")});
							}else{
								if(data.min_order_amount && (isNaN(data.min_order_amount))){
									errors.push({ 'param': 'min_order_amount_'+index, 'msg': res.__("admin.public_composite.please_enter_valid_min_order_amount") });
								}
							}
							if(!data.max_order_amount){
								let param = "max_order_amount_"+index;
								errors.push({'param':param,'msg':res.__("admin.public_composite.please_enter_max_order_amount")});
							}else{
								if(data.max_order_amount && (isNaN(data.max_order_amount) || data.max_order_amount <=0)){
									errors.push({ 'param': 'max_order_amount_'+index, 'msg': res.__("admin.public_composite.please_enter_valid_max_order_amount") });
								}
							}
							if(!data.discount_type){
								let param = "discount_type_"+index;
								errors.push({'param':param,'msg':res.__("admin.public_composite.please_select_discount_type")});
							}
							if(!data.discount_value){
								let param = "discount_value_"+index;
								errors.push({'param':param,'msg':res.__("admin.public_composite.please_enter_discount_value")});
							}else{
								if(data.discount_value &&  (isNaN(data.discount_value) || data.discount_value <= 0)){
									errors.push({'param':'discount_value_'+index,'msg':res.__("admin.public_composite.please_enter_valid_discount_value")});
								}else if(data.discount_type == Constants.DISCOUNT_BY_PERCENTAGE && data.discount_value > Constants.MAX_PERCENTAGE){
									errors.push({'param':'discount_value_'+index,'msg':res.__("admin.public_composite.please_enter_valid_discount_value")});
								}
							}
							if(data.min_order_amount && data.max_order_amount && parseFloat(data.max_order_amount) < parseFloat(data.min_order_amount)){
								let param = "min_order_amount_"+index;
								errors.push({'param':param,'msg':res.__("admin.public_composite.min_should_not_greater")});
							}
						}
					});
				}

				/** Send error response **/
				if(errors.length >0) return res.send({status: Constants.STATUS_ERROR, message: errors});

				const discountData = [];
				if (Array.isArray(discount) && discount.length > 0) {
					for (const data of discount) {
						if (
							data.min_order_amount ||
							data.max_order_amount ||
							data.discount_type ||
							data.discount_value
						) {
							discountData.push({
								min_order_amount: parseFloat(data.min_order_amount),
								max_order_amount: parseFloat(data.max_order_amount),
								discount_type: data.discount_type,
								discount_value: parseFloat(data.discount_value)
							});
						}
					}
				}

				const dataToBeUpdated = {
					$set: {
						discounts: discountData,
						free_delivery: freeDelivery,
						minimum_order_amount: parseFloat(minOrderAmount) || 0,
						kfg_offer_id: kfgOfferId,
						kfg_offer_name: kfgOfferName,
						modified: getUtcDate()
					},
					$setOnInsert: {
						is_active: Constants.ACTIVE,
						user_id: new ObjectId(authId),
						created: getUtcDate()
					}
				};

				await this.collection.updateOne({ _id: compositeId }, dataToBeUpdated, { upsert: true });

				const message = isEditable
					? res.__('admin.public_composite.public_composite_updated')
					: res.__('admin.public_composite.public_composite_added');

				req.flash(Constants.STATUS_SUCCESS, message);

				await saveSystemLogs(req, res, {
					user_id: authId,
					parent_id: compositeId,
					activity_module: Constants.SYSTEM_LOG_MODULE_COMPOSITE,
					activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
					additional_details: {}
				});

				return res.send({
					status: Constants.STATUS_SUCCESS,
					redirect_url: Constants.WEBSITE_ADMIN_URL + 'public_composite'
				});
			}

			let response = { status: Constants.STATUS_SUCCESS, result: {} };
			if (isEditable) {
				response = await this.compositeDetails(req, res, next);
				if (response.status !== Constants.STATUS_SUCCESS) {
					return res.status(400).send({
						status: Constants.STATUS_ERROR,
						message: response.message
					});
				}
			}

			return res.render('add_edit', {
				layout: false,
				result: response.result || {},
				is_editable: isEditable
			});
		} catch (err) {
			next(err);
		}
	}

	async updateStatus(req, res, next) {
		try {
			const compositeId = req.params.id || '';
			const compositeStatus =
				String(req.params.status) === String(Constants.ACTIVE) ? Constants.DEACTIVE : Constants.ACTIVE;

			await this.collection.updateOne(
				{ _id: new ObjectId(compositeId) },
				{
					$set: {
						is_active: compositeStatus,
						modified: getUtcDate()
					}
				}
			);

			req.flash(Constants.STATUS_SUCCESS, res.__('admin.public_composite.status_has_been_updated_successfully'));
			return res.redirect(Constants.WEBSITE_ADMIN_URL + 'public_composite');
		} catch (err) {
			next(err);
		}
	}
}

export default PublicComposite;

