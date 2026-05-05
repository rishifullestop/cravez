import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, getRestaurantDropdowns, getRestaurantDetails, arrayToObject } from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

class RestaurantCuisine {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.RESTAURANT_CUISINES);
    }

    /**
     * Function to get listing page
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getRestaurantCuisinesList(req, res, next) {
        try {
            let slug = req.params.slug ? req.params.slug : "";

            const restaurantList = await getRestaurantDropdowns(req, res, next, { slug: slug });
            
            /** Render restaurant cuisine list page **/
            req.breadcrumbs(BREADCRUMBS['admin/restaurant_cuisines/list']);
            res.render('list', {
                restaurant_list: restaurantList,
                restaurant_slug: slug
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get cuisines list according to the restaurant
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async appendCuisinesList(req, res, next) {
        try {
            let slug = req?.params?.slug || "";

            if (isPost(req)) {
                let limit = (req?.body?.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req?.body?.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                let restaurantId = req?.body?.id ? new ObjectId(req.body.id) : "";

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);

                let commonConditions = { restaurant_id: new ObjectId(restaurantId) };
                dataTableConfig.conditions = Object.assign(commonConditions, dataTableConfig.conditions);

                // Get list or count of restaurant cuisines
                let dbRes = await this.collectionDb.aggregate([
                    {$lookup: {
                        from: Tables.CUISINES,
                        localField: "cuisine_id",
                        foreignField: "_id",
                        as: "cuisines",
                    }},
                    {$project: { _id: 1, cuisine_id: 1, cuisine_name: { $arrayElemAt: ["$cuisines.name", 0]}, restaurant_id: 1}},
                    {$match: dataTableConfig.conditions },
                    {$facet : {
                        list : [
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit },                           
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
                /** Get restaurant details**/
                const restaurantResponse = await getRestaurantDetails(req, res, next, { slug: slug });
                
                /** Send error response **/
                if (restaurantResponse.status != Constants.STATUS_SUCCESS) {
                    return res.status(400).send({
                        status: Constants.STATUS_ERROR,
                        message: restaurantResponse.message
                    });
                }

                /** Render cuisines list page **/
                res.render('cuisines_list', {
                    layout: false,
                    restaurantId: restaurantResponse.result._id,
                    slug: slug
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for add restaurant cuisines
     *
     * @param req 	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async selectRestaurantCuisines(req, res, next) {
        try {
            let restaurantId = new ObjectId(req.params.id);
            let slug = req.params.slug;

            if (isPost(req)) {
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let cuisineIds = (req?.body?.cuisine_id) ? req.body.cuisine_id : [];

                /** Check validation **/
                if (cuisineIds.length == 0) {
                    return res.send({status: Constants.STATUS_ERROR, message: [
                        { 'param': Constants.ADMIN_GLOBAL_ERROR, 'msg': res.__("admin.restaurant_cuisines.please_select_atleast_one_cuisines")}
                    ]});
                }

                let cuisinesObject = arrayToObject(cuisineIds);

                // Delete existing cuisines that are not in the new selection
                await this.collectionDb.deleteMany({
                    restaurant_id: restaurantId,
                    cuisine_id: { $nin: cuisinesObject }
                });

                /** Set updated data */
                let updatedData = cuisinesObject.map(cuisineId => {
                    return {
                        updateOne: {
                            "filter": { restaurant_id: restaurantId, cuisine_id: cuisineId },
                            "update": {
                                $set: { modified: getUtcDate() },
                                $setOnInsert: {
                                    created: getUtcDate(),
                                }
                            },
                            "upsert": true
                        }
                    };
                });

                /** for Save new selected restaurant cuisine details **/
                await this.collectionDb.bulkWrite(updatedData);
                
                /** Send success response */
                req.flash(Constants.STATUS_SUCCESS, res.__("admin.restaurant_cuisines.cuisines_has_been_selected_successfully"));
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    message: res.__("admin.restaurant_cuisines.cuisines_has_been_selected_successfully")
                });
            } else {
                // Get cuisines list for show in modal
                const cuisines = await this.db.collection(Tables.CUISINES).find(
                    { is_active: Constants.ACTIVE },
                    { projection: { _id: 1, name: 1 } }
                ).sort({ "name": Constants.SORT_ASC }).toArray();

                // Get selected cuisines
                const selectedCuisines = await this.collectionDb.find(
                    { restaurant_id: restaurantId },
                    { projection: { _id: 1, cuisine_id: 1 } }
                ).toArray();

                /** Render select cuisines page  **/
                res.render('select_cuisines', {
                    layout: false,
                    result: cuisines,
                    selected_cuisines: selectedCuisines,
                    restaurant_id: restaurantId,
                    slug: slug
                });
            }
        } catch (error) {
            next(error);
        }
    }
}
export default RestaurantCuisine; 