import { fileURLToPath } from 'url';
import { dirname } from 'path';
import LanguageSettings from './model/language_settings.mjs';
import { convertMultipartReqBody, validateRequest } from '../../../utils/index.mjs';
import { addEditValidation } from './validations.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function configure(router, { db, checkLoggedInAdmin }) {
	const modulePath = '/language_settings/';
	const languageSettingsModule = new LanguageSettings(db);

	// Set views for all /language_settings* routes
	router.use(modulePath, (req, res, next) => {
		req.rendering.views = __dirname + '/views';
		next();
	});

	// External server management UI
	router.all(
		modulePath + 'external_server',
		checkLoggedInAdmin,
		convertMultipartReqBody,
		(req, res, next) => {
			languageSettingsModule.addEditExternalServer(req, res, next);
		}
	);

	router.all(
		modulePath + 'external_server/delete',
		checkLoggedInAdmin,
		convertMultipartReqBody,
		(req, res, next) => {
			languageSettingsModule.deleteExternalServer(req, res, next);
		}
	);

	// Text settings listing (legacy language_settings path)
	router.all(modulePath + ':type', checkLoggedInAdmin, (req, res, next) => {
		languageSettingsModule.getTextSettingList(req, res, next);
	});

	// Text settings add / edit
	router.all(
		modulePath + ':type/add',
		checkLoggedInAdmin,
		convertMultipartReqBody,
		addEditValidation,
		validateRequest,
		(req, res, next) => {
			languageSettingsModule.addEditTextSetting(req, res, next);
		}
	);

	router.all(
		modulePath + ':type/edit/:id',
		checkLoggedInAdmin,
		convertMultipartReqBody,
		addEditValidation,
		validateRequest,
		(req, res, next) => {
			languageSettingsModule.addEditTextSetting(req, res, next);
		}
	);

	// Auto add / edit endpoints used by external servers
	router.post(modulePath + ':type/auto_add', convertMultipartReqBody, (req, res, next) => {
		languageSettingsModule.addEditTextSetting(req, res, next);
	});

	router.post(modulePath + ':type/auto_edit/:id', convertMultipartReqBody, (req, res, next) => {
		languageSettingsModule.addEditTextSetting(req, res, next);
	});
}

