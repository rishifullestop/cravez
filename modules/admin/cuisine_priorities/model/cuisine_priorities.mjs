import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable } from "../../../../utils/index.mjs";
import { saveSystemLogs} from "../../../../services/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

/**
 * Represents Cuisine Priorities functionality.
 */
class CuisinePriorities {
    /**
     * Initializes a new instance of the CuisinePriorities class.
     * @param {object} db - The database connection object.
     */
    constructor(db) {
        this.db = db;
        this.tmpRestaurantBranchCuisines = db.collection(Tables.TMP_RESTAURANT_BRANCH_CUISINES);
        this.restaurantBranchCuisines = db.collection(Tables.RESTAURANT_BRANCH_CUISINES);
        this.restaurants = db.collection(Tables.RESTAURANTS);
        this.restaurantBranches = db.collection(Tables.RESTAURANT_BRANCHES);
        this.cuisines = db.collection(Tables.CUISINES);
        this.restaurantCuisines = db.collection(Tables.RESTAURANT_CUISINES);
    }

    /**
	 * Function to get pending cuisine priorities list
	 *
	 * @param {object} req - Request Data
	 * @param {object} res - Response Data
	 * @param {object} next - Next function
	 *
	 * @return {object} render/json
	 */
	async getPendingCuisinePrioritiesList(req, res, next) {
        try {
            const restaurantId = new ObjectId(req.params.restaurant_id);
            const branchId = new ObjectId(req.params.branch_id);

            if (isPost(req)) {
                const limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                const skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;

                const dataTableConfig = await configDatatable(req, res, null);
                const commonConditions = {
                    restaurant_id: restaurantId,
                    branch_id: branchId
                };
                dataTableConfig.conditions = { ...dataTableConfig.conditions, ...commonConditions };

                const dbRes = await this.tmpRestaurantBranchCuisines.aggregate([
                    {
                        $lookup: {
                            from: Tables.CUISINES,
                            localField: "cuisine_id",
                            foreignField: "_id",
                            as: "cuisines",
                        }
                    },
                    { $project: { _id: 1, cuisine_id: 1, order: 1, cuisine_name: { $arrayElemAt: ["$cuisines.name", 0] }, restaurant_id: 1, branch_id: 1 } },
                    { $match: dataTableConfig.conditions },
                    {
                        $facet: {
                            list: [
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
                    data: dbRes?.[0]?.list || [],
                    recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsTotal: dbRes?.[0]?.count?.[0]?.count || 0
                });
            } else {
                const [restaurantDetails, branchDetails, cuisineCount, pendingCuisineCount] = await Promise.all([
                    this.restaurants.findOne({ _id: restaurantId }, { projection: { _id: 1, name: 1 } }),
                    this.restaurantBranches.findOne({ restaurant_id: restaurantId, _id: branchId }, { projection: { _id: 1, cuisine_request_status: 1, rejection_reason: 1, branch_number: 1, name: 1 } }),
                    this.restaurantBranchCuisines.countDocuments({ restaurant_id: restaurantId, branch_id: branchId }),
                    this.tmpRestaurantBranchCuisines.countDocuments({ restaurant_id: restaurantId, branch_id: branchId }),
                ]);

                req.breadcrumbs(BREADCRUMBS['admin/cuisine_priorities/list']);
                res.render('list', {
                    restaurant_id: restaurantId,
                    branch_id: branchId,
                    restaurant_details: restaurantDetails,
                    branch_details: branchDetails,
                    cuisine_count: cuisineCount,
                    pending_cuisine_count: pendingCuisineCount
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
	 * Function to get cuisine priorities list
	 *
	 * @param {object} req - Request Data
	 * @param {object} res - Response Data
     * @param {object} next - Next function
	 *
	 * @return {object} render/json
	 */
	async getCuisinePrioritiesList(req, res, next) {
        try {
            const restaurantId = new ObjectId(req.params.restaurant_id);
            const branchId = new ObjectId(req.params.branch_id);

            if (isPost(req)) {
                const limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                const skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;

                const dataTableConfig = await configDatatable(req, res, null);
                const commonConditions = {
                    restaurant_id: restaurantId,
                    branch_id: branchId
                };
                dataTableConfig.conditions = { ...dataTableConfig.conditions, ...commonConditions };

                const dbRes = await this.restaurantBranchCuisines.aggregate([
                    {
                        $lookup: {
                            from: Tables.CUISINES,
                            localField: "cuisine_id",
                            foreignField: "_id",
                            as: "cuisines",
                        }
                    },
                    { $project: { _id: 1, cuisine_id: 1, order: 1, cuisine_name: { $arrayElemAt: ["$cuisines.name", 0] }, restaurant_id: 1, branch_id: 1 } },
                    { $match: dataTableConfig.conditions },
                    {
                        $facet: {
                            list: [
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
                    data: dbRes?.[0]?.list || [],
                    recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsTotal: dbRes?.[0]?.count?.[0]?.count || 0
                });
            } else {

                const [restaurantDetails, branchDetails, cuisineCount, pendingCuisineCount] = await Promise.all([
                    this.restaurants.findOne({ _id: restaurantId }, { projection: { _id: 1, name: 1 } }),
                    this.restaurantBranches.findOne({ restaurant_id: restaurantId, _id: branchId }, { projection: { _id: 1, cuisine_request_status: 1, rejection_reason: 1, branch_number: 1, name: 1 } }),
                    this.restaurantBranchCuisines.countDocuments({ restaurant_id: restaurantId, branch_id: branchId }),
                    this.tmpRestaurantBranchCuisines.countDocuments({ restaurant_id: restaurantId, branch_id: branchId }),
                ]);
                req.breadcrumbs(BREADCRUMBS['admin/cuisine_priorities/list']);
                res.render('list', {
                    restaurant_id: restaurantId,
                    branch_id: branchId,
                    restaurant_details: restaurantDetails,
                    branch_details: branchDetails,
                    cuisine_count: cuisineCount,
                    pending_cuisine_count: pendingCuisineCount
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
	* Function for select cuisine priority
	*
	* @param {object} req - Request Data
	* @param {object} res - Response Data
	* @param {object} next - Next function
	*
	* @return {object} render/json
	*/
	async selectCuisinePriority(req, res, next) {
        try {
            const restaurantId = new ObjectId(req.params.restaurant_id);
            const branchId = new ObjectId(req.params.branch_id);

            if (isPost(req)) {
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                const data = req.body.data || [];
                const errors = [];
                const cuisineIds = [];
                let checked = false;

                if (data.length > 0) {
                    data.forEach((record, index) => {
                        if (record.cuisine_id) {
                            cuisineIds.push(new ObjectId(record.cuisine_id));
                            checked = true;
                            if (record.order === "") {
                                errors.push({ 'param': `order_${index}`, 'msg': res.__("admin.cuisine_priorities.please_enter_atleast_one_order") });
                            }
                            if (record.order !== "" && !String(record.order).match(Constants.CUISINE_PRIORITIES_ORDER_REGEX)) {
                                errors.push({ 'param': `order_${index}`, 'msg': res.__("admin.cuisine_priorities.order_should_be_numeric") });
                            }
                            if (record.order !== "" && Number(record.order) <= 0) {
                                errors.push({ 'param': `order_${index}`, 'msg': res.__("admin.cuisine_priorities.order_should_be_greater_than_zero") });
                            }
                        }
                    });
                }

                if (!checked) {
                    errors.push({ 'param': "cuisine_id", 'msg': res.__("admin.cuisine_priorities.please_select_atleast_one_cuisines") });
                }

                if (errors.length > 0) return res.send({ status: Constants.STATUS_ERROR, message: errors });

                await this.tmpRestaurantBranchCuisines.deleteMany({ restaurant_id: restaurantId, branch_id: branchId, cuisine_id: { $nin: cuisineIds } });

                const updatedData = data
                    .filter(record => record.cuisine_id && record.order !== "")
                    .map(record => ({
                        updateOne: {
                            filter: { cuisine_id: new ObjectId(record.cuisine_id), restaurant_id: restaurantId, branch_id: branchId },
                            update: {
                                $set: { order: parseInt(record.order), modified: getUtcDate() },
                                $setOnInsert: { created: getUtcDate() }
                            },
                            upsert: true
                        }
                    }));

                if (updatedData.length > 0) {
                    await this.tmpRestaurantBranchCuisines.bulkWrite(updatedData);
                }

                await this.restaurantBranches.updateOne(
                    { restaurant_id: restaurantId, _id: branchId },
                    { $set: { cuisine_request_status: Constants.CUISINE_REQUEST_PENDING, modified: getUtcDate() } }
                );

                saveSystemLogs(req, res, {
                    user_id: req.session.user._id,
                    parent_id: branchId,
                    activity_module: Constants.SYSTEM_LOG_MODULE_CUISINE_PRIORITIES,
                    activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                    additional_details: {
                        restaurant_id: restaurantId,
                        branch_id: branchId,
                        cuisine_ids: cuisineIds
                    }
                });

                // This function is not defined in the provided context, assuming it exists elsewhere
                // sendMailToUsers(req, res, {
                //     event_type: Constants.NOTIFICATION_CUISINE_PRIORITIES_SEND_FOR_APPROVAL,
                //     restaurant_id: restaurantId,
                //     branch_id: branchId
                // });

                req.flash(Constants.STATUS_SUCCESS, res.__("admin.cuisine_priorities.cuisine_priority_has_been_selected_successfully"));
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: `${Constants.WEBSITE_ADMIN_URL}cuisine_priorities/${restaurantId}/${branchId}`,
                    message: res.__("admin.cuisine_priorities.cuisine_priority_has_been_selected_successfully")
                });

            } else {
                const restaurantCuisineIds = await this.restaurantCuisines.distinct("cuisine_id", { restaurant_id: restaurantId });

                let collection = this.tmpRestaurantBranchCuisines;
                const count = await collection.countDocuments({ restaurant_id: restaurantId, branch_id: branchId });
                if (count <= 0) {
                    collection = this.restaurantBranchCuisines;
                }

                const [cuisines, selectedCuisines, cuisineCount] = await Promise.all([
                    this.cuisines.find(
                        { _id: { $in: restaurantCuisineIds }, is_active: Constants.ACTIVE },
                        { projection: { _id: 1, name: 1 } }
                    ).collation({ locale: "en" }).sort({ "name": 1 }).toArray(),
                    collection.find({ restaurant_id: restaurantId, branch_id: branchId }, { projection: { _id: 1, cuisine_id: 1, order: 1 } }).toArray(),
                    this.restaurantBranchCuisines.countDocuments({ restaurant_id: restaurantId, branch_id: branchId }),
                ]);

                const selectedCuisinesMap = selectedCuisines.reduce((map, item) => {
                    map[item.cuisine_id.toString()] = item.order;
                    return map;
                }, {});

                cuisines.forEach(cuisine => {
                    const order = selectedCuisinesMap[cuisine._id.toString()];
                    if (order) {
                        cuisine.order = order;
                    }
                });

                res.render('select_cuisine_priority', {
                    layout: false,
                    result: cuisines,
                    selected_cuisines: selectedCuisines,
                    restaurant_id: restaurantId,
                    branch_id: branchId,
                    cuisine_count: cuisineCount
                });
            }
        } catch (error) {
            next(error);
        }
    }
}

export default CuisinePriorities;