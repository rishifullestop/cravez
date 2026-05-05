import { ObjectId } from 'mongodb';
import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, getDropdownList, getUtcDate, toTitleCase, cleanRegex, convertMultipartFormData, sanitizeData, configDatatable, appendFileExistData, moveUploadedFile, getLanguages } from '../../../../utils/index.mjs';
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { parallel as asyncParallel } from 'async';
import clone from 'clone';


class Master {
	constructor(db) {
		this.db = db;
	}

	/**
	 * Function to get master list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	async getMasterList(req, res) {
		let masterType = (req.params.type) ? req.params.type : "";
		let displayType = toTitleCase(masterType.replace(RegExp("_", "g"), " "));

        try {
            if (isPost(req)) {
                let limit = (req.body.length) ? parseInt(req.body.length) : Constants.ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : Constants.DEFAULT_SKIP;
                const collection = this.db.collection(Tables.MASTERS);

				/** Configure Datatable conditions*/
				const dataTableConfig = await configDatatable(req, res, null);
				
				/** Common Conditions **/
				let commonConditions = {
					dropdown_type: masterType
				};

				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				/** Set aggregate pipeline */
				let aggregateData = [
					{$match: dataTableConfig.conditions},
					{$sort: dataTableConfig.sort_conditions},
					{$skip: skip},
					{$limit: limit},
				];
				
				if (masterType == "faq_category") {
					aggregateData.push({
						$lookup: {
							from: Tables.MASTERS,
							localField: "parent_id",
							foreignField: "_id",
							as: "faq_category_details",
						},
					});
				}
				
				aggregateData.push({
					$project: {_id: 1, name: 1, modified: 1, status: 1, image: 1, parent_category: {$arrayElemAt: ["$faq_category_details.name", 0]}}
				});

				const response = await new Promise((resolve, reject) => {
					asyncParallel([
						(callback) => {
							/** Get list of master **/
							collection.aggregate(aggregateData).toArray().then(result => {
								if (!result || result.length <= 0) return callback(null, result);

								/** Append image with full path **/
								appendFileExistData({
									"file_url": Constants.MASTER_FILE_URL,
									"file_path": Constants.MASTER_FILE_PATH,
									"result": result,
									"database_field": "image"
								}).then(response => {
									result = (response && response.result) ? response.result : [];
									callback(null, result);
								}).catch(callback);
							}).catch(callback);
						},
						(callback) => {
							/** Get total number of records in masters collection **/
							collection.countDocuments(commonConditions).then(countResult => {
								callback(null, countResult);
							}).catch(callback);
						},
						(callback) => {
							/** Get filtered records counting in masters **/
							collection.countDocuments(dataTableConfig.conditions).then(filterContResult => {
								callback(null, filterContResult);
							}).catch(callback);
						}
					], (err, response) => {
						if (err) reject(err);
						else resolve(response);
					});
				});

				/** Send response **/
				res.send({
					status: Constants.STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: (response[0]) ? response[0] : [],
					recordsFiltered: (response[2]) ? response[2] : 0,
					recordsTotal: (response[1]) ? response[1] : 0
				});
            } else {
                /** render listing page **/
                req.breadcrumbs(BREADCRUMBS["admin/master/list"]);
                res.render("list", {
                    type: masterType,
                    displayType: displayType,
                    dynamic_variable: displayType,
                    dynamic_url: masterType,
                });
            }
        } catch (error) {return next(error);}
	}

	/**
	 * Function for add master details
	 *
	 * @param req 	As 	Request Data
     * @param res 	As 	Response Data
     * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async addMaster(req, res, next) {
		let masterType = (req.params.type) ? req.params.type : "";
		let displayType = toTitleCase(masterType.replace(RegExp("_", "g"), " "));

		if (isPost(req)) {
			convertMultipartFormData(req, res);

			/** Sanitize Data **/
			req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);

			let allData = req.body;
			req.body 	= clone(allData.master_descriptions[Constants.DEFAULT_LANGUAGE_MONGO_ID]);
			let name 	= (req.body.name) ? req.body.name.trim() : "";			
			let parentId= (allData.parent_id) ? new ObjectId(allData.parent_id) : "";			
			
			try {
				const masters = this.db.collection(Tables.MASTERS);

				/** Upload master image **/
				let fileName = "";
				if (masterType == "category" && req.files && req.files.image){
					const response = await moveUploadedFile(req, res, {
						'image'		: req.files.image,
						'filePath'	: Constants.MASTER_FILE_PATH,
						'oldPath'	: "",
					});
					fileName = response?.fileName || "";

					/** Send error response */
					if (response.status == Constants.STATUS_ERROR) {
						return res.send({'status': Constants.STATUS_ERROR, message: [{'param': 'image', 'msg': response.message}]});
					}
				}

				/** Set master data in a object **/
				let updateData = {
					name: name,
					dropdown_type: masterType,
					master_descriptions: (allData.master_descriptions) ? allData.master_descriptions : {},
					status: Constants.ACTIVE,
					created: getUtcDate(),
					modified: getUtcDate()
				};

				/** Set image in update data  **/
				if (masterType == "category" && fileName) updateData["image"] = fileName;

				/** Set parent id in update data  **/
				if (masterType == "faq_category") updateData["parent_id"] = parentId;

				/** Save master record **/
				await masters.insertOne(updateData);

				/** Send success response **/
				req.flash(Constants.STATUS_SUCCESS, res.__("admin.master.master_has_been_added_successfully", displayType));
				res.send({
					status: Constants.STATUS_SUCCESS,
					redirect_url: Constants.WEBSITE_ADMIN_URL + "master/" + masterType,
					message: res.__("admin.master.master_has_been_added_successfully", displayType),
				});
			} catch (error) {
				next(error);
			}
		} else {
			try {
				const asyncResponse = await new Promise((resolve, reject) => {
					asyncParallel({
						langugages: (callback) => {
							/** Get language list **/
							getLanguages().then(languageList => {
								callback(null, languageList);
							}).catch(callback);
						},
						category_list: (callback) => {
							if (masterType != "faq_category") return callback(null, null);

							/** Set dropdown options for category list **/
							let options = {
								collections: [{
									collection: Tables.MASTERS,
									columns: ["_id", "name"],
									conditions: {
										status: Constants.ACTIVE,
										parent_id: "",
										dropdown_type: "faq_category"
									}
								}]
							};
							
							/**Get category list **/
							getDropdownList(req, res, next, options).then(dropDownResponse => {
								if (dropDownResponse.status != Constants.STATUS_SUCCESS) return callback(dropDownResponse.message, null);
								let categoryList = (dropDownResponse.final_html_data && dropDownResponse.final_html_data["0"]) ? dropDownResponse.final_html_data["0"] : "";
								callback(null, categoryList);
							}).catch(callback);
						}
					}, (err, response) => {
						if (err) reject(err);
						else resolve(response);
					});
				});

				/** Render add page **/
				req.breadcrumbs(BREADCRUMBS["admin/master/add"]);
				res.render("add", {
					type: masterType,
					displayType: displayType,
					dynamic_variable: displayType,
					dynamic_url: masterType,
					language_list: asyncResponse.langugages,
					category_list: asyncResponse.category_list
				});
			} catch (error) {
				/** Send error response **/
				req.flash(Constants.STATUS_ERROR, error);
				return res.redirect(Constants.WEBSITE_ADMIN_URL + "master/" + masterType);
			}
		}
	}

	/**
	 * Function to get master's Detail
	 *
	 * @param req 	As 	Request Data
     * @param res 	As 	Response Data
     * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return json
	 */
	async getMasterDetails(req, res, next) {
		return new Promise(resolve => {
			let masterId = (req.params.id) ? req.params.id : "";
			let masterType = (req.params.type) ? req.params.type : "";

			/** Set aggregate pipeline */
			let aggregateData = [
				{$match: {
					_id: new ObjectId(masterId),
					dropdown_type: masterType
				}},
			];

			/** lookup in condition **/
			if (masterType == "faq_category") {
				aggregateData.push({
					$lookup: {
						from: Tables.MASTERS,
						localField: "parent_id",
						foreignField: "_id",
						as: "faq_category_details"
					}
				});
			}

			aggregateData.push({
				$project: {_id: 1, name: 1, status: 1, master_descriptions: 1, modified: 1, image: 1, parent_id: 1, parent_category: {$arrayElemAt: ["$faq_category_details.name", 0]}}
			});

			/** Get master details **/
			const masters = this.db.collection(Tables.MASTERS);
			masters.aggregate(aggregateData).toArray().then(result => {
				/** Send error response */
				if (!result || result.length <= 0) return resolve({status: Constants.STATUS_ERROR, message: res.__("admin.system.invalid_access")});

				/** Append image with full path **/
				appendFileExistData({
					"file_url": Constants.MASTER_FILE_URL,
					"file_path": Constants.MASTER_FILE_PATH,
					"result": result,
					"database_field": "image"
				}).then(imageResponse => {
					/** Send success response **/
					resolve({
						status: Constants.STATUS_SUCCESS,
						result: imageResponse?.result?.[0] || {}
					});
				}).catch(next);
			}).catch(next);
		});
	}

	/**
	 * Function to update master's Detail
	 *
	 * @param req 	As 	Request Data
     * @param res 	As 	Response Data
     * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async masterUpdate(req, res, next) {
		let masterType = (req.params.type) ? req.params.type : "";
		let id = (req.params.id) ? new ObjectId(req.params.id) : "";
		let displayType = toTitleCase(masterType.replace(RegExp("_", "g"), " "));

		if (isPost(req)) {
			convertMultipartFormData(req, res);

			/** Sanitize Data **/
			req.body = sanitizeData(req.body, Constants.NOT_ALLOWED_TAGS_XSS);

			let allData = req.body;
			req.body = clone(allData.master_descriptions[Constants.DEFAULT_LANGUAGE_MONGO_ID]);
			let name = (req.body.name) ? req.body.name.trim() : "";
			let parentId = (allData.parent_id) ? new ObjectId(allData.parent_id) : "";
			
			
			try {
				/** Check name is unique **/
				const masters = this.db.collection(Tables.MASTERS);

				/** Set options for upload image **/
				let fileName = "";
				if (masterType == "category" && req.files && req.files.image){
					const response = await moveUploadedFile(req, res, {
						'image'		: req.files.image,
						'filePath'	: Constants.MASTER_FILE_PATH,
						'oldPath'	: "",
					});
					fileName = response?.fileName || "";

					/** Send error response */
					if (response.status == Constants.STATUS_ERROR) {
						return res.send({'status': Constants.STATUS_ERROR, message: [{'param': 'image', 'msg': response.message}]});
					}
				}
				
				/** set master data in a object **/
				let updateData = {
					name: name,
					master_descriptions: (allData.master_descriptions) ? allData.master_descriptions : {},
					modified: getUtcDate()
				};

				/** set image in update data **/
				if (masterType == "category" && fileName) updateData["image"] = fileName;

				/** set parent id in update data **/
				if (masterType == "faq_category") updateData["parent_id"] = parentId;

				/** Update master record **/
				await masters.updateOne({_id: id}, {$set: updateData});
				
				/** Send success response **/
				req.flash(Constants.STATUS_SUCCESS, res.__("admin.master.master_details_has_been_updated_successfully", displayType));
				res.send({
					status: Constants.STATUS_SUCCESS,
					redirect_url: Constants.WEBSITE_ADMIN_URL + "master/" + masterType,
					message: res.__("admin.master.master_details_has_been_updated_successfully", displayType),
				});
			} catch (error) {
				next(error);
			}
		} else {
			try {
				const asyncResponse = await new Promise((resolve, reject) => {
					asyncParallel({
						languages: (callback) => {
							/** Get language list **/
							getLanguages().then(languageList => {
								callback(null, languageList);
							}).catch(callback);
						},
						master_details: (callback) => {
							/** Get master details **/
							this.getMasterDetails(req, res, next).then(masterDetailsResponse => {
								if (masterDetailsResponse.status != Constants.STATUS_SUCCESS) return callback(masterDetailsResponse.message, null);

								let result = (masterDetailsResponse.result) ? masterDetailsResponse.result : {};
								callback(null, result);
							}).catch(callback);
						}
					}, (err, response) => {
						if (err) reject(err);
						else resolve(response);
					});
				});

				let languageList = (asyncResponse.languages) ? asyncResponse.languages : {};
				let masterResult = (asyncResponse.master_details) ? asyncResponse.master_details : {};
				var parentId = (masterResult.parent_id) ? new ObjectId(masterResult.parent_id) : "";

				const categoryResponse = await new Promise((resolve, reject) => {
					asyncParallel({
						category_list: (callback) => {
							if (masterType != "faq_category") return callback(null, null);

							/** Set dropdown options for category list **/
							let options = {
								collections: [{
									collection: Tables.MASTERS,
									columns: ["_id", "name"],
									selected: [parentId],
									conditions: {
										parent_id: "",
										_id: {$ne: id},
										dropdown_type: "faq_category",
										$or: [
											{status: Constants.ACTIVE},
											{_id: parentId}
										]
									}
								}]
							};

							/**Get category list **/
							getDropdownList(req, res, next, options).then(listResponse => {
								if (listResponse.status != Constants.STATUS_SUCCESS) return callback(listResponse.message, null);

								let categoryList = (listResponse.final_html_data && listResponse.final_html_data["0"]) ? listResponse.final_html_data["0"] : "";
								callback(null, categoryList);
							}).catch(callback);
						}
					}, (asyncErr, asyncResponse) => {
						if (asyncErr) reject(asyncErr);
						else resolve(asyncResponse);
					});
				});

				/** Render edit page **/
				req.breadcrumbs(BREADCRUMBS["admin/master/edit"]);
				res.render("edit", {
					language_list: languageList,
					result: masterResult,
					type: masterType,
					displayType: displayType,
					dynamic_variable: displayType,
					dynamic_url: masterType,
					category_list: (categoryResponse.category_list) ? categoryResponse.category_list : ''
				});
			} catch (error) {
				/** Send error response **/
				req.flash(Constants.STATUS_ERROR, error);
				return res.redirect(Constants.WEBSITE_ADMIN_URL + "master/" + masterType);
			}
		}
	}

	/**
	 * Function for update master status
	 *
	 * @param req 	As 	Request Data
     * @param res 	As 	Response Data
     * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async updateMasterStatus(req, res, next) {
		let masterType = (req.params.type) ? req.params.type : "";
		let masterId = (req.params.id) ? req.params.id : "";
		let masterStatus = (req.params.status == Constants.ACTIVE) ? Constants.DEACTIVE : Constants.ACTIVE;
		let displayType = toTitleCase(masterType.replace(RegExp("_", "g"), " "));

		try {
			/** Update master status **/
			const masters = this.db.collection(Tables.MASTERS);
			await masters.updateOne({
				_id: new ObjectId(masterId)
			}, {
				$set: {
					status: masterStatus,
					modified: getUtcDate()
				}
			});

			/** Send success response **/
			req.flash(Constants.STATUS_SUCCESS, res.__("admin.master.status_has_been_updated_successfully", displayType));
			res.redirect(Constants.WEBSITE_ADMIN_URL + "master/" + masterType);
		} catch (error) {
			next(error);
		}
	}
}

export default Master; 