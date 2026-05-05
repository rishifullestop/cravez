import { ObjectId } from 'mongodb';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, configDatatable } from '../../../../utils/index.mjs';
import { moveUploadedFile, removeFile, appendFileExistData } from '../../../../utils/fileHelper.mjs';
import { getUtcDate } from '../../../../utils/dateHelper.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { saveSystemLogs } from '../../../../services/index.mjs';

class BannerManagement {
	constructor(db) {
		this.db = db;
		this.collectionDb = db.collection(Tables.BANNERS);
	}

	async getBannerList(req, res, next) {
		try {
			if (isPost(req)) {
				const limit = req.body.length ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
				const skip = req.body.start ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;

				const dataTableConfig = await configDatatable(req, res, null);

				const pipeline = [
					{ $match: dataTableConfig.conditions },
					{
						$facet: {
							list: [
								{ $sort: dataTableConfig.sort_conditions },
								{ $skip: skip },
								{ $limit: limit },
								{
									$project: {
										_id: 1,
										description: 1,
										image: 1,
										created: 1,
										status: 1,
										page_name: 1
									}
								}
							],
							count: [{ $count: 'count' }]
						}
					}
				];

				let dbRes = await this.collectionDb.aggregate(pipeline).toArray();
				let list = dbRes?.[0]?.list || [];

				if (list.length) {
					const options = {
						file_url: Constants.BANNER_URL,
						file_path: Constants.BANNER_FILE_PATH,
						result: list,
						database_field: 'image'
					};
					const fileResponse = await appendFileExistData(options);
					list = fileResponse.result || list;
				}

				res.send({
					status: Constants.STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: list,
					recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0,
					recordsTotal: dbRes?.[0]?.count?.[0]?.count || 0
				});
			} else {
				req.breadcrumbs(BREADCRUMBS['admin/banner_management/list']);
				res.render('list');
			}
		} catch (error) {
			next(error);
		}
	}

	async getBannerDetails(req, res, next) {
		try {
			const banner = await this.collectionDb.findOne(
				{ _id: new ObjectId(req.params.id) },
				{
					projection: {
						_id: 1,
						description: 1,
						image: 1,
						created: 1,
						page_name: 1
					}
				}
			);

			if (!banner) {
				return { status: Constants.STATUS_ERROR, message: res.__('admin.system.invalid_access') };
			}

			const options = {
				file_url: Constants.BANNER_URL,
				file_path: Constants.BANNER_FILE_PATH,
				result: [banner],
				database_field: 'image'
			};

			const fileResponse = await appendFileExistData(options);

			return {
				result: fileResponse.result?.[0] || {},
				status: Constants.STATUS_SUCCESS
			};
		} catch (error) {
			next(error);
		}
	}

	async addEditBanner(req, res, next) {
		try {
			const bannerId = req.params.id ? new ObjectId(req.params.id) : new ObjectId();
			const isEditable = !!req.params.id;

			if (isPost(req)) {
				req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);

				const bannerImage = (req.files && req.files.image) ? req.files.image : '';
				const oldImage = req.body.old_image || '';

				const imageOptions = {
					image: bannerImage,
					filePath: Constants.BANNER_FILE_PATH,
					oldPath: oldImage
				};

				const imageResponse = await moveUploadedFile(req, res, imageOptions);

				if (imageResponse.status === Constants.STATUS_ERROR) {
					return res.send({
						status: Constants.STATUS_ERROR,
						message: [{ param: 'image', msg: imageResponse.message }]
					});
				}

				const updateData = {
					page_name: req.body.page_name,
					description: {
						ar: req.body.description_in_arabic || '',
						en: req.body.description_in_english || ''
					},
					modified: getUtcDate()
				};

				if (imageResponse.fileName) {
					updateData.image = imageResponse.fileName;
				}

				await this.collectionDb.updateOne(
					{ _id: bannerId },
					{
						$set: updateData,
						$setOnInsert: {
							status: Constants.ACTIVE,
							added_by: new ObjectId(req.session.user._id),
							created: getUtcDate()
						}
					},
					{ upsert: true }
				);

				const message = isEditable
					? res.__('admin.banner_management.banner_has_been_updated_successfully')
					: res.__('admin.banner_management.banner_has_been_added_successfully');

				if (!isEditable) {
					req.flash(Constants.STATUS_SUCCESS, message);
				}

				res.send({
					status: Constants.STATUS_SUCCESS,
					redirect_url: Constants.WEBSITE_ADMIN_URL + 'banner_management',
					message
				});

				await saveSystemLogs(req, res, {
					user_id: req.session.user._id,
					parent_id: bannerId,
					activity_module: Constants.SYSTEM_LOG_MODULE_BANNER_MANAGEMENT,
					activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
					additional_details: {}
				});
			} else {
				let response = {};
				if (isEditable) {
					response = await this.getBannerDetails(req, res, next);
					if (response.status !== Constants.STATUS_SUCCESS) {
						req.flash(Constants.STATUS_ERROR, response.message);
						return res.redirect(Constants.WEBSITE_ADMIN_URL + 'banner_management');
					}
				}

				res.render('add_edit', {
					banner_result: response.result,
					is_editable: isEditable,
					layout: false
				});
			}
		} catch (error) {
			next(error);
		}
	}

	async deleteBanner(req, res, next) {
		try {
			const bannerId = new ObjectId(req.params.id);

			const banner = await this.collectionDb.findOne(
				{ _id: bannerId },
				{ projection: { _id: 1, image: 1 } }
			);

			if (!banner) {
				req.flash(Constants.STATUS_ERROR, res.__('admin.system.invalid_access'));
				return res.redirect(Constants.WEBSITE_ADMIN_URL + 'banner_management');
			}

			await this.collectionDb.deleteOne({ _id: bannerId });

			if (banner.image) {
				await removeFile({ file_path: Constants.BANNER_FILE_PATH + banner.image }).catch(() => {});
			}

			req.flash(Constants.STATUS_SUCCESS, res.__('admin.banner_management.banner_deleted_successfully'));
			res.redirect(Constants.WEBSITE_ADMIN_URL + 'banner_management');

			await saveSystemLogs(req, res, {
				user_id: req.session.user._id,
				parent_id: bannerId,
				activity_module: Constants.SYSTEM_LOG_MODULE_BANNER_MANAGEMENT,
				activity_type: Constants.ACTIVITY_TYPE_DELETE,
				additional_details: {}
			});
		} catch (error) {
			next(error);
		}
	}

	async updateBannerStatus(req, res, next) {
		try {
			const bannerId = new ObjectId(req.params.id);

			await this.collectionDb.updateOne(
				{ _id: bannerId },
				{
					$set: {
						modified: getUtcDate(),
						status: req.params.status === Constants.ACTIVE ? Constants.DEACTIVE : Constants.ACTIVE
					}
				}
			);

			req.flash(
				Constants.STATUS_SUCCESS,
				res.__('admin.banner_management.banner_status_has_been_updated_successfully')
			);
			res.redirect(Constants.WEBSITE_ADMIN_URL + 'banner_management');

			await saveSystemLogs(req, res, {
				user_id: req.session.user._id,
				parent_id: bannerId,
				activity_module: Constants.SYSTEM_LOG_MODULE_BANNER_MANAGEMENT,
				activity_type: Constants.ACTIVITY_TYPE_STATUS_UPDATE,
				additional_details: {}
			});
		} catch (error) {
			next(error);
		}
	}
}

export default BannerManagement;

