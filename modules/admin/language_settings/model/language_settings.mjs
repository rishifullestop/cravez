import { ObjectId } from 'mongodb';
import axios from 'axios';
import { writeFileSync } from 'fs';
import clone from 'clone';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import {isPost, sanitizeData, getUtcDate, configDatatable, getLanguages} from '../../../../utils/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

class LanguageSettings {
	constructor(db) {
		this.db = db;
		this.collectionDb = db.collection(Tables.TEXT_SETTINGS);
	}

	/**
	 * List text settings (legacy /language_settings/:type routes)
	 */
	async getTextSettingList(req, res, next) {
		try {
			const textSettingType = req.params.type || '';
			if (!textSettingType || !Constants.TEXT_SETTINGS_NAME[textSettingType]) {
				req.flash(Constants.STATUS_ERROR, res.__('Invalid access.'));
				return res.redirect(Constants.WEBSITE_ADMIN_URL + 'dashboard');
			}

			const textSettingName = Constants.TEXT_SETTINGS_NAME[textSettingType];

			if (isPost(req)) {
				const limit = req.body.length ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
				const skip = req.body.start ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;

				const dataTableConfig = await configDatatable(req, res, null);
				const commonConditions = { type: textSettingType };
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				const dbRes = await this.collectionDb.aggregate([
					{ $match: dataTableConfig.conditions },
					{
						$facet: {
							list: [
								{ $sort: dataTableConfig.sort_conditions },
								{ $skip: skip },
								{ $limit: limit },
								{ $project: { _id: 1, key: 1, value: 1, modified: 1 } }
							],
							count: [{ $count: 'count' }]
						}
					}
				]).toArray();

				return res.send({
					status: Constants.STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: dbRes?.[0]?.list || [],
					recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0,
					recordsTotal: dbRes?.[0]?.count?.[0]?.count || 0
				});
			}

			req.breadcrumbs(BREADCRUMBS['admin/text_setting/list']);
			return res.render('list', {
				type: textSettingType,
				dynamic_variable: textSettingName + ' ' + res.__('Management'),
				dynamic_url: textSettingType
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Single text setting details
	 */
	async getTextSettingDetails(req, res) {
		const textSettingId = req.params.id || '';
		if (!textSettingId) {
			return {
				status: Constants.STATUS_ERROR,
				message: res.__('Invalid access.')
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
					message: res.__('Invalid access.')
				};
			}

			return {
				status: Constants.STATUS_SUCCESS,
				result
			};
		} catch {
			return {
				status: Constants.STATUS_ERROR,
				message: res.__('Something went wrong, Please try again.')
			};
		}
	}

	/**
	 * Add / edit text setting (includes external server sync)
	 */
	async addEditTextSetting(req, res, next) {
		try {
			const textSettingType = req.params.type || '';
			if (!(textSettingType && Constants.TEXT_SETTINGS_NAME[textSettingType])) {
				req.flash(Constants.STATUS_ERROR, res.__('Invalid access.'));
				return res.redirect(Constants.WEBSITE_ADMIN_URL + 'dashboard');
			}

			const isEditable = !!req.params.id;
			const id = req.params.id ? new ObjectId(req.params.id) : new ObjectId();
			const textSettingName = Constants.TEXT_SETTINGS_NAME[textSettingType];

			if (isPost(req)) {
				req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);

				const descRoot = req.body?.text_settings_descriptions?.[Constants.DEFAULT_LANGUAGE_MONGO_ID];
				if (!descRoot) {
					return res.send({
						status: Constants.STATUS_ERROR,
						message: [{ param: Constants.ADMIN_GLOBAL_ERROR, msg: res.__('Something went wrong, Please try again.') }]
					});
				}

				const allData = req.body;
				req.body = clone(descRoot);
				req.body.key = allData.key || '';

				let servers = allData.server_name || [];
				servers = Array.isArray(servers) ? servers : [servers];

				const key = req.body.key || '';
				const value = req.body.value || '';

				// Unique key check
				const existingKey = await this.collectionDb.findOne(
					{
						key: { $regex: '^' + key + '$', $options: 'i' },
						_id: { $ne: id }
					},
					{ projection: { _id: 1 } }
				);

				if (existingKey) {
					return res.send({
						status: Constants.STATUS_ERROR,
						message: [{ param: 'key', msg: res.__('Whoops, You have entered an already used key. Please try something different.') }]
					});
				}

				const updateData = {
					value: value,
					type: textSettingType,
					default_language_id: Constants.DEFAULT_LANGUAGE_MONGO_ID,
					text_settings_descriptions: allData.text_settings_descriptions || {},
					modified: getUtcDate()
				};

				await this.collectionDb.updateOne(
					{ _id: id },
					{
						$set: updateData,
						$setOnInsert: {
							key: key,
							created: getUtcDate()
						}
					},
					{ upsert: true }
				);

				await this.writeTextSettingFile();

				// Propagate to external servers unless coming from automation
				try {
					if (!allData.automation) {
						allData.automation = true;
						const serverIds = servers.map(s => new ObjectId(s));
						const serverDocs = await this.collectionDb.find(
							{ is_server: true, _id: { $in: serverIds } },
							{ projection: { _id: 1, url: 1 } }
						).toArray();

						for (const srv of serverDocs) {
							if (!srv.url) continue;
							let externalURL = srv.url + '/admin/language_settings/' + textSettingType;
							externalURL = isEditable
								? externalURL + '/auto_edit/' + id.toString()
								: externalURL + '/auto_add';

							try {
								await axios.post(externalURL, allData);
							} catch (err) {
								console.error('External language_settings sync failed:', externalURL, err?.message);
							}
						}
					}
				} catch (syncErr) {
					console.error('Error while syncing to external servers:', syncErr?.message);
				}

				const message = isEditable
					? res.__('Text setting has been updated successfully.')
					: res.__('Text setting has been added successfully.');

				req.flash(Constants.STATUS_SUCCESS, message);
				return res.send({
					status: Constants.STATUS_SUCCESS,
					redirect_url: Constants.WEBSITE_ADMIN_URL + 'language_settings/' + textSettingType,
					message,
					current_id: id
				});
			}

			// GET – render add/edit form
			const languageList = await getLanguages();
			const server = await this.getExternalServerDetails(req, res);

			if (server.status !== Constants.STATUS_SUCCESS) {
				req.flash(Constants.STATUS_ERROR, server.message);
				return res.redirect(Constants.WEBSITE_ADMIN_URL + 'language_settings/' + textSettingType);
			}

			let result = {};
			if (isEditable) {
				const response = await this.getTextSettingDetails(req, res);
				if (response.status !== Constants.STATUS_SUCCESS) {
					req.flash(Constants.STATUS_ERROR, response.message);
					return res.redirect(Constants.WEBSITE_ADMIN_URL + 'language_settings/' + textSettingType);
				}
				result = response.result || {};
			}

			const serverName = server.result || [];

			if (isEditable) {
				req.breadcrumbs(BREADCRUMBS['admin/text_setting/edit']);
			} else {
				req.breadcrumbs(BREADCRUMBS['admin/text_setting/add']);
			}

			return res.render('add_edit', {
				result,
				server_list: serverName,
				language_list: languageList,
				type: textSettingType,
				dynamic_variable: textSettingName + ' ' + res.__('Management'),
				dynamic_url: textSettingType
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Write text settings into locales/*.json (per language)
	 */
	async writeTextSettingFile() {
		try {
			const languageResult = await getLanguages();
			const result = await this.collectionDb.find(
				{},
				{ projection: { _id: 1, key: 1, value: 1, text_settings_descriptions: 1, modified: 1 } }
			).toArray();

			if (languageResult?.length && result?.length) {
				const languageObject = {};
				const textSettingsObject = {};

				languageResult.forEach(languageRecord => {
					const languageId = languageRecord._id;
					const folderCode = languageRecord.folder_code;
					languageObject[languageId] = folderCode;
					if (!textSettingsObject[folderCode]) {
						textSettingsObject[folderCode] = {};
					}
				});

				if (Object.keys(languageObject).length > 0) {
					result.forEach(record => {
						const languageKey = record.key || '';
						const languageValue = record.value || '';

						Object.keys(languageObject).forEach(languageId => {
							const folderCode = languageObject[languageId];
							if (!textSettingsObject[folderCode]) {
								textSettingsObject[folderCode] = {};
							}

							let value = languageValue;
							if (
								record.text_settings_descriptions &&
								record.text_settings_descriptions[languageId] &&
								record.text_settings_descriptions[languageId].value
							) {
								value = record.text_settings_descriptions[languageId].value;
							}

							textSettingsObject[folderCode][languageKey] = value;
						});
					});

					Object.values(languageObject).forEach(folderCode => {
						const tmpPath = Constants.WEBSITE_ROOT_PATH + 'locales/' + folderCode + '.json';
						writeFileSync(tmpPath, JSON.stringify(textSettingsObject[folderCode]), 'utf8');
					});
				}
			}
			return true;
		} catch (e) {
			console.error('Error writing text setting file:', e?.message);
			return false;
		}
	}

	/**
	 * Handle add / edit external servers list (UI).
	 */
	async addEditExternalServer(req, res, next) {
		try {
			if (isPost(req)) {
				req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
				let serverData = req.body.data || [];

				if (Array.isArray(serverData) && serverData.length > 0) {

					let errors = [];
					for (const data of serverData) {
						if (!data.name) {
							errors.push({ param: 'name_' + data.index, msg: res.__('Please enter name.') });
						}
						if (!data.url) {
							errors.push({ param: 'url_' + data.index, msg: res.__('Please enter url.') });
						}
					}

					/** Send error response */
					if (errors.length > 0) return res.send({ status: Constants.STATUS_ERROR, message: errors });


					serverData = serverData.map(data => ({
						_id: data._id ? new ObjectId(data._id) : new ObjectId(),
						name: data.name,
						url: data.url
					}));

					for (const data of serverData) {
						await this.collectionDb.updateMany(
							{ _id: data._id },
							{
								$set: {
									name: data.name,
									url: data.url,
									modified: getUtcDate()
								},
								$setOnInsert: {
									is_server: true,
									created: getUtcDate()
								}
							},
							{ upsert: true }
						);
					}

					const message = res.__('server has been added & updated successfully');
					req.flash(Constants.STATUS_SUCCESS, message);
					return res.send({
						status: Constants.STATUS_SUCCESS,
						redirect_url: Constants.WEBSITE_ADMIN_URL + 'language_settings/external_server',
						message
					});
				}
			} else {
				const response = await this.getExternalServerDetails(req, res);
				if (response.status !== Constants.STATUS_SUCCESS) {
					req.flash(Constants.STATUS_ERROR, response.message);
					return res.redirect(Constants.WEBSITE_ADMIN_URL + 'language_settings/external_server');
				}
				const result = response.result || [];
				const isEditable = result.length > 0;
				return res.render('external_servers', {
					is_editable: isEditable,
					result
				});
			}
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Get external server details.
	 */
	async getExternalServerDetails(req, res) {
		try {
			const result = await this.collectionDb.find(
				{ is_server: true },
				{
					projection: {
						_id: 1,
						name: 1,
						url: 1,
						modified: 1,
						is_server: 1
					}
				}
			).toArray();

			return {
				status: Constants.STATUS_SUCCESS,
				result
			};
		} catch {
			return {
				status: Constants.STATUS_ERROR,
				message: res.__('Something went wrong, Please try again.')
			};
		}
	}

	/**
	 * Delete external server entry.
	 */
	async deleteExternalServer(req, res, next) {
		try {
			const serverId = new ObjectId(req.body.id);
			await this.collectionDb.deleteOne({ _id: serverId });

			req.flash(Constants.STATUS_SUCCESS, res.__('Server deleted successfully.'));
			return res.send({
				status: Constants.STATUS_SUCCESS,
				redirect_url: Constants.WEBSITE_ADMIN_URL + 'language_settings/external_server',
				message: res.__('Server deleted successfully.')
			});
		} catch (error) {
			next(error);
		}
	}
}
export default LanguageSettings;