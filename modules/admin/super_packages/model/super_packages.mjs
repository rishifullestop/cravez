import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, newDate } from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { saveSystemLogs } from "../../../../services/index.mjs";

class SuperPackages {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.PACKAGES);
    }

    /**
     * Function to get super package list
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getPackageList(req, res, next) {
        try {
            if (isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                let fromDate = req?.body?.fromDate || "";
                let toDate = req?.body?.toDate || "";

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);

                /** Condition for date */
                if (fromDate != "" && toDate != "") {
                    dataTableConfig.conditions["$or"] = [
                        {
                            $and: [
                                { valid_from: { $gte: newDate(fromDate) } },
                                { valid_to: { $lte: newDate(toDate) } }
                            ]
                        },
                        {
                            $and: [
                                { valid_to: { $gte: newDate(fromDate) } },
                                { valid_from: { $lte: newDate(toDate) } }
                            ]
                        }
                    ];
                }

                // Get list or count of packages
                let dbRes = await this.collectionDb.aggregate([
                    {$match: dataTableConfig.conditions },
                    {$facet: {
                        list: [
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit },
                            {$project: {
                                _id:1,title:1,valid_from:1,valid_to:1,amount:1,number_of_orders:1,days:1,name:1
                            }}
                        ],
                        count: [
                            { $count: "count" },
                        ]
                    }}
                ]).toArray();

                /** Send response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data: dbRes?.[0]?.list || [],
                    recordsTotal: dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0,
                });
            } else {
                /** render package listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/super_packages/list']);
                res.render('list');
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get package detail
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return json
     */
    async getPackageDetails(req, res, next) {
        try {
            /** Get package details **/
            const packageResult = await this.collectionDb.findOne(
                { _id: new ObjectId(req.params.id) },
                {
                    projection: {
                        _id: 1, valid_from: 1, valid_to: 1, amount: 1, title: 1, 
                        number_of_orders: 1, days: 1, tags: 1, name: 1
                    }
                }
            );

            /** Send error response */
            if (!packageResult) {
                return {
                    status: Constants.STATUS_ERROR,
                    message: res.__("admin.system.invalid_access")
                };
            }

            /** Send success response **/
            return {
                status: Constants.STATUS_SUCCESS,
                result: packageResult
            };
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for add and edit package
     *
     * @param req 	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async addEditSuperPackage(req, res, next) {
        try {
            let isEditable = (req.params.id) ? true : false;
            let packageId = (req.params.id) ? new ObjectId(req.params.id) : new ObjectId();
            let authId = (req.session.user._id) ? req.session.user._id : "";

            if (isPost(req)) {
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let amount = req?.body?.amount || "";
                let numberOfOrders = req?.body?.number_of_orders || 0;
                let days = req?.body?.days || 0;

                let validFrom = newDate(req?.body?.valid_from, Constants.DATABASE_DATE_FORMAT);
                let validTo = newDate(req?.body?.valid_to, Constants.DATABASE_DATE_FORMAT);

                /** Add and edit packages details **/
                await this.collectionDb.updateOne(
                    { _id: packageId },
                    {
                        $set: {
                            tags: (req.body.tags) ? req.body.tags : '',
                            days: parseInt(days),
                            valid_from: getUtcDate(validFrom + " " + Constants.START_DATE_TIME_FORMAT),
                            valid_to: getUtcDate(validTo + " " + Constants.END_DATE_TIME_FORMAT),
                            title: req?.body?.title_in_en || "",
                            name: {
                                en: req?.body?.title_in_en || "",
                                ar: req?.body?.title_in_ar || ""
                            },
                            amount: parseFloat(amount),
                            number_of_orders: (numberOfOrders) ? parseInt(numberOfOrders) : "",
                            modified: getUtcDate()
                        },
                        $setOnInsert: {
                            added_by: new ObjectId(authId),
                            created: getUtcDate(),
                        }
                    },
                    { upsert: true }
                );

                /**For success message */
                let message = (isEditable) ? res.__("admin.super_packages.package_has_been_updated_successfully") : res.__("admin.super_packages.package_has_been_added_successfully");
                if (!isEditable) req.flash(Constants.STATUS_SUCCESS, message);
                
                /** Send success response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "super_packages",
                    message: message,
                });

                /** save System logs */
                saveSystemLogs(req, res, {
                    user_id: authId,
                    parent_id: packageId,
                    activity_module: Constants.SYSTEM_LOG_MODULE_SUPER_PACKAGES,
                    activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                    additional_details: {}
                });
            } else {
                let response = {};
                if (isEditable) {
                    /** Get package details **/
                    response = await this.getPackageDetails(req, res, next);
                    
                    /** Send error response **/
                    if (response.status != Constants.STATUS_SUCCESS) {
                        return res.status(400).send({status: Constants.STATUS_ERROR, message: response.message});
                    }
                }

                /** Render add_edit page  **/
                res.render('add_edit', {
                    result: response?.result || {},
                    is_editable: isEditable,
                    layout: false
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for delete package
     *
     * @param req 	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return null
     */
    async deletePackage(req, res, next) {
        try {
            /**For delete package */
            await this.collectionDb.deleteOne({ _id: new ObjectId(req.params.id) });

            /** Send success response **/
            req.flash(Constants.STATUS_SUCCESS, res.__("admin.super_packages.package_deleted_successfully"));
            res.redirect(Constants.WEBSITE_ADMIN_URL + "super_packages");

            /** save System logs */
            saveSystemLogs(req, res, {
                user_id: req.session.user._id,
                parent_id: req.params.id,
                activity_module: Constants.SYSTEM_LOG_MODULE_SUPER_PACKAGES,
                activity_type: Constants.ACTIVITY_TYPE_DELETE,
                additional_details: {}
            });
        } catch (error) {
            next(error);
        }
    }
}
export default SuperPackages; 