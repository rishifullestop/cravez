import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, configDatatable } from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

class OrderAssignmentProcess {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.ORDER_ASSIGNMENT_PROCESS_STEP_LOGS);
    }

    /**
     * Function to get order assignment process list
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getOrderAssignmentProcessList(req, res, next) {
        try {
            let orderId = new ObjectId(req.params.order_id);

            if (isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);

                /** Set conditions */
                let commonConditions = { order_id: orderId };
                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

                // Get list or count of order assignment process logs
                let list = await this.collectionDb.aggregate([
                    { $match: dataTableConfig.conditions },
                    {
                        $group: {
                            _id: "$process_id",
                            order_id: { $first: "$order_id" },
                            created: { $min: "$created" },
                            driver_ids: { $push: "$driver_ids" },
                        }
                    },
                    {
                        $addFields: {
                            driver_ids: {
                                $reduce: {
                                    input: "$driver_ids",
                                    initialValue: [],
                                    in: { $concatArrays: ["$$value", "$$this"] }
                                }
                            },
                        }
                    },
                    {
                        $lookup: {
                            from: Tables.USERS,
                            let: { driverIds: "$driver_ids" },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $in: ["$_id", "$$driverIds"] },
                                                { $eq: ["$user_role_id", Constants.DRIVER] },
                                            ],
                                        },
                                    }
                                },
                                {
                                    $project: {
                                        _id: 1, full_name: 1,
                                    }
                                }
                            ],
                            as: "driver_list"
                        }
                    },
                    {
                        $project: {
                            _id: 1, created: 1, order_id: 1, driver_list: 1
                        }
                    },
                    { $sort: dataTableConfig.sort_conditions },
                    { $skip: skip },
                    { $limit: limit },
                ]).toArray();

                // Get total count
                const filteredCount = await this.collectionDb.distinct("process_id", dataTableConfig.conditions);

                /** Send response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data: list || [],
                    recordsFiltered: filteredCount?.length || 0,
                    recordsTotal: filteredCount?.length || 0
                });
            } else {
                /** Get order unique id */
                const orderResult = await this.db.collection(Tables.ORDERS).findOne(
                    { _id: orderId },
                    { projection: { unique_order_id: 1 } }
                );

                if (!orderResult) {
                    /** Send error response */
                    req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
                    return res.redirect(Constants.WEBSITE_ADMIN_URL + 'orders');
                }

                /** render order assignment process listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/order_assignment_process/list']);
                res.render('assignment_process_list', {
                    order_id: orderId,
                    unique_order_id: orderResult?.unique_order_id || ""
                });
            }
        } catch (error) {
            next(error);
        }
    }
}

export default OrderAssignmentProcess; 