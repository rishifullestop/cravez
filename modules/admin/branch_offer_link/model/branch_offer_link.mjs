import { ObjectId } from 'mongodb';
import { isPost, sanitizeData, getUtcDate, getDropdownList, configDatatable } from "../../../../utils/index.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import Tables from '../../../../config/database_tables.mjs';

class BranchOfferLink {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.BRANCH_OFFER_LINKS);
    }

    async getBranchOfferLinkList(req, res, next) {
        try {
            if (isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                const collection = this.collectionDb;

                // Configure Datatable conditions
                const dataTableConfig = await configDatatable(req, res, null);

                // Get branch offer link list and counts
                const dbRes = await collection.aggregate([
                    { $match: dataTableConfig.conditions },
                    {
                        $facet: {
                            list: [
                                { $sort: dataTableConfig.sort_conditions },
                                { $skip: skip },
                                { $limit: limit },
                                {
                                    $lookup: {
                                        from: Tables.RESTAURANTS,
                                        localField: "restaurant_id",
                                        foreignField: "_id",
                                        as: "restaurant_details"
                                    }
                                },
                                {
                                    $lookup: {
                                        from: Tables.RESTAURANT_BRANCHES,
                                        localField: "branch_id",
                                        foreignField: "_id",
                                        as: "branch_details"
                                    }
                                },
                                {
                                    $lookup: {
                                        from: Tables.AREAS,
                                        localField: "area_id",
                                        foreignField: "_id",
                                        as: "area_details"
                                    }
                                },
                                {
                                    $project: {
                                        _id: 1,
                                        restaurant_id: 1,
                                        branch_id: 1,
                                        area_id: 1,
                                        restaurant_name: { $arrayElemAt: ["$restaurant_details.name." + Constants.DEFAULT_LANGUAGE_CODE, 0] },
                                        branch_name: { $arrayElemAt: ["$branch_details.name." + Constants.DEFAULT_LANGUAGE_CODE, 0] },
                                        area_name: { $arrayElemAt: ["$area_details.name." + Constants.DEFAULT_LANGUAGE_CODE, 0] }
                                    }
                                }
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
                    recordsTotal: dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0
                });
            } else {
                // Set dropdown options
                let options = {
                    collections: [
                        {
                            collection: Tables.RESTAURANTS,
                            columns: ["_id", ["name", Constants.DEFAULT_LANGUAGE_CODE]],
                            conditions: {
                                status: Constants.ACTIVE,
                                is_deleted: Constants.NOT_DELETED
                            },
                        },
                        {
                            collection: Tables.AREAS,
                            columns: ["_id", ["name", Constants.DEFAULT_LANGUAGE_CODE]],
                            conditions: { is_active: Constants.ACTIVE }
                        },
                    ],
                };
                // Get restaurant dropdown list
                const dropDownResponse = await getDropdownList(req, res, next, options);
                if (dropDownResponse.status !== Constants.STATUS_SUCCESS) {
                    req.flash(Constants.STATUS_ERROR, dropDownResponse.message);
                    return res.redirect(Constants.WEBSITE_ADMIN_URL + "dashboard");
                }
                req.breadcrumbs(BREADCRUMBS['admin/branch_offer_link/list']);
                res.render('list', {
                    restaurant_list: dropDownResponse.final_html_data["0"],
                    area_list: dropDownResponse.final_html_data["1"],
                });
            }
        } catch (err) {
            next(err);
        }
    }

    async addBranchOfferLink(req, res, next) {
        try {
            if (isPost(req)) {
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let restaurantId = req.body.restaurant_id;
                let branchIds = req.body.branch_ids;
                if (branchIds.constructor !== Array) branchIds = [branchIds];
                let areaId = req.body.area_id;

                // Set insertable data
                let insertAbleArray = [];
                branchIds.map(tmpBranchId => {
                    insertAbleArray.push({
                        restaurant_id: new ObjectId(restaurantId),
                        branch_id: new ObjectId(tmpBranchId),
                        area_id: new ObjectId(areaId),
                        offer_link: Constants.BRANCH_OFFER_LINK + "&restaurant_id=" + restaurantId + "&branch_id=" + tmpBranchId + "&area_id=" + areaId,
                        created: getUtcDate()
                    });
                });

                // Save branch offer links details
                await this.collectionDb.insertMany(insertAbleArray, { forceServerObjectId: true });

                req.flash(Constants.STATUS_SUCCESS, res.__("admin.branch_offer_link.branch_link_has_been_added_successfully"));
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    message: res.__("admin.branch_offer_link.branch_link_has_been_added_successfully")
                });
            } else {
                // Get restaurant dropdown list
                const dropDownResponse = await getDropdownList(req, res, next, {
                    collections: [
                        {
                            collection: Tables.RESTAURANTS,
                            columns: ["_id", ["name", Constants.DEFAULT_LANGUAGE_CODE]],
                            conditions: {
                                status: Constants.ACTIVE,
                                is_deleted: Constants.NOT_DELETED
                            },
                        },
                        {
                            collection: Tables.AREAS,
                            columns: ["_id", ["name", Constants.DEFAULT_LANGUAGE_CODE]],
                            conditions: { is_active: Constants.ACTIVE }
                        },
                    ],
                });

                if (dropDownResponse.status !== Constants.STATUS_SUCCESS) {
                    return res.status(400).send({ status: Constants.STATUS_ERROR, message: dropDownResponse.message });
                }

                res.render('add', {
                    layout: false,
                    restaurant_list: dropDownResponse.final_html_data["0"],
                    area_list: dropDownResponse.final_html_data["1"],
                });
            }
        } catch (err) {
            next(err);
        }
    }

    async restaurantBranchList(req, res, next) {
        try {
            let restaurantId = req.body.restaurant_id;
            if (!restaurantId) return res.send({ status: Constants.STATUS_ERROR, message: res.__("admin.system.something_going_wrong_please_try_again") });
            let options = {
                collections: [
                    {
                        collection: Tables.RESTAURANT_BRANCHES,
                        columns: ["_id", ["name", Constants.DEFAULT_LANGUAGE_CODE]],
                        conditions: {
                            is_active: Constants.ACTIVE,
                            restaurant_id: new ObjectId(restaurantId)
                        },
                    },
                ],
            };
            const dropDownResponse = await getDropdownList(req, res, next, options);
            res.send({
                status: Constants.STATUS_SUCCESS,
                branch_list: dropDownResponse.final_html_data["0"],
            });
        } catch (err) {
            next(err);
        }
    }
}

export default BranchOfferLink; 