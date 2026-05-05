import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, moveUploadedFile, removeFile, getDatabaseSlug } from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

class QualityCategory {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.AVAYA_QUALITY_CATEGORIES);
    }

    /**
     * Function to get category list
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     *
     * @return render/json
     */
    async getCategoryList(req, res, next) {
        try {
            let categoryId = (req.params.category_id && req.params.category_id != 0) ? new ObjectId(req.params.category_id) : 0;
            
            if (isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                
                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);
                let commonConditions = {parent_category_id: categoryId};
                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

                // Get list and count using aggregation
                let dbRes = await this.collectionDb.aggregate([
                    {$match: dataTableConfig.conditions},
                    {
                        $facet: {
                            list: [
                                { $sort: dataTableConfig.sort_conditions },
                                { $skip: skip },
                                { $limit: limit },
                                {
                                    $project: {
                                        _id: 1,
                                        category_name: 1,
                                        category_percentage: 1,
                                        parent_category_id: 1,
                                        is_active: 1,
                                        modified: 1,
                                        ...(Constants.CATEGORY_ADD_ORDER && { order: 1 }),
                                        ...(Constants.CATEGORY_ADD_IMAGE && { category_image: 1 }),
                                        ...(Constants.CATEGORY_SELECT_BOX && { category_type: 1 })
                                    }
                                }
                            ],
                            count: [
                                { $count: "count" }
                            ]
                        }
                    }
                ]).toArray();

                /** Send response **/
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
                    /** Get View Category List Details For Breadcrumb **/
                    let response = await this.viewCategoryListDetails(req, res, next, { category_id: categoryId });
                    /** parentCategoryId For Subcategory **/
                    breadcrumbValus = response?.breadcrumbValue?.reverse() || [];
                    parentCategoryId = response.parent_category_id != 0 ? response.parent_category_id : " ";
                }
                req.breadcrumbs(BREADCRUMBS['admin/quality_category/list']);
                res.render('list', {
                    category_id: categoryId,
                    id: parentCategoryId,
                    breadcrumbData: breadcrumbValus
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get category's detail
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return json
     */
    async getCategoryDetails(req, res, next) {
        try {
            let categoryId = (req.params.id) ? req.params.id : "";
            /** Get category details **/
            var categoryData = {
                _id: 1,
                category_name: 1,
                category_percentage: 1,
                parent_category_id: 1,
                is_active: 1,
                modified: 1
            };

            if (Constants.CATEGORY_ADD_ORDER) categoryData.order = 1;
            if (Constants.CATEGORY_ADD_IMAGE) categoryData.category_image = 1;
            if (Constants.CATEGORY_SELECT_BOX) categoryData.category_type = 1;

            const result = await this.collectionDb.findOne({
                _id: new ObjectId(categoryId),
            }, { projection: categoryData });

            /** Send error response */
            if (!result) {
                return {
                    status: Constants.STATUS_ERROR,
                    message: res.__("admin.system.invalid_access")
                };
            }

            /** Send success response **/
            return {
                status: Constants.STATUS_SUCCESS,
                result: result
            };
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for delete categorys
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async categoryDelete(req, res, next) {
        try {
            let categoryId = (req.params.id) ? req.params.id : "";
            let parentId = (req.params.parent_id && req.params.parent_id != 0) ? req.params.parent_id : "";
            
            const result = await this.collectionDb.find({
                $or: [
                    { _id: new ObjectId(categoryId) },
                    { parent_category_id: new ObjectId(categoryId) }
                ]
            }, {
                projection: {
                    _id: 1,
                    category_name: 1,
                    parent_category_id: 1,
                    category_image: 1
                }
            }).toArray();

            if (result && result.length <= 0) {
                return res.redirect(Constants.WEBSITE_ADMIN_URL + "quality_category");
            }

            /** Remove category record With child category **/
            await this.collectionDb.deleteMany({
                $or: [
                    { _id: new ObjectId(categoryId) },
                    { parent_category_id: new ObjectId(categoryId) }
                ]
            });

            req.flash(Constants.STATUS_SUCCESS, res.__("admin.category.category_deleted_successfully"));
            res.redirect(Constants.WEBSITE_ADMIN_URL + "quality_category/" + parentId);
            
            /** Remove Image File For deleted category **/
            result.forEach(resdata => {
                /** remove old images*/
                if (resdata.category_image) {
                    removeFile({ file_path: Constants.CATEGORY_FILE_PATH + resdata.category_image }).then(() => { });
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for add Category with Edit Form
     *
     * @param req 	As 	Request Data
     * @param res 	As 	Response Data
     * @param next 	As 	Callback argument to the middleware function
     *
     * @return render
     */
    async addEditCategory(req, res, next) {
        try {
            let isEditable = (req.params.id) ? true : false;
            let parentCategoryId = (req.params.parent_category_id && req.params.parent_category_id != 0) ? new ObjectId(req.params.parent_category_id) : 0;
            let categoryId = (req.params.id) ? new ObjectId(req.params.id) : new ObjectId();
            let breadcrumbValus = [];
            
            if (parentCategoryId) {
                /** Get View Category List Details For Breadcrumb **/
                let responseCategory = await this.viewCategoryListDetails(req, res, next, { category_id: parentCategoryId });
                breadcrumbValus = responseCategory.breadcrumbValue.reverse();
            }
            
            if (isPost(req)) {
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let categoryName = (req.body.category_name) ? req.body.category_name : "";
                let categoryPercentage = (req.body.category_percentage) ? req.body.category_percentage : "";
                let categoryOrder = (req.body.order) ? req.body.order : "";
                let errors = [];

                if(!categoryName) errors.push({ 'param': 'category_name', 'msg': res.__("admin.category.please_enter_category") });

                if (breadcrumbValus && breadcrumbValus.length > 1) {
                    if(!categoryPercentage) errors.push({ 'param': 'category_percentage', 'msg': res.__("admin.quality_category.please_select_category_percentage") });
                    if(categoryPercentage && (isNaN(categoryPercentage) || categoryPercentage <= 0 || categoryPercentage > Constants.MAX_PERCENTAGE)){
                        errors.push({ 'param': 'category_percentage', 'msg': res.__("admin.quality_category.please_enter_valid_category_percentage") });
                    }
                }

                if(Constants.CATEGORY_ADD_ORDER){
                    if(!categoryOrder) errors.push({ 'param': 'order', 'msg': res.__("admin.category.please_enter_order") });
                    if(categoryOrder && (isNaN(categoryOrder) || categoryOrder <= 0 || !Number.isInteger(categoryOrder))){
                        errors.push({ 'param': 'order', 'msg': res.__("admin.category.please_enter_integer_order") });
                    }                    
                }

                if (Constants.CATEGORY_ADD_IMAGE && !isEditable && (!req.files || !req.files.category_image)){
                    errors.push({ 'param': 'category_image', 'msg': res.__("admin.category.please_select_category_image") });
                }

                if(errors.length > 0) return res.send({ status: Constants.STATUS_ERROR, message: errors });

                /**For Unique Category name */
                const categoryResult = await this.collectionDb.countDocuments({
                    parent_category_id: parentCategoryId,
                    category_name: { $regex: "^" + req.body.category_name + "$", $options: "i" },
                    _id: { $ne: categoryId },
                });

                /**For check categoryResult */
                if (categoryResult) {
                    return res.send({
                        status: Constants.STATUS_ERROR,
                        message: [{ 'param': 'category_name', 'msg': res.__("admin.category.whoops_you_have_entered_an_already_used") }],
                    });
                }

                /** upload category  image **/
                const imageResponse = await moveUploadedFile(req, res, {
                    'filePath': Constants.CATEGORY_FILE_PATH,
                    'image'   : req?.files?.category_image || "",
                    'oldPath' : req?.body?.old_image || ""
                });

                if (imageResponse.status == Constants.STATUS_ERROR) {
                    /** Send error response **/
                    return res.send({
                        status: Constants.STATUS_ERROR,
                        message: [{ 'param': 'category_image', 'msg': imageResponse.message }],
                    });
                }
                
                var categoryValues = {
                    parent_category_id: parentCategoryId,
                    category_name: categoryName,
                    modified: getUtcDate()
                };
                if (breadcrumbValus && breadcrumbValus.length > 1 && req.body.category_percentage && req.body.category_percentage != "") categoryValues.category_percentage = req.body.category_percentage;
                if (Constants.CATEGORY_ADD_ORDER && parseInt(req.body.order)) categoryValues.order = parseInt(req.body.order);
                
                /** Generate slug for new category **/
                if (parentCategoryId == 0 && !isEditable) {                    
                    /** Get slug **/
                    let slugResponse = await getDatabaseSlug({
                        title: categoryName,
                        table_name: Tables.AVAYA_QUALITY_CATEGORIES,
                        slug_field: "type"
                    });

                    if (slugResponse) categoryValues.slug = slugResponse?.title || "";
                }

                if (Constants.CATEGORY_ADD_IMAGE && imageResponse.fileName) {
                    categoryValues.category_image = imageResponse?.fileName || "";
                }

                /* UPDATE CATEGORY  */
                await this.collectionDb.updateOne({
                    _id: new ObjectId(categoryId)
                }, {
                    $set: categoryValues,
                    $setOnInsert: {
                        created: getUtcDate(),
                    }
                }, { upsert: true });

                /** Send success response **/
                let message = (isEditable) ? res.__("admin.category.category_has_been_updated_successfully") : res.__("admin.category.category_has_been_added_successfully");
                if (!isEditable) req.flash(Constants.STATUS_SUCCESS, message);
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "quality_category/" + ((parentCategoryId != 0) ? parentCategoryId : ""),
                    parent_category_id: parentCategoryId,
                    message: message
                });
            } else {
                let response = {};
                if (isEditable) {
                    /** Get category details **/
                    response = await this.getCategoryDetails(req, res, next);
                   
                    /** Send error response if category not found **/
                    if (response.status != Constants.STATUS_SUCCESS)  return res.status(400).send(response);
                }

                /** Render edit page  **/
                let breadcrumbs = (isEditable) ? 'admin/quality_category/edit-category' : 'admin/quality_category/add-category';
                req.breadcrumbs(BREADCRUMBS[breadcrumbs]);
                res.render('add_category', {
                    layout: false,
                    result: (response.result) ? response.result : {},
                    is_editable: isEditable,
                    parent_category_id: parentCategoryId,
                    breadcrumbData: breadcrumbValus
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for view Category List Details On Top As a Breadcrumb
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async viewCategoryListDetails(req, res, next, options) {
        try {
            let categoryId = (options.category_id) ? new ObjectId(options.category_id) : "";
            
            /** Get Breadcrumb details **/
            const result = await this.collectionDb.findOne({
                _id: categoryId,
            }, {
                projection: {
                    _id: 1,
                    category_name: 1,
                    parent_category_id: 1,
                }
            });
            /** Send error response if category not found **/
            if (!result) return { status: Constants.STATUS_ERROR, breadcrumbValue: [] };

            let outputvalues = [{ category_name: result?.category_name || "", category_id: result?._id || "" }];            

            /** Category Recursive For get All SubCategory Record With Breadcrumb**/
            const response = await this.viewCategoryListDetails(req, res, next, { category_id: result.parent_category_id });
            
            response?.breadcrumbValue?.forEach(breadcrumbResult => {
                outputvalues.push({ category_name: breadcrumbResult.category_name, category_id: breadcrumbResult.category_id });
            });

            return { 
                status: Constants.STATUS_SUCCESS, 
                breadcrumbValue: outputvalues, 
                parent_category_id: result?.parent_category_id || ""
            };
        } catch (error) {
            next(error);
        }
    }
}
export default QualityCategory; 