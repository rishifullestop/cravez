import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import {isPost, sanitizeData, getUtcDate, configDatatable } from "../../../../utils/index.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { parallel as asyncParallel } from 'async';
import myCache from '../../../../cache.mjs';
import clone from 'clone';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

/**
 * AdminModule class for handling admin / restaurant left menu options
 */
class AdminModule {
    /**
     * Creates an instance of AdminModule
     * @param {Object} db - Database connection instance
     */
    constructor(db) {
        this.db             =   db;
        this.collectionDb   =   db.collection(Tables.ADMIN_MODULES);
        this.collation      =   Tables.ADMIN_MODULES
    }

    /**
     * Function to get Admin Modules list
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>}
     */
    async list(req, res, next) {
        const moduleType = req.params.module_type || "";

        if (isPost(req)) {
            try {
                // Set conditions
                const commonConditions = {
                    module_type: moduleType
                };

                const limit = parseInt(req.body.length || Constants.ADMIN_LISTING_LIMIT);
                const skip =  parseInt(req.body.start || Constants.DEFAULT_SKIP);

                // Configure Datatable conditions
                const dataTableConfig = await configDatatable(req, res, null);

                // Default sorting
                if (dataTableConfig?.sort_conditions?.["_id"]){
                    dataTableConfig.sort_conditions = {
                        parent_order: Constants.SORT_ASC,
                        parent_id: Constants.SORT_ASC,
                        order: Constants.SORT_ASC
                    };
                }

                dataTableConfig.conditions = { ...dataTableConfig.conditions, ...commonConditions };

                // Get list or count of admin modules
                let dbRes = await this.collectionDb.aggregate([
                    { $match: dataTableConfig.conditions },
                    {
                        $facet : {
                            list : [
                                {
                                    $lookup: {
                                        from: this.collation,
                                        localField: "parent_id",
                                        foreignField: "_id",
                                        as: "parent_detail"
                                    }
                                },
                                {
                                    $project: {
                                        id: 1,
                                        title: 1,
                                        parent_id: 1,
                                        module_type: 1,
                                        is_active: 1,
                                        order: 1,
                                        modified: 1,
                                        only_for_permission: 1,
                                        parent_name: { $arrayElemAt: ["$parent_detail.title", 0] },
                                        parent_order: {
                                            $cond: {
                                                if: { $eq: ["$parent_id", 0] },
                                                then: '$order',
                                                else: { $arrayElemAt: ["$parent_detail.order", 0] }
                                            }
                                        }
                                    }
                                },
                                { $sort: dataTableConfig.sort_conditions },
                                { $skip: skip },
                                { $limit: limit }
                            ],
                            count: [
                                {$count: "count"},
                            ],
                        }
                    }
                ]).toArray();

                // Send response
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data			:   dbRes?.[0]?.list ||[],
                    recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
                });
            } catch (e) { return next(e);}
        } else {
            try {
                const response = await this.getAdminModulesList(req, res);
                if (response.status === Constants.STATUS_SUCCESS) {
                    // Render list page
                    req.breadcrumbs(BREADCRUMBS['admin/admin_modules/list']);
                    res.render('list', {
                        result: response.result || "",
                        moduleType,
                        dynamic_url: moduleType
                    });
                } else {
                    // Send error response
                    req.flash(Constants.STATUS_ERROR, response.message);
                    res.redirect(`${Constants.WEBSITE_ADMIN_URL}dashboard`);
                }
            } catch (error) { next(error);}
        }
    }

    /**
     * Add new admin module
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>}
     */
    addEdit = async (req, res, next) => {
        try {
            const moduleType    =   req.params.module_type || "";
            let isEditable	    =   req.params.id || false;

            if (isPost(req)) {
                /** Sanitize Data **/
                req.body        =   sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                const moduleId  =   req.params.id && ObjectId.isValid(req.params.id) && new ObjectId(req.params.id) || new ObjectId();
                const {
                    title = "",
                    path = "",
                    group_path = "",
                    icon = "",
                    slug = "",
                    order = "",
                    only_for_menu = false,
                    only_for_permission = false,
                    parent = 0
                } = req.body;

                const result = await this.collectionDb.findOne({
                    module_type: moduleType,
                    slug: slug,
                    _id : {$ne: moduleId}
                }, { projection: { slug: 1 } });

                if (result) {
                    return res.send({
                        status: Constants.STATUS_ERROR,
                        message: [{ param: 'slug', msg: res.__("admin.admin_module.Whoops_you have_entered_an_already_used_slug_please_try_something_different") }]
                    });
                }

                /** Save or update module details */
                const upsertResult = await this.collectionDb.updateOne({
					_id : moduleId
				},
				{
					$set : {
						title,
                        path,
                        group_path,
                        icon,
                        slug,
                        module_type: moduleType,
                        parent_id: parent ? new ObjectId(parent) : 0,
                        only_for_menu,
                        only_for_permission,
                        order: parseInt(order),
						modified : getUtcDate()
					},
					$setOnInsert : {
						is_active: Constants.ACTIVE,
						created  : getUtcDate()
					}
				},{upsert: true});

                if (upsertResult) {
                    /** Delete Modules list **/
                    myCache.del("admin_modules_list");

                    /** Send success response **/
                    let msg = isEditable &&  res.__("admin.admin_module.admin_modules_details_updated_successfully") || res.__("admin.admin_module.admin_module_has_been_added_successfully");
                    req.flash(Constants.STATUS_SUCCESS, msg);
                    return res.send({
                        status: Constants.STATUS_SUCCESS,
                        redirect_url: Constants.WEBSITE_ADMIN_URL + "admin_modules/" + moduleType,
                        message: msg
                    });
                }

                /** Send error response **/
                return res.send({
                    status: Constants.STATUS_ERROR,
                    message: [{ param: Constants.ADMIN_GLOBAL_ERROR, msg: res.__("admin.system.something_going_wrong_please_try_again") }]
                });
            }else{
                const asyncResponse = await new Promise((resolve, reject) => {
                    asyncParallel({
                        moduleList: (callback) => {
                            this.getAdminModulesList(req, res).then(response=>{
                                callback(null, response);
                            }).catch(callback);
                        },
                        moduleDetails: (callback) => {
                            if (!isEditable) return callback(null, {});

                            this.getAdminModuleDetails(req, res).then(response=>{
                                callback(null, response);
                            }).catch(callback);
                        }
                    }, (asyncErr, asyncRes) => {
                        if (asyncErr) reject(asyncErr);
                        resolve(asyncRes);
                    });
                });

                if(
                    asyncResponse.moduleList.status != Constants.STATUS_SUCCESS ||
                    (isEditable && asyncResponse.moduleDetails.status != Constants.STATUS_SUCCESS )
                ){
                    /** Send error response **/
                    let msg = asyncResponse?.moduleList?.message || asyncResponse?.moduleDetails?.message;
                    req.flash(Constants.STATUS_ERROR, msg);
                    return res.redirect(Constants.WEBSITE_ADMIN_URL + 'admin_modules/' + moduleType);
                }

                /** Render add page  **/
                req.breadcrumbs(BREADCRUMBS[`admin/admin_modules/${isEditable && 'edit' || 'add'}`]);
                res.render('addEdit', {
                    result      :   asyncResponse?.moduleDetails?.result || {},
                    moduleList  :   asyncResponse?.moduleList?.result || [],
                    moduleType  :   moduleType,
                    dynamic_url :   moduleType,
                    isEditable  :   isEditable
                });
            }
        } catch (error) { return next(error);}
    };

    /**
	 * Function to get Admin Module list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return json
	 */
	getAdminModuleDetails = async (req,res,next)=>{
        const moduleType = req?.params?.module_type || "";
        const moduleId = req.params.id && ObjectId.isValid(req.params.id) && new ObjectId(req.params.id) || "";

        /** Send error response if is missing or not mongo id */
        if(!moduleId){
            return {
                status	:   Constants.STATUS_ERROR,
                message	:   res.__("admin.system.invalid_access")
            };
        }

        /** get module details */
        const result = await this.collectionDb.findOne(
			{ _id: moduleId, module_type: moduleType},
			{
				projection: {
					_id: 1,
					title: 1,
					path: 1,
					order: 1,
					group_path: 1,
					icon: 1,
					slug: 1,
					is_active: 1,
					modified: 1,
					parent_id: 1,
					only_for_menu: 1,
					only_for_permission: 1
				}
			}
		);

        /** Send error response if is missing or not mongo id */
        if(!result){
            return {
                status	:   Constants.STATUS_ERROR,
                message	:   res.__("admin.system.invalid_access")
            };
        }

        return {status: Constants.STATUS_SUCCESS, result};
	};//End getAdminModuleDetails()

    deleteModule = async (req, res, next) => {
        const moduleType=   req?.params?.module_type || "";
        const moduleId  =   req.params.id && ObjectId.isValid(req.params.id) && new ObjectId(req.params.id) || "";
        let redirectURL =   `${Constants.WEBSITE_ADMIN_URL}admin_modules/${moduleType}`;

        if (!moduleId) {
            req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
            return res.redirect(redirectURL);
        }

        const result = await this.collectionDb.deleteMany({
            $or: [
                { _id: new ObjectId(moduleId) },
                { parent_id: new ObjectId(moduleId) }
            ]
        });

        if (result?.deletedCount > 0) {
            myCache.del("admin_modules_list");

            req.flash(Constants.STATUS_SUCCESS, res.__("admin.admin_module.admin_module_has_been_deleted_successfully"));
            return res.redirect(redirectURL);
        }

        /** Redirect listing page */
        req.flash(Constants.STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
        return res.redirect(redirectURL);
    };

    updateAdminModuleStatus = async (req, res, next) => {
        const moduleType=   req?.params?.module_type || "";
        const moduleId  =   req.params.id && ObjectId.isValid(req.params.id) && new ObjectId(req.params.id) || "";
        const status    =   req.params.status == Constants.ACTIVE ? Constants.DEACTIVE : Constants.ACTIVE;
        let redirectURL =   `${Constants.WEBSITE_ADMIN_URL}admin_modules/${moduleType}`;

        if (!moduleId) {
            req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
            return res.redirect(redirectURL);
        }

        /** Update module status */
        await this.collectionDb.updateMany(
            {
                $or: [
                    { _id: new ObjectId(moduleId) },
                    { parent_id: new ObjectId(moduleId) }
                ]
            },
            {
                $set: {
                    is_active: status,
                    modified: getUtcDate()
                }
            }
        );

        myCache.del("admin_modules_list");

        /** Redirect listing page */
        req.flash(Constants.STATUS_SUCCESS, res.__("admin.admin_module.admin_modules_status_updated_successfully"));
        return res.redirect(redirectURL);
    };

    changeOrderValue = async (req, res, next) => {
        /** Sanitize Data **/
        req.body        =   sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
        const moduleType=   req?.params?.module_type || "";
        const moduleId  =   req?.body.id && ObjectId.isValid(req?.body.id) && new ObjectId(req?.body.id) || "";
        const newOrder  =   req.body.new_order || "";

        if (!moduleId) {
            return res.send({
                status: Constants.STATUS_ERROR,
                message: res.__("admin.system.invalid_access")
            });
        }

        /** Update order */
        await this.collectionDb.updateOne(
            {
                _id: new ObjectId(moduleId),
                module_type : moduleType
            },
            {
                $set: {
                    order: parseInt(newOrder),
                    modified: getUtcDate()
                }
            }
        );

        myCache.del("admin_modules_list");

        return res.send({
            status: Constants.STATUS_SUCCESS,
            message: res.__("admin.admin_module.order_updated_successfully")
        });
    };

    /**
	 * Function to get Admin Module list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return json
	 */
	getAdminModulesList = async (req,res)=>{
        try{
    		let moduleType = req?.params?.module_type || "";

            /** Get admin modules details **/
            const result = await this.collectionDb
                .find(
                    { parent_id: 0, module_type: moduleType },
                    { projection: { _id: 1, title: 1 } }
                )
                .sort({ order: Constants.SORT_ASC })
                .toArray();

            /** Send error response */
            if(!result || !result.length){
                return {
                    status	: Constants.STATUS_ERROR,
                    result	: [],
                    message	: res.__("admin.system.something_going_wrong_please_try_again")
                };
            }

            /** Send success response **/
            return {
                status	: Constants.STATUS_SUCCESS,
                result	: result
            };
        }catch(e){
            /** Send error response */
            return {
                status	: Constants.STATUS_ERROR,
                result	: [],
                message	: res.__("admin.system.something_going_wrong_please_try_again")
            };
        }
	};//End getAdminModulesList()

    /**
     * Get admin modules listing with proper hierarchy
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Object} options - Additional options
     * @param {string} options.user_type - Type of user (admin/restaurant)
     * @param {boolean} [options.only_for_permission] - Filter by permission flag
     * @returns {Promise<Object>} Response object with module listing
     */
    getAdminModulesListing = async (req, res, options) => {
        try {
            const userType  = options?.user_type || "";
            const users     = this.db.collection(Tables.USERS);
            const userId    = req.session?.user?._id || "";

            // Get user details with role and module permissions
            const userResult = await users.findOne({
                _id: new ObjectId(userId),
                is_deleted: Constants.NOT_DELETED
            }, {
                projection: {
                    user_role_id: 1,
                    module_ids: 1
                }
            });

            if (!userResult) {
                return {
                    status: Constants.STATUS_SUCCESS,
                    result: []
                };
            }

            const userRoleId = userResult.user_role_id || "";
            const moduleLists = userResult.module_ids || [];
            const moduleIds = [];
            const subModules = {};

            // Process module lists and build submodules map
            moduleLists.forEach(moduleList => {
                const moduleId = moduleList._id ? String(moduleList._id) : "";
                moduleIds.push(moduleId);
                subModules[moduleId] = moduleList.sub_modules || [];
            });

            // Build query conditions
            const conditions = {
                is_active: Constants.ACTIVE,
                module_type: userType
            };

            if (typeof options.only_for_permission !== 'undefined') {
                conditions.only_for_permission = options.only_for_permission;
            }

            // Get admin modules with parent details
            const result = await this.collectionDb.aggregate([
                { $match: conditions },
                {
                    $lookup: {
                        from: this.collation,
                        localField: "parent_id",
                        foreignField: "_id",
                        as: "parent_detail"
                    }
                },
                {
                    $project: {
                        parent_order: {
                            $cond: {
                                if: { $eq: ["$parent_id", 0] },
                                then: '$order',
                                else: { $arrayElemAt: ["$parent_detail.order", 0] }
                            }
                        },
                        order: 1,
                        parent_id: 1,
                        title: 1,
                        path: 1,
                        group_path: 1,
                        icon: 1,
                        modules: 1,
                        slug: 1,
                        only_for_permission: 1
                    }
                },
                { $sort: { parent_order: 1, parent_id: 1, order: 1 } }
            ]).toArray();

            if (!result || result.length === 0) {
                return {
                    status: Constants.STATUS_SUCCESS,
                    result: []
                };
            }

            // Process modules and build hierarchy
            const moduleArray = {};
            await Promise.all(result.map(async (module) => {
                const moduleId = module._id || "";
                const parentId = module.parent_id || 0;

                // Check if user has access to this module
                const hasAccess = (userType === Constants.USER_TYPE_ADMIN && userRoleId === Constants.CRAVEZ) ||
                                (userType === Constants.USER_TYPE_RESTAURANT && userRoleId === Constants.RESTAURANT) ||
                                moduleIds.includes(String(moduleId));

                if (hasAccess) {
                    const detail = { ...module };
                    detail.sub_modules = subModules[moduleId] || [];

                    // Remove unnecessary fields
                    delete detail.order;
                    delete detail.parent_order;
                    delete detail.parent_id;

                    if (parentId === 0) {
                        const childs = moduleArray[moduleId]?.childs || [];
                        detail.childs = childs;
                        moduleArray[moduleId] = detail;
                    } else {
                        if (!moduleArray[parentId]) {
                            moduleArray[parentId] = {};
                        }
                        if (!moduleArray[parentId].childs) {
                            moduleArray[parentId].childs = [];
                        }
                        moduleArray[parentId].childs.push(detail);
                    }
                }
            }));

            return {
                status: Constants.STATUS_SUCCESS,
                result: Object.values(moduleArray)
            };

        } catch (error) {
            console.error('Get admin modules listing error:', error);
            return {
                status: Constants.STATUS_ERROR,
                result: [],
                message: res.__("admin.system.something_going_wrong_please_try_again")
            };
        }
    };

    formatModuleIdsArray = async (req, res, options = {}) => {
        const modules   =   req.body.module_ids || {};
        const userType  =   options.user_type || "";

        if(!modules || Object.keys(modules).length === 0) {
            return [];
        }

        const selectedModuleObjectIds = Object.keys(modules).map(id => new ObjectId(id));
        try {
            const result = await this.collectionDb.aggregate([
                { $match: { _id: { $in: selectedModuleObjectIds }, module_type: userType } },
                {
                    $lookup: {
                        from: this.collation,
                        let: { id: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ["$parent_id", "$$id"] }
                                }
                            },
                            { $project: { group_path: 1, slug: 1, parent_id: 1, only_for_menu: 1 } }
                        ],
                        as: "child_detail"
                    }
                },
                {
                    $project: {
                        _id: 1,
                        group_path: 1,
                        parent_id: 1,
                        slug: 1,
                        childs: { $size: "$child_detail" },
                        child_detail: 1
                    }
                }
            ]).toArray();

            if (!result || result.length === 0) return [];

            let slugWisePermission = {};

            result.forEach(record => {
                const slug = record.slug;
                const moduleId = record._id;
                const childIds = modules[moduleId]?.childs ? Object.keys(modules[moduleId].childs) : [];

                if (!slugWisePermission[slug] || slugWisePermission[slug].length === 0) {
                    slugWisePermission[slug] = childIds;
                }
            });

            // Add children with `only_for_menu` = true as standalone records
            const expandedResult = [...result];
            for (const record of result) {
                for (const child of record.child_detail || []) {
                    if (child.only_for_menu) {
                        const tmpChild = clone(child);
                        tmpChild.childs = 0;
                        expandedResult.push(tmpChild);
                    }
                }
                delete record.child_detail;
            }

            let finalResult = [];

            for (const record of expandedResult) {
                let isValid = true;

                if (modules[record._id]?.childs) {
                    record.sub_modules = Object.keys(modules[record._id].childs);
                } else {
                    const parentId = record.parent_id;
                    const subModuleArray = modules[parentId]?.childs
                        ? Object.keys(modules[parentId].childs)
                        : slugWisePermission[record.slug] || [];

                    if (record.only_for_menu) {
                        if (subModuleArray.length > 0) {
                            record.sub_modules = subModuleArray;
                        } else {
                            isValid = false;
                        }
                    } else {
                        record.sub_modules = subModuleArray;
                    }
                }

                if (isValid) {
                    delete record.only_for_menu;
                    finalResult.push(record);
                }
            }

            return finalResult;

        } catch (error) {
            console.error("Error in formatModuleIdsArray:", error);
            return [];
        }
    };

    getAdminModulesTree = async (req, res, options = {}) => {
        const userType = options.user_type || "";

        const conditions = {
            is_active: Constants.ACTIVE,
            module_type: userType,
        };

        if (typeof options.only_for_menu !== 'undefined') {
            conditions.only_for_menu = options.only_for_menu;
        }

        try {
            const modules = await this.collectionDb.aggregate([
                { $match: conditions },
                {
                    $lookup: {
                        from: this.collation,
                        localField: 'parent_id',
                        foreignField: '_id',
                        as: 'parent_detail',
                    },
                },
                {
                    $addFields: {
                        parent_order: {
                            $cond: {
                                if: { $eq: ['$parent_id', 0] },
                                then: '$order',
                                else: { $arrayElemAt: ['$parent_detail.order', 0] },
                            },
                        },
                    },
                },
                { $project: { parent_detail: 0 } },
                { $sort: { parent_order: Constants.SORT_ASC, parent_id: Constants.SORT_ASC, order: Constants.SORT_ASC } },
            ]).toArray();

            if (!modules || modules.length === 0) {
                return {
                    status: Constants.STATUS_SUCCESS,
                    result: [],
                };
            }

            const moduleArray = {};

            for (const module of modules) {
                const moduleId = module._id?.toString() || "";
                const parentId = module.parent_id?.toString() || "0";

                const detail = clone(module);
                detail.id = moduleId;
                detail.parent_id = parentId;
                detail.name = module.title?.toString() || "";

                if (parentId === "0") {
                    detail.childs = moduleArray[moduleId]?.childs || [];
                    moduleArray[moduleId] = detail;
                } else {
                    if (!moduleArray[parentId]) {
                        moduleArray[parentId] = { childs: [] };
                    }
                    if (!moduleArray[parentId].childs) {
                        moduleArray[parentId].childs = [];
                    }
                    moduleArray[parentId].childs.push(detail);
                }
            }

            return {
                status: Constants.STATUS_SUCCESS,
                result: Object.values(moduleArray),
            };

        } catch (error) {
            console.error("getAdminModulesTree error:", error);
            return {
                status: Constants.STATUS_ERROR,
                result: [],
                message: res.__("admin.system.something_going_wrong_please_try_again"),
            };
        }
    };
}
export default AdminModule;