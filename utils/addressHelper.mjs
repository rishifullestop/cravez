import {parallel as asyncParallel} from 'async';

import  {arrayToObject} from './arrayHelper.mjs';
import * as Constants from "../config/global_constant.mjs";
import { getDb } from '../config/connection.mjs';
import Tables from '../config/database_tables.mjs';

/**
 * Function to get customer address
 *
 * @param req		As Request Data
 * @param res		As Response Data
 * @param next		As Callback argument to the middleware function
 * @param options	As Object data
 *
 * @return json
 **/
export const getCustomerAddress = (req,res,next,options)=>{
	return new Promise(resolve=>{
		let addressIds  = (options.customer_address_id) ? options.customer_address_id :[];

		/** Send error response */
		if(!addressIds || addressIds.length <= 0) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters")});

        if(addressIds.constructor !== Array)	addressIds = [addressIds];
        addressIds = arrayToObject(addressIds);

		/** Get detail of Order **/
		const dbInstance = getDb();
		const customer_addresses = dbInstance.collection(Tables.CUSTOMER_ADDRESSES);
		customer_addresses.find({
            _id : {$in : addressIds}
		},{projection: {
			_id:1,address_type:1,street:1,modified:1,first_name:1,last_name:1,mobile_number:1,landline_number:1,venue:1,area_id:1,city_id:1,block_id:1,jadda:1,address_title:1,country:1,additional_directions:1,building_number:1,floor_number:1,flat_number:1,latitude:1,longitude:1
		}}).toArray().then(addressResult=>{

			/** Send error response */
			if(!addressResult || addressResult.length <= 0) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.something_going_wrong_please_try_again") });

            /** Push city id, area id and block id in array */
            let cityIds 	= [];
            let areaIds 	= [];
            let blockIds 	= [];
            addressResult.map(record=>{
                cityIds.push(record.city_id);
                areaIds.push(record.area_id);
                blockIds.push(record.block_id);
            });

            asyncParallel({
				city_details: (childCallback)=>{
                    /** Get city names */
                    const cities = dbInstance.collection(Tables.CITIES);
                    cities.find({_id: {$in: arrayToObject(cityIds)}},{projection : {_id: 1,name: 1}}).toArray().then(cityResult=>{

                        let cityList = {};
                        cityResult.map(city=>{
                            cityList[city._id] = city.name;
                        });
                        childCallback(null,cityList);
                    }).catch(next);
                },
                area_details: (childCallback)=>{
                    /** Get area names */
                    const areas = dbInstance.collection(Tables.AREAS);
                    areas.find({_id : {$in : arrayToObject(areaIds)}},{projection : {_id: 1,name: 1}}).toArray().then(areaResult=>{

                        let areaList = {};
                        areaResult.map(area=>{
                            areaList[area._id] = area.name;
                        });
                        childCallback(null,areaList);
                    }).catch(next);
                },
                block_details: (childCallback)=>{
                    /** Get block names */
                    const area_blocks = dbInstance.collection(Tables.AREA_BLOCKS);
                    area_blocks.find({_id : {$in : arrayToObject(blockIds)}},{projection : {_id: 1,name: 1}}).toArray().then(blockResult=>{

                        let blockList = {};
                        blockResult.map(block=>{
                            blockList[block._id] = block.name;
                        });
                        childCallback(null,blockList);
                    }).catch(next);
                }
			},(asyncErr, response)=>{
				if(asyncErr) return next(asyncErr);

				let cityObj	 	=	response.city_details;
                let areaObj	 	=	response.area_details;
                let blockObj 	=	response.block_details;
                let addressList =	{};

                addressResult.map(record=>{
                    record.block_name 	= 	blockObj[record.block_id]	?	blockObj[record.block_id] :"";
                    record.area_name 	= 	areaObj[record.area_id] 	? 	areaObj[record.area_id]   :"";
					record.city_name	=	cityObj[record.city_id] 	? 	cityObj[record.city_id]   :"";

                    addressList[record._id] = record;
                });

                resolve({status: Constants.STATUS_SUCCESS, result : addressList});
			});
		}).catch(next);
	}).catch(next);
}//End getCustomerAddress()

/**
 * Function to arrange user address format
 *
 * @param req		As Request Data
 * @param res		As Response Data
 * @param next		As Callback argument to the middleware function
 * @param options	As Object data
 *
 * @return json
 **/
export const arrangeUserAddress = (req,res,next,userAddress)=>{
	let formattedAddress = "";
	if(!userAddress || userAddress.constructor !== Object || Object.keys(userAddress).length == 0){
		return formattedAddress;
	}

	let buildingLabel 	=  	res.__("user_address.building_no")+"- ";
	let floorLabel 		=  	res.__("user_address.floor_no")+"- ";
	let flatLabel 		=  	res.__("user_address.flat_no")+"- ";
	let directionsLabel =  	res.__("user_address.directions")+"- ";
	let addressTitle 	= 	(userAddress.address_title) ? 	userAddress.address_title+", " 	:"";
	let buildingNumber 	=	(userAddress.building_number) ? buildingLabel+userAddress.building_number+", " :"";
	let floorNumber 	= 	(userAddress.floor_number) 	? floorLabel+userAddress.floor_number+", ":"";
	let flatNumber 		= 	(userAddress.flat_number) 	? flatLabel+userAddress.flat_number+", " :"";
	let jadda 			=	(userAddress.jadda) 		?	userAddress.jadda+", " 			:"";
	let firstName		=	(userAddress.first_name) 	?	userAddress.first_name 			:"";
	let lastName		=	(userAddress.last_name) 	?	userAddress.last_name 			:"";
	let addressType		=	(userAddress.address_type) 	?	userAddress.address_type+", " 	:"";
	let street			=	(userAddress.street) 		?	userAddress.street+", " 		:"";
	let blockName		=	(userAddress.block_name) 	?	userAddress.block_name.en+", " 	:"";
	let areaName		=	(userAddress.area_name) 	?	userAddress.area_name.en+", " 	:"";
	let cityName		=	(userAddress.city_name) 	?	userAddress.city_name.en+", " 	:"";
	let countryName		=	(userAddress.country) 		?	userAddress.country.en		 	:"";
	let directions		=	(userAddress.additional_directions)? ", "+directionsLabel+userAddress.additional_directions :"";
	let fullName		=	firstName+" "+lastName+", ";

	return addressTitle+fullName+addressType+buildingNumber+floorNumber+flatNumber+jadda+blockName+street+areaName+cityName+countryName+directions;
}; //End  arrangeUserAddress()