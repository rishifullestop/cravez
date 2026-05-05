import { ObjectId } from 'mongodb';
import { isPost, sanitizeData, getUtcDate, getUniqueId, configDatatable } from "../../../../utils/index.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { saveSystemLogs} from "../../../../services/index.mjs";

class City {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.CITIES);
    }

    async getCitiesList(req, res, next) {
        try {
            if (isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                const collection = this.collectionDb;
                const dataTableConfig = await configDatatable(req, res, null);
                const dbRes = await collection.aggregate([
                    { $match: dataTableConfig.conditions },
                    {
                        $facet: {
                            city_list: [
                                { $project: { _id: 1, name: 1, city_id: 1 } },
                                { $sort: dataTableConfig.sort_conditions },
                                { $skip: skip },
                                { $limit: limit },
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
                    data: dbRes?.[0]?.city_list || [],
                    recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsTotal: dbRes?.[0]?.count?.[0]?.count || 0
                });
            } else {
                req.breadcrumbs(BREADCRUMBS['admin/city/list']);
                res.render('list');
            }
        } catch (err) {
            next(err);
        }
    }

    async getCityDetails(req, res, next) {
        try {
            let cityId = (req.params.id) ? req.params.id : "";
            const result = await this.collectionDb.findOne({ _id: new ObjectId(cityId) }, { projection: { _id: 1, name: 1 } });
            if (!result) return { status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") };
            return { status: Constants.STATUS_SUCCESS, result };
        } catch (err) {
            next(err);
        }
    }

    async addEditCity(req, res, next) {
        try {
            let isEditable = (req.params.id) ? true : false;
            if (isPost(req)) {
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let cityId = (req.params.id) ? new ObjectId(req.params.id) : new ObjectId();
                let nameEnglish = req.body.name_english ? req.body.name_english : "";
                let nameArabic = req.body.name_arabic ? req.body.name_arabic : "";
                let cityUniqueId = null;
                if (!isEditable) {
                    const uniqueIdResponse = await getUniqueId(req, res, next, { type: "cities" });
                    cityUniqueId = uniqueIdResponse.result;
                }
                await this.collectionDb.updateOne({
                    _id: cityId
                }, {
                    $set: {
                        name: {
                            ar: nameArabic,
                            en: nameEnglish
                        },
                        modified: getUtcDate()
                    },
                    $setOnInsert: {
                        country_id: Constants.COUNTRY_ID,
                        city_id: cityUniqueId,
                        created: getUtcDate()
                    }
                }, { upsert: true });
                saveSystemLogs(req, res, {
                    user_id: req.session.user._id,
                    parent_id: cityId,
                    activity_module: Constants.SYSTEM_LOG_MODULE_CITIES,
                    activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                    additional_details: {}
                });
                let message = (isEditable) ? res.__("admin.cities.city_has_been_updated_successfully") : res.__("admin.cities.city_has_been_added_successfully");
                if (!isEditable) req.flash(Constants.STATUS_SUCCESS, message);
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "cities",
                    message: message,
                    current_id: cityId
                });
            } else {
                let response = {};
                if (isEditable) {
                    response = await this.getCityDetails(req, res, next);
                    if (response.status != Constants.STATUS_SUCCESS) {
                        req.flash(Constants.STATUS_ERROR, response.message);
                        return res.redirect(Constants.WEBSITE_ADMIN_URL + "cities");
                    }
                }
                let breadcrumbs = (isEditable) ? 'admin/city/edit' : 'admin/city/add';
                req.breadcrumbs(BREADCRUMBS[breadcrumbs]);
                res.render('add_edit', {
                    layout: false,
                    result: (response.result) ? response.result : {},
                    is_editable: isEditable
                });
            }
        } catch (err) {
            next(err);
        }
    }
}

export default City; 