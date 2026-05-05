import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { isPost, sanitizeData, getUtcDate, configDatatable, moveUploadedFile,getDropdownList,arrayToObject} from "../../../../utils/index.mjs";
import { saveUserActivity } from "../../../../services/index.mjs";
import BREADCRUMBS from "../../../../breadcrumbs.mjs";

class ImportManager {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.IMPORT_REQUESTS);
    }

    /**
     * Function to get import managers list
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getImportManagerList(req, res, next) {
        try {
            if(isPost(req)){
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                let restaurantId = (req.session.user && req.session.user.restaurant_id) ? req.session.user.restaurant_id : "";

                /** Set user id condition in datatable*/
                let commonConditions = {
                    restaurant_id: new ObjectId(restaurantId)
                };

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);

                /** Datatable conditions assign in a object*/
                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

                let dbRes = await this.collectionDb.aggregate([
                    {$match: dataTableConfig.conditions },
                    {$facet : {
                        list : [
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip},
                            {$limit: limit},
                            {$lookup	: {
                                from			: Tables.RESTAURANT_BRANCHES,
                                localField		: "branch_id",
                                foreignField	: "_id",
                                as				: "branch_details",
                            }},
                            {$project: {
                                _id:1,note:1,imported_file:1,status:1,created:1,branch_id:1,
                                branch_name:{$arrayElemAt: [`$branch_details.name.${Constants.DEFAULT_LANGUAGE_CODE}`, 0]}
                            }}   
                        ],
                        count: [
                            {$count: "count"},
                        ],
                    }}
                ]).toArray();


                /** Send response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data			:   dbRes?.[0]?.list ||[],
                    recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0,
                    branch_names   : {}
                });
            } else {
                /** render import managers listing page **/
                req.breadcrumbs(BREADCRUMBS['import_managers/list']);
                res.render('list');
            }
        } catch (error) {
            next(error);
        }
    }   

    /**
     * Function for add import managers
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async addImportManager(req, res, next) {
        try {
            let authId       = req?.session?.user?._id;
            let restaurantId = req?.session?.user?.restaurant_id;
            
            if(isPost(req)){
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);

                /** Upload file**/
                const fileResponse = await moveUploadedFile(req, res, {
                    'image'             :   req?.files?.imported_file || "",
                    'filePath'          :   Constants.IMPORT_MANAGER_FILE_PATH,
                    'allowedExtensions' :   Constants.ALLOWED_IMPORT_MANAGER_EXTENSIONS,
                    'allowedImageError' :   Constants.ALLOWED_IMPORT_MANAGER_ERROR_MESSAGE,
                    'allowedMimeTypes'  :   Constants.ALLOWED_IMPORT_MANAGER_MIME_EXTENSIONS,
                    'allowedMimeError'  :   Constants.ALLOWED_IMPORT_MANAGER_MIME_ERROR_MESSAGE
                });
                
                /** Send error response **/
                if (fileResponse.status == Constants.STATUS_ERROR) {
                    return res.send({
                        status: Constants.STATUS_ERROR,
                        message: [{ 'param': 'imported_file', 'msg': fileResponse.message }]
                    });
                }

                /** Save import manager details **/
                let id = new ObjectId();
                await this.collectionDb.insertOne({
                    _id: id,
                    user_id: new ObjectId(authId),
                    restaurant_id: new ObjectId(restaurantId),
                    note: req.body.note,
                    status: Constants.PENDING,
                    imported_file : fileResponse.fileName,
                    created: getUtcDate()
                });

                /** Send success response **/
                req.flash(Constants.STATUS_SUCCESS, res.__("import_managers.import_manager_has_been_added_successfully"));
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_URL + "import_managers",
                    message: res.__("import_managers.import_manager_has_been_added_successfully")
                });

                /** Save user activities **/
                saveUserActivity(req, res, {
                    user_id         : new ObjectId(authId),
                    parent_type     : Tables.IMPORT_REQUESTS,
                    parent_id       : id,
                    activity_type   : Constants.ACTIVITY_ADD_EDIT_DETAILS
                });
            } else {
                /** Render add page  **/
                req.breadcrumbs(BREADCRUMBS['import_managers/add']);
                res.render('add');
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for download file
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next	As Callback argument to the middleware function
     *
     * @return null
     */
    async downloadFile(req, res, next) {
        try {
            let importManagerId = (req.params.id) ? req.params.id : "";
            
            /** Validate passed mongo id **/
            if (!importManagerId || !ObjectId.isValid(importManagerId)) {
                req.flash(Constants.STATUS_ERROR, res.__("system.invalid_access"));
                return res.redirect(Constants.WEBSITE_URL + "import_managers");
            }

            /** find import manager record **/
            const result = await this.collectionDb.findOne(
                { _id: new ObjectId(importManagerId) },
                {projection: {_id:1, imported_file:1}}
            );

            /** Send error response **/
            if(!result || !result?.imported_file) {
                req.flash(Constants.STATUS_ERROR, res.__("system.invalid_access"));
                return res.redirect(Constants.WEBSITE_URL + "import_managers");
            }

            let importedFile = result.imported_file;
            let fileData     = importedFile.split('.');
            let extension    = fileData.pop().toLowerCase();

            /** Download file **/
            res.download(Constants.IMPORT_MANAGER_FILE_PATH + importedFile, "restaurant_branch." + extension);
        } catch (error) {
            next(error);
        }
    }
}
export default ImportManager; 