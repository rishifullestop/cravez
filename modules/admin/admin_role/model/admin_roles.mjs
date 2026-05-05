import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import { isPost, sanitizeData, getUtcDate, configDatatable } from "../../../../utils/index.mjs";
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import AdminModule from '../../admin_modules/model/admin_module.mjs'; 
import { saveSystemLogs} from "../../../../services/index.mjs";

/**
 * AdminRole class for handling admin roles
 */
class AdminRole {
    /**
     * Creates an instance of AdminRole
     * @param {Object} db - Database connection instance
     */
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.ADMIN_ROLES);
        this.adminModule = new AdminModule(db);
    }

    /**
     * Function to get admin role list
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>}
     */
    async list(req, res) {
        const userType = req.params.user_type || "";

        if (isPost(req)) {
            try {
                const limit = parseInt(req.body.length || Constants.ADMIN_LISTING_LIMIT);
                const skip = parseInt(req.body.start || Constants.DEFAULT_SKIP);

                // Configure Datatable conditions
                const dataTableConfig = await configDatatable(req, res, null);

                // Set common conditions
                const commonConditions = {
                    user_type: userType,
                    is_shown: Constants.SHOWN
                };

                dataTableConfig.conditions = { ...commonConditions, ...dataTableConfig.conditions };

                // Get list or count of admin roles
                let dbRes = await this.collectionDb.aggregate([
                    { $match: dataTableConfig.conditions },
                    {
                        $facet : {
                            list : [
                                { $sort: dataTableConfig.sort_conditions },
                                { $skip: skip },
                                { $limit: limit },
                                {$project: { _id: 1, role_name: 1, modified: 1, not_deletable: 1 }},                                
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
            } catch (error) {
                console.error("Error in list:", error);
                res.send({
                    status: Constants.STATUS_ERROR,
                    message: res.__("admin.system.something_going_wrong_please_try_again")
                });
            }
        } else {
            // Render listing page
            req.breadcrumbs(BREADCRUMBS["admin/admin_role/list"]);
            res.render('list', {
                dynamic_url: userType,
                user_type: userType
            });
        }
    }

    /**
     * Add new admin role
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>}
     */
    async add(req, res) {
        const userType = req.params.user_type || "";

        if (isPost(req)) {
            try {
                // Sanitize data
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                const roleName = req.body.role || "";

                // Format module IDs array
                const moduleArray = await this.adminModule.formatModuleIdsArray(req, res, { user_type: userType });
                const currentObjectId = new ObjectId();

                // Insert role
                const result = await this.collectionDb.insertOne({
                    _id: currentObjectId,
                    role_name: roleName,
                    user_type: userType,
                    module_ids: moduleArray,
                    is_shown: Constants.SHOWN,
                    role_id: String(currentObjectId),
                    created: getUtcDate(),
                    modified: getUtcDate()
                });

                if (result.insertedId) {
                    req.flash(Constants.STATUS_SUCCESS, res.__("admin.admin_role.role_has_been_added_successfully"));
                    return res.send({
                        status: Constants.STATUS_SUCCESS,
                        redirect_url: `${Constants.WEBSITE_ADMIN_URL}admin_role/${userType}`,
                        message: res.__("admin.admin_role.role_has_been_added_successfully")
                    });
                }

                return res.send({
                    status: Constants.STATUS_ERROR,
                    message: [{ param: Constants.ADMIN_GLOBAL_ERROR, msg: res.__("admin.system.something_going_wrong_please_try_again") }]
                });

            } catch (error) {
                console.error("Error in add:", error);
                return res.send({
                    status: Constants.STATUS_ERROR,
                    message: [{ param: Constants.ADMIN_GLOBAL_ERROR, msg: res.__("admin.system.something_going_wrong_please_try_again") }]
                });
            }
        } else {
            try {
                // Get admin modules tree
                const response = await this.adminModule.getAdminModulesTree(req, res, {
                    user_type: userType,
                    only_for_menu: false
                });

                // Render add page
                req.breadcrumbs(BREADCRUMBS['admin/admin_role/add']);
                res.render('add', {
                    admin_modules: response.result,
                    dynamic_url: userType,
                    user_type: userType
                });

            } catch (error) {
                console.error("Error in add:", error);
                req.flash(Constants.STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
                res.redirect(`${Constants.WEBSITE_ADMIN_URL}admin_role/${userType}`);
            }
        }
    }

    /**
     * Edit admin role
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>}
     */
    async edit(req, res) {
        const roleId = req?.params?.id && ObjectId.isValid(req?.params?.id) ? new ObjectId(req?.params?.id) : "";
        const userType = req.params.user_type || "";

        if (!roleId) {
            req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
            return res.redirect(`${Constants.WEBSITE_ADMIN_URL}admin_role/${userType}`);
        }

        if (isPost(req)) {
            try {
                // Sanitize data
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                const roleName = req.body.role || "";
                
                // Format module IDs array
                const moduleArray = await this.adminModule.formatModuleIdsArray(req, res, { user_type: userType });

                // Update role
                const result = await this.collectionDb.updateOne(
                    {
                        _id: new ObjectId(roleId),
                        user_type: userType
                    },
                    {
                        $set: {
                            role_name: roleName,
                            module_ids: moduleArray,
                            modified: getUtcDate()
                        }
                    }
                );

                if (result.modifiedCount > 0) {
                    // Save system logs
                    saveSystemLogs(req, res, {
                        user_id: req.session.user._id,
                        parent_id: roleId,
                        activity_module: Constants.SYSTEM_LOG_MODULE_ROLE_MANAGEMENT,
                        activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                        additional_details: {}
                    });

                    req.flash(Constants.STATUS_SUCCESS, res.__("admin.admin_role.role_details_updated_successfully"));
                    return res.send({
                        status: Constants.STATUS_SUCCESS,
                        redirect_url: `${Constants.WEBSITE_ADMIN_URL}admin_role/${userType}`,
                        message: res.__("admin.admin_role.role_details_updated_successfully")
                    });
                }

                return res.send({
                    status: Constants.STATUS_ERROR,
                    message: [{ param: Constants.ADMIN_GLOBAL_ERROR, msg: res.__("admin.system.something_going_wrong_please_try_again") }]
                });

            } catch (error) {
                console.error("Error in edit:", error);
                return res.send({
                    status: Constants.STATUS_ERROR,
                    message: [{ param: Constants.ADMIN_GLOBAL_ERROR, msg: res.__("admin.system.something_going_wrong_please_try_again") }]
                });
            }
        } else {
            try {
                // Get role details
                const roleDetails = await this.collectionDb.findOne(
                    {
                        _id: new ObjectId(roleId),
                        user_type: userType
                    },
                    {
                        projection: {
                            _id: 1,
                            role_name: 1,
                            module_ids: 1
                        }
                    }
                );

                if (!roleDetails) {
                    req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
                    return res.redirect(`${Constants.WEBSITE_ADMIN_URL}admin_role/${userType}`);
                }

                // Get admin modules tree
                const response = await this.adminModule.getAdminModulesTree(req, res, {
                    user_type: userType,
                    only_for_menu: false
                });

                // Render edit page
                req.breadcrumbs(BREADCRUMBS['admin/admin_role/edit']);
                res.render('edit', {
                    user_type: userType,
                    dynamic_url: userType,
                    result: roleDetails,
                    admin_modules: response.result
                });

            } catch (error) {
                console.error("Error in edit:", error);
                req.flash(Constants.STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
                res.redirect(`${Constants.WEBSITE_ADMIN_URL}admin_role/${userType}`);
            }
        }
    }

    /**
     * Delete admin role
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<void>}
     */
    async delete(req, res) {
        const roleId = req?.params?.id && ObjectId.isValid(req?.params?.id) ? new ObjectId(req?.params?.id) : "";
        const userType = req.params.user_type || "";

        if (!roleId) {
            req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
            return res.redirect(`${Constants.WEBSITE_ADMIN_URL}admin_role/${userType}`);
        }

        try {
            const result = await this.collectionDb.deleteOne({
                _id: new ObjectId(roleId),
                user_type: userType
            });

            if (result.deletedCount > 0) {
                req.flash(Constants.STATUS_SUCCESS, res.__("admin.admin_role.deleted_successfully"));
            } else {
                req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
            }
        } catch (error) {
            console.error("Error in delete:", error);
            req.flash(Constants.STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
        }

        res.redirect(`${Constants.WEBSITE_ADMIN_URL}admin_role/${userType}`);
    }
}

export default AdminRole; 