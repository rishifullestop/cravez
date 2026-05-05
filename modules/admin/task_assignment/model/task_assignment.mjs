import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, newDate, getDropdownList } from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { saveSystemLogs } from "../../../../services/index.mjs";

class TaskAssignment {
    
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.TASK_ASSIGNMENTS);
    }

    /**
     * Function to get task assignment list
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getTaskList(req, res, next) {
        try {
            let authUserRoleId = req?.session?.user?.user_role_id || "";
            let isTeamHead = req?.session?.user?.team_head || false;
            let authId = (isTeamHead) ? req?.session?.user?._id : req?.session?.user?.parent_id;

            if (isPost(req)) {
                let limit = (req?.body?.length) ? parseInt(req?.body?.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req?.body?.start) ? parseInt(req?.body?.start) : Constants.DEFAULT_SKIP;
                let fromDate = req?.body?.from_date || "";
                let toDate = req?.body?.to_date || "";

                /** Common Conditions **/
                let commonConditions = {parent_id: new ObjectId(authId)};

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);

                /** Conditions for leave date */
                if (fromDate != "" && toDate != "") {
                    dataTableConfig.conditions["$or"] = [
                        {
                            $and: [
                                { from_date: { $gte: newDate(fromDate) } },
                                { to_date: { $lte: newDate(toDate) } }
                            ]
                        },
                        {
                            $and: [
                                { to_date: { $gte: newDate(fromDate) } },
                                { from_date: { $lte: newDate(toDate) } }
                            ]
                        }
                    ];
                }

                if (authUserRoleId == Constants.CRAVEZ && dataTableConfig.conditions.parent_id) {
                    commonConditions.parent_id = dataTableConfig.conditions.parent_id;
                }

                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

                let dbRes = await this.collectionDb.aggregate([
                    {$match: dataTableConfig.conditions },
                    {$facet : {
                        list : [
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit },
                            {$lookup: {
                                from: Tables.USERS,
                                localField: "agent_id",
                                foreignField: "_id",
                                as: "users_details"
                            }},
                            {$project: {
                                _id: 1, from_date: 1, to_date: 1, business_rule: 1,
                                agent_name: { $arrayElemAt: ["$users_details.full_name", 0] }
                            }}
                        ],
                        count: [
                            {$count: "count"},
                        ],
                    }}
                ]).toArray();

                // Get team members if cravez select team head
                let teamMembers = "";
                if (authUserRoleId == Constants.CRAVEZ && dataTableConfig.conditions.parent_id) {
                    let parentId = dataTableConfig.conditions.parent_id;
                   
                    let conditions = { ...Constants.ADMIN_USER_COMMON_CONDITIONS };
                    conditions.parent_id = new ObjectId(parentId);
                    
                    const dropDownResponse = await getDropdownList(req, res, next, {
                        collections: [{
                            collection: Tables.USERS,
                            columns: ["_id", "full_name"],
                            conditions: conditions
                        }]
                    });
                    
                    teamMembers = dropDownResponse?.final_html_data?.[0] || "";
                }

                /** Send response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data: dbRes?.[0]?.list || [],
                    recordsTotal: dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0,
                    team_members: teamMembers
                });
            } else {
                // Select default team if tl is logged in
                let selected = [];
                if (isTeamHead) selected.push(authId);

                // Set conditions
                let teamConditions = { ...Constants.ADMIN_USER_COMMON_CONDITIONS };
                teamConditions.team_head = true;
                teamConditions.user_role_id = Constants.CALL_CENTER_TEAM;

                let conditions = { ...Constants.ADMIN_USER_COMMON_CONDITIONS };
                conditions.parent_id = new ObjectId(authId);

                if (authUserRoleId != Constants.CRAVEZ) {
                    teamConditions.parent_id = new ObjectId(authId);
                }

                let options = {
                    collections: [{
                        collection: Tables.USERS,
                        columns: ["_id", "full_name"],
                        conditions: conditions
                    }]
                };

                if (authUserRoleId == Constants.CRAVEZ) {
                    options.collections.push({
                        collection: Tables.USERS,
                        columns: ["_id", "full_name"],
                        selected: selected,
                        conditions: teamConditions
                    });
                }

                // Get users dropdown list
                const dropDownResponse = await getDropdownList(req, res, next, options);

                /** render listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/task_assignment/list']);
                res.render('list', {
                    users_list: dropDownResponse?.final_html_data?.[0] || "",
                    team_list: dropDownResponse?.final_html_data?.[1] || "",
                    from_date: req?.query?.from_date || "",
                    to_date: req?.query?.to_date || ""
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get task assignment detail
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return json
     */
    async getTaskDetails(req, res, next) {
        try {
            let taskId = new ObjectId(req.params.id);

            /** Get task assignment details **/
            const taskResult = await this.collectionDb.findOne({ _id: taskId });

            /** Send error response */
            if (!taskResult) {
                return {
                    status: Constants.STATUS_ERROR,
                    message: res.__("admin.system.invalid_access")
                };
            }

            return {
                status: Constants.STATUS_SUCCESS,
                result: taskResult
            };
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for add or update task assignment
     *
     * @param req 	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async addEditTask(req, res, next) {
        try {
            let taskId = (req.params.id) ? new ObjectId(req.params.id) : new ObjectId();
            let isEditable = (req.params.id) ? true : false;
            let isTeamHead = (req.session.user.team_head) ? req.session.user.team_head : false;
            let authId = (isTeamHead) ? req.session.user._id : req.session.user.parent_id;
            
            if (isPost(req)) {
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let businessRule = (req.body.business_rule && req.body.business_rule.constructor !== Array) ? [req.body.business_rule] : req.body.business_rule;

                let fromDate = req.body.from_date ? req.body.from_date : "";
                let toDate = req.body.to_date ? req.body.to_date : "";

                let tempToDate = newDate(toDate, Constants.DATABASE_DATE_FORMAT);
                let tempFromDate = newDate(fromDate, Constants.DATABASE_DATE_FORMAT);
                tempToDate = newDate(tempToDate + " " + Constants.END_DATE_TIME_FORMAT);
                tempFromDate = newDate(tempFromDate + " " + Constants.START_DATE_TIME_FORMAT);

                /** Save task assignments details **/
                await this.collectionDb.updateOne(
                    {
                        _id: taskId,
                        parent_id: new ObjectId(authId)
                    },
                    {
                        $set: {
                            from_date: getUtcDate(tempFromDate),
                            to_date: getUtcDate(tempToDate),
                            business_rule: businessRule,
                            agent_id: new ObjectId(req.body.agent_id),
                            modified: getUtcDate()
                        },
                        $setOnInsert: {
                            created: getUtcDate()
                        }
                    },
                    { upsert: true }
                );

                /** save System logs */
                saveSystemLogs(req, res, {
                    user_id: req.session.user._id,
                    parent_id: taskId,
                    activity_module: Constants.SYSTEM_LOG_MODULE_TASK_ASSIGNMENT,
                    activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                    additional_details: {
                        parent_id: new ObjectId(authId)
                    }
                });

                let message = (isEditable) ? res.__("admin.task_assignment.task_assignment_has_been_updated_successfully") : res.__("admin.task_assignment.task_assignment_has_been_added_successfully");
                req.flash(Constants.STATUS_SUCCESS, message);
                
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "task_assignment",
                });
            } else {
                let response = {};
                if (isEditable) {
                    /** Get task assignment details **/
                    response = await this.getTaskDetails(req, res, next);
                    if (response.status != Constants.STATUS_SUCCESS) {
                        /** Send error response **/
                        req.flash(Constants.STATUS_ERROR, response.message);
                        return res.redirect(Constants.WEBSITE_ADMIN_URL + "task_assignment");
                    }
                }

                let agentId = response.result && response.result.agent_id ? response.result.agent_id : "";

                /** Set options for get users list **/
                let conditions = {
                    user_role_id: Constants.CALL_CENTER_TEAM,
                    parent_id: new ObjectId(authId)
                };

                const dropDownResponse = await getDropdownList(req, res, next, {
                    collections: [{
                        collection: Tables.USERS,
                        columns: ["_id", "full_name"],
                        conditions: conditions,
                        selected: [agentId]
                    }]
                });

                let breadcrumbs = (isEditable) ? 'admin/task_assignment/edit' : 'admin/task_assignment/add';
                req.breadcrumbs(BREADCRUMBS[breadcrumbs]);
                
                /** Render add edit page  **/
                res.render('add_edit', {
                    layout: false,
                    result: response.result,
                    is_editable: isEditable,
                    users_list: dropDownResponse?.final_html_data?.[0] || "",
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for delete task assignment
     *
     * @param req 	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return null
     */
    async deleteTask(req, res, next) {
        try {
            let taskId = new ObjectId(req.params.id);

            /** For delete task details*/
            await this.collectionDb.deleteOne({ _id: taskId });

            /** save System logs */
            saveSystemLogs(req, res, {
                user_id: req.session.user._id,
                parent_id: taskId,
                activity_module: Constants.SYSTEM_LOG_MODULE_TASK_ASSIGNMENT,
                activity_type: Constants.ACTIVITY_TYPE_DELETE,
                additional_details: {}
            });

            /** Send success response **/
            req.flash(Constants.STATUS_SUCCESS, res.__("admin.task_assignment.task_assignment_has_been_deleted_successfully"));
            res.redirect(Constants.WEBSITE_ADMIN_URL + "task_assignment");
        } catch (error) {
            next(error);
        }
    }
}
export default TaskAssignment; 