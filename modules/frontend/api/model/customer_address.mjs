import { ObjectId } from 'mongodb';
import { parallel as asyncParallel } from 'async';

import * as Constants from '../../../../config/global_constant.mjs';
import Tables from '../../../../config/database_tables.mjs';
import * as Helpers from '../../../../utils/index.mjs';
import { addEditAddressValidation  } from '../validations/addressValidations.mjs';

export default class CustomerAddress {
    constructor(db) {
        this.db = db;
    }

	/**
	 * Function for get address list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async getAddressList (req, res,next){
		return new Promise(resolve=>{
			let userId	 = req?.body?.user_id && new ObjectId(req.body.user_id) || "";
			let deviceId = !userId && req?.body?.device_id || "";

			/** Send error response */
			if(!userId && !deviceId) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			/** Set Conditions  */
			let addressConditions = {};
			if(userId) addressConditions.user_id = userId;
			else addressConditions.device_id = deviceId;
			addressConditions ={...addressConditions, $or :[{invalid_address : false},{invalid_address : {$exists : false}}]};

			/** Get address list  **/
			const customer_addresses = this.db.collection(Tables.CUSTOMER_ADDRESSES);
			customer_addresses.find(addressConditions,{projection:{modified:0,created:0,long_lat:0}}).sort({_id: Constants.SORT_DESC}).toArray().then(result=>{

				/** Send success response **/
				if(result.length <= 0) resolve({status: Constants.STATUS_SUCCESS, result: result });

				/** Push city id, area id and block id in array */
				let cityIds 	= [];
				let areaIds 	= [];
				let blockIds 	= [];
				result.map(record=>{
					cityIds.push(record.city_id);
					areaIds.push(record.area_id);
					blockIds.push(record.block_id);
				});

				asyncParallel({
					city_details: (callback)=>{
						/** Get city names */
						const cities = this.db.collection(Tables.CITIES);
						cities.find({_id : {$in : Helpers.arrayToObject(cityIds)}},{projection : {_id: 1,name: 1}}).toArray().then(cityResult=>{

							let cityList = {};
							cityResult.map(city=>{
								cityList[city._id] = city.name;
							});
							callback(null,cityList);
						}).catch(next);
					},
					area_details: (callback)=>{
						/** Get area names */
						const areas = this.db.collection(Tables.AREAS);
						areas.find({_id : {$in : Helpers.arrayToObject(areaIds)}},{projection : {_id: 1,name: 1}}).toArray().then(areaResult=>{

							let areaList = {};
							areaResult.map(area=>{
								areaList[area._id] = area.name;
							});
							callback(null,areaList);
						}).catch(next);
					},
					block_details: (callback)=>{
						/** Get block names */
						const area_blocks = this.db.collection(Tables.AREA_BLOCKS);
						area_blocks.find({_id : {$in : Helpers.arrayToObject(blockIds)}},{projection : {_id: 1,name: 1}}).toArray().then(blockResult=>{

							let blockList = {};
							blockResult.map(block=>{
								blockList[block._id] = block.name;
							});
							callback(null,blockList);
						}).catch(next);
					},
				},(asyncErr,asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					result.map(record=>{
						record.block_name =	asyncResponse?.block_details?.[record.block_id] || "";
						record.area_name  =	asyncResponse?.area_details?.[record.area_id] || "";
						record.city_name  =	asyncResponse?.city_details?.[record.city_id] || "";
					});

					/** Send response **/
					resolve({
						status: Constants.STATUS_SUCCESS,
						result: result,
					});
				});
			}).catch(next);
		}).catch(next);
	};//End getAddressList()

	/**
	 * Function to add/edit customer address
	 *
	 * @param req 	As 	Request Data
	 * @param res 	As 	Response Data
	 * @param next	As	Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	async addEditAddress (req,res,next){
		return new Promise(async resolve=>{
			/** Sanitize Data **/
			req.body			=	Helpers.sanitizeData(req.body,Constants.NOT_ALLOWED_TAGS_XSS_WITHOUT_IFRAME);
			let isEditable		= 	(req.body.id) ?	true : false;
			let addressId		= 	(req.body.id) ? new ObjectId(req.body.id):	new ObjectId();
			let userId	 		=	req?.body?.user_id && new ObjectId(req.body.user_id) || "";
			let deviceId 		=	!userId && req?.body?.device_id || "";
			let firstName		=	(req.body.first_name)			?	req.body.first_name			:"";
			let lastName		=	(req.body.last_name)			?	req.body.last_name			:"";
			let mobileNumber	=	(req.body.mobile_number)		?	req.body.mobile_number		:"";
			let landlineNumber	=	(req.body.landline_number)		?	req.body.landline_number	:"";
			let addressType		=	(req.body.address_type)			?	req.body.address_type		:"";
			let street			=	(req.body.street)				?	req.body.street				:"";
			let venue			=	(req.body.venue)				?	req.body.venue				:"";
			let latitude		=	(req.body.latitude)				?	parseFloat(req.body.latitude):"";
			let longitude		=	(req.body.longitude)			?	parseFloat(req.body.longitude):"";
			let areaId			=	(req.body.area_id)				?	new ObjectId(req.body.area_id)	:"";
			let blockId			=	(req.body.block_id)				?	new ObjectId(req.body.block_id)	:"";
			let cityId			=	(req.body.city_id)				?	new ObjectId(req.body.city_id)	:"";
			let isDefault		=	(req.body.is_default)			?	JSON.parse(req.body.is_default)	:false;
			let addressTitle	= 	(req.body.address_title)		? 	req.body.address_title		:"";
			let jadda		 	= 	(req.body.jadda)				?	req.body.jadda				:"";
			let onlyValidate	= 	(req.body.only_validate)		?	JSON.parse(req.body.only_validate)	:false;
			let notCheckedMobile= 	(req.body.not_checked_mobile)	?	JSON.parse(req.body.not_checked_mobile)	:false;
			let additionalDirections = (req.body.additional_directions) ? req.body.additional_directions:"";

			/** Send error response */
			if(!userId && !deviceId){
				return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});
			}

			/** Apply validation */
			let validationResponse = await Helpers.applyValidationInterCallFunction(req, res, next, addEditAddressValidation);
			if(validationResponse.status != Constants.STATUS_SUCCESS) return resolve(validationResponse);

			if(!notCheckedMobile && (mobileNumber || landlineNumber)){

				let response = Helpers.checkNumberValid(req,res,next,{mobile_number :mobileNumber,landline_number:landlineNumber});
				if(response.status != Constants.STATUS_SUCCESS){
					return resolve({status: Constants.STATUS_ERROR, message: response.errors});
				}
			}

			/** Send success response */
			if(onlyValidate) return resolve({status: Constants.STATUS_SUCCESS});

			/** Save address data **/
			const customer_addresses = this.db.collection(Tables.CUSTOMER_ADDRESSES);
			customer_addresses.updateOne({
				_id: addressId
			},
			{	$set : {
					first_name		:	firstName,
					last_name		:	lastName,
					landline_number	:	landlineNumber,
					mobile_number	:	mobileNumber,
					latitude		:	latitude,
					longitude		:	longitude,
					long_lat		:	[longitude,latitude],
					area_id			:	areaId,
					block_id		:	blockId,
					city_id			:	cityId,
					address_type	:	addressType,
					street			:	street,
					venue			:	venue,
					is_default		:	isDefault,
					jadda        	:	jadda,
					address_title 	: 	addressTitle,
					modified   		: 	Helpers.getUtcDate(),
					additional_directions:	additionalDirections,
					building_number : 	req.body.building_number,
					floor_number	:	req.body.floor_number,
					flat_number		:	req.body.flat_number,
					country 		: 	Constants.COUNTRY_NAME
				},
				$setOnInsert : {
					device_id	: deviceId,
					user_id		: userId,
					created 	: Helpers.getUtcDate(),
				}
			},{upsert: true}).then(() => {

				asyncParallel({
					remove_default: (callback)=>{
						if(!isDefault) return callback(null);

						/** Set Conditions  */
						let addressConditions = {};
						if(userId) addressConditions.user_id = userId;
						else addressConditions.device_id = deviceId;
						addressConditions ={...addressConditions, _id: {$ne: addressId} };

						/** Update address details */
						customer_addresses.updateMany(addressConditions,
						{$set : {
							is_default	:	false,
							modified	: 	Helpers.getUtcDate()
						}}).then(() => {
							callback(null);
						}).catch(next);
					},
				},(asyncErr)=>{
					if(asyncErr) return next(asyncErr);

					/** Send success response **/
					let message = (isEditable) ? res.__("customer_address.customer_address_has_been_updated_successfully") :res.__("customer_address.customer_address_has_been_added_successfully");
					resolve({
						status	: 	Constants.STATUS_SUCCESS,
						message	:	message
					});
				});
			}).catch(next);
		}).catch(next);
	};//End addEditAddress()

	/**
	 * Function to delete customer address
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	*/
	async deleteAddress (req, res, next){
		return new Promise(resolve=>{
			let addressId= req?.body?.id && new ObjectId(req.body.id) || "";
			let userId	 = req?.body?.user_id && new ObjectId(req.body.user_id) || "";
			let deviceId = !userId && req?.body?.device_id || "";

			/** Send error response */
			if((!userId && !deviceId) || !addressId) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			/** Set address conditions */
			let addressConditions ={_id : addressId};
			if(userId) addressConditions.user_id = userId;
			else addressConditions.device_id = deviceId;

			/** Get address details */
			const customer_addresses   = this.db.collection(Tables.CUSTOMER_ADDRESSES);
			customer_addresses.findOne(addressConditions,{projection: {_id: 1}}).then(findResult=>{

				/** Send error response */
				if(!findResult) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

				/**For delete customer address */
				customer_addresses.deleteOne(addressConditions).then(()=>{

					/** Send success response **/
					resolve({
						status	: 	Constants.STATUS_SUCCESS,
						message	:	res.__("customer_address.customer_address_has_been_deleted_successfully")
					});
				}).catch(next);
			}).catch(next);
		}).catch(next);
	};//End deleteAddress()

	/**
	 * Function to get customer address details
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return null
	*/
	async getAddressDetails (req, res, next){
		return new Promise(resolve=>{
			let addressId 	=	req?.body?.address_id && new ObjectId(req.body.address_id) || "";
			let userId	 	=	req?.body?.user_id && new ObjectId(req.body.user_id) || "";
			let deviceId 	=	!userId && req?.body?.device_id || "";

			/** Send error response */
			if((!userId && !deviceId) || !addressId) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access")});

			/** Set address conditions */
			let addressConditions ={_id : addressId};
			if(userId) addressConditions.user_id = userId;
			else if(deviceId) addressConditions.device_id = deviceId;

			/** Get address details */
			const customer_addresses   = this.db.collection(Tables.CUSTOMER_ADDRESSES);
			customer_addresses.findOne(addressConditions,{projection: {modified:0,created:0,long_lat:0}}).then(findResult=>{

				/** Send error response */
				if(!findResult) return resolve({status: Constants.STATUS_ERROR, message: res.__("system.invalid_access") });

				asyncParallel({
					city_details: (callback)=>{
						/** Get city names */
						const cities = this.db.collection(Tables.CITIES);
						cities.findOne({_id : findResult.city_id},{projection : {_id: 1,name: 1}}).then(cityResult=>{
							callback(null,cityResult);
						}).catch(next);
					},
					area_details: (callback)=>{
						/** Get area names */
						const areas = this.db.collection(Tables.AREAS);
						areas.findOne({_id : findResult.area_id},{projection : {_id: 1,name: 1}}).then(areaResult=>{
							callback(null,areaResult);
						}).catch(next);
					},
					block_details: (callback)=>{
						/** Get block names */
						const area_blocks = this.db.collection(Tables.AREA_BLOCKS);
						area_blocks.findOne({_id : findResult.block_id},{projection : {_id: 1,name: 1}}).then(blockResult=>{
							callback(null,blockResult);
						}).catch(next);
					},
				},(asyncErr,asyncResponse)=>{
					if(asyncErr) return next(asyncErr);

					/** Insert block,area,city name in result */
					findResult.block_name = asyncResponse?.block_details?.name || {};
					findResult.area_name  = asyncResponse?.area_details?.name || {};
					findResult.city_name  = asyncResponse?.city_details?.name || {};

					/** Send success response **/
					resolve({ status: Constants.STATUS_SUCCESS, result: findResult});
				});
			}).catch(next);
		}).catch(next);
	};//End getAddressDetails()
}// End CustomerAddress