import { ObjectId } from 'mongodb';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost, sanitizeData, getUtcDate, newDate, arrayToObject, areaListCityWise, getDropdownList, getCityList, getDateRange } from '../../../../utils/index.mjs';
import { saveSystemLogs } from '../../../../services/index.mjs';
import clone from 'clone';

class FleetAreaAssignment {
    constructor(db) {
        this.db = db;
        this.collectionDb = db.collection(Tables.FLEET_AREAS);
    }

    /**
     * Get fleet area assignment list or render page
     */
    async getAreaList(req, res, next) {
        try {
            const authUserRoleId = req.session.user.user_role_id;
            if (isPost(req)) {
                const fromDate = req.body.from_date || '';
                const toDate = req.body.to_date || '';
                const userId = req.body.user_id || '';

                const response = await this.fleetAreaDetails(req, res, next, { from_date: fromDate, to_date: toDate, user_id: userId });
                
                if (response.status !== Constants.STATUS_SUCCESS) {
                    return res.send({
                        status: Constants.STATUS_ERROR,
                        message: res.__('admin.system.invalid_access'),
                    });
                }

                res.render('assign_area', {
                    layout: false,
                    user_data: response.user_data,
                    fleet_availablity: response.fleet_availablity,
                    choose_date: response.choose_date,
                    from_date: fromDate,
                    to_date: toDate,
                    parent_id: userId,
                });
            } else {
                let userList = '';
                if(authUserRoleId === Constants.CRAVEZ) {
                    let userConditions = clone(Constants.ADMIN_USER_COMMON_CONDITIONS);
                    userConditions.team_head 	= true;
					userConditions.user_role_id = Constants.FLEET;
                    
                    const dropDownResponse = await getDropdownList(req, res, next, {
                        collections: [{
                            collection: Tables.USERS,
                            columns: ['_id', 'full_name'],
                            conditions: userConditions,
                        }],
                    });
                    if (dropDownResponse.status === Constants.STATUS_SUCCESS) {
                        userList = dropDownResponse.final_html_data[0];
                    }
                }

                req.breadcrumbs(BREADCRUMBS['admin/fleet_area_assignment/list']);
                res.render('list', { user_list: userList });
            }
        } catch (err) {
            next(err);
        }
    }

    /**
     * Get fleet area assignment details
     */
    async fleetAreaDetails(req, res, next, options) {
        try {
            const isTeamHead = req.session.user.team_head || false;
            const authUserRoleId= req.session.user.user_role_id;
            const authId    =   isTeamHead ? req.session.user._id : req.session.user.parent_id;
            const fromDate  =   newDate(options.from_date,Constants.CURRENTDATE_START_DATE_FORMAT);
            const toDate    =   newDate(options.to_date , Constants.CURRENTDATE_END_DATE_FORMAT);
            const userId    =   options.user_id || '';

            let commonConditions = { date: { $gte: newDate(fromDate), $lte: newDate(toDate) } };
            if (authUserRoleId !== Constants.CRAVEZ) commonConditions.parent_id = new ObjectId(authId);
            if (userId) commonConditions.parent_id = new ObjectId(userId);

            // Get team available
            const teamResult = await this.collectionDb.aggregate([
                { $match: commonConditions },
                {
                    $lookup: {
                        from: Tables.USERS,
                        localField: 'user_id',
                        foreignField: '_id',
                        as: 'user_detail',
                    },
                },
                {
                    $project: {
                        _id: 1,
                        date: 1,
                        user_id: 1,
                        city_id: 1,
                        area_ids: 1,
                        user_name: { $arrayElemAt: ['$user_detail.full_name', 0] },
                    },
                },
            ]).toArray();

            // Collect city and area IDs
            let cityIds = [];
            let areaIds = [];
            teamResult.forEach(record => {
                if (Array.isArray(record.city_id)) cityIds.push(...record.city_id);
                if (Array.isArray(record.area_ids)) areaIds.push(...record.area_ids);
            });

            // Get city and area details
            const [cityDetails, areaDetails] = await Promise.all([
                cityIds.length > 0
                    ? this.db.collection(Tables.CITIES).find({ _id: { $in: arrayToObject(cityIds) } }, { projection: { _id: 1, name: 1 } }).toArray()
                    : [],
                areaIds.length > 0
                    ? this.db.collection(Tables.AREAS).find({ _id: { $in: arrayToObject(areaIds) } }, { projection: { _id: 1, name: 1 } }).toArray()
                    : [],
            ]);
            const cityList = {};
            cityDetails.forEach(city => {
                cityList[city._id] = city?.name?.[Constants.DEFAULT_LANGUAGE_CODE] || "";
            });
            const areaList = {};
            areaDetails.forEach(area => {
                areaList[area._id] = area?.name?.[Constants.DEFAULT_LANGUAGE_CODE] || "";
            });

            // Attach city/area names
            teamResult.forEach(record => {
                if (Array.isArray(record.area_ids)) {
                    record.area_name = record.area_ids.map(aid => areaList[aid] || '').join(', ');
                }
                if (Array.isArray(record.city_id)) {
                    record.city_name = record.city_id.map(cid => cityList[cid] || '').join(', ');
                }
            });

            // Build userFleets and chooseDate
            let userFleets = {};
            let chooseDate = [];
            const dates = getDateRange(new Date(fromDate), new Date(toDate));
            dates.forEach(assignmentDate => {
                const date = newDate(assignmentDate, Constants.DATABASE_DATE_FORMAT);
                chooseDate.push(date);
                
                teamResult.forEach(fleetTime => {
                    const dbDate        =   newDate(fleetTime.date, Constants.DATABASE_DATE_FORMAT);
                    const areaDataId    =   fleetTime._id ? fleetTime._id : '';
                    const userId        =   fleetTime.user_id ? String(fleetTime.user_id) : '';
                   
                    if (date === dbDate) {
                        if (!userFleets[userId]) userFleets[userId] = {};
                       
                        userFleets[userId].name = fleetTime.user_name;
                        userFleets[userId][dbDate] = {
                            city: fleetTime.city_name,
                            area: fleetTime.area_name,
                            status: fleetTime.status,
                            id: areaDataId,
                        };
                    }
                });
            });
            return {
                fleet_availablity: userFleets,
                choose_date: chooseDate,
                status: Constants.STATUS_SUCCESS,
            };
        } catch (err) {
            next(err);
        }
    }

    /**
     * Add or edit fleet area assignment
     */
    async assignArea(req, res, next) {
        try {
            const editable = !!req.params.id;
            const fleetAreaId = req.params.id ? new ObjectId(req.params.id) : new ObjectId();
            const isTeamHead = req.session.user.team_head || false;
            const authUserRoleId = req.session.user.user_role_id;
            const authId = (isTeamHead || authUserRoleId === Constants.CRAVEZ) ? req.session.user._id : req.session.user.parent_id;
            const addedBy = req.session.user && req.session.user._id ? req.session.user._id : '';

            if (isPost(req)) {
                req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);
                // Validation handled by middleware

                let fromDate = req.body.from_date || '';
                let toDate = req.body.to_date || '';
                let areaArray = [];
                let areaUser = req.body.user_name ? req.body.user_name : [];
                let cityId = req.body.city_id ? req.body.city_id : '';
                let areaId = req.body.area_ids ? req.body.area_ids : [];
                if (!Array.isArray(areaUser)) areaUser = [areaUser];
                areaId = areaId && !Array.isArray(areaId) ? [areaId] : areaId;
                cityId = cityId && !Array.isArray(cityId) ? [new ObjectId(cityId)] : arrayToObject(cityId);
                areaId = areaId.map(records => (records ? new ObjectId(records) : ''));

                // If areaId is empty, get all areas for the city
                if (!areaId.length && cityId.length) {
                    const areas = await this.db.collection(Tables.AREAS).distinct('_id', {
                        city_id: { $in: cityId },
                        is_active: Constants.ACTIVE,
                    });
                    areaId = areas;
                }

                // Build areaArray for each date and user
                const dates = getDateRange(new Date(fromDate), new Date(toDate));
                dates.forEach(assignmentDate => {
                    const chooseDate = newDate(assignmentDate, Constants.DATABASE_DATE_FORMAT);
                    areaUser.forEach(areaUserId => {
                        areaArray.push({
                            user_id: new ObjectId(areaUserId),
                            parent_id: new ObjectId(authId),
                            added_by: new ObjectId(addedBy),
                            city_id: cityId,
                            area_ids: areaId,
                            date: getUtcDate(chooseDate + ' ' + Constants.END_DATE_TIME_FORMAT),
                            created: getUtcDate(),
                        });
                    });
                });

                // Upsert each area assignment
                for (const records of areaArray) {
                    await this.collectionDb.updateOne(
                        {
                            date: records.date,
                            parent_id: records.parent_id,
                            user_id: records.user_id,
                        },
                        {
                            $set: {
                                city_id: records.city_id,
                                area_ids: records.area_ids,
                            },
                            $setOnInsert: {
                                added_by: records.added_by,
                                created: getUtcDate(),
                            },
                        },
                        { upsert: true }
                    );
                }

                let message = editable
                    ? res.__('admin.fleet_area_assignment.area_has_been_updated_successfully')
                    : res.__('admin.fleet_area_assignment.area_has_been_assigned_successfully');
                res.send({
                    status: Constants.STATUS_SUCCESS,
                    redirect_url: Constants.WEBSITE_ADMIN_URL + 'fleet_area_assignment',
                    message,
                });

                // Save system logs
                saveSystemLogs(req, res, {
                    user_id: authId,
                    parent_id: fleetAreaId,
                    activity_module: Constants.SYSTEM_LOG_MODULE_FLEET_AREA_ASSIGNMENT,
                    activity_type: Constants.ACTIVITY_TYPE_ASSIGN,
                    additional_details: {},
                });
            } else {
                let areaResponse = {};
                if (editable) {
                    areaResponse = await this.getAreaDetails(req, res, next);
                    if (areaResponse.status !== Constants.STATUS_SUCCESS) {
                        req.flash(Constants.STATUS_ERROR, areaResponse.message);
                        return res.redirect(Constants.WEBSITE_ADMIN_URL + 'fleet_area_assignment');
                    }
                }
                // Get members and cities dropdowns
                const selectedUser = areaResponse.result && areaResponse.result.user_id ? areaResponse.result.user_id : '';
                const conditions = { ...Constants.ADMIN_USER_COMMON_CONDITIONS, parent_id: new ObjectId(authId) };
                const options = {
                    collections: [
                        {
                            collection: Tables.USERS,
                            columns: ['_id', 'full_name'],
                            selected: [selectedUser],
                            conditions,
                        },
                    ],
                };
                const [members, cities] = await Promise.all([
                    getDropdownList(req, res, next, options),
                    getCityList(req, res, next, {
                        city_id: areaResponse.result && areaResponse.result.city_id ? arrayToObject(areaResponse.result.city_id) : '',
                    }),
                ]);
                const usersList = members?.final_html_data?.['0'] || '';
                res.render('add_edit', {
                    result: areaResponse.result || {},
                    is_editable: editable,
                    users_list: usersList,
                    cities,
                    layout: false,
                });
            }
        } catch (err) {
            next(err);
        }
    }

    /**
     * Get area list for a city
     */
    async areaList(req, res, next) {
        try {
            let cityIds = req.body.city_id;
            let areaId = req.body.area_ids ? JSON.parse(req.body.area_ids) : '';
            if (!cityIds) {
                return res.send({
                    status: Constants.STATUS_ERROR,
                    message: res.__('admin.system.something_going_wrong_please_try_again'),
                });
            }
            cityIds = Array.isArray(cityIds) ? cityIds : cityIds.split(',');
            let options = { city_id: arrayToObject(cityIds), area_id: areaId };
            const areaList = await areaListCityWise(req, res, next, options);
            res.send({
                status: Constants.STATUS_SUCCESS,
                area_list: areaList.area_list,
            });
        } catch (err) {
            next(err);
        }
    }
    

    /**
     * Get area assignment details by ID
     */
    async getAreaDetails(req, res, next) {
        try {
            const isTeamHead = req.session.user.team_head || false;
            const authUserRoleId = req.session.user.user_role_id;
            const authId = (isTeamHead || authUserRoleId === Constants.CRAVEZ) ? req.session.user._id : req.session.user.parent_id;
            const areaId = req.params.id || '';
            const result = await this.collectionDb.findOne({
                _id: new ObjectId(areaId),
                parent_id: new ObjectId(authId),
            }, { projection: { _id: 1, date: 1, city_id: 1, area_ids: 1, user_id: 1 } });
            if (!result) {
                return { status: Constants.STATUS_ERROR, message: res.__('admin.system.invalid_access') };
            }
            return { status: Constants.STATUS_SUCCESS, result };
        } catch (err) {
            next(err);
        }
    }
}

export default FleetAreaAssignment; 