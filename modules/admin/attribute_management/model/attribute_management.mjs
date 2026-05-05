import { ObjectId } from 'mongodb';
import { isPost, sanitizeData, getUtcDate, getAttributeUniqueId, configDatatable, toTitleCase  } from "../../../../utils/index.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { saveSystemLogs} from "../../../../services/index.mjs";

class AttributeManagement {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.ATTRIBUTES);
    }

    async attributeList(req, res, next) {
        try {
            let attributeType = req.params.type;
            let displayType = toTitleCase(attributeType.replace(RegExp("_", "g"), " "));

            if (isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);
                let commonConditions = {
                    type: attributeType,
                    is_show: true
                };

                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

                // Get list and counts
                let dbRes = await this.collectionDb.aggregate([
                    {$match: dataTableConfig.conditions},
                    {
                        $facet: {
                            list: [
                                {$sort: dataTableConfig.sort_conditions},
                                {$skip: skip},
                                {$limit: limit},
                                {$project: {
                                    _id: 1, title: 1, order: 1, type: 1, modified: 1
                                }}
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
                req.breadcrumbs(BREADCRUMBS["admin/attribute_management/list"]);
                res.render('list', {
                    attribute_type: attributeType,
                    displayType: displayType,
                    dynamic_variable: displayType,
                    dynamic_url: attributeType,
                });
            }
        } catch (err) {
            next(err);
        }
    }

    async getAttributeDetails(req, res, next) {
        try {
            let attributeType = req.params.type;
            let attributeId = new ObjectId(req.params.id);
            const result = await this.collectionDb.findOne({
                _id: attributeId,
                type: attributeType
            }, { projection: { _id: 1, title: 1, order: 1 } });
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
            let attributeType = req.params.type;
            let displayType = toTitleCase(attributeType.replace(RegExp("_", "g"), " "));
            let isEditable = (req.params.id) ? true : false;
            if (isPost(req)) {
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let attributeId = (req.params.id) ? new ObjectId(req.params.id) : new ObjectId();
                let title = req.body.title;

                // Unique attribute id for new
                let uniqueAttributeId = null;
                if (!isEditable) {
                    const uniqueResponse = await getAttributeUniqueId(req, res, next, { type: attributeType });
                    if (uniqueResponse.status !== Constants.STATUS_SUCCESS) {
                        return res.send({ status: Constants.STATUS_ERROR, message: uniqueResponse.message });
                    }
                    uniqueAttributeId = uniqueResponse.result;
                }

                // Update or insert
                await this.collectionDb.updateOne({
                    _id: attributeId
                }, {
                    $set: {
                        title: title,
                        type: attributeType,
                        order: parseInt(req.body.order),
                        modified: getUtcDate(),
                    },
                    $setOnInsert: {
                        is_show: true,
                        attribute_id: uniqueAttributeId,
                        created: getUtcDate(),
                    }
                }, { upsert: true });

                let message = (isEditable)
                    ? res.__("admin.attribute_management.attribute_has_been_updated_successfully", displayType)
                    : res.__("admin.attribute_management.attribute_has_been_added_successfully", displayType);
                if (!isEditable) req.flash(Constants.STATUS_SUCCESS, message);
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "attribute_management/" + attributeType,
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
                        return res.status(400).send({
                            status: Constants.STATUS_ERROR,
                            message: response.message
                        });
                    }
                }
                let breadcrumbs = (isEditable) ? "admin/attribute_management/edit" : "admin/attribute_management/add";
                req.breadcrumbs(BREADCRUMBS[breadcrumbs]);
                res.render('add_edit', {
                    layout: false,
                    result: (response.result) ? response.result : {},
                    is_editable: isEditable,
                    attribute_type: attributeType,
                    displayType: displayType,
                    dynamic_variable: displayType,
                    dynamic_url: attributeType,
                });
            }
        } catch (err) {
            next(err);
        }
    }

    async deleteAttribute(req, res, next) {
        try {
            let attributeType = req.params.type;
            let attributeId = new ObjectId(req.params.id);
            let displayType = toTitleCase(attributeType.replace(RegExp("_", "g"), " "));
            await this.collectionDb.deleteOne({
                _id: attributeId,
                type: attributeType
            });
            req.flash(Constants.STATUS_SUCCESS, res.__("admin.attribute_management.attribute_has_been_deleted_successfully", displayType));
            res.redirect(Constants.WEBSITE_ADMIN_URL + 'attribute_management/' + attributeType);
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
            let attributeType = req.params.type;

            if (!attributeId) return res.send({ status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") });
            
            await this.collectionDb.updateOne({
                _id: attributeId,
                type: attributeType
            }, {
                $set: {
                    order: parseInt(req.body.new_order),
                    modified: getUtcDate()
                }
            });
            res.send({
                status: Constants.STATUS_SUCCESS,
                message: res.__("admin.attribute_management.order_has_been_updated_successfully"),
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
export default AttributeManagement; 