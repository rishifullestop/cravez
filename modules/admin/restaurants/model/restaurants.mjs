import * as Constants from '../../../../config/global_constant.mjs';
import { isPost, getRestaurantDropdowns, configDatatable } from '../../../../utils/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import Tables from '../../../../config/database_tables.mjs';

class Restaurant {
	constructor(db) {
		this.db = db;
		this.tmpBranches = db.collection(Tables.TMP_RESTAURANT_BRANCHES);
	}

	/**
	 * Render restaurant list with dropdowns and query context
	 */
	async restaurantListing(req, res, next, options = {}) {
		try {
			const slug = req.params.slug || '';
			const type = req.params.type || '';
			const id = req.params.id || '';
			const branchId = (req.query && req.query.branch) ? req.query.branch : '';

			const restaurantList = await getRestaurantDropdowns(req, res, next, { slug });

			req.breadcrumbs(BREADCRUMBS['admin/restaurants/list']);
			return res.render('list', {
				restaurantList,
				slug,
				type,
				id,
				branch_id: branchId
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Pending restaurant branches list (DataTable + view)
	 */
	async pendingBranchList(req, res, next) {
		try {
			if (isPost(req)) {
				const limit = req.body.length ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
				const skip = req.body.start ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;

				const collection = this.tmpBranches;

				const dataTableConfig = await configDatatable(req, res, null);

				const commonConditions = {
					submit_for_approval: true
				};
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				const dbRes = await collection
					.aggregate([
						{ $match: dataTableConfig.conditions },
						{
							$facet: {
								branch_list: [
									{ $sort: dataTableConfig.sort_conditions },
									{ $skip: skip },
									{ $limit: limit },
										{
											$lookup: {
												from: Tables.RESTAURANTS,
												localField: 'restaurant_id',
												foreignField: '_id',
												as: 'restaurant_detail'
											}
										},
									{
										$project: {
											_id: 1,
											name: 1,
											branch_number: 1,
											status: 1,
											address: 1,
											restaurant_slug: 1,
											branch_id: 1,
											restaurant_name: { $arrayElemAt: ['$restaurant_detail.default_name', 0] }
										}
									}
								],
								count: [{ $count: 'count' }]
							}
						}
					])
					.toArray();

				return res.send({
					status: Constants.STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: dbRes?.[0]?.branch_list || [],
					recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0,
					recordsTotal: dbRes?.[0]?.count?.[0]?.count || 0
				});

			} else {
				const searchStatus = (req.query && req.query.status) ? req.query.status : '';
				const options = {};
				if (req.query && req.query.restaurant) options.slug = req.query.restaurant;

				const restaurantList = await getRestaurantDropdowns(req, res, next, options);

				req.breadcrumbs(BREADCRUMBS['admin/restaurant_pending_branches/list']);
				return res.render('pending_branch_list', {
					restaurant_list: restaurantList,
					search_status: searchStatus
				});
			}
		} catch (error) {
			next(error);
		}
	}
}

export default Restaurant;

