import { ObjectId } from 'mongodb';
import { isPost, sanitizeData, getUtcDate, moveUploadedFile, removeFile, configDatatable} from "../../../../utils/index.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

class Category {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.CATEGORIES);
    }

    async getCategoryList(req, res, next) {
        try {
            let categoryId = (req.params.category_id && ObjectId.isValid(req.params.category_id)) ? new ObjectId(req.params.category_id) : 0;
            if (isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                const collection = this.collectionDb;

                const dataTableConfig = await configDatatable(req, res, null);

                let commonConditions = { parent_category_id: categoryId };
                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

                let categoryData = { _id: 1, category_name: 1, parent_category_id: 1, is_active: 1, modified: 1 };
                if (Constants.CATEGORY_ADD_ORDER) categoryData.order = 1;
                if (Constants.CATEGORY_ADD_IMAGE) categoryData.category_image = 1;
                if (Constants.CATEGORY_SELECT_BOX) categoryData.category_type = 1;

                const dbRes = await collection.aggregate([
                    { $match: dataTableConfig.conditions },
                    {
                        $facet: {
                            list: [
                                { $sort: dataTableConfig.sort_conditions },
                                { $skip: skip },
                                { $limit: limit },
                                { $project: categoryData },
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
                let breadcrumbValus = [];
                let parentCategoryId = "";
                if (categoryId) {
                    let response = await this.viewCategoryListDetails(req, res, next, { category_id: categoryId });
                    breadcrumbValus = response.breadcrumbValue.reverse();
                    parentCategoryId = response.parent_category_id != 0 ? response.parent_category_id : " ";
                }
                req.breadcrumbs(BREADCRUMBS['admin/category/list']);
                res.render('list', {
                    category_id: categoryId,
                    id: parentCategoryId,
                    breadcrumbData: breadcrumbValus
                });
            }
        } catch (err) {
            next(err);
        }
    }

    async getCategoryDetails(req, res, next) {
        try {
            let categoryId = (req.params.id) ? req.params.id : "";
            let categoryData = { _id: 1, category_name: 1, parent_category_id: 1, is_active: 1, modified: 1 };
            if (Constants.CATEGORY_ADD_ORDER) categoryData.order = 1;
            if (Constants.CATEGORY_ADD_IMAGE) categoryData.category_image = 1;
            if (Constants.CATEGORY_SELECT_BOX) categoryData.category_type = 1;
            const result = await this.collectionDb.findOne({ _id: new ObjectId(categoryId) }, { projection: categoryData });
            if (!result) return { status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access") };
            return { status: Constants.STATUS_SUCCESS, result };
        } catch (err) {
            next(err);
        }
    }

    async categoryDelete(req, res, next) {
        try {
            let categoryId = (req.params.id) ? req.params.id : "";
            let parentId = (req.params.parent_id && req.params.parent_id != 0) ? req.params.parent_id : "";
            const categories = this.collectionDb;
            const result = await categories.find({
                $or: [
                    { _id: new ObjectId(categoryId) },
                    { parent_category_id: new ObjectId(categoryId) }
                ]
            }, { projection: { _id: 1, category_name: 1, parent_category_id: 1, category_image: 1 } }).toArray();
            if (result && result.length <= 0) return res.redirect(Constants.WEBSITE_ADMIN_URL + "category");
            await categories.deleteMany({
                $or: [
                    { _id: new ObjectId(categoryId) },
                    { parent_category_id: new ObjectId(categoryId) }
                ]
            });
            req.flash(Constants.STATUS_SUCCESS, res.__("admin.category.category_deleted_successfully"));
            res.redirect(Constants.WEBSITE_ADMIN_URL + "category/" + parentId);
            result.map(resdata => {
                if (resdata.category_image) {
                    removeFile({ file_path: Constants.CATEGORY_FILE_PATH + resdata.category_image }).then(() => { });
                }
            });
        } catch (err) {
            next(err);
        }
    }

    async addEditCategory(req, res, next) {
        try {
            let isEditable = (req.params.id) ? true : false;
            let parentCategoryId = (req.params.parent_category_id && ObjectId.isValid(req.params.parent_category_id)) ? new ObjectId(req.params.parent_category_id) : 0;
            let categoryId = (req.params.id) ? new ObjectId(req.params.id) : new ObjectId();
            if (isPost(req)) {
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let categoryName = (req.body.category_name) ? req.body.category_name : "";
                // Validation is handled by express-validator middleware
                let categoryValues = {
                    parent_category_id: parentCategoryId,
                    category_name: categoryName,
                    modified: getUtcDate()
                };
                if (Constants.CATEGORY_SELECT_BOX && parentCategoryId == 0 && req.body.category_type && req.body.category_type != "") categoryValues.category_type = req.body.category_type;
                if (Constants.CATEGORY_ADD_ORDER && parseInt(req.body.order)) categoryValues.order = parseInt(req.body.order);
                let image = (req.files && req.files.category_image) ? req.files.category_image : "";
                let oldimage = (req.body.old_image) ? req.body.old_image : "";
                let imageOptions = {
                    'image': image,
                    'filePath': Constants.CATEGORY_FILE_PATH,
                    'oldPath': oldimage
                };

                /** Upload image  */
                let imageResponse = await moveUploadedFile(req, res, imageOptions);

                if (imageResponse.status == Constants.STATUS_ERROR) {
                    return res.send({
                        status: Constants.STATUS_ERROR,
                        message: [{ 'param': 'category_image', 'msg': imageResponse.message }],
                    });
                }
                if (Constants.CATEGORY_ADD_IMAGE && imageResponse.fileName) {
                    categoryValues.category_image = imageResponse.fileName;
                }
                await this.collectionDb.updateOne({
                    _id: categoryId
                }, {
                    $set: categoryValues,
                    $setOnInsert: {
                        created: getUtcDate(),
                    }
                }, { upsert: true });
                let message = (isEditable) ? res.__("admin.category.category_has_been_updated_successfully") : res.__("admin.category.category_has_been_added_successfully");
                if (!isEditable) req.flash(Constants.STATUS_SUCCESS, message);
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "category/" + ((parentCategoryId != 0) ? parentCategoryId : ""),
                    parent_category_id: parentCategoryId,
                    message: message
                });
            } else {
                let response = {};
                if (isEditable) {
                    response = await this.getCategoryDetails(req, res, next);
                    if (response.status != Constants.STATUS_SUCCESS) {
                        req.flash(Constants.STATUS_ERROR, response.message);
                        return res.redirect(Constants.WEBSITE_ADMIN_URL + "category");
                    }
                }
                let breadcrumbs = (isEditable) ? 'admin/category/edit-category' : 'admin/category/add-category';
                req.breadcrumbs(BREADCRUMBS[breadcrumbs]);
                res.render('add_category', {
                    layout: false,
                    result: (response.result) ? response.result : {},
                    is_editable: isEditable,
                    parent_category_id: parentCategoryId
                });
            }
        } catch (err) {
            next(err);
        }
    }

    async viewCategoryListDetails(req, res, next, options) {
        try {
            let categoryId = (options.category_id) ? new ObjectId(options.category_id) : "";
            const result = await this.collectionDb.findOne({ _id: categoryId }, { projection: { _id: 1, category_name: 1, parent_category_id: 1 } });
            let outputvalues = [];
            if (!result) return { status: Constants.STATUS_ERROR, breadcrumbValue: outputvalues };
            outputvalues.push({ category_name: result.category_name, category_id: result._id });
            if (result.parent_category_id && result.parent_category_id != 0) {
                const parentResponse = await this.viewCategoryListDetails(req, res, next, { category_id: result.parent_category_id });
                parentResponse.breadcrumbValue.map(breadcrumbResult => {
                    outputvalues.push({ category_name: breadcrumbResult.category_name, category_id: breadcrumbResult.category_id });
                });
                return { breadcrumbValue: outputvalues, status: Constants.STATUS_SUCCESS, parent_category_id: result.parent_category_id };
            }
            return { breadcrumbValue: outputvalues, status: Constants.STATUS_SUCCESS, parent_category_id: result.parent_category_id };
        } catch (err) {
            next(err);
        }
    }
}

export default Category;