import {parallel as asyncParallel } from 'async';
import { ObjectId } from 'mongodb';
import Tables from "../../../../config/database_tables.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import { isPost, configDatatable, sanitizeData, getUtcDate, copyFromParentTable } from "../../../../utils/index.mjs";
import { sendMailToUsers } from "../../../../services/index.mjs";
import BREADCRUMBS from "../../../../breadcrumbs.mjs";

export default class CuisinePriorities {
    constructor(db) {
        this.db = db;
    }

    /**
     * Function to get pending cuisine priorities list
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getPendingCuisinePrioritiesList (req, res, next) {
        try{
            let restaurantId = new ObjectId(req.params.restaurant_id);
            let branchId = new ObjectId(req.params.branch_id);

            if (isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                const collection = this.db.collection(Tables.TMP_RESTAURANT_BRANCH_CUISINES);

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);

                let commonConditions = {restaurant_id : new ObjectId(restaurantId)};
                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

                let dbRes = await collection.aggregate([
                    {$lookup	: {
                        from			: Tables.CUISINES,
                        localField		: "cuisine_id",
                        foreignField	: "_id",
                        as				: "cuisines",
                    }},
                    {$project	: {
                        _id:1, cuisine_id: 1, order: 1, cuisine_name: {$arrayElemAt: ["$cuisines.name", 0]}, restaurant_id: 1, branch_id:1
                    }},
                    {$match: dataTableConfig.conditions },
                    {$facet : {
                        list : [
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit }                            
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
                asyncParallel({
                    restaurant_details: (callback) => {
                        /** Get restaurant details **/
                        const restaurants = this.db.collection(Tables.RESTAURANTS);
                        restaurants.findOne({ _id: restaurantId }, { projection: { _id: 1, name: 1 } }).then(restaurantResult => {
                            callback(null, restaurantResult);
                        }).catch(restaurantErr => {
                            callback(restaurantErr);
                        });
                    },
                    branch_details: (callback) => {
                        /** Get restaurant branch details **/
                        const restaurant_branches = this.db.collection(Tables.RESTAURANT_BRANCHES);
                        restaurant_branches.findOne({ _id: branchId, restaurant_id: restaurantId }, { projection: { _id: 1, cuisine_request_status: 1, rejection_reason: 1, branch_number: 1, name: 1 } }).then(branchResult => {
                            callback(null, branchResult);
                        }).catch(branchErr => {
                            callback(branchErr);
                        });
                    },
                    cuisine_count: (callback) => {
                        /** Get total number of records in restaurant branch cuisines collection **/
                        const restaurant_branch_cuisines = this.db.collection(Tables.RESTAURANT_BRANCH_CUISINES);
                        restaurant_branch_cuisines.countDocuments({ restaurant_id: restaurantId, branch_id: branchId }).then(countResult => {
                            callback(null, countResult);
                        }).catch(countErr => {
                            callback(countErr);
                        });
                    },
                    pending_cuisine_count: (callback) => {
                        /** Get total number of records in pending restaurant branch cuisines collection **/
                        const tmp_restaurant_branch_cuisines = this.db.collection(Tables.TMP_RESTAURANT_BRANCH_CUISINES);
                        tmp_restaurant_branch_cuisines.countDocuments({ restaurant_id: restaurantId, branch_id: branchId }).then(pendingCountResult => {
                            callback(null, pendingCountResult);
                        }).catch(pendingCountErr => {
                            callback(pendingCountErr);
                        });
                    }
                }, (asyncErr, response) => {
                    if (asyncErr) return next(asyncErr);

                    /** Render cuisine priorities listing page **/
                    req.breadcrumbs(BREADCRUMBS['cuisine_priorities/list']);
                    res.render('list', {
                        restaurant_id: restaurantId,
                        branch_id: branchId,
                        restaurant_details: response.restaurant_details,
                        branch_details: response.branch_details,
                        cuisine_count: response.cuisine_count,
                        pending_cuisine_count: response.pending_cuisine_count
                    });
                });
            }
        }catch(err){
            return next(err);
        }
    };//End getPendingCuisinePrioritiesList()

    /**
     * Function to get cuisine priorities list
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getCuisinePrioritiesList (req, res, next) {
        let restaurantId = new ObjectId(req.params.restaurant_id);
        let branchId = new ObjectId(req.params.branch_id);

        if (isPost(req)) {
            let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
            let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
            const collection = this.db.collection(Tables.RESTAURANT_BRANCH_CUISINES);

            /** Configure Datatable conditions*/
			const dataTableConfig = await configDatatable(req, res, null);            
            let commonConditions = {
                restaurant_id: restaurantId,
                branch_id: branchId
            };

            dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

            /** Get list of cuisine priorities  **/
            let dbRes = await collection.aggregate([
				{$lookup: {
					from			: Tables.CUISINES,
					localField		: "cuisine_id",
					foreignField	: "_id",
					as				: "cuisines",
				}},
				{$project: {
                    _id: 1, cuisine_id: 1, order: 1, cuisine_name: { $arrayElemAt: ["$cuisines.name", 0] }, restaurant_id: 1, branch_id: 1
                }},
                {$match: dataTableConfig.conditions },
                {$facet : {
					list : [
						{$sort: dataTableConfig.sort_conditions },
						{$skip: skip },
						{$limit: limit }                            
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
            /** Render cuisine priorities listing page **/
            req.breadcrumbs(BREADCRUMBS['cuisine_priorities/list']);
            res.render('list', {
                restaurant_id: restaurantId,
                branch_id: branchId
            });
        }
    };//End getCuisinePrioritiesList()

    /**
     * Function for reject cuisine priorities
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return null
     */
    async rejectCuisinePriorities (req, res, next) {
        try{
            let restaurantId = new ObjectId(req.params.restaurant_id);
            let branchId     = new ObjectId(req.params.branch_id);
            req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);

            /** For save cuisine priorities status **/
            const restaurant_branches = this.db.collection(Tables.RESTAURANT_BRANCHES);
            await restaurant_branches.updateOne({
                restaurant_id: restaurantId,
                _id: branchId
            },
            {$set: {
                cuisine_request_status: Constants.CUISINE_REQUEST_REJECT,
                rejection_reason: req.body.rejection_reason,
                modified: getUtcDate()
            }});

            /*************** Send notification  ***************/
            sendMailToUsers(req, res, {
                event_type: Constants.NOTIFICATION_CUISINE_PRIORITIES_REJECTED,
                restaurant_id: restaurantId,
                branch_id: branchId
            });
            /*************** Send notification  ***************/

            /** Send success response **/
            req.flash(Constants.STATUS_SUCCESS, res.__("cuisine_priorities.cuisine_priorities_has_been_rejected"));
            res.send({
                status: Constants.STATUS_SUCCESS,
                redirect_url: Constants.WEBSITE_URL + "cuisine_priorities/" + restaurantId + '/' + branchId,
                message: res.__("cuisine_priorities.cuisine_priorities_has_been_rejected")
            });
        }catch(err){
            return next(err);
        }
    };//End rejectCuisinePriorities()

    /**
     * Function to approve cuisine priorities
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async approveCuisinePriorities (req, res, next) {
        try{
            let restaurantId = new ObjectId(req.params.restaurant_id);
            let branchId = new ObjectId(req.params.branch_id);

            /** Delete approved records from restaurant branch cuisines collection if already exists */
            const restaurant_branch_cuisines = this.db.collection(Tables.RESTAURANT_BRANCH_CUISINES);
            await restaurant_branch_cuisines.deleteMany({ restaurant_id: restaurantId, branch_id: branchId });

            /** Copy data  tmp_restaurant_branch_cuisines to  restaurant_branch_cuisines collection*/
            await copyFromParentTable(req, res, next, {
                type: "approve_restaurant_branch_cuisines",
                parent_table: {
                    name: Tables.TMP_RESTAURANT_BRANCH_CUISINES,
                    fields: { _id: 0 },
                    conditions: { branch_id: branchId, restaurant_id: restaurantId },
                    remove_original: true
                },
                child_table: {
                    name: Tables.RESTAURANT_BRANCH_CUISINES,
                    conditions: { branch_id: branchId, restaurant_id: restaurantId },
                }
            });

            if (response.status != Constants.STATUS_SUCCESS) return res.redirect(Constants.WEBSITE_URL + "cuisine_priorities/" + restaurantId + '/' + branchId);

            /** Update main restaurant branch details */
            const restaurant_branches = this.db.collection(Tables.RESTAURANT_BRANCHES);
            await restaurant_branches.updateOne({ _id: branchId, restaurant_id: restaurantId }, { $unset: { cuisine_request_status: 1, rejection_reason: 1 } });
                
            /*************** Send notification  ***************/
                sendMailToUsers(req, res, {
                    event_type: Constants.NOTIFICATION_CUISINE_PRIORITIES_APPROVED,
                    restaurant_id: restaurantId,
                    branch_id: branchId
                });
            /*************** Send notification  ***************/

            /** Send success response **/
            req.flash(Constants.STATUS_SUCCESS, res.__("cuisine_priorities.cuisine_priorities_has_been_accepted_successfully"));
            res.redirect(Constants.WEBSITE_URL + "cuisine_priorities/" + restaurantId + '/' + branchId);
        }catch(err){
            return next(err);
        }
    };//End approveCuisinePriorities()
} 