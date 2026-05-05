import { ObjectId } from 'mongodb';
import { isPost, sanitizeData, getUtcDate, getDropdownList, configDatatable } from "../../../../utils/index.mjs";
import { saveSystemLogs} from "../../../../services/index.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

class Attributes {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.ATTRIBUTES);
    }

    async attributeList(req, res, next) {
        try {
            if (isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                const collection = this.collectionDb;

                // Configure Data table conditions
                const dataTableConfig = await configDatatable(req, res, null);
                // Default sorting
                if (dataTableConfig.sort_conditions && typeof dataTableConfig.sort_conditions["_id"] !== "undefined") {
                    dataTableConfig.sort_conditions = { type: Constants.SORT_ASC, order: Constants.SORT_ASC };
                }

                // Get list of attributes
                let dbRes = await this.collectionDb.aggregate([
                    {$lookup: {
                        from: Tables.ATTRIBUTE_TYPES,
                        localField: "type",
                        foreignField: "slug",
                        as: "attribute_type_details"
                    }},
                    { $project: { _id: 1, attribute_id: 1, title: 1, order: 1, type: { $arrayElemAt: ["$attribute_type_details.title", 0] } } },
                    { $match: dataTableConfig.conditions },
                    {
                        $facet: {
                            list: [
                                {$sort: dataTableConfig.sort_conditions},
                                {$skip: skip},
                                {$limit: limit},
                            ],
                            count: [
                                {$count: "count"}
                            ]
                        }
                    }
                ]).toArray();

                /** Send response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data: dbRes?.[0]?.list || [],
                    recordsTotal: dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0
                });
            } else {
                req.breadcrumbs(BREADCRUMBS["admin/attributes/list"]);
                res.render('list');
            }
        } catch (err) {
            next(err);
        }
    }

    async getAttributeDetails(req, res, next) {
        try {
            let attributeId = new ObjectId(req.params.id);
            const result = await this.collectionDb.findOne({ _id: attributeId }, {
                projection: { _id: 1, attribute_id: 1, title: 1, type: 1, input_type: 1, required: 1, validation_type: 1, order: 1, default_value: 1 }
            });
            if (!result) {
                return { status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") };
            }
            return { status: Constants.STATUS_SUCCESS, result };
        } catch (err) {
            next(err);
        }
    }

    async addEditAttribute(req, res, next) {
        try {
            let isEditable = (req.params.id) ? true : false;
            if (isPost(req)) {
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let attributeId = (req.params.id) ? new ObjectId(req.params.id) : new ObjectId();
                let attributeCustomId = parseInt(req.body.attribute_id);
                let type = req.body.type;
                let validationType = req.body.validation_type || "";
                let defaultValue = req.body.default_value || "";

                if (validationType) {
                    if (validationType === "text" && defaultValue) {
                        defaultValue = defaultValue;
                    } else if ((validationType === "percentage" || validationType === "float") && defaultValue) {
                        defaultValue = parseFloat(defaultValue);
                    } else if (validationType === "numeric" && defaultValue) {
                        defaultValue = parseInt(defaultValue);
                    }
                }

                // Save attribute details
                await this.collectionDb.updateOne({
                    _id: attributeId
                }, {
                    $set: {
                        attribute_id: attributeCustomId,
                        title: req.body.title,
                        type: type,
                        input_type: req.body.input_type,
                        required: req.body.required ? true : false,
                        validation_type: validationType,
                        order: parseInt(req.body.order),
                        default_value: defaultValue,
                        modified: getUtcDate(),
                    },
                    $setOnInsert: {
                        created: getUtcDate(),
                    }
                }, { upsert: true });

                let message = (isEditable) ? res.__("admin.attributes.attribute_has_been_updated_successfully") : res.__("admin.attributes.attribute_has_been_added_successfully");
                if (!isEditable) req.flash(Constants.STATUS_SUCCESS, message);
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "attributes",
                    message: message,
                });

                // Save System logs
                saveSystemLogs(req, res, {
                    user_id: req.session.user._id,
                    parent_id: attributeId,
                    activity_module: Constants.SYSTEM_LOG_MODULE_ATTRIBUTES,
                    activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                    additional_details: {}
                });
            } else {
                let response = {};
                if (isEditable) {
                    response = await this.getAttributeDetails(req, res, next);
                    if (response.status !== Constants.STATUS_SUCCESS) {
                        req.flash(Constants.STATUS_ERROR, response.message);
                        return res.redirect(Constants.WEBSITE_ADMIN_URL + "attributes");
                    }
                }
                let attributeDetails = (response.result) ? response.result : {};
                let type = (attributeDetails.type) ? attributeDetails.type : "";
                let options = {
                    collections: [{
                        collection: Tables.ATTRIBUTE_TYPES,
                        columns: ["slug", "title"],
                        selected: [type]
                    }]
                };
                const dropdownRes = await getDropdownList(req, res, next, options);
                if (dropdownRes.status !== Constants.STATUS_SUCCESS) {
                    return res.status(400).send({
                        status: Constants.STATUS_ERROR,
                        message: dropdownRes.message
                    });
                }
                let breadcrumbs = (isEditable) ? "admin/attributes/edit" : "admin/attributes/add";
                req.breadcrumbs(BREADCRUMBS[breadcrumbs]);
                res.render('add_edit', {
                    layout: false,
                    result: attributeDetails,
                    is_editable: isEditable,
                    dropdown_list: dropdownRes.final_html_data[0]
                });
            }
        } catch (err) {
            next(err);
        }
    }

    async deleteAttribute(req, res, next) {
        try {
            let attributeId = new ObjectId(req.params.id);
            await this.collectionDb.deleteOne({ _id: attributeId });
            req.flash(Constants.STATUS_SUCCESS, res.__("admin.attributes.attribute_has_been_deleted_successfully"));
            res.redirect(Constants.WEBSITE_ADMIN_URL + 'attributes');
            saveSystemLogs(req, res, {
                user_id: req.session.user._id,
                parent_id: attributeId,
                activity_module: Constants.SYSTEM_LOG_MODULE_ATTRIBUTES,
                activity_type: Constants.ACTIVITY_TYPE_DELETE,
                additional_details: {}
            });
        } catch (err) {
            next(err);
        }
    }

    async changeOrderValue(req, res, next) {
        try {
            req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
            let attributeId = new ObjectId(req.body.id);
            if (!attributeId) return res.send({ status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") });
            await this.collectionDb.updateOne({
                _id: attributeId
            }, {
                $set: {
                    order: parseInt(req.body.new_order),
                    modified: getUtcDate()
                }
            });
            res.send({
                status: Constants.STATUS_SUCCESS,
                message: res.__("admin.attributes.order_has_been_updated_successfully"),
            });
            saveSystemLogs(req, res, {
                user_id: req.session.user._id,
                parent_id: attributeId,
                activity_module: Constants.SYSTEM_LOG_MODULE_ATTRIBUTES,
                activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                additional_details: {}
            });
        } catch (err) {
            next(err);
        }
    }
}

export default Attributes; 