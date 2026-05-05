import { ObjectId } from 'mongodb';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, configDatatable } from '../../../../utils/index.mjs';
import { moveUploadedFile, removeFile } from '../../../../utils/fileHelper.mjs';
import { getUtcDate } from '../../../../utils/dateHelper.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

const isValidHttpUrl = (value) => {
	try {
		const u = new URL(value);
		return u.protocol === 'http:' || u.protocol === 'https:';
	} catch {
		return false;
	}
};

class AdSliders {
	constructor(db) {
		this.db = db;
		this.collectionDb = db.collection(Tables.ADS_SLIDERS);
	}

	async getSliderList(req, res, next) {
		try {
			if (isPost(req)) {
				const limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
				const skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
				const dataTableConfig = await configDatatable(req, res, null);

				const dbRes = await this.collectionDb.aggregate([
					{ $match: dataTableConfig.conditions },
					{
						$facet: {
							list: [
								{ $sort: dataTableConfig.sort_conditions },
								{ $skip: skip },
								{ $limit: limit },
								{ $project: { _id: 1, modified: 1, position: 1 } }
							],
							count: [{ $count: 'count' }]
						}
					}
				]).toArray();

				res.send({
					status: Constants.STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: dbRes?.[0]?.list || [],
					recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0,
					recordsTotal: dbRes?.[0]?.count?.[0]?.count || 0
				});
			} else {
				const count = await this.collectionDb.countDocuments({});
				req.breadcrumbs(BREADCRUMBS['admin/ads_sliders/list']);
				res.render('list', { count });
			}
		} catch (error) {
			next(error);
		}
	}

	async getSliderDetails(req, res, next) {
		try {
			const result = await this.collectionDb.findOne(
				{ _id: new ObjectId(req.params.id) },
				{ projection: { _id: 1, position: 1, image: 1, created: 1 } }
			);
			if (!result) return { status: Constants.STATUS_ERROR, message: res.__('admin.system.invalid_access') };
			return { result, status: Constants.STATUS_SUCCESS };
		} catch (error) {
			next(error);
		}
	}

	async addEditSlider(req, res, next) {
		try {
			const sliderId = req.params.id ? new ObjectId(req.params.id) : new ObjectId();
			const isEditable = !!(req.params.id);

			if (isPost(req)) {
				req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
				const position = (req.body.ad_position) ? req.body.ad_position : '';
				const inputData = req.body.data || {};
				let errors = [];
				const urlArray = [];
				const imgArray = [];

				if (!position) errors.push({ param: 'ad_position', msg: res.__('admin.ads_sliders.please_select_position') });

				if (inputData.url) {
					Object.keys(inputData.url).forEach((key) => {
						const item = inputData.url[key];
						if (!item) return;
						const urlVal = (item?.url_val ?? '').replace(/\s+/g, '').trim();
						if (urlVal === '') {
							errors.push({ param: 'url_' + key, msg: res.__('admin.ads_sliders.please_enter_url') });
						} else if (!isValidHttpUrl(urlVal)) {
							errors.push({ param: 'url_' + key, msg: res.__('admin.ads_sliders.please_enter_valid_url') });
						}
						urlArray.push(urlVal);
					});
				}

				if (inputData.image) {
					const size = Object.keys(inputData.image).length - 1;
					for (let key = 1; key <= size; key++) {
						const imgKey = inputData.image[key];
						if (!imgKey) continue;
						if (!isEditable) {
							if ((!req.files || !req.files['image_' + key]) && imgKey.image_val_index != null) {
								errors.push({ param: 'image_' + (imgKey.image_val_index || key), msg: res.__('admin.ads_sliders.please_select_image') });
							}
						} else {
							const hasOld = inputData.old_image && inputData.old_image[key] && inputData.old_image[key].image_val;
							const hasNew = req.files && req.files['image_' + key];
							if (!hasOld && !hasNew && imgKey.image_val_index != null) {
								errors.push({ param: 'image_' + (imgKey.image_val_index || key), msg: res.__('admin.ads_sliders.please_select_image') });
							}
						}
						const fileObj = (req.files && req.files['image_' + key]) ? req.files['image_' + key] : (typeof key === 'number' ? key : '');
						imgArray.push(fileObj);
					}
				}

				const uniquePosition = await this.collectionDb.findOne(
					{ position: parseInt(position), _id: { $ne: sliderId } },
					{ projection: { _id: 1 } }
				);
				if (uniquePosition && uniquePosition._id) {
					errors.push({ param: 'ad_position', msg: res.__('admin.ads_sliders.ads_already_added_in_this_position') });
				}

				if (errors.length > 0) return res.send({ status: Constants.STATUS_ERROR, message: errors });

				const uploadFiles = [];
				const imageName = [];
				for (let num = 0; num < inputData.url.length; num++) {
					const records = inputData.url[num];
					if(!records?.url_val) continue;
					let img = inputData?.old_image?.[num]?.image_val || '';
					if(req?.files?.['image_' + num]){
						const response = await moveUploadedFile(req, res, {
							image: req?.files?.['image_' + num],
							filePath: Constants.ADS_SLIDER_FILE_PATH,
							old_image :  position !== '1' && isEditable ? img : ''
						});

						if (response.status === Constants.STATUS_ERROR) {
							errors.push({ param: 'image_' + num, msg: response.message });
						}else if(response?.fileName){
							img = response?.fileName;
							uploadFiles.push(response?.fileName);
						}
					}

					imageName.push({
						_id: new ObjectId(),
						image: img,
						url: records?.url_val
					});
				}

				/** Send error response **/
				if(errors.length){
					/** Remove uploaded files **/
					for(const file of uploadFiles){
						removeFile({ file_path: Constants.ADS_SLIDER_FILE_PATH + file }).catch(() => {});
					}

					return res.send({ status: Constants.STATUS_ERROR, message: errors });
				}

				/** Update slider data **/
				await this.collectionDb.updateOne(
					{ _id: sliderId },
					{
						$set: { image: imageName, modified: getUtcDate() },
						$setOnInsert: { position: parseInt(position), created: getUtcDate() }
					},
					{ upsert: true }
				);

				const message = isEditable ? res.__('admin.ads_sliders.ads_slider_has_been_updated_successfully') : res.__('admin.ads_sliders.ads_slider_has_been_added_successfully');
				req.flash(Constants.STATUS_SUCCESS, message);
				res.send({ status: Constants.STATUS_SUCCESS, redirect_url: Constants.WEBSITE_ADMIN_URL + 'ads_sliders', message });
			} else {
				let response = {};
				if (isEditable) {
					response = await this.getSliderDetails(req, res, next);
					if (response.status !== Constants.STATUS_SUCCESS) {
						req.flash(Constants.STATUS_ERROR, response.message);
						return res.redirect(Constants.WEBSITE_ADMIN_URL + 'ads_sliders');
					}
				}
				const breadcrumbs = isEditable ? 'admin/ads_sliders/edit' : 'admin/ads_sliders/add';
				req.breadcrumbs(BREADCRUMBS[breadcrumbs]);
				res.render('add_edit', { result: response.result || {}, is_editable: isEditable });
			}
		} catch (error) {
			next(error);
		}
	}

	async deleteSlider(req, res, next) {
		try {
			const sliderId = new ObjectId(req.params.id);
			const sliderResult = await this.collectionDb.findOne({ _id: sliderId }, { projection: { _id: 1, image: 1 } });
			if (!sliderResult) {
				req.flash(Constants.STATUS_ERROR, res.__('admin.system.invalid_access'));
				return res.redirect(Constants.WEBSITE_ADMIN_URL + 'ads_sliders');
			}
			await this.collectionDb.deleteOne({ _id: sliderId });
			if (sliderResult.image && Array.isArray(sliderResult.image)) {
				for (const record of sliderResult.image) {
					if (record.image) removeFile({ file_path: Constants.ADS_SLIDER_FILE_PATH + record.image }).catch(() => {});
				}
			}
			req.flash(Constants.STATUS_SUCCESS, res.__('admin.ads_sliders.ads_sliders_deleted_successfully'));
			res.redirect(Constants.WEBSITE_ADMIN_URL + 'ads_sliders');
		} catch (error) {
			next(error);
		}
	}
}

export default AdSliders;

