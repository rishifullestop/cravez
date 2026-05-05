import { fileURLToPath } from 'url';
import { dirname } from 'path';
import KfgAreas from './model/kfg_areas.mjs';
import { validateRequest } from '../../../utils/index.mjs';
import { assignAreaValidation, assignBlockValidation } from './validations.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function configure(router, { db, checkLoggedInAdmin }) {
	const modulePath = '/kfg_areas';
	const kfgAreasModule = new KfgAreas(db);

	router.use(modulePath, (req, res, next) => {
		req.rendering.views = __dirname + '/views';
		next();
	});

	router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
		kfgAreasModule.getKfgAreasList(req, res, next);
	});

	router.all(
		modulePath + '/assign_area/:id',
		checkLoggedInAdmin,
		assignAreaValidation,
		validateRequest,
		(req, res, next) => {
			kfgAreasModule.assignArea(req, res, next);
		}
	);

	router.all(
		modulePath + '/assign_block/:id',
		checkLoggedInAdmin,
		assignBlockValidation,
		validateRequest,
		(req, res, next) => {
			kfgAreasModule.assignBlock(req, res, next);
		}
	);
}

