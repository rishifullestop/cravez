import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, getDropdownList, newDate } from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { saveSystemLogs } from "../../../../services/index.mjs";

class EmailTemplate {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.EMAIL_TEMPLATES);
    }

    /**
     * Function to get email template list
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getTemplateList(req, res, next) {
        try {
            if(isPost(req)){
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                
                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);

                let commonConditions = {
                    not_shown: { $exists: false }
                };

                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

                // Get list or count of email templates 
                let dbRes = await this.collectionDb.aggregate([
                    {$match: commonConditions},
                    {$lookup: {
                        from: Tables.EMAIL_ACTIONS,
                        localField: "action",
                        foreignField: "action",
                        as: "email_action_details"
                    }},
                    {$project: {
                        _id: 1,subject: 1,is_default: 1,from_date_time: 1,to_date_time: 1, modified: 1,
                        action: {$arrayElemAt: ["$email_action_details.title", 0]}
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
                    data: dbRes?.[0]?.list || [],
                    recordsTotal: dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0,
                }); 
            } else {
                /** render listing page **/
                req.breadcrumbs(BREADCRUMBS["admin/email_template/list"]);
                res.render('list');
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get email template detail
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return json
     */
    async getTemplateDetails(req, res, next) {
        try {
            let templateId = (req.params.id) ? req.params.id : "";

            /** Get email template details **/
            const result = await this.collectionDb.findOne({
                _id: new ObjectId(templateId)
            }, {projection: {_id: 1, subject: 1, channel: 1, action: 1, body: 1, from_date_time: 1, to_date_time: 1, is_default: 1}});

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
     * Function for add or update email template
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async addEditEmailTemplate(req, res, next) {
        try {
            let isEditable = (req.params.id) ? true : false;
            let templateId = (req.params.id) ? new ObjectId(req.params.id) : new ObjectId();

            if(isPost(req)){
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let fromDate 		 = req?.body?.from_date  || "";
                let toDate 			 = req?.body?.to_date 	 || "";
                let bodyInEnglish 	 = req?.body?.body_in_en || "";
                let bodyInArabic  	 = req?.body?.body_in_ar || "";
                let channel          = req?.body?.channel    || [];

                if(bodyInEnglish != "" || bodyInArabic != ""){
                    req.body.body_in_en = bodyInEnglish.replace(new RegExp(/&nbsp;|<br \/\>/g), " ").trim();
                    req.body.body_in_ar = bodyInArabic.replace(new RegExp(/&nbsp;|<br \/\>/g), " ").trim();
                }

                /** Insert channel in a array **/
                if(channel.constructor != Array) channel = [channel];

                /** set data in object **/
                let updateData = {
                    is_default: (req.body.is_default) ? true : false,
                    from_date_time: (!req.body.is_default && fromDate) ? getUtcDate(newDate(fromDate)) : "",
                    to_date_time: (!req.body.is_default && toDate) ? getUtcDate(newDate(toDate)) : "",
                    action: req.body.action,
                    channel: channel,
                    subject: {
                        en: req.body.subject_in_en,
                        ar: req.body.subject_in_ar
                    },
                    body: {
                        en: bodyInEnglish,
                        ar: bodyInArabic
                    },
                    modified: getUtcDate()
                };

                /** Save email template details **/
                await this.collectionDb.updateOne({
                    _id: templateId
                }, {
                    $set: updateData,
                    $setOnInsert: {
                        created: getUtcDate()
                    }
                }, {upsert: true});

                /** save System logs */
                saveSystemLogs(req, res, {
                    user_id: req.session.user._id,
                    parent_id: templateId,
                    activity_module: Constants.SYSTEM_LOG_MODULE_EMAIL_TEMPLATE,
                    activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                    additional_details: {}
                });

                /** Send success response **/
                let message = (isEditable) ? res.__("admin.email_template.email_template_has_been_updated_successfully") : res.__("admin.email_template.email_template_has_been_added_successfully");
                if(!isEditable) req.flash(Constants.STATUS_SUCCESS, message);
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "email_template",
                    message: message,
                    current_id: templateId
                });
            } else {
                let result = {};
                if(isEditable){
                    const response = await this.getTemplateDetails(req, res, next);

                    if(response.status != Constants.STATUS_SUCCESS){
                        req.flash(Constants.STATUS_ERROR, response.message);
                        return res.redirect(Constants.WEBSITE_ADMIN_URL + "email_template");
                    }

                    result = response?.result || {};
                }

                /** Get email action list dropdown **/
                const actionResponse = await getDropdownList(req, res, next, {
                    collections : [{
                        collection: Tables.EMAIL_ACTIONS,
                        columns: ["action","title"],
                        conditions: {},
                        selected: [result?.action || ""]
                    }]
                });

                if(actionResponse.status != Constants.STATUS_SUCCESS){
                    req.flash(Constants.STATUS_ERROR, actionResponse.message);
                    return res.redirect(Constants.WEBSITE_ADMIN_URL + "email_template");
                }

                /** Render add / edit page **/
                req.breadcrumbs(BREADCRUMBS["admin/email_template/"+(isEditable && "edit" || "add")]);
                res.render((isEditable && "edit" || "add"), {
                    result: result,
                    email_action_list: actionResponse?.final_html_data?.[0] || ""
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for get email action options
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getEmailActionOptions(req, res, next) {
        try {
            let emailAction = (req.body.action) ? req.body.action : "";

            /** Send error response **/
            if(!emailAction) {
                return res.send({
                    status: Constants.STATUS_ERROR,
                    message: res.__("admin.system.something_going_wrong_please_try_again")
                });
            }

            /** Get email template details **/
            const result = await this.db.collection(Tables.EMAIL_ACTIONS).findOne({
                action: emailAction
            }, {projection: {_id: 1, options: 1}});

            /** Send Success response */
            res.send({
                status: Constants.STATUS_SUCCESS,
                result: result?.options?.split(",") || []
            });
        } catch (error) {
            next(error);
        }
    }
}

export default EmailTemplate; 