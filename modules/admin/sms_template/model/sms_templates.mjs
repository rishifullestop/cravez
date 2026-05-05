import { ObjectId } from 'mongodb';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable } from '../../../../utils/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { saveSystemLogs } from '../../../../services/index.mjs';

class SmsTemplate {
	constructor(db) {
		this.db = db;
		this.collectionDb = db.collection(Tables.SMS_TEMPLATES);
	}

	/**
	 * Get SMS template list
	 */
	async list(req, res, next) {
		try {
			if (isPost(req)) {
				const limit = req.body.length ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
				const skip = req.body.start ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;

				const dataTableConfig = await configDatatable(req, res, null);

				const [records, totalRecords, filteredRecords] = await Promise.all([
					this.collectionDb
						.find(
							dataTableConfig.conditions,
							{
								projection: {
									_id: 1,
									message: 1,
									sms_type: 1,
									sms_event: 1,
									constants: 1,
									modified: 1
								}
							}
						)
						.sort(dataTableConfig.sort_conditions)
						.limit(limit)
						.skip(skip)
						.toArray(),
					this.collectionDb.countDocuments({}),
					this.collectionDb.countDocuments(dataTableConfig.conditions)
				]);

				return res.send({
					status: Constants.STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: records || [],
					recordsFiltered: filteredRecords || 0,
					recordsTotal: totalRecords || 0
				});
			}

			req.breadcrumbs(BREADCRUMBS['admin/sms_template/list']);
			return res.render('list');
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Add or edit SMS template
	 */
	async addEditSmsTemplate(req, res, next) {
		try {
			const isEditable = !!req.params.id;
			const templateId = req.params.id ? new ObjectId(req.params.id) : new ObjectId();

			if (isPost(req)) {
				req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
				const smsType = req.body.sms_type ? parseInt(req.body.sms_type) : '';

				// Check uniqueness of sms_type on create or when sms_type changes
				const existing = await this.collectionDb.findOne(
					{
						_id: { $ne: templateId },
						sms_type: smsType
					},
					{ projection: { _id: 1 } }
				);

				if (existing) {
					return res.send({
						status: Constants.STATUS_ERROR,
						message: [{ param: 'sms_type', msg: res.__('admin.sms_templates.sms_type_is_already_exist') }]
					});
				}

				const updateData = {
					message: {
						en: req.body.message_en,
						ar: req.body.message_ar
					}
				};

				await this.collectionDb.updateOne(
					{ _id: templateId },
					{
						$set: updateData,
						$setOnInsert: {
							sms_event: req.body.sms_event,
							constants: req.body.constants,
							sms_type: smsType,
							created: getUtcDate()
						}
					},
					{ upsert: true }
				);

				const message = isEditable
					? res.__('admin.sms_templates.sms_template_has_been_updated_successfully')
					: res.__('admin.sms_templates.sms_template_has_been_added_successfully');

				if (!isEditable) {
					req.flash(Constants.STATUS_SUCCESS, message);
				}

				await saveSystemLogs(req, res, {
					user_id: req.session.user._id,
					parent_id: templateId,
					activity_module: Constants.SYSTEM_LOG_MODULE_SMS_TEMPLATE,
					activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT
				});

				return res.send({ status: Constants.STATUS_SUCCESS, message });
			}

			const response = await Promise.all([
				isEditable
					? this.collectionDb.findOne(
						{ _id: new ObjectId(req.params.id) },
						{ projection: { _id: 1, message: 1, constants: 1, sms_type: 1, sms_event: 1 } }
					)
					: Promise.resolve({}),
				this.collectionDb.findOne({}, { projection: { sms_type: 1 }, sort: { sms_type: Constants.SORT_DESC } })
			]);

			const templateDetails = response[0];
			const lastTypeDoc = response[1];
			const nextSmsType = lastTypeDoc ? lastTypeDoc.sms_type + 1 : 1;

			if (isEditable && !templateDetails) {
				return res.status(400).send({
					status: Constants.STATUS_ERROR,
					message: res.__('admin.system.invalid_access')
				});
			}

			return res.render('add_edit', {
				layout: false,
				result: templateDetails || {},
				is_editable: isEditable,
				sms_type: nextSmsType
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Delete SMS template
	 */
	async deleteSmsTemplate(req, res, next) {
		try {
			const templateId = new ObjectId(req.params.id);

			const existing = await this.collectionDb.findOne(
				{ _id: templateId },
				{ projection: { _id: 1 } }
			);

			if (!existing) {
				req.flash(Constants.STATUS_ERROR, res.__('admin.system.invalid_access'));
				return res.redirect(Constants.WEBSITE_ADMIN_URL + 'sms_templates');
			}

			await this.collectionDb.deleteOne({ _id: templateId });

			req.flash(Constants.STATUS_SUCCESS, res.__('admin.sms_templates.sms_template_deleted_successfully'));
			return res.redirect(Constants.WEBSITE_ADMIN_URL + 'sms_templates');
		} catch (error) {
			next(error);
		}
	}
}

export default SmsTemplate;

