import {ADMIN_PERMISSIONS, PERMISSIONS }from "../permissions.mjs";
import * as Constants from "../config/global_constant.mjs";
import { getDb } from '../config/connection.mjs';
import { sendApiResponse, sanitizeData } from "../utils/index.mjs";
import lusca from 'lusca';

/** Including i18n for languages */
import i18n from "i18n";

// Create the lusca CSRF middleware instance
const csrfProtection = lusca.csrf();

/** Function to check admin is logged in or not */
const checkLoggedInAdmin = async (req, res, next)=>{
	res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");

	if(req?.session?.user?._id && req?.session?.user?.user_role_id){
		let authUserRoleId = req.session.user.user_role_id;
		const db = getDb();

		if(authUserRoleId == Constants.CRAVEZ){
			return next();
		}else if(authUserRoleId != Constants.FRONT_USER_ROLE_ID && req?.session?.user?.user_type == Constants.USER_TYPE_ADMIN){
			try{
				const AdminModule 	 =	(await import(Constants.WEBSITE_ADMIN_MODULES_PATH + "admin_modules/model/admin_module.mjs")).default;
				const adminModule 	 = 	new AdminModule(db);
				const moduleResponse = 	await adminModule.getAdminModulesListing(req, res,{user_type: Constants.USER_TYPE_ADMIN });

				let validUrl		= 	false;
				let moduleIds 		=	moduleResponse.result;
				let currentPath 	= 	req?.route?.path  || "";

				for(let i in moduleIds){
					let modules		= (moduleIds[i].sub_modules) ? moduleIds[i].sub_modules	: [];
					let moduleChilds= (moduleIds[i].childs) ? moduleIds[i].childs	: [];
					let moduleSlug	= (moduleIds[i].slug) 	 ? moduleIds[i].slug 	: "";

					/**
					 *  Remove /admin/ from url
					 *  eg 1. url : "/admin/dashboard" after replace it will be "/dashboard"
					 *  eg 2. url : "/restaurant_requests/approve_branch" after replace it will be "/approve_branch"
					 **/
					let currentNodePath = (currentPath) ? currentPath.replace("/"+Constants.ADMIN_NAME+"/","/").replace("/"+Constants.RESTAURANT_NAME+"/","/") : "";

					if(modules.length>0){
						for(let k in modules){
							let childModuleSlug 	 = (modules[k]) ? modules[k] : "";
							let childPermissionPaths = ADMIN_PERMISSIONS?.[moduleSlug]?.[childModuleSlug]?.paths || [];

							if(currentNodePath && childPermissionPaths.length>0 && childPermissionPaths.indexOf(currentNodePath) !== -1){
								validUrl = true;
								break;
							}
						}
					}

					if(!validUrl){
						if(moduleChilds.length>0){
							for(let q in moduleChilds){
								let childModules= (moduleChilds[q].sub_modules) ? moduleChilds[q].sub_modules	: [];
								let childSlug	= (moduleChilds[q].slug) 	 	? moduleChilds[q].slug 	: "";
								if(childModules.length>0){
									for(let k in childModules){
										let childModuleSlug 	 = (childModules[k]) ? childModules[k] : "";
										let childPermissionPaths = ADMIN_PERMISSIONS?.[childSlug]?.[childModuleSlug]?.paths || [];

										if(currentNodePath && childPermissionPaths.length>0 && childPermissionPaths.indexOf(currentNodePath) !== -1){
											validUrl = true;
											break;
										}
									}
								}
							}
						}
					}
					if(validUrl){
						break;
					}
				}

				if(validUrl || Constants.ADMIN_ALLOWED_PERMISSIONS.indexOf(currentPath) !== -1){
					return next();
				}else{
					if(req.method == "POST" || (req.headers["request-type"] && req.headers["request-type"]=="ajax")){
						res.status(400).send({
							status : Constants.STATUS_ERROR,
							message : res.__("admin.system.invalid_access")
						});
					}else{
						req.flash(Constants.STATUS_ERROR,res.__("admin.system.invalid_access"));
						res.redirect(Constants.WEBSITE_ADMIN_URL+'dashboard');
					}
				}
			}catch(e){
				console.log("catch werror ",e)
				req.flash(Constants.STATUS_ERROR,res.__("admin.system.something_going_wrong_please_try_again"));
				return res.redirect(Constants.WEBSITE_ADMIN_URL+'dashboard');
			}
		}else if(req?.session?.user?.user_type != Constants.USER_TYPE_ADMIN){
			res.redirect(Constants.WEBSITE_URL+"dashboard");
		}else{
			res.redirect(Constants.WEBSITE_ADMIN_URL+"login");
		}
	}else{
		res.redirect(Constants.WEBSITE_ADMIN_URL+"login");
	}
}

/** Function to check if user is logged in then redirect him/her to dashboard */
const isLoggedIn = (req, res, next)=>{
	res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");

	if(req.session && req.session.user && req.session.user._id && req.session.user.user_role_id){
		if (req.session.user.user_role_id == Constants.FRONT_USER_ROLE_ID){
			res.redirect(Constants.WEBSITE_URL+"dashboard");
		}else{
			res.redirect(Constants.WEBSITE_ADMIN_URL+"dashboard");
		}
	}else{
		return next();
	}
}

/** Function to check if API request is valid or call before login */
const authenticateAPIPublicRequest = (req, res, next)=>{
	res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");

	if(req?.headers?.authkey == Constants.WEBSITE_HEADER_AUTH_KEY){
		try {
			if (req?.body?.data) {
				const binaryBuffer = Buffer.from(req.body.data, 'base64');
				const decodedString = binaryBuffer.toString('utf8');
				req.body = JSON.parse(decodedString);

				req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
				req.body.language_id = req?.body?.language_id || Constants.DEFAULT_LANGUAGE_MONGO_ID;
				if (!Constants.LANGUAGES_IN_SYSTEM.includes(req.body.language_id)) {
					req.body.language_id = Constants.DEFAULT_LANGUAGE_MONGO_ID;
				}

				const lang = Constants.LANGUAGE_CODES[req.body.language_id];
				i18n.setLocale(lang);
				res.setLocale(lang);
			}
		}catch (err) {
			sendApiResponse(req, res, next, {
				status	:	Constants.STATUS_ERROR,
				message	:	res.__("admin.system.invalid_access")
			});
		}
		return next();
	}else{
		sendApiResponse(req, res, next, {
			status	:	Constants.STATUS_ERROR,
			message	:	res.__("admin.system.invalid_access")
		});
	}
}

/** Function to check if API request is valid or call after login */
const authenticateAPIPrivateRequest = (req, res, next)=>{
	res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");

	if(
		req?.headers?.authkey == Constants.WEBSITE_HEADER_AUTH_KEY &&
		(req?.body?.user_id || req?.body?.device_id)
	){
		return next();
	}else{
		res.result = {
			status	:	Constants.STATUS_ERROR,
			message	:	res.__("admin.system.invalid_access")
		};
		next();
	}
}

/** Function to check user is logged in or not **/
const checkLoggedIn = async (req, res, next)=> {
	res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
	if(req?.session?.user?._id && req?.session?.user?.user_type === Constants.USER_TYPE_RESTAURANT){
		if(req?.session?.user?.user_role_id == Constants.RESTAURANT){
			return next();
		}else{
			const db = getDb();
			const AdminModule 	 =	(await import(Constants.WEBSITE_ADMIN_MODULES_PATH + "admin_modules/model/admin_module.mjs")).default;
			const adminModule 	 = 	new AdminModule(db);
			const moduleResponse = 	await adminModule.getAdminModulesListing(req, res,{user_type: Constants.USER_TYPE_RESTAURANT });

			let validUrl	= 	false;
			let moduleIds 	=	moduleResponse.result;
			let currentPath	=	(req.route.path) ? req.route.path : "";

			for(let i in moduleIds){
				let modules			= (moduleIds[i].sub_modules) ? moduleIds[i].sub_modules	: [];
				let moduleChilds	= (moduleIds[i].childs) ? moduleIds[i].childs : [];

				let moduleSlug		= (moduleIds[i].slug) ? moduleIds[i].slug : "";
				/** If path is /restaurants/menu/:slug then convert it to /menu/:slug */
				let currentNodePath = currentPath.replace("/restaurants/","/");

				if(modules.length>0){
					for(let k in modules){
						let childModuleSlug 	 = (modules[k]) ? modules[k] : "";
						let childPermissionPaths = PERMISSIONS?.[moduleSlug]?.[childModuleSlug]?.paths || [];

						if(currentNodePath && childPermissionPaths.length>0 && childPermissionPaths.indexOf(currentNodePath) !== -1){
							validUrl = true;
							break;
						}
					}
				}

				if(!validUrl){
					if(moduleChilds.length>0){
						for(let q in moduleChilds){
							let childModules= (moduleChilds[q].sub_modules) ? moduleChilds[q].sub_modules	: [];
							let childSlug	= (moduleChilds[q].slug) 	 	? moduleChilds[q].slug 	: "";

							if(childModules.length>0){
								for(let k in childModules){
									let childModuleSlug 	 = (childModules[k]) ? childModules[k] : "";
									let childPermissionPaths = PERMISSIONS?.[childSlug]?.[childModuleSlug]?.paths || [];
									if(currentNodePath && childPermissionPaths.length>0 && childPermissionPaths.indexOf(currentNodePath) !== -1){
										validUrl = true;
										break;
									}
								}
							}
						}
					}
				}
				if(validUrl){
					break;
				}
			}

			if(validUrl || Constants.FRONT_ALLOWED_PERMISSIONS.indexOf(currentPath) !== -1){
				return next();
			}else{

				if(req?.method == "POST" || (req?.headers?.["request-type"] && req?.headers?.["request-type"]=="ajax")){
					res.status(400).send({
						status : Constants.STATUS_ERROR,
						message : res.__("admin.system.invalid_access")
					});
				}else{
					req.flash(Constants.STATUS_ERROR,res.__("system.invalid_access"));
					res.redirect(Constants.WEBSITE_URL+'dashboard');
				}

			}
		}
	}else{
		res.redirect(Constants.WEBSITE_URL);
	}
}//end checkLoggedIn();

const checkRestaurantLoggedIn = async(req, res, next)=>{
	res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
	if(req?.session?.user?._id && req?.session?.user?.user_role_id && req?.session?.user?.user_type !== typeof undefined ){
		if(req.session.user.user_role_id == Constants.CRAVEZ || req.session.user.user_role_id == Constants.RESTAURANT){
			return next();
		}else{
			const db = getDb();
			let userType			=	req.session.user.user_type;
			let permissionModules	= 	userType == Constants.USER_TYPE_ADMIN ? ADMIN_PERMISSIONS : PERMISSIONS;

			const AdminModule 	 =	(await import(Constants.WEBSITE_ADMIN_MODULES_PATH + "admin_modules/model/admin_module.mjs")).default;
			const adminModule 	 = 	new AdminModule(db);
			let tmpUserType      =  (userType == Constants.USER_TYPE_ADMIN) ? Constants.USER_TYPE_ADMIN :Constants.USER_TYPE_RESTAURANT;
			const moduleResponse = 	await adminModule.getAdminModulesListing(req, res,{user_type: tmpUserType });

			let validUrl		= 	false;
			let moduleIds 		=	moduleResponse.result;
			let currentPath 	= 	(req.route.path) ? req.route.path : "";

			for(let i in moduleIds){

				let modules		= (moduleIds[i].sub_modules) ? moduleIds[i].sub_modules	: [];
				let moduleChilds= (moduleIds[i].childs) ? moduleIds[i].childs	: [];
				let moduleSlug	= (moduleIds[i].slug) 	 ? moduleIds[i].slug 	: "";

				/**
				 *  Remove /restaurants/ from url
				 *  eg. url : "/restaurants/menu" after replace it will be "/menu"
				 **/
				let currentNodePath = (currentPath) ? currentPath.replace("/"+Constants.RESTAURANT_NAME,"") : "";

				if(modules.length>0){
					for(let k in modules){
						let childModuleSlug 	 = (modules[k]) ? modules[k] : "";
						let childPermissionPaths = (permissionModules[moduleSlug] && permissionModules[moduleSlug][childModuleSlug] && permissionModules[moduleSlug][childModuleSlug].paths) ? permissionModules[moduleSlug][childModuleSlug].paths : {};

						if(currentNodePath && childPermissionPaths.length>0 && childPermissionPaths.indexOf(currentNodePath) !== -1){
							validUrl = true;
							break;
						}
					}
				}
				if(!validUrl){
					if(moduleChilds.length>0){
						for(let q in moduleChilds){
							let childModules= (moduleChilds[q].sub_modules) ? moduleChilds[q].sub_modules	: [];
							let childSlug	= (moduleChilds[q].slug) 	 	? moduleChilds[q].slug 	: "";

							if(childModules.length>0){
								for(let k in childModules){
									let childModuleSlug 	 = (childModules[k]) ? childModules[k] : "";
									let childPermissionPaths = (permissionModules[childSlug] && permissionModules[childSlug][childModuleSlug] && permissionModules[childSlug][childModuleSlug].paths) ? permissionModules[childSlug][childModuleSlug].paths : {};

									if(currentNodePath && childPermissionPaths.length>0 && childPermissionPaths.indexOf(currentNodePath) !== -1){
										validUrl = true;
										break;
									}
								}
							}
						}
					}
				}
				if(validUrl){
					break;
				}
			}

			if(validUrl){
				return next();
			}else{
				res.status(400).send({status : Constants.STATUS_ERROR, message : res.__("admin.system.invalid_access")});
			}
		}
	}else{
		res.redirect(Constants.WEBSITE_URL+"login");
	}
}

/**
 * Middleware to apply CSRF protection only to specific routes.
 * - On GET/HEAD: generates and exposes the CSRF token.
 * - On POST/PUT/DELETE: validates the CSRF token automatically.
 */
const csrfRouteMiddleware = (req, res, next) => {
	// Apply lusca CSRF middleware to this request
	csrfProtection(req, res, (err) => {
		if (err) return next(err); // If token is invalid, this returns 403

		// If GET or HEAD, expose the token for use in forms/templates
		if (['GET', 'HEAD'].includes(req.method) && req.csrfToken) {
			res.locals.csrfToken = req.csrfToken(); // for EJS, Pug, etc.
			req.csrfTokenValue = res.locals.csrfToken; // optional: for APIs
		}

		// Continue to next handler
		next();
	});
};

/**
 * Middleware to use to 404 page
 */
const send404Page = (req, res, isAdmin = false) => {
	const accept = req.headers.accept || '';
	if (accept.includes('text/html')) {
		let viewPath 	=	isAdmin && Constants.WEBSITE_ADMIN_MODULES_PATH || Constants.WEBSITE_MODULES_PATH;
		let layPath 	=	isAdmin && Constants.WEBSITE_ADMIN_LAYOUT_PATH || Constants.WEBSITE_LAYOUT_PATH;
		let layout404 	= 	layPath+(res?.locals?.auth?._id &&  "default" || "404");
		let page    	=   "404";

		/** Set current view folder **/
		req.rendering.views	=	viewPath+"elements/";

		/** Set layout  **/
		req.rendering.layout = layout404;

		/**Render 404 page*/
		return res.render(page);
	}
	return res.status(400).json({
		status: 400,
		message: 'Bad Request'
	});
};


export {
	checkLoggedInAdmin,
	isLoggedIn,
	authenticateAPIPublicRequest,
	authenticateAPIPrivateRequest,
	checkRestaurantLoggedIn,
	csrfRouteMiddleware,
	checkLoggedIn,
	send404Page,
};