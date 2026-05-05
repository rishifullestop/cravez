import { ObjectId } from 'mongodb';
import BREADCRUMBS from "../../../../breadcrumbs.mjs";
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from "../../../../config/database_tables.mjs";
import { isPost, getDropdownList} from "../../../../utils/index.mjs";

export default class RestaurantReportDashboard {
    constructor(db) {
        this.db = db;
    }
	
	/**
	* Function to get listing page
	*
	* @param req 	As Request Data
	* @param res 	As Response Data
	*
	* @return render/json
	*/
    async getRestaurantReportDashboard (req,res,next){
		try {
			let restaurantId = new ObjectId(req.session.user.restaurant_id);
			if(isPost(req)){ 
					res.send({status : Constants.STATUS_SUCCESS});
			}else{	
				/**Get dropdown list **/
				let response = await getDropdownList(req, res, next, {
					collections :[					
						{
							collection : Tables.RESTAURANT_BRANCHES,
							columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
							conditions : {
								restaurant_id 	: restaurantId,
								is_active		: Constants.ACTIVE,
							},
						}
					]
				});
				
				/** render top selling items report listing page **/
				req.breadcrumbs(BREADCRUMBS['reports/restaurant_report_dashboard']);
				res.render('restaurant_report_dashboard',{
					branch_list : response?.final_html_data?.["0"] || "",											
				});
			}	
		} catch (error) {
			return next(error);
		}
	};//End getRestaurantReportDashboard()
}
