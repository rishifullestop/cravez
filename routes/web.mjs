/**
 * Web.js
 *
 * This file is required by index.js. It sets up event listeners
 *
 * NODE.Js (http://nodejs.org)
 * Copyright Linux Foundation Collaborative (http://collabprojects.linuxfoundation.org/)
 *
 * @copyright     Linux Foundation Collaborative (http://collabprojects.linuxfoundation.org/)
 * @link          http://nodejs.org NODE.JS
 * @package       routes.js
 * @since         NODE.JS Latest version
 * @license       http://collabprojects.linuxfoundation.org Linux Foundation Collaborative
 */

/** Including contants file */
import * as Constants from "../config/global_constant.mjs";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

/** Get __dirname equivalent in ES modules */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Including i18n for languages */
import i18n from "i18n";

/** node cache module */
import myCache from '../cache.mjs';

/** Including common function */
import * as Helper from "../utils/index.mjs";
import {ADMIN_PERMISSION_CLASSES, ADMIN_PERMISSIONS, PERMISSIONS, PERMISSION_CLASSES}from "../permissions.mjs";
import {isLoggedIn, checkLoggedInAdmin, checkRestaurantLoggedIn, csrfRouteMiddleware, checkLoggedIn }from "../middleware/middleware.mjs";

import cors from 'cors';

import getAdminRouter from "../modules/admin/init_routes.mjs";
import getRestaurantRouter from "../modules/frontend/init_routes.mjs";
import getBranchRouter from "../modules/common/restaurant_branches/routes.mjs";
import getPendingBranchRouter from "../modules/common/restaurant_pending_branches/routes.mjs";

import axios from 'axios';
import https from 'https';
import { readFile } from 'fs/promises';

/**
 * Export a function, so that we can pass the app and io instances from app.js
 *
 * @param router As Express Object
 * @param io As Socket Io Object
 * @param mongo As Mongo db Object
 *
 * @return void.
 */
export const configure = async (router, io, mongo) => {
	let mongodb = 	mongo;
	let db 		= 	mongodb.getDb();
	let app 	=	router;

	async function loadSettingsFromFile() {
		try {
			const data = await readFile(`${Constants.WEBSITE_ROOT_PATH}config/settings.json`, 'utf8');
			const settings = JSON.parse(data);
			myCache.set("settings", settings, 0);
			return settings;
		} catch (error) {
			console.error('Failed to read local settings.json:', error);
			return {};
		}
	}

	/** Before Filter **/
	app.use(async (req, res, next) => {
		try {
			process.setMaxListeners(0);

			/** passed all constant in html files */
			if(Object.keys(Constants)?.length){
				Object.keys(Constants)?.forEach((key) => {
					res.locals[key] = Constants[key] ?? "";
				});
			}

			/** Passed some functions */
			res.locals.nl2br 				=	Helper.nl2br;
			res.locals.newDate 				= 	Helper.newDate;
			res.locals.round 				= 	Helper.round;
			res.locals.addDate 				=	Helper.addDate;
			res.locals.subtractDate 		=	Helper.subtractDate;
			res.locals.subtractMinute 		=	Helper.subtractMinute;
			res.locals.currencyFormat 		=	Helper.currencyFormat;
			res.locals.getPermissionClass 	=	Helper.getPermissionClass;
			res.locals.set24HourFormat 		=	Helper.set24HourFormat;
			res.locals.isRestaurant 		=	Helper.isRestaurant;
			res.locals.getDateRange			=	Helper.getDateRange;
			res.locals.addDaysToDate		=	Helper.addDaysToDate;

			res.locals.PERMISSIONS 			=	PERMISSIONS;
			res.locals.PERMISSION_CLASSES 	=	PERMISSION_CLASSES;
			res.locals.ADMIN_PERMISSIONS 	=	ADMIN_PERMISSIONS;
			res.locals.ADMIN_PERMISSION_CLASSES= ADMIN_PERMISSION_CLASSES;

			/** Rendering options to set views and layouts */
			req.rendering = {};

			res.locals.site_url 	= 	req.url;
			res.locals.originalUrl 	= 	((req.headers["request-type"] && req.headers["request-type"]=="ajax") && req.headers.referer) ? req.headers.referer : req.url;

			/** Change language */
			res.locals.item_display_lng_id 	 	= 	Constants.ENGLISH_LANGUAGE_MONGO_ID;
			res.locals.item_display_lng_code	=	Constants.ENGLISH_LANGUAGE_CODE;
			if(req.session && req.session.item_display_lng_id && req.session.item_display_lng_code){
				res.locals.item_display_lng_id 	 	= 	req.session.item_display_lng_id;
				res.locals.item_display_lng_code	=	req.session.item_display_lng_code;
			}

			/** Set auth user in locals */
			res.locals.auth = "";
			if (req.session?.user && req.session.user !== "undefined") {
				res.locals.auth = req.session.user;
			}

			res.locals.site_url = req.url;

			/** Configure flash messages **/
			res.locals.success_flash_message = "";
			res.locals.success_status = "";
			res.locals.error_flash_message = "";
			res.locals.error_status = "";

			if (req.session?.flash) {
				if (req.session.flash.success) {
					res.locals.success_status = Constants.STATUS_SUCCESS;
					res.locals.success_flash_message = req.session.flash.success;
				}
				if (req.session.flash.error) {
					res.locals.error_status = Constants.STATUS_ERROR;
					res.locals.error_flash_message = req.session.flash.error;
				}
			}

			/** Set default views folder path **/
			app.set("views", __dirname + "/views");

			res.locals.IMAGE_SERVER_NOT_WORKING = Constants.UPLOAD_TO_SERVER && true || false;

			/** Read/write Basic settings  **/
			let settings = myCache.get( "settings" );
			try {
				if (!Constants.UPLOAD_TO_SERVER) {
					if (settings !== undefined) {
						res.locals.settings = settings;
						return next();
					}
					// No cached settings, read local file
					res.locals.settings = await loadSettingsFromFile();
					return next();
				}

				/** Read file image server  */
				const agent 		=	new https.Agent({ rejectUnauthorized: false });
				const response 		= 	await axios.get(`${Constants.UPLOAD_SERVER_URL}settings.json`, { httpsAgent: agent });
				const isConnected 	= 	response && response.status === 200;

				res.locals.IMAGE_SERVER_NOT_WORKING = !isConnected;

				if (isConnected && response.data) {
					settings = response.data;
					myCache.set("settings", settings, 0);
					res.locals.settings = settings;
					return next();
				}
				throw new Error('Remote settings not usable');
			}catch(e){
				// Fallback: read from local settings.json
				res.locals.settings = await loadSettingsFromFile();
				return next();
			}
		} catch (err) {
			console.error("Middleware error:", err);
			next(err);
		}
	});

	app.use(cors());

	/** Admin Before Filter **/
	app.use(Constants.FRONT_END_NAME+Constants.ADMIN_NAME+"/", async function(req, res, next) {
		try {
			res.locals.active_path 		=	req.path.split("/")[1];
			res.locals.admin_list_url 	= 	Constants.WEBSITE_ADMIN_URL + res.locals.active_path;
			res.locals.list_url 		= 	Constants.WEBSITE_ADMIN_URL+res.locals.active_path;
			res.locals.active_path1 	= 	req.path.split("/")[1];

			res.locals.module_type 		= 	Constants.MODULE_TYPE_ADMIN;
			res.locals.breadcrumb		= 	req.breadcrumbs();

			/** Set default layout for admin **/
			req.rendering.layout = Constants.WEBSITE_ADMIN_LAYOUT_PATH+"default";

			// Handle admin modules
			if(!Helper.isPost(req) && req?.session?.user?.user_type == Constants.USER_TYPE_ADMIN){
				const userId = req.session.user._id || "";
				let moduleLists = Helper.userModuleFlagAction(userId, "", "get");

				if (!moduleLists) {
					try {
						const AdminModule 	 =	(await import(Constants.WEBSITE_ADMIN_MODULES_PATH + "admin_modules/model/admin_module.mjs")).default;
						const adminModule 	 = 	new AdminModule(db);
						const moduleResponse = 	await adminModule.getAdminModulesListing(req, res,{user_type: Constants.USER_TYPE_ADMIN });
						res.locals.admin_modules_list = moduleResponse.result || [];
						Helper.userModuleFlagAction(userId, moduleResponse.result, "add");
					} catch (error) {
						console.error("Error loading admin modules:", error);
						res.locals.admin_modules_list = [];
					}
				} else {
					res.locals.admin_modules_list = moduleLists;
				}
			} else {
				res.locals.admin_modules_list = [];
			}

			next();
		} catch (error) {
			console.error("Admin middleware error:", error);
			next(error);
		}
	});

	// Mount all admin panel routes under the base path
	const adminRouter = await getAdminRouter({ db, checkLoggedInAdmin, isLoggedIn });
	app.use(Constants.FRONT_END_NAME+Constants.ADMIN_NAME, adminRouter);

	/** Front Before Filter */
	app.use(Constants.FRONT_END_NAME+Constants.RESTAURANT_NAME+"/",function(req, res, next) {
		/** Set default layout for front **/
		req.rendering.layout 	= false;
		let userType	= req?.session?.user?.user_type || "";
		let moduleType 	= (userType == Constants.USER_TYPE_ADMIN) ? Constants.MODULE_TYPE_ADMIN : Constants.MODULE_TYPE_RESTAURANT;
		res.locals.module_type	= moduleType;
		next();
	});

	// Mount all restaurant branch common routes under the base path
	const branchCommonRouter = await getBranchRouter({ db, checkRestaurantLoggedIn });
	app.use(Constants.FRONT_END_NAME+Constants.RESTAURANT_NAME, branchCommonRouter);

	// Mount all restaurant pending branch common routes under the base path
	const pendingBranchCommonRouter = await getPendingBranchRouter({ db, checkRestaurantLoggedIn, checkLoggedInAdmin });
	app.use(Constants.FRONT_END_NAME+Constants.RESTAURANT_NAME, pendingBranchCommonRouter);

	// Dynamically import and initialize each module's routes
	for (const key of [
		"category_managers/routes",
		"menu_managers/routes",
		"item_managers/itemRoutes",
		"item_managers/choiceGroupRoutes",
		"item_managers/extraItemRoutes",
		"size_category/routes",
		"modify_orders/routes",
	]) {
		try {
			const tmpRoutes = await import(`${Constants.WEBSITE_COMMON_MODULES_PATH}${key}.mjs`);
			tmpRoutes.default(router, { db, checkRestaurantLoggedIn, checkLoggedInAdmin});
		} catch (error) {
			console.log(`Common include file error, ${key} --->`,error);
		}
	}

	/** Front Before Filter */
	app.use(Constants.FRONT_END_NAME,async function(req, res, next) {
		let pathData			= req.path.split("/");
		let path				= "";

		if(pathData[1]) path += "/"+pathData[1];
		if(pathData[2]) path += "/"+pathData[2];
		if(pathData[3]) path += "/"+pathData[3];
		res.locals.path 		= path;
		res.locals.active_path 	= pathData[1];
		res.locals.list_url 	= Constants.WEBSITE_URL + res.locals.active_path;
		res.locals.module_type 	= Constants.MODULE_TYPE_RESTAURANT;
		res.locals.breadcrumb	= req.breadcrumbs();

		/**Set Language */
		let languageId 	= (req.cookies != undefined && req.cookies.language_id) ? req.cookies.language_id : Constants.ENGLISH_LANGUAGE_MONGO_ID;
		if(Constants.LANGUAGES_IN_SYSTEM.indexOf(languageId) === -1){
			languageId = Constants.DEFAULT_LANGUAGE_MONGO_ID;
		}
		let lang	   = Constants.LANGUAGE_CODES[languageId];
		i18n.setLocale(lang);
		res.setLocale(lang);

		/** Set default layout for front **/
		req.rendering.layout = Constants.WEBSITE_LAYOUT_PATH+"default";

		/** Read/write admin Modules from/in Cache **/
		if(!Helper.isPost(req) && req?.session?.user?._id && req?.session?.user?.user_type == Constants.USER_TYPE_RESTAURANT){
			const AdminModule 	 =	(await import(Constants.WEBSITE_ADMIN_MODULES_PATH + "admin_modules/model/admin_module.mjs")).default;
			const adminModule 	 = 	new AdminModule(db);
			const moduleResponse = 	await adminModule.getAdminModulesListing(req, res,{user_type: Constants.USER_TYPE_RESTAURANT });
			res.locals.modules_list = moduleResponse.result || [];
			Helper.userModuleFlagAction(req.session.user._id, moduleResponse.result || [], "add");
		}else{
			res.locals.modules_list =   [];
		}
		next();
	});

	/************************  API Routes *****************************/
	try {
		// Dynamically import and initialize each module's routes
		for (const key of [
			"customerAddressRoutes",
			"customerDriverRegistrationRoutes",
			"driverBreaksRoutes",
			"driverExcuseRoutes",
			"driverOvertimeRequestRoutes",
			"homeRoutes",
			"myAccountRoutes",
			"notificationRoutes",
			"offerRoutes",
			"orderRoutes",
			"paymentTransactionsRoutes",
			"registrationRoutes",
			"restaurantPortalRoutes",
			"restaurantRoutes",
			"surveyRoutes",
			"userCartsRoutes",
			"userWalletRoutes",
			"vocRoutes",
		]) {
			const tmpRoutes = await import(`${Constants.WEBSITE_MODULES_PATH}api/${key}.mjs`);
			tmpRoutes.default(router, { db});
		}
	} catch (error) {
		console.log("API include file error ===>", error);
	}

	/** Include crons module **/
	const cronsModuleRoutes = await import(Constants.WEBSITE_MODULES_PATH+"crons/routes.mjs");
	cronsModuleRoutes.default(app, {db: db});

	// Mount all restaurant panel routes under the base path
	const restaurantRouter = await getRestaurantRouter({ db, isLoggedIn, csrfRouteMiddleware, checkLoggedIn });
	app.use(Constants.FRONT_END_NAME, restaurantRouter);

	// 404 handler for all unmatched admin routes
    // app.get("/*", function(req, res){
	// 	console.log(213213)
    //     res.send({dd: 1})
    // });

	/** Error Handling */
	app.use(function (err,req,res,next) {
		/**Handle csrf error */
		if (err.code === 'EBADCSRFTOKEN'){
			console.error('CSRF TOKEN Error handeled in web.js routing');
			return res.send({
				status 	: Constants.STATUS_ERROR,
				is_csrf	: true,
				message	: res.__("system.something_going_wrong_please_try_again")
			});
		}

		console.log('Error handled in web.js routing '+Helper.newDate("",Constants.DATABASE_DATE_TIME_FORMAT));
		console.error('Error handled in web.js routing '+Helper.newDate("",Constants.DATABASE_DATE_TIME_FORMAT));
		console.error('req.body');
		console.error(JSON.stringify(req.body));
		if(err.stack){
			console.error(err.stack);
		}else{
			console.error(err);
		}

		let currentPanel = (req.path.split("/")[1]) ? req.path.split("/")[1] : "";

		if(req.method == "POST"){
			/** If request is from admin panel */
			if(currentPanel == Constants.ADMIN_NAME){
				/** This response is work for both listing requests and other requests */
				return res.send({
					status: Constants.STATUS_ERROR,
					message:res.__("admin.system.something_going_wrong_please_try_again"),
					draw: 0,
					data: [],
					recordsFiltered: 0,
					recordsTotal: 0
				});
			}else if(currentPanel == Constants.RESTAURANT_NAME){
				return res.status(400).send({
					status: Constants.STATUS_ERROR,
					message:res.__("admin.system.something_going_wrong_please_try_again"),
				});
			}else{
				if(Helper.isMobileApi(req,res)){
					let result			=	{};
					result["status"]	= 	Constants.STATUS_ERROR;
					result["message"]	= 	[{msg: res.__("admin.system.something_going_wrong_please_try_again"),param: Constants.STATUS_ERROR}];

					// Convert the object to a JSON string
					const jsonString = JSON.stringify(result);

					// Encode the JSON string as a binary buffer
					const binaryBuffer = Buffer.from(jsonString, 'utf-8');

					// Encode the binary buffer to a Base64 string
					const encoded = binaryBuffer.toString('base64');

					return res.send({response: encoded});
				}
				return res.send({
					status: Constants.STATUS_ERROR,
					message:res.__("admin.system.something_going_wrong_please_try_again"),
				});
			}
		}

		let	viewPath	 = "";
		/* If request is from admin panel */
		if(currentPanel == Constants.ADMIN_NAME){
			/* Set view path to elements folder in admin panel */
			viewPath = Constants.WEBSITE_ADMIN_MODULES_PATH+"elements/";
			/* Set layout path */
			let layout404 = Constants.WEBSITE_ADMIN_LAYOUT_PATH+"404";
			if(res.locals.auth && res.locals.auth._id){
				layout404 = Constants.WEBSITE_ADMIN_LAYOUT_PATH+"default";
			}
			/** Set layout  404 **/
			req.rendering.layout	=	layout404;

			/** Set current view folder **/
			req.rendering.views		=	viewPath;

			/**Render error page*/
			return res.render("error");
		}else if(currentPanel == Constants.RESTAURANT_NAME){
			return res.status(400).send({
				status: Constants.STATUS_ERROR,
				message:res.__("admin.system.something_going_wrong_please_try_again"),
			});
		}

		/* Set view path to elements folder in admin panel */
		viewPath = Constants.WEBSITE_MODULES_PATH+"elements/";
		/* Set layout path */
		let layout404 = Constants.WEBSITE_LAYOUT_PATH+"404";
		if(res.locals.auth && res.locals.auth._id){
			layout404 = Constants.WEBSITE_LAYOUT_PATH+"default";
		}

		if(!req.rendering) req.rendering = {};

		/** Set layout  404 **/
		req.rendering.layout	=	layout404;

		/** Set current view folder **/
		req.rendering.views		=	viewPath;

		/**Render error page*/
		res.render("error");
	});
};
