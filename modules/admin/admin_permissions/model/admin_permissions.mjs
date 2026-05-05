import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import { isPost, sanitizeData, getUtcDate, configDatatable, generateMD5Hash, arrayToObject, getDropdownList, getUniqueId, getDatabaseSlug, userModuleFlagAction } from "../../../../utils/index.mjs";
import { saveSystemLogs, sendMailToUsers} from "../../../../services/index.mjs";
import Tables from '../../../../config/database_tables.mjs';
import AdminModule from '../../admin_modules/model/admin_module.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

/**
 * AdminPermission class for handling admin permissions
 */
class AdminPermission {
    /**
     * Creates an instance of AdminPermission
     * @param {Object} db - Database connection instance
     */
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.USERS);
        this.adminModule = new AdminModule(db);
    }

    /**
     * Function to get admin permission list
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>}
     */
    async list(req, res, next) {
        const authId = req.session.user._id ? new ObjectId(req.session.user._id) : "";
        const isTeamHead = req.session.user.team_head || false;
        const parentId = req.session.user.parent_id ? new ObjectId(req.session.user.parent_id) : "";
        const authRoleId = req.session.user.user_role_id || "";

        if (isPost(req)) {
            try {
                const limit = parseInt(req.body.length || Constants.ADMIN_LISTING_LIMIT);
                const skip = parseInt(req.body.start || Constants.DEFAULT_SKIP);
                const teamLeaderId = req.body.teamLeader || "";
                const filterStatus = req.body.filterStatus || "";

                // Configure Datatable conditions
                const dataTableConfig = await configDatatable(req, res, null);

                // Set common conditions
                const commonConditions = {
                    user_type: Constants.USER_TYPE_ADMIN,
                    is_deleted: Constants.NOT_DELETED,
                    not_shown: { $exists: false },
                    _id: { $ne: authId }
                };

                // Add team member conditions
                if (isTeamHead) commonConditions.parent_id = authId;
                if (!isTeamHead && authRoleId !== Constants.CRAVEZ) commonConditions.parent_id = parentId;

                if (teamLeaderId) {
                    dataTableConfig.conditions.$and = [{ parent_id: new ObjectId(teamLeaderId) }];
                }

                if (filterStatus){
                    dataTableConfig.conditions.active = JSON.parse(filterStatus);
                }

                dataTableConfig.conditions = { ...commonConditions, ...dataTableConfig.conditions };

                // Get list and count of admin permissions
                let dbRes = await this.collectionDb.aggregate([
                    {$match: dataTableConfig.conditions },
                    {$facet: {
                        list : [
                            {$addFields: {
                                original_email: "$email",
                                original_name: "$full_name",
                                email: { $toLower: "$email" },
                                full_name: { $toLower: "$full_name" }
                            }},
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit },
                            {$lookup: {
                                from: Tables.ADMIN_ROLES,
                                localField: "user_role_id",
                                foreignField: "role_id",
                                as: "role_detail"
                            }},
                            {$project: {
                                _id: 1, team_head: 1, modified: 1, agent_id: 1, user_role_id: 1, active: 1, code: 1,
                                full_name: "$original_name", email: "$original_email",
                                role_name: { $arrayElemAt: ["$role_detail.role_name", 0] },
                            }},
                        ],
                        count: [
                            {$count: "count"},
                        ],
                    }}
                ]).toArray();

                /** Send response **/
                res.send({
                    status			: 	Constants.STATUS_SUCCESS,
                    draw			: 	dataTableConfig.result_draw,
                    data	        :	dbRes?.[0]?.list || [],
                    recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
                });
            } catch (error) {
                return next(error);
            }
        } else {
            try {
                // Select default team if team leader is logged in
                const selected = [];
                if (isTeamHead) selected.push(authId);
                if (!isTeamHead && authRoleId !== Constants.CRAVEZ) selected.push(parentId);

                // Set conditions for dropdown
                const conditions = { ...Constants.ADMIN_USER_COMMON_CONDITIONS };
                conditions.team_head = true;
                if (isTeamHead) conditions._id = authId;
                if (!isTeamHead && authRoleId !== Constants.CRAVEZ) conditions._id = parentId;

                // Get dropdown list
                const response = await getDropdownList(req, res, next, {
                    collections: [{
                        collection: "users",
                        columns: ["_id", "full_name"],
                        selected,
                        conditions
                    }]
                });

                if (response.status !== Constants.STATUS_SUCCESS) {
                    req.flash(Constants.STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
                    return res.redirect(Constants.WEBSITE_ADMIN_URL);
                }

                const usersList = response.final_html_data[0] || "";
                const queryStatus = req.query.status || "";

                // Render listing page
                req.breadcrumbs(BREADCRUMBS['admin/admin_permissions/list']);
                res.render('list', { result: usersList, query_status: queryStatus });

            } catch (error) {
                return next(error);
            }
        }
    }

    /**
     * Add new admin permission
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>}
     */
    async add(req, res, next) {
        const authRoleId = req.session.user.user_role_id || "";
        const isTeamHead = req.session.user.team_head || false;
        const parentId = req.session.user.parent_id || "";

        if (isPost(req)) {
            try {
                // Sanitize data
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                const {
                    password = "",
                    user_role = "",
                    ticket_category = "",
                    code = "",
                    email = ""
                } = req.body;

                const ticketCategoryCondition = Constants.TICKET_CATEGORY_ALLOWED_ROLES.includes(user_role);
                const authId = req.session.user._id || "";

                // Check email domain validation
                if (email && authRoleId !== Constants.CRAVEZ && Constants.EMAIL_REGULAR_EXPRESSION.test(email)) {
                    const allowDomains = (res.locals.settings["Site.allow_email_domains"] || "").split(",");
                    const isValidDomain = allowDomains.length === 0 || allowDomains.some(domain =>
                        new RegExp(domain, "i").test(email)
                    );

                    if (!isValidDomain) {
                        return res.send({
                            status: Constants.STATUS_ERROR,
                            message: [{ param: 'email', msg: res.__("admin.admin_permissions.invalid_domain") }]
                        });
                    }
                }

                // Check for existing email/code
                const userConditions = {
                    is_deleted: Constants.NOT_DELETED,
                    $or: [{ email: { $regex: `^${email}$`, $options: "i" } }]
                };

                if (code) userConditions.$or.push({ code });

                const existingUser = await this.collectionDb.findOne(userConditions, {
                    projection: { _id: 1, email: 1, code: 1 }
                });

                if (existingUser) {
                    if (existingUser.email.toLowerCase() === email.toLowerCase()) {
                        return res.send({
                            status: Constants.STATUS_ERROR,
                            message: [{ param: 'email', msg: res.__("admin.admin_permissions.your_email_id_is_already_exist") }]
                        });
                    }

                    if (code && existingUser.code === code) {
                        return res.send({
                            status: Constants.STATUS_ERROR,
                            message: [{ param: 'code', msg: res.__("admin.admin_permissions.code_is_already_exist") }]
                        });
                    }
                }

                // Prepare user data
                const firstName = req.body.first_name || "";
                const lastName = req.body.last_name || "";
                const fullName = `${firstName} ${lastName}`;
                const teamHead = req.body.team_head === "true";

                // Get unique ID and slug
                const [uniqueIdResponse, slugResponse, moduleArray] = await Promise.all([
                    getUniqueId(req, res, next, { type: "agent_id" }),
                    getDatabaseSlug({ title: fullName, table_name: "users", slug_field: "slug" }),
                    this.adminModule.formatModuleIdsArray(req, res, { user_type: Constants.USER_TYPE_ADMIN })
                ]);

                // Create user data
                const userData = {
                    user_role_id: String(user_role),
                    first_name: firstName,
                    last_name: lastName,
                    full_name: fullName,
                    slug: slugResponse?.title || "",
                    email,
                    username: email,
                    agent_id: uniqueIdResponse?.result || "",
                    team_head: teamHead,
                    password: generateMD5Hash(password),
                    module_ids: moduleArray,
                    code,
                    user_type: Constants.USER_TYPE_ADMIN,
                    active: Constants.ACTIVE,
                    is_verified: Constants.VERIFIED,
                    is_deleted: Constants.NOT_DELETED,
                    created: getUtcDate(),
                    modified: getUtcDate()
                };

                if (authRoleId !== Constants.CRAVEZ && (isTeamHead || parentId)) {
                    userData.parent_id = isTeamHead ? new ObjectId(authId) : new ObjectId(parentId);
                }

                if (ticketCategoryCondition && ticket_category) {
                    userData.ticket_category_ids = arrayToObject(
                        Array.isArray(ticket_category) ? ticket_category : [ticket_category]
                    );
                }

                // Insert user
                const result = await this.collectionDb.insertOne(userData);

                if (result.insertedId) {
                    // Save system logs
                    saveSystemLogs(req, res, {
                        user_id: req.session.user._id,
                        parent_id: result.insertedId,
                        activity_module: Constants.SYSTEM_LOG_MODULE_TEAM_MANAGEMENT,
                        activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                        additional_details: {}
                    });

                    // Send welcome email
                    sendMailToUsers(req, res, {
                        event_type: Constants.NOTIFICATION_ADMIN_USER_REGISTER,
                        fullname: fullName,
                        email,
                        password
                    });

                    req.flash(Constants.STATUS_SUCCESS, res.__("admin.admin_permissions.admin_permissions_has_been_added_successfully"));
                    return res.send({
                        status: Constants.STATUS_SUCCESS,
                        redirect_url: `${Constants.WEBSITE_ADMIN_URL}admin_permissions`,
                        message: res.__("admin.admin_permissions.admin_permissions_has_been_added_successfully")
                    });
                }

                return res.send({
                    status: Constants.STATUS_ERROR,
                    message: [{ param: Constants.ADMIN_GLOBAL_ERROR, msg: res.__("admin.system.something_going_wrong_please_try_again") }]
                });
            } catch (error) {
                return next(error);
            }
        } else {
            try {
                const [adminRoleList, ticketCategoryList, moduleTree] = await Promise.all([
                    this.getAdminRoleList(req, res),
                    getDropdownList(req, res, next, {
                        collections: [{
                            collection: Tables.CATEGORIES,
                            columns: ["_id", "category_name"],
                            conditions: { parent_category_id: 0 }
                        }]
                    }),
                    this.adminModule.getAdminModulesTree(req, res, { user_type: Constants.USER_TYPE_ADMIN, only_for_menu: false })
                ]);

                if (adminRoleList.status !== Constants.STATUS_SUCCESS) {
                    req.flash(Constants.STATUS_ERROR, adminRoleList.message);
                    return res.redirect(`${Constants.WEBSITE_ADMIN_URL}admin_permissions`);
                }

                req.breadcrumbs(BREADCRUMBS['admin/admin_permissions/add']);
                res.render('add', {
                    adminRoles: adminRoleList.result,
                    admin_modules: moduleTree.result,
                    ticket_category_list: ticketCategoryList.final_html_data[0]
                });

            } catch (error) {
                return next(error);
            }
        }
    }

    /**
     * Edit admin permission
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>}
     */
    async edit(req, res, next) {
        const authRoleId = req.session.user.user_role_id || "";
        const id = req.params.id || "";

        if (!id) {
            req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
            return res.redirect(`${Constants.WEBSITE_ADMIN_URL}admin_permissions`);
        }

        if (isPost(req)) {
            try {
                // Sanitize data
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                const {
                    user_role = "",
                    password = "",
                    ticket_category = "",
                    code = "",
                    email = ""
                } = req.body;

                const ticketCategoryCondition = Constants.TICKET_CATEGORY_ALLOWED_ROLES.includes(user_role);

                // Check email domain validation
                if (email && authRoleId !== Constants.CRAVEZ && Constants.EMAIL_REGULAR_EXPRESSION.test(email)) {
                    const allowDomains = (res.locals.settings["Site.allow_email_domains"] || "").split(",");
                    const isValidDomain = allowDomains.length === 0 || allowDomains.some(domain =>
                        new RegExp(domain, "i").test(email)
                    );

                    if (!isValidDomain) {
                        return res.send({
                            status: Constants.STATUS_ERROR,
                            message: [{ param: 'email', msg: res.__("admin.admin_permissions.invalid_domain") }]
                        });
                    }
                }

                // Check for existing email/code
                const userConditions = {
                    _id: { $ne: new ObjectId(id) },
                    is_deleted: Constants.NOT_DELETED,
                    $or: [{ email: { $regex: `^${email}$`, $options: "i" } }]
                };

                if (code) userConditions.$or.push({ code });

                const existingUser = await this.collectionDb.findOne(userConditions, {
                    projection: { _id: 1, email: 1, code: 1 }
                });

                if (existingUser) {
                    if (existingUser.email.toLowerCase() === email.toLowerCase()) {
                        return res.send({
                            status: Constants.STATUS_ERROR,
                            message: [{ param: 'email', msg: res.__("admin.admin_permissions.your_email_id_is_already_exist") }]
                        });
                    }

                    if (code && existingUser.code === code) {
                        return res.send({
                            status: Constants.STATUS_ERROR,
                            message: [{ param: 'code', msg: res.__("admin.admin_permissions.code_is_already_exist") }]
                        });
                    }
                }

                // Get module array
                const moduleArray = await this.adminModule.formatModuleIdsArray(req, res, { user_type: Constants.USER_TYPE_ADMIN });

                // Prepare update data
                const firstName = req.body.first_name || "";
                const lastName = req.body.last_name || "";
                const fullName = `${firstName} ${lastName}`;
                const teamHead = req.body.team_head === "true";

                const updateData = {
                    $set: {
                        user_role_id: String(user_role),
                        first_name: firstName,
                        last_name: lastName,
                        full_name: fullName,
                        email,
                        code,
                        team_head: teamHead,
                        module_ids: moduleArray,
                        modified: getUtcDate()
                    }
                };

                if (ticketCategoryCondition && ticket_category) {
                    updateData.$set.ticket_category_ids = arrayToObject(
                        Array.isArray(ticket_category) ? ticket_category : [ticket_category]
                    );
                } else {
                    updateData.$unset = { ticket_category_ids: 1 };
                }

                if (password) {
                    updateData.$set.password = generateMD5Hash(password);
                }

                // Update user
                const result = await this.collectionDb.updateOne(
                    { _id: new ObjectId(id) },
                    updateData
                );

                if (result.modifiedCount > 0) {
                    // Delete user modules list flag
                    userModuleFlagAction(id, "", "delete");

                    // Save system logs
                    saveSystemLogs(req, res, {
                        user_id: req.session.user._id,
                        parent_id: id,
                        activity_module: Constants.SYSTEM_LOG_MODULE_TEAM_MANAGEMENT,
                        activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                        additional_details: {}
                    });

                    req.flash(Constants.STATUS_SUCCESS, res.__("admin.admin_permissions.admin_permissions_updated_successfully"));
                    return res.send({
                        status: Constants.STATUS_SUCCESS,
                        redirect_url: `${Constants.WEBSITE_ADMIN_URL}admin_permissions`,
                        message: res.__("admin.admin_permissions.admin_permissions_updated_successfully")
                    });
                }

                return res.send({
                    status: Constants.STATUS_ERROR,
                    message: [{ param: Constants.ADMIN_GLOBAL_ERROR, msg: res.__("admin.system.something_going_wrong_please_try_again") }]
                });

            } catch (error) {
                return next(error);
            }
        } else {
            try {
                const [adminPermissionDetails, adminRoleList, moduleTree] = await Promise.all([
                    this.getAdminPermissionDetails(req, res, next),
                    this.getAdminRoleList(req, res, next),
                    this.adminModule.getAdminModulesTree(req, res, { user_type: Constants.USER_TYPE_ADMIN, only_for_menu: false })
                ]);

                if (adminPermissionDetails.status !== Constants.STATUS_SUCCESS ||
                    adminRoleList.status !== Constants.STATUS_SUCCESS) {
                    req.flash(Constants.STATUS_ERROR, adminPermissionDetails.message || adminRoleList.message);
                    return res.redirect(`${Constants.WEBSITE_ADMIN_URL}admin_permissions`);
                }

                const ticketCategoryIds = adminPermissionDetails.result.ticket_category_ids || [];
                const ticketCategoryList = await getDropdownList(req, res, next, {
                    collections: [{
                        collection: Tables.CATEGORIES,
                        columns: ["_id", "category_name"],
                        conditions: { parent_category_id: 0 },
                        selected: ticketCategoryIds
                    }]
                });

                if (ticketCategoryList.status !== Constants.STATUS_SUCCESS) {
                    req.flash(Constants.STATUS_ERROR, ticketCategoryList.message);
                    return res.redirect(`${Constants.WEBSITE_ADMIN_URL}admin_permissions`);
                }

                req.breadcrumbs(BREADCRUMBS['admin/admin_permissions/edit']);
                res.render('edit', {
                    result: adminPermissionDetails.result,
                    adminRoles: adminRoleList.result,
                    admin_modules: moduleTree.result,
                    ticket_category_list: ticketCategoryList.final_html_data[0]
                });
            } catch (error) {
                return next(error);
            }
        }
    }

    /**
     * Get admin role list
     *
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     * @returns {Promise<Object>} Promise resolving to admin role list data
     */
    async getAdminRoleList(req, res) {
        try {
            const conditions = {
                is_shown: Constants.SHOWN,
                user_type: Constants.USER_TYPE_ADMIN
            };

            // Condition check for team head role
            if (req?.body?.user_role_id) {
                conditions.role_id = req.body.user_role_id;
            }

            // Get admin role details
            const admin_roles = this.db.collection(Tables.ADMIN_ROLES);
            const result = await admin_roles
                .find(conditions, { projection: { _id: 1, role_name: 1 } })
                .sort({ "role_name": Constants.SORT_ASC })
                .toArray();

            if (result) {
                return {
                    status: Constants.STATUS_SUCCESS,
                    result: result
                };
            }

            return {
                status: Constants.STATUS_ERROR,
                message: res.__("admin.system.something_going_wrong_please_try_again")
            };

        } catch (error) {
            console.error("Error in getAdminRoleList:", error);
            return {
                status: Constants.STATUS_ERROR,
                message: res.__("admin.system.something_going_wrong_please_try_again")
            };
        }
    }

    /**
     * Delete admin permission
     *
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     * @returns {Promise<void>}
     */
    async delete(req, res) {
        const id = req?.params?.id && ObjectId.isValid(req?.params?.id) ? new ObjectId(req?.params?.id) : "";

        if (!id) {
            req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
            return res.redirect(Constants.WEBSITE_ADMIN_URL + "admin_permissions");
        }

        try {
            const users = this.db.collection(Tables.USERS);
            const result = await users.updateOne(
                {
                    _id: id,
                    user_type: Constants.USER_TYPE_ADMIN
                },
                {
                    $set: {
                        is_deleted: Constants.DELETED,
                        deleted_at: getUtcDate(),
                        modified: getUtcDate()
                    }
                }
            );

            if (result.modifiedCount > 0) {
                // Save system logs
                saveSystemLogs(req, res, {
                    user_id: req.session.user._id,
                    parent_id: id,
                    activity_module: Constants.SYSTEM_LOG_MODULE_TEAM_MANAGEMENT,
                    activity_type: Constants.ACTIVITY_TYPE_DELETE,
                    additional_details: {}
                });

                // Delete user modules list flag
                await userModuleFlagAction(id, "", "delete");

                req.flash(Constants.STATUS_SUCCESS, res.__("admin.admin_permissions.admin_permissions_deleted_successfully"));
            } else {
                req.flash(Constants.STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
            }
        } catch (error) {
            console.error("Error in delete:", error);
            req.flash(Constants.STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
        }

        res.redirect(Constants.WEBSITE_ADMIN_URL + "admin_permissions");
    }

    /**
     * Get admin permission details
     *
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     * @returns {Promise<Object>} Promise resolving to admin permission details
     */
    async getAdminPermissionDetails(req, res) {
        const id = req?.params?.id && ObjectId.isValid(req?.params?.id) ? new ObjectId(req?.params?.id) : "";

        if (!id) {
            return {
                status: Constants.STATUS_ERROR,
                message: res.__("admin.system.invalid_access")
            };
        }

        try {
            const users = this.db.collection(Tables.USERS);
            const result = await users.aggregate([
                {
                    $match: {
                        _id: id,
                        user_type: Constants.USER_TYPE_ADMIN,
                        is_deleted: Constants.NOT_DELETED
                    }
                },
                {
                    $lookup: {
                        from: Tables.ADMIN_ROLES,
                        localField: "user_role_id",
                        foreignField: "role_id",
                        as: "role_detail"
                    }
                },
                {
                    $project: {
                        _id: 1,
                        first_name: 1,
                        last_name: 1,
                        full_name: 1,
                        email: 1,
                        agent_id: 1,
                        team_head: 1,
                        modified: 1,
                        active: 1,
                        user_role_id: 1,
                        role_id: 1,
                        module_ids: 1,
                        parent_id: 1,
                        role_name: { $arrayElemAt: ["$role_detail.role_name", 0] },
                        ticket_category_ids: 1,
                        code: 1
                    }
                }
            ]).toArray();

            if (result && result[0]) {
                return {
                    status: Constants.STATUS_SUCCESS,
                    result: result[0]
                };
            }

            return {
                status: Constants.STATUS_ERROR,
                message: res.__("admin.system.invalid_access")
            };

        } catch (error) {
            console.error("Error in getAdminPermissionDetails:", error);
            return {
                status: Constants.STATUS_ERROR,
                message: res.__("admin.system.something_going_wrong_please_try_again")
            };
        }
    }

    /**
     * Function for view Admin Permission Details
     *
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     * @returns {Promise<void>}
     */
    async viewDetials(req, res) {
        try {
            const response = await this.getAdminPermissionDetails(req, res);

            if (response.status === Constants.STATUS_SUCCESS) {
                //req.breadcrumbs(BREADCRUMBS['admin/admin_permissions/view']);
                return res.render('view', {
                    result: response.result
                });
            }

            req.flash(Constants.STATUS_ERROR, response.message);
            return res.redirect(Constants.WEBSITE_ADMIN_URL + "admin_permissions");
        } catch (error) {
            console.error("Error in viewDetials:", error);
            req.flash(Constants.STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
            return res.redirect(Constants.WEBSITE_ADMIN_URL + "admin_permissions");
        }
    }

    /**
     * Function for view modules of selected role
     *
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     * @returns {Promise<void>}
     */
    async getAdminRoleModulesData(req, res) {
        const roleId = req?.body?.id && ObjectId.isValid(req?.body?.id) ? new ObjectId(req?.body?.id) : "";

        if (!roleId) {
            return res.send({
                status: Constants.STATUS_ERROR,
                message: res.__("admin.system.invalid_access")
            });
        }

        try {
            const dbInstance = this.db;
            const admin_roles = dbInstance.collection(Tables.ADMIN_ROLES);
            const result = await admin_roles.findOne(
                {
                    _id: roleId,
                    user_type: Constants.USER_TYPE_ADMIN
                },
                {
                    projection: {
                        _id: 1,
                        role_name: 1,
                        module_ids: 1
                    }
                }
            );

            if (result) {
                return res.send({
                    status: Constants.STATUS_SUCCESS,
                    result: result
                });
            }

            return res.send({
                status: Constants.STATUS_ERROR,
                message: res.__("admin.system.something_going_wrong_please_try_again")
            });
        } catch (error) {
            console.error("Error in getAdminRoleModulesData:", error);
            return res.send({
                status: Constants.STATUS_ERROR,
                message: res.__("admin.system.something_going_wrong_please_try_again")
            });
        }
    }

    /**
     * Function for update active/deactive status
     *
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     * @returns {Promise<void>}
     */
    async updateStatus(req, res) {
        const userId = req?.params?.id && ObjectId.isValid(req?.params?.id) ? new ObjectId(req?.params?.id) : "";
        const status = req?.params?.status == Constants.ACTIVE ? Constants.DEACTIVE : Constants.ACTIVE;

        if (!userId) {
            req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
            return res.redirect(Constants.WEBSITE_ADMIN_URL + 'admin_permissions');
        }

        try {
            const users = this.db.collection(Tables.USERS);
            const result = await users.updateOne(
                {
                    _id: userId,
                    user_type: Constants.USER_TYPE_ADMIN,
                },
                {
                    $set: {
                        active: status,
                        modified: getUtcDate()
                    }
                }
            );

            if (result.modifiedCount > 0) {
                // Save system logs
                saveSystemLogs(req, res, {
                    user_id: req.session.user._id,
                    parent_id: userId,
                    activity_module: Constants.SYSTEM_LOG_MODULE_TEAM_MANAGEMENT,
                    activity_type: Constants.ACTIVITY_TYPE_STATUS_UPDATE,
                    additional_details: {}
                });

                req.flash(Constants.STATUS_SUCCESS, res.__("admin.admin_permissions.status_updated_successfully"));
            } else {
                req.flash(Constants.STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
            }
        } catch (error) {
            console.error("Error in updateStatus:", error);
            req.flash(Constants.STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
        }

        return res.redirect(Constants.WEBSITE_ADMIN_URL + 'admin_permissions');
    }

    /**
     * Function to send new login credentials to user
     *
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     * @returns {Promise<void>}
     */
    async sendLoginCredentials(req, res) {
        const userId = req?.params?.id && ObjectId.isValid(req?.params?.id) ? new ObjectId(req?.params?.id) : "";

        if (!userId) {
            req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
            return res.redirect(Constants.WEBSITE_ADMIN_URL + "admin_permissions");
        }

        try {
            const response = await this.getAdminPermissionShortDetails(req, res);
            if (response.status !== Constants.STATUS_SUCCESS) {
                req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
                return res.redirect(Constants.WEBSITE_ADMIN_URL + "admin_permissions");
            }

            const userResult = response.result;
            const randomResponse = await getRandomString(req, res, null);
            if (randomResponse.status !== Constants.STATUS_SUCCESS) {
                req.flash(Constants.STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
                return res.redirect(Constants.WEBSITE_ADMIN_URL + "admin_permissions");
            }

            const password = randomResponse.result || "";
            const newPassword = generateMD5Hash(password);

            const dbInstance = this.db;
            const users = dbInstance.collection(Tables.USERS);
            const result = await users.updateOne(
                {
                    _id: userId,
                    user_type: Constants.USER_TYPE_ADMIN
                },
                {
                    $set: {
                        password: newPassword,
                        modified: getUtcDate()
                    }
                }
            );

            if (result.modifiedCount > 0) {
                req.flash(Constants.STATUS_SUCCESS, res.__("admin.admin_permissions.login_credentials_send_successfully"));

                const userEmail = userResult.email || "";
                const userName = userResult.full_name || "";

                // Send mail
                await sendMailToUsers(req, res, {
                    event_type: Constants.NOTIFICATION_SEND_LOGIN_CREDENTIALS,
                    fullname: userName,
                    email: userEmail,
                    password: password,
                });
            } else {
                req.flash(Constants.STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
            }
        } catch (error) {
            console.error("Error in sendLoginCredentials:", error);
            req.flash(Constants.STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
        }

        return res.redirect(Constants.WEBSITE_ADMIN_URL + "admin_permissions");
    }

    /**
	 * Function for get Admin Permission Short Details
	 *
	 * @param req	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return json
	 */
	getAdminPermissionShortDetails(req, res){
        let id = req.params.id || "";

        if (!id) {
            return {
                status: STATUS_ERROR,
                message: res.__("admin.system.invalid_access")
            };
        }

        try {
            const users = this.db.collection(Tables.USERS);
            users.findOne({
                _id: ObjectId(id),
                user_type: USER_TYPE_ADMIN,
                is_deleted: NOT_DELETED
            }, {
                projection: {
                    email: 1,
                    full_name: 1,
                    user_role_id: 1
                }
            }, (err, result) => {
                if (err || !result) {
                    return resolve({
                        status: STATUS_ERROR,
                        message: res.__("admin.system.invalid_access")
                    });
                }

                return resolve({
                    status: STATUS_SUCCESS,
                    result
                });
            });
        } catch (e) {
            console.log("Error at getAdminPermissionShortDetails ", e);
            return {
                status: STATUS_ERROR,
                message: res.__("admin.system.something_going_wrong_please_try_again")
            };
        }
    };

	/**
	 * Function for get role users list
	 *
	 * @param {Object} req - Request object
	 * @param {Object} res - Response object
	 * @returns {Promise<void>}
	 */
	async getRoleUsersList(req, res){
		const roleId = req?.body?.id && ObjectId.isValid(req?.body?.id) ? new ObjectId(req?.body?.id) : "";

		if (!roleId) {
			return res.send({
				status: Constants.STATUS_ERROR,
				message: res.__("admin.system.invalid_access")
			});
		}

		try {
			const users = this.db.collection(Tables.USERS);
			const result = await users.find(
				{
					user_role_id: roleId,
					user_type: Constants.USER_TYPE_ADMIN,
					is_deleted: Constants.NOT_DELETED
				},
				{
					projection: {
						_id: 1,
						first_name: 1,
						last_name: 1,
						full_name: 1,
						email: 1,
						agent_id: 1,
						team_head: 1,
						modified: 1,
						active: 1,
						user_role_id: 1,
						role_id: 1,
						module_ids: 1,
						parent_id: 1,
						ticket_category_ids: 1,
						code: 1
					}
				}
			).toArray();

			return res.send({
				status: Constants.STATUS_SUCCESS,
				result: result
			});
		} catch (error) {
			console.error("Error in getRoleUsersList:", error);
			return res.send({
				status: Constants.STATUS_ERROR,
				message: res.__("admin.system.something_going_wrong_please_try_again")
			});
		}
	}

	/**
	 * Function for get role users and update
	 *
	 * @param {Object} req - Request object
	 * @param {Object} res - Response object
	 * @returns {Promise<void>}
	 */
	async getRoleUsersAndUpdate(req, res,next) {
		const teamHeadStatus = req.params.team_head_status ? parseInt(req.params.team_head_status) : "";
		const roleId = req.params.user_role_id || "";
		const userId = req.params.user_id ? new ObjectId(req.params.user_id) : "";
		const isAssign = teamHeadStatus === 1;

        if (isPost(req)) {
			try {
				// Sanitize Data
				req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
				const shiftUser = req.body.shift_user ? new ObjectId(req.body.shift_user) : "";
				let assignUsers = req.body.assign_users || "";

				// Send error response
				if (!userId) {
					return res.send({
						status: Constants.STATUS_ERROR,
						message: res.__("admin.system.invalid_access")
					});
				}

				// Check assign users data in array format or not
				if (assignUsers.constructor !== Array) {
					assignUsers = [assignUsers];
				}

				// Convert user id to object id for updation
				const assignUsersObjectId = isAssign ? assignUsers.map(elem => new ObjectId(elem)) : [];

				const updateData = {
					parent_id: isAssign ? userId : shiftUser
				};

				const updateConditions = {
					_id: {
						$in: isAssign ? assignUsersObjectId : [userId]
					}
				};

				// Assign or shift user
				const users = this.db.collection(Tables.USERS);

				// Get member IDs if assigning
				let memberIds = [];
				if (isAssign) {
					const memberIdsResult = await users.distinct("_id", { parent_id: userId });
					if (memberIdsResult && memberIdsResult.length > 0) {
						memberIds = memberIdsResult
							.filter(member => !assignUsers.includes(String(member)))
							.map(member => new ObjectId(member));
					}
				}

				// Remove parent id for unassigned members
				if (isAssign && assignUsers.length > 0 && memberIds.length > 0) {
					await users.updateMany(
						{ _id: { $in: memberIds } },
						{ $set: { parent_id: "" } }
					);
				}

				// Update users
				await users.updateMany(updateConditions, { $set: updateData });

				// Send success response
				return res.send({
					message: res.__("admin.admin_permissions.users_has_been_assigned_successfully"),
					status: Constants.STATUS_SUCCESS
				});

			} catch (error) {
				console.error("Error in getRoleUsersAndUpdate:", error);
				return res.send({
					status: Constants.STATUS_ERROR,
					message: res.__("admin.system.something_going_wrong_please_try_again")
				});
			}
		} else {
			try {
				// Configure conditions for get already assigned and shifted users list
				const conditions = { ...Constants.ADMIN_USER_COMMON_CONDITIONS };

				if (isAssign) {
					conditions.parent_id = new ObjectId(userId);
				} else {
					conditions._id = new ObjectId(userId);
				}

				// Get already assigned and shifted users list
				const users = this.db.collection(Tables.USERS);
				const result = await users.find(conditions, {
					projection: { _id: 1, parent_id: 1 }
				}).toArray();

				const selectedUser = result.map(elem => isAssign ? elem._id : elem.parent_id);

				// Configure conditions for get given role users list
				const options = {
					collections: [{
						collection: Tables.USERS,
						columns: ["_id", "full_name"],
						selected: selectedUser,
						conditions: {
							active: Constants.ACTIVE,
							is_deleted: Constants.NOT_DELETED,
							user_role_id: roleId,
							user_type: Constants.USER_TYPE_ADMIN,
							team_head: !isAssign,
							not_shown: { $exists: false }
						}
					}]
				};

				// Get dropdown list for given role users
				const response = await getDropdownList(req, res, next, options);

				if (response.status !== Constants.STATUS_SUCCESS) {
					req.flash(Constants.STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
					return res.redirect(Constants.WEBSITE_ADMIN_URL + 'admin_permissions');
				}

				// Send success response
				return res.render('assign_shift', {
					layout: false,
					is_team_head: isAssign,
					user_id: userId,
					role_id: roleId,
					result: response.final_html_data[0] || ""
				});

			} catch (error) {
				console.error("Error in getRoleUsersAndUpdate:", error);
				req.flash(Constants.STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.redirect(Constants.WEBSITE_ADMIN_URL + "admin_permissions");
			}
		}
	}
}
export default AdminPermission;
