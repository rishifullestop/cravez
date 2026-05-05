import { fileURLToPath } from 'url';
import { dirname } from 'path';
import AdSliders from './model/ads_sliders.mjs';
import { convertMultipartReqBody } from '../../../utils/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function configure(router, { db, checkLoggedInAdmin }) {
	const modulePath = '/ads_sliders';
	const adsSlidersModule = new AdSliders(db);

	router.use(modulePath, (req, res, next) => {
		req.rendering.views = __dirname + '/views';
		next();
	});

	router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
		adsSlidersModule.getSliderList(req, res, next);
	});

	router.all(modulePath + '/add', checkLoggedInAdmin, convertMultipartReqBody,  (req, res, next) => {
		adsSlidersModule.addEditSlider(req, res, next);
	});

	router.all(modulePath + '/edit/:id', checkLoggedInAdmin, convertMultipartReqBody,  (req, res, next) => {
		adsSlidersModule.addEditSlider(req, res, next);
	});

	router.get(modulePath + '/delete/:id', checkLoggedInAdmin, (req, res, next) => {
		adsSlidersModule.deleteSlider(req, res, next);
	});
}

