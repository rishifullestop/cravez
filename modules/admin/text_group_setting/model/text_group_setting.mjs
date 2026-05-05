import { ObjectId } from 'mongodb';
import { writeFileSync } from 'fs';
import clone from 'clone';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import {isPost, sanitizeData, getUtcDate, configDatatable, getLanguages, exportToExcel, moveUploadedFile, removeFile, newDate} from '../../../../utils/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

class TextGroupSetting {
	constructor(db) {
		this.db = db;
		this.collectionDb = db.collection(Tables.TEXT_SETTINGS);
		this.exportFilterConditions = {};
		this.exportSortConditions = {};
	}

	/**
	 * List text groups
	 */
	async getTextGroupSettingList(req, res, next) {
		try {
			const statusType = req.params.type || '';

			if (isPost(req, res)) {
				const limit = req.body.length ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
				const skip = req.body.start ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
				const statusSearch = req.body.status_search || '';

				let searchConditions = {};

				const dataTableConfig = await configDatatable(req, res, null);

				if (statusSearch !== '') {
					switch (statusSearch) {
						case Constants.TEXT_SETTINGS_FRONT:
							searchConditions = { type: { $regex: 'front' } };
							break;
						case Constants.TEXT_SETTINGS_ADMIN:
							searchConditions = { type: { $regex: 'admin' } };
							break;
						default:
							break;
					}
				}

				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, searchConditions);

				this.exportFilterConditions = dataTableConfig.conditions;
				this.exportSortConditions = dataTableConfig.sort_conditions;

				const baseGroupStage = {
					$group: {
						_id: {
							$cond: {
								if: { $eq: ['$type', 'admin'] },
								then: {
									$concat: [
										{ $arrayElemAt: [{ $split: ['$key', '.'] }, 0] },
										'.',
										{
											$concat: [
												{ $arrayElemAt: [{ $split: ['$key', '.'] }, 1] },
												'',
												'.'
											]
										}
									]
								},
								else: { $arrayElemAt: [{ $split: ['$key', '.'] }, 0] }
							}
						},
						type: { $first: '$type' },
						count: { $sum: 1 },
						values: { $push: '$key' }
					}
				};

				const [records, totalRecords, filteredRecords] = await Promise.all([
					this.collectionDb
						.aggregate([
							baseGroupStage,
							{
								$match: {
									$and: [dataTableConfig.conditions]
								}
							},
							{ $sort: dataTableConfig.sort_conditions },
							{ $skip: skip },
							{ $limit: limit }
						])
						.toArray(),
					this.collectionDb
						.aggregate([
							baseGroupStage,
							{ $project: { _id: 1 } }
						])
						.toArray()
						.then(r => r.length),
					this.collectionDb
						.aggregate([
							baseGroupStage,
							{ $match: dataTableConfig.conditions },
							{ $count: 'count' }
						])
						.toArray()
						.then(r => (r && r.length > 0 && r[0].count) || 0)
				]);

				return res.send({
					status: Constants.STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: records || [],
					recordsTotal: totalRecords || 0,
					recordsFiltered: filteredRecords || 0
				});
			}

			req.breadcrumbs(BREADCRUMBS['admin/text_group_setting/list']);
			return res.render('list', {
				status_type: statusType
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * View single group (list contained keys)
	 */
	async viewTextGroupSetting(req, res, next) {
		try {
			let id = req.params.id || '';

			if (isPost(req, res)) {
				const limit = req.body.length ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
				const skip = req.body.start ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
				const dataTableConfig = await configDatatable(req, res, null);

				if (id) {
					id = id.replace(/\./g, '\\.');
					const searchConditions = { key: new RegExp('^' + id, 'i') };
					dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, searchConditions);

					const [records, totalRecords, filteredRecords] = await Promise.all([
						this.collectionDb
							.find(
								{ $and: [dataTableConfig.conditions] },
								{ projection: { _id: 1, key: 1, value: 1 } }
							)
							.sort(dataTableConfig.sort_conditions)
							.limit(limit)
							.skip(skip)
							.toArray(),
						this.collectionDb.find(searchConditions).count(),
						this.collectionDb.find(dataTableConfig.conditions).count()
					]);

					return res.send({
						status: Constants.STATUS_SUCCESS,
						draw: dataTableConfig.result_draw,
						data: records || [],
						recordsFiltered: filteredRecords || 0,
						recordsTotal: totalRecords || 0
					});
				}
			} else {
				req.breadcrumbs(BREADCRUMBS['admin/text_group_setting/view']);
				return res.render('view', {
					text_id: id
				});
			}
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Delete whole text group (all keys with prefix)
	 */
	async deleteTextGroupSetting(req, res, next) {
		try {
			let key = req.params.id || '';
			if (!key) {
				req.flash(Constants.STATUS_ERROR, res.__('admin.system.invalid_access'));
				return res.redirect(Constants.WEBSITE_ADMIN_URL + 'text_group_setting');
			}

			key = key.replace(/\./g, '\\.');
			await this.collectionDb.deleteMany({ key: new RegExp(key) });

			req.flash(Constants.STATUS_SUCCESS, res.__('admin.text_group_setting.text_group_setting_has_been_deleted_successfully'));
			return res.redirect(Constants.WEBSITE_ADMIN_URL + 'text_group_setting');
		} catch (error) {
			req.flash(Constants.STATUS_ERROR, res.__('admin.system.something_going_wrong_please_try_again'));
			return res.redirect(Constants.WEBSITE_ADMIN_URL + 'text_group_setting');
		}
	}

	/**
	 * Delete single text setting in a group
	 */
	async deleteTextSetting(req, res, next) {
		const textId = req.params.text_id || '';
		try {
			const id = req.params.id || '';
			if (!id) {
				req.flash(Constants.STATUS_ERROR, res.__('admin.system.invalid_access'));
				return res.redirect(Constants.WEBSITE_ADMIN_URL + 'text_group_setting/' + textId + '/view');
			}

			await this.collectionDb.deleteOne({ _id: new ObjectId(id) });
			req.flash(Constants.STATUS_SUCCESS, res.__('admin.text_setting.text_setting_has_been_deleted_successfully'));
			return res.redirect(Constants.WEBSITE_ADMIN_URL + 'text_group_setting/' + textId + '/view');
		} catch (e) {
			req.flash(Constants.STATUS_ERROR, res.__('admin.system.something_going_wrong_please_try_again'));
			return res.redirect(Constants.WEBSITE_ADMIN_URL + 'text_group_setting/' + textId + '/view');
		}
	}

	/**
	 * Export text group settings (all groups) to excel
	 */
	async exportData(req, res, next) {
		try {
			const result = await this.collectionDb
				.find({}, { projection: { _id: 0, key: 1, value: 1, type: 1, text_settings_descriptions: 1 } })
				.sort(this.exportSortConditions || {})
				.toArray();

			const heading_columns = [
				res.__('admin.text_setting.key'),
				res.__('Type'),
				...(Constants.LANGUAGES_IN_SYSTEM || [])
			];

			const temp = [];

			if (result && result.length > 0) {
				result.forEach(record => {
					const buffer = [
						record.key || '',
						record.type || ''
					];

					(Constants.LANGUAGES_IN_SYSTEM || []).forEach(langId => {
						const langVal = record.text_settings_descriptions?.[langId]?.value || '';
						buffer.push(langVal);
					});

					temp.push(buffer);
				});
			}

			exportToExcel(req, res, {
				file_prefix: 'textsettings',
				heading_columns,
				export_data: temp
			});
		} catch (error) {
			req.flash(Constants.STATUS_ERROR, res.__('admin.system.something_going_wrong_please_try_again'));
			return res.redirect(Constants.WEBSITE_ADMIN_URL + 'text_group_setting');
		}
	}

	/**
	 * Export single group to excel
	 */
	async exportTextGroupSetting(req, res, next) {
		try {
			const id = req.params.id || '';
			if (!id) {
				req.flash(Constants.STATUS_ERROR, res.__('admin.system.invalid_access'));
				return res.redirect(Constants.WEBSITE_ADMIN_URL + 'text_group_setting');
			}

			const records = await this.collectionDb.find(
				{ key: new RegExp('^' + id, 'i') },
				{ projection: { _id: 0, key: 1, value: 1, type: 1, text_settings_descriptions: 1 } }
			).toArray();

			const heading_columns = [
				res.__('admin.text_setting.key'),
				res.__('Type'),
				...(Constants.LANGUAGES_IN_SYSTEM || [])
			];

			const temp = [];

			if (records && records.length > 0) {
				records.forEach(record => {
					const buffer = [
						record.key || '',
						record.type || ''
					];

					(Constants.LANGUAGES_IN_SYSTEM || []).forEach(langId => {
						const langVal = record.text_settings_descriptions?.[langId]?.value || '';
						buffer.push(langVal);
					});

					temp.push(buffer);
				});
			}

			exportToExcel(req, res, {
				file_prefix: 'textsettings_' + (newDate('', Constants.DATABASE_DATE_FORMAT) || ''),
				heading_columns,
				export_data: temp
			});
		} catch (error) {
			req.flash(Constants.STATUS_ERROR, res.__('admin.system.something_going_wrong_please_try_again'));
			return res.redirect(Constants.WEBSITE_ADMIN_URL + 'text_group_setting');
		}
	}

	/**
	 * Edit a single text setting
	 */
	async editTextSetting(req, res, next) {
		try {
			if (isPost(req, res)) {
				req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
				const textId = req.params.text_id || '';
				const id = req.params.id || '';

				const descRoot =
					req.body.text_settings_descriptions &&
					req.body.text_settings_descriptions[Constants.DEFAULT_LANGUAGE_MONGO_ID];

				if (!(id && descRoot && descRoot.value)) {
					return res.send({
						status: Constants.STATUS_ERROR,
						message: [{ param: Constants.ADMIN_GLOBAL_ERROR, msg: res.__('admin.system.something_going_wrong_please_try_again') }]
					});
				}

				const allData = req.body;
				req.body = clone(descRoot);
				req.body.key = allData.key || '';

				const key = req.body.key || '';
				const value = req.body.value || '';

				await this.collectionDb.updateOne(
					{ _id: new ObjectId(id) },
					{
						$set: {
							key: key,
							value: value,
							default_language_id: Constants.DEFAULT_LANGUAGE_MONGO_ID,
							text_settings_descriptions: allData.text_settings_descriptions || {},
							modified: getUtcDate()
						}
					}
				);

				req.flash(Constants.STATUS_SUCCESS, res.__('admin.text_setting.text_setting_has_been_updated_successfully'));
				return res.send({
					status: Constants.STATUS_SUCCESS,
					redirect_url: Constants.WEBSITE_ADMIN_URL + 'text_group_setting/' + textId + '/view',
					message: res.__('admin.text_setting.text_setting_has_been_updated_successfully')
				});
			}

			const languageList = await getLanguages();
			const response = await this.getTextSettingDetails(req, res);
			const textId = req.params.text_id || '';

			if (response.status === Constants.STATUS_SUCCESS) {
				req.breadcrumbs(BREADCRUMBS['admin/text_setting/edit']);
				return res.render('edit', {
					result: response.result,
					language_list: languageList,
					dynamic_variable: textId,
					dynamic_url: textId
				});
			}

			req.flash(Constants.STATUS_ERROR, response.message);
			return res.redirect(Constants.WEBSITE_ADMIN_URL + 'text_group_setting/');
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Text setting details helper
	 */
	async getTextSettingDetails(req, res) {
		const textSettingId = req.params.id || '';
		if (!textSettingId) {
			return {
				status: Constants.STATUS_ERROR,
				message: res.__('admin.system.invalid_access')
			};
		}

		try {
			const result = await this.collectionDb.findOne(
				{ _id: new ObjectId(textSettingId) },
				{
					projection: {
						_id: 1,
						key: 1,
						value: 1,
						modified: 1,
						default_language_id: 1,
						text_settings_descriptions: 1
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
		} catch {
			return {
				status: Constants.STATUS_ERROR,
				message: res.__('admin.system.invalid_access')
			};
		}
	}

	/**
	 * Export all text settings to JSON (download)
	 */
	async exportJsonData(req, res, next) {
		try {
			const result = await this.collectionDb
				.find({}, { projection: { _id: 0 } })
				.toArray();

			const fileName = 'text-settings.json';
			res.setHeader('Content-Type', 'application/json');
			res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
			res.end(JSON.stringify(result));
		} catch (error) {
			req.flash(Constants.STATUS_ERROR, res.__('admin.system.something_going_wrong_please_try_again'));
			return res.redirect(Constants.WEBSITE_ADMIN_URL + 'text_group_setting');
		}
	}

	/**
	 * Import text settings from JSON file
	 */
	async importData(req, res, next) {
		try {
			if (isPost(req, res)) {
				let errors = null;
				if (!req?.files?.file) {
					return res.send({ status: Constants.STATUS_ERROR, message: [{ param: 'file', msg: res.__('admin.text_group_setting.please_select_file') }] });
				}

				const options = {
					image: req?.files?.file,
					filePath: Constants.WEBSITE_UPLOADS_ROOT_PATH,
					allowedExtensions: ['json'],
					allowedImageError: ['json']?.join(', '),
					allowedMimeTypes: ['application/json', 'text/json', 'application/javascript', 'application/ld+json', 'text/plain'],
					allowedMimeError: ['application/json', 'text/json', 'application/javascript', 'application/ld+json', 'text/plain']?.join(', ')
				};

				const response = await moveUploadedFile(req, res, options);
				if (response.status === Constants.STATUS_ERROR) {
					return res.send({
						status: Constants.STATUS_ERROR,
						message: [{ param: 'file', msg: response.message }]
					});
				}

				const filename = response.fileName;
				const fullPath = Constants.WEBSITE_UPLOADS_ROOT_PATH + filename;

				const fs = await import('fs/promises');
				const data = await fs.readFile(fullPath, 'utf8');
				let jsonData;
				try {
					jsonData = JSON.parse(data);
				} catch {
					await removeFile({ file_path: fullPath });
					req.flash(Constants.STATUS_ERROR, res.__('File is empty'));
					return res.send({
						status: Constants.STATUS_SUCCESS,
						redirect_url: Constants.WEBSITE_ADMIN_URL + 'text_group_setting'
					});
				}

				if (jsonData && jsonData.length > 0) {
					for (const text of jsonData) {
						await this.collectionDb.updateOne(
							{ key: text.key },
							{
								$set: {
									value: text.value,
									text_settings_descriptions: text.text_settings_descriptions || {},
									type: text.type,
									default_language_id: Constants.DEFAULT_LANGUAGE_MONGO_ID,
									modified: getUtcDate()
								},
								$setOnInsert: {
									created: getUtcDate()
								}
							},
							{ upsert: true }
						);
					}

					await this.writeTextSettingFile();
					await removeFile({ file_path: fullPath });

					req.flash(Constants.STATUS_SUCCESS, res.__('admin.text_group_setting.uploaded'));
					return res.send({
						status: Constants.STATUS_SUCCESS,
						redirect_url: Constants.WEBSITE_ADMIN_URL + 'text_group_setting'
					});
				}

				await removeFile({ file_path: fullPath });
				req.flash(Constants.STATUS_ERROR, res.__('File is empty'));
				return res.send({
					status: Constants.STATUS_SUCCESS,
					redirect_url: Constants.WEBSITE_ADMIN_URL + 'text_group_setting'
				});
			}

			req.breadcrumbs(BREADCRUMBS['admin/text_group_setting/import']);
			return res.render('import');
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Write text setting file (locales/*.json) – similar to language_settings
	 */
	async writeTextSettingFile() {
		try {
			const languages = this.db.collection(Tables.LANGUAGES);
			const textSettings = this.collectionDb;

			const languageResult = await languages.find(
				{ active: Constants.ACTIVE },
				{ projection: { _id: 1, folder_code: 1 } }
			).toArray();

			if (!(languageResult && languageResult.length)) return true;

			const languageObject = {};
			const textSettingsObject = {};

			languageResult.forEach(languageRecord => {
				const languageId = languageRecord._id;
				const languageFolderCode = languageRecord.folder_code;
				languageObject[languageId] = languageFolderCode;
				if (typeof textSettingsObject[languageFolderCode] === 'undefined') {
					textSettingsObject[languageFolderCode] = {};
				}
			});

			if (Object.keys(languageObject).length === 0) return true;

			const result = await textSettings.find(
				{},
				{ projection: { _id: 1, key: 1, value: 1, text_settings_descriptions: 1, modified: 1 } }
			).toArray();

			if (!(result && result.length)) return true;

			result.forEach(record => {
				const languageKey = record.key || '';
				const languageValue = record.value || '';

				Object.keys(languageObject).forEach(languageId => {
					const folderCode = languageObject[languageId];
					if (typeof textSettingsObject[folderCode] === 'undefined') {
						textSettingsObject[folderCode] = {};
					}
					if (typeof textSettingsObject[folderCode][languageKey] === 'undefined') {
						textSettingsObject[folderCode][languageKey] = {};
					}

					if (
						record.text_settings_descriptions &&
						record.text_settings_descriptions[languageId] &&
						record.text_settings_descriptions[languageId].value
					) {
						textSettingsObject[folderCode][languageKey] =
							record.text_settings_descriptions[languageId].value;
					} else {
						textSettingsObject[folderCode][languageKey] = languageValue;
					}
				});
			});

			Object.keys(languageObject).forEach(languageId => {
				const folderCode = languageObject[languageId];
				const tmpPath = Constants.WEBSITE_ROOT_PATH + 'locales/' + folderCode + '.json';
				writeFileSync(tmpPath, JSON.stringify(textSettingsObject[folderCode]), 'utf8');
			});

			return true;
		} catch (e) {
			return false;
		}
	}
}

export default TextGroupSetting;

