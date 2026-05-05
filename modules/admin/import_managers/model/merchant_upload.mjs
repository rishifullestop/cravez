import { ObjectId } from 'mongodb';
import { readFile } from 'fs';
import * as Constants from "../../../../config/global_constant.mjs";
import clone from 'clone';
import Tables from '../../../../config/database_tables.mjs';
import { isPost, sanitizeData, getUtcDate, moveUploadedFile, getDatabaseSlug, getRandomString, generateMD5Hash, getRestaurantId, getUniqueId, getRestaurantDropdowns, cleanRegex, exportToExcel,arrayToObject} from "../../../../utils/index.mjs";
import BREADCRUMBS from '../../../../breadcrumbs.mjs';
import { sendMailToUsers} from "../../../../services/index.mjs";
import xlsx from 'xlsx';
import { each as asyncEach, parallel as asyncParallel } from "async";
const readFileXlsx = xlsx.readFile;

export default class MerchantUpload {

	constructor(db) {
		this.db = db;
	}

	/**
	* Function to upload merchant files
	*
	* @param req 	As Request Data
	* @param res 	As Response Data
	*
	* @return render/json
	*/
	async merchantUpload(req,res,next){
		if(isPost(req)){
			req.body			= sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let restaurant 		= req?.body?.restaurant ||  "";
			let uploadAction	= req?.body?.upload_action ||  "";

			let requestFile 	= req?.files?.file ||  "";
			let errorMsg  = [];

			if(!uploadAction) errorMsg.push({ 'param': 'upload_action', 'msg': res.__("admin.merchant_upload.please_select_upload_action") });

			if(!requestFile) errorMsg.push({ 'param': 'file', 'msg': res.__("admin.merchant_upload.please_select_file") });

			if(!restaurant && uploadAction && Constants.MERCHANT_UPLOAD_ACTION?.[uploadAction]?.select_restaurant){
				errorMsg.push({ 'param': 'restaurant', 'msg': res.__("admin.merchant_upload.please_select_restaurant") });
			}

			/** Send error response **/
			if(errorMsg.length > 0) return res.send({ status: Constants.STATUS_ERROR, message: errorMsg });

			/** Upload  file **/
			moveUploadedFile(req,res,{
				image				: requestFile,
				filePath			: Constants.MERCHANT_FILES_FILE_PATH,
				allowedExtensions 	: Constants.ALLOWED_MERCHANT_FILE_EXTENSIONS,
				allowedImageError 	: Constants.ALLOWED_MERCHANT_FILE_ERROR_MESSAGE,
				allowedMimeTypes 	: Constants.ALLOWED_MERCHANT_FILE_MIME_EXTENSIONS,
				allowedMimeError 	: Constants.ALLOWED_MERCHANT_FILE_MIME_ERROR_MESSAGE
			}).then(imageResponse=>{

				/** Send error response **/
				if(imageResponse.status == Constants.STATUS_ERROR) return res.send({status : Constants.STATUS_ERROR,message	: [{'param':'file','msg':imageResponse.message}]});

				/**Read file and set array  */
				let newFile 	= 	(imageResponse.fileName) ? imageResponse.fileName : "";
				let extension	=	newFile.split('.').pop().toLowerCase();

				if(extension == Constants.CSV_FILE_EXTENSION){
					try{
						/** Read csv file */
						let finalArray  	= [];
						let headingColumn 	= Constants.MERCHANT_UPLOAD_ACTION[uploadAction].heading_columns;
						var workbook 		= readFileXlsx(Constants.MERCHANT_FILES_FILE_PATH+newFile);
						var sheetNameList 	= workbook.SheetNames;
						var firstSheetName  = workbook.SheetNames[0];

						/* Get worksheet */
						var worksheet 		= workbook.Sheets[firstSheetName];
						let totalRowsData 	= worksheet['!ref'].split(":");
						let totalRows 		= totalRowsData[1].replace(/[^0-9]+/g, "");
						if(totalRows == ""){
							totalRows = 0;
						}else{
							totalRows=parseInt(totalRows);
						}

						if(worksheet && worksheet instanceof Object && Object.keys(worksheet).length>0){
							let totalColumns 	= headingColumn;
							let totalRows 		= 0;

							/* Remove Extra columns from object */
							if(worksheet['!margins']){
								delete worksheet['!margins'];
							}

							if(worksheet['!ref']){
								/* Calculate total rows */
								let totalRowsData 	= worksheet['!ref'].split(":");
								totalRows			= (totalRowsData[1]) ? totalRowsData[1] : 0;
								totalRows			= totalRows.replace(/[^0-9]+/g, "");
								if(totalRows == ""){
									totalRows = 0;
								}else{
									totalRows=parseInt(totalRows);
								}
								delete worksheet['!ref'];
							}

							/* Column Names */
							/* This array is valid for less then 156 columns */
							let columnSeries= [
								"A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
								"AA","AB","AC","AD","AE","AF","AG","AH","AI","AJ","AK","AL","AM","AN","AO","AP","AQ","AR","AS","AT","AU","AV","AW","AX","AY","AZ",
								"BA","BB","BC","BD","BE","BF","BG","BH","BI","BJ","BK","BL","BM","BN","BO","BP","BQ","BR","BS","BT","BU","BV","BW","BX","BY","BZ",
								"CA","CB","CC","CD","CE","CF","CG","CH","CI","CJ","CK","CL","CM","CN","CO","CP","CQ","CR","CS","CT","CU","CV","CW","CX","CY","CZ",
								"DA","DB","CD","DD","DE","DF","DG","DH","DI","DJ","DK","DL","DM","DN","DO","DP","DQ","DR","DS","DT","DU","DV","DW","DX","DY","DZ",
								"EA","EB","CE","DE","EE","EF","EG","EH","EI","EJ","EK","EL","EM","EN","EO","EP","EQ","ER","ES","ET","EU","EV","EW","EX","EY","EZ"
							];

							/* Arrange array according to requirement */
							for(let i=1;i<=totalRows;i++){
								if(!finalArray[i-1]){
									finalArray[i-1] = [];
								}
								for(let j=0;j<totalColumns;j++){
									let cellValue = (columnSeries[j] && worksheet[columnSeries[j]+i] && typeof worksheet[columnSeries[j]+i].v !== typeof undefined) ? worksheet[columnSeries[j]+i]["v"] :"";
									if(cellValue && cellValue.constructor == String){
										cellValue = cellValue.replace(/[`]/g,"");
									}
									finalArray[i-1][j] = cellValue;
								}
							}
						}
						/* Delete first element (heading)*/
						finalArray.shift();

						/**Send response */
						res.send({status : Constants.STATUS_SUCCESS,result :finalArray});
					}catch(e){
						console.error('Error in file parsing in merchant upload');
						console.error(e);
						res.send({
							status: Constants.STATUS_ERROR,
							message: res.__("system.something_going_wrong_please_try_again")
						})
					}

				}else{
					readFile(Constants.MERCHANT_FILES_FILE_PATH+newFile, "utf8", function readFileCallback(err, data){
						if(err) return next(err);
						let contentLines	= (data) ? data.split(/\r?\n/) : [];

						let finalArray		= [];
						let headingFlag		= false;
						contentLines.map((column,index)=>{
							if(!headingFlag) {
								headingFlag = true;
								return;
							}
							let contentArray	= column.split(Constants.MERCHANT_FILE_COLUMN_SEPARATOR);
							finalArray.push(contentArray);
						});

						/**Send response */
						res.send({status : Constants.STATUS_SUCCESS,result :finalArray});
					});
				}
			});
		}else{
			getRestaurantDropdowns(req,res,next,{}).then(restaurantList=>{

				/** render merchant upload page **/
				req.breadcrumbs(BREADCRUMBS['admin/merchant_upload/list']);
				res.render('merchant_upload',{
					restaurant_list : restaurantList
				});
			}).catch(next);
		}
	}//End merchantUpload()

	/**
	 * Function for add category
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async addCategory(req,res,next){
		if(isPost(req)){
			req.body			= sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let categories		= (req.body.categories) 	? req.body.categories 		: [];
			let restaurantSlug	= (req.body.restaurant_slug)? req.body.restaurant_slug	: "";

			if(categories.length < 1) return res.send({status : Constants.STATUS_ERROR,message : [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg':res.__("admin.system.something_going_wrong_please_try_again")}]});

			/**Get restaurant id */
			let restaurantId	= "";
			if(restaurantSlug) restaurantId = await getRestaurantId(req,res,next,{slug : restaurantSlug});

			/**Check errors and if no error set array to save data */
			const restaurant_categories	= 	this.db.collection(Tables.RESTAURANT_CATEGORIES);
			let errors			= [];
			let dataToBeSaved	= [];
			let authUserId		= req?.session?.user?._id ||"";
			let uniqueNames 	= {en : {},ar:{}};
			let dataToBeExport	= [];
			asyncEach(categories, (category, callback) => {
				if(category){
					if(!category.category_old_id || category.category_old_id == ""){
						let param = "category_old_id_"+category.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_category_old_id")});
					}

					if(!category.category_id || category.category_id == ""){
						let param = "category_id_"+category.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_category_id")});
					}

					if(!category.name_in_english || category.name_in_english == ""){
						let param = "name_in_english_"+category.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_name_in_english")});
					}

					if(!category.name_in_arabic || category.name_in_arabic == ""){
						let param = "name_in_arabic_"+category.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_name_in_arabic")});
					}

					if(!category.display_order || category.display_order == ""){
						let param = "display_order_"+category.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_display_order")});
					}

					if(category.display_order && !category.display_order.match(Constants.CATEGORY_DISPLAY_ORDER_REGEX)){
						let param = "display_order_"+category.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.value_should_be_numeric")});
					}

					/** check duplicate entry in form*/
					if(category.name_in_english){
						let tempEnName   = category.name_in_english.trim().toLowerCase();
						let param = "name_in_english_"+category.index;
						if(uniqueNames.en[tempEnName]){
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.whoops_you_have_entered_an_already_used_name_in_english")});
						}else{
							uniqueNames.en[tempEnName] = true;
						}
					}
					/** check duplicate entry in form*/
					if(category.name_in_arabic){
						let tempArName   = category.name_in_arabic.trim().toLowerCase();
						let param = "name_in_arabic_"+category.index;
						if(uniqueNames.ar[tempArName]){
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.whoops_you_have_entered_an_already_used_name_in_arabic")});
						}else{
							uniqueNames.ar[tempArName] = true;
						}
					}
					/** check active */
					let param = "is_active_"+category.index;
					if(!category.is_active || category.is_active == ""){
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_active_status")});
					}else{
						let active   = category.is_active;
						if(active != Constants.ACTIVE && active != Constants.DEACTIVE){
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_active_value_in_0_and_1")});
						}
					}

					/** Push data in array if not error */
					if(errors.length == 0){
						asyncParallel({
							category_details : (callback)=>{
								/** find category name in both language if already exists **/
								restaurant_categories.findOne({
									restaurant_slug : restaurantSlug,
									$or : [
										{ "name.en" : {$regex : '^'+cleanRegex(category.name_in_english)+'$',$options : 'i'}},
										{ "name.ar" : {$regex : '^'+cleanRegex(category.name_in_arabic)+'$',$options : 'i'}}
									],
								},{projection: { _id: 1,name:1}}).then(result=>{
									callback(null,result);
								}).catch(next);
							},
							tmp_category_details : (callback)=>{
								/** find category name in both language if already exists **/
								const tmp_restaurant_categories = this.db.collection(Tables.TMP_RESTAURANT_CATEGORIES);
								tmp_restaurant_categories.findOne({
									restaurant_slug : restaurantSlug,
									$or : [
										{ "name.en" : {$regex : '^'+cleanRegex(category.name_in_english)+'$',$options : 'i'}},
										{ "name.ar" : {$regex : '^'+cleanRegex(category.name_in_arabic)+'$',$options : 'i'}}
									],
								},{projection: { _id: 1,name:1}}).then(result=>{
									callback(null,result);
								}).catch(next);
							},
							category_unique_id : (callback)=>{
								/** get category unqiue id **/
								getUniqueId(req,res,next,{type:"categories"}).then(uniqueIdResponse=>{
									callback(null,uniqueIdResponse?.result || "");
								}).catch(next);
							},
							is_valid_cuisine : (callback)=>{
								/** To check cuisine id selected for same restaturant */
								const cuisines				= this.db.collection(Tables.CUISINES);
								const restaurant_cuisines	= this.db.collection(Tables.RESTAURANT_CUISINES);

								cuisines.findOne({
									cuisine_id : {$regex : '^'+cleanRegex(category.category_id)+'$',$options : 'i'}
								},{projection: {_id: 1}}).then(result=>{
									if(!result) return callback(null,false);

									restaurant_cuisines.findOne({
										restaurant_id:new ObjectId(restaurantId),
										cuisine_id	:new ObjectId(result._id)
									},{projection: { _id: 1}}).then(cuisineResult=>{
										let isValid = (cuisineResult) ? true : false;
										callback(null,isValid);
									}).catch(next);
								}).catch(next);
							}
						},(parallelErr,response)=> {
							if(parallelErr) return next(parallelErr);

							/**Check names is unique */
							let categoryName 	 = (response.category_details && response.category_details.name)  		? response.category_details.name 	:"";
							let tmpCategoryName	 = (response.tmp_category_details && response.tmp_category_details.name)? response.tmp_category_details.name:"";

							if(categoryName || tmpCategoryName){
								if((categoryName.en && categoryName.en.toLowerCase() == category.name_in_english.toLowerCase()) || (tmpCategoryName.en && tmpCategoryName.en.toLowerCase() == category.name_in_english.toLowerCase())){
									if (!errors) errors = [];
									errors.push({'param':'name_in_english_'+category.index,'msg':res.__("admin.merchant_upload.whoops_you_have_entered_an_already_used_name_in_english")});
								}
								if((categoryName.ar && categoryName.ar.toLowerCase() == category.name_in_arabic.toLowerCase()) || (tmpCategoryName.ar && tmpCategoryName.ar.toLowerCase() == category.name_in_arabic.toLowerCase())){
									if (!errors) errors = [];
									errors.push({'param':"name_in_arabic_"+category.index,'msg':res.__("admin.merchant_upload.whoops_you_have_entered_an_already_used_name_in_arabic")});
								}
							}

							if(!response.is_valid_cuisine) errors.push({'param':"category_id_"+category.index,'msg':res.__("admin.merchant_upload.this_category_not_belongs_to_selected_reataurant")});

							/** Push data in array */
							if(errors.length == 0){
								let tempData = {
									category_old_id : category.category_old_id,
									category_id 	: response.category_unique_id,
									name			: {
										ar : category.name_in_arabic,
										en : category.name_in_english
									},
									order  			: parseInt(category.display_order),
									is_active		: parseInt(category.is_active),
									cuisine_id		: new ObjectId("5df33f2bf4fca61479b0df3c"),
									restaurant_slug	: restaurantSlug,
									restaurant_id	: restaurantId,
									added_by		: new ObjectId(authUserId),
									created			: getUtcDate(),
									modified		: getUtcDate()
								};
								dataToBeSaved.push(tempData);
								dataToBeExport.push([
									response.category_unique_id,
									category.category_old_id,
									category.name_in_english,
									category.name_in_arabic,
									parseInt(category.display_order)
								]);
							}
							callback(null);
						});
					}else{
						callback(null);
					}
				}
			},(asyncErr)=>{
				if(asyncErr) return next(asyncErr);

				/** Send error response **/
				if(errors.length > 0) return res.send({ status	: Constants.STATUS_ERROR, message	: errors});

				if(dataToBeSaved.length < 1) return res.send({status : Constants.STATUS_ERROR,message : [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg':res.__("admin.system.something_going_wrong_please_try_again")}]});

				/**Save data */
				restaurant_categories.insertMany(dataToBeSaved,{forceServerObjectId:true}).then(result=>{

					/** Save export data */
					let headings  = [
						res.__("admin.merchant_upload.category_id"),
						res.__("admin.merchant_upload.category_old_id"),
						res.__("admin.merchant_upload.name_in_english"),
						res.__("admin.merchant_upload.name_in_arabic"),
						res.__("admin.merchant_upload.category_display_order"),
					];
					const tmp_imports	= 	this.db.collection(Tables.TMP_IMPORTS);
					tmp_imports.insertOne({
						upload_action : Constants.MERCHANT_UPLOAD_CATEGORY,
						headings 	  : headings,
						data 	 	  : dataToBeExport,
					}).then(exportResult=>{

						/** Send response */
						let exportId = exportResult?.insertedId || "";
						res.send({
							status 		:Constants.STATUS_SUCCESS,
							message 	:res.__("admin.merchant_upload.categories_has_been_added_successfully"),
							redirect_url:Constants.WEBSITE_ADMIN_URL+"merchant_upload/export_data/"+exportId,
						});
					}).catch(next);
				}).catch(next);
			});
		}else{
			/** Render add category page  **/
			res.render('add_category',{
				layout	: false
			});
		}
	}//End addCategory()

	/**
	 * Function for add main category
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async addMainCategory(req,res,next){
		if(isPost(req)){
			req.body			= sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let categories		= (req.body.categories) 	? req.body.categories 		: [];
			let restaurantSlug	= (req.body.restaurant_slug)? req.body.restaurant_slug	: "";

			if(categories.length < 1) return res.send({status : Constants.STATUS_ERROR,message : [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg':res.__("admin.system.something_going_wrong_please_try_again")}]});

			/**Get restaurant id */
			let restaurantId	= "";
			if(restaurantSlug) restaurantId = await getRestaurantId(req,res,next,{slug : restaurantSlug});

			/**Check errors and if no error set array to save data */
			let errors				= [];
			let dataToBeSaved		= [];
			let mainCategoryList	= {};
			let dataToBeExport		= [];
			asyncEach(categories, (category, callback) => {
				if(category){
					if(!category.cuisine_id || category.cuisine_id == ""){
						let param = "cuisine_id_"+category.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_select_main_category_name")});
					}

					/**Check selected main category is unique */
					if(category.cuisine_id){
						let param = "cuisine_id_"+category.index;
						if(mainCategoryList[category.cuisine_id]){
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.whoops_you_have_select_already_used_main_category_name")});
						}else{
							mainCategoryList[category.cuisine_id] = true;
						}
					}

					/** Push data in array */
					if(errors.length == 0 && category.is_available){

						let tempData = {
							cuisine_id		: new ObjectId(category.cuisine_id),
							restaurant_id	: new ObjectId(restaurantId),
							created			: getUtcDate(),
							modified		: getUtcDate()
						};
						dataToBeSaved.push(tempData);

						/** Find Cuisine name */
						const cuisines = this.db.collection(Tables.CUISINES);
						cuisines.findOne({_id: new ObjectId(category.cuisine_id)},{_id:1,"name.en" : 1,cuisine_id : 1}).then(cuisineResult=>{

							// if(!cuisineResult) return return res.send({status : STATUS_ERROR,message : [{'param':ADMIN_GLOBAL_ERROR,'msg':res.__("admin.system.something_going_wrong_please_try_again")}]});

							dataToBeExport.push([
								cuisineResult.cuisine_id,
								cuisineResult.name.en,
								(category.is_available) ? true : false
							]);
						}).catch(next);
					}
					callback(null);
				}else{
					callback(null);
				}
			},(asyncErr)=>{
				if(asyncErr) return next(asyncErr);

				/** Send error response **/
				if(errors.length > 0) return res.send({status : Constants.STATUS_ERROR, message : errors});

				if(dataToBeSaved.length < 1) return res.send({status : Constants.STATUS_ERROR,message : [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg':res.__("admin.merchant_upload.please_select_atleast_one")}]});

				/**Save data */
				const restaurant_cuisines	= this.db.collection(Tables.RESTAURANT_CUISINES);
				restaurant_cuisines.insertMany(dataToBeSaved,{forceServerObjectId:true}).then(result=>{

					/** Save export data */
					let headings  = [
						res.__("admin.merchant_upload.main_category_id"),
						res.__("admin.merchant_upload.main_category_name"),
						res.__("admin.merchant_upload.is_available")
					];
					const tmp_imports	= 	this.db.collection(Tables.TMP_IMPORTS);
					tmp_imports.insertOne({
						upload_action : Constants.MERCHANT_UPLOAD_MAIN_CATEGORY,
						headings 	  : headings,
						data 	 	  : dataToBeExport,
					}).then(exportResult=>{

						/** Send response */
						let exportId = exportResult?.insertedId || "";
						res.send({
							status 		:Constants.STATUS_SUCCESS,
							message 	:res.__("admin.merchant_upload.main_categories_has_been_added_successfully"),
							redirect_url:Constants.WEBSITE_ADMIN_URL+"merchant_upload/export_data/"+exportId,
						});
					}).catch(next);
				}).catch(next);
			});
		}else{
			const cuisines = this.db.collection(Tables.CUISINES);
			cuisines.find({},{_id:1,"name.en":1,cuisine_id:1}).sort({"name.en": Constants.SORT_ASC}).toArray().then(result=>{

				res.render('add_main_category',{
					layout	: false,
					cuisines: result,
				});
			}).catch(next);
		}
	}//End addMainCategory()

	/**
	 * Function for add branches
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async addBranches(req,res,next){
		if(isPost(req)){
			/** Sanitize Data **/
			req.body		= sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let branchList	= req?.body?.branch || [];
			let restaurantSlug	= req?.body?.restaurant_slug || "";

			/** Send error response  */
			if(branchList.length < 1 || !restaurantSlug) return res.send({status : Constants.STATUS_ERROR,message : [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg':res.__("admin.system.something_going_wrong_please_try_again")}]});

			asyncParallel({
				phone_category_list : (parentCallback)=>{
					/** Get phone category list  */
					const attributes = 	this.db.collection(Tables.ATTRIBUTES);
					attributes.distinct( "attribute_id", { type : "branch_phone_numbers" }).then(categoryList=>{
						parentCallback(null,categoryList);
					}).catch(next);
				},
				payment_method_list : (parentCallback)=>{
					/** Get payment methods list  */
					const payment_methods = this.db.collection(Tables.PAYMENT_METHODS);
					payment_methods.distinct( "slug", {}).then(methodList=>{
						parentCallback(null,methodList);
					}).catch(next);
				},
				restaurant_id : (parentCallback)=>{
					/** Get payment methods list  */
					getRestaurantId(req,res,next,{slug : restaurantSlug}).then(restaurantId=>{
						parentCallback(null,restaurantId);
					}).catch(next);
				}
			},(parentAsyncErr,parentAsyncRecponse)=>{
				if(parentAsyncErr) return next(parentAsyncErr);

				if(!parentAsyncRecponse.restaurant_id) return res.send({status : Constants.STATUS_ERROR,message : [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg':res.__("admin.system.something_going_wrong_please_try_again")}]});

				let restaurantId 	  = parentAsyncRecponse.restaurant_id;
				let phoneCategoryList = parentAsyncRecponse.phone_category_list;
				let paymentMethodList = parentAsyncRecponse.payment_method_list;

				const areas 				= 	this.db.collection(Tables.AREAS);
				const restaurant_branches 	=	this.db.collection(Tables.RESTAURANT_BRANCHES);
				/**Check errors and if no error set array to save data */
				let errors			=	[];
				let dataToBeSaved	= 	[];
				let uniqueObject	=	{branch:{} };
				let authUserId		= 	new ObjectId(req?.session?.user?._id || "");
				let validIntegerRegx = 	Constants.VALID_NUMBER_REGEX;
				let dataToBeExport	 = [];
				asyncEach(branchList, (records, eachCallback) => {
					if(records){
						let currentIndex 	=	records.index;
						let selectedPaymentMetod = {};

						if(!records.branch_id){
							errors.push({'param':"branch_id_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_branch_id")});
						}

						if(!records.branch_name_in_english){
							errors.push({'param':"branch_name_in_english_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_branch_name_in_english")});

						}
						if(!records.branch_name_in_arabic){
							errors.push({'param':"branch_name_in_arabic_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_branch_name_in_arabic")});
						}

						if(!records.address_one){
							errors.push({'param':"address_one_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_address")});
						}

						if(!records.address_area_id){
							errors.push({'param':"address_area_id_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_address_area_id")});
						}

						if(!records.latitude){
							errors.push({'param':"latitude_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_latitude")});
						}

						if(!records.longitude){
							errors.push({'param':"longitude_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_longitude")});
						}

						if(records.latitude && isNaN(records.latitude)){
							errors.push({'param':"latitude_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_latitude")});
						}

						if(records.longitude && isNaN(records.longitude)){
							errors.push({'param':"longitude_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_longitude")});
						}

						if(records.additional_tax && !validIntegerRegx.test(records.additional_tax)){
							errors.push({'param':"additional_tax_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_additional_tax")});
						}

						if(records.extra_charge && !validIntegerRegx.test(records.extra_charge)){
							errors.push({'param':"extra_charge_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_extra_charge")});
						}

						if(records.discount_by_value && !validIntegerRegx.test(records.discount_by_value)){
							errors.push({'param':"discount_by_value_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_discount_by_value")});
						}

						if(records.discount_by_percentage && !validIntegerRegx.test(records.discount_by_percentage)){
							errors.push({'param':"discount_by_percentage_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_discount_by_percentage")});
						}

						if(records.extra_charge_percentage && !validIntegerRegx.test(records.extra_charge_percentage)){
							errors.push({'param':"extra_charge_percentage_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_extra_charge_percentage")});
						}

						if(records.accept_cashback_from_other_restaurants && records.accept_cashback_from_other_restaurants != 1 && records.accept_cashback_from_other_restaurants != 0){
							errors.push({'param':"accept_cashback_from_other_restaurants_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_accept_cashback_from_other_restaurants")});
						}

						if(records.discount_by_offer && !validIntegerRegx.test(records.discount_by_offer)){
							errors.push({'param':"discount_by_offer_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_discount_by_offer")});
						}

						if(records.maximum_duration_in_days_for_scheduled_orders && !validIntegerRegx.test(records.maximum_duration_in_days_for_scheduled_orders)){
							errors.push({'param':"maximum_duration_in_days_for_scheduled_orders_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_maximum_duration_in_days_for_scheduled_orders")});
						}

						if(records.restaurant_branch_offers_cashback && records.restaurant_branch_offers_cashback != 1 && records.restaurant_branch_offers_cashback != 0){
							errors.push({'param':"restaurant_branch_offers_cashback_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_restaurant_branch_offers_cashback")});
						}

						if(records.restaurant_branch_accepts_cashback_payment && records.restaurant_branch_accepts_cashback_payment != 1 && records.restaurant_branch_accepts_cashback_payment != 0){
							errors.push({'param':"restaurant_branch_accepts_cashback_payment_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_restaurant_branch_accepts_cashback_payment")});
						}

						if(records.restaurant_branch_offers_double_cashback && records.restaurant_branch_offers_double_cashback != 1 && records.restaurant_branch_offers_double_cashback != 0){
							errors.push({'param':"restaurant_branch_offers_double_cashback_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_restaurant_branch_offers_double_cashback")});
						}

						if(records.restaurant_landing_images && !validIntegerRegx.test(records.restaurant_landing_images)){
							errors.push({'param':"restaurant_landing_images_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_restaurant_landing_images")});
						}

						/** Phone Number validation **/
						if(records.phone_one || records.phone_one_category){
							if(!records.phone_one){
								errors.push({'param':"phone_one_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_phone")});
							}else if(isNaN(records.phone_one) || !validIntegerRegx.test(records.phone_one) || records.phone_one.length < Constants.MOBILE_NUMBER_MIN_LENGTH || records.phone_one.length > Constants.MOBILE_NUMBER_MAX_LENGTH){
								errors.push({'param':"phone_one_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_phone")});
							}

							if(!records.phone_one_category){
								errors.push({'param':"phone_one_category_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_phone_category")});
							}else if(records.phone_one_category && phoneCategoryList.indexOf(parseInt(records.phone_one_category)) == -1){
								errors.push({'param':"phone_one_category_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_phone_category")});
							}

							if(!records.phone_one_contact_name){
								errors.push({'param':"phone_one_contact_name_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_contact_name")});
							}
						}

						if(records.phone_two || records.phone_two_category){
							if(!records.phone_two){
								errors.push({'param':"phone_two_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_phone")});
							}else if(isNaN(records.phone_two) || !validIntegerRegx.test(records.phone_two) || records.phone_two.length < Constants.MOBILE_NUMBER_MIN_LENGTH || records.phone_two.length > Constants.MOBILE_NUMBER_MAX_LENGTH){
								errors.push({'param':"phone_two_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_phone")});
							}
							if(!records.phone_two_category){
								errors.push({'param':"phone_two_category_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_phone_category")});
							}else if(records.phone_two_category && phoneCategoryList.indexOf(parseInt(records.phone_two_category)) == -1){
								errors.push({'param':"phone_two_category_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_phone_category")});
							}
							if(!records.phone_two_contact_name){
								errors.push({'param':"phone_two_contact_name_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_contact_name")});
							}
						}

						if(records.phone_three || records.phone_three_category){
							if(!records.phone_three){
								errors.push({'param':"phone_three_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_phone")});
							}else if(isNaN(records.phone_three) || !validIntegerRegx.test(records.phone_three) || records.phone_three.length < Constants.MOBILE_NUMBER_MIN_LENGTH || records.phone_three.length > Constants.MOBILE_NUMBER_MAX_LENGTH){
								errors.push({'param':"phone_three_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_phone")});
							}

							if(!records.phone_three_category){
								errors.push({'param':"phone_three_category_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_phone_category")});
							}else if(records.phone_three_category && phoneCategoryList.indexOf(parseInt(records.phone_three_category)) == -1){
								errors.push({'param':"phone_three_category_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_phone_category")});
							}

							if(!records.phone_three_contact_name){
								errors.push({'param':"phone_three_contact_name_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_contact_name")});
							}
						}

						if(records.phone_four || records.phone_four_category){
							if(!records.phone_four){
								errors.push({'param':"phone_four_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_phone")});
							}else if(isNaN(records.phone_four) || !validIntegerRegx.test(records.phone_four) || records.phone_four.length < Constants.MOBILE_NUMBER_MIN_LENGTH || records.phone_four.length > Constants.MOBILE_NUMBER_MAX_LENGTH){
								errors.push({'param':"phone_four_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_phone")});
							}

							if(!records.phone_four_category){
								errors.push({'param':"phone_four_category_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_phone_category")});
							}else if(records.phone_four_category && phoneCategoryList.indexOf(parseInt(records.phone_four_category)) == -1){
								errors.push({'param':"phone_four_category_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_phone_category")});
							}

							if(!records.phone_four_contact_name){
								errors.push({'param':"phone_four_contact_name_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_contact_name")});
							}
						}

						if(records.phone_five || records.phone_five_category){
							if(!records.phone_five){
								errors.push({'param':"phone_five_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_phone")});

							}else if(isNaN(records.phone_five) || !validIntegerRegx.test(records.phone_five) || records.phone_five.length < Constants.MOBILE_NUMBER_MIN_LENGTH || records.phone_five.length > Constants.MOBILE_NUMBER_MAX_LENGTH){
								errors.push({'param':"phone_five_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_phone")});
							}

							if(!records.phone_five_category){
								errors.push({'param':"phone_five_category_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_phone_category")});
							}else if(records.phone_five_category && phoneCategoryList.indexOf(parseInt(records.phone_five_category)) == -1){
								errors.push({'param':"phone_five_category_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_phone_category")});
							}

							if(!records.phone_five_contact_name){
								errors.push({'param':"phone_five_contact_name_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_contact_name")});
							}
						}

						if(records.phone_six || records.phone_six_category){
							if(!records.phone_six){
								errors.push({'param':"phone_six_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_phone")});
							}else if(isNaN(records.phone_six) || !validIntegerRegx.test(records.phone_six) || records.phone_six.length < Constants.MOBILE_NUMBER_MIN_LENGTH || records.phone_six.length > Constants.MOBILE_NUMBER_MAX_LENGTH){
								errors.push({'param':"phone_six_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_phone")});
							}

							if(!records.phone_six_category){
								errors.push({'param':"phone_six_category_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_phone_category")});
							}else if(records.phone_six_category && phoneCategoryList.indexOf(parseInt(records.phone_six_category)) == -1){
								errors.push({'param':"phone_six_category_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_phone_category")});
							}

							if(!records.phone_six_contact_name){
								errors.push({'param':"phone_six_contact_name_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_contact_name")});
							}
						}

						if(records.phone_sevan || records.phone_sevan_category){
							if(!records.phone_sevan){
								errors.push({'param':"phone_sevan_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_phone")});
							}else if(isNaN(records.phone_sevan) || !validIntegerRegx.test(records.phone_sevan) || records.phone_sevan.length < Constants.MOBILE_NUMBER_MIN_LENGTH || records.phone_sevan.length > Constants.MOBILE_NUMBER_MAX_LENGTH){
								errors.push({'param':"phone_sevan_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_phone")});
							}

							if(!records.phone_sevan_category){
								errors.push({'param':"phone_sevan_category_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_phone_category")});
							}else if(records.phone_sevan_category && phoneCategoryList.indexOf(parseInt(records.phone_sevan_category)) == -1){
								errors.push({'param':"phone_sevan_category_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_phone_category")});
							}

							if(!records.phone_seven_contact_name){
								errors.push({'param':"phone_seven_contact_name_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_contact_name")});
							}
						}

						if(records.phone_eight || records.phone_eight_category){
							if(!records.phone_eight){
								errors.push({'param':"phone_eight_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_phone")});
							}else if(isNaN(records.phone_eight) || !validIntegerRegx.test(records.phone_eight) || records.phone_eight.length < Constants.MOBILE_NUMBER_MIN_LENGTH || records.phone_eight.length > Constants.MOBILE_NUMBER_MAX_LENGTH){
								errors.push({'param':"phone_eight_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_phone")});
							}

							if(!records.phone_eight_category){
								errors.push({'param':"phone_eight_category_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_phone_category")});
							}else if(records.phone_eight_category && phoneCategoryList.indexOf(parseInt(records.phone_eight_category)) == -1){
								errors.push({'param':"phone_eight_category_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_phone_category")});
							}

							if(!records.phone_eight_contact_name){
								errors.push({'param':"phone_eight_contact_name_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_contact_name")});
							}
						}

						if(records.phone_nine || records.phone_nine_category){
							if(!records.phone_nine){
								errors.push({'param':"phone_nine_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_phone")});
							}else if(isNaN(records.phone_nine) || !validIntegerRegx.test(records.phone_nine) || records.phone_nine.length < Constants.MOBILE_NUMBER_MIN_LENGTH || records.phone_nine.length > Constants.MOBILE_NUMBER_MAX_LENGTH){
								errors.push({'param':"phone_nine_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_phone")});
							}

							if(!records.phone_nine_category){
								errors.push({'param':"phone_nine_category_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_phone_category")});
							}else if(records.phone_nine_category && phoneCategoryList.indexOf(parseInt(records.phone_nine_category)) == -1){
								errors.push({'param':"phone_nine_category_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_phone_category")});
							}

							if(!records.phone_nine_contact_name){
								errors.push({'param':"phone_nine_contact_name_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_contact_name")});
							}
						}

						if(records.phone_ten || records.phone_ten_category){
							if(!records.phone_ten){
								errors.push({'param':"phone_ten_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_phone")});
							}else if(isNaN(records.phone_ten) || !validIntegerRegx.test(records.phone_ten) || records.phone_ten.length < Constants.MOBILE_NUMBER_MIN_LENGTH || records.phone_ten.length > Constants.MOBILE_NUMBER_MAX_LENGTH){
								errors.push({'param':"phone_ten_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_phone")});
							}

							if(!records.phone_ten_category){
								errors.push({'param':"phone_ten_category_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_phone_category")});
							}else if(records.phone_ten_category && phoneCategoryList.indexOf(parseInt(records.phone_ten_category)) == -1){
								errors.push({'param':"phone_ten_category_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_phone_category")});
							}

							if(!records.phone_ten_contact_name){
								errors.push({'param':"phone_ten_contact_name_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_contact_name")});
							}
						}

						/** Payment Method validation **/
						if(!records.payment_method_one){
							errors.push({'param':"payment_method_one_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_payment_method")});
						}else if(paymentMethodList.indexOf(records.payment_method_one) == -1){
							errors.push({'param':"payment_method_one_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_payment_method")});
						}else{
							selectedPaymentMetod[records.payment_method_one] = true;
						}

						if(records.payment_method_two){
							if(paymentMethodList.indexOf(records.payment_method_two) == -1){
								errors.push({'param':"payment_method_two_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_payment_method")});
							}else if(selectedPaymentMetod[records.payment_method_two]){
								errors.push({param:'payment_method_two_'+currentIndex, msg:res.__("admin.merchant_upload.payment_method_must_be_unique")});
							}else{
								selectedPaymentMetod[records.payment_method_two] = true;
							}
						}

						if(records.payment_method_three){
							if(paymentMethodList.indexOf(records.payment_method_three) == -1){
								errors.push({'param':"payment_method_three_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_payment_method")});
							}else if(selectedPaymentMetod[records.payment_method_three]){
								errors.push({param:'payment_method_three_'+currentIndex, msg:res.__("admin.merchant_upload.payment_method_must_be_unique")});
							}else{
								selectedPaymentMetod[records.payment_method_three] = true;
							}
						}

						if(records.payment_method_four){
							if(paymentMethodList.indexOf(records.payment_method_four) == -1){
								errors.push({'param':"payment_method_four_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_payment_method")});
							}else if(selectedPaymentMetod[records.payment_method_four]){
								errors.push({param:'payment_method_four_'+currentIndex, msg:res.__("admin.merchant_upload.payment_method_must_be_unique")});
							}else{
								selectedPaymentMetod[records.payment_method_four] = true;
							}
						}

						if(records.payment_method_five){
							if(paymentMethodList.indexOf(records.payment_method_five) == -1){
								errors.push({'param':"payment_method_five_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_payment_method")});
							}else if(selectedPaymentMetod[records.payment_method_five]){
								errors.push({param:'payment_method_five_'+currentIndex, msg:res.__("admin.merchant_upload.payment_method_must_be_unique")});
							}else{
								selectedPaymentMetod[records.payment_method_five] = true;
							}
						}

						if(records.payment_method_six){
							if(paymentMethodList.indexOf(records.payment_method_six) == -1){
								errors.push({'param':"payment_method_six_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_payment_method")});
							}else if(selectedPaymentMetod[records.payment_method_six]){
								errors.push({param:'payment_method_six_'+currentIndex, msg:res.__("admin.merchant_upload.payment_method_must_be_unique")});
							}else{
								selectedPaymentMetod[records.payment_method_six] = true;
							}
						}

						if(!records.calendar_type_one){
							errors.push({'param':"calendar_type_one_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_type")});
						}else if(!Constants.OPEN_STATUS[records.calendar_type_one] && !Constants.CLOSE_STATUS[records.calendar_type_one]){
							errors.push({'param':"calendar_type_one_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_calendar_type")});
						}

						if(!records.calendar_type_value_one){
							errors.push({'param':"calendar_type_value_one_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_type_value")});
						}

						if(records.calendar_type_one && (records.calendar_type_value_one != Constants.OPEN &&  records.calendar_type_value_one != Constants.CLOSE)){
							errors.push({'param':"calendar_type_value_one_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_calendar_type_value")});
						}else if(records.calendar_type_one && ((Constants.OPEN_STATUS[records.calendar_type_one] && records.calendar_type_value_one != Constants.OPEN) || ((Constants.CLOSE_STATUS[records.calendar_type_one] && records.calendar_type_value_one != Constants.CLOSE)))){
							errors.push({'param':"calendar_type_value_one_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_calendar_type_value")});
						}

						if(!records.calendar_from_hour_one){
							errors.push({'param':"calendar_from_hour_one_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_from_hour")});
						}else if(isNaN(records.calendar_from_hour_one) || !validIntegerRegx.test(records.calendar_from_hour_one) || records.calendar_from_hour_one < 0 || parseInt(records.calendar_from_hour_one) > Constants.HOURS_IN_A_DAY-1){
							errors.push({'param':"calendar_from_hour_one_"+currentIndex,'msg':res.__("admin.merchant_upload.invalid_calendar_from_hour")});
						}

						if(!records.calendar_from_minute_one){
							errors.push({'param':"calendar_from_minute_one_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_from_minute")});
						}else if(isNaN(records.calendar_from_minute_one) || !validIntegerRegx.test(records.calendar_from_minute_one) || records.calendar_from_minute_one < 0 || records.calendar_from_minute_one > Constants.SECONDS_IN_A_MINUTE-1){
							errors.push({'param':"calendar_from_minute_one_"+currentIndex,'msg':res.__("admin.merchant_upload.invalid_calendar_from_minute")});
						}

						if(!records.calendar_to_hour_one ){
							errors.push({'param':"calendar_to_hour_one_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_to_hour")});
						}else if(isNaN(records.calendar_to_hour_one) || !validIntegerRegx.test(records.calendar_to_hour_one) || records.calendar_to_hour_one < 0  || records.calendar_to_hour_one > Constants.HOURS_IN_A_DAY-1){
							errors.push({'param':"calendar_to_hour_one_"+currentIndex,'msg':res.__("admin.merchant_upload.invalid_calendar_to_hour")});
						}
						// else if(records.calendar_to_hour_one && (records.calendar_to_hour_one <= records.calendar_from_hour_one)){
						// 	errors.push({'param':"calendar_to_hour_one_"+currentIndex,'msg':res.__("admin.merchant_upload.to_hour_greater_than_from_hour")});
						// }

						if(!records.calendar_to_minute_one){
							errors.push({'param':"calendar_to_minute_one_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_to_minute")});
						}else if(isNaN(records.calendar_to_minute_one) || !validIntegerRegx.test(records.calendar_to_minute_one) || records.calendar_to_minute_one < 0  || records.calendar_to_minute_one > Constants.SECONDS_IN_A_MINUTE-1){
							errors.push({'param':"calendar_to_minute_one_"+currentIndex,'msg':res.__("admin.merchant_upload.invalid_calendar_to_minute")});
						}

						if(records.calendar_type_two || records.calendar_type_value_two || records.calendar_from_hour_two || records.calendar_from_minute_two || records.calendar_to_hour_two || records.calendar_to_minute_two){
							if(!records.calendar_type_two){
								errors.push({'param':"calendar_type_two_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_type")});
							}else if(!Constants.OPEN_STATUS[records.calendar_type_two] && !Constants.CLOSE_STATUS[records.calendar_type_two]){
								errors.push({'param':"calendar_type_two_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_calendar_type")});
							}

							if(!records.calendar_type_value_two){
								errors.push({'param':"calendar_type_value_two_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_type_value")});
							}

							if(records.calendar_type_value_two && (records.calendar_type_value_two != Constants.OPEN &&  records.calendar_type_value_two != Constants.CLOSE)){
								errors.push({'param':"calendar_type_value_two_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_calendar_type_value")});
							}else if(records.calendar_type_two && ((Constants.OPEN_STATUS[records.calendar_type_two] && records.calendar_type_value_two != Constants.OPEN) || ((Constants.CLOSE_STATUS[records.calendar_type_two] && records.calendar_type_value_two != Constants.CLOSE)))){
								errors.push({'param':"calendar_type_value_two_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_calendar_type_value")});
							}

							if(!records.calendar_from_hour_two){
								errors.push({'param':"calendar_from_hour_two_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_from_hour")});
							}else if(isNaN(records.calendar_from_hour_two) || !validIntegerRegx.test(records.calendar_from_hour_two) || records.calendar_from_hour_two < 0 || parseInt(records.calendar_from_hour_two) > Constants.HOURS_IN_A_DAY-1){
								errors.push({'param':"calendar_from_hour_two_"+currentIndex,'msg':res.__("admin.merchant_upload.invalid_calendar_from_hour")});
							}

							if(!records.calendar_from_minute_two){
								errors.push({'param':"calendar_from_minute_two_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_from_minute")});
							}else if(isNaN(records.calendar_from_minute_two) ||  !validIntegerRegx.test(records.calendar_from_minute_two) || records.calendar_from_minute_two < 0 || records.calendar_from_minute_two > Constants.SECONDS_IN_A_MINUTE-1 ){
								errors.push({'param':"calendar_from_minute_two_"+currentIndex,'msg':res.__("admin.merchant_upload.invalid_calendar_from_minute")});
							}

							if(!records.calendar_to_hour_two){
								errors.push({'param':"calendar_to_hour_two_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_to_hour")});
							}else if(isNaN(records.calendar_to_hour_two) || !validIntegerRegx.test(records.calendar_to_hour_two) ||  records.calendar_to_hour_two < 0  || parseInt(records.calendar_to_hour_two) > Constants.HOURS_IN_A_DAY-1){
								errors.push({'param':"calendar_to_hour_two_"+currentIndex,'msg':res.__("admin.merchant_upload.invalid_calendar_to_hour")});
							}
							// else if(records.calendar_to_hour_two && (records.calendar_to_hour_two <= records.calendar_from_hour_two)){
							// 	errors.push({'param':"calendar_to_hour_two_"+currentIndex,'msg':res.__("admin.merchant_upload.to_hour_greater_than_from_hour")});
							// }

							if(!records.calendar_to_minute_two){
								errors.push({'param':"calendar_to_minute_two_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_to_minute")});
							}else if(isNaN(records.calendar_to_minute_two) || !validIntegerRegx.test(records.calendar_to_minute_two) || records.calendar_to_minute_two < 0  || records.calendar_to_minute_two > Constants.SECONDS_IN_A_MINUTE-1 ){
								errors.push({'param':"calendar_to_minute_two_"+currentIndex,'msg':res.__("admin.merchant_upload.invalid_calendar_to_minute")});
							}
						}

						if(records.calendar_type_three || records.calendar_type_value_three || records.calendar_from_hour_three || records.calendar_from_minute_three || records.calendar_to_hour_three || records.calendar_to_minute_three){
							if(!records.calendar_type_three){
								errors.push({'param':"calendar_type_three_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_type")});
							}else if(!Constants.OPEN_STATUS[records.calendar_type_three] && !Constants.CLOSE_STATUS[records.calendar_type_three]){
								errors.push({'param':"calendar_type_three_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_calendar_type")});
							}

							if(!records.calendar_type_value_three){
								errors.push({'param':"calendar_type_value_three_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_type_value")});
							}

							if(records.calendar_type_value_three && (records.calendar_type_value_three != Constants.OPEN &&  records.calendar_type_value_three != Constants.CLOSE)){
								errors.push({'param':"calendar_type_value_three_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_calendar_type_value")});
							}else if(records.calendar_type_three && ((Constants.OPEN_STATUS[records.calendar_type_three] && records.calendar_type_value_three != Constants.OPEN) || ((Constants.CLOSE_STATUS[records.calendar_type_three] && records.calendar_type_value_three != Constants.CLOSE)))){
								errors.push({'param':"calendar_type_value_three_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_calendar_type_value")});
							}

							if(!records.calendar_from_hour_three){
								errors.push({'param':"calendar_from_hour_three_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_from_hour")});
							}else if(isNaN(records.calendar_from_hour_three) || !validIntegerRegx.test(records.calendar_from_hour_three) || records.calendar_from_hour_three < 0 || parseInt(records.calendar_from_hour_three) > Constants.HOURS_IN_A_DAY-1){
								errors.push({'param':"calendar_from_hour_three_"+currentIndex,'msg':res.__("admin.merchant_upload.invalid_calendar_from_hour")});
							}

							if(!records.calendar_from_minute_three){
								errors.push({'param':"calendar_from_minute_three_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_from_minute")});
							}else if(isNaN(records.calendar_from_minute_three) ||  !validIntegerRegx.test(records.calendar_from_minute_three) ||records.calendar_from_minute_three < 0 || records.calendar_from_minute_three > Constants.SECONDS_IN_A_MINUTE-1){
								errors.push({'param':"calendar_from_minute_three_"+currentIndex,'msg':res.__("admin.merchant_upload.invalid_calendar_from_minute")});
							}

							if(!records.calendar_to_hour_three){
								errors.push({'param':"calendar_to_hour_three_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_to_hour")});
							}else if(isNaN(records.calendar_to_hour_three) || !validIntegerRegx.test(records.calendar_to_hour_three) || records.calendar_to_hour_three < 0 || parseInt(records.calendar_to_hour_three) > Constants.HOURS_IN_A_DAY-1){
								errors.push({'param':"calendar_to_hour_three_"+currentIndex,'msg':res.__("admin.merchant_upload.invalid_calendar_to_hour")});
							}
							// else if(records.calendar_to_hour_three && (records.calendar_to_hour_three <= records.calendar_from_hour_three)){
							// 	errors.push({'param':"calendar_to_hour_three_"+currentIndex,'msg':res.__("admin.merchant_upload.to_hour_greater_than_from_hour")});
							// }

							if(!records.calendar_to_minute_three){
								errors.push({'param':"calendar_to_minute_three_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_to_minute")});
							}else if(isNaN(records.calendar_to_minute_three) || !validIntegerRegx.test(records.calendar_to_minute_three) || records.calendar_to_minute_three < 0 || records.calendar_to_minute_three > Constants.SECONDS_IN_A_MINUTE-1){
								errors.push({'param':"calendar_to_minute_three_"+currentIndex,'msg':res.__("admin.merchant_upload.invalid_calendar_to_minute")});
							}
						}

						if(records.calendar_type_four || records.calendar_type_value_four || records.calendar_from_hour_four || records.calendar_from_minute_four || records.calendar_to_hour_four || records.calendar_to_minute_four){
							if(!records.calendar_type_four){
								errors.push({'param':"calendar_type_four_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_type")});
							}else if(!Constants.OPEN_STATUS[records.calendar_type_four] && !Constants.CLOSE_STATUS[records.calendar_type_four]){
								errors.push({'param':"calendar_type_four_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_calendar_type")});
							}

							if(!records.calendar_type_value_four){
								errors.push({'param':"calendar_type_value_four_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_type_value")});
							}

							if(records.calendar_type_value_four && (records.calendar_type_value_four != Constants.OPEN && records.calendar_type_value_four != Constants.CLOSE)){
								errors.push({'param':"calendar_type_value_four_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_calendar_type_value")});
							}else if(records.calendar_type_four && ((Constants.OPEN_STATUS[records.calendar_type_four] && records.calendar_type_value_four != Constants.OPEN) || ((Constants.CLOSE_STATUS[records.calendar_type_four] && records.calendar_type_value_four != Constants.CLOSE)))){
								errors.push({'param':"calendar_type_value_four_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_calendar_type_value")});
							}

							if(!records.calendar_from_hour_four){
								errors.push({'param':"calendar_from_hour_four_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_from_hour")});
							}else if(isNaN(records.calendar_from_hour_four) || !validIntegerRegx.test(records.calendar_from_hour_four) ||  records.calendar_from_hour_four < 0 || parseInt(records.calendar_from_hour_four) > Constants.HOURS_IN_A_DAY-1){
								errors.push({'param':"calendar_from_hour_four_"+currentIndex,'msg':res.__("admin.merchant_upload.invalid_calendar_from_hour")});
							}

							if(!records.calendar_from_minute_four){
								errors.push({'param':"calendar_from_minute_four_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_from_minute")});
							}else if(isNaN(records.calendar_from_minute_four) ||  !validIntegerRegx.test(records.calendar_from_minute_four) || records.calendar_from_minute_four < 0 || records.calendar_from_minute_four > Constants.SECONDS_IN_A_MINUTE-1){
								errors.push({'param':"calendar_from_minute_four_"+currentIndex,'msg':res.__("admin.merchant_upload.invalid_calendar_from_minute")});
							}

							if(!records.calendar_to_hour_four){
								errors.push({'param':"calendar_to_hour_four_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_to_hour")});
							}else if(isNaN(records.calendar_to_hour_four) || !validIntegerRegx.test(records.calendar_to_hour_four) || records.calendar_to_hour_four < 0 || parseInt(records.calendar_to_hour_four) > Constants.HOURS_IN_A_DAY-1){
								errors.push({'param':"calendar_to_hour_four_"+currentIndex,'msg':res.__("admin.merchant_upload.invalid_calendar_to_hour")});
							}
							// else if(records.calendar_to_hour_four && (records.calendar_to_hour_four <= records.calendar_from_hour_four)){
							// 	errors.push({'param':"calendar_to_hour_four_"+currentIndex,'msg':res.__("admin.merchant_upload.to_hour_greater_than_from_hour")});
							// }

							if(!records.calendar_to_minute_four){
								errors.push({'param':"calendar_to_minute_four_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_to_minute")});
							}else if(isNaN(records.calendar_to_minute_four) || !validIntegerRegx.test(records.calendar_to_minute_four) || records.calendar_to_minute_four < 0 || records.calendar_to_minute_four > Constants.SECONDS_IN_A_MINUTE-1){
								errors.push({'param':"calendar_to_minute_four_"+currentIndex,'msg':res.__("admin.merchant_upload.invalid_calendar_to_minute")});
							}
						}

						if(records.calendar_type_five || records.calendar_type_value_five || records.calendar_from_hour_five || records.calendar_from_minute_five || records.calendar_to_hour_five || records.calendar_to_minute_five){
							if(!records.calendar_type_five){
								errors.push({'param':"calendar_type_five_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_type")});
							}else if(!Constants.OPEN_STATUS[records.calendar_type_five] && !Constants.CLOSE_STATUS[records.calendar_type_five]){
								errors.push({'param':"calendar_type_five_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_calendar_type")});
							}

							if(!records.calendar_type_value_five){
								errors.push({'param':"calendar_type_value_five_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_type_value")});
							}

							if(records.calendar_type_value_five && (records.calendar_type_value_five != Constants.OPEN &&  records.calendar_type_value_five != Constants.CLOSE)){
								errors.push({'param':"calendar_type_value_five_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_calendar_type_value")});
							}else if(records.calendar_type_five && ((Constants.OPEN_STATUS[records.calendar_type_five] && records.calendar_type_value_five != Constants.OPEN) || ((Constants.CLOSE_STATUS[records.calendar_type_five] && records.calendar_type_value_five != Constants.CLOSE)))){
								errors.push({'param':"calendar_type_value_five_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_calendar_type_value")});
							}

							if(!records.calendar_from_hour_five){
								errors.push({'param':"calendar_from_hour_five_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_from_hour")});
							}else if(isNaN(records.calendar_from_hour_five) || !validIntegerRegx.test(records.calendar_from_hour_five) || records.calendar_from_hour_five < 0  || parseInt(records.calendar_from_hour_five) > Constants.HOURS_IN_A_DAY-1){
								errors.push({'param':"calendar_from_hour_five_"+currentIndex,'msg':res.__("admin.merchant_upload.invalid_calendar_from_hour")});
							}

							if(!records.calendar_from_minute_five){
								errors.push({'param':"calendar_from_minute_five_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_from_minute")});
							}else if(isNaN(records.calendar_from_minute_five) ||  !validIntegerRegx.test(records.calendar_from_minute_five) || records.calendar_from_minute_five < 0 || records.calendar_from_minute_five > Constants.SECONDS_IN_A_MINUTE-1){
								errors.push({'param':"calendar_from_minute_five_"+currentIndex,'msg':res.__("admin.merchant_upload.invalid_calendar_from_minute")});
							}

							if(!records.calendar_to_hour_five){
								errors.push({'param':"calendar_to_hour_five_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_to_hour")});
							}else if(isNaN(records.calendar_to_hour_five) || !validIntegerRegx.test(records.calendar_to_hour_five) || records.calendar_to_hour_five < 0 || parseInt(records.calendar_to_hour_five) > Constants.HOURS_IN_A_DAY-1){
								errors.push({'param':"calendar_to_hour_five_"+currentIndex,'msg':res.__("admin.merchant_upload.invalid_calendar_to_hour")});
							}
							// else if(records.calendar_to_hour_five && (records.calendar_to_hour_five <= records.calendar_from_hour_five)){
							// 	errors.push({'param':"calendar_to_hour_five_"+currentIndex,'msg':res.__("admin.merchant_upload.to_hour_greater_than_from_hour")});
							// }

							if(!records.calendar_to_minute_five){
								errors.push({'param':"calendar_to_minute_five_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_to_minute")});
							}else if(isNaN(records.calendar_to_minute_five) || !validIntegerRegx.test(records.calendar_to_minute_five) || records.calendar_to_minute_five < 0  || records.calendar_to_minute_five > Constants.SECONDS_IN_A_MINUTE-1){
								errors.push({'param':"calendar_to_minute_five_"+currentIndex,'msg':res.__("admin.merchant_upload.invalid_calendar_to_minute")});
							}
						}

						if(records.calendar_type_six || records.calendar_type_value_six || records.calendar_from_hour_six || records.calendar_from_minute_six || records.calendar_to_hour_six || records.calendar_to_minute_six){
							if(!records.calendar_type_six){
								errors.push({'param':"calendar_type_six_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_type")});
							}else if(!Constants.OPEN_STATUS[records.calendar_type_six] && !Constants.CLOSE_STATUS[records.calendar_type_six]){
								errors.push({'param':"calendar_type_six_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_calendar_type")});
							}

							if(!records.calendar_type_value_six){
								errors.push({'param':"calendar_type_value_six_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_type_value")});
							}

							if(records.calendar_type_value_six && (records.calendar_type_value_six != Constants.OPEN &&  records.calendar_type_value_six != Constants.CLOSE)){
								errors.push({'param':"calendar_type_value_six_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_calendar_type_value")});
							}else if(records.calendar_type_six && ((Constants.OPEN_STATUS[records.calendar_type_six] && records.calendar_type_value_six != Constants.OPEN) || ((Constants.CLOSE_STATUS[records.calendar_type_six] && records.calendar_type_value_six != Constants.CLOSE)))){
								errors.push({'param':"calendar_type_value_six_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_calendar_type_value")});
							}

							if(!records.calendar_from_hour_six){
								errors.push({'param':"calendar_from_hour_six_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_from_hour")});
							}else if(isNaN(records.calendar_from_hour_six) || !validIntegerRegx.test(records.calendar_from_hour_six) || records.calendar_from_hour_six < 0 || parseInt(records.calendar_from_hour_six) > Constants.HOURS_IN_A_DAY-1){
								errors.push({'param':"calendar_from_hour_six_"+currentIndex,'msg':res.__("admin.merchant_upload.invalid_calendar_from_hour")});
							}

							if(!records.calendar_from_minute_six){
								errors.push({'param':"calendar_from_minute_six_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_from_minute")});
							}else if(isNaN(records.calendar_from_minute_six) ||  !validIntegerRegx.test(records.calendar_from_minute_six) ||  records.calendar_from_minute_six < 0  || records.calendar_from_minute_six > Constants.SECONDS_IN_A_MINUTE-1){
								errors.push({'param':"calendar_from_minute_six_"+currentIndex,'msg':res.__("admin.merchant_upload.invalid_calendar_from_minute")});
							}

							if(!records.calendar_to_hour_six){
								errors.push({'param':"calendar_to_hour_six_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_to_hour")});
							}else if(isNaN(records.calendar_to_hour_six) || !validIntegerRegx.test(records.calendar_to_hour_six) || records.calendar_to_hour_six < 0  || parseInt(records.calendar_to_hour_six) > Constants.HOURS_IN_A_DAY-1){
								errors.push({'param':"calendar_to_hour_six_"+currentIndex,'msg':res.__("admin.merchant_upload.invalid_calendar_to_hour")});
							}
							// else if(records.calendar_to_hour_six && (records.calendar_to_hour_six <= records.calendar_from_hour_six)){
							// 	errors.push({'param':"calendar_to_hour_six_"+currentIndex,'msg':res.__("admin.merchant_upload.to_hour_greater_than_from_hour")});
							// }

							if(!records.calendar_to_minute_six){
								errors.push({'param':"calendar_to_minute_six_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_calendar_to_minute")});
							}else if(isNaN(records.calendar_to_minute_six) || !validIntegerRegx.test(records.calendar_to_minute_six) || records.calendar_to_minute_six < 0 || records.calendar_to_minute_six > Constants.SECONDS_IN_A_MINUTE-1){
								errors.push({'param':"calendar_to_minute_six_"+currentIndex,'msg':res.__("admin.merchant_upload.invalid_calendar_to_minute")});
							}
						}

						if(records.branch_id){
							let temBranchId =  records.branch_id.toLowerCase().trim();
							if(uniqueObject.branch[temBranchId]){
								errors.push({param:'branch_id_'+currentIndex, msg:res.__("admin.merchant_upload.whoops_you_have_entered_an_already_used_branch_id")});
							}else{
								uniqueObject.branch[temBranchId] = true;
							}
						}

						/** Push data in array if not error */
						if(errors.length ==0){
							asyncParallel({
								branch_id_count : (callback)=>{
									/** Check restaurant branch id already exists or not **/
									restaurant_branches.countDocuments({
										"branch_number" : {$regex : '^'+cleanRegex(records.branch_id)+'$',$options : 'i'},
									}).then(countResult=>{
										callback(null, countResult);
									}).catch(callback);
								},
								area_details : (callback)=>{
									/** Get area id **/
									areas.findOne({area_id : records.address_area_id },{projection :{_id:1,city_id:1}}).then(areaResult=>{
										callback(null, areaResult);
									}).catch(callback);
								},
							},(parallelErr,parallelResponse)=> {
								if(parallelErr) return eachCallback(parallelErr);

								/**Check branch id is unique */
								if(parallelResponse.branch_id_count){
									errors.push({param:'branch_id_'+currentIndex, msg:res.__("admin.merchant_upload.whoops_you_have_entered_an_already_used_branch_id")});
								}
								if(!parallelResponse.area_details){
									errors.push({param:'address_area_id_'+currentIndex, msg:res.__("admin.merchant_upload.please_enter_valid_address_area_id")});
								}

								if(errors.length ==0){
									let tempData = {
										branch_details :{
											name : {
												en 	: records.branch_name_in_english,
												ar 	: records.branch_name_in_arabic,
											},
											branch_number: 	records.branch_id,
											area_id		: 	parallelResponse.area_details?._id || "",
											city_id		: 	parallelResponse.area_details?.city_id || "",
											address		: 	records.address_one,
											added_by 	: 	authUserId,
											longitude	: 	parseFloat(records.longitude),
											latitude    :   parseFloat(records.latitude),
											long_lat	:	[parseFloat(records.longitude), parseFloat(records.latitude)],
											is_active	: 	Constants.ACTIVE,
											created 	:	getUtcDate(),
											modified 	:	getUtcDate()
										},
										attribute_list : [
											{
												added_by 	: 	authUserId,
												attribute_id: 	parseInt(records.branch_slogan_in_english_id),
												value 		: 	(records.branch_slogan_in_english) ? records.branch_slogan_in_english :"",
												created		:	getUtcDate(),
												modified 	: 	getUtcDate(),
											},
											{
												added_by 	: 	authUserId,
												attribute_id: 	parseInt(records.branch_slogan_in_arabic_id),
												value 		: 	(records.branch_slogan_in_arabic) ? records.branch_slogan_in_arabic :"",
												created		:	getUtcDate(),
												modified 	: 	getUtcDate(),
											},
											{
												added_by 	: 	authUserId,
												attribute_id:	parseInt(records.additional_tax_id),
												value 		: 	(records.additional_tax) ? records.additional_tax :"",
												created		:	getUtcDate(),
												modified 	: 	getUtcDate(),
											},
											{
												added_by 	: 	authUserId,
												attribute_id: 	parseInt(records.extra_charge_id),
												value 		: 	(records.extra_charge) ? records.extra_charge :"",
												created		:	getUtcDate(),
												modified 	: 	getUtcDate(),
											},
											{
												added_by 	: 	authUserId,
												attribute_id: 	parseInt(records.discount_by_value_id),
												value 		: 	(records.discount_by_value) ? records.discount_by_value :"",
												created		:	getUtcDate(),
												modified 	: 	getUtcDate(),
											},
											{
												added_by 	: 	authUserId,
												attribute_id: 	parseInt(records.discount_by_percentage_id),
												value 		: 	(records.discount_by_percentage) ? records.discount_by_percentage :"",
												created		:	getUtcDate(),
												modified 	: 	getUtcDate(),
											},
											{
												added_by 	: 	authUserId,
												attribute_id: 	parseInt(records.extra_charge_percentage_id),
												value 		: 	(records.extra_charge_percentage) ? records.extra_charge_percentage :"",
												created		:	getUtcDate(),
												modified 	: 	getUtcDate(),
											},
											{
												added_by 	: 	authUserId,
												attribute_id: 	parseInt(records.accept_cashback_from_other_restaurants_id),
												value 		: 	(records.accept_cashback_from_other_restaurants) ? records.accept_cashback_from_other_restaurants :"",
												created		:	getUtcDate(),
												modified 	: 	getUtcDate(),
											},
											{
												added_by 	: 	authUserId,
												attribute_id: 	parseInt(records.discount_by_offer_id),
												value 		: 	(records.discount_by_offer) ? records.discount_by_offer :"",
												created		:	getUtcDate(),
												modified 	: 	getUtcDate(),
											},
											{
												added_by 	: 	authUserId,
												attribute_id: 	parseInt(records.maximum_duration_in_days_for_scheduled_orders_id),
												value 		: 	(records.maximum_duration_in_days_for_scheduled_orders) ? records.maximum_duration_in_days_for_scheduled_orders :"",
												created		:	getUtcDate(),
												modified 	: 	getUtcDate(),
											},
											{
												added_by 	: 	authUserId,
												attribute_id: 	parseInt(records.restaurant_branch_offers_cashback_id),
												value 		: 	(records.restaurant_branch_offers_cashback) ? records.restaurant_branch_offers_cashback :"",
												created		:	getUtcDate(),
												modified 	: 	getUtcDate(),
											},
											{
												added_by 	: 	authUserId,
												attribute_id: 	parseInt(records.restaurant_branch_accepts_cashback_payment_id),
												value 		: 	(records.restaurant_branch_accepts_cashback_payment) ? records.restaurant_branch_accepts_cashback_payment :"",
												created		:	getUtcDate(),
												modified 	: 	getUtcDate(),
											},
											{
												added_by 	: 	authUserId,
												attribute_id: 	parseInt(records.restaurant_branch_offers_double_cashback_id),
												value 		: 	(records.restaurant_branch_offers_double_cashback) ? records.restaurant_branch_offers_double_cashback :"",
												created		:	getUtcDate(),
												modified 	: 	getUtcDate(),
											},
										],
										phone_list :[],
										payment_methods :{
											added_by		:	authUserId,
											payment_methods	:	[records.payment_method_one],
											created			:	getUtcDate(),
											modified 		:	getUtcDate(),
										},
										calendar_list : [{
											added_by	:	authUserId,
											created		:	getUtcDate(),
											modified	:	getUtcDate(),
											status		:	parseInt(records.calendar_type_value_one),
											type		:	records.calendar_type_one,
											from_hour	:	(records.calendar_from_hour_one)	?	parseInt(records.calendar_from_hour_one)	:"",
											from_minute	:	(records.calendar_from_minute_one)	?	parseInt(records.calendar_from_minute_one)	:"",
											to_hour		:	(records.calendar_to_hour_one)		? 	parseInt(records.calendar_to_hour_one) 		:"",
											to_minute	: 	(records.calendar_to_minute_one)	?	parseInt(records.calendar_to_minute_one)	:"",
											parent_id	:	"",
										}]
									};

									if(records.phone_one && records.phone_one_category){
										tempData.phone_list.push({
											added_by		: 	authUserId,
											country_code	: 	DEFAULT_COUNTRY_CODE,
											attribute_id	: 	parseInt(records.phone_one_category),
											value			: 	records.phone_one,
											contact_name	: 	records.phone_one_contact_name,
											created			:	getUtcDate(),
											modified 		:	getUtcDate(),
										});
									}

									if(records.phone_two && records.phone_two_category){
										tempData.phone_list.push({
											added_by		: 	authUserId,
											country_code	: 	Constants.DEFAULT_COUNTRY_CODE,
											attribute_id	: 	parseInt(records.phone_two_category),
											value			: 	records.phone_two,
											contact_name	: 	records.phone_two_contact_name,
											created			:	getUtcDate(),
											modified 		:	getUtcDate(),
										});
									}

									if(records.phone_three && records.phone_three_category){
										tempData.phone_list.push({
											added_by		: 	authUserId,
											country_code	: 	Constants.DEFAULT_COUNTRY_CODE,
											attribute_id	: 	parseInt(records.phone_three_category),
											value			: 	records.phone_three,
											contact_name	: 	records.phone_three_contact_name,
											created			:	getUtcDate(),
											modified 		:	getUtcDate(),
										});
									}

									if(records.phone_four && records.phone_four_category){
										tempData.phone_list.push({
											added_by		: 	authUserId,
											country_code	: 	Constants.DEFAULT_COUNTRY_CODE,
											attribute_id	: 	parseInt(records.phone_four_category),
											value			: 	records.phone_four,
											contact_name	: 	records.phone_four_contact_name,
											created			:	getUtcDate(),
											modified 		:	getUtcDate(),
										});
									}

									if(records.phone_five && records.phone_five_category){
										tempData.phone_list.push({
											added_by		: 	authUserId,
											country_code	: 	Constants.DEFAULT_COUNTRY_CODE,
											attribute_id	: 	parseInt(records.phone_five_category),
											value			: 	records.phone_five,
											contact_name	: 	records.phone_five_contact_name,
											created			:	getUtcDate(),
											modified 		:	getUtcDate(),
										});
									}

									if(records.phone_six && records.phone_six_category){
										tempData.phone_list.push({
											added_by		: 	authUserId,
											country_code	: 	Constants.DEFAULT_COUNTRY_CODE,
											attribute_id	: 	parseInt(records.phone_six_category),
											value			: 	records.phone_six,
											contact_name	: 	records.phone_six_contact_name,
											created			:	getUtcDate(),
											modified 		:	getUtcDate(),
										});
									}

									if(records.phone_sevan && records.phone_sevan_category){
										tempData.phone_list.push({
											added_by		: 	authUserId,
											country_code	: 	Constants.DEFAULT_COUNTRY_CODE,
											attribute_id	: 	parseInt(records.phone_sevan_category),
											value			: 	records.phone_sevan,
											contact_name	: 	records.phone_seven_contact_name,
											created			:	getUtcDate(),
											modified 		:	getUtcDate(),
										});
									}

									if(records.phone_eight && records.phone_eight_category){
										tempData.phone_list.push({
											added_by		: 	authUserId,
											country_code	: 	Constants.DEFAULT_COUNTRY_CODE,
											attribute_id	: 	parseInt(records.phone_eight_category),
											value			: 	records.phone_eight,
											contact_name	: 	records.phone_eight_contact_name,
											created			:	getUtcDate(),
											modified 		:	getUtcDate(),
										});
									}

									if(records.phone_nine && records.phone_nine_category){
										tempData.phone_list.push({
											added_by		: 	authUserId,
											country_code	: 	Constants.DEFAULT_COUNTRY_CODE,
											attribute_id	: 	parseInt(records.phone_nine_category),
											value			: 	records.phone_nine,
											contact_name	: 	records.phone_nine_contact_name,
											created			:	getUtcDate(),
											modified 		:	getUtcDate(),
										});
									}
									if(records.phone_ten && records.phone_ten_category){
										tempData.phone_list.push({
											added_by		: 	authUserId,
											country_code	: 	Constants.DEFAULT_COUNTRY_CODE,
											attribute_id	: 	parseInt(records.phone_ten_category),
											value			: 	records.phone_ten,
											contact_name	: 	records.phone_ten_contact_name,
											created			:	getUtcDate(),
											modified 		:	getUtcDate(),
										});
									}

									if(records.payment_method_two && tempData.payment_methods.payment_methods.indexOf(records.payment_method_two) == -1){
										tempData.payment_methods.payment_methods.push(records.payment_method_two);
									}
									if(records.payment_method_three && tempData.payment_methods.payment_methods.indexOf(records.payment_method_three) == -1){
										tempData.payment_methods.payment_methods.push(records.payment_method_three);
									}
									if(records.payment_method_four && tempData.payment_methods.payment_methods.indexOf(records.payment_method_four) == -1){
										tempData.payment_methods.payment_methods.push(records.payment_method_four);
									}
									if(records.payment_method_five && tempData.payment_methods.payment_methods.indexOf(records.payment_method_five) == -1){
										tempData.payment_methods.payment_methods.push(records.payment_method_five);
									}
									if(records.payment_method_six && tempData.payment_methods.payment_methods.indexOf(records.payment_method_six) == -1){
										tempData.payment_methods.payment_methods.push(records.payment_method_six);
									}

									if(records.calendar_type_two && records.calendar_type_value_two){
										let tempCalendarData = {
											status		:	parseInt(records.calendar_type_value_two),
											type		:	records.calendar_type_two,
											parent_id	:	"",
											added_by	:	authUserId,
											created		:	getUtcDate(),
											modified	:	getUtcDate(),
										};

										if(records.calendar_from_hour_two)		tempCalendarData.from_hour 	=	parseInt(records.calendar_from_hour_two);
										if(records.calendar_from_minute_two)	tempCalendarData.from_minute= 	parseInt(records.calendar_from_minute_two);
										if(records.calendar_to_hour_two)		tempCalendarData.to_hour 	= 	parseInt(records.calendar_to_hour_two);
										if(records.calendar_to_minute_two)		tempCalendarData.to_minute 	= 	parseInt(records.calendar_to_minute_two);

										tempData.calendar_list.push(tempCalendarData);
									}

									if(records.calendar_type_three && records.calendar_type_value_three){
										let tempCalendarData = {
											status		:	parseInt(records.calendar_type_value_three),
											type		:	records.calendar_type_three,
											parent_id	:	"",
											added_by	:	authUserId,
											created		:	getUtcDate(),
											modified	:	getUtcDate(),
										};

										if(records.calendar_from_hour_three)	tempCalendarData.from_hour 	=	parseInt(records.calendar_from_hour_three);
										if(records.calendar_from_minute_three)	tempCalendarData.from_minute= 	parseInt(records.calendar_from_minute_three);
										if(records.calendar_to_hour_three)		tempCalendarData.to_hour 	= 	parseInt(records.calendar_to_hour_three);
										if(records.calendar_to_minute_three)	tempCalendarData.to_minute 	= 	parseInt(records.calendar_to_minute_three);

										tempData.calendar_list.push(tempCalendarData);
									}

									if(records.calendar_type_four && records.calendar_type_value_three){
										let tempCalendarData = {
											status		:	parseInt(records.calendar_type_value_four),
											type		:	records.calendar_type_four,
											parent_id	:	"",
											added_by	:	authUserId,
											created		:	getUtcDate(),
											modified	:	getUtcDate(),
										};

										if(records.calendar_from_hour_four)		tempCalendarData.from_hour 	=	parseInt(records.calendar_from_hour_four);
										if(records.calendar_from_minute_four)	tempCalendarData.from_minute= 	parseInt(records.calendar_from_minute_four);
										if(records.calendar_to_hour_four)		tempCalendarData.to_hour 	= 	parseInt(records.calendar_to_hour_four);
										if(records.calendar_to_minute_four)		tempCalendarData.to_minute 	= 	parseInt(records.calendar_to_minute_four);

										tempData.calendar_list.push(tempCalendarData);
									}

									if(records.calendar_type_five && records.calendar_type_value_five){
										let tempCalendarData = {
											status		:	parseInt(records.calendar_type_value_five),
											type		:	records.calendar_type_five,
											parent_id	:	"",
											added_by	:	authUserId,
											created		:	getUtcDate(),
											modified	:	getUtcDate(),
										};

										if(records.calendar_from_hour_five)		tempCalendarData.from_hour 	=	parseInt(records.calendar_from_hour_five);
										if(records.calendar_from_minute_five)	tempCalendarData.from_minute= 	parseInt(records.calendar_from_minute_five);
										if(records.calendar_to_hour_five)		tempCalendarData.to_hour 	= 	parseInt(records.calendar_to_hour_five);
										if(records.calendar_to_minute_five)		tempCalendarData.to_minute 	= 	parseInt(records.calendar_to_minute_five);

										tempData.calendar_list.push(tempCalendarData);
									}

									if(records.calendar_type_six && records.calendar_type_value_six){
										let tempCalendarData = {
											status		:	parseInt(records.calendar_type_value_six),
											type		:	records.calendar_type_six,
											parent_id	:	"",
											added_by	:	authUserId,
											created		:	getUtcDate(),
											modified	:	getUtcDate(),
										};

										if(records.calendar_from_hour_six)		tempCalendarData.from_hour 	=	parseInt(records.calendar_from_hour_six);
										if(records.calendar_from_minute_six)	tempCalendarData.from_minute= 	parseInt(records.calendar_from_minute_six);
										if(records.calendar_to_hour_six)		tempCalendarData.to_hour 	= 	parseInt(records.calendar_to_hour_six);
										if(records.calendar_to_minute_six)		tempCalendarData.to_minute 	= 	parseInt(records.calendar_to_minute_six);

										tempData.calendar_list.push(tempCalendarData);
									}

									dataToBeSaved.push(tempData);
									dataToBeExport.push([
										records.branch_id,
										records.branch_name_in_english,
										records.branch_name_in_arabic,
										records.branch_desc_in_english,
										records.branch_desc_in_arabic,
										records.branch_slogan_in_english,
										records.branch_slogan_in_arabic,
										records.additional_tax,
										records.extra_charge,
										records.discount_by_value,
										records.discount_by_percentage,
										records.extra_charge_percentage,
										records.accept_cashback_from_other_restaurants,
										records.discount_by_offer,
										records.maximum_duration_in_days_for_scheduled_orders,
										records.restaurant_branch_offers_cashback,
										records.restaurant_branch_accepts_cashback_payment,
										records.restaurant_branch_offers_double_cashback,
										records.restaurant_landing_images,
										records.hot_line,
										records.address_one,
										records.address_one_category,
										records.address_area_id,
										records.latitude,
										records.longitude,
										records.address_two,
										records.address_two_category,
										records.phone_one,
										records.phone_one_category,
										records.phone_one_contact_name,
										records.phone_two,
										records.phone_two_category,
										records.phone_two_contact_name,
										records.phone_three,
										records.phone_three_category,
										records.phone_three_contact_name,
										records.phone_four,
										records.phone_four_category,
										records.phone_four_contact_name,
										records.phone_five,
										records.phone_five_category,
										records.phone_five_contact_name,
										records.phone_six,
										records.phone_six_category,
										records.phone_six_contact_name,
										records.phone_sevan,
										records.phone_seven_category,
										records.phone_seven_contact_name,
										records.phone_eight,
										records.phone_eight_category,
										records.phone_eight_contact_name,
										records.phone_nine,
										records.phone_nine_category,
										records.phone_nine_contact_name,
										records.phone_ten,
										records.phone_ten_category,
										records.phone_ten_contact_name,
										records.payment_method_one,
										records.payment_method_two,
										records.payment_method_three,
										records.payment_method_four,
										records.payment_method_five,
										records.payment_method_six,
										records.calendar_type_one,
										records.calendar_type_value_one,
										records.calendar_from_hour_one,
										records.calendar_from_minute_one,
										records.calendar_to_hour_one,
										records.calendar_to_minute_one,
										records.calendar_type_two,
										records.calendar_type_value_two,
										records.calendar_from_hour_two,
										records.calendar_from_minute_two,
										records.calendar_to_hour_two,
										records.calendar_to_minute_two,
										records.calendar_type_three,
										records.calendar_type_value_three,
										records.calendar_from_hour_three,
										records.calendar_from_minute_three,
										records.calendar_to_hour_three,
										records.calendar_to_minute_three,
										records.calendar_type_four,
										records.calendar_type_value_four,
										records.calendar_from_hour_four,
										records.calendar_from_minute_four,
										records.calendar_to_hour_four,
										records.calendar_to_minute_four,
										records.calendar_type_five,
										records.calendar_type_value_five,
										records.calendar_from_hour_five,
										records.calendar_from_minute_five,
										records.calendar_to_hour_five,
										records.calendar_to_minute_five,
										records.calendar_type_six,
										records.calendar_type_value_six,
										records.calendar_from_hour_six,
										records.calendar_from_minute_six,
										records.calendar_to_hour_six,
										records.calendar_to_minute_six,
									]);
								}
								eachCallback(null);
							});
						}else{
							eachCallback(null);
						}
					}
				},(asyncErr)=>{
					if(asyncErr) return next(asyncErr);

					/** Send error response **/
					if(errors.length > 0) return res.send({ status	: Constants.STATUS_ERROR, message	: errors});

					if(dataToBeSaved.length < 1) return res.send({status : Constants.STATUS_ERROR,message : [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg':res.__("admin.system.something_going_wrong_please_try_again")}]});

					const restaurant_branch_attributes 		=	this.db.collection(Tables.RESTAURANT_BRANCH_ATTRIBUTES);
					const restaurant_branch_phone_numbers 	=	this.db.collection(Tables.RESTAURANT_BRANCH_PHONE_NUMBERS);
					const restaurant_branch_payment_methods	=	this.db.collection(Tables.RESTAURANT_BRANCH_PAYMENT_METHODS);
					const restaurant_branch_calendars		=	this.db.collection(Tables.RESTAURANT_BRANCH_CALENDARS);
					asyncEach(dataToBeSaved, (records, eachCallback) => {
						let tempBranchDetails 		=	clone(records.branch_details);
						let tempAttributeList 		=	clone(records.attribute_list);
						let tempPhoneList 			=	clone(records.phone_list);
						let tempPaymentMethods		=	clone(records.payment_methods);
						let tempCalendarList		=	clone(records.calendar_list);

						tempBranchDetails.restaurant_slug 	=	restaurantSlug;
						tempBranchDetails.restaurant_id 	= 	restaurantId;

						/** Save restaurant branch details  */
						restaurant_branches.insertOne(tempBranchDetails).then(branchResult=>{
							let branchId = branchResult?.insertedId || "";

							asyncParallel({
								save_branch_attributes : (subCallback)=>{
									tempAttributeList = tempAttributeList.map(data=>{
															data.branch_id 		= 	branchId;
															data.restaurant_id 	=	restaurantId;
															return data;
														});

									/** Save restaurant branch attribute  */
									restaurant_branch_attributes.insertMany(tempAttributeList,{forceServerObjectId:true}).then(attributeResult=>{
										subCallback(null,attributeResult);
									}).catch(subCallback);
								},
								save_branch_phones : (subCallback)=>{
									if(tempPhoneList.length < 1) return subCallback(null);

									tempPhoneList = tempPhoneList.map(data=>{
														data.branch_id 		= 	branchId;
														data.restaurant_id 	=	restaurantId;
														return data;
													});

									/** Save restaurant branch phone numbers  */
									restaurant_branch_phone_numbers.insertMany(tempPhoneList,{forceServerObjectId:true}).then(attributeResult=>{
										subCallback(null,attributeResult);
									}).catch(subCallback);
								},
								save_branch_calendar : (subCallback)=>{

									asyncEach(tempCalendarList, (data, eachChildCallback) => {
										/** Set calendar update data  */
										let calendarUpdatedata ={
											branch_id 		: branchId,
											restaurant_id 	: restaurantId,
											status 			: data.status,
											type 			: data.type,
											parent_id 		: "",
											modified		: data.modified,
											added_by 		: data.added_by,
											created	 		: data.created
										};

										if(data.status == Constants.OPEN && data.type && Constants.OPEN_STATUS[data.type]){

											if(typeof data.from_hour !== typeof undefined)		calendarUpdatedata.from_hour 	=	data.from_hour;
											if(typeof data.from_minute !== typeof undefined)	calendarUpdatedata.from_minute	= 	data.from_minute;
											if(typeof data.to_hour  !== typeof undefined)		calendarUpdatedata.to_hour 		= 	data.to_hour;
											if(typeof data.to_minute !== typeof undefined)		calendarUpdatedata.to_minute 	= 	data.to_minute;
										}

										if(data.type == Constants.SPECIAL_DAY_OF_WEEK){
											calendarUpdatedata.is_sw = true;
										}
										/** Save branch calendars details */
										restaurant_branch_calendars.insertOne(calendarUpdatedata).then(calendarResult=>{
											eachChildCallback(null,calendarResult);
										}).catch(eachChildCallback);
									},(asyncEachChildErr)=>{
										subCallback(asyncEachChildErr);
									});
								},
								save_branch_payment : (subCallback)=>{
									tempPaymentMethods.branch_id 		= 	branchId;
									tempPaymentMethods.restaurant_id 	=	restaurantId;

									/** Save restaurant branch calendar  */
									restaurant_branch_payment_methods.insertOne(tempPaymentMethods).then(paymentResult=>{
										subCallback(null,paymentResult);
									}).catch(subCallback);
								},
							},(parallelSubErr)=> {
								eachCallback(parallelSubErr);
							});
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return next(asyncEachErr);

						/** Save export data */
						let headings  = [
							res.__("admin.merchant_upload.branch_id"),
							res.__("admin.merchant_upload.branch_english_name"),
							res.__("admin.merchant_upload.branch_arabic_name"),
							res.__("admin.merchant_upload.branch_english_desc"),
							res.__("admin.merchant_upload.branch_arabic_desc"),
							res.__("admin.merchant_upload.branch_english_slogan"),
							res.__("admin.merchant_upload.branch_arabic_slogan"),
							res.__("admin.merchant_upload.additional_tax"),
							res.__("admin.merchant_upload.extra_charge"),
							res.__("admin.merchant_upload.discount_by_value"),
							res.__("admin.merchant_upload.discount_by_percentage"),
							res.__("admin.merchant_upload.extra_charge_percentage"),
							res.__("admin.merchant_upload.accept_cashback_from_other_restaurants"),
							res.__("admin.merchant_upload.discount_by_offer"),
							res.__("admin.merchant_upload.maximum_duration_in_days_for_scheduled_orders"),
							res.__("admin.merchant_upload.restaurant_branch_offers_cashback"),
							res.__("admin.merchant_upload.restaurant_branch_accepts_cashback_payment"),
							res.__("admin.merchant_upload.restaurant_branch_offers_double_cashback"),
							res.__("admin.merchant_upload.restaurant_landing_images"),
							res.__("admin.merchant_upload.hot_line"),
							res.__("admin.merchant_upload.branch_address1"),
							res.__("admin.merchant_upload.branch_address1_category"),
							res.__("admin.merchant_upload.branch_address_area_id"),
							res.__("admin.merchant_upload.branch_latitude"),
							res.__("admin.merchant_upload.branch_longitude"),
							res.__("admin.merchant_upload.branch_address2"),
							res.__("admin.merchant_upload.branch_address2_category"),
							res.__("admin.merchant_upload.branch_phone1"),
							res.__("admin.merchant_upload.branch_phone1_category"),
							res.__("admin.merchant_upload.branch_phone1_contact_name"),
							res.__("admin.merchant_upload.branch_phone2"),
							res.__("admin.merchant_upload.branch_phone2_category"),
							res.__("admin.merchant_upload.branch_phone2_contact_name"),
							res.__("admin.merchant_upload.branch_phone3"),
							res.__("admin.merchant_upload.branch_phone3_category"),
							res.__("admin.merchant_upload.branch_phone3_contact_name"),
							res.__("admin.merchant_upload.branch_phone4"),
							res.__("admin.merchant_upload.branch_phone4_category"),
							res.__("admin.merchant_upload.branch_phone4_contact_name"),
							res.__("admin.merchant_upload.branch_phone5"),
							res.__("admin.merchant_upload.branch_phone5_category"),
							res.__("admin.merchant_upload.branch_phone5_contact_name"),
							res.__("admin.merchant_upload.branch_phone6"),
							res.__("admin.merchant_upload.branch_phone6_category"),
							res.__("admin.merchant_upload.branch_phone6_contact_name"),
							res.__("admin.merchant_upload.branch_phone7"),
							res.__("admin.merchant_upload.branch_phone7_category"),
							res.__("admin.merchant_upload.branch_phone7_contact_name"),
							res.__("admin.merchant_upload.branch_phone8"),
							res.__("admin.merchant_upload.branch_phone8_category"),
							res.__("admin.merchant_upload.branch_phone8_contact_name"),
							res.__("admin.merchant_upload.branch_phone9"),
							res.__("admin.merchant_upload.branch_phone9_category"),
							res.__("admin.merchant_upload.branch_phone9_contact_name"),
							res.__("admin.merchant_upload.branch_phone10"),
							res.__("admin.merchant_upload.branch_phone10_category"),
							res.__("admin.merchant_upload.branch_phone10_contact_name"),
							res.__("admin.merchant_upload.payment_method_id1"),
							res.__("admin.merchant_upload.payment_method_id2"),
							res.__("admin.merchant_upload.payment_method_id3"),
							res.__("admin.merchant_upload.payment_method_id4"),
							res.__("admin.merchant_upload.payment_method_id5"),
							res.__("admin.merchant_upload.payment_method_id6"),
							res.__("admin.merchant_upload.calendar_type1"),
							res.__("admin.merchant_upload.calendar_type_value1"),
							res.__("admin.merchant_upload.from_hour1"),
							res.__("admin.merchant_upload.from_minute1"),
							res.__("admin.merchant_upload.to_hour1"),
							res.__("admin.merchant_upload.to_minute1"),
							res.__("admin.merchant_upload.calendar_type2"),
							res.__("admin.merchant_upload.calendar_type_value2"),
							res.__("admin.merchant_upload.from_hour2"),
							res.__("admin.merchant_upload.from_minute2"),
							res.__("admin.merchant_upload.to_hour2"),
							res.__("admin.merchant_upload.to_minute2"),
							res.__("admin.merchant_upload.calendar_type3"),
							res.__("admin.merchant_upload.calendar_type_value3"),
							res.__("admin.merchant_upload.from_hour3"),
							res.__("admin.merchant_upload.from_minute3"),
							res.__("admin.merchant_upload.to_hour3"),
							res.__("admin.merchant_upload.to_minute3"),
							res.__("admin.merchant_upload.calendar_type4"),
							res.__("admin.merchant_upload.calendar_type_value4"),
							res.__("admin.merchant_upload.from_hour4"),
							res.__("admin.merchant_upload.from_minute4"),
							res.__("admin.merchant_upload.to_hour4"),
							res.__("admin.merchant_upload.to_minute4"),
							res.__("admin.merchant_upload.calendar_type5"),
							res.__("admin.merchant_upload.calendar_type_value5"),
							res.__("admin.merchant_upload.from_hour5"),
							res.__("admin.merchant_upload.from_minute5"),
							res.__("admin.merchant_upload.to_hour5"),
							res.__("admin.merchant_upload.to_minute5"),
							res.__("admin.merchant_upload.calendar_type6"),
							res.__("admin.merchant_upload.calendar_type_value6"),
							res.__("admin.merchant_upload.from_hour6"),
							res.__("admin.merchant_upload.from_minute6"),
							res.__("admin.merchant_upload.to_hour6"),
							res.__("admin.merchant_upload.to_minute6"),
						];
						const tmp_imports	= 	this.db.collection(Tables.TMP_IMPORTS);
						tmp_imports.insertOne({
							upload_action : Constants.MERCHANT_UPLOAD_BRANCHES,
							headings 	  : headings,
							data 	 	  : dataToBeExport,
						}).then(exportResult=>{
							/** Send success response  */
							let exportId = exportResult?.insertedId || "";
							res.send({
								status 		:Constants.STATUS_SUCCESS,
								message 	:res.__("admin.merchant_upload.branch_has_been_added_successfully"),
								redirect_url:Constants.WEBSITE_ADMIN_URL+"merchant_upload/export_data/"+exportId,
							});
						}).catch(next);
					});
				});
			});
		}else{
			/** Render add branch page  **/
			res.render('add_branch',{
				layout	: false
			});
		}
	};//End addBranches()

	/**
	 * Function for add branches
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async addBranchAreas(req,res,next){
		try{
			if(isPost(req)){
				/** Sanitize Data **/
				req.body			= 	sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
				let branchAreaList	=	(req.body.branch_area)		?	req.body.branch_area 		:[];
				let restaurantSlug	=	(req.body.restaurant_slug)	?	req.body.restaurant_slug	:"";

				/** Send error response  */
				if(branchAreaList.length < 1) return res.send({status : Constants.STATUS_ERROR,message : [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg':res.__("admin.system.something_going_wrong_please_try_again")}]});

				/** Send error response  */
				if(!restaurantSlug) return res.send({status: Constants.STATUS_ERROR,message: [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg': res.__("admin.merchant_upload.please_select_restaurant")}]});

				/** Get delivery methods list  */
				const delivery_methods = this.db.collection(Tables.DELIVERY_METHODS);
				let methodList = await delivery_methods.distinct( "slug", {});

				/**Check errors and if no error set array to save data */
				const areas 				=	this.db.collection(Tables.AREAS);
				const restaurant_branches 	=	this.db.collection(Tables.RESTAURANT_BRANCHES);
				let errors			=	[];
				let dataToBeSaved	= 	[];
				let authUserId		= 	new ObjectId(req.session.user._id);
				let validIntegerRegx = 	/^[0-9]+$/;
				let validFloatRegx = 	/^([0-9]*[.])?[0-9]+$/;
				let dataToBeExport	 = [];
				asyncEach(branchAreaList, (records, eachCallback) => {
					if(records){
						let currentIndex 		=	records.index;
						let sameElementError 	=	false;

						if(!records.branch_id){
							sameElementError = true;
							errors.push({'param':"branch_id_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_branch_id")});
						}

						if(!records.area_id){
							sameElementError = true;
							errors.push({'param':"area_id_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_area_id")});
						}

						if(!records.delivery_by){
							sameElementError = true;
							errors.push({'param':"delivery_by_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_delivery_by")});
						}else if(methodList.indexOf(records.delivery_by) == -1){
							sameElementError = true;
							errors.push({'param':"delivery_by_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_delivery_by")});
						}

						if(records.delivery_fess && isNaN(records.delivery_fess)){
							sameElementError = true;
							errors.push({'param':"delivery_fess_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_delivery_fess")});
						}

						if(records.delivery_duration && !validIntegerRegx.test(records.delivery_duration)){
							sameElementError = true;
							errors.push({'param':"delivery_duration_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_delivery_duration")});
						}

						if(records.preparation_time && !validIntegerRegx.test(records.preparation_time)){
							errors.push({'param':"preparation_time_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_preparation_time")});
						}

						if(records.minimum_order_limit && !validFloatRegx.test(records.minimum_order_limit)){
							sameElementError = true;
							errors.push({'param':"minimum_order_limit_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_minimum_order_limit")});
						}

						if(records.accept_scheduling_orders && (!validIntegerRegx.test(records.accept_scheduling_orders) || (records.accept_scheduling_orders !=1 && records.accept_scheduling_orders !=0) )){
							sameElementError = true;
							errors.push({'param':"accept_scheduling_orders_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_accept_scheduling_orders")});
						}

						if(records.branch_area_status && (!validIntegerRegx.test(records.branch_area_status) || (records.branch_area_status != Constants.CLOSE && records.branch_area_status != Constants.OPEN))){
							sameElementError = true;
							errors.push({'param':"branch_area_status_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_branch_area_status")});
						}

						if(records.accept_pickup_orders && (!validIntegerRegx.test(records.accept_pickup_orders) || (records.accept_pickup_orders !=1 && records.accept_pickup_orders !=0) )){
							sameElementError = true;
							errors.push({'param':"accept_pickup_orders_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_accept_pickup_orders")});
						}

						if(records.has_offers && (!validIntegerRegx.test(records.has_offers) || (records.has_offers !=1 && records.has_offers !=0) )){
							sameElementError = true;
							errors.push({'param':"has_offers_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_has_offers")});
						}

						if(!records.morning_profile){
							sameElementError = true;
							errors.push({'param':"morning_profile_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_morning_profile")});
						}

						if(records.morning_profile && !validIntegerRegx.test(records.morning_profile)){
							sameElementError = true;
							errors.push({'param':"morning_profile_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_morning_profile")});
						}

						if(!records.day_profile){
							sameElementError = true;
							errors.push({'param':"day_profile_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_day_profile")});
						}

						if(records.day_profile && !validIntegerRegx.test(records.day_profile)){
							sameElementError = true;
							errors.push({'param':"day_profile_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_day_profile")});
						}

						/** Push data in array if not error */
						if(!sameElementError){
							/** Get restaurant branch details **/
							restaurant_branches.findOne({
								restaurant_slug	: restaurantSlug,
								branch_number	: records.branch_id
							},{projection :{_id:1,restaurant_id:1,city_id:1}}).then(branchResult=>{

								/** Push error when branch id is not valid  */
								if(!branchResult){
									sameElementError = true;
									errors.push({param:'branch_id_'+currentIndex, msg:res.__("admin.merchant_upload.please_enter_valid_branch_id")});
								}

								if(!sameElementError){
									/** Check enter area id is valid or not */
									areas.findOne({
										area_id 	:	records.area_id,
										is_active 	:  	Constants.ACTIVE,
									},{projection :{_id:1}}).then(areaResult=>{

										/** Push error when area id is not valid  */
										if(!areaResult){
											sameElementError = true;
											errors.push({param:'area_id_'+currentIndex, msg:res.__("admin.merchant_upload.please_enter_valid_area_id")});
										}

										if(!sameElementError){
											let tempData = {
												restaurant_sub_details : {
													restaurant_id	: 	branchResult.restaurant_id,
													delivery_by 	: 	(records.delivery_by) ? records.delivery_by :""
												},
												area_details : {
													added_by 		: 	authUserId,
													branch_id		: 	branchResult._id,
													restaurant_id	: 	branchResult.restaurant_id,
													area_id			: 	areaResult._id,
													open			:	(parseInt(records.branch_area_status) > 0) ? Constants.OPEN : Constants.CLOSE,
													created			:	getUtcDate(),
													modified 		: 	getUtcDate(),
													delivery_by		: 	(records.delivery_by) ? records.delivery_by :"",
													delivery_fees	: 	(records.delivery_fess) ? parseFloat(records.delivery_fess) :0,
													preparation_time: 	(records.preparation_time) ? parseFloat(records.preparation_time) :0,
													delivery_time	: 	(records.delivery_duration) ? parseFloat(records.delivery_duration) :0,
													minimum_order_limit	: 	(records.minimum_order_limit) ? parseFloat(records.minimum_order_limit) :0,
													accept_scheduling_orders: (records.accept_scheduling_orders) ? parseInt(records.accept_scheduling_orders) :"",
													accept_pickup_orders	: (records.accept_pickup_orders) 	 ? parseInt(records.accept_pickup_orders)     :"",
													coming_soon		: (records.coming_soon) 	? parseInt(records.coming_soon) 	:"",
													has_offers 		: (records.has_offers) 		? parseInt(records.has_offers) 		:"",
													morning_profile : (records.morning_profile) ? parseInt(records.morning_profile) :"",
													day_profile 	: (records.day_profile) 	? parseInt(records.day_profile) 	:"",
												},
												area_settings_list : [{
														added_by 		: 	authUserId,
														branch_id		: 	branchResult._id,
														restaurant_id	: 	branchResult.restaurant_id,
														area_id			: 	areaResult._id,
														attribute_id	: 	parseInt(records.delivery_by_id),
														attribute_value : 	records?.delivery_by || "",
														created			:	getUtcDate(),
														modified 		: 	getUtcDate(),
													},
													{
														added_by 		: 	authUserId,
														branch_id		: 	branchResult._id,
														restaurant_id	: 	branchResult.restaurant_id,
														area_id			: 	areaResult._id,
														attribute_id	: 	parseInt(records.delivery_fess_id),
														attribute_value : 	(records.delivery_fess) ? parseFloat(records.delivery_fess) :0,
														created			:	getUtcDate(),
														modified 		: 	getUtcDate(),
													},
													{
														added_by 		: 	authUserId,
														branch_id		: 	branchResult._id,
														restaurant_id	: 	branchResult.restaurant_id,
														area_id			: 	areaResult._id,
														attribute_id	: 	parseInt(records.delivery_duration_id),
														attribute_value : 	(records.delivery_duration) ? records.delivery_duration :"",
														created			:	getUtcDate(),
														modified 		: 	getUtcDate(),
													},
													{
														added_by 		: 	authUserId,
														branch_id		: 	branchResult._id,
														restaurant_id	: 	branchResult.restaurant_id,
														area_id			: 	areaResult._id,
														attribute_id	: 	parseInt(records.preparation_time_id),
														attribute_value : 	(records.preparation_time) ? records.preparation_time :"",
														created			:	getUtcDate(),
														modified 		: 	getUtcDate(),
													},
													{
														added_by 		: 	authUserId,
														branch_id		: 	branchResult._id,
														restaurant_id	: 	branchResult.restaurant_id,
														area_id			: 	areaResult._id,
														attribute_id	: 	parseInt(records.minimum_order_limit_id),
														attribute_value : 	(records.minimum_order_limit) ? records.minimum_order_limit :"",
														created			:	getUtcDate(),
														modified 		: 	getUtcDate(),
													},
													{
														added_by 		: 	authUserId,
														branch_id		: 	branchResult._id,
														restaurant_id	: 	branchResult.restaurant_id,
														area_id			: 	areaResult._id,
														attribute_id	: 	parseInt(records.accept_scheduling_orders_id),
														attribute_value : 	(records.accept_scheduling_orders) ? records.accept_scheduling_orders :"",
														created			:	getUtcDate(),
														modified 		: 	getUtcDate(),
													},
													{
														added_by 		: 	authUserId,
														branch_id		: 	branchResult._id,
														restaurant_id	: 	branchResult.restaurant_id,
														area_id			: 	areaResult._id,
														attribute_id	: 	parseInt(records.accept_pickup_orders_id),
														attribute_value : 	(records.accept_pickup_orders) ? records.accept_pickup_orders :"",
														created			:	getUtcDate(),
														modified 		: 	getUtcDate(),
													},
													{
														added_by 		: 	authUserId,
														branch_id		: 	branchResult._id,
														restaurant_id	: 	branchResult.restaurant_id,
														area_id			: 	areaResult._id,
														attribute_id	: 	parseInt(records.coming_soon_id),
														attribute_value : 	(records.coming_soon) ? records.coming_soon :"",
														created			:	getUtcDate(),
														modified 		: 	getUtcDate(),
													},
													{
														added_by 		: 	authUserId,
														branch_id		: 	branchResult._id,
														restaurant_id	: 	branchResult.restaurant_id,
														area_id			: 	areaResult._id,
														attribute_id	: 	parseInt(records.has_offers_id),
														attribute_value : 	(records.has_offers) ? records.has_offers :"",
														created			:	getUtcDate(),
														modified 		: 	getUtcDate(),
													},
													{
														added_by 		: 	authUserId,
														branch_id		: 	branchResult._id,
														restaurant_id	: 	branchResult.restaurant_id,
														area_id			: 	areaResult._id,
														attribute_id	: 	parseInt(records.morning_profile_id),
														attribute_value : 	(records.morning_profile) ? records.morning_profile :"",
														created			:	getUtcDate(),
														modified 		: 	getUtcDate(),
													},
													{
														added_by 		: 	authUserId,
														branch_id		: 	branchResult._id,
														restaurant_id	: 	branchResult.restaurant_id,
														area_id			: 	areaResult._id,
														attribute_id	: 	parseInt(records.day_profile_id),
														attribute_value : 	(records.day_profile) ? records.day_profile :"",
														created			:	getUtcDate(),
														modified 		: 	getUtcDate(),
													},
												],
											}

											dataToBeSaved.push(tempData);
											dataToBeExport.push([
												records.branch_id,
												records.area_id,
												records.delivery_by,
												records.delivery_fess,
												records.delivery_duration,
												records.preparation_time,
												records.minimum_order_limit,
												records.branch_area_status,
												records.branch_priority_in_area,
												records.accept_scheduling_orders,
												records.accept_pickup_orders,
												records.coming_soon,
												records.has_offers,
												records.morning_profile,
												records.day_profile
											]);

											eachCallback(null);
										} else{
											eachCallback(null);
										}
									});
								} else{
									eachCallback(null);
								}
							}).catch(next);
						} else{
							eachCallback(null);
						}
					}
				},(asyncErr)=>{
					if(asyncErr) return next(asyncErr);

					/** Send error response **/
					if(errors.length > 0) return res.send({ status	: Constants.STATUS_ERROR, message	: errors});

					if(dataToBeSaved.length < 1) return res.send({status : Constants.STATUS_ERROR,message : [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg':res.__("admin.system.something_going_wrong_please_try_again")}]});

					const restaurant_details 				=	this.db.collection(Tables.RESTAURANT_DETAILS);
					const restaurant_branch_area_settings 	=	this.db.collection(Tables.RESTAURANT_BRANCH_AREA_SETTINGS);
					const restaurant_branch_areas 			=	this.db.collection(Tables.RESTAURANT_BRANCH_AREAS);
					asyncEach(dataToBeSaved, (records, eachCallback) => {
						let areaSettingsList 		=	clone(records.area_settings_list);
						let areaDetails 			=	clone(records.area_details);
						let restaurantSubDetails	=	clone(records.restaurant_sub_details);

						asyncParallel({
							save_restaurant_details : (subCallback)=>{
								if(!restaurantSubDetails.delivery_by) return subCallback(null);

								/** Save delivery method list  */
								restaurant_details.updateOne({
									restaurant_id :	new ObjectId(restaurantSubDetails.restaurant_id),
								},
								{
									$addToSet : {
										delivery_by: restaurantSubDetails.delivery_by,
									},
									$set : {
										modified: getUtcDate()
									}
								},{upsert: true}).then(result=>{
									subCallback(null,result);
								}).catch(next);
							},
							save_branch_area : (subCallback)=>{
								/** Save restaurant branch area   */
								restaurant_branch_areas.updateOne({
									restaurant_id	:	new ObjectId(areaDetails.restaurant_id),
									branch_id 		:	new ObjectId(areaDetails.branch_id),
									area_id 		:	new ObjectId(areaDetails.area_id),
								},
								{
									$set : {
										modified				:	getUtcDate(),
										delivery_by				:	areaDetails.delivery_by,
										delivery_fees			:	areaDetails.delivery_fees,
										preparation_time		:	areaDetails.preparation_time,
										delivery_time			:	areaDetails.delivery_time,
										minimum_order_limit		: 	areaDetails.minimum_order_limit,
										accept_scheduling_orders:	areaDetails.accept_scheduling_orders,
										accept_pickup_orders	:	areaDetails.accept_pickup_orders,
										has_offers				:	areaDetails.has_offers,
										evening_profile			:	areaDetails.day_profile,
										coming_soon				:	areaDetails.coming_soon,
										morning_profile			:	areaDetails.morning_profile,
									},
									$setOnInsert : {
										open 	:	areaDetails.open,
										added_by: 	areaDetails.added_by,
										created	:	getUtcDate(),
									}
								},{upsert: true}).then(result=>{
									subCallback(null,result);
								}).catch(next);
							},
							save_branch_area_settings : (subCallback)=>{

								/** Save restaurant branch area setting  */
								asyncEach(areaSettingsList, (data, eachSubCallback) => {

									restaurant_branch_area_settings.updateOne({
										restaurant_id	:	new ObjectId(data.restaurant_id),
										branch_id 		:	new ObjectId(data.branch_id),
										area_id 		:	new ObjectId(data.area_id),
										attribute_id 	:	data.attribute_id,
									},
									{
										$set : {
											attribute_value : data.attribute_value,
											modified		: getUtcDate()
										},
										$setOnInsert : {
											added_by	: 	data.added_by,
											created		:	getUtcDate(),
										}
									},{upsert: true}).then(result=>{
										eachSubCallback(null,result);
									}).catch(next);
								},(asyncEachErr)=>{
									subCallback(asyncEachErr);
								});
							},
						},(parallelSubErr)=> {
							eachCallback(parallelSubErr);
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return next(asyncEachErr);

						/** Save export data */
						let headings  = [
							res.__("admin.merchant_upload.branch_id"),
							res.__("admin.merchant_upload.area_id"),
							res.__("admin.merchant_upload.delivery_by"),
							res.__("admin.merchant_upload.delivery_fess"),
							res.__("admin.merchant_upload.delivery_duration"),
							res.__("admin.merchant_upload.preparation_time"),
							res.__("admin.merchant_upload.minimum_order_limit"),
							res.__("admin.merchant_upload.branch_area_status"),
							res.__("admin.merchant_upload.branch_priority_in_area"),
							res.__("admin.merchant_upload.accept_scheduling_orders"),
							res.__("admin.merchant_upload.accept_pickup_orders"),
							res.__("admin.merchant_upload.coming_soon"),
							res.__("admin.merchant_upload.has_offers"),
							res.__("admin.merchant_upload.morning_profile"),
							res.__("admin.merchant_upload.day_profile"),
						];
						const tmp_imports	= 	this.db.collection(Tables.TMP_IMPORTS);
						tmp_imports.insertOne({
							upload_action : Constants.MERCHANT_UPLOAD_BRANCH_AREAS,
							headings 	  : headings,
							data 	 	  : dataToBeExport,
						}).then(exportResult=>{
							/** Send success response  */
							let exportId = exportResult?.insertedId || "";
							res.send({
								status 		:Constants.STATUS_SUCCESS,
								message 	:res.__("admin.merchant_upload.branch_area_has_been_added_successfully"),
								redirect_url:Constants.WEBSITE_ADMIN_URL+"merchant_upload/export_data/"+exportId,
							});
						}).catch(next);
					});
				});
			}else{
				/** Render add branch area page  **/
				res.render('add_branch_area',{
					layout	: false
				});
			}
		}catch(err){
			return next(err);
		}
	}//End addBranchAreas()

	/**
	 * Function for add Item Choice Group
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async addItemChoiceGroup(req,res,next){

		if(isPost(req)){
			req.body			= sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let choiceGroups	= (req.body.choice_group) 	? req.body.choice_group 	: [];
			let restaurantSlug	= (req.body.restaurant_slug)? req.body.restaurant_slug	: "";

			/** Send error response  */
			if(choiceGroups.length < 1) return res.send({status : Constants.STATUS_ERROR,message : [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg':res.__("admin.system.something_going_wrong_please_try_again")}]});

			/** Send error response  */
			if(!restaurantSlug) return res.send({status: Constants.STATUS_ERROR,message: [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg': res.__("admin.merchant_upload.please_select_restaurant")}]});

			/**Get restaurant id */
			let restaurantId = "";
			if(restaurantSlug) restaurantId = await getRestaurantId(req,res,next,{slug : restaurantSlug});

			/**Check errors and if no error set array to save data */
			const item_choices_groups = this.db.collection(Tables.ITEM_CHOICES_GROUPS);
			let errors			= [];
			let dataToBeSaved	= [];
			let duplicateNames 	= {en : {},ar:{}};
			let dataToBeExport	= [];
			asyncEach(choiceGroups, (choiceGroup, eachCallback) => {
				if(choiceGroup){
					if(!choiceGroup.choice_group_old_id || choiceGroup.choice_group_old_id == ""){
						let param = "choice_group_old_id_"+choiceGroup.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_choice_group_old_id")});
					}
					if(!choiceGroup.item_id || choiceGroup.item_id == ""){
						let param = "item_id_"+choiceGroup.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_item_id")});
					}
					if(!choiceGroup.group_name_english || choiceGroup.group_name_english == ""){
						let param = "group_name_english_"+choiceGroup.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_name_in_english")});
					}
					if(!choiceGroup.group_name_arabic || choiceGroup.group_name_arabic == ""){
						let param = "group_name_arabic_"+choiceGroup.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_name_in_arabic")});
					}
					if(!choiceGroup.group_min_quantity || choiceGroup.group_min_quantity == ""){
						let param = "group_min_quantity_"+choiceGroup.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_group_min_quantity")});
					}
					if(choiceGroup.group_min_quantity && (isNaN(choiceGroup.group_min_quantity) || choiceGroup.group_min_quantity <0)){
						errors.push({ 'param': "group_min_quantity_"+choiceGroup.index, 'msg': res.__("admin.merchant_upload.please_enter_valid_group_min_quantity") });
					}
					if(!choiceGroup.group_max_quantity || choiceGroup.group_max_quantity == ""){
						let param = "group_max_quantity_"+choiceGroup.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_group_max_quantity")});
					}
					if(choiceGroup.group_max_quantity && isNaN(choiceGroup.group_max_quantity)){
						errors.push({ 'param': "group_max_quantity_"+choiceGroup.index, 'msg': res.__("admin.merchant_upload.please_enter_valid_group_max_quantity") });
					}
					if(choiceGroup.group_max_quantity && choiceGroup.group_max_quantity <= 0){
						errors.push({ 'param': "group_max_quantity_"+choiceGroup.index, 'msg': res.__("admin.merchant_upload.please_enter_group_max_quantity_greater_than_zero") });
					}
					/**Check for group max and min quantity */
					if (choiceGroup.group_max_quantity < choiceGroup.group_min_quantity) {
						let param = "group_max_quantity_"+choiceGroup.index;
						errors.push({'param': param, 'msg': res.__("admin.merchant_upload.max_quantity_should_be_greater_than_min_quantity") });
					}
					/** check duplicate entry in form*/
					if(choiceGroup.group_name_english){
						let tempEnName  = choiceGroup.group_name_english.trim().toLowerCase();
						let param 		= "group_name_english_"+choiceGroup.index;
						if(duplicateNames.en[tempEnName]){
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.whoops_you_have_entered_an_already_used_name_in_english")});
						}else{
							duplicateNames.en[tempEnName] = true;
						}
					}
					if(choiceGroup.group_name_arabic){
						let tempArName = choiceGroup.group_name_arabic.trim().toLowerCase();
						let param 	   = "group_name_arabic_"+choiceGroup.index;
						if(duplicateNames.ar[tempArName]){
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.whoops_you_have_entered_an_already_used_name_in_arabic")});
						}else{
							duplicateNames.ar[tempArName] = true;
						}
					}
					/** Push data in array if not error */
					if(errors.length == 0){
						/**Get item id */
						const items = this.db.collection(Tables.ITEMS);
						items.findOne({item_id : choiceGroup.item_id},{projection: { _id: 1}}).then(itemResult=>{

							/** Push error when item id is not valid  */
							if(!itemResult) errors.push({'param':"item_id_"+choiceGroup.index,'msg':res.__("admin.merchant_upload.this_item_id_not_belongs_to_selected_reataurant")});

							if(errors.length == 0){
								let itemId = (itemResult && itemResult._id) ? itemResult._id : "";

								asyncParallel({
									name_details : (callback)=>{
										/** find choice group name in both language if already exists **/
										item_choices_groups.findOne({
											item_id : new ObjectId(itemId),
											$or : [
												{ "name.en" : {$regex : '^'+cleanRegex(choiceGroup.group_name_english)+'$',$options : 'i'}},
												{ "name.ar" : {$regex : '^'+cleanRegex(choiceGroup.group_name_arabic)+'$',$options : 'i'}}
											],
										},{projection: { _id: 1,name:1}}).then(nameResult=>{
											callback(null,nameResult);
										}).catch(next);
									},
									tmp_name_details : (callback)=>{
										/** find choice group name in both language if already exists **/
										const tmp_item_choices_groups = this.db.collection(Tables.TMP_ITEM_CHOICES_GROUPS);
										tmp_item_choices_groups.findOne({
											item_id : new ObjectId(itemId),
											$or : [
												{ "name.en" : {$regex : '^'+cleanRegex(choiceGroup.group_name_english)+'$',$options : 'i'}},
												{ "name.ar" : {$regex : '^'+cleanRegex(choiceGroup.group_name_arabic)+'$',$options : 'i'}}
											],
										},{projection: { _id: 1,name:1}}).then(tmpResult=>{
											callback(null,tmpResult);
										}).catch(next);
									},
									is_valid_item_unit_id : (callback)=>{
										/** Check enter item unit id is valid or not */
										const item_units = this.db.collection(Tables.ITEM_UNITS);
										item_units.distinct( "item_unit_id",{item_id : new ObjectId(itemId)}).then(itemUnitResult=>{

											const item_units_masters = this.db.collection(Tables.ITEM_UNITS_MASTERS);
											item_units_masters.findOne({_id : {$in : itemUnitResult },item_unit_id : choiceGroup.item_unit_id,restaurant_slug:restaurantSlug},{projection: { _id: 1}}).then(itemUnitsMastersResult=>{
												callback(null,itemUnitsMastersResult);
											}).catch(next);
										}).catch(next);
									}
								},(parallelErr,response)=> {
									if(parallelErr) return eachCallback(parallelErr);

									/**Check names is unique */
									let choiceGroupName    = (response.name_details && response.name_details.name)  				? response.name_details.name 		 :"";
									let tmpChoiceGroupName = (response.tmp_name_details && response.tmp_name_details.name)  		? response.tmp_name_details.name	 :"";
									let itemUnitId 		   = (response.is_valid_item_unit_id && response.is_valid_item_unit_id._id) ? response.is_valid_item_unit_id._id :"";

									if(choiceGroupName || tmpChoiceGroupName){
										if((choiceGroupName.en && choiceGroupName.en.toLowerCase() == choiceGroup.group_name_english.toLowerCase()) || (tmpChoiceGroupName.en && tmpChoiceGroupName.en.toLowerCase() == choiceGroup.group_name_english.toLowerCase())){
											if (!errors) errors = [];
											errors.push({'param':'group_name_english_'+choiceGroup.index,'msg':res.__("admin.merchant_upload.whoops_you_have_entered_an_already_used_name_in_english")});
										}
										if((choiceGroupName.ar && choiceGroupName.ar.toLowerCase() == choiceGroup.group_name_arabic.toLowerCase()) || (tmpChoiceGroupName.ar && tmpChoiceGroupName.ar.toLowerCase() == choiceGroup.group_name_arabic.toLowerCase())){
											if (!errors) errors = [];
											errors.push({'param':"group_name_arabic_"+choiceGroup.index,'msg':res.__("admin.merchant_upload.whoops_you_have_entered_an_already_used_name_in_arabic")});
										}
									}

									/** Push error when item unit id is not valid  */
									if(!itemUnitId && choiceGroup.item_unit_id) errors.push({'param':"item_unit_id_"+choiceGroup.index,'msg':res.__("admin.merchant_upload.this_choice_group_not_belongs_to_selected_reataurant")});

									/** Push data in array */
									if(errors.length == 0){
										let tempData = {
											name : {
												ar : choiceGroup?.group_name_arabic || "",
												en : choiceGroup?.group_name_english || "",
											},
											description : {
												ar : choiceGroup?.group_description_in_arabic || "",
												en : choiceGroup?.group_description_in_english || "",
											},
											min_quantity  	: parseInt(choiceGroup?.group_min_quantity || 0),
											max_quantity  	: parseInt(choiceGroup?.group_max_quantity || 0),
											restaurant_id 	: new ObjectId(restaurantId),
											item_unit_id 	: itemUnitId ? new ObjectId(itemUnitId) : "",
											item_id 	  	: new ObjectId(itemId),
											created  	 	: getUtcDate(),
											modified   		: getUtcDate(),
											choice_group_old_id : choiceGroup?.choice_group_old_id || ""
										};
										dataToBeSaved.push(tempData);
										dataToBeExport.push([
											choiceGroup.choice_group_old_id,
											choiceGroup.item_id,
											choiceGroup.item_unit_id,
											choiceGroup.group_name_english,
											choiceGroup.group_name_arabic,
											choiceGroup.group_min_quantity,
											choiceGroup.group_max_quantity,
											choiceGroup.group_description_in_english,
											choiceGroup.group_description_in_arabic,
										]);
									}
									eachCallback(null);
								});
							} else{
								eachCallback(null);
							}
						});
					}else{
						eachCallback(null);
					}
				}else{
					eachCallback(null);
				}
			},(asyncErr)=>{
				if(asyncErr) return next(asyncErr);

				/** Send error response **/
				if(errors.length > 0) return res.send({ status: Constants.STATUS_ERROR, message	: errors});

				/** Send error response **/
				if(dataToBeSaved.length < 1) return res.send({status : Constants.STATUS_ERROR,message : [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg':res.__("admin.system.something_going_wrong_please_try_again")}]});

				/** Save data */
				item_choices_groups.insertMany(dataToBeSaved,{forceServerObjectId:true}).then(()=>{

					/** Save export data */
					let headings  = [
						res.__("admin.merchant_upload.choice_group_old_id"),
						res.__("admin.merchant_upload.item_id"),
						res.__("admin.merchant_upload.item_unit_id"),
						res.__("admin.merchant_upload.group_name_english"),
						res.__("admin.merchant_upload.group_name_arabic"),
						res.__("admin.merchant_upload.group_min_quantity"),
						res.__("admin.merchant_upload.group_max_quantity"),
						res.__("admin.merchant_upload.group_description_in_english"),
						res.__("admin.merchant_upload.group_description_in_arabic")
					];
					const tmp_imports	= 	this.db.collection(Tables.TMP_IMPORTS);
					tmp_imports.insertOne({
						upload_action : Constants.MERCHANT_UPLOAD_ITEM_CHOICE_GROUP,
						headings 	  : headings,
						data 	 	  : dataToBeExport,
					}).then(exportResult=>{
						/** Send success response  */
						let exportId = exportResult?.insertedId || "";
						res.send({
							status 		:Constants.STATUS_SUCCESS,
							message 	:res.__("admin.merchant_upload.choice_groups_has_been_added_successfully"),
							redirect_url:Constants.WEBSITE_ADMIN_URL+"merchant_upload/export_data/"+exportId,
						});
					}).catch(next);
				}).catch(next);
			});
		}else{
			/** Render add item choice group page  **/
			res.render('add_item_choice_group',{
				layout	: false
			});
		}
	}//End addItemChoiceGroup()

	/**
	 * Function for add Item Extra Items
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async addItemExtraItems(req,res,next){

		if(isPost(req)){
			req.body			= sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let extraItems	    = (req.body.extra_items) 	? req.body.extra_items 	   :[];
			let restaurantSlug	= (req.body.restaurant_slug)? req.body.restaurant_slug :"";

			/** Send error response **/
			if(extraItems.length < 1) return res.send({status : Constants.STATUS_ERROR,message : [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg':res.__("admin.system.something_going_wrong_please_try_again")}]});

			/** Send error response  */
			if(!restaurantSlug) return res.send({status: Constants.STATUS_ERROR,message: [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg': res.__("admin.merchant_upload.please_select_restaurant")}]});

			/**Get restaurant id */
			let restaurantId = "";
			if(restaurantSlug) restaurantId = await getRestaurantId(req,res,next,{slug : restaurantSlug});

			/**Check errors and if no error set array to save data */
			const item_extra_masters = this.db.collection(Tables.ITEM_EXTRA_MASTERS);
			let errors			= [];
			let dataToBeSaved	= [];
			let duplicateNames 	= {en : {},ar:{}};
			let dataToBeExport	= [];
			asyncEach(extraItems, (extraItem, eachCallback) => {
				if(extraItem){
					if(!extraItem.extra_items_old_id || extraItem.extra_items_old_id == ""){
						let param = "extra_items_old_id_"+extraItem.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_extra_items_old_id")});
					}
					if(!extraItem.item_id || extraItem.item_id == ""){
						let param = "item_id_"+extraItem.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_item_id")});
					}
					if(!extraItem.name_in_english || extraItem.name_in_english == ""){
						let param = "name_in_english_"+extraItem.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_name_in_english")});
					}
					if(!extraItem.name_in_arabic || extraItem.name_in_arabic == ""){
						let param = "name_in_arabic_"+extraItem.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_name_in_arabic")});
					}
					if(!extraItem.extra_fees || extraItem.extra_fees == ""){
						let param = "extra_fees_"+extraItem.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_extra_fees")});
					}
					if(extraItem.extra_fees && (isNaN(extraItem.extra_fees) || extraItem.extra_fees < 0)){
						errors.push({ 'param': "extra_fees_"+extraItem.index, 'msg': res.__("admin.merchant_upload.please_enter_valid_extra_fees") });
					}

					/** Check duplicate entry in form*/
					if(extraItem.name_in_english){
						let tempEnName  = extraItem.name_in_english.trim().toLowerCase();
						let param 		= "name_in_english_"+extraItem.index;
						if(duplicateNames.en[tempEnName]){
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.whoops_you_have_entered_an_already_used_name_in_english")});
						}else{
							duplicateNames.en[tempEnName] = true;
						}
					}
					if(extraItem.name_in_arabic){
						let tempArName = extraItem.name_in_arabic.trim().toLowerCase();
						let param 	   = "name_in_arabic_"+extraItem.index;
						if(duplicateNames.ar[tempArName]){
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.whoops_you_have_entered_an_already_used_name_in_arabic")});
						}else{
							duplicateNames.ar[tempArName] = true;
						}
					}
					/** Push data in array if not error */
					if(errors.length == 0){
						/**Get item id */
						const items = this.db.collection(Tables.ITEMS);
						items.findOne({item_id : extraItem.item_id},{projection: { _id: 1}}).then(itemResult=>{

							/** Push error when item id is not valid  */
							if(!itemResult) errors.push({'param':"item_id_"+extraItem.index,'msg':res.__("admin.merchant_upload.this_item_id_not_belongs_to_selected_reataurant")});

							if(errors.length == 0){
								let itemId = (itemResult && itemResult._id) ? itemResult._id : "";

								asyncParallel({
									name_details : (callback)=>{
										/** find extra items name in both language if already exists **/
										item_extra_masters.findOne({
											item_id : new ObjectId(itemId),
											$or : [
												{ "name.en" : {$regex : '^'+cleanRegex(extraItem.name_in_english)+'$',$options : 'i'}},
												{ "name.ar" : {$regex : '^'+cleanRegex(extraItem.name_in_arabic)+'$',$options : 'i'}}
											],
										},{projection: { _id: 1,name:1}}).then(nameResult=>{
											callback(null,nameResult);
										}).catch(next);
									},
									tmp_name_details : (callback)=>{
										/** find tmp extra items name in both language if already exists **/
										const tmp_item_extra_masters = this.db.collection(Tables.TMP_ITEM_EXTRA_MASTERS);
										tmp_item_extra_masters.findOne({
											item_id : new ObjectId(itemId),
											$or : [
												{ "name.en" : {$regex : '^'+cleanRegex(extraItem.name_in_english)+'$',$options : 'i'}},
												{ "name.ar" : {$regex : '^'+cleanRegex(extraItem.name_in_arabic)+'$',$options : 'i'}}
											],
										},{projection: { _id: 1,name:1}}).then(tmpResult=>{
											callback(null,tmpResult);
										}).catch(next);
									},
									is_valid_item_unit_id : (callback)=>{
										/** Check enter item unit id is valid or not */
										const item_units = this.db.collection(Tables.ITEM_UNITS);
										item_units.distinct( "item_unit_id",{item_id : new ObjectId(itemId)}).then(itemUnitResult=>{

											const item_units_masters = this.db.collection(Tables.ITEM_UNITS_MASTERS);
											item_units_masters.findOne({_id : {$in : itemUnitResult },item_unit_id : extraItem.item_unit_id,restaurant_slug:restaurantSlug},{projection: { _id: 1}}).then(itemUnitsMastersResult=>{
												callback(null,itemUnitsMastersResult);
											}).catch(next);
										}).catch(next);
									}
								},(parallelErr,response)=> {
									if(parallelErr) return eachCallback(parallelErr);

									/**Check names is unique */
									let extraItemsName    = (response.name_details && response.name_details.name)  				   ? response.name_details.name 		:"";
									let tmpExtraItemsName = (response.tmp_name_details && response.tmp_name_details.name)  		   ? response.tmp_name_details.name	    :"";
									let itemUnitId 		  = (response.is_valid_item_unit_id && response.is_valid_item_unit_id._id) ? response.is_valid_item_unit_id._id :"";

									if(extraItemsName || tmpExtraItemsName){
										if((extraItemsName.en && extraItemsName.en.toLowerCase() == extraItem.name_in_english.toLowerCase()) || (tmpExtraItemsName.en && tmpExtraItemsName.en.toLowerCase() == extraItem.name_in_english.toLowerCase())){
											if (!errors) errors = [];
											errors.push({'param':'name_in_english_'+extraItem.index,'msg':res.__("admin.merchant_upload.whoops_you_have_entered_an_already_used_name_in_english")});
										}
										if((extraItemsName.ar && extraItemsName.ar.toLowerCase() == extraItem.name_in_arabic.toLowerCase()) || (tmpExtraItemsName.ar && tmpExtraItemsName.ar.toLowerCase() == extraItem.name_in_arabic.toLowerCase())){
											if (!errors) errors = [];
											errors.push({'param':"name_in_arabic_"+extraItem.index,'msg':res.__("admin.merchant_upload.whoops_you_have_entered_an_already_used_name_in_arabic")});
										}
									}

									/** Push error when item unit id is not valid  */
									if(!itemUnitId && extraItem.item_unit_id) errors.push({'param':"item_unit_id_"+extraItem.index,'msg':res.__("admin.merchant_upload.this_item_unit_id_not_belongs_to_selected_restaurant")});

									/** Push data in array */
									if(errors.length == 0){
										let tempData = {
											name : {
												ar : extraItem.name_in_arabic,
												en : extraItem.name_in_english
											},
											extra_fees  	: parseFloat(extraItem.extra_fees),
											restaurant_id 	: new ObjectId(restaurantId),
											item_unit_id 	: itemUnitId ? new ObjectId(itemUnitId) : "",
											item_id 	  	: new ObjectId(itemId),
											created  	 	: getUtcDate(),
											modified   		: getUtcDate(),
											is_active		: Constants.ACTIVE,
											extra_items_old_id : extraItem.extra_items_old_id
										};
										dataToBeSaved.push(tempData);
										dataToBeExport.push([
											extraItem.extra_items_old_id,
											extraItem.item_id,
											extraItem.item_unit_id,
											extraItem.name_in_english,
											extraItem.name_in_arabic,
											extraItem.extra_fees,
										]);
									}
									eachCallback(null);
								});
							} else{
								eachCallback(null);
							}
						});
					}else{
						eachCallback(null);
					}
				}else{
					eachCallback(null);
				}
			},(asyncErr)=>{
				if(asyncErr) return next(asyncErr);

				/** Send error response **/
				if(errors.length > 0) return res.send({ status	: Constants.STATUS_ERROR, message	: errors});

				/** Send error response **/
				if(dataToBeSaved.length < 1) return res.send({status : Constants.STATUS_ERROR,message : [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg':res.__("admin.system.something_going_wrong_please_try_again")}]});

				/** Save data */
				item_extra_masters.insertMany(dataToBeSaved,{forceServerObjectId:true}).then(()=>{

					/** Save export data */
					let headings  = [
						res.__("admin.merchant_upload.extra_items_old_id"),
						res.__("admin.merchant_upload.item_id"),
						res.__("admin.merchant_upload.item_unit_id"),
						res.__("admin.merchant_upload.name_in_english"),
						res.__("admin.merchant_upload.name_in_arabic"),
						res.__("admin.merchant_upload.extra_fees")
					];
						const tmp_imports	= 	this.db.collection(Tables.TMP_IMPORTS);
					tmp_imports.insertOne({
						upload_action : Constants.MERCHANT_UPLOAD_ITEM_EXTRA_ITEMS,
						headings 	  : headings,
						data 	 	  : dataToBeExport,
					}).then(exportResult=>{

						/** Send success response  */
						let exportId = exportResult?.insertedId || "";
						res.send({
							status 		:Constants.STATUS_SUCCESS,
							message 	:res.__("admin.merchant_upload.extra_items_has_been_added_successfully"),
							redirect_url:Constants.WEBSITE_ADMIN_URL+"merchant_upload/export_data/"+exportId,
						});
					}).catch(next);
				}).catch(next);
			});
		}else{
			/** Render add item extra items page  **/
			res.render('add_item_extra_items',{
				layout	: false
			});
		}
	}//End addItemExtraItems()

	/**
	 * Function for add Item
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async addItems(req,res,next){

		if(isPost(req)){
			req.body		    = sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let items	        = (req.body.item) 			? req.body.item 	   	   :[];
			let restaurantSlug	= (req.body.restaurant_slug)? req.body.restaurant_slug :"";

			/** Send error response **/
			if(items.length < 1) return res.send({status : Constants.STATUS_ERROR,message : [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg':res.__("admin.system.something_going_wrong_please_try_again")}]});

			/** Send error response  */
			if(!restaurantSlug) return res.send({status: Constants.STATUS_ERROR,message: [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg': res.__("admin.merchant_upload.please_select_restaurant")}]});

			/**Get restaurant id */
			let restaurantId = "";
			if(restaurantSlug) restaurantId = await getRestaurantId(req,res,next,{slug : restaurantSlug});

			const item_units_masters = this.db.collection(Tables.ITEM_UNITS_MASTERS);
			item_units_masters.find({restaurant_slug: restaurantSlug},{projection: { _id: 1,item_unit_id:1}}).toArray().then(itemUnitsMastersResult=>{

				let itemUnitsObject = {};

				itemUnitsMastersResult.map(records=>{
					itemUnitsObject[records.item_unit_id] = new ObjectId(records._id);
				});

				/**Check errors and if no error set array to save data */
				const itemsCollection = this.db.collection(Tables.ITEMS);
				let errors			  = [];
				let dataToBeSaved 	  = [];
				let duplicateNames 	  = {en : {},ar:{}};
				let dataToBeExport	  = [];
				asyncEach(items, (item, eachCallback) => {
					if(!item) return eachCallback(null);

					/** Send error if item old id is blank */
					if(!item.item_old_id || item.item_old_id == "" ){
						let param = "item_old_id_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_item_old_id")});
					}
					/** Send error if menu id is not valid */
					if(item.menu && isNaN(item.menu)){
						let param = "menu_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_menu_id")});
					}
					/** Send error if category id is not valid */
					if(item.category && isNaN(item.category)){
						let param = "category_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_category_id")});
					}
					/** Send error if name in english is blank */
					if(!item.name_in_english || item.name_in_english == ""){
						let param = "name_in_english_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_name_in_english")});
					}
					/** Send error if name in arabic is blank */
					if(!item.name_in_arabic || item.name_in_arabic == ""){
						let param = "name_in_arabic_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_name_in_arabic")});
					}
					/** Send error if image is blank */
					if(!item.image || item.image == "" ){
						let param = "image_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_image_name")});
					}

					/** Send error if image is not valid */
					if(item.image){
						let imageExtension = item.image.split('.').pop().toLowerCase();
						if(Constants.ALLOWED_IMAGE_EXTENSIONS.indexOf(imageExtension) == -1){
							let param = "image_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.image_name_should_be_in_png_jpg_jpeg_format")});
						}
					}
					/** Send error if description in english is blank */
					if(!item.description_in_english || item.description_in_english == ""){
						let param = "description_in_english_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_description_in_english")});
					}
					/** Send error if description in arabic is blank */
					if(!item.description_in_arabic || item.description_in_arabic == ""){
						let param = "description_in_arabic_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_description_in_arabic")});
					}
					/** Send error if price on selection is blank and item price is blank also*/
					if(!item.price_on_selection && item.item_price == ""){
						let param = "item_price_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_price")});
					}
					/** Send error if item price is not valid */
					if(!item.non_sellable && item.item_price && (isNaN(item.item_price) || item.item_price <= 0)){
						let param = "item_price_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_price")});
					}else if(item.non_sellable && item.item_price && (isNaN(item.item_price) || item.item_price < 0)){
						let param = "item_price_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_price")});
					}
					/** Send error if non sellable is not valid */
					if(item.non_sellable && item.non_sellable != Constants.NON_SELLABLE){
						let param = "non_sellable_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_non_sellable_items")});
					}
					/** Send error if price on selection is not valid */
					if(item.price_on_selection && item.price_on_selection != Constants.PRICE_ON_SELECTION){
						let param = "price_on_selection_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_price_on_selection")});
					}
					/** Send error if discount percentage is not valid */
					if(item.discount_percentage && (isNaN(item.discount_percentage) || item.discount_percentage <= 0 || item.discount_percentage > Constants.MAX_PERCENTAGE)){
						let param = "discount_percentage_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_discount_percentage")});
					}
					/** Send error if discount by value is not valid */
					if(item.discount_by_value && (isNaN(item.discount_by_value) || item.discount_by_value <= 0)){
						let param = "discount_by_value_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_discount_by_value")});
					}

					/** Send error for availability details */
					let availabilityStatus = Constants.NOT_AVAILABLE;
					if(item.from_time_one || item.to_time_one ){
						availabilityStatus = Constants.AVAILABLE;

						/** Send error if to time is less than from time */
						if(item.to_time_one <= item.from_time_one) {
							let param = "to_time_one_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.to_time_greater_than_from_time")});
						}
						/** Send error if from time is not valid */
						if(isNaN(item.from_time_one) || item.from_time_one > Constants.MERCHANT_UPLOADS_MENU_TIME_LIMIT) {
							let param = "from_time_one_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_from_time")});
						}
						/** Send error if to time is not valid */
						if(isNaN(item.to_time_one) || item.to_time_one > Constants.MERCHANT_UPLOADS_MENU_TIME_LIMIT) {
							let param = "to_time_one_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_to_time")});
						}
						/** Send error if from time is not blank and to time is blank */
						if(item.from_time_one && !item.to_time_one) {
							let param = "to_time_one_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_to_time")});
						}
					}
					if(item.from_time_two || item.to_time_two ){
						availabilityStatus = Constants.AVAILABLE;

						/** Send error if to time is less than from time */
						if(item.to_time_two <= item.from_time_two) {
							let param = "to_time_two_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.to_time_greater_than_from_time")});
						}
						/** Send error if from time is not valid */
						if(isNaN(item.from_time_two) || item.from_time_two > Constants.MERCHANT_UPLOADS_MENU_TIME_LIMIT) {
							let param = "from_time_two_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_from_time")});
						}
						/** Send error if to time is not valid */
						if(isNaN(item.to_time_two) || item.to_time_two > Constants.MERCHANT_UPLOADS_MENU_TIME_LIMIT) {
							let param = "to_time_two_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_to_time")});
						}
						/** Send error if from time is not blank and to time is blank */
						if(item.from_time_two && !item.to_time_two) {
							let param = "to_time_two_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_to_time")});
						}
					}
					if(item.from_time_three || item.to_time_three ){
						availabilityStatus = Constants.AVAILABLE;

						/** Send error if to time is less than from time */
						if(item.to_time_three <= item.from_time_three) {
							let param = "to_time_three_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.to_time_greater_than_from_time")});
						}
						/** Send error if from time is not valid */
						if(isNaN(item.from_time_three) || item.from_time_three > Constants.MERCHANT_UPLOADS_MENU_TIME_LIMIT) {
							let param = "from_time_three_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_from_time")});
						}
						/** Send error if to time is not valid */
						if(isNaN(item.to_time_three) || item.to_time_three > Constants.MERCHANT_UPLOADS_MENU_TIME_LIMIT) {
							let param = "to_time_three_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_to_time")});
						}
						/** Send error if from time is not blank and to time is blank */
						if(item.from_time_three && !item.to_time_three) {
							let param = "to_time_three_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_to_time")});
						}
					}
					if(item.from_time_four || item.to_time_four ){
						availabilityStatus = Constants.AVAILABLE;

						/** Send error if to time is less than from time */
						if(item.to_time_four <= item.from_time_four) {
							let param = "to_time_four_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.to_time_greater_than_from_time")});
						}
						/** Send error if from time is not valid */
						if(isNaN(item.from_time_four) || item.from_time_four > Constants.MERCHANT_UPLOADS_MENU_TIME_LIMIT) {
							let param = "from_time_four_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_from_time")});
						}
						/** Send error if to time is not valid */
						if(isNaN(item.to_time_four) || item.to_time_four > Constants.MERCHANT_UPLOADS_MENU_TIME_LIMIT) {
							let param = "to_time_four_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_to_time")});
						}
						/** Send error if from time is not blank and to time is blank */
						if(item.from_time_four && !item.to_time_four) {
							let param = "to_time_four_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_to_time")});
						}
					}
					if(item.from_time_five || item.to_time_five ){
						availabilityStatus = Constants.AVAILABLE;

						/** Send error if to time is less than from time */
						if(item.to_time_five <= item.from_time_five) {
							let param = "from_time_five_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.to_time_greater_than_from_time")});
						}
						/** Send error if from time is not valid */
						if(isNaN(item.from_time_five) || item.from_time_five > Constants.MERCHANT_UPLOADS_MENU_TIME_LIMIT) {
							let param = "from_time_five_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_from_time")});
						}
						/** Send error if to time is not valid */
						if(isNaN(item.to_time_five) || item.to_time_five > Constants.MERCHANT_UPLOADS_MENU_TIME_LIMIT) {
							let param = "to_time_five_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_to_time")});
						}
						/** Send error if from time is not blank and to time is blank */
						if(item.from_time_five && !item.to_time_five) {
							let param = "to_time_five_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_to_time")});
						}
					}

					/** Send error for item unit details one */
					if(item.item_unit_id_one || item.price_one || item.discount_type_one || item.discount_value_one){
						/** Send error if price is blank */
						if(item.item_unit_id_one && !item.price_one){
							let param = "price_one_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_price")});
						}
						/** Send error if discount type or discount value is filled and item unit id is blank */
						if(!item.item_unit_id_one){
							let param = "item_unit_id_one_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_item_unit_id")});
						}
					}
					/** Send error if item unit id is not valid */
					if(item.item_unit_id_one && isNaN(item.item_unit_id_one)){
						let param = "item_unit_id_one_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_item_unit_id")});
					}
					/** Send error if price is not valid */
					if(item.item_unit_id_one && item.price_one && (isNaN(item.price_one) || item.price_one <= 0)){
						let param = "price_one_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_price")});
					}
					/** Send error if status is not valid */
					if(item.status_one && item.status_one != Constants.ACTIVE){
						let param = "status_one_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_status")});
					}
					/** Send error if sorting is not valid */
					if(item.sorting_one && (isNaN(item.sorting_one) || item.sorting_one <=0)){
						let param = "sorting_one_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_valid_sorting") });
					}
					/** Send error if discount value is not valid */
					if(item.discount_value_one && (isNaN(item.discount_value_one) || item.discount_value_one <=0)){
						let param = "discount_value_one_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_valid_discount_value") });
					} else if(item.discount_type_one == Constants.DISCOUNT_BY_PERCENTAGE && item.discount_value_one > Constants.MAX_PERCENTAGE){
						let param = "discount_value_one_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_valid_discount_value") });
					}

					/** Send error for item unit details two */

					if(item.item_unit_id_two || item.price_two || item.discount_type_two || item.discount_value_two){
						/** Send error if price is blank */
						if(item.item_unit_id_two && !item.price_two){
							let param = "price_two_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_price")});
						}
						/** Send error if discount type or discount value is filled and item unit id is blank */
						if(!item.item_unit_id_two){
							let param = "item_unit_id_two_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_item_unit_id")});
						}
					}
					/** Send error if item unit id is not valid */
					if(item.item_unit_id_two && isNaN(item.item_unit_id_two)){
						let param = "item_unit_id_two_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_item_unit_id")});
					}
					/** Send error if price is not valid */
					if(item.item_unit_id_two && item.price_two && (isNaN(item.price_two) || item.price_two <= 0)){
						let param = "price_two_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_price")});
					}
					/** Send error if status is not valid */
					if(item.status_two && item.status_two != Constants.ACTIVE){
						let param = "status_two_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_status")});
					}
					/** Send error if sorting is not valid */
					if(item.sorting_two && (isNaN(item.sorting_two) || item.sorting_two <=0)){
						let param = "sorting_two_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_valid_sorting") });
					}
					/** Send error if discount value is not valid */
					if(item.discount_value_two && (isNaN(item.discount_value_two) || item.discount_value_two <=0)){
						let param = "discount_value_two_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_valid_discount_value") });
					} else if(item.discount_type_two == Constants.DISCOUNT_BY_PERCENTAGE && item.discount_value_two > Constants.MAX_PERCENTAGE){
						let param = "discount_value_two_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_valid_discount_value") });
					}

					/** Send error for item unit details three */

					if(item.item_unit_id_three || item.price_three || item.discount_type_three || item.discount_value_three){
						/** Send error if price is blank */
						if(item.item_unit_id_three && !item.price_three){
							let param = "price_three_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_price")});
						}
						/** Send error if discount type or discount value is filled and item unit id is blank */
						if(!item.item_unit_id_three){
							let param = "item_unit_id_three_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_item_unit_id")});
						}
					}
					/** Send error if item unit id is not valid */
					if(item.item_unit_id_three && isNaN(item.item_unit_id_three)){
						let param = "item_unit_id_three_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_item_unit_id")});
					}
					/** Send error if price is not valid */
					if(item.item_unit_id_three && item.price_three && (isNaN(item.price_three) || item.price_three <= 0)){
						let param = "price_three_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_price")});
					}
					/** Send error if status is not valid */
					if(item.status_three && item.status_three != Constants.ACTIVE){
						let param = "status_three_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_status")});
					}
					/** Send error if sorting is not valid */
					if(item.sorting_three && (isNaN(item.sorting_three) || item.sorting_three <=0)){
						let param = "sorting_three_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_valid_sorting") });
					}
					/** Send error if discount value is not valid */
					if(item.discount_value_three && (isNaN(item.discount_value_three) || item.discount_value_three <=0)){
						let param = "discount_value_three_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_valid_discount_value") });
					} else if(item.discount_type_three == Constants.DISCOUNT_BY_PERCENTAGE && item.discount_value_three > Constants.	MAX_PERCENTAGE){
						let param = "discount_value_three_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_valid_discount_value") });
					}

					/** Send error for item unit details four */

					if(item.item_unit_id_four || item.price_four || item.discount_type_four || item.discount_value_four){
						/** Send error if price is blank */
						if(item.item_unit_id_four && !item.price_four){
							let param = "price_four_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_price")});
						}
						/** Send error if discount type or discount value is filled and item unit id is blank */
						if(!item.item_unit_id_four){
							let param = "item_unit_id_four_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_item_unit_id")});
						}
					}
					/** Send error if item unit id is not valid */
					if(item.item_unit_id_four && isNaN(item.item_unit_id_four)){
						let param = "item_unit_id_four_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_item_unit_id")});
					}
					/** Send error if price is not valid */
					if(item.item_unit_id_four && item.price_four && (isNaN(item.price_four) || item.price_four <= 0)){
						let param = "price_four_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_price")});
					}
					/** Send error if status is not valid */
					if(item.status_four && item.status_four != Constants.ACTIVE){
						let param = "status_four_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_status")});
					}
					/** Send error if sorting is not valid */
					if(item.sorting_four && (isNaN(item.sorting_four) || item.sorting_four <=0)){
						let param = "sorting_four_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_valid_sorting") });
					}
					/** Send error if discount value is not valid */
					if(item.discount_value_four && (isNaN(item.discount_value_four) || item.discount_value_four <=0)){
						let param = "discount_value_four_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_valid_discount_value") });
					} else if(item.discount_type_four == Constants.DISCOUNT_BY_PERCENTAGE && item.discount_value_four > Constants.MAX_PERCENTAGE){
						let param = "discount_value_four_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_valid_discount_value") });
					}

					/** Send error for item unit details five */

					if(item.item_unit_id_four || item.price_four || item.discount_type_four || item.discount_value_four){
						/** Send error if price is blank */
						if(item.item_unit_id_five && !item.price_five){
							let param = "price_five_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_price")});
						}
						/** Send error if discount type or discount value is filled and item unit id is blank */
						if(!item.item_unit_id_five){
							let param = "item_unit_id_five_"+item.index;
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_item_unit_id")});
						}
					}
					/** Send error if item unit id is not valid */
					if(item.item_unit_id_five && isNaN(item.item_unit_id_five)){
						let param = "item_unit_id_five_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_item_unit_id")});
					}
					/** Send error if price is not valid */
					if(item.item_unit_id_five && item.price_five && (isNaN(item.price_five) || item.price_five <= 0)){
						let param = "price_five_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_price")});
					}
					/** Send error if status is not valid */
					if(item.status_five && item.status_five != Constants.ACTIVE){
						let param = "status_five_"+item.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_status")});
					}
					/** Send error if sorting is not valid */
					if(item.sorting_five && (isNaN(item.sorting_five) || item.sorting_five <= 0)){
						let param = "sorting_five_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_valid_sorting") });
					}
					/** Send error if discount value is not valid */
					if(item.discount_value_five && (isNaN(item.discount_value_five) || item.discount_value_five <=0)){
						let param = "discount_value_five_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_valid_discount_value") });
					} else if(item.discount_type_five == Constants.DISCOUNT_BY_PERCENTAGE && item.discount_value_five > Constants.		MAX_PERCENTAGE){
						let param = "discount_value_five_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_valid_discount_value") });
					}

					/** Check duplicate entry in form for name */
					if(item.name_in_english){
						let tempEnName  = item.name_in_english.trim().toLowerCase();
						let param 		= "name_in_english_"+item.index;
						if(duplicateNames.en[tempEnName]){
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.whoops_you_have_entered_an_already_used_name_in_english")});
						}else{
							duplicateNames.en[tempEnName] = true;
						}
					}
					if(item.name_in_arabic){
						let tempArName = item.name_in_arabic.trim().toLowerCase();
						let param 	   = "name_in_arabic_"+item.index;
						if(duplicateNames.ar[tempArName]){
							errors.push({'param':param,'msg':res.__("admin.merchant_upload.whoops_you_have_entered_an_already_used_name_in_arabic")});
						}else{
							duplicateNames.ar[tempArName] = true;
						}
					}

					/** Check duplicate entry in form for item unit id */
					if(item.item_unit_id_one && item.item_unit_id_two && item.item_unit_id_two == item.item_unit_id_one ){
						let param = "item_unit_id_two_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_another_item_unit") });
					}
					if(item.item_unit_id_one && item.item_unit_id_three && item.item_unit_id_three == item.item_unit_id_one ){
						let param = "item_unit_id_three_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_another_item_unit") });
					}
					if(item.item_unit_id_one && item.item_unit_id_four && item.item_unit_id_four == item.item_unit_id_one ){
						let param = "item_unit_id_four_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_another_item_unit") });
					}
					if(item.item_unit_id_one && item.item_unit_id_five && item.item_unit_id_five == item.item_unit_id_one ){
						let param = "item_unit_id_five_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_another_item_unit") });
					}
					if(item.item_unit_id_two && item.item_unit_id_three && item.item_unit_id_three == item.item_unit_id_two ){
						let param = "item_unit_id_three_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_another_item_unit") });
					}
					if(item.item_unit_id_two && item.item_unit_id_four && item.item_unit_id_four == item.item_unit_id_two ){
						let param = "item_unit_id_four_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_another_item_unit") });
					}
					if(item.item_unit_id_two && item.item_unit_id_five && item.item_unit_id_five == item.item_unit_id_two ){
						let param = "item_unit_id_five_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_another_item_unit") });
					}
					if(item.item_unit_id_three && item.item_unit_id_four && item.item_unit_id_four == item.item_unit_id_three ){
						let param = "item_unit_id_four_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_another_item_unit") });
					}
					if(item.item_unit_id_three && item.item_unit_id_five && item.item_unit_id_five == item.item_unit_id_three ){
						let param = "item_unit_id_five_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_another_item_unit") });
					}
					if(item.item_unit_id_four && item.item_unit_id_five && item.item_unit_id_five == item.item_unit_id_four ){
						let param = "item_unit_id_five_"+item.index;
						errors.push({ 'param': param, 'msg': res.__("admin.merchant_upload.please_enter_another_item_unit") });
					}

					/** Push data in array if not error */
					if(errors.length == 0){

						/** Push menu id and category id and item unit id in array */
						let menuIds 	= item.menu 	? item.menu 	: [];
						let categoryIds = item.category ? item.category : [];
						let menuIdArray 	= [];
						let categoryIdArray = [];
						let itemUnitIds 	= [];
						if(menuIds.length > 0) 	   menuIdArray     = menuIds.split(",");
						if(categoryIds.length > 0) categoryIdArray = categoryIds.split(",");

						if(item.item_unit_id_one || item.item_unit_id_two ||  item.item_unit_id_three || item.item_unit_id_four || item.item_unit_id_five) {
							itemUnitIds.push(item.item_unit_id_one);
							itemUnitIds.push(item.item_unit_id_two);
							itemUnitIds.push(item.item_unit_id_three);
							itemUnitIds.push(item.item_unit_id_four);
							itemUnitIds.push(item.item_unit_id_five);
						}

						asyncParallel({
							name_details : (callback)=>{
								/** find items name in both language if already exists **/
								itemsCollection.findOne({
									restaurant_slug: restaurantSlug,
									$or : [
										{ "name.en" : {$regex : '^'+cleanRegex(item.name_in_english)+'$',$options : 'i'}},
										{ "name.ar" : {$regex : '^'+cleanRegex(item.name_in_arabic)+'$',$options : 'i'}}
									],
								},{projection: { _id: 1,name:1}}).then(nameResult=>{
									callback(null,nameResult);
								}).catch(next);
							},
							tmp_name_details : (callback)=>{
								/** find tmp items name in both language if already exists **/
								const tmp_items = this.db.collection(Tables.TMP_ITEMS);
								tmp_items.findOne({
									$or : [
										{ "name.en" : {$regex : '^'+cleanRegex(item.name_in_english)+'$',$options : 'i'}},
										{ "name.ar" : {$regex : '^'+cleanRegex(item.name_in_arabic)+'$',$options : 'i'}}
									],
									restaurant_slug: restaurantSlug
								},{projection: { _id: 1,name:1}}).then(tmpResult=>{
									callback(null, tmpResult);
								}).catch(next);
							},
							is_valid_menu_ids : (callback)=>{
								/** Check enter menu ids is valid or not */
								const restaurant_menus = this.db.collection(Tables.RESTAURANT_MENUS);
								restaurant_menus.find({restaurant_slug: restaurantSlug,menu_id: {$in : menuIdArray}},{projection: { _id: 1}}).toArray().then(menuResult=>{
									callback(null, menuResult);
								}).catch(next);
							},
							is_valid_category_ids : (callback)=>{
								/** Check enter category ids is valid or not */
								const restaurant_categories = this.db.collection(Tables.RESTAURANT_CATEGORIES);
								restaurant_categories.find({restaurant_slug: restaurantSlug,category_id: {$in : categoryIdArray}},{projection: { _id: 1}}).toArray().then(categoryResult=>{
									callback(null, categoryResult);
								}).catch(next);
							},
							item_unique_id : (callback)=>{
								/** get item unqiue id **/
								getUniqueId(req,res,next,{type:"item"}).then(uniqueIdResponse=>{
									callback(null,uniqueIdResponse);
								}).catch(next);
							},
						},(parallelErr,response)=> {
							if(parallelErr) return eachCallback(parallelErr);

							let itemsName    = (response.name_details && response.name_details.name)  		 ? response.name_details.name 	  :"";
							let tmpItemsName = (response.tmp_name_details && response.tmp_name_details.name) ? response.tmp_name_details.name :"";
							let validMenuId     = (response.is_valid_menu_ids) 	    ? response.is_valid_menu_ids 	  : [];
							let validCategoryId = (response.is_valid_category_ids)  ? response.is_valid_category_ids  : [];
							let itemUniqueId 	= (response.item_unique_id && response.item_unique_id.result)  ? response.item_unique_id.result  : "";

							/**Check names is unique */
							if(itemsName || tmpItemsName){
								if((itemsName.en && itemsName.en.toLowerCase() == item.name_in_english.toLowerCase()) || (tmpItemsName.en && tmpItemsName.en.toLowerCase() == item.name_in_english.toLowerCase())){
									if (!errors) errors = [];
									errors.push({'param':'name_in_english_'+item.index,'msg':res.__("admin.merchant_upload.whoops_you_have_entered_an_already_used_name_in_english")});
								}
								if((itemsName.ar && itemsName.ar.toLowerCase() == item.name_in_arabic.toLowerCase()) || (tmpItemsName.ar && tmpItemsName.ar.toLowerCase() == item.name_in_arabic.toLowerCase())){
									if (!errors) errors = [];
									errors.push({'param':"name_in_arabic_"+item.index,'msg':res.__("admin.merchant_upload.whoops_you_have_entered_an_already_used_name_in_arabic")});
								}
							}

							/** Push error when item unit id is not valid  */
							if(item.item_unit_id_one && !itemUnitsObject[item.item_unit_id_one]) errors.push({'param':"item_unit_id_one_"+item.index,'msg':res.__("admin.merchant_upload.this_item_unit_id_not_belongs_to_selected_restaurant")});
							if(item.item_unit_id_two && !itemUnitsObject[item.item_unit_id_two]) errors.push({'param':"item_unit_id_two_"+item.index,'msg':res.__("admin.merchant_upload.this_item_unit_id_not_belongs_to_selected_restaurant")});
							if(item.item_unit_id_three && !itemUnitsObject[item.item_unit_id_three]) errors.push({'param':"item_unit_id_three_"+item.index,'msg':res.__("admin.merchant_upload.this_item_unit_id_not_belongs_to_selected_restaurant")});
							if(item.item_unit_id_four && !itemUnitsObject[item.item_unit_id_four]) errors.push({'param':"item_unit_id_four_"+item.index,'msg':res.__("admin.merchant_upload.this_item_unit_id_not_belongs_to_selected_restaurant")});
							if(item.item_unit_id_five && !itemUnitsObject[item.item_unit_id_five]) errors.push({'param':"item_unit_id_five_"+item.index,'msg':res.__("admin.merchant_upload.this_item_unit_id_not_belongs_to_selected_restaurant")});

							/** Push error when menu ids is not valid  */
							if(validMenuId.length !== menuIdArray.length) errors.push({'param':"menu_"+item.index,'msg':res.__("admin.merchant_upload.this_menu_not_belongs_to_selected_restaurant")});

							/** Push error when category ids is not valid  */
							if(validCategoryId.length !== categoryIdArray.length ) errors.push({'param':"category_"+item.index,'msg':res.__("admin.merchant_upload.this_category_not_belongs_to_selected_restaurant")});

							/** Push valid menu object id and categroy object id in array */
							let insertMenuId 	 = [];
							let insertCategoryId = [];
							validMenuId.map(records=>{
								insertMenuId.push(records._id);
							});
							validCategoryId.map(records=>{
								insertCategoryId.push(records._id);
							});

							/** Push data in array */
							if(errors.length == 0){

								let fromTime = (item.from_time_one) ? parseFloat(item.from_time_one.replace(':','.')) :"";
								let toTime   = (item.to_time_one)   ? parseFloat(item.to_time_one.replace(':','.'))	  :"";

								/** If from time and to time is blank */
								if(!availabilityStatus){
									fromTime =	parseFloat(Constants.DAY_INITIAL_START_TIME.replace(':','.'));
									toTime	 =	parseFloat(Constants.DAY_INITIAL_END_TIME.replace(':','.'));
								}

								let tempData = {

									item_details:{
										name : {
											ar : item?.name_in_arabic || "",
											en : item?.name_in_english || ""
										},
										description : {
											ar : item?.description_in_arabic || "",
											en : item?.description_in_english || ""
										},
										menu_ids 	 		:	arrayToObject(insertMenuId),
										category_ids 		: 	arrayToObject(insertCategoryId),
										discount_value 		: 	(item?.discount_by_value)  	? 	item.discount_by_value 				:0,
										discount_percentage : 	item?.discount_percentage  	? 	parseFloat(item.discount_percentage):0,
										price_on_selection 	: 	(item?.price_on_selection) 	?	parseInt(item.price_on_selection)	:0,
										non_sellable 		: 	(item?.non_sellable) 	  	?	parseInt(item.non_sellable) 		:0,
										availability_status : 	availabilityStatus,
										item_price			:	(!item?.price_on_selection) ? parseFloat(item.item_price)		:0,
										restaurant_id		: 	restaurantId,
										restaurant_slug		: 	restaurantSlug,
										item_id				: 	itemUniqueId,
										added_by			: 	new ObjectId(req.session.user._id),
										is_active			: 	Constants.ACTIVE,
										image				:	item.image,
										created 			: 	getUtcDate(),
										modified   			: 	getUtcDate(),
										item_old_id         :   item.item_old_id
									},
									availability_details:[{
										from_time 	:	fromTime,
										to_time		: 	toTime,
										comment		: 	item.comment_one ? item.comment_one : "",
										modified   	:	getUtcDate(),
										created 	: 	getUtcDate(),
									}],
									item_unit_details:[]
								};

								/** Push data if from time and to time is not blank */
								if(item.from_time_two && item.to_time_two ) {
									tempData.availability_details.push({
										from_time 	:	parseFloat(item.from_time_two.replace(':','.')),
										to_time		: 	parseFloat(item.to_time_two.replace(':','.')),
										comment		: 	item.comment_two ? item.comment_two : "",
										modified   	:	getUtcDate(),
										created 	: 	getUtcDate()
									});
								}
								/** Push data if from time and to time is not blank */
								if(item.from_time_three && item.to_time_three ) {
									tempData.availability_details.push({
										from_time 	:	parseFloat(item.from_time_three.replace(':','.')),
										to_time		: 	parseFloat(item.to_time_three.replace(':','.')),
										comment		: 	item.comment_three ? item.comment_three : "",
										modified   	:	getUtcDate(),
										created 	: 	getUtcDate()
									});
								}
								/** Push data if from time and to time is not blank */
								if(item.from_time_four && item.to_time_four ) {
									tempData.availability_details.push({
										from_time 	:	parseFloat(item.from_time_four.replace(':','.')),
										to_time		: 	parseFloat(item.to_time_four.replace(':','.')),
										comment		: 	item.comment_four ? item.comment_four : "",
										modified   	:	getUtcDate(),
										created 	: 	getUtcDate()
									});
								}
								/** Push data if from time and to time is not blank */
								if(item.from_time_five && item.to_time_five ) {
									tempData.availability_details.push({
										from_time 	:	parseFloat(item.from_time_five.replace(':','.')),
										to_time		: 	parseFloat(item.to_time_five.replace(':','.')),
										comment		: 	item.comment_five ? item.comment_five : "",
										modified   	:	getUtcDate(),
										created 	: 	getUtcDate()
									});
								}
								/** Push data if item unit id and price is not blank */
								if(item.item_unit_id_one && item.price_one && itemUnitsObject[item.item_unit_id_one]) {
									let itemUnitId = itemUnitsObject[item.item_unit_id_one];

									tempData.item_unit_details.push({
										item_unit_id	:	new ObjectId(itemUnitId),
										price			: 	parseFloat(item.price_one),
										discount_type	: 	item.discount_type_one  ? item.discount_type_one : 0,
										discount_value	: 	item.discount_value_one ? parseFloat(item.discount_value_one) : 0,
										status			: 	(item.status_one)	? parseInt(item.status_one)	 :Constants.DEACTIVE,
										sorting			: 	(item.sorting_one) 	? parseInt(item.sorting_one) :"",
										modified   		:	getUtcDate(),
										created 		: 	getUtcDate()
									});
								}
								/** Push data if item unit id and price is not blank */
								if(item.item_unit_id_two && item.price_two && itemUnitsObject[item.item_unit_id_two]) {
									let itemUnitId = itemUnitsObject[item.item_unit_id_two];

									tempData.item_unit_details.push({
										item_unit_id	:	new ObjectId(itemUnitId),
										price			: 	parseFloat(item.price_two),
										discount_type	: 	item.discount_type_two  ? item.discount_type_two : 0,
										discount_value	: 	item.discount_value_two ? parseFloat(item.discount_value_two) : 0,
										status			: 	(item.status_two)  ? parseInt(item.status_two)	:Constants.DEACTIVE,
										sorting			: 	(item.sorting_two) ? parseInt(item.sorting_two)	:"",
										modified   		:	getUtcDate(),
										created 		: 	getUtcDate()
									});
								}
								/** Push data if item unit id and price is not blank */
								if(item.item_unit_id_three && item.price_three && itemUnitsObject[item.item_unit_id_three]) {
									let itemUnitId = itemUnitsObject[item.item_unit_id_three];

									tempData.item_unit_details.push({
										item_unit_id	:	new ObjectId(itemUnitId),
										price			: 	parseFloat(item.price_three),
										discount_type	: 	item.discount_type_three ? item.discount_type_three : 0,
										discount_value	: 	item.discount_value_three ? parseFloat(item.discount_value_three) : 0,
										status			: 	(item.status_three)	 ? 	parseInt(item.status_three)	 :Constants.DEACTIVE,
										sorting			: 	(item.sorting_three) ?	parseInt(item.sorting_three) :"",
										modified   		:	getUtcDate(),
										created 		: 	getUtcDate()
									});
								}
								/** Push data if item unit id and price is not blank */
								if(item.item_unit_id_four && item.price_four && itemUnitsObject[item.item_unit_id_four]) {
									let itemUnitId = itemUnitsObject[item.item_unit_id_four];

									tempData.item_unit_details.push({
										item_unit_id	:	new ObjectId(itemUnitId),
										price			: 	parseFloat(item.price_four),
										discount_type	: 	item.discount_type_four  ? item.discount_type_four : 0,
										discount_value	: 	item.discount_value_four ? parseFloat(item.discount_value_four) : 0,
										status			: 	(item.status_four)	? parseInt(item.status_four)	:Constants.DEACTIVE,
										sorting			: 	(item.sorting_four) ? parseInt(item.sorting_four)	:"",
										modified   		:	getUtcDate(),
										created 		: 	getUtcDate()
									});
								}
								/** Push data if item unit id and price is not blank */
								if(item.item_unit_id_five && item.price_five && itemUnitsObject[item.item_unit_id_five]) {
									let itemUnitId = itemUnitsObject[item.item_unit_id_five];

									tempData.item_unit_details.push({
										item_unit_id	:	new ObjectId(itemUnitId),
										price			: 	parseFloat(item.price_five),
										discount_type	: 	item.discount_type_five  ? item.discount_type_five : 0,
										discount_value	: 	item.discount_value_five ? parseFloat(item.discount_value_five) : 0,
										status			: 	(item.status_five)	? 	parseInt(item.status_five)	:Constants.DEACTIVE,
										sorting			: 	(item.sorting_five) ?	parseInt(item.sorting_five)	:"",
										modified   		:	getUtcDate(),
										created 		: 	getUtcDate()
									});
								}
								dataToBeSaved.push(tempData);
								dataToBeExport.push([
									itemUniqueId,
									item.item_old_id,
									menuIds,
									categoryIds,
									item.name_in_english,
									item.name_in_arabic,
									item.description_in_english,
									item.description_in_arabic,
									item.image,
									item.non_sellable,
									item.price_on_selection,
									item.discount_by_value,
									item.discount_percentage,
									item.item_price,
									item.from_time_one,
									item.to_time_one,
									item.comment_one,
									item.from_time_two,
									item.to_time_two,
									item.comment_two,
									item.from_time_three,
									item.to_time_three,
									item.comment_three,
									item.from_time_four,
									item.to_time_four,
									item.comment_four,
									item.from_time_five,
									item.to_time_five,
									item.comment_five,
									item.status_one,
									item.sorting_one,
									item.item_unit_id_one,
									item.price_one,
									Constants.ITEM_DISCOUNT_TYPE?.[item.discount_type_one] || "",
									item.discount_value_one,
									item.status_two,
									item.sorting_two,
									item.item_unit_id_two,
									item.price_two,
									Constants.ITEM_DISCOUNT_TYPE?.[item.discount_type_two] || "",
									item.discount_value_two,
									item.status_three,
									item.sorting_three,
									item.item_unit_id_three,
									item.price_three,
									Constants.ITEM_DISCOUNT_TYPE?.[item.discount_type_three] || "",
									item.discount_value_three,
									item.status_four,
									item.sorting_four,
									item.item_unit_id_four,
									item.price_four,
									Constants.ITEM_DISCOUNT_TYPE?.[item.discount_type_four] || "",
									item.discount_value_four,
									item.status_five,
									item.sorting_five,
									item.item_unit_id_five,
									item.price_five,
									Constants.ITEM_DISCOUNT_TYPE?.[item.discount_type_five] || "",
									item.discount_value_five,
								]);
							}
							eachCallback(null);
						});
					}else{
						eachCallback(null);
					}
				},(asyncErr)=>{
					if(asyncErr) return next(asyncErr);

					/** Send error response **/
					if(errors.length > 0) return res.send({ status	: Constants.STATUS_ERROR, message	: errors});

					/** Send error response **/
					if(dataToBeSaved.length < 1) return res.send({status : Constants.STATUS_ERROR,message : [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg':res.__("admin.system.something_going_wrong_please_try_again")}]});

					const availabilityCollection = this.db.collection(Tables.ITEM_AVAILABILITY);
					const unitsCollection		 = this.db.collection(Tables.ITEM_UNITS);

					asyncEach(dataToBeSaved, (records, eachCallback) => {
						let itemDetails 	    = clone(records.item_details);
						let availabilityDetails = clone(records.availability_details);
						let itemUnitDetails 	= clone(records.item_unit_details);

						/** Save item details  */
						itemsCollection.insertOne(itemDetails).then(itemResult=>{
							let itemId 	= itemResult?.insertedId || "";

							asyncParallel({
								save_availability_details : (subCallback)=>{
									/** Insert item id in item availability details*/
									availabilityDetails = availabilityDetails.map(records=>{
										records.item_id = new ObjectId(itemId);
										return records;
									});
									/** Save item availability details  */
									availabilityCollection.insertMany(availabilityDetails,{forceServerObjectId:true}).then(availabilityResult=>{
										subCallback(null,availabilityResult);
									}).catch(next);
								},
								save_item_unit_details : (subCallback)=>{
									if(itemUnitDetails.length <= 0) return subCallback(null);

									/** Insert item id in item unit details*/
									itemUnitDetails = itemUnitDetails.map(records=>{
										records.item_id = new ObjectId(itemId);
										return records;
									});
									/** Save item unit details  */
									unitsCollection.insertMany(itemUnitDetails,{forceServerObjectId:true}).then(itemUnitResult=>{
										subCallback(null,itemUnitResult);
									}).catch(next);
								}
							},(parallelSubErr)=> {
								eachCallback(parallelSubErr);
							});
						}).catch(next);

					},(asyncEachErr)=>{
						if(asyncEachErr) return next(asyncEachErr);

						/** Save export data */
						let headings  = [
							res.__("admin.merchant_upload.item_id"),
							res.__("admin.merchant_upload.item_old_id"),
							res.__("admin.merchant_upload.menu"),
							res.__("admin.merchant_upload.category"),
							res.__("admin.merchant_upload.name_in_english"),
							res.__("admin.merchant_upload.name_in_arabic"),
							res.__("admin.merchant_upload.description_in_english"),
							res.__("admin.merchant_upload.description_in_arabic"),
							res.__("admin.merchant_upload.image"),
							res.__("admin.merchant_upload.non_sellable_items"),
							res.__("admin.merchant_upload.price_on_selection"),
							res.__("admin.merchant_upload.discount_by_value"),
							res.__("admin.merchant_upload.discount_percentage"),
							res.__("admin.merchant_upload.price"),
							res.__("admin.merchant_upload.from_time1"),
							res.__("admin.merchant_upload.to_time1"),
							res.__("admin.merchant_upload.comment1"),
							res.__("admin.merchant_upload.from_time2"),
							res.__("admin.merchant_upload.to_time2"),
							res.__("admin.merchant_upload.comment2"),
							res.__("admin.merchant_upload.from_time3"),
							res.__("admin.merchant_upload.to_time3"),
							res.__("admin.merchant_upload.comment3"),
							res.__("admin.merchant_upload.from_time4"),
							res.__("admin.merchant_upload.to_time4"),
							res.__("admin.merchant_upload.comment4"),
							res.__("admin.merchant_upload.from_time5"),
							res.__("admin.merchant_upload.to_time5"),
							res.__("admin.merchant_upload.comment5"),
							res.__("admin.merchant_upload.active1"),
							res.__("admin.merchant_upload.sorting1"),
							res.__("admin.merchant_upload.item_unit_id1"),
							res.__("admin.merchant_upload.price1"),
							res.__("admin.merchant_upload.discount_type1"),
							res.__("admin.merchant_upload.discount_value1"),
							res.__("admin.merchant_upload.active2"),
							res.__("admin.merchant_upload.sorting2"),
							res.__("admin.merchant_upload.item_unit_id2"),
							res.__("admin.merchant_upload.price2"),
							res.__("admin.merchant_upload.discount_type2"),
							res.__("admin.merchant_upload.discount_value2"),
							res.__("admin.merchant_upload.active3"),
							res.__("admin.merchant_upload.sorting3"),
							res.__("admin.merchant_upload.item_unit_id3"),
							res.__("admin.merchant_upload.price3"),
							res.__("admin.merchant_upload.discount_type3"),
							res.__("admin.merchant_upload.discount_value3"),
							res.__("admin.merchant_upload.active4"),
							res.__("admin.merchant_upload.sorting4"),
							res.__("admin.merchant_upload.item_unit_id4"),
							res.__("admin.merchant_upload.price4"),
							res.__("admin.merchant_upload.discount_type4"),
							res.__("admin.merchant_upload.discount_value4"),
							res.__("admin.merchant_upload.active5"),
							res.__("admin.merchant_upload.sorting5"),
							res.__("admin.merchant_upload.item_unit_id5"),
							res.__("admin.merchant_upload.price5"),
							res.__("admin.merchant_upload.discount_type5"),
							res.__("admin.merchant_upload.discount_value5"),
						];
						const tmp_imports	= 	this.db.collection(Tables.TMP_IMPORTS);
						tmp_imports.insertOne({
							upload_action : Constants.MERCHANT_UPLOAD_ITEM,
							headings 	  : headings,
							data 	 	  : dataToBeExport,
						}).then(exportResult=>{
							/** Send success response */
							let exportId = exportResult?.insertedId || "";
							res.send({
								status 		:Constants.STATUS_SUCCESS,
								message 	:res.__("admin.merchant_upload.items_has_been_added_successfully"),
								redirect_url:Constants.WEBSITE_ADMIN_URL+"merchant_upload/export_data/"+exportId,
							});
						}).catch(next);
					});
				});
			});
		}else{
			/** Render add item page  **/
			res.render('add_item',{
				layout	: false
			});
		}
	};//End addItems()

	/**
	 * Function for add menu
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async addMenu(req,res,next){
		if(isPost(req)){
			req.body			= sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
			let menus			= (req.body.menus) 			? req.body.menus 			: [];
			let restaurantSlug	= (req.body.restaurant_slug)? req.body.restaurant_slug	: "";

			if(menus.length < 1) return res.send({status : Constants.STATUS_ERROR,message : [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg':res.__("admin.system.something_going_wrong_please_try_again")}]});

			/**Get restaurant id */
			let restaurantId	= "";
			if(restaurantSlug) restaurantId = await getRestaurantId(req,res,next,{slug : restaurantSlug});

			/**Check errors and if no error set array to save data */
			const restaurant_menus	= 	this.db.collection(Tables.RESTAURANT_MENUS);
			let errors			= [];
			let dataToBeSaved	= [];
			let dataToBeExport	= [];
			let uniqueNames 	= {en : {},ar:{}};
			asyncEach(menus, (menu, callback) => {
				if(!menu) return callback(null);

				/** Send error if menu old id is blank */
				if(!menu.menu_old_id || menu.menu_old_id == ""){
					let param = "menu_old_id_"+menu.index;
					errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_menu_old_id")});
				}

				/** Send error if name in english is blank */
				if(!menu.name_in_english || menu.name_in_english == ""){
					let param = "name_in_english_"+menu.index;
					errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_name_in_english")});
				}

				/** Send error if name in arabic is blank */
				if(!menu.name_in_arabic || menu.name_in_arabic == ""){
					let param = "name_in_arabic_"+menu.index;
					errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_name_in_arabic")});
				}

				/** Send error if menu type is blank */
				if(!menu.menu_type || menu.menu_type == ""){
					let param = "menu_type_"+menu.index;
					errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_menu_type")});
				}

				/** check valid menu type*/
				if(menu.menu_type && menu.menu_type !== Constants.GLOBAL_MENU && menu.menu_type !== Constants.STANDALONE_MENU){
					let param = "menu_type_"+menu.index;
					errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_menu_type")});
				}

				let startDate = (menu.start_date) ? parseInt( menu.start_date)  : "";
				let endDate   = (menu.end_date)   ? parseInt(menu.end_date)  	: "";
				let startTime = (menu.start_time) ? parseFloat(menu.start_time.replace(':','.')) :"";
				let endTime   = (menu.end_time)   ? parseFloat(menu.end_time.replace(':','.'))	 :"";

				if(startDate != "" || endDate != "" || startTime != "" || endTime != ""){
					/** Send error if start date is blank */
					if(!startDate) {
						let param = "start_date_"+menu.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_start_date")});
					}
					/** Send error if end date is blank */
					if(!endDate) {
						let param = "end_date_"+menu.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_end_date")});
					}
					/** Send error if end date is less than start date */
					if( startDate && endDate && endDate < startDate) {
						let param = "end_date_"+menu.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.end_date_greater_than_start_date")});
					}
					/** Send error if start date is not valid */
					if(isNaN(startDate) || startDate > Constants.MERCHANT_UPLOADS_MENU_DATE_LIMIT) {
						let param = "start_date_"+menu.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_start_date")});
					}
					/** Send error if end date is not valid */
					if(isNaN(endDate) || endDate > Constants.MERCHANT_UPLOADS_MENU_DATE_LIMIT) {
						let param = "end_date_"+menu.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_end_date")});
					}
				}

				if(startTime !="" || endTime !="" || startDate !="" || endDate !=""){
					/** Send error if start time is blank */
					if(!String(startTime)) {
						let param = "start_time_"+menu.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_start_time")});
					}
					/** Send error if end time is blank */
					if(!endTime) {
						let param = "end_time_"+menu.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_end_time")});
					}
					/** Send error if end time is less than start time */
					if( startTime && endTime && endTime <= startTime) {
						let param = "end_time_"+menu.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.end_time_greater_than_start_time")});
					}
					/** Send error if start time is not valid */
					if(isNaN(startTime) || startTime < 0 || startTime > Constants.MERCHANT_UPLOADS_MENU_TIME_LIMIT) {
						let param = "start_time_"+menu.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_start_time")});
					}
					/** Send error if end time is not valid */
					if(isNaN(endTime) || endTime < 0  || endTime > Constants.MERCHANT_UPLOADS_MENU_TIME_LIMIT) {
						let param = "end_time_"+menu.index;
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.please_enter_valid_end_time")});
					}
				}

				/** check duplicate entry in form*/
				if(menu.name_in_english){
					let tempEnName   = menu.name_in_english.trim().toLowerCase();
					let param = "name_in_english_"+menu.index;
					if(uniqueNames.en[tempEnName]){
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.whoops_you_have_entered_an_already_used_name_in_english")});
					}else{
						uniqueNames.en[tempEnName] = true;
					}
				}
				/** check duplicate entry in form*/
				if(menu.name_in_arabic){
					let tempArName   = menu.name_in_arabic.trim().toLowerCase();
					let param = "name_in_arabic_"+menu.index;
					if(uniqueNames.ar[tempArName]){
						errors.push({'param':param,'msg':res.__("admin.merchant_upload.whoops_you_have_entered_an_already_used_name_in_arabic")});
					}else{
						uniqueNames.ar[tempArName] = true;
					}
				}

				/** Push data in array if not error */
				if(errors.length == 0){
					asyncParallel({
						menu_details : (childCallback)=>{
							/** find menu name in both language if already exists **/
							restaurant_menus.findOne({
								restaurant_slug : restaurantSlug,
								$or : [
									{ "name.en" : {$regex : '^'+cleanRegex(menu.name_in_english)+'$',$options : 'i'}},
									{ "name.ar" : {$regex : '^'+cleanRegex(menu.name_in_arabic)+'$',$options : 'i'}}
								],
							},{projection: { _id: 1,name:1}}).then(result=>{
								childCallback(null,result);
							}).catch(next);
						},
						tmp_menu_details : (childCallback)=>{
							/** find menu name in both language if already exists **/
							const tmp_restaurant_menus = this.db.collection(Tables.TMP_RESTAURANT_MENUS);
							tmp_restaurant_menus.findOne({
								restaurant_slug : restaurantSlug,
								$or : [
									{ "name.en" : {$regex : '^'+cleanRegex(menu.name_in_english)+'$',$options : 'i'}},
									{ "name.ar" : {$regex : '^'+cleanRegex(menu.name_in_arabic)+'$',$options : 'i'}}
								],
							},{projection: { _id: 1,name:1}}).then(result=>{
								childCallback(null,result);
							}).catch(next);
						},
						menu_unique_id : (childCallback)=>{
							/** get menu unqiue id **/
							getUniqueId(req,res,next,{type: Tables.RESTAURANT_MENUS}).then(uniqueIdResponse=>{
								childCallback(null,uniqueIdResponse?.result || "");
							}).catch(next);
						},
					},(parallelErr,response)=> {
						if(parallelErr) return callback(parallelErr);

						/**Check names is unique */
						let menuName 	 = (response.menu_details && response.menu_details.name)  		? response.menu_details.name 	:"";
						let tmpMenuName	 = (response.tmp_menu_details && response.tmp_menu_details.name)? response.tmp_menu_details.name:"";

						if(menuName || tmpMenuName){
							if((menuName.en && menuName.en.toLowerCase() == menu.name_in_english.toLowerCase()) || (tmpMenuName.en && tmpMenuName.en.toLowerCase() == menu.name_in_english.toLowerCase())){
								if (!errors) errors = [];
								errors.push({'param':'name_in_english_'+menu.index,'msg':res.__("admin.merchant_upload.whoops_you_have_entered_an_already_used_name_in_english")});
							}
							if((menuName.ar && menuName.ar.toLowerCase() == menu.name_in_arabic.toLowerCase()) || (tmpMenuName.ar && tmpMenuName.ar.toLowerCase() == menu.name_in_arabic.toLowerCase())){
								if (!errors) errors = [];
								errors.push({'param':"name_in_arabic_"+menu.index,'msg':res.__("admin.merchant_upload.whoops_you_have_entered_an_already_used_name_in_arabic")});
							}
						}

						/** Push data in array */
						if(errors.length == 0){

							let tempData = {
								menu_id 	: response.menu_unique_id,
								name		: {
									ar : menu?.name_in_arabic || "",
									en : menu?.name_in_english || ""
								},
								start_date		: startDate,
								start_time		: startTime,
								end_date		: endDate,
								end_time		: endTime,
								is_default		: (startDate == "" && endDate == "" && startTime == "" && endTime == "") ? true : false ,
								restaurant_slug	: restaurantSlug,
								restaurant_id	: restaurantId,
								added_by		: new ObjectId(req.session.user._id),
								channel_id		: req.session.user.channel_id,
								is_active		: Constants.ACTIVE,
								created			: getUtcDate(),
								modified		: getUtcDate(),
								menu_old_id     : menu.menu_old_id,
								menu_type       : menu.menu_type
							};
							dataToBeSaved.push(tempData);

							dataToBeExport.push([
								response.menu_unique_id,
								menu.menu_old_id,
								menu.name_in_english,
								menu.name_in_arabic,
								menu.menu_type,
								startDate,
								endDate,
								startTime,
								endTime,
							]);
						}
						callback(null);
					});
				}else{
					callback(null);
				}
			},(asyncErr)=>{
				if(asyncErr) return next(asyncErr);

				/** Send error response **/
				if(errors.length > 0) return res.send({ status	: Constants.STATUS_ERROR, message	: errors});

				if(dataToBeSaved.length < 1) return res.send({status : Constants.STATUS_ERROR,message : [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg':res.__("admin.system.something_going_wrong_please_try_again")}]});

				/**Save data */
				restaurant_menus.insertMany(dataToBeSaved,{forceServerObjectId:true}).then(()=>{

					/** Save export data */
					let headings  = [
						res.__("admin.merchant_upload.menu_id"),
						res.__("admin.merchant_upload.menu_old_id"),
						res.__("admin.merchant_upload.name_in_english"),
						res.__("admin.merchant_upload.name_in_arabic"),
						res.__("admin.merchant_upload.menu_type"),
						res.__("admin.merchant_upload.start_date"),
						res.__("admin.merchant_upload.end_date"),
						res.__("admin.merchant_upload.start_time"),
						res.__("admin.merchant_upload.end_time")
					];
					const tmp_imports	= 	this.db.collection(Tables.TMP_IMPORTS);
					tmp_imports.insertOne({
						upload_action : Constants.MERCHANT_UPLOAD_MENU,
						headings 	  : headings,
						data 	 	  : dataToBeExport,
					}).then(exportResult=>{
						/** Send success response */
						let exportId = exportResult?.insertedId || "";
						res.send({
							status 		:Constants.STATUS_SUCCESS,
							message 	:res.__("admin.merchant_upload.menus_has_been_added_successfully"),
							redirect_url:Constants.WEBSITE_ADMIN_URL+"merchant_upload/export_data/"+exportId,
						});
					}).catch(next);
				}).catch(next);
			});
		}else{
			/** Render add menu page  **/
			res.render('add_menu',{
				layout	: false
			});
		}
	};//End addMenu()

	/**
	 * Function for export data
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async exportData(req,res,next){
		try{
			let exportId= (req.params.export_id) ? req.params.export_id	: "";

			const tmp_imports =	this.db.collection(Tables.TMP_IMPORTS);
			let exportresult = await tmp_imports.findOne({_id: new ObjectId(exportId) });

			if(!exportresult){
				req.flash(Constants.STATUS_ERROR,res.__("admin.system.invalid_access"));
				return res.redirect(Constants.WEBSITE_ADMIN_URL+"merchant_upload");
			}

			/**  Function to export data in excel format **/
			let fileName = Constants.MERCHANT_UPLOAD_ACTION?.[exportresult.upload_action]?.title || "";
			exportToExcel(req,res,{
				file_prefix 		: fileName.replace("Upload","").replace(" ",""),
				heading_columns		: exportresult.headings,
				export_data			: exportresult.data
			});

			/** Remove data after export */
			tmp_imports.deleteOne({_id: new ObjectId(exportId) }).then(()=>{}).catch(next);
		}catch(error){
			return next(error);
		}
	};// end exportData()

	/**
	 * Function for add restaurant
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async addRestaurant(req,res,next){
		try{
			if(isPost(req)){
				/** Sanitize Data **/
				req.body			= sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS);
				let restaurantList	= (req.body.restaurants)	?	req.body.restaurants : [];

				/** Send error response  */
				if(restaurantList.length < 1) return res.send({status : Constants.STATUS_ERROR,message : [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg':res.__("admin.system.something_going_wrong_please_try_again")}]});


				asyncParallel({
					delivery_method_list : (parentCallback)=>{
						/** Get delivery methods list  */
						const delivery_methods = this.db.collection(Tables.DELIVERY_METHODS);
						delivery_methods.distinct( "slug", {}).then(methodList=>{
							parentCallback(null,methodList);
						}).catch(next);
					},
					payment_method_list : (parentCallback)=>{
						/** Get payment methods list  */
						const payment_methods = this.db.collection(Tables.PAYMENT_METHODS);
						payment_methods.distinct( "slug", {}).then(methodList=>{
							parentCallback(null,methodList);
						}).catch(next);
					},
					settlement_method_list : (parentCallback)=>{
						/** Get settlement methods list  */
						const settlement_methods = this.db.collection(Tables.SETTLEMENT_METHODS);
						settlement_methods.distinct( "slug", {}).then(methodList=>{
							parentCallback(null,methodList);
						}).catch(next);
					}
				},(parentErr,parentRecponse)=>{
					if(parentErr) return next(parentErr);

					let deliveryMethodList 	=	parentRecponse.delivery_method_list;
					let paymentMethodList 	= 	parentRecponse.payment_method_list;
					let settlementMethodList= 	parentRecponse.settlement_method_list;

					const users					= 	this.db.collection(Tables.USERS);
					const restaurant_details	= 	this.db.collection(Tables.RESTAURANT_DETAILS);
					const restaurants 			= 	this.db.collection(Tables.RESTAURANTS);
					/**Check errors and if no error set array to save data */
					let errors			=	[];
					let dataToBeSaved	= 	[];
					let dataToBeExport	= 	[];
					let uniqueObject	=	{email: {}, phone:{}};
					let authUserId		= 	new ObjectId(req.session.user._id);
					let validIntegerRegx= 	/^[0-9]+$/;
					let validEmailRegx 	= 	/^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
					asyncEach(restaurantList, (records, eachCallback) => {
						if(records){
							let currentIndex 	=	records.index;

							if(!records.restaurant_old_id){
								errors.push({'param':"restaurant_old_id_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_restaurant_old_id")});
							}

							/** Send error if restaurant logo is not valid */
							if(records.restaurant_logo){
								let imageExtension = records.restaurant_logo.split('.').pop().toLowerCase();
								if(Constants.ALLOWED_IMAGE_EXTENSIONS.indexOf(imageExtension) == -1){
									let param = "restaurant_logo_"+currentIndex;
									errors.push({'param':param,'msg':res.__("admin.merchant_upload.restaurant_logo_name_should_be_in_png_jpg_jpeg_format")});
								}
							}

							/** Send error if restaurant landing image is not valid */
							if(records.restaurant_landing_image){
								let imageExtension = records.restaurant_landing_image.split('.').pop().toLowerCase();
								if(Constants.ALLOWED_IMAGE_EXTENSIONS.indexOf(imageExtension) == -1){
									let param = "restaurant_landing_image_"+currentIndex;
									errors.push({'param':param,'msg':res.__("admin.merchant_upload.restaurant_landing_image_name_should_be_in_png_jpg_jpeg_format")});
								}
							}

							if(!records.name_in_english){
								errors.push({'param':"name_in_english_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_name_in_english")});
							}

							if(!records.name_in_arabic){
								errors.push({'param':"name_in_arabic_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_name_in_arabic")});
							}

							if(!records.contact_person){
								errors.push({'param':"contact_person_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_contact_person_name")});
							}

							if(!records.account_manager){
								errors.push({'param':"account_manager_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_account_manager_name")});
							}


							if(!records.phone_number){
								errors.push({'param':"phone_number_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_phone_number")});
							}else if(isNaN(records.phone_number) || !validIntegerRegx.test(records.phone_number) || records.phone_number.length < Constants.MOBILE_NUMBER_MIN_LENGTH || records.phone_number.length > Constants.	MOBILE_NUMBER_MAX_LENGTH){
								errors.push({'param':"phone_number_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_phone_number")});
							}else if(uniqueObject.phone[records.phone_number]){
								errors.push({'param':"phone_number_"+currentIndex,'msg':res.__("admin.merchant_upload.phone_number_is_already_exist")});
							}else{
								uniqueObject.phone[records.phone_number] = true;
							}

							if(!records.email){
								errors.push({'param':"email_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_email")});
							}else if(!validEmailRegx.test(records.email)){
								errors.push({'param':"email_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_email")});
							}else if(uniqueObject.email[records.email]){
								errors.push({'param':"email_"+currentIndex,'msg':res.__("admin.merchant_upload.email_already_exists")});
							}else{
								uniqueObject.email[records.email] = true;
							}

							if(!records.address){
								errors.push({'param':"address_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_address")});
							}

							if(!records.delivery_by || records.delivery_by.length <= 0){
								errors.push({'param':"delivery_by_"+currentIndex+"_0",'msg':res.__("admin.merchant_upload.please_enter_delivery_by")});
							}else{
								let deliveryBySelected = false;
								records.delivery_by.map((methodKey,methodIndex)=>{
									if(methodKey){
										deliveryBySelected = true;
										if(deliveryMethodList.indexOf(methodKey) == -1){
											errors.push({'param':"delivery_by_"+currentIndex+"_"+methodIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_delivery_by")});
										}
									}
								});
								if(!deliveryBySelected){
									errors.push({'param':"delivery_by_"+currentIndex+"_0",'msg':res.__("admin.merchant_upload.please_enter_delivery_by")});
								}
							}

							if(!records.commission_type){
								errors.push({'param':"commission_type_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_commission_type")});
							}else if(!Constants.COMMISSION_TYPE_OBJECT[records.commission_type]){
								errors.push({'param':"commission_type_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_commission_type")});
							}

							if(Constants.COMMISSION_TYPE_OBJECT[records.commission_type]){
								if(records.commission_type == Constants.COMMISSION_FIXED || !records.commission_value){
									if(!records.commission_value || !records.commission_value[0] || !records.commission_value[0].commission){
										errors.push({'param':"commission_value_"+currentIndex+"_0_commission",'msg':res.__("admin.merchant_upload.please_enter_commission")});
									}else if(isNaN(records.commission_value[0].commission) || records.commission_value[0].commission <0){
										errors.push({'param':"commission_value_"+currentIndex+"_0_commission",'msg':res.__("admin.merchant_upload.please_enter_valid_commission")});
									}
								}else{
									records.commission_value.map((commissionData,commissionKey)=>{
										if(commissionKey == 0 || (commissionData.commission || commissionData.amount_from || commissionData.amount_to)){
											if(!commissionData.commission){
												errors.push({'param':"commission_value_"+currentIndex+"_"+commissionKey+"_commission",'msg':res.__("admin.merchant_upload.please_enter_commission")});
											}else if(isNaN(commissionData.commission) || commissionData.commission <0){
												errors.push({'param':"commission_value_"+currentIndex+"_"+commissionKey+"_commission",'msg':res.__("admin.merchant_upload.please_enter_valid_commission")});
											}
											if(!commissionData.amount_from){
												errors.push({'param':"commission_value_"+currentIndex+"_"+commissionKey+"_amount_from",'msg':res.__("admin.merchant_upload.please_enter_amount_from")});
											}else if(isNaN(commissionData.amount_from) ||commissionData.amount_from <0){
												errors.push({'param':"commission_value_"+currentIndex+"_"+commissionKey+"_amount_from",'msg':res.__("admin.merchant_upload.please_enter_valid_amount_from")});
											}

											if(!commissionData.amount_to){
												errors.push({'param':"commission_value_"+currentIndex+"_"+commissionKey+"_amount_to",'msg':res.__("admin.merchant_upload.please_enter_amount_to")});
											}else if(isNaN(commissionData.amount_to)|| commissionData.amount_to <0){
												errors.push({'param':"commission_value_"+currentIndex+"_"+commissionKey+"_amount_to",'msg':res.__("admin.merchant_upload.please_enter_valid_amount_to")});
											}

											if(commissionData.amount_to && commissionData.amount_from){
												if(parseFloat(commissionData.amount_from) >= parseFloat(commissionData.amount_to)){
													errors.push({'param':"commission_value_"+currentIndex+"_"+commissionKey+"_amount_to",'msg':res.__("admin.merchant_upload.amount_to_greater_then_amount_from")});
												}
											}
										}
									});
								}
							}

							if(!records.commission_criteria){
								errors.push({'param':"commission_criteria_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_commission_criteria")});
							}else if(!Constants.COMMISSION_CRITERIA_OBJECT[records.commission_criteria]){
								errors.push({'param':"commission_criteria_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_vaild_commission_criteria")});
							}

							if(!records.payment_method || records.payment_method.length <= 0){
								errors.push({'param':"payment_method_"+currentIndex+"_0_method",'msg':res.__("admin.merchant_upload.please_enter_payment_method")});
							}else{
								records.payment_method.map((methodData,methodIndex)=>{
									if(methodIndex == 0 || (methodData.method || methodData.cash_commission)){
										if(!methodData.method){
											errors.push({'param':"payment_method_"+currentIndex+"_"+methodIndex+"_method",'msg':res.__("admin.merchant_upload.please_enter_payment_method")});
										}else if(paymentMethodList.indexOf(methodData.method) == -1){
											errors.push({'param':"payment_method_"+currentIndex+"_"+methodIndex+"_method",'msg':res.__("admin.merchant_upload.please_enter_valid_payment_method")});
										}

										if(isNaN(methodData.cash_commission) || methodData.cash_commission <0){
											errors.push({'param':"payment_method_"+currentIndex+"_"+methodIndex+"_cash_commission",'msg':res.__("admin.merchant_upload.please_enter_valid_cash_commission")});
										}
									}
								});
							}

							if(!records.settlement_method || records.settlement_method.length <= 0){
								errors.push({'param':"settlement_method_"+currentIndex+"_0",'msg':res.__("admin.merchant_upload.please_enter_settlement_method")});
							}else{
								let settlementMethodSelected = false;
								records.settlement_method.map((methodKey,methodIndex)=>{
									if(methodKey){
										settlementMethodSelected = true;
										if(settlementMethodList.indexOf(methodKey) == -1){
											errors.push({'param':"settlement_method_"+currentIndex+"_"+methodIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_settlement_method")});
										}
									}
								});

								if(!settlementMethodSelected){
									errors.push({'param':"settlement_method_"+currentIndex+"_0",'msg':res.__("admin.merchant_upload.please_enter_settlement_method")});
								}
							}

							if(!records.beneficiary){
								errors.push({'param':"beneficiary_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_beneficiary")});
							}
							if(!records.iban){
								errors.push({'param':"iban_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_iban")});
							}

							if(!records.bank_account){
								errors.push({'param':"bank_account_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_bank_account")});
							}

							if(!records.settlement_type){
								errors.push({'param':"settlement_type_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_settlement_type")});
							}else if(!Constants.SETTLEMENT_TYPE_OBJECT[records.settlement_type]){
								errors.push({'param':"settlement_type_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_settlement_type")});
							}

							if(!records.caused_by_whom || records.caused_by_whom.length <= 0){
								errors.push({'param':"caused_by_whom_"+currentIndex+"_0_whom",'msg':res.__("admin.merchant_upload.please_enter_whom")});
							}else{
								records.caused_by_whom.map((whomData,whomIndex)=>{
									if(whomIndex == 0 || (whomData.whom || whomData.percentage)){
										if(!whomData.whom){
											errors.push({'param':"caused_by_whom_"+currentIndex+"_"+whomIndex+"_whom",'msg':res.__("admin.merchant_upload.please_enter_whom")});
										}else if(!Constants.CAUSED_BY_OBJECT[whomData.whom]){
											errors.push({'param':"caused_by_whom_"+currentIndex+"_"+whomIndex+"_whom",'msg':res.__("admin.merchant_upload.please_enter_valid_whom")});
										}

										if(isNaN(whomData.percentage) || whomData.percentage <0 || whomData.percentage > Constants.		MAX_PERCENTAGE){
											errors.push({'param':"caused_by_whom_"+currentIndex+"_"+whomIndex+"_percentage",'msg':res.__("admin.merchant_upload.please_enter_valid_percentage")});
										}
									}
								});
							}

							if(!records.contract_number){
								errors.push({'param':"contract_number_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_contract_number")});
							}
							if(!records.contract_date){
								errors.push({'param':"contract_date_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_contract_date")});
							}else if(new Date(records.contract_date) == "Invalid Date"){
								errors.push({'param':"contract_date_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_contract_date")});
							}

							if(!records.effective_date){
								errors.push({'param':"effective_date_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_effective_date")});
							}else if(new Date(records.effective_date) == "Invalid Date"){
								errors.push({'param':"effective_date_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_effective_date")});
							}

							if(!records.valid_from){
								errors.push({'param':"valid_from_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_from")});
							}else if(new Date(records.valid_from) == "Invalid Date"){
								errors.push({'param':"valid_from_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_valid_from")});
							}

							if(!records.expire_date){
								errors.push({'param':"expire_date_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_expire_date")});
							}else if(new Date(records.expire_date) == "Invalid Date"){
								errors.push({'param':"expire_date_"+currentIndex,'msg':res.__("admin.merchant_upload.please_enter_valid_expire_date")});
							}

							if(errors.length ==0){
								asyncParallel({
									user_details : (callback)=>{

										/** Set user conditions */
										let uniqueConditions = {
											$or			:	[
												{email : {$regex : '^'+records.email+'$',$options : 'i'}},
												{mobile_number : records.phone_number}
											],
											is_deleted	: 	Constants.NOT_DELETED,
										};

										/* Get duplicate email or mobile number from users collection */
										users.findOne(uniqueConditions,{projection: {_id:1,email:1,mobile_number:1}}).then(userResult=>{
											callback(null,userResult);
										}).catch(next);
									},
									slug_details : (callback)=>{
										/** Get slug **/
										getDatabaseSlug({title: records.account_manager, table_name: Tables.USERS, slug_field: "slug"}).then(slugResponse=>{
											callback(null,slugResponse?.title || "");
										}).catch(next);
									},
									restaurant_slug : (callback)=>{
										/** Get slug **/
										getDatabaseSlug({title: records.name_in_english, table_name: Tables.RESTAURANTS, slug_field: "slug"}).then(slugResponse=>{
											callback(null,slugResponse?.title || "");
										}).catch(next);
									},
									random_pass : (callback)=>{
										/** generate a random string for password*/
										let randomResponse = getRandomString(req,res,{srting_length :Constants.PASSWORD_MIN_LENGTH})
										let password =	(randomResponse?.result)	?	randomResponse.result	:"";
										let bcryptPassword	= generateMD5Hash(password);
										callback(null,{bcrypt_password: bcryptPassword, password:password});
									},
									unique_restaurant_id : (callback)=>{
										/** Get unique id **/
										getUniqueId(req,res,next,{type:Tables.RESTAURANTS}).then(response=>{
											if(response.status !== Constants.STATUS_SUCCESS) return callback(response.message,null);
											callback(null,response?.result || "");
										}).catch(next);
									},
								},(parallelErr,parallelResponse)=> {
									if(parallelErr) return eachCallback(parallelErr);

									if(parallelResponse.user_details){
										let resultMail 	 	= (parallelResponse.user_details.email) 		? 	parallelResponse.user_details.email.toLowerCase()	:"";
										let resultMobile	= (parallelResponse.user_details.mobile_number)	?	parallelResponse.user_details.mobile_number			:"";
										let enteredMail  	= records.email.toLowerCase();

										/** Push error message in array if email or mobile already exists*/
										if(resultMail == enteredMail){
											errors.push({'param':"email_"+currentIndex,'msg':res.__("admin.merchant_upload.email_already_exists")});
										}

										if(resultMobile == records.phone_number){
											errors.push({'param':'phone_number_'+currentIndex,'msg':res.__("admin.merchant_upload.phone_number_is_already_exist")});
										}
									}

									if(errors.length ==0){
										/** Manage commission value  */
										let commissionType	=	records.commission_type;
										let commissionValue = 	[];
										let exportCommissionValue = [];
										if(commissionType == Constants.COMMISSION_FIXED){
											commissionValue.push({
												commission :parseFloat(records.commission_value[0].commission)
											});

											records.commission_value.map(commissionData=>{
												exportCommissionValue.push(commissionData.commission);
												exportCommissionValue.push(commissionData.amount_from);
												exportCommissionValue.push(commissionData.amount_to);
											});
										}else{
											records.commission_value.map(commissionData=>{
												if(commissionData.commission && commissionData.amount_from && commissionData.amount_to){
													commissionValue.push({
														commission 	:	parseFloat(commissionData.commission),
														from 		: 	parseFloat(commissionData.amount_from),
														to 			: 	parseFloat(commissionData.amount_to),
													});
												}

												exportCommissionValue.push(commissionData.commission);
												exportCommissionValue.push(commissionData.amount_from);
												exportCommissionValue.push(commissionData.amount_to);
											});
										}

										/** Manage delivery by  */
										let deliveryBy = []
										records.delivery_by.map(method=>{
											if(method){
												deliveryBy.push(method);
											}
										});

										/** Manage delivery by  */
										let settlementMethod = []
										let exportSettlementMethod = []
										records.settlement_method.map(method=>{
											if(method){
												settlementMethod.push(method);
											}

											exportSettlementMethod.push(method);
										});

										/** Manage payment method  */
										let paymentMethod = [];
										let exportPaymentMethod = [];
										records.payment_method.map(methodData=>{
											if(methodData.method){
												paymentMethod.push({
													method 		:	methodData.method,
													commission 	: 	(methodData.cash_commission) ? parseFloat(methodData.cash_commission) :0
												});
											}
											exportPaymentMethod.push(methodData.method);
											exportPaymentMethod.push(methodData.cash_commission);
										});

										/** Manage caused by  */
										let causedBy 		= [];
										let exportCausedBy 	= [];
										records.caused_by_whom.map(methodData=>{
											if(methodData.whom){
												causedBy.push({
													cause 		:	methodData.whom,
													percentage 	: 	(methodData.percentage) ? parseFloat(methodData.percentage) :0
												});
											}
											exportCausedBy.push(methodData.whom);
											exportCausedBy.push(methodData.percentage);
										});

										let tempData = {
											restaurant_user_details :{
												email 			: 	records.email,
												full_name		: 	records.account_manager,
												mobile_number	:	records.phone_number,
												phone_country_code:	Constants.DEFAULT_COUNTRY_CODE,
												slug	 		: 	parallelResponse.slug_details,
												password 		: 	parallelResponse.random_pass.password,
												bcrypt_password	: 	parallelResponse.random_pass.bcrypt_password,
											},
											restaurant_details: {
												name: {en: records.name_in_english , ar: records.name_in_arabic},
												address				:	records.address,
												default_name		:	records.name_in_english,
												description			:	records.description ? records.description : "",
												slug				:	parallelResponse.restaurant_slug,
												restaurant_number	: 	parallelResponse.unique_restaurant_id,
												restaurant_logo     :   records.restaurant_logo ? records.restaurant_logo : "",
												restaurant_landing_image : records.restaurant_landing_image ? records.restaurant_landing_image : "",
												restaurant_old_id   :   records.restaurant_old_id
											},
											restaurant_sub_details: {
												email				:	records.email,
												mobile_number		:	records.phone_number,
												account_manager		:	records.account_manager,
												commission_type		:	records.commission_type,
												commission_value	:	commissionValue,
												contact_person		:	records.contact_person,
												address				:	records.address,
												delivery_by			:	deliveryBy,
												commission_criteria	:	records.commission_criteria,
												payment_method		:	paymentMethod,
												settlement_method	:	settlementMethod,
												caused_by			:	causedBy,
												beneficiary			:	records.beneficiary,
												iban				:	records.iban,
												bank_account		:	records.bank_account,
												settlement_type		:	records.settlement_type,
												phone_country_code	:	Constants.DEFAULT_COUNTRY_CODE,
												contract_number		:	records.contract_number,
												contract_date		:	getUtcDate(records.contract_date),
												effective_date		:	getUtcDate(records.effective_date),
												valid_from			:	getUtcDate(records.valid_from),
												expire_date			:	getUtcDate(records.expire_date),
											},
										};

										dataToBeSaved.push(tempData);

										/** Manage export data */
										let tmpExportData = [
											parallelResponse.unique_restaurant_id, records.restaurant_old_id, records.restaurant_logo ? records.restaurant_logo : "",records.restaurant_landing_image ? records.restaurant_landing_image : "",
											records.name_in_english, records.name_in_arabic, records.contact_person,
											records.account_manager, records.phone_number, records.email, records.address, records.description ? records.description : "",
										];

										tmpExportData = tmpExportData.concat(records.delivery_by);
										tmpExportData.push(records.commission_type);
										tmpExportData = tmpExportData.concat(exportCommissionValue);
										tmpExportData.push(records.commission_criteria);
										tmpExportData = tmpExportData.concat(exportPaymentMethod,exportSettlementMethod);
										tmpExportData.push(records.beneficiary);
										tmpExportData.push(records.iban);
										tmpExportData.push(records.bank_account);
										tmpExportData.push(records.settlement_type);
										tmpExportData = tmpExportData.concat(exportCausedBy);
										tmpExportData.push(records.contract_number);
										tmpExportData.push(records.contract_date);
										tmpExportData.push(records.effective_date);
										tmpExportData.push(records.valid_from);
										tmpExportData.push(records.expire_date);

										dataToBeExport.push(tmpExportData);
									}
									eachCallback(null);
								});
							}else{
								return eachCallback(null);
							}
						}else{
							return eachCallback(null);
						}
					},(asyncErr)=>{
						if(asyncErr) return next(asyncErr);

						/** Send error response **/
						if(errors.length > 0) return res.send({ status	: Constants.STATUS_ERROR, message	: errors});

						if(dataToBeSaved.length < 1) return res.send({status : Constants.STATUS_ERROR,message : [{'param':Constants.ADMIN_GLOBAL_ERROR,'msg':res.__("admin.system.something_going_wrong_please_try_again")}]});

						let authUserId		= 	new ObjectId(req.session.user._id);
						asyncEach(dataToBeSaved, (records, eachCallback) => {
							let userDetails 			= 	records.restaurant_user_details;
							let restaurantDetails 		= 	records.restaurant_details;
							let restaurantSubDetails 	=	records.restaurant_sub_details;

							/** Save restaurant details  */
							restaurants.insertOne({
								slug				:	restaurantDetails.slug,
								name				:	restaurantDetails.name,
								default_name		:	restaurantDetails.default_name,
								address				:	restaurantDetails.address,
								description			:	restaurantDetails.description,
								restaurant_number	:	restaurantDetails.restaurant_number,
								is_deleted 			: 	Constants.NOT_DELETED,
								open				:	false,
								status				:	Constants.ACTIVE,
								created				:	getUtcDate(),
								import_on			:	getUtcDate(),
								modified 			: 	getUtcDate(),
								image               :   restaurantDetails.restaurant_logo,
								landing_image       :   restaurantDetails.restaurant_landing_image,
								restaurant_old_id   :   restaurantDetails.restaurant_old_id
							}).then(restaurantResult=>{
								let restaurantId = restaurantResult?.insertedId || "";

								asyncParallel({
									save_restaurant_user_details : (subCallback)=>{
										/** Save restaurant user details  */
										users.insertOne({
											slug 			: 	userDetails.slug,
											email 			: 	userDetails.email,
											username 		: 	userDetails.email,
											full_name 		: 	userDetails.full_name,
											mobile_number 	: 	userDetails.mobile_number,
											phone_country_code:	userDetails.phone_country_code,
											password		: 	userDetails.bcrypt_password,
											restaurant_id 	:	restaurantId,
											user_type 		:	Constants.USER_TYPE_RESTAURANT,
											user_role_id	:	Constants.RESTAURANT,
											active 			:	Constants.ACTIVE,
											is_verified 	: 	Constants.VERIFIED,
											is_deleted 		: 	Constants.NOT_DELETED,
											created			:	getUtcDate(),
											modified 		: 	getUtcDate(),
										}).then(userResult=>{
											if(userResult){
												/*************** Send Mail  ***************/
												sendMailToUsers(req,res,{
													event_type 		: Constants.RESTAURANT_REGISTRATION_EMAIL_EVENTS,
													restaurant_id	: restaurantId,
													restaurant_name	: userDetails.full_name,
													restaurant_email: userDetails.email,
													password		: userDetails.password
												});
												/*************** Send Mail  ***************/
											}
											subCallback(null,userResult);
										}).catch(next);
									},
									save_restaurant_sub_details : (subCallback)=>{

										/** Save restaurant sub details  */
										restaurant_details.insertOne({
											approved_by			:	new ObjectId(authUserId),
											restaurant_id 		: 	restaurantId,
											email 				: 	restaurantSubDetails.email,
											mobile_number 		: 	restaurantSubDetails.mobile_number,
											account_manager 	: 	restaurantSubDetails.account_manager,
											commission_type 	: 	restaurantSubDetails.commission_type,
											commission_value 	: 	restaurantSubDetails.commission_value,
											contact_person 		: 	restaurantSubDetails.contact_person,
											address 			: 	restaurantSubDetails.address,
											delivery_by 		: 	restaurantSubDetails.delivery_by,
											commission_criteria : 	restaurantSubDetails.commission_criteria,
											payment_method 		: 	restaurantSubDetails.payment_method,
											settlement_method 	: 	restaurantSubDetails.settlement_method,
											caused_by 			: 	restaurantSubDetails.caused_by,
											beneficiary 		: 	restaurantSubDetails.beneficiary,
											iban 				: 	restaurantSubDetails.iban,
											bank_account 		: 	restaurantSubDetails.bank_account,
											settlement_type 	: 	restaurantSubDetails.settlement_type,
											phone_country_code 	: 	restaurantSubDetails.phone_country_code,
											contract_number 	: 	restaurantSubDetails.contract_number,
											contract_date 		: 	restaurantSubDetails.contract_date,
											effective_date 		: 	restaurantSubDetails.effective_date,
											valid_from 			: 	restaurantSubDetails.valid_from,
											expire_date 		: 	restaurantSubDetails.expire_date,
											approved_by			:	new ObjectId(authUserId),
											is_import			: 	true,
											approved_on			:	getUtcDate(),
											created				:	getUtcDate(),
											modified 			: 	getUtcDate(),
										}).then(subResult=>{
											subCallback(null,subResult);
										}).catch(next);
									},
								},(parallelSubErr)=> {
									eachCallback(parallelSubErr);
								});
							}).catch(next);
						},(asyncEachErr)=>{
							if(asyncEachErr) return next(asyncEachErr);

							/** Save export data */
							let headings  = [
								res.__("admin.merchant_upload.restaurant_id"),
								res.__("admin.merchant_upload.restaurant_old_id"),
								res.__("admin.merchant_upload.restaurant_logo"),
								res.__("admin.merchant_upload.restaurant_landing_image"),
								res.__("admin.merchant_upload.restaurant_name_in_english"),
								res.__("admin.merchant_upload.restaurant_name_in_arabic"),
								res.__("admin.merchant_upload.contact_person"),
								res.__("admin.merchant_upload.account_manager"),
								res.__("admin.merchant_upload.phone_number"),
								res.__("admin.merchant_upload.email"),
								res.__("admin.merchant_upload.address"),
								res.__("admin.merchant_upload.description"),
								res.__("admin.merchant_upload.delivery_by_one"),
								res.__("admin.merchant_upload.delivery_by_two"),
								res.__("admin.merchant_upload.delivery_by_three"),
								res.__("admin.merchant_upload.commission_type"),
								res.__("admin.merchant_upload.commission_one"),
								res.__("admin.merchant_upload.amount_from_one"),
								res.__("admin.merchant_upload.amount_to_one"),
								res.__("admin.merchant_upload.commission_two"),
								res.__("admin.merchant_upload.amount_from_two"),
								res.__("admin.merchant_upload.amount_to_two"),
								res.__("admin.merchant_upload.commission_three"),
								res.__("admin.merchant_upload.amount_from_three"),
								res.__("admin.merchant_upload.amount_to_three"),
								res.__("admin.merchant_upload.commission_four"),
								res.__("admin.merchant_upload.amount_from_four"),
								res.__("admin.merchant_upload.amount_to_four"),
								res.__("admin.merchant_upload.commission_five"),
								res.__("admin.merchant_upload.amount_from_five"),
								res.__("admin.merchant_upload.amount_to_five"),
								res.__("admin.merchant_upload.commission_criteria"),
								res.__("admin.merchant_upload.payment_method_one"),
								res.__("admin.merchant_upload.cash_commission_one"),
								res.__("admin.merchant_upload.payment_method_two"),
								res.__("admin.merchant_upload.cash_commission_two"),
								res.__("admin.merchant_upload.payment_method_three"),
								res.__("admin.merchant_upload.cash_commission_three"),
								res.__("admin.merchant_upload.payment_method_four"),
								res.__("admin.merchant_upload.cash_commission_four"),
								res.__("admin.merchant_upload.payment_method_five"),
								res.__("admin.merchant_upload.cash_commission_five"),
								res.__("admin.merchant_upload.payment_method_six"),
								res.__("admin.merchant_upload.cash_commission_six"),
								res.__("admin.merchant_upload.payment_method_seven"),
								res.__("admin.merchant_upload.cash_commission_seven"),
								res.__("admin.merchant_upload.settlement_method_one"),
								res.__("admin.merchant_upload.settlement_method_two"),
								res.__("admin.merchant_upload.settlement_method_three"),
								res.__("admin.merchant_upload.beneficiary"),
								res.__("admin.merchant_upload.iban"),
								res.__("admin.merchant_upload.bank_account"),
								res.__("admin.merchant_upload.settlement_type"),
								res.__("admin.merchant_upload.caused_by_whom_one"),
								res.__("admin.merchant_upload.percentage"),
								res.__("admin.merchant_upload.caused_by_whom_two"),
								res.__("admin.merchant_upload.percentage"),
								res.__("admin.merchant_upload.caused_by_whom_three"),
								res.__("admin.merchant_upload.percentage"),
								res.__("admin.merchant_upload.contract_number"),
								res.__("admin.merchant_upload.contract_date"),
								res.__("admin.merchant_upload.effective_date"),
								res.__("admin.merchant_upload.valid_from"),
								res.__("admin.merchant_upload.expire_date")
							];

							const tmp_imports	= 	this.db.collection(Tables.TMP_IMPORTS);
							tmp_imports.insertOne({
								upload_action : Constants.MERCHANT_UPLOAD_RESTAURANT,
								headings 	  : headings,
								data 	 	  : dataToBeExport,
							}).then(exportResult=>{
								/** Send success response */
								let exportId = exportResult?.insertedId || "";
								res.send({
									status 		:Constants.STATUS_SUCCESS,
									message 	:res.__("admin.merchant_upload.restaurants_has_been_added_successfully"),
									redirect_url:Constants.WEBSITE_ADMIN_URL+"merchant_upload/export_data/"+exportId,
								});
							}).catch(next);
						});
					});
				});
			}else{
				/** Render add restaurant page  **/
				res.render('add_restaurant',{
					layout	: false
				});
			}
		}catch(error){
			return next(error);
		}
	}// end addRestaurant()
}