import { fileURLToPath } from 'url';
import { dirname } from 'path';
import PublicComposite from './model/public_composite.mjs';
import { validateRequest } from '../../../utils/index.mjs';
import { addEditValidation } from './validations.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function configure(router, { db, checkLoggedInAdmin }) {
	const modulePath = '/public_composite';
	const publicCompositeModule = new PublicComposite(db);

	router.use(modulePath, (req, res, next) => {
		req.rendering.views = __dirname + '/views';
		next();
	});

	router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
		publicCompositeModule.getCompositeList(req, res, next);
	});

	router.all(
		modulePath + '/add',
		checkLoggedInAdmin,
		addEditValidation,
		validateRequest,
		(req, res, next) => {
			publicCompositeModule.addEditComposite(req, res, next);
		}
	);

	router.all(
		modulePath + '/edit/:id',
		checkLoggedInAdmin,
		addEditValidation,
		validateRequest,
		(req, res, next) => {
			publicCompositeModule.addEditComposite(req, res, next);
		}
	);

	router.all(modulePath + '/change_status/:id/:status', checkLoggedInAdmin, (req, res, next) => {
		publicCompositeModule.updateStatus(req, res, next);
	});
}

