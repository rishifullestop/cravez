import clone from 'clone';

import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, configDatatable, newDate } from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

class ScreenVisitLogs {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.SCREEN_VISIT_LOGS);
        this.userDb = db.collection(Tables.USERS);
    }

    /**
     * Function to get screen visit logs list
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getScreenVisitList(req, res, next) {
        try {
            if (isPost(req)) {
                let fromDate = (req.body.fromDate) ? req.body.fromDate : "";
                let toDate = (req.body.toDate) ? req.body.toDate : "";
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);

                if (fromDate != "" && toDate != "") {
                    dataTableConfig.conditions['date_time'] = {
                        $gte: newDate(fromDate),
                        $lte: newDate(toDate),
                    };
                }

                // Get list or count of screen visit logs
                let dbRes = await this.collectionDb.aggregate([
                    { $match: dataTableConfig.conditions },
                    {
                        $facet: {
                            list: [
                                { $sort: dataTableConfig.sort_conditions },
                                { $skip: skip },
                                { $limit: limit },
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
                                        _id: 1, user_id: 1, screen_name: 1, device_type: 1, channel_id: 1, date_time: 1, device_id: 1, os: 1, os_version: 1, ip: 1, modal: 1,
                                        user_name: { $arrayElemAt: ["$user_details.full_name", 0] }
                                    }
                                }
                            ],
                            count: [
                                { $count: "count" },
                            ],
                        }
                    }
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
                /** render listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/screen_visit_logs/list']);
                res.render('list',{customer_list : '' });
            }
        } catch (error) {
            next(error);
        }
    }

	/**
	 *  Function get user List
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
	*/
	async getUsersList (req, res, next){
        try {
            let limit 	=	(req.body.limit) 	? 	parseInt(req.body.limit) 	:Constants.ADMIN_LISTING_LIMIT;
            let page 	= 	(req.body.page) 	?	parseInt(req.body.page)		:1;
            let name 	= 	(req.body.q) 		?	req.body.q  				:"";
            let skip 	= 	(limit*page)-limit;

            /** Set conditions */
            let conditions = clone(Constants.CUSTOMER_COMMON_CONDITIONS);
            if(name) conditions['full_name'] = { $regex: name, $options: 'i' }

            /** Get user list or count */
            let dbRes = await this.userDb.aggregate([
                {$match: conditions},
                {$facet: {
                    list: [
                        {$sort: {full_name: Constants.SORT_ASC} },
                        {$skip: skip },
                        {$limit: limit },
                        {$project: {
                            _id: 1, full_name: 1, id : "$_id", text : "$full_name"
                        }}
                    ],
                    count: [
                        {$count: "count" },
                    ],
                }}
            ]).toArray();

            /** Send response **/
            res.send({
                status: Constants.STATUS_SUCCESS,
                result: dbRes?.[0]?.list || [],
                total_count: dbRes?.[0]?.count?.[0]?.count || 0
            });
        } catch (error) {
            next(error);
        }
	};//end getUsersList()
}
export default ScreenVisitLogs;