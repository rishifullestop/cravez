import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, getDropdownList } from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { saveSystemLogs } from "../../../../services/index.mjs";

class Faq {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.FAQS);
    }

    /**
     * Function to get FAQ list
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getFaqList(req, res, next) {
        try {
            if(isPost(req)){
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                
                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);

                // Get list or count of FAQs 
                let dbRes = await this.collectionDb.aggregate([
                    { $match: dataTableConfig.conditions },
                    {$facet : {
                        list : [
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit },
                            {$lookup: {
                                from: Tables.MASTERS,
                                localField: "category_id",
                                foreignField: "_id",
                                as: "category_details"
                            }},
                            {$lookup: {
                                from: Tables.MASTERS,
                                localField: "sub_category_id",
                                foreignField: "_id",
                                as: "sub_category_details"
                            }},
                            {$project: {
                                _id: 1,
                                question: 1,
                                answer: 1,
                                modified: 1,
                                is_active: 1,
                                category_name: {$arrayElemAt: ["$category_details.name", 0]},
                                sub_category_name: {$arrayElemAt: ["$sub_category_details.name", 0]}
                            }}
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
                /** Get FAQ category dropdown list **/
                const response = await getDropdownList(req, res, next, {
                    collections : [{
                        collection: Tables.MASTERS,
                        columns: ["_id","name"],
                        conditions: {dropdown_type: "faq_category", parent_id: "", status: Constants.ACTIVE},
                    }]
                });
                
                if(response.status != Constants.STATUS_SUCCESS){
                    /** Send error response **/
                    req.flash(Constants.STATUS_ERROR, response.message);
                    return res.redirect(Constants.WEBSITE_ADMIN_URL + 'dashboard');
                }
                
                /** render FAQ listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/faq/list']);
                res.render('list', {
                    category_list: response?.final_html_data?.[0] || ""
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function to get FAQ detail
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return json
     */
    async getFaqDetails(req, res, next) {
        try {
            let faqId = (req.params.id) ? req.params.id : "";

            /** Get FAQ details **/
            const result = await this.collectionDb.findOne({
                _id: new ObjectId(faqId)
            }, {projection: {_id: 1, question: 1, faq_channel: 1, answer: 1, modified: 1, category_id: 1, sub_category_id: 1}});

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
     * Function for add or update FAQ
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async addEditFaq(req, res, next) {
        try {
            let isEditable = (req.params.id) ? true : false;
            let faqId = (req.params.id) ? new ObjectId(req.params.id) : new ObjectId();

            if(isPost(req)){
                /** Sanitize Data **/
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let answerInEnglish = (req.body.answer_in_english) ? req.body.answer_in_english : "";
                let answerInArabic = (req.body.answer_in_arabic) ? req.body.answer_in_arabic : "";

                if(answerInEnglish != "") req.body.answer_in_english = answerInEnglish.replace(new RegExp(/&nbsp;|<br \/\>/g), ' ').trim();
                if(answerInArabic != "") req.body.answer_in_arabic = answerInArabic.replace(new RegExp(/&nbsp;|<br \/\>/g), ' ').trim();

                /** set data in object **/
                let updateData = {
                    question: {
                        en: req.body.question_in_english,
                        ar: req.body.question_in_arabic
                    },
                    answer: {
                        en: answerInEnglish,
                        ar: answerInArabic
                    },
                    category_id: new ObjectId(req.body.category_id),
                    sub_category_id: new ObjectId(req.body.sub_category_id),
                    faq_channel: req.body.faq_channel,
                    modified: getUtcDate()
                };

                /** Save FAQ details **/
                await this.collectionDb.updateOne({
                    _id: faqId
                }, {
                    $set: updateData,
                    $setOnInsert: {
                        is_active: Constants.ACTIVE,
                        created: getUtcDate()
                    }
                }, {upsert: true});

                /** save System logs */
                saveSystemLogs(req, res, {
                    user_id: req.session.user._id,
                    parent_id: faqId,
                    activity_module: Constants.SYSTEM_LOG_MODULE_FAQ,
                    activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                    additional_details: {}
                });

                /** Send success response **/
                let message = (isEditable) ? res.__("admin.faq.faq_has_been_updated_successfully") : res.__("admin.faq.faq_has_been_added_successfully");
                req.flash(Constants.STATUS_SUCCESS, message);
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "faqs",
                    message: message,
                    current_id: faqId
                });
            } else {
                let faqDetails = {};
                if(isEditable){
                    /**`Get FAQ details **/
                    const resultResponse = await this.getFaqDetails(req, res, next);
                    
                    /** Send error response if error occurs **/
                    if(resultResponse.status != Constants.STATUS_SUCCESS){
                        req.flash(Constants.STATUS_ERROR, resultResponse.message);
                        return res.redirect(Constants.WEBSITE_ADMIN_URL + 'faqs');
                    }

                    faqDetails = resultResponse?.result || {};
                }

                let categoryId      = faqDetails?.category_id || "";
                let subCategoryId   = faqDetails?.sub_category_id ||"";

                /** Set options of FAQ category **/
                let dropdownOptions = {
                    collections : [{
                        collection: Tables.MASTERS,
                        columns: ["_id","name"],
                        selected: [categoryId],
                        conditions: {
                            parent_id: "",
                            dropdown_type: "faq_category",
                            $or: [
                                {status: Constants.ACTIVE},
                                {_id: categoryId}
                            ],  
                        }
                    }]
                };

                if(isEditable){
                    dropdownOptions.collections.push({
                        collection: Tables.MASTERS,
                        columns: ["_id","name"],
                        selected: [subCategoryId],
                        conditions: {
                            parent_id: categoryId,
                            dropdown_type: "faq_category",
                            $or: [
                                {status: Constants.ACTIVE},
                                {_id: subCategoryId}
                            ]
                        }
                    });
                }

                /** Get FAQ category dropdown list **/
                const dropdownResponse = await getDropdownList(req, res, next, dropdownOptions);
                    
                if(dropdownResponse.status != Constants.STATUS_SUCCESS){
                    /** Send error response **/
                    req.flash(Constants.STATUS_ERROR, dropdownResponse.message);
                    return res.redirect(Constants.WEBSITE_ADMIN_URL + 'faqs');
                }

                /** Render edit page  **/
                req.breadcrumbs(BREADCRUMBS['admin/faq/'+(isEditable && 'edit' || 'add')]);
                res.render((isEditable && 'edit' || 'add'), {
                    result: faqDetails,
                    category_list: dropdownResponse?.final_html_data?.[0] || "",
                    sub_category_list: dropdownResponse?.final_html_data?.[1] || ""
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for delete FAQs
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async faqDelete(req, res, next) {
        try {
            let faqId = (req.params.id) ? new ObjectId(req.params.id) : "";

            /** Remove FAQ record **/
            await this.collectionDb.deleteOne({ _id: faqId });
            
            /** save System logs */
            saveSystemLogs(req, res, {
                user_id: req.session.user._id,
                parent_id: faqId,
                activity_module: Constants.SYSTEM_LOG_MODULE_FAQ,
                activity_type: Constants.ACTIVITY_TYPE_DELETE,
                additional_details: {}
            });
            
            /** Send success response **/
            req.flash(Constants.STATUS_SUCCESS, res.__("admin.faq.faq_deleted_successfully"));
            res.redirect(Constants.WEBSITE_ADMIN_URL + 'faqs');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for update FAQ's status
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return null
     */
    async updateFaqStatus(req, res, next) {
        try {
            let faqId = (req.params.id) ? new ObjectId(req.params.id) : "";
            let faqStatus = (req.params.status == Constants.ACTIVE) ? Constants.DEACTIVE : Constants.ACTIVE;

            /** Update FAQ record **/
            await this.collectionDb.updateOne({
                _id: faqId
            }, {
                $set: {
                    is_active: faqStatus,
                    modified: getUtcDate()
                }
            });
            
            /** save System logs */
            saveSystemLogs(req, res, {
                user_id: req.session.user._id,
                parent_id: faqId,
                activity_module: Constants.SYSTEM_LOG_MODULE_FAQ,
                activity_type: Constants.ACTIVITY_TYPE_STATUS_UPDATE,
                additional_details: {}
            });
            
            /** Send success response **/
            req.flash(Constants.STATUS_SUCCESS, res.__("admin.faq.faq_status_has_been_updated_successfully"));
            res.redirect(Constants.WEBSITE_ADMIN_URL + "faqs");
        } catch (error) {
            next(error);
        }
    }

    /**
     * Function for get sub category list
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return null
     */
    async faqSubCategory(req, res, next) {
        try {
            let parentId = req.body.parent_id ? new ObjectId(req.body.parent_id) : "";

            /** Send error response */
            if(!parentId) {
                return res.send({
                    status: Constants.STATUS_ERROR, 
                    message: res.__("admin.system.something_going_wrong_please_try_again")
                });
            }

            /** Set options of FAQ sub category **/
            let options = {
                collections : [{
                    collection: Tables.MASTERS,
                    columns: ["_id","name"],
                    conditions: {status: Constants.ACTIVE, parent_id: parentId, dropdown_type: "faq_category"}
                }]
            };

            /** Get FAQ sub category dropdown list **/
            const response = await getDropdownList(req, res, next, options);
            
            /** Send error response **/
            if(response.status != Constants.STATUS_SUCCESS) {
                return res.send({
                    status: Constants.STATUS_ERROR, 
                    message: response.message
                });
            }

            res.send({
                status: Constants.STATUS_SUCCESS,
                sub_category_list: response?.final_html_data?.[0] || ""
            });
        } catch (error) {
            next(error);
        }
    }
}

export default Faq; 