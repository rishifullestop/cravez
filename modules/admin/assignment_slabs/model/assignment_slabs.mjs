import { isPost, sanitizeData, getUtcDate } from "../../../../utils/index.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

class AssignmentSlabs {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.ASSIGNMENT_SLABS);
    }

    /**
     * Function to set assignment slab
     *
     * @param req   As Request Data
     * @param res   As Response Data
     *
     * @return render/json
     */
    async setupDistance(req, res, next) {
        try {
            if(isPost(req)) {
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                let slabData = (req.body.slab_data) ? req.body.slab_data : "";
                let bikeMaxDistance = res.locals.settings["Order_Assignment.bike_max_distance"];
                let carMaxDistance = res.locals.settings["Order_Assignment.car_max_distance"];

                let errors = [];
                let isFound = false;
                let dataToBeSaved = [];
                let uniqueSlab = {};
                const VALID_NUMBER_REGEX = /^\d+(\.\d+)?$/;

                if(slabData.length > 0) {
                    slabData.forEach((data, index) => {
                        if(!data.min_distance && data.max_distance) {
                            errors.push({'param':`slab_data_${index}_min_distance`,'msg':res.__("admin.assignment_slabs.please_enter_min")});
                        } else if(data.min_distance && (!VALID_NUMBER_REGEX.test(data.min_distance) || data.min_distance < 0)) {
                            errors.push({'param':`slab_data_${index}_min_distance`,'msg':res.__("admin.assignment_slabs.invalid_min")});
                        }
                        if(!data.max_distance && data.min_distance) {
                            errors.push({'param':`slab_data_${index}_max_distance`,'msg':res.__("admin.assignment_slabs.please_enter_max")});
                        } else if(data.max_distance && (!VALID_NUMBER_REGEX.test(data.max_distance) || data.max_distance <= 0)) {
                            errors.push({'param':`slab_data_${index}_max_distance`,'msg':res.__("admin.assignment_slabs.invalid_max")});
                        }
                        if(data.min_distance && data.max_distance && parseInt(data.max_distance) <= parseInt(data.min_distance)){
                            errors.push({'param':`slab_data_${index}_max_distance`,'msg':res.__("admin.assignment_slabs.max_should_be_greater")});
                        }
                        if(data.max_distance && parseInt(data.max_distance) > parseInt(bikeMaxDistance) && parseInt(data.max_distance) > parseInt(carMaxDistance)){
                            errors.push({'param':`slab_data_${index}_max_distance`,'msg':res.__("admin.assignment_slabs.max_distance_should_not_greater_order_assignment_distance")});
                        }
                        if(data.min_distance && data.max_distance){
                            let tmpString = data.min_distance+"_"+data.max_distance;
                            if(uniqueSlab[tmpString]){
                                errors.push({'param':`slab_data_${index}_min_distance`,'msg':res.__("admin.assignment_slabs.slab_must_be_unique")});
                            }else{
                                uniqueSlab[tmpString] = true;
                            }
                        }
                        if(data.min_distance || data.max_distance) isFound = true;
                        if(data.min_distance && data.max_distance && errors.length === 0){
                            dataToBeSaved.push({
                                min_distance: parseFloat(data.min_distance),
                                max_distance: parseFloat(data.max_distance),
                                order: parseInt(data.order),
                                created: getUtcDate()
                            });
                        }
                    });
                }

                if(!isFound) errors.push({'param':'slab_data_0_min_distance','msg':res.__("admin.assignment_slabs.enter_atleast_one")});

                /** Send error response */
                if(errors.length > 0) return res.send({status: Constants.STATUS_ERROR, message: errors});

                /** Delete old slabs */
                await this.collectionDb.deleteMany({});
                /** Save updated slabs */
                await this.collectionDb.insertMany(dataToBeSaved, {forceServerObjectId:true});

                /** Send success response */
                req.flash(Constants.STATUS_SUCCESS, res.__("admin.assignment_slabs.slabs_has_been_updated_successfully"));
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + "assignment_slabs"
                });
            } else {
                /** Get assignment slabs list */
                const result = await this.collectionDb.find({}, {projection:{min_distance:1,max_distance:1,order:1}}).sort({order:Constants.SORT_ASC}).toArray();
                /** Render list page */
                req.breadcrumbs(BREADCRUMBS['admin/assignment_slabs/list']);
                res.render('list', {
                    result: result
                });
            }
        } catch (err) {
            next(err);
        }
    }
}

export default AssignmentSlabs; 