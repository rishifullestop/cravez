import { ObjectId } from 'mongodb';
import * as Constants from "../../../../config/global_constant.mjs";
import Tables from '../../../../config/database_tables.mjs';
import { isPost, configDatatable} from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { saveUserActivity} from "../../../../services/index.mjs";

export default class ImportManager {

	constructor(db) {
		this.db = db;
		this.collectionDb = db.collection(Tables.IMPORT_REQUESTS);
	}

	/**
	* Function to get import managers list
	*
	* @param req 	As Request Data
	* @param res 	As Response Data
	*
	* @return render/json
	*/
	async getImportManagerList(req,res){
		if(isPost(req)){
			let limit 	=	(req.body.length) ? parseInt(req.body.length) :Constants.ADMIN_LISTING_LIMIT;
			let skip 	=	(req.body.start)  ? parseInt(req.body.start)  :Constants.DEFAULT_SKIP;

			/** Configure Datatable conditions*/
			const dataTableConfig = await configDatatable(req, res, null);


			// Get list or count of import managers
			let dbRes = await this.collectionDb.aggregate([
				{ $match: dataTableConfig.conditions },
				{$facet : {
					list : [
						{$sort: dataTableConfig.sort_conditions },
						{$skip: skip },
						{$limit: limit },
						{$lookup: {
							from: Tables.RESTAURANTS,
							localField: "restaurant_id",
							foreignField: "_id",
							as: "restaurant_details"
						}},
						{$project: {
							_id:1,note:1,imported_file:1,status:1,created:1,
							restaurant_name: {$arrayElemAt: ["$restaurant_details.name." + Constants.DEFAULT_LANGUAGE_CODE, 0]},
						}}
					],
					count: [
						{$count: "count"},
					],
				}}
			]).toArray();			

			/** Send response **/
			res.send({
				status: Constants.STATUS_SUCCESS,
				draw: dataTableConfig.result_draw,
				data			:   dbRes?.[0]?.list || [],
				recordsTotal	:	dbRes?.[0]?.count?.[0]?.count || 0,
				recordsFiltered	:  	dbRes?.[0]?.count?.[0]?.count || 0
			}); 
		}else{
			/** render import managers listing page **/
			req.breadcrumbs(BREADCRUMBS['admin/import_managers/list']);
			res.render('list');
		}
	};//End getImportManagerList()

	/**
	* Function for update import manager's status
	*
	* @param req 	As Request Data
	* @param res 	As Response Data
	* @param next 	As Callback argument to the middleware function
	*
	* @return null
	*/
	async updateImportManagerStatus(req, res, next){
		try{
			let importManagerId 	= req?.params?.id || "";
			let importManagerStatus = req?.params?.status == Constants.PENDING ? Constants.IN_REVIEW : Constants.PENDING;
			let authId 				= req?.session?.user?._id || "";

			/** Update import manager record **/
			await this.collectionDb.updateOne({
				_id : new ObjectId(importManagerId)
			},
			{$set : {
				status : importManagerStatus
			}});

			/** Send success response **/
			req.flash(Constants.STATUS_SUCCESS,res.__("admin.import_managers.import_manager_status_has_been_updated_successfully"));
			res.redirect(Constants.WEBSITE_ADMIN_URL+"import_managers");
			
			/** Save user activities **/
			saveUserActivity(req,res,{
				user_id 			: authId ? new ObjectId(authId) : "",
				parent_type 		: Constants.IMPORT_MANAGERS,
				parent_id 			: new ObjectId(importManagerId),
				activity_type		: Constants.ACTIVITY_UPDATE_STATUS,
				additional_details	: {status : importManagerStatus}
			});
		}catch(error){
			return next(error);
		}
	};//End updateImportManagerStatus()

	/**
	* Function for download file
	*
	* @param req 	As Request Data
	* @param res 	As Response Data
	* @param next 	As Callback argument to the middleware function
	*
	* @return null
	*/
	async downloadFile(req, res, next){
		try{
			/** find import manager record **/
			let result = await this.collectionDb.findOne({_id: new ObjectId(req.params.id)},{projection: {_id:1,imported_file:1}});
			
			if(!result) {
				req.flash(Constants.STATUS_ERROR,res.__("admin.system.invalid_access"));
				return res.redirect(Constants.WEBSITE_ADMIN_URL+"import_managers");
			}
	
			let importedFile  = result.imported_file;
			let fileData	  = importedFile.split('.');
			let extension	  = fileData.pop().toLowerCase();
			res.download(Constants.IMPORT_MANAGER_FILE_PATH+importedFile,"restaurant_branch."+extension);
		}catch(error){
			return next(error);
		}
	};//End downloadFile()
}

