
import { ObjectId } from 'mongodb';
import { each as asyncEach } from 'async';
import axios from 'axios';
import { parallel as asyncParallel } from 'async';

import Tables from './../config/database_tables.mjs';
import { getDb } from '../config/connection.mjs';
import * as Constants from "../config/global_constant.mjs";
import { getDropdownList } from './selectBoxHelper.mjs';
import { getUtcDate } from './dateHelper.mjs';
import { runTaskParallel } from './index.mjs';

/**
 * Function to get restaurant id using slug
 *
 * @param req		As 	Request Data
 * @param res		As 	Response Data
 * @param options	As	Data object
 *
 * @return message
 */
export const getRestaurantId = (req,res,next,options)=>{
	return new Promise(async resolve=>{
		let slug = options?.slug || "";
		if(!slug) return resolve("");

		/** Get restaurant id by slug */
		const dbInstance   = getDb();
		const restaurants  = dbInstance.collection(Tables.RESTAURANTS);
		let restaurantData = await restaurants.findOne({slug: slug},{projection:{_id:1}});

		/** Send response */
		resolve(restaurantData?._id || "");
	}).catch(next);
}//getRestaurantId()

/**
 * Function to get restaurant details using slug
 *
 * @param req		As 	Request Data
 * @param res		As 	Response Data
 * @param options	As	Data object
 *
 * @return message
 */
export const getRestaurantDetails = (req,res,next,options)=>{
	return new Promise(async resolve=>{
		let slug = options?.slug || "";
		if(!slug) return resolve({status : Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

		/** Get restaurant details by slug */
		const restaurants = getDb().collection(Tables.RESTAURANTS);
		let result = await restaurants.findOne({slug : slug},{projection:{_id:1,name :1,restaurant_number:1,default_name:1,aghzeya_restaurant_id:1,slug:1,talabat_restaurant_id:1 }});

		/** Send response */
		if(!result) return resolve({status : Constants.STATUS_ERROR,message : res.__("system.invalid_access")});
		resolve({status : Constants.STATUS_SUCCESS, result : result});
	}).catch(next);
}//getRestaurantDetails()

/**
 * Function for get restaurant html list for select box
 *
 * @param defaultLanguage	As Default Language
 *
 * @return json
 */
export const getRestaurantDropdowns = (req,res,next,options={}) =>{
	return new Promise(async resolve=>{
		let slug = options?.slug || "";

		/** get dropdown options for restaurant list **/
		let response  =	await getDropdownList(req,res,next,{
			collections :[{
				collection : Tables.RESTAURANTS,
				conditions : {
					is_deleted: Constants.NOT_DELETED,
				},
				selected   : [slug],
				columns    : ["slug","default_name"]
			}]
		});

		/** Send response */
		resolve(response?.final_html_data?.[0] || "");
	}).catch(next);
}//End getRestaurantDropdowns()

/**
 * Function to get my fatoorah bank list
 *
 * @param req 		As  Request Data
 * @param res 		As	Response Data
 * @param next		As 	Callback argument to the middleware function
 * @param options	As 	object data
 *
 * @return json
 */
export const getMyFatoorahBankList = (req,res,next,options)=>{
	return new Promise(resolve=>{
		let bankId = options?.bank_id || "";

		const fatoorah_banks = getDb().collection(Tables.FATOORAH_BANKS);
		asyncParallel({
			bank_list : (callback)=>{
				/** Set request options */
				let baseURL	= 	res.locals.settings['Payment.myfatoorah_base_url'];
				let token	= 	res.locals.settings['Payment.myfatoorah_token'];

				/** Get fatoorah bank list */
				axios({
					method: 'GET',
					url: `${baseURL}/v2/GetBanks`,
					headers: {
						Accept: 'application/json',
						Authorization: token,
						'Content-Type': 'application/json'
					}
				})
				.then((response) => {
					if(!response?.data?.length || !response?.data?.constructor != Array) return callback(null);

					let bankIdArray = [];
					asyncEach(response?.data,(records, eachCallback)=>{
						let bankId		= 	(records.Value) ? 	parseInt(records.Value) :0;
						let bankName	=	(records.Text)	?	records.Text			:"";

						if(!bankId) return eachCallback(null);

						bankIdArray.push(bankId);

						/** Update bank details */
						fatoorah_banks.updateOne({
							bank_id : 	bankId,
						},
						{
							$set : {
								name: {
									en : bankName,
									ar : bankName,
								},
								modified: getUtcDate()
							},
							$setOnInsert : {
								created: getUtcDate()
							},
						},{upsert : true}).then(()=>{
							eachCallback(null);
						}).catch(err=>{
							eachCallback(err);
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return callback(asyncEachErr);

						asyncParallel({
							delete_bank : (childCallback)=>{
								if(bankIdArray.length ==0) return childCallback(null);

								/** Delete records whom not come current api response */
								fatoorah_banks.deleteMany({bank_id: {$nin: bankIdArray}}).then(()=>{
									childCallback(null);
								}).catch(err=>{
									childCallback(err);
								});
							},
						},(asyncChildErr)=>{
							callback(asyncChildErr);
						});
					});
				}).catch((error) => {
					console.error('fatoorah bank list, utility, Error:', error.response ? error.response.data : error.message);
					callback(null);
				});
			},
		},(asyncErr)=>{
			if(asyncErr) return next(asyncErr);

			/** get dropdown options for bank list **/
			getDropdownList(req,res,next,{
				collections :[{
					collection : Tables.FATOORAH_BANKS,
					conditions : {},
					selected   : [bankId],
					columns    : ["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]]
				}]
			}).then(response=>{
				if(response.status != Constants.STATUS_SUCCESS) return resolve(response);

				/** Send success response */
				resolve({
					status 	  : Constants.STATUS_SUCCESS,
					bank_list : response?.final_html_data?.["0"] || ""
				});
			}).catch(next);
		});
	}).catch(next);
}//end getMyFatoorahBankList()

/**
 * Function to create supplier on my fatoorah
 *
 * @param req 		As  Request Data
 * @param res 		As	Response Data
 * @param next		As 	Callback argument to the middleware function
 * @param options	As 	object data
 *
 * @return json
 */
export const createSupplierOnMyFatoorah = async (req,res,next,options)=>{
	try{
		let restId			= 	(options.restaurant_id) ?	new ObjectId(options.restaurant_id) :"";
		let bankId 			=	(options.bank_id) ? new ObjectId(options.bank_id) :"";
		let restName		= 	options?.restaurant_name?.[Constants.DEFAULT_LANGUAGE_CODE] || "";
		let restEmail		= 	options?.email ||"";
		let mobileNumber	= 	options?.mobile ||"";
		let bankHolderName	= 	options?.beneficiary ||"";
		let bankAccount		= 	options?.bank_account ||"";
		let bankIban		= 	options?.iban ||"";
		let tmpSettlement	= 	options?.settlement_type ||"";
		let index			= 	options?.index ||"";
		let settlementType	= 	tmpSettlement && Constants.SETTLEMENT_TYPE_OBJECT?.[tmpSettlement] ||"";

		/** Send error response **/
		if(!bankId) return {status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters")};

		const db = 	getDb();
		const restaurants =  db.collection(Tables.RESTAURANTS);
		const restaurant_details = db.collection(Tables.RESTAURANT_DETAILS);
		const fatoorah_banks = 	db.collection(Tables.FATOORAH_BANKS);

		/**  All queries in parallel using object keys */
		const asyncRes = await runTaskParallel({
			rest_data: restId ?
				restaurants.findOne({_id: restId},{projection:{_id:1,supplier_code:1,name:1}}).then(result=> result)
			:null,
			rest_subdetails: restId ?
				restaurant_details.findOne({restaurant_id: restId},{projection: {beneficiary:1,iban:1,bank_account:1,settlement_type:1,bank_id:1}}).then(result=> result)
			:null,
			bank_details:
				fatoorah_banks.findOne({_id: bankId},{projection:{bank_id:1}}).then(result=> result)
		});

		let restData 		= 	asyncRes.rest_data;
		let restSubdetails 	= 	asyncRes.rest_subdetails;
		let bankDetails 	=	asyncRes.bank_details;

		/** Send error response */
		if(!bankDetails) return {status: Constants.STATUS_ERROR, message: res.__("admin.restaurant_enquiry.some_issue_in_create_supplier"), asyncRes: asyncRes};

		let supplierCode	=	(restData)	?	restData.supplier_code	:"";
		let fatoorahBankId 	= 	bankDetails.bank_id;
		let isChanged		=	(!supplierCode)	?	true	:false;
		//if(!bankHolderName && !bankAccount && !bankIban) isChanged = false;

		if(restSubdetails){
			if(restSubdetails.iban && restSubdetails.iban != bankIban) isChanged =true;
			if(restSubdetails.bank_id && String(restSubdetails.bank_id) != String(bankId)) isChanged =true;
			if(restSubdetails.beneficiary && restSubdetails.beneficiary != bankHolderName) isChanged =true;
			if(restSubdetails.bank_account && restSubdetails.bank_account != bankAccount) isChanged =true;
			if(restSubdetails.settlement_type && restSubdetails.settlement_type != tmpSettlement) isChanged =true;
		}

		/** Send success response */
		if(!isChanged) return {status: Constants.STATUS_SUCCESS, supplier_code: supplierCode };

		/** Set request options */
		// let apiName 	=	(supplierCode) ? "EditSupplier" :"CreateSupplier";
		let apiName 	=	"CreateSupplier";
		let baseURL		= 	res.locals.settings['Payment.myfatoorah_base_url'];
		let token		= 	res.locals.settings['Payment.myfatoorah_token'];
		let reqOptions	=	{
			method	: 	'POST',
			url		: 	baseURL+'/v2/'+apiName,
			headers	:	{
				Accept			: 	'application/json',
				Authorization	: 	token,
				'Content-Type'	:	'application/json'
			},
			json: true
		};

		/*if(supplierCode){
			reqOptions.body = {
				SupplierCode			:	supplierCode,
				SupplierName			:	restName,
				Mobile					:	mobileNumber,
				Email					:	restEmail,
				CommissionValue			:	0,
				CommissionPercentage	: 	0,
				DepositTerms			:	settlementType,

				// BankId					:	fatoorahBankId,
				// BankAccountHolderName	:	bankHolderName,
				// BankAccount				:	bankAccount,
				// Iban					:	bankIban,
			};
		}else{*/
			reqOptions.body = {
				SupplierName			:	restName,
				Mobile					:	mobileNumber,
				Email					:	restEmail,
				BankId					:	fatoorahBankId,
				BankAccountHolderName	:	bankHolderName,
				BankAccount				:	bankAccount,
				Iban					:	bankIban,
				CommissionValue			:	0,
				CommissionPercentage	: 	0,
				IsActive				:	true,
				DepositTerms			:	settlementType,
			};
		// }

		/** create fatoorah supplier */
		const response = await axios(reqOptions);

		const body = response?.data || null;

		/** Save myfatoorah logs */
		saveMyFatoorahLogs(req,res,next,{
			restaurant_id 	:	restId,
			request			:	reqOptions,
			response		:	body,
		}).then(()=>{ });

		if(!body || body.constructor != Object || Object.keys(body).length  == 0){
			return {status: Constants.STATUS_ERROR, message: res.__("admin.restaurant_enquiry.some_issue_in_create_supplier"), body: body, options: options };
		}

		let isSuccess		=	body?.IsSuccess || null;
		let fieldsErrors	=	body?.FieldsErrors || null;
		let successData		=	body?.Data || null;
		let tmpSupplierCode	=	(successData && successData.SupplierCode) ? successData.SupplierCode :"";
		let errorsList		=	[];

		/** Manage errors */
		if(fieldsErrors && fieldsErrors.constructor == Array && fieldsErrors.length >0){
			fieldsErrors.map(records=>{
				if(records.Name == "BankId"){
					let tmpId = (index) ? "bank_id_"+index : "bank_id";
					errorsList.push({param: tmpId, msg: records.Error });
				}else if(records.Name == "IbanValue"){
					let tmpId = (index) ? "iban_"+index : "iban";
					errorsList.push({param: tmpId, msg: records.Error });
				}else if(records.Name == "DepositTerms"){
					let tmpId = (index) ? "settlement_type_"+index : "settlement_type";
					errorsList.push({param: tmpId, msg: records.Error });
				}else{
					errorsList.push({param: Constants.ADMIN_GLOBAL_ERROR, msg: records.Error });
				}
			});
		}

		/** Send error response */
		if(!isSuccess) return {status: Constants.STATUS_ERROR, message: errorsList, options: options, body: body };
		if(!successData || !tmpSupplierCode) {
			return {status: Constants.STATUS_ERROR, message: res.__("admin.restaurant_enquiry.some_issue_in_create_supplier"), options: options, body: body };
		}

		let successRes = {status: Constants.STATUS_SUCCESS, supplier_code: tmpSupplierCode, supplier_code_response: JSON.stringify(successData), options: options, body: body };

		if(!restId) return successRes;

		/** Save  restaurant supplier code */
		await restaurants.updateOne({
			_id: restId
		},
		{$set: {
			supplier_code			: tmpSupplierCode,
			supplier_code_response	: JSON.stringify(successData),
		}});

		/** Send success response */
		return successRes;
	}catch(err){
		console.error('createSupplierOnMyFatoorah, utility, Error:', err.response ? err.response.data : err.message);

		return {status: Constants.STATUS_ERROR, message: res.__("admin.restaurant_enquiry.some_issue_in_create_supplier"), err};
	}
}//end createSupplierOnMyFatoorah()

/**
 * Function to save my fatoorah logs
 *
 * @param req		As Request Data
 * @param res		As Response Data
 * @param next		As Callback argument to the middleware function
 *
 * @return json
 */
export const saveMyFatoorahLogs = (req,res,next,options)=>{
	return new Promise(resolve=>{
		/** Save payment gateway logs  **/
		const myfatoorah_logs = getDb.collection(Tables.MYFATOORAH_LOGS);
		myfatoorah_logs.insertOne({
			restaurant_id 	:	options.restaurant_id,
			request			:	options.request,
			response		:	options.response,
			created 		: 	getUtcDate()
		}).then(()=>{
			resolve({status : Constants.STATUS_SUCCESS});
		}).catch(next);
	}).catch(next);
};//End saveMyFatoorahLogs()