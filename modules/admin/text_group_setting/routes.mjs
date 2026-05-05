import { fileURLToPath } from 'url';
import { dirname } from 'path';
import TextGroupSetting from './model/text_group_setting.mjs';
import { convertMultipartReqBody } from '../../../utils/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function configure(router, { db, checkLoggedInAdmin }) {
	const modulePath = '/text_group_setting/';
	const textGroupModule = new TextGroupSetting(db);

	// Set views for all /text_group_setting* routes
	router.use(modulePath, (req, res, next) => {
		req.rendering.views = __dirname + '/views';
		next();
	});

	// List text group settings
	router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
		textGroupModule.getTextGroupSettingList(req, res, next);
	});

	// View single group
	router.all(modulePath + ':id/view', checkLoggedInAdmin, (req, res, next) => {
		textGroupModule.viewTextGroupSetting(req, res, next);
	});

	// Edit single text setting inside group
	router.all(modulePath + ':text_id/edit/:id', checkLoggedInAdmin, (req, res, next) => {
		textGroupModule.editTextSetting(req, res, next);
	});

	// Delete single text setting
	router.all(modulePath + ':text_id/delete_test_setting/:id', checkLoggedInAdmin, (req, res, next) => {
		textGroupModule.deleteTextSetting(req, res, next);
	});

	// Delete whole group
	router.all(modulePath + 'delete/:id', checkLoggedInAdmin, (req, res, next) => {
		textGroupModule.deleteTextGroupSetting(req, res, next);
	});

	// Export selected group
	router.all(modulePath + 'export/:id', checkLoggedInAdmin, (req, res, next) => {
		textGroupModule.exportTextGroupSetting(req, res, next);
	});

	// Import text settings
	router.all(
		modulePath + 'importData',
		checkLoggedInAdmin,
		convertMultipartReqBody,
		(req, res, next) => {
			textGroupModule.importData(req, res, next);
		}
	);

	// Export all text settings (Excel)
	router.all(modulePath + 'export_data/:export_type', checkLoggedInAdmin, (req, res, next) => {
		textGroupModule.exportData(req, res, next);
	});

	// Export all text settings (JSON)
	router.all(modulePath + 'export_to_json', checkLoggedInAdmin, (req, res, next) => {
		textGroupModule.exportJsonData(req, res, next);
	});
}

