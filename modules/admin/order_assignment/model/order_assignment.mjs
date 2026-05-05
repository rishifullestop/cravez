import {parallel as asyncParallel} from 'async';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, configDatatable, getDropdownList } from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

class OrderAssignment {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.ORDER_ASSIGNMENT_LOGS);
    }

    /**
     * Function to get order assignment list
     *
     * @param req	As Request Data
     * @param res	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getOrderAssignmentList(req, res, next) {
        try {
            if (isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;

                /** Configure Datatable conditions*/
                const dataTableConfig = await configDatatable(req, res, null);

                // Get list or count of order assignment logs
                let dbRes = await this.collectionDb.aggregate([
                    {$lookup : {
                        from 		 : Tables.ORDERS,
                        localField 	 : "order_id",
                        foreignField : "_id",
                        as 			 : "order_details"
                    }},
                    {$addFields : {
                        unique_order_id: {$arrayElemAt : ["$order_details.unique_order_id",0]}
                    }},    
                    {$match: dataTableConfig.conditions },
                    {$facet : {
                        list : [
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit },
                            {$lookup: {
                                from: Tables.USERS,
                                localField: "captain_id",
                                foreignField: "_id",
                                as: "captain_details"
                            }},
                            {$project : {
                                _id:1,created:1,current_status:1,captain_id:1,order_id:1,assignment_type:1,delivery_area_id:1,request_assigned_by:1,unique_order_id: 1, 
                                captain_name: {$arrayElemAt : ["$captain_details.full_name",0]},
                            }}
                        ],
                        count: [
                            {$count: "count"},
                        ],
                    }}
                ]).toArray();

                /** Push delivery area id and request assigned by id in a array **/
                let result              = dbRes?.[0]?.list || [];
                let deliveryAreaIds 	= [];
                let requestAssignedByIds= [];
                result.forEach(record=>{
                    if(record?.delivery_area_id)     deliveryAreaIds.push(record.delivery_area_id);
                    if(record?.request_assigned_by) requestAssignedByIds.push(record.request_assigned_by);
                });

                asyncParallel({
                    delivery_area_details : (childCallback)=>{
                        if(deliveryAreaIds.length <= 0) return childCallback(null,null);

                        /** Get delivery area name **/
                        const areas = this.db.collection(Tables.AREAS);
                        areas.find({_id : {$in : deliveryAreaIds}},{projection:{_id:1, name:1}}).toArray().then(areaResult=>{
                            childCallback(null,areaResult);
                        }).catch(next);
                    },
                    request_assigned_by_details : (childCallback)=>{
                        if(requestAssignedByIds.length <= 0) return childCallback(null,null);
                        
                        /** Get request assigned by name **/
                        const users = this.db.collection(Tables.USERS);
                        users.find({_id : {$in : requestAssignedByIds}},{projection:{_id:1, full_name:1}}).toArray().then(userResult=>{
                            childCallback(null,userResult);
                        }).catch(next);
                    },
                },(childErr, childResponse)=>{
                    if(childErr) return next(childErr);

                    let deliveryAreaResult      = childResponse?.delivery_area_details || [];
                    let requestAssignedByResult = childResponse?.request_assigned_by_details || [];
                    result.forEach(record=>{
                        /** Insert request assigned by name in records **/
                        if(requestAssignedByResult && requestAssignedByResult.length > 0){
                            requestAssignedByResult.forEach(requestAssignedByRecords=>{
                                if(record?.request_assigned_by?.toString() == requestAssignedByRecords?._id?.toString()){
                                    record.request_assigned_by_name = requestAssignedByRecords?.full_name || "";
                                }
                            });
                        }
                        /** Insert delivery area name in records **/
                        if(deliveryAreaResult && deliveryAreaResult.length > 0){
                            deliveryAreaResult.forEach(deliveryAreaRecords=>{
                                if(record?.delivery_area_id?.toString() == deliveryAreaRecords?._id?.toString()){
                                    record.delivery_area_name = deliveryAreaRecords?.name?.[Constants.DEFAULT_LANGUAGE_CODE] || "";
                                }
                            });
                        }
                    });
                    
                    /** Send response **/
                    res.send({
                        status: Constants.STATUS_SUCCESS,
                        draw: dataTableConfig.result_draw,
                        data: result,
                        recordsTotal: dbRes?.[0]?.count?.[0]?.count || 0,
                        recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0,
                    }); 
                });
            } else {
                /** Set dropdown options **/
                const dropDownResponse = await getDropdownList(req, res, next, {
                    collections: [
                        {
                            collection: Tables.USERS,
                            columns: ["_id", "full_name"],
                            conditions: Constants.DRIVER_COMMON_CONDITIONS,
                        },
                    ]
                });

                /** render order assignment listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/order_assignment/list']);
                res.render('list', {
                    captain_list: dropDownResponse?.final_html_data?.[0] || ""
                });
            }
        } catch (error) {
            next(error);
        }
    }
}
export default OrderAssignment; 