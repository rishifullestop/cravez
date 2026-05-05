import { fileURLToPath } from 'url';
import { dirname } from 'path';
import UserPermissions from "./model/user_permissions.mjs";
import * as Constants from "../../../config/global_constant.mjs";
import { validateRequest } from "../../../utils/index.mjs";
import { addEditValidation } from "./validations.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configure user_permissions routes
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @param {Object} options.db - Database connection instance
 * @param {Function} options.checkLoggedIn - Middleware to check user authentication
 */
export default function configure(router, { db, checkLoggedIn }) {
    const modulePath = Constants.FRONT_END_NAME + "user_permissions";
    const userPermissionsModule = new UserPermissions(db);

    // Set views for all /user_permissions* routes
    router.use(modulePath, (req, res, next) => {
        req.rendering.views = __dirname + "/views";
        next();
    });

	/** Routing is used for listing page **/
	router.all(modulePath,checkLoggedIn,(req, res,next) => {
		userPermissionsModule.list(req, res,next);
	});

	/** Routing is used to add permission **/
	router.all(modulePath+"/add",checkLoggedIn, addEditValidation, validateRequest, (req, res,next) => {
		userPermissionsModule.add(req, res,next);
	});

	/** Routing is used to edit permission **/
	router.all(modulePath+"/edit/:id",checkLoggedIn, addEditValidation, validateRequest, (req, res,next) => {
		userPermissionsModule.edit(req, res,next);
	});

	/** Routing is used to delete permission **/
	router.get(modulePath+"/delete/:id",checkLoggedIn,(req, res,next) => {
		userPermissionsModule.deleteUserPermission(req, res,next);
	});

	/** Routing is used to update status**/
	router.get(modulePath+"/update-status/:id/:status",checkLoggedIn,(req, res,next) => {
		userPermissionsModule.updateStatus(req, res,next);
	});

	/** Routing is used to get role modules **/
	router.post(modulePath+"/get_role_modules",checkLoggedIn,(req, res,next)=>{
		userPermissionsModule.getRestaurantRoleModulesData(req, res,next);
	});
}


