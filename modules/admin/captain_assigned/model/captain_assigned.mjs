import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { newDate, arrayToObject, getAreaIdsBasedOnFleetRole } from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';

/**
 * Model for Captain Assigned functionality
 * Handles operations related to captain assignments and area-wise captain lists
 */
class CaptainAssigned {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.DRIVER_AVAILABILITIES);
    }

    /**
     * Function to get assigned captain list area wise
     *
     * @param req 	As Request Data
     * @param res 	As Response Data
     * @param next 	As Callback argument to the middleware function
     *
     * @return render/json
     */
    async getAssignedCaptainList(req, res, next) {
        try {
            let fromDate = newDate(newDate("", Constants.CURRENTDATE_START_DATE_FORMAT));
            let toDate = newDate(newDate("", Constants.CURRENTDATE_END_DATE_FORMAT));
            let isTeamHead = req.session.user.team_head ? req.session.user.team_head : false;
            let authUserRoleId = req.session.user.user_role_id;
            
            try {
                let areaIds = [];
                
                // Get fleet assigned area ids if user is fleet and not team head
                if (authUserRoleId == Constants.FLEET && !isTeamHead) {
                    areaIds = await getAreaIdsBasedOnFleetRole(req,res,next);
                }

                let commonConditions = {
                    date: { $gte: fromDate, $lte: toDate }
                };

                // Set condition for fleet user
                if (authUserRoleId == Constants.FLEET && (!isTeamHead || areaIds.length > 0)) {
                    commonConditions.area_id = { $in: arrayToObject(areaIds) };
                }

                let teamResult = [];
                
                // Get captain assigned data if user is fleet or cravez
                if (authUserRoleId == Constants.FLEET || authUserRoleId == Constants.CRAVEZ) {
                    teamResult = await this.collectionDb.aggregate([
                        {$match: commonConditions},
                        {$lookup: {
                            from: Tables.USERS,
                            localField: "user_id",
                            foreignField: "_id",
                            as: "captain_details"
                        }},
                        {$group: {
                            _id: {
                                area_id: "$area_id",
                            },
                            total_captains: { $sum: 1 },
                            captain_ids : { $push: "$user_id" },
                            area_id     : { $first: "$area_id" },
                            captain_list: { $push: {
                                _id: "$user_id",
                                full_name: { $arrayElemAt: ["$captain_details.full_name", 0] }
                            }}
                        }},
                        {'$lookup': {
                            'from': Tables.AREAS,
                            'localField': "area_id",
                            'foreignField': "_id",
                            'as': "area_detail",
                        }},
                        {$addFields: {
                            area_name: { $arrayElemAt: ["$area_detail.name." + Constants.DEFAULT_LANGUAGE_CODE, 0] }
                        }},
                        {$project: { area_detail: 0 }}
                    ]).toArray();
                }

                // Render assigned captain listing page
                req.breadcrumbs(BREADCRUMBS['admin/captain_assigned/list']);
                res.render('list', {
                    captain_assigned: teamResult
                });
            } catch (err) {
                return next(err);
            }
        } catch (err) {
            return next(err);
        }
    }
    
}
export default CaptainAssigned; 