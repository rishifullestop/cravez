import { ObjectId } from 'mongodb';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, configDatatable, getDropdownList } from '../../../../utils/index.mjs';
import { getUtcDate } from '../../../../utils/dateHelper.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

class KfgAreas {
	constructor(db) {
		this.db = db;
		this.collectionDb = db.collection(Tables.CRAVEZ_AREAS);
	}

	async getKfgAreasList(req, res, next) {
		try {
			if (isPost(req)) {
				const limit = req.body.length ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
				const skip = req.body.start ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;

				const dataTableConfig = await configDatatable(req, res, null);

				const pipeline = [
					{ $match: dataTableConfig.conditions },
					{ $sort: dataTableConfig.sort_conditions },
					{ $skip: skip },
					{ $limit: limit },
					{
						$lookup: {
							from: Tables.AREAS,
							localField: 'area_id',
							foreignField: '_id',
							as: 'area_details'
						}
					},
					{
						$lookup: {
							from: Tables.AREA_BLOCKS,
							localField: 'block_id',
							foreignField: '_id',
							as: 'block_details'
						}
					},
					{
						$project: {
							_id: 1,
							name: 1,
							is_active: 1,
							cravez_area_id: 1,
							area_id: 1,
							block_id: 1,
							cravez_area_name: {
								$arrayElemAt: [`$area_details.name.${Constants.DEFAULT_LANGUAGE_CODE}`, 0]
							},
							cravez_block_name: {
								$arrayElemAt: [`$block_details.name.${Constants.DEFAULT_LANGUAGE_CODE}`, 0]
							}
						}
					}
				];

				const [list, totalCount, filteredCount] = await Promise.all([
					this.collectionDb.aggregate(pipeline).toArray(),
					this.collectionDb.countDocuments({}),
					this.collectionDb.countDocuments(dataTableConfig.conditions)
				]);

				res.send({
					status: Constants.STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: list || [],
					recordsFiltered: filteredCount || 0,
					recordsTotal: totalCount || 0
				});
			} else {
				const options = {
					collections: [
						{
							collection: Tables.AREAS,
							columns: ['_id', ['name', Constants.DEFAULT_LANGUAGE_CODE]],
							conditions: { is_active: Constants.ACTIVE }
						},
						{
							collection: Tables.AREA_BLOCKS,
							columns: ['_id', ['name', Constants.DEFAULT_LANGUAGE_CODE]],
							conditions: { is_active: Constants.ACTIVE }
						}
					]
				};

				const response = await getDropdownList(req, res, next, options);

				if (response.status !== Constants.STATUS_SUCCESS) {
					req.flash(Constants.STATUS_ERROR, response.message);
					return res.redirect(Constants.WEBSITE_ADMIN_URL + 'kfg_areas');
				}

				req.breadcrumbs(BREADCRUMBS['admin/kfg_areas/list']);
				res.render('list', {
					area_list: response.final_html_data['0'],
					block_list: response.final_html_data['1']
				});
			}
		} catch (error) {
			next(error);
		}
	}

	async assignArea(req, res, next) {
		try {
			const kfgAreaId = req.params.id ? req.params.id : '';

			if (isPost(req)) {
				const areaId = req.body.area_id;
				if (!areaId) {
					return res.send({
						status: Constants.STATUS_ERROR,
						message: [{ param: 'area_id', msg: res.__('admin.kfg_areas.please_select_area') }]
					});
				}

				await this.collectionDb.updateOne(
					{ _id: new ObjectId(kfgAreaId) },
					{
						$set: {
							area_id: new ObjectId(areaId),
							modified: getUtcDate()
						}
					}
				);

				req.flash(
					Constants.STATUS_SUCCESS,
					res.__('admin.kfg_areas.area_has_been_assigned_successfully')
				);
				return res.send({
					status: Constants.STATUS_SUCCESS,
					message: res.__('admin.kfg_areas.area_has_been_assigned_successfully')
				});
			}

			const kfgArea = await this.collectionDb.findOne(
				{ _id: new ObjectId(kfgAreaId) },
				{ projection: { area_id: 1 } }
			);

			const areaId = kfgArea?.area_id || '';

			const options = {
				collections: [
					{
						collection: Tables.AREAS,
						columns: ['_id', ['name', Constants.DEFAULT_LANGUAGE_CODE]],
						conditions: { is_active: Constants.ACTIVE },
						selected: [areaId]
					}
				]
			};

			const response = await getDropdownList(req, res, next, options);

			if (response.status !== Constants.STATUS_SUCCESS) {
				req.flash(Constants.STATUS_ERROR, response.message);
				return res.redirect(Constants.WEBSITE_ADMIN_URL + 'kfg_areas');
			}

			res.render('assign_area', {
				layout: false,
				area_list: response.final_html_data['0'],
				kfg_area_id: kfgAreaId
			});
		} catch (error) {
			next(error);
		}
	}

	async assignBlock(req, res, next) {
		try {
			const kfgAreaId = req.params.id ? req.params.id : '';

			if (isPost(req)) {
				const blockId = req.body.block_id;
				if (!blockId) {
					return res.send({
						status: Constants.STATUS_ERROR,
						message: [{ param: 'block_id', msg: res.__('admin.kfg_areas.please_select_block') }]
					});
				}

				await this.collectionDb.updateOne(
					{ _id: new ObjectId(kfgAreaId) },
					{
						$set: {
							block_id: new ObjectId(blockId),
							modified: getUtcDate()
						}
					}
				);

				req.flash(
					Constants.STATUS_SUCCESS,
					res.__('admin.kfg_areas.block_has_been_assigned_successfully')
				);
				return res.send({
					status: Constants.STATUS_SUCCESS,
					message: res.__('admin.kfg_areas.block_has_been_assigned_successfully')
				});
			}

			const kfgArea = await this.collectionDb.findOne(
				{ _id: new ObjectId(kfgAreaId) },
				{ projection: { block_id: 1 } }
			);

			const blockId = kfgArea?.block_id || '';

			const options = {
				collections: [
					{
						collection: Tables.AREA_BLOCKS,
						columns: ['_id', ['name', Constants.DEFAULT_LANGUAGE_CODE]],
						conditions: { is_active: Constants.ACTIVE },
						selected: [blockId]
					}
				]
			};

			const response = await getDropdownList(req, res, next, options);

			if (response.status !== Constants.STATUS_SUCCESS) {
				req.flash(Constants.STATUS_ERROR, response.message);
				return res.redirect(Constants.WEBSITE_ADMIN_URL + 'kfg_areas');
			}

			res.render('assign_block', {
				layout: false,
				block_list: response.final_html_data['0'],
				kfg_area_id: kfgAreaId
			});
		} catch (error) {
			next(error);
		}
	}
}

export default KfgAreas;

