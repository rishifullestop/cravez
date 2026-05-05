import { ObjectId } from 'mongodb';

import Tables from './../config/database_tables.mjs';
import * as Constants from './../config/global_constant.mjs';
import {getDropdownList} from "./selectBoxHelper.mjs"
import {arrayToObject} from "./arrayHelper.mjs"
import { getDb } from '../config/connection.mjs';

/**
 * Function to get city list
 *
 * @param req		As 	Request Data
 * @param res		As 	Response Data
 * @param next 		As 	Callback argument to the middleware function
 * @param options 	As	data object
 *
 * @return json
 */
export const getCityList = async (req,res,next,options)=>{
	try{
		let cityId	=	options && options.city_id || "";
		if(cityId.constructor != Array) cityId = [cityId] ;

		/** Set options for get city list **/
		let cityOptions = {
			collections : [{
				collection 	: 	Tables.CITIES,
				columns 	: 	["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
				selected 	: 	cityId || [],
				conditions 	: 	{},
			}]
		};

		/** Get city list **/
		let dropdownRes = await getDropdownList(req,res,next,cityOptions);
		if(dropdownRes.status != Constants.STATUS_SUCCESS){
			console.log("Error at getCityList utility file", dropdownRes);
			return "";
		}

		/** Send response */
		return dropdownRes?.final_html_data?.["0"] || "";
	}catch(e){
		console.log("Error at getCityList utility file", e);
		return "";
	}
};// End getCityList()

/**
 * Function for get area list
 *
 * @param req		As 	Request Data
 * @param res		As 	Response Data
 * @param next 		As 	Callback argument to the middleware function
 * @param options 	As	data object
 *
 * @return render/json
 */
export const getAreaList = async (req,res,next,options={})=>{
	try{
		let cityId	=	options && options.city_id || "";
		let areaId	=	options && options.area_id || "";

		if(!cityId) return "";

		if(areaId && areaId.constructor != Array) areaId = [areaId] ;
		if(cityId.constructor != Array) cityId = [cityId] ;

		/** Set options for get area list **/
		let areaOptions = {
			collections : [{
				collection 	: 	Tables.AREAS,
				columns 	: 	["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
				selected 	: 	areaId || [],
				conditions 	: 	{
					city_id 	:	{$in : arrayToObject(cityId)},
					is_active	:	Constants.ACTIVE
				},
			}]
		};

		/** Get area list **/
		let dropdownRes = await getDropdownList(req,res,next,areaOptions);
		if(dropdownRes.status != Constants.STATUS_SUCCESS){
			console.log("Error at getAreaList utility file", dropdownRes);
			return "";
		}

		/** Send response */
		return dropdownRes?.final_html_data?.["0"] || "";
	}catch(e){
		console.log("Error at getAreaList utility file", e);
		return "";
	}
};//End getAreaList()

/**
 * Function for get area list with city opt group
 *
 * @param req		As 	Request Data
 * @param res		As 	Response Data
 * @param next 		As 	Callback argument to the middleware function
 * @param options 	As	data object
 *
 * @return render/json
 */
export const areaListCityWise = async (req,res,next,options={})=>{
	try {
		let cityIds = options.city_id;
		let areaIds = options.area_id;

		if (!cityIds.length) return { status: Constants.STATUS_SUCCESS, area_list: '' };

		let db = getDb();
		const [areas, cities] = await Promise.all([
			db.collection(Tables.AREAS)
				.find({ is_active: Constants.ACTIVE, city_id: { $in: arrayToObject(cityIds) } }, { projection: { _id: 1, name: 1, city_id: 1 } })
				.sort({ ['name.' + Constants.DEFAULT_LANGUAGE_CODE]: Constants.SORT_ASC })
				.toArray(),
			db.collection(Tables.CITIES)
				.find({ _id: { $in: arrayToObject(cityIds) } }, { projection: { _id: 1, name: 1 } })
				.toArray(),
		]);

		let areaList = {};
		areas.forEach(records => {
			if (!areaList[records.city_id]) areaList[records.city_id] = [];
			areaList[records.city_id].push(records);
		});

		let cityList = {};
		cities.forEach(records => {
			cityList[records._id] = records.name[Constants.DEFAULT_LANGUAGE_CODE];
		});

		let finalAreaList = '';
		Object.keys(cityList).forEach(cityId => {
			let cityName = cityList[cityId] || '';
			if (areaList[cityId]) {
				finalAreaList += `<optgroup label='${cityName}'>`;
				areaList[cityId].forEach(records => {
					let areaIdVal = records._id;
					let areaName = records.name[Constants.DEFAULT_LANGUAGE_CODE];
					let selectedFlag = '';
					if (areaIds && areaIds.length > 0) {
						areaIds.forEach(tempAreaId => {
							if (String(tempAreaId) === String(areaIdVal)) selectedFlag = 'selected';
						});
					}
					finalAreaList += `<option value='${areaIdVal}' ${selectedFlag}>${areaName}</option>`;
				});
				finalAreaList += '</optgroup>';
			}
		});
		return { status: Constants.STATUS_SUCCESS, area_list: finalAreaList };
	} catch (err) {
		next(err);
	}
};//End areaListCityWise()

/**
 * Function for get block list
 *
 * @param req		As 	Request Data
 * @param res		As 	Response Data
 * @param next 		As 	Callback argument to the middleware function
 * @param options 	As	data object
 *
 * @return render/json
 */
export const getBlockList = async (req,res,next,options)=>{
	try{
		let areaId	=	(options.area_id) 	? 	options.area_id 	:"";
		let blockId	=	(options.block_id) 	?	options.block_id	:"";

		/** Send error response */
		if(!areaId) return {status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") };

		/** Set options for get block list **/
		let areaOptions = {
			collections : [{
				collection 	: 	Tables.AREA_BLOCKS,
				columns 	: 	["_id",["name",Constants.DEFAULT_LANGUAGE_CODE]],
				selected 	: 	[blockId],
				conditions 	: 	{
					area_id 	:	new ObjectId(areaId),
					is_active	:	Constants.ACTIVE
				},
			}]
		};

		/** Get blocks list **/
		let dropRes = await getDropdownList(req,res,next,areaOptions);
		if(dropRes.status != Constants.STATUS_SUCCESS) return console.error(dropRes.message);

		/** Send response */
		return dropRes?.final_html_data?.["0"] || "";
	}catch(e){
		console.log("Error at getBlockList utility file", e);
		return "";
	}
};//End getBlockList()