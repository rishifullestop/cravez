import { ObjectId } from 'mongodb';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, configDatatable, getUniqueId} from '../../../../utils/index.mjs';
import { saveSystemLogs} from "../../../../services/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { each as asyncEach } from 'async';

// Cuisine management class
class Cuisine {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.CUISINES);
    }

    /**
     * Get cuisines list (with datatable support)
     */
    async getCuisinesList(req, res, next) {
        try {
            if(isPost(req)){
                let limit = req.body.length ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = req.body.start ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                const dataTableConfig = await configDatatable(req, res, null);

                // Get list or count of cuisines
                let dbRes = await this.collectionDb.aggregate([
                    { $match: dataTableConfig.conditions },
                    {
                        $facet : {
                            list : [
                                {$sort: dataTableConfig.sort_conditions },
                                {$skip: skip },
                                {$limit: limit },
                                {$project: {_id:1, name:1, cuisine_id:1, is_active:1}}
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
                req.breadcrumbs(BREADCRUMBS['admin/cuisines/list']);
                res.render('list');
            }
        } catch (error) { next(error); }
    }

    /**
     * Get cuisine details by ID
     */
    async getCuisineDetails(req, res, next) {
        try {
            let cuisineId = req.params.id || '';
            const result = await this.collectionDb.findOne({ _id: new ObjectId(cuisineId) }, {projection: {_id:1, name:1}});
            if(!result) {
                return { status: Constants.STATUS_ERROR, message: res.__('admin.system.invalid_access') };
            }
            return { status: Constants.STATUS_SUCCESS, result };
        } catch (error) { next(error); }
    }

    /**
     * Add or edit a cuisine
     */
    async addEditCuisine(req, res, next) {
        try {
            let isEditable = !!req.params.id;
            let cuisineId = req.params.id ? new ObjectId(req.params.id) : new ObjectId();
            if(isPost(req)){
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let nameEnglish = req.body.name_english || '';
                let nameArabic = req.body.name_arabic || '';
                // Unique ID for new
                let cuisineUniqueId = '';
                if(!isEditable) {
                    const uniqueIdResponse = await getUniqueId(req, res, next, {type: 'cuisines'});
                    cuisineUniqueId = uniqueIdResponse.result || '';
                }
                // Save cuisine
                await this.collectionDb.updateOne({
                    _id: cuisineId
                }, {
                    $set: {
                        name: { ar: nameArabic, en: nameEnglish },
                        modified: getUtcDate()
                    },
                    $setOnInsert: {
                        cuisine_id: cuisineUniqueId,
                        is_active: Constants.ACTIVE,
                        created: getUtcDate()
                    }
                }, {upsert: true});
                // System logs
                saveSystemLogs(req, res, {
                    user_id: req.session.user._id,
                    parent_id: cuisineId,
                    activity_module: Constants.SYSTEM_LOG_MODULE_CUISINES,
                    activity_type: Constants.ACTIVITY_TYPE_ADD_EDIT,
                    additional_details: {}
                });
                // Success response
                let message = isEditable ? res.__('admin.cuisines.cuisine_has_been_updated_successfully') : res.__('admin.cuisines.cuisine_has_been_added_successfully');
                if(!isEditable) req.flash(Constants.STATUS_SUCCESS, message);
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + 'cuisines',
                    message,
                    current_id: cuisineId
                });
            } else {
                let response = {};
                if(isEditable){
                    response = await this.getCuisineDetails(req, res, next);
                    if(response.status != Constants.STATUS_SUCCESS){
                        req.flash(Constants.STATUS_ERROR, response.message);
                        return res.redirect(Constants.WEBSITE_ADMIN_URL + 'cuisines');
                    }
                }
                let breadcrumbs = isEditable ? 'admin/cuisines/edit' : 'admin/cuisines/add';
                req.breadcrumbs(BREADCRUMBS[breadcrumbs]);
                res.render('add_edit', {
                    layout: false,
                    result: response.result || {},
                    is_editable: isEditable
                });
            }
        } catch (error) { next(error); }
    }

    /**
     * Update cuisine status (active/deactive)
     */
    async updateCuisineStatus(req, res, next) {
        try {
            let cuisineId = req.params.id || '';
            let cuisineStatus = (req.params.status == Constants.ACTIVE) ? Constants.DEACTIVE : Constants.ACTIVE;
            await this.collectionDb.updateOne({
                _id: new ObjectId(cuisineId)
            }, {
                $set: {
                    is_active: cuisineStatus,
                    modified: getUtcDate()
                }
            });
            saveSystemLogs(req, res, {
                user_id: req.session.user._id,
                parent_id: cuisineId,
                activity_module: Constants.SYSTEM_LOG_MODULE_CUISINES,
                activity_type: Constants.ACTIVITY_TYPE_STATUS_UPDATE,
                additional_details: {}
            });
            req.flash(Constants.STATUS_SUCCESS, res.__('admin.cuisines.cuisine_status_has_been_updated_successfully'));
            res.redirect(Constants.WEBSITE_ADMIN_URL + 'cuisines');
        } catch (error) { next(error); }
    }

    /**
     * Select cuisine priority (order)
     */
    async selectCuisinePriority(req, res, next) {
        try {
            if(isPost(req)){
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let data = req.body.data || '';
                if(!data) return res.send({status: Constants.STATUS_ERROR, message: res.__('admin.system.something_went_wrong')});
                let errors = [];
                let cuisineIds = [];
                if(data.length > 0){
                    data.map((records, index) => {
                        if(records.order){
                            cuisineIds.push({ cuisine_id: new ObjectId(records.cuisine_id), order: parseInt(records.order) });
                            if(!records.order.match(Constants.CUISINE_PRIORITIES_ORDER_REGEX)){
                                errors.push({ 'param': 'order_' + index, 'msg': res.__('admin.cuisines.order_should_be_numeric') });
                            }
                            if(records.order <= 0){
                                errors.push({ 'param': 'order_' + index, 'msg': res.__('admin.cuisines.order_should_be_greater_than_zero') });
                            }
                        }
                    });
                }
                if(errors.length > 0) return res.send({status: Constants.STATUS_ERROR, message: errors});
                if(cuisineIds.length < 0){
                    req.flash(Constants.STATUS_SUCCESS, res.__('admin.cuisines.cuisine_priorities_has_been_added_successfully'));
                    return res.send({
                        status: Constants.STATUS_SUCCESS,
                        message: res.__('admin.cuisines.cuisine_priorities_has_been_added_successfully')
                    });
                }
                asyncEach(cuisineIds, (records, eachCallback) => {
                    this.collectionDb.updateOne({
                        _id: records.cuisine_id
                    }, {
                        $set: {
                            order: records.order,
                            modified: getUtcDate()
                        }
                    }).then(()=>{
                        eachCallback();
                    }).catch(eachCallback);
                }, (asyncErr) => {
                    if(asyncErr) return next(asyncErr);

                    req.flash(Constants.STATUS_SUCCESS, res.__('admin.cuisines.cuisine_priorities_has_been_added_successfully'));
                    res.send({
                        status: Constants.STATUS_SUCCESS,
                        message: res.__('admin.cuisines.cuisine_priorities_has_been_added_successfully')
                    });
                });
            } else {
                /** Get cuisine list */
                let result = await this.collectionDb.aggregate([
                    {$match  : {is_active: Constants.ACTIVE} },
                    {$project: {_id:1, name: 1, order:1}},
                    {$sort   : {[`name.${Constants.DEFAULT_LANGUAGE_CODE}`]: Constants.SORT_ASC, order: Constants.SORT_ASC}},
                ]).toArray();

                if(!result.length){
                    return res.status(400).send({
                        status: Constants.STATUS_ERROR,
                        message: res.__('admin.system.something_going_wrong_please_try_again')
                    });
                }

                /** Render page **/
                res.render('select_cuisine_priority', {
                    layout: false,
                    result: result
                });
            }
        } catch (error) { next(error); }
    }
}

export default Cuisine;