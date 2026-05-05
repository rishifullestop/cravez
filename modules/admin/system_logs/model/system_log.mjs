import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, configDatatable, newDate, getDropdownList } from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

class SystemLog {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.SYSTEM_LOGS);
    }

	/**
	 * Function to system logs list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	async list(req, res,next){
		try{
			if(isPost(req)){
				let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
				let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
				let fromDate = req?.body?.fromDate || "";
				let toDate = req?.body?.toDate || "";
				
				/** Configure Datatable conditions*/
				const dataTableConfig = await configDatatable(req, res, null);

				
				if(fromDate != "" && toDate != ""){
					dataTableConfig.conditions['created']={$gte: newDate(fromDate), $lte: newDate(toDate)};
				}

				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions);

				// Get list or count of system logs
                let dbRes = await this.collectionDb.aggregate([
                    {$match: dataTableConfig.conditions },
                    {$facet: {
                        list: [
                            {$sort: dataTableConfig.sort_conditions },
                            {$skip: skip },
                            {$limit: limit },
							{$lookup: {
								from: Tables.USERS,
								localField: "user_id",
								foreignField: "_id",
								as: "user"
							}},
                            {$project: {
								_id:1,activity_module:1,activity_type:1,created:1,additional_details:1,parent_id:1,user_id:1,
								user_name:{$arrayElemAt: ["$user.full_name", 0]}
                            }}
                        ],
                        count: [
                            { $count: "count" },
                        ]
                    }}
                ]).toArray();

                /** Send response **/
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data: dbRes?.[0]?.list || [],
                    recordsTotal: dbRes?.[0]?.count?.[0]?.count || 0,
                    recordsFiltered: dbRes?.[0]?.count?.[0]?.count || 0,
                });		
			}else{
				/** get dropdown options for users list **/
				let response  =	await getDropdownList(req,res,next,{
					collections :[{
						collection : Tables.USERS,
						columns    : ["_id","full_name"],
						conditions 	: 	{
							user_type 	: Constants.USER_TYPE_ADMIN,
							is_deleted  : Constants.NOT_DELETED
						}
					}]
				});

				/** render listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/system_logs/list']);
				res.render('list',{
					usersList : response?.final_html_data?.[0] || ""
				});
			}
		}catch(error){
			next(error);
		}
	};//End list()
}
export default SystemLog; 
