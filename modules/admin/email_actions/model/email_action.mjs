import { ObjectId } from 'mongodb';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, sanitizeData, configDatatable, getUtcDate } from '../../../../utils/index.mjs';

/**
 * EmailActions class to handle all email actions CRUD operations
 */
class EmailActions {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.EMAIL_ACTIONS);
    }

    /**
     * Get email actions list (with datatable support)
     */
    async list(req, res, next) {
        try {
            if (isPost(req)) {
                let limit = req.body.length ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = req.body.start ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                const dataTableConfig = await configDatatable(req, res, null);

                 const dbRes = await this.collectionDb.aggregate([
                    {$match: dataTableConfig.conditions },
                    {$facet: {
                        list: [
                            { $sort: dataTableConfig.sort_conditions },
                            { $skip: skip },
                            { $limit: limit },
                            { $project: {
                                _id: 1, action: 1, title: 1, options: 1
                            }},
                        ],
                        count: [
                            { $count: "count" }
                        ]
                    }}
                ]).toArray();

                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data: dbRes?.[0]?.list || [],
                    recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsTotal: dbRes?.[0]?.count?.[0]?.count || 0
                });
            } else {
                req.breadcrumbs(BREADCRUMBS['admin/email_actions/list']);
                res.render('list');
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Add a new email action
     */
    async addEdit(req, res, next) {
        try {
            let isEditable  =   (req.params.id) ? true : false;
            let actionId    =   req.params.id   ? req.params.id : new ObjectId();

            if (isPost(req)) {
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);

                 /** Save / update email action details **/
                 await this.collectionDb.updateOne({
                    _id: new ObjectId(actionId)
                }, {
                    $set: {
                        title   : req.body.title,
                        action  : req.body.action,
                        options : req.body.options,
                        modified: getUtcDate()
                    },
                    $setOnInsert: {
                        created: getUtcDate()
                    }
                }, {upsert: true});

                let msg = isEditable && res.__('admin.email_actions.email_actions_details_updated_successfully') || res.__('admin.email_actions.email_actions_has_been_added_successfully')
                req.flash(Constants.STATUS_SUCCESS, msg);
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + 'email_actions',
                    message: msg
                });
            } else {
                let response = {};
                if(isEditable){
                    /** Get email action details **/
                    response = await this.getEmailActionsDetails(req, res, next);
                    if(response.status != Constants.STATUS_SUCCESS){
                        /** Send error response **/
                        req.flash(Constants.STATUS_ERROR, response.message);
                        return res.redirect(Constants.WEBSITE_ADMIN_URL + 'email_actions');
                    }
                }

                req.breadcrumbs(BREADCRUMBS['admin/email_actions/'+(isEditable && 'edit' || 'add')]);
                res.render('addEdit', {
                    isEditable  : isEditable,
                    result      : response.result || {},
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get details of a single email action
     */
    async getEmailActionsDetails(req, res, next) {
        try {
            let id = req.params.id ? req.params.id : '';
            const result = await this.collectionDb.findOne({ _id: new ObjectId(id) }, { projection: { _id: 1, action: 1, options: 1, title: 1 } });
            if (!result) {
                return { status: Constants.STATUS_ERROR, message: res.__('admin.system.invalid_access') };
            }
            return { status: Constants.STATUS_SUCCESS, result };
        } catch (error) {
            next(error);
        }
    }

    /**
     * Delete an email action
     */
    async emailDelete(req, res, next) {
        try {
            let id = req.params.id ? req.params.id : '';
            await this.collectionDb.deleteOne({ _id: new ObjectId(id) });
            req.flash(Constants.STATUS_SUCCESS, res.__('admin.email_actions.email_actions_deleted_successfully'));
            res.redirect(Constants.WEBSITE_ADMIN_URL + 'email_actions');
        } catch (error) {
            next(error);
        }
    }
}

export default EmailActions;