import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, getLanguages, getDatabaseSlug} from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { saveSystemLogs} from "../../../../services/index.mjs";

/**
 * CMS Model - Handles CMS CRUD operations
 */
class Cms {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.PAGES);
    }

    /**
     * Get CMS list (datatable or render page)
     */
    async getCmsList(req, res, next) {
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
                                _id: 1, name: 1, body: 1, modified: 1, slug: 1
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
                req.breadcrumbs(BREADCRUMBS['admin/cms/list']);
                res.render('list');
            }
        } catch (err) {
            next(err);
        }
    }

    /**
     * Get CMS details by ID
     */
    async getCmsDetails(req, res, next) {
        try {
            let cmsId = req.params.id ? req.params.id : "";
            const result = await this.collectionDb.findOne({
                _id: new ObjectId(cmsId)
            }, { projection: { _id: 1, name: 1, body: 1, modified: 1, pages_descriptions: 1 } });
            if (!result) {
                return { status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") };
            }
            return { status: Constants.STATUS_SUCCESS, result };
        } catch (err) {
            next(err);
        }
    }

    /**
     * Add or Edit CMS
     */
    async addEditCms(req, res, next) {
        try {
            let isEditable = req.params.id || false;
            let cmsId = req.params.id ? new ObjectId(req.params.id) : new ObjectId();
            if (isPost(req)) {
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let allData = req.body;
                let langId = Constants.DEFAULT_LANGUAGE_MONGO_ID;
                if (!allData.pages_descriptions || !allData.pages_descriptions[langId] || allData.pages_descriptions[langId] === '') {
                    return res.send({
                        status: Constants.STATUS_ERROR,
                        message: [{ param: Constants.ADMIN_GLOBAL_ERROR, msg: res.__("admin.system.something_going_wrong_please_try_again") }]
                    });
                }
                req.body = { ...allData.pages_descriptions[langId] };
                let pageBody = req.body.body ? req.body.body : "";
                let pageName = req.body.name ? req.body.name : "";
                // Replace upload paths
                if (pageBody !== "") {
                    req.body.body = pageBody.replace(/&nbsp;|<br \/>/g, ' ').trim();
                    pageBody = pageBody.replace(new RegExp(Constants.WEBSITE_PUBLIC_UPLOADS_PATH, 'g'), 'WEBSITE_IMG_URL/');
                    pageBody = pageBody.replace(new RegExp(Constants.WEBSITE_URL, 'g'), 'WEBSITE_URL/');
                }
                Constants.LANGUAGES_IN_SYSTEM?.forEach(lang => {
                    if (allData.pages_descriptions[lang]) {
                        allData.pages_descriptions[lang].body = allData.pages_descriptions[lang].body.replace(new RegExp(Constants.WEBSITE_PUBLIC_UPLOADS_PATH, 'g'), 'WEBSITE_IMG_URL/');
                        allData.pages_descriptions[lang].body = allData.pages_descriptions[lang].body.replace(new RegExp(Constants.WEBSITE_URL, 'g'), 'WEBSITE_URL/');
                    }
                });

                // Save or update
                if (isEditable) {
                    await this.collectionDb.updateOne({ _id: cmsId }, {
                        $set: {
                            body: pageBody,
                            name: req.body.name || "",
                            default_language_id: langId,
                            pages_descriptions: allData.pages_descriptions || {},
                            modified: getUtcDate()
                        }
                    });
                } else {
                    // Generate slug
                    let options = { title: pageName, table_name: Tables.PAGES, slug_field: "slug" };
                    const slugRes = await getDatabaseSlug(options);
                    await this.collectionDb.insertOne({
                        name: pageName,
                        body: pageBody,
                        slug: slugRes?.title || "",
                        default_language_id: langId,
                        pages_descriptions: allData.pages_descriptions || {},
                        created: getUtcDate(),
                        modified: getUtcDate()
                    });
                }
                // System logs
                saveSystemLogs(req, res, {
                    user_id: req.session.user._id,
                    parent_id: cmsId,
                    activity_module: Constants.SYSTEM_LOG_MODULE_CMS,
                    activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                    additional_details: {}
                });
                let message = isEditable ? res.__("admin.cms.cms_details_has_been_updated_successfully") : res.__("admin.cms.cms_has_been_added_successfully");
                if (!isEditable) req.flash(Constants.STATUS_SUCCESS, message);
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + 'cms',
                    message: message
                });
            } else {
                // Render add/edit page
                const languageList = await getLanguages();
                let response = {};
                if (isEditable) {
                    response = await this.getCmsDetails(req, res, next);
                    if (response.status !== Constants.STATUS_SUCCESS) {
                        req.flash(Constants.STATUS_ERROR, response.message);
                        return res.redirect(Constants.WEBSITE_ADMIN_URL + 'cms');
                    }
                }
                let breadcrumbs = isEditable ? 'admin/cms/edit' : 'admin/cms/add';
                req.breadcrumbs(BREADCRUMBS[breadcrumbs]);
                res.render(isEditable ? 'edit' : 'add', {
                    result: response.result || {},
                    language_list: languageList
                });
            }
        } catch (err) {
            next(err);
        }
    }

    /**
     * Delete CMS by ID
     */
    async deleteCms(req, res, next) {
        try {
            let cmsId = req.params.id ? new ObjectId(req.params.id) : null;
            await this.collectionDb.deleteOne({ _id: cmsId });
            saveSystemLogs(req, res, {
                user_id: req.session.user._id,
                parent_id: cmsId,
                activity_module: Constants.SYSTEM_LOG_MODULE_CMS,
                activity_type: Constants.ACTIVITY_TYPE_DELETE,
                additional_details: {}
            });
            req.flash(Constants.STATUS_SUCCESS, res.__("admin.cms.cms_has_been_deleted_successfully"));
            res.redirect(Constants.WEBSITE_ADMIN_URL + "cms");
        } catch (err) {
            next(err);
        }
    }
}
export default Cms;