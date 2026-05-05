import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { arrayToObject, getDropdownList } from '../../../../utils/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

// Model for Sales Report
export default class SalesReport {

	constructor(db){
		this.db = db;
	}

	/**
	 * Function to get sales report search list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async seachSection(req,res,next){
		try{
			/**Get dropdown list **/
			const response = await getDropdownList(req,res, next, {
				collections :[
					{
						collection : Tables.RESTAURANTS,
						columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
						conditions : {
							status		: Constants.ACTIVE,
							is_deleted	: Constants.NOT_DELETED
						},
					}
				]
			});

			/** Send error response if dropdown list is not found **/
			if(response.status != Constants.STATUS_SUCCESS){
				req.flash(Constants.STATUS_ERROR,response.message);
				return res.redirect(Constants.WEBSITE_ADMIN_URL+"dashboard");
			}

			/** Set dropdown options **/
			req.breadcrumbs(BREADCRUMBS['admin/sales_reports/sales_report_list']);
			res.render('search_panel',{
				type 			: Constants.TOTAL_ORDER_PER_RESTAURANT,
				restaurant_list : response?.final_html_data?.[0] || ""
			});
		}catch(err){
			return next(err);
		}
	};//End seachSection()

	/**
	 * Function for get branch list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	 */
	async branchList(req,res,next){
		try{
			let restaurantIds = req?.body?.restaurant_id || "";

			/** Send error response */
			if(!restaurantIds) return res.send({status: Constants.STATUS_ERROR, message :res.__("admin.system.something_going_wrong_please_try_again") });

			if(restaurantIds.constructor !== Array)	restaurantIds = [restaurantIds];
			restaurantIds = arrayToObject(restaurantIds);

			/**Get branch list **/
			const response = await getDropdownList(req,res, next,{
				collections :[
					{
					collection : Tables.RESTAURANT_BRANCHES,
						columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
						conditions : {
							restaurant_id : {$in : restaurantIds},
							is_active	  : Constants.ACTIVE,
						},
					},
				]
			});

			/** Send error response if dropdown list is not found **/
			if(response.status != Constants.STATUS_SUCCESS) return res.send({status: Constants.STATUS_ERROR, message :res.__("admin.system.something_going_wrong_please_try_again") });

			res.send({
				status       : Constants.STATUS_SUCCESS,
				branch_list  : response?.final_html_data?.[0] || ""
			});
		}catch(err){
			return next(err);
		}
	};//End branchList()	
}
