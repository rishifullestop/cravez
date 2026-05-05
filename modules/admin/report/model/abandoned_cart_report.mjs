import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, getDropdownList,arrayToObject, newDate, exportToExcel, configDatatable } from '../../../../utils/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

// Model for Abandoned Cart Report
export default class AbandonedCartReport {

    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.ABANDONED_CARTS_REPORTS);
    }

	/**
	 * Function to get Abandoned Cart Report list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getAbandonedCartReportList(req,res,next){
		try {
			if(isPost(req)){
				let limit			= (req.body.length) 		? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
				let skip		 	= (req.body.start)  		? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;
				let fromDate     	= (req.body.from_date) 		? req.body.from_date 		: "";
				let toDate 	  	 	= (req.body.to_date)   		? req.body.to_date   		: "";
				let restaurantIds	= (req.body.restaurant_ids) ? req.body.restaurant_ids   : [];
				let branchIds		= (req.body.branch_ids)   	? req.body.branch_ids   	: [];
				let name     	    = (req.body.name) 		    ? req.body.name 		    : "";
				let number 	  	 	= (req.body.number)   		? req.body.number   		: "";

				restaurantIds= (restaurantIds && restaurantIds.constructor === Array) ?restaurantIds :[restaurantIds];
				branchIds	= (branchIds && branchIds.constructor === Array) ?branchIds :[branchIds];

				/** Configure Datatable conditions*/
				const dataTableConfig = await configDatatable(req, res, null);

				/** Condition for date */
				let commonConditions = {};
				if (fromDate != "" && toDate != "") {
					commonConditions["created"] = {
						$gte: newDate(fromDate),
						$lte: newDate(toDate),
					};
				}

				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);
				if(restaurantIds.length > 0) dataTableConfig.conditions.restaurant_id = {$in : arrayToObject(restaurantIds)};
				if(branchIds.length > 0) dataTableConfig.conditions.branch_id	= {$in : arrayToObject(branchIds)};
				if (name) dataTableConfig.conditions.customer_name = { $regex: name , $options: 'i' };
				if (number) dataTableConfig.conditions.customer_mobile = { $regex: number, $options: 'i' };

				let dbRes = await this.collectionDb.aggregate([
					{ $match: dataTableConfig.conditions },
					{
						$facet : {
							list : [
								{$sort: dataTableConfig.sort_conditions },
								{$skip: skip },
								{$limit: limit },
								{$project: {
									customer_mobile: 1, customer_id: 1, customer_name: 1, restaurant_name: 1, restaurant_id: 1, branch_name: 1, branch_id: 1, item_name: 1, pn_status: 1, order_posting_status:1
								}}
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
			}else{

				/**Get dropdown list **/
				let dropdownList = await getDropdownList(req,res, next,{
					collections :[
						{
							collection : Tables.RESTAURANTS,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions : {
								is_deleted: Constants.NOT_DELETED
							},
						}
					]
				});

				/** render listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/report/abandoned_cart_report']);
				res.render('abandoned_cart_report',{
					restaurant_list : dropdownList?.final_html_data?.[0] || "",
				});
			}
		} catch (error) {
			return next(error);
		}
    };//End getAbandonedCartReportList()

	/**
	 *  Function abandoned Cart Report export
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
    */
    async abandonedCartReportExport(req,res,next){
		try{
			let fromDate     	= (req.query.from_date) 	? req.query.from_date 		: "";
			let toDate 	  	 	= (req.query.to_date)   	? req.query.to_date   		: "";
			let restaurantIds	= (req.query.restaurant_ids)? (req.query.restaurant_ids).split(","): [];
			let branchIds		= (req.query.branch_ids) ? (req.query.branch_ids).split(",")   	: [];
			let name            = (req.query.name) ? req.query.name : "";
			let number          = (req.query.number) ? req.query.number : "";
			let sortingField    = (req.query.sort_field) ? req.query.sort_field : "_id";
			let sortingDir      = (req.query.sort_dir) ? req.query.sort_dir : "asc";
			let sortOrder       = (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;

			if(restaurantIds.constructor != Array) restaurantIds = [restaurantIds];
			if(branchIds.constructor != Array) 	branchIds	= [branchIds];

			let exportConditions	= {};
			/** Condition for date */
			if (fromDate != "" && toDate != "") {
				exportConditions["created"] = {
					$gte 	: newDate(fromDate),
					$lte 	: newDate(toDate),
				};
			}

			if(restaurantIds.length > 0)exportConditions.restaurant_id	= {$in: arrayToObject(restaurantIds)};
			if(branchIds.length > 0)	exportConditions.branch_id		= {$in: arrayToObject(branchIds)};
			if (name) exportConditions.customer_name = { $regex: name, $options: 'i' };
			if (number) exportConditions.customer_mobile = { $regex: number, $options: 'i' };

			let sortConditions = {};
			sortConditions[sortingField] = sortOrder;

			/** Get abandoned cart report list **/
			let findResult = await this.collectionDb.find(exportConditions, { projection: { customer_mobile: 1, customer_id: 1, customer_name: 1, restaurant_name: 1, restaurant_id: 1, branch_name: 1, branch_id: 1, item_name: 1, pn_status: 1, order_posting_status: 1 } }).sort(sortConditions).toArray();


			/** Define excel heading label **/
			let commonColls	= [
				res.__("admin.report.customer_name"),
				res.__("admin.report.customer_mobile"),
				res.__("admin.report.restaurant_name"),
				res.__("admin.report.branch_name"),
				res.__("admin.report.abandoned_items"),
				res.__("admin.report.push_notification_status"),
				res.__("admin.report.order_posting_status"),
			];

			let temp = [];
			if(findResult && findResult.length > 0){
				findResult.map(records=>{
					var items = [];
					records.item_name.map(record => {
						items.push(record[Constants.DEFAULT_LANGUAGE_CODE]);
					});
					let buffer =	[
						(records.customer_name)     ? records.customer_name : "",
						(records.customer_mobile)   ? records.customer_mobile : "",
						(records.restaurant_name)	? 	records.restaurant_name[Constants.DEFAULT_LANGUAGE_CODE] 		:"",
						(records.branch_name)		? 	records.branch_name[Constants.DEFAULT_LANGUAGE_CODE] 		:"",
						items.toString(),
						Constants.PN_STATUS[records.pn_status],
						Constants.ORDER_POSTING_STATUS[records.order_posting_status],
					];
					temp.push(buffer);
				});
			}

			/**  Function to export data in excel format **/
			exportToExcel(req,res,{
				file_prefix 		: "AbandonedCartReport",
				heading_columns		: commonColls,
				export_data			: temp
			});
		} catch (error) {
			return next(error);
		}
    };// end abandonedCartReportExport()
}
