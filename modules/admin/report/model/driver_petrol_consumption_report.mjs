import { ObjectId } from 'mongodb';
import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, getDropdownList, newDate, exportToExcel, configDatatable, currencyFormat, round } from '../../../../utils/index.mjs';

// Model for driver petrol consumption report
export default class DriverPetrolConsumptionReport {
	constructor(db) {
		this.db = db;
	}
	
	/**
	 * Function to get driver petrol consumption report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getDriverPetrolConsumptionReportList(req,res,next){
		try{
			if(isPost(req)){
				let limit		 = 	(req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 = 	(req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     = 	(req.body.from_date) 	? req.body.from_date 		:"";
				let toDate 	  	 = 	(req.body.to_date)   	? req.body.to_date   		:"";
				const collection = 	this.db.collection(Tables.DRIVER_PETROL_CONSUMPTIONS);

				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);
				let commonConditions = {};
				/** Condition for date */
				if (fromDate != "" && toDate != "") {
					commonConditions["date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					};
				}
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				asyncParallel({
					petrol_consumption_list :(callback)=>{
						/** Get list of driver petrol consumption**/
						collection.aggregate([
							{$match : dataTableConfig.conditions},
							{$lookup:	{
								"from" 			: 	Tables.USERS,
								"localField" 	:	"driver_id",
								"foreignField" 	: 	"_id",
								"as" 			: 	"driver_details"
							}},
							{$addFields : {
								driver_name: {$arrayElemAt: ["$driver_details.full_name",0]},
							}},
							{$group : {
								_id					: {driver_id : "$driver_id",vehicle_type : "$vehicle_type"},
								total_km			: {$sum : "$total_km" },
								petrol_consumption	: {$sum : "$petrol_consumption"},
								driver_id			: {$first : "$driver_id"},
								driver_name			: {$first : "$driver_name"},
								vehicle_type		: {$first : "$vehicle_type"},
								count	: {$sum : 1}
							}},
							{$sort 	: dataTableConfig.sort_conditions},
							{$skip 	: skip},
							{$limit : limit},
						]).toArray().then(result=>{							
							callback(null,result);
						}).catch(next);
					},
					total_records:(callback)=>{
						/** Get total number of records in driver petrol consumptions collection **/
						collection.aggregate([
							{ $match: commonConditions},							
							{$group : {
								_id		: {driver_id : "$driver_id",vehicle_type : "$vehicle_type"},
							}}
						]).toArray().then(countResult=>{
							callback(null, countResult.length);
						}).catch(next);
					},
					filter_records:(callback)=>{
						/** Get filtered records counting in driver petrol consumptions **/
						collection.aggregate([
							{$match : dataTableConfig.conditions},							
							{$group : {
								_id		: {driver_id : "$driver_id",vehicle_type : "$vehicle_type"},
							}}
						]).toArray().then(countResult=>{	
							callback(null, countResult.length);
						}).catch(next);
					}
				},(err, response)=>{
					/** Send response **/
					res.send({
						status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
						draw			: dataTableConfig.result_draw,
						data			: response.petrol_consumption_list,
						recordsFiltered	: response.filter_records,
						recordsTotal	: response.total_records,
					});
				});
			}else{
				/** Set dropdown options **/
				let options = {
					collections :[
						{
							collection : Tables.USERS,
							columns    : ["_id","full_name"],
							conditions : Constants.DRIVER_COMMON_CONDITIONS,
						},
					]
				};

				/**Get dropdown list **/
				getDropdownList(req,res, next,options).then(response=> {
					
					/** render driver petrol consumption listing page **/
					req.breadcrumbs(BREADCRUMBS['admin/report/driver_petrol_consumption_report']);
					res.render('driver_petrol_consumption_report',{
						driver_list  : response?.final_html_data?.[0] || "",
					});
				}).catch(next);
			}
		}catch(error){
			return next(error);
		}
	};//End getDriverPetrolConsumptionReportList()
	
	
	/**
	 * Function to get driver petrol consumption report details
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async driverPetrolConsumptionDetails(req,res,next){
		try{
			let driverId		= new ObjectId(req.params.driver_id);
			let vehicleType		= req.params.vehicle_type;
			if(isPost(req)){
				let limit		 = 	(req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 = 	(req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     = 	(req.body.from_date) 	? req.body.from_date 		:"";
				let toDate 	  	 = 	(req.body.to_date)   	? req.body.to_date   		:"";
				const collection = 	this.db.collection(Tables.DRIVER_PETROL_CONSUMPTIONS);

				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);
				let commonConditions = { driver_id : driverId, vehicle_type: vehicleType};
				
				/** Condition for date */
				if (fromDate != "" && toDate != "") {
					dataTableConfig.conditions["date"] = {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					};
				}
				
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions,commonConditions);		
				
				
				asyncParallel({
					petrol_consumption_list :(callback)=>{
						/** Get list of driver petrol consumption**/
						collection.aggregate([
							{$match : dataTableConfig.conditions},
							{$sort 	: dataTableConfig.sort_conditions},
							{$skip 	: skip},
							{$limit : limit},							
							{$project :	{ _id:1,driver_id:1,date:1,total_km:1,petrol_consumption:1,vehicle_type: 1}},
						]).toArray().then(result=>{
							callback(null,result);
						}).catch(next);
					},
					total_records:(callback)=>{
						/** Get total number of records in driver petrol consumptions collection **/
						collection.countDocuments(commonConditions).then(countResult=>{
							callback(null, countResult);
						}).catch(next);
					},
					filter_records:(callback)=>{
						/** Get filtered records counting in driver petrol consumptions **/
						collection.countDocuments(dataTableConfig.conditions).then(countResult=>{
							callback(null, countResult);
						}).catch(next);
					}
				},(err, response)=>{
					/** Send response **/
					res.send({
						status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
						draw			: dataTableConfig.result_draw,
						data			: response.petrol_consumption_list,
						recordsFiltered	: response.filter_records,
						recordsTotal	: response.total_records
					});
				});
			}else{	
				
				let fromDate	= (req.query.from)	? req.query.from	: "";
				let toDate		= (req.query.to)	? req.query.to		: "";
				const users		= this.db.collection(Tables.USERS);				
				users.findOne({_id : driverId},{projection : {full_name : 1}}).then(result=>{				
					/** render driver petrol consumption listing page **/
					req.breadcrumbs(BREADCRUMBS['admin/report/driver_petrol_consumption_details']);
					res.render('driver_petrol_consumption_details',{
						start_date	: fromDate,
						end_date	: toDate,
						result		: result || {},
						vehicle_type: vehicleType,
						driver_id	: driverId,
					});
				}).catch(next);
			}
		}catch(error){
			return next(error);
		}
	};//End driverPetrolConsumptionDetails()
	
	/**
	 *  Function for petrol consumption detials
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async petrolConsumListExport(req,res,next){
		try{
			let fromDate 	= (req.query.from_date) ? req.query.from_date : "";
			let toDate 		= (req.query.to_date) ? req.query.to_date : "";
			let driverId 	= (req.query.driver_id) ? req.query.driver_id : "";
			let sortingField= (req.query.sort_field) ? req.query.sort_field : "_id";
			let sortingDir 	= (req.query.sort_dir) ? req.query.sort_dir : "asc";
			let sortOrder 	= (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;

			let exportConditions = {};
			let sortConditions = {};
			sortConditions[sortingField] = sortOrder;

			if (fromDate != "" && toDate != "") {
				exportConditions["date"] = {
					$gte: newDate(fromDate),
					$lte: newDate(toDate),
				};
			}

			if (driverId) exportConditions.driver_id = new ObjectId(driverId);
			/** Get order details **/
			const driver_petrol_consumptions	= this.db.collection(Tables.DRIVER_PETROL_CONSUMPTIONS);
			driver_petrol_consumptions.aggregate([
				{ $match: exportConditions},
				{$sort 	: sortConditions},
				{$lookup:	{
					"from" 			: 	Tables.USERS,
					"localField" 	:	"driver_id",
					"foreignField" 	: 	"_id",
					"as" 			: 	"driver_details"
				}},
				{$addFields : {
					driver_name: {$arrayElemAt: ["$driver_details.full_name",0]},
				}},
				{$group : {
					_id					: {driver_id : "$driver_id",vehicle_type : "$vehicle_type"},
					total_km			: {$sum : "$total_km" },
					petrol_consumption	: {$sum : "$petrol_consumption"},
					driver_id			: {$first : "$driver_id"},
					driver_name			: {$first : "$driver_name"},
					vehicle_type		: {$first : "$vehicle_type"},
				}}
			]).toArray().then(findResult=>{

				let temp			= [];
				let commonColls		= [];

				/** Define excel heading label **/
				commonColls	= [
					res.__("admin.driver_petrol_consumption.captain_name"),
					res.__("admin.driver_petrol_consumption.vehicle_type"),
					res.__("admin.driver_petrol_consumption.total_km"),
					res.__("admin.driver_petrol_consumption.total_petrol_consumption"),				
				];

				if(findResult && findResult.length > 0){
					findResult.map(records=>{
						let buffer =	[
							(records.driver_name)	? 	records.driver_name 			:"",
							(records.vehicle_type)	? 	Constants.VEHICLE_TYPE[records.vehicle_type]: "",						
							(records.total_km) 		? 	round(records.total_km) :0,
							(records.petrol_consumption) ? 	currencyFormat(records.petrol_consumption) : currencyFormat(0),
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "petrolConsumListExport",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
	};// end petrolConsumListExport()
	
	/**
	 *  Function for petrol consumption detials
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async petrolConsumDetailExport(req,res,next){
		try{
			let driverId 	= new ObjectId(req.query.driver_id);
			let vehicleType = req.query.vehicle_type;

			let fromDate 		= (req.query.from_date) ? req.query.from_date : "";
			let toDate 			= (req.query.to_date) ? req.query.to_date : "";
			let sortingField 	= (req.query.sort_field) ? req.query.sort_field : "_id";
			let sortingDir 		= (req.query.sort_dir) ? req.query.sort_dir : "asc";
			let sortOrder 		= (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;

			let exportConditions = {
				driver_id: driverId, vehicle_type: vehicleType
			};
			let sortConditions = {};
			sortConditions[sortingField] = sortOrder;

			if (fromDate != "" && toDate != "") {
				exportConditions["date"] = {
					$gte: newDate(fromDate),
					$lte: newDate(toDate),
				};
			}
		
			/** Get order details **/
			const driver_petrol_consumptions	= this.db.collection(Tables.DRIVER_PETROL_CONSUMPTIONS);
			driver_petrol_consumptions.aggregate([
				{ $match: exportConditions},
				{$sort 	: sortConditions},
				{$lookup:	{
					"from" 			: 	Tables.USERS,
					"localField" 	:	"driver_id",
					"foreignField" 	: 	"_id",
					"as" 			: 	"driver_details"
				}},						
				{$project :	{ _id:1,driver_id:1,date:1,total_km:1,petrol_consumption:1,vehicle_type: 1,driver_name: {$arrayElemAt: ["$driver_details.full_name",0]},}},
			]).toArray().then(findResult=>{

				let temp			= [];
				let commonColls		= [];

				/** Define excel heading label **/
				commonColls	= [
					res.__("admin.driver_petrol_consumption.captain_name"),
					res.__("admin.driver_petrol_consumption.vehicle_type"),
					res.__("admin.driver_petrol_consumption.date"),
					res.__("admin.driver_petrol_consumption.total_km"),
					res.__("admin.driver_petrol_consumption.total_petrol_consumption"),				
				];

				if(findResult && findResult.length > 0){
					findResult.map(records=>{
						let buffer =	[
							(records.driver_name)	? 	records.driver_name 			:"",
							(records.vehicle_type)	? 	Constants.VEHICLE_TYPE[records.vehicle_type]: "",
							(records.date)			? 	newDate(records.date,Constants.DATE_FORMAT_EXPORT)	:"",
							(records.total_km) 		? 	round(records.total_km) :0,
							(records.petrol_consumption) ? 	currencyFormat(records.petrol_consumption) : currencyFormat(0),
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "petrolConsumDetailExport",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
	};// end petrolConsumDetailExport()
}
