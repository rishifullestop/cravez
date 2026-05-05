import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, configDatatable } from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

class PnLogs {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.PN_LOGS);
    }

    /**
     * Function to get Pn logs list
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async list(req, res, next) {
        try {
            if (isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                let deviceSearch = (req.body.device_type_search) ? (req.body.device_type_search) : "";

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);
                
                if (deviceSearch != "") {
                    dataTableConfig.conditions['device_type'] = { $regex: new RegExp(deviceSearch, "i") };
                }

                // Get list or count of pn logs
                let dbRes = await this.collectionDb.aggregate([
                    { $match: dataTableConfig.conditions },
                    {
                        $facet : {
                            list : [
                                {$sort: dataTableConfig.sort_conditions },
                                {$skip: skip },
                                {$limit: limit },
                                {
                                    $lookup: {
                                        from: Tables.USERS,
                                        localField: "user_id",
                                        foreignField: "_id",
                                        as: "user_details",
                                    }
                                },
                                {
                                    $project: {
                                        _id: 1,
                                        device_type: 1,
                                        device_token: 1,
                                        body: 1,
                                        response: 1,
                                        created: 1,
                                        user_name: { $arrayElemAt: ["$user_details.full_name", 0] },
                                    }
                                }
                            ],
                            count: [
                                {$count: "count"},
                            ],
                        }
                    }
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
                /** render listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/pn_logs/list']);
                res.render('list');
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for view Pn logs Detail
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render
     */
    async viewDetails(req, res, next) {
        try {
            let id = (req.params.id) ? req.params.id : "";
            
            if (!id || id == '') {
                req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
                return res.redirect(Constants.WEBSITE_ADMIN_URL + "pn_logs");
            }

            /** Get Pn logs details **/
            const response = await this.getPnLogsDetails(req, res, next);

            if (response.status != Constants.STATUS_SUCCESS) {
               /** Send error response **/
               req.flash(Constants.STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
               res.redirect(Constants.WEBSITE_ADMIN_URL + "pn_logs");
            }
            
            /** Render view page*/
            req.breadcrumbs(BREADCRUMBS['admin/pn_logs/view']);
            res.render('view', {
                result: response.result,
            });
        } catch (error) {
            /** Send error response **/
            req.flash(Constants.STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
            res.redirect(Constants.WEBSITE_ADMIN_URL + "pn_logs");
        }
    }

    /**
     * Function to get pn logs detail
     *
     * @param req	As Request Data
     * @param res	As Response Data
     *
     * @return json
     */
    async getPnLogsDetails(req, res, next) {
        try {
            let id = (req.params.id) ? req.params.id : "";
            
            if (!id || id == '') {
                return {
                    status: Constants.STATUS_ERROR,
                    message: res.__("admin.system.invalid_access")
                };
            }

            /** Get Pn logs details **/
            const result = await this.collectionDb.aggregate([
                { $match: { _id: new ObjectId(id) } },
                {
                    $lookup: {
                        from: Tables.USERS,
                        localField: "user_id",
                        foreignField: "_id",
                        as: "user_details"
                    }
                },
                {
                    $project: {
                        _id: 1,
                        device_type: 1,
                        device_token: 1,
                        body: 1,
                        server_key: 1,
                        request: 1,
                        response: 1,
                        created: 1,
                        user_name: { $arrayElemAt: ["$user_details.full_name", 0] },
                        user_email: { $arrayElemAt: ["$user_details.email", 0] },
                        mobile_number: { $arrayElemAt: ["$user_details.mobile_number", 0] }
                    }
                },
            ]).toArray();

            if (result && result.length > 0) {
                /** Send success response **/
                return {
                    status: Constants.STATUS_SUCCESS,
                    result: result[0]
                };
            } else {
                /** Send error response */
                return {
                    status: Constants.STATUS_ERROR,
                    message: res.__("admin.system.invalid_access")
                };
            }
        } catch (error) {
            /** Send error response */
            return {
                status: Constants.STATUS_ERROR,
                message: res.__("admin.system.invalid_access")
            };
        }
    }
}

export default PnLogs; 