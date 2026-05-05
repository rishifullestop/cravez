import { ObjectId } from 'mongodb';
import clone from 'clone';
import axios from "axios";
import https from "https";
import { xml2json } from 'xml-js';
import jsontoxml from 'jsontoxml';
import { parallel as asyncParallel, each as asyncEach, eachOfSeries, forEachOf as asyncForEachOf  } from 'async';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from '../../../../utils/index.mjs';
import cronModal from '../../crons/model/cron.mjs';

const PIZZA_HUT 					= 	"pizza-hut";
const BURGER_KING					= 	"burger-king";
const SOAP_LICENCE_KEY				= 	Constants.KFG_SOAP_LICENCE_KEY;
const BURGER_KING_MENU_ID			=	3;
const PIZZA_HUT_MENU_ID				= 	4;
const ORDER_PLACE_DOB_DATE_FORMAT	= 	"yyyy-mm-dd'T'00:00:00";
const ORDER_PLACE_DATE_FORMAT		= 	"yyyy-mm-dd'T'HH:MM:ss";
const ORDER_SUCCESS_CODE			= 	200;


const KFG_ORDER_STATUS 	=	{};
KFG_ORDER_STATUS[1] 	= 	{label: "Initial", status: Constants.ORDER_PENDING };
KFG_ORDER_STATUS[2]		= 	{label: "Open", status: Constants.ORDER_PENDING };
KFG_ORDER_STATUS[22]	=	{label: "Unknown", status: Constants.ORDER_PENDING };
KFG_ORDER_STATUS[9]		=	{label: "Suspended", status: Constants.ORDER_PENDING };
KFG_ORDER_STATUS[4]		=	{label: "Bumped", status: Constants.ORDER_PREPARING };
KFG_ORDER_STATUS[3]		=	{label: "In Kitchen", status: Constants.ORDER_PREPARING };
KFG_ORDER_STATUS[5]		=	{label: "Ready", status: Constants.ORDER_READY_TO_PICK_UP};
KFG_ORDER_STATUS[6]		=	{label: "Assigned", status:Constants.ORDER_READY_TO_PICK_UP};
KFG_ORDER_STATUS[7]		=	{label: "Dispatched", status: Constants.ORDER_ON_THE_WAY };
KFG_ORDER_STATUS[10]	=	{label: "Future", status: Constants.ORDER_SCHEDULED };
KFG_ORDER_STATUS[23]	=	{label: "Force Closed", status: Constants.ORDER_DELIVERED };
KFG_ORDER_STATUS[8]		=	{label: "Delivered", status: Constants.ORDER_DELIVERED };
KFG_ORDER_STATUS[19]	=	{label: "Closed", status: Constants.ORDER_DELIVERED };
KFG_ORDER_STATUS[24]	=	{label: "Request for cancel",status:Constants.ORDER_REJECTED};
KFG_ORDER_STATUS[20]	=	{label: "Failure", status: Constants.ORDER_REJECTED };
KFG_ORDER_STATUS[25]	=	{label: "Force Cancel", status: Constants.ORDER_REJECTED };
KFG_ORDER_STATUS[21]	=	{label: "Canceled", status: Constants.ORDER_REJECTED };

const UPSELL_TYPE_OBJECT = {};
UPSELL_TYPE_OBJECT[0] = {en :"Go Regular", ar : "الحجم العادي"};
UPSELL_TYPE_OBJECT[1] = {en :"Go Mega", ar : "الحجم الميجا"};
UPSELL_TYPE_OBJECT[2] = {en :"Go King", ar : 'الحجم الكنج'};

const respnoseCodes = {
	"000" : {
		ResponseCode : "000",
		ResponseDesc : "Success"
	},
	"001" : {
		ResponseCode : "001",
		ResponseDesc : "Invalid xml format"
	},
	"002" : {
		ResponseCode : "002",
		ResponseDesc : "Application error"
	},
	"003" : {
		ResponseCode : "003",
		ResponseDesc : "Time out"
	},
	"004" : {
		ResponseCode : "004",
		ResponseDesc : "Records already exists."
	},
	"005" : {
		ResponseCode : "005",
		ResponseDesc : "Items don't exist."
	}
};

/* Sample response
	ResponseCode	ResponseDesc
	000				Success
	001				Invalid xml format
	002				Application error
	003				Time out error
	004				Business validation errors (value changes based on error)
*/

export default class Soap {
    constructor(db) {
        this.db = db;

		this.cronModule  = new cronModal(db);
    }

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async RefreshReasons(params){
		return new Promise(resolve=>{
			resolve({
				ResponseCode : "000",
				ResponseDesc : "Success"
			});
		});
	};//End RefreshReasons()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async RefreshDistrictAreaMap(params){
		return new Promise(resolve=>{
			resolve({
				ResponseCode : "000",
				ResponseDesc : "Success"
			});
		});
	};//End RefreshDistrictAreaMap()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async RefreshNationalities(params){
		return new Promise(resolve=>{
			resolve({
				ResponseCode : "000",
				ResponseDesc : "Success"
			});
		});
	};//End RefreshNationalities()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async RefreshProvinces(params){
		return new Promise(resolve=>{
			resolve({
				ResponseCode : "000",
				ResponseDesc : "Success"
			});
		});
	};//End RefreshProvinces()

	/**
	 * Function to Get Provinces
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getProvinces(req, res,next,client){
		return new Promise(resolve=>{
			let countryId	= req.params.country_id;
			client["GetProvinces"]({LicenceKey: SOAP_LICENCE_KEY, CountryId: countryId},(err, response)=>{
				if (err) throw err;
				let apiData		= (response && response.GetProvincesResult) ? response.GetProvincesResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetProvinces",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY, CountryId: countryId},
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				if(jsonData.Provinces.Province.constructor != Array ){
					let tempObj = jsonData.Provinces.Province;
					jsonData.Provinces.Province = [];
					jsonData.Provinces.Province.push(tempObj);
				}

				const cravez_provinces = db.collection("cravez_provinces");
				asyncEach(jsonData.Provinces.Province,(data,asyncEachcallback)=>{
					/** Save details **/
					cravez_provinces.updateOne({
						cravez_province_id : parseInt(data.ProvinceId._text),
						cravez_country_id 	: parseInt(data.CountryId._text),
					},
					{
						$set : {
							name			: data.ProvinceName._text,
							modified		: getUtcDate(),
						},
						$setOnInsert: {
							channel_id		: CHANNEL_SOAP,
							created			: getUtcDate(),
							kfg				: true
						}
					},{upsert: true},(updateErr) => {
						asyncEachcallback(updateErr);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return resolve({status: STATUS_ERROR,message : asyncEachErr });

					resolve({status : STATUS_SUCCESS});
				});
			});
		}).catch(next);
	};//End getProvinces()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async RefreshDistricts(params){
		return new Promise(resolve=>{
			resolve({
				ResponseCode : "000",
				ResponseDesc : "Success"
			});
		});
	};//End RefreshDistricts()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async RefreshCountries(params){
		return new Promise(resolve=>{
			resolve({
				ResponseCode : "000",
				ResponseDesc : "Success"
			});
		});
	};//End RefreshCountries()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async RefreshStreets(params){
		return new Promise(resolve=>{
			resolve({
				ResponseCode : "000",
				ResponseDesc : "Success"
			});
		});
	};//End RefreshStreets()

	/**
	 * Function to refresh cities
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async RefreshCities(params){
		return new Promise(resolve=>{
			axios({
				method: "GET",
				url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
				params: {
					method_name: "RefreshCities",
					response: params
				},
				httpsAgent: new https.Agent({
					rejectUnauthorized: false
				})
			}).catch(() => {});

			axios.get(Constants.WEBSITE_URL + "get_all_cities_from_provinces", {
				httpsAgent: new https.Agent({
					rejectUnauthorized: false
				})
			}).then(() => {
				resolve({
					ResponseCode: "000",
					ResponseDesc: "Success"
				});
			}).catch(() => {
				resolve({
					ResponseCode: "000",
					ResponseDesc: "Success"
				});
			});
		});
	};//End RefreshCities()

	/**
	 * Function to get all cities of all provinces
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getAllCities(req, res,next){
		return new Promise(resolve=>{
			const cravez_provinces = db.collection("cravez_provinces");
			cravez_provinces.distinct("cravez_province_id",{cravez_province_id : {$exists : true}},(err,provinceIds)=>{
				if(err) return next(err);
				if(provinceIds && provinceIds.length == 0) return resolve({status : STATUS_SUCCESS, message : "No province found"});

				asyncEach(provinceIds,(recordId,callback)=>{
					let curlURL = Constants.WEBSITE_URL+'get_cities/'+recordId;
					axios.get(curlURL, {
						httpsAgent: new https.Agent({
							rejectUnauthorized: false
						})
					}).then(() => {
						callback(null);
					}).catch(error => {
						callback(error);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return resolve({status : STATUS_ERROR , error : asyncEachErr});
					resolve({status : STATUS_SUCCESS});
				});
			});
		});
	};//End getAllCities()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async GetCities(req, res,next,client){
		return new Promise(resolve=>{
			try{
				/** Call service */
				let provinceId	= req.params.province_id;
				client["GetCities"]({LicenceKey: SOAP_LICENCE_KEY, ProvinceId: provinceId},(err, response)=>{
					if (err) return next(err);

					let apiData	= (response && response.GetCitiesResult) ? response.GetCitiesResult :"";

					/** Save kfg request response */
					this.saveKFGRequestResponse(req,res,next,{
						method_name :	"GetCities",
						response	: 	response,
						request		:	{LicenceKey: SOAP_LICENCE_KEY,ProvinceId:provinceId},
					}).then(()=>{});

					/** Send error response */
					if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

					let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
					let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

					if(!jsonData.Cities || !jsonData.Cities.City) return resolve({status: STATUS_SUCCESS, message : "Something went wrong, Please try again." });

					if(jsonData.Cities.City.constructor != Array ){
						let tempObj = jsonData.Cities.City;
						jsonData.Cities.City = [];
						jsonData.Cities.City.push(tempObj);
					}

					if(jsonData.Cities.City.length == 0) return resolve({status : STATUS_SUCCESS, message : "No City found."});

					const cravez_cities = db.collection("cravez_cities");
					asyncEach(jsonData.Cities.City,(data,asyncEachcallback)=>{

						/** Save details **/
						cravez_cities.updateOne({
							cravez_city_id : parseInt(data.CityId._text)
						},
						{
							$set : {
								cravez_country_id 	: parseInt(data.CountryId._text),
								cravez_province_id 	: parseInt(data.ProvinceId._text),
								name: {
									en: data.CityName._text,
									ar: data.CityNameARB._text
								},
								modified: getUtcDate(),
							},
							$setOnInsert: {
								country_id		: COUNTRY_ID,
								channel_id		: CHANNEL_SOAP,
								created			: getUtcDate(),
								kfg				: true
							}
						},{upsert: true},(updateErr) => {
							asyncEachcallback(updateErr);
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return resolve(respnoseCodes["002"]);
						resolve(respnoseCodes["000"]);
					});
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			};
		}).catch(next);
	};//End GetCities()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async RefreshAreas(params){
		return new Promise(resolve=>{
			axios({
				method: "GET",
				url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
				params: {
					method_name: "RefreshAreas",
					response: params
				},
				httpsAgent: new https.Agent({
					rejectUnauthorized: false
				})
			}).catch(() => {});

			axios.get(Constants.WEBSITE_URL + "get_all_area_from_cities", {
				httpsAgent: new https.Agent({
					rejectUnauthorized: false
				})
			}).then(() => {
				resolve({
					ResponseCode: "000",
					ResponseDesc: "Success"
				});
			}).catch(() => {
				resolve({
					ResponseCode: "000",
					ResponseDesc: "Success"
				});
			});
		});
	};//End RefreshAreas()

	/**
	 * Function to get all areas of all cities
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getAllAreas(req, res,next){
		return new Promise(resolve=>{
			const cravez_cities = db.collection("cravez_cities");
			cravez_cities.distinct("cravez_city_id",{cravez_city_id :{$exists : true}},(err,cityIds)=>{
				if(err) return next(err);
				if(cityIds && cityIds.length == 0) return resolve({status : STATUS_SUCCESS, message : "No city found."});

				asyncEach(cityIds,(recordId,callback)=>{
					let curlURL = Constants.WEBSITE_URL+'get_areas/'+recordId;
					axios.get(curlURL, {
						httpsAgent: new https.Agent({
							rejectUnauthorized: false
						})
					}).then(() => {
						callback(null);
					}).catch(error => {
						callback(error);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return next(asyncEachErr);
					resolve({status : STATUS_SUCCESS});
				});
			});
		});
	};//End getAllAreas()

	/**
	 * Function to get areas
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getAreas(req, res,next,client){
		return new Promise(resolve=>{
			/** Call service */
			let cityId	= req.params.city_id;
			client["GetAreas"]({LicenceKey: SOAP_LICENCE_KEY, CityId: cityId, },(err, response)=>{
				if (err) throw err;

				let apiData	= (response && response.GetAreasResult) ? response.GetAreasResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetAreas",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY,CityId:cityId},
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				if(!jsonData.Areas || !jsonData.Areas.Area) return resolve({status: STATUS_SUCCESS, message : "Something went wrong, Please try again.", jsonData: jsonData });

				if(jsonData.Areas.Area.constructor != Array ){
					let tempObj = jsonData.Areas.Area;
					jsonData.Areas.Area = [];
					jsonData.Areas.Area.push(tempObj);
				}

				if(jsonData.Areas.Area.length == 0) return resolve({status : STATUS_SUCCESS, message : "No Area found.", jsonData: jsonData });

				const cravez_areas	=	db.collection("cravez_areas");
				const cravez_cities	= 	db.collection("cravez_cities");
				asyncEach(jsonData.Areas.Area,(data,asyncEachcallback)=>{
					let cravezCityId = parseInt(data.CityId._text);
					asyncParallel({
						city_id : (parellelCallback)=>{
							cravez_cities.findOne({cravez_city_id : cravezCityId},{projection:{_id:1}},(err,result)=>{
								let cityId = (result) ? result._id : "";
								parellelCallback(err,cityId);
							});
						},
					},(parallelErr,asyncReponse)=>{
						if(parallelErr) return asyncEachcallback(parallelErr);

						/** Save details **/
						cravez_areas.updateOne({
							cravez_area_id : parseInt(data.AreaId._text)
						},
						{
							$set : {
								cravez_country_id 	: data.CountryId._text,
								cravez_province_id 	: data.ProvinceId._text,
								cravez_city_id 		: cravezCityId,
								cravez_street_id 	: data.StreetId._text,
								cravez_district_id 	: data.DistrictId._text,
								name: {
									en: data.AreaName._text,
									ar: data.AreaNameARB._text
								},
								modified: getUtcDate(),
							},
							$setOnInsert: {
								city_id		: (asyncReponse.city_id) ? ObjectId(asyncReponse.city_id) :"",
								is_active	: ACTIVE,
								channel_id	: CHANNEL_SOAP,
								created		: getUtcDate(),
								kfg			: true
							}
						},{upsert: true},(updateErr) => {
							asyncEachcallback(updateErr);
						});
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return resolve({status: STATUS_SUCCESS, message : "Something went wrong, Please try again.", asyncEachErr: asyncEachErr });
					resolve(respnoseCodes["000"]);
				});
			});
		});
	};//End getAreas()

	/**
	 * Function to refresh stores
	 *
	 * @param options As Parameters
	 *
	 * @return json
	 */
	async RefreshStoreData(options){
		return new Promise(resolve=>{
			/** Save Kfg logs */
			axios({
				method: "GET",
				url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
				params: {
					method_name: "RefreshStoreData",
					response: options.params
				},
				httpsAgent: new https.Agent({
					rejectUnauthorized: false
				})
			}).catch(() => {});

			let params = options.params;
			let missingParameters = [];
			if(!params.ConceptId) missingParameters.push("ConceptId");

			if(missingParameters.length>0) return resolve({
				ResponseCode : "004",
				ResponseDesc : "Missing "+missingParameters.join(", ")
			});

			axios.get(Constants.WEBSITE_URL + "get_store_data/"+params.ConceptId, {
				httpsAgent: new https.Agent({
					rejectUnauthorized: false
				})
			}).then(() => {
				resolve({
					ResponseCode: "000",
					ResponseDesc: "Success"
				});
			}).catch(() => {
				resolve({
					ResponseCode: "000",
					ResponseDesc: "Success"
				});
			});
		});
	};//End RefreshStoreData()

	/**
	 * Function to update store data
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async UpdateStoreData(options){
		return new Promise(resolve=>{
			try{
				/** Save Kfg logs */
				axios({
					method: "GET",
					url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
					params: {
						method_name: "UpdateStoreData",
						response: options.params
					},
					httpsAgent: new https.Agent({
						rejectUnauthorized: false
					})
				}).catch(() => {});

				let params = options.params;
				let missingParameters = [];
				if(!params.ConceptId) missingParameters.push("ConceptId");
				if(!params.XMLInput) missingParameters.push("XMLInput");

				if(missingParameters.length>0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingParameters.join(", ")
				});
				if(!params.XMLInput || !params.XMLInput.STORES || !params.XMLInput.STORES.STORE) return resolve(respnoseCodes["001"]);

				if(params.XMLInput.STORES.STORE.constructor != Array ){
					let tempObj = params.XMLInput.STORES.STORE;
					params.XMLInput.STORES.STORE = [];
					params.XMLInput.STORES.STORE.push(tempObj);
				}

				/** validate data*/
				let missingData		= [];
				params.XMLInput.STORES.STORE.map(record =>{
					if(record._attributes){
						if(!record._attributes.STOREID)    	missingData.push("STOREID");
						if(!record._attributes.STORENAME) 	missingData.push("STORENAME");
						if(!record._attributes.STOREPHONE)	missingData.push("STOREPHONE");
						if(!record._attributes.STARTTIME)  	missingData.push("STARTTIME");
						if(!record._attributes.ENDTIME)	  	missingData.push("ENDTIME");
						if(!record._attributes.AREAID) 	  	missingData.push("AREAID");
					}else{
						missingData.push("STOREID, STORENAME, STOREPHONE, STARTTIME, ENDTIME, AREAID");
					}
				});

				if(missingData.length > 0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingData.join(", ")
				});

				let adminId		= 	options.super_admin_details._id;
				let restSlug 	= 	params.MenuId == PIZZA_HUT_MENU_ID ? PIZZA_HUT : BURGER_KING;
				let restId	 	=	ObjectId(options.concept_ids[params.ConceptId]._id);

				const areas 							= db.collection("areas");
				const cravez_areas 						= db.collection("cravez_areas");
				const restaurant_branches 				= db.collection("restaurant_branches");
				const restaurant_branch_areas 			= db.collection("restaurant_branch_areas");
				const restaurant_branch_calendars 		= db.collection("restaurant_branch_calendars");
				const restaurant_branch_phone_numbers 	= db.collection("restaurant_branch_phone_numbers");
				const restaurant_branch_area_settings 	= db.collection("restaurant_branch_area_settings");

				asyncParallel({
					cravez_area_list : (asyncCallback)=>{
						/** Get cravez areas list */
						cravez_areas.find({},{projection:{cravez_area_id:1,area_id:1}}).toArray((err,result)=>{
							if(err || result.length==0) return asyncCallback(err, {});

							let tmpAreaObj = {};
							result.map(records=>{
								if(records.cravez_area_id){
									tmpAreaObj[records.cravez_area_id] = records;
								}
							});
							asyncCallback(err, tmpAreaObj);
						});
					},
				},(parallelErr,asyncParellelReponse)=>{
					if(parallelErr) return resolve(respnoseCodes["002"]);

					let areaObj = asyncParellelReponse.cravez_area_list;
					eachOfSeries(params.XMLInput.STORES.STORE,(data, dataIndex, asyncEachcallback)=>{
						data 			 =	data._attributes;
						let intBrId 	 = 	parseInt(data.STOREID);
						let strBrId 	 = 	String(data.STOREID);
						let kfgAreaId 	 = 	data.AREAID;
						let cravezAreaId =	(kfgAreaId && areaObj[kfgAreaId] && areaObj[kfgAreaId].area_id) ? areaObj[kfgAreaId].area_id :"";

						/** get unique Id Response **/
						asyncParallel({
							unique_id : (parellelCallback)=>{
								/** get unique Id Response **/
								this.getUniqueId({type:"restaurant_branches"}).then(uniqueIdResponse=>{
									let uniqueId = (uniqueIdResponse.result) ? uniqueIdResponse.result :"";
									parellelCallback(null,uniqueId);
								});
							},
							branch_id : (parellelCallback)=>{
								restaurant_branches.findOne({
									restaurant_id 	:	restId,
									kfg_store_id 	:	{$in: [intBrId, strBrId]}
								},{projection: {_id : 1}},(brErr,brResult)=>{
									let storeId	= (brResult) ? ObjectId(brResult._id) :"";
									parellelCallback(brErr,storeId);
								});
							},
							city_id : (parentCallback)=>{
								if(!cravezAreaId) return parentCallback(null, "");

								areas.findOne({_id : cravezAreaId},{projection : {city_id: 1}},(errs,result)=>{
									let cityId	= (result) ? result.city_id :"";
									parentCallback(errs,cityId);
								});
							},
						},(parallelErr,asyncReponse)=>{
							if(parallelErr) return asyncEachcallback(parallelErr);

							if(!asyncReponse.branch_id) return asyncEachcallback(null);

							let branchId 		=	asyncReponse.branch_id;
							let startTime		= 	(data.PICKUPSTARTTIME) 		?	parseFloat(data.PICKUPSTARTTIME.replace(':','.'))	:0;
							let endTime			= 	(data.PICKUPENDTIME) 		? 	parseFloat(data.PICKUPENDTIME.replace(':','.')) 	:0;
							let promiseTime		=	(data.PROMISETIME) 			? 	parseFloat(data.PROMISETIME)						:0;
							let deliveryFess	=	(data.SERVICECHARGE) 		?	parseFloat(data.SERVICECHARGE)						:0;
							let brLongitude		=	(data.LONGITUDE)			?	parseFloat(data.LONGITUDE)							:0
							let brLatitude		=	(data.LATITUDE)				?	parseFloat(data.LATITUDE)							:0
							let areaAttributes 	=	{};
							areaAttributes[ACCEPT_PICKUP_ORDER] 			= 	ACTIVE;
							areaAttributes[ACCEPT_SCHEDULING_ATTRIBUTE_ID] 	= 	ACTIVE;
							areaAttributes[MINIMUM_ORDER_LIMIT_ATTRIBUTE_ID]= 	0;
							areaAttributes[DELIVERY_ATTRIBUTE_ID] 			= 	DELIVERY_BY_RESTAURANT;
							areaAttributes[DELIVERY_FEES_ATTRIBUTE_ID] 		= 	deliveryFess;
							areaAttributes[DELIVERY_DURATION_ATTRIBUTE_ID] 	=	promiseTime;

							asyncParallel({
								save_store_data : (childCallback)=>{
									restaurant_branches.updateOne({
										_id : branchId,
									},
									{
										$set : {
											name: {
												en: data.STORENAME,
												ar: (data.STORENAMEARB) ? data.STORENAMEARB :data.STORENAME
											},
											area_id					: cravezAreaId,
											city_id					: asyncReponse.city_id,
											address					: data.STOREADDRESS,
											kfg_store_country_id	: data.COUNTRYID,
											kfg_store_province_id	: data.PROVINCEID,
											kfg_store_menu_id		: data.MENUID,
											kfg_store_district_id	: data.DISTRICTID,
											kfg_store_area_id		: data.AREAID,
											kfg_store_city_id		: data.CITYID,
											kfg_store_concept_id	: data.CONCEPTID,
											kfg_store_street_id		: data.STREETID,
											kfg_store_zone_id		: data.ZONEID,
											kfg_store_number		: data.STORENUMBER,
											promise_time			: promiseTime,
											pickup_start_time		: startTime,
											pickup_end_time			: endTime,
											modified				: getUtcDate(),
											is_active				: (data.STORESTATUS) ? parseInt(data.STORESTATUS) :0,
											service_charge			: deliveryFess,
											longitude				: brLongitude,
											latitude				: brLatitude,
											long_lat				: [brLongitude, brLatitude],
										}
									},(updateErr) => {
										childCallback(updateErr);
									});
								},
								phone_number : (childCallback)=>{
									if(!data.STOREPHONE) return childCallback(null);

									restaurant_branch_phone_numbers.updateOne({
										branch_id	: branchId,
										value		: data.STOREPHONE
									},
									{
										$set : {
											modified: getUtcDate(),
										},
										$setOnInsert: {
											added_by		: adminId,
											channel_id		: CHANNEL_SOAP,
											attribute_id	: BRANCH_CUSTOMER_SERVICE_NUMBER_ATTRIBUTE_ID,
											created			: getUtcDate(),
											kfg_store		: true,
											restaurant_slug	: restSlug,
											restaurant_id	: restId,
											country_code	: DEFAULT_COUNTRY_CODE,
											concept_id		: params.ConceptId,
										}
									},{upsert: true},(updateErr) => {
										childCallback(updateErr);
									});
								},
								phone_number_2 : (childCallback)=>{
									if(!data.STOREPHONE2) return childCallback(null);

									restaurant_branch_phone_numbers.updateOne({
										branch_id	: branchId,
										value		: data.STOREPHONE2
									},
									{
										$set : {
											modified: getUtcDate(),
										},
										$setOnInsert: {
											added_by		: adminId,
											channel_id		: CHANNEL_SOAP,
											attribute_id	: BRANCH_CUSTOMER_SERVICE_NUMBER_ATTRIBUTE_ID,
											created			: getUtcDate(),
											kfg_store		: true,
											restaurant_slug	: restSlug,
											restaurant_id	: restId,
											country_code	: DEFAULT_COUNTRY_CODE,
											concept_id		: params.ConceptId,
										}
									},{upsert: true},(updateErr) => {
										childCallback(updateErr);
									});
								},
								calender : (childCallback)=>{
									let fromHour 	= (data.STARTTIME) ? data.STARTTIME.split(":")[0] : 0;
									let fromMinute	= (data.STARTTIME) ? data.STARTTIME.split(":")[1] : 0;
									let toHour 		= (data.ENDTIME) ? data.ENDTIME.split(":")[0] : 0;
									let toMinute	= (data.ENDTIME) ? data.ENDTIME.split(":")[1] : 0;

									restaurant_branch_calendars.updateOne({
										branch_id	: branchId,
									},
									{
										$set : {
											from_hour	: parseInt(fromHour),
											from_minute	: parseInt(fromMinute),
											status		: OPEN,
											to_hour		: parseInt(toHour),
											to_minute	: parseInt(toMinute),
											type		: DEFAULT_WEEK
										},
										$setOnInsert: {
											added_by		: adminId,
											channel_id		: CHANNEL_SOAP,
											created			: getUtcDate(),
											is_exception	: false,
											kfg_store		: true,
											parent_id		: "",
											restaurant_slug	: restSlug,
											restaurant_id	: restId,
										}
									},{upsert: true},(updateErr) => {
										childCallback(updateErr);
									});
								},
								branch_area_attributes : (childCallback)=>{
									asyncEach(Object.keys(areaAttributes),(attrId, eachSubCallback)=>{
										attrId = parseInt(attrId);

										asyncParallel({
											branch_area_setting : (childSubCallback)=>{
												restaurant_branch_area_settings.updateMany({
													branch_id		: 	branchId,
													attribute_id	:	{$in: [String(attrId),attrId ]}
												},
												{$set : {
													attribute_value	: areaAttributes[attrId],
													modified		: getUtcDate(),
												}},(updateErr) => {
													childSubCallback(updateErr);
												});
											},
											branch_area : (childSubCallback)=>{
												let branchAreaFields = setBranchAreaFields(attrId, areaAttributes[attrId]);

												if(!branchAreaFields) return childSubCallback(null);

												/** Update area */
												restaurant_branch_areas.updateMany({branch_id: branchId },{$set: branchAreaFields},(updateErr) => {
													childSubCallback(updateErr);
												});
											},
										},(parallelErrs)=>{
											eachSubCallback(parallelErrs);
										});
									},(asyncParallel)=>{
										childCallback(asyncParallel);
									});
								},
							},(parallelErrs)=>{
								asyncEachcallback(parallelErrs);

								/** Update branch calender*/
								axios({
									method: "GET",
									url: Constants.WEBSITE_URL + "update_kfg_branch_calender/"+branchId,
									httpsAgent: new https.Agent({
										rejectUnauthorized: false
									})
								}).catch(() => {});
							});
						});
					},(asyncEachErr)=>{
						/** Assign menu to branch  **/
						this.assignMenuToBranch({restaurant_id: restId});

						if(asyncEachErr) return resolve(respnoseCodes["002"]);
						resolve(respnoseCodes["000"]);
					});
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			}
		});
	};//End UpdateStoreData()

	/**
	 * Function to get store data
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getStoreData  (req, res,next,client){
		return new Promise(resolve=>{
			let conceptId		= (req.params.concept_id) ? req.params.concept_id :0;
			let storeId			= (req.params.store_id) ? req.params.store_id :"";
			let apiFunction		= "GetStoreData";
			let apiResponseKey	= "GetStoreDataResult";
			let apiOptions		= {LicenceKey: SOAP_LICENCE_KEY, ConceptId: conceptId };
			if(storeId){
				apiFunction			= "GetStoreById";
				apiResponseKey		= "GetStoreByIdResult";
				apiOptions.StoreId	= storeId;
			}

			/** Call service */
			client[apiFunction](apiOptions,(err, response)=>{
				if (err) throw err;
				let apiData	= (response && response[apiResponseKey]) ? response[apiResponseKey] :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	apiFunction,
					response	: 	response,
					request		:	apiOptions,
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				const restaurant_branches 				= db.collection("restaurant_branches");
				const restaurant_branch_phone_numbers 	= db.collection("restaurant_branch_phone_numbers");
				const restaurant_branch_calendars 		= db.collection("restaurant_branch_calendars");
				const restaurant_branch_attributes 		= db.collection("restaurant_branch_attributes");
				const restaurant_branch_area_settings 	= db.collection("restaurant_branch_area_settings");
				const restaurant_branch_areas 			= db.collection("restaurant_branch_areas");
				const restaurant_branch_payment_methods	= db.collection("restaurant_branch_payment_methods");
				const areas 							= db.collection("areas");
				const users								= db.collection("users");
				const attributes						= db.collection("attributes");
				const restaurants						= db.collection("restaurants");
				const payment_methods					= db.collection("payment_methods");

				asyncParallel({
					restaurant : (parellelCallback)=>{
						restaurants.findOne({concept_id : parseInt(req.params.concept_id)},{projection:{_id:1,slug:1}},(err,result)=>{
							parellelCallback(err,result);
						});
					},
					admin_id : (parellelCallback)=>{
						users.findOne({user_role_id : CRAVEZ},{projection:{_id:1}},(err,result)=>{
							let adminId = (result) ? ObjectId(result._id) : "";
							parellelCallback(err,adminId);
						});
					},
					payment_methods : (parellelCallback)=>{
						payment_methods.distinct("slug",{},(payErr, payResult)=>{
							parellelCallback(payErr,payResult);
						});
					},
					attributes_list : (parellelCallback)=>{
						attributes.find({type : "branch_attributes"},{projection : {attribute_id : 1,default_value : 1}}).toArray((error,attributeResult)=>{
							parellelCallback(error,attributeResult);
						});
					},
					cravez_area_list : (parellelCallback)=>{
						/** Get cravez areas list */
						const cravez_areas = db.collection("cravez_areas");
						cravez_areas.find({},{projection:{_id: 1, cravez_area_id:1,area_id:1,block_id:1}}).toArray((err,result)=>{
							if(err || result.length<=0) return parellelCallback(err, null);

							let tmpAreaObj = {};
							result.map(records=>{
								if(records.cravez_area_id){
									tmpAreaObj[records.cravez_area_id] = records;
								}
							});
							parellelCallback(err, tmpAreaObj);
						});
					},
				},(parallelErr,asyncParellelReponse)=>{
					if(parallelErr) return next(parallelErr);

					if(!asyncParellelReponse.restaurant) return resolve({status : STATUS_ERROR,message : "Concept id is not valid."});

					if(!asyncParellelReponse.attributes_list || asyncParellelReponse.attributes_list.length <= 0) return resolve({status : STATUS_ERROR, message : "Attributes not found"});

					if(jsonData.Stores.Store.constructor != Array ){
						let tempObj = jsonData.Stores.Store;
						jsonData.Stores.Store = [];
						jsonData.Stores.Store.push(tempObj);
					}

					let restaurantId 		= 	ObjectId(asyncParellelReponse.restaurant._id);
					let restaurantSlug 		= 	asyncParellelReponse.restaurant.slug;
					let attributesList 		=	asyncParellelReponse.attributes_list;
					let cravezAreaList 		=	asyncParellelReponse.cravez_area_list;
					let allPaymentMethods 	=	asyncParellelReponse.payment_methods;

					asyncParallel({
						bracnch_delete : (subCallback)=>{
							restaurant_branches.updateMany({
								restaurant_id : restaurantId
							},
							{$set: {
								to_be_deleted	: 	true,
								modified 		:	getUtcDate(),
							}},(updateErr)=>{
								subCallback(updateErr);
							});
						},
						phone_number_delete : (subCallback)=>{
							restaurant_branch_phone_numbers.updateMany({
								restaurant_id : restaurantId
							},
							{$set: {
								to_be_deleted	: 	true,
								modified 		:	getUtcDate(),
							}},(updateErr)=>{
								subCallback(updateErr);
							});
						},
						branch_calendars_delete : (subCallback)=>{
							restaurant_branch_calendars.updateMany({
								restaurant_id : restaurantId
							},
							{$set: {
								to_be_deleted	: true,
								modified 		: getUtcDate(),
							}},(updateErr)=>{
								subCallback(updateErr);
							});
						},
						branch_attributes_delete : (subCallback)=>{
							restaurant_branch_attributes.updateMany({
								restaurant_id : restaurantId
							},
							{$set: {
								to_be_deleted	: true,
								modified 		: getUtcDate(),
							}},(updateErr)=>{
								subCallback(updateErr);
							});
						},
						payment_methods_delete : (subCallback)=>{
							restaurant_branch_payment_methods.updateMany({
								restaurant_id : restaurantId
							},
							{$set: {
								to_be_deleted	: true,
								modified 		: getUtcDate(),
							}},(updateErr)=>{
								subCallback(updateErr);
							});
						},
					},(parallelErr)=>{
						if(parallelErr) return next(parallelErr);

						let kfgStoreList = jsonData.Stores.Store;
						asyncEach(kfgStoreList,(data,asyncEachcallback)=>{
							let kfgAreaId 	 = 	data.AreaId._text;
							let cravezAreaId =	(kfgAreaId && cravezAreaList[kfgAreaId] && cravezAreaList[kfgAreaId].area_id) ? cravezAreaList[kfgAreaId].area_id :"";

							/** Save details **/
							asyncParallel({
								unique_id : (parentCallback)=>{
									/** get unique Id Response **/
									this.getUniqueId({type:"restaurant_branches"}).then(uniqueIdResponse=>{
										let uniqueId = (uniqueIdResponse.result) ? uniqueIdResponse.result :"";
										parentCallback(null,uniqueId);
									});
								},
								branch_id : (parentCallback)=>{
									restaurant_branches.findOne({
										restaurant_id : restaurantId,
										kfg_store_id: {$in: [parseInt(data.StoreId._text), String(data.StoreId._text)]}
									},{projection : {_id : 1}},(branchErr,branchResult)=>{
										let storeId	= (branchResult) ? ObjectId(branchResult._id) : ObjectId();
										parentCallback(branchErr,storeId);
									});
								},
								city_id : (parentCallback)=>{
									if(!cravezAreaId) return parentCallback(null, "");

									areas.findOne({_id : cravezAreaId},{projection : {city_id: 1}},(errs,result)=>{
										let cityId	= (result) ? result.city_id :"";
										parentCallback(errs,cityId);
									});
								},
							},(parallelErr,asyncReponse)=>{
								if(parallelErr) return asyncEachcallback(parallelErr);

								let branchId 	= 	asyncReponse.branch_id;
								let startTime 	= 	(data.PickUpStartTime._text)? parseFloat(data.PickUpStartTime._text.replace(':','.')) :0;
								let endTime	 	= 	(data.PickUpEndTime._text)?  parseFloat(data.PickUpEndTime._text.replace(':','.')) 	:0;
								let promiseTime	=	(data.PromiseTime._text)  ? 	parseFloat(data.PromiseTime._text):0;
								let deliveryFess =	(data.ServiceCharge._text)? parseFloat(data.ServiceCharge._text):0;
								let areaAttributes 	=	{};
								areaAttributes[ACCEPT_PICKUP_ORDER] 			= 	ACTIVE;
								areaAttributes[ACCEPT_SCHEDULING_ATTRIBUTE_ID] 	= 	ACTIVE;
								areaAttributes[MINIMUM_ORDER_LIMIT_ATTRIBUTE_ID]= 	0;
								areaAttributes[DELIVERY_ATTRIBUTE_ID] 			= 	DELIVERY_BY_RESTAURANT;
								areaAttributes[DELIVERY_FEES_ATTRIBUTE_ID] 		= 	deliveryFess;
								areaAttributes[DELIVERY_DURATION_ATTRIBUTE_ID] 	=	promiseTime;

								asyncParallel({
									save_store_data : (childCallback)=>{
										restaurant_branches.updateOne({
											_id 		: branchId,
											kfg_store_id: parseInt(data.StoreId._text)
										},
										{
											$set: {
												name: {
													en: data.StoreName._text,
													ar: data.StoreNameARB._text
												},
												area_id					: 	cravezAreaId,
												city_id					: 	asyncReponse.city_id,
												address					: 	data.StoreAddress._text,
												kfg_store_country_id	: 	data.CountryId._text,
												kfg_store_province_id	: 	data.ProvinceId._text,
												kfg_store_menu_id		: 	data.MenuId._text,
												kfg_store_district_id	: 	data.DistrictId._text,
												kfg_store_area_id		: 	data.AreaId._text,
												kfg_store_city_id		: 	data.CityId._text,
												kfg_store_concept_id	: 	data.ConceptId._text,
												kfg_store_street_id		: 	data.StreetId._text,
												kfg_store_zone_id		: 	data.ZoneId._text,
												kfg_store_number		: 	data.StoreNumber._text,
												promise_time			: 	promiseTime,
												longitude				: 	parseFloat(data.Longitude._text),
												latitude				: 	parseFloat(data.Latitude._text),
												long_lat				: 	[parseFloat(data.Longitude._text),parseFloat(data.Latitude._text)],
												pickup_start_time		: 	startTime,
												pickup_end_time			: 	endTime,
												is_active				: 	(data.StoreStatus._text) ? parseInt(data.StoreStatus._text) : 0,
												modified				: 	getUtcDate(),
												rating					: 	0,
												service_charge			:	deliveryFess
											},
											$setOnInsert: {
												restaurant_slug	: restaurantSlug,
												restaurant_id	: restaurantId,
												added_by		: asyncParellelReponse.admin_id,
												channel_id		: CHANNEL_SOAP,
												created			: getUtcDate(),
												branch_number	: asyncReponse.unique_id,
												branch_status	: OPEN,
												kfg_store		: true,
												send_mail		: true,
												concept_id		: req.params.concept_id,
												delivery_vehicle_type: 	[VEHICLE_TYPE_CAR, VEHICLE_TYPE_BIKE],
											},
											$unset : {
												to_be_deleted : 1
											}
										},{upsert: true},(updateErr) => {
											childCallback(updateErr);
										});
									},
									phone_number : (childCallback)=>{
										if(!data.StorePhone._text) return childCallback(null);

										restaurant_branch_phone_numbers.updateOne({
											branch_id	: branchId,
											value		: data.StorePhone._text
										},
										{
											$set : {
												modified: getUtcDate(),
											},
											$setOnInsert: {
												restaurant_id	: restaurantId,
												added_by		: asyncParellelReponse.admin_id,
												channel_id		: CHANNEL_SOAP,
												attribute_id	: BRANCH_CUSTOMER_SERVICE_NUMBER_ATTRIBUTE_ID,
												created			: getUtcDate(),
												kfg_store		: true,
												country_code	: DEFAULT_COUNTRY_CODE,
												concept_id		: conceptId,
											},
											$unset : {
												to_be_deleted : 1
											}
										},{upsert: true},(updateErr) => {
											childCallback(updateErr);
										});
									},
									payment_methods : (childCallback)=>{

										restaurant_branch_payment_methods.updateOne({
											branch_id	: branchId,
										},
										{
											$set : {
												payment_methods: allPaymentMethods,
												modified: getUtcDate(),
											},
											$setOnInsert: {
												restaurant_id	: restaurantId,
												added_by		: asyncParellelReponse.admin_id,
												channel_id		: CHANNEL_SOAP,
												created			: getUtcDate(),
												kfg_store		: true,
												concept_id		: conceptId,
											},
											$unset : {
												to_be_deleted : 1
											}
										},{upsert: true},(updateErr) => {
											childCallback(updateErr);
										});
									},
									phone_number_2 : (childCallback)=>{
										if(!data.StorePhone2._text || (data.StorePhone._text == data.StorePhone2._text)) return childCallback(null);

										restaurant_branch_phone_numbers.updateOne({
											branch_id	: branchId,
											value		: data.StorePhone2._text
										},
										{
											$set : {
												modified: getUtcDate(),
											},
											$setOnInsert: {
												restaurant_id	: restaurantId,
												added_by		: asyncParellelReponse.admin_id,
												channel_id		: CHANNEL_SOAP,
												attribute_id	: BRANCH_CUSTOMER_SERVICE_NUMBER_ATTRIBUTE_ID,
												created			: getUtcDate(),
												kfg_store		: true,
												country_code	: DEFAULT_COUNTRY_CODE,
												concept_id		: conceptId,
											},
											$unset : {
												to_be_deleted : 1
											}
										},{upsert: true},(updateErr) => {
											childCallback(updateErr);
										});
									},
									calender : (childCallback)=>{
										let fromHour 	= (data.StartTime._text) ? (data.StartTime._text).split(":")[0] : 0;
										let fromMinute	= (data.StartTime._text) ? (data.StartTime._text).split(":")[1] : 0;
										let toHour 		= (data.EndTime._text) ? (data.EndTime._text).split(":")[0] : 0;
										let toMinute	= (data.EndTime._text) ? (data.EndTime._text).split(":")[1] : 0;

										restaurant_branch_calendars.updateOne({
											branch_id	: branchId,
										},
										{
											$set : {
												from_hour	: parseInt(fromHour),
												from_minute	: parseInt(fromMinute),
												status		: OPEN,
												to_hour		: parseInt(toHour),
												to_minute	: parseInt(toMinute),
												type		: DEFAULT_WEEK
											},
											$setOnInsert: {
												restaurant_id	: restaurantId,
												added_by		: asyncParellelReponse.admin_id,
												channel_id		: CHANNEL_SOAP,
												created			: getUtcDate(),
												is_exception	: false,
												kfg_store		: true,
												parent_id		: ""
											},
											$unset : {
												to_be_deleted : 1
											}
										},{upsert: true},(updateErr) => {
											childCallback(updateErr);
										});
									},
									branch_area_attributes : (childCallback)=>{
										asyncEach(Object.keys(areaAttributes),(attrId, eachSubCallback)=>{
											attrId = parseInt(attrId);

											asyncParallel({
												branch_area : (childSubCallback)=>{
													restaurant_branch_area_settings.updateMany({
														branch_id		: 	branchId,
														attribute_id	:	{$in: [String(attrId),attrId ]}
													},
													{$set : {
														attribute_value	: areaAttributes[attrId],
														modified		: getUtcDate(),
													}},(updateErr) => {
														childSubCallback(updateErr);
													});
												},
												branch_area : (childSubCallback)=>{
													let branchAreaFields = setBranchAreaFields(attrId, areaAttributes[attrId]);

													if(!branchAreaFields) return childSubCallback(null);

													/** Update area */
													restaurant_branch_areas.updateMany({branch_id: branchId },{$set: branchAreaFields},(updateErr) => {
														childSubCallback(updateErr);
													});
												},
											},(parallelErrs)=>{
												eachSubCallback(parallelErrs);
											});
										},(asyncParallel)=>{
											childCallback(asyncParallel);
										});
									},
								},(parallelErrs)=>{
									if(parallelErrs){
										return asyncEachcallback(parallelErrs);
									}else{
										asyncEach(attributesList,(attributeData,attributeCallback)=>{
											let defaultValue 	=	"";
											let attributeId 	= 	attributeData.attribute_id;

											asyncParallel({
												update_area : (subChildCallback)=>{
													let branchAreaFields = setBranchAreaAttributes(attributeId, defaultValue);
													if(!branchAreaFields) return subChildCallback(null);

													restaurant_branches.updateOne({
														_id : branchId,
													},{$set: branchAreaFields},(updateAreaErr) => {
														subChildCallback(updateAreaErr);
													});
												},
												save_area_settings : (subChildCallback)=>{
													restaurant_branch_attributes.updateOne({
														branch_id	: branchId,
														attribute_id: attributeId,
													},
													{
														$set : {
															value	: defaultValue,
															modified: getUtcDate(),
														},
														$setOnInsert: {
															restaurant_id	: restaurantId,
															added_by		: asyncParellelReponse.admin_id,
															channel_id		: CHANNEL_SOAP,
															created			: getUtcDate(),
															kfg_store		: true
														},
														$unset : {
															to_be_deleted : 1
														}
													},{upsert: true},(updateErr) => {
														subChildCallback(updateErr);
													});
												}
											},(asyncChildErr)=>{
												attributeCallback(asyncChildErr);
											});
										},asyncAreaErr=>{
											asyncEachcallback(asyncAreaErr);

											/** Update branch calender*/
											this.cronModule.saveOpenBranchList(req,res,next,{branch_id: branchId});
										});
									}
								});
							});
						},(asyncEachErr)=>{
							if(asyncEachErr) return next(parallelErr);

							asyncParallel({
								bracnch_delete : (subCallback)=>{
									restaurant_branches.deleteMany({
										restaurant_id : restaurantId,
										to_be_deleted : true,
									},(updateErr)=>{
										subCallback(updateErr);
									});
								},
								phone_number_delete : (subCallback)=>{
									restaurant_branch_phone_numbers.deleteMany({
										restaurant_id : restaurantId,
										to_be_deleted : true,
									},(updateErr)=>{
										subCallback(updateErr);
									});
								},
								branch_calendars_delete : (subCallback)=>{
									restaurant_branch_calendars.deleteMany({
										restaurant_id : restaurantId,
										to_be_deleted : true,
									},(updateErr)=>{
										subCallback(updateErr);
									});
								},
								branch_attributes_delete : (subCallback)=>{
									restaurant_branch_attributes.deleteMany({
										restaurant_id : restaurantId,
										to_be_deleted : true,
									},(updateErr)=>{
										subCallback(updateErr);
									});
								},
								restaurant_branch_payment_methods : (subCallback)=>{
									restaurant_branch_payment_methods.deleteMany({
										restaurant_id : restaurantId,
										to_be_deleted : true,
									},(updateErr)=>{
										subCallback(updateErr);
									});
								},
							},(parallelErr)=>{
								/** Assign menu to branch  **/
								this.assignMenuToBranch({restaurant_id: restaurantId});

								if(parallelErr) return next(parallelErr);

								resolve({status : STATUS_SUCCESS, store_list: kfgStoreList});
							});
						});
					});
				});
			});
		});
	};//End getStoreData()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async RefreshStoreAreaMap(options){
		return new Promise(resolve=>{
			/** Save Kfg logs */
			axios({
				method: "GET",
				url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
				params: {
					method_name: "RefreshStoreAreaMap",
					response: options.params
				},
				httpsAgent: new https.Agent({
					rejectUnauthorized: false
				})
			}).catch(() => {});

			let params = options.params;
			let missingParameters = [];
			if(!params.ConceptId) missingParameters.push("ConceptId");

			if(missingParameters.length>0) return resolve({
				ResponseCode : "004",
				ResponseDesc : "Missing "+missingParameters.join(", ")
			});

			axios.get(Constants.WEBSITE_URL + "get_store_area_map/"+params.ConceptId, {
				httpsAgent: new https.Agent({
					rejectUnauthorized: false
				})
			}).then(() => {
				resolve({
					ResponseCode: "000",
					ResponseDesc: "Success"
				});
			}).catch(() => {
				resolve({
					ResponseCode: "000",
					ResponseDesc: "Success"
				});
			});
		});
	};//End RefreshStoreAreaMap()

	/**
	 * Function to update store area map
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async UpdateStoreAreaMap(options){
		return new Promise(resolve=>{
			try{
				/** Save Kfg logs */
				axios({
					method: "GET",
					url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
					params: {
						method_name: "UpdateStoreAreaMap",
						response: options.params
					},
					httpsAgent: new https.Agent({
						rejectUnauthorized: false
					})
				}).catch(() => {});

				let params = options.params;
				let missingParameters = [];
				if(!params.XMLInput) missingParameters.push("XMLInput");

				if(missingParameters.length>0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingParameters.join(", ")
				});
				if(!params.XMLInput || !params.XMLInput.STOREAREAMAPS || !params.XMLInput.STOREAREAMAPS.STOREAREAMAP) return resolve(respnoseCodes["001"]);

				if(params.XMLInput.STOREAREAMAPS.STOREAREAMAP.constructor != Array ){
					let tempObj = params.XMLInput.STOREAREAMAPS.STOREAREAMAP;
					params.XMLInput.STOREAREAMAPS.STOREAREAMAP = [];
					params.XMLInput.STOREAREAMAPS.STOREAREAMAP.push(tempObj);
				}

				/** validate data*/
				let missingData		= [];
				params.XMLInput.STOREAREAMAPS.STOREAREAMAP.map(record =>{
					if(record._attributes){
						if(!record._attributes.STOREID) missingData.push("STOREID");
						if(!record._attributes.CONCEPTID) missingData.push("CONCEPTID");
						if(!record._attributes.AREAID) missingData.push("AREAID");
					}else{
						missingData.push("STOREID, CONCEPTID, AREAID");
					}
				});

				if(missingData.length > 0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingData.join(", ")
				});

				const restaurant_branches 				= db.collection("restaurant_branches");
				const restaurant_branch_areas 			= db.collection("restaurant_branch_areas");
				const restaurant_branch_area_settings 	= db.collection("restaurant_branch_area_settings");
				const attributes 						= db.collection("attributes");
				const cravez_areas 						= db.collection("cravez_areas");

				asyncParallel({
					attr_list : (parellelCallback)=>{
						attributes.find({type: "branch_area"},{projection: {attribute_id: 1, default_value: 1}}).toArray((error,attributeResult)=>{
							parellelCallback(error,attributeResult);
						});
					},
					area_list : (parellelCallback)=>{
						/** Get cravez areas list */
						cravez_areas.find({},{projection:{_id: 1, area_id: 1,block_id:1,cravez_area_id:1}}).toArray((err,result)=>{
							if(err || result.length<=0) return parellelCallback(err, null);

							let tmpAreaObj = {};
							result.map(records=>{
								if(records.cravez_area_id){
									tmpAreaObj[records.cravez_area_id] = records;
								}
							});
							parellelCallback(err, tmpAreaObj);
						});
					},
					branch_list : (parellelCallback)=>{
						/** Get cravez branch list */
						restaurant_branches.find({
							restaurant_slug : {$in: [PIZZA_HUT, BURGER_KING]},
							kfg_store		: true
						},{projection:{_id: 1, kfg_store_id: 1,service_charge:1,promise_time:1}}).toArray((err,result)=>{
							if(err || result.length<=0) return parellelCallback(err, null);

							let tmpBraObj = {};
							result.map(records=>{
								if(records.kfg_store_id){
									tmpBraObj[records.kfg_store_id] = records;
								}
							});
							parellelCallback(err, tmpBraObj);
						});
					},
				},(parentErr,parentRes)=>{
					if(parentErr) return resolve(respnoseCodes["002"]);

					let attrList 		=	(parentRes.attr_list) 	?	parentRes.attr_list 	:[];
					let kfgAreaObj 		= 	(parentRes.area_list) 	?	parentRes.area_list		:{};
					let branchList 		=	(parentRes.branch_list)	?	parentRes.branch_list	:{};
					let storeUniqueIds  =	{};

					/** Send response */
					if(attrList.length ==0 || Object.keys(kfgAreaObj).length ==0 || Object.keys(branchList).length ==0){
						return resolve(respnoseCodes["002"]);
					}

					eachOfSeries(params.XMLInput.STOREAREAMAPS.STOREAREAMAP,(data, dataIndex, asyncEachcallback)=>{
						data 				=	data._attributes;
						let storeId			=	data.STOREID;
						let tmpAreaList		=	data.AREAID.split(",");
						let branchId		=	(branchList[storeId]) ? branchList[storeId]._id :"";
						let serviceCharge	=	(branchList[storeId]) ? branchList[storeId].service_charge :0;
						let promiseTime		=	(branchList[storeId]) ? branchList[storeId].promise_time   :0;
						let finalAreaList	=	[];

						/** Manage area list */
						tmpAreaList.map(tmpAreaId=>{
							if(kfgAreaObj[tmpAreaId]){
								finalAreaList.push(kfgAreaObj[tmpAreaId]);
							}
						});

						if(finalAreaList.length ==0 || !branchId) return asyncEachcallback(null);

						storeUniqueIds[branchId] = true;
						asyncParallel({
							branch_details : (parellelCallback)=>{
								restaurant_branch_areas.updateMany({
									branch_id: branchId,
								},
								{$set : {
									to_be_deleted: true
								}},(updateErr) => {
									parellelCallback(updateErr);
								});
							},
						},(parallelErr)=>{
							if(parallelErr) return asyncEachcallback(parallelErr);

							eachOfSeries(finalAreaList,(areaData, dataIndex, asyncAreaCallback)=>{

								restaurant_branch_areas.updateOne({
									branch_id 	: 	branchId,
									area_id 	:	ObjectId(areaData.area_id)
								},
								{
									$set : {
										modified	: getUtcDate(),
									},
									$unset : {
										to_be_deleted: 1,
									},
									$addToSet: {
										kfg_area_ids: 	areaData.cravez_area_id,
										block_ids	: 	areaData.block_id
									},
									$setOnInsert: {
										added_by	 	: options.super_admin_details._id,
										channel_id	 	: CHANNEL_SOAP,
										created		 	: getUtcDate(),
										open		 	: OPEN,
										kfg_store	 	: true,
										restaurant_id	: ObjectId(options.concept_ids[data.CONCEPTID]._id),
										concept_id	 	: data.CONCEPTID,
									}
								},{upsert: true},(updateErr) => {
									if(updateErr) return asyncAreaCallback(updateErr);

									eachOfSeries(attrList,(attrData, atdataIndex, attributeCallback)=>{
										let tmpAttrId 	=	attrData.attribute_id;
										let tmpAttrVal	= 	attrData.default_value;

										if(tmpAttrId == DELIVERY_ATTRIBUTE_ID){
											tmpAttrVal = DELIVERY_BY_RESTAURANT;
										}

										if(tmpAttrId == DELIVERY_FEES_ATTRIBUTE_ID){
											tmpAttrVal = serviceCharge;
										}

										if(tmpAttrId == DELIVERY_DURATION_ATTRIBUTE_ID){
											tmpAttrVal = promiseTime;
										}

										if(tmpAttrId == MINIMUM_ORDER_LIMIT_ATTRIBUTE_ID){
											tmpAttrVal = 0;
										}

										if(tmpAttrId == ACCEPT_PICKUP_ORDER || tmpAttrId == ACCEPT_SCHEDULING_ATTRIBUTE_ID){
											tmpAttrVal = ACTIVE;
										}

										asyncParallel({
											update_area : (childCallback)=>{
												let branchAreaFields = setBranchAreaFields(tmpAttrId, tmpAttrVal);
												if(!branchAreaFields) return childCallback(null);

												restaurant_branch_areas.updateOne({
													branch_id 	: branchId,
													area_id 	: ObjectId(areaData.area_id)
												},{$set : branchAreaFields},(updateAreaErr) => {
													childCallback(updateAreaErr);
												});
											},
											save_area_settings : (childCallback)=>{

												restaurant_branch_area_settings.updateOne({
													restaurant_id 	: ObjectId(options.concept_ids[data.CONCEPTID]._id),
													branch_id	  	: branchId,
													area_id  		: ObjectId(areaData.area_id),
													attribute_id  	: tmpAttrId,
												},
												{
													$set : {
														attribute_value : tmpAttrVal,
														modified	: 	getUtcDate()
													},
													$setOnInsert : {
														added_by	: options.super_admin_details._id,
														channel_id	: CHANNEL_SOAP,
														created		: getUtcDate()
													}
												},{upsert: true},(err) => {
													childCallback(err);
												});
											}
										},(asyncChildErr)=>{
											attributeCallback(asyncChildErr);
										});
									},asyncAreaErr=>{
										asyncAreaCallback(asyncAreaErr);
									});
								});
							},asyncAreaErr=>{
								asyncEachcallback(asyncAreaErr);
							});
						});
					},(asyncEachErr)=>{

						let allBranchIds 	= 	Object.keys(storeUniqueIds);
						let branchObjectIds =	allBranchIds.map(branch=>{return ObjectId(branch);});
						restaurant_branch_areas.distinct("area_id",{branch_id: {$in: branchObjectIds},to_be_deleted:true},(areaErr,areaIds)=>{
							if(areaIds && areaIds.length >0){
								asyncParallel({
									delete_branch_area : (deleteCallback)=>{
										restaurant_branch_areas.deleteMany({
											area_id 	: {$in : areaIds},
											branch_id 	: {$in : branchObjectIds}
										},(deleteErr) => {
											deleteCallback(deleteErr);
										});
									},
									delete_area_settings : (deleteCallback)=>{
										restaurant_branch_area_settings.deleteMany({
											area_id   : {$in: areaIds},
											branch_id : {$in: branchObjectIds}
										},(deleteErr) => {
											deleteCallback(deleteErr);
										});
									},
								},()=>{});
							}
						});

						if(asyncEachErr) return resolve(respnoseCodes["002"]);
						resolve(respnoseCodes["000"]);
					});
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			}
		});
	};//End UpdateStoreAreaMap()

	/**
	 * Function to get store area map
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	async getStoreAreaMap(req, res,next,client){
		return new Promise(resolve=>{
			try{
				let conceptId = parseInt(req.params.concept_id);
				/** Call service */
				client["GetStoreAreaMap"]({LicenceKey: SOAP_LICENCE_KEY, ConceptId: conceptId},(err, response)=>{
					if (err) throw err;
					let apiData	= (response && response.GetStoreAreaMapResult) ? response.GetStoreAreaMapResult :"";

					/** Save kfg request response */
					this.saveKFGRequestResponse(req,res,next,{
						method_name :	"GetStoreAreaMap",
						response	: 	response,
						request		:	{LicenceKey: SOAP_LICENCE_KEY, ConceptId: conceptId},
					}).then(()=>{});

					/** Send error response */
					if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

					let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
					let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

					let dataArray =  jsonData.StoreAreaMaps.StoreAreaMap;
					if(dataArray.constructor != Array ){
						let tempObj = dataArray;
						dataArray 	= [];
						dataArray.push(tempObj);
					}

					const users					=	db.collection("users");
					const attributes 			= 	db.collection("attributes");
					const restaurants			= 	db.collection("restaurants");
					const cravez_areas 			= 	db.collection("cravez_areas");
					const restaurant_branches 	= 	db.collection("restaurant_branches");
					const restaurant_branch_areas= 	db.collection("restaurant_branch_areas");
					const restaurant_branch_area_settings=db.collection("restaurant_branch_area_settings");

					asyncParallel({
						branch_list : (parentCallback)=>{
							/** Get branch list */
							restaurant_branches.find({
								kfg_store_concept_id : String(conceptId)
							},{projection:{_id: 1, service_charge:1,kfg_store_id:1,promise_time:1}}).toArray((err,result)=>{
								if(err || result.length<=0) return parentCallback(err, null);

								let tmpBranchObj = {};
								result.map(records=>{
									if(records.kfg_store_id){
										tmpBranchObj[records.kfg_store_id] = records;
									}
								});
								parentCallback(err, tmpBranchObj);
							});
						},
						area_list : (parentCallback)=>{
							/** Get cravez areas list */
							cravez_areas.find({},{projection:{_id: 1, cravez_area_id:1,area_id:1,block_id:1}}).toArray((err,result)=>{
								if(err || result.length<=0) return parentCallback(err, null);

								let tmpAreaObj = {};
								result.map(records=>{
									if(records.cravez_area_id){
										tmpAreaObj[records.cravez_area_id] = records;
									}
								});
								parentCallback(err, tmpAreaObj);
							});
						},
						admin_id : (parentCallback)=>{
							/** Get admin details */
							users.findOne({
								user_role_id: CRAVEZ
							},{projection:{_id:1}},(userErr, userResult)=>{
								let adminId = (userResult) ? ObjectId(userResult._id) :"";
								parentCallback(userErr, adminId);
							});
						},
						attribute_list : (parentCallback)=>{
							/** Get attribute list */
							attributes.find({
								type : "branch_area"
							},{projection : {attribute_id: 1,default_value: 1}}).toArray((err,result)=>{
								parentCallback(err, result);
							});
						},
						restaurant_id : (parellelCallback)=>{
							/** Get restaurant details */
							restaurants.findOne({
								concept_id: {$in: [parseInt(conceptId), String(conceptId)]}
							},{projection:{_id: 1}},(err, restaurantResult)=>{
								let restaurantId = (restaurantResult) ? restaurantResult._id :"";
								parellelCallback(err, restaurantId);
							});
						},
					},(parentErr,parentReponse)=>{
						if(parentErr) return next(parentErr);

						/** Send error response */
						if(!parentReponse.branch_list || !parentReponse.area_list || !parentReponse.restaurant_id){
							return resolve({
								status  		: 	STATUS_ERROR,
								message 		: 	"Details not found",
								parentReponse 	:	parentReponse
							});
						}

						let adminId 		=	parentReponse.admin_id;
						let areaList 		=	parentReponse.area_list;
						let branchList 		=	parentReponse.branch_list;
						let restaurantId	= 	parentReponse.restaurant_id;
						let attributeList 	=	parentReponse.attribute_list;

						/** Update branch areas */
						restaurant_branch_areas.updateMany({
							restaurant_id 	: restaurantId,
						},
						{$set : {
							to_be_deleted	: true
						}},(areaUpdateErr) => {
							if(areaUpdateErr) return next(areaUpdateErr);

							eachOfSeries(dataArray,(data, atdataIndex, asyncEachCallBack)=>{
								let kfgAreaId 	 =	parseInt(data.AreaId._text);
								let kfgStoreId 	 =	parseInt(data.StoreId._text);
								let cravezAreaId =	(areaList[kfgAreaId]) ? areaList[kfgAreaId].area_id	 :"";
								let cravezBlockId=	(areaList[kfgAreaId]) ?	areaList[kfgAreaId].block_id :"";
								let cravezStoreId=	(branchList[kfgStoreId])? branchList[kfgStoreId]._id :"";
								let tmpServiceCharge=  (branchList[kfgStoreId])	? 	branchList[kfgStoreId].service_charge	:0;
								let tmpPromiseTime	= (branchList[kfgStoreId])	? 	branchList[kfgStoreId].promise_time		:0;

								if(!cravezStoreId || !cravezAreaId) return asyncEachCallBack(null);

								/** Update area details */
								restaurant_branch_areas.updateOne({
									branch_id 		: 	cravezStoreId,
									area_id 		:	cravezAreaId,
									restaurant_id	: 	restaurantId,
								},
								{
									$set : {
										modified : getUtcDate(),
									},
									$setOnInsert: {
										kfg_area_id	: 	kfgAreaId,
										added_by	: 	adminId,
										open		:	OPEN,
										channel_id	: 	CHANNEL_SOAP,
										created		: 	getUtcDate(),
										kfg_store	: 	true,
										concept_id	:	data.ConceptId._text,
									},
									$addToSet: {
										kfg_area_ids: 	kfgAreaId,
										block_ids	: 	cravezBlockId
									},
									$unset : {
										to_be_deleted: 1,
									},
								},{upsert: true},(updateErr,updateResult) => {
									if(updateErr) return  asyncEachCallBack(updateErr);

									/** Check area new insert or not */
									if(updateResult && updateResult.upsertedId){
										eachOfSeries(attributeList,(attributeData, atdatafIndex, attributeCallback)=>{
											let tmpAttrId	= attributeData.attribute_id;
											let tmpAttrVal	= attributeData.default_value;

											if(tmpAttrId == DELIVERY_ATTRIBUTE_ID)	 tmpAttrVal = DELIVERY_BY_RESTAURANT;
											if(tmpAttrId == DELIVERY_FEES_ATTRIBUTE_ID) 	 tmpAttrVal = tmpServiceCharge;
											if(tmpAttrId == DELIVERY_DURATION_ATTRIBUTE_ID) tmpAttrVal = tmpPromiseTime;
											if(tmpAttrId == ACCEPT_PICKUP_ORDER) tmpAttrVal = ACTIVE;
											if(tmpAttrId == ACCEPT_SCHEDULING_ATTRIBUTE_ID){
												tmpAttrVal = ACTIVE;
											}
											if(tmpAttrId == MINIMUM_ORDER_LIMIT_ATTRIBUTE_ID){
												tmpAttrVal = 0;
											}

											asyncParallel({
												update_area : (childCallback)=>{
													let branchAreaFields = setBranchAreaFields(tmpAttrId, tmpAttrVal);
													if(!branchAreaFields) return childCallback(null);

													restaurant_branch_areas.updateOne({
														branch_id 	:	cravezStoreId,
														area_id 	:	cravezAreaId,
													},{$set: branchAreaFields },(updateAreaErr) => {
														childCallback(updateAreaErr);
													});
												},
												save_area_settings : (childCallback)=>{
													restaurant_branch_area_settings.updateOne({
														restaurant_id	: 	restaurantId,
														branch_id 		: 	cravezStoreId,
														area_id 		:	cravezAreaId,
														attribute_id  	:	tmpAttrId,
													},
													{
														$set : {
															attribute_value : tmpAttrVal,
															modified	: 	getUtcDate()
														},
														$setOnInsert : {
															added_by	: adminId,
															channel_id	: CHANNEL_SOAP,
															created		: getUtcDate()
														}
													},{upsert: true},(err) => {
														childCallback(err);
													});
												}
											},(asyncChildErr)=>{
												attributeCallback(asyncChildErr);
											});
										},asyncAreaErr=>{
											asyncEachCallBack(asyncAreaErr);
										});
									}else{
										asyncEachCallBack(null);
									}
								});
							},(asyncEachErr)=>{
								if(asyncEachErr) return next(asyncEachErr);

								asyncParallel({
									remove_old_area : (childCallback)=>{
										restaurant_branch_areas.find({
											restaurant_id	: 	restaurantId,
											to_be_deleted 	:	true
										},{projection: {branch_id: 1, area_id: 1}}).toArray((err,result)=>{
											if(err || result.length <=0) return childCallback(err);

											asyncEach(result,(data,childEachcallback)=>{
												asyncParallel({
													remove_area : (subCallback)=>{
														restaurant_branch_areas.deleteMany({
															branch_id 	: 	data.branch_id,
															area_id		:	data.area_id,
														},(updateErr)=>{
															subCallback(updateErr);
														});
													},
													remove_area_settings : (subCallback)=>{
														restaurant_branch_area_settings.deleteMany({
															branch_id 	: 	data.branch_id,
															area_id		:	data.area_id,
														},(updateErr)=>{
															subCallback(updateErr);
														});
													},
												},(subErr)=>{
													childEachcallback(subErr);
												});
											},(asyncChildEachErr)=>{
												childCallback(asyncChildEachErr);
											});
										});
									},
								},(parentErr)=>{
									if(parentErr) return resolve(respnoseCodes["002"]);
									resolve(respnoseCodes["000"]);
								});
							});
						});
					});
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			}
		}).catch(next);
	};//End getStoreAreaMap()

	/**
	 * Function to get vgroups
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getVgroups(req, res,next,client){
		return new Promise(resolve=>{
			let menuId	= (req.params.menu_id) ? req.params.menu_id :PIZZA_HUT_MENU_ID;

			/** Call service */
			client["GetVGroups"]({LicenceKey: SOAP_LICENCE_KEY, MenuCategory: menuId, },(err, response)=>{
				if (err) throw err;

				let apiData	= (response && response.GetVGroupsResult) ? response.GetVGroupsResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetVGroups",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY, MenuCategory: menuId},
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				let recordIds	= [];
				let missingData	= [];
				jsonData.VGROUPS.VGROUP.map(record =>{
					recordIds.push(record._attributes.ID);
					if(!record._attributes.ID) missingData.push("ID");
					if(!record._attributes.NAME) missingData.push("NAME");
					if(!record._attributes.NAMEARB) missingData.push("NAMEARB");
				});
				if(missingData.length > 0) resolve({status : STATUS_SUCCESS,message : "Missing "+missingData.join(", ") });

				const cravez_vgroups	= db.collection("cravez_vgroups");
				const restaurants		= db.collection("restaurants");
				const users				= db.collection("users");
				let restaurantSlug 		= req.params.menu_id == PIZZA_HUT_MENU_ID ? PIZZA_HUT : BURGER_KING;

				asyncParallel({
					restaurant_id : (parellelCallback)=>{
						restaurants.findOne({slug : restaurantSlug},{projection:{_id:1}},(err,result)=>{
							let restaurantId = (result) ? ObjectId(result._id) : "";
							parellelCallback(err,restaurantId);
						});
					},
					admin_id : (parellelCallback)=>{
						users.findOne({user_role_id : CRAVEZ},{projection:{_id:1}},(err,result)=>{
							let adminId = (result) ? ObjectId(result._id) : "";
							parellelCallback(err,adminId);
						});
					},
					update_delete_flag : (parellelCallback)=>{
						cravez_vgroups.updateMany({
							restaurant_slug : restaurantSlug,
							cravez_menu_id 	: {$in: [String(menuId), parseInt(menuId)]},
						},{$set: {to_be_deleted: true }},(updateErr)=>{
							parellelCallback(updateErr);
						});
					},
				},(parallelErr,asyncReponse)=>{
					if(parallelErr) return next(parallelErr);

					asyncEach(jsonData.VGROUPS.VGROUP,(data,asyncEachcallback)=>{
						data = data._attributes;
						/** Save details **/
						cravez_vgroups.updateOne({
							kfg_vgroup_id : parseInt(data.ID),
							cravez_menu_id: {$in: [String(menuId), parseInt(menuId)]},
						},
						{
							$set : {
								name			: 	{ en: data.NAME, ar: data.NAMEARB },
								description		: 	{ en: data.DESCRIPTION, ar: data.DESCRIPTIONARB },
								no_of_duplicate	: 	data.NOOFDUPLICATE ? parseInt(data.NOOFDUPLICATE) :0,
								modified		:	getUtcDate(),
							},
							$setOnInsert: {
								cravez_menu_id	: String(menuId),
								restaurant_slug	: restaurantSlug,
								restaurant_id	: asyncReponse.restaurant_id,
								added_by		: asyncReponse.admin_id,
								channel_id		: CHANNEL_SOAP,
								kfg				: true,
							},
							$unset: {
								to_be_deleted	: 1,
							}
						},{upsert: true},(updateErr) => {
							asyncEachcallback(updateErr);
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return next(parallelErr);

						/** Delete vgroups  */
						cravez_vgroups.deleteMany({
							restaurant_slug : restaurantSlug,
							cravez_menu_id 	: {$in: [String(menuId), parseInt(menuId)]},
							to_be_deleted 	: true,
						},(deleteErr)=>{
							if(deleteErr) return next(deleteErr);

							resolve({status: STATUS_SUCCESS});
						});
					});
				});
			});
		}).catch(next);
	};//End getVgroups()

	/**
	 * Function to Add v groups
	 *
	 * @param options As Parameters
	 *
	 * @return json
	 */
	async AddVGroup(options){
		return new Promise(resolve=>{
			try{
				/** Save Kfg logs */
				axios({
					method: "GET",
					url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
					params: {
						method_name: "AddVGroup",
						response: options.params
					},
					httpsAgent: new https.Agent({
						rejectUnauthorized: false
					})
				}).catch(() => {});

				let params = options.params;
				let missingParameters = [];
				if(!params.ConceptId) missingParameters.push("ConceptId");
				if(!params.MenuId) missingParameters.push("MenuId");
				if(!params.XMLInput) missingParameters.push("XMLInput");

				if(missingParameters.length>0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingParameters.join(", ")
				});
				if(!params.XMLInput || !params.XMLInput.VGROUPS || !params.XMLInput.VGROUPS.VGROUP) return resolve(respnoseCodes["001"]);

				if(params.XMLInput.VGROUPS.VGROUP.constructor != Array ){
					let tempObj = params.XMLInput.VGROUPS.VGROUP;
					params.XMLInput.VGROUPS.VGROUP = [];
					params.XMLInput.VGROUPS.VGROUP.push(tempObj);
				}

				/** validate data*/
				let missingData		= [];
				let allVgroupIds	= [];
				params.XMLInput.VGROUPS.VGROUP.map(record =>{
					if(record._attributes){
						if(record._attributes.ID) allVgroupIds.push(String(record._attributes.ID), parseInt(record._attributes.ID));
						if(!record._attributes.ID) missingData.push("ID");
						if(!record._attributes.NAME) missingData.push("NAME");
						if(!record._attributes.NAMEARB) missingData.push("NAMEARB");
					}else{
						missingData.push("ID, NAME, NAMEARB");
					}
				});

				if(missingData.length > 0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingData.join(", ")
				});

				let restaurantId = ObjectId(options.concept_ids[params.ConceptId]._id);

				const cravez_vgroups = db.collection("cravez_vgroups");
				cravez_vgroups.countDocuments({restaurant_id: restaurantId, kfg_vgroup_id: {$in: allVgroupIds }},(contErr,contResult)=>{
					if(contErr) return resolve(respnoseCodes["002"]);

					if(contResult) return resolve(respnoseCodes["004"]);

					eachOfSeries(params.XMLInput.VGROUPS.VGROUP,(data, dataIndex, asyncEachcallback)=>{
						data = data._attributes;

						/** Save record **/
						cravez_vgroups.updateOne({
							kfg_vgroup_id 	: 	parseInt(data.ID),
							cravez_menu_id	:	{$in: [String(params.MenuId), parseInt(params.MenuId)]},
						},
						{
							$set : {
								name: {
									en: (data.NAME) ? data.NAME :"",
									ar: (data.NAMEARB) ? data.NAMEARB :"",
								},
								description: {
									en: (data.DESCRIPTION) ? data.DESCRIPTION :"",
									ar: (data.DESCRIPTIONARB) ? data.DESCRIPTIONARB :"",
								},
								no_of_duplicate	: 	data.NOOFDUPLICATE ? parseInt(data.NOOFDUPLICATE) :0,
								modified :	getUtcDate(),
							},
							$setOnInsert: {
								cravez_menu_id	:	String(params.MenuId),
								restaurant_slug	:	params.MenuId == PIZZA_HUT_MENU_ID ? PIZZA_HUT : BURGER_KING,
								restaurant_id	: 	restaurantId,
								concept_id		: 	params.ConceptId,
								added_by		: 	options.super_admin_details._id,
								channel_id		: 	CHANNEL_SOAP,
								kfg				: 	true,
								created			: 	getUtcDate(),
							}
						},{upsert: true},(updateErr) => {
							asyncEachcallback(updateErr);
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return resolve(respnoseCodes["002"]);
						resolve(respnoseCodes["000"]);
					});
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			}
		});
	};//End AddVGroup()

	/**
	 * Function to update vgroups
	 *
	 * @param options As Parameters
	 *
	 * @return json
	 */
	async UpdateVGroup(options){
		return new Promise(resolve=>{
			try{
				/** Save Kfg logs */
				axios({
					method: "GET",
					url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
					params: {
						method_name: "UpdateVGroup",
						response: options.params
					},
					httpsAgent: new https.Agent({
						rejectUnauthorized: false
					})
				}).catch(() => {});

				let params = options.params;
				let missingParameters = [];
				if(!params.ConceptId) missingParameters.push("ConceptId");
				if(!params.MenuId) missingParameters.push("MenuId");
				if(!params.XMLInput) missingParameters.push("XMLInput");

				if(missingParameters.length>0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingParameters.join(", ")
				});

				if(!params.XMLInput || !params.XMLInput.VGROUPS || !params.XMLInput.VGROUPS.VGROUP) return resolve(respnoseCodes["001"]);

				if(params.XMLInput.VGROUPS.VGROUP.constructor != Array ){
					let tempObj = params.XMLInput.VGROUPS.VGROUP;
					params.XMLInput.VGROUPS.VGROUP = [];
					params.XMLInput.VGROUPS.VGROUP.push(tempObj);
				}

				/** validate data*/
				let missingData		= [];
				params.XMLInput.VGROUPS.VGROUP.map(record =>{
					if(record._attributes){
						if(!record._attributes.ID) missingData.push("ID");
						if(!record._attributes.NAME) missingData.push("NAME");
						if(!record._attributes.NAMEARB) missingData.push("NAMEARB");
					}else{
						missingData.push("ID, NAME, NAMEARB");
					}
				});

				if(missingData.length > 0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingData.join(", ")
				});

				let restaurantSlug	=	(params.MenuId == PIZZA_HUT_MENU_ID) ? PIZZA_HUT :BURGER_KING;
				const items 		=	db.collection("items");
				const cravez_vgroups=	db.collection("cravez_vgroups");
				eachOfSeries(params.XMLInput.VGROUPS.VGROUP,(data, dataIndex, asyncEachcallback)=>{
					data 				= 	data._attributes;
					let kfgVgroupId		=	parseInt(data.ID);
					let noOfDuplicate	=	data.NOOFDUPLICATE ? parseInt(data.NOOFDUPLICATE) :0;

					/** Update vgroup details **/
					cravez_vgroups.updateOne({
						kfg_vgroup_id 	: 	kfgVgroupId,
						cravez_menu_id	:	{$in: [String(params.MenuId), parseInt(params.MenuId)]},
					},
					{$set : {
						name 			: { en: data.NAME, ar: data.NAMEARB },
						description		: { en: data.DESCRIPTION, ar: data.DESCRIPTIONARB },
						no_of_duplicate	: noOfDuplicate,
						modified		: getUtcDate(),
					}},(updateErr) => {
						if(updateErr) return asyncEachcallback(updateErr);

						/** Set item update data */
						let itemUpdateData = {
							name 		: { en: data.NAME, ar: data.NAMEARB },
							description	: { en: data.DESCRIPTION, ar: data.DESCRIPTIONARB },
						};

						if(noOfDuplicate) itemUpdateData.no_of_duplicate = noOfDuplicate;

						/** Update item data */
						items.updateMany({
							restaurant_slug	:	restaurantSlug,
							kfg_vgroup_id	: 	{$in: [parseInt(kfgVgroupId), String(kfgVgroupId)]}
						},{$set : itemUpdateData},(itemUpdateErr) => {
							asyncEachcallback(itemUpdateErr);
						});
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return resolve(respnoseCodes["002"]);
					resolve(respnoseCodes["000"]);
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			}
		});
	};//End UpdateVGroup()

	/**
	 * Function to delete v group
	 *
	 * @param options As Parameters
	 *
	 * @return json
	 */
	async DeleteVGroup(options){
		return new Promise(resolve=>{
			try{
				/** Save Kfg logs */
				axios({
					method: "GET",
					url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
					params: {
						method_name: "DeleteVGroup",
						response: options.params
					},
					httpsAgent: new https.Agent({
						rejectUnauthorized: false
					})
				}).catch(() => {});

				let params = options.params;
				let missingParameters = [];
				if(!params.ConceptId) 	missingParameters.push("ConceptId");
				if(!params.MenuId) 		missingParameters.push("MenuId");
				if(!params.XMLInput) 	missingParameters.push("XMLInput");

				if(missingParameters.length>0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingParameters.join(", ")
				});
				if(!params.XMLInput || !params.XMLInput.VGROUPS || !params.XMLInput.VGROUPS.VGROUP) return resolve(respnoseCodes["001"]);

				if(params.XMLInput.VGROUPS.VGROUP.constructor != Array ){
					let tempObj = params.XMLInput.VGROUPS.VGROUP;
					params.XMLInput.VGROUPS.VGROUP = [];
					params.XMLInput.VGROUPS.VGROUP.push(tempObj);
				}

				/** validate data*/
				let recordIds		= [];
				let missingData		= [];
				params.XMLInput.VGROUPS.VGROUP.map(record =>{
					if(record._attributes){
						if(record._attributes.ID){
							recordIds.push(parseInt(record._attributes.ID), String(record._attributes.ID));
						}else{
							missingData.push("ID");
						}
					}else{
						missingData.push("ID");
					}
				});

				if(missingData.length > 0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingData.join(", ")
				});

				let restaurantSlug			=	(params.MenuId == PIZZA_HUT_MENU_ID) ? PIZZA_HUT :BURGER_KING;
				const items 				=	db.collection("items");
				const cravez_items 			=	db.collection("cravez_items");
				const item_linkings 		=	db.collection("item_linkings");
				const item_availability 	=	db.collection("item_availability");
				const item_units			= 	db.collection("item_units");
				const item_dough_units		= 	db.collection("item_dough_units");
				const item_selector_units	= 	db.collection("item_selector_units");
				const cravez_vgroups		= 	db.collection("cravez_vgroups");
				const item_group_extras		= 	db.collection("item_group_extras");
				const item_choices_groups	= 	db.collection("item_choices_groups");
				const item_extra_masters	= 	db.collection("item_extra_masters");
				cravez_vgroups.find({
					cravez_menu_id	:	params.MenuId,
					kfg_vgroup_id 	: 	{$in : recordIds},
				},{projection:{_id:1,kfg_vgroup_id:1}}).toArray((errs,result)=>{
					if(errs) return resolve(respnoseCodes["002"]);

					if(result.length == 0) return resolve(respnoseCodes["000"]);

					eachOfSeries(result,(data, dataIndex, asyncEachcallback)=>{

						/** Delete vgroup details **/
						cravez_vgroups.deleteOne({_id: data._id },(err) => {
							if(err) return asyncEachcallback(err);

							asyncParallel({
								update_item : (parellelCallback)=>{
									items.find({
										restaurant_slug	:	restaurantSlug,
										kfg_vgroup_id	: 	{$in: [parseInt(data.kfg_vgroup_id), String(data.kfg_vgroup_id)]}
									}).toArray((itemErr,itemResult)=>{
										if(itemErr || itemResult.length ==0) return parellelCallback(itemErr);

										eachOfSeries(itemResult,(itemData, dataIndex, asyncChildCallback)=>{

											asyncParallel({
												delete_item : (subCallback)=>{
													items.deleteOne({_id: itemData._id},(err) =>{
														subCallback(err);
													});
												},
												delete_links : (subCallback)=>{
													item_linkings.deleteMany({item_id: itemData._id},(err) =>{
														subCallback(err);
													});
												},
												delete_availability : (subCallback)=>{
													item_availability.deleteMany({item_id: itemData._id},(err) =>{
														subCallback(err);
													});
												},
												delete_item_units : (subCallback)=>{
													item_units.deleteMany({item_id: itemData._id},(err) =>{
														subCallback(err);
													});
												},
												delete_dough_units : (subCallback)=>{
													item_dough_units.deleteMany({item_id: itemData._id},(err) =>{
														subCallback(err);
													});
												},
												delete_selector_units : (subCallback)=>{
													item_selector_units.deleteMany({item_id: itemData._id},(err) =>{
														subCallback(err);
													});
												},
												delete_item_choices_groups : (subCallback)=>{
													item_choices_groups.deleteMany({item_id: itemData._id},(err) =>{
														subCallback(err);
													});
												},
												delete_item_extra_masters : (subCallback)=>{
													item_extra_masters.deleteMany({item_id: itemData._id},(err) =>{
														subCallback(err);
													});
												},
												delete_item_group_extras : (subCallback)=>{
													item_group_extras.deleteMany({item_id: itemData._id},(err) =>{
														subCallback(err);
													});
												},
											},(parallelErr)=>{
												asyncChildCallback(parallelErr);
											});
										},(asyncChildEachErr)=>{
											parellelCallback(asyncChildEachErr);
										});
									});
								},
								update_kfgitem : (parellelCallback)=>{

									cravez_items.deleteMany({
										restaurant_slug	:	restaurantSlug,
										vgroup_id: {$in: [parseInt(data.kfg_vgroup_id), String(data.kfg_vgroup_id)]}
									},(err) =>{
										parellelCallback(err);
									});
								}
							},(parallelErr)=>{
								asyncEachcallback(parallelErr);
							});
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return resolve(respnoseCodes["002"]);
						resolve(respnoseCodes["000"]);
					});
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			}
		});
	};//End DeleteVGroup()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async DeleteCategory(options){
		return new Promise(resolve=>{
			try{
				/** Save Kfg logs */
				axios({
					method: "GET",
					url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
					params: {
						method_name: "DeleteCategory",
						response: options.params
					},
					httpsAgent: new https.Agent({
						rejectUnauthorized: false
					})
				}).catch(() => {});

				let params = options.params;
				let missingParameters = [];
				if(!params.ConceptId) 	missingParameters.push("ConceptId");
				if(!params.MenuId) 		missingParameters.push("MenuId");
				if(!params.XMLInput) 	missingParameters.push("XMLInput");

				if(missingParameters.length>0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingParameters.join(", ")
				});

				if(!params.XMLInput || !params.XMLInput.CATEGORYLIST || !params.XMLInput.CATEGORYLIST.CATEGORY) return resolve(respnoseCodes["001"]);

				if(params.XMLInput.CATEGORYLIST.CATEGORY.constructor != Array ){
					let tempObj = params.XMLInput.CATEGORYLIST.CATEGORY;
					params.XMLInput.CATEGORYLIST.CATEGORY = [];
					params.XMLInput.CATEGORYLIST.CATEGORY.push(tempObj);
				}

				/** validate data*/
				let recordIds	= [];
				let missingData	= [];
				params.XMLInput.CATEGORYLIST.CATEGORY.map(record =>{
					if(record._attributes){
						if(!record._attributes.ID){
							missingData.push("ID");
						}else{
							recordIds.push(parseInt(record._attributes.ID));
							recordIds.push(String(record._attributes.ID));
						}
					}else{
						missingData.push("ID");
					}
				});

				if(missingData.length > 0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingData.join(", ")
				});

				const items  				= db.collection("items ");
				const restaurant_categories = db.collection("restaurant_categories");
				restaurant_categories.find({
					cravez_menu_id	: params.MenuId,
					kfg_sub_menu_id : {$in : recordIds},
				},{projection:{_id:1,kfg_sub_menu_id:1}}).toArray((errs,result)=>{
					if(errs) return resolve(respnoseCodes["002"]);

					if(result.length == 0) return resolve(respnoseCodes["000"]);

					eachOfSeries(result,(data, dataIndex, asyncEachcallback)=>{
						items.updateMany({
							category_ids : {$in : [ObjectId(data._id)]}
						},
						{$pull : {
							category_ids : ObjectId(data._id)
						}},(error)=>{
							if(error) asyncEachcallback(error);

							/** delete category details **/
							restaurant_categories.deleteOne({_id: data._id },(err) => {
								asyncEachcallback(err);
							});
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return resolve(respnoseCodes["002"]);
						resolve(respnoseCodes["000"]);
					});
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			}
		});
	};//End DeleteCategory()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async AddItems(options){
		return new Promise(resolve=>{
			try{
				/** Save Kfg logs */
				axios({
					method: "GET",
					url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
					params: {
						method_name: "AddItems",
						response: options.params
					},
					httpsAgent: new https.Agent({
						rejectUnauthorized: false
					})
				}).catch(() => {});

				let params = options.params;
				let missingParameters = [];
				if(!params.ConceptId) 	missingParameters.push("ConceptId");
				if(!params.MenuId) 		missingParameters.push("MenuId");
				if(!params.XMLInput) 	missingParameters.push("XMLInput");

				if(missingParameters.length>0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingParameters.join(", ")
				});

				if(!params.XMLInput || !params.XMLInput.ITEMS || !params.XMLInput.ITEMS.ITEM) return resolve(respnoseCodes["001"]);

				if(params.XMLInput.ITEMS.ITEM.constructor != Array ){
					let tempObj = params.XMLInput.ITEMS.ITEM;
					params.XMLInput.ITEMS.ITEM = [];
					params.XMLInput.ITEMS.ITEM.push(tempObj);
				}

				/** validate data*/
				let allItemIds	= [];
				let missingData	= [];
				params.XMLInput.ITEMS.ITEM.map(record =>{
					if(record._attributes){
						if(record._attributes.ITEMID)   allItemIds.push(String(record._attributes.ITEMID), parseInt(record._attributes.ITEMID));
						if(!record._attributes.ITEMID)  missingData.push("ITEMID");
						if(!record._attributes.NAME) 	missingData.push("NAME");
						if(!record._attributes.NAMEARB) missingData.push("NAMEARB");
					}else{
						missingData.push("ITEMID, NAME, NAMEARB");
					}
				});

				if(missingData.length > 0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingData.join(", ")
				});

				let adminId 		= 	options.super_admin_details._id;
				let restaurantId 	=	options.concept_ids[params.ConceptId]._id;
				let restaurantSlug 	=	(params.MenuId == PIZZA_HUT_MENU_ID) ? PIZZA_HUT :BURGER_KING;
				let newItemObj		=	{};

				const cravez_items	=	db.collection("cravez_items");
				cravez_items.countDocuments({restaurant_id: restaurantId, item_id: {$in: allItemIds }},(contErr,contResult)=>{
					if(contErr) return resolve(respnoseCodes["002"]);

					if(contResult) return resolve(respnoseCodes["004"]);

					eachOfSeries(params.XMLInput.ITEMS.ITEM,(data, dataIndex, asyncEachcallback)=>{
						data 			= 	data._attributes;
						let strItemId 	=	String(data.ITEMID);
						let IntItemId 	=	parseInt(data.ITEMID);
						let isCombo 	=	(data.IsCombo)	? parseInt(data.IsCombo) :0;
						let vgroupId 	=	(data.VGroupId) ? parseInt(data.VGroupId):0;

						if(vgroupId){
							newItemObj[vgroupId] = {item_id: strItemId, vgroup_id: vgroupId};
						}else{
							newItemObj[strItemId]= {item_id: strItemId, is_combo: isCombo};
						}

						/** Save item details **/
						cravez_items.updateOne({
							restaurant_id	: 	restaurantId,
							item_id 		:	{$in: [strItemId, IntItemId]}
						},
						{
							$set : {
								name		:	{en: data.NAME, ar: data.NAMEARB},
								description	:	{en: data.DESCRIPTION, ar: data.DESCRIPTIONARB},
								item_price	:	parseFloat(data.PRICE),
								branch_ids	:	data.STOREIDs,
								start_time	:	data.STARTTIME,
								end_time	:	data.ENDTIME,
								submenu_ids	:	data.SubMenuID,
								category_id	:	data.CategoryId,
								is_active	:	parseInt(data.ITM_AVAILABLITYSTATUS),
								is_combo	:	isCombo,
								size		:	(data.Size) 	? 	data.Size		:0,
								dough_type	:	(data.DoughType)? 	data.DoughType	:0,
								selector	:	(data.Selector)	? 	data.Selector 	:0,
								is_half		:	(data.IsHalf) 	?	data.IsHalf 	:0,
								vgroup_id	:	vgroupId,
								order		:	(data.Seq) 	?	parseInt(data.Seq) 	:"",
								is_updated	:	true,
								non_sellable:	(data.SubMenuID && parseInt(data.SubMenuID) > 0) ? 0 :NON_SELLABLE,
								modified	:	getUtcDate(),
							},
							$setOnInsert: {
								kfg				: 	true,
								item_id			:	strItemId,
								added_by		: 	adminId,
								created			: 	getUtcDate(),
								channel_id		: 	CHANNEL_SOAP,
								restaurant_slug	:	restaurantSlug,
							}
						},{upsert: true},(updateErr)=>{
							if(updateErr) return asyncEachcallback(updateErr);

							asyncParallel({
								modifier_item_mapping : (subCallback)=>{

									axios.get(Constants.WEBSITE_URL + "get_modifier_item_mapping/"+strItemId, {
										httpsAgent: new https.Agent({
											rejectUnauthorized: false
										})
									}).then(() => {
										subCallback(null);
									}).catch(() => {
										subCallback(null);
									});
								},
								get_combo_by_id : (subCallback)=>{
									if(restaurantSlug != BURGER_KING || !isCombo) return subCallback(null);

									/** Get Combo extra details */
									axios.get(Constants.WEBSITE_URL + "get_combo_by_id/"+strItemId, {
										httpsAgent: new https.Agent({
											rejectUnauthorized: false
										})
									}).then(() => {
										subCallback(null);
									}).catch(() => {
										subCallback(null);
									});
								}
							},()=>{
								asyncEachcallback(null);
							});
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return resolve(respnoseCodes["002"]);

						resolve(respnoseCodes["000"]);

						Object.keys(newItemObj).map(tmpKey=>{
							let itemId 	 	=	newItemObj[tmpKey].item_id;
							let isCombo 	= 	newItemObj[tmpKey].is_combo;
							let vgroupId 	= 	newItemObj[tmpKey].vgroup_id;

							let cronUrl = Constants.WEBSITE_URL+"crons/update_cravez_item/"+itemId+(vgroupId ? "/"+vgroupId :"");
							if(restaurantSlug == BURGER_KING && isCombo){
								cronUrl = Constants.WEBSITE_URL+"crons/update_cravez_combo_item/"+itemId;
							}

							axios.get(cronUrl, {
								httpsAgent: new https.Agent({
									rejectUnauthorized: false
								})
							}).then(() => { }).catch(() => { });
						});
					});
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			}
		});
	};//End AddItems()

	/**
	 * Function to update items
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async UpdateItems(options){
		return new Promise(resolve=>{
			try{
				/** Save Kfg logs */
				axios({
					method: "GET",
					url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
					params: {
						method_name: "UpdateItems",
						response: options.params
					},
					httpsAgent: new https.Agent({
						rejectUnauthorized: false
					})
				}).catch(() => {});

				let params = options.params;
				let missingParameters = [];
				if(!params.ConceptId) 	missingParameters.push("ConceptId");
				if(!params.MenuId) 		missingParameters.push("MenuId");
				if(!params.XMLInput) 	missingParameters.push("XMLInput");

				if(missingParameters.length>0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingParameters.join(", ")
				});

				if(!params.XMLInput || !params.XMLInput.ITEMS || !params.XMLInput.ITEMS.ITEM) return resolve(respnoseCodes["001"]);

				if(params.XMLInput.ITEMS.ITEM.constructor != Array ){
					let tempObj = params.XMLInput.ITEMS.ITEM;
					params.XMLInput.ITEMS.ITEM = [];
					params.XMLInput.ITEMS.ITEM.push(tempObj);
				}

				/** validate data*/
				let missingData	= [];
                let allItemIds	= [];
				params.XMLInput.ITEMS.ITEM.map(record =>{
					if(record._attributes){
						if(!record._attributes.ITEMID) 	missingData.push("ITEMID");
						if(!record._attributes.NAME) 	missingData.push("NAME");
						if(!record._attributes.NAMEARB) missingData.push("NAMEARB");

						if(record._attributes.ITEMID){
							allItemIds.push(String(record._attributes.ITEMID));
							allItemIds.push(parseInt(record._attributes.ITEMID));
						}
					}else{
						missingData.push("ITEMID, NAME, NAMEARB");
					}
				});

				if(missingData.length > 0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingData.join(", ")
				});

				let restaurantId 	=	options.concept_ids[params.ConceptId]._id;
				let restaurantSlug 	=	(params.MenuId == PIZZA_HUT_MENU_ID) ? PIZZA_HUT :BURGER_KING;
				let newItemObj		=	{};

				/** Get all item list*/
				const cravez_items	=	db.collection("cravez_items");
				cravez_items.countDocuments({
					restaurant_id	: restaurantId,
					item_id			: {$in: allItemIds}
				},(countErr,countResult)=>{
					if(countErr) return resolve(respnoseCodes["002"]);

					/** Send response when not found any item for update */
					if(!countResult) return resolve(respnoseCodes["005"]);

                    const item_extra_masters	=	db.collection("item_extra_masters");
					const item_units_masters	=	db.collection("item_units_masters");
                    eachOfSeries(params.XMLInput.ITEMS.ITEM,(data, dataIndex, asyncEachcallback)=>{
                        data 			= 	data._attributes;
                        let strItemId 	=	String(data.ITEMID);
                        let IntItemId 	=	parseInt(data.ITEMID);
                        let isCombo 	=	(data.IsCombo)	? parseInt(data.IsCombo) :0;
                        let vgroupId 	=	(data.VGroupId) ? parseInt(data.VGroupId):0;

                        if(vgroupId){
                            newItemObj[vgroupId] = {item_id: strItemId, vgroup_id: vgroupId};
                        }else{
                            newItemObj[strItemId]= {item_id: strItemId, is_combo: isCombo};
                        }

                        /** Save item details **/
                        cravez_items.updateOne({
                            restaurant_id	: 	restaurantId,
                            item_id 		:	{$in: [strItemId, IntItemId]}
                        },
                        {$set : {
                            name		:	{en: data.NAME, ar: data.NAMEARB},
                            description	:	{en: data.DESCRIPTION, ar:data.DESCRIPTIONARB},
                            item_price	:	parseFloat(data.PRICE),
                            branch_ids	:	data.STOREIDs,
                            start_time	:	data.STARTTIME,
                            end_time	:	data.ENDTIME,
                            submenu_ids	:	data.SubMenuID,
                            category_id	:	data.CategoryId,
                            is_active	:	parseInt(data.ITM_AVAILABLITYSTATUS),
                            is_combo	:	isCombo,
                            size		:	(data.Size) 	? 	data.Size		:0,
                            dough_type	:	(data.DoughType)? 	data.DoughType	:0,
                            selector	:	(data.Selector)	? 	data.Selector 	:0,
                            is_half		:	(data.IsHalf) 	?	data.IsHalf 	:0,
                            vgroup_id	:	vgroupId,
                            order		:	(data.Seq) 	?	parseInt(data.Seq) 	:"",
                            non_sellable:	(data.SubMenuID && parseInt(data.SubMenuID) > 0) ? 0 :NON_SELLABLE,
                            is_updated	:	true,
                            modified	:	getUtcDate(),
                        }},(updateErr) => {
                            if(updateErr) return asyncEachcallback(updateErr);

                            asyncParallel({
                                modifier_item_mapping : (subCallback)=>{
									/** Get Combo extra details */
									axios.get(Constants.WEBSITE_URL + "get_modifier_item_mapping/"+strItemId, {
										httpsAgent: new https.Agent({
											rejectUnauthorized: false
										})
									}).then(() => {
										subCallback(null);
									}).catch(() => {
										subCallback(null);
									});
                                },
                                get_combo_by_id : (subCallback)=>{
                                    if(restaurantSlug != BURGER_KING || !isCombo) return subCallback(null);

                                    /** Get Combo extra details */
									axios.get(Constants.WEBSITE_URL + "get_combo_by_id/"+strItemId, {
										httpsAgent: new https.Agent({
											rejectUnauthorized: false
										})
									}).then(() => {
										subCallback(null);
									}).catch(() => {
										subCallback(null);
									});
                                },
                                update_in_unit_master : (subCallback)=>{
									/** Update in unit master */
									item_units_masters.updateMany({
										restaurant_slug :	restaurantSlug,
										cravez_item_id 	:	{$in: [strItemId, IntItemId]}
									},
									{$set : {
										name		:	{en: data.NAME, ar: data.NAMEARB},
										description	:	{en: data.DESCRIPTION, ar:data.DESCRIPTIONARB},
									}},(updateErr) => {
										subCallback(updateErr);
									});
								},
								update_in_extra : (subCallback)=>{
									/** Update in extra master */
									item_extra_masters.updateMany({
										restaurant_id 	:	restaurantId,
										extra_item_id	:	{$in: [strItemId, IntItemId]},
									},
									{$set : {
										name : {en: data.NAME, ar: data.NAMEARB},
									}},(updateErr) => {
										subCallback(updateErr);
									});
								}
                            },()=>{
                                asyncEachcallback(null);
                            });
                        });
                    },(asyncEachErr)=>{
                        if(asyncEachErr) return resolve(respnoseCodes["002"]);
                        resolve(respnoseCodes["000"]);

                        logger(newItemObj);

                        Object.keys(newItemObj).map(tmpKey=>{
                            let itemId 	 =	newItemObj[tmpKey].item_id;
                            let isCombo  = 	newItemObj[tmpKey].is_combo;
                            let vgroupId = 	newItemObj[tmpKey].vgroup_id;

                            let cronUrl = Constants.WEBSITE_URL+"crons/update_cravez_item/"+itemId+(vgroupId ? "/"+vgroupId :"");
                            if(restaurantSlug == BURGER_KING && isCombo){
                                cronUrl = Constants.WEBSITE_URL+"crons/update_cravez_combo_item/"+itemId;
                            }
							axios.get(cronUrl, {
								httpsAgent: new https.Agent({
									rejectUnauthorized: false
								})
							}).then(() => {}).catch(() => {});
                        });
                    });
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			}
		});
	};//End UpdateItems()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async DeleteItems(options){
		return new Promise(resolve=>{
			try{
				/** Save Kfg logs */
				axios({
					method: "GET",
					url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
					params: {
						method_name: "DeleteItems",
						response: options.params
					},
					httpsAgent: new https.Agent({
						rejectUnauthorized: false
					})
				}).catch(() => {});

				let params = options.params;
				let missingParameters = [];
				if(!params.ConceptId) 	missingParameters.push("ConceptId");
				if(!params.MenuId) 		missingParameters.push("MenuId");
				if(!params.XMLInput) 	missingParameters.push("XMLInput");

				if(missingParameters.length>0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingParameters.join(", ")
				});

				if(!params.XMLInput || !params.XMLInput.ITEMS || !params.XMLInput.ITEMS.ITEM) return resolve(respnoseCodes["001"]);

				if(params.XMLInput.ITEMS.ITEM.constructor != Array ){
					let tempObj = params.XMLInput.ITEMS.ITEM;
					params.XMLInput.ITEMS.ITEM = [];
					params.XMLInput.ITEMS.ITEM.push(tempObj);
				}

				/** validate data*/
				let missingData	= [];
				let allItemIds	= [];
				params.XMLInput.ITEMS.ITEM.map(record =>{
					if(record._attributes){
						if(record._attributes.ITEMID){
							allItemIds.push(String(record._attributes.ITEMID));
							allItemIds.push(parseInt(record._attributes.ITEMID));
						}else{
							missingData.push("ITEMID");
						}
					}else{
						missingData.push("ITEMID");
					}
				});

				if(missingData.length > 0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingData.join(", ")
				});

				let restaurantId= ObjectId(options.concept_ids[params.ConceptId]._id);

				const items 					=	db.collection("items");
				const item_units 				=	db.collection("item_units");
				const item_linkings 			=	db.collection("item_linkings");
				const item_dough_units 			=	db.collection("item_dough_units");
				const item_availability 		=	db.collection("item_availability");
				const item_group_extras 		=	db.collection("item_group_extras");
				const item_units_masters 		=	db.collection("item_units_masters");
				const item_extra_masters 		=	db.collection("item_extra_masters");
				const item_selector_units 		=	db.collection("item_selector_units");
				const item_choices_groups 		=	db.collection("item_choices_groups");
				const cravez_items 				= 	db.collection("cravez_items");
				const cravez_item_units 		= 	db.collection("cravez_item_units");
				const cravez_choices_groups 	= 	db.collection("cravez_choices_groups");
				const cravez_item_extra_masters = 	db.collection("cravez_item_extra_masters");
				const cravez_item_group_extras 	= 	db.collection("cravez_item_group_extras");

				/** Get all item list*/
				cravez_items.find({
					restaurant_id	: restaurantId,
					item_id			: {$in: allItemIds}
				}).toArray((err,itemList)=>{
					if(err) return resolve(respnoseCodes["002"]);

					if(itemList.length ==0) return resolve(respnoseCodes["005"]);

					let allVgropItemIds = [];
					eachOfSeries(params.XMLInput.ITEMS.ITEM,(data, dataIndex, asyncEachcallback)=>{
						data 			= 	data._attributes;
						let itemId 		=	String(data.ITEMID);
						let intItemId 	=	parseInt(data.ITEMID);

						asyncParallel({
							delete_kfg_item : (parellelCallback)=>{
								/** Delete cravez item  */
								cravez_items.deleteOne({
									item_id			: {$in: [itemId, intItemId]},
									restaurant_id	: restaurantId
								},(deleteErr)=>{
									parellelCallback(deleteErr);
								});
							},
							delete_kfg_item_units : (parellelCallback)=>{
								/** Delete cravez item unit  */
								cravez_item_units.deleteMany({
									 kfg_item_id	: {$in: [itemId, intItemId]},
									 restaurant_id	: restaurantId
									},(deleteErr)=>{
									parellelCallback(deleteErr);
								});
							},
							delete_kfg_item_choices_group : (parellelCallback)=>{
								/** Delete cravez item groups  */
								cravez_choices_groups.deleteMany({
									 kfg_item_id	: {$in: [itemId, intItemId]},
									 restaurant_id	: restaurantId
									},(deleteErr)=>{
									parellelCallback(deleteErr);
								});
							},
							delete_kfg_item_extra : (parellelCallback)=>{
								/** Delete cravez item extra  */
								cravez_item_extra_masters.deleteMany({
									 kfg_item_id	: {$in: [itemId, intItemId]},
									 restaurant_id	: restaurantId
									},(deleteErr)=>{
									parellelCallback(deleteErr);
								});
							},
							delete_kfg_item_group_extra : (parellelCallback)=>{
								/** Delete cravez item group extra  */
								cravez_item_group_extras.deleteMany({
									 kfg_item_id	: {$in: [itemId, intItemId]},
									 restaurant_id	: restaurantId
									},(deleteErr)=>{
									parellelCallback(deleteErr);
								});
							},
							delete_cr_item_extra : (parellelCallback)=>{
								/** Delete cravez item extra  */
								cravez_item_extra_masters.distinct("_id",{
									restaurant_id	: 	restaurantId,
									extra_item_id	:	{$in: [itemId, intItemId]}
								},(err, extraItemIds)=>{
									if(err || extraItemIds.length ==0) return parellelCallback(err);

									asyncParallel({
										delete_extra : (subCallback)=>{
											cravez_item_extra_masters.deleteMany({_id: {$in: extraItemIds} },(err) =>{
												subCallback(err);
											});
										},
										delete_extra_group : (subCallback)=>{
											cravez_item_group_extras.deleteMany({item_extra_id: {$in: extraItemIds }},(err) =>{
												subCallback(err);
											});
										},
									},(childEachErr)=>{
										parellelCallback(childEachErr);
									});
								});
							},
							delete_main_item : (parellelCallback)=>{
								items.find({
									restaurant_id	: restaurantId,
									$or : [
										{item_id: {$in: [itemId, intItemId]}},
										{"v_group_item_ids.item_id": {$in: [itemId, intItemId]}},
									]
								}).toArray((err,result)=>{
									if(err || result.length ==0) return parellelCallback(err);

									eachOfSeries(result,(itemData, dataItIndex, childEachcallback)=>{
										let itemObjId 		=	itemData._id;
										let mainItemId 		=	itemData.item_id;
										let vGroupIds		= 	itemData.v_group_item_ids;
										let isMainItem		=	(String(mainItemId) == String(itemId)) ? true :false;
										let updatedvGroupIds= 	[];

										if(vGroupIds){
											allVgropItemIds.push(itemObjId);

											vGroupIds.map(tmpData=>{
												if(tmpData.item_id != itemId){
													updatedvGroupIds.push(tmpData);
												}
											});
										}

										asyncParallel({
											update_item : (subCallback)=>{
												if(!vGroupIds) return subCallback(null);

												let itemUpdateData = {v_group_item_ids: updatedvGroupIds};
												if(updatedvGroupIds.length ==0) itemUpdateData.is_active = DEACTIVE;

												items.updateOne({
													restaurant_id	: restaurantId,
													"v_group_item_ids.item_id": {$in: [itemId, intItemId]}
												},{$set:itemUpdateData},(err)=>{
													subCallback(err);
												});
											},
											delete_item : (subCallback)=>{
												if(!isMainItem) return subCallback(null);

												items.deleteOne({
													restaurant_id	: restaurantId,
													item_id			: {$in: [itemId, intItemId]}
												},(deleteMapErr)=>{
													subCallback(deleteMapErr);
												});
											},
											delete_units : (subCallback)=>{
												if(!isMainItem) return subCallback(null);

												item_units.deleteMany({item_id: itemObjId},(deleteErr)=>{
													subCallback(deleteErr);
												});
											},
											delete_links : (subCallback)=>{
												if(!isMainItem) return subCallback(null);

												item_linkings.deleteMany({item_id: itemObjId },(err) =>{
													subCallback(err);
												});
											},
											delete_availability : (subCallback)=>{
												if(!isMainItem) return subCallback(null);

												item_availability.deleteMany({item_id: itemObjId },(err) =>{
													subCallback(err);
												});
											},
											delete_dough_units : (subCallback)=>{
												if(!isMainItem) return subCallback(null);

												item_dough_units.deleteMany({item_id: itemObjId },(err) =>{
													subCallback(err);
												});
											},
											delete_selector_units : (subCallback)=>{
												if(!isMainItem) return subCallback(null);

												item_selector_units.deleteMany({item_id: itemObjId },(err) =>{
													subCallback(err);
												});
											},
											delete_item_choices_groups : (subCallback)=>{
												if(!isMainItem) return subCallback(null);

												item_choices_groups.deleteMany({item_id: itemObjId },(err) =>{
													subCallback(err);
												});
											},
											delete_item_extra_masters : (subCallback)=>{
												if(!isMainItem) return subCallback(null);

												item_extra_masters.deleteMany({item_id: itemObjId },(err) =>{
													subCallback(err);
												});
											},
											delete_item_group_extras : (subCallback)=>{
												if(!isMainItem) return subCallback(null);

												item_group_extras.deleteMany({item_id: itemObjId },(err) =>{
													subCallback(err);
												});
											},
										},(childErr)=>{
											childEachcallback(childErr);

											/** Update Unit price*/
											axios.get(Constants.WEBSITE_URL + "crons/update_item_unit_price/"+itemObjId, {
												httpsAgent: new https.Agent({
													rejectUnauthorized: false
												})
											}).then(() => { }).catch(() => {});
										});
									},(childEachErr)=>{
										parellelCallback(childEachErr);
									});
								});
							},
							delete_item_extra : (parellelCallback)=>{
								/** Delete cravez item extra  */
								item_extra_masters.distinct("_id",{
									restaurant_id	: 	restaurantId,
									extra_item_id	:	{$in: [itemId, intItemId]}
								},(err, extraItemIds)=>{
									if(err || extraItemIds.length ==0) return parellelCallback(err);

									asyncParallel({
										delete_extra : (subCallback)=>{
											item_extra_masters.deleteMany({_id: {$in: extraItemIds} },(err) =>{
												subCallback(err);
											});
										},
										delete_extra_group : (subCallback)=>{
											item_group_extras.deleteMany({item_extra_id: {$in: extraItemIds }},(err) =>{
												subCallback(err);
											});
										},
									},(childEachErr)=>{
										parellelCallback(childEachErr);
									});
								});
							},
							delete_unit : (parellelCallback)=>{
								/** Get unit ids */
								item_units_masters.distinct("_id",{
									restaurant_id	: 	restaurantId,
									cravez_item_id	:	{$in: [itemId, intItemId]},
								},(unitErr, unitIds)=>{
									if(unitErr || unitIds.length <=0) return parellelCallback(unitErr);

									/** Delete unit items */
									item_units_masters.deleteMany({_id: {$in: unitIds} },(deleteErr)=>{
										if(deleteErr) return parellelCallback(deleteErr);

										/** Delete map units */
										item_units.deleteMany({item_unit_id: {$in: unitIds} },(deleteMapErr)=>{
											if(deleteMapErr) return parellelCallback(deleteMapErr);

											/** Delete extra */
											cravez_item_group_extras.deleteMany({unit_id: {$in: unitIds} },(deleteMapErr)=>{
												parellelCallback(deleteMapErr);
											});
										});
									});
								});
							},
						},(parentErr)=>{
							asyncEachcallback(parentErr);
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return resolve(respnoseCodes["002"]);

						resolve(respnoseCodes["000"]);

						itemList.map(data=>{
							let itemId 	 =	data.item_id;
							let vgroupId = 	data.vgroup_id;

							if(vgroupId){
								axios.get(Constants.WEBSITE_URL + "crons/update_cravez_item/"+itemId+"/"+vgroupId, {
									httpsAgent: new https.Agent({
										rejectUnauthorized: false
									})
								}).then(() => { }).catch(() => {});
							}
						});

						if(allVgropItemIds.length >0){
							items.deleteMany({
								_id: {$in: allVgropItemIds},
								v_group_item_ids : {$size: 0}
							},() =>{ });
						}
					});
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			}
		});
	};//End DeleteItems()

	/**
	 * Function to insert sub menu
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async InsertSubMenu(options){
		return new Promise(resolve=>{
			try{
				/** Save Kfg logs */
				axios({
					method: "GET",
					url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
					params: {
						method_name: "InsertSubMenu",
						response: options.params
					},
					httpsAgent: new https.Agent({
						rejectUnauthorized: false
					})
				}).catch(() => {});

				let params = options.params;
				let missingParameters = [];
				if(!params.ConceptId) missingParameters.push("ConceptId");
				if(!params.MenuId)    missingParameters.push("MenuId");
				if(!params.XMLInput)  missingParameters.push("XMLInput");

				if(missingParameters.length>0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingParameters.join(", ")
				});
				if(!params.XMLInput || !params.XMLInput.SubMenus || !params.XMLInput.SubMenus.Submenu) return resolve(respnoseCodes["001"]);

				if(params.XMLInput.SubMenus.Submenu.constructor != Array ){
					let tempObj = params.XMLInput.SubMenus.Submenu;
					params.XMLInput.SubMenus.Submenu = [];
					params.XMLInput.SubMenus.Submenu.push(tempObj);
				}

				/** validate data*/
				let recordIds		= [];
				let missingData		= [];
				params.XMLInput.SubMenus.Submenu.map(record =>{
					if(record._attributes){
						recordIds.push(record._attributes.ID);
						if(!record._attributes.ID) missingData.push("ID");
						if(!record._attributes.NAME) missingData.push("NAME");
						if(!record._attributes.NAMEARB) missingData.push("NAMEARB");
						if(!record._attributes.SEQ) missingData.push("SEQ");
					}else{
						missingData.push("ID, NAME, NAMEARB, SEQ");
					}
				});
				if(missingData.length > 0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingData.join(", ")
				});

				const restaurant_categories 	= db.collection("restaurant_categories");
				eachOfSeries(params.XMLInput.SubMenus.Submenu,(data, dataIndex, asyncEachcallback)=>{
					data = data._attributes;

					asyncParallel({
						unique_category_id : (parellelCallback)=>{
							/** get unique Id Response **/
							this.getUniqueId({type:"categories"}).then(uniqueIdResponse=>{

								let uniqueCategoryid = (uniqueIdResponse.result) ? uniqueIdResponse.result :"";
								parellelCallback(null,uniqueCategoryid);
							});
						}
					},(parallelErr,asyncReponse)=>{
						if(parallelErr) return resolve(respnoseCodes["002"]);

						/** Save record **/
						restaurant_categories.updateOne({
							cravez_menu_id	: params.MenuId,
							kfg_sub_menu_id : parseInt(data.ID),
						},
						{
							$set : {
								name: {
									en: data.NAME,
									ar: data.NAMEARB
								},
								tags		:	[data.NAME,data.NAMEARB],
								order		: 	parseInt(data.SEQ),
								is_active	: 	ACTIVE,
								modified	: 	getUtcDate(),
							},
							$setOnInsert: {
								restaurant_slug	: params.MenuId == PIZZA_HUT_MENU_ID ? PIZZA_HUT : BURGER_KING,
								restaurant_id	: ObjectId(options.concept_ids[params.ConceptId]._id),
								concept_id		: params.ConceptId,
								added_by		: options.super_admin_details._id,
								channel_id		: CHANNEL_SOAP,
								category_id		: asyncReponse.unique_category_id,
								kfg				: true,
							}
						},{upsert: true},(updateErr) => {
							asyncEachcallback(updateErr);
						});
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return resolve(respnoseCodes["002"]);
					resolve(respnoseCodes["000"]);
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			}
		});
	};//End InsertSubMenu()

	/**
	 * Function to update sub menu
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async UpdateSubMenu(options){
		return new Promise(resolve=>{
			try{
				/** Save Kfg logs */
				axios({
					method: "GET",
					url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
					params: {
						method_name: "UpdateSubMenu",
						response: options.params
					},
					httpsAgent: new https.Agent({
						rejectUnauthorized: false
					})
				}).catch(() => {});

				let params = options.params;
				let missingParameters = [];
				if(!params.ConceptId) missingParameters.push("ConceptId");
				if(!params.MenuId) missingParameters.push("MenuId");
				if(!params.XMLInput) missingParameters.push("XMLInput");

				if(missingParameters.length>0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingParameters.join(", ")
				});
				if(!params.XMLInput || !params.XMLInput.SubMenus || !params.XMLInput.SubMenus.Submenu) return resolve(respnoseCodes["001"]);

				if(params.XMLInput.SubMenus.Submenu.constructor != Array ){
					let tempObj = params.XMLInput.SubMenus.Submenu;
					params.XMLInput.SubMenus.Submenu = [];
					params.XMLInput.SubMenus.Submenu.push(tempObj);
				}

				/** validate data*/
				let recordIds		= [];
				let missingData		= [];
				params.XMLInput.SubMenus.Submenu.map(record =>{
					if(record._attributes){
						recordIds.push(record._attributes.ID);
						if(!record._attributes.ID) missingData.push("ID");
						if(!record._attributes.NAME) missingData.push("NAME");
						if(!record._attributes.NAMEARB) missingData.push("NAMEARB");
						if(!record._attributes.SEQ) missingData.push("SEQ");
					}else{
						missingData.push("ID, NAME, NAMEARB, SEQ");
					}
				});
				if(missingData.length > 0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingData.join(", ")
				});

				const restaurant_categories = db.collection("restaurant_categories");
				eachOfSeries(params.XMLInput.SubMenus.Submenu,(data, dataIndex, asyncEachcallback)=>{
					data = data._attributes;

					/** Save item unit details **/
					restaurant_categories.updateOne({
						cravez_menu_id	: {$in: [String(params.MenuId), parseInt(params.MenuId)]},
						kfg_sub_menu_id : parseInt(data.ID),
					},
					{$set : {
						name: {
							en: data.NAME,
							ar: data.NAMEARB
						},
						tags		:	[data.NAME,data.NAMEARB],
						order		: 	parseInt(data.SEQ),
						is_active	: 	ACTIVE,
						modified	: 	getUtcDate(),
					}},(updateErr) => {
						asyncEachcallback(updateErr);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return resolve(respnoseCodes["002"]);
					resolve(respnoseCodes["000"]);
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			}
		});
	};//End UpdateSubMenu()

	/**
	 * Function to delete sub menu
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async DeleteSubMenu(options){
		return new Promise(resolve=>{
			try{

				/** Save Kfg logs */
				axios({
					method: "GET",
					url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
					params: {
						method_name: "DeleteSubMenu",
						response: options.params
					},
					httpsAgent: new https.Agent({
						rejectUnauthorized: false
					})
				}).catch(() => {});

				let params = options.params;
				let missingParameters = [];
				if(!params.ConceptId) missingParameters.push("ConceptId");
				if(!params.MenuId) missingParameters.push("MenuId");
				if(!params.XMLInput) missingParameters.push("XMLInput");

				if(missingParameters.length>0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingParameters.join(", ")
				});

				if(!params.XMLInput || !params.XMLInput.SubMenus || !params.XMLInput.SubMenus.Submenu) return resolve(respnoseCodes["001"]);

				if(params.XMLInput.SubMenus.Submenu.constructor != Array ){
					let tempObj = params.XMLInput.SubMenus.Submenu;
					params.XMLInput.SubMenus.Submenu = [];
					params.XMLInput.SubMenus.Submenu.push(tempObj);
				}

				/** validate data*/
				let recordIds	= [];
				let missingData	= [];
				params.XMLInput.SubMenus.Submenu.map(record =>{
					if(record._attributes){
						if(!record._attributes.ID){
							missingData.push("ID");
						}else{
							recordIds.push(parseInt(record._attributes.ID), String(record._attributes.ID));
						}
					}else{
						missingData.push("ID");
					}
				});

				if(missingData.length > 0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingData.join(", ")
				});

				const items  				= db.collection("items");
				const restaurant_categories = db.collection("restaurant_categories");
				restaurant_categories.find({
					cravez_menu_id	: {$in: [String(params.MenuId), parseInt(params.MenuId)]},
					kfg_sub_menu_id : {$in : recordIds},
				},{projection:{_id:1,kfg_sub_menu_id:1}}).toArray((errs,result)=>{
					if(errs) return resolve(respnoseCodes["002"]);

					if(result.length == 0) return resolve(respnoseCodes["000"]);

					eachOfSeries(result,(data, dataIndex, asyncEachcallback)=>{
						items.updateMany({
							category_ids : {$in : [ObjectId(data._id)]}
						},
						{$pull : {
							category_ids : ObjectId(data._id)
						}},(error)=>{
							if(error) asyncEachcallback(error);

							/** delete category details **/
							restaurant_categories.deleteOne({_id: data._id },(err) => {
								asyncEachcallback(err);
							});
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return resolve(respnoseCodes["002"]);
						resolve(respnoseCodes["000"]);
					});
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			}
		});
	};//End DeleteSubMenu()

	/**
	 * Function to delete kfg selectors
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async DeleteSelector(options){
		return new Promise(resolve=>{
			try{
				/** Save Kfg logs */
				axios({
					method: "GET",
					url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
					params: {
						method_name: "DeleteSelector",
						response: options.params
					},
					httpsAgent: new https.Agent({
						rejectUnauthorized: false
					})
				}).catch(() => {});

				let params = options.params;
				let missingParameters = [];
				if(!params.ConceptId) missingParameters.push("ConceptId");
				if(!params.MenuId) missingParameters.push("MenuId");
				if(!params.XMLInput) missingParameters.push("XMLInput");

				if(missingParameters.length>0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingParameters.join(", ")
				});

				if(!params.XMLInput || !params.XMLInput.SELECTORS || !params.XMLInput.SELECTORS.SELECTOR) return resolve(respnoseCodes["001"]);

				if(params.XMLInput.SELECTORS.SELECTOR.constructor != Array ){
					let tempObj = params.XMLInput.SELECTORS.SELECTOR;
					params.XMLInput.SELECTORS.SELECTOR = [];
					params.XMLInput.SELECTORS.SELECTOR.push(tempObj);
				}

				/** validate data*/
				let selectords		= [];
				let missingData		= [];
				params.XMLInput.SELECTORS.SELECTOR.map(record =>{
					if(record._attributes){
						if(!record._attributes.ID){
							missingData.push("ID");
						}else{
							selectords.push(parseInt(record._attributes.ID), String(record._attributes.ID));
						}
					}else{
						missingData.push("ID");
					}
				});

				if(missingData.length > 0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingData.join(", ")
				});

				let restaurantSlug	= 	(params.MenuId == PIZZA_HUT_MENU_ID) ? PIZZA_HUT : BURGER_KING;
				let restaurantId	=	ObjectId(options.concept_ids[params.ConceptId]._id);

				const items 				=	db.collection("items");
				const cravez_items 			= 	db.collection("cravez_items");
				const item_group_extras 	= 	db.collection("item_group_extras");
				const item_units_masters 	= 	db.collection("item_units_masters");
				const item_selector_units  	= 	db.collection("item_selector_units");
				item_units_masters.find({
					cravez_menu_id	: params.MenuId,
					kfg_selector 	: {$in : selectords}
				},{projection:{_id:1,kfg_selector:1}}).toArray((errs,result)=>{
					if(errs) return resolve(respnoseCodes["002"]);

					if(result.length == 0) return resolve(respnoseCodes["000"]);

					eachOfSeries(result,(data, dataIndex, asyncEachcallback)=>{
						let kfgStrSelector = String(data.kfg_selector);
						let kfgIntSelector = parseInt(data.kfg_selector);

						asyncParallel({
							delete_unit : (parellelCallback)=>{
								item_units_masters.deleteOne({_id : data._id},(err) =>{
									parellelCallback(err);
								});
							},
							delete_selector_unit : (parellelCallback)=>{
								item_selector_units.find({
									restaurant_id 	: restaurantId,
									item_unit_id	: data._id
								},{projection:{_id:1}}).toArray((selectorErrs,selectorRes)=>{
									if(selectorErrs || selectorRes.length ==0) return parellelCallback(selectorErrs);

									eachOfSeries(selectorRes,(selectorData,selectorResIndex,asyncChildCallback)=>{

										asyncParallel({
											delete_selector : (childCallback)=>{
												item_selector_units.deleteMany({_id: selectorData._id },(err) =>{
													childCallback(err);
												});
											},
											delete_item_group_extras : (childCallback)=>{
												item_group_extras.deleteMany({
													restaurant_id	:	restaurantId,
													selector_id 	:	selectorData._id
												},(err) =>{
													childCallback(err);
												});
											},
										},(parallelChildErr)=>{
											asyncChildCallback(parallelChildErr);
										});
									},(childEachErr)=>{
										parellelCallback(childEachErr);
									});
								});
							},
							delete_items : (parellelCallback)=>{
								cravez_items.deleteMany({
									restaurant_id : restaurantId,
									menu_id 	  : {$in: [String(params.MenuId), parseInt(params.MenuId)]},
									selector 	  : {$in: [String(data.kfg_selector), parseInt(data.kfg_selector)]},
								},(err) =>{
									parellelCallback(err);
								});
							},
							update_items : (parellelCallback)=>{
								items.find({
									restaurant_id 	: restaurantId,
									v_group_item_ids: { $elemMatch: { selector: {$in: [kfgStrSelector, kfgIntSelector ]} } }
								},{projection:{_id:1,v_group_item_ids:1}}).toArray((itemErrs,itemRes)=>{
									if(itemErrs || itemRes.length ==0) return parellelCallback(itemErrs);

									eachOfSeries(itemRes,(itemData, itemIndex, asyncChildCallback)=>{
										let vGroupItemIds  = itemData.v_group_item_ids;
										let updatedItemIds = [];

										vGroupItemIds.map(tmpData=>{
											if(tmpData.selector != kfgStrSelector){
												updatedItemIds.push(tmpData);
											}
										});

										asyncParallel({
											update_item : (childCallback)=>{
												let itemUpdateData = {v_group_item_ids: updatedItemIds};
												if(updatedItemIds.length ==0) itemUpdateData.is_active = DEACTIVE;

												items.updateOne({_id:itemData._id},{$set:itemUpdateData},(err)=>{
													childCallback(err);
												});
											},
										},(parallelChildErr)=>{
											asyncChildCallback(parallelChildErr);
										});
									},(childEachErr)=>{
										parellelCallback(childEachErr);
									});
								});
							},
						},(parallelErr)=>{
							asyncEachcallback(parallelErr);
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return resolve(respnoseCodes["002"]);
						resolve(respnoseCodes["000"]);
					});
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			}
		});
	};//End DeleteSelector()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async AddOrUpdateDoughType(options){
		return new Promise(resolve=>{
			try{
				/** Save Kfg logs */
				axios({
					method: "GET",
					url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
					params: {
						method_name: "AddOrUpdateDoughType",
						response: options.params
					},
					httpsAgent: new https.Agent({
						rejectUnauthorized: false
					})
				}).catch(() => {});

				let params = options.params;
				let missingParameters = [];
				if(!params.ConceptId) missingParameters.push("ConceptId");
				if(!params.MenuId) missingParameters.push("MenuId");
				if(!params.XMLInput) missingParameters.push("XMLInput");

				if(missingParameters.length>0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingParameters.join(", ")
				});

				if(!params.XMLInput || !params.XMLInput.DOUGHTYPELIST || !params.XMLInput.DOUGHTYPELIST.DOUGHTYPE) return resolve(respnoseCodes["001"]);

				if(params.XMLInput.DOUGHTYPELIST.DOUGHTYPE.constructor != Array ){
					let tempObj = params.XMLInput.DOUGHTYPELIST.DOUGHTYPE;
					params.XMLInput.DOUGHTYPELIST.DOUGHTYPE = [];
					params.XMLInput.DOUGHTYPELIST.DOUGHTYPE.push(tempObj);
				}

				/** validate data*/
				let missingData	= [];
				params.XMLInput.DOUGHTYPELIST.DOUGHTYPE.map(record =>{
					if(record._attributes){
						if(!record._attributes.ID) missingData.push("ID");
						if(!record._attributes.NAME) missingData.push("NAME");
						if(!record._attributes.NAMEARB) missingData.push("NAMEARB");
					}else{
						missingData.push("ID, NAME, NAMEARB");
					}
				});

				if(missingData.length > 0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingData.join(", ")
				});

				const item_units_masters 	= db.collection("item_units_masters");
				eachOfSeries(params.XMLInput.DOUGHTYPELIST.DOUGHTYPE,(data, dataIndex, asyncEachcallback)=>{
					data = data._attributes;

					asyncParallel({
						unique_item_unit_id : (parellelCallback)=>{
							/** get unique Id Response **/
							this.getUniqueId({type:"item_unit"}).then(uniqueIdResponse=>{
								let uniqueItemUnitid = (uniqueIdResponse.result) ? uniqueIdResponse.result :"";
								parellelCallback(null,uniqueItemUnitid);
							});
						}
					},(parallelErr,asyncReponse)=>{
						if(parallelErr) return resolve(respnoseCodes["002"]);

						/** Save item unit details **/
						item_units_masters.updateOne({
							restaurant_id	: 	ObjectId(options.concept_ids[params.ConceptId]._id),
							dough_type 		: 	parseInt(data.ID),
							cravez_menu_id	:	params.MenuId,
						},
						{
							$set : {
								name: {
									en: data.NAME,
									ar: data.NAMEARB
								},
								description: {
									en: (data.DESCRIPTION) 	  ? data.DESCRIPTION :"",
									ar: (data.DESCRIPTIONARB) ? data.DESCRIPTIONARB :""
								},
								modified: getUtcDate(),
							},
							$setOnInsert: {
								restaurant_slug	: params.MenuId == PIZZA_HUT_MENU_ID ? PIZZA_HUT : BURGER_KING,
								added_by		: options.super_admin_details._id,
								channel_id		: CHANNEL_SOAP,
								created			: getUtcDate(),
								item_unit_id	: asyncReponse.unique_item_unit_id,
								kfg				: true,
								concept_id		: params.ConceptId,
							}
						},{upsert: true},(updateErr) => {
							asyncEachcallback(updateErr);
						});
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return resolve(respnoseCodes["002"]);
					resolve(respnoseCodes["000"]);
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			}
		});
	};//End AddOrUpdateDoughType()

	/**
	 * Function to delete dough type
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async DeleteDoughType(options){
		return new Promise(resolve=>{
			try{
				/** Save Kfg logs */
				axios({
					method: "GET",
					url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
					params: {
						method_name: "DeleteDoughType",
						response: options.params
					},
					httpsAgent: new https.Agent({
						rejectUnauthorized: false
					})
				}).catch(() => {});

				let params = options.params;
				let missingParameters = [];
				if(!params.ConceptId) missingParameters.push("ConceptId");
				if(!params.MenuId) missingParameters.push("MenuId");
				if(!params.XMLInput) missingParameters.push("XMLInput");

				if(missingParameters.length>0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingParameters.join(", ")
				});

				if(!params.XMLInput || !params.XMLInput.DOUGHTYPELIST || !params.XMLInput.DOUGHTYPELIST.DOUGHTYPE) return resolve(respnoseCodes["001"]);

				if(params.XMLInput.DOUGHTYPELIST.DOUGHTYPE.constructor != Array ){
					let tempObj = params.XMLInput.DOUGHTYPELIST.DOUGHTYPE;
					params.XMLInput.DOUGHTYPELIST.DOUGHTYPE = [];
					params.XMLInput.DOUGHTYPELIST.DOUGHTYPE.push(tempObj);
				}

				/** validate data*/
				let doughTypeIds	= [];
				let missingData		= [];
				params.XMLInput.DOUGHTYPELIST.DOUGHTYPE.map(record =>{
					if(record._attributes){
						if(!record._attributes.ID){
							missingData.push("ID");
						}else{
							doughTypeIds.push(parseInt(record._attributes.ID), String(record._attributes.ID));
						}
					}else{
						missingData.push("ID");
					}
				});

				if(missingData.length > 0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingData.join(", ")
				});

				let restaurantSlug	= 	(params.MenuId == PIZZA_HUT_MENU_ID) ? PIZZA_HUT : BURGER_KING;
				let restaurantId	=	ObjectId(options.concept_ids[params.ConceptId]._id);

				const items  				= 	db.collection("items");
				const cravez_items  		= 	db.collection("cravez_items");
				const item_dough_units  	= 	db.collection("item_dough_units");
				const item_selector_units  	= 	db.collection("item_selector_units");
				const item_group_extras  	= 	db.collection("item_group_extras");
				const item_units_masters	=	db.collection("item_units_masters");
				item_units_masters.find({
					restaurant_id 	: restaurantId,
					cravez_menu_id	: params.MenuId,
					dough_type 		: {$in : doughTypeIds}
				},{projection:{_id:1,dough_type:1}}).toArray((errs,result)=>{
					if(errs) return resolve(respnoseCodes["002"]);

					if(result.length == 0) return resolve(respnoseCodes["000"]);

					eachOfSeries(result,(data, dataIndex, asyncEachcallback)=>{
						let doughUnitId	=	data._id;
						let kfgStrDough	=	String(data.dough_type);
						let kfgIntDough	= 	parseInt(data.dough_type);

						asyncParallel({
							delete_unit : (parellelCallback)=>{
								item_units_masters.deleteOne({_id : data._id},(err) =>{
									parellelCallback(err);
								});
							},
							delete_dough_unit : (parellelCallback)=>{
								item_dough_units.find({
									restaurant_id 	: restaurantId,
									item_unit_id	: data._id
								},{projection:{_id:1,item_unit_id:1}}).toArray((doughErrs,doughRes)=>{
									if(doughErrs || doughRes.length ==0) return parellelCallback(doughErrs);

									eachOfSeries(doughRes,(doughData, doughIndex, asyncChildCallback)=>{

										asyncParallel({
											delete_dough_unit : (childCallback)=>{
												item_dough_units.deleteMany({_id: doughData._id },(err) =>{
													childCallback(err);
												});
											},
											update_selector : (childCallback)=>{
												/** Update item selector units */
												item_selector_units.update({
													restaurant_id 	  : restaurantId,
													dough_type_parents:  {$in: [doughData._id]}
												},
												{$pull: {
													dough_type_parents:  {$in: [doughData._id]}
												}},(error)=>{
													childCallback(error);
												});
											},
											delete_item_group_extras : (childCallback)=>{
												item_group_extras.deleteMany({
													restaurant_id : restaurantId,
													dough_type_id :	doughData._id
												},(err) =>{
													childCallback(err);
												});
											},
										},(parallelChildErr)=>{
											asyncChildCallback(parallelChildErr);
										});
									},(childEachErr)=>{
										parellelCallback(childEachErr);
									});
								});
							},
							delete_items : (parellelCallback)=>{
								cravez_items.deleteMany({
									restaurant_id : restaurantId,
									menu_id 	  : {$in: [String(params.MenuId), parseInt(params.MenuId)]},
									dough_type 	  : {$in: [kfgStrDough, kfgIntDough ]},
								},(err) =>{
									parellelCallback(err);
								});
							},
							update_items : (parellelCallback)=>{

								items.find({
									restaurant_id 	: restaurantId,
									v_group_item_ids: { $elemMatch: { dough_type: {$in: [kfgStrDough, kfgIntDough ]} } }
								},{projection:{_id:1,v_group_item_ids:1}}).toArray((itemErrs,itemRes)=>{
									if(itemErrs || itemRes.length ==0) return parellelCallback(itemErrs);

									eachOfSeries(itemRes,(itemData, itemIndex, asyncChildCallback)=>{
										let vGroupItemIds  = itemData.v_group_item_ids;
										let updatedItemIds = [];

										vGroupItemIds.map(tmpData=>{
											if(tmpData.dough_type != kfgStrDough){
												updatedItemIds.push(tmpData);
											}
										});

										asyncParallel({
											update_item : (childCallback)=>{
												let itemUpdateData = {v_group_item_ids: updatedItemIds};
												if(updatedItemIds.length ==0) itemUpdateData.is_active = DEACTIVE;

												items.updateOne({_id:itemData._id},{$set:itemUpdateData},(err)=>{
													childCallback(err);
												});
											},
										},(parallelChildErr)=>{
											asyncChildCallback(parallelChildErr);
										});
									},(childEachErr)=>{
										parellelCallback(childEachErr);
									});
								});
							},
						},(parallelErr)=>{
							asyncEachcallback(parallelErr);
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return resolve(respnoseCodes["002"]);
						resolve(respnoseCodes["000"]);
					});
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			}
		});
	};//End DeleteDoughType()

	/**
	 * Function to add or update size
	 *
	 * @param options As Parameters
	 *
	 * @return json
	 */
	async AddOrUpdateSize(options){
		return new Promise(resolve=>{
			try{
				/** Save Kfg logs */
				axios({
					method: "GET",
					url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
					params: {
						method_name: "AddOrUpdateSize",
						response: options.params
					},
					httpsAgent: new https.Agent({
						rejectUnauthorized: false
					})
				}).catch(() => {});

				let params = options.params;
				let missingParameters = [];
				if(!params.ConceptId) missingParameters.push("ConceptId");
				if(!params.MenuId) missingParameters.push("MenuId");
				if(!params.XMLInput) missingParameters.push("XMLInput");

				if(missingParameters.length>0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingParameters.join(", ")
				});
				if(!params.XMLInput || !params.XMLInput.SIZELIST || !params.XMLInput.SIZELIST.SIZE) return resolve(respnoseCodes["001"]);

				if(params.XMLInput.SIZELIST.SIZE.constructor != Array ){
					let tempObj = params.XMLInput.SIZELIST.SIZE;
					params.XMLInput.SIZELIST.SIZE = [];
					params.XMLInput.SIZELIST.SIZE.push(tempObj);
				}

				/** validate data*/
				let missingData		= [];
				params.XMLInput.SIZELIST.SIZE.map(record =>{
					if(record._attributes){
						if(!record._attributes.ID) missingData.push("ID");
						if(!record._attributes.NAME) missingData.push("NAME");
						if(!record._attributes.NAMEARB) missingData.push("NAMEARB");
					}else{
						missingData.push("ID, NAME, NAMEARB");
					}
				});

				if(missingData.length > 0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingData.join(", ")
				});

				const item_units_masters 	= db.collection("item_units_masters");
				eachOfSeries(params.XMLInput.SIZELIST.SIZE,(data, dataIndex, asyncEachcallback)=>{
					data = data._attributes;

					asyncParallel({
						unique_item_unit_id : (parellelCallback)=>{
							/** get unique Id Response **/
							this.getUniqueId({type:"item_unit"}).then(uniqueIdResponse=>{
								let uniqueItemUnitid = (uniqueIdResponse.result) ? uniqueIdResponse.result :"";
								parellelCallback(null,uniqueItemUnitid);
							});
						}
					},(parallelErr,asyncReponse)=>{

						/** Save item unit details **/
						item_units_masters.updateOne({
							restaurant_id	: 	ObjectId(options.concept_ids[params.ConceptId]._id),
							cravez_menu_id	:	params.MenuId,
							size_id 		:	{$in: [parseInt(data.ID), String(data.ID)]}
						},
						{
							$set : {
								name: {
									en: data.NAME,
									ar: data.NAMEARB
								},
								modified: getUtcDate(),
							},
							$setOnInsert: {
								restaurant_slug	: params.MenuId == PIZZA_HUT_MENU_ID ? PIZZA_HUT : BURGER_KING,
								size_id			: parseInt(data.ID),
								added_by		: options.super_admin_details._id,
								channel_id		: CHANNEL_SOAP,
								created			: getUtcDate(),
								item_unit_id	: asyncReponse.unique_item_unit_id,
								kfg				: true,
								concept_id		: params.ConceptId,
							}
						},{upsert: true},(updateErr) => {
							asyncEachcallback(updateErr);
						});
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return resolve(respnoseCodes["002"]);
					resolve(respnoseCodes["000"]);
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			}
		});
	};//End AddOrUpdateSize()

	/**
	 * Function to delete size
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async DeleteSize(options){
		return new Promise(resolve=>{
			try{
				/** Save Kfg logs */
				axios({
					method: "GET",
					url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
					params: {
						method_name: "DeleteSize",
						response: options.params
					},
					httpsAgent: new https.Agent({
						rejectUnauthorized: false
					})
				}).catch(() => {});

				let params = options.params;
				let missingParameters = [];
				if(!params.ConceptId) missingParameters.push("ConceptId");
				if(!params.MenuId) missingParameters.push("MenuId");
				if(!params.XMLInput) missingParameters.push("XMLInput");

				if(missingParameters.length>0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingParameters.join(", ")
				});

				if(!params.XMLInput || !params.XMLInput.SIZELIST || !params.XMLInput.SIZELIST.SIZE) return resolve(respnoseCodes["001"]);

				if(params.XMLInput.SIZELIST.SIZE.constructor != Array ){
					let tempObj = params.XMLInput.SIZELIST.SIZE;
					params.XMLInput.SIZELIST.SIZE = [];
					params.XMLInput.SIZELIST.SIZE.push(tempObj);
				}

				/** validate data*/
				let sizeIds		= [];
				let missingData		= [];
				params.XMLInput.SIZELIST.SIZE.map(record =>{
					if(record._attributes){
						if(!record._attributes.ID){
							missingData.push("ID");
						}else{
							sizeIds.push(parseInt(record._attributes.ID), String(record._attributes.ID));
						}
					}else{
						missingData.push("ID");
					}
				});

				if(missingData.length > 0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingData.join(", ")
				});

				let strMenuId		=	String(params.MenuId);
				let intMenuId		=	parseInt(params.MenuId);
				let restaurantSlug	= 	(params.MenuId == PIZZA_HUT_MENU_ID) ? PIZZA_HUT : BURGER_KING;
				let restaurantId	=	ObjectId(options.concept_ids[params.ConceptId]._id);

				const items		  			= 	db.collection("items");
				const item_units  			= 	db.collection("item_units");
				const cravez_items 			= 	db.collection("cravez_items");
				const item_dough_units 		= 	db.collection("item_dough_units");
				const item_selector_units 	= 	db.collection("item_selector_units");
				const item_group_extras 	= 	db.collection("item_group_extras");
				const item_units_masters 	=	db.collection("item_units_masters");
				item_units_masters.find({
					restaurant_id 	: restaurantId,
					cravez_menu_id	: {$in: [strMenuId, intMenuId]},
					size_id 		: {$in : sizeIds}
				},{projection:{_id:1,size_id:1}}).toArray((errs,result)=>{
					if(errs) return resolve(respnoseCodes["002"]);

					if(result.length == 0) return resolve(respnoseCodes["000"]);

					eachOfSeries(result,(data, dataIndex, asyncEachcallback)=>{
						let sizeUnitId	=	data._id;
						let kfgStrSize	=	String(data.size_id);
						let kfgIntSize	= 	parseInt(data.size_id);

						asyncParallel({
							delete_master_unit : (parellelCallback)=>{
								item_units_masters.deleteOne({_id : data._id},(err) =>{
									parellelCallback(err);
								});
							},
							delete_unit : (parellelCallback)=>{
								item_units.deleteMany({item_unit_id: sizeUnitId },(err) =>{
									parellelCallback(err);
								});
							},
							delete_items : (parellelCallback)=>{
								cravez_items.deleteMany({
									restaurant_id : restaurantId,
									menu_id 	  : {$in: [strMenuId, intMenuId]},
									size 	  	  : {$in: [kfgStrSize, kfgIntSize ]},
								},(err) =>{
									parellelCallback(err);
								});
							},
							update_items : (parellelCallback)=>{
								items.find({
									restaurant_id 	: restaurantId,
									v_group_item_ids: { $elemMatch: { size: {$in: [kfgStrSize, kfgIntSize ]} } }
								},{projection:{_id:1,v_group_item_ids:1}}).toArray((itemErrs,itemRes)=>{
									if(itemErrs || itemRes.length ==0) return parellelCallback(itemErrs);

									eachOfSeries(itemRes,(itemData, itemIndex, asyncChildCallback)=>{
										let vGroupItemIds  = itemData.v_group_item_ids;
										let updatedItemIds = [];

										vGroupItemIds.map(tmpData=>{
											if(tmpData.size != kfgStrSize){
												updatedItemIds.push(tmpData);
											}
										});

										asyncParallel({
											update_item : (childCallback)=>{
												let itemUpdateData = {v_group_item_ids: updatedItemIds};
												if(updatedItemIds.length ==0) itemUpdateData.is_active = DEACTIVE;

												items.updateOne({_id:itemData._id},{$set:itemUpdateData},(err)=>{
													childCallback(err);
												});
											},
										},(parallelChildErr)=>{
											asyncChildCallback(parallelChildErr);
										});
									},(childEachErr)=>{
										parellelCallback(childEachErr);
									});
								});
							},
							update_dough : (parellelCallback)=>{
								/** Update item dough units */
								item_dough_units.update({
									restaurant_id 	: restaurantId,
									parents:  {$in: [sizeUnitId]}
								},
								{$pull: {
									parents: {$in: [sizeUnitId] }
								}},(error)=>{
									parellelCallback(error);
								});
							},
							update_selector : (parellelCallback)=>{
								/** Update item selector units */
								item_selector_units.update({
									restaurant_id 	: restaurantId,
									parents:  {$in: [sizeUnitId]}
								},
								{$pull: {
									parents: {$in: [sizeUnitId] }
								}},(error)=>{
									parellelCallback(error);
								});
							},
							delete_item_group_extras : (childCallback)=>{
								item_group_extras.deleteMany({
									restaurant_id : restaurantId,
									unit_id 	  :	sizeUnitId
								},(err) =>{
									childCallback(err);
								});
							},
						},(parallelErr)=>{
							asyncEachcallback(parallelErr);
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return resolve(respnoseCodes["002"]);
						resolve(respnoseCodes["000"]);
					});
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			}
		});
	};//End DeleteSize()

	/**
	 * Function to update modifier group
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async AddModifierGroup(options){
		return new Promise(resolve=>{
			try{
				/** Save Kfg logs */
				axios({
					method: "GET",
					url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
					params: {
						method_name: "AddModifierGroup",
						response: options.params
					},
					httpsAgent: new https.Agent({
						rejectUnauthorized: false
					})
				}).catch(() => {});

				let params = options.params;
				let missingParameters = [];
				if(!params.ConceptId) 	missingParameters.push("ConceptId");
				if(!params.MenuId) 		missingParameters.push("MenuId");
				if(!params.XMLInput) 	missingParameters.push("XMLInput");

				if(missingParameters.length>0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingParameters.join(", ")
				});

				if(!params.XMLInput || !params.XMLInput.MODIFIERGROUPS || !params.XMLInput.MODIFIERGROUPS.MODIFIERGROUP) return resolve(respnoseCodes["001"]);

				if(params.XMLInput.MODIFIERGROUPS.MODIFIERGROUP.constructor != Array ){
					let tempObj = params.XMLInput.MODIFIERGROUPS.MODIFIERGROUP;
					params.XMLInput.MODIFIERGROUPS.MODIFIERGROUP = [];
					params.XMLInput.MODIFIERGROUPS.MODIFIERGROUP.push(tempObj);
				}

				/** validate data*/
				let allGroupIds	= [];
				let missingData	= [];
				params.XMLInput.MODIFIERGROUPS.MODIFIERGROUP.map(record =>{
					if(record._attributes){
						if(record._attributes.GROUPID)  allGroupIds.push(String(record._attributes.GROUPID), parseInt(record._attributes.GROUPID));
						if(!record._attributes.GROUPID) missingData.push("GROUPID");
						if(!record._attributes.NAME) 	missingData.push("NAME");
					}else{
						missingData.push("GROUPID, NAME");
					}
				});

				if(missingData.length > 0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingData.join(", ")
				});

				let adminId 		= 	options.super_admin_details._id;
				let restaurantId 	=	options.concept_ids[params.ConceptId]._id;
				let restaurantSlug 	=	(params.MenuId == PIZZA_HUT_MENU_ID) ? PIZZA_HUT :BURGER_KING;

				const cravez_modifier_groups = db.collection("cravez_modifier_groups");
				cravez_modifier_groups.countDocuments({restaurant_id: restaurantId, kfg_modifier_group_id: {$in: allGroupIds }},(contErr,contResult)=>{
					if(contErr) return resolve(respnoseCodes["002"]);

					if(contResult) return resolve(respnoseCodes["004"]);

					eachOfSeries(params.XMLInput.MODIFIERGROUPS.MODIFIERGROUP,(data, dataIndex, asyncEachcallback)=>{
						data = data._attributes;

						/** Save group details **/
						cravez_modifier_groups.updateOne({
							restaurant_id		  : restaurantId,
							kfg_modifier_group_id : {$in: [parseInt(data.GROUPID), String(data.GROUPID)]},
						},
						{
							$set : {
								name: {
									en: data.NAME,
									ar: (data.NAMEARB) ? data.NAMEARB :data.NAME
								},
								min			: 	(data.Min) ? parseInt(data.Min) : 0,
								max			: 	(data.Max) ? parseInt(data.Max) : 0,
								min_quantity:	(data.Min) ? parseInt(data.Min) : 0,
								max_quantity: 	(data.Max) ? parseInt(data.Max) : 0,
								modified	:	getUtcDate(),
							},
							$setOnInsert: {
								kfg				: true,
								order			: 10,
								added_by		: adminId,
								created			: getUtcDate(),
								channel_id		: CHANNEL_SOAP,
								concept_id		: params.ConceptId,
								cravez_menu_id	: params.MenuId,
								restaurant_slug	: restaurantSlug,
								kfg_modifier_group_id: parseFloat(data.GROUPID),
							}
						},{upsert: true},(updateErr) => {
							asyncEachcallback(updateErr);
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return resolve(respnoseCodes["002"]);
						resolve(respnoseCodes["000"]);
					});
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			}
		});
	};//End AddModifierGroup()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async UpdateModifierGroup(options){
		return new Promise(resolve=>{
			try{
				/** Save Kfg logs */
				axios({
					method: "GET",
					url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
					params: {
						method_name: "UpdateModifierGroup",
						response: options.params
					},
					httpsAgent: new https.Agent({
						rejectUnauthorized: false
					})
				}).catch(() => {});

				let params = options.params;
				let missingParameters = [];
				if(!params.ConceptId) 	missingParameters.push("ConceptId");
				if(!params.MenuId) 		missingParameters.push("MenuId");
				if(!params.XMLInput) 	missingParameters.push("XMLInput");

				if(missingParameters.length>0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingParameters.join(", ")
				});

				if(!params.XMLInput || !params.XMLInput.MODIFIERGROUPS || !params.XMLInput.MODIFIERGROUPS.MODIFIERGROUP) return resolve(respnoseCodes["001"]);

				if(params.XMLInput.MODIFIERGROUPS.MODIFIERGROUP.constructor != Array ){
					let tempObj = params.XMLInput.MODIFIERGROUPS.MODIFIERGROUP;
					params.XMLInput.MODIFIERGROUPS.MODIFIERGROUP = [];
					params.XMLInput.MODIFIERGROUPS.MODIFIERGROUP.push(tempObj);
				}

				/** validate data*/
				let missingData	= [];
				params.XMLInput.MODIFIERGROUPS.MODIFIERGROUP.map(record =>{
					if(record._attributes){
						if(!record._attributes.GROUPID) missingData.push("GROUPID");
						if(!record._attributes.NAME)	missingData.push("NAME");
					}else{
						missingData.push("GROUPID, NAME");
					}
				});

				if(missingData.length > 0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingData.join(", ")
				});

				let adminId 		= 	options.super_admin_details._id;
				let restaurantId 	=	options.concept_ids[params.ConceptId]._id;

				const item_choices_groups 		=	db.collection("item_choices_groups");
				const cravez_modifier_groups 	= 	db.collection("cravez_modifier_groups");
				const cravez_choices_groups 	= 	db.collection("cravez_choices_groups");
				eachOfSeries(params.XMLInput.MODIFIERGROUPS.MODIFIERGROUP,(data, dataIndex, asyncEachcallback)=>{
					data 			=	data._attributes;
					let strGroupId 	=	String(data.GROUPID);
					let intGroupId 	=	parseInt(data.GROUPID);

					asyncParallel({
						update_cravez_group : (parellelCallback)=>{
							/** Save group details **/
							cravez_modifier_groups.updateOne({
								restaurant_id		  : restaurantId,
								kfg_modifier_group_id : {$in: [strGroupId, intGroupId]},
							},
							{$set : {
								name: {
									en: data.NAME,
									ar: (data.NAMEARB) ? data.NAMEARB :data.NAME
								},
								min			: 	(data.Min) ? parseInt(data.Min) : 0,
								max			: 	(data.Max) ? parseInt(data.Max) : 0,
								min_quantity:	(data.Min) ? parseInt(data.Min) : 0,
								max_quantity: 	(data.Max) ? parseInt(data.Max) : 0,
								modified	:	getUtcDate(),
							}},(updateErr) => {
								parellelCallback(updateErr);
							});
						},
						update_group : (parellelCallback)=>{
							/** Save group details **/
							cravez_choices_groups.updateOne({
								restaurant_id			: restaurantId,
								kfg_modifiers_groups_id : {$in: [strGroupId, intGroupId]},
							},
							{$set : {
								name: {
									en: data.NAME,
									ar: (data.NAMEARB) ? data.NAMEARB :data.NAME
								},
								min			: 	(data.Min) ? parseInt(data.Min) : 0,
								max			: 	(data.Max) ? parseInt(data.Max) : 0,
								min_quantity:	(data.Min) ? parseInt(data.Min) : 0,
								max_quantity: 	(data.Max) ? parseInt(data.Max) : 0,
								modified	:	getUtcDate(),
							}},{upsert: true},(updateErr) => {
								parellelCallback(updateErr);
							});
						},
						update_item_group : (parellelCallback)=>{
							/** Update item group details **/
							item_choices_groups.updateMany({
								restaurant_id			: restaurantId,
								kfg_modifiers_groups_id : {$in: [strGroupId, intGroupId]}
							},
							{$set : {
								name: {
									en: data.NAME,
									ar: (data.NAMEARB) ? data.NAMEARB :data.NAME
								},
								max_quantity	: 	parseInt(data.Max),
								min_quantity	:	parseInt(data.Min),
								modified		:	getUtcDate(),
								updated_channel_id:	CHANNEL_SOAP,
							}},(updateErr) => {
								parellelCallback(updateErr);
							});
						}
					},(parallelErr)=>{
						asyncEachcallback(parallelErr);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return resolve(respnoseCodes["002"]);
					resolve(respnoseCodes["000"]);
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			}
		});
	};//End UpdateModifierGroup()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async DeleteModifierGroup(options){
		return new Promise(resolve=>{
			try{
				/** Save Kfg logs */
				axios({
					method: "GET",
					url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
					params: {
						method_name: "DeleteModifierGroup",
						response: options.params
					},
					httpsAgent: new https.Agent({
						rejectUnauthorized: false
					})
				}).catch(() => {});

				let params = options.params;
				let missingParameters = [];
				if(!params.ConceptId) 	missingParameters.push("ConceptId");
				if(!params.MenuId) 		missingParameters.push("MenuId");
				if(!params.XMLInput) 	missingParameters.push("XMLInput");

				if(missingParameters.length>0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingParameters.join(", ")
				});

				if(!params.XMLInput || !params.XMLInput.MODIFIERGROUPS || !params.XMLInput.MODIFIERGROUPS.MODIFIERGROUP) return resolve(respnoseCodes["001"]);

				if(params.XMLInput.MODIFIERGROUPS.MODIFIERGROUP.constructor != Array ){
					let tempObj = params.XMLInput.MODIFIERGROUPS.MODIFIERGROUP;
					params.XMLInput.MODIFIERGROUPS.MODIFIERGROUP = [];
					params.XMLInput.MODIFIERGROUPS.MODIFIERGROUP.push(tempObj);
				}

				/** validate data*/
				let missingData	= [];
				params.XMLInput.MODIFIERGROUPS.MODIFIERGROUP.map(record =>{
					if(!record._attributes) missingData.push("GROUPID");
					if(record._attributes && !record._attributes.GROUPID) missingData.push("GROUPID");
				});

				if(missingData.length > 0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingData.join(", ")
				});

				let restaurantId 	=	options.concept_ids[params.ConceptId]._id;

				const cravez_choices_groups 	= 	db.collection("cravez_choices_groups");
				const item_choices_groups 		=	db.collection("item_choices_groups");
				const item_group_extras 		=	db.collection("item_group_extras");
				const cravez_modifier_groups 	=	db.collection("cravez_modifier_groups");
				const cravez_item_group_extras 	=	db.collection("cravez_item_group_extras");
				eachOfSeries(params.XMLInput.MODIFIERGROUPS.MODIFIERGROUP,(data, dataIndex, asyncEachcallback)=>{
					data 			= 	data._attributes;
					let strGroupId 	=	String(data.GROUPID);
					let intGroupId 	=	parseInt(data.GROUPID);

					asyncParallel({
						delete_group : (parellelCallback)=>{
							/** Delete group **/
							cravez_modifier_groups.deleteOne({
								restaurant_id		  : restaurantId,
								kfg_modifier_group_id : {$in: [strGroupId, intGroupId]},
							},(deleteErr) => {
								parellelCallback(deleteErr);
							});
						},
						delete_cravez_choice_groups : (parellelCallback)=>{
							cravez_choices_groups.find({
								restaurant_id			: restaurantId,
								kfg_modifiers_groups_id : {$in: [strGroupId, intGroupId]},
							},{projection:{_id:1}}).toArray((errs,result)=>{
								if(errs || result.length ==0) return parellelCallback(errs);

								eachOfSeries(result,(groupData, groupIndex, eachChildCallback)=>{

									asyncParallel({
										delete_group : (childCallback)=>{
											/** Delete group **/
											cravez_choices_groups.deleteOne({_id: groupData._id },(deleteErr)=>{
												childCallback(deleteErr);
											});
										},
										delete_group_extra : (childCallback)=>{
											/** Delete group **/
											cravez_item_group_extras.deleteMany({group_id: groupData._id },(deleteErr)=>{
												childCallback(deleteErr);
											});
										},
									},(childErr)=>{
										eachChildCallback(childErr);
									});
								},(childEachErr)=>{
									parellelCallback(childEachErr);
								});
							});
						},
						delete_choice_groups : (parellelCallback)=>{
							item_choices_groups.find({
								restaurant_id			: restaurantId,
								kfg_modifiers_groups_id : {$in: [strGroupId, intGroupId]}
							},{projection:{_id:1}}).toArray((errs,result)=>{
								if(errs || result.length ==0) return parellelCallback(errs);

								eachOfSeries(result,(groupData, groupIndex, eachChildCallback)=>{

									asyncParallel({
										delete_group : (childCallback)=>{
											/** Delete group **/
											item_choices_groups.deleteOne({_id: groupData._id },(deleteErr)=>{
												childCallback(deleteErr);
											});
										},
										delete_group_extra : (childCallback)=>{
											/** Delete group extra **/
											item_group_extras.deleteMany({group_id: groupData._id },(deleteErr)=>{
												childCallback(deleteErr);
											});
										},
									},(childErr)=>{
										eachChildCallback(childErr);
									});
								},(childEachErr)=>{
									parellelCallback(childEachErr);
								});
							});
						}
					},(parentErr)=>{
						asyncEachcallback(parentErr);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return resolve(respnoseCodes["002"]);
					resolve(respnoseCodes["000"]);
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			}
		});
	};//End DeleteModifierGroup()

	/**
	 * Function to get get all modifier item
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getComboItemDetails(req, res,next){
		return new Promise(resolve=>{
			const cravez_items = db.collection("cravez_items");
			cravez_items.find({
				"restaurant_slug": BURGER_KING,
				is_combo	: 1,
				//non_sellable: 0,
			},{projection: {item_id: 1}}).toArray((err, result)=>{
				if(err) return resolve({status : STATUS_ERROR, err : err});

				resolve({status : STATUS_SUCCESS, result : result});

				eachOfSeries(result,(records, index, callback)=>{
					console.log(" Combo Item id - "+ records.item_id+"  index - "+index);

					axios.get(Constants.WEBSITE_URL + "get_combo_by_id/"+records.item_id, {
						httpsAgent: new https.Agent({
							rejectUnauthorized: false
						})
					}).then(() => {
						callback(null);
					}).catch(() => {
						callback(null);
					});
				},()=>{
					console.log(" getComboItemDetails Completed");
				});
			});
		});
	};//End getComboItemDetails()

	/**
	* Function to get combo item details
	*
	* @param req	As Request Data
	* @param res	As Response Data
	* @param next	As Callback argument to the middleware function
	*
	* @return json
	**/
	async getComboById (req, res,next,client){
		return new Promise(resolve=>{
			let comboId	= (req.params.combo_id) ? String(req.params.combo_id) :"";

			/** Send error response */
			if(!comboId) return resolve({status:STATUS_ERROR, message: "Missing parameters" });

			/** Call service */
			let comboReq = {LicenceKey: SOAP_LICENCE_KEY, ComboId: comboId};
			client["GetCombobyId"](comboReq,(err, response)=>{

				let apiData	= (response && response.GetCombobyIdResult) ? response.GetCombobyIdResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name 	:	"GetCombobyId",
					response		: 	response,
					// response		: 	client.lastResponse,
					request			:	comboReq,
					request_error	:	err
				}).then(()=>{});

				if (err) throw err;

				/** Send error response */
            	if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again.", apiData : apiData });

				let trimedData	= 	apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= 	JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				if(!jsonData || !jsonData.Combo || !jsonData.Combo.Combo_Name || !jsonData.Combo.Combo_Id || !jsonData.Combo.EnableUpsell || !jsonData.Combo.UpSells || !jsonData.Combo.Components){
					return resolve({status: STATUS_ERROR,  message:res.__("system.something_going_wrong_please_try_again"), jsonData : jsonData });
				}

				if(jsonData.Combo.UpSells.UpSell.constructor != Array ){
					let tempObj = jsonData.Combo.UpSells.UpSell;
					jsonData.Combo.UpSells.UpSell = [];
					jsonData.Combo.UpSells.UpSell.push(tempObj);
				}

				if(jsonData.Combo.Components.constructor != Array ){
					let tempObj = jsonData.Combo.Components;
					jsonData.Combo.Components = [];
					jsonData.Combo.Components.push(tempObj);
				}

				let regularUnit		=	"0";
				let itemPrice 		=	(jsonData.Combo.Combo_Price._text) ? parseFloat(jsonData.Combo.Combo_Price._text) :0;
            	let enableUpsell	=	jsonData.Combo.EnableUpsell._text.split(",");
				let finalUpsellList =	[];
				let upsellObj 		=	{};
				let lowsetPrice		=	0;
				jsonData.Combo.UpSells.UpSell.map(records=>{
					let tmpUpsellId = records.ComboUpsell_Id._text;
					let upsellPrice = records.ComboUpsell_Price._text ? parseFloat(records.ComboUpsell_Price._text) :0;

					if(enableUpsell.indexOf(tmpUpsellId) != -1){
						let tmpPrice = (tmpUpsellId != 0) ? upsellPrice+itemPrice :upsellPrice;
						finalUpsellList.push({
							upsell_id 	: 	tmpUpsellId,
							price 		:	tmpPrice,
							upsell_name	:	records.ComboUpsell_Name._text
						});

						if(!upsellObj[tmpUpsellId]) upsellObj[tmpUpsellId] = true;

						if(!lowsetPrice || lowsetPrice > tmpPrice) lowsetPrice = tmpPrice;
					}
				});
				if(!lowsetPrice) lowsetPrice = itemPrice;

				/** Push regular size if not exists in UpSells key  */
				if(!upsellObj[regularUnit] && enableUpsell.indexOf(regularUnit) != -1){
					upsellObj[regularUnit] = true;

					finalUpsellList.push({
						upsell_id 	: 	regularUnit,
						price 		:	itemPrice,
						upsell_name	:	UPSELL_TYPE_OBJECT[regularUnit].en
					});
				}

				let allExtraItemIds 	= 	[];
				let groupItemList 		= 	[];
				let unitWiseItem		= 	{};
				let componentWiseItem	=	{};
				let itemGroupList		=	[];
				let itemUpsellObj		= 	{};
				let upsellWiseItemDataObj= {};
				jsonData.Combo.Components.map((records,comIndex)=>{
					let tmpComponentId 		= 	records.ComboComponent_Id._text;
					let tmpComponentName	= 	records.ComboComponent_Name._text;
					let tmpComponentArName	= 	records.ComboComponent_NameARB._text;
					let tmpComponentItems	= 	(records.Items) ? records.Items.Item :[];

					if(tmpComponentItems.constructor != Array) tmpComponentItems = [tmpComponentItems];

					itemGroupList.push()

					let upsellWiseItemObj = {};
					tmpComponentItems.map(data=>{
						let tmpUpsellId = 	String(data.ComboUpsell_Id._text);
						let tmpItemId 	=	data.ITM_ID._text;

						allExtraItemIds.push(String(tmpItemId));

						if(enableUpsell.indexOf(tmpUpsellId) != -1){

							if(!upsellWiseItemObj[tmpUpsellId]) upsellWiseItemObj[tmpUpsellId] = [];

							upsellWiseItemObj[tmpUpsellId].push({
								item_id 	: 	tmpItemId,
								upsell_id 	:	tmpUpsellId,
								short_name 	:	data.ITM_SHORTNAME._text,
								sur_chg_usel:	parseFloat(data.SURCHGUSEL._text),
								size_sur_chg:	parseFloat(data.SIZESURCHG._text),
							});

							if(tmpComponentId == 1){
								itemUpsellObj[tmpUpsellId] = tmpItemId;

								if(!upsellWiseItemDataObj[tmpUpsellId]) upsellWiseItemDataObj[tmpUpsellId] = {};

								upsellWiseItemDataObj[tmpUpsellId] = {
									item_id 	:	data.ITM_ID._text,
									long_name 	: 	{en: data.ITM_LONGNAME._text, ar: data.ITM_LONGNAME._text },
									short_name 	: 	{en: data.ITM_SHORTNAME._text, ar: data.ITM_SHORTNAME._text },
									combo_short_name: {en: data.ITM_SHORTNAME._text, ar: data.ITM_SHORTNAME._text },
									upsell_id 	: 	data.ComboUpsell_Id._text,
									surchgusel 	: 	data.SURCHGUSEL._text,
									sizesurchg 	: 	data.SIZESURCHG._text,
									itemgrupid 	: 	data.ITEMGRUPID._text,
									parent_id	: 	data.ParentID._text,
									item_adjust_price: 	data.Item_Adjust_Price._text,
								};
							}else{
								if(!unitWiseItem[tmpUpsellId]) unitWiseItem[tmpUpsellId] ={};
								if(!unitWiseItem[tmpUpsellId][tmpComponentId]) unitWiseItem[tmpUpsellId][tmpComponentId] =0;
								unitWiseItem[tmpUpsellId][tmpComponentId]++;

								if(!componentWiseItem[tmpComponentId]) componentWiseItem[tmpComponentId] ={};
								if(!componentWiseItem[tmpComponentId][tmpUpsellId]) componentWiseItem[tmpComponentId][tmpUpsellId] =0;
								componentWiseItem[tmpComponentId][tmpUpsellId]++;
							}
						}
					});

					let tmpItemList = [];
					enableUpsell.map(tmpSellId=>{
						if(upsellWiseItemObj[tmpSellId] && upsellWiseItemObj[tmpSellId].length > 0){
							tmpItemList = tmpItemList.concat(upsellWiseItemObj[tmpSellId]);
						}
					});

					if(tmpItemList.length >0){
						groupItemList.push({
							combo_components_id	:	tmpComponentId,
							group_en_name 		:	tmpComponentName,
							group_ar_name 		:	tmpComponentArName,
							item_list			:	tmpItemList,
							order			 	:	parseFloat(1+"."+comIndex),
						});
					}
				});

				if(finalUpsellList.length == 0 || groupItemList.length == 0) return resolve({status: STATUS_ERROR,  message:res.__("system.something_going_wrong_please_try_again"), finalUpsellList : finalUpsellList, groupItemList : groupItemList });

				const users 					= 	db.collection("users");
				const cravez_items 				= 	db.collection("cravez_items");
				const item_units_masters 		= 	db.collection("item_units_masters");
				const cravez_item_units 		= 	db.collection("cravez_item_units");
				const cravez_choices_groups 	= 	db.collection("cravez_choices_groups");
				const cravez_item_group_extras 	= 	db.collection("cravez_item_group_extras");
				const cravez_item_extra_masters = 	db.collection("cravez_item_extra_masters");

				asyncParallel({
					combo_item_details : (itemCallback)=>{
						cravez_items.findOne({ item_id: comboId },{projection:{ restaurant_id:1, restaurant_slug:1 }},(itemErr, itemResult)=>{
							itemCallback(itemErr, itemResult);
						});
					},
					super_admin_details: (superAdminDetails)=>{
						/** get admin details  */
						users.findOne({user_role_id: CRAVEZ },{projection:{_id:1}},(userErr, userResult)=>{
							superAdminDetails(userErr, userResult);
						});
					},
					item_list: (itemCallback)=>{
						/** Get item list  */
						cravez_items.find({ item_id : {$in: allExtraItemIds} }).toArray((itemErr, itemResult)=>{
							if(itemErr) return itemCallback(itemErr, {});

							let cravezItemList = {};
							itemResult.map(records=>{
								cravezItemList[records.item_id] = records;
							});
							itemCallback(itemErr, cravezItemList);
						});
					},
					update_units : (itemCallback)=>{

						cravez_item_units.updateMany({kfg_item_id : comboId, },{$set: { to_be_deleted: true}},(updateErr) => {
							itemCallback(updateErr);
						});
					},
					update_choices_groups : (itemCallback)=>{
						cravez_choices_groups.updateMany({
							kfg_item_id 			: comboId,
							kfg_combo_components_id : {$exists : true},
						},
						{$set : {
							to_be_deleted	: true
						}},(updateErr) => {
							itemCallback(updateErr);
						});
					},
					update_extra_masters : (itemCallback)=>{
						cravez_item_extra_masters.updateMany({
							kfg_item_id 			: comboId,
							kfg_combo_components_id : {$exists : true},
						},
						{$set : {
							to_be_deleted	: true
						}},(updateErr) => {
							itemCallback(updateErr);
						});
					},
					update_group_extras : (itemCallback)=>{
						cravez_item_group_extras.updateMany({
							kfg_item_id 			: comboId,
							kfg_combo_components_id : {$exists : true},
						},
						{$set : {
							to_be_deleted	: true
						}},(updateErr) => {
							itemCallback(updateErr);
						});
					},
				},(parentErrs, parentResponse)=>{
					if(parentErrs){
						return resolve({status:STATUS_ERROR, message: "Something went wrong, Please try again.", error: parentErrs });
					}

					let cravezItemList 		=	parentResponse.item_list;
					let itemComboDetails 	=	parentResponse.combo_item_details;
					let adminDetails 		= 	parentResponse.super_admin_details;

					/** Send error response */
					if(!itemComboDetails || !adminDetails || Object.keys(cravezItemList).length ==0){
						return resolve({status: STATUS_ERROR, message: "invalid access", itemComboDetails: itemComboDetails, adminDetails: adminDetails, cravezItemList: cravezItemList });
					}

					if(Object.keys(upsellWiseItemDataObj).length >0 ){
						Object.keys(upsellWiseItemDataObj).map(tmpKey=>{
							let tmpComId = upsellWiseItemDataObj[tmpKey].item_id;

							if(cravezItemList[tmpComId] && cravezItemList[tmpComId].name){
								upsellWiseItemDataObj[tmpKey].short_name = cravezItemList[tmpComId].name;
							}
						});
					}

					let unitMasterIds 	=	{};
					let addedBy			=	adminDetails._id;
					let restaurantId	=	itemComboDetails.restaurant_id;
					let restaurantSlug	= 	itemComboDetails.restaurant_slug;
					asyncEach(enableUpsell,(tmpUpsellId, eachCallback)=>{
						tmpUpsellId 			=	parseInt(tmpUpsellId);
						let tmpUpsellNameObj 	=	UPSELL_TYPE_OBJECT[tmpUpsellId];

						/** Get unit master details */
						item_units_masters.findOne({
							combo_upsell_id : tmpUpsellId,
							restaurant_id 	: restaurantId,
						},{projection: {_id: 1 }},(masterErr,masterResult)=>{
							if(masterErr) return eachCallback(masterErr);

							if(masterResult){
								unitMasterIds[tmpUpsellId] = masterResult._id;

								return eachCallback(masterErr);
							}

							/** Save unit master detils */
							item_units_masters.updateOne({
								combo_upsell_id : tmpUpsellId,
								restaurant_id 	: restaurantId,
							},
							{
								$set:	{
									name   	 : tmpUpsellNameObj,
									modified : getUtcDate(),
								},
								$setOnInsert:	{
									added_by		:	addedBy,
									channel_id		:	CHANNEL_SOAP,
									restaurant_slug :	restaurantSlug,
									created   		:	getUtcDate(),
									kfg		 		: 	true,
								}
							},{upsert: true },(insertErr,insertResult)=>{
								if(insertResult &&  insertResult.upsertedId && insertResult.upsertedId._id){

									unitMasterIds[tmpUpsellId] = insertResult.upsertedId._id;
								}
								eachCallback(insertErr);
							});
						});
					},(asyncEachErr)=>{
						if(asyncEachErr){
							return resolve({status:STATUS_ERROR, message: "Something went wrong, Please try again.", error: asyncEachErr });
						}

						asyncForEachOf(finalUpsellList,(records,unitIndex,eachSubCallback)=>{
							let tmpUpsellId		=	parseInt(records.upsell_id);
							let unitId			=	(unitMasterIds[tmpUpsellId]) ? unitMasterIds[tmpUpsellId] :"";
							let itemHavePrice	=	false;

							if(Object.keys(unitWiseItem[tmpUpsellId]).length >0){
								Object.keys(unitWiseItem[tmpUpsellId]).map(tmpComponentId=>{
									if(unitWiseItem[tmpUpsellId][tmpComponentId] > 1) itemHavePrice = true;
								});
							}

							if(!unitId){
								console.error("Item Unit not found in GetCombobyId ",JSON.stringify(records));
								return eachSubCallback(null);
							}

							/** Set update Data */
							let unitUpdateData = {
								$set:	{
									price		:	records.price,
									sorting		:	tmpUpsellId+1,
									modified 	:	getUtcDate(),
								},
								$setOnInsert: {
									added_by		:	addedBy,
									channel_id		:	CHANNEL_SOAP,
									restaurant_slug :	restaurantSlug,
									created   		:	getUtcDate(),
									kfg		 		: 	true,
								},
								$unset : {
									to_be_deleted : 1
								}
							}

							if(!itemHavePrice){
								unitUpdateData["$set"].status 			=	DEACTIVE;
								unitUpdateData["$set"].is_auto_selected	= 	true;
							}else{
								unitUpdateData["$setOnInsert"].status 		= 	ACTIVE;
								unitUpdateData["$unset"].is_auto_selected 	=	1;
							}

							/** Save unit  detils */
							cravez_item_units.updateOne({
								kfg_item_id 	: comboId,
								restaurant_id 	: restaurantId,
								item_unit_id 	: unitId,
							},unitUpdateData,{upsert: true },(insertErr)=>{
								eachSubCallback(insertErr);
							});
						},(asyncSubEachErr)=>{
							if(asyncEachErr){
								return resolve({status: STATUS_ERROR, message: "Something went wrong, Please try again.", error: asyncSubEachErr });
							}

							let comboChoiceIds = {};
							asyncEach(groupItemList,(records, eachSubCallback)=>{
								let tmpComponentsId =	parseInt(records.combo_components_id);
								let itemList 		= 	records.item_list;

								asyncParallel({
									group_list : (parallelCallback)=>{
										cravez_choices_groups.findOne({
											kfg_item_id 			: 	comboId,
											restaurant_id 			:	restaurantId,
											kfg_combo_components_id : 	tmpComponentsId,
										},{projection: {_id: 1,}},(masterErr,masterResult)=>{
											if(masterErr) return parallelCallback(masterErr);

											if(masterResult){
												if(!comboChoiceIds[tmpComponentsId]) comboChoiceIds[tmpComponentsId] = masterResult._id;

												cravez_choices_groups.updateOne({
													_id : 	masterResult._id,
												},
												{
													$set:	{
														name   : {
															en : records.group_en_name,
															ar : records.group_ar_name,
														},
														order 	 : records.order,
														modified : getUtcDate(),
														min_quantity 	:	1,
														max_quantity 	: 	1,
													},
													$unset : {
														to_be_deleted : 1
													}
												},(insertErr)=>{
													parallelCallback(insertErr);
												});
											}else{
												/** Save item choice detils */
												cravez_choices_groups.updateOne({
													kfg_item_id 			: 	comboId,
													restaurant_id 			:	restaurantId,
													kfg_combo_components_id : 	tmpComponentsId,
												},
												{
													$set:	{
														name   : {
															en : records.group_en_name,
															ar : records.group_ar_name,
														},
														order 	 : records.order,
														modified : getUtcDate(),
													},
													$setOnInsert:	{
														min_quantity 	:	1,
														max_quantity 	: 	1,
														added_by		:	addedBy,
														channel_id		:	CHANNEL_SOAP,
														restaurant_slug :	restaurantSlug,
														created   		:	getUtcDate(),
														kfg		 		: 	true,
													},
													$unset : {
														to_be_deleted : 1
													}
												},{upsert: true },(insertErr,insertResult)=>{
													if(insertResult &&  insertResult.upsertedId && insertResult.upsertedId._id){
														comboChoiceIds[tmpComponentsId] = insertResult.upsertedId._id;
													}
													parallelCallback(insertErr);
												});
											}
										});
									}
								},(parallelErr)=>{
									if(parallelErr) return eachSubCallback(parallelErr);

									let choiceGroupId = comboChoiceIds[tmpComponentsId];

									if(!choiceGroupId){
										console.error("Choice group id not found combo id- "+comboId+" component id- "+tmpComponentsId);

										return eachSubCallback(null);
									}

									asyncEach(itemList,(itemData, childCallback)=>{
										let exItemId 	= 	String(itemData.item_id);
										let upsellId 	= 	itemData.upsell_id;
										let unitId 		=	(unitMasterIds[upsellId]) 	?	unitMasterIds[upsellId] 	:null;
										let itemDetails = 	(cravezItemList[exItemId])	?	cravezItemList[exItemId]	:null;

										if(!itemDetails || !unitId){
											if(!itemDetails || !unitId){
												console.error("Combo extra item or unit details not found combo id - "+comboId+" Extra Item id - "+exItemId+" Upsell id - "+upsellId);
												console.error(itemData);
											}
											return childCallback(null);
										}

										let tmpItemHavePrice = false;
										if(unitWiseItem[upsellId][tmpComponentsId]){
											if(unitWiseItem[upsellId][tmpComponentsId] == 1){
												itemList.map(tmpRecord=>{
													if(tmpRecord.sur_chg_usel >0){
														tmpItemHavePrice = true;
													}
												});
											}else{
												tmpItemHavePrice = true;
											}
										}

										asyncParallel({
											extra_list : (parallelChildCallback)=>{
												cravez_item_extra_masters.findOne({
													kfg_item_id 			: 	comboId,
													restaurant_id 			:	restaurantId,
													extra_item_id			:	exItemId,
													item_unit_id 			: 	ObjectId(unitId),
													kfg_combo_components_id : 	tmpComponentsId,
												},{projection: {_id: 1,}},(masterErr,masterResult)=>{
													if(masterErr) return parallelChildCallback(masterErr,masterResult);

													let itemDataToBeUpdated = {
														$set : {
															name   			: 	itemDetails.name,
															modified 		:	getUtcDate(),
															extra_fees		: 	itemData.sur_chg_usel,
															kfg_sur_chg_usel:	itemData.sur_chg_usel,
															kfg_size_sur_chg: 	itemData.size_sur_chg,
															item_short_name	:	itemData.short_name,
														},
														$setOnInsert : {
															channel_id		:	CHANNEL_SOAP,
															added_by		:	addedBy,
															restaurant_slug :	restaurantSlug,
															created   		:	getUtcDate(),
															kfg		 		: 	true,
															kfg_upsell_id 	:	upsellId,
														},
														$unset : {
															to_be_deleted : 1
														}
													};

													if(!tmpItemHavePrice ||  itemData.single_item || tmpComponentsId == 1){
														itemDataToBeUpdated["$set"].is_active 			= 	DEACTIVE;
														itemDataToBeUpdated["$set"].is_auto_selected 	=	true;

														if(tmpComponentsId == 1){
															itemDataToBeUpdated["$set"].is_first_component=	true;
														}
													}else{
														itemDataToBeUpdated["$set"].is_active 			= 	ACTIVE;
														itemDataToBeUpdated["$unset"].is_auto_selected 	=	1;
													}

													let masterId = (masterResult) ? masterResult._id :"";
													if(masterResult){
														cravez_item_extra_masters.updateOne({
															kfg_item_id 			: 	comboId,
															restaurant_id 			:	restaurantId,
															extra_item_id			:	exItemId,
															item_unit_id 			: 	ObjectId(unitId),
															kfg_combo_components_id : 	tmpComponentsId,
														},itemDataToBeUpdated,(insertErr)=>{
															parallelChildCallback(insertErr,masterId);
														});
													}else{
														/** Save extra master details */
														cravez_item_extra_masters.updateOne({
															kfg_item_id 		: 	comboId,
															restaurant_id 		:	restaurantId,
															extra_item_id		:	exItemId,
															item_unit_id 		: 	ObjectId(unitId),
															kfg_combo_components_id: tmpComponentsId,
														},itemDataToBeUpdated,{upsert: true },(insertErr,insertResult)=>{
															let masterId = (insertResult &&  insertResult.upsertedId && insertResult.upsertedId._id) ? insertResult.upsertedId._id:"";
															parallelChildCallback(insertErr,masterId);
														});
													}
												});
											}
										},(childParallelErr, childParallelResponse)=>{
											if(childParallelErr) return childCallback(childParallelErr);

											if(!childParallelResponse.extra_list){
												console.error("Combo extra item details not found ",JSON.stringify(itemData),"\n");
												return childCallback(childParallelErr);
											}

											let exGroupUpdateData = {
												$set	:	{
													extra_fees	:	itemData.sur_chg_usel,
													modified 	:	getUtcDate(),
												},
												$setOnInsert:	{
													channel_id		:	CHANNEL_SOAP,
													added_by		:	addedBy,
													restaurant_slug :	restaurantSlug,
													unit_id 		: 	ObjectId(unitId),
													created   		:	getUtcDate(),
													kfg		 		: 	true,
													kfg_upsell_id 	:	upsellId,
													kfg_combo_components_id :	tmpComponentsId,
												},
												$unset : {
													to_be_deleted : 1
												}
											}


											if(!tmpItemHavePrice ||  itemData.single_item || tmpComponentsId == 1){
												exGroupUpdateData["$set"].is_auto_selected 	=	true;

												if(tmpComponentsId == 1){
													exGroupUpdateData["$set"].is_first_component 	=	true;
												}
											}else{
												exGroupUpdateData["$unset"].is_auto_selected =	true;
											}

											/** Save item group details */
											cravez_item_group_extras.updateOne({
												kfg_item_id 	: 	comboId,
												restaurant_id 	:	restaurantId,
												group_id 		: 	ObjectId(choiceGroupId),
												item_extra_id	:	childParallelResponse.extra_list,
											},exGroupUpdateData,{upsert: true },(insertErr)=>{
												childCallback(insertErr);
											});
										});
									},(childEachErr)=>{
										eachSubCallback(childEachErr);
									});
								});
							},(asyncSubEachErr)=>{
								if(asyncSubEachErr){
									return resolve({status:STATUS_ERROR, message: "Something went wrong, Please try again.", error: asyncSubEachErr });
								}else{

									asyncParallel({
										combo_item_details : (itemCallback)=>{
											/** Update item */
											cravez_items.updateOne({
												item_id : comboId
											},
											{$set : {
												is_updated				:	true,
												item_price				:	lowsetPrice,
												combo_upsell_item_ids	:	itemUpsellObj,
												first_component_details	:	upsellWiseItemDataObj,
												modified				:	getUtcDate(),
											}},(updateErr)=>{
												itemCallback(updateErr);
											});
										},
										update_units : (itemCallback)=>{
											cravez_item_units.deleteMany({
												kfg_item_id : comboId,
												to_be_deleted	: true
											},(deleteErr) => {
												itemCallback(deleteErr);
											});
										},
										update_choices_groups : (itemCallback)=>{
											cravez_choices_groups.deleteMany({
												kfg_item_id : comboId,
												to_be_deleted	: true,
												kfg_combo_components_id : {$exists : true}
											},(deleteErr) => {
												itemCallback(deleteErr);
											});
										},
										update_extra_masters : (itemCallback)=>{
											cravez_item_extra_masters.deleteMany({
												kfg_item_id : comboId,
												to_be_deleted	: true,
												kfg_combo_components_id : {$exists : true}
											},(deleteErr) => {
												itemCallback(deleteErr);
											});
										},
										update_group_extras : (itemCallback)=>{
											cravez_item_group_extras.deleteMany({
												kfg_item_id : comboId,
												to_be_deleted	: true,
												kfg_combo_components_id : {$exists : true}
											},(deleteErr) => {
												itemCallback(deleteErr);
											});
										},
									},(parentErrs)=>{
										if(parentErrs){
											return resolve({status:STATUS_ERROR, message: "Something went wrong, Please try again.", error: parentErrs });
										}

										/** Send success response */
										resolve({status: STATUS_SUCCESS, groupItemList : groupItemList });
									});
								}
							});
						});
					});
				});
			});
		}).catch(next);
	};//End getComboById()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async RefreshFeedbackTypes(params){
		return new Promise(resolve=>{
			resolve({
				ResponseCode : "000",
				ResponseDesc : "Success"
			});
		});
	};//End RefreshFeedbackTypes()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async RefreshPaymentTypes(params){
		return new Promise(resolve=>{
			resolve({
				ResponseCode : "000",
				ResponseDesc : "Success"
			});
		});
	};//End RefreshPaymentTypes()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async ItemAndModifierGroupMap(options){
		return new Promise(resolve=>{
			try{
				/** Save Kfg logs */
				axios({
					method: "GET",
					url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
					params: {
						method_name: "ItemAndModifierGroupMap",
						response: options.params
					},
					httpsAgent: new https.Agent({
						rejectUnauthorized: false
					})
				}).catch(() => {});

				let params = options.params;
				let missingParameters = [];
				if(!params.ConceptId) missingParameters.push("ConceptId");
				if(!params.MenuId) missingParameters.push("MenuId");
				if(!params.XMLInput) missingParameters.push("XMLInput");

				if(missingParameters.length>0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingParameters.join(", ")
				});

				if(!params.XMLInput || !params.XMLInput.ITEMS || !params.XMLInput.ITEMS.ITEM) return resolve(respnoseCodes["001"]);

				if(params.XMLInput.ITEMS.ITEM.constructor != Array ){
					let tempObj = params.XMLInput.ITEMS.ITEM;
					params.XMLInput.ITEMS.ITEM = [];
					params.XMLInput.ITEMS.ITEM.push(tempObj);
				}

				/** validate data*/
				let inputItemIds	= [];
				let inputGroupIds	= [];
				let missingData		= [];
				params.XMLInput.ITEMS.ITEM.map((record,parentIndex) =>{
					if(record._attributes){
						if(record._attributes.ID){
							inputItemIds.push(parseInt(record._attributes.ID));
							inputItemIds.push(String(record._attributes.ID));

							if(record.MODIFIERGROUP){
								let modifierGroup = (record.MODIFIERGROUP.constructor != Array) ? [record.MODIFIERGROUP] :record.MODIFIERGROUP;

								modifierGroup.map(data =>{
									if(data._attributes.GROUPID){
										inputGroupIds.push(parseInt(data._attributes.GROUPID));
										inputGroupIds.push(String(data._attributes.GROUPID));
									}else{
										missingData.push("GROUPID index- "+parentIndex);
									}

									if(data.MODITEMS){
										let modifyItem = (data.MODITEMS.constructor != Array) ? [data.MODITEMS] :data.MODITEMS;

										modifyItem.map(exItemData =>{
											if(exItemData._attributes.ID){
												inputItemIds.push(parseInt(exItemData._attributes.ID));
												inputItemIds.push(String(exItemData._attributes.ID));
											}else{
												missingData.push("Extra Item ID index- "+parentIndex);
											}
										});
									}else{
										missingData.push("MODITEMS index- "+parentIndex);
									}
								});
							}else{
								missingData.push("MODIFIERGROUP index- "+parentIndex);
							}
						}else{
							missingData.push("ID index- "+parentIndex);
						}
					}else{
						missingData.push("ID index- "+parentIndex);
					}
				});

				if(missingData.length > 0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingData.join(", ")
				});

				let adminId 	= 	options.super_admin_details._id;
				let restId		=	ObjectId(options.concept_ids[params.ConceptId]._id);
				let restSlug	= 	(params.MenuId == PIZZA_HUT_MENU_ID) ? PIZZA_HUT :BURGER_KING;

				const cravez_items 				= db.collection("cravez_items");
				const cravez_choices_groups 	= db.collection("cravez_choices_groups");
				const cravez_modifier_groups 	= db.collection("cravez_modifier_groups");
				const cravez_item_group_extras 	= db.collection("cravez_item_group_extras");
				const cravez_item_extra_masters = db.collection("cravez_item_extra_masters");
				asyncParallel({
					item_list : (parentCallback)=>{
						cravez_items.find({
							item_id 		: {$in: inputItemIds},
							restaurant_id 	: restId
						}).toArray((err, result)=>{
							if(err || result.length ==0) return parentCallback(err, null);

							let tmpObj = {};
							result.map(records=>{
								tmpObj[records.item_id] = records;
							});
							parentCallback(err, tmpObj);
						});
					},
					group_list : (parentCallback)=>{
						cravez_modifier_groups.find({
							kfg_modifier_group_id:	{$in: inputGroupIds},
							restaurant_id 		 : 	restId
						}).toArray((err, result)=>{
							if(err || result.length ==0) return parentCallback(err, null);

							let tmpObj = {};
							result.map(records=>{
								tmpObj[records.kfg_modifier_group_id] = records;
							});
							parentCallback(err, tmpObj);
						});
					},
					update_choices_groups : (parentCallback)=>{
						cravez_choices_groups.updateMany({
							kfg_item_id 	:	{$in: inputItemIds},
							restaurant_id	: 	restId,
							kfg_combo_components_id : {$exists : false},
						},
						{$set: {
							to_be_deleted: true
						}},(updateErr) => {
							parentCallback(updateErr);
						});
					},
					update__extra_masters : (parentCallback)=>{
						cravez_item_extra_masters.updateMany({
							kfg_item_id 	:	{$in: inputItemIds},
							restaurant_id	: 	restId,
							kfg_combo_components_id : {$exists : false},
						},
						{$set: {
							to_be_deleted: true
						}},(updateErr) => {
							parentCallback(updateErr);
						});
					},
					update_group_extras : (parentCallback)=>{
						cravez_item_group_extras.updateMany({
							kfg_item_id 	:	{$in: inputItemIds},
							restaurant_id	: 	restId,
							kfg_combo_components_id : {$exists: false},
						},
						{$set: {
							to_be_deleted: true
						}},(updateErr) => {
							parentCallback(updateErr);
						});
					},
				},(parentErr, parentRes)=>{
					if(parentErr) return resolve(respnoseCodes["002"]);

					let itemList	= 	parentRes.item_list;
					let groupList 	=	parentRes.group_list;

					if(!itemList || !groupList) return resolve(respnoseCodes["002"]);

					let newItemObj = {};
					eachOfSeries(params.XMLInput.ITEMS.ITEM,(records, parentIndex, eachCallback)=>{
						let data 			= 	records._attributes;
						let kfgItemId 		=	String(data.ID);
						let kfgIntItemId 	=	parseInt(data.ID);
						let kfgItemDetails	=	itemList[kfgItemId];
						let modifierGroup 	= 	(records.MODIFIERGROUP.constructor != Array) ? [records.MODIFIERGROUP] :records.MODIFIERGROUP;

						if(!kfgItemDetails) return eachCallback("Main item details missing");

						let isCombo 	=	kfgItemDetails.is_combo;
						let doughType 	=	(kfgItemDetails.dough_type) ? parseInt(kfgItemDetails.dough_type) :0;
						let vgroupItem	=	(restSlug == PIZZA_HUT && doughType >0)	 ? true :false;
						let itemType 	=	(restSlug == PIZZA_HUT && isCombo) ? DEAL_ITEM :"";
						let isDeal		=	(itemType == DEAL_ITEM) ? true :false;
						let vgroupId 	=	(kfgItemDetails.vgroup_id) ? parseInt(kfgItemDetails.vgroup_id):0;
						let noOfComponents=	0;
						let itemVgroupIds =	[];
						let modifierChoiesGroup   =	[];
						let modifierExtraItemList =	[];

						if(vgroupId){
							newItemObj[vgroupId] = {item_id: kfgItemId, vgroup_id: vgroupId};
						}else{
							newItemObj[kfgItemId]= {item_id: kfgItemId, is_combo: isCombo};
						}

						modifierGroup.map((groupData,groupClass)=>{
							let kfgGroupId		=	groupData._attributes.GROUPID;
							let modType			=	parseInt(groupData._attributes.ModType);
							let applimodifiers	=	parseInt(groupData._attributes.APPLICABLEMODIFIERS);
							let kfgGroupDetails	=	groupList[kfgGroupId];
							let modifyItem		=	(groupData.MODITEMS.constructor != Array) ? [groupData.MODITEMS] :groupData.MODITEMS;
							let groupChecked	=	true;

							if(kfgGroupDetails){
								let tmpGroupName = (kfgGroupDetails.name) ? kfgGroupDetails.name.en :"";
								tmpGroupName 	 = (tmpGroupName) ? tmpGroupName.trim().toLowerCase() :"";

								modifyItem.map(exItemData=>{
									let exItemId		=	exItemData._attributes.ID;
									let exItemPrice		=	exItemData._attributes.PRICE;
									let exItemOrder		=	exItemData._attributes.SEQ;
									let exItemDetails	=	itemList[exItemId];

									if(exItemDetails){
										let tmpDoughType	= 	(exItemDetails.dough_type) ? parseInt( exItemDetails.dough_type) :0;

										if(isDeal && modType){
											if(tmpDoughType > 0){
												if(groupChecked){
													noOfComponents++
													groupChecked = false;
												}

												itemVgroupIds.push({
													item_id		: 	exItemId,
													size		: 	exItemDetails.size,
													selector	: 	exItemDetails.selector,
													dough_type	:	tmpDoughType
												});
											}
										}else{

											if((isDeal || vgroupItem) && (tmpGroupName == "select pizza" || tmpGroupName == "choose your pizza")){

											}else{
												modifierChoiesGroup.push({
													group_class	:	groupClass,
													group_id	:	kfgGroupId,
													name 		:	kfgGroupDetails.name,
													min 		:	(kfgGroupDetails.min) ? kfgGroupDetails.min : kfgGroupDetails.min_quantity,
													max 		:	(kfgGroupDetails.max) ? kfgGroupDetails.max : kfgGroupDetails.max_quantity,
													extra_item_id:	exItemDetails.item_id,
												});

												modifierExtraItemList.push({
													extra_item_id	:	exItemId,
													group_class		:	groupClass,
													group_id		:	kfgGroupId,
													name			:	exItemDetails.name,
													order			:	(exItemOrder) ? parseInt(exItemOrder) :0,
													price			:	parseFloat(exItemPrice),
													status			:	exItemDetails.is_active
												});
											}
										}
									}
								});
							}
						});

						if(modifierChoiesGroup.length <=0 || modifierExtraItemList.length <=0){
							return eachCallback("Group/ Extra item details missing modifierChoiesGroup "+modifierChoiesGroup.length+" modifierExtraItemList "+modifierExtraItemList.length);
						}

						let finalGroupData 	= {};
						let finalExtraId 	= {};
						asyncParallel({
							update_items_list: (subCallback)=>{
								if(itemVgroupIds.length <=0)  return subCallback(null);

								let updateItemData = {
									$set: { modified: getUtcDate() },
								};

								if(itemType == DEAL_ITEM){
									updateItemData["$set"].no_of_components	= noOfComponents;
									updateItemData["$set"].v_group_item_ids	= itemVgroupIds;
								}

								/** Update items */
								cravez_items.updateOne({item_id: {$in: [kfgItemId, kfgIntItemId]} },updateItemData,(insertErr)=>{
									subCallback(insertErr);
								});
							},
							update_group: (subCallback)=>{

								eachOfSeries(modifierChoiesGroup,(records, index, forEachChildCallback)=>{
									let groupId 	= 	String(records.group_id);
									let intGroupId 	= 	parseInt(records.group_id);
									let groupClass	= 	records.group_class;

									/** Set conditions */
									let grConditions = {
										kfg_item_id 			: 	kfgItemId,
										restaurant_id 			:	restId,
										kfg_modifiers_groups_id : 	{$in: [groupId, intGroupId]},
										kfg_groups_class 		: 	groupClass
									};

									/** Get item choice group details */
									cravez_choices_groups.findOne(grConditions,{projection: {_id: 1,}},(masterErr,masterResult)=>{
										if(masterErr) return forEachChildCallback(masterErr);

										if(masterResult){
											if(!finalGroupData[groupClass])finalGroupData[groupClass]={};
											if(!finalGroupData[groupClass][groupId])finalGroupData[groupClass][groupId]= "";
											finalGroupData[groupClass][groupId] = masterResult._id;

											/** Update choice group detils */
											cravez_choices_groups.updateOne(grConditions,{
												$set	:	{
													name			: 	records.name,
													min_quantity 	:	records.min,
													max_quantity 	: 	records.max,
													order			:	index+2,
													modified 		:	getUtcDate(),
												},
												$unset :{
													to_be_deleted	: true
												}
											},(updateErr)=>{
												forEachChildCallback(updateErr);
											});
										}else{
											/** Save choice group detils */
											cravez_choices_groups.updateOne(grConditions,{
												$set	:	{
													name			: 	records.name,
													min_quantity 	:	records.min,
													max_quantity 	: 	records.max,
													order			:	index+2,
													modified 		:	getUtcDate(),
												},
												$setOnInsert:	{
													kfg		 				: 	true,
													added_by				:	adminId,
													kfg_modifiers_groups_id : 	intGroupId,
													channel_id				:	CHANNEL_SOAP,
													restaurant_slug 		:	restSlug,
													created   				:	getUtcDate(),
												},
												$unset :{
													to_be_deleted	: true
												}
											},{upsert: true },(insertErr,insertResult)=>{
												if(insertResult &&  insertResult.upsertedId && insertResult.upsertedId._id){
													if(!finalGroupData[groupClass])finalGroupData[groupClass]={};
													if(!finalGroupData[groupClass][groupId])finalGroupData[groupClass][groupId]= "";

													finalGroupData[groupClass][groupId] = insertResult.upsertedId._id;
												}
												forEachChildCallback(insertErr);
											});
										}
									});
								},(asyncEachChildErr)=>{
									subCallback(asyncEachChildErr);
								});
							},
							update_exitem: (subCallback)=>{

								eachOfSeries(modifierExtraItemList,(records, index,forEachChildCallback)=>{
									let exItemId 	= String(records.extra_item_id);
									let intExItemId = parseInt(records.extra_item_id);

									/** Set conditions */
									let exItemConditions = {
										kfg_item_id 	: 	kfgItemId,
										restaurant_id	:	restId,
										extra_item_id	:	{$in: [exItemId, intExItemId]},
									};

									/** Get items */
									cravez_item_extra_masters.findOne(exItemConditions,{projection: {_id: 1}},(masterErr,masterResult)=>{
										if(masterErr) return forEachChildCallback(masterErr,masterResult);

										if(masterResult){
											if(!finalExtraId[exItemId]) finalExtraId[exItemId] = {};
											finalExtraId[exItemId] =  masterResult._id;

											cravez_item_extra_masters.updateOne(exItemConditions,{
												$set:	{
													name   		: 	records.name,
													extra_fees 	:	0,
													modified 	:	getUtcDate(),
												},
												$unset :{
													to_be_deleted	: true
												}
											},(insertErr)=>{
												forEachChildCallback(insertErr, masterResult);
											});
										}else{
											/** Save extra master details */
											cravez_item_extra_masters.updateOne(exItemConditions,{
												$set:	{
													name   		: 	records.name,
													extra_fees 	:	0,
													order		:	parseInt(records.order),
													modified 	:	getUtcDate(),
												},
												$setOnInsert:	{
													kfg		 		: 	true,
													added_by		:	adminId,
													channel_id		:	CHANNEL_SOAP,
													restaurant_slug :	restSlug,
													extra_item_id	:	exItemId,
													is_active		:	parseInt(records.status),
													created   		:	getUtcDate(),
												},
												$unset :{
													to_be_deleted	: true
												}
											},{upsert: true },(insertErr,insertResult)=>{
												if(insertResult &&  insertResult.upsertedId && insertResult.upsertedId._id){
													let masterId = (insertResult &&  insertResult.upsertedId && insertResult.upsertedId._id)

													if(!finalExtraId[exItemId]) finalExtraId[exItemId] = {};
													finalExtraId[exItemId] =  masterId;
												}
												forEachChildCallback(insertErr);
											});
										}
									});
								},(asyncEachChildErr)=>{
									subCallback(asyncEachChildErr);
								});
							},
						},(asyncSubErr)=>{
							if(asyncSubErr) eachCallback(asyncSubErr);

							eachOfSeries(modifierExtraItemList,(records, index,forEachChildCallback)=>{
								let tmpExItemId 	=	String(records.extra_item_id);
								let tmpGroupId 		= 	records.group_id;
								let tmpGroupClass 	= 	records.group_class;
								let exItemMongoId	=	(finalExtraId[tmpExItemId]) ? finalExtraId[tmpExItemId] :"";
								let groupMongoId	=	(finalGroupData[tmpGroupClass] && finalGroupData[tmpGroupClass][tmpGroupId]) ? finalGroupData[tmpGroupClass][tmpGroupId] :"";

								if(!exItemMongoId || !groupMongoId){
									console.error("groupMongoId "+groupMongoId);
									console.error("exItemMongoId "+exItemMongoId);
									console.error("Group or ex item details not found",records);
									return forEachChildCallback(null);
								}

								/** Update group */
								cravez_item_group_extras.updateOne({
									kfg_item_id 	: 	kfgItemId,
									group_id 		: 	groupMongoId,
									restaurant_id 	:	restId,
									item_extra_id	:	exItemMongoId,
								},
								{
									$set	:	{
										order 		:	records.order,
										extra_fees 	:	records.price,
										modified	:	getUtcDate(),
									},
									$setOnInsert:	{
										kfg		 		: 	true,
										channel_id		:	CHANNEL_SOAP,
										added_by		:	adminId,
										restaurant_slug :	restSlug,
										created   		:	getUtcDate(),
									},
									$unset :{
										to_be_deleted	: true
									}
								},{upsert: true },(insertErr)=>{
									forEachChildCallback(insertErr);
								});
							},(asyncEachChildErr)=>{
								if(asyncEachChildErr) return eachCallback(asyncEachChildErr);

								asyncParallel({
									update_choices_groups : (itemCallback)=>{
										cravez_choices_groups.deleteMany({
											kfg_item_id 	:	{$in: inputItemIds},
											restaurant_id	: 	restId,
											kfg_combo_components_id : {$exists : false},
											to_be_deleted	: true,
										},(deleteErr) => {
											itemCallback(deleteErr);
										});
									},
									update_choices_groups : (itemCallback)=>{
										cravez_item_extra_masters.deleteMany({
											kfg_item_id 	:	{$in: inputItemIds},
											restaurant_id	: 	restId,
											to_be_deleted	: 	true,
											kfg_combo_components_id : {$exists : false},
										},(deleteErr) => {
											itemCallback(deleteErr);
										});
									},
									update_group_extras : (itemCallback)=>{
										cravez_item_group_extras.deleteMany({
											kfg_item_id 	:	{$in: inputItemIds},
											restaurant_id	: 	restId,
											to_be_deleted	: 	true,
											kfg_combo_components_id : {$exists: false},
										},(deleteErr) => {
											itemCallback(deleteErr);
										});
									},
								},(parentErrs)=>{
									eachCallback(parentErrs);
								});
							});
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return resolve(respnoseCodes["002"]);
						resolve(respnoseCodes["000"]);

						Object.keys(newItemObj).map(tmpKey=>{
							let itemId 	 =	newItemObj[tmpKey].item_id;
							let isCombo  = 	newItemObj[tmpKey].is_combo;
							let vgroupId = 	newItemObj[tmpKey].vgroup_id;

							let cronUrl = Constants.WEBSITE_URL+"crons/update_cravez_item/"+itemId+(vgroupId ? "/"+vgroupId :"");
							if(restSlug == BURGER_KING && isCombo){
								cronUrl = Constants.WEBSITE_URL+"crons/update_cravez_combo_item/"+itemId;
							}

							axios.get(cronUrl, {
								httpsAgent: new https.Agent({
									rejectUnauthorized: false
								})
							}).then(() => { }).catch(() => {});
						});
					});
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			}
		});
	};//End ItemAndModifierGroupMap()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async RefreshPhoneTypes(params){
		return new Promise(resolve=>{
			resolve({
				ResponseCode : "000",
				ResponseDesc : "Success"
			});
		});
	};//End RefreshPhoneTypes()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async RefreshOrderTypes(params){
		return new Promise(resolve=>{
			resolve({
				ResponseCode : "000",
				ResponseDesc : "Success"
			});
		});
	};//End RefreshOrderTypes()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async RefreshOrderStatusTypes(params){
		return new Promise(resolve=>{
			resolve({
				ResponseCode : "000",
				ResponseDesc : "Success"
			});
		});
	};//End RefreshOrderStatusTypes()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async AddOrUpdateCategory(options){
		return new Promise(resolve=>{
			try{
				/** Save Kfg logs */
				axios({
					method: "GET",
					url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
					params: {
						method_name: "AddOrUpdateCategory",
						response: options.params
					},
					httpsAgent: new https.Agent({
						rejectUnauthorized: false
					})
				}).catch(() => {});

				let params = options.params;
				let missingParameters = [];
				if(!params.ConceptId) missingParameters.push("ConceptId");
				if(!params.MenuId) missingParameters.push("MenuId");
				if(!params.XMLInput) missingParameters.push("XMLInput");

				if(missingParameters.length>0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingParameters.join(", ")
				});

				if(!params.XMLInput || !params.XMLInput.CATEGORYLIST || !params.XMLInput.CATEGORYLIST.CATEGORY) return resolve(respnoseCodes["001"]);

				if(params.XMLInput.CATEGORYLIST.CATEGORY.constructor != Array ){
					let tempObj = params.XMLInput.CATEGORYLIST.CATEGORY;
					params.XMLInput.CATEGORYLIST.CATEGORY = [];
					params.XMLInput.CATEGORYLIST.CATEGORY.push(tempObj);
				}

				/** validate data*/
				let missingData	= [];
				params.XMLInput.CATEGORYLIST.CATEGORY.map(record =>{
					if(record._attributes){
						if(!record._attributes.ID) missingData.push("ID");
						if(!record._attributes.NAME) missingData.push("NAME");
						if(!record._attributes.NAMEARB) missingData.push("NAMEARB");
					}else{
						missingData.push("ID, NAME, NAMEARB");
					}
				});

				if(missingData.length > 0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingData.join(", ")
				});

				const restaurant_categories 	= db.collection("restaurant_categories");
				eachOfSeries(params.XMLInput.CATEGORYLIST.CATEGORY,(data, dataIndex, asyncEachcallback)=>{
					data = data._attributes;
					asyncParallel({
						unique_category_id : (parellelCallback)=>{
							/** get unique Id Response **/
							this.getUniqueId({type:"categories"}).then(uniqueIdResponse=>{

								let uniqueCategoryid = (uniqueIdResponse.result) ? uniqueIdResponse.result :"";
								parellelCallback(null,uniqueCategoryid);
							});
						}
					},(parallelErr,asyncReponse)=>{

						if(parallelErr) return resolve(respnoseCodes["002"]);

						/** Save record **/
						restaurant_categories.updateOne({
							kfg_sub_menu_id : parseInt(data.ID),
							cravez_menu_id	: params.MenuId,
						},
						{
							$set : {
								name	: {
									en: data.NAME,
									ar: data.NAMEARB
								},
								tags	: [data.NAME,data.NAMEARB],
								is_active: ACTIVE,
								modified: getUtcDate(),
							},
							$setOnInsert: {
								restaurant_slug	: params.MenuId == PIZZA_HUT_MENU_ID ? PIZZA_HUT : BURGER_KING,
								restaurant_id	: ObjectId(options.concept_ids[params.ConceptId]._id),
								concept_id		: params.ConceptId,
								added_by		: options.super_admin_details._id,
								channel_id		: CHANNEL_SOAP,
								category_id		: asyncReponse.unique_category_id,
								kfg				: true,
							}
						},{upsert: true},(updateErr) => {
							asyncEachcallback(updateErr);
						});
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return resolve(respnoseCodes["002"]);
					resolve(respnoseCodes["000"]);
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			}
		});
	};//End AddOrUpdateCategory()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async RefreshCustomerGenders(params){
		return new Promise(resolve=>{
			resolve({
				ResponseCode : "000",
				ResponseDesc : "Success"
			});
		});
	};//End RefreshCustomerGenders()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async RefreshFeedbackSubTypes(params){
		return new Promise(resolve=>{
			resolve({
				ResponseCode : "000",
				ResponseDesc : "Success"
			});
		});
	};//End RefreshFeedbackSubTypes()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async RefreshCustomerTypes(params){
		return new Promise(resolve=>{
			resolve({
				ResponseCode : "000",
				ResponseDesc : "Success"
			});
		});
	};//End RefreshCustomerTypes()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async RefreshOrderModes(params){
		return new Promise(resolve=>{
			resolve({
				ResponseCode : "000",
				ResponseDesc : "Success"
			});
		});
	};//End RefreshOrderModes()

	/**
	 * Function to add or update selectors
	 *
	 * @param options As Parameters
	 *
	 * @return json
	 */
	async AddOrUpdateSelector(options){
		return new Promise(resolve=>{
			try{
				/** Save Kfg logs */
				axios({
					method: "GET",
					url: Constants.WEBSITE_URL + "save_kfg_hd_service_logs",
					params: {
						method_name: "AddOrUpdateSelector",
						response: options.params
					},
					httpsAgent: new https.Agent({
						rejectUnauthorized: false
					})
				}).catch(() => {});

				let params = options.params;
				let missingParameters = [];
				if(!params.ConceptId) missingParameters.push("ConceptId");
				if(!params.MenuId) missingParameters.push("MenuId");
				if(!params.XMLInput) missingParameters.push("XMLInput");

				if(missingParameters.length>0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingParameters.join(", ")
				});

				if(!params.XMLInput || !params.XMLInput.SELECTORS || !params.XMLInput.SELECTORS.SELECTOR) return resolve(respnoseCodes["001"]);

				if(params.XMLInput.SELECTORS.SELECTOR.constructor != Array ){
					let tempObj = params.XMLInput.SELECTORS.SELECTOR;
					params.XMLInput.SELECTORS.SELECTOR = [];
					params.XMLInput.SELECTORS.SELECTOR.push(tempObj);
				}

				/** validate data*/
				let missingData	= [];
				params.XMLInput.SELECTORS.SELECTOR.map(record =>{
					if(record._attributes){
						if(!record._attributes.ID) missingData.push("ID");
						if(!record._attributes.NAME) missingData.push("NAME");
						if(!record._attributes.NAMEARB) missingData.push("NAMEARB");
					}else{
						missingData.push("ID, NAME, NAMEARB");
					}
				});

				if(missingData.length > 0) return resolve({
					ResponseCode : "004",
					ResponseDesc : "Missing "+missingData.join(", ")
				});

				const item_units_masters 	= db.collection("item_units_masters");
				eachOfSeries(params.XMLInput.SELECTORS.SELECTOR,(data, dataIndex, asyncEachcallback)=>{
					data = data._attributes;

					asyncParallel({
						unique_id : (parellelCallback)=>{
							/** get unique Id Response **/
							this.getUniqueId({type:"item_unit"}).then(uniqueIdResponse=>{
								let uniqueItemUnitid = (uniqueIdResponse.result) ? uniqueIdResponse.result :"";
								parellelCallback(null,uniqueItemUnitid);
							});
						}
					},(parallelErr,asyncReponse)=>{
						if(parallelErr) return resolve(respnoseCodes["002"]);

						/** Save item unit details **/
						item_units_masters.updateOne({
							cravez_menu_id	: 	params.MenuId,
							kfg_selector 	:	parseInt(data.ID)
						},
						{
							$set : {
								name: {
									en: data.NAME,
									ar: data.NAMEARB
								},
								v_group_id	: (data.VGROUPID) ? parseInt(data.VGROUPID) :"",
								modified	: getUtcDate(),
							},
							$setOnInsert: {
								restaurant_slug	: params.MenuId == PIZZA_HUT_MENU_ID ? PIZZA_HUT : BURGER_KING,
								added_by		: options.super_admin_details._id,
								channel_id		: CHANNEL_SOAP,
								created			: getUtcDate(),
								item_unit_id	: asyncReponse.unique_id,
								kfg				: true,
								restaurant_id	: ObjectId(options.concept_ids[params.ConceptId]._id),
								concept_id		: params.ConceptId,
							}
						},{upsert: true},(updateErr) => {
							asyncEachcallback(updateErr);
						});
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return resolve(respnoseCodes["002"]);
					resolve(respnoseCodes["000"]);
				});
			}catch(e){
				console.error(e);
				resolve(respnoseCodes["002"]);
			}
		});
	};//End AddOrUpdateSelector()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async RefreshCustomerTitles(params){
		return new Promise(resolve=>{
			resolve({
				ResponseCode : "000",
				ResponseDesc : "Success"
			});
		});
	};//End RefreshCustomerTitles()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async RefreshAddressTypes(params){
		return new Promise(resolve=>{
			resolve({
				ResponseCode : "000",
				ResponseDesc : "Success"
			});
		});
	};//End RefreshAddressTypes()

	/**
	 * Function to
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async RefreshDiscountTypes(params){
		return new Promise(resolve=>{
			resolve({
				ResponseCode : "000",
				ResponseDesc : "Success"
			});
		});
	};//End RefreshDiscountTypes()

	/**
	 * Function to
	 *
	 * @param method As Method name
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async soapRequest (method,params){
		return new Promise(resolve=>{
			let missingParameter = false;
			try{
				if(params.XMLInput && typeof params.XMLInput === "string"){
					params.XMLInput = params.XMLInput.replace(new RegExp(/\t/g),'').trim();
					params.XMLInput = JSON.parse(xml2json(params.XMLInput, {compact: true, spaces: 4}));
				}
			}catch(e){
				missingParameter = true;
			}
			if(missingParameter){
				return resolve(respnoseCodes["001"]);
			}

			const restaurants = db.collection("restaurants");
			const users = db.collection("users");
			asyncParallel({
				super_admin_details: (superAdminDetails)=>{
					users.findOne({
						user_role_id : CRAVEZ
					},{projection:{full_name:1,_id:1}},(superAdminErr, superAdminResult)=>{
						superAdminDetails(superAdminErr, superAdminResult);
					});
				},
				concept_ids: (conceptDetails)=>{
					restaurants.find({
							concept_id : {$exists: true}
						},{projection:{_id: 1,concept_id: 1,slug: 1}}
					).toArray((conceptErr, conceptResult)=>{
						if(conceptErr) return conceptDetails(conceptErr);
						let conceptData = {};
						conceptResult.map(conceptRecords=> conceptData[conceptRecords.concept_id] = conceptRecords);
						conceptDetails(conceptErr,conceptData);
					});
				},
			},(parallelErr,asyncReponse)=>{
				if(parallelErr) return resolve(respnoseCodes["002"]);

				SOAP[method]({params: params,concept_ids:asyncReponse.concept_ids,super_admin_details: asyncReponse.super_admin_details }).then(response=>{
					logger("response")
					logger(response)

					resolve(response);
				});
			});
		});
	};//End soapRequest()

	/**
	 * Function to genrate Unique id's
	 *
	 * @param options	As	Request params
	 *
	 * @return json
	 */
	async getUniqueId(options){
		return new Promise(resolve=>{
			let type	=	(options.type)	?	options.type	:"";
			/** Send error response */
			if(!type) return resolve({status : STATUS_ERROR, message : "missing_parameters"});

			let timestampp 		=	new Date().getTime();
			timestampp			= 	parseInt(timestampp/10000000);
			let tempRandNumber	= 	Math.floor(100000 + Math.random() * 900000);
			let randomNumber 	=	String(timestampp+tempRandNumber);

			/** Manage day of the year */
			// let currentYear		=	String(newDate("",ORDER_YEAR_FORMAT));
			let currentDate 	= 	new Date(newDate());
			let startDate 		= 	new Date(currentDate.getFullYear(), 0, 0);
			let diffBetweenDate	=	currentDate - startDate;
			let oneDayTimeStamp =	MILLISECONDS_IN_A_SECOND*MINUTES_IN_A_HOUR*SECONDS_IN_A_MINUTE*HOURS_IN_A_DAY;
			let dayOftheYear	=	String(Math.floor(diffBetweenDate / oneDayTimeStamp));

			if(dayOftheYear.length <3){
				for(var i = dayOftheYear.length; i< 3; i++){
					dayOftheYear = "0"+dayOftheYear;
				}
			}

			switch(type){
				case "item_unit":
					var item_units_masters = db.collection("item_units_masters");
					item_units_masters.countDocuments({item_unit_id : randomNumber},(err,countResult)=>{
						if(countResult == 0) return resolve({status:STATUS_SUCCESS, result:randomNumber});
						this.getUniqueId(options).then(uniqueNumber=>{
							resolve(uniqueNumber);
						});
					});
				break;
				case "categories":
					var categories = db.collection("categories");
					categories.countDocuments({category_id : randomNumber},(err,countResult)=>{
						if(countResult == 0) return resolve({status:STATUS_SUCCESS, result:randomNumber});
						this.getUniqueId(options).then(uniqueNumber=>{
							resolve(uniqueNumber);
						});
					});
				break;
				case "areas":
					var areas = db.collection("areas");
					areas.countDocuments({area_id : randomNumber},(err,countResult)=>{
						if(countResult == 0) return resolve({status:STATUS_SUCCESS, result:randomNumber});
						this.getUniqueId(options).then(uniqueNumber=>{
							resolve(uniqueNumber);
						});
					});
				break;
				case "cravez_cities":
					var cravez_cities = db.collection("cravez_cities");
					cravez_cities.countDocuments({city_id : randomNumber},(err,countResult)=>{
						if(countResult == 0) return resolve({status:STATUS_SUCCESS, result:randomNumber});
						this.getUniqueId(options).then(uniqueNumber=>{
							resolve(uniqueNumber);
						});
					});
				break;
				case "restaurant_branches":
					var restaurant_branches = db.collection("restaurant_branches");
					restaurant_branches.countDocuments({branch_number : randomNumber},(err,countResult)=>{
						if(countResult == 0) return resolve({status:STATUS_SUCCESS, result:randomNumber});

						this.getUniqueId(options).then(uniqueNumber=>{
							resolve(uniqueNumber);
						});
					});
				break;
				default:
					resolve({status : STATUS_ERROR, message : "invalid_access"});
				break;
			}
		});
	};//end getUniqueId();

	/**
	 * Function to  place order
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async kfgPlaceOrder (req, res,next,client){
		return new Promise(resolve=>{
			let orderId		= 	(req.params.order_id) 		? 	ObjectId(req.params.order_id)	:"";
			let isModified	=	(req.params.is_modified)	?	parseInt(req.params.is_modified):false;

			/** Send error response */
			if(!orderId) return resolve({status: STATUS_ERROR, message:	res.__("system.missing_parameters") });

			/** Save kfg request response */
			let logId			=	ObjectId();
			let kfgMethodName 	= 	(isModified) ? "ModifyOrder" :"PostOrder";
			let extraPerms 		=	{start_time: getUtcDate(), order_id: orderId  };
			this.saveKFGRequestResponse(req,res,next,{
				method_name :	kfgMethodName,
				response	: 	{},
				log_id		: 	logId,
				request		:	{},
				request_error:	null,
				extra_perms	:	extraPerms,
			}).then(()=>{

				const users			=	db.collection("users");
				const orders 		= 	db.collection("orders");
				const order_items	=	db.collection("order_items");
				const order_details	=	db.collection("order_details");
				asyncParallel({
					order_details : (callback)=>{
						/** Get order details */
						orders.findOne({_id : orderId},(err,result)=>{
							callback(err,result);
						});
					},
					order_sub_details : (callback)=>{
						/** Get order sub details */
						order_details.findOne({order_id: orderId},(err,result)=>{
							callback(err,result);
						});
					},
					order_item_list : (callback)=>{
						/** Get order item list */
						order_items.aggregate([
							{$match	: {order_id : orderId} },
							{$sort	: {cart_created : SORT_ASC} },
							{$addFields: {
								extra_items : {$filter: {
									input: "$extra_items",
									as	 : "records",
									cond : { $and: [
										{$ne: [ "$$records.is_first_component", true ] },
									]}
								}}
							}}
						]).toArray((err,result)=>{
							if(err || result.length <= 0) return callback(err, null);

							let itemIdArray 	= 	[];
							let unitIdArray 	= 	[];
							let doughIdArray 	= 	[];
							let selectorIdArray =	[];
							let groupIdArray 	=	[];
							let extraItemIdArray =	[];

							result.map(records=>{
								if(records.item_id) itemIdArray.push(records.item_id);
								if(records.unit_id) unitIdArray.push(records.unit_id);
								if(records.dough_id) doughIdArray.push(records.dough_id);
								if(records.selector_id) selectorIdArray.push(records.selector_id);

								if(records.extra_items && records.extra_items.length >0){
									records.extra_items.map(exDat=>{
										groupIdArray.push(exDat.group_id);
										extraItemIdArray.push(exDat.extra_item_id);
									});
								}

								if(records.unit_lists && records.unit_lists.length >0){
									records.unit_lists.map(data=>{
										if(data.unit_id) unitIdArray.push(data.unit_id);
										if(data.dough_id)doughIdArray.push(data.dough_id);
										if(data.selector_id) selectorIdArray.push(data.selector_id);

										if(data.extra_items && data.extra_items.length>0){
											data.extra_items.map(exDat=>{
												groupIdArray.push(exDat.group_id);

												exDat.extra_item_ids.map(unData=>{
													extraItemIdArray.push(unData.extra_item_id);
												});
											});

										};
									});
								}
							});

							asyncParallel({
								item_list : (subCallback)=>{
									const items = 	db.collection("items");
									items.find({_id : {$in : itemIdArray}},{projection: {}}).toArray((itemErr, itemResult)=>{
										if(itemErr) return subCallback(itemErr);

										let itemObj = {};
										itemResult.map(data=>{
											itemObj[data._id] = data;
										});
										subCallback(itemErr,itemObj);
									});
								},
								unit_list : (subCallback)=>{
									if(unitIdArray.length <=0) return subCallback(null,{});

									const item_units_masters = db.collection('item_units_masters');
									item_units_masters.find({_id : {$in : unitIdArray}},{projection: {}}).toArray((unitErr,unitResult)=>{
										if(unitErr) return subCallback(unitErr);

										let unitObj = {};
										unitResult.map(data=>{
											unitObj[data._id] = data;
										});
										subCallback(unitErr,unitObj);
									});
								},
								dough_list : (subCallback)=>{
									if(doughIdArray.length <=0) return subCallback(null,{});

									const item_dough_units = db.collection('item_dough_units');
									item_dough_units.aggregate([
										{$match: 	{
											_id	: {$in : doughIdArray}
										}},
										{$lookup: 	{
											from			: "item_units_masters",
											localField		: "item_unit_id",
											foreignField	: "_id",
											as				: "unit_details",
										}},
										{$addFields	: 	{
											dough_type: {$arrayElemAt:["$unit_details.dough_type", 0] },
										}},
										{$project : { unit_details: 0 }}
									]).toArray((doughErr, doughResult)=>{
										if(doughErr) return subCallback(doughErr);

										let doughObj = {};
										doughResult.map(doughData=>{
											doughObj[doughData._id] = doughData;
										});
										subCallback(doughErr,doughObj);
									});
								},
								selector_list : (subCallback)=>{
									if(selectorIdArray.length <=0) return subCallback(null,{});

									const item_selector_units = db.collection('item_selector_units');
									item_selector_units.aggregate([
										{$match: 	{
											_id	: {$in : selectorIdArray }
										}},
										{$lookup: 	{
											from			: "item_units_masters",
											localField		: "item_unit_id",
											foreignField	: "_id",
											as				: "unit_details",
										}},
										{$addFields	: 	{
											kfg_selector: {$arrayElemAt:["$unit_details.kfg_selector", 0] },
											selector_name: {$arrayElemAt:["$unit_details.name.en", 0] },
										}},
										{$project : { unit_details: 0 }}
									]).toArray((selectorErr, selectorResult)=>{
										if(selectorErr) return subCallback(selectorErr);

										let selectorList = {};
										selectorResult.map(selectors=>{
											selectorList[selectors._id] = selectors;
										});
										subCallback(null,selectorList);
									});
								},
								group_list : (subCallback)=>{
									if(groupIdArray.length <=0) return subCallback(null,{});

									const item_choices_groups = 	db.collection("item_choices_groups");
									item_choices_groups.find({_id : {$in : groupIdArray}},{projection: {}}).sort({order: SORT_ASC}).toArray((groupErr, groupResult)=>{
										if(groupErr) return subCallback(groupErr);

										let groupObj = {};
										groupResult.map(data=>{
											groupObj[data._id] = data;
										});
										subCallback(groupErr,groupObj);
									});
								},
								extra_item_list : (subCallback)=>{
									if(extraItemIdArray.length <=0) return subCallback(null,{});

									const item_extra_masters = 	db.collection("item_extra_masters");
									item_extra_masters.find({_id : {$in : extraItemIdArray}},{projection: {}}).toArray((exItemErr, exItemResult)=>{
										if(exItemErr) return subCallback(exItemErr);

										let exItemObj = {};
										exItemResult.map(data=>{
											exItemObj[data._id] = data;
										});
										subCallback(exItemErr,exItemObj);
									});
								},
							},(parallelErr, parallelResponse)=>{
								if(parallelErr) return callback(parallelErr);

								let itemList 		=	parallelResponse.item_list;
								let unitList 		=  	parallelResponse.unit_list;
								let doughList 		= 	parallelResponse.dough_list;
								let selectorList 	= 	parallelResponse.selector_list;
								let groupList 		= 	parallelResponse.group_list;
								let extraItemList 	= 	parallelResponse.extra_item_list;

								result.map(records=>{
									if(records.item_id){
										records.item_details = (itemList[records.item_id]) ? itemList[records.item_id] :{};
									}

									if(records.unit_id){
										records.unit_details = (unitList[records.unit_id]) ? unitList[records.unit_id] :{};
									}

									if(records.dough_id){
										records.dough_details = (doughList[records.dough_id]) ? doughList[records.dough_id] :{};
									}

									if(records.selector_id){
										records.selector_details = (selectorList[records.selector_id]) ? selectorList[records.selector_id] :{};
									}

									if(records.extra_items && records.extra_items.length >0){
										let tmpExtras = [];
										Object.keys(groupList).map(key=>{
											records.extra_items.map(exDat=>{
												let tmpGroupId 	= exDat.group_id;
												let tmpExItemId = exDat.extra_item_id;

												if(String(key) == String(tmpGroupId)){
													exDat.group_details = (groupList[tmpGroupId]) ? groupList[tmpGroupId] :{};
													exDat.item_details = (extraItemList[tmpExItemId]) ? extraItemList[tmpExItemId] :{};

													tmpExtras.push(exDat);
												}
											});
										});

										records.extra_items.map(exDat=>{
											let tmpGroupId 	= exDat.group_id;
											let tmpExItemId = exDat.extra_item_id;

											if(!exDat.group_details){
												exDat.group_details = (groupList[tmpGroupId]) ? groupList[tmpGroupId] :{};
												exDat.item_details = (extraItemList[tmpExItemId]) ? extraItemList[tmpExItemId] :{};

												tmpExtras.push(exDat);
											}
										});

										records.extra_items = clone(tmpExtras);
									}

									if(records.unit_lists && records.unit_lists.length >0){
										records.unit_lists.map(data=>{
											if(data.unit_id){
												data.unit_details = (unitList[data.unit_id]) ? unitList[data.unit_id] :{};
											}

											if(data.dough_id){
												data.dough_details = (doughList[data.dough_id]) ? doughList[data.dough_id] :{};
											}

											if(data.selector_id){
												data.selector_details = (selectorList[data.selector_id]) ? selectorList[data.selector_id] :{};
											}


											if(data.extra_items && data.extra_items.length>0){
												data.extra_items.map(exDat=>{
													let tmpGroupId 	= exDat.group_id;
													exDat.group_details = (groupList[tmpGroupId]) ? groupList[tmpGroupId] :{};

													exDat.extra_item_ids.map(unData=>{
														let tmpExItemId = unData.extra_item_id;

														unData.item_details = (extraItemList[tmpExItemId]) ? extraItemList[tmpExItemId] :{};
													});
												});

											};
										});
									}
								});

								callback(null,result);
							});
						});
					},
					admin_details : (callback)=>{
						/** Get admin details */
						users.findOne({user_role_id: CRAVEZ},(err, result)=>{
							callback(err, result);
						});
					}
				},(parallelErr,asyncReponse)=>{
					if(parallelErr) return next(parallelErr);

					let orderDetails	= 	asyncReponse.order_details;
					let orderSubDetails	=	asyncReponse.order_sub_details;
					let orderItemList	=	asyncReponse.order_item_list;
					let adminDetails	=	(asyncReponse.admin_details) ? asyncReponse.admin_details:{};
					let adminId 		=	adminDetails._id;
					let adminName		=	adminDetails.full_name;
					let adminUserRoleId	=	adminDetails.user_role_id;
					let adminUserType 	=	adminDetails.user_type;

					/** Save kfg request response */
					extraPerms.mid_time 		=	getUtcDate();
					extraPerms.order_details 	=	(orderDetails) 		? true :false;
					extraPerms.order_subdetails =	(orderSubDetails) 	? true :false;
					extraPerms.order_items		=	(orderItemList)		? true :false;
					this.saveKFGRequestResponse(req,res,next,{
						method_name :	kfgMethodName,
						response	: 	{},
						log_id		: 	logId,
						request		:	{},
						request_error:	null,
						extra_perms	:	extraPerms,
					}).then(()=>{});

					/** Send error response */
					if(!orderDetails || !orderSubDetails || !orderItemList){
						return resolve({
							status : STATUS_ERROR,
							message: res.__("system.something_going_wrong_please_try_again"),
							orderDetails: orderDetails, orderSubDetails: orderSubDetails, orderItemList: orderItemList
						});
					}

					let areaId 			=	orderDetails.area_id;
					let branchId 		= 	orderDetails.branch_id;
					let offerId 		=	orderSubDetails.offer_id;
					let customerId 		= 	orderDetails.customer_id;
					let restaurantId 	= 	orderDetails.restaurant_id;
					let orderAreaId		=	orderSubDetails.delivery_area_id;
					let addressDetails 	= 	(orderSubDetails.customer_address_detail) 	?	orderSubDetails.customer_address_detail :{};
					let addBlockId 		= 	(addressDetails && addressDetails.block_id)	?	addressDetails.block_id :"";
					if(!orderAreaId) orderAreaId = areaId;

					asyncParallel({
						user_details : (childCallback)=>{
							if(!customerId) return childCallback(null, {});

							/** Get user details **/
							users.findOne({_id: customerId},(userErr, userResult)=>{
								childCallback(userErr, userResult);
							});
						},
						restaurant_details : (childCallback)=>{
							/** Get restaurants details **/
							const restaurants	= db.collection("restaurants");
							restaurants.findOne({_id: restaurantId},(restaurantErr, restaurantResult)=>{
								childCallback(restaurantErr, restaurantResult);
							});
						},
						branch_details : (childCallback)=>{
							/** Get restaurants branch details **/
							const restaurant_branches	= db.collection("restaurant_branches");
							restaurant_branches.findOne({_id: branchId},(branchErr, branchResult)=>{
								childCallback(branchErr, branchResult);
							});
						},
						offer_details : (childCallback)=>{
							if(!offerId) return childCallback(null, {});

							/** Get offers details **/
							const offers	= db.collection("offers");
							offers.findOne({_id: offerId},(offerErr, offerResult)=>{
								childCallback(offerErr, offerResult);
							});
						},
						cravez_items : (childCallback)=>{
							/** Get cravez items list **/
							const cravez_items	= db.collection("cravez_items");
							cravez_items.find({
								item_id : {$in : [
									"104495", "102495", "105205", "103495", "104795", "102695", "105495", "103795", "113014", "113015"
								]}
							},{projection: {}}).toArray((exItemErr, exItemResult)=>{
								if(exItemErr) return childCallback(exItemErr);

								let exItemObj = {};
								exItemResult.map(data=>{
									exItemObj[data.item_id] = data;
								});

								childCallback(exItemErr,exItemObj);
							});
						},
					},(childErr, childReponse)=>{
						if(childErr) return next(childErr);

						let cravezItems 		= 	(childReponse.cravez_items)	? childReponse.cravez_items	:{};
						let userDetails 		= 	childReponse.user_details;
						let offerDetails 		= 	childReponse.offer_details;
						let branchDetails 		= 	childReponse.branch_details;
						let restaurantDetails	=	childReponse.restaurant_details;

						asyncParallel({
							order_area_details : (childSubCallback)=>{
								if(!orderAreaId) return childSubCallback(null, {});

								let areaConditions = [{$eq: ["$area_id", orderAreaId]}];
								if(addBlockId) areaConditions.push({$eq: ["$block_id", addBlockId ]})

								/** Get restaurant branch area details **/
								const restaurant_branch_areas = db.collection("restaurant_branch_areas");
								restaurant_branch_areas.aggregate([
									{$match : {
										area_id 		: 	orderAreaId,
										branch_id 		: 	branchId,
										restaurant_id 	:	restaurantId
									}},
									{$lookup:	{
										from     : "cravez_areas",
										let      : {kfgAreaId: "$kfg_area_id"},
										pipeline : [
											{$match: {
												$expr: {
													$and: areaConditions
												}
											}},
										],
										as	:	"area_details"
									}},
									{$lookup: {
										from			: "cravez_areas",
										localField		: "kfg_area_id",
										foreignField	: "cravez_area_id",
										as				: "cravez_area_details",
									}},
									{$addFields: {
										area_name  			:	{$ifNull: [ {$arrayElemAt: ["$area_details.name.en", 0] }, {$arrayElemAt: ["$cravez_area_details.name.en", 0] } ] },
										cravez_province_id  :	{$ifNull: [ {$arrayElemAt: ["$area_details.cravez_province_id", 0] }, {$arrayElemAt: ["$cravez_area_details.cravez_province_id", 0] } ] },
										cravez_street_id  	:	{$ifNull: [ {$arrayElemAt: ["$area_details.cravez_street_id", 0] }, {$arrayElemAt: ["$cravez_area_details.cravez_street_id", 0] } ] },
										cravez_district_id  :	{$ifNull: [ {$arrayElemAt: ["$area_details.cravez_district_id", 0] }, {$arrayElemAt: ["$cravez_area_details.cravez_district_id", 0] } ] },
										cravez_area_id  	:	{$ifNull: [ {$arrayElemAt: ["$area_details.cravez_area_id", 0] }, {$arrayElemAt: ["$cravez_area_details.cravez_area_id", 0] } ] },
										cravez_city_id  	:	{$ifNull: [ {$arrayElemAt: ["$area_details.cravez_city_id", 0] }, {$arrayElemAt: ["$cravez_area_details.cravez_city_id", 0] } ] },
									}},
									{$project: {
										area_details: 0
									}},
								]).toArray((addErr, addResult)=>{
									addResult = (addResult && addResult[0]) ? addResult[0] :{};
									childSubCallback(addErr, addResult);
								});
							},
						},(childSubErr, childSubReponse)=>{
							if(childSubErr) return next(childSubErr);

							let orderAreaDetails=	childSubReponse.order_area_details;
							let orderAmount 	=	orderSubDetails.total_amount;
							let restConceptId 	=	restaurantDetails.concept_id;
							let restSlug 		=	restaurantDetails.slug;
							let orderNetAmount 	=	orderSubDetails.net_amount;
							let deliveryType 	=	orderDetails.delivery_type;
							let totalOrderAmount=	orderDetails.order_price;
							let debitedByWallet =	orderDetails.amount_debited_by_wallet;
							let deliveryFee   	=	(orderSubDetails.delivery_fee)		?	orderSubDetails.delivery_fee	:0;
							let discountPrice 	=	(orderSubDetails.discount_price)	? 	orderSubDetails.discount_price	:0;
							// let offerCode 		=	(orderSubDetails.offer_code)		?	orderSubDetails.offer_code  	:0;
							let paymentMethod 	=	orderSubDetails.payment_method;
							let mobileNumber	= 	(userDetails.mobile_number) ? userDetails.mobile_number :-1;
							let clientType		= 	(userDetails.client_type) ? userDetails.client_type :-1;
							let userGender		= 	(userDetails.gender) ? userDetails.gender :MALE;
							let dateOfBirth		= 	(userDetails.date_of_birth) ? newDate(userDetails.date_of_birth,ORDER_PLACE_DOB_DATE_FORMAT):"1970-01-01T00:00:00";
							let phoneCountryCode= 	(userDetails.phone_country_code) ? userDetails.phone_country_code :DEFAULT_COUNTRY_CODE;
							let orderStatus		= 	(orderDetails.order_status)  ? orderDetails.order_status  :"";
							let kfgStoreId		= 	(branchDetails.kfg_store_id) ? branchDetails.kfg_store_id :-1;
							let kfgStoreNumber	=	(branchDetails.kfg_store_number)?branchDetails.kfg_store_number :-1;
							let cravezCityId	=	(orderAreaDetails.cravez_city_id)?orderAreaDetails.cravez_city_id :-1;
							let cravezAreaId 	=	(orderAreaDetails.cravez_area_id)?orderAreaDetails.cravez_area_id:-1;
							let areaName  		= 	(orderAreaDetails.area_name) ? orderAreaDetails.area_name 	:"";
							let street	  		= 	(addressDetails.street) 	? addressDetails.street 		:"";
							let flatNumber		= 	(addressDetails.flat_number) ? addressDetails.flat_number 	:"";
							let floorNumber		= 	(addressDetails.floor_number) ? addressDetails.floor_number 	:"";
							let buildingNumber	=	(addressDetails.building_number)?addressDetails.building_number:"";
							let provinceId		=	(orderAreaDetails.cravez_province_id)?orderAreaDetails.cravez_province_id 	:-1;
							let cravezStreetId	=	(orderAreaDetails.cravez_street_id) ? orderAreaDetails.cravez_street_id:-1;
							let districtId 		=	(orderAreaDetails.cravez_district_id)?orderAreaDetails.cravez_district_id :-1;
							let areaDesc   		= 	areaName;
							let orderMode   	= 	(deliveryType == DELIVERY_BY_PICK_UP) 	? 2 :1;
							let isSchedule   	=	(orderDetails.is_schedule && !orderDetails.scheduled_to_submit_time) ? true :false;
							let orderType   	= 	(isSchedule) ? 1 :0;
							let orderDate		=	newDate(orderDetails.order_date,ORDER_PLACE_DATE_FORMAT);
							let uniqueOrderId	=	orderDetails.unique_order_id;
							let currentStatus	= 	orderDetails.order_status;
							let additionalDirections= (addressDetails.additional_directions)? 	addressDetails.additional_directions	:"";
							let custLatitude	=	(orderSubDetails.customer_latitude)		? 	orderSubDetails.customer_latitude 		:"";
							let custLongitude	= 	(orderSubDetails.customer_longitude)	?	orderSubDetails.customer_longitude 		:"";
							let compositeDelFees= 	(orderSubDetails.composite_delivery_fees)?	orderSubDetails.composite_delivery_fees	:0;
							let corporateDelFees= 	(orderSubDetails.corporate_delivery_fees)?	orderSubDetails.corporate_delivery_fees	:0;
							let offerDelFees	= 	(orderSubDetails.offer_delivery_fees)?	orderSubDetails.offer_delivery_fees	:0;
							let isOrderPaid		=	(paymentMethod == CASH_PAYMENT) ? false :true;
							let addressMapCode	=	(custLatitude && custLongitude) ? custLatitude+","+custLongitude :null;
							let allPaymentMethodList = [paymentMethod];
							let deliveryOfferDis 	=	compositeDelFees+corporateDelFees+offerDelFees;
							let completeDiscount	=	discountPrice+deliveryOfferDis;
							deliveryFee 			=	(!deliveryFee) ? deliveryOfferDis :deliveryFee;

							if(paymentMethod != WALLET_PAYMENT && debitedByWallet >0){
								allPaymentMethodList = [paymentMethod, WALLET_PAYMENT];
							}

							let paymentElements = [];
							allPaymentMethodList.map(tmpPayMethod=>{
								/** Manage order amount payment method wise like order ka total amount 10Kd tha wallet se 2kd or cash se 8kd  */
								let tmpAmount = (tmpPayMethod == WALLET_PAYMENT) ? debitedByWallet :totalOrderAmount;
								if(debitedByWallet >0 && tmpPayMethod != WALLET_PAYMENT){
									tmpAmount = tmpAmount-debitedByWallet;
								}

								let paymentRefNo 		= 	(tmpPayMethod != CASH_PAYMENT) ? 10001 :0;
								let paymentStatus 		=	(tmpPayMethod != CASH_PAYMENT) ? 1 :0;
								let tmpPaymentType 		=	(tmpPayMethod != CASH_PAYMENT) ? 2 :0;
								let paymentSubType  	= 	8; // for credit
								let storeTenderId  		= 	308; // for credit
								let xmlPaymentMethod  	= 	"online Payment"; // for credit

								if(tmpPayMethod == CASH_PAYMENT){
									storeTenderId 		= 0;
									paymentSubType 		= 0;
									xmlPaymentMethod 	= 0;
								}
								if(tmpPayMethod == WALLET_PAYMENT){
									storeTenderId 		= 	314;
									paymentSubType 		=	13;
									xmlPaymentMethod 	= 	"CrvzCBack";
								}
								if(tmpPayMethod == KNET){
									storeTenderId 		= 	318;
									paymentSubType 		=	11;
									xmlPaymentMethod 	= 	"CravezKNET";
								}

								paymentElements.push({
									OrderPayment :[
										{name:'Payment_Type', text: tmpPaymentType },
										{name:'Payment_RefNo', text: paymentRefNo },
										{name:'Payment_Amount', text: tmpAmount },
										{name:'Payment_Status', text: paymentStatus },
										{name:'Payment_SubType', text: paymentSubType },
										{name:'Payment_StoreTenderId', text: storeTenderId },
										{name:'Payment_Method', text: xmlPaymentMethod },
									]
								});
							});

							if(addressDetails){
								let firstName =	(addressDetails.first_name) ? addressDetails.first_name 	:"";
								let lastName = 	(addressDetails.last_name) 	? addressDetails.last_name 		:"";
								let addressType=(addressDetails.address_type)? addressDetails.address_type 	:"";
								let blockName= 	(addressDetails.block_name) ? addressDetails.block_name.en 	:"";
								let cityName = 	(addressDetails.city_name) 	? addressDetails.city_name.en	:"";

								areaDesc = firstName+" "+lastName+", "+addressType+", "+blockName+", "+street+", "+areaName+", "+cityName;
							}

							let menuId 		 =  (restSlug == BURGER_KING) ? BURGER_KING_MENU_ID :PIZZA_HUT_MENU_ID;
							let itemSeq		 =  0;
							let lineGroupId	 =  0;
							let orderEntries =	[];
							orderItemList.map((records,index)=>{
								let itemQty 	= 	records.qty;
								let itemName 	=	records.item_name;
								let unitDetails	=	(records.unit_details) 	? 	records.unit_details 	:{};
								let doughDetails=	(records.dough_details) ? 	records.dough_details 	:{};
								let itemDetails =	(records.item_details) 	? 	records.item_details 	:"";
								let parSizeId 	=	(unitDetails.size_id) 	? 	unitDetails.size_id 	:"";
								let parDoughType=	(doughDetails.dough_type)?	doughDetails.dough_type :"";
								let itemType 	=	itemDetails.item_type;
								// let itemLevel  	=	(itemType == HALF_AND_HALF_ITEM || itemType == DEAL_ITEM) ? 2 :0;
								let itemLevel  	=	0;
								let tmpItemId 	=	itemDetails.item_id;
								let itemMainPrice=	records.item_main_price;
								let itemNote 	=	records.note;
								let comboUpsellId = (unitDetails.combo_upsell_id) ? unitDetails.combo_upsell_id :0;

								if(itemType == NORMAL_VGROUP){
									tmpItemId = unitDetails.cravez_item_id;

									if(unitDetails && unitDetails.name) itemName = unitDetails.name;
								}

								if(itemType == HALF_AND_HALF_ITEM){
									if(parSizeId == 2){
										if(parDoughType == 2){
											tmpItemId = 104495;
											if(cravezItems[tmpItemId] && cravezItems[tmpItemId].name){
												itemName = cravezItems[tmpItemId].name;
											}else{
												itemName = {en: "Med CLSC Half n Half", ar: "Med CLSC Half n Half" };
											}
										}

										if(parDoughType == 3){
											tmpItemId = 102495;
											if(cravezItems[tmpItemId] && cravezItems[tmpItemId].name){
												itemName = cravezItems[tmpItemId].name;
											}else{
												itemName = {en: "Med Pan Half n Half", ar: "Med Pan Half n Half" };
											}
										}

										if(parDoughType == 4){
											tmpItemId = 105205;
											if(cravezItems[tmpItemId] && cravezItems[tmpItemId].name){
												itemName = cravezItems[tmpItemId].name;
											}else{
												itemName = {en: "Med STF Half n Half", ar: "Med STF Half n Half" };
											}
										}

										if(parDoughType == 5){
											tmpItemId = 103495;
											if(cravezItems[tmpItemId] && cravezItems[tmpItemId].name){
												itemName = cravezItems[tmpItemId].name;
											}else{
												itemName = {en: "Med Thin Half n Half", ar: "Med Thin Half n Half" };
											}
										}
									}

									if(parSizeId == 3){
										if(parDoughType == 2){
											tmpItemId = 104795;
											if(cravezItems[tmpItemId] && cravezItems[tmpItemId].name){
												itemName = cravezItems[tmpItemId].name;
											}else{
												itemName = {en: "Lrg CLSC Half n Half", ar: "Lrg CLSC Half n Half" };
											}
										}

										if(parDoughType == 3){
											tmpItemId = 102695;
											if(cravezItems[tmpItemId] && cravezItems[tmpItemId].name){
												itemName = cravezItems[tmpItemId].name;
											}else{
												itemName = {en: "Lrg Pan Half n Half", ar: "Lrg Pan Half n Half" };
											}
										}

										if(parDoughType == 4){
											tmpItemId = 105495;
											if(cravezItems[tmpItemId] && cravezItems[tmpItemId].name){
												itemName = cravezItems[tmpItemId].name;
											}else{
												itemName = {en: "Lrg STF Half n Half", ar: "Lrg STF Half n Half" };
											}
										}

										if(parDoughType == 5){
											tmpItemId = 103795;
											if(cravezItems[tmpItemId] && cravezItems[tmpItemId].name){
												itemName = cravezItems[tmpItemId].name;
											}else{
												itemName = {en: "LRG Thin Half n Half", ar: "LRG Thin Half n Half" };
											}
										}
									}
								}

								let comboItemId 	 = 0;
								let comboComponentId = 0;
								if(itemType == COMBO_ITEM){
									let upsellItemIds 	= 	(itemDetails.combo_upsell_item_ids) ? itemDetails.combo_upsell_item_ids :{};
									comboItemId 		=	tmpItemId;
									comboComponentId	=	1;
									tmpItemId 			=	(upsellItemIds[comboUpsellId]) ? upsellItemIds[comboUpsellId] :0;

									if(itemDetails.first_component_details && itemDetails.first_component_details[comboUpsellId]){
										if(itemDetails.first_component_details[comboUpsellId].short_name){
											itemName = itemDetails.first_component_details[comboUpsellId].short_name;
										}
									}
								}

								for(var i =1; i <= itemQty; i++){
									itemSeq		+=	1;
									lineGroupId	+= 	1;

									if(itemType == PIZZA_VGROUP){
										if(index == 0 && i == 1){
											itemSeq = 0;
										}
									}else{
										orderEntries.push({
											OrderLines :[
												{name:'Line_ItemMode', text: 'OM_SAVED'},
												{name:'Line_Status', text: 'S'},
												{name:'Line_NCRStatus', text: 'NOTAPPLIED'},
												{name:'Line_ItemLevel', text: itemLevel},
												{name:'Line_ItemId', text: tmpItemId},
												{name:'Line_ItemName', text: itemName["en"]},
												{name:'Line_ItemPrice', text: round(itemMainPrice)},
												{name:'Line_ItemModgroupID', text: 0},
												{name:'Line_ItemGroupId', text: lineGroupId},
												{name:'Line_ItemSeqNo', text: itemSeq},
												{name:'Line_ItemRemarks', text: itemNote},
												{name:'Combo_ProdId', text: comboItemId},
												{name:'Combo_InstanceId', text: 4},
												{name:'Combo_ComponentId', text: comboComponentId},
											]
										});
									}

									//  Side A => 113014, Side B => 113015
									let pizzaSide = ["A","B","C","D","E","F","G","H"];
									if(records.unit_lists && records.unit_lists.length >0){
										records.unit_lists.map((data,dataIndex)=>{
											if(itemType == HALF_AND_HALF_ITEM){
												itemSeq	= itemSeq+1;
												let hnhItemId = (dataIndex%2 ==0) ? 113014 :113015;
												let hnhItemName = "=> "+pizzaSide[dataIndex]+" SIDE";

												if(cravezItems[hnhItemId] && cravezItems[hnhItemId].name && cravezItems[hnhItemId].name.en){
													hnhItemName = cravezItems[hnhItemId].name.en;
												}

												orderEntries.push({
													OrderLines :[
														{name:'Line_ItemMode', text: 'OM_SAVED'},
														{name:'Line_Status', text: 'S'},
														{name:'Line_NCRStatus', text: 'NOTAPPLIED'},
														{name:'Line_ItemLevel', text: 1},
														{name:'Line_ItemId', text: hnhItemId},
														{name:'Line_ItemName', text: hnhItemName},
														{name:'Line_ItemPrice', text: 0},
														{name:'Line_ItemModgroupID', text: 0},
														{name:'Line_ItemGroupId', text: lineGroupId},
														{name:'Line_ItemSeqNo', text: itemSeq},
														{name:'Line_ItemRemarks'},
														{name:'Combo_ProdId', text: comboItemId},
														{name:'Combo_InstanceId', text: 4},
														{name:'Combo_ComponentId', text: comboComponentId},
													]
												});
											}

											if(itemType == DEAL_ITEM){
												let dealAllItems = (itemDetails.v_group_item_ids) ? itemDetails.v_group_item_ids :[];
												let dealSizeId = (data.unit_details && data.unit_details.size_id) ? data.unit_details.size_id :"";
												let dealDoughId = (data.dough_details && data.dough_details.kfg_dough_type) ? data.dough_details.kfg_dough_type :"";
												let dealSelectorId = (data.selector_details && data.selector_details.kfg_selector) ? data.selector_details.kfg_selector :"";
												let dealSelectorName = (data.selector_details && data.selector_details.selector_name) ? data.selector_details.selector_name :"";

												if(dealAllItems.length >0 && dealSizeId && dealDoughId && dealSelectorId){
													let dealItemId = "";

													dealAllItems.map(dealRecords=>{
														if(String(dealRecords.size) == String(dealSizeId) && String(dealRecords.dough_type) == String(dealDoughId) && String(dealRecords.selector) == String(dealSelectorId)){
															dealItemId = dealRecords.item_id;
														}
													});

													if(dealItemId && dealSelectorName){
															itemSeq	= itemSeq+1;
															orderEntries.push({
																OrderLines :[
																	{name:'Line_ItemMode', text: 'OM_SAVED'},
																	{name:'Line_Status', text: 'S'},
																	{name:'Line_NCRStatus', text: 'NOTAPPLIED'},
																	{name:'Line_ItemLevel', text: 1},
																	{name:'Line_ItemId', text: dealItemId},
																	{name:'Line_ItemName', text: dealSelectorName },
																	{name:'Line_ItemPrice', text: 0},
																	{name:'Line_ItemModgroupID', text: 0},
																	{name:'Line_ItemGroupId', text: lineGroupId},
																	{name:'Line_ItemSeqNo', text: itemSeq},
																	{name:'Line_ItemRemarks'},
																	{name:'Combo_ProdId', text: comboItemId},
																	{name:'Combo_InstanceId', text: 4},
																	{name:'Combo_ComponentId', text: comboComponentId},
																]
															});
													}
												}
											}

											if(data.extra_items && data.extra_items.length>0){
												data.extra_items.map(exDat=>{
													let groupDetails 	= exDat.group_details;
													let componentId		= (groupDetails.kfg_combo_components_id) ? groupDetails.kfg_combo_components_id :0;

													exDat.extra_item_ids.map(unData=>{
														itemSeq				= 	itemSeq+1;
														let exItemDetails	= 	unData.item_details;
														let exItemPrice		= 	(unData.extra_fees) ? unData.extra_fees :0;
														let exItemName		=	(unData.extra_item_name) ? unData.extra_item_name :{};

														orderEntries.push({
															OrderLines :[
																{name:'Line_ItemMode', text: 'OM_SAVED'},
																{name:'Line_Status', text: 'S'},
																{name:'Line_NCRStatus', text: 'NOTAPPLIED'},
																{name:'Line_ItemLevel', text: 2},
																{name:'Line_ItemId', text:exItemDetails.extra_item_id},
																{name:'Line_ItemName', text: exItemName.en },
																{name:'Line_ItemPrice', text: exItemPrice},
																{name:'Line_ItemModgroupID', text: 0},
																{name:'Line_ItemGroupId', text: lineGroupId},
																{name:'Line_ItemSeqNo', text: itemSeq},
																{name:'Line_ItemRemarks'},
																{name:'Combo_ProdId', text: comboItemId},
																{name:'Combo_InstanceId', text: 4},
																{name:'Combo_ComponentId', text: componentId},
															]
														});
													});
												});
											};
										});
									}

									if(records.extra_items && records.extra_items.length >0){
										records.extra_items.map(exDat=>{
											itemSeq				=	itemSeq+1;
											let groupDetails 	= exDat.group_details;
											let exItemDetails	= exDat.item_details;
											let exItemName		= (exDat.extra_item_name) ? exDat.extra_item_name :{};
											let exItemPrice		= (exDat.price) ? exDat.price :0;
											let componentId		= (groupDetails.kfg_combo_components_id) ? groupDetails.kfg_combo_components_id :0;
											let tmpComboItemId	= comboItemId;

											if(comboItemId && !componentId){
												tmpComboItemId 	= 0;
												componentId 	= 0;
											}

											let exItemLevel = 1;
											if(exItemDetails.is_extra && itemType == PIZZA_VGROUP){
												exItemLevel = 0;
											}

											if(itemType != PIZZA_VGROUP) itemNote = "";

											orderEntries.push({
												OrderLines :[
													{name:'Line_ItemMode', text: 'OM_SAVED'},
													{name:'Line_Status', text: 'S'},
													{name:'Line_NCRStatus', text: 'NOTAPPLIED'},
													{name:'Line_ItemLevel', text: exItemLevel},
													{name:'Line_ItemId', text: exItemDetails.extra_item_id},
													{name:'Line_ItemName', text: exItemName.en },
													{name:'Line_ItemPrice', text: exItemPrice},
													{name:'Line_ItemModgroupID', text: 0},
													{name:'Line_ItemGroupId', text: lineGroupId},
													{name:'Line_ItemSeqNo', text: itemSeq},
													{name:'Line_ItemRemarks', text: itemNote},
													{name:'Combo_ProdId', text: tmpComboItemId},
													{name:'Combo_InstanceId', text: 4},
													{name:'Combo_ComponentId', text: componentId},
												]
											});
										});
									}
								}
							});

							let paymentItemId = "";
							if(menuId == BURGER_KING_MENU_ID){
								if(paymentMethod == CASH_PAYMENT){
									paymentItemId = 259239;
								}else if(paymentMethod == KNET){
									paymentItemId = 259240;
								}else{
									paymentItemId = 259249;
								}
							}else if(menuId == PIZZA_HUT_MENU_ID){
								if(paymentMethod == CASH_PAYMENT){
									paymentItemId = 131094;
								}else if(paymentMethod == KNET){
									paymentItemId = 131095;
								}else{
									paymentItemId = 131096;
								}
							}

							if(paymentItemId){
								orderEntries.push({
									OrderLines :[
										{name:'Line_ItemMode', text: 'OM_SAVED'},
										{name:'Line_Status', text: 'S'},
										{name:'Line_NCRStatus', text: 'NOTAPPLIED'},
										{name:'Line_ItemLevel', text: 0 },
										{name:'Line_ItemId', text: paymentItemId},
										{name:'Line_ItemName', text: "CRAVEZ"},
										{name:'Line_ItemPrice', text: 0},
										{name:'Line_ItemModgroupID', text: 0},
										{name:'Line_ItemGroupId', text: lineGroupId+1},
										{name:'Line_ItemSeqNo', text: itemSeq+1},
										{name:'Line_ItemRemarks', text: "NO NOTES"},
										{name:'Combo_ProdId', text: 0},
										{name:'Combo_InstanceId', text: 4},
										{name:'Combo_ComponentId', text: 0},
									]
								});
							}

							let xmlData = jsonxml({
								Customer:[
									{name:'Customer_Id', text: -1},
									{name:'Customer_Telephone', text: mobileNumber},
									{name:'Customer_Username', text: mobileNumber },
									{name:'Customer_Password', text: mobileNumber },
									{name:'Customer_Email', text: "Guest@KoutFood.com"},
									{name:'Customer_FirstName', text: userDetails.first_name},
									{name:'Customer_MiddleName', text: ""},
									{name:'Customer_LastName', text:  userDetails.last_name},
									{name:'Customer_Title', text: 1},
									{name:'Customer_Gender', text: (userGender != MALE) ? 0 :1},
									{name:'Customer_MaritalStatus', text: -1},
									{name:'Customer_Nationality', text: -1},
									{name:'Customer_DateOfBirth', text: dateOfBirth},
									{name:'Customer_Company'},
									{name:'Customer_Occupation'},
									{name:'Customer_PhoneType', text: 2},
									{name:'Customer_CountryCode', text: 3},
									{name:'Customer_AreaCode', text: (mobileNumber) ? mobileNumber.substr(0,1):0},
									{name:'Customer_Extenstion'},
									{name:'Customer_Dependents', text:1},
									{name:'Customer_ClassId', text: (clientType == USER_CLIENT_TYPE_VIP) ? 2 :1}
								],
								Address:[
									{name:'Address_Id', text: -1},
									{name:'Address_Name', text: 'CC_Address'},
									{name:'Address_Type', text: -1},
									{name:'Address_CountryId', text: 3},
									{name:'Address_ProvinceId', text: provinceId},
									{name:'Address_CityId', text: cravezCityId},
									{name:'Address_DistrictId', text: districtId},
									{name:'Address_DistrictText', text: 'Unspecified'},
									{name:'Address_StreetId', text: cravezStreetId},
									{name:'Address_StreetText', text: street},
									{name:'Address_AreaId', text: cravezAreaId },
									{name:'Address_AreaText', text: (areaName) ? areaName.substr(0,99) :-1 },
									{name:'Address_ClassId', text: -1},
									{name:'Address_PhoneAreaCode',text:(mobileNumber)?mobileNumber.substr(0,1):-1},
									{name:'Address_PhoneCountry', text: phoneCountryCode},
									{name:'Address_BuildingName'},
									{name:'Address_BuildingNumber', text: buildingNumber},
									{name:'Address_Floor', text: floorNumber},
									{name:'Address_Flat', text: flatNumber},
									{name:'Address_County', text: 0},
									{name:'Address_Sketch'},
									{name:'Address_Desc', text: (areaDesc) ? areaDesc.substr(0,100) :-1 },
									{name:'Address_Remarks', text: additionalDirections},
									{name:'Address_MapCode', text: addressMapCode},
									{name:'Address_StoreId', text: kfgStoreId},
								],
								OrderHeader:[
									{name:'Order_Id', text:  uniqueOrderId},
									{name:'Order_POS_OrderId', text: -1},
									{name:'Order_Date', text: orderDate},
									{name:'Order_Time', text:orderDate},
									{name:'Order_ConceptId', text: restConceptId},
									{name:'Order_MenuId', text: menuId},
									{name:'Order_ModeId', text: orderMode},
									{name:'Order_TypeId', text: orderType},
									{name:'Order_StoreNumber', text: kfgStoreNumber},
									{name:'Order_Remarks'},
									{name:'Order_Note1', text: orderDetails.request_note},
									{name:'Order_Note2'},
									{name:'Order_SubTotal', text: orderNetAmount },
									{name:'Order_ServiceCharge', text: deliveryFee},
									{name:'Order_Total', text: parseFloat(orderNetAmount)+parseFloat(deliveryFee)},
									{name:'Order_SalesAmount', text: orderAmount},
									{name:'Order_Discount', text: (completeDiscount > 0) ? true :false },
									{name:'Order_Paid', text:  isOrderPaid },
									{name:'OrderPayments',children: paymentElements},
									{name:'OrderDiscount', children: {
										Discount_Id 	:	(orderDetails.kfg_offer_id)   ? orderDetails.kfg_offer_id : 0,
										Discount_Amount	:	completeDiscount,
										Discount_Name 	:	(orderDetails.kfg_offer_name) ? orderDetails.kfg_offer_name : '',
									}},
									{name:'OrderEntries',children: orderEntries},
								]
							});

							xmlData 			=	"<WEBORDER>"+xmlData+"</WEBORDER>";
							let kfgRequest 		= 	{LicenceKey:SOAP_LICENCE_KEY, Xml: xmlData };

							/** Save kfg request response */
							extraPerms.before_time 		=	getUtcDate();
							extraPerms.unique_order_id 	=	uniqueOrderId;
							this.saveKFGRequestResponse(req,res,next,{
								method_name :	kfgMethodName,
								response	: 	{},
								log_id		: 	logId,
								request		:	kfgRequest,
								request_error:	null,
								extra_perms	:	extraPerms,
							}).then(()=>{

								let resMsg 	= 	"Bad Request";
								try{
									client[kfgMethodName]({LicenceKey:SOAP_LICENCE_KEY, Xml: xmlData },(err,apiResponse)=>{
										let apiData	= 	(apiResponse) ? ((isModified && apiResponse.ModifyOrderResult) ? apiResponse.ModifyOrderResult : (apiResponse.PostOrderResult ? apiResponse.PostOrderResult :"") ) :"";

										console.log("err ",err);
										console.log("apiResponse ",apiResponse);
										console.log("apiData ",apiData);

										let resCode =	"";
										if(apiData){
											let trimedData		= 	apiData.replace(new RegExp(/\t/g),'').trim();
											let jsonData		= 	JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));
											if(jsonData.ResponseList && jsonData.ResponseList.Response){
												if(jsonData.ResponseList.Response.constructor === Array){
													jsonData.ResponseList.Response.map((tmpData, tmpIndex)=>{
														if(tmpData.Message._text){
															if(tmpIndex == 0) resMsg = "";
															if(tmpIndex > 0) resMsg += ", ";
															resMsg += tmpData.Message._text;
														}

														resCode = (tmpData.ResponseCode._text) ? tmpData.ResponseCode._text :"";
													});
												}else{
													resCode = (jsonData.ResponseList.Response.ResponseCode._text) ? jsonData.ResponseList.Response.ResponseCode._text :"";
													resMsg	= (jsonData.ResponseList.Response.Message._text) ? jsonData.ResponseList.Response.Message._text :resMsg;
												}
											}
										}

										console.log("resMsg ",resMsg);
										console.log("resCode ",resCode);

										/** Save kfg request response */
										extraPerms.after_time =	getUtcDate();
										this.saveKFGRequestResponse(req,res,next,{
											method_name :	kfgMethodName,
											response	: 	apiResponse,
											log_id		: 	logId,
											request		:	kfgRequest,
											request_error:	err,
											extra_perms	:	extraPerms,
										}).then(()=>{});

										let isPlaced	=	(!err && resCode == ORDER_SUCCESS_CODE) ? true :false;
										if(!resMsg) resMsg = "Bad Request";
										asyncParallel({
											reject_order : (callback)=>{
												if(isPlaced) return callback(null);

												this.rejectOrder(req,res,next,{
													order_id 			: 	orderId,
													branch_id 			: 	branchId,
													user_type 			: 	adminUserType,
													updated_by 			: 	adminId,
													customer_id 		: 	customerId,
													user_role_id 		: 	adminUserRoleId,
													restaurant_id 		: 	restaurantId,
													current_status 		: 	currentStatus,
													rejection_reason 	: 	resMsg,
													updated_user_name	: 	adminName,
													unique_order_id		:	uniqueOrderId,
													is_modified 		: 	isModified,
												}).then(()=>{
													callback(null);
												}).catch(next);
											},
											update_order : (callback)=>{
												let orderUpdateData = {$set: { modified: getUtcDate()}};

												if(isPlaced){
													if(!isModified) orderUpdateData["$set"] =	{success_push_to_kfg: getUtcDate() };
													if(isModified) 	orderUpdateData["$set"]	= 	{modified_success_push_to_kfg: getUtcDate() };

													orderUpdateData["$unset"]= {is_completed: 1, reject_by_kfg: 1};
												}else{
													orderUpdateData["$set"].reject_by_kfg =	 getUtcDate();
												}

												/** Update order details */
												orders.updateOne({_id: orderId}, orderUpdateData ,()=>{
													callback(null);
												});
											},
											send_mail : (callback)=>{
												if(!isPlaced) return callback(null);

												callback(null);

												sendKfgOrderMail(req,res,next,{
													order_id 			: 	orderId,
													is_placed 			: 	isPlaced,
													rejection_reason	: 	resMsg,
												}).then((mailRes)=>{
													console.log("mailRes");
													console.log(mailRes);
												}).catch(next);
											},
										},()=>{

											/** Send response */
											resolve({
												status 		:	(isPlaced) 	? STATUS_SUCCESS :STATUS_ERROR,
												message 	:	(!isPlaced) ? res.__("order.order_not_place_msg",resMsg) :"",
												apiResponse :	apiResponse,
												apiResuest 	:	client.lastRequest,
											});
										});
									},{
										timeout	: 	30000,  // 30 sec
									});
								}catch(e){

									/** Send response */
									resolve({
										status 		:	STATUS_ERROR,
										message 	:	res.__("order.order_not_place_msg",resMsg),
										apiResuest 	:	kfgRequest,
										apiResponse :	{},
									});

									/** Save kfg request response */
									extraPerms.catch_time =	getUtcDate();
									this.saveKFGRequestResponse(req,res,next,{
										method_name 	:	kfgMethodName,
										response		: 	{},
										log_id			: 	logId,
										request			:	kfgRequest,
										request_error	:	e,
										extra_perms		:	extraPerms,
									}).then(()=>{ });

									this.rejectOrder(req,res,next,{
										order_id 			: 	orderId,
										branch_id 			: 	branchId,
										user_type 			: 	adminUserType,
										updated_by 			: 	adminId,
										customer_id 		: 	customerId,
										user_role_id 		: 	adminUserRoleId,
										restaurant_id 		: 	restaurantId,
										current_status 		: 	currentStatus,
										rejection_reason 	: 	resMsg,
										updated_user_name	: 	adminName,
										unique_order_id		:	uniqueOrderId,
										is_modified 		: 	isModified,
									}).then(()=>{ });
								}
							});
						});
					});
				});
			});
		}).catch(next);
	};//End kfgPlaceOrder()

    /**
	 * Function to  place order
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async rejectOrder (req, res,next,options){
		return new Promise(resolve=>{
            let orderId             =   options.order_id;
            let branchId            =   options.branch_id;
            let userType            =   options.user_type;
            let updatedBy           =   options.updated_by;
            let customerId          =   options.customer_id;
            let userRoleId          =   options.user_role_id;
            let restaurantId        =   options.restaurant_id;
            let currentStatus       =   options.current_status;
            let rejectionReason     =   options.rejection_reason;
            let uniqueOrderId     	=   options.unique_order_id;
			let isModified			=   options.is_modified;

			/** Set update data */
			let orderUpdateData = {
				$set : {
					order_status	: 	Constants.ORDER_REJECTED_BY_ADMIN,
					modified 		: 	getUtcDate(),
					reject_by_kfg 	: 	getUtcDate(),
					rejection_reason: 	rejectionReason
            	},
			};

			if(isModified){
				orderUpdateData["$unset"]	= 	{modified_success_push_to_kfg: 1};
			}else{
				orderUpdateData["$unset"]	=	{success_push_to_kfg: 1};
			}

            /** Update order details */
            const orders    =   db.collection("orders");
            orders.updateOne({_id : ObjectId(orderId) },orderUpdateData,(updateErr) => {
                if(updateErr) return next(updateErr);

				resolve({status : STATUS_SUCCESS});

				/** Send mail kfg */
				sendKfgOrderMail(req,res,next,{
					order_id 			: 	orderId,
					is_placed 			: 	false,
					rejection_reason	: 	rejectionReason,
				}).then(()=>{ }).catch(next);

                /** Save order status logs */
                saveOrderStatusLogs(req,res,next,{
                    updated_by 		: 	updatedBy,
                    user_role_id 	: 	userRoleId,
                    status 			:	Constants.ORDER_REJECTED_BY_ADMIN,
                    order_status	:	currentStatus,
                    restaurant_id	:	restaurantId,
                    order_id 		:	orderId,
                    branch_id		:	branchId,
                    user_id			:	customerId,
                    user_type		:	userType,
                    is_admin        :   true,
                    not_refund      :   true,
                    kfg_api      	:   true,
					not_send_notification: true
                }).then(()=>{

					/** Generate ticket when order not place */
					generateTicket(req,res,next,{
						order_id 		: 	orderId,
						type 			:	AUTOMATED_TICKET_FOR_NOT_PLACE_KFG_ORDER,
						message_params 	:	[uniqueOrderId,rejectionReason],
					}).then(()=>{}).catch(next);
                });
            });
		}).catch(next);
	};//End rejectOrder()

	/**
	 * Function to cancel order
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async cancelOrder (req, res,next,client){
		return new Promise(resolve=>{
			let orderId			=	(req.params.order_id) 		? 	ObjectId(req.params.order_id)	:"";
			let cancelledReason	=	(req.body.cancelled_reason)	?	req.body.cancelled_reason		:"";
			let logId			=	ObjectId();

			/** Save kfg request response */
			let exPerms = {start_time: getUtcDate(), order_id: orderId};
			this.saveKFGRequestResponse(req,res,next,{
				method_name :	"CancelOrder",
				response	: 	{},
				log_id		: 	logId,
				request		:	{},
				extra_perms	:	exPerms,
			}).then(()=>{

				/** Get order details */
				const orders = 	db.collection("orders");
				orders.findOne({_id: orderId },{projection:{unique_order_id:1}},(err,result)=>{
					if(err) return next(err);

					/** Save kfg request response */
					exPerms.before_time		= 	getUtcDate();
					exPerms.result			= 	(result) ? true :false;
					exPerms.unique_order_id = 	(result) ?	result.unique_order_id :"";
					this.saveKFGRequestResponse(req,res,next,{
						method_name :	"CancelOrder",
						response	: 	{},
						log_id		: 	logId,
						request		:	{},
						extra_perms	:	exPerms,
					}).then(()=>{

						/** Send error response */
						if(!result){
							return resolve({ status : STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again"), missing_order_details: true });
						}

						let resMsg	=  	res.__("orders.order_cancellation_failed_due_to_kfg_delay");
						let xmlData =	jsonxml({
							CancelOrder:[
								{name:'Order_Id', text: result.unique_order_id},
								{name:'Order_Cancelled_Time', text: newDate("",ORDER_PLACE_DATE_FORMAT)},
								{name:'Order_Cancelled_Id', text: -1 },
								{name:'Order_Cancelled_Reason', text: cancelledReason },
								{name:'Order_Cancelled_Comments', text: "NA"}
							]
						});

						try{
							client["CancelOrder"]({LicenceKey: SOAP_LICENCE_KEY, Xml: xmlData },(err, apiResponse)=>{
								let apiData	= 	(apiResponse && apiResponse.CancelOrderResult) ? apiResponse.CancelOrderResult :"";
								let resCode =	"";

								if(apiData){
									let trimedData		= 	apiData.replace(new RegExp(/\t/g),'').trim();
									let jsonData		= 	JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));
									if(jsonData.ResponseList && jsonData.ResponseList.Response){
										if(jsonData.ResponseList.Response.constructor === Array){
											jsonData.ResponseList.Response.map(tmpData=>{
												resCode = (tmpData.ResponseCode._text) ? tmpData.ResponseCode._text :"";
											});
										}else{
											resCode = (jsonData.ResponseList.Response.ResponseCode._text) ? jsonData.ResponseList.Response.ResponseCode._text :"";
										}
									}
								}

								let isCanceled = (err || resCode == ORDER_SUCCESS_CODE) ? true :false;

								/** Save kfg request response */
								exPerms.after_time 	= getUtcDate();
								this.saveKFGRequestResponse(req,res,next,{
									method_name :	"CancelOrder",
									log_id		: 	logId,
									response 	: 	client.lastResponse,
									request	 	: 	client.lastRequest,
									request_error:	err,
									extra_perms	:	exPerms,
								}).then(()=>{});

								/** Send response */
								resolve({
									err 		:	err,
									status 	 	:	(isCanceled)	? 	STATUS_SUCCESS 	:STATUS_ERROR,
									status 	 	:	(!isCanceled) 	?	resMsg	 	  	:"",
									apiResponse :	client.lastResponse,
									xmlData 	: 	xmlData,
								});
							},{
								timeout	: 	30000,  // 30 sec
							});
						}catch(e){

							resolve({
								err 	 :	e,
								status 	 :	STATUS_ERROR,
								message	 :	resMsg,
								response : 	{},
								request	 : 	xmlData,
							});

							/** Save aghzeya request response */
							exPerms.catch_time 	= getUtcDate();
							AGHZEYA.saveApiRequestResponse(req,res,next,{
								log_id 			: 	logId,
								method_name 	: 	"CancelOrder",
								response		: 	{},
								request			: 	xmlData,
								request_error	:	e,
								extra_perms 	:	exPerms
							}).then(()=>{ });
						}
					});
				});
			});
		}).catch(next);
	};//End cancelOrder()

	/**
	 * Function to get submenu categories
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getSubMenuCategory(req, res,next,client){
		return new Promise(resolve=>{
			let menuId	= (req.params.menu_id) ? req.params.menu_id :PIZZA_HUT_MENU_ID;

			/** Call service */
			client["GetSubMenuCategory"]({LicenceKey: SOAP_LICENCE_KEY, MenuCategoryId: menuId, },(err, response)=>{
				if (err) throw err;

				let apiData	= (response && response.GetSubMenuCategoryResult) ? response.GetSubMenuCategoryResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetSubMenuCategory",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY, MenuCategoryId: menuId},
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				let recordIds		= [];
				let missingData		= [];
				jsonData.SubMenuCategories.Submenu.map(record =>{
					recordIds.push(record._attributes.ID);
					if(!record._attributes.ID) missingData.push("ID");
					if(!record._attributes.NAME) missingData.push("NAME -"+record._attributes.ID);
					//~ if(!record._attributes.NAMEARB) missingData.push("NAMEARB -"+record._attributes.ID);
				});
				if(missingData.length > 0) resolve({status : STATUS_SUCCESS,message : "Missing "+missingData.join(", ") });

				const restaurant_categories	= db.collection("restaurant_categories");
				const restaurants			= db.collection("restaurants");
				const users					= db.collection("users");
				let restaurantSlug 			= req.params.menu_id == PIZZA_HUT_MENU_ID ? PIZZA_HUT : BURGER_KING;
				asyncParallel({
					restaurant_id : (parellelCallback)=>{
						restaurants.findOne({slug : restaurantSlug},{projection:{_id:1}},(err,result)=>{
							let restaurantId = (result) ? ObjectId(result._id) : "";
							parellelCallback(err,restaurantId);
						});
					},
					admin_id : (parellelCallback)=>{
						users.findOne({user_role_id : CRAVEZ},{projection:{_id:1}},(err,result)=>{
							let adminId = (result) ? ObjectId(result._id) : "";
							parellelCallback(err,adminId);
						});
					},
					update_delete_flag : (parellelCallback)=>{
						restaurant_categories.updateMany({
							restaurant_slug : restaurantSlug,
							cravez_menu_id 	: {$in: [String(menuId), parseInt(menuId)]},
						},{$set: {to_be_deleted: true }},(updateErr)=>{
							parellelCallback(updateErr);
						});
					},
				},(parallelErr,asyncReponse)=>{
					if(parallelErr) return next(parallelErr);

					let restaurantId = asyncReponse.restaurant_id;
					asyncEach(jsonData.SubMenuCategories.Submenu,(data,asyncEachcallback)=>{
						data = data._attributes;

						this.getUniqueId({type:"categories"}).then(uniqueIdResponse=>{
							let tmpCravezCatId 		= 	parseInt(data.ID);
							let uniqueCategoryid	=	(uniqueIdResponse.result) ? uniqueIdResponse.result :"";

							/** Save details **/
							restaurant_categories.updateOne({
								kfg_sub_menu_id : 	tmpCravezCatId,
								cravez_menu_id 	: 	{$in: [String(menuId), parseInt(menuId)]},
							},
							{
								$set : {
									name: {
										en: data.NAME,
										ar: data.NAMEARB ? data.NAMEARB :data.NAME
									},
									tags		:	[data.NAME,data.NAMEARB],
									is_active	: 	ACTIVE,
									order		: 	parseInt(data.SEQ),
									modified	: 	getUtcDate(),
								},
								$setOnInsert: {
									cravez_menu_id 	: 	String(menuId),
									restaurant_slug	:	restaurantSlug,
									restaurant_id	: 	restaurantId,
									added_by		: 	asyncReponse.admin_id,
									concept_id		: 	req.params.concept_id,
									channel_id		: 	CHANNEL_SOAP,
									category_id		: 	uniqueCategoryid,
									kfg				: 	true,
								},
								$unset: {
									to_be_deleted	: 1,
								}
							},{upsert: true},(updateErr) => {
								asyncEachcallback(updateErr);
							});
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return next(parallelErr);

						/** Delete categories */
						restaurant_categories.deleteMany({
							restaurant_slug : restaurantSlug,
							cravez_menu_id 	: {$in: [String(menuId), parseInt(menuId)]},
							to_be_deleted 	: true,
						},(deleteErr)=>{
							if(deleteErr) return next(deleteErr);

							resolve({status : STATUS_SUCCESS, menu: jsonData.SubMenuCategories.Submenu});
						});
					});
				});
			});
		});
	};//End getSubMenuCategory()

	/**
	 * Function to get modifier group
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getModifiersGroup(req, res,next,client){
		return new Promise(resolve=>{
			let menuId	= (req.params.menu_id) ? req.params.menu_id :PIZZA_HUT_MENU_ID;

			/** Call service */
			client["GetModifiersGroups"]({LicenceKey: SOAP_LICENCE_KEY, MenuId: menuId},(err, response)=>{
				if (err) throw err;

				let apiData	= (response && response.GetModifiersGroupsResult) ? response.GetModifiersGroupsResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetModifiersGroups",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY, MenuId: menuId},
				}).then(()=>{});


				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				if(jsonData.ModifiersGroup.MODIFIERGROUP.constructor != Array ){
					let tempObj = jsonData.ModifiersGroup.MODIFIERGROUP;
					jsonData.ModifiersGroup.MODIFIERGROUP = [];
					jsonData.ModifiersGroup.MODIFIERGROUP.push(tempObj);
				}

				if(jsonData.ModifiersGroup.MODIFIERGROUP.length <=0) return resolve({status: STATUS_ERROR,message : "No found found." });

				let recordIds		= [];
				let missingData		= [];
				jsonData.ModifiersGroup.MODIFIERGROUP.map((record, index) =>{
					recordIds.push(record._attributes.GROUPID);
					if(!record._attributes.GROUPID) missingData.push("GROUPID -"+index);
					// if(!record._attributes.NAME) missingData.push("NAME -"+index);
					// if(!record._attributes.NAMEARB) missingData.push("NAMEARB -"+index);
					if(record._attributes.Min == "") missingData.push("Min -"+index);
					if(record._attributes.Max == "") missingData.push("Max -"+index);
				});

				if(missingData.length > 0) return resolve({status : STATUS_SUCCESS,message : "Missing "+missingData.join(", "), jsonData : jsonData });

				const cravez_modifier_groups	= db.collection("cravez_modifier_groups");
				const restaurants				= db.collection("restaurants");
				const users						= db.collection("users");
				let restaurantSlug 				= req.params.menu_id == PIZZA_HUT_MENU_ID ? PIZZA_HUT : BURGER_KING;
				asyncParallel({
					restaurant_id : (parellelCallback)=>{
						restaurants.findOne({slug : restaurantSlug},{projection:{_id:1}},(err,result)=>{
							let restaurantId = (result) ? ObjectId(result._id) : "";
							parellelCallback(err,restaurantId);
						});
					},
					admin_id : (parellelCallback)=>{
						users.findOne({user_role_id : CRAVEZ},{projection:{_id:1}},(err,result)=>{
							let adminId = (result) ? ObjectId(result._id) : "";
							parellelCallback(err,adminId);
						});
					},
					update_delete_flag : (parellelCallback)=>{
						cravez_modifier_groups.updateMany({
							restaurant_slug 		:	restaurantSlug,
							kfg_modifier_group_id 	:	{$exists: true}
						},{$set: {to_be_deleted: true }},(updateErr)=>{
							parellelCallback(updateErr);
						});
					},
				},(parallelErr,asyncReponse)=>{
					if(parallelErr) return next(parallelErr);

					asyncEach(jsonData.ModifiersGroup.MODIFIERGROUP,(data,asyncEachcallback)=>{
						data = data._attributes;

						if(!data.NAME || !data.NAMEARB) return asyncEachcallback(null);

						/** Save details **/
						cravez_modifier_groups.updateOne({
							kfg_modifier_group_id 	:	parseInt(data.GROUPID),
							restaurant_slug			: 	restaurantSlug,
						},
						{
							$set : {
								name	: {
									en: data.NAME,
									ar: data.NAMEARB
								},
								min			: (data.Min) ? parseInt(data.Min) : 0,
								max			: (data.Max) ? parseInt(data.Max) : 0,
								min_quantity: (data.Min) ? parseInt(data.Min) : 0,
								max_quantity: (data.Max) ? parseInt(data.Max) : 0,
								modified	: getUtcDate(),
							},
							$setOnInsert: {
								restaurant_slug	: restaurantSlug,
								restaurant_id	: asyncReponse.restaurant_id,
								added_by		: asyncReponse.admin_id,
								channel_id		: CHANNEL_SOAP,
								created			: getUtcDate(),
								kfg				: true
							},
							$unset: {
								to_be_deleted	: 1
							}
						},{upsert: true},(updateErr) => {
							asyncEachcallback(updateErr);
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return next(parallelErr);

						/** Delete cravez modifier groups  */
						cravez_modifier_groups.deleteMany({
							restaurant_slug 		:	restaurantSlug,
							kfg_modifier_group_id 	:	{$exists: true},
							to_be_deleted 			: 	true,
						},(deleteErr)=>{
							if(deleteErr) return next(deleteErr);

							resolve({status: STATUS_SUCCESS});
						});
					});
				});
			});
		});
	};//End getModifiersGroup()

	/**
	 * Function to get dough type list
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getDoughTypeList(req, res,next,client){
		return new Promise(resolve=>{
			let menuId	= (req.params.menu_id) ? req.params.menu_id :PIZZA_HUT_MENU_ID;

			/** Call service */
			client["GetDoughTypeList"]({LicenceKey: SOAP_LICENCE_KEY, MenuId: menuId, },(err, response)=>{
				if (err) throw err;
				let apiData	= (response && response.GetDoughTypeListResult) ? response.GetDoughTypeListResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetDoughTypeList",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY, MenuId: menuId},
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));


				if(jsonData.DoughTypeList.DoughType.constructor != Array ){
					let tempObj = jsonData.DoughTypeList.DoughType;
					jsonData.DoughTypeList.DoughType = [];
					jsonData.DoughTypeList.DoughType.push(tempObj);
				}

				if(jsonData.DoughTypeList.DoughType.length <=0) return resolve({status: STATUS_ERROR,message : "No found found." });

				const users					= db.collection("users");
				const restaurants			= db.collection("restaurants");
				const item_units_masters	= db.collection("item_units_masters");

				let restaurantSlug 	= (menuId == PIZZA_HUT_MENU_ID) ? PIZZA_HUT :BURGER_KING;
				asyncParallel({
					restaurant_id : (parellelCallback)=>{
						restaurants.findOne({slug : restaurantSlug},{projection:{_id:1}},(err,result)=>{
							let restaurantId = (result) ? ObjectId(result._id) : "";
							parellelCallback(err,restaurantId);
						});
					},
					admin_id : (parellelCallback)=>{
						users.findOne({user_role_id : CRAVEZ},{projection:{_id:1}},(err,result)=>{
							let adminId = (result) ? ObjectId(result._id) : "";
							parellelCallback(err,adminId);
						});
					},
					update_delete_flag : (parellelCallback)=>{
						item_units_masters.updateMany({
							restaurant_slug :	restaurantSlug,
							dough_type 		:	{$exists: true}
						},{$set: {to_be_deleted: true }},(updateErr)=>{
							parellelCallback(updateErr);
						});
					},
				},(parallelErr,asyncReponse)=>{
					if(parallelErr) return next(parallelErr);

					asyncEach(jsonData.DoughTypeList.DoughType,(data,asyncEachcallback)=>{
						this.getUniqueId({type:"item_unit"}).then(uniqueIdResponse=>{
							let uniqueItemUnitid = (uniqueIdResponse.result) ? uniqueIdResponse.result :"";

							/** Set update data */
							let updateData = {
								name: {
									en: data.DoughType._text,
									ar: data.DoughTypeARB._text
								},
								modified: getUtcDate(),
							};

							if((data.DoughDesc && data.DoughDesc._text) || (data.DoughDescARB && data.DoughDescARB._text)){
								updateData.description = {
									en: data.DoughDesc._text,
									ar: data.DoughDescARB._text
								};
							}

							/** Save details **/
							item_units_masters.updateOne({
								dough_type 		:   parseInt(data.DoughId._text),
								cravez_menu_id 	: 	{$in: [String(menuId), parseInt(menuId)]},
							},
							{
								$set 		: updateData,
								$setOnInsert: {
									cravez_menu_id 	: 	String(menuId),
									restaurant_slug	:	restaurantSlug,
									restaurant_id	: 	asyncReponse.restaurant_id,
									added_by		: 	asyncReponse.admin_id,
									channel_id		: 	CHANNEL_SOAP,
									created			: 	getUtcDate(),
									item_unit_id	: 	uniqueItemUnitid,
									kfg				: 	true
								},
								$unset: {
									to_be_deleted	: 1
								}
							},{upsert: true},(updateErr) => {
								asyncEachcallback(updateErr);
							});
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return next(parallelErr);

						/** Delete dough type  */
						item_units_masters.deleteMany({
							restaurant_slug :	restaurantSlug,
							dough_type 		:	{$exists: true},
							to_be_deleted 	: 	true,
						},(deleteErr)=>{
							if(deleteErr) return next(deleteErr);

							resolve({status: STATUS_SUCCESS});
						});
					});
				});
			});
		});
	};//End getDoughTypeList()

	/**
	 * Function to get size list
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getSizeList(req, res,next,client){
		return new Promise(resolve=>{
			let menuId	= (req.params.menu_id) ? req.params.menu_id :PIZZA_HUT_MENU_ID;

			/** Call service */
			client["GetSizeList"]({LicenceKey: SOAP_LICENCE_KEY, MenuId: menuId, },(err, response)=>{
				if (err) throw err;
				let apiData	= (response && response.GetSizeListResult) ? response.GetSizeListResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetSizeList",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY, MenuId: menuId},
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));


				const item_units_masters	= db.collection("item_units_masters");
				const restaurants			= db.collection("restaurants");
				const users					= db.collection("users");
				let restaurantSlug 			= req.params.menu_id == PIZZA_HUT_MENU_ID ? PIZZA_HUT : BURGER_KING;
				asyncParallel({
					restaurant_id : (parellelCallback)=>{
						restaurants.findOne({slug : restaurantSlug},{projection:{_id:1}},(err,result)=>{
							let restaurantId = (result) ? ObjectId(result._id) : "";
							parellelCallback(err,restaurantId);
						});
					},
					admin_id : (parellelCallback)=>{
						users.findOne({user_role_id : CRAVEZ},{projection:{_id:1}},(err,result)=>{
							let adminId = (result) ? ObjectId(result._id) : "";
							parellelCallback(err,adminId);
						});
					},
					update_delete_flag : (parellelCallback)=>{
						item_units_masters.updateMany({
							restaurant_slug :	restaurantSlug,
							size_id 		:	{$exists: true}
						},{$set: {to_be_deleted: true }},(updateErr)=>{
							parellelCallback(updateErr);
						});
					},
				},(parallelErr,asyncReponse)=>{
					if(parallelErr) return next(parallelErr);

					if(jsonData.SizeList.ItemSize.constructor != Array ){
						let tempObj = jsonData.SizeList.ItemSize;
						jsonData.SizeList.ItemSize = [];
						jsonData.SizeList.ItemSize.push(tempObj);
					}

					asyncEach(jsonData.SizeList.ItemSize,(data,asyncEachcallback)=>{
						this.getUniqueId({type:"item_unit"}).then(uniqueIdResponse=>{
							let uniqueItemUnitid = (uniqueIdResponse.result) ? uniqueIdResponse.result :"";

							/** Save details **/
							item_units_masters.updateOne({
								size_id 		: 	parseInt(data.SizeId._text),
								cravez_menu_id 	: 	{$in: [String(menuId), parseInt(menuId)]},
							},
							{
								$set : {
									name: {
										en: data.SizeName._text,
										ar: data.SizeNameARB._text
									},
									modified: getUtcDate(),
								},
								$setOnInsert: {
									cravez_menu_id 	: 	String(menuId),
									restaurant_slug	:	restaurantSlug,
									restaurant_id	: 	asyncReponse.restaurant_id,
									added_by		: 	asyncReponse.admin_id,
									channel_id		: 	CHANNEL_SOAP,
									created			: 	getUtcDate(),
									item_unit_id	: 	uniqueItemUnitid,
									kfg				: 	true
								},
								$unset: {
									to_be_deleted	: 1
								}
							},{upsert: true},(updateErr) => {
								asyncEachcallback(updateErr);
							});
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return next(parallelErr);

						/** Delete size  */
						item_units_masters.deleteMany({
							restaurant_slug :	restaurantSlug,
							size_id 		:	{$exists: true},
							to_be_deleted 	: 	true,
						},(deleteErr)=>{
							if(deleteErr) return next(deleteErr);

							resolve({status: STATUS_SUCCESS});
						});
					});
				});
			});
		});
	};//End getSizeList()

	/**
	 * Function to get selectors
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getSelectors (req, res,next,client){
		return new Promise(resolve=>{
			let menuId	= (req.params.menu_id) ? req.params.menu_id :PIZZA_HUT_MENU_ID;

			/** Call service */
			client["GetSelectors"]({LicenceKey: SOAP_LICENCE_KEY, MenuId: menuId, },(err, response)=>{
				if (err) throw err;
				let apiData	= (response && response.GetSelectorsResult) ? response.GetSelectorsResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetSelectors",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY, MenuId: menuId},
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				if(jsonData.Selectors.Selector.constructor != Array ){
					let tempObj = jsonData.Selectors.Selector;
					jsonData.Selectors.Selector = [];
					jsonData.Selectors.Selector.push(tempObj);
				}

				// return resolve({status: jsonData });

				if(jsonData.Selectors.Selector.length <=0) return resolve({status: STATUS_ERROR,message : "No found found." });

				const users					= db.collection("users");
				const restaurants			= db.collection("restaurants");
				const item_units_masters	= db.collection("item_units_masters");

				let restaurantSlug 			= menuId == PIZZA_HUT_MENU_ID ? PIZZA_HUT : BURGER_KING;
				asyncParallel({
					restaurant_id : (parellelCallback)=>{
						restaurants.findOne({slug : restaurantSlug},{projection:{_id:1}},(err,result)=>{
							let restaurantId = (result) ? ObjectId(result._id) : "";
							parellelCallback(err,restaurantId);
						});
					},
					admin_id : (parellelCallback)=>{
						users.findOne({user_role_id : CRAVEZ},{projection:{_id:1}},(err,result)=>{
							let adminId = (result) ? ObjectId(result._id) : "";
							parellelCallback(err,adminId);
						});
					},
					update_delete_flag : (parellelCallback)=>{
						item_units_masters.updateMany({
							restaurant_slug :	restaurantSlug,
							kfg_selector	:	{$exists: true}
						},{$set: {to_be_deleted: true }},(updateErr)=>{
							parellelCallback(updateErr);
						});
					},
				},(parallelErr,asyncReponse)=>{
					if(parallelErr) return next(parallelErr);

					asyncEach(jsonData.Selectors.Selector,(data,asyncEachcallback)=>{
						data = data._attributes;

						this.getUniqueId({type:"item_unit"}).then(uniqueIdResponse=>{
							let uniqueItemUnitid = (uniqueIdResponse.result) ? uniqueIdResponse.result :"";

							/** Save details **/
							item_units_masters.updateOne({
								kfg_selector 	: 	parseInt(data.ID),
								cravez_menu_id 	: 	{$in: [String(menuId), parseInt(menuId)]},
							},
							{
								$set : {
									name: {
										en: data.NAME,
										ar: data.NAMEARB
									},
									vgroup_id: parseInt(data.VGROUPID),
									modified : getUtcDate(),
								},
								$setOnInsert: {
									cravez_menu_id 	: 	String(menuId),
									restaurant_slug	: 	restaurantSlug,
									restaurant_id	: 	asyncReponse.restaurant_id,
									added_by		: 	asyncReponse.admin_id,
									channel_id		: 	CHANNEL_SOAP,
									created			: 	getUtcDate(),
									item_unit_id	: 	uniqueItemUnitid,
									kfg				: 	true
								},
								$unset: {
									to_be_deleted	: 1,
								}
							},{upsert: true},(updateErr) => {
								asyncEachcallback(updateErr);
							});
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return next(parallelErr);

						/** Delete selector  */
						item_units_masters.deleteMany({
							restaurant_slug :	restaurantSlug,
							kfg_selector	:	{$exists: true},
							to_be_deleted 	: 	true,
						},(deleteErr)=>{
							if(deleteErr) return next(deleteErr);

							resolve({status: STATUS_SUCCESS});
						});
					});
				});
			});
		});
	};//End getSelectors()

	/**
	 * Function to get customers data
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getCustomerData (req, res,next,client){
		return new Promise(resolve=>{
			let fieldType		= (req.params.type) ? req.params.type : "";
			let fieldValue		= (req.params.value) ? req.params.value : "";
			let apiFunction		= "GetCustomerById";
			let apiResponseKey	= "GetCustomerByIdResult";
			let queryField		= "cravez_user_id";
			let queryValue		= parseInt(fieldValue);
			let apiOptions		= {LicenceKey: SOAP_LICENCE_KEY};
			switch(fieldType){
				case "customer_id":
					queryField				= "cravez_user_id";
					queryValue				= parseInt(fieldValue);
					apiOptions.CustomerId	= fieldValue;
					apiFunction				= "GetCustomerByPhone";
					apiResponseKey			= "GetCustomerByIdResult";
				break;
				case "email":
					queryField				= "email";
					queryValue				= fieldValue;
					apiOptions.Email		= fieldValue;
					apiFunction				= "GetCustomerByEmail";
					apiResponseKey			= "GetCustomerByEmailResult";
				break;
				case "phone":
					queryField				= "mobile_number";
					queryValue				= fieldValue;
					apiOptions.PhoneNumber	= fieldValue;
					apiFunction				= "GetCustomerByPhone";
					apiResponseKey			= "GetCustomerByPhoneResult";
				break;
				case "user_name":
					queryField				= "first_name";
					queryValue				= fieldValue;
					apiOptions.UserName		= fieldValue;
					apiFunction				= "GetCustomerByUserName";
					apiResponseKey			= "GetCustomerByUserNameResult";
				break;
			}
			/** Call service */
			client[apiFunction](apiOptions,(err, response)=>{
				if (err) throw err;
				let apiData	= (response && response[apiResponseKey]) ? response[apiResponseKey] :"";

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				let customerInfo = jsonData.Customer.CustomerInfo;
				let addressInfo = jsonData.Customer.Addresses;
				let firstName	= customerInfo.Customer_FirstName._text +" "+ customerInfo.Customer_MiddleName._text;
				let lastName	= customerInfo.Customer_LastName._text;
				let fullName	= firstName+" "+lastName;

				const users					= db.collection("users");
				const customer_addresses	= db.collection("customer_addresses");
				const cities				= db.collection("cities");
				const areas					= db.collection("areas");
				asyncParallel({
					customer_id : (parallelCallback)=>{
						let queryObject = {};
						queryObject[queryField] = queryValue;
						users.findOne(queryObject,{projection:{_id:1}},(err,result)=>{
							let userId = (result) ? ObjectId(result._id) : ObjectId();
							parallelCallback(err,userId);
						});
					},
					admin_id : (parallelCallback)=>{
						users.findOne({user_role_id : CRAVEZ},{projection:{_id:1}},(err,result)=>{
							let adminId = (result) ? ObjectId(result._id) : "";
							parallelCallback(err,adminId);
						});
					},
					referral_code 	: (parallelCallback)=>{
						/** Generate referral code **/
						generateReferralCode(req,res,{ prefix : fullName}).then(referralResponse=>{
							let callbackErr 	 =	(referralResponse.status != STATUS_SUCCESS) ? true :null;
							let userReferralCode =	(referralResponse.referral_code)? referralResponse.referral_code :"";
							parallelCallback(callbackErr,userReferralCode);
						}).catch(next);
					},
					slug 	: (parallelCallback)=>{
						/** Set options for slug **/
						let options = {
							title 		: fullName,
							table_name 	: "users",
							slug_field 	: "slug"
						};

						/** Get slug **/
						getDatabaseSlug(options).then(slugResponse=>{
							let slug = (slugResponse && slugResponse.title) ? slugResponse.title :"";
							parallelCallback(null,slug);
						}).catch(next);
					},
					new_password 	: (parallelCallback)=>{
						/**Genrate password hash */
						let newPassword = generateMD5Hash(IMPORT_CUSTOMER_PASSWORD);
						parallelCallback(null,newPassword);
					},
				},(parallelErr,asyncReponse)=>{
					if(parallelErr) return next(parallelErr);

					asyncParallel({
						save_customer : (childCallback)=>{
							/** Save details **/
							users.updateOne({
								_id 			: asyncReponse.customer_id,
								cravez_user_id 	: parseInt(customerInfo.Customer_Id._text)
							},
							{
								$set : {
									first_name				: firstName,
									last_name				: lastName,
									full_name				: fullName,
									date_of_birth			: getUtcDate(customerInfo.Customer_DateOfBirth._text),
									email					: customerInfo.Customer_Email._text,
									gender					: customerInfo.Customer_Gender._text,
									mobile_number			: customerInfo.Customer_Telephone._text,
									phone_country_code		: DEFAULT_COUNTRY_CODE,
									cravez_customer_title			: customerInfo.Customer_Title._text,
									cravez_customer_marital_status	: customerInfo.Customer_MaritalStatus._text,
									cravez_customer_nationality		: customerInfo.Customer_Nationality._text,
									cravez_customer_company			: customerInfo.Customer_Company._text,
									cravez_customer_occupation		: customerInfo.Customer_Occupation._text,
									cravez_phone_type				: customerInfo.Customer_PhoneType._text,
									cravez_country_code				: customerInfo.Customer_CountryCode._text,
									cravez_area_code				: customerInfo.Customer_AreaCode._text,
									cravez_extension_code			: customerInfo.Customer_Extenstion._text,
									cravez_customer_dependents		: customerInfo.Customer_Dependents._text,
									cravez_customer_status			: customerInfo.Customer_Status._text,
									cravez_customer_class_id		: customerInfo.Customer_ClassId._text,
									modified						: getUtcDate(),
								},
								$setOnInsert: {
									referral_details	: {
										referral_code 	: asyncReponse.referral_code,
									},
									user_role_id		: CUSTOMER,
									user_type			: USER_TYPE_OTHER,
									slug				: asyncReponse.slug,
									password			: asyncReponse.new_password,
									active				: ACTIVE,
									is_deleted			: NOT_DELETED,
									is_email_verified	: VERIFIED,
									is_mobile_verified	: VERIFIED,
									is_verified			: VERIFIED,
									created_by			: asyncReponse.admin_id,
									channel_id			: CHANNEL_SOAP,
									kfg					: true
								}
							},{upsert: true},(updateErr) => {
								childCallback(updateErr);
							});
						},
						save_customer_address : (childCallback)=>{
							if(addressInfo.Address.constructor != Array ){
								let tempObj = addressInfo.Address;
								addressInfo.Address = [];
								addressInfo.Address.push(tempObj);
							}

							asyncEach(addressInfo.Address,(data,asyncEachcallback)=>{
								asyncParallel({
									city_id : (parentCallback)=>{
										cities.findOne({cravez_city_id : parseInt(data.Address_CityId._text)},{projection : {_id : 1}},(errs,result)=>{
											let cityId	= (result) ? ObjectId(result._id) : "";
											parentCallback(errs,cityId);
										});
									},
									area_id : (parentCallback)=>{
										areas.findOne({cravez_area_id : parseInt(data.Address_AreaId._text)},{projection : {_id : 1}},(errs,result)=>{
											let areaId	= (result) ? ObjectId(result._id) : "";
											parentCallback(errs,areaId);
										});
									}
								},(parallelError,parallelData)=>{
									customer_addresses.updateOne({
										user_id				: asyncReponse.customer_id,
										cravez_address_id	: parseInt(data.Address_Id._text)
									},
									{
										$set : {
											cravez_user_id			: parseInt(customerInfo.Customer_Id._text),
											first_name				: firstName,
											last_name				: lastName,
											full_name				: fullName,
											area_id					: parallelData.area_id,
											city_id					: parallelData.city_id,
											cravez_country_id		: data.Address_CountryId._text,
											cravez_province_id		: data.Address_ProvinceId._text,
											cravez_district_id		: data.Address_DistrictId._text,
											cravez_area_id			: data.Address_AreaId._text,
											cravez_street_id		: data.Address_StreetId._text,
											cravez_city_id			: data.Address_CityId._text,
											cravez_class_id			: data.Address_ClassId._text,
											cravez_phone_area_code	: data.Address_PhoneAreaCode._text,
											cravez_phone_country	: data.Address_PhoneCountry._text,
											cravez_phone_type		: data.Address_PhoneType._text,
											cravez_building_name	: data.Address_BuildingName._text,
											cravez_building_number	: data.Address_BuildingNumber._text,
											cravez_address_floor	: data.Address_Floor._text,
											cravez_address_flat		: data.Address_Flat._text,
											cravez_address_county	: data.Address_County._text,
											cravez_address_sketch	: data.Address_Sketch._text,
											address_description		: data.Address_Desc._text,
											address_remarks			: data.Address_Remarks._text,
											address_map_code		: data.Address_MapCode._text,
											modified				: getUtcDate(),
										},
										$setOnInsert: {
											created				: getUtcDate(),
											channel_id			: CHANNEL_SOAP,
											kfg					: true
										}
									},{upsert: true},(updateErr) => {
										asyncEachcallback(updateErr);
									});
								});
							},(asyncEachErr)=>{
								childCallback(asyncEachErr);
							});
						}
					},(asyncError)=>{
						if(asyncError) return next(asyncError);
						resolve({status : STATUS_SUCCESS});
					});
				});
			});
		}).catch(next);
	};//End getCustomerData()

	/**
	 * Function to get combo upsells
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getComboUpsells (req, res,next,client){
		return new Promise(resolve=>{
			let conceptId	= (req.params.concept_id) ? req.params.concept_id :1;

			/** Call service */
			client["GetComboHeaderList"]({LicenceKey: SOAP_LICENCE_KEY, ConceptId: conceptId, },(err, response)=>{
				if (err) throw err;
				let apiData	= (response && response.GetComboHeaderListResult) ? response.GetComboHeaderListResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetComboHeaderList",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY, ConceptId: conceptId},
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				const cravez_item_combo_upsells = db.collection("cravez_item_combo_upsells ");
				const items						= db.collection("items");
				const restaurants				= db.collection("restaurants");
				const users						= db.collection("users");

				asyncParallel({
					restaurant : (parellelCallback)=>{
						restaurants.findOne({concept_id : parseInt(req.params.concept_id)},{projection:{_id:1,slug:1}},(err,result)=>{
							parellelCallback(err,result);
						});
					},
					admin_id : (parellelCallback)=>{
						users.findOne({user_role_id : CRAVEZ},{projection:{_id:1}},(err,result)=>{
							let adminId = (result) ? ObjectId(result._id) : "";
							parellelCallback(err,adminId);
						});
					},
				},(parallelErr,asyncReponse)=>{
					if(parallelErr) return next(parallelErr);
					if(!asyncReponse.restaurant) return resolve({status : STATUS_ERROR,message : "Concept id is not valid."});

					if(jsonData.Combos.Combo.constructor != Array ){
						let tempObj = jsonData.Combos.Combo;
						jsonData.Combos.Combo = [];
						jsonData.Combos.Combo.push(tempObj);
					}
					asyncEach(jsonData.Combos.Combo,(data,asyncEachcallback)=>{
						asyncParallel({
							item_id : (childCallback)=>{
								items.findOne({cravez_item_id : parseInt(data.Combo_Id._text)},{projection:{_id:1}},(err,itemResult)=>{
									let recordId = (itemResult) ? ObjectId(itemResult._id) : "";
									childCallback(err,recordId);
								});
							}
						},(asyncChildErr,childResponse)=>{

							let dataToBeUpdated = {
								item_id 				: childResponse.item_id,
								name					: data.Combo_Name._text,
								price					: round(data.Combo_Price._text,CURRENCY_ROUND_PRECISION),
								number_of_componants	: parseInt(data.Combo_NumberOfComponents._text),
								size_surcharge			: round(data.SIZESURCHG._text,CURRENCY_ROUND_PRECISION),
								enable_upsell			: (data.EnableUpsell._text).split(","),
								mix_upsell				: data.MIXUPSELL._text,
								modified				: getUtcDate(),
							};


							if(data.UpSells.UpSell.constructor != Array ){
								let tempObj = data.UpSells.UpSell;
								data.UpSells.UpSell = [];
								data.UpSells.UpSell.push(tempObj);
							}
							/** create upsell array*/
							let upSellArray = [];
							data.UpSells.UpSell.map(upsell=>{
								upSellArray.push({
									combo_upsell_id : parseInt(upsell.ComboUpsell_Id._text),
									upsell_name 	: upsell.ComboUpsell_Name._text,
									upsell_price 	: round(upsell.ComboUpsell_Price._text,CURRENCY_ROUND_PRECISION)
								});
							});
							dataToBeUpdated.combo_upsells = upSellArray;

							/** Save details **/
							cravez_item_combo_upsells.updateOne({
								cravez_combo_id : parseInt(data.Combo_Id._text)
							},
							{
								$set : dataToBeUpdated,
								$setOnInsert: {
									restaurant_slug	: asyncReponse.restaurant.slug,
									restaurant_id	: asyncReponse.restaurant._id,
									added_by		: asyncReponse.admin_id,
									channel_id		: CHANNEL_SOAP,
									created			: getUtcDate(),
									kfg				: true
								}
							},{upsert: true},(updateErr) => {
								asyncEachcallback(updateErr);
							});
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return next(asyncEachErr);
						resolve({status : STATUS_SUCCESS});
					});
				});
			});
		}).catch(next);
	};//End getComboUpsells()

	/**
	 * Function to Get Customer Titles
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getCustomerTitles(req, res,next,client){
		return new Promise(resolve=>{
			/** Call service */
			client["GetCustomerTitles"]({LicenceKey: SOAP_LICENCE_KEY },(err, response)=>{
				if (err) throw err;
				let apiData	= (response && response.GetCustomerTitlesResult) ? response.GetCustomerTitlesResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetCustomerClass",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY},
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				if(jsonData.CustomerTitles.CustomerTitle.constructor != Array ){
					let tempObj = jsonData.CustomerTitles.CustomerTitle;
					jsonData.CustomerTitles.CustomerTitle = [];
					jsonData.CustomerTitles.CustomerTitle.push(tempObj);
				}
				const cravez_customer_titles = db.collection("cravez_customer_titles");
				asyncEach(jsonData.CustomerTitles.CustomerTitle,(data,asyncEachcallback)=>{
					/** Save details **/
					cravez_customer_titles.updateOne({
						cravez_title_id : parseInt(data.Title_Id._text)
					},
					{
						$set : {
							name			: data.Title_Name._text,
							gender			: parseInt(data.Title_Gender._text),
							title_name_un	: data.TIT_NAMEUN._text,
							modified		: getUtcDate(),
						},
						$setOnInsert: {
							channel_id	: CHANNEL_SOAP,
							created		: getUtcDate(),
							kfg			: true
						}
					},{upsert: true},(updateErr) => {
						asyncEachcallback(updateErr);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return next(asyncEachErr);
					resolve({status : STATUS_SUCCESS});
				});
			});
		}).catch(next);
	};//End getCustomerTitles()

	/**
	 * Function to Get Customer Clesses
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getCustomerClasses(req, res,next,client){
		return new Promise(resolve=>{
			/** Call service */
			client["GetCustomerClass"]({LicenceKey: SOAP_LICENCE_KEY },(err, response)=>{
				if (err) throw err;
				let apiData	= (response && response.GetCustomerClassResult) ? response.GetCustomerClassResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetCustomerClass",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY},
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				if(jsonData.CustomerTypes.CustomerClass.constructor != Array ){
					let tempObj = jsonData.CustomerTypes.CustomerClass;
					jsonData.CustomerTypes.CustomerClass = [];
					jsonData.CustomerTypes.CustomerClass.push(tempObj);
				}
				const cravez_customer_classes = db.collection("cravez_customer_classes");
				asyncEach(jsonData.CustomerTypes.CustomerClass,(data,asyncEachcallback)=>{
					/** Save details **/
					cravez_customer_classes.updateOne({
						cravez_class_id : parseInt(data.CustomerClass_Id._text)
					},
					{
						$set : {
							name: data.CustomerClass_Name._text,
							modified: getUtcDate(),
						},
						$setOnInsert: {
							channel_id		: CHANNEL_SOAP,
							created			: getUtcDate(),
							kfg				: true
						}
					},{upsert: true},(updateErr) => {
						asyncEachcallback(updateErr);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return next(asyncEachErr);
					resolve({status : STATUS_SUCCESS});
				});
			});
		}).catch(next);
	};//End getCustomerClasses()

	/**
	 * Function to Get Customer Genders
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getCustomerGenders(req, res,next,client){
		return new Promise(resolve=>{
			/** Call service */
			client["GetCustomerGenders"]({LicenceKey: SOAP_LICENCE_KEY },(err, response)=>{
				if (err) throw err;
				let apiData	= (response && response.GetCustomerGendersResult) ? response.GetCustomerGendersResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetCustomerGenders",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY},
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				if(jsonData.CustomerGenders.Gender.constructor != Array ){
					let tempObj = jsonData.CustomerGenders.Gender;
					jsonData.CustomerGenders.Gender = [];
					jsonData.CustomerGenders.Gender.push(tempObj);
				}
				const cravez_customer_genders = db.collection("cravez_customer_genders");
				asyncEach(jsonData.CustomerGenders.Gender,(data,asyncEachcallback)=>{
					/** Save details **/
					cravez_customer_genders.updateOne({
						cravez_gender_id : parseInt(data.Gender_ID._text)
					},
					{
						$set : {
							name: data.Gender_Name._text,
							modified: getUtcDate(),
						},
						$setOnInsert: {
							channel_id		: CHANNEL_SOAP,
							created			: getUtcDate(),
							kfg				: true
						}
					},{upsert: true},(updateErr) => {
						asyncEachcallback(updateErr);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return next(asyncEachErr);
					resolve({status : STATUS_SUCCESS});
				});
			});
		}).catch(next);
	};//End getCustomerGenders()

	/**
	 * Function to Get Customer Nationality
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getCustomerNationality(req, res,next,client){
		return new Promise(resolve=>{
			client["GetNationalities"]({LicenceKey: SOAP_LICENCE_KEY},(err, response)=>{
				if (err) throw err;
				let apiData		= (response && response.GetNationalitiesResult) ? response.GetNationalitiesResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetNationalities",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY},
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				if(jsonData.Nationalities.CustomerNationality.constructor != Array ){
					let tempObj = jsonData.Nationalities.CustomerNationality;
					jsonData.Nationalities.CustomerNationality = [];
					jsonData.Nationalities.CustomerNationality.push(tempObj);
				}
				const cravez_customer_nationalities = db.collection("cravez_customer_nationalities");
				asyncEach(jsonData.Nationalities.CustomerNationality,(data,asyncEachcallback)=>{
					/** Save details **/
					cravez_customer_nationalities.updateOne({
						cravez_nationality_id : parseInt(data.Nationality_Id._text)
					},
					{
						$set : {
							name	: data.Nationality_Name._text,
							name_un	: data.NAT_NAMEUN._text,
							modified: getUtcDate(),
						},
						$setOnInsert: {
							channel_id		: CHANNEL_SOAP,
							created			: getUtcDate(),
							kfg				: true
						}
					},{upsert: true},(updateErr) => {
						asyncEachcallback(updateErr);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return next(asyncEachErr);
					resolve({status : STATUS_SUCCESS});
				});
			});
		}).catch(next);
	};//End getCustomerNationality()

	/**
	 * Function to Get Customer phone types
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getCustomerPhoneTypes(req, res,next,client){
		return new Promise(resolve=>{
			client["GetPhoneTypes"]({LicenceKey: SOAP_LICENCE_KEY},(err, response)=>{
				if (err) throw err;
				let apiData		= (response && response.GetPhoneTypesResult) ? response.GetPhoneTypesResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetPhoneTypes",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY},
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				if(jsonData.PhoneTypes.PhoneType.constructor != Array ){
					let tempObj = jsonData.PhoneTypes.PhoneType;
					jsonData.PhoneTypes.PhoneType = [];
					jsonData.PhoneTypes.PhoneType.push(tempObj);
				}
				const cravez_customer_phone_types = db.collection("cravez_customer_phone_types");
				asyncEach(jsonData.PhoneTypes.PhoneType,(data,asyncEachcallback)=>{
					/** Save details **/
					cravez_customer_phone_types.updateOne({
						cravez_phone_type : parseInt(data.PhoneType_Id._text)
					},
					{
						$set : {
							name	: data.PhoneType_Name._text,
							modified: getUtcDate(),
						},
						$setOnInsert: {
							channel_id		: CHANNEL_SOAP,
							created			: getUtcDate(),
							kfg				: true
						}
					},{upsert: true},(updateErr) => {
						asyncEachcallback(updateErr);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return next(asyncEachErr);
					resolve({status : STATUS_SUCCESS});
				});
			});
		}).catch(next);
	};//End getCustomerPhoneTypes()

	/**
	 * Function to Get Countries
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getCountries(req, res,next,client){
		return new Promise(resolve=>{
			client["GetCountries"]({LicenceKey: SOAP_LICENCE_KEY},(err, response)=>{
				if (err) throw err;
				let apiData		= (response && response.GetCountriesResult) ? response.GetCountriesResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetCountries",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY},
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				if(jsonData.Countries.Country.constructor != Array ){
					let tempObj = jsonData.Countries.Country;
					jsonData.Countries.Country = [];
					jsonData.Countries.Country.push(tempObj);
				}

				const cravez_countries = db.collection("cravez_countries");
				asyncEach(jsonData.Countries.Country,(data,asyncEachcallback)=>{
					let countryId  = parseInt(data.CountryId._text);

					if(countryId <= 0) return asyncEachcallback(null);

					/** Save details **/
					cravez_countries.updateOne({
						cravez_country_id : countryId
					},
					{
						$set : {
							name	: data.CountryName._text,
							modified: getUtcDate(),
						},
						$setOnInsert: {
							channel_id		: CHANNEL_SOAP,
							created			: getUtcDate(),
							kfg				: true
						}
					},{upsert: true},(updateErr) => {
						asyncEachcallback(updateErr);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return resolve({status: STATUS_ERROR,message : asyncEachErr });

					resolve({status : STATUS_SUCCESS});
				});
			});
		}).catch(next);
	};//End getCountries()

	/**
	 * Function to Get Districts
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getDistricts(req, res,next,client){
		return new Promise(resolve=>{
			let cityId = req.params.city_id;

			client["GetDistricts"]({LicenceKey: SOAP_LICENCE_KEY, CityId: cityId},(err, response)=>{
				if (err) throw err;
				let apiData		= (response && response.GetDistrictsResult) ? response.GetDistrictsResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetDistricts",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY, CityId: cityId},
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				let dataArray =  jsonData.Districts.District;
				if(dataArray.constructor != Array ){
					let tempObj = dataArray;
					dataArray 	= [];
					dataArray.push(tempObj);
				}

				const cravez_districts = db.collection("cravez_districts");
				asyncEach(dataArray,(data,asyncEachcallback)=>{
					/** Save details **/
					cravez_districts.updateOne({
						cravez_district_id : parseInt(data.District_Id._text)
					},
					{
						$set : {
							cravez_country_id 	: parseInt(data.District_CountryId._text),
							cravez_province_id	: parseInt(data.District_ProvinceId._text),
							cravez_city_id		: parseInt(data.District_CityId._text),
							name				: data.District_Name._text,
							modified			: getUtcDate(),
						},
						$setOnInsert: {
							channel_id		: CHANNEL_SOAP,
							created			: getUtcDate(),
							kfg				: true
						}
					},{upsert: true},(updateErr) => {
						asyncEachcallback(updateErr);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return next(asyncEachErr);
					resolve({status : STATUS_SUCCESS});
				});
			});
		}).catch(next);
	};//End getDistricts()

	/**
	 * Function to Get Streets
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getStreets(req, res,next,client){
		return new Promise(resolve=>{
			let areaId = req.params.area_id;
			client["GetStreets"]({LicenceKey: SOAP_LICENCE_KEY, AreaId: areaId},(err, response)=>{
				if (err) throw err;
				let apiData		= (response && response.GetStreetsResult) ? response.GetStreetsResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetStreets",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY, AreaId: areaId},
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				let dataArray =  jsonData.Streets.Street;
				if(dataArray.constructor != Array ){
					let tempObj = dataArray;
					dataArray 	= [];
					dataArray.push(tempObj);
				}

				const cravez_streets = db.collection("cravez_streets");
				asyncEach(dataArray,(data,asyncEachcallback)=>{
					/** Save details **/
					cravez_streets.updateOne({
						cravez_street_id : parseInt(data.Street_Id._text)
					},
					{
						$set : {
							cravez_country_id 	: parseInt(data.Street_CountryId._text),
							cravez_province_id	: parseInt(data.Street_ProvinceId._text),
							cravez_city_id		: parseInt(data.Street_CityId._text),
							name				: data.Street_name._text,
							modified			: getUtcDate(),
						},
						$setOnInsert: {
							channel_id		: CHANNEL_SOAP,
							created			: getUtcDate(),
							kfg				: true
						}
					},{upsert: true},(updateErr) => {
						asyncEachcallback(updateErr);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return next(asyncEachErr);
					resolve({status : STATUS_SUCCESS});
				});
			});
		}).catch(next);
	};//End getStreets()

	/**
	 * Function to Get Reasons
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getReasons(req, res,next,client){
		return new Promise(resolve=>{
			client["GetReasons"]({LicenceKey: SOAP_LICENCE_KEY},(err, response)=>{
				if (err) throw err;
				let apiData		= (response && response.GetReasonsResult) ? response.GetReasonsResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetReasons",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY},
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				let dataArray =  jsonData.Reasons.Reason;
				if(dataArray.constructor != Array ){
					let tempObj = dataArray;
					dataArray 	= [];
					dataArray.push(tempObj);
				}

				const cravez_reasons = db.collection("cravez_reasons");
				asyncEach(dataArray,(data,asyncEachcallback)=>{
					/** Save details **/
					cravez_reasons.updateOne({
						cravez_reason_id : parseInt(data.REAS_ID._text)
					},
					{
						$set : {
							cravez_reason_type 	: parseInt(data.REAS_TYPEID._text),
							cravez_concept_id	: parseInt(data.REAS_CONCEPTID._text),
							cravez_reason_code	: data.REAS_CODE._text,
							cravez_created_by	: data.CRT_BY._text,
							cravez_created_date	: getUtcDate(data.CRT_DATE._text),
							description			: data.REAS_DESCRIPTION._text,
							modified			: getUtcDate(),
						},
						$setOnInsert: {
							channel_id		: CHANNEL_SOAP,
							created			: getUtcDate(),
							kfg				: true
						}
					},{upsert: true},(updateErr) => {
						asyncEachcallback(updateErr);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return next(asyncEachErr);
					resolve({status : STATUS_SUCCESS});
				});
			});
		}).catch(next);
	};//End getReasons()

	/**
	 * Function to Get feedback Types
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getFeedbackTypes(req, res,next,client){
		return new Promise(resolve=>{
			client["GetFeedbackTypes"]({LicenceKey: SOAP_LICENCE_KEY},(err, response)=>{
				if (err) throw err;
				let apiData		= (response && response.GetFeedbackTypesResult) ? response.GetFeedbackTypesResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetFeedbackTypes",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY},
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				let dataArray	=  jsonData.FeedbackTypes.FeedbackType;
				if(dataArray.constructor != Array ){
					let tempObj = dataArray;
					dataArray 	= [];
					dataArray.push(tempObj);
				}

				const cravez_feedback_types = db.collection("cravez_feedback_types");
				asyncEach(dataArray,(data,asyncEachcallback)=>{
					/** Save details **/
					cravez_feedback_types.updateOne({
						cravez_feedback_type_id : parseInt(data.FTYPE_ID._text)
					},
					{
						$set : {
							name		: data.FTYPE_NAME._text,
							modified	: getUtcDate(),
						},
						$setOnInsert: {
							channel_id	: CHANNEL_SOAP,
							created		: getUtcDate(),
							kfg			: true
						}
					},{upsert: true},(updateErr) => {
						asyncEachcallback(updateErr);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return next(asyncEachErr);
					resolve({status : STATUS_SUCCESS});
				});
			});
		}).catch(next);
	};//End getFeedbackTypes()

	/**
	 * Function to Get feedback sub types
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getFeedbackSubTypes(req, res,next,client){
		return new Promise(resolve=>{
			let feedbackId = parseInt(req.params.feedback_id);
			client["GetFeedbackSubTypes"]({LicenceKey: SOAP_LICENCE_KEY,FeedbackId:feedbackId},(err, response)=>{
				if (err) throw err;
				let apiData	= (response && response.GetFeedbackSubTypesResult) ? response.GetFeedbackSubTypesResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetFeedbackSubTypes",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY,FeedbackId:feedbackId},
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				let dataArray =  jsonData.FeedbackSubTypes.FeedbackSubType;
				if(dataArray.constructor != Array ){
					let tempObj = dataArray;
					dataArray 	= [];
					dataArray.push(tempObj);
				}

				const cravez_feedback_sub_types = db.collection("cravez_feedback_sub_types");
				asyncEach(dataArray,(data,asyncEachcallback)=>{
					/** Save details **/
					cravez_feedback_sub_types.updateOne({
						cravez_feedback_sub_type_id : parseInt(data.FSTYPE_ID._text)
					},
					{
						$set : {
							cravez_feedback_type_id : parseInt(data.FSTYPE_TYPEID._text),
							name					: data.FSTYPE_NAME._text,
							modified				: getUtcDate(),
						},
						$setOnInsert: {
							channel_id	: CHANNEL_SOAP,
							created		: getUtcDate(),
							kfg			: true
						}
					},{upsert: true},(updateErr) => {
						asyncEachcallback(updateErr);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return next(asyncEachErr);
					resolve({status : STATUS_SUCCESS});
				});
			});
		}).catch(next);
	};//End getFeedbackSubTypes()

	/**
	 * Function to Get payment types
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getPaymentTypes(req, res,next,client){
		return new Promise(resolve=>{
			client["GetPaymentTypes"]({LicenceKey: SOAP_LICENCE_KEY},(err, response)=>{
				if (err) throw err;
				let apiData	= (response && response.GetPaymentTypesResult) ? response.GetPaymentTypesResult :"";

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				let dataArray =  jsonData.PaymentTypes.OrderPaymentType;
				if(dataArray.constructor != Array ){
					let tempObj = dataArray;
					dataArray 	= [];
					dataArray.push(tempObj);
				}

				const cravez_payment_types = db.collection("cravez_payment_types");
				asyncEach(dataArray,(data,asyncEachcallback)=>{
					/** Save details **/
					cravez_payment_types.updateOne({
						cravez_payment_type : parseInt(data.Payment_Type._text)
					},
					{
						$set : {
							cravez_payment_sub_type : parseInt(data.Payment_SubType._text),
							cravez_store_tender_id	: parseInt(data.Payment_StoreTenderId._text),
							name					: data.Payment_Name._text,
							modified				: getUtcDate(),
						},
						$setOnInsert: {
							channel_id	: CHANNEL_SOAP,
							created		: getUtcDate(),
							kfg			: true
						}
					},{upsert: true},(updateErr) => {
						asyncEachcallback(updateErr);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return next(asyncEachErr);
					resolve({status : STATUS_SUCCESS});
				});
			});
		}).catch(next);
	};//End getPaymentTypes()

	/**
	 * Function to Get discount types
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getDiscountTypes(req, res,next,client){
		return new Promise(resolve=>{
			client["GetDiscountTypes"]({LicenceKey: SOAP_LICENCE_KEY},(err, response)=>{

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetDiscountTypes",
					response	: 	client.lastResponse,
					request		:	client.lastRequest,
					request_error:	err,
				}).then(()=>{});

				if (err) throw err;
				let apiData	= (response && response.GetDiscountTypesResult) ? response.GetDiscountTypesResult :"";

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				let dataArray =  jsonData.DiscountTypes.Discount;
				if(dataArray.constructor != Array ){
					let tempObj = dataArray;
					dataArray 	= [];
					dataArray.push(tempObj);
				}

				const restaurants			=	db.collection("restaurants");
				const cravez_discount_types	=	db.collection("cravez_discount_types");
				asyncEach(dataArray,(data,asyncEachcallback)=>{
					let menuId		=	parseFloat(data.MenuCategoryId._text);
					let restSlug	=	(menuId == PIZZA_HUT_MENU_ID) ? PIZZA_HUT :BURGER_KING;

					if(menuId != PIZZA_HUT_MENU_ID && menuId != BURGER_KING_MENU_ID) return asyncEachcallback(null);

					asyncParallel({
						rest_details : (callback)=>{
							/** Get restaurant details */
							restaurants.findOne({slug: restSlug },{projection:{_id:1}},(err, result)=>{
								callback(err, result);
							});
						},
					},(asyncErr, asyncResponse)=>{
						if(asyncErr) return asyncEachcallback(asyncErr);

						let restDetails = (asyncResponse.rest_details) ? asyncResponse.rest_details :{};
						let restId 		= (restDetails._id) ? restDetails._id :"";

						/** Save details **/
						cravez_discount_types.updateOne({
							cravez_menu_id 		: 	menuId,
							cravez_discount_id 	:	parseInt(data.DiscountId._text)
						},
						{
							$set : {
								cravez_concept_id 		:	parseFloat(data.ConceptId._text),
								max_amount				: 	parseFloat(data.MaxDiscountAmount._text),
								rate					: 	parseFloat(data.DiscountRate._text),
								Status					: 	parseFloat(data.Status._text),
								name					: 	{
									en	: (data.DiscountName._text) 	?	data.DiscountName._text		:data.DiscountNameAR._text,
									ar	: (data.DiscountNameAR._text) 	? 	data.DiscountNameAR._text	:data.DiscountName._text,
								},
								modified				: 	getUtcDate(),
								valid_from				: 	(data.ValidFrom._text) 	?	getUtcDate(data.ValidFrom._text) :"",
								valid_to				: 	(data.ValidTo._text)	? 	getUtcDate(data.ValidTo._text) :"",
							},
							$setOnInsert: {
								channel_id		: 	CHANNEL_SOAP,
								restaurant_id	:	restId,
								restaurant_slug	:	restSlug,
								created			: 	getUtcDate(),
								kfg				: 	true
							}
						},{upsert: true},(updateErr) => {
							asyncEachcallback(updateErr);
						});
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return next(asyncEachErr);
					resolve({status : STATUS_SUCCESS, dataArray: dataArray});
				});
			});
		}).catch(next);
	};//End getDiscountTypes()

	/**
	 * Function to Get order types
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getOrderTypes(req, res,next,client){
		return new Promise(resolve=>{
			client["GetOrderTypes"]({LicenceKey: SOAP_LICENCE_KEY},(err, response)=>{
				if (err) throw err;
				let apiData	= (response && response.GetOrderTypesResult) ? response.GetOrderTypesResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetOrderTypes",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY},
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				let dataArray =  jsonData.OrderTypes.OrderType;
				if(dataArray.constructor != Array ){
					let tempObj = dataArray;
					dataArray 	= [];
					dataArray.push(tempObj);
				}

				const cravez_order_types = db.collection("cravez_order_types");
				asyncEach(dataArray,(data,asyncEachcallback)=>{
					/** Save details **/
					cravez_order_types.updateOne({
						cravez_order_type_id : parseInt(data.TYP_ID._text)
					},
					{
						$set : {
							name		: data.TYP_Name._text,
							modified	: getUtcDate(),
						},
						$setOnInsert: {
							channel_id	: CHANNEL_SOAP,
							created		: getUtcDate(),
							kfg			: true
						}
					},{upsert: true},(updateErr) => {
						asyncEachcallback(updateErr);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return next(asyncEachErr);
					resolve({status : STATUS_SUCCESS});
				});
			});
		}).catch(next);
	};//End getOrderTypes()

	/**
	 * Function to Get address types
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getAddressTypes(req, res,next,client){
		return new Promise(resolve=>{
			client["GetAddressTypes"]({LicenceKey: SOAP_LICENCE_KEY},(err, response)=>{
				if (err) throw err;
				let apiData	= (response && response.GetAddressTypesResult) ? response.GetAddressTypesResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetAddressTypes",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY},
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				let dataArray =  jsonData.AddressTypes.M_Address_Type;
				if(dataArray.constructor != Array ){
					let tempObj = dataArray;
					dataArray 	= [];
					dataArray.push(tempObj);
				}

				const cravez_address_types = db.collection("cravez_address_types");
				asyncEach(dataArray,(data,asyncEachcallback)=>{
					/** Save details **/
					cravez_address_types.updateOne({
						cravez_address_type_id : parseInt(data.ADD_TYPE_ID._text)
					},
					{
						$set : {
							type_name	: data.ADD_TYPE_NAME._text,
							modified	: getUtcDate(),
						},
						$setOnInsert: {
							channel_id	: CHANNEL_SOAP,
							created		: getUtcDate(),
							kfg			: true
						}
					},{upsert: true},(updateErr) => {
						asyncEachcallback(updateErr);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return next(asyncEachErr);
					resolve({status : STATUS_SUCCESS});
				});
			});
		}).catch(next);
	};//End getAddressTypes()

	/**
	 * Function to get item list
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async getItemsList (req, res,next,client){
		return new Promise(resolve=>{
			let menuId		= (req.params.menu_id) ? req.params.menu_id :PIZZA_HUT_MENU_ID;
			let itemCategoryId	= (req.params.category_id) ? req.params.category_id :"";

			if(menuId != PIZZA_HUT_MENU_ID && menuId != BURGER_KING_MENU_ID){
				return resolve({status: STATUS_ERROR, message: res.__("system.invalid_access") });
			}

			let apiOptions = {LicenceKey: SOAP_LICENCE_KEY, MenuCategoryId: menuId};
			if(itemCategoryId) apiOptions.SubMenuId = itemCategoryId;

			/** Call service */
			client["GetItemsList"](apiOptions,(err,response)=>{
				if (err) throw err;

				let apiData	= (response && response.GetItemsListResult) ? response.GetItemsListResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetItemsList",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY, MenuCategoryId: menuId},
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				if(!jsonData || !jsonData.ItemsList || !jsonData.ItemsList.ITEM){
					return resolve({status: STATUS_ERROR,  message:res.__("system.something_going_wrong_please_try_again") });
				}

				if(jsonData.ItemsList.ITEM.constructor != Array ){
					let tempObj = jsonData.Response.ITEM;
					jsonData.ItemsList.ITEM = [];
					jsonData.ItemsList.ITEM.push(tempObj);
				}

				if(jsonData.ItemsList.ITEM.length <=0) return resolve({status: STATUS_ERROR,message : "No found found." });

				// return resolve({jsonData: jsonData });

				let missingData			=	[];
				let cravezFinalItems	=	[];
				jsonData.ItemsList.ITEM.map((record, index) =>{
					if(!record._attributes.ITEMID) 	missingData.push("ITEMID  index -"+index);
					if(record._attributes.NAME){
						cravezFinalItems.push(record);
					}
				});

				/** Send error response */
				if(missingData.length > 0) return resolve({ status: STATUS_ERROR, message: res.__("system.missing_parameters"), missing: missingData.join(", "), data : jsonData.ItemsList.ITEM });

				let restaurantSlug 	=	(menuId == PIZZA_HUT_MENU_ID) ? PIZZA_HUT :BURGER_KING;

				const cravez_items	=	db.collection("cravez_items");
				asyncParallel({
					restaurant_details : (callback)=>{
						/** Get restaurant details */
						const restaurants	= db.collection("restaurants");
						restaurants.findOne({slug: restaurantSlug },{projection:{_id:1}},(err, result)=>{
							callback(err, result);
						});
					},
					admin_details : (callback)=>{
						/** Get admin details */
						const users	= db.collection("users");
						users.findOne({user_role_id: CRAVEZ },{projection:{_id:1}},(userErr, userResult)=>{
							callback(userErr, userResult);
						});
					},
					update_delete_flag : (callback)=>{
						cravez_items.updateMany({restaurant_slug: restaurantSlug},{$set: {to_be_deleted: true }},(updateErr)=>{
							callback(updateErr);
						});
					},
				},(asyncErr, asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					let userDetails 		= 	asyncResponse.admin_details;
					let restaurantDetails 	=	asyncResponse.restaurant_details;
					let restaurantId		=	(restaurantDetails)	?	restaurantDetails._id	:"";
					let addedBy				=	(userDetails)		?	userDetails._id			:"";

					asyncEach(cravezFinalItems,(data,asyncEachcallback)=>{
						data 			= 	data._attributes;
						let kfgItemId 	=	String(data.ITEMID);

						// if(kfgItemId == "9602") return asyncEachcallback(null);

						/** Set update data */
						let updateData = {
							name		:	{en: data.NAME, ar: data.NAMEARB},
							description	:	{en: (data.DESCRIPTION) ? data.DESCRIPTION :"", ar: (data.DESCRIPTIONARB) ? data.DESCRIPTIONARB :""},
							menu_id		:	menuId,
							item_price	:	parseFloat(data.PRICE),
							branch_ids	:	data.STOREIDs,
							start_time	:	data.STARTTIME,
							end_time	:	data.ENDTIME,
							submenu_ids	:	data.SubMenuID,
							category_id	:	data.CategoryId,
							is_active	:	parseInt(data.ITM_AVAILABLITYSTATUS),
							is_combo	:	(data.IsCombo) ? parseInt(data.IsCombo) :0,
							size		:	data.Size,
							dough_type	:	data.DoughType,
							selector	:	data.Selector,
							is_half		:	data.IsHalf,
							vgroup_id	:	(data.VGroupId) ? 	parseInt(data.VGroupId) :0,
							order		:	(data.Seq)		?	parseInt(data.Seq)		:0,
							non_sellable:	(data.SubMenuID && parseInt(data.SubMenuID)>0) ? 0:NON_SELLABLE,
							is_updated	:	true,
							modified	:	getUtcDate(),
						};

						/** Save item details **/
						cravez_items.updateOne({
							item_id 		: 	kfgItemId,
							restaurant_id	: 	restaurantId,
						},
						{
							$set 		: 	updateData,
							$setOnInsert:	{
								kfg				: 	true,
								added_by		: 	addedBy,
								created			: 	getUtcDate(),
								channel_id		: 	CHANNEL_SOAP,
								restaurant_slug	:	restaurantSlug,
							},
							$unset: {
								to_be_deleted	: 1
							}
						},{upsert: true},(updateErr) => {
							asyncEachcallback(updateErr);
						});
					},(asyncEachErr)=>{
						if(asyncEachErr) return resolve({status:STATUS_ERROR,asyncEachErr:asyncEachErr });

						/** Delete cravez item  */
						cravez_items.deleteMany({
							restaurant_slug :	restaurantSlug,
							to_be_deleted 	: 	true,
						},(deleteErr)=>{
							if(deleteErr) return next(deleteErr);

							resolve({status: STATUS_SUCCESS});
						});
					});
				});
			});
		}).catch(next);
	};//End getItemsList()

	/**
	 * Function to get get all modifier item
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getAllModifierItem(req, res,next){
		return new Promise(resolve=>{
			const cravez_items = db.collection("cravez_items");
			cravez_items.find({},{projection: {item_id: 1}}).toArray((err, result)=>{
				if(err) return resolve({status : STATUS_ERROR, err : err});

				if(result.length == 0) return resolve({status : STATUS_SUCCESS, result : result});

				resolve({status : STATUS_SUCCESS, result : result});

				// asyncEach(result,(records,callback)=>{
				eachOfSeries(result,(records, index, callback)=>{
					console.log(" getAllModifierItem Item id - "+ records.item_id+"  index - "+index);

					let curlURL = Constants.WEBSITE_URL+'get_modifier_item_mapping/'+records.item_id;
					axios.get(curlURL, {
						httpsAgent: new https.Agent({
							rejectUnauthorized: false
						})
					}).then(() => {
						callback(null);
					}).catch(error => {
						callback(error);
					});
				},()=>{
					console.log(" getAllModifierItem Completed");
				});
			});
		});
	};//End getAllModifierItem()

	/**
	 * Function to get modifier item maping
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async getModifierItemMaping(req, res,next,client){
		return new Promise(resolve=>{
			let itemId		= (req.params.item_id) 		?	String(req.params.item_id) 		:"";
			let subItemId	= (req.params.sub_item_id) 	? 	String(req.params.sub_item_id) 	:"";

			/** Send error response */
			if(!itemId) return resolve({status:STATUS_ERROR, message: "Missing parameters" });

			/** Get item details */
			const cravez_items	= db.collection("cravez_items");
			cravez_items.findOne({item_id: {$in: [parseInt(itemId), itemId ]} },{},(itemErr, itemDetails)=>{
				if(itemErr || !itemDetails) return resolve({status:STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again"), itemErr: itemErr, itemResult : itemDetails });

				/** Call service */
				let clientItemId = (subItemId) ? subItemId : itemId;
				client["GetItemsModifierMap"]({LicenceKey: SOAP_LICENCE_KEY, ItemIds: [{"long":clientItemId} ]},(err, response)=>{
					if (err) throw err;

					let apiData	= (response && response.GetItemsModifierMapResult) ? response.GetItemsModifierMapResult :"";

					/** Save kfg request response */
					this.saveKFGRequestResponse(req,res,next,{
						method_name :	"GetItemsModifierMap",
						response	: 	response,
						request		:	{LicenceKey: SOAP_LICENCE_KEY, ItemIds: [{"long":clientItemId} ]}
					}).then(()=>{});

					/** Send error response */
					if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again.", apiData : apiData });

					let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
					let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

					if(!jsonData || !jsonData.ITEMS || !jsonData.ITEMS.ITEM || !jsonData.ITEMS.ITEM.MODIFIERGROUP){
						return resolve({status: STATUS_ERROR,  message:res.__("system.something_going_wrong_please_try_again"), jsonData : jsonData });
					}

					let dataArray =  jsonData.ITEMS.ITEM.MODIFIERGROUP;
					if(dataArray.constructor != Array ){
						let tempObj = dataArray;
						dataArray 	= [];
						dataArray.push(tempObj);
					}

					if(dataArray.length <=0) return resolve({status:STATUS_ERROR,message:"No recods found."});

					/** validate data*/
					let modifierGroupIds	= [];
					let modifierItemIds		= [];
					let groupItemList		= [];
					dataArray.map(record =>{
						let groupDetails	= 	record._attributes;
						let groupItems 		=	record.MODITEMS;

						if(groupItems.constructor != Array ){
							let tmpGroupItems 	= groupItems;
							groupItems 	= [];
							groupItems.push(tmpGroupItems);
						}

						if(groupItems.length >0){
							modifierGroupIds.push(parseFloat(groupDetails.GROUPID));

							/** Manage data  */
							let tmpList = {
								group_id 	: 	groupDetails.GROUPID,
								mod_type 	: 	groupDetails.ModType,
								item_list	:	[]
							};

							if(!groupDetails.item_list) groupDetails.item_list =[];
							groupItems.map(tmpRecords=>{
								tmpRecords = tmpRecords._attributes;

								modifierItemIds.push(String(tmpRecords.ID));

								tmpList.item_list.push(tmpRecords);
							});

							groupItemList.push(tmpList);
						}
					});

					if(modifierGroupIds.length <=0 || modifierItemIds.length <=0){
						return resolve({status: STATUS_ERROR,  message:res.__("system.something_going_wrong_please_try_again"), modifierGroupIds : modifierGroupIds, modifierItemIds : modifierItemIds });
					}

					// return resolve({status: groupItemList});

					const cravez_modifier_groups	= db.collection("cravez_modifier_groups");
					const cravez_choices_groups		= db.collection("cravez_choices_groups");
					const cravez_item_extra_masters	= db.collection("cravez_item_extra_masters");
					const cravez_item_group_extras	= db.collection("cravez_item_group_extras");
					const users						= db.collection("users");

					asyncParallel({
						admin_id : (callback)=>{
							/** Get admin details */
							users.findOne({user_role_id: CRAVEZ },{projection:{_id:1}},(userErr, userResult)=>{
								let adminId = (userResult) ? userResult._id : "";
								callback(userErr, adminId);
							});
						},
						item_list : (parentCallback)=>{
							cravez_items.find({item_id : {$in: modifierItemIds} }).toArray((err, result)=>{
								if(err || result.length <=0) return parentCallback(err,null);

								let cravezItemList 	= 	{};
								result.map(records=>{
									cravezItemList[records.item_id] = records;
								});
								parentCallback(err,cravezItemList);
							});
						},
						group_list : (parentCallback)=>{
							cravez_modifier_groups.find({kfg_modifier_group_id : {$in: modifierGroupIds} }).toArray((err, result)=>{
								if(err || result.length <=0) return parentCallback(err,null);

								let cravezGroupList =	{};
								result.map(records=>{
									cravezGroupList[records.kfg_modifier_group_id] = records;
								});
								parentCallback(err,cravezGroupList);
							});
						},
						update_choices_groups : (itemCallback)=>{
							cravez_choices_groups.updateMany({
								kfg_item_id : itemId,
								kfg_combo_components_id : {$exists : false},
							},
							{
								$set : {
									to_be_deleted	: true
								},
							},(updateErr) => {
								itemCallback(updateErr);
							});
						},
						cravez_item_extra_masters : (itemCallback)=>{
							cravez_item_extra_masters.updateMany({
								kfg_item_id : itemId,
								kfg_combo_components_id : {$exists : false},
							},
							{
								$set : {
									to_be_deleted	: true
								},
							},(updateErr) => {
								itemCallback(updateErr);
							});
						},
						update_group_extras : (itemCallback)=>{
							cravez_item_group_extras.updateMany({
								kfg_item_id : itemId,
								kfg_combo_components_id : {$exists : false},
							},
							{
								$set : {
									to_be_deleted	: true
								},
							},(updateErr) => {
								itemCallback(updateErr);
							});
						},
					},(parentErr,parentResponse)=>{
						if(parentErr) return next(parentErr);

						if(!parentResponse.item_list || !parentResponse.group_list){
							return resolve({status: STATUS_ERROR,  message:res.__("system.something_going_wrong_please_try_again"), parentResponse : parentResponse });
						}

						let addedBy 				= 	parentResponse.admin_id;
						let groupObj 				= 	parentResponse.group_list;
						let allItemObj 				= 	parentResponse.item_list;
						let restaurantId 			=	itemDetails.restaurant_id;
						let restaurantSlug 			=	itemDetails.restaurant_slug;
						let isCombo 				=	itemDetails.is_combo;
						let doughType 				=	(itemDetails.dough_type) ? parseInt(itemDetails.dough_type) :0;
						let itemVgroupIds 			=	[];
						let modifierChoiesGroup 	=	[];
						let modifierExtraItemList	=	[];
						let noOfComponents			=	0;
						let itemMainId				=	[];
						let freeItemMainId			=	[];

						let itemType 	=	(restaurantSlug == PIZZA_HUT && isCombo) ? DEAL_ITEM :"";
						let isDeal		=	(itemType == DEAL_ITEM) ? true :false;
						let vgroupItem	=	(restaurantSlug == PIZZA_HUT && doughType >0)	 ? true :false;
						groupItemList.map((records,groupClass)=>{
							let tmpGroupId 	= 	records.group_id;
							let modType 	= 	records.mod_type;
							if(groupObj[tmpGroupId]){
								let isChecked 		=	true;
								let tmpGroupDetails = 	groupObj[tmpGroupId];
								records.item_list.map(itemRecords=>{
									if(allItemObj[itemRecords.ID]){
										let tmpItemDetails 	=	allItemObj[itemRecords.ID];
										let tmpDoughType	= 	(tmpItemDetails.dough_type) ? parseInt( tmpItemDetails.dough_type) :0;

										if(modType > 0 && isDeal){
											if(tmpDoughType >0 && isDeal){
												if(isChecked){
													noOfComponents++
													isChecked = false;
												}

												itemVgroupIds.push({
													item_id		: 	tmpItemDetails.item_id,
													size		: 	tmpItemDetails.size,
													selector	: 	tmpItemDetails.selector,
													dough_type	:	tmpItemDetails.dough_type
												});
											}
										}else{
											let tmpGroupName = (tmpGroupDetails.name) ? tmpGroupDetails.name.en :"";
											tmpGroupName = (tmpGroupName) ? tmpGroupName.trim().toLowerCase() :"";

											if((isDeal || vgroupItem) && (tmpGroupName == "select pizza" || tmpGroupName == "choose your pizza")){
												itemMainId.push(tmpItemDetails.item_id);

												if(tmpItemDetails.item_price <= 0){
													freeItemMainId.push(tmpItemDetails.item_id);
												}
											}else{
												modifierChoiesGroup.push({
													group_class	:	groupClass,
													group_id	:	tmpGroupId,
													name 		:	tmpGroupDetails.name,
													min 		:	(tmpGroupDetails.min) ? tmpGroupDetails.min: tmpGroupDetails.min_quantity,
													max 		:	(tmpGroupDetails.max) ? tmpGroupDetails.max: tmpGroupDetails.max_quantity,
													extra_item_id:	tmpItemDetails.item_id,
												});

												modifierExtraItemList.push({
													extra_item_id	:	tmpItemDetails.item_id,
													group_class		:	groupClass,
													group_id		:	tmpGroupId,
													order			:	tmpItemDetails.order,
													name			:	tmpItemDetails.name,
													price			:	parseFloat(itemRecords.PRICE),
													status			:	tmpItemDetails.is_active
												});
											}
										}
									}else{
										console.error("Group item details not found",itemRecords)
									}
								});
							}else{
								console.error("Group details not found",records)
							}
						});

						if(itemVgroupIds.length <= 0 && (modifierChoiesGroup.length <=0 || modifierExtraItemList.length <=0)){
							return resolve({status: STATUS_ERROR,  message:res.__("system.something_going_wrong_please_try_again"), modifierChoiesGroup : modifierChoiesGroup, modifierExtraItemList: modifierExtraItemList,  allItemObj: allItemObj });
						}

						let finalGroupData 	= {};
						let finalExtraId 	= {};
						asyncParallel({
							update_items_list: (parallelCallback)=>{
								if(itemMainId.length <=0 && !isDeal)  return parallelCallback(null);

								if(freeItemMainId.length >0){
									itemMainId = freeItemMainId;
								}

								let updateItemData = {
									$set:	{
										deal_hnh_item_id:	itemMainId,
										modified 		:	getUtcDate(),
									},
								};

								if(itemType == DEAL_ITEM){
									updateItemData["$set"].no_of_components = noOfComponents;
									updateItemData["$addToSet"] = {
										v_group_item_ids: {$each: itemVgroupIds}
									};
								}

								/** Update items */
								cravez_items.updateOne({item_id: itemId },updateItemData,(insertErr)=>{
									parallelCallback(insertErr);
								});
							},
							update_group: (parallelCallback)=>{
								if(modifierChoiesGroup.length <=0) return parallelCallback(null);

								eachOfSeries(modifierChoiesGroup,(records, index, forEachChildCallback)=>{
									let tmpGroupId 		= 	records.group_id;
									let tmpGroupClass 	= 	records.group_class;

									/** Set conditions */
									let groupConditions = {
										kfg_item_id 			: 	itemId,
										restaurant_id 			:	restaurantId,
										kfg_modifiers_groups_id : 	parseInt(tmpGroupId),
										kfg_groups_class 		: 	tmpGroupClass
									};

									/** Get item choice group details */
									cravez_choices_groups.findOne(groupConditions,{projection: {_id: 1,}},(masterErr,masterResult)=>{
										if(masterErr) return forEachChildCallback(masterErr);

										if(masterResult){
											if(!finalGroupData[tmpGroupClass])finalGroupData[tmpGroupClass]={};
											if(!finalGroupData[tmpGroupClass][tmpGroupId])finalGroupData[tmpGroupClass][tmpGroupId]= "";
											finalGroupData[tmpGroupClass][tmpGroupId] = masterResult._id;

											/** Save choice group detils */
											cravez_choices_groups.updateOne(groupConditions,{
												$set	:	{
													name			: 	records.name,
													min_quantity 	:	records.min,
													max_quantity 	: 	records.max,
													order			:	index+2,
													modified 		:	getUtcDate(),
												},
												$unset :{
													to_be_deleted	: true
												}
											},(insertErr)=>{
												return forEachChildCallback(insertErr);
											});
										}else{
											/** Save choice group detils */
											cravez_choices_groups.updateOne(groupConditions,{
												$set	:	{
													name			: 	records.name,
													min_quantity 	:	records.min,
													max_quantity 	: 	records.max,
													order			:	index+2,
													modified 		:	getUtcDate(),
												},
												$setOnInsert:	{
													kfg		 		: 	true,
													added_by		:	addedBy,
													channel_id		:	CHANNEL_SOAP,
													restaurant_slug :	restaurantSlug,
													created   		:	getUtcDate(),
												},
												$unset :{
													to_be_deleted	: true
												}
											},{upsert: true },(insertErr,insertResult)=>{
												if(insertResult &&  insertResult.upsertedId && insertResult.upsertedId._id){
													if(!finalGroupData[tmpGroupClass])finalGroupData[tmpGroupClass]={};
													if(!finalGroupData[tmpGroupClass][tmpGroupId])finalGroupData[tmpGroupClass][tmpGroupId]= "";

													finalGroupData[tmpGroupClass][tmpGroupId] = insertResult.upsertedId._id;
												}
												forEachChildCallback(insertErr);
											});
										}
									});
								},(asyncEachChildErr)=>{
									parallelCallback(asyncEachChildErr);
								});
							},
							update_exitem: (parallelCallback)=>{
								if(modifierExtraItemList.length <=0)  return parallelCallback(null);

								eachOfSeries(modifierExtraItemList,(records, index,forEachChildCallback)=>{
									let tmpExItemId = String(records.extra_item_id);

									/** Set conditions */
									let exItemConditions = {
										kfg_item_id 	: 	itemId,
										restaurant_id	:	restaurantId,
										extra_item_id	:	tmpExItemId,
									};

									/** Get items */
									cravez_item_extra_masters.findOne(exItemConditions,{projection: {_id: 1}},(masterErr,masterResult)=>{
										if(masterErr) return forEachChildCallback(masterErr,masterResult);

										if(masterResult){
											if(!finalExtraId[tmpExItemId]) finalExtraId[tmpExItemId] = {};
											finalExtraId[tmpExItemId] =  masterResult._id;

											cravez_item_extra_masters.updateOne(exItemConditions,{
												$set:	{
													name   		: 	records.name,
													extra_fees 	:	0,
													modified 	:	getUtcDate(),
												},
												$unset :{
													to_be_deleted	: true
												}
											},(insertErr)=>{
												forEachChildCallback(insertErr, masterResult);
											});
										}else{
											/** Save extra master details */
											cravez_item_extra_masters.updateOne(exItemConditions,{
												$set:	{
													name   		: 	records.name,
													extra_fees 	:	0,
													modified 	:	getUtcDate(),
												},
												$setOnInsert:	{
													kfg		 		: 	true,
													added_by		:	addedBy,
													channel_id		:	CHANNEL_SOAP,
													restaurant_slug :	restaurantSlug,
													is_active		:	parseInt(records.status),
													order			:	parseInt(records.order),
													created   		:	getUtcDate(),
												},
												$unset :{
													to_be_deleted	: true
												}
											},{upsert: true },(insertErr,insertResult)=>{
												if(insertResult &&  insertResult.upsertedId && insertResult.upsertedId._id){
													let masterId = (insertResult &&  insertResult.upsertedId && insertResult.upsertedId._id)

													if(!finalExtraId[tmpExItemId]) finalExtraId[tmpExItemId] = {};
													finalExtraId[tmpExItemId] =  masterId;
												}

												forEachChildCallback(insertErr);
											});
										}
									});
								},(asyncEachChildErr)=>{
									parallelCallback(asyncEachChildErr);
								});
							},
						},(asyncErr)=>{
							if(asyncErr) return resolve({status: STATUS_ERROR,  message:res.__("system.something_going_wrong_please_try_again"), asyncErr: asyncErr });

							if(modifierChoiesGroup.length <=0) return resolve({status: STATUS_SUCCESS });

							eachOfSeries(modifierExtraItemList,(records, index,forEachChildCallback)=>{
								let tmpExItemId 	=	String(records.extra_item_id);
								let tmpGroupId 		= 	records.group_id;
								let tmpGroupClass 	= 	records.group_class;
								let exItemMongoId	=	(finalExtraId[tmpExItemId]) ? finalExtraId[tmpExItemId] :"";
								let groupMongoId	=	(finalGroupData[tmpGroupClass] && finalGroupData[tmpGroupClass][tmpGroupId]) ? finalGroupData[tmpGroupClass][tmpGroupId] :"";

								if(!exItemMongoId || !groupMongoId){
									console.error("groupMongoId "+groupMongoId);
									console.error("exItemMongoId "+exItemMongoId);
									console.error("Group or ex item details not found",records);
									return forEachChildCallback(null);
								}

								/** Update group */
								cravez_item_group_extras.updateOne({
									kfg_item_id 	: 	itemId,
									group_id 		: 	groupMongoId,
									restaurant_id 	:	restaurantId,
									item_extra_id	:	exItemMongoId,
								},
								{
									$set	:	{
										order 		:	records.order,
										extra_fees 	:	records.price,
										modified	:	getUtcDate(),
									},
									$setOnInsert:	{
										kfg		 		: 	true,
										channel_id		:	CHANNEL_SOAP,
										added_by		:	addedBy,
										restaurant_slug :	restaurantSlug,
										created   		:	getUtcDate(),
									},
									$unset :{
										to_be_deleted	: true
									}
								},{upsert: true },(insertErr)=>{
									forEachChildCallback(insertErr);
								});
							},(asyncEachChildErr)=>{
								if(asyncEachChildErr) return next(asyncEachChildErr);

								asyncParallel({
									update_choices_groups : (itemCallback)=>{
										cravez_choices_groups.deleteMany({
											kfg_item_id 	: itemId,
											to_be_deleted	: true,
											kfg_combo_components_id : {$exists : false}
										},(deleteErr) => {
											itemCallback(deleteErr);
										});
									},
									update_choices_groups : (itemCallback)=>{
										cravez_item_extra_masters.deleteMany({
											kfg_item_id 	: itemId,
											to_be_deleted	: true,
											kfg_combo_components_id : {$exists : false}
										},(deleteErr) => {
											itemCallback(deleteErr);
										});
									},
									update_group_extras : (itemCallback)=>{
										cravez_item_group_extras.deleteMany({
											kfg_item_id 	: itemId,
											to_be_deleted	: true,
											kfg_combo_components_id : {$exists : false}
										},(deleteErr) => {
											itemCallback(deleteErr);
										});
									},
								},(parentErrs)=>{
									if(parentErrs){
										return resolve({status:STATUS_ERROR, message: "Something went wrong, Please try again.", error: parentErrs });
									}

									/** Send success response */
									resolve({status: STATUS_SUCCESS });
								});
							});
						});
					});
				});
			});
		});
	};//End getModifierItemMaping()

	/**
	 * Function to Get order status types
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getOrderStatusTypes(req, res,next,client){
		return new Promise(resolve=>{
			client["GetOrderStatusTypes"]({LicenceKey: SOAP_LICENCE_KEY},(err, response)=>{
				if (err) throw err;
				let apiData	= (response && response.GetOrderStatusTypesResult) ? response.GetOrderStatusTypesResult :"";

				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetOrderStatusTypes",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY }
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });


				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				let dataArray =  jsonData.OrderStatusTypes.OrderStatus;
				if(dataArray.constructor != Array ){
					let tempObj = dataArray;
					dataArray 	= [];
					dataArray.push(tempObj);
				}

				const cravez_order_status_types = db.collection("cravez_order_status_types");
				asyncEach(dataArray,(data,asyncEachcallback)=>{
					/** Save details **/
					cravez_order_status_types.updateOne({
						cravez_status_type_id : parseInt(data.ColID._text)
					},
					{
						$set : {
							cravez_status_id	: parseInt(data.Order_StatusId._text),
							status				: data.Order_Status._text,
							status_warning		: parseInt(data.ORDSTS_WARNING._text),
							modified			: getUtcDate(),
						},
						$setOnInsert: {
							channel_id	: CHANNEL_SOAP,
							created		: getUtcDate(),
							kfg			: true
						}
					},{upsert: true},(updateErr) => {
						asyncEachcallback(updateErr);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return next(asyncEachErr);
					resolve({status : STATUS_SUCCESS});
				});
			});
		}).catch(next);
	};//End getOrderStatusTypes()

	/**
	 * Function to Get order modes
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async getOrderModes(req, res,next,client){
		return new Promise(resolve=>{
			client["GetOrderModes"]({LicenceKey: SOAP_LICENCE_KEY},(err, response)=>{
				if (err) throw err;
				let apiData	= (response && response.GetOrderModesResult) ? response.GetOrderModesResult :"";


				/** Save kfg request response */
				this.saveKFGRequestResponse(req,res,next,{
					method_name :	"GetOrderModes",
					response	: 	response,
					request		:	{LicenceKey: SOAP_LICENCE_KEY }
				}).then(()=>{});

				/** Send error response */
				if(!apiData) return resolve({status: STATUS_ERROR,message : "Something went wrong, Please try again." });

				let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

				let dataArray =  jsonData.OrderModes.OrderMode;
				if(dataArray.constructor != Array ){
					let tempObj = dataArray;
					dataArray 	= [];
					dataArray.push(tempObj);
				}

				const cravez_order_modes = db.collection("cravez_order_modes");
				asyncEach(dataArray,(data,asyncEachcallback)=>{
					/** Save details **/
					cravez_order_modes.updateOne({
						cravez_mode_id : parseInt(data.Order_ModeId._text)
					},
					{
						$set : {
							name		: data.Order_ModeName._text,
							modified	: getUtcDate(),
						},
						$setOnInsert: {
							channel_id	: CHANNEL_SOAP,
							created		: getUtcDate(),
							kfg			: true
						}
					},{upsert: true},(updateErr) => {
						asyncEachcallback(updateErr);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return next(asyncEachErr);
					resolve({status : STATUS_SUCCESS});
				});
			});
		}).catch(next);
	};//End getOrderModes()

	/**
	 * Function to Get order details
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	async getOrderDetails (req, res,next,client){
		return new Promise(resolve=>{
			let orderId	=	(req.params.order_id) 	? 	ObjectId(req.params.order_id)	:"";

			/** Send error response */
			if(!orderId) return resolve({status:STATUS_ERROR,message:res.__("system.missing_parameters")});

			/** Get order details */
			const orders = 	db.collection("orders");
			orders.findOne({_id: orderId },{projection:{unique_order_id:1}},(err,result)=>{
				if(err) return next(err);

				/** Send error response */
				if(!result){
					return resolve({
						status : STATUS_ERROR,
						message: res.__("system.something_going_wrong_please_try_again"),
						missing_order_details: true
					});
				}

				/** Get order details */
				client["GetOrderDetails"]({LicenceKey: SOAP_LICENCE_KEY, OrderId: result.unique_order_id },(err, apiResponse)=>{
					// if (err) throw err;

					/** Save kfg request response */
					this.saveKFGRequestResponse(req,res,next,{
						method_name :	"GetOrderDetails",
						response	: 	response,
						request		:	{LicenceKey: SOAP_LICENCE_KEY, OrderId: result.unique_order_id }
					}).then(()=>{});

					/** Send response */
					resolve({
						err 		:	err,
						apiResponse	:	apiResponse,
					});
				});
			});
		}).catch(next);
	};//End getOrderDetails()

	/**
	 * Function to get pending order info
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async getPendingOrdersInfo(req, res,next){
		return new Promise(resolve=>{
			let apiData = '<Response> <Orders> <Order_Id>2667300</Order_Id> <Order_Date>2017-07-18T00:00:00</Order_Date> <Order_Time>2017-07-06T18:49:05</Order_Time> <Order_Status>W_In-Progress</Order_Status> </Orders> <Orders> <Order_Id>2667300</Order_Id> <Order_Date>2017-07-18T00:00:00</Order_Date> <Order_Time>2017-07-06T18:49:05</Order_Time> <Order_Status>W_In-Progress</Order_Status> </Orders> </Response>';

			const xml2json 	=	require('xml-js').xml2json;

			let trimedData	= 	apiData.replace(new RegExp(/\t/g),'').trim();
			let jsonData	= 	JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

			if(!jsonData || !jsonData.Response || !jsonData.Response.Orders){
				return resolve({status: STATUS_ERROR,  message:res.__("system.something_going_wrong_please_try_again") });
			}

			if(jsonData.Response.Orders.constructor != Array ){
				let tempObj = jsonData.Response.Orders;
				jsonData.Response.Orders = [];
				jsonData.Response.Orders.push(tempObj);
			}

			let orderIds 		=	[];
			let missingData		=	[];
			let orderStatusObj 	=	{};
			jsonData.Response.Orders.map(record =>{
				if(!record.attributes.Order_Id._text) 	 	missingData.push("Order_Id");
				if(!record.attributes.Order_Status._text) 	missingData.push("Order_Status");

				if(record.attributes.Order_Id && record.attributes.Order_Status){
					let tmpOrderId	= 	String(record.attributes.Order_Id);
					let statusLabel	= 	 record.attributes.Order_Status._text.toLowerCase().trim();
					orderIds.push(tmpOrderId._text);

					Object.keys(KFG_ORDER_STATUS).map(key=>{
						let tmpLabel = KFG_ORDER_STATUS[key].label.toLowerCase();

						if(tmpLabel== statusLabel) orderStatusObj[tmpOrderId]=KFG_ORDER_STATUS[key].status;
					});
				}
			});

			/** Send error response */
			if(missingData.length > 0 || Obkect.keys(orderStatusObj).length <=0 ){
				return resolve({ status: STATUS_ERROR, message: res.__("system.missing_parameters"), missing: missingData.join(", ") });
			}

			/** Send error response */
			if(orderIds.length <=0  || Object.keys(orderStatusObj).length <=0 ){
				return resolve({status:STATUS_ERROR,  message:res.__("system.something_going_wrong_please_try_again"), order_status: orderStatusObj, order_ids: orderIds });
			}

			const orders = 	db.collection("orders");
			asyncParallel({
				order_list : (callback)=>{
					/** Get order list */
					orders.aggregate([
						{$match :   {unique_order_id : {$in: orderIds}}},
						{$lookup:	{
							from     : "users",
							let      : {restaurantId : "$restaurant_id"},
							pipeline : [
								{$match : {
									$expr: {
										$and : [
											{$eq: ["$restaurant_id", "$$restaurantId"]},
											{$eq: ["$user_role_id", RESTAURANT]},
											{$eq: ["$user_type", USER_TYPE_RESTAURANT]},
										]
									}
								}},
								{$project : {_id: 1, user_role_id: 1 }},
							],
							as	:	"user_details"
						}},
						{$project: {
							_id: 1, unique_order_id: 1,  order_status: 1, customer_id: 1, restaurant_id: 1, branch_id: 1, updated_by : { $arrayElemAt: ["$user_details._id", 0] },
							user_role_id: { $arrayElemAt: ["$user_details.user_role_id", 0] },
						}},
					]).toArray((err, result)=>{
						callback(err, result);
					});
				},
				admin_details : (callback)=>{
                    /** Get admin details */
					const users	= db.collection("users");
					users.findOne({user_role_id: CRAVEZ },{projection:{_id:1}},(userErr, userResult)=>{
						callback(userErr, userResult);
					});
				},
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				let orderList 		= 	asyncResponse.order_list;
				let adminDetails 	=	asyncResponse.admin_details;
				let adminId 		=	(adminDetails) ? adminDetails._id :"";

				/** Send error response */
				if(orderList.length <=0) return resolve({status: STATUS_ERROR,  message: res.__("system.something_going_wrong_please_try_again") });

				asyncEach(orderList,(records, eachCallback)=>{
					let orderId		=	records._id;
					let oldStatus	=	records.order_status;
					let uniqueOrderId=	records.unique_order_id;
					let updatedBy	=	(records.updated_by) 	? records.updated_by 	:adminId;
					let updatedRole	=	(records.user_role_id) 	? records.user_role_id 	:CRAVEZ;
					let status		=	(orderStatusObj[uniqueOrderId]) ? orderStatusObj[uniqueOrderId] :"";

					if(!status || (status == oldStatus)) return eachCallback(null);

					/** Update order status */
					orders.updateOne({
						_id : orderId
					},
					{$set : {
						order_status 	: 	status,
						modified		:	getUtcDate(),
					}},(updateErr) => {
						if(updateErr) return eachCallback(updateErr);

						/** Save order logs */
						saveOrderStatusLogs(req,res,next,{
							order_id 		:	orderId,
							updated_by 		: 	updatedBy,
							user_role_id 	: 	updatedRole,
							status 			:	status,
							order_status	:	oldStatus,
							restaurant_id	:	records.restaurant_id,
							branch_id		:	records.branch_id,
							user_id			:	records.customer_id
						}).then(()=>{
							asyncEachcallback(null);
						});
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return next(asyncEachErr);

					resolve({status: STATUS_SUCCESS });
				});
			});
		}).catch(next);
	};//End getPendingOrdersInfo()

	/**
	 * Function to get order status
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async getOrderStatus (req, res,next,options){
		return new Promise(resolve=>{
			let orderId = 	(options.order_id) 	? 	ObjectId(options.order_id) 	:"";

			if(!orderId) return resolve({status:STATUS_ERROR,message:res.__("system.missing_parameters")});

			const orders = 	db.collection("orders");
			asyncParallel({
				order_details : (callback)=>{
					/** Get order details */
					orders.aggregate([
						{$match :   {_id : orderId}},
						{$lookup:	{
							from     : "users",
							let      : {restaurantId : "$restaurant_id"},
							pipeline : [
								{$match : {
									$expr: {
										$and : [
											{$eq: ["$restaurant_id", "$$restaurantId"]},
											{$eq: ["$user_role_id", RESTAURANT]},
											{$eq: ["$user_type", USER_TYPE_RESTAURANT]},
										]
									}
								}},
								{$project : {_id: 1, user_role_id: 1 }},
							],
							as	:	"user_details"
						}},
						{$project: {
							_id: 1, order_status: 1, customer_id: 1, restaurant_id: 1, branch_id: 1,
							updated_by 	: { $arrayElemAt: ["$user_details._id", 0] },
							user_role_id 	: { $arrayElemAt: ["$user_details.user_role_id", 0] },
						}},
					]).toArray((err, result)=>{
						result = (result && result[0]) ? result[0] :null;
						callback(err, result);
					});
				},
				admin_details : (callback)=>{
                    /** Get admin details */
					const users	= db.collection("users");
					users.findOne({user_role_id: CRAVEZ },{projection:{_id:1}},(userErr, userResult)=>{
						callback(userErr, userResult);
					});
				},
			},(asyncErr, asyncResponse)=>{
				if(asyncErr) return next(asyncErr);

				let orderDetails 	= 	asyncResponse.order_details;
				let adminDetails 	=	asyncResponse.admin_details;
				let adminId 		=	(adminDetails) ? adminDetails._id :"";

				/** Send error response */
				if(!orderDetails) resolve({status:STATUS_ERROR, message:res.__("system.invalid_access") })

				// let uniqueOrderId = orderDetails.unique_order_id;

				let apiData = '<Orders> <Order_Id>2868663</Order_Id> <Order_StatusId>104</Order_StatusId> <Order_Status>W_Comment</Order_Status> </Orders>';

				let trimedData	= 	apiData.replace(new RegExp(/\t/g),'').trim();
				let jsonData	= 	JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));
				let kfgStatusId =	(jsonData.Orders && jsonData.Orders.Order_StatusId._text) ? jsonData.Orders.Order_StatusId._text :"";
				let status		=	(kfgStatusId && KFG_ORDER_STATUS[kfgStatusId]) ? KFG_ORDER_STATUS[kfgStatusId].status :"";

				if(!jsonData || !jsonData.Orders || !jsonData.Orders.Order_StatusId._text || !status){
					return resolve({status: STATUS_ERROR,  message:res.__("system.something_going_wrong_please_try_again") });
				}

				/** Update order status */
				orders.updateOne({
					_id : orderId
				},
				{$set : {
					order_status 	: 	status,
					modified		:	getUtcDate(),
				}},(updateErr) => {
					if(updateErr) return next(updateErr);

					/** Save order logs */
					saveOrderStatusLogs(req,res,next,{
						order_id 		:	orderId,
						status 			:	status,
						updated_by 		: 	(orderDetails.updated_by) ? orderDetails.updated_by :adminId,
						user_role_id 	: 	(orderDetails.user_role_id)?orderDetails.user_role_id :CRAVEZ,
						order_status	:	orderDetails.order_status,
						restaurant_id	:	orderDetails.restaurant_id,
						branch_id		:	orderDetails.branch_id,
						user_id			:	orderDetails.customer_id
					}).then(logResponse=>{

						resolve({status: STATUS_SUCCESS, response : logResponse });
					});
				});

			});
		});
	};//End getOrderStatus()

	/**
	 * Function to get order status type
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	 **/
	async getOrderStatusType(req, res,next){
		return new Promise(resolve=>{
			let apiData = '<OrderStatusTypes><OrderStatus><ColID>18</ColID><Order_StatusId>0</Order_StatusId><Order_Status>Initial</Order_Status><ORDSTS_WARNING>1</ORDSTS_WARNING> </OrderStatus><OrderStatus> <ColID>19</ColID> <Order_StatusId>1</Order_StatusId>			<Order_Status>Open</Order_Status><ORDSTS_WARNING>0</ORDSTS_WARNING></OrderStatus>			<OrderStatus><ColID>20</ColID><Order_StatusId>2</Order_StatusId> <Order_Status>In Kitchen</Order_Status><ORDSTS_WARNING>0</ORDSTS_WARNING></OrderStatus><OrderStatus><ColID>21</ColID><Order_StatusId>4</Order_StatusId><Order_Status>Bumped</Order_Status><ORDSTS_WARNING>0</ORDSTS_WARNING></OrderStatus></OrderStatusTypes>';

			let trimedData	= apiData.replace(new RegExp(/\t/g),'').trim();
			let jsonData	= JSON.parse(xml2json(trimedData, {compact: true, spaces: 4}));

			if(!jsonData || !jsonData.OrderStatusTypes || !jsonData.OrderStatusTypes.OrderStatus){
				return resolve({status: STATUS_ERROR, message: res.__("Invalid xml format") });
			}

			if(jsonData.OrderStatusTypes.OrderStatus.constructor != Array ){
				let tempObj = jsonData.OrderStatusTypes.OrderStatus;
				jsonData.OrderStatusTypes.OrderStatus = [];
				jsonData.OrderStatusTypes.OrderStatus.push(tempObj);
			}

			/** Get admin details */
			const users	= db.collection("users");
			users.findOne({
				user_role_id : CRAVEZ
			},{projection:{full_name:1,_id:1}},(superAdminErr, superAdminResult)=>{
				if(superAdminErr) return resolve({status: STATUS_ERROR});

				let addedBy = (superAdminResult) ? superAdminResult._id :"";

				const cravez_order_status_types	= db.collection("cravez_order_status_types");
				asyncEach(jsonData.OrderStatusTypes.OrderStatus,(data,asyncEachcallback)=>{
					/** Save order status type details **/
					cravez_order_status_types.updateOne({
						col_id : parseInt(data.ColID._text)
					},
					{
						$set : {
							status 			: 	parseInt(data.Order_StatusId._text),
							status_label 	: 	data.Order_Status._text,
							status_warning 	:	data.ORDSTS_WARNING._text,
							modified		:	getUtcDate(),
						},
						$setOnInsert: {
							kfg			: 	true,
							added_by	: 	addedBy,
							channel_id	: 	CHANNEL_SOAP,
							created		: 	getUtcDate(),
						}
					},{upsert: true},(updateErr) => {
						asyncEachcallback(updateErr);
					});
				},(asyncEachErr)=>{
					if(asyncEachErr) return next(asyncEachErr);

					resolve({status: STATUS_SUCCESS });
				});
			});
		}).catch(next);
	};//End getOrderStatusType()

	/**
	 * Function to save kfg request response details
	 *
	 * @param req	As Request Data
	 * @param res	As Response Data
	 * @param next	As Callback argument to the middleware function
	 *
	 * @return json
	**/
	async saveKFGRequestResponse (req,res,next,options){
		return new Promise(resolve=>{
            let methodName	= (options.method_name) 	? 	options.method_name 	:"";
            let request		= (options.request) 		? 	options.request     	:{};
            let response	= (options.response) 		? 	options.response    	:{};
            let requestError= (options.request_error)	?	options.request_error   :"";
            let extraPerms	= (options.extra_perms)		?	options.extra_perms   	:"";
			let logId		= (options.log_id) 			? 	ObjectId(options.log_id):ObjectId();

            /** Send error message */
			if(!methodName || !request || !response) return resolve({status: STATUS_ERROR, message: res.__("system.missing_parameters")});

			/** Set insertable data */
			let insertAbleData = {
				method_name 	: 	methodName,
                request			: 	request,
                response		: 	response,
                request_error	: 	String(requestError),
                modified		:	getUtcDate(),
			};

			if(extraPerms) insertAbleData.extra_perms = extraPerms;

			/** Save kfg request response details */
			const kfg_request_response  = db.collection("kfg_request_response");
			kfg_request_response.updateOne({
				_id : 	logId,
			},
			{
				$set : insertAbleData,
				$setOnInsert: {
					created:	getUtcDate()
				},
			},{upsert: true},(updateErr) => {
				if(updateErr) return next(updateErr);

				resolve({status	: STATUS_SUCCESS});
			});
		}).catch(next);
	};// end saveKFGRequestResponse()

	/**
	 * Function to save data form url
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async saveKfgHdServiceLogs(req, res,next){
		return new Promise(resolve=>{
			/** Save kfg request response */
			this.saveKFGRequestResponse(req,res,next,{
				method_name :	req.body.method_name,
				response	: 	req.body.response,
				request		:	(req.body.request) ? req.body.request :{},
			}).then(()=>{ });

			resolve({status : STATUS_SUCCESS});
		});
	};//End saveKfgHdServiceLogs()

	/**
	 * Function to update branch calender
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async updateBranchCalender(req, res,next){
		return new Promise(resolve=>{
			let branchId	= req.params.branch_id;

			/** Update branch calender*/
			this.cronModule.saveOpenBranchList(req,res,next,{branch_id: branchId});

			resolve({status : STATUS_SUCCESS});
		}).catch(next);
	};//End updateBranchCalender()

	/**
	 * Function to assign menu to branch
	 *
	 * @param params As Parameters
	 *
	 * @return json
	 */
	async assignMenuToBranch(options){
		return new Promise(resolve=>{
			try{
				let restaurantId = ObjectId(options.restaurant_id);

				asyncParallel({
					branch_ids : (callback)=>{
						/** Get all restaurant branch ids  */
						const restaurant_branches = db.collection("restaurant_branches");
						restaurant_branches.distinct("_id",{restaurant_id : restaurantId},(err,branchIds)=>{
							callback(err, branchIds);
						});
					},
					menu_ids : (callback)=>{
						const restaurant_menus = db.collection("restaurant_menus");
						restaurant_menus.distinct("_id",{restaurant_id: restaurantId},(err,menuIds)=>{
							callback(err, menuIds);
						});
					},
				},(parallelErr, parallelRes)=>{
					if(parallelErr) return resolve({status: STATUS_ERROR });

					let menuIds		= 	(parallelRes.menu_ids)		?	parallelRes.menu_ids 	:[];
					let branchIds 	=	(parallelRes.branch_ids)	?	parallelRes.branch_ids 	:[];

					if(menuIds.length ==0 || branchIds.length ==0) return resolve({status: STATUS_ERROR });

					/**  For save restaurant_menu_branches collection */
					const restaurant_menu_branches = db.collection("restaurant_menu_branches");
					eachOfSeries(menuIds,(menuId, parentIndex, parentCallback)=>{

						eachOfSeries(branchIds,(branchId, dataIndex, eachCallback)=>{

							restaurant_menu_branches.updateOne({
								menu_id 	  : menuId,
								restaurant_id : restaurantId,
								branch_id 	  : branchId,
							},
							{
								$set : {
									modified : getUtcDate()
								},
								$setOnInsert: {
									created 	: getUtcDate(),
									channel_id	: CHANNEL_SOAP
								}
							},{upsert: true},(updateErr) => {
								eachCallback(updateErr);
							});
						},(err)=> {
							if(err) return parentCallback(err);

							restaurant_menu_branches.deleteMany({
								menu_id 	  	: menuId,
								branch_id	 	: {$nin: branchIds },
								restaurant_id 	: restaurantId,
							},(err)=>{
								parentCallback(err);
							});
						});
					},(err)=> {
						if(err) return resolve({status: STATUS_ERROR });

						resolve({status: STATUS_SUCCESS});
					});
				});
			}catch(e){
				resolve({status: STATUS_ERROR });
			}
		});
	};//End assignMenuToBranch()
}