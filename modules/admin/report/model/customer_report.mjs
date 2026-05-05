import { ObjectId } from 'mongodb';
import { parallel as asyncParallel} from 'async';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { isPost,newDate, exportToExcel, configDatatable, subtractDate } from '../../../../utils/index.mjs';

// Model for Customer Report
export default class CustomerReport {

    constructor(db) {
        this.db = db;
    }

	/**
	 * Function to get customer order report list
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 *
	 * @return render/json
	 */
	async getCustomerReportList(req,res,next){
		try{
			let status		= (req.query.active)	? req.query.active 			: '';
			let newUsers	= (req.query.new_users)	? req.query.new_users 		: false;
			let blacklisted	= (req.query.blacklisted)	? req.query.blacklisted 	: '';
			let corporateId	= (req.query.corporate_id)	? req.query.corporate_id 	: '';
			if(isPost(req)){
				const collection  	= 	this.db.collection(Tables.USERS);

				let dataTableConfig = await configDatatable(req, res, null);

				let limit	=	(req.body.length) 	? 	parseInt(req.body.length) 	:Constants.ADMIN_LISTING_LIMIT;
				let skip	= 	(req.body.start)  	? 	parseInt(req.body.start)	:Constants.DEFAULT_SKIP;

				let commonConditions = {
					user_role_id : Constants.CUSTOMER,
					is_deleted 	 : Constants.NOT_DELETED
				};
				if(status) 		commonConditions['active']				=	parseInt(status);
				if(blacklisted) commonConditions['is_black_list']		=	true;
				if(corporateId) commonConditions['corporate_id']		=	new ObjectId(corporateId);
				if(newUsers) 	commonConditions['created']				=	{$lte : newDate(),$gte : subtractDate(Constants.RECENT_CUSTOMER_DAYS*Constants.HOURS_IN_A_DAY)};
				dataTableConfig.conditions = Object.assign(commonConditions,dataTableConfig.conditions);

				asyncParallel({
					records : (callback)=>{
						/** Get list of customer **/
						collection.find(dataTableConfig.conditions,{_id : 1, full_name : 1,email : 1, modified : 1, active : 1,client_type:1,is_guest:1,is_black_list:1}).sort(dataTableConfig.sort_conditions).limit(limit).skip(skip).toArray().then(result=>{
							callback(null, result);
						}).catch(next);
					},
					filter_records:(callback)=>{
						/** Get filtered records counting **/
						collection.countDocuments(dataTableConfig.conditions).then(countResult => {
							callback(null, countResult);
						}).catch(next);
					}
				},(err, response)=>{
					/** Send response **/
					res.send({
						status			: (!err) ? Constants.STATUS_SUCCESS 		: Constants.STATUS_ERROR,
						draw			: dataTableConfig.result_draw,
						data			: (response.records) ? response.records 	: [],
						recordsFiltered	: response.filter_records,
						recordsTotal	: response.filter_records,
					});
				});
			}else{
				/** render customer listing page **/
				req.breadcrumbs(BREADCRUMBS['admin/report/customer_list']);
				res.render('list_customer',{
					status 		 : status,
					blacklisted  : blacklisted,
					new_users  	 : newUsers,
					corporate_id : corporateId
				});
			}
		}catch(err){
			next(err);
		}
	};//End getCustomerOrderReportList()

	/**
	 *  Function for export Customer Report
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return null
	*/
	async exportCustomerReport(req, res, next) {
		try{
			let sortingField 	= (req.query.sort_field) ? req.query.sort_field : "_id";
			let sortingDir 		= (req.query.sort_dir) ? req.query.sort_dir : "asc";
			let sortOrder 		= (sortingDir == 'asc') ? Constants.SORT_ASC : Constants.SORT_DESC;
			let name = (req.query.name) ? req.query.name : "";
			let email = (req.query.email) ? req.query.email : "";

			let authId 		= (req.session.user && req.session.user._id) ? req.session.user._id : "";
			let status 		= (req.query.status) ? req.query.status : '';
			let newUsers 	= (req.query.new_users) ? req.query.new_users : false;
			let blacklisted = (req.query.blacklisted) ? req.query.blacklisted : '';
			let corporateId = (req.query.corporate_id) ? req.query.corporate_id : '';

			let exportConditions = {
				user_role_id: Constants.CUSTOMER,
				is_deleted	: Constants.NOT_DELETED
			};
			if (status) exportConditions['active'] = parseInt(status);
			if (blacklisted) exportConditions['is_black_list'] = true;
			if (corporateId) exportConditions['corporate_id'] = new ObjectId(corporateId);
			if (newUsers) exportConditions['created'] = { $lte: newDate(), $gte: subtractDate(Constants.RECENT_CUSTOMER_DAYS * Constants.HOURS_IN_A_DAY) };

			if (name) exportConditions.full_name = { $regex: name, $options: 'i' };
			if (email) exportConditions.email = { $regex: email, $options: 'i' };

			let sortConditions = {};
			sortConditions[sortingField] = sortOrder;


			/** Get details **/
			const collection = this.db.collection(Tables.USERS);
			collection.find(exportConditions, { _id: 1, full_name: 1, email: 1, modified: 1, active: 1, client_type: 1, is_guest: 1, is_black_list: 1 }).sort(sortConditions).toArray().then(findResult => {
				let temp = [];
				let commonColls = [];

				/** Define excel heading label **/

				commonColls = [
					res.__("admin.user_management.full_name"),
					res.__("admin.user_management.email"),
					res.__("admin.system.status"),
					res.__("admin.system.modified"),
				];

				if (findResult && findResult.length > 0) {
					findResult.map(records => {

						let status = (records.active == Constants.ACTIVE) ? res.__("admin.system.active") : res.__("admin.system.deactive");
						let buffer = [
							(records.full_name) ? records.full_name : "",
							(records.email) ? records.email : "",
							status,
							(records.modified) ? newDate(records.modified, Constants.AM_PM_FORMAT_WITH_DATE) : '',
						];
						temp.push(buffer);
					});
				}

				/**  Function to export data in excel format **/
				exportToExcel(req, res, {
					file_prefix		: "CustomerReport",
					heading_columns	: commonColls,
					export_data		: temp
				});
			}).catch(next);
		}catch(err){
			next(err);
		}
	};// end exportCustomerReport()
}
