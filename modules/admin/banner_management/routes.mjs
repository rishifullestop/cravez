import { fileURLToPath } from 'url';
import { dirname } from 'path';
import BannerManagement from './model/banner_management.mjs';
import { convertMultipartReqBody, validateRequest } from '../../../utils/index.mjs';
import { addEditValidation } from './validations.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function configure(router, { db, checkLoggedInAdmin }) {
	const modulePath = '/banner_management';
	const bannerModule = new BannerManagement(db);

	router.use(modulePath, (req, res, next) => {
		req.rendering.views = __dirname + '/views';
		next();
	});

	router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
		bannerModule.getBannerList(req, res, next);
	});

	router.all(modulePath + '/add', checkLoggedInAdmin, convertMultipartReqBody, addEditValidation, validateRequest, (req, res, next) => {
		bannerModule.addEditBanner(req, res, next);
	});

	router.all(modulePath + '/edit/:id', checkLoggedInAdmin, convertMultipartReqBody, addEditValidation, validateRequest, (req, res, next) => {
		bannerModule.addEditBanner(req, res, next);
	});

	router.get(modulePath + '/delete/:id', checkLoggedInAdmin, (req, res, next) => {
		bannerModule.deleteBanner(req, res, next);
	});

	router.get(modulePath + '/update_status/:id/:status', checkLoggedInAdmin, (req, res, next) => {
		bannerModule.updateBannerStatus(req, res, next);
	});
}

