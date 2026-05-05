import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, newDate, exportToExcel, configDatatable } from '../../../../utils/index.mjs';

// Model for number of customers who made first order from cravez report
export default class NumberOfCustomersFirstOrderReport {
	constructor(db) {
		this.db = db;
	}

	
	/**
	 * Function to get number of customers who made first order from cravez list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getNumberOfCustomersList(req,res,next){
		try{
			if(isPost(req)){
				let limit		 = 	(req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 = 	(req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     = 	(req.body.from_date) 	? req.body.from_date 		:"";
				let toDate 	  	 = 	(req.body.to_date)   	? req.body.to_date   		:"";
				let name     	    = (req.body.name) 		    ? req.body.name 		    : "";
				let number 	  	 	= (req.body.number)   		? req.body.number   		: "";
				
				const collection = 	this.db.collection(Tables.ORDERS);

				/** Configure Datatable conditions*/
				let dataTableConfig = await configDatatable(req,res,null);

				/** Set common conditions  */
				let commonConditions = {admin_status : Constants.ORDER_DELIVERED,is_first_order : true};

				/** Condition for order date */
				if (fromDate != "" && toDate != "") {
					commonConditions = { ...{order_date: {
						$gte 	: newDate(fromDate),
						$lte 	: newDate(toDate),
					}},...commonConditions};
				}
				
				if (name) dataTableConfig.conditions.full_name = { $regex: name, $options: 'i' };
				if (number) dataTableConfig.conditions.mobile_number = { $regex: number, $options: 'i' };

				dataTableConfig.conditions	= {...commonConditions, ...dataTableConfig.conditions};
				
				asyncParallel({
					customers_list :(callback)=>{
						/** Get list of number of customers who made first order from cravez **/
						collection.find(dataTableConfig.conditions,{projection: { _id:1,unique_order_id : 1,customer_id:1,is_first_order:1,full_name: 1,mobile_number: 1 }}).sort(dataTableConfig.sort_conditions).limit(limit).skip(skip).toArray().then(result=>{
							callback(null,result);
						}).catch(next);
					},
					total_records:(callback)=>{
						/** Get total number of records in orders collection **/
						collection.countDocuments(commonConditions).then(countResult=>{
							callback(null, countResult);
						}).catch(next);
					},
					filter_records:(callback)=>{
						/** Get filtered records counting in orders**/
						collection.countDocuments(dataTableConfig.conditions).then(filterContResult=>{
							callback(null, filterContResult);
						}).catch(next).catch(next);
					}
				},(err, response)=>{
					/** Send response **/
					res.send({
						status			: (!err) ? Constants.STATUS_SUCCESS : Constants.STATUS_ERROR,
						draw			: dataTableConfig.result_draw,
						data			: (response.customers_list) ? response.customers_list :[],
						recordsFiltered	: (response.filter_records) ? response.filter_records :0,
						recordsTotal	: (response.total_records)  ? response.total_records  :0
					});
				});
			}else{
				/** render number of customers who made first order from cravez listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/report/number_of_customers_list']);
				res.render('number_of_customers_first_order');
			}
		}catch(error){
			return next(error);
		}
	};//End getNumberOfCustomersList()

	/**
	 *  Function for export number of customers who made first order from cravez list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async numberOfCustomersExportData(req,res,next){
		try{
			let fromDate 	= (req.query.from_date) ? req.query.from_date : "";
			let toDate 		= (req.query.to_date) ? req.query.to_date : "";
			let sortingField= (req.query.sort_field) ? req.query.sort_field : "_id";
			let sortingDir 	= (req.query.sort_dir) ? req.query.sort_dir : "asc";
			let sortOrder 	= (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;
			let name = (req.query.name) ? req.query.name : "";
			let number = (req.query.number) ? req.query.number : "";
			let sortConditions = {};
			sortConditions[sortingField] = sortOrder;
			
			/** Condition for date */
			let exportConditions = {admin_status: Constants.ORDER_DELIVERED,is_first_order: true};
			if (fromDate != "" && toDate != "") {
				exportConditions = { ...{order_date: {
					$gte: newDate(fromDate),
					$lte: newDate(toDate),
				}},...exportConditions};
			}

			if (name) exportConditions.full_name = { $regex: name, $options: 'i' };
			if (number) exportConditions.mobile_number = { $regex: number, $options: 'i' };

			/** Get number of customers who made first order from cravez list **/
			const orders = this.db.collection(Tables.ORDERS);
			orders.find(exportConditions,{projection: { _id:1,unique_order_id : 1,customer_id:1,is_first_order:1,full_name: 1,mobile_number: 1 }}).sort(sortConditions).toArray().then(result=>{
				let temp			= [];
				let commonColls		= [];

				/** Define excel heading label **/
				commonColls		= 	[
					res.__("admin.report.user_name"),
					res.__("admin.report.user_mobile_number"),
					res.__("admin.report.order_id"),
				];

				if(result && result.length > 0){
					result.map(records=>{
						let buffer =	[
							(records.full_name)			? records.full_name 		: "",
							(records.mobile_number)		? records.mobile_number		: "",
							(records.unique_order_id)	? records.unique_order_id	: ""
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req,res,{
					file_prefix 		: "NumberOfCustomersReport",
					heading_columns		: commonColls,
					export_data			: temp
				});
			}).catch(next);
		}catch(error){
			return next(error);
		}
	};// end numberOfCustomersExportData()
}
