import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, configDatatable } from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

/**
 * Contact model class for admin contact management
 */
class Contact {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.CONTACTS);
    }

    /**
     * Get contact list (datatable or render page)
     */
    async getContactList(req, res, next) {
        try {
            if (isPost(req)) {
                let limit = req.body.length ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = req.body.start ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;

                // Configure datatable conditions
                const dataTableConfig = await configDatatable(req, res, null);

                 const dbRes = await this.collectionDb.aggregate([
                    { $match: dataTableConfig.conditions },
                    {
                        $facet: {
                            list: [
                                { $sort: dataTableConfig.sort_conditions },
                                { $skip: skip },
                                { $limit: limit },
                                { $project: {
                                    _id: 1, name: 1, email: 1, message: 1, phone: 1, created: 1
                                }},
                            ],
                            count: [
                                { $count: "count" }
                            ]
                        }
                    }
                ]).toArray();
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data: dbRes?.[0]?.list || [],
                    recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsTotal: dbRes?.[0]?.count?.[0]?.count || 0
                });
            } else {
                // Render listing page
                req.breadcrumbs(BREADCRUMBS['admin/contact/list']);
                res.render('list');
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * View contact details
     */
    async view(req, res, next) {
        try {
            let contactId = req.params.id ? req.params.id : "";
            const result = await this.collectionDb.findOne({
                _id: new ObjectId(contactId)
            }, {
                projection: { _id: 1, name: 1, email: 1, message: 1, phone: 1, created: 1 }
            });

            if (!result) {
                req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
                return res.redirect(Constants.WEBSITE_ADMIN_URL + "contact");
            }

            req.breadcrumbs(BREADCRUMBS["admin/contact/view"]);
            res.render('view', {
                result: result
            });
        } catch (error) {
            next(error);
        }
    }
}

export default Contact;