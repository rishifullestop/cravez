import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, newDate, exportToExcel, configDatatable } from '../../../../utils/index.mjs';

// Model for drivers compliant report
export default class DriversCompliantReport {
	constructor(db) {
		this.db = db;
	}

	/**
	 * Function to get list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
    async getDriversCompliantReportList(req,res,next){
		try{
			if(isPost(req)){
				let limit			= (req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 	= (req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
                let fromDate     	= (req.body.from_date) 	    ? req.body.from_date 		: "";
                let toDate 	  	 	= (req.body.to_date)   	    ? req.body.to_date   		: "";
                let captainName     = (req.body.captain_name)   ? req.body.captain_name   	: "";
                let captainId       = (req.body.captain_id)     ? req.body.captain_id   	: "";
                let captainStatus   = (req.body.captain_status) ? req.body.captain_status   : "";
                const voc_responses = this.db.collection(Tables.VOC_RESPONSES);

                let commonConditions = {
                    user_type:  Constants.VOC_FOR_CAPTAIN,
                    is_skip  :  ""
                };

                /** Condition for date */
                if (fromDate != "" && toDate != "") {
                    let tmpTODate = newDate(toDate,Constants.CURRENTDATE_END_DATE_FORMAT);
                    commonConditions["created"] = {$gte: newDate(fromDate), $lte: newDate(tmpTODate) };
                }

                /** Configure Datatable conditions*/
                let dataTableConfig = await configDatatable(req,res,null);
                let captainConditions = { captain_id : {$nin : ["",null]}};
                if (captainName) dataTableConfig.conditions.captain_name = { $regex: captainName , $options: 'i' };
                if (captainId) dataTableConfig.conditions.driver_id = { $regex: captainId, $options: 'i' };
                if (captainStatus != "") {
                    if (captainStatus == Constants.ACTIVE){
                        dataTableConfig.conditions["captain_status"] = Constants.ACTIVE;
                    }
                    else{
                        dataTableConfig.conditions["captain_status"] = Constants.DEACTIVE;
                    }
                }

                asyncParallel({
                    records :(callback)=>{
                        /** Get list of all orders of guest and customer **/
                        voc_responses.aggregate([
                            {$match: commonConditions},
                            {$lookup: {
                                "from": Tables.ORDERS,
                                "localField": "order_id",
                                "foreignField": "_id",
                                "as": "order_details"
                            }},
                            {$addFields: {
                                unique_order_id: { $arrayElemAt: ["$order_details.unique_order_id", 0] },
                                order_status: { $arrayElemAt: ["$order_details.order_status", 0] },
                                captain_id: { $arrayElemAt: ["$order_details.captain_id", 0] },
                            }},
                            {$match: captainConditions },
                            {$lookup:	{
                                "from" 			: 	Tables.USERS,
                                "localField" 	:	"captain_id",
                                "foreignField" 	: 	"_id",
                                "as" 			: 	"user_details"
                            }},
                            {$addFields : {
                                captain_name    : { $arrayElemAt: ["$user_details.full_name",0]},
                                driver_id       : { $arrayElemAt: ["$user_details.driver_id", 0] },
                                captain_status  : { $arrayElemAt: ["$user_details.active", 0] },
                            }},
                            {$project : {
                                captain_id:1, captain_name: 1, driver_id: 1, captain_status: 1,unique_order_id:1,created:1, order_status:1,answer:1,question:1
                            }},
                            {$match : dataTableConfig.conditions },
                            {$sort  : dataTableConfig.sort_conditions },
                            {$skip 	: skip},
                            {$limit : limit},
                        ]).toArray().then(result=>{
                            callback(null,result);
                        }).catch(next);
                    },
                    total_records:(callback)=>{
                        /** Get total number of records **/
                        voc_responses.aggregate([
                            {$match: commonConditions },
                            {$lookup: {
                                "from": Tables.ORDERS,
                                "localField": "order_id",
                                "foreignField": "_id",
                                "as": "order_details"
                            }},
                            {$addFields: {
                                captain_id: { $arrayElemAt: ["$order_details.captain_id", 0] },
                            }},
                            {$match: captainConditions},
                        ]).toArray().then(countResult=>{
                            countResult  = (countResult) ? countResult.length :0;
                            callback(null, countResult);
                        }).catch(next);
                    },
                    filter_records:(callback)=>{
                        voc_responses.aggregate([
                            { $match: commonConditions },
                            {$lookup: {
                                "from": Tables.ORDERS,
                                "localField": "order_id",
                                "foreignField": "_id",
                                "as": "order_details"
                            }},
                            {$addFields: {
                                captain_id: { $arrayElemAt: ["$order_details.captain_id", 0] },
                            }},
                            {$match: captainConditions },
                            {$lookup: {
                                "from": Tables.USERS,
                                "localField": "captain_id",
                                "foreignField": "_id",
                                "as": "user_details"
                            }},
                            {$addFields: {
                                captain_name: { $arrayElemAt: ["$user_details.full_name", 0] },
                                driver_id: { $arrayElemAt: ["$user_details.driver_id", 0] },
                                captain_status: { $arrayElemAt: ["$user_details.active", 0] },
                            }},
                            {$project: {
                                captain_name: 1, driver_id: 1, captain_status: 1,
                            }},
                            {$match: dataTableConfig.conditions },
                        ]).toArray().then(result=>{
                            result  = (result) ? result.length :0;
                            callback(null, result);
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
                req.breadcrumbs(BREADCRUMBS['admin/report/drivers_compliant_report']);
                res.render('drivers_compliant_report');
            }
        }catch(error){
            return next(error);
        }
    };//End getDriversCompliantReportList()

	/**
	 *  Function for export
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async driversCompliantReportExport(req,res,next){
        try{
            let fromDate     	=   (req.query.from_date) 	    ?   req.query.from_date 		:"";
            let toDate 	  	 	=   (req.query.to_date)   	    ?   req.query.to_date   		:"";
            let captainName     =   (req.query.captain_name)    ?   req.query.captain_name      :"";
            let captainId       =   (req.query.captain_id)      ?   req.query.captain_id        :"";
            let captainStatus   =   (req.query.captain_status)  ?   req.query.captain_status    :"";
            let sortingField    =   (req.query.sort_field)      ?   req.query.sort_field        :"_id";
            let sortingDir      =   (req.query.sort_dir)        ?   req.query.sort_dir          :"asc";
            let sortOrder       =   (sortingDir == 'asc')       ?   Constants.SORT_ASC          :Constants.SORT_DESC;

            /** Set conditions */
            let commonConditions = {
                user_type: Constants.VOC_FOR_CAPTAIN,
                is_skip: ""
            };

            /** Condition for date */
            if (fromDate != "" && toDate != "") {
                let tmpTODate = newDate(toDate, Constants.CURRENTDATE_END_DATE_FORMAT);
                commonConditions["created"] = {$gte: newDate(fromDate), $lte: newDate(tmpTODate) };
            }

            let captainConditions = { captain_id: { $nin: ["", null] } };
            let exportConditions = {};
            if (captainName) exportConditions.captain_name = { $regex: captainName, $options: 'i' };
            if (captainId) exportConditions.driver_id = { $regex: captainId, $options: 'i' };
            if (captainStatus != "") {
                if (captainStatus == Constants.ACTIVE) {
                    exportConditions["captain_status"] = Constants.ACTIVE;
                }
                else {
                    exportConditions["captain_status"] = Constants.DEACTIVE;
                }
            }

            let sortConditions   = {};
            sortConditions[sortingField]= sortOrder;

            const voc_responses = this.db.collection(Tables.VOC_RESPONSES);
            voc_responses.aggregate([
                {$match: commonConditions },
                {$lookup: {
                    "from": Tables.ORDERS,
                    "localField": "order_id",
                    "foreignField": "_id",
                    "as": "order_details"
                }},
                {$addFields: {
                    unique_order_id : { $arrayElemAt: ["$order_details.unique_order_id", 0] },
                    order_status    : { $arrayElemAt: ["$order_details.order_status", 0] },
                    captain_id      : { $arrayElemAt: ["$order_details.captain_id", 0] },
                }},
                {$match: captainConditions },
                {$lookup: {
                    "from"          : Tables.USERS,
                    "localField"    : "captain_id",
                    "foreignField"  : "_id",
                    "as"            : "user_details"
                }},
                {$addFields: {
                    captain_name    : { $arrayElemAt: ["$user_details.full_name", 0] },
                    driver_id       : { $arrayElemAt: ["$user_details.driver_id", 0] },
                    captain_status  : { $arrayElemAt: ["$user_details.active", 0] },
                }},
                {$project: {
                    captain_name: 1, driver_id: 1, captain_status: 1, unique_order_id: 1, created: 1, order_status: 1,answer:1,question:1
                }},
                {$match: exportConditions },
                {$sort : sortConditions },
            ]).toArray().then(findResult=>{

                let temp		= [];
                let commonColls	= [];

                /** Define excel heading label **/
                commonColls	= [
                    res.__("admin.report.captain_id"),
                    res.__("admin.report.captain_name"),
                    res.__("admin.report.voc_date"),
                    res.__("admin.report.question"),
                    res.__("admin.report.answer"),
                    res.__("admin.report.order_id"),
                    res.__("admin.report.order_status"),
                ];

                if(findResult && findResult.length > 0){
                    findResult.map(records=>{
                        let buffer =	[
                            (records.driver_id)    ? records.driver_id : "",
                            (records.captain_name) ? records.captain_name 		:"",
                            (records.created)  ? newDate(records.created, Constants.AM_PM_FORMAT_WITH_DATE) : '',
                            (records.question) ? records.question : "",
                            (records.answer)   ? records.answer : "",
                            (records.unique_order_id) ? records.unique_order_id : "",
                            (records.order_status) ? Constants.ORDER_STATUS_TYPES[records.order_status].status_name : "",
                        ];
                        temp.push(buffer);
                    });
                }

                /**  Function to export data in excel format **/
                exportToExcel(req,res,{
                    file_prefix         : "DriverCompliantReport ",
                    heading_columns		: commonColls,
                    export_data			: temp
                });
            }).catch(next);
        }catch(error){
            return next(error);
        }
    };// end driversCompliantReportExport()
}
