import * as geolib from 'geolib';
import * as Constants from "../config/global_constant.mjs";

/**
* Function to Checks whether a point is inside of a circle or not
*
* @param req		As 	Request Data
* @param res		As 	Response Data
* @param next		As 	Callback argument to the middleware function
* @param options	As	object data
*
* @return json
**/
export const checkDriverNearByLocation = async (req, res, next, options) => {
	return new Promise(resolve=>{
		let pointLatLong	 	=	(options.point_lat_long) 		? options.point_lat_long 	:"";
		let radiusInMeter		=	(options.radius_in_meter)		? options.radius_in_meter 	:0;
		let centerPointLatLong 	=	(options.center_point_lat_long)	? options.center_point_lat_long :"";

		/** Send error response **/
		if(!pointLatLong || !centerPointLatLong || !radiusInMeter || !pointLatLong.latitude || !pointLatLong.longitude || !centerPointLatLong.latitude || !centerPointLatLong.longitude){
			return resolve({status: Constants.STATUS_ERROR, message: res.__("system.missing_parameters")});
		}

		let isNearBy =  geolib.isPointWithinRadius(pointLatLong, centerPointLatLong, radiusInMeter );

		/** Send success response **/
		return resolve({status: Constants.STATUS_SUCCESS, is_nearby: isNearBy });
	}).catch(next);
};// end checkDriverNearByLocation()