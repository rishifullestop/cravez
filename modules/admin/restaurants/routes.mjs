import { fileURLToPath } from 'url';
import { dirname } from 'path';
import BREADCRUMBS from '../../../breadcrumbs.mjs';
import Restaurant from './model/restaurants.mjs';
import * as Constants from '../../../config/global_constant.mjs';
import pendingBranchesModel from '../../../modules/common/restaurant_pending_branches/model/pending_branches.mjs';
import eachOfSeries from 'async/eachOfSeries.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function configure(router, { db, checkLoggedInAdmin }) {
	const basePath = '/restaurants';
	const modulePath = '/';
	const restaurantModule = new Restaurant(db);
	const pendingBranchesModule = new pendingBranchesModel(db);

	// Preserve existing query string for restaurant views
	router.use(basePath, (req, res, next) => {
		const finalQuery = (req._parsedUrl && req._parsedUrl.search) ? req._parsedUrl.search : '';
		res.locals.finalQuery = finalQuery;
		next();
	});

	// Pending category
	router.get(modulePath + 'restaurant_category', checkLoggedInAdmin, (req, res) => {
		const paramQuery = req.query || {};
		let finalQuery = '';
		if (paramQuery && Object.keys(paramQuery).length > 0) {
			Object.keys(paramQuery).forEach(key => {
				if (!finalQuery) finalQuery = '?';
				finalQuery += '&' + key + '=' + paramQuery[key];
			});
		}

		req.rendering.views = __dirname + '/views';
		req.breadcrumbs(BREADCRUMBS['admin/restaurants/pending_category']);
		res.render('restaurant_list', {
			link: Constants.WEBSITE_RESTAURANT_URL + 'pending_category' + finalQuery
		});
	});

	// Pending menu
	router.get(modulePath + 'restaurant_menu', checkLoggedInAdmin, (req, res) => {
		const paramQuery = req.query || {};
		let finalQuery = '';
		if (paramQuery && Object.keys(paramQuery).length > 0) {
			Object.keys(paramQuery).forEach(key => {
				if (!finalQuery) finalQuery = '?';
				finalQuery += '&' + key + '=' + paramQuery[key];
			});
		}
		req.rendering.views = __dirname + '/views';
		req.breadcrumbs(BREADCRUMBS['admin/restaurants/pending_menu']);
		res.render('restaurant_list', {
			link: Constants.WEBSITE_RESTAURANT_URL + 'pending_menu' + finalQuery
		});
	});

	// Pending item
	router.get(modulePath + 'restaurant_item', checkLoggedInAdmin, (req, res) => {
		const paramQuery = req.query || {};
		let finalQuery = '';

		if (paramQuery && Object.keys(paramQuery).length > 0) {
			Object.keys(paramQuery).forEach(key => {
				if (!finalQuery) finalQuery = '?';
				finalQuery += '&' + key + '=' + paramQuery[key];
			});
		}
		req.rendering.views = __dirname + '/views';
		req.breadcrumbs(BREADCRUMBS['admin/restaurants/pending_item']);
		res.render('restaurant_list', {
			link: Constants.WEBSITE_RESTAURANT_URL + 'pending_item' + finalQuery
		});
	});

	// Restaurant listing
	router.get(modulePath + 'restaurants', checkLoggedInAdmin, (req, res, next) => {
		req.rendering.views = __dirname + '/views';
		restaurantModule.restaurantListing(req, res, next);
	});
	router.get(modulePath + 'restaurants/:slug', checkLoggedInAdmin, (req, res, next) => {
		req.rendering.views = __dirname + '/views';
		restaurantModule.restaurantListing(req, res, next);
	});
	router.get(modulePath + 'restaurants/:slug/:type', checkLoggedInAdmin, (req, res, next) => {
		req.rendering.views = __dirname + '/views';
		restaurantModule.restaurantListing(req, res, next);
	});
	router.get(modulePath + 'restaurants/:slug/:type/:id', checkLoggedInAdmin, (req, res, next) => {
		req.rendering.views = __dirname + '/views';
		restaurantModule.restaurantListing(req, res, next);
	});

	// Pending restaurant branches list
	router.all(modulePath + 'restaurant_pending_branches', checkLoggedInAdmin, (req, res, next) => {
		req.rendering.views = __dirname + '/views';
		restaurantModule.pendingBranchList(req, res, next);
	});

	// Update pending branch status
	router.post(modulePath + 'restaurant_pending_branches/update_branch_status', checkLoggedInAdmin, async (req, res, next) => {
		try {
			const status = req.body.status || '';
			const branchIds = req.body.branch_ids ? req.body.branch_ids.split(',') : '';

			if (!status || !branchIds) {
				return res.send({ status: Constants.STATUS_ERROR, message: res.__('system.invalid_access') });
			}

			await eachOfSeries(branchIds, async (branchId, key, seriesCallback) => {
				try {
					req.params.id = branchId;
					req.body.branch_id = branchId;
					const response = await pendingBranchesModule[
						status === Constants.IN_REVIEW ? 'markBranchInReview' :
						status === Constants.APPROVED ? 'approveBranchPendingRequest' :
						'rejectBranchRequest'
					](req, res, next);
					if (response.status !== Constants.STATUS_SUCCESS) {
						return seriesCallback(response.message);
					}
					seriesCallback(null);
				} catch (error) {
					seriesCallback(error);
				}
			});

			const message =
				status === Constants.IN_REVIEW
					? res.__('admin.restaurant_pending_branches.status_has_been_updated_successfully')
					: (status === Constants.APPROVED
						? res.__('pending_branches.branch_approved_successfully')
						: res.__('pending_branches.restaurant_enquiry_has_been_rejected'));

			return res.send({
				status: Constants.STATUS_SUCCESS,
				message
			});
		} catch (error) {
			return res.send({
				status: Constants.STATUS_ERROR,
				message: error?.message || res.__('system.invalid_access')
			});
		}
	});
}

