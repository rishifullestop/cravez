import { fileURLToPath } from 'url';
import { dirname } from 'path';
import masterController from "./model/master.mjs";
import { addEditValidation } from "./validations.mjs";
import { validateRequest, convertMultipartReqBody } from "../../../utils/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure master management routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedInAdmin - Middleware to check admin authentication
 */
export default function configure(router, { db, checkLoggedInAdmin }) {
    const modulePath = '/master';
	const masterModel = new masterController(db);

	/** Set current view folder **/
	router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

	/** Routing is used to get master list **/
	router.all(modulePath + "/:type", checkLoggedInAdmin, (req, res) => {
		masterModel.getMasterList(req, res);
	});

	/** Routing is used to update master status **/
	router.all(modulePath + "/:type/change_status/:id/:status", checkLoggedInAdmin, (req, res, next) => {
		masterModel.updateMasterStatus(req, res, next);
	});

	/** Routing is used to add master **/
	router.all(modulePath + "/:type/add", checkLoggedInAdmin, convertMultipartReqBody, addEditValidation, validateRequest, (req, res, next) => {
		masterModel.addMaster(req, res, next);
	});

	/** Routing is used to edit master **/
	router.all(modulePath + "/:type/edit/:id", checkLoggedInAdmin, convertMultipartReqBody, addEditValidation, validateRequest, (req, res, next) => {
		masterModel.masterUpdate(req, res, next);
	});
} 