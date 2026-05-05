import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, newDate, exportToExcel, configDatatable } from '../../../../utils/index.mjs';

// Model for drivers report
export default class DriversReport {
	constructor(db) {
		this.db = db;
	}


	/**
	 * Function to get Abandoned Cart Report list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getDriversReportList(req,res,next){ 
		try{
			if(isPost(req)){			
				let limit			= (req.body.length) ? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 	= (req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
                let fromDate     	= (req.body.from_date) 		? req.body.from_date 		: "";
                let toDate 	  	 	= (req.body.to_date)   		? req.body.to_date   		: "";
                let name     	    = (req.body.name) 		    ? req.body.name 		    : "";
                
                const driver_gps_logs = this.db.collection(Tables.DRIVER_GPS_LOGS);
            
                /** Configure Datatable conditions*/
                let dataTableConfig = await configDatatable(req,res,null);
                let commonConditions = {};
                let filterConditions = {};
                /** Condition for date */
                if (fromDate != "" && toDate != "") {
                    commonConditions["created"] = {
                        $gte: newDate(fromDate),
                        $lte: newDate(toDate),
                    };
                }
                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);
                if (name) filterConditions['driver_name'] = { $regex: name , $options: 'i' };

                asyncParallel({
                    records :(callback)=>{	 				
                        /** Get list **/
                        driver_gps_logs.aggregate([
                            { $match: dataTableConfig.conditions },
                            {
                                $lookup: {
                                    "from"          : Tables.USERS,
                                    "localField"    : "driver_id",
                                    "foreignField"  : "_id",
                                    "as"            : "user_details"
                                }
                            },
                            {
                                $addFields: {
                                    driver_name: { $arrayElemAt: ["$user_details.full_name", 0] },
                                    user_mobile: { $arrayElemAt: ["$user_details.mobile_number", 0] },
                                }
                            },
                            {
                                $project: {
                                    user_mobile: 1, driver_name: 1, gps_status: 1, driver_id: 1, created: 1, modified: 1,
                                }
                            },
                            { $match: filterConditions },
                            { $sort : dataTableConfig.sort_conditions },
                            { $skip : skip },
                            { $limit: limit },
                        ]).toArray().then(result=>{
                            callback(null, result);
                        }).catch(next);
                    },
                    total_records:(callback)=>{
                        /** Get total number of records **/
                        driver_gps_logs.countDocuments(commonConditions).then(countResult=>{
                            callback(null, countResult);
                        }).catch(next);
                    },
                    filter_records:(callback)=>{
                        /** Get filtered records counting **/
                        driver_gps_logs.aggregate([
                            { $match: dataTableConfig.conditions },
                            {
                                $lookup: {
                                    "from"          : Tables.USERS,
                                    "localField"    : "driver_id",
                                    "foreignField"  : "_id",
                                    "as"            : "user_details"
                                }
                            },
                            {
                                $addFields: {
                                    driver_name: { $arrayElemAt: ["$user_details.full_name", 0] },
                                    user_mobile: { $arrayElemAt: ["$user_details.mobile_number", 0] },
                                }
                            },
                            {
                                $project: {
                                    user_mobile: 1, driver_name: 1, gps_status: 1, driver_id: 1, created: 1, modified: 1,
                                }
                            },
                            { $match: filterConditions },
                        ]).toArray().then(result=>{
                            callback(null, result.length);
                        }).catch(next);
                    }
                },(err, response)=>{
                    /** Send response **/
                    res.send({
                        status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
                        draw			: dataTableConfig.result_draw,
                        data			: response.records,
                        recordsFiltered	: response.filter_records,
                        recordsTotal	: response.total_records,
                    });
                });
            }else{
                /** render listing page **/
                req.breadcrumbs(BREADCRUMBS['admin/report/drivers_report']);
                res.render('drivers_report');
            }
        }catch(error){
            return next(error);
        }
    };//End getDriversReportList()
	
	/**
	 *  Function drivers Report export
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async driversReportExport(req,res,next){
        try{
            let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
            let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";		
            let name            = (req.query.name) ? req.query.name : "";
            let sortingField    = (req.query.sort_field) ? req.query.sort_field : "_id";
            let sortingDir      = (req.query.sort_dir) ? req.query.sort_dir : "asc";
            let sortOrder       = (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;		
                
            let exportConditions	= {};		
            /** Condition for date */
            if (fromDate != "" && toDate != "") {
                exportConditions["created"] = {
                    $gte 	: newDate(fromDate),
                    $lte 	: newDate(toDate),
                };
            }
            let filterConditions = {};
            if (name) filterConditions.driver_name = { $regex: name, $options: 'i' };

            let sortConditions = {};
            sortConditions[sortingField] = sortOrder;

            /** Get order details **/
            const driver_gps_logs = this.db.collection(Tables.DRIVER_GPS_LOGS);
            driver_gps_logs.aggregate([
                { $match: exportConditions },
                {
                    $lookup: {
                        "from"          : Tables.USERS,
                        "localField"    : "driver_id",
                        "foreignField"  : "_id",
                        "as"            : "user_details"
                    }
                },
                {
                    $addFields: {
                        driver_name: { $arrayElemAt: ["$user_details.full_name", 0] },
                        user_mobile: { $arrayElemAt: ["$user_details.mobile_number", 0] },
                    }
                },
                {
                    $project: {
                        user_mobile: 1, driver_name: 1, gps_status: 1, driver_id: 1, created: 1, modified: 1,
                    }
                },
                { $match: filterConditions },
                { $sort : sortConditions },
            ]).toArray().then(findResult=>{
                let temp		= [];
                let commonColls	= [];

                /** Define excel heading label **/
                commonColls	= [
                    res.__("admin.report.driver_name"),
                    res.__("admin.report.driver_mobile"),
                    res.__("admin.report.gps_on_time"),				
                    res.__("admin.report.gps_off_time"),						
                ];

                if(findResult && findResult.length > 0){
                    findResult.map(records=>{
                        let buffer =	[
                            (records.driver_name)   ? records.driver_name : "",
                            (records.user_mobile)   ? records.user_mobile : "",
                            (records.created)       ? newDate(records.created, Constants.AM_PM_FORMAT_WITH_DATE)	:"",
                            (records.gps_status == Constants.DRIVER_GPS_OFF) ? newDate(records.modified, Constants.AM_PM_FORMAT_WITH_DATE) : "",
                        ];
                        temp.push(buffer);
                    });
                }

                /**  Function to export data in excel format **/
                exportToExcel(req,res,{
                    file_prefix 		: "DriversReport",
                    heading_columns		: commonColls,
                    export_data			: temp
                });
            }).catch(next);
        }catch(error){
            return next(error);
        }
    };// end driversReportExport()
}
