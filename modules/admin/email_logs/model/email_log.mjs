import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, configDatatable, newDate } from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

class EmailLog {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.EMAIL_LOGS);
    }

    /**
     * Function to get email logs list
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async list(req, res, next) {
        try {
            if(isPost(req)){
                let fromDate = (req.body.fromDate) ? req.body.fromDate : "";
                let toDate = (req.body.toDate) ? req.body.toDate : "";
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                
                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);
                
                if(fromDate != "" && toDate != ""){
                    dataTableConfig.conditions['created'] = {
                        $gte: newDate(fromDate),
                        $lte: newDate(toDate),
                    }
                }
                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions);

                let dbRes = await this.collectionDb.aggregate([
                    {$match: dataTableConfig.conditions },
                    {$facet : {
                        list : [
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit },
                            {$project: {_id: 1, from: 1, to: 1, subject: 1, is_sent: 1, created: 1}}
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
                    data: dbRes?.[0]?.list || [],
                    recordsTotal: dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0,
                }); 
            } else {
                /** render listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/email_logs/list']);
                res.render('list');
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for view email logs detail
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render
     */
    async viewDetails(req, res, next) {
        try {
            let emailLogId = (req.params.id) ? req.params.id : "";

            /** Get email logs details **/
            const result = await this.collectionDb.findOne({
                _id: new ObjectId(emailLogId)
            }, {
                projection: {
                    _id: 1,
                    from: 1,
                    to: 1,
                    subject: 1,
                    created: 1,
                    html: 1,
                    attachments: 1,
                    is_sent: 1,
                    error: 1
                }
            });

            if(!result){
                /** Send error response **/
                req.flash(Constants.STATUS_ERROR, res.__("admin.system.invalid_access"));
                return res.redirect(Constants.WEBSITE_ADMIN_URL + "email_logs");
            }

            /** Render view page*/
            req.breadcrumbs(BREADCRUMBS['admin/email_logs/view']);
            res.render('view', {
                result: result,
            });
        } catch (error) {
            next(error);
        }
    }
}

export default EmailLog; 