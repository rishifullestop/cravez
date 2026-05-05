import { fileURLToPath } from 'url';
import { dirname } from 'path';
import SmsTemplate from './model/sms_templates.mjs';
import { addEditValidation } from './validations.mjs';
import { validateRequest } from '../../../utils/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function configure(router, { db, checkLoggedInAdmin }) {
	const modulePath = '/sms_templates';
	const smsTemplateModule = new SmsTemplate(db);

	// Set views for all /sms_templates* routes
	router.use(modulePath, (req, res, next) => {
		req.rendering.views = __dirname + '/views';
		next();
	});

	// Listing
	router.all(modulePath, checkLoggedInAdmin, (req, res, next) => {
		smsTemplateModule.list(req, res, next);
	});

	// Add
	router.all(
		modulePath + '/add',
		checkLoggedInAdmin,
		addEditValidation,
		validateRequest,
		(req, res, next) => {
			smsTemplateModule.addEditSmsTemplate(req, res, next);
		}
	);

	// Edit
	router.all(
		modulePath + '/edit/:id',
		checkLoggedInAdmin,
		addEditValidation,
		validateRequest,
		(req, res, next) => {
			smsTemplateModule.addEditSmsTemplate(req, res, next);
		}
	);

	// Delete
	router.get(modulePath + '/delete/:id', checkLoggedInAdmin, (req, res, next) => {
		smsTemplateModule.deleteSmsTemplate(req, res, next);
	});
}

