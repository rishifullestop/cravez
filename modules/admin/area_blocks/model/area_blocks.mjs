import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, getUniqueId, getCityList, getAreaList} from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { saveSystemLogs} from "../../../../services/index.mjs";

class AreaBlocks {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.AREA_BLOCKS);
    }

    /**
     * Function to get area blocks list
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getAreaBlocksList(req, res, next) {
        try {
            if(isPost(req)){
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                
                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);

                // Get list or count of area blocks 
                let dbRes = await this.collectionDb.aggregate([
                    { $match: dataTableConfig.conditions },
                    {$facet : {
                        list : [
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit },
                            {$lookup: {
                                from: Tables.CITIES,
                                localField: "city_id",
                                foreignField: "_id",
                                as: "city_details"
                            }},
                            {$lookup: {
                                from: Tables.AREAS,
                                localField: "area_id",
                                foreignField: "_id",
                                as: "area_details"
                            }},
                            {$project: {
                                _id: 1,
                                name: 1,
                                is_active: 1,
                                block_id: 1,
                                city_name: {$arrayElemAt: ["$city_details.name." + Constants.DEFAULT_LANGUAGE_CODE, 0]},
                                area_name: {$arrayElemAt: ["$area_details.name." + Constants.DEFAULT_LANGUAGE_CODE, 0]}
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
                }); 
            } else {
                /** Get city dropdown list **/
                let options = {city_id: ""};
                const cityList = await getCityList(req, res, next, options);
                
                /** render listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/area_blocks/list']);
                res.render('list', {
                    city_list: cityList
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get area block detail
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return json
     */
    async getAreaBlockDetails(req, res, next) {
        try {
            let blockId = (req.params.id) ? req.params.id : "";

            /** Get block details **/
            const result = await this.collectionDb.findOne({
                _id: new ObjectId(blockId),
            }, {projection: {_id: 1, name: 1, city_id: 1, area_id: 1}});

            /** Send error response */
            if(!result) {
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
     * Function for add or update block
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async addEditAreaBlock(req, res, next) {
        try {
            let isEditable = (req.params.id) ? true : false;
            let blockId = (req.params.id) ? new ObjectId(req.params.id) : new ObjectId();

            if(isPost(req)){
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);

                let nameEnglish = req.body.name_english;
                let nameArabic = req.body.name_arabic;
                let areaId = new ObjectId(req.body.area_id);
                let cityId = new ObjectId(req.body.city_id);


                // Get unique ID for new blocks
                let blockUniqueId = {};
                if(!isEditable) {
                    const uniqueIdResponse = await getUniqueId(req, res, next, {type: "area_blocks"});
                    blockUniqueId = uniqueIdResponse.result || {};
                }

                /** set data in object **/
                let updateData = {
                    name: {
                        ar: nameArabic,
                        en: nameEnglish
                    },
                    city_id: cityId,
                    area_id: areaId,
                    modified: getUtcDate()
                };

                /** Save block details **/
                await this.collectionDb.updateOne({
                    _id: blockId
                }, {
                    $set: updateData,
                    $setOnInsert: {
                        block_id: blockUniqueId,
                        is_active: Constants.ACTIVE,
                        created: getUtcDate()
                    }
                }, {upsert: true});

                /** save System logs */
                saveSystemLogs(req, res, {
                    user_id: req.session.user._id,
                    parent_id: blockId,
                    activity_module: Constants.SYSTEM_LOG_MODULE_AREA_BLOCKS,
                    activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                    additional_details: {}
                });

                /** Send success response **/
                let message = (isEditable) ? res.__("admin.area_blocks.block_has_been_updated_successfully") : res.__("admin.area_blocks.block_has_been_added_successfully");

                if(!isEditable) req.flash(Constants.STATUS_SUCCESS, message);

                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "area_blocks",
                    message: message,
                    current_id: blockId
                });
            } else {
                let response = {};
                if(isEditable){
                    /** Get area block details **/
                    response = await this.getAreaBlockDetails(req, res, next);
                    if(response.status != Constants.STATUS_SUCCESS){
                        /** Send error response **/
                        return res.status(400).send({
                            status: Constants.STATUS_ERROR,
                            message: response.message
                        });
                    }
                }
                let result = (response.result) ? response.result : {};
                let cityId = (result.city_id) ? new ObjectId(result.city_id) : "";
                let areaId = (result.area_id) ? new ObjectId(result.area_id) : "";

                // Get city list
                const cityList = await getCityList(req, res, next, {city_id: cityId});

                // Get area list if editing
                let areaList = null;
                if(isEditable) {
                    areaList = await getAreaList(req, res, next, {city_id: cityId, area_id: areaId});
                }

                /** Render add edit page  **/
                res.render('add_edit', {
                    layout: false,
                    result: result,
                    is_editable: isEditable,
                    city_list: cityList,
                    area_list: areaList
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for get area list
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return null
     */
    async blockAreaList(req, res, next) {
        try {
            let cityId = req.body.city_id;

            /** Send error response */
            if(!cityId) {
                return res.send({
                    status: Constants.STATUS_ERROR,
                    message: res.__("admin.system.something_going_wrong_please_try_again")
                });
            }

            /** Set options for area list **/
            let options = {city_id: cityId, area_id: ""};

            /** Get area dropdown list **/
            const areaList = await getAreaList(req, res, next, options);
            
            res.send({
                status: Constants.STATUS_SUCCESS,
                area_list: areaList
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for update area block's status
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return null
     */
    async updateAreaBlockStatus(req, res, next) {
        try {
            let blockId = (req.params.id) ? req.params.id : "";
            let blockStatus = (req.params.status == Constants.ACTIVE) ? Constants.DEACTIVE : Constants.ACTIVE;

            /** Update block record **/
            await this.collectionDb.updateOne({
                _id: new ObjectId(blockId)
            }, {
                $set: {
                    is_active: blockStatus,
                    modified: getUtcDate()
                }
            });

            /** save System logs */
            saveSystemLogs(req, res, {
                user_id: req.session.user._id,
                parent_id: blockId,
                activity_module: Constants.SYSTEM_LOG_MODULE_AREA_BLOCKS,
                activity_type: Constants.ACTIVITY_TYPE_STATUS_UPDATE,
                additional_details: {}
            });

            /** Send success response **/
            req.flash(Constants.STATUS_SUCCESS, res.__("admin.area_blocks.block_status_has_been_updated_successfully"));
            res.redirect(Constants.WEBSITE_ADMIN_URL + "area_blocks");
        } catch (error) {
            next(error);
        }
    }
}
export default AreaBlocks; 